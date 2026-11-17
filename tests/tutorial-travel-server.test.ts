// The account's tutorial quests survive a map change on the real server (bug 2026-11-18: World.travel built
// the new Player without the tutorial, so every warp reset it to nothing done, saved that, and the shop step
// and its 1,000 G could be taken again). Runs its own game server on a free port with a throwaway database.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Db } from '../server/db';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-tut-travel-test-'));
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
  const welcome = () => msgs.find((m) => m.t === 'welcome');
  /** The latest tutorial state the server sent in a snapshot (`me.tut`, sent when it changes). */
  const tut = () => msgs.filter((m) => m.t === 'snap' && m.me?.tut).at(-1)?.me.tut as { done: string[] } | undefined;
  return { ws, msgs, ready, act, welcome, tut };
}

async function account(user: string, ...names: string[]) {
  const reg = await api('POST', '/register', { username: user, password: 'secret123' });
  const tok = reg.data.token as string;
  for (const n of names) await api('POST', '/characters', { name: n, classId: 'sword' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number; name: string }[];
  return { tok, id: (n: string) => chars.find((c) => c.name === n)!.id };
}

/** Opened once the server made the file; closed before the folder is removed (Windows keeps open files). */
let db: Db | undefined;

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
  const owner = await account('ttowner');
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'ttowner', 'owner'], {
    cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8',
  });
  ok(cli.status === 0, 'ttowner is owner');
  const a = await account('ttpia', 'Tia');
  // The account already handed the shop step in (written before it comes online, so the server reads it on join).
  db = new Db(DB_FILE);
  const accId = db.findAccount('ttpia')!.id;
  db.saveTutorial(accId, { done: ['shop'], paid: ['shop'] });

  const P = joinWorld(a.tok, a.id('Tia'));
  await P.ready;
  await sleep(300);
  ok(P.tut()?.done.includes('shop') === true, 'on join: the shop step is done');
  const warp = (zone: string) => api('POST', `/admin/characters/${a.id('Tia')}/teleport`, { zone }, owner.tok);
  ok((await warp('emerald_forest')).status === 200, 'warped to the forest');
  await sleep(400);
  ok((await warp('nexus_city')).status === 200, 'and back to town');
  await sleep(400);
  const sent = P.tut();
  ok(sent?.done.includes('shop') === true, 'after two map changes the browser still sees the shop step done');
  ok(db.loadTutorial(accId).done.includes('shop'), 'and the saved row still has it (the save on travel did not wipe it)');
  P.act({ a: 'tutAccept', step: 'shop' });
  await sleep(300);
  ok(db.loadTutorial(accId).done.join() === 'shop' && !db.loadTutorial(accId).cur, 'the shop step cannot be taken again');
  P.ws.close(4000);
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
  db?.close();
  rmSync(dir, { recursive: true, force: true });
}
finish('tutorial-travel-server');
