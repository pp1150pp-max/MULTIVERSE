// End-to-end guest tests against a real game server that this script starts by itself on a free
// port with a throwaway database (never the real server or server/data), then stops:
// guest create, stash refused for guests, guest -> account on sign-up, new guest, per-address limit.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { GUEST_PER_IP_HOUR } from '../src/shared/api';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-test-'));
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
// `node --import tsx` keeps the server in this one process, so stopping it leaves nothing behind.
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

/** Joins the world with a character and keeps every message the server sends. */
function joinWorld(token: string, characterId: number) {
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`);
  const msgs: any[] = [];
  let closed = false;
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
  ws.onclose = () => (closed = true);
  return { ws, msgs, ready, isClosed: () => closed, send: (m: unknown) => ws.send(JSON.stringify(m)) };
}

async function run(): Promise<void> {
  // Wait for the server to answer.
  for (let i = 0; ; i++) {
    try {
      await fetch(`${BASE}/api/me`);
      break;
    } catch {
      if (i > 100) throw new Error('test server did not start');
      await sleep(100);
    }
  }

  // ---------------------------------------------------------- create a guest
  const g = await api('POST', '/guest', { name: 'ทดสอบGuest', classId: 'mage' });
  ok(g.status === 201 && g.data.token && g.data.character?.name === 'ทดสอบGuest', `create guest (${g.status})`);
  const gTok: string = g.data.token;
  const me = await api('GET', '/me', undefined, gTok);
  ok(me.data.guest === true && me.data.username === 'Guest', '/api/me says guest');
  const list = await api('GET', '/characters', undefined, gTok);
  ok(list.data.length === 1 && list.data[0].id === g.data.character.id, 'guest lists its one character');
  ok((await api('POST', '/characters', { name: 'Extra', classId: 'sword' }, gTok)).status === 403, 'guest cannot create more characters');
  ok((await api('DELETE', `/characters/${g.data.character.id}`, undefined, gTok)).status === 403, 'guest cannot delete through the account API');
  ok((await api('POST', '/guest', { name: 'ทดสอบGuest', classId: 'mage' })).status === 409, 'guest name must be unique');
  ok((await api('POST', '/guest', { name: 'x', classId: 'mage' })).status === 400, 'bad guest name refused');
  ok((await api('POST', '/guest', { name: 'Okay', classId: 'wizard' })).status === 400, 'bad class refused');
  ok((await api('POST', '/login', { username: `guest:${'0'.repeat(16)}`, password: '' })).status === 401, 'login with a guest-style name refused');

  // ---------------------------------------------------------- in the world as a guest: no stash
  const c = joinWorld(gTok, g.data.character.id);
  await c.ready;
  ok(c.msgs.find((m) => m.t === 'welcome')?.guest === true, 'welcome says guest');
  const goldBefore = c.msgs.filter((m) => m.t === 'snap').at(-1).me.gold;
  const stashActs = [
    { a: 'stashBuy' }, { a: 'stashGold', amount: 1 }, { a: 'stashPut', i: 0, to: -1 },
    { a: 'stashTake', i: 0, to: -1 }, { a: 'stashSort', key: 'rarity', desc: true }, { a: 'stashMove', from: 0, to: 1 },
  ];
  for (const a of stashActs) c.send({ t: 'act', ...a });
  await sleep(800);
  const refusals = c.msgs.filter((m) => m.t === 'chat' && m.name === '' && String(m.text).startsWith('Guest ใช้คลัง'));
  ok(refusals.length === stashActs.length, `every stash action refused with the Thai message (${refusals.length}/${stashActs.length})`);
  ok(c.msgs.filter((m) => m.t === 'snap').at(-1).me.gold === goldBefore, 'gold unchanged');
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  ok(!db.prepare('SELECT 1 FROM stashes').get(), 'no stash saved for the guest');
  const seen = db.prepare('SELECT last_online FROM accounts WHERE is_guest = 1').get() as { last_online: number } | undefined;
  ok(seen && Date.now() - seen.last_online < 60_000, 'last_online set when the guest joins');

  // ---------------------------------------------------------- sign up while the guest plays
  const reg = await api('POST', '/register', { username: 'tester1', password: 'secret123', guestToken: gTok });
  ok(reg.status === 201 && reg.data.token, `sign up with the guest token (${reg.status})`);
  await sleep(300);
  ok(c.msgs.some((m) => m.t === 'kick') && c.isClosed(), "the guest's game is saved and closed");
  ok((await api('GET', '/me', undefined, gTok)).status === 401, 'old guest token no longer works');
  const accChars = await api('GET', '/characters', undefined, reg.data.token);
  ok(accChars.data.length === 1 && accChars.data[0].name === 'ทดสอบGuest', 'the character is now in the new account');
  ok((await api('GET', '/me', undefined, reg.data.token)).data.guest === false, 'the new account is not a guest');
  ok((await api('POST', '/login', { username: 'tester1', password: 'secret123' })).status === 200, 'can log in to the new account');
  ok((await api('POST', '/characters', { name: 'Two', classId: 'sword' }, reg.data.token)).status === 201, '2nd character ok');
  ok((await api('POST', '/characters', { name: 'Three', classId: 'sword' }, reg.data.token)).status === 201, '3rd character ok');
  ok((await api('POST', '/characters', { name: 'Four', classId: 'sword' }, reg.data.token)).status === 400, '4th refused (the guest counts toward 3)');
  const c2 = joinWorld(reg.data.token, accChars.data[0].id);
  await c2.ready;
  ok(c2.msgs.find((m) => m.t === 'welcome')?.guest === false, 'joins the world as a real account');
  c2.ws.close();

  ok((await api('POST', '/register', { username: 'tester2', password: 'secret123' })).status === 201, 'normal sign-up still works');
  ok((await api('POST', '/register', { username: 'TESTER1', password: 'secret123' })).status === 409, 'taken username refused');

  // ---------------------------------------------------------- "start a new guest" replaces the old one
  const a1 = await api('POST', '/guest', { name: 'Alpha', classId: 'sword' });
  const a2 = await api('POST', '/guest', { name: 'Alpha', classId: 'mage' }, a1.data.token);
  ok(a2.status === 201, `new guest replaces the old one, same name allowed (${a2.status})`);
  ok((await api('GET', '/me', undefined, a1.data.token)).status === 401, 'replaced guest token gone');
  const guests = (db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE is_guest = 1').get() as { n: number }).n;
  ok(guests === 1, `only one guest left (${guests})`);

  // ---------------------------------------------------------- per-address limit (3 made so far)
  for (let n = 4; n <= GUEST_PER_IP_HOUR; n++) {
    ok((await api('POST', '/guest', { name: `Extra${n}`, classId: 'sword' })).status === 201, `guest #${n} this hour ok`);
  }
  ok((await api('POST', '/guest', { name: 'TooMany', classId: 'sword' })).status === 429, `guest #${GUEST_PER_IP_HOUR + 1} this hour refused`);
  db.close();
}

try {
  await run();
} catch (e) {
  ok(false, `crashed: ${(e as Error).stack}`);
} finally {
  await stopServer();
}
finish('guest-server');
