// The element system in the Sim (owner 2026-11-27, src/shared/elementTuning.ts, docs/systems/skills.md "ระบบธาตุ").
// Sim.hitMonster asks hitElement() on every player hit that carries a skill (not on damage-over-time ticks, not on
// reaction hits): the hit's element marks the monster, or sets off a reaction with the mark already on it. A reaction
// runs after the hit is finished (runReaction), so it never kills the monster twice.
import type { Sim } from './Sim';
import type { Player } from './Player';
import type { Monster } from './Monster';
import type { HitOpts } from './types';
import { currentBalance } from '../balance';
import { ELEMENTS, REACTION_NAME, reactionOf, skillElement, type Element, type ElementConfig, type ReactionId, type SkillElement } from '../elementTuning';
import { addDot } from './extraEffects';

/** A knockback is a launch speed that dies away (Unit.knockback): × 10 travels about that many metres. */
const KB_PER_METRE = 10;

const cfgNow = (): ElementConfig => currentBalance().skills.elements;

/**
 * The element of a player's hit from skill `src`. A Gunslinger's basic shot takes the element of a running buff that
 * changes it (hot / shock rounds, split shot, bullet storm), the first in that order that runs and has an element.
 */
export function hitElementOf(p: Player, src: string, now: number, cfg = cfgNow()): SkillElement {
  const own = skillElement(cfg, src);
  if (own !== 'none') return own;
  if (p.cls.id !== 'gunslinger' || !p.cls.skills.some((s) => s.kind === 'basic' && s.id === src)) return 'none';
  const g = p.gun;
  const running: [string, number][] = [
    ['gs_shockrounds', g.shock.until],
    ['gs_hotrounds', g.onHit.gs_hotrounds?.until ?? 0],
    ['gs_bulletstorm', g.storm.until],
    ['gs_splitshot', g.split.until],
  ];
  for (const [id, until] of running) {
    if (now >= until) continue;
    const e = skillElement(cfg, id);
    if (e !== 'none') return e;
  }
  return 'none';
}

/** The monster's mark now (null = none or worn off). */
export function markOf(m: Monster, now: number): Element | null {
  return m.elem && now < m.elemUntil ? m.elem : null;
}

/** Damage taken × this, from a lightning mark. */
export function markDamageMult(m: Monster, now: number): number {
  const cfg = cfgNow();
  return cfg.on && markOf(m, now) === 'lightning' ? 1 + cfg.mark.lightning / 100 : 1;
}

/** The mark as a number for the snapshot (index in ELEMENTS + 1), 0 = none. */
export function markCode(m: Monster, now: number): number {
  const e = markOf(m, now);
  return e ? ELEMENTS.indexOf(e) + 1 : 0;
}

/**
 * The hit's element meets the monster: either a reaction (returned, to run after the hit) or a new mark, whose small
 * effect is merged into `opts` (water slow, wind knockback) or started (fire / poison damage over time).
 */
export function hitElement(sim: Sim, p: Player, m: Monster, src: string, opts: HitOpts): { opts: HitOpts; reaction: ReactionId | null } {
  const cfg = cfgNow();
  if (!cfg.on || opts.noExtra || opts.noElem) return { opts, reaction: null };
  const el = hitElementOf(p, src, sim.time, cfg);
  if (el === 'none') return { opts, reaction: null };
  const now = sim.time;
  // Right after a reaction the monster takes no new mark for a moment (owner 2026-11-27: 1 s).
  if (now < m.markFreeAt) return { opts, reaction: null };
  const had = markOf(m, now);
  const rid = had ? reactionOf(had, el) : null;
  if (rid && cfg.reactions[rid].on && now >= (m.reactReady.get(rid) ?? 0) && (cfg.reactions[rid].boss || !m.isBoss)) {
    m.elem = null;
    m.elemUntil = 0;
    // Each reaction has its own timer on each monster.
    m.reactReady.set(rid, now + cfg.reactCd);
    m.markFreeAt = now + cfg.reactCd;
    return { opts, reaction: rid };
  }
  m.elem = el;
  m.elemUntil = now + cfg.markSec;
  const o: HitOpts = { ...opts };
  const v = cfg.mark[el];
  if (v > 0) {
    if (el === 'water') {
      const s = v / 100;
      if (!o.slow || s > o.slow) {
        o.slow = s;
        o.slowT = cfg.markSec;
      }
    } else if (el === 'wind') o.kb = Math.max(o.kb ?? 0, v * KB_PER_METRE);
    else if (el === 'fire' || el === 'poison') addDot(sim, p, m, `el_${el}`, v / 100, cfg.markSec);
  }
  return { opts: o, reaction: null };
}

/** Runs a reaction the player `p` set off on `m` (after that hit is done). */
export function runReaction(sim: Sim, p: Player, m: Monster, rid: ReactionId): void {
  const rc = cfgNow().reactions[rid];
  const near = rc.r > 0
    ? sim.monsters.filter((t) => t.alive && !t.untargetable && Math.hypot(t.x - m.x, t.z - m.z) <= rc.r + t.radius)
    : m.alive ? [m] : [];
  sim.text(m.x, m.topY + 0.6, m.z, `${REACTION_NAME[rid]}!`, 'crit', 1.1);
  // Its own code-drawn effect, mixing the two elements (client/reactionFx.ts); positions rounded to keep the event small.
  const hits = near.filter((t) => !(t.isBoss && !rc.boss)).flatMap((t) => [Math.round(t.x * 10) / 10, Math.round(t.z * 10) / 10]);
  sim.fx('reaction', rid, m.x, m.z, rc.r, hits);
  for (const t of near) {
    if (!t.alive || (t.isBoss && !rc.boss)) continue;
    if (rc.dmg > 0) {
      const kb = rc.kb > 0 ? { kb: rc.kb * KB_PER_METRE, fromX: m.x, fromZ: m.z } : {};
      const slow = rc.slow > 0 && rc.slowSec > 0 ? { slow: rc.slow / 100, slowT: rc.slowSec } : {};
      sim.hitMonster(p, t, rc.dmg / 100, { noExtra: true, noElem: true, ...kb, ...slow, ...(rc.stun > 0 ? { stun: rc.stun } : {}) });
    } else {
      // No damage: a slow goes on as hitMonster would put it (the stronger one stays for its time).
      if (rc.slow > 0 && rc.slowSec > 0) {
        t.slowAmt = Math.max(t.slowT > 0 ? t.slowAmt : 0, rc.slow / 100);
        t.slowT = Math.max(t.slowT, rc.slowSec);
      }
      // No damage: the stun and knockback go on as hitMonster would put them (bosses take 30% of a stun, pattern bosses none, knockback never moves a boss).
      if (rc.stun > 0 && !t.def.pattern) t.stunT = Math.max(t.stunT, t.isBoss ? rc.stun * 0.3 : rc.stun);
      if (rc.kb > 0 && !t.isBoss && !t.def.anchored) t.knockback(m.x, m.z, rc.kb * KB_PER_METRE);
    }
    if (t.alive && rc.dot > 0 && rc.dotSec > 0) addDot(sim, p, t, `el_${rid}`, rc.dot / 100, rc.dotSec);
  }
}
