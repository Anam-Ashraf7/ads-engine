// PROTOTYPE: the Meta parts of Campaigns. Made-up data shaped like Meta's own levels; no button calls Meta.
import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Meter } from '../charts';
import { siteById, DAYS_INTO_MONTH } from '../data/mock';
import {
  approvalsWaiting,
  budgetOfSet,
  campaignTotals,
  frequencyOf,
  LEARNING_TARGET,
  learningOf,
  META_CAP,
  META_WARN_AT,
  metaCampaigns,
  metaCapDay,
  metaForecast,
  metaMtd,
  metaTemplates,
  platformStopped,
  setMetrics,
  subjectOf,
  TIRED_AT,
  weeklyResults,
  type Learning,
  type MetaAdSet,
  type MetaCampaign,
  type MetaMetrics,
  type MetaTemplate,
} from '../data/meta';
import { compact, eur, num, pct } from '../format';
import { Icon } from '../icons';
import { Num, periodOf, type Explain } from '../provenance';
import { useApp } from '../state';
import { Act, Card, Kpi, Modal, Pill, useSort } from '../ui';

const SAMPLE = "Sample data: Meta isn't connected yet";
const LEARNING_TONE: Record<Learning, string> = { Active: 'ok', Learning: 'info', 'Learning limited': 'warn' };
const NOT_CHARGED = '(mockup: no Meta call)';

const info = (key: string, title: string, what: string, range: number, extra: Partial<Explain> = {}): Explain => ({ key, title, what, sources: ['meta'], origin: SAMPLE, period: periodOf(range), ...extra });

export function MetaKpis({ total, limited, range }: { total: MetaMetrics; limited: number; range: number }) {
  return (
    <div className="kpis">
      <Kpi label="Spend" value={eur(total.spend)} info={info('meta-spend', 'Meta spend', 'What Meta charged for the campaigns shown.', range, { note: 'Meta can keep updating these numbers for a couple of days.' })} />
      <Kpi label="Clicks" value={compact(total.clicks)} sub={`${pct(total.clicks / Math.max(1, total.impressions), 1)} click rate`} />
      <Kpi label="Visits" value={num(total.visits)} sub="sample goal" info={info('meta-visits', 'Visits', "Meta's count of people who clicked and the page loaded. Meta's goal isn't decided, so visits stand in for now.", range)} />
      <Kpi label="Cost per visit" value={total.visits ? eur(total.spend / total.visits, 2) : '—'} />
      <Kpi label="Frequency" value={`${frequencyOf(total).toFixed(1)}×`} sub="times each person saw an ad" />
      <Kpi label="Learning limited" value={limited} sub="ad sets" />
    </div>
  );
}

/** The cap warns first and pauses only when it's reached, so ordinary days don't trigger edits in Meta. */
export function MetaCap() {
  const used = metaMtd / META_CAP;
  const warned = used >= META_WARN_AT;
  return (
    <Card flush className="meta-cap">
      <div className="meta-cap-row">
        <div className="meta-cap-main">
          <div className="meta-cap-title">
            <h2>Monthly cap, whole Meta account</h2>
            <Pill tone={warned ? 'warn' : 'ok'}>{warned ? 'Getting close' : 'On track'}</Pill>
          </div>
          <div className="meta-cap-meter">
            <Meter value={used} max={1} tone={warned ? 'warn' : 'ok'} />
          </div>
          <p className="small muted">
            <b className="meta-strong">{eur(metaMtd)}</b> of {eur(META_CAP)} spent in {DAYS_INTO_MONTH} days. {metaCapDay ? <>At this rate the cap is reached around <b className="meta-strong">{metaCapDay} Oct</b>.</> : <>On pace for {eur(metaForecast)} this month.</>}
          </p>
        </div>
        <p className="small muted meta-cap-rule">We warn at {pct(META_WARN_AT)} and only pause campaigns at 100%. Budgets aren't lowered automatically, because frequent edits can restart learning.</p>
      </div>
    </Card>
  );
}

export function MetaApprovals({ siteId }: { siteId?: string }) {
  const { overrides, override } = useApp();
  const waiting = approvalsWaiting(overrides).filter((a) => !siteId || metaCampaigns.find((c) => c.id === a.campaignId)?.siteId === siteId);
  if (!waiting.length) return null;
  const decide = (id: string, value: string, msg: string) => override(`meta-approval:${id}`, value, `${msg} ${NOT_CHARGED}`);
  return (
    <Card flush title={`Meta changes waiting for approval (${waiting.length})`} extra={<span className="small muted meta-hide-sm">the system suggests, a person approves</span>}>
      <div className="list">
        {waiting.map((a) => {
          const c = metaCampaigns.find((x) => x.id === a.campaignId)!;
          const s = siteById.get(c.siteId)!;
          return (
            <div className="item meta-approval" key={a.id}>
              <div className="item-main">
                <div>
                  <b>{a.title}</b> on <Link to={`/sites/${s.id}`}>{s.name}</Link>
                </div>
                <div className="item-meta">
                  {a.why} <span className="meta-effect">{a.effect === 'restarts' ? 'Restarts learning.' : 'May restart learning if the change is large.'}</span>
                </div>
              </div>
              <div className="meta-approval-acts">
                <Act action="approveMove" kind="sm" onClick={() => decide(a.id, 'rejected', 'Suggestion rejected')}>
                  Reject
                </Act>
                <Act
                  action="approveMove"
                  kind="sm primary"
                  onClick={() => {
                    if (a.apply) override(a.apply.key, a.apply.value, `Approved: ${a.done.toLowerCase()} on ${s.name} ${NOT_CHARGED}`);
                    else decide(a.id, 'approved', `Approved: ${a.done.toLowerCase()} on ${s.name}`);
                  }}
                >
                  Approve
                </Act>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function LearningCell({ set }: { set: MetaAdSet }) {
  const state = learningOf(set);
  const week = weeklyResults(set);
  return (
    <>
      <Pill tone={LEARNING_TONE[state]}>{state}</Pill>
      <span className="sub meta-learning">
        <Meter value={week} max={LEARNING_TARGET} tone={week >= LEARNING_TARGET ? 'ok' : 'warn'} /> {week} of {LEARNING_TARGET}/week
      </span>
    </>
  );
}

type Key = 'name' | 'spend' | 'clicks' | 'visits' | 'cost' | 'freq';

export function MetaTable({ list, title, range }: { list: MetaCampaign[]; title?: string; range: number }) {
  const { overrides, override, siteState, globalPause } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const [pauseFor, setPauseFor] = useState<MetaCampaign | null>(null);
  const [budgetFor, setBudgetFor] = useState<MetaAdSet | null>(null);
  const [budget, setBudget] = useState('');
  const { sort, th } = useSort<Key>('spend');

  const statusOf = (c: MetaCampaign) => (overrides[`meta-status:${c.id}`] as MetaCampaign['status']) ?? c.status;
  const rows = useMemo(() => {
    const value = (m: MetaMetrics, c: MetaCampaign): number | string => (sort.key === 'name' ? c.name : sort.key === 'spend' ? m.spend : sort.key === 'clicks' ? m.clicks : sort.key === 'visits' ? m.visits : sort.key === 'cost' ? m.spend / Math.max(1, m.visits) : frequencyOf(m));
    return list
      .map((c) => ({ c, m: campaignTotals(c, range) }))
      .sort((a, b) => {
        const x = value(a.m, a.c), y = value(b.m, b.c);
        return (typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)) * sort.dir;
      });
  }, [list, range, sort]);

  const campaignOfBudget = budgetFor && list.find((c) => c.adSets.includes(budgetFor));

  return (
    <Card flush title={title}>
      {rows.length === 0 ? (
        <p className="live-off">No Meta campaigns match these filters.</p>
      ) : (
        <div className="table-wrap">
          <table className="cards-sm meta-table">
            <thead>
              <tr>
                {th('name', 'Campaign', '')}
                <th>Status</th>
                {th('spend', 'Spend')}
                {th('clicks', 'Clicks')}
                {th('visits', 'Visits')}
                {th('cost', 'Cost / visit')}
                {th('freq', 'Freq.')}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, m }) => {
                const s = siteById.get(c.siteId)!;
                const stopped = platformStopped(c.siteId, siteState(s.id, s.state), 'meta', overrides, globalPause);
                const st = stopped ? 'Paused' : statusOf(c);
                const isOpen = open === c.id;
                const limited = c.adSets.filter((a) => learningOf(a) === 'Learning limited').length;
                const learning = c.adSets.filter((a) => learningOf(a) === 'Learning').length;
                const freq = frequencyOf(m);
                return (
                  <Fragment key={c.id}>
                    <tr className={`click${isOpen ? ' sel' : ''}`} onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}>
                      <td>
                        <span className="site-name one-line" title={c.name}>
                          <span className="caret">{isOpen ? Icon.chevronDown() : Icon.chevronRight()}</span>
                          {c.name}
                        </span>
                        <span className="sub one-line">
                          <Link to={`/sites/${s.id}`} onClick={(e) => e.stopPropagation()}>
                            {s.name}
                          </Link>{' '}
                          · {s.country} · {c.adSets.length} ad set{c.adSets.length > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="nowrap" data-label="Status">
                        <Pill tone={st === 'Running' ? 'ok' : 'muted'}>{st}</Pill>
                        {stopped && <span className="sub">stopped for this site</span>}
                        {st === 'Running' && (limited > 0 || learning > 0) && (
                          <span className="sub">
                            <Pill tone={limited ? 'warn' : 'info'}>{limited ? 'Learning limited' : 'Learning'}</Pill>
                          </span>
                        )}
                      </td>
                      <td className="num" data-label="Spend">
                        <Num info={info('meta-c-spend', 'Spend', `What Meta charged for ${c.name}.`, range, { breakdown: [{ label: 'Impressions', value: num(m.impressions) }, { label: 'People reached', value: num(m.reach) }] })}>{eur(m.spend)}</Num>
                      </td>
                      <td className="num" data-label="Clicks">{num(m.clicks)}</td>
                      <td className="num" data-label="Visits">{num(m.visits)}</td>
                      <td className="num" data-label="Cost / visit">{eur(m.spend / Math.max(1, m.visits), 2)}</td>
                      <td className="num" data-label="Frequency">
                        <span className={freq >= TIRED_AT ? 'bad' : ''}>{freq.toFixed(1)}×</span>
                      </td>
                      <td className="card-acts" onClick={(e) => e.stopPropagation()}>
                        {stopped ? null : st === 'Running' ? (
                          <Act action="pauseCampaign" kind="sm" onClick={() => setPauseFor(c)}>
                            Pause
                          </Act>
                        ) : (
                          <Act action="pauseCampaign" kind="sm" onClick={() => override(`meta-status:${c.id}`, 'Running', `${c.name} restarted ${NOT_CHARGED}`)}>
                            Restart
                          </Act>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={8} className="card-full meta-detail">
                          <h3>Ad sets and ads</h3>
                          <p className="small muted">Meta chooses who sees each ad inside the audience. Each ad set needs about {LEARNING_TARGET} results a week to finish learning.</p>
                          <div className="table-wrap">
                            <table className="meta-sets">
                              <thead>
                                <tr>
                                  <th>Ad set or ad</th>
                                  <th>Learning</th>
                                  <th className="num">Daily budget</th>
                                  <th className="num">Spend</th>
                                  <th className="num">Freq.</th>
                                  <th />
                                </tr>
                              </thead>
                              <tbody>
                                {c.adSets.map((a) => {
                                  const sm = setMetrics(a, range);
                                  return (
                                    <Fragment key={a.id}>
                                      <tr>
                                        <td><b>{a.name}</b></td>
                                        <td className="nowrap"><LearningCell set={a} /></td>
                                        <td className="num">{eur(budgetOfSet(a, overrides), 2)}</td>
                                        <td className="num">{eur(sm.spend)}</td>
                                        <td className="num">{frequencyOf(sm).toFixed(1)}×</td>
                                        <td style={{ textAlign: 'right' }}>
                                          <Act action="setCap" kind="sm" onClick={() => (setBudgetFor(a), setBudget(String(budgetOfSet(a, overrides))))}>
                                            Budget
                                          </Act>
                                        </td>
                                      </tr>
                                      {a.ads.map((ad) => {
                                        const retired = overrides[`meta-ad:${ad.id}`] === 'Retired';
                                        return (
                                          <tr key={ad.id} className="meta-ad-row" style={retired ? { opacity: 0.55 } : undefined}>
                                            <td>{ad.name}</td>
                                            <td>{retired ? <Pill>Retired</Pill> : ad.frequency >= TIRED_AT ? <Pill tone="warn">May be wearing out</Pill> : null}</td>
                                            <td className="num small muted">{ad.ctr.toFixed(2)}% clicks</td>
                                            <td />
                                            <td className="num">{ad.frequency.toFixed(1)}×</td>
                                            <td style={{ textAlign: 'right' }}>
                                              {!retired && (
                                                <Act action="retireCreative" kind="sm" onClick={() => override(`meta-ad:${ad.id}`, 'Retired', `Ad retired ${NOT_CHARGED}`)}>
                                                  Retire
                                                </Act>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-foot">Visits stand in as the result until Meta's goal is decided. Open a campaign to see its ad sets and ads.</div>

      {pauseFor && (
        <Modal
          title={`Pause ${pauseFor.name}?`}
          confirm="Pause campaign"
          onClose={() => setPauseFor(null)}
          onConfirm={() => {
            override(`meta-status:${pauseFor.id}`, 'Paused', `${pauseFor.name} paused ${NOT_CHARGED}`);
            setPauseFor(null);
          }}
        >
          Meta stops showing its ads. Pausing counts as a major edit, so learning starts again after you restart it.
        </Modal>
      )}
      {budgetFor && (
        <Modal
          title={`Daily budget · ${campaignOfBudget?.name ?? 'Ad set'}`}
          confirm="Save budget"
          confirmDisabled={!(Number(budget) > 0)}
          onClose={() => setBudgetFor(null)}
          onConfirm={() => {
            override(`meta-budget:${budgetFor.id}`, budget, `Daily budget set to ${eur(Number(budget), 2)} ${NOT_CHARGED}`);
            setBudgetFor(null);
          }}
        >
          <div>A large change can restart learning, so change budgets in small steps.</div>
          <label className="confirm-type">
            Amount per day in EUR
            <input type="number" min="0.5" step="0.5" value={budget} onChange={(e) => setBudget(e.target.value)} autoFocus />
          </label>
        </Modal>
      )}
    </Card>
  );
}

const fill = (text: string, name: string) => text.replace(/\{name\}/g, name);

function AdPreview({ t }: { t: MetaTemplate }) {
  const camp = metaCampaigns.find((c) => siteById.get(c.siteId)?.kind === t.kind);
  const site = camp ? siteById.get(camp.siteId) : undefined;
  const name = site ? subjectOf(site) : t.kind;
  const ads = metaCampaigns.filter((c) => siteById.get(c.siteId)?.kind === t.kind).flatMap((c) => c.adSets.flatMap((a) => a.ads));
  const tired = ads.filter((a) => a.frequency >= TIRED_AT).length;
  return (
    <article className="ad-tpl">
      <header className="ad-tpl-head">
        <h3>{t.kind}</h3>
        <span className="small muted">{ads.length} ads{tired ? ` · ${tired} wearing out` : ''}</span>
      </header>
      <div className="ad-preview" aria-label={`Example ${t.kind} ad`}>
        <div className="ad-page">
          <span className="ad-avatar" aria-hidden>{name.charAt(0)}</span>
          <span>
            <b>{site?.name ?? name}</b>
            <span className="ad-sponsored">Sponsored</span>
          </span>
        </div>
        <p className="ad-text">{fill(t.primary, name)}</p>
        <div className={`ad-image k-${t.kind.toLowerCase()}`}>{t.image}</div>
        <div className="ad-foot">
          <span className="ad-foot-text">
            <span className="ad-domain">{site?.domain ?? 'site.com'}</span>
            <b>{fill(t.headline, name)}</b>
          </span>
          <span className="ad-button">{t.button}</span>
        </div>
      </div>
    </article>
  );
}

export function MetaTemplates() {
  return (
    <Card title="Ad templates by site kind" extra={<span className="small muted">each site's details fill the same template</span>}>
      <div className="ad-tpl-grid">
        {metaTemplates.map((t) => (
          <AdPreview key={t.kind} t={t} />
        ))}
      </div>
    </Card>
  );
}

/** Both platforms in one place. Spend adds up; results don't, because each platform counts its own. */
export function PlatformCompare({ google, meta, onOpen }: { google: { spend: number; clicks: number; conversions: number; campaigns: number; attention: number }; meta: { total: MetaMetrics; campaigns: number; attention: number }; onOpen: (p: 'google' | 'meta') => void }) {
  const row = (name: string, p: 'google' | 'meta', campaigns: number, spend: number, clicks: number, results: string, cost: string, attention: number) => (
    <tr>
      <td>
        <button className="link-btn" onClick={() => onOpen(p)}>{name}</button>
        <span className="sub">{campaigns} campaigns</span>
      </td>
      <td className="num" data-label="Spend">{eur(spend)}</td>
      <td className="num" data-label="Clicks">{num(clicks)}</td>
      <td className="num" data-label="Cost / click">{clicks ? eur(spend / clicks, 2) : '—'}</td>
      <td className="num" data-label="Results">{results}</td>
      <td className="num" data-label="Cost / result">{cost}</td>
      <td className="num" data-label="Needs a look">{attention}</td>
    </tr>
  );
  const spend = google.spend + meta.total.spend;
  const clicks = google.clicks + meta.total.clicks;
  return (
    <Card flush title="Platforms side by side">
      <div className="table-wrap">
        <table className="cards-sm">
          <thead>
            <tr>
              <th>Platform</th>
              <th className="num">Spend</th>
              <th className="num">Clicks</th>
              <th className="num">Cost / click</th>
              <th className="num">Results</th>
              <th className="num">Cost / result</th>
              <th className="num">Needs a look</th>
            </tr>
          </thead>
          <tbody>
            {row('Google Ads', 'google', google.campaigns, google.spend, google.clicks, `${num(google.conversions)} conversions`, google.conversions ? eur(google.spend / google.conversions, 2) : '—', google.attention)}
            {row('Meta', 'meta', meta.campaigns, meta.total.spend, meta.total.clicks, `${num(meta.total.visits)} visits`, meta.total.visits ? eur(meta.total.spend / meta.total.visits, 2) : '—', meta.attention)}
            <tr className="compare-total">
              <td><b>Both</b></td>
              <td className="num" data-label="Spend"><b>{eur(spend)}</b></td>
              <td className="num" data-label="Clicks"><b>{num(clicks)}</b></td>
              <td className="num" data-label="Cost / click"><b>{clicks ? eur(spend / clicks, 2) : '—'}</b></td>
              <td className="num muted" data-label="Results">Not added</td>
              <td className="num muted" data-label="Cost / result">—</td>
              <td className="num" data-label="Needs a look"><b>{google.attention + meta.attention}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="table-foot">Results aren't added together: each platform counts its own, and one person could be counted by both.</div>
    </Card>
  );
}
