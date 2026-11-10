// Cosmetics: looks only, no stats (the mount's walking speed is the one exception, see MOUNT_SPEED).
// Owned per account (server table account_cosmetics), worn per character (CharacterData.cosmetics).
// Never items: they don't go in the bag, stash, market, trade or mail. Not on sale yet (the shop only
// shows them and lets you try them on); an admin gives them out from /admin.

/** Where a cosmetic is worn. A `title` is a set: a name frame and a chat bubble style (the title text is not shown for now). */
export type CosSlot = 'wings' | 'mount' | 'pet' | 'aura' | 'title';
export const COS_SLOTS: readonly CosSlot[] = ['wings', 'mount', 'pet', 'aura', 'title'];

export const COS_SLOT_NAME: Record<CosSlot, string> = {
  wings: 'ปีก',
  mount: 'สัตว์ขี่',
  pet: 'สัตว์เลี้ยง',
  aura: 'ออร่า / รอยเท้า',
  // Owner 2026-11-10: no titles for now; the set is a name frame and a chat bubble.
  title: 'กรอบชื่อ / ฟองแชท',
};

export interface CosmeticDef {
  id: string;
  /** Sent in snapshots instead of the id: COS_SLOTS index * 16 + n (1–15). Never change a used one. */
  code: number;
  slot: CosSlot;
  name: string;
  desc: string;
  /** Main and second colour of the placeholder look (and the theme of a title set). */
  color: string;
  color2: string;
  /** Title sets only: a title for over the name, kept for later (owner 2026-11-10: not shown for now). */
  title?: string;
}

const def = (slot: CosSlot, n: number, id: string, name: string, desc: string, color: string, color2: string, title?: string): CosmeticDef => ({
  id, code: COS_SLOTS.indexOf(slot) * 16 + n, slot, name, desc, color, color2, ...(title ? { title } : {}),
});

/** The first set: 5 of each kind. The order here is the shop's order. */
export const COSMETICS: readonly CosmeticDef[] = [
  def('wings', 1, 'wings_angel', 'ปีกเทวดา', 'ปีกขนนกสีขาวเรืองแสงอ่อน ๆ', '#ffffff', '#ffe9a8'),
  def('wings', 2, 'wings_bat', 'ปีกค้างคาวรัตติกาล', 'ปีกหนังสีม่วงเข้มแบบค้างคาว', '#5a2a6e', '#c04070'),
  def('wings', 3, 'wings_phoenix', 'ปีกเพลิงฟีนิกซ์', 'ปีกเปลวไฟสีส้มทอง', '#ff7a2a', '#ffd04a'),
  def('wings', 4, 'wings_butterfly', 'ปีกผีเสื้อมรกต', 'ปีกผีเสื้อสีเขียวมรกตโปร่งแสง', '#3fd08a', '#a8ffd8'),
  def('wings', 5, 'wings_mech', 'ปีกกลไกนีออน', 'ปีกโลหะมีเส้นแสงนีออนสีฟ้า', '#3ad6ff', '#2a3a5a'),

  def('mount', 1, 'mount_wolf', 'หมาป่าหิมะ', 'หมาป่าขนขาวจากดินแดนหิมะ', '#dfe9f5', '#7a9ac0'),
  def('mount', 2, 'mount_warhorse', 'ม้าศึกเพลิง', 'ม้าศึกแผงคอเป็นเปลวไฟ', '#e0552a', '#3a2020'),
  def('mount', 3, 'mount_raptor', 'ราปเตอร์ป่ามรกต', 'ไดโนเสาร์ราปเตอร์สีเขียวลายจุด', '#6aa84f', '#e8d080'),
  def('mount', 4, 'mount_hoverboard', 'ฮอเวอร์บอร์ดนีออน', 'บอร์ดลอยฟ้าแสงนีออนจากอีกมิติ', '#3ad6ff', '#ff4ad0'),
  def('mount', 5, 'mount_tortoise', 'เต่ายักษ์ภูเขา', 'เต่ายักษ์มีหินและต้นไม้บนกระดอง', '#8b6f4e', '#5aa04a'),

  def('pet', 1, 'pet_slime', 'ลูกสไลม์', 'สไลม์ตัวจิ๋วกระโดดดึ๋ง ๆ', '#6fdc6f', '#c8ffc8'),
  def('pet', 2, 'pet_cat', 'แมวส้ม', 'แมวส้มขี้เซา เดินตามต้อย ๆ', '#f0a040', '#fff0d8'),
  def('pet', 3, 'pet_dragon', 'มังกรน้อย', 'ลูกมังกรแดงบินได้', '#d84040', '#ffd060'),
  def('pet', 4, 'pet_bot', 'บอทลอยฟ้า', 'หุ่นยนต์ทรงกลมลอยตามเจ้าของ', '#8fb8d8', '#3ad6ff'),
  def('pet', 5, 'pet_wisp', 'ภูติไฟ', 'ดวงไฟวิญญาณลอยวนรอบตัว', '#ffcc33', '#ff7a2a'),

  def('aura', 1, 'aura_star', 'ออร่าแสงดาว', 'ประกายดาวรอบตัว และรอยเท้าเป็นดาว', '#fff3a0', '#ffffff'),
  def('aura', 2, 'aura_frost', 'ออร่าน้ำแข็ง', 'ไอเย็นรอบตัว และรอยเท้าเป็นเกล็ดน้ำแข็ง', '#9fe6ff', '#e8faff'),
  def('aura', 3, 'aura_flame', 'ออร่าเปลวเพลิง', 'เปลวไฟรอบตัว และรอยเท้าเป็นถ่านแดง', '#ff6a2a', '#ffd04a'),
  def('aura', 4, 'aura_void', 'ออร่ามิติม่วง', 'วงแหวนมิติรอบตัว และรอยเท้าเป็นประกายม่วง', '#b07aff', '#4a2a8a'),
  def('aura', 5, 'aura_leaf', 'ออร่าใบไม้', 'ใบไม้ปลิวรอบตัว และรอยเท้าเป็นดอกไม้', '#7ddc6a', '#ffb0d0'),

  def('title', 1, 'title_traveler', 'ชุดผู้เดินทางข้ามมิติ', 'กรอบชื่อ และฟองแชทสีฟ้ามิติ', '#8fd0ff', '#2a4a7a', 'ผู้เดินทางข้ามมิติ'),
  def('title', 2, 'title_flame', 'ชุดราชันย์เพลิง', 'กรอบชื่อ และฟองแชทสีเพลิง', '#ff7a3a', '#5a1a0a', 'ราชันย์เพลิง'),
  def('title', 3, 'title_shadow', 'ชุดเงาแห่งรัตติกาล', 'กรอบชื่อ และฟองแชทสีม่วงรัตติกาล', '#b07aff', '#1a0a2a', 'เงาแห่งรัตติกาล'),
  def('title', 4, 'title_forest', 'ชุดผู้พิทักษ์ป่า', 'กรอบชื่อ และฟองแชทสีเขียวป่า', '#7ddc6a', '#1a3a1a', 'ผู้พิทักษ์ป่า'),
  def('title', 5, 'title_gold', 'ชุดตำนานทองคำ', 'กรอบชื่อ และฟองแชทสีทอง', '#ffd24a', '#5a3a0a', 'ตำนานทองคำ'),
];

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));
const BY_CODE = new Map(COSMETICS.map((c) => [c.code, c]));

export const cosById = (id: unknown): CosmeticDef | undefined => (typeof id === 'string' ? BY_ID.get(id) : undefined);
export const cosByCode = (code: unknown): CosmeticDef | undefined => (typeof code === 'number' ? BY_CODE.get(code) : undefined);

/** What one character wears: slot → cosmetic id. */
export type CosWorn = Partial<Record<CosSlot, string>>;

/** A saved or sent CosWorn with only known cosmetics, each in its own slot (anything else dropped). */
export function cleanCosWorn(v: unknown): CosWorn {
  const out: CosWorn = {};
  if (!v || typeof v !== 'object') return out;
  for (const slot of COS_SLOTS) {
    const c = cosById((v as Record<string, unknown>)[slot]);
    if (c && c.slot === slot) out[slot] = c.id;
  }
  return out;
}

/** Snapshot form of what a character wears (empty = wears nothing). */
export function cosCodes(worn: CosWorn): number[] {
  const out: number[] = [];
  for (const slot of COS_SLOTS) {
    const c = cosById(worn[slot]);
    if (c) out.push(c.code);
  }
  return out;
}

/** Back from snapshot codes (unknown codes and doubled slots dropped). */
export function cosFromCodes(codes: unknown): CosWorn {
  const out: CosWorn = {};
  if (!Array.isArray(codes)) return out;
  for (const code of codes) {
    const c = cosByCode(code);
    if (c && !out[c.slot]) out[c.slot] = c.id;
  }
  return out;
}

/** The ids of an owned list, known cosmetics only, no doubles, catalogue order. */
export function cleanCosOwned(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const set = new Set(v.filter((x) => typeof x === 'string'));
  return COSMETICS.filter((c) => set.has(c.id)).map((c) => c.id);
}

// ------------------------------------------------------------ mount

/** Walking speed while riding (owner: +30%). */
export const MOUNT_SPEED = 1.3;
/** Seconds after the last hit dealt or taken before you can get back on (owner: 3 s). */
export const MOUNT_CALM = 3;
