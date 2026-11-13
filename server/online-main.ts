// npm run online (after vite build) and npm run always-on (no build; what the Windows startup task runs,
// see tools/autostart.ps1): runs the game server and the friends' link, and keeps both up.
//
// How the server ends decides what happens next:
//   - exit 0 (npm run stop-server, the admin page's "ปิด server", Ctrl+C twice): stop for good, link too.
//   - RESTART_EXIT_CODE (admin "รีสตาร์ท", npm run stop-server -- --restart): start again right away on
//     the code already built in dist/ (no rebuild).
//   - anything else (a crash): start again after a pause that grows while it keeps crashing.
// cloudflared is started again too whenever it dies. A `npm run tunnel` window that is already up is used
// (and watched: if it closes, this process opens the link itself).
//
// Everything is also written to server/data/logs/online-YYYY-MM-DD.log (npm run logs), since the
// startup task has no window. Only one copy runs at a time (a localhost port is held as the lock).
import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection, createServer } from 'node:net';
import { resolve } from 'node:path';
import { format } from 'node:util';
import { fileURLToPath } from 'node:url';
import { announceShared, clearTunnelState, runningTunnel, startTunnel } from './tunnel';
import { LogFile, logDir } from './logfile';
import { RESTART_EXIT_CODE } from '../src/shared/net/protocol';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 2567);
/** Held while this runs so a second copy (e.g. the startup task plus a manual npm run online) refuses. */
const LOCK_PORT = Number(process.env.ONLINE_LOCK_PORT ?? PORT + 10000);
/** Started by the Windows task: no window, no keyboard. */
const ALWAYS_ON = process.argv.includes('--always-on');
const NO_TUNNEL = process.argv.includes('--no-tunnel');
/** A run at least this long counts as healthy: the crash pause starts over from the shortest. */
const HEALTHY_MS = 10 * 60 * 1000;
/** Pause before starting again after a crash, growing with each crash in a row (seconds). */
const BACKOFF_S = [5, 10, 30, 60, 120, 300];

// Everything printed here (the link box included) goes to the log file; also to the screen when there is one.
const log = new LogFile(logDir(ROOT), !ALWAYS_ON || !!process.stdout.isTTY);
console.log = (...a: unknown[]) => log.line(format(...a));
console.error = (...a: unknown[]) => log.line(format(...a));
const say = (msg: string) => console.log(`[online] ${msg}`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Something answering on 127.0.0.1:port? (a server from before that was not stopped, or another program) */
function portBusy(port: number): Promise<boolean> {
  return new Promise((done) => {
    const s = createConnection({ port, host: '127.0.0.1' });
    s.once('connect', () => (s.destroy(), done(true)));
    s.once('error', () => done(false));
    s.setTimeout(2000, () => (s.destroy(), done(false)));
  });
}

// ------------------------------------------------------------ one copy only

const lock = createServer();
const locked = await new Promise<boolean>((done) => {
  lock.once('error', () => done(false));
  lock.listen(LOCK_PORT, '127.0.0.1', () => done(true));
});
if (!locked) {
  say(`มี npm run online / always-on เปิดอยู่แล้ว (port ล็อก ${LOCK_PORT} ถูกใช้) — ไม่เปิดซ้ำ`);
  process.exit(0);
}
say(`เริ่ม${ALWAYS_ON ? ' (always-on, เปิดเองตอนบูต)' : ''} — pid ${process.pid}, port ${PORT}, log: ${logDir(ROOT)}`);

// ------------------------------------------------------------ server

let child: ChildProcess | null = null;
let stopping = false;

function runServer(): Promise<number> {
  return new Promise((done) => {
    // node --import tsx, not the tsx CLI: Ctrl+C then reaches the server itself, which counts down.
    // Output comes through here (time stamps + log file); the keyboard goes straight to the server (c / f).
    const c = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
      cwd: ROOT,
      stdio: [ALWAYS_ON ? 'ignore' : 'inherit', 'pipe', 'pipe'],
      env: { ...process.env, MULTIVERSE_SUPERVISED: '1' },
      windowsHide: true,
      // always-on: on Windows a child that isn't detached dies the moment this process dies (e.g. "End" in
      // Task Scheduler), with no countdown or save. Detached it keeps running; stop it with npm run
      // stop-server, and a new copy of this waits until its port is free. (Not with a window: Ctrl+C must
      // reach the server there.)
      detached: ALWAYS_ON,
    });
    child = c;
    c.stdout?.setEncoding('utf8').on('data', (s: string) => log.write(s));
    c.stderr?.setEncoding('utf8').on('data', (s: string) => log.write(s));
    c.on('error', (e) => say(`เปิด server ไม่ได้: ${e.message}`));
    c.on('close', (code, signal) => {
      child = null;
      done(code ?? (signal ? 1 : 0));
    });
  });
}

// Ctrl+C reaches every process in the window (the server included), so it isn't forwarded: passing it
// on would make one press count as two. The server decides (press twice to stop). SIGTERM is passed on,
// except on Windows, where child.kill() would end the server at once without the warning.
process.on('SIGINT', () => {});
process.on('SIGTERM', () => {
  if (process.platform !== 'win32') child?.kill('SIGTERM');
});

// ------------------------------------------------------------ friends' link

let tunnel: ChildProcess | null = null;
let tunnelFails = 0;

async function keepTunnel(): Promise<void> {
  while (!stopping) {
    const shared = runningTunnel(PORT);
    if (shared) {
      // Someone else's (npm run tunnel, or one left from before): use it, and take over if it closes.
      announceShared(shared);
      while (!stopping && runningTunnel(PORT)) await sleep(15_000);
      if (!stopping) say('ลิงก์สำหรับเพื่อน (หน้าต่างอื่น) ปิดไปแล้ว — เปิดลิงก์เอง');
      continue;
    }
    const started = Date.now();
    const t = await startTunnel(PORT, { shared: true, keptBy: ALWAYS_ON ? 'always-on' : 'npm run online', supervised: true });
    if (t) {
      tunnel = t;
      await new Promise<void>((r) => (t.exitCode !== null ? r() : t.once('exit', () => r())));
      tunnel = null;
    }
    if (stopping) return;
    tunnelFails = Date.now() - started >= HEALTHY_MS ? 1 : tunnelFails + 1;
    const wait = BACKOFF_S[Math.min(tunnelFails, BACKOFF_S.length) - 1];
    say(`ลิงก์สำหรับเพื่อนหลุด — เปิดใหม่ใน ${wait} วินาที`);
    await sleep(wait * 1000);
  }
}

if (NO_TUNNEL) say('--no-tunnel: ไม่เปิดลิงก์สำหรับเพื่อน');
else void keepTunnel();

// ------------------------------------------------------------ main loop

let crashes = 0;
let code = 0;
for (;;) {
  // A server left running without this (e.g. after "End" in Task Scheduler) is not taken over: waiting for
  // its port would start a new one after npm run stop-server, which must stop for good.
  if (await portBusy(PORT)) {
    say(`port ${PORT} มีโปรแกรมอื่นใช้อยู่ (server ตัวเก่ายังเปิดอยู่?) — ไม่เปิดซ้ำ · ปิดตัวนั้นด้วย npm run stop-server ก่อน`);
    code = 1;
    break;
  }
  const started = Date.now();
  code = await runServer();
  const ran = Date.now() - started;
  if (code === 0) {
    say('server ปิดแล้ว (ตั้งใจปิด) — ไม่เปิดใหม่');
    break;
  }
  if (code === RESTART_EXIT_CODE && ran >= 5000) {
    crashes = 0;
    say('รีสตาร์ท server (ใช้โค้ดที่ build ไว้แล้ว) …');
    continue;
  }
  crashes = ran >= HEALTHY_MS ? 1 : crashes + 1;
  const wait = BACKOFF_S[Math.min(crashes, BACKOFF_S.length) - 1];
  say(`⚠ server ดับเอง (exit code ${code}, รันได้ ${Math.round(ran / 1000)} วินาที, ครั้งที่ ${crashes} ติดกัน) — เปิดใหม่ใน ${wait} วินาที`);
  await sleep(wait * 1000);
}

stopping = true;
const t = tunnel as ChildProcess | null;
if (t) {
  t.kill();
  clearTunnelState();
}
lock.close();
process.exit(code);
