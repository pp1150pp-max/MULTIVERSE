// Gunslinger's 30 skills and 3 passives (owner approved 2026-11-14). Line 0 Critical/Precision, line 1 Rapid Fire
// (powers up the basic shot: on-hit damage, owner 2026-11-14), line 2 Special Weapons. Every number in `params`
// is tuned per skill on the /admin balance tab; `status` ones (times, passive effects) grow by status %/rank.
// What each skill does is in sim/skills.ts (castSkill) and its reach in data/skillRanges.ts.
import type { SkillDef, SkillParam } from './classes';

/** Seconds that grow with rank (buff and status times). */
const sec = (v: number, nameTh: string, hi = 30): SkillParam => ({ v, nameTh, unit: 'วิ', lo: 0, hi, status: true });
/** Seconds that stay put (aiming, charging, firing gaps). */
const secFixed = (v: number, nameTh: string, lo = 0, hi = 5): SkillParam => ({ v, nameTh, unit: 'วิ', lo, hi });
const pct = (v: number, nameTh: string, hi = 100): SkillParam => ({ v, nameTh, unit: '%', lo: 0, hi });
/** A passive's % that grows with rank. */
const pctGrow = (v: number, nameTh: string, hi = 200): SkillParam => ({ v, nameTh, unit: '%', lo: 0, hi, status: true });
const metres = (v: number, nameTh: string): SkillParam => ({ v, nameTh, unit: 'ม.', lo: 0.5, hi: 30 });
const count = (v: number, nameTh: string, unit: string, lo = 1, hi = 20): SkillParam => ({ v, nameTh, unit, lo, hi });
/** Extra damage × ATK (on-hit, burning, bomblets): grows with the skill's damage %/rank (skillParam). */
const atk = (v: number, nameTh: string): SkillParam => ({ v, nameTh, unit: '×ATK', lo: 0, hi: 10, dmg: true });
const deg = (v: number, nameTh: string): SkillParam => ({ v, nameTh, unit: '°', lo: 0, hi: 180 });

type Def = Omit<SkillDef, 'kind'>;
const normal = (line: number, tier: number, d: Omit<Def, 'line' | 'tier'>): SkillDef => ({ kind: 'normal', line, tier, ...d });
const ult = (line: number, tier: number, d: Omit<Def, 'line' | 'tier'>): SkillDef => ({ kind: 'ult', line, tier, ...d });
const passive = (tier: number, d: Omit<Def, 'line' | 'tier' | 'anim' | 'dmg' | 'mp' | 'cooldown'>): SkillDef =>
  ({ kind: 'passive', tier, dmg: 0, mp: 0, cooldown: 0, ...d });

export const GUNSLINGER_SKILLS: SkillDef[] = [
  // ---------------- Line 0: Critical / Precision
  normal(0, 0, { id: 'pierce', anim: 'e', name: 'Armor-Piercing Round', nameTh: 'กระสุนเจาะเกราะ', desc: 'กระสุนนัดหนัก หยุดที่เป้าแรก ลดพลังป้องกันของเป้าหมาย', dmg: 1.5, mp: 14, cooldown: 5,
    params: { armorBreak: pct(20, 'ลดพลังป้องกัน'), armorBreakTime: sec(3, 'เวลาลดพลังป้องกัน') } }),
  normal(0, 1, { id: 'gs_deadeye', anim: 'e', name: 'Deadeye', nameTh: 'เล็งจุดตาย', desc: 'ยิงติดเครื่องหมาย เป้าที่โดนจะโดนคุณคริติคอลง่ายขึ้น', dmg: 0.8, mp: 12, cooldown: 8,
    params: { markCrit: pct(30, 'โอกาสคริเพิ่ม'), markTime: sec(5, 'เวลาเครื่องหมาย') } }),
  normal(0, 2, { id: 'gs_aimedshot', anim: 'r', name: 'Aimed Shot', nameTh: 'ยิงประณีต', desc: 'ยืนเล็งสั้นๆ แล้วยิงนัดแรง', dmg: 2.4, mp: 16, cooldown: 6,
    params: { aim: secFixed(0.4, 'เวลาเล็ง') } }),
  normal(0, 3, { id: 'gs_ricochet', anim: 'q', name: 'Ricochet', nameTh: 'กระสุนสะท้อน', desc: 'กระสุนโดนเป้าแล้วเด้งไปหาเป้าใกล้ที่ยังไม่โดน', dmg: 1.2, mp: 16, cooldown: 6,
    params: { bounces: count(3, 'เด้ง', 'ครั้ง', 0, 10), bounceRange: metres(6, 'ระยะเด้ง') } }),
  normal(0, 4, { id: 'gs_counter', anim: 'e', name: 'Counter Shot', nameTh: 'ยิงสวนกลับ', desc: 'กระโดดถอยหลัง (ไม่รับดาเมจระหว่างกระโดด) แล้วยิงสวนไปทางเมาส์', dmg: 1.8, mp: 15, cooldown: 8,
    params: { backstep: metres(4, 'ระยะถอย'), critBonus: pct(50, 'โอกาสคริเพิ่ม') } }),
  normal(0, 5, { id: 'gs_weakspot', anim: 'e', name: 'Weak Spot', nameTh: 'เจาะจุดอ่อน', desc: 'แรงขึ้นถ้าเป้าเกราะแตกหรือติดเครื่องหมายเล็งจุดตายของคุณ', dmg: 2, mp: 18, cooldown: 7,
    params: { bonus: pct(60, 'แรงขึ้น', 300) } }),
  normal(0, 6, { id: 'gs_finisher', anim: 'e', name: 'Finisher', nameTh: 'ยิงปิดฉาก', desc: 'แรงขึ้นหลายเท่าถ้าเป้า HP เหลือน้อย', dmg: 2.2, mp: 20, cooldown: 9,
    params: { hpBelow: pct(30, 'HP ต่ำกว่า'), execMult: { v: 2, nameTh: 'ดาเมจคูณ', unit: '×', lo: 1, hi: 5 } } }),
  normal(0, 7, { id: 'gs_lockon', anim: 'q', name: 'Lock-On', nameTh: 'ล็อกเป้า', desc: 'ล็อกเป้าที่ใกล้เมาส์ที่สุด แล้วยิงใส่เป้านั้นหลายนัด (ดาเมจต่อนัด)', dmg: 0.9, mp: 24, cooldown: 10,
    params: { shots: count(5, 'จำนวนนัด', 'นัด'), critBonus: pct(25, 'โอกาสคริเพิ่ม'), lockRadius: metres(4, 'หาเป้ารอบเมาส์') } }),
  ult(0, 0, { id: 'headshot', anim: 'r', name: 'Headshot', nameTh: 'ยิงหัว', desc: 'ยืนนิ่งเล็งแล้วยิงนัดเดียว คริติคอลแน่นอน บวกความแรงคริติคอลของตัวละคร', dmg: 3, mp: 30, cooldown: 12,
    params: { aim: secFixed(0.8, 'เวลาเล็ง') } }),
  ult(0, 1, { id: 'gs_sniperfocus', anim: 'r', name: 'Sniper Focus', nameTh: 'โฟกัสสไนเปอร์', desc: 'บัฟตัวเอง: โอกาสคริและความแรงคริเพิ่มขึ้นชั่วคราว', dmg: 0, mp: 35, cooldown: 30,
    params: { crit: pct(40, 'โอกาสคริเพิ่ม'), critDmg: pct(50, 'แรงคริเพิ่ม', 300), time: sec(8, 'เวลาบัฟ') } }),

  // ---------------- Line 1: Rapid Fire (the basic shot)
  normal(1, 0, { id: 'rapidfire', anim: 'q', name: 'Rapid Fire', nameTh: 'ยิงรัว', desc: 'ยิงรัวหลายนัดติดกันไปทางเมาส์ (ดาเมจต่อนัด)', dmg: 0.4, mp: 10, cooldown: 3,
    params: { shots: count(3, 'จำนวนนัด', 'นัด', 1, 10) } }),
  normal(1, 1, { id: 'gs_hotrounds', anim: 'q', name: 'Hot Rounds', nameTh: 'กระสุนร้อน', desc: 'บัฟ: ยิงปกติทุกนัดได้ดาเมจเพิ่ม (on-hit)', dmg: 0, mp: 12, cooldown: 10,
    params: { onHit: atk(0.3, 'on-hit'), time: sec(6, 'เวลาบัฟ') } }),
  normal(1, 2, { id: 'gs_quickreload', anim: 'q', name: 'Quick Reload', nameTh: 'รีโหลดฉับไว', desc: 'บัฟ: ยิงปกติเร็วขึ้น', dmg: 0, mp: 15, cooldown: 14,
    params: { atkSpeed: pct(40, 'ยิงเร็วขึ้น', 300), time: sec(5, 'เวลาบัฟ') } }),
  normal(1, 3, { id: 'gs_doubletap', anim: 'q', name: 'Double Tap', nameTh: 'ยิงสองนัด', desc: 'บัฟ: ยิงปกตินัดถัดไปออกทีละ 2 นัด นัดที่สองแรงน้อยกว่า', dmg: 0, mp: 16, cooldown: 12,
    params: { shots: count(8, 'ใช้ได้', 'ครั้ง', 1, 50), second: pct(60, 'นัดที่ 2 แรง', 200) } }),
  normal(1, 4, { id: 'gs_shockrounds', anim: 'q', name: 'Shock Rounds', nameTh: 'กระสุนช็อต', desc: 'บัฟ: ยิงปกติทำให้เป้าช้าลงและได้ดาเมจเพิ่ม (on-hit)', dmg: 0, mp: 16, cooldown: 12,
    params: { onHit: atk(0.2, 'on-hit'), slow: pct(25, 'ช้าลง'), slowTime: sec(1.5, 'เวลาช้าลง'), time: sec(6, 'เวลาบัฟ') } }),
  normal(1, 5, { id: 'gs_stackfire', anim: 'q', name: 'Focused Fire', nameTh: 'ยิงย้ำเป้า', desc: 'บัฟ: ยิงปกติโดนเป้าเดิมซ้ำ ดาเมจเพิ่ม (on-hit) ทบขึ้นทีละชั้น เปลี่ยนเป้าแล้วนับใหม่', dmg: 0, mp: 18, cooldown: 14,
    params: { perStack: atk(0.08, 'on-hit ต่อชั้น'), maxStacks: count(10, 'ชั้นสูงสุด', 'ชั้น', 1, 50), time: sec(8, 'เวลาบัฟ') } }),
  normal(1, 6, { id: 'gs_splitshot', anim: 'q', name: 'Split Shot', nameTh: 'กระสุนแยก', desc: 'บัฟ: ยิงปกติแตกออกหลายทาง ลูกข้างแรงน้อยกว่า', dmg: 0, mp: 20, cooldown: 15,
    params: { bullets: count(3, 'จำนวนลูก', 'ลูก', 2, 9), arc: deg(20, 'มุมกระจาย'), side: pct(50, 'ลูกข้างแรง', 200), time: sec(6, 'เวลาบัฟ') } }),
  normal(1, 7, { id: 'gs_piercerounds', anim: 'q', name: 'Piercing Rounds', nameTh: 'กระสุนทะลวง', desc: 'บัฟ: ยิงปกติทะลุทุกตัวและได้ดาเมจเพิ่ม (on-hit)', dmg: 0, mp: 22, cooldown: 16,
    params: { onHit: atk(0.25, 'on-hit'), time: sec(6, 'เวลาบัฟ') } }),
  ult(1, 0, { id: 'gs_overdrive', anim: 'q', name: 'Overdrive', nameTh: 'โอเวอร์ไดรฟ์', desc: 'บัฟ: ยิงเร็วมาก วิ่งเร็วขึ้น และยิงปกติได้ดาเมจเพิ่ม (on-hit)', dmg: 0, mp: 35, cooldown: 30,
    params: { atkSpeed: pct(80, 'ยิงเร็วขึ้น', 300), moveSpeed: pct(15, 'วิ่งเร็วขึ้น'), onHit: atk(0.3, 'on-hit'), time: sec(6, 'เวลาบัฟ') } }),
  ult(1, 1, { id: 'gs_bulletstorm', anim: 'q', name: 'Bullet Storm', nameTh: 'พายุลูกกระสุน', desc: 'บัฟ: ยิงปกติทุกนัดออกเป็นพัดหลายลูก (ดาเมจต่อลูก บวก on-hit)', dmg: 0.6, mp: 45, cooldown: 40,
    params: { pellets: count(5, 'จำนวนลูก', 'ลูก', 2, 15), arc: deg(40, 'มุมกระจาย'), time: sec(8, 'เวลาบัฟ') } }),

  // ---------------- Line 2: Special Weapons
  normal(2, 0, { id: 'gs_explosive', anim: 'e', name: 'Explosive Round', nameTh: 'กระสุนระเบิด', desc: 'กระสุนระเบิดเป็นวงเมื่อกระทบ', dmg: 1.6, mp: 12, cooldown: 4,
    params: { blast: metres(2.4, 'รัศมีระเบิด') } }),
  normal(2, 1, { id: 'gs_incendiary', anim: 'e', name: 'Incendiary Round', nameTh: 'กระสุนเพลิง', desc: 'ทำให้เป้าติดไฟ โดนดาเมจทุกวินาที', dmg: 1, mp: 12, cooldown: 5,
    params: { burn: atk(0.3, 'ไฟต่อวินาที'), burnTime: sec(4, 'เวลาติดไฟ') } }),
  normal(2, 2, { id: 'gs_mine', anim: 'e', name: 'Land Mine', nameTh: 'กับระเบิด', desc: 'วางกับระเบิดที่เท้า ระเบิดและสตันเมื่อศัตรูเข้าใกล้', dmg: 2.5, mp: 16, cooldown: 8,
    params: { trigger: metres(1.5, 'ระยะกระตุ้น'), stun: sec(0.8, 'สตัน'), life: sec(15, 'อยู่ได้', 60) } }),
  normal(2, 3, { id: 'gs_smoke', anim: 'e', name: 'Smoke Grenade', nameTh: 'ระเบิดควัน', desc: 'ปาควันตรงเมาส์ ศัตรูในควันโดนดาเมจทุกวินาทีและช้าลง', dmg: 0.4, mp: 16, cooldown: 10,
    params: { radius: metres(3.5, 'รัศมีควัน'), time: sec(4, 'เวลาควัน'), slow: pct(40, 'ช้าลง') } }),
  normal(2, 4, { id: 'gs_railgun', anim: 'r', name: 'Railgun', nameTh: 'กระสุนรางแม่เหล็ก', desc: 'ยืนชาร์จแล้วยิงทะลุทุกตัวเป็นแนว', dmg: 3, mp: 22, cooldown: 9,
    params: { charge: secFixed(0.6, 'เวลาชาร์จ') } }),
  normal(2, 5, { id: 'gs_drone', anim: 'e', name: 'Support Drone', nameTh: 'โดรนสนับสนุน', desc: 'โดรนบินตามตัว ยิงเป้าที่ใกล้ที่สุดเป็นระยะ (ดาเมจต่อนัด)', dmg: 0.6, mp: 24, cooldown: 18,
    params: { every: secFixed(0.8, 'ยิงทุก', 0.1, 5), life: sec(10, 'อยู่ได้') } }),
  normal(2, 6, { id: 'gs_seeker', anim: 'e', name: 'Seeker Rockets', nameTh: 'จรวดติดตาม', desc: 'ยิงจรวดไปหาเป้าที่ใกล้ที่สุดคนละตัว แล้วระเบิด', dmg: 1.4, mp: 22, cooldown: 9,
    params: { rockets: count(3, 'จำนวนจรวด', 'ลูก', 1, 10), blast: metres(1.8, 'รัศมีระเบิด') } }),
  normal(2, 7, { id: 'gs_cluster', anim: 'e', name: 'Cluster Bomb', nameTh: 'ระเบิดลูกปราย', desc: 'ระเบิดใหญ่ตรงเมาส์ แล้วแตกเป็นระเบิดลูกเล็กรอบๆ', dmg: 2, mp: 26, cooldown: 11,
    params: { radius: metres(3, 'รัศมีระเบิดใหญ่'), bomblets: count(5, 'ลูกเล็ก', 'ลูก', 0, 15), bombletDmg: atk(0.8, 'ลูกเล็กแรง'), bombletBlast: metres(1.5, 'รัศมีลูกเล็ก') } }),
  ult(2, 0, { id: 'gs_rocketrain', anim: 'e', name: 'Rocket Rain', nameTh: 'ฝนจรวด', desc: 'จรวดหลายลูกตกสุ่มในวงตรงเมาส์ (ดาเมจต่อลูก)', dmg: 1.2, mp: 32, cooldown: 15,
    params: { radius: metres(4, 'รัศมีวงตก'), rockets: count(10, 'จำนวนจรวด', 'ลูก', 1, 30), rocketBlast: metres(1.8, 'รัศมีระเบิดต่อลูก'), spread: secFixed(1.5, 'ตกครบใน') } }),
  ult(2, 1, { id: 'gs_turret', anim: 'e', name: 'Portable Turret', nameTh: 'ป้อมปืนพกพา', desc: 'วางป้อมปืนที่เท้า ยิงเป้าที่ใกล้ที่สุดเองเป็นระยะ (ดาเมจต่อนัด)', dmg: 0.7, mp: 40, cooldown: 30,
    params: { every: secFixed(0.35, 'ยิงทุก', 0.1, 5), life: sec(12, 'อยู่ได้') } }),

  // ---------------- Passives
  passive(0, { id: 'gs_hawkeye', name: 'Hawkeye', nameTh: 'สายตาเหยี่ยว', desc: 'โอกาสคริและความแรงคริเพิ่มขึ้น',
    params: { crit: pctGrow(8, 'โอกาสคริเพิ่ม'), critDmg: pctGrow(20, 'แรงคริเพิ่ม') } }),
  passive(1, { id: 'gs_triggerfinger', name: 'Trigger Finger', nameTh: 'นิ้วไกไว', desc: 'ยิงเร็วขึ้นและวิ่งเร็วขึ้น',
    params: { atkSpeed: pctGrow(15, 'ยิงเร็วขึ้น'), moveSpeed: pctGrow(5, 'วิ่งเร็วขึ้น') } }),
  passive(2, { id: 'gs_specialammo', name: 'Special Ammo', nameTh: 'กระสุนพิเศษ', desc: 'สกิลสายอาวุธพิเศษแรงขึ้น และวงระเบิด/พื้นที่ใหญ่ขึ้น',
    params: { dmg: pctGrow(15, 'สายอาวุธพิเศษแรงขึ้น'), area: pctGrow(15, 'วงระเบิดใหญ่ขึ้น') } }),
];
