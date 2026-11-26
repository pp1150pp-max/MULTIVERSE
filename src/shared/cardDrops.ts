import { cardDropsOpen, cardNum } from './cardTuning';
import { cardsOfMonster, type CardId, type CardRarity } from './data/cards';

/**
 * The cards one kill rolls (card plan sections 3.1, 3.2 and 12.3, PR 5). Pure: Sim.dropLoot gives them out.
 * - A farm monster: each of its cards at dropMonster % once.
 * - A boss in its boss room: its own card at dropBoss % and a card it drops for another monster (dropFrom: the
 *   parrot's for the Peg-Leg Captain) at dropBossExtra %, each rolled on its own once per key put in.
 * Floor 2 cards roll only while floor2Drop is on (cardDropsOpen). `boost` is the drop scroll x VIP multiplier,
 * used only while the /admin switch dropBoost is on (owner 2026-11-25).
 */
export function rollCardDrops(monster: string, boss: boolean, times: number, boost: number, r: () => number = Math.random): CardId[] {
  const mult = cardNum('dropBoost') === 1 ? boost : 1;
  const out: CardId[] = [];
  for (const d of cardsOfMonster(monster)) {
    if (!cardDropsOpen(d.id)) continue;
    const pct = !boss ? cardNum('dropMonster') : d.dropFrom ? cardNum('dropBossExtra') : cardNum('dropBoss');
    const c = Math.min(1, (pct / 100) * mult);
    for (let k = 0; k < (boss ? times : 1); k++) if (c > 0 && r() < c) out.push(d.id);
  }
  return out;
}

const RANK: Record<CardRarity, number> = { rare: 1, epic: 2, legendary: 3 };

/** Whether getting a card of this rarity is announced to the whole server (/admin announceFrom: 0 = never). */
export function cardAnnounced(rarity: CardRarity): boolean {
  const from = cardNum('announceFrom');
  return from > 0 && RANK[rarity] >= from;
}
