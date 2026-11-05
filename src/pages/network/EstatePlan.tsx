// Site tiles: every site is a tile. Area = ad spend in the period, fill = contribution per €1 spent,
// pattern = state (striped paused, outlined building, struck retired). Tiles are grouped by country.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { kindLine } from '../../data/mock';
import { eur, eurK } from '../../format';
import type { Row } from './rows';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Squarified treemap: lays values (sorted large to small) into a rectangle, keeping cells close to square. */
function squarify(values: number[], box: Rect): Rect[] {
  const out: Rect[] = new Array(values.length);
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) return values.map(() => ({ ...box, w: 0, h: 0 }));
  const scale = (box.w * box.h) / total;
  const areas = values.map((v) => v * scale);
  let { x, y, w, h } = box;
  const worst = (from: number, to: number, side: number) => {
    let sum = 0, mx = 0, mn = Infinity;
    for (let i = from; i < to; i++) (sum += areas[i]), (mx = Math.max(mx, areas[i])), (mn = Math.min(mn, areas[i]));
    const s2 = sum * sum, side2 = side * side;
    return Math.max((side2 * mx) / s2, s2 / (side2 * mn));
  };
  const place = (from: number, to: number) => {
    let sum = 0;
    for (let i = from; i < to; i++) sum += areas[i];
    if (w >= h) {
      const cw = sum / h;
      let cy = y;
      for (let i = from; i < to; i++) {
        const ch = areas[i] / cw;
        out[i] = { x, y: cy, w: cw, h: ch };
        cy += ch;
      }
      x += cw;
      w -= cw;
    } else {
      const ch = sum / w;
      let cx = x;
      for (let i = from; i < to; i++) {
        const cw = areas[i] / ch;
        out[i] = { x: cx, y, w: cw, h: ch };
        cx += cw;
      }
      y += ch;
      h -= ch;
    }
  };
  let start = 0;
  let end = 1;
  while (start < areas.length) {
    const side = Math.min(w, h);
    if (end < areas.length && worst(start, end + 1, side) <= worst(start, end, side)) {
      end++;
    } else {
      place(start, end);
      start = end;
      end = start + 1;
    }
  }
  return out;
}

const HEADER = 22; // px reserved for each district's label
// Contribution per €1 spent is clamped to this range for the wash; the legend ramp shows the same steps.
const RAMP = [-1, -0.5, -0.2, 0, 0.2, 0.5, 1];
const isDeep = (ratio: number) => Math.abs(ratio) >= 0.75;
const washOf = (ratio: number) =>
  isDeep(ratio)
    ? `var(${ratio < 0 ? '--loss-deep' : '--gain-deep'})`
    : `color-mix(in srgb, var(${ratio < 0 ? '--loss' : '--gain'}) ${Math.round(Math.min(1, Math.abs(ratio) / 0.75) * 47 + 8)}%, var(--parcel))`;
// Tiles are small, so drop the shared parts of names ("MedfordVoices" → "Medford"); hover shows the full name.
const shortName = (name: string) => name.replace(/Voices$/, '').replace(/^What's On /, '');

const HIDE_KEY = 'ae.glance.hidden';
function savedHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}

// Touch screens have no hover: the first tap reads a tile, the readout links to the site.
const TOUCH = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;

export function EstatePlan({ rows, range }: { rows: Row[]; range: number }) {
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1100, h: 400 });
  const [hover, setHover] = useState<Row | null>(null);
  const [hidden, setHiddenState] = useState(savedHidden);
  const setHidden = (h: boolean) => {
    setHiddenState(h);
    try {
      localStorage.setItem(HIDE_KEY, h ? '1' : '0');
    } catch {}
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hidden]);

  const plan = useMemo(() => {
    const totalSpend = rows.reduce((a, r) => a + r.m.spend, 0);
    // Sites without spend still get a small tile so they stay visible.
    const floor = Math.max(1, (totalSpend / Math.max(1, rows.length)) * 0.12);
    const value = (r: Row) => Math.max(r.m.spend, floor);
    const byCountry = new Map<string, Row[]>();
    for (const r of rows) byCountry.set(r.s.country, [...(byCountry.get(r.s.country) ?? []), r]);
    const districts = [...byCountry.entries()]
      .map(([name, rs]) => ({ name, rs: [...rs].sort((a, b) => value(b) - value(a)), total: rs.reduce((a, r) => a + value(r), 0) }))
      .sort((a, b) => b.total - a.total);
    const grand = districts.reduce((a, d) => a + d.total, 0);
    const dRects = squarify(
      districts.map((d) => d.total),
      { x: 0, y: 0, w: size.w, h: size.h },
    );
    // Area scale: pick a round € amount whose square is a readable size.
    const perPx = grand / Math.max(1, size.w * (size.h - HEADER));
    const scaleEur = [50, 100, 200, 500, 1000, 2000, 5000].find((v) => Math.sqrt(v / perPx) >= 22) ?? 5000;
    return {
      scale: { eur: scaleEur, side: Math.min(44, Math.sqrt(scaleEur / perPx)) },
      districts: districts.map((d, i) => {
        const r = dRects[i];
        const inner = { x: 0, y: 0, w: Math.max(0, r.w - 2), h: Math.max(0, r.h - HEADER - 2) };
        return {
          ...d,
          i,
          rect: r,
          contribution: d.rs.reduce((a, x) => a + x.m.contribution, 0),
          parcels: squarify(d.rs.map(value), inner).map((p, j) => ({ row: d.rs[j], p })),
        };
      }),
    };
  }, [rows, size]);

  if (hidden)
    return (
      <section className="plan-wrap plan-hidden" aria-label="Sites as tiles (hidden)">
        <header className="plan-head">
          <h2>Sites at a glance</h2>
          <span className="small muted">Hidden. The site table below has the same numbers.</span>
          <span className="spacer" />
          <button className="btn sm" onClick={() => setHidden(false)} aria-expanded={false}>
            Show
          </button>
        </header>
      </section>
    );

  return (
    <section className="plan-wrap" aria-label="Sites as tiles">
      <header className="plan-head">
        <h2>Sites at a glance</h2>
        <span className="small muted">
          Area is ad spend over {range} days; colour is contribution per €1 spent. A corner dot means the site is also on Meta. {TOUCH ? 'Tap a tile to read it.' : 'Click a tile to open the site.'}
        </span>
        <span className="spacer" />
        <Legend scale={plan.scale} />
        <button className="btn sm" onClick={() => setHidden(true)} aria-expanded title="Hide the tiles; the table below has the same numbers">
          Hide
        </button>
      </header>
      {/* keyed on the range so the wash inks in again when the period changes */}
      <div className="plan" ref={ref} key={range} onMouseLeave={() => setHover(null)}>
        {plan.districts.map((d) => (
          <div key={d.name} className="district" style={{ left: d.rect.x, top: d.rect.y, width: d.rect.w, height: d.rect.h, ['--i' as string]: d.i }}>
            {/* narrow districts drop the site count so the total stays readable */}
            <div className="district-label" title={`${d.name}: ${d.rs.length} sites, contribution ${eur(d.contribution)}`}>
              <b>{d.name}</b>
              {d.rect.w >= 180 && <span>{d.rs.length} sites</span>}
              <span className={d.contribution < 0 ? 'bad' : 'good'}>{eurK(d.contribution)}</span>
            </div>
            <div className="district-body" style={{ height: d.rect.h - HEADER }}>
              {d.parcels.map(({ row, p }) => {
                const ratio = row.m.spend > 0 ? row.m.contribution / row.m.spend : row.m.contribution > 0 ? 1 : 0;
                const deep = isDeep(ratio) && row.state === 'Live';
                const named = p.w > 58 && p.h > 26;
                const valued = p.w > 46 && p.h > 40;
                return (
                  <button
                    key={row.s.id}
                    className={`parcel st-${row.state}${deep ? ' deep' : ''}${hover?.s.id === row.s.id ? ' on' : ''}${row.alerts.some((a) => a.severity === 'Critical') ? ' flag' : ''}`}
                    style={{ left: p.x, top: p.y, width: p.w, height: p.h, ['--wash' as string]: washOf(ratio) }}
                    onMouseEnter={() => setHover(row)}
                    onFocus={() => setHover(row)}
                    onClick={() => (TOUCH && hover?.s.id !== row.s.id ? setHover(row) : nav(`/sites/${row.s.id}`))}
                    aria-label={`${row.s.name}, ${row.state}, ads on ${row.ads.label}, spend ${eur(row.m.spend)}, contribution ${eur(row.m.contribution)}`}
                  >
                    {row.ads.meta.running > 0 && <i className="pmeta" aria-hidden />}
                    {named && <span className="pname">{shortName(row.s.name)}</span>}
                    {valued && <span className="pval">{eurK(row.m.contribution)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="schedule" aria-live="polite">
        {hover ? (
          <>
            <b>{hover.s.name}</b>
            <span className="muted">
              {hover.s.country} · {kindLine(hover.s)} · {hover.state}
            </span>
            <span className="spacer" />
            <span>Ads on: {hover.ads.label}</span>
            <span>Spend {eur(hover.m.spend)}</span>
            <span>Revenue {eur(hover.m.revenue)}</span>
            <b className={hover.m.contribution < 0 ? 'bad' : 'good'}>Contribution {eur(hover.m.contribution)}</b>
            {hover.alerts.length > 0 && <span className="bad">{hover.alerts.length} alert{hover.alerts.length > 1 ? 's' : ''}</span>}
            {TOUCH && (
              <Link to={`/sites/${hover.s.id}`} className="btn sm">
                Open site
              </Link>
            )}
          </>
        ) : (
          <span className="muted">{TOUCH ? 'Tap' : 'Hover'} a tile to read its numbers. A red dot marks a critical alert.</span>
        )}
      </div>
    </section>
  );
}

function Legend({ scale }: { scale: { eur: number; side: number } }) {
  return (
    <div className="plan-legend">
      <div className="ramp" aria-label="Contribution per €1 spent">
        <div className="ramp-cells">
          {RAMP.map((v) => (
            <i key={v} style={{ background: v === 0 ? 'var(--parcel)' : washOf(v) }} />
          ))}
        </div>
        <div className="ramp-labels">
          <span>−€1</span>
          <span>€0</span>
          <span>+€1 per €1</span>
        </div>
      </div>
      <div className="area-scale">
        <i style={{ width: scale.side, height: scale.side }} />
        <span>= {eur(scale.eur)} spend</span>
      </div>
      <div className="state-key">
        <span>
          <i className="sw st-Paused" />
          Paused
        </span>
        <span>
          <i className="sw st-Building" />
          Building
        </span>
        <span>
          <i className="sw st-Retired" />
          Retired
        </span>
      </div>
    </div>
  );
}
