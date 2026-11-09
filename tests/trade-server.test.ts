// Trade on the real server, end to end: the request popup, accepting, offering (a part of a stack),
// the actions the world refuses while a window is open, confirming, the 3 s countdown, the swap, the block
// setting, guests, same-account characters, and the trade ending when a player drops. Runs its own game
// server on a free port with a throwaway database. (The rules in detail: tests/trade.test.ts.)
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
  const lines = () => msgs.filter((m) => m.t === 'chat').map((m) => m.text as string);
  return { ws, msgs, ready, act, lines };
}
type World = ReturnType<typeof joinWorld>;

async function account(user: string, ...names: string[]) {
  const reg = await api('POST', '/register', { username: user, password: 'secret123' });
  const tok = reg.data.token as string;
  for (const n of names) await api('POST', '/characters', { name: n, classId: 'sword' }, tok);
  const chars = (await api('GET', '/characters', undefined, tok)).data as { id: number; name: string }[];
  return { tok, id: (n: string) => chars.find((c) => c.name === n)!.id };
}

type Slot = { potion?: string; count: number } | null;
const bag = (w: World): Slot[] => w.msgs.filter((m) => m.t === 'snap' && m.me.inv).at(-1)?.me.inv.bag;
const count = (w: World, kind: string): number => bag(w).reduce((s, e) => s + (e?.potion === kind ? e.count : 0), 0);
const slotOf = (w: World, kind: string): number => bag(w).findIndex((e) => e?.potion === kind);
const view = (w: World) => w.msgs.filter((m) => m.t === 'trade').at(-1)?.view;
const ended = (w: World) => w.msgs.filter((m) => m.t === 'tradeEnd').at(-1);

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
  const a = await account('tradea', 'Aria', 'AriaAlt');
  const b = await account('tradeb', 'Bodo');
  const c = await account('tradec', 'Cleo');
  const g = await api('POST', '/guest', { name: 'Gusto', classId: 'mage' });

  const A = joinWorld(a.tok, a.id('Aria'));
  const A2 = joinWorld(a.tok, a.id('AriaAlt'));
  const B = joinWorld(b.tok, b.id('Bodo'));
  const C = joinWorld(c.tok, c.id('Cleo'));
  const G = joinWorld(g.data.token, g.data.character.id);
  await Promise.all([A.ready, A2.ready, B.ready, C.ready, G.ready]);

  // Who may trade.
  G.act({ a: 'tradeRequest', name: 'Aria' });
  A.act({ a: 'tradeRequest', name: 'Gusto' });
  A.act({ a: 'tradeRequest', name: 'AriaAlt' });
  A.act({ a: 'tradeRequest', name: 'Nobody' });
  await sleep(400);
  ok(G.lines().some((t) => t.includes('Guest')) && !A.msgs.some((m) => m.t === 'tradeRequest'), 'a guest cannot ask');
  ok(A.lines().some((t) => t.includes('Guest')) && !G.msgs.some((m) => m.t === 'tradeRequest'), 'a guest cannot be asked');
  ok(A.lines().some((t) => t.includes('บัญชีตัวเอง')) && !A2.msgs.some((m) => m.t === 'tradeRequest'), 'two characters of one account cannot trade');
  ok(A.lines().some((t) => t.includes('ไม่พบผู้เล่น')), 'an unknown name is refused');

  // The block setting.
  B.act({ a: 'tradeBlock', on: true });
  await sleep(200);
  A.act({ a: 'tradeRequest', name: 'Bodo' });
  await sleep(300);
  ok(A.lines().some((t) => t.includes('ปิดการรับคำขอเทรด')) && !B.msgs.some((m) => m.t === 'tradeRequest'), 'blocked requests are refused');
  B.act({ a: 'tradeBlock', on: false });
  await sleep(200);

  // A asks B, B accepts: both windows open.
  const hpA = count(A, 'hp');
  const mpA = count(A, 'mp');
  const hpB = count(B, 'hp');
  const mpB = count(B, 'mp');
  ok(hpA > 3 && mpB > 0, `start: potions in the bags (${hpA} hp, ${mpB} mp)`);
  A.act({ a: 'tradeRequest', name: 'Bodo' });
  await sleep(300);
  const req = B.msgs.find((m) => m.t === 'tradeRequest');
  ok(req?.name === 'Aria' && req.seconds === 30, 'B gets the request popup (30 s)');
  B.act({ a: 'tradeAnswer', from: req.from, yes: true });
  await sleep(300);
  ok(view(A)?.you === 'a' && view(B)?.you === 'b' && view(A).a.name === 'Aria', 'both windows open (A asked, B was asked)');

  // Offers: 3 of A's hp potions, all of B's mp potions. Bad ones first.
  A.act({ a: 'tradeAdd', slot: -1 });
  A.act({ a: 'tradeAdd', slot: slotOf(A, 'hp'), n: 999 });
  A.act({ a: 'tradeGold', amount: 5 });
  await sleep(300);
  ok(view(A).a.items.length === 0 && view(A).a.gold === 0, 'bad slot, bad amount and gold you do not have are all refused');
  A.act({ a: 'tradeAdd', slot: slotOf(A, 'hp'), n: 3 });
  B.act({ a: 'tradeAdd', slot: slotOf(B, 'mp') });
  await sleep(300);
  ok(view(B).a.items[0]?.entry.count === 3 && view(A).b.items[0]?.entry.count === mpB, "each sees the other's offer");
  ok(count(A, 'hp') === hpA, 'offered potions are still in the bag until the swap');

  // The world refuses things that move items while the window is open.
  A.act({ a: 'sell', i: slotOf(A, 'hp') });
  A.act({ a: 'sort', key: 'name', desc: false });
  A.act({ a: 'mktList', req: 1, i: 0, price: 100 });
  await sleep(300);
  ok(A.lines().filter((t) => t.includes('กำลังเทรดอยู่')).length >= 2 && count(A, 'hp') === hpA, 'selling, sorting and market actions are refused while trading');

  // A confirm with an old version is refused; then both confirm and wait out the 3 s.
  A.act({ a: 'tradeConfirm', ver: view(A).ver - 1 });
  await sleep(200);
  ok(!view(A).a.confirmed, 'a confirm with a stale version does nothing');
  A.act({ a: 'tradeConfirm', ver: view(A).ver });
  A.act({ a: 'tradeConfirm', ver: view(A).ver });
  await sleep(300);
  ok(view(B).a.confirmed && !view(B).b.confirmed, 'B sees A confirmed');
  B.act({ a: 'tradeConfirm', ver: view(B).ver });
  await sleep(400);
  ok(view(A).cd !== null && !ended(A), 'both confirmed: the countdown runs, nothing swapped yet');
  await sleep(3400);
  ok(ended(A)?.ok === true && ended(B)?.ok === true, 'after 3 s both are told it worked');
  await sleep(300);
  ok(count(A, 'hp') === hpA - 3 && count(A, 'mp') === mpA + mpB && count(B, 'hp') === hpB + 3 && count(B, 'mp') === 0, 'the potions moved, nothing created or lost');

  // Cancel, and a player dropping mid-trade.
  C.act({ a: 'tradeRequest', name: 'Aria' });
  await sleep(300);
  const req2 = A.msgs.filter((m) => m.t === 'tradeRequest').at(-1);
  ok(req2?.name === 'Cleo', 'Cleo asks Aria');
  A.act({ a: 'tradeAnswer', from: req2.from, yes: true });
  await sleep(300);
  A.act({ a: 'tradeAdd', slot: slotOf(A, 'hp') });
  await sleep(200);
  const hpNow = count(A, 'hp');
  C.ws.close();
  await sleep(500);
  ok(ended(A)?.ok === false && A.lines().some((t) => t.includes('ออกจากเกม')), 'the other player dropped: the trade is cancelled');
  ok(count(A, 'hp') === hpNow, 'and Aria still has everything she offered');

  for (const s of [A, A2, B, G]) s.ws.close(4000);
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
finish('trade-server');
