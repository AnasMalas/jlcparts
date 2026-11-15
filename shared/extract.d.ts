import type { DsRecordLike } from './recipes';
export const EXTRACT_MODEL: string;
export const SYSTEM_PROMPT: string;
export function makeSchema(z: unknown, recipeKey: string): unknown;
export function buildRequest(recipeKey: string, part: { lcsc: string; mfr: string; description?: string }): string;
export function sanityCheck(record: DsRecordLike): string[];
export function toRecord(
  output: unknown,
  part: { lcsc: string; mfr: string },
  recipeKey: string,
  meta: { url: string; retrieved?: string; method?: string },
): { record: DsRecordLike | null; problems: string[] };
export interface ExtractResult {
  record: DsRecordLike | null;
  problems: string[];
  usage?: { input_tokens: number; output_tokens: number };
  model?: string;
}
export function extractFromPdf(
  deps: { client: unknown; zodOutputFormat: unknown; z: unknown },
  args: { recipeKey: string; part: { lcsc: string; mfr: string; description?: string }; pdfBase64: string; url: string; method?: string },
): Promise<ExtractResult>;
