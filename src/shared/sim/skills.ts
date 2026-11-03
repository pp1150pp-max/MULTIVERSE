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

const aimAngle = (p: Player, aim: Vec2) => Math.atan2(aim.z - p.z, aim.x - p.x);

export function basicAttack(sim: Sim, p: Player, aim: Vec2): void {
  const ang = aimAngle(p, aim);
  switch (p.cls.id) {
    case 'sword': {
      const range = 2.3;
      const arc = Math.PI * 0.75;
      sim.fx('slash', p.x, p.z, ang, arc, range, '#ffe6a0');
      forCone(sim, p.x, p.z, ang, arc, range, (m) => sim.hitMonster(p, m, 1, { kb: 3 }));
      break;
    }
    case 'mage':
      sim.addProjectile(p, { x: p.x, z: p.z, angle: ang, speed: 16, range: 11, radius: 0.35, mult: 1, color: '#9fd8ff', size: 0.7 });
      break;
    case 'gunslinger': {
      const spread = (Math.random() - 0.5) * 0.06;
      sim.addProjectile(p, { x: p.x, z: p.z, angle: ang + spread, speed: 26, range: 12, radius: 0.3, mult: 1, color: '#ffe08a', size: 0.45, kb: 1 });
      sim.fx('puff', p.x + Math.cos(ang) * 0.6, 0.9, p.z + Math.sin(ang) * 0.6, '#fff2b0', 0.08, 0.7);
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
      sim.fx('slash', p.x, p.z, ang, Math.PI * 2, 3.2, '#ffd27a');
      sim.fx('ring', p.x, p.z, 3.2, '#ffd27a', 0.3);
      sim.schedule(0.12, () => sim.fx('slash', p.x, p.z, ang + Math.PI, Math.PI * 2, 3.2, '#fff0c0'));
      forCircle(sim, p.x, p.z, 3.2, (m) => sim.hitMonster(p, m, 1.8, { kb: 5 }));
      return true;
    case 'charge':
      p.startDash(Math.cos(ang), Math.sin(ang), 7, 0.3, 'charge');
      return true;
    case 'earthquake':
      sim.fx('disc', p.x, p.z, 4.5, '#ffb050', 0.4);
      sim.fx('ring', p.x, p.z, 4.5, '#ffd27a', 0.5);
      sim.fx('burst', p.x, 0.3, p.z, '#c9a27a', 20, 7);
      sim.shake(0.5);
      forCircle(sim, p.x, p.z, 4.5, (m) => sim.hitMonster(p, m, 3, { stun: 1.5, kb: 3 }));
      return true;

    // ---------------- Mage
    case 'fireball':
      sim.addProjectile(p, { x: p.x, z: p.z, angle: ang, speed: 13, range: 12, radius: 0.45, mult: 2.2, color: '#ff7a2a', size: 1.1, explode: 2.6 });
      return true;
    case 'frostnova':
      sim.fx('disc', p.x, p.z, 4.5, '#7fd8ff', 0.5);
      sim.fx('ring', p.x, p.z, 4.5, '#c8f0ff', 0.5);
      sim.fx('burst', p.x, 0.5, p.z, '#c8f0ff', 18, 6);
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
        sim.fx('disc', tx, tz, 3.5, '#ff6a1a', 0.5);
        sim.fx('ring', tx, tz, 3.8, '#ffd27a', 0.5);
        sim.fx('burst', tx, 0.5, tz, '#ff8a2a', 22, 7);
        sim.shake(0.5);
        forCircle(sim, tx, tz, 3.5, (m) => sim.hitMonster(p, m, 4.5, { stun: 0.8, kb: 4, fromX: tx, fromZ: tz }));
      });
      return true;
    }

    // ---------------- Gunslinger
    case 'spread':
      for (let i = -2; i <= 2; i++) {
        sim.addProjectile(p, { x: p.x, z: p.z, angle: ang + i * 0.16, speed: 22, range: 9, radius: 0.32, mult: 0.9, color: '#ffc85a', size: 0.5, kb: 3 });
      }
      sim.fx('puff', p.x + Math.cos(ang) * 0.7, 0.9, p.z + Math.sin(ang) * 0.7, '#fff2b0', 0.12, 1.4);
      return true;
    case 'pierce':
      sim.addProjectile(p, { x: p.x, z: p.z, angle: ang, speed: 34, range: 16, radius: 0.45, mult: 2.6, color: '#7affe0', size: 0.9, pierce: true, kb: 5 });
      sim.fx('lineTelegraph', p.x, p.z, ang, 16, 0.25, 0.15);
      return true;
    case 'bulletrain': {
      let tx = aim.x;
      let tz = aim.z;
      const d = Math.hypot(tx - p.x, tz - p.z);
      if (d > 11) {
        tx = p.x + ((tx - p.x) / d) * 11;
        tz = p.z + ((tz - p.z) / d) * 11;
      }
      sim.fx('telegraph', tx, tz, 3.5, 1.5, '#ffd27a');
      for (let i = 0; i < 6; i++) {
        sim.schedule(0.1 + i * 0.25, () => {
          for (let j = 0; j < 5; j++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 3.3;
            sim.fx('puff', tx + Math.cos(a) * r, 0.3, tz + Math.sin(a) * r, '#ffe08a', 0.2, 0.8);
          }
          forCircle(sim, tx, tz, 3.5, (m) => sim.hitMonster(p, m, 0.9, {}));
        });
      }
      return true;
    }
  }
  return false;
}
