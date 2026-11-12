// Megaphone on the real server (owner 2026-11-12): a bound item that announces a message to everyone
// online, as a banner like the owner's announcement. One per 30 s across the whole server; anything
// refused (Guest, empty or too long, the cooldown) keeps the megaphone. Runs its own game server on a free
// port with a throwaway database; the megaphones arrive by owner mail.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finish, ok } from './check';
import { megaphoneText, MEGAPHONE_MAX } from '../src/shared/data/stones';

// ---- the message rules (shared with the browser)
ok('error' in megaphoneText(''), 'empty is refused');
ok('error' in megaphoneText('   \n '), 'blank is refused');
ok('error' in megaphoneText(42), 'not text is refused');
ok('error' in megaphoneText('ก'.repeat(MEGAPHONE_MAX + 1)), 'over 100 is refused');
{
  const m = megaphoneText(`  สวัสดี\u0007ทุกคน  `);
  ok('text' in m && m.text === 'สวัสดีทุกคน', 'control characters out, trimmed');
}

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-mega-test-'));
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
  let req = 0;
  const mail = async (call: object): Promise<any> => {
    await sleep(130);
    const id = ++req + 1000;
    act({ req: id, ...call });
    for (let i = 0; i < 100; i++) {
      const m = msgs.find((x) => x.t === 'mail' && x.req === id);
      if (m) return m;
      await sleep(50);
    }
    throw new Error('mail request timed out');
  };
  const lines = () => msgs.filter((m) => m.t === 'chat').map((m) => m.text as string);
  const announces = () => msgs.filter((m) => m.t === 'announce');
  const megaphones = () => {
    const bag = msgs.filter((m) => m.t === 'snap' && m.me.inv).at(-1)?.me.inv.bag as ({ stone?: string; count: number } | null)[];
    return bag.reduce((s, e) => s + (e?.stone === 'megaphone' ? e.count : 0), 0);
  };
  return { ws, msgs, ready, act, mail, lines, announces, megaphones };
}

async function account(username: string): Promise<string> {
  return (await api('POST', '/register', { username, password: 'secret123' })).data.token as string;
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
  const ownerTok = await account('owner1');
  const cli = spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', 'owner1', 'owner'], { cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8' });
  ok(cli.status === 0, 'owner1 is owner');
  const aTok = await account('shouter');
  const bTok = await account('listener');
  const a = joinWorld(aTok, (await api('POST', '/characters', { name: 'Shouter', classId: 'sword' }, aTok)).data.id);
  const b = joinWorld(bTok, (await api('POST', '/characters', { name: 'Listener', classId: 'mage' }, bTok)).data.id);
  await Promise.all([a.ready, b.ready]);

  const sent = await api('POST', '/admin/mail', {
    target: { kind: 'char', name: 'Shouter' }, title: 'โทรโข่ง', body: 'ของรางวัล', attach: { items: [{ kind: 'stone', stone: 'megaphone', count: 3 }] },
  }, ownerTok);
  ok(sent.status === 200, `owner mails 3 megaphones (${sent.status} ${sent.data.error ?? ''})`);
  const list = await a.mail({ a: 'mailList' });
  ok((await a.mail({ a: 'mailClaim', id: list.list[0].id })).ok, 'claimed');
  await sleep(400);
  ok(a.megaphones() === 3, `3 in the bag (${a.megaphones()})`);

  // Refused before anything is used up.
  a.act({ a: 'megaphone', text: '   ' });
  a.act({ a: 'megaphone', text: 'x'.repeat(MEGAPHONE_MAX + 1) });
  await sleep(400);
  ok(a.announces().length === 0 && a.megaphones() === 3, 'empty / too long: nothing sent, kept');

  // Sent to everyone online, with the sender's name.
  a.act({ a: 'megaphone', text: 'ขายดาบ +10 ทักมา' });
  await sleep(500);
  const got = b.announces().at(-1);
  ok(got?.megaphone === true && got.text === 'ขายดาบ +10 ทักมา' && got.from === 'Shouter' && got.direct === false, 'the other player gets the banner');
  ok(a.announces().length === 1, 'the sender sees it too');
  ok(a.megaphones() === 2, `one used (${a.megaphones()})`);

  // Anyone else within 30 s waits; the megaphone stays.
  a.act({ a: 'megaphone', text: 'อีกรอบ' });
  await sleep(500);
  ok(b.announces().length === 1 && a.megaphones() === 2, 'within 30 s: refused and kept');
  ok(a.lines().some((t) => t.includes('รออีก')), 'told how long to wait');

  // The chat log in /admin has it.
  const log = await api('GET', '/admin/chat?limit=20', undefined, ownerTok);
  ok(JSON.stringify(log.data).includes('[โทรโข่ง] ขายดาบ +10 ทักมา'), `in the admin chat log (${log.status})`);

  // A guest can't use one (and has none; the guest check comes first).
  const g = await api('POST', '/guest', { name: 'GuestM', classId: 'mage' });
  const gw = joinWorld(g.data.token, g.data.character.id);
  await gw.ready;
  gw.act({ a: 'megaphone', text: 'hi' });
  await sleep(400);
  ok(gw.lines().some((t) => t.includes('Guest ใช้โทรโข่งไม่ได้')), 'guest is refused');

  for (const w of [a, b, gw]) w.ws.close();
}

try {
  await run();
} finally {
  if (server.exitCode === null) {
    server.kill();
    await new Promise((r) => server.once('exit', r));
  }
  rmSync(dir, { recursive: true, force: true });
}
finish('megaphone-server');
