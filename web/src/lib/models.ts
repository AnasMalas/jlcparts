// Formula functions: generic ones available everywhere, and per-category
// models that combine catalogue values, datasheet-derived data and (when
// there is nothing better) a clearly-flagged generic physical model.

import type { Category, Column } from './data';
import { priceAt } from './data';
import type { DsMap, DsRecord } from './dsdata';
import { parse, type EvalCtx, type Fn, type Node, type Val } from './formula';
import { interp } from '@shared/recipes.js';

export interface FnHelp {
  sig: string;
  text: string;
}

const num = (v: Val | undefined, dflt = NaN): number => (typeof v === 'number' ? v : v === undefined ? dflt : NaN);

export interface Models {
  fns: Record<string, Fn>;
  help: FnHelp[];
}

export function buildModels(cat: Category, attrs: Column[], ds: DsMap): Models {
  const dsByRow: (DsRecord | undefined)[] = new Array(cat.n);
  for (const [lcsc, rec] of ds) {
    const r = cat.rowOf.get(lcsc);
    if (r !== undefined) dsByRow[r] = rec;
  }
  const col = (id: string): Column | undefined => attrs.find((a) => a.id === id);

  const fns: Record<string, Fn> = {
    price: (ctx, a) => priceAt(cat.price[ctx.row], num(a[0], 1)),
    ds: (ctx, a) => {
      const v = dsByRow[ctx.row]?.scalars?.[String(a[0])];
      if (v === undefined) { ctx.note = 'no datasheet data for this part yet'; return NaN; }
      return v;
    },
    curve: (ctx, a) => {
      const c = dsByRow[ctx.row]?.curves?.[String(a[0])];
      if (!c) { ctx.note = 'no datasheet curve for this part yet'; return NaN; }
      return interp(c.points, num(a[1]), { extrapolate: 'hold' });
    },
    has_ds: (ctx) => (dsByRow[ctx.row] ? 1 : 0),
  };
  const help: FnHelp[] = [
    { sig: 'price(qty)', text: 'Unit price in USD at an order quantity.' },
    { sig: 'ds("name")', text: 'A datasheet-derived value for this part (blank when nobody has extracted it yet).' },
    { sig: 'curve("name", x)', text: 'Read a digitised datasheet curve at x (linear interpolation).' },
    { sig: 'has_ds()', text: '1 when datasheet-derived data exists for the part, else 0.' },
  ];

  if (cat.id === 'transistors-and-thyristors-mosfets') {
    const rds = col('rds-on');
    const vdss = col('drain-source-voltage-vdss');
    const tech = col('technology');
    const pd = col('power-dissipation-pd');
    const temp = col('operating-temperature');
    const techIdx = (name: string) => tech?.dict?.indexOf(name) ?? -1;
    const SIC = techIdx('SiC'), GAN = techIdx('GaN');

    /** Exponent of Rds(on) ∝ (T/298 K)^α. Generic; real parts vary. */
    const alpha = (row: number): number => {
      const t = tech?.ev?.[row] ?? -1;
      if (t === SIC && SIC >= 0) return 0.85;
      if (t === GAN && GAN >= 0) return 2.2;
      const v = vdss?.nv?.[row] ?? NaN;
      if (!(v > 0)) return 1.7;
      if (v <= 30) return 1.3;
      if (v <= 60) return 1.6;
      if (v <= 100) return 1.9;
      if (v <= 200) return 2.2;
      if (v <= 400) return 2.4;
      return 2.6;
    };
    const defaultDrive = (row: number) => {
      const t = tech?.ev?.[row] ?? -1;
      return t === SIC && SIC >= 0 ? 18 : t === GAN && GAN >= 0 ? 6 : 10;
    };
    const tjMax = (row: number): number => dsByRow[row]?.scalars?.tj_max ?? temp?.hi?.[row] ?? NaN;

    /** Rds(on) at 25 °C for a gate drive, from the best source available. */
    const rds25 = (ctx: EvalCtx, vgs: number): number => {
      const row = ctx.row;
      const curve = dsByRow[row]?.curves?.rds_on_vs_vgs;
      if (curve) {
        const pts = curve.points;
        if (vgs < pts[0][0]) { ctx.note = `below the datasheet curve (starts at ${pts[0][0]} V)`; return NaN; }
        return interp(pts, vgs, { extrapolate: 'hold' });
      }
      let raw = rds?.pts?.[row] || null;
      if (!raw) {
        // no catalogue rating: a datasheet record may still state the headline value
        const sc = dsByRow[row]?.scalars;
        const r = sc?.rds_on_typ ?? sc?.rds_on_max ?? (rds?.filled?.[row] ? rds.nv![row] : undefined);
        if (r === undefined || Number.isNaN(r)) { ctx.note = 'no Rds(on) in the catalogue or datasheet data'; return NaN; }
        raw = [[sc?.rds_on_vgs ?? null, r]];
      }
      const drive = defaultDrive(row);
      // best (lowest) resistance per gate voltage; an unspecified voltage means "rated drive"
      const byV = new Map<number, number>();
      for (const [v, r] of raw) {
        const key = v === null ? drive : Math.abs(v);
        byV.set(key, Math.min(byV.get(key) ?? Infinity, r));
      }
      const pts = [...byV.entries()].sort((a, b) => a[0] - b[0]);
      if (vgs < pts[0][0] - 1e-9) {
        ctx.note = `not rated below Vgs = ${pts[0][0]} V`;
        return NaN;
      }
      if (vgs >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
      // between two rated points: interpolate log(R) — an estimate
      for (let i = 0; i < pts.length - 1; i++) {
        const [v0, r0] = pts[i], [v1, r1] = pts[i + 1];
        if (vgs >= v0 && vgs <= v1) {
          if (vgs === v0) return r0;
          ctx.est = true;
          const f = (vgs - v0) / (v1 - v0);
          return Math.exp(Math.log(r0) + f * (Math.log(r1) - Math.log(r0)));
        }
      }
      return NaN;
    };

    const tempFactor = (ctx: EvalCtx, tj: number): number => {
      if (tj === 25) return 1;
      if (tj > 400) { ctx.note = 'thermal runaway (junction temperature keeps rising)'; return NaN; }
      const curve = dsByRow[ctx.row]?.curves?.rds_on_norm_vs_tj;
      if (curve) {
        const at25 = interp(curve.points, 25, { extrapolate: 'linear' });
        return interp(curve.points, tj, { extrapolate: 'linear' }) / at25;
      }
      ctx.est = true;
      return Math.pow((tj + 273.15) / 298.15, alpha(ctx.row));
    };

    const vgsMax = col('gate-source-voltage-vgs-max');
    fns.rds_on = (ctx, a, named) => {
      const vgs = Math.abs(num(named.vgs ?? a[0], defaultDrive(ctx.row)));
      const tj = num(named.tj ?? a[1], 25);
      // a number here would be worse than none: the gate cannot be driven that hard
      const limit = vgsMax?.nv?.[ctx.row] ?? NaN;
      if (vgs > limit) { ctx.note = `${vgs} V exceeds the gate rating (±${limit} V)`; return NaN; }
      const r = rds25(ctx, vgs);
      if (Number.isNaN(r)) return NaN;
      return r * tempFactor(ctx, tj);
    };
    fns.rds_tempco = (ctx, a) => tempFactor(ctx, num(a[0], 100));
    fns.tj_max = (ctx) => tjMax(ctx.row);
    fns.rth_jc = (ctx) => {
      const v = dsByRow[ctx.row]?.scalars?.rth_jc;
      if (v !== undefined) return v;
      // Pd is normally rated at 25 °C: Rth ≈ (Tjmax − 25) / Pd. Whether that is
      // junction-to-case or junction-to-ambient depends on the package, hence "estimate".
      const p = pd?.nv?.[ctx.row] ?? NaN, t = tjMax(ctx.row);
      if (!(p > 0) || Number.isNaN(t)) { ctx.note = 'needs Pd and max junction temperature'; return NaN; }
      ctx.est = true;
      return (t - 25) / p;
    };
    fns.rth_ja = (ctx) => {
      const v = dsByRow[ctx.row]?.scalars?.rth_ja;
      if (v === undefined) { ctx.note = 'no datasheet Rth(j-a) for this part yet'; return NaN; }
      return v;
    };
    help.unshift(
      { sig: 'rds_on(vgs, tj)', text: 'On-resistance at a gate drive (V) and junction temperature (°C, default 25). Blank when vgs is above the gate rating. Uses the digitised datasheet curves when a part has them; otherwise the catalogue rating at the nearest rated drive at or below vgs, scaled by a generic temperature model (marked ≈).' },
      { sig: 'rth_jc()', text: 'Junction-to-case thermal resistance (°C/W). Datasheet value when available, otherwise estimated as (Tj max − 25) / Pd (marked ≈).' },
      { sig: 'rth_ja()', text: 'Junction-to-ambient thermal resistance (°C/W), datasheet-derived only.' },
      { sig: 'tj_max()', text: 'Maximum junction temperature (°C).' },
      { sig: 'rds_tempco(tj)', text: 'Rds(on) at tj relative to 25 °C.' },
    );
  }
  return { fns, help };
}

/** Which datasheet items each formula function draws on. */
const FN_NEEDS: Record<string, { scalars?: string[]; curves?: string[] }> = {
  rds_on: { curves: ['rds_on_vs_vgs', 'rds_on_norm_vs_tj'] },
  rds_tempco: { curves: ['rds_on_norm_vs_tj'] },
  rth_jc: { scalars: ['rth_jc', 'tj_max'] },
  rth_ja: { scalars: ['rth_ja'] },
  tj_max: { scalars: ['tj_max'] },
};

/**
 * The datasheet items a set of formulas actually uses, so a reading job can
 * ask for those and nothing else. Formulas that fail to parse are ignored.
 */
export function datasheetNeeds(exprs: string[]): { scalars: Set<string>; curves: Set<string> } {
  const scalars = new Set<string>(), curves = new Set<string>();
  const walk = (n: Node) => {
    switch (n.k) {
      case 'call': {
        const name = n.name.toLowerCase();
        const need = FN_NEEDS[name];
        need?.scalars?.forEach((s) => scalars.add(s));
        need?.curves?.forEach((c) => curves.add(c));
        const first = n.args[0];
        if (first?.k === 'str') { if (name === 'ds') scalars.add(first.v); if (name === 'curve') curves.add(first.v); }
        n.args.forEach(walk);
        Object.values(n.named).forEach(walk);
        break;
      }
      case 'un': walk(n.a); break;
      case 'bin': walk(n.a); walk(n.b); break;
      case 'cond': walk(n.c); walk(n.a); walk(n.b); break;
    }
  };
  for (const e of exprs) {
    try { walk(parse(e)); } catch { /* shown as an error in the formula editor */ }
  }
  return { scalars, curves };
}

export interface Preset {
  title: string;
  about: string;
  defs: { name: string; expr: string; unit?: string; show: boolean }[];
}

/** Ready-made sheets offered in the formula editor. */
export function presetsFor(catId: string): Preset[] {
  if (catId === 'transistors-and-thyristors-mosfets') {
    return [
      {
        title: 'Rds(on) at 12 V gate, 70 °C junction',
        about: 'On-resistance at a specific gate drive and junction temperature.',
        defs: [{ name: 'Rds_hot', expr: 'rds_on(12V, 70C)', unit: 'resistance', show: true }],
      },
      {
        title: 'Self-heating on a 1 °C/W heatsink',
        about: 'Solves junction temperature and on-resistance together: hotter silicon has more resistance, which makes more heat. Edit the current, ambient and heatsink numbers to match your design.',
        defs: [
          { name: 'I', expr: '10A', unit: 'current', show: false },
          { name: 'Rds', expr: 'rds_on(12V, Tj)', unit: 'resistance', show: true },
          { name: 'P', expr: 'I^2 * Rds', unit: 'power', show: true },
          { name: 'Tj', expr: '40C + P * (rth_jc() + 1)', unit: 'temperature', show: true },
        ],
      },
      {
        title: 'Switching figure of merit (Rds × Qg)',
        about: 'Lower is better for hard-switched converters.',
        defs: [{ name: 'FOM', expr: 'Rds_on * Qg * 1e12', unit: 'ratio', show: true }],
      },
      {
        title: 'Cost per amp',
        about: 'Unit price at 100 pcs divided by the continuous drain current.',
        defs: [{ name: 'USD_per_A', expr: 'price(100) / Id', unit: 'ratio', show: true }],
      },
    ];
  }
  return [
    {
      title: 'Price at 1000 pcs',
      about: 'Unit price at a fixed order quantity.',
      defs: [{ name: 'Price_1k', expr: 'price(1000)', unit: 'currency', show: true }],
    },
  ];
}
