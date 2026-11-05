import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createGate, hostingConfig, serveDashboard } from './hosting.mjs';

const PASSWORD = 'a-long-test-password';
const SECRET = 'x'.repeat(40);
let clock = Date.now();
let base;
let server;
let reached;

before(async () => {
  const dist = mkdtempSync(join(tmpdir(), 'ae-dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), 'HOME');
  writeFileSync(join(dist, 'privacy.html'), 'PRIVACY');
  writeFileSync(join(dist, 'assets', 'a.js'), 'JS');
  writeFileSync(join(dist, '..', 'ae-outside.txt'), 'OUTSIDE');
  const gate = createGate({ name: 'admin', password: PASSWORD, secret: SECRET, secure: false }, () => clock);
  server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (await gate(req, res, url)) return;
    if (!url.pathname.startsWith('/api/')) return serveDashboard(req, res, url, dist);
    reached = url.pathname;
    res.end(JSON.stringify({ ok: true, reachedApi: true }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const login = (name, password, headers = {}) => fetch(`${base}/api/login`, { method: 'POST', headers, body: JSON.stringify({ name, password }) });
const cookieOf = (r) => r.headers.get('set-cookie').split(';')[0];

test('hosted server refuses to start without a login', () => {
  assert.match(hostingConfig({ RENDER: 'true' }).problem, /AE_LOGIN_PASSWORD/);
  assert.match(hostingConfig({ RENDER: 'true', AE_LOGIN_PASSWORD: 'short', AE_SESSION_SECRET: SECRET }).problem, /AE_LOGIN_PASSWORD/);
  assert.match(hostingConfig({ RENDER: 'true', AE_LOGIN_PASSWORD: PASSWORD }).problem, /AE_SESSION_SECRET/);
  const ok = hostingConfig({ RENDER: 'true', AE_LOGIN_PASSWORD: PASSWORD, AE_SESSION_SECRET: SECRET });
  assert.equal(ok.problem, null);
  assert.equal(ok.host, '0.0.0.0');
  assert.equal(ok.secure, true);
});

test('on a laptop it stays private and needs no login', async () => {
  const c = hostingConfig({});
  assert.equal(c.problem, null);
  assert.equal(c.host, '127.0.0.1');
});

test('API is refused without a login, for reads and changes', async () => {
  reached = null;
  for (const [method, path] of [['GET', '/api/health'], ['GET', '/api/campaigns'], ['POST', '/api/campaigns/1/budget'], ['POST', '/api/cleanup'], ['GET', '/api/meta/health'], ['GET', '/api/%2e%2e/api/health']]) {
    const r = await fetch(base + path, { method });
    assert.equal(r.status, 401, `${method} ${path}`);
    assert.equal((await r.json()).signedOut, true);
  }
  assert.equal(reached, null);
});

test('wrong details are refused and set no cookie', async () => {
  for (const [n, p] of [['admin', 'nope'], ['someone', PASSWORD], ['', ''], ['admin', 'work']]) {
    const r = await login(n, p);
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('set-cookie'), null);
  }
});

test('login opens the API, logout clears the cookie', async () => {
  const r = await login('admin', PASSWORD);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const cookie = cookieOf(r);
  assert.equal((await (await fetch(`${base}/api/session`, { headers: { cookie } })).json()).signedIn, true);
  assert.equal((await fetch(`${base}/api/health`, { headers: { cookie } })).status, 200);
  const out = await fetch(`${base}/api/logout`, { method: 'POST', headers: { cookie } });
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
});

test('a forged or edited cookie is refused', async () => {
  const cookie = cookieOf(await login('admin', PASSWORD));
  const [, value] = cookie.split('=');
  const [exp, sig] = value.split('.');
  for (const bad of [`ae_session=${Number(exp) + 999999}.${sig}`, `ae_session=${exp}.forged`, 'ae_session=', `ae_session=${exp}`]) {
    assert.equal((await fetch(`${base}/api/health`, { headers: { cookie: bad } })).status, 401, bad);
  }
});

test('a session expires', async () => {
  const cookie = cookieOf(await login('admin', PASSWORD));
  const saved = clock;
  clock += 8 * 24 * 3600 * 1000;
  assert.equal((await fetch(`${base}/api/health`, { headers: { cookie } })).status, 401);
  clock = saved;
});

test('a logged-in browser cannot be used by another site', async () => {
  const cookie = cookieOf(await login('admin', PASSWORD));
  const foreign = await fetch(`${base}/api/cleanup`, { method: 'POST', headers: { cookie, origin: 'https://evil.example' } });
  assert.equal(foreign.status, 403);
  const own = await fetch(`${base}/api/cleanup`, { method: 'POST', headers: { cookie, origin: base } });
  assert.equal(own.status, 200);
});

test('serves pages publicly and never outside the build folder', async () => {
  const text = async (p) => {
    const r = await fetch(base + p);
    return [r.status, await r.text()];
  };
  assert.deepEqual(await text('/'), [200, 'HOME']);
  assert.deepEqual(await text('/privacy.html'), [200, 'PRIVACY']);
  assert.deepEqual(await text('/assets/a.js'), [200, 'JS']);
  assert.deepEqual(await text('/sites/site-007'), [200, 'HOME']);
  assert.deepEqual(await text('/%2e%2e/ae-outside.txt'), [200, 'HOME']);
  assert.deepEqual(await text('/..%2fae-outside.txt'), [200, 'HOME']);
});

test('too many failed logins stop further tries, even with the right password', async () => {
  for (let i = 0; i < 30; i++) await login('admin', 'wrong');
  assert.equal((await login('admin', PASSWORD)).status, 429);
  clock += 16 * 60_000;
  assert.equal((await login('admin', PASSWORD)).status, 200);
});

test('no password set: nothing is required, as on a laptop', async () => {
  const gate = createGate({ name: 'admin', password: '', secret: '', secure: false });
  const res = { writeHead() {}, end() {} };
  assert.equal(await gate({ method: 'GET', headers: {} }, res, new URL('http://x/api/health')), false);
});
