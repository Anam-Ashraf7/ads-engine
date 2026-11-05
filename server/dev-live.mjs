// Runs the Google Ads test server and the Vite dev server together; Ctrl+C stops both.
import { spawn } from 'node:child_process';

const procs = [
  ['api ', process.execPath, ['server/gads-server.mjs']],
  ['vite', process.execPath, ['node_modules/vite/bin/vite.js']],
].map(([tag, cmd, args]) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const out = (s) => s.toString().split(/\r?\n/).filter(Boolean).forEach((l) => console.log(`[${tag}] ${l}`));
  p.stdout.on('data', out);
  p.stderr.on('data', out);
  p.on('exit', (code) => {
    console.log(`[${tag}] stopped (${code})`);
    procs.forEach((q) => q.kill());
    process.exit(code ?? 0);
  });
  return p;
});
process.on('SIGINT', () => procs.forEach((p) => p.kill()));
