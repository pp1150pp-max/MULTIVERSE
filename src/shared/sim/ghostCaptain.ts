// The Ghost Captain of the Dead Ship, the Ghost Ship Graveyard's boss (plan 5.3, owner 2026-11-24). He walks and slashes like
// other bosses (no ground slam), and on top of that:
//  - fog:  ghost fog over the whole arena for a while; each player sees only a small circle around themselves (drawn by the
//          browser from a 'fog' hazard, so late joiners and reconnects see it too);
//  - bell: rings his ship's bell and ghost sailors rise around him, as often as it comes round, up to a number alive at once;
//  - warp: fades out, comes back behind his target and slashes around him after a short warning.
// Its numbers are in src/shared/moveTuning.ts (/admin, card "กัปตันผีเรือคนตาย"). Damage is times his ATK, so keys make it
// hit harder too.
import { arenaRadius } from '../data/zones';
import type { HazardBase } from './volcanoHeart';
import type { Monster } from './Monster';
import type { Player } from './Player';
import type { Sim } from './Sim';
import { mv } from './beachMoves';

/** Ghost fog over the arena from `hit` until `end`: each player sees `r` around themselves. Centred on the arena. */
export interface FogHazard extends HazardBase { k: 'fog'; r: number; end: number }

/** Seconds before his first fog, bell and warp of a fight. */
const FIRST = { fog: 8, bell: 5, warp: 3 };
/** The fog closes in over this long (its warning). */
const FOG_IN = 0.8;
/** The bell's wind-up. */
const BELL_WINDUP = 0.8;
/** He comes back this far behind his target. */
const WARP_BEHIND = 1.8;
/** He only warps to targets at least this far (closer, he just hits). */
const WARP_MIN = 2.5;

export class GhostCaptainBrain {
  private fogCd = FIRST.fog;
  private bellCd = FIRST.bell;
  private warpCd = FIRST.warp;
  private fog: FogHazard | null = null;
  private bellT = 0;
  /** The warp: hidden until `hideT` runs out, then winding up the slash for `slashT`. */
  private hideT = 0;
  private slashT = 0;
  private warpOn: Player | null = null;
  /** The ghost sailors his bell called (alive or not). */
  private crew: Monster[] = [];

  /** The fog, for tests. */
  get fogging(): boolean {
    return this.fog !== null;
  }

  private publish(sim: Sim): void {
    sim.hazards = this.fog ? [this.fog] : [];
  }

  /** Fight over (home, reset): fog lifted, back in sight, next fight from the start. His crew stays until killed. */
  reset(sim: Sim, m: Monster): void {
    if (this.fog) {
      this.fog = null;
      this.publish(sim);
    }
    this.unhide(m);
    this.bellT = this.slashT = 0;
    this.warpOn = null;
    this.fogCd = FIRST.fog;
    this.bellCd = FIRST.bell;
    this.warpCd = FIRST.warp;
  }

  /** He is dead: the fog lifts and the crew he called fade away with him. */
  remove(sim: Sim): void {
    this.fog = null;
    this.publish(sim);
    for (const c of this.crew) {
      if (!c.alive) continue;
      c.alive = false;
      c.hp = 0;
      c.deadT = 0;
      sim.fx('sprite', 'fx_spirit_puff', c.x, c.z, 1.6, 0.5);
    }
    this.crew = [];
  }

  /** Every tick, before anything can stop him (stuns): the fog still lifts on time. */
  tick(_dt: number, sim: Sim, _m: Monster): void {
    if (this.fog && sim.time >= this.fog.end) {
      this.fog = null;
      this.publish(sim);
    }
  }

  private unhide(m: Monster): void {
    if (this.hideT > 0 || m.fade) {
      this.hideT = 0;
      m.fade = false;
      m.noHit = false;
    }
  }

  /**
   * His own moves, once Monster has done the stun and wipe checks. True = he acted this tick (the usual chase and melee are
   * skipped); false = Monster goes on as for any boss.
   */
  act(dt: number, sim: Sim, m: Monster): boolean {
    const t = dt * m.skillSpeed;
    this.fogCd -= t;
    this.bellCd -= t;
    this.warpCd -= t;

    if (this.hideT > 0) {
      this.hideT -= dt;
      if (this.hideT <= 0) this.reappear(sim, m);
      return true;
    }
    if (this.slashT > 0) {
      this.slashT -= dt;
      if (this.slashT <= 0) this.slash(sim, m);
      return true;
    }
    if (this.bellT > 0) {
      this.bellT -= dt;
      if (this.bellT <= 0) this.ringBell(sim, m);
      return true;
    }
    const p = m.target;
    if (!p || m.state !== 'chase' || m.windupT > 0) return false;

    if (this.fogCd <= 0 && !this.fog) {
      this.fogCd = mv('ghost.fogCd');
      const r = arenaRadius(sim.zone);
      this.fog = { id: sim.nextHazardId(), k: 'fog', x: m.area.x, z: m.area.z, r: mv('ghost.fogSight'), start: sim.time, hit: sim.time + FOG_IN, end: sim.time + FOG_IN + mv('ghost.fogSec') };
      this.publish(sim);
      sim.fx('sprite', 'fx_mist', m.x, m.z, Math.max(4, r * 0.6), 1.2);
      sim.text(m.x, m.topY + 0.6, m.z, 'หมอกผีปกคลุม!', 'crit', 1.1);
      sim.log('หมอกผีปกคลุมลาน มองเห็นแค่รอบตัว', '#8ae8e0');
      return false;
    }
    if (this.bellCd <= 0 && this.crewAlive() < Math.round(mv('ghost.bellMax')) && Math.round(mv('ghost.bellCount')) > 0) {
      this.bellCd = mv('ghost.bellCd');
      this.bellT = BELL_WINDUP;
      sim.fx('sprite', 'fx_bell_waves', m.x, m.z, 3, BELL_WINDUP + 0.3, m.id);
      sim.anim(m.id, 'bell', { duration: BELL_WINDUP, fallback: 'attack' });
      return true;
    }
    const d = Math.hypot(p.x - m.x, p.z - m.z);
    if (this.warpCd <= 0 && d >= WARP_MIN) {
      this.warpCd = mv('ghost.warpCd');
      this.warpOn = p;
      this.hideT = mv('ghost.warpHide');
      m.fade = true;
      m.noHit = true;
      sim.fx('sprite', 'fx_spirit_puff', m.x, m.z, 2.6, 0.6);
      sim.anim(m.id, 'vanish', { duration: this.hideT, fallback: 'attack' });
      return true;
    }
    return false;
  }

  private crewAlive(): number {
    this.crew = this.crew.filter((c) => c.alive);
    return this.crew.length;
  }

  /** The bell: ghost sailors rise around him, never more alive at once than the card says. */
  private ringBell(sim: Sim, m: Monster): void {
    sim.sfx('boss_slam', m.x, m.z);
    sim.text(m.x, m.topY + 0.6, m.z, 'ระฆังเรือผีดังกังวาน!', 'crit', 1.1);
    const room = Math.max(0, Math.round(mv('ghost.bellMax')) - this.crewAlive());
    const n = Math.min(room, Math.round(mv('ghost.bellCount')));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = sim.spawnSummon('ghost_sailor', m.x + Math.cos(a) * 3, m.z + Math.sin(a) * 3);
      if (!s) continue;
      sim.terrain.resolve(s);
      sim.fx('sprite', 'fx_spirit_puff', s.x, s.z, 1.6, 0.5);
      if (m.target?.alive) s.taunt(m.target);
      this.crew.push(s);
    }
  }

  /** Back behind his target (where they face away from), with the slash's warning circle. */
  private reappear(sim: Sim, m: Monster): void {
    const p = this.warpOn?.alive && !sim.inSafe(this.warpOn) ? this.warpOn : m.target;
    if (p) {
      const fl = Math.hypot(p.faceX, p.faceZ) || 1;
      m.x = p.x - (p.faceX / fl) * WARP_BEHIND;
      m.z = p.z - (p.faceZ / fl) * WARP_BEHIND;
      sim.terrain.resolve(m);
      m.face(p.x - m.x, p.z - m.z);
    }
    this.unhide(m);
    sim.fx('sprite', 'fx_spirit_puff', m.x, m.z, 2.6, 0.6);
    this.slashT = mv('ghost.warpWindup') * m.skillMult();
    sim.fx('telegraph', m.x, m.z, mv('ghost.warpRadius'), this.slashT);
    sim.anim(m.id, 'slash', { duration: this.slashT, fallback: 'attack' });
  }

  /** The slash after a warp: everyone around him. */
  private slash(sim: Sim, m: Monster): void {
    const r = mv('ghost.warpRadius');
    sim.fx('ring', m.x, m.z, r, '#7fe0d0', 0.35);
    sim.fx('slash', m.x, m.z, Math.atan2(m.faceZ, m.faceX), Math.PI * 2, r + 0.4, '#7fe0d0');
    for (const p of sim.players) {
      if (p.alive && !sim.inSafe(p) && Math.hypot(p.x - m.x, p.z - m.z) <= r + p.radius) {
        sim.hitPlayer(m, p, mv('ghost.warpMult'), { kb: 4, fromX: m.x, fromZ: m.z });
      }
    }
    this.warpOn = null;
  }
}
