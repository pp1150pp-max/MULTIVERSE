// PR 8 of docs/plans/map-editor.md: "ทดลองเดิน" (?previewMap) and the export text, against a real game server that this script starts by
// itself on a free port with a throwaway database (never the real server or server/data), then stops.
// Covers: who gets a preview room (mapEdit only; everyone else joins the normal game), that it is a private room of the draft zone,
// that a draft with errors is never run, that the real session of the same character is left alone, that nothing of a preview is saved,
// and that the export gives the file text exactly as the bake tool writes it.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { WS_CLOSE_QUIT } from '../src/shared/net/protocol';
import { bakedText } from '../src/shared/mapText';
import type { MapData } from '../src/shared/mapSchema';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-preview-test-'));
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

/** Joins the world (with ?previewMap = `previewMap`, if given); resolves at the first snapshot or a kick. */
function joinWorld(token: string, characterId: number, previewMap?: string) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  const ready = new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId, ...(previewMap ? { previewMap } : {}) }));
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
    kicked: () => msgs.some((m) => m.t === 'kick'),
    send: (m: unknown) => ws.send(JSON.stringify(m)),
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
  const dbw = new DatabaseSync(DB_FILE);
  dbw.prepare("UPDATE accounts SET admin_role = 'owner' WHERE username = 'owner1'").run();
  dbw.prepare("UPDATE accounts SET admin_role = 'gm' WHERE username = 'gm1'").run();
  const charData = (id: number): string => (dbw.prepare('SELECT data FROM characters WHERE id = ?').get(id) as { data: string }).data;

  const forest: MapData = (await api('GET', '/admin/maps/emerald_forest/draft', undefined, owner.token)).data.map;
  ok((await api('PUT', '/admin/maps/emerald_forest/draft', { map: forest }, owner.token)).status === 200, 'owner saves a draft of the forest');

  // ---------------------------------------------------------- who gets a preview room
  const real = joinWorld(owner.token, owner.char);
  await real.ready;
  ok(real.welcome()?.zone === 'nexus_city' && !real.welcome()?.preview, 'a normal join starts in the hub, no preview flag');
  const before = charData(owner.char);

  const pv = joinWorld(owner.token, owner.char, 'emerald_forest');
  await pv.ready;
  ok(pv.welcome()?.preview === true && pv.welcome()?.zone === 'emerald_forest', 'owner with ?previewMap is put in a preview room of that zone');
  await sleep(300);
  ok(!real.kicked(), 'the owner\'s real session is not taken over by the preview of the same character');
  pv.send({ t: 'act', a: 'sort', key: 'rarity', desc: false });
  pv.send({ t: 'chat', text: 'hello from the preview' });
  await sleep(300);
  await pv.quit();
  await sleep(300);
  ok(charData(owner.char) === before, 'nothing of the preview is saved to the character');
  const again = joinWorld(owner.token, owner.char, 'emerald_forest');
  await again.ready;
  ok(again.welcome()?.preview === true, 'a preview can be opened again right after leaving one');
  await again.quit();

  const g = joinWorld(gm.token, gm.char, 'emerald_forest');
  await g.ready;
  ok(g.welcome()?.preview === true, 'gm has mapEdit from the start, so gm gets a preview room');
  await g.quit();

  const p = joinWorld(plain.token, plain.char, 'emerald_forest');
  await p.ready;
  ok(!p.kicked() && p.welcome()?.zone === 'nexus_city' && !p.welcome()?.preview, 'a player without the tool who asks for ?previewMap just gets the normal game (the hub)');
  await p.quit();

  const gi = joinWorld(gm.token, gm.char, 'not_a_zone');
  await gi.ready;
  ok(gi.welcome()?.zone === 'nexus_city' && !gi.welcome()?.preview, 'a zone that has no map is ignored');
  await gi.quit();

  // ---------------------------------------------------------- a draft with errors is never run
  const broken = structuredClone(forest);
  broken.props[0].key = 'no_such_picture';
  ok((await api('PUT', '/admin/maps/emerald_forest/draft', { map: broken }, owner.token)).status === 200, 'a broken draft can still be saved');
  const pb = joinWorld(owner.token, owner.char + 0, 'emerald_forest');
  await pb.ready;
  ok(!pb.welcome()?.preview && pb.welcome()?.zone === 'nexus_city', 'but its preview is refused (normal game instead)');
  await pb.quit();

  // ---------------------------------------------------------- the tool taken away
  await api('PUT', '/admin/maps/emerald_forest/draft', { map: forest }, owner.token);
  const def = (await api('GET', '/admin/role-defs', undefined, owner.token)).data.roles.find((r: any) => r.id === 'gm');
  await api('POST', '/admin/role-defs', { id: 'gm', name: def.name, features: def.features.filter((f: string) => f !== 'mapEdit') }, owner.token);
  const g2 = joinWorld(gm.token, gm.char, 'emerald_forest');
  await g2.ready;
  ok(!g2.welcome()?.preview && g2.welcome()?.zone === 'nexus_city', 'take mapEdit away from gm and the preview is refused');
  await g2.quit();
  await real.quit();

  // ---------------------------------------------------------- the export text
  const draft = structuredClone(forest);
  draft.props[0].x += 0.5;
  await api('PUT', '/admin/maps/emerald_forest/draft', { map: draft }, owner.token);
  const pub = await api('POST', '/admin/maps/emerald_forest/publish', {}, owner.token);
  ok(pub.status === 200, 'owner publishes the forest');
  const exp = await api('GET', '/admin/maps/emerald_forest/export', undefined, owner.token);
  ok(exp.status === 200 && exp.data.file === 'src/shared/data/maps/emerald_forest.json', 'export names the file to put in the repo');
  ok(typeof exp.data.text === 'string' && exp.data.text === bakedText(JSON.parse(exp.data.json)), 'export text is the file exactly as the bake tool writes it');
  ok(JSON.parse(exp.data.text).rev === pub.data.rev, 'and it carries the published revision');
  ok((await api('GET', '/admin/maps/emerald_forest/export', undefined, gm.token)).status === 403, 'gm (no mapExport) is refused');
  ok((await api('GET', '/admin/maps/emerald_forest/export', undefined, plain.token)).status === 403, 'a normal player is refused');
  dbw.close();
}

try {
  await run();
} catch (e) {
  console.error(e);
  ok(false, `test crashed: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await stopServer();
}
finish('map-preview-server');
