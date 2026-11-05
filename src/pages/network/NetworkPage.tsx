import { ADS_LABELS } from '../../data/meta';
// PROTOTYPE: three variants of the network command center, switchable via ?variant=A|B|C.
import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { COHORTS, COUNTRIES, DOMAIN_TYPES, GROUPS, KIND_FILTER, sites } from '../../data/mock';
import { PrototypeSwitcher, useVariant } from '../../prototype/Switcher';
import { Select } from '../../ui';
import { buildRow, matches, NO_FILTERS, type SiteFilters } from './rows';
import { VariantA } from './VariantA';
import { VariantB } from './VariantB';
import { VariantC } from './VariantC';

const VARIANTS = [
  { key: 'A', name: 'Site table', short: 'Table' },
  { key: 'B', name: 'Peer groups', short: 'Groups' },
  { key: 'C', name: 'Exceptions first', short: 'Exceptions' },
];
const uniq = (xs: string[]) => [...new Set(xs)].sort();

export function NetworkPage() {
  const { range, siteState, overrides, globalPause } = useApp();
  const variant = useVariant(VARIANTS.map((v) => v.key));
  const [f, setF] = useState<SiteFilters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false); // phones only: filters fold behind one button
  const all = useMemo(() => sites.map((s) => buildRow(s, range, siteState(s.id, s.state), overrides, globalPause)), [range, siteState, overrides, globalPause]);
  const rows = useMemo(() => all.filter((r) => matches(r, f)), [all, f]);
  const set = (k: keyof SiteFilters) => (v: string) => setF({ ...f, [k]: v, ...(k === 'country' ? { region: '' } : {}) });
  const regions = useMemo(() => uniq(sites.filter((s) => s.region && (!f.country || s.country === f.country)).map((s) => s.region!)), [f.country]);
  const active = Object.entries(f).filter(([, v]) => v).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Network command center</h1>
          <p>
            {rows.length === all.length ? `All ${all.length} sites` : `${rows.length} of ${all.length} sites`} · last {range} days compared with the {range} days before
          </p>
        </div>
        <span className="spacer" />
        <PrototypeSwitcher variants={VARIANTS} />
      </div>
      <div className={`filters foldable${showFilters ? ' open' : ''}`}>
        <input className="search" placeholder="Search site, domain or region" value={f.q} onChange={(e) => set('q')(e.target.value)} />
        <button className={`btn filters-toggle${active - (f.q ? 1 : 0) > 0 ? ' set' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
          Filters{active - (f.q ? 1 : 0) > 0 ? ` (${active - (f.q ? 1 : 0)})` : ''}
        </button>
        <Select label="Country" value={f.country} options={COUNTRIES} onChange={set('country')} />
        <Select label="Region" value={f.region} options={regions} onChange={set('region')} />
        <Select label="Site kind" value={f.kind} options={KIND_FILTER} onChange={set('kind')} />
        <Select label="Group" value={f.group} options={GROUPS} onChange={set('group')} />
        <Select label="Domain" value={f.domainType} options={DOMAIN_TYPES} onChange={set('domainType')} />
        <Select label="Cohort" value={f.cohort} options={COHORTS} onChange={set('cohort')} />
        <Select label="State" value={f.state} options={['Live', 'Paused', 'Building', 'Retired']} onChange={set('state')} />
        <Select label="Risk" value={f.risk} options={['High', 'Medium', 'Low']} onChange={set('risk')} />
        <Select label="Ads on" value={f.ads} options={ADS_LABELS} onChange={set('ads')} />
        {active > 0 && (
          <button className="btn ghost sm" onClick={() => setF(NO_FILTERS)}>
            Clear {active} filter{active > 1 ? 's' : ''}
          </button>
        )}
      </div>
      {variant === 'A' && <VariantA rows={rows} />}
      {variant === 'B' && <VariantB rows={rows} />}
      {variant === 'C' && <VariantC rows={rows} />}
    </>
  );
}
