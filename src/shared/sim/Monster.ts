import { Unit } from './Unit';
import type { Sim } from './Sim';
import type { Player } from './Player';
import type { MonsterDef, ShotDef } from '../data/monsters';
import { NO_BOOST, type MonsterBoost, type SpawnArea } from '../data/zones';
import { VolcanoHeartBrain } from './volcanoHeart';
import { SPELL_GAP, WitchSpells } from './bogWitch';

const BOSS_RAMP_PER_SEC = 0.2;
const BOSS_RAMP_MAX = 3;
/** Boss max HP added for each player past the first who hits it: 1 player x1, 2 x1.5, 3 x2… */
export const BOSS_HP_PER_PLAYER = 0.5;
/** Enrage-ramp bosses wait this many seconds after landing a hit before speeding up again. */
const RAGE_RAMP_COOLDOWN = 3;
/** Their climb is steeper and goes higher than other bosses'. Only running uses the part above BOSS_RAMP_MAX. */
const RAGE_RAMP_PER_SEC = 0.5;
const RAGE_RAMP_MAX = 4;

/** A vanishing boss's jump off the map and its fall back, in seconds, and how high it goes. */
const JUMP_OUT_TIME = 0.9;
const FALL_TIME = 1.1;
const JUMP_HEIGHT = 16;
const LEAP_TIME = 0.45;
const LEAP_HEIGHT = 3;
const DEFAULT_SLAM_RADIUS = 4.2;

type State = 'idle' | 'chase' | 'return' | 'charge' | 'leap';
type Windup = 'melee' | 'slam' | 'charge' | 'throw' | 'leap';

export class Monster extends Unit {
  readonly def: MonsterDef;
  readonly area: SpawnArea;
  /** Max HP for one player; bosses get more for each extra player who hits them (see addFighter). */
  private readonly baseHp: number;
  private hpMult = 1;
  readonly atk: number;
  readonly defense: number;
  /** Armor break (Gunslinger's Armor-Piercing Round): defense is lowered by this share until `armorBreakUntil` (sim time). */
  armorBreak = 0;
  armorBreakUntil = 0;
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
  /** Height above the ground while jumping, for drawing. */
  lift = 0;
  /** A vanished boss is out of sim.monsters; Sim brings it back. Set here so Sim can drop it after the update loop. */
  gone = false;
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
  private thrownCd = 2;
  private rampWait = 0;
  private shotAngle = 0;
  private leapCd = 0;
  private leapT = 0;
  private leapFromX = 0;
  private leapFromZ = 0;
  private leapToX = 0;
  private leapToZ = 0;
  private jumpOutT = 0;
  /** Has used its once-per-fight vanish. */
  private vanished = false;
  private fallT = 0;
  /** Bosses with a scripted pattern. Made on first use, so only the server has one. */
  private brain: VolcanoHeartBrain | null = null;
  /** The Bog Witch's spells (def.spells). Made on first use, so only the server has them. */
  spells: WitchSpells | null = null;

  /** The zone's monster boost: multiplies HP, attack and defense, and speed (moving and attacking). */
  private readonly zoneSpeed: number;
  /** The zone's boost: how much faster skill cooldowns run. */
  readonly skillSpeed: number;
  /** Range at which it attacks whoever comes near: its own, or the zone's when that is larger. */
  private readonly aggroRange: number;
  /** The zone makes even passive monsters attack on sight. */
  private readonly forceAggro: boolean;

  constructor(id: number, def: MonsterDef, level: number, area: SpawnArea, x: number, z: number, boost: MonsterBoost = NO_BOOST) {
    super(id);
    this.def = def;
    this.area = area;
    this.level = level;
    const sc = 1 + 0.18 * (level - def.levels[0]);
    const tough = def.ignoreTough ? 1 : (boost.tough ?? 1) * (def.behavior === 'boss' ? 1 : boost.mobTough ?? 1);
    // Keys put into a boss room: HP and attack (not defense or speed) times the number of keys (owner).
    const keys = boost.keys ?? 1;
    this.baseHp = Math.round(def.hp * sc * boost.stats * tough * keys);
    this.hp = this.baseHp;
    this.atk = def.atk * sc * boost.stats * keys;
    this.defense = def.def * sc * boost.stats * tough;
    this.zoneSpeed = boost.speed * (def.speedMult ?? 1);
    this.skillSpeed = (boost.skill ?? 1) * (def.speedMult ?? 1);
    this.aggroRange = Math.max(def.aggroRange, boost.aggro ?? 0);
    this.forceAggro = (boost.aggro ?? 0) > 0;
    this.expReward = Math.round(def.exp * sc);
    this.radius = def.radius;
    this.x = x;
    this.z = z;
    this.face(Math.random() - 0.5, Math.random() - 0.5);
  }

  get maxHp(): number { return Math.round(this.baseHp * this.hpMult); }

  /**
   * Bosses: called when a player hits it for the first time this fight (`fighters` counts them,
   * that player included). Max HP becomes BOSS_HP_PER_PLAYER times as many players past the first,
   * and current HP grows with it, so the share of HP left stays the same.
   */
  addFighter(fighters: number): void {
    if (!this.isBoss) return;
    const mult = 1 + BOSS_HP_PER_PLAYER * Math.max(0, fighters - 1);
    if (mult <= this.hpMult) return;
    this.hp *= mult / this.hpMult;
    this.hpMult = mult;
  }

  /** Fight over: back to one player's HP, full, with no damage shares. */
  resetFight(): void {
    this.hpMult = 1;
    this.hp = this.maxHp;
    this.damageBy.clear();
  }

  /** The client mirror: takes the server's max HP so the HP bar matches. */
  syncMaxHp(maxHp: number): void {
    this.hpMult = maxHp / this.baseHp;
  }
  /** Walking speed before enrage, ramps and slows: the def's, times the zone's boost. */
  private get baseSpeed(): number { return this.def.speed * this.zoneSpeed; }
  get topY(): number { return this.def.height * 0.75; }
  get isBoss(): boolean { return this.def.behavior === 'boss'; }
  get isHostile(): boolean {
    return this.alive && (this.state === 'chase' || this.state === 'charge' || this.state === 'leap' || this.windupT > 0);
  }
  /** In the air after vanishing or on its way back: can't be hit. */
  get untargetable(): boolean { return this.jumpOutT > 0 || this.fallT > 0; }
  private get slamRadius(): number { return this.def.slamRadius ?? DEFAULT_SLAM_RADIUS; }

  onHit(sim: Sim, attacker: Player): void {
    this.aggroT = 12;
    if (!this.target?.alive) this.target = attacker;
    if (this.state !== 'charge' && this.state !== 'leap') this.state = 'chase';
    if (this.def.behavior === 'skittish' && Math.random() < 0.4) this.fleeT = 1.2;
    if (this.def.pack) {
      for (const m of sim.monsters) {
        if (m !== this && m.alive && (m.def.packId ?? m.def.id) === (this.def.packId ?? this.def.id) && Math.hypot(m.x - this.x, m.z - this.z) < 9) {
          m.aggroT = 12;
          m.state = 'chase';
          if (!m.target?.alive) m.target = attacker;
        }
      }
    }
  }

  /** Turn on `p` whoever it was after (the sword's charge). It keeps that target like any other. */
  taunt(p: Player): void {
    if (!this.alive || this.state === 'return' || this.untargetable) return;
    this.target = p;
    this.aggroT = 12;
    if (this.state !== 'charge' && this.state !== 'leap') this.state = 'chase';
  }

  calm(): void {
    this.aggroT = 0;
    this.windupT = 0;
    this.target = null;
    this.lift = 0;
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
    if (this.def.pattern) {
      this.brain ??= new VolcanoHeartBrain();
      this.face(1, 1);
      this.brain.update(dt, sim, this);
      return;
    }
    if (this.def.spells) {
      this.spells ??= new WitchSpells();
      // Out of the fight: her pools and curses go and the next fight starts fresh.
      if (this.state === 'return' || (this.state === 'idle' && !this.target)) this.spells.reset(sim);
      // Before any early return below, so a stunned witch's pools still hurt and curses still land.
      this.spells.update(sim, this);
    }
    if (this.jumpOutT > 0) {
      this.jumpOutT -= dt;
      const up = Math.max(0, 1 - this.jumpOutT / JUMP_OUT_TIME - 0.3) / 0.7;
      this.lift = up * up * JUMP_HEIGHT;
      if (this.jumpOutT <= 0) sim.onBossGone(this);
      return;
    }
    if (this.fallT > 0) {
      this.fallT -= dt;
      const up = Math.max(0, this.fallT / FALL_TIME);
      this.lift = up * up * JUMP_HEIGHT;
      if (this.fallT <= 0) {
        this.lift = 0;
        this.windKind = 'slam';
        this.resolveWindup(sim, 0);
      }
      return;
    }
    if (this.state === 'leap') {
      this.leapT -= dt;
      const k = Math.min(1, 1 - this.leapT / LEAP_TIME);
      this.x = this.leapFromX + (this.leapToX - this.leapFromX) * k;
      this.z = this.leapFromZ + (this.leapToZ - this.leapFromZ) * k;
      this.lift = Math.sin(Math.PI * k) * LEAP_HEIGHT;
      this.moving = true;
      if (this.leapT <= 0) this.landLeap(sim);
      return;
    }
    this.tickStatus(dt, sim.terrain);
    // Bosses that keep missing get faster at everything until they land a hit (Sim.hitPlayer resets it).
    if (this.isBoss) {
      this.rampWait -= dt;
      this.rampT = this.ramping && this.rampWait <= 0 && this.isHostile && this.state !== 'return' ? this.rampT + dt : 0;
    }
    const ramp = this.skillRamp;
    this.atkCd -= dt * ramp;
    const skillTick = dt * ramp * this.skillSpeed;
    this.chargeCd -= skillTick;
    this.slamCd -= skillTick;
    this.thrownCd -= skillTick;
    if (this.spells) this.spells.cd -= skillTick;
    this.leapCd -= dt * this.skillSpeed;
    this.aggroT -= dt;
    this.fleeT -= dt;

    // Lose a dead target; aggressive monsters pick up whoever walks into range.
    if (this.target && !this.target.alive) this.target = null;
    const b = this.def.behavior;
    if ((b === 'aggressive' || b === 'boss' || b === 'charger' || this.forceAggro) && this.state !== 'return') {
      const n = this.nearestPlayer(sim);
      if (n && n.d < this.aggroRange) {
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
    let spd = this.baseSpeed;

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
          this.enraged = false;
          this.vanished = false;
          this.resetFight();
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
          // A vanish comes first, so a hit past both marks still sends the minions before the rage.
          if (this.def.summon?.vanish && !this.vanished && this.hp < this.maxHp * 0.5) {
            this.vanished = true;
            sim.onBossVanish(this);
            return;
          }
          if (this.isBoss && !this.enraged && this.hp < this.maxHp * (this.def.enrageAt ?? 0.5)) {
            this.enraged = true;
            sim.onBossEnrage(this);
          }
          const reach = this.def.attackRange + p.radius;
          const frenzy = this.enraged ? this.def.frenzy : undefined;
          const leap = this.def.leap;
          const thrown = this.def.thrown;
          if (b === 'charger' && this.chargeCd <= 0 && d > 2.5 && d < 8) {
            this.startCharge(sim, p.x, p.z, 0.65);
          } else if (leap && this.leapCd <= 0 && d >= leap.minRange && d <= leap.maxRange) {
            this.startLeap(sim, p.x, p.z);
          } else if (this.spells && this.spells.cd <= 0 && this.spells.cast(sim, this, p)) {
            const [lo, hi] = SPELL_GAP;
            this.spells.cd = (lo + Math.random() * (hi - lo)) * (frenzy ? frenzy.skill : 1) * (this.def.skillCd ?? 1);
          } else if (this.isBoss && this.slamCd <= 0 && d < Math.max(5, this.slamRadius)) {
            this.windKind = 'slam';
            this.windupT = 1.1 * this.skillMult();
            this.slamCd = (frenzy ? 7 * frenzy.skill : this.enraged ? 5 : 7) * (this.def.skillCd ?? 1);
            sim.fx('telegraph', this.x, this.z, this.slamRadius, this.windupT);
          } else if (thrown && this.thrownCd <= 0 && d > thrown.minRange && d <= thrown.range) {
            this.windKind = 'throw';
            this.windupT = 0.8 * this.skillMult();
            this.thrownCd = thrown.cooldown * (this.def.skillCd ?? 1);
            this.warnShot(sim, p, thrown);
          } else if (d <= reach) {
            if (this.atkCd <= 0) {
              this.windKind = 'melee';
              this.windupT = (this.isBoss ? 0.5 : this.def.shot ? 0.5 : 0.35) * this.skillMult();
              this.atkCd = (this.def.attackCooldown / this.zoneSpeed) * (frenzy ? frenzy.skill : this.enraged ? 0.75 : 1);
              if (this.def.shot) this.warnShot(sim, p, this.def.shot);
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

  /** It landed a hit: back to normal speed. */
  resetRamp(): void {
    this.rampT = 0;
    if (this.def.enrageRamp) this.rampWait = RAGE_RAMP_COOLDOWN;
  }

  /** The ramp as it applies to attacks: wind-ups stay readable however fast it runs. */
  private get skillRamp(): number {
    return Math.min(BOSS_RAMP_MAX, this.ramp);
  }

  private get ramping(): boolean {
    return this.isBoss && (!this.def.enrageRamp || this.enraged);
  }

  /** 1 normally; bosses climb 20% per second of not landing a hit, up to 3x. */
  get ramp(): number {
    if (!this.ramping) return 1;
    return this.def.enrageRamp
      ? Math.min(RAGE_RAMP_MAX, 1 + RAGE_RAMP_PER_SEC * this.rampT)
      : Math.min(BOSS_RAMP_MAX, 1 + BOSS_RAMP_PER_SEC * this.rampT);
  }

  /** Wind-ups shrink while a frenzy boss is enraged, and as a boss's ramp climbs. */
  private skillMult(): number {
    return (this.enraged && this.def.frenzy ? this.def.frenzy.skill : 1) / this.skillRamp;
  }

  /** Speed while running at its target (before slows). */
  private chaseSpeed(): number {
    const frenzy = this.enraged ? this.def.frenzy : undefined;
    const rage = frenzy ? frenzy.speed : this.def.enrageRamp ? 1 : 1.3;
    return this.baseSpeed * (this.enraged ? rage : 1) * this.ramp;
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

  /** Mark a spot on the ground, wait, then jump onto it. The mark stays until it lands. */
  startLeap(sim: Sim, tx: number, tz: number): void {
    const leap = this.def.leap!;
    this.leapToX = tx;
    this.leapToZ = tz;
    this.windKind = 'leap';
    this.windupT = leap.windup;
    this.leapCd = leap.cooldown;
    sim.fx('telegraph', tx, tz, leap.radius, leap.windup + LEAP_TIME);
    this.face(tx - this.x, tz - this.z);
  }

  private landLeap(sim: Sim): void {
    const leap = this.def.leap!;
    this.lift = 0;
    this.state = 'chase';
    this.atkCd = 0.8;
    sim.terrain.resolve(this);
    sim.fx('ring', this.x, this.z, leap.radius, '#cfe8f7', 0.35);
    sim.fx('burst', this.x, 0.3, this.z, '#dcecf7', 10, 4);
    sim.sfx('boss_slam', this.x, this.z);
    for (const pl of sim.players) {
      if (pl.alive && Math.hypot(pl.x - this.x, pl.z - this.z) <= leap.radius + pl.radius) {
        sim.hitPlayer(this, pl, leap.mult, { kb: 5, fromX: this.x, fromZ: this.z });
      }
    }
  }

  /** Below half HP with a `vanish` summon: crouch, then jump off the map. */
  jumpOut(sim: Sim): void {
    this.windupT = 0;
    this.jumpOutT = JUMP_OUT_TIME;
    sim.fx('burst', this.x, 0.3, this.z, '#dcecf7', 16, 5);
    sim.shake(0.3, this);
  }

  /** Back from vanishing: falls where it left, slamming the ground on the marked spot. */
  fallBack(sim: Sim, target: Player | null): void {
    this.gone = false;
    this.fallT = FALL_TIME;
    this.lift = JUMP_HEIGHT;
    this.target = target;
    this.aggroT = target ? 12 : 0;
    this.state = target ? 'chase' : 'idle';
    this.rampT = 0;
    this.slamCd = 7 * (this.def.skillCd ?? 1);
    sim.fx('telegraph', this.x, this.z, this.slamRadius, FALL_TIME);
  }

  /** Locks the aim for the coming shot and marks its path on the ground, so it can be stepped out of. */
  private warnShot(sim: Sim, p: Player, shot: ShotDef): void {
    this.shotAngle = Math.atan2(p.z - this.z, p.x - this.x);
    sim.fx('lineTelegraph', this.x, this.z, this.shotAngle, shot.range, shot.radius * 2, this.windupT);
  }

  private fire(sim: Sim, shot: ShotDef): void {
    sim.addEnemyShot(this, {
      x: this.x, z: this.z, angle: this.shotAngle,
      speed: shot.speed, range: shot.range, radius: shot.radius, mult: shot.mult,
      color: shot.color, size: shot.size, art: shot.art,
    });
  }

  private resolveWindup(sim: Sim, d: number): void {
    const p = this.target;
    if (this.windKind === 'throw') {
      this.fire(sim, this.def.thrown!);
    } else if (this.windKind === 'leap') {
      this.state = 'leap';
      this.leapT = LEAP_TIME;
      this.leapFromX = this.x;
      this.leapFromZ = this.z;
    } else if (this.windKind === 'melee' && this.def.shot) {
      this.fire(sim, this.def.shot);
    } else if (this.windKind === 'melee') {
      const ang = Math.atan2(this.faceZ, this.faceX);
      sim.fx('slash', this.x, this.z, ang, Math.PI * 0.6, this.def.attackRange + 0.6, '#ff8a6a');
      if (p?.alive && d <= this.def.attackRange + p.radius + 0.5) sim.hitPlayer(this, p, 1, {});
    } else if (this.windKind === 'slam') {
      const radius = this.slamRadius;
      sim.fx('ring', this.x, this.z, radius, '#ffb070', 0.45);
      sim.fx('burst', this.x, 0.3, this.z, '#c9a27a', 14, 6);
      sim.shake(0.45, this);
      sim.sfx('boss_slam', this.x, this.z);
      for (const pl of sim.players) {
        if (pl.alive && Math.hypot(pl.x - this.x, pl.z - this.z) <= radius + pl.radius) {
          sim.hitPlayer(this, pl, 2, { stun: 0.7, kb: 7, fromX: this.x, fromZ: this.z });
        }
      }
    } else {
      this.state = 'charge';
      this.chargeT = 8 / (this.baseSpeed * 3.6);
      this.chargeHit = false;
    }
  }
}
