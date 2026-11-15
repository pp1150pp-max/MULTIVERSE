// The debuffs a player's skills put on a monster, as one bit each (owner 2026-11-15: show them on the monster). The
// server sends the mask in each monster's snapshot (`MonsterSnap.db`); the client draws an icon over its HP bar and an
// effect on its body for each (src/client/debuffFx.ts).
import type { Monster } from './Monster';

export const DEBUFFS = ['stun', 'slow', 'armor', 'weak', 'dot', 'mark'] as const;
export type Debuff = (typeof DEBUFFS)[number];
export const DEBUFF_BIT: Record<Debuff, number> = { stun: 1, slow: 2, armor: 4, weak: 8, dot: 16, mark: 32 };
export const DEBUFF_NAME: Record<Debuff, string> = {
  stun: 'สตัน', slow: 'ช้าลง', armor: 'เกราะแตก', weak: 'โจมตีลด', dot: 'ติดไฟ/พิษ', mark: 'โดนมาร์ค (คริแรงขึ้น)',
};

/**
 * The monster's debuffs now. `viewer` = the player who sees it: a Deadeye mark helps only the player who put it, so
 * only that player sees it.
 */
export function debuffMask(m: Monster, now: number, viewer: number): number {
  let n = 0;
  if (m.stunT > 0) n |= DEBUFF_BIT.stun;
  if (m.slowT > 0) n |= DEBUFF_BIT.slow;
  if (now < m.armorBreakUntil && m.armorBreak > 0) n |= DEBUFF_BIT.armor;
  if (now < m.weakUntil && m.weak > 0) n |= DEBUFF_BIT.weak;
  if (now < m.dotUntil) n |= DEBUFF_BIT.dot;
  if (now < m.markUntil && m.markBy === viewer) n |= DEBUFF_BIT.mark;
  return n;
}

export const hasDebuff = (mask: number, d: Debuff): boolean => (mask & DEBUFF_BIT[d]) !== 0;
