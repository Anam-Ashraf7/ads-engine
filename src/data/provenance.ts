// PROTOTYPE: where the numbers come from. Data-source freshness, sync history and a per-site activity log.
// All times, delays and row counts are sample values; nothing here talks to a real system.
import { metaBySite, metaSiteOfKey } from './meta';
import { alerts, budgetMoves, campaignById, campaigns, campaignsBySite, dateOf, dealsBySite, deals, LAST_DAY, OWNERS, tests, TODAY, type Site } from './mock';

/** The moment the mockup pretends it is. */
export const NOW = `${TODAY}T10:30`;
const NOW_MS = Date.parse(NOW + ':00Z');

export type SourceKey = 'ads' | 'meta' | 'ga4' | 'adsense' | 'gsc' | 'invoicing';
export type Health = 'ok' | 'late' | 'failed';

export interface Sync {
  at: string; // ISO date-time, minutes precision
  rows: number;
  ok: boolean;
  error?: string;
}

export interface Source {
  key: SourceKey;
  name: string;
  short: string;
  provides: string;
  every: string; // how often we fetch (sample)
  lateAfterH: number; // hours after which the data counts as late (sample)
  syncs: Sync[]; // newest first
}

const at = (daysAgo: number, hhmm: string) => `${dateOf(TODAY, -daysAgo)}T${hhmm}`;

export const SOURCES: Source[] = [
  {
    key: 'ads',
    name: 'Google Ads API',
    short: 'Google Ads',
    provides: 'Ad spend, clicks, conversions, campaign and ad status',
    every: 'every 3 hours',
    lateAfterH: 6,
    syncs: [
      { at: at(0, '08:30'), rows: 9_412, ok: true },
      { at: at(0, '05:30'), rows: 9_380, ok: true },
      { at: at(0, '02:30'), rows: 9_377, ok: true },
      { at: at(1, '23:30'), rows: 9_351, ok: true },
      { at: at(1, '20:30'), rows: 9_340, ok: true },
      { at: at(1, '17:30'), rows: 9_302, ok: true },
    ],
  },
  {
    key: 'meta',
    name: 'Meta Marketing API (sample: not connected yet)',
    short: 'Meta',
    provides: 'Ad spend, clicks, visits and learning status for Meta campaigns',
    every: 'every 3 hours',
    lateAfterH: 6,
    syncs: [
      { at: at(0, '08:45'), rows: 214, ok: true },
      { at: at(0, '05:45'), rows: 212, ok: true },
      { at: at(0, '02:45'), rows: 212, ok: true },
      { at: at(1, '23:45'), rows: 209, ok: true },
      { at: at(1, '20:45'), rows: 207, ok: true },
      { at: at(1, '17:45'), rows: 205, ok: true },
    ],
  },
  {
    key: 'ga4',
    name: 'Google Analytics 4 (Data API)',
    short: 'Analytics',
    provides: 'Visits by source, engaged sessions, page views',
    every: 'every 6 hours',
    lateAfterH: 12,
    syncs: [
      { at: at(0, '04:15'), rows: 36_020, ok: true },
      { at: at(0, '03:50'), rows: 0, ok: false, error: 'Quota for the property was used up (429). Retried 25 minutes later.' },
      { at: at(1, '22:15'), rows: 35_870, ok: true },
      { at: at(1, '16:15'), rows: 35_811, ok: true },
      { at: at(1, '10:15'), rows: 35_790, ok: true },
      { at: at(1, '04:15'), rows: 35_702, ok: true },
    ],
  },
  {
    key: 'adsense',
    name: 'AdSense Management API',
    short: 'AdSense',
    provides: 'Estimated earnings and page views per site',
    every: 'once a day',
    lateAfterH: 30,
    syncs: [
      { at: at(1, '23:10'), rows: 200, ok: true },
      { at: at(2, '23:10'), rows: 200, ok: true },
      { at: at(3, '23:10'), rows: 199, ok: true },
      { at: at(4, '23:10'), rows: 199, ok: true },
      { at: at(5, '23:10'), rows: 199, ok: true },
      { at: at(6, '23:10'), rows: 198, ok: true },
    ],
  },
  {
    key: 'gsc',
    name: 'Search Console API',
    short: 'Search Console',
    provides: 'Search clicks, impressions, average position',
    every: 'once a day',
    lateAfterH: 60,
    syncs: [
      { at: at(3, '07:00'), rows: 14_880, ok: true },
      { at: at(1, '07:00'), rows: 0, ok: true, error: 'No new days available yet.' },
      { at: at(2, '07:00'), rows: 0, ok: true, error: 'No new days available yet.' },
      { at: at(4, '07:00'), rows: 14_702, ok: true },
      { at: at(5, '07:00'), rows: 14_655, ok: true },
      { at: at(6, '07:00'), rows: 14_610, ok: true },
    ].sort((a, b) => b.at.localeCompare(a.at)),
  },
  {
    key: 'invoicing',
    name: 'Invoicing export',
    short: 'Invoicing',
    provides: 'Sponsor invoices, payments and deal fees',
    every: 'every hour',
    lateAfterH: 3,
    syncs: [
      { at: at(0, '09:50'), rows: 0, ok: false, error: 'Export timed out after 30 s. Sponsor numbers are from 08:50.' },
      { at: at(0, '08:50'), rows: 351, ok: true },
      { at: at(0, '07:50'), rows: 351, ok: true },
      { at: at(0, '06:50'), rows: 350, ok: true },
      { at: at(0, '05:50'), rows: 350, ok: true },
      { at: at(0, '04:50'), rows: 350, ok: true },
    ],
  },
];
export const sourceByKey = new Map(SOURCES.map((s) => [s.key, s]));

const ms = (iso: string) => Date.parse(iso + ':00Z');

/** Last sync that brought data (failures and empty runs don't count). */
export const lastGood = (s: Source) => s.syncs.find((x) => x.ok && x.rows > 0)!;
export function health(s: Source): Health {
  if (!s.syncs[0].ok) return 'failed';
  return (NOW_MS - ms(lastGood(s).at)) / 3.6e6 > s.lateAfterH ? 'late' : 'ok';
}

/** "40 min ago", "6 h ago", "3 days ago" relative to the mockup's NOW. */
export function ago(iso: string) {
  const m = Math.round((NOW_MS - ms(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export const clock = (iso: string) => {
  const d = new Date(iso + ':00Z');
  return `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })} ${iso.slice(11, 16)}`;
};

// ---------- activity log ----------
export type ActivityKind = 'Data' | 'People' | 'System';
export interface Activity {
  id: string;
  at: string; // ISO date-time, or 'now' for things done in this session
  kind: ActivityKind;
  who: string; // person, "System" or the data source
  text: string;
  detail?: string;
  tone?: 'bad' | 'warn' | 'good';
}

// Each site gets its own seeded stream so the log differs per site and is stable across reloads.
function rngFor(id: string) {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function activityFor(s: Site): Activity[] {
  const r = rngFor(s.id);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const time = (daysAgo: number) => `${dateOf(LAST_DAY, -daysAgo)}T${String(8 + Math.floor(r() * 11)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`;
  const out: Activity[] = [];
  const add = (a: Omit<Activity, 'id'>) => out.push({ ...a, id: `${s.id}-${out.length}` });
  const cs = campaignsBySite.get(s.id) ?? [];
  const ds = dealsBySite.get(s.id) ?? [];
  const live = s.state === 'Live' || s.state === 'Paused';

  // Data: the latest import from each source, plus this site's own hiccups.
  if (live) {
    add({ at: at(0, '08:30'), kind: 'Data', who: 'Google Ads API', text: `Spend and clicks imported for ${cs.length} campaign${cs.length === 1 ? '' : 's'}`, detail: `${cs.length * 31} rows` });
    if (metaBySite.has(s.id)) add({ at: at(0, '08:45'), kind: 'Data', who: 'Meta', text: 'Spend, clicks and visits imported for 1 campaign', detail: 'sample: Meta is not connected yet' });
    add({ at: at(0, '04:15'), kind: 'Data', who: 'Analytics', text: 'Visits by source imported', detail: `${Math.round(120 + r() * 160)} rows` });
    add({ at: at(1, '23:10'), kind: 'Data', who: 'AdSense', text: 'Estimated earnings for 21 Oct imported', detail: 'estimated until month end' });
    add({ at: at(3, '07:00'), kind: 'Data', who: 'Search Console', text: 'Search clicks and positions to 18 Oct imported', detail: 'Search Console runs about 2–3 days behind (sample)', tone: 'warn' });
  }
  if (r() < 0.45) {
    const d = Math.floor(2 + r() * 20);
    add({ at: time(d), kind: 'Data', who: 'Analytics', text: 'Visit import failed: tracking tag sent no data for 6 hours', detail: 'Filled in on the next run', tone: 'bad' });
  }
  if (r() < 0.3 && cs.length) {
    add({ at: time(Math.floor(1 + r() * 25)), kind: 'Data', who: 'Google Ads API', text: 'Conversions for 3 days revised after late reporting', detail: `${Math.round(1 + r() * 6)} conversions added`, tone: 'warn' });
  }

  // People: things the team did on this site.
  const person = () => pick(OWNERS);
  if (cs.length) {
    const c = pick(cs);
    add({ at: time(Math.floor(3 + r() * 20)), kind: 'People', who: person(), text: `Paused campaign “${c.name}”`, detail: 'Cost per conversion over target for 5 days' });
    if (r() < 0.6) add({ at: time(Math.floor(1 + r() * 12)), kind: 'People', who: person(), text: `Restarted campaign “${c.name}”`, detail: 'New ad text approved' });
    const cr = c.creatives.find((x) => x.status === 'Retired');
    if (cr) add({ at: time(Math.floor(4 + r() * 20)), kind: 'People', who: person(), text: `Retired ${cr.kind.toLowerCase()} “${cr.name}”`, detail: 'Low click rate' });
  }
  if (s.monthlyCap) {
    const before = Math.round((s.monthlyCap * (0.7 + r() * 0.25)) / 50) * 50;
    add({ at: time(Math.floor(8 + r() * 20)), kind: 'People', who: s.owner, text: `Changed monthly cap from €${before.toLocaleString('en-GB')} to €${s.monthlyCap.toLocaleString('en-GB')}` });
  }
  const discount = ds.find((d) => d.discountAsk);
  if (discount) add({ at: time(Math.floor(2 + r() * 14)), kind: 'People', who: pick(['Ana R.', 'Marco B.']), text: `Approved ${Math.min(discount.discountAsk!, 15)}% discount for ${discount.sponsor}`, detail: discount.spot });
  const hold = ds.find((d) => d.stage === 'Negotiating' || d.stage === 'Offer sent');
  if (hold) add({ at: time(Math.floor(1 + r() * 9)), kind: 'People', who: hold.owner, text: `Reserved ${hold.spot.toLowerCase()} for ${hold.sponsor}`, detail: `held until ${dateOf(LAST_DAY, 10)}` });
  const active = ds.find((d) => d.stage === 'Active');
  if (active) add({ at: time(Math.floor(1 + r() * 20)), kind: 'People', who: active.owner, text: `Sent lead report to ${active.sponsor}`, detail: 'September clicks, calls and forms' });
  for (const t of tests.filter((x) => x.siteId === s.id)) add({ at: `${t.start}T09:${String(Math.floor(r() * 60)).padStart(2, '0')}`, kind: 'People', who: t.owner, text: `Started test “${t.title}”` });

  // System: suggestions and detections, and what people decided.
  for (const mv of budgetMoves.filter((m) => m.siteId === s.id)) {
    const decided = r();
    add({
      at: time(Math.floor(r() * 6)),
      kind: 'System',
      who: 'System',
      text: `Suggested moving €${mv.amount}/day from “${mv.from}” to “${mv.to}”`,
      detail: decided < 0.4 ? 'Waiting for approval' : decided < 0.8 ? `Approved by ${person()}` : `Declined by ${person()}`,
      tone: decided < 0.4 ? 'warn' : undefined,
    });
  }
  for (const a of alerts.filter((x) => x.siteId === s.id)) {
    add({ at: a.detected.replace(' ', 'T'), kind: 'System', who: 'System', text: `Detected: ${a.type.toLowerCase()}`, detail: a.resolved ? `Handled by ${a.resolved}` : a.owner ? `Assigned to ${a.owner}` : 'Not assigned yet', tone: a.severity === 'Critical' ? 'bad' : 'warn' });
  }
  if (cs.length && r() < 0.5) {
    add({ at: time(Math.floor(5 + r() * 20)), kind: 'System', who: 'System', text: 'Suggested lowering daily budgets: month-to-date spend reached 85% of the cap', detail: `Approved by ${s.owner}` });
  }

  return out.filter((a) => a.at <= NOW).sort((a, b) => b.at.localeCompare(a.at));
}

/** Which site an in-memory change (state.tsx override key) belongs to, so session actions land in that site's log. */
const dealById = new Map(deals.map((d) => [d.id, d]));
const moveById = new Map(budgetMoves.map((m) => [m.id, m]));
const alertById = new Map(alerts.map((a) => [a.id, a]));
const creativeSite = new Map(campaigns.flatMap((c) => c.creatives.map((cr) => [cr.id, c.siteId] as const)));
export function siteOfKey(key: string): string | undefined {
  const [kind, id] = key.split(':');
  switch (kind) {
    case 'site':
    case 'cap':
    case 'cap-meta':
    case 'plat':
    case 'hold':
      return id;
    case 'cmp':
    case 'cap-cmp':
      return campaignById.get(id)?.siteId;
    case 'cr':
      return creativeSite.get(id);
    case 'move':
      return moveById.get(id)?.siteId;
    case 'disc':
    case 'out':
    case 'proof':
    case 'make-good':
    case 'report':
      return dealById.get(id)?.siteId;
    case 'alert':
    case 'alert-done':
      return alertById.get(id)?.siteId;
    default:
      return metaSiteOfKey(key);
  }
}
