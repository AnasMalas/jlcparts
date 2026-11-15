#!/usr/bin/env node
// Builds the static database used by the web app.
//
//   upstream shards (yaqwsx/jlcparts)  ->  merged categories + typed, de-duplicated
//   parameter columns  ->  web/public/data/{index.json, search.json.gz, c/<id>.json.gz}
//
// Usage: node pipeline/build.mjs [--out web/public/data] [--cache .cache/upstream]
//                                [--source URL] [--offline] [--only <substring>]

import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchUpstream, DEFAULT_SOURCE } from './fetch.mjs';
import { buildTaxonomy } from './taxonomy.mjs';
import {
  GLOBAL_ALIASES, SCOPED_ALIASES, KEY_PARAMS, ENRICHERS, POINT_PARAMS, isNullish, translate,
} from './attributes.mjs';
import { formatValue, formatRange, UNITS } from '../shared/units.js';
import { RECIPES, validateRecord } from '../shared/recipes.js';
import { sanityCheck } from '../shared/extract.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const OUT = path.resolve(ROOT, opt('out', 'web/public/data'));
const CACHE = path.resolve(ROOT, opt('cache', '.cache/upstream'));
const SOURCE = opt('source', DEFAULT_SOURCE);
const OFFLINE = args.includes('--offline');
const ONLY = opt('only', null);

const DS_PREFIX = 'https://jlcpcb.com/api/file/downloadByFileSystemAccessId/';
const TEXT_UNITS = new Set(['identifier', 'string', 'temperature_coefficient_code']);
const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---------------------------------------------------------------------------
// Upstream entry parsing
// ---------------------------------------------------------------------------

function splitKey(key) {
  const tok = key.split(' ');
  let idx = 0, mm = '';
  for (;;) {
    const last = tok[tok.length - 1];
    if (tok.length > 1 && /^\d+$/.test(last)) { idx = +last; tok.pop(); }
    else if (tok.length > 1 && (last === 'min' || last === 'max')) { mm = last; tok.pop(); }
    else if (tok.length > 1 && last === 'rms') tok.pop();
    else break;
  }
  return { base: tok.join(' '), idx, mm };
}

const WORD_NUM = [[/^single/i, 1], [/^dual/i, 2], [/^triple/i, 3], [/^quad/i, 4], [/^hex/i, 6], [/^octal/i, 8]];
function numberFromText(s) {
  for (const [re, n] of WORD_NUM) if (re.test(s)) return n;
  const m = /^[+-]?(\d+\.?\d*|\.\d+)/.exec(s);
  return m ? parseFloat(m[0]) : null;
}

/**
 * Turn one upstream attribute value into a neutral shape:
 *   { shape: 'enum', texts: [...] }
 *   { shape: 'num',  unit, vals: [{idx, val}], conds: [...] }
 *   { shape: 'range', unit, lo, hi, conds: [...] }
 *   { shape: 'empty' }
 */
function parseEntry(entry) {
  const fields = [];
  for (const [key, pair] of Object.entries(entry.values ?? {})) {
    const [val, unit] = pair;
    const k = splitKey(key);
    const text = TEXT_UNITS.has(unit) || typeof val === 'string';
    fields.push({ key, ...k, val, unit, text });
  }
  const numeric = fields.filter((f) => !f.text && typeof f.val === 'number' && Number.isFinite(f.val));
  const texts = fields
    .filter((f) => f.text && f.val !== 'NaN' && !isNullish(f.val))
    .map((f) => translate(String(f.val).trim()));

  if (numeric.length === 0) {
    return texts.length ? { shape: 'enum', texts } : { shape: 'empty' };
  }

  // Which field is the headline value? Trust `primary`, then the format order.
  let primary = numeric.find((f) => f.key === entry.primary);
  if (!primary && entry.primary) {
    const pb = splitKey(entry.primary).base;
    primary = numeric.find((f) => f.base === pb);
  }
  if (!primary && typeof entry.format === 'string') {
    for (const m of entry.format.matchAll(/\$\{([^}]+)\}/g)) {
      primary = numeric.find((f) => f.key === m[1]);
      if (primary) break;
    }
  }
  primary ??= numeric[0];

  const mine = numeric.filter((f) => f.base === primary.base && f.unit === primary.unit);
  const conds = numeric
    .filter((f) => !mine.includes(f))
    .map((f) => ({ idx: f.idx, base: f.base, val: f.val, unit: f.unit }));
  const unit = primary.unit;

  if (mine.some((f) => f.mm)) {
    const los = mine.filter((f) => f.mm === 'min').map((f) => f.val);
    const his = mine.filter((f) => f.mm === 'max').map((f) => f.val);
    const plain = mine.filter((f) => !f.mm).map((f) => f.val);
    let lo = los.length ? Math.min(...los) : null;
    let hi = his.length ? Math.max(...his) : null;
    if (lo === null && plain.length) lo = Math.min(...plain);
    if (hi === null && plain.length) hi = Math.max(...plain);
    if (lo !== null && hi !== null && lo > hi) [lo, hi] = [hi, lo];
    return { shape: 'range', unit, lo, hi, conds, texts, base: primary.base };
  }
  const vals = mine.sort((a, b) => a.idx - b.idx).map((f) => ({ idx: f.idx, val: f.val }));
  return { shape: 'num', unit, vals, conds, texts, base: primary.base };
}

const fmtCond = (c) => formatValue(c.val, c.unit);

/** Human text for a numeric entry that has several values and/or test conditions. */
function numText(p) {
  const used = new Set();
  const parts = p.vals.map((v) => {
    const cs = p.conds.filter((c) => c.idx === v.idx && (v.idx !== 0 || p.vals.length === 1));
    cs.forEach((c) => used.add(c));
    return formatValue(v.val, p.unit) + (cs.length ? ` @ ${cs.map(fmtCond).join(', ')}` : '');
  });
  const rest = p.conds.filter((c) => !used.has(c));
  return parts.join('; ') + (rest.length ? ` @ ${rest.map(fmtCond).join(', ')}` : '');
}

// ---------------------------------------------------------------------------
// Column building
// ---------------------------------------------------------------------------

function majority(counter) {
  let best = null, bestN = -1;
  for (const [k, n] of counter) if (n > bestN) { best = k; bestN = n; }
  return best;
}

/** Case-insensitive de-duplication of enum spellings; returns Map(lowerKey -> canonical spelling). */
function canonicalSpellings(counter) {
  const groups = new Map();
  for (const [text, n] of counter) {
    const k = text.toLowerCase().replace(/\s+/g, ' ');
    const g = groups.get(k);
    if (!g || n > g.n) groups.set(k, { text, n });
  }
  return new Map([...groups.entries()].map(([k, g]) => [k, g.text]));
}

const LISTY = /feature|function|protection|interface|application|topology|protocol|standard|output type|mounting/i;
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

function buildColumn(name, cells, nRows, pointSpec) {
  // cells: Array(nRows) of parsed entry | undefined
  let nEnum = 0, nNum = 0, nRange = 0, present = 0;
  const units = new Map();
  const countBases = new Set();
  for (const c of cells) {
    if (!c || c.shape === 'empty') continue;
    present++;
    if (c.shape === 'enum') nEnum++;
    else {
      if (c.shape === 'range') nRange++; else nNum++;
      units.set(c.unit, (units.get(c.unit) ?? 0) + 1);
      if (c.unit === 'count') countBases.add(c.base);
    }
  }
  if (!present) return null;
  const col = { id: slug(name), name, n: present };
  // "1 independent diode" vs "1 diode pair": the field name carries the meaning,
  // so a bare number would be misleading. Show these as labelled options.
  const labelledCounts = countBases.size > 1 && majority(units) === 'count';
  const splitList = LISTY.test(name) && name !== 'Package' && name !== 'Manufacturer';

  // ---- enumerations ------------------------------------------------------
  if (nEnum >= nNum + nRange || labelledCounts) {
    const counter = new Map();
    const perRow = new Array(nRows);
    let multi = false;
    for (let r = 0; r < nRows; r++) {
      const c = cells[r];
      if (!c || c.shape === 'empty') continue;
      let texts;
      if (c.shape === 'enum') texts = splitList ? c.texts.flatMap((t) => t.split(/\s*(?:, |、|;)\s*/)) : c.texts;
      else if (c.shape === 'range') texts = [formatRange(c.lo, c.hi, c.unit)];
      else if (labelledCounts) texts = c.vals.map((v) => `${v.val} × ${titleCase(c.base)}`);
      else texts = [numText(c)];
      texts = [...new Set(texts.filter((t) => t && !isNullish(t)))];
      if (!texts.length) continue;
      if (texts.length > 1) multi = true;
      perRow[r] = texts;
      for (const t of texts) counter.set(t, (counter.get(t) ?? 0) + 1);
    }
    const canon = canonicalSpellings(counter);
    const dictIdx = new Map();
    const dictCount = new Map();
    for (const [text, n] of counter) {
      const c = canon.get(text.toLowerCase().replace(/\s+/g, ' '));
      dictCount.set(c, (dictCount.get(c) ?? 0) + n);
    }
    const dict = [...dictCount.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([t]) => t);
    dict.forEach((t, i) => dictIdx.set(t, i));
    const lookup = (t) => dictIdx.get(canon.get(t.toLowerCase().replace(/\s+/g, ' ')));
    col.dict = dict;
    let filled = 0;
    if (multi) {
      col.kind = 'multi';
      col.v = perRow.map((ts) => (ts ? [...new Set(ts.map(lookup))].sort((a, b) => a - b) : 0));
      for (let r = 0; r < nRows; r++) if (!col.v[r]) col.v[r] = 0; else filled++;
    } else {
      col.kind = 'enum';
      col.v = new Array(nRows).fill(-1);
      for (let r = 0; r < nRows; r++) if (perRow[r]) { col.v[r] = lookup(perRow[r][0]); filled++; }
    }
    col.n = filled;
    return filled ? col : null;
  }

  // ---- numeric -----------------------------------------------------------
  col.unit = majority(units);
  const coerceText = (c) => {
    // an enum cell inside a numeric column: "Single-channel", "0.5LSB"
    const x = numberFromText(c.texts[0]);
    return x === null ? null : x;
  };

  if (nRange >= 0.15 * (nNum + nRange)) {
    // Is it really a ± tolerance? Then a single magnitude filters better than a range.
    let sym = 0, both = 0;
    for (const c of cells) if (c?.shape === 'range' && c.lo !== null && c.hi !== null) { both++; if (c.lo === -c.hi) sym++; }
    if (both && sym / both >= 0.85 && nRange >= 0.5 * (nNum + nRange)) {
      col.kind = 'num';
      col.pm = 1;
      col.v = new Array(nRows).fill(null);
      const t = {};
      let filled = 0;
      for (let r = 0; r < nRows; r++) {
        const c = cells[r];
        if (!c || c.shape === 'empty') continue;
        let x = null;
        if (c.shape === 'range') {
          x = Math.max(Math.abs(c.lo ?? 0), Math.abs(c.hi ?? 0));
          if (c.lo !== -c.hi) t[r] = formatRange(c.lo, c.hi, c.unit);
        } else if (c.shape === 'num') x = Math.abs(c.vals[0].val);
        else x = coerceText(c);
        if (x !== null) { col.v[r] = x; filled++; }
      }
      if (Object.keys(t).length) col.t = t;
      col.n = filled;
      return filled ? col : null;
    }
    col.kind = 'range';
    col.lo = new Array(nRows).fill(null);
    col.hi = new Array(nRows).fill(null);
    let filled = 0;
    for (let r = 0; r < nRows; r++) {
      const c = cells[r];
      if (!c || c.shape === 'empty') continue;
      if (c.shape === 'range') { col.lo[r] = c.lo; col.hi[r] = c.hi; }
      else if (c.shape === 'num') {
        const xs = c.vals.map((v) => v.val);
        col.lo[r] = Math.min(...xs); col.hi[r] = Math.max(...xs);
      } else { const x = coerceText(c); col.lo[r] = x; col.hi[r] = x; }
      if (col.lo[r] !== null || col.hi[r] !== null) filled++;
    }
    col.n = filled;
    return filled ? col : null;
  }

  col.kind = 'num';
  col.v = new Array(nRows).fill(null);
  const t = {}, alt = {}, pts = pointSpec ? new Array(nRows).fill(0) : null;
  let filled = 0;
  for (let r = 0; r < nRows; r++) {
    const c = cells[r];
    if (!c || c.shape === 'empty') continue;
    if (c.shape === 'enum') {
      const x = coerceText(c);
      if (x !== null) { col.v[r] = x; filled++; }
      continue;
    }
    if (c.shape === 'range') {
      // a range inside a mostly-scalar column: keep the upper bound, show the range
      const x = c.hi ?? c.lo;
      col.v[r] = x; filled++;
      if (c.lo !== null && c.hi !== null && c.lo !== c.hi) { t[r] = formatRange(c.lo, c.hi, c.unit); alt[r] = [c.lo]; }
      continue;
    }
    const xs = c.vals.map((v) => v.val);
    const head = pointSpec?.pick === 'min' ? Math.min(...xs) : xs[0];
    col.v[r] = head; filled++;
    const others = [...new Set(xs)].filter((x) => x !== head);
    if (others.length) alt[r] = others;
    if (c.vals.length > 1 || c.conds.length) t[r] = numText(c);
    if (pts) {
      pts[r] = c.vals.map((v) => {
        const cond = c.conds.find((k) => k.base === pointSpec.x && (k.idx === v.idx || c.vals.length === 1));
        return [cond ? cond.val : null, v.val];
      });
    }
  }
  // Booleans arrive as 0/1 counts.
  const distinct = new Set(col.v.filter((x) => x !== null));
  if (col.unit === 'count' && [...distinct].every((x) => x === 0 || x === 1) && (distinct.has(0) || !/^number|^no\.|count/i.test(name))) {
    const b = { id: col.id, name, kind: 'enum', dict: ['Yes', 'No'], v: col.v.map((x) => (x === null ? -1 : x ? 0 : 1)), n: filled };
    return filled ? b : null;
  }
  if (Object.keys(t).length) col.t = t;
  if (Object.keys(alt).length) col.alt = alt;
  if (pts) col.pts = pts;
  col.n = filled;
  return filled ? col : null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function simplifyPrice(list) {
  const out = [];
  let last = null;
  for (const b of list ?? []) {
    if (typeof b?.price !== 'number') continue;
    if (last !== null && b.price === last) continue;
    out.push(b.qFrom ?? 1, b.price);
    last = b.price;
  }
  return out;
}

async function main() {
  const t0 = Date.now();
  let manifest;
  if (OFFLINE) manifest = JSON.parse(await readFile(path.join(CACHE, 'manifest.json'), 'utf8'));
  else manifest = await fetchUpstream({ source: SOURCE, cacheDir: CACHE });

  const lut = JSON.parse(gunzipSync(await readFile(path.join(CACHE, manifest.attributesLut))).toString('utf8'));
  const parsed = new Array(lut.length);
  const parseLut = (i) => (parsed[i] ??= parseEntry(lut[i][1]));
  console.log(`Upstream: ${manifest.totalComponents} parts, ${manifest.categories.length} categories, ${lut.length} attribute values`);

  // ---- 1. place every upstream category into the merged taxonomy ----------
  const tax = buildTaxonomy();
  const merged = new Map(); // id -> { id, group, name, sources: [], rows: [] }
  const unmapped = [];
  for (const c of manifest.categories) {
    const p = tax.resolve(c.category, c.subcategory);
    if (!p.curated) unmapped.push(`${c.category}/${c.subcategory} (${c.componentCount})`);
    let m = merged.get(p.id);
    if (!m) merged.set(p.id, (m = { id: p.id, group: p.group, name: p.name, sources: [], rows: [] }));
    m.sources.push({ cat: c.category, sub: c.subcategory, shards: c.shards, tags: p.tags, n: c.componentCount });
  }
  if (unmapped.length) {
    console.log(`NOTE: ${unmapped.length} upstream categories are not in pipeline/taxonomy.mjs (auto-placed):`);
    for (const u of unmapped) console.log(`   ${u}`);
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, 'c'), { recursive: true });

  const indexGroups = new Map();
  const search = { cats: [], lcsc: [], mfr: [] };
  let total = 0;
  const seenLcsc = new Set();

  for (const cat of merged.values()) {
    const fullName = `${cat.group} / ${cat.name}`;
    if (ONLY && !fullName.toLowerCase().includes(ONLY.toLowerCase())) continue;
    const aliasG = SCOPED_ALIASES[cat.group] ?? {};
    const aliasC = SCOPED_ALIASES[fullName] ?? {};
    const canonName = (n) => {
      n = aliasC[n] ?? aliasG[n] ?? n;
      return GLOBAL_ALIASES[n] ?? n;
    };
    const enrich = ENRICHERS[fullName];
    const srcKey = (s) => s.sub.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '').replace(/s$/, '');
    const multiSource = new Set(cat.sources.filter((s) => !s.tags).map(srcKey)).size > 1;
    const defaults = tax.defaults(cat.id);

    // ---- 2. read rows ------------------------------------------------------
    const rows = [];
    for (const src of cat.sources) {
      for (const shard of src.shards) {
        const text = gunzipSync(await readFile(path.join(CACHE, shard))).toString('utf8');
        const lines = text.split('\n');
        const schema = JSON.parse(lines[0]);
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i]) continue;
          const r = JSON.parse(lines[i]);
          const lcsc = r[schema.lcsc];
          if (seenLcsc.has(lcsc)) continue; // a part listed under two upstream categories
          seenLcsc.add(lcsc);
          const attrs = new Map();
          for (const a of r[schema.attributes] ?? []) {
            const name = canonName(lut[a][0]);
            if (!attrs.has(name)) attrs.set(name, a);
          }
          const tag = (k, v) => attrs.set(k, { primary: k, values: { [k]: [v, 'identifier'] } });
          if (src.tags) for (const [k, v] of Object.entries(src.tags)) tag(k, v);
          if (defaults) for (const [k, v] of Object.entries(defaults)) if (!src.tags || !(k in src.tags)) tag(k, v);
          if (multiSource) attrs.set('Original Category', { primary: 'c', values: { c: [src.sub, 'identifier'] } });
          if (enrich) {
            // enrichers see raw upstream entries, not LUT indices
            const view = new Map([...attrs].map(([k, v]) => [k, typeof v === 'number' ? lut[v][1] : v]));
            const before = new Map(view);
            enrich(view);
            for (const k of [...attrs.keys()]) if (!view.has(k)) attrs.delete(k);
            for (const [k, v] of view) if (before.get(k) !== v) attrs.set(k, v);
          }
          rows.push({
            lcsc: parseInt(String(lcsc).replace(/^C/i, ''), 10),
            mfr: r[schema.mfr] ?? '',
            desc: r[schema.description] ?? '',
            ds: r[schema.datasheet] ?? '',
            price: simplifyPrice(r[schema.price]),
            img: r[schema.img] ?? null,
            url: r[schema.url] ?? null,
            stock: r[schema.stock] ?? 0,
            joints: r[schema.joints] ?? null,
            attrs,
          });
        }
      }
    }
    if (!rows.length) continue;
    rows.sort((a, b) => b.stock - a.stock || a.lcsc - b.lcsc);
    const n = rows.length;

    // ---- 3. merge names that differ only in punctuation / case --------------
    const nameCount = new Map();
    for (const row of rows) for (const k of row.attrs.keys()) nameCount.set(k, (nameCount.get(k) ?? 0) + 1);
    const byKey = new Map();
    for (const [name, c] of nameCount) {
      const k = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const g = byKey.get(k);
      if (!g || c > g.c) byKey.set(k, { name, c });
    }
    const finalName = (name) => byKey.get(name.toLowerCase().replace(/[^a-z0-9]/g, '')).name;

    // ---- 4. build one column per parameter ---------------------------------
    const cellsByName = new Map();
    rows.forEach((row, r) => {
      for (const [rawName, a] of row.attrs) {
        const name = finalName(rawName);
        let cells = cellsByName.get(name);
        if (!cells) cellsByName.set(name, (cells = new Array(n)));
        if (cells[r] === undefined) cells[r] = typeof a === 'number' ? parseLut(a) : parseEntry(a);
      }
    });

    const pointSpecs = POINT_PARAMS[fullName] ?? {};
    let cls = null;
    const attrs = [];
    for (const [name, cells] of cellsByName) {
      if (name === 'Library Class') {
        cls = cells.map((c) => {
          const t = c?.texts?.[0]?.toLowerCase() ?? '';
          return t.startsWith('basic') ? 0 : t.startsWith('prefer') ? 1 : 2;
        });
        continue;
      }
      const col = buildColumn(name, cells, n, pointSpecs[name]);
      if (!col) continue;
      // A parameter where every part says the same thing filters nothing.
      if ((col.kind === 'enum' || col.kind === 'multi') && col.dict.length < 2 && col.n > 0.5 * n) continue;
      if (col.n < 2 && n > 50) continue;
      if (col.n < Math.max(3, 0.02 * n) || name === 'Original Category') col.rare = 1;
      attrs.push(col);
    }
    cls ??= new Array(n).fill(2);
    for (let r = 0; r < n; r++) if (cls[r] === undefined) cls[r] = 2;

    // ---- 5. order: Manufacturer, Package, curated key params, then coverage -
    const key = KEY_PARAMS[fullName] ?? [];
    const rank = (c) => {
      if (c.name === 'Manufacturer') return -3;
      if (c.name === 'Package') return -2;
      if (c.name === 'Original Category') return 2;
      const k = key.indexOf(c.name);
      return k >= 0 ? -1 + k / 1000 : 1;
    };
    attrs.sort((a, b) => rank(a) - rank(b) || b.n - a.n || (a.name < b.name ? -1 : 1));
    const ids = new Set();
    for (const c of attrs) { let id = c.id || 'param', k = 2; while (ids.has(id)) id = `${c.id}-${k++}`; c.id = id; ids.add(id); }

    const img = {}, url = {};
    rows.forEach((row, r) => { if (row.img) img[r] = row.img; if (row.url) url[r] = row.url; });
    const file = {
      v: 1,
      id: cat.id,
      name: cat.name,
      group: cat.group,
      n,
      lcsc: rows.map((r) => r.lcsc),
      mfr: rows.map((r) => r.mfr),
      desc: rows.map((r) => r.desc),
      stock: rows.map((r) => r.stock),
      cls,
      joints: rows.map((r) => r.joints),
      ds: rows.map((r) => (r.ds.startsWith(DS_PREFIX) ? `~${r.ds.slice(DS_PREFIX.length)}` : r.ds)),
      price: rows.map((r) => r.price),
      img,
      url,
      attrs,
    };
    const gz = gzipSync(Buffer.from(JSON.stringify(file)), { level: 9 });
    await writeFile(path.join(OUT, 'c', `${cat.id}.json.gz`), gz);

    let g = indexGroups.get(cat.group);
    if (!g) indexGroups.set(cat.group, (g = { name: cat.group, n: 0, cats: [] }));
    g.n += n;
    g.cats.push({
      id: cat.id,
      name: cat.name,
      n,
      bytes: gz.length,
      basic: cls.filter((x) => x === 0).length,
      params: attrs.filter((a) => !a.rare).length,
      src: [...new Set(cat.sources.map((s) => `${s.cat} / ${s.sub}`))],
    });
    search.cats.push([cat.id, n]);
    for (const row of rows) { search.lcsc.push(row.lcsc); search.mfr.push(row.mfr); }
    total += n;
  }

  // ---- 6. index + search ---------------------------------------------------
  const order = tax.groupOrder;
  const groups = [...indexGroups.values()].sort((a, b) => {
    const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
    return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
  });
  for (const g of groups) {
    const co = tax.catOrder(g.name);
    g.cats.sort((a, b) => {
      const ia = co.indexOf(a.name), ib = co.indexOf(b.name);
      return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) || b.n - a.n;
    });
  }
  // ---- 6b. datasheet-derived data (datasheet-data/<recipe>/<LCSC>.json) -----
  const dsCounts = {};
  if (!ONLY) {
    await mkdir(path.join(OUT, 'ds'), { recursive: true });
    for (const [recipeKey, recipe] of Object.entries(RECIPES)) {
      const dir = path.join(ROOT, 'datasheet-data', recipeKey);
      let names = [];
      try { names = (await readdir(dir)).filter((f) => f.endsWith('.json')); } catch { /* no records for this recipe yet */ }
      const parts = {};
      for (const name of names) {
        let rec;
        try { rec = JSON.parse(await readFile(path.join(dir, name), 'utf8')); } catch (e) { console.log(`SKIPPED datasheet-data/${recipeKey}/${name}: not valid JSON (${e.message})`); continue; }
        const problems = [...validateRecord(rec), ...sanityCheck(rec)];
        if (rec.lcsc && `${rec.lcsc}.json` !== name) problems.push('file name does not match the lcsc field');
        if (problems.length) { console.log(`SKIPPED datasheet-data/${recipeKey}/${name}: ${problems.join('; ')}`); continue; }
        parts[rec.lcsc] = rec;
      }
      const n = Object.keys(parts).length;
      if (!n) continue;
      for (const catId of recipe.categories) {
        await writeFile(path.join(OUT, 'ds', `${catId}.json`), JSON.stringify({ v: 1, recipe: recipeKey, parts }));
        dsCounts[catId] = n;
      }
      console.log(`Datasheet data: ${n} ${recipeKey} record(s)`);
    }
  }

  const searchGz = gzipSync(Buffer.from(JSON.stringify(search)), { level: 9 });
  await writeFile(path.join(OUT, 'search.json.gz'), searchGz);
  const index = {
    v: 1,
    built: new Date().toISOString(),
    source: { url: SOURCE, created: manifest.created, upstreamCategories: manifest.categories.length },
    total,
    searchBytes: searchGz.length,
    ds: dsCounts,
    groups,
    units: Object.keys(UNITS),
  };
  await writeFile(path.join(OUT, 'index.json'), JSON.stringify(index));

  const files = await readdir(path.join(OUT, 'c'));
  console.log(
    `Built ${total} parts into ${files.length} categories (${groups.length} groups) from ${manifest.categories.length} upstream categories in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  const unused = tax.unused();
  if (unused.length && !ONLY) console.log(`NOTE: ${unused.length} taxonomy sources no longer exist upstream:\n   ${unused.join('\n   ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
