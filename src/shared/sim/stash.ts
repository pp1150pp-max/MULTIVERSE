// The account-wide storage box kept by the warehouse keeper in town. Every character on the same
// account (online) or in the same browser (singleplayer) opens the same stash, so gear and gold can
// be passed between characters. Saved apart from the characters themselves.
import { POTION_SIZES, POTION_STACK } from '../data/potions';
import { RARITIES, SLOTS, type BagEntry, type PotionSize } from '../types';

/** Slots a new stash starts with. */
export const STASH_START = 30;
/** Slots per row, and per purchase. */
export const STASH_ROW = 10;
export const STASH_MAX = 90;
/** Price of each extra row, in order (owner: 500 / 1,000 / 2,000 / 4,000 / 8,000 / 16,000 G). */
export const STASH_ROW_PRICES = [500, 1000, 2000, 4000, 8000, 16000];
/** Most gold the stash will hold (keeps numbers sane; far above anything earned in play). */
export const STASH_GOLD_MAX = 1_000_000_000;

export interface StashData {
  /** Slots bought so far (STASH_START to STASH_MAX, in steps of STASH_ROW). */
  size: number;
  gold: number;
  /** Always `size` long; null = empty slot. */
  items: (BagEntry | null)[];
}

export function newStash(): StashData {
  return { size: STASH_START, gold: 0, items: Array.from({ length: STASH_START }, () => null) };
}

/** What the next row costs, or null once the stash is at its maximum. */
export function nextRowPrice(s: StashData): number | null {
  if (s.size >= STASH_MAX) return null;
  return STASH_ROW_PRICES[(s.size - STASH_START) / STASH_ROW] ?? null;
}

/** A bag entry read from storage that looks sane enough to keep. */
function cleanEntry(e: unknown): BagEntry | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  if ('potion' in o) {
    const count = o.count;
    if ((o.potion !== 'hp' && o.potion !== 'mp') || !POTION_SIZES.includes(o.size as never)) return null;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) return null;
    return { potion: o.potion, size: o.size as PotionSize, count: Math.min(count, POTION_STACK) };
  }
  if (typeof o.uid !== 'string' || !SLOTS.includes(o.slot as never) || !RARITIES.includes(o.rarity as never)) return null;
  return e as BagEntry;
}

/** Fills in a stash from storage (missing = a new empty one), so old saves keep working. */
export function cleanStash(raw: unknown): StashData {
  const r = (raw ?? {}) as Partial<StashData>;
  let size = typeof r.size === 'number' && Number.isFinite(r.size) ? Math.floor(r.size) : STASH_START;
  size = Math.min(STASH_MAX, Math.max(STASH_START, size - ((size - STASH_START) % STASH_ROW)));
  const gold = typeof r.gold === 'number' && Number.isFinite(r.gold) ? Math.min(STASH_GOLD_MAX, Math.max(0, Math.floor(r.gold))) : 0;
  const src = Array.isArray(r.items) ? r.items : [];
  return { size, gold, items: Array.from({ length: size }, (_, i) => cleanEntry(src[i])) };
}
