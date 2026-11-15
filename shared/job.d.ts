import type { DsRecordLike } from './recipes';
export interface JobCriterion { name: string; key: string; unit?: string; kind: 'num' | 'range' | 'enum' | 'multi'; text: string; formula: boolean; examples?: string }
export interface JobPart { lcsc: string; mfr: string; manufacturer: string; package: string; values: string[]; unknown: string[]; datasheet: string }
export interface Job {
  site: string;
  searchUrl: string;
  created: string;
  category: { id: string; name: string };
  recipeKey: string;
  want: { scalars: string[]; curves: string[] };
  formulas: { name: string; expr: string }[];
  criteria: JobCriterion[];
  columns: { id: string; name: string; unit?: string }[];
  parts: JobPart[];
}
export function buildJob(job: Job): string;
export interface JobResult {
  accepted: DsRecordLike[];
  refused: { lcsc: string; problems: string[] }[];
  rejected: { lcsc: string; reason: string }[];
  unavailable: { lcsc: string; reason: string }[];
  warnings: string[];
}
export function parseJobResult(text: string, opts: { recipeKey: string; categoryId: string; knownLcsc?: (code: string) => boolean; today?: string }): JobResult;
