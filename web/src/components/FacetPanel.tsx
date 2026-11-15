import { memo, useMemo, useState } from 'react';
import type { Column } from '../lib/data';
import { HIST_BINS, isActive, type EnumFacet, type Facet, type FilterState, type NumFacet, type RangeFacet } from '../lib/engine';
import { formatNum } from '../lib/format';
import { formatValue, inputHint, parseValue } from '@shared/units.js';
import { fmtInt } from './ui';

type SetFilter = Extract<FilterState, { kind: 'set' }>;
type NumFilter = Extract<FilterState, { kind: 'num' }>;
type RangeFilter = Extract<FilterState, { kind: 'range' }>;

interface CardProps {
  col: Column;
  facet: Facet | undefined;
  filter: FilterState | undefined;
  onChange: (id: string, f: FilterState | undefined) => void;
  valuesOpen: boolean;
  onToggleValues: (id: string) => void;
}

const MAX_OPTS = 250;

function Header({ col, active, onClear, tag }: { col: Column; active: boolean; onClear: () => void; tag?: string }) {
  return (
    <header>
      <span className="name" title={col.help ? `${col.name} — ${col.help}` : col.name}>{col.name}</span>
      {tag && <span className="tag">{tag}</span>}
      {active && <button className="x" onClick={onClear} title="Clear this filter" aria-label={`Clear ${col.name}`}>×</button>}
    </header>
  );
}

function SetCard({ col, facet, filter, onChange }: CardProps) {
  const f = filter as SetFilter | undefined;
  const sel = useMemo(() => new Set(f?.sel ?? []), [f]);
  const counts = (facet as EnumFacet | undefined)?.counts;
  const [q, setQ] = useState('');
  const dict = col.dict!;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out: number[] = [];
    for (let i = 0; i < dict.length; i++) {
      const n = counts ? counts[i] : 0;
      if (n === 0 && !sel.has(i)) continue; // only what is still available
      if (needle && !dict[i].toLowerCase().includes(needle)) continue;
      out.push(i);
    }
    return out;
  }, [dict, counts, sel, q]);

  const toggle = (i: number) => {
    const next = new Set(sel);
    if (next.has(i)) next.delete(i); else next.add(i);
    onChange(col.id, next.size ? { kind: 'set', sel: [...next].sort((a, b) => a - b), all: f?.all } : undefined);
  };
  const available = counts ? counts.reduce((s, n) => s + (n > 0 ? 1 : 0), 0) : 0;

  return (
    <div className={`facet${sel.size ? ' active' : ''}`}>
      <Header col={col} active={sel.size > 0} onClear={() => onChange(col.id, undefined)} tag={col.computed ? 'ƒ' : undefined} />
      {(available > 9 || q) && (
        <div className="fsearch">
          <input className="input sm" placeholder={`Find in ${fmtInt(available)} options…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Find ${col.name} option`} />
        </div>
      )}
      {col.kind === 'multi' && sel.size > 1 && (
        <div className="fsearch">
          <span className="seg" title="Match parts that have any of the selected values, or all of them">
            <button className={!f?.all ? 'on' : ''} onClick={() => onChange(col.id, { ...f!, all: false })}>any</button>
            <button className={f?.all ? 'on' : ''} onClick={() => onChange(col.id, { ...f!, all: true })}>all</button>
          </span>
        </div>
      )}
      <div className="opts" role="listbox" aria-multiselectable="true" aria-label={col.name}>
        {visible.slice(0, MAX_OPTS).map((i) => {
          const n = counts ? counts[i] : 0;
          const on = sel.has(i);
          return (
            <label key={i} className={`opt${on ? ' sel' : ''}${n === 0 ? ' zero' : ''}`} title={dict[i]}>
              <input type="checkbox" checked={on} onChange={() => toggle(i)} />
              <span className="lbl">{col.id === '$class' ? <span className={`badge c${i}`}>{dict[i]}</span> : dict[i]}</span>
              <span className="cnt num">{fmtInt(n)}</span>
            </label>
          );
        })}
        {visible.length > MAX_OPTS && <div className="more">{fmtInt(visible.length - MAX_OPTS)} more — type above to narrow down</div>}
        {visible.length === 0 && <div className="more">{q ? 'No option matches' : 'No values among the current results'}</div>}
      </div>
    </div>
  );
}

function Hist({ facet, min, max }: { facet: NumFacet; min?: number; max?: number }) {
  const peak = Math.max(1, ...facet.bins);
  const a = facet.log ? Math.log(facet.min) : facet.min;
  const span = (facet.log ? Math.log(facet.max) : facet.max) - a;
  const edge = (i: number) => { const x = a + (span * i) / HIST_BINS; return facet.log ? Math.exp(x) : x; };
  return (
    <div className="hist" aria-hidden="true">
      {Array.from(facet.bins, (n, i) => {
        const lo = edge(i), hi = edge(i + 1);
        const inside = (min === undefined || hi >= min) && (max === undefined || lo <= max);
        // sqrt scale: a handful of popular values should not flatten everything else
        const h = n ? Math.max(8, Math.round(Math.sqrt(n / peak) * 100)) : 0;
        return <i key={i} className={n ? (inside ? 'in' : '') : 'nil'} style={{ height: `${h}%` }} />;
      })}
    </div>
  );
}

function NumCard({ col, facet, filter, onChange, valuesOpen, onToggleValues }: CardProps) {
  const f = filter as NumFilter | undefined;
  const nf = facet as NumFacet | undefined;
  const minText = f?.minText ?? '';
  const maxText = f?.maxText ?? '';
  const has = nf && nf.count > 0;

  const set = (patch: Partial<NumFilter>) => {
    const next: NumFilter = { kind: 'num', ...f, ...patch };
    const p = (t?: string) => { const v = t ? parseValue(t, col.unit) : NaN; return Number.isNaN(v) ? undefined : v; };
    next.min = p(next.minText);
    next.max = p(next.maxText);
    const empty = !next.minText && !next.maxText && !(next.vals?.length);
    onChange(col.id, empty ? undefined : next);
  };
  const bad = (t: string) => t !== '' && Number.isNaN(parseValue(t, col.unit));
  const badMin = bad(minText), badMax = bad(maxText);
  const swapped = f?.min !== undefined && f?.max !== undefined && f.min > f.max;

  let hint = has ? `${fmtInt(nf.count)} parts${col.unit === 'count' ? '' : ` · ${inputHint(col.unit)}`}` : 'No values among the current results';
  let hintBad = false;
  if (badMin || badMax) { hint = `Can't read “${badMin ? minText : maxText}” — ${inputHint(col.unit)}`; hintBad = true; }
  else if (swapped) { hint = 'Min is larger than max'; hintBad = true; }

  const vals = new Set(f?.vals ?? []);
  const toggleVal = (v: number) => {
    const next = new Set(vals);
    if (next.has(v)) next.delete(v); else next.add(v);
    set({ vals: next.size ? [...next].sort((a, b) => a - b) : undefined });
  };

  return (
    <div className={`facet num${isActive(f) ? ' active' : ''}`}>
      <Header col={col} active={!!f} onClear={() => onChange(col.id, undefined)} tag={col.computed ? 'ƒ' : undefined} />
      <div className="body">
        <div className="minmax">
          <input
            className={`input sm${badMin || swapped ? ' bad' : ''}`}
            placeholder={has ? `min ${formatNum(col, nf.min)}` : 'min'}
            value={minText}
            onChange={(e) => set({ minText: e.target.value })}
            aria-label={`${col.name} minimum`}
            inputMode="text" autoComplete="off" spellCheck={false}
          />
          <span>–</span>
          <input
            className={`input sm${badMax || swapped ? ' bad' : ''}`}
            placeholder={has ? `max ${formatNum(col, nf.max)}` : 'max'}
            value={maxText}
            onChange={(e) => set({ maxText: e.target.value })}
            aria-label={`${col.name} maximum`}
            inputMode="text" autoComplete="off" spellCheck={false}
          />
        </div>
        <div className={`fhint${hintBad ? ' bad' : ''}`} title={hint}>{hint}</div>
        {has && nf.max > nf.min && (
          <>
            <Hist facet={nf} min={f?.min} max={f?.max} />
            <div className="hist-ax"><span>{formatNum(col, nf.min)}</span><span>{nf.log ? 'log scale' : ''}</span><span>{formatNum(col, nf.max)}</span></div>
          </>
        )}
        <div style={{ marginTop: 5 }}>
          <button className="linkbtn" onClick={() => onToggleValues(col.id)}>
            {valuesOpen ? 'Hide value list' : vals.size ? `Pick values (${vals.size} picked)` : 'Pick exact values'}
          </button>
        </div>
        {valuesOpen && nf?.values && (
          <div className="vals">
            {nf.values.slice(0, 600).map(([v, n]) => (
              <label key={v} className={`opt${vals.has(v) ? ' sel' : ''}`}>
                <input type="checkbox" checked={vals.has(v)} onChange={() => toggleVal(v)} />
                <span className="lbl">{formatNum(col, v)}</span>
                <span className="cnt num">{fmtInt(n)}</span>
              </label>
            ))}
            {nf.values.length > 600 && <div className="more">{fmtInt(nf.values.length - 600)} more — narrow with min / max</div>}
            {[...vals].filter((v) => !nf.values!.some(([x]) => x === v)).map((v) => (
              <label key={`gone${v}`} className="opt sel zero">
                <input type="checkbox" checked onChange={() => toggleVal(v)} />
                <span className="lbl">{formatNum(col, v)}</span>
                <span className="cnt">0</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RangeCard({ col, facet, filter, onChange }: CardProps) {
  const f = filter as RangeFilter | undefined;
  const rf = facet as RangeFacet | undefined;
  const loText = f?.loText ?? '', hiText = f?.hiText ?? '';
  const has = rf && rf.count > 0;
  const set = (patch: Partial<RangeFilter>) => {
    const next: RangeFilter = { kind: 'range', ...f, ...patch };
    const p = (t?: string) => { const v = t ? parseValue(t, col.unit) : NaN; return Number.isNaN(v) ? undefined : v; };
    next.lo = p(next.loText);
    next.hi = p(next.hiText);
    onChange(col.id, !next.loText && !next.hiText ? undefined : next);
  };
  const bad = (t: string) => t !== '' && Number.isNaN(parseValue(t, col.unit));
  const anyBad = bad(loText) || bad(hiText);
  return (
    <div className={`facet range${isActive(f) ? ' active' : ''}`}>
      <Header col={col} active={!!f} onClear={() => onChange(col.id, undefined)} />
      <div className="body">
        <div className="minmax">
          <input className={`input sm${bad(loText) ? ' bad' : ''}`} placeholder="from" value={loText} onChange={(e) => set({ loText: e.target.value })} aria-label={`${col.name} must cover from`} autoComplete="off" spellCheck={false} />
          <span>…</span>
          <input className={`input sm${bad(hiText) ? ' bad' : ''}`} placeholder="to" value={hiText} onChange={(e) => set({ hiText: e.target.value })} aria-label={`${col.name} must cover to`} autoComplete="off" spellCheck={false} />
        </div>
        <div className={`fhint${anyBad ? ' bad' : ''}`}>
          {anyBad ? `Can't read that — ${inputHint(col.unit)}` : 'Part’s range must cover these values'}
        </div>
        {has && (
          <div className="hist-ax" style={{ marginTop: 6 }}>
            <span>available: {formatValue(rf.min, col.unit)} … {formatValue(rf.max, col.unit)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const Card = memo(function Card(props: CardProps) {
  const k = props.col.kind;
  if (k === 'enum' || k === 'multi') return <SetCard {...props} />;
  if (k === 'num') return <NumCard {...props} />;
  return <RangeCard {...props} />;
});

export function FacetPanel(props: {
  cols: Column[];
  facets: Map<string, Facet>;
  filters: Record<string, FilterState>;
  onChange: (id: string, f: FilterState | undefined) => void;
  valuesOpen: Set<string>;
  onToggleValues: (id: string) => void;
}) {
  return (
    <div className="facets">
      {props.cols.map((col) => (
        <Card
          key={col.id}
          col={col}
          facet={props.facets.get(col.id)}
          filter={props.filters[col.id]}
          onChange={props.onChange}
          valuesOpen={props.valuesOpen.has(col.id)}
          onToggleValues={props.onToggleValues}
        />
      ))}
    </div>
  );
}
