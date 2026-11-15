// A small expression language for custom columns.
//
// A "sheet" is a list of named definitions. Definitions may refer to catalogue
// parameters, to each other in any order, and even to themselves in a loop:
//
//     Rds = rds_on(12, Tj)            // on-resistance at Vgs = 12 V, at junction temperature Tj
//     P   = 10^2 * Rds                // conduction loss at 10 A
//     Tj  = 40 + P * (rth_jc() + 1)   // 40 °C ambient, 1 °C/W heatsink
//
// Loops like Rds -> P -> Tj -> Rds are solved per part by fixed-point iteration,
// which is exactly the physics: if it does not settle, the part runs away.

export type Val = number | string;

export interface EvalCtx {
  row: number;
  /** current values of the sheet's definitions */
  locals: Float64Array;
  /** set by model functions when they fall back to a generic model */
  est: boolean;
  /** set when a value is unavailable for a specific reason */
  note: string | null;
}

export type Fn = (ctx: EvalCtx, args: Val[], named: Record<string, Val>) => Val;

export interface Env {
  /** resolve a bare identifier or [bracketed name] to an accessor */
  variable(name: string, bracketed: boolean): ((ctx: EvalCtx) => Val) | null;
  functions: Record<string, Fn>;
  /** names offered in error messages */
  suggestions(): string[];
}

export class FormulaError extends Error {
  pos: number;
  constructor(message: string, pos = 0) {
    super(message);
    this.pos = pos;
  }
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Tok =
  | { t: 'num'; v: number; pos: number }
  | { t: 'str'; v: string; pos: number }
  | { t: 'id'; v: string; pos: number }
  | { t: 'ref'; v: string; pos: number }
  | { t: 'op'; v: string; pos: number }
  | { t: 'end'; pos: number };

const SUFFIX: Record<string, number> = {
  f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9,
};
const OPS = ['<=', '>=', '==', '!=', '&&', '||', '+', '-', '*', '/', '^', '(', ')', ',', '<', '>', '?', ':', '=', '!'];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '#' || (c === '/' && src[i + 1] === '/')) break; // comment to end of line
    if (/[0-9.]/.test(c) && (c !== '.' || /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i))!;
      let v = parseFloat(m[0]);
      let j = i + m[0].length;
      // Optional SI prefix and/or unit glued to the digits: 10m, 4.7k, 100n, 12V, 70C, 5mΩ, 40°C.
      // The unit is decoration (everything is in base SI units); the prefix scales.
      const u = /^([fpnuµμmkKMG])?(Hz|ohm|°C|[AVWFHΩRsC])?(?![A-Za-z0-9_])/.exec(src.slice(j));
      if (u && u[0]) {
        if (u[1]) v *= SUFFIX[u[1]];
        j += u[0].length;
      }
      out.push({ t: 'num', v, pos: i });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      const j = src.indexOf(c, i + 1);
      if (j < 0) throw new FormulaError('Unterminated text', i);
      out.push({ t: 'str', v: src.slice(i + 1, j), pos: i });
      i = j + 1;
      continue;
    }
    if (c === '[') {
      const j = src.indexOf(']', i + 1);
      if (j < 0) throw new FormulaError('Missing ] after parameter name', i);
      out.push({ t: 'ref', v: src.slice(i + 1, j).trim(), pos: i });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i))!;
      out.push({ t: 'id', v: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new FormulaError(`Unexpected character "${c}"`, i);
    out.push({ t: 'op', v: op, pos: i });
    i += op.length;
  }
  out.push({ t: 'end', pos: src.length });
  return out;
}

// ---------------------------------------------------------------------------
// Parser (precedence climbing) -> AST
// ---------------------------------------------------------------------------

export type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'var'; name: string; bracketed: boolean; pos: number }
  | { k: 'call'; name: string; args: Node[]; named: Record<string, Node>; pos: number }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'cond'; c: Node; a: Node; b: Node };

const BIN_PREC: Record<string, number> = {
  '||': 1, or: 1, '&&': 2, and: 2,
  '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4,
  '+': 5, '-': 5, '*': 6, '/': 6, '^': 8,
};

export function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => { const t = toks[p]; return (t.t === 'op' && t.v === v) || (t.t === 'id' && t.v === v && (v === 'and' || v === 'or')); };
  const expect = (v: string) => {
    if (!isOp(v)) throw new FormulaError(`Expected "${v}"`, peek().pos);
    p++;
  };

  function primary(): Node {
    const t = toks[p++];
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === 'ref') return { k: 'var', name: t.v, bracketed: true, pos: t.pos };
    if (t.t === 'id') {
      if (isOp('(')) {
        p++;
        const args: Node[] = [];
        const named: Record<string, Node> = {};
        if (!isOp(')')) {
          for (;;) {
            const a = toks[p], b = toks[p + 1];
            if (a.t === 'id' && b.t === 'op' && b.v === '=') { p += 2; named[a.v.toLowerCase()] = ternary(); }
            else args.push(ternary());
            if (isOp(',')) { p++; continue; }
            break;
          }
        }
        expect(')');
        return { k: 'call', name: t.v, args, named, pos: t.pos };
      }
      return { k: 'var', name: t.v, bracketed: false, pos: t.pos };
    }
    if (t.t === 'op' && t.v === '(') {
      const e = ternary();
      expect(')');
      return e;
    }
    if (t.t === 'op' && (t.v === '-' || t.v === '+' || t.v === '!')) return { k: 'un', op: t.v, a: binary(7) };
    if (t.t === 'end') throw new FormulaError('Formula is incomplete', t.pos);
    throw new FormulaError(`Unexpected "${'v' in t ? t.v : ''}"`, t.pos);
  }

  function binary(minPrec: number): Node {
    let left = primary();
    for (;;) {
      const t = peek();
      const op = t.t === 'op' || t.t === 'id' ? String(t.v) : '';
      const prec = BIN_PREC[op];
      if (prec === undefined || prec < minPrec) return left;
      p++;
      // ^ is right-associative
      const right = binary(op === '^' ? prec : prec + 1);
      left = { k: 'bin', op, a: left, b: right };
    }
  }

  function ternary(): Node {
    const c = binary(1);
    if (isOp('?')) {
      p++;
      const a = ternary();
      expect(':');
      const b = ternary();
      return { k: 'cond', c, a, b };
    }
    return c;
  }

  const e = ternary();
  if (peek().t !== 'end') throw new FormulaError(`Unexpected "${'v' in peek() ? (peek() as { v: Val }).v : ''}"`, peek().pos);
  return e;
}

// ---------------------------------------------------------------------------
// Compile AST -> closure
// ---------------------------------------------------------------------------

type Compiled = (ctx: EvalCtx) => Val;
const N = (v: Val): number => (typeof v === 'number' ? v : NaN);
const truthy = (v: Val) => (typeof v === 'number' ? v !== 0 && !Number.isNaN(v) : v !== '');

function near(names: string[], name: string): string[] {
  const n = name.toLowerCase();
  return names.filter((s) => s.toLowerCase().includes(n) || n.includes(s.toLowerCase())).slice(0, 4);
}

export function compileNode(node: Node, env: Env, localIndex: Map<string, number>, deps: Set<number>): Compiled {
  const c = (n: Node): Compiled => compileNode(n, env, localIndex, deps);
  switch (node.k) {
    case 'num': { const v = node.v; return () => v; }
    case 'str': { const v = node.v; return () => v; }
    case 'var': {
      if (!node.bracketed) {
        const li = localIndex.get(node.name.toLowerCase());
        if (li !== undefined) { deps.add(li); return (ctx) => ctx.locals[li]; }
        const k = CONSTANTS[node.name.toLowerCase()];
        if (k !== undefined) return () => k;
      }
      const acc = env.variable(node.name, node.bracketed);
      if (acc) return acc;
      const hint = near(env.suggestions(), node.name);
      throw new FormulaError(`Unknown name "${node.name}"${hint.length ? ` — did you mean ${hint.join(', ')}?` : ''}`, node.pos);
    }
    case 'call': {
      const name = node.name.toLowerCase();
      const args = node.args.map(c);
      const namedC = Object.fromEntries(Object.entries(node.named).map(([k, v]) => [k, c(v)]));
      const hasNamed = Object.keys(namedC).length > 0;
      if (name === 'if') {
        if (args.length !== 3) throw new FormulaError('if(condition, then, else) takes three arguments', node.pos);
        return (ctx) => (truthy(args[0](ctx)) ? args[1](ctx) : args[2](ctx));
      }
      if (name === 'coalesce') {
        return (ctx) => {
          for (const a of args) { const v = a(ctx); if (typeof v === 'string' ? v !== '' : !Number.isNaN(v)) return v; }
          return NaN;
        };
      }
      const fn = env.functions[name] ?? MATH[name];
      if (!fn) {
        const hint = near([...Object.keys(env.functions), ...Object.keys(MATH)], name);
        throw new FormulaError(`Unknown function "${node.name}"${hint.length ? ` — did you mean ${hint.join(', ')}?` : ''}`, node.pos);
      }
      return (ctx) => {
        const a = new Array<Val>(args.length);
        for (let i = 0; i < args.length; i++) a[i] = args[i](ctx);
        const nm: Record<string, Val> = {};
        if (hasNamed) for (const k in namedC) nm[k] = namedC[k](ctx);
        return fn(ctx, a, nm);
      };
    }
    case 'un': {
      const a = c(node.a);
      if (node.op === '-') return (ctx) => -N(a(ctx));
      if (node.op === '!') return (ctx) => (truthy(a(ctx)) ? 0 : 1);
      return (ctx) => N(a(ctx));
    }
    case 'cond': {
      const cc = c(node.c), a = c(node.a), b = c(node.b);
      return (ctx) => (truthy(cc(ctx)) ? a(ctx) : b(ctx));
    }
    case 'bin': {
      const a = c(node.a), b = c(node.b);
      switch (node.op) {
        case '+': return (ctx) => N(a(ctx)) + N(b(ctx));
        case '-': return (ctx) => N(a(ctx)) - N(b(ctx));
        case '*': return (ctx) => N(a(ctx)) * N(b(ctx));
        case '/': return (ctx) => N(a(ctx)) / N(b(ctx));
        case '^': return (ctx) => Math.pow(N(a(ctx)), N(b(ctx)));
        case '<': return (ctx) => (N(a(ctx)) < N(b(ctx)) ? 1 : 0);
        case '<=': return (ctx) => (N(a(ctx)) <= N(b(ctx)) ? 1 : 0);
        case '>': return (ctx) => (N(a(ctx)) > N(b(ctx)) ? 1 : 0);
        case '>=': return (ctx) => (N(a(ctx)) >= N(b(ctx)) ? 1 : 0);
        case '==': return (ctx) => { const x = a(ctx), y = b(ctx); return (typeof x === 'string' || typeof y === 'string' ? String(x).toLowerCase() === String(y).toLowerCase() : x === y) ? 1 : 0; };
        case '!=': return (ctx) => { const x = a(ctx), y = b(ctx); return (typeof x === 'string' || typeof y === 'string' ? String(x).toLowerCase() !== String(y).toLowerCase() : x !== y) ? 1 : 0; };
        case '&&': case 'and': return (ctx) => (truthy(a(ctx)) && truthy(b(ctx)) ? 1 : 0);
        case '||': case 'or': return (ctx) => (truthy(a(ctx)) || truthy(b(ctx)) ? 1 : 0);
      }
      throw new FormulaError(`Unknown operator ${node.op}`);
    }
  }
}

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E, nan: NaN, inf: Infinity };

const m1 = (f: (x: number) => number): Fn => (_c, a) => f(N(a[0]));
const MATH: Record<string, Fn> = {
  abs: m1(Math.abs), sqrt: m1(Math.sqrt), exp: m1(Math.exp), ln: m1(Math.log), log: m1(Math.log10), log10: m1(Math.log10),
  log2: m1(Math.log2), floor: m1(Math.floor), ceil: m1(Math.ceil), sin: m1(Math.sin), cos: m1(Math.cos), tan: m1(Math.tan),
  round: (_c, a) => { const d = a.length > 1 ? N(a[1]) : 0; const f = 10 ** d; return Math.round(N(a[0]) * f) / f; },
  pow: (_c, a) => Math.pow(N(a[0]), N(a[1])),
  min: (_c, a) => { let m = Infinity; for (const x of a) { const v = N(x); if (!Number.isNaN(v) && v < m) m = v; } return m === Infinity ? NaN : m; },
  max: (_c, a) => { let m = -Infinity; for (const x of a) { const v = N(x); if (!Number.isNaN(v) && v > m) m = v; } return m === -Infinity ? NaN : m; },
  clamp: (_c, a) => Math.min(Math.max(N(a[0]), N(a[1])), N(a[2])),
  isnan: (_c, a) => (typeof a[0] === 'number' && Number.isNaN(a[0]) ? 1 : 0),
  /** parallel combination, handy for resistors and thermal paths */
  par: (_c, a) => { let s = 0; for (const x of a) s += 1 / N(x); return 1 / s; },
};
export const MATH_NAMES = [...Object.keys(MATH), 'if', 'coalesce'];

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

export interface Definition {
  /** stable id used for filters / sorting */
  id: string;
  name: string;
  expr: string;
  unit?: string;
  show: boolean;
}

export interface CompiledSheet {
  defs: Definition[];
  /** per definition: null when it compiled, else the error */
  errors: (FormulaError | null)[];
  /** evaluate all definitions for one row; fills `out` (NaN where unavailable) */
  evalRow(row: number, out: Float64Array, flags: { est: Uint8Array; notes: (string | null)[] }): void;
}

const isIdent = (s: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
const MAX_ITER = 200;

export function compileSheet(defs: Definition[], env: Env): CompiledSheet {
  const n = defs.length;
  const localIndex = new Map<string, number>();
  const errors: (FormulaError | null)[] = new Array(n).fill(null);
  defs.forEach((d, i) => {
    const key = d.name.trim().toLowerCase();
    if (!isIdent(d.name.trim())) errors[i] = new FormulaError('Name must start with a letter and contain only letters, digits and _');
    else if (localIndex.has(key)) errors[i] = new FormulaError(`The name "${d.name}" is used twice`);
    else localIndex.set(key, i);
  });

  const fns: (Compiled | null)[] = new Array(n).fill(null);
  const deps: Set<number>[] = defs.map(() => new Set<number>());
  defs.forEach((d, i) => {
    if (errors[i]) return;
    if (!d.expr.trim()) { errors[i] = new FormulaError('Enter a formula'); return; }
    try {
      fns[i] = compileNode(parse(d.expr), env, localIndex, deps[i]);
    } catch (e) {
      errors[i] = e instanceof FormulaError ? e : new FormulaError(String(e));
    }
  });
  // a definition that depends on a broken one is broken too
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < n; i++) {
      if (errors[i]) continue;
      for (const d of deps[i]) if (errors[d]) { errors[i] = new FormulaError(`Depends on "${defs[d].name}", which has an error`); fns[i] = null; changed = true; break; }
    }
  }

  // Tarjan's strongly connected components -> evaluation order with loops grouped.
  const index = new Int32Array(n).fill(-1), low = new Int32Array(n), onStack = new Uint8Array(n);
  const stack: number[] = [];
  const groups: number[][] = [];
  let counter = 0;
  const strong = (v: number) => {
    index[v] = low[v] = counter++;
    stack.push(v); onStack[v] = 1;
    for (const w of deps[v]) {
      if (errors[w]) continue;
      if (index[w] < 0) { strong(w); low[v] = Math.min(low[v], low[w]); }
      else if (onStack[w]) low[v] = Math.min(low[v], index[w]);
    }
    if (low[v] === index[v]) {
      const g: number[] = [];
      for (;;) { const w = stack.pop()!; onStack[w] = 0; g.push(w); if (w === v) break; }
      groups.push(g.sort((a, b) => a - b));
    }
  };
  for (let i = 0; i < n; i++) if (!errors[i] && index[i] < 0) strong(i);
  // Tarjan emits dependencies first, which is the order we need.
  const plan = groups.map((g) => ({ ids: g, loop: g.length > 1 || deps[g[0]].has(g[0]) }));

  const ctx: EvalCtx = { row: 0, locals: new Float64Array(n), est: false, note: null };

  function evalRow(row: number, out: Float64Array, flags: { est: Uint8Array; notes: (string | null)[] }) {
    ctx.row = row;
    const L = ctx.locals;
    L.fill(NaN);
    flags.est.fill(0);
    flags.notes.fill(null);
    for (const g of plan) {
      if (!g.loop) {
        const i = g.ids[0];
        ctx.est = false; ctx.note = null;
        const v = fns[i]!(ctx);
        L[i] = typeof v === 'number' ? v : NaN;
        // inherit "estimated" from what it was computed from
        let est = ctx.est;
        for (const d of deps[i]) if (flags.est[d]) est = true;
        flags.est[i] = est ? 1 : 0;
        if (Number.isNaN(L[i])) {
          let note = ctx.note as string | null;
          if (!note) for (const d of deps[i]) if (flags.notes[d]) { note = flags.notes[d]; break; }
          flags.notes[i] = note;
        }
        continue;
      }
      // Fixed-point iteration for a loop. Start from 25 (a sane junction temperature,
      // harmless for anything else), then relax if it oscillates.
      for (const i of g.ids) L[i] = 25;
      let ok = false, est = false, note: string | null = null, diverged = false;
      for (let it = 0; it < MAX_ITER && !ok && !diverged; it++) {
        const relax = it < 30 ? 1 : 0.5;
        let worst = 0;
        ctx.est = false; ctx.note = null;
        for (const i of g.ids) {
          const v = fns[i]!(ctx);
          const x = typeof v === 'number' ? v : NaN;
          if (Number.isNaN(x)) { diverged = true; note = (ctx.note as string | null) ?? note; break; }
          if (!Number.isFinite(x) || Math.abs(x) > 1e12) { diverged = true; note = 'no stable solution (runs away)'; break; }
          const next = L[i] + relax * (x - L[i]);
          const d = Math.abs(next - L[i]) / Math.max(1, Math.abs(next));
          if (d > worst) worst = d;
          L[i] = next;
        }
        est = ctx.est;
        if (!diverged && worst < 1e-7) ok = true;
      }
      if (!ok && !diverged) note = 'did not converge';
      for (const i of g.ids) {
        if (!ok) { L[i] = NaN; flags.notes[i] = note ?? 'no solution'; }
        let e = est;
        for (const d of deps[i]) if (flags.est[d]) e = true;
        flags.est[i] = e ? 1 : 0;
      }
    }
    for (let i = 0; i < n; i++) out[i] = errors[i] ? NaN : L[i];
  }

  return { defs, errors, evalRow };
}
