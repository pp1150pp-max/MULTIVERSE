import { Unit } from './Unit';
import type { Sim } from './Sim';
import type { Monster } from './Monster';
import type { Intent } from './types';
import { castSkill, basicAttack } from './skills';
import { CLASSES, type ClassDef, type SkillDef, type SkillSlot } from '../data/classes';
import { addInto, BASE_MOVE_SPEED, emptyStats } from '../formulas';
import { effectiveStats, sellValue } from '../data/enhance';
import type { ClassId, Item, SlotId, Stats, Vec2 } from '../types';

export const BAG_SIZE = 30;
export const POTION_CD = 1.5;

/** Everything about a character that gets saved (browser storage now, the server database later). */
export interface CharacterData {
  name: string;
  classId: ClassId;
  level: number;
  exp: number;
  gold: number;
  hpPots: number;
  mpPots: number;
  equipment: Partial<Record<SlotId, Item>>;
  bag: (Item | null)[];
}

export class Player extends Unit {
  readonly cls: ClassDef;
  readonly name: string;
  exp: number;
  gold: number;
  mp = 0;
  hpPots: number;
  mpPots: number;
  equipment: Partial<Record<SlotId, Item>>;
  bag: (Item | null)[];
  stats: Stats = emptyStats();
  cd: Partial<Record<SkillSlot, number>> = {};
  potCd = 0;
  lastHurt = -99;
  moveTarget: Vec2 | null = null;
  /** Shown once per session when low-level monsters start giving less EXP. */
  lowExpHinted = false;
  dashKind: 'dash' | 'charge' = 'dash';
  private atkT = 0;
  private faceLockT = 0;
  private aimX = 0;
  private aimZ = 0;
  private dashT = 0;
  private dashVx = 0;
  private dashVz = 0;
  private chargeHit = new Set<Monster>();
  private noMpMsgT = 0;

  constructor(id: number, private readonly sim: Sim, data: CharacterData) {
    super(id);
    this.cls = CLASSES[data.classId];
    this.name = data.name;
    this.level = data.level;
    this.exp = data.exp;
    this.gold = data.gold;
    this.hpPots = data.hpPots;
    this.mpPots = data.mpPots;
    this.equipment = { ...data.equipment };
    this.bag = Array.from({ length: BAG_SIZE }, (_, i) => data.bag[i] ?? null);
    this.radius = 0.4;
    this.recompute();
    this.hp = this.maxHp;
    this.mp = this.stats.maxMp;
  }

  get maxHp(): number { return this.stats.maxHp; }
  get topY(): number { return 1.9; }
  get moveSpeed(): number { return BASE_MOVE_SPEED * (1 + this.stats.moveSpeed / 100) * this.speedMult(); }
  get attackRate(): number { return this.cls.attackRate * (1 + this.stats.atkSpeed / 100); }
  get isDashing(): boolean { return this.dashT > 0; }

  skill(slot: SkillSlot): SkillDef | undefined {
    return this.cls.skills.find((s) => s.slot === slot);
  }

  recompute(): void {
    const s = emptyStats();
    addInto(s, this.cls.base);
    addInto(s, this.cls.growth, this.level - 1);
    for (const it of Object.values(this.equipment)) if (it) addInto(s, effectiveStats(it));
    this.stats = s;
    this.hp = Math.min(this.hp, s.maxHp);
    this.mp = Math.min(this.mp, s.maxMp);
  }

  toData(): CharacterData {
    return {
      name: this.name,
      classId: this.cls.id,
      level: this.level,
      exp: this.exp,
      gold: this.gold,
      hpPots: this.hpPots,
      mpPots: this.mpPots,
      equipment: this.equipment,
      bag: this.bag,
    };
  }

  // ------------------------------------------------------------ inventory

  addToBag(item: Item): boolean {
    const i = this.bag.indexOf(null);
    if (i < 0) return false;
    this.bag[i] = item;
    return true;
  }

  hasBagSpace(): boolean {
    return this.bag.includes(null);
  }

  equipFromBag(i: number): void {
    const item = this.bag[i];
    if (!item) return;
    this.bag[i] = this.equipment[item.slot] ?? null;
    this.equipment[item.slot] = item;
    this.recompute();
  }

  unequip(slot: SlotId): void {
    const item = this.equipment[slot];
    if (!item || !this.addToBag(item)) return;
    delete this.equipment[slot];
    this.recompute();
  }

  /** Only the merchant (Sim.sellItem) calls this — items can't be sold from the bag anywhere else. */
  sell(i: number): number {
    const item = this.bag[i];
    if (!item) return 0;
    const v = sellValue(item);
    this.bag[i] = null;
    this.gold += v;
    return v;
  }

  /** Takes an item out of the bag so it can be thrown on the ground. */
  takeFromBag(i: number): Item | null {
    const item = this.bag[i];
    this.bag[i] = null;
    return item;
  }

  // ------------------------------------------------------------ actions

  startDash(dx: number, dz: number, dist: number, time: number, kind: 'dash' | 'charge'): void {
    const l = Math.hypot(dx, dz) || 1;
    this.dashVx = (dx / l) * (dist / time);
    this.dashVz = (dz / l) * (dist / time);
    this.dashT = time;
    this.invulnT = time + 0.05;
    this.dashKind = kind;
    this.chargeHit.clear();
    this.moveTarget = null;
    this.face(dx, dz);
    this.sim.anim(this.id, 'dash', { duration: time + 0.12 });
  }

  private attackAnimDuration(): number {
    return Math.min(0.5, 0.95 / this.attackRate);
  }

  private usePotion(kind: 'hp' | 'mp'): void {
    if (this.potCd > 0) return;
    const sim = this.sim;
    if (kind === 'hp') {
      if (this.hpPots <= 0) return sim.text(this.x, this.topY, this.z, 'ไม่มียา HP', 'info', undefined, this.id);
      this.hpPots--;
      const heal = Math.round(this.maxHp * 0.4);
      this.hp = Math.min(this.maxHp, this.hp + heal);
      sim.text(this.x, this.topY, this.z, `+${heal}`, 'heal');
      sim.fx('burst', this.x, 1, this.z, '#ff6a6a', 8, 2);
    } else {
      if (this.mpPots <= 0) return sim.text(this.x, this.topY, this.z, 'ไม่มียา MP', 'info', undefined, this.id);
      this.mpPots--;
      const gain = Math.round(this.stats.maxMp * 0.5);
      this.mp = Math.min(this.stats.maxMp, this.mp + gain);
      sim.text(this.x, this.topY, this.z, `+${gain} MP`, 'mana');
      sim.fx('burst', this.x, 1, this.z, '#6aa0ff', 8, 2);
    }
    this.potCd = POTION_CD;
  }

  update(dt: number, it: Intent): void {
    const sim = this.sim;
    this.moving = false;
    if (!this.alive) return;
    this.tickStatus(dt, sim.terrain);
    for (const k of Object.keys(this.cd) as SkillSlot[]) this.cd[k] = Math.max(0, (this.cd[k] ?? 0) - dt);
    this.atkT -= dt;
    this.potCd -= dt;
    this.faceLockT -= dt;

    const ooc = sim.time - this.lastHurt > 5 ? 2.5 : 1;
    this.hp = Math.min(this.maxHp, this.hp + this.stats.hpRegen * ooc * dt);
    this.mp = Math.min(this.stats.maxMp, this.mp + this.stats.mpRegen * ooc * dt);

    if (it.potion) this.usePotion(it.potion);

    if (this.stunT > 0) return;

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.x += this.dashVx * dt;
      this.z += this.dashVz * dt;
      sim.terrain.resolve(this);
      if (this.dashKind === 'charge') {
        for (const m of sim.monsters) {
          if (!m.alive || this.chargeHit.has(m)) continue;
          if (Math.hypot(m.x - this.x, m.z - this.z) < m.radius + 1.2) {
            this.chargeHit.add(m);
            sim.hitMonster(this, m, 1.5, { kb: 9, fromX: this.x, fromZ: this.z });
          }
        }
      }
      this.moving = true;
      return;
    }

    const aim = it.aim;
    this.aimX = aim.x - this.x;
    this.aimZ = aim.z - this.z;

    // Movement intent first so Dash uses the current walk direction.
    if (it.move) this.moveTarget = null;
    if (it.moveTo) this.moveTarget = { ...it.moveTo };
    let mx = 0;
    let mz = 0;
    let remaining = Infinity;
    if (it.move) {
      mx = it.move.x;
      mz = it.move.z;
    } else if (this.moveTarget) {
      const dx = this.moveTarget.x - this.x;
      const dz = this.moveTarget.z - this.z;
      remaining = Math.hypot(dx, dz);
      if (remaining < 0.15) this.moveTarget = null;
      else {
        mx = dx / remaining;
        mz = dz / remaining;
      }
    }

    if (it.dash && (this.cd.dash ?? 0) <= 0) {
      const dashSkill = this.skill('dash')!;
      const [dx, dz] = mx || mz ? [mx, mz] : [this.aimX, this.aimZ];
      this.startDash(dx, dz, 4.8, 0.18, 'dash');
      this.cd.dash = dashSkill.cooldown;
      return;
    }

    for (const slot of it.skills) {
      const sk = this.skill(slot);
      if (!sk || (this.cd[slot] ?? 0) > 0) continue;
      if (this.mp < sk.mp) {
        if (sim.time > this.noMpMsgT) {
          sim.text(this.x, this.topY, this.z, 'MP ไม่พอ', 'mana', undefined, this.id);
          this.noMpMsgT = sim.time + 1;
        }
        continue;
      }
      this.face(this.aimX, this.aimZ);
      if (castSkill(sim, this, sk, aim)) {
        // A dedicated skill animation wins over the dash animation a movement skill just started;
        // without one the attack animation plays (unless the skill is a dash).
        sim.anim(this.id, `skill_${slot}`, { duration: this.attackAnimDuration(), fallback: 'attack' });
        this.mp -= sk.mp;
        this.cd[slot] = sk.cooldown;
        this.faceLockT = 0.3;
      }
      if (this.dashT > 0) return;
    }

    if (it.basic && this.atkT <= 0) {
      this.atkT = 1 / this.attackRate;
      basicAttack(sim, this, aim);
      this.face(this.aimX, this.aimZ);
      sim.anim(this.id, 'attack', { duration: this.attackAnimDuration() });
      this.faceLockT = 0.25;
    }

    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const step = Math.min(this.moveSpeed * dt, remaining);
      this.x += mx * step;
      this.z += mz * step;
      sim.terrain.resolve(this);
    }
    if (this.faceLockT > 0) this.face(this.aimX, this.aimZ);
    else if (moving) this.face(mx, mz);
    this.moving = moving;
  }
}
