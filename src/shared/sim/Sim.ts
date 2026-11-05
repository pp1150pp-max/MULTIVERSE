// The game rules, with no rendering. Singleplayer runs one of these in the browser; the online
// server will run one per zone. Whoever drives it calls step() every frame and reads drainEvents()
// to show effects, damage numbers and messages.
import { ZONES, type ZoneDef, type SpawnArea } from '../data/zones';
import { MONSTERS } from '../data/monsters';
import { expGapMult, expToNext, mitigate, MAX_LEVEL } from '../formulas';
import { rollItem } from '../data/items';
import { enhanceCost, itemName, MAX_PLUS, plusOf, rollEnhance, type EnhanceResult } from '../data/enhance';
import { entryName, potionName, POTION_STACK, POTIONS } from '../data/potions';
import { NPC_USE_RANGE, type NpcId } from '../data/npcs';
import { pick, rand, randInt } from '../rng';
import { CLASS_IDS } from '../data/classes';
import { isPotion, RARITY_LABEL, type BagEntry, type Item, type PotionKind, type PotionSize, type Rarity } from '../types';
import { PORTAL_RANGE, Terrain } from './terrain';
import {
  BUYBACK_RESET, buybackPrice, cleanAutoSettings, lootPots, Player, sortEntries,
  type AutoSettings, type CharacterData, type LootFilter, type SortKey,
} from './Player';
import { Monster } from './Monster';
import { Projectile, type ProjOpts } from './Projectile';
import { Loot, LOOT_PRIORITY_TIME, type LootKind } from './Loot';
import { nextRowPrice, STASH_GOLD_MAX, STASH_ROW } from './stash';
import { IDLE_INTENT, type FxApi, type FxName, type HitOpts, type Intent, type SfxName, type SimEvent } from './types';

/** Gear of this rarity that "sell all" may take: never potions or enhanced items. */
/** Seconds of warning before a freshly summoned minion pounces. */
const MINION_POUNCE_WINDUP = 0.35;

export function isBulkSellable(e: BagEntry | null, rarity: Rarity): e is Item {
  return !!e && !isPotion(e) && e.rarity === rarity && !plusOf(e);
}

function validSlot(i: number, len: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < len;
}

function samePotion(a: BagEntry | null, b: BagEntry | null): boolean {
  return isPotion(a) && isPotion(b) && a.potion === b.potion && a.size === b.size;
}

/**
 * Moves src[i] onto dst[j] (src and dst may be the same list): empty → moves, the same potion → merges
 * up to a full stack (the rest stays behind), anything else → the two swap places.
 */
function dropOnto(src: (BagEntry | null)[], i: number, dst: (BagEntry | null)[], j: number): boolean {
  if (src === dst && i === j) return false;
  const a = src[i];
  const b = dst[j];
  if (!a) return false;
  if (isPotion(a) && isPotion(b) && samePotion(a, b)) {
    const n = Math.min(a.count, POTION_STACK - b.count);
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
 * Moves src[i] into dst wherever it fits. Potions top up matching stacks first, then fill an empty slot;
 * if only part fits, that part moves. Returns false when nothing moved.
 */
function fillInto(src: (BagEntry | null)[], i: number, dst: (BagEntry | null)[]): boolean {
  const a = src[i];
  if (!a) return false;
  if (isPotion(a)) {
    const before = a.count;
    for (const e of dst) {
      if (a.count <= 0) break;
      if (e !== a && isPotion(e) && samePotion(a, e) && e.count < POTION_STACK) {
        const n = Math.min(a.count, POTION_STACK - e.count);
        e.count += n;
        a.count -= n;
      }
    }
    if (a.count > 0) {
      const k = dst.indexOf(null);
      if (k >= 0) {
        dst[k] = { ...a };
        a.count = 0;
      }
    }
    if (a.count <= 0) src[i] = null;
    return a.count < before;
  }
  const k = dst.indexOf(null);
  if (k < 0) return false;
  dst[k] = a;
  src[i] = null;
  return true;
}

interface Spawner { area: SpawnArea; alive: number; queue: number[]; boss: boolean }

export class Sim {
  readonly terrain: Terrain;
  players: Player[] = [];
  monsters: Monster[] = [];
  projectiles: Projectile[] = [];
  loots: Loot[] = [];
  time = 0;
  private events: SimEvent[] = [];
  private nextId = 1;
  private readonly spawners: Spawner[] = [];
  private timers: { at: number; fn: () => void }[] = [];

  constructor(readonly zone: ZoneDef) {
    this.terrain = new Terrain(zone);
    for (const area of zone.spawns) this.spawners.push({ area, alive: 0, queue: [], boss: false });
    this.spawners.push({ area: zone.boss, alive: 0, queue: [], boss: true });
    for (const sp of this.spawners) for (let i = 0; i < sp.area.count; i++) this.spawnMonster(sp);
  }

  private newId(): number {
    return this.nextId++;
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
      p.x = this.zone.start.x - 2;
      p.z = this.zone.start.z - 2;
    }
    this.players.push(p);
    return p;
  }

  removePlayer(p: Player): void {
    this.players = this.players.filter((x) => x !== p);
    for (const m of this.monsters) if (m.target === p) m.calm();
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

  shake(amount: number): void {
    this.events.push({ t: 'shake', amount });
  }

  sfx(name: SfxName, x: number, z: number, to?: number): void {
    this.events.push({ t: 'sfx', name, x, z, to });
  }

  log(msg: string, color?: string, to?: number): void {
    this.events.push({ t: 'log', msg, color, to });
  }

  anim(id: number, name: string, opts: { duration?: number; fallback?: 'attack' } = {}): void {
    this.events.push({ t: 'anim', id, name, ...opts });
  }

  schedule(delay: number, fn: () => void): void {
    this.timers.push({ at: this.time + delay, fn });
  }

  addProjectile(owner: Player, o: ProjOpts): void {
    this.projectiles.push(new Projectile(this.newId(), this, owner, o));
  }

  // ------------------------------------------------------------ spawning

  private spawnMonster(sp: Spawner): void {
    const def = MONSTERS[sp.area.monster];
    const r = Math.random;
    let x = sp.area.x;
    let z = sp.area.z;
    for (let tries = 0; tries < 12; tries++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * sp.area.radius;
      x = sp.area.x + Math.cos(a) * d;
      z = sp.area.z + Math.sin(a) * d;
      if (!this.terrain.isBlocked(x, z, def.radius)) break;
    }
    this.monsters.push(new Monster(this.newId(), def, randInt(r, def.levels[0], def.levels[1]), sp.area, x, z));
    sp.alive++;
    if (sp.boss && this.time > 1) this.log(`⚠ ${def.name} ปรากฏตัวที่ส่วนลึกของ${this.zone.nameTh}!`, '#ff9a6a');
  }

  // ------------------------------------------------------------ combat

  hitMonster(p: Player, m: Monster, mult: number, opts: HitOpts = {}): void {
    if (!m.alive) return;
    let raw = p.stats.atk * mult * (0.9 + Math.random() * 0.2);
    const crit = Math.random() * 100 < p.stats.crit;
    if (crit) raw *= 1 + p.stats.critDmg / 100;
    const dmg = Math.round(mitigate(raw, m.defense));
    m.damageBy.set(p.id, (m.damageBy.get(p.id) ?? 0) + Math.min(dmg, Math.max(0, m.hp)));
    m.hp -= dmg;
    this.events.push({ t: 'flash', id: m.id });
    this.text(m.x, m.topY, m.z, crit ? `${dmg}!` : String(dmg), crit ? 'crit' : 'dmg');
    if (crit) this.sfx('crit', m.x, m.z);
    if (opts.kb && !m.isBoss) m.knockback(opts.fromX ?? p.x, opts.fromZ ?? p.z, opts.kb);
    if (opts.stun) m.stunT = Math.max(m.stunT, m.isBoss ? opts.stun * 0.3 : opts.stun);
    if (opts.slow) {
      m.slowAmt = opts.slow;
      m.slowT = opts.slowT ?? 2;
    }
    m.onHit(this, p);
    if (m.hp <= 0) this.killMonster(m);
  }

  hitPlayer(m: Monster, p: Player, mult: number, opts: HitOpts): void {
    if (!p.alive) return;
    if (p.invulnT > 0) {
      this.text(p.x, p.topY, p.z, 'MISS', 'info', 0.6);
      return;
    }
    const dmg = Math.round(mitigate(m.atk * mult * (0.9 + Math.random() * 0.2), p.stats.def));
    p.hp -= dmg;
    p.lastHurt = this.time;
    p.interruptPotions();
    if (m.isBoss) m.rampT = 0;
    this.events.push({ t: 'flash', id: p.id });
    this.anim(p.id, 'hit');
    this.text(p.x, p.topY, p.z, `-${dmg}`, 'hurt');
    if (opts.stun) p.stunT = Math.max(p.stunT, opts.stun);
    if (opts.kb) p.knockback(opts.fromX ?? m.x, opts.fromZ ?? m.z, opts.kb);
    if (p.hp <= 0) this.killPlayer(p);
  }

  onBossEnrage(m: Monster): void {
    this.text(m.x, m.topY + 0.6, m.z, 'ENRAGED!', 'crit', 1.6);
    this.log(
      m.def.frenzy
        ? `${m.def.name} คลั่งสุดขีด! เคลื่อนที่เร็วมากและออกท่าไวขึ้น`
        : `${m.def.name} คลั่ง! ความเร็วและการโจมตีเพิ่มขึ้น`,
      '#ff6a5a',
    );
    this.events.push({
      t: 'banner',
      text: `${m.def.nameTh.replace(/\s*\(.*\)/, '')} คลั่ง!`,
      sub: m.def.summon
        ? `เรียก${MONSTERS[m.def.summon.monster]?.nameTh ?? 'ลูกน้อง'}มาช่วย!`
        : m.def.frenzy ? 'เคลื่อนที่เร็วมากและออกท่าไวขึ้น' : 'ความเร็วและการโจมตีเพิ่มขึ้น',
      x: m.x,
      z: m.z,
    });
    this.shake(0.3);
    if (m.def.summon) this.summonMinions(m, m.def.summon.monster, m.def.summon.count);
  }

  /** Minions appear in a ring around the boss and go straight for its target. */
  private summonMinions(boss: Monster, monsterId: string, count: number): void {
    const def = MONSTERS[monsterId];
    if (!def) return;
    // Their own home spot (no spawner owns it), so they wander here after the fight and never respawn.
    const area: SpawnArea = { monster: monsterId, x: boss.x, z: boss.z, radius: 4, count: 0, respawn: [0, 0] };
    const r = Math.random;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r() * 0.5;
      let x = boss.x + Math.cos(a) * (boss.radius + 1.6);
      let z = boss.z + Math.sin(a) * (boss.radius + 1.6);
      if (this.terrain.isBlocked(x, z, def.radius)) {
        x = boss.x;
        z = boss.z;
      }
      const m = new Monster(this.newId(), def, randInt(r, def.levels[0], def.levels[1]), area, x, z);
      m.summoned = true;
      m.target = boss.target;
      m.aggroT = 12;
      m.state = 'chase';
      // They pounce at once, with only a short warning line.
      if (m.target?.alive) m.startCharge(this, m.target.x, m.target.z, MINION_POUNCE_WINDUP);
      this.monsters.push(m);
      this.fx('burst', x, 0.3, z, '#9fd98a', 10, 4);
    }
    this.log(`${boss.def.name} เรียก${def.nameTh} ${count} ตัวมาช่วย!`, '#ff9a6a');
  }

  private killMonster(m: Monster): void {
    m.alive = false;
    m.deadT = 0;
    m.hp = 0;
    this.sfx(m.isBoss ? 'boss_die' : 'monster_die', m.x, m.z);
    if (!m.summoned) {
      this.shareExp(m);
      this.dropLoot(m);
    }
    const sp = this.spawners.find((s) => s.area === m.area);
    if (sp) {
      sp.alive--;
      sp.queue.push(this.time + rand(Math.random, sp.area.respawn[0], sp.area.respawn[1]));
    }
    if (m.isBoss) {
      this.log(`🏆 ปราบ ${m.def.name} สำเร็จ!`, '#ffcf5a');
      this.shake(0.4);
    }
  }

  /** EXP is split by each player's share of the damage, then reduced for monsters far below their level. */
  private shareExp(m: Monster): void {
    let total = 0;
    for (const v of m.damageBy.values()) total += v;
    if (total <= 0) return;
    for (const [id, dealt] of m.damageBy) {
      const p = this.players.find((x) => x.id === id);
      if (!p || dealt <= 0) continue;
      const mult = expGapMult(p.level, m.level);
      const exp = Math.max(1, Math.round(m.expReward * (dealt / total) * mult));
      this.text(m.x, m.topY + 0.4, m.z, mult < 1 ? `+${exp} EXP (−${Math.round((1 - mult) * 100)}%)` : `+${exp} EXP`, 'exp', 1.1, p.id);
      if (mult < 1 && !p.lowExpHinted) {
        p.lowExpHinted = true;
        this.log('มอนสเตอร์ที่ชื่อเป็นสีเทาเลเวลต่ำกว่าคุณมาก ได้ EXP น้อยลง — ไปล่าตัวที่เลเวลสูงกว่านี้', '#b9b09a', p.id);
      }
      this.addExp(p, exp);
    }
  }

  private killPlayer(p: Player): void {
    p.alive = false;
    p.hp = 0;
    p.moving = false;
    this.events.push({ t: 'died', id: p.id });
  }

  respawn(p: Player): void {
    if (p.alive) return;
    const penalty = Math.floor(expToNext(p.level) * 0.1);
    p.exp = Math.max(0, p.exp - penalty);
    p.alive = true;
    p.hp = p.maxHp;
    p.mp = p.stats.maxMp;
    p.stunT = 0;
    p.kbx = p.kbz = 0;
    p.x = this.zone.start.x - 2;
    p.z = this.zone.start.z - 2;
    p.moveTarget = null;
    for (const m of this.monsters) if (m.target === p) m.calm();
    this.events.push({ t: 'revived', id: p.id });
    this.log(`ฟื้นคืนชีพที่แคมป์ (เสีย EXP ${penalty})`, '#ff9a6a', p.id);
    this.events.push({ t: 'save', to: p.id });
  }

  private addExp(p: Player, n: number): void {
    if (p.level >= MAX_LEVEL) return;
    p.exp += n;
    while (p.level < MAX_LEVEL && p.exp >= expToNext(p.level)) {
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
    // The top damage dealer gets first pick for a while, then anyone can take it.
    const owner = top?.id;
    const gold = Math.round(randInt(r, d.gold[0], d.gold[1]) * (1 + 0.1 * (m.level - d.levels[0])));
    this.spawnLoot(m, { type: 'gold', amount: gold }, owner);
    if (m.isBoss) {
      const n = randInt(r, 2, 3);
      for (let i = 0; i < n; i++) this.spawnLoot(m, { type: 'item', item: rollItem(r, m.level, anyClass(), 1.5) }, owner);
      this.spawnLoot(m, { type: 'potion', pot: 'hp', size: 's', count: 1 }, owner);
      this.spawnLoot(m, { type: 'potion', pot: 'mp', size: 's', count: 1 }, owner);
      return;
    }
    if (r() < d.itemChance) this.spawnLoot(m, { type: 'item', item: rollItem(r, m.level, anyClass()) }, owner);
    if (r() < d.potionChance) this.spawnLoot(m, { type: 'potion', pot: r() < 0.6 ? 'hp' : 'mp', size: 's', count: 1 }, owner);
  }

  private spawnLoot(m: Monster, kind: LootKind, owner?: number): void {
    const a = Math.random() * Math.PI * 2;
    const dist = 0.5 + Math.random() * (m.isBoss ? 2 : 1);
    this.loots.push(new Loot(this.newId(), m.x + Math.cos(a) * dist, m.z + Math.sin(a) * dist, m.x, m.z, kind, {
      owner, ownerUntil: this.time + LOOT_PRIORITY_TIME,
    }));
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
    } else {
      if (!p.addToBag(k.item)) return false;
      this.events.push({ t: 'item', to: p.id, item: k.item });
      this.sfx('pickup_item', p.x, p.z, p.id);
    }
    return true;
  }

  /** Throws a bag item on the ground next to the player. It disappears after a while. */
  dropFromBag(p: Player, i: number): boolean {
    const item = p.takeFromBag(i);
    if (!item) return false;
    const a = Math.random() * Math.PI * 2;
    const kind: LootKind = isPotion(item)
      ? { type: 'potion', pot: item.potion, size: item.size, count: item.count }
      : { type: 'item', item };
    this.loots.push(new Loot(this.newId(), p.x + Math.cos(a), p.z + Math.sin(a), p.x, p.z, kind, { dropped: true }));
    this.log(`วาง ${entryName(item)} ลงบนพื้น (เก็บคืนได้ภายใน 60 วินาที)`, '#b9b09a', p.id);
    this.afterChange(p);
    return true;
  }

  // ------------------------------------------------------------ NPC trades

  npcDistance(p: Player, id: NpcId): number {
    const n = this.terrain.npcPos[id];
    return Math.hypot(p.x - n.x, p.z - n.z);
  }

  /** Trades only work while standing next to that NPC. */
  private near(p: Player, id: NpcId): boolean {
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

  setLootFilter(p: Player, f: LootFilter): void {
    const pots = lootPots(f);
    p.lootFilter = { rarities: [...f.rarities], potions: pots.hp.length + pots.mp.length > 0, pots };
    this.events.push({ t: 'save', to: p.id });
  }

  moveInBag(p: Player, from: number, to: number): void {
    p.moveInBag(from, to);
    this.afterChange(p);
  }

  sortBag(p: Player, key: SortKey, desc: boolean): void {
    p.sortBag(key, desc);
    this.afterChange(p);
  }

  buyPotion(p: Player, kind: PotionKind, size: PotionSize, n: number): boolean {
    if (!this.near(p, 'merchant') || n <= 0) return false;
    const cost = POTIONS[kind][size].price * n;
    if (p.gold < cost) {
      this.log('ทองไม่พอ', '#ff8a6a', p.id);
      return false;
    }
    if (!p.addPotions(kind, size, n)) {
      this.log('กระเป๋าเต็ม — ยาช่องละไม่เกิน 10 ขวด', '#ff8a6a', p.id);
      return false;
    }
    p.gold -= cost;
    this.log(`ซื้อ${potionName(kind, size)} × ${n} (−${cost} G)`, '#f2c230', p.id);
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
    if (!p.hasBagSpace()) {
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

  sellItem(p: Player, i: number): number {
    const item = p.bag[i];
    if (!item || !this.near(p, 'merchant')) return 0;
    const name = entryName(item);
    const v = p.sell(i);
    this.log(`ขาย ${name} ได้ ${v} G`, '#f2c230', p.id);
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
    const ok = to === -1 ? fillInto(p.bag, bagI, st.items) : dropOnto(p.bag, bagI, st.items, to);
    if (!ok) {
      this.log('คลังเต็ม', '#ff8a6a', p.id);
      return false;
    }
    this.afterStash(p);
    return true;
  }

  /** Stash slot `i` into the bag: onto bag slot `to`, or -1 for wherever it fits. */
  stashTake(p: Player, i: number, to = -1): boolean {
    const st = p.stash;
    if (!this.near(p, 'keeper') || !validSlot(i, st.size) || (to !== -1 && !validSlot(to, p.bag.length))) return false;
    if (!st.items[i]) return false;
    const ok = to === -1 ? fillInto(st.items, i, p.bag) : dropOnto(st.items, i, p.bag, to);
    if (!ok) {
      this.log('กระเป๋าเต็ม', '#ff8a6a', p.id);
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

  /** One enhancement attempt on a weapon the player owns (equipped or in the bag). */
  enhance(p: Player, uid: string): { result: EnhanceResult; item: Item } | null {
    if (!this.near(p, 'blacksmith')) return null;
    const item = [p.equipment.weapon, ...p.bag].find((w): w is Item => !!w && !isPotion(w) && w.uid === uid && w.slot === 'weapon');
    if (!item || plusOf(item) >= MAX_PLUS) return null;
    const cost = enhanceCost(item);
    if (p.gold < cost) return null;
    p.gold -= cost;
    const result = rollEnhance(item, Math.random);
    if (item === p.equipment.weapon) p.recompute();
    if (result === 'success') {
      this.log(`🔨 ตีบวกสำเร็จ → ${itemName(item)}`, '#ffd34a', p.id);
      this.fx('burst', p.x, 1.2, p.z, '#ffd34a', 14, 3);
      this.text(p.x, p.topY + 0.3, p.z, `+${plusOf(item)} สำเร็จ!`, 'lvl', 1.4);
    } else {
      this.log(`🔨 ตีบวก ${item.name} ล้มเหลว${result === 'drop' ? ` ระดับลดเหลือ +${plusOf(item)}` : ''}`, '#ff8a6a', p.id);
      this.fx('burst', p.x, 1.2, p.z, '#8a8f96', 10, 2);
      this.text(p.x, p.topY + 0.3, p.z, 'ล้มเหลว', 'hurt', 1.2);
    }
    this.sfx(result === 'success' ? 'enhance_ok' : 'enhance_fail', p.x, p.z, p.id);
    this.afterChange(p);
    return { result, item };
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

    for (const p of this.players) if (p.alive) p.update(dt, intentOf(p));
    for (const p of this.players) this.tickBuyback(p, dt);
    for (const p of this.players) if (p.alive) this.checkPortals(p);

    for (const m of this.monsters) m.update(dt, this);
    this.separateMonsters();
    this.monsters = this.monsters.filter((m) => m.alive || m.deadT <= 0.9);

    for (const pr of this.projectiles) pr.update(dt);
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
    for (const l of this.loots) l.update(dt, this);
    this.loots = this.loots.filter((l) => !l.dead);

    for (const sp of this.spawners) {
      sp.queue.sort((a, b) => a - b);
      while (sp.queue.length && sp.queue[0] <= this.time && sp.alive < sp.area.count) {
        sp.queue.shift();
        this.spawnMonster(sp);
      }
    }
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
