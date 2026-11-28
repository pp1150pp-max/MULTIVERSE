// The landing page's data over a real game server (free port, throwaway database, then stopped):
// GET /api/landing (public, CORS open), the close beta card on /admin and who may change it, and the /landing page route.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finish, ok } from './check';
import { LANDING_DEFAULT, LANDING_NEWS, cleanLanding, fromThaiInput, toThaiInput } from '../src/shared/landing';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-landing-test-'));
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

// ---- pure helpers
ok(LANDING_DEFAULT.start === Date.parse('2026-11-28T18:00:00+07:00') && LANDING_DEFAULT.end === Date.parse('2026-12-05T18:00:00+07:00'), 'code window: 28 Nov – 5 Dec 2026 18:00 Thai time');
ok(toThaiInput(LANDING_DEFAULT.start) === '2026-11-28T18:00' && fromThaiInput('2026-11-28T18:00') === LANDING_DEFAULT.start, 'datetime-local round trip in Thai time');
ok(Number.isNaN(fromThaiInput('28/11/2026')), 'a bad datetime-local value is NaN');
ok('error' in cleanLanding({ start: 2, end: 1, news: true }), 'refused: times out of range');
ok('error' in cleanLanding({ start: LANDING_DEFAULT.end, end: LANDING_DEFAULT.start, news: true }), 'refused: end before start');
ok('error' in cleanLanding({ start: LANDING_DEFAULT.start, end: LANDING_DEFAULT.end, news: 'yes' }), 'refused: news not a boolean');
ok('error' in cleanLanding({ start: NaN, end: LANDING_DEFAULT.end, news: true }), 'refused: NaN');

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
  return { status: r.status, headers: r.headers, data: (await r.json().catch(() => ({}))) as any };
}
const account = async (username: string) => (await api('POST', '/register', { username, password: 'secret123' })).data.token as string;

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

  // ---- public read, no login
  let pub = await api('GET', '/landing');
  ok(pub.status === 200 && pub.data.start === LANDING_DEFAULT.start && pub.data.end === LANDING_DEFAULT.end && Array.isArray(pub.data.news) && pub.data.news.length === 0, 'no login: code window, no notes yet');
  ok(pub.headers.get('access-control-allow-origin') === '*', 'readable from another site (CORS *)');
  const pre = await fetch(`${BASE}/api/landing`, { method: 'OPTIONS' });
  ok(pre.status === 204 && pre.headers.get('access-control-allow-methods') === 'GET', 'preflight answered');
  ok((await api('POST', '/landing', {})).status !== 200, 'POST on the public route does nothing');

  // ---- notes: newest LANDING_NEWS visible ones
  for (let i = 1; i <= LANDING_NEWS + 2; i++) ok((await api('POST', '/admin/news', { title: `อัปเดต ${i}`, lines: [`เรื่อง ${i}`] }, ownerTok)).status === 200, `note ${i} added`);
  const all = (await api('GET', '/admin/news', undefined, ownerTok)).data.notes as { id: number; title: string }[];
  ok((await api('POST', `/admin/news/${all[0].id}/hide`, { hidden: true }, ownerTok)).status === 200, 'newest note hidden');
  pub = await api('GET', '/landing');
  ok(pub.data.news.length === LANDING_NEWS, `lists ${LANDING_NEWS} notes`);
  ok(pub.data.news[0].title === all[1].title && !pub.data.news.some((n: any) => n.title === all[0].title), 'newest first, hidden ones left out');
  ok(pub.data.news.every((n: any) => Object.keys(n).sort().join() === 'at,id,lines,title'), 'a note carries only id/at/title/lines (no author)');

  // ---- admin card: who may look / change
  ok((await api('GET', '/admin/landing', undefined, plainTok)).status === 403, 'a player cannot read the admin card');
  ok((await api('GET', '/admin/landing')).status === 401, 'not logged in → 401');
  const gm = await api('GET', '/admin/landing', undefined, gmTok);
  ok(gm.status === 200 && gm.data.canEdit === false && gm.data.config.news === true, 'GM can look (read only)');
  const next = { start: Date.parse('2026-12-01T18:00:00+07:00'), end: Date.parse('2026-12-08T18:00:00+07:00'), news: false };
  ok((await api('POST', '/admin/landing', next, gmTok)).status === 403, 'GM cannot change it');
  ok((await api('POST', '/admin/landing', { ...next, end: next.start }, ownerTok)).status === 400, 'owner: end = start refused');
  const own = await api('POST', '/admin/landing', next, ownerTok);
  ok(own.status === 200 && own.data.config.start === next.start && own.data.config.news === false, 'owner changes the window');
  pub = await api('GET', '/landing');
  ok(pub.data.start === next.start && pub.data.end === next.end && pub.data.news.length === 0, 'public view follows; news off = no notes');
  const audit = (await api('GET', '/admin/audit', undefined, ownerTok)).data.filter((r: any) => r.action === 'landing');
  ok(audit.length === 1 && /2026-12-01 18:00/.test(audit[0].details), 'one audit row with the new times');
  ok((await api('POST', '/admin/landing', next, ownerTok)).status === 200 && (await api('GET', '/admin/audit', undefined, ownerTok)).data.filter((r: any) => r.action === 'landing').length === 1, 'saving the same values adds no audit row');
  ok((await api('POST', '/admin/landing', LANDING_DEFAULT, ownerTok)).status === 200 && (await api('GET', '/landing')).data.start === LANDING_DEFAULT.start, 'back to the code window');

  // ---- the page route (no build in tests: 404 is fine, but never the game's fallback)
  const page = await fetch(`${BASE}/landing`);
  ok(page.status === 200 || page.status === 404, '/landing is a page route');
}

try {
  await run();
} finally {
  await stopServer();
}
finish('landing-server');
