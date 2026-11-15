import { useState } from 'react';
import type { Column } from '../lib/data';
import { Dialog } from './ui';

export interface ColumnChoice { id: string; name: string; rare?: boolean; group: string }

export function ColumnsDialog(props: {
  choices: ColumnChoice[];
  shown: string[];
  defaults: string[];
  /** formula columns, listed for information: they are switched on and off in the formula editor */
  computed: Column[];
  onSave: (ids: string[] | undefined) => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState(() => new Set(props.shown));
  const [q, setQ] = useState('');
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const needle = q.trim().toLowerCase();
  const visible = props.choices.filter((c) => !needle || c.name.toLowerCase().includes(needle));
  const groups = [...new Set(props.choices.map((c) => c.group))];
  const scope = needle ? `the ${visible.length} listed` : 'all';

  return (
    <Dialog
      title="Columns"
      onClose={props.onClose}
      footer={
        <>
          <button className="btn" onClick={() => setSel(new Set(props.defaults))}>Reset to defaults</button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={props.onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={() => {
              const ids = props.choices.filter((c) => sel.has(c.id)).map((c) => c.id);
              const same = ids.length === props.defaults.length && ids.every((id, i) => id === props.defaults[i]);
              props.onSave(same ? undefined : ids);
            }}
          >Apply</button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Find a column…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a column" />
        <button className="btn" onClick={() => setSel((s) => new Set([...s, ...visible.map((c) => c.id)]))}>Show {scope}</button>
        <button className="btn" onClick={() => setSel((s) => { const n = new Set(s); for (const c of visible) n.delete(c.id); return n; })}>Hide {scope}</button>
        <span className="muted" style={{ fontSize: 12.5 }}>{sel.size} of {props.choices.length} shown · the Part column always stays</span>
      </div>
      {groups.map((g) => {
        const items = visible.filter((c) => c.group === g);
        if (!items.length) return null;
        return (
          <div key={g}>
            <h3>{g}</h3>
            <div className="collist">
              {items.map((c) => (
                <label key={c.id}>
                  <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                  <span>{c.name}{c.rare ? <span className="muted"> · few parts</span> : null}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
      {visible.length === 0 && <p className="muted">No column is called that.</p>}
      {props.computed.length > 0 && (
        <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
          Formula columns ({props.computed.map((c) => c.name).join(', ')}) are shown or hidden with the tick box next to each line in the formula editor, or with the × in their header.
        </p>
      )}
      <p className="muted" style={{ fontSize: 12.5 }}>Tip: in the table, hover a header and press × to hide that column, or drag its right edge to resize it.</p>
    </Dialog>
  );
}
