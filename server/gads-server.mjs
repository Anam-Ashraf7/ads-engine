// PROTOTYPE: a small local server between the mockup and the Google Ads API (v25). Secrets stay on this machine and
// are never printed or sent to the browser.
//
// Two modes, set by MODE in server/.env.local:
//
// MODE=test (default): a Google Ads TEST account. Test accounts never serve ads, so nothing here can spend money.
// - the manager and client accounts must report customer.test_account = true, checked at startup and before every write;
// - daily budgets are capped at 5 and created campaigns are always PAUSED;
// - everything we create is named "ae-apitest-…", and cleanup only touches those.
//
// MODE=live: real accounts, so real money once a campaign runs. Extra rules, all enforced here:
// - only the accounts in LIVE_CUSTOMER_IDS are touched; any other account is refused (403);
// - created campaigns are always PAUSED and named "ae-live-…";
// - switching a campaign on (or scheduling an experiment) needs confirm "ENABLE <campaignId>" in the request, else 409;
//   it is also refused once the account has reached its monthly cap;
// - daily budgets above MAX_DAILY_BUDGET are refused; cleanup and anything that removes is disabled (403);
// - the monthly cap (MONTHLY_CAP, per account) runs on its own every CAP_EVERY_HOURS and logs each decision to
//   server/logs/cap-YYYY-MM.jsonl.
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGate, hostingConfig, serveDashboard } from './hosting.mjs';
import { createMeta, metaConfig } from './meta.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const V = 'v25';
const BASE = `https://googleads.googleapis.com/${V}`;

// ---------- config ----------
let rawEnv = {};
function loadEnv() {
  const env = {};
  rawEnv = env;
  try {
    for (const line of readFileSync(resolve(HERE, process.env.AE_ENV_FILE || '.env.local'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2];
    }
  } catch {
    const set = process.env.AE_ENV_FILE;
    if (set) {
      let names;
      try {
        names = readdirSync(dirname(resolve(HERE, set))).join(', ') || 'none';
      } catch {
        names = 'that folder does not exist';
      }
      throw new Error(`AE_ENV_FILE is ${set}, but that file can't be read. Files found in its folder: ${names}.`);
    }
    if (process.env.RENDER) throw new Error('AE_ENV_FILE is not set. On Render, add the environment variable AE_ENV_FILE=/etc/secrets/server.env.');
    throw new Error('server/.env.local is missing. Copy server/.env.example and fill it in.');
  }
  const path = (p) => (isAbsolute(p) ? p : resolve(HERE, p));
  const id = (s) => String(s ?? '').replace(/-/g, '').trim();
  const mode = (env.MODE || 'test').toLowerCase();
  if (mode !== 'test' && mode !== 'live') throw new Error(`server/.env.local: MODE must be test or live, not "${env.MODE}"`);
  for (const k of ['CLIENT_FILE', 'TOKEN_FILE']) if (!env[k]) throw new Error(`server/.env.local: ${k} is not set`);
  const common = { mode, clientFile: path(env.CLIENT_FILE), tokenFile: path(env.TOKEN_FILE), port: Number(process.env.AE_PORT || process.env.PORT || env.PORT || 5190) }; // AE_PORT: run a second copy beside a running one. PORT: set by Render
  if (mode === 'test') {
    for (const k of ['MANAGER_ID', 'CUSTOMER_ID']) if (!env[k]) throw new Error(`server/.env.local: ${k} is not set`);
    return { ...common, prefix: 'ae-apitest-', loginId: id(env.MANAGER_ID), managerId: id(env.MANAGER_ID), accounts: [id(env.CUSTOMER_ID)], maxDaily: 5, monthlyCap: null, capEveryHours: 0, capFirstRunSeconds: 0 };
  }
  const accounts = String(env.LIVE_CUSTOMER_IDS ?? '').split(',').map(id).filter(Boolean);
  if (!accounts.length) throw new Error('MODE=live needs at least one account in LIVE_CUSTOMER_IDS (comma-separated). Nothing will be touched until you add one.');
  const num = (k, d) => {
    const n = Number(env[k] || d);
    if (!(n > 0)) throw new Error(`server/.env.local: ${k} must be a number above 0`);
    return n;
  };
  return {
    ...common,
    prefix: 'ae-live-',
    loginId: id(env.LIVE_LOGIN_CUSTOMER_ID) || null, // a manager account, only if the accounts are reached through one
    managerId: null,
    accounts,
    maxDaily: num('MAX_DAILY_BUDGET', 10),
    monthlyCap: num('MONTHLY_CAP', 20),
    capEveryHours: num('CAP_EVERY_HOURS', 2),
    capFirstRunSeconds: num('CAP_FIRST_RUN_SECONDS', 60),
  };
}

let cfg;
try {
  cfg = loadEnv();
} catch (err) {
  console.error('Not starting:', err.message);
  process.exit(1);
}
const LIVE = cfg.mode === 'live';
const PREFIX = cfg.prefix;
const hosting = hostingConfig();
if (hosting.problem) {
  console.error('Not starting:', hosting.problem);
  process.exit(1);
}
const gate = createGate(hosting);
const client = JSON.parse(readFileSync(cfg.clientFile, 'utf8'));
const oauth = client.web ?? client.installed;
const refreshToken = readFileSync(cfg.tokenFile, 'utf8').trim();

// Anything that leaves this process goes through redact(), so a secret can't slip into a reply or a log line.
const SECRETS = [oauth.client_secret, refreshToken, hosting.password, hosting.secret];

// Meta ads: off until META_ENABLED=true (server/meta.mjs). A bad setting stops Meta only, never Google Ads.
const metaLogFile = (d = new Date()) => resolve(HERE, 'logs', `meta-cap-${d.toISOString().slice(0, 7)}.jsonl`);
let meta = null;
let metaProblem = null;
try {
  const mc = metaConfig(rawEnv, (p) => (isAbsolute(p) ? p : resolve(HERE, p)));
  if (mc.enabled) {
    const token = readFileSync(mc.tokenFile, 'utf8').trim();
    const appSecret = mc.appSecretFile ? readFileSync(mc.appSecretFile, 'utf8').trim() : null;
    SECRETS.push(token);
    if (appSecret) SECRETS.push(appSecret);
    meta = createMeta({
      cfg: mc,
      token,
      appSecretProof: appSecret ? createHmac('sha256', appSecret).update(token).digest('hex') : null,
      logCap: (entry) => {
        mkdirSync(resolve(HERE, 'logs'), { recursive: true });
        appendFileSync(metaLogFile(), redact(JSON.stringify({ time: new Date().toISOString(), mode: mc.mode, ...entry })) + '\n');
      },
      readCapLog: (limit) => (existsSync(metaLogFile()) ? readFileSync(metaLogFile(), 'utf8').split('\n').filter(Boolean).slice(-limit).map((l) => JSON.parse(l)).reverse() : []),
    });
  }
} catch (err) {
  metaProblem = err.message;
}
let accessTokenValue = '';
function redact(text) {
  let s = String(text);
  for (const v of [...SECRETS, accessTokenValue]) if (v) s = s.split(v).join('[redacted]');
  return s.replace(/\bEAA[\w-]{20,}/g, '[redacted]').replace(/ya29\.[\w.-]+/g, '[redacted]').replace(/1\/\/[\w-]{20,}/g, '[redacted]').replace(/GOCSPX-[\w-]+/g, '[redacted]');
}

/** An error that goes back to the browser with this HTTP status (403 refused, 409 needs confirmation). */
const refuse = (httpCode, msg) => Object.assign(new Error(msg), { httpCode });

// ---------- auth (access token cached until shortly before it expires) ----------
let tokenExpires = 0;
async function accessToken() {
  if (accessTokenValue && Date.now() < tokenExpires - 60_000) return accessTokenValue;
  const r = await fetch(oauth.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: oauth.client_id, client_secret: oauth.client_secret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const tok = await r.json();
  if (!tok.access_token) throw new Error(`Google sign-in failed: ${tok.error ?? r.status} ${tok.error_description ?? ''}`.trim());
  accessTokenValue = tok.access_token;
  tokenExpires = Date.now() + (tok.expires_in ?? 3600) * 1000;
  return accessTokenValue;
}

// ---------- Google Ads calls ----------
async function authHeaders() {
  const h = { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' };
  if (cfg.loginId) h['login-customer-id'] = cfg.loginId;
  return h;
}
async function gads(path, body) {
  const r = await fetch(`${BASE}/${path}`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body ?? {}) });
  const text = await r.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 2000) };
  }
  return { status: r.status, json };
}
const search = (cid, query) => gads(`customers/${cid}/googleAds:search`, { query });

/** Google's error codes in a failed reply, e.g. ["authorizationError: CUSTOMER_NOT_ENABLED"]. */
function errorCodes(json) {
  const out = [];
  for (const d of json?.error?.details ?? [])
    for (const e of d.errors ?? []) for (const [k, v] of Object.entries(e.errorCode ?? {})) out.push(`${k}: ${v}${e.message ? ` (${e.message})` : ''}`);
  if (!out.length && json?.error) out.push(`${json.error.status ?? 'ERROR'}: ${json.error.message ?? ''}`);
  return out;
}

/** Plain-English reading of an error that means the Cloud project may not touch real accounts yet. */
function accessHint(codes) {
  const t = codes.join(' ');
  if (/NOT_APPROVED|NOT_ALLOWED_FOR_PRODUCTION|ONLY_TEST_ACCOUNTS|TEST_ACCOUNT/i.test(t))
    return 'Cloud project is on Test access, so Google refuses real accounts. Apply for Explorer: Cloud Console → APIs & Services → Google Ads API → Overview.';
  if (/USER_PERMISSION_DENIED|CUSTOMER_NOT_FOUND/i.test(t)) return 'The signed-in Google user cannot open this account. Ask its owner to add you, or check the ID (and LIVE_LOGIN_CUSTOMER_ID if it sits under a manager).';
  return null;
}

const CUSTOMER_Q = 'SELECT customer.id, customer.descriptive_name, customer.test_account, customer.manager, customer.currency_code, customer.time_zone, customer.status FROM customer';
async function readAccount(cid) {
  const r = await search(cid, CUSTOMER_Q);
  const c = r.json.results?.[0]?.customer;
  if (r.status !== 200 || !c) {
    const codes = errorCodes(r.json);
    throw Object.assign(new Error(`Cannot read account ${cid}: HTTP ${r.status} ${codes.join('; ')}`), { http: r.status, google: r.json, codes });
  }
  currencyOf.set(cid, c.currencyCode);
  return c;
}
const currencyOf = new Map();

/** Throws unless the account is a Google Ads test account. Test mode: called at startup and before every write. */
async function assertTestAccount(cid) {
  const c = await readAccount(cid);
  if (c.testAccount !== true) throw new Error(`REFUSED: account ${cid} is not a Google Ads test account, so this server will not touch it.`);
  return c;
}

/** Test mode: both accounts must be test accounts. Live mode: the account must be on the allowlist and readable. */
async function guardWrites(cid) {
  if (!cfg.accounts.includes(cid)) throw refuse(403, `Account ${cid} is not on the allowlist, so this server will not touch it.`);
  if (!LIVE) {
    await assertTestAccount(cfg.managerId);
    return assertTestAccount(cid);
  }
  return readAccount(cid);
}

/** Which account a request is for: ?account= or body.account, else the first allowed one. Anything else is refused. */
function accountFor(url, body) {
  const raw = body?.account ?? url.searchParams.get('account');
  const cid = raw ? String(raw).replace(/-/g, '').trim() : cfg.accounts[0];
  if (!cfg.accounts.includes(cid)) throw refuse(403, `Account ${cid} is not on the allowlist (${LIVE ? 'LIVE_CUSTOMER_IDS' : 'CUSTOMER_ID'}), so this server will not touch it.`);
  return cid;
}

// ---------- helpers ----------
const micros = (n) => String(Math.round(n * 1_000_000));
const money = (m) => Math.round(Number(m ?? 0) / 10_000) / 100;
const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const quote = (s) => `'${String(s).replace(/'/g, "\\'")}'`;
const cur = (cid) => currencyOf.get(cid) ?? '';
const amt = (cid, n) => `${Number(n).toFixed(2)} ${cur(cid)}`.trim();

/** Trim big replies so the browser gets the useful part, not 50 KB of JSON. */
function trim(v, depth = 0) {
  if (Array.isArray(v)) return v.length > 12 ? [...v.slice(0, 12).map((x) => trim(x, depth + 1)), `… ${v.length - 12} more`] : v.map((x) => trim(x, depth + 1));
  if (v && typeof v === 'object') return depth > 7 ? '…' : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x, depth + 1)]));
  return typeof v === 'string' && v.length > 600 ? v.slice(0, 600) + '…' : v;
}

async function ourCampaigns(cid) {
  const r = await search(cid, `SELECT campaign.id, campaign.name, campaign.status, campaign.resource_name, campaign_budget.resource_name, campaign_budget.amount_micros, campaign.experiment_type FROM campaign WHERE campaign.name LIKE '${PREFIX}%' AND campaign.status != 'REMOVED' ORDER BY campaign.id DESC`);
  return (r.json.results ?? []).map((x) => ({ id: x.campaign.id, name: x.campaign.name, status: x.campaign.status, rn: x.campaign.resourceName, budgetRn: x.campaignBudget?.resourceName, daily: money(x.campaignBudget?.amountMicros), base: (x.campaign.experimentType ?? 'BASE') === 'BASE' }));
}

function daysLeftInMonth() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1;
}

/** Money spent this month across the whole account (all campaigns, any status). */
async function accountSpendThisMonth(cid) {
  const r = await search(cid, `SELECT metrics.cost_micros FROM customer WHERE segments.date DURING THIS_MONTH`);
  if (r.status !== 200) throw Object.assign(new Error(`Couldn't read this month's spend: ${errorCodes(r.json).join('; ')}`), { google: r.json });
  return money((r.json.results ?? []).reduce((s, x) => s + Number(x.metrics?.costMicros ?? 0), 0));
}

// ---------- cap log ----------
const LOG_DIR = resolve(HERE, 'logs');
const logFile = (d = new Date()) => resolve(LOG_DIR, `cap-${d.toISOString().slice(0, 7)}.jsonl`);
function logCap(entry) {
  mkdirSync(LOG_DIR, { recursive: true });
  appendFileSync(logFile(), redact(JSON.stringify({ time: new Date().toISOString(), mode: cfg.mode, ...entry })) + '\n');
}
function readCapLog(limit = 50) {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const lines = [];
  for (const f of [logFile(prev), logFile(now)]) if (existsSync(f)) lines.push(...readFileSync(f, 'utf8').split('\n').filter(Boolean));
  return lines
    .slice(-limit)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
}

// ---------- steps ----------
// Each takes the account id first and returns { ok, warn?, httpStatus, summary, google }. The router adds step + durationMs.
const steps = {
  async health() {
    await accessToken();
    const accounts = [];
    const google = {};
    let worst = 200;
    const hints = new Set();
    const list = LIVE ? [...(cfg.loginId ? [['manager', cfg.loginId]] : []), ...cfg.accounts.map((id) => ['account', id])] : [['manager', cfg.managerId], ['client', cfg.accounts[0]]];
    for (const [role, id] of list) {
      const r = await search(id, CUSTOMER_Q);
      const c = r.json.results?.[0]?.customer;
      google[`${role} ${id}`] = trim(r.json);
      if (r.status !== 200) worst = r.status;
      if (c) {
        currencyOf.set(id, c.currencyCode);
        accounts.push({ role, id: c.id, name: c.descriptiveName, testAccount: c.testAccount === true, manager: c.manager, currency: c.currencyCode, timeZone: c.timeZone, status: c.status });
      } else {
        const codes = errorCodes(r.json);
        const hint = accessHint(codes);
        if (hint) hints.add(hint);
        accounts.push({ role, id, error: codes, hint });
      }
    }
    const readable = accounts.every((a) => !a.error);
    const allTest = accounts.every((a) => a.testAccount);
    const realOk = LIVE && accounts.some((a) => !a.error && !a.testAccount);
    const accessLevel = hints.size
      ? [...hints].join(' ')
      : realOk
        ? 'Explorer or higher: a real (non-test) account answered.'
        : 'Not readable from the API. Working only with test accounts is consistent with Test access; a real account would be refused until Explorer or Basic access is approved.';
    const lastCap = readCapLog(1)[0] ?? null;
    return {
      ok: worst === 200 && readable && (LIVE || allTest),
      httpStatus: worst,
      mode: cfg.mode,
      allowlist: cfg.accounts,
      loginCustomerId: cfg.loginId,
      caps: { maxDailyBudget: cfg.maxDaily, monthlyCap: cfg.monthlyCap, capEveryHours: cfg.capEveryHours || null },
      summary: !readable
        ? `Problem: ${accounts.map((a) => (a.error ? `${a.role} ${a.id}: ${a.error.join('; ')}` : `${a.role} ${a.id} OK`)).join('; ')}`
        : LIVE
          ? `Signed in to Google. LIVE mode on ${accounts.filter((a) => a.role === 'account').map((a) => `${a.id} "${a.name}" (${a.testAccount ? 'test account' : 'real account'}, ${a.currency})`).join('; ')}. Max daily budget ${cfg.maxDaily}, monthly cap ${cfg.monthlyCap} per account.`
          : allTest
            ? `Signed in to Google. Both accounts are test accounts (${accounts.map((a) => `${a.role} ${a.id} "${a.name}", ${a.currency}`).join('; ')}).`
            : `Problem: ${accounts.map((a) => `${a.role} ${a.id} test=${a.testAccount}`).join('; ')}`,
      accounts,
      accessLevel,
      lastCap,
      google,
    };
  },

  async setup(cid) {
    await guardWrites(cid);
    const s = stamp();
    const C = `customers/${cid}`;
    const r = await gads(`${C}/googleAds:mutate`, {
      mutateOperations: [
        { campaignBudgetOperation: { create: { resourceName: `${C}/campaignBudgets/-1`, name: `${PREFIX}budget-${s}`, amountMicros: micros(1), deliveryMethod: 'STANDARD', explicitlyShared: false } } },
        {
          campaignOperation: {
            create: {
              resourceName: `${C}/campaigns/-2`,
              name: `${PREFIX}search-${s}`,
              status: 'PAUSED', // always: in live mode switching on is a separate, confirmed step
              advertisingChannelType: 'SEARCH',
              campaignBudget: `${C}/campaignBudgets/-1`,
              manualCpc: {},
              networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false },
              containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
            },
          },
        },
        { adGroupOperation: { create: { resourceName: `${C}/adGroups/-3`, name: `${PREFIX}adgroup-${s}`, campaign: `${C}/campaigns/-2`, status: 'ENABLED', type: 'SEARCH_STANDARD', cpcBidMicros: micros(0.5) } } },
        {
          adGroupAdOperation: {
            create: {
              adGroup: `${C}/adGroups/-3`,
              status: 'ENABLED',
              ad: {
                finalUrls: ['https://example.com'],
                responsiveSearchAd: {
                  headlines: [{ text: 'Local guitar lessons' }, { text: 'Learn guitar this month' }, { text: 'Beginner friendly classes' }],
                  descriptions: [{ text: 'Friendly teachers and small groups. Book a free first lesson.' }, { text: 'Lessons for every level, evenings and weekends.' }],
                },
              },
            },
          },
        },
        { adGroupCriterionOperation: { create: { adGroup: `${C}/adGroups/-3`, status: 'ENABLED', keyword: { text: 'guitar lessons', matchType: 'PHRASE' } } } },
        { adGroupCriterionOperation: { create: { adGroup: `${C}/adGroups/-3`, status: 'ENABLED', keyword: { text: 'beginner guitar classes', matchType: 'PHRASE' } } } },
      ],
    });
    const created = (r.json.mutateOperationResponses ?? []).map((x) => Object.values(x)[0]?.resourceName).filter(Boolean);
    const campaignId = created.find((rn) => rn.includes('/campaigns/'))?.split('/').pop();
    return {
      ok: r.status === 200,
      httpStatus: r.status,
      summary:
        r.status === 200
          ? `Created a ${amt(cid, 1)}/day budget, a PAUSED Search campaign, an ad group, a responsive search ad and 2 keywords (${created.length} items).`
          : `Google refused: ${errorCodes(r.json).join('; ')}`,
      campaignId,
      google: trim(r.json),
    };
  },

  async campaigns(cid) {
    if (!currencyOf.has(cid)) await readAccount(cid).catch(() => {});
    const r = await search(
      cid,
      `SELECT campaign.id, campaign.name, campaign.status, campaign.primary_status, campaign.primary_status_reasons, campaign.advertising_channel_type, campaign_budget.amount_micros, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM campaign WHERE segments.date DURING THIS_MONTH AND campaign.status != 'REMOVED'`,
    );
    // Rows with metrics only appear for campaigns that had any activity, so also list the campaigns themselves.
    const all = await search(cid, `SELECT campaign.id, campaign.name, campaign.status, campaign.primary_status, campaign.primary_status_reasons, campaign.advertising_channel_type, campaign.experiment_type, campaign_budget.amount_micros FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY campaign.id DESC`);
    const m = new Map((r.json.results ?? []).map((x) => [x.campaign.id, x.metrics]));
    const list = (all.json.results ?? []).map((x) => {
      const mt = m.get(x.campaign.id) ?? {};
      return {
        id: x.campaign.id,
        name: x.campaign.name,
        type: x.campaign.advertisingChannelType,
        status: x.campaign.status,
        primaryStatus: x.campaign.primaryStatus,
        primaryStatusReasons: x.campaign.primaryStatusReasons ?? [],
        dailyUsd: money(x.campaignBudget?.amountMicros), // in the account's currency; the name is kept for the browser code
        monthToDate: { spendUsd: money(mt.costMicros), clicks: Number(mt.clicks ?? 0), impressions: Number(mt.impressions ?? 0), conversions: Number(mt.conversions ?? 0) },
        experimentType: x.campaign.experimentType ?? 'BASE', // DRAFT / EXPERIMENT = a copy made by an experiment
        testCampaign: x.campaign.name.startsWith(PREFIX) && (x.campaign.experimentType ?? 'BASE') === 'BASE',
      };
    });
    const status = all.status !== 200 ? all.status : r.status;
    const codes = errorCodes(all.status !== 200 ? all.json : r.json);
    return {
      ok: status === 200,
      httpStatus: status,
      account: cid,
      currency: cur(cid),
      summary: status === 200 ? `Read ${list.length} campaign(s) with status, Google's own status and this month's spend, clicks and conversions.` : `Google refused: ${codes.join('; ')}${accessHint(codes) ? ` ${accessHint(codes)}` : ''}`,
      campaigns: list,
      google: trim(all.json),
    };
  },

  async setStatus(cid, { id, status, confirm }) {
    if (!['PAUSED', 'ENABLED'].includes(status)) return { ok: false, httpStatus: 400, summary: 'Status must be PAUSED or ENABLED.' };
    await guardWrites(cid);
    if (LIVE && status === 'ENABLED') {
      if (confirm !== `ENABLE ${id}`) throw refuse(409, `Live account: switching campaign ${id} on can spend real money. Confirm by sending confirm "ENABLE ${id}".`);
      const spent = await accountSpendThisMonth(cid);
      if (spent >= cfg.monthlyCap) throw refuse(409, `Live account: ${amt(cid, spent)} already spent this month, which reaches the ${amt(cid, cfg.monthlyCap)} monthly cap. Campaigns stay paused until next month or a higher MONTHLY_CAP.`);
    }
    const r = await gads(`customers/${cid}/campaigns:mutate`, { operations: [{ update: { resourceName: `customers/${cid}/campaigns/${id}`, status }, updateMask: 'status' }] });
    const back = await search(cid, `SELECT campaign.status FROM campaign WHERE campaign.id = ${Number(id)}`);
    const now = back.json.results?.[0]?.campaign?.status;
    return {
      ok: r.status === 200 && now === status,
      httpStatus: r.status,
      summary: r.status === 200 ? `Campaign ${id} set to ${status}; reading it back from Google says ${now}.` : `Google refused: ${errorCodes(r.json).join('; ')}`,
      google: trim(r.json),
    };
  },

  async setBudget(cid, { id, dailyUsd }) {
    const amount = Number(dailyUsd);
    if (!(amount > 0)) return { ok: false, httpStatus: 400, summary: 'Daily budget must be more than 0.' };
    if (amount > cfg.maxDaily) throw refuse(400, `Refused by our server: daily budgets are capped at ${amt(cid, cfg.maxDaily)}${LIVE ? ' (MAX_DAILY_BUDGET)' : ' on the test account'}.`);
    await guardWrites(cid);
    return writeBudget(cid, id, amount);
  },

  async ads(cid) {
    const r = await search(cid, `SELECT campaign.name, ad_group_ad.ad.id, ad_group_ad.status, ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status, ad_group_ad.ad_strength FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED' AND campaign.status != 'REMOVED'`);
    const ads = (r.json.results ?? []).map((x) => ({ campaign: x.campaign.name, adId: x.adGroupAd.ad.id, status: x.adGroupAd.status, approval: x.adGroupAd.policySummary?.approvalStatus, review: x.adGroupAd.policySummary?.reviewStatus, adStrength: x.adGroupAd.adStrength }));
    return {
      ok: r.status === 200,
      httpStatus: r.status,
      summary: r.status === 200 ? `Read ${ads.length} ad(s): ${ads.slice(0, 3).map((a) => `approval ${a.approval ?? '—'}, review ${a.review ?? '—'}, strength ${a.adStrength ?? '—'}`).join('; ')}` : `Google refused: ${errorCodes(r.json).join('; ')}`,
      ads,
      google: trim(r.json),
    };
  },

  async keywords(cid) {
    const r = await search(cid, `SELECT campaign.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ad_group_criterion.quality_info.quality_score FROM keyword_view WHERE ad_group_criterion.status != 'REMOVED' AND campaign.status != 'REMOVED'`);
    const kws = (r.json.results ?? []).map((x) => ({ campaign: x.campaign.name, text: x.adGroupCriterion.keyword.text, matchType: x.adGroupCriterion.keyword.matchType, status: x.adGroupCriterion.status, qualityScore: x.adGroupCriterion.qualityInfo?.qualityScore ?? null }));
    const scored = kws.filter((k) => k.qualityScore != null).length;
    return {
      ok: r.status === 200,
      warn: r.status === 200 && kws.length > 0 && scored === 0,
      httpStatus: r.status,
      summary:
        r.status === 200
          ? `Read ${kws.length} keyword(s). ${scored ? `${scored} have a Quality Score.` : `None has a Quality Score yet: Google only scores keywords after they get impressions${LIVE ? '.' : ', which test accounts never do.'}`}`
          : `Google refused: ${errorCodes(r.json).join('; ')}`,
      keywords: kws,
      google: trim(r.json),
    };
  },

  async conversions(cid) {
    const t = await search(cid, 'SELECT customer.conversion_tracking_setting.conversion_tracking_status, customer.conversion_tracking_setting.conversion_tracking_id FROM customer');
    const a = await search(cid, "SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.type, conversion_action.category FROM conversion_action WHERE conversion_action.status != 'REMOVED'");
    const setting = t.json.results?.[0]?.customer?.conversionTrackingSetting ?? {};
    const actions = (a.json.results ?? []).map((x) => ({ id: x.conversionAction.id, name: x.conversionAction.name, status: x.conversionAction.status, type: x.conversionAction.type, category: x.conversionAction.category }));
    const status = t.status !== 200 ? t.status : a.status;
    return {
      ok: status === 200,
      httpStatus: status,
      summary: status === 200 ? `Conversion tracking status: ${setting.conversionTrackingStatus ?? 'not reported'}. ${actions.length} conversion action(s) set up.` : `Google refused: ${errorCodes(t.status !== 200 ? t.json : a.json).join('; ')}`,
      setting,
      actions,
      google: trim({ setting: t.json, actions: a.json }),
    };
  },

  // Our own monthly cap: Google has no monthly cap field, so we read spend so far this month and act on it.
  async capCheck(cid, body) {
    return LIVE ? capAccount(cid, { ...body, source: body.source ?? 'manual' }) : capTestCampaigns(cid, body);
  },

  async capLog() {
    const entries = readCapLog(50);
    return { ok: true, httpStatus: 200, summary: `${entries.length} cap decision(s) logged.`, entries };
  },

  async experiments(cid, body = {}) {
    await guardWrites(cid);
    const camps = await ourCampaigns(cid);
    const base = body.campaignId ? camps.find((c) => c.id === String(body.campaignId) && c.base) : camps.find((c) => c.base && c.name.includes('-search-'));
    if (!base) return { ok: false, httpStatus: 400, summary: `No ${PREFIX} Search campaign to experiment on. Run setup first.` };
    const s = stamp();
    const out = { google: {} };
    // 1) the experiment itself
    const e = await gads(`customers/${cid}/experiments:mutate`, {
      operations: [{ create: { name: `${PREFIX}experiment-${s}`, description: 'API check: budget test', suffix: `[ae-${s.slice(-6)}]`, type: 'SEARCH_CUSTOM', status: 'SETUP' } }],
    });
    out.google.createExperiment = trim(e.json);
    const expRn = e.json.results?.[0]?.resourceName;
    if (e.status !== 200 || !expRn) return { ok: false, httpStatus: e.status, summary: `Creating the experiment was refused: ${errorCodes(e.json).join('; ')}`, google: out.google };
    // 2) control + treatment arms; Google creates a draft copy of the campaign for the treatment arm
    const a = await gads(`customers/${cid}/experimentArms:mutate`, {
      operations: [
        { create: { experiment: expRn, name: 'control', control: true, trafficSplit: 50, campaigns: [base.rn] } },
        { create: { experiment: expRn, name: 'treatment', control: false, trafficSplit: 50 } },
      ],
      responseContentType: 'MUTABLE_RESOURCE',
    });
    out.google.createArms = trim(a.json);
    if (a.status !== 200) return { ok: false, httpStatus: a.status, summary: `Experiment created, but adding its two arms was refused: ${errorCodes(a.json).join('; ')}`, google: out.google };
    // 3) read back
    const rb = await search(cid, `SELECT experiment.name, experiment.status, experiment.type, experiment_arm.name, experiment_arm.control, experiment_arm.traffic_split, experiment_arm.in_design_campaigns FROM experiment_arm WHERE experiment.resource_name = ${quote(expRn)}`);
    out.google.readBack = trim(rb.json);
    const arms = (rb.json.results ?? []).map((x) => ({ name: x.experimentArm.name, control: x.experimentArm.control, split: x.experimentArm.trafficSplit, draftCampaigns: x.experimentArm.inDesignCampaigns ?? [] }));
    // 4) schedule. Live mode: only with the same confirmation as switching a campaign on, because it starts serving.
    let scheduleNote;
    let warn = false;
    if (LIVE && body.confirm !== `ENABLE ${base.id}`) {
      warn = true;
      scheduleNote = `Not scheduled: in live mode scheduling starts the experiment and can spend money. Confirm with confirm "ENABLE ${base.id}".`;
    } else {
      const sc = await gads(`${expRn}:scheduleExperiment`, {});
      out.google.schedule = trim(sc.json);
      if (sc.status === 200) {
        // Scheduling is a long-running operation; check where it got to.
        const opName = sc.json.name;
        let op = sc.json;
        for (let i = 0; i < 5 && opName && !op.done; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const g = await fetch(`${BASE}/${opName}`, { headers: await authHeaders() });
          op = await g.json();
        }
        out.google.scheduleOperation = trim(op);
        const st = await search(cid, `SELECT experiment.status FROM experiment WHERE experiment.resource_name = ${quote(expRn)}`);
        scheduleNote = op.error ? `Scheduling was accepted, then failed: ${op.error.message ?? JSON.stringify(op.error)}.` : `Scheduling accepted${op.done ? '' : ' (still running)'}; experiment status is now ${st.json.results?.[0]?.experiment?.status ?? 'unknown'}.`;
      } else {
        warn = true;
        scheduleNote = `Scheduling refused: ${errorCodes(sc.json).join('; ')}.`;
      }
    }
    return {
      ok: arms.length === 2,
      warn,
      httpStatus: rb.status,
      summary: `Created experiment "${PREFIX}experiment-${s}" with ${arms.length} arms (control = ${base.name}, treatment = a draft copy Google made). ${scheduleNote}`,
      experiment: expRn,
      arms,
      google: out.google,
    };
  },

  async keywordIdeas(cid) {
    const r = await gads(`customers/${cid}:generateKeywordIdeas`, {
      language: 'languageConstants/1000', // English
      geoTargetConstants: ['geoTargetConstants/2840'], // United States
      keywordPlanNetwork: 'GOOGLE_SEARCH',
      keywordSeed: { keywords: ['guitar lessons'] },
      pageSize: 10,
    });
    const ideas = (r.json.results ?? []).map((x) => ({ text: x.text, avgMonthlySearches: x.keywordIdeaMetrics?.avgMonthlySearches ?? null, lowBid: money(x.keywordIdeaMetrics?.lowTopOfPageBidMicros), highBid: money(x.keywordIdeaMetrics?.highTopOfPageBidMicros) }));
    const withVolume = ideas.filter((i) => i.avgMonthlySearches != null).length;
    return {
      ok: r.status === 200,
      warn: r.status !== 200 || ideas.length === 0 || withVolume === 0,
      httpStatus: r.status,
      summary:
        r.status !== 200
          ? `Google refused: ${errorCodes(r.json).join('; ')}.${LIVE ? ' Explorer access blocks the planning tools on real accounts; they need Basic access.' : ''}`
          : ideas.length === 0
            ? 'Google answered but returned no keyword ideas.'
            : `Google returned ${ideas.length} idea(s); ${withVolume} with search volume.`,
      ideas,
      google: trim(r.json),
    };
  },

  async cleanup(cid) {
    if (LIVE) throw refuse(403, 'Clean up is disabled in live mode: this server never removes anything from a real account. Pause campaigns instead, or remove them in Google Ads yourself.');
    await guardWrites(cid);
    const removed = [];
    // experiments first: their draft campaigns go with them
    const ex = await search(cid, `SELECT experiment.resource_name, experiment.name, experiment.status FROM experiment WHERE experiment.name LIKE '${PREFIX}%'`);
    const exps = (ex.json.results ?? []).map((x) => x.experiment).filter((x) => x.status !== 'REMOVED');
    const google = { experiments: trim(ex.json) };
    if (exps.length) {
      const r = await gads(`customers/${cid}/experiments:mutate`, { operations: exps.map((x) => ({ remove: x.resourceName })) });
      google.removeExperiments = trim(r.json);
      if (r.status === 200) removed.push(`${exps.length} experiment(s)`);
      else removed.push(`experiments NOT removed (${errorCodes(r.json).join('; ')})`);
    }
    const camps = (await ourCampaigns(cid)).filter((c) => c.base);
    if (camps.length) {
      const r = await gads(`customers/${cid}/campaigns:mutate`, { operations: camps.map((c) => ({ remove: c.rn })), partialFailure: true });
      google.removeCampaigns = trim(r.json);
      const failed = errorCodes(r.json.partialFailureError ? { error: r.json.partialFailureError } : r.status !== 200 ? r.json : {});
      removed.push(r.status === 200 ? `${camps.length - (failed.length ? 1 : 0)} campaign(s)${failed.length ? `; some failed: ${failed.join('; ')}` : ''}` : `campaigns NOT removed (${failed.join('; ')})`);
    }
    const left = (await ourCampaigns(cid)).filter((c) => c.base);
    return {
      ok: left.length === 0,
      httpStatus: 200,
      summary: removed.length ? `Removed ${removed.join(' and ')}. ${left.length ? `${left.length} ${PREFIX} campaign(s) still there.` : `No ${PREFIX} campaigns left.`}` : 'Nothing to clean up.',
      google,
    };
  },
};

/** Sets a campaign's daily budget (no max check: callers decide) and reads it back. */
async function writeBudget(cid, id, amount) {
  const q = await search(cid, `SELECT campaign_budget.resource_name FROM campaign WHERE campaign.id = ${Number(id)}`);
  const rn = q.json.results?.[0]?.campaignBudget?.resourceName;
  if (!rn) return { ok: false, httpStatus: q.status, summary: `Couldn't find the budget for campaign ${id}.`, google: trim(q.json) };
  const r = await gads(`customers/${cid}/campaignBudgets:mutate`, { operations: [{ update: { resourceName: rn, amountMicros: micros(amount) }, updateMask: 'amount_micros' }] });
  const back = await search(cid, `SELECT campaign_budget.amount_micros FROM campaign WHERE campaign.id = ${Number(id)}`);
  const now = money(back.json.results?.[0]?.campaignBudget?.amountMicros);
  return {
    ok: r.status === 200 && now === Math.round(amount * 100) / 100,
    httpStatus: r.status,
    summary: r.status === 200 ? `Daily budget of campaign ${id} set to ${amt(cid, amount)}; Google now reports ${amt(cid, now)}.` : `Google refused: ${errorCodes(r.json).join('; ')}`,
    google: trim(r.json),
  };
}

/** Test mode cap: per ae-apitest- campaign, against the cap the API check page sends. */
async function capTestCampaigns(cid, { monthlyCapUsd, apply }) {
  const cap = Number(monthlyCapUsd);
  if (!(cap >= 0)) return { ok: false, httpStatus: 400, summary: 'monthlyCapUsd must be a number.' };
  const r = await search(cid, `SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros, metrics.cost_micros FROM campaign WHERE segments.date DURING THIS_MONTH AND campaign.name LIKE '${PREFIX}%' AND campaign.status != 'REMOVED'`);
  if (r.status !== 200) return { ok: false, httpStatus: r.status, summary: `Google refused: ${errorCodes(r.json).join('; ')}`, google: trim(r.json) };
  const spend = new Map((r.json.results ?? []).map((x) => [x.campaign.id, money(x.metrics.costMicros)]));
  const camps = (await ourCampaigns(cid)).filter((c) => c.base);
  const daysLeft = daysLeftInMonth();
  const decisions = camps.map((c) => {
    const spent = spend.get(c.id) ?? 0;
    const remaining = Math.max(0, cap - spent);
    // Google may spend up to 2x the daily budget on one day, so we act early: keep daily budget ≤ remaining ÷ days left.
    const safeDaily = Math.floor((remaining / daysLeft) * 100) / 100;
    let action = 'none';
    if (remaining <= 0) action = 'pause';
    else if (c.daily > safeDaily) action = 'lower-budget';
    return { id: c.id, name: c.name, status: c.status, spentUsd: spent, capUsd: cap, remainingUsd: Math.round(remaining * 100) / 100, daysLeft, dailyUsd: c.daily, safeDailyUsd: safeDaily, action };
  });
  const applied = [];
  if (apply) {
    for (const d of decisions) {
      if (d.action === 'pause' && d.status !== 'PAUSED') applied.push({ id: d.id, ...(await steps.setStatus(cid, { id: d.id, status: 'PAUSED' })) });
      if (d.action === 'pause' && d.status === 'PAUSED') applied.push({ id: d.id, ok: true, skipped: true, summary: 'Already paused, nothing to change.' });
      if (d.action === 'lower-budget') applied.push({ id: d.id, ...(await steps.setBudget(cid, { id: d.id, dailyUsd: Math.max(0.01, d.safeDailyUsd) })) });
    }
  }
  const describe = (d) => (d.action === 'none' ? `${d.name}: $${d.spentUsd} spent of $${d.capUsd}, no action` : d.action === 'pause' ? `${d.name}: cap reached, pause` : `${d.name}: lower daily budget $${d.dailyUsd} → $${d.safeDailyUsd}`);
  const allApplied = applied.every((a) => a.ok);
  if (apply) logCap({ account: cid, source: 'api-check', cap, decisions: decisions.map(({ id, name, spentUsd, action, dailyUsd, safeDailyUsd }) => ({ id, name, spent: spentUsd, action, from: dailyUsd, to: action === 'lower-budget' ? safeDailyUsd : null })), applied: applied.map((a) => ({ id: a.id, ok: a.ok, summary: a.summary })) });
  return {
    ok: !apply || allApplied,
    httpStatus: 200,
    summary: decisions.length
      ? `${apply ? 'Applied' : 'Dry run'} with a $${cap} monthly cap, ${daysLeft} day(s) left: ${decisions.map(describe).join('; ')}.${apply && applied.some((a) => !a.skipped) ? ` ${applied.filter((a) => a.ok && !a.skipped).length} of ${applied.filter((a) => !a.skipped).length} change(s) confirmed by Google.` : apply && applied.length ? ' Nothing to change.' : ''}`
      : `No ${PREFIX} campaigns to check. Run setup first.`,
    decisions,
    applied,
    google: trim(r.json),
  };
}

/**
 * Live mode cap: one monthly cap per account. Reads the whole account's spend this month and the running campaigns'
 * daily budgets, then keeps their total at or below remaining ÷ (days left + 1). The extra day leaves room for one
 * day of Google spending up to 2x the daily budget. At the cap, every running campaign is paused.
 */
async function capAccount(cid, { monthlyCapUsd, apply, source }) {
  const asked = monthlyCapUsd == null || monthlyCapUsd === '' ? NaN : Number(monthlyCapUsd);
  const cap = Number.isFinite(asked) && asked >= 0 ? Math.min(asked, cfg.monthlyCap) : cfg.monthlyCap; // a request can lower the cap, never raise it
  await guardWrites(cid);
  const spent = await accountSpendThisMonth(cid);
  const r = await search(cid, `SELECT campaign.id, campaign.name, campaign.status, campaign_budget.resource_name, campaign_budget.amount_micros, campaign_budget.explicitly_shared FROM campaign WHERE campaign.status = 'ENABLED'`);
  if (r.status !== 200) return { ok: false, httpStatus: r.status, summary: `Google refused: ${errorCodes(r.json).join('; ')}`, google: trim(r.json) };
  const running = (r.json.results ?? []).map((x) => ({ id: x.campaign.id, name: x.campaign.name, budgetRn: x.campaignBudget?.resourceName, daily: money(x.campaignBudget?.amountMicros), shared: !!x.campaignBudget?.explicitlyShared }));
  const budgets = new Map(running.map((c) => [c.budgetRn, c.daily])); // a shared budget counts once
  const totalDaily = [...budgets.values()].reduce((a, b) => a + b, 0);
  const daysLeft = daysLeftInMonth();
  const remaining = Math.max(0, Math.round((cap - spent) * 100) / 100);
  const safeTotal = Math.floor((remaining / (daysLeft + 1)) * 100) / 100;
  let action = 'none';
  if (running.length && (remaining <= 0 || safeTotal < 0.01)) action = 'pause';
  else if (running.length && totalDaily > safeTotal) action = 'lower-budget';
  const factor = totalDaily > 0 ? safeTotal / totalDaily : 1;
  const plan = running.map((c) => ({ ...c, to: action === 'lower-budget' ? Math.max(0.01, Math.floor(c.daily * factor * 100) / 100) : null }));
  const applied = [];
  if (apply && action === 'pause') for (const c of plan) applied.push({ id: c.id, ...(await steps.setStatus(cid, { id: c.id, status: 'PAUSED' })) });
  if (apply && action === 'lower-budget') {
    const done = new Set();
    for (const c of plan) {
      if (done.has(c.budgetRn)) continue;
      done.add(c.budgetRn);
      applied.push({ id: c.id, ...(await writeBudget(cid, c.id, c.to)) });
    }
  }
  const ok = !apply || applied.every((a) => a.ok);
  const summary =
    action === 'none'
      ? `${amt(cid, spent)} spent of the ${amt(cid, cap)} monthly cap, ${daysLeft} day(s) left; ${running.length} running campaign(s) with ${amt(cid, totalDaily)}/day in total, within the safe ${amt(cid, safeTotal)}/day. No action.`
      : action === 'pause'
        ? `${amt(cid, spent)} spent of the ${amt(cid, cap)} monthly cap: cap reached, ${apply ? 'paused' : 'would pause'} ${running.length} running campaign(s).`
        : `${amt(cid, spent)} spent of the ${amt(cid, cap)} monthly cap, ${daysLeft} day(s) left: ${apply ? 'lowered' : 'would lower'} daily budgets from ${amt(cid, totalDaily)} to ${amt(cid, safeTotal)} in total (${plan.map((c) => `${c.name} ${c.daily} → ${c.to}`).join('; ')}).`;
  logCap({ account: cid, source, apply: !!apply, cap, spent, remaining, daysLeft, totalDaily, safeTotal, action, campaigns: plan.map(({ id, name, daily, to, shared }) => ({ id, name, from: daily, to, shared })), applied: applied.map((a) => ({ id: a.id, ok: a.ok, summary: a.summary })), summary });
  return { ok, httpStatus: 200, summary: (apply ? '' : 'Dry run: ') + summary, action, spent, remaining, daysLeft, totalDaily, safeTotal, campaigns: plan, applied };
}

// ---------- http ----------
const ROUTES = [
  ['GET', /^\/api\/health$/, 'health', () => steps.health()],
  ['POST', /^\/api\/setup$/, 'setup', (cid) => steps.setup(cid)],
  ['GET', /^\/api\/campaigns$/, 'campaigns', (cid) => steps.campaigns(cid)],
  ['POST', /^\/api\/campaigns\/(\d+)\/status$/, 'status', (cid, m, b) => steps.setStatus(cid, { id: m[1], status: b.status, confirm: b.confirm })],
  ['POST', /^\/api\/campaigns\/(\d+)\/budget$/, 'budget', (cid, m, b) => steps.setBudget(cid, { id: m[1], dailyUsd: b.dailyUsd })],
  ['GET', /^\/api\/ads$/, 'ads', (cid) => steps.ads(cid)],
  ['GET', /^\/api\/keywords$/, 'keywords', (cid) => steps.keywords(cid)],
  ['GET', /^\/api\/conversions$/, 'conversions', (cid) => steps.conversions(cid)],
  ['POST', /^\/api\/cap-check$/, 'cap-check', (cid, m, b) => steps.capCheck(cid, b)],
  ['GET', /^\/api\/cap-log$/, 'cap-log', () => steps.capLog()],
  ['POST', /^\/api\/experiments$/, 'experiments', (cid, m, b) => steps.experiments(cid, b)],
  ['GET', /^\/api\/keyword-ideas$/, 'keyword-ideas', (cid) => steps.keywordIdeas(cid)],
  ['POST', /^\/api\/cleanup$/, 'cleanup', (cid) => steps.cleanup(cid)],
  ...(meta?.routes ?? [['GET', /^\/api\/meta\/health$/, 'meta-health', () => ({ ok: !metaProblem, enabled: false, httpStatus: 200, summary: metaProblem ? `Meta is switched on but not set up: ${redact(metaProblem)}` : 'Meta ads are not connected (META_ENABLED is off).' })]]),
];

function send(res, code, obj) {
  const body = redact(JSON.stringify(obj));
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (await gate(req, res, url)) return;
  if (!url.pathname.startsWith('/api/')) return serveDashboard(req, res, url, resolve(HERE, '..', 'dist'));
  const route = ROUTES.find(([m, re]) => m === req.method && re.test(url.pathname));
  if (!route) return send(res, 404, { ok: false, summary: `No such endpoint: ${req.method} ${url.pathname}` });
  let body = {};
  if (req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return send(res, 400, { ok: false, summary: 'Body must be JSON.' });
    }
  }
  const t0 = Date.now();
  try {
    const cid = accountFor(url, body);
    const out = await route[3](cid, url.pathname.match(route[1]), body, url);
    const result = { step: route[2], durationMs: Date.now() - t0, ...out };
    console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${url.pathname} → ${out.ok ? 'ok' : 'FAILED'} (${result.durationMs} ms)`);
    send(res, 200, result);
  } catch (err) {
    const msg = redact(err?.message ?? String(err));
    console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${url.pathname} → ${err?.httpCode ? `REFUSED ${err.httpCode}` : 'ERROR'} ${msg}`);
    send(res, err?.httpCode ?? 200, { ok: false, refused: !!err?.httpCode, step: route[2], durationMs: Date.now() - t0, httpStatus: err?.httpCode ?? err?.http ?? 0, summary: msg, google: err?.google ? trim(err.google) : undefined });
  }
});

server.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') throw err;
  console.error(`Port ${cfg.port} is already in use: an earlier run is still open. Close that terminal (or press Ctrl+C in it) and start again.`);
  process.exit(1);
});

/** Live mode: the monthly cap runs on its own, first shortly after start, then every CAP_EVERY_HOURS. */
function startCapJob() {
  const run = async () => {
    for (const cid of cfg.accounts) {
      try {
        const r = await capAccount(cid, { apply: true, source: 'auto' });
        console.log(`${new Date().toISOString().slice(11, 19)} cap check ${cid} → ${r.summary}`);
      } catch (err) {
        const msg = redact(err?.message ?? String(err));
        logCap({ account: cid, source: 'auto', action: 'error', summary: msg });
        console.log(`${new Date().toISOString().slice(11, 19)} cap check ${cid} → ERROR ${msg}`);
      }
    }
  };
  setTimeout(run, cfg.capFirstRunSeconds * 1000);
  setInterval(run, cfg.capEveryHours * 3_600_000);
}

if (metaProblem) console.log(`Meta ads NOT connected: ${redact(metaProblem)}`);
if (meta) {
  meta.steps.health().then((h) => console.log(redact(`Meta ads: ${h.summary}`)));
  meta.startCapJob((id, err) => console.log(redact(`Meta cap check ${id} → ERROR ${err.message}`)));
}

try {
  if (!LIVE) {
    // Refuse to start unless both accounts are test accounts.
    const m = await assertTestAccount(cfg.managerId);
    const c = await assertTestAccount(cfg.accounts[0]);
    server.listen(cfg.port, hosting.host, () => {
      console.log(`Google Ads TEST server on http://${hosting.host}:${cfg.port}`);
      console.log(`  manager ${m.id} "${m.descriptiveName}" (test account)`);
      console.log(`  client  ${c.id} "${c.descriptiveName}" (test account, ${c.currencyCode})`);
    });
  } else {
    await accessToken();
    console.log('*** LIVE MODE: real Google Ads accounts. Campaigns that run spend real money. ***');
    for (const cid of cfg.accounts) {
      try {
        const c = await readAccount(cid);
        console.log(`  account ${c.id} "${c.descriptiveName}" · ${c.testAccount ? 'TEST account' : 'real account'} · ${c.currencyCode}`);
      } catch (err) {
        console.log(`  account ${cid}: CANNOT READ · ${redact(err.message)}`);
        const hint = accessHint(err.codes ?? []);
        if (hint) console.log(`    → ${hint}`);
      }
    }
    console.log(`  login-customer-id: ${cfg.loginId ?? '(none)'} · max daily budget ${cfg.maxDaily} · monthly cap ${cfg.monthlyCap} per account · cap check every ${cfg.capEveryHours} h`);
    server.listen(cfg.port, hosting.host, () => {
      console.log(`Google Ads LIVE server on http://${hosting.host}:${cfg.port}`);
      startCapJob();
    });
  }
} catch (err) {
  console.error('Not starting:', redact(err?.message ?? String(err)));
  if (/invalid_grant/.test(String(err?.message))) console.error('The saved Google login has expired. Run: npm run login');
  process.exit(1);
}
