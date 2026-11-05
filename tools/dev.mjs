// `npm run dev`: the game on Vite (http://localhost:5173) plus a game server of its own, so anyone can
// test changes on their PC without touching the real server.
//
// - The dev server listens on port 2568 (not 2567, which `npm run online` uses) and keeps its own
//   database in server/data/dev.db, so it can run next to the real server on the same computer.
// - It restarts by itself when server code (server/ or src/shared/) changes (tsx watch).
// - Vite forwards /api and the game's WebSocket to it (vite.config.js).
// Override with DEV_SERVER_PORT / DEV_DB_FILE if needed.
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = process.env.DEV_SERVER_PORT ?? '2568';
const DB_FILE = resolve(ROOT, process.env.DEV_DB_FILE ?? 'server/data/dev.db');
const env = { ...process.env, PORT, DB_FILE, DEV_SERVER_PORT: PORT };

const children = [
  spawn(process.execPath, [resolve(ROOT, 'node_modules/tsx/dist/cli.mjs'), 'watch', '--clear-screen=false', 'server/main.ts'], { cwd: ROOT, env, stdio: 'inherit' }),
  spawn(process.execPath, [resolve(ROOT, 'node_modules/vite/bin/vite.js')], { cwd: ROOT, env, stdio: 'inherit' }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (c.exitCode !== null) continue;
    // tsx watch runs the server as a child of its own; on Windows kill() would leave that one running.
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
    else c.kill();
  }
  setTimeout(() => process.exit(code), 500);
}
// If either one stops (crash, or Ctrl+C), stop the other too.
for (const c of children) c.on('exit', (code) => stop(code ?? 0));
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
