import { Unit } from './Unit';
import type { Element } from '../elementTuning';
import type { Sim } from './Sim';
import type { Player } from './Player';
import type { MonsterDef, ShotDef } from '../data/monsters';
import { NO_BOOST, type MonsterBoost, type SpawnArea } from '../data/zones';
import { VolcanoHeartBrain } from './volcanoHeart';
import { SPELL_GAP, WitchSpells } from './bogWitch';
import { CannonCrabBrain } from './cannonCrab';
import { chainStrike, chainWarn, mv, shellCounter, shellOnHit, stealGold, stealTick, type StolenGold } from './beachMoves';
import { chainballOnHit, chainballSpeed, comboCut, kegTick, spreadFire, spreadWarn, type KegRun } from './coveMoves';
import { PeglegCaptainBrain } from './peglegCaptain';
import { curseLand, ghostAct, type GhostMove } from './graveMoves';
import { GhostCaptainBrain } from './ghostCaptain';
import { bubbleStun, bubbleTrapped, seaAct, tentacleTick, type SeaMove } from './maelstromMoves';
import { KrakenBrain } from './kraken';
import { currentBalance, monsterMults, NO_MONSTER_MULT, type MonsterMults } from '../balance';

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
type Windup = 'melee' | 'slam' | 'charge' | 'throw' | 'leap' | 'chain';

export class Monster extends Unit {
  readonly def: MonsterDef;
  readonly area: SpawnArea;
  /** Max HP for one player; bosses get more for each extra player who hits them (see addFighter). */
  private baseHp = 0;
  private hpMult = 1;
  atk = 0;
  defense = 0;
  /** Armor break (Gunslinger's Armor-Piercing Round): defense is lowered by this share until `armorBreakUntil` (sim time). */
  armorBreak = 0;
  armorBreakUntil = 0;
  /** Gunslinger's Deadeye mark: player `markBy` gets +`markCrit` crit chance on this monster until `markUntil` (sim time). */
  markBy = 0;
  markUntil = 0;
  markCrit = 0;
  /** Attack down (shared skill status): the monster's hits deal this share less until `weakUntil` (sim time). */
  weak = 0;
  weakUntil = 0;
  /** Burning / poisoned by a damage-over-time skill until this sim time (for passives that check statuses). */
  dotUntil = 0;
  /** Its element mark (sim/elements.ts): which and until when; when each reaction can happen again; no new mark before `markFreeAt`. */
  elem: Element | null = null;
  elemUntil = 0;
  reactReady = new Map<string, number>();
  markFreeAt = 0;
  /** Client only: the mark as the server last sent it (MonsterSnap.el, 0 = none). */
  elemShown = 0;
  /** Extra effects (sim/extraEffects.ts): when an extra stun from each skill last began, and running extra burns. */
  extraStunAt = new Map<string, number>();
  extraDots = new Map<string, { until: number; mult: number }>();

  /** Its debuffs as the server last sent them (client only, sim/debuffs.ts); the server works them out from the fields above. */
  debuffs = 0;
  /** The skill whose debuff it got last (server: set on the hit; client: as sent), for its magic circle. '' = none. */
  debuffSkill = '';

  /** True while it has any status from a player: stun, slow, armor break, attack down, burning/poison. */
  hasStatus(now: number): boolean {
    return this.stunT > 0 || this.slowT > 0 || now < this.armorBreakUntil || now < this.weakUntil || now < this.dotUntil;
  }
  expReward = 0;
  state: State = 'idle';
  /** Gravity Well: until this sim time the monster is held where the well put it (no walking, chasing or wind-ups). */
  pinnedUntil = 0;
  aggroT = 0;
  /** Boss: who it was on at the last check, and for how long (seconds); a change of target restarts the count. */
  private swTarget: Player | null = null;
  private swT = 0;
  windupT = 0;
  enraged = false;
  deadT = 0;
  /** Called in by a boss: gives no EXP, gold or items, and never respawns. Set with markSummoned. */
  summoned = false;
  /** The admin's multipliers in use for it (×1 for bosses; minions use their kind's), see retune. */
  mult: Readonly<MonsterMults> = NO_MONSTER_MULT;
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
  /** Spawn-spot radius × it was born with (Balance.spawnRadius): it wanders that much wider and its run-home leash grows with it. */
  spread = 1;
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
  /** The Giant Cannon Crab's moves (def.brain). Made on first use, so only the server has them. */
  crab: CannonCrabBrain | null = null;
  /** Takes this share less damage until guardUntil (sim time): hiding in a shell (sim/beachMoves.ts). */
  guard = 0;
  guardUntil = 0;
  /** Hermit crab: seconds left inside its shell, and until it can hide again. */
  hideT = 0;
  shellCd = 0;
  /** Shock eel: until its next chain shock. */
  private chainCd = 2;
  /** Thief gull: the gold it is carrying off. */
  stolen: StolenGold | null = null;
  /** Thief gull: flying off faster than it chases. */
  private fleeFast = false;
  /** The Peg-Leg Captain's moves and his parrot (def.brain). Made on first use, so only the server has them. */
  captain: PeglegCaptainBrain | null = null;
  /** Ship prisoner: has thrown its ball and broken its chain (sim/coveMoves.ts). */
  freed = false;
  /** Cutlass pirate: the cut of its combo coming next (0, 1, 2). */
  private comboStep = 0;
  /** Can't be hit at all: the parrot on its captain's shoulder, a powder-keg prisoner's last run. */
  noHit = false;
  /** A fallen powder-keg prisoner running to blow up (sim/coveMoves.ts): it does nothing else. */
  keg: KegRun | null = null;
  /** The captain's shout: this much faster (0.4 = +40%) for hasteT more seconds. */
  haste = 0;
  hasteT = 0;
  /** Max HP set outright instead of from the def (the parrot's, /admin captain.parrotHp × keys). */
  hpOverride: number | null = null;
  /** The parrot's HP ran out: its captain's brain takes it down for a while instead of it dying. */
  knockedDown = false;
  /** The Ghost Captain's moves (def.brain). Made on first use, so only the server has them. */
  ghostCaptain: GhostCaptainBrain | null = null;
  /** A ghost sailor's or siren's own move (sim/graveMoves.ts). */
  ghost: GhostMove | null = null;
  /** Faded out (a ghost sailor, the Ghost Captain's warp): drawn see-through and can't be hit (noHit too). Sent as `inv`. */
  fade = false;
  /** A shark knight's dive, a ghost pirate king's wave, a tentacle's slam (sim/maelstromMoves.ts). */
  sea: SeaMove | null = null;
  /** The Kraken's moves (def.brain). Made on first use, so only the server has them. */
  kraken: KrakenBrain | null = null;
  /** A tentacle: seconds with nobody in reach (it heals back up after a while, sim/maelstromMoves.ts). */
  idleT = 0;

  /** The zone's monster boost: multiplies HP, attack and defense, and speed (moving and attacking). */
  private readonly zoneSpeed: number;
  /** HP, attack and defense before the admin's multipliers (level, zone boost, keys). */
  private readonly rawHp: number;
  private readonly rawAtk: number;
  private readonly rawDef: number;
  private readonly rawExp: number;
  /** The zone's boost: how much faster skill cooldowns run. */
  readonly skillSpeed: number;
  /** Range at which it attacks whoever comes near: its own, or the zone's when that is larger. */
  private aggroRange = 0;
  private readonly zoneAggro: number;
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
    this.rawHp = def.hp * sc * boost.stats * tough * keys;
    this.rawAtk = def.atk * sc * boost.stats * keys;
    this.rawDef = def.def * sc * boost.stats * tough;
    this.rawExp = def.exp * sc;
    this.zoneSpeed = boost.speed * (def.speedMult ?? 1);
    this.skillSpeed = (boost.skill ?? 1) * (def.speedMult ?? 1);
    this.zoneAggro = boost.aggro ?? 0;
    this.forceAggro = (boost.aggro ?? 0) > 0;
    this.retune();
    this.hp = this.maxHp;
    this.radius = def.radius;
    this.x = x;
    this.z = z;
    this.face(Math.random() - 0.5, Math.random() - 0.5);
  }

  get maxHp(): number { return Math.round(this.baseHp * this.hpMult); }

  /**
   * Takes the admin's monster multipliers in use (src/shared/balance.ts): on spawn, and for every monster
   * already out when they are saved. The share of HP left stays the same.
   */
  retune(): void {
    const m = this.isBoss ? this.bossMults() : monsterMults(this.def);
    const share = this.baseHp > 0 ? this.hp / this.maxHp : 1;
    this.mult = m;
    this.baseHp = this.hpOverride ?? Math.max(1, Math.round(this.rawHp * m.hp));
    this.atk = this.rawAtk * m.atk;
    this.defense = this.rawDef * m.def;
    this.expReward = Math.round(this.rawExp * m.exp);
    // Passive kinds (0) stay passive; the zone's forced aggro is not multiplied.
    this.aggroRange = Math.max(this.def.aggroRange * m.aggro, this.zoneAggro);
    if (this.alive && share > 0) this.hp = Math.max(1, Math.min(this.maxHp, share * this.maxHp));
  }

  /** Bosses are not in the monster multipliers; floor 2's own boss cards scale their HP and ATK (moveTuning.ts). */
  private bossMults(): Readonly<MonsterMults> {
    const card = this.def.brain === 'cannon_crab' ? 'crab' : this.def.brain === 'pegleg_captain' ? 'captain' : this.def.brain === 'ghost_captain' ? 'ghost'
      : this.def.brain === 'kraken' ? 'kraken' : null;
    if (!card) return NO_MONSTER_MULT;
    return { ...NO_MONSTER_MULT, hp: mv(card + '.hpMult'), atk: mv(card + '.atkMult') };
  }

  /** Runs away from its target for `sec` seconds, faster than it chases (a thief gull with gold). */
  fleeFor(sec: number): void {
    this.fleeT = sec;
    this.aggroT = Math.max(this.aggroT, sec);
    this.fleeFast = true;
    this.windupT = 0;
  }

  /** Called in by a boss: no rewards, no respawn. The admin's multipliers for its kind still apply. */
  markSummoned(): void {
    this.summoned = true;
    this.retune();
    this.hp = this.maxHp;
  }

  /** How far it reaches with a melee hit or starts shooting from, multiplier included. */
  private get attackRange(): number { return this.def.attackRange * this.mult.range; }

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
  private get baseSpeed(): number { return this.def.speed * this.zoneSpeed * this.mult.speed * this.coveSpeed; }
  /** The cove's: a ship prisoner on its chain (or free), the captain's shout. */
  private get coveSpeed(): number {
    return (this.def.move === 'chainball' ? chainballSpeed(this) : 1) * (this.hasteT > 0 ? 1 + this.haste : 1);
  }
  get topY(): number { return this.def.height * 0.75; }
  /** Seconds it keeps chasing after the last hit (Balance: ordinary monsters' give-up time; bosses never give up by time). */
  private get aggroTime(): number {
    return this.isBoss ? 12 : currentBalance().mobGiveUpSec || 12;
  }
  /** Ordinary monsters chase until the target dies or leaves / the leash, unless the give-up time is on. */
  private get givesUp(): boolean {
    return this.isBoss || currentBalance().mobGiveUpSec > 0;
  }
  /**
   * Boss only (owner 2026-11-17): after N seconds on one target it picks, at random, another living player in the
   * room who has hurt it. Only when it is free (not in a wind-up, charge, leap or stun); nobody else = keeps the target.
   */
  private switchTarget(dt: number, sim: Sim): void {
    if (this.target !== this.swTarget) {
      this.swTarget = this.target;
      this.swT = 0;
    }
    const every = currentBalance().bossSwitchSec;
    if (!this.isBoss || every <= 0 || !this.target) return;
    this.swT += dt;
    if (this.swT < every || this.state !== 'chase' || this.windupT > 0 || this.stunT > 0) return;
    const others: Player[] = [];
    for (const id of this.damageBy.keys()) {
      const o = sim.players.find((x) => x.id === id);
      if (o && o.alive && o !== this.target) others.push(o);
    }
    if (!others.length) return;
    this.target = others[Math.floor(Math.random() * others.length)];
    this.swTarget = this.target;
    this.swT = 0;
  }

  /** A wave monster (minigame "รอดมอนเป็นระลอก"): always hunts the nearest living player, never walks home, never gives up. */
  hunter = false;

  get isBoss(): boolean { return this.def.behavior === 'boss'; }
  get isHostile(): boolean {
    return this.alive && (this.state === 'chase' || this.state === 'charge' || this.state === 'leap' || this.windupT > 0);
  }
  /** In the air after vanishing or on its way back: can't be hit. */
  get untargetable(): boolean { return this.jumpOutT > 0 || this.fallT > 0 || this.noHit; }
  private get slamRadius(): number { return this.def.slamRadius ?? DEFAULT_SLAM_RADIUS; }

  /**
   * A boss in a boss room whose whole group is down waits where it is with its HP (owner 2026-11-17), so a
   * phoenix-feather revive within the wipe time meets the same fight. Balance switch `bossWipeKeepHp` (off = old behaviour).
   */
  holdsOnWipe(sim: Sim): boolean {
    return this.isBoss && !!sim.zone.roomOf && !sim.cleared && sim.players.length > 0 && sim.players.every((p) => !p.alive) &&
      currentBalance().bossWipeKeepHp;
  }

  /** Walking home (leash or hurt after a fight): with the Balance switch on, hits no longer turn it around (owner 2026-11-17). */
  private get ignoresHits(): boolean {
    return this.state === 'return' && currentBalance().mobReturnIgnoreHits;
  }

  onHit(sim: Sim, attacker: Player): void {
    // A tentacle being hit (from out of its reach too: a gunslinger, a mage) is in a fight: it doesn't heal (sim/maelstromMoves.ts).
    this.idleT = 0;
    // Still takes the damage (and heals on the way); only the aggro / pack wake-up is skipped.
    if (this.ignoresHits) return;
    this.aggroT = this.aggroTime;
    if (!this.target?.alive) this.target = attacker;
    if (this.state !== 'charge' && this.state !== 'leap') this.state = 'chase';
    if (this.def.behavior === 'skittish' && Math.random() < 0.4) this.fleeT = 1.2;
    if (this.def.move === 'shell') shellOnHit(sim, this);
    if (this.def.move === 'chainball') chainballOnHit(sim, this, attacker);
    if (this.def.pack) {
      for (const m of sim.monsters) {
        if (m !== this && m.alive && !m.ignoresHits && (m.def.packId ?? m.def.id) === (this.def.packId ?? this.def.id) && Math.hypot(m.x - this.x, m.z - this.z) < 9) {
          m.aggroT = m.aggroTime;
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
    this.swT = 0;
    this.aggroT = this.aggroTime;
    if (this.state !== 'charge' && this.state !== 'leap') this.state = 'chase';
  }

  calm(): void {
    this.aggroT = 0;
    this.windupT = 0;
    this.target = null;
    this.lift = 0;
    if (this.state !== 'return') this.state = 'idle';
  }

  /**
   * Its target is gone (stepped into the safe area, left the map or channel, respawned in town): ordinary monsters
   * drop it at once and walk home, healing on the way, instead of standing where they are (owner 2026-11-20).
   * Bosses, and the Balance switch off, keep the old `calm()`.
   */
  dropTarget(): void {
    if (this.hunter) { this.target = null; this.state = 'idle'; return; }
    if (this.isBoss || !currentBalance().mobDropOnSafe) {
      this.calm();
      return;
    }
    const inAir = this.state === 'leap';
    this.aggroT = 0;
    this.windupT = 0;
    this.target = null;
    if (!inAir) {
      this.lift = 0;
      this.state = 'return';
    }
  }

  /** Nearest living player, for monsters that attack on sight (players in the safe area are not prey while the Balance switch is on). */
  private nearestPlayer(sim: Sim): { p: Player; d: number } | null {
    let best: { p: Player; d: number } | null = null;
    const skipSafe = !this.isBoss && currentBalance().mobDropOnSafe;
    for (const p of sim.players) {
      if (!p.alive || (skipSafe && sim.inSafe(p))) continue;
      const d = Math.hypot(p.x - this.x, p.z - this.z);
      if (!best || d < best.d) best = { p, d };
    }
    return best;
  }

  update(dt: number, sim: Sim): void {
    const winding = this.windupT > 0;
    this.step(dt, sim);
    // A wind-up began: browsers with an attack animation for this monster play it, its strike landing as the wind-up
    // ends (`duration` = the wind-up's seconds; SpriteActor.play). Owner 2026-11-17, papercraft monsters.
    if (!winding && this.windupT > 0 && this.alive) sim.anim(this.id, 'attack', { duration: this.windupT });
  }

  private step(dt: number, sim: Sim): void {
    if (!this.alive) {
      this.deadT += dt;
      this.moving = false;
      return;
    }
    this.moving = false;
    // A powder-keg prisoner's last run, and the captain's parrot (his brain moves it): nothing else (sim/coveMoves.ts, peglegCaptain.ts).
    if (this.keg) {
      this.tickStatus(dt, sim.terrain);
      kegTick(dt, sim, this);
      return;
    }
    if (this.def.move === 'parrot') return;
    // Never moves (the kraken and its tentacles round a whirlpool): no knockback, no chase, no walking home.
    if (this.def.anchored) {
      this.kbx = this.kbz = 0;
      this.tickStatus(dt, sim.terrain);
      if (this.def.brain === 'kraken') {
        this.kraken ??= new KrakenBrain();
        this.kraken.update(dt, sim, this);
      } else if (this.def.move === 'tentacle') tentacleTick(dt, sim, this);
      return;
    }
    if (this.hasteT > 0) this.hasteT -= dt;
    if (this.def.pattern) {
      this.brain ??= new VolcanoHeartBrain();
      this.face(1, 1);
      this.brain.update(dt, sim, this);
      return;
    }
    if (this.def.spells) {
      this.spells ??= new WitchSpells();
      // Out of the fight: her pools and curses go and the next fight starts fresh.
      if (!this.holdsOnWipe(sim) && (this.state === 'return' || (this.state === 'idle' && !this.target))) this.spells.reset(sim);
      // Before any early return below, so a stunned witch's pools still hurt and curses still land.
      this.spells.update(sim, this);
    }
    if (this.def.brain === 'cannon_crab') {
      this.crab ??= new CannonCrabBrain();
      if (!this.holdsOnWipe(sim) && (this.state === 'return' || (this.state === 'idle' && !this.target))) this.crab.reset(sim);
      // Before any early return below, so its cannonballs still land while it is stunned.
      this.crab.tick(sim, this);
    }
    if (this.def.brain === 'pegleg_captain') {
      this.captain ??= new PeglegCaptainBrain();
      if (!this.holdsOnWipe(sim) && (this.state === 'return' || (this.state === 'idle' && !this.target))) this.captain.reset(sim, this);
      // Before any early return below, so the gunboats' shells still land and the parrot still flies while he is stunned.
      this.captain.tick(dt, sim, this);
    }
    if (this.def.brain === 'ghost_captain') {
      this.ghostCaptain ??= new GhostCaptainBrain();
      if (!this.holdsOnWipe(sim) && (this.state === 'return' || (this.state === 'idle' && !this.target))) this.ghostCaptain.reset(sim, this);
      // Before any early return below, so his fog still lifts and a warp still ends while he is stunned.
      this.ghostCaptain.tick(dt, sim, this);
    }
    if (this.def.move === 'steal') stealTick(sim, this);
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
        if (this.def.fx?.jump) sim.fx('effect', this.def.fx.jump, this.x, this.z, 0, this.radius * 2.2);
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
    this.shellCd -= skillTick;
    this.chainCd -= skillTick;
    this.aggroT -= dt;
    this.fleeT -= dt;

    // Lose a dead target; aggressive monsters pick up whoever walks into range.
    if (this.target && !this.target.alive) {
      this.target = null;
      if (!this.isBoss && currentBalance().mobDropOnSafe && this.state === 'chase') {
        this.aggroT = 0;
        this.state = 'return';
      }
    }
    if (this.holdsOnWipe(sim)) {
      // Whole boss-room group down: stand still, keep HP / enrage / damage shares, drop any wind-up (owner 2026-11-17).
      this.windupT = 0;
      this.aggroT = 0;
      this.target = null;
      this.state = 'idle';
      this.wandering = false;
      return;
    }
    this.switchTarget(dt, sim);
    if (this.hunter) {
      // Wave monsters: the nearest living player, always (owner 2026-11-21: they wandered instead of chasing).
      const n = this.nearestPlayer(sim);
      this.target = n ? n.p : null;
      this.aggroT = Math.max(this.aggroT, 4);
      if (this.state === 'return') this.state = 'idle';
    }
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

    if (this.stunT > 0 || sim.time < this.pinnedUntil) {
      this.windupT = 0;
      if (this.state === 'charge') this.state = 'chase';
      return;
    }
    // A hermit crab in its shell stays put, then strikes back as it comes out (sim/beachMoves.ts).
    if (this.hideT > 0) {
      this.hideT -= dt;
      this.windupT = 0;
      if (this.hideT <= 0) shellCounter(sim, this);
      return;
    }
    // The Giant Cannon Crab's own moves (sim/cannonCrab.ts); when it does none this tick it chases and hits as usual.
    if (this.crab && this.state !== 'return' && this.crab.act(dt, sim, this)) return;
    // The Peg-Leg Captain's own moves (sim/peglegCaptain.ts).
    if (this.captain && this.state !== 'return' && this.captain.act(dt, sim, this)) return;
    // The Ghost Captain's (sim/ghostCaptain.ts), and a ghost sailor's fade or a siren's song (sim/graveMoves.ts).
    if (this.ghostCaptain && this.state !== 'return' && this.ghostCaptain.act(dt, sim, this)) return;
    if ((this.def.move === 'phase' || this.def.move === 'song') && ghostAct(dt, sim, this)) return;
    // A shark knight's dive, a ghost pirate king's wave (sim/maelstromMoves.ts).
    if ((this.def.move === 'dive' || this.def.move === 'wave') && seaAct(dt, sim, this)) return;

    if (this.windupT > 0) {
      this.windupT -= dt;
      if (this.windKind !== 'charge' && p) this.face(dx, dz);
      // Bosses keep walking in while winding up a normal hit, so stepping back no longer dodges it.
      // The slam stays put: its warning circle is drawn where the boss stands.
      let dNow = d;
      if (this.isBoss && this.windKind === 'melee' && p && d > this.attackRange * 0.6) {
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
      if (!this.hunter && this.state !== 'return' && leash > (this.isBoss ? 18 : 22 + 2 * this.area.radius * (this.spread - 1))) {
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
        const hostile = !!p && (this.aggroT > 0 || !this.givesUp);

        if (hostile && this.fleeT > 0) {
          mx = -dx / d;
          mz = -dz / d;
          spd *= this.fleeFast ? mv('steal.fleeSpeed') : 1.1;
          this.state = 'chase';
        } else if (hostile) {
          this.fleeFast = false;
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
          const reach = this.attackRange + p.radius;
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
          } else if (this.def.move === 'chain' && this.chainCd <= 0 && d <= mv('chain.range')) {
            this.windKind = 'chain';
            this.windupT = mv('chain.warn');
            this.chainCd = mv('chain.cd');
            chainWarn(sim, this, p, this.windupT);
          } else if (this.isBoss && !this.def.brain && this.slamCd <= 0 && d < Math.max(5, this.slamRadius)) {
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
              this.atkCd = (this.def.attackCooldown / (this.zoneSpeed * this.mult.atkSpeed)) * (frenzy ? frenzy.skill : this.enraged ? 0.75 : 1);
              if (this.def.shot) this.warnShot(sim, p, this.def.shot);
              this.comboStep = 0;
            }
          } else {
            mx = dx / d;
            mz = dz / d;
            spd = this.chaseSpeed();
          }
        } else if (!this.hunter && (this.hp < this.maxHp || this.enraged)) {
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
            const rr = Math.sqrt(Math.random()) * this.area.radius * this.spread;
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
      // A ghost sailor walks through the props (still not off the map).
      sim.terrain.resolve(this, this.def.move === 'phase');
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
  /** Its next normal hit no sooner than `sec` from now (after a move of its own). */
  resetAttack(sec: number): void {
    this.atkCd = Math.max(this.atkCd, sec);
  }

  skillMult(): number {
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
    if (this.def.fx?.jump) sim.fx('effect', this.def.fx.jump, this.x, this.z, 0, this.radius * 2.2);
    sim.shake(0.3, this);
  }

  /** Back from vanishing: falls where it left, slamming the ground on the marked spot. */
  fallBack(sim: Sim, target: Player | null): void {
    this.gone = false;
    this.fallT = FALL_TIME;
    this.lift = JUMP_HEIGHT;
    this.target = target;
    this.aggroT = target ? this.aggroTime : 0;
    this.state = target ? 'chase' : 'idle';
    this.rampT = 0;
    this.slamCd = 7 * (this.def.skillCd ?? 1);
    sim.fx('telegraph', this.x, this.z, this.slamRadius, FALL_TIME);
  }

  /** Locks the aim for the coming shot and marks its path on the ground, so it can be stepped out of. */
  private warnShot(sim: Sim, p: Player, shot: ShotDef): void {
    this.shotAngle = Math.atan2(p.z - this.z, p.x - this.x);
    if (this.def.move === 'spread') {
      spreadWarn(sim, this, this.shotAngle, this.windupT);
      return;
    }
    sim.fx('lineTelegraph', this.x, this.z, this.shotAngle, shot.range * this.mult.range, shot.radius * 2, this.windupT);
  }

  private fire(sim: Sim, shot: ShotDef): void {
    sim.addEnemyShot(this, {
      x: this.x, z: this.z, angle: this.shotAngle,
      speed: shot.speed, range: shot.range * this.mult.range, radius: shot.radius, mult: shot.mult,
      color: shot.color, size: shot.size, art: shot.art,
      // A ghost monkey's skull leaves a curse ring where it lands (sim/graveMoves.ts).
      ...(this.def.move === 'curse' ? { onEnd: (x: number, z: number) => curseLand(sim, x, z) } : {}),
      // A seahorse soldier's bubble holds whoever it hits (sim/maelstromMoves.ts).
      ...(this.def.move === 'bubble' ? { kb: 0, stun: bubbleStun(), onHitPlayer: (p: Player) => bubbleTrapped(sim, p) } : {}),
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
    } else if (this.windKind === 'chain') {
      chainStrike(sim, this, p);
      this.atkCd = Math.max(this.atkCd, 0.8);
    } else if (this.windKind === 'melee' && this.def.move === 'spread') {
      spreadFire(sim, this, this.shotAngle);
    } else if (this.windKind === 'melee' && this.def.shot) {
      this.fire(sim, this.def.shot);
    } else if (this.windKind === 'melee' && this.def.move === 'combo') {
      // Three cuts in a row, the third a lunge (sim/coveMoves.ts); each next one winds up quickly.
      if (comboCut(sim, this, p, this.comboStep, this.attackRange) && p?.alive) {
        this.comboStep++;
        this.windKind = 'melee';
        this.windupT = mv('combo.gap') * this.skillMult();
        sim.anim(this.id, 'attack', { duration: this.windupT });
      } else this.comboStep = 0;
    } else if (this.windKind === 'melee') {
      const ang = Math.atan2(this.faceZ, this.faceX);
      // A boss's own claw / lantern / ice hit (bossFx.ts), sent from where it stands; others the plain slash.
      if (this.def.fx?.melee) sim.fx('effect', this.def.fx.melee, this.x, this.z, ang, this.attackRange);
      else sim.fx('slash', this.x, this.z, ang, Math.PI * 0.6, this.attackRange + 0.6, '#ff8a6a');
      if (p?.alive && d <= this.attackRange + p.radius + 0.5) {
        sim.hitPlayer(this, p, 1, {});
        if (this.def.move === 'steal' && p.alive) stealGold(sim, this, p);
      }
    } else if (this.windKind === 'slam') {
      const radius = this.slamRadius;
      sim.fx('ring', this.x, this.z, radius, '#ffb070', 0.45);
      sim.fx('burst', this.x, 0.3, this.z, '#c9a27a', 14, 6);
      if (this.def.fx?.slam) sim.fx('effect', this.def.fx.slam, this.x, this.z, 0, radius);
      sim.shake(0.45, this);
      // A boss with its own slam picture has its own slam sound (client bossSounds.ts).
      if (!this.def.fx?.slam) sim.sfx('boss_slam', this.x, this.z);
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
