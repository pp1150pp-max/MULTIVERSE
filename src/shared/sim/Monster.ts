import { Unit } from './Unit';
import type { Sim } from './Sim';
import type { Player } from './Player';
import type { MonsterDef } from '../data/monsters';
import type { SpawnArea } from '../data/zones';

const BOSS_RAMP_PER_SEC = 0.2;
const BOSS_RAMP_MAX = 3;

type State = 'idle' | 'chase' | 'return' | 'charge';
type Windup = 'melee' | 'slam' | 'charge';

export class Monster extends Unit {
  readonly def: MonsterDef;
  readonly area: SpawnArea;
  private readonly maxHpV: number;
  readonly atk: number;
  readonly defense: number;
  readonly expReward: number;
  state: State = 'idle';
  aggroT = 0;
  windupT = 0;
  enraged = false;
  deadT = 0;
  /** Called in by a boss: gives no EXP, gold or items, and never respawns. */
  summoned = false;
  /** Bosses: seconds of fighting since they last landed a hit. They speed up the longer it gets. */
  rampT = 0;
  /** Who it is fighting. Picked from all players, so it works the same alone or online. */
  target: Player | null = null;
  /** Damage dealt by each player id — EXP is split by these shares. */
  readonly damageBy = new Map<number, number>();
  private wanderT = Math.random() * 3;
  private wandering = false;
  private wx = 0;
  private wz = 0;
  private fleeT = 0;
  private atkCd = 0;
  private windKind: Windup = 'melee';
  private chargeCd = 2;
  private chargeT = 0;
  private chargeDx = 0;
  private chargeDz = 0;
  private chargeHit = false;
  private slamCd = 5;

  constructor(id: number, def: MonsterDef, level: number, area: SpawnArea, x: number, z: number) {
    super(id);
    this.def = def;
    this.area = area;
    this.level = level;
    const sc = 1 + 0.18 * (level - def.levels[0]);
    this.maxHpV = Math.round(def.hp * sc);
    this.hp = this.maxHpV;
    this.atk = def.atk * sc;
    this.defense = def.def * sc;
    this.expReward = Math.round(def.exp * sc);
    this.radius = def.radius;
    this.x = x;
    this.z = z;
    this.face(Math.random() - 0.5, Math.random() - 0.5);
  }

  get maxHp(): number { return this.maxHpV; }
  get topY(): number { return this.def.height * 0.75; }
  get isBoss(): boolean { return this.def.behavior === 'boss'; }
  get isHostile(): boolean {
    return this.alive && (this.state === 'chase' || this.state === 'charge' || this.windupT > 0);
  }

  onHit(sim: Sim, attacker: Player): void {
    this.aggroT = 12;
    if (!this.target?.alive) this.target = attacker;
    if (this.state !== 'charge') this.state = 'chase';
    if (this.def.behavior === 'skittish' && Math.random() < 0.4) this.fleeT = 1.2;
    if (this.def.pack) {
      for (const m of sim.monsters) {
        if (m !== this && m.alive && m.def.id === this.def.id && Math.hypot(m.x - this.x, m.z - this.z) < 9) {
          m.aggroT = 12;
          m.state = 'chase';
          if (!m.target?.alive) m.target = attacker;
        }
      }
    }
  }

  calm(): void {
    this.aggroT = 0;
    this.windupT = 0;
    this.target = null;
    if (this.state !== 'return') this.state = 'idle';
  }

  /** Nearest living player, for monsters that attack on sight. */
  private nearestPlayer(sim: Sim): { p: Player; d: number } | null {
    let best: { p: Player; d: number } | null = null;
    for (const p of sim.players) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - this.x, p.z - this.z);
      if (!best || d < best.d) best = { p, d };
    }
    return best;
  }

  update(dt: number, sim: Sim): void {
    if (!this.alive) {
      this.deadT += dt;
      this.moving = false;
      return;
    }
    this.moving = false;
    this.tickStatus(dt, sim.terrain);
    // Bosses that keep missing get faster at everything until they land a hit (Sim.hitPlayer resets it).
    if (this.isBoss) this.rampT = this.isHostile && this.state !== 'return' ? this.rampT + dt : 0;
    const ramp = this.ramp;
    this.atkCd -= dt * ramp;
    this.chargeCd -= dt * ramp;
    this.slamCd -= dt * ramp;
    this.aggroT -= dt;
    this.fleeT -= dt;

    // Lose a dead target; aggressive monsters pick up whoever walks into range.
    if (this.target && !this.target.alive) this.target = null;
    const b = this.def.behavior;
    if ((b === 'aggressive' || b === 'boss') && this.state !== 'return') {
      const n = this.nearestPlayer(sim);
      if (n && n.d < this.def.aggroRange) {
        this.aggroT = Math.max(this.aggroT, 4);
        if (!this.target) this.target = n.p;
      }
    }
    const p = this.target;
    const dx = p ? p.x - this.x : 0;
    const dz = p ? p.z - this.z : 0;
    const d = Math.hypot(dx, dz) || 0.001;
    let mx = 0;
    let mz = 0;
    let spd = this.def.speed;

    if (this.stunT > 0) {
      this.windupT = 0;
      if (this.state === 'charge') this.state = 'chase';
      return;
    }

    if (this.windupT > 0) {
      this.windupT -= dt;
      if (this.windKind !== 'charge' && p) this.face(dx, dz);
      // Bosses keep walking in while winding up a normal hit, so stepping back no longer dodges it.
      // The slam stays put: its warning circle is drawn where the boss stands.
      let dNow = d;
      if (this.isBoss && this.windKind === 'melee' && p && d > this.def.attackRange * 0.6) {
        const s = this.chaseSpeed() * this.speedMult() * dt;
        this.x += (dx / d) * s;
        this.z += (dz / d) * s;
        sim.terrain.resolve(this);
        this.moving = true;
        dNow = Math.hypot(p.x - this.x, p.z - this.z);
      }
      if (this.windupT <= 0) this.resolveWindup(sim, dNow);
      return;
    }

    if (this.state === 'charge') {
      this.chargeT -= dt;
      mx = this.chargeDx;
      mz = this.chargeDz;
      spd *= 3.6;
      if (!this.chargeHit) {
        for (const pl of sim.players) {
          if (pl.alive && Math.hypot(pl.x - this.x, pl.z - this.z) < this.radius + pl.radius + 0.3) {
            this.chargeHit = true;
            sim.hitPlayer(this, pl, 1.6, { kb: 9, fromX: this.x, fromZ: this.z });
            break;
          }
        }
      }
      if (this.chargeT <= 0) {
        this.state = 'chase';
        this.atkCd = 0.8;
      }
    } else {
      const leash = Math.hypot(this.x - this.area.x, this.z - this.area.z);
      if (this.state !== 'return' && leash > (this.isBoss ? 18 : 22)) {
        this.state = 'return';
        this.aggroT = 0;
        this.target = null;
      }
      if (this.state === 'return') {
        const hx = this.area.x - this.x;
        const hz = this.area.z - this.z;
        const hd = Math.hypot(hx, hz);
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25 * dt);
        if (hd < 1) {
          this.state = 'idle';
          this.hp = this.maxHp;
          this.enraged = false;
          this.damageBy.clear();
        } else {
          mx = hx / hd;
          mz = hz / hd;
          spd *= 1.4;
        }
      } else {
        const hostile = !!p && this.aggroT > 0;

        if (hostile && this.fleeT > 0) {
          mx = -dx / d;
          mz = -dz / d;
          spd *= 1.1;
          this.state = 'chase';
        } else if (hostile) {
          this.state = 'chase';
          if (this.isBoss && !this.enraged && this.hp < this.maxHp * 0.5) {
            this.enraged = true;
            sim.onBossEnrage(this);
          }
          const reach = this.def.attackRange + p.radius;
          const frenzy = this.enraged ? this.def.frenzy : undefined;
          if (b === 'charger' && this.chargeCd <= 0 && d > 2.5 && d < 8) {
            this.startCharge(sim, p.x, p.z, 0.65);
          } else if (this.isBoss && this.slamCd <= 0 && d < 5) {
            this.windKind = 'slam';
            this.windupT = 1.1 * this.skillMult();
            this.slamCd = frenzy ? 7 * frenzy.skill : this.enraged ? 5 : 7;
            sim.fx('telegraph', this.x, this.z, 4.2, this.windupT);
          } else if (d <= reach) {
            if (this.atkCd <= 0) {
              this.windKind = 'melee';
              this.windupT = (this.isBoss ? 0.5 : 0.35) * this.skillMult();
              this.atkCd = this.def.attackCooldown * (frenzy ? frenzy.skill : this.enraged ? 0.75 : 1);
            }
          } else {
            mx = dx / d;
            mz = dz / d;
            spd = this.chaseSpeed();
          }
        } else if (this.hp < this.maxHp || this.enraged) {
          // The fight is over (everyone died, left or stopped hitting it) but it is still hurt:
          // walk home like a leashed monster, healing on the way, then reset fully (HP, enrage, damage shares).
          this.state = 'return';
          this.target = null;
          this.aggroT = 0;
        } else {
          this.state = 'idle';
          this.target = null;
          this.wanderT -= dt;
          if (this.wanderT <= 0) {
            this.wandering = Math.random() < 0.55;
            const a = Math.random() * Math.PI * 2;
            const rr = Math.sqrt(Math.random()) * this.area.radius;
            this.wx = this.area.x + Math.cos(a) * rr;
            this.wz = this.area.z + Math.sin(a) * rr;
            this.wanderT = 2 + Math.random() * 3;
          }
          if (this.wandering) {
            const wdx = this.wx - this.x;
            const wdz = this.wz - this.z;
            const wd = Math.hypot(wdx, wdz);
            if (wd > 0.3) {
              mx = wdx / wd;
              mz = wdz / wd;
              spd *= 0.45;
            } else this.wandering = false;
          }
        }
      }
    }

    this.moving = mx !== 0 || mz !== 0;
    if (this.moving) {
      this.x += mx * spd * this.speedMult() * dt;
      this.z += mz * spd * this.speedMult() * dt;
      sim.terrain.resolve(this);
      this.face(mx, mz);
    } else if (this.state === 'chase' && p) {
      this.face(dx, dz);
    }
  }

  /** 1 normally; bosses climb 20% per second of not landing a hit, up to 3x. */
  get ramp(): number {
    return this.isBoss ? Math.min(BOSS_RAMP_MAX, 1 + BOSS_RAMP_PER_SEC * this.rampT) : 1;
  }

  /** Wind-ups shrink while a frenzy boss is enraged, and as a boss's ramp climbs. */
  private skillMult(): number {
    return (this.enraged && this.def.frenzy ? this.def.frenzy.skill : 1) / this.ramp;
  }

  /** Speed while running at its target (before slows). */
  private chaseSpeed(): number {
    const frenzy = this.enraged ? this.def.frenzy : undefined;
    return this.def.speed * (this.enraged ? (frenzy ? frenzy.speed : 1.3) : 1) * this.ramp;
  }

  /** Wind up a straight-line charge at (tx, tz), with a warning line on the ground. */
  startCharge(sim: Sim, tx: number, tz: number, windup: number): void {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const d = Math.hypot(dx, dz) || 0.001;
    this.chargeDx = dx / d;
    this.chargeDz = dz / d;
    this.windKind = 'charge';
    this.windupT = windup;
    this.chargeCd = 6;
    sim.fx('lineTelegraph', this.x, this.z, Math.atan2(dz, dx), 8, this.radius * 2, windup);
    this.face(dx, dz);
  }

  private resolveWindup(sim: Sim, d: number): void {
    const p = this.target;
    if (this.windKind === 'melee') {
      const ang = Math.atan2(this.faceZ, this.faceX);
      sim.fx('slash', this.x, this.z, ang, Math.PI * 0.6, this.def.attackRange + 0.6, '#ff8a6a');
      if (p?.alive && d <= this.def.attackRange + p.radius + 0.5) sim.hitPlayer(this, p, 1, {});
    } else if (this.windKind === 'slam') {
      sim.fx('ring', this.x, this.z, 4.2, '#ffb070', 0.45);
      sim.fx('burst', this.x, 0.3, this.z, '#c9a27a', 14, 6);
      sim.shake(0.45);
      sim.sfx('boss_slam', this.x, this.z);
      for (const pl of sim.players) {
        if (pl.alive && Math.hypot(pl.x - this.x, pl.z - this.z) <= 4.2 + pl.radius) {
          sim.hitPlayer(this, pl, 2, { stun: 0.7, kb: 7, fromX: this.x, fromZ: this.z });
        }
      }
    } else {
      this.state = 'charge';
      this.chargeT = 8 / (this.def.speed * 3.6);
      this.chargeHit = false;
    }
  }
}
