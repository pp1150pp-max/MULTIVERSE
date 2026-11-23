// The game rules, with no rendering. The game server runs one of these per zone. Whoever drives it calls step() every frame and reads drainEvents()
// to show effects, damage numbers and messages.
import { HUB_ID, NO_BOOST, ZONES, inSafeArea, type MonsterBoost, type SafeArea, type ZoneDef, type SpawnArea } from '../data/zones';
import { DROP_GOLD_MULT, MONSTERS } from '../data/monsters';
import { AUTO_EXP_MULT, expGapMult, expToNext, mitigate, MAX_LEVEL, MISS_GAP, outLevelled } from '../formulas';
import { blockingGate, BOSS_GATE_IDS } from '../data/bossGates';
import { lineRanges, rerollStat, rerollValues, rollItem } from '../data/items';
import { REROLL_NAME, rerollCost, type RerollKind } from '../data/reroll';
import { inBossArena, lairExitSpot, LAVA_BURN, LAVA_TICK } from '../data/zones';
import type { Hazard } from './volcanoHeart';
import {
  announceFrom, bannerFrom, dropsOnFail, forgeCd, enhanceCost, itemName, maxPlus, plusOf, rollEnhance, stonesNeeded, type EnhanceResult,
} from '../data/enhance';
import { dropPotionSize, entryName, potionName, POTION_STACK, potionPrice, stackLimit } from '../data/potions';
import { BOX_OPEN_COOLDOWN, BOSS_KEY, BOSS_QUEST_KEY, BOSS_STONE_CHANCE, BOUND_MSG, BUFF_LABEL, BUFF_MAX, BUFF_MULT, BUFF_TIME, fmtBuff, PHOENIX_PRICE, QUEST_KILLS, REVIVES_PER_KEY, STONE_STACK, KEY_DROP_CHANCE, MONSTER_STONE_CHANCE, MONSTER_STONES, REROLL_STONE, RETURN_CAST, RETURN_SCROLL_PRICE, STONE_COLOR, STONE_NAME } from '../data/stones';
import { NPC_INFO, NPC_USE_RANGE, type NpcId } from '../data/npcs';
import { pick, rand, randInt, type Rng } from '../rng';
import { splitExp } from '../party';
import { CLASS_IDS, SLOT_KIND, WEAR_SLOTS, type WearSlot } from '../data/classes';
import { emptySkillBook, learnable, learnBlock, pointsSpent, rankOf, refundPrice, unlearnOne, wear, wearBlock } from '../skillBook';
import { classBalance, currentBalance, packCount } from '../balance';
import { vipDropMult, vipExp } from '../vip';
import { COS_SLOT_NAME, cosById, MOUNT_CALM } from '../data/cosmetics';
import {
  isBound, isBuffScroll, isOrbStone, type OrbStoneKind, isItem, isPotion, isStack, isStone, RARITY_LABEL, sameStack, SLOT_LABEL, BLACKSMITH_STONES, BUFF_SCROLLS, type BagEntry, type BuffScroll, type Item, type StoneKind, type PotionKind, type PotionSize, type Rarity } from '../types';
import { PORTAL_RANGE, REST_CD, restSpotNear, Terrain, type RestSpot } from './terrain';
import {
  BUYBACK_RESET, buybackPrice, cleanAutoSettings, lootPots, Player, sortEntries,
  type AutoSettings, type CharacterData, type LootFilter, type SortKey,
} from './Player';
import { Monster } from './Monster';
import { withExtras } from './extraEffects';
import { dropHexSeeds, noteHexHit, tickHexSeeds, type HexSeed } from './hexSeed';
import { EnemyShot, Projectile, type ProjOpts } from './Projectile';
import { Loot, LOOT_PRIORITY_TIME, type LootKind } from './Loot';
import { nextRowPrice, STASH_GOLD_MAX, STASH_ROW } from './stash';
import { splitInto } from './split';
import { questRows } from '../quests';
import { GEAR_KILLS, GEAR_PART_NAME, gearReward, gearRow } from '../gearQuests';
import { TUT_ACCEPT_GOLD, TUT_ACCEPT_STONES, TUT_NPC, TUT_STEPS, TUT_STEP_NAME, TUT_TASKS, TUT_TASK_NAME, tutRows, tutTurnInReward, type TutStep, type TutTask } from '../tutorial';
import { putAll, type MailAttach } from '../mail';
import { freeSlot, nextExpand, TAB_FULL, TAB_NAME, tabOf, type BagSlots, type BagTab } from '../bagTabs';
import { RARITY_COLOR } from '../types';
import { passiveOnCrit, passiveDealMult, passiveTakenMult } from '../passives';
import type { MapData } from '../mapSchema';
import { waveCount, waveStats, type WaveConfig } from '../waveGame';
import { IDLE_INTENT, type FxApi, type FxName, type HitOpts, type Intent, type SfxName, type SimEvent } from './types';
import { boxNow, boxOdds, boxOrbs, rollBoxRow, type BoxRow } from '../mysteryBox';

/** Gear of this rarity that "sell all" may take: never potions or enhanced items. */
/** Seconds of warning before a freshly summoned minion pounces. */
const MINION_POUNCE_WINDUP = 0.35;
/** Hub spawn: random distance from the fountain centre, between these (fountain blocks ~1.7, rest range 4.5). */
// Outside the fountain and its benches (HUB_FOUNTAIN_RADIUS), within its rest range (REST_RANGE.fountain).
const HUB_SPAWN_RING: [number, number] = [4.4, 6.1];
/** Drops land where a player of this radius could stand (Player.radius), so they can always be picked up. */
const LOOT_STAND_R = 0.4;
/** A vanished boss gives up on its fight when no living player has been this close for VANISH_GIVE_UP seconds. */
const VANISH_LEASH = 30;
const VANISH_GIVE_UP = 20;
/** Players more than BOSS_LEVEL_GAP levels below a boss deal only this share of their damage to it, without telling them (owner). */
const BOSS_LEVEL_GAP = 5;
const BOSS_UNDERLEVEL_MULT = 0.1;

export function isBulkSellable(e: BagEntry | null, rarity: Rarity): e is Item {
  return isItem(e) && e.rarity === rarity && !plusOf(e);
}

function validSlot(i: number, len: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < len;
}

/**
 * Moves src[i] onto dst[j] (src and dst may be the same list): empty → moves, the same potion/stone → merges
 * up to a full stack (the rest stays behind), anything else → the two swap places.
 */
function dropOnto(src: (BagEntry | null)[], i: number, dst: (BagEntry | null)[], j: number): boolean {
  if (src === dst && i === j) return false;
  const a = src[i];
  const b = dst[j];
  if (!a) return false;
  if (isStack(a) && isStack(b) && sameStack(a, b)) {
    const n = Math.min(a.count, stackLimit(b) - b.count);
    if (n <= 0) return false;
    b.count += n;
    a.count -= n;
    if (a.count <= 0) src[i] = null;
    return true;
  }
  src[i] = b ?? null;
  dst[j] = a;
  return true;
}

/**
 * Moves src[i] into dst wherever it fits. Potions and stones top up matching stacks first, then fill an empty slot;
 * if only part fits, that part moves. Returns false when nothing moved.
 */
function fillInto(src: (BagEntry | null)[], i: number, dst: (BagEntry | null)[], dstTabs?: BagSlots): boolean {
  const a = src[i];
  if (!a) return false;
  // Into the bag: only empty slots of the tab it belongs in (the stash has no tabs).
  const empty = (): number => (dstTabs ? freeSlot(dst, dstTabs, tabOf(a)) : dst.indexOf(null));
  if (isStack(a)) {
    const before = a.count;
    for (const e of dst) {
      if (a.count <= 0) break;
      if (e !== a && isStack(e) && sameStack(a, e) && e.count < stackLimit(e)) {
        const n = Math.min(a.count, stackLimit(e) - e.count);
        e.count += n;
        a.count -= n;
      }
    }
    if (a.count > 0) {
      const k = empty();
      if (k >= 0) {
        dst[k] = { ...a };
        a.count = 0;
      }
    }
    if (a.count <= 0) src[i] = null;
    return a.count < before;
  }
  const k = empty();
  if (k < 0) return false;
  dst[k] = a;
  src[i] = null;
  return true;
}

/** `index`: the spot's place in the zone's spawn list (spreads the pack multiplier's fraction, see packCount). */
interface Spawner { area: SpawnArea; alive: number; queue: number[]; boss: boolean; index: number }

/** How close a player must be to a drop they clicked to pick it up (walking over others takes them at 0.8). */
export const LOOT_CLICK_RANGE = 1.5;

/** Owner's balance (2026-11-09): gold drops x2, potion drop chance x2, boss potions x2. */
const DROP_POTION_MULT = 2;

export class Sim {
  readonly terrain: Terrain;
  players: Player[] = [];
  monsters: Monster[] = [];
  /** Mage Hex Seeds in this world's monsters (sim/hexSeed.ts). */
  hexSeeds: HexSeed[] = [];
  projectiles: (Projectile | EnemyShot)[] = [];
  loots: Loot[] = [];
  time = 0;
  /** Boss ground attacks going on right now. Sent as they are in snapshots. */
  hazards: Hazard[] = [];
  private events: SimEvent[] = [];
  private nextId = 1;
  private readonly spawners: Spawner[] = [];
  private timers: { at: number; fn: () => void }[] = [];
  /** A boss that jumped off the map, waiting for its minions to die. */
  private vanished: { boss: Monster; minions: Monster[]; awayT: number } | null = null;

  /** Keys put into this boss room (1 elsewhere): the boss's HP, attack and rewards are multiplied by it. */
  readonly keys: number;
  /** What this zone's monsters (and their summons) are boosted by, keys included. */
  private readonly boost: MonsterBoost | undefined;
  /** A boss room whose boss is dead: its portal back to town opens and nothing comes back. */
  cleared = false;
  /** A boss room with a countdown: sim time its boss appears (null once it has, or with no countdown). */
  bossAt: number | null = null;
  /**
   * Minigame "รอดมอนเป็นระลอก" (opts.waves, src/shared/waveGame.ts): the run's numbers (fixed when it opened), the wave on now
   * (0 = counting down), when the next one comes (sim time, null while one is being fought), the ids of its monsters still
   * counted, and whether the last wave fell. Null on every other Sim.
   */
  readonly waveRun: { cfg: WaveConfig; wave: number; nextAt: number | null; ids: Set<number>; won: boolean } | null = null;
  /** Where getting up / leaving takes a player from this Sim (a wave run: back out by the door they came through). */
  private readonly exitTo: { field: string; x: number; z: number } | undefined;

  /** `bossDelay`: seconds before the boss appears (a boss room's countdown, owner 2026-11-12). */
  constructor(readonly zone: ZoneDef, opts: { keys?: number; bossDelay?: number; map?: MapData; waves?: WaveConfig; exit?: { field: string; x: number; z: number } } = {}) {
    this.keys = Math.max(1, Math.floor(opts.keys ?? 1));
    this.boost = this.keys > 1 ? { ...(zone.monsterBoost ?? NO_BOOST), keys: this.keys } : zone.monsterBoost;
    this.terrain = opts.map ? new Terrain(zone, opts.map) : new Terrain(zone);
    this.exitTo = opts.exit;
    // A wave run brings its own monsters, in waves: the map's ordinary spawn rings stay empty.
    if (opts.waves && zone.waves) this.waveRun = { cfg: { ...opts.waves }, wave: 0, nextAt: opts.waves.countdown, ids: new Set(), won: false };
    else zone.spawns.forEach((area, index) => this.spawners.push({ area, alive: 0, queue: [], boss: false, index }));
    if (zone.boss) this.spawners.push({ area: zone.boss, alive: 0, queue: [], boss: true, index: -1 });
    const delay = zone.boss ? opts.bossDelay ?? 0 : 0;
    if (delay > 0) this.bossAt = delay;
    for (const sp of this.spawners) {
      if (sp.boss && delay > 0) sp.queue.push(delay);
      else for (let i = 0, n = this.wanted(sp); i < n; i++) this.spawnMonster(sp);
    }
  }

  /** How many monsters this spawner keeps: the code's count, ×the map's pack multiplier (/admin) unless it is a boss. */
  private wanted(sp: Spawner): number {
    return sp.boss || this.zone.roomOf ? sp.area.count : packCount(this.zone.id, sp.area.count, sp.index);
  }

  private newId(): number {
    return this.nextId++;
  }

  nextHazardId(): number {
    return this.newId();
  }

  // ------------------------------------------------------------ players

  /**
   * Puts a character into the world: at the camp, or next to the portal back to `fromZone` when
   * they arrive through one.
   */
  addPlayer(data: CharacterData, fromZone?: string): Player {
    const p = new Player(this.newId(), this, data);
    p.zone = this.zone.id;
    const back = fromZone ? this.zone.portals.find((pt) => pt.to === fromZone) : undefined;
    if (back) {
      // A few steps from the portal toward the middle of the map.
      const d = Math.hypot(back.x, back.z) || 1;
      p.x = back.x - (back.x / d) * 3.5;
      p.z = back.z - (back.z / d) * 3.5;
      p.face(-back.x, -back.z);
      p.portalReady = false;
    } else {
      ({ x: p.x, z: p.z } = this.spawnPoint());
    }
    this.players.push(p);
    return p;
  }

  removePlayer(p: Player): void {
    this.players = this.players.filter((x) => x !== p);
    for (const m of this.monsters) if (m.target === p) m.dropTarget();
    dropHexSeeds(this, p);
  }

  // ------------------------------------------------------------ events

  /** Hands the queued events to the caller and clears the queue. */
  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  fx<K extends FxName>(name: K, ...args: Parameters<FxApi[K]>): void {
    this.events.push({ t: 'fx', name, args } as SimEvent);
  }

  text(x: number, y: number, z: number, text: string, cls: string, life?: number, to?: number): void {
    this.events.push({ t: 'text', x, y, z, text, cls, life, to });
  }

  /** A damage number over `on`, belonging to player `by` (who dealt it, or who took it). */
  private dmgText(u: { id: number; x: number; z: number; topY: number }, text: string, cls: string, by: number): void {
    this.events.push({ t: 'text', x: u.x, y: u.topY, z: u.z, text, cls, by, on: u.id });
  }

  /** Shakes the screen of one player (a skill's caster) or of the players near a spot (a boss). */
  shake(amount: number, who: { to: number } | { x: number; z: number }): void {
    this.events.push('to' in who ? { t: 'shake', amount, to: who.to } : { t: 'shake', amount, x: who.x, z: who.z });
  }

  sfx(name: SfxName, x: number, z: number, to?: number): void {
    this.events.push({ t: 'sfx', name, x, z, to });
  }

  log(msg: string, color?: string, to?: number): void {
    this.events.push({ t: 'log', msg, color, to });
  }

  anim(id: number, name: string, opts: { duration?: number; fallback?: 'attack'; skill?: string } = {}): void {
    this.events.push({ t: 'anim', id, name, ...opts });
  }

  schedule(delay: number, fn: () => void): void {
    // Timers set while a player's skill runs stay that player's doing (their effects feel the hit on their screen).
    const by = this.caster;
    const skill = this.casterSkill;
    this.timers.push({ at: this.time + delay, fn: by ? () => this.asCaster(by, fn, skill ?? undefined) : fn });
  }

  /** Monsters hit so far (hitMonster that got past the arena and level checks); asCaster compares it. */
  private hitCount = 0;
  /** The player whose skill is running now (asCaster), or null. */
  private caster: Player | null = null;
  /** The skill it is (for the client's standing layer of area skills, src/client/zoneProps.ts), or null. */
  private casterSkill: string | null = null;
  /** The skill running now (a cast, its timers and shots), or null: what a debuff or buff it gives came from. */
  get castingSkill(): string | null {
    return this.casterSkill;
  }

  /**
   * Runs `fn` as player `p`'s doing (a cast, a timer it set, its shot flying): the skill effects it plays carry `p`'s
   * id and whether it hit any monster, so the caster's own screen can feel the hit (src/client/fxLayer.ts).
   */
  asCaster<T>(p: Player, fn: () => T, skill?: string): T {
    const from = this.events.length;
    const hits = this.hitCount;
    const was = this.caster;
    const wasSkill = this.casterSkill;
    this.caster = p;
    this.casterSkill = skill ?? wasSkill;
    try {
      return fn();
    } finally {
      const sk = this.casterSkill;
      this.caster = was;
      this.casterSkill = wasSkill;
      const hit = this.hitCount > hits;
      for (let i = from; i < this.events.length; i++) {
        const e = this.events[i];
        if (e.t !== 'fx') continue;
        const a = e.args as unknown[];
        // Only what isn't tagged yet (an inner asCaster, or a skill that tags its own, came first).
        if (e.name === 'effect') {
          if (a.length === 5) a.push(p.id, hit);
          // effect(name, x, z, angle, size, by, hit, skill)
          if (a.length === 7 && sk) a.push(sk);
        } else if (e.name === 'telegraph' && a.length === 5 && sk) {
          // telegraph(x, z, radius, duration, color, by, skill): Starfall's star falls during its warning (quarksFx.ts)
          a.push(p.id, sk);
        } else if (e.name === 'burst' && a.length === 6 && sk) {
          // burst(x, y, z, color, n, speed, by, skill): Fire Rain's falling fire in three.quarks (src/client/quarksFx.ts)
          a.push(p.id, sk);
        } else if (e.name === 'meteor' && a.length === 3) {
          // meteor(x, z, duration, by): the client draws others' falling meteor lighter (src/client/quarksFx.ts)
          a.push(p.id);
        } else if (e.name === 'zone' && sk) {
          // zone(name, x, z, size, duration, follow, skill, by)
          while (a.length < 6) a.push(null);
          if (a.length === 6) a.push(sk);
          if (a.length === 7) a.push(p.id);
        }
      }
    }
  }

  addProjectile(owner: Player, o: ProjOpts): void {
    // A shot made by a skill (its cast, a timer, its turret or drone) keeps that skill for its extra effects when it
    // lands later in the plain update loop (own copy of `hit`: one object may be shared by several shots).
    const src = o.hit?.src ?? this.casterSkill;
    if (src && !o.hit?.src) o = { ...o, hit: { ...o.hit, src } };
    this.projectiles.push(new Projectile(this.newId(), this, owner, o));
  }

  addEnemyShot(owner: Monster, o: ProjOpts): void {
    this.projectiles.push(new EnemyShot(this.newId(), this, owner, o));
  }

  // ------------------------------------------------------------ spawning

  private spawnMonster(sp: Spawner): void {
    const def = MONSTERS[sp.area.monster];
    const r = Math.random;
    let x = sp.area.x;
    let z = sp.area.z;
    for (let tries = 0; tries < 12; tries++) {
      const a = r() * Math.PI * 2;
      // A bigger pack spreads a little wider (up to twice the spot's radius).
      const n = sp.boss ? 1 : this.wanted(sp) / Math.max(1, sp.area.count);
      const d = Math.sqrt(r()) * sp.area.radius * Math.min(2, Math.sqrt(Math.max(1, n)));
      x = sp.area.x + Math.cos(a) * d;
      z = sp.area.z + Math.sin(a) * d;
      if (!this.terrain.isBlocked(x, z, def.radius)) break;
    }
    this.monsters.push(new Monster(this.newId(), def, randInt(r, def.levels[0], def.levels[1]), sp.area, x, z, sp.area.boost ?? this.boost));
    sp.alive++;
  }

  // ------------------------------------------------------------ combat

  /**
   * Where players appear and wake up: by the campfire, or in the hub at a random spot on a ring around
   * the fountain (owner: after a restart everyone landed on one point), within its rest range.
   */
  spawnPoint(): { x: number; z: number } {
    const s = this.zone.start;
    if (!this.zone.npcs) return { x: s.x - 2, z: s.z - 2 };
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = HUB_SPAWN_RING[0] + Math.random() * (HUB_SPAWN_RING[1] - HUB_SPAWN_RING[0]);
      const x = s.x + Math.cos(a) * d;
      const z = s.z + Math.sin(a) * d;
      if (!this.terrain.isBlocked(x, z, 0.5)) return { x, z };
    }
    return { x: s.x + 3, z: s.z + 3 };
  }

  /** Inside the zone's safe area (the hub's town): nobody fights there. */
  inSafe(u: { x: number; z: number }): boolean {
    return inSafeArea(this.zone, u.x, u.z);
  }

  hitMonster(p: Player, m: Monster, mult: number, opts: HitOpts = {}): void {
    if (!m.alive || m.untargetable || this.inSafe(p)) return;
    if (m.def.pattern && !inBossArena(this.zone, p.x, p.z)) {
      this.text(m.x, m.topY, m.z, 'ต้องเข้าลาน', 'info', 0.5, p.id);
      return;
    }
    if (outLevelled(p.level, m.level)) {
      this.text(m.x, m.topY, m.z, 'MISS', 'info', 0.6, p.id);
      if (!p.missHinted) {
        p.missHinted = true;
        this.log(`${m.def.nameTh} เลเวลสูงกว่าคุณ ${MISS_GAP} เลเวลขึ้นไป — ตีไม่เข้า`, '#ff8a6a', p.id);
      }
      return;
    }
    this.hitCount++;
    let raw = p.stats.atk * mult * (0.9 + Math.random() * 0.2) * passiveDealMult(p, m, opts.skill);
    if (this.time < p.dmgUntil) raw *= p.dmgMult;
    const marked = m.markBy === p.id && this.time < m.markUntil ? m.markCrit : 0;
    const crit = opts.forceCrit || Math.random() * 100 < p.stats.crit + (opts.critBonus ?? 0) + marked;
    if (crit) raw *= 1 + p.stats.critDmg / 100;
    if (opts.maxMult) raw = Math.min(raw, p.stats.atk * opts.maxMult);
    // Armor break from skills, then the attacker's "เจาะเกราะ %" item stat (owner 2026-11-19), both cut DEF.
    const pen = 1 - Math.min(100, Math.max(0, p.stats.armorPen ?? 0)) / 100;
    const def = (this.time < m.armorBreakUntil ? m.defense * (1 - m.armorBreak) : m.defense) * pen;
    const under = m.isBoss && m.level - p.level > BOSS_LEVEL_GAP;
    const bossMult = m.isBoss ? classBalance(p.cls.id).bossDmgMult : 1;
    const dmg = Math.max(1, Math.round(mitigate(raw, def) * bossMult * (under ? BOSS_UNDERLEVEL_MULT : 1)));
    if (!m.damageBy.has(p.id)) {
      m.damageBy.set(p.id, 0);
      m.addFighter(m.damageBy.size);
    }
    // Overkill doesn't count: shares and lifesteal use the HP actually taken.
    const dealt = Math.min(dmg, Math.max(0, m.hp));
    m.damageBy.set(p.id, m.damageBy.get(p.id)! + dealt);
    if (this.hexSeeds.length) noteHexHit(this, p, m, dealt, opts.skill?.id ?? this.casterSkill);
    m.hp -= dmg;
    if (this.time < p.lifestealUntil && p.hp < p.maxHp) {
      // Whole HP only: near full the gap to max is fractional (regen), so floor the capped amount too.
      const heal = Math.floor(Math.min(p.maxHp - p.hp, dealt * p.lifesteal));
      if (heal > 0) {
        p.hp += heal;
        this.text(p.x, p.topY, p.z, `+${heal}`, 'heal', 0.6);
      }
    }
    this.events.push({ t: 'flash', id: m.id });
    this.dmgText(m, crit ? `${dmg}!` : String(dmg), crit ? 'crit' : 'dmg', p.id);
    if (crit) {
      this.sfx('crit', m.x, m.z);
      passiveOnCrit(this, p, m);
    }
    // Extra effects the owner added to this skill on /admin, merged in (the stronger wins): sim/extraEffects.ts.
    const src = opts.src ?? opts.skill?.id ?? this.casterSkill;
    if (src && !opts.noExtra) opts = withExtras(this, p, m, src, opts);
    if (opts.kb && !m.isBoss) m.knockback(opts.fromX ?? p.x, opts.fromZ ?? p.z, opts.kb);
    if (opts.stun && !m.def.pattern) m.stunT = Math.max(m.stunT, m.isBoss ? opts.stun * 0.3 : opts.stun);
    if (opts.slow) {
      m.slowAmt = opts.slow;
      m.slowT = opts.slowT ?? 2;
    }
    if (opts.armorBreak) {
      // Recasting refreshes the timer; it never stacks past the strongest break.
      if (this.time >= m.armorBreakUntil) m.armorBreak = 0;
      m.armorBreak = Math.max(m.armorBreak, opts.armorBreak);
      m.armorBreakUntil = this.time + (opts.armorBreakT ?? 3);
      this.text(m.x, m.topY + 0.4, m.z, 'เกราะแตก', 'info', 0.8);
    }
    if (opts.weak) {
      // Same as armor break: the strongest attack-down wins and a recast refreshes it.
      if (this.time >= m.weakUntil) m.weak = 0;
      m.weak = Math.min(0.95, Math.max(m.weak, opts.weak));
      m.weakUntil = this.time + (opts.weakT ?? 3);
    }
    // Its magic circle shows the skill that debuffed it last.
    const sk = opts.skill?.id ?? this.casterSkill;
    if (sk && (opts.stun || opts.slow || opts.armorBreak || opts.weak)) m.debuffSkill = sk;
    m.onHit(this, p);
    if (m.hp <= 0) {
      this.killMonster(m);
      p.onKill(m);
    }
  }

  hitPlayer(m: Monster, p: Player, mult: number, opts: HitOpts): void {
    if (!p.alive || this.inSafe(p)) return;
    if (p.invulnT > 0 || p.guardT > 0) {
      this.text(p.x, p.topY, p.z, 'MISS', 'info', 0.6);
      return;
    }
    const weak = this.time < m.weakUntil ? 1 - m.weak : 1;
    const taken = (this.time < p.takenUntil ? p.takenMult : 1) * passiveTakenMult(p);
    let dmg = Math.round((mitigate(m.atk * weak * mult * (0.9 + Math.random() * 0.2), p.stats.def) + p.maxHp * (opts.maxHpShare ?? 0)) * taken);
    if (p.shield > 0 && this.time < p.shieldUntil) {
      // A skill's shield takes the hit first.
      const soak = Math.min(p.shield, dmg);
      p.shield -= soak;
      dmg -= soak;
      // The soaked part shows as a number like an HP hit (blue), so a hit the shield took in full is not mistaken for a miss.
      if (soak > 0) this.dmgText(p, `-${soak}`, 'shield', p.id);
    }
    p.hp -= dmg;
    p.lastHurt = this.time;
    p.interruptPotions();
    this.cancelReturnCast(p, 'โดนโจมตี');
    if (m.isBoss) m.resetRamp();
    this.events.push({ t: 'flash', id: p.id });
    this.anim(p.id, 'hit');
    if (dmg > 0) this.dmgText(p, `-${dmg}`, 'hurt', p.id);
    // Sword Anchor: no stuns or knockback while it runs.
    const steady = this.time < p.steadyUntil;
    if (opts.stun && !steady) p.stunT = Math.max(p.stunT, opts.stun);
    if (opts.kb && !steady) p.knockback(opts.fromX ?? m.x, opts.fromZ ?? m.z, opts.kb);
    // Sword Thorn Armor: a share of the damage goes back at the attacker (through its defense, like any hit).
    if (this.time < p.reflectUntil && p.reflect > 0 && dmg > 0 && m.alive && p.stats.atk > 0) {
      this.fx('effect', 'sw_armorhit', m.x, m.z, 0, 0.9);
      const back = (dmg * p.reflect + p.reflectFlat) / p.stats.atk;
      this.hitMonster(p, m, back, { maxMult: back });
    }
    if (p.hp <= 0) this.killPlayer(p);
  }

  /** The Volcano Heart reached a faster phase (1 = below half HP, 2 = below 30%). */
  onHeartPhase(m: Monster, phase: number): void {
    const text = phase >= 2 ? 'หัวใจภูเขาไฟใกล้ระเบิด!' : 'หัวใจภูเขาไฟเดือดพล่าน!';
    const sub = phase >= 2 ? 'ท่าเร็วขึ้นอีกขั้น เตือนสั้นลง' : 'ท่าเร็วขึ้น และซ้อนกันได้ 2 ชุด';
    this.log(`${text} ${sub}`, '#ff6a5a');
    this.events.push({ t: 'banner', text, sub, x: m.x, z: m.z });
    this.sfx('heart_phase', m.x, m.z);
    this.shake(0.4, m);
  }

  /** Standing in lava: a share of max HP every so often, whatever the defense. */
  private tickLava(p: Player, dt: number): void {
    if (!this.terrain.onLava(p.x, p.z)) {
      p.lavaT = 0;
      return;
    }
    p.lavaT -= dt;
    if (p.lavaT > 0) return;
    p.lavaT = LAVA_TICK;
    if (p.invulnT > 0 || p.guardT > 0) return;
    const dmg = Math.max(1, Math.round(p.maxHp * LAVA_BURN));
    p.hp -= dmg;
    p.lastHurt = this.time;
    this.cancelReturnCast(p, 'โดนลาวา');
    this.events.push({ t: 'flash', id: p.id });
    this.dmgText(p, `-${dmg}`, 'hurt', p.id);
    this.fx('burst', p.x, 0.2, p.z, '#ff8a3a', 4, 2);
    if (p.hp <= 0) this.killPlayer(p);
  }

  onBossEnrage(m: Monster): void {
    this.text(m.x, m.topY + 0.6, m.z, 'ENRAGED!', 'crit', 1.6);
    this.log(
      m.def.frenzy
        ? `${m.def.name} คลั่งสุดขีด! เคลื่อนที่เร็วมากและออกท่าไวขึ้น`
        : m.def.enrageRamp
        ? `${m.def.name} คลั่ง! ยิ่งโจมตีไม่โดนยิ่งเร็วขึ้น`
        : `${m.def.name} คลั่ง! ความเร็วและการโจมตีเพิ่มขึ้น`,
      '#ff6a5a',
    );
    this.events.push({
      t: 'banner',
      text: `${m.def.nameTh.replace(/\s*\(.*\)/, '')} คลั่ง!`,
      sub: m.def.summon && !m.def.summon.vanish
        ? `เรียก${MONSTERS[m.def.summon.monster]?.nameTh ?? 'ลูกน้อง'}มาช่วย!`
        : m.def.frenzy ? 'เคลื่อนที่เร็วมากและออกท่าไวขึ้น'
        : m.def.enrageRamp ? 'ยิ่งโจมตีไม่โดนยิ่งเร็วขึ้น จนกว่าจะโดนตัว' : 'ความเร็วและการโจมตีเพิ่มขึ้น',
      x: m.x,
      z: m.z,
    });
    this.shake(0.3, m);
    if (!m.def.fx?.enrage) this.sfx('boss_arrive', m.x, m.z);
    if (m.def.fx?.enrage) this.fx('effect', m.def.fx.enrage, m.x, m.z, 0, Math.max(2.5, m.radius * 2.5));
    if (m.def.summon && !m.def.summon.vanish) this.summonMinions(m, m.def.summon.monster, m.def.summon.count);
  }

  /** Below half HP: the boss jumps off the map until its minions are dead. */
  onBossVanish(m: Monster): void {
    const minion = MONSTERS[m.def.summon!.monster]?.nameTh ?? 'ลูกน้อง';
    this.log(`${m.def.name} กระโดดหนีไป! กำจัด${minion}ให้หมดก่อน`, '#ff6a5a');
    this.events.push({
      t: 'banner',
      text: `${m.def.nameTh.replace(/\\s*\\(.*\\)/, '')} กระโดดหนีไป!`,
      sub: `กำจัด${minion}ให้หมดเพื่อเรียกกลับมา`,
      x: m.x,
      z: m.z,
    });
    m.jumpOut(this);
  }

  /** The boss has jumped out of sight: take it off the field (it keeps its spawner slot) and send its minions in. */
  onBossGone(boss: Monster): void {
    boss.gone = true;
    const s = boss.def.summon!;
    this.vanished = { boss, minions: this.summonMinions(boss, s.monster, s.count), awayT: 0 };
  }

  /** Brings a vanished boss back once its minions are dead, or if everyone has left it for a while. */
  private tickVanished(dt: number): void {
    const v = this.vanished;
    if (!v) return;
    const near = this.players.filter((p) => p.alive && Math.hypot(p.x - v.boss.x, p.z - v.boss.z) < VANISH_LEASH);
    v.awayT = near.length ? 0 : v.awayT + dt;
    if (v.awayT > VANISH_GIVE_UP) {
      for (const m of v.minions) {
        m.alive = false;
        m.deadT = 1;
      }
    } else if (v.minions.some((m) => m.alive)) return;
    this.vanished = null;
    let target: Player | null = null;
    for (const p of near) {
      if (!target || Math.hypot(p.x - v.boss.x, p.z - v.boss.z) < Math.hypot(target.x - v.boss.x, target.z - v.boss.z)) target = p;
    }
    v.boss.fallBack(this, target);
    this.monsters.push(v.boss);
    this.log(`${v.boss.def.name} กลับมาแล้ว!`, '#ff9a6a');
  }

  /** Minions appear in a ring around the boss and go straight for its target. */
  private summonMinions(boss: Monster, monsterId: string, count: number): Monster[] {
    const def = MONSTERS[monsterId];
    if (!def) return [];
    const minions: Monster[] = [];
    // Their own home spot (no spawner owns it), so they wander here after the fight and never respawn.
    const area: SpawnArea = { monster: monsterId, x: boss.x, z: boss.z, radius: 4, count: 0, respawn: [0, 0] };
    const r = Math.random;
    // Spread over everyone still standing: minion 1 on the first player, 2 on the second, and round again.
    const prey = this.players.filter((p) => p.alive && !this.inSafe(p));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r() * 0.5;
      let x = boss.x + Math.cos(a) * (boss.radius + 1.6);
      let z = boss.z + Math.sin(a) * (boss.radius + 1.6);
      if (this.terrain.isBlocked(x, z, def.radius)) {
        x = boss.x;
        z = boss.z;
      }
      const m = new Monster(this.newId(), def, randInt(r, def.levels[0], def.levels[1]), area, x, z, this.boost);
      m.markSummoned();
      m.target = prey.length ? prey[i % prey.length] : boss.target;
      m.aggroT = 12;
      m.state = 'chase';
      // They pounce at once, with only a short warning line. Leapers mark their landing spot instead.
      if (m.target?.alive) {
        if (def.leap) m.startLeap(this, m.target.x, m.target.z);
        else m.startCharge(this, m.target.x, m.target.z, MINION_POUNCE_WINDUP);
      }
      this.monsters.push(m);
      minions.push(m);
      this.fx('burst', x, 0.3, z, '#9fd98a', 10, 4);
      if (boss.def.fx?.summon) this.fx('effect', boss.def.fx.summon, x, z, 0, 1.6);
    }
    this.log(`${boss.def.name} เรียก${def.nameTh} ${count} ตัวมาช่วย!`, '#ff9a6a');
    return minions;
  }

  private killMonster(m: Monster): void {
    m.alive = false;
    m.deadT = 0;
    m.hp = 0;
    this.sfx(m.isBoss ? 'boss_die' : 'monster_die', m.x, m.z);
    if (m.def.pattern || m.def.spells) this.hazards = [];
    m.spells?.reset(this);
    if (!m.summoned) {
      this.shareExp(m);
      // Wave monsters give EXP but no loot (owner 2026-11-21: not a farm).
      if (!this.waveRun?.ids.has(m.id)) this.dropLoot(m);
      if (!m.isBoss) {
        this.questProgress(m);
        this.gearProgress(m);
      }
    }
    const sp = this.spawners.find((s) => s.area === m.area);
    if (sp) {
      sp.alive--;
      // A boss room's boss never comes back: the room closes after it.
      if (!this.zone.roomOf) sp.queue.push(this.time + rand(Math.random, sp.area.respawn[0], sp.area.respawn[1]));
    }
    if (m.isBoss) {
      this.log(`🏆 ปราบ ${m.def.name} สำเร็จ!`, '#ffcf5a');
      this.shake(0.4, m);
      if (this.zone.roomOf) this.cleared = true;
      this.terrain.releaseBossSolid();
    }
  }

  /**
   * EXP is split by each player's share of the damage, then reduced for monsters far below their level.
   * A player in a party then keeps half and shares the rest with party members on this map (see splitExp).
   */
  private shareExp(m: Monster): void {
    let total = 0;
    for (const v of m.damageBy.values()) total += v;
    if (total <= 0) return;
    const gained = new Map<Player, number>();
    for (const [id, dealt] of m.damageBy) {
      const p = this.players.find((x) => x.id === id);
      if (!p || dealt <= 0) continue;
      const mult = expGapMult(p.level, m.level);
      // A boss room gives the EXP of one kill per key put in.
      const exp = Math.max(1, Math.round(m.expReward * (m.isBoss ? this.keys : 1) * (dealt / total) * mult));
      if (mult < 1 && m.level < p.level && !p.lowExpHinted) {
        p.lowExpHinted = true;
        this.log('มอนสเตอร์ที่ชื่อเป็นสีเทาเลเวลต่ำกว่าคุณมาก ได้ EXP น้อยลง — ไปล่าตัวที่เลเวลสูงกว่านี้', '#b9b09a', p.id);
      }
      // Members on this map who are alive; offline members are in no Sim, so never here.
      const mates = p.partyId === null ? [] : this.players.filter((o) => o !== p && o.alive && o.partyId === p.partyId);
      const { keep, shares } = splitExp(exp, p.level, mates.map((o) => o.level));
      const shared = keep < exp;
      const mine = this.autoExp(p, keep);
      this.text(m.x, m.topY + 0.4, m.z,
        mult < 1 ? `+${mine} EXP (−${Math.round((1 - mult) * 100)}%)` : `+${mine} EXP${shared ? ' (แบ่งปาร์ตี้)' : ''}`, 'exp', 1.1, p.id);
      gained.set(p, (gained.get(p) ?? 0) + mine);
      mates.forEach((o, i) => {
        if (shares[i] > 0) gained.set(o, (gained.get(o) ?? 0) + this.autoExp(o, shares[i]));
      });
    }
    // Killing a gate boss unlocks the gate for everyone who hit it and everyone sharing its EXP.
    if (BOSS_GATE_IDS.has(m.def.id)) {
      const killers = new Set<Player>(gained.keys());
      for (const id of m.damageBy.keys()) {
        const p = this.players.find((x) => x.id === id);
        if (p) killers.add(p);
      }
      for (const p of killers) {
        if (!p.bossKills.includes(m.def.id)) {
          p.bossKills.push(m.def.id);
          this.events.push({ t: 'save', to: p.id });
        }
        // The Seeker's key for this boss has done its job.
        const qkey = BOSS_QUEST_KEY[m.def.id];
        if (qkey && p.stoneCount(qkey) > 0) {
          p.takeStones(qkey, p.stoneCount(qkey));
          this.log(`${STONE_NAME[qkey]} สลายไปแล้ว — ภารกิจนี้สำเร็จ`, '#ffd34a', p.id);
          this.events.push({ t: 'save', to: p.id });
        }
        delete p.quests[m.def.id];
        if (!gained.has(p)) gained.set(p, 0);
      }
    }
    // Levels go up after every share is worked out, so a level-up mid-kill can't change who is eligible.
    for (const [p, exp] of gained) {
      if (!m.damageBy.has(p.id) && exp > 0) this.text(p.x, p.topY + 0.4, p.z, `+${exp} EXP (ปาร์ตี้)`, 'exp', 1.1, p.id);
      this.addExp(p, exp);
    }
  }

  private killPlayer(p: Player): void {
    p.alive = false;
    p.hp = 0;
    p.moving = false;
    p.castT = 0;
    p.mounted = false;
    p.guardT = 0;
    // Skill buffs end with death.
    p.clearSkillBuffs();
    this.events.push({ t: 'died', id: p.id });
  }

  /** The fountain or campfire this player is standing next to, if any. */
  restSpotNear(p: { x: number; z: number }): RestSpot | null {
    return restSpotNear(this.terrain.restSpots, p);
  }

  /** Rest at the fountain or a campfire: HP and MP full, then REST_CD seconds before any of them works again. */
  rest(p: Player): boolean {
    const spot = this.restSpotNear(p);
    if (!p.alive || !spot) return false;
    if (p.restCd > 0) {
      this.text(p.x, p.topY, p.z, `พักได้อีกใน ${Math.ceil(p.restCd)} วิ`, 'info', 1, p.id);
      return false;
    }
    p.hp = p.maxHp;
    p.mp = p.stats.maxMp;
    p.restCd = REST_CD;
    this.fx('burst', spot.x, 1, spot.z, spot.kind === 'fountain' ? '#8fdcff' : '#ffb060', 22, 4);
    this.fx('burst', p.x, 1, p.z, '#9fffb0', 16, 3);
    this.text(p.x, p.topY, p.z, 'HP / MP เต็ม', 'heal', 1.2, p.id);
    this.log(`${spot.kind === 'fountain' ? 'ดื่มน้ำจากน้ำพุ' : 'นั่งพักข้างกองไฟ'} — HP และ MP เต็ม (พักได้อีกใน ${REST_CD} วิ)`, '#9fffb0', p.id);
    return true;
  }

  // ------------------------------------------------------------ mount

  /** Why this player can't get on the worn mount now, or null when they can. */
  mountBlocked(p: Player): string | null {
    if (!p.alive) return 'ขี่ไม่ได้ตอนตาย';
    if (!cosById(p.cosmetics.mount)) return `ยังไม่ได้สวม${COS_SLOT_NAME.mount}`;
    if (this.zone.roomOf) return 'ขี่ในห้องบอสไม่ได้';
    const calm = MOUNT_CALM - (this.time - Math.max(p.lastHurt, p.lastAttack));
    if (calm > 0) return `ขี่ได้อีกใน ${Math.ceil(calm)} วิ (เพิ่งต่อสู้)`;
    return null;
  }

  /** Gets on the worn mount, or off it when riding. Says why not when it can't. */
  toggleMount(p: Player): void {
    if (p.mounted) {
      p.mounted = false;
      return;
    }
    const why = this.mountBlocked(p);
    if (why) return void this.text(p.x, p.topY, p.z, why, 'info', 1.2, p.id);
    p.mounted = true;
    p.mountedAt = this.time;
  }

  /** Off the mount on a hit dealt or taken (owner: attack, skill or being hit), in a boss room, or with no mount worn. */
  tickMount(p: Player): void {
    if (!p.mounted) return;
    if (!p.alive || this.zone.roomOf || !cosById(p.cosmetics.mount) || Math.max(p.lastHurt, p.lastAttack) >= p.mountedAt) {
      p.mounted = false;
    }
  }

  // ------------------------------------------------------------ return scroll

  /**
   * Why this player can't use a return scroll here, or null when they can. The hook for boss rooms
   * (owner: no return scroll inside a boss room); nothing blocks it yet.
   */
  returnBlocked(_p: Player): string | null {
    // Not in a boss room (owner): the way out is its portal once the boss is dead, or the trip home after.
    return this.zone.roomOf ? 'ใช้ในห้องบอสไม่ได้' : null;
  }

  /**
   * Uses one buff scroll from the bag: BUFF_TIME more seconds of its boost, up to BUFF_MAX. A scroll that
   * would go past the cap is refused and kept (owner 2026-11-12: using another adds time).
   */
  useBuffScroll(p: Player, kind: string): void {
    if (!isBuffScroll(kind as StoneKind)) return;
    const k = kind as BuffScroll;
    if (!p.alive) return;
    if (p.stoneCount(k) < 1) return void this.text(p.x, p.topY, p.z, `ไม่มี${STONE_NAME[k]}`, 'info', 1, p.id);
    const left = p.buffs[k] ?? 0;
    if (left + BUFF_TIME > BUFF_MAX) {
      this.log(`${BUFF_LABEL[k]} สะสมได้สูงสุด ${BUFF_MAX / 3600} ชั่วโมง — ตอนนี้เหลือ ${fmtBuff(left)} รอให้ลดลงก่อนค่อยใช้ใบใหม่`, '#ff8a6a', p.id);
      return;
    }
    if (!p.takeStones(k, 1)) return;
    p.buffs[k] = left + BUFF_TIME;
    this.fx('burst', p.x, 1, p.z, STONE_COLOR[k], 16, 3);
    this.sfx('drink', p.x, p.z, p.id);
    this.log(`ใช้${STONE_NAME[k]} — ${BUFF_LABEL[k]} เหลือ ${fmtBuff(p.buffs[k]!)}`, STONE_COLOR[k], p.id);
    this.afterChange(p);
  }

  /** Uses up one megaphone (the server has already checked the message and the cooldown). False = none in the bag. */
  useMegaphone(p: Player): boolean {
    if (!p.takeStones('megaphone', 1)) return false;
    this.afterChange(p);
    return true;
  }

  /**
   * Opens mystery boxes from bag slot `slot` (owner 2026-11-22): one, or the whole stack with `all`. The server
   * rolls each box here (src/shared/mysteryBox.ts). A box needs one empty bag slot first, so every prize fits and
   * nothing is rolled only to be refused; opening the stack stops when the bag fills. Returns what should be
   * announced to the whole server (rows marked "announce" in /admin), for the server to send.
   */
  openBox(p: Player, slot: number, all: boolean, r: Rng = Math.random): string[] {
    const e = p.bag[slot];
    if (!isStone(e) || e.stone !== 'mystery_box') return [];
    if (this.time < p.boxReadyAt) return [];
    const cfg = boxNow();
    if (!cfg.enabled) {
      this.log('กล่องปริศนายังเปิดไม่ได้ตอนนี้', '#ff8a6a', p.id);
      return [];
    }
    const orbs = boxOrbs();
    const odds = boxOdds(cfg, orbs.length);
    if (!odds.length) {
      this.log('กล่องปริศนายังไม่มีของ — แจ้งผู้ดูแล', '#ff8a6a', p.id);
      return [];
    }
    const announce: string[] = [];
    let opened = 0;
    for (let n = all ? e.count : 1; n > 0; n--) {
      if (!p.hasBagSpace()) {
        // Both tabs need a slot: the prize (gear or a stack) is rolled only once it surely fits.
        this.log(opened ? `กระเป๋าเต็ม — เปิดไปแล้ว ${opened} กล่อง` : 'ต้องมีช่องว่างในกระเป๋าและช่องประเภทใช้งานอย่างละ 1 ช่องถึงจะเปิดกล่องได้', '#ff8a6a', p.id);
        break;
      }
      const cur = p.bag[slot];
      if (!isStone(cur) || cur.stone !== 'mystery_box') break;
      const row = rollBoxRow(odds, r);
      if (!row) break;
      if (--cur.count <= 0) p.bag[slot] = null;
      opened++;
      const got = this.giveBoxPrize(p, row, orbs, r);
      this.text(p.x, p.topY, p.z, `🎁 ${got.text}`, 'lvl', 1.2, p.id);
      this.log(`เปิดกล่องปริศนาได้ ${got.text}`, got.color, p.id);
      if (row.announce) announce.push(got.text);
    }
    if (opened) {
      p.boxReadyAt = this.time + BOX_OPEN_COOLDOWN;
      this.fx('burst', p.x, 1, p.z, STONE_COLOR.mystery_box, 18, 3);
      this.afterChange(p);
    }
    return announce;
  }

  /** Puts one box prize into the bag (there is an empty slot) and says what it was. */
  private giveBoxPrize(p: Player, row: BoxRow, orbs: readonly string[], r: Rng): { text: string; color: string } {
    const pr = row.prize;
    switch (pr.kind) {
      case 'gear': {
        const item = rollItem(r, p.level, p.cls.id, 0, undefined, pr.rarity);
        p.addToBag(item);
        return { text: item.name, color: RARITY_COLOR[item.rarity] };
      }
      case 'potion':
        p.addPotions(pr.potion, pr.size, row.count);
        return { text: `${potionName(pr.potion, pr.size)} ×${row.count}`, color: '#ff8a8a' };
      case 'gold':
        p.gold += row.count;
        return { text: `${row.count.toLocaleString()} G`, color: '#f2c230' };
      case 'stone':
        p.addStones(pr.stone, row.count);
        return { text: `${STONE_NAME[pr.stone]}${row.count > 1 ? ` ×${row.count}` : ''}`, color: STONE_COLOR[pr.stone] };
      case 'orb': {
        const id = pick(r, orbs) as OrbStoneKind;
        p.addStones(id, 1);
        return { text: STONE_NAME[id], color: STONE_COLOR[id] };
      }
    }
  }

  /**
   * Gives the orb of an orb item (mystery box) to the account. `owned` = the account already has it, `give` puts
   * it on the account (the server's cosmetics table). The item is used up only when the orb was given.
   */
  useOrbItem(p: Player, slot: number, owned: (id: string) => boolean, give: (id: string) => boolean): void {
    const e = p.bag[slot];
    if (!isStone(e) || !isOrbStone(e.stone)) return;
    const id = e.stone;
    if (cosById(id)?.slot !== 'orb') return void this.log('ลูกแก้วนี้ถูกนำออกจากเกมแล้ว ใช้ไม่ได้', '#ff8a6a', p.id);
    if (owned(id)) return void this.log(`มี${STONE_NAME[id]}อยู่แล้ว — เก็บไว้เทรดหรือขายในตลาดได้`, '#ff8a6a', p.id);
    if (!give(id)) return;
    if (--e.count <= 0) p.bag[slot] = null;
    this.fx('burst', p.x, 1, p.z, STONE_COLOR[id], 16, 3);
    this.log(`ได้รับ${STONE_NAME[id]} — สวมได้ที่กระเป๋าแฟชั่น`, STONE_COLOR[id], p.id);
    this.afterChange(p);
  }

  /** Counts each running buff down by the seconds played; tells the player when one runs out. */
  private tickBuffs(p: Player, dt: number): void {
    for (const k of BUFF_SCROLLS) {
      const left = p.buffs[k];
      if (left === undefined) continue;
      if (left - dt > 0) {
        p.buffs[k] = left - dt;
        continue;
      }
      delete p.buffs[k];
      this.log(`${BUFF_LABEL[k]} หมดเวลาแล้ว`, '#b9b09a', p.id);
      this.events.push({ t: 'save', to: p.id });
    }
  }

  /** Starts the RETURN_CAST-second cast. The scroll is only used up when the cast finishes. */
  startReturnCast(p: Player): void {
    if (!p.alive || p.castT > 0) return;
    if (p.stoneCount('return_scroll') < 1) {
      this.text(p.x, p.topY, p.z, `ไม่มี${STONE_NAME.return_scroll}`, 'info', 1, p.id);
      return;
    }
    const why = this.returnBlocked(p);
    if (why) {
      this.text(p.x, p.topY, p.z, why, 'info', 1.2, p.id);
      return;
    }
    p.castT = RETURN_CAST;
    p.castX = p.x;
    p.castZ = p.z;
    p.moveTarget = null;
    this.fx('burst', p.x, 1, p.z, STONE_COLOR.return_scroll, 10, 2);
    this.log(`กำลังร่าย${STONE_NAME.return_scroll} (${RETURN_CAST} วิ) — เดิน ตี หรือโดนโจมตีจะยกเลิก`, STONE_COLOR.return_scroll, p.id);
  }

  /** Stops a cast in progress; the scroll is kept. */
  cancelReturnCast(p: Player, why: string): void {
    if (p.castT <= 0) return;
    p.castT = 0;
    this.text(p.x, p.topY + 0.4, p.z, `ยกเลิกการวาร์ป (${why})`, 'info', 1, p.id);
  }

  private tickReturnCast(p: Player, dt: number, it: Intent): void {
    if (p.castT <= 0) return;
    if (!p.alive) return this.cancelReturnCast(p, 'ตาย');
    if (p.stunT > 0) return this.cancelReturnCast(p, 'โดนสตัน');
    if (it.basic || it.skills.length || it.dash) return this.cancelReturnCast(p, 'โจมตี');
    if (Math.hypot(p.x - p.castX, p.z - p.castZ) > 0.15) return this.cancelReturnCast(p, 'เดิน');
    p.castT -= dt;
    if (p.castT > 0) return;
    p.castT = 0;
    // Re-check: the scroll may have been sold, traded or stashed during the cast.
    const why = this.returnBlocked(p);
    if (why) return void this.text(p.x, p.topY, p.z, why, 'info', 1.2, p.id);
    if (!p.takeStones('return_scroll', 1)) return void this.text(p.x, p.topY, p.z, `ไม่มี${STONE_NAME.return_scroll}`, 'info', 1, p.id);
    this.inventoryChanged(p);
    this.events.push({ t: 'save', to: p.id });
    this.fx('burst', p.x, 1, p.z, STONE_COLOR.return_scroll, 22, 4);
    this.log(`ใช้${STONE_NAME.return_scroll} — กลับศูนย์กลางมิติ`, STONE_COLOR.return_scroll, p.id);
    if (this.zone.id !== HUB_ID) {
      this.events.push({ t: 'travel', to: p.id, zone: HUB_ID, atCamp: true });
      return;
    }
    ({ x: p.x, z: p.z } = this.spawnPoint());
    p.moveTarget = null;
    for (const m of this.monsters) if (m.target === p) m.dropTarget();
    this.events.push({ t: 'warped', id: p.id });
  }

  respawn(p: Player): void {
    if (p.alive) return;
    const penalty = Math.floor(expToNext(p.level) * 0.1);
    p.exp = Math.max(0, p.exp - penalty);
    p.alive = true;
    p.hp = p.maxHp;
    p.mp = p.stats.maxMp;
    p.stunT = 0;
    p.guardT = 0;
    p.kbx = p.kbz = 0;
    ({ x: p.x, z: p.z } = this.spawnPoint());
    p.moveTarget = null;
    for (const m of this.monsters) if (m.target === p) m.dropTarget();
    this.events.push({ t: 'revived', id: p.id });
    // In a boss room, getting up means coming out by the summoner of its map (owner 2026-11-12); in a wave run, by its door.
    const lair = this.exitTo ?? lairExitSpot(this.zone);
    this.log(`ฟื้นคืนชีพที่${this.exitTo ? 'หน้าประตู' : lair ? 'แท่นเรียกบอส' : 'เมือง'} (เสีย EXP ${penalty})`, '#ff9a6a', p.id);
    this.events.push({ t: 'save', to: p.id });
    // Out in a zone, the town is in the hub. Queued after `revived`, so the browser gets both in order.
    if (lair) this.events.push({ t: 'travel', to: p.id, zone: lair.field, spot: { x: lair.x, z: lair.z } });
    else if (this.zone.id !== HUB_ID) this.events.push({ t: 'travel', to: p.id, zone: HUB_ID, atCamp: true });
  }

  /** EXP this player really gets from `n`: half while Auto Play is on, then doubled by an EXP scroll, then the VIP bonus (rounded down). */
  private autoExp(p: Player, n: number): number {
    const auto = p.autoOn ? Math.floor(n * AUTO_EXP_MULT) : n;
    return vipExp(p.buffs.exp_scroll ? auto * BUFF_MULT : auto, p.vip);
  }

  private addExp(p: Player, n: number): void {
    if (p.level >= MAX_LEVEL) return;
    p.exp += n;
    while (p.level < MAX_LEVEL && p.exp >= expToNext(p.level)) {
      const gate = blockingGate(p.level, p.bossKills);
      if (gate) {
        // Full bar, the rest is lost, until the boss is killed.
        p.exp = expToNext(p.level);
        if (p.gateHintedAt !== p.level) {
          p.gateHintedAt = p.level;
          this.log(`ต้องลงบอส ${gate.nameTh} ก่อนถึงจะเลเวลเกิน ${gate.level} ได้ — EXP เต็มหลอดแล้ว ส่วนที่เกินจะหายไป`, '#ffb060', p.id);
        }
        break;
      }
      p.exp -= expToNext(p.level);
      p.level++;
      p.recompute();
      p.hp = p.maxHp;
      p.mp = p.stats.maxMp;
      this.fx('levelUp', p.x, p.z);
      this.text(p.x, p.topY + 0.5, p.z, 'LEVEL UP!', 'lvl', 1.8);
      this.log(`✨ เลเวลอัพ! ตอนนี้ Lv.${p.level}`, '#ffd34a', p.id);
      this.events.push({ t: 'save', to: p.id });
    }
  }

  // ------------------------------------------------------------ The Seeker's key quests

  /** The map a monster comes from (by its level), also when it stands in the hub. */
  private homeOf(def: { levels: [number, number] }): ZoneDef | undefined {
    return Object.values(ZONES).find((z) => z.id !== HUB_ID && def.levels[0] >= z.levels[0] && def.levels[0] <= z.levels[1]);
  }

  /** Quests The Seeker can give this player now: a boss of a map they have reached, not yet beaten, not taken, no key held. */
  questOffers(p: Player): string[] {
    return questRows(p).filter((r) => r.state === 'offer').map((r) => r.boss);
  }

  questAccept(p: Player, boss: string): boolean {
    if (!this.near(p, 'seeker') || !this.questOffers(p).includes(boss)) return false;
    p.quests[boss] = 0;
    const map = Object.values(ZONES).find((z) => z.lair?.boss === boss)!;
    this.log(`รับภารกิจ: ล่ามอนสเตอร์ใน${map.nameTh} ${QUEST_KILLS} ตัว แล้วกลับมาหา The Seeker`, '#ffd34a', p.id);
    this.events.push({ t: 'save', to: p.id });
    return true;
  }

  questTurnIn(p: Player, boss: string): boolean {
    const key = BOSS_QUEST_KEY[boss];
    if (!key || !this.near(p, 'seeker') || (p.quests[boss] ?? -1) < QUEST_KILLS) return false;
    if (!p.addStones(key, 1)) {
      this.log('ช่องประเภทใช้งานเต็ม — เคลียร์ช่องว่าง 1 ช่องก่อนรับกุญแจ', '#ff8a6a', p.id);
      return false;
    }
    delete p.quests[boss];
    this.log(`ได้รับ ${STONE_NAME[key]} — ใส่ที่แท่นเรียกบอสได้ (ไม่หายเมื่อใช้ จนกว่าจะปราบบอสได้)`, STONE_COLOR[key], p.id);
    this.sfx('trade', p.x, p.z, p.id);
    this.events.push({ t: 'save', to: p.id });
    return true;
  }

  /** A monster of a map died: everyone who hit it and has that map's boss quest counts one. */
  private questProgress(m: Monster): void {
    const boss = this.homeOf(m.def)?.lair?.boss;
    if (!boss) return;
    for (const [id, dealt] of m.damageBy) {
      const p = this.players.find((x) => x.id === id);
      const n = p?.quests[boss];
      if (!p || dealt <= 0 || n === undefined || n >= QUEST_KILLS) continue;
      p.quests[boss] = n + 1;
      this.text(m.x, m.topY + 0.8, m.z, `ภารกิจ ${n + 1}/${QUEST_KILLS}`, 'info', 1, p.id);
      if (n + 1 >= QUEST_KILLS) {
        this.log(`ล่าครบ ${QUEST_KILLS} ตัวแล้ว — กลับไปหา The Seeker ที่เมืองเพื่อรับกุญแจ`, '#ffd34a', p.id);
        this.events.push({ t: 'save', to: p.id });
      }
    }
  }

  // ------------------------------------------------------------ The Seeker's gear quests (src/shared/gearQuests.ts)

  gearAccept(p: Player, id: string): boolean {
    const r = gearRow(p, id);
    if (!r || r.state !== 'offer' || !this.near(p, 'seeker')) return false;
    p.gearQuests[id] = 0;
    this.log(`รับภารกิจ: ล่ามอนสเตอร์ใน${r.map.nameTh} ${GEAR_KILLS} ตัว แล้วกลับมาหา The Seeker เพื่อรับ${GEAR_PART_NAME[r.part]}`, '#ffd34a', p.id);
    this.events.push({ t: 'save', to: p.id });
    return true;
  }

  gearTurnIn(p: Player, id: string): boolean {
    const r = gearRow(p, id);
    if (!r || r.state !== 'ready' || !this.near(p, 'seeker')) return false;
    const items = gearReward(r.map, r.part, p.cls.id, p.level);
    const free = p.freeSlots('gear');
    if (free < items.length) {
      this.log(`กระเป๋าเต็ม — เคลียร์ช่องว่าง ${items.length} ช่องก่อนรับ${GEAR_PART_NAME[r.part]}`, '#ff8a6a', p.id);
      return false;
    }
    for (const it of items) p.addToBag(it);
    delete p.gearQuests[id];
    p.gearDone.push(id);
    this.log(`ได้รับ${GEAR_PART_NAME[r.part]}: ${items.map((it) => it.name).join(', ')}`, RARITY_COLOR[items[0]?.rarity ?? 'uncommon'], p.id);
    this.sfx('trade', p.x, p.z, p.id);
    this.events.push({ t: 'save', to: p.id });
    return true;
  }

  /** A monster of a map died: everyone who hit it and has one of that map's gear quests under way counts one. */
  private gearProgress(m: Monster): void {
    const map = this.homeOf(m.def);
    if (!map) return;
    for (const [pid, dealt] of m.damageBy) {
      const p = this.players.find((x) => x.id === pid);
      if (!p || dealt <= 0) continue;
      for (const [id, n] of Object.entries(p.gearQuests)) {
        if (!id.startsWith(`${map.id}:`) || n >= GEAR_KILLS) continue;
        p.gearQuests[id] = n + 1;
        this.text(m.x, m.topY + 1.3, m.z, `อุปกรณ์ ${n + 1}/${GEAR_KILLS}`, 'info', 1, p.id);
        if (n + 1 >= GEAR_KILLS) {
          this.log(`ล่าครบ ${GEAR_KILLS} ตัวแล้ว — กลับไปหา The Seeker ที่เมืองเพื่อรับอุปกรณ์`, '#ffd34a', p.id);
          this.events.push({ t: 'save', to: p.id });
        }
      }
    }
  }

  // ------------------------------------------------------------ tutorial quests (src/shared/tutorial.ts)

  /**
   * Takes a tutorial step from its NPC: gold now, plus the step's bound stones into the bag (refused, with
   * nothing given, if they don't fit). The server saves right after, so the gold and the taken step stay together.
   * A step the account was already paid for (its holder was deleted) is taken again for nothing.
   */
  tutAccept(p: Player, step: TutStep): boolean {
    const row = tutRows(p.tut, p.name).find((r) => r.step === step);
    if (!row || row.state !== 'offer' || !this.near(p, TUT_NPC[step])) return false;
    const pay = !p.tut.paid?.includes(step);
    const stones = pay ? (TUT_ACCEPT_STONES[step] ?? []).map((s) => ({ stone: s.stone, count: s.count, bound: true as const })) : [];
    if (stones.length && !putAll(structuredClone(p.bag), stones, p.bagSlots)) {
      this.log(`ช่องประเภทใช้งานเต็ม — เคลียร์ช่องว่าง ${stones.length} ช่องก่อนรับภารกิจ`, '#ff8a6a', p.id);
      return false;
    }
    putAll(p.bag, stones, p.bagSlots);
    p.tut.cur = { step, by: p.name, got: [] };
    if (pay) {
      p.gold += TUT_ACCEPT_GOLD;
      p.tut.paid = [...(p.tut.paid ?? []), step];
      const extra = stones.map((s) => `${STONE_NAME[s.stone]} ×${s.count}`).join(', ');
      this.log(`รับภารกิจสอนระบบ: ${TUT_STEP_NAME[step]} (+${TUT_ACCEPT_GOLD.toLocaleString()} G${extra ? `, ${extra} ผูกตัวละคร` : ''})`, '#ffd34a', p.id);
    } else {
      this.log(`รับภารกิจสอนระบบต่อ: ${TUT_STEP_NAME[step]} (บัญชีนี้ได้ของตอนรับไปแล้ว จึงไม่ได้ซ้ำ)`, '#ffd34a', p.id);
    }
    for (const k of TUT_TASKS[step]) this.log(`• ${TUT_TASK_NAME[k]}`, '#ffd34a', p.id);
    this.sfx('trade', p.x, p.z, p.id);
    this.afterChange(p);
    return true;
  }

  /**
   * Hands a finished tutorial step in to its NPC: marks it done and returns the reward the server mails
   * (src/shared/tutorial.ts tutTurnInReward), or null when it can't be handed in. `undo` puts it back
   * if the mail can't be written.
   */
  tutTurnIn(p: Player, step: TutStep): { reward: MailAttach; undo: () => void } | null {
    const row = tutRows(p.tut, p.name).find((r) => r.step === step);
    if (!row || row.state !== 'ready' || !this.near(p, TUT_NPC[step])) return null;
    const before = structuredClone(p.tut);
    p.tut.done.push(step);
    delete p.tut.cur;
    const last = step === TUT_STEPS[TUT_STEPS.length - 1];
    this.log(last ? 'จบภารกิจสอนระบบครบทุกขั้นแล้ว! รางวัลส่งไปที่กล่องจดหมาย' : `ส่งภารกิจสอนระบบ: ${TUT_STEP_NAME[step]} — รางวัลส่งไปที่กล่องจดหมาย`, '#ffd34a', p.id);
    this.sfx('trade', p.x, p.z, p.id);
    this.events.push({ t: 'save', to: p.id });
    return {
      reward: tutTurnInReward(step, currentBalance().tutorial),
      undo: () => {
        p.tut.done = before.done;
        p.tut.cur = before.cur;
      },
    };
  }

  /** Counts one thing a tutorial step asks for, when the player has that step under way. True = it counted. */
  tutTask(p: Player, task: TutTask): boolean {
    const cur = p.tut.cur;
    if (!cur || cur.by !== p.name || !TUT_TASKS[cur.step].includes(task) || cur.got.includes(task)) return false;
    cur.got.push(task);
    const left = TUT_TASKS[cur.step].filter((k) => !cur.got.includes(k)).length;
    this.log(left ? `ภารกิจสอนระบบ: ${TUT_TASK_NAME[task]} ✓ (เหลืออีก ${left})` : `ภารกิจสอนระบบ ${TUT_STEP_NAME[cur.step]} ครบแล้ว — กลับไปส่งที่${NPC_INFO[TUT_NPC[cur.step]].name}`, '#ffd34a', p.id);
    this.events.push({ t: 'save', to: p.id });
    return true;
  }

  // ------------------------------------------------------------ loot

  private dropLoot(m: Monster): void {
    const d = m.def;
    const r = Math.random;
    // Whoever did the most damage gets first pick of the loot.
    let top: Player | undefined;
    let best = -1;
    for (const [id, dealt] of m.damageBy) {
      const p = this.players.find((x) => x.id === id);
      if (p && dealt > best) {
        best = dealt;
        top = p;
      }
    }
    // Drops are for any class: weapons and armor of other classes can be sold or given to a friend.
    const anyClass = () => pick(r, CLASS_IDS);
    // Gear comes from the monster's own map (by its level), also when it stands in the hub.
    const home = this.homeOf(d);
    const band = home?.levels;
    // The top damage dealer gets first pick for a while, then anyone can take it.
    const owner = top?.id;
    // Everyone in the top damage dealer's party (on this map) shares that first pick, gold included.
    const party = top?.partyId ?? null;
    // The drop scroll of whoever gets first pick doubles every chance below (never the gold or fixed counts), and their VIP adds its bonus on top.
    const boost = (top?.buffs.drop_scroll ? BUFF_MULT : 1) * vipDropMult(!!top?.vip);
    const chance = (c: number) => r() < Math.min(1, c * boost);
    // A boss room's boss drops everything once per key put in (owner: rewards times the keys).
    const times = m.isBoss ? this.keys : 1;
    const box = boxNow();
    const gold = Math.round(randInt(r, d.gold[0], d.gold[1]) * (1 + 0.1 * (m.level - d.levels[0])) * DROP_GOLD_MULT * m.mult.gold) * times;
    // A low gold multiplier (admin) can round a drop down to nothing: no empty pile then.
    if (gold > 0) this.spawnLoot(m, { type: 'gold', amount: gold }, owner, party);
    if (m.isBoss) {
      const loot = d.bossLoot;
      // In a boss room the whole drop is collected first, then spread over the arena by its size.
      const spread = !!this.zone.roomOf && currentBalance().bossLootSpread;
      if (spread) this.lootQueue = [];
      for (let k = 0; k < times; k++) {
        const n = loot?.items ?? randInt(r, 2, 3);
        for (let i = 0; i < n; i++) this.spawnLoot(m, { type: 'item', item: rollItem(r, m.level, anyClass(), 1.5, band) }, owner, party);
        for (let i = 0; i < (loot?.epics ?? 0); i++) this.spawnLoot(m, { type: 'item', item: rollItem(r, m.level, anyClass(), 1.5, band, 'epic') }, owner, party);
        this.spawnLoot(m, { type: 'potion', pot: 'hp', size: dropPotionSize(m.level), count: DROP_POTION_MULT }, owner, party);
        this.spawnLoot(m, { type: 'potion', pot: 'mp', size: dropPotionSize(m.level), count: DROP_POTION_MULT }, owner, party);
        // Every blacksmith stone kind can drop from a boss, each rolled on its own.
        for (const stone of BLACKSMITH_STONES) {
          if (chance(loot?.stoneChance ?? BOSS_STONE_CHANCE)) this.spawnLoot(m, { type: 'stone', stone, count: 1 }, owner, party);
        }
        // Mystery box (owner 2026-11-22): once per key, while the owner has it switched on in /admin.
        if (box.enabled && chance(box.bossPct / 100)) this.spawnLoot(m, { type: 'stone', stone: 'mystery_box', count: 1 }, owner, party);
      }
      if (spread) this.flushSpreadLoot(m, owner, party);
      return;
    }
    if (chance(d.itemChance)) this.spawnLoot(m, { type: 'item', item: rollItem(r, m.level, anyClass(), 0, band) }, owner, party);
    if (chance(d.potionChance * DROP_POTION_MULT)) this.spawnLoot(m, { type: 'potion', pot: r() < 0.6 ? 'hp' : 'mp', size: dropPotionSize(m.level), count: 1 }, owner, party);
    // Reroll stones, rarely, from monsters that drop items at all (not summoned minions).
    if (d.itemChance > 0) {
      for (const stone of MONSTER_STONES) {
        if (chance(MONSTER_STONE_CHANCE)) this.spawnLoot(m, { type: 'stone', stone, count: 1 }, owner, party);
      }
      // The key of its home map's boss, wherever it stands (its map or the hub).
      const key = home?.lair && BOSS_KEY[home.lair.boss];
      if (key && chance(KEY_DROP_CHANCE)) this.spawnLoot(m, { type: 'stone', stone: key, count: 1 }, owner, party);
      if (box.enabled && chance(box.mobPct / 100)) this.spawnLoot(m, { type: 'stone', stone: 'mystery_box', count: 1 }, owner, party);
    }
  }

  /** A boss room boss's drop while it is being rolled: placed together by flushSpreadLoot. */
  private lootQueue: LootKind[] | null = null;

  private spawnLoot(m: Monster, kind: LootKind, owner?: number, ownerParty: number | null = null): void {
    if (this.lootQueue) {
      this.lootQueue.push(kind);
      return;
    }
    const [x, z] = this.lootSpot(m.x, m.z, 0.5 + Math.random() * (m.isBoss ? 2 : 1));
    this.pushLoot(m, kind, x, z, owner, ownerParty);
  }

  /**
   * Places the queued boss drop on a sunflower spiral around the boss (even spacing, no piles): the
   * radius is base + k x sqrt(pieces), capped (BalanceConfig.bossLoot*). A spot nobody could stand on
   * moves in towards the boss along its own direction, then falls back to lootSpot. Who may pick up
   * and when is untouched (owner / ownerParty / ownerUntil as for any drop).
   */
  private flushSpreadLoot(m: Monster, owner: number | undefined, party: number | null): void {
    const kinds = this.lootQueue ?? [];
    this.lootQueue = null;
    const n = kinds.length;
    if (!n) return;
    const bal = currentBalance();
    const R = Math.min(bal.bossLootMax, bal.bossLootBase + bal.bossLootK * Math.sqrt(n));
    // Shuffle so the rare pieces do not all land in the middle.
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + i * 2.399963229728653;
      let r = Math.max(0.5, R * Math.sqrt((i + 0.5) / n));
      let spot: [number, number] | null = null;
      for (; r >= 0.5; r -= 0.4) {
        const lx = m.x + Math.cos(a) * r;
        const lz = m.z + Math.sin(a) * r;
        if (!this.terrain.isBlocked(lx, lz, LOOT_STAND_R)) {
          spot = [lx, lz];
          break;
        }
      }
      spot ??= this.lootSpot(m.x, m.z, 0.5);
      this.pushLoot(m, kinds[i], spot[0], spot[1], owner, party);
    }
  }

  private pushLoot(m: Monster, kind: LootKind, x: number, z: number, owner: number | undefined, ownerParty: number | null): void {
    this.loots.push(new Loot(this.newId(), x, z, m.x, m.z, kind, {
      owner, ownerParty, ownerUntil: this.time + LOOT_PRIORITY_TIME, forever: !!this.zone.roomOf,
    }));
  }

  /**
   * Where a drop lands: `dist` from (x, z) in a random direction, moved further out until a player
   * could stand on it. Gear has no magnet (it is picked up within 0.8), so a drop inside a solid —
   * e.g. the Volcano Heart's rock (zone.bossSolid) or a tree a monster died against — could never
   * be picked up.
   */
  private lootSpot(x: number, z: number, dist: number): [number, number] {
    const a0 = Math.random() * Math.PI * 2;
    for (let turn = 0; turn < 8; turn++) {
      const a = a0 + (turn * Math.PI) / 4;
      for (let d = dist; d <= dist + 10; d += 0.3) {
        const lx = x + Math.cos(a) * d;
        const lz = z + Math.sin(a) * d;
        if (!this.terrain.isBlocked(lx, lz, LOOT_STAND_R)) return [lx, lz];
      }
    }
    return [x + Math.cos(a0) * dist, z + Math.sin(a0) * dist];
  }

  /** Called by Loot when a player touches it. Returns false if it can't be picked up. */
  pickup(p: Player, l: Loot): boolean {
    const k = l.kind;
    if (k.type === 'gold') {
      p.gold += k.amount;
      this.text(p.x, p.topY, p.z, `+${k.amount} G`, 'gold', 0.7, p.id);
      this.sfx('pickup_gold', p.x, p.z, p.id);
    } else if (k.type === 'potion') {
      if (!p.addPotions(k.pot, k.size, k.count)) return false;
      this.text(p.x, p.topY, p.z, `+${potionName(k.pot, k.size)}${k.count > 1 ? ` ×${k.count}` : ''}`, k.pot === 'hp' ? 'heal' : 'mana', 0.7, p.id);
      this.sfx('pickup_potion', p.x, p.z, p.id);
      this.inventoryChanged(p);
    } else if (k.type === 'stone') {
      if (!p.addStones(k.stone, k.count)) return false;
      this.text(p.x, p.topY, p.z, `+${STONE_NAME[k.stone]}${k.count > 1 ? ` ×${k.count}` : ''}`, 'lvl', 0.9, p.id);
      this.log(`ได้รับ ${STONE_NAME[k.stone]}${k.count > 1 ? ` ×${k.count}` : ''}`, STONE_COLOR[k.stone], p.id);
      this.sfx('pickup_item', p.x, p.z, p.id);
      this.afterChange(p);
    } else {
      if (!p.addToBag(k.item)) return false;
      this.events.push({ t: 'item', to: p.id, item: k.item });
      this.sfx('pickup_item', p.x, p.z, p.id);
    }
    return true;
  }

  /**
   * The player clicked a drop and walked up to it: picks it up even when the loot filter skips its kind
   * (walking over such a drop never takes it). Only drops this player may take, within reach.
   */
  pickupLoot(p: Player, lootId: number): boolean {
    const l = this.loots.find((x) => x.id === lootId);
    if (!p.alive || !l || l.dead || !l.canTake(p, this.time)) return false;
    if (Math.hypot(l.x - p.x, l.z - p.z) > LOOT_CLICK_RANGE) return false;
    if (!this.pickup(p, l)) {
      this.text(p.x, p.topY, p.z, l.kind.type === 'item' ? 'กระเป๋าเต็ม' : 'ช่องประเภทใช้งานเต็ม', 'info', undefined, p.id);
      return false;
    }
    l.dead = true;
    return true;
  }

  /** A quest key would leave the bag: say why, and refuse. */
  private refuseBound(p: Player): false {
    this.log(BOUND_MSG, '#ff8a6a', p.id);
    return false;
  }

  /**
   * Throws a bag slot away for good (owner 2026-11-23: nothing is left on the ground; the browser asks first).
   * Returns what was destroyed, or null (empty slot, or a quest key, which can't leave the bag).
   */
  dropFromBag(p: Player, i: number): BagEntry | null {
    if (isBound(p.bag[i])) {
      this.refuseBound(p);
      return null;
    }
    const item = p.takeFromBag(i);
    if (!item) return null;
    this.log(`ทิ้ง ${entryName(item)} แล้ว (หายถาวร)`, '#b9b09a', p.id);
    this.afterChange(p);
    return item;
  }

  // ------------------------------------------------------------ NPC trades

  npcDistance(p: Player, id: NpcId): number {
    const n = this.terrain.npcPos[id];
    return n ? Math.hypot(p.x - n.x, p.z - n.z) : Infinity;
  }

  /** Trades only work while standing next to that NPC. */
  near(p: Player, id: NpcId): boolean {
    return p.alive && this.npcDistance(p, id) <= NPC_USE_RANGE;
  }

  private afterChange(p: Player): void {
    this.inventoryChanged(p);
    this.events.push({ t: 'save', to: p.id });
  }

  /** The bag changed in a small way (a potion drunk or picked up): refresh it, no save needed. */
  inventoryChanged(p: Player): void {
    this.events.push({ t: 'inventory', to: p.id });
  }

  setAutoSettings(p: Player, s: AutoSettings): void {
    p.autoSettings = cleanAutoSettings(s);
    this.events.push({ t: 'save', to: p.id });
  }

  // ------------------------------------------------------------ skills (owner 2026-11-14)

  /** Learns skill `id` (rank 1) or ranks it up by one, for one skill point. The server checks everything here. */
  learnSkill(p: Player, id: unknown): boolean {
    const sk = learnable(p.cls.id, id);
    if (!sk) return false;
    const why = learnBlock(p.cls.id, p.level, p.skillBook, sk.id);
    if (why) {
      this.log(why, '#ff8a6a', p.id);
      return false;
    }
    const rank = (p.skillBook.ranks[sk.id] ?? 0) + 1;
    p.skillBook.ranks[sk.id] = rank;
    // A first skill of a kind goes straight onto an empty slot that takes it.
    if (rank === 1) {
      const free = WEAR_SLOTS.find((s) => SLOT_KIND[s] === sk.kind && !p.skillBook.worn[s]);
      if (free) wear(p.skillBook, free, sk.id);
    }
    this.log(rank === 1 ? `เรียน${sk.nameTh}แล้ว` : `${sk.nameTh} แรงก์ ${rank}`, '#9fd8ff', p.id);
    // The worn passive (and its rank) changes stats.
    p.recompute();
    this.events.push({ t: 'save', to: p.id });
    return true;
  }

  /**
   * Takes one point back from skill `id` (rank 1 → forgotten and taken off). Free while the character has earned
   * few points, then gold per point (owner 2026-11-14). Not in combat, since it can empty a slot.
   */
  refundSkill(p: Player, id: unknown, all = false): boolean {
    const sk = learnable(p.cls.id, id);
    const has = sk ? p.skillBook.ranks[sk.id] ?? 0 : 0;
    if (!sk || !has) return false;
    // One point, or every point in this skill (owner 2026-11-15) at the same price per point.
    const n = all ? has : 1;
    if (!this.canRefund(p, n)) return false;
    const price = refundPrice(p.level) * n;
    p.gold -= price;
    for (let i = 0; i < n; i++) unlearnOne(p.skillBook, sk.id);
    p.recompute();
    const left = rankOf(p.skillBook, sk.id);
    this.log(`คืน ${n} แต้มจาก${sk.nameTh}${left ? ` (เหลือแรงก์ ${left})` : ' (ลืมสกิลแล้ว)'}${price ? ` −${price.toLocaleString()} G` : ''}`, '#9fd8ff', p.id);
    this.events.push({ t: 'save', to: p.id });
    return true;
  }

  /** Takes back every skill point (owner 2026-11-15): all skills forgotten and taken off, at the refund price per point. */
  resetSkills(p: Player): boolean {
    const n = pointsSpent(p.skillBook);
    if (!n || !this.canRefund(p, n)) return false;
    const price = refundPrice(p.level) * n;
    p.gold -= price;
    p.skillBook = emptySkillBook();
    p.recompute();
    this.log(`รีเซ็ตสกิลทั้งหมด ได้คืน ${n} แต้ม${price ? ` −${price.toLocaleString()} G` : ''}`, '#9fd8ff', p.id);
    this.events.push({ t: 'save', to: p.id });
    return true;
  }

  /** Out of combat and enough gold to take `n` points back (says why not in the log). */
  private canRefund(p: Player, n: number): boolean {
    if (p.inCombat()) {
      this.log('คืนแต้มสกิลระหว่างต่อสู้ไม่ได้', '#ff8a6a', p.id);
      return false;
    }
    const price = refundPrice(p.level);
    if (p.gold < price * n) {
      this.log(`ทองไม่พอ — คืน ${n} แต้ม แต้มละ ${price.toLocaleString()} G รวม ${(price * n).toLocaleString()} G`, '#ff8a6a', p.id);
      return false;
    }
    return true;
  }

  /** Wears learned skill `id` on `slot` (null = take it off). Out of combat only (owner 2026-11-14). */
  wearSkill(p: Player, slot: unknown, id: unknown): boolean {
    if (typeof slot !== 'string' || !(WEAR_SLOTS as readonly string[]).includes(slot)) return false;
    const s = slot as WearSlot;
    const sid = id === null ? null : typeof id === 'string' ? id : undefined;
    if (sid === undefined) return false;
    if (p.inCombat()) {
      this.log('เปลี่ยนสกิลระหว่างต่อสู้ไม่ได้', '#ff8a6a', p.id);
      return false;
    }
    const why = wearBlock(p.cls.id, p.skillBook, s, sid);
    if (why) {
      this.log(why, '#ff8a6a', p.id);
      return false;
    }
    wear(p.skillBook, s, sid);
    p.recompute();
    this.events.push({ t: 'save', to: p.id });
    return true;
  }

  setLootFilter(p: Player, f: LootFilter): void {
    const pots = lootPots(f);
    p.lootFilter = { rarities: [...f.rarities], potions: pots.hp.length + pots.mp.length > 0, pots };
    this.events.push({ t: 'save', to: p.id });
  }

  moveInBag(p: Player, from: number, to: number): void {
    p.moveInBag(from, to);
    this.afterChange(p);
  }

  /** Shift+drag in the bag: moves `n` of the stack in slot `from` onto slot `to` (empty, or the same stack with room). */
  splitInBag(p: Player, from: number, to: number, n: number): boolean {
    if (!p.alive || p.tabAt(to) !== 'use' || !splitInto(p.bag, from, p.bag, to, n)) return false;
    this.afterChange(p);
    return true;
  }

  sortBag(p: Player, key: SortKey, desc: boolean): void {
    p.sortBag(key, desc);
    this.afterChange(p);
  }

  /**
   * Buys the next `step` slots of a bag tab with gold (bagTabs.ts nextExpand; off until the owner opens it in /admin).
   * `price` is what the player saw: refused if it no longer matches. The crystal way is the server's (it needs the DB).
   */
  bagExpandGold(p: Player, tab: BagTab, price: number): boolean {
    const cfg = currentBalance().bagExpand;
    const next = nextExpand(cfg, p.bagSlots, tab);
    if (typeof next === 'string' || !cfg.gold) {
      this.log(typeof next === 'string' ? next : 'ขยายช่องด้วยทองไม่ได้ตอนนี้', '#ff8a6a', p.id);
      return false;
    }
    if (next.gold !== price) {
      this.log('ราคาเปลี่ยนแล้ว ลองอีกครั้ง', '#ff8a6a', p.id);
      return false;
    }
    if (p.gold < next.gold) {
      this.log(`ทองไม่พอ — ต้องใช้ ${next.gold.toLocaleString()} G`, '#ff8a6a', p.id);
      return false;
    }
    p.gold -= next.gold;
    p.growTab(tab, next.add);
    this.log(`ขยาย${TAB_NAME[tab]}เป็น ${p.bagSlots[tab]} ช่อง (${next.gold.toLocaleString()} G)`, '#f2c230', p.id);
    this.sfx('trade', p.x, p.z, p.id);
    this.afterChange(p);
    return true;
  }

  buyPotion(p: Player, kind: PotionKind, size: PotionSize, n: number): boolean {
    if (!this.near(p, 'merchant') || n <= 0) return false;
    const cost = potionPrice(kind, size) * n;
    if (p.gold < cost) {
      this.log('ทองไม่พอ', '#ff8a6a', p.id);
      return false;
    }
    if (!p.addPotions(kind, size, n)) {
      this.log('ช่องประเภทใช้งานเต็ม — ยาช่องละไม่เกิน 10 ขวด', '#ff8a6a', p.id);
      return false;
    }
    p.gold -= cost;
    this.log(`ซื้อ${potionName(kind, size)} × ${n} (−${cost} G)`, '#f2c230', p.id);
    this.tutTask(p, 'buyPotion');
    this.sfx('trade', p.x, p.z, p.id);
    this.afterChange(p);
    return true;
  }

  /** Phoenix feathers from the merchant. */
  buyPhoenix(p: Player, n: number): boolean {
    if (!this.near(p, 'merchant') || !Number.isInteger(n) || n <= 0) return false;
    const cost = PHOENIX_PRICE * n;
    if (p.gold < cost) {
      this.log('ทองไม่พอ', '#ff8a6a', p.id);
      return false;
    }
    if (!p.addStones('phoenix', n)) {
      this.log(`ช่องประเภทใช้งานเต็ม — ${STONE_NAME.phoenix}ช่องละไม่เกิน ${STONE_STACK} อัน`, '#ff8a6a', p.id);
      return false;
    }
    p.gold -= cost;
    this.log(`ซื้อ${STONE_NAME.phoenix} × ${n} (−${cost.toLocaleString()} G)`, '#f2c230', p.id);
    this.sfx('trade', p.x, p.z, p.id);
    this.afterChange(p);
    return true;
  }

  // ------------------------------------------------------------ getting up again in a boss room

  /** Revives used in this room, by character name (a name is one character). */
  private readonly revivesUsed = new Map<string, number>();

  /** How many more times this player may get up here: 3 per key put in, less those used (0 outside rooms). */
  revivesLeft(p: Player): number {
    if (!this.zone.roomOf && !this.waveRun) return 0;
    return Math.max(0, REVIVES_PER_KEY * this.keys - (this.revivesUsed.get(p.name) ?? 0));
  }

  /** Gets up where they fell with half HP and MP, for one phoenix feather (owner). */
  reviveHere(p: Player): boolean {
    if (p.alive || (!this.zone.roomOf && !this.waveRun) || this.revivesLeft(p) <= 0) return false;
    if (!p.takeStones('phoenix', 1)) {
      this.log(`ไม่มี${STONE_NAME.phoenix} — ซื้อได้ที่พ่อค้าในเมือง`, '#ff8a6a', p.id);
      return false;
    }
    this.revivesUsed.set(p.name, (this.revivesUsed.get(p.name) ?? 0) + 1);
    p.alive = true;
    p.hp = Math.max(1, Math.round(p.maxHp / 2));
    p.mp = Math.round(p.stats.maxMp / 2);
    p.stunT = 0;
    p.kbx = p.kbz = 0;
    // Untouchable for a moment, until it attacks or uses a skill (owner 2026-11-20).
    const bal = currentBalance();
    p.guardT = bal.reviveGuard ? bal.reviveGuardSec : 0;
    this.fx('burst', p.x, 1, p.z, '#ff9a3a', 24, 4);
    this.events.push({ t: 'revived', id: p.id });
    this.log(`ใช้${STONE_NAME.phoenix} ฟื้นขึ้นมา (ชุบได้อีก ${this.revivesLeft(p)} ครั้ง)`, '#ff9a3a', p.id);
    this.events.push({ t: 'save', to: p.id });
    return true;
  }

  /** Buys `n` return scrolls from the merchant (all of them or none). */
  buyReturnScroll(p: Player, n: number): boolean {
    if (!this.near(p, 'merchant') || n <= 0) return false;
    const cost = RETURN_SCROLL_PRICE * n;
    if (p.gold < cost) {
      this.log('ทองไม่พอ', '#ff8a6a', p.id);
      return false;
    }
    if (!p.addStones('return_scroll', n)) {
      this.log(`ช่องประเภทใช้งานเต็ม — ${STONE_NAME.return_scroll}ช่องละไม่เกิน ${STONE_STACK} ม้วน`, '#ff8a6a', p.id);
      return false;
    }
    p.gold -= cost;
    this.log(`ซื้อ${STONE_NAME.return_scroll} × ${n} (−${cost.toLocaleString()} G)`, '#f2c230', p.id);
    this.tutTask(p, 'buyScroll');
    this.sfx('trade', p.x, p.z, p.id);
    this.afterChange(p);
    return true;
  }


  /** Buys back item `i` of the buyback list. `uid` must match, so a stale click can't buy the wrong item. */
  buyBack(p: Player, i: number, uid: string): boolean {
    const e = p.buyback[i];
    if (!e || e.item.uid !== uid || !this.near(p, 'merchant')) return false;
    const price = buybackPrice(e);
    if (p.gold < price) {
      this.log('ทองไม่พอ', '#ff8a6a', p.id);
      return false;
    }
    if (!p.hasBagSpace('gear')) {
      this.log('กระเป๋าเต็ม', '#ff8a6a', p.id);
      return false;
    }
    p.gold -= price;
    p.buyback.splice(i, 1);
    p.addToBag(e.item);
    this.log(`ซื้อคืน ${entryName(e.item)} ${price} G`, '#f2c230', p.id);
    this.sfx('trade', p.x, p.z, p.id);
    this.afterChange(p);
    return true;
  }

  /** Counts down each player's buyback list and clears it every BUYBACK_RESET seconds of play. */
  private tickBuyback(p: Player, dt: number): void {
    p.buybackLeft -= dt;
    if (p.buybackLeft > 0) return;
    p.buybackLeft = BUYBACK_RESET;
    if (!p.buyback.length) return;
    p.buyback = [];
    this.log('พ่อค้าเคลียร์ของที่รับซื้อไว้แล้ว — ซื้อคืนไม่ได้อีก', '#b9b09a', p.id);
    this.afterChange(p);
  }

  /** Sells bag slot `i`. For a potion/stone stack, `n` (1 to count) sells only that many; omitted = the whole slot. */
  sellItem(p: Player, i: number, n?: number): number {
    const item = p.bag[i];
    if (!item || !this.near(p, 'merchant')) return 0;
    if (isBound(item)) return this.refuseBound(p), 0;
    if (isStone(item) && isOrbStone(item.stone)) return this.log('พ่อค้าไม่รับซื้อลูกแก้ว — เทรดหรือลงขายในตลาดแทน', '#ff8a6a', p.id), 0;
    if (n !== undefined && (!isStack(item) || !Number.isInteger(n) || n < 1 || n > item.count)) return 0;
    const part = n !== undefined && isStack(item) && n < item.count ? n : undefined;
    const name = entryName(part ? { ...item, count: part } : item);
    const v = p.sell(i, part);
    this.log(`ขาย ${name} ได้ ${v} G`, '#f2c230', p.id);
    this.tutTask(p, 'sell');
    this.sfx('trade', p.x, p.z, p.id);
    this.afterChange(p);
    return v;
  }

  /** Sells every bag item of this rarity. Enhanced (+N) items are kept. */
  sellAllOfRarity(p: Player, rarity: Rarity): number {
    if (!this.near(p, 'merchant')) return 0;
    let n = 0;
    let total = 0;
    p.bag.forEach((it, i) => {
      if (isBulkSellable(it, rarity)) {
        total += p.sell(i);
        n++;
      }
    });
    if (!n) {
      this.log(`ไม่มีของระดับ${RARITY_LABEL[rarity]}ในกระเป๋า (ของที่ตีบวกแล้วจะไม่ถูกขาย)`, '#b9b09a', p.id);
      return 0;
    }
    this.log(`ขายของระดับ${RARITY_LABEL[rarity]} ${n} ชิ้น ได้ ${total} G`, '#f2c230', p.id);
    this.tutTask(p, 'sell');
    this.sfx('trade', p.x, p.z, p.id);
    this.afterChange(p);
    return total;
  }

  // ------------------------------------------------------------ stash (warehouse keeper)

  /**
   * Bag slot `bagI` into the stash. `to` = a stash slot (drag & drop: empty → put, same potion → merge,
   * anything else → swap places), or -1 to put it wherever it fits (potions top up stacks first; what
   * doesn't fit stays in the bag).
   */
  stashPut(p: Player, bagI: number, to = -1): boolean {
    const st = p.stash;
    if (!this.near(p, 'keeper') || !validSlot(bagI, p.bag.length) || (to !== -1 && !validSlot(to, st.size))) return false;
    if (!p.bag[bagI]) return false;
    if (isBound(p.bag[bagI])) return this.refuseBound(p);
    // A swap brings the stash entry back into this bag slot: only if it belongs in this tab.
    const back = to === -1 ? null : st.items[to];
    if (back && !sameStack(p.bag[bagI], back) && p.tabAt(bagI) !== tabOf(back)) return false;
    const ok = to === -1 ? fillInto(p.bag, bagI, st.items) : dropOnto(p.bag, bagI, st.items, to);
    if (!ok) {
      this.log('คลังเต็ม', '#ff8a6a', p.id);
      return false;
    }
    this.tutTask(p, 'stashItem');
    this.afterStash(p);
    return true;
  }

  /** Stash slot `i` into the bag: onto bag slot `to`, or -1 for wherever it fits. */
  stashTake(p: Player, i: number, to = -1): boolean {
    const st = p.stash;
    if (!this.near(p, 'keeper') || !validSlot(i, st.size) || (to !== -1 && !validSlot(to, p.bag.length))) return false;
    const a = st.items[i];
    if (!a) return false;
    // Onto a bag slot: only one of the tab it belongs in (a swap sends the bag entry to the stash, which takes anything).
    if (to !== -1 && p.tabAt(to) !== tabOf(a)) return false;
    const ok = to === -1 ? fillInto(st.items, i, p.bag, p.bagSlots) : dropOnto(st.items, i, p.bag, to);
    if (!ok) {
      this.log(TAB_FULL[tabOf(a)], '#ff8a6a', p.id);
      return false;
    }
    this.afterStash(p);
    return true;
  }

  /** Drag & drop inside the stash (swap, or merge the same potion). */
  stashMove(p: Player, from: number, to: number): boolean {
    const st = p.stash;
    if (!this.near(p, 'keeper') || !validSlot(from, st.size) || !validSlot(to, st.size) || from === to) return false;
    if (!st.items[from] || !dropOnto(st.items, from, st.items, to)) return false;
    this.afterStash(p);
    return true;
  }

  /** Shift+drag between bag and stash (either way) or inside the stash: moves `n` of a stack onto an empty or mergeable slot. */
  stashSplit(p: Player, from: 'bag' | 'stash', i: number, to: 'bag' | 'stash', j: number, n: number): boolean {
    if (!this.near(p, 'keeper')) return false;
    const list = (w: 'bag' | 'stash') => (w === 'bag' ? p.bag : w === 'stash' ? p.stash.items : null);
    const a = list(from);
    const b = list(to);
    if (!a || !b) return false;
    if (from === 'bag' && to === 'stash' && isBound(a[i])) return this.refuseBound(p);
    if (to === 'bag' && p.tabAt(j) !== 'use') return false;
    if (!splitInto(a, i, b, j, n)) return false;
    if (from === 'bag' && to === 'stash') this.tutTask(p, 'stashItem');
    this.afterStash(p);
    return true;
  }

  stashSort(p: Player, key: SortKey, desc: boolean): boolean {
    if (!this.near(p, 'keeper')) return false;
    p.stash.items = sortEntries(p.stash.items, key, desc);
    this.afterStash(p);
    return true;
  }

  /** Buys the next row of STASH_ROW slots. */
  stashBuyRow(p: Player): boolean {
    const st = p.stash;
    if (!this.near(p, 'keeper')) return false;
    const price = nextRowPrice(st);
    if (price === null) return false;
    if (p.gold < price) {
      this.log(`ทองไม่พอ — ต้องใช้ ${price.toLocaleString()} G`, '#ff8a6a', p.id);
      return false;
    }
    p.gold -= price;
    st.size += STASH_ROW;
    while (st.items.length < st.size) st.items.push(null);
    this.log(`ขยายคลังเป็น ${st.size} ช่อง (−${price.toLocaleString()} G)`, '#f2c230', p.id);
    this.sfx('trade', p.x, p.z, p.id);
    this.afterStash(p);
    return true;
  }

  /** Gold into the stash (amount > 0) or back out of it (amount < 0). */
  stashGold(p: Player, amount: number): boolean {
    const st = p.stash;
    if (!this.near(p, 'keeper') || !Number.isInteger(amount) || amount === 0) return false;
    if (amount > 0) {
      if (amount > p.gold) {
        this.log('ทองที่ถืออยู่ไม่พอ', '#ff8a6a', p.id);
        return false;
      }
      if (st.gold + amount > STASH_GOLD_MAX) return false;
      p.gold -= amount;
      st.gold += amount;
      this.log(`ฝากทอง ${amount.toLocaleString()} G`, '#f2c230', p.id);
      this.tutTask(p, 'stashGold');
    } else {
      const n = -amount;
      if (n > st.gold) {
        this.log('ทองในคลังไม่พอ', '#ff8a6a', p.id);
        return false;
      }
      st.gold -= n;
      p.gold += n;
      this.log(`ถอนทอง ${n.toLocaleString()} G`, '#f2c230', p.id);
    }
    this.sfx('pickup_gold', p.x, p.z, p.id);
    this.afterStash(p);
    return true;
  }

  /** The stash changed: refresh the bag and save the character (the stash is saved by whoever runs the Sim). */
  private afterStash(p: Player): void {
    this.events.push({ t: 'stash', to: p.id });
    this.afterChange(p);
  }

  /**
   * One enhancement attempt on gear the player owns (worn or in the bag). `protect` = use a protection
   * stone (only taken when a fail would drop the level). Gold, stones and the level are all checked here.
   */
  enhance(p: Player, uid: string, protect: boolean): { result: EnhanceResult; item: Item } | null {
    if (!this.near(p, 'blacksmith')) return null;
    if (this.time < p.forgeAt + forgeCd()) return null;
    const worn = Object.values(p.equipment).find((w) => w?.uid === uid);
    const item = worn ?? p.bag.find((w): w is Item => isItem(w) && w.uid === uid);
    if (!item || plusOf(item) >= maxPlus()) return null;
    const cost = enhanceCost(item);
    const stones = stonesNeeded(item);
    const useProtect = protect && dropsOnFail(item);
    if (p.gold < cost || p.stoneCount('enhance') < stones || (useProtect && p.stoneCount('protect') < 1)) return null;
    p.forgeAt = this.time;
    p.gold -= cost;
    p.takeStones('enhance', stones);
    if (useProtect) p.takeStones('protect', 1);
    const result = rollEnhance(item, Math.random, useProtect);
    this.tutTask(p, 'enhance');
    if (worn) p.recompute();
    if (result === 'success') {
      this.log(`🔨 ตีบวกสำเร็จ → ${itemName(item)}`, '#ffd34a', p.id);
      this.fx('effect', 'enhance_ok', p.x, p.z, 0, 1.3);
      this.fx('burst', p.x, 1.2, p.z, '#ffd34a', 14, 3);
      this.text(p.x, p.topY + 0.6, p.z, `+${plusOf(item)} สำเร็จ!`, 'enh', 1.6);
      if (plusOf(item) >= announceFrom() || plusOf(item) >= bannerFrom()) {
        const text = `🔨 ${p.name} ตี${SLOT_LABEL[item.slot]} ${item.name} เป็น +${plusOf(item)} สำเร็จ!`;
        this.events.push({ t: 'announce', text, ...(plusOf(item) >= bannerFrom() ? { banner: '🔨 ตีบวก' } : {}) });
      }
    } else {
      const why = result === 'drop' ? ` ระดับลดเหลือ +${plusOf(item)}` : result === 'saved' ? ' (หินกันระดับลดทำงาน ระดับเท่าเดิม)' : '';
      this.log(`🔨 ตีบวก ${itemName(item)} ล้มเหลว${why}`, '#ff8a6a', p.id);
      this.fx('effect', 'enhance_fail', p.x, p.z, 0, 1.1);
      this.text(p.x, p.topY + 0.6, p.z, result === 'drop' ? `ล้มเหลว +${plusOf(item)}` : 'ล้มเหลว', 'enhfail', 1.4);
    }
    this.sfx(result === 'success' ? 'enhance_ok' : 'enhance_fail', p.x, p.z, p.id);
    this.afterChange(p);
    return { result, item };
  }

  /**
   * A blacksmith reroll on gear the player owns (worn or in the bag, never the stash): `values` rerolls
   * every line inside its tier, `stat` turns one extra line into a new stat (see rerollStat). Gold is
   * checked and taken here, with one stone of the reroll's kind. Returns the changed item, or null if nothing happened.
   */
  reroll(p: Player, uid: string, kind: RerollKind): Item | null {
    if (!this.near(p, 'blacksmith')) return null;
    if (this.time < p.forgeAt + forgeCd()) return null;
    const worn = Object.values(p.equipment).find((w) => w?.uid === uid);
    const item = worn ?? p.bag.find((w): w is Item => isItem(w) && w.uid === uid);
    if (!item || !lineRanges(item)) return null;
    const cost = rerollCost(item, kind);
    const stone = REROLL_STONE[kind];
    if (p.gold < cost || p.stoneCount(stone) < 1) return null;
    p.forgeAt = this.time;
    p.gold -= cost;
    p.takeStones(stone, 1);
    if (kind === 'values') rerollValues(item);
    else rerollStat(item);
    this.tutTask(p, kind === 'values' ? 'rerollValues' : 'rerollStat');
    if (worn) p.recompute();
    this.log(`🔨 ${REROLL_NAME[kind]} ${itemName(item)} (−${cost.toLocaleString()} G)`, '#c9a8ff', p.id);
    this.fx('burst', p.x, 1.2, p.z, '#c9a8ff', 12, 2.5);
    this.sfx('enhance_ok', p.x, p.z, p.id);
    this.afterChange(p);
    return item;
  }

  // ------------------------------------------------------------ frame

  /** Advances the world. `intentOf` supplies each living player's input for this frame. */
  step(dt: number, intentOf: (p: Player) => Intent = () => IDLE_INTENT): void {
    this.time += dt;

    for (let t = this.timers.length - 1; t >= 0; t--) {
      if (this.time >= this.timers[t].at) {
        const fn = this.timers[t].fn;
        this.timers.splice(t, 1);
        fn();
      }
    }

    for (const p of this.players) {
      if (!p.alive) continue;
      const it = intentOf(p);
      if (it.recall) this.startReturnCast(p);
      p.update(dt, it);
      this.tickReturnCast(p, dt, it);
      this.tickMount(p);
    }
    for (const p of this.players) {
      this.tickBuyback(p, dt);
      this.tickBuffs(p, dt);
    }
    for (const p of this.players) if (p.alive) this.checkPortals(p);
    if (this.zone.lavaPools) for (const p of this.players) if (p.alive) this.tickLava(p, dt);

    for (const m of this.monsters) m.update(dt, this);
    this.separateMonsters();
    if (this.zone.safe) this.keepOutOfSafe(this.zone.safe);
    // Before dead monsters leave the list: a seed whose host died bursts and jumps.
    tickHexSeeds(this);
    this.monsters = this.monsters.filter((m) => !m.gone && (m.alive || m.deadT <= 0.9));
    this.tickVanished(dt);

    for (const pr of this.projectiles) pr.update(dt);
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
    for (const l of this.loots) l.update(dt, this);
    this.loots = this.loots.filter((l) => !l.dead);

    for (const sp of this.spawners) {
      const want = this.wanted(sp);
      // The pack multiplier went up (/admin): the extra monsters come in on the spot's respawn timer.
      if (!this.zone.roomOf) {
        while (sp.alive + sp.queue.length < want) sp.queue.push(this.time + rand(Math.random, sp.area.respawn[0], sp.area.respawn[1]));
      }
      sp.queue.sort((a, b) => a - b);
      // It went down: the extra ones are simply not replaced.
      if (sp.queue.length > Math.max(0, want - sp.alive)) sp.queue.length = Math.max(0, want - sp.alive);
      while (sp.queue.length && sp.queue[0] <= this.time && sp.alive < want) {
        sp.queue.shift();
        this.spawnMonster(sp);
        if (sp.boss && this.bossAt !== null) this.bossArrives(sp.area);
      }
    }
    if (this.waveRun) this.tickWaves();
  }

  // ------------------------------------------------------------ minigame "รอดมอนเป็นระลอก"

  /** Monsters of the wave on now still standing. */
  waveLeft(): number {
    const w = this.waveRun;
    if (!w) return 0;
    let n = 0;
    for (const m of this.monsters) if (m.alive && w.ids.has(m.id)) n++;
    return n;
  }

  private tickWaves(): void {
    const w = this.waveRun!;
    if (w.won || !this.players.length) return;
    if (w.nextAt !== null) {
      if (this.time >= w.nextAt) {
        w.nextAt = null;
        this.startWave(w.wave + 1);
      }
      return;
    }
    if (w.wave === 0 || this.waveLeft() > 0) return;
    // The wave fell: gold for it to everyone in the room (alive or not), then a rest or the win.
    w.ids.clear();
    const gold = w.cfg.goldPerWave * w.wave;
    for (const p of this.players) {
      if (gold > 0) p.gold += gold;
      this.events.push({ t: 'save', to: p.id });
    }
    this.log(`✔ ผ่านระลอก ${w.wave}/${w.cfg.waves}${gold > 0 ? ` · ได้ ${gold.toLocaleString()} G` : ''}`, '#ffcf5a');
    if (w.wave < w.cfg.waves) {
      w.nextAt = this.time + w.cfg.rest;
      return;
    }
    w.won = true;
    this.cleared = true;
    for (const p of this.players) {
      if (w.cfg.bonusGold > 0) p.gold += w.cfg.bonusGold;
      if (w.cfg.bonusExp > 0) this.addExp(p, w.cfg.bonusExp);
      this.events.push({ t: 'save', to: p.id });
    }
    this.log(`🏆 รอดครบ ${w.cfg.waves} ระลอก! โบนัส ${w.cfg.bonusGold.toLocaleString()} G + ${w.cfg.bonusExp.toLocaleString()} EXP`, '#ffcf5a');
    const s = this.zone.start;
    this.events.push({ t: 'banner', text: 'รอดครบทุกระลอก!', sub: this.zone.nameTh, x: s.x, z: s.z });
  }

  /** Wave `n` comes out of the map's wave spots (none drawn: around the start), each monster of a random picked kind. */
  private startWave(n: number): void {
    const w = this.waveRun!;
    const z = this.zone.waves!;
    w.wave = n;
    const kinds = z.monsters.filter((id) => MONSTERS[id] && MONSTERS[id].behavior !== 'boss');
    if (!kinds.length) kinds.push('green_slime');
    const spots = z.spots.length ? z.spots : [{ x: this.zone.start.x, z: this.zone.start.z, radius: 8 }];
    // Every wave monster goes for any player on the map, stronger each wave.
    const boost: MonsterBoost = { stats: waveStats(w.cfg, n), speed: 1, aggro: 60 };
    const count = waveCount(w.cfg, n);
    const r = Math.random;
    for (let i = 0; i < count; i++) {
      const spot = spots[i % spots.length];
      const def = MONSTERS[pick(r, kinds)];
      const area: SpawnArea = { monster: def.id, x: spot.x, z: spot.z, radius: Math.max(0.5, spot.radius), count: 1, respawn: [3600, 3600] };
      let x = spot.x, zz = spot.z;
      for (let t = 0; t < 12; t++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * area.radius;
        x = spot.x + Math.cos(a) * d;
        zz = spot.z + Math.sin(a) * d;
        if (!this.terrain.isBlocked(x, zz, def.radius)) break;
      }
      const m = new Monster(this.newId(), def, randInt(r, def.levels[0], def.levels[1]), area, x, zz, boost);
      m.hunter = true;
      this.monsters.push(m);
      w.ids.add(m.id);
      this.fx('burst', x, 1, zz, '#ff9a3a', 10, 2);
    }
    const s = spots[0];
    this.events.push({ t: 'banner', text: `ระลอก ${n}/${w.cfg.waves}`, sub: `มอน ${count} ตัว`, x: s.x, z: s.z });
  }

  /** The countdown ran out: the boss rises in the middle of the arena. */
  private bossArrives(area: SpawnArea): void {
    this.bossAt = null;
    const def = MONSTERS[area.monster];
    const name = def.nameTh.replace(/ (.*)$/, '');
    this.events.push({ t: 'banner', text: `${name} ปรากฏตัว!`, sub: this.zone.nameTh, x: area.x, z: area.z });
    this.fx('burst', area.x, 1.5, area.z, '#ffcf5a', 30, 6);
    this.shake(0.4, area);
    this.sfx('boss_slam', area.x, area.z);
    this.sfx('boss_appear', area.x, area.z);
  }

  /**
   * Leaving a boss room by its button (owner 2026-11-12: no portal, only the button): once the boss is
   * dead, from anywhere in the room. Comes out by the map's summoner. Returns why not, or null when on the way.
   */
  leaveRoom(p: Player): string | null {
    if (this.waveRun && this.exitTo) {
      // A wave run may be left at any time (its button), alive.
      if (!p.alive) return 'ตายอยู่';
      this.events.push({ t: 'travel', to: p.id, zone: this.exitTo.field, spot: { x: this.exitTo.x, z: this.exitTo.z } });
      return null;
    }
    const spot = lairExitSpot(this.zone);
    if (!this.zone.roomOf || !spot) return 'ไม่ได้อยู่ในห้องบอส';
    if (!p.alive) return 'ตายอยู่';
    if (!this.cleared) {
      this.log('ออกได้เมื่อปราบบอสแล้ว', '#ff9a6a', p.id);
      return 'ออกได้เมื่อปราบบอสแล้ว';
    }
    this.fx('burst', p.x, 1.4, p.z, '#6affd0', 18, 3);
    this.events.push({ t: 'travel', to: p.id, zone: spot.field, spot: { x: spot.x, z: spot.z } });
    return null;
  }

  private checkPortals(p: Player): void {
    for (const pt of this.zone.portals) {
      const d = Math.hypot(p.x - pt.x, p.z - pt.z);
      if (d > PORTAL_RANGE) {
        if (d > PORTAL_RANGE + 1.5) p.portalReady = true;
        continue;
      }
      if (!p.portalReady) continue;
      const dest = ZONES[pt.to];
      if (!dest) continue;
      if (p.level < pt.minLevel) {
        if (this.time - p.portalMsgAt > 3) {
          p.portalMsgAt = this.time;
          this.log(`ประตูสู่ ${dest.name} ยังไม่เปิดให้คุณ — ต้อง Lv.${pt.minLevel} ขึ้นไป`, '#ff9a6a', p.id);
          this.text(p.x, p.topY, p.z, `ต้อง Lv.${pt.minLevel}`, 'info', 1);
        }
        continue;
      }
      p.portalReady = false;
      this.fx('burst', pt.x, 1.4, pt.z, '#6affd0', 18, 3);
      this.events.push({ t: 'travel', to: p.id, zone: dest.id });
      return;
    }
  }

  /** Monsters can't walk (or be pushed) into the safe area, and stop chasing whoever is inside it. */
  private keepOutOfSafe(safe: SafeArea): void {
    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (m.target && this.inSafe(m.target)) m.dropTarget();
      const dx = m.x - safe.x;
      const dz = m.z - safe.z;
      const min = safe.half + m.radius;
      if (Math.abs(dx) >= min || Math.abs(dz) >= min) continue;
      // Out through the nearest side.
      if (Math.abs(dx) > Math.abs(dz)) m.x = safe.x + Math.sign(dx || 1) * min;
      else m.z = safe.z + Math.sign(dz || 1) * min;
    }
  }

  private separateMonsters(): void {
    const ms = this.monsters;
    for (let a = 0; a < ms.length; a++) {
      const m = ms[a];
      if (!m.alive) continue;
      for (let b = a + 1; b < ms.length; b++) {
        const n = ms[b];
        if (!n.alive) continue;
        const dx = n.x - m.x;
        const dz = n.z - m.z;
        const min = m.radius + n.radius;
        if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
        const d = Math.hypot(dx, dz) || 0.01;
        if (d < min) {
          const push = (min - d) / d / 2;
          m.x -= dx * push;
          m.z -= dz * push;
          n.x += dx * push;
          n.z += dz * push;
        }
      }
      for (const p of this.players) {
        if (!p.alive || p.isDashing) continue;
        const dx = m.x - p.x;
        const dz = m.z - p.z;
        const min = m.radius + p.radius;
        const d = Math.hypot(dx, dz) || 0.01;
        if (d < min) {
          m.x += (dx / d) * (min - d);
          m.z += (dz / d) * (min - d);
        }
      }
    }
  }
}
