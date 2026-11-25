// Card album (card plan section 14, owner 2026-11-25): an account registers cards into it (the card is used up),
// page by farm map. A page's step 1 = all its rare (monster) cards, step 2 = every card of the map with the boss's
// (and the parrot's on Smugglers' Cove). Each step reached adds its permanent stat bonus (/admin card tab) to every
// character of the account. Kept through a server wipe (owner 2026-11-25), the table card_album in server/db.ts.
import { cardNum } from './cardTuning';
import { ALBUM_PAGE_KEYS, ALBUM_STATS, CARD_DEFAULTS, albumKey, isCardId, type AlbumPageKey, type AlbumStat, type CardId } from './data/cards';

export interface AlbumPage {
  key: AlbumPageKey;
  /** The map's rare cards (step 1). */
  normal: CardId[];
  /** Its boss's cards (epic / legendary: the bear, the witch, the captain and the parrot, …), step 2 with `normal`. */
  boss: CardId[];
}

export const ALBUM_PAGES: readonly AlbumPage[] = ALBUM_PAGE_KEYS.map((key) => {
  const floor = Number(key[1]);
  const map = Number(key[3]);
  const cards = CARD_DEFAULTS.filter((d) => d.floor === floor && d.map === map);
  return { key, normal: cards.filter((d) => d.rarity === 'rare').map((d) => d.id), boss: cards.filter((d) => d.rarity !== 'rare').map((d) => d.id) };
});

/** The album page a card belongs to. */
export function albumPageOf(id: CardId): AlbumPage | undefined {
  return ALBUM_PAGES.find((p) => p.normal.includes(id) || p.boss.includes(id));
}

export const albumOn = (): boolean => cardNum('albumOn') === 1;

/** How many steps of a page are reached (0, 1 or 2) with these registered cards. */
export function albumStep(page: AlbumPage, has: ReadonlySet<CardId> | readonly CardId[]): 0 | 1 | 2 {
  const set = has instanceof Set ? has : new Set(has as readonly CardId[]);
  if (!page.normal.every((c) => set.has(c))) return 0;
  return page.boss.every((c) => set.has(c)) ? 2 : 1;
}

/** One step's bonus as tuned in /admin. */
export function albumStepBonus(page: AlbumPageKey, step: 1 | 2): Record<AlbumStat, number> {
  return Object.fromEntries(ALBUM_STATS.map((s) => [s, cardNum(albumKey(page, step, s))])) as Record<AlbumStat, number>;
}

/** The whole album's bonus (percent per stat), nothing while the album is switched off. */
export function albumBonus(cards: readonly CardId[]): Record<AlbumStat, number> {
  const out = Object.fromEntries(ALBUM_STATS.map((s) => [s, 0])) as Record<AlbumStat, number>;
  if (!albumOn() || !cards.length) return out;
  const set = new Set(cards);
  for (const page of ALBUM_PAGES) {
    const reached = albumStep(page, set);
    for (let step = 1 as 1 | 2; step <= reached; step++) {
      const b = albumStepBonus(page.key, step);
      for (const s of ALBUM_STATS) out[s] += b[s];
    }
  }
  return out;
}

/** A stored album (JSON array) cleaned: known card ids only, each once, in card order. */
export function cleanAlbum(raw: unknown): CardId[] {
  const got = new Set(Array.isArray(raw) ? raw.filter(isCardId) : []);
  return CARD_DEFAULTS.map((d) => d.id).filter((id) => got.has(id));
}
