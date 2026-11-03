import type { Game } from '../Game';
import { Unit } from './Unit';
import { SpriteActor } from '../SpriteActor';
import { sheets } from '../assets';
import type { MonsterDef } from '../../shared/data/monsters';
import type { SpawnArea } from '../../shared/data/zones';

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

  constructor(def: MonsterDef, level: number, area: SpawnArea, x: number, z: number) {
    super(new SpriteActor(sheets[def.id], def.height, def.radius * 1.1));
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
    this.actor.face(Math.random() - 0.5, Math.random() - 0.5);
    this.syncView();
  }

  get maxHp(): number { return this.maxHpV; }
  get topY(): number { return this.def.height * 0.75; }
  get isBoss(): boolean { return this.def.behavior === 'boss'; }
  get isHostile(): boolean {
    return this.alive && (this.state === 'chase' || this.state === 'charge' || this.windupT > 0);
  }

  onHit(g: Game): void {
    this.aggroT = 12;
    if (this.state !== 'charge') this.state = 'chase';
    if (this.def.behavior === 'skittish' && Math.random() < 0.4) this.fleeT = 1.2;
    if (this.def.pack) {
      for (const m of g.monsters) {
        if (m !== this && m.alive && m.def.id === this.def.id && Math.hypot(m.x - this.x, m.z - this.z) < 9) {
          m.aggroT = 12;
          m.state = 'chase';
        }
      }
    }
  }

  calm(): void {
    this.aggroT = 0;
    this.windupT = 0;
    if (this.state !== 'return') this.state = 'idle';
  }

  update(dt: number, g: Game): void {
    if (!this.alive) {
      this.deadT += dt;
      this.actor.setOpacity(Math.max(0, 1 - this.deadT / 0.8));
      this.actor.group.position.y = -this.deadT * 0.25;
      return;
    }
    this.tickStatus(dt, g);
    this.atkCd -= dt;
    this.chargeCd -= dt;
    this.slamCd -= dt;
    this.aggroT -= dt;
    this.fleeT -= dt;

    const p = g.player;
    const dx = p.x - this.x;
    const dz = p.z - this.z;
    const d = Math.hypot(dx, dz) || 0.001;
    let mx = 0;
    let mz = 0;
    let spd = this.def.speed;

    if (this.stunT > 0) {
      this.windupT = 0;
      if (this.state === 'charge') this.state = 'chase';
      return this.finish(dt, false);
    }

    if (this.windupT > 0) {
      this.windupT -= dt;
      if (this.windKind !== 'charge') this.actor.face(dx, dz);
      if (this.windupT <= 0) this.resolveWindup(g, d, dx, dz);
      return this.finish(dt, false);
    }

    if (this.state === 'charge') {
      this.chargeT -= dt;
      mx = this.chargeDx;
      mz = this.chargeDz;
      spd *= 3.6;
      if (!this.chargeHit && p.alive && d < this.radius + p.radius + 0.3) {
        this.chargeHit = true;
        g.hitPlayer(this, 1.6, { kb: 9, fromX: this.x, fromZ: this.z });
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
        } else {
          mx = hx / hd;
          mz = hz / hd;
          spd *= 1.4;
        }
      } else {
        const b = this.def.behavior;
        const sees = (b === 'aggressive' || b === 'boss') && d < this.def.aggroRange;
        if (sees) this.aggroT = Math.max(this.aggroT, 4);
        const hostile = p.alive && this.aggroT > 0;

        if (hostile && this.fleeT > 0) {
          mx = -dx / d;
          mz = -dz / d;
          spd *= 1.1;
          this.state = 'chase';
        } else if (hostile) {
          this.state = 'chase';
          if (this.isBoss && !this.enraged && this.hp < this.maxHp * 0.5) {
            this.enraged = true;
            g.onBossEnrage(this);
          }
          const reach = this.def.attackRange + p.radius;
          if (b === 'charger' && this.chargeCd <= 0 && d > 2.5 && d < 8) {
            this.chargeDx = dx / d;
            this.chargeDz = dz / d;
            this.windKind = 'charge';
            this.windupT = 0.65;
            this.chargeCd = 6;
            g.fx.lineTelegraph(this.x, this.z, Math.atan2(dz, dx), 8, this.radius * 2, 0.65);
            this.actor.face(dx, dz);
          } else if (this.isBoss && this.slamCd <= 0 && d < 5) {
            this.windKind = 'slam';
            this.windupT = 1.1;
            this.slamCd = this.enraged ? 5 : 7;
            g.fx.telegraph(this.x, this.z, 4.2, 1.1);
          } else if (d <= reach) {
            if (this.atkCd <= 0) {
              this.windKind = 'melee';
              this.windupT = this.isBoss ? 0.5 : 0.35;
              this.atkCd = this.def.attackCooldown * (this.enraged ? 0.75 : 1);
            }
          } else {
            mx = dx / d;
            mz = dz / d;
            if (this.enraged) spd *= 1.3;
          }
        } else {
          this.state = 'idle';
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

    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      this.x += mx * spd * this.speedMult() * dt;
      this.z += mz * spd * this.speedMult() * dt;
      g.world.resolve(this);
      this.actor.face(mx, mz);
    } else if (this.state === 'chase') {
      this.actor.face(dx, dz);
    }
    this.finish(dt, moving);
  }

  private finish(dt: number, moving: boolean): void {
    this.syncView();
    this.actor.update(dt, moving, this.state === 'idle' ? 6 : 10);
  }

  private resolveWindup(g: Game, d: number, dx: number, dz: number): void {
    const p = g.player;
    if (this.windKind === 'melee') {
      g.fx.slash(this.x, this.z, Math.atan2(dz, dx), Math.PI * 0.6, this.def.attackRange + 0.6, '#ff8a6a');
      if (p.alive && d <= this.def.attackRange + p.radius + 0.5) g.hitPlayer(this, 1, {});
    } else if (this.windKind === 'slam') {
      g.fx.ring(this.x, this.z, 4.2, '#ffb070', 0.45);
      g.fx.burst(this.x, 0.3, this.z, '#c9a27a', 14, 6);
      g.shake(0.45);
      if (p.alive && d <= 4.2 + p.radius) g.hitPlayer(this, 2, { stun: 0.7, kb: 7, fromX: this.x, fromZ: this.z });
    } else {
      this.state = 'charge';
      this.chargeT = 8 / (this.def.speed * 3.6);
      this.chargeHit = false;
    }
  }
}
