// Minigame "รอดมอนเป็นระลอก" on a real game server this script starts itself on a free port with a throwaway database (never the real
// server or server/data), then stops: a map made with the minigame, published, entered (warp = same path as its door), its own run per
// group, the waves in the snapshot, the leave button back out, the switch off in /admin, and the run's numbers saved server-wide.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { WS_CLOSE_QUIT } from '../src/shared/net/protocol';
import type { MapData } from '../src/shared/mapSchema';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-wave-test-'));
const DB_FILE = join(dir, 'test.db');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer();
    s.once('error', rej);
    s.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => res(port));
    });
  });
}

const PORT = await freePort();
const BASE = `http://localhost:${PORT}`;
const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DB_FILE },
  stdio: ['ignore', 'ignore', 'inherit'],
});

async function stopServer(): Promise<void> {
  if (server.exitCode === null) {
    server.kill();
    await new Promise((r) => server.once('exit', r));
  }
  rmSync(dir, { recursive: true, force: true });
}

async function api(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: (await r.json().catch(() => ({}))) as any };
}

async function account(username: string): Promise<{ token: string; char: number }> {
  const r = await api('POST', '/register', { username, password: 'secret123' });
  const token = r.data.token as string;
  const c = await api('POST', '/characters', { name: `C_${username}`, classId: 'sword' }, token);
  return { token, char: c.data.id as number };
}

function player(token: string, characterId: number) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  const ready = new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId }));
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      msgs.push(m);
      if (m.t === 'snap' || m.t === 'kick') { clearTimeout(t); res(); }
    };
  });
  const closed = new Promise<void>((res) => (ws.onclose = () => res()));
  return {
    ready,
    zone: () => [...msgs].reverse().find((m) => m.t === 'zone' || m.t === 'welcome')?.zone as string | undefined,
    waves: () => [...msgs].reverse().find((m) => m.t === 'snap')?.waves as any,
    chats: () => msgs.filter((m) => m.t === 'chat').map((m) => String(m.text)),
    act: (a: string) => ws.send(JSON.stringify({ t: 'act', a })),
    quit: async () => { ws.close(WS_CLOSE_QUIT); await closed; },
  };
}

async function run(): Promise<void> {
  for (let i = 0; ; i++) {
    try { await fetch(`${BASE}/api/me`); break; } catch { if (i > 150) throw new Error('test server did not start'); await sleep(100); }
  }
  const owner = await account('wvowner');
  const a = await account('wva');
  const b = await account('wvb');
  const dbw = new DatabaseSync(DB_FILE);
  dbw.prepare("UPDATE accounts SET admin_role = 'owner' WHERE username = 'wvowner'").run();
  dbw.close();

  // Short runs for the test: 1 s countdown, 2 waves (saved like the /admin card does).
  const bal = await api('GET', '/admin/balance', undefined, owner.token);
  const saveBal = (waves: object) => api('POST', '/admin/balance', { tuning: { ...bal.data.tuning, waves }, part: 'rest' }, owner.token);
  ok((await saveBal({ countdown: 1, waves: 2, base: 2 })).status === 200, 'the minigame numbers save server-wide');
  ok((await saveBal({ countdown: 1, waves: 0 })).status === 400, 'an out-of-range number is refused');

  // A map with the minigame and two wave spots, published.
  const def = { nameTh: 'สนามระลอก', name: 'Wave Field', floor: 1, levels: [1, 10], safe: false, channels: false, autoPlay: true, minigame: 'waves', waveMonsters: ['green_slime'] };
  const made = await api('POST', '/admin/maps/new', { mode: 'empty', theme: 'forest', half: 40, def }, owner.token);
  ok(made.status === 200, `a minigame map is made (${made.data.error ?? made.data.id})`);
  const id = made.data.id as string;
  const draft = (await api('GET', `/admin/maps/${id}/draft`, undefined, owner.token)).data.map as MapData;
  draft.waveSpots = [{ x: 10, z: 0, radius: 2 }, { x: -10, z: 0, radius: 2 }];
  const put = await api('PUT', `/admin/maps/${id}/draft`, { map: draft }, owner.token);
  ok(!put.data.issues.some((i: any) => i.severity === 'error'), 'its wave spots pass the server check');
  ok((await api('POST', `/admin/maps/${id}/publish`, {}, owner.token)).status === 200, 'it is published');
  const z = (await api('GET', '/zones')).data.zones[0];
  ok(z?.def.minigame === 'waves' && z.def.waveMonsters[0] === 'green_slime', 'the browsers get its minigame settings');

  // Two players, not in a party: each gets a run of their own.
  const A = player(a.token, a.char);
  const B = player(b.token, b.char);
  await Promise.all([A.ready, B.ready]);
  const warp = (char: number) => api('POST', `/admin/characters/${char}/teleport`, { zone: id }, owner.token);
  await warp(a.char);
  await warp(b.char);
  await sleep(400);
  ok(A.zone() === id && B.zone() === id, 'both are in the minigame map');
  ok(A.chats().some((t) => t.includes('ห้อง 1')) && B.chats().some((t) => t.includes('ห้อง 2')), 'in rooms of their own (1 and 2)');
  ok(A.waves()?.wave === 0 && A.waves()?.of === 2 && A.waves()?.nextIn > 0, `counting down to wave 1 (${JSON.stringify(A.waves())})`);
  await sleep(1600);
  ok(A.waves()?.wave === 1 && A.waves()?.left === 2, `wave 1 is out: 2 monsters (${JSON.stringify(A.waves())})`);
  const online = (await api('GET', '/admin/online', undefined, owner.token)).data;
  ok(online.players.some((p: any) => p.zone === id), 'the admin page sees them there');

  // The leave button: back out in the hub (they came by warp, not by a door), the run closes.
  A.act('roomLeave');
  await sleep(500);
  ok(A.zone() === 'nexus_city' && A.waves() === undefined, 'leaving puts A back in the hub, no wave box');
  ok(B.zone() === id, 'B plays on in its own room');

  // Switched off in /admin: walking in is refused with a message.
  ok((await saveBal({ countdown: 1, waves: 2, on: false })).status === 200, 'the switch can be turned off');
  await warp(a.char);
  await sleep(400);
  ok(A.zone() === 'nexus_city' && A.chats().some((t) => t.includes('ปิดอยู่')), 'switched off: not let in, told why');

  // Hiding the map takes B out too.
  await api('POST', `/admin/maps/${id}/hide`, { hidden: true }, owner.token);
  await sleep(400);
  ok(B.zone() === 'nexus_city', 'hiding the map sends the player in its run to the hub');
  await Promise.all([A.quit(), B.quit()]);
}

try {
  await run();
} catch (e) {
  ok(false, `threw: ${e instanceof Error ? e.stack : String(e)}`);
} finally {
  await stopServer();
}
finish('wave-server');
