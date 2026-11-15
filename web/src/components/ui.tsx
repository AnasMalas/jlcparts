import { useEffect, type ReactNode } from 'react';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const Icon = {
  search: () => (<svg viewBox="0 0 24 24" {...P}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>),
  sun: () => (<svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>),
  moon: () => (<svg viewBox="0 0 24 24" {...P}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></svg>),
  auto: () => (<svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" /></svg>),
  github: () => (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.42c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.12 3.06.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" /></svg>),
  heart: () => (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.300 2.300 4.500 6 4.500c2 0 3.400 1 4.300 2.300l1.700 2.200 1.700-2.200c.9-1.300 2.300-2.300 4.300-2.300 3.700 0 5.600 3.800 4 7.200C19.500 16.400 12 21 12 21Z" /></svg>),
  info: () => (<svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>),
  fx: () => (<svg viewBox="0 0 24 24" {...P}><path d="M10 4c-2 0-3 1-3.300 3L5 20M3.500 10h6" /><path d="m12 12 7 8M19 12l-7 8" /></svg>),
  columns: () => (<svg viewBox="0 0 24 24" {...P}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></svg>),
  download: () => (<svg viewBox="0 0 24 24" {...P}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>),
  link: () => (<svg viewBox="0 0 24 24" {...P}><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1" /><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" /></svg>),
  ext: () => (<svg viewBox="0 0 24 24" {...P}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>),
  star: () => (<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.500 2.900 6.300 6.900.700-5.200 4.600 1.600 6.800L12 17.300 5.800 20.900l1.600-6.800L2.200 9.500l6.900-.700L12 2.500Z" /></svg>),
  copy: () => (<svg viewBox="0 0 24 24" {...P}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>),
  close: () => (<svg viewBox="0 0 24 24" {...P}><path d="M6 6l12 12M18 6 6 18" /></svg>),
  plus: () => (<svg viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>),
  trash: () => (<svg viewBox="0 0 24 24" {...P}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>),
  filter: () => (<svg viewBox="0 0 24 24" {...P}><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" /></svg>),
};

export function Dialog(props: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; narrow?: boolean }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [props]);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div className={`dialog${props.narrow ? ' narrow' : ''}`} role="dialog" aria-modal="true" aria-label={props.title}>
        <header>
          <h2>{props.title}</h2>
          <button className="btn ghost icon" onClick={props.onClose} aria-label="Close"><Icon.close /></button>
        </header>
        <div className="body">{props.children}</div>
        {props.footer && <footer>{props.footer}</footer>}
      </div>
    </div>
  );
}

export const fmtInt = (n: number) => n.toLocaleString('en-US');

/** Highlight occurrences of `q` inside `text`. */
export function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (<>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>);
}

export function Loading({ label }: { label: string }) {
  return (<div className="loading"><div className="spinner" />{label}</div>);
}
