// Friends on the real server, end to end: a request to an offline player waiting until they join, accepting,
// the list (online / offline, level, class, map) pushed when a friend comes or goes, the "friend is online"
// line, whispers (to anyone online, guests too, the echo, unknown names), and blocks stopping whispers,
// party invites and trade requests without saying why. Runs its own game server on a free port with a
// throwaway database. (The rules in detail: tests/friends.test.ts.)
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-test-'));
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
  env: { ...process.env, PORT: String(PORT), DB_FILE: join(dir, 'test.db') },
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
  const say = (text: string, to: string) => ws.send(JSON.stringify({ t: 'chat', text, ch: 'whisper', to }));
  const lines = () => msgs.filter((m) => m.t === 'chat').map((m) => m.text as string);
  const view = () => msgs.filter((m) => m.t === 'friends').at(-1)?.view;
  const whispers = () => msgs.filter((m) => m.t === 'chat' && m.ch === 'whisper');
  return { ws, msgs, ready, act, say, lines, view, whispers };
}

async function account(user: string, ...names: string[]) {
  const reg = await api('POST', '/register', { username: user, password: 'secret123' });
  const tok = reg.data.token as string;
  for (const n of names) await api('POST', '/characters', { name: n, classId: 'sword' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number; name: string }[];
  return { tok, id: (n: string) => chars.find((c) => c.name === n)!.id };
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
  const a = await account('frienda', 'Aria');
  const b = await account('friendb', 'Bodo');
  const c = await account('friendc', 'Cleo');
  const g = await api('POST', '/guest', { name: 'Gusto', classId: 'mage' });

  const A = joinWorld(a.tok, a.id('Aria'));
  const C = joinWorld(c.tok, c.id('Cleo'));
  const G = joinWorld(g.data.token, g.data.character.id);
  await Promise.all([A.ready, C.ready, G.ready]);
  await sleep(3300); // the friends list comes a moment after joining

  ok(A.view()?.friends.length === 0, 'a member gets an (empty) friends list after joining');
  ok(!G.msgs.some((m) => m.t === 'friends'), 'a guest gets none');
  G.act({ a: 'friendRequest', name: 'Aria' });
  await sleep(300);
  ok(G.lines().some((t) => t.includes('Guest ใช้ระบบเพื่อนไม่ได้')), 'a guest cannot send requests');

  // A request to Bodo, who is offline: it waits until he joins.
  A.act({ a: 'friendRequest', name: 'Bodo' });
  await sleep(300);
  ok(A.view()?.outgoing[0]?.char?.name === 'Bodo' && !A.view().outgoing[0].online, 'the request shows as waiting, Bodo offline');
  const B = joinWorld(b.tok, b.id('Bodo'));
  await B.ready;
  await sleep(3300);
  ok(B.view()?.incoming[0]?.char?.name === 'Aria' && B.lines().some((t) => t.includes('มีคำขอเป็นเพื่อนรอคำตอบอยู่ 1')), 'Bodo joins and finds the request');
  B.act({ a: 'friendAnswer', acc: B.view().incoming[0].acc, yes: true });
  await sleep(300);
  const fb = A.view()?.friends[0];
  ok(fb?.online && fb.char.name === 'Bodo' && fb.char.cls === 'sword' && fb.char.lv === 1 && fb.char.zone === 'nexus_city', 'Aria sees Bodo online: level, class, map');
  ok(B.view()?.friends[0]?.char?.name === 'Aria', 'and Bodo sees Aria');

  // Leaving and coming back updates the list, with a line for coming back.
  B.ws.close(4000);
  await sleep(400);
  ok(A.view()?.friends[0]?.online === false && A.view().friends[0].char.name === 'Bodo', 'Bodo left: shown offline');
  const B2 = joinWorld(b.tok, b.id('Bodo'));
  await B2.ready;
  await sleep(300);
  ok(A.view()?.friends[0]?.online === true && A.lines().some((t) => t.includes('เพื่อนของคุณ Bodo เข้าเกมแล้ว')), 'Bodo is back: online again, and Aria is told');

  // Whispers: to anyone online (not only friends), guests too.
  A.say('hello cleo', 'cleo');
  G.say('hi from a guest', 'Aria');
  await sleep(700); // chat allows one line per 600 ms
  A.say('anyone?', 'Nobody');
  await sleep(400);
  ok(C.whispers().some((m) => m.name === 'Aria' && m.text === 'hello cleo' && !m.to), 'Cleo (not a friend) gets the whisper');
  ok(A.whispers().some((m) => m.to === 'Cleo' && m.text === 'hello cleo'), 'Aria sees her own whisper echoed, to Cleo');
  ok(A.whispers().some((m) => m.name === 'Gusto' && m.text === 'hi from a guest'), 'a guest can whisper');
  ok(!B2.whispers().length && !G.whispers().some((m) => m.text === 'hello cleo'), 'nobody else sees it');
  ok(A.lines().some((t) => t.includes('ไม่พบผู้เล่น Nobody')), 'an unknown name is refused');

  // Blocks: Aria blocks Cleo, who then can't whisper, invite, trade or ask; Aria and Bodo are still fine.
  A.act({ a: 'friendBlock', name: 'Cleo' });
  await sleep(400);
  ok(A.view()?.blocked[0]?.name === 'Cleo', 'Cleo is on the block list');
  const before = A.whispers().length;
  C.say('psst', 'Aria');
  await sleep(700);
  C.act({ a: 'partyInvite', name: 'Aria' });
  await sleep(300);
  C.act({ a: 'tradeRequest', name: 'Aria' });
  await sleep(300);
  C.act({ a: 'friendRequest', name: 'Aria' });
  await sleep(400);
  ok(A.whispers().length === before && C.lines().some((t) => t.includes('ส่งกระซิบถึง Aria ไม่ได้')), 'a blocked whisper does not arrive');
  ok(!A.msgs.some((m) => m.t === 'partyInvite') && C.lines().some((t) => t.includes('ปิดการรับคำชวนปาร์ตี้')), 'a blocked party invite does not arrive');
  ok(!A.msgs.some((m) => m.t === 'tradeRequest') && C.lines().some((t) => t.includes('ปิดการรับคำขอเทรด')), 'a blocked trade request does not arrive');
  ok(!A.view().incoming.length && C.lines().some((t) => t.includes('ส่งคำขอเป็นเพื่อนถึง Aria ไม่ได้')), 'a blocked friend request does not arrive');
  ok(!C.lines().some((t) => t.includes('บล็อก')), 'Cleo is never told she is blocked');
  B2.act({ a: 'partyInvite', name: 'Aria' });
  await sleep(300);
  ok(A.msgs.some((m) => m.t === 'partyInvite'), 'others can still invite Aria');

  // Unblock: whispers arrive again.
  A.act({ a: 'friendUnblock', acc: A.view().blocked[0].acc });
  await sleep(700);
  C.say('again', 'Aria');
  await sleep(400);
  ok(!A.view().blocked.length && A.whispers().some((m) => m.text === 'again'), 'after unblocking the whisper arrives');

  // Removing a friend clears both lists.
  A.act({ a: 'friendRemove', acc: A.view().friends[0].acc });
  await sleep(400);
  ok(!A.view().friends.length && !B2.view().friends.length, 'removing clears both lists');

  for (const s of [A, B2, C, G]) s.ws.close(4000);
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
finish('friends-server');
