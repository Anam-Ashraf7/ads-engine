// PROTOTYPE: sponsor and revenue view (sponsor deals + AdSense).
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DISCOUNT_LIMIT, useApp } from '../state';
import { LineChart } from '../charts';
import { COUNTRIES, deals, deliveries, kindLine, LAST_DAY, leads, OWNERS, siteById, siteMetrics, sites, SPOT_KINDS, STAGES, TODAY, type Deal } from '../data/mock';
import { DeliveryTab, Inventory, LeadsTab } from './SponsorTabs';
import { explain, Num, periodOf, type Explain } from '../provenance';
import { compact, delta, eur, eurK, longDate, medDate, num, pct, shortDate } from '../format';
import { Icon } from '../icons';
import { Act, Card, Kpi, Pill, RiskPill, Select, Tabs, useSort } from '../ui';

const LIVE = (d: Deal) => d.stage === 'Active' || d.stage === 'Up for renewal';
const STAGE_TONE: Record<string, string> = { Prospect: 'muted', Contacted: 'muted', 'Offer sent': 'info', Negotiating: 'warn', Signed: 'accent', Active: 'ok', 'Up for renewal': 'warn' };
type Tab = 'deals' | 'delivery' | 'leads' | 'inventory' | 'invoices' | 'adsense';

export function SponsorsPage() {
  const { range, role, overrides, override, toast } = useApp();
  const [params] = useSearchParams();
  const [siteId, setSiteId] = useState(params.get('site') ?? '');
  const [country, setCountry] = useState('');
  const [spot, setSpot] = useState('');
  const [owner, setOwner] = useState('');
  const [stage, setStage] = useState('');
  const [tab, setTab] = useState<Tab>(() => (['deals', 'delivery', 'leads', 'inventory', 'invoices', 'adsense'].includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'deals'));

  const scoped = useMemo(
    () =>
      deals.filter((d) => {
        const s = siteById.get(d.siteId)!;
        return (!siteId || d.siteId === siteId) && (!country || s.country === country) && (!spot || d.spot === spot) && (!owner || d.owner === owner);
      }),
    [siteId, country, spot, owner],
  );
  const shown = stage ? scoped.filter((d) => d.stage === stage) : scoped;
  const scopedSites = sites.filter((s) => (!siteId || s.id === siteId) && (!country || s.country === country) && s.state !== 'Building' && s.state !== 'Retired');
  const mrr = scoped.filter(LIVE).reduce((a, d) => a + d.fee, 0);
  const pipeline = scoped.filter((d) => !LIVE(d) && d.stage !== 'Signed').reduce((a, d) => a + d.fee, 0);
  const overdue = scoped.filter((d) => d.invoice?.status === 'Overdue');
  const renewals = scoped.filter((d) => d.stage === 'Up for renewal');
  const ads = scopedSites.map((s) => ({ s, m: siteMetrics(s, range), p: siteMetrics(s, range, 1) }));
  const adsense = ads.reduce((a, x) => a + x.m.adsense, 0);
  const adsensePrev = ads.reduce((a, x) => a + x.p.adsense, 0);
  const totalSpots = scopedSites.reduce((a, s) => a + (spot ? (s.spots.includes(spot as never) ? 1 : 0) : s.spots.length), 0);
  const sold = scoped.filter(LIVE).length;
  const liveDeals = scoped.filter(LIVE);
  const checked = liveDeals.filter((d) => deliveries.get(d.id)!.status !== 'Not checked').length;
  const short = liveDeals.filter((d) => deliveries.get(d.id)!.status === 'Under-delivered').length;
  const leadTotal = liveDeals.reduce((a, d) => a + leads.get(d.id)!.calls + leads.get(d.id)!.forms, 0);

  return (
    <>
      <div className="page-head">
        <div style={{ flex: 1 }}>
          <h1>Sponsors and revenue</h1>
          <p>Sponsor deals on our sites and AdSense earnings · AdSense for the last {range} days</p>
        </div>
      </div>
      <div className="filters">
        <label className={`filter${siteId ? ' set' : ''}`}>
          <span>Site</span>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="">All</option>
            {sites
              .filter((s) => s.state !== 'Building' && s.state !== 'Retired')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <Select label="Country" value={country} options={COUNTRIES} onChange={setCountry} />
        <Select label="Spot" value={spot} options={SPOT_KINDS} onChange={setSpot} />
        <Select label="Owner" value={owner} options={OWNERS} onChange={setOwner} />
        <span className="spacer" />
        <span className="small muted">
          You are <b>{role}</b>: you can approve discounts up to {DISCOUNT_LIMIT[role]}%.
        </span>
      </div>

      <div className="kpis">
        <Kpi
          label="Sponsor revenue"
          value={eurK(mrr)}
          sub={`per month · ${sold} active deals`}
          info={{ key: 'mrr', title: 'Sponsor revenue / month', what: 'The monthly fees of every deal that is running today, added up. It is what the contracts say, not what has been paid.', sources: ['invoicing'], formula: [{ label: `Monthly fees of ${sold} running deals`, value: eur(mrr) }], result: { label: 'Per month', value: eur(mrr) }, note: 'Unpaid invoices are on the Invoices tab.' }}
        />
        <Kpi
          label="AdSense revenue"
          value={eurK(adsense)}
          change={delta(adsense, adsensePrev)}
          sub={`last ${range} days`}
          info={{ key: 'adsense', title: 'AdSense revenue', what: 'What Google AdSense says the sites earned from ads on their pages. AdSense calls this “estimated earnings” until it finalises the month.', sources: ['adsense'], period: periodOf(range), breakdown: [{ label: 'Previous period', value: eur(adsensePrev) }] }}
        />
        <Kpi label="Open pipeline" value={eurK(pipeline)} sub={`per month · ${scoped.filter((d) => !LIVE(d) && d.stage !== 'Signed').length} deals`} />
        <Kpi
          label="Overdue invoices"
          value={overdue.length}
          sub={eur(overdue.reduce((a, d) => a + (d.invoice?.amount ?? 0), 0))}
          info={{ key: 'overdue', title: 'Overdue invoices', what: 'Sponsor invoices past their due date and not marked paid in invoicing.', sources: ['invoicing'], note: 'The last invoicing sync failed, so an invoice paid this morning may still show here.' }}
        />
        <Kpi label="Up for renewal" value={renewals.length} sub={`${renewals.filter((d) => d.renewalRisk === 'High').length} high risk`} />
        <Kpi label="Spots sold" value={totalSpots ? pct(sold / totalSpots) : '—'} sub={`${sold} of ${totalSpots}`} />
        <Kpi
          label="Delivered"
          value={checked ? pct((checked - short) / checked) : '—'}
          sub={`placements · ${short} short · ${liveDeals.length - checked} unchecked`}
          info={{ key: 'delivered', title: 'Placements delivered', what: 'Of the running deals we have checked this month, the share that got at least 95% of what was promised.', sources: [], origin: 'Proof checks: ad server logs (banners), newsletter send reports, listing checks', period: `1 – ${shortDate(LAST_DAY)} 2026`, formula: [{ label: 'Checked and delivered', value: num(checked - short) }, { op: '÷', label: 'Checked', value: num(checked) }], result: { label: 'Delivered', value: checked ? pct((checked - short) / checked) : '—' }, note: `${liveDeals.length - checked} running deals have no proof check yet and are left out.` }}
        />
        <Kpi
          label="Leads sent"
          value={num(leadTotal)}
          sub="calls + forms, October"
          info={{ key: 'leads', title: 'Leads to sponsors', what: 'Calls and contact forms we sent to sponsors this month. Clicks to their sites are on the Lead evidence tab but not counted here.', sources: [], origin: 'Tracked links (UTM) and call-tracking numbers on each spot', period: `1 – ${shortDate(LAST_DAY)} 2026` }}
        />
      </div>

      <Card title="Sponsor funnel" extra={stage ? <button className="btn ghost sm" onClick={() => setStage('')}>Show all stages</button> : <span className="small muted">click a stage to filter</span>}>
        <div className="funnel">
          {STAGES.map((st) => {
            const ds = scoped.filter((d) => d.stage === st);
            const max = Math.max(1, ...STAGES.map((x) => scoped.filter((d) => d.stage === x).length));
            return (
              <button key={st} className={`funnel-step${stage === st ? ' on' : ''}`} onClick={() => setStage(stage === st ? '' : st)}>
                <div className="lbl">{st}</div>
                <div className="n">{ds.length}</div>
                <div className="v">{eur(ds.reduce((a, d) => a + d.fee, 0))}/mo</div>
                <div className="bar" style={{ width: `${(ds.length / max) * 100}%` }} />
              </button>
            );
          })}
        </div>
      </Card>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'deals', label: <>Deals<span className="n">{shown.length}</span></> },
          { key: 'delivery', label: <>Placement delivery{short > 0 && <span className="n">{short}</span>}</> },
          { key: 'leads', label: 'Lead evidence' },
          { key: 'inventory', label: 'Inventory' },
          { key: 'invoices', label: <>Invoices<span className="n">{scoped.filter((d) => d.invoice).length}</span></> },
          { key: 'adsense', label: 'AdSense' },
        ]}
      />

      {tab === 'deals' && (
        <Card flush>
          <div className="table-wrap">
            <table className="cards-sm">
              <thead>
                <tr>
                  <th>Sponsor</th>
                  <th>Site · spot</th>
                  <th>Stage</th>
                  <th className="num">Fee / month</th>
                  <th>Invoice</th>
                  <th>Renewal risk</th>
                  <th>Outreach</th>
                  <th>Discount</th>
                </tr>
              </thead>
              <tbody>
                {[...shown]
                  .sort((a, b) => STAGES.indexOf(b.stage) - STAGES.indexOf(a.stage) || b.fee - a.fee)
                  .slice(0, 120)
                  .map((d) => {
                    const s = siteById.get(d.siteId)!;
                    const disc = overrides[`disc:${d.id}`];
                    const running = d.outreach ? (overrides[`out:${d.id}`] ?? (d.outreach.running ? 'on' : 'off')) === 'on' : false;
                    const limit = DISCOUNT_LIMIT[role];
                    return (
                      <tr key={d.id}>
                        <td>
                          <span className="site-name one-line" title={d.sponsor}>{d.sponsor}</span>
                          <span className="sub one-line">{d.owner} · contacted {shortDate(d.lastContact)}</span>
                        </td>
                        <td data-label="Site · spot">
                          <Link to={`/sites/${s.id}`} className="one-line" title={s.name}>
                            {s.name}
                          </Link>
                          <span className="sub one-line">{d.spot}</span>
                        </td>
                        <td className="nowrap" data-label="Stage">
                          <Pill tone={STAGE_TONE[d.stage]}>{d.stage}</Pill>
                          {d.start && (
                            <span className="sub">
                              {d.end ? (
                                <>
                                  {medDate(d.start)} – {medDate(d.end)}
                                  <SpanBar start={d.start} end={d.end} />
                                </>
                              ) : (
                                <>starts {longDate(d.start)}</>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="num" data-label="Fee / month">
                          <Num info={feeInfo(d)}>{eur(d.fee)}</Num>
                        </td>
                        <td data-label="Invoice">
                          {d.invoice ? (
                            <>
                              <Pill tone={d.invoice.status === 'Paid' ? 'ok' : d.invoice.status === 'Due' ? 'info' : 'danger'}>{d.invoice.status}</Pill>
                              <span className="sub nowrap">
                                {eur(d.invoice.amount)} · due {shortDate(d.invoice.due)}
                              </span>
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td data-label="Renewal risk">{d.renewalRisk ? <RiskPill risk={d.renewalRisk} /> : <span className="muted">—</span>}</td>
                        <td data-label="Outreach">
                          {d.outreach ? (
                            <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                              <span className="small">
                                <span className="row" style={{ gap: 4, display: 'inline-flex' }}>
                                  {running ? Icon.play(12) : Icon.pause(12)} {d.outreach.step}/{d.outreach.steps}
                                </span>
                              </span>
                              <Act action="outreach" kind="sm" onClick={() => override(`out:${d.id}`, running ? 'off' : 'on', `Outreach ${running ? 'stopped' : 'started'} for ${d.sponsor} (mockup: no emails sent)`)}>
                                {running ? 'Stop' : 'Start'}
                              </Act>
                            </div>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td data-label="Discount">
                          {d.discountAsk == null ? (
                            <span className="muted">—</span>
                          ) : disc ? (
                            <Pill tone={disc === 'approved' ? 'ok' : 'muted'}>
                              {d.discountAsk}% {disc}
                            </Pill>
                          ) : (
                            <div className="disc">
                              <b>{d.discountAsk}% asked</b>
                              <span className="disc-btns">
                              <button
                                className="btn sm"
                                disabled={d.discountAsk > limit}
                                title={d.discountAsk > limit ? `Above your limit of ${limit}%. ${d.discountAsk > 25 ? 'Needs Admin.' : 'Needs Manager.'}` : undefined}
                                onClick={() => override(`disc:${d.id}`, 'approved', `${d.discountAsk}% discount approved for ${d.sponsor} (mockup)`)}
                              >
                                Approve
                              </button>
                              <button className="btn sm ghost" disabled={role === 'Viewer'} onClick={() => override(`disc:${d.id}`, 'declined', 'Discount declined (mockup)')}>
                                Decline
                              </button>
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            {shown.length > 120 ? `Showing 120 of ${shown.length}` : `${shown.length} deals`}
            <span className="spacer" />
            <Act action="salesTask" kind="sm" onClick={() => toast('New deal form would open here (mockup)')}>
              + New deal
            </Act>
          </div>
        </Card>
      )}

      {tab === 'invoices' && <Invoices list={scoped.filter((d) => d.invoice)} />}
      {tab === 'adsense' && <AdSense rows={ads} range={range} />}
      {tab === 'inventory' && <Inventory siteIds={new Set(scopedSites.map((s) => s.id))} />}
      {tab === 'delivery' && <DeliveryTab list={liveDeals} />}
      {tab === 'leads' && <LeadsTab list={liveDeals} />}
    </>
  );
}

function Invoices({ list }: { list: Deal[] }) {
  const [status, setStatus] = useState<'' | 'Paid' | 'Due' | 'Overdue'>('Overdue');
  const rows = list.filter((d) => !status || d.invoice!.status === status).sort((a, b) => a.invoice!.due.localeCompare(b.invoice!.due));
  return (
    <Card flush title="Invoices" extra={<Select label="Status" value={status} options={['Overdue', 'Due', 'Paid'] as const} onChange={setStatus} />}>
      <table style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Sponsor</th>
            <th>Site</th>
            <th className="num">Amount</th>
            <th>Due</th>
            <th>Status</th>
            <th className="num">Days late</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => {
            const late = Math.round((Date.parse(TODAY) - Date.parse(d.invoice!.due)) / 86400000);
            return (
              <tr key={d.id}>
                <td className="mono">{d.invoice!.number}</td>
                <td>{d.sponsor}</td>
                <td>
                  <Link to={`/sites/${d.siteId}`}>{siteById.get(d.siteId)!.name}</Link>
                </td>
                <td className="num">
                  <Num info={invoiceInfo(d)}>{eur(d.invoice!.amount)}</Num>
                </td>
                <td>{shortDate(d.invoice!.due)}</td>
                <td>
                  <Pill tone={d.invoice!.status === 'Paid' ? 'ok' : d.invoice!.status === 'Due' ? 'info' : 'danger'}>{d.invoice!.status}</Pill>
                </td>
                <td className={`num ${d.invoice!.status === 'Overdue' ? 'bad' : 'muted'}`}>{d.invoice!.status === 'Overdue' ? late : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

type AdRow = { s: (typeof sites)[number]; m: ReturnType<typeof siteMetrics>; p: ReturnType<typeof siteMetrics> };
function AdSense({ rows, range }: { rows: AdRow[]; range: number }) {
  const { sort, th } = useSort<'rev' | 'views' | 'rpm' | 'chg'>('rev');
  const days = rows[0]?.s.days.slice(-range) ?? [];
  const daily = days.map((_, i) => rows.reduce((a, r) => a + r.s.days[r.s.days.length - range + i].adsense, 0));
  const v = (r: AdRow) => (sort.key === 'rev' ? r.m.adsense : sort.key === 'views' ? r.m.pageViews : sort.key === 'rpm' ? (r.m.adsense / Math.max(1, r.m.pageViews)) * 1000 : r.p.adsense ? r.m.adsense / r.p.adsense : 0);
  const sorted = [...rows].sort((a, b) => (v(a) - v(b)) * sort.dir);
  return (
    <div className="grid g-side">
      <Card flush>
        <table>
          <thead>
            <tr>
              <th>Site</th>
              {th('views', 'Page views')}
              {th('rpm', 'Per 1,000 views')}
              {th('rev', 'AdSense revenue')}
              {th('chg', 'Change')}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 60).map((r) => (
              <tr key={r.s.id}>
                <td>
                  <Link to={`/sites/${r.s.id}`} className="site-name">
                    {r.s.name}
                  </Link>
                  <span className="sub">
                    {r.s.country} · {kindLine(r.s)}
                  </span>
                </td>
                <td className="num">{compact(r.m.pageViews)}</td>
                <td className="num">{eur((r.m.adsense / Math.max(1, r.m.pageViews)) * 1000, 2)}</td>
                <td className="num">
                  <Num info={explain('adsense', r.m, range, r.s.name)}>{eur(r.m.adsense)}</Num>
                </td>
                <td className={`num ${r.m.adsense >= r.p.adsense ? 'good' : 'bad'}`}>{delta(r.m.adsense, r.p.adsense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="table-foot">{rows.length > 60 ? `Top 60 of ${rows.length} sites` : `${rows.length} sites`}</div>
      </Card>
      <div className="stack">
        <Card title="AdSense per day">
          <LineChart labels={days.map((d) => d.date)} series={[{ name: 'AdSense', values: daily, color: 'var(--c2)' }]} height={160} format={eurK} />
        </Card>
        <Card title="By country">
          <dl className="dl">
            {COUNTRIES.map((c) => {
              const rs = rows.filter((r) => r.s.country === c);
              if (!rs.length) return null;
              const rev = rs.reduce((a, r) => a + r.m.adsense, 0);
              const pv = rs.reduce((a, r) => a + r.m.pageViews, 0);
              return (
                <div key={c} style={{ display: 'contents' }}>
                  <dt>
                    {c} <span className="muted small">{eur((rev / Math.max(1, pv)) * 1000, 2)} per 1k</span>
                  </dt>
                  <dd>{eur(rev)}</dd>
                </div>
              );
            })}
          </dl>
        </Card>
      </div>
    </div>
  );
}

// One axis for every contract row: 12 months back to 12 months ahead of today.
const AXIS_FROM = Date.parse(TODAY) - 365 * 86400000;
const AXIS_DAYS = 730;
function SpanBar({ start, end }: { start: string; end: string }) {
  const at = (iso: string) => Math.max(0, Math.min(100, ((Date.parse(iso) - AXIS_FROM) / 86400000 / AXIS_DAYS) * 100));
  return (
    <span className="span-bar" title="Contract length on a 24-month scale; the tick is today">
      <b style={{ left: `${at(start)}%`, width: `${at(end) - at(start)}%` }} />
      <i style={{ left: '50%' }} />
    </span>
  );
}

const feeInfo = (d: Deal): Explain => ({
  key: 'deal-fee',
  title: 'Fee per month',
  what: `What ${d.sponsor} pays each month for the ${d.spot.toLowerCase()} on ${siteById.get(d.siteId)!.name}.`,
  sources: [],
  origin: d.stage === 'Prospect' || d.stage === 'Contacted' || d.stage === 'Offer sent' || d.stage === 'Negotiating' ? 'Our offer, entered by ' + d.owner + ' (not signed yet)' : 'Signed contract, entered by ' + d.owner,
  breakdown: [
    { label: 'Contract', value: d.start ? (d.end ? `${shortDate(d.start)} – ${shortDate(d.end)}` : `starts ${shortDate(d.start)}`) : 'not signed' },
    ...(d.discountAsk != null ? [{ label: 'Discount asked', value: `${d.discountAsk}%` }] : []),
  ],
});

const invoiceInfo = (d: Deal): Explain => ({
  key: 'invoice',
  title: `Invoice ${d.invoice!.number}`,
  what: `The amount billed to ${d.sponsor}, and whether it has been paid.`,
  sources: ['invoicing'],
  breakdown: [
    { label: 'Monthly fee', value: eur(d.fee) },
    { label: 'Amount billed', value: eur(d.invoice!.amount) },
    { label: 'Due', value: shortDate(d.invoice!.due) },
    { label: 'Status', value: d.invoice!.status },
  ],
  note: 'Paid status comes from the invoicing tool; its last sync failed, so a recent payment may not show yet.',
});
