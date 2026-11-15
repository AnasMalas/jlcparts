#!/usr/bin/env node
// Reads datasheet PDFs with Claude and writes datasheet-data/<recipe>/<LCSC>.json.
//
//   node tools/extract-datasheet.mjs C20917 --url https://www.aosmd.com/pdfs/datasheet/AO3400A.pdf
//   node tools/extract-datasheet.mjs C20917 --pdf ./ao3400a.pdf        a PDF you already have
//   node tools/extract-datasheet.mjs C20917 C15127 --dir ./pdfs        PDFs named <LCSC>.pdf in a folder
//   node tools/extract-datasheet.mjs --recipe mosfet --top 25 --dir ./pdfs   most-stocked parts with no data yet
//
// Where the PDF comes from: --pdf / --dir / --url if given, otherwise the
// catalogue's datasheet link. Most catalogue links point at JLCPCB's own file
// service, which only serves browsers and is off-limits to robots, so for
// those parts get the PDF from the manufacturer (--url) or save it from your
// browser first (--pdf / --dir). The tool never tries to get around that.
//
// Options: --force (overwrite existing records)  --keep-flagged (save records that fail the sanity checks)
//          --dry-run (list what would be extracted, call nothing)
//
// Needs the built catalogue (npm run data) to look parts up, and Anthropic API
// credentials (ANTHROPIC_API_KEY, or an `ant auth login` profile). Every part
// costs one API request with the whole PDF as input, so expect a few cents each.

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { RECIPES } from '../shared/recipes.js';
import { extractFromPdf } from '../shared/extract.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'web/public/data');
const OUT = path.join(ROOT, 'datasheet-data');
const DS_PREFIX = 'https://jlcpcb.com/api/file/downloadByFileSystemAccessId/';
const MAX_PDF_BYTES = 22 * 1024 * 1024; // base64 inflates by a third; the request limit is 32 MB

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const valueFlags = new Set(['recipe', 'top', 'pdf', 'dir', 'url']);
const ids = args.filter((a, i) => /^C\d+$/i.test(a) && !valueFlags.has((args[i - 1] ?? '').replace(/^--/, ''))).map((a) => a.toUpperCase());

const exists = (p) => access(p).then(() => true, () => false);

async function loadCategory(id) {
  const file = path.join(DATA, 'c', `${id}.json.gz`);
  if (!(await exists(file))) throw new Error(`Catalogue not built: ${file} is missing. Run "npm run data" first.`);
  return JSON.parse(gunzipSync(await readFile(file)).toString('utf8'));
}

async function fetchPdf(url) {
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) throw new Error(`download failed: HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('the link did not return a PDF');
  return buf;
}

async function main() {
  const recipeKey = opt('recipe', 'mosfet');
  const recipe = RECIPES[recipeKey];
  if (!recipe) throw new Error(`Unknown recipe "${recipeKey}". Known: ${Object.keys(RECIPES).join(', ')}`);
  const top = parseInt(opt('top', '0'), 10);
  if ((opt('pdf') || opt('url')) && (ids.length !== 1 || top)) throw new Error('--pdf and --url describe one datasheet, so give exactly one LCSC code with them.');
  if (!ids.length && !top) {
    console.error('Give LCSC codes (C12345 ...) or --top N. See the header of this file for usage.');
    process.exit(2);
  }

  // Look the parts up in the built catalogue.
  const todo = [];
  for (const catId of recipe.categories) {
    const cat = await loadCategory(catId);
    const want = new Set(ids.map((s) => parseInt(s.slice(1), 10)));
    for (let r = 0; r < cat.n; r++) { // rows are ordered by stock, highest first
      const lcsc = `C${cat.lcsc[r]}`;
      const picked = want.has(cat.lcsc[r]);
      if (!picked && !(top && todo.length < top)) continue;
      const dest = path.join(OUT, recipeKey, `${lcsc}.json`);
      if (!flag('force') && (await exists(dest))) { if (picked) console.log(`${lcsc}: already extracted (use --force to redo)`); continue; }
      const ds = cat.ds[r];
      const catalogueUrl = ds.startsWith('~') ? DS_PREFIX + ds.slice(1) : ds;
      // Decide where this part's PDF comes from.
      let file = null, url = opt('url') ?? null;
      if (opt('pdf')) file = opt('pdf');
      else if (opt('dir') && (await exists(path.join(opt('dir'), `${lcsc}.pdf`)))) file = path.join(opt('dir'), `${lcsc}.pdf`);
      if (!file && !url) {
        if (!catalogueUrl) { if (picked) console.log(`${lcsc}: the catalogue has no datasheet link — pass --url or --pdf`); continue; }
        if (catalogueUrl.startsWith(DS_PREFIX)) {
          if (picked || opt('dir')) console.log(`${lcsc} ${cat.mfr[r]}: datasheet link is JLCPCB's browser-only file service — pass --url <manufacturer PDF>, or save it as ${lcsc}.pdf and use --dir`);
          continue;
        }
        url = catalogueUrl;
      }
      todo.push({ lcsc, mfr: cat.mfr[r], description: cat.desc[r], url, file, sourceUrl: url ?? catalogueUrl ?? '', dest });
    }
  }
  const missing = ids.filter((id) => !todo.some((t) => t.lcsc === id));
  if (flag('dry-run')) {
    for (const t of todo) console.log(`${t.lcsc}  ${t.mfr}  ${t.file ?? t.url}`);
    console.log(`${todo.length} part(s) would be extracted.`);
    return;
  }
  if (!todo.length) { console.log('Nothing to do.', missing.length ? `Not found or skipped: ${missing.join(', ')}` : ''); return; }

  const client = new Anthropic();
  let saved = 0, flagged = 0, failed = 0, tokensIn = 0, tokensOut = 0;
  for (const part of todo) {
    process.stdout.write(`${part.lcsc} ${part.mfr}: `);
    try {
      const pdf = part.file ? await readFile(part.file) : await fetchPdf(part.url);
      if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('not a PDF file');
      if (pdf.length > MAX_PDF_BYTES) throw new Error(`PDF is ${(pdf.length / 1e6).toFixed(1)} MB, too large for one request`);
      const { record, problems, usage } = await extractFromPdf(
        { client, zodOutputFormat, z },
        { recipeKey, part, pdfBase64: pdf.toString('base64'), url: part.sourceUrl || 'local file' },
      );
      tokensIn += usage?.input_tokens ?? 0;
      tokensOut += usage?.output_tokens ?? 0;
      if (!record) { failed++; console.log(`no record — ${problems.join('; ')}`); continue; }
      const nothing = !Object.keys(record.scalars).length && !Object.keys(record.curves).length;
      if (nothing) { failed++; console.log('the datasheet had none of the requested data'); continue; }
      if (problems.length && !flag('keep-flagged')) { flagged++; console.log(`FLAGGED, not saved — ${problems.join('; ')}`); continue; }
      await mkdir(path.dirname(part.dest), { recursive: true });
      await writeFile(part.dest, JSON.stringify(record, null, 2) + '\n');
      saved++;
      console.log(`saved ${Object.keys(record.curves).length} curve(s), ${Object.keys(record.scalars).length} value(s)${problems.length ? ` [flagged: ${problems.join('; ')}]` : ''}`);
    } catch (e) {
      failed++;
      if (e instanceof Anthropic.AuthenticationError) { console.log('authentication failed — set ANTHROPIC_API_KEY or run `ant auth login`'); break; }
      if (e instanceof Anthropic.RateLimitError) { console.log('rate limited — wait a minute and re-run; finished parts are skipped automatically'); break; }
      if (e instanceof Anthropic.BadRequestError) { console.log(`request rejected: ${e.message}`); continue; }
      if (e instanceof Anthropic.APIError) { console.log(`API error ${e.status}: ${e.message}`); continue; }
      console.log(e.message);
    }
  }
  console.log(`\nSaved ${saved}, flagged ${flagged}, failed ${failed}. Tokens: ${tokensIn} in, ${tokensOut} out.`);
  if (saved) console.log('Review the new files in datasheet-data/, then run "npm run data" to include them in the site.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
