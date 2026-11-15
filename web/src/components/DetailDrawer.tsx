import { useEffect, useState } from 'react';
import { CLASS_NAMES, datasheetUrl, imageUrl, jlcUrl, lcscUrl, priceAt, type Category, type Column } from '../lib/data';
import { cellText } from '../lib/format';
import type { DsRecord } from '../lib/dsdata';
import { Icon, fmtInt } from './ui';
import { DatasheetPanel } from './DatasheetPanel';

const money = (x: number) => (x < 1 ? `$${Number(x.toPrecision(3))}` : `$${x.toFixed(2)}`);

export function DetailDrawer(props: {
  cat: Category;
  row: number;
  cols: Column[];
  computed: Column[];
  qty: number;
  fav: boolean;
  onFav: () => void;
  onClose: () => void;
  record: DsRecord | undefined;
  onDataChanged: () => void;
}) {
  const { cat, row, qty } = props;
  const lcsc = cat.lcsc[row];
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [props]);
  useEffect(() => setCopied(false), [row]);

  const breaks = cat.price[row];
  const ds = datasheetUrl(cat.ds[row]);
  const img = cat.img[row];
  const cls = cat.cls[row];
  const unit = priceAt(breaks, qty);
  const params = props.cols.filter((c) => !c.builtin && !c.computed).map((c) => [c, cellText(c, row)] as const).filter(([, t]) => t);

  return (
    <aside className="drawer" aria-label="Part details">
      <header>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{cat.mfr[row] || `C${lcsc}`}</h2>
          <div className="sub">
            <span className="mono">C{lcsc}</span>
            <button
              className="btn sm ghost icon" title="Copy LCSC code" aria-label="Copy LCSC code"
              onClick={() => { navigator.clipboard?.writeText(`C${lcsc}`).then(() => setCopied(true), () => {}); }}
            ><Icon.copy /></button>
            {copied && <span className="muted">copied</span>}
            <span className={`badge c${cls}`}>{CLASS_NAMES[cls]}</span>
            <span>{fmtInt(cat.stock[row])} in stock</span>
          </div>
        </div>
        <button className={`btn ghost icon${props.fav ? ' on' : ''}`} onClick={props.onFav} title={props.fav ? 'Remove from favourites' : 'Add to favourites'} aria-label="Favourite"><Icon.star /></button>
        <button className="btn ghost icon" onClick={props.onClose} aria-label="Close details"><Icon.close /></button>
      </header>
      <div className="body">
        {img && <img className="partimg" src={imageUrl(img)} alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
        <div className="links">
          <a className="btn sm primary" href={jlcUrl(lcsc)} target="_blank" rel="noreferrer">JLCPCB <Icon.ext /></a>
          <a className="btn sm" href={lcscUrl(lcsc)} target="_blank" rel="noreferrer">LCSC <Icon.ext /></a>
          {ds && <a className="btn sm" href={ds} target="_blank" rel="noreferrer">Datasheet <Icon.ext /></a>}
        </div>
        <p className="desc">{cat.desc[row]}</p>
        {cls === 2 && <div className="note">Extended part: JLCPCB adds a one-off loading fee per extended part type on an assembly order.</div>}

        {props.computed.length > 0 && (
          <>
            <h3>Your formulas</h3>
            <table className="kv"><tbody>
              {props.computed.map((c) => {
                const t = cellText(c, row);
                return (
                  <tr key={c.id}>
                    <td title={c.help}>ƒ {c.name}</td>
                    <td className="r">{t ? <>{c.est?.[row] ? <span className="est" title="Estimate from a generic model">≈ </span> : null}{t}</> : <span className="na">{c.note?.[row] ?? 'n/a'}</span>}</td>
                  </tr>
                );
              })}
            </tbody></table>
          </>
        )}

        <h3>Price (USD)</h3>
        <table className="kv"><tbody>
          {Array.from({ length: breaks.length / 2 }, (_, i) => {
            const q = breaks[i * 2], p = breaks[i * 2 + 1];
            const next = breaks[i * 2 + 2];
            const active = qty >= q && (next === undefined || qty < next);
            return (
              <tr key={q} className={active ? 'hl' : ''}>
                <td>{fmtInt(q)}+</td>
                <td className="r">{money(p)}</td>
              </tr>
            );
          })}
          {!Number.isNaN(unit) && qty > 1 && (
            <tr><td>{fmtInt(qty)} pcs total</td><td className="r">{money(unit * qty)}</td></tr>
          )}
        </tbody></table>

        <h3>Parameters</h3>
        <table className="kv"><tbody>
          {params.map(([c, t]) => (
            <tr key={c.id}><td>{c.name}</td><td>{t}{c.filled?.[row] ? <sup title="Not in the catalogue; read from the datasheet"> d</sup> : null}</td></tr>
          ))}
          {cat.joints[row] > 0 && <tr><td>Solder joints</td><td>{cat.joints[row]}</td></tr>}
        </tbody></table>

        <DatasheetPanel cat={cat} row={row} record={props.record} datasheet={ds} onChanged={props.onDataChanged} />
      </div>
    </aside>
  );
}
