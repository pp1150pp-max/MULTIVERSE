// Owner tools on the admin page: every account, account details, temporary passwords, bans, broadcasts,
// deleting accounts/characters, and database backups. Each tool is allowed by FEATURE_ROLES
// (src/shared/admin.ts), checked here on every call; deleting is always owner only.
import { randomInt } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db';
import type { GameWorld } from './world';
import type { Backups } from './backup';
import { HttpError, readJson, send, str } from './http';
import { charRow, log, requireAdmin, type Admin } from './admin';
import { hashPassword } from './auth';
import {
  ADMIN_NO_RIGHTS, BAN_DURATIONS, BAN_FOREVER, BAN_REASON_MAX, BROADCAST_EVERY_MS, BROADCAST_MAX, canUse, isAdminRole,
  type AdminAccountDetail, type AdminAccountRow, type AdminAccountsResponse, type AdminCharDetail, type AdminFeature,
} from '../src/shared/admin';
import { banMessage } from '../src/shared/api';
import { HISTORY_PAGE, type AdminStats, type StatsPoint, type StatsRange } from '../src/shared/admin';
import { SESSION_PAGE_SIZES, SESSION_SEARCH_MAX, SESSION_SORTS, type SessionPage, type SessionQuery, type SessionSort } from '../src/shared/admin';
import { BAG_SIZE } from '../src/shared/sim/Player';
import type { AdminShutdownText } from '../src/shared/admin';
import { checkShutdownText, DEFAULT_SHUTDOWN_TEXT, type ShutdownMode } from '../src/shared/net/protocol';
import { SHUTDOWN_TEXT_KEY } from './db';
import { checkOrbLook, DEFAULT_ORB_LOOK, orbLookChanges, ORB_LOOK_RANGES, ORB_PALETTE_IDS, ORB_SHAPE_IDS, sameOrbLook } from '../src/shared/orbLook';
import type { AdminOrbLook } from '../src/shared/admin';

const MODE_NAME: Record<ShutdownMode, string> = { restart: 'ข้อความรีสตาร์ท', shutdown: 'ข้อความปิด server' };
const orbLookState = (db: Db, canEdit: boolean): AdminOrbLook => ({
  look: db.orbLook(), defaults: { ...DEFAULT_ORB_LOOK }, canEdit,
  palettes: [...ORB_PALETTE_IDS], shapes: [...ORB_SHAPE_IDS], ranges: ORB_LOOK_RANGES,
});
const shutdownTextState = (db: Db): AdminShutdownText => ({ texts: db.shutdownTexts(), defaults: { ...DEFAULT_SHUTDOWN_TEXT } });

const NO_RIGHTS = ADMIN_NO_RIGHTS;

/** The play-session table's query string, every value checked (400 on anything odd). */
function sessionQuery(p: URLSearchParams): SessionQuery {
  const bad = (what: string): never => {
    throw new HttpError(400, `ค่า ${what} ไม่ถูกต้อง`);
  };
  /** A whole number written plainly (no signs, decimals or exponents), or undefined when absent/empty. */
  const int = (name: string, max: number): number | undefined => {
    const v = p.get(name);
    if (v === null || v === '') return undefined;
    if (!/^\d{1,16}$/.test(v)) return bad(name);
    const n = Number(v);
    return Number.isSafeInteger(n) && n <= max ? n : bad(name);
  };
  const sort = p.get('sort') ?? 'joined';
  if (!(SESSION_SORTS as readonly string[]).includes(sort)) bad('sort');
  const dir = p.get('dir') ?? 'desc';
  if (dir !== 'asc' && dir !== 'desc') bad('dir');
  const page = int('page', 1e7) ?? 1;
  if (page < 1) bad('page');
  const size = int('size', 1000) ?? SESSION_PAGE_SIZES[0];
  if (!(SESSION_PAGE_SIZES as readonly number[]).includes(size)) bad('size');
  const q = (p.get('q') ?? '').trim();
  if (q.length > SESSION_SEARCH_MAX) throw new HttpError(400, `คำค้นหายาวเกิน ${SESSION_SEARCH_MAX} ตัวอักษร`);
  const maxTime = Date.now() + 2 * 864e5;
  const from = int('from', maxTime);
  const to = int('to', maxTime);
  if (from !== undefined && to !== undefined && from >= to) throw new HttpError(400, 'วันที่เริ่มต้องอยู่ก่อนวันที่สิ้นสุด');
  const accountId = int('account', 1e12);
  if (accountId === 0) bad('account');
  return { sort: sort as SessionSort, desc: dir === 'desc', page, size, q, from, to, accountId };
}
/** When each admin last sent an announcement (rate limit). */
const lastBroadcast = new Map<number, number>();
/** Letters that can't be mixed up when read aloud or typed from a phone. */
const TEMP_PW_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const TEMP_PW_LEN = 10;

function requireFeature(req: IncomingMessage, db: Db, f: AdminFeature): Admin {
  const a = requireAdmin(req, db);
  if (!canUse(a.role, f)) throw new HttpError(403, NO_RIGHTS);
  return a;
}

/** Strips control characters and trims. */
const clean = (v: unknown, max: number): string => str(v).replace(/[\p{Cc}\p{Cf}]/gu, ' ').trim().slice(0, max + 1);

function accountRows(db: Db, world: GameWorld): AdminAccountRow[] {
  const online = new Set(world.onlineAccounts());
  const now = Date.now();
  return db.adminAccounts().map((a) => {
    const chars = a.chars.map((c) => {
      const live = world.livePlayer(c.id);
      return live ? { ...c, level: live.level, gold: live.gold } : c;
    });
    const stash = world.liveStash(a.id);
    const stashGold = stash ? stash.gold : a.stashGold;
    const banned = a.banUntil !== null && a.banUntil > now;
    return {
      accountId: a.id,
      username: a.guest ? 'Guest' : a.username,
      guest: a.guest,
      role: isAdminRole(a.role) ? a.role : null,
      createdAt: a.createdAt,
      lastOnline: a.lastOnline,
      online: online.has(a.id),
      characters: chars.length,
      names: chars.map((c) => c.name),
      maxLevel: chars.reduce((m, c) => Math.max(m, c.level), 0),
      totalGold: chars.reduce((s, c) => s + c.gold, 0) + stashGold,
      stashSize: stash ? stash.size : a.stashSize,
      bannedUntil: banned ? a.banUntil : null,
      banReason: banned ? a.banReason : null,
    };
  });
}

function accountRow(db: Db, world: GameWorld, id: number): AdminAccountRow {
  const row = accountRows(db, world).find((r) => r.accountId === id);
  if (!row) throw new HttpError(404, 'ไม่พบบัญชีนี้');
  return row;
}

/** What has to be typed to confirm deleting: the username, or for a guest its character's name. */
const confirmName = (row: AdminAccountRow): string => (row.guest ? (row.names[0] ?? 'Guest') : row.username);

/** Who an account-level action names in the log. */
const who = (row: AdminAccountRow): string => `${row.guest ? `Guest ${row.names[0] ?? ''}`.trim() : row.username} (#${row.accountId})`;

/** Admins can't be banned or reset by GMs, and owners not by anyone but themselves. */
function guardTarget(a: Admin, row: AdminAccountRow, what: string): void {
  if (row.role === 'owner' && row.accountId !== a.acc.id) throw new HttpError(400, `${what} owner ไม่ได้`);
  if (row.role && a.role !== 'owner') throw new HttpError(403, NO_RIGHTS);
}

/** Handles the owner-tool routes; returns false for any other path. */
export async function ownerToolsApi(
  req: IncomingMessage, res: ServerResponse, path: string, method: string, url: URL, db: Db, world: GameWorld, backups: Backups,
): Promise<boolean> {
  // ---------------------------------------------------------- every account
  if (method === 'GET' && path === '/api/admin/accounts') {
    requireFeature(req, db, 'users');
    const rows = accountRows(db, world);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const body: AdminAccountsResponse = {
      summary: {
        accounts: rows.filter((r) => !r.guest).length,
        guests: rows.filter((r) => r.guest).length,
        characters: rows.reduce((s, r) => s + r.characters, 0),
        signupsToday: rows.filter((r) => !r.guest && r.createdAt >= midnight.getTime()).length,
      },
      rows,
    };
    send(res, 200, body);
    return true;
  }

  const acc = /^\/api\/admin\/accounts\/(\d{1,12})(?:\/(password|ban|unban))?$/.exec(path);
  if (acc) {
    const id = Number(acc[1]);
    const action = acc[2];

    if (method === 'GET' && !action) {
      requireFeature(req, db, 'users');
      const row = accountRow(db, world, id);
      const name = db.accountName(id);
      const characters: AdminCharDetail[] = db.characterSaves(id).map((c) => {
        const live = world.livePlayer(c.id);
        const data = live ? live.toData() : c.data;
        const base = charRow({ id: c.id, accountId: id, username: name?.username ?? '', guest: row.guest, name: data.name, data }, live);
        return { ...base, equipment: data.equipment, bag: Array.from({ length: BAG_SIZE }, (_, i) => data.bag[i] ?? null) };
      });
      const stash = world.liveStash(id) ?? db.savedStash(id);
      const body: AdminAccountDetail = { account: row, characters, stash: row.guest || !stash ? null : stash };
      send(res, 200, body);
      return true;
    }

    if (method === 'POST' && action === 'password') {
      const a = requireFeature(req, db, 'resetPassword');
      const row = accountRow(db, world, id);
      if (row.guest) throw new HttpError(400, 'Guest ไม่มีรหัสผ่าน');
      guardTarget(a, row, 'ตั้งรหัสผ่านให้');
      let pw = '';
      for (let i = 0; i < TEMP_PW_LEN; i++) pw += TEMP_PW_CHARS[randomInt(TEMP_PW_CHARS.length)];
      db.setPassword(id, await hashPassword(pw));
      world.kickAccount(id, 'รหัสผ่านถูกเปลี่ยนโดยผู้ดูแล — เข้าสู่ระบบใหม่ด้วยรหัสชั่วคราว');
      // The password itself is never logged.
      log(db, a, 'password', who(row), 'ตั้งรหัสผ่านชั่วคราว');
      send(res, 200, { password: pw, msg: `ตั้งรหัสชั่วคราวให้ ${row.username} แล้ว — แสดงครั้งเดียว` });
      return true;
    }

    if (method === 'POST' && action === 'ban') {
      const a = requireFeature(req, db, 'ban');
      const row = accountRow(db, world, id);
      if (id === a.acc.id) throw new HttpError(400, 'แบนตัวเองไม่ได้');
      guardTarget(a, row, 'แบน');
      const body = await readJson(req);
      const dur = BAN_DURATIONS.find((d) => d.id === body.duration);
      if (!dur) throw new HttpError(400, 'เลือกระยะเวลาแบน');
      const reason = clean(body.reason, BAN_REASON_MAX);
      if (!reason) throw new HttpError(400, 'ใส่เหตุผลด้วย');
      if (reason.length > BAN_REASON_MAX) throw new HttpError(400, `เหตุผลยาวได้ไม่เกิน ${BAN_REASON_MAX} ตัว`);
      const until = dur.ms === null ? BAN_FOREVER : Date.now() + dur.ms;
      db.setBan(id, until, reason);
      world.kickAccount(id, banMessage(until, reason));
      log(db, a, 'ban', who(row), `${dur.label}: ${reason}`);
      send(res, 200, { msg: `แบน ${row.username} ${dur.label} แล้ว`, account: accountRow(db, world, id) });
      return true;
    }

    if (method === 'POST' && action === 'unban') {
      const a = requireFeature(req, db, 'ban');
      const row = accountRow(db, world, id);
      guardTarget(a, row, 'ปลดแบน');
      if (!row.bannedUntil) throw new HttpError(400, 'บัญชีนี้ไม่ได้ถูกแบน');
      db.setBan(id, null, null);
      log(db, a, 'unban', who(row), `ปลดแบน (เดิม: ${row.banReason ?? ''})`);
      send(res, 200, { msg: `ปลดแบน ${row.username} แล้ว`, account: accountRow(db, world, id) });
      return true;
    }

    if (method === 'DELETE' && !action) {
      // Never a GM, whatever FEATURE_ROLES says.
      const a = requireAdmin(req, db, 'owner');
      const row = accountRow(db, world, id);
      if (row.role === 'owner') throw new HttpError(400, 'ลบบัญชี owner ไม่ได้');
      const body = await readJson(req);
      if (str(body.confirm).trim().toLowerCase() !== confirmName(row).toLowerCase()) {
        throw new HttpError(400, `พิมพ์ "${confirmName(row)}" ให้ตรงเพื่อยืนยัน`);
      }
      world.kickAccount(id, 'บัญชีนี้ถูกลบโดยผู้ดูแล');
      const backup = backups.make('before-delete');
      db.deleteAccount(id);
      log(db, a, 'delete-account', who(row), `ตัวละคร ${row.names.join(', ') || '-'} · สำรองไว้ที่ ${backup.name}`);
      send(res, 200, { msg: `ลบบัญชี ${row.username} แล้ว (สำรองไว้ก่อนลบ: ${backup.name})`, backup });
      return true;
    }
  }

  const ch = /^\/api\/admin\/characters\/(\d{1,12})$/.exec(path);
  if (method === 'DELETE' && ch) {
    const a = requireAdmin(req, db, 'owner');
    const c = db.adminCharacter(Number(ch[1]));
    if (!c) throw new HttpError(404, 'ไม่พบตัวละครนี้');
    const body = await readJson(req);
    if (str(body.confirm).trim().toLowerCase() !== c.name.toLowerCase()) throw new HttpError(400, `พิมพ์ "${c.name}" ให้ตรงเพื่อยืนยัน`);
    world.kickCharacter(c.id, 'ตัวละครนี้ถูกลบโดยผู้ดูแล');
    const backup = backups.make('before-delete');
    db.deleteCharacterById(c.id);
    log(db, a, 'delete-character', `${c.name} (${c.guest ? 'Guest' : c.username}, #${c.id})`, `Lv.${c.data.level} · สำรองไว้ที่ ${backup.name}`);
    send(res, 200, { msg: `ลบตัวละคร ${c.name} แล้ว (สำรองไว้ก่อนลบ: ${backup.name})`, backup });
    return true;
  }

  // ---------------------------------------------------------- broadcast
  if (method === 'POST' && path === '/api/admin/broadcast') {
    const a = requireFeature(req, db, 'broadcast');
    const body = await readJson(req);
    // Shown with textContent in the game (never as HTML); control characters are stripped here.
    const text = clean(body.text, BROADCAST_MAX);
    if (!text) throw new HttpError(400, 'พิมพ์ข้อความก่อน');
    if (text.length > BROADCAST_MAX) throw new HttpError(400, `ข้อความยาวได้ไม่เกิน ${BROADCAST_MAX} ตัว`);
    let to: { charId: number; name: string } | undefined;
    if (body.to !== undefined && body.to !== null) {
      const charId = Number(body.to);
      const live = Number.isSafeInteger(charId) ? world.livePlayer(charId) : undefined;
      if (!live) throw new HttpError(400, 'ผู้เล่นคนนี้ไม่ได้ออนไลน์แล้ว');
      to = { charId, name: live.name };
    }
    const now = Date.now();
    const last = lastBroadcast.get(a.acc.id) ?? 0;
    if (now - last < BROADCAST_EVERY_MS) {
      throw new HttpError(429, `ส่งได้ทุก ${BROADCAST_EVERY_MS / 1000} วินาที — รออีก ${Math.ceil((BROADCAST_EVERY_MS - (now - last)) / 1000)} วินาที`);
    }
    lastBroadcast.set(a.acc.id, now);
    const from = `${a.role === 'owner' ? 'Owner' : 'GM'} ${a.acc.username}`;
    const n = world.broadcast(text, from, to?.charId);
    log(db, a, 'broadcast', to ? `${to.name} (#${to.charId})` : 'ทุกคน', text);
    send(res, 200, { msg: to ? `ส่งข้อความถึง ${to.name} แล้ว` : `ส่งประกาศถึงผู้เล่น ${n} คนแล้ว` });
    return true;
  }

  // ---------------------------------------------------------- enhancement orb look (server-wide)
  if (method === 'GET' && path === '/api/admin/orb-look') {
    const a = requireFeature(req, db, 'orbPreview');
    send(res, 200, orbLookState(db, canUse(a.role, 'orbLook')));
    return true;
  }

  if (method === 'POST' && path === '/api/admin/orb-look') {
    const a = requireFeature(req, db, 'orbLook');
    const body = await readJson(req);
    // `reset: true` = back to the default look; otherwise `look` is the whole new look.
    const c = body.reset === true ? { look: { ...DEFAULT_ORB_LOOK } } : checkOrbLook(body.look);
    if (!c.look) throw new HttpError(400, c.error);
    const before = db.orbLook();
    if (!sameOrbLook(before, c.look)) {
      db.setOrbLook(c.look);
      log(db, a, 'orb-look', 'ลูกแก้วตีบวก ค่าเริ่มต้นทั้งเซิร์ฟ', (body.reset === true ? 'คืนค่าเริ่มต้น: ' : '') + orbLookChanges(before, c.look));
      world.orbLookChanged(c.look);
    }
    send(res, 200, orbLookState(db, true));
    return true;
  }

  // ---------------------------------------------------------- countdown texts (every way of stopping uses them)
  if (method === 'GET' && path === '/api/admin/shutdown-text') {
    requireFeature(req, db, 'shutdownText');
    send(res, 200, shutdownTextState(db));
    return true;
  }

  if (method === 'POST' && path === '/api/admin/shutdown-text') {
    const a = requireFeature(req, db, 'shutdownText');
    const body = await readJson(req);
    const modes = (['restart', 'shutdown'] as const).filter((m) => body[m] !== undefined);
    if (!modes.length) throw new HttpError(400, 'ไม่มีข้อความให้บันทึก');
    // Check both first so a bad one saves neither. null or the default text = back to the default.
    const next = modes.map((mode) => {
      if (body[mode] === null) return { mode, text: null };
      const c = checkShutdownText(body[mode]);
      if (c.error) throw new HttpError(400, `${MODE_NAME[mode]}: ${c.error}`);
      return { mode, text: c.text === DEFAULT_SHUTDOWN_TEXT[mode] ? null : c.text };
    });
    const before = db.shutdownTexts();
    for (const { mode, text } of next) {
      db.setSetting(SHUTDOWN_TEXT_KEY[mode], text);
      const now = text ?? DEFAULT_SHUTDOWN_TEXT[mode];
      if (now !== before[mode]) log(db, a, 'shutdown-text', MODE_NAME[mode], text === null ? `คืนค่าเริ่มต้น: ${now}` : now);
    }
    send(res, 200, shutdownTextState(db));
    return true;
  }

  // ---------------------------------------------------------- history: play sessions, chat log, graphs
  if (method === 'GET' && path === '/api/admin/sessions') {
    requireFeature(req, db, 'sessions');
    const q = sessionQuery(url.searchParams);
    const open = world.openPlayRows();
    const found = db.playSessions(q, [...open.keys()]);
    const rows = found.rows.map((r) => {
      const live = open.get(r.id);
      return live ? { ...r, ...live, online: true } : r;
    });
    send(res, 200, { rows, total: found.total, page: found.page, size: q.size } satisfies SessionPage);
    return true;
  }

  if (method === 'GET' && path === '/api/admin/chat') {
    requireFeature(req, db, 'chatLog');
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 50);
    const before = Number(url.searchParams.get('before'));
    send(res, 200, db.chatLog(HISTORY_PAGE, q, Number.isSafeInteger(before) && before > 0 ? before : undefined));
    return true;
  }

  const chat = /^\/api\/admin\/chat\/(\d{1,12})$/.exec(path);
  if (method === 'DELETE' && chat) {
    const a = requireFeature(req, db, 'chatDelete');
    const m = db.chatMessage(Number(chat[1]));
    if (!m) throw new HttpError(404, 'ไม่พบข้อความนี้');
    db.deleteChat(m.id);
    log(db, a, 'chat-delete', `${m.charName} (${m.username})`, `${new Date(m.at).toISOString()}: ${m.text}`);
    send(res, 200, { msg: 'ลบข้อความแล้ว' });
    return true;
  }

  if (method === 'GET' && path === '/api/admin/stats') {
    requireFeature(req, db, 'stats');
    const r = url.searchParams.get('range');
    const range: StatsRange = r === '7d' || r === '30d' ? r : '24h';
    send(res, 200, stats(db, world, range));
    return true;
  }

  // ---------------------------------------------------------- backups
  if (path === '/api/admin/backups' && method === 'GET') {
    requireFeature(req, db, 'backup');
    send(res, 200, backups.list());
    return true;
  }
  if (path === '/api/admin/backups' && method === 'POST') {
    const a = requireFeature(req, db, 'backup');
    const b = backups.make('manual');
    log(db, a, 'backup', 'ฐานข้อมูล', `${b.name} (${(b.size / 1024).toFixed(0)} KB)`);
    send(res, 200, { msg: `สำรองแล้ว: ${b.name}`, rows: backups.list() });
    return true;
  }

  return false;
}

// ------------------------------------------------------------ graphs

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Range → its length and the bucket the online graph uses. */
const RANGES: Record<StatsRange, { ms: number; bucket: number }> = {
  '24h': { ms: DAY, bucket: 10 * 60 * 1000 },
  '7d': { ms: 7 * DAY, bucket: HOUR },
  '30d': { ms: 30 * DAY, bucket: 4 * HOUR },
};

/** Local midnight of the day `t` is in. */
function dayStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function stats(db: Db, world: GameWorld, range: StatsRange): AdminStats {
  const now = Date.now();
  const { ms, bucket } = RANGES[range];
  const from = now - ms;
  const samples = db.samples(from);

  // Most players online per bucket (buckets without samples are left out: the server was off).
  const online = new Map<number, number>();
  for (const s of samples) {
    const b = Math.floor(s.at / bucket) * bucket;
    online.set(b, Math.max(online.get(b) ?? 0, s.total));
  }

  // Average level / ping of the players online: per hour over 24 h, per day otherwise.
  const step = range === '24h' ? HOUR : DAY;
  const keyOf = (t: number) => (step === DAY ? dayStart(t) : Math.floor(t / HOUR) * HOUR);
  const lv = new Map<number, { sum: number; n: number }>();
  const ping = new Map<number, { sum: number; n: number }>();
  for (const s of samples) {
    if (!s.total) continue;
    const k = keyOf(s.at);
    if (s.avgLevel !== null) {
      const e = lv.get(k) ?? { sum: 0, n: 0 };
      e.sum += s.avgLevel;
      e.n++;
      lv.set(k, e);
    }
    if (s.avgRtt !== null) {
      const e = ping.get(k) ?? { sum: 0, n: 0 };
      e.sum += s.avgRtt;
      e.n++;
      ping.set(k, e);
    }
  }
  const avg = (m: Map<number, { sum: number; n: number }>): StatsPoint[] =>
    [...m].sort((a, b) => a[0] - b[0]).map(([at, e]) => ({ at, v: Math.round((e.sum / e.n) * 10) / 10 }));

  // Sign-ups per local day for the last 30 days, zeros included.
  const first = dayStart(now - 29 * DAY);
  const days: StatsPoint[] = [];
  for (let d = first; d <= now; d = dayStart(d + DAY + HOUR)) days.push({ at: d, v: 0 });
  for (const t of db.signupTimes(first)) {
    const k = dayStart(t);
    const p = days.find((x) => x.at === k);
    if (p) p.v++;
  }

  return {
    range,
    online: [...online].sort((a, b) => a[0] - b[0]).map(([at, v]) => ({ at, v })),
    signups: days,
    avgLevel: avg(lv),
    avgPing: avg(ping),
    now: { online: world.onlineCount, avgLevelAll: db.averageLevel() },
    since: db.samples(0)[0]?.at ?? null,
  };
}
