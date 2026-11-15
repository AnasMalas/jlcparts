// Datasheet extraction: the prompt, the output schema and the conversion to a
// datasheet-data record. Shared by the command-line tool (tools/) and the
// "extract with your own API key" option in the web app, so both produce
// exactly the same records.
//
// zod is passed in rather than imported so this file has no dependencies of
// its own and resolves the same way from Node and from the web bundle.

import { RECIPES, validateRecord } from './recipes.js';

export const EXTRACT_MODEL = 'claude-opus-5-5';

/** Structured-output schema for one recipe. */
export function makeSchema(z, recipeKey) {
  const recipe = RECIPES[recipeKey];
  const scalarNames = Object.keys(recipe.scalars);
  const curveNames = Object.keys(recipe.curves);
  return z.object({
    datasheet_matches_part: z.boolean().describe('false when the PDF is clearly for a different component'),
    part_number_in_datasheet: z.string(),
    scalars: z.array(
      z.object({
        name: z.enum(scalarNames),
        value: z.number().describe('in SI base units'),
        condition: z.string().describe('test condition as printed, or "" if none'),
        page: z.number().describe('1-based PDF page the value was read from'),
      }),
    ),
    curves: z.array(
      z.object({
        name: z.enum(curveNames),
        figure: z.string().describe('figure number / title as printed'),
        page: z.number(),
        conditions: z.string().describe('e.g. "Id = 5 A, Tj = 25 °C"'),
        x_axis: z.string().describe('axis quantity, unit and whether the scale is linear or logarithmic'),
        y_axis: z.string(),
        points: z.array(z.object({ x: z.number(), y: z.number() })).describe('6 to 14 points, x ascending, SI base units'),
      }),
    ),
    notes: z.string().describe('anything a reviewer should know: ambiguities, traces you had to choose between, low legibility'),
  });
}

export const SYSTEM_PROMPT = `You read electronic component datasheets and transcribe specific values and graph curves into numbers.

Your output feeds a parts search engine: engineers will sort and filter thousands of components by the numbers you report, and shortlist parts from them. A wrong number silently puts the wrong part on someone's shortlist, while a missing number just means that part falls back to a rougher estimate. So accuracy matters far more than coverage: report only what the datasheet actually shows, and leave out anything you cannot read with confidence.

How to read a graph:
- First identify each axis: the quantity, the unit, and whether the scale is linear or logarithmic. Logarithmic axes are common for resistance and current; misreading one as linear is the most frequent error, so check the spacing of the gridlines and the tick labels before reading any point.
- Read points where the trace crosses labelled gridlines, where the value is least ambiguous. Give 6 to 14 points spanning the whole trace, including both ends, with more points where the curve bends.
- When a graph has several traces, use the one the request asks for (usually the typical curve at 25 °C) and say in "conditions" which trace you used.
- Convert everything to SI base units: mΩ to Ω, mV to V, nC to C, and so on. Temperatures stay in °C.
- For P-channel parts, report voltages and currents as positive magnitudes.

Tables: prefer the electrical-characteristics and thermal tables for scalar values, and record the test condition printed beside each value.

If the PDF is for a different part than the one named, set datasheet_matches_part to false and return empty lists.`;

/** The user-turn text describing what to extract for one part. */
export function buildRequest(recipeKey, part) {
  const recipe = RECIPES[recipeKey];
  const lines = [];
  lines.push(`Component: ${part.mfr || '(unknown part number)'} — LCSC ${part.lcsc}. It is a ${recipe.title}.`);
  if (part.description) lines.push(`Catalogue description: ${part.description}`);
  lines.push('', 'Curves to transcribe, if the datasheet has them:');
  for (const [name, c] of Object.entries(recipe.curves)) {
    lines.push(`- ${name}: ${c.label}. x = ${c.x.name}, y = ${c.y.name}. ${c.hint}`);
  }
  lines.push('', 'Scalar values to report, if the datasheet states them:');
  for (const [name, s] of Object.entries(recipe.scalars)) lines.push(`- ${name}: ${s.label}`);
  lines.push('', 'Leave out any curve or value the datasheet does not contain.');
  return lines.join('\n');
}

/**
 * Convert the model's structured output into a datasheet-data record.
 * Returns { record, problems } — problems is non-empty when it should not be saved.
 */
export function toRecord(output, part, recipeKey, meta) {
  if (!output.datasheet_matches_part) {
    return { record: null, problems: [`The PDF appears to be for "${output.part_number_in_datasheet}", not ${part.mfr || part.lcsc}.`] };
  }
  const pages = new Set();
  const scalars = {};
  for (const s of output.scalars) {
    if (Number.isFinite(s.value)) { scalars[s.name] = s.value; pages.add(s.page); }
  }
  const curves = {};
  for (const c of output.curves) {
    const pts = c.points
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x)
      .filter((p, i, arr) => i === 0 || p.x > arr[i - 1].x)
      .map((p) => [p.x, p.y]);
    if (pts.length < 2) continue;
    curves[c.name] = { cond: c.conditions ? { note: c.conditions } : undefined, points: pts, note: [c.figure, c.x_axis, c.y_axis].filter(Boolean).join(' · ') };
    pages.add(c.page);
  }
  const record = {
    lcsc: part.lcsc,
    mfr: part.mfr,
    recipe: recipeKey,
    source: {
      url: meta.url,
      retrieved: meta.retrieved ?? new Date().toISOString().slice(0, 10),
      method: meta.method ?? `read by ${EXTRACT_MODEL}`,
      pages: [...pages].filter((p) => p > 0).sort((a, b) => a - b).join(', '),
      notes: output.notes || undefined,
    },
    scalars,
    curves,
  };
  return { record, problems: [...sanityCheck(record), ...validateRecord(record)] };
}

/** Physical plausibility checks that catch the usual graph-reading mistakes. */
export function sanityCheck(record) {
  const problems = [];
  if (record.recipe !== 'mosfet') return problems;
  const vg = record.curves?.rds_on_vs_vgs?.points;
  if (vg) {
    if (vg.some(([x, y]) => x <= 0 || x > 40 || y <= 0 || y > 1e4)) problems.push('rds_on_vs_vgs: values outside any plausible range (Vgs 0–40 V, Rds > 0 Ω) — wrong units?');
    // on-resistance falls as the gate is driven harder
    if (vg[vg.length - 1][1] > vg[0][1] * 1.05) problems.push('rds_on_vs_vgs: resistance rises with gate voltage — axes swapped or wrong trace?');
  }
  const tj = record.curves?.rds_on_norm_vs_tj?.points;
  if (tj) {
    const lo = tj[0], hi = tj[tj.length - 1];
    if (lo[0] > 25 || hi[0] < 25) problems.push('rds_on_norm_vs_tj: curve does not span 25 °C');
    if (tj.some(([, y]) => y <= 0 || y > 6)) problems.push('rds_on_norm_vs_tj: normalised values should sit roughly between 0.4 and 4 — was the absolute curve not normalised?');
  }
  const s = record.scalars ?? {};
  if (s.rth_jc !== undefined && (s.rth_jc <= 0 || s.rth_jc > 500)) problems.push('rth_jc out of range');
  if (s.rth_ja !== undefined && (s.rth_ja <= 0 || s.rth_ja > 1500)) problems.push('rth_ja out of range');
  if (s.rth_jc !== undefined && s.rth_ja !== undefined && s.rth_jc > s.rth_ja) problems.push('rth_jc is larger than rth_ja — swapped?');
  if (s.tj_max !== undefined && (s.tj_max < 100 || s.tj_max > 250)) problems.push('tj_max out of range');
  if (s.rds_on_typ !== undefined && s.rds_on_max !== undefined && s.rds_on_typ > s.rds_on_max) problems.push('rds_on_typ is larger than rds_on_max');
  return problems;
}

/**
 * Ask Claude to read one datasheet PDF. `deps` carries the SDK pieces so this
 * file stays dependency-free: { client, zodOutputFormat, z }.
 * Returns { record, problems, usage, model }.
 */
export async function extractFromPdf(deps, { recipeKey, part, pdfBase64, url, method }) {
  const schema = makeSchema(deps.z, recipeKey);
  const response = await deps.client.beta.messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 16000,
    // If a safety classifier declines the request, let the API retry on a fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: deps.zodOutputFormat(schema) },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: buildRequest(recipeKey, part) },
        ],
      },
    ],
  });
  if (response.stop_reason === 'refusal') {
    return { record: null, problems: [`The model declined this request (${response.stop_details?.category ?? 'no category'}).`], usage: response.usage, model: response.model };
  }
  if (response.stop_reason === 'max_tokens') {
    return { record: null, problems: ['The answer was cut off before it finished; try again.'], usage: response.usage, model: response.model };
  }
  const text = response.content.find((b) => b.type === 'text')?.text;
  let output;
  try {
    output = schema.parse(JSON.parse(text ?? ''));
  } catch (e) {
    return { record: null, problems: [`The model's answer did not match the expected format: ${e.message}`], usage: response.usage, model: response.model };
  }
  const { record, problems } = toRecord(output, part, recipeKey, { url, method: method ?? `read by ${response.model}` });
  return { record, problems, usage: response.usage, model: response.model };
}
