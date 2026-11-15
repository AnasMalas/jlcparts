import { describe, expect, it } from 'vitest';
import { buildJob, parseJobResult, type Job } from '@shared/job.js';
import { validateRecord } from '@shared/recipes.js';
import type { Category, Column } from '../src/lib/data';
import { classify } from '../src/lib/engine';
import { applyParams } from '../src/lib/columns';
import { datasheetNeeds } from '../src/lib/models';
import type { DsMap, DsRecord } from '../src/lib/dsdata';

const job: Job = {
  site: 'https://example.test/jlcparts/',
  searchUrl: 'https://example.test/jlcparts/#/c/x',
  created: '2026-11-15',
  category: { id: 'transistors-and-thyristors-mosfets', name: 'MOSFETs' },
  recipeKey: 'mosfet',
  want: { curves: ['rds_on_vs_vgs', 'rds_on_norm_vs_tj'], scalars: ['rth_jc', 'tj_max'] },
  formulas: [{ name: 'Rds', expr: 'rds_on(12V, Tj)' }, { name: 'Tj', expr: '40C + 100 * Rds * (rth_jc() + 1)' }],
  criteria: [
    { name: 'Rds(on)', key: 'rds-on', unit: 'resistance', kind: 'num', text: '≤ 50 mΩ', formula: false },
    { name: 'Tj', key: '$f:tj', unit: 'temperature', kind: 'num', text: '≤ 100 °C', formula: true },
  ],
  columns: [{ id: 'rds-on', name: 'Rds(on)', unit: 'resistance' }, { id: 'vdss', name: 'Vdss', unit: 'voltage' }],
  parts: [
    { lcsc: 'C1', mfr: 'AAA,1', manufacturer: 'Acme "Semi"', package: 'SOT-23', values: ['18 mΩ @ 10 V', '30 V'], unknown: [], datasheet: 'https://example.test/a.pdf' },
    { lcsc: 'C2', mfr: 'BBB2', manufacturer: 'Beta', package: 'TO-252', values: ['', '40 V'], unknown: ['rds-on'], datasheet: '' },
  ],
};

describe('job file', () => {
  const text = buildJob(job);
  it('carries the formulas, the requirements and exactly the requested items', () => {
    expect(text).toContain('Rds = rds_on(12V, Tj)');
    expect(text).toContain('- Rds(on): ≤ 50 mΩ');
    expect(text).toMatch(/Tj: ≤ 100 °C \(a calculated value/);
    expect(text).toContain('`rds_on_vs_vgs`');
    expect(text).toContain('`rth_jc`');
    expect(text).not.toContain('`qg_typ`'); // not asked for
  });
  it('lists parts as CSV, quoting awkward fields and flagging blanks to check', () => {
    expect(text).toContain('lcsc,part_number,manufacturer,package,Rds(on),Vdss,check,datasheet');
    expect(text).toContain('C1,"AAA,1","Acme ""Semi""",SOT-23,18 mΩ @ 10 V,30 V,,https://example.test/a.pdf');
    expect(text).toContain('C2,BBB2,Beta,TO-252,,40 V,rds-on,');
    expect(text).toMatch(/1 of the parts have a blank/);
  });
  it('states shared values once and abbreviates catalogue file links', () => {
    const jlc = 'https://jlcpcb.com/api/file/downloadByFileSystemAccessId/';
    const parts = [1, 2, 3, 4].map((i) => ({ lcsc: `C${i}`, mfr: `P${i}`, manufacturer: 'Acme', package: i < 3 ? 'SOT-23' : 'DFN', values: ['1 Ω', '30 V'], unknown: [], datasheet: `${jlc}99${i}` }));
    const t = buildJob({ ...job, parts });
    expect(t).toContain('The same for every part, so not repeated below: manufacturer = Acme; Rds(on) = 1 Ω; Vdss = 30 V.');
    expect(t).toContain('lcsc,part_number,package,check,datasheet');
    expect(t).toContain('C1,P1,SOT-23,,jlc:991');
    expect(t).toContain('`jlc:<id>` stands for ' + jlc + '<id>');
  });
  it('writes curve points one pair per line item, not one number per line', () => {
    expect(text).toContain('"points": [[2.5, 0.024], [4.5, 0.019], [10, 0.018]]');
  });
  it('documents params keys only for catalogue parameters', () => {
    expect(text).toContain('- `rds-on`: Rds(on) (number in Ω)');
    expect(text).not.toContain('`$f:tj`');
  });
  it('shows an answer example that the importer itself accepts', () => {
    const example = /## Answer format[\s\S]*?```json\n([\s\S]*?)```/.exec(text)![1];
    const res = parseJobResult(example, { recipeKey: 'mosfet', categoryId: job.category.id });
    expect(res.warnings).toEqual([]);
    expect(res.refused).toEqual([]);
    expect(res.accepted).toHaveLength(1);
  });
});

describe('importing an answer', () => {
  const opts = { recipeKey: 'mosfet', categoryId: 'transistors-and-thyristors-mosfets', knownLcsc: (c: string) => c === 'C1' || c === 'C2', today: '2026-11-15' };
  const good = {
    lcsc: 'c1', mfr: 'AAA', source: { url: 'https://mfr.test/aaa.pdf', pages: '3' },
    scalars: { rth_jc: 2.5 }, curves: { rds_on_vs_vgs: { points: [[4.5, 0.02], [10, 0.015]] } },
  };
  it('accepts a fenced answer with prose around it and fills in defaults', () => {
    const res = parseJobResult('Here you go:\n```json\n' + JSON.stringify({ records: [good], rejected: [{ lcsc: 'c2', reason: 'Rds 80 mΩ' }] }) + '\n```\nDone.', opts);
    expect(res.accepted).toHaveLength(1);
    expect(res.accepted[0].lcsc).toBe('C1');
    expect(res.accepted[0].recipe).toBe('mosfet');
    expect(res.accepted[0].source.retrieved).toBe('2026-11-15');
    expect(res.rejected).toEqual([{ lcsc: 'C2', reason: 'Rds 80 mΩ' }]);
  });
  it('accepts a params-only record (a rejected part whose catalogue gap is now known)', () => {
    const res = parseJobResult(JSON.stringify({ records: [{ lcsc: 'C2', source: { url: 'https://mfr.test/b.pdf' }, params: { 'rds-on': 0.08 } }] }), opts);
    expect(res.accepted).toHaveLength(1);
    expect(validateRecord(res.accepted[0])).toEqual([]);
  });
  it('refuses implausible, unknown, duplicate and source-less records, keeping the good ones', () => {
    const res = parseJobResult(JSON.stringify({ records: [
      good,
      { ...good, lcsc: 'C2', curves: { rds_on_vs_vgs: { points: [[2, 0.01], [10, 0.05]] } } }, // rises with Vgs
      { ...good, lcsc: 'C999' },
      { ...good },
      { lcsc: 'C2', scalars: { rth_jc: 1 } },
      { lcsc: 'C2', source: { url: 'ftp://x' }, scalars: { made_up: 1 } },
    ] }), opts);
    expect(res.accepted.map((r) => r.lcsc)).toEqual(['C1']);
    const why = res.refused.map((r) => r.problems.join(' | '));
    expect(why[0]).toMatch(/rises with gate voltage/);
    expect(why[1]).toMatch(/not in the open category/);
    expect(why[2]).toMatch(/listed twice/);
    expect(why[3]).toMatch(/source\.url is required/);
    expect(why[4]).toMatch(/unknown scalar "made_up"/);
  });
  it('explains unusable input instead of throwing', () => {
    expect(parseJobResult('sorry, I cannot do that', opts).warnings[0]).toMatch(/Could not read/);
    expect(parseJobResult('{"hello": 1}', opts).warnings[0]).toMatch(/no "records"/);
    expect(parseJobResult(JSON.stringify({ job: { category: 'other' }, records: [] }), opts).warnings[0]).toMatch(/made for the category/);
  });
});

describe('under-labelled parts and gap filling', () => {
  const type: Column = { id: 'type', name: 'Type', kind: 'enum', n: 4, dict: ['N', 'P'], ev: Int32Array.from([0, 0, -1, 1]) };
  const rds: Column = { id: 'rds-on', name: 'Rds(on)', kind: 'num', n: 3, unit: 'resistance', nv: Float64Array.from([0.01, NaN, 0.02, 0.5]) };
  const cols = [type, rds];
  const cat = { id: 't', n: 4, lcsc: Int32Array.from([1, 2, 3, 4]), mfr: ['a', 'b', 'c', 'd'], desc: ['', '', '', ''], attrs: cols, rowOf: new Map([[1, 0], [2, 1], [3, 2], [4, 3]]) } as unknown as Category;
  const filters = { type: { kind: 'set' as const, sel: [0] }, 'rds-on': { kind: 'num' as const, max: 0.05 } };

  it('separates parts that fit, parts that fail, and parts the catalogue cannot judge', () => {
    const r = classify(cat, cols, filters, {});
    expect(r.match).toEqual([0]);
    expect(r.unknown).toEqual([{ row: 1, missing: ['rds-on'] }, { row: 2, missing: ['type'] }]);
    // row 3 is known to fail (P-channel, 0.5 Ω): not "unknown"
  });

  it('fills blanks from datasheet records without touching catalogue values or the cached category', () => {
    const ds: DsMap = new Map<number, DsRecord>([
      [2, { lcsc: 'C2', recipe: 'mosfet', source: { url: 'u' }, params: { 'rds-on': 0.03, nonsense: 1 } }],
      [1, { lcsc: 'C1', recipe: 'mosfet', source: { url: 'u' }, params: { 'rds-on': 99 } }], // catalogue already says 0.01
      [3, { lcsc: 'C3', recipe: 'mosfet', source: { url: 'u' }, params: { type: 'n' } }],
    ]);
    const patched = applyParams(cat, ds);
    const prds = patched.find((c) => c.id === 'rds-on')!;
    expect(Array.from(prds.nv!)).toEqual([0.01, 0.03, 0.02, 0.5]);
    expect(Array.from(prds.filled!)).toEqual([0, 1, 0, 0]);
    expect(patched.find((c) => c.id === 'type')!.ev![2]).toBe(0); // matched case-insensitively to "N"
    expect(Number.isNaN(rds.nv![1])).toBe(true); // original untouched
    expect(classify(cat, patched, filters, {}).match).toEqual([0, 1, 2]);
    expect(applyParams(cat, new Map())).toBe(cat.attrs); // nothing to fill: same array, no copies
  });
});

describe('what formulas need from datasheets', () => {
  it('asks only for what is used', () => {
    const n = datasheetNeeds(['rds_on(12V, Tj)', '40 + P * (rth_jc() + 1)', 'I^2 * Rds']);
    expect([...n.curves].sort()).toEqual(['rds_on_norm_vs_tj', 'rds_on_vs_vgs']);
    expect([...n.scalars].sort()).toEqual(['rth_jc', 'tj_max']);
  });
  it('sees ds() and curve() names, and ignores broken or unrelated formulas', () => {
    const n = datasheetNeeds(['ds("qg_typ") * 2', 'curve("rds_on_vs_vgs", 5)', 'price(100) / Id', '1 +']);
    expect([...n.scalars]).toEqual(['qg_typ']);
    expect([...n.curves]).toEqual(['rds_on_vs_vgs']);
  });
});
