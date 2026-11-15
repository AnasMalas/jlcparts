import { describe, expect, it } from 'vitest';
import { compileSheet, parse, type Definition, type Env } from '../src/lib/formula';

const cols: Record<string, number[]> = { rds: [0.01, 0.02, 0.5], id: [10, 5, 1], pd: [50, 2, 0.3] };
const env: Env = {
  variable: (name) => { const c = cols[name.toLowerCase()]; return c ? (ctx) => c[ctx.row] : null; },
  functions: {
    // a silicon-like on-resistance that rises with temperature, flagged as an estimate
    rds_at: (ctx, a) => { ctx.est = true; return cols.rds[ctx.row] * ((Number(a[0]) + 273.15) / 298.15) ** 2; },
    nope: (ctx) => { ctx.note = 'no data'; return NaN; },
  },
  suggestions: () => Object.keys(cols),
};
const def = (name: string, expr: string, show = true): Definition => ({ id: name, name, expr, show });

function evalAll(defs: Definition[], row = 0) {
  const sheet = compileSheet(defs, env);
  const out = new Float64Array(defs.length);
  const flags = { est: new Uint8Array(defs.length), notes: new Array<string | null>(defs.length).fill(null) };
  sheet.evalRow(row, out, flags);
  return { out: Array.from(out), est: Array.from(flags.est), notes: flags.notes, errors: sheet.errors.map((e) => e?.message ?? null) };
}
const one = (expr: string, row = 0) => evalAll([def('x', expr)], row).out[0];

describe('expressions', () => {
  it('does arithmetic with the usual precedence', () => {
    expect(one('1 + 2 * 3')).toBe(7);
    expect(one('(1 + 2) * 3')).toBe(9);
    expect(one('2 ^ 3 ^ 2')).toBe(512);
    expect(one('-2 ^ 2')).toBe(-4);
    expect(one('10 / 4')).toBe(2.5);
  });
  it('understands SI suffixes and decorative units', () => {
    expect(one('10m')).toBeCloseTo(0.01);
    expect(one('4.7k')).toBeCloseTo(4700);
    expect(one('12V')).toBe(12);
    expect(one('70C')).toBe(70);
    expect(one('5mΩ * 2')).toBeCloseTo(0.01);
    expect(one('40°C + 1')).toBe(41);
  });
  it('reads parameters, by bare name or in brackets', () => {
    expect(one('rds * id ^ 2')).toBeCloseTo(1);
    expect(one('[rds] * 1000', 1)).toBeCloseTo(20);
  });
  it('supports comparisons, conditionals and functions', () => {
    expect(one('id > 3 ? 1 : 0', 0)).toBe(1);
    expect(one('if(id > 3, 1, 0)', 2)).toBe(0);
    expect(one('min(3, 1, 2) + max(3, 1, 2)')).toBe(4);
    expect(one('sqrt(16) + abs(-1)')).toBe(5);
    expect(one('coalesce(nope(), 7)')).toBe(7);
    expect(one('"N-Channel" == "n-channel"')).toBe(1);
  });
  it('ignores comments', () => {
    expect(one('1 + 1 # one and one')).toBe(2);
  });
  it('reports useful errors', () => {
    expect(evalAll([def('x', 'rdz * 2')]).errors[0]).toMatch(/Unknown name "rdz"/);
    expect(evalAll([def('x', 'foo(1)')]).errors[0]).toMatch(/Unknown function/);
    expect(evalAll([def('x', '1 +')]).errors[0]).toMatch(/incomplete/);
    expect(evalAll([def('x', '(1 + 2')]).errors[0]).toMatch(/Expected "\)"/);
    expect(evalAll([def('2x', '1')]).errors[0]).toMatch(/Name must/);
    expect(evalAll([def('a', '1'), def('A', '2')]).errors[1]).toMatch(/used twice/);
    expect(() => parse('1 $ 2')).toThrow();
  });
});

describe('sheets', () => {
  it('resolves definitions in any order', () => {
    const r = evalAll([def('p', 'i * i * rds'), def('i', '2 * id')]);
    expect(r.out[0]).toBeCloseTo(4);
    expect(r.out[1]).toBe(20);
  });
  it('propagates the estimate flag to dependants only', () => {
    const r = evalAll([def('r', 'rds_at(100)'), def('p', 'r * 4'), def('plain', 'rds * 4')]);
    expect(r.est).toEqual([1, 1, 0]);
  });
  it('explains missing values', () => {
    const r = evalAll([def('a', 'nope()'), def('b', 'a + 1')]);
    expect(r.out[0]).toBeNaN();
    expect(r.notes).toEqual(['no data', 'no data']);
  });
  it('marks definitions that depend on a broken one', () => {
    const r = evalAll([def('a', 'oops'), def('b', 'a + 1')]);
    expect(r.errors[1]).toMatch(/Depends on "a"/);
  });

  // The stretch goal: junction temperature and on-resistance depend on each other.
  const thermal = (amps: number, rth: number) => [
    def('Rds', 'rds_at(Tj)'),
    def('P', `${amps}^2 * Rds`),
    def('Tj', `40 + P * ${rth}`),
  ];
  it('solves a self-heating loop to a consistent operating point', () => {
    const r = evalAll(thermal(10, 20)); // 10 mΩ part
    const [rds, p, tj] = r.out;
    expect(tj).toBeGreaterThan(60);
    expect(tj).toBeLessThan(90);
    // the solution must satisfy every equation at once
    expect(rds).toBeCloseTo(0.01 * ((tj + 273.15) / 298.15) ** 2, 8);
    expect(p).toBeCloseTo(100 * rds, 8);
    expect(tj).toBeCloseTo(40 + p * 20, 5);
    expect(r.est).toEqual([1, 1, 1]);
  });
  it('reports thermal runaway instead of a number', () => {
    const r = evalAll(thermal(10, 20), 2); // 0.5 Ω part at 10 A: 50 W into 20 °C/W
    expect(r.out[2]).toBeNaN();
    expect(r.notes[2]).toMatch(/runs away|no stable/);
  });
  it('handles a definition that refers to itself', () => {
    const r = evalAll([def('x', '(x + 2 / x) / 2')]); // Newton iteration for sqrt(2)
    expect(r.out[0]).toBeCloseTo(Math.SQRT2, 6);
  });
});
