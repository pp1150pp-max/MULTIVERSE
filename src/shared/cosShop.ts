// Per-cosmetic shop settings the owner sets in the /admin "จัดการของแต่งตัว" tab (owner 2026-11-13):
// - hidden: not in the in-game "แต่งตัว" window and can't be put on again. Whoever wears it keeps it
//   (and others still see it); it shows under "ของฉัน" only while worn, so it can be taken off.
// - price in diamonds (เพชร): stored and shown in /admin only. There is no diamond currency and no buying
//   yet; a later shop reads `cosPrice`. Players are never sent prices.
//
// Saved as overrides only (settings key `cos_shop`, cosmetic id → what differs from the code), like
// cos_tuning: the code default is "shown, no price", so an old database with nothing saved shows every
// piece and a cosmetic added later starts shown. Pure data and checks, used by browser and server.
import { COSMETICS, cosById } from './data/cosmetics';

export interface CosShopEntry {
  /** Hidden from the cosmetics window (absent = shown). */
  hidden?: true;
  /** Price in diamonds, a whole number COS_PRICE_MIN–COS_PRICE_MAX (absent = no price set). */
  price?: number;
}

/** Saved server-wide shop settings: cosmetic id → only what differs from the code (shown, no price). */
export type CosShop = Record<string, CosShopEntry>;

/** Key in the server's settings table. */
export const COS_SHOP_SETTING = 'cos_shop';

/** Owner 2026-11-13: a whole number of diamonds 1–1,000,000; no price = not set (there is no "0 = free"). */
export const COS_PRICE_MIN = 1;
export const COS_PRICE_MAX = 1_000_000;

/**
 * Checks shop settings sent by a browser (`strict`: anything unknown or wrong is an error) or read back from
 * the database (not strict: such entries are dropped, the rest kept). Entries equal to the code default are
 * left out and the result is in catalogue order (two equal settings give the same JSON).
 */
export function checkCosShop(v: unknown, strict: boolean): { shop: CosShop; error?: undefined } | { shop?: undefined; error: string } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return strict ? { error: 'ค่าร้านของแต่งตัวไม่ถูกต้อง' } : { shop: {} };
  const o = v as Record<string, unknown>;
  if (strict) {
    const bad = Object.keys(o).find((id) => !cosById(id));
    if (bad) return { error: `ไม่มีของแต่งตัว "${bad.slice(0, 30)}"` };
  }
  const out: CosShop = {};
  for (const c of COSMETICS) {
    const given = o[c.id];
    if (given === undefined) continue;
    if (!given || typeof given !== 'object' || Array.isArray(given)) {
      if (strict) return { error: `ค่าของ ${c.id} ไม่ถูกต้อง` };
      continue;
    }
    const g = given as Record<string, unknown>;
    if (strict) {
      const extra = Object.keys(g).find((k) => k !== 'hidden' && k !== 'price');
      if (extra) return { error: `${c.id}: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
    }
    const e: CosShopEntry = {};
    if (g.hidden !== undefined) {
      if (typeof g.hidden !== 'boolean') {
        if (strict) return { error: `${c.id}: ค่าซ่อนต้องเป็น true/false` };
      } else if (g.hidden) e.hidden = true;
    }
    if (g.price !== undefined && g.price !== null) {
      const p = g.price;
      if (typeof p !== 'number' || !Number.isInteger(p) || p < COS_PRICE_MIN || p > COS_PRICE_MAX) {
        if (strict) return { error: `${c.id}: ราคาต้องเป็นจำนวนเต็ม ${COS_PRICE_MIN}–${COS_PRICE_MAX.toLocaleString('en-US')} เพชร` };
      } else e.price = p;
    }
    if (e.hidden || e.price !== undefined) out[c.id] = e;
  }
  return { shop: out };
}

/** Same settings? (both already clean, as checkCosShop returns them) */
export function sameCosShop(a: CosShop, b: CosShop): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The ids hidden from the cosmetics window, catalogue order (what browsers are sent; never prices). */
export function cosHiddenIds(shop: CosShop): string[] {
  return COSMETICS.filter((c) => shop[c.id]?.hidden).map((c) => c.id);
}

/** A cosmetic's price in diamonds, or undefined when none is set. For the shop to come. */
export function cosPrice(shop: CosShop, id: string): number | undefined {
  return shop[id]?.price;
}

/**
 * May a character put on `id`? Hidden pieces can't be put on (again); the one already worn stays (taking
 * it off is always allowed and handled by the caller). Ownership is checked separately by the server.
 */
export function mayPutOnCos(id: string, wornInSlot: string | undefined, hidden: ReadonlySet<string>): boolean {
  return wornInSlot === id || !hidden.has(id);
}

/** Short text of what differs, for the audit log (e.g. "wings_bat: ซ่อน, pet_cat: ราคา — → 500 เพชร"). */
export function cosShopChanges(before: CosShop, after: CosShop): string {
  const out: string[] = [];
  const price = (n: number | undefined) => (n === undefined ? '—' : `${n}`);
  for (const c of COSMETICS) {
    const a = before[c.id] ?? {};
    const b = after[c.id] ?? {};
    const parts: string[] = [];
    if (!!a.hidden !== !!b.hidden) parts.push(b.hidden ? 'ซ่อน' : 'แสดง');
    if (a.price !== b.price) parts.push(`ราคา ${price(a.price)} → ${price(b.price)} เพชร`);
    if (parts.length) out.push(`${c.id}: ${parts.join(' ')}`);
  }
  return out.join(', ');
}
