// Small persistent settings (localStorage). Everything here is a convenience:
// the app works without it.

import { useCallback, useEffect, useState } from 'react';
import type { Definition } from './formula';

const PREFIX = 'jlcparts.';

function read<T>(key: string, dflt: T): T {
  try {
    const s = localStorage.getItem(PREFIX + key);
    return s === null ? dflt : (JSON.parse(s) as T);
  } catch {
    return dflt;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('jlcparts-store', { detail: key }));
  } catch {
    /* storage unavailable: carry on without persistence */
  }
}

/** useState that persists, and stays in sync between components using the same key. */
export function useStored<T>(key: string, dflt: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, dflt));
  useEffect(() => {
    setValue(read(key, dflt));
    const on = (e: Event) => { if ((e as CustomEvent).detail === key) setValue(read(key, dflt)); };
    window.addEventListener('jlcparts-store', on);
    return () => window.removeEventListener('jlcparts-store', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback((v: T | ((prev: T) => T)) => {
    const next = typeof v === 'function' ? (v as (p: T) => T)(read(key, dflt)) : v;
    write(key, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [value, set];
}

export type Theme = 'auto' | 'light' | 'dark';
export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
}

export interface CatPrefs {
  /** column ids shown in the table, in order; undefined = defaults */
  cols?: string[];
  /** facet ids pinned open even though they are "rare" */
  moreFilters?: boolean;
}

export const sheetKey = (catId: string) => `sheet.${catId}`;
export const prefsKey = (catId: string) => `prefs.${catId}`;
export type Sheet = Definition[];

export function newId(): string {
  return Math.random().toString(36).slice(2, 8);
}
