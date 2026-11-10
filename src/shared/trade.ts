// Trade rules shared by the server (which decides: server/trade.ts) and the browser (which shows them).
// Docs: docs/systems/trade.md. Trades live only in the server's memory; the finished ones go to trade_log.
import { isBound, isItem, isStack, RARITY_LABEL, sameStack, type BagEntry } from './types';
import { BOUND_MSG } from './data/stones';
import { putAll, slotsNeeded } from './mail';
import { entryName } from './data/potions';

/** Bag slots one side may offer. */
export const TRADE_SLOTS = 8;
/** A request with no answer this long counts as declined (seconds). */
export const TRADE_REQUEST_TTL = 30;
/** The same character may ask the same player again at most this often (seconds), like party invites. */
export const TRADE_REREQUEST_GAP = 10;
/** Both confirmed: the swap happens after this many seconds, unless something changes. */
export const TRADE_COUNTDOWN = 3;
/** The gold SENT is taxed this many percent; the receiver gets the rest and the tax leaves the game. */
export const TRADE_TAX_PCT = 3;
/** Most gold one side may offer. */
export const TRADE_GOLD_MAX = 1_000_000_000;

/** The tax on a gold offer (rounded down: 1,000 → 30; offers under 34 pay none). */
export const taxOf = (gold: number): number => Math.floor((gold * TRADE_TAX_PCT) / 100);
/** What the receiver gets from a gold offer (1,000 → 970). The sender always loses the whole offer. */
export const afterTax = (gold: number): number => gold - taxOf(gold);

/** One offered bag slot: where it is, and what (stacks: the offered amount in `entry.count`). */
export interface TradeOffer {
  slot: number;
  entry: BagEntry;
}

/**
 * The offer for bag slot `slot`, or a Thai reason it can't be made. Gear goes whole; a potion/stone
 * stack goes whole too unless `n` (1..count) says how many (the Shift+drag amount dialog).
 */
export function makeOffer(bag: (BagEntry | null)[], slot: unknown, n?: unknown): TradeOffer | string {
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot >= bag.length) return 'ช่องกระเป๋าไม่ถูกต้อง';
  const cur = bag[slot];
  if (!cur) return 'ช่องนี้ว่าง';
  if (isBound(cur)) return BOUND_MSG;
  if (!isStack(cur)) return { slot, entry: structuredClone(cur) };
  if (n === undefined) n = cur.count;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > cur.count) return 'จำนวนไม่ถูกต้อง';
  return { slot, entry: { ...structuredClone(cur), count: n } };
}

/** Everything one side puts into the swap, as the server holds it. */
export interface SwapSide {
  name: string;
  bag: (BagEntry | null)[];
  gold: number;
  offers: TradeOffer[];
  offerGold: number;
}

export type SwapPlan =
  | { ok: true; bagA: (BagEntry | null)[]; bagB: (BagEntry | null)[]; goldA: number; goldB: number; taxA: number; taxB: number }
  | { ok: false; who: 'a' | 'b'; msg: string };

/** The bag with the offered things taken out, and what was taken (null if the bag no longer holds them as offered). */
function takeOffered(bag: (BagEntry | null)[], offers: TradeOffer[]): { rest: (BagEntry | null)[]; taken: BagEntry[] } | null {
  const rest = structuredClone(bag);
  const taken: BagEntry[] = [];
  const seen = new Set<number>();
  for (const o of offers) {
    if (seen.has(o.slot)) return null;
    seen.add(o.slot);
    const cur = rest[o.slot];
    if (!cur) return null;
    if (isStack(o.entry)) {
      if (!isStack(cur) || !sameStack(cur, o.entry) || cur.count < o.entry.count) return null;
      taken.push({ ...structuredClone(cur), count: o.entry.count });
      cur.count -= o.entry.count;
      if (cur.count <= 0) rest[o.slot] = null;
    } else {
      // Exactly the item the other player saw (any change since, even a stat, voids the offer).
      if (!isItem(cur) || JSON.stringify(cur) !== JSON.stringify(o.entry)) return null;
      taken.push(cur);
      rest[o.slot] = null;
    }
  }
  return { rest, taken };
}

/**
 * Works out the whole swap on copies, touching nothing: each side's offered things must still be in the
 * bag exactly as offered and the gold must be there; then each bag (with its own offers removed, so a
 * full bag can swap one for one) must fit what the other gives. Gold: the sender loses the offer, the
 * receiver gets it minus the tax. Pure, so the server and the tests share it.
 */
export function planSwap(a: SwapSide, b: SwapSide): SwapPlan {
  for (const [s, who] of [[a, 'a'], [b, 'b']] as const) {
    if (!Number.isInteger(s.offerGold) || s.offerGold < 0 || s.offerGold > TRADE_GOLD_MAX) return { ok: false, who, msg: 'จำนวนทองไม่ถูกต้อง' };
    if (s.offers.length > TRADE_SLOTS) return { ok: false, who, msg: 'ใส่ของเกินจำนวนช่อง' };
    if (s.gold < s.offerGold) return { ok: false, who, msg: `${s.name} มีทองไม่พอ` };
  }
  const ta = takeOffered(a.bag, a.offers);
  if (!ta) return { ok: false, who: 'a', msg: `ของที่ ${a.name} เสนอไม่อยู่ในกระเป๋าครบแล้ว` };
  const tb = takeOffered(b.bag, b.offers);
  if (!tb) return { ok: false, who: 'b', msg: `ของที่ ${b.name} เสนอไม่อยู่ในกระเป๋าครบแล้ว` };
  const bagA = ta.rest;
  const bagB = tb.rest;
  if (!putAll(bagA, tb.taken)) return { ok: false, who: 'a', msg: `กระเป๋าของ ${a.name} ไม่พอ — ต้องมีช่องว่างอย่างน้อย ${slotsNeeded(ta.rest, tb.taken)} ช่อง` };
  if (!putAll(bagB, ta.taken)) return { ok: false, who: 'b', msg: `กระเป๋าของ ${b.name} ไม่พอ — ต้องมีช่องว่างอย่างน้อย ${slotsNeeded(tb.rest, ta.taken)} ช่อง` };
  const taxA = taxOf(a.offerGold);
  const taxB = taxOf(b.offerGold);
  return {
    ok: true, bagA, bagB, taxA, taxB,
    goldA: a.gold - a.offerGold + (b.offerGold - taxB),
    goldB: b.gold - b.offerGold + (a.offerGold - taxA),
  };
}

/** One entry as a line of text for the trade log (gear shows its rarity and level). */
export function describeEntry(e: BagEntry): string {
  return isItem(e) ? `${entryName(e)} [${RARITY_LABEL[e.rarity]}] Lv.${e.level}` : entryName(e);
}

// ------------------------------------------------------------ what the browsers see

export interface TradeSideView {
  name: string;
  items: TradeOffer[];
  gold: number;
  confirmed: boolean;
}

/** An open trade for one of its two players. `a` asked for the trade, `b` was asked; `you` says which one is the viewer. */
export interface TradeView {
  id: number;
  /** Goes up with every change; a confirm quotes it, so a confirm of an offer that just changed is refused. */
  ver: number;
  you: 'a' | 'b';
  a: TradeSideView;
  b: TradeSideView;
  /** Seconds left of the 3 s countdown when this was sent, or null when it isn't running. */
  cd: number | null;
}

/** One row of the admin trade log. */
export interface TradeLogRow {
  id: number;
  at: number;
  zone: string;
  a: { charId: number; name: string; items: string[]; gold: number; tax: number };
  b: { charId: number; name: string; items: string[]; gold: number; tax: number };
}
