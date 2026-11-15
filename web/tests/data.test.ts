import { describe, expect, it } from 'vitest';
import { GROUPS, buildTaxonomy } from '../../pipeline/taxonomy.mjs';
import { interp, validateRecord } from '@shared/recipes.js';
import { sanityCheck, toRecord } from '@shared/extract.js';
import { aliasOf } from '../src/lib/columns';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DsRecordLike } from '@shared/recipes.js';

describe('taxonomy', () => {
  it('never lists an upstream category twice', () => {
    expect(() => buildTaxonomy()).not.toThrow();
  });
  it('has unique merged category names within each group', () => {
    for (const [group, cats] of GROUPS) {
      const names = cats.map((c) => c[0]);
      expect(new Set(names).size, group).toBe(names.length);
    }
  });
  it('merges the MOSFET variants and tags the technology', () => {
    const t = buildTaxonomy();
    const si = t.resolve('Transistors and Thyristors', 'MOSFETs');
    const sic = t.resolve('Silicon Carbide (Si C) Devices', 'Silicon Carbide Field Effect Transistor (MOSFET)');
    expect(sic.id).toBe(si.id);
    expect(sic.tags).toEqual({ Technology: 'SiC' });
    expect(t.defaults(si.id)).toEqual({ Technology: 'Si' });
  });
  it('places unknown upstream categories instead of dropping them', () => {
    const p = buildTaxonomy().resolve('Resistors', 'Some Brand New Kind');
    expect(p.curated).toBe(false);
    expect(p.group).toBe('Resistors');
  });
});

describe('formula aliases', () => {
  it('prefers the symbol in parentheses', () => {
    expect(aliasOf('Drain-Source Voltage (Vdss)')).toBe('Vdss');
    expect(aliasOf('Continuous Drain Current (Id)')).toBe('Id');
    expect(aliasOf('Total Gate Charge (Qg)')).toBe('Qg');
    expect(aliasOf('Rds(on)')).toBe('Rds_on');
    expect(aliasOf('Gate Threshold Voltage (Vgs(th))')).toBe('Vgs_th');
    expect(aliasOf('Power Dissipation (Pd)')).toBe('Pd');
    expect(aliasOf('Rated Voltage')).toBe('Rated_Voltage');
  });
});

describe('datasheet records', () => {
  it('interpolates curves', () => {
    const pts: [number, number][] = [[0, 0], [10, 100], [20, 100]];
    expect(interp(pts, 5)).toBe(50);
    expect(interp(pts, 15)).toBe(100);
    expect(interp(pts, -5)).toBe(0);
    expect(interp(pts, -5, { extrapolate: 'linear' })).toBe(-50);
    expect(interp(pts, 30, { extrapolate: 'nan' })).toBeNaN();
  });

  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../datasheet-data');
  const files = readdirSync(dir, { recursive: true }).map(String).filter((f: string) => f.endsWith('.json'));
  it('ships at least one record', () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    it(`${f} is valid and plausible`, () => {
      const rec = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
      expect(validateRecord(rec)).toEqual([]);
      expect(sanityCheck(rec)).toEqual([]);
      expect(path.basename(f)).toBe(`${rec.lcsc}.json`);
      expect(rec.source.url).toMatch(/^https:\/\//);
    });
  }

  it('rejects records with the usual graph-reading mistakes', () => {
    const base: DsRecordLike = { lcsc: 'C1', recipe: 'mosfet', source: { url: 'https://example.com/x.pdf' } };
    expect(sanityCheck({ ...base, curves: { rds_on_vs_vgs: { points: [[2, 0.01], [10, 0.05]] } } })[0]).toMatch(/rises with gate voltage/);
    expect(sanityCheck({ ...base, curves: { rds_on_norm_vs_tj: { points: [[25, 18], [150, 30]] } } })[0]).toMatch(/normalised/);
    expect(sanityCheck({ ...base, scalars: { rth_jc: 60, rth_ja: 3 } })[0]).toMatch(/swapped/);
    expect(validateRecord({ ...base, curves: { rds_on_vs_vgs: { points: [[4, 1], [3, 2]] } } })[0]).toMatch(/must increase/);
    expect(validateRecord({ ...base, lcsc: '123', scalars: { tj_max: 150 } })[0]).toMatch(/lcsc/);
  });

  it('turns model output into a record, and refuses the wrong datasheet', () => {
    const part = { lcsc: 'C1', mfr: 'X1' };
    const out = {
      datasheet_matches_part: true, part_number_in_datasheet: 'X1', notes: '',
      scalars: [{ name: 'rth_jc', value: 2, condition: '', page: 1 }],
      curves: [{ name: 'rds_on_vs_vgs', figure: 'Fig 5', page: 3, conditions: 'Id = 1 A', x_axis: 'V lin', y_axis: 'Ω lin', points: [{ x: 10, y: 0.01 }, { x: 4, y: 0.02 }, { x: 4, y: 0.03 }] }],
    };
    const { record, problems } = toRecord(out, part, 'mosfet', { url: 'https://example.com/x.pdf' });
    expect(problems).toEqual([]);
    expect(record!.curves!.rds_on_vs_vgs.points).toEqual([[4, 0.02], [10, 0.01]]); // sorted, duplicate x dropped
    expect(record!.source.pages).toBe('1, 3');
    expect(toRecord({ ...out, datasheet_matches_part: false }, part, 'mosfet', { url: 'u' }).record).toBeNull();
  });
});
