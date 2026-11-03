import type { Game, Intent } from '../Game';
import { Unit } from './Unit';
import type { Monster } from './Monster';
import { SpriteActor } from '../SpriteActor';
import { animSets, sheets } from '../assets';
import { AnimatedActor } from '../AnimatedActor';
import { castSkill, basicAttack } from '../skills';
import { CLASSES, type ClassDef, type SkillDef, type SkillSlot } from '../../shared/data/classes';
import { addInto, BASE_MOVE_SPEED, emptyStats } from '../../shared/formulas';
import { effectiveStats, sellValue } from '../../shared/data/enhance';
import type { Item, SlotId, Stats, Vec2 } from '../../shared/types';
import type { SaveData } from '../save';

export const BAG_SIZE = 30;
const POTION_CD = 1.5;

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
  metSeeker: boolean;
  private atkT = 0;
  private faceLockT = 0;
  private aimX = 0;
  private aimZ = 0;
  private dashT = 0;
  private dashVx = 0;
  private dashVz = 0;
  private dashKind: 'dash' | 'charge' = 'dash';
  private chargeHit = new Set<Monster>();
  private noMpMsgT = 0;
  private combo = 0;
  private lastAttackAt = -99;

  constructor(private readonly g: Game, save: SaveData) {
    const cls = CLASSES[save.classId];
    const anim = animSets[cls.id];
    super(anim ? new AnimatedActor(anim, 0.4) : new SpriteActor(sheets[cls.id], 1.9, 0.4));
    this.cls = cls;
    this.name = save.name;
    this.level = save.level;
    this.exp = save.exp;
    this.gold = save.gold;
    this.hpPots = save.hpPots;
    this.mpPots = save.mpPots;
    this.equipment = { ...save.equipment };
    this.bag = Array.from({ length: BAG_SIZE }, (_, i) => save.bag[i] ?? null);
    this.metSeeker = save.metSeeker;
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

  /** Only the merchant NPC calls this — items can't be sold from the bag anywhere else. */
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

  toSave(): SaveData {
    return {
      v: 1,
      name: this.name,
      classId: this.cls.id,
      level: this.level,
      exp: this.exp,
      gold: this.gold,
      hpPots: this.hpPots,
      mpPots: this.mpPots,
      equipment: this.equipment,
      bag: this.bag,
      metSeeker: this.metSeeker,
    };
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
    this.actor.face(dx, dz);
    this.actor.play('dash', { duration: time + 0.12 });
  }

  /** Cycles attack → attack_2 → attack_3 while hits keep coming within a second. */
  private playAttackAnim(): void {
    const names = ['attack', 'attack_2', 'attack_3'].filter((n) => this.actor.has(n));
    if (!names.length) return;
    this.combo = this.g.time - this.lastAttackAt < 1 ? (this.combo + 1) % names.length : 0;
    this.lastAttackAt = this.g.time;
    this.actor.play(names[this.combo], { duration: Math.min(0.5, 0.95 / this.attackRate) });
  }

  private usePotion(kind: 'hp' | 'mp'): void {
    if (this.potCd > 0) return;
    const g = this.g;
    if (kind === 'hp') {
      if (this.hpPots <= 0) return g.floating.text(this.x, this.topY, this.z, 'ไม่มียา HP', 'info');
      this.hpPots--;
      const heal = Math.round(this.maxHp * 0.4);
      this.hp = Math.min(this.maxHp, this.hp + heal);
      g.floating.text(this.x, this.topY, this.z, `+${heal}`, 'heal');
      g.fx.burst(this.x, 1, this.z, '#ff6a6a', 8, 2);
    } else {
      if (this.mpPots <= 0) return g.floating.text(this.x, this.topY, this.z, 'ไม่มียา MP', 'info');
      this.mpPots--;
      const gain = Math.round(this.stats.maxMp * 0.5);
      this.mp = Math.min(this.stats.maxMp, this.mp + gain);
      g.floating.text(this.x, this.topY, this.z, `+${gain} MP`, 'mana');
      g.fx.burst(this.x, 1, this.z, '#6aa0ff', 8, 2);
    }
    this.potCd = POTION_CD;
  }

  update(dt: number, it: Intent): void {
    const g = this.g;
    this.tickStatus(dt, g);
    for (const k of Object.keys(this.cd) as SkillSlot[]) this.cd[k] = Math.max(0, (this.cd[k] ?? 0) - dt);
    this.atkT -= dt;
    this.potCd -= dt;
    this.faceLockT -= dt;

    const ooc = g.time - this.lastHurt > 5 ? 2.5 : 1;
    this.hp = Math.min(this.maxHp, this.hp + this.stats.hpRegen * ooc * dt);
    this.mp = Math.min(this.stats.maxMp, this.mp + this.stats.mpRegen * ooc * dt);

    if (it.potion) this.usePotion(it.potion);

    if (this.stunT > 0) {
      this.actor.update(dt, false);
      this.syncView();
      return;
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.x += this.dashVx * dt;
      this.z += this.dashVz * dt;
      g.world.resolve(this);
      if (Math.random() < 0.7) g.fx.puff(this.x, 0.9, this.z, this.dashKind === 'charge' ? '#ffcf7a' : '#cfe8ff', 0.25, 1.1);
      if (this.dashKind === 'charge') {
        for (const m of g.monsters) {
          if (!m.alive || this.chargeHit.has(m)) continue;
          if (Math.hypot(m.x - this.x, m.z - this.z) < m.radius + 1.2) {
            this.chargeHit.add(m);
            g.hitMonster(this, m, 1.5, { kb: 9, fromX: this.x, fromZ: this.z });
          }
        }
      }
      this.actor.update(dt, true, 14);
      this.syncView();
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
        if (g.time > this.noMpMsgT) {
          g.floating.text(this.x, this.topY, this.z, 'MP ไม่พอ', 'mana');
          this.noMpMsgT = g.time + 1;
        }
        continue;
      }
      this.actor.face(this.aimX, this.aimZ);
      if (castSkill(g, this, sk, aim)) {
        const anim = `skill_${slot}`;
        if (this.actor.has(anim)) {
          // A dedicated skill animation wins over the dash animation a movement skill just started.
          this.actor.reset();
          this.actor.play(anim);
        } else if (!this.isDashing) {
          this.playAttackAnim();
        }
        this.mp -= sk.mp;
        this.cd[slot] = sk.cooldown;
        this.faceLockT = 0.3;
      }
      if (this.dashT > 0) return;
    }

    if (it.basic && this.atkT <= 0) {
      this.atkT = 1 / this.attackRate;
      basicAttack(g, this, aim);
      this.actor.face(this.aimX, this.aimZ);
      this.playAttackAnim();
      this.faceLockT = 0.25;
    }

    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const step = Math.min(this.moveSpeed * dt, remaining);
      this.x += mx * step;
      this.z += mz * step;
      g.world.resolve(this);
    }
    if (this.faceLockT > 0) this.actor.face(this.aimX, this.aimZ);
    else if (moving) this.actor.face(mx, mz);
    this.actor.update(dt, moving);
    this.syncView();
  }
}
