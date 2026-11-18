// Click-to-walk carries on in a hidden tab (owner 2026-11-18), on the real server: an input with a
// clicked spot (`to`) and then silence (a hidden tab sends nothing) → the server walks there and stops;
// an input without `to` and then silence → the character stays put (a stalled connection doesn't walk);
// an input without a position while the server walks (the browser is back and follows) ends the walk;
// bad spots are refused; the /admin switch off = stops as before. Plus the /admin settings' checks.
// Runs its own game server on a free port with a throwaway database.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { finish, ok } from './check';
import { balanceChanges, checkBalance, codeBalance, mergeBalance } from '../src/shared/balance';
import { ZONES } from '../src/shared/data/zones';
import { Terrain } from '../src/shared/sim/terrain';

// ---------------------------------------------------------- the /admin settings (no server needed)
ok(codeBalance().walkHidden === true, 'code default: on');
const t1 = checkBalance({ walkHidden: false }, true);
ok('tuning' in t1 && t1.tuning?.walkHidden === false, `switch off is saved (${JSON.stringify(t1)})`);
const t2 = checkBalance({ walkHidden: true }, true);
ok('tuning' in t2 && t2.tuning?.walkHidden === undefined, 'on (the code value) is not saved');
ok('error' in checkBalance({ walkHidden: 'no' }, true), 'a switch that is not on/off refused');
ok(mergeBalance({ walkHidden: false }).walkHidden === false, 'merged config uses the saved value');
ok(balanceChanges({}, { walkHidden: false }).includes('เดินต่อเมื่อสลับแท็บ'), 'the change makes a Thai audit line');

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-walk-hidden-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PORT = await new Promise<number>((res, rej) => {
  const s = createServer();
  s.once('error', rej);
  s.listen(0, () => {
    const port = (s.address() as { port: number }).port;
    s.close(() => res(port));
  });
});
const BASE = `http://localhost:${PORT}`;
const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DB_FILE },
  stdio: ['ignore', 'pipe', 'inherit'],
});
server.stdout!.on('data', () => {});

async function api(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: (await r.json().catch(() => ({}))) as any };
}

function joinWorld(token: string, characterId: number) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  const ready = new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', token, characterId })));
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      msgs.push(m);
      if (m.t === 'snap') {
        clearTimeout(t);
        res();
      }
    });
  });
  const welcome = () => msgs.find((m) => m.t === 'welcome');
  const snaps = () => msgs.filter((m) => m.t === 'snap');
  const pos = () => {
    const you = welcome()?.you;
    return snaps().at(-1)?.players.find((p: any) => p.id === you) as { x: number; z: number };
  };
  let seq = 0;
  /** One input message, standing at `at` (no position: following the server). */
  const input = (at: { x: number; z: number } | undefined, to?: unknown) =>
    ws.send(JSON.stringify({ t: 'input', pos: at, seq: ++seq, move: null, aim: at ?? { x: 0, z: 0 }, basic: false, skills: [], dash: false, potion: null, to }));
  return { ws, msgs, ready, welcome, snaps, pos, input };
}

async function run(): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      await fetch(`${BASE}/api/me`);
      break;
    } catch {
      if (i > 100) throw new Error('test server did not start');
      await sleep(100);
    }
  }
  const reg = await api('POST', '/register', { username: 'whowner', password: 'secret123' });
  const tok = reg.data.token as string;
  await api('POST', '/characters', { name: 'Walker', classId: 'sword' }, tok);
  const id = ((await api('GET', '/characters', undefined, tok)).data as { id: number }[])[0].id;
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'whowner', 'owner'], {
    cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8',
  });
  ok(cli.status === 0, 'whowner is owner');

  const C = joinWorld(tok, id);
  await C.ready;
  const terrain = new Terrain(ZONES[C.welcome().zone]);
  /** A spot `dist` away from where we stand with nothing in the way (so the straight walk gets there). */
  const clearSpot = (dist: number) => {
    const at = C.pos();
    for (let a = 0; a < 32; a++) {
      const ang = (a / 32) * Math.PI * 2;
      const to = { x: at.x + Math.cos(ang) * dist, z: at.z + Math.sin(ang) * dist };
      let clear = true;
      for (let k = 1; k <= 40 && clear; k++) {
        const f = k / 40;
        if (terrain.isBlocked(at.x + (to.x - at.x) * f, at.z + (to.z - at.z) * f, 1)) clear = false;
      }
      if (clear) return to;
    }
    throw new Error('no open ground around the spawn');
  };
  const near = (a: { x: number; z: number }, b: { x: number; z: number }, d: number) => Math.hypot(a.x - b.x, a.z - b.z) <= d;
  const lastMoves = () => C.snaps().at(-1)?.me?.serverMoves;

  // ---------------------------------------------------------- a clicked spot, then silence: walks there
  let start = C.pos();
  let to = clearSpot(6);
  C.input(start, to);
  await sleep(250);
  ok(near(C.pos(), start, 0.05), 'still fresh input: the server does not walk by itself yet');
  const before = C.snaps().length;
  await sleep(3500);
  ok(near(C.pos(), to, 0.3), `silent after a click: the server walked to the spot (${JSON.stringify(C.pos())} → ${JSON.stringify(to)})`);
  ok(C.snaps().slice(before).some((s) => s.me?.serverMoves === true), 'the snapshots said the server moves us while it walked');
  ok(lastMoves() === false, 'arrived: the server no longer moves us (the browser takes over again)');

  // ---------------------------------------------------------- no clicked spot, then silence: stays put
  start = C.pos();
  C.input(start);
  await sleep(1500);
  ok(near(C.pos(), start, 0.05), 'silent without a clicked spot: the character stays put (a stalled connection does not walk)');

  // ---------------------------------------------------------- bad spots are refused
  for (const bad of [{ x: 'a', z: 1 }, { x: 1e9, z: 0 }, { x: null, z: 0 }, 'far', [1, 2], { x: 0 }]) {
    start = C.pos();
    C.input(start, bad);
    await sleep(900);
    ok(near(C.pos(), start, 0.05) && lastMoves() === false, `a bad spot (${JSON.stringify(bad)}) is refused: no walking`);
  }
  start = C.pos();
  C.input(start, { x: terrain.bound + 50, z: start.z });
  await sleep(900);
  ok(near(C.pos(), start, 0.05), 'a spot outside the map is refused');

  // ---------------------------------------------------------- back in the tab: an input without a position ends the walk
  start = C.pos();
  to = clearSpot(12);
  C.input(start, to);
  await sleep(1200);
  const mid = C.pos();
  ok(!near(mid, start, 0.3) && lastMoves() === true, 'the server is walking us to a far spot');
  // A browser following the server keeps sending (without a position) every frame or so.
  const follow = async (ms: number) => {
    for (let t = 0; t < ms; t += 100) {
      C.input(undefined, to);
      await sleep(100);
    }
  };
  await follow(300);
  const stopped = C.pos();
  await follow(500);
  ok(near(C.pos(), stopped, 0.05) && !near(stopped, to, 1) && lastMoves() === false, 'the browser follows again (no position): the server walk ends where it was');
  // The browser glides onto the server's spot and walks on itself: its positions count again.
  C.input(stopped, to);
  C.input({ x: stopped.x + (to.x - stopped.x) * 0.02, z: stopped.z + (to.z - stopped.z) * 0.02 }, to);
  await sleep(300);
  ok(!near(C.pos(), stopped, 0.01), 'after the walk ended the browser\'s own positions are taken again');

  // ---------------------------------------------------------- the /admin switch off: stops as before
  const cur = (await api('GET', '/admin/balance', undefined, tok)).data.tuning ?? {};
  const saved = await api('POST', '/admin/balance', { tuning: { ...cur, walkHidden: false } }, tok);
  ok(saved.status === 200, `the owner switches it off (${saved.status} ${JSON.stringify(saved.data).slice(0, 120)})`);
  await sleep(300);
  start = C.pos();
  to = clearSpot(6);
  C.input(start, to);
  await sleep(2000);
  ok(near(C.pos(), start, 0.05) && lastMoves() === false, 'switched off: silent after a click = the character stops as before');
  const audit = await api('GET', '/admin/audit', undefined, tok);
  ok(audit.data.some((r: any) => r.action === 'balance' && String(r.details).includes('เดินต่อเมื่อสลับแท็บ')), 'the change is in the audit log');
  C.ws.close();
}

try {
  await run();
} catch (e) {
  ok(false, `test crashed: ${(e as Error).stack}`);
} finally {
  if (server.exitCode === null) {
    server.kill();
    await new Promise((r) => server.once('exit', r));
  }
  rmSync(dir, { recursive: true, force: true });
}
finish('walk-hidden-server');
