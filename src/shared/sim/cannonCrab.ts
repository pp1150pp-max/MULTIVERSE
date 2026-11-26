// The Giant Cannon Crab, Shipwreck Beach's boss (plan 5.1, owner 2026-11-20). It walks and hits like other bosses
// (no ground slam), and on top of that:
//  - cannon:  marks circles around its target, then cannonballs drop on them;
//  - claw:    grabs one player in front of it, holds them, then flings them far away;
//  - sidestep: dashes quickly to one side;
//  - low HP:  hides in its shell (much less damage taken) while a cannon barrage rains over the whole arena,
//             again every so often while it stays low.
// Its numbers are in src/shared/moveTuning.ts (/admin). Damage is times its ATK, so keys make it hit harder too.
// The cannonballs go out in `Sim.hazards` like the Volcano Heart's attacks (drawn by src/client/hazards.ts).
import { arenaRadius } from '../data/zones';
import type { HazardBase } from './volcanoHeart';
import type { Monster } from './Monster';
import type { Player } from './Player';
import type { Sim } from './Sim';
import { guard, mv } from './beachMoves';

/** A cannonball flying from (fromX, fromZ) onto the circle at (x, z), landing at `hit`. */
export interface ShellHazard extends HazardBase { k: 'shell'; r: number; fromX: number; fromZ: number }
export type CrabHazard = ShellHazard;

/** Seconds before its first cannon, claw and sidestep of a fight. */
const FIRST = { cannon: 3, claw: 5, side: 4 };
/** The cannon's wind-up (tilting the shell up) before the balls are fired. */
const CANNON_WINDUP = 0.5;
/** How long a sidestep takes. */
const SIDE_TIME = 0.35;
/** Only sidesteps when its target is this close. */
const SIDE_NEAR = 4;
/** Fires its cannon at targets up to this far. */
const CANNON_RANGE = 16;
/** Cannonballs beside the target land up to this far from them. */
const CANNON_SPREAD = 2.6;
/** How long a landed ball stays drawn (its burst). */
const SHOW_AFTER = 0.4;

interface Active { h: CrabHazard; landed: boolean }

export class CannonCrabBrain {
  private cannonCd = FIRST.cannon;
  private clawCd = FIRST.claw;
  private sideCd = FIRST.side;
  /** Counts down to the next barrage while its HP is low; 0 = the next one starts as soon as it is free. */
  private barrageCd = 0;
  private lowSeen = false;
  private nextId = 1;
  private active: Active[] = [];
  /** Hiding for the barrage. */
  private hideT = 0;
  private cannonT = 0;
  private cannonAt: Player | null = null;
  private clawT = 0;
  private clawX = 0;
  private clawZ = 0;
  private held: Player | null = null;
  private holdT = 0;
  private dashT = 0;
  private dashVx = 0;
  private dashVz = 0;

  /** Something on the ground or a move going on: the crab is busy. */
  get busy(): boolean {
    return this.hideT > 0 || this.cannonT > 0 || this.clawT > 0 || this.holdT > 0 || this.dashT > 0;
  }

  private publish(sim: Sim): void {
    sim.hazards = this.active.map((a) => a.h);
  }

  /** Fight over (home, reset or dead): no balls left in the air, no one held, next fight from the start. */
  reset(sim: Sim): void {
    if (this.active.length) {
      this.active = [];
      this.publish(sim);
    }
    this.release();
    this.hideT = this.cannonT = this.clawT = this.dashT = 0;
    this.cannonCd = FIRST.cannon;
    this.clawCd = FIRST.claw;
    this.sideCd = FIRST.side;
    this.barrageCd = 0;
    this.lowSeen = false;
  }

  /** Lets go of whoever it holds (no fling). */
  private release(): void {
    if (this.held) this.held.snareT = 0;
    this.held = null;
    this.holdT = 0;
  }

  /** Every tick, before anything can stop the crab (stuns): the balls in the air still land. */
  tick(sim: Sim, m: Monster): void {
    let changed = false;
    for (const a of this.active) {
      if (a.landed || sim.time < a.h.hit) continue;
      a.landed = true;
      const h = a.h;
      sim.fx('ring', h.x, h.z, h.r, '#ffb070', 0.35);
      sim.fx('burst', h.x, 0.3, h.z, '#7a6a5a', 10, 5);
      sim.sfx('boss_slam', h.x, h.z);
      for (const p of sim.players) {
        if (p.alive && Math.hypot(p.x - h.x, p.z - h.z) <= h.r + p.radius) {
          sim.hitPlayer(m, p, mv('crab.cannonMult'), { kb: 4, fromX: h.x, fromZ: h.z });
        }
      }
    }
    const keep = this.active.filter((a) => !a.landed || sim.time < a.h.hit + SHOW_AFTER);
    if (keep.length !== this.active.length) changed = true;
    this.active = keep;
    if (changed) this.publish(sim);
  }

  private shell(sim: Sim, m: Monster, x: number, z: number, hitIn: number): void {
    const r = mv('crab.cannonRadius');
    this.active.push({ h: { id: this.nextId++, k: 'shell', x, z, r, start: sim.time, hit: sim.time + hitIn, fromX: m.x, fromZ: m.z }, landed: false });
  }

  /** A spot inside the arena (rooms: around the boss's place; on a map: around where it stands). */
  private inArena(sim: Sim, m: Monster, x: number, z: number): { x: number; z: number } {
    const cx = m.area.x;
    const cz = m.area.z;
    const max = arenaRadius(sim.zone) - 0.5;
    const d = Math.hypot(x - cx, z - cz);
    return d <= max ? { x, z } : { x: cx + ((x - cx) / d) * max, z: cz + ((z - cz) / d) * max };
  }

  /**
   * Its own moves, once Monster has done the stun and wipe checks. True = it acted this tick (the usual chase and
   * melee are skipped); false = Monster goes on as for any boss.
   */
  act(dt: number, sim: Sim, m: Monster): boolean {
    const t = dt * m.skillSpeed;
    this.cannonCd -= t;
    this.clawCd -= t;
    this.sideCd -= t;
    this.barrageCd -= t;
    const p = m.target;

    // Hiding in the shell while the barrage falls.
    if (this.hideT > 0) {
      this.hideT -= dt;
      m.windupT = 0;
      return true;
    }
    // Holding someone up in its claw, then the fling.
    if (this.holdT > 0) {
      const h = this.held;
      this.holdT -= dt;
      if (!h?.alive) {
        this.release();
        return true;
      }
      h.snareT = Math.max(h.snareT, 0.1);
      if (this.holdT <= 0) {
        this.release();
        // Knockback slides power/10 units (Unit.tickStatus decays it ×e^-10 per second).
        h.knockback(m.x, m.z, mv('crab.clawFling') * 10);
        h.stunT = Math.max(h.stunT, mv('crab.clawStun') + 0.3);
        sim.anim(m.id, 'claw_fling', { duration: 0.4, fallback: 'attack' });
        sim.shake(0.3, { to: h.id });
      }
      return true;
    }
    if (this.clawT > 0) {
      this.clawT -= dt;
      if (this.clawT <= 0) this.grab(sim, m);
      return true;
    }
    if (this.cannonT > 0) {
      this.cannonT -= dt;
      if (this.cannonT <= 0) this.fireCannon(sim, m);
      return true;
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      m.x += this.dashVx * dt;
      m.z += this.dashVz * dt;
      sim.terrain.resolve(m);
      m.moving = true;
      return true;
    }
    if (!p || m.state !== 'chase' || m.windupT > 0) return false;

    // Low HP: into the shell, cannonballs all over the arena.
    if (m.hp < m.maxHp * mv('crab.lowHp') && this.barrageCd <= 0) {
      this.barrage(sim, m);
      return true;
    }
    const d = Math.hypot(p.x - m.x, p.z - m.z);
    const reach = mv('crab.clawRange');
    if (this.clawCd <= 0 && d <= reach + m.radius + p.radius) {
      const windup = mv('crab.clawWindup');
      this.clawT = windup;
      this.clawCd = mv('crab.clawCd');
      m.face(p.x - m.x, p.z - m.z);
      const dd = d || 1;
      // The circle in front of it, toward the target, where the claw closes.
      this.clawX = m.x + ((p.x - m.x) / dd) * Math.min(d, reach * 0.6 + m.radius);
      this.clawZ = m.z + ((p.z - m.z) / dd) * Math.min(d, reach * 0.6 + m.radius);
      sim.fx('telegraph', this.clawX, this.clawZ, reach * 0.6, windup);
      sim.anim(m.id, 'claw', { duration: windup, fallback: 'attack' });
      return true;
    }
    if (this.sideCd <= 0 && d < SIDE_NEAR) {
      this.sideCd = mv('crab.sideCd');
      const side = Math.random() < 0.5 ? -1 : 1;
      const dd = d || 1;
      const speed = mv('crab.sideDist') / SIDE_TIME;
      this.dashVx = (-(p.z - m.z) / dd) * side * speed;
      this.dashVz = ((p.x - m.x) / dd) * side * speed;
      this.dashT = SIDE_TIME;
      sim.fx('burst', m.x, 0.3, m.z, '#d8c8a0', 8, 3);
      return true;
    }
    if (this.cannonCd <= 0 && d <= CANNON_RANGE) {
      this.cannonCd = mv('crab.cannonCd');
      this.cannonT = CANNON_WINDUP;
      this.cannonAt = p;
      m.face(p.x - m.x, p.z - m.z);
      sim.anim(m.id, 'cannon', { duration: CANNON_WINDUP, fallback: 'attack' });
      return true;
    }
    return false;
  }

  /** The claw closes: whoever stands in the circle (its target first) is hurt and held. */
  private grab(sim: Sim, m: Monster): void {
    const r = mv('crab.clawRange') * 0.6;
    const inside = (q: Player) => q.alive && !sim.inSafe(q) && Math.hypot(q.x - this.clawX, q.z - this.clawZ) <= r + q.radius;
    const t = m.target && inside(m.target) ? m.target : sim.players.find(inside);
    sim.fx('slash', m.x, m.z, Math.atan2(this.clawZ - m.z, this.clawX - m.x), Math.PI * 0.5, r * 2 + m.radius, '#ff8a6a');
    if (!t) return;
    sim.hitPlayer(m, t, mv('crab.clawMult'), {});
    if (!t.alive) return;
    this.held = t;
    this.holdT = mv('crab.clawHold');
    t.snareT = Math.max(t.snareT, this.holdT + 0.1);
    sim.anim(m.id, 'claw_hold', { duration: this.holdT });
    sim.text(t.x, t.topY + 0.4, t.z, 'โดนหนีบ!', 'info', 0.8, t.id);
    // No hold at all (0 in /admin): flung at once.
    if (this.holdT <= 0) this.holdT = 0.01;
  }

  /** One ball on the target, the rest close around them. */
  private fireCannon(sim: Sim, m: Monster): void {
    const p = this.cannonAt?.alive ? this.cannonAt : m.target;
    this.cannonAt = null;
    if (!p?.alive) return;
    const warn = mv('crab.cannonWarn');
    const n = Math.round(mv('crab.cannonShells'));
    sim.sfx('boss_slam', m.x, m.z);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = i === 0 ? 0 : CANNON_SPREAD * (0.5 + Math.random() * 0.5);
      const s = this.inArena(sim, m, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
      this.shell(sim, m, s.x, s.z, warn + i * 0.12);
    }
    this.publish(sim);
  }

  /** Into the shell; balls fall all over the arena through the hide, one under each player near it as well. */
  private barrage(sim: Sim, m: Monster): void {
    const sec = mv('crab.shellSec');
    const warn = mv('crab.cannonWarn');
    this.hideT = sec;
    this.barrageCd = mv('crab.barrageEvery');
    m.windupT = 0;
    guard(sim, m, mv('crab.shellCut'), sec);
    sim.anim(m.id, 'shell', { duration: sec, fallback: 'attack' });
    if (!this.lowSeen) {
      this.lowSeen = true;
      const text = 'ปูยักษ์หดเข้ากระดอง!';
      sim.log(`${text} ปืนใหญ่ระดมยิงทั่วลาน`, '#ff6a5a');
      sim.banner(text, 'ปืนใหญ่ระดมยิงทั่วลาน หาที่หลบ!', m.x, m.z);
    }
    const n = Math.round(mv('crab.barrageShells'));
    const ring = arenaRadius(sim.zone);
    const spread = Math.max(0, sec - warn);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (ring - 1);
      this.shell(sim, m, m.area.x + Math.cos(a) * r, m.area.z + Math.sin(a) * r, warn + (spread * i) / Math.max(1, n));
    }
    for (const p of sim.players) {
      if (!p.alive || Math.hypot(p.x - m.area.x, p.z - m.area.z) > ring + 2) continue;
      this.shell(sim, m, p.x, p.z, warn + Math.random() * spread * 0.5);
    }
    this.publish(sim);
  }
}
