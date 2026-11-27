// The player's account tools (server/account-api.ts) against a real game server on a free port with a
// throwaway database and a fake Google token endpoint — never the real Google, server or server/data.
// Google account sets a password (logs in both ways, unlinks), guest saves itself in the game (same account,
// character kept), "blank account" leaves the guest alone, Google can't link twice, changing the password
// ends the other logins, taken usernames and the rename limit, resetting the password after a Google login,
// the /admin switches and the audit.
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer as createHttp } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { finish, ok } from './check';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'multiverse-account-'));
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
const CLIENT_ID = 'test-client.apps.googleusercontent.com';

// ---- fake Google token endpoint: answers with the claims the test set for the next exchange
let next: Record<string, unknown> | null = null;
const fake = createHttp((req, res) => {
  req.on('data', () => {});
  req.on('end', () => {
    const claims = next;
    next = null;
    if (!claims) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_grant' }));
      return;
    }
    const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id_token: `${part({ alg: 'RS256' })}.${part(claims)}.sig`, access_token: 'x' }));
  });
});
const FAKE_PORT = await freePort();
await new Promise<void>((r) => fake.listen(FAKE_PORT, r));

const cfgFile = join(dir, 'google-oauth.json');
writeFileSync(cfgFile, JSON.stringify({ web: { client_id: CLIENT_ID, client_secret: 'shh', redirect_uris: [`${BASE}/api/auth/google/callback`] } }));

const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server/main.ts'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DB_FILE, GOOGLE_OAUTH_FILE: cfgFile, GOOGLE_TOKEN_URL: `http://localhost:${FAKE_PORT}/token` },
  stdio: ['ignore', 'ignore', 'inherit'],
});

async function stopAll(): Promise<void> {
  if (server.exitCode === null) {
    server.kill();
    await new Promise((r) => server.once('exit', r));
  }
  fake.close();
  rmSync(dir, { recursive: true, force: true });
}

async function api(method: string, path: string, body?: unknown, token?: string, cookie = '') {
  const r = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: BASE, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: (await r.json().catch(() => ({}))) as any, setCookie: r.headers.get('set-cookie') ?? '' };
}

let lastCookie = '';
const finishT = (ticket: string, username?: string, useGuest?: boolean) =>
  api('POST', '/auth/google/finish', { ticket, ...(username === undefined ? {} : { username }), ...(useGuest === undefined ? {} : { useGuest }) }, undefined, lastCookie);

/** One trip through Google: start, "Google" answers with `claims`, callback, finish (read the ticket). */
async function google(mode: string, claims: Record<string, unknown>, opts: { token?: string; guestToken?: string } = {}) {
  const s = await api('POST', '/auth/google/start', { mode, guestToken: opts.guestToken }, opts.token);
  if (s.status !== 200) return { start: s, result: null as any, ticket: '' };
  lastCookie = s.setCookie.split(';')[0] ?? '';
  const u = new URL(s.data.url);
  next = { iss: 'https://accounts.google.com', aud: CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 3600, email_verified: true, nonce: u.searchParams.get('nonce'), ...claims };
  const cb = await fetch(`${BASE}/api/auth/google/callback?state=${u.searchParams.get('state')}&code=abc`, { redirect: 'manual', headers: { Cookie: lastCookie } });
  const loc = cb.headers.get('location') ?? '';
  const ticket = loc.startsWith('/#google=') ? loc.slice('/#google='.length) : '';
  const f = await finishT(ticket);
  return { start: s, result: f.data, ticket };
}

let sql: DatabaseSync = null as unknown as DatabaseSync;
try {
  for (let i = 0; i < 100; i++) {
    if ((await fetch(`${BASE}/api/auth/google/config`).catch(() => null))?.ok) break;
    await sleep(100);
  }
  sql = new DatabaseSync(DB_FILE);
  const login = (username: string, password: string) => api('POST', '/login', { username, password });
  const charData = (name: string) => sql.prepare('SELECT account_id, data FROM characters WHERE name = ?').get(name) as { account_id: number; data: string };

  // ---- 1. a Google account sets a password: logs in both ways, may then unlink Google
  const g1 = await google('login', { sub: 'g-erin', email: 'erin@example.com' });
  const erin = await finishT(g1.ticket, 'erin');
  ok(erin.status === 201, 'Google account made');
  const erinTok = erin.data.token as string;
  const info0 = await api('GET', '/account', undefined, erinTok);
  ok(info0.status === 200 && info0.data.hasPassword === false && info0.data.google === 'erin@example.com', '/account: no password, Google email');
  ok((await api('POST', '/auth/google/unlink', {}, erinTok)).status === 400, 'Google-only: unlink refused before a password exists');
  ok((await api('POST', '/account/password', { password: '123' }, erinTok)).status === 400, 'password rules apply');
  const setPw = await api('POST', '/account/password', { password: 'erinpass1' }, erinTok);
  ok(setPw.status === 200 && setPw.data.hasPassword === true, 'Google account sets a password without an old one');
  ok((await login('erin', 'erinpass1')).status === 200, 'then logs in with username + password');
  const g1b = await google('login', { sub: 'g-erin', email: 'erin@example.com' });
  ok(g1b.result.kind === 'session' && g1b.result.username === 'erin', 'and still with Google');
  ok((await api('POST', '/account/password', { password: 'other1234' }, erinTok)).status === 403,
    'a second "first" password needs the old one (that token\'s Google freshness was used up)');
  ok((await api('POST', '/auth/google/unlink', {}, erinTok)).status === 200, 'with a password, Google can be unlinked');

  // ---- 2. a guest saves itself in the game: same account id, character kept, old token dead
  const guest = await api('POST', '/guest', { name: 'Pilgrim', classId: 'mage' });
  const pilgrim0 = charData('Pilgrim');
  ok((await api('POST', '/account/guest-upgrade', { username: 'erin', password: 'pilgrim1' }, guest.data.token)).status === 409, 'guest upgrade: a taken username is refused');
  const up = await api('POST', '/account/guest-upgrade', { username: 'pilgrim', password: 'pilgrim1' }, guest.data.token);
  ok(up.status === 201 && up.data.username === 'pilgrim' && !!up.data.token, 'guest upgrade: new login token');
  const acc = sql.prepare("SELECT id, is_guest FROM accounts WHERE username = 'pilgrim'").get() as { id: number; is_guest: number };
  ok(acc.id === pilgrim0.account_id && acc.is_guest === 0, 'the same account id, no longer a guest');
  const chars = await api('GET', '/characters', undefined, up.data.token);
  ok(charData('Pilgrim').data === pilgrim0.data && chars.data.length === 1 && chars.data[0].name === 'Pilgrim', 'the character is all there');
  ok((await api('GET', '/me', undefined, guest.data.token)).status === 401, 'the guest token no longer works');
  ok((await login('pilgrim', 'pilgrim1')).status === 200, 'logs in with the chosen password');
  ok((await api('POST', '/account/guest-upgrade', { username: 'pilgrim2', password: 'pilgrim1' }, up.data.token)).status === 400, 'a real account can not "upgrade"');

  // ---- 3. Google login from a browser with a guest: asked first; "blank account" leaves the guest alone
  const g2 = await api('POST', '/guest', { name: 'Stayer', classId: 'sword' });
  const stayer0 = charData('Stayer');
  const q = await google('login', { sub: 'g-fay', email: 'fay@example.com' }, { guestToken: g2.data.token });
  ok(q.result.kind === 'needName' && q.result.mode === 'login' && q.result.guestChar?.name === 'Stayer' && q.result.guestChar?.level === 1,
    'the question shows the guest character and level');
  const blank = await finishT(q.ticket, 'fay', false);
  ok(blank.status === 201, 'blank account made');
  ok((await api('GET', '/characters', undefined, blank.data.token)).data.length === 0, 'the blank account has no characters');
  const stayer1 = charData('Stayer');
  const stayerAcc = sql.prepare('SELECT is_guest FROM accounts WHERE id = ?').get(stayer0.account_id) as { is_guest: number };
  ok(stayerAcc.is_guest === 1 && stayer1.account_id === stayer0.account_id && stayer1.data === stayer0.data, 'the guest and its character are untouched');
  ok((await api('GET', '/me', undefined, g2.data.token)).data.guest === true, 'the guest token still works');
  const q2 = await google('login', { sub: 'g-gil', email: 'gil@example.com' }, { guestToken: g2.data.token });
  const took = await finishT(q2.ticket, 'gil', true);
  ok(took.status === 201 && (await api('GET', '/characters', undefined, took.data.token)).data[0]?.name === 'Stayer', '"use the guest": the character moves');
  const upQ = await api('POST', '/guest', { name: 'Upper', classId: 'gunslinger' });
  const uq = await google('upgrade', { sub: 'g-hal', email: 'hal@example.com' }, { guestToken: upQ.data.token });
  ok(uq.result.kind === 'needName' && uq.result.mode === 'upgrade' && uq.result.guestChar?.name === 'Upper' && uq.result.email === 'hal@example.com',
    'upgrade mode shows the character and the email before anything moves');

  // ---- 4. a Google account can not be linked twice
  const ivy = await api('POST', '/register', { username: 'ivy', password: 'ivypass12' });
  const dup = await google('link', { sub: 'g-fay', email: 'fay@example.com' }, { token: ivy.data.token });
  ok(dup.result?.kind === 'error', 'a Google account already linked elsewhere is refused');

  // ---- 5. changing the password ends every other login
  const ivy2 = await login('ivy', 'ivypass12');
  ok((await api('POST', '/account/password', { password: 'ivynew123', oldPassword: 'nope1234' }, ivy.data.token)).status === 403, 'a wrong old password is refused');
  ok((await api('POST', '/account/password', { password: 'ivynew123' }, ivy.data.token)).status === 403, 'no old password and no fresh Google login: refused');
  ok((await api('POST', '/account/password', { password: 'ivynew123', oldPassword: 'ivypass12' }, ivy.data.token)).status === 200, 'password changed with the old one');
  ok((await api('GET', '/me', undefined, ivy2.data.token)).status === 401, 'the other login token is dead');
  ok((await api('GET', '/me', undefined, ivy.data.token)).status === 200, 'the one that changed it stays logged in');
  ok((await login('ivy', 'ivypass12')).status === 401 && (await login('ivy', 'ivynew123')).status === 200, 'old password out, new one in');

  // ---- 6. username changes: taken (any case), then once per 30 days
  ok((await api('POST', '/account/username', { username: 'ERIN' }, ivy.data.token)).status === 409, 'a taken username (other case) is refused');
  ok((await api('POST', '/account/username', { username: 'x!' }, ivy.data.token)).status === 400, 'username rules apply');
  const ren = await api('POST', '/account/username', { username: 'ivory' }, ivy.data.token);
  ok(ren.status === 200 && ren.data.username === 'ivory' && ren.data.renameAt > Date.now(), 'renamed; the next change waits');
  ok((await login('ivory', 'ivynew123')).status === 200 && (await login('ivy', 'ivynew123')).status === 401, 'logs in with the new name only');
  ok((await api('POST', '/account/username', { username: 'ivy3' }, ivy.data.token)).status === 403, 'a second rename within 30 days is refused');
  ok((await api('POST', '/account/username', { username: 'ivy' }, (await login('erin', 'erinpass1')).data.token)).status === 200, 'the freed old name can be taken');

  // ---- 7. forgot password: a fresh Google login sets a new one without the old
  const jo = await api('POST', '/register', { username: 'joan', password: 'jopass123' });
  await google('link', { sub: 'g-jo', email: 'jo@example.com' }, { token: jo.data.token });
  ok((await api('POST', '/account/password', { password: 'jonew1234' }, jo.data.token)).status === 403, 'a password login can not reset without the old password');
  const viaG = await google('login', { sub: 'g-jo', email: 'jo@example.com' });
  const jInfo = await api('GET', '/account', undefined, viaG.result.token);
  ok(jInfo.data.recoverUntil > Date.now(), '/account says a reset is possible for a while');
  const reset = await api('POST', '/account/password', { password: 'jonew1234' }, viaG.result.token);
  ok(reset.status === 200 && (await login('joan', 'jonew1234')).status === 200, 'reset after a Google login: the new password works');
  ok((await api('GET', '/me', undefined, jo.data.token)).status === 401, 'the old logins ended');
  ok((await api('POST', '/account/password', { password: 'jonew5678' }, viaG.result.token)).status === 403, 'the reset works once per Google login');
  const viaG2 = await google('login', { sub: 'g-jo', email: 'jo@example.com' });
  sql.prepare('UPDATE sessions SET google_at = ? WHERE token = ?').run(Date.now() - 11 * 60_000, viaG2.result.token);
  ok((await api('POST', '/account/password', { password: 'jonew5678' }, viaG2.result.token)).status === 403, 'after 10 minutes the Google login is too old');

  // ---- 8. the /admin card: switches enforced, only differences stored, audit without passwords
  sql.prepare("UPDATE accounts SET admin_role = 'owner' WHERE username = 'joan'").run();
  const owner = (await login('joan', 'jonew1234')).data.token;
  const noRights = await api('GET', '/admin/account-auth', undefined, up.data.token);
  ok(noRights.status === 401 || noRights.status === 403, 'the card needs the accountAuth tool');
  const card = await api('GET', '/admin/account-auth', undefined, owner);
  ok(card.status === 200 && card.data.tuning.renameDays === 30 && card.data.tuning.recoverMin === 10 && card.data.tuning.rename === true, 'defaults: 30 days, 10 minutes, all on');
  const offR = await api('POST', '/admin/account-auth', { tuning: { rename: false, guestUpgrade: false, renameDays: 7 } }, owner);
  ok(offR.data.tuning.rename === false && offR.data.tuning.renameDays === 7, 'owner switches rename off and sets 7 days');
  const row = (sql.prepare("SELECT value FROM settings WHERE key = 'account_tuning'").get() as { value: string }).value;
  ok(JSON.stringify(JSON.parse(row)) === JSON.stringify({ guestUpgrade: false, rename: false, renameDays: 7 }), 'settings keep only what differs from the code');
  ok((await api('POST', '/account/username', { username: 'gil2' }, took.data.token)).status === 403, 'switched off: rename refused');
  const g3 = await api('POST', '/guest', { name: 'Nomad', classId: 'mage' });
  ok((await api('POST', '/account/guest-upgrade', { username: 'nomad', password: 'nomad123' }, g3.data.token)).status === 403, 'switched off: guest upgrade refused');
  await api('POST', '/admin/account-auth', { tuning: { rename: true, guestUpgrade: true, renameDays: 30, recoverMin: 999 } }, owner);
  ok(!sql.prepare("SELECT 1 FROM settings WHERE key = 'account_tuning'").get(), 'back to the defaults (a bad number falls back): no settings row');
  const audit = sql.prepare("SELECT action, details FROM admin_audit WHERE action LIKE 'account-%' OR action LIKE 'guest-%' OR action = 'google-unlink'").all() as { action: string; details: string }[];
  const acts = new Set(audit.map((r) => r.action));
  ok(['account-password-set', 'account-password-change', 'account-password-recover', 'account-rename', 'guest-upgrade', 'google-unlink', 'account-auth'].every((a) => acts.has(a)),
    'every tool goes into the audit');
  ok(!audit.some((r) => /erinpass1|ivynew123|jonew1234|pilgrim1|scrypt/.test(r.details)), 'no password or hash in the audit');
  const accounts = await api('GET', '/admin/accounts', undefined, owner);
  const fayRow = accounts.data.rows.find((r: any) => r.username === 'fay');
  const ivyRow = accounts.data.rows.find((r: any) => r.username === 'ivory');
  ok(fayRow?.password === false && fayRow?.google === 'fay@example.com' && ivyRow?.password === true, 'the accounts table shows how each account logs in');
} catch (e) {
  ok(false, `unexpected error: ${(e as Error).stack}`);
} finally {
  sql?.close();
  await stopAll();
}
finish('account-manage');
