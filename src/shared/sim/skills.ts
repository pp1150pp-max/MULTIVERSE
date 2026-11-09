import type { Sim } from './Sim';
import type { Player } from './Player';
import type { Monster } from './Monster';
import type { SkillDef } from '../data/classes';
import type { Vec2 } from '../types';

function forCircle(sim: Sim, x: number, z: number, r: number, fn: (m: Monster) => void): void {
  for (const m of sim.monsters) {
    if (m.alive && Math.hypot(m.x - x, m.z - z) <= r + m.radius) fn(m);
  }
}

function forCone(sim: Sim, x: number, z: number, angle: number, arc: number, r: number, fn: (m: Monster) => void): void {
  for (const m of sim.monsters) {
    if (!m.alive) continue;
    const dx = m.x - x;
    const dz = m.z - z;
    const d = Math.hypot(dx, dz);
    if (d > r + m.radius) continue;
    let diff = Math.atan2(dz, dx) - angle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) <= arc / 2 || d < m.radius + 0.4) fn(m);
  }
}

const RAPID_SHOTS = 3;
const RAPID_GAP = 0.08;
const HEADSHOT_AIM = 0.8;
const HEADSHOT_RANGE = 18;

/** Sword Q: seconds the spin keeps the player from taking any damage. */
const WHIRLWIND_GUARD = 0.6;
/** Sword Q also heals for a share of all damage dealt for a few seconds (recasting restarts the timer). */
const WHIRLWIND_LIFESTEAL = { share: 0.15, time: 3 };

const aimAngle = (p: Player, aim: Vec2) => Math.atan2(aim.z - p.z, aim.x - p.x);

export function basicAttack(sim: Sim, p: Player, aim: Vec2): void {
  const ang = aimAngle(p, aim);
  switch (p.cls.id) {
    case 'sword': {
      const range = 2.3;
      const arc = Math.PI * 0.75;
      sim.fx('effect', 'slash', p.x + Math.cos(ang) * range * 0.55, p.z + Math.sin(ang) * range * 0.55, ang, range * 0.8);
      forCone(sim, p.x, p.z, ang, arc, range, (m) => sim.hitMonster(p, m, 1, { kb: 3 }));
      break;
    }
    case 'mage':
      sim.addProjectile(p, { x: p.x, z: p.z, angle: ang, speed: 16, range: 11, radius: 0.35, mult: 1, color: '#9fd8ff', size: 0.7 });
      break;
    case 'gunslinger': {
      const spread = (Math.random() - 0.5) * 0.06;
      sim.addProjectile(p, { x: p.x, z: p.z, angle: ang + spread, speed: 26, range: 12, radius: 0.3, mult: 1, color: '#ffe08a', size: 0.45, kb: 1 });
      sim.fx('effect', 'muzzle', p.x + Math.cos(ang) * 0.9, p.z + Math.sin(ang) * 0.9, ang, 0.55);
      break;
    }
  }
}

/** Returns false if the skill could not be used (nothing was spent). */
export function castSkill(sim: Sim, p: Player, sk: SkillDef, aim: Vec2): boolean {
  const ang = aimAngle(p, aim);
  switch (sk.id) {
    // ---------------- Sword
    case 'whirlwind':
      sim.fx('effect', 'whirlwind', p.x, p.z, ang, 3.4);
      // Set first so the spin's own hits heal too.
      p.lifesteal = WHIRLWIND_LIFESTEAL.share;
      p.lifestealUntil = sim.time + WHIRLWIND_LIFESTEAL.time;
      forCircle(sim, p.x, p.z, 3.2, (m) => sim.hitMonster(p, m, 1.8, { kb: 5 }));
      p.invulnT = Math.max(p.invulnT, WHIRLWIND_GUARD);
      sim.fx('ring', p.x, p.z, 1.3, '#ffcf5a', WHIRLWIND_GUARD);
      return true;
    case 'earthquake':
      sim.fx('effect', 'quake', p.x, p.z, 0, 4.8);
      sim.shake(0.5, { to: p.id });
      forCircle(sim, p.x, p.z, 4.5, (m) => sim.hitMonster(p, m, 2, { stun: 1, kb: 3 }));
      return true;
    case 'charge':
      p.startDash(Math.cos(ang), Math.sin(ang), 7, 0.3, 'charge');
      sim.fx('effect', 'charge', p.x + Math.cos(ang), p.z + Math.sin(ang), ang, 1.6);
      return true;

    // ---------------- Mage
    case 'fireball':
      sim.addProjectile(p, { x: p.x, z: p.z, angle: ang, speed: 13, range: 12, radius: 0.45, mult: 2.2, color: '#ff7a2a', size: 1.1, explode: 2.6 });
      return true;
    case 'frostnova':
      sim.fx('effect', 'frost', p.x, p.z, 0, 4.8);
      forCircle(sim, p.x, p.z, 4.5, (m) => sim.hitMonster(p, m, 1.4, { slow: 0.5, slowT: 3 }));
      return true;
    case 'meteor': {
      let tx = aim.x;
      let tz = aim.z;
      const d = Math.hypot(tx - p.x, tz - p.z);
      if (d > 12) {
        tx = p.x + ((tx - p.x) / d) * 12;
        tz = p.z + ((tz - p.z) / d) * 12;
      }
      const delay = 0.8;
      sim.fx('telegraph', tx, tz, 3.5, delay, '#ff8a2a');
      sim.fx('meteor', tx, tz, delay);
      sim.schedule(delay, () => {
        sim.fx('effect', 'crater', tx, tz, 0, 4);
        sim.shake(0.5, { to: p.id });
        forCircle(sim, tx, tz, 3.5, (m) => sim.hitMonster(p, m, 4.5, { stun: 0.8, kb: 4, fromX: tx, fromZ: tz }));
      });
      return true;
    }

    // ---------------- Gunslinger
    case 'rapidfire':
      // Three shots in a quick burst. Each follows the current aim, so the burst can be swept.
      for (let i = 0; i < RAPID_SHOTS; i++) {
        sim.schedule(i * RAPID_GAP, () => {
          if (!p.alive) return;
          const a = i === 0 ? ang : p.aimAngle();
          const jitter = (Math.random() - 0.5) * 0.08;
          sim.addProjectile(p, { x: p.x, z: p.z, angle: a + jitter, speed: 28, range: 12, radius: 0.3, mult: 0.4, color: '#ffc85a', size: 0.45, kb: 1 });
          sim.fx('effect', 'muzzle', p.x + Math.cos(a) * 0.9, p.z + Math.sin(a) * 0.9, a, 0.6);
        });
      }
      return true;
    case 'pierce':
      // Armor-Piercing Round: stops at the first target and breaks its armor for everyone.
      sim.addProjectile(p, {
        x: p.x, z: p.z, angle: ang, speed: 34, range: 16, radius: 0.45, mult: 1.5, color: '#7affe0', size: 0.9, kb: 5,
        hit: { armorBreak: 0.2, armorBreakT: 3 },
      });
      sim.fx('effect', 'muzzle', p.x + Math.cos(ang) * 1.1, p.z + Math.sin(ang) * 1.1, ang, 0.9);
      return true;
    case 'headshot': {
      // Stand still and aim, then one sure critical shot along the line that was shown.
      p.rootT = HEADSHOT_AIM;
      sim.fx('lineTelegraph', p.x, p.z, ang, HEADSHOT_RANGE, 0.3, HEADSHOT_AIM);
      // The reticle locks on where the mouse is, kept on the line and within range.
      const reach = Math.min(HEADSHOT_RANGE, Math.max(1.5, Math.hypot(aim.x - p.x, aim.z - p.z)));
      sim.fx('effect', 'reticle', p.x + Math.cos(ang) * reach, p.z + Math.sin(ang) * reach, 0, 1.6);
      sim.schedule(HEADSHOT_AIM, () => {
        if (!p.alive) return;
        sim.addProjectile(p, {
          x: p.x, z: p.z, angle: ang, speed: 45, range: HEADSHOT_RANGE, radius: 0.5, mult: 2.5, color: '#ff6a5a', size: 1, kb: 6,
          hit: { forceCrit: true, maxMult: 4 },
          hitFx: { name: 'headshot_hit', size: 1.3 },
        });
        sim.fx('effect', 'muzzle', p.x + Math.cos(ang) * 1.1, p.z + Math.sin(ang) * 1.1, ang, 1.1);
        sim.sfx('headshot_fire', p.x, p.z);
        sim.anim(p.id, 'attack', { duration: 0.3 });
      });
      return true;
    }
  }
  return false;
}
