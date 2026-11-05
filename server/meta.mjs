// PROTOTYPE: the Meta (Facebook and Instagram) ads connection, built from Meta's own docs and switched OFF until
// META_ENABLED=true in server/.env.local. gads-server.mjs serves these routes under /api/meta/. The token stays on this
// machine and is never printed or sent to the browser.
//
// What the docs say, and what follows from it here:
// - Budgets are in the currency's smallest unit (cents for USD), and a few currencies have no smaller unit.
//   https://developers.facebook.com/docs/marketing-api/bidding/overview/budgets
//   https://developers.facebook.com/docs/marketing-api/currencies
// - A campaign needs special_ad_categories; only ACTIVE and PAUSED are valid at creation; v17+ uses OUTCOME_* objectives.
//   https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/
// - An ad account has no field that says "this is a sandbox", so, unlike Google Ads, the server can't check it. The
//   allowlist (META_AD_ACCOUNT_IDS) is the only guard on which account is touched.
//   https://developers.facebook.com/docs/marketing-api/reference/ad-account/
// - Meta has no monthly limit on a budget, so the monthly cap is ours. Its pages disagree on a day's overspend: 25% in
//   the developer docs (budgets link above), 75% on https://www.facebook.com/business/ads/pricing. We assume the worse.
// - Errors: https://developers.facebook.com/docs/graph-api/guides/error-handling/
//   Rate limits: https://developers.facebook.com/docs/graph-api/overview/rate-limiting/

export const META_VERSION = 'v26.0'; // https://developers.facebook.com/docs/graph-api/changelog/
const GRAPH = 'https://graph.facebook.com';
export const PREFIX = 'ae-meta-';
export const WORST_DAY = 1.75; // the most a budget can spend in a day, as a share of itself (see above)
const NO_SUBUNIT = new Set(['CLP', 'COP', 'CRC', 'HUF', 'ISK', 'IDR', 'JPY', 'KRW', 'PYG', 'TWD', 'VND']);
const MAX_PAGES = 20;
const ACCOUNT_STATUS = { 1: 'active', 2: 'disabled', 3: 'unsettled', 7: 'pending risk review', 8: 'pending settlement', 9: 'in grace period', 100: 'pending closure', 101: 'closed', 201: 'any active', 202: 'any closed' };

export const offsetOf = (currency) => (NO_SUBUNIT.has(currency) ? 1 : 100);
export const toMinor = (amount, currency) => Math.round(Number(amount) * offsetOf(currency));
export const fromMinor = (minor, currency) => Number(minor ?? 0) / offsetOf(currency);

const refuse = (httpCode, msg) => Object.assign(new Error(msg), { httpCode });
const digits = (s) => String(s ?? '').replace(/^act_/, '').replace(/[-\s]/g, '');

/** Reads the META_* settings. Returns { enabled: false } unless META_ENABLED=true, and then nothing else is looked at. */
export function metaConfig(env, path = (p) => p) {
  if (String(env.META_ENABLED).toLowerCase() !== 'true') return { enabled: false };
  const mode = (env.META_MODE || 'sandbox').toLowerCase();
  if (mode !== 'sandbox' && mode !== 'live') throw new Error(`META_MODE must be sandbox or live, not "${env.META_MODE}"`);
  const accounts = String(env.META_AD_ACCOUNT_IDS ?? '').split(',').map(digits).filter(Boolean);
  if (!accounts.length) throw new Error('META_ENABLED=true needs at least one account in META_AD_ACCOUNT_IDS.');
  if (!env.META_TOKEN_FILE) throw new Error('META_ENABLED=true needs META_TOKEN_FILE.');
  const num = (k, d) => {
    const n = Number(env[k] || d);
    if (!(n > 0)) throw new Error(`${k} must be a number above 0`);
    return n;
  };
  const graphBase = env.META_GRAPH_BASE || GRAPH;
  if (graphBase !== GRAPH && !graphBase.startsWith('http://127.0.0.1:')) throw new Error('META_GRAPH_BASE may only point at this computer (for tests).');
  return {
    enabled: true,
    mode,
    accounts,
    tokenFile: path(env.META_TOKEN_FILE),
    appSecretFile: env.META_APP_SECRET_FILE ? path(env.META_APP_SECRET_FILE) : null,
    pageId: digits(env.META_PAGE_ID) || null,
    link: env.META_LINK || 'https://example.com',
    maxDaily: num('META_MAX_DAILY_BUDGET', 10),
    monthlyCap: num('META_MONTHLY_CAP', 20),
    capEveryHours: num('META_CAP_EVERY_HOURS', 2),
    capFirstRunSeconds: num('META_CAP_FIRST_RUN_SECONDS', 60),
    graphBase,
  };
}

/** Plain-English next step for an error code from Meta's error-handling and rate-limiting pages. */
export function hintFor(code) {
  if (code === 190 || code === 102) return 'The Meta token has expired or was revoked. Make a new one and save it to META_TOKEN_FILE.';
  if (code === 10 || (code >= 200 && code <= 299)) return 'The token lacks a permission, or this user or app has no access to the account. It needs ads_management and ads_read.';
  if (code === 4 || code === 17 || code === 341 || code === 80000 || code === 80004) return 'Meta is rate-limiting us. Stop calling for a while: more calls make the wait longer.';
  if (code === 368) return 'Meta has temporarily blocked this for a policy violation. Wait, then try again.';
  if (code === 1 || code === 2) return 'A temporary problem at Meta. Wait, then try again.';
  return null;
}

export function createMeta({ cfg, token, appSecretProof = null, fetchImpl = fetch, now = () => new Date(), logCap = () => {}, readCapLog = () => [] }) {
  const base = `${cfg.graphBase}/${META_VERSION}`;

  async function graph(method, path, params = {}, { idempotencyKey } = {}) {
    const all = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) all.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    all.set('access_token', token);
    if (appSecretProof) all.set('appsecret_proof', appSecretProof);
    const res = await fetchImpl(method === 'GET' ? `${base}/${path}?${all}` : `${base}/${path}`, {
      method,
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/x-www-form-urlencoded', ...(idempotencyKey ? { 'X-Client-Idempotent-Key': idempotencyKey } : {}) },
      body: method === 'GET' ? undefined : all.toString(),
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    if (!res.ok || json.error) {
      const e = json.error ?? {};
      const hint = hintFor(e.code);
      throw Object.assign(new Error(`Meta said: ${e.error_user_msg || e.message || `HTTP ${res.status}`}${e.code ? ` (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ''})` : ''}${hint ? ` ${hint}` : ''}`), { http: res.status, code: e.code, google: json });
    }
    return json;
  }

  /** Every row of a list. Too many to read is an error: a cap that saw only part of an account would be wrong. */
  async function graphAll(path, params) {
    const rows = [];
    let after;
    for (let page = 0; page < MAX_PAGES; page++) {
      const r = await graph('GET', path, { limit: 200, ...params, after });
      rows.push(...(r.data ?? []));
      if (!r.paging?.next || !r.paging?.cursors?.after) return rows;
      after = r.paging.cursors.after;
    }
    throw new Error(`More than ${MAX_PAGES} pages of ${path}; stopped rather than work from part of the list.`);
  }

  const accountFor = (url, body) => {
    const raw = body?.metaAccount ?? url?.searchParams?.get('metaAccount');
    const id = raw ? digits(raw) : cfg.accounts[0];
    if (!cfg.accounts.includes(id)) throw refuse(403, `Meta account ${id} is not on the allowlist (META_AD_ACCOUNT_IDS), so this server will not touch it.`);
    return id;
  };
  const readAccount = (id) => graph('GET', `act_${id}`, { fields: 'id,account_id,name,account_status,currency,timezone_name' });

  /** Reads a campaign and refuses it unless it belongs to an allowed account, so an ID in a URL can't reach any other. */
  async function ownedCampaign(id) {
    const c = await graph('GET', id, { fields: 'id,name,account_id,status,effective_status,daily_budget,lifetime_budget' });
    if (!cfg.accounts.includes(digits(c.account_id))) throw refuse(403, `Campaign ${id} isn't in an allowed Meta account, so this server will not touch it.`);
    return c;
  }

  const spendThisMonth = async (id) => {
    const rows = await graphAll(`act_${id}/insights`, { level: 'account', date_preset: 'this_month', fields: 'spend' });
    return rows.reduce((sum, r) => sum + Number(r.spend ?? 0), 0);
  };

  /** Days left in this month, today included, on the account's own calendar: Meta's this_month follows the account. */
  function daysLeftInMonth(timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now());
    const get = (t) => Number(parts.find((p) => p.type === t).value);
    return new Date(Date.UTC(get('year'), get('month'), 0)).getUTCDate() - get('day') + 1;
  }

  /** What holds the daily budget: the campaign, or its running ad sets. Lifetime budgets can only be paused. */
  async function budgetsOf(campaign) {
    if (Number(campaign.daily_budget) > 0) return { daily: [{ kind: 'campaign', id: campaign.id, name: campaign.name, minor: Number(campaign.daily_budget), campaignId: campaign.id }], lifetime: 0 };
    if (Number(campaign.lifetime_budget) > 0) return { daily: [], lifetime: 1 };
    const sets = await graphAll(`${campaign.id}/adsets`, { fields: 'id,name,status,daily_budget,lifetime_budget' });
    const running = sets.filter((s) => s.status === 'ACTIVE');
    return {
      daily: running.filter((s) => Number(s.daily_budget) > 0).map((s) => ({ kind: 'ad set', id: s.id, name: s.name, minor: Number(s.daily_budget), campaignId: campaign.id })),
      lifetime: running.filter((s) => Number(s.lifetime_budget) > 0).length,
    };
  }

  const pauseCampaign = async (id) => {
    await graph('POST', id, { status: 'PAUSED' });
    return (await graph('GET', id, { fields: 'status' })).status === 'PAUSED';
  };

  /**
   * The monthly cap. Keeps the running daily budgets low enough that even Meta's worst published day, every day to the
   * end of the month, stays inside what's left; pauses everything at the cap. Never raises a budget. If a budget can't
   * be lowered (Meta has minimums), its campaign is paused instead, because the cap must hold.
   */
  async function capAccount(id, { monthlyCap, apply = false, source = 'manual' } = {}) {
    const account = await readAccount(id);
    const currency = account.currency;
    const fmt = (n) => `${Number(n).toFixed(2)} ${currency}`;
    const cap = monthlyCap > 0 ? Math.min(monthlyCap, cfg.monthlyCap) : cfg.monthlyCap; // a request can lower the cap, never raise it
    const spent = await spendThisMonth(id);
    const remaining = cap - spent;
    const daysLeft = daysLeftInMonth(account.timezone_name);
    const running = (await graphAll(`act_${id}/campaigns`, { fields: 'id,name,status,daily_budget,lifetime_budget' })).filter((c) => c.status === 'ACTIVE');
    const budgets = await Promise.all(running.map(budgetsOf));
    const holders = budgets.flatMap((b) => b.daily);
    const lifetime = budgets.reduce((n, b) => n + b.lifetime, 0);
    const totalDaily = holders.reduce((sum, h) => sum + fromMinor(h.minor, currency), 0);
    const safeTotal = Math.max(0, remaining) / (WORST_DAY * daysLeft);

    let action = 'none';
    let summary;
    let plan = [];
    if (!running.length) summary = `Spent ${fmt(spent)} of ${fmt(cap)}; nothing is running.`;
    else if (remaining <= 0) {
      action = 'pause';
      plan = running.map((c) => ({ kind: 'campaign', id: c.id, name: c.name, change: 'pause' }));
      summary = `Spent ${fmt(spent)} of ${fmt(cap)}: cap reached, pause ${running.length} campaign(s).`;
    } else if (totalDaily > safeTotal) {
      action = 'lower-budget';
      const factor = safeTotal / totalDaily;
      plan = holders.map((h) => ({ ...h, change: 'lower', to: Math.floor(h.minor * factor) }));
      summary = `Spent ${fmt(spent)} of ${fmt(cap)}, ${daysLeft} day(s) left: lower daily budgets from ${fmt(totalDaily)} to ${fmt(safeTotal)} in total.`;
    } else summary = `Spent ${fmt(spent)} of ${fmt(cap)}, ${daysLeft} day(s) left: daily budgets of ${fmt(totalDaily)} are within ${fmt(safeTotal)}.`;
    if (lifetime) summary += ` ${lifetime} lifetime budget(s) can only be paused at the cap.`;

    const applied = [];
    if (apply) {
      for (const p of plan) {
        if (p.change === 'pause') {
          applied.push({ ...p, confirmed: await pauseCampaign(p.id).catch(() => false) });
          continue;
        }
        let confirmed = false;
        if (p.to >= 1) {
          try {
            await graph('POST', p.id, { daily_budget: p.to });
            confirmed = Number((await graph('GET', p.id, { fields: 'daily_budget' })).daily_budget) === p.to;
          } catch {
            confirmed = false;
          }
        }
        if (confirmed) applied.push({ ...p, confirmed });
        else {
          const paused = await pauseCampaign(p.campaignId).catch(() => false);
          applied.push({ ...p, change: 'pause instead', confirmed: paused });
        }
      }
      summary += ` ${applied.filter((a) => a.confirmed).length} of ${plan.length} change(s) confirmed by Meta.`;
    }
    const ok = !apply || applied.every((a) => a.confirmed);
    if (!ok) summary += ' SOME CHANGES FAILED: check this account in Ads Manager now.';
    if (apply || source === 'auto') logCap({ platform: 'meta', account: id, source, apply, action, spent, cap, remaining, daysLeft, summary, changes: applied });
    return { ok, httpStatus: 200, summary: (apply ? '' : 'Dry run: ') + summary, action, spent, cap, remaining, daysLeft, totalDaily, safeTotal, currency, plan, applied };
  }

  const steps = {
    async health() {
      const accounts = await Promise.all(
        cfg.accounts.map(async (id) => {
          try {
            const a = await readAccount(id);
            return { id, name: a.name, currency: a.currency, status: ACCOUNT_STATUS[a.account_status] ?? String(a.account_status), timeZone: a.timezone_name };
          } catch (err) {
            return { id, error: err.message };
          }
        }),
      );
      const bad = accounts.filter((a) => a.error);
      return {
        ok: !bad.length,
        enabled: true,
        mode: cfg.mode,
        httpStatus: 200,
        apiVersion: META_VERSION,
        summary: bad.length ? `Can't read ${bad.length} of ${accounts.length} Meta account(s): ${bad[0].error}` : `Connected to ${accounts.map((a) => `${a.name} (${a.currency})`).join(', ')} in ${cfg.mode} mode.`,
        accounts,
        pageConfigured: !!cfg.pageId,
        caps: { maxDailyBudget: cfg.maxDaily, monthlyCap: cfg.monthlyCap, capEveryHours: cfg.capEveryHours },
        lastCap: readCapLog(1)[0] ?? null,
      };
    },

    async campaigns(id) {
      const account = await readAccount(id);
      const list = await graphAll(`act_${id}/campaigns`, { fields: 'id,name,objective,status,effective_status,daily_budget,lifetime_budget' });
      const insights = await graphAll(`act_${id}/insights`, { level: 'campaign', date_preset: 'this_month', fields: 'campaign_id,spend,clicks,impressions' });
      const byId = new Map(insights.map((r) => [r.campaign_id, r]));
      const sets = await graphAll(`act_${id}/adsets`, { fields: 'campaign_id,status,daily_budget' });
      const setDaily = (cid) => sets.filter((x) => x.campaign_id === cid && Number(x.daily_budget) > 0).reduce((sum, x) => sum + fromMinor(x.daily_budget, account.currency), 0);
      return {
        ok: true,
        httpStatus: 200,
        summary: `Read ${list.length} Meta campaign(s) with status, budget and this month's spend, clicks and impressions.`,
        currency: account.currency,
        campaigns: list.map((c) => {
          const r = byId.get(c.id);
          const onCampaign = Number(c.daily_budget) > 0;
          const daily = onCampaign ? fromMinor(c.daily_budget, account.currency) : setDaily(c.id) || null;
          return { id: c.id, name: c.name, objective: c.objective, status: c.status, effectiveStatus: c.effective_status, daily, lifetimeBudget: Number(c.lifetime_budget) > 0, budgetAt: onCampaign ? 'campaign' : Number(c.lifetime_budget) > 0 ? 'campaign (lifetime)' : 'ad set', monthToDate: { spend: Number(r?.spend ?? 0), clicks: Number(r?.clicks ?? 0), impressions: Number(r?.impressions ?? 0) } };
        }),
      };
    },

    /** Campaign, ad set and, when a Page is set, creative and ad: everything PAUSED, so nothing runs. */
    async setup(id, { dailyBudget = 1, country = 'US', link = cfg.link } = {}) {
      const account = await readAccount(id);
      assertBudget(dailyBudget, account.currency);
      const stamp = now().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      const name = `${PREFIX}${stamp}`;
      const created = {};
      const step = async (key, path, params) => {
        created[key] = (await graph('POST', path, params, { idempotencyKey: `${name}-${key}` })).id;
      };
      try {
        await step('campaign', `act_${id}/campaigns`, { name, objective: 'OUTCOME_TRAFFIC', status: 'PAUSED', special_ad_categories: [], is_adset_budget_sharing_enabled: false });
        await step('adSet', `act_${id}/adsets`, { name: `${name}-adset`, campaign_id: created.campaign, daily_budget: toMinor(dailyBudget, account.currency), optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS', bid_strategy: 'LOWEST_COST_WITHOUT_CAP', targeting: { geo_locations: { countries: [country] } }, status: 'PAUSED' });
        if (cfg.pageId) {
          await step('creative', `act_${id}/adcreatives`, { name: `${name}-creative`, object_story_spec: { page_id: cfg.pageId, link_data: { link, message: 'Test ad created by Ads engine.' } } });
          await step('ad', `act_${id}/ads`, { name: `${name}-ad`, adset_id: created.adSet, creative: { creative_id: created.creative }, status: 'PAUSED' });
        }
      } catch (err) {
        err.message = `Stopped after creating ${Object.keys(created).join(', ') || 'nothing'} (all paused). ${err.message}`;
        throw err;
      }
      return {
        ok: true,
        warn: !cfg.pageId,
        httpStatus: 200,
        summary: cfg.pageId ? `Created a PAUSED campaign, ad set, creative and ad (${name}).` : `Created a PAUSED campaign and ad set (${name}). No ad: an ad needs a Facebook Page, so set META_PAGE_ID.`,
        campaignId: created.campaign,
        created,
      };
    },

    /** Switching on needs a typed confirmation and is refused at the cap. Our paused ad sets and ads go first, the campaign last. */
    async setStatus(campaignId, { status, confirm } = {}) {
      if (status !== 'PAUSED' && status !== 'ACTIVE') throw refuse(400, 'Status must be PAUSED or ACTIVE.');
      const c = await ownedCampaign(campaignId);
      if (status === 'PAUSED') {
        const confirmed = await pauseCampaign(campaignId);
        return { ok: confirmed, httpStatus: 200, summary: `Campaign ${campaignId} set to PAUSED; reading it back from Meta says ${confirmed ? 'PAUSED' : 'something else'}.` };
      }
      if (confirm !== `ENABLE ${campaignId}`) throw refuse(409, `Switching a Meta campaign on can spend real money. Send confirm "ENABLE ${campaignId}".`);
      const id = digits(c.account_id);
      const account = await readAccount(id);
      const spent = await spendThisMonth(id);
      if (spent >= cfg.monthlyCap) throw refuse(409, `This account has spent ${spent.toFixed(2)} ${account.currency} of its ${cfg.monthlyCap} ${account.currency} monthly cap, so nothing can be switched on.`);
      const children = [
        ...(await graphAll(`${campaignId}/adsets`, { fields: 'id,name,status' })),
        ...(await graphAll(`${campaignId}/ads`, { fields: 'id,name,status' })),
      ].filter((x) => x.name?.startsWith(PREFIX) && x.status === 'PAUSED');
      for (const x of children) await graph('POST', x.id, { status: 'ACTIVE' });
      await graph('POST', campaignId, { status: 'ACTIVE' });
      const back = await graph('GET', campaignId, { fields: 'status,effective_status' });
      return { ok: back.status === 'ACTIVE', httpStatus: 200, summary: `Campaign ${campaignId} and ${children.length} of its paused item(s) switched on; Meta now reports ${back.status} (${back.effective_status}).` };
    },

    /** Changes a daily budget where it lives: on the campaign, or on its one ad set. Several ad sets or a lifetime budget are refused. */
    async setBudget(campaignId, { daily } = {}) {
      const c = await ownedCampaign(campaignId);
      const account = await readAccount(digits(c.account_id));
      assertBudget(daily, account.currency);
      let target = campaignId;
      if (!(Number(c.daily_budget) > 0)) {
        if (Number(c.lifetime_budget) > 0) throw refuse(409, 'This campaign has a lifetime budget. Change it in Ads Manager.');
        const sets = (await graphAll(`${campaignId}/adsets`, { fields: 'id,daily_budget,lifetime_budget' })).filter((s) => Number(s.daily_budget) > 0);
        if (sets.length !== 1) throw refuse(409, `This campaign's budget is split across ${sets.length} ad sets. Change them in Ads Manager.`);
        target = sets[0].id;
      }
      const minor = toMinor(daily, account.currency);
      await graph('POST', target, { daily_budget: minor });
      const back = await graph('GET', target, { fields: 'daily_budget' });
      const confirmed = Number(back.daily_budget) === minor;
      return { ok: confirmed, httpStatus: 200, summary: `Daily budget set to ${daily} ${account.currency}; Meta now reports ${fromMinor(back.daily_budget, account.currency)} ${account.currency}.` };
    },

    capCheck: (id, b) => capAccount(id, { monthlyCap: Number(b?.monthlyCap) || undefined, apply: !!b?.apply, source: 'manual' }),
    capLog: () => ({ ok: true, httpStatus: 200, summary: 'Meta cap decisions, newest first.', entries: readCapLog(50) }),
  };

  function assertBudget(amount, currency) {
    if (!(Number(amount) > 0)) throw refuse(400, 'A daily budget must be a number above 0.');
    if (Number(amount) > cfg.maxDaily) throw refuse(400, `${amount} ${currency} a day is above the maximum of ${cfg.maxDaily} ${currency} set by META_MAX_DAILY_BUDGET.`);
  }

  const inAccount = (fn) => (cid, m, b, url) => fn(accountFor(url, b), b);
  const routes = [
    ['GET', /^\/api\/meta\/health$/, 'meta-health', () => steps.health()],
    ['GET', /^\/api\/meta\/campaigns$/, 'meta-campaigns', inAccount((id) => steps.campaigns(id))],
    ['POST', /^\/api\/meta\/setup$/, 'meta-setup', inAccount((id, b) => steps.setup(id, b))],
    ['POST', /^\/api\/meta\/campaigns\/(\d+)\/status$/, 'meta-status', (cid, m, b) => steps.setStatus(m[1], b)],
    ['POST', /^\/api\/meta\/campaigns\/(\d+)\/budget$/, 'meta-budget', (cid, m, b) => steps.setBudget(m[1], b)],
    ['POST', /^\/api\/meta\/cap-check$/, 'meta-cap-check', inAccount((id, b) => steps.capCheck(id, b))],
    ['GET', /^\/api\/meta\/cap-log$/, 'meta-cap-log', () => steps.capLog()],
  ];

  /** The monthly cap on its own: first shortly after start, then every META_CAP_EVERY_HOURS. A failed check is logged, never silent. */
  function startCapJob(onError) {
    const run = async () => {
      for (const id of cfg.accounts) {
        try {
          const r = await capAccount(id, { apply: true, source: 'auto' });
          console.log(`${now().toISOString().slice(11, 19)} Meta cap check ${id} → ${r.summary}`);
        } catch (err) {
          logCap({ platform: 'meta', account: id, source: 'auto', action: 'error', summary: err.message });
          onError(id, err);
        }
      }
    };
    setTimeout(run, cfg.capFirstRunSeconds * 1000);
    setInterval(run, cfg.capEveryHours * 3_600_000);
  }

  return { routes, steps, capAccount, startCapJob };
}
