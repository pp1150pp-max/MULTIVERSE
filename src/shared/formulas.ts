import { STAT_KEYS, type StatKey, type Stats } from './types';

export const MAX_LEVEL = 50;
export const BASE_MOVE_SPEED = 5;

/** EXP needed to go from `level` to `level + 1`. Steep on purpose so players move on to higher zones. */
export function expToNext(level: number): number {
  return Math.floor(30 * Math.pow(level, 2.1)) + 40;
}

/** Monsters up to this many levels below the player still give full EXP. */
export const EXP_GAP_FREE = 3;

/**
 * EXP multiplier for killing a monster: −20% for each level past the free gap, never below 10%.
 * Farming low-level monsters stops paying off, which pushes players to the next zone.
 */
export function expGapMult(playerLevel: number, monsterLevel: number): number {
  const over = playerLevel - monsterLevel - EXP_GAP_FREE;
  return over <= 0 ? 1 : Math.max(0.1, 1 - 0.2 * over);
}

/** Damage after defense. Same curve for players and monsters. */
export function mitigate(raw: number, def: number): number {
  return Math.max(1, (raw * 60) / (60 + Math.max(0, def)));
}

export function emptyStats(): Stats {
  const s = {} as Stats;
  for (const k of STAT_KEYS) s[k] = 0;
  return s;
}

export function addInto(target: Stats, add: Partial<Stats>, mult = 1): void {
  for (const k of Object.keys(add) as StatKey[]) target[k] += (add[k] ?? 0) * mult;
}
