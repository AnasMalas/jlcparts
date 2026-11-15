// Assembles the full column list of a category: built-in columns (library
// class, stock, price), catalogue parameters, and user formula columns.

import type { Category, Column } from './data';
import { CLASS_NAMES, priceAt } from './data';
import type { DsMap } from './dsdata';
import { compileSheet, type CompiledSheet, type Definition, type Env, type EvalCtx, type Val } from './formula';
import { buildModels, type Models } from './models';
import { recipeFor } from '@shared/recipes.js';

export function builtinColumns(cat: Category, qty: number, ds?: DsMap): Column[] {
  const cls: Column = {
    id: '$class', name: 'Library class', kind: 'enum', n: cat.n, builtin: true,
    dict: CLASS_NAMES, ev: Int32Array.from(cat.cls),
    help: 'Basic and Preferred parts have no extended-part loading fee at JLCPCB.',
  };
  const stock: Column = { id: '$stock', name: 'Stock', kind: 'num', n: cat.n, unit: 'count', builtin: true, nv: Float64Array.from(cat.stock) };
  const price = new Float64Array(cat.n);
  for (let r = 0; r < cat.n; r++) price[r] = priceAt(cat.price[r], qty);
  const priceCol: Column = {
    id: '$price', name: `Unit price @ ${qty}`, kind: 'num', n: cat.n, unit: 'currency', builtin: true, nv: price,
    help: 'Unit price in USD at the order quantity set in the toolbar.',
  };
  const cols = [cls, stock, priceCol];
  if (recipeFor(cat.id)) {
    const ev = new Int32Array(cat.n).fill(1);
    if (ds) {
      for (const [lcsc, rec] of ds) {
        // a record that only fills a catalogue blank does not make formula results exact
        if (!Object.keys(rec.curves ?? {}).length && !Object.keys(rec.scalars ?? {}).length) continue;
        const r = cat.rowOf.get(lcsc);
        if (r !== undefined) ev[r] = 0;
      }
    }
    cols.push({
      id: '$ds', name: 'Datasheet data', kind: 'enum', n: cat.n, builtin: true,
      dict: ['Read from datasheet', 'Catalogue only'], ev,
      help: 'Parts whose datasheet graphs have been digitised give exact formula results; the rest use a generic model (≈).',
    });
  }
  return cols;
}

/**
 * Fill catalogue blanks with values that datasheet records carry in `params`.
 * Only blanks are filled: a catalogue value is never overwritten. Columns that
 * receive a value are cloned, so the cached category stays untouched.
 */
export function applyParams(cat: Category, ds: DsMap): Column[] {
  let out: Column[] | null = null;
  const cloned = new Map<string, Column>();
  const editable = (col: Column, i: number): Column => {
    let c = cloned.get(col.id);
    if (!c) {
      c = { ...col, filled: new Uint8Array(cat.n) };
      if (col.nv) c.nv = Float64Array.from(col.nv);
      if (col.ev) { c.ev = Int32Array.from(col.ev); c.dict = [...col.dict!]; }
      if (col.lo) { c.lo = Float64Array.from(col.lo); c.hi = Float64Array.from(col.hi!); }
      cloned.set(col.id, c);
      out ??= [...cat.attrs];
      out[i] = c;
    }
    return c;
  };
  const index = new Map(cat.attrs.map((c, i) => [c.id, i]));
  for (const [lcsc, rec] of ds) {
    if (!rec.params) continue;
    const r = cat.rowOf.get(lcsc);
    if (r === undefined) continue;
    for (const [id, v] of Object.entries(rec.params)) {
      const i = index.get(id);
      if (i === undefined) continue;
      const col = cat.attrs[i];
      if (col.kind === 'num' && typeof v === 'number' && Number.isNaN(col.nv![r])) {
        const c = editable(col, i); c.nv![r] = col.pm ? Math.abs(v) : v; c.filled![r] = 1; c.n++;
      } else if (col.kind === 'range' && Number.isNaN(col.lo![r]) && Number.isNaN(col.hi![r])) {
        const [lo, hi] = Array.isArray(v) ? v : typeof v === 'number' ? [v, v] : [NaN, NaN];
        if (Number.isNaN(lo)) continue;
        const c = editable(col, i); c.lo![r] = lo; c.hi![r] = hi; c.filled![r] = 1; c.n++;
      } else if (col.kind === 'enum' && typeof v === 'string' && col.ev![r] < 0) {
        const c = editable(col, i);
        let k = c.dict!.findIndex((d) => d.toLowerCase() === v.trim().toLowerCase());
        if (k < 0) { c.dict!.push(v.trim()); k = c.dict!.length - 1; }
        c.ev![r] = k; c.filled![r] = 1; c.n++;
      }
    }
  }
  return out ?? cat.attrs;
}

/** A short formula name for a parameter: "Drain-Source Voltage (Vdss)" -> Vdss, "Rds(on)" -> Rds_on. */
export function aliasOf(name: string): string {
  // "Long Name (Sym)" -> Sym. The space matters: "Rds(on)" is itself the symbol.
  const paren = /\s\(([A-Za-z][A-Za-z0-9()]*)\)\s*$/.exec(name);
  let base = name;
  if (paren && paren[1].length <= 12) base = paren[1];
  let a = base.replace(/[()]/g, '_').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');
  if (!a) a = 'param';
  if (/^[0-9]/.test(a)) a = `p_${a}`;
  return a;
}

export interface VarInfo {
  alias: string;
  col: Column;
  /** 'value' for scalars; 'min' / 'max' for the two ends of a range */
  part: 'value' | 'min' | 'max';
}

export function variablesFor(cols: Column[]): VarInfo[] {
  const out: VarInfo[] = [];
  const used = new Set<string>();
  const add = (alias: string, col: Column, part: VarInfo['part']) => {
    let a = alias, k = 2;
    while (used.has(a.toLowerCase())) a = `${alias}_${k++}`;
    used.add(a.toLowerCase());
    out.push({ alias: a, col, part });
  };
  for (const col of cols) {
    if (col.computed) continue;
    const base = col.id === '$stock' ? 'Stock' : col.id === '$price' ? 'Price' : col.id === '$class' ? 'Class' : aliasOf(col.name);
    if (col.kind === 'range') { add(`${base}_min`, col, 'min'); add(`${base}_max`, col, 'max'); }
    else add(base, col, 'value');
  }
  return out;
}

function accessor(v: VarInfo): (ctx: EvalCtx) => Val {
  const c = v.col;
  if (c.kind === 'num') { const nv = c.nv!; return (ctx) => nv[ctx.row]; }
  if (c.kind === 'range') { const a = v.part === 'min' ? c.lo! : c.hi!; return (ctx) => a[ctx.row]; }
  if (c.kind === 'enum') { const ev = c.ev!, d = c.dict!; return (ctx) => (ev[ctx.row] < 0 ? '' : d[ev[ctx.row]]); }
  const mv = c.mv!, d = c.dict!;
  return (ctx) => { const x = mv[ctx.row]; return x ? x.map((i) => d[i]).join(', ') : ''; };
}

export interface FormulaSetup {
  env: Env;
  vars: VarInfo[];
  models: Models;
}

export function formulaSetup(cat: Category, baseCols: Column[], ds: DsMap, attrs: Column[] = cat.attrs): FormulaSetup {
  const vars = variablesFor(baseCols);
  const byAlias = new Map(vars.map((v) => [v.alias.toLowerCase(), v]));
  const byName = new Map<string, VarInfo>();
  for (const v of vars) {
    const n = v.col.name.toLowerCase();
    if (v.part === 'value') byName.set(n, v);
    else byName.set(`${n}:${v.part}`, v);
  }
  const models = buildModels(cat, attrs, ds);
  const env: Env = {
    variable(name, bracketed) {
      const key = name.toLowerCase();
      const v = (bracketed ? byName.get(key) : undefined) ?? byAlias.get(key) ?? byName.get(key);
      return v ? accessor(v) : null;
    },
    functions: models.fns,
    suggestions: () => vars.map((v) => v.alias),
  };
  return { env, vars, models };
}

export interface ComputedResult {
  columns: Column[];
  sheet: CompiledSheet;
}

/** Evaluate a sheet over the whole category; returns one column per shown definition. */
export function computeColumns(cat: Category, defs: Definition[], setup: FormulaSetup): ComputedResult {
  const sheet = compileSheet(defs, setup.env);
  const n = cat.n, k = defs.length;
  const out = new Float64Array(k);
  const flags = { est: new Uint8Array(k), notes: new Array<string | null>(k).fill(null) };
  const cols: (Column | null)[] = defs.map((d, i) =>
    sheet.errors[i] || !d.show
      ? null
      : {
          id: `$f:${d.id}`, name: d.name, kind: 'num' as const, n: 0, unit: d.unit || undefined, computed: true,
          nv: new Float64Array(n).fill(NaN), est: new Uint8Array(n), note: {}, help: d.expr,
        },
  );
  if (cols.some(Boolean)) {
    for (let r = 0; r < n; r++) {
      sheet.evalRow(r, out, flags);
      for (let i = 0; i < k; i++) {
        const c = cols[i];
        if (!c) continue;
        const v = out[i];
        c.nv![r] = v;
        if (!Number.isNaN(v)) { c.n++; if (flags.est[i]) c.est![r] = 1; }
        else if (flags.notes[i]) c.note![r] = flags.notes[i]!;
      }
    }
  }
  return { columns: cols.filter((c): c is Column => !!c), sheet };
}
