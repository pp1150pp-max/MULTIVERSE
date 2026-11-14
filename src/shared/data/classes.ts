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
/** A plain number that does not grow with rank (counts, zone lifetimes, gaps between hits...). */
const num = (v: number, nameTh: string, unit: string, lo: number, hi: number): SkillParam => ({ v, nameTh, unit, lo, hi });
/** A passive's % effect: grows with the skill's status %/rank (owner 2026-11-14: +5% of the value per rank). */
const passiveP = (v: number, nameTh: string): SkillParam => ({ v, nameTh, unit: '%', lo: 0, hi: 300, status: true });

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
    // Owner-approved table 2026-11-14 (docs/systems/skills-mage.md). New ids start with mg_.
    lines: [
      { nameTh: 'สายระเบิดดาเมจ', color: '#ff7a2a' },
      { nameTh: 'สายดาเมจต่อเนื่อง', color: '#9be05a' },
      { nameTh: 'สายควบคุม/บัฟ', color: '#7ab8ff' },
    ],
    skills: [
      { id: 'bolt', kind: 'basic', name: 'Arcane Bolt', nameTh: 'ลูกเวท', desc: 'ยิงลูกเวทไปทางเมาส์ 100% ATK', dmg: 1, mp: 0, cooldown: 0 },
      // ---- Line 1: burst damage
      { id: 'fireball', kind: 'normal', line: 0, tier: 0, anim: 'q', name: 'Fireball', nameTh: 'ลูกไฟ', desc: 'ลูกไฟระเบิดเป็นวง', dmg: 2.2, mp: 10, cooldown: 2.5, params: { blast: metres(2.6, 'รัศมีระเบิด') } },
      { id: 'mg_arcanelance', kind: 'normal', line: 0, tier: 1, anim: 'q', name: 'Arcane Lance', nameTh: 'หอกอาร์เคน', desc: 'หอกเวทพุ่งทะลุศัตรูทุกตัวในแนว', dmg: 2, mp: 14, cooldown: 5 },
      { id: 'mg_chainlightning', kind: 'normal', line: 0, tier: 2, anim: 'q', name: 'Chain Lightning', nameTh: 'สายฟ้าฟาด', desc: 'ฟาดศัตรูที่ใกล้เมาส์ที่สุด แล้วเด้งต่อไปตัวใกล้เคียง ดาเมจลดทีละเด้ง', dmg: 2.4, mp: 16, cooldown: 6,
        params: { jumps: num(3, 'จำนวนเด้ง', 'ครั้ง', 0, 10), jumpRange: metres(5, 'ระยะเด้ง'), falloff: pctP(20, 'ดาเมจลดต่อเด้ง') } },
      { id: 'mg_manaburst', kind: 'normal', line: 0, tier: 3, anim: 'e', name: 'Mana Burst', nameTh: 'ระเบิดมานา', desc: 'ระเบิดพลังทันทีที่ตำแหน่งเมาส์', dmg: 2.6, mp: 18, cooldown: 7,
        params: { radius: metres(3, 'รัศมีระเบิด') } },
      { id: 'mg_flamewave', kind: 'normal', line: 0, tier: 4, anim: 'e', name: 'Flame Wave', nameTh: 'คลื่นเพลิง', desc: 'ไฟกวาดเป็นกรวยด้านหน้า ผลักศัตรูกระเด็น', dmg: 2.8, mp: 20, cooldown: 7,
        params: { arc: num(100, 'มุมกรวย', 'องศา', 20, 360) } },
      { id: 'mg_volatileorb', kind: 'normal', line: 0, tier: 5, anim: 'q', name: 'Volatile Orb', nameTh: 'ลูกแก้วระเบิด', desc: 'ลูกแก้วลอยช้า ระเบิดวงใหญ่เมื่อชนหรือสุดระยะ', dmg: 3.4, mp: 24, cooldown: 9,
        params: { blast: metres(3.8, 'รัศมีระเบิด') } },
      { id: 'mg_crystalrain', kind: 'normal', line: 0, tier: 6, anim: 'e', name: 'Crystal Rain', nameTh: 'ฝนผลึก', desc: 'ผลึกตกใส่วงที่เมาส์หลายระลอก (ดาเมจต่อระลอก)', dmg: 1, mp: 26, cooldown: 10,
        params: { radius: metres(3.2, 'รัศมีวง'), waves: num(5, 'จำนวนระลอก', 'ระลอก', 1, 20), gap: num(0.3, 'ห่างระลอกละ', 'วิ', 0.05, 2) } },
      { id: 'mg_chargedblast', kind: 'normal', line: 0, tier: 7, anim: 'e', name: 'Charged Blast', nameTh: 'เวทชาร์จ', desc: 'ยืนนิ่งชาร์จพลัง แล้วปล่อยระเบิดวงกว้างรอบตัว', dmg: 5, mp: 32, cooldown: 12,
        params: { charge: num(0.8, 'เวลาชาร์จ (ยืนนิ่ง)', 'วิ', 0, 3) } },
      { id: 'meteor', kind: 'ult', line: 0, tier: 0, anim: 'r', name: 'Meteor', nameTh: 'อุกกาบาต', desc: 'เรียกอุกกาบาตลงตำแหน่งเมาส์ และสตันสั้นๆ', dmg: 4.5, mp: 35, cooldown: 14,
        params: { radius: metres(3.5, 'รัศมีวงตก'), stun: sec(0.8, 'สตัน') } },
      { id: 'mg_starfall', kind: 'ult', line: 0, tier: 1, anim: 'r', name: 'Starfall', nameTh: 'ดาวตก', desc: 'ดาวเวทตกสุ่มทั่ววงใหญ่ทีละดวง (ดาเมจต่อดวง)', dmg: 2, mp: 55, cooldown: 25,
        params: { radius: metres(6, 'รัศมีวงใหญ่'), stars: num(8, 'จำนวนดวง', 'ดวง', 1, 30), starRadius: metres(1.8, 'วงดวงละ'), gap: num(0.25, 'ห่างดวงละ', 'วิ', 0.05, 2) } },
      // ---- Line 2: damage over time
      { id: 'mg_flameground', kind: 'normal', line: 1, tier: 0, anim: 'e', name: 'Flame Ground', nameTh: 'พื้นเพลิง', desc: 'วางพื้นไฟที่เมาส์ ศัตรูที่ยืนในวงโดนทุกวิ (ดาเมจต่อวิ)', dmg: 0.6, mp: 12, cooldown: 5,
        params: { radius: metres(2.8, 'รัศมีวง'), duration: num(4, 'อยู่นาน', 'วิ', 1, 30) } },
      { id: 'mg_poisonmist', kind: 'normal', line: 1, tier: 1, anim: 'e', name: 'Poison Mist', nameTh: 'หมอกพิษอาคม', desc: 'หมอกพิษที่เมาส์ ศัตรูที่โดนติดพิษติดตัวไปแม้ออกจากวง (ดาเมจต่อวิ)', dmg: 0.45, mp: 14, cooldown: 7,
        params: { radius: metres(3, 'รัศมีวง'), dotTime: sec(6, 'เวลาพิษ') } },
      { id: 'mg_searingmark', kind: 'normal', line: 1, tier: 2, anim: 'q', name: 'Searing Mark', nameTh: 'ตราเผาผลาญ', desc: 'ยิงตราติดศัตรูตัวแรก ครบเวลาตราระเบิดรอบตัวมัน', dmg: 3, mp: 16, cooldown: 8,
        params: { blast: metres(3, 'รัศมีระเบิด'), delay: num(2.5, 'ระเบิดหลัง', 'วิ', 0.2, 10) } },
      { id: 'mg_decayring', kind: 'normal', line: 1, tier: 3, anim: 'e', name: 'Decay Ring', nameTh: 'วงแหวนสลาย', desc: 'วงกัดกร่อนติดตัว ศัตรูในวงโดนทุกวิและเกราะลด (ดาเมจต่อวิ)', dmg: 0.5, mp: 18, cooldown: 10,
        params: { duration: num(5, 'อยู่นาน', 'วิ', 1, 30), armorBreak: pctP(15, 'ลดพลังป้องกัน'), armorBreakTime: sec(2, 'เวลาลดพลังป้องกัน') } },
      { id: 'mg_thunderstorm', kind: 'normal', line: 1, tier: 4, anim: 'e', name: 'Thunderstorm', nameTh: 'พายุสายฟ้า', desc: 'เมฆสายฟ้าที่เมาส์ ฟาดศัตรูสุ่มในวงเป็นระยะ (ดาเมจต่อสาย)', dmg: 1.2, mp: 22, cooldown: 11,
        params: { radius: metres(5, 'รัศมีวง'), strikes: num(6, 'จำนวนสาย', 'สาย', 1, 30), every: num(0.5, 'ฟาดทุก', 'วิ', 0.1, 3) } },
      { id: 'mg_crystalspikes', kind: 'normal', line: 1, tier: 5, anim: 'e', name: 'Crystal Spikes', nameTh: 'หนามผลึก', desc: 'ปักผลึกที่เมาส์ ยิงหนามใส่ศัตรูที่ใกล้ที่สุดเป็นระยะ (ดาเมจต่อนัด)', dmg: 0.9, mp: 24, cooldown: 12,
        params: { radius: metres(7, 'ระยะยิงของผลึก'), duration: num(6, 'อยู่นาน', 'วิ', 1, 30), every: num(0.75, 'ยิงทุก', 'วิ', 0.1, 3) } },
      { id: 'mg_cursedash', kind: 'normal', line: 1, tier: 6, anim: 'e', name: 'Cursed Ash', nameTh: 'เถ้าถ่านคำสาป', desc: 'พ่นเถ้าเป็นกรวยด้านหน้า ติดไฟและลดพลังโจมตีศัตรู (ดาเมจไฟต่อวิ)', dmg: 0.5, mp: 26, cooldown: 10,
        params: { arc: num(90, 'มุมกรวย', 'องศา', 20, 360), dotTime: sec(5, 'เวลาติดไฟ'), weak: pctP(20, 'ลดพลังโจมตี'), weakTime: sec(5, 'เวลาลดพลังโจมตี') } },
      { id: 'mg_hexseed', kind: 'normal', line: 1, tier: 7, anim: 'e', name: 'Hex Seed', nameTh: 'เมล็ดเวทระเบิด', desc: 'ฝังเมล็ดในศัตรูทุกตัวในวง ติดพิษ ครบเวลาแตกระเบิดรอบตัวมันแต่ละตัว (ดาเมจ = ระเบิด)', dmg: 2.2, mp: 30, cooldown: 13,
        params: { radius: metres(3.5, 'รัศมีวง'), poison: num(0.4, 'พิษต่อวิ', '×ATK', 0, 10), seedTime: num(4, 'แตกหลัง', 'วิ', 0.5, 15), seedBlast: metres(2.5, 'รัศมีแตก') } },
      { id: 'mg_firerain', kind: 'ult', line: 1, tier: 0, anim: 'r', name: 'Fire Rain', nameTh: 'ฝนเพลิง', desc: 'ฝนไฟวงใหญ่ที่เมาส์ ตีถี่ (ดาเมจต่อครั้ง)', dmg: 0.7, mp: 40, cooldown: 18,
        params: { radius: metres(5, 'รัศมีวง'), duration: num(6, 'อยู่นาน', 'วิ', 1, 30), every: num(0.5, 'ตีทุก', 'วิ', 0.1, 3) } },
      { id: 'mg_decayfield', kind: 'ult', line: 1, tier: 1, anim: 'r', name: 'Decay Field', nameTh: 'สนามเสื่อมสลาย', desc: 'สนามใหญ่ติดตัว ศัตรูในสนามโดนทุกวิ ลดเกราะและพลังโจมตี (ดาเมจต่อวิ)', dmg: 1, mp: 55, cooldown: 28,
        params: { duration: num(8, 'อยู่นาน', 'วิ', 1, 30), armorBreak: pctP(20, 'ลดพลังป้องกัน'), weak: pctP(25, 'ลดพลังโจมตี') } },
      // ---- Line 3: control / buffs (buffs reach every player in the circle, owner 2026-11-14)
      { id: 'frostnova', kind: 'normal', line: 2, tier: 0, anim: 'e', name: 'Frost Nova', nameTh: 'วงน้ำแข็ง', desc: 'คลื่นน้ำแข็งรอบตัว ทำให้ศัตรูช้าลง', dmg: 1.4, mp: 18, cooldown: 7,
        params: { slow: pctP(50, 'ช้าลง'), slowTime: sec(3, 'เวลาช้าลง') } },
      { id: 'mg_forcewave', kind: 'normal', line: 2, tier: 1, anim: 'e', name: 'Force Wave', nameTh: 'คลื่นผลัก', desc: 'ผลักศัตรูรอบตัวกระเด็นไกลและชะงักสั้นๆ (ไม่ผลักบอส)', dmg: 1, mp: 14, cooldown: 8,
        params: { push: num(12, 'แรงผลัก', '', 1, 30), stun: sec(0.4, 'สตัน') } },
      { id: 'mg_frailcurse', kind: 'normal', line: 2, tier: 2, anim: 'e', name: 'Frailty Curse', nameTh: 'คำสาปเปราะบาง', desc: 'คำสาปลงวงที่เมาส์ ลดพลังป้องกันศัตรู ทุกคนตีแรงขึ้น', dmg: 0.8, mp: 16, cooldown: 9,
        params: { radius: metres(3.5, 'รัศมีวง'), armorBreak: pctP(30, 'ลดพลังป้องกัน'), armorBreakTime: sec(6, 'เวลาลดพลังป้องกัน') } },
      { id: 'mg_icecage', kind: 'normal', line: 2, tier: 3, anim: 'q', name: 'Ice Cage', nameTh: 'กรงน้ำแข็ง', desc: 'ยิงก้อนน้ำแข็ง ตรึงศัตรูตัวแรกนิ่งสนิท (บอสโดน 30%)', dmg: 1.6, mp: 18, cooldown: 10,
        params: { stun: sec(2.5, 'ตรึง') } },
      { id: 'mg_gravitywell', kind: 'normal', line: 2, tier: 4, anim: 'e', name: 'Gravity Well', nameTh: 'หลุมแรงโน้มถ่วง', desc: 'หลุมที่เมาส์ดูดศัตรูเข้ากลาง แล้วยุบระเบิด (ไม่ดูดบอส)', dmg: 2, mp: 22, cooldown: 12,
        params: { radius: metres(4.5, 'รัศมีวง'), pullTime: num(1.5, 'เวลาดูด', 'วิ', 0.25, 5), pull: num(6, 'แรงดูด', '', 1, 20) } },
      { id: 'mg_sealveil', kind: 'normal', line: 2, tier: 5, anim: 'e', name: 'Sealing Veil', nameTh: 'ม่านผนึกเวท', desc: 'ม่านรอบตัว ศัตรูที่โดนพลังโจมตีลดลง', dmg: 1, mp: 20, cooldown: 12,
        params: { weak: pctP(30, 'ลดพลังโจมตี'), weakTime: sec(6, 'เวลาลดพลังโจมตี') } },
      { id: 'mg_empowerfield', kind: 'normal', line: 2, tier: 6, anim: 'e', name: 'Empowering Field', nameTh: 'สนามเร่งอาคม', desc: 'ตัวเองและผู้เล่นทุกคนในวงรอบตัว ทำดาเมจแรงขึ้น', dmg: 0, mp: 28, cooldown: 20,
        params: { dmgBonus: { v: 20, nameTh: 'ดาเมจเพิ่ม', unit: '%', lo: 0, hi: 300 }, buffTime: sec(8, 'เวลาบัฟ') } },
      { id: 'mg_manashield', kind: 'normal', line: 2, tier: 7, anim: 'e', name: 'Mana Shield', nameTh: 'โล่มานาหมู่', desc: 'ตัวเองและผู้เล่นทุกคนในวงรอบตัวได้โล่ดูดซับดาเมจ (ตาม HP สูงสุดของแต่ละคน)', dmg: 0, mp: 30, cooldown: 22,
        params: { shieldPct: pctP(15, 'โล่ (% HP สูงสุด)'), buffTime: sec(6, 'เวลาโล่') } },
      { id: 'mg_timewarp', kind: 'ult', line: 2, tier: 0, anim: 'r', name: 'Time Warp', nameTh: 'บิดเบือนเวลา', desc: 'ศัตรูรอบตัวช้าลงมาก และคูลดาวน์สกิลของผู้เล่นทุกคนในวงเดินเร็วขึ้น', dmg: 1.5, mp: 40, cooldown: 20,
        params: { slow: pctP(60, 'ช้าลง'), slowTime: sec(5, 'เวลาช้าลง'), haste: { v: 50, nameTh: 'คูลดาวน์เร็วขึ้น', unit: '%', lo: 0, hi: 300 }, hasteTime: sec(5, 'เวลาคูลดาวน์เร็วขึ้น') } },
      { id: 'mg_manawell', kind: 'ult', line: 2, tier: 1, anim: 'r', name: 'Mana Well', nameTh: 'วงคืนพลัง', desc: 'วางวงเวทใต้เท้า ผู้เล่นในวงฟื้น MP ทุกวิและได้โล่ ศัตรูในวงช้าลง', dmg: 0, mp: 0, cooldown: 40,
        params: { duration: num(8, 'อยู่นาน', 'วิ', 1, 30), mpPct: num(4, 'ฟื้น MP ต่อวิ (% MP สูงสุด)', '%', 0, 50), shieldPct: pctP(10, 'โล่ (% HP สูงสุด)'), slow: pctP(30, 'ช้าลง') } },
      // ---- Passives (one worn)
      { id: 'mg_elementmastery', kind: 'passive', tier: 0, name: 'Elemental Mastery', nameTh: 'ชำนาญธาตุ', desc: 'ดาเมจแรงขึ้นต่อศัตรูที่ติดสถานะใดก็ได้ (ช้า สตัน ลดเกราะ ลดพลังโจมตี ติดไฟ/พิษ)', dmg: 0, mp: 0, cooldown: 0,
        params: { bonus: passiveP(12, 'ดาเมจเพิ่ม') } },
      { id: 'mg_manasource', kind: 'passive', tier: 1, name: 'Mana Source', nameTh: 'แหล่งมานา', desc: 'MP สูงสุดและการฟื้น MP เพิ่มขึ้น', dmg: 0, mp: 0, cooldown: 0,
        params: { maxMp: passiveP(15, 'MP สูงสุดเพิ่ม'), mpRegen: passiveP(20, 'ฟื้น MP เพิ่ม') } },
      { id: 'mg_arcanepower', kind: 'passive', tier: 2, name: 'Arcane Power', nameTh: 'พลังอาคม', desc: 'ดาเมจทุกอย่างแรงขึ้น แต่ HP สูงสุดลดลง', dmg: 0, mp: 0, cooldown: 0,
        params: { bonus: passiveP(18, 'ดาเมจเพิ่ม'), hpCut: pctP(15, 'HP สูงสุดลดลง') } },
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
