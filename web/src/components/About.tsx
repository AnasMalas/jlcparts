import { Dialog, Icon, fmtInt } from './ui';
import type { DataIndex } from '../lib/data';

export const REPO_URL = 'https://github.com/AnasMalas/jlcparts';

export function DonateButtons({ small }: { small?: boolean }) {
  return (
    <>
      <a className="donate gh" href="https://github.com/sponsors/yaqwsx" target="_blank" rel="noreferrer" title="Sponsor Jan Mrázek (yaqwsx), the original author, on GitHub">
        <Icon.heart /> {small ? 'Sponsor yaqwsx' : 'GitHub Sponsors'}
      </a>
      <a className="donate kofi" href="https://ko-fi.com/E1E2181LU" target="_blank" rel="noreferrer" title="Support Jan Mrázek (yaqwsx), the original author, on Ko-fi">
        <Icon.heart /> Ko-fi
      </a>
    </>
  );
}

export function About({ index, onClose }: { index: DataIndex | null; onClose: () => void }) {
  return (
    <Dialog title="About JLC Parts" onClose={onClose}>
      <p>
        A parametric search for the parts you can have assembled by{' '}
        <a href="https://jlcpcb.com/parts" target="_blank" rel="noreferrer">JLCPCB</a>. It is an unofficial, community tool and is
        not affiliated with JLCPCB or LCSC.
      </p>

      <h3>Standing on two people's work</h3>
      <div className="credit-cards">
        <div className="credit">
          <b>Jan Mrázek (yaqwsx)</b>
          <p>
            Created <a href="https://github.com/yaqwsx/jlcparts" target="_blank" rel="noreferrer">jlcparts</a>, the original catalogue
            browser, and still builds and publishes the component database this site is generated from every day.
          </p>
          <DonateButtons />
        </div>
        <div className="credit">
          <b>dougy83</b>
          <p>
            Made the <a href="https://github.com/dougy83/jlcparts" target="_blank" rel="noreferrer">enhanced fork</a> this project
            started from: the single-file database, much faster search and updates, favourites, Basic-part filtering and CSV export.
          </p>
          <a className="btn sm" href="https://dougy83.github.io/jlcparts/" target="_blank" rel="noreferrer">Open dougy83's version <Icon.ext /></a>
        </div>
      </div>
      <p className="muted">
        If this site saves you time, please support Jan — the donate buttons go to him, not to this fork.
      </p>

      <h3>What is different here</h3>
      <ul>
        <li>Filters only offer what is still available, with a part count next to every option.</li>
        <li>Numeric parameters take a min and a max (type <span className="mono">10m</span>, <span className="mono">4k7</span>, <span className="mono">100n</span>).</li>
        <li>Duplicate categories and parameters are merged, so "MOSFET" and "MOSFETs" are one list with one set of columns.</li>
        <li>Selections add up without holding Shift, and the whole search lives in the URL so it can be bookmarked or shared.</li>
        <li>Custom formula columns, including values read from datasheet graphs, that you can sort and filter by.</li>
      </ul>

      <h3>Data</h3>
      {index && (
        <p>
          {fmtInt(index.total)} in-stock parts in {index.groups.reduce((s, g) => s + g.cats.length, 0)} categories (merged from{' '}
          {index.source.upstreamCategories} upstream ones). Catalogue snapshot: {new Date(index.source.created).toUTCString()}.
          Stock and prices can be a day old — always confirm on JLCPCB before ordering.
        </p>
      )}
      <p>
        Catalogue data originates from JLCPCB / LCSC and remains theirs; parameters read from datasheets are facts measured off
        the manufacturers' documents, stored with a link to the source and never the documents themselves. Details and the
        reasoning are in the repository's <a href={`${REPO_URL}/blob/main/docs/DATA-POLICY.md`} target="_blank" rel="noreferrer">data policy</a>.
        Estimated values are marked <span className="est">≈</span>; treat them as a shortlist aid, not a design guarantee.
      </p>
      <p>
        Source code (MIT): <a href={REPO_URL} target="_blank" rel="noreferrer">{REPO_URL.replace('https://', '')}</a>
      </p>
    </Dialog>
  );
}
