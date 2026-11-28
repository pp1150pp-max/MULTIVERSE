// The Peg-Leg Captain, Smugglers' Cove's boss (plan 5.2, owner 2026-11-24). He walks and hits like other bosses (no ground
// slam), calls three cutlass pirates when he enrages (MonsterDef.summon), and on top of that:
//  - anchor: marks a line at his target, throws his anchor down it and drags whoever it hits back in front of him;
//  - parrot: his parrot leaves his shoulder, flies onto a player and squawks; the gunboats at the edge of the arena
//            shell the spot where that player stands, a few times. Shot down it is gone for a while (it never dies),
//            then it flies back to his shoulder. On his shoulder it can't be hit;
//  - shout:  he and his crew nearby run faster for a while.
// His moves are shouted in words over his head (src/shared/bossShout.ts). Its numbers are in src/shared/moveTuning.ts
// (/admin). Damage is times his ATK, so keys make it hit harder too.
// The gunboat shells go out in `Sim.hazards` like the crab's (k 'shell', drawn by src/client/hazards.ts).
import { arenaRadius } from '../data/zones';
import { GUNBOAT_ANGLES, gunboatDist } from './terrain';
import type { ShellHazard } from './cannonCrab';
import type { Monster } from './Monster';
import type { Player } from './Player';
import type { Sim } from './Sim';
import { mv } from './beachMoves';
import { currentBalance } from '../balance';
import type { ShoutId } from '../bossShout';

/** Seconds before his first anchor, parrot and shout of a fight. */
const FIRST = { anchor: 4, parrot: 6, shout: 10 };
/** Throws the anchor only at targets at least this far (closer, he just hits). */
const ANCHOR_MIN = 3.5;
/** Half the width of the anchor's line. */
const ANCHOR_HALF = 0.9;
/** How long the drag takes. */
const PULL_TIME = 0.35;
/** The shout's wind-up. */
const SHOUT_WINDUP = 0.6;
/** The parrot's flying speed (units a second) and how high it flies, sits on a shoulder or on a head. */
const PARROT_SPEED = 11;
const LIFT = { fly: 2.6, shoulder: 3.4, head: 2.1 };
/** How long a landed shell stays drawn (its burst). */
const SHOW_AFTER = 0.4;

type ParrotState = 'shoulder' | 'fly' | 'perch' | 'home' | 'down';
interface Active { h: ShellHazard; landed: boolean }

/** His words over his head as he makes a move (/admin card "บอสตะโกน"; switched off or an empty line = nothing). */
export function captainYell(sim: Sim, m: Monster, move: ShoutId, above = 0.6): void {
  const cfg = currentBalance().bossShout;
  if (cfg.on && cfg.text[move]) sim.text(m.x, m.topY + above, m.z, cfg.text[move], 'crit', 1.4);
}

export class PeglegCaptainBrain {
  private anchorCd = FIRST.anchor;
  private parrotCd = FIRST.parrot;
  private shoutCd = FIRST.shout;
  private active: Active[] = [];
  private nextId = 1;
  private anchorT = 0;
  private anchorAngle = 0;
  private shoutT = 0;
  private pulled: Player | null = null;
  private pullT = 0;
  private pullVx = 0;
  private pullVz = 0;
  /** The parrot (a summoned monster, made on the first fight), what it is doing, and on whom. */
  parrot: Monster | null = null;
  private pState: ParrotState = 'shoulder';
  private perchOn: Player | null = null;
  private perchT = 0;
  private shotT = 0;
  private shotsLeft = 0;
  private downT = 0;

  /** The parrot's state, for tests. */
  get parrotState(): ParrotState {
    return this.pState;
  }

  private publish(sim: Sim): void {
    sim.hazards = this.active.map((a) => a.h);
  }

  /** Fight over (home, reset): no shells in the air, nobody dragged, the parrot back on his shoulder, next fight from the start. */
  reset(sim: Sim, m: Monster): void {
    if (this.active.length) {
      this.active = [];
      this.publish(sim);
    }
    this.pulled = null;
    this.anchorT = this.pullT = this.shoutT = 0;
    this.anchorCd = FIRST.anchor;
    this.parrotCd = FIRST.parrot;
    this.shoutCd = FIRST.shout;
    m.hasteT = 0;
    if (this.parrot && this.pState !== 'shoulder') {
      if (this.pState === 'down') this.bringBack(sim);
      this.toShoulder(m);
    }
  }

  /** He is dead: the parrot flies off for good. */
  remove(sim: Sim): void {
    const b = this.parrot;
    this.parrot = null;
    if (b) {
      b.alive = false;
      b.hp = 0;
      b.deadT = 1;
      b.gone = true;
    }
    this.active = [];
    this.publish(sim);
  }

  /** Every tick, before anything can stop him (stuns): shells still land and the parrot still flies. */
  tick(dt: number, sim: Sim, m: Monster): void {
    let changed = false;
    for (const a of this.active) {
      if (a.landed || sim.time < a.h.hit) continue;
      a.landed = true;
      const h = a.h;
      sim.fx('ring', h.x, h.z, h.r, '#ffb070', 0.35);
      sim.fx('sprite', 'fx_explosion', h.x, h.z, h.r * 0.7, 0.4);
      sim.sfx('boss_slam', h.x, h.z);
      for (const p of sim.players) {
        if (p.alive && Math.hypot(p.x - h.x, p.z - h.z) <= h.r + p.radius) sim.hitPlayer(m, p, mv('captain.parrotMult'), { kb: 4, fromX: h.x, fromZ: h.z });
      }
    }
    const keep = this.active.filter((a) => !a.landed || sim.time < a.h.hit + SHOW_AFTER);
    if (keep.length !== this.active.length) changed = true;
    this.active = keep;
    if (changed) this.publish(sim);
    this.tickParrot(dt, sim, m);
    // Dragged by the anchor's chain.
    if (this.pullT > 0) {
      const p = this.pulled;
      this.pullT -= dt;
      if (p?.alive) {
        p.x += this.pullVx * dt;
        p.z += this.pullVz * dt;
        sim.terrain.resolve(p);
        p.snareT = Math.max(p.snareT, 0.1);
      }
      if (this.pullT <= 0) this.pulled = null;
    }
  }

  /** His parrot: made on first use, sitting on his shoulder. */
  private ensureParrot(sim: Sim, m: Monster): Monster | null {
    if (this.parrot) return this.parrot;
    const b = sim.spawnSummon('parrot', m.x, m.z);
    if (!b) return null;
    b.hpOverride = mv('captain.parrotHp') * sim.keys;
    b.retune();
    b.hp = b.maxHp;
    this.parrot = b;
    this.toShoulder(m);
    return b;
  }

  private toShoulder(m: Monster): void {
    const b = this.parrot!;
    this.pState = 'shoulder';
    this.perchOn = null;
    b.noHit = true;
    b.x = m.x + 0.6;
    b.z = m.z - 0.6;
    b.lift = LIFT.shoulder;
    b.face(m.faceX, m.faceZ);
  }

  /** Shot down: gone for a while (out of the monster list), with its HP back. */
  private knockDown(sim: Sim): void {
    const b = this.parrot!;
    sim.text(b.x, b.topY + b.lift, b.z, 'นกแก้วร่วง!', 'info', 0.9);
    sim.fx('burst', b.x, 1.2, b.z, '#e84a3a', 10, 3);
    b.knockedDown = false;
    b.gone = true;
    this.pState = 'down';
    this.downT = mv('captain.parrotDown');
    this.perchOn = null;
    this.shotsLeft = 0;
  }

  /** Back from being shot down: in the monster list again, full HP. */
  private bringBack(sim: Sim): void {
    const b = this.parrot!;
    b.gone = false;
    b.alive = true;
    b.hp = b.maxHp;
    if (!sim.monsters.includes(b)) sim.monsters.push(b);
  }

  private tickParrot(dt: number, sim: Sim, m: Monster): void {
    const b = this.parrot;
    if (!b) return;
    if (b.knockedDown) this.knockDown(sim);
    const flyTo = (x: number, z: number): boolean => {
      const dx = x - b.x;
      const dz = z - b.z;
      const d = Math.hypot(dx, dz);
      const s = PARROT_SPEED * dt;
      b.moving = d > 0.05;
      if (d <= s) {
        b.x = x;
        b.z = z;
        return true;
      }
      b.x += (dx / d) * s;
      b.z += (dz / d) * s;
      b.face(dx, dz);
      return false;
    };
    switch (this.pState) {
      case 'shoulder':
        b.x = m.x + 0.6;
        b.z = m.z - 0.6;
        b.moving = false;
        break;
      case 'down':
        this.downT -= dt;
        if (this.downT <= 0) {
          // It comes back to his shoulder, flying in from where it fell.
          this.bringBack(sim);
          b.noHit = false;
          b.lift = LIFT.fly;
          this.pState = 'home';
        }
        break;
      case 'home':
        if (flyTo(m.x + 0.6, m.z - 0.6)) this.toShoulder(m);
        break;
      case 'fly': {
        const p = this.perchOn;
        if (!p?.alive || sim.inSafe(p)) {
          this.pState = 'home';
          break;
        }
        if (flyTo(p.x, p.z)) {
          this.pState = 'perch';
          this.perchT = mv('captain.parrotPerch');
          this.shotsLeft = Math.max(1, Math.round(mv('captain.parrotShots')));
          this.shotT = 0;
          b.lift = LIFT.head;
          sim.anim(b.id, 'attack', { duration: 0.5 });
          sim.text(p.x, p.topY + 0.8, p.z, 'นกแก้วชี้เป้า!', 'crit', 1, p.id);
          sim.log('นกแก้วเกาะหัวคุณ! เรือปืนกำลังยิงมาที่คุณ ตีนกให้ร่วงหรือวิ่งหลบ', '#ff8a6a', p.id);
          captainYell(sim, m, 'captain.parrot');
        }
        break;
      }
      case 'perch': {
        const p = this.perchOn;
        if (!p?.alive || sim.inSafe(p)) {
          this.pState = 'home';
          b.lift = LIFT.fly;
          break;
        }
        b.x = p.x;
        b.z = p.z;
        b.moving = false;
        this.perchT -= dt;
        this.shotT -= dt;
        if (this.shotsLeft > 0 && this.shotT <= 0) {
          this.shotsLeft--;
          this.shotT = mv('captain.parrotPerch') / Math.max(1, Math.round(mv('captain.parrotShots')));
          this.boatShot(sim, m, p);
        }
        if (this.perchT <= 0) {
          this.pState = 'home';
          b.lift = LIFT.fly;
        }
        break;
      }
    }
  }

  /** The gunboat nearest the target fires at where they stand now: a ring on the ground, then the shell. */
  private boatShot(sim: Sim, m: Monster, p: Player): void {
    const cx = m.area.x;
    const cz = m.area.z;
    const dist = gunboatDist(arenaRadius(sim.zone));
    let from = { x: cx + dist, z: cz };
    let best = Infinity;
    for (const a of GUNBOAT_ANGLES) {
      const x = cx + Math.cos(a) * dist;
      const z = cz + Math.sin(a) * dist;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best) {
        best = d;
        from = { x, z };
      }
    }
    const warn = mv('captain.parrotWarn');
    this.active.push({
      h: { id: this.nextId++, k: 'shell', x: p.x, z: p.z, r: mv('captain.parrotRadius'), start: sim.time, hit: sim.time + warn, fromX: from.x, fromZ: from.z },
      landed: false,
    });
    sim.fx('burst', from.x, 1.2, from.z, '#bfb2a0', 8, 3);
    sim.sfx('boss_slam', from.x, from.z);
    this.publish(sim);
  }

  /**
   * His own moves, once Monster has done the stun and wipe checks. True = he acted this tick (the usual chase and melee are
   * skipped); false = Monster goes on as for any boss.
   */
  act(dt: number, sim: Sim, m: Monster): boolean {
    const t = dt * m.skillSpeed;
    this.anchorCd -= t;
    this.parrotCd -= t;
    this.shoutCd -= t;
    this.ensureParrot(sim, m);
    const p = m.target;

    if (this.shoutT > 0) {
      this.shoutT -= dt;
      if (this.shoutT <= 0) this.shout(sim, m);
      return true;
    }
    if (this.anchorT > 0) {
      this.anchorT -= dt;
      if (this.anchorT <= 0) this.throwAnchor(sim, m);
      return true;
    }
    if (!p || m.state !== 'chase' || m.windupT > 0) return false;

    if (this.shoutCd <= 0) {
      this.shoutCd = mv('captain.shoutCd');
      this.shoutT = SHOUT_WINDUP;
      sim.anim(m.id, 'shout', { duration: SHOUT_WINDUP, fallback: 'attack' });
      return true;
    }
    if (this.parrotCd <= 0 && this.pState === 'shoulder' && this.parrot) {
      // On whoever he is not fighting when he can (the parrot singles someone else out), else his target.
      const others = sim.players.filter((o) => o.alive && o !== p && !sim.inSafe(o) && Math.hypot(o.x - m.area.x, o.z - m.area.z) <= arenaRadius(sim.zone) + 2);
      const on = others.length ? others[Math.floor(Math.random() * others.length)] : p;
      this.parrotCd = mv('captain.parrotCd');
      this.perchOn = on;
      this.pState = 'fly';
      this.parrot.noHit = false;
      this.parrot.lift = LIFT.fly;
      sim.anim(this.parrot.id, 'attack', { duration: 0.4 });
      return false;
    }
    const d = Math.hypot(p.x - m.x, p.z - m.z);
    if (this.anchorCd <= 0 && d >= ANCHOR_MIN && d <= mv('captain.anchorRange')) {
      const windup = mv('captain.anchorWindup');
      this.anchorCd = mv('captain.anchorCd');
      this.anchorT = windup;
      this.anchorAngle = Math.atan2(p.z - m.z, p.x - m.x);
      m.face(p.x - m.x, p.z - m.z);
      sim.fx('lineTelegraph', m.x, m.z, this.anchorAngle, mv('captain.anchorRange'), ANCHOR_HALF * 2, windup);
      sim.anim(m.id, 'anchor', { duration: windup, fallback: 'attack' });
      captainYell(sim, m, 'captain.anchor');
      return true;
    }
    return false;
  }

  /** Down the marked line: the first player on it is hurt and dragged to just in front of him. */
  private throwAnchor(sim: Sim, m: Monster): void {
    const range = mv('captain.anchorRange');
    const ux = Math.cos(this.anchorAngle);
    const uz = Math.sin(this.anchorAngle);
    let hit: Player | null = null;
    let along = Infinity;
    for (const p of sim.players) {
      if (!p.alive || sim.inSafe(p)) continue;
      const rx = p.x - m.x;
      const rz = p.z - m.z;
      const t = rx * ux + rz * uz;
      if (t < 0 || t > range + p.radius) continue;
      if (Math.abs(rx * uz - rz * ux) > ANCHOR_HALF + p.radius) continue;
      if (t < along) {
        along = t;
        hit = p;
      }
    }
    const reach = hit ? along : range;
    sim.fx('sprite', 'fx_anchor', m.x + ux * reach, m.z + uz * reach, 0.9, 0.5);
    sim.sfx('boss_slam', m.x + ux * reach, m.z + uz * reach);
    if (!hit) return;
    sim.hitPlayer(m, hit, mv('captain.anchorMult'), {});
    if (!hit.alive) return;
    const stop = m.radius + hit.radius + mv('captain.anchorPull');
    const go = Math.max(0, along - stop);
    if (go <= 0) return;
    this.pulled = hit;
    this.pullT = PULL_TIME;
    this.pullVx = (-ux * go) / PULL_TIME;
    this.pullVz = (-uz * go) / PULL_TIME;
    hit.snareT = Math.max(hit.snareT, PULL_TIME + 0.1);
    sim.text(hit.x, hit.topY + 0.4, hit.z, 'โดนสมอดึง!', 'info', 0.8, hit.id);
    sim.shake(0.25, { to: hit.id });
  }

  /** His shout: he and his crew within reach (not the parrot) run faster for a while. */
  private shout(sim: Sim, m: Monster): void {
    const sec = mv('captain.shoutSec');
    const reach = mv('captain.shoutRange');
    captainYell(sim, m, 'captain.shout');
    for (const o of sim.monsters) {
      if (!o.alive || o.def.move === 'parrot') continue;
      if (o !== m && (!o.summoned || Math.hypot(o.x - m.x, o.z - m.z) > reach)) continue;
      o.hasteT = sec;
      o.haste = mv('captain.shoutSpeed');
    }
  }
}
