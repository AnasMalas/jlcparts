import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Category, Column } from '../lib/data';
import { cellText } from '../lib/format';

const ROW_H = 30;
const OVERSCAN = 14;
const FIRST_W = 250;
const DESC_W = 420;

function measure(cat: Category, col: Column): number {
  let longest = col.name.length + 3;
  const step = Math.max(1, Math.floor(cat.n / 250));
  for (let r = 0; r < cat.n; r += step) {
    const len = cellText(col, r).length;
    if (len > longest) longest = len;
  }
  // formula cells carry an "≈ " marker and their header an "ƒ " prefix and sort arrow
  const extra = col.computed ? 34 : 22;
  return Math.round(Math.min(300, Math.max(col.computed ? 104 : 64, longest * 6.9 + extra)));
}

export function ResultsTable(props: {
  cat: Category;
  rows: Int32Array;
  cols: Column[];
  sort: string;
  desc: boolean;
  onSort: (id: string) => void;
  openRow: number | null;
  onOpen: (row: number) => void;
  favs: Set<number>;
  onFav: (lcsc: number) => void;
  /** changes whenever the result set changes, to reset the scroll position */
  resetKey: string;
}) {
  const { cat, rows, cols } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (wrap.current) wrap.current.scrollTop = 0;
    setScrollTop(0);
  }, [props.resetKey]);

  const widths = useMemo(() => cols.map((c) => measure(cat, c)), [cat, cols]);
  const totalW = FIRST_W + widths.reduce((s, w) => s + w, 0) + DESC_W;

  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_H) + OVERSCAN);
  const slice: number[] = [];
  for (let i = first; i < last; i++) slice.push(rows[i]);

  const arrow = (id: string) => (props.sort === id ? <span className="arrow">{props.desc ? '▼' : '▲'}</span> : null);
  const isNum = (c: Column) => c.kind === 'num' || c.kind === 'range';

  return (
    <div
      className="tablewrap"
      ref={wrap}
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      tabIndex={0}
      aria-label="Matching parts"
    >
      <table className="grid" style={{ width: totalW }}>
        <colgroup>
          <col style={{ width: FIRST_W }} />
          {widths.map((w, i) => <col key={cols[i].id} style={{ width: w }} />)}
          <col style={{ width: DESC_W }} />
        </colgroup>
        <thead>
          <tr>
            <th className="first" onClick={() => props.onSort('mfr')} title="Sort by manufacturer part number">Part{arrow('mfr')}</th>
            {cols.map((c) => (
              <th
                key={c.id}
                className={`${isNum(c) ? 'r' : ''}${c.computed ? ' computed' : ''}`}
                onClick={() => props.onSort(c.id)}
                title={c.help ? `${c.name} — ${c.help}` : c.name}
              >
                {c.computed ? 'ƒ ' : ''}{c.name}{arrow(c.id)}
              </th>
            ))}
            <th style={{ cursor: 'default' }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {first > 0 && <tr style={{ height: first * ROW_H }} aria-hidden="true"><td colSpan={cols.length + 2} style={{ height: first * ROW_H, padding: 0, border: 0 }} /></tr>}
          {slice.map((r) => {
            const lcsc = cat.lcsc[r];
            const fav = props.favs.has(lcsc);
            return (
              <tr key={r} className={props.openRow === r ? 'open' : ''} onClick={() => props.onOpen(r)}>
                <td className="first">
                  <div className="partcell">
                    <button
                      className={`star${fav ? ' on' : ''}`}
                      title={fav ? 'Remove from favourites' : 'Add to favourites'}
                      aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}
                      onClick={(e) => { e.stopPropagation(); props.onFav(lcsc); }}
                    >★</button>
                    <span className="mfr" title={cat.mfr[r]}>{cat.mfr[r] || '—'}</span>
                    <span className="lcsc">C{lcsc}</span>
                  </div>
                </td>
                {cols.map((c) => {
                  if (c.id === '$class') {
                    const k = cat.cls[r];
                    return <td key={c.id}><span className={`badge c${k}`}>{c.dict![k]}</span></td>;
                  }
                  const text = cellText(c, r);
                  if (c.computed) {
                    if (!text) {
                      const why = c.note?.[r];
                      return <td key={c.id} className="r computed">{why ? <span className="na" title={why}>n/a</span> : ''}</td>;
                    }
                    return (
                      <td key={c.id} className="r computed" title={c.est?.[r] ? `${text} — estimate: uses a generic model because this part has no datasheet-derived data yet` : text}>
                        {c.est?.[r] ? <span className="est">≈ </span> : null}{text}
                      </td>
                    );
                  }
                  return <td key={c.id} className={isNum(c) ? 'r' : ''} title={text.length > 18 ? text : undefined}>{text}</td>;
                })}
                <td title={cat.desc[r]} className="muted">{cat.desc[r]}</td>
              </tr>
            );
          })}
          {last < rows.length && <tr aria-hidden="true"><td colSpan={cols.length + 2} style={{ height: (rows.length - last) * ROW_H, padding: 0, border: 0 }} /></tr>}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="empty">
          <b>No parts match these filters</b>
          Remove a filter chip above, or widen a min / max range.
        </div>
      )}
    </div>
  );
}
