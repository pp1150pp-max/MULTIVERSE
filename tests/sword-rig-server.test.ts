// The papercraft sword rig on the real server: the snapshot tells everyone the worn weapon's and armour's kinds
// (PlayerSnap wpn / arm), so each browser can draw the matching paper sword and armour; taking the weapon off
// clears it and putting it back on brings it back, for the wearer and for another player.
// Runs its own game server on a free port with a throwaway database.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

function joinWorld(token: string, characterId: number) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  let you = -1;
  const ready = new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('join timed out')), 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId }));
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      msgs.push(m);
      if (m.t === 'welcome') you = m.you;
      if (m.t === 'snap') {
        clearTimeout(t);
        res();
      }
    };
  });
  const act = (o: object) => ws.send(JSON.stringify({ t: 'act', ...o }));
  const snaps = () => msgs.filter((m) => m.t === 'snap');
  /** The latest look bundle of player `id` (snapshot delta leaves it out when unchanged, so the last one sent). */
  const look = (id = you) => snaps().map((s) => s.players.find((p: any) => p.id === id)).filter((p: any) => p?.name !== undefined).at(-1);
  const bag = () => snaps().filter((s) => s.me?.inv).at(-1)?.me.inv.bag as ({ baseId?: string; slot?: string } | null)[];
  return { ws, ready, act, look, bag, you: () => you };
}

async function account(user: string, name: string) {
  const reg = await api('POST', '/register', { username: user, password: 'secret123' });
  const tok = reg.data.token as string;
  await api('POST', '/characters', { name, classId: 'sword' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number }[];
  return { tok, charId: chars[0].id };
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
  const a = await account('rigsword', 'Ash');
  const b = await account('rigother', 'Bea');
  const A = joinWorld(a.tok, a.charId);
  const B = joinWorld(b.tok, b.charId);
  await Promise.all([A.ready, B.ready]);
  await sleep(400);

  const start = A.look();
  ok(start?.wpn === 'weapon_1', `the starter sword's kind is in the look (${start?.wpn})`);
  ok(start?.arm === undefined, 'no armour worn: no arm');
  ok(B.look(A.you())?.wpn === 'weapon_1', 'another player sees it too');

  A.act({ a: 'unequip', slot: 'weapon' });
  await sleep(400);
  ok(A.look()?.name !== undefined && A.look()?.wpn === undefined, 'weapon taken off: no wpn');
  ok(B.look(A.you())?.wpn === undefined, 'the other player sees it gone');

  const i = A.bag()?.findIndex((e) => e?.slot === 'weapon') ?? -1;
  ok(i >= 0, 'the sword went into the bag');
  A.act({ a: 'equip', i });
  await sleep(400);
  ok(A.look()?.wpn === 'weapon_1' && B.look(A.you())?.wpn === 'weapon_1', 'put back on: both see it again');

  for (const s of [A, B]) s.ws.close(4000);
}

try {
  await run();
} catch (e) {
  ok(false, `crashed: ${(e as Error).message}`);
} finally {
  server.kill();
  await sleep(300);
  rmSync(dir, { recursive: true, force: true });
}
finish('sword-rig-server');
