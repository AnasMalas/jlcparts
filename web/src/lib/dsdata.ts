// Datasheet-derived data: scalars and digitised curves that are not in the
// JLC/LCSC catalogue. Shared records ship with the site (built from the
// datasheet-data/ folder of the repository); records a visitor extracts
// themselves live in localStorage until they are contributed back.

import { validateRecord } from '@shared/recipes.js';

export interface DsCurve {
  cond?: Record<string, number | string>;
  points: [number, number][];
  note?: string;
}
export interface DsRecord {
  lcsc: string;
  mfr?: string;
  recipe: string;
  source: { url: string; retrieved?: string; method?: string; pages?: string; notes?: string };
  scalars?: Record<string, number>;
  curves?: Record<string, DsCurve>;
  /** true for records that only exist in this browser */
  local?: boolean;
}
export type DsMap = Map<number, DsRecord>;

const BASE = `${import.meta.env.BASE_URL}data/`;
const LOCAL_KEY = 'jlcparts.ds.v1';

function readLocal(): Record<string, DsRecord> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function saveLocalRecord(rec: DsRecord): string[] {
  const problems = validateRecord(rec);
  if (problems.length) return problems;
  const all = readLocal();
  all[rec.lcsc] = { ...rec, local: true };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  return [];
}
export function deleteLocalRecord(lcsc: string) {
  const all = readLocal();
  delete all[lcsc];
  localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
}
export function localRecords(): DsRecord[] {
  return Object.values(readLocal());
}

const cache = new Map<string, Promise<Record<string, DsRecord>>>();
async function fetchShared(catId: string): Promise<Record<string, DsRecord>> {
  let p = cache.get(catId);
  if (!p) {
    p = (async () => {
      try {
        const resp = await fetch(`${BASE}ds/${catId}.json`);
        if (!resp.ok) return {};
        return (await resp.json()).parts ?? {};
      } catch {
        return {};
      }
    })();
    cache.set(catId, p);
  }
  return p;
}

/** Shared records for a category, overlaid with this browser's own. */
export async function loadDsData(catId: string, hasShared: boolean): Promise<DsMap> {
  const map: DsMap = new Map();
  if (hasShared) {
    for (const rec of Object.values(await fetchShared(catId))) map.set(parseInt(rec.lcsc.slice(1), 10), rec);
  }
  for (const rec of localRecords()) map.set(parseInt(rec.lcsc.slice(1), 10), { ...rec, local: true });
  return map;
}
