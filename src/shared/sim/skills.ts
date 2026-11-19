import type { Sim } from './Sim';
import type { Player } from './Player';
import type { Monster } from './Monster';
import type { SkillDef } from '../data/classes';
import type { Vec2 } from '../types';
import type { HitOpts } from './types';
import type { ProjOpts } from './Projectile';
import * as R from '../data/skillRanges';
import { rankedDmg, skillParam, skillReach, skillValues } from '../skillBook';
import { passiveOnBasic, passiveSkillScale } from '../passives';
import { castSword } from './swordSkills';
import { castHexSeed } from './hexSeed';
import { buffEnds, buffMask, noteSkillBuffs } from './debuffs';

// ------------------------------------------------------------ Gunslinger's basic shot and its buffs

/**
 * What the Gunslinger's basic shot does while the Rapid Fire line's buffs run (owner 2026-11-14: that line powers up
 * the auto shot and adds on-hit damage). Times are sim seconds; never saved, death clears them.
 */
export interface GunBuffs {
  /** Extra damage × ATK added to every basic shot, by the skill that gave it. */
  onHit: Record<string, { until: number; add: number }>;
  shock: { until: number; slow: number; slowT: number };
  /** Hitting the same monster again adds `per` × ATK a stack, up to `max` stacks. */
  stack: { until: number; per: number; max: number; target: number; n: number };
  split: { until: number; n: number; arc: number; side: number };
  pierceUntil: number;
  /** Bullet Storm: every basic shot is a fan of `n` pellets of `mult` × ATK each. */
  storm: { until: number; n: number; arc: number; mult: number };
  /** Double Tap: the next `left` basic shots fire a second bullet of `second` × the first. */
  double: { left: number; second: number };
}

export const emptyGunBuffs = (): GunBuffs => ({
  onHit: {},
  shock: { until: 0, slow: 0, slowT: 0 },
  stack: { until: 0, per: 0, max: 0, target: 0, n: 0 },
  split: { until: 0, n: 0, arc: 0, side: 0 },
  pierceUntil: 0,
  storm: { until: 0, n: 0, arc: 0, mult: 0 },
  double: { left: 0, second: 0 },
});

const DOUBLE_GAP = 0.08;

function gunBasic(sim: Sim, p: Player, ang: number): void {
  const g = p.gun;
  const t = sim.time;
  let onHit = 0;
  for (const b of Object.values(g.onHit)) if (b.until > t) onHit += b.add;
  const hit: HitOpts = {};
  if (g.shock.until > t) {
    hit.slow = g.shock.slow;
    hit.slowT = g.shock.slowT;
  }
  const stack = g.stack.until > t ? g.stack : null;
  const bonus = stack
    ? (m: Monster): number => {
      if (stack.target !== m.id) {
        stack.target = m.id;
        stack.n = 0;
      }
      const b = stack.n * stack.per;
      stack.n = Math.min(stack.max, stack.n + 1);
      return b;
    }
    : undefined;
  // The bullets of one shot: [angle offset, damage × ATK].
  let bullets: [number, number][] = [[0, 1 + onHit]];
  if (g.storm.until > t) bullets = fan(g.storm.n, g.storm.arc).map((a) => [a, g.storm.mult + onHit]);
  else if (g.split.until > t) bullets = fan(g.split.n, g.split.arc).map((a) => [a, (1 + onHit) * (a === 0 ? 1 : g.split.side)]);
  const buffed = onHit > 0 || bullets.length > 1 || g.pierceUntil > t || !!stack || hit.slow !== undefined;
  const fire = (scale: number, a0: number): void => {
    const spread = (Math.random() - 0.5) * 0.06;
    for (const [off, mult] of bullets) {
      sim.addProjectile(p, {
        x: p.x, z: p.z, angle: a0 + off + spread, speed: 26, range: R.SHOT_RANGE, radius: 0.3, mult: mult * scale,
        color: buffed ? '#ffb040' : '#ffe08a', size: 0.45, kb: 1, pierce: g.pierceUntil > t, hit, bonus,
      });
    }
    sim.fx('effect', 'muzzle', p.x + Math.cos(a0) * 0.9, p.z + Math.sin(a0) * 0.9, a0, 0.55);
  };
  fire(1, ang);
  if (g.double.left > 0) {
    g.double.left--;
    const second = g.double.second;
    sim.schedule(DOUBLE_GAP, () => {
      if (p.alive) fire(second, p.aimAngle());
    });
  }
}

/** `n` angle offsets spread evenly over `arc` radians, centred on 0 (the middle one is exactly 0 when n is odd). */
function fan(n: number, arc: number): number[] {
  const k = Math.max(1, Math.round(n));
  if (k === 1) return [0];
  return Array.from({ length: k }, (_, i) => -arc / 2 + (arc * i) / (k - 1));
}

/** The player is still in this world and alive (devices and lingering areas stop when they leave or die). */
const live = (sim: Sim, p: Player): boolean => p.alive && sim.players.includes(p);

/** Living monster nearest to (x, z) within `r` that `ok` accepts. */
function nearest(sim: Sim, x: number, z: number, r: number, ok: (m: Monster) => boolean = () => true): Monster | undefined {
  let best: Monster | undefined;
  let bd = Infinity;
  for (const m of sim.monsters) {
    if (!m.alive || m.untargetable || !ok(m)) continue;
    const d = Math.hypot(m.x - x, m.z - z) - m.radius;
    if (d <= r && d < bd) {
      bd = d;
      best = m;
    }
  }
  return best;
}

/** Runs `fn(i)` `times` times, `every` seconds apart (the first after `first`); `fn` returning false stops it. */
function repeat(sim: Sim, every: number, times: number, fn: (i: number) => boolean | void, first = every): void {
  const go = (i: number): void => {
    if (i >= times || fn(i) === false) return;
    sim.schedule(every, () => go(i + 1));
  };
  sim.schedule(first, () => go(0));
}

/** The mouse point, kept within `far` of the player. */
function clampPoint(p: Player, aim: Vec2, far: number): Vec2 {
  const d = Math.hypot(aim.x - p.x, aim.z - p.z);
  return d > far ? { x: p.x + ((aim.x - p.x) / d) * far, z: p.z + ((aim.z - p.z) / d) * far } : { x: aim.x, z: aim.z };
}

/**
 * A Gunslinger blast on the ground: the tech explosion and every monster in it hit. `special` = made bigger by the
 * Special Ammo passive, which shows its own ring too.
 */
function blast(sim: Sim, p: Player, x: number, z: number, r: number, mult: number, opts: HitOpts = {}, special = false): void {
  sim.fx('effect', 'gs_blast', x, z, 0, r);
  if (special) sim.fx('effect', 'gs_special', x, z, 0, r);
  forCircle(sim, x, z, r, (m) => sim.hitMonster(p, m, mult, { kb: 3, fromX: x, fromZ: z, ...opts }));
}

/** Stand still for `aimT` seconds showing the line, then `fire` (Headshot, Aimed Shot, Railgun). */
function aimThen(sim: Sim, p: Player, ang: number, far: number, aimT: number, fire: () => void): void {
  p.rootT = aimT;
  sim.fx('lineTelegraph', p.x, p.z, ang, far, 0.3, aimT);
  sim.schedule(aimT, () => {
    if (!p.alive) return;
    fire();
    sim.fx('effect', 'muzzle', p.x + Math.cos(ang) * 1.1, p.z + Math.sin(ang) * 1.1, ang, 1.1);
    sim.anim(p.id, 'attack', { duration: 0.3 });
  });
}

const shotFrom = (p: Player, ang: number, far: number, mult: number, extra: Partial<ProjOpts> = {}): ProjOpts =>
  ({ x: p.x, z: p.z, angle: ang, speed: 30, range: far, radius: 0.35, mult, color: '#ff5a6a', size: 0.6, kb: 2, ...extra });

export function forCircle(sim: Sim, x: number, z: number, r: number, fn: (m: Monster) => void): void {
  for (const m of sim.monsters) {
    if (m.alive && Math.hypot(m.x - x, m.z - z) <= r + m.radius) fn(m);
  }
}

export function forCone(sim: Sim, x: number, z: number, angle: number, arc: number, r: number, fn: (m: Monster) => void): void {
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

const RAPID_GAP = 0.08;

const aimAngle = (p: Player, aim: Vec2) => Math.atan2(aim.z - p.z, aim.x - p.x);

/**
 * A cue for the client's three.quarks particles (src/client/quarksHooks.ts ON_CUE) for what plays no picture: the basic
 * attack and the dash. A burst of 0 particles (the old client draws nothing for it), tagged with the skill by
 * asCaster; colour = the caster's class, speed = the angle. Only this one event is tagged, so nothing else about the
 * swing or the dash changes.
 */
export function quarksCue(sim: Sim, p: Player, skill: string, ang: number, x = p.x, z = p.z): void {
  sim.asCaster(p, () => sim.fx('burst', x, 0, z, p.cls.id, 0, ang), skill);
}

export function basicAttack(sim: Sim, p: Player, aim: Vec2): void {
  const ang = aimAngle(p, aim);
  quarksCue(sim, p, p.cls.skills.find((s) => s.kind === 'basic')!.id, ang);
  passiveOnBasic(sim, p);
  switch (p.cls.id) {
    case 'sword': {
      const range = R.SLASH_RANGE;
      const arc = Math.PI * 0.75;
      sim.fx('effect', 'slash', p.x + Math.cos(ang) * range * 0.55, p.z + Math.sin(ang) * range * 0.55, ang, range * 0.8);
      forCone(sim, p.x, p.z, ang, arc, range, (m) => sim.hitMonster(p, m, 1, { kb: 3 }));
      break;
    }
    case 'mage':
      sim.addProjectile(p, { x: p.x, z: p.z, angle: ang, speed: 16, range: R.BOLT_RANGE, radius: 0.35, mult: 1, color: '#9fd8ff', size: 0.7 });
      break;
    case 'gunslinger':
      gunBasic(sim, p, ang);
      break;
  }
}

// ------------------------------------------------------------ building blocks shared by skills (owner-approved
// mage table 2026-11-14). Every delayed step checks the caster is
// still alive and still in this sim (a zone change takes them out).

/** Runs `fn(i)` `times` times, `every` seconds apart from `first`, while the caster is still here. */
export function tickFor(sim: Sim, p: Player, every: number, times: number, fn: (i: number) => void, first = 0): void {
  for (let i = 0; i < times; i++) sim.schedule(first + i * every, () => { if (live(sim, p)) fn(i); });
}

/** Damage over time (burning / poison): `perTick` × ATK each second for `seconds`, through hitMonster (boss rules, crit, aggro). */
export function dot(sim: Sim, p: Player, m: Monster, perTick: number, seconds: number, sk: SkillDef, color: string): void {
  const ticks = Math.max(1, Math.round(seconds));
  m.dotUntil = Math.max(m.dotUntil, sim.time + ticks);
  m.debuffSkill = sk.id;
  tickFor(sim, p, 1, ticks, () => {
    if (!m.alive) return;
    sim.hitMonster(p, m, perTick, { skill: sk });
    sim.fx('puff', m.x, 0.9, m.z, color, 0.5, 0.5);
  }, 1);
}

/** Every living player (the caster too) within `r` of a point. Area buffs reach all of them, party or not (owner). */
function forPlayers(sim: Sim, x: number, z: number, r: number, fn: (q: Player) => void): void {
  for (const q of sim.players) if (q.alive && Math.hypot(q.x - x, q.z - z) <= r + q.radius) fn(q);
}

/** The mouse spot, pulled in to `far` from the caster. */
function landing(p: Player, aim: Vec2, far: number): Vec2 {
  const d = Math.hypot(aim.x - p.x, aim.z - p.z);
  return d <= far ? { x: aim.x, z: aim.z } : { x: p.x + ((aim.x - p.x) / d) * far, z: p.z + ((aim.z - p.z) / d) * far };
}

/** The living monster nearest a point within `r`, leaving out `skip`. */
function nearestTo(sim: Sim, x: number, z: number, r: number, skip?: Set<Monster>): Monster | null {
  let best: Monster | null = null;
  let bd = Infinity;
  for (const m of sim.monsters) {
    if (!m.alive || skip?.has(m)) continue;
    const d = Math.hypot(m.x - x, m.z - z) - m.radius;
    if (d <= r && d < bd) {
      bd = d;
      best = m;
    }
  }
  return best;
}

/** Monsters a skill can push or pull: not bosses (the same rule as knockback). */
const movable = (m: Monster): boolean => !m.isBoss && !m.def.pattern;

/** A random spot inside a circle. */
function spotIn(x: number, z: number, r: number): Vec2 {
  const a = Math.random() * Math.PI * 2;
  const d = Math.sqrt(Math.random()) * r;
  return { x: x + Math.cos(a) * d, z: z + Math.sin(a) * d };
}

/** A damage-absorbing shield on a player: the stronger one wins and the time refreshes. */
export function giveShield(sim: Sim, q: Player, amount: number, seconds: number): void {
  const hp = Math.round(amount);
  if (hp <= 0) return;
  q.shield = sim.time < q.shieldUntil ? Math.max(q.shield, hp) : hp;
  q.shieldUntil = sim.time + seconds;
  sim.fx('ring', q.x, q.z, 1.1, '#9fd8ff', seconds);
  sim.text(q.x, q.topY, q.z, `โล่ ${hp}`, 'info', 1);
}

/** Seconds a cast circle (curse, buff) stays on the ground, and the poison mist's cloud. */
const CIRCLE_ZONE = 1.6;
const MIST_ZONE = 2.5;

const FIRE = '#ff7a2a';
const VENOM = '#9be05a';
const FROST = '#7ab8ff';

/**
 * Returns false if the skill could not be used (nothing was spent). `rank` (1 up) scales the damage of every hit and
 * the status times (stun, slow, armor break, guard, lifesteal) by the skill's growth on the balance tab.
 */
export function castSkill(sim: Sim, p: Player, sk: SkillDef, aim: Vec2, rank = 1): boolean {
  // Whoever gains a buff from this cast (the caster, the party) shows this skill's magic circle.
  const before = sim.players.map((q) => buffMask(q, sim.time));
  const ends = sim.players.map((q) => buffEnds(q));
  // Everything the cast plays, now or later (timers, shots), is the caster's: see Sim.asCaster.
  const ok = sim.asCaster(p, () => cast(sim, p, sk, aim, rank), sk.id);
  sim.players.forEach((q, i) => {
    if (buffMask(q, sim.time) & ~(before[i] ?? 0)) q.buffSkill = sk.id;
    noteSkillBuffs(q, sk.id, ends[i] ?? {}, sim.time);
  });
  return ok;
}

function cast(sim: Sim, p: Player, sk: SkillDef, aim: Vec2, rank: number): boolean {
  const ang = aimAngle(p, aim);
  // The worn passive may scale a skill's damage and the size of its blasts (Gunslinger Special Ammo).
  const sc = passiveSkillScale(p, sk);
  const dmg = rankedDmg(sk, rank) * sc.dmg;
  // The skill's own numbers as tuned on /admin; status times (stun, slow, guard...) grown by rank.
  const P = (key: string): number => skillParam(sk, key, rank);
  /** A blast or area size, scaled by the passive. */
  const A = (key: string): number => P(key) * sc.area;
  /** Blasts made bigger by the worn passive (Gunslinger Special Ammo) show its ring. */
  const special = sc.area > 1;
  const reach = skillReach(sk);
  const far = reach ? (reach.kind === 'self' ? reach.radius : reach.range) : 0;
  // The Swordsman's 30 skills: sim/swordSkills.ts.
  const sword = castSword(sim, p, sk, aim, { ang, dmg, P, far });
  if (sword !== undefined) return sword;
  switch (sk.id) {
    // ---------------- Mage
    case 'fireball':
      sim.addProjectile(p, { x: p.x, z: p.z, angle: ang, speed: 13, range: far, radius: 0.45, mult: dmg, color: '#ff7a2a', size: 1.1, explode: P('blast'), hit: { skill: sk } });
      return true;
    case 'frostnova':
      sim.fx('effect', 'mg_frostnova', p.x, p.z, 0, far);
      forCircle(sim, p.x, p.z, far, (m) => sim.hitMonster(p, m, dmg, { slow: P('slow') / 100, slowT: P('slowTime'), skill: sk }));
      return true;
    case 'meteor': {
      let tx = aim.x;
      let tz = aim.z;
      const d = Math.hypot(tx - p.x, tz - p.z);
      if (d > far) {
        tx = p.x + ((tx - p.x) / d) * far;
        tz = p.z + ((tz - p.z) / d) * far;
      }
      const delay = 0.8;
      const radius = P('radius');
      const stun = P('stun');
      sim.fx('telegraph', tx, tz, radius, delay, '#ff8a2a');
      sim.fx('meteor', tx, tz, delay);
      sim.schedule(delay, () => {
        sim.fx('effect', 'crater', tx, tz, 0, 4);
        sim.shake(0.5, { to: p.id });
        forCircle(sim, tx, tz, radius, (m) => sim.hitMonster(p, m, dmg, { stun, kb: 4, fromX: tx, fromZ: tz, skill: sk }));
      });
      return true;
    }

    // Mage line 1: burst damage
    case 'mg_arcanelance':
      quarksCue(sim, p, sk.id, ang);
      sim.addProjectile(p, { x: p.x, z: p.z, angle: ang, speed: 22, range: far, radius: 0.5, mult: dmg, color: '#ffb06a', size: 1, pierce: true, kb: 2, hit: { skill: sk } });
      return true;
    case 'mg_chainlightning': {
      // The monster nearest the mouse that the caster can reach; nothing in reach = not cast (no MP spent).
      let cur: Monster | null = null;
      let bd = Infinity;
      for (const m of sim.monsters) {
        if (!m.alive || Math.hypot(m.x - p.x, m.z - p.z) > far + m.radius) continue;
        const d = Math.hypot(m.x - aim.x, m.z - aim.z);
        if (d < bd) {
          bd = d;
          cur = m;
        }
      }
      if (!cur) return false;
      const hit = new Set<Monster>();
      let mult = dmg;
      let fromX = p.x;
      let fromZ = p.z;
      const jumps = Math.round(P('jumps'));
      for (let i = 0; cur && i <= jumps; i++) {
        hit.add(cur);
        const len = Math.hypot(cur.x - fromX, cur.z - fromZ);
        sim.fx('lineTelegraph', fromX, fromZ, Math.atan2(cur.z - fromZ, cur.x - fromX), len, 0.25, 0.15);
        sim.fx('effect', 'mg_lightning', cur.x, cur.z, 0, 1.2);
        sim.fx('burst', cur.x, 1, cur.z, '#bfe0ff', 8, 3);
        sim.hitMonster(p, cur, mult, { skill: sk });
        fromX = cur.x;
        fromZ = cur.z;
        mult *= Math.max(0, 1 - P('falloff') / 100);
        cur = nearestTo(sim, fromX, fromZ, P('jumpRange'), hit);
      }
      return true;
    }
    case 'mg_manaburst': {
      const c = landing(p, aim, far);
      const r = P('radius');
      sim.fx('effect', 'mg_burst', c.x, c.z, 0, r);
      sim.fx('ring', c.x, c.z, r, FIRE, 0.4);
      forCircle(sim, c.x, c.z, r, (m) => sim.hitMonster(p, m, dmg, { kb: 3, fromX: c.x, fromZ: c.z, skill: sk }));
      return true;
    }
    case 'mg_flamewave': {
      const arc = (P('arc') * Math.PI) / 180;
      sim.fx('effect', 'mg_flamewave', p.x + Math.cos(ang) * far * 0.5, p.z + Math.sin(ang) * far * 0.5, ang, far * 0.5);
      forCone(sim, p.x, p.z, ang, arc, far, (m) => sim.hitMonster(p, m, dmg, { kb: 5, skill: sk }));
      return true;
    }
    case 'mg_volatileorb':
      sim.addProjectile(p, { x: p.x, z: p.z, angle: ang, speed: 8, range: far, radius: 0.6, mult: dmg, color: '#ff9a4a', size: 1.6, explode: P('blast'), hit: { skill: sk } });
      return true;
    case 'mg_crystalrain': {
      const c = landing(p, aim, far);
      const r = P('radius');
      const waves = Math.round(P('waves'));
      const gap = P('gap');
      sim.fx('telegraph', c.x, c.z, r, 0.2 + waves * gap, '#ffd0a0');
      tickFor(sim, p, gap, waves, () => {
        for (let k = 0; k < 3; k++) {
          const s = spotIn(c.x, c.z, r * 0.8);
          sim.fx('effect', 'mg_starhit', s.x, s.z, 0, 0.9);
        }
        forCircle(sim, c.x, c.z, r, (m) => sim.hitMonster(p, m, dmg, { skill: sk }));
      }, 0.2);
      return true;
    }
    case 'mg_chargedblast': {
      // Stand still to charge (like Headshot's aim), then the blast around the caster.
      const t = P('charge');
      p.rootT = t;
      sim.fx('telegraph', p.x, p.z, far, t, FIRE);
      sim.schedule(t, () => {
        if (!live(sim, p)) return;
        sim.fx('effect', 'mg_burst', p.x, p.z, 0, far);
        sim.shake(0.5, { to: p.id });
        sim.anim(p.id, 'attack', { duration: 0.3 });
        forCircle(sim, p.x, p.z, far, (m) => sim.hitMonster(p, m, dmg, { kb: 5, skill: sk }));
      });
      return true;
    }
    case 'mg_starfall': {
      const c = landing(p, aim, far);
      const r = P('radius');
      const sr = P('starRadius');
      const warn = 0.35;
      tickFor(sim, p, P('gap'), Math.round(P('stars')), () => {
        const s = spotIn(c.x, c.z, r);
        sim.fx('telegraph', s.x, s.z, sr, warn, '#ffe08a');
        sim.schedule(warn, () => {
          if (!live(sim, p)) return;
          sim.fx('effect', 'mg_starhit', s.x, s.z, 0, sr);
          forCircle(sim, s.x, s.z, sr, (m) => sim.hitMonster(p, m, dmg, { kb: 2, fromX: s.x, fromZ: s.z, skill: sk }));
        });
      });
      return true;
    }

    // Mage line 2: damage over time
    case 'mg_flameground': {
      const c = landing(p, aim, far);
      const r = P('radius');
      const ticks = Math.max(1, Math.round(P('duration')));
      sim.fx('zone', 'mg_firefield', c.x, c.z, r, ticks);
      tickFor(sim, p, 1, ticks, () => {
        forCircle(sim, c.x, c.z, r, (m) => {
          m.dotUntil = Math.max(m.dotUntil, sim.time + 1.1);
          m.debuffSkill = sk.id;
          sim.hitMonster(p, m, dmg, { skill: sk });
        });
      });
      return true;
    }
    case 'mg_poisonmist': {
      const c = landing(p, aim, far);
      const r = P('radius');
      sim.fx('zone', 'mg_poison', c.x, c.z, r, MIST_ZONE);
      forCircle(sim, c.x, c.z, r, (m) => dot(sim, p, m, dmg, P('dotTime'), sk, VENOM));
      return true;
    }
    case 'mg_searingmark': {
      const blast = P('blast');
      const delay = P('delay');
      // The shot itself does no damage: it brands the first monster, which blows up later.
      sim.addProjectile(p, {
        x: p.x, z: p.z, angle: ang, speed: 20, range: far, radius: 0.4, mult: 0, color: VENOM, size: 0.7, fxSkill: sk.id,
        after: (m) => {
          sim.fx('effect', 'mg_curse', m.x, m.z, 0, 1);
          sim.schedule(delay, () => {
            if (!live(sim, p)) return;
            sim.fx('effect', 'mg_burst', m.x, m.z, 0, blast);
            forCircle(sim, m.x, m.z, blast, (t) => sim.hitMonster(p, t, dmg, { kb: 3, fromX: m.x, fromZ: m.z, skill: sk }));
          });
        },
      });
      return true;
    }
    case 'mg_decayring': {
      const ticks = Math.max(1, Math.round(P('duration')));
      const ab = P('armorBreak') / 100;
      const abT = P('armorBreakTime');
      sim.fx('zone', 'mg_decay', p.x, p.z, far, ticks, p.id);
      tickFor(sim, p, 1, ticks, () => {
        forCircle(sim, p.x, p.z, far, (m) => {
          m.dotUntil = Math.max(m.dotUntil, sim.time + 1.1);
          m.debuffSkill = sk.id;
          sim.hitMonster(p, m, dmg, { armorBreak: ab, armorBreakT: abT, skill: sk });
        });
      });
      return true;
    }
    case 'mg_thunderstorm': {
      const c = landing(p, aim, far);
      const r = P('radius');
      const strikes = Math.round(P('strikes'));
      const every = P('every');
      sim.fx('ring', c.x, c.z, r, '#bfd0ff', 0.3 + strikes * every);
      tickFor(sim, p, every, strikes, () => {
        const inside = sim.monsters.filter((m) => m.alive && Math.hypot(m.x - c.x, m.z - c.z) <= r + m.radius);
        if (!inside.length) return;
        const m = inside[Math.floor(Math.random() * inside.length)];
        sim.fx('effect', 'mg_lightning', m.x, m.z, 0, 1.3);
        sim.fx('burst', m.x, 2, m.z, '#dfe8ff', 10, 4);
        sim.hitMonster(p, m, dmg, { skill: sk });
      }, 0.3);
      return true;
    }
    case 'mg_crystalspikes': {
      // Venom crystal (owner 2026-11-20): every `pulse` s it adds a poison stack (up to maxStacks) to every monster in
      // the circle and refreshes its poison; each stack hurts `dmg` × ATK a second, in or out of the circle, until its
      // poison runs out. When the crystal's time is up it shatters: whatever poison it left still to tick lands at once.
      const c = landing(p, aim, far);
      const r = P('radius');
      const every = P('pulse');
      const pulses = Math.max(1, Math.floor(P('life') / every + 1e-6));
      const life = pulses * every;
      const maxStacks = Math.max(1, Math.round(P('maxStacks')));
      const poisonLife = P('poisonLife');
      // Per monster: stacks, poison end, and how far its ticks have been paid.
      const venom = new Map<Monster, { n: number; until: number; paid: number }>();
      quarksCue(sim, p, sk.id, 0, c.x, c.z);
      // The crystal itself stands there the whole time (owner 2026-11-15: the spikes seemed to come from nowhere).
      sim.fx('crystal', c.x, c.z, life + 0.3, VENOM);
      tickFor(sim, p, every, pulses, () => {
        sim.fx('ring', c.x, c.z, r, VENOM, 0.45);
        sim.fx('puff', c.x, 1.1, c.z, VENOM, 0.3, 1.6);
        forCircle(sim, c.x, c.z, r, (m) => {
          const v = venom.get(m) ?? { n: 0, until: 0, paid: sim.time };
          v.n = Math.min(maxStacks, v.n + 1);
          v.until = sim.time + poisonLife;
          venom.set(m, v);
          m.dotUntil = Math.max(m.dotUntil, v.until);
          m.debuffSkill = sk.id;
        });
        // Each poisoned monster takes its stacks up to the next pulse (or until its poison ends).
        for (const [m, v] of venom) {
          // (A hair's breadth of float left over is no tick: every hit does at least 1.)
          if (!m.alive || !sim.monsters.includes(m) || v.until <= sim.time + 1e-6) {
            venom.delete(m);
            continue;
          }
          const span = Math.min(every, v.until - sim.time);
          v.paid = sim.time + span;
          sim.hitMonster(p, m, v.n * dmg * span, { skill: sk });
          sim.fx('puff', m.x, 0.9, m.z, VENOM, 0.5, 0.4 + 0.12 * v.n);
        }
      });
      sim.schedule(life, () => {
        if (!live(sim, p)) return;
        sim.fx('effect', 'mg_burst', c.x, c.z, 0, Math.min(r, 2.5));
        quarksCue(sim, p, sk.id, 0, c.x, c.z);
        for (const [m, v] of venom) {
          const left = v.until - v.paid > 1e-6 ? v.n * dmg * (v.until - v.paid) : 0;
          if (m.alive && sim.monsters.includes(m) && left > 0) {
            sim.fx('burst', m.x, 1, m.z, VENOM, 8, 3);
            sim.hitMonster(p, m, left, { skill: sk });
          }
        }
        venom.clear();
      });
      return true;
    }
    case 'mg_cursedash': {
      const arc = (P('arc') * Math.PI) / 180;
      const burn = P('dotTime');
      const weak = P('weak') / 100;
      const weakT = P('weakTime');
      sim.fx('effect', 'mg_ash', p.x + Math.cos(ang) * far * 0.5, p.z + Math.sin(ang) * far * 0.5, ang, far * 0.5);
      forCone(sim, p.x, p.z, ang, arc, far, (m) => {
        // The first burn lands at once and carries the attack-down; the rest burn each second.
        sim.hitMonster(p, m, dmg, { weak, weakT, skill: sk });
        dot(sim, p, m, dmg, burn, sk, FIRE);
      });
      return true;
    }
    case 'mg_hexseed': {
      // Stored-damage seed that jumps on its host's death (owner 2026-11-20): sim/hexSeed.ts.
      const c = landing(p, aim, far);
      return castHexSeed(sim, p, c.x, c.z, P('radius'), {
        sk, base: dmg, life: P('seedLife'), burst: P('burst'), jump: P('jump'), carry: P('carry') / 100,
        maxSeeds: Math.max(1, Math.round(P('maxSeeds'))), cap: P('cap'), bossShare: P('bossPct') / 100,
      });
    }
    case 'mg_firerain': {
      const c = landing(p, aim, far);
      const r = P('radius');
      const every = P('every');
      const hits = Math.max(1, Math.round(P('duration') / every));
      sim.fx('zone', 'mg_firefield', c.x, c.z, r, hits * every + 0.2);
      tickFor(sim, p, every, hits, () => {
        const s = spotIn(c.x, c.z, r * 0.8);
        sim.fx('burst', s.x, 2.5, s.z, FIRE, 8, 4);
        forCircle(sim, c.x, c.z, r, (m) => {
          m.dotUntil = Math.max(m.dotUntil, sim.time + every + 0.1);
          sim.hitMonster(p, m, dmg, { skill: sk });
        });
      }, 0.2);
      return true;
    }
    case 'mg_decayfield': {
      const ticks = Math.max(1, Math.round(P('duration')));
      const ab = P('armorBreak') / 100;
      const weak = P('weak') / 100;
      sim.fx('zone', 'mg_decay', p.x, p.z, far, ticks, p.id);
      tickFor(sim, p, 1, ticks, () => {
        // Statuses last a little past each tick, so they hold while the monster stays inside.
        forCircle(sim, p.x, p.z, far, (m) => {
          m.dotUntil = Math.max(m.dotUntil, sim.time + 1.1);
          m.debuffSkill = sk.id;
          sim.hitMonster(p, m, dmg, { armorBreak: ab, armorBreakT: 1.2, weak, weakT: 1.2, skill: sk });
        });
      });
      return true;
    }

    // Mage line 3: control / buffs. Buffs reach every player in the circle, party or not (owner 2026-11-14).
    case 'mg_forcewave':
      sim.fx('ring', p.x, p.z, far, FROST, 0.5);
      sim.fx('effect', 'mg_shock', p.x, p.z, 0, far);
      forCircle(sim, p.x, p.z, far, (m) => sim.hitMonster(p, m, dmg, { kb: P('push'), stun: P('stun'), skill: sk }));
      return true;
    case 'mg_frailcurse': {
      const c = landing(p, aim, far);
      const r = P('radius');
      sim.fx('zone', 'mg_curse', c.x, c.z, r, CIRCLE_ZONE);
      forCircle(sim, c.x, c.z, r, (m) => sim.hitMonster(p, m, dmg, { armorBreak: P('armorBreak') / 100, armorBreakT: P('armorBreakTime'), skill: sk }));
      return true;
    }
    case 'mg_icecage':
      sim.addProjectile(p, {
        x: p.x, z: p.z, angle: ang, speed: 20, range: far, radius: 0.45, mult: dmg, color: '#bfe6ff', size: 0.9, kb: 0,
        hit: { stun: P('stun'), skill: sk }, hitFx: { name: 'frost', size: 1.2 },
      });
      return true;
    case 'mg_gravitywell': {
      const c = landing(p, aim, far);
      const r = P('radius');
      const pullT = P('pullTime');
      // Pull speed (m/s) grows with rank: +pullRank % per rank above 1 (rank 10 ≈ instant). hold = 1 pins them at the centre.
      const pull = P('pull') * (1 + (P('pullRank') / 100) * Math.max(0, rank - 1));
      const hold = P('hold') >= 0.5;
      sim.fx('zone', 'mg_vortex', c.x, c.z, r, pullT);
      const step = hold ? 0.05 : 0.25;
      tickFor(sim, p, step, Math.max(1, Math.round(pullT / step)), () => {
        forCircle(sim, c.x, c.z, r, (m) => {
          if (!movable(m)) return;
          if (!hold) { m.knockback(c.x, c.z, -pull); return; }
          // Held: walk to a spot near the centre (spread by id so they do not stack) and stay until the blast.
          m.pinnedUntil = Math.max(m.pinnedUntil, sim.time + step * 2);
          m.kbx = m.kbz = 0;
          const a = m.id * 2.399963;
          const tx = c.x + Math.cos(a) * 0.9 * (0.3 + 0.7 * ((m.id * 7) % 10) / 10);
          const tz = c.z + Math.sin(a) * 0.9 * (0.3 + 0.7 * ((m.id * 7) % 10) / 10);
          const dx = tx - m.x;
          const dz = tz - m.z;
          const d = Math.hypot(dx, dz);
          const mv = Math.min(d, pull * step);
          if (d > 1e-4) { m.x += (dx / d) * mv; m.z += (dz / d) * mv; sim.terrain.resolve(m); }
        });
      });
      sim.schedule(pullT, () => {
        if (!live(sim, p)) return;
        sim.fx('effect', 'mg_burst', c.x, c.z, 0, r * 0.7);
        forCircle(sim, c.x, c.z, r, (m) => sim.hitMonster(p, m, dmg, { skill: sk }));
      });
      return true;
    }
    case 'mg_sealveil':
      sim.fx('zone', 'mg_curse', p.x, p.z, far, CIRCLE_ZONE, p.id);
      forCircle(sim, p.x, p.z, far, (m) => sim.hitMonster(p, m, dmg, { weak: P('weak') / 100, weakT: P('weakTime'), skill: sk }));
      return true;
    case 'mg_empowerfield': {
      const mult = 1 + P('dmgBonus') / 100;
      const t = p.buffTime(P('buffTime'));
      sim.fx('zone', 'mg_empower', p.x, p.z, far, CIRCLE_ZONE, p.id);
      forPlayers(sim, p.x, p.z, far, (q) => {
        q.dmgMult = sim.time < q.dmgUntil ? Math.max(q.dmgMult, mult) : mult;
        q.dmgUntil = sim.time + t;
        sim.fx('burst', q.x, 1.2, q.z, '#ffd34a', 8, 2);
        sim.text(q.x, q.topY, q.z, `ดาเมจ +${Math.round(P('dmgBonus'))}%`, 'info', 1);
      });
      return true;
    }
    case 'mg_manashield': {
      const t = p.buffTime(P('buffTime'));
      sim.fx('zone', 'mg_shield', p.x, p.z, far, CIRCLE_ZONE, p.id);
      forPlayers(sim, p.x, p.z, far, (q) => giveShield(sim, q, (q.maxHp * P('shieldPct')) / 100, t));
      return true;
    }
    case 'mg_timewarp': {
      // The cooldowns still running on Q/E/R skills drop at once (not Time Warp itself, the dash, basic attack or potions).
      const cutPct = Math.min(100, P('cdCut')); // grows with rank like other status numbers, never past 100%
      const cut = cutPct / 100;
      sim.fx('zone', 'mg_timewarp', p.x, p.z, far, CIRCLE_ZONE, p.id);
      forCircle(sim, p.x, p.z, far, (m) => sim.hitMonster(p, m, dmg, { slow: P('slow') / 100, slowT: P('slowTime'), skill: sk }));
      forPlayers(sim, p.x, p.z, far, (q) => {
        for (const s of q.cls.skills) {
          if ((s.kind !== 'normal' && s.kind !== 'ult') || s.id === 'mg_timewarp') continue;
          const left = q.cd[s.id] ?? 0;
          if (left > 0) q.cd[s.id] = left * (1 - cut);
        }
        sim.text(q.x, q.topY, q.z, `คูลดาวน์ -${Math.round(cutPct)}%`, 'info', 1);
      });
      return true;
    }
    case 'mg_manawell': {
      // A circle on the ground where the caster stands.
      const c = { x: p.x, z: p.z };
      const ticks = Math.max(1, Math.round(P('duration')));
      const slow = P('slow') / 100;
      forPlayers(sim, c.x, c.z, far, (q) => giveShield(sim, q, (q.maxHp * P('shieldPct')) / 100, ticks));
      sim.fx('zone', 'mg_shield', c.x, c.z, far, ticks);
      tickFor(sim, p, 1, ticks, () => {
        forPlayers(sim, c.x, c.z, far, (q) => {
          const add = Math.min(q.stats.maxMp - q.mp, (q.stats.maxMp * P('mpPct')) / 100);
          if (add <= 0) return;
          q.mp += add;
          sim.text(q.x, q.topY, q.z, `+${Math.round(add)} MP`, 'mana', 0.6);
        });
        // Slowed without a hit: no damage and no aggro.
        forCircle(sim, c.x, c.z, far, (m) => {
          m.slowAmt = slow;
          m.slowT = Math.max(m.slowT, 1.2);
        });
      });
      return true;
    }

    // ---------------- Gunslinger
    case 'rapidfire':
      // A quick burst of shots. Each follows the current aim, so the burst can be swept.
      for (let i = 0; i < Math.round(P('shots')); i++) {
        sim.schedule(i * RAPID_GAP, () => {
          if (!p.alive) return;
          const a = i === 0 ? ang : p.aimAngle();
          const jitter = (Math.random() - 0.5) * 0.08;
          sim.addProjectile(p, { x: p.x, z: p.z, angle: a + jitter, speed: 28, range: far, radius: 0.3, mult: dmg, color: '#ffc85a', size: 0.45, kb: 1 });
          sim.fx('effect', 'muzzle', p.x + Math.cos(a) * 0.9, p.z + Math.sin(a) * 0.9, a, 0.6);
        });
      }
      return true;
    case 'pierce':
      // Armor-Piercing Round: stops at the first target and breaks its armor for everyone.
      sim.addProjectile(p, {
        x: p.x, z: p.z, angle: ang, speed: 34, range: far, radius: 0.45, mult: dmg, color: '#7affe0', size: 0.9, kb: 5,
        hit: { armorBreak: P('armorBreak') / 100, armorBreakT: P('armorBreakTime') },
      });
      sim.fx('effect', 'muzzle', p.x + Math.cos(ang) * 1.1, p.z + Math.sin(ang) * 1.1, ang, 0.9);
      return true;
    case 'headshot': {
      // Stand still and aim, then one sure critical shot along the line that was shown.
      const aimT = P('aim');
      p.rootT = aimT;
      sim.fx('lineTelegraph', p.x, p.z, ang, far, 0.3, aimT);
      // The reticle locks on where the mouse is, kept on the line and within range.
      const lock = Math.min(far, Math.max(1.5, Math.hypot(aim.x - p.x, aim.z - p.z)));
      sim.fx('effect', 'reticle', p.x + Math.cos(ang) * lock, p.z + Math.sin(ang) * lock, 0, 1.6);
      sim.schedule(aimT, () => {
        if (!p.alive) return;
        sim.addProjectile(p, {
          x: p.x, z: p.z, angle: ang, speed: 45, range: far, radius: 0.5, mult: dmg, color: '#ff6a5a', size: 1, kb: 6,
          hit: { forceCrit: true }, fxSkill: sk.id,
          hitFx: { name: 'headshot_hit', size: 1.3 },
        });
        sim.fx('effect', 'muzzle', p.x + Math.cos(ang) * 1.1, p.z + Math.sin(ang) * 1.1, ang, 1.1);
        sim.sfx('headshot_fire', p.x, p.z);
        sim.anim(p.id, 'attack', { duration: 0.3 });
      });
      return true;
    }
    case 'gs_deadeye': {
      // Marks the monster it hits: this player crits it more easily for a while.
      const crit = P('markCrit');
      const time = P('markTime');
      sim.addProjectile(p, shotFrom(p, ang, far, dmg, {
        fxSkill: sk.id,
        after: (m) => {
          m.markBy = p.id;
          m.markUntil = sim.time + time;
          m.debuffSkill = sk.id;
          m.markCrit = crit;
          sim.fx('effect', 'reticle', m.x, m.z, 0, 1.2);
          sim.text(m.x, m.topY + 0.4, m.z, 'จุดตาย', 'info', 0.8);
        },
      }));
      muzzle(sim, p, ang, 0.7);
      return true;
    }
    case 'gs_aimedshot':
      aimThen(sim, p, ang, far, P('aim'), () => sim.addProjectile(p, shotFrom(p, ang, far, dmg, { speed: 40, size: 0.8, kb: 4 })));
      return true;
    case 'gs_ricochet': {
      // Each hit sends a new bullet straight on to the nearest monster not hit yet (shots fly straight on screen).
      const range = P('bounceRange');
      const hitSet = new Set<Monster>();
      const bounce = (m: Monster, left: number): void => {
        hitSet.add(m);
        if (left <= 0 || !live(sim, p)) return;
        const next = nearest(sim, m.x, m.z, range, (t) => !hitSet.has(t));
        if (!next) return;
        const a = Math.atan2(next.z - m.z, next.x - m.x);
        const off = m.radius + 0.5;
        const d = Math.hypot(next.x - m.x, next.z - m.z);
        sim.addProjectile(p, shotFrom(p, a, d + 1, dmg, {
          x: m.x + Math.cos(a) * off, z: m.z + Math.sin(a) * off, size: 0.5, after: (t) => bounce(t, left - 1),
        }));
      };
      const bounces = Math.round(P('bounces'));
      sim.addProjectile(p, shotFrom(p, ang, far, dmg, { size: 0.5, after: (m) => bounce(m, bounces) }));
      muzzle(sim, p, ang, 0.7);
      return true;
    }
    case 'gs_counter': {
      // Hop back (the dash's no-damage moment), then fire where the mouse is.
      const hop = 0.2;
      const critBonus = P('critBonus');
      p.startDash(-Math.cos(ang), -Math.sin(ang), P('backstep'), hop, 'dash');
      sim.schedule(hop, () => {
        if (!p.alive) return;
        const a = p.aimAngle();
        sim.addProjectile(p, shotFrom(p, a, far, dmg, { speed: 36, size: 0.7, kb: 4, hit: { critBonus } }));
        muzzle(sim, p, a, 0.9);
      });
      return true;
    }
    case 'gs_weakspot': {
      const extra = dmg * (P('bonus') / 100);
      const bonus = (m: Monster): number =>
        (sim.time < m.armorBreakUntil && m.armorBreak > 0) || (m.markBy === p.id && sim.time < m.markUntil) ? extra : 0;
      sim.addProjectile(p, shotFrom(p, ang, far, dmg, { speed: 34, size: 0.7, kb: 3, bonus }));
      muzzle(sim, p, ang, 0.8);
      return true;
    }
    case 'gs_finisher': {
      const below = P('hpBelow') / 100;
      const extra = dmg * Math.max(0, P('execMult') - 1);
      sim.addProjectile(p, shotFrom(p, ang, far, dmg, {
        speed: 36, size: 0.8, kb: 4, bonus: (m) => (m.hp / m.maxHp < below ? extra : 0),
      }));
      muzzle(sim, p, ang, 0.9);
      return true;
    }
    case 'gs_lockon': {
      // Locks on the monster nearest the mouse (within the lock circle and reach), then every shot aims at it.
      const target = nearest(sim, aim.x, aim.z, P('lockRadius'), (m) => Math.hypot(m.x - p.x, m.z - p.z) <= far + m.radius);
      if (target) sim.fx('effect', 'reticle', target.x, target.z, 0, 1.4);
      const critBonus = P('critBonus');
      for (let i = 0; i < Math.round(P('shots')); i++) {
        sim.schedule(i * 0.12, () => {
          if (!p.alive) return;
          const a = target?.alive ? Math.atan2(target.z - p.z, target.x - p.x) : p.aimAngle();
          sim.addProjectile(p, shotFrom(p, a, far, dmg, { speed: 34, size: 0.5, kb: 1, hit: { critBonus } }));
          muzzle(sim, p, a, 0.6);
        });
      }
      return true;
    }
    case 'gs_sniperfocus':
      p.addStatBuff(sk.id, p.buffTime(P('time')), { crit: P('crit'), critDmg: P('critDmg') });
      buffFx(sim, p, 'gs_aura_crit');
      return true;

    // Rapid Fire line: buffs for the basic shot.
    case 'gs_hotrounds':
      p.gun.onHit[sk.id] = { until: sim.time + p.buffTime(P('time')), add: P('onHit') * sc.dmg };
      buffFx(sim, p, 'gs_aura_rapid');
      return true;
    case 'gs_quickreload':
      p.addStatBuff(sk.id, p.buffTime(P('time')), { atkSpeed: P('atkSpeed') });
      buffFx(sim, p, 'gs_aura_rapid');
      return true;
    case 'gs_doubletap':
      p.gun.double = { left: Math.round(P('shots')), second: P('second') / 100 };
      buffFx(sim, p, 'gs_aura_rapid');
      return true;
    case 'gs_shockrounds': {
      const until = sim.time + p.buffTime(P('time'));
      p.gun.onHit[sk.id] = { until, add: P('onHit') * sc.dmg };
      p.gun.shock = { until, slow: P('slow') / 100, slowT: P('slowTime') };
      buffFx(sim, p, 'gs_aura_rapid');
      return true;
    }
    case 'gs_stackfire':
      p.gun.stack = { until: sim.time + p.buffTime(P('time')), per: P('perStack') * sc.dmg, max: Math.round(P('maxStacks')), target: 0, n: 0 };
      buffFx(sim, p, 'gs_aura_rapid');
      return true;
    case 'gs_splitshot':
      p.gun.split = { until: sim.time + p.buffTime(P('time')), n: Math.round(P('bullets')), arc: (P('arc') * Math.PI) / 180, side: P('side') / 100 };
      buffFx(sim, p, 'gs_aura_rapid');
      return true;
    case 'gs_piercerounds': {
      const until = sim.time + p.buffTime(P('time'));
      p.gun.onHit[sk.id] = { until, add: P('onHit') * sc.dmg };
      p.gun.pierceUntil = until;
      buffFx(sim, p, 'gs_aura_rapid');
      return true;
    }
    case 'gs_overdrive': {
      const time = p.buffTime(P('time'));
      p.addStatBuff(sk.id, time, { atkSpeed: P('atkSpeed'), moveSpeed: P('moveSpeed') });
      p.gun.onHit[sk.id] = { until: sim.time + time, add: P('onHit') * sc.dmg };
      buffFx(sim, p, 'gs_aura_rapid');
      return true;
    }
    case 'gs_bulletstorm':
      p.gun.storm = { until: sim.time + p.buffTime(P('time')), n: Math.round(P('pellets')), arc: (P('arc') * Math.PI) / 180, mult: dmg };
      buffFx(sim, p, 'gs_aura_rapid');
      return true;

    // Special Weapons line.
    case 'gs_explosive':
      sim.addProjectile(p, shotFrom(p, ang, far, dmg, { speed: 22, radius: 0.4, color: '#7affe0', size: 0.8, explode: A('blast'), blastFx: 'gs_blast', specialFx: special, fxSkill: sk.id }));
      muzzle(sim, p, ang, 0.8);
      return true;
    case 'gs_incendiary': {
      const burn = P('burn') * sc.dmg;
      const ticks = Math.max(1, Math.round(P('burnTime')));
      sim.addProjectile(p, shotFrom(p, ang, far, dmg, {
        color: '#ff8a3a', size: 0.6, fxSkill: sk.id,
        after: (m) => repeat(sim, 1, ticks, () => {
          if (!m.alive || !live(sim, p)) return false;
          sim.fx('effect', 'gs_burn', m.x, m.z, 0, 0.6);
          sim.hitMonster(p, m, burn);
        }),
      }));
      muzzle(sim, p, ang, 0.7);
      return true;
    }
    case 'gs_mine': {
      // Laid at the feet; blows up the moment a monster steps close, or fizzles when its time runs out.
      const x = p.x;
      const z = p.z;
      const trigger = P('trigger');
      const radius = far * sc.area;
      const stun = P('stun');
      const step = 0.2;
      // At most as many lie on the ground as the stack count; laying one more makes the oldest vanish (owner 2026-11-19).
      const mine = { gone: false };
      p.mines = p.mines.filter((o) => !o.gone);
      p.mines.push(mine);
      const cap = Math.max(1, p.chargeMax(sk));
      while (p.mines.length > cap) p.mines.shift()!.gone = true;
      sim.fx('effect', 'gs_mine', x, z, 0, 0.6);
      repeat(sim, step, Math.round(p.summonTime(P('life')) / step), (i) => {
        if (mine.gone || !live(sim, p)) return false;
        if (i % 5 === 4) sim.fx('effect', 'gs_mine', x, z, 0, 0.6);
        if (!nearest(sim, x, z, trigger)) return;
        mine.gone = true;
        blast(sim, p, x, z, radius, dmg, { stun, kb: 4 }, special);
        sim.shake(0.3, { to: p.id });
        return false;
      });
      return true;
    }
    case 'gs_smoke': {
      const at = clampPoint(p, aim, far);
      const radius = A('radius');
      const slow = P('slow') / 100;
      repeat(sim, 1, Math.max(1, Math.round(P('time'))), () => {
        if (!live(sim, p)) return false;
        sim.fx('effect', 'gs_smoke', at.x, at.z, 0, radius);
        forCircle(sim, at.x, at.z, radius, (m) => sim.hitMonster(p, m, dmg, { slow, slowT: 1.2 }));
      }, 0.3);
      sim.fx('telegraph', at.x, at.z, radius, 0.3, '#8a9aa0');
      return true;
    }
    case 'gs_railgun':
      aimThen(sim, p, ang, far, P('charge'), () =>
        sim.addProjectile(p, shotFrom(p, ang, far, dmg, { speed: 50, radius: 0.5, color: '#a0fff4', size: 1, kb: 3, pierce: true })));
      return true;
    case 'gs_drone': {
      // Hovers by the player's shoulder and shoots the nearest monster within reach.
      const every = Math.max(0.1, P('every'));
      const life = p.summonTime(P('life'));
      // One drone on the client for the whole life (src/client/effects.ts drone()), flying after the caster.
      sim.fx('drone', p.id, every * Math.floor(life / every));
      repeat(sim, every, Math.floor(life / every), () => {
        if (!live(sim, p)) return false;
        const dx = p.x + 0.8;
        const dz = p.z - 0.8;
        sim.fx('effect', 'gs_drone', dx, dz, 0, 0.45);
        const m = nearest(sim, dx, dz, far);
        if (!m) return;
        const a = Math.atan2(m.z - dz, m.x - dx);
        sim.fx('drone', p.id, 0, a);
        sim.addProjectile(p, shotFrom(p, a, far + 2, dmg, { x: dx, z: dz, color: '#7affe0', size: 0.4, kb: 1 }));
      });
      return true;
    }
    case 'gs_seeker': {
      // One rocket at each of the nearest monsters (straight at where it stands); spare rockets fan out to the mouse.
      const n = Math.round(P('rockets'));
      const targets = sim.monsters
        .filter((m) => m.alive && !m.untargetable && Math.hypot(m.x - p.x, m.z - p.z) <= far + m.radius)
        .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))
        .slice(0, n);
      const r = A('blast');
      for (let i = 0; i < n; i++) {
        const m = targets[i];
        const a = m ? Math.atan2(m.z - p.z, m.x - p.x) : ang + (i - (n - 1) / 2) * 0.25;
        const range = m ? Math.min(far, Math.hypot(m.x - p.x, m.z - p.z)) : far;
        sim.schedule(i * 0.08, () => {
          if (!p.alive) return;
          sim.addProjectile(p, shotFrom(p, a, range, dmg, { speed: 20, radius: 0.4, color: '#6affc8', size: 0.7, explode: r, blastFx: 'gs_blast', specialFx: special, fxSkill: sk.id }));
        });
      }
      muzzle(sim, p, ang, 0.8);
      return true;
    }
    case 'gs_cluster': {
      const at = clampPoint(p, aim, far);
      const radius = A('radius');
      const small = A('bombletBlast');
      const smallDmg = P('bombletDmg') * sc.dmg;
      const n = Math.round(P('bomblets'));
      const delay = 0.5;
      sim.fx('telegraph', at.x, at.z, radius, delay, '#7affe0');
      sim.schedule(delay, () => {
        if (!live(sim, p)) return;
        blast(sim, p, at.x, at.z, radius, dmg, { kb: 4 }, special);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = radius * (0.5 + Math.random() * 0.5);
          const bx = at.x + Math.cos(a) * d;
          const bz = at.z + Math.sin(a) * d;
          sim.schedule(0.15 + i * 0.08, () => {
            if (live(sim, p)) blast(sim, p, bx, bz, small, smallDmg, { kb: 1 }, special);
          });
        }
      });
      return true;
    }
    case 'gs_rocketrain': {
      const at = clampPoint(p, aim, far);
      const radius = A('radius');
      const r = A('rocketBlast');
      const n = Math.round(P('rockets'));
      const spread = P('spread');
      sim.fx('telegraph', at.x, at.z, radius, 0.4 + spread, '#7affe0');
      for (let i = 0; i < n; i++) {
        sim.schedule(0.4 + (spread * i) / Math.max(1, n), () => {
          if (!live(sim, p)) return;
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * radius;
          blast(sim, p, at.x + Math.cos(a) * d, at.z + Math.sin(a) * d, r, dmg, { kb: 2 }, special);
        });
      }
      return true;
    }
    case 'gs_turret': {
      // Stays where it was set down and shoots the nearest monster within reach.
      const x = p.x;
      const z = p.z;
      const every = Math.max(0.1, P('every'));
      const life = p.summonTime(P('life'));
      const showEvery = Math.max(1, Math.round(1 / every));
      sim.fx('effect', 'gs_turret', x, z, 0, 0.7);
      repeat(sim, every, Math.floor(life / every), (i) => {
        if (!live(sim, p)) return false;
        if (i % showEvery === 0) sim.fx('effect', 'gs_turret', x, z, 0, 0.7);
        const m = nearest(sim, x, z, far);
        if (!m) return;
        const a = Math.atan2(m.z - z, m.x - x);
        sim.addProjectile(p, shotFrom(p, a, far + 2, dmg, { x, z, color: '#7affe0', size: 0.45, kb: 1 }));
        sim.fx('effect', 'muzzle', x + Math.cos(a) * 0.6, z + Math.sin(a) * 0.6, a, 0.5);
      });
      return true;
    }
  }
  return false;
}

function muzzle(sim: Sim, p: Player, ang: number, size: number): void {
  sim.fx('effect', 'muzzle', p.x + Math.cos(ang) * 1, p.z + Math.sin(ang) * 1, ang, size);
}

/** A buff skill's aura around the player, in its line's colour. */
function buffFx(sim: Sim, p: Player, aura: 'gs_aura_crit' | 'gs_aura_rapid'): void {
  sim.fx('effect', aura, p.x, p.z, 0, 1.6);
}
