// The admin API behind the /admin page: who is online (with ping and IP), character search, and
// edits for testing (level, gold, items, kick, teleport), GM roles and the audit log.
//
// The page is reachable from the internet through the tunnel link, so every call here checks the
// caller's role in the database and every value it sends. Nothing the page says is trusted.
// Edits to an online character go through its live Player in the world (and are saved at once);
// edits to an offline one rewrite its saved CharacterData.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db, AdminCharacterRow, SessionAccount } from './db';
import type { GameWorld } from './world';
import { bearer, HttpError, readJson, send, str } from './http';
import { ownerToolsApi } from './admin-tools';
import { mailAdminApi } from './admin-mail';
import { tradeAdminApi } from './admin-trade';
import { reportsAdminApi } from './admin-reports';
import { rolesAdminApi } from './admin-roles';
import { itemsAdminApi } from './admin-items';
import type { Backups } from './backup';
import { currentBalanceTuning } from '../src/shared/balance';
import {
  ADMIN_AUDIT_PAGE, ADMIN_GOLD_MAX, ADMIN_NO_RIGHTS, ADMIN_ITEMS_MAX, ADMIN_SEARCH_MAX,
  addStackToBag, adminStack, adminStackName, customItem, OWNER_ROLE, type AdminFeature, type AdminCharRow, type AdminEditResult, type AdminMe, type AdminMeta, type AdminRole, type AdminServerState,
} from '../src/shared/admin';
import { countdownTime, SHUTDOWN_SECONDS, SHUTDOWN_SECONDS_MAX, shutdownCancelled, shutdownSeconds, type ShutdownMode } from '../src/shared/net/protocol';
import { BAG_SIZE, type CharacterData, type Player } from '../src/shared/sim/Player';
import { expToNext, MAX_LEVEL } from '../src/shared/formulas';
import { gatesPassedBy } from '../src/shared/data/bossGates';
import { ZONES, zoneById } from '../src/shared/data/zones';
import { hasChannels, placeLabel } from '../src/shared/channels';
import { ITEM_BASES, makeItem } from '../src/shared/data/items';
import { CLASS_IDS } from '../src/shared/data/classes';
import { MAX_PLUS } from '../src/shared/data/enhance';
import { RARITIES, RARITY_LABEL, STAT_LABEL, type BagEntry, type Item } from '../src/shared/types';
import { checkUsername } from '../src/shared/api';

const NO_RIGHTS = ADMIN_NO_RIGHTS;
const GM_SCOPE = 'GM แก้ไขตัวละครของ owner หรือ GM คนอื่นไม่ได้';

/** The caller: their login, role, and the tools that role may use right now (read from the DB on every call). */
export interface Admin { acc: SessionAccount; role: AdminRole; features: AdminFeature[] }

/**
 * The caller, if their login is valid and their account has an admin role; otherwise 401 / 403.
 * `need` 'owner' = the owner-only things that are never a switch (roles, audit, server stop, deleting).
 */
export function requireAdmin(req: IncomingMessage, db: Db, need?: 'owner'): Admin {
  const token = bearer(req);
  const acc = token ? db.sessionAccount(token) : undefined;
  if (!acc) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่');
  const role = acc.guest ? null : db.adminRole(acc.id);
  if (!role || (need === OWNER_ROLE && role !== OWNER_ROLE)) throw new HttpError(403, NO_RIGHTS);
  return { acc, role, features: db.roleFeatures(role) };
}

/** The caller, if their role may use this tool; otherwise 401 / 403. */
export function requireFeature(req: IncomingMessage, db: Db, f: AdminFeature, deny = NO_RIGHTS): Admin {
  const a = requireAdmin(req, db);
  if (!a.features.includes(f)) throw new HttpError(403, deny);
  return a;
}

/**
 * Staff (any admin role) acting on another account: never on an owner's, and on another staff
 * account only with the `staffTarget` tool. The owner, and anyone on their own account, always may.
 */
export function mayTouch(db: Db, a: Admin, accountId: number): 'ok' | 'owner' | 'staff' {
  if (a.role === OWNER_ROLE || accountId === a.acc.id) return 'ok';
  const r = db.adminRole(accountId);
  if (!r) return 'ok';
  if (r === OWNER_ROLE) return 'owner';
  return a.features.includes('staffTarget') ? 'ok' : 'staff';
}

/** A whole number in [min, max] from the request, or a 400. */
export function int(v: unknown, min: number, max: number, what: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new HttpError(400, `${what}ต้องเป็นจำนวนเต็ม ${min.toLocaleString()}–${max.toLocaleString()}`);
  }
  return v;
}

export function log(db: Db, a: Admin, action: string, target: string, details: string): void {
  db.audit(a.acc.id, a.acc.username, action, target, details);
  console.log(`[admin] ${a.acc.username} (${a.role}) ${action} ${target}: ${details}`);
}

/** The fields an edit touches; a live Player and a saved CharacterData both have them. */
interface Editable { level: number; exp: number; gold: number; bag: (BagEntry | null)[]; bossKills?: string[] }

const freeSlots = (bag: (BagEntry | null)[]): number => {
  let n = 0;
  for (let i = 0; i < BAG_SIZE; i++) if (!bag[i]) n++;
  return n;
};

export function charRow(c: AdminCharacterRow, live: Player | undefined): AdminCharRow {
  const d: Editable & { classId: CharacterData['classId']; zone?: string } = live
    ? { level: live.level, exp: live.exp, gold: live.gold, bag: live.bag, classId: live.cls.id, zone: live.zone }
    : c.data;
  return {
    charId: c.id, accountId: c.accountId, username: c.guest ? 'Guest' : c.username, guest: c.guest, name: c.name,
    classId: d.classId, level: d.level, exp: d.exp, expToNext: expToNext(d.level), gold: d.gold,
    zone: zoneById(d.zone).id, bagFree: freeSlots(d.bag), online: !!live,
  };
}

/** Stopping the server, from main.ts (the same countdown as Ctrl+C and npm run stop-server). */
const serverState = (c: ServerControl): AdminServerState => ({ supervised: c.supervised, stopping: c.stopping(), seconds: c.seconds() });

export interface ServerControl {
  /** Started by npm run online, which can start the server again after a restart. */
  supervised: boolean;
  stopping(): ShutdownMode | null;
  /** Length of the countdown running now (seconds). */
  seconds(): number;
  /** Starts a countdown of `seconds` (default SHUTDOWN_SECONDS); returns why it can't, or null. */
  stop(mode: ShutdownMode, by: string, seconds?: number): string | null;
  /** Cancels a running countdown; returns why it can't, or null. */
  cancel(by: string): string | null;
}

export async function adminApi(
  req: IncomingMessage, res: ServerResponse, path: string, db: Db, world: GameWorld, control: ServerControl, backups: Backups,
): Promise<void> {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (await ownerToolsApi(req, res, path, method, url, db, world, backups)) return;
  if (await mailAdminApi(req, res, path, method, db, world)) return;
  if (tradeAdminApi(req, res, path, method, db)) return;
  if (await reportsAdminApi(req, res, path, method, db)) return;
  if (await rolesAdminApi(req, res, path, method, url, db)) return;
  if (await itemsAdminApi(req, res, path, method, db, world)) return;

  if (method === 'GET' && path === '/api/admin/me') {
    const a = requireAdmin(req, db);
    const roleNames = Object.fromEntries(db.roleDefs().map((r) => [r.id, r.name]));
    return send(res, 200, { username: a.acc.username, role: a.role, roleName: db.roleName(a.role), features: a.features, roleNames } satisfies AdminMe);
  }

  if (method === 'GET' && path === '/api/admin/meta') {
    requireAdmin(req, db);
    const meta: AdminMeta = {
      maxLevel: MAX_LEVEL, maxPlus: MAX_PLUS, goldMax: ADMIN_GOLD_MAX, itemsMax: ADMIN_ITEMS_MAX,
      zones: Object.values(ZONES).map((z) => ({ id: z.id, nameTh: z.nameTh, levels: z.levels })),
      bases: ITEM_BASES.map((b) => ({ id: b.id, slot: b.slot, names: b.names, minLevel: b.minLevel })),
      rarities: RARITIES,
      balance: currentBalanceTuning(),
    };
    return send(res, 200, meta);
  }

  if (method === 'GET' && path === '/api/admin/online') {
    requireFeature(req, db, 'online');
    return send(res, 200, world.adminOnline());
  }

  if (method === 'GET' && path === '/api/admin/characters') {
    requireFeature(req, db, 'charView');
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 32);
    if (!q) return send(res, 200, []);
    const rows = db.searchCharacters(q, ADMIN_SEARCH_MAX).map((c) => charRow(c, world.livePlayer(c.id)));
    return send(res, 200, rows);
  }

  const one = /^\/api\/admin\/characters\/(\d{1,12})$/.exec(path);
  if (method === 'GET' && one) {
    requireFeature(req, db, 'charView');
    const c = db.adminCharacter(Number(one[1]));
    if (!c) throw new HttpError(404, 'ไม่พบตัวละครนี้');
    return send(res, 200, charRow(c, world.livePlayer(c.id)));
  }

  const edit = /^\/api\/admin\/characters\/(\d{1,12})\/(level|gold|items|kick|teleport)$/.exec(path);
  if (method === 'POST' && edit) {
    const tool: AdminFeature = edit[2] === 'kick' ? 'kick' : edit[2] === 'teleport' ? 'teleport' : 'charEdit';
    const a = requireFeature(req, db, tool);
    const body = await readJson(req);
    return send(res, 200, editCharacter(db, world, a, Number(edit[1]), edit[2], body));
  }

  // ---------------------------------------------------------- roles and audit: owner only

  if (method === 'GET' && path === '/api/admin/audit') {
    requireAdmin(req, db, 'owner');
    const before = Number(url.searchParams.get('before'));
    return send(res, 200, db.auditLog(ADMIN_AUDIT_PAGE, Number.isSafeInteger(before) && before > 0 ? before : undefined));
  }

  if (method === 'GET' && path === '/api/admin/server') {
    requireAdmin(req, db, 'owner');
    return send(res, 200, serverState(control));
  }

  if (method === 'POST' && path === '/api/admin/server') {
    const a = requireAdmin(req, db, 'owner');
    const body = await readJson(req);
    if (body.mode === 'cancel') {
      const was = control.stopping();
      const err = control.cancel(`admin page (${a.acc.username})`);
      if (err || !was) throw new HttpError(409, err ?? 'ไม่ได้นับถอยหลังอยู่');
      log(db, a, 'server', 'server', shutdownCancelled(was));
      return send(res, 200, serverState(control));
    }
    const mode: ShutdownMode | null = body.mode === 'restart' ? 'restart' : body.mode === 'shutdown' ? 'shutdown' : null;
    if (!mode) throw new HttpError(400, 'เลือก รีสตาร์ท หรือ ปิด server');
    const secs = shutdownSeconds(body.seconds);
    if (secs === null) throw new HttpError(400, `เวลานับถอยหลังต้องเป็น ${SHUTDOWN_SECONDS}–${SHUTDOWN_SECONDS_MAX} วินาที`);
    const err = control.stop(mode, `admin page (${a.acc.username})`, secs);
    if (err) throw new HttpError(409, err);
    log(db, a, 'server', 'server', `${mode === 'restart' ? 'รีสตาร์ท' : 'ปิด server'} (นับ ${countdownTime(secs)})`);
    return send(res, 200, serverState(control));
  }

  throw new HttpError(404, 'ไม่พบ API นี้');
}

function editCharacter(db: Db, world: GameWorld, a: Admin, charId: number, what: string, body: Record<string, unknown>): AdminEditResult {
  const c = db.adminCharacter(charId);
  if (!c) throw new HttpError(404, 'ไม่พบตัวละครนี้');
  const target = `${c.name} (${c.guest ? 'Guest' : c.username}, #${c.id})`;
  // Staff edit normal players and their own characters; other staff only with `staffTarget`, the owner's never.
  if (!c.guest && mayTouch(db, a, c.accountId) !== 'ok') throw new HttpError(403, GM_SCOPE);
  // Online: change the live character (a DB edit would be overwritten by its next save).
  // Everything below runs synchronously, so the character can't log in or out half way.
  const live = world.livePlayer(charId);
  const d: Editable = live ?? c.data;
  if (!live) c.data.bag = Array.from({ length: BAG_SIZE }, (_, i) => c.data.bag[i] ?? null);

  let msg: string;
  let tell: string;
  switch (what) {
    case 'level': {
      const level = int(body.level, 1, MAX_LEVEL, 'เลเวล');
      const need = expToNext(level);
      // At the max level EXP stops counting (Sim.addExp), so keep it at 0 there.
      const exp = level >= MAX_LEVEL ? 0 : int(body.exp ?? 0, 0, need - 1, 'EXP');
      const before = `Lv.${d.level} EXP ${d.exp}`;
      d.level = level;
      d.exp = exp;
      // Raising the level also passes the gates below it (a lower level keeps what was already killed).
      d.bossKills = [...new Set([...(d.bossKills ?? []), ...gatesPassedBy(level)])];
      if (live) {
        live.recompute();
        if (live.alive) {
          live.hp = live.maxHp;
          live.mp = live.stats.maxMp;
        }
      }
      msg = `ตั้งเป็น Lv.${level} EXP ${exp.toLocaleString()}`;
      tell = `GM ปรับเลเวลเป็น ${level}`;
      log(db, a, 'level', target, `${before} → Lv.${level} EXP ${exp}`);
      break;
    }
    case 'gold': {
      const delta = int(body.delta, -ADMIN_GOLD_MAX, ADMIN_GOLD_MAX, 'จำนวนทอง');
      if (delta === 0) throw new HttpError(400, 'จำนวนทองต้องไม่เป็น 0');
      if (delta < 0 && d.gold < -delta) throw new HttpError(400, `ทองไม่พอ (มี ${d.gold.toLocaleString()} G)`);
      const before = d.gold;
      d.gold = Math.max(0, before + delta);
      const change = d.gold - before;
      msg = `${change >= 0 ? 'ให้' : 'ลด'}ทอง ${Math.abs(change).toLocaleString()} G (เหลือ ${d.gold.toLocaleString()} G)`;
      tell = change >= 0 ? `GM ให้ทอง ${change.toLocaleString()} G` : `GM ลดทอง ${(-change).toLocaleString()} G`;
      log(db, a, 'gold', target, `${before} → ${d.gold} (${delta >= 0 ? '+' : ''}${delta})`);
      break;
    }
    case 'items': {
      // Potions and blacksmith stones: count is pieces (bottles/stones), stacked into the bag like a pickup.
      if (body.kind !== undefined && body.kind !== 'equip') {
        const kind = adminStack(body);
        if (typeof kind === 'string') throw new HttpError(400, kind);
        const count = int(body.count ?? 1, 1, ADMIN_ITEMS_MAX, 'จำนวนชิ้น');
        const n = addStackToBag(d.bag, BAG_SIZE, kind, count);
        if (n === 0) throw new HttpError(400, 'กระเป๋าเต็ม');
        const label = adminStackName(kind);
        msg = n < count ? `ใส่ได้ ${n}/${count} ชิ้น — กระเป๋าเต็ม (${label})` : `เสกให้ ${n} ชิ้น: ${label}`;
        tell = `GM มอบ ${label} × ${n}`;
        log(db, a, 'items', target, `${label} × ${n}${n < count ? ` (ขอ ${count}, กระเป๋าเต็ม)` : ''}`);
        break;
      }
      const base = ITEM_BASES.find((b) => b.id === body.baseId);
      if (!base) throw new HttpError(400, 'ไม่มีไอเทมชนิดนี้');
      const rarity = RARITIES.find((r) => r === body.rarity);
      if (!rarity) throw new HttpError(400, 'ระดับความหายากไม่ถูกต้อง');
      const plus = int(body.plus ?? 0, 0, MAX_PLUS, 'ระดับตีบวก');
      const count = int(body.count ?? 1, 1, ADMIN_ITEMS_MAX, 'จำนวนชิ้น');
      const asked = int(body.level ?? d.level, 1, MAX_LEVEL, 'เลเวลไอเทม');
      // An item type never drops below its own minimum level, so a spawned one doesn't either.
      const level = Math.max(asked, base.minLevel);
      const adjusted = level !== asked ? `ปรับเลเวลไอเทมเป็น Lv.${level} (ขั้นต่ำของชนิดนี้)` : '';
      const free = freeSlots(d.bag);
      if (free === 0) throw new HttpError(400, 'กระเป๋าเต็ม');
      const n = Math.min(count, free);
      // Gear for another class may be asked for (to hand on to someone else); default is the character's own.
      const own = live ? live.cls.id : c.data.classId;
      const classId = body.classId === undefined ? own : CLASS_IDS.find((k) => k === body.classId);
      if (!classId) throw new HttpError(400, 'อาชีพไม่ถูกต้อง');
      // Chosen stats (owner by default): every copy gets exactly the rows the page showed.
      const custom = body.lines !== undefined;
      if (custom && !a.features.includes('customItem')) throw new HttpError(403, 'ไม่มีสิทธิ์กำหนดสเตตัสไอเทม');
      if (custom && adjusted) throw new HttpError(400, `ชนิดนี้เลเวลขั้นต่ำ Lv.${level} สุ่มตัวอย่างใหม่ที่เลเวลนั้นก่อน`);
      const made: Item[] = [];
      for (let k = 0; k < n; k++) {
        const item = custom ? customItem(base.id, rarity, level, classId, body.name, body.lines) : makeItem(base.id, rarity, level, classId)!;
        if (typeof item === 'string') throw new HttpError(400, item);
        if (plus > 0) item.plus = plus;
        made.push(item);
      }
      for (const item of made) d.bag[d.bag.indexOf(null)] = item;
      const name = made[0].name;
      const rows = custom ? ` · ${(made[0].lines ?? []).map((l) => `${STAT_LABEL[l.stat]} ${l.value}`).join(', ') || 'ไม่มีสเตตัส'}` : '';
      const label = `${plus ? `+${plus} ` : ''}${name} [${RARITY_LABEL[rarity]}] Lv.${level}`;
      msg = (n < count ? `ใส่ได้ ${n}/${count} ชิ้น — กระเป๋าเต็ม (${label})` : `เสกให้ ${n} ชิ้น: ${label}`) + (adjusted ? ` · ${adjusted}` : '');
      tell = `GM มอบไอเทม ${label} × ${n}`;
      log(db, a, 'items', target, `${label} × ${n}${n < count ? ` (ขอ ${count}, กระเป๋าเต็ม)` : ''}${adjusted ? ` · ${adjusted}` : ''}${custom ? ' · กำหนดสเตตัส' : ''}${rows}`);
      break;
    }
    case 'kick': {
      if (!world.kickCharacter(charId, 'GM นำคุณออกจากเกม')) throw new HttpError(400, 'ตัวละครนี้ไม่ได้ออนไลน์');
      log(db, a, 'kick', target, 'เตะออกจากเกม');
      return { msg: `เตะ ${c.name} ออกแล้ว`, char: charRow(db.adminCharacter(charId)!, undefined) };
    }
    case 'teleport': {
      const zone = Object.values(ZONES).find((z) => z.id === body.zone);
      if (!zone) throw new HttpError(400, 'ไม่มีโซนนี้');
      // A chosen channel (a map with channels only) is the channelWarp tool: into it however full it is.
      const ch = body.ch === undefined || body.ch === null || body.ch === '' ? undefined : Number(body.ch);
      if (ch !== undefined) {
        if (!a.features.includes('channelWarp')) throw new HttpError(403, 'ไม่มีสิทธิ์วาร์ปเข้า CH');
        if (!Number.isSafeInteger(ch) || ch < 1) throw new HttpError(400, 'เลข CH ไม่ถูกต้อง');
        if (!hasChannels(zone)) throw new HttpError(400, `${zone.nameTh}ไม่มีแชนแนล`);
      }
      if (!live) {
        // Offline characters always come back into the game in the hub, so moving them would do nothing.
        throw new HttpError(400, 'ตัวละครออฟไลน์อยู่ — เข้าเกมครั้งหน้าจะเริ่มที่เมืองเสมอ ย้ายได้เฉพาะตอนออนไลน์');
      }
      const was = world.placeOf(charId);
      const from = zoneById(was?.zone ?? live.zone);
      const fromLabel = was && hasChannels(from) ? placeLabel(from, was.ch) : from.nameTh;
      const err = world.teleportCharacter(charId, zone.id, ch);
      if (err) throw new HttpError(400, err);
      const now = world.placeOf(charId);
      const toLabel = now && hasChannels(zone) ? placeLabel(zone, now.ch) : zone.nameTh;
      world.adminChanged(charId, `GM ย้ายคุณไปที่${toLabel}`);
      log(db, a, 'teleport', target, `${fromLabel} → ${toLabel}${ch !== undefined ? ' (เลือก CH)' : ''}`);
      return { msg: `ย้ายไป ${toLabel} แล้ว`, char: charRow(db.adminCharacter(charId)!, world.livePlayer(charId)) };
    }
    default:
      throw new HttpError(404, 'ไม่พบ API นี้');
  }

  if (live) world.adminChanged(charId, tell);
  else db.saveCharacter(charId, c.data);
  return { msg, char: charRow(db.adminCharacter(charId)!, world.livePlayer(charId)) };
}
