import { describe, expect, it } from 'vitest';
import type { Category, Column } from '../src/lib/data';
import { run, sortRows, type EnumFacet, type Filters, type NumFacet } from '../src/lib/engine';

// Six made-up FETs: enough to see facets interact.
const type: Column = { id: 'type', name: 'FET Type', kind: 'enum', n: 6, dict: ['N', 'P'], ev: Int32Array.from([0, 0, 0, 1, 1, -1]) };
const rds: Column = { id: 'rds', name: 'Rds', kind: 'num', n: 6, unit: 'resistance', nv: Float64Array.from([0.005, 0.02, 0.1, 0.05, 0.2, NaN]), alt: { 1: [0.03] } };
const pkg: Column = { id: 'pkg', name: 'Package', kind: 'enum', n: 6, dict: ['SOT-23', 'TO-252'], ev: Int32Array.from([0, 1, 0, 0, 1, 0]) };
const feat: Column = { id: 'feat', name: 'Features', kind: 'multi', n: 4, dict: ['ESD', 'AEC', 'Logic'], mv: [[0, 2], [0], 0, [1, 2], [0, 1, 2], 0] };
const temp: Column = { id: 'temp', name: 'Temp', kind: 'range', n: 6, unit: 'temperature', lo: Float64Array.from([-55, -40, -40, -55, 0, NaN]), hi: Float64Array.from([150, 125, 85, 175, 70, NaN]) };
const cols = [type, rds, pkg, feat, temp];
const cat = {
  id: 't', name: 'T', group: 'G', n: 6,
  lcsc: Int32Array.from([1, 2, 3, 4, 5, 6]),
  mfr: ['AO3400', 'IRF540', 'BSS138', 'AO3401', 'IRF9540', 'MYSTERY'],
  desc: ['30V n', '100V n', '50V n logic', '30V p', '100V p', ''],
  stock: Int32Array.from([9, 8, 7, 6, 5, 4]), cls: new Uint8Array(6), joints: new Int32Array(6),
  ds: [], price: [], img: {}, url: {}, attrs: cols, rowOf: new Map(),
} as unknown as Category;

const go = (filters: Filters, extra = {}) => run(cat, cols, filters, extra, cols, new Set(['rds']));
const counts = (r: ReturnType<typeof go>, id: string) => Array.from((r.facets.get(id) as EnumFacet).counts);

describe('faceted filtering', () => {
  it('returns everything with no filters', () => {
    const r = go({});
    expect(r.rows.length).toBe(6);
    expect(counts(r, 'type')).toEqual([3, 2]);
  });

  it('narrows other facets to what is still available', () => {
    const r = go({ type: { kind: 'set', sel: [1] } }); // P-channel
    expect(Array.from(r.rows)).toEqual([3, 4]);
    const f = r.facets.get('rds') as NumFacet;
    expect(f.min).toBe(0.05); // N-channel-only resistances are gone
    expect(f.max).toBe(0.2);
    expect(f.values).toEqual([[0.05, 1], [0.2, 1]]);
    expect(counts(r, 'pkg')).toEqual([1, 1]);
  });

  it('keeps the filtered facet open so a second value can be added', () => {
    const r = go({ type: { kind: 'set', sel: [1] } });
    expect(counts(r, 'type')).toEqual([3, 2]); // N still offered, with its count
  });

  it('counts each facet against all the other filters', () => {
    const r = go({ type: { kind: 'set', sel: [0] }, pkg: { kind: 'set', sel: [0] } });
    expect(Array.from(r.rows)).toEqual([0, 2]);
    expect(counts(r, 'type')).toEqual([2, 1]); // within SOT-23
    expect(counts(r, 'pkg')).toEqual([2, 1]); // within N-channel
  });

  it('treats several values in one filter as OR', () => {
    expect(go({ pkg: { kind: 'set', sel: [0, 1] } }).rows.length).toBe(6);
  });

  it('filters numbers by min, max and picked values', () => {
    expect(Array.from(go({ rds: { kind: 'num', max: 0.02 } }).rows)).toEqual([0, 1]);
    expect(Array.from(go({ rds: { kind: 'num', min: 0.05, max: 0.1 } }).rows)).toEqual([2, 3]);
    expect(Array.from(go({ rds: { kind: 'num', vals: [0.1, 0.2] } }).rows)).toEqual([2, 4]);
    // a part with several ratings matches if any of them is in range
    expect(Array.from(go({ rds: { kind: 'num', min: 0.025, max: 0.035 } }).rows)).toEqual([1]);
  });

  it('never matches parts that lack the value', () => {
    expect(Array.from(go({ rds: { kind: 'num', min: 0 } }).rows)).not.toContain(5);
  });

  it('tolerates floating-point noise at the boundaries', () => {
    expect(Array.from(go({ rds: { kind: 'num', min: 0.1 + 1e-17, max: 0.1 - 1e-17 } }).rows)).toEqual([2]);
  });

  it('requires a range parameter to cover what was asked', () => {
    expect(Array.from(go({ temp: { kind: 'range', lo: -40, hi: 125 } }).rows)).toEqual([0, 1, 3]);
    expect(Array.from(go({ temp: { kind: 'range', hi: 150 } }).rows)).toEqual([0, 3]);
  });

  it('matches any or all of several multi-value options', () => {
    expect(Array.from(go({ feat: { kind: 'set', sel: [0, 1] } }).rows)).toEqual([0, 1, 3, 4]);
    expect(Array.from(go({ feat: { kind: 'set', sel: [0, 1], all: true } }).rows)).toEqual([4]);
  });

  it('searches text across part number and description', () => {
    expect(Array.from(go({}, { text: 'irf 100v' }).rows)).toEqual([1, 4]);
    expect(Array.from(go({}, { text: 'c3' }).rows)).toEqual([2]);
  });

  it('restricts to favourites', () => {
    expect(Array.from(go({}, { only: new Set([2, 5]) }).rows)).toEqual([1, 4]);
  });
});

describe('sorting', () => {
  const all = Int32Array.from([0, 1, 2, 3, 4, 5]);
  it('sorts numbers and keeps missing values last in both directions', () => {
    expect(Array.from(sortRows(cat, all, rds, 'rds', false))).toEqual([0, 1, 3, 2, 4, 5]);
    expect(Array.from(sortRows(cat, all, rds, 'rds', true))).toEqual([4, 2, 3, 1, 0, 5]);
  });
  it('sorts part numbers naturally', () => {
    expect(Array.from(sortRows(cat, all, null, 'mfr', false)).map((r) => cat.mfr[r])).toEqual(['AO3400', 'AO3401', 'BSS138', 'IRF540', 'IRF9540', 'MYSTERY']);
  });
});
