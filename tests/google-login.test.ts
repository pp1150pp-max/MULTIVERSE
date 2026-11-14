// Google login against a real game server started here on a free port with a throwaway database,
// and a fake Google token endpoint (GOOGLE_TOKEN_URL) — never the real Google, server or server/data.
// New account with a username, logging in again, state reuse, bad nonce / unverified email, linking to
// a password account (password still works), unlinking, guest -> Google account, bans, the off switch.
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
const dir = mkdtempSync(join(tmpdir(), 'multiverse-google-'));
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
let lastForm: URLSearchParams | null = null;
const fake = createHttp((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    lastForm = new URLSearchParams(body);
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

async function api(method: string, path: string, body?: unknown, token?: string, origin = BASE, cookie = '') {
  const r = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json', Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: (await r.json().catch(() => ({}))) as any, setCookie: r.headers.get('set-cookie') ?? '' };
}

/** The browser-binding cookie from a /start answer, as a Cookie header ('' when none). */
const cookieOf = (setCookie: string) => setCookie.split(';')[0] ?? '';

/** Finishing a ticket from the browser that started (with its cookie). */
let lastCookie = '';
const finishT = (ticket: string, username?: string, cookie = lastCookie) =>
  api('POST', '/auth/google/finish', username === undefined ? { ticket } : { ticket, username }, undefined, BASE, cookie);

/** One trip through Google: start, "Google" answers with `claims` (nonce/aud/iss filled in unless given), callback, finish. */
async function google(mode: string, claims: Record<string, unknown> | null, opts: { token?: string; guestToken?: string; nonce?: string; cookie?: string } = {}) {
  const s = await api('POST', '/auth/google/start', { mode, guestToken: opts.guestToken }, opts.token);
  if (s.status !== 200) return { start: s, result: null as any, state: '' };
  lastCookie = cookieOf(s.setCookie);
  const cookie = opts.cookie ?? lastCookie;
  const u = new URL(s.data.url);
  const state = u.searchParams.get('state')!;
  next = claims && {
    iss: 'https://accounts.google.com', aud: CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 3600, email_verified: true,
    nonce: opts.nonce ?? u.searchParams.get('nonce'), ...claims,
  };
  const cb = await fetch(`${BASE}/api/auth/google/callback?state=${state}&code=abc`, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} });
  const loc = cb.headers.get('location') ?? '';
  const ticket = loc.startsWith('/#google=') ? loc.slice('/#google='.length) : '';
  const f = await finishT(ticket, undefined, cookie);
  return { start: s, result: f.data, ticket, state, url: u, location: loc, cookie };
}

try {
  for (let i = 0; i < 100; i++) {
    if ((await fetch(`${BASE}/api/auth/google/config`).catch(() => null))?.ok) break;
    await sleep(100);
  }

  const cfg = await api('GET', '/auth/google/config');
  ok(cfg.data.enabled === true, 'Google login is on when the client file exists');

  // ---- the address Google is sent to
  const first = await google('login', { sub: 'g-alice', email: 'alice@example.com', name: 'Alice' });
  const u = first.url!;
  ok(u.searchParams.get('client_id') === CLIENT_ID && u.searchParams.get('code_challenge_method') === 'S256'
    && u.searchParams.get('redirect_uri') === `${BASE}/api/auth/google/callback` && u.searchParams.get('scope') === 'openid email profile',
  'start: client id, PKCE S256, registered redirect URI, email/profile scope');
  const form = lastForm as URLSearchParams | null;
  ok(form?.get('code_verifier')?.length === 43 && form?.get('client_secret') === 'shh', 'the server trades the code with the PKCE verifier and the secret');
  ok(first.location!.startsWith('/#google='), 'callback sends the browser back with a ticket in the fragment (no login token)');

  // ---- new account
  ok(first.result.kind === 'needName' && first.result.email === 'alice@example.com' && first.result.guest === false, 'a new Google account asks for a username');
  ok(/HttpOnly/.test(first.start.setCookie) && /SameSite=Lax/.test(first.start.setCookie) && /Path=\/api\/auth\/google/.test(first.start.setCookie),
    'start sets an HttpOnly SameSite=Lax binding cookie for /api/auth/google');
  const stolen = await finishT(first.ticket!, 'mallory', 'mv_gbind=someone-else');
  ok(stolen.status === 410, 'a ticket can not be finished from another browser (cookie differs)');
  const bad = await finishT(first.ticket!, 'a!');
  ok(bad.status === 400, 'username rules apply');
  const made = await finishT(first.ticket!, 'alice');
  ok(made.status === 201 && made.data.kind === 'session' && made.data.username === 'alice' && made.data.token, 'username chosen: account made and logged in');
  const again = await finishT(first.ticket!, 'alice2');
  ok(again.status === 410, 'the ticket works once');
  const me = await api('GET', '/me', undefined, made.data.token);
  ok(me.data.google === 'alice@example.com' && me.data.hasPassword === false, '/me shows the linked email and no password');
  const pwLogin = await api('POST', '/login', { username: 'alice', password: '' });
  ok(pwLogin.status === 401, 'a Google-only account has no password to log in with');

  // ---- logging in again
  const back = await google('login', { sub: 'g-alice', email: 'alice@new.example.com', name: 'Alice' });
  ok(back.result.kind === 'session' && back.result.username === 'alice', 'the same Google account logs into the same game account');
  const me2 = await api('GET', '/me', undefined, back.result.token);
  ok(me2.data.google === 'alice@new.example.com', 'a changed Google email is updated');

  // ---- state, nonce, email checks
  const reuse = await fetch(`${BASE}/api/auth/google/callback?state=${back.state}&code=abc`, { redirect: 'manual', headers: { Cookie: back.cookie! } });
  const reuseTicket = (reuse.headers.get('location') ?? '').slice('/#google='.length);
  const reused = await finishT(reuseTicket);
  ok(reused.data.kind === 'error', 'a used state is refused');
  const forged = await fetch(`${BASE}/api/auth/google/callback?state=made-up&code=abc`, { redirect: 'manual' });
  ok((await finishT((forged.headers.get('location') ?? '').slice(9))).data.kind === 'error', 'an unknown state is refused');
  // Login / link CSRF: someone else's Google link opened in this browser (no cookie, or another one).
  const noCookie = await google('login', { sub: 'g-alice', email: 'alice@example.com' }, { cookie: '' });
  ok(noCookie.result.kind === 'error', 'callback without the binding cookie is refused');
  const wrongCookie = await google('login', { sub: 'g-alice', email: 'alice@example.com' }, { cookie: 'mv_gbind=not-the-one' });
  ok(wrongCookie.result.kind === 'error', 'callback with another browser\'s cookie is refused');
  const nonce = await google('login', { sub: 'g-alice', email: 'alice@example.com' }, { nonce: 'wrong' });
  ok(nonce.result.kind === 'error', 'a wrong nonce is refused');
  const aud = await google('login', { sub: 'g-alice', email: 'alice@example.com', aud: 'someone-else' });
  ok(aud.result.kind === 'error', 'an ID token for another client is refused');
  const unverified = await google('login', { sub: 'g-bob', email: 'bob@example.com', email_verified: false });
  ok(unverified.result.kind === 'error', 'an unverified Google email is refused');
  const googleDown = await google('login', null);
  ok(googleDown.result.kind === 'error', 'Google refusing the code is an error, not a login');
  const otherOrigin = await api('POST', '/auth/google/start', { mode: 'login' }, undefined, 'https://evil.example');
  ok(otherOrigin.status === 400, 'an address not registered with Google can not start');

  // ---- link to a password account
  const reg = await api('POST', '/register', { username: 'carol', password: 'secret123' });
  const linkNoToken = await api('POST', '/auth/google/start', { mode: 'link' });
  ok(linkNoToken.status === 401, 'linking needs a logged-in account');
  const taken = await google('link', { sub: 'g-alice', email: 'alice@example.com' }, { token: reg.data.token });
  ok(taken.result.kind === 'error', 'a Google account already linked elsewhere can not be linked');
  const link = await google('link', { sub: 'g-carol', email: 'carol@example.com', name: 'Carol' }, { token: reg.data.token });
  ok(link.result.kind === 'linked' && link.result.email === 'carol@example.com', 'link: Google added to the account');
  const twice = await api('POST', '/auth/google/start', { mode: 'link' }, reg.data.token);
  ok(twice.status === 409, 'an account links one Google account');
  const viaGoogle = await google('login', { sub: 'g-carol', email: 'carol@example.com' });
  ok(viaGoogle.result.kind === 'session' && viaGoogle.result.username === 'carol', 'the linked account logs in with Google');
  const viaPw = await api('POST', '/login', { username: 'carol', password: 'secret123' });
  ok(viaPw.status === 200, 'and still with its password');
  const unlinkGoogleOnly = await api('POST', '/auth/google/unlink', {}, made.data.token);
  ok(unlinkGoogleOnly.status === 400, 'a Google-only account can not unlink (no other way in)');
  const unlink = await api('POST', '/auth/google/unlink', {}, viaPw.data.token);
  ok(unlink.status === 200 && (await api('GET', '/me', undefined, viaPw.data.token)).data.google === null, 'a password account unlinks Google');
  const afterUnlink = await google('login', { sub: 'g-carol', email: 'carol@example.com' });
  ok(afterUnlink.result.kind === 'needName', 'after unlinking, that Google account is a stranger again');

  // ---- guest -> Google account
  const guest = await api('POST', '/guest', { name: 'Wanderer', classId: 'sword' });
  const upTaken = await google('upgrade', { sub: 'g-alice', email: 'alice@example.com' }, { guestToken: guest.data.token });
  ok(upTaken.result.kind === 'error' && String(upTaken.result.message).includes('alice'), 'upgrade with a Google account already in use is refused (names the account)');
  const up = await google('upgrade', { sub: 'g-dave', email: 'dave@example.com' }, { guestToken: guest.data.token });
  ok(up.result.kind === 'needName' && up.result.guest === true, 'upgrade asks for a username and says the guest moves');
  const nameTaken = await finishT(up.ticket!, 'carol');
  ok(nameTaken.status === 409, 'a taken username is refused and the ticket can try again');
  const upDone = await finishT(up.ticket!, 'dave');
  ok(upDone.status === 201 && upDone.data.username === 'dave', 'the guest became the Google account');
  const chars = await api('GET', '/characters', undefined, upDone.data.token);
  ok(Array.isArray(chars.data) && chars.data.some((c: any) => c.name === 'Wanderer'), 'the guest character came along');
  ok((await api('GET', '/me', undefined, guest.data.token)).status === 401, 'the old guest token no longer works');
  const upNoGuest = await api('POST', '/auth/google/start', { mode: 'upgrade' });
  ok(upNoGuest.status === 400, 'upgrade needs a guest');

  // ---- bans (set straight in the DB) and the admin card (an owner account)
  const sql = new DatabaseSync(DB_FILE);
  sql.prepare('UPDATE accounts SET ban_until = ?, ban_reason = ? WHERE username = ?').run(Date.now() + 3_600_000, 'ทดสอบ', 'alice');
  sql.prepare("UPDATE accounts SET admin_role = 'owner' WHERE username = 'carol'").run();
  const banned = await google('login', { sub: 'g-alice', email: 'alice@example.com' });
  ok(banned.result.kind === 'error' && String(banned.result.message).includes('ระงับ'), 'a banned account can not log in with Google');

  const owner = viaPw.data.token;
  const noRights = await api('GET', '/admin/google', undefined, upDone.data.token);
  ok(noRights.status === 401 || noRights.status === 403, 'the admin card needs the googleLogin tool');
  const card = await api('GET', '/admin/google', undefined, owner);
  ok(card.status === 200 && card.data.on === true && card.data.configured === true && card.data.links.length === 2, 'admin card: on, configured, 2 linked accounts');
  ok(card.data.links.some((l: any) => l.username === 'dave' && l.email === 'dave@example.com' && l.hasPassword === false), 'admin card lists who is linked to which email');
  const accounts = await api('GET', '/admin/accounts', undefined, owner);
  ok(accounts.data.rows.find((r: any) => r.username === 'dave')?.google === 'dave@example.com', 'the accounts table shows the linked email');
  const off = await api('POST', '/admin/google', { on: false }, owner);
  ok(off.data.on === false, 'admin switches Google login off');
  ok((await api('GET', '/auth/google/config')).data.enabled === false, 'switched off: the Login page hides the button');
  ok((await api('POST', '/auth/google/start', { mode: 'login' })).status === 403, 'switched off: no new flows');
  await api('POST', '/admin/google', { on: true }, owner);
  const daveId = card.data.links.find((l: any) => l.username === 'dave').accountId;
  const unl = await api('POST', '/admin/google', { unlink: daveId }, owner);
  ok(unl.status === 200 && unl.data.links.length === 1, 'admin unlinks an account');
  const audit = sql.prepare("SELECT action, details FROM admin_audit WHERE action LIKE 'google%' ORDER BY id").all() as { action: string; details: string }[];
  ok(audit.map((r) => r.action).join(',') === 'google-login,google-login,google-unlink' && audit[2]!.details.includes('dave@example.com'), 'switch and unlink go into the audit log');
  sql.close();
} catch (e) {
  ok(false, `unexpected error: ${(e as Error).stack}`);
} finally {
  await stopAll();
}
finish('google-login');
