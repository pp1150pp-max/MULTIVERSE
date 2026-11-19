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

/**
 * When each of a player's skill buffs ends (sim time), by a key for what kind it is. castSkill compares it before and
 * after a cast: whatever got a later end came from that skill (its icon under the owner's HP and MP bars).
 */
export function buffEnds(p: Player): Record<string, number> {
  const g = p.gun;
  const e: Record<string, number> = {
    shield: p.shieldUntil, taken: p.takenUntil, dmg: p.dmgUntil, haste: p.hasteUntil, reflect: p.reflectUntil,
    steady: p.steadyUntil, lifesteal: p.lifestealUntil, shock: g.shock.until, stack: g.stack.until, split: g.split.until,
    pierce: g.pierceUntil, storm: g.storm.until,
  };
  for (const [id, h] of Object.entries(g.onHit)) e[`hit:${id}`] = h.until;
  for (const b of p.statBuffs) e[`stat:${b.id}`] = b.until;
  return e;
}

/** Notes on `p` the buffs a cast of `skill` just gave it (`before` = its buffEnds from before the cast). */
export function noteSkillBuffs(p: Player, skill: string, before: Record<string, number>, now: number): void {
  let until = 0;
  for (const [k, t] of Object.entries(buffEnds(p))) if (t > now && t > (before[k] ?? 0) + 1e-6) until = Math.max(until, t);
  if (until > 0) p.skillBuffs[skill] = { until, total: until - now };
}

/** A player's skill buffs still running (for the snapshot): [skill id, seconds left, seconds given]. Drops ended ones. */
export function runningSkillBuffs(p: Player, now: number): [string, number, number][] {
  const out: [string, number, number][] = [];
  for (const [id, b] of Object.entries(p.skillBuffs)) {
    if (b.until <= now) delete p.skillBuffs[id];
    else out.push([id, Math.round((b.until - now) * 10) / 10, Math.round(b.total * 10) / 10]);
  }
  return out;
}
