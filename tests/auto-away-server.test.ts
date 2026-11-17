// Auto keeps farming after a dropped connection (owner 2026-11-17), on the real server: a drop with
// Auto on keeps the character in the world (shown "away" on /admin), logging in again takes it back
// at the same spot with Auto still on (never twice in the world), a guest who drops leaves as before,
// leaving on purpose leaves at once, the time running out (AUTO_AWAY_TEST_MS) and the /admin switch
// both end it, and the server log says why each connection ended. Plus the /admin settings' checks.
// Runs its own game server on a free port with a throwaway database.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { finish, ok } from './check';
import { checkAutoTuning, codeAuto, autoChanges, mergeAuto } from '../src/shared/autoTuning';
import { WS_CLOSE_PAGE_GONE, WS_CLOSE_QUIT } from '../src/shared/net/protocol';

// ---------------------------------------------------------- the /admin settings (no server needed)
ok(codeAuto().offline === true && codeAuto().offlineMin === 30, 'code defaults: on, 30 minutes');
const t1 = checkAutoTuning({ offline: false, offlineMin: 45 }, true);
ok('tuning' in t1 && t1.tuning?.offline === false && t1.tuning.offlineMin === 45, 'switch off + 45 min are saved');
const t2 = checkAutoTuning({ offline: true, offlineMin: 30 }, true);
ok('tuning' in t2 && t2.tuning === undefined, 'values equal to the code are not saved');
ok('error' in checkAutoTuning({ offlineMin: 0 }, true) && 'error' in checkAutoTuning({ offlineMin: 241 }, true), 'minutes outside 1–240 refused');
ok('error' in checkAutoTuning({ offline: 'no' }, true), 'a switch that is not on/off refused');
const merged = mergeAuto({ offline: false, offlineMin: 10 });
ok(merged.offline === false && merged.offlineMin === 10, 'merged config uses the saved values');
ok(autoChanges(codeAuto(), merged).length === 2, 'both changes make an audit line');

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-auto-away-test-'));
const DB_FILE = join(dir, 'test.db');
const AWAY_MS = 3000;
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
  env: { ...process.env, PORT: String(PORT), DB_FILE, AUTO_AWAY_TEST_MS: String(AWAY_MS) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
let log = '';
server.stdout!.on('data', (b: Buffer) => {
  log += b.toString();
});

async function api(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: (await r.json().catch(() => ({}))) as any };
}

function joinWorld(token: string, characterId: number, back?: object) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  const ready = new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', token, characterId, ...(back ? { back } : {}) })));
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      msgs.push(m);
      if (m.t === 'snap') {
        clearTimeout(t);
        res();
      }
    });
  });
  const act = (o: object) => ws.send(JSON.stringify({ t: 'act', ...o }));
  const welcome = () => msgs.find((m) => m.t === 'welcome');
  const lastZone = () => msgs.filter((m) => m.t === 'zone').at(-1);
  const pos = () => {
    const snap = msgs.filter((m) => m.t === 'snap').at(-1);
    const you = lastZone()?.you ?? welcome()?.you;
    return snap?.players.find((p: any) => p.id === you) as { x: number; z: number } | undefined;
  };
  return { ws, msgs, ready, act, welcome, lastZone, pos };
}

async function account(user: string, name: string) {
  const reg = await api('POST', '/register', { username: user, password: 'secret123' });
  const tok = reg.data.token as string;
  await api('POST', '/characters', { name, classId: 'sword' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number; name: string }[];
  return { tok, id: chars.find((c) => c.name === name)!.id };
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
  const owner = await account('awowner', 'Boss');
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'awowner', 'owner'], {
    cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8',
  });
  ok(cli.status === 0, 'awowner is owner');
  const online = async () => (await api('GET', '/admin/online', undefined, owner.tok)).data.players as any[];
  const rowsOf = async (name: string) => (await online()).filter((p) => p.name === name);
  const warp = (charId: number) => api('POST', `/admin/characters/${charId}/teleport`, { zone: 'emerald_forest' }, owner.tok);
  /** Joins, goes to the forest and turns Auto on. */
  const farm = async (tok: string, id: number) => {
    const c = joinWorld(tok, id);
    await c.ready;
    await warp(id);
    await sleep(500);
    c.act({ a: 'auto', on: true });
    await sleep(500);
    return c;
  };

  // ---------------------------------------------------------- a drop with Auto on: the character stays
  const a = await account('awava', 'Ava');
  const A = await farm(a.tok, a.id);
  ok(A.lastZone()?.zone === 'emerald_forest' && !A.msgs.some((m) => m.t === 'snap' && m.events?.some((e: any) => e.t === 'autoOff')), 'Ava farms with Auto in the forest');
  A.ws.terminate();
  await sleep(1200);
  let rows = await rowsOf('Ava');
  ok(rows.length === 1 && rows[0].away === true && rows[0].zone === 'emerald_forest', `after the drop Ava is still in the world, shown away (${JSON.stringify(rows)})`);
  ok(/Ava\) dropped \(close 1006 .*\) — Auto keeps farming/.test(log), `the log says she dropped (close 1006) and Auto keeps farming (${log.split('\n').find((l) => l.includes('Ava) dropped'))})`);

  // ---------------------------------------------------------- logging in again takes it back
  const spot = A.pos();
  const A2 = joinWorld(a.tok, a.id, { code: 1006, downMs: 1200, tries: 1, hiddenMs: 5000 });
  await A2.ready;
  rows = await rowsOf('Ava');
  const p2 = A2.pos();
  ok(A2.welcome()?.auto === true && A2.welcome()?.zone === 'emerald_forest', 'back in: same map, and the welcome says Auto is on');
  ok(!!spot && !!p2 && Math.hypot(spot.x - p2.x, spot.z - p2.z) < 12, `back where she was farming (she kept walking meanwhile) (${JSON.stringify(spot)} → ${JSON.stringify(p2)})`);
  ok(rows.length === 1 && !rows[0].away, 'only once in the world, no longer away');
  ok(/taken back after farming/.test(log) && /reconnected: browser saw close 1006, cut off 1 s, try 1, tab hidden 5 s before the drop/.test(log), 'the log: taken back, with what the browser said');
  await sleep(600);
  const snap = A2.msgs.filter((m) => m.t === 'snap').at(-1);
  ok(snap?.me?.serverMoves === true, 'Auto still runs after the takeover (the server moves her)');

  // ---------------------------------------------------------- the time runs out
  A2.ws.terminate();
  await sleep(1000);
  ok((await rowsOf('Ava'))[0]?.away === true, 'dropped again: away');
  await sleep(AWAY_MS + 1500);
  ok((await rowsOf('Ava')).length === 0, 'time up: she left the world');
  ok(/Ava\) left: Auto away ended: time up/.test(log), 'the log says the time was up');

  // ---------------------------------------------------------- leaving on purpose: gone at once
  const A3 = await farm(a.tok, a.id);
  A3.ws.close(WS_CLOSE_QUIT, 'quit');
  await sleep(600);
  ok((await rowsOf('Ava')).length === 0 && /Ava\) left: quit/.test(log), 'leaving on purpose with Auto on: gone at once (log: quit)');

  // ---------------------------------------------------------- closing the tab: gone at once too (owner 2026-11-17)
  const A3b = await farm(a.tok, a.id);
  A3b.ws.close(WS_CLOSE_PAGE_GONE, 'page closed');
  await sleep(600);
  ok((await rowsOf('Ava')).length === 0 && /Ava\) left: page closed \(tab closed \/ reload\), Auto was on/.test(log), 'closing the tab with Auto on: gone at once, no farming on (log: page closed)');
  const A3c = joinWorld(a.tok, a.id);
  await A3c.ready;
  ok(A3c.welcome()?.zone === 'emerald_forest' && A3c.welcome()?.auto === true, 'a reload within 60 s: same map, Auto on again (counts as a drop, not a quit)');
  A3c.ws.close(WS_CLOSE_QUIT, 'quit');
  await sleep(400);

  // ---------------------------------------------------------- a guest who drops leaves as before
  const g = await api('POST', '/guest', { name: 'AwGuest', classId: 'sword' });
  const G = await farm(g.data.token, g.data.character.id);
  G.ws.terminate();
  await sleep(800);
  ok((await rowsOf('AwGuest')).length === 0, 'a guest who drops with Auto on leaves the world as before');
  ok(/AwGuest\) left: drop \(close 1006/.test(log), 'the log: drop with its close code');

  // ---------------------------------------------------------- the /admin switch off ends it
  const A4 = await farm(a.tok, a.id);
  A4.ws.terminate();
  await sleep(800);
  ok((await rowsOf('Ava'))[0]?.away === true, 'away again');
  const cur = (await api('GET', '/admin/balance', undefined, owner.tok)).data.tuning ?? {};
  const saved = await api('POST', '/admin/balance', { tuning: { ...cur, auto: { ...(cur.auto ?? {}), offline: false } } }, owner.tok);
  ok(saved.status === 200, `the owner switches it off (${saved.status} ${JSON.stringify(saved.data).slice(0, 120)})`);
  await sleep(1500);
  ok((await rowsOf('Ava')).length === 0 && /Auto away ended: switched off/.test(log), 'switched off: the away character leaves');
  const A5 = await farm(a.tok, a.id);
  A5.ws.terminate();
  await sleep(800);
  ok((await rowsOf('Ava')).length === 0, 'switched off: a drop with Auto on leaves at once');
  const audit = await api('GET', '/admin/audit', undefined, owner.tok);
  ok(audit.data.some((r: any) => r.action === 'balance' && String(r.details).includes('ฟาร์มต่อหลังหลุด')), 'the change is in the audit log');
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
// SHOW_LOG=1: print the server's connection lines (to see what the owner will read).
if (process.env.SHOW_LOG) console.log(log.split('\n').filter((l) => l.startsWith('[world]')).join('\n'));
finish('auto-away-server');
