// PROTOTYPE: site detail. One version only; the variant question is being asked on the network screen.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state';
import { LineChart, Meter, StackedBars } from '../charts';
import {
  alertsBySite,
  campaignMetrics,
  campaignsBySite,
  dealsBySite,
  monthToDate,
  OWNERS,
  siteById,
  siteMetrics,
  sites,
  sponsorIncome,
  tests,
  dateOf,
  DAYS_INTO_MONTH,
  DAYS_IN_MONTH,
  LAST_DAY,
  type Site,
} from '../data/mock';
import { compact, delta, eur, eurK, num, pct, shortDate } from '../format';
import { Icon } from '../icons';
import { ActivityLog, explain, explainCap } from '../provenance';
import { Act, Card, Kpi, Modal, Pill, Placeholder, RiskPill, StatePill } from '../ui';
import { siteRisk } from '../data/mock';
import { campaignTotals, frequencyOf, learningOf, metaLimitOf, metaBySite, platformStopped } from '../data/meta';
import { AdPlatformsCard, AdsOnLine, TestModal } from './SiteAds';

const SOURCES = [
  { key: 'organic', name: 'Organic search', color: 'var(--c3)' },
  { key: 'paid', name: 'Google Ads', color: 'var(--c1)' },
  { key: 'metaPaid', name: 'Meta ads', color: 'var(--c-meta)' },
  { key: 'direct', name: 'Direct', color: 'var(--c4)' },
  { key: 'referral', name: 'Referral', color: 'var(--c2)' },
  { key: 'social', name: 'Social', color: 'var(--c5)' },
] as const;

export function SitePage() {
  const { id } = useParams();
  const s = siteById.get(id ?? '');
  if (!s) return <div className="card">Site not found. <Link to="/">Back to network</Link></div>;
  return <SiteDetail key={s.id} s={s} />;
}

function SiteDetail({ s }: { s: Site }) {
  const nav = useNavigate();
  const { range, siteState, override, overrides, toast, globalPause } = useApp();
  const state = siteState(s.id, s.state);
  const cap = Number(overrides[`cap:${s.id}`] ?? s.monthlyCap);
  const [modal, setModal] = useState<null | 'state' | 'cap' | 'test' | 'task'>(null);

  const m = siteMetrics(s, range);
  const p = siteMetrics(s, range, 1);
  const mtd = monthToDate(s);
  const days = s.days.slice(-range);
  const cs = campaignsBySite.get(s.id) ?? [];
  const metaC = metaBySite.get(s.id);
  const sourcesHere = SOURCES.filter((x) => x.key !== 'metaPaid' || metaC);
  const ds = dealsBySite.get(s.id) ?? [];
  const as = alertsBySite.get(s.id) ?? [];
  const ts = tests.filter((t) => t.siteId === s.id);
  const risk = siteRisk(s);
  const idx = sites.findIndex((x) => x.id === s.id);
  const prevSite = sites[(idx - 1 + sites.length) % sites.length];
  const nextSite = sites[(idx + 1) % sites.length];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'j' || e.key === 'J') nav(`/sites/${nextSite.id}`);
      if (e.key === 'k' || e.key === 'K') nav(`/sites/${prevSite.id}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, nextSite.id, prevSite.id]);

  return (
    <>
      <div className="page-head">
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="crumbs">
            <Link to="/">Network</Link> / {s.country}
            {s.region ? ` / ${s.region}` : ''} / {s.city ?? s.group}
          </div>
          <div className="row" style={{ gap: 10 }}>
            <h1>{s.name}</h1>
            <StatePill state={state} />
            <RiskPill risk={risk} />
          </div>
          <div className="row small" style={{ marginTop: 6 }}>
            <a href={`https://${s.domain}`} onClick={(e) => e.preventDefault()} className="mono">
              {s.domain}
            </a>
            <span className="tag">{s.kind === 'Local' ? `Local · ${s.size}` : s.kind}</span>
            {s.group && <span className="tag">{s.group}</span>}
            <span className="tag">{s.domainType}</span>
            <span className="tag">Cohort {s.launchCohort}</span>
            <span className="muted">Owner {s.owner} · live since {shortDate(s.launchDate)} {s.launchDate.slice(0, 4)}</span>
          </div>
          <AdsOnLine s={s} state={state} />
        </div>
        <div className="row">
          <div className="seg" role="group" aria-label="Move between sites">
            <button onClick={() => nav(`/sites/${prevSite.id}`)} title={`Previous: ${prevSite.name} (K)`} aria-label="Previous site">
              {Icon.arrowLeft(14)}
            </button>
            <button onClick={() => nav(`/sites/${nextSite.id}`)} title={`Next: ${nextSite.name} (J)`} aria-label="Next site">
              {Icon.arrowRight(14)}
            </button>
          </div>
          <select aria-label="Jump to site" value={s.id} onChange={(e) => nav(`/sites/${e.target.value}`)} style={{ maxWidth: 200 }}>
            {sites.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <Act action="salesTask" onClick={() => setModal('task')}>
            Create sales task
          </Act>
          <Act action="startTest" onClick={() => setModal('test')}>
            Start a test
          </Act>
          <Act action="setCap" onClick={() => setModal('cap')}>
            Change cap
          </Act>
          {(state === 'Live' || state === 'Paused') && (
            <Act action="siteState" kind={state === 'Live' ? 'danger' : 'primary'} onClick={() => setModal('state')}>
              {state === 'Live' ? 'Stop site ads' : 'Start site ads'}
            </Act>
          )}
        </div>
      </div>

      {as.length > 0 && (
        <div className="card" style={{ padding: 0, borderColor: as.some((a) => a.severity === 'Critical') ? 'var(--danger)' : 'var(--warn)' }}>
          <div className="list">
            {as.map((a) => (
              <div className="item" key={a.id} style={{ alignItems: 'center' }}>
                <span className={`sev ${a.severity}`} />
                <div className="item-main">
                  <b>{a.type}</b> · {a.message}
                </div>
                <span className="small muted">{a.owner ? `Owner ${a.owner}` : 'Unassigned'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="kpis">
        <Kpi label="Ad spend" value={eur(m.spend)} change={delta(m.spend, p.spend)} goodWhenUp={false} sub={metaC ? `Meta ${eur(m.metaSpend)}` : undefined} info={explain('spend', m, range, s.name)} />
        <Kpi label="Qualified visits" value={compact(m.visits)} change={delta(m.visits, p.visits)} info={explain('visits', m, range, s.name)} />
        <Kpi label="AdSense revenue" value={eur(m.adsense)} change={delta(m.adsense, p.adsense)} sub={`${eur((m.adsense / Math.max(1, m.pageViews)) * 1000, 2)} per 1k views`} info={explain('adsense', m, range, s.name)} />
        <Kpi label="Sponsor revenue" value={eur(m.sponsor)} change={delta(m.sponsor, p.sponsor)} info={explain('sponsor', m, range, s.name)} />
        <Kpi label={<Placeholder>Contribution</Placeholder>} value={eur(m.contribution)} change={delta(m.contribution, p.contribution)} info={explain('contribution', m, range, s.name)} />
        <Kpi
          label="Cap used (October)"
          value={cap ? pct(mtd / cap) : '—'}
          info={cap ? explainCap(mtd, cap, DAYS_INTO_MONTH) : undefined}
          sub={
            <>
              {eur(mtd)} of {eur(cap)}
            </>
          }
        />
      </div>

      <div className="grid g2">
        <Card title="Traffic sources" extra={<span className="small muted">qualified visits per day</span>}>
          <StackedBars labels={days.map((d) => d.date)} stacks={sourcesHere.map((x) => ({ name: x.name, color: x.color, values: days.map((d) => d[x.key]) }))} height={190} format={compact} />
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Source</th>
                <th className="num">Visits</th>
                <th className="num">Share</th>
                <th className="num">Change</th>
              </tr>
            </thead>
            <tbody>
              {sourcesHere.map((x) => (
                <tr key={x.key}>
                  <td>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: x.color, marginRight: 8 }} />
                    {x.name}
                  </td>
                  <td className="num">{num(m[x.key])}</td>
                  <td className="num">{pct(m[x.key] / Math.max(1, m.visits))}</td>
                  <td className={`num ${m[x.key] >= p[x.key] ? 'good' : 'bad'}`}>{delta(m[x.key], p[x.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="stack">
          <AdPlatformsCard s={s} state={state} cap={cap} />
          <SpendCard s={s} cap={cap} />
          <SeoCard s={s} />
        </div>
      </div>

      <div className="grid g2">
        <ForecastCard s={s} />
        <ExplainCard s={s} cap={cap} />
      </div>

      <Card
        title="Sponsor pipeline and inventory"
        extra={
          <Link to={`/sponsors?site=${s.id}`} className="small">
            Open in Sponsors →
          </Link>
        }
      >
        <div className="spots">
          {s.spots.map((spot) => {
            const live = ds.find((d) => d.spot === spot && (d.stage === 'Active' || d.stage === 'Up for renewal'));
            const pipe = ds.find((d) => d.spot === spot && !(d.stage === 'Active' || d.stage === 'Up for renewal'));
            return (
              <div key={spot} className={`spot ${live ? 'sold' : pipe ? 'pipe' : ''}`}>
                <div className="k">{spot}</div>
                {live ? (
                  <>
                    <div className="s">{live.sponsor}</div>
                    <div className="small">
                      {eur(live.fee)}/month · until {shortDate(live.end!)}
                    </div>
                  </>
                ) : pipe ? (
                  <>
                    <div className="s">{pipe.stage}</div>
                    <div className="small">
                      {pipe.sponsor} · {eur(pipe.fee)}/mo
                    </div>
                  </>
                ) : (
                  <>
                    <div className="s">Available</div>
                    <div className="small muted">Unsold inventory</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="small muted" style={{ marginTop: 10 }}>
          {ds.filter((d) => d.stage === 'Active' || d.stage === 'Up for renewal').length} of {s.spots.length} spots sold · {eur(sponsorIncome(s.id, dateOf(LAST_DAY, -29), LAST_DAY))} sponsor revenue in the last 30 days
        </div>
      </Card>

      <div className="grid g2">
        <Card flush title={`Campaigns (${cs.length + (metaC ? 1 : 0)})`} extra={<Link to={`/campaigns?site=${s.id}`} className="small">Open in Campaigns →</Link>}>
          <table className="cards-sm" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th className="num">Spend</th>
                <th className="num">Results</th>
                <th className="num">Cost / result</th>
              </tr>
            </thead>
            <tbody>
              {cs.map((c) => {
                const cm = campaignMetrics(c, range);
                const status = platformStopped(s.id, state, 'google', overrides, globalPause) ? 'Paused' : overrides[`cmp:${c.id}`] ?? c.status;
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="site-name">{c.name}</span>
                      <span className="sub">Google Ads · {c.type}</span>
                    </td>
                    <td data-label="Status">
                      <Pill tone={status === 'Enabled' ? 'ok' : 'muted'}>{status}</Pill>
                    </td>
                    <td className="num" data-label="Spend">{eur(cm.spend)}</td>
                    <td className="num" data-label="Results">{num(cm.conversions)} conv.</td>
                    <td className="num" data-label="Cost / result">{cm.cpa ? eur(cm.cpa, 2) : '—'}</td>
                  </tr>
                );
              })}
              {metaC && (() => {
                const t = campaignTotals(metaC, range);
                const paused = platformStopped(s.id, state, 'meta', overrides, globalPause) || overrides[`meta-status:${metaC.id}`] === 'Paused';
                const limited = metaC.adSets.some((a) => learningOf(a) === 'Learning limited');
                return (
                  <tr key={metaC.id}>
                    <td>
                      <span className="site-name">{metaC.name}</span>
                      <span className="sub">Meta · {metaC.adSets.length} ad set{metaC.adSets.length > 1 ? 's' : ''} · seen {frequencyOf(t).toFixed(1)}× each</span>
                    </td>
                    <td data-label="Status">
                      <Pill tone={paused ? 'muted' : 'ok'}>{paused ? 'Paused' : 'Running'}</Pill>
                      {!paused && limited && <span className="sub"><Pill tone="warn">Learning limited</Pill></span>}
                    </td>
                    <td className="num" data-label="Spend">{eur(t.spend)}</td>
                    <td className="num" data-label="Results">{num(t.visits)} visits</td>
                    <td className="num" data-label="Cost / result">{eur(t.spend / Math.max(1, t.visits), 2)}</td>
                  </tr>
                );
              })()}
              {!cs.length && !metaC && (
                <tr>
                  <td colSpan={5} className="muted card-full">
                    No campaigns.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card flush title={`Tests (${ts.length})`}>
          <div className="list" style={{ marginTop: 8 }}>
            {ts.map((t) => (
              <div className="item" key={t.id}>
                <div className="item-main">
                  <div className="item-title">{t.title}</div>
                  <div className="item-meta">
                    {t.kind} · {shortDate(t.start)} – {shortDate(t.end)} · {t.owner}
                  </div>
                  {t.result && <div className="small" style={{ marginTop: 3 }}>{t.result}</div>}
                </div>
                <Pill tone={t.status === 'Running' ? 'info' : t.status === 'Finished' ? 'muted' : 'warn'}>{t.status}</Pill>
              </div>
            ))}
            {!ts.length && <div className="item muted">No tests on this site yet.</div>}
          </div>
        </Card>
      </div>

      <ActivityLog s={s} />

      {modal === 'state' && (
        <Modal
          title={state === 'Live' ? `Stop ads on ${s.name}?` : `Start ads on ${s.name}?`}
          danger={state === 'Live'}
          confirm={state === 'Live' ? 'Stop ads' : 'Start ads'}
          onClose={() => setModal(null)}
          onConfirm={() => {
            override(`site:${s.id}`, state === 'Live' ? 'Paused' : 'Live', `${s.name} is now ${state === 'Live' ? 'Paused' : 'Live'} (mockup: no ad platform call)`);
            setModal(null);
          }}
        >
          {state === 'Live' ? `${cs.length} Google Ads campaign${cs.length === 1 ? '' : 's'}${metaC ? ' and 1 Meta campaign' : ''} on this site will pause. The site stays online and sponsors keep their spots.${metaC ? ' Pausing Meta counts as a major edit, so its learning starts again.' : ''}` : 'Campaigns restart with their current budgets and caps.'}
        </Modal>
      )}
      {modal === 'cap' && <CapModal s={s} cap={cap} mtd={mtd} onClose={() => setModal(null)} />}
      {modal === 'test' && <TestModal s={s} state={state} onClose={() => setModal(null)} onDone={(msg) => (toast(msg), setModal(null))} />}
      {modal === 'task' && (
        <Modal title="Create sales task" onClose={() => setModal(null)} confirm="Create task" onConfirm={() => (toast('Sales task created (mockup: not saved)'), setModal(null))}>
          <label>
            Spot to sell
            <select>
              {s.spots.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Assign to
            <select defaultValue={s.owner}>
              {OWNERS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            Due
            <input type="date" defaultValue={dateOf(LAST_DAY, 8)} />
          </label>
          <label>
            Note
            <input placeholder="e.g. Call local businesses in the area" />
          </label>
        </Modal>
      )}
    </>
  );
}

function SpendCard({ s, cap }: { s: Site; cap: number }) {
  const oct = s.days.filter((d) => d.date >= '2026-10-01');
  let acc = 0;
  const cum = oct.map((d) => (acc += d.spend));
  const daily = acc / Math.max(1, oct.length);
  const labels = Array.from({ length: DAYS_IN_MONTH }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  const actual = labels.map((_, i) => (i < cum.length ? cum[i] : NaN));
  const projected = labels.map((_, i) => (i >= cum.length - 1 ? acc + daily * (i - cum.length + 1) : NaN));
  const capLine = labels.map(() => cap);
  const end = acc + daily * (DAYS_IN_MONTH - DAYS_INTO_MONTH);
  return (
    <Card title="Spend against cap" extra={<span className={`small ${end > cap ? 'bad' : 'muted'}`}>{end > cap ? `On track to pass the cap by ${eur(end - cap)}` : `Projected ${eur(end)} of ${eur(cap)}`}</span>}>
      <LineChart
        labels={labels}
        height={150}
        format={eurK}
        series={[
          { name: 'Spent', values: actual, color: 'var(--c1)' },
          { name: 'Projected', values: projected, color: 'var(--c1)', dashed: true },
          { name: 'Monthly cap', values: capLine, color: 'var(--danger)', dashed: true },
        ]}
      />
    </Card>
  );
}

function SeoCard({ s }: { s: Site }) {
  const tone = s.seo.score >= 80 ? 'ok' : s.seo.score >= 65 ? 'warn' : 'danger';
  return (
    <Card title="Content and SEO health" extra={<span className={`pill t-${tone}`}>{s.seo.score}/100</span>}>
      <dl className="dl">
        <dt>Pages in Google</dt>
        <dd>
          {num(s.seo.indexed)} <span className={s.seo.indexedChange >= 0 ? 'good' : 'bad'}>({s.seo.indexedChange >= 0 ? '+' : ''}{s.seo.indexedChange} this week)</span>
        </dd>
        <dt>Average position</dt>
        <dd>{s.seo.avgPosition.toFixed(1)}</dd>
        <dt>Page speed (Core Web Vitals)</dt>
        <dd>{s.seo.cwvPass ? <span className="good">Pass</span> : <span className="bad">Fail</span>}</dd>
      </dl>
      {s.seo.issues.length > 0 && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18 }} className="small">
          {s.seo.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
function ForecastCard({ s }: { s: Site }) {
  const data = useMemo(() => {
    const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    const actual = months.map((mo) => {
      const ds = s.days.filter((d) => d.date.startsWith(mo));
      const scale = mo === '2026-10' ? DAYS_IN_MONTH / DAYS_INTO_MONTH : 1;
      const net = ds.reduce((a, d) => a + d.adsense - d.spend, 0) * scale;
      const last = ds[ds.length - 1]?.date ?? `${mo}-28`;
      return net + sponsorIncome(s.id, `${mo}-01`, last) * scale;
    });
    const slope = (actual[5] - actual[2]) / 3;
    const fc = [1, 2, 3].map((k) => actual[5] + slope * k * 0.7);
    const spread = [1, 2, 3].map((k) => Math.abs(actual[5]) * 0.12 * k + 40 * k);
    return {
      actual: [...actual, NaN, NaN, NaN],
      forecast: [NaN, NaN, NaN, NaN, NaN, actual[5], ...fc],
      low: [NaN, NaN, NaN, NaN, NaN, actual[5], ...fc.map((v, i) => v - spread[i])],
      high: [NaN, NaN, NaN, NaN, NaN, actual[5], ...fc.map((v, i) => v + spread[i])],
      next: fc[0],
    };
  }, [s]);
  return (
    <Card title="Margin forecast" extra={<span className="small muted">monthly · October projected from 21 days</span>}>
      <LineChart
        labels={MONTHS}
        height={170}
        format={eurK}
        markerAt={5}
        series={[
          { name: 'Actual', values: data.actual, color: 'var(--c3)' },
          { name: 'Forecast', values: data.forecast, color: 'var(--c3)', dashed: true, band: { low: data.low, high: data.high } },
        ]}
      />
      <div className="small muted">
        Next month: about <b style={{ color: 'var(--text)' }}>{eur(data.next)}</b>. Shaded area = likely range. <Placeholder>Uses revenue − ad spend</Placeholder>.
      </div>
    </Card>
  );
}

function ExplainCard({ s, cap }: { s: Site; cap: number }) {
  const m = siteMetrics(s, 30);
  const p = siteMetrics(s, 30, 1);
  const mtd = monthToDate(s);
  const capUse = cap ? mtd / (cap * (DAYS_INTO_MONTH / DAYS_IN_MONTH)) : 0;
  const eff = m.spend ? m.contribution / m.spend : 0;
  const factors = [
    { name: 'Return per €1 of ad spend', v: Math.max(-1, Math.min(1, eff / 2)), note: m.spend ? eur(eff, 2) : 'no spend' },
    { name: 'Organic visits trend', v: Math.max(-1, Math.min(1, ((m.organic - p.organic) / Math.max(1, p.organic)) * 3)), note: delta(m.organic, p.organic) },
    { name: 'Sponsor spots sold', v: (dealsBySite.get(s.id) ?? []).filter((d) => d.stage === 'Active' || d.stage === 'Up for renewal').length / s.spots.length - 0.5, note: `${(dealsBySite.get(s.id) ?? []).filter((d) => d.stage === 'Active' || d.stage === 'Up for renewal').length}/${s.spots.length}` },
    { name: 'Spending pace vs cap', v: capUse > 1.05 ? -0.6 : capUse > 0.9 ? 0.3 : 0.1, note: pct(capUse) },
    { name: 'Open alerts', v: -(alertsBySite.get(s.id)?.length ?? 0) * 0.35, note: String(alertsBySite.get(s.id)?.length ?? 0) },
  ];
  const score = factors.reduce((a, f) => a + f.v, 0);
  const rec =
    s.state !== 'Live'
      ? { t: 'No change', why: 'The site is not live.' }
      : score > 1.1 && capUse > 0.9
        ? { t: `Raise the monthly cap to ${eur(Math.round((cap * 1.2) / 50) * 50)}`, why: 'It earns well per euro and is close to its cap.' }
        : score < -0.4
          ? { t: 'Cut ad spend by 30% and check the alerts', why: 'Several signals are negative at once.' }
          : { t: 'Keep the current setup', why: 'Signals are mixed or stable.' };
  return (
    <Card title="Why the system suggests this" extra={<span className="small muted">model explanation</span>}>
      <div style={{ fontSize: 15, fontWeight: 650 }}>{rec.t}</div>
      <div className="small muted" style={{ marginBottom: 10 }}>
        {rec.why} Confidence {Math.round(60 + Math.min(30, Math.abs(score) * 12))}%.
      </div>
      {factors.map((f) => (
        <div className="factor" key={f.name}>
          <span>{f.name}</span>
          <span className="track">
            <b
              style={{
                left: f.v >= 0 ? '50%' : `${50 + Math.max(-1, f.v) * 50}%`,
                width: `${Math.min(1, Math.abs(f.v)) * 50}%`,
                background: f.v >= 0 ? 'var(--ok)' : 'var(--danger)',
              }}
            />
          </span>
          <span className="small num">{f.note}</span>
        </div>
      ))}
      <div className="small muted" style={{ marginTop: 6 }}>
        Green pushes towards spending more, red towards spending less. A person approves any change.
      </div>
    </Card>
  );
}

function CapModal({ s, cap, mtd, onClose }: { s: Site; cap: number; mtd: number; onClose: () => void }) {
  const { override, overrides } = useApp();
  const [v, setV] = useState(String(cap));
  const onMeta = metaBySite.has(s.id);
  const [mv, setMv] = useState(String(metaLimitOf(s.id, overrides)));
  const tooMuch = onMeta && Number(mv) > Number(v);
  return (
    <Modal
      title="Change approved monthly cap"
      onClose={onClose}
      confirm="Save cap"
      confirmDisabled={tooMuch}
      onConfirm={() => {
        override(`cap:${s.id}`, v, `Cap for ${s.name} set to ${eur(Number(v))} (mockup: no ad platform call)`);
        if (onMeta) override(`cap-meta:${s.id}`, mv, `Meta limit for ${s.name} set to ${eur(Number(mv))} (mockup: no Meta call)`);
        onClose();
      }}
    >
      <div>
        Spent so far in October: <b>{eur(mtd)}</b> of {eur(cap)}.
      </div>
      <label>
        New cap, all platforms (EUR per month)
        <input type="number" min="0" step="50" value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      {onMeta && (
        <label>
          Of that, the most Meta can use
          <input type="number" min="0" step="10" value={mv} onChange={(e) => setMv(e.target.value)} />
          <span className={`small ${tooMuch ? 'bad' : 'muted'}`}>{tooMuch ? 'This is more than the whole cap.' : `Google Ads can use the other ${eur(Math.max(0, Number(v) - Number(mv)))}.`}</span>
        </label>
      )}
      <div className="row small">
        <Meter value={mtd} max={Number(v) || 1} /> {pct(mtd / (Number(v) || 1))} used with the new cap
      </div>
    </Modal>
  );
}
