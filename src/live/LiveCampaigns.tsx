// PROTOTYPE: the real campaigns in the connected Google Ads account, with working Pause/Restart and Budget buttons.
// Test mode: the Google Ads test account. Live mode: a real account, where switching on asks you to type the name.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state';
import { Icon } from '../icons';
import { Act, Card, Modal, Pill } from '../ui';
import { api, money, type CapEntry, type LiveCampaign } from './api';
import { useLiveMode } from './mode';

export function LiveCampaigns() {
  const { toast } = useApp();
  const { live, health, account, accounts, currency, chooseAccount, refresh } = useLiveMode();
  const [list, setList] = useState<LiveCampaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [budgetFor, setBudgetFor] = useState<LiveCampaign | null>(null);
  const [budget, setBudget] = useState('');
  const [enableFor, setEnableFor] = useState<LiveCampaign | null>(null);
  const [typed, setTyped] = useState('');
  const [lastCap, setLastCap] = useState<CapEntry | null>(null);
  const [capBusy, setCapBusy] = useState(false);
  const maxDaily = health?.caps?.maxDailyBudget ?? 5;
  const fmt = (n: number) => money(n, currency);

  const load = useCallback(async () => {
    const r = await api.campaigns();
    if (r.ok) {
      setList(r.campaigns as LiveCampaign[]);
      setError(null);
    } else setError(r.summary);
    const log = await api.capLog();
    setLastCap(((log.entries as CapEntry[] | undefined) ?? []).find((e) => e.account === account) ?? null);
  }, [account]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (c: LiveCampaign, run: () => ReturnType<typeof api.setStatus>) => {
    setBusy(c.id);
    const r = await run();
    toast(r.ok ? `Google Ads: ${r.summary}` : `${r.refused ? 'Refused' : 'Google Ads refused'}: ${r.summary}`);
    await load();
    setBusy(null);
  };

  const runCap = async () => {
    setCapBusy(true);
    const r = await api.capCheck(undefined, true);
    toast(r.ok ? `Monthly cap: ${r.summary}` : `Monthly cap check failed: ${r.summary}`);
    await load();
    await refresh();
    setCapBusy(false);
  };

  return (
    <Card
      flush
      className="live-card"
      title={
        <>
          {live ? 'Live account' : 'Live test account'} <Pill tone={live ? 'danger' : 'warn'}>{live ? 'Real money' : 'Google Ads test'}</Pill>
        </>
      }
      extra={
        live ? (
          <span className="small muted">
            real campaigns · campaigns that run spend real money · <Link to="/api-check">API check</Link>
          </span>
        ) : (
          <span className="small muted">
            real campaigns, real API calls · ads never run, no money spent · <Link to="/api-check">API check</Link>
          </span>
        )
      }
    >
      {live && accounts.length > 1 && (
        <div className="live-caps">
          <label className="filter">
            <span>Account</span>
            <select value={account ?? ''} onChange={(e) => chooseAccount(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} {a.name ? `· ${a.name}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {error ? (
        <p className="live-off">
          {Icon.lock()} {error}
        </p>
      ) : !list ? (
        <p className="live-off">Loading from Google Ads…</p>
      ) : !list.length ? (
        <p className="live-off">
          No campaigns in this account yet. <Link to="/api-check">Run the API check</Link> to create one (paused).
        </p>
      ) : (
        <div className="table-wrap">
          <table className="dense">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th className="num">Daily budget</th>
                <th className="num">Spend this month</th>
                <th className="num">Clicks</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="site-name one-line">{c.name}</span>
                    <span className="sub">
                      {c.type} · ID {c.id}
                    </span>
                  </td>
                  <td>
                    <Pill tone={c.status === 'ENABLED' ? 'ok' : 'warn'}>{c.status === 'ENABLED' ? 'Running' : 'Paused'}</Pill>
                    <span className="sub">Google: {c.primaryStatus.toLowerCase().replace(/_/g, ' ')}</span>
                  </td>
                  <td className="num">{fmt(c.dailyUsd)}</td>
                  <td className="num">{fmt(c.monthToDate.spendUsd)}</td>
                  <td className="num">{c.monthToDate.clicks}</td>
                  <td className="nowrap" style={{ textAlign: 'right' }}>
                    {c.status === 'ENABLED' ? (
                      <Act action="pauseCampaign" kind="sm" onClick={() => act(c, () => api.setStatus(c.id, 'PAUSED'))}>
                        {busy === c.id ? 'Saving…' : 'Pause'}
                      </Act>
                    ) : (
                      <Act
                        action="pauseCampaign"
                        kind="sm"
                        onClick={() => {
                          if (!live) return act(c, () => api.setStatus(c.id, 'ENABLED'));
                          setTyped('');
                          setEnableFor(c);
                        }}
                      >
                        {busy === c.id ? 'Saving…' : 'Restart'}
                      </Act>
                    )}{' '}
                    <Act
                      action="setCap"
                      kind="sm"
                      onClick={() => {
                        setBudgetFor(c);
                        setBudget(String(c.dailyUsd));
                      }}
                    >
                      Budget
                    </Act>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="live-caps">
        <span>
          Daily budgets up to <b>{fmt(maxDaily)}</b>
        </span>
        {live && (
          <span>
            Monthly cap <b>{fmt(health?.caps?.monthlyCap ?? 0)}</b> for this account · checked every {health?.caps?.capEveryHours} h
          </span>
        )}
        {lastCap && (
          <span title={lastCap.summary}>
            Last cap check {new Date(lastCap.time).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} ({lastCap.source}):{' '}
            {lastCap.action === 'none' ? 'no action' : lastCap.action === 'lower-budget' ? 'lowered budgets' : lastCap.action === 'pause' ? 'paused campaigns' : 'failed'}
          </span>
        )}
        <span className="spacer" />
        {live && (
          <Act action="setCap" kind="sm" onClick={runCap}>
            {capBusy ? 'Checking…' : 'Run cap check now'}
          </Act>
        )}
      </div>
      {budgetFor && (
        <Modal
          title={`Daily budget · ${budgetFor.name}`}
          confirm="Save to Google Ads"
          danger={live}
          confirmDisabled={!(Number(budget) > 0 && Number(budget) <= maxDaily)}
          onClose={() => setBudgetFor(null)}
          onConfirm={() => {
            const c = budgetFor;
            setBudgetFor(null);
            act(c, () => api.setBudget(c.id, Number(budget)));
          }}
        >
          <label>
            {currency} per day (the server allows up to {fmt(maxDaily)})
            <input type="number" min="0.01" max={maxDaily} step="0.5" value={budget} onChange={(e) => setBudget(e.target.value)} autoFocus />
          </label>
        </Modal>
      )}
      {enableFor && (
        <Modal
          title="Switch this campaign on?"
          confirm="Switch on · real money"
          danger
          confirmDisabled={typed.trim() !== enableFor.name}
          onClose={() => setEnableFor(null)}
          onConfirm={() => {
            const c = enableFor;
            setEnableFor(null);
            act(c, () => api.setStatus(c.id, 'ENABLED', `ENABLE ${c.id}`));
          }}
        >
          <p>
            <b>{enableFor.name}</b> will start showing ads in a real account and spend up to {fmt(enableFor.dailyUsd)} a day (Google can spend up to twice that on a single day). Our
            monthly cap of {fmt(health?.caps?.monthlyCap ?? 0)} still applies.
          </p>
          <label className="confirm-type">
            <span>
              Type the campaign name to confirm: <code>{enableFor.name}</code>
            </span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus spellCheck={false} />
          </label>
        </Modal>
      )}
    </Card>
  );
}
