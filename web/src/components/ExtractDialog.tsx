import { useState } from 'react';
import { saveLocalRecord, type DsRecord } from '../lib/dsdata';
import { RECIPES, validateRecord } from '@shared/recipes.js';
import { Dialog } from './ui';

function template(lcsc: string, mfr: string, recipeKey: string, datasheet: string | null): DsRecord {
  return {
    lcsc, mfr, recipe: recipeKey,
    source: { url: datasheet ?? '', retrieved: new Date().toISOString().slice(0, 10), method: 'read by hand', pages: '' },
    scalars: {},
    curves: {},
  };
}

/** Add or edit the datasheet-derived record of one part. */
export function ExtractDialog(props: {
  lcsc: string; mfr: string; recipeKey: string; datasheet: string | null; existing: DsRecord | undefined;
  onClose: () => void; onSaved: () => void;
}) {
  const recipe = RECIPES[props.recipeKey];
  const [text, setText] = useState(() =>
    JSON.stringify({ ...(props.existing ?? template(props.lcsc, props.mfr, props.recipeKey, props.datasheet)), local: undefined }, null, 2),
  );
  const [problems, setProblems] = useState<string[]>([]);

  const save = () => {
    let rec: DsRecord;
    try { rec = JSON.parse(text); } catch (e) { setProblems([`Not valid JSON: ${(e as Error).message}`]); return; }
    const p = validateRecord(rec);
    if (p.length) { setProblems(p); return; }
    const q = saveLocalRecord(rec);
    if (q.length) { setProblems(q); return; }
    props.onSaved();
  };

  return (
    <Dialog
      title={`Datasheet data for ${props.mfr || props.lcsc}`}
      onClose={props.onClose}
      footer={<><button className="btn" onClick={props.onClose}>Cancel</button><button className="btn primary" onClick={save}>Save in this browser</button></>}
    >
      <p>
        Values go in SI base units (Ω, V, A, °C, °C/W). Curves are lists of <span className="mono">[x, y]</span> points read off the
        graph, with x increasing. {props.datasheet && <>Open the <a href={props.datasheet} target="_blank" rel="noreferrer">datasheet</a> alongside.</>}
      </p>
      <h3>What to read for a {recipe.title}</h3>
      <ul>
        {Object.entries(recipe.curves).map(([k, c]) => (<li key={k}><span className="mono">curves.{k}</span> — {c.label}. <span className="muted">{c.hint}</span></li>))}
        {Object.entries(recipe.scalars).map(([k, s]) => (<li key={k}><span className="mono">scalars.{k}</span> — {s.label}</li>))}
      </ul>
      <textarea className="input mono" rows={16} value={text} onChange={(e) => { setText(e.target.value); setProblems([]); }} spellCheck={false} aria-label="Record JSON" />
      {problems.length > 0 && (
        <div className="note bad" style={{ marginTop: 8 }}>
          {problems.map((p) => (<div key={p}>{p}</div>))}
        </div>
      )}
    </Dialog>
  );
}
