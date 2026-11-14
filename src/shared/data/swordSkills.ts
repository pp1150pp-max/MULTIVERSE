// Swordsman's 30 skills and 3 passives (owner approved 2026-11-14, docs/plans/sword-skills.md). Line 0 Blade
// (damage), line 1 Gale (dashes, combos, speed), line 2 Bulwark (stuns, taunts, less damage taken, buffs for
// everyone in the circle). The sword has a blade, a scabbard and armour, no shield (owner). Every number in
// `params` is tuned per skill on the /admin balance tab; `status` ones (times, passive effects) grow by the skill's
// status %/rank. What each skill does is in sim/swordSkills.ts and its reach in SWORD_REACH below.
import type { SkillDef, SkillParam } from './classes';
import type { SkillReach } from './skillRanges';

/** Seconds that grow with rank (stuns, slows, buffs). */
const sec = (v: number, nameTh: string, hi = 30): SkillParam => ({ v, nameTh, unit: 'วิ', lo: 0, hi, status: true });
/** Seconds that stay put (charging, delays, gaps). */
const secFixed = (v: number, nameTh: string, lo = 0, hi = 5): SkillParam => ({ v, nameTh, unit: 'วิ', lo, hi });
const pct = (v: number, nameTh: string, hi = 100): SkillParam => ({ v, nameTh, unit: '%', lo: 0, hi });
/** A passive's % that grows with rank (owner 2026-11-14: +5% of the value a rank, like every class). */
const pctGrow = (v: number, nameTh: string, hi = 200): SkillParam => ({ v, nameTh, unit: '%', lo: 0, hi, status: true });
const metres = (v: number, nameTh: string, hi = 30): SkillParam => ({ v, nameTh, unit: 'ม.', lo: 0.5, hi });
const count = (v: number, nameTh: string, unit: string, lo = 1, hi = 20): SkillParam => ({ v, nameTh, unit, lo, hi });
const deg = (v: number, nameTh: string): SkillParam => ({ v, nameTh, unit: '°', lo: 10, hi: 360 });

type Def = Omit<SkillDef, 'kind' | 'line' | 'tier'>;
const normal = (line: number, tier: number, d: Def): SkillDef => ({ kind: 'normal', line, tier, ...d });
const ult = (line: number, tier: number, d: Def): SkillDef => ({ kind: 'ult', line, tier, ...d });
const passive = (tier: number, d: Omit<Def, 'anim' | 'dmg' | 'mp' | 'cooldown'>): SkillDef =>
  ({ kind: 'passive', tier, dmg: 0, mp: 0, cooldown: 0, ...d });

export const SWORD_SKILLS: SkillDef[] = [
  // ---------------- Line 0: Blade (damage)
  normal(0, 0, { id: 'whirlwind', anim: 'q', name: 'Whirlwind', nameTh: 'พายุดาบ', desc: 'หมุนตัวฟันรอบทิศ ไม่รับดาเมจชั่วครู่ และดูดเลือดจากดาเมจที่ทำ', dmg: 1.8, mp: 15, cooldown: 6,
    params: { guard: sec(0.6, 'ไม่รับดาเมจ'), lifesteal: pct(5, 'ดูดเลือด'), lifestealTime: sec(3, 'เวลาดูดเลือด') } }),
  normal(0, 1, { id: 'sw_heavyslash', anim: 'q', name: 'Heavy Slash', nameTh: 'ฟันหนัก', desc: 'ฟันแรงด้านหน้าเป็นแนวแคบ', dmg: 2.6, mp: 14, cooldown: 5,
    params: { arc: deg(90, 'มุมฟัน') } }),
  normal(0, 2, { id: 'sw_sunder', anim: 'q', name: 'Sunder', nameTh: 'ฟันทำลายเกราะ', desc: 'ฟันด้านหน้า ลดพลังป้องกันของศัตรู ทุกคนที่ตีเป้านั้นแรงขึ้น', dmg: 2, mp: 16, cooldown: 7,
    params: { armorBreak: pct(25, 'ลดพลังป้องกัน'), armorBreakTime: sec(4, 'เวลาลดพลังป้องกัน') } }),
  normal(0, 3, { id: 'sw_swordwave', anim: 'q', name: 'Sword Wave', nameTh: 'คลื่นดาบ', desc: 'ปล่อยคมดาบพุ่งเป็นแนว ทะลุทุกตัวที่ผ่าน', dmg: 2.2, mp: 18, cooldown: 6 }),
  normal(0, 4, { id: 'sw_execute', anim: 'q', name: 'Execute', nameTh: 'ประหาร', desc: 'ฟันด้านหน้า ศัตรูที่ HP ต่ำโดนแรงขึ้น (บอสได้โบนัสน้อยกว่า)', dmg: 2.6, mp: 20, cooldown: 8,
    params: { below: pct(30, 'HP ต่ำกว่า'), bonus: pct(100, 'ดาเมจเพิ่ม', 500), bossShare: pct(50, 'บอสได้โบนัส') } }),
  normal(0, 5, { id: 'sw_flurry', anim: 'q', name: 'Blade Flurry', nameTh: 'คมดาบต่อเนื่อง', desc: 'ฟันรัวด้านหน้าหลายครั้งติดกัน (ดาเมจต่อครั้ง)', dmg: 0.7, mp: 22, cooldown: 8,
    params: { hits: count(5, 'จำนวนครั้ง', 'ครั้ง'), time: secFixed(0.6, 'เวลาฟันทั้งชุด', 0.1, 3) } }),
  normal(0, 6, { id: 'sw_bladering', anim: 'q', name: 'Blade Ring', nameTh: 'วงแหวนคมดาบ', desc: 'คลื่นฟันรอบตัวหลายระลอก (ดาเมจต่อระลอก)', dmg: 2.4, mp: 26, cooldown: 10,
    params: { waves: count(2, 'จำนวนระลอก', 'ระลอก', 1, 6), gap: secFixed(0.3, 'ระลอกห่างกัน', 0.05, 2) } }),
  normal(0, 7, { id: 'sw_crush', anim: 'e', name: 'Crushing Blow', nameTh: 'ทุบทำลาย', desc: 'กระโดดทุบลงจุดที่เมาส์ แรงขึ้นกับบอส', dmg: 4.5, mp: 30, cooldown: 12,
    params: { radius: metres(2.2, 'วงทุบ'), bossBonus: pct(50, 'ดาเมจกับบอสเพิ่ม', 500) } }),
  ult(0, 0, { id: 'sw_unleash', anim: 'e', name: 'Unleash', nameTh: 'ปลดปล่อยพลัง', desc: 'ยืนชาร์จพลังครู่หนึ่ง แล้วระเบิดพลังรอบตัวพร้อมสตัน', dmg: 7, mp: 40, cooldown: 20,
    params: { charge: secFixed(0.8, 'เวลาชาร์จ'), stun: sec(1, 'สตัน') } }),
  ult(0, 1, { id: 'sw_judgement', anim: 'e', name: 'Judgement', nameTh: 'ดาบพิพากษา', desc: 'ดาบยักษ์ตกลงจุดที่เมาส์ (มีวงเตือน) และลดพลังป้องกันศัตรู', dmg: 9, mp: 50, cooldown: 30,
    params: { radius: metres(3, 'วงตก'), delay: secFixed(0.8, 'ดาบตกหลัง'), armorBreak: pct(30, 'ลดพลังป้องกัน'), armorBreakTime: sec(5, 'เวลาลดพลังป้องกัน') } }),

  // ---------------- Line 1: Gale (dashes, combos, speed). Every dash takes no damage on the way.
  normal(1, 0, { id: 'charge', anim: 'r', name: 'Charge', nameTh: 'พุ่งชน', desc: 'พุ่งไปตามทิศเมาส์ ชนศัตรูตลอดทางและกระเด็น ทุกครั้งที่ฆ่ามอนได้ คูลดาวน์ที่เหลือลดลง', dmg: 1.6, mp: 12, cooldown: 6,
    params: { killCdCut: pct(50, 'ฆ่ามอนได้ ลดคูลดาวน์ที่เหลือ') } }),
  normal(1, 1, { id: 'sw_triple', anim: 'q', name: 'Triple Combo', nameTh: 'คอมโบสามจังหวะ', desc: 'ฟันด้านหน้า 3 จังหวะ จังหวะสุดท้ายแรงขึ้น (ดาเมจต่อจังหวะ)', dmg: 0.9, mp: 14, cooldown: 5,
    params: { finisher: { v: 2, nameTh: 'จังหวะสุดท้าย ×', unit: 'เท่า', lo: 1, hi: 10 } } }),
  normal(1, 2, { id: 'sw_backstep', anim: 'q', name: 'Backstep Slash', nameTh: 'ถอยฟัน', desc: 'ฟันด้านหน้าแล้วกระโดดถอยหลัง ศัตรูที่โดนเดินช้าลง', dmg: 1.8, mp: 14, cooldown: 7,
    params: { back: metres(3.5, 'ระยะถอย', 10), slow: pct(30, 'ช้าลง'), slowTime: sec(2, 'เวลาช้าลง') } }),
  normal(1, 3, { id: 'sw_hunt', anim: 'r', name: 'Hunt', nameTh: 'ไล่ล่า', desc: 'พุ่งเข้าหาเมาส์ ฟันตลอดทาง แล้วตีเร็วขึ้นชั่วคราว', dmg: 1.5, mp: 18, cooldown: 10,
    params: { atkSpeed: pct(30, 'ความเร็วโจมตีเพิ่ม', 300), buffTime: sec(4, 'เวลาบัฟ') } }),
  normal(1, 4, { id: 'sw_spindodge', anim: 'r', name: 'Spin Dodge', nameTh: 'หมุนตัวหลบ', desc: 'พุ่งสั้นๆ แล้วหมุนฟันรอบตัวตรงจุดที่หยุด', dmg: 2.2, mp: 20, cooldown: 8,
    params: { spin: metres(2.8, 'วงหมุน', 10) } }),
  normal(1, 5, { id: 'sw_bladedance', anim: 'r', name: 'Blade Dance', nameTh: 'ระบำดาบ', desc: 'พุ่งสั้นหลายครั้งติดกันตามเมาส์ ฟันรอบตัวทุกครั้งที่พุ่ง (ดาเมจต่อครั้ง)', dmg: 1.1, mp: 22, cooldown: 9,
    params: { steps: count(3, 'จำนวนครั้ง', 'ครั้ง', 1, 6), spin: metres(2.2, 'วงฟัน', 10) } }),
  normal(1, 6, { id: 'sw_shadowstep', anim: 'r', name: 'Shadow Step', nameTh: 'ก้าวเงา', desc: 'พุ่งไกลเร็ว ฟันรอบจุดที่ไปถึง แล้วติดคริติคอลง่ายขึ้นชั่วคราว', dmg: 2, mp: 24, cooldown: 12,
    params: { spin: metres(2.5, 'วงฟัน', 10), crit: pct(25, 'คริติคอลเพิ่ม'), buffTime: sec(4, 'เวลาบัฟ') } }),
  normal(1, 7, { id: 'sw_overdrive', anim: 'e', name: 'Overdrive', nameTh: 'เร่งเครื่อง', desc: 'บัฟตัวเอง: ตีเร็วขึ้นและเดินเร็วขึ้น', dmg: 0, mp: 30, cooldown: 18,
    params: { atkSpeed: pct(40, 'ความเร็วโจมตีเพิ่ม', 300), moveSpeed: pct(20, 'ความเร็วเดินเพิ่ม'), buffTime: sec(6, 'เวลาบัฟ') } }),
  ult(1, 0, { id: 'sw_shadowswap', anim: 'r', name: 'Shadow Swap', nameTh: 'เงาสลับร่าง', desc: 'พุ่งใส่ศัตรูที่ใกล้ที่สุดทีละตัว ไม่รับดาเมจตลอดท่า (ดาเมจต่อเป้า)', dmg: 3.5, mp: 40, cooldown: 20,
    params: { targets: count(3, 'จำนวนเป้า', 'ตัว', 1, 10) } }),
  ult(1, 1, { id: 'sw_thousandcuts', anim: 'q', name: 'Thousand Cuts', nameTh: 'พันคมดาบ', desc: 'หายตัวฟันศัตรูรอบตัวแบบสุ่มเป้า ไม่รับดาเมจตลอดท่า (ดาเมจต่อครั้ง)', dmg: 1.6, mp: 55, cooldown: 30,
    params: { hits: count(8, 'จำนวนครั้ง', 'ครั้ง', 1, 30), time: secFixed(1.2, 'เวลาท่า', 0.2, 5) } }),

  // ---------------- Line 2: Bulwark (stuns, taunts, less damage taken, buffs for everyone in the circle)
  normal(2, 0, { id: 'earthquake', anim: 'e', name: 'Earthquake', nameTh: 'ปฐพีแยก', desc: 'กระแทกพื้นรอบตัวและสตัน', dmg: 2, mp: 20, cooldown: 7, params: { stun: sec(1, 'สตัน') } }),
  normal(2, 1, { id: 'sw_armorbash', anim: 'q', name: 'Armor Bash', nameTh: 'กระแทกเกราะ', desc: 'พุ่งไหล่เกราะกระแทกด้านหน้า สตันและผลักไปไกล', dmg: 1.6, mp: 12, cooldown: 6,
    params: { stun: sec(1.5, 'สตัน') } }),
  normal(2, 2, { id: 'sw_taunt', anim: 'e', name: 'Taunt', nameTh: 'ยั่วยุ', desc: 'ศัตรูรอบตัว (บอสด้วย) หันมาตีเรา และเรารับดาเมจน้อยลงชั่วคราว', dmg: 0, mp: 10, cooldown: 12,
    params: { less: pct(20, 'รับดาเมจลดลง', 95), buffTime: sec(4, 'เวลาบัฟ') } }),
  normal(2, 3, { id: 'sw_guard', anim: 'e', name: 'Guard', nameTh: 'ตั้งรับ', desc: 'ตั้งดาบรับ รับดาเมจน้อยลงมากชั่วคราว', dmg: 0, mp: 15, cooldown: 14,
    params: { less: pct(40, 'รับดาเมจลดลง', 95), buffTime: sec(3, 'เวลาบัฟ') } }),
  normal(2, 4, { id: 'sw_shockwave', anim: 'e', name: 'Shockwave', nameTh: 'คลื่นสั่นสะเทือน', desc: 'คลื่นกระแทกพื้นเป็นแนว ทะลุทุกตัว ทำให้ช้าลง', dmg: 2.4, mp: 20, cooldown: 8,
    params: { slow: pct(40, 'ช้าลง'), slowTime: sec(3, 'เวลาช้าลง') } }),
  normal(2, 5, { id: 'sw_thorns', anim: 'e', name: 'Thorn Armor', nameTh: 'เกราะสะท้อน', desc: 'ดาเมจที่โดนสะท้อนกลับใส่มอนที่ตีเรา และรับดาเมจน้อยลงเล็กน้อย', dmg: 0, mp: 22, cooldown: 16,
    params: { reflect: pct(30, 'สะท้อนดาเมจ', 500), less: pct(10, 'รับดาเมจลดลง', 95), buffTime: sec(6, 'เวลาบัฟ') } }),
  normal(2, 6, { id: 'sw_anchor', anim: 'e', name: 'Anchor', nameTh: 'ปักหลัก', desc: 'รับดาเมจลดลงครึ่งหนึ่ง ไม่โดนสตันหรือกระเด็น แต่เดินช้าลง', dmg: 0, mp: 25, cooldown: 20,
    params: { less: pct(50, 'รับดาเมจลดลง', 95), moveSlow: pct(30, 'เดินช้าลง', 90), buffTime: sec(5, 'เวลาบัฟ') } }),
  normal(2, 7, { id: 'sw_warcry', anim: 'e', name: 'War Cry', nameTh: 'ปลุกใจนักรบ', desc: 'บัฟผู้เล่นทุกคนที่ยืนในวง (ไม่ต้องอยู่ปาร์ตี้): พลังป้องกันและพลังโจมตีเพิ่ม', dmg: 0, mp: 30, cooldown: 25,
    params: { def: pct(30, 'พลังป้องกันเพิ่ม', 300), atk: pct(15, 'พลังโจมตีเพิ่ม', 300), buffTime: sec(8, 'เวลาบัฟ') } }),
  ult(2, 0, { id: 'sw_cataclysm', anim: 'e', name: 'Cataclysm', nameTh: 'ปฐพีถล่ม', desc: 'แผ่นดินแยก 3 ระลอกขยายออกจากตัว สตันและทำให้ช้า (ดาเมจต่อระลอก)', dmg: 3, mp: 45, cooldown: 25,
    params: { gap: secFixed(0.35, 'ระลอกห่างกัน', 0.05, 2), stun: sec(1.2, 'สตัน'), slow: pct(40, 'ช้าลง'), slowTime: sec(3, 'เวลาช้าลง') } }),
  ult(2, 1, { id: 'sw_unbreakable', anim: 'e', name: 'Unbreakable', nameTh: 'ราชันย์ไม่ล้ม', desc: 'ยั่วยุศัตรูรอบตัวทั้งหมด รับดาเมจน้อยลงมาก และฟื้น HP ตลอดท่า', dmg: 0, mp: 50, cooldown: 40,
    params: { less: pct(60, 'รับดาเมจลดลง', 95), heal: pct(25, 'ฟื้น HP สูงสุด', 100), buffTime: sec(6, 'เวลาท่า') } }),

  // ---------------- Passives (one worn at a time)
  passive(0, { id: 'sw_duelist', name: 'Duelist', nameTh: 'นักดวล', desc: 'ดาเมจเพิ่มเมื่อศัตรูรอบตัวมีไม่เกินที่กำหนด (เหมาะกับตีบอส)',
    params: { dmg: pctGrow(12, 'ดาเมจเพิ่ม'), near: { v: 2, nameTh: 'ศัตรูรอบตัวไม่เกิน', unit: 'ตัว', lo: 1, hi: 20 }, area: metres(6, 'รัศมีนับศัตรู', 20) } }),
  passive(1, { id: 'sw_lightfeet', name: 'Light Feet', nameTh: 'เท้าคล่อง', desc: 'หลังแดชหรือใช้ท่าพุ่ง ดาเมจเพิ่มชั่วคราว และคูลดาวน์แดชสั้นลง',
    params: { dmg: pctGrow(15, 'ดาเมจเพิ่ม'), time: sec(3, 'เวลาบัฟหลังพุ่ง'), dashCd: pctGrow(10, 'คูลดาวน์แดชลดลง', 90) } }),
  passive(2, { id: 'sw_ironhide', name: 'Iron Hide', nameTh: 'เกราะเหล็ก', desc: 'พลังป้องกันเพิ่ม และเมื่อ HP ต่ำ รับดาเมจน้อยลงอีก',
    params: { def: pctGrow(10, 'พลังป้องกันเพิ่ม'), lowHp: pct(40, 'HP ต่ำกว่า'), less: pctGrow(20, 'รับดาเมจลดลงเมื่อ HP ต่ำ', 95) } }),
];

/**
 * How each sword skill reaches (see SkillReach). Buffs on the player alone (Guard, Thorn Armor, Anchor, Overdrive)
 * have none. A landing circle's size is the skill's `radius` number.
 */
export const SWORD_REACH: Record<string, SkillReach> = {
  whirlwind: { kind: 'self', radius: 3.2 },
  sw_heavyslash: { kind: 'cone', range: 2.8 },
  sw_sunder: { kind: 'cone', range: 2.6 },
  sw_swordwave: { kind: 'shot', range: 10 },
  sw_execute: { kind: 'cone', range: 2.6 },
  sw_flurry: { kind: 'cone', range: 2.4 },
  sw_bladering: { kind: 'self', radius: 4.5 },
  sw_crush: { kind: 'point', range: 3, radius: 2.2 },
  sw_unleash: { kind: 'self', radius: 5.5 },
  sw_judgement: { kind: 'point', range: 8, radius: 3 },
  charge: { kind: 'dash', range: 6 },
  sw_triple: { kind: 'cone', range: 2.6 },
  sw_backstep: { kind: 'cone', range: 2.6 },
  sw_hunt: { kind: 'dash', range: 6 },
  sw_spindodge: { kind: 'dash', range: 3 },
  /** All the steps together. */
  sw_bladedance: { kind: 'dash', range: 7.5 },
  sw_shadowstep: { kind: 'dash', range: 7 },
  /** How far it looks for targets. */
  sw_shadowswap: { kind: 'self', radius: 7 },
  sw_thousandcuts: { kind: 'self', radius: 6 },
  earthquake: { kind: 'self', radius: 4.5 },
  sw_armorbash: { kind: 'cone', range: 2.4 },
  sw_taunt: { kind: 'self', radius: 6 },
  sw_shockwave: { kind: 'shot', range: 9 },
  sw_warcry: { kind: 'self', radius: 8 },
  /** The last (largest) wave; the first ones are 3/7 and 5/7 of it. */
  sw_cataclysm: { kind: 'self', radius: 7 },
  sw_unbreakable: { kind: 'self', radius: 8 },
};
