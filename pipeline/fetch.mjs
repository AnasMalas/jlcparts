// Downloads the upstream component database (yaqwsx/jlcparts GitHub Pages data)
// into a local cache directory. Files are verified by sha256 and skipped when
// already present, so re-running is cheap.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_SOURCE = 'https://yaqwsx.github.io/jlcparts/data';

async function get(url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 1000 * (i + 1) ** 2));
    }
  }
  throw new Error(`GET ${url} failed: ${lastErr?.message}`);
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

export async function fetchUpstream({ source = DEFAULT_SOURCE, cacheDir, workers = 16, log = console.log }) {
  await mkdir(cacheDir, { recursive: true });
  log(`Fetching manifest from ${source}`);
  const manifestBuf = await get(`${source}/manifest.json`);
  await writeFile(path.join(cacheDir, 'manifest.json'), manifestBuf);
  const manifest = JSON.parse(manifestBuf.toString('utf8'));

  const wanted = [manifest.attributesLut];
  for (const cat of manifest.categories) wanted.push(...cat.shards);

  let done = 0, downloaded = 0;
  const queue = wanted.slice();
  async function worker() {
    for (;;) {
      const name = queue.shift();
      if (!name) return;
      const dest = path.join(cacheDir, name);
      const want = manifest.files?.[name]?.sha256;
      let ok = false;
      if (await exists(dest)) {
        ok = !want || sha256(await readFile(dest)) === want;
      }
      if (!ok) {
        const buf = await get(`${source}/${name}`);
        if (want && sha256(buf) !== want) throw new Error(`Checksum mismatch for ${name}`);
        await writeFile(dest, buf);
        downloaded++;
      }
      done++;
      if (done % 200 === 0 || done === wanted.length) log(`  ${done}/${wanted.length} files (${downloaded} downloaded)`);
    }
  }
  await Promise.all(Array.from({ length: workers }, worker));
  return manifest;
}
