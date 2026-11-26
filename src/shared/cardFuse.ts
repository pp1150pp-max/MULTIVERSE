// Card fusion at the blacksmith (card plan 6.1 and 12.3 no. 2, owner 2026-11-25/26):
// - 3 cards of the same (tuned) rarity and the same floor, repeats allowed, give 1 random card of that rarity and floor
//   (every card of the pool equally likely, the same card included)
// - mixed floors never fuse (owner 2026-11-26) · floor 2 fuses only while floor2Drop is on (owner 2026-11-26)
// - costs fuseCost_<rarity> gold, off per rarity with fuseOn_<rarity> (epic off in code: one epic card per floor)
// - a fused card is never announced to the server (owner 2026-11-26)
// Pure: Sim.fuseCards takes the cards and gold, the forge window shows the same checks.
import { cardDef, cardNum, tunedFusePool } from './cardTuning';
import { CARD_DEFAULTS, CARD_RARITY_NAME, isCardId, type CardId, type CardRarity } from './data/cards';

/** Cards a fusion takes. */
export const FUSE_COUNT = 3;

/** The floor (1 or 2) a card belongs to. */
export const cardFloor = (id: CardId): 1 | 2 => CARD_DEFAULTS.find((d) => d.id === id)?.floor ?? 1;

/** What three cards would fuse into: their rarity, floor, pool and gold cost (no checks; see fuseBlock). */
export function fuseInfo(ids: readonly CardId[]): { rarity: CardRarity; floor: 1 | 2; pool: CardId[]; cost: number } | null {
  const d = ids[0] && cardDef(ids[0]);
  if (!d) return null;
  const floor = cardFloor(d.id);
  return { rarity: d.rarity, floor, pool: tunedFusePool(d.rarity, floor), cost: cardNum(`fuseCost_${d.rarity}`) };
}

/**
 * Why these cards can't be fused now ('' = they can). `have` counts a card in the bag, `gold` is the player's gold.
 * Checks: 3 known cards, one rarity, one floor, the rarity switched on, floor 2 open, enough of each (repeats count) and gold.
 */
export function fuseBlock(ids: readonly unknown[], have: (id: CardId) => number, gold: number): string {
  if (ids.length !== FUSE_COUNT || !ids.every(isCardId)) return `ต้องใช้การ์ด ${FUSE_COUNT} ใบ`;
  const cards = ids as CardId[];
  const defs = cards.map((id) => cardDef(id));
  if (defs.some((d) => !d)) return 'ไม่มีการ์ดนี้';
  const rarity = defs[0]!.rarity;
  if (defs.some((d) => d!.rarity !== rarity)) return 'การ์ดทั้ง 3 ใบต้องระดับเดียวกัน';
  const floor = cardFloor(cards[0]);
  if (cards.some((id) => cardFloor(id) !== floor)) return 'การ์ดทั้ง 3 ใบต้องมาจากชั้นเดียวกัน';
  if (cardNum(`fuseOn_${rarity}`) !== 1) return `ยังรวมการ์ด${CARD_RARITY_NAME[rarity]}ไม่ได้`;
  if (floor === 2 && cardNum('floor2Drop') !== 1) return 'ยังรวมการ์ดชั้น 2 ไม่ได้';
  if (!tunedFusePool(rarity, floor).length) return 'ไม่มีการ์ดให้สุ่ม';
  const need = new Map<CardId, number>();
  for (const id of cards) need.set(id, (need.get(id) ?? 0) + 1);
  for (const [id, n] of need) if (have(id) < n) return 'การ์ดในกระเป๋าไม่พอ';
  if (gold < cardNum(`fuseCost_${rarity}`)) return 'ทองไม่พอ';
  return '';
}

/** One card from the pool, each equally likely. */
export function rollFuse(pool: readonly CardId[], r: () => number): CardId {
  return pool[Math.min(pool.length - 1, Math.floor(r() * pool.length))];
}
