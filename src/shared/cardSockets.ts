// Card sockets on gear (card plan docs/plans/card-system.md PR 2–4, owner 2026-11-25/26):
// - drilling at the blacksmith (once per item, gold + one drill stone) gives 0, 1 or 2 sockets (odds on the /admin card tab)
// - a card from the bag goes into an empty socket of a fitting item from anywhere (bag or worn); taking it out breaks it
// - the cards on worn gear give their effects (cardFxTotal), each effect capped on the whole character (cap_<fx>)
// Every number is read through cardNum / cardDef, so the /admin card tab changes them at once.
import { cardDef, cardNum } from './cardTuning';
import { CARD_FX, isCardId, type CardFx, type CardGroup, type CardId } from './data/cards';
import { RARITY_COST } from './data/reroll';
import type { Item, SlotId } from './types';

/** Most sockets one item can get. */
export const MAX_SOCKETS = 2;

/** Which card group fits each gear slot (owner 2026-11-11: weapon · armor · accessory). */
export const SLOT_CARD_GROUP: Record<SlotId, CardGroup> = {
  weapon: 'weapon',
  offhand: 'weapon',
  helmet: 'armor',
  armor: 'armor',
  gloves: 'armor',
  belt: 'armor',
  boots: 'armor',
  necklace: 'accessory',
  ring: 'accessory',
};

/** True once the item was drilled (also when it got no socket: it can't be drilled again). */
export const isDrilled = (it: Item): boolean => typeof it.sockets === 'number';
/** Its socket count (0 before drilling). */
export const socketCount = (it: Item): number => (isDrilled(it) ? it.sockets! : 0);
/** The card in each socket (null = empty), as long as the socket count. */
export function socketCards(it: Item): (CardId | null)[] {
  const n = socketCount(it);
  return Array.from({ length: n }, (_, i) => it.cards?.[i] ?? null);
}
/** True when a card sits in any socket. */
export const hasCards = (it: Item): boolean => socketCards(it).some((c) => c !== null);
/** The first empty socket, or -1. */
export const freeSocket = (it: Item): number => socketCards(it).indexOf(null);

/** Gold to drill an item: (15 + iLv × 6) × drillCostMult × its rarity's cost multiplier (the reroll one). */
export function drillCost(it: Item): number {
  return Math.round((15 + it.level * 6) * cardNum('drillCostMult') * RARITY_COST[it.rarity]);
}

/** The drill odds in percent for 0 / 1 / 2 sockets. */
export const drillOdds = (): [number, number, number] => [cardNum('drill0'), cardNum('drill1'), cardNum('drill2')];

/** Rolls how many sockets a drilling gives. */
export function rollSockets(r: () => number): number {
  const odds = drillOdds();
  const total = odds[0] + odds[1] + odds[2];
  if (total <= 0) return 0;
  let x = r() * total;
  for (let n = 0; n < odds.length; n++) {
    x -= odds[n];
    if (x < 0) return n;
  }
  return odds.length - 1;
}

/** Why this card can't go into this item ('' = it can, given an empty socket). Uses the card's tuned group. */
export function socketBlock(card: CardId, it: Item): string {
  const d = cardDef(card);
  if (!d) return 'ไม่มีการ์ดนี้';
  if (!isDrilled(it)) return 'อุปกรณ์ยังไม่ได้เจาะรู (เจาะได้ที่ช่างตีเหล็ก)';
  if (socketCount(it) === 0) return 'อุปกรณ์ชิ้นนี้เจาะแล้วไม่ได้ช่อง';
  if (SLOT_CARD_GROUP[it.slot] !== d.group) return 'การ์ดใบนี้ใส่อุปกรณ์ชนิดนี้ไม่ได้';
  if (freeSocket(it) < 0) return 'ไม่มีช่องว่าง (ถอดการ์ดเดิมก่อน การ์ดเดิมจะแตก)';
  return '';
}

/**
 * Cleans an item's socket fields from a save, the stash, the market or a message: sockets 0–MAX_SOCKETS (else dropped:
 * not drilled), cards as long as the sockets with unknown ids emptied, and no `cards` at all when every socket is empty.
 */
export function cleanSockets(it: Item): void {
  const s = it.sockets as unknown;
  if (s === undefined) {
    delete it.cards;
    return;
  }
  if (typeof s !== 'number' || !Number.isInteger(s) || s < 0 || s > MAX_SOCKETS) {
    delete it.sockets;
    delete it.cards;
    return;
  }
  const raw = Array.isArray(it.cards) ? it.cards : [];
  const cards = Array.from({ length: s }, (_, i) => (isCardId(raw[i]) ? raw[i] : null));
  if (cards.some((c) => c !== null)) it.cards = cards;
  else delete it.cards;
}

export type CardFxTotals = Record<CardFx, number>;
export const noCardFx = (): CardFxTotals => Object.fromEntries(CARD_FX.map((f) => [f, 0])) as CardFxTotals;

/** The cards' effects summed over these items, before the caps. */
export function cardFxRaw(items: Iterable<Item | null | undefined>): CardFxTotals {
  const out = noCardFx();
  for (const it of items) {
    if (!it) continue;
    for (const c of socketCards(it)) {
      const d = c && cardDef(c);
      if (!d) continue;
      for (const f of CARD_FX) out[f] += d.fx[f] ?? 0;
    }
  }
  for (const f of CARD_FX) out[f] = Math.round(out[f] * 100) / 100;
  return out;
}

/** An effect's cap on the whole character (cap_<fx> on the /admin card tab), Infinity when 0 (= no cap). */
export function cardFxCap(f: CardFx): number {
  const c = cardNum(`cap_${f}`);
  return c > 0 ? c : Infinity;
}

/** The cards' effects on these items (worn gear), each capped at its cap. */
export function cardFxTotal(items: Iterable<Item | null | undefined>): CardFxTotals {
  const raw = cardFxRaw(items);
  for (const f of CARD_FX) raw[f] = Math.min(raw[f], cardFxCap(f));
  return raw;
}
