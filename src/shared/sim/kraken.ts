// The Kraken, the Kraken Maelstrom's boss (plan 5.4; room and moves redone with the owner 2026-11-27). Its room is a round floor in
// the middle of a great whirlpool (zones.ts ROOM_ISLAND, ROOM_WHIRLPOOL); nobody walks into the water. The kraken rises from the
// water at the room's top corner on screen (KRAKEN_SPOT) and never moves (MonsterDef.anchored).
//  - arms:    its arms rise round the floor's shore (summons, kraken_arm, bigger than the field's) and slam long lines that reach
//             the middle of the floor (sim/maelstromMoves.ts tentacleTick). While any is up the kraken stays under (can't be hit).
//             Cut them all and its head comes up until it has lost a share of its max HP (20%) or crosses a phase line; then it
//             sinks and the arms grow back.
//  - phases by HP, each adding moves (owner 2026-11-27, "ค่อย ๆ เพิ่มท่า"):
//      100–50%: arm slams, ink, tentacles bursting up under players.
//      50–30%:  + a giant arm sweeping a fan from its corner, the whirlpool pulling everyone out to the shore, an arm grabbing one
//               player and dragging them to the shore (cut it to free them).
//      30–0%:   + a giant wave rolling over the floor, shark knights leaping out of the water, and frenzy (faster moves, one arm more).
// Every number is in src/shared/moveTuning.ts (/admin, card "คราเคน (บอส)"). Damage is times its ATK, so keys make it hit harder too.
import { arenaRadius, KRAKEN_SPOT, ROOM_ISLAND } from '../data/zones';
import type { HazardBase } from './volcanoHeart';
import type { Monster } from './Monster';
import type { Player } from './Player';
import type { Sim } from './Sim';
import type { Terrain } from './terrain';
import { mv } from './beachMoves';

/** Ink over one player's screen from `hit` until `end` (`pid` = whose). */
export interface InkHazard extends HazardBase { k: 'ink'; pid: number; end: number }
/**
 * The water pulls players towards (x, z) at `speed` from `hit` until `end`: everyone within `r`, or only player `pid` (an arm's
 * grab). `out`: away from (x, z) instead (the whirlpool dragging everyone out to the floor's shore).
 */
export interface SuctionHazard extends HazardBase { k: 'suction'; r: number; speed: number; end: number; out?: boolean; pid?: number }
/** A giant arm sweeping the fan from (x, z) along `angle`, `arc` wide (radians), `r` long; it hits at `hit`. */
export interface SweepHazard extends HazardBase { k: 'sweep'; angle: number; arc: number; r: number; end: number }

/** Its phases: 0 = 100–50% HP, 1 = 50–30%, 2 = 30–0%. */
type Band = 0 | 1 | 2;

/** Seconds before each move's first use in a fight, or after its phase starts. */
const FIRST = { arms: 1.5, ink: 6, erupt: 9, sweep: 4, suck: 10, grab: 15, wave: 4, shark: 10 };
/** The suction's warning before it pulls. */
const SUCK_WARN = 1;
/** Rim hits during the pull: this close to the floor's shore, every RIM_TICK seconds. */
const RIM_NEAR = 0.9;
const RIM_TICK = 0.5;
/** Its ink shot. */
const INK_SHOT = { speed: 9, radius: 0.6, size: 1.1, color: '#3a2a5a' };
/** After its head sinks, the arms come back after this long. */
const REGROW = 2;
/** No arms rise this close (radians) either side of the kraken itself. */
const ARM_GAP = 0.7;
/** A grab: its mark's radius; the grabbed player's damage every GRAB_TICK seconds. */
const GRAB_R = 1.5;
const GRAB_TICK = 0.5;
/** The giant wave: how thick its front is, and how often it splashes along it (a picture). */
const WAVE_THICK = 1.6;
const WAVE_FX = 0.15;
/** The angle from the kraken to the middle of the floor. */
const TO_MIDDLE = Math.atan2(-KRAKEN_SPOT.z, -KRAKEN_SPOT.x);

/**
 * One frame of the water's pull on a player (shared: the server for everyone it walks, the browser for its own character), from
 * the suction hazards in play. Kept out of the whirlpool by Terrain.resolve.
 */
export function suctionStep(p: { id?: number; x: number; z: number; radius: number }, hazards: readonly { k: string }[], time: number, dt: number, terrain: Terrain): boolean {
  let moved = false;
  for (const h of hazards) {
    if (h.k !== 'suction') continue;
    const s = h as SuctionHazard;
    if (time < s.hit || time >= s.end) continue;
    if (s.pid !== undefined && s.pid !== p.id) continue;
    const dx = s.x - p.x;
    const dz = s.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3 || d > s.r) continue;
    const step = s.out ? s.speed * dt : Math.min(d, s.speed * dt);
    const k = s.out ? -1 : 1;
    p.x += (dx / d) * step * k;
    p.z += (dz / d) * step * k;
    moved = true;
  }
  if (moved) terrain.resolve(p);
  return moved;
}

/** How fast the suctions in play pull this player (0 = none): the server lets a browser's reported walk go that much further. */
export function suctionSpeed(hazards: readonly { k: string }[], time: number, pid?: number): number {
  let v = 0;
  for (const h of hazards) {
    if (h.k !== 'suction') continue;
    const s = h as SuctionHazard;
    if (time < s.hit || time >= s.end) continue;
    if (s.pid !== undefined && pid !== undefined && s.pid !== pid) continue;
    v += s.speed;
  }
  return v;
}

interface Erupt { x: number; z: number; at: number }
interface Grab { pid: number; x: number; z: number; at: number; arm: Monster | null; hold: SuctionHazard | null; tick: number }
interface Wave { at: number; front: number; hit: Set<number>; fxT: number }
interface SharkCall { x: number; z: number; at: number }

export class KrakenBrain {
  private phase: 'arms' | 'head' = 'arms';
  /** Arms phase: until they rise (start of a fight, after the head sinks). */
  private t = FIRST.arms;
  private armsUp = false;
  private arms: Monster[] = [];
  /** Its HP when its head came up (it sinks after losing headShare of its max HP). */
  private headHp = 0;
  private band: Band = 0;
  private cd = { ink: FIRST.ink, erupt: FIRST.erupt, sweep: FIRST.sweep, suck: FIRST.suck, grab: FIRST.grab, wave: FIRST.wave, shark: FIRST.shark };
  private suction: SuctionHazard | null = null;
  private sweep: SweepHazard | null = null;
  private inks: InkHazard[] = [];
  private erupts: Erupt[] = [];
  private grab: Grab | null = null;
  private wave: Wave | null = null;
  private sharkCalls: SharkCall[] = [];
  private sharks: Monster[] = [];
  private rimT = 0;
  /** Was a fight on last tick (anyone in the room alive). */
  private fighting = false;
  private placed = false;

  /** Its head is up (for tests). */
  get headUp(): boolean {
    return this.phase === 'head';
  }

  /** Its arms alive (for tests; not a grabbing arm). */
  get armsAlive(): Monster[] {
    return this.arms.filter((a) => a.alive);
  }

  /** Its phase by HP: 0 = 100–50%, 1 = 50–30%, 2 = 30–0% (for tests). */
  get phaseBand(): Band {
    return this.band;
  }

  /** Its sharks alive (for tests). */
  get sharksAlive(): Monster[] {
    return this.sharks.filter((s) => s.alive);
  }

  private publish(sim: Sim): void {
    sim.hazards = [
      ...(this.suction ? [this.suction] : []), ...(this.sweep ? [this.sweep] : []), ...(this.grab?.hold ? [this.grab.hold] : []), ...this.inks,
    ];
  }

  private clearAll(sim: Sim): void {
    this.clearArms(sim);
    this.endGrab(sim);
    for (const s of this.sharks) this.sink(sim, s);
    this.sharks = [];
    this.sharkCalls = [];
    this.erupts = [];
    this.wave = null;
    this.suction = null;
    this.sweep = null;
    this.inks = [];
    this.publish(sim);
  }

  /** Fight over (nobody left in the room): everything goes, it sinks, the next fight starts fresh. */
  private reset(sim: Sim, m: Monster): void {
    this.clearAll(sim);
    this.phase = 'arms';
    this.t = FIRST.arms;
    this.band = 0;
    this.cd = { ink: FIRST.ink, erupt: FIRST.erupt, sweep: FIRST.sweep, suck: FIRST.suck, grab: FIRST.grab, wave: FIRST.wave, shark: FIRST.shark };
    this.submerge(m);
    m.resetFight();
  }

  /** It is dead: the water calms and its arms and sharks go with it. */
  remove(sim: Sim): void {
    this.clearAll(sim);
  }

  private sink(sim: Sim, a: Monster): void {
    if (!a.alive) return;
    a.alive = false;
    a.hp = 0;
    a.deadT = 0;
    sim.fx('sprite', 'fx_slam_splash', a.x, a.z, 1.2, 0.4);
  }

  private clearArms(sim: Sim): void {
    for (const a of this.arms) this.sink(sim, a);
    this.arms = [];
    this.armsUp = false;
  }

  private submerge(m: Monster): void {
    m.fade = true;
    m.noHit = true;
  }

  /** Frenzy (30% and below): every cooldown this much shorter. */
  private cdMult(): number {
    return this.band >= 2 ? mv('kraken.rageCd') : 1;
  }

  /** Every tick (Monster.step leaves everything to this: it never moves). */
  update(dt: number, sim: Sim, m: Monster): void {
    if (!this.placed) {
      // It rises at the room's top corner; its drop washes up on the floor.
      this.placed = true;
      m.x = KRAKEN_SPOT.x;
      m.z = KRAKEN_SPOT.z;
      m.lootFrom = { x: 0, z: 0 };
      m.face(Math.cos(TO_MIDDLE), Math.sin(TO_MIDDLE));
    }
    // Hazards whose time is up go, even while it is stunned.
    const before = this.inks.length + (this.suction ? 1 : 0) + (this.sweep ? 1 : 0);
    this.inks = this.inks.filter((h) => sim.time < h.end);
    if (this.suction && sim.time >= this.suction.end) this.suction = null;
    if (this.sweep && sim.time >= this.sweep.end) this.sweep = null;
    if (this.inks.length + (this.suction ? 1 : 0) + (this.sweep ? 1 : 0) !== before) this.publish(sim);

    // Everyone on the floor (measured from the room's middle, not from its corner).
    const c = sim.zone.boss ?? { x: 0, z: 0 };
    const inRoom = sim.players.filter((p) => p.alive && !sim.inSafe(p) && Math.hypot(p.x - c.x, p.z - c.z) <= arenaRadius(sim.zone) + 3);
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

    // Moves already on their way land even while it is stunned (their warning was shown).
    this.tickErupts(sim, m);
    this.tickGrab(dt, sim, m);
    this.tickWave(dt, sim, m);
    this.tickSweep(sim, m);
    this.tickSharkCalls(sim, m);
    this.tickRim(dt, sim, m, inRoom);

    // ---- phase by HP (only goes down: a fight that resets starts from the top)
    const share = m.hp / Math.max(1, m.maxHp);
    const band: Band = share <= mv('kraken.phase3') ? 2 : share <= mv('kraken.phase2') ? 1 : 0;
    if (band > this.band) this.enterBand(sim, m, band);

    if (m.stunT > 0) return;
    const t = dt * m.skillSpeed;

    // ---- arms / head
    if (this.phase === 'arms') {
      this.t -= t;
      if (!this.armsUp && this.t <= 0) this.raiseArms(sim, m);
      else if (this.armsUp && !this.arms.some((a) => a.alive)) this.surface(sim, m);
    } else if (this.headHp - m.hp >= m.maxHp * mv('kraken.headShare')) this.dive(sim, m);

    const mult = this.cdMult();
    for (const k of Object.keys(this.cd) as (keyof KrakenBrain['cd'])[]) this.cd[k] -= t;

    // ---- 100–50%: ink, tentacles bursting up
    if (this.cd.ink <= 0) {
      this.cd.ink = mv('kraken.inkCd') * mult;
      this.spitInk(sim, m, inRoom);
    }
    if (this.cd.erupt <= 0) {
      this.cd.erupt = mv('kraken.eruptCd') * mult;
      this.erupt(sim, m, inRoom);
    }
    if (this.band >= 1) {
      // ---- 50–30%: sweep, pull out (not while its head is up: that is the time to hit it), grab
      if (this.cd.sweep <= 0 && !this.sweep) {
        this.cd.sweep = mv('kraken.sweepCd') * mult;
        this.startSweep(sim, m, inRoom);
      }
      if (this.cd.suck <= 0 && !this.suction && this.phase === 'arms') {
        this.cd.suck = mv('kraken.suckCd') * mult;
        this.startPull(sim, m);
      }
      if (this.cd.grab <= 0 && !this.grab) {
        this.cd.grab = mv('kraken.grabCd') * mult;
        this.startGrab(sim, m, inRoom);
      }
    }
    if (this.band >= 2) {
      // ---- 30–0%: wave, sharks
      if (this.cd.wave <= 0 && !this.wave) {
        this.cd.wave = mv('kraken.waveCd') * mult;
        this.startWave(sim, m);
      }
      if (this.cd.shark <= 0 && !this.sharkCalls.length) {
        this.cd.shark = mv('kraken.sharkCd') * mult;
        this.callSharks(sim, m);
      }
    }
  }

  /** A new phase by HP: its head sinks if it is up, the new moves get a moment before their first use. */
  private enterBand(sim: Sim, m: Monster, band: Band): void {
    this.band = band;
    if (band === 1) {
      this.cd.sweep = FIRST.sweep;
      this.cd.suck = FIRST.suck;
      this.cd.grab = FIRST.grab;
      sim.text(m.x, m.topY + 0.6, m.z, 'คราเคนโกรธจัด!', 'crit', 1.3);
      sim.log('คราเคนเลือดเหลือครึ่ง หนวดยักษ์และน้ำวนเริ่มเล่นงาน!', '#ff9a6a');
    } else {
      this.cd.wave = FIRST.wave;
      this.cd.shark = FIRST.shark;
      sim.text(m.x, m.topY + 0.6, m.z, 'คราเคนคลั่ง!', 'crit', 1.4);
      sim.log('คราเคนคลั่ง! ท่าเร็วขึ้น คลื่นยักษ์และฉลามมาแล้ว', '#ff6a6a');
    }
    sim.shake(0.4, m);
    if (this.phase === 'head') this.dive(sim, m);
  }

  /** Its head sinks again; the arms come back after a moment. */
  private dive(sim: Sim, m: Monster): void {
    this.phase = 'arms';
    this.t = REGROW;
    this.armsUp = false;
    this.submerge(m);
    sim.fx('sprite', 'fx_slam_splash', m.x, m.z, 3.5, 0.6);
    sim.anim(m.id, 'dive', { duration: 0.6, fallback: 'attack' });
    sim.text(m.x, m.topY, m.z, 'คราเคนดำลงใต้น้ำวน!', 'info', 1);
  }

  /** Angles round the floor's shore, n evenly over the shore but the stretch in front of the kraken. */
  private shoreAngles(n: number): number[] {
    const k = TO_MIDDLE + Math.PI;
    const span = Math.PI * 2 - ARM_GAP * 2;
    const jitter = (Math.random() - 0.5) * (span / Math.max(1, n)) * 0.4;
    return Array.from({ length: n }, (_, i) => k + ARM_GAP + ((i + 0.5) / n) * span + jitter);
  }

  /** One arm rising out of the water at `a` round the shore, with a share of its HP. */
  private armAt(sim: Sim, m: Monster, a: number, share: number): Monster | null {
    const d = ROOM_ISLAND + mv('kraken.armOut');
    const arm = sim.spawnSummon('kraken_arm', Math.cos(a) * d, Math.sin(a) * d, m.level);
    if (!arm) return null;
    arm.hpOverride = Math.max(1, Math.round(m.maxHp * share));
    arm.retune();
    arm.hp = arm.maxHp;
    arm.face(-Math.cos(a), -Math.sin(a));
    sim.fx('sprite', 'fx_slam_splash', arm.x, arm.z, 1.8, 0.5);
    return arm;
  }

  /** Its arms rise round the shore, each with a share of its HP (keys and fighters included: a share of its max HP now). */
  private raiseArms(sim: Sim, m: Monster): void {
    this.clearArms(sim);
    const n = Math.max(1, Math.round(mv('kraken.arms') + (this.band >= 2 ? mv('kraken.rageArms') : 0)));
    for (const a of this.shoreAngles(n)) {
      const arm = this.armAt(sim, m, a, mv('kraken.armHp'));
      if (arm) this.arms.push(arm);
    }
    this.armsUp = true;
    sim.anim(m.id, 'arm_slam', { duration: 0.6, fallback: 'attack' });
    sim.text(m.x, m.topY, m.z, 'หนวดคราเคนโผล่รอบวังวน!', 'info', 1);
  }

  /** Every arm cut: its head comes up and can be hit until it has lost headShare of its max HP. */
  private surface(sim: Sim, m: Monster): void {
    this.phase = 'head';
    this.headHp = m.hp;
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

  // ---- ink

  /** Ink shots at up to N players; a hit puts ink over that player's screen. */
  private spitInk(sim: Sim, m: Monster, players: Player[]): void {
    const n = Math.max(0, Math.round(mv('kraken.inkTargets')));
    const pool = [...players].sort(() => Math.random() - 0.5).slice(0, n);
    if (!pool.length) return;
    sim.anim(m.id, 'ink', { duration: 0.5, fallback: 'attack' });
    const range = ROOM_ISLAND * 2 + 5;
    for (const p of pool) {
      const angle = Math.atan2(p.z - m.z, p.x - m.x);
      sim.fx('lineTelegraph', m.x, m.z, angle, range, INK_SHOT.radius * 2, 0.5);
      sim.addEnemyShot(m, {
        x: m.x, z: m.z, angle,
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

  // ---- tentacles bursting up under every player

  private erupt(sim: Sim, m: Monster, players: Player[]): void {
    const warn = mv('kraken.eruptWarn') * m.skillMult();
    const r = mv('kraken.eruptR');
    for (const p of players) {
      this.erupts.push({ x: p.x, z: p.z, at: sim.time + warn });
      sim.fx('telegraph', p.x, p.z, r, warn);
    }
    sim.anim(m.id, 'arm_slam', { duration: 0.5, fallback: 'attack' });
  }

  private tickErupts(sim: Sim, m: Monster): void {
    if (!this.erupts.length) return;
    const r = mv('kraken.eruptR');
    const due = this.erupts.filter((e) => sim.time >= e.at);
    if (!due.length) return;
    this.erupts = this.erupts.filter((e) => sim.time < e.at);
    for (const e of due) {
      sim.fx('sprite', 'fx_slam_splash', e.x, e.z, r, 0.5);
      for (const p of sim.players) {
        if (p.alive && Math.hypot(p.x - e.x, p.z - e.z) <= r + p.radius) sim.hitPlayer(m, p, mv('kraken.eruptMult'), { stun: mv('kraken.eruptStun') });
      }
    }
    sim.shake(0.15, m);
  }

  // ---- giant arm sweeping a fan from its corner

  private startSweep(sim: Sim, m: Monster, players: Player[]): void {
    const p = players[Math.floor(Math.random() * players.length)];
    // Towards a player, kept within the floor's sides of the middle so the far side stays safe.
    const toP = Math.atan2(p.z - m.z, p.x - m.x);
    const off = Math.atan2(Math.sin(toP - TO_MIDDLE), Math.cos(toP - TO_MIDDLE));
    const angle = TO_MIDDLE + Math.max(-0.6, Math.min(0.6, off));
    const warn = mv('kraken.sweepWarn') * m.skillMult();
    this.sweep = {
      id: sim.nextHazardId(), k: 'sweep', x: m.x, z: m.z, angle, arc: (mv('kraken.sweepArc') * Math.PI) / 180, r: mv('kraken.sweepLen'),
      start: sim.time, hit: sim.time + warn, end: sim.time + warn + 0.4,
    };
    this.publish(sim);
    sim.anim(m.id, 'arm_slam', { duration: warn, fallback: 'attack' });
    sim.text(m.x, m.topY, m.z, 'หนวดยักษ์กวาด!', 'crit', 1);
  }

  private sweepDone = -1;

  private tickSweep(sim: Sim, m: Monster): void {
    const s = this.sweep;
    if (!s || sim.time < s.hit || this.sweepDone === s.id) return;
    this.sweepDone = s.id;
    for (const p of sim.players) {
      if (!p.alive) continue;
      const dx = p.x - s.x;
      const dz = p.z - s.z;
      const d = Math.hypot(dx, dz);
      const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dz, dx) - s.angle), Math.cos(Math.atan2(dz, dx) - s.angle)));
      if (d <= s.r + p.radius && off <= s.arc / 2) sim.hitPlayer(m, p, mv('kraken.sweepMult'), { kb: mv('kraken.sweepKb'), fromX: s.x, fromZ: s.z });
    }
    sim.shake(0.3, m);
    for (let i = -1; i <= 1; i++) {
      const a = s.angle + (i * s.arc) / 3;
      sim.fx('sprite', 'fx_slam_splash', s.x + Math.cos(a) * s.r * 0.7, s.z + Math.sin(a) * s.r * 0.7, 1.6, 0.45);
    }
  }

  // ---- the whirlpool dragging everyone out to the shore

  private startPull(sim: Sim, m: Monster): void {
    this.suction = {
      id: sim.nextHazardId(), k: 'suction', x: 0, z: 0, r: ROOM_ISLAND + 1, speed: mv('kraken.suckSpeed'), out: true,
      start: sim.time, hit: sim.time + SUCK_WARN, end: sim.time + SUCK_WARN + mv('kraken.suckSec'),
    };
    this.rimT = 0;
    this.publish(sim);
    sim.text(m.x, m.topY, m.z, 'น้ำวนดึงออก!', 'crit', 1.1);
    sim.log('น้ำวนกำลังดึงทุกคนออกไปขอบพื้น เดินสวนเข้ากลาง!', '#8ae0f0');
    sim.sfx('boss_slam', m.x, m.z);
  }

  /** While the pull is on, whoever stands at the floor's shore is hurt over and over. */
  private tickRim(dt: number, sim: Sim, m: Monster, players: Player[]): void {
    if (!this.suction || sim.time < this.suction.hit) return;
    this.rimT -= dt;
    if (this.rimT > 0) return;
    this.rimT = RIM_TICK;
    for (const p of players) {
      if (Math.hypot(p.x, p.z) >= ROOM_ISLAND - RIM_NEAR - p.radius) sim.hitPlayer(m, p, mv('kraken.suckMult'), {});
    }
  }

  // ---- an arm grabbing one player and dragging them to the shore

  private startGrab(sim: Sim, m: Monster, players: Player[]): void {
    const p = players[Math.floor(Math.random() * players.length)];
    const warn = mv('kraken.grabWarn') * m.skillMult();
    this.grab = { pid: p.id, x: p.x, z: p.z, at: sim.time + warn, arm: null, hold: null, tick: 0 };
    sim.fx('telegraph', p.x, p.z, GRAB_R, warn);
    sim.text(p.x, p.topY + 0.4, p.z, 'หนวดจะคว้า! หลบออกจากวง!', 'crit', 1, p.id);
  }

  private endGrab(sim: Sim): void {
    const g = this.grab;
    if (!g) return;
    if (g.arm) this.sink(sim, g.arm);
    this.grab = null;
    this.publish(sim);
  }

  private tickGrab(dt: number, sim: Sim, m: Monster): void {
    const g = this.grab;
    if (!g) return;
    const p = sim.players.find((q) => q.id === g.pid);
    if (!g.arm) {
      if (sim.time < g.at) return;
      // Still in the mark: an arm rises at the nearest shore and holds them; else it grabs nothing.
      if (!p?.alive || Math.hypot(p.x - g.x, p.z - g.z) > GRAB_R + p.radius) {
        sim.fx('sprite', 'fx_slam_splash', g.x, g.z, 1.2, 0.4);
        this.grab = null;
        return;
      }
      const a = Math.atan2(p.z, p.x);
      const arm = this.armAt(sim, m, a, mv('kraken.grabHp'));
      if (!arm) {
        this.grab = null;
        return;
      }
      // A holding arm does not slam (tentacleTick waits while pinned).
      arm.pinnedUntil = sim.time + mv('kraken.grabSec') + 1;
      g.arm = arm;
      g.hold = {
        id: sim.nextHazardId(), k: 'suction', x: arm.x, z: arm.z, r: ROOM_ISLAND * 2 + 4, speed: mv('kraken.grabSpeed'), pid: p.id,
        start: sim.time, hit: sim.time, end: sim.time + mv('kraken.grabSec'),
      };
      g.tick = 0;
      this.publish(sim);
      sim.text(p.x, p.topY + 0.4, p.z, 'โดนหนวดรัด! ตัดหนวดช่วยกัน!', 'crit', 1.2);
      sim.log(`${p.name} โดนหนวดคราเคนรัด! ตีหนวดเส้นนั้นให้ขาดเพื่อช่วย`, '#ff9a6a');
      return;
    }
    // Freed: the arm was cut, its time is up, or they are down.
    if (!g.arm.alive || !p?.alive || sim.time >= g.hold!.end) {
      if (!g.arm.alive && p?.alive) sim.text(p.x, p.topY + 0.4, p.z, 'หลุดจากหนวดแล้ว!', 'info', 0.9);
      this.endGrab(sim);
      return;
    }
    g.tick -= dt;
    if (g.tick <= 0) {
      g.tick = GRAB_TICK;
      sim.hitPlayer(m, p, mv('kraken.grabMult'), {});
    }
  }

  // ---- giant wave rolling over the floor from its corner

  private startWave(sim: Sim, m: Monster): void {
    const warn = mv('kraken.waveWarn') * m.skillMult();
    const len = Math.hypot(KRAKEN_SPOT.x, KRAKEN_SPOT.z) + ROOM_ISLAND + 1;
    sim.fx('lineTelegraph', m.x, m.z, TO_MIDDLE, len, ROOM_ISLAND * 2 + 1, warn);
    this.wave = { at: sim.time + warn, front: 0, hit: new Set(), fxT: 0 };
    sim.anim(m.id, 'arm_slam', { duration: warn, fallback: 'attack' });
    sim.text(m.x, m.topY + 0.6, m.z, 'คลื่นยักษ์!', 'crit', 1.2);
    sim.log('คราเคนตบน้ำ คลื่นยักษ์กำลังมา! แดชทะลุคลื่น', '#8ae0f0');
  }

  private tickWave(dt: number, sim: Sim, m: Monster): void {
    const w = this.wave;
    if (!w || sim.time < w.at) return;
    const len = Math.hypot(KRAKEN_SPOT.x, KRAKEN_SPOT.z) + ROOM_ISLAND + 1;
    w.front += mv('kraken.waveSpeed') * dt;
    const dx = Math.cos(TO_MIDDLE);
    const dz = Math.sin(TO_MIDDLE);
    const ox = KRAKEN_SPOT.x;
    const oz = KRAKEN_SPOT.z;
    for (const p of sim.players) {
      if (!p.alive || w.hit.has(p.id)) continue;
      const t = (p.x - ox) * dx + (p.z - oz) * dz;
      if (t <= w.front + p.radius && t >= w.front - WAVE_THICK - p.radius) {
        w.hit.add(p.id);
        // Pushed on with the wave, away from the kraken.
        sim.hitPlayer(m, p, mv('kraken.waveMult'), { kb: mv('kraken.waveKb'), fromX: p.x - dx, fromZ: p.z - dz });
      }
    }
    w.fxT -= dt;
    if (w.fxT <= 0) {
      w.fxT = WAVE_FX;
      for (let i = -2; i <= 2; i++) {
        const s = (i / 2) * ROOM_ISLAND * 0.9;
        sim.fx('sprite', 'fx_slam_splash', ox + dx * w.front - dz * s, oz + dz * w.front + dx * s, 1.4, 0.35);
      }
    }
    if (w.front >= len) this.wave = null;
  }

  // ---- shark knights leaping out of the water onto the floor

  private callSharks(sim: Sim, m: Monster): void {
    // Never more than kraken.sharks on the floor at once: a call only tops them up.
    this.sharks = this.sharks.filter((s) => s.alive);
    const n = Math.max(0, Math.round(mv('kraken.sharks')) - this.sharks.length);
    for (const a of this.shoreAngles(n)) {
      const d = ROOM_ISLAND - 1.5;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      this.sharkCalls.push({ x, z, at: sim.time + 1 });
      sim.fx('telegraph', x, z, 1.2, 1);
    }
    if (n) sim.text(m.x, m.topY, m.z, 'คราเคนเรียกฉลาม!', 'info', 1);
  }

  private tickSharkCalls(sim: Sim, m: Monster): void {
    if (!this.sharkCalls.length) return;
    const due = this.sharkCalls.filter((c) => sim.time >= c.at);
    if (!due.length) return;
    this.sharkCalls = this.sharkCalls.filter((c) => sim.time < c.at);
    this.sharks = this.sharks.filter((s) => s.alive);
    for (const c of due) {
      const s = sim.spawnSummon('shark_knight', c.x, c.z, m.level);
      if (!s) continue;
      // Its HP and hit from the kraken's card (/admin), on top of a Lv80 shark knight in this room (keys included).
      s.hpOverride = Math.max(1, Math.round(s.maxHp * mv('kraken.sharkHp')));
      s.retune();
      s.hp = s.maxHp;
      s.atk *= mv('kraken.sharkAtk');
      s.face(-c.x, -c.z);
      sim.fx('sprite', 'fx_slam_splash', c.x, c.z, 1.4, 0.5);
      this.sharks.push(s);
    }
  }
}
