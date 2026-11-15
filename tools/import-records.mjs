#!/usr/bin/env node
// Turns a bundle of datasheet records into files under datasheet-data/.
//
//   node tools/import-records.mjs datasheet-records-mosfet.json
//
// The bundle is what the site's "Download for a pull request" button saves, or
// an LLM's answer to a datasheet job: { "records": [ ... ] }. Every record is
// validated; ones that fail are listed and skipped. An existing file for the
// same part is merged (new values win) unless --replace is given.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECIPES } from '../shared/recipes.js';
import { parseJobResult } from '../shared/job.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith('--'));
const replace = args.includes('--replace');
if (!files.length) { console.error('Usage: node tools/import-records.mjs <bundle.json> [--replace]'); process.exit(2); }

let written = 0, refused = 0;
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const recipeKey of Object.keys(RECIPES)) {
    // records carry their own recipe; parse once per recipe and keep the ones that belong to it
    const res = parseJobResult(text, { recipeKey, categoryId: '' });
    for (const w of res.warnings) console.log(`${file}: ${w}`);
    for (const r of res.refused) {
      if (r.problems.length === 1 && r.problems[0].startsWith('recipe "')) continue; // belongs to another recipe
      refused++;
      console.log(`REFUSED ${r.lcsc}: ${r.problems.join('; ')}`);
    }
    for (const rec of res.accepted) {
      const dest = path.join(ROOT, 'datasheet-data', recipeKey, `${rec.lcsc}.json`);
      let out = rec;
      if (!replace) {
        try {
          const old = JSON.parse(await readFile(dest, 'utf8'));
          out = { ...old, ...rec, scalars: { ...old.scalars, ...rec.scalars }, curves: { ...old.curves, ...rec.curves }, params: { ...old.params, ...rec.params } };
          for (const k of ['scalars', 'curves', 'params']) if (!Object.keys(out[k] ?? {}).length) delete out[k];
        } catch { /* no existing file */ }
      }
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, JSON.stringify(out, null, 2) + '\n');
      written++;
      console.log(`wrote datasheet-data/${recipeKey}/${rec.lcsc}.json`);
    }
  }
}
console.log(`\n${written} record(s) written, ${refused} refused.`);
if (written) console.log('Review them against the datasheets, run "npm test", then open a pull request.');
process.exitCode = refused && !written ? 1 : 0;
