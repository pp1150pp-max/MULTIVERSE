// The Kraken, the Kraken Maelstrom's boss (plan 5.4, owner 2026-11-24). It lies under the whirlpool in the middle of its room and never
// moves (MonsterDef.anchored); players fight round the whirlpool's rim and can't walk into it.
//  - arms:    its arms rise round the rim (summons, kraken_arm) and slam long lines. While any is up the kraken stays under the water
//             (can't be hit). Cut them all and its head comes up for a while; then it sinks and the arms grow back.
//  - ink:     spits ink at a few players; whoever it hits has ink over their screen for a while (drawn by the browser, an 'ink' hazard).
//  - suction: the whirlpool pulls everyone towards it for a while; they must walk against it, and whoever is dragged to the rim is
//             hurt over and over. A dash helps. The pull is shared code (suctionStep), so the browser walks it too.
// Its numbers are in src/shared/moveTuning.ts (/admin, card "คราเคน"). Damage is times its ATK, so keys make it hit harder too.
import { arenaRadius, RIM_OUT, ROOM_WHIRLPOOL } from '../data/zones';
import type { HazardBase } from './volcanoHeart';
import type { Monster } from './Monster';
import type { Player } from './Player';
import type { Sim } from './Sim';
import type { Terrain } from './terrain';
import { mv } from './beachMoves';

/** Ink over one player's screen from `hit` until `end` (`pid` = whose). */
export interface InkHazard extends HazardBase { k: 'ink'; pid: number; end: number }
/** The whirlpool at (x, z) pulls everyone within `r` towards it at `speed` from `hit` until `end`. */
export interface SuctionHazard extends HazardBase { k: 'suction'; r: number; speed: number; end: number }

/** Seconds before its first arms, ink and suction of a fight. */
const FIRST = { arms: 1.5, ink: 6, suck: 12 };
/** The suction's warning before it pulls. */
const SUCK_WARN = 1;
/** Rim hits during the suction: this close to the whirlpool's edge, every RIM_TICK seconds. */
const RIM_NEAR = 0.8;
const RIM_TICK = 0.5;
/** Its ink shot. */
const INK_SHOT = { speed: 9, radius: 0.6, size: 1.1, color: '#3a2a5a' };
/** After its head sinks, the arms come back after this long. */
const REGROW = 2;

/**
 * One frame of the whirlpool's pull on a player (shared: the server for everyone it walks, the browser for its own character), from
 * the suction hazards in play. Kept out of the whirlpool by Terrain.resolve.
 */
export function suctionStep(p: { x: number; z: number; radius: number }, hazards: readonly { k: string }[], time: number, dt: number, terrain: Terrain): boolean {
  let moved = false;
  for (const h of hazards) {
    if (h.k !== 'suction') continue;
    const s = h as SuctionHazard;
    if (time < s.hit || time >= s.end) continue;
    const dx = s.x - p.x;
    const dz = s.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3 || d > s.r) continue;
    const step = Math.min(d, s.speed * dt);
    p.x += (dx / d) * step;
    p.z += (dz / d) * step;
    moved = true;
  }
  if (moved) terrain.resolve(p);
  return moved;
}

/** How fast a suction in play is pulling (0 = none): the server lets a browser's reported walk go that much further. */
export function suctionSpeed(hazards: readonly { k: string }[], time: number): number {
  let v = 0;
  for (const h of hazards) {
    if (h.k === 'suction' && time >= (h as SuctionHazard).hit && time < (h as SuctionHazard).end) v += (h as SuctionHazard).speed;
  }
  return v;
}

export class KrakenBrain {
  private phase: 'arms' | 'head' = 'arms';
  /** Arms phase: until they rise (start of a fight, after the head sinks). Head phase: until it sinks. */
  private t = FIRST.arms;
  private armsUp = false;
  private arms: Monster[] = [];
  private inkCd = FIRST.ink;
  private suckCd = FIRST.suck;
  private suction: SuctionHazard | null = null;
  private inks: InkHazard[] = [];
  private rimT = 0;
  /** Was a fight on last tick (anyone in the room alive). */
  private fighting = false;

  /** Its head is up (for tests). */
  get headUp(): boolean {
    return this.phase === 'head';
  }

  /** Its arms alive (for tests). */
  get armsAlive(): Monster[] {
    return this.arms.filter((a) => a.alive);
  }

  private publish(sim: Sim): void {
    sim.hazards = [...(this.suction ? [this.suction] : []), ...this.inks];
  }

  /** Fight over (nobody left in the room): its arms go, it sinks, the next fight starts fresh. */
  private reset(sim: Sim, m: Monster): void {
    this.clearArms(sim);
    this.suction = null;
    this.inks = [];
    this.publish(sim);
    this.phase = 'arms';
    this.t = FIRST.arms;
    this.inkCd = FIRST.ink;
    this.suckCd = FIRST.suck;
    this.submerge(m);
    m.resetFight();
  }

  /** It is dead: the suction and ink stop and its arms sink with it. */
  remove(sim: Sim): void {
    this.clearArms(sim);
    this.suction = null;
    this.inks = [];
    this.publish(sim);
  }

  private clearArms(sim: Sim): void {
    for (const a of this.arms) {
      if (!a.alive) continue;
      a.alive = false;
      a.hp = 0;
      a.deadT = 0;
      sim.fx('sprite', 'fx_slam_splash', a.x, a.z, 1.2, 0.4);
    }
    this.arms = [];
    this.armsUp = false;
  }

  private submerge(m: Monster): void {
    m.fade = true;
    m.noHit = true;
  }

  /** Every tick (Monster.step leaves everything to this: it never moves). */
  update(dt: number, sim: Sim, m: Monster): void {
    // Hazards whose time is up go, even while it is stunned.
    const before = this.inks.length + (this.suction ? 1 : 0);
    this.inks = this.inks.filter((h) => sim.time < h.end);
    if (this.suction && sim.time >= this.suction.end) this.suction = null;
    if (this.inks.length + (this.suction ? 1 : 0) !== before) this.publish(sim);

    const inRoom = sim.players.filter((p) => p.alive && !sim.inSafe(p) && Math.hypot(p.x - m.x, p.z - m.z) <= arenaRadius(sim.zone) + 3);
    if (!inRoom.length) {
      // Whole group down: it waits as it is (holdsOnWipe, a phoenix feather may bring them back); nobody there at all: it resets.
      if (!m.holdsOnWipe(sim) && (this.fighting || m.hp < m.maxHp || m.damageBy.size > 0)) this.reset(sim, m);
      this.fighting = m.holdsOnWipe(sim) && this.fighting;
      m.state = 'idle';
      m.target = null;
      return;
    }
    if (!this.fighting) {
      this.fighting = true;
      this.submerge(m);
    }
    m.state = 'chase';
    if (!m.target?.alive || !inRoom.includes(m.target)) m.target = inRoom[Math.floor(Math.random() * inRoom.length)];
    if (m.stunT > 0) return;
    const t = dt * m.skillSpeed;

    // ---- arms / head
    this.t -= t;
    if (this.phase === 'arms') {
      if (!this.armsUp && this.t <= 0) this.raiseArms(sim, m);
      else if (this.armsUp && !this.arms.some((a) => a.alive)) this.surface(sim, m);
    } else if (this.t <= 0) {
      this.phase = 'arms';
      this.t = REGROW;
      this.armsUp = false;
      this.submerge(m);
      sim.fx('sprite', 'fx_slam_splash', m.x, m.z, 3.5, 0.6);
      sim.anim(m.id, 'dive', { duration: 0.6, fallback: 'attack' });
      sim.text(m.x, m.topY, m.z, 'คราเคนดำลงใต้น้ำวน!', 'info', 1);
    }

    // ---- ink
    this.inkCd -= t;
    if (this.inkCd <= 0) {
      this.inkCd = mv('kraken.inkCd');
      this.spitInk(sim, m, inRoom);
    }

    // ---- suction (not while its head is up: that is the time to hit it)
    this.suckCd -= t;
    if (this.suckCd <= 0 && !this.suction && this.phase === 'arms') {
      this.suckCd = mv('kraken.suckCd');
      this.suction = {
        id: sim.nextHazardId(), k: 'suction', x: m.x, z: m.z, r: arenaRadius(sim.zone) + 3, speed: mv('kraken.suckSpeed'),
        start: sim.time, hit: sim.time + SUCK_WARN, end: sim.time + SUCK_WARN + mv('kraken.suckSec'),
      };
      this.publish(sim);
      sim.fx('sprite', 'fx_suction', m.x, m.z, ROOM_WHIRLPOOL + 2, SUCK_WARN + mv('kraken.suckSec'));
      sim.text(m.x, m.topY, m.z, 'น้ำวนดูดเข้า!', 'crit', 1.1);
      sim.log('น้ำวนกำลังดูดทุกคนเข้ากลางลาน เดินสวนออกมา!', '#8ae0f0');
      sim.sfx('boss_slam', m.x, m.z);
    }
    if (this.suction && sim.time >= this.suction.hit) {
      this.rimT -= dt;
      if (this.rimT <= 0) {
        this.rimT = RIM_TICK;
        const edge = ROOM_WHIRLPOOL + RIM_NEAR;
        for (const p of inRoom) {
          if (Math.hypot(p.x - m.x, p.z - m.z) <= edge + p.radius) sim.hitPlayer(m, p, mv('kraken.suckMult'), {});
        }
      }
    }
  }

  /** Its arms rise round the rim, each with a share of its HP (keys and fighters included: a share of its max HP now). */
  private raiseArms(sim: Sim, m: Monster): void {
    this.clearArms(sim);
    const n = Math.max(1, Math.round(mv('kraken.arms')));
    const a0 = Math.random() * Math.PI * 2;
    const d = ROOM_WHIRLPOOL + RIM_OUT;
    const hp = Math.max(1, Math.round(m.maxHp * mv('kraken.armHp')));
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      const arm = sim.spawnSummon('kraken_arm', m.x + Math.cos(a) * d, m.z + Math.sin(a) * d, m.level);
      if (!arm) continue;
      arm.hpOverride = hp;
      arm.retune();
      arm.hp = arm.maxHp;
      arm.face(Math.cos(a), Math.sin(a));
      sim.fx('sprite', 'fx_slam_splash', arm.x, arm.z, 1.4, 0.5);
      this.arms.push(arm);
    }
    this.armsUp = true;
    sim.anim(m.id, 'arm_slam', { duration: 0.6, fallback: 'attack' });
    sim.text(m.x, m.topY, m.z, 'หนวดคราเคนโผล่รอบวังวน!', 'info', 1);
  }

  /** Every arm cut: its head comes up and can be hit for a while. */
  private surface(sim: Sim, m: Monster): void {
    this.phase = 'head';
    this.t = mv('kraken.headSec');
    this.armsUp = false;
    this.arms = [];
    m.fade = false;
    m.noHit = false;
    sim.fx('sprite', 'fx_slam_splash', m.x, m.z, 4, 0.7);
    sim.shake(0.35, m);
    sim.anim(m.id, 'arm_cut', { duration: 0.8, fallback: 'attack' });
    sim.text(m.x, m.topY + 0.6, m.z, 'คราเคนโผล่หัวขึ้นมา! โจมตีเลย!', 'crit', 1.3);
    sim.log('ตัดหนวดครบแล้ว คราเคนโผล่หัวขึ้นมาให้ตี', '#ffcf5a');
  }

  /** Ink shots at up to N players; a hit puts ink over that player's screen. */
  private spitInk(sim: Sim, m: Monster, players: Player[]): void {
    const n = Math.max(0, Math.round(mv('kraken.inkTargets')));
    const pool = [...players].sort(() => Math.random() - 0.5).slice(0, n);
    if (!pool.length) return;
    sim.anim(m.id, 'ink', { duration: 0.5, fallback: 'attack' });
    for (const p of pool) {
      const angle = Math.atan2(p.z - m.z, p.x - m.x);
      const range = arenaRadius(sim.zone) + 4;
      sim.fx('lineTelegraph', m.x, m.z, angle, range, INK_SHOT.radius * 2, 0.5);
      sim.addEnemyShot(m, {
        x: m.x + Math.cos(angle) * (ROOM_WHIRLPOOL - 0.5), z: m.z + Math.sin(angle) * (ROOM_WHIRLPOOL - 0.5), angle,
        speed: INK_SHOT.speed, range, radius: INK_SHOT.radius, mult: mv('kraken.inkMult'), color: INK_SHOT.color, size: INK_SHOT.size,
        art: 'ink_blob', kb: 0,
        onHitPlayer: (q) => this.inkOn(sim, q),
      });
    }
  }

  private inkOn(sim: Sim, p: Player): void {
    const end = sim.time + mv('kraken.inkSec');
    this.inks = [...this.inks.filter((h) => h.pid !== p.id), { id: sim.nextHazardId(), k: 'ink', pid: p.id, x: p.x, z: p.z, start: sim.time, hit: sim.time, end }];
    this.publish(sim);
    sim.fx('sprite', 'fx_ink_splat', p.x, p.z, 1.2, 0.6);
    sim.text(p.x, p.topY + 0.4, p.z, 'โดนหมึกบังตา!', 'info', 0.9, p.id);
  }
}
