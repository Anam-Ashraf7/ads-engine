// PROTOTYPE: small SVG charts, no chart library.
import { useEffect, useRef, useState } from 'react';
import { shortDate } from './format';

/** Pass `min`/`max` to put several sparks on one shared scale so their shapes compare honestly. */
export function Spark({ values, color = 'var(--c1)', w = 84, h = 22, fill = true, min: lo, max: hi }: { values: number[]; color?: string; w?: number; h?: number; fill?: boolean; min?: number; max?: number }) {
  if (!values.length) return null;
  const max = hi ?? Math.max(...values, 1e-9);
  const min = lo ?? Math.min(...values, 0);
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * w;
  const y = (v: number) => h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return (
    <svg width={w} height={h} className="spark" aria-hidden>
      {fill && <path d={`${d}L${w},${h}L0,${h}Z`} fill={color} opacity={0.12} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/** Draw charts at their real pixel width, so axis text keeps its size on a phone instead of being scaled down. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e.contentRect.width > 0 && setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface Series {
  name: string;
  values: number[];
  color: string;
  dashed?: boolean;
  band?: { low: number[]; high: number[] };
}

export function LineChart({ labels, series, height = 200, width = 640, format = (n: number) => String(Math.round(n)), markerAt }: { labels: string[]; series: Series[]; height?: number; width?: number; format?: (n: number) => string; markerAt?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, W] = useWidth(width);
  const H = height, L = 52, R = 10, T = 10, B = 24;
  const all = series.flatMap((s) => [...s.values, ...(s.band?.high ?? []), ...(s.band?.low ?? [])]).filter((v) => Number.isFinite(v));
  const hi = Math.max(...all, 0);
  const lo = Math.min(...all, 0);
  // Round tick steps on both sides of zero, so loss-making lines stay on the chart.
  const tickStep = niceMax((hi - lo || 1) / 4);
  const max = Math.ceil(hi / tickStep) * tickStep || tickStep;
  const min = Math.floor(lo / tickStep) * tickStep;
  const span = max - min;
  const n = labels.length;
  const x = (i: number) => L + (i / Math.max(1, n - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / span) * (H - T - B);
  const ticks = Array.from({ length: Math.round(span / tickStep) + 1 }, (_, i) => min + i * tickStep);
  const step = Math.ceil(n / (W < 480 ? 3 : 6));
  const path = (vals: number[]) =>
    vals.map((v, i) => (Number.isFinite(v) ? `${i && Number.isFinite(vals[i - 1]) ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}` : '')).join('');
  return (
    <div className="chart" ref={ref}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1)))));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="axis">
              {format(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % step === 0 ? (
            <text key={l} x={x(i)} y={H - 6} textAnchor="middle" className="axis">
              {/^\d{4}-\d{2}-\d{2}$/.test(l) ? shortDate(l) : l}
            </text>
          ) : null,
        )}
        {min < 0 && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="zero" />}
        {markerAt != null && <line x1={x(markerAt)} x2={x(markerAt)} y1={T} y2={H - B} className="marker" />}
        {series.map((s) =>
          s.band ? (
            <path
              key={s.name + 'band'}
              d={`${path(s.band.high)}${s.band.low
                .map((v, i) => ({ v, i }))
                .reverse()
                .filter(({ v }) => Number.isFinite(v))
                .map(({ v, i }) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`)
                .join('')}Z`}
              fill={s.color}
              opacity={0.14}
            />
          ) : null,
        )}
        {series.map((s) => (
          <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" />
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="hoverline" />
            {series.map((s) => (Number.isFinite(s.values[hover]) ? <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={3.5} fill={s.color} /> : null))}
          </g>
        )}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} className={s.dashed ? 'dashed' : ''} />
            {s.name}
            {hover != null && Number.isFinite(s.values[hover]) && <b>{format(s.values[hover])}</b>}
          </span>
        ))}
        {hover != null && <span className="muted">{/^\d{4}-/.test(labels[hover]) ? shortDate(labels[hover]) : labels[hover]}</span>}
      </div>
    </div>
  );
}

export function StackedBars({ labels, stacks, height = 180, format = (n: number) => String(Math.round(n)) }: { labels: string[]; stacks: { name: string; color: string; values: number[] }[]; height?: number; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, W] = useWidth(640);
  const H = height, L = 52, R = 10, T = 10, B = 24;
  const totals = labels.map((_, i) => stacks.reduce((s, st) => s + st.values[i], 0));
  const max = niceMax(Math.max(...totals, 1));
  const bw = (W - L - R) / labels.length;
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const step = Math.ceil(labels.length / (W < 480 ? 3 : 6));
  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(f * max)} y2={y(f * max)} className="grid" />
            <text x={L - 6} y={y(f * max) + 4} textAnchor="end" className="axis">
              {format(f * max)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => {
          let acc = 0;
          return (
            <g key={l} onMouseEnter={() => setHover(i)} opacity={hover == null || hover === i ? 1 : 0.55}>
              {stacks.map((st) => {
                const v = st.values[i];
                const top = y(acc + v);
                const h = y(acc) - top;
                acc += v;
                return <rect key={st.name} x={L + i * bw + 1} y={top} width={Math.max(1, bw - 2)} height={Math.max(0, h)} fill={st.color} />;
              })}
              {i % step === 0 && (
                <text x={L + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="axis">
                  {/^\d{4}-\d{2}-\d{2}$/.test(l) ? shortDate(l) : l}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="legend">
        {stacks.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
            {hover != null && <b>{format(s.values[hover])}</b>}
          </span>
        ))}
        {hover != null && <span className="muted">{/^\d{4}-/.test(labels[hover]) ? shortDate(labels[hover]) : labels[hover]}</span>}
      </div>
    </div>
  );
}

export function Meter({ value, max = 1, tone }: { value: number; max?: number; tone?: 'ok' | 'warn' | 'danger' | 'muted' }) {
  const f = Math.max(0, Math.min(1, value / max));
  const t = tone ?? (value / max > 1.1 ? 'danger' : value / max > 0.95 ? 'warn' : 'ok');
  return (
    <span className="meter">
      <span className={`meter-fill t-${t}`} style={{ width: `${f * 100}%` }} />
    </span>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
