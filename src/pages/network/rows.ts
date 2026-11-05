import { adsOnSite } from '../../data/meta';
import { alertsBySite, monthToDate, siteMetrics, siteRisk, tests, type Alert, type Metrics, type Risk, type Site, type SiteState } from '../../data/mock';

export interface Row {
  s: Site;
  state: SiteState;
  m: Metrics;
  prev: Metrics;
  risk: Risk;
  alerts: Alert[];
  tests: number;
  capUsed: number;
  spark: number[];
  ads: ReturnType<typeof adsOnSite>;
}

const runningTests = new Map<string, number>();
for (const t of tests) if (t.status === 'Running') runningTests.set(t.siteId, (runningTests.get(t.siteId) ?? 0) + 1);

export function buildRow(s: Site, range: number, state: SiteState, overrides: Record<string, string> = {}, globalPause = false): Row {
  return {
    s,
    state,
    m: siteMetrics(s, range),
    prev: siteMetrics(s, range, 1),
    risk: siteRisk(s),
    alerts: alertsBySite.get(s.id) ?? [],
    tests: runningTests.get(s.id) ?? 0,
    capUsed: s.monthlyCap ? monthToDate(s) / s.monthlyCap : 0,
    spark: s.days.slice(-range).map((d) => d.visits),
    ads: adsOnSite(s.id, state, overrides, globalPause),
  };
}

export interface SiteFilters {
  q: string;
  kind: string;
  group: string;
  domainType: string;
  country: string;
  region: string;
  cohort: string;
  state: string;
  risk: string;
  ads: string;
}
export const NO_FILTERS: SiteFilters = { q: '', kind: '', group: '', domainType: '', country: '', region: '', cohort: '', state: '', risk: '', ads: '' };

export function matches(r: Row, f: SiteFilters) {
  const q = f.q.trim().toLowerCase();
  return (
    (!q || r.s.name.toLowerCase().includes(q) || r.s.domain.includes(q) || (r.s.region ?? '').toLowerCase().includes(q)) &&
    (!f.kind || r.s.kind === f.kind || r.s.size === f.kind) &&
    (!f.group || r.s.group === f.group) &&
    (!f.domainType || r.s.domainType === f.domainType) &&
    (!f.country || r.s.country === f.country) &&
    (!f.region || r.s.region === f.region) &&
    (!f.cohort || r.s.launchCohort === f.cohort) &&
    (!f.state || r.state === f.state) &&
    (!f.risk || r.risk === f.risk) &&
    (!f.ads || r.ads.label === f.ads)
  );
}
