// PROTOTYPE: one-time Google sign-in (loopback + PKCE) that saves a fresh refresh token to TOKEN_FILE.
// Run with `npm run login`, sign in in the browser tab it opens, then restart `npm run dev:live`.
// Never prints the token.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(resolve(HERE, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2];
}
const path = (p) => (isAbsolute(p) ? p : resolve(HERE, p));
const oauth = JSON.parse(readFileSync(path(env.CLIENT_FILE), 'utf8')).installed;
const tokenFile = path(env.TOKEN_FILE);

const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const state = randomBytes(16).toString('hex');

const server = createServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const redirectUri = `http://127.0.0.1:${server.address().port}`;
const url =
  `${oauth.auth_uri}?` +
  new URLSearchParams({
    client_id: oauth.client_id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/adwords',
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });

console.log('\nOpening Google sign-in in your browser. If it does not open, paste this link into Chrome:\n');
console.log(url + '\n');
exec(`start "" "${url}"`);
console.log('Waiting for you to sign in (10 minutes)...');

const code = await new Promise((done, fail) => {
  const timer = setTimeout(() => fail(new Error('Timed out after 10 minutes. Run npm run login again.')), 600_000);
  server.on('request', (req, res) => {
    const u = new URL(req.url, redirectUri);
    if (!u.searchParams.has('code') && !u.searchParams.has('error')) return res.end();
    clearTimeout(timer);
    if (u.searchParams.get('state') !== state) return res.end('State mismatch'), fail(new Error('State mismatch'));
    if (u.searchParams.get('error')) return res.end(`Sign-in failed: ${u.searchParams.get('error')}`), fail(new Error(u.searchParams.get('error')));
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Signed in. You can close this tab and go back to the terminal.</h2>');
    done(u.searchParams.get('code'));
  });
});
server.close();

const tok = await (
  await fetch(oauth.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: oauth.client_id, client_secret: oauth.client_secret, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier }),
  })
).json();
if (!tok.refresh_token) {
  console.log(`Sign-in did not return a saved login (${tok.error ?? 'no refresh token'}). Run npm run login again.`);
  process.exit(1);
}
mkdirSync(dirname(tokenFile), { recursive: true });
writeFileSync(tokenFile, tok.refresh_token);
console.log('\nDone: new Google login saved. Now restart the app with: npm run dev:live\n');
