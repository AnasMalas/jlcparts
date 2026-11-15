import { formatValue } from '@shared/units.js';

function ticks(min: number, max: number, n = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Number(v.toPrecision(10)));
  return out;
}

/** A small line chart for one digitised datasheet curve. */
export function CurveChart(props: { points: [number, number][]; xUnit: string; yUnit: string; xName: string; yName: string }) {
  const W = 430, H = 190, L = 58, R = 12, T = 12, B = 34;
  const xs = props.points.map((p) => p[0]), ys = props.points.map((p) => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 > 0 && y0 < (y1 - y0) * 3) y0 = 0; // anchor at zero when that is honest
  if (y1 === y0) { y1 += 1; y0 -= 1; }
  if (x1 === x0) { x1 += 1; x0 -= 1; }
  const pad = (y1 - y0) * 0.06;
  y1 += pad;
  const sx = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = (y: number) => H - B - ((y - y0) / (y1 - y0)) * (H - T - B);
  const d = props.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${props.yName} versus ${props.xName}`}>
      {ticks(y0, y1).map((v) => (
        <g key={`y${v}`}>
          <line className="gridline" x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} />
          <text x={L - 6} y={sy(v) + 3} textAnchor="end">{formatValue(v, props.yUnit, 3)}</text>
        </g>
      ))}
      {ticks(x0, x1, 5).map((v) => (
        <g key={`x${v}`}>
          <line className="gridline" x1={sx(v)} x2={sx(v)} y1={T} y2={H - B} />
          <text x={sx(v)} y={H - B + 13} textAnchor="middle">{formatValue(v, props.xUnit, 3)}</text>
        </g>
      ))}
      <line className="axis" x1={L} x2={W - R} y1={H - B} y2={H - B} />
      <line className="axis" x1={L} x2={L} y1={T} y2={H - B} />
      <path className="line" d={d} />
      {props.points.map((p, i) => (<circle key={i} className="dot" cx={sx(p[0])} cy={sy(p[1])} r={2.4}><title>{`${formatValue(p[0], props.xUnit)} → ${formatValue(p[1], props.yUnit)}`}</title></circle>))}
      <text className="title" x={(L + W - R) / 2} y={H - 4} textAnchor="middle">{props.xName}</text>
    </svg>
  );
}
