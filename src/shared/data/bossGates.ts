/**
 * Boss gates: to level past `level`, the character must have killed `boss` at least once.
 * Characters made before gates existed count every gate below their level as passed (Player constructor).
 */
export interface BossGate {
  level: number;
  boss: string; // monster id
  nameTh: string;
}

export const BOSS_GATES: readonly BossGate[] = [
  { level: 10, boss: 'forest_bear', nameTh: 'หมี' },
  { level: 20, boss: 'bog_witch', nameTh: 'แม่มดหนอง' },
  { level: 30, boss: 'yeti', nameTh: 'เยติ' },
  { level: 40, boss: 'volcano_heart', nameTh: 'หัวใจภูเขาไฟ' },
];

/** The gate that stops a character of this level from levelling up, or null. */
export function blockingGate(level: number, bossKills: readonly string[]): BossGate | null {
  const g = BOSS_GATES.find((x) => x.level === level);
  return g && !bossKills.includes(g.boss) ? g : null;
}

/** Bosses a character of this level has implicitly beaten (every gate below the level). */
export function gatesPassedBy(level: number): string[] {
  return BOSS_GATES.filter((g) => g.level < level).map((g) => g.boss);
}

export const BOSS_GATE_IDS: ReadonlySet<string> = new Set(BOSS_GATES.map((g) => g.boss));
