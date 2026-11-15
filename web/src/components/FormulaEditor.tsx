import { useMemo, useRef, useState } from 'react';
import type { Category } from '../lib/data';
import { compileSheet, MATH_NAMES, type Definition } from '../lib/formula';
import type { FormulaSetup } from '../lib/columns';
import { presetsFor } from '../lib/models';
import { newId, type Sheet } from '../lib/store';
import { formatValue } from '@shared/units.js';
import { Dialog, Icon } from './ui';

const UNIT_CHOICES: [string, string][] = [
  ['', 'number'], ['resistance', 'Ω'], ['voltage', 'V'], ['current', 'A'], ['power', 'W'], ['temperature', '°C'],
  ['thermal_resistance', '°C/W'], ['capacitance', 'F'], ['charge', 'C'], ['inductance', 'H'], ['frequency', 'Hz'],
  ['time', 's'], ['energy', 'J'], ['percentage', '%'], ['currency', '$'],
];

export function FormulaEditor(props: {
  cat: Category;
  setup: FormulaSetup;
  sheet: Sheet;
  /** row used for the live preview */
  previewRow: number;
  onSave: (s: Sheet) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Sheet>(() => props.sheet.map((d) => ({ ...d })));
  const focus = useRef<number>(-1);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const compiled = useMemo(() => compileSheet(draft, props.setup.env), [draft, props.setup]);
  const preview = useMemo(() => {
    const out = new Float64Array(draft.length);
    const flags = { est: new Uint8Array(draft.length), notes: new Array<string | null>(draft.length).fill(null) };
    if (draft.length) compiled.evalRow(props.previewRow, out, flags);
    return { out, est: Array.from(flags.est), notes: [...flags.notes] };
  }, [compiled, draft.length, props.previewRow]);

  const patch = (i: number, p: Partial<Definition>) => setDraft((d) => d.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const add = (defs: Omit<Definition, 'id'>[]) =>
    setDraft((d) => {
      const names = new Set(d.map((x) => x.name.toLowerCase()));
      const rename = new Map<string, string>();
      const added = defs.map((x) => {
        let name = x.name, k = 2;
        while (names.has(name.toLowerCase())) name = `${x.name}${k++}`;
        names.add(name.toLowerCase());
        if (name !== x.name) rename.set(x.name, name);
        return { ...x, name, id: newId() };
      });
      // keep a preset self-consistent when one of its names had to change
      for (const a of added) for (const [from, to] of rename) a.expr = a.expr.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
      return [...d, ...added];
    });
  const insert = (text: string) => {
    const i = focus.current;
    const el = inputs.current[i];
    if (i < 0 || !el) return;
    const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s;
    patch(i, { expr: el.value.slice(0, s) + text + el.value.slice(e) });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + text.length, s + text.length); });
  };

  const hasError = compiled.errors.some(Boolean);
  const presets = presetsFor(props.cat.id);

  return (
    <Dialog
      title={`Formula columns — ${props.cat.name}`}
      onClose={props.onClose}
      footer={
        <>
          <span className="muted" style={{ flex: 1, fontSize: 12.5 }}>
            Preview uses {props.cat.mfr[props.previewRow] || `C${props.cat.lcsc[props.previewRow]}`}. Saved in this browser.
          </span>
          <button className="btn" onClick={props.onClose}>Cancel</button>
          <button className="btn primary" disabled={hasError} onClick={() => props.onSave(draft)} title={hasError ? 'Fix the errors first' : undefined}>Apply</button>
        </>
      }
    >
      <p>
        Each line defines a value per part. Lines can use catalogue parameters, functions, and each other — even in a circle
        (junction temperature depends on losses, which depend on Rds(on), which depends on junction temperature): circular
        definitions are solved for every part. Ticked lines become table columns that you can sort and filter by.
      </p>
      <div className="presets">
        <span className="muted" style={{ alignSelf: 'center' }}>Start from:</span>
        {presets.map((p) => (
          <button key={p.title} className="btn sm" title={p.about} onClick={() => add(p.defs)}>{p.title}</button>
        ))}
      </div>

      <table className="sheet">
        <thead>
          <tr><th style={{ width: 34 }}>Show</th><th style={{ width: 130 }}>Name</th><th style={{ width: 14 }} /><th>Formula</th><th style={{ width: 92 }}>Unit</th><th style={{ width: 30 }} /></tr>
        </thead>
        <tbody>
          {draft.map((d, i) => {
            const err = compiled.errors[i];
            const v = preview.out[i];
            return (
              <tr key={d.id}>
                <td style={{ paddingTop: 8, textAlign: 'center' }}>
                  <input type="checkbox" checked={d.show} onChange={(e) => patch(i, { show: e.target.checked })} aria-label={`Show ${d.name} as a column`} />
                </td>
                <td><input className="input" value={d.name} onChange={(e) => patch(i, { name: e.target.value })} aria-label="Name" spellCheck={false} /></td>
                <td className="eq">=</td>
                <td>
                  <input
                    className={`input${err ? ' bad' : ''}`}
                    ref={(el) => { inputs.current[i] = el; }}
                    value={d.expr}
                    onFocus={() => { focus.current = i; }}
                    onChange={(e) => patch(i, { expr: e.target.value })}
                    aria-label={`Formula for ${d.name}`}
                    spellCheck={false} autoComplete="off"
                  />
                  {err ? (
                    <div className="err">{err.message}</div>
                  ) : (
                    <div className="ok">
                      {Number.isNaN(v) ? `n/a${preview.notes[i] ? ` — ${preview.notes[i]}` : ''}` : `${preview.est[i] ? '≈ ' : '= '}${formatValue(v, d.unit || undefined, 4)}`}
                    </div>
                  )}
                </td>
                <td>
                  <select className="input" value={d.unit ?? ''} onChange={(e) => patch(i, { unit: e.target.value || undefined })} aria-label="Unit">
                    {UNIT_CHOICES.map(([k, label]) => (<option key={k} value={k}>{label}</option>))}
                  </select>
                </td>
                <td><button className="btn ghost icon" onClick={() => setDraft((x) => x.filter((_, k) => k !== i))} title="Delete line" aria-label={`Delete ${d.name}`}><Icon.trash /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button className="btn sm" style={{ marginTop: 8 }} onClick={() => add([{ name: 'X', expr: '', show: true }])}><Icon.plus /> Add line</button>

      <div className="ref">
        <div>
          <h3>Parameters <span className="muted" style={{ fontWeight: 400 }}>— click to insert; values are in base units (Ω, V, A, F…)</span></h3>
          <div className="box">
            {props.setup.vars.map((v) => (
              <div key={v.alias} onMouseDown={(e) => { e.preventDefault(); insert(v.alias); }}>
                <code>{v.alias}</code>
                <span>{v.col.name}{v.part !== 'value' ? ` (${v.part})` : ''}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>Functions</h3>
          <div className="box fn">
            {props.setup.models.help.map((h) => (<div key={h.sig}><code>{h.sig}</code><span>{h.text}</span></div>))}
            <div><code>{MATH_NAMES.join(' ')}</code><span>Maths. Also + − × ÷ ^, comparisons, <code>a ? b : c</code>, and numbers with units: <code>12V</code>, <code>10m</code>, <code>4.7k</code>, <code>70C</code>.</span></div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
