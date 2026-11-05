// PROTOTYPE: shared bits used by every screen.
import { useState, type ReactNode } from 'react';
import { Icon } from './icons';
import { Num, type Explain } from './provenance';
import { useApp, type Action } from './state';
import type { Risk, SiteState } from './data/mock';

export function Card({ title, extra, children, flush, className = '' }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; flush?: boolean; className?: string }) {
  return (
    <section className={`card${flush ? ' flush' : ''} ${className}`}>
      {(title || extra) && (
        <header className="card-head">
          <h2>{title}</h2>
          {extra}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub, change, goodWhenUp = true, hint, info }: { label: ReactNode; value: ReactNode; sub?: ReactNode; change?: string; goodWhenUp?: boolean; hint?: string; info?: Explain }) {
  const up = change?.startsWith('+');
  const down = change?.startsWith('−');
  const tone = !change || (!up && !down) ? '' : up === goodWhenUp ? 'good' : 'bad';
  return (
    <div className="kpi" title={hint}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{info ? <Num info={info}>{value}</Num> : value}</div>
      <div className="kpi-sub">
        {change && <span className={`chg ${tone}`}>{change}</span>} {sub}
      </div>
    </div>
  );
}

const STATE_TONE: Record<SiteState, string> = { Live: 'ok', Paused: 'warn', Building: 'info', Retired: 'muted' };
export const StatePill = ({ state }: { state: SiteState }) => (
  <span className={`pill t-${STATE_TONE[state]}`}>
    <i className={`state-sw st-${state}`} aria-hidden />
    {state}
  </span>
);

const RISK_TONE: Record<Risk, string> = { Low: 'ok', Medium: 'warn', High: 'danger' };
export const RiskPill = ({ risk }: { risk: Risk }) => (
  <span className={`risk t-${RISK_TONE[risk]}`}>
    <i />
    {risk}
  </span>
);

export const Pill = ({ tone = 'muted', children }: { tone?: string; children: ReactNode }) => <span className={`pill t-${tone}`}>{children}</span>;

/** A button that is disabled (with a reason) when the current role isn't allowed to do it. */
export function Act({ action, onClick, children, kind = '', title }: { action: Action; onClick: () => void; children: ReactNode; kind?: string; title?: string }) {
  const { can, needs, globalPause } = useApp();
  const ok = can(action);
  const blocked = globalPause && action !== 'globalPause' && action !== 'salesTask' && action !== 'assignOwner';
  return (
    <button className={`btn ${kind}`} disabled={!ok || blocked} title={!ok ? needs(action) : blocked ? 'Global pause is on' : title} onClick={onClick}>
      {!ok && Icon.lock()}
      {children}
    </button>
  );
}

export function Modal({ title, children, onClose, onConfirm, confirm = 'Confirm', danger, confirmDisabled }: { title: string; children: ReactNode; onClose: () => void; onConfirm?: () => void; confirm?: string; danger?: boolean; confirmDisabled?: boolean }) {
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <div className="modal-body">{children}</div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          {onConfirm && (
            <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} disabled={confirmDisabled}>
              {confirm}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Select<T extends string>({ label, value, options, onChange, all = 'All' }: { label: string; value: T | ''; options: readonly T[]; onChange: (v: T | '') => void; all?: string }) {
  return (
    <label className={`filter${value ? ' set' : ''}`}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T | '')}>
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} className={`tab${value === t.key ? ' on' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export type Sort<K extends string> = { key: K; dir: 1 | -1 };
export function useSort<K extends string>(initial: K, dir: 1 | -1 = -1) {
  const [sort, setSort] = useState<Sort<K>>({ key: initial, dir });
  const th = (key: K, label: ReactNode, cls = 'num') => (
    <th className={`sortable ${cls}`} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      {label}
      <span className="arrow">{sort.key === key ? (sort.dir === 1 ? Icon.chevronUp() : Icon.chevronDown(12)) : null}</span>
    </th>
  );
  return { sort, th };
}

/** Small letters on a site's row: which ad platforms are running there. */
export function AdMarks({ google, meta }: { google: boolean; meta: boolean }) {
  const label = google && meta ? 'Google Ads and Meta running' : google ? 'Google Ads running' : meta ? 'Meta running' : 'No ads running';
  return (
    <span className="ad-marks" title={label} role="img" aria-label={label}>
      {google && <i>G</i>}
      {meta && <i className="m">M</i>}
      {!google && !meta && <i className="none">No ads</i>}
    </span>
  );
}

/** Marks a number whose formula isn't agreed yet. */
export const Placeholder = ({ children }: { children: ReactNode }) => (
  <span className="placeholder" title="Placeholder: revenue minus ad spend. The real contribution formula is not agreed yet.">
    {children}
  </span>
);
