import type { ClassId, Stats } from '../types';

export type SkillSlot = 'basic' | 'q' | 'e' | 'r' | 'dash';

export interface SkillDef {
  id: string;
  slot: SkillSlot;
  name: string;
  nameTh: string;
  desc: string;
  mp: number;
  cooldown: number;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  nameTh: string;
  desc: string;
  /** Basic attacks per second before atkSpeed bonus. */
  attackRate: number;
  base: Stats;
  growth: Partial<Stats>;
  skills: SkillDef[];
}

const dash = (name: string, nameTh: string): SkillDef => ({
  id: 'dash', slot: 'dash', name, nameTh,
  desc: 'พุ่งไปตามทิศที่เดิน (หรือทิศเมาส์) ไม่รับดาเมจระหว่างพุ่ง',
  mp: 0, cooldown: 2.5,
});

export const CLASSES: Record<ClassId, ClassDef> = {
  sword: {
    id: 'sword',
    name: 'Sword',
    nameTh: 'นักดาบ',
    desc: 'นักรบระยะประชิด ทนทาน ฟันเป็นวงกว้าง เหมาะกับการบุกเข้าหาฝูงมอนสเตอร์',
    attackRate: 1.7,
    base: { maxHp: 130, maxMp: 50, atk: 12, def: 6, crit: 5, critDmg: 50, atkSpeed: 0, moveSpeed: 0, hpRegen: 1.2, mpRegen: 1.5 },
    growth: { maxHp: 20, maxMp: 4, atk: 2.6, def: 1.3, hpRegen: 0.15, mpRegen: 0.05 },
    skills: [
      { id: 'slash', slot: 'basic', name: 'Slash', nameTh: 'ฟัน', desc: 'ฟันเป็นวงโค้งด้านหน้า 100% ATK', mp: 0, cooldown: 0 },
      { id: 'whirlwind', slot: 'q', name: 'Whirlwind', nameTh: 'พายุดาบ', desc: 'หมุนตัวฟันรอบทิศ 180% ATK', mp: 12, cooldown: 4 },
      { id: 'charge', slot: 'e', name: 'Charge', nameTh: 'พุ่งชน', desc: 'พุ่งไปตามทิศเมาส์ ชนศัตรูตลอดทาง 150% ATK และกระเด็น', mp: 15, cooldown: 6 },
      { id: 'earthquake', slot: 'r', name: 'Earthquake', nameTh: 'ปฐพีแยก', desc: 'กระแทกพื้นรอบตัว 300% ATK และสตัน 1.5 วิ', mp: 30, cooldown: 12 },
      dash('Dash', 'แดช'),
    ],
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    nameTh: 'นักเวท',
    desc: 'จอมเวทระยะไกล พลังทำลายสูงแต่เปราะบาง ควบคุมพื้นที่ด้วยเวทธาตุ',
    attackRate: 1.4,
    base: { maxHp: 90, maxMp: 100, atk: 14, def: 3, crit: 5, critDmg: 60, atkSpeed: 0, moveSpeed: 0, hpRegen: 0.8, mpRegen: 3 },
    growth: { maxHp: 12, maxMp: 10, atk: 3, def: 0.7, hpRegen: 0.1, mpRegen: 0.2 },
    skills: [
      { id: 'bolt', slot: 'basic', name: 'Arcane Bolt', nameTh: 'ลูกเวท', desc: 'ยิงลูกเวทไปทางเมาส์ 100% ATK', mp: 0, cooldown: 0 },
      { id: 'fireball', slot: 'q', name: 'Fireball', nameTh: 'ลูกไฟ', desc: 'ลูกไฟระเบิดเป็นวง 220% ATK', mp: 10, cooldown: 2.5 },
      { id: 'frostnova', slot: 'e', name: 'Frost Nova', nameTh: 'วงน้ำแข็ง', desc: 'คลื่นน้ำแข็งรอบตัว 140% ATK และทำให้ช้าลง 50% 3 วิ', mp: 18, cooldown: 7 },
      { id: 'meteor', slot: 'r', name: 'Meteor', nameTh: 'อุกกาบาต', desc: 'เรียกอุกกาบาตลงตำแหน่งเมาส์ 450% ATK', mp: 35, cooldown: 14 },
      dash('Blink', 'วาร์ป'),
    ],
  },
  gunslinger: {
    id: 'gunslinger',
    name: 'Gunslinger',
    nameTh: 'มือปืน',
    desc: 'นักแม่นปืนจากมิติเทคโนโลยี ยิงเร็ว คล่องตัว เด่นเรื่องดาเมจต่อเนื่องและคริติคอล',
    attackRate: 2.6,
    base: { maxHp: 105, maxMp: 70, atk: 9, def: 4, crit: 12, critDmg: 60, atkSpeed: 0, moveSpeed: 5, hpRegen: 1, mpRegen: 2.2 },
    growth: { maxHp: 15, maxMp: 6, atk: 2, def: 0.9, hpRegen: 0.12, mpRegen: 0.12 },
    skills: [
      { id: 'shot', slot: 'basic', name: 'Quick Shot', nameTh: 'ยิงเร็ว', desc: 'ยิงกระสุนความเร็วสูง 100% ATK', mp: 0, cooldown: 0 },
      { id: 'spread', slot: 'q', name: 'Spread Shot', nameTh: 'กระสุนกระจาย', desc: 'ยิงกระสุน 5 นัดเป็นรูปพัด นัดละ 90% ATK', mp: 10, cooldown: 3 },
      { id: 'pierce', slot: 'e', name: 'Piercing Round', nameTh: 'กระสุนเจาะเกราะ', desc: 'กระสุนทะลุทุกเป้าหมายในแนวยาว 260% ATK', mp: 14, cooldown: 5 },
      { id: 'bulletrain', slot: 'r', name: 'Bullet Rain', nameTh: 'ห่ากระสุน', desc: 'สาดกระสุนลงพื้นที่ตำแหน่งเมาส์ 6 ครั้ง ครั้งละ 90% ATK', mp: 30, cooldown: 12 },
      dash('Tumble', 'กลิ้งหลบ'),
    ],
  },
};

export const CLASS_IDS: ClassId[] = ['sword', 'mage', 'gunslinger'];
