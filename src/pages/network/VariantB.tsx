// Variant B: sites grouped into peer groups, each compared with the network baseline. Outliers inside a group are flagged.
import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../state';
import { COHORTS, COUNTRIES, kindLine, SITE_KINDS, sumMetrics, type Site } from '../../data/mock';
import { delta, eur, eurK, num, pct } from '../../format';
import { Icon } from '../../icons';
import { explain, Num } from '../../provenance';
import { AdMarks, Act, Card, Modal, Placeholder, RiskPill, StatePill } from '../../ui';
import type { Row } from './rows';

type Dim = 'country' | 'region' | 'kind' | 'group' | 'domainType' | 'launchCohort';
const DIMS: { key: Dim; label: string }[] = [
  { key: 'country', label: 'Country' },
  { key: 'region', label: 'Region' },
  { key: 'kind', label: 'Site kind' },
  { key: 'group', label: 'Group' },
  { key: 'domainType', label: 'Domain type' },
  { key: 'launchCohort', label: 'Launch cohort' },
];
// Sites without a region or group (national sites, Local sites) share one bucket.
const val = (s: Site, d: Dim) => s[d] ?? (d === 'region' ? 'National' : d === 'group' ? `${s.kind} (no group)` : '—');

// Contribution per € of ad spend: the yardstick used to compare a site with its peers.
const efficiency = (r: Row) => (r.m.spend > 0 ? r.m.contribution / r.m.spend : null);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export function VariantB({ rows }: { rows: Row[] }) {
  const nav = useNavigate();
  const { toast, range } = useApp();
  const [dim, setDim] = useState<Dim>('country');
  const [open, setOpen] = useState<string | null>(null);
  const [onlyOutliers, setOnlyOutliers] = useState(false);
  const [budgetFor, setBudgetFor] = useState<string | null>(null);
  const [amount, setAmount] = useState('500');

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) map.set(val(r.s, dim), [...(map.get(val(r.s, dim)) ?? []), r]);
    return [...map.entries()]
      .map(([key, rs]) => {
        const m = sumMetrics(rs.map((r) => r.m));
        const p = sumMetrics(rs.map((r) => r.prev));
        const effs = rs.map(efficiency).filter((x): x is number => x != null);
        const base = median(effs);
        const spread = median(effs.map((e) => Math.abs(e - base))) || 0.2;
        const scored = rs.map((r) => {
          const e = efficiency(r);
          const z = e == null ? 0 : (e - base) / spread;
          return { r, e, z, outlier: e != null && Math.abs(z) > 2.2 };
        });
        return {
          key,
          rs: scored,
          m,
          p,
          live: rs.filter((r) => r.state === 'Live').length,
          base,
          perSite: m.contribution / rs.length,
          risk: { High: rs.filter((r) => r.risk === 'High').length, Medium: rs.filter((r) => r.risk === 'Medium').length, Low: rs.filter((r) => r.risk === 'Low').length },
          outliers: scored.filter((x) => x.outlier).length,
        };
      })
      .sort((a, b) => b.m.contribution - a.m.contribution);
  }, [rows, dim]);

  const net = sumMetrics(rows.map((r) => r.m));
  const netPerSite = rows.length ? net.contribution / rows.length : 0;

  // country × site type matrix of contribution per site
  const matrix = useMemo(() => {
    const cell = (c: string, t: string) => {
      const rs = rows.filter((r) => r.s.country === c && r.s.kind === t);
      return rs.length ? { n: rs.length, v: sumMetrics(rs.map((r) => r.m)).contribution / rs.length } : null;
    };
    return COUNTRIES.map((c) => ({ c, cells: SITE_KINDS.map((t) => cell(c, t)) }));
  }, [rows]);
  const maxAbs = Math.max(1, ...matrix.flatMap((m) => m.cells.map((x) => Math.abs(x?.v ?? 0))));

  return (
    <>
      <div className="grid g-side">
        <Card
          flush
          title="Peer groups"
          extra={
            <div className="row">
              <div className="seg" role="group" aria-label="Group by">
                {DIMS.map((d) => (
                  <button key={d.key} className={dim === d.key ? 'on' : ''} onClick={() => (setDim(d.key), setOpen(null))}>
                    {d.label}
                  </button>
                ))}
              </div>
              <label className="row small">
                <input type="checkbox" style={{ height: 'auto' }} checked={onlyOutliers} onChange={(e) => setOnlyOutliers(e.target.checked)} />
                Only outliers
              </label>
            </div>
          }
        >
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>{DIMS.find((d) => d.key === dim)!.label}</th>
                  <th className="num">Sites</th>
                  <th className="num">Spend</th>
                  <th className="num">Qualified visits</th>
                  <th className="num">
                    <Placeholder>Contribution</Placeholder>
                  </th>
                  <th className="num">Per site vs network</th>
                  <th>Risk mix</th>
                  <th className="num">Outliers</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const vsNet = netPerSite ? (g.perSite - netPerSite) / Math.abs(netPerSite) : 0;
                  const shown = onlyOutliers ? g.rs.filter((x) => x.outlier) : g.rs;
                  if (onlyOutliers && !shown.length) return null;
                  const isOpen = open === g.key || onlyOutliers;
                  return (
                    <Fragment key={g.key}>
                      <tr className="click" onClick={() => setOpen(open === g.key ? null : g.key)}>
                        <td>
                          <b>
                            <span className="caret">{isOpen ? Icon.chevronDown() : Icon.chevronRight()}</span>
                            {g.key}
                          </b>
                          <span className="sub">{g.live} live</span>
                        </td>
                        <td className="num">{g.rs.length}</td>
                        <td className="num">
                          <Num info={explain('spend', g.m, range, `${g.key} (${g.rs.length} sites)`)}>{eurK(g.m.spend)}</Num>
                        </td>
                        <td className="num">
                          <Num info={explain('visits', g.m, range, `${g.key} (${g.rs.length} sites)`)}>{num(g.m.visits)}</Num>
                          <span className={`sub ${g.m.visits >= g.p.visits ? 'good' : 'bad'}`}>{delta(g.m.visits, g.p.visits)}</span>
                        </td>
                        <td className={`num ${g.m.contribution < 0 ? 'bad' : ''}`} style={{ fontWeight: 600 }}>
                          <Num info={explain('contribution', g.m, range, `${g.key} (${g.rs.length} sites)`)}>{eurK(g.m.contribution)}</Num>
                        </td>
                        <td className="num">
                          {eur(g.perSite)}
                          <span className={`sub ${vsNet >= 0 ? 'good' : 'bad'}`}>
                            {vsNet >= 0 ? 'above' : 'below'} network avg {eur(netPerSite)}
                          </span>
                        </td>
                        <td>
                          <RiskMix {...g.risk} />
                        </td>
                        <td className="num">{g.outliers ? <span className="pill t-warn">{g.outliers}</span> : <span className="muted">—</span>}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <Act action="startTest" kind="sm" onClick={() => setBudgetFor(g.key)}>
                            Test
                          </Act>
                        </td>
                      </tr>
                      {isOpen &&
                        [...shown]
                          .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
                          .map(({ r, e, z, outlier }) => (
                            <tr key={r.s.id} className="click sub-row" onClick={() => nav(`/sites/${r.s.id}`)}>
                              <td style={{ paddingLeft: 26 }}>
                                <span className="site-name">{r.s.name}</span>
                                <span className="sub">
                                  <AdMarks google={r.ads.google.running > 0} meta={r.ads.meta.running > 0} /> {kindLine(r.s)} · {r.s.country} · {r.s.launchCohort}
                                </span>
                              </td>
                              <td>
                                <StatePill state={r.state} />
                              </td>
                              <td className="num">
                                <Num info={explain('spend', r.m, range, r.s.name)}>{eur(r.m.spend)}</Num>
                              </td>
                              <td className="num">
                                <Num info={explain('visits', r.m, range, r.s.name)}>{num(r.m.visits)}</Num>
                              </td>
                              <td className={`num ${r.m.contribution < 0 ? 'bad' : ''}`}>
                                <Num info={explain('contribution', r.m, range, r.s.name)}>{eur(r.m.contribution)}</Num>
                              </td>
                              <td className="num" colSpan={2}>
                                {e == null ? (
                                  <span className="muted">no spend</span>
                                ) : (
                                  <>
                                    {eur(e, 2)} per €1 spent
                                    <span className="sub">group median {eur(g.base, 2)}</span>
                                  </>
                                )}
                              </td>
                              <td className="num" colSpan={2}>
                                {outlier ? <span className={`pill ${z > 0 ? 't-ok' : 't-danger'}`}>{z > 0 ? 'Far above peers' : 'Far below peers'}</span> : <span className="muted small">in range</span>}
                              </td>
                            </tr>
                          ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-foot">Outlier = contribution per €1 of ad spend far from the group's median. Click a group to see its sites. G and M show each site's ad platforms; use the Ads on filter to compare like with like.</div>
        </Card>

        <div className="stack">
          <Card title="Contribution per site" extra={<span className="small muted">country × site kind</span>}>
            <table className="heat">
              <thead>
                <tr>
                  <th />
                  {SITE_KINDS.map((t) => (
                    <th key={t} className="num" style={{ fontSize: 11 }}>
                      {t === 'Institution' ? 'Instit.' : t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map(({ c, cells }) => (
                  <tr key={c}>
                    <th className="rowh">{c}</th>
                    {cells.map((x, i) => (
                      <td
                        key={i}
                        className="cell"
                        title={x ? `${x.n} sites` : 'no sites'}
                        style={{
                          background: x ? `color-mix(in srgb, ${x.v >= 0 ? 'var(--ok)' : 'var(--danger)'} ${Math.round((Math.abs(x.v) / maxAbs) * 55) + 6}%, transparent)` : undefined,
                        }}
                      >
                        {x ? eurK(x.v) : <span className="muted">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="small muted" style={{ marginTop: 8 }}>
              <Placeholder>Contribution</Placeholder> = revenue − ad spend for now.
            </div>
          </Card>

          <Card title="Risk by launch cohort">
            <div className="stack" style={{ gap: 6 }}>
              {COHORTS.map((c) => {
                const rs = rows.filter((r) => r.s.launchCohort === c);
                if (!rs.length) return null;
                const h = rs.filter((r) => r.risk === 'High').length;
                const m = rs.filter((r) => r.risk === 'Medium').length;
                return (
                  <div key={c} className="row" style={{ flexWrap: 'nowrap' }}>
                    <span style={{ width: 62 }} className="small">
                      {c}
                    </span>
                    <span style={{ flex: 1 }}>
                      <RiskMix High={h} Medium={m} Low={rs.length - h - m} wide />
                    </span>
                    <span className="small muted" style={{ width: 70, textAlign: 'right' }}>
                      {pct(h / rs.length)} high
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {budgetFor && (
        <Modal
          title={`Test budget for ${budgetFor}`}
          onClose={() => setBudgetFor(null)}
          confirm="Start test"
          onConfirm={() => {
            toast(`Test budget of €${amount} set for ${budgetFor} (mockup: not saved)`);
            setBudgetFor(null);
          }}
        >
          <div>Extra budget is spread over the group's live sites for 21 days, then compared with the group's baseline.</div>
          <label>
            Total budget (EUR)
            <input type="number" min="50" step="50" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
        </Modal>
      )}
    </>
  );
}

function RiskMix({ High, Medium, Low, wide }: { High: number; Medium: number; Low: number; wide?: boolean }) {
  const t = High + Medium + Low || 1;
  return (
    <span title={`${High} high · ${Medium} medium · ${Low} low`} style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', width: wide ? '100%' : 90, background: 'var(--muted-soft)' }}>
      <i style={{ width: `${(High / t) * 100}%`, background: 'var(--danger)' }} />
      <i style={{ width: `${(Medium / t) * 100}%`, background: 'var(--warn)' }} />
      <i style={{ width: `${(Low / t) * 100}%`, background: 'var(--ok)', opacity: 0.6 }} />
    </span>
  );
}
