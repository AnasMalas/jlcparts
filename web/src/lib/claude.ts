// Reading a datasheet with Claude, straight from the browser, using the
// visitor's own Anthropic API key. Nothing goes through this site: the PDF
// and the key travel only to api.anthropic.com. The SDK is loaded on demand
// so visitors who never use this do not download it.

import { extractFromPdf, type ExtractResult } from '@shared/extract.js';

const KEY_STORE = 'jlcparts.anthropicKey';

export function storedKey(): string {
  try { return sessionStorage.getItem(KEY_STORE) ?? localStorage.getItem(KEY_STORE) ?? ''; } catch { return ''; }
}
export function storeKey(key: string, remember: boolean) {
  try {
    sessionStorage.setItem(KEY_STORE, key);
    if (remember) localStorage.setItem(KEY_STORE, key); else localStorage.removeItem(KEY_STORE);
  } catch { /* storage unavailable */ }
}
export function keyIsRemembered(): boolean {
  try { return localStorage.getItem(KEY_STORE) !== null; } catch { return false; }
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

export const MAX_PDF_BYTES = 22 * 1024 * 1024;

export async function extractWithClaude(args: {
  apiKey: string;
  file: File;
  recipeKey: string;
  part: { lcsc: string; mfr: string; description?: string };
  url: string;
}): Promise<ExtractResult> {
  if (args.file.size > MAX_PDF_BYTES) return { record: null, problems: [`That PDF is ${(args.file.size / 1e6).toFixed(1)} MB; the limit for one request is about 22 MB.`] };
  const head = new Uint8Array(await args.file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== '%PDF-') return { record: null, problems: ['That file is not a PDF.'] };

  const [{ default: Anthropic }, { zodOutputFormat }, { z }] = await Promise.all([
    import('@anthropic-ai/sdk'),
    import('@anthropic-ai/sdk/helpers/zod'),
    import('zod'),
  ]);
  // Calling the API from a browser exposes the key to this page, which is why
  // the SDK asks for an explicit opt-in. Here that is the point: it is the
  // visitor's own key, typed by them, used only for their own request.
  const client = new Anthropic({ apiKey: args.apiKey, dangerouslyAllowBrowser: true });
  try {
    return await extractFromPdf(
      { client, zodOutputFormat, z },
      { recipeKey: args.recipeKey, part: args.part, pdfBase64: await toBase64(args.file), url: args.url },
    );
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { record: null, problems: ['Anthropic rejected that API key.'] };
    if (e instanceof Anthropic.PermissionDeniedError) return { record: null, problems: ['That API key is not allowed to use this model.'] };
    if (e instanceof Anthropic.RateLimitError) return { record: null, problems: ['Rate limited by Anthropic — wait a minute and try again.'] };
    if (e instanceof Anthropic.BadRequestError) return { record: null, problems: [`Anthropic rejected the request: ${e.message}`] };
    if (e instanceof Anthropic.APIConnectionError) return { record: null, problems: ['Could not reach api.anthropic.com. Check your connection or any content blocker.'] };
    if (e instanceof Anthropic.APIError) return { record: null, problems: [`Anthropic API error ${e.status}: ${e.message}`] };
    throw e;
  }
}
