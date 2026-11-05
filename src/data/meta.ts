// PROTOTYPE: made-up Meta ads for the Campaigns screen, shaped like Meta's own levels (campaign, ad set, ad).
// Nothing here talks to Meta. The real connection is server/meta.mjs and stays off until it's wanted.
import { campaignsBySite, DAYS_IN_MONTH, DAYS_INTO_MONTH, META_DELIVERY as DELIVERY, META_VISIT_RATE as VISIT_RATE, metaLimits, metaPilot, type Site, type SiteKind, type SiteState } from './mock';

export type Learning = 'Active' | 'Learning' | 'Learning limited';
/** Meta's guidance: an ad set leaves learning after about 50 results in the week after its last major edit. */
export const LEARNING_TARGET = 50;

export interface MetaAd {
  id: string;
  name: string;
  ctr: number; // click rate, %
  frequency: number; // times the average person saw it
}
export interface MetaAdSet {
  id: string;
  name: string;
  audience: string;
  dailyBudget: number;
  cpc: number;
  daysSinceEdit: number;
  ads: MetaAd[];
}
export interface MetaCampaign {
  id: string;
  siteId: string;
  name: string;
  status: 'Running' | 'Paused';
  adSets: MetaAdSet[];
}

export const subjectOf = (s: Pick<Site, 'name'>) => s.name.replace(/Voices$/, '').replace(/\.[a-z.]+$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2');

function audienceFor(s: Site) {
  const who = subjectOf(s);
  if (s.kind === 'Local') return `People within 15 km of ${who}`;
  if (s.kind === 'Region') return `People living in ${who}`;
  if (s.kind === 'Topic') return `Interested in ${who}, ${s.country}`;
  if (s.kind === 'Person') return `Follows news about ${who}, ${s.country}`;
  if (s.kind === 'Institution') return `Connected to ${who}`;
  return `Interested in ${who}`;
}

export const metaCampaigns: MetaCampaign[] = metaPilot.map(({ site: s, plan: p }, i) => {
  const id = `mc${i}`;
  return {
    id,
    siteId: s.id,
    name: `${subjectOf(s)} · Visits`,
    status: 'Running',
    adSets: p.budgets.map((dailyBudget, j) => ({
      id: `${id}s${j}`,
      name: j === 0 ? audienceFor(s) : `${audienceFor(s)}, aged 45+`,
      audience: audienceFor(s),
      dailyBudget,
      cpc: p.cpc,
      daysSinceEdit: p.edit,
      ads: ['A', 'B'].map((v, k) => ({
        id: `${id}s${j}a${k}`,
        name: `${s.kind} template, version ${v}`,
        ctr: Number((1.1 + ((i + k) % 5) * 0.21).toFixed(2)),
        frequency: Number((p.freq + (k === 0 ? (i === 10 ? 1 : 0.2) : -0.2)).toFixed(1)),
      })),
    })),
  };
});
export const metaSiteIds = new Set(metaCampaigns.map((c) => c.siteId));
const setById = new Map(metaCampaigns.flatMap((c) => c.adSets).map((a) => [a.id, a]));

export const weeklyResults = (a: MetaAdSet) => Math.round((a.dailyBudget * DELIVERY * 7 * VISIT_RATE) / a.cpc);
export function learningOf(a: MetaAdSet): Learning {
  const week = weeklyResults(a);
  const sinceEdit = (week * Math.min(a.daysSinceEdit, 7)) / 7;
  if (sinceEdit >= LEARNING_TARGET) return 'Active';
  return week >= LEARNING_TARGET ? 'Learning' : 'Learning limited';
}

export interface MetaMetrics {
  spend: number;
  clicks: number;
  visits: number;
  impressions: number;
  reach: number;
}
export function setMetrics(a: MetaAdSet, days: number): MetaMetrics {
  const spend = a.dailyBudget * DELIVERY * days;
  const clicks = spend / a.cpc;
  const freq = a.ads[0].frequency;
  const ctr = a.ads.reduce((n, x) => n + x.ctr, 0) / a.ads.length;
  const impressions = clicks / (ctr / 100);
  return { spend, clicks, visits: clicks * VISIT_RATE, impressions, reach: impressions / freq };
}
const zero: MetaMetrics = { spend: 0, clicks: 0, visits: 0, impressions: 0, reach: 0 };
export const addMetrics = (list: MetaMetrics[]) =>
  list.reduce((t, m) => ({ spend: t.spend + m.spend, clicks: t.clicks + m.clicks, visits: t.visits + m.visits, impressions: t.impressions + m.impressions, reach: t.reach + m.reach }), zero);
export const campaignTotals = (c: MetaCampaign, days: number) => addMetrics(c.adSets.map((a) => setMetrics(a, days)));
export const frequencyOf = (m: MetaMetrics) => (m.reach ? m.impressions / m.reach : 0);

/** People have seen this ad so often it may be wearing out. Sample threshold. */
export const TIRED_AT = 4;

// Monthly cap for the whole Meta account, on top of each site's own limit: warn first, pause only when it's reached.
export const META_CAP = 1500;
export const META_WARN_AT = 0.8;
const dailyTotal = metaCampaigns.flatMap((c) => c.adSets).reduce((n, a) => n + a.dailyBudget * DELIVERY, 0);
export const metaMtd = dailyTotal * DAYS_INTO_MONTH;
export const metaForecast = dailyTotal * DAYS_IN_MONTH;
/** The day of the month the cap is reached at this rate, or null if it isn't reached this month. */
export const metaCapDay = (() => {
  const day = DAYS_INTO_MONTH + Math.ceil((META_CAP - metaMtd) / dailyTotal);
  return day <= DAYS_IN_MONTH ? day : null;
})();

export type LearningEffect = 'restarts' | 'may-restart';
export interface MetaApproval {
  id: string;
  campaignId: string;
  title: string;
  why: string;
  effect: LearningEffect;
  apply?: { key: string; value: string };
  done: string;
}
const ap = (i: number) => metaCampaigns[i];
const raise = (i: number, to: number): MetaApproval | null => {
  const c = ap(i);
  if (!c) return null;
  const a = c.adSets[0];
  return {
    id: `raise-${a.id}`,
    campaignId: c.id,
    title: `Raise the daily budget from €${a.dailyBudget.toFixed(2)} to €${to.toFixed(2)}`,
    why: `About ${weeklyResults(a)} results a week, short of the ${LEARNING_TARGET} Meta needs to finish learning.`,
    effect: 'may-restart',
    apply: { key: `meta-budget:${a.id}`, value: String(to) },
    done: `Budget set to €${to.toFixed(2)}/day`,
  };
};
const combo = ap(3);
const tired = ap(10);
const weak = ap(11);
export const metaApprovals: MetaApproval[] = [
  raise(0, 4),
  combo && {
    id: `combine-${combo.id}`,
    campaignId: combo.id,
    title: 'Combine the 2 ad sets into 1',
    why: `Together they would get about ${combo.adSets.reduce((n, a) => n + weeklyResults(a), 0)} results a week. Neither reaches ${LEARNING_TARGET} alone.`,
    effect: 'restarts',
    done: 'Ad sets marked to combine',
  },
  tired && {
    id: `retire-${tired.adSets[0].ads[0].id}`,
    campaignId: tired.id,
    title: `Retire "${tired.adSets[0].ads[0].name}"`,
    why: `The average person has seen it ${tired.adSets[0].ads[0].frequency.toFixed(1)} times, so it may be wearing out.`,
    effect: 'restarts',
    apply: { key: `meta-ad:${tired.adSets[0].ads[0].id}`, value: 'Retired' },
    done: 'Ad retired',
  },
  weak && {
    id: `pause-${weak.id}`,
    campaignId: weak.id,
    title: 'Pause this campaign',
    why: `It has the highest cost per visit in the pilot, at €${(weak.adSets[0].cpc / VISIT_RATE).toFixed(2)}.`,
    effect: 'restarts',
    apply: { key: `meta-status:${weak.id}`, value: 'Paused' },
    done: 'Campaign paused',
  },
].filter((x): x is MetaApproval => !!x);

export const approvalsWaiting = (overrides: Record<string, string>) => metaApprovals.filter((a) => !overrides[`meta-approval:${a.id}`] && !(a.apply && overrides[a.apply.key]));
export const budgetOfSet = (a: MetaAdSet, overrides: Record<string, string>) => Number(overrides[`meta-budget:${a.id}`] ?? setById.get(a.id)?.dailyBudget ?? a.dailyBudget);

// One ad template per site kind. {name} and {place} are filled in from the site.
export interface MetaTemplate {
  kind: SiteKind;
  primary: string;
  headline: string;
  image: string;
  button: string;
}
export const metaTemplates: MetaTemplate[] = [
  { kind: 'Local', primary: "What's happening in {name} this week: news, events and places to know.", headline: 'Your guide to {name}', image: 'Photo of the town centre', button: 'Learn more' },
  { kind: 'Region', primary: 'The best of {name}, from places to visit to what locals are talking about.', headline: 'Discover {name}', image: 'Landscape from the region', button: 'Learn more' },
  { kind: 'Topic', primary: 'New to {name} or already hooked? Guides, news and ideas in one place.', headline: 'All about {name}', image: 'Close-up of the topic', button: 'Read more' },
  { kind: 'Person', primary: 'The latest on {name}: news, interviews and the story so far.', headline: 'Follow {name}', image: 'Licensed photo of the person', button: 'Read more' },
  { kind: 'Institution', primary: 'News, dates and stories from {name}, for everyone connected to it.', headline: 'Inside {name}', image: 'Photo of the building or team', button: 'Learn more' },
  { kind: 'Event', primary: 'Dates, line-ups and tips for {name}, so you can plan ahead.', headline: 'Get ready for {name}', image: 'Crowd at last year\'s event', button: 'See details' },
];

// ---------- which platforms a site is running on ----------
export type PlatformKey = 'google' | 'meta';
export type AdsLabel = 'Both' | 'Google Ads only' | 'Meta only' | 'No ads';
export const ADS_LABELS: AdsLabel[] = ['Both', 'Google Ads only', 'Meta only', 'No ads'];
export const metaBySite = new Map(metaCampaigns.map((c) => [c.siteId, c]));
export const metaLimitOf = (siteId: string, overrides: Record<string, string>) => Number(overrides[`cap-meta:${siteId}`] ?? metaLimits.get(siteId) ?? 0);

/** True when something above the campaign has stopped this platform: the site's state, its platform pause, or the global pause. */
export const platformStopped = (siteId: string, state: SiteState, key: PlatformKey, overrides: Record<string, string>, globalPause: boolean) => globalPause || state !== 'Live' || overrides[`plat:${siteId}:${key}`] === 'Paused';

export function adsOnSite(siteId: string, state: SiteState, overrides: Record<string, string>, globalPause: boolean) {
  const google = campaignsBySite.get(siteId) ?? [];
  const meta = metaCampaigns.filter((c) => c.siteId === siteId);
  const gRunning = platformStopped(siteId, state, 'google', overrides, globalPause) ? 0 : google.filter((c) => (overrides[`cmp:${c.id}`] ?? c.status) === 'Enabled').length;
  const mRunning = platformStopped(siteId, state, 'meta', overrides, globalPause) ? 0 : meta.filter((c) => (overrides[`meta-status:${c.id}`] ?? c.status) === 'Running').length;
  const label: AdsLabel = gRunning && mRunning ? 'Both' : gRunning ? 'Google Ads only' : mRunning ? 'Meta only' : 'No ads';
  return { google: { running: gRunning, total: google.length }, meta: { running: mRunning, total: meta.length }, label };
}

/** Which site a Meta change belongs to, so it lands in that site's activity log. */
export function metaSiteOfKey(key: string) {
  const id = key.match(/mc\d+/)?.[0];
  return id && key.startsWith('meta-') ? metaCampaigns.find((c) => c.id === id)?.siteId : undefined;
}
