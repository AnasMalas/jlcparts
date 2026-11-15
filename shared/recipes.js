// What we try to read out of datasheets, per category.
//
// A "recipe" names the scalars and curves that are worth extracting for a kind
// of part. The same list drives (a) the extraction prompt, (b) validation of
// contributed data, (c) how the web app labels and plots the result, and
// (d) which formula functions can use it.
//
// Units are always SI base units (Ω, V, A, °C, °C/W, F, H ...).

export const RECIPES = {
  mosfet: {
    title: 'MOSFET',
    categories: ['transistors-and-thyristors-mosfets'],
    scalars: {
      rth_jc: { label: 'Thermal resistance, junction to case (max)', unit: 'thermal_resistance' },
      rth_ja: { label: 'Thermal resistance, junction to ambient (max)', unit: 'thermal_resistance' },
      tj_max: { label: 'Maximum junction temperature', unit: 'temperature' },
      rds_on_typ: { label: 'Rds(on) typical at 25 °C (headline condition)', unit: 'resistance' },
      rds_on_max: { label: 'Rds(on) maximum at 25 °C (headline condition)', unit: 'resistance' },
      rds_on_vgs: { label: 'Gate drive of the headline Rds(on) rating', unit: 'voltage' },
      qg_typ: { label: 'Total gate charge (typ)', unit: 'charge' },
      qgd_typ: { label: 'Gate-drain (Miller) charge (typ)', unit: 'charge' },
      vgs_th_typ: { label: 'Gate threshold voltage (typ)', unit: 'voltage' },
    },
    curves: {
      rds_on_vs_vgs: {
        label: 'Rds(on) vs gate-source voltage (typ, 25 °C)',
        x: { name: 'Vgs', unit: 'voltage' },
        y: { name: 'Rds(on)', unit: 'resistance' },
        hint: 'The "On-Resistance vs. Gate-Source Voltage" graph. Use the 25 °C trace. For P-channel parts report Vgs as a positive magnitude.',
      },
      rds_on_norm_vs_tj: {
        label: 'Normalised Rds(on) vs junction temperature',
        x: { name: 'Tj', unit: 'temperature' },
        y: { name: 'Rds(on) / Rds(on) at 25 °C', unit: 'ratio' },
        hint: 'The "Normalized On-Resistance vs. Junction Temperature" graph. If the graph is absolute (Ω or mΩ), divide by its 25 °C value.',
      },
    },
  },
};

/** Recipe for a category id, or null. */
export function recipeFor(categoryId) {
  for (const [key, r] of Object.entries(RECIPES)) if (r.categories.includes(categoryId)) return { key, ...r };
  return null;
}

/** Piecewise-linear interpolation through sorted [x, y] points. */
export function interp(points, x, { extrapolate = 'hold' } = {}) {
  const n = points.length;
  if (!n || Number.isNaN(x)) return NaN;
  if (n === 1) return points[0][1];
  if (x <= points[0][0]) {
    if (extrapolate === 'hold' || x === points[0][0]) return points[0][1];
    if (extrapolate === 'nan') return NaN;
    const [x0, y0] = points[0], [x1, y1] = points[1];
    return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
  }
  if (x >= points[n - 1][0]) {
    if (extrapolate === 'hold' || x === points[n - 1][0]) return points[n - 1][1];
    if (extrapolate === 'nan') return NaN;
    const [x0, y0] = points[n - 2], [x1, y1] = points[n - 1];
    return y1 + ((x - x1) * (y1 - y0)) / (x1 - x0);
  }
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= x) lo = mid; else hi = mid;
  }
  const [x0, y0] = points[lo], [x1, y1] = points[hi];
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}

/**
 * Validate one datasheet-data record (the JSON stored in datasheet-data/).
 * Returns a list of problems; empty means the record is usable.
 */
export function validateRecord(rec) {
  const problems = [];
  if (!rec || typeof rec !== 'object') return ['not an object'];
  if (!/^C\d+$/.test(rec.lcsc ?? '')) problems.push('lcsc must look like "C12345"');
  if (!rec.recipe || !RECIPES[rec.recipe]) problems.push(`unknown recipe "${rec.recipe}"`);
  const recipe = RECIPES[rec.recipe];
  if (!rec.source || typeof rec.source.url !== 'string') problems.push('source.url is required (where the datasheet came from)');
  for (const [k, v] of Object.entries(rec.scalars ?? {})) {
    if (recipe && !recipe.scalars[k]) problems.push(`unknown scalar "${k}"`);
    if (typeof v !== 'number' || !Number.isFinite(v)) problems.push(`scalar "${k}" must be a finite number`);
  }
  for (const [k, c] of Object.entries(rec.curves ?? {})) {
    if (recipe && !recipe.curves[k]) problems.push(`unknown curve "${k}"`);
    const pts = c?.points;
    if (!Array.isArray(pts) || pts.length < 2) { problems.push(`curve "${k}" needs at least 2 points`); continue; }
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (!Array.isArray(p) || p.length !== 2 || !p.every((x) => typeof x === 'number' && Number.isFinite(x))) { problems.push(`curve "${k}" point ${i} must be [x, y]`); break; }
      if (i && p[0] <= pts[i - 1][0]) { problems.push(`curve "${k}" x values must increase`); break; }
    }
  }
  if (!Object.keys(rec.scalars ?? {}).length && !Object.keys(rec.curves ?? {}).length) problems.push('record has no data');
  return problems;
}
