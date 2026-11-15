import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { datasheetUrl, imageUrl, type Category, type Column } from '../lib/data';
import { cellText } from '../lib/format';
import { Icon } from './ui';

const OVERSCAN = 14;
const MIN_W = 44;
const MAX_W = 900;
export const PART_COL = '$part';
export const DESC_COL = '$desc';

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

interface Preview { src: string; x: number; y: number }

export function ResultsTable(props: {
  cat: Category;
  rows: Int32Array;
  cols: Column[];
  showDesc: boolean;
  /** show a photo thumbnail in every row (taller rows) */
  photos: boolean;
  /** widths the user has dragged, by column id; anything missing is sized to fit */
  widths: Record<string, number>;
  onResize: (id: string, width: number | null) => void;
  onHide: (id: string) => void;
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
  const { cat, rows, cols, photos } = props;
  const ROW_H = photos ? 54 : 30;
  const wrap = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);
  const [drag, setDrag] = useState<{ id: string; w: number } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

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

  const auto = useMemo(() => {
    const m: Record<string, number> = { [PART_COL]: photos ? 310 : 262, [DESC_COL]: 420 };
    for (const c of cols) m[c.id] = measure(cat, c);
    return m;
  }, [cat, cols, photos]);
  const widthOf = (id: string) => (drag?.id === id ? drag.w : props.widths[id] ?? auto[id]);
  const totalW = widthOf(PART_COL) + cols.reduce((s, c) => s + widthOf(c.id), 0) + (props.showDesc ? widthOf(DESC_COL) : 0);

  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_H) + OVERSCAN);
  const slice: number[] = [];
  for (let i = first; i < last; i++) slice.push(rows[i]);

  const arrow = (id: string) => (props.sort === id ? <span className="arrow">{props.desc ? '▼' : '▲'}</span> : null);
  const isNum = (c: Column) => c.kind === 'num' || c.kind === 'range';

  /** Drag handle on the right edge of a header cell. Double-click returns the column to its fitted width. */
  const grip = (id: string, label: string) => (
    <span
      className={`grip${drag?.id === id ? ' on' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      title="Drag to resize · double-click to fit"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => { e.stopPropagation(); props.onResize(id, null); }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX, startW = widthOf(id);
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        let w = startW;
        const move = (ev: PointerEvent) => {
          w = Math.round(Math.min(MAX_W, Math.max(MIN_W, startW + ev.clientX - startX)));
          setDrag({ id, w });
        };
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          setDrag(null);
          if (w !== startW) props.onResize(id, w);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      }}
    />
  );
  const hide = (id: string, label: string) => (
    <button className="hidecol" title={`Hide the ${label} column`} aria-label={`Hide ${label}`} onClick={(e) => { e.stopPropagation(); props.onHide(id); }}>×</button>
  );

  const showPreview = (e: React.MouseEvent, img: string) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const size = 268;
    const y = Math.min(Math.max(8, r.top + r.height / 2 - size / 2), window.innerHeight - size - 8);
    setPreview({ src: imageUrl(img, 'medium'), x: r.right + 10, y });
  };

  return (
    <div
      className={`tablewrap${photos ? ' photos' : ''}${drag ? ' resizing' : ''}`}
      ref={wrap}
      style={{ ['--row-h' as string]: `${ROW_H}px` }}
      onScroll={(e) => { setScrollTop((e.target as HTMLDivElement).scrollTop); if (preview) setPreview(null); }}
      tabIndex={0}
      aria-label="Matching parts"
    >
      <table className="grid" style={{ width: totalW }}>
        <colgroup>
          <col style={{ width: widthOf(PART_COL) }} />
          {cols.map((c) => <col key={c.id} style={{ width: widthOf(c.id) }} />)}
          {props.showDesc && <col style={{ width: widthOf(DESC_COL) }} />}
        </colgroup>
        <thead>
          <tr>
            <th className="first" onClick={() => props.onSort('mfr')} title="Sort by manufacturer part number">
              Part{arrow('mfr')}
              {grip(PART_COL, 'Part')}
            </th>
            {cols.map((c) => (
              <th
                key={c.id}
                className={`${isNum(c) ? 'r' : ''}${c.computed ? ' computed' : ''}`}
                onClick={() => props.onSort(c.id)}
                title={c.help ? `${c.name} — ${c.help}` : c.name}
              >
                {c.computed ? 'ƒ ' : ''}{c.name}{arrow(c.id)}
                {hide(c.id, c.name)}
                {grip(c.id, c.name)}
              </th>
            ))}
            {props.showDesc && (
              <th style={{ cursor: 'default' }}>
                Description
                {hide(DESC_COL, 'Description')}
                {grip(DESC_COL, 'Description')}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {first > 0 && <tr style={{ height: first * ROW_H }} aria-hidden="true"><td colSpan={cols.length + 2} style={{ height: first * ROW_H, padding: 0, border: 0 }} /></tr>}
          {slice.map((r) => {
            const lcsc = cat.lcsc[r];
            const fav = props.favs.has(lcsc);
            const ds = datasheetUrl(cat.ds[r]);
            const img = cat.img[r];
            return (
              <tr
                key={r}
                className={props.openRow === r ? 'open' : ''}
                onClick={() => props.onOpen(r)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) props.onOpen(r); }}
              >
                <td className="first">
                  <div className="partcell">
                    {photos && (img ? (
                      <img
                        className="thumb" src={imageUrl(img, 'small')} alt="" loading="lazy" width={46} height={46}
                        onMouseEnter={(e) => showPreview(e, img)} onMouseLeave={() => setPreview(null)}
                        onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
                      />
                    ) : (
                      <span className="thumb none" title="The catalogue data has no photo for this part">no photo</span>
                    ))}
                    <button
                      className={`star${fav ? ' on' : ''}`}
                      title={fav ? 'Remove from favourites' : 'Add to favourites'}
                      aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}
                      onClick={(e) => { e.stopPropagation(); props.onFav(lcsc); }}
                    >★</button>
                    {ds ? (
                      <a className="dslink" href={ds} target="_blank" rel="noreferrer" title="Open the datasheet in a new tab" aria-label={`Datasheet for ${cat.mfr[r]}`} onClick={(e) => e.stopPropagation()}>
                        <Icon.doc />
                      </a>
                    ) : (
                      <span className="dslink off" title="The catalogue has no datasheet link for this part"><Icon.doc /></span>
                    )}
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
                  if (c.filled?.[r]) {
                    return <td key={c.id} className={`${isNum(c) ? 'r ' : ''}filled`} title={`${text} — not in the catalogue; read from the datasheet`}>{text}<sup>d</sup></td>;
                  }
                  return <td key={c.id} className={isNum(c) ? 'r' : ''} title={text.length > 18 ? text : undefined}>{text}</td>;
                })}
                {props.showDesc && <td title={cat.desc[r]} className="muted desc">{cat.desc[r]}</td>}
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
      {preview && <img className="photopreview" src={preview.src} alt="" style={{ left: preview.x, top: preview.y }} />}
    </div>
  );
}
