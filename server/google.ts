// Logging in with Google (OAuth 2.0 authorization code flow with PKCE, done by this server).
//
// The browser asks POST /api/auth/google/start for a Google address (the server remembers a random
// `state`, a PKCE verifier and a nonce for it), goes there, and Google sends it back to
// GET /api/auth/google/callback. The server trades the code for an ID token straight with Google
// (over HTTPS, with the client secret and the verifier), checks it, and sends the browser to
// /#google=<ticket>. The page then posts the ticket to /api/auth/google/finish to get the result:
// a login token, "choose a username" (a new account), or "linked". Nothing in the URL is a login token.
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The client JSON downloaded from Google Cloud Console ("web" client). */
export interface GoogleConfig { clientId: string; clientSecret: string; redirectUris: string[]; file: string }

/**
 * Where the client JSON is looked for, first found wins: GOOGLE_OAUTH_FILE, then
 * server/data/google-oauth.json, then ~/secrets/google-oauth.json (Windows and Linux alike), then the
 * file as Google names it on download (~/secrets/client_secret_….json) when there is just one.
 */
export function googleConfigPaths(root: string): string[] {
  const env = process.env.GOOGLE_OAUTH_FILE;
  const secrets = join(homedir(), 'secrets');
  let downloaded: string[] = [];
  try {
    downloaded = readdirSync(secrets).filter((f) => /^client_secret_.*\.json$/.test(f));
  } catch {
    // No ~/secrets folder.
  }
  return [
    ...(env ? [env] : []), join(root, 'server', 'data', 'google-oauth.json'), join(secrets, 'google-oauth.json'),
    ...(downloaded.length === 1 ? [join(secrets, downloaded[0]!)] : []),
  ];
}

/** Read again on every use (a small file), so dropping it in place needs no restart. null = not set up. */
export function loadGoogleConfig(root: string): GoogleConfig | null {
  for (const file of googleConfigPaths(root)) {
    if (!existsSync(file)) continue;
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
      const c = (raw.web ?? raw) as Record<string, unknown>;
      const clientId = typeof c.client_id === 'string' ? c.client_id : '';
      const clientSecret = typeof c.client_secret === 'string' ? c.client_secret : '';
      const redirectUris = Array.isArray(c.redirect_uris) ? c.redirect_uris.filter((u): u is string => typeof u === 'string') : [];
      if (clientId && clientSecret && redirectUris.length) return { clientId, clientSecret, redirectUris, file };
      console.error(`[google] ${file}: missing client_id / client_secret / redirect_uris`);
    } catch (e) {
      console.error(`[google] can't read ${file}:`, (e as Error).message);
    }
    return null;
  }
  return null;
}

export const CALLBACK_PATH = '/api/auth/google/callback';

/**
 * The registered redirect URI for the address the browser used (its Origin, or the Host the
 * request came in on). Only URIs listed in the client JSON are ever used.
 */
export function pickRedirectUri(cfg: GoogleConfig, origin: string | undefined, host: string | undefined, proto: string): string | null {
  const want = origin ?? (host ? `${proto}://${host}` : undefined);
  const ours = cfg.redirectUris.filter((u) => u.endsWith(CALLBACK_PATH));
  if (want) {
    const hit = ours.find((u) => u === want + CALLBACK_PATH);
    if (hit) return hit;
  }
  return null;
}

const AUTH_URL = () => process.env.GOOGLE_AUTH_URL ?? 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = () => process.env.GOOGLE_TOKEN_URL ?? 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export type GoogleMode = 'login' | 'link' | 'upgrade';
export const isGoogleMode = (v: unknown): v is GoogleMode => v === 'login' || v === 'link' || v === 'upgrade';

/** What /start remembers until Google sends the browser back (GOOGLE_STATE_MS). */
interface Pending {
  verifier: string; nonce: string; redirectUri: string; mode: GoogleMode;
  /** Hash of the cookie (BIND_COOKIE) set on the browser that started: only that browser may finish. */
  bind: string;
  /** link: the account to link; upgrade / login: the browser's guest (moved into a new account). */
  accountId: number | null; guestId: number | null; expires: number;
}

/** A checked Google identity. */
export interface GoogleId { sub: string; email: string; name: string }

export const GOOGLE_STATE_MS = 10 * 60 * 1000;
const MAX_PENDING = 2000;

const b64url = (b: Buffer) => b.toString('base64url');

/**
 * The cookie that ties a flow to the browser that started it (against login / link CSRF: someone
 * else's Google round trip or ticket link can't be finished in your browser). HttpOnly, Lax (sent on
 * Google's redirect back), only under /api/auth/google, 10 minutes.
 */
export const BIND_COOKIE = 'mv_gbind';

export function newBind(): { value: string; hash: string } {
  const value = b64url(randomBytes(24));
  return { value, hash: bindHash(value) };
}

export const bindHash = (value: string): string => createHash('sha256').update(value).digest('base64url');

export function bindCookie(value: string, secure: boolean): string {
  return `${BIND_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=${GOOGLE_STATE_MS / 1000}${secure ? '; Secure' : ''}`;
}

/** The binding cookie's hash from a request, or '' without one. */
export function requestBind(cookieHeader: string | undefined): string {
  for (const part of (cookieHeader ?? '').split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === BIND_COOKIE && v) return bindHash(v);
  }
  return '';
}

export class GoogleFlows {
  private readonly pending = new Map<string, Pending>();

  /** Starts a flow: the address to send the browser to. */
  begin(cfg: GoogleConfig, redirectUri: string, mode: GoogleMode, accountId: number | null, guestId: number | null, bind: string): string {
    this.prune();
    const state = b64url(randomBytes(24));
    const verifier = b64url(randomBytes(32));
    const nonce = b64url(randomBytes(16));
    this.pending.set(state, { verifier, nonce, redirectUri, mode, accountId, guestId, bind, expires: Date.now() + GOOGLE_STATE_MS });
    const q = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: b64url(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return `${AUTH_URL()}?${q}`;
  }

  /** Takes the flow for a `state` back (once: a second use finds nothing). */
  take(state: string): Pending | null {
    const p = this.pending.get(state);
    this.pending.delete(state);
    return p && p.expires > Date.now() ? p : null;
  }

  private prune(): void {
    const now = Date.now();
    for (const [k, p] of this.pending) if (p.expires <= now) this.pending.delete(k);
    // Never grows without bound (someone clicking start over and over): the oldest go first.
    while (this.pending.size >= MAX_PENDING) this.pending.delete(this.pending.keys().next().value!);
  }
}

/** Trades the code for tokens with Google and checks the ID token. Throws a Thai message on failure. */
export async function exchangeCode(cfg: GoogleConfig, p: Pending, code: string): Promise<GoogleId> {
  let res: Response;
  try {
    res = await fetch(TOKEN_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: p.redirectUri,
        grant_type: 'authorization_code', code_verifier: p.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('ติดต่อ Google ไม่ได้ ลองใหม่อีกครั้ง');
  }
  const data = (await res.json().catch(() => ({}))) as { id_token?: unknown; error?: unknown };
  if (!res.ok || typeof data.id_token !== 'string') {
    console.error(`[google] token exchange failed (${res.status}): ${String(data.error ?? '')}`);
    throw new Error('Google ไม่ยืนยันการเข้าสู่ระบบ ลองใหม่อีกครั้ง');
  }
  // Straight from Google's token endpoint over HTTPS, so the token's signature needs no checking
  // (Google's OpenID guide); its claims still do.
  const claims = decodeJwt(data.id_token);
  const now = Date.now() / 1000;
  if (!claims || !ISSUERS.has(String(claims.iss)) || claims.aud !== cfg.clientId || typeof claims.exp !== 'number' || claims.exp < now - 60
    || claims.nonce !== p.nonce || typeof claims.sub !== 'string' || !claims.sub) {
    throw new Error('ข้อมูลจาก Google ไม่ถูกต้อง ลองใหม่อีกครั้ง');
  }
  if (typeof claims.email !== 'string' || claims.email_verified !== true) throw new Error('บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล');
  const name = typeof claims.name === 'string' ? claims.name.slice(0, 100) : '';
  return { sub: claims.sub.slice(0, 64), email: claims.email.slice(0, 254), name };
}

function decodeJwt(jwt: string): Record<string, unknown> | null {
  const part = jwt.split('.')[1];
  if (!part) return null;
  try {
    const v = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** What a ticket gives the page. `needName`: a new account; the page asks for a username and finishes with it. */
export type GoogleResult =
  | { kind: 'session'; token: string; username: string }
  | { kind: 'needName'; email: string; guest: boolean; mode: 'login' | 'upgrade'; guestChar: { name: string; level: number } | null }
  | { kind: 'linked'; email: string }
  | { kind: 'error'; message: string };

/** Short-lived tickets handed to the browser in the URL fragment. */
export class GoogleTickets {
  private readonly tickets = new Map<string, { result: GoogleResult; id?: GoogleId; guestId: number | null; bind: string; expires: number }>();

  /** `bind`: the starting browser's cookie hash; reading needs the same ('' = an error anyone may read). */
  add(result: GoogleResult, bind: string, id?: GoogleId, guestId: number | null = null): string {
    const now = Date.now();
    for (const [k, t] of this.tickets) if (t.expires <= now) this.tickets.delete(k);
    while (this.tickets.size >= MAX_PENDING) this.tickets.delete(this.tickets.keys().next().value!);
    const t = b64url(randomBytes(24));
    // A username can take a while to choose; everything else is read at once.
    this.tickets.set(t, { result, id, guestId, bind, expires: now + (result.kind === 'needName' ? GOOGLE_STATE_MS : 60_000) });
    return t;
  }

  /** Reads a ticket. Only a needName ticket survives reading (until it is used with a username). */
  read(ticket: string, bind: string): { result: GoogleResult; id?: GoogleId; guestId: number | null } | null {
    const t = this.tickets.get(ticket);
    if (t && t.bind && t.bind !== bind) return null;
    if (!t || t.expires <= Date.now()) {
      this.tickets.delete(ticket);
      return null;
    }
    if (t.result.kind !== 'needName') this.tickets.delete(ticket);
    return t;
  }

  drop(ticket: string): void {
    this.tickets.delete(ticket);
  }
}
