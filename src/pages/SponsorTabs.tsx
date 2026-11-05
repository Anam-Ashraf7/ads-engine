// PROTOTYPE: sponsor tabs for placement delivery, lead evidence and inventory (with spot holds).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state';
import { Meter } from '../charts';
import { dateOf, deals, deliveries, holds, kindLine, leads, siteById, sites, SPOT_KINDS, TODAY, type Deal, type Delivery, type Hold, type LeadEvidence, type SpotKind } from '../data/mock';
import { compact, delta, eur, num, pct, shortDate } from '../format';
import { Num, type Explain } from '../provenance';
import { Act, Card, Modal, Pill, Select, useSort } from '../ui';

const LIVE = (d: Deal) => d.stage === 'Active' || d.stage === 'Up for renewal';
const MONTH = 'October';
const holdKey = (siteId: string, spot: string) => `hold:${siteId}:${spot}`;
type SpotCell = { kind: 'sold'; deal: Deal } | { kind: 'held'; hold: Hold; expired: boolean } | { kind: 'free' } | { kind: 'none' };

/** What each spot on a site is right now: sold (live or signed deal), held for a sponsor, or free. */
function useSpotCells() {
  const { overrides } = useApp();
  return (siteId: string, spot: SpotKind): SpotCell => {
    const site = siteById.get(siteId)!;
    if (!site.spots.includes(spot)) return { kind: 'none' };
    const deal = deals.find((d) => d.siteId === siteId && d.spot === spot && (LIVE(d) || d.stage === 'Signed'));
    if (deal) return { kind: 'sold', deal };
    const o = overrides[holdKey(siteId, spot)];
    if (o === 'released') return { kind: 'free' };
    if (o) return { kind: 'held', hold: JSON.parse(o) as Hold, expired: false };
    const h = holds.find((x) => x.siteId === siteId && x.spot === spot);
    if (h) return { kind: 'held', hold: h, expired: h.until < TODAY };
    return { kind: 'free' };
  };
}
const isOpen = (c: SpotCell) => c.kind === 'free' || (c.kind === 'held' && c.expired);

export function Inventory({ siteIds }: { siteIds: Set<string> }) {
  const { override } = useApp();
  const cellOf = useSpotCells();
  const [onlyFree, setOnlyFree] = useState(true);
  const [reserve, setReserve] = useState<{ siteId: string; spot: SpotKind | '' } | null>(null);
  const scopedSites = sites.filter((s) => siteIds.has(s.id));
  const rows = SPOT_KINDS.map((k) => {
    const cells = scopedSites.map((s) => cellOf(s.id, k)).filter((c) => c.kind !== 'none');
    const fees = cells.flatMap((c) => (c.kind === 'sold' ? [c.deal.fee] : []));
    return {
      k,
      total: cells.length,
      sold: fees.length,
      held: cells.filter((c) => c.kind === 'held' && !c.expired).length,
      free: cells.filter(isOpen).length,
      avg: fees.length ? fees.reduce((x, y) => x + y, 0) / fees.length : 0,
    };
  });
  const siteRows = scopedSites.filter((s) => !onlyFree || SPOT_KINDS.some((k) => isOpen(cellOf(s.id, k))));
  return (
    <div className="stack">
      <Card flush title="Inventory by spot" extra={<span className="small muted">sold, held for a sponsor, or free to sell</span>}>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead>
              <tr>
                <th>Spot</th>
                <th className="num">On sites</th>
                <th className="num">Sold</th>
                <th className="num">Held</th>
                <th className="num">Free</th>
                <th style={{ width: '30%' }}>Fill</th>
                <th className="num">Avg fee / month</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.k}>
                  <td className="site-name">{r.k}</td>
                  <td className="num">{num(r.total)}</td>
                  <td className="num">{r.sold}</td>
                  <td className="num">{r.held}</td>
                  <td className="num">
                    <b>{r.free}</b>
                  </td>
                  <td>
                    <span className="fill-bar">
                      <i style={{ width: `${(r.sold / Math.max(1, r.total)) * 100}%`, background: 'var(--ok)' }} />
                      <i style={{ width: `${(r.held / Math.max(1, r.total)) * 100}%`, background: 'var(--warn)' }} />
                    </span>
                  </td>
                  <td className="num">{r.avg ? eur(r.avg) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-foot">Green = sold, amber = held for a sponsor, grey = free.</div>
      </Card>

      <Card
        flush
        title={`Spots per site (${siteRows.length})`}
        extra={
          <div className="row">
            <label className="small row" style={{ gap: 6 }}>
              <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />
              Only sites with a free spot
            </label>
            <Act action="reserveSpot" kind="sm" onClick={() => setReserve({ siteId: '', spot: '' })}>
              Reserve spot
            </Act>
          </div>
        }
      >
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="spot-grid">
            <thead>
              <tr>
                <th>Site</th>
                {SPOT_KINDS.map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {siteRows.slice(0, 60).map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/sites/${s.id}`} className="site-name one-line" title={s.name}>
                      {s.name}
                    </Link>
                    <span className="sub">
                      {s.country} · {kindLine(s)}
                    </span>
                  </td>
                  {SPOT_KINDS.map((k) => {
                    const c = cellOf(s.id, k);
                    return (
                      <td key={k}>
                        {c.kind === 'none' && <span className="muted">—</span>}
                        {c.kind === 'sold' && (
                          <span className="spot-cell">
                            <Pill tone="ok">{c.deal.stage === 'Signed' ? 'Sold · starts soon' : 'Sold'}</Pill>
                            <span className="sub one-line" title={c.deal.sponsor}>
                              {c.deal.sponsor}
                            </span>
                          </span>
                        )}
                        {c.kind === 'held' && (
                          <span className="spot-cell">
                            <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                              <Pill tone={c.expired ? 'muted' : 'warn'}>{c.expired ? `Hold ended ${shortDate(c.hold.until)}` : `Held to ${shortDate(c.hold.until)}`}</Pill>
                              {c.expired ? (
                                <Act action="reserveSpot" kind="sm" onClick={() => setReserve({ siteId: s.id, spot: k })}>
                                  Reserve
                                </Act>
                              ) : (
                                <Act action="reserveSpot" kind="sm ghost" onClick={() => override(holdKey(s.id, k), 'released', `Hold on ${k} at ${s.name} released (mockup)`)}>
                                  Release
                                </Act>
                              )}
                            </span>
                            <span className="sub one-line" title={c.hold.sponsor}>
                              {c.hold.sponsor} · {c.hold.by}
                            </span>
                          </span>
                        )}
                        {c.kind === 'free' && (
                          <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                            <span className="muted small">Free</span>
                            <Act action="reserveSpot" kind="sm" onClick={() => setReserve({ siteId: s.id, spot: k })}>
                              Reserve
                            </Act>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          {siteRows.length > 60 ? `Showing 60 of ${siteRows.length} sites` : `${siteRows.length} sites`} · a hold keeps a spot off the market until its date, then it is free again
        </div>
      </Card>
      {reserve && <ReserveModal initial={reserve} siteIds={siteIds} cellOf={cellOf} onClose={() => setReserve(null)} />}
    </div>
  );
}

function ReserveModal({ initial, siteIds, cellOf, onClose }: { initial: { siteId: string; spot: SpotKind | '' }; siteIds: Set<string>; cellOf: ReturnType<typeof useSpotCells>; onClose: () => void }) {
  const { override, toast } = useApp();
  const [siteId, setSiteId] = useState(initial.siteId);
  const [spot, setSpot] = useState<SpotKind | ''>(initial.spot);
  const [sponsor, setSponsor] = useState('');
  const [until, setUntil] = useState(dateOf(TODAY, 14));
  const choices = sites.filter((s) => siteIds.has(s.id) && SPOT_KINDS.some((k) => isOpen(cellOf(s.id, k))));
  const spots = siteId ? SPOT_KINDS.filter((k) => isOpen(cellOf(siteId, k))) : [];
  const prospects = [...new Set(deals.filter((d) => !LIVE(d) && d.stage !== 'Signed').map((d) => d.sponsor))].sort();
  const ready = siteId && spot && sponsor.trim() && until > TODAY;
  return (
    <Modal
      title="Reserve a spot"
      confirm="Hold spot"
      onClose={onClose}
      onConfirm={() => {
        if (!ready) return toast('Pick a site, a free spot, a sponsor and a future date');
        const name = sponsor.trim();
        override(holdKey(siteId, spot), JSON.stringify({ siteId, spot, sponsor: name, until, by: 'You' }), `${spot} on ${siteById.get(siteId)!.name} held for ${name} until ${shortDate(until)} (mockup)`);
        onClose();
      }}
    >
      <span>A hold takes the spot off the market so nobody sells it twice. It ends by itself on the date you pick.</span>
      <label>
        Site
        <select value={siteId} onChange={(e) => (setSiteId(e.target.value), setSpot(''))}>
          <option value="">Pick a site with a free spot</option>
          {choices.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.country}
            </option>
          ))}
        </select>
      </label>
      <label>
        Spot
        <select value={spot} onChange={(e) => setSpot(e.target.value as SpotKind)} disabled={!siteId}>
          <option value="">{siteId ? 'Pick a free spot' : 'Pick a site first'}</option>
          {spots.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <label>
        Sponsor
        <input list="prospects" value={sponsor} onChange={(e) => setSponsor(e.target.value)} placeholder="Sponsor in the funnel, or a new name" />
        <datalist id="prospects">
          {prospects.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      </label>
      <label>
        Hold until
        <input type="date" value={until} min={dateOf(TODAY, 1)} onChange={(e) => setUntil(e.target.value)} />
      </label>
    </Modal>
  );
}

const ORDER = ['Under-delivered', 'Not checked', 'Delivered'] as const;
const DELIVERY_TONE = { Delivered: 'ok', 'Under-delivered': 'danger', 'Not checked': 'warn' } as const;

export function DeliveryTab({ list }: { list: Deal[] }) {
  const { overrides, override } = useApp();
  const [status, setStatus] = useState<(typeof ORDER)[number] | ''>('');
  const rows = list
    .map((d) => {
      const x = deliveries.get(d.id)!;
      if (!overrides[`proof:${d.id}`]) return { d, x };
      // A proof saved in this session: checked today, judged on the same 95% line.
      return { d, x: { ...x, lastCheck: TODAY, proof: x.proof ?? ('Screenshot' as const), status: x.delivered / Math.max(1, x.promised) < 0.95 ? ('Under-delivered' as const) : ('Delivered' as const) } };
    })
    .filter((r) => !status || r.x.status === status)
    .sort((a, b) => ORDER.indexOf(a.x.status) - ORDER.indexOf(b.x.status) || a.x.delivered / Math.max(1, a.x.promised) - b.x.delivered / Math.max(1, b.x.promised));
  return (
    <Card flush title="Placement delivery" extra={<Select label="Status" value={status} options={ORDER} onChange={setStatus} />}>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>Sponsor</th>
              <th>Site · spot</th>
              <th>Days running</th>
              <th>Delivered vs promised</th>
              <th>Proof</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 120).map(({ d, x }) => {
              const s = siteById.get(d.siteId)!;
              const share = x.delivered / Math.max(1, x.promised);
              return (
                <tr key={d.id}>
                  <td>
                    <span className="site-name one-line" title={d.sponsor}>
                      {d.sponsor}
                    </span>
                    <span className="sub">{eur(d.fee)}/month · {MONTH} to date</span>
                  </td>
                  <td>
                    <Link to={`/sites/${s.id}`} className="one-line" title={s.name}>
                      {s.name}
                    </Link>
                    <span className="sub">{d.spot}</span>
                  </td>
                  <td className="nowrap">
                    <span className={x.daysLive < x.daysBooked ? 'bad' : ''}>
                      {x.daysLive} of {x.daysBooked}
                    </span>
                    {x.daysLive < x.daysBooked && <span className="sub">{x.daysBooked - x.daysLive} days off</span>}
                  </td>
                  <td style={{ minWidth: 180 }}>
                    <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                      <span className="meter-w">
                        {/* the bar stays quiet; it only turns red for a serious shortfall, the % carries the rest */}
                        <Meter value={share} max={1} tone={share < 0.8 ? 'danger' : 'muted'} />
                      </span>
                      <span className={`small nowrap ${share < 0.95 ? 'bad' : ''}`}>
                        <Num info={deliveryInfo(d, x)}>{pct(share)}</Num>
                      </span>
                    </span>
                    <span className="sub">
                      {compact(x.delivered)} of {compact(x.promised)} {x.unit}
                    </span>
                  </td>
                  <td className="small">
                    {x.proof ? (
                      <>
                        {x.proof}
                        <span className="sub">checked {x.lastCheck === TODAY ? 'today' : shortDate(x.lastCheck!)}</span>
                      </>
                    ) : (
                      <span className="muted">No proof yet</span>
                    )}
                  </td>
                  <td>
                    {x.status === 'Not checked' ? <Pill tone={DELIVERY_TONE[x.status]}>{x.status}</Pill> : <span className={`small ${x.status === 'Delivered' ? 'muted' : 'bad'}`}>{x.status}</span>}
                  </td>
                  <td className="nowrap">
                    {x.status === 'Not checked' ? (
                      <Act action="reserveSpot" kind="sm" onClick={() => override(`proof:${d.id}`, '1', `Proof saved for ${d.sponsor} (mockup: screenshot of the live placement)`)}>
                        Save proof
                      </Act>
                    ) : x.status === 'Under-delivered' ? (
                      <Act action="salesTask" kind="sm" onClick={() => override(`make-good:${d.id}`, '1', `Make-good task created for ${d.sponsor}: extend by ${Math.max(1, x.daysBooked - x.daysLive)} days (mockup)`)}>
                        {overrides[`make-good:${d.id}`] ? 'Task created' : 'Plan make-good'}
                      </Act>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-foot">{rows.length > 120 ? `Showing 120 of ${rows.length}` : `${rows.length} live placements`} · under 95% of what was promised counts as under-delivered</div>
    </Card>
  );
}

export function LeadsTab({ list }: { list: Deal[] }) {
  const { overrides, override, can, needs } = useApp();
  const { sort, th } = useSort<'leads' | 'clicks' | 'cost'>('leads');
  const rows = list.map((d) => {
    const l = leads.get(d.id)!;
    const total = l.calls + l.forms;
    return { d, l, total, prevTotal: l.prev.calls + l.prev.forms, cost: total ? d.fee / total : Infinity };
  });
  const v = (r: (typeof rows)[number]) => (sort.key === 'leads' ? r.total : sort.key === 'clicks' ? r.l.clicks : -r.cost);
  const sorted = [...rows].sort((a, b) => (v(a) - v(b)) * sort.dir);
  return (
    <Card flush title="Lead evidence" extra={<span className="small muted">{MONTH} to date · what we sent each sponsor, so renewals are argued with numbers</span>}>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>Sponsor</th>
              <th>Site · spot</th>
              {th('clicks', 'Clicks to sponsor')}
              <th className="num">Calls</th>
              <th className="num">Forms</th>
              {th('leads', 'Leads vs Sept.')}
              {th('cost', 'Fee per lead')}
              <th>Tracked by</th>
              <th>Last report</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 120).map(({ d, l, total, prevTotal, cost }) => {
              const s = siteById.get(d.siteId)!;
              const sent = overrides[`report:${d.id}`] ? TODAY : l.lastReport;
              return (
                <tr key={d.id}>
                  <td>
                    <span className="site-name one-line" title={d.sponsor}>
                      {d.sponsor}
                    </span>
                    <span className="sub">{d.stage === 'Up for renewal' ? 'up for renewal' : `${eur(d.fee)}/month`}</span>
                  </td>
                  <td>
                    <Link to={`/sites/${s.id}`} className="one-line" title={s.name}>
                      {s.name}
                    </Link>
                    <span className="sub">{d.spot}</span>
                  </td>
                  <td className="num">{num(l.clicks)}</td>
                  <td className="num">{l.calls || <span className="muted">—</span>}</td>
                  <td className="num">{l.forms}</td>
                  <td className="num">
                    <b>
                      <Num info={leadInfo(d, l, total, prevTotal, cost)}>{total}</Num>
                    </b>
                    <span className={`sub ${total >= prevTotal ? 'good' : 'bad'}`}>{prevTotal ? delta(total, prevTotal) : 'new'}</span>
                  </td>
                  <td className="num">{Number.isFinite(cost) ? <Num info={leadInfo(d, l, total, prevTotal, cost)}>{eur(cost, 2)}</Num> : <span className="bad">no leads</span>}</td>
                  <td className="small">{l.source}</td>
                  <td className="small nowrap">{sent ? (sent === TODAY ? 'today' : shortDate(sent)) : <span className="muted">never</span>}</td>
                  <td className="nowrap">
                    <button
                      className="btn sm"
                      disabled={!can('reserveSpot') || sent === TODAY}
                      title={can('reserveSpot') ? undefined : needs('reserveSpot')}
                      onClick={() => override(`report:${d.id}`, '1', `Lead report sent to ${d.sponsor}: ${total} leads, ${num(l.clicks)} clicks (mockup: no email sent)`)}
                    >
                      {sent === TODAY ? 'Sent' : 'Send lead report'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-foot">Leads = calls to the sponsor's tracking number + enquiry forms passed on. Clicks come from the sponsor's tracked link.</div>
    </Card>
  );
}

type DeliveryRow = Delivery;
type LeadRow = LeadEvidence;
const PROOF_ORIGIN: Record<string, string> = {
  impressions: 'Our ad server log of the banner being shown',
  sends: 'The newsletter tool’s send report',
  'days listed': 'Daily check that the listing is live on the page',
};

function deliveryInfo(d: Deal, x: DeliveryRow): Explain {
  return {
    key: 'delivery',
    title: 'Delivered vs promised',
    what: `How much of what we promised ${d.sponsor} has actually run on the site in ${MONTH}, so far.`,
    sources: [],
    origin: PROOF_ORIGIN[x.unit],
    period: `1 – 21 ${MONTH} 2026`,
    formula: [
      { label: `Delivered ${x.unit}`, value: num(x.delivered) },
      { op: '÷', label: `Promised to date`, value: num(x.promised) },
    ],
    result: { label: 'Delivered', value: pct(x.delivered / Math.max(1, x.promised)) },
    breakdown: [
      { label: 'Days running', value: `${x.daysLive} of ${x.daysBooked}` },
      { label: 'Last proof check', value: x.lastCheck ? shortDate(x.lastCheck) : 'none yet' },
    ],
    note: 'Below 95% counts as under-delivered and should get a make-good.',
  };
}

function leadInfo(d: Deal, l: LeadRow, total: number, prevTotal: number, cost: number): Explain {
  return {
    key: 'lead-row',
    title: 'Leads to the sponsor',
    what: `Customers we sent ${d.sponsor} in ${MONTH}: people who called or sent an enquiry through our tracked number and forms. Clicks are shown but not counted as leads.`,
    sources: [],
    origin: l.source,
    period: `1 – 21 ${MONTH} 2026`,
    formula: [
      { label: 'Calls', value: num(l.calls) },
      { op: '+', label: 'Forms', value: num(l.forms) },
    ],
    result: { label: 'Leads', value: num(total) },
    breakdown: [
      { label: 'Clicks to their site', value: num(l.clicks) },
      { label: 'Leads in September', value: num(prevTotal) },
      { label: 'Fee per lead', value: Number.isFinite(cost) ? `${eur(d.fee)} ÷ ${total} = ${eur(cost, 2)}` : 'no leads yet' },
    ],
  };
}
