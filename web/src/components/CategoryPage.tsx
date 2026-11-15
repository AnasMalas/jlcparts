import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { datasheetUrl, loadCategory, type Category, type Column, type DataIndex, type IndexCat } from '../lib/data';
import { builtinColumns, computeColumns, formulaSetup } from '../lib/columns';
import { loadDsData, type DsMap } from '../lib/dsdata';
import { isActive, run, sortRows, type FilterState } from '../lib/engine';
import { cellText, describeFilter } from '../lib/format';
import { prefsKey, sheetKey, useStored, type CatPrefs, type Sheet } from '../lib/store';
import { hashFor, paramsFromState, stateFromParams, type Route, type ViewState } from '../lib/url';
import { FacetPanel } from './FacetPanel';
import { ResultsTable } from './ResultsTable';
import { DetailDrawer } from './DetailDrawer';
import { FormulaEditor } from './FormulaEditor';
import { ColumnsDialog } from './ColumnsDialog';
import { Icon, Loading, fmtInt } from './ui';

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function CategoryPage({ info, route, index }: { info: IndexCat & { group: string }; route: Route; index: DataIndex }) {
  const [cat, setCat] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ds, setDs] = useState<DsMap>(() => new Map());
  const [dsVersion, setDsVersion] = useState(0);
  const [sheet, setSheet] = useStored<Sheet>(sheetKey(info.id), []);
  const [prefs, setPrefs] = useStored<CatPrefs>(prefsKey(info.id), {});
  const [favList, setFavList] = useStored<number[]>('favs', []);
  const [state, setState] = useState<ViewState | null>(null);
  const [valuesOpen, setValuesOpen] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<'formula' | 'columns' | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const lastHash = useRef<string>('');

  useEffect(() => {
    let live = true;
    loadCategory(info.id).then((c) => { if (live) setCat(c); }, (e) => { if (live) setError(String(e.message ?? e)); });
    return () => { live = false; };
  }, [info.id]);
  const hasShared = !!(index as DataIndex & { ds?: Record<string, number> }).ds?.[info.id];
  useEffect(() => {
    let live = true;
    loadDsData(info.id, hasShared).then((m) => { if (live) setDs(m); });
    return () => { live = false; };
  }, [info.id, hasShared, dsVersion]);

  const paramQty = Math.max(1, parseInt(route.params.get('qty') ?? '1', 10) || 1);
  const qty = state?.qty ?? paramQty;

  const builtins = useMemo(() => (cat ? builtinColumns(cat, qty) : []), [cat, qty]);
  const setup = useMemo(() => (cat ? formulaSetup(cat, [...builtins, ...cat.attrs], ds) : null), [cat, builtins, ds]);
  const computed = useMemo(() => (cat && setup ? computeColumns(cat, sheet, setup).columns : []), [cat, sheet, setup]);
  const allCols = useMemo<Column[]>(() => (cat ? [...builtins, ...computed, ...cat.attrs] : []), [cat, builtins, computed]);

  // URL -> state: on first load, and whenever the hash is changed from outside.
  const routeHash = hashFor(info.id, route.params);
  useEffect(() => {
    if (!cat) return;
    if (state && routeHash === lastHash.current) return;
    lastHash.current = routeHash;
    setState(stateFromParams(route.params, allCols));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, routeHash]);

  // state -> URL (replace, so Back leaves the category instead of undoing one click)
  useEffect(() => {
    if (!state || !cat) return;
    const h = hashFor(info.id, paramsFromState(state, allCols));
    if (h !== lastHash.current) {
      lastHash.current = h;
      history.replaceState(null, '', h);
    }
  }, [state, cat, allCols, info.id]);

  const update = useCallback((patch: Partial<ViewState>) => setState((s) => (s ? { ...s, ...patch } : s)), []);
  const setFilter = useCallback((id: string, f: FilterState | undefined) => {
    setState((s) => {
      if (!s) return s;
      const filters = { ...s.filters };
      if (f) filters[id] = f; else delete filters[id];
      return { ...s, filters };
    });
  }, []);
  const toggleValues = useCallback((id: string) => setValuesOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);

  const favs = useMemo(() => new Set(favList), [favList]);
  const toggleFav = useCallback((lcsc: number) => setFavList((l) => (l.includes(lcsc) ? l.filter((x) => x !== lcsc) : [...l, lcsc])), [setFavList]);

  const filters = state?.filters ?? {};
  const facetCols = useMemo(() => {
    const show = (c: Column) => !c.rare || prefs.moreFilters || isActive(filters[c.id]);
    const cls = builtins.filter((c) => c.id === '$class');
    const tail = builtins.filter((c) => c.id !== '$class');
    return [...cls, ...computed, ...(cat?.attrs ?? []).filter(show), ...tail];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, builtins, computed, prefs.moreFilters, state?.filters]);

  const result = useMemo(() => {
    if (!cat || !state) return null;
    return run(cat, allCols, state.filters, { text: state.text, only: state.fav ? favs : null }, facetCols, valuesOpen);
  }, [cat, state?.filters, state?.text, state?.fav, favs, allCols, facetCols, valuesOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => {
    if (!cat || !result || !state) return new Int32Array(0);
    if (!state.sort) return result.rows;
    return sortRows(cat, result.rows, allCols.find((c) => c.id === state.sort) ?? null, state.sort, state.desc);
  }, [cat, result, state?.sort, state?.desc, allCols]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultCols = useMemo(() => [...builtins.map((c) => c.id), ...(cat?.attrs ?? []).filter((c) => !c.rare).map((c) => c.id)], [cat, builtins]);
  const shownIds = prefs.cols ?? defaultCols;
  const tableCols = useMemo(() => {
    const byId = new Map(allCols.map((c) => [c.id, c]));
    const base = shownIds.map((id) => byId.get(id)).filter((c): c is Column => !!c);
    // formula columns sit right after class / stock / price so they are never off-screen
    const head = base.filter((c) => c.builtin), rest = base.filter((c) => !c.builtin);
    return [...head, ...computed, ...rest];
  }, [allCols, shownIds, computed]);

  if (error) return <div className="page"><div className="note bad">Could not load this category: {error}. <a href="#/">Back to all categories</a></div></div>;
  if (!cat || !state || !result) return <Loading label={`Loading ${info.name} (${fmtInt(info.n)} parts, ${(info.bytes / 1e6).toFixed(1)} MB)…`} />;

  const active = allCols.filter((c) => isActive(state.filters[c.id]));
  const nRare = cat.attrs.filter((c) => c.rare).length;
  const openRow = state.part !== null ? cat.rowOf.get(state.part) ?? null : null;
  const anyFilter = active.length > 0 || !!state.text || state.fav;

  const onSort = (id: string) => {
    if (state.sort !== id) update({ sort: id, desc: false });
    else if (!state.desc) update({ desc: true });
    else update({ sort: '', desc: false });
  };

  const exportCsv = () => {
    const head = ['LCSC', 'MFR Part', ...tableCols.map((c) => c.name), 'Description', 'Datasheet'];
    const lines = [head.map(csvCell).join(',')];
    for (const r of sorted) {
      const cells = [`C${cat.lcsc[r]}`, cat.mfr[r], ...tableCols.map((c) => cellText(c, r)), cat.desc[r], datasheetUrl(cat.ds[r]) ?? ''];
      lines.push(cells.map(csvCell).join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${cat.id}-${sorted.length}-parts.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  return (
    <div className="page">
      <div className="crumbs">
        <a href="#/">All categories</a><span className="sep">›</span>
        <span className="muted">{cat.group}</span><span className="sep">›</span>
        <h1>{cat.name}</h1>
        <span className="count num">{fmtInt(cat.n)} parts</span>
        {info.src.length > 1 && (
          <span className="muted" title={info.src.join('\n')} style={{ fontSize: 12.5, cursor: 'help' }}>merged from {info.src.length} catalogue categories</span>
        )}
      </div>

      <div className="toolbar">
        <div className="grow">
          <Icon.search />
          <input
            className="input" type="search" value={state.text}
            placeholder={`Search within ${cat.name}: part number, description, package…`}
            onChange={(e) => update({ text: e.target.value })}
            aria-label={`Search within ${cat.name}`}
          />
        </div>
        <label className="qty" title="Order quantity used for the unit price column">
          Qty
          <input className="input num" type="number" min={1} value={state.qty} onChange={(e) => update({ qty: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
        </label>
        <button className={`btn${state.fav ? ' on' : ''}`} onClick={() => update({ fav: !state.fav })} title="Show only parts you starred"><Icon.star /> Favourites</button>
        <span className="spacer" />
        <button className={`btn${sheet.length ? ' on' : ''}`} onClick={() => setDialog('formula')} title="Add computed columns you can sort and filter by"><Icon.fx /> Formulas{sheet.length ? ` (${sheet.filter((d) => d.show).length})` : ''}</button>
        <button className="btn" onClick={() => setDialog('columns')}><Icon.columns /> Columns</button>
        <button className="btn" onClick={exportCsv} title={`Download the ${fmtInt(sorted.length)} matching parts as CSV`}><Icon.download /> CSV</button>
      </div>

      <section className="panel">
        <header>
          <h2>Filters</h2>
          <span className="muted wide" style={{ fontSize: 12.5 }}>Options shrink to what is still available · selections add up, no Shift needed</span>
          <span className="spacer" />
          {nRare > 0 && (
            <button className="btn sm ghost" onClick={() => setPrefs((p) => ({ ...p, moreFilters: !p.moreFilters }))}>
              {prefs.moreFilters ? 'Hide' : 'Show'} {nRare} rarely-filled parameter{nRare === 1 ? '' : 's'}
            </button>
          )}
          <button className="btn sm ghost" onClick={() => setShowFilters((v) => !v)}>{showFilters ? 'Collapse' : 'Expand'}</button>
        </header>
        {showFilters && (
          <FacetPanel cols={facetCols} facets={result.facets} filters={state.filters} onChange={setFilter} valuesOpen={valuesOpen} onToggleValues={toggleValues} />
        )}
      </section>

      <div className="chips" aria-live="polite">
        <span className="result num">{fmtInt(sorted.length)}{sorted.length !== cat.n ? ` of ${fmtInt(cat.n)}` : ''} parts</span>
        {state.text && (
          <span className="chip"><b>Text: “{state.text}”</b><button onClick={() => update({ text: '' })} aria-label="Clear text search">×</button></span>
        )}
        {state.fav && (
          <span className="chip"><b>Favourites only</b><button onClick={() => update({ fav: false })} aria-label="Show all parts">×</button></span>
        )}
        {active.map((c) => (
          <span className="chip" key={c.id} title={`${c.name}: ${describeFilter(c, state.filters[c.id])}`}>
            <b>{c.name}: {describeFilter(c, state.filters[c.id])}</b>
            <button onClick={() => setFilter(c.id, undefined)} aria-label={`Remove ${c.name} filter`}>×</button>
          </span>
        ))}
        {anyFilter && <button className="btn sm ghost" onClick={() => update({ filters: {}, text: '', fav: false })}>Clear all</button>}
        <span style={{ flex: 1 }} />
        <button
          className="btn sm ghost"
          onClick={() => { navigator.clipboard?.writeText(location.href).catch(() => {}); }}
          title="Copy a link to exactly this search"
        ><Icon.link /> Copy link</button>
      </div>

      <section className="panel results">
        <ResultsTable
          cat={cat} rows={sorted} cols={tableCols}
          sort={state.sort} desc={state.desc} onSort={onSort}
          openRow={openRow} onOpen={(r) => update({ part: cat.lcsc[r] === state.part ? null : cat.lcsc[r] })}
          favs={favs} onFav={toggleFav}
          resetKey={`${JSON.stringify(state.filters)}|${state.text}|${state.fav}|${state.sort}|${state.desc}`}
        />
      </section>

      {openRow !== null && (
        <DetailDrawer
          cat={cat} row={openRow} cols={allCols} computed={computed} qty={state.qty}
          fav={favs.has(cat.lcsc[openRow])} onFav={() => toggleFav(cat.lcsc[openRow])}
          onClose={() => update({ part: null })}
          record={ds.get(cat.lcsc[openRow])}
          onDataChanged={() => setDsVersion((v) => v + 1)}
        />
      )}
      {dialog === 'formula' && setup && (
        <FormulaEditor
          cat={cat} setup={setup} sheet={sheet}
          previewRow={openRow ?? (sorted.length ? sorted[0] : 0)}
          onSave={(s) => { setSheet(s); setDialog(null); }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'columns' && (
        <ColumnsDialog
          all={allCols} shown={shownIds} defaults={defaultCols}
          onSave={(ids) => { setPrefs((p) => ({ ...p, cols: ids })); setDialog(null); }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
