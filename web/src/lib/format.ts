import type { Column } from './data';
import { formatRange, formatValue } from '@shared/units.js';
import type { FilterState } from './engine';

const intFmt = new Intl.NumberFormat('en-US');

/** Display text of one cell. Empty string when the part has no value. */
export function cellText(col: Column, r: number): string {
  switch (col.kind) {
    case 'enum': {
      const i = col.ev![r];
      return i < 0 ? '' : col.dict![i];
    }
    case 'multi': {
      const v = col.mv![r];
      return v ? v.map((i) => col.dict![i]).join(', ') : '';
    }
    case 'num': {
      const t = col.t?.[r];
      if (t) return t;
      const x = col.nv![r];
      if (Number.isNaN(x)) return '';
      return formatNum(col, x);
    }
    default:
      return formatRange(nan2null(col.lo![r]), nan2null(col.hi![r]), col.unit);
  }
}

const nan2null = (x: number) => (Number.isNaN(x) ? null : x);

/** Format a value of a numeric column (handles ± columns, counts, money). */
export function formatNum(col: Column, x: number): string {
  if (col.id === '$stock') return intFmt.format(x);
  if (col.unit === 'count') return intFmt.format(x);
  // formula results are computed, so four significant digits is honest; catalogue values are shown exactly
  const s = formatValue(x, col.unit, col.computed ? 4 : 7);
  return col.pm ? `±${s}` : s;
}

export function describeFilter(col: Column, f: FilterState): string {
  if (f.kind === 'set') {
    const labels = f.sel.map((i) => col.dict![i]);
    const head = labels.slice(0, 3).join(f.all ? ' + ' : ', ');
    return labels.length > 3 ? `${head} +${labels.length - 3}` : head;
  }
  if (f.kind === 'num') {
    const parts: string[] = [];
    if (f.min !== undefined && f.max !== undefined) parts.push(`${formatNum(col, f.min)} – ${formatNum(col, f.max)}`);
    else if (f.min !== undefined) parts.push(`≥ ${formatNum(col, f.min)}`);
    else if (f.max !== undefined) parts.push(`≤ ${formatNum(col, f.max)}`);
    if (f.vals?.length) {
      const head = f.vals.slice(0, 3).map((v) => formatNum(col, v)).join(', ');
      parts.push(f.vals.length > 3 ? `${head} +${f.vals.length - 3}` : head);
    }
    return parts.join('; ');
  }
  if (f.lo !== undefined && f.hi !== undefined) return `covers ${formatValue(f.lo, col.unit)} … ${formatValue(f.hi, col.unit)}`;
  return `covers ${formatValue((f.lo ?? f.hi)!, col.unit)}`;
}
