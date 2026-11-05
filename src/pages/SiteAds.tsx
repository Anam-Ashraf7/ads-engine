// PROTOTYPE: which ad platforms a site runs on, shown on the site page. No button calls an ad platform.
import { useState } from 'react';
import { Meter } from '../charts';
import { adsOnSite, metaLimitOf, type PlatformKey } from '../data/meta';
import { siteMetrics, type Site, type SiteState } from '../data/mock';
import { eur, pct } from '../format';
import { useApp } from '../state';
import { Act, Card, Modal, Pill } from '../ui';

const NAME: Record<PlatformKey, string> = { google: 'Google Ads', meta: 'Meta' };

function runningText(running: number, total: number) {
  if (!total) return 'not used';
  if (!running) return 'paused';
  return `${running} of ${total} running`;
}

/** The answer to "where are this site's ads running?", right under its name. */
export function AdsOnLine({ s, state }: { s: Site; state: SiteState }) {
  const { overrides, globalPause } = useApp();
  const ads = adsOnSite(s.id, state, overrides, globalPause);
  const pill = (key: PlatformKey) => {
    const p = ads[key];
    return (
      <Pill tone={p.running ? 'ok' : 'muted'}>
        {NAME[key]} · {runningText(p.running, p.total)}
      </Pill>
    );
  };
  return (
    <div className="ads-on">
      <span className="small muted">Ads on</span>
      <b>{ads.label}</b>
      {pill('google')}
      {pill('meta')}
    </div>
  );
}

/** One row per platform: what it's spending, its share of the site's cap, and a pause for that platform alone. */
export function AdPlatformsCard({ s, state, cap }: { s: Site; state: SiteState; cap: number }) {
  const { overrides, override, globalPause, range } = useApp();
  const [pausing, setPausing] = useState<PlatformKey | null>(null);
  const ads = adsOnSite(s.id, state, overrides, globalPause);
  const m = siteMetrics(s, range);
  const metaLimit = metaLimitOf(s.id, overrides);
  const metaMonth = s.days.filter((d) => d.date >= '2026-10-01').reduce((n, d) => n + d.metaSpend, 0);
  const allMonth = s.days.filter((d) => d.date >= '2026-10-01').reduce((n, d) => n + d.spend, 0);
  const rows: { key: PlatformKey; spend: number; month: number; limit: number }[] = [
    { key: 'google', spend: m.spend - m.metaSpend, month: allMonth - metaMonth, limit: Math.max(0, cap - metaLimit) },
    { key: 'meta', spend: m.metaSpend, month: metaMonth, limit: metaLimit },
  ];
  return (
    <Card flush title="Ad platforms" extra={<span className="small muted">one site cap of {eur(cap)}, split below</span>}>
      <div className="list">
        {rows.map(({ key, spend, month, limit }) => {
          const p = ads[key];
          const held = overrides[`plat:${s.id}:${key}`] === 'Paused';
          return (
            <div className="item platform-row" key={key}>
              <div className="item-main">
                <div className="platform-name">
                  <b>{NAME[key]}</b>
                  <Pill tone={p.running ? 'ok' : 'muted'}>{runningText(p.running, p.total)}</Pill>
                </div>
                {p.total > 0 ? (
                  <>
                    <div className="platform-meter">
                      <Meter value={month} max={Math.max(1, limit)} tone={limit && month / limit >= 0.8 ? 'warn' : 'ok'} />
                      <span className="small">
                        {eur(month)} of {eur(limit)} this month{limit ? ` · ${pct(month / limit)}` : ''}
                      </span>
                    </div>
                    <div className="item-meta">{eur(spend)} in the last {range} days</div>
                  </>
                ) : (
                  <div className="item-meta">This site has no {NAME[key]} campaigns.</div>
                )}
              </div>
              {p.total > 0 && state === 'Live' && (
                held ? (
                  <Act action="siteState" kind="sm" onClick={() => override(`plat:${s.id}:${key}`, 'Running', `${NAME[key]} restarted on ${s.name} (mockup: no ad platform call)`)}>
                    Restart
                  </Act>
                ) : (
                  <Act action="siteState" kind="sm" onClick={() => setPausing(key)}>
                    Pause
                  </Act>
                )
              )}
            </div>
          );
        })}
      </div>
      {pausing && (
        <Modal
          title={`Pause ${NAME[pausing]} on ${s.name}?`}
          confirm={`Pause ${NAME[pausing]}`}
          onClose={() => setPausing(null)}
          onConfirm={() => {
            override(`plat:${s.id}:${pausing}`, 'Paused', `${NAME[pausing]} paused on ${s.name} (mockup: no ad platform call)`);
            setPausing(null);
          }}
        >
          {NAME[pausing]} stops on this site. {ads[pausing === 'google' ? 'meta' : 'google'].running ? `${NAME[pausing === 'google' ? 'meta' : 'google']} keeps running.` : 'No other platform is running here.'}
          {pausing === 'meta' && ' Pausing counts as a major edit, so learning starts again after you restart it.'}
        </Modal>
      )}
    </Card>
  );
}

export function TestModal({ s, state, onClose, onDone }: { s: Site; state: SiteState; onClose: () => void; onDone: (msg: string) => void }) {
  const { overrides, globalPause } = useApp();
  const ads = adsOnSite(s.id, state, overrides, globalPause);
  const platforms = (['google', 'meta'] as const).filter((k) => ads[k].total > 0);
  const [platform, setPlatform] = useState<PlatformKey>(platforms[0] ?? 'google');
  const options = platform === 'meta' ? ['Budget', 'Landing page', 'Ad text', 'Ad template'] : ['Budget', 'Landing page', 'Ad text'];
  return (
    <Modal title="Start a controlled test" onClose={onClose} confirm="Start test" onConfirm={() => onDone(`${NAME[platform]} test planned for 21 days (mockup: not saved)`)}>
      <label>
        Platform
        <select value={platform} onChange={(e) => setPlatform(e.target.value as PlatformKey)}>
          {platforms.length === 0 && <option value="google">Google Ads</option>}
          {platforms.map((k) => (
            <option key={k} value={k}>
              {NAME[k]}
            </option>
          ))}
        </select>
      </label>
      <label>
        What to change
        <select>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      <label>
        Describe the change
        <input placeholder={platform === 'meta' ? 'e.g. Try version B of the Local template' : 'e.g. Raise Search budget +20%'} />
      </label>
      <label>
        Length
        <select defaultValue="21">
          <option value="14">14 days</option>
          <option value="21">21 days</option>
          <option value="28">28 days</option>
        </select>
      </label>
      <div className="small">{platform === 'meta' ? 'Changing a live ad set restarts its learning, so the test runs as a separate ad set.' : 'Half the traffic keeps the current setup, so the result can be compared fairly.'}</div>
    </Modal>
  );
}
