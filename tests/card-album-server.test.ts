// Registering a card on the real server (owner 2026-11-28: one card is used up and the album keeps the record): the bag the
// browser is sent loses exactly one of the stack, the last card empties its slot, pressing again (or from another character of
// the account) takes nothing, the saved character has the same bag, it stays so after logging in again, a guest can't.
// Runs its own game server on a free port with a throwaway database.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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

/** Waits until `cond` holds (at most 5 s). */
async function until(cond: () => unknown): Promise<void> {
  for (let i = 0; i < 100 && !cond(); i++) await sleep(50);
}

async function joinWorld(token: string, characterId: number) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token, characterId, delta: 1 }));
  ws.onmessage = (e) => msgs.push(JSON.parse(String(e.data)));
  /** The latest value of a field the server sends only when it changes. */
  const last = (k: 'inv' | 'album') => msgs.filter((m) => m.t === 'snap' && m.me[k]).at(-1)?.me[k];
  /** The card stacks in the bag as the browser has it: the count of each slot holding `id`. */
  const cards = (id: string) => (last('inv')?.bag ?? []).filter((e: any) => e?.stone === id).map((e: any) => e.count) as number[];
  const album = () => (last('album') ?? []) as string[];
  const register = (card: string) => ws.send(JSON.stringify({ t: 'act', a: 'albumRegister', card }));
  await until(() => last('inv') && last('album'));
  if (!last('inv')) throw new Error('join timed out');
  return { ws, msgs, cards, album, register };
}

function dbRead<T>(q: string, ...args: (string | number)[]): T[] {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const r = db.prepare(q).all(...args) as T[];
  db.close();
  return r;
}
const savedCards = (charId: number, id: string): number[] =>
  JSON.parse(dbRead<{ data: string }>('SELECT data FROM characters WHERE id = ?', charId)[0].data).bag.filter((e: any) => e?.stone === id).map((e: any) => e.count);
const albumRows = (): string[] => dbRead<{ card_id: string }>('SELECT card_id FROM card_album ORDER BY card_id').map((r) => r.card_id);

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
  const tok = (await api('POST', '/register', { username: 'albumowner', password: 'secret123' })).data.token as string;
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'albumowner', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8' });
  ok(cli.status === 0, 'albumowner is owner');
  const one: number = (await api('POST', '/characters', { name: 'CardOne', classId: 'sword' }, tok)).data.id;
  const give = async (charId: number, stone: string, count: number) =>
    ok((await api('POST', `/admin/characters/${charId}/items`, { kind: 'stone', stone, count }, tok)).status === 200, `${count} × ${stone} spawned`);
  await give(one, 'card_wild_boar', 3);
  await give(one, 'card_green_slime', 1);

  const A = await joinWorld(tok, one);
  ok(A.cards('card_wild_boar').join() === '3' && A.cards('card_green_slime').join() === '1' && !A.album().length, 'start: a stack of 3, a single card, an empty album');

  // The button pressed many times at once: one card goes, once.
  for (let i = 0; i < 10; i++) A.register('card_wild_boar');
  await until(() => A.album().length === 1);
  await sleep(400);
  ok(A.cards('card_wild_boar').join() === '2', `one card of the stack is used up (${A.cards('card_wild_boar')})`);
  ok(A.album().join() === 'card_wild_boar', `the album has the record (${A.album()})`);
  ok(savedCards(one, 'card_wild_boar').join() === '2' && albumRows().join() === 'card_wild_boar', 'saved at once: the bag and one album row');

  // The last card of its slot: gone from the bag.
  A.register('card_green_slime');
  await until(() => A.album().length === 2);
  ok(A.cards('card_green_slime').length === 0, `the last card leaves the bag (${JSON.stringify(A.cards('card_green_slime'))})`);
  ok(savedCards(one, 'card_green_slime').length === 0, 'and the saved bag');

  // A card not in the bag registers nothing.
  A.register('card_yeti');
  await sleep(400);
  ok(A.album().length === 2 && albumRows().length === 2, 'a card not owned: nothing');
  A.ws.close(4000);
  await sleep(500);

  // Logged in again: still gone, still recorded, still can't be registered twice.
  const A2 = await joinWorld(tok, one);
  ok(A2.cards('card_wild_boar').join() === '2' && !A2.cards('card_green_slime').length && A2.album().length === 2, 'after logging in again: the same bag and album');
  A2.register('card_wild_boar');
  await sleep(400);
  ok(A2.cards('card_wild_boar').join() === '2' && savedCards(one, 'card_wild_boar').join() === '2', 'registered before: the card stays in the bag');
  A2.ws.close(4000);
  await sleep(500);

  // Another character of the account: the album is the account's, its copy is not taken.
  const two: number = (await api('POST', '/characters', { name: 'CardTwo', classId: 'mage' }, tok)).data.id;
  await give(two, 'card_wild_boar', 1);
  const B = await joinWorld(tok, two);
  ok(B.album().length === 2, 'the second character sees the same album');
  B.register('card_wild_boar');
  await sleep(400);
  ok(B.cards('card_wild_boar').join() === '1' && albumRows().length === 2, 'it can\'t register it again: its card stays');
  B.ws.close(4000);

  // A guest has no album: nothing is taken.
  const g = (await api('POST', '/guest', { name: 'Gusto', classId: 'mage' })).data;
  await give(g.character.id, 'card_wild_boar', 1);
  const G = await joinWorld(g.token, g.character.id);
  G.register('card_wild_boar');
  await sleep(400);
  ok(G.cards('card_wild_boar').join() === '1' && albumRows().length === 2, 'a guest keeps the card');
  G.ws.close(4000);
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
finish('card-album-server');
