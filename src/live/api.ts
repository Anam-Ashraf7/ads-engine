// PROTOTYPE: talks to server/gads-server.mjs through the Vite proxy at /api. The server runs in test mode (a Google Ads
// test account) or live mode (real accounts on its allowlist). Everything else in the mockup stays on made-up data.

export interface StepResult {
  ok: boolean;
  warn?: boolean;
  refused?: boolean;
  step: string;
  httpStatus: number;
  durationMs: number;
  summary: string;
  google?: unknown;
  [extra: string]: unknown;
}

export interface LiveCampaign {
  id: string;
  name: string;
  type: string;
  status: 'ENABLED' | 'PAUSED' | string;
  primaryStatus: string;
  primaryStatusReasons: string[];
  dailyUsd: number; // in the account's currency
  monthToDate: { spendUsd: number; clicks: number; impressions: number; conversions: number };
  testCampaign: boolean;
}

export interface CapEntry {
  time: string;
  mode: 'test' | 'live';
  account: string;
  source: 'auto' | 'manual' | 'api-check';
  apply?: boolean;
  action: 'none' | 'lower-budget' | 'pause' | 'error';
  summary?: string;
}

export interface Health extends StepResult {
  mode?: 'test' | 'live';
  allowlist?: string[];
  caps?: { maxDailyBudget: number; monthlyCap: number | null; capEveryHours: number | null };
  accounts?: { role: string; id: string; name?: string; currency?: string; testAccount?: boolean; error?: string[]; hint?: string | null }[];
  accessLevel?: string;
  lastCap?: CapEntry | null;
}

// The account every call is for. Only matters in live mode with more than one allowlisted account.
let account: string | null = null;
export const setAccount = (id: string | null) => {
  account = id;
};

/** Calls the server. A dead server or proxy error comes back as a failed step, never a thrown error. */
export async function call(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<StepResult> {
  const t0 = performance.now();
  const withAccount = method === 'GET' ? (account ? `${path}${path.includes('?') ? '&' : '?'}account=${account}` : path) : path;
  const payload = method === 'POST' ? { ...(body ?? {}), ...(account ? { account } : {}) } : undefined;
  try {
    const r = await fetch(`/api${withAccount}`, {
      method,
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const text = await r.text();
    try {
      return JSON.parse(text) as StepResult;
    } catch {
      return offline(path, t0, `The Google Ads server isn't answering (HTTP ${r.status}). Start it with "npm run dev:live".`);
    }
  } catch {
    return offline(path, t0, 'The Google Ads server isn\'t running. Start it with "npm run dev:live".');
  }
}

const offline = (path: string, t0: number, summary: string): StepResult => ({ ok: false, step: path, httpStatus: 0, durationMs: Math.round(performance.now() - t0), summary, offline: true });

export const api = {
  health: () => call('GET', '/health') as Promise<Health>,
  setup: () => call('POST', '/setup'),
  campaigns: () => call('GET', '/campaigns'),
  /** Live mode: switching on needs confirm "ENABLE <id>"; the server refuses it otherwise. */
  setStatus: (id: string, status: 'PAUSED' | 'ENABLED', confirm?: string) => call('POST', `/campaigns/${id}/status`, { status, confirm }),
  setBudget: (id: string, dailyUsd: number) => call('POST', `/campaigns/${id}/budget`, { dailyUsd }),
  ads: () => call('GET', '/ads'),
  keywords: () => call('GET', '/keywords'),
  conversions: () => call('GET', '/conversions'),
  /** Test mode: a cap for the ae-apitest- campaigns. Live mode: the account cap (a request can lower it, never raise it). */
  capCheck: (monthlyCapUsd: number | undefined, apply: boolean) => call('POST', '/cap-check', { monthlyCapUsd, apply }),
  capLog: () => call('GET', '/cap-log'),
  experiments: () => call('POST', '/experiments'),
  keywordIdeas: () => call('GET', '/keyword-ideas'),
  cleanup: () => call('POST', '/cleanup'),
};

/** Money in the account's currency, e.g. "$3.00" or "€3.00"; falls back to the bare number. */
export function money(n: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return n.toFixed(2);
  }
}
export const usd = (n: number) => money(n, 'USD');
