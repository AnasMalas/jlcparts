import { useState } from 'react';
import type { Column } from '../lib/data';
import { Dialog } from './ui';

export function ColumnsDialog(props: { all: Column[]; shown: string[]; defaults: string[]; onSave: (ids: string[] | undefined) => void; onClose: () => void }) {
  const [sel, setSel] = useState(() => new Set(props.shown));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
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
              const ids = props.all.filter((c) => sel.has(c.id)).map((c) => c.id);
              const same = ids.length === props.defaults.length && ids.every((id, i) => id === props.defaults[i]);
              props.onSave(same ? undefined : ids);
            }}
          >Apply</button>
        </>
      }
    >
      <p className="muted">Choose which parameters appear as table columns. Formula columns are always shown.</p>
      <div className="collist">
        {props.all.filter((c) => !c.computed).map((c) => (
          <label key={c.id}>
            <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
            <span>{c.name}{c.rare ? <span className="muted"> · few parts</span> : null}</span>
          </label>
        ))}
      </div>
    </Dialog>
  );
}
