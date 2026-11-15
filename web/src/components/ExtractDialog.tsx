import { useState } from 'react';
import { saveLocalRecord, type DsRecord } from '../lib/dsdata';
import { extractWithClaude, keyIsRemembered, storeKey, storedKey } from '../lib/claude';
import { RECIPES, validateRecord } from '@shared/recipes.js';
import { EXTRACT_MODEL, sanityCheck } from '@shared/extract.js';
import { Dialog } from './ui';

function template(lcsc: string, mfr: string, recipeKey: string, datasheet: string | null): DsRecord {
  return {
    lcsc, mfr, recipe: recipeKey,
    source: { url: datasheet ?? '', retrieved: new Date().toISOString().slice(0, 10), method: 'read by hand', pages: '' },
    scalars: {},
    curves: {},
  };
}

/** Add or edit the datasheet-derived record of one part: by hand, or by letting Claude read the PDF. */
export function ExtractDialog(props: {
  lcsc: string; mfr: string; description: string; recipeKey: string; datasheet: string | null; existing: DsRecord | undefined;
  onClose: () => void; onSaved: () => void;
}) {
  const recipe = RECIPES[props.recipeKey];
  const [text, setText] = useState(() =>
    JSON.stringify({ ...(props.existing ?? template(props.lcsc, props.mfr, props.recipeKey, props.datasheet)), local: undefined }, null, 2),
  );
  const [problems, setProblems] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState(storedKey);
  const [remember, setRemember] = useState(keyIsRemembered);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const save = () => {
    let rec: DsRecord;
    try { rec = JSON.parse(text); } catch (e) { setProblems([`Not valid JSON: ${(e as Error).message}`]); return; }
    const p = [...validateRecord(rec), ...sanityCheck(rec)];
    if (p.length) { setProblems(p); return; }
    const q = saveLocalRecord(rec);
    if (q.length) { setProblems(q); return; }
    props.onSaved();
  };

  const run = async () => {
    if (!file || !apiKey.trim()) return;
    setBusy(true); setProblems([]); setStatus('Claude is reading the datasheet — this usually takes a minute or two…');
    storeKey(apiKey.trim(), remember);
    try {
      const res = await extractWithClaude({
        apiKey: apiKey.trim(), file, recipeKey: props.recipeKey,
        part: { lcsc: props.lcsc, mfr: props.mfr, description: props.description },
        url: props.datasheet ?? file.name,
      });
      if (res.record) {
        setText(JSON.stringify(res.record, null, 2));
        setStatus(`Done${res.usage ? ` (${res.usage.input_tokens.toLocaleString()} tokens in, ${res.usage.output_tokens.toLocaleString()} out)` : ''}. Check the numbers against the graphs, then save.`);
      } else setStatus(null);
      setProblems(res.problems);
    } catch (e) {
      setStatus(null);
      setProblems([`Extraction failed: ${(e as Error).message}`]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Datasheet data for ${props.mfr || props.lcsc}`}
      onClose={props.onClose}
      footer={<><button className="btn" onClick={props.onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={busy}>Save in this browser</button></>}
    >
      <h3>Let Claude read it</h3>
      <p>
        {props.datasheet
          ? <>Open the <a href={props.datasheet} target="_blank" rel="noreferrer">datasheet</a>, save the PDF, and choose it here. </>
          : <>Download the datasheet PDF from the manufacturer and choose it here. </>}
        It is sent, with your own Anthropic API key, straight from your browser to Anthropic ({EXTRACT_MODEL}) — not to this site.
        One datasheet costs a few cents of your API credit.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, alignItems: 'center' }}>
        <input className="input" type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Datasheet PDF" style={{ padding: 4 }} />
        <input className="input mono" type="password" placeholder="Anthropic API key (sk-ant-…)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" aria-label="Anthropic API key" />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={run} disabled={busy || !file || !apiKey.trim()}>{busy ? 'Reading…' : 'Extract'}</button>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember the key in this browser (otherwise it is forgotten when the tab closes)
        </label>
      </div>
      {status && <div className="note" style={{ marginTop: 8 }}>{status}</div>}

      <h3>Or enter it by hand</h3>
      <p className="muted" style={{ fontSize: 12.5 }}>
        Values are in SI base units (Ω, V, A, °C, °C/W). Curves are lists of <span className="mono">[x, y]</span> points with x increasing.
        Wanted for a {recipe.title}:{' '}
        {[...Object.entries(recipe.curves).map(([k, c]) => `curves.${k} (${c.label})`), ...Object.entries(recipe.scalars).map(([k, s]) => `scalars.${k} (${s.label})`)].join('; ')}.
      </p>
      <textarea className="input mono" rows={14} value={text} onChange={(e) => { setText(e.target.value); setProblems([]); }} spellCheck={false} aria-label="Record JSON" />
      {problems.length > 0 && (
        <div className="note bad" style={{ marginTop: 8 }}>
          {problems.map((p) => (<div key={p}>{p}</div>))}
        </div>
      )}
    </Dialog>
  );
}
