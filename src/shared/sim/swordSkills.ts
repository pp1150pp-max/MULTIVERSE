// What the Swordsman's 30 skills do (owner approved 2026-11-14, docs/plans/sword-skills.md). Called from castSkill
// (sim/skills.ts) with the skill's numbers at its rank. Runs on the server's Sim only: every hit goes through
// Sim.hitMonster (crit, defense, boss rules, aggro), every buff is a Player status. No new art: the existing
// sword effects (slash, whirlwind, charge, quake, crater, impact) and coloured rings, discs and bursts.
import type { Sim } from './Sim';
import type { Player } from './Player';
import type { Monster } from './Monster';
import type { SkillDef } from '../data/classes';
import type { Vec2 } from '../types';
import { forCircle, forCone } from './skills';

/** The skill's numbers at its rank, worked out by castSkill. */
export interface CastCtx {
  /** Aim angle at the cast. */
  ang: number;
  /** Damage × ATK of each hit. */
  dmg: number;
  /** One of the skill's own numbers (status ones grown by rank). */
  P: (key: string) => number;
  /** Its reach: range, radius around the player or dash length. */
  far: number;
}

const LINE_COLOR = ['#ff7a4a', '#7ad8ff', '#ffcf5a'];
const deg = (d: number) => (d * Math.PI) / 180;
/** The usual sword swing: the basic attack's arc. */
const SWING = Math.PI * 0.75;

/** Monsters within `width` of the segment from (x, z) along `angle` for `len`. */
function forLine(sim: Sim, x: number, z: number, angle: number, len: number, width: number, fn: (m: Monster) => void): void {
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  for (const m of sim.monsters) {
    if (!m.alive) continue;
    const t = (m.x - x) * dx + (m.z - z) * dz;
    if (t < -m.radius || t > len + m.radius) continue;
    const off = Math.abs((m.z - z) * dx - (m.x - x) * dz);
    if (off <= width + m.radius) fn(m);
  }
}

/** Living, hittable monsters within `r` of (x, z), nearest first. */
function monstersAround(sim: Sim, x: number, z: number, r: number): Monster[] {
  return sim.monsters
    .filter((m) => m.alive && !m.untargetable && Math.hypot(m.x - x, m.z - z) <= r + m.radius)
    .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
}

/** A swing in front: the coloured arc plus the sword's slash. */
function swingFx(sim: Sim, p: Player, ang: number, range: number, arc: number, color: string): void {
  sim.fx('slash', p.x, p.z, ang, arc, range, color);
  sim.fx('effect', 'slash', p.x + Math.cos(ang) * range * 0.55, p.z + Math.sin(ang) * range * 0.55, ang, range * 0.8);
}

/** A point within `far` of the player, towards the mouse. */
function clampTo(p: Player, aim: Vec2, far: number): Vec2 {
  const d = Math.hypot(aim.x - p.x, aim.z - p.z);
  if (d <= far) return { x: aim.x, z: aim.z };
  return { x: p.x + ((aim.x - p.x) / d) * far, z: p.z + ((aim.z - p.z) / d) * far };
}

/** A hitting dash (Charge and the Gale line): hits each monster it passes once. */
function hitDash(p: Player, ang: number, dist: number, time: number, mult: number, kb: number, taunt: boolean): void {
  p.chargeMult = mult;
  p.chargeKb = kb;
  p.chargeTaunt = taunt;
  p.startDash(Math.cos(ang), Math.sin(ang), dist, time, 'charge');
}

/**
 * Casts a sword skill. Returns false if it could not be used (nothing is spent), undefined if `sk` is not a sword
 * skill.
 */
export function castSword(sim: Sim, p: Player, sk: SkillDef, aim: Vec2, c: CastCtx): boolean | undefined {
  const { ang, dmg, P, far } = c;
  const color = LINE_COLOR[sk.line ?? 0];
  switch (sk.id) {
    // ---------------- Line 0: Blade
    case 'whirlwind':
      sim.fx('effect', 'whirlwind', p.x, p.z, ang, 3.4);
      // Set first so the spin's own hits heal too.
      // Heals for a share of all damage dealt for a few seconds (recasting restarts the timer).
      p.lifesteal = P('lifesteal') / 100;
      p.lifestealUntil = sim.time + P('lifestealTime');
      forCircle(sim, p.x, p.z, far, (m) => sim.hitMonster(p, m, dmg, { kb: 5 }));
      // A moment of taking no damage at all.
      p.invulnT = Math.max(p.invulnT, P('guard'));
      sim.fx('ring', p.x, p.z, 1.3, '#ffcf5a', P('guard'));
      return true;
    case 'sw_heavyslash': {
      const arc = deg(P('arc'));
      swingFx(sim, p, ang, far, arc, color);
      forCone(sim, p.x, p.z, ang, arc, far, (m) => sim.hitMonster(p, m, dmg, { kb: 4 }));
      return true;
    }
    case 'sw_sunder':
      swingFx(sim, p, ang, far, SWING, '#ffb05a');
      forCone(sim, p.x, p.z, ang, SWING, far, (m) => sim.hitMonster(p, m, dmg, { kb: 2, armorBreak: P('armorBreak') / 100, armorBreakT: P('armorBreakTime') }));
      return true;
    case 'sw_swordwave':
      // A blade of light through everything in its line.
      sim.addProjectile(p, { x: p.x, z: p.z, angle: ang, speed: 18, range: far, radius: 0.8, mult: dmg, color, size: 1.3, pierce: true, kb: 3 });
      sim.fx('effect', 'slash', p.x + Math.cos(ang) * 1.2, p.z + Math.sin(ang) * 1.2, ang, 1.6);
      return true;
    case 'sw_execute': {
      const arc = Math.PI * 0.6;
      swingFx(sim, p, ang, far, arc, '#ff4a3a');
      const below = P('below') / 100;
      forCone(sim, p.x, p.z, ang, arc, far, (m) => {
        // Low HP: more damage (bosses get a share of the bonus).
        const low = m.hp < m.maxHp * below;
        const bonus = low ? (P('bonus') / 100) * (m.isBoss ? P('bossShare') / 100 : 1) : 0;
        if (low) sim.text(m.x, m.topY + 0.4, m.z, 'ประหาร!', 'crit', 0.8);
        sim.hitMonster(p, m, dmg * (1 + bonus), { kb: 3 });
      });
      return true;
    }
    case 'sw_flurry': {
      const hits = Math.max(1, Math.round(P('hits')));
      const gap = P('time') / hits;
      for (let i = 0; i < hits; i++) {
        sim.schedule(i * gap, () => {
          if (!p.alive) return;
          const a = p.aimAngle();
          swingFx(sim, p, a, far, Math.PI * 0.6, color);
          forCone(sim, p.x, p.z, a, Math.PI * 0.6, far, (m) => sim.hitMonster(p, m, dmg, { kb: 0.5 }));
        });
      }
      return true;
    }
    case 'sw_bladering': {
      const waves = Math.max(1, Math.round(P('waves')));
      for (let i = 0; i < waves; i++) {
        sim.schedule(i * P('gap'), () => {
          if (!p.alive) return;
          sim.fx('effect', 'whirlwind', p.x, p.z, ang, far * 1.05);
          sim.fx('ring', p.x, p.z, far, color, 0.4);
          forCircle(sim, p.x, p.z, far, (m) => sim.hitMonster(p, m, dmg, { kb: 3 }));
        });
      }
      return true;
    }
    case 'sw_crush': {
      // A leap onto the spot: the blow lands a moment later.
      const t = clampTo(p, aim, far);
      const r = P('radius');
      sim.fx('telegraph', t.x, t.z, r, 0.25, color);
      sim.schedule(0.25, () => {
        if (!p.alive) return;
        sim.fx('effect', 'crater', t.x, t.z, 0, r * 1.5);
        sim.shake(0.4, { to: p.id });
        forCircle(sim, t.x, t.z, r, (m) => sim.hitMonster(p, m, dmg * (m.isBoss ? 1 + P('bossBonus') / 100 : 1), { kb: 4, fromX: t.x, fromZ: t.z }));
      });
      return true;
    }
    case 'sw_unleash': {
      // Stand and gather, then let it all out around the player.
      const wait = P('charge');
      p.rootT = Math.max(p.rootT, wait);
      sim.fx('telegraph', p.x, p.z, far, wait, color);
      sim.schedule(wait, () => {
        if (!p.alive) return;
        sim.fx('effect', 'quake', p.x, p.z, 0, far * 1.1);
        sim.fx('effect', 'explosion', p.x, p.z, 0, far * 0.7);
        sim.shake(0.6, { to: p.id });
        forCircle(sim, p.x, p.z, far, (m) => sim.hitMonster(p, m, dmg, { stun: P('stun'), kb: 6 }));
        sim.anim(p.id, 'attack', { duration: 0.3 });
      });
      return true;
    }
    case 'sw_judgement': {
      const t = clampTo(p, aim, far);
      const r = P('radius');
      const delay = P('delay');
      sim.fx('telegraph', t.x, t.z, r, delay, '#ff6a3a');
      sim.schedule(delay, () => {
        sim.fx('effect', 'crater', t.x, t.z, 0, r * 1.4);
        sim.fx('effect', 'slash', t.x, t.z, -Math.PI / 2, r * 1.2);
        sim.shake(0.6, { to: p.id });
        forCircle(sim, t.x, t.z, r, (m) => sim.hitMonster(p, m, dmg, {
          kb: 4, fromX: t.x, fromZ: t.z, armorBreak: P('armorBreak') / 100, armorBreakT: P('armorBreakTime'),
        }));
      });
      return true;
    }

    // ---------------- Line 1: Gale. Every dash takes no damage on the way (Player.startDash).
    case 'charge':
      hitDash(p, ang, far, 0.3, dmg, 9, true);
      sim.fx('effect', 'charge', p.x + Math.cos(ang), p.z + Math.sin(ang), ang, 1.6);
      return true;
    case 'sw_triple': {
      const fin = P('finisher');
      for (let i = 0; i < 3; i++) {
        sim.schedule(i * 0.2, () => {
          if (!p.alive) return;
          const a = p.aimAngle();
          const last = i === 2;
          swingFx(sim, p, a, far, SWING, last ? '#ffffff' : color);
          forCone(sim, p.x, p.z, a, SWING, far, (m) => sim.hitMonster(p, m, last ? dmg * fin : dmg, { kb: last ? 5 : 1 }));
        });
      }
      return true;
    }
    case 'sw_backstep':
      swingFx(sim, p, ang, far, SWING, color);
      forCone(sim, p.x, p.z, ang, SWING, far, (m) => sim.hitMonster(p, m, dmg, { kb: 3, slow: P('slow') / 100, slowT: P('slowTime') }));
      p.startDash(-Math.cos(ang), -Math.sin(ang), P('back'), 0.2, 'dash');
      // Keep facing the enemies while hopping back.
      p.face(Math.cos(ang), Math.sin(ang));
      return true;
    case 'sw_hunt':
      hitDash(p, ang, far, 0.25, dmg, 3, false);
      p.addStatBuff('sw_hunt', P('buffTime'), { atkSpeed: P('atkSpeed') });
      sim.fx('effect', 'charge', p.x + Math.cos(ang), p.z + Math.sin(ang), ang, 1.4);
      return true;
    case 'sw_spindodge': {
      p.startDash(Math.cos(ang), Math.sin(ang), far, 0.18, 'dash');
      const r = P('spin');
      sim.schedule(0.2, () => {
        if (!p.alive) return;
        sim.fx('effect', 'whirlwind', p.x, p.z, ang, r * 1.05);
        forCircle(sim, p.x, p.z, r, (m) => sim.hitMonster(p, m, dmg, { kb: 4 }));
      });
      return true;
    }
    case 'sw_bladedance': {
      const steps = Math.max(1, Math.round(P('steps')));
      const r = P('spin');
      for (let i = 0; i < steps; i++) {
        sim.schedule(i * 0.2, () => {
          if (!p.alive) return;
          const a = i === 0 ? ang : p.aimAngle();
          p.startDash(Math.cos(a), Math.sin(a), far / steps, 0.14, 'dash');
          sim.schedule(0.15, () => {
            if (!p.alive) return;
            sim.fx('effect', 'whirlwind', p.x, p.z, a, r * 1.05);
            forCircle(sim, p.x, p.z, r, (m) => sim.hitMonster(p, m, dmg, { kb: 2 }));
          });
        });
      }
      return true;
    }
    case 'sw_shadowstep': {
      p.startDash(Math.cos(ang), Math.sin(ang), far, 0.12, 'dash');
      const r = P('spin');
      sim.schedule(0.14, () => {
        if (!p.alive) return;
        sim.fx('burst', p.x, 1, p.z, '#8a7aff', 10, 3);
        sim.fx('effect', 'whirlwind', p.x, p.z, ang, r * 1.05);
        forCircle(sim, p.x, p.z, r, (m) => sim.hitMonster(p, m, dmg, { kb: 3 }));
        p.addStatBuff('sw_shadowstep', P('buffTime'), { crit: P('crit') });
      });
      return true;
    }
    case 'sw_overdrive':
      p.addStatBuff('sw_overdrive', P('buffTime'), { atkSpeed: P('atkSpeed'), moveSpeed: P('moveSpeed') });
      sim.fx('ring', p.x, p.z, 1.4, color, 0.6);
      sim.fx('burst', p.x, 1, p.z, color, 12, 3);
      sim.text(p.x, p.topY + 0.4, p.z, 'เร่งเครื่อง!', 'info', 0.8);
      return true;
    case 'sw_shadowswap': {
      // Strike the nearest few, one after another, taking no damage the whole time.
      const targets = monstersAround(sim, p.x, p.z, far).slice(0, Math.max(1, Math.round(P('targets'))));
      if (!targets.length) {
        sim.text(p.x, p.topY, p.z, 'ไม่มีเป้าหมาย', 'info', 0.8, p.id);
        return false;
      }
      const step = 0.22;
      p.invulnT = Math.max(p.invulnT, targets.length * step + 0.2);
      targets.forEach((m, i) => {
        sim.schedule(i * step, () => {
          if (!p.alive || !m.alive) return;
          const dx = m.x - p.x;
          const dz = m.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d > m.radius + 0.9) p.startDash(dx, dz, d - m.radius - 0.8, 0.12, 'dash');
          sim.schedule(0.13, () => {
            if (!p.alive || !m.alive) return;
            const a = Math.atan2(m.z - p.z, m.x - p.x);
            sim.fx('effect', 'slash', m.x, m.z, a, 1.4);
            sim.fx('burst', m.x, 1, m.z, color, 6, 3);
            sim.hitMonster(p, m, dmg, { kb: 2 });
          });
        });
      });
      return true;
    }
    case 'sw_thousandcuts': {
      if (!monstersAround(sim, p.x, p.z, far).length) {
        sim.text(p.x, p.topY, p.z, 'ไม่มีเป้าหมาย', 'info', 0.8, p.id);
        return false;
      }
      const hits = Math.max(1, Math.round(P('hits')));
      const time = P('time');
      p.invulnT = Math.max(p.invulnT, time + 0.1);
      p.rootT = Math.max(p.rootT, time);
      sim.fx('ring', p.x, p.z, far, color, time);
      for (let i = 0; i < hits; i++) {
        sim.schedule((i * time) / hits, () => {
          if (!p.alive) return;
          const near = monstersAround(sim, p.x, p.z, far);
          const m = near[Math.floor(Math.random() * near.length)];
          if (!m) return;
          sim.fx('effect', 'slash', m.x, m.z, Math.random() * Math.PI * 2, 1.3);
          sim.hitMonster(p, m, dmg, { kb: 1 });
        });
      }
      return true;
    }

    // ---------------- Line 2: Bulwark
    case 'earthquake':
      sim.fx('effect', 'quake', p.x, p.z, 0, 4.8);
      sim.shake(0.5, { to: p.id });
      forCircle(sim, p.x, p.z, far, (m) => sim.hitMonster(p, m, dmg, { stun: P('stun'), kb: 3 }));
      return true;
    case 'sw_armorbash':
      // An armoured shoulder (the sword has no shield, owner 2026-11-14).
      sim.fx('effect', 'impact', p.x + Math.cos(ang) * far * 0.6, p.z + Math.sin(ang) * far * 0.6, ang, 1.4);
      forCone(sim, p.x, p.z, ang, Math.PI * 0.5, far, (m) => sim.hitMonster(p, m, dmg, { stun: P('stun'), kb: 8 }));
      return true;
    case 'sw_taunt':
      // Every monster around turns on the player, bosses too.
      forCircle(sim, p.x, p.z, far, (m) => {
        m.taunt(p);
        sim.text(m.x, m.topY + 0.4, m.z, '!', 'crit', 0.6);
      });
      p.addTakenMult(1 - P('less') / 100, P('buffTime'));
      sim.fx('ring', p.x, p.z, far, color, 0.5);
      return true;
    case 'sw_guard':
      p.addTakenMult(1 - P('less') / 100, P('buffTime'));
      sim.fx('ring', p.x, p.z, 1.3, color, P('buffTime'));
      sim.text(p.x, p.topY + 0.4, p.z, 'ตั้งรับ', 'info', 0.8);
      return true;
    case 'sw_shockwave': {
      // A crack running along the ground, hitting everything in its line at once.
      sim.fx('lineTelegraph', p.x, p.z, ang, far, 1.2, 0.25);
      for (let d = 1.5; d <= far; d += 2) sim.fx('effect', 'quake', p.x + Math.cos(ang) * d, p.z + Math.sin(ang) * d, 0, 1.6);
      forLine(sim, p.x, p.z, ang, far, 1, (m) => sim.hitMonster(p, m, dmg, { kb: 2, slow: P('slow') / 100, slowT: P('slowTime') }));
      return true;
    }
    case 'sw_thorns':
      p.reflect = P('reflect') / 100;
      p.reflectUntil = sim.time + P('buffTime');
      p.addTakenMult(1 - P('less') / 100, P('buffTime'));
      sim.fx('ring', p.x, p.z, 1.3, '#ff8a5a', P('buffTime'));
      sim.text(p.x, p.topY + 0.4, p.z, 'เกราะสะท้อน', 'info', 0.8);
      return true;
    case 'sw_anchor':
      p.addTakenMult(1 - P('less') / 100, P('buffTime'));
      p.steadyUntil = sim.time + P('buffTime');
      p.addStatBuff('sw_anchor', P('buffTime'), { moveSpeed: -P('moveSlow') });
      sim.fx('effect', 'quake', p.x, p.z, 0, 1.6);
      sim.fx('ring', p.x, p.z, 1.3, color, P('buffTime'));
      return true;
    case 'sw_warcry': {
      // Everyone standing in the circle, party or not (owner 2026-11-14).
      const t = P('buffTime');
      for (const q of sim.players) {
        if (!q.alive || Math.hypot(q.x - p.x, q.z - p.z) > far) continue;
        // The defense bonus is a share of the defense without this buff (a recast doesn't stack on itself).
        q.statBuffs = q.statBuffs.filter((b) => b.id !== 'sw_warcry');
        q.recompute();
        q.addStatBuff('sw_warcry', t, { def: (q.stats.def * P('def')) / 100 });
        q.addDmgMult(1 + P('atk') / 100, t);
        sim.text(q.x, q.topY + 0.4, q.z, 'ปลุกใจ!', 'info', 0.8);
      }
      sim.fx('ring', p.x, p.z, far, color, 0.6);
      sim.fx('burst', p.x, 1.2, p.z, color, 14, 4);
      return true;
    }
    case 'sw_cataclysm': {
      // Three quakes growing out from the player (3/7, 5/7 and all of the reach): close enemies are hit by each.
      [3 / 7, 5 / 7, 1].forEach((share, i) => {
        sim.schedule(i * P('gap'), () => {
          if (!p.alive) return;
          const r = far * share;
          sim.fx('effect', 'quake', p.x, p.z, 0, r * 1.05);
          sim.shake(0.4, { to: p.id });
          forCircle(sim, p.x, p.z, r, (m) => sim.hitMonster(p, m, dmg, { stun: P('stun'), slow: P('slow') / 100, slowT: P('slowTime'), kb: 2 }));
        });
      });
      return true;
    }
    case 'sw_unbreakable': {
      const t = P('buffTime');
      forCircle(sim, p.x, p.z, far, (m) => m.taunt(p));
      p.addTakenMult(1 - P('less') / 100, t);
      sim.fx('ring', p.x, p.z, far, color, 0.6);
      sim.fx('ring', p.x, p.z, 1.4, '#ffe08a', t);
      sim.text(p.x, p.topY + 0.4, p.z, 'ราชันย์ไม่ล้ม!', 'crit', 1);
      // Heals a share of max HP over the whole time, in half-second ticks.
      const ticks = Math.max(1, Math.round(t / 0.5));
      for (let i = 1; i <= ticks; i++) {
        sim.schedule((i * t) / ticks, () => {
          if (!p.alive) return;
          const heal = Math.floor(Math.min(p.maxHp - p.hp, (p.maxHp * P('heal')) / 100 / ticks));
          if (heal > 0) {
            p.hp += heal;
            sim.text(p.x, p.topY, p.z, `+${heal}`, 'heal', 0.6);
          }
        });
      }
      return true;
    }
  }
  return undefined;
}
