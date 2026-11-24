// "＋ แมพใหม่" (maps made in the map editor, owner 2026-11-21) against a real game server this script starts itself on a free port
// with a throwaway database (never the real server or server/data), then stops. Covers: permissions, the three ways to make one
// (copy / empty floor / JSON import), settings checked on the server, out of the game until published, GET /api/zones, a player
// warped in, hiding (players go to the hub), delete refused while a door leads there, delete, audit.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { WS_CLOSE_QUIT } from '../src/shared/net/protocol';
import type { MapData } from '../src/shared/mapSchema';
import { copyMap, emptyMap, zoneFromCustom } from '../src/shared/customZones';
import { MapRegistry } from '../src/shared/mapRegistry';
import { validateMap } from '../src/shared/mapSchema';
import { finish, ok } from './check';

// ---------------------------------------------------------- the pure part first
{
  const room = MapRegistry.bundled('frost_reach_room')!;
  const c = copyMap(room, 'c_room', 2);
  ok(c.id === 'c_room' && c.floor === 2 && c.rev === 0 && !('room' in c) && !('lair' in c) && c.npcs.length === 0, 'a copied boss room is a plain map: no room block, no boss, no NPCs');
  ok(c.zone.start.x === room.zone.start.x - 2 && c.zone.start.z === room.zone.start.z - 2, 'players appear where they did in the room');
  const hub = copyMap(MapRegistry.bundled('nexus_city')!, 'c_hub', 1);
  ok(hub.npcs.length === 0 && hub.props.length === MapRegistry.bundled('nexus_city')!.props.length, 'a copied hub keeps its pieces but not its NPCs');
  const e = emptyMap('c_e', 1, 'snow', 500);
  ok(e.zone.half === 150 && e.walkable.half === 142 && e.zone.theme === 'snow' && e.props.length === 0, 'an empty floor is clamped to 150 and has its walkable frame 8 inside');
  ok(validateMap(e, { propKeys: [] }).filter((i) => i.severity === 'error').length === 0, 'an empty floor passes the check');
  const z = zoneFromCustom({ id: 'c_e', name: '', nameTh: 'ทดสอบ', floor: 1, levels: [3, 9], safe: true, channels: true, autoPlay: false }, e);
  ok(z.custom === true && z.name === 'ทดสอบ' && z.channels === true && z.allowAutoPlay === false && z.safe?.half === 151 && z.levels[1] === 9, 'its zone takes the settings (safe = the whole map)');
}

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-mapnew-test-'));
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

function joinWorld(token: string, characterId: number) {
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
    lastZone: () => [...msgs].reverse().find((m) => m.t === 'zone' || m.t === 'welcome')?.zone as string | undefined,
    chats: () => msgs.filter((m) => m.t === 'chat').map((m) => String(m.text)),
    quit: async () => { ws.close(WS_CLOSE_QUIT); await closed; },
  };
}

async function account(username: string): Promise<{ token: string; char: number }> {
  const r = await api('POST', '/register', { username, password: 'secret123' });
  const token = r.data.token as string;
  const c = await api('POST', '/characters', { name: `C_${username}`, classId: 'sword' }, token);
  return { token, char: c.data.id as number };
}

const DEF = { nameTh: 'สนามทดสอบ', name: 'Test Field', floor: 1, levels: [1, 10], safe: false, channels: false, autoPlay: true };

async function run(): Promise<void> {
  for (let i = 0; ; i++) {
    try { await fetch(`${BASE}/api/me`); break; } catch { if (i > 150) throw new Error('test server did not start'); await sleep(100); }
  }
  const owner = await account('mnowner');
  const gm = await account('mngm');
  const plain = await account('mnplain');
  const dbw = new DatabaseSync(DB_FILE);
  dbw.prepare("UPDATE accounts SET admin_role = 'owner' WHERE username = 'mnowner'").run();
  dbw.prepare("UPDATE accounts SET admin_role = 'gm' WHERE username = 'mngm'").run();
  dbw.close();

  // ---------------------------------------------------------- who may, and what is checked
  ok((await api('POST', '/admin/maps/new', { mode: 'empty', theme: 'forest', half: 50, def: DEF }, plain.token)).status === 403, 'a normal player may not make a map');
  ok((await api('POST', '/admin/maps/new', { mode: 'empty', theme: 'forest', half: 50, def: { ...DEF, nameTh: '' } }, gm.token)).status === 400, 'a map needs a Thai name');
  ok((await api('POST', '/admin/maps/new', { mode: 'empty', theme: 'forest', half: 10, def: DEF }, gm.token)).status === 400, 'an empty floor below 20 is refused');
  ok((await api('POST', '/admin/maps/new', { mode: 'empty', theme: 'forest', half: 50, def: { ...DEF, levels: [9, 3] } }, gm.token)).status === 400, 'levels upside down are refused');
  ok((await api('POST', '/admin/maps/new', { mode: 'copy', from: 'nowhere', def: DEF }, gm.token)).status === 400, 'copying a map that does not exist is refused');
  ok((await api('POST', '/admin/maps/new', { mode: 'import', map: { hello: 1 }, def: DEF }, gm.token)).status === 400, 'importing something that is not a map is refused');

  // ---------------------------------------------------------- three ways to make one (GMs may: owner 2026-11-21)
  const made = await api('POST', '/admin/maps/new', { mode: 'empty', theme: 'snow', half: 40, def: DEF }, gm.token);
  ok(made.status === 200 && made.data.id === 'c_test_field', `an empty floor made by a GM gets an id from its English name (${made.data.id})`);
  const id = made.data.id as string;
  const copy = await api('POST', '/admin/maps/new', { mode: 'copy', from: 'ashen_isle_room', def: { ...DEF, name: '' } }, owner.token);
  ok(copy.status === 200 && copy.data.id === 'c_map', 'a copy without an English name is c_map');
  const roomCopy = (await api('GET', `/admin/maps/${copy.data.id}/draft`, undefined, owner.token)).data;
  ok(roomCopy.source === 'draft' && !roomCopy.map.room && roomCopy.custom?.nameTh === DEF.nameTh, 'the copied boss room opens as a plain draft, with its settings');
  const imp = await api('POST', '/admin/maps/new', { mode: 'import', map: MapRegistry.bundled('emerald_forest'), def: DEF }, owner.token);
  ok(imp.status === 200 && imp.data.id === 'c_test_field_2', 'an imported file makes a map; the same name gets _2');
  const list = (await api('GET', '/admin/maps', undefined, gm.token)).data.maps as any[];
  ok(list.length === 19 && list.slice(16).every((m) => m.custom?.def?.id === m.id && m.custom.status === 'live' && m.publishedRev === null), 'the list has the 16 maps of the game (floor 1 and 2, boss rooms included), then the 3 new ones (not published)');

  // ---------------------------------------------------------- out of the game until published
  ok((await api('GET', '/zones')).data.zones.length === 0, 'GET /api/zones: nothing until one is published');
  const draft = (await api('GET', `/admin/maps/${id}/draft`, undefined, gm.token)).data.map as MapData;
  draft.spawns.push({ monster: 'green_slime', x: 10, z: 10, radius: 4, count: 3, respawn: [5, 10] });
  await api('PUT', `/admin/maps/${id}/draft`, { map: draft }, gm.token);
  const pub = await api('POST', `/admin/maps/${id}/publish`, {}, gm.token);
  ok(pub.status === 200 && pub.data.rev === 1, 'it publishes as rev 1');
  const zones = (await api('GET', '/zones')).data.zones as any[];
  ok(zones.length === 1 && zones[0].def.id === id && zones[0].rev === 1 && (await api('GET', '/maps')).data[id] === 1, 'GET /api/zones and /api/maps now list it');
  ok((await api('GET', `/maps/${id}?rev=1`)).data.spawns?.length === 1, 'and the browser can fetch its layout');

  // ---------------------------------------------------------- doors to it are valid; a player can be warped in
  const hub = (await api('GET', '/admin/maps/nexus_city/draft', undefined, owner.token)).data.map as MapData;
  hub.portals.push({ to: id, x: 4, z: -12, minLevel: 1 });
  const hubSave = await api('PUT', '/admin/maps/nexus_city/draft', { map: hub }, owner.token);
  ok(!hubSave.data.issues.some((i: any) => i.severity === 'error' && i.code === 'bad_ref'), 'a door from the hub to the new map passes the check');
  const P = joinWorld(plain.token, plain.char);
  await P.ready;
  const warp = await api('POST', `/admin/characters/${plain.char}/teleport`, { zone: id }, owner.token);
  await sleep(500);
  ok(warp.status === 200 && P.lastZone() === id, `an owner can warp a player into it (${warp.status} ${warp.data?.msg ?? ''})`);

  // ---------------------------------------------------------- settings, hide
  const set = await api('PUT', `/admin/maps/${id}/settings`, { def: { ...DEF, nameTh: 'สนามใหม่', channels: true } }, gm.token);
  ok(set.status === 200 && set.data.def.nameTh === 'สนามใหม่' && (await api('GET', '/zones')).data.zones[0].def.channels === true, 'settings change on the server');
  ok((await api('PUT', '/admin/maps/nexus_city/settings', { def: DEF }, owner.token)).status === 400, 'the game\'s own maps have no such settings');
  const hide = await api('POST', `/admin/maps/${id}/hide`, { hidden: true }, gm.token);
  await sleep(500);
  ok(hide.status === 200 && hide.data.moved === 1 && P.lastZone() === 'nexus_city' && P.chats().some((t) => t.includes('ปิดชั่วคราว')), 'hiding it sends the player in it to the hub, with a message');
  ok((await api('GET', '/zones')).data.zones.length === 0 && (await api('GET', '/maps')).data[id] === undefined, 'a hidden map is out of /api/zones and /api/maps');
  ok(!(await api('PUT', '/admin/maps/nexus_city/draft', { map: hub }, owner.token)).data.issues.some((i: any) => i.code === 'bad_ref'), 'a door to a hidden map is still valid (the hub stays publishable)');
  await api('POST', `/admin/maps/${id}/hide`, { hidden: false }, gm.token);
  ok((await api('GET', '/zones')).data.zones.length === 1, 'shown again: back in the game');

  // ---------------------------------------------------------- delete
  ok((await api('DELETE', `/admin/maps/${id}`, undefined, plain.token)).status === 403, 'a normal player may not delete');
  ok((await api('DELETE', '/admin/maps/nexus_city', undefined, owner.token)).status === 400, 'the game\'s own maps cannot be deleted');
  const refused = await api('DELETE', `/admin/maps/${id}`, undefined, gm.token);
  ok(refused.status === 409 && String(refused.data.error).includes('ประตู'), 'deleting is refused while a door (here: the hub draft) leads to it');
  hub.portals.pop();
  await api('PUT', '/admin/maps/nexus_city/draft', { map: hub }, owner.token);
  const gone = await api('DELETE', `/admin/maps/${id}`, undefined, gm.token);
  ok(gone.status === 200, 'with the door gone, a GM may delete it (owner 2026-11-21)');
  ok((await api('GET', `/admin/maps/${id}/draft`, undefined, gm.token)).status === 404 && (await api('GET', '/zones')).data.zones.length === 0, 'deleted: no draft, not in the game');
  const dbr = new DatabaseSync(DB_FILE);
  const rowsLeft = dbr.prepare('SELECT COUNT(*) AS n FROM map_layouts WHERE zone_id = ?').get(id) as { n: number };
  dbr.close();
  ok(rowsLeft.n === 0, 'its layouts are gone from the DB');

  const audit = (await api('GET', '/admin/audit', undefined, owner.token)).data as { action: string; target: string }[];
  for (const a of ['map-create', 'map-settings', 'map-hide', 'map-show', 'map-delete']) ok(audit.some((r) => r.action === a), `audit has ${a}`);
  await P.quit();
}

try {
  await run();
} catch (e) {
  ok(false, `threw: ${e instanceof Error ? e.stack : String(e)}`);
} finally {
  await stopServer();
}
finish('map-custom-server');
