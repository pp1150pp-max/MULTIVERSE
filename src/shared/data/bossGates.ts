import { MONSTERS } from './monsters';

/**
 * Boss gates: to level past `level`, the character must have killed `boss` at least once.
 * Characters made before gates existed count every gate below their level as passed (Player constructor).
 */
export interface BossGate {
  level: number;
  boss: string; // monster id
  nameTh: string;
}

/**
 * Floor 2 gates (owner 2026-11-19) are listed before their bosses are in the game: a gate whose boss is not in
 * MONSTERS yet does not block (owner's choice), and it starts blocking by itself once the floor 2 map PR adds
 * that boss under this id. Until then a character can level past it, and gatesPassedBy counts it as passed.
 */
export const BOSS_GATES: readonly BossGate[] = [
  { level: 10, boss: 'forest_bear', nameTh: 'หมี' },
  { level: 20, boss: 'bog_witch', nameTh: 'แม่มดหนอง' },
  { level: 30, boss: 'yeti', nameTh: 'เยติ' },
  { level: 40, boss: 'volcano_heart', nameTh: 'หัวใจภูเขาไฟ' },
  { level: 50, boss: 'cannon_crab', nameTh: 'ปูยักษ์กระดองปืนใหญ่' },
  { level: 60, boss: 'pegleg_captain', nameTh: 'กัปตันขาไม้' },
  { level: 70, boss: 'ghost_captain', nameTh: 'กัปตันผีเรือคนตาย' },
  { level: 80, boss: 'kraken', nameTh: 'คราเคน' },
];

/** The gate that stops a character of this level from levelling up, or null (also null while its boss is not in the game). */
export function blockingGate(level: number, bossKills: readonly string[]): BossGate | null {
  const g = BOSS_GATES.find((x) => x.level === level);
  return g && MONSTERS[g.boss] && !bossKills.includes(g.boss) ? g : null;
}

/** Bosses a character of this level has implicitly beaten (every gate below the level). */
export function gatesPassedBy(level: number): string[] {
  return BOSS_GATES.filter((g) => g.level < level).map((g) => g.boss);
}

export const BOSS_GATE_IDS: ReadonlySet<string> = new Set(BOSS_GATES.map((g) => g.boss));
