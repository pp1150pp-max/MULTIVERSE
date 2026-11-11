// Editing or deleting one item a player has, from the account sheet of the admin page (tool `itemEdit`).
// The page names the place (worn slot / bag slot of a character, or a stash slot of an account) and what
// it saw there; the server checks the slot still holds that, checks every value, and writes it into the
// live character / live stash when online (saved at once, the player is not told: owner 2026-11-11) or
// into the save when offline. Every change goes to the audit log with the item before and after.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db';
import type { GameWorld } from './world';
import { HttpError, readJson, send } from './http';
import { int, log, mayTouch, requireFeature } from './admin';
import { describeEntry, editGear, entrySig, type AdminItemPlace } from '../src/shared/admin';
import { BAG_SIZE } from '../src/shared/sim/Player';
import { itemClass } from '../src/shared/data/items';
import { CLASSES } from '../src/shared/data/classes';
import { stackLimit } from '../src/shared/data/potions';
import { EQUIP_SLOTS, EQUIP_SLOT_LABEL, isStack, SLOT_LABEL, wornPlaces, type BagEntry, type ClassId, type EquipSlot, type Item } from '../src/shared/types';

const PLACES: AdminItemPlace[] = ['equip', 'bag', 'stash'];
const SCOPE = 'แก้ไอเทมของ owner หรือทีมงานคนอื่นไม่ได้';
const MOVED = 'ของในช่องนี้เปลี่ยนไปแล้ว (ผู้เล่นอาจย้ายของ) — โหลดหน้าใหม่แล้วลองอีกครั้ง';

/** Handles POST /api/admin/items; returns false for any other path. */
export async function itemsAdminApi(req: IncomingMessage, res: ServerResponse, path: string, method: string, db: Db, world: GameWorld): Promise<boolean> {
  if (method !== 'POST' || path !== '/api/admin/items') return false;
  const a = requireFeature(req, db, 'itemEdit');
  const body = await readJson(req);
  const place = PLACES.find((p) => p === body.place);
  if (!place) throw new HttpError(400, 'ตำแหน่งไอเทมไม่ถูกต้อง');
  const op = body.op === 'save' || body.op === 'delete' ? body.op : null;
  if (!op) throw new HttpError(400, 'คำสั่งไม่ถูกต้อง');

  /** The slot being edited: read it, write it, and what to do once it changed. */
  let get: () => BagEntry | null | undefined;
  let put: (e: BagEntry | null) => void;
  let done: () => void;
  let target: string;
  let where: string;
  /** The wearer, for a worn item (it must still fit them after the edit). */
  let wearer: { slot: EquipSlot; cls: ClassId; level: number } | null = null;

  if (place === 'stash') {
    const accountId = int(body.accountId, 1, Number.MAX_SAFE_INTEGER, 'รหัสบัญชี');
    const acc = db.accountName(accountId);
    if (!acc) throw new HttpError(404, 'ไม่พบบัญชีนี้');
    if (acc.guest) throw new HttpError(400, 'Guest ไม่มีคลัง');
    if (mayTouch(db, a, accountId) !== 'ok') throw new HttpError(403, SCOPE);
    // Online: the live stash every character of the account shares (a DB write would be overwritten).
    const live = world.liveStash(accountId);
    const stash = live ?? db.savedStash(accountId);
    if (!stash) throw new HttpError(400, 'บัญชีนี้ยังไม่เคยใช้คลัง');
    const i = int(body.key, 0, stash.size - 1, 'ช่องคลัง');
    get = () => stash.items[i];
    put = (e) => (stash.items[i] = e);
    done = () => {
      if (!live || !world.adminStashSaved(accountId)) db.saveStash(accountId, stash);
    };
    target = `คลังของ ${acc.username} (#${accountId})`;
    where = `คลังช่อง ${i + 1}`;
  } else {
    const charId = int(body.charId, 1, Number.MAX_SAFE_INTEGER, 'รหัสตัวละคร');
    const c = db.adminCharacter(charId);
    if (!c) throw new HttpError(404, 'ไม่พบตัวละครนี้');
    if (!c.guest && mayTouch(db, a, c.accountId) !== 'ok') throw new HttpError(403, SCOPE);
    // Online: the live character (its next save would overwrite a DB edit). All of this runs synchronously.
    const live = world.livePlayer(charId);
    if (!live) c.data.bag = Array.from({ length: BAG_SIZE }, (_, i) => c.data.bag[i] ?? null);
    const d = live ?? c.data;
    if (place === 'bag') {
      const i = int(body.key, 0, BAG_SIZE - 1, 'ช่องกระเป๋า');
      get = () => d.bag[i];
      put = (e) => (d.bag[i] = e);
      where = `กระเป๋าช่อง ${i + 1}`;
    } else {
      const slot = EQUIP_SLOTS.find((s) => s === body.key);
      if (!slot) throw new HttpError(400, 'ช่องสวมใส่ไม่ถูกต้อง');
      get = () => d.equipment[slot];
      put = (e) => {
        if (e) d.equipment[slot] = e as Item;
        else delete d.equipment[slot];
      };
      wearer = { slot, cls: live ? live.cls.id : c.data.classId, level: d.level };
      where = `สวมใส่ช่อง${EQUIP_SLOT_LABEL[slot]}`;
    }
    done = () => {
      // Worn gear sets the stats (and the aura / orbs, which follow the snapshot).
      if (live && place === 'equip') live.recompute();
      if (live) world.adminSaved(charId);
      else db.saveCharacter(charId, c.data);
    };
    target = `${c.name} (${c.guest ? 'Guest' : c.username}, #${c.id})`;
  }

  const before = get();
  if (!before) throw new HttpError(409, MOVED);
  if (typeof body.sig !== 'string' || entrySig(before) !== body.sig) throw new HttpError(409, MOVED);

  if (op === 'delete') {
    put(null);
    done();
    log(db, a, 'item-delete', target, `${where} · ${describeEntry(before)}`);
    send(res, 200, { msg: `ลบ ${describeEntry(before).split(' · ')[0]} แล้ว` });
    return true;
  }

  let after: BagEntry;
  if (isStack(before)) {
    const count = int(body.count, 1, stackLimit(before), 'จำนวน');
    after = { ...before, count };
  } else {
    const item = editGear(before, body);
    if (typeof item === 'string') throw new HttpError(400, item);
    if (wearer) {
      if (!wornPlaces(item.slot).includes(wearer.slot)) throw new HttpError(400, `ของที่สวมอยู่เปลี่ยนเป็น${SLOT_LABEL[item.slot]}ไม่ได้ (ต้องเป็นของช่อง${EQUIP_SLOT_LABEL[wearer.slot]})`);
      const ic = itemClass(item);
      if (ic && ic !== wearer.cls) throw new HttpError(400, `ของที่สวมอยู่ต้องเป็นของสาย ${CLASSES[wearer.cls].nameTh}`);
      if (item.level > wearer.level) throw new HttpError(400, `ของที่สวมอยู่ต้องไม่เกินเลเวลตัวละคร (Lv.${wearer.level})`);
    }
    after = item;
  }
  if (JSON.stringify(after) === JSON.stringify(before)) throw new HttpError(400, 'ไม่มีอะไรเปลี่ยน');
  put(after);
  done();
  log(db, a, 'item-edit', target, `${where} · ${describeEntry(before)} → ${describeEntry(after)}`);
  send(res, 200, { msg: `บันทึกแล้ว: ${describeEntry(after).split(' · ')[0]}` });
  return true;
}
