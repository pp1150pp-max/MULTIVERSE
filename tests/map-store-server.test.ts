// PR 5 of docs/plans/map-editor.md: map drafts, publishing, rollback and the public map routes, against a real game server that
// this script starts by itself on a free port with a throwaway database (never the real server or server/data), then stops.
// Covers: who may do what (403s), the check run again on the server, rev going up, rollback, export, admin_audit,
// the "ใช้แมพจาก DB" switch (off = the JSON in the repo), and a room with players not changing under their feet.
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
const dir = mkdtempSync(join(tmpdir(), 'multiverse-map-test-'));
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

/** Joins the world with a character; resolves at the first snapshot. */
function joinWorld(token: string, characterId: number) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  const ready = new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId }));
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      msgs.push(m);
      if (m.t === 'snap' || m.t === 'kick') {
        clearTimeout(t);
        res();
      }
    };
  });
  const closed = new Promise<void>((res) => (ws.onclose = () => res()));
  return {
    ready,
    welcome: () => msgs.find((m) => m.t === 'welcome'),
    /** Leaves on purpose (like closing the game), so nobody holds the room open for a reconnect. */
    quit: async () => {
      ws.close(WS_CLOSE_QUIT);
      await closed;
    },
  };
}

async function account(username: string): Promise<{ token: string; char: number }> {
  const r = await api('POST', '/register', { username, password: 'secret123' });
  const token = r.data.token as string;
  const c = await api('POST', '/characters', { name: `C_${username}`, classId: 'sword' }, token);
  return { token, char: c.data.id as number };
}

async function run(): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      await fetch(`${BASE}/api/me`);
      break;
    } catch {
      if (i > 150) throw new Error('test server did not start');
      await sleep(100);
    }
  }

  const owner = await account('owner1');
  const gm = await account('gm1');
  const plain = await account('plain1');
  const plain2 = await account('plain2');
  const plain3 = await account('plain3');
  const dbw = new DatabaseSync(DB_FILE);
  dbw.prepare("UPDATE accounts SET admin_role = 'owner' WHERE username = 'owner1'").run();
  dbw.prepare("UPDATE accounts SET admin_role = 'gm' WHERE username = 'gm1'").run();
  dbw.close();

  // ---------------------------------------------------------- who may use it
  const bundled = (await api('GET', '/admin/maps/nexus_city/draft', undefined, owner.token)).data;
  ok(bundled.source === 'bundled' && bundled.map?.id === 'nexus_city' && bundled.baseRev === 0, 'no draft, nothing published: the editor starts from the JSON in the repo');
  ok(bundled.issues.length === 0 || bundled.issues.every((i: any) => i.severity === 'warn'), 'the bundled hub has no errors');
  ok((await api('GET', '/admin/maps')).status === 401, 'no token → 401 on the map list');
  for (const [m, p, b] of [['GET', '/admin/maps'], ['GET', '/admin/maps/nexus_city/draft'], ['PUT', '/admin/maps/nexus_city/draft', { map: bundled.map }],
    ['POST', '/admin/maps/nexus_city/publish', {}], ['GET', '/admin/maps/nexus_city/revisions'], ['POST', '/admin/maps/nexus_city/rollback', { rev: 1 }],
    ['GET', '/admin/maps/nexus_city/export']] as [string, string, unknown?][]) {
    ok((await api(m, p, b, plain.token)).status === 403, `normal player → 403 on ${m} ${p}`);
  }
  const list = (await api('GET', '/admin/maps', undefined, gm.token)).data;
  ok(list.maps.length === 12 && list.fromDb === true && list.maps.every((m: any) => m.publishedRev === null && m.draft === null), 'gm sees the 7 maps of floor 1 and 2 and their 5 boss rooms, nothing published or drafted');
  ok(list.maps.filter((m: any) => m.of).map((m: any) => `${m.id}<${m.of}`).join() === 'emerald_forest_room<emerald_forest,misty_marsh_room<misty_marsh,frost_reach_room<frost_reach,ashen_isle_room<ashen_isle,shipwreck_beach_room<shipwreck_beach', 'each boss room is listed right after its field and says which field it belongs to');
  ok((await api('GET', '/admin/maps/nope/draft', undefined, owner.token)).status === 404, 'unknown map → 404');

  // ---------------------------------------------------------- drafts are checked again on the server
  const base: MapData = JSON.parse(JSON.stringify(bundled.map));
  const bad: MapData = JSON.parse(JSON.stringify(base));
  bad.props[0].key = 'no_such_prop';
  const putBad = await api('PUT', '/admin/maps/nexus_city/draft', { map: bad }, gm.token);
  ok(putBad.status === 200 && putBad.data.issues.some((i: any) => i.code === 'bad_key' && i.severity === 'error'), 'a draft that fails the check is still kept, with the issues');
  const pubBad = await api('POST', '/admin/maps/nexus_city/publish', {}, gm.token);
  ok(pubBad.status === 400 && pubBad.data.issues?.length > 0, 'but it cannot be published');
  ok((await api('GET', '/maps')).data.nexus_city === undefined, 'nothing was published');
  ok((await api('PUT', '/admin/maps/nexus_city/draft', { map: { ...base, id: 'emerald_forest' } }, gm.token)).status === 400, 'a map whose id differs from the route is refused');
  ok((await api('PUT', '/admin/maps/nexus_city/draft', { map: [] }, gm.token)).status === 400, 'garbage instead of a map is refused');
  ok((await api('POST', '/admin/maps/misty_marsh/publish', {}, gm.token)).status === 400, 'publishing with no draft is refused');

  // ---------------------------------------------------------- boss rooms: same endpoints, the locks are checked on the server
  const room = (await api('GET', '/admin/maps/frost_reach_room/draft', undefined, gm.token)).data;
  ok(room.source === 'bundled' && room.map?.room?.of === 'frost_reach' && room.issues.length === 0, 'a boss room opens from its bundled file with no issues');
  const lockedRoom: MapData = JSON.parse(JSON.stringify(room.map));
  lockedRoom.room!.boss.x = 4;
  lockedRoom.portals = [{ to: 'nexus_city', x: 1, z: 1, minLevel: 0 }];
  const putLocked = await api('PUT', '/admin/maps/frost_reach_room/draft', { map: lockedRoom }, gm.token);
  ok(putLocked.status === 200 && putLocked.data.issues.filter((i: any) => i.code === 'locked' && i.severity === 'error').length >= 2, 'a room draft that moves the boss or adds a door is kept, with locked errors');
  const pubLocked = await api('POST', '/admin/maps/frost_reach_room/publish', {}, gm.token);
  ok(pubLocked.status === 400, 'and it cannot be published');
  const goodRoom: MapData = JSON.parse(JSON.stringify(room.map));
  goodRoom.props[0].x += 0.5;
  await api('PUT', '/admin/maps/frost_reach_room/draft', { map: goodRoom }, gm.token);
  const pubRoom = await api('POST', '/admin/maps/frost_reach_room/publish', {}, gm.token);
  ok(pubRoom.status === 200 && pubRoom.data.rev === 1 && (await api('GET', '/maps/frost_reach_room?rev=1')).data.room?.arena === goodRoom.room!.arena, 'moving a prop in a room publishes as rev 1 and the browser can fetch it');
  ok(JSON.stringify((await api('GET', '/maps')).data) === '{"frost_reach_room":1}', 'GET /api/maps lists the room by its zone id');

  // ---------------------------------------------------------- a player is in the hub before anything is published
  const pa = joinWorld(plain.token, plain.char);
  await pa.ready;
  ok(pa.welcome()?.map === 0, 'the welcome message names the map revision the room was built from (0 = repo JSON)');

  // ---------------------------------------------------------- publish: rev goes up
  const moved: MapData = JSON.parse(JSON.stringify(base));
  moved.props[0].x += 0.5;
  const put1 = await api('PUT', '/admin/maps/nexus_city/draft', { map: moved, note: 'ขยับ' }, gm.token);
  ok(put1.status === 200 && put1.data.issues.every((i: any) => i.severity === 'warn') && put1.data.diff.changed === 1, `a good draft saves (1 piece changed) ${JSON.stringify(put1.data.diff)}`);
  const draftBack = (await api('GET', '/admin/maps/nexus_city/draft', undefined, gm.token)).data;
  ok(draftBack.source === 'draft' && draftBack.map.props[0].x === moved.props[0].x, 'the draft comes back as saved');
  const pub1 = await api('POST', '/admin/maps/nexus_city/publish', { note: 'ครั้งแรก' }, gm.token);
  ok(pub1.status === 200 && pub1.data.rev === 1 && pub1.data.diff.changed === 1, 'gm publishes: rev 1');
  ok(Object.entries((await api('GET', '/maps')).data).sort().join(';') === 'frost_reach_room,1;nexus_city,1', 'GET /api/maps says {frost_reach_room: 1, nexus_city: 1}');
  const got1 = await api('GET', '/maps/nexus_city?rev=1');
  ok(got1.status === 200 && got1.data.rev === 1 && got1.data.props[0].x === moved.props[0].x, 'GET /api/maps/nexus_city?rev=1 gives the published layout, rev inside');
  ok((await api('GET', '/maps/nexus_city')).data.rev === 1, 'without ?rev it gives the newest');
  ok((await api('GET', '/maps/nexus_city?rev=9')).status === 404, 'a revision that does not exist → 404');
  ok((await api('GET', '/maps/nexus_city?rev=abc')).status === 400, 'a bad rev → 400');
  ok((await api('GET', '/maps/misty_marsh')).status === 404, 'a map never published → 404 (the browser keeps its own JSON)');

  const moved2: MapData = JSON.parse(JSON.stringify(moved));
  moved2.props[0].x += 0.5;
  await api('PUT', '/admin/maps/nexus_city/draft', { map: moved2 }, owner.token);
  const pub2 = await api('POST', '/admin/maps/nexus_city/publish', {}, owner.token);
  ok(pub2.data.rev === 2 && pub2.data.diff.changed === 1, 'the next publish is rev 2');
  const revs = (await api('GET', '/admin/maps/nexus_city/revisions', undefined, gm.token)).data;
  ok(revs.revisions.map((r: any) => r.rev).join() === '2,1' && revs.revisions[1].author === 'gm1' && revs.revisions[1].note === 'ครั้งแรก', 'revisions list newest first, with author and note');
  ok((await api('GET', '/admin/maps/nexus_city/revisions/1', undefined, gm.token)).data.map.props[0].x === moved.props[0].x, 'one revision can be read');

  // ---------------------------------------------------------- a room with players keeps its layout; the next one gets the new one
  const pb = joinWorld(plain2.token, plain2.char);
  await pb.ready;
  ok(pb.welcome()?.map === 0, 'someone joining the hub while a player is in it gets that same room: still the old revision, not changed under them');
  await pa.quit();
  await pb.quit();
  await sleep(2500); // the empty hub is made again within a second
  const pc = joinWorld(plain3.token, plain3.char);
  await pc.ready;
  ok(pc.welcome()?.map === 2, 'once the hub is empty, the next player gets a room built from the newest revision (rev 2), no restart');

  // ---------------------------------------------------------- roll back and export: owner only by default
  ok((await api('POST', '/admin/maps/nexus_city/rollback', { rev: 1 }, gm.token)).status === 403, 'gm → 403 on rollback');
  ok((await api('GET', '/admin/maps/nexus_city/export', undefined, gm.token)).status === 403, 'gm → 403 on export');
  ok((await api('POST', '/admin/maps/nexus_city/rollback', { rev: 77 }, owner.token)).status === 404, 'rollback to a revision that is not there → 404');
  const rb = await api('POST', '/admin/maps/nexus_city/rollback', { rev: 1 }, owner.token);
  ok(rb.status === 200 && rb.data.rev === 3, 'owner rolls back to rev 1: published again as rev 3');
  const rb3 = (await api('GET', '/maps/nexus_city?rev=3')).data;
  ok(rb3.rev === 3 && JSON.stringify({ ...rb3, rev: 0 }) === JSON.stringify({ ...got1.data, rev: 0 }), 'rev 3 is rev 1\'s layout');
  const exp = await api('GET', '/admin/maps/nexus_city/export', undefined, owner.token);
  ok(exp.status === 200 && exp.data.file === 'src/shared/data/maps/nexus_city.json' && JSON.parse(exp.data.json).rev === 3, 'owner exports the newest published JSON');
  ok((await api('GET', '/admin/maps/misty_marsh/export', undefined, owner.token)).status === 404, 'export of a map never published → 404');

  // ---------------------------------------------------------- permissions can be handed out on the Permissions page
  const feat = (await api('GET', '/admin/role-defs', undefined, owner.token)).data.roles.find((r: any) => r.id === 'gm');
  ok(feat.features.includes('mapEdit') && !feat.features.includes('mapRollback') && !feat.features.includes('mapExport'), 'gm starts with mapEdit only');
  const give = await api('POST', '/admin/role-defs', { id: 'gm', name: feat.name, features: [...feat.features, 'mapRollback'] }, owner.token);
  ok(give.status === 200, 'owner gives gm the rollback switch');
  ok((await api('POST', '/admin/maps/nexus_city/rollback', { rev: 2 }, gm.token)).data.rev === 4, 'now gm may roll back (rev 4)');
  await api('POST', '/admin/role-defs', { id: 'gm', name: feat.name, features: feat.features.filter((f: string) => f !== 'mapEdit') }, owner.token);
  ok((await api('PUT', '/admin/maps/nexus_city/draft', { map: moved }, gm.token)).status === 403, 'take mapEdit away and gm is refused');

  // ---------------------------------------------------------- audit
  const audit = (await api('GET', '/admin/audit', undefined, owner.token)).data as { admin: string; action: string; target: string; details: string }[];
  const maps = audit.filter((a) => a.action.startsWith('map-'));
  ok(maps.some((a) => a.action === 'map-draft' && a.admin === 'gm1' && a.target === 'nexus_city' && a.details.includes('แก้ 1 ชิ้น')), 'audit: draft saves (who, which map, how many pieces)');
  ok(maps.some((a) => a.action === 'map-publish' && a.admin === 'gm1' && a.details.startsWith('rev 1 ·')), 'audit: publish with the rev');
  ok(maps.some((a) => a.action === 'map-rollback' && a.admin === 'owner1' && a.details.startsWith('rev 3 ·')), 'audit: rollback');

  // ---------------------------------------------------------- only 20 revisions are kept
  const many: MapData = (await api('GET', '/admin/maps/misty_marsh/draft', undefined, owner.token)).data.map;
  for (let i = 0; i < 22; i++) {
    many.props[0].x += 0.01;
    await api('PUT', '/admin/maps/misty_marsh/draft', { map: many }, owner.token);
    const r = await api('POST', '/admin/maps/misty_marsh/publish', {}, owner.token);
    if (r.status !== 200) {
      ok(false, `publish #${i + 1} worked (${r.status})`);
      break;
    }
  }
  const kept = (await api('GET', '/admin/maps/misty_marsh/revisions', undefined, owner.token)).data.revisions.map((r: any) => r.rev);
  ok(kept.length === 20 && kept[0] === 22 && kept[19] === 3, `20 revisions are kept (newest 22, oldest 3): ${kept.length} ${kept[0]}..${kept.at(-1)}`);

  // ---------------------------------------------------------- the switch: off = the JSON in the repo
  await pc.quit();
  const off = await api('POST', '/admin/balance', { tuning: { mapFromDb: false } }, owner.token);
  ok(off.status === 200 && off.data.tuning.mapFromDb === false, 'owner turns "ใช้แมพจาก DB" off');
  ok(JSON.stringify((await api('GET', '/maps')).data) === '{}', 'GET /api/maps is empty while it is off');
  ok((await api('GET', '/maps/nexus_city?rev=1')).status === 200, 'but a revision can still be fetched (a running room may be built from it)');
  await sleep(2500);
  const pd = joinWorld(plain.token, plain.char);
  await pd.ready;
  ok(pd.welcome()?.map === 0, 'a room made while the switch is off is built from the JSON in the repo (rev 0)');
  await pd.quit();
  await api('POST', '/admin/balance', { tuning: {} }, owner.token);
  ok((await api('GET', '/maps')).data.nexus_city === 4, 'turned on again: the published layouts are back (nexus_city rev 4)');
  await sleep(2500);
  const pe = joinWorld(plain.token, plain.char);
  await pe.ready;
  ok(pe.welcome()?.map === 4, 'and a new room uses the newest again');
  await pe.quit();
}

try {
  await run();
} catch (e) {
  console.error(e);
  ok(false, `test crashed: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await stopServer();
}
finish('map-store-server');
