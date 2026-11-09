// The mailbox over a real game server (started on a free port with a throwaway database, then stopped):
// the admin routes and who may use them, the live notice, and reading / claiming / deleting over the WebSocket.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-mail-test-'));
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
  env: { ...process.env, PORT: String(PORT), DB_FILE, STATS_SAMPLE_MS: '1000' },
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
      if (m.t === 'snap' || m.t === 'kick') {
        clearTimeout(t);
        res();
      }
    };
  });
  let req = 0;
  /** One mailbox request and its answer. */
  const mail = async (call: object): Promise<any> => {
    await sleep(130); // the server allows one mailbox action per 100 ms
    const id = ++req + 1000;
    ws.send(JSON.stringify({ t: 'act', req: id, ...call }));
    for (let i = 0; i < 100; i++) {
      const m = msgs.find((x) => x.t === 'mail' && x.req === id);
      if (m) return m;
      await sleep(50);
    }
    throw new Error('mail request timed out');
  };
  const waitFor = async (pred: (m: any) => boolean): Promise<any> => {
    for (let i = 0; i < 100; i++) {
      const m = msgs.find(pred);
      if (m) return m;
      await sleep(100);
    }
    return undefined;
  };
  return { ws, msgs, ready, mail, waitFor, lastMe: () => msgs.filter((m) => m.t === 'snap').at(-1)?.me };
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
  const gmTok = await account('gm1');
  const plainTok = await account('plain1');
  const cli = (user: string, role: string) =>
    spawnSync(process.execPath, ['--import', 'tsx', 'server/admin-role.ts', user, role], { cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8' });
  ok(cli('owner1', 'owner').status === 0, 'owner1 is owner');
  ok(cli('gm1', 'gm').status === 0, 'gm1 is GM');

  const body = { target: { kind: 'char', name: 'Mailee' }, title: 'ทดสอบ', body: 'สวัสดี', attach: { gold: 250 } };
  ok((await api('POST', '/admin/mail', body, plainTok)).status === 403, 'a normal player cannot send mail');
  ok((await api('POST', '/admin/mail', body, gmTok)).status === 403, 'a GM cannot send mail until FEATURE_ROLES allows it');
  ok((await api('GET', '/admin/mail', undefined, gmTok)).status === 403, 'a GM cannot see the mail history either');
  ok((await api('POST', '/admin/mail', body)).status === 401, 'not logged in → 401');
  ok((await api('GET', '/admin/me', undefined, ownerTok)).data.features.includes('mail'), 'the owner has the mail feature');

  const made = await api('POST', '/characters', { name: 'Mailee', classId: 'mage' }, plainTok);
  const c = joinWorld(plainTok, made.data.id);
  await c.ready;
  await api('POST', '/guest', { name: 'GuestX', classId: 'mage' });
  ok((await api('POST', '/admin/mail', { ...body, target: { kind: 'char', name: 'GuestX' } }, ownerTok)).status === 400, 'cannot send to a guest');
  ok((await api('POST', '/admin/mail', { ...body, title: '' }, ownerTok)).status === 400, 'a bad field is a 400');
  ok((await api('POST', '/admin/mail', { ...body, attach: { gold: 5_000_000 } }, ownerTok)).status === 400, 'gold over the cap is a 400');

  const sent = await api('POST', '/admin/mail', body, ownerTok);
  ok(sent.status === 200, `owner sends (${sent.status} ${sent.data.error ?? ''})`);
  const note = await c.waitFor((m) => m.t === 'mailNote' && m.fresh > 0);
  ok(note && note.fresh === 1 && note.unread === 1, 'the player online is told at once');

  const list = await c.mail({ a: 'mailList' });
  ok(list.ok && list.list.length === 1 && list.list[0].attach, 'mailList shows it with an attachment');
  const id = list.list[0].id;
  ok((await c.mail({ a: 'mailRead', id })).mail.body === 'สวัสดี', 'mailRead gives the text');
  const before = c.lastMe()?.gold ?? 0;
  ok((await c.mail({ a: 'mailClaim', id })).ok, 'mailClaim over the socket works');
  ok((await c.mail({ a: 'mailClaim', id })).ok === false, 'a second claim is refused');
  ok((await c.mail({ a: 'mailClaim', id: 'x' })).ok === false && (await c.mail({ a: 'mailRead', id: 1.5 })).ok === false, 'bad ids are refused');
  await sleep(400);
  ok((c.lastMe()?.gold ?? 0) === before + 250, 'the gold arrived in the character');
  ok((await c.mail({ a: 'mailDelete', id })).ok, 'claimed mail can be deleted');

  const hist = await api('GET', '/admin/mail', undefined, ownerTok);
  ok(hist.status === 200 && hist.data[0].claimed === 1 && hist.data[0].read === 1 && hist.data[0].recipients === 1, 'the history shows who read and claimed it');
  const rec = await api('GET', `/admin/mail/${hist.data[0].id}/recipients`, undefined, ownerTok);
  ok(rec.data[0]?.char === 'Mailee' && rec.data[0].claimed === true, 'the recipient list shows the character');
  ok((await api('POST', `/admin/mail/${hist.data[0].id}/recall`, undefined, ownerTok)).status === 400, 'a mail everyone claimed cannot be pulled back');

  const second = await api('POST', '/admin/mail', { ...body, title: 'อันที่สอง' }, ownerTok);
  ok((await api('POST', `/admin/mail/${second.data.id}/recall`, undefined, ownerTok)).status === 200, 'an unclaimed mail can be pulled back');
  ok((await c.mail({ a: 'mailList' })).list.length === 0, 'and it is gone from the player');

  const audit = await api('GET', '/admin/audit', undefined, ownerTok);
  ok(audit.data.some((r: any) => r.action === 'mail') && audit.data.some((r: any) => r.action === 'mailRecall'), 'every send and recall is in the audit log');
}

try {
  await run();
} catch (e) {
  ok(false, `crashed: ${(e as Error).stack}`);
} finally {
  await stopServer();
}
finish('mail-server');
