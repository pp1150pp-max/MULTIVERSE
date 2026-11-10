// Channels on the real server: the GM warp into a chosen channel (and its audit line), the channel
// window's list, refused switches, "go to the same channel" only for friends / party members, and a
// dropped connection coming back into the same map, channel and spot (while quitting starts in the hub).
// Runs its own game server on a free port with a throwaway database.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-channels-test-'));
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
  stdio: ['ignore', 'ignore', 'inherit'],
});

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
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId }));
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      msgs.push(m);
      if (m.t === 'snap') {
        clearTimeout(t);
        res();
      }
    };
  });
  const act = (o: object) => ws.send(JSON.stringify({ t: 'act', ...o }));
  const lines = () => msgs.filter((m) => m.t === 'chat').map((m) => m.text as string);
  const welcome = () => msgs.find((m) => m.t === 'welcome');
  const lastZone = () => msgs.filter((m) => m.t === 'zone').at(-1);
  /** Your own position in the latest snapshot. */
  const pos = () => {
    const snap = msgs.filter((m) => m.t === 'snap').at(-1);
    const you = lastZone()?.you ?? welcome()?.you;
    return snap?.players.find((p: any) => p.id === you) as { x: number; z: number } | undefined;
  };
  return { ws, msgs, ready, act, lines, welcome, lastZone, pos };
}

async function account(user: string, ...names: string[]) {
  const reg = await api('POST', '/register', { username: user, password: 'secret123' });
  const tok = reg.data.token as string;
  for (const n of names) await api('POST', '/characters', { name: n, classId: 'sword' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number; name: string }[];
  return { tok, id: (n: string) => chars.find((c) => c.name === n)!.id };
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
  const owner = await account('chowner');
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'chowner', 'owner'], {
    cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8',
  });
  ok(cli.status === 0, 'chowner is owner');
  const a = await account('chpia', 'Pia');
  const b = await account('chquin', 'Quin');
  const warp = (charId: number, body: object) => api('POST', `/admin/characters/${charId}/teleport`, body, owner.tok);

  const P = joinWorld(a.tok, a.id('Pia'));
  const Q = joinWorld(b.tok, b.id('Quin'));
  await Promise.all([P.ready, Q.ready]);
  ok(P.welcome()?.zone === 'nexus_city' && P.welcome()?.ch === 1, 'joining: the hub, CH 1');

  // ---------------------------------------------------------- GM warp into a channel
  ok((await warp(a.id('Pia'), { zone: 'emerald_forest', ch: 2 })).status === 400, 'warp into a channel that is not open: refused');
  ok((await warp(a.id('Pia'), { zone: 'nexus_city', ch: 1 })).status === 400, 'choosing a CH on a map without channels: refused');
  ok((await warp(a.id('Pia'), { zone: 'emerald_forest', ch: 'x' })).status === 400, 'a CH that is not a number: refused');
  const w = await warp(a.id('Pia'), { zone: 'emerald_forest', ch: 1 });
  await sleep(400);
  ok(w.status === 200 && P.lastZone()?.zone === 'emerald_forest' && P.lastZone()?.ch === 1, `GM warp into CH 1 (${w.status} ${w.data.msg})`);
  ok((await warp(a.id('Pia'), { zone: 'emerald_forest', ch: 1 })).status === 400, 'warp into the channel already in: refused');
  await warp(b.id('Quin'), { zone: 'emerald_forest' });
  await sleep(400);
  ok(Q.lastZone()?.zone === 'emerald_forest' && Q.lastZone()?.ch === 1, 'warp without a CH: placed like anyone (CH 1)');
  const audit = await api('GET', '/admin/audit', undefined, owner.tok);
  ok(audit.data.some((r: any) => r.action === 'teleport' && String(r.details).includes('ป่ามรกต · CH 1') && String(r.details).includes('เลือก CH')), 'the warp is in the audit log with its CH');
  const online = await api('GET', '/admin/online', undefined, owner.tok);
  const row = online.data.zones.find((z: any) => z.id === 'emerald_forest' && z.ch === 1);
  ok(row?.count === 2 && online.data.players.find((p: any) => p.name === 'Pia')?.ch === 1, '/admin/online: players per channel, and each player\'s CH');

  // ---------------------------------------------------------- the channel window
  P.act({ a: 'chList' });
  await sleep(300);
  const view = P.msgs.filter((m) => m.t === 'channels').at(-1)?.view;
  ok(view?.zone === 'emerald_forest' && view.ch === 1 && view.list.length === 1 && view.list[0].n === 2, `the list: CH 1 with 2 players (${JSON.stringify(view)})`);
  P.act({ a: 'chSwitch', ch: 5 });
  await sleep(300);
  ok(P.lines().some((t) => t.includes('ไม่มีแชนแนลนี้')), 'switching to a channel that does not exist: refused');
  P.act({ a: 'chSwitch', ch: 1 });
  await sleep(300);
  ok(P.lines().some((t) => t.includes('อยู่แล้ว')), 'switching to your own channel: refused');
  P.act({ a: 'chJoin', name: 'Quin' });
  await sleep(300);
  ok(P.lines().some((t) => t.includes('เฉพาะเพื่อนหรือคนในปาร์ตี้')), '"ไปห้องเดียวกัน" with a stranger: refused');

  // ---------------------------------------------------------- reconnect
  // Where the server has Pia now: the rejoin must put the character back exactly there.
  const before = P.pos()!;
  P.ws.close(); // dropped (not code 4000)
  await sleep(400);
  const P2 = joinWorld(a.tok, a.id('Pia'));
  await P2.ready;
  await sleep(200);
  const at = P2.pos();
  ok(P2.welcome()?.zone === 'emerald_forest' && P2.welcome()?.ch === 1, `dropped and back within 60 s: same map and CH (${P2.welcome()?.zone} CH ${P2.welcome()?.ch})`);
  ok(!!at && Math.hypot(at.x - before.x, at.z - before.z) < 0.5, 'and the same spot');
  P2.ws.close(4000, 'quit');
  await sleep(400);
  const P3 = joinWorld(a.tok, a.id('Pia'));
  await P3.ready;
  ok(P3.welcome()?.zone === 'nexus_city', 'quitting on purpose: next time in the hub as usual');

  for (const s of [P3, Q]) s.ws.close(4000);
}

try {
  await run();
} catch (e) {
  ok(false, `test crashed: ${e instanceof Error ? e.message : e}`);
} finally {
  if (server.exitCode === null) {
    server.kill();
    await new Promise((r) => server.once('exit', r));
  }
  rmSync(dir, { recursive: true, force: true });
}
finish('channels-server');
