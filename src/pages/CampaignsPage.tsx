// PROTOTYPE: campaign and channel view. Google Ads and Meta, together or one at a time.
import { Fragment, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../state';
import { Meter } from '../charts';
import { budgetMoves, campaignById, campaignMetrics, campaignMtd, campaigns, COUNTRIES, DAYS_INTO_MONTH, KIND_FILTER, siteById, sites, type Campaign, type CampaignType } from '../data/mock';
import { compact, delta, eur, eurK, num, pct } from '../format';
import { Icon } from '../icons';
import { Num, periodOf, type Explain } from '../provenance';
import { Act, Card, Kpi, Modal, Pill, Select, useSort } from '../ui';
import { LiveCampaigns } from '../live/LiveCampaigns';
import { MetaCampaigns, MetaPill } from '../live/MetaCampaigns';
import { approvalsWaiting, addMetrics, campaignTotals, learningOf, metaCampaigns, platformStopped, type Learning } from '../data/meta';
import { MetaApprovals, MetaCap, MetaKpis, MetaTable, MetaTemplates, PlatformCompare } from './MetaAds';

const TYPES: CampaignType[] = ['Search', 'Performance Max', 'Display', 'Demand Gen'];
const PLATFORM: Campaign['platformStatus'][] = ['Eligible', 'Limited by budget', 'Learning', 'Ad disapproved', 'Account issue'];
const PS_TONE: Record<Campaign['platformStatus'], string> = { Eligible: 'ok', 'Limited by budget': 'warn', Learning: 'info', 'Ad disapproved': 'danger', 'Account issue': 'danger' };
type Key = 'name' | 'spend' | 'pacing' | 'conv' | 'cpa' | 'lift' | 'freq';
type View = 'all' | 'google' | 'meta';
const VIEWS: { key: View; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'google', label: 'Google Ads' },
  { key: 'meta', label: 'Meta' },
];
const LEARNING: Learning[] = ['Active', 'Learning', 'Learning limited'];

export function CampaignsPage() {
  const { range, overrides, override, siteState, globalPause } = useApp();
  const [params, setParams] = useSearchParams();
  const siteId = params.get('site') ?? '';
  const view: View = params.get('platform') === 'google' ? 'google' : params.get('platform') === 'meta' ? 'meta' : 'all';
  const [metaTab, setMetaTab] = useState<'campaigns' | 'templates'>('campaigns');
  const [learning, setLearning] = useState('');
  const [metaStatus, setMetaStatus] = useState('');
  const [country, setCountry] = useState('');
  const [kind, setKind] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [platform, setPlatform] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [capFor, setCapFor] = useState<Campaign | null>(null);
  const [capValue, setCapValue] = useState('');
  const [limit, setLimit] = useState(50);
  const { sort, th } = useSort<Key>('spend');

  const statusOf = (c: Campaign) => (overrides[`cmp:${c.id}`] as Campaign['status']) ?? c.status;
  const budgetOf = (c: Campaign) => Number(overrides[`cap-cmp:${c.id}`] ?? c.monthlyCap);

  const rows = useMemo(
    () =>
      campaigns
        .map((c) => {
          const s = siteById.get(c.siteId)!;
          const m = campaignMetrics(c, range);
          const prev = campaignMetrics(c, range, 1);
          const pacing = campaignMtd(c) / (c.dailyBudget * DAYS_INTO_MONTH);
          return { c, s, m, prev, pacing };
        })
        .filter(
          ({ c, s }) =>
            (!siteId || c.siteId === siteId) &&
            (!country || s.country === country) &&
            (!kind || s.kind === kind || s.size === kind) &&
            (!type || c.type === type) &&
            (!status || statusOf(c) === status) &&
            (!platform || c.platformStatus === platform) &&
            (!q || (c.name + s.name + s.domain).toLowerCase().includes(q.toLowerCase())),
        ),
    [range, siteId, country, kind, type, status, platform, q, overrides],
  );
  const sorted = useMemo(() => {
    const v = (r: (typeof rows)[number]): number | string =>
      sort.key === 'name' ? r.c.name : sort.key === 'spend' ? r.m.spend : sort.key === 'pacing' ? r.pacing : sort.key === 'conv' ? r.m.conversions : sort.key === 'cpa' ? r.m.cpa : sort.key === 'lift' ? r.c.lift.est : (r.c.frequency ?? 0);
    return [...rows].sort((a, b) => {
      const x = v(a), y = v(b);
      return (typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)) * sort.dir;
    });
  }, [rows, sort]);

  const tot = rows.reduce((a, r) => ({ spend: a.spend + r.m.spend, clicks: a.clicks + r.m.clicks, conv: a.conv + r.m.conversions, imp: a.imp + r.m.impressions }), { spend: 0, clicks: 0, conv: 0, imp: 0 });
  const prev = rows.reduce((a, r) => ({ spend: a.spend + r.prev.spend, conv: a.conv + r.prev.conversions }), { spend: 0, conv: 0 });
  const inScope = new Set(rows.map((r) => r.c.id));
  const moves = budgetMoves.filter((m) => inScope.has(m.from) && !overrides[`move:${m.id}`]);
  const site = siteId ? siteById.get(siteId) : null;

  const setView = (v: View) => {
    const n = new URLSearchParams(params);
    if (v === 'all') n.delete('platform');
    else n.set('platform', v);
    setParams(n);
    // Platform-only filters don't carry over, so nothing stays filtered out of sight.
    setType('');
    setStatus('');
    setPlatform('');
    setLearning('');
    setMetaStatus('');
  };
  const metaRows = useMemo(
    () =>
      metaCampaigns.filter((c) => {
        const s = siteById.get(c.siteId)!;
        return (
          (!siteId || c.siteId === siteId) &&
          (!country || s.country === country) &&
          (!kind || s.kind === kind || s.size === kind) &&
          (!metaStatus || ((overrides[`meta-status:${c.id}`] ?? c.status) === metaStatus)) &&
          (!learning || c.adSets.some((a) => learningOf(a) === learning)) &&
          (!q || (c.name + s.name + s.domain).toLowerCase().includes(q.toLowerCase()))
        );
      }),
    [siteId, country, kind, metaStatus, learning, q, overrides],
  );
  const metaTotal = addMetrics(metaRows.map((c) => campaignTotals(c, range)));
  const metaLimited = metaRows.flatMap((c) => c.adSets).filter((a) => learningOf(a) === 'Learning limited').length;
  const metaWaiting = approvalsWaiting(overrides).filter((a) => metaRows.some((c) => c.id === a.campaignId)).length;
  const showGoogle = view !== 'meta';
  const showMeta = view !== 'google';
  const googleAttention = rows.filter((r) => PS_TONE[r.c.platformStatus] === 'danger' || (r.pacing > 1.1 && statusOf(r.c) === 'Enabled')).length;

  return (
    <>
      <div className="page-head">
        <div style={{ flex: 1 }}>
          <h1>Campaigns and channels</h1>
          <p>
            {view === 'all' ? `${rows.length} Google Ads and ${metaRows.length} Meta campaigns` : view === 'google' ? `${rows.length} Google Ads campaigns` : `${metaRows.length} Meta campaigns`} · last {range} days
          </p>
        </div>
        {showGoogle && <span className="pill t-ok"><i className="risk-dot" />Google Ads connected · synced 06:12</span>}
        {showMeta && <MetaPill />}
        <div className="seg" role="group" aria-label="Ad platform">
          {VIEWS.map((v) => (
            <button key={v.key} className={view === v.key ? 'on' : ''} aria-pressed={view === v.key} onClick={() => setView(v.key)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filters">
        <input className="search" placeholder="Search campaign or site" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className={`filter${siteId ? ' set' : ''}`}>
          <span>Site</span>
          <select
            value={siteId}
            onChange={(e) => {
              const n = new URLSearchParams(params);
              if (e.target.value) n.set('site', e.target.value);
              else n.delete('site');
              setParams(n);
            }}
            style={{ maxWidth: 180 }}
          >
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
        <Select label="Site kind" value={kind} options={KIND_FILTER} onChange={setKind} />
        {view === 'google' && (
          <>
            <Select label="Campaign type" value={type} options={TYPES} onChange={setType} />
            <Select label="Status" value={status} options={['Enabled', 'Paused']} onChange={setStatus} />
            <Select label="Platform" value={platform} options={PLATFORM} onChange={setPlatform} />
          </>
        )}
        {view === 'meta' && (
          <>
            <Select label="Status" value={metaStatus} options={['Running', 'Paused']} onChange={setMetaStatus} />
            <Select label="Learning" value={learning} options={LEARNING} onChange={setLearning} />
          </>
        )}
      </div>
      {site && (
        <div className="small">
          Showing campaigns for <Link to={`/sites/${site.id}`}>{site.name}</Link>.
        </div>
      )}

      {view === 'google' && metaWaiting > 0 && (
        <div className="small">
          {metaWaiting} Meta change{metaWaiting > 1 ? 's are' : ' is'} waiting for approval.{' '}
          <button className="link-btn" onClick={() => setView('meta')}>Review in Meta</button>
        </div>
      )}

      {view === 'all' && (
        <PlatformCompare
          google={{ spend: tot.spend, clicks: tot.clicks, conversions: tot.conv, campaigns: rows.length, attention: googleAttention }}
          meta={{ total: metaTotal, campaigns: metaRows.length, attention: metaLimited + metaWaiting }}
          onOpen={setView}
        />
      )}
      {view === 'meta' && <MetaKpis total={metaTotal} limited={metaLimited} range={range} />}
      {view === 'meta' && <p className="small muted meta-note">Sample campaigns, as Meta isn't connected and its goal isn't decided. Visits stand in as the result for now.</p>}
      {showMeta && <MetaCap />}
      {showMeta && <MetaApprovals siteId={siteId || undefined} />}

      {view === 'meta' && (
        <>
          <MetaCampaigns />
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={metaTab === 'campaigns'} className={`tab${metaTab === 'campaigns' ? ' on' : ''}`} onClick={() => setMetaTab('campaigns')}>Campaigns</button>
            <button role="tab" aria-selected={metaTab === 'templates'} className={`tab${metaTab === 'templates' ? ' on' : ''}`} onClick={() => setMetaTab('templates')}>Ad templates</button>
          </div>
          {metaTab === 'campaigns' ? <MetaTable list={metaRows} range={range} /> : <MetaTemplates />}
        </>
      )}
      {view === 'all' && metaRows.length > 0 && <MetaTable list={metaRows} title="Meta campaigns" range={range} />}

      {view === 'google' && <div className="kpis">
        <Kpi
          label="Spend"
          value={eurK(tot.spend)}
          change={delta(tot.spend, prev.spend)}
          goodWhenUp={false}
          info={{ key: 'spend', title: 'Spend', what: `What Google Ads charged for the ${rows.length} campaigns shown.`, sources: ['ads'], period: periodOf(range), breakdown: [{ label: 'Clicks', value: num(tot.clicks) }, { label: 'Average cost per click', value: tot.clicks ? eur(tot.spend / tot.clicks, 2) : '—' }] }}
        />
        <Kpi
          label="Clicks"
          value={compact(tot.clicks)}
          sub={`${pct(tot.clicks / Math.max(1, tot.imp), 1)} click rate`}
          info={{ key: 'clicks', title: 'Clicks', what: 'Clicks on our ads, as counted by Google Ads (invalid clicks already removed).', sources: ['ads'], period: periodOf(range), formula: [{ label: 'Clicks', value: num(tot.clicks) }, { op: '÷', label: 'Impressions', value: num(tot.imp) }], result: { label: 'Click rate', value: pct(tot.clicks / Math.max(1, tot.imp), 1) } }}
        />
        <Kpi
          label="Conversions"
          value={num(tot.conv)}
          change={delta(tot.conv, prev.conv)}
          info={{ key: 'conversions', title: 'Conversions', what: 'Actions Google Ads counted after an ad click, from the conversion actions set up in each account (for example a contact form or a call).', sources: ['ads'], period: periodOf(range), note: 'Conversions can arrive days after the click, so the last few days usually go up later.' }}
        />
        <Kpi
          label="Cost per conversion"
          info={{ key: 'cpa', title: 'Cost per conversion', what: 'Spend divided by conversions for the campaigns shown.', sources: ['ads'], period: periodOf(range), formula: [{ label: 'Spend', value: eur(tot.spend) }, { op: '÷', label: 'Conversions', value: num(tot.conv) }], result: { label: 'Cost per conversion', value: tot.conv ? eur(tot.spend / tot.conv, 2) : '—' } }}
          value={tot.conv ? eur(tot.spend / tot.conv, 2) : '—'} change={prev.conv && tot.conv ? delta(tot.spend / tot.conv, prev.spend / prev.conv) : undefined} goodWhenUp={false} />
        <Kpi label="Over budget pace" value={rows.filter((r) => r.pacing > 1.1 && statusOf(r.c) === 'Enabled').length} sub="campaigns, this month" />
        <Kpi label="Platform problems" value={rows.filter((r) => PS_TONE[r.c.platformStatus] === 'danger').length} sub="disapproved or blocked" />
      </div>}

      {view === 'google' && <LiveCampaigns />}

      {showGoogle && moves.length > 0 && (
        <Card flush title={`Suggested budget moves (${moves.length})`} extra={<span className="small muted">the system suggests, a person approves</span>}>
          <div className="list" style={{ marginTop: 8 }}>
            {moves.slice(0, 5).map((mv) => {
              const from = campaignById.get(mv.from)!, to = campaignById.get(mv.to)!;
              const s = siteById.get(mv.siteId)!;
              return (
                <div className="item" key={mv.id} style={{ alignItems: 'center' }}>
                  <div className="item-main">
                    <div>
                      Move <b>{eur(mv.amount)}/day</b> from <span className="tag">{from.name}</span> to <span className="tag">{to.name}</span> on <Link to={`/sites/${s.id}`}>{s.name}</Link>
                    </div>
                    <div className="item-meta">
                      {mv.reason} Expected +{mv.gain.toFixed(1)} conversions/week · confidence {mv.confidence}%
                    </div>
                  </div>
                  <Act action="approveMove" kind="sm" onClick={() => override(`move:${mv.id}`, 'rejected', 'Suggestion rejected (mockup)')}>
                    Reject
                  </Act>
                  <Act action="approveMove" kind="sm primary" onClick={() => override(`move:${mv.id}`, 'approved', `Approved: ${eur(mv.amount)}/day moved (mockup: no Google Ads call)`)}>
                    Approve
                  </Act>
                </div>
              );
            })}
          </div>
          {moves.length > 5 && <div className="table-foot">+ {moves.length - 5} more suggestions</div>}
        </Card>
      )}

      {showGoogle && <Card flush title={view === 'all' ? 'Google Ads campaigns' : undefined}>
        <div className="table-wrap">
          <table className="cards-sm">
            <thead>
              <tr>
                {th('name', 'Campaign', '')}
                <th>Status</th>
                {th('spend', 'Spend')}
                {th('pacing', 'Pacing (Oct)')}
                {th('conv', 'Conv.')}
                {th('cpa', 'Cost / conv.')}
                <th className="num">Quality</th>
                {th('lift', <span title="Extra conversions the ads caused, from holdout tests">Lift</span>)}
                {th('freq', 'Freq.')}
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, limit).map(({ c, s, m, pacing }) => {
                const stopped = platformStopped(s.id, siteState(s.id, s.state), 'google', overrides, globalPause);
                const st = statusOf(c);
                const shown = stopped ? 'Paused' : st;
                const isOpen = open === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr className={`click${isOpen ? ' sel' : ''}`} onClick={() => setOpen(isOpen ? null : c.id)}>
                      <td>
                        <span className="site-name one-line" title={c.name}>
                          <span className="caret">{isOpen ? Icon.chevronDown() : Icon.chevronRight()}</span>
                          {c.name}
                        </span>
                        <span className="sub one-line">
                          <Link to={`/sites/${s.id}`} onClick={(e) => e.stopPropagation()}>
                            {s.name}
                          </Link>{' '}
                          · {c.type} · {s.country}
                        </span>
                      </td>
                      <td className="nowrap" data-label="Status">
                        <Pill tone={shown === 'Enabled' ? 'ok' : 'muted'}>{shown}</Pill>
                        {stopped && <span className="sub">stopped for this site</span>}
                        {PS_TONE[c.platformStatus] !== 'ok' && (
                          <span className="sub">
                            <Pill tone={PS_TONE[c.platformStatus]}>{c.platformStatus}</Pill>
                          </span>
                        )}
                      </td>
                      <td className="num" data-label="Spend">
                        <Num info={cmpInfo('spend', c, m, range)}>{eur(m.spend)}</Num>
                      </td>
                      <td className="num" data-label="Pacing (Oct)">
                        <Meter value={pacing} max={1.3} tone={pacing > 1.1 ? 'danger' : pacing > 0.97 ? 'warn' : 'ok'} /> <span className="small">
                          <Num info={paceInfo(c, pacing, budgetOf(c))}>{pct(pacing)}</Num>
                        </span>
                        <span className="sub">
                          {eur(c.dailyBudget)}/day · cap {eur(budgetOf(c))}
                        </span>
                      </td>
                      <td className="num" data-label="Conversions">
                        <Num info={cmpInfo('conv', c, m, range)}>{num(m.conversions)}</Num>
                      </td>
                      <td className="num" data-label="Cost / conv.">{m.cpa ? <Num info={cmpInfo('cpa', c, m, range)}>{eur(m.cpa, 2)}</Num> : '—'}</td>
                      <td className="num small" data-label="Quality">
                        {c.quality}
                        <span className="sub">{c.type === 'Search' ? 'quality score' : 'ad strength'}</span>
                      </td>
                      <td className="num" data-label="Lift">
                        <span className={c.lift.low > 0 ? 'good' : c.lift.high < 0 ? 'bad' : ''}>
                          {c.lift.est >= 0 ? '+' : ''}
                          {c.lift.est}%
                        </span>
                        <span className="sub">
                          {c.lift.low}% to {c.lift.high}%
                        </span>
                      </td>
                      <td className="num hide-sm">{c.frequency ? `${c.frequency.toFixed(1)}×` : <span className="muted">—</span>}</td>
                      <td className="card-acts" onClick={(e) => e.stopPropagation()}>
                        <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                          {!stopped && <Act action="pauseCampaign" kind="sm" onClick={() => override(`cmp:${c.id}`, st === 'Enabled' ? 'Paused' : 'Enabled', `${c.name} ${st === 'Enabled' ? 'paused' : 'restarted'} (mockup: no Google Ads call)`)}>
                            {st === 'Enabled' ? 'Pause' : 'Restart'}
                          </Act>}
                          <Act action="setCap" kind="sm" onClick={() => (setCapFor(c), setCapValue(String(budgetOf(c))))}>
                            Cap
                          </Act>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={10} className="card-full" style={{ background: 'var(--surface-2)', padding: '10px 14px 14px 30px' }}>
                          <h3 style={{ marginBottom: 6 }}>Creatives and landing pages</h3>
                          <table>
                            <thead>
                              <tr>
                                <th>Creative</th>
                                <th>Landing page</th>
                                <th className="num">Impressions</th>
                                <th className="num">Click rate</th>
                                <th className="num">Conversion rate</th>
                                <th>Status</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {c.creatives.map((cr) => {
                                const retired = overrides[`cr:${cr.id}`] === 'Retired' || cr.status === 'Retired';
                                const best = Math.max(...c.creatives.map((x) => x.convRate));
                                return (
                                  <tr key={cr.id} style={retired ? { opacity: 0.55 } : undefined}>
                                    <td>
                                      <span className="tag">{cr.kind}</span> {cr.name}
                                    </td>
                                    <td className="mono">{cr.landingPage}</td>
                                    <td className="num">{num(cr.impressions)}</td>
                                    <td className="num">{cr.ctr.toFixed(2)}%</td>
                                    <td className="num">
                                      {cr.convRate.toFixed(2)}% {cr.convRate === best && <Pill tone="ok">Best</Pill>}
                                    </td>
                                    <td>{retired ? <Pill>Retired</Pill> : <Pill tone="ok">Active</Pill>}</td>
                                    <td>
                                      {!retired && (
                                        <Act action="retireCreative" kind="sm" onClick={() => override(`cr:${cr.id}`, 'Retired', `Creative retired (mockup: no Google Ads call)`)}>
                                          Retire
                                        </Act>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          Showing {Math.min(limit, sorted.length)} of {sorted.length}. Lift = extra conversions the ads caused, estimated from holdout tests; the range is the likely span.
          <span className="spacer" />
          {limit < sorted.length && (
            <button className="btn sm" onClick={() => setLimit(limit + 100)}>
              Show more
            </button>
          )}
        </div>
      </Card>}

      {capFor && (
        <Modal
          title={`Monthly cap for ${capFor.name}`}
          onClose={() => setCapFor(null)}
          confirm="Save cap"
          onConfirm={() => {
            override(`cap-cmp:${capFor.id}`, capValue, `Cap set to ${eur(Number(capValue))} (mockup: no Google Ads call)`);
            setCapFor(null);
          }}
        >
          <div>
            Spent this month: <b>{eur(campaignMtd(capFor))}</b>. The campaign stops when it reaches the cap.
          </div>
          <label>
            Cap (EUR per month)
            <input type="number" min="0" step="10" value={capValue} onChange={(e) => setCapValue(e.target.value)} />
          </label>
        </Modal>
      )}
    </>
  );
}

type CmpMetrics = ReturnType<typeof campaignMetrics>;
/** Details behind a campaign row's numbers: all of them come straight from Google Ads. */
function cmpInfo(key: 'spend' | 'conv' | 'cpa', c: Campaign, m: CmpMetrics, range: number): Explain {
  const base = { sources: ['ads' as const], period: periodOf(range) };
  if (key === 'spend')
    return {
      ...base,
      key: 'cmp-spend',
      title: 'Spend',
      what: `What Google Ads charged for ${c.name}.`,
      breakdown: [
        { label: 'Impressions', value: num(m.impressions) },
        { label: 'Clicks', value: num(m.clicks) },
        { label: 'Average cost per click', value: m.clicks ? eur(m.cpc, 2) : '—' },
      ],
      note: 'Google can revise the last 3 days when invalid-click credits come in.',
    };
  if (key === 'conv')
    return {
      ...base,
      key: 'cmp-conv',
      title: 'Conversions',
      what: `Actions Google Ads counted after a click on ${c.name}: calls, forms and sign-ups we set up as conversions.`,
      formula: [
        { label: 'Clicks', value: num(m.clicks) },
        { op: '÷', label: 'Conversions', value: num(m.conversions) },
      ],
      result: { label: 'Clicks per conversion', value: m.conversions ? (m.clicks / m.conversions).toFixed(1) : '—' },
      note: 'Conversions are credited to the day of the click and can arrive later, within the conversion window (30 days by default), so recent days may still rise.',
    };
  return {
    ...base,
    key: 'cmp-cpa',
    title: 'Cost per conversion',
    what: `What one conversion on ${c.name} cost.`,
    formula: [
      { label: 'Spend', value: eur(m.spend) },
      { op: '÷', label: 'Conversions', value: num(m.conversions) },
    ],
    result: { label: 'Cost per conversion', value: m.cpa ? eur(m.cpa, 2) : '—' },
  };
}

function paceInfo(c: Campaign, pacing: number, cap: number): Explain {
  const mtd = campaignMtd(c);
  return {
    key: 'cmp-pace',
    title: 'Budget pace',
    what: `How fast ${c.name} is spending this month against its daily budget. Over 100% means it is ahead of plan.`,
    sources: ['ads'],
    period: `1 – 21 Oct 2026 · ${DAYS_INTO_MONTH} days`,
    formula: [
      { label: 'Spent this month', value: eur(mtd) },
      { op: '÷', label: `Daily budget × ${DAYS_INTO_MONTH} days`, value: eur(c.dailyBudget * DAYS_INTO_MONTH) },
    ],
    result: { label: 'Pace', value: pct(pacing) },
    breakdown: [{ label: 'Monthly cap', value: eur(cap) }],
    origin: 'Daily budget: Google Ads · monthly cap: set by a person in Ads engine',
  };
}
