// npm run online (after vite build): runs the game server and starts it again whenever it exits with
// RESTART_EXIT_CODE (the admin page's "รีสตาร์ท", or npm run stop-server -- --restart). A restart
// runs the code that is already built in dist/; it does not rebuild.
//
// The friends' link lives here rather than in the server, so a restart keeps it. If a
// `npm run tunnel` window is already up, its link is used instead.
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { announceShared, clearTunnelState, runningTunnel, startTunnel } from './tunnel';
import { RESTART_EXIT_CODE } from '../src/shared/net/protocol';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 2567);
/** Don't restart in a loop when the server dies right after starting. */
const MIN_RUN_MS = 5000;

let child: ChildProcess | null = null;

function runServer(): Promise<number> {
  return new Promise((done) => {
    // node --import tsx, not the tsx CLI: Ctrl+C then reaches the server itself, which counts down.
    const c = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, MULTIVERSE_SUPERVISED: '1' },
    });
    child = c;
    c.on('exit', (code, signal) => done(code ?? (signal ? 1 : 0)));
  });
}

// On Windows, Ctrl+C reaches every process in the window, the server included, so there is nothing to
// forward (and child.kill() there would end it at once, without the warning). Elsewhere, pass it on.
const forward = (sig: NodeJS.Signals) => () => {
  if (process.platform !== 'win32') child?.kill(sig);
};
process.on('SIGINT', forward('SIGINT'));
process.on('SIGTERM', forward('SIGTERM'));

let tunnel: ChildProcess | null = null;
const shared = runningTunnel(PORT);
// --no-tunnel: no friends' link (for trying this out on a test port).
if (process.argv.includes('--no-tunnel')) console.log('[online] --no-tunnel: ไม่เปิดลิงก์สำหรับเพื่อน');
else if (shared) announceShared(shared);
else void startTunnel(PORT, { shared: true, keptBy: 'npm run online' }).then((t) => (tunnel = t));

let code = 0;
for (;;) {
  const started = Date.now();
  code = await runServer();
  if (code !== RESTART_EXIT_CODE) break;
  if (Date.now() - started < MIN_RUN_MS) {
    console.log('\n[online] server ปิดตัวเร็วเกินไป — ไม่เปิดใหม่ให้อัตโนมัติ');
    break;
  }
  console.log('\n[online] รีสตาร์ท server (ใช้โค้ดที่ build ไว้แล้ว) …\n');
}
const t = tunnel as ChildProcess | null;
if (t) {
  t.kill();
  clearTunnelState();
}
process.exit(code === RESTART_EXIT_CODE ? 1 : code);
