import { useEffect, useMemo, useState } from 'react';
import { loadSearch, searchParts, type DataIndex, type SearchIndex } from '../lib/data';
import { hashFor } from '../lib/url';
import { Hl, fmtInt } from './ui';

export function Home({ index, query }: { index: DataIndex; query: string }) {
  const q = query.trim();
  const [search, setSearch] = useState<SearchIndex | null>(null);
  const [searchError, setSearchError] = useState(false);

  // The part-number index (~3 MB) is only fetched once someone actually searches.
  useEffect(() => {
    if (q.length >= 2 && !search) loadSearch().then(setSearch, () => setSearchError(true));
  }, [q, search]);

  const catName = useMemo(() => {
    const m = new Map<string, { name: string; group: string }>();
    for (const g of index.groups) for (const c of g.cats) m.set(c.id, { name: c.name, group: g.name });
    return m;
  }, [index]);

  const result = useMemo(() => (search && q.length >= 2 ? searchParts(search, q) : null), [search, q]);

  const groups = useMemo(() => {
    if (!q) return index.groups;
    const words = q.toLowerCase().split(/\s+/);
    const match = (s: string) => words.every((w) => s.toLowerCase().includes(w));
    return index.groups
      .map((g) => ({ ...g, cats: match(g.name) ? g.cats : g.cats.filter((c) => match(c.name) || c.src.some(match)) }))
      .filter((g) => g.cats.length);
  }, [index, q]);

  const nCats = index.groups.reduce((s, g) => s + g.cats.length, 0);

  return (
    <div className="page">
      <div className="hero">
        <h1>Find a part JLCPCB can assemble</h1>
        <p>{fmtInt(index.total)} in-stock parts in {nCats} categories. Pick a category to filter by parameter, or search above.</p>
      </div>

      {q.length >= 2 && (
        <div className="hits">
          <header>
            <h2>Parts matching “{q}”</h2>
            <span className="muted">
              {searchError ? 'search index failed to load' : !result ? 'loading part index…' : `${fmtInt(result.total)} found`}
            </span>
          </header>
          {result && result.total > 0 && (
            <div className="hits-body">
              <div>
                {[...result.perCat.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => (
                  <a key={id} href={hashFor(id, new URLSearchParams({ q }))}>
                    <span>{catName.get(id)?.name ?? id} <span className="sub">{catName.get(id)?.group}</span></span>
                    <span className="sub num">{fmtInt(n)}</span>
                  </a>
                ))}
              </div>
              <div>
                {result.hits.map((h) => (
                  <a key={h.lcsc} href={hashFor(h.cat, new URLSearchParams({ q: h.mfr || `C${h.lcsc}`, p: `C${h.lcsc}` }))}>
                    <span><b><Hl text={h.mfr || '(no part number)'} q={q} /></b> <span className="sub mono">C{h.lcsc}</span></span>
                    <span className="sub">{catName.get(h.cat)?.name}</span>
                  </a>
                ))}
                {result.total > result.hits.length && <div className="sub" style={{ padding: '4px 12px' }}>Showing the first {result.hits.length}. Open a category on the left to see all of its matches.</div>}
              </div>
            </div>
          )}
          {result && result.total === 0 && (
            <div className="empty">
              <b>No part number or LCSC code contains “{q}”</b>
              Part search looks at manufacturer part numbers and LCSC codes. To search descriptions and parameters, open a category first.
            </div>
          )}
        </div>
      )}

      {groups.length === 0 ? (
        !result?.total && <div className="empty"><b>No category matches “{q}”</b>Try a shorter word, e.g. “mosfet”, “ldo”, “usb”.</div>
      ) : (
        <div className="groups">
          {groups.map((g) => (
            <section className="group" key={g.name}>
              <header>
                <h2><Hl text={g.name} q={q} /></h2>
                <span className="num">{fmtInt(g.cats.reduce((s, c) => s + c.n, 0))}</span>
              </header>
              <ul>
                {g.cats.map((c) => (
                  <li key={c.id}>
                    <a href={hashFor(c.id)} title={c.src.length > 1 ? `Merged from: ${c.src.join('; ')}` : undefined}>
                      <span><Hl text={c.name} q={q} /></span>
                      <span className="num">{fmtInt(c.n)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
