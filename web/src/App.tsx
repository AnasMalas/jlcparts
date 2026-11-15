import { useEffect, useMemo, useRef, useState } from 'react';
import { loadIndex, type DataIndex, type IndexCat } from './lib/data';
import { applyTheme, useStored, type Theme } from './lib/store';
import { parseHash, type Route } from './lib/url';
import { Home } from './components/Home';
import { CategoryPage } from './components/CategoryPage';
import { About, DonateButtons, REPO_URL } from './components/About';
import { Icon, Loading, fmtInt } from './components/ui';

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function App() {
  const route = useRoute();
  const [index, setIndex] = useState<DataIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useStored<Theme>('theme', 'auto');
  const [about, setAbout] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadIndex().then(setIndex, (e) => setError(String(e.message ?? e))); }, []);
  useEffect(() => { applyTheme(theme); }, [theme]);

  // "/" focuses the search box, like most catalogue sites
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const catById = useMemo(() => {
    const m = new Map<string, IndexCat & { group: string }>();
    if (index) for (const g of index.groups) for (const c of g.cats) m.set(c.id, { ...c, group: g.name });
    return m;
  }, [index]);

  const cat = route.cat ? catById.get(route.cat) : undefined;
  useEffect(() => {
    document.title = cat ? `${cat.name} – JLC Parts` : 'JLC Parts – parametric search';
  }, [cat]);

  const nextTheme: Theme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
  const ThemeIcon = theme === 'auto' ? Icon.auto : theme === 'light' ? Icon.sun : Icon.moon;

  return (
    <>
      <div className="topbar">
        <a className="brand" href="#/" onClick={() => setQuery('')}>
          <img src="./favicon.svg" alt="" />
          <span>JLC Parts</span>
          <small>parametric search</small>
        </a>
        <div className="search">
          <Icon.search />
          <input
            ref={searchRef}
            className="input"
            type="search"
            placeholder="Search part number, LCSC code or category…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (route.cat) location.hash = '#/';
            }}
            aria-label="Search all parts"
          />
          {!query && <kbd>/</kbd>}
        </div>
        <div className="spacer" />
        {index && (
          <span className="meta" title={`Catalogue snapshot ${new Date(index.source.created).toUTCString()}`}>
            {fmtInt(index.total)} parts · {new Date(index.source.created).toISOString().slice(0, 10)}
          </span>
        )}
        <button className="btn ghost icon" onClick={() => setTheme(nextTheme)} title={`Theme: ${theme} (click for ${nextTheme})`} aria-label="Change theme">
          <ThemeIcon />
        </button>
        <button className="btn ghost" onClick={() => setAbout(true)} title="About, credits and data sources"><Icon.info /> <span className="wide">About &amp; credits</span></button>
        <a className="btn ghost icon" href={REPO_URL} target="_blank" rel="noreferrer" title="Source on GitHub" aria-label="Source on GitHub"><Icon.github /></a>
      </div>

      {error ? (
        <div className="page"><div className="note bad">Could not load the parts database: {error}. Try reloading the page.</div></div>
      ) : !index ? (
        <Loading label="Loading the catalogue index…" />
      ) : route.cat && cat ? (
        <CategoryPage key={cat.id} info={cat} route={route} index={index} />
      ) : route.cat ? (
        <div className="page">
          <div className="note warn">There is no category called “{route.cat}”. It may have been renamed. <a href="#/">Browse all categories</a></div>
        </div>
      ) : (
        <Home index={index} query={query} />
      )}

      <footer className="site">
        <span>
          Built on <a href="https://github.com/yaqwsx/jlcparts" target="_blank" rel="noreferrer">jlcparts</a> by Jan Mrázek (yaqwsx) and the{' '}
          <a href="https://github.com/dougy83/jlcparts" target="_blank" rel="noreferrer">enhanced fork</a> by dougy83.
        </span>
        <span>Support the original author:</span>
        <DonateButtons small />
        <span>Unofficial — not affiliated with JLCPCB or LCSC.</span>
      </footer>
      {about && <About index={index} onClose={() => setAbout(false)} />}
    </>
  );
}
