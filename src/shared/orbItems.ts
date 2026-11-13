// Enhancement orb looks worn as a cosmetic (owner 2026-11-13): the owner or a GM makes a look on the /admin
// orb bench and presses "เพิ่มในร้านค้า"; it becomes a cosmetic of slot 'orb' that an account can own and a
// character can wear. Wearing one only changes how that character's orbs look: the orbs still come from worn
// gear at +7 or higher (src/shared/data/enhance.ts), and characters without one use the server-wide look.
//
// Unlike the other cosmetics these are not in the code: the server keeps them in the settings table, and the
// browsers get them in `welcome` / `{ t: 'orbItems' }`. registerOrbItems puts them into the cosmetic list
// (src/shared/data/cosmetics.ts), so everything else (owning, wearing, hiding, prices) works as for the rest.
// Ids and codes come from a counter that never goes down, so a deleted piece's id is never given to a new one.
import { setSlotCosmetics, type CosmeticDef } from './data/cosmetics';
import { checkOrbLook, orbLookChanges, sameOrbLook, type OrbLook } from './orbLook';

export interface OrbItem {
  /** `orb_<n>`. */
  id: string;
  n: number;
  name: string;
  look: OrbLook;
}

/** What the server stores: the pieces, and the next free number. */
export interface OrbItems {
  next: number;
  items: OrbItem[];
}

export const ORB_ITEMS_SETTING = 'orb_items';
/** Snapshot code of piece n = this + n (other cosmetics use 1–95). */
export const ORB_ITEM_CODE_BASE = 1000;
export const ORB_ITEM_MAX = 200;
export const ORB_NAME_MAX = 30;

export const orbItemId = (n: number): string => `orb_${n}`;

/** A name typed in /admin: trimmed, single spaces, 1–ORB_NAME_MAX characters, no control characters. */
export function checkOrbName(v: unknown): { name: string; error?: undefined } | { name?: undefined; error: string } {
  if (typeof v !== 'string') return { error: 'ต้องใส่ชื่อ' };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(v)) return { error: 'ชื่อมีตัวอักษรที่ใช้ไม่ได้' };
  const name = v.trim().replace(/\s+/g, ' ');
  if (!name) return { error: 'ต้องใส่ชื่อ' };
  if ([...name].length > ORB_NAME_MAX) return { error: `ชื่อยาวได้ไม่เกิน ${ORB_NAME_MAX} ตัวอักษร` };
  return { name };
}

/**
 * Checks the stored / sent list. Strict: anything wrong is an error. Lenient (reading the database or a
 * message): a bad piece is dropped and the rest kept. `next` is always above every piece's number.
 */
export function checkOrbItems(v: unknown, strict: boolean): { items: OrbItems; error?: undefined } | { items?: undefined; error: string } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return strict ? { error: 'รายการลูกแก้วไม่ถูกต้อง' } : { items: { next: 1, items: [] } };
  const o = v as Record<string, unknown>;
  let next = Number.isInteger(o.next) && (o.next as number) >= 1 ? (o.next as number) : 1;
  if (strict && next !== o.next) return { error: 'ค่า next ไม่ถูกต้อง' };
  const list = Array.isArray(o.items) ? o.items : [];
  if (strict && !Array.isArray(o.items)) return { error: 'รายการลูกแก้วไม่ถูกต้อง' };
  const items: OrbItem[] = [];
  for (const it of list) {
    const bad = (why: string) => ({ error: `ลูกแก้ว ${String((it as { id?: unknown })?.id ?? '?').slice(0, 20)}: ${why}` });
    if (!it || typeof it !== 'object') {
      if (strict) return bad('ไม่ถูกต้อง');
      continue;
    }
    const x = it as Record<string, unknown>;
    const n = x.n;
    if (!Number.isInteger(n) || (n as number) < 1 || x.id !== orbItemId(n as number) || items.some((i) => i.n === n)) {
      if (strict) return bad('รหัสไม่ถูกต้องหรือซ้ำ');
      continue;
    }
    const name = checkOrbName(x.name);
    const look = checkOrbLook(x.look);
    if (!name.name || !look.look) {
      if (strict) return bad(name.error ?? look.error ?? '');
      continue;
    }
    if (Object.keys(x).some((k) => !['id', 'n', 'name', 'look'].includes(k)) && strict) return bad('มีค่าที่ไม่รู้จัก');
    items.push({ id: x.id as string, n: n as number, name: name.name, look: look.look });
  }
  if (items.length > ORB_ITEM_MAX) {
    if (strict) return { error: `ลูกแก้วมีได้ไม่เกิน ${ORB_ITEM_MAX} ชิ้น` };
    items.length = ORB_ITEM_MAX;
  }
  const top = Math.max(0, ...items.map((i) => i.n));
  if (next <= top) {
    if (strict) return { error: 'ค่า next ต้องมากกว่ารหัสทุกชิ้น' };
    next = top + 1;
  }
  return { items: { next, items } };
}

/** The cosmetic entry of a piece (its colours are drawn by the browser from its look). */
export const orbItemDef = (it: OrbItem): CosmeticDef => ({
  id: it.id, code: ORB_ITEM_CODE_BASE + it.n, slot: 'orb', name: it.name,
  desc: 'เปลี่ยนหน้าตาลูกแก้วตีบวกของคุณ (ลูกแก้วมาจากของที่สวมอยู่ +7 ขึ้นไป)', color: '#9ad0ff', color2: '#c56dff',
});

let registered: readonly OrbItem[] = [];
const looks = new Map<string, OrbLook>();
let version = 0;

/** Puts the pieces into the cosmetic list (replacing the previous ones) and keeps their looks. */
export function registerOrbItems(items: readonly OrbItem[]): void {
  registered = items.map((i) => ({ ...i, look: { ...i.look } }));
  looks.clear();
  for (const i of registered) looks.set(i.id, i.look);
  setSlotCosmetics('orb', registered.map(orbItemDef));
  version++;
}

/** The look of a registered piece (undefined for any other id). */
export const orbItemLook = (id: string | undefined): OrbLook | undefined => (id ? looks.get(id) : undefined);
export const orbItemsRegistered = (): readonly OrbItem[] => registered;
/** Bumped by every registerOrbItems (for redrawing). */
export const orbItemsVersion = (): number => version;

/** Audit text of what differs (e.g. `orb_3: ชื่อ "ก" → "ข", scale 0.8 → 1`). */
export function orbItemsChanges(before: OrbItems, after: OrbItems): string {
  const out: string[] = [];
  const old = new Map(before.items.map((i) => [i.id, i]));
  for (const b of after.items) {
    const a = old.get(b.id);
    if (!a) {
      out.push(`เพิ่ม ${b.id} "${b.name}"`);
      continue;
    }
    const d: string[] = [];
    if (a.name !== b.name) d.push(`ชื่อ "${a.name}" → "${b.name}"`);
    if (!sameOrbLook(a.look, b.look)) d.push(orbLookChanges(a.look, b.look));
    if (d.length) out.push(`${b.id}: ${d.join(', ')}`);
  }
  for (const a of before.items) if (!after.items.some((b) => b.id === a.id)) out.push(`ลบ ${a.id} "${a.name}"`);
  return out.join(' · ');
}
