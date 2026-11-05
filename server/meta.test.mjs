// Tests the Meta connection against a fake Graph API whose replies follow the shapes in Meta's docs. No call reaches
// Meta, so this proves our logic and the requests we send, not that Meta accepts them. Run: npm run test:meta
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMeta, fromMinor, hintFor, metaConfig, offsetOf, PREFIX, toMinor } from './meta.mjs';

const TOKEN = 'EAAfaketokenfaketokenfaketoken';
const baseCfg = { enabled: true, mode: 'sandbox', accounts: ['111'], pageId: '999', link: 'https://example.com', maxDaily: 10, monthlyCap: 20, capEveryHours: 2, capFirstRunSeconds: 60, graphBase: 'https://graph.facebook.com' };

/** A tiny Graph API: objects by id, edges by "parent/edge", and a log of every request. */
function fakeGraph({ objects = {}, edges = {}, failPost = () => null } = {}) {
  const calls = [];
  let nextId = 5000;
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/v[\d.]+\//, '');
    const params = init.method === 'POST' ? new URLSearchParams(init.body) : u.searchParams;
    calls.push({ method: init.method, path, params: Object.fromEntries(params), headers: init.headers ?? {} });
    const reply = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
    if (init.method === 'POST') {
      const fail = failPost(path, Object.fromEntries(params));
      if (fail) return reply({ error: fail }, 400);
      if (/^act_\d+\//.test(path)) return reply({ id: String(nextId++) });
      Object.assign((objects[path] ??= {}), Object.fromEntries(params));
      return reply({ success: true });
    }
    if (edges[path]) return reply({ data: edges[path] });
    if (objects[path]) return reply(objects[path]);
    return reply({ error: { message: `Unknown path ${path}`, code: 100 } }, 400);
  };
  return { fetchImpl, calls, objects };
}

const account = { act_111: { id: 'act_111', account_id: '111', name: 'Test account', account_status: 1, currency: 'USD', timezone_name: 'UTC' } };
const make = (graph, over = {}) => {
  const logged = [];
  const meta = createMeta({ cfg: { ...baseCfg, ...over.cfg }, token: TOKEN, fetchImpl: graph.fetchImpl, now: () => new Date(over.now ?? '2026-11-21T12:00:00Z'), logCap: (e) => logged.push(e) });
  return { meta, logged };
};
const posts = (g) => g.calls.filter((c) => c.method === 'POST');

test('money: smallest units follow the currency', () => {
  assert.equal(offsetOf('USD'), 100);
  assert.equal(offsetOf('EUR'), 100);
  assert.equal(offsetOf('JPY'), 1);
  assert.equal(toMinor(20, 'USD'), 2000); // Meta's own example: daily_budget=2000 is $20
  assert.equal(toMinor(500, 'JPY'), 500);
  assert.equal(fromMinor('1250', 'USD'), 12.5);
});

test('config: off unless switched on, and on needs an account and a token file', () => {
  assert.deepEqual(metaConfig({}), { enabled: false });
  assert.deepEqual(metaConfig({ META_ENABLED: 'false', META_MODE: 'nonsense' }), { enabled: false });
  assert.throws(() => metaConfig({ META_ENABLED: 'true', META_TOKEN_FILE: 'x' }), /META_AD_ACCOUNT_IDS/);
  assert.throws(() => metaConfig({ META_ENABLED: 'true', META_AD_ACCOUNT_IDS: '1' }), /META_TOKEN_FILE/);
  assert.throws(() => metaConfig({ META_ENABLED: 'true', META_AD_ACCOUNT_IDS: '1', META_TOKEN_FILE: 'x', META_MODE: 'prod' }), /sandbox or live/);
  assert.throws(() => metaConfig({ META_ENABLED: 'true', META_AD_ACCOUNT_IDS: '1', META_TOKEN_FILE: 'x', META_GRAPH_BASE: 'https://evil.example' }), /this computer/);
  assert.deepEqual(metaConfig({ META_ENABLED: 'true', META_AD_ACCOUNT_IDS: 'act_123, 456', META_TOKEN_FILE: 'x' }).accounts, ['123', '456']);
});

test('hints: error codes from Meta\'s pages', () => {
  assert.match(hintFor(190), /expired/);
  assert.match(hintFor(200), /permission/);
  assert.match(hintFor(80004), /rate-limiting/);
  assert.equal(hintFor(999999), null);
});

test('setup: everything is created PAUSED with the fields the docs ask for', async () => {
  const g = fakeGraph({ objects: { ...account } });
  const { meta } = make(g);
  const r = await meta.steps.setup('111', { dailyBudget: 3 });
  assert.equal(r.ok, true);
  const [campaign, adset, creative, ad] = posts(g);
  assert.equal(campaign.path, 'act_111/campaigns');
  assert.equal(campaign.params.status, 'PAUSED');
  assert.equal(campaign.params.objective, 'OUTCOME_TRAFFIC');
  assert.equal(campaign.params.special_ad_categories, '[]');
  assert.ok(campaign.params.name.startsWith(PREFIX));
  assert.ok(campaign.headers['X-Client-Idempotent-Key']);
  assert.equal(adset.path, 'act_111/adsets');
  assert.equal(adset.params.status, 'PAUSED');
  assert.equal(adset.params.daily_budget, '300');
  assert.equal(adset.params.campaign_id, r.created.campaign);
  assert.deepEqual(JSON.parse(adset.params.targeting), { geo_locations: { countries: ['US'] } });
  assert.equal(JSON.parse(creative.params.object_story_spec).page_id, '999');
  assert.equal(ad.params.status, 'PAUSED');
  assert.deepEqual(JSON.parse(ad.params.creative), { creative_id: r.created.creative });
});

test('setup: without a Page it stops at the ad set and says why', async () => {
  const g = fakeGraph({ objects: { ...account } });
  const r = await make(g, { cfg: { pageId: null } }).meta.steps.setup('111');
  assert.equal(r.warn, true);
  assert.match(r.summary, /META_PAGE_ID/);
  assert.equal(posts(g).length, 2);
});

test('setup: a Meta refusal part-way says what was already created', async () => {
  const g = fakeGraph({ objects: { ...account }, failPost: (p) => (p.endsWith('/adsets') ? { message: 'Budget too low', code: 100 } : null) });
  await assert.rejects(make(g).meta.steps.setup('111'), /Stopped after creating campaign.*Budget too low/s);
});

test('budget limit: above the maximum is refused before any call changes anything', async () => {
  const g = fakeGraph({ objects: { ...account, 77: { id: '77', name: 'x', account_id: '111', status: 'PAUSED', daily_budget: '300' } } });
  const { meta } = make(g);
  await assert.rejects(meta.steps.setBudget('77', { daily: 50 }), (e) => e.httpCode === 400);
  await assert.rejects(meta.steps.setup('111', { dailyBudget: 50 }), (e) => e.httpCode === 400);
  assert.equal(posts(g).length, 0);
});

test('allowlist: an account or campaign outside it is refused', async () => {
  const g = fakeGraph({ objects: { ...account, 88: { id: '88', name: 'theirs', account_id: '222', status: 'ACTIVE', daily_budget: '100' } } });
  const { meta } = make(g);
  const route = meta.routes.find((r) => r[2] === 'meta-campaigns');
  assert.throws(() => route[3](null, null, {}, new URL('http://x/?metaAccount=act_222')), (e) => e.httpCode === 403);
  await assert.rejects(meta.steps.setStatus('88', { status: 'PAUSED' }), (e) => e.httpCode === 403);
  await assert.rejects(meta.steps.setBudget('88', { daily: 1 }), (e) => e.httpCode === 403);
  assert.equal(posts(g).length, 0);
});

test('switching on: needs the typed confirmation, and our paused children go before the campaign', async () => {
  const g = fakeGraph({
    objects: { ...account, 77: { id: '77', name: `${PREFIX}x`, account_id: '111', status: 'PAUSED', effective_status: 'PAUSED' } },
    edges: { 'act_111/insights': [{ spend: '1.00' }], '77/adsets': [{ id: '71', name: `${PREFIX}x-adset`, status: 'PAUSED' }, { id: '72', name: 'someone elses', status: 'PAUSED' }], '77/ads': [{ id: '73', name: `${PREFIX}x-ad`, status: 'PAUSED' }] },
  });
  const { meta } = make(g);
  await assert.rejects(meta.steps.setStatus('77', { status: 'ACTIVE' }), (e) => e.httpCode === 409);
  await assert.rejects(meta.steps.setStatus('77', { status: 'ACTIVE', confirm: 'ENABLE 1' }), (e) => e.httpCode === 409);
  assert.equal(posts(g).length, 0);
  const r = await meta.steps.setStatus('77', { status: 'ACTIVE', confirm: 'ENABLE 77' });
  assert.equal(r.ok, true);
  assert.deepEqual(posts(g).map((c) => c.path), ['71', '73', '77']);
  assert.ok(posts(g).every((c) => c.params.status === 'ACTIVE'));
});

test('switching on: refused once the monthly cap is reached', async () => {
  const g = fakeGraph({ objects: { ...account, 77: { id: '77', name: 'x', account_id: '111', status: 'PAUSED' } }, edges: { 'act_111/insights': [{ spend: '20.00' }] } });
  await assert.rejects(make(g).meta.steps.setStatus('77', { status: 'ACTIVE', confirm: 'ENABLE 77' }), (e) => e.httpCode === 409 && /monthly cap/.test(e.message));
  assert.equal(posts(g).length, 0);
});

test('budget change: goes to the campaign when it holds the budget, else to its one ad set', async () => {
  const g = fakeGraph({ objects: { ...account, 77: { id: '77', name: 'x', account_id: '111', status: 'PAUSED', daily_budget: '300' }, 78: { id: '78', name: 'y', account_id: '111', status: 'PAUSED' }, 71: { id: '71', daily_budget: '100' } }, edges: { '78/adsets': [{ id: '71', daily_budget: '100' }] } });
  const { meta } = make(g);
  assert.equal((await meta.steps.setBudget('77', { daily: 2.5 })).ok, true);
  assert.equal((await meta.steps.setBudget('78', { daily: 4 })).ok, true);
  assert.deepEqual(posts(g).map((c) => [c.path, c.params.daily_budget]), [['77', '250'], ['71', '400']]);
});

test('budget change: several ad sets or a lifetime budget are refused', async () => {
  const g = fakeGraph({ objects: { ...account, 78: { id: '78', name: 'y', account_id: '111' }, 79: { id: '79', name: 'z', account_id: '111', lifetime_budget: '9000' } }, edges: { '78/adsets': [{ id: '1', daily_budget: '100' }, { id: '2', daily_budget: '100' }] } });
  const { meta } = make(g);
  await assert.rejects(meta.steps.setBudget('78', { daily: 1 }), (e) => e.httpCode === 409);
  await assert.rejects(meta.steps.setBudget('79', { daily: 1 }), (e) => e.httpCode === 409);
});

// Nov 21 in UTC: 10 days left, today included. Cap 20, spent 10: 10 left, so the safe total is 10 / (1.75 × 10) = 0.571.
const capWorld = (over = {}) => ({
  objects: { ...account, 77: { id: '77', daily_budget: '300' }, 78: { id: '78' }, 71: { id: '71', daily_budget: '100' }, ...over.objects },
  edges: {
    'act_111/insights': [{ spend: over.spend ?? '10.00' }],
    'act_111/campaigns': over.campaigns ?? [{ id: '77', name: 'with budget', status: 'ACTIVE', daily_budget: '300' }, { id: '78', name: 'ad set budget', status: 'ACTIVE' }, { id: '79', name: 'paused', status: 'PAUSED', daily_budget: '900' }],
    '78/adsets': [{ id: '71', name: 'set', status: 'ACTIVE', daily_budget: '100' }, { id: '72', name: 'off', status: 'PAUSED', daily_budget: '900' }],
  },
  failPost: over.failPost,
});

test('cap dry run: decides, and changes nothing', async () => {
  const g = fakeGraph(capWorld());
  const r = await make(g).meta.capAccount('111', { apply: false });
  assert.equal(r.action, 'lower-budget');
  assert.equal(r.daysLeft, 10);
  assert.equal(r.totalDaily, 4); // paused campaign and paused ad set not counted
  assert.ok(Math.abs(r.safeTotal - 10 / 17.5) < 1e-9);
  assert.equal(posts(g).length, 0);
});

test('cap apply: lowers each budget in proportion, confirms it, and logs', async () => {
  const g = fakeGraph(capWorld());
  const { meta, logged } = make(g);
  const r = await meta.capAccount('111', { apply: true });
  assert.equal(r.ok, true);
  assert.deepEqual(posts(g).map((c) => [c.path, c.params.daily_budget]), [['77', '42'], ['71', '14']]);
  assert.equal(logged.length, 1);
  assert.ok(toMinorSum(posts(g)) / 100 <= r.safeTotal); // the promise: worst-case spend stays inside what's left
});
const toMinorSum = (ps) => ps.reduce((s, p) => s + Number(p.params.daily_budget), 0);

test('cap apply: a budget Meta will not lower gets its campaign paused instead', async () => {
  const g = fakeGraph(capWorld({ failPost: (p, q) => (q.daily_budget ? { message: 'Below minimum budget', code: 100 } : null) }));
  const r = await make(g).meta.capAccount('111', { apply: true });
  assert.equal(r.ok, true);
  assert.deepEqual(posts(g).filter((c) => c.params.status).map((c) => [c.path, c.params.status]), [['77', 'PAUSED'], ['78', 'PAUSED']]);
  assert.ok(r.applied.every((a) => a.change === 'pause instead'));
});

test('cap apply: at the cap every running campaign is paused', async () => {
  const g = fakeGraph(capWorld({ spend: '20.50' }));
  const r = await make(g).meta.capAccount('111', { apply: true });
  assert.equal(r.action, 'pause');
  assert.deepEqual(posts(g).map((c) => [c.path, c.params.status]), [['77', 'PAUSED'], ['78', 'PAUSED']]);
});

test('cap: budgets already low enough are left alone, and a request cannot raise the cap', async () => {
  const g = fakeGraph(capWorld({ spend: '0', campaigns: [{ id: '77', name: 'small', status: 'ACTIVE', daily_budget: '50' }] }));
  const { meta } = make(g);
  const r = await meta.capAccount('111', { apply: true, monthlyCap: 9999 });
  assert.equal(r.cap, 20);
  assert.equal(r.action, 'none');
  assert.equal(posts(g).length, 0);
});

test('cap: a failed change is reported, not hidden', async () => {
  const g = fakeGraph(capWorld({ spend: '20.50', failPost: () => ({ message: 'nope', code: 2 }) }));
  const r = await make(g).meta.capAccount('111', { apply: true });
  assert.equal(r.ok, false);
  assert.match(r.summary, /SOME CHANGES FAILED/);
});

test('cap: days left follow the account time zone, not ours', async () => {
  const objects = { act_111: { ...account.act_111, timezone_name: 'Pacific/Honolulu' } };
  const g = fakeGraph({ ...capWorld({ objects }), objects: { ...capWorld().objects, ...objects } });
  const r = await make(g, { now: '2026-12-01T05:00:00Z' }).meta.capAccount('111', {}); // still Nov 30 in Honolulu
  assert.equal(r.daysLeft, 1);
});

test('reading: a budget held on ad sets shows as their total', async () => {
  const g = fakeGraph({ objects: { ...account }, edges: { 'act_111/campaigns': [{ id: '78', name: 'y', status: 'PAUSED' }], 'act_111/insights': [], 'act_111/adsets': [{ campaign_id: '78', daily_budget: '150' }, { campaign_id: '78', daily_budget: '250' }, { campaign_id: '9', daily_budget: '999' }] } });
  const r = await make(g).meta.steps.campaigns('111');
  assert.equal(r.campaigns[0].daily, 4);
  assert.equal(r.campaigns[0].budgetAt, 'ad set');
});

test('reading: a long list is followed page by page; too many pages stop rather than guess', async () => {
  let n = 0;
  const pages = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: String(n++), name: 'c', status: 'PAUSED' }], paging: { cursors: { after: 'x' }, next: 'https://next' } }) });
  const fetchImpl = async (url) => (new URL(url).pathname.endsWith('act_111') ? { ok: true, status: 200, text: async () => JSON.stringify(account.act_111) } : pages());
  const meta = createMeta({ cfg: baseCfg, token: TOKEN, fetchImpl });
  await assert.rejects(meta.steps.campaigns('111'), /stopped rather than work from part/);
});

test('errors: Meta\'s message and code come through with the next step', async () => {
  const g = fakeGraph({ objects: {} });
  g.fetchImpl = async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ error: { message: 'Session has expired', type: 'OAuthException', code: 190 } }) });
  const h = await createMeta({ cfg: baseCfg, token: TOKEN, fetchImpl: g.fetchImpl }).steps.health();
  assert.equal(h.ok, false);
  assert.match(h.accounts[0].error, /Session has expired.*code 190.*expired or was revoked/s);
  assert.ok(!JSON.stringify(h).includes(TOKEN));
});
