// "Datasheet jobs": a way to get datasheet data for many parts at once using
// any LLM you like, without this site needing an API key or fetching anything.
//
//   1. The site writes a job file: what to read, for which parts, and the
//      exact shape of the answer.
//   2. You give that file (and the datasheets, or let the model browse) to an LLM.
//   3. You import the JSON it returns. Every record is validated before use.
//
// This module builds the job text and parses the answer. It is pure: no DOM,
// no network, so the same code is used by the site and by the tools.

import { RECIPES, validateRecord } from './recipes.js';
import { sanityCheck } from './extract.js';
import { UNITS } from './units.js';

const JLC_FILES = 'https://jlcpcb.com/api/file/downloadByFileSystemAccessId/';

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const baseUnit = (unit) => {
  const u = UNITS[unit];
  if (!u) return '';
  if (unit === 'length') return 'm';
  if (unit === 'slew_rate') return 'V/s';
  return u.sym;
};

/** Pretty JSON, but with each [x, y] pair and each list of pairs on one line: how the answer should look. */
function compactPairs(json) {
  const pair = /\[\s*(-?[\d.eE+-]+),\s*(-?[\d.eE+-]+)\s*\]/g;
  return json
    .replace(pair, '[$1, $2]')
    .replace(/\[\s*((?:\[-?[\d.eE+-]+, -?[\d.eE+-]+\],?\s*)+)\]/g, (m, inner) => `[${inner.trim().replace(/\s*\n\s*/g, ' ')}]`);
}

/**
 * Build the job file.
 *
 * job = {
 *   site, searchUrl, created,
 *   category: { id, name },
 *   recipeKey,
 *   want: { scalars: [name], curves: [name] },
 *   formulas: [{ name, expr }],
 *   criteria: [{ name, key, unit, text, formula }],   // active filters
 *   columns: [{ id, name, unit }],                     // catalogue columns shown per part
 *   parts: [{ lcsc, mfr, manufacturer, package, values: [text], unknown: [columnId], datasheet }],
 * }
 */
export function buildJob(job) {
  const recipe = RECIPES[job.recipeKey];
  const L = [];
  const nUnknown = job.parts.filter((p) => p.unknown.length).length;

  L.push(`# Datasheet reading job: ${job.parts.length} ${job.category.name}`);
  L.push('');
  L.push(
    `You are helping an engineer choose a component. The parts below are candidates from a parts catalogue ` +
      `(${job.site}). The catalogue lacks some values that exist only in each manufacturer's datasheet, often only as a graph. ` +
      `Your job is to read those values from the datasheets and return them as one JSON object in the exact format at the end. ` +
      `That JSON is imported back into the catalogue, where it drives the engineer's calculations and filters.`,
  );
  L.push('');
  L.push(
    'Accuracy matters more than coverage. A wrong number silently puts the wrong part on a shortlist; a missing number only ' +
      'means that part keeps a rougher estimate. Report what the datasheet shows and leave out anything you cannot read with confidence.',
  );

  // ---- what the data is for ------------------------------------------------
  if (job.formulas.length) {
    L.push('', '## What the data will be used for', '');
    L.push('The engineer evaluates these formulas for every part (they are context, you do not need to compute them):', '');
    L.push('```');
    for (const f of job.formulas) L.push(`${f.name} = ${f.expr}`);
    L.push('```');
  }

  // ---- criteria --------------------------------------------------------------
  if (job.criteria.length) {
    L.push('', '## Requirements the part must meet', '');
    for (const c of job.criteria) {
      L.push(`- ${c.name}: ${c.text}${c.formula ? ' (a calculated value: do not judge parts on it)' : ''}`);
    }
    if (nUnknown) {
      L.push('');
      L.push(
        `${nUnknown} of the parts have a blank in the catalogue for one of these requirements; the \`check\` column names which. ` +
          'For those parts, read that value from the datasheet first. If it clearly fails the requirement, do not spend time on ' +
          'the curves: list the part under `rejected` with the value you found. Either way, report the value under `params` ' +
          '(see the format) so the catalogue gap is filled and the part is not asked about again.',
      );
    }
    L.push('');
    L.push(
      'Parts without a `check` entry already meet the requirements according to the catalogue; do not re-check them, ' +
        'but do reject a part if its datasheet plainly contradicts the catalogue on one of them.',
    );
  }

  // ---- what to read ------------------------------------------------------------
  L.push('', '## What to read from each datasheet', '');
  if (job.want.curves.length) {
    L.push('Curves (give 6 to 14 `[x, y]` points per curve, x increasing, spanning the whole trace, denser where it bends):', '');
    for (const name of job.want.curves) {
      const c = recipe.curves[name];
      L.push(`- \`${name}\`: ${c.label}. x = ${c.x.name} in ${baseUnit(c.x.unit) || 'plain number'}, y = ${c.y.name} in ${baseUnit(c.y.unit) || 'plain number (a ratio)'}. ${c.hint}`);
    }
    L.push('');
  }
  if (job.want.scalars.length) {
    L.push('Single values:', '');
    for (const name of job.want.scalars) {
      const s = recipe.scalars[name];
      L.push(`- \`${name}\`: ${s.label}, in ${baseUnit(s.unit) || 'plain number'}`);
    }
    L.push('');
  }
  L.push('How to read a graph:', '');
  L.push('- Identify each axis first: quantity, unit, and whether the scale is linear or logarithmic. Mistaking a log axis for a linear one is the most common error; check the tick labels and gridline spacing before reading a point.');
  L.push('- Read where the trace crosses labelled gridlines. Use the electrical-characteristics table to check your reading of the axes: a typical value it states at the same condition should land on your curve. If the two differ by more than about 10 %, the datasheet itself is inconsistent: report the graph as drawn and say so in `notes`.');
  L.push('- If a graph has several traces, use the one asked for (normally the typical curve at 25 °C) and record which in `cond`.');
  L.push('- Use SI base units throughout: 18 mΩ is 0.018, 6 nC is 6e-9. Temperatures are in °C.');
  L.push('- For P-channel parts give voltages and currents as positive magnitudes.');

  // ---- datasheets ----------------------------------------------------------------
  L.push('', '## Getting the datasheets', '');
  L.push(
    'Use the manufacturer\'s own datasheet for the exact part number (check the part number on the first page). ' +
      'If datasheet files were attached to this conversation, use those. Otherwise look the part up on the manufacturer\'s site. ' +
      'The `datasheet` column is the catalogue\'s link; many of those only open in a person\'s browser, so treat it as a fallback. ' +
      'If you cannot get a part\'s datasheet, do not guess from memory or from a similar part: list it under `unavailable`.',
  );

  // ---- the parts ---------------------------------------------------------------------
  // Keep the table small: a column that says the same thing for every part is
  // stated once, and the catalogue's long file-service links are abbreviated.
  const fields = [
    { head: 'manufacturer', get: (p) => p.manufacturer },
    { head: 'package', get: (p) => p.package },
    ...job.columns.map((c, i) => ({ head: c.name, get: (p) => p.values[i] })),
  ];
  const common = [], varying = [];
  for (const f of fields) {
    const first = job.parts.length ? f.get(job.parts[0]) : '';
    if (job.parts.length > 3 && first && job.parts.every((p) => f.get(p) === first)) common.push(`${f.head} = ${first}`);
    else varying.push(f);
  }
  const short = (url) => (url && url.startsWith(JLC_FILES) ? `jlc:${url.slice(JLC_FILES.length)}` : url);
  const anyJlc = job.parts.some((p) => p.datasheet && p.datasheet.startsWith(JLC_FILES));
  L.push('', '## Parts', '');
  L.push('CSV. `check` lists catalogue blanks to read first (as `params` keys); empty means nothing to check.');
  if (common.length) L.push(`The same for every part, so not repeated below: ${common.join('; ')}.`);
  if (anyJlc) L.push('In the `datasheet` column, `jlc:<id>` stands for ' + JLC_FILES + '<id>.');
  L.push('', '```csv');
  L.push(['lcsc', 'part_number', ...varying.map((f) => f.head), 'check', 'datasheet'].map(csvCell).join(','));
  for (const p of job.parts) {
    L.push([p.lcsc, p.mfr, ...varying.map((f) => f.get(p)), p.unknown.join(' '), short(p.datasheet)].map(csvCell).join(','));
  }
  L.push('```');

  // ---- params keys ---------------------------------------------------------------------
  const paramCols = job.criteria.filter((c) => !c.formula);
  if (paramCols.length) {
    L.push('', '## `params` keys', '');
    L.push('Use these keys to report a catalogue value you read from the datasheet:', '');
    for (const c of paramCols) {
      const how = c.kind === 'range' ? `[low, high] in ${baseUnit(c.unit) || 'plain numbers'}` : c.kind === 'num' ? `number in ${baseUnit(c.unit) || 'plain number'}` : `text, one of the catalogue's values such as ${c.examples ?? '…'}`;
      L.push(`- \`${c.key}\`: ${c.name} (${how})`);
    }
  }

  // ---- output ------------------------------------------------------------------------------
  const exScalars = job.want.scalars.slice(0, 2);
  const exCurve = job.want.curves[0];
  const exParam = paramCols.find((c) => c.kind === 'num') ?? paramCols[0];
  const example = {
    job: { category: job.category.id, recipe: job.recipeKey },
    records: [
      {
        lcsc: 'C12345',
        mfr: 'PART-NUMBER',
        source: { url: 'https://manufacturer.example/datasheet.pdf', pages: '2, 4', method: 'read by <your model name>', notes: 'optional: anything a reviewer should know' },
        ...(exScalars.length ? { scalars: Object.fromEntries(exScalars.map((s, i) => [s, i ? 150 : 1.5])) } : {}),
        ...(exCurve ? { curves: { [exCurve]: { cond: { note: 'conditions printed on the graph', figure: 'Fig. 5' }, points: [[2.5, 0.024], [4.5, 0.019], [10, 0.018]] } } } : {}),
        ...(exParam ? { params: { [exParam.key]: exParam.kind === 'range' ? [-55, 150] : exParam.kind === 'num' ? 1.25 : 'value' } } : {}),
      },
    ],
    rejected: [{ lcsc: 'C23456', reason: 'which requirement failed and the value found' }],
    unavailable: [{ lcsc: 'C34567', reason: 'why the datasheet could not be read' }],
  };
  L.push('', '## Answer format', '');
  L.push(
    'Reply with one JSON object and nothing else, in a single code block (or as a .json file). Every part in the list must appear ' +
      'exactly once: in `records`, `rejected` or `unavailable`. A rejected part may also have a record carrying only `params`.',
  );
  L.push('');
  L.push('```json');
  L.push(compactPairs(JSON.stringify(example, null, 2)));
  L.push('```');
  L.push('');
  L.push('Rules the importer enforces, so an answer that breaks them is discarded:');
  L.push('');
  L.push('- `lcsc` must be one of the codes in the parts list; `source.url` must be the document you actually read.');
  L.push(`- Only these names are accepted. curves: ${job.want.curves.map((c) => `\`${c}\``).join(', ') || 'none'}. scalars: ${job.want.scalars.map((s) => `\`${s}\``).join(', ') || 'none'}.`);
  L.push('- Curve x values strictly increase; all numbers are finite; units are SI base units.');
  L.push('- Leave a key out rather than writing null, 0 or a guess.');
  L.push('');
  L.push(`<!-- job: ${job.category.id} · ${job.recipeKey} · ${job.parts.length} parts · ${job.created} · ${job.searchUrl} -->`);
  return L.join('\n') + '\n';
}

/** Pull the JSON object out of whatever the model replied with (fences, prose around it). */
function extractJson(text) {
  const t = String(text).trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch { /* fall through */ }
  }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch { /* fall through */ }
  }
  const c = t.indexOf('['), d = t.lastIndexOf(']');
  if (c >= 0 && d > c) return JSON.parse(t.slice(c, d + 1));
  throw new Error('no JSON found in the text');
}

/**
 * Parse and validate an LLM's answer to a job.
 *
 * opts = { recipeKey, categoryId, knownLcsc?: (code) => boolean, today?: 'YYYY-MM-DD' }
 * Returns { accepted: [record], refused: [{ lcsc, problems }], rejected: [...], unavailable: [...], warnings: [text] }
 */
export function parseJobResult(text, opts) {
  let data;
  try { data = extractJson(text); } catch (e) { return { accepted: [], refused: [], rejected: [], unavailable: [], warnings: [`Could not read the answer as JSON: ${e.message}`] }; }
  const warnings = [];
  const list = Array.isArray(data) ? data : Array.isArray(data?.records) ? data.records : null;
  if (!list) return { accepted: [], refused: [], rejected: [], unavailable: [], warnings: ['The JSON has no "records" list.'] };
  if (data?.job?.category && opts.categoryId && data.job.category !== opts.categoryId) {
    warnings.push(`This answer was made for the category "${data.job.category}", not the one you have open.`);
  }
  const accepted = [], refused = [];
  const seen = new Set();
  for (const raw of list) {
    const lcsc = typeof raw?.lcsc === 'string' ? raw.lcsc.trim().toUpperCase() : '';
    if (!raw || typeof raw !== 'object') { refused.push({ lcsc: '?', problems: ['not an object'] }); continue; }
    const rec = {
      lcsc,
      mfr: typeof raw.mfr === 'string' ? raw.mfr : undefined,
      recipe: raw.recipe ?? data?.job?.recipe ?? opts.recipeKey,
      source: { ...(raw.source ?? {}), retrieved: raw.source?.retrieved ?? opts.today ?? new Date().toISOString().slice(0, 10) },
      ...(raw.scalars && Object.keys(raw.scalars).length ? { scalars: raw.scalars } : {}),
      ...(raw.curves && Object.keys(raw.curves).length ? { curves: raw.curves } : {}),
      ...(raw.params && Object.keys(raw.params).length ? { params: raw.params } : {}),
    };
    if (!rec.source.method) rec.source.method = 'read by an LLM (imported job result)';
    const problems = [...validateRecord(rec), ...sanityCheck(rec)];
    if (rec.recipe !== opts.recipeKey) problems.push(`recipe "${rec.recipe}" does not belong to this category`);
    if (rec.source?.url && !/^https?:\/\//i.test(rec.source.url)) problems.push('source.url must be a web address');
    if (opts.knownLcsc && lcsc && !opts.knownLcsc(lcsc)) problems.push('this LCSC code is not in the open category');
    if (seen.has(lcsc)) problems.push('listed twice');
    seen.add(lcsc);
    if (problems.length) refused.push({ lcsc: lcsc || '?', problems });
    else accepted.push(rec);
  }
  const tidy = (arr) => (Array.isArray(arr) ? arr.filter((x) => x && typeof x.lcsc === 'string').map((x) => ({ lcsc: x.lcsc.toUpperCase(), reason: String(x.reason ?? '') })) : []);
  return { accepted, refused, rejected: tidy(data?.rejected), unavailable: tidy(data?.unavailable), warnings };
}
