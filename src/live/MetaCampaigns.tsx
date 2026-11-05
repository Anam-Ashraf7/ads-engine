// PROTOTYPE: the Meta ad account box on Campaigns. Shows nothing until META_ENABLED=true in server/.env.local.
// Campaigns are created paused; switching one on asks you to type its name, in sandbox mode too.
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../state';
import { Act, Card, Modal, Pill } from '../ui';
import { call, money, type StepResult } from './api';

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  daily: number | null;
  budgetAt: string;
  monthToDate: { spend: number; clicks: number; impressions: number };
}
interface MetaHealth extends StepResult {
  enabled?: boolean;
  mode?: 'sandbox' | 'live';
  caps?: { maxDailyBudget: number; monthlyCap: number; capEveryHours: number };
  lastCap?: { time: string; source: string; summary?: string } | null;
}

export const metaApi = {
  health: () => call('GET', '/meta/health') as Promise<MetaHealth>,
  campaigns: () => call('GET', '/meta/campaigns'),
  setup: () => call('POST', '/meta/setup'),
  setStatus: (id: string, status: 'PAUSED' | 'ACTIVE', confirm?: string) => call('POST', `/meta/campaigns/${id}/status`, { status, confirm }),
  setBudget: (id: string, daily: number) => call('POST', `/meta/campaigns/${id}/budget`, { daily }),
  capCheck: (apply: boolean) => call('POST', '/meta/cap-check', { apply }),
};

function useMetaHealth() {
  const [health, setHealth] = useState<MetaHealth | null>(null);
  const refresh = useCallback(() => metaApi.health().then(setHealth), []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { health, refresh };
}

/** The header pill: says whether Meta is connected, instead of a fixed label. */
export function MetaPill() {
  const { health } = useMetaHealth();
  return health?.enabled ? (
    <>
      <span className={`pill ${health.ok ? 't-ok' : 't-danger'}`} title={health.summary}>
        <i className="risk-dot" />
        Meta {health.mode === 'live' ? 'live' : 'sandbox'}{health.ok ? ' connected' : ': problem'}
      </span>
      <span className="pill t-muted" title="Not connected yet">Microsoft Ads: not connected</span>
    </>
  ) : (
    <span className="pill t-muted" title={health?.summary ?? 'Not connected yet'}>Meta · Microsoft Ads: not connected</span>
  );
}

export function MetaCampaigns() {
  const { toast } = useApp();
  const { health, refresh } = useMetaHealth();
  const [list, setList] = useState<MetaCampaign[] | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [budgetFor, setBudgetFor] = useState<MetaCampaign | null>(null);
  const [budget, setBudget] = useState('');
  const [enableFor, setEnableFor] = useState<MetaCampaign | null>(null);
  const [typed, setTyped] = useState('');
  const enabled = !!health?.enabled;
  const fmt = (n: number) => money(n, currency);

  const load = useCallback(async () => {
    const r = await metaApi.campaigns();
    if (r.ok) {
      setList(r.campaigns as MetaCampaign[]);
      setCurrency((r.currency as string) ?? 'USD');
      setError(null);
    } else setError(r.summary);
  }, []);
  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  if (!health?.enabled) return null;

  const run = async (key: string, fn: () => Promise<StepResult>) => {
    setBusy(key);
    const r = await fn();
    toast(r.summary);
    setBusy(null);
    await load();
    await refresh();
  };

  return (
    <Card
      flush
      className="live-card"
      title={
        <>
          Meta ad account <Pill tone={health.mode === 'live' ? 'danger' : 'warn'}>{health.mode === 'live' ? 'Real money' : 'Sandbox'}</Pill>
        </>
      }
      extra={<span className="small muted">{health.mode === 'live' ? 'campaigns that run spend real money' : 'a sandbox account: its ads never run'}</span>}
    >
      {error ? (
        <p className="live-off">{error}</p>
      ) : !list ? (
        <p className="live-off">Loading from Meta…</p>
      ) : list.length === 0 ? (
        <p className="live-off">No campaigns in this account yet.</p>
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
                    <span className="sub">ID {c.id}</span>
                  </td>
                  <td>
                    <Pill tone={c.status === 'ACTIVE' ? 'ok' : 'warn'}>{c.status === 'ACTIVE' ? 'Running' : 'Paused'}</Pill>
                    <span className="sub">Meta: {String(c.effectiveStatus ?? '').toLowerCase().replace(/_/g, ' ')}</span>
                  </td>
                  <td className="num">
                    {c.daily !== null ? fmt(c.daily) : '—'}
                    <span className="sub">on {c.budgetAt}</span>
                  </td>
                  <td className="num">{fmt(c.monthToDate.spend)}</td>
                  <td className="num">{c.monthToDate.clicks}</td>
                  <td className="nowrap" style={{ textAlign: 'right' }}>
                    {c.status === 'ACTIVE' ? (
                      <Act action="pauseCampaign" kind="sm" onClick={() => run(c.id, () => metaApi.setStatus(c.id, 'PAUSED'))}>
                        {busy === c.id ? 'Saving…' : 'Pause'}
                      </Act>
                    ) : (
                      <Act
                        action="pauseCampaign"
                        kind="sm"
                        onClick={() => {
                          setEnableFor(c);
                          setTyped('');
                        }}
                      >
                        {busy === c.id ? 'Saving…' : 'Switch on'}
                      </Act>
                    )}{' '}
                    <Act
                      action="setCap"
                      kind="sm"
                      onClick={() => {
                        setBudgetFor(c);
                        setBudget(String(c.daily ?? 1));
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
        <span className="small muted">
          Daily budgets up to <b>{fmt(health.caps?.maxDailyBudget ?? 0)}</b>
        </span>
        <span className="small muted">
          Monthly cap <b>{fmt(health.caps?.monthlyCap ?? 0)}</b> · checked every {health.caps?.capEveryHours} h
        </span>
        {health.lastCap?.summary && <span className="small muted">Last check: {health.lastCap.summary}</span>}
        <span className="spacer" />
        <Act action="setCap" kind="sm" onClick={() => run('setup', metaApi.setup)}>
          {busy === 'setup' ? 'Creating…' : 'New paused campaign'}
        </Act>
        <Act action="setCap" kind="sm" onClick={() => run('cap', () => metaApi.capCheck(true))}>
          {busy === 'cap' ? 'Checking…' : 'Run cap check now'}
        </Act>
      </div>
      {budgetFor && (
        <Modal
          title={`Daily budget · ${budgetFor.name}`}
          confirm="Save"
          onClose={() => setBudgetFor(null)}
          onConfirm={() => {
            const c = budgetFor;
            setBudgetFor(null);
            run(c.id, () => metaApi.setBudget(c.id, Number(budget)));
          }}
        >
          <label className="confirm-type">
            Amount per day in {currency}, up to {health.caps?.maxDailyBudget}
            <input type="number" min="0.01" max={health.caps?.maxDailyBudget} step="0.5" value={budget} onChange={(e) => setBudget(e.target.value)} autoFocus />
          </label>
        </Modal>
      )}
      {enableFor && (
        <Modal
          title={`Switch on ${enableFor.name}?`}
          danger
          confirm="Switch on"
          confirmDisabled={typed !== enableFor.name}
          onClose={() => setEnableFor(null)}
          onConfirm={() => {
            const c = enableFor;
            setEnableFor(null);
            run(c.id, () => metaApi.setStatus(c.id, 'ACTIVE', `ENABLE ${c.id}`));
          }}
        >
          {health.mode === 'live' ? 'Ads will run and spend real money, up to the monthly cap.' : 'This is a sandbox account, so its ads will not run.'}
          <label className="confirm-type">
            Type the campaign name to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </label>
        </Modal>
      )}
    </Card>
  );
}
