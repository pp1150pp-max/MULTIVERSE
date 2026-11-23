import { isItem, type BagEntry } from './types';

/**
 * The bag is split in two tabs (owner 2026-11-23): "กระเป๋า" holds gear only, "ประเภทใช้งาน" everything that
 * stacks (potions, stones, keys, feathers, scrolls, mystery boxes, orb items). Both live in the one `bag` array,
 * gear first: slots [0, gear) are the gear tab and [gear, gear + use) the usable tab, so a slot index still names
 * one bag slot everywhere (drag, trade, market, stash, chat links). No DOM, no three.
 */
export type BagTab = 'gear' | 'use';
export const BAG_TABS: BagTab[] = ['gear', 'use'];

/** Slots in each tab. Saved per character (CharacterData.bagSlots). */
export interface BagSlots {
  gear: number;
  use: number;
}

/** Slots each tab starts with. */
export const BAG_TAB_START = 30;
/** Hard bounds for a tab's size, whatever /admin says (the expansion step and top live in BagExpandCfg). */
export const BAG_TAB_MIN = 30;
export const BAG_TAB_LIMIT = 200;

export const defaultBagSlots = (): BagSlots => ({ gear: BAG_TAB_START, use: BAG_TAB_START });

/** A save's slot counts, kept to whole numbers in BAG_TAB_MIN..BAG_TAB_LIMIT. Missing = null (an old save). */
export function cleanBagSlots(v: unknown): BagSlots | null {
  if (!v || typeof v !== 'object') return null;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(BAG_TAB_MIN, Math.min(BAG_TAB_LIMIT, Math.floor(x))) : BAG_TAB_START);
  const o = v as Record<string, unknown>;
  return { gear: n(o.gear), use: n(o.use) };
}

/** The tab an entry belongs in: gear → "กระเป๋า", anything that stacks → "ประเภทใช้งาน". */
export const tabOf = (e: BagEntry): BagTab => (isItem(e) ? 'gear' : 'use');

export const bagTotal = (s: BagSlots): number => s.gear + s.use;

/** Slot indexes [start, end) of a tab. */
export function tabRange(s: BagSlots, tab: BagTab): [number, number] {
  return tab === 'gear' ? [0, s.gear] : [s.gear, s.gear + s.use];
}

/** The tab slot `i` is in, or null when it is past the bag. */
export function tabAt(s: BagSlots, i: number): BagTab | null {
  if (!Number.isInteger(i) || i < 0) return null;
  if (i < s.gear) return 'gear';
  if (i < s.gear + s.use) return 'use';
  return null;
}

/** Whether `e` may sit in slot `i`. */
export const fitsAt = (s: BagSlots, i: number, e: BagEntry): boolean => tabAt(s, i) === tabOf(e);

/** The first empty slot of a tab, or -1. */
export function freeSlot(bag: readonly (BagEntry | null)[], s: BagSlots, tab: BagTab): number {
  const [a, b] = tabRange(s, tab);
  for (let i = a; i < b; i++) if (!bag[i]) return i;
  return -1;
}

/** Empty slots in a tab. */
export function freeCount(bag: readonly (BagEntry | null)[], s: BagSlots, tab: BagTab): number {
  const [a, b] = tabRange(s, tab);
  let n = 0;
  for (let i = a; i < b; i++) if (!bag[i]) n++;
  return n;
}

/** Shown when a tab has no room (also translated in shared/i18n). */
export const TAB_FULL: Record<BagTab, string> = { gear: 'กระเป๋าเต็ม', use: 'ช่องประเภทใช้งานเต็ม' };
export const TAB_NAME: Record<BagTab, string> = { gear: 'กระเป๋า', use: 'ประเภทใช้งาน' };

/**
 * A save's bag laid out in tabs, never losing an entry. `slots` null = a save from before the tabs: every entry
 * is placed in its tab in the old order. Otherwise entries already in the right tab stay where they are and any
 * in the wrong tab (or past the end) move to the first empty slot of their own tab. Should a tab run out of room
 * (can't happen with old saves: they had 30 slots in all), it grows by whole `step`s past its size so nothing is
 * dropped. Running it again on its own result changes nothing.
 */
export function normalizeBag(raw: readonly unknown[] | undefined | null, slots: BagSlots | null, step = 10): { bag: (BagEntry | null)[]; slots: BagSlots } {
  const s: BagSlots = slots ? { ...slots } : defaultBagSlots();
  const src = (Array.isArray(raw) ? raw : []).map((e) => (e && typeof e === 'object' ? (e as BagEntry) : null));
  const keep: (BagEntry | null)[] = Array(bagTotal(s)).fill(null);
  const move: BagEntry[] = [];
  src.forEach((e, i) => {
    if (!e) return;
    if (slots && fitsAt(s, i, e)) keep[i] = e;
    else move.push(e);
  });
  // Entries to place, per tab, in their old order.
  const need: Record<BagTab, BagEntry[]> = { gear: [], use: [] };
  for (const e of move) need[tabOf(e)].push(e);
  for (const tab of BAG_TABS) {
    const free = freeCount(keep, s, tab);
    const short = need[tab].length - free;
    if (short > 0) {
      const grow = Math.ceil(short / step) * step;
      if (tab === 'gear') keep.splice(s.gear, 0, ...Array<null>(grow).fill(null));
      else keep.push(...Array<null>(grow).fill(null));
      s[tab] += grow;
    }
  }
  for (const tab of BAG_TABS) {
    for (const e of need[tab]) keep[freeSlot(keep, s, tab)] = e;
  }
  return { bag: keep, slots: s };
}

/** The first empty slot of the tab `e` belongs in, or -1. */
export function freeSlotFor(bag: readonly (BagEntry | null)[], s: BagSlots, e: BagEntry): number {
  return freeSlot(bag, s, tabOf(e));
}

// ------------------------------------------------------------ buying more slots (hidden until the owner opens it)

/**
 * Buying more bag slots (owner 2026-11-23): `step` more slots per buy, up to `max` per tab, paid in gold or in crystals
 * (คริสตัลมิติ, not for guests). The k-th buy of a tab (k = 0 for the first) costs base × grow^k. Off in the code: players
 * don't see it until the owner switches it on in /admin (balance tab, card "กระเป๋า"). Kept in BalanceTuning.bagExpand.
 */
export interface BagExpandCfg {
  on: boolean;
  /** Which ways of paying are offered. */
  gold: boolean;
  crystal: boolean;
  step: number;
  max: number;
  goldBase: number;
  goldGrow: number;
  crystalBase: number;
  crystalGrow: number;
}
export type BagExpandTuning = Partial<BagExpandCfg>;

type ExpandNum = Exclude<keyof BagExpandCfg, 'on' | 'gold' | 'crystal'>;
type ExpandFlag = 'on' | 'gold' | 'crystal';
export const BAG_EXPAND_NUMS: Record<ExpandNum, { name: string; range: [number, number]; dp?: number }> = {
  step: { name: 'ขยายครั้งละ (ช่อง)', range: [1, 50] },
  max: { name: 'สูงสุดต่อแท็บ (ช่อง)', range: [BAG_TAB_MIN, BAG_TAB_LIMIT] },
  goldBase: { name: 'ราคาทองครั้งแรก', range: [0, 100_000_000] },
  goldGrow: { name: 'ราคาทอง × ต่อครั้ง', range: [1, 10], dp: 2 },
  crystalBase: { name: 'ราคาคริสตัลครั้งแรก', range: [0, 1_000_000] },
  crystalGrow: { name: 'ราคาคริสตัล × ต่อครั้ง', range: [1, 10], dp: 2 },
};
const EXPAND_NUM_KEYS = Object.keys(BAG_EXPAND_NUMS) as ExpandNum[];
const EXPAND_FLAGS: ExpandFlag[] = ['on', 'gold', 'crystal'];
export const BAG_EXPAND_FLAG_NAME: Record<ExpandFlag, string> = { on: 'ขยายช่องกระเป๋า (ผู้เล่นเห็นปุ่ม)', gold: 'จ่ายด้วยทอง', crystal: 'จ่ายด้วยคริสตัลมิติ' };

export function codeBagExpand(): BagExpandCfg {
  return { on: false, gold: true, crystal: true, step: 10, max: 90, goldBase: 10_000, goldGrow: 2, crystalBase: 100, crystalGrow: 1 };
}

export const mergeBagExpand = (t: BagExpandTuning | undefined): BagExpandCfg => ({ ...codeBagExpand(), ...(t ?? {}) });

/** Cleans what /admin sent (strict: anything unknown or out of range is an error) or the DB had. Keeps what differs from the code. */
export function checkBagExpand(x: unknown, strict: boolean): { tuning: BagExpandTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!x || typeof x !== 'object' || Array.isArray(x)) return strict ? { error: 'ค่าขยายช่องกระเป๋าไม่ถูกต้อง' } : { tuning: undefined };
  const o = x as Record<string, unknown>;
  if (strict) {
    const extra = Object.keys(o).find((k) => !(EXPAND_FLAGS as string[]).includes(k) && !(EXPAND_NUM_KEYS as string[]).includes(k));
    if (extra) return { error: `ขยายช่องกระเป๋า: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const code = codeBagExpand();
  const out: BagExpandTuning = {};
  for (const k of EXPAND_FLAGS) {
    const v = o[k];
    if (v === undefined) continue;
    if (typeof v !== 'boolean') {
      if (strict) return { error: `${BAG_EXPAND_FLAG_NAME[k]} ต้องเป็นเปิด/ปิด` };
      continue;
    }
    if (v !== code[k]) out[k] = v;
  }
  for (const k of EXPAND_NUM_KEYS) {
    const v = o[k];
    if (v === undefined) continue;
    const { name, range: [lo, hi], dp = 0 } = BAG_EXPAND_NUMS[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
      if (strict) return { error: `${name} ต้องอยู่ระหว่าง ${lo.toLocaleString()} ถึง ${hi.toLocaleString()}` };
      continue;
    }
    const n = Number(v.toFixed(dp));
    if (n !== code[k]) out[k] = n;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines for what changed. */
export function bagExpandChanges(a: BagExpandCfg, b: BagExpandCfg): string[] {
  const out: string[] = [];
  for (const k of EXPAND_FLAGS) if (a[k] !== b[k]) out.push(`${BAG_EXPAND_FLAG_NAME[k]} ${a[k] ? 'เปิด' : 'ปิด'} → ${b[k] ? 'เปิด' : 'ปิด'}`);
  for (const k of EXPAND_NUM_KEYS) if (a[k] !== b[k]) out.push(`ขยายช่องกระเป๋า: ${BAG_EXPAND_NUMS[k].name} ${a[k]} → ${b[k]}`);
  return out;
}

export type BagPay = 'gold' | 'crystal';

/** The next buy of a tab: how many slots and its prices, or why it can't be bought (Thai). */
export function nextExpand(c: BagExpandCfg, s: BagSlots, tab: BagTab): { add: number; gold: number; crystal: number } | string {
  if (!c.on) return 'ยังขยายช่องกระเป๋าไม่ได้ตอนนี้';
  const now = s[tab];
  const add = Math.min(c.step, c.max - now);
  if (add <= 0) return `${TAB_NAME[tab]}ขยายได้สูงสุด ${c.max} ช่อง`;
  const k = Math.max(0, Math.floor((now - BAG_TAB_START) / Math.max(1, c.step)));
  return { add, gold: Math.round(c.goldBase * c.goldGrow ** k), crystal: Math.round(c.crystalBase * c.crystalGrow ** k) };
}
