// The player's own account tools (docs/systems/accounts-and-admin.md, owner 2026-11-27): set or change the
// password, reset it after a fresh Google login ("forgot password"), change the username, and a guest
// choosing a username + password in the game. The switches and numbers are the /admin "บัญชีผู้เล่น" card
// (feature accountAuth), kept in `settings` only where they differ from ACCOUNT_TUNING_DEFAULT.
// Passwords never go into a log or the audit.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { log, requireFeature } from './admin';
import { AttemptLimiter, hashPassword, verifyPassword } from './auth';
import { clientIp } from './clientIp';
import type { Db, SessionAccount } from './db';
import { bearer, HttpError, readJson, send, str } from './http';
import type { GameWorld } from './world';
import {
  ACCOUNT_TUNING_SETTING, accountTuningDiff, checkPassword, checkUsername, cleanAccountTuning,
  type AccountInfoResponse, type AccountTuning, type AuthResponse,
} from '../src/shared/api';

export interface AccountApiDeps {
  db: Db;
  world: GameWorld;
  startSession(accountId: number, username: string): AuthResponse;
  /** Google login switched on and the client file in place. */
  googleOn(): boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Every password request costs a scrypt: a brake per account and (looser, for shared addresses) per address. Wrong old passwords count too. */
const pwLimiter = new AttemptLimiter(10, 10 * 60 * 1000);
const pwIpLimiter = new AttemptLimiter(30, 10 * 60 * 1000);
/** Usernames tried (rename / guest upgrade) that were taken, per address. */
const nameLimiter = new AttemptLimiter(20, 10 * 60 * 1000);

export function accountTuning(db: Db): AccountTuning {
  const raw = db.getSetting(ACCOUNT_TUNING_SETTING);
  try {
    return cleanAccountTuning(raw ? JSON.parse(raw) : {});
  } catch {
    return cleanAccountTuning({});
  }
}

/** The player audit line (no admin did it): who = the account. */
function audit(db: Db, acc: { id: number; username: string }, action: string, details: string): void {
  db.audit(null, 'ผู้เล่น', action, `${acc.username} (#${acc.id})`, details);
}

function session(db: Db, req: IncomingMessage): { acc: SessionAccount; token: string } {
  const token = bearer(req);
  const acc = token ? db.sessionAccount(token) : undefined;
  if (!acc) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่');
  return { acc, token };
}

/** Until when this token may reset the password without the old one (a Google login within recoverMin), or null. */
function recoverUntil(db: Db, token: string, accountId: number, t: AccountTuning): number | null {
  if (!t.recover || !db.googleOf(accountId)) return null;
  const at = db.sessionGoogleAt(token);
  if (at === null) return null;
  const until = at + t.recoverMin * 60_000;
  return until > Date.now() ? until : null;
}

function renameAt(db: Db, accountId: number, t: AccountTuning): number | null {
  const last = db.usernameChangedAt(accountId);
  if (last === null || t.renameDays <= 0) return null;
  const at = last + t.renameDays * DAY_MS;
  return at > Date.now() ? at : null;
}

function info(d: AccountApiDeps, acc: SessionAccount, token: string): AccountInfoResponse {
  const t = accountTuning(d.db);
  return {
    username: acc.username, hasPassword: d.db.hasPassword(acc.id), google: d.db.googleOf(acc.id)?.email ?? null, googleOn: d.googleOn(),
    recoverUntil: recoverUntil(d.db, token, acc.id, t), renameAt: renameAt(d.db, acc.id, t), tools: t,
  };
}

const DATE = (ms: number) => new Date(ms).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });

/** Handles /api/account/* (and /api/account); false when the path isn't ours. */
export async function accountApi(req: IncomingMessage, res: ServerResponse, path: string, d: AccountApiDeps): Promise<boolean> {
  if (path !== '/api/account' && !path.startsWith('/api/account/')) return false;
  const method = req.method ?? 'GET';
  const { db, world } = d;

  if (method === 'GET' && path === '/api/account') {
    const { acc, token } = session(db, req);
    if (acc.guest) throw new HttpError(403, 'Guest ยังไม่มีบัญชี — กด "บันทึกตัวละคร" ก่อน');
    send(res, 200, info(d, acc, token));
    return true;
  }

  if (method === 'POST' && path === '/api/account/password') {
    const { acc, token } = session(db, req);
    if (acc.guest) throw new HttpError(403, 'Guest ยังไม่มีบัญชี — กด "บันทึกตัวละคร" ก่อน');
    const ip = clientIp(req);
    const key = `a${acc.id}`;
    if (pwIpLimiter.blocked(ip) || pwLimiter.blocked(key)) throw new HttpError(429, 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่');
    pwIpLimiter.fail(ip);
    pwLimiter.fail(key);
    const body = await readJson(req);
    const password = str(body.password);
    const bad = checkPassword(password);
    if (bad) throw new HttpError(400, bad);
    const t = accountTuning(db);
    const stored = db.passHash(acc.id);
    if (stored === undefined) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่');
    const had = stored.startsWith('scrypt$');
    let how: 'set' | 'change' | 'recover';
    if (!had) {
      if (!t.setPassword) throw new HttpError(403, 'ตอนนี้ปิดการตั้งรหัสผ่านอยู่');
      how = 'set';
    } else if (body.oldPassword === undefined || body.oldPassword === '') {
      // No old password: only a fresh Google login of an account linked to Google (forgot password).
      if (recoverUntil(db, token, acc.id, t) === null) {
        throw new HttpError(403, t.recover && db.googleOf(acc.id)
          ? `ใส่รหัสผ่านเดิม หรือเข้าสู่ระบบด้วย Google ใหม่แล้วตั้งรหัสภายใน ${t.recoverMin} นาที`
          : 'ใส่รหัสผ่านเดิมด้วย');
      }
      how = 'recover';
    } else {
      if (!t.changePassword) throw new HttpError(403, 'ตอนนี้ปิดการเปลี่ยนรหัสผ่านอยู่');
      if (!(await verifyPassword(str(body.oldPassword), stored))) throw new HttpError(403, 'รหัสผ่านเดิมไม่ถูกต้อง');
      how = 'change';
    }
    const hash = await hashPassword(password);
    if (!db.replacePassword(acc.id, hash, how === 'set' ? 'none' : stored, token)) throw new HttpError(409, 'รหัสผ่านถูกเปลี่ยนไปแล้ว ลองใหม่อีกครั้ง');
    pwLimiter.clear(key);
    const what = { set: 'ตั้งรหัสผ่าน (บัญชี Google)', change: 'เปลี่ยนรหัสผ่าน', recover: 'ตั้งรหัสผ่านใหม่ด้วย Google (ลืมรหัสผ่าน)' }[how];
    audit(db, acc, `account-password-${how}`, `${what} · เครื่องอื่นต้องเข้าสู่ระบบใหม่`);
    console.log(`[account] ${acc.username} ${how === 'set' ? 'set a password' : how === 'change' ? 'changed the password' : 'reset the password after a Google login'}`);
    send(res, 200, info(d, acc, token));
    return true;
  }

  if (method === 'POST' && path === '/api/account/username') {
    const { acc, token } = session(db, req);
    if (acc.guest) throw new HttpError(403, 'Guest ยังไม่มีบัญชี — กด "บันทึกตัวละคร" ก่อน');
    const t = accountTuning(db);
    if (!t.rename) throw new HttpError(403, 'ตอนนี้ปิดการเปลี่ยนชื่อผู้ใช้อยู่');
    const ip = clientIp(req);
    if (nameLimiter.blocked(ip)) throw new HttpError(429, 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่');
    const body = await readJson(req);
    const username = str(body.username).trim();
    const bad = checkUsername(username);
    if (bad) throw new HttpError(400, bad);
    if (username === acc.username) throw new HttpError(400, 'ชื่อนี้คือชื่อที่ใช้อยู่แล้ว');
    const wait = renameAt(db, acc.id, t);
    if (wait !== null) throw new HttpError(403, `เปลี่ยนชื่อผู้ใช้ได้ ${t.renameDays} วันครั้ง — เปลี่ยนได้อีกครั้ง ${DATE(wait)}`);
    const r = db.renameAccount(acc.id, username);
    if (r === 'taken') {
      nameLimiter.fail(ip);
      throw new HttpError(409, 'ชื่อผู้ใช้นี้มีคนใช้แล้ว');
    }
    if (r === 'gone') throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่');
    world.renameAccount(acc.id, username);
    audit(db, { id: acc.id, username }, 'account-rename', `${acc.username} → ${username}`);
    console.log(`[account] #${acc.id} renamed ${acc.username} -> ${username}`);
    send(res, 200, info(d, { ...acc, username }, token));
    return true;
  }

  // A guest saves its character from the game: same account id (the character, quests, album stay), new
  // username and password. Its game connection is not ended here: the page reconnects with the new token
  // (same map, channel and spot) and plays on as the account.
  if (method === 'POST' && path === '/api/account/guest-upgrade') {
    const { acc } = session(db, req);
    if (!acc.guest) throw new HttpError(400, 'บัญชีนี้ไม่ใช่ Guest');
    if (!accountTuning(db).guestUpgrade) throw new HttpError(403, 'ตอนนี้ปิดการบันทึกตัวละครในเกมอยู่ — ออกไปหน้าแรกแล้วสมัครสมาชิกแทน');
    const ip = clientIp(req);
    if (nameLimiter.blocked(ip)) throw new HttpError(429, 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่');
    const body = await readJson(req);
    const username = str(body.username).trim();
    const password = str(body.password);
    const bad = checkUsername(username) ?? checkPassword(password);
    if (bad) throw new HttpError(400, bad);
    const hash = await hashPassword(password);
    if (!db.upgradeGuest(acc.id, username, hash)) {
      if (!db.isGuestAccount(acc.id)) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่');
      nameLimiter.fail(ip);
      throw new HttpError(409, 'ชื่อผู้ใช้นี้มีคนใช้แล้ว');
    }
    world.renameAccount(acc.id, username);
    audit(db, { id: acc.id, username }, 'guest-upgrade', 'Guest ตั้งชื่อผู้ใช้/รหัสผ่านในเกม (ตัวละครอยู่ในบัญชีนี้แล้ว)');
    console.log(`[account] guest #${acc.id} became ${username} in the game`);
    send(res, 201, d.startSession(acc.id, username));
    return true;
  }

  throw new HttpError(404, 'ไม่พบ API นี้');
}

// ------------------------------------------------------------ admin page (Server tab card, feature accountAuth)

/** GET / POST /api/admin/account-auth: the switches and numbers, and the defaults to compare. */
export async function accountAdminApi(req: IncomingMessage, res: ServerResponse, path: string, db: Db): Promise<boolean> {
  if (path !== '/api/admin/account-auth') return false;
  const a = requireFeature(req, db, 'accountAuth');
  if (req.method === 'POST') {
    const body = await readJson(req);
    const before = accountTuning(db);
    const next = cleanAccountTuning({ ...before, ...(body.tuning && typeof body.tuning === 'object' ? body.tuning : {}) });
    const diff = accountTuningDiff(next);
    db.setSetting(ACCOUNT_TUNING_SETTING, Object.keys(diff).length ? JSON.stringify(diff) : null);
    const changed = (Object.keys(next) as (keyof AccountTuning)[]).filter((k) => next[k] !== before[k]).map((k) => `${k}: ${before[k]} → ${next[k]}`);
    if (changed.length) log(db, a, 'account-auth', 'บัญชีผู้เล่น', changed.join(' · '));
  } else if (req.method !== 'GET') {
    throw new HttpError(405, 'Method not allowed');
  }
  send(res, 200, { tuning: accountTuning(db), defaults: cleanAccountTuning({}) });
  return true;
}
