// Where chests stand reaches the browser (docs/systems/chests-shrines.md): the snapshot lists the chests near the player only when
// that list changes, an opened one drops out, and it all comes again after changing map. A published layout with a chest by the camp
// and random spots switched off puts one in reach. Runs its own game server on a free port with a throwaway database.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MapData } from '../src/shared/mapSchema';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-test-'));
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
async function until(cond: () => unknown): Promise<void> {
  for (let i = 0; i < 100 && !cond(); i++) await sleep(50);
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
  const tok = (await api('POST', '/register', { username: 'chestowner', password: 'secret123' })).data.token as string;
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'chestowner', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8' });
  ok(cli.status === 0, 'chestowner is owner');
  const char: number = (await api('POST', '/characters', { name: 'Seeker', classId: 'sword' }, tok)).data.id;

  // The forest with its first chest beside the camp, published; random spots off, so it stands there.
  const map = (await api('GET', '/admin/maps/emerald_forest/draft', undefined, tok)).data.map as MapData;
  const camp = map.zone.start;
  let spot = { x: 0, z: 0 };
  let published = false;
  for (const [dx, dz] of [[-6, -6], [-8, 0], [0, -8], [-10, -4], [-4, -10], [-12, -12]]) {
    spot = { x: camp.x + dx, z: camp.z + dz };
    map.chests![0] = { id: 'c1', ...spot };
    await api('PUT', '/admin/maps/emerald_forest/draft', { map }, tok);
    if ((await api('POST', '/admin/maps/emerald_forest/publish', {}, tok)).status === 200) { published = true; break; }
  }
  ok(published, `published with a chest by the camp (${spot.x}, ${spot.z})`);
  ok((await api('POST', '/admin/balance', { tuning: { treasure: { randomSpots: false, openSec: 0 } }, part: 'rest' }, tok)).status === 200, 'random spots off, no opening time');
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token: tok, characterId: char }));
  ws.onmessage = (e) => msgs.push(JSON.parse(String(e.data)));
  const lists = () => msgs.filter((m) => m.t === 'snap' && m.chests).map((m) => m.chests as { id: string; x: number; z: number }[]);
  const here = () => lists().at(-1) ?? [];
  await until(() => lists().length);
  ok(here().length === 0, `in town: an empty list (${JSON.stringify(here())})`);
  const warp = (zone: string) => api('POST', `/admin/characters/${char}/teleport`, { zone }, tok);
  const moved = await warp('emerald_forest');
  ok(moved.status === 200, `moved to the forest (${moved.status} ${moved.data.error ?? ''})`);
  await until(() => lists().length > 1);
  await sleep(600);
  const first = here().find((c) => c.id === 'c1');
  ok(first && first.x === spot.x && first.z === spot.z, `the snapshot says where it stands (${JSON.stringify(here())})`);
  ok(lists().length === 2 && msgs.filter((m) => m.t === 'snap').length > 10, `once per change, not in every snapshot (${lists().length})`);

  // Walk up to it (steps the server accepts) and open it: it drops out of the list.
  let seq = 0;
  const me = () => msgs.filter((m) => m.t === 'snap').at(-1).players.find((p: any) => p.name === 'Seeker');
  for (let i = 0; i < 40 && Math.hypot(me().x - spot.x, me().z - spot.z) > 2; i++) {
    const at = me();
    const d = Math.hypot(spot.x - at.x, spot.z - at.z);
    const k = Math.min(1, 1.5 / d, (d - 1.5) / d);
    ws.send(JSON.stringify({ t: 'input', pos: { x: at.x + (spot.x - at.x) * k, z: at.z + (spot.z - at.z) * k }, seq: ++seq, move: null, aim: spot, basic: false, skills: [], dash: false, potion: null }));
    await sleep(350);
  }
  ws.send(JSON.stringify({ t: 'act', a: 'chest', id: 'c1' }));
  await until(() => !here().some((c) => c.id === 'c1'));
  ok(lists().length > 1 && !here().some((c) => c.id === 'c1'), `opened: no longer listed (at ${me().x},${me().z}: ${JSON.stringify(here())})`);

  // To town and back: the list comes again for the new map, the opened chest still gone.
  const n = lists().length;
  await warp('nexus_city');
  await until(() => lists().length > n);
  ok(here().length === 0, `town: an empty list (${JSON.stringify(here())})`);
  const m = lists().length;
  await warp('emerald_forest');
  await until(() => lists().length > m);
  ok(lists().length > m && !here().some((c) => c.id === 'c1'), 'back in the forest: the list again, the opened chest not in it');
  ws.close(4000);
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
finish('chest-spots-server');
