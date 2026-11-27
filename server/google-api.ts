// The /api/auth/google/* routes (the flow itself is in server/google.ts).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { log, requireFeature } from './admin';
import { AttemptLimiter } from './auth';
import { clientIp } from './clientIp';
import type { Db, SessionAccount } from './db';
import { bearer, HttpError, readJson, send, str } from './http';
import {
  bindCookie, CALLBACK_PATH, exchangeCode, GoogleFlows, GoogleTickets, googleConfigPaths, isGoogleMode, loadGoogleConfig, newBind, pickRedirectUri,
  requestBind, type GoogleResult,
} from './google';
import type { AdminGoogle } from '../src/shared/admin';
import type { GameWorld } from './world';
import {
  banMessage, checkUsername, GOOGLE_LOGIN_SETTING,
  type AuthResponse, type GoogleConfigResponse, type GoogleFinishResponse, type GoogleStartResponse,
} from '../src/shared/api';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export interface GoogleApiDeps {
  db: Db;
  world: GameWorld;
  /** `google` = the token comes from a Google login (a fresh one may reset the password: server/account-api.ts). */
  startSession(accountId: number, username: string, google?: boolean): AuthResponse;
}

const flows = new GoogleFlows();
const tickets = new GoogleTickets();
/** Starts per address (each one is a trip to Google): plenty for people, a brake on scripts. */
const startLimiter = new AttemptLimiter(30, 10 * 60 * 1000);
/** Usernames tried for a new Google account, per address. */
const nameLimiter = new AttemptLimiter(20, 10 * 60 * 1000);

/** On unless the owner switched it off on the admin page (and the client JSON is in place). */
export function googleLoginOn(db: Db): boolean {
  return db.getSetting(GOOGLE_LOGIN_SETTING) !== '0';
}

/** Handles the request if it is one of ours; false otherwise. */
export async function googleApi(req: IncomingMessage, res: ServerResponse, path: string, d: GoogleApiDeps): Promise<boolean> {
  if (!path.startsWith('/api/auth/google/')) return false;
  const method = req.method ?? 'GET';
  const { db, world } = d;

  if (method === 'GET' && path === '/api/auth/google/config') {
    send(res, 200, { enabled: googleLoginOn(db) && !!loadGoogleConfig(ROOT) } satisfies GoogleConfigResponse);
    return true;
  }

  if (method === 'POST' && path === '/api/auth/google/start') {
    const ip = clientIp(req);
    if (startLimiter.blocked(ip)) throw new HttpError(429, 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่');
    startLimiter.fail(ip);
    const cfg = loadGoogleConfig(ROOT);
    if (!cfg || !googleLoginOn(db)) throw new HttpError(403, 'ตอนนี้ปิดการเข้าสู่ระบบด้วย Google อยู่');
    const body = await readJson(req);
    if (!isGoogleMode(body.mode)) throw new HttpError(400, 'รูปแบบข้อมูลไม่ถูกต้อง');
    const proto = String(req.headers['x-forwarded-proto'] ?? 'http').split(',')[0]!.trim();
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    const redirectUri = pickRedirectUri(cfg, origin, req.headers.host, proto);
    if (!redirectUri) {
      console.error(`[google] no redirect URI in ${cfg.file} for ${origin ?? req.headers.host} (add <origin>${CALLBACK_PATH} in Google Cloud Console and the JSON)`);
      throw new HttpError(400, 'เว็บนี้ยังไม่ได้ลงทะเบียนกับ Google (แจ้งผู้ดูแล)');
    }
    let accountId: number | null = null;
    let guestId: number | null = null;
    if (body.mode === 'link') {
      const acc = sessionOf(db, bearer(req));
      if (!acc) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่');
      if (acc.guest) throw new HttpError(403, 'Guest ผูก Google ไม่ได้ — ใช้ "บันทึกตัวละครด้วย Google" แทน');
      if (db.googleOf(acc.id)) throw new HttpError(409, 'บัญชีนี้ผูก Google ไว้แล้ว');
      accountId = acc.id;
    } else {
      const guestToken = str(body.guestToken);
      const guest = guestToken ? sessionOf(db, guestToken) : undefined;
      if (guest?.guest) guestId = guest.id;
      if (body.mode === 'upgrade' && guestId === null) throw new HttpError(400, 'ไม่พบตัวละคร Guest ในเครื่องนี้');
    }
    const bind = newBind();
    res.setHeader('Set-Cookie', bindCookie(bind.value, redirectUri.startsWith('https:')));
    send(res, 200, { url: flows.begin(cfg, redirectUri, body.mode, accountId, guestId, bind.hash) } satisfies GoogleStartResponse);
    return true;
  }

  if (method === 'GET' && path === CALLBACK_PATH) {
    const q = new URL(req.url ?? '/', 'http://localhost').searchParams;
    const result = await callback(d, q.get('state') ?? '', q.get('code') ?? '', q.get('error'), requestBind(req.headers.cookie));
    // Relative: back to the address the browser came from (the dev page or the real site).
    res.writeHead(302, { Location: `/#google=${result}`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    res.end();
    return true;
  }

  if (method === 'POST' && path === '/api/auth/google/finish') {
    const body = await readJson(req);
    const ticket = str(body.ticket);
    const t = ticket ? tickets.read(ticket, requestBind(req.headers.cookie)) : null;
    if (!t) throw new HttpError(410, 'หมดเวลา กดเข้าสู่ระบบด้วย Google ใหม่อีกครั้ง');
    if (t.result.kind !== 'needName' || body.username === undefined) {
      send(res, 200, t.result satisfies GoogleFinishResponse);
      return true;
    }
    const ip = clientIp(req);
    if (nameLimiter.blocked(ip)) throw new HttpError(429, 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่');
    const username = str(body.username).trim();
    const bad = checkUsername(username);
    if (bad) throw new HttpError(400, bad);
    const id = t.id!;
    // Upgrade always takes the guest; a login only when the player chose "ใช้ Guest ที่อยู่" (owner 2026-11-27:
    // asked first, "สร้างบัญชีเปล่า" leaves the guest on this browser as it is). The guest id is the flow's, never the page's.
    const takeGuest = t.result.mode === 'upgrade' || body.useGuest === true;
    // The guest may be gone by now (deleted, or became an account elsewhere): then a fresh account.
    const guestId = takeGuest && t.guestId !== null && db.isGuestAccount(t.guestId) ? t.guestId : null;
    if (t.result.mode === 'upgrade' && guestId === null) {
      tickets.drop(ticket);
      throw new HttpError(410, 'ไม่พบตัวละคร Guest แล้ว — ลองใหม่อีกครั้ง');
    }
    const linked = db.accountByGoogle(id.sub);
    if (linked) {
      tickets.drop(ticket);
      throw new HttpError(409, 'บัญชี Google นี้ผูกกับบัญชีอื่นไปแล้ว — กดเข้าสู่ระบบด้วย Google ใหม่');
    }
    if (guestId !== null) world.kickAccount(guestId, 'ตัวละคร Guest ย้ายเข้าบัญชีใหม่แล้ว — เข้าสู่ระบบเพื่อเล่นต่อ');
    const accountId = db.createGoogleAccount(username, id, guestId);
    if (accountId === null) {
      nameLimiter.fail(ip);
      throw new HttpError(409, 'ชื่อผู้ใช้นี้มีคนใช้แล้ว');
    }
    tickets.drop(ticket);
    console.log(`[account] registered ${username} with Google${guestId !== null ? ` (from guest #${guestId})` : ''}`);
    db.audit(null, 'ผู้เล่น', guestId !== null ? 'guest-upgrade' : 'google-register', `${username} (#${accountId})`,
      guestId !== null ? `สมัครด้วย Google ${id.email} พร้อมตัวละคร Guest` : `สมัครด้วย Google ${id.email} (บัญชีเปล่า)`);
    send(res, 201, { kind: 'session', ...d.startSession(accountId, username, true) } satisfies GoogleFinishResponse);
    return true;
  }

  if (method === 'POST' && path === '/api/auth/google/unlink') {
    const acc = sessionOf(db, bearer(req));
    if (!acc || acc.guest) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่');
    // Without a password the account could never be entered again.
    if (!db.hasPassword(acc.id)) throw new HttpError(400, 'บัญชีนี้เข้าได้ด้วย Google อย่างเดียว ยกเลิกการผูกไม่ได้');
    const g = db.googleOf(acc.id);
    if (!g || !db.unlinkGoogle(acc.id)) throw new HttpError(404, 'บัญชีนี้ยังไม่ได้ผูก Google');
    db.audit(null, 'ผู้เล่น', 'google-unlink', `${acc.username} (#${acc.id})`, `ผู้เล่นยกเลิกการผูก Google ${g.email} เอง`);
    console.log(`[account] ${acc.username} unlinked Google`);
    send(res, 200, {});
    return true;
  }

  return false;
}

function sessionOf(db: Db, token: string): SessionAccount | undefined {
  return token ? db.sessionAccount(token) : undefined;
}

/** Runs the callback and returns the ticket for the page (every outcome, errors too, is a ticket). */
async function callback(d: GoogleApiDeps, state: string, code: string, error: string | null, bind: string): Promise<string> {
  const { db } = d;
  const fail = (message: string) => tickets.add({ kind: 'error', message }, '');
  const p = state ? flows.take(state) : null;
  if (!p) return fail('หมดเวลา หรือลิงก์นี้ถูกใช้ไปแล้ว — กดเข้าสู่ระบบด้วย Google ใหม่อีกครั้ง');
  // Only the browser that pressed the button may come back with it (someone else's Google link refused).
  if (!bind || bind !== p.bind) return fail('ลิงก์นี้ไม่ได้เริ่มจากเบราว์เซอร์นี้ — กดเข้าสู่ระบบด้วย Google จากหน้าเกมอีกครั้ง');
  if (error) return fail(error === 'access_denied' ? 'ยกเลิกการเข้าสู่ระบบด้วย Google แล้ว' : 'Google ไม่ยืนยันการเข้าสู่ระบบ ลองใหม่อีกครั้ง');
  const cfg = loadGoogleConfig(ROOT);
  if (!cfg || !googleLoginOn(db)) return fail('ตอนนี้ปิดการเข้าสู่ระบบด้วย Google อยู่');
  if (!code) return fail('Google ไม่ยืนยันการเข้าสู่ระบบ ลองใหม่อีกครั้ง');
  let id;
  try {
    id = await exchangeCode(cfg, p, code);
  } catch (e) {
    return fail((e as Error).message);
  }
  const linked = db.accountByGoogle(id.sub);
  let result: GoogleResult;
  if (p.mode === 'link') {
    if (linked) result = { kind: 'error', message: linked.id === p.accountId ? 'บัญชีนี้ผูก Google นี้ไว้แล้ว' : 'บัญชี Google นี้ผูกกับบัญชีเกมอื่นอยู่แล้ว' };
    else if (p.accountId === null || db.googleOf(p.accountId)) result = { kind: 'error', message: 'บัญชีนี้ผูก Google ไว้แล้ว' };
    else if (!db.linkGoogle(p.accountId, id)) result = { kind: 'error', message: 'ผูก Google ไม่สำเร็จ ลองใหม่อีกครั้ง' };
    else {
      console.log(`[account] #${p.accountId} linked Google`);
      result = { kind: 'linked', email: id.email };
    }
  } else if (linked) {
    if (p.mode === 'upgrade') {
      result = { kind: 'error', message: `บัญชี Google นี้ผูกกับบัญชี ${linked.username} อยู่แล้ว — กด "เข้าสู่ระบบด้วย Google" ที่หน้า Login แทน (ตัวละคร Guest ยังอยู่)` };
    } else {
      const ban = db.activeBan(linked.id);
      if (ban) result = { kind: 'error', message: banMessage(ban.until, ban.reason) };
      else {
        db.touchGoogle(id.sub, id.email, id.name);
        result = { kind: 'session', ...d.startSession(linked.id, linked.username, true) };
      }
    }
  } else {
    const guest = p.guestId !== null && db.isGuestAccount(p.guestId);
    // Shown before anything moves (the page asks: take this guest along, or a blank account).
    const c = guest ? db.listCharacters(p.guestId!)[0] : undefined;
    const guestChar = c ? { name: c.name, level: c.level } : null;
    if (p.mode === 'upgrade' && !guest) return fail('ไม่พบตัวละคร Guest แล้ว — ลองใหม่อีกครั้ง');
    return tickets.add({ kind: 'needName', email: id.email, guest, mode: p.mode === 'upgrade' ? 'upgrade' : 'login', guestChar }, p.bind, id, guest ? p.guestId : null);
  }
  return tickets.add(result, p.bind, id);
}

// ------------------------------------------------------------ admin page (Server tab card, feature googleLogin)

function adminState(db: Db): AdminGoogle {
  const cfg = loadGoogleConfig(ROOT);
  return {
    on: googleLoginOn(db),
    configured: !!cfg,
    file: cfg?.file ?? null,
    clientIdTail: cfg ? cfg.clientId.split('.')[0]!.slice(-6) : null,
    redirectUris: cfg?.redirectUris ?? [],
    paths: googleConfigPaths(ROOT),
    links: db.googleLinks().map((l) => ({ ...l, hasPassword: db.hasPassword(l.accountId) })),
  };
}

/** GET / POST /api/admin/google. Handles the request if it is ours; false otherwise. */
export async function googleAdminApi(req: IncomingMessage, res: ServerResponse, path: string, db: Db): Promise<boolean> {
  if (path !== '/api/admin/google') return false;
  const a = requireFeature(req, db, 'googleLogin');
  if (req.method === 'POST') {
    const body = await readJson(req);
    if (typeof body.on === 'boolean') {
      if (body.on !== googleLoginOn(db)) {
        db.setSetting(GOOGLE_LOGIN_SETTING, body.on ? null : '0');
        log(db, a, 'google-login', 'เข้าสู่ระบบด้วย Google', body.on ? 'เปิด' : 'ปิด');
      }
    } else if (typeof body.unlink === 'number') {
      const g = db.googleOf(body.unlink);
      if (!g) throw new HttpError(404, 'บัญชีนี้ไม่ได้ผูก Google');
      const username = db.googleLinks().find((l) => l.accountId === body.unlink)?.username ?? `#${body.unlink}`;
      db.unlinkGoogle(body.unlink);
      const note = db.hasPassword(body.unlink) ? '' : ' (บัญชีนี้ไม่มีรหัสผ่าน: เข้าเกมไม่ได้จนกว่าผู้ดูแลจะรีเซ็ตรหัสผ่านให้ในหน้าบัญชี)';
      log(db, a, 'google-unlink', username, `ยกเลิกการผูก Google ${g.email}${note}`);
    } else {
      throw new HttpError(400, 'รูปแบบข้อมูลไม่ถูกต้อง');
    }
  } else if (req.method !== 'GET') {
    throw new HttpError(405, 'Method not allowed');
  }
  send(res, 200, adminState(db));
  return true;
}
