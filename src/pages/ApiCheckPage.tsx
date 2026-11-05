// PROTOTYPE test tool: runs every Google Ads operation the screens need, end to end (browser → local server → Google Ads
// API v25 → back). Test mode: a TEST account, which never shows ads, so nothing is spent. Live mode: a real account, and
// the run is limited to reading and paused changes: nothing is switched on, the cap is only dry-run, nothing is removed.
import { useEffect, useRef, useState } from 'react';
import { api, type StepResult } from '../live/api';
import { Icon } from '../icons';
import { Card, Pill } from '../ui';
import { useLiveMode } from '../live/mode';

interface Step {
  key: string;
  title: string;
  what: string;
  run: (ctx: { campaignId?: string }) => Promise<StepResult>;
}

// The monthly cap steps use a $10 cap against the $3/day budget set just before, so the dry run has something to
// decide (lower the budget) and the applied run has something to change.
const CAP = 10;

const ALL_STEPS: Step[] = [
  { key: 'health', title: 'Sign in and check accounts', what: 'Google login works and both accounts are test accounts.', run: () => api.health() },
  { key: 'setup', title: 'Create a test campaign', what: 'Budget, paused Search campaign, ad group, ad and 2 keywords in one call.', run: () => api.setup() },
  { key: 'campaigns', title: 'Read campaigns', what: "Status, Google's own status and this month's spend, clicks and conversions.", run: () => api.campaigns() },
  { key: 'enable', title: 'Restart a campaign', what: 'Set it to running, then read it back from Google.', run: ({ campaignId }) => need(campaignId, () => api.setStatus(campaignId!, 'ENABLED')) },
  { key: 'pause', title: 'Pause a campaign', what: 'Set it to paused, then read it back from Google.', run: ({ campaignId }) => need(campaignId, () => api.setStatus(campaignId!, 'PAUSED')) },
  { key: 'budget', title: 'Change the daily budget', what: 'Set 3 a day, then read it back. Our server refuses more than its daily maximum.', run: ({ campaignId }) => need(campaignId, () => api.setBudget(campaignId!, 3)) },
  { key: 'ads', title: 'Read ads and approval', what: "Each ad's status, Google approval and ad strength.", run: () => api.ads() },
  { key: 'keywords', title: 'Read keywords and Quality Score', what: 'Keyword text, match type and Quality Score.', run: () => api.keywords() },
  { key: 'conversions', title: 'Read conversion tracking', what: 'Whether conversions are tracked and which actions exist.', run: () => api.conversions() },
  { key: 'cap-dry', title: `Monthly cap · dry run ($${CAP})`, what: 'Our backend reads spend this month and decides: nothing, lower the budget, or pause.', run: () => api.capCheck(CAP, false) },
  { key: 'cap-apply', title: `Monthly cap · apply ($${CAP})`, what: 'Same check, and this time it makes the change in Google Ads.', run: () => api.capCheck(CAP, true) },
  { key: 'experiments', title: 'Create an experiment', what: 'Experiment with control and treatment arms, read back, then schedule it.', run: () => api.experiments() },
  { key: 'keyword-ideas', title: 'Keyword ideas', what: 'Search volume and bid range for "guitar lessons".', run: () => api.keywordIdeas() },
  { key: 'cleanup', title: 'Clean up', what: 'Remove every ae-apitest- campaign and experiment created above.', run: () => api.cleanup() },
];

// Live mode: read + paused changes only. No switching on, the cap is a dry run against the account cap, nothing is removed.
const LIVE_SKIP = new Set(['enable', 'cap-apply', 'cleanup']);
const LIVE_STEPS: Step[] = ALL_STEPS.filter((s) => !LIVE_SKIP.has(s.key)).map((s) =>
  s.key === 'cap-dry'
    ? { ...s, title: 'Monthly cap · dry run (account cap)', what: "Reads this month's spend for the whole account and says what the cap would do. Changes nothing.", run: () => api.capCheck(undefined, false) }
    : s.key === 'setup'
      ? { ...s, title: 'Create a paused campaign', what: 'Budget, PAUSED Search campaign (ae-live-…), ad group, ad and 2 keywords. Nothing runs until someone switches it on.' }
      : s.key === 'experiments'
        ? { ...s, what: 'Experiment with control and treatment arms, read back. Not scheduled: in live mode that needs a typed confirmation.' }
        : s,
);

async function need(id: string | undefined, fn: () => Promise<StepResult>): Promise<StepResult> {
  if (id) return fn();
  return { ok: false, step: 'skipped', httpStatus: 0, durationMs: 0, summary: 'Skipped: no test campaign yet. Run "Create a test campaign" first.' };
}

type Status = 'idle' | 'running' | 'ok' | 'warn' | 'fail';
const statusOf = (r?: StepResult): Status => (!r ? 'idle' : !r.ok ? 'fail' : r.warn ? 'warn' : 'ok');
const MARK: Record<Status, string> = { idle: '·', running: '…', ok: '✅', warn: '⚠️', fail: '❌' };
const LABEL: Record<Status, string> = { idle: 'Not run', running: 'Running', ok: 'Works', warn: 'Works, with a caveat', fail: 'Failed' };

export function ApiCheckPage() {
  const { live, refresh } = useLiveMode();
  const STEPS = live ? LIVE_STEPS : ALL_STEPS;
  const [results, setResults] = useState<Record<string, StepResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const campaignId = useRef<string | undefined>(undefined);
  const busyAll = useRef(false); // React dev mode runs effects twice; never start two full runs
  const health = results.health;

  useEffect(() => {
    // ?run=all starts a full run on load (used for screenshots).
    if (new URLSearchParams(location.search).get('run') === 'all') runAll();
    else api.health().then((r) => setResults((x) => ({ ...x, health: r })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runOne = async (s: Step) => {
    setRunning(s.key);
    if (!campaignId.current && s.key !== 'setup' && s.key !== 'health') await findCampaign();
    const r = await s.run({ campaignId: campaignId.current });
    if (s.key === 'setup' && r.ok && typeof r.campaignId === 'string') campaignId.current = r.campaignId; // exactly the one we just made
    else if (s.key === 'campaigns' && !campaignId.current) await findCampaign(r);
    if (s.key === 'cleanup' && r.ok) campaignId.current = undefined;
    setResults((x) => ({ ...x, [s.key]: r }));
    setRunning(null);
    return r;
  };

  const findCampaign = async (r?: StepResult) => {
    const list = r?.step === 'campaigns' ? r : await api.campaigns();
    const c = (list.campaigns as { id: string; testCampaign: boolean }[] | undefined)?.find((x) => x.testCampaign);
    campaignId.current = c?.id;
  };

  const runAll = async () => {
    if (busyAll.current) return;
    busyAll.current = true;
    setAll(true);
    setResults({});
    // The mode comes from the server's own answer, not from page state that may not have loaded yet.
    const h = await runOne(ALL_STEPS[0]);
    if (h.ok) for (const s of (h.mode === 'live' ? LIVE_STEPS : ALL_STEPS).slice(1)) await runOne(s);
    refresh();
    setAll(false);
    busyAll.current = false;
  };

  const done = STEPS.map((s) => statusOf(results[s.key]));
  const count = (k: Status) => done.filter((d) => d === k).length;
  const accounts = (health?.accounts as { role: string; id: string; name: string; currency: string; testAccount: boolean }[] | undefined) ?? [];

  return (
    <>
      <div className="page-head">
        <div style={{ flex: 1 }}>
          <h1>
            API check <Pill tone={live ? 'danger' : 'warn'}>{live ? 'Live account' : 'Test tool'}</Pill>
          </h1>
          <p>Runs each Google Ads operation the screens need, end to end: this page → our server → Google Ads API → back.</p>
        </div>
        <button className="btn primary" disabled={!!running} onClick={runAll}>
          {Icon.play()}
          {all ? 'Running…' : live ? 'Run read + paused checks' : 'Run all checks'}
        </button>
      </div>

      {live ? (
        <div className="live-banner is-live" role="note">
          <b>LIVE account · read + paused changes only</b> · this run reads the account, creates a paused campaign and changes its budget. It never switches anything on, never removes anything, and only dry-runs the monthly cap.
        </div>
      ) : (
        <div className="live-banner" role="note">
          <b>Google Ads test account</b> · ads never run · no money spent
        </div>
      )}

      <div className="kpis api-kpis">
        <div className="kpi">
          <div className="kpi-label">Server</div>
          <div className="kpi-value">{!health ? '…' : health.offline ? 'Offline' : health.ok ? 'Connected' : 'Problem'}</div>
          <div className="kpi-sub">{health?.offline ? 'start it with npm run dev:live' : accounts.map((a) => `${a.role} ${a.id}`).join(' · ') || ' '}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Works</div>
          <div className="kpi-value good">{count('ok')}</div>
          <div className="kpi-sub">of {STEPS.length} checks</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Works, with a caveat</div>
          <div className="kpi-value">{count('warn')}</div>
          <div className="kpi-sub">read the note</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Failed</div>
          <div className={`kpi-value${count('fail') ? ' bad' : ''}`}>{count('fail')}</div>
          <div className="kpi-sub">Google's error code shown</div>
        </div>
      </div>

      <Card flush title="Checks" extra={<span className="small muted">each step is a real call to Google; expand a row for Google's reply</span>}>
        <ol className="api-steps">
          {STEPS.map((s, i) => {
            const r = results[s.key];
            const st: Status = running === s.key ? 'running' : statusOf(r);
            return (
              <li key={s.key} className={`api-step s-${st}`}>
                <span className="api-mark" aria-label={LABEL[st]}>
                  {MARK[st]}
                </span>
                <div className="api-body">
                  <div className="api-title">
                    <span className="api-n">{i + 1}</span>
                    <b>{s.title}</b>
                    {r && (
                      <span className="small muted num">
                        {r.httpStatus ? `HTTP ${r.httpStatus} · ` : ''}
                        {(r.durationMs / 1000).toFixed(1)} s
                      </span>
                    )}
                  </div>
                  <p className="api-what">{r ? r.summary : s.what}</p>
                  {r && (r.google !== undefined || r.decisions !== undefined) && (
                    <details className="api-raw">
                      <summary>Google's reply</summary>
                      <pre>{JSON.stringify(stripSummary(r), null, 2)}</pre>
                    </details>
                  )}
                </div>
                <button className="btn sm" disabled={!!running} onClick={() => runOne(s)}>
                  Run
                </button>
              </li>
            );
          })}
        </ol>
      </Card>

      {live ? (
        <p className="small muted api-foot">
          Safety, enforced by the server: it only touches the accounts listed in LIVE_CUSTOMER_IDS; created campaigns are always paused; switching a campaign on or scheduling an
          experiment needs a typed confirmation and is refused once the monthly cap is reached; budgets above the daily maximum are refused; clean up and every remove are
          disabled. The monthly cap also runs on its own every few hours and logs each decision in server/logs.
          {health?.accessLevel ? <> Access: {String(health.accessLevel)}</> : null}
        </p>
      ) : (
      <p className="small muted api-foot">
        Safety, enforced by the server: it only starts if both accounts are Google Ads test accounts and checks again before every change; daily budgets above
        $5 are refused; created campaigns are always paused; cleanup only removes items named ae-apitest-. Spend, clicks and Quality Score stay empty because
        test accounts never show ads.
      </p>
      )}
    </>
  );
}

function stripSummary(r: StepResult) {
  const { ok: _ok, warn: _warn, step: _step, summary: _summary, durationMs: _d, httpStatus: _h, ...rest } = r;
  return rest;
}
