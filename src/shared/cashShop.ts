// The cash shop (แคชช็อป, owner 2026-11-15, docs/systems/cash-shop.md): things bought with the top-up
// currency "คริสตัลมิติ" (crystals), kept per account, topped up by PromptPay (src/shared/topup.ts). Until the owner presses
// "เปิดขาย" in /admin players can only look.
//
// What is sold: cosmetics (their price is the one set on the "จัดการของแต่งตัว" tab, src/shared/cosShop.ts,
// hidden or unpriced pieces are not sold) and seven stone-stack kinds (CASH_STONES, mailed to the account).
// Saved as overrides only (settings key `cash_shop`): no row = closed, the code prices, no packages, so an
// old database needs nothing. Pure data and checks, used by browser and server.
import { COSMETICS, cosById } from './data/cosmetics';
import { cosPrice, type CosShop } from './cosShop';
import { STONE_NAME } from './data/stones';
import type { StoneKind } from './types';
import type { OrbItem } from './orbItems';

export const CASH_SETTING = 'cash_shop';
export const CURRENCY = 'คริสตัลมิติ';

/** The stone-stack kinds on sale, in shop order. */
export const CASH_STONES = ['exp_scroll', 'drop_scroll', 'megaphone', 'enhance', 'protect', 'reroll_values', 'reroll_stat'] as const satisfies readonly StoneKind[];
export type CashStone = (typeof CASH_STONES)[number];
/** Owner 2026-11-15 ("ชุด ก"): crystals per one. */
export const CASH_STONE_PRICE: Record<CashStone, number> = {
  exp_scroll: 50, drop_scroll: 50, megaphone: 30, enhance: 100, protect: 150, reroll_values: 80, reroll_stat: 80,
};
const isCashStone = (k: string): k is CashStone => (CASH_STONES as readonly string[]).includes(k);

export const CASH_PRICE_MIN = 1;
export const CASH_PRICE_MAX = 1_000_000;
export const CASH_LIMIT_MAX = 9_999;
/** Stones per purchase (one mail holds up to 10 pieces). */
export const CASH_QTY_MAX = 10;
export const CASH_PACKAGES_MAX = 20;
export const CASH_BAHT_MAX = 1_000_000;

export type CashBadge = 'new' | 'hot';
export const CASH_BADGE_NAME: Record<CashBadge | 'sale', string> = { new: 'ใหม่', hot: 'ขายดี', sale: 'ลดราคา' };

/** One item's settings, only what differs from the default (on sale, code price, no limit, any time). */
export interface CashItemCfg {
  off?: true;
  /** Stones only (a cosmetic's price is its cos_shop price). */
  price?: number;
  /** Sale price, below the full price. */
  sale?: number;
  /** Or a sale in percent off the full price (1–99; owner 2026-11-22), never both. Follows the full price when it changes. */
  pct?: number;
  /** Most one account may ever buy (stones; a cosmetic is always once). */
  limit?: number;
  /** On sale from / until (ms since 1970; the admin page types Thai time). */
  start?: number;
  end?: number;
  badge?: CashBadge;
  /** Listed under "แนะนำ". */
  featured?: true;
}

/**
 * A top-up package: what a PromptPay top-up gives for its baht (src/shared/topup.ts). `first` = extra
 * crystals the first time an account tops up with this package (owner 2026-11-22; a package is known by
 * its baht + crystals, `packageKey`).
 */
export interface CashPackage { crystals: number; bonus: number; baht: number; first?: number }

/** Which package a top-up was (changing a package's baht or crystals makes it a new one for "ครั้งแรก"). */
export const packageKey = (p: { baht: number; crystals: number }): string => `${p.baht}:${p.crystals}`;

/** Sale price for `pct` percent off `full` (rounded down, at least 1, below the full price). */
export const pctPrice = (full: number, pct: number): number => Math.max(1, Math.min(full - 1, Math.floor((full * (100 - pct)) / 100)));

export interface CashShopCfg {
  /** Players may buy (otherwise look only). */
  open: boolean;
  /** Item id (`cos:<id>` / `stone:<kind>`) → its settings. */
  items: Record<string, CashItemCfg>;
  packages: CashPackage[];
}

export const emptyCashShop = (): CashShopCfg => ({ open: false, items: {}, packages: [] });

export const cosItemId = (id: string): string => `cos:${id}`;
export const stoneItemId = (k: CashStone): string => `stone:${k}`;

/** Every item id the shop knows now (cosmetics change while the server runs: orb looks). */
export function cashItemIds(): string[] {
  return [...COSMETICS.map((c) => cosItemId(c.id)), ...CASH_STONES.map(stoneItemId)];
}

/** What an id is, or null if unknown. */
export function cashRef(id: string): { kind: 'cos'; ref: string } | { kind: 'stone'; ref: CashStone } | null {
  if (id.startsWith('cos:')) return cosById(id.slice(4)) ? { kind: 'cos', ref: id.slice(4) } : null;
  if (id.startsWith('stone:') && isCashStone(id.slice(6))) return { kind: 'stone', ref: id.slice(6) as CashStone };
  return null;
}

export function cashItemName(id: string): string {
  const r = cashRef(id);
  if (!r) return id;
  return r.kind === 'cos' ? cosById(r.ref)!.name : STONE_NAME[r.ref];
}

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const TIME_MIN = Date.UTC(2020, 0, 1);
const TIME_MAX = Date.UTC(2100, 0, 1);

type Check<T> = { value: T; error?: undefined } | { value?: undefined; error: string };

/**
 * Checks shop settings sent by /admin (`strict`: anything unknown or wrong is an error) or read from the
 * database (lenient: such parts are dropped, the rest kept). Defaults are left out; items in shop order.
 * `cosShop` gives cosmetic prices, so a sale can be checked against them.
 */
export function checkCashShop(v: unknown, strict: boolean, cosShop: CosShop): Check<CashShopCfg> {
  const out = emptyCashShop();
  if (!v || typeof v !== 'object' || Array.isArray(v)) return strict ? { error: 'ค่าแคชช็อปไม่ถูกต้อง' } : { value: out };
  const o = v as Record<string, unknown>;
  if (strict) {
    const extra = Object.keys(o).find((k) => !['open', 'items', 'packages'].includes(k));
    if (extra) return { error: `ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  if (o.open !== undefined) {
    if (typeof o.open !== 'boolean') {
      if (strict) return { error: 'เปิดขายต้องเป็น true/false' };
    } else out.open = o.open;
  }
  const items = o.items && typeof o.items === 'object' && !Array.isArray(o.items) ? (o.items as Record<string, unknown>) : {};
  if (strict && o.items !== undefined && items !== o.items) return { error: 'รายการสินค้าไม่ถูกต้อง' };
  if (strict) {
    const unknown = Object.keys(items).find((id) => !cashRef(id));
    if (unknown) return { error: `ไม่รู้จักสินค้า ${unknown.slice(0, 40)}` };
  }
  for (const id of cashItemIds()) {
    if (items[id] === undefined) continue;
    const c = checkCashItem(id, items[id], strict, cosShop);
    if (c.error !== undefined) return { error: c.error };
    if (Object.keys(c.value).length) out.items[id] = c.value;
  }
  const pk = Array.isArray(o.packages) ? o.packages : [];
  if (strict && o.packages !== undefined && !Array.isArray(o.packages)) return { error: 'แพ็กเกจไม่ถูกต้อง' };
  if (strict && pk.length > CASH_PACKAGES_MAX) return { error: `แพ็กเกจมีได้ไม่เกิน ${CASH_PACKAGES_MAX} แบบ` };
  for (const [i, p] of pk.slice(0, CASH_PACKAGES_MAX).entries()) {
    const x = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    const first = x.first === undefined || x.first === null ? 0 : x.first;
    if (isInt(x.crystals, 1, CASH_PRICE_MAX) && isInt(x.bonus, 0, CASH_PRICE_MAX) && isInt(x.baht, 1, CASH_BAHT_MAX) && isInt(first, 0, CASH_PRICE_MAX)
      && !(strict && Object.keys(x).some((k) => !['crystals', 'bonus', 'baht', 'first'].includes(k)))) {
      if (strict && out.packages.some((q) => packageKey(q) === packageKey({ baht: x.baht as number, crystals: x.crystals as number }))) {
        return { error: `แพ็กเกจที่ ${i + 1}: ราคาและจำนวนคริสตัลซ้ำกับแพ็กอื่น` };
      }
      out.packages.push({ crystals: x.crystals, bonus: x.bonus, baht: x.baht, ...(first ? { first } : {}) });
    } else if (strict) {
      return { error: `แพ็กเกจที่ ${i + 1}: คริสตัล 1–${CASH_PRICE_MAX.toLocaleString('en-US')} โบนัส/ครั้งแรก 0 ขึ้นไป ราคา 1–${CASH_BAHT_MAX.toLocaleString('en-US')} บาท (จำนวนเต็ม)` };
    }
  }
  return { value: out };
}

function checkCashItem(id: string, v: unknown, strict: boolean, cosShop: CosShop): Check<CashItemCfg> {
  const name = cashItemName(id);
  const bad = (why: string): Check<CashItemCfg> => (strict ? { error: `${name}: ${why}` } : { value: {} });
  if (!v || typeof v !== 'object' || Array.isArray(v)) return bad('ค่าไม่ถูกต้อง');
  const g = v as Record<string, unknown>;
  const ref = cashRef(id)!;
  const keys = ['off', 'price', 'sale', 'pct', 'limit', 'start', 'end', 'badge', 'featured'];
  if (strict) {
    const extra = Object.keys(g).find((k) => !keys.includes(k));
    if (extra) return bad(`ไม่รู้จักค่า "${extra.slice(0, 20)}"`);
  }
  const e: CashItemCfg = {};
  const opt = (k: string): unknown => (g[k] === null ? undefined : g[k]);
  // Each field: a wrong value is an error when strict, else dropped (the other fields stay).
  if (opt('off') !== undefined) {
    if (typeof g.off !== 'boolean') { if (strict) return bad('ค่าเปิด/ปิดต้องเป็น true/false'); } else if (g.off) e.off = true;
  }
  if (opt('price') !== undefined) {
    if (ref.kind === 'cos') { if (strict) return bad('ราคาของแต่งตัวตั้งในแท็บ "จัดการของแต่งตัว"'); }
    else if (!isInt(g.price, CASH_PRICE_MIN, CASH_PRICE_MAX)) { if (strict) return bad(`ราคาต้องเป็นจำนวนเต็ม ${CASH_PRICE_MIN}–${CASH_PRICE_MAX.toLocaleString('en-US')}`); }
    else if (g.price !== CASH_STONE_PRICE[ref.ref]) e.price = g.price;
  }
  if (opt('limit') !== undefined) {
    if (ref.kind === 'cos') { if (strict) return bad('ของแต่งตัวซื้อได้ครั้งเดียวต่อบัญชีอยู่แล้ว'); }
    else if (!isInt(g.limit, 1, CASH_LIMIT_MAX)) { if (strict) return bad(`จำกัดต่อบัญชีต้องเป็น 1–${CASH_LIMIT_MAX.toLocaleString('en-US')} หรือเว้นว่าง`); }
    else e.limit = g.limit;
  }
  if (opt('sale') !== undefined) {
    const full = ref.kind === 'cos' ? cosPrice(cosShop, ref.ref) : (e.price ?? CASH_STONE_PRICE[ref.ref]);
    if (!isInt(g.sale, CASH_PRICE_MIN, CASH_PRICE_MAX)) { if (strict) return bad('ราคาลดต้องเป็นจำนวนเต็มตั้งแต่ 1'); }
    else if (full === undefined) { if (strict) return bad('ยังไม่มีราคาเต็ม ตั้งราคาลดไม่ได้'); }
    else if (g.sale >= full) { if (strict) return bad(`ราคาลดต้องน้อยกว่าราคาเต็ม (${full})`); }
    else e.sale = g.sale;
  }
  if (opt('pct') !== undefined) {
    const full = ref.kind === 'cos' ? cosPrice(cosShop, ref.ref) : (e.price ?? CASH_STONE_PRICE[ref.ref]);
    if (!isInt(g.pct, 1, 99)) { if (strict) return bad('ลด % ต้องเป็นจำนวนเต็ม 1–99'); }
    else if (e.sale !== undefined) { if (strict) return bad('ใส่ราคาลดได้แบบเดียว (ราคา หรือ %)'); }
    else if (full === undefined) { if (strict) return bad('ยังไม่มีราคาเต็ม ตั้งราคาลดไม่ได้'); }
    else if (full < 2) { if (strict) return bad('ราคาเต็ม 1 ลดไม่ได้'); }
    else e.pct = g.pct;
  }
  for (const k of ['start', 'end'] as const) {
    if (opt(k) === undefined) continue;
    if (!isInt(g[k], TIME_MIN, TIME_MAX)) { if (strict) return bad('เวลาไม่ถูกต้อง'); }
    else e[k] = g[k] as number;
  }
  if (e.start !== undefined && e.end !== undefined && e.end <= e.start) {
    if (strict) return bad('เวลาจบต้องหลังเวลาเริ่ม');
    delete e.end;
  }
  if (opt('badge') !== undefined) {
    if (g.badge !== 'new' && g.badge !== 'hot') { if (strict) return bad('ป้ายไม่ถูกต้อง'); }
    else e.badge = g.badge;
  }
  if (opt('featured') !== undefined) {
    if (typeof g.featured !== 'boolean') { if (strict) return bad('ค่าแนะนำต้องเป็น true/false'); } else if (g.featured) e.featured = true;
  }
  return { value: e };
}

export function sameCashShop(a: CashShopCfg, b: CashShopCfg): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** What a player sees of one item. */
export interface CashEntry {
  id: string;
  kind: 'cos' | 'stone';
  /** Cosmetic id or stone kind. */
  ref: string;
  /** Full price, and the price now (the sale price, or the full one). */
  price: number;
  now: number;
  /** The sale was set in percent (shown as "-20%"). */
  pct?: number;
  /** Most one account may buy (cosmetics: 1). */
  limit?: number;
  start?: number;
  end?: number;
  badge?: CashBadge;
  featured: boolean;
  /** An orb that comes only from the mystery box now (owner 2026-11-22): listed to look at, shows "เปิดได้จากกล่องปริศนา", can't be bought. */
  fromBox?: true;
}

/** What players are sent: the items on sale or coming (not ended), and the packages. */
export interface CashCatalog { open: boolean; items: CashEntry[]; packages: CashPackage[] }

/**
 * The catalogue at time `now`: switched-off items, ended ones, and cosmetics that are hidden, gone or have
 * no price are left out. Items that start later are listed with `start` (shown once it comes; the server
 * checks the time again when buying).
 */
export function cashCatalog(cfg: CashShopCfg, cosShop: CosShop, now: number, orbsFromBox = false): CashCatalog {
  const items: CashEntry[] = [];
  for (const id of cashItemIds()) {
    const c = cfg.items[id] ?? {};
    if (c.off || (c.end !== undefined && c.end <= now)) continue;
    const r = cashRef(id)!;
    let price: number | undefined;
    let limit = c.limit;
    if (r.kind === 'cos') {
      if (cosShop[r.ref]?.hidden) continue;
      // Orbs come from the mystery box instead (src/shared/mysteryBox.ts): shown without a price, never sold.
      if (orbsFromBox && cosById(r.ref)?.slot === 'orb') {
        items.push({ id, kind: 'cos', ref: r.ref, price: 0, now: 0, limit: 1, ...(c.badge ? { badge: c.badge } : {}), featured: !!c.featured, fromBox: true });
        continue;
      }
      price = cosPrice(cosShop, r.ref);
      limit = 1;
    } else price = c.price ?? CASH_STONE_PRICE[r.ref];
    if (price === undefined) continue;
    const pct = c.pct !== undefined && price >= 2 ? c.pct : undefined;
    const sale = pct !== undefined ? pctPrice(price, pct) : c.sale !== undefined && c.sale < price ? c.sale : undefined;
    items.push({
      id, kind: r.kind, ref: r.ref, price, now: sale ?? price, ...(pct !== undefined ? { pct } : {}),
      ...(limit !== undefined ? { limit } : {}), ...(c.start !== undefined && c.start > now ? { start: c.start } : {}),
      ...(c.end !== undefined ? { end: c.end } : {}), ...(c.badge ? { badge: c.badge } : {}), featured: !!c.featured,
    });
  }
  return { open: cfg.open, items, packages: cfg.packages.map((p) => ({ ...p })) };
}

/** The badge on an item's card: the owner's, or "ลดราคา" for a sale. */
export const cashBadge = (e: CashEntry): CashBadge | 'sale' | null => e.badge ?? (e.now < e.price ? 'sale' : null);

/** What a buyer has: crystals, and how many of each limited item the account bought. */
export interface CashState { crystals: number; bought: Record<string, number> }

/**
 * Why a purchase can't go ahead, or null. The server asks this with its own catalogue and the account's
 * numbers; the browser asks it to grey the button. `price` = the price per piece the buyer saw.
 */
export function cashBuyError(
  cat: CashCatalog, id: unknown, qty: unknown, price: unknown, st: CashState, owned: readonly string[], guest: boolean, now: number,
): string | null {
  if (guest) return 'Guest ซื้อของในแคชช็อปไม่ได้ สมัครสมาชิกก่อน';
  if (!cat.open) return 'แคชช็อปยังไม่เปิดขาย';
  const e = typeof id === 'string' ? cat.items.find((i) => i.id === id) : undefined;
  if (!e) return 'สินค้านี้ไม่มีขายแล้ว';
  if (e.start !== undefined && e.start > now) return 'สินค้านี้ยังไม่เริ่มขาย';
  if (e.end !== undefined && e.end <= now) return 'สินค้านี้หมดเวลาขายแล้ว';
  if (e.fromBox) return 'ลูกแก้วนี้เปิดได้จากกล่องปริศนาเท่านั้น';
  const maxQty = e.kind === 'cos' ? 1 : CASH_QTY_MAX;
  if (!isInt(qty, 1, maxQty)) return `ซื้อได้ครั้งละ 1–${maxQty} ชิ้น`;
  if (price !== e.now) return 'ราคาเปลี่ยนแล้ว เปิดดูใหม่อีกครั้ง';
  if (e.kind === 'cos' && owned.includes(e.ref)) return 'มีของแต่งตัวชิ้นนี้แล้ว';
  if (e.limit !== undefined && (st.bought[e.id] ?? 0) + qty > e.limit) {
    const left = Math.max(0, e.limit - (st.bought[e.id] ?? 0));
    return left ? `ซื้อได้อีก ${left} ชิ้น` : 'ซื้อครบจำนวนที่จำกัดแล้ว';
  }
  if (st.crystals < e.now * qty) return `${CURRENCY}ไม่พอ`;
  return null;
}

/** Short text of what differs, for the audit log. */
export function cashShopChanges(before: CashShopCfg, after: CashShopCfg): string {
  const out: string[] = [];
  if (before.open !== after.open) out.push(after.open ? 'เปิดขาย' : 'ปิดขาย');
  const show = (c: CashItemCfg | undefined) => JSON.stringify(c ?? {});
  for (const id of cashItemIds()) {
    if (show(before.items[id]) !== show(after.items[id])) out.push(`${id}: ${show(before.items[id])} → ${show(after.items[id])}`);
  }
  if (JSON.stringify(before.packages) !== JSON.stringify(after.packages)) {
    out.push(`แพ็กเกจ: ${after.packages.map((p) => `${p.crystals}+${p.bonus}${p.first ? ` (ครั้งแรก+${p.first})` : ''}=${p.baht}฿`).join(' ') || 'ไม่มี'}`);
  }
  return out.join(', ');
}

/** One purchase in the /admin history. `price` = crystals per piece. */
export interface CashPurchaseRow { id: number; accountId: number; username: string; charName: string; item: string; qty: number; price: number; at: number }

/** GET/POST /api/admin/cash-shop. */
export interface AdminCashShop {
  cfg: CashShopCfg;
  /** Cosmetic shop settings (hidden / price), whose prices the cosmetics sell at. */
  cosShop: CosShop;
  /** May save (the `cashShopEdit` switch). */
  canEdit: boolean;
  recent: CashPurchaseRow[];
  /** The orb looks (cosmetics made in /admin), so the page lists them like the rest. */
  orbs: OrbItem[];
}
