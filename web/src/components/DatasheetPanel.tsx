import { useState } from 'react';
import type { Category } from '../lib/data';
import { deleteLocalRecord, type DsRecord } from '../lib/dsdata';
import { recipeFor } from '@shared/recipes.js';
import { formatValue } from '@shared/units.js';
import { CurveChart } from './CurveChart';
import { ExtractDialog } from './ExtractDialog';
import { REPO_URL } from './About';

/** Datasheet-derived data for one part: what exists, where it came from, how to add it. */
export function DatasheetPanel(props: { cat: Category; row: number; record: DsRecord | undefined; datasheet: string | null; onChanged: () => void }) {
  const recipe = recipeFor(props.cat.id);
  const [extract, setExtract] = useState(false);
  if (!recipe) return null;
  const rec = props.record;
  const lcsc = `C${props.cat.lcsc[props.row]}`;

  return (
    <>
      <h3>From the datasheet</h3>
      {!rec && (
        <div className="note">
          Nobody has read this part's datasheet graphs yet, so formulas fall back to catalogue values and a generic model
          (marked <span className="est">≈</span>).
        </div>
      )}
      {rec && (
        <>
          {rec.local && (
            <div className="note warn" style={{ marginBottom: 8 }}>
              Saved in this browser only. Contribute it so the next visitor does not have to extract it again.
            </div>
          )}
          {rec.scalars && Object.keys(rec.scalars).length > 0 && (
            <table className="kv"><tbody>
              {Object.entries(rec.scalars).map(([k, v]) => (
                <tr key={k}><td>{recipe.scalars[k]?.label ?? k}</td><td className="r">{formatValue(v, recipe.scalars[k]?.unit)}</td></tr>
              ))}
            </tbody></table>
          )}
          {Object.entries(rec.curves ?? {}).map(([k, c]) => {
            const def = recipe.curves[k];
            if (!def) return null;
            const cond = Object.entries(c.cond ?? {}).filter(([a]) => a !== 'figure').map(([a, b]) => (a === 'note' ? String(b) : `${a} = ${b}`)).join(', ');
            return (
              <div key={k} style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>{def.label}</div>
                {cond && <div className="muted" style={{ fontSize: 12 }}>at {cond}</div>}
                <CurveChart points={c.points} xUnit={def.x.unit} yUnit={def.y.unit} xName={def.x.name} yName={def.y.name} />
              </div>
            );
          })}
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Read from <a href={rec.source.url} target="_blank" rel="noreferrer">the manufacturer's datasheet</a>
            {rec.source.pages ? ` (p. ${rec.source.pages})` : ''}
            {rec.source.method ? `, ${rec.source.method}` : ''}{rec.source.retrieved ? `, ${rec.source.retrieved}` : ''}.
            Digitised graph values are typically within a few percent; check the datasheet before committing to a design.
          </p>
        </>
      )}
      <div className="links" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={() => setExtract(true)}>{rec ? 'Edit / re-extract' : 'Add datasheet data'}</button>
        {rec?.local && (
          <>
            <a
              className="btn sm"
              target="_blank" rel="noreferrer"
              href={`${REPO_URL}/issues/new?title=${encodeURIComponent(`Datasheet data: ${rec.mfr ?? ''} (${lcsc})`)}&labels=datasheet-data&body=${encodeURIComponent(
                `Extracted datasheet data for ${lcsc}. Please add as \`datasheet-data/${rec.recipe}/${lcsc}.json\`.\n\n\`\`\`json\n${JSON.stringify({ ...rec, local: undefined }, null, 2)}\n\`\`\`\n`,
              )}`}
            >Contribute</a>
            <button className="btn sm" onClick={() => { deleteLocalRecord(lcsc); props.onChanged(); }}>Discard</button>
          </>
        )}
      </div>
      {extract && (
        <ExtractDialog
          lcsc={lcsc} mfr={props.cat.mfr[props.row]} description={props.cat.desc[props.row]} recipeKey={recipe.key} datasheet={props.datasheet} existing={rec}
          onClose={() => setExtract(false)}
          onSaved={() => { setExtract(false); props.onChanged(); }}
        />
      )}
    </>
  );
}
