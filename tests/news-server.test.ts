// "มีอะไรใหม่" over a real game server (started on a free port with a throwaway database, then stopped):
// the admin routes and who may use them, the push to players and guests, and a note added from the command line
// (npm run add-news, the /ship way) while the server runs.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-news-test-'));
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
  /** Waits (up to ~12 s) for a message that matches. */
  const waitFor = async (pred: (m: any) => boolean): Promise<any> => {
    for (let i = 0; i < 120; i++) {
      const m = msgs.find(pred);
      if (m) return m;
      await sleep(100);
    }
    return undefined;
  };
  return { ws, msgs, ready, waitFor };
}

async function account(username: string): Promise<string> {
  return (await api('POST', '/register', { username, password: 'secret123' })).data.token as string;
}

const newsOf = (c: { msgs: any[] }) => c.msgs.filter((m) => m.t === 'news');
const addNews = (args: string[], input?: string) =>
  spawnSync(process.execPath, ['--import', 'tsx', 'server/add-news.ts', ...args], { cwd: ROOT, env: { ...process.env, DB_FILE }, encoding: 'utf8', input });

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
  ok(cli('owner1', 'owner').status === 0 && cli('gm1', 'gm').status === 0, 'owner1 is owner, gm1 is GM');

  // ---- who may do what
  const note = { title: 'อัปเดตแรก', lines: ['เพิ่มระบบ A', 'แก้บั๊ก B'] };
  ok((await api('GET', '/admin/news', undefined, plainTok)).status === 403, 'a player cannot read the admin list');
  ok((await api('POST', '/admin/news', note, plainTok)).status === 403, 'a player cannot add');
  ok((await api('POST', '/admin/news', note)).status === 401, 'not logged in → 401');
  const gmGet = await api('GET', '/admin/news', undefined, gmTok);
  ok(gmGet.status === 200 && gmGet.data.canEdit === false && gmGet.data.notes.length === 0, 'GM can look (read only)');
  ok((await api('POST', '/admin/news', note, gmTok)).status === 403, 'GM cannot add');
  ok((await api('POST', '/admin/news/switches', { button: false, autopop: true }, gmTok)).status === 403, 'GM cannot flip the switches');
  const ownGet = await api('GET', '/admin/news', undefined, ownerTok);
  ok(ownGet.data.canEdit === true && ownGet.data.switches.button === true && ownGet.data.switches.autopop === false, 'code defaults: button on, popup off');

  // ---- players online (a normal one and a guest) get the notes on join
  const made = await api('POST', '/characters', { name: 'Reader', classId: 'mage' }, plainTok);
  const p = joinWorld(plainTok, made.data.id);
  await p.ready;
  const g = await api('POST', '/guest', { name: 'GuestNews', classId: 'sword' });
  const gc = joinWorld(g.data.token, g.data.character.id);
  await gc.ready;
  ok(!!(await p.waitFor((m) => m.t === 'news')) && !!(await gc.waitFor((m) => m.t === 'news')), 'a player and a guest both get the notes on join');
  ok(newsOf(p)[0].v.notes.length === 0 && newsOf(p)[0].v.button === true, 'with no notes the list is empty');

  // ---- bad values are refused and leave no audit row
  const newsAudit = async () => (await api('GET', '/admin/audit', undefined, ownerTok)).data.filter((r: any) => r.action.startsWith('news')).length;
  for (const [what, b] of [
    ['empty title', { ...note, title: '  ' }],
    ['title too long', { ...note, title: 'ก'.repeat(61) }],
    ['no lines', { ...note, lines: ['', '  '] }],
    ['a line too long', { ...note, lines: ['ข'.repeat(121)] }],
    ['too many lines', { ...note, lines: Array.from({ length: 13 }, (_, i) => `บรรทัด ${i}`) }],
    ['lines not a list', { ...note, lines: 'x' }],
    ['a line not text', { ...note, lines: [5] }],
  ] as const) ok((await api('POST', '/admin/news', b, ownerTok)).status === 400, `refused: ${what}`);
  ok((await newsAudit()) === 0, 'refused writes leave no audit row');

  // ---- owner adds: both players hear at once
  const before = newsOf(p).length;
  const add = await api('POST', '/admin/news', note, ownerTok);
  ok(add.status === 200 && add.data.notes.length === 1 && add.data.notes[0].author === 'owner1', 'owner adds a note');
  await sleep(500);
  ok(newsOf(p).length === before + 1 && newsOf(p).at(-1).v.notes[0].title === 'อัปเดตแรก' && newsOf(p).at(-1).v.notes[0].lines.length === 2, 'the player online gets it at once');
  ok(newsOf(gc).at(-1).v.notes.length === 1, 'the guest too');

  // ---- hide / show / edit / delete
  const id = add.data.notes[0].id as number;
  await api('POST', `/admin/news/${id}/hide`, { hidden: true }, ownerTok);
  await sleep(300);
  ok(newsOf(p).at(-1).v.notes.length === 0, 'a hidden note disappears for players');
  ok((await api('GET', '/admin/news', undefined, gmTok)).data.notes[0].hidden === true, 'but the admin list still has it');
  await api('POST', `/admin/news/${id}/hide`, { hidden: false }, ownerTok);
  const ed = await api('POST', `/admin/news/${id}/edit`, { title: 'แก้แล้ว', lines: ['ข้อความใหม่'] }, ownerTok);
  ok(ed.status === 200 && ed.data.notes[0].title === 'แก้แล้ว', 'edit works');
  ok((await api('POST', '/admin/news/99999/edit', note, ownerTok)).status === 404, 'editing a missing note is a 404');

  // ---- only the 5 newest visible ones are shown
  for (let i = 1; i <= 6; i++) await api('POST', '/admin/news', { title: `รุ่น ${i}`, lines: [`รายการ ${i}`] }, ownerTok);
  await sleep(300);
  const last = newsOf(p).at(-1).v;
  ok(last.notes.length === 5 && last.notes[0].title === 'รุ่น 6' && last.notes[4].title === 'รุ่น 2', 'players get the 5 newest, newest first');
  ok((await api('GET', '/admin/news', undefined, ownerTok)).data.notes.length === 7, 'the admin list has all 7');

  // ---- switches
  ok((await api('POST', '/admin/news/switches', { button: 'x', autopop: true }, ownerTok)).status === 400, 'a bad switch value is refused');
  await api('POST', '/admin/news/switches', { button: false, autopop: true }, ownerTok);
  await sleep(300);
  ok(newsOf(p).at(-1).v.button === false && newsOf(p).at(-1).v.autopop === true, 'the switches reach players online');
  await api('POST', '/admin/news/switches', { button: true, autopop: false }, ownerTok);
  const raw = new DatabaseSync(DB_FILE, { readOnly: true });
  ok(raw.prepare("SELECT 1 FROM settings WHERE key = 'news_switches'").get() === undefined, 'switches back to the code values store nothing');
  raw.close();

  // ---- delete
  ok((await api('POST', `/admin/news/${id}/delete`, {}, gmTok)).status === 403, 'GM cannot delete');
  ok((await api('POST', `/admin/news/${id}/delete`, {}, ownerTok)).data.notes.length === 6, 'owner deletes');

  // ---- command line (the /ship way) while the server runs: the server notices by itself
  const cmd = addNews(['--json', '-'], JSON.stringify({ title: 'จาก ship', lines: ['ของใหม่จาก ship', 'อีกอย่าง'], key: 'abc1234' }));
  ok(cmd.status === 0, `add-news over stdin works (${cmd.stderr})`);
  ok(!!(await p.waitFor((m) => m.t === 'news' && m.v.notes[0]?.title === 'จาก ship')), 'the server notices a note written by another process and tells players');
  ok(!!(await gc.waitFor((m) => m.t === 'news' && m.v.notes[0]?.title === 'จาก ship')), 'guests too');
  const again = addNews(['--json', '-'], JSON.stringify({ title: 'จาก ship', lines: ['ของใหม่จาก ship'], key: 'abc1234' }));
  ok(again.status === 0 && /ข้าม/.test(again.stdout), 'the same key twice adds nothing');
  const flags = addNews(['--title', 'จาก flag', '--items-file', '-'], 'บรรทัดแรก\n\nบรรทัดสอง\n');
  ok(flags.status === 0 && /2 บรรทัด/.test(flags.stdout), '--title + --items-file works, blank lines dropped');
  ok(addNews(['--json', '-'], JSON.stringify({ title: '', lines: ['x'] })).status === 1, 'the command line refuses a bad note');
  ok(addNews(['--json', '-'], 'not json').status === 1, 'and bad JSON');
  ok(addNews(['--json', '-'], JSON.stringify({ title: 't', lines: ['x'], key: 'a b' })).status === 1, 'and a bad key');
  const fromCli = (await api('GET', '/admin/news', undefined, ownerTok)).data.notes.filter((x: any) => x.author === 'command line');
  ok(fromCli.length === 2, 'the two command line notes are listed with that author');

  // ---- audit
  const audit = (await api('GET', '/admin/audit', undefined, ownerTok)).data.filter((r: any) => r.action.startsWith('news')).map((r: any) => r.action);
  for (const a of ['news-add', 'news-edit', 'news-hide', 'news-delete', 'news-switches']) ok(audit.includes(a), `audit has ${a}`);
}

try {
  await run();
} catch (e) {
  ok(false, `crashed: ${(e as Error).stack}`);
} finally {
  await stopServer();
}
finish('news-server');
