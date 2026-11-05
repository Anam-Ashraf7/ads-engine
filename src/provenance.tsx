// PROTOTYPE: event provenance shown where the numbers are. A freshness line for the data sources, a details
// popover behind every key number, and the per-site activity log. ?explain=<key> and ?source=<key> open one
// on load (for screenshots).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from './state';
import { dateOf, LAST_DAY, type Metrics, type Site } from './data/mock';
import { activityFor, ago, clock, health, lastGood, siteOfKey, SOURCES, sourceByKey, type Activity, type ActivityKind, type Source, type SourceKey } from './data/provenance';
import { eur, num, pct, shortDate } from './format';

// ---------- popover ----------
function Popover({ anchor, label, onClose, children }: { anchor: HTMLElement; label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect();
    const el = ref.current!;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let top = a.bottom + 6;
    if (top + h > innerHeight - 8 && a.top - h - 6 > 8) top = a.top - h - 6;
    setPos({ top: Math.max(8, top), left: Math.max(8, Math.min(a.left, innerWidth - w - 8)) });
    el.focus({ preventScroll: true });
  }, [anchor]);

  useEffect(() => {
    const inside = (t: EventTarget | null) => !!t && (ref.current?.contains(t as Node) || anchor.contains(t as Node));
    const down = (e: MouseEvent) => !inside(e.target) && onClose();
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
      anchor.focus();
    };
    const scroll = (e: Event) => !ref.current?.contains(e.target as Node) && onClose();
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchor, onClose]);

  return createPortal(
    // Clicks stay inside: the popover is often opened from a clickable table row.
    <div ref={ref} className="pop" role="dialog" aria-label={label} tabIndex={-1} style={pos ?? { top: 0, left: 0, visibility: 'hidden' }} onClick={(e) => e.stopPropagation()}>
      <button className="pop-x" aria-label="Close" onClick={onClose}>
        ×
      </button>
      {children}
    </div>,
    document.body,
  );
}

let autoOpened = false;
const param = (k: string) => {
  try {
    return new URLSearchParams(location.search).get(k);
  } catch {
    return null;
  }
};

// ---------- number details ----------
export interface Explain {
  key: string;
  title: string;
  what: ReactNode;
  sources: SourceKey[];
  origin?: string; // where it comes from when it isn't one of the API sources
  period?: string;
  formula?: { op?: '+' | '−' | '÷'; label: string; value: string }[];
  result?: { label: string; value: string };
  breakdown?: { label: string; value: string; share?: number }[];
  placeholder?: boolean;
  note?: string;
}

/** A number that opens "where does this come from". Wrap the value; the row underneath stays clickable. */
export function Num({ info, children }: { info: Explain; children: ReactNode }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!autoOpened && param('explain') === info.key) {
      autoOpened = true;
      setOpen(true);
    }
  }, [info.key]);
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="num-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Where this number comes from"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {children}
      </button>
      {open && btn.current && (
        <Popover anchor={btn.current} label={`${info.title}: where it comes from`} onClose={() => setOpen(false)}>
          <ExplainBody info={info} />
        </Popover>
      )}
    </>
  );
}

function ExplainBody({ info }: { info: Explain }) {
  const updated = info.sources.map((k) => sourceByKey.get(k)!);
  return (
    <div className="explain">
      <h3 className="pop-title">
        {info.title}
        {info.placeholder && <span className="pill t-warn">formula to be agreed</span>}
      </h3>
      <p className="pop-what">{info.what}</p>
      {info.formula && (
        <div className="formula" role="table" aria-label="How it is calculated">
          {info.formula.map((f) => (
            <div key={f.label} className="f-row" role="row">
              <span className="f-op">{f.op ?? ''}</span>
              <span>{f.label}</span>
              <span className="f-val">{f.value}</span>
            </div>
          ))}
          {info.result && (
            <div className="f-row f-total" role="row">
              <span className="f-op">=</span>
              <span>{info.result.label}</span>
              <span className="f-val">{info.result.value}</span>
            </div>
          )}
        </div>
      )}
      {info.breakdown && (
        <div className="breakdown">
          {info.breakdown.map((b) => (
            <div key={b.label} className="b-row">
              <span>{b.label}</span>
              {b.share !== undefined && (
                <span className="b-bar" aria-hidden>
                  <i style={{ width: `${Math.round(b.share * 100)}%` }} />
                </span>
              )}
              <span className="f-val">{b.value}</span>
            </div>
          ))}
        </div>
      )}
      <dl className="pop-facts">
        {info.period && (
          <>
            <dt>Period</dt>
            <dd>{info.period}</dd>
          </>
        )}
        <dt>Source</dt>
        <dd>
          {updated.map((s) => (
            <span key={s.key} className={`src h-${health(s)}`}>
              <i className="dot" />
              {s.name}
              <span className="muted"> · {health(s) === 'failed' ? `last sync failed, data from ${ago(lastGood(s).at)}` : `updated ${ago(lastGood(s).at)}`}</span>
            </span>
          ))}
          {info.origin && <span className="src">{info.origin}</span>}
        </dd>
      </dl>
      {info.note && <p className="pop-note">{info.note}</p>}
    </div>
  );
}

// ---------- the standard explanations ----------
export const periodOf = (range: number) => `${shortDate(dateOf(LAST_DAY, -(range - 1)))} – ${shortDate(LAST_DAY)} 2026 · ${range} days`;

type MetricKey = 'spend' | 'visits' | 'adsense' | 'sponsor' | 'contribution' | 'revenue';
/** Explanation for one of the site metrics, for a site or a set of sites ("of": "200 sites", "MedfordVoices"). */
export function explain(key: MetricKey, m: Metrics, range: number, of: string, deals?: number): Explain {
  const period = periodOf(range);
  switch (key) {
    case 'spend':
      return {
        key,
        title: 'Ad spend',
        what: <>What Google Ads and Meta charged for {of}, all campaigns, in euros.</>,
        sources: ['ads', 'meta'],
        period,
        breakdown: [
          { label: 'Google Ads', value: eur(m.spend - m.metaSpend) },
          { label: 'Meta', value: eur(m.metaSpend) },
          { label: 'Clicks, both platforms', value: num(m.clicks) },
          { label: 'Average cost per click', value: m.clicks ? eur(m.spend / m.clicks, 2) : '—' },
          { label: 'Google Ads conversions', value: num(m.conversions) },
        ],
        note: 'Google can revise the last 3 days, and Meta the last couple of days, as late reports come in.',
      };
    case 'visits': {
      const parts: [string, number][] = [
        ['Organic search', m.organic],
        ['Google Ads', m.paid],
        ['Meta ads', m.metaPaid],
        ['Direct', m.direct],
        ['Referral', m.referral],
        ['Social', m.social],
      ];
      return {
        key,
        title: 'Qualified visits',
        what: <>Visits to {of} that count as real interest: engaged sessions in Google Analytics (stayed 10 s or more, viewed 2+ pages, or did a key event). Our own definition is still to be agreed.</>,
        sources: ['ga4'],
        period,
        breakdown: parts.map(([label, v]) => ({ label, value: num(v), share: m.visits ? v / m.visits : 0 })),
      };
    }
    case 'adsense':
      return {
        key,
        title: 'AdSense revenue',
        what: <>What Google AdSense says {of} earned from ads shown on the pages. AdSense calls this “estimated earnings” until it finalises the month.</>,
        sources: ['adsense'],
        period,
        breakdown: [
          { label: 'Page views', value: num(m.pageViews) },
          { label: 'Earnings per 1,000 views', value: m.pageViews ? eur((m.adsense / m.pageViews) * 1000, 2) : '—' },
        ],
      };
    case 'sponsor':
      return {
        key,
        title: 'Sponsor revenue',
        what: <>Fees from signed sponsor deals on {of}, counted per day the deal runs (a €300/month deal adds about €10 a day).</>,
        sources: ['invoicing'],
        period,
        breakdown: deals !== undefined ? [{ label: 'Deals running in the period', value: num(deals) }] : undefined,
        note: 'Counts what the contracts say, not what has been paid. Unpaid invoices show on the Sponsors page.',
      };
    case 'revenue':
      return {
        key,
        title: 'Sponsors + AdSense',
        what: <>Everything {of} earned in the period.</>,
        sources: ['invoicing', 'adsense'],
        period,
        formula: [
          { label: 'Sponsor revenue', value: eur(m.sponsor) },
          { op: '+', label: 'AdSense revenue', value: eur(m.adsense) },
        ],
        result: { label: 'Revenue', value: eur(m.revenue) },
      };
    case 'contribution':
      return {
        key,
        title: 'Contribution',
        what: <>What {of} made after paying for ads. For now this is simply revenue minus ad spend.</>,
        sources: ['invoicing', 'adsense', 'ads', 'meta'],
        period,
        placeholder: true,
        formula: [
          { label: 'Sponsor revenue', value: eur(m.sponsor) },
          { op: '+', label: 'AdSense revenue', value: eur(m.adsense) },
          { op: '−', label: 'Ad spend', value: eur(m.spend) },
        ],
        result: { label: 'Contribution', value: eur(m.contribution) },
        note: 'Not included yet: content, hosting, sales time and other costs. The agreed formula will replace this.',
      };
  }
}

export const explainCap = (mtd: number, cap: number, days: number): Explain => ({
  key: 'cap',
  title: 'Cap used',
  what: 'How much of this month’s approved ad budget is already spent, on both platforms. Near the cap we lower Google budgets and warn about Meta; both pause at the cap.',
  sources: ['ads', 'meta'],
  period: `1 – ${shortDate(LAST_DAY)} 2026 · ${days} days`,
  formula: [
    { label: 'Spend this month', value: eur(mtd) },
    { op: '÷', label: 'Monthly cap', value: eur(cap) },
  ],
  result: { label: 'Cap used', value: cap ? pct(mtd / cap) : '—' },
  origin: 'Cap: set by a person in Ads engine',
});

// ---------- freshness line ----------
const RANK: Record<string, number> = { failed: 0, late: 1, ok: 2 };

export function Freshness() {
  const [open, setOpen] = useState<{ s: Source; el: HTMLElement } | null>(null);
  const refs = useRef(new Map<SourceKey, HTMLButtonElement>());
  useEffect(() => {
    const k = param('source') as SourceKey | null;
    const el = k && refs.current.get(k);
    if (el) setOpen({ s: sourceByKey.get(k)!, el });
  }, []);
  return (
    <div className="fresh" aria-label="How fresh the data is">
      <span className="fresh-lbl">Sources</span>
      {/* problems first, so a failed sync is never scrolled off a phone screen */}
      {[...SOURCES].sort((a, b) => RANK[health(a)] - RANK[health(b)]).map((s) => {
        const h = health(s);
        return (
          <button
            key={s.key}
            ref={(el) => {
              if (el) refs.current.set(s.key, el);
            }}
            className={`fresh-src h-${h}`}
            aria-haspopup="dialog"
            aria-expanded={open?.s.key === s.key}
            onClick={(e) => setOpen(open?.s.key === s.key ? null : { s, el: e.currentTarget })}
          >
            <i className="dot" />
            {s.short}
            <span className="fresh-age">{h === 'failed' ? 'sync failed' : ago(lastGood(s).at)}</span>
          </button>
        );
      })}
      <span className="fresh-hint">Underlined numbers show where they come from</span>
      {open && (
        <Popover anchor={open.el} label={`${open.s.name}: recent syncs`} onClose={() => setOpen(null)}>
          <SourceBody s={open.s} />
        </Popover>
      )}
    </div>
  );
}

function SourceBody({ s }: { s: Source }) {
  const h = health(s);
  const good = lastGood(s);
  return (
    <div className="explain">
      <h3 className="pop-title">
        {s.name}
        <span className={`pill ${h === 'ok' ? 't-ok' : h === 'late' ? 't-warn' : 't-danger'}`}>{h === 'ok' ? 'Up to date' : h === 'late' ? 'Late' : 'Last sync failed'}</span>
      </h3>
      <p className="pop-what">
        {s.provides}. Latest data from {clock(good.at)} ({ago(good.at)}).
      </p>
      <table className="syncs">
        <thead>
          <tr>
            <th>Sync</th>
            <th className="num">Rows</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {s.syncs.map((x) => (
            <tr key={x.at}>
              <td className="nowrap">{clock(x.at)}</td>
              <td className="num">{x.ok && x.rows ? num(x.rows) : '—'}</td>
              <td className={!x.ok ? 'bad' : ''}>
                {!x.ok ? 'Failed' : x.rows ? 'OK' : 'Nothing new'}
                {x.error && <span className="sub">{x.error}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pop-note">
        Fetched {s.every}; counts as late after {s.lateAfterH} hours. Times and delays are sample values.
      </p>
    </div>
  );
}

// ---------- activity log ----------
const KINDS: ActivityKind[] = ['Data', 'People', 'System'];

export function ActivityLog({ s }: { s: Site }) {
  const { changes } = useApp();
  const [kind, setKind] = useState<ActivityKind | ''>('');
  const [all, setAll] = useState(false);
  const [base] = useState(() => activityFor(s));
  const mine: Activity[] = changes
    .filter((c) => siteOfKey(c.key) === s.id)
    .map((c) => ({ id: `now-${c.at}`, at: 'now', kind: 'People', who: 'You', text: c.text, tone: 'good' }));
  const items = [...mine, ...base].filter((a) => !kind || a.kind === kind);
  const shown = all ? items : items.slice(0, 9);
  const count = (k: ActivityKind) => mine.filter((a) => a.kind === k).length + base.filter((a) => a.kind === k).length;

  return (
    <section className="card flush">
      <header className="card-head">
        <h2 style={{ flex: 'none' }}>Activity</h2>
        <span className="small muted">imports, people and system suggestions on this site</span>
        <span className="spacer" />
        <div className="seg" role="group" aria-label="Show">
          <button className={!kind ? 'on' : ''} aria-pressed={!kind} onClick={() => setKind('')}>
            All
          </button>
          {KINDS.map((k) => (
            <button key={k} className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k} <span className="muted">{count(k)}</span>
            </button>
          ))}
        </div>
      </header>
      <ol className="log">
        {shown.map((a) => (
          <li key={a.id} className={`log-row k-${a.kind}${a.tone ? ` tone-${a.tone}` : ''}`}>
            <span className="log-time">{a.at === 'now' ? 'just now' : clock(a.at)}</span>
            <span className="log-kind">
              <i className="dot" />
              {a.kind}
            </span>
            <span className="log-main">
              <span className="log-text">{a.text}</span>
              {a.detail && <span className="log-detail">{a.detail}</span>}
            </span>
            <span className="log-who">{a.who}</span>
          </li>
        ))}
        {!shown.length && <li className="log-row muted">Nothing of this kind yet.</li>}
      </ol>
      {items.length > 9 && (
        <div className="table-foot">
          Showing {shown.length} of {items.length}
          <span className="spacer" />
          <button className="btn sm" onClick={() => setAll(!all)}>
            {all ? 'Show fewer' : 'Show all'}
          </button>
        </div>
      )}
    </section>
  );
}
