import type { ClassId, Stats } from '../types';
import { GUNSLINGER_SKILLS } from './gunslingerSkills';

/**
 * Starting MP regen, the same for every class (owner 2026-11-10: 5 MP a second at Lv.1).
 * The player's stats cut all regen by the MP regen multiplier (0.25 in code, src/shared/balance.ts) afterwards, so this is 5 / 0.25.
 */
export const BASE_MP_REGEN = 20;

/**
 * Skills cost this many % more MP per level above 1 (owner 2026-11-13), the same for every class in code;
 * tuned per class in the /admin balance tab. See skillMpCost in src/shared/balance.ts.
 */
export const MP_COST_PER_LEVEL = 3;

/** Buttons a skill can sit on: the basic attack, the three loadout slots and the dash. */
export type SkillSlot = 'basic' | 'q' | 'e' | 'r' | 'dash';
/** The three loadout slots the player fills (owner 2026-11-14: Q and E take normal skills, R an ultimate). */
export type LoadoutSlot = 'q' | 'e' | 'r';
export const LOADOUT_SLOTS: readonly LoadoutSlot[] = ['q', 'e', 'r'];
/** Where a learned skill can be worn: a loadout slot or the single passive slot. */
export type WearSlot = LoadoutSlot | 'passive';
export const WEAR_SLOTS: readonly WearSlot[] = ['q', 'e', 'r', 'passive'];

/**
 * What a skill is (owner 2026-11-14): the basic attack and the dash every class has; normal skills (Q/E), ultimates (R)
 * and passives (one worn at a time) are learned with skill points and ranked up.
 */
export type SkillKind = 'basic' | 'dash' | 'normal' | 'ult' | 'passive';
/** Kinds bought with skill points. */
export type LearnKind = 'normal' | 'ult' | 'passive';
export const LEARN_KINDS: readonly LearnKind[] = ['normal', 'ult', 'passive'];
export const isLearnable = (sk: SkillDef): boolean => sk.kind === 'normal' || sk.kind === 'ult' || sk.kind === 'passive';
/** Which kind each wear slot takes. */
export const SLOT_KIND: Record<WearSlot, LearnKind> = { q: 'normal', e: 'normal', r: 'ult', passive: 'passive' };
export const KIND_NAME: Record<LearnKind, string> = { normal: 'สกิลธรรมดา', ult: 'สกิลอัลติ', passive: 'พาสซีฟ' };

/**
 * Skill growth per rank above 1 in % (owner 2026-11-14 for the first skills): damage +5%, MP +10%,
 * cooldown -2%, status times (stun, slow, armor break, guard, lifesteal) +5%. Tuned per skill in the
 * /admin balance tab (src/shared/skillTuning.ts).
 */
export const DMG_PER_RANK = 5;
export const MP_PER_RANK = 10;
export const CD_PER_RANK = -2;
export const STATUS_PER_RANK = 5;

export interface SkillDef {
  id: string;
  kind: SkillKind;
  /** Normal skills and ultimates: which of the class's three lines (0-2) it belongs to. Passives have none. */
  line?: number;
  /** Order within its kind (in its line for normal/ult), from 0: picks the unlock level (SkillConfig.unlock). */
  tier?: number;
  /** The class animation it plays (skill_q / skill_e / skill_r rows of the sprite sheet), whatever slot it sits in. */
  anim?: 'q' | 'e' | 'r';
  name: string;
  nameTh: string;
  desc: string;
  /** Damage multiplier (× ATK) of each hit at rank 1. The basic attack is 1; passives 0. */
  dmg: number;
  mp: number;
  cooldown: number;
  /**
   * The skill's own numbers besides damage, MP, cooldown and reach (stun seconds, slow %, shots...), each tunable per
   * skill on the /admin balance tab. `status` ones grow with the skill's status %/rank.
   */
  params?: Record<string, SkillParam>;
}

/** One of a skill's own numbers: its code value, Thai name and unit, and the range /admin allows. */
/** `status` ones grow with the skill's status %/rank, `dmg` ones (extra damage × ATK) with its damage %/rank. */
export interface SkillParam { v: number; nameTh: string; unit: string; lo: number; hi: number; status?: boolean; dmg?: boolean }
const sec = (v: number, nameTh: string): SkillParam => ({ v, nameTh, unit: 'วิ', lo: 0, hi: 30, status: true });
const pctP = (v: number, nameTh: string): SkillParam => ({ v, nameTh, unit: '%', lo: 0, hi: 100 });
const metres = (v: number, nameTh: string): SkillParam => ({ v, nameTh, unit: 'ม.', lo: 0.5, hi: 30 });

/** One of a class's three skill lines: its name and colour on the skill window. */
export interface SkillLine { nameTh: string; color: string }

export interface ClassDef {
  id: ClassId;
  name: string;
  nameTh: string;
  desc: string;
  /** Basic attacks per second before atkSpeed bonus. */
  attackRate: number;
  base: Stats;
  growth: Partial<Stats>;
  /** Multiplies the final stats (class, level and gear together), e.g. { atk: 2 } doubles attack. */
  statMult?: Partial<Record<keyof Stats, number>>;
  /** Damage multiplier against bosses (not their summoned minions). */
  bossDmgMult?: number;
  /** The three skill lines, in the skill window's column order. */
  lines: [SkillLine, SkillLine, SkillLine];
  /** Basic attack, dash, and every learnable skill (normal, ultimate and passive). */
  skills: SkillDef[];
}

const dash = (name: string, nameTh: string): SkillDef => ({
  id: 'dash', kind: 'dash', name, nameTh,
  desc: 'พุ่งไปตามทิศที่เดิน (หรือทิศเมาส์) ไม่รับดาเมจระหว่างพุ่ง',
  dmg: 0, mp: 0, cooldown: 2.5,
});

// Until each class's own PR (30 skills and 3 passives) the three old skills fill the lines; the old R skill is a
// stand-in ultimate (owner 2026-11-14).
export const CLASSES: Record<ClassId, ClassDef> = {
  sword: {
    id: 'sword',
    name: 'Sword',
    nameTh: 'นักดาบ',
    desc: 'นักรบระยะประชิด ทนทาน ฟันเป็นวงกว้าง เหมาะกับการบุกเข้าหาฝูงมอนสเตอร์',
    attackRate: 1.7,
    base: { maxHp: 130, maxMp: 50, atk: 12, def: 6, crit: 5, critDmg: 50, atkSpeed: 0, moveSpeed: 0, hpRegen: 1.2, mpRegen: BASE_MP_REGEN },
    growth: { maxHp: 20, maxMp: 4, atk: 2.6, def: 1.3, hpRegen: 0.15, mpRegen: 0.05 },
    // Attack, HP and defense doubled, gear included (owner's request).
    statMult: { atk: 2, maxHp: 2, def: 2 },
    bossDmgMult: 2,
    lines: [
      { nameTh: 'สายทำดาเมจ', color: '#e8603c' },
      { nameTh: 'สายพริ้ว/เคลื่อนที่', color: '#4cc3e8' },
      { nameTh: 'สายแท็งก์/คุมพื้นที่', color: '#c9a24a' },
    ],
    skills: [
      { id: 'slash', kind: 'basic', name: 'Slash', nameTh: 'ฟัน', desc: 'ฟันเป็นวงโค้งด้านหน้า 100% ATK', dmg: 1, mp: 0, cooldown: 0 },
      { id: 'whirlwind', kind: 'normal', line: 0, tier: 0, anim: 'q', name: 'Whirlwind', nameTh: 'พายุดาบ', desc: 'หมุนตัวฟันรอบทิศ ไม่รับดาเมจชั่วครู่ และดูดเลือดจากดาเมจที่ทำ', dmg: 1.8, mp: 15, cooldown: 6,
        params: { guard: sec(0.6, 'ไม่รับดาเมจ'), lifesteal: pctP(5, 'ดูดเลือด'), lifestealTime: sec(3, 'เวลาดูดเลือด') } },
      { id: 'earthquake', kind: 'normal', line: 2, tier: 0, anim: 'e', name: 'Earthquake', nameTh: 'ปฐพีแยก', desc: 'กระแทกพื้นรอบตัวและสตัน', dmg: 2, mp: 20, cooldown: 7, params: { stun: sec(1, 'สตัน') } },
      { id: 'charge', kind: 'ult', line: 1, tier: 0, anim: 'r', name: 'Charge', nameTh: 'พุ่งชน', desc: 'พุ่งไปตามทิศเมาส์ ชนศัตรูตลอดทางและกระเด็น ทุกครั้งที่ฆ่ามอนได้ คูลดาวน์ที่เหลือลดลงครึ่งหนึ่ง', dmg: 1.5, mp: 25, cooldown: 15,
        params: { killCdCut: pctP(50, 'ฆ่ามอนได้ ลดคูลดาวน์ที่เหลือ') } },
      dash('Dash', 'แดช'),
    ],
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    nameTh: 'นักเวท',
    desc: 'จอมเวทระยะไกล พลังทำลายสูงแต่เปราะบาง ควบคุมพื้นที่ด้วยเวทธาตุ',
    attackRate: 1.4,
    base: { maxHp: 90, maxMp: 100, atk: 14, def: 3, crit: 5, critDmg: 60, atkSpeed: 0, moveSpeed: 0, hpRegen: 0.8, mpRegen: BASE_MP_REGEN },
    growth: { maxHp: 12, maxMp: 10, atk: 3, def: 0.7, hpRegen: 0.1, mpRegen: 0.2 },
    lines: [
      { nameTh: 'สายระเบิดดาเมจ', color: '#ff7a2a' },
      { nameTh: 'สายดาเมจต่อเนื่อง', color: '#9be05a' },
      { nameTh: 'สายควบคุม/บัฟ', color: '#7ab8ff' },
    ],
    skills: [
      { id: 'bolt', kind: 'basic', name: 'Arcane Bolt', nameTh: 'ลูกเวท', desc: 'ยิงลูกเวทไปทางเมาส์ 100% ATK', dmg: 1, mp: 0, cooldown: 0 },
      { id: 'fireball', kind: 'normal', line: 0, tier: 0, anim: 'q', name: 'Fireball', nameTh: 'ลูกไฟ', desc: 'ลูกไฟระเบิดเป็นวง', dmg: 2.2, mp: 10, cooldown: 2.5, params: { blast: metres(2.6, 'รัศมีระเบิด') } },
      { id: 'frostnova', kind: 'normal', line: 2, tier: 0, anim: 'e', name: 'Frost Nova', nameTh: 'วงน้ำแข็ง', desc: 'คลื่นน้ำแข็งรอบตัว ทำให้ศัตรูช้าลง', dmg: 1.4, mp: 18, cooldown: 7,
        params: { slow: pctP(50, 'ช้าลง'), slowTime: sec(3, 'เวลาช้าลง') } },
      { id: 'meteor', kind: 'ult', line: 0, tier: 0, anim: 'r', name: 'Meteor', nameTh: 'อุกกาบาต', desc: 'เรียกอุกกาบาตลงตำแหน่งเมาส์ และสตันสั้นๆ', dmg: 4.5, mp: 35, cooldown: 14,
        params: { radius: metres(3.5, 'รัศมีวงตก'), stun: sec(0.8, 'สตัน') } },
      dash('Blink', 'วาร์ป'),
    ],
  },
  gunslinger: {
    id: 'gunslinger',
    name: 'Gunslinger',
    nameTh: 'มือปืน',
    desc: 'นักแม่นปืนจากมิติเทคโนโลยี ยิงเร็ว คล่องตัว เด่นเรื่องดาเมจต่อเนื่องและคริติคอล',
    attackRate: 2.6,
    base: { maxHp: 105, maxMp: 70, atk: 9, def: 4, crit: 12, critDmg: 60, atkSpeed: 0, moveSpeed: 5, hpRegen: 1, mpRegen: BASE_MP_REGEN },
    growth: { maxHp: 15, maxMp: 6, atk: 2, def: 0.9, hpRegen: 0.12, mpRegen: 0.12 },
    lines: [
      { nameTh: 'สายคริติคอล/เล็งแม่น', color: '#ff5a6a' },
      { nameTh: 'สายยิงเร็ว', color: '#ffc85a' },
      { nameTh: 'สายอาวุธพิเศษ', color: '#7affe0' },
    ],
    skills: [
      { id: 'shot', kind: 'basic', name: 'Quick Shot', nameTh: 'ยิงเร็ว', desc: 'ยิงกระสุนความเร็วสูง 100% ATK', dmg: 1, mp: 0, cooldown: 0 },
      ...GUNSLINGER_SKILLS,
      dash('Tumble', 'กลิ้งหลบ'),
    ],
  },
};

export const CLASS_IDS: ClassId[] = ['sword', 'mage', 'gunslinger'];

/** A class's skill by id (any kind), or undefined. */
export function classSkill(cls: ClassId, id: string): SkillDef | undefined {
  return CLASSES[cls].skills.find((s) => s.id === id);
}

/** Every learnable skill of every class (the admin table and the tuning checks). */
export const LEARNABLE_SKILLS: readonly { cls: ClassId; sk: SkillDef }[] = CLASS_IDS.flatMap((cls) =>
  CLASSES[cls].skills.filter(isLearnable).map((sk) => ({ cls, sk })));
