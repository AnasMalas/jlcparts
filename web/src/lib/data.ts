// Loading and in-memory representation of the parts database.

export interface IndexCat {
  id: string;
  name: string;
  n: number;
  bytes: number;
  basic: number;
  params: number;
  src: string[];
}
export interface IndexGroup {
  name: string;
  n: number;
  cats: IndexCat[];
}
export interface DataIndex {
  v: number;
  built: string;
  source: { url: string; created: string; upstreamCategories: number };
  total: number;
  searchBytes: number;
  /** category id -> number of parts with shared datasheet-derived data */
  ds?: Record<string, number>;
  groups: IndexGroup[];
}

export type ColKind = 'enum' | 'multi' | 'num' | 'range';

/** One filterable / displayable column of a category. */
export interface Column {
  id: string;
  name: string;
  kind: ColKind;
  /** number of parts that have a value */
  n: number;
  unit?: string;
  rare?: boolean;
  /** value is a ± magnitude (tolerances) */
  pm?: boolean;
  /** enum / multi */
  dict?: string[];
  ev?: Int32Array;
  mv?: (number[] | 0)[];
  /** num */
  nv?: Float64Array;
  alt?: Record<number, number[]>;
  t?: Record<number, string>;
  /** raw (condition, value) points, e.g. Rds(on) at each Vgs */
  pts?: ([number | null, number][] | 0)[];
  /** range */
  lo?: Float64Array;
  hi?: Float64Array;
  /** not from the catalogue: stock, price, library class ... */
  builtin?: boolean;
  /** user formula column */
  computed?: boolean;
  /** computed columns: 1 where the value rests on a generic model rather than data */
  est?: Uint8Array;
  /** computed columns: per-row note (why there is no value) */
  note?: Record<number, string>;
  /** short explanation shown in the UI */
  help?: string;
}

export interface Category {
  id: string;
  name: string;
  group: string;
  n: number;
  lcsc: Int32Array;
  mfr: string[];
  desc: string[];
  stock: Int32Array;
  cls: Uint8Array;
  joints: Int32Array;
  ds: string[];
  price: number[][];
  img: Record<number, string>;
  url: Record<number, string>;
  /** catalogue parameters */
  attrs: Column[];
  /** lower-cased text used by the free-text filter (built lazily) */
  hay?: string[];
  /** row index by LCSC number */
  rowOf: Map<number, number>;
}

const BASE = `${import.meta.env.BASE_URL}data/`;

async function fetchMaybeGzip(url: string): Promise<unknown> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${url}: ${resp.status} ${resp.statusText}`);
  const buf = new Uint8Array(await resp.arrayBuffer());
  // Some hosts transparently decompress .gz files; only gunzip when it still is gzip.
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).json();
  }
  return JSON.parse(new TextDecoder().decode(buf));
}

let indexPromise: Promise<DataIndex> | null = null;
export function loadIndex(): Promise<DataIndex> {
  indexPromise ??= fetch(`${BASE}index.json`, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(`Could not load the parts index (${r.status})`);
    return r.json();
  });
  return indexPromise;
}

const f64 = (a: (number | null)[]) => {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] === null ? NaN : (a[i] as number);
  return out;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function hydrate(raw: any): Category {
  const attrs: Column[] = raw.attrs.map((a: any): Column => {
    const col: Column = { id: a.id, name: a.name, kind: a.kind, n: a.n, unit: a.unit, rare: !!a.rare, pm: !!a.pm };
    if (a.kind === 'enum') { col.dict = a.dict; col.ev = Int32Array.from(a.v); }
    else if (a.kind === 'multi') { col.dict = a.dict; col.mv = a.v; }
    else if (a.kind === 'num') { col.nv = f64(a.v); col.alt = a.alt; col.t = a.t; col.pts = a.pts; }
    else { col.lo = f64(a.lo); col.hi = f64(a.hi); }
    return col;
  });
  const lcsc = Int32Array.from(raw.lcsc);
  const rowOf = new Map<number, number>();
  for (let i = 0; i < lcsc.length; i++) rowOf.set(lcsc[i], i);
  return {
    id: raw.id,
    name: raw.name,
    group: raw.group,
    n: raw.n,
    lcsc,
    mfr: raw.mfr,
    desc: raw.desc,
    stock: Int32Array.from(raw.stock),
    cls: Uint8Array.from(raw.cls),
    joints: Int32Array.from(raw.joints.map((x: number | null) => x ?? -1)),
    ds: raw.ds,
    price: raw.price,
    img: raw.img ?? {},
    url: raw.url ?? {},
    attrs,
    rowOf,
  };
}

const catCache = new Map<string, Promise<Category>>();
export function loadCategory(id: string): Promise<Category> {
  let p = catCache.get(id);
  if (!p) {
    p = fetchMaybeGzip(`${BASE}c/${id}.json.gz`).then(hydrate);
    p.catch(() => catCache.delete(id));
    catCache.set(id, p);
  }
  return p;
}

export interface SearchIndex {
  /** [categoryId, count] in file order */
  cats: [string, number][];
  lcsc: number[];
  mfr: string[];
  mfrLower: string[];
  /** start row of each category */
  starts: number[];
}
let searchPromise: Promise<SearchIndex> | null = null;
export function loadSearch(): Promise<SearchIndex> {
  searchPromise ??= fetchMaybeGzip(`${BASE}search.json.gz`).then((raw: any) => {
    const starts: number[] = [];
    let s = 0;
    for (const [, n] of raw.cats) { starts.push(s); s += n; }
    return { cats: raw.cats, lcsc: raw.lcsc, mfr: raw.mfr, mfrLower: raw.mfr.map((m: string) => m.toLowerCase()), starts };
  });
  searchPromise.catch(() => { searchPromise = null; });
  return searchPromise;
}

export interface SearchHit { cat: string; lcsc: number; mfr: string }
export interface SearchResult { hits: SearchHit[]; perCat: Map<string, number>; total: number }

export function searchParts(idx: SearchIndex, query: string, limit = 60): SearchResult {
  const q = query.trim().toLowerCase();
  const perCat = new Map<string, number>();
  const hits: SearchHit[] = [];
  let total = 0;
  if (q.length < 2) return { hits, perCat, total };
  const lcscNum = /^c?\d+$/.test(q) ? q.replace(/^c/, '') : null;
  const exact: SearchHit[] = [];
  for (let c = 0; c < idx.cats.length; c++) {
    const [cat, n] = idx.cats[c];
    const start = idx.starts[c];
    let count = 0;
    for (let i = start; i < start + n; i++) {
      let ok = idx.mfrLower[i].includes(q);
      if (!ok && lcscNum) ok = String(idx.lcsc[i]).startsWith(lcscNum);
      if (!ok) continue;
      count++;
      const hit = { cat, lcsc: idx.lcsc[i], mfr: idx.mfr[i] };
      if (idx.mfrLower[i] === q || (lcscNum && String(idx.lcsc[i]) === lcscNum)) exact.push(hit);
      else if (hits.length < limit) hits.push(hit);
    }
    if (count) { perCat.set(cat, count); total += count; }
  }
  return { hits: [...exact, ...hits].slice(0, limit), perCat, total };
}

/** Expand the compact datasheet reference stored in the data files. */
export function datasheetUrl(ds: string): string | null {
  if (!ds) return null;
  if (ds.startsWith('~')) return `https://jlcpcb.com/api/file/downloadByFileSystemAccessId/${ds.slice(1)}`;
  return /^https?:\/\//.test(ds) ? ds : null;
}
export const lcscUrl = (lcsc: number) => `https://www.lcsc.com/product-detail/C${lcsc}.html`;
export const jlcUrl = (lcsc: number) => `https://jlcpcb.com/partdetail/C${lcsc}`;
export const imageUrl = (img: string, size: 'small' | 'big' = 'big') =>
  `https://assets.lcsc.com/images/lcsc/${size === 'small' ? '96x96' : '900x900'}/${img}`;

/** Unit price at an order quantity, from the flat [qty, price, qty, price, ...] list. */
export function priceAt(breaks: number[], qty: number): number {
  if (!breaks.length) return NaN;
  let p = breaks[1];
  for (let i = 0; i < breaks.length; i += 2) {
    if (breaks[i] <= qty) p = breaks[i + 1];
    else break;
  }
  return p;
}

export const CLASS_NAMES = ['Basic', 'Preferred', 'Extended'];
