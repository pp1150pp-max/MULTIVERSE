// The debuffs a player's skills put on a monster, as one bit each (owner 2026-11-15: show them on the monster). The
// server sends the mask in each monster's snapshot (`MonsterSnap.db`); the client draws an icon over its HP bar and an
// effect on its body for each (src/client/debuffFx.ts).
import type { Monster } from './Monster';
import type { Player } from './Player';

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

/**
 * The kinds of skill buff running on a player, one bit each (owner 2026-11-18: a magic circle under a buffed player,
 * src/client/magicCircles.ts). Sent in `PlayerSnap.bf` only while one runs.
 */
export const BUFF_BIT = { attack: 1, guard: 2, speed: 4 } as const;
export type BuffKind = keyof typeof BUFF_BIT;

export function buffMask(p: Player, now: number): number {
  let n = 0;
  if ((now < p.dmgUntil && p.dmgMult > 1) || now < p.lifestealUntil) n |= BUFF_BIT.attack;
  if ((now < p.shieldUntil && p.shield > 0) || (now < p.takenUntil && p.takenMult < 1) || now < p.reflectUntil || now < p.steadyUntil) n |= BUFF_BIT.guard;
  if (now < p.hasteUntil && p.haste > 0) n |= BUFF_BIT.speed;
  for (const b of p.statBuffs) {
    if (now >= b.until) continue;
    const m = b.mods;
    if (m.atk || m.crit || m.critDmg) n |= BUFF_BIT.attack;
    if (m.def || m.maxHp) n |= BUFF_BIT.guard;
    if (m.atkSpeed || m.moveSpeed) n |= BUFF_BIT.speed;
  }
  return n;
}
