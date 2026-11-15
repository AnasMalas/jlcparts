// The whole search state lives in the URL hash, so every view can be
// bookmarked, shared, and navigated with the browser's back button.
//
//   #/                         home
//   #/c/<category>?<state>     a category
//
// state keys:  q (text)  s (sort: id or -id)  qty  fav
//              e.<col>=A|B     enum / multi selection, by label
//              a.<col>=1       multi: require all selected
//              n.<col>=min~max numeric range, as typed ("10m~50m")
//              v.<col>=x|y     numeric picked values
//              r.<col>=lo~hi   range parameter must cover lo..hi

import type { Column } from './data';
import type { Filters, FilterState } from './engine';
import { parseValue } from '@shared/units.js';

export interface Route {
  cat: string | null;
  params: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const m = /^c\/([^/]+)/.exec(path);
  return { cat: m ? decodeURIComponent(m[1]) : null, params: new URLSearchParams(query) };
}

export interface ViewState {
  filters: Filters;
  text: string;
  sort: string;
  desc: boolean;
  qty: number;
  fav: boolean;
  /** open this part's detail panel */
  part: number | null;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\p');
const unesc = (s: string) => s.replace(/\\p/g, '|').replace(/\\\\/g, '\\');
const splitList = (s: string) => s.split('|').map(unesc);

export function stateFromParams(params: URLSearchParams, cols: Column[]): ViewState {
  const filters: Filters = {};
  const byId = new Map(cols.map((c) => [c.id, c]));
  for (const [key, value] of params) {
    const dot = key.indexOf('.');
    if (dot !== 1) continue;
    const tag = key[0], id = key.slice(2);
    const col = byId.get(id);
    if (!col) continue;
    if (tag === 'e' && col.dict) {
      const sel = splitList(value).map((label) => col.dict!.indexOf(label)).filter((i) => i >= 0);
      if (sel.length) filters[id] = { kind: 'set', sel, all: params.get(`a.${id}`) === '1' };
    } else if (tag === 'n' && col.kind === 'num') {
      const [a = '', b = ''] = value.split('~');
      const prev = (filters[id] as Extract<FilterState, { kind: 'num' }> | undefined) ?? { kind: 'num' as const };
      const min = parseValue(a, col.unit), max = parseValue(b, col.unit);
      filters[id] = { ...prev, minText: a, maxText: b, min: Number.isNaN(min) ? undefined : min, max: Number.isNaN(max) ? undefined : max };
    } else if (tag === 'v' && col.kind === 'num') {
      const vals = value.split('|').map(Number).filter((x) => !Number.isNaN(x));
      const prev = (filters[id] as Extract<FilterState, { kind: 'num' }> | undefined) ?? { kind: 'num' as const };
      if (vals.length) filters[id] = { ...prev, vals };
    } else if (tag === 'r' && col.kind === 'range') {
      const [a = '', b = ''] = value.split('~');
      const lo = parseValue(a, col.unit), hi = parseValue(b, col.unit);
      filters[id] = { kind: 'range', loText: a, hiText: b, lo: Number.isNaN(lo) ? undefined : lo, hi: Number.isNaN(hi) ? undefined : hi };
    }
  }
  const s = params.get('s') ?? '';
  const qty = parseInt(params.get('qty') ?? '', 10);
  const part = parseInt((params.get('p') ?? '').replace(/^C/i, ''), 10);
  return {
    filters,
    text: params.get('q') ?? '',
    sort: s.replace(/^-/, ''),
    desc: s.startsWith('-'),
    qty: qty > 0 ? qty : 1,
    fav: params.get('fav') === '1',
    part: Number.isNaN(part) ? null : part,
  };
}

export function paramsFromState(state: ViewState, cols: Column[]): URLSearchParams {
  const p = new URLSearchParams();
  if (state.text) p.set('q', state.text);
  if (state.sort) p.set('s', (state.desc ? '-' : '') + state.sort);
  if (state.qty > 1) p.set('qty', String(state.qty));
  if (state.fav) p.set('fav', '1');
  if (state.part !== null) p.set('p', `C${state.part}`);
  const byId = new Map(cols.map((c) => [c.id, c]));
  for (const [id, f] of Object.entries(state.filters)) {
    const col = byId.get(id);
    if (!col) continue;
    if (f.kind === 'set') {
      if (!f.sel.length) continue;
      p.set(`e.${id}`, f.sel.map((i) => esc(col.dict![i])).join('|'));
      if (f.all) p.set(`a.${id}`, '1');
    } else if (f.kind === 'num') {
      if (f.minText || f.maxText) p.set(`n.${id}`, `${f.minText ?? ''}~${f.maxText ?? ''}`);
      if (f.vals?.length) p.set(`v.${id}`, f.vals.join('|'));
    } else if (f.loText || f.hiText) {
      p.set(`r.${id}`, `${f.loText ?? ''}~${f.hiText ?? ''}`);
    }
  }
  return p;
}

export function hashFor(cat: string | null, params?: URLSearchParams): string {
  if (!cat) return '#/';
  const q = params?.toString();
  return `#/c/${encodeURIComponent(cat)}${q ? `?${q}` : ''}`;
}
