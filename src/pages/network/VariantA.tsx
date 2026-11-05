// Variant A: one dense, sortable row per site with a KPI strip on top.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../state';
import { Meter, Spark } from '../../charts';
import { kindLine, OWNERS, sumMetrics, openAlerts as allAlerts } from '../../data/mock';
import { compact, delta, eur, eurK, num } from '../../format';
import { Act, AdMarks, Card, Kpi, Modal, Placeholder, RiskPill, StatePill, useSort } from '../../ui';
import { explain, Num } from '../../provenance';
import { EstatePlan } from './EstatePlan';
import type { Row } from './rows';

type Key = 'name' | 'spend' | 'visits' | 'visitsChg' | 'adsense' | 'sponsor' | 'contribution' | 'cap' | 'alerts' | 'risk' | 'tests';
const RISK_N = { High: 3, Medium: 2, Low: 1 };

// Daily visits as an index of the site's own previous-period average (100 = same as before), so every
// trend line in the table shares one 0-200 scale.
const indexed = (r: Row) => {
  const base = r.prev.visits / Math.max(1, r.spark.length) || r.m.visits / Math.max(1, r.spark.length) || 1;
  return r.spark.map((v) => Math.min(200, (v / base) * 100));
};

export function VariantA({ rows }: { rows: Row[] }) {
  const nav = useNavigate();
  const { range, override, overrides } = useApp();
  const { sort, th } = useSort<Key>('contribution');
  const [limit, setLimit] = useState(40);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [assign, setAssign] = useState(false);
  const [owner, setOwner] = useState(OWNERS[0]);

  const sorted = useMemo(() => {
    const val = (r: Row): number | string => {
      switch (sort.key) {
        case 'name': return r.s.name;
        case 'spend': return r.m.spend;
        case 'visits': return r.m.visits;
        case 'visitsChg': return r.prev.visits ? r.m.visits / r.prev.visits : 0;
        case 'adsense': return r.m.adsense;
        case 'sponsor': return r.m.sponsor;
        case 'contribution': return r.m.contribution;
        case 'cap': return r.capUsed;
        case 'alerts': return r.alerts.length;
        case 'risk': return RISK_N[r.risk] * 100 + r.alerts.length;
        case 'tests': return r.tests;
      }
    };
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)) * sort.dir;
    });
  }, [rows, sort]);

  const tot = sumMetrics(rows.map((r) => r.m));
  const prev = sumMetrics(rows.map((r) => r.prev));
  const ids = new Set(rows.map((r) => r.s.id));
  const openAlerts = allAlerts.filter((a) => ids.has(a.siteId));
  const highRisk = rows.filter((r) => r.risk === 'High').length;
  const x = (k: Parameters<typeof explain>[0]) => explain(k, tot, range, rows.length === 1 ? rows[0].s.name : `these ${rows.length} sites`);

  return (
    <>
      <div className="kpis">
        <Kpi label={<Placeholder>Contribution</Placeholder>} value={eurK(tot.contribution)} change={delta(tot.contribution, prev.contribution)} sub="vs previous" info={x('contribution')} />
        <Kpi label="Ad spend" value={eurK(tot.spend)} change={delta(tot.spend, prev.spend)} goodWhenUp={false} sub="Google Ads and Meta" info={x('spend')} />
        <Kpi label="Qualified visits" value={compact(tot.visits)} change={delta(tot.visits, prev.visits)} sub="all sources" info={x('visits')} />
        <Kpi label="Sponsor revenue" value={eurK(tot.sponsor)} change={delta(tot.sponsor, prev.sponsor)} info={x('sponsor')} />
        <Kpi label="AdSense revenue" value={eurK(tot.adsense)} change={delta(tot.adsense, prev.adsense)} info={x('adsense')} />
        <Kpi label="Open alerts" value={openAlerts.length} sub={`${openAlerts.filter((a) => a.severity === 'Critical').length} critical`} />
        <Kpi label="Tests running" value={rows.reduce((s, r) => s + r.tests, 0)} sub={`on ${rows.filter((r) => r.tests).length} sites`} />
        <Kpi label="High-risk sites" value={highRisk} sub={`of ${rows.length}`} />
      </div>

      <EstatePlan rows={rows} range={range} />

      <Card
        flush
        title={`Sites (${rows.length})`}
        extra={
          <div className="row">
            {picked.size > 0 && <span className="small muted">{picked.size} selected</span>}
            <Act action="assignOwner" kind="sm" onClick={() => setAssign(true)}>
              Assign owner{picked.size ? ` (${picked.size})` : ''}
            </Act>
            <button className="btn sm" onClick={() => nav('/?variant=C')}>
              Open exception queue
            </button>
          </div>
        }
      >
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="dense cards-sm">
            <thead>
              <tr>
                <th style={{ width: 28 }} className="hide-sm">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    style={{ height: 'auto' }}
                    checked={picked.size > 0 && picked.size === Math.min(limit, sorted.length)}
                    onChange={(e) => setPicked(e.target.checked ? new Set(sorted.slice(0, limit).map((r) => r.s.id)) : new Set())}
                  />
                </th>
                {th('name', 'Site', '')}
                <th>State</th>
                {th('spend', 'Spend')}
                {th('visits', 'Qualified visits')}
                {th('visitsChg', <span title="Daily visits, 100 = previous period's average; same scale on every row">Trend</span>)}
                {th('adsense', 'AdSense')}
                {th('sponsor', 'Sponsors')}
                {th('contribution', <Placeholder>Contribution</Placeholder>)}
                {th('cap', 'Cap used (Oct)')}
                {th('tests', 'Tests')}
                {th('risk', 'Risk', '')}
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, limit).map((r) => (
                <tr key={r.s.id} className={`click${picked.has(r.s.id) ? ' sel' : ''}`} onClick={() => nav(`/sites/${r.s.id}`)}>
                  <td className="hide-sm" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.s.name}`}
                      style={{ height: 'auto' }}
                      checked={picked.has(r.s.id)}
                      onChange={(e) => {
                        const n = new Set(picked);
                        if (e.target.checked) n.add(r.s.id);
                        else n.delete(r.s.id);
                        setPicked(n);
                      }}
                    />
                  </td>
                  <td className="card-title" title={`${r.s.domain} · cohort ${r.s.launchCohort}`}>
                    <span className="site-name">{r.s.name}</span>
                    <span className="sub nowrap">
                      <AdMarks google={r.ads.google.running > 0} meta={r.ads.meta.running > 0} /> {r.s.country} · {kindLine(r.s)}
                    </span>
                  </td>
                  <td data-label="State">
                    <StatePill state={r.state} />
                  </td>
                  <td className="num" data-label="Spend">
                    <Num info={explain('spend', r.m, range, r.s.name)}>{eur(r.m.spend)}</Num>
                  </td>
                  <td className="num" data-label="Qualified visits">
                    <Num info={explain('visits', r.m, range, r.s.name)}>{num(r.m.visits)}</Num>
                    <span className={`sub ${r.m.visits >= r.prev.visits ? 'good' : 'bad'}`}>{delta(r.m.visits, r.prev.visits)}</span>
                  </td>
                  <td className="hide-sm">
                    <Spark values={indexed(r)} min={0} max={200} color={r.m.visits >= r.prev.visits ? 'var(--c3)' : 'var(--danger)'} />
                  </td>
                  <td className="num" data-label="AdSense">
                    <Num info={explain('adsense', r.m, range, r.s.name)}>{eur(r.m.adsense)}</Num>
                  </td>
                  <td className="num" data-label="Sponsors">{r.m.sponsor ? <Num info={explain('sponsor', r.m, range, r.s.name)}>{eur(r.m.sponsor)}</Num> : <span className="muted">—</span>}</td>
                  <td className={`num ${r.m.contribution < 0 ? 'bad' : ''}`} style={{ fontWeight: 600 }} data-label="Contribution">
                    <Num info={explain('contribution', r.m, range, r.s.name)}>{eur(r.m.contribution)}</Num>
                  </td>
                  <td className="num" data-label="Cap used (Oct)">
                    {r.s.monthlyCap ? (
                      <>
                        <Meter value={r.capUsed} max={1} tone={r.capUsed > 0.85 ? 'warn' : 'ok'} /> <span className="small">{Math.round(r.capUsed * 100)}%</span>
                        <span className="sub">of {eur(r.s.monthlyCap)}</span>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="num hide-sm">{r.tests || <span className="muted">—</span>}</td>
                  <td data-label="Risk">
                    <RiskPill risk={r.risk} />
                    {r.alerts.length > 0 && (
                      <span className={`sub nowrap${r.alerts.some((a) => a.severity === 'Critical') ? ' bad' : ''}`}>
                        {r.alerts.length} alert{r.alerts.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </td>
                  <td className="small nowrap" data-label="Owner">{overrides[`owner:${r.s.id}`] ?? r.s.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          Showing {Math.min(limit, sorted.length)} of {sorted.length} · last {range} days
          <span className="spacer" />
          {limit < sorted.length && (
            <button className="btn sm" onClick={() => setLimit(limit + 60)}>
              Show more
            </button>
          )}
        </div>
      </Card>

      {assign && (
        <Modal
          title={picked.size ? `Assign owner to ${picked.size} sites` : 'Assign owner'}
          onClose={() => setAssign(false)}
          onConfirm={() => {
            for (const id of picked) overrides[`owner:${id}`] = owner;
            override('_owners', String(Date.now()), `${owner} now owns ${picked.size || 0} site${picked.size === 1 ? '' : 's'} (mockup: not saved)`);
            setPicked(new Set());
            setAssign(false);
          }}
          confirm="Assign"
        >
          {!picked.size && <div>Tick sites in the table first.</div>}
          <label>
            Owner
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              {OWNERS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        </Modal>
      )}
    </>
  );
}

