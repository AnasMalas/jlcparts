// The faceted-search engine.
//
// Every filter is evaluated against every row once. For each row we remember
// how many filters it fails and (when it fails exactly one) which one. A facet
// then counts the rows that pass all *other* filters: that is what makes the
// option lists shrink to "what is still available" while still letting you add
// a second value inside a filter you have already used.

import type { Category, Column } from './data';

export type FilterState =
  | { kind: 'set'; sel: number[]; all?: boolean }
  | { kind: 'num'; min?: number; max?: number; minText?: string; maxText?: string; vals?: number[] }
  | { kind: 'range'; lo?: number; hi?: number; loText?: string; hiText?: string };

export type Filters = Record<string, FilterState>;

export interface EnumFacet { kind: 'enum'; counts: Int32Array; total: number }
export interface NumFacet {
  kind: 'num';
  min: number;
  max: number;
  count: number;
  /** histogram of available values */
  bins: Int32Array;
  log: boolean;
  /** distinct values with counts, ascending (only when requested) */
  values?: [number, number][];
}
export interface RangeFacet { kind: 'range'; min: number; max: number; count: number }
export type Facet = EnumFacet | NumFacet | RangeFacet;

export interface EngineResult {
  rows: Int32Array;
  facets: Map<string, Facet>;
}

export const HIST_BINS = 28;

export function isActive(f: FilterState | undefined): boolean {
  if (!f) return false;
  if (f.kind === 'set') return f.sel.length > 0;
  if (f.kind === 'num') return f.min !== undefined || f.max !== undefined || (f.vals?.length ?? 0) > 0;
  return f.lo !== undefined || f.hi !== undefined;
}

type Test = (row: number) => boolean;

// Values that were typed as "4.7k" and stored as 4700.000000000001 must still match.
const EPS = 1e-9;
const ge = (x: number, min: number) => x >= min - Math.abs(min) * EPS;
const le = (x: number, max: number) => x <= max + Math.abs(max) * EPS;

function compile(col: Column, f: FilterState): Test | null {
  if (f.kind === 'set') {
    if (!f.sel.length) return null;
    const want = new Uint8Array(col.dict!.length);
    for (const i of f.sel) if (i >= 0 && i < want.length) want[i] = 1;
    if (col.kind === 'enum') {
      const ev = col.ev!;
      return (r) => ev[r] >= 0 && want[ev[r]] === 1;
    }
    const mv = col.mv!;
    if (f.all) {
      const need = f.sel.length;
      return (r) => {
        const v = mv[r];
        if (!v) return false;
        let hit = 0;
        for (let i = 0; i < v.length; i++) if (want[v[i]]) hit++;
        return hit >= need;
      };
    }
    return (r) => {
      const v = mv[r];
      if (!v) return false;
      for (let i = 0; i < v.length; i++) if (want[v[i]]) return true;
      return false;
    };
  }
  if (f.kind === 'num') {
    const { min, max } = f;
    const vals = f.vals?.length ? f.vals : null;
    if (min === undefined && max === undefined && !vals) return null;
    const nv = col.nv!;
    const alt = col.alt;
    const ok = (x: number) => {
      if (Number.isNaN(x)) return false;
      if (min !== undefined && !ge(x, min)) return false;
      if (max !== undefined && !le(x, max)) return false;
      if (vals) {
        let hit = false;
        for (let i = 0; i < vals.length; i++) if (Math.abs(x - vals[i]) <= Math.abs(vals[i]) * EPS) { hit = true; break; }
        if (!hit) return false;
      }
      return true;
    };
    if (!alt) return (r) => ok(nv[r]);
    return (r) => {
      if (ok(nv[r])) return true;
      const a = alt[r];
      if (a) for (let i = 0; i < a.length; i++) if (ok(a[i])) return true;
      return false;
    };
  }
  // range: the part's range must cover what was asked for
  const { lo, hi } = f;
  if (lo === undefined && hi === undefined) return null;
  const L = col.lo!, H = col.hi!;
  return (r) => {
    const a = L[r], b = H[r];
    if (Number.isNaN(a) && Number.isNaN(b)) return false;
    if (lo !== undefined) {
      if (!Number.isNaN(a) && !le(a, lo)) return false;
      if (!Number.isNaN(b) && !ge(b, lo)) return false;
    }
    if (hi !== undefined) {
      if (!Number.isNaN(b) && !ge(b, hi)) return false;
      if (!Number.isNaN(a) && !le(a, hi)) return false;
    }
    return true;
  };
}

export function buildHaystack(cat: Category): string[] {
  if (cat.hay) return cat.hay;
  const mfg = cat.attrs.find((a) => a.id === 'manufacturer');
  const pkg = cat.attrs.find((a) => a.id === 'package');
  const hay = new Array<string>(cat.n);
  for (let r = 0; r < cat.n; r++) {
    let s = `${cat.mfr[r]} c${cat.lcsc[r]} ${cat.desc[r]}`;
    if (mfg?.ev && mfg.ev[r] >= 0) s += ` ${mfg.dict![mfg.ev[r]]}`;
    if (pkg?.ev && pkg.ev[r] >= 0) s += ` ${pkg.dict![pkg.ev[r]]}`;
    hay[r] = s.toLowerCase();
  }
  cat.hay = hay;
  return hay;
}

export interface Extra {
  text?: string;
  /** restrict to these rows (favourites) */
  only?: Set<number> | null;
}

export function run(
  cat: Category,
  columns: Column[],
  filters: Filters,
  extra: Extra,
  facetCols: Column[],
  wantValues: Set<string>,
): EngineResult {
  const n = cat.n;
  const tests: Test[] = [];
  const testCol: string[] = [];
  for (const col of columns) {
    const f = filters[col.id];
    if (!f) continue;
    const t = compile(col, f);
    if (t) { tests.push(t); testCol.push(col.id); }
  }
  const tokens = (extra.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length) {
    const hay = buildHaystack(cat);
    tests.push((r) => {
      const h = hay[r];
      for (let i = 0; i < tokens.length; i++) if (!h.includes(tokens[i])) return false;
      return true;
    });
    testCol.push('\u0000text');
  }
  if (extra.only) {
    const only = extra.only;
    const lcsc = cat.lcsc;
    tests.push((r) => only.has(lcsc[r]));
    testCol.push('\u0000only');
  }

  const fail = new Uint8Array(n);
  const failIdx = new Int16Array(n);
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    for (let r = 0; r < n; r++) {
      if (!t(r)) { fail[r]++; failIdx[r] = i; }
    }
  }
  let m = 0;
  for (let r = 0; r < n; r++) if (fail[r] === 0) m++;
  const rows = new Int32Array(m);
  const onlyBy: number[][] = tests.map(() => []);
  for (let r = 0, k = 0; r < n; r++) {
    if (fail[r] === 0) rows[k++] = r;
    else if (fail[r] === 1) onlyBy[failIdx[r]].push(r);
  }

  const facets = new Map<string, Facet>();
  for (const col of facetCols) {
    const ti = testCol.indexOf(col.id);
    const extraRows = ti >= 0 ? onlyBy[ti] : null;
    const each = (fn: (r: number) => void) => {
      for (let i = 0; i < rows.length; i++) fn(rows[i]);
      if (extraRows) for (let i = 0; i < extraRows.length; i++) fn(extraRows[i]);
    };
    if (col.kind === 'enum') {
      const counts = new Int32Array(col.dict!.length);
      const ev = col.ev!;
      let total = 0;
      each((r) => { const v = ev[r]; if (v >= 0) { counts[v]++; total++; } });
      facets.set(col.id, { kind: 'enum', counts, total });
    } else if (col.kind === 'multi') {
      const counts = new Int32Array(col.dict!.length);
      const mv = col.mv!;
      let total = 0;
      each((r) => { const v = mv[r]; if (v) { total++; for (let i = 0; i < v.length; i++) counts[v[i]]++; } });
      facets.set(col.id, { kind: 'enum', counts, total });
    } else if (col.kind === 'num') {
      const nv = col.nv!;
      const alt = col.alt;
      let min = Infinity, max = -Infinity, count = 0, minPos = Infinity;
      each((r) => {
        const x = nv[r];
        if (Number.isNaN(x)) return;
        count++;
        if (x < min) min = x;
        if (x > max) max = x;
        if (x > 0 && x < minPos) minPos = x;
        const a = alt?.[r];
        if (a) for (let i = 0; i < a.length; i++) { if (a[i] < min) min = a[i]; if (a[i] > max) max = a[i]; }
      });
      const bins = new Int32Array(HIST_BINS);
      const log = min > 0 && max / min > 30;
      if (count && max > min) {
        const a = log ? Math.log(min) : min;
        const span = (log ? Math.log(max) : max) - a;
        each((r) => {
          const x = nv[r];
          if (Number.isNaN(x)) return;
          let b = Math.floor((((log ? Math.log(x) : x) - a) / span) * HIST_BINS);
          if (b >= HIST_BINS) b = HIST_BINS - 1;
          if (b < 0) b = 0;
          bins[b]++;
        });
      } else if (count) bins[0] = count;
      const facet: NumFacet = { kind: 'num', min, max, count, bins, log };
      if (wantValues.has(col.id)) {
        const tally = new Map<number, number>();
        each((r) => {
          const x = nv[r];
          if (!Number.isNaN(x)) tally.set(x, (tally.get(x) ?? 0) + 1);
          const a = alt?.[r];
          if (a) for (let i = 0; i < a.length; i++) tally.set(a[i], (tally.get(a[i]) ?? 0) + 1);
        });
        facet.values = [...tally.entries()].sort((p, q) => p[0] - q[0]);
      }
      facets.set(col.id, facet);
    } else {
      const L = col.lo!, H = col.hi!;
      let min = Infinity, max = -Infinity, count = 0;
      each((r) => {
        const a = L[r], b = H[r];
        if (Number.isNaN(a) && Number.isNaN(b)) return;
        count++;
        if (!Number.isNaN(a) && a < min) min = a;
        if (!Number.isNaN(b) && b > max) max = b;
        if (Number.isNaN(a) && b < min) min = b;
        if (Number.isNaN(b) && a > max) max = a;
      });
      facets.set(col.id, { kind: 'range', min, max, count });
    }
  }
  return { rows, facets };
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function sortRows(cat: Category, rows: Int32Array, col: Column | null, sortId: string, desc: boolean): Int32Array {
  const out = Int32Array.from(rows);
  const dir = desc ? -1 : 1;
  let key: Float64Array | null = null;
  if (sortId === 'mfr') {
    const mfr = cat.mfr;
    return out.sort((a, b) => dir * collator.compare(mfr[a], mfr[b]));
  }
  if (sortId === 'lcsc') key = Float64Array.from(cat.lcsc);
  else if (!col) return out;
  else if (col.kind === 'num') key = col.nv!;
  else if (col.kind === 'range') key = desc ? col.hi! : col.lo!;
  else if (col.kind === 'enum') {
    // rank dictionary entries once, then sort by rank
    const order = col.dict!.map((_, i) => i).sort((a, b) => collator.compare(col.dict![a], col.dict![b]));
    const rank = new Float64Array(col.dict!.length);
    order.forEach((d, i) => { rank[d] = i; });
    const ev = col.ev!;
    key = new Float64Array(cat.n);
    for (let r = 0; r < cat.n; r++) key[r] = ev[r] < 0 ? NaN : rank[ev[r]];
  } else {
    const mv = col.mv!;
    const dict = col.dict!;
    const text = (r: number) => { const v = mv[r]; return v ? v.map((i) => dict[i]).join(', ') : ''; };
    return out.sort((a, b) => {
      const x = text(a), y = text(b);
      if (!x || !y) return x ? -1 : y ? 1 : 0;
      return dir * collator.compare(x, y);
    });
  }
  const k = key!;
  // missing values always sink to the bottom, whatever the direction
  return out.sort((a, b) => {
    const x = k[a], y = k[b];
    const nx = Number.isNaN(x), ny = Number.isNaN(y);
    if (nx || ny) return nx && ny ? 0 : nx ? 1 : -1;
    return dir * (x - y);
  });
}
