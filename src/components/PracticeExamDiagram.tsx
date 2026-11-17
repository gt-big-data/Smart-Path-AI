import { useId } from 'react';
import type { ExamDiagram } from '../../server/services/practiceExamDiagram';

const colors = ['#0f766e', '#b45309', '#4338ca', '#be123c', '#0369a1', '#4d7c0f'];
const tick = (n: number) => Number(n.toPrecision(5)).toString();
function ticks(min: number, max: number) {
  const unit = 10 ** Math.floor(Math.log10((max - min) / 8));
  const step = [1, 2, 2.5, 5, 10].find(n => n * unit >= (max - min) / 8)! * unit;
  const first = Math.ceil(min / step) * step;
  return Array.from({ length: Math.floor((max - first) / step + 1e-9) + 1 }, (_, i) => first + i * step);
}

function edgeGeometry(sx: number, sy: number, tx: number, ty: number, curved: boolean) {
  if (sx === tx && sy === ty) {
    const length = Math.hypot(51, 70);
    return { path: `M ${sx - 14} ${sy - 15} C ${sx - 65} ${sy - 85} ${sx + 65} ${sy - 85} ${sx + 14} ${sy - 15}`,
      endX: sx + 14, endY: sy - 15, ux: -51 / length, uy: 70 / length, labelX: sx, labelY: sy - 65 };
  }
  const dx = tx - sx, dy = ty - sy, length = Math.hypot(dx, dy);
  const bend = curved ? 50 : 0;
  const cx = (sx + tx) / 2 - dy / length * bend;
  const cy = (sy + ty) / 2 + dx / length * bend;
  const startLength = Math.hypot(cx - sx, cy - sy), endLength = Math.hypot(tx - cx, ty - cy);
  const inset = Math.min(23, length / 3);
  const startX = sx + (cx - sx) / startLength * inset, startY = sy + (cy - sy) / startLength * inset;
  const ux = (tx - cx) / endLength, uy = (ty - cy) / endLength;
  const endX = tx - ux * inset, endY = ty - uy * inset;
  return { path: `M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`, endX, endY, ux, uy,
    labelX: (startX + 2 * cx + endX) / 4 - (curved ? dy / length * 10 : 0),
    labelY: (startY + 2 * cy + endY) / 4 + (curved ? dx / length * 10 : -9) };
}

export default function PracticeExamDiagram({ diagram: d }: { diagram: ExamDiagram }) {
  const id = useId().replace(/:/g, '');
  const titleId = `${id}-title`;
  const x = (v: number) => d.kind === 'plot' ? 85 + (v - d.x_min) / (d.x_max - d.x_min) * 470 : 95 + v * 450;
  const y = (v: number) => d.kind === 'plot' ? 335 - (v - d.y_min) / (d.y_max - d.y_min) * 280 : 90 + v * 240;
  return <figure className="my-4 max-w-2xl rounded-lg border bg-white p-3">
    <svg viewBox="0 0 640 420" role="img" aria-labelledby={titleId} className="w-full" style={{ minWidth: 280 }}>
      <title id={titleId}>{d.caption}</title>
      <rect width="640" height="420" fill="white" />
      {d.kind === 'plot' ? <>
        {ticks(d.x_min, d.x_max).map((v, i) => <g key={`x${i}`} fontSize="12" fill="#334155">
          <path d={`M ${x(v)} 55 V 335`} stroke="#e2e8f0" />
          <text x={x(v)} y="355" textAnchor="middle">{tick(v)}</text>
        </g>)}
        {ticks(d.y_min, d.y_max).map((v, i) => <g key={`y${i}`} fontSize="12" fill="#334155">
          <path d={`M 85 ${y(v)} H 555`} stroke="#e2e8f0" />
          <text x="77" y={y(v) + 4} textAnchor="end">{tick(v)}</text>
        </g>)}
        <path d="M 85 55 V 335 H 555" fill="none" stroke="#334155" strokeWidth="2" />
        {d.x_min < 0 && d.x_max > 0 && <path d={`M ${x(0)} 55 V 335`} stroke="#64748b" />}
        {d.y_min < 0 && d.y_max > 0 && <path d={`M 85 ${y(0)} H 555`} stroke="#64748b" />}
        <text x="320" y="382" textAnchor="middle" fontSize="14">{d.x_label}</text>
        <text transform="translate(18 195) rotate(-90)" textAnchor="middle" fontSize="14">{d.y_label}</text>
        {d.series.map((s, i) => <g key={i} fill={colors[i]} stroke={colors[i]}>
          {s.style === 'line' && <polyline points={s.points.map(p => `${x(p.x)},${y(p.y)}`).join(' ')} fill="none" strokeWidth="2.5" />}
          {s.points.map((p, j) => <circle key={j} cx={x(p.x)} cy={y(p.y)} r="3"><title>{`${s.label}: (${p.x}, ${p.y})`}</title></circle>)}
        </g>)}
      </> : <>
        {d.edges.map((e, i) => {
          const source = d.nodes.find(n => n.id === e.source)!;
          const target = d.nodes.find(n => n.id === e.target)!;
          const reciprocal = e.source !== e.target && d.edges.some(other => other.source === e.target && other.target === e.source);
          const { path, endX, endY, ux, uy, labelX, labelY } = edgeGeometry(
            x(source.x), y(source.y), x(target.x), y(target.y), reciprocal);
          return <g key={i}>
            <path d={path} fill="none" stroke="#334155" strokeWidth="2" />
            {e.directed && <polygon fill="#334155" points={[
              `${endX},${endY}`, `${endX - ux * 12 + uy * 5},${endY - uy * 12 - ux * 5}`,
              `${endX - ux * 12 - uy * 5},${endY - uy * 12 + ux * 5}`,
            ].join(' ')} />}
            {e.label && <rect x={labelX - e.label.length * 4 - 4} y={labelY - 13}
              width={e.label.length * 8 + 8} height="17" fill="white" />}
            <text x={labelX} y={labelY} textAnchor="middle" fontSize="13">{e.label}</text>
          </g>;
        })}
        {d.nodes.map(n => <g key={n.id}>
          <circle cx={x(n.x)} cy={y(n.y)} r="20" fill="#f0fdfa" stroke="#0f766e" strokeWidth="2" />
          <text x={x(n.x)} y={y(n.y) + 38} textAnchor="middle" fontSize="13">{n.label}</text>
        </g>)}
      </>}
    </svg>
    <figcaption className="text-sm text-slate-700">{d.caption}</figcaption>
    {d.kind === 'plot' && <ul className="mt-2 flex flex-wrap gap-4 text-sm" aria-label="Data series">
      {d.series.map((s, i) => <li key={i} style={{ color: colors[i] }}>{i + 1}. {s.label}</li>)}
    </ul>}
  </figure>;
}
