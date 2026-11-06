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
import type { Backups } from './backup';
import {
  ADMIN_AUDIT_PAGE, ADMIN_GOLD_MAX, ADMIN_ITEMS_MAX, ADMIN_SEARCH_MAX,
  canUse, FEATURE_ROLES, type AdminFeature, type AdminCharRow, type AdminEditResult, type AdminMe, type AdminMeta, type AdminRole, type AdminServerState,
} from '../src/shared/admin';
import { shutdownCancelled, type ShutdownMode } from '../src/shared/net/protocol';
import { BAG_SIZE, type CharacterData, type Player } from '../src/shared/sim/Player';
import { expToNext, MAX_LEVEL } from '../src/shared/formulas';
import { ZONES, zoneById } from '../src/shared/data/zones';
import { ITEM_BASES, makeItem } from '../src/shared/data/items';
import { MAX_PLUS } from '../src/shared/data/enhance';
import { RARITIES, RARITY_LABEL, type BagEntry } from '../src/shared/types';
import { checkUsername } from '../src/shared/api';

const NO_RIGHTS = 'ไม่มีสิทธิ์';

export interface Admin { acc: SessionAccount; role: AdminRole }

/** The caller, if their login is valid and their account has an admin role; otherwise 401 / 403. */
export function requireAdmin(req: IncomingMessage, db: Db, need: AdminRole = 'gm'): Admin {
  const token = bearer(req);
  const acc = token ? db.sessionAccount(token) : undefined;
  if (!acc) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่');
  const role = acc.guest ? null : db.adminRole(acc.id);
  if (!role || (need === 'owner' && role !== 'owner')) throw new HttpError(403, NO_RIGHTS);
  return { acc, role };
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
interface Editable { level: number; exp: number; gold: number; bag: (BagEntry | null)[] }

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
export interface ServerControl {
  /** Started by npm run online, which can start the server again after a restart. */
  supervised: boolean;
  stopping(): ShutdownMode | null;
  /** Starts the countdown; returns why it can't, or null. */
  stop(mode: ShutdownMode, by: string): string | null;
  /** Cancels a running countdown; returns why it can't, or null. */
  cancel(by: string): string | null;
}

export async function adminApi(
  req: IncomingMessage, res: ServerResponse, path: string, db: Db, world: GameWorld, control: ServerControl, backups: Backups,
): Promise<void> {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (await ownerToolsApi(req, res, path, method, url, db, world, backups)) return;

  if (method === 'GET' && path === '/api/admin/me') {
    const a = requireAdmin(req, db);
    const features = (Object.keys(FEATURE_ROLES) as AdminFeature[]).filter((f) => canUse(a.role, f));
    return send(res, 200, { username: a.acc.username, role: a.role, features } satisfies AdminMe);
  }

  if (method === 'GET' && path === '/api/admin/meta') {
    requireAdmin(req, db);
    const meta: AdminMeta = {
      maxLevel: MAX_LEVEL, maxPlus: MAX_PLUS, goldMax: ADMIN_GOLD_MAX, itemsMax: ADMIN_ITEMS_MAX,
      zones: Object.values(ZONES).map((z) => ({ id: z.id, nameTh: z.nameTh, levels: z.levels })),
      bases: ITEM_BASES.map((b) => ({ id: b.id, slot: b.slot, names: b.names, minLevel: b.minLevel })),
      rarities: RARITIES,
    };
    return send(res, 200, meta);
  }

  if (method === 'GET' && path === '/api/admin/online') {
    requireAdmin(req, db);
    return send(res, 200, world.adminOnline());
  }

  if (method === 'GET' && path === '/api/admin/characters') {
    requireAdmin(req, db);
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 32);
    if (!q) return send(res, 200, []);
    const rows = db.searchCharacters(q, ADMIN_SEARCH_MAX).map((c) => charRow(c, world.livePlayer(c.id)));
    return send(res, 200, rows);
  }

  const one = /^\/api\/admin\/characters\/(\d{1,12})$/.exec(path);
  if (method === 'GET' && one) {
    requireAdmin(req, db);
    const c = db.adminCharacter(Number(one[1]));
    if (!c) throw new HttpError(404, 'ไม่พบตัวละครนี้');
    return send(res, 200, charRow(c, world.livePlayer(c.id)));
  }

  const edit = /^\/api\/admin\/characters\/(\d{1,12})\/(level|gold|items|kick|teleport)$/.exec(path);
  if (method === 'POST' && edit) {
    const a = requireAdmin(req, db);
    const body = await readJson(req);
    return send(res, 200, editCharacter(db, world, a, Number(edit[1]), edit[2], body));
  }

  // ---------------------------------------------------------- roles and audit: owner only

  if (method === 'GET' && path === '/api/admin/roles') {
    requireAdmin(req, db, 'owner');
    return send(res, 200, db.listAdmins());
  }

  if (method === 'POST' && path === '/api/admin/roles') {
    const a = requireAdmin(req, db, 'owner');
    const body = await readJson(req);
    const username = str(body.username).trim();
    if (checkUsername(username)) throw new HttpError(400, 'ชื่อผู้ใช้ไม่ถูกต้อง');
    const role = body.role === 'gm' ? 'gm' : body.role === null ? null : undefined;
    if (role === undefined) throw new HttpError(400, 'ให้สิทธิ์ได้เฉพาะ GM');
    const acc = db.findAccount(username);
    if (!acc) throw new HttpError(404, 'ไม่พบบัญชีนี้ (Guest รับสิทธิ์ไม่ได้)');
    // Owners are made from the command line only, so the page can't lock the owner out or add one.
    if (db.adminRole(acc.id) === 'owner') throw new HttpError(400, 'เปลี่ยนสิทธิ์ของ owner จากหน้านี้ไม่ได้');
    db.setAdminRole(acc.id, role);
    log(db, a, role ? 'grant' : 'revoke', acc.username, role ? 'GM' : 'ถอนสิทธิ์ GM');
    return send(res, 200, db.listAdmins());
  }

  if (method === 'GET' && path === '/api/admin/audit') {
    requireAdmin(req, db, 'owner');
    const before = Number(url.searchParams.get('before'));
    return send(res, 200, db.auditLog(ADMIN_AUDIT_PAGE, Number.isSafeInteger(before) && before > 0 ? before : undefined));
  }

  if (method === 'GET' && path === '/api/admin/server') {
    requireAdmin(req, db, 'owner');
    return send(res, 200, { supervised: control.supervised, stopping: control.stopping() } satisfies AdminServerState);
  }

  if (method === 'POST' && path === '/api/admin/server') {
    const a = requireAdmin(req, db, 'owner');
    const body = await readJson(req);
    if (body.mode === 'cancel') {
      const was = control.stopping();
      const err = control.cancel(`admin page (${a.acc.username})`);
      if (err || !was) throw new HttpError(409, err ?? 'ไม่ได้นับถอยหลังอยู่');
      log(db, a, 'server', 'server', shutdownCancelled(was));
      return send(res, 200, { supervised: control.supervised, stopping: control.stopping() } satisfies AdminServerState);
    }
    const mode: ShutdownMode | null = body.mode === 'restart' ? 'restart' : body.mode === 'shutdown' ? 'shutdown' : null;
    if (!mode) throw new HttpError(400, 'เลือก รีสตาร์ท หรือ ปิด server');
    const err = control.stop(mode, `admin page (${a.acc.username})`);
    if (err) throw new HttpError(409, err);
    log(db, a, 'server', 'server', mode === 'restart' ? 'รีสตาร์ท' : 'ปิด server');
    return send(res, 200, { supervised: control.supervised, stopping: control.stopping() } satisfies AdminServerState);
  }

  throw new HttpError(404, 'ไม่พบ API นี้');
}

function editCharacter(db: Db, world: GameWorld, a: Admin, charId: number, what: string, body: Record<string, unknown>): AdminEditResult {
  const c = db.adminCharacter(charId);
  if (!c) throw new HttpError(404, 'ไม่พบตัวละครนี้');
  const target = `${c.name} (${c.guest ? 'Guest' : c.username}, #${c.id})`;
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
      const before = d.gold;
      d.gold = Math.max(0, before + delta);
      const change = d.gold - before;
      msg = `${change >= 0 ? 'ให้' : 'ลด'}ทอง ${Math.abs(change).toLocaleString()} G (เหลือ ${d.gold.toLocaleString()} G)`;
      tell = change >= 0 ? `GM ให้ทอง ${change.toLocaleString()} G` : `GM ลดทอง ${(-change).toLocaleString()} G`;
      log(db, a, 'gold', target, `${before} → ${d.gold} (${delta >= 0 ? '+' : ''}${delta})`);
      break;
    }
    case 'items': {
      const base = ITEM_BASES.find((b) => b.id === body.baseId);
      if (!base) throw new HttpError(400, 'ไม่มีไอเทมชนิดนี้');
      const rarity = RARITIES.find((r) => r === body.rarity);
      if (!rarity) throw new HttpError(400, 'ระดับความหายากไม่ถูกต้อง');
      const plus = int(body.plus ?? 0, 0, MAX_PLUS, 'ระดับตีบวก');
      if (plus > 0 && base.slot !== 'weapon') throw new HttpError(400, 'ตีบวกได้เฉพาะอาวุธ');
      const count = int(body.count ?? 1, 1, ADMIN_ITEMS_MAX, 'จำนวนชิ้น');
      const level = int(body.level ?? d.level, 1, MAX_LEVEL, 'เลเวลไอเทม');
      const free = freeSlots(d.bag);
      if (free === 0) throw new HttpError(400, 'กระเป๋าเต็ม');
      const n = Math.min(count, free);
      const classId = live ? live.cls.id : c.data.classId;
      let name = '';
      for (let k = 0; k < n; k++) {
        const item = makeItem(base.id, rarity, level, classId)!;
        if (plus > 0) item.plus = plus;
        name = item.name;
        const i = d.bag.indexOf(null);
        d.bag[i] = item;
      }
      const label = `${plus ? `+${plus} ` : ''}${name} [${RARITY_LABEL[rarity]}] Lv.${level}`;
      msg = n < count ? `ใส่ได้ ${n}/${count} ชิ้น — กระเป๋าเต็ม (${label})` : `เสกให้ ${n} ชิ้น: ${label}`;
      tell = `GM มอบไอเทม ${label} × ${n}`;
      log(db, a, 'items', target, `${label} × ${n}${n < count ? ` (ขอ ${count}, กระเป๋าเต็ม)` : ''}`);
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
      const from = zoneById(live ? live.zone : c.data.zone);
      if (from.id === zone.id) throw new HttpError(400, `อยู่ที่${zone.nameTh}อยู่แล้ว`);
      if (live) {
        world.teleportCharacter(charId, zone.id);
        world.adminChanged(charId, `GM ย้ายคุณไปที่${zone.nameTh}`);
      } else {
        c.data.zone = zone.id;
        db.saveCharacter(charId, c.data);
      }
      log(db, a, 'teleport', target, `${from.nameTh} → ${zone.nameTh}`);
      return { msg: `ย้ายไป${zone.nameTh}แล้ว`, char: charRow(db.adminCharacter(charId)!, world.livePlayer(charId)) };
    }
    default:
      throw new HttpError(404, 'ไม่พบ API นี้');
  }

  if (live) world.adminChanged(charId, tell);
  else db.saveCharacter(charId, c.data);
  return { msg, char: charRow(db.adminCharacter(charId)!, world.livePlayer(charId)) };
}
