// What the server needs once it's reachable from the internet: its address and port, a real login, and serving the
// built dashboard. On a laptop it stays on 127.0.0.1, and the login is off unless a password is set.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const COOKIE = 'ae_session';
const SESSION_SECONDS = 7 * 24 * 3600;
const MAX_FAILS = 30; // failed logins allowed per window, across all visitors
const FAIL_WINDOW_MS = 15 * 60_000;
const MIN_PASSWORD = 12;
const MIN_SECRET = 32;

/** Reads the hosting settings. `problem` is set when the server must not start, because it would be open to anyone. */
export function hostingConfig(env = process.env) {
  const exposed = !!env.RENDER;
  const password = env.AE_LOGIN_PASSWORD ?? '';
  const secret = env.AE_SESSION_SECRET ?? '';
  let problem = null;
  if (exposed && password.length < MIN_PASSWORD) problem = `AE_LOGIN_PASSWORD must be set to at least ${MIN_PASSWORD} characters. Refusing to start without a login.`;
  else if (exposed && secret.length < MIN_SECRET) problem = `AE_SESSION_SECRET must be set to at least ${MIN_SECRET} random characters. Refusing to start without a login.`;
  else if (password && !secret) problem = 'AE_SESSION_SECRET must be set when AE_LOGIN_PASSWORD is set.';
  return { exposed, host: exposed ? '0.0.0.0' : '127.0.0.1', name: env.AE_LOGIN_NAME || 'admin', password, secret, secure: exposed, problem };
}

const same = (a, b) => {
  const x = createHmac('sha256', 'compare').update(String(a)).digest();
  const y = createHmac('sha256', 'compare').update(String(b)).digest();
  return timingSafeEqual(x, y);
};

function json(res, code, obj, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(obj));
}

async function readBody(req, limit = 4096) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) return null;
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return null;
  }
}

/** Guards /api. handle() answers the login routes and refuses anyone not logged in; it returns false to let a request through. */
export function createGate({ name, password, secret, secure }, now = () => Date.now()) {
  const on = !!password;
  // Tied to the password, so changing it logs everyone out.
  const sign = (exp) => createHmac('sha256', secret).update(`${exp}:${password}`).digest('base64url');
  const flags = `Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
  let fails = [];

  const validSession = (req) => {
    const value = (req.headers.cookie ?? '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!value) return false;
    const [exp, sig] = value.split('.');
    return Number(exp) * 1000 > now() && !!sig && same(sig, sign(exp));
  };

  return async function handle(req, res, url) {
    if (!url.pathname.startsWith('/api/')) return false;
    // A page on another site can't make a logged-in browser change anything here.
    if (req.method !== 'GET' && req.headers.origin) {
      let host = null;
      try {
        host = new URL(req.headers.origin).host;
      } catch {
        /* an unreadable origin counts as foreign */
      }
      if (host !== req.headers.host) return json(res, 403, { ok: false, refused: true, summary: 'Request came from another site.' }), true;
    }
    if (url.pathname === '/api/session' && req.method === 'GET') return json(res, 200, { signedIn: !on || validSession(req), loginRequired: on }), true;
    if (url.pathname === '/api/login' && req.method === 'POST') {
      if (!on) return json(res, 200, { ok: true }), true;
      fails = fails.filter((t) => now() - t < FAIL_WINDOW_MS);
      if (fails.length >= MAX_FAILS) return json(res, 429, { ok: false, summary: 'Too many failed logins. Try again in 15 minutes.' }), true;
      const body = await readBody(req);
      const nameOk = same(String(body?.name ?? '').trim().toLowerCase(), name.toLowerCase());
      const passwordOk = same(body?.password ?? '', password);
      if (!nameOk || !passwordOk) {
        fails.push(now());
        return json(res, 401, { ok: false, summary: 'That name or password is wrong.' }), true;
      }
      const exp = String(Math.floor(now() / 1000) + SESSION_SECONDS);
      return json(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=${exp}.${sign(exp)}; Max-Age=${SESSION_SECONDS}; ${flags}` }), true;
    }
    if (url.pathname === '/api/logout' && req.method === 'POST') return json(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; Max-Age=0; ${flags}` }), true;
    if (on && !validSession(req)) return json(res, 401, { ok: false, refused: true, signedOut: true, summary: 'Please log in.' }), true;
    return false;
  };
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};
const PAGE_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' };

/** Serves the built dashboard: a real file if there is one, otherwise index.html so links like /sites/site-007 open. */
export async function serveDashboard(req, res, url, dist) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { ok: false, summary: 'Method not allowed.' });
  const root = resolve(dist);
  let file = null;
  try {
    const wanted = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (wanted.startsWith(root + sep) && (await stat(wanted)).isFile()) file = wanted;
  } catch {
    /* no such file, or an unreadable path: fall through to the app */
  }
  file ??= resolve(root, 'index.html');
  let data;
  try {
    data = await readFile(file);
  } catch {
    return json(res, 404, { ok: false, summary: 'The dashboard has not been built. Run: npm run build' });
  }
  const cache = file.startsWith(resolve(root, 'assets') + sep) ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': cache, ...PAGE_HEADERS });
  res.end(req.method === 'HEAD' ? undefined : data);
}
