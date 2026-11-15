import { useMemo, useState } from 'react';
import { datasheetUrl, type Category, type Column } from '../lib/data';
import { clearLocalRecords, exportBundle, localRecords, saveLocalRecords, type DsMap, type DsRecord } from '../lib/dsdata';
import { classify, isActive, type Filters } from '../lib/engine';
import { cellText, describeFilter } from '../lib/format';
import { datasheetNeeds } from '../lib/models';
import type { Sheet } from '../lib/store';
import { RECIPES } from '@shared/recipes.js';
import { buildJob, parseJobResult, type JobResult } from '@shared/job.js';
import { Dialog, Icon, fmtInt } from './ui';
import { REPO_URL } from './About';

function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/**
 * Datasheet jobs: write a file that tells any LLM exactly what to read from
 * which datasheets, and import what it sends back.
 */
export function JobDialog(props: {
  cat: Category;
  recipeKey: string;
  attrs: Column[];
  allCols: Column[];
  filters: Filters;
  text: string;
  only: Set<number> | null;
  /** matching rows in the order the table shows them */
  sorted: Int32Array;
  sheet: Sheet;
  ds: DsMap;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { cat, recipeKey, attrs, allCols, ds } = props;
  const recipe = RECIPES[recipeKey];
  const [tab, setTab] = useState<'export' | 'import'>('export');

  // ---------------------------------------------------------------- export
  const groups = useMemo(() => classify(cat, allCols, props.filters, { text: props.text, only: props.only }), [cat, allCols, props.filters, props.text, props.only]);
  const hasData = (row: number) => {
    const rec = ds.get(cat.lcsc[row]);
    return !!rec && (Object.keys(rec.curves ?? {}).length > 0 || Object.keys(rec.scalars ?? {}).length > 0);
  };

  const formulas = props.sheet.filter((d) => d.expr.trim());
  const needs = useMemo(() => datasheetNeeds(formulas.map((d) => d.expr)), [formulas]);
  const [want, setWant] = useState<Set<string>>(() => {
    const picked = new Set<string>();
    for (const c of Object.keys(recipe.curves)) if (needs.curves.has(c)) picked.add(`c:${c}`);
    for (const s of Object.keys(recipe.scalars)) if (needs.scalars.has(s)) picked.add(`s:${s}`);
    if (!picked.size) {
      // no formula says what is needed: ask for the curves and the thermal data
      for (const c of Object.keys(recipe.curves)) picked.add(`c:${c}`);
      for (const s of ['rth_jc', 'rth_ja', 'tj_max']) if (recipe.scalars[s]) picked.add(`s:${s}`);
    }
    return picked;
  });
  const toggleWant = (k: string) => setWant((w) => { const n = new Set(w); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const [scope, setScope] = useState<'match' | 'all'>('match');
  const [skipDone, setSkipDone] = useState(true);
  const [limit, setLimit] = useState(40);
  const [copied, setCopied] = useState(false);

  const criteriaCols = allCols.filter((c) => !c.builtin && isActive(props.filters[c.id]));
  const unknownByRow = useMemo(() => new Map(groups.unknown.map((u) => [u.row, u.missing])), [groups]);

  const candidates = useMemo(() => {
    const rows: number[] = Array.from(props.sorted);
    if (scope === 'all') for (const u of groups.unknown) rows.push(u.row);
    return skipDone ? rows.filter((r) => !hasData(r)) : rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sorted, groups, scope, skipDone, ds]);
  const chosen = candidates.slice(0, Math.max(1, limit));
  const alreadyDone = Array.from(props.sorted).filter(hasData).length;

  const jobText = useMemo(() => {
    const mfg = attrs.find((a) => a.id === 'manufacturer');
    const pkg = attrs.find((a) => a.id === 'package');
    const catalogueCriteria = criteriaCols.filter((c) => !c.computed && c.id !== 'manufacturer' && c.id !== 'package');
    // per part: the parameters being filtered on, plus the category's leading ones for cross-checking
    const shown: Column[] = [...catalogueCriteria];
    for (const c of attrs) {
      if (shown.length >= catalogueCriteria.length + 5) break;
      if (c.rare || c.id === 'manufacturer' || c.id === 'package' || c.name === 'Original Category' || shown.includes(c)) continue;
      shown.push(c);
    }
    return buildJob({
      site: location.origin + location.pathname,
      searchUrl: location.href,
      created: new Date().toISOString().slice(0, 10),
      category: { id: cat.id, name: cat.name },
      recipeKey,
      want: {
        curves: Object.keys(recipe.curves).filter((c) => want.has(`c:${c}`)),
        scalars: Object.keys(recipe.scalars).filter((s) => want.has(`s:${s}`)),
      },
      formulas: formulas.map((d) => ({ name: d.name, expr: d.expr })),
      criteria: criteriaCols.map((c) => ({
        name: c.name, key: c.id, unit: c.unit, kind: c.kind, formula: !!c.computed,
        text: describeFilter(c, props.filters[c.id]),
        examples: c.dict?.slice(0, 3).map((d) => `"${d}"`).join(', '),
      })),
      columns: shown.map((c) => ({ id: c.id, name: c.name, unit: c.unit })),
      parts: chosen.map((r) => ({
        lcsc: `C${cat.lcsc[r]}`,
        mfr: cat.mfr[r],
        manufacturer: mfg ? cellText(mfg, r) : '',
        package: pkg ? cellText(pkg, r) : '',
        values: shown.map((c) => cellText(c, r)),
        unknown: (unknownByRow.get(r) ?? []).filter((id) => !id.startsWith('$')),
        datasheet: datasheetUrl(cat.ds[r]) ?? '',
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen.join(','), want, criteriaCols.map((c) => c.id).join(','), formulas.map((f) => f.expr).join('|')]);

  const fileName = `datasheet-job-${cat.id}-${chosen.length}-parts.md`;
  const nothingWanted = want.size === 0 && !(scope === 'all' && groups.unknown.length);

  // ---------------------------------------------------------------- import
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<JobResult | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [localCount, setLocalCount] = useState(() => localRecords().filter((r) => r.recipe === recipeKey).length);

  const check = (text: string) => {
    setSaved(null);
    setResult(text.trim() ? parseJobResult(text, { recipeKey, categoryId: cat.id, knownLcsc: (code) => cat.rowOf.has(parseInt(code.slice(1), 10)) }) : null);
  };
  const save = () => {
    if (!result?.accepted.length) return;
    const n = saveLocalRecords(result.accepted as DsRecord[]);
    setSaved(n);
    setLocalCount(localRecords().filter((r) => r.recipe === recipeKey).length);
    props.onChanged();
  };
  const mfrOf = (code: string) => { const r = cat.rowOf.get(parseInt(code.slice(1), 10)); return r === undefined ? '' : cat.mfr[r]; };

  return (
    <Dialog title={`Datasheet job — ${cat.name}`} onClose={props.onClose}>
      <p>
        The catalogue does not contain what is in the datasheet graphs. A job file tells any LLM (Claude, ChatGPT, a local
        model) exactly what to read for a list of parts and how to answer; you import the answer and your formulas use the real
        curves instead of estimates. Nothing is sent anywhere by this site.
      </p>
      <div className="seg big" role="tablist" style={{ marginBottom: 12 }}>
        <button role="tab" aria-selected={tab === 'export'} className={tab === 'export' ? 'on' : ''} onClick={() => setTab('export')}>1 · Write a job file</button>
        <button role="tab" aria-selected={tab === 'import'} className={tab === 'import' ? 'on' : ''} onClick={() => setTab('import')}>2 · Import the answer</button>
      </div>

      {tab === 'export' && (
        <>
          <h3>Which parts</h3>
          <label className="radio">
            <input type="radio" checked={scope === 'match'} onChange={() => setScope('match')} />
            <span>The <b>{fmtInt(props.sorted.length)}</b> parts that match your current filters</span>
          </label>
          <label className="radio">
            <input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} disabled={!groups.unknown.length} />
            <span>
              Those, plus <b>{fmtInt(groups.unknown.length)}</b> under-labelled parts
              <span className="muted"> — the catalogue has a blank where one of your filters needs a value, so they might fit. The job tells the model your requirements so it can discard the ones that do not.</span>
            </span>
          </label>
          <label className="radio">
            <input type="checkbox" checked={skipDone} onChange={(e) => setSkipDone(e.target.checked)} />
            <span>Skip parts that already have datasheet data{alreadyDone ? ` (${fmtInt(alreadyDone)} of the matching parts)` : ''}</span>
          </label>
          <label className="radio">
            <span>Take the first</span>
            <input className="input sm num" type="number" min={1} max={2000} value={limit} onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value, 10) || 1))} style={{ width: 76 }} aria-label="Number of parts" />
            <span>of {fmtInt(candidates.length)}, in the table's current order{candidates.length > limit ? <span className="muted"> — sort or filter first so the most promising parts come first</span> : null}</span>
          </label>

          <h3>What to read <span className="muted" style={{ fontWeight: 400 }}>— {needs.curves.size + needs.scalars.size ? 'pre-selected from what your formulas use' : 'your formulas do not use datasheet data yet, so the usual set is selected'}</span></h3>
          <div className="collist">
            {Object.entries(recipe.curves).map(([k, c]) => (
              <label key={k}><input type="checkbox" checked={want.has(`c:${k}`)} onChange={() => toggleWant(`c:${k}`)} /><span>{c.label} <span className="muted">(curve)</span></span></label>
            ))}
            {Object.entries(recipe.scalars).map(([k, s]) => (
              <label key={k}><input type="checkbox" checked={want.has(`s:${k}`)} onChange={() => toggleWant(`s:${k}`)} /><span>{s.label}</span></label>
            ))}
          </div>

          <h3>Sent along for context</h3>
          <ul>
            <li>
              {formulas.length
                ? <>Your formulas:<pre className="mono" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{formulas.map((f) => `${f.name} = ${f.expr}`).join('\n')}</pre></>
                : <span className="muted">No formulas defined. Add them first (Formulas button) and the job asks only for what they need.</span>}
            </li>
            <li>
              {criteriaCols.length
                ? <>Your requirements: {criteriaCols.map((c) => `${c.name} ${describeFilter(c, props.filters[c.id])}`).join('; ')}</>
                : <span className="muted">No parameter filters are active.</span>}
            </li>
          </ul>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
            <button className="btn primary" disabled={!chosen.length || nothingWanted} onClick={() => download(fileName, jobText, 'text/markdown')}><Icon.download /> Download job file</button>
            <button className="btn" disabled={!chosen.length || nothingWanted} onClick={() => { navigator.clipboard?.writeText(jobText).then(() => setCopied(true), () => {}); }}><Icon.copy /> {copied ? 'Copied' : 'Copy as text'}</button>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {chosen.length ? `${fmtInt(chosen.length)} parts · about ${fmtInt(Math.round(jobText.length / 4 / 100) * 100)} tokens before the datasheets` : 'No parts to send.'}
            </span>
          </div>
          <div className="note" style={{ marginTop: 12 }}>
            <b>Then:</b> give the file to an LLM together with the datasheet PDFs, or use one that can browse the web and let it
            find them. Twenty to forty parts per job is a sensible size; split larger sets. When it answers, come back to step 2.
            The catalogue's own datasheet links mostly open only in a browser, so a model usually has to find the manufacturer's
            copy or be handed the PDF.
          </div>
        </>
      )}

      {tab === 'import' && (
        <>
          <p>Paste the model's answer, or choose the file it produced. Every record is checked before anything is saved.</p>
          <input
            className="input" type="file" accept=".json,.txt,.md,application/json,text/plain" style={{ padding: 4, marginBottom: 8 }} aria-label="Answer file"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await f.text(); setAnswer(t); check(t); } }}
          />
          <textarea
            className="input mono" rows={9} value={answer} spellCheck={false} aria-label="Answer JSON"
            placeholder={'{ "records": [ … ], "rejected": [ … ], "unavailable": [ … ] }'}
            onChange={(e) => { setAnswer(e.target.value); check(e.target.value); }}
          />
          {result && (
            <div style={{ marginTop: 10 }}>
              {result.warnings.map((w) => <div key={w} className="note warn" style={{ marginBottom: 6 }}>{w}</div>)}
              {result.accepted.length > 0 && (
                <div className="note good" style={{ marginBottom: 6 }}>
                  <b>{result.accepted.length} record{result.accepted.length === 1 ? '' : 's'} passed the checks:</b>{' '}
                  {result.accepted.slice(0, 12).map((r) => r.mfr || r.lcsc).join(', ')}{result.accepted.length > 12 ? ` and ${result.accepted.length - 12} more` : ''}
                </div>
              )}
              {result.refused.length > 0 && (
                <div className="note bad" style={{ marginBottom: 6 }}>
                  <b>{result.refused.length} record{result.refused.length === 1 ? ' was' : 's were'} refused and will not be saved:</b>
                  {result.refused.slice(0, 20).map((r, i) => <div key={i}><span className="mono">{r.lcsc}</span> {mfrOf(r.lcsc)} — {r.problems.join('; ')}</div>)}
                </div>
              )}
              {result.rejected.length > 0 && (
                <div className="note" style={{ marginBottom: 6 }}>
                  <b>{result.rejected.length} part{result.rejected.length === 1 ? '' : 's'} did not meet your requirements, according to the datasheet:</b>
                  {result.rejected.slice(0, 30).map((r, i) => <div key={i}><span className="mono">{r.lcsc}</span> {mfrOf(r.lcsc)} — {r.reason}</div>)}
                </div>
              )}
              {result.unavailable.length > 0 && (
                <div className="note" style={{ marginBottom: 6 }}>
                  <b>{result.unavailable.length} datasheet{result.unavailable.length === 1 ? '' : 's'} could not be read:</b>
                  {result.unavailable.slice(0, 30).map((r, i) => <div key={i}><span className="mono">{r.lcsc}</span> {mfrOf(r.lcsc)} — {r.reason}</div>)}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn primary" disabled={!result.accepted.length || saved !== null} onClick={save}>
                  {saved !== null ? `Saved ${saved}` : `Save ${result.accepted.length} record${result.accepted.length === 1 ? '' : 's'} in this browser`}
                </button>
                {saved !== null && <span className="muted">Your formulas now use them. Spot-check a couple against the datasheet graphs.</span>}
              </div>
            </div>
          )}

          <h3 style={{ marginTop: 18 }}>Saved in this browser</h3>
          <p>
            {localCount
              ? <>{fmtInt(localCount)} {recipe.title} record{localCount === 1 ? '' : 's'}. They only exist here until you contribute them, after which every visitor gets them.</>
              : <span className="muted">Nothing yet.</span>}
          </p>
          {localCount > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => download(`datasheet-records-${recipeKey}.json`, exportBundle(recipeKey), 'application/json')}><Icon.download /> Download for a pull request</button>
              <a className="btn" href={`${REPO_URL}/blob/main/datasheet-data/README.md#contributing-many-records`} target="_blank" rel="noreferrer">How to contribute <Icon.ext /></a>
              <button className="btn" onClick={() => { if (confirm(`Delete the ${localCount} records saved in this browser?`)) { clearLocalRecords(recipeKey); setLocalCount(0); props.onChanged(); } }}><Icon.trash /> Delete them</button>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
