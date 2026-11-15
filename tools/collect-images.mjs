#!/usr/bin/env node
// Builds the photo index: which image file LCSC shows for a part.
//
// The upstream database has a photo for only about 1 % of parts, and the file
// name cannot be worked out from the part number, so the only way to learn it
// is to look at the part's public LCSC product page. This tool does that, one
// page at a time, slowly, and records just the file name in image-index/. The
// site then shows the photo straight from LCSC's image server, as the original
// jlcparts always has.
//
//   node tools/collect-images.mjs --category mosfets --top 200
//   node tools/collect-images.mjs C20917 C15127
//
// Options
//   --category <text>   categories whose id contains this text (repeatable via commas)
//   --top <n>           only the n most-stocked parts of each category (default 200)
//   --max <n>           stop after this many requests in one run (default 300)
//   --delay <ms>        pause between requests (default 2000, minimum 1000)
//   --retry-missing     ask again for parts that had no photo last time
//   --dry-run           list what would be fetched
//
// Manners, on purpose: one request at a time, a pause between requests, only
// pages LCSC's robots.txt allows, and the run stops at the first sign that the
// site would rather not (HTTP 403 / 429). Parts already indexed are skipped,
// so runs are resumable and a category is only ever fetched once.
// Read docs/DATA-POLICY.md before running this on a large scale.

import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'web/public/data/c');
const OUT = path.join(ROOT, 'image-index');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const valueFlags = new Set(['category', 'top', 'max', 'delay']);
const codes = args.filter((a, i) => /^C\d+$/i.test(a) && !valueFlags.has((args[i - 1] ?? '').replace(/^--/, ''))).map((a) => parseInt(a.slice(1), 10));
const top = parseInt(opt('top', '200'), 10);
const max = parseInt(opt('max', '300'), 10);
const delay = Math.max(1000, parseInt(opt('delay', '2000'), 10));
const wanted = (opt('category', '') || '').toLowerCase().split(',').filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Read a product page only as far as its <head>, and return the photo file name it advertises ("" if none). */
async function photoOf(code) {
  const ctrl = new AbortController();
  const resp = await fetch(`https://www.lcsc.com/product-detail/C${code}.html`, {
    signal: ctrl.signal,
    headers: { 'User-Agent': 'jlcparts-photo-index/1.0 (one page at a time; honours robots.txt)', Accept: 'text/html' },
  });
  if (resp.status === 403 || resp.status === 429) { ctrl.abort(); throw Object.assign(new Error(`LCSC answered ${resp.status}`), { stop: true }); }
  if (resp.status === 404) { ctrl.abort(); return ''; }
  if (!resp.ok) { ctrl.abort(); throw new Error(`HTTP ${resp.status}`); }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let html = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
      const m = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i.exec(html);
      if (m) {
        const file = m[1].split('/').pop();
        // only accept a photo of this very part
        return new RegExp(`_C${code}_`).test(file) ? file : '';
      }
      if (html.includes('</head>') || html.length > 400_000) break;
    }
  } finally {
    ctrl.abort(); // we have what we need; do not download the rest of the page
  }
  return '';
}

async function main() {
  let files;
  try { files = (await readdir(DATA)).filter((f) => f.endsWith('.json.gz')); } catch { throw new Error('Catalogue not built. Run "npm run data" first.'); }
  if (!wanted.length && !codes.length) { console.error('Give --category <text> or LCSC codes. See the header of this file.'); process.exit(2); }
  await mkdir(OUT, { recursive: true });

  let requests = 0, found = 0, none = 0, stopped = false;
  for (const f of files) {
    const id = f.replace('.json.gz', '');
    if (wanted.length && !wanted.some((w) => id.includes(w)) && !codes.length) continue;
    const cat = JSON.parse(gunzipSync(await readFile(path.join(DATA, f))).toString('utf8'));
    const indexFile = path.join(OUT, `${id}.json`);
    let index = {};
    try { index = JSON.parse(await readFile(indexFile, 'utf8')); } catch { /* new */ }

    const todo = [];
    for (let r = 0; r < cat.n; r++) { // rows are ordered by stock, highest first
      const code = cat.lcsc[r];
      const picked = codes.includes(code);
      if (!picked && (codes.length && !wanted.some((w) => id.includes(w)))) continue;
      if (!picked && r >= top) break;
      if (cat.img[r]) continue; // the catalogue already has one
      const known = index[`C${code}`];
      if (known || (known === '' && !flag('retry-missing'))) continue;
      todo.push(code);
    }
    if (!todo.length) continue;
    console.log(`${cat.name}: ${todo.length} part(s) without a photo`);
    if (flag('dry-run')) continue;

    let dirty = false;
    const save = async () => {
      if (!dirty) return;
      const sorted = Object.fromEntries(Object.entries(index).sort((a, b) => parseInt(a[0].slice(1), 10) - parseInt(b[0].slice(1), 10)));
      await writeFile(indexFile, JSON.stringify(sorted, null, 0).replace(/","/g, '",\n"') + '\n');
      dirty = false;
    };
    for (const code of todo) {
      if (requests >= max) { stopped = true; break; }
      if (requests) await sleep(delay);
      requests++;
      try {
        const file = await photoOf(code);
        index[`C${code}`] = file;
        dirty = true;
        if (file) found++; else none++;
        process.stdout.write(file ? '.' : 'x');
        if (requests % 25 === 0) await save();
      } catch (e) {
        if (e.stop) { console.log(`\nStopping: ${e.message}. LCSC is asking us to back off; try again another day with a longer --delay.`); stopped = true; break; }
        process.stdout.write('!'); // network hiccup: leave the part for the next run
      }
    }
    await save();
    process.stdout.write('\n');
    if (stopped) break;
  }
  console.log(`${requests} page(s) read: ${found} photo(s) found, ${none} part(s) without one.${stopped && requests >= max ? ` Stopped at --max ${max}; run again to continue.` : ''}`);
  if (found) console.log('Run "npm run data" to rebuild the site data with the new photos.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
