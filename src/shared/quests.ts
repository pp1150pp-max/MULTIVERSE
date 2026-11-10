// Where each of The Seeker's key quests stands for one player. One place for the rules, so his window,
// the quest tracker, the ! / ? over his head and Sim.questOffers never disagree.
import { ZONES, type ZoneDef } from './data/zones';
import { BOSS_QUEST_KEY, QUEST_KILLS } from './data/stones';
import type { QuestKey, StoneKind } from './types';

/** offer: he can give it · going: taken · ready: kills done, hand it in · holding: key in the bag · done: boss beaten · locked: level too low. */
export type QuestState = 'offer' | 'going' | 'ready' | 'holding' | 'done' | 'locked';

export interface QuestRow { boss: string; key: QuestKey; map: ZoneDef; kills: number; state: QuestState }

/** What the rules read from a player (Player has all of it). */
export interface QuestHolder {
  level: number;
  quests: Record<string, number>;
  bossKills: string[];
  stoneCount(kind: StoneKind): number;
}

/** Every boss's quest as this player sees it, in map order. */
export function questRows(p: QuestHolder): QuestRow[] {
  return Object.values(ZONES).flatMap((map) => {
    const boss = map.lair?.boss;
    const key = boss && BOSS_QUEST_KEY[boss];
    if (!boss || !key) return [];
    const kills = p.quests[boss];
    const state: QuestState = p.bossKills.includes(boss) ? 'done'
      : p.stoneCount(key) > 0 ? 'holding'
      : kills !== undefined ? (kills >= QUEST_KILLS ? 'ready' : 'going')
      : p.level >= map.levels[0] ? 'offer' : 'locked';
    return [{ boss, key, map, kills: kills ?? 0, state }];
  });
}

/** The mark over The Seeker: ? when a quest waits to be handed in (it wins), ! when he has one to give, else none. */
export function seekerMark(rows: readonly QuestRow[]): '?' | '!' | '' {
  return rows.some((r) => r.state === 'ready') ? '?' : rows.some((r) => r.state === 'offer') ? '!' : '';
}
