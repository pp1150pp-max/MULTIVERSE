import { STAT_KEYS, type StatKey, type Stats } from './types';

export const MAX_LEVEL = 50;
export const BASE_MOVE_SPEED = 3.5;

/**
 * Owner-set EXP multipliers on top of the base curve (2026-11-08):
 * Lv 10–19 ×2, Lv 20–29 ×2.5, Lv 30+ ×3. Lv 1–9 unchanged.
 */
function expBandMult(level: number): number {
  if (level >= 30) return 3;
  if (level >= 20) return 2.5;
  if (level >= 10) return 2;
  return 1;
}

/** EXP needed to go from `level` to `level + 1`. Steep on purpose so players move on to higher zones. */
export function expToNext(level: number): number {
  const base = Math.floor(30 * Math.pow(level, 2.1)) + 40;
  return Math.floor(base * expBandMult(level));
}

/** Monsters up to this many levels below the player still give full EXP. */
export const EXP_GAP_FREE = 3;

/** A monster this many levels above the player gives half EXP, and 10% less for each level past it. */
export const EXP_HIGH_GAP = 5;
/** A monster this many levels above the player can't be hurt at all (every hit is a MISS). */
export const MISS_GAP = 10;

/**
 * EXP multiplier for killing a monster.
 * - Below the player: −20% for each level past the free gap, never below 10%. Farming low-level
 *   monsters stops paying off, which pushes players to the next zone.
 * - Above the player: half at EXP_HIGH_GAP levels up, then −10% more per level (5 → 50%, 6 → 40% …
 *   9 → 10%), never below 0. Past MISS_GAP it can't be hit anyway.
 */
export function expGapMult(playerLevel: number, monsterLevel: number): number {
  const above = monsterLevel - playerLevel;
  if (above >= EXP_HIGH_GAP) return Math.max(0, 0.5 - 0.1 * (above - EXP_HIGH_GAP));
  const over = playerLevel - monsterLevel - EXP_GAP_FREE;
  return over <= 0 ? 1 : Math.max(0.1, 1 - 0.2 * over);
}

/** True when the monster is too far above the player to be hurt. */
export const outLevelled = (playerLevel: number, monsterLevel: number): boolean => monsterLevel - playerLevel >= MISS_GAP;

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
