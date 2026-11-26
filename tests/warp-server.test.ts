// The Kraken Maelstrom's warp circles on the real server (owner 2026-11-26): walk the road to the circle on the whirlpool's bottom
// rim, send the `warp` action, and the server puts the character on the island and tells the browser to jump there (`me.epoch`
// changes); the island's circle takes it back. Out of range nothing happens. Runs its own game server on a free port with a throwaway
// database. The walk is in the map editor's preview room ("ทดลองเดิน") of a draft with no monster spots, so nothing kills the walker;
// the warp circles come through the draft layout (zoneWithLayout), as a layout from the DB would.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { finish, ok } from './check';
import { islandAt, ZONES } from '../src/shared/data/zones';
import { Terrain } from '../src/shared/sim/terrain';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-warp-test-'));
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
const SEA = ZONES.kraken_maelstrom;

async function api(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: (await r.json().catch(() => ({}))) as any };
}

async function account(user: string, name?: string) {
  const reg = await api('POST', '/register', { username: user, password: 'secret123' });
  const tok = reg.data.token as string;
  if (name) await api('POST', '/characters', { name, classId: 'sword' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number; name: string }[];
  return { tok, id: chars[0]?.id };
}

function joinWorld(token: string, characterId: number, previewMap?: string) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  const ready = new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'join', token, characterId, ...(previewMap ? { previewMap } : {}) })));
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      msgs.push(m);
      if (m.t === 'snap') {
        clearTimeout(t);
        res();
      }
    });
  });
  /** Our player id: the welcome's, or the last map change's. */
  const you = () => msgs.filter((m) => m.t === 'welcome' || m.t === 'zone').at(-1)?.you;
  const zone = () => msgs.filter((m) => m.t === 'welcome' || m.t === 'zone').at(-1)?.zone;
  const last = () => msgs.filter((m) => m.t === 'snap').at(-1);
  const pos = () => last()?.players.find((p: any) => p.id === you()) as { x: number; z: number };
  const epoch = () => msgs.filter((m) => m.t === 'snap' && m.me).at(-1)?.me.epoch as number;
  let seq = 0;
  const input = (at: { x: number; z: number }) =>
    ws.send(JSON.stringify({ t: 'input', pos: at, seq: ++seq, move: null, aim: at, basic: false, skills: [], dash: false, potion: null }));
  const act = (o: object) => ws.send(JSON.stringify({ t: 'act', ...o }));
  return { ws, ready, zone, pos, epoch, input, act };
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
  const owner = await account('wpowner', 'Wade');
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'wpowner', 'owner'], {
    cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8',
  });
  ok(cli.status === 0, 'wpowner is owner');
  // A draft of the maelstrom with no monster spots (the map editor's), walked in its preview room.
  const draft = (await api('GET', `/admin/maps/${SEA.id}/draft`, undefined, owner.tok)).data.map;
  ok(draft?.warps?.length === 2 && draft.water.some((w: any) => w.island === 7), "the editor's draft carries the warp circles and the island");
  const put = await api('PUT', `/admin/maps/${SEA.id}/draft`, { map: { ...draft, spawns: [] } }, owner.tok);
  ok(put.status === 200, `a draft without monsters saved (${put.status} ${JSON.stringify(put.data).slice(0, 160)})`);
  const C = joinWorld(owner.tok, owner.id, SEA.id);
  await C.ready;
  await sleep(400);
  ok(C.zone() === SEA.id, 'in a preview room of the maelstrom');

  const [rim, back] = SEA.warps!;
  C.act({ a: 'warp' });
  const e0 = C.epoch();
  await sleep(400);
  ok(C.epoch() === e0 && !islandAt(SEA, C.pos().x, C.pos().z), 'at the camp, far from any circle: the warp does nothing');

  // Walk the main road to the rim circle, a little under walking speed, as the browser would report it.
  const terrain = new Terrain(SEA);
  const road = SEA.path.map(([x, z]) => ({ x, z }));
  let at = { ...C.pos() };
  let k = road.findIndex((p) => Math.hypot(p.x - at.x, p.z - at.z) < 10);
  if (k < 0) k = 0;
  let blocked = 0;
  for (; k < road.length; k++) {
    const to = road[k];
    for (;;) {
      const d = Math.hypot(to.x - at.x, to.z - at.z);
      if (d < 0.05) break;
      const step = Math.min(0.2, d);
      at = { x: at.x + ((to.x - at.x) / d) * step, z: at.z + ((to.z - at.z) / d) * step };
      if (terrain.isBlocked(at.x, at.z, 0)) blocked++;
      C.input(at);
      await sleep(55);
    }
  }
  await sleep(400);
  const here = C.pos();
  ok(blocked === 0 && Math.hypot(here.x - rim.x, here.z - rim.z) < 0.5, `walked the road to the rim circle (${here.x.toFixed(1)}, ${here.z.toFixed(1)})`);

  const e1 = C.epoch();
  C.act({ a: 'warp' });
  await sleep(500);
  const isle = C.pos();
  ok(!!islandAt(SEA, isle.x, isle.z, 0.3) && Math.hypot(isle.x - rim.toX, isle.z - rim.toZ) < 0.5, `the warp puts us on the island (${isle.x.toFixed(1)}, ${isle.z.toFixed(1)})`);
  ok(C.epoch() !== e1, 'and the browser is told to jump there (epoch changed)');
  // The browser reports where it jumped to: the server takes it (no snap back to the rim).
  C.input(isle);
  await sleep(400);
  ok(!!islandAt(SEA, C.pos().x, C.pos().z, 0.3), 'still on the island after the next input');

  const e2 = C.epoch();
  C.input({ x: back.x, z: back.z });
  await sleep(200);
  C.act({ a: 'warp' });
  await sleep(500);
  const shore = C.pos();
  ok(Math.hypot(shore.x - back.toX, shore.z - back.toZ) < 0.5 && C.epoch() !== e2, `the island's circle takes us back to the rim (${shore.x.toFixed(1)}, ${shore.z.toFixed(1)})`);
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
finish('warp-server');
