// Variant C: the exception queue is the page. Network numbers and movers sit to the side.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../state';
import { LineChart } from '../../charts';
import { alerts, campaignById, kindLine, OWNERS, siteById, sumMetrics, type AlertType } from '../../data/mock';
import { compact, delta, eur, eurK } from '../../format';
import { Icon } from '../../icons';
import { explain, Num, type Explain } from '../../provenance';
import { Act, Card, Kpi, Placeholder } from '../../ui';
import type { Row } from './rows';

const TYPES: AlertType[] = ['Spend over cap', 'Cost per click jumped', 'Traffic dropped', 'SEO problem', 'Tracking broken', 'Invoice overdue', 'Google Ads issue', 'Meta issue', 'Learning limited', 'Ad wearing out'];

export function VariantC({ rows }: { rows: Row[] }) {
  const { range, overrides, override } = useApp();
  const [type, setType] = useState<AlertType | ''>('');
  const [who, setWho] = useState<'all' | 'unassigned'>('all');
  const [showDone, setShowDone] = useState(false);
  const ids = useMemo(() => new Set(rows.map((r) => r.s.id)), [rows]);
  const ownerOf = (id: string, base: string | null) => (overrides[`alert:${id}`] === undefined ? base : overrides[`alert:${id}`] || null);
  const closed = (id: string) => overrides[`alert-done:${id}`] === '1' || !!alerts.find((a) => a.id === id)?.resolved;
  const inScope = alerts.filter((a) => ids.has(a.siteId) && !closed(a.id));
  const done = alerts.filter((a) => ids.has(a.siteId) && closed(a.id));
  // Critical first, then newest; handled items wait at the end.
  const queue = inScope
    .filter((a) => (!type || a.type === type) && (who === 'all' || !ownerOf(a.id, a.owner)))
    .sort((a, b) => (a.severity === b.severity ? b.detected.localeCompare(a.detected) : a.severity === 'Critical' ? -1 : 1));

  const tot = sumMetrics(rows.map((r) => r.m));
  const prev = sumMetrics(rows.map((r) => r.prev));
  const movers = [...rows].filter((r) => r.prev.contribution || r.m.contribution).sort((a, b) => a.m.contribution - a.prev.contribution - (b.m.contribution - b.prev.contribution));

  // daily revenue (AdSense + sponsor fees spread per day) against ad spend
  const days = rows[0]?.s.days.slice(-range) ?? [];
  const at = (r: Row, i: number) => r.s.days[r.s.days.length - range + i];
  const spendDaily = days.map((_, i) => rows.reduce((s, r) => s + at(r, i).spend, 0));
  const sponsorPerDay = tot.sponsor / Math.max(1, range);
  const revenueDaily = days.map((_, i) => rows.reduce((s, r) => s + at(r, i).adsense, 0) + sponsorPerDay);

  return (
    <div className="grid g-side">
      <Card
        flush
        title={
          <>
            Exception queue <span className="muted">· {queue.length} open</span>
          </>
        }
        extra={
          <div className="seg">
            <button className={who === 'all' ? 'on' : ''} onClick={() => setWho('all')}>
              All
            </button>
            <button className={who === 'unassigned' ? 'on' : ''} onClick={() => setWho('unassigned')}>
              Unassigned ({inScope.filter((a) => !ownerOf(a.id, a.owner)).length})
            </button>
          </div>
        }
      >
        <div className="row" style={{ padding: '10px 14px 4px' }}>
          <button className={`btn sm ${type === '' ? 'primary' : ''}`} onClick={() => setType('')}>
            All types
          </button>
          {TYPES.map((t) => {
            const n = inScope.filter((a) => a.type === t).length;
            return (
              <button key={t} className={`btn sm ${type === t ? 'primary' : ''}`} onClick={() => setType(type === t ? '' : t)} disabled={!n}>
                {t} <span className="muted">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="list" style={{ marginTop: 6 }}>
          {queue.map((a) => {
            const s = siteById.get(a.siteId)!;
            const c = a.campaignId ? campaignById.get(a.campaignId) : null;
            const owner = ownerOf(a.id, a.owner);
            return (
              <div key={a.id} className="item">
                <span className={`sev ${a.severity}`} />
                <div className="item-main">
                  <div className="row" style={{ gap: 6 }}>
                    <span className={`pill ${a.severity === 'Critical' ? 't-danger' : 't-warn'}`}>{a.severity}</span>
                    <span className="item-title">{a.type}</span>
                    <span className="muted">·</span>
                    <Link to={`/sites/${s.id}`}>{s.name}</Link>
                    {c && <span className="tag">{c.name}</span>}
                  </div>
                  <div style={{ marginTop: 3 }}>{a.message}</div>
                  <div className="item-meta">
                    Detected {a.detected} · {s.country}
                     · {kindLine(s)}
                  </div>
                </div>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <select
                    aria-label="Owner"
                    value={owner ?? ''}
                    style={{ height: 26, fontSize: 12, color: owner ? undefined : 'var(--danger)' }}
                    onChange={(e) => override(`alert:${a.id}`, e.target.value, e.target.value ? `Assigned to ${e.target.value} (mockup)` : 'Unassigned (mockup)')}
                  >
                    <option value="">Unassigned</option>
                    {OWNERS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                  <Act action="assignOwner" kind="sm" onClick={() => override(`alert-done:${a.id}`, '1', `Marked “${a.type}” on ${s.name} as handled (mockup)`)}>
                    Resolve
                  </Act>
                </div>
              </div>
            );
          })}
          {!queue.length && <div className="item muted">No open problems match these filters.</div>}
          {done.length > 0 && (
            <button className="item done-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
              <span className="caret">{showDone ? Icon.chevronDown() : Icon.chevronRight()}</span>
              {done.length} resolved today
            </button>
          )}
          {showDone &&
            done.map((a) => {
            const s = siteById.get(a.siteId)!;
            return (
              <div key={a.id} className="item done" style={{ alignItems: 'center' }}>
                <span className={`sev ${a.severity}`} />
                <div className="item-main">
                  <span className="item-title">{a.type}</span> · {s.name}
                  <div className="msg small">{a.message}</div>
                </div>
                <span className="small muted nowrap">{a.resolved ?? 'You · just now'}</span>
                <span className="stamp">Resolved</span>
              </div>
            );
            })}

        </div>
      </Card>

      <div className="stack">
        <div className="kpis two">
          <Kpi label={<Placeholder>Contribution</Placeholder>} value={eurK(tot.contribution)} change={delta(tot.contribution, prev.contribution)} info={explain('contribution', tot, range, `these ${rows.length} sites`)} />
          <Kpi label="Ad spend" value={eurK(tot.spend)} change={delta(tot.spend, prev.spend)} goodWhenUp={false} info={explain('spend', tot, range, `these ${rows.length} sites`)} />
          <Kpi label="Qualified visits" value={compact(tot.visits)} change={delta(tot.visits, prev.visits)} info={explain('visits', tot, range, `these ${rows.length} sites`)} />
          <Kpi label="Sponsors + AdSense" value={eurK(tot.revenue)} change={delta(tot.revenue, prev.revenue)} info={explain('revenue', tot, range, `these ${rows.length} sites`)} />
        </div>
        <Card title="Revenue vs ad spend per day">
          <LineChart
            labels={days.map((d) => d.date)}
            width={360}
            height={190}
            format={eurK}
            series={[
              { name: 'Revenue', values: revenueDaily, color: 'var(--c3)' },
              { name: 'Ad spend', values: spendDaily, color: 'var(--c2)' },
            ]}
          />
          <div className="small muted">Sponsor fees are monthly, so they're spread evenly over the days.</div>
        </Card>
        <Card title="Biggest drops" flush>
          <Movers rows={movers.slice(0, 5)} range={range} />
        </Card>
        <Card title="Biggest gains" flush>
          <Movers rows={movers.slice(-5).reverse()} range={range} />
        </Card>
      </div>
    </div>
  );
}

function Movers({ rows, range }: { rows: Row[]; range: number }) {
  return (
    <div className="list" style={{ marginTop: 8 }}>
      {rows.map((r) => {
        const d = r.m.contribution - r.prev.contribution;
        return (
          <div key={r.s.id} className="item" style={{ alignItems: 'center' }}>
            <div className="item-main">
              <Link to={`/sites/${r.s.id}`} className="site-name">
                {r.s.name}
              </Link>
              <div className="item-meta">
                {kindLine(r.s)} · {r.s.country}
              </div>
            </div>
            <span className={d >= 0 ? 'good' : 'bad'} style={{ fontWeight: 650 }}>
              <Num info={moverInfo(r, range)}>
                {d >= 0 ? '+' : ''}
                {eur(d)}
              </Num>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The change in contribution, shown as this period against the one before. */
function moverInfo(r: Row, range: number): Explain {
  const now = explain('contribution', r.m, range, r.s.name);
  return {
    ...now,
    key: 'contribution-change',
    title: 'Change in contribution',
    what: <>How {r.s.name}'s contribution moved: the last {range} days against the {range} days before.</>,
    formula: [
      { label: `Last ${range} days`, value: eur(r.m.contribution) },
      { op: '−', label: `${range} days before`, value: eur(r.prev.contribution) },
    ],
    result: { label: 'Change', value: eur(r.m.contribution - r.prev.contribution) },
    // a part that was zero in both periods explains nothing, so it is left out
    breakdown: (
      [
        ['Sponsors', r.prev.sponsor, r.m.sponsor],
        ['AdSense', r.prev.adsense, r.m.adsense],
        ['Ad spend', r.prev.spend, r.m.spend],
      ] as const
    )
      .filter(([, before, now]) => before || now)
      .map(([label, before, now]) => ({ label, value: `${eur(before)} → ${eur(now)}` })),
  };
}
