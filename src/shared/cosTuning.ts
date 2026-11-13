// How each cosmetic sits and moves on a character (wings' height on the back, a mount's seat, a pet's
// follow distance, an aura's size...). Pure data and checks, no rendering: the code defaults are here,
// the owner can save server-wide changes from the /admin "ของแต่งตัว" tab (settings table), and the
// server sends them to every browser, which draws the cosmetics with them (src/client/cosmeticViews.ts).
//
// Saved as overrides only (cosmetic id → the fields that differ from the code default), so a cosmetic
// added later just uses its code defaults, and an old database with nothing saved uses the code as is.
import { COSMETICS, cosById, type CosSlot } from './data/cosmetics';

/** Slots with a tuning (title sets are name frames and chat bubbles, no 3D placement). */
export type TunedSlot = Exclude<CosSlot, 'title'>;
export const TUNED_SLOTS: readonly TunedSlot[] = ['wings', 'mount', 'pet', 'aura'];

/** One field: a number with its range and slider step, or an on/off switch. `label` is the admin's Thai name. */
export type TuneField =
  | { kind: 'num'; min: number; max: number; step: number; label: string }
  | { kind: 'bool'; label: string };

const num = (min: number, max: number, step: number, label: string): TuneField => ({ kind: 'num', min, max, step, label });
const bool = (label: string): TuneField => ({ kind: 'bool', label });

/** Every field of each slot (the admin sliders use the same ranges; the server checks against them). */
export const COS_TUNE_FIELDS: Record<TunedSlot, Record<string, TuneField>> = {
  wings: {
    h: num(0.3, 3, 0.025, 'ขนาด (ความสูงภาพ)'),
    root: num(0, 1, 0.01, 'โคนปีกอยู่ที่กี่ส่วนของความสูงภาพ (จากล่าง)'),
    backStand: num(0, 2.5, 0.02, 'ความสูงกลางหลัง ตอนยืน'),
    backSeat: num(0, 2.5, 0.02, 'ความสูงกลางหลัง ตอนนั่งขี่ (จากอาน)'),
    back: num(-0.6, 0.8, 0.02, 'ถอยไปข้างหลัง (มองด้านข้าง)'),
    shift: num(-1, 1, 0.01, 'ขยับซ้าย/ขวาบนจอ (บวก = ขวา, หันซ้ายกลับด้านให้เอง)'),
    depth: num(0, 0.5, 0.01, 'ระยะวาดหลังตัว (หรือทับหลัง) ห่างเท่าไร'),
    overBack: bool('หันหลังให้กล้อง: ปีกวาดทับหลัง (ปิด = หลังตัวเสมอ)'),
    // The near wing drawn over the body (a copy of the wings cut at the body's middle, #211).
    // Wings from a single-wing picture, mirrored into the pair (owner 2026-11-12, wingPair.ts). Used when
    // public/assets/sprites/cosmetics/<id>_one.png exists; the fields above are for the old pair picture.
    oneSize: num(0.3, 2.5, 0.01, 'ปีกข้างเดียว: ขนาด (คูณ)'),
    oneBack: num(0, 2.5, 0.01, 'ปีกข้างเดียว: ความสูงโคนปีก ตอนยืน'),
    oneBackSeat: num(0, 2.5, 0.01, 'ปีกข้างเดียว: ความสูงโคนปีก ตอนนั่งขี่ (จากอาน)'),
    oneTilt: num(0, 0.8, 0.01, 'ปีกข้างเดียว: มุมเอียงตอนหันเฉียง'),
    oneSqueeze: num(0.3, 1, 0.01, 'ปีกข้างเดียว: ปีกข้างไกลแคบลงตอนหันเฉียง (คูณ)'),
    oneDepth: num(0, 0.5, 0.01, 'ปีกข้างเดียว: ระยะวาดหลังตัว / ทับหลัง'),
    nearSide: bool('หันข้าง: ปีกข้างใกล้วาดทับหน้าตัว'),
    nearFrontDiag: bool('หันเฉียงเข้ากล้อง: ปีกข้างใกล้วาดทับหน้าตัว'),
    nearBackDiag: bool('หันเฉียงหลัง: ปีกข้างใกล้วาดทับหน้าตัว'),
    nearCut: num(-0.8, 0.8, 0.01, 'ปีกข้างใกล้: เส้นตัด เลื่อนจากกลางตัว (บวก = ไปทางหลัง)'),
    nearDepth: num(0, 0.5, 0.01, 'ปีกข้างใกล้: วาดหน้าตัว ห่างเท่าไร'),
    flap: num(0, 20, 0.5, 'ความเร็วกระพือ ตอนยืน'),
    flapWalk: num(0, 25, 0.5, 'ความเร็วกระพือ ตอนเดิน'),
  },
  mount: {
    h: num(0.3, 3.5, 0.05, 'ขนาด (ความสูงภาพ)'),
    seat: num(0, 1.5, 0.02, 'ความสูงที่นั่ง'),
    shift: num(-1, 1, 0.01, 'ขยับซ้าย/ขวาบนจอ (บวก = ขวา, หันซ้ายกลับด้านให้เอง)'),
    headOnLift: num(0, 0.8, 0.02, 'ที่นั่งยกเพิ่ม ตอนหันหน้าเข้ากล้องตรง ๆ'),
    front: num(-0.5, 0.5, 0.01, 'หัวสัตว์ขี่วาดหน้าผู้ขี่ ห่างเท่าไร (ตอนหันเข้ากล้อง)'),
    cutFrontDiag: bool('ตัด 2 ส่วน ตอนหันเฉียงเข้ากล้อง (ส่วนหัวหน้าผู้ขี่)'),
    cutSide: bool('ตัด 2 ส่วน ตอนหันข้าง (ส่วนหัวหน้าผู้ขี่)'),
    cutBackDiag: bool('ตัด 2 ส่วน ตอนหันเฉียงหลัง (ส่วนหางหน้าผู้ขี่)'),
    splitFront: num(-0.5, 0.5, 0.01, 'ส่วนที่ตัดวาดหน้าผู้ขี่ ห่างเท่าไร'),
    frontDiag: bool('ไม่ตัดตอนเฉียงเข้ากล้อง: หัวทั้งตัวอยู่หน้าผู้ขี่'),
    behind: num(-0.5, 0.5, 0.01, 'สัตว์ขี่วาดหลังผู้ขี่ ห่างเท่าไร (ตอนหันข้าง/หลัง)'),
    under: bool('อยู่ใต้เท้าเสมอ (แบบบอร์ด ไม่สลับหน้า/หลัง)'),
    underBehind: num(0, 0.5, 0.01, 'ระยะวาดหลังผู้ขี่ ตอนอยู่ใต้เท้า'),
    board: bool('ท่ายืนบนบอร์ด (ปิด = นั่งคร่อม)'),
    anim: num(0, 25, 0.5, 'ความเร็วขยับขา'),
  },
  pet: {
    h: num(0.3, 2.5, 0.05, 'ขนาด (ความสูงภาพ)'),
    back: num(0, 3, 0.05, 'ระยะตามหลัง'),
    side: num(-2, 2, 0.05, 'ระยะด้านข้าง'),
    fly: bool('บิน (ปิด = เดินบนพื้น)'),
    float: num(0, 2.5, 0.05, 'ความสูงลอย (ตอนบิน)'),
    bob: num(0, 0.5, 0.01, 'ระยะลอยขึ้นลง (ตอนบิน)'),
    anim: num(0, 25, 0.5, 'ความเร็วขยับ'),
  },
  aura: {
    size: num(0.5, 5, 0.05, 'ขนาดวงบนพื้น'),
    shift: num(-1, 1, 0.01, 'ขยับซ้าย/ขวาบนจอ (บวก = ขวา, หันซ้ายกลับด้านให้เอง)'),
    alpha: num(0, 1, 0.05, 'ความสว่างวง'),
    pulse: num(0, 0.3, 0.01, 'ระยะเต้นของวง'),
    sparks: num(0, 20, 0.5, 'ประกายต่อวินาที'),
    sparkSize: num(0, 1.5, 0.02, 'ขนาดประกาย'),
    stepEvery: num(0.1, 1, 0.02, 'รอยเท้าทุก ๆ (วินาที)'),
    stepSize: num(0, 1.5, 0.02, 'ขนาดรอยเท้า'),
  },
};

export type TuneValues = Record<string, number | boolean>;

// ---- X / Y / Z axes (owner 2026-11-11) ----
// X = the character's right (+) / left, Y = up / down, Z = forward (+) / back, turning with the way the
// character faces. The base value of each axis is one of the fields above (kept under its old key so old
// saves read as they are, nothing jumps); on top of it each of the 8 facings has its own offset
// `d<axis>_at_<dir>`, added in that facing only. Left / right are the side of the SCREEN the character faces.
export type Axis = 'x' | 'y' | 'z';
export const AXES: readonly Axis[] = ['x', 'y', 'z'];
export type ViewDir = 'front' | 'frontRight' | 'right' | 'backRight' | 'back' | 'backLeft' | 'left' | 'frontLeft';
export const VIEW_DIRS: readonly ViewDir[] = ['front', 'frontRight', 'right', 'backRight', 'back', 'backLeft', 'left', 'frontLeft'];
export const VIEW_DIR_NAME: Record<ViewDir, string> = {
  front: 'หน้า', frontRight: 'เฉียงหน้าขวา', right: 'ขวา', backRight: 'เฉียงหลังขวา', back: 'หลัง', backLeft: 'เฉียงหลังซ้าย', left: 'ซ้าย', frontLeft: 'เฉียงหน้าซ้าย',
};

/** The facing from a sheet row (0 front, 1 front diagonal, 2 side, 3 back diagonal, 4 back) and the screen side it faces. */
export function viewDirOf(row: number, faceRight: boolean): ViewDir {
  if (row <= 0) return 'front';
  if (row >= 4) return 'back';
  const side = faceRight ? 'Right' : 'Left';
  return (row === 1 ? `front${side}` : row === 2 ? side.toLowerCase() : `back${side}`) as ViewDir;
}
/** The sheet row of a facing (the sprite sheets are drawn for 5 rows, the rest mirrored). */
export const rowOfViewDir = (d: ViewDir): number => (d === 'front' ? 0 : d === 'back' ? 4 : d === 'left' || d === 'right' ? 2 : d.startsWith('front') ? 1 : 3);
/** Z points into / out of the camera from straight front and back, X from the side: no visible effect there. */
export const axisHiddenInDir = (axis: Axis, d: ViewDir): boolean => (axis === 'z' && (d === 'front' || d === 'back')) || (axis === 'x' && (d === 'left' || d === 'right'));
/** Field key of an axis's offset in a facing. */
export const viewOffKey = (axis: Axis, d: ViewDir): string => `d${axis}_at_${d}`;

// Before 2026-11-11 (late) the offsets were per group: front (front + both front diagonals), side (left + right),
// back (back + both back diagonals). Saved ones are copied to every facing the group covered. The offsets are
// relative to the character, so the same number gives the same place on the screen as before.
const LEGACY_GROUP: Record<string, ViewDir[]> = {
  front: ['front', 'frontLeft', 'frontRight'],
  side: ['left', 'right'],
  back: ['back', 'backLeft', 'backRight'],
};
const LEGACY_KEY = /^d([xyz])_(front|side|back)$/;
/** A saved entry with any old per-group offsets spread to the facings (a facing's own saved value wins). */
function expandLegacy(g: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(g)) {
    const m = LEGACY_KEY.exec(k);
    if (m) for (const d of LEGACY_GROUP[m[2]]) out[`d${m[1]}_at_${d}`] = v;
    else out[k] = v;
  }
  for (const [k, v] of Object.entries(g)) if (!LEGACY_KEY.test(k)) out[k] = v;
  return out;
}

export interface AxisSpec {
  axis: Axis;
  /** The base field this axis reads (value shown = sign × field). */
  key: string;
  sign: 1 | -1;
  label: string;
  /** Hidden for a piece whose switch `key` is off (a pet that walks has no height). */
  onlyIf?: string;
  /** Wings only: the height while riding (the other Y is standing). */
  ride?: boolean;
}

/** The axes each kind of piece has (a field of COS_TUNE_FIELDS each). The aura is flat on the ground: X only. */
export const COS_AXES: Record<TunedSlot, AxisSpec[]> = {
  wings: [
    { axis: 'x', key: 'shift', sign: 1, label: 'X ซ้าย/ขวา' },
    { axis: 'y', key: 'backStand', sign: 1, label: 'Y ขึ้น/ลง (ตอนยืน)' },
    { axis: 'y', key: 'backSeat', sign: 1, label: 'Y ขึ้น/ลง (ตอนขี่ จากอาน)', ride: true },
    { axis: 'z', key: 'back', sign: -1, label: 'Z หน้า/หลัง' },
  ],
  mount: [
    { axis: 'x', key: 'shift', sign: 1, label: 'X ซ้าย/ขวา' },
    { axis: 'y', key: 'seat', sign: 1, label: 'Y ความสูงที่นั่ง' },
    { axis: 'z', key: 'z', sign: 1, label: 'Z หน้า/หลัง' },
  ],
  pet: [
    { axis: 'x', key: 'side', sign: -1, label: 'X ซ้าย/ขวา' },
    { axis: 'y', key: 'float', sign: 1, label: 'Y ความสูงลอย', onlyIf: 'fly' },
    { axis: 'z', key: 'back', sign: -1, label: 'Z หน้า/หลัง' },
  ],
  aura: [{ axis: 'x', key: 'shift', sign: 1, label: 'X ซ้าย/ขวา' }],
};

// The new fields: the mount's own Z, and every view offset.
COS_TUNE_FIELDS.mount.z = num(-1.5, 1.5, 0.02, 'ขยับหน้า/หลังของตัวละคร');
for (const slot of TUNED_SLOTS) {
  for (const s of COS_AXES[slot]) {
    for (const g of VIEW_DIRS) {
      const key = viewOffKey(s.axis, g);
      if (!COS_TUNE_FIELDS[slot][key]) COS_TUNE_FIELDS[slot][key] = num(-1.5, 1.5, 0.005, `ส่วนปรับ ${s.axis.toUpperCase()} ทิศ${VIEW_DIR_NAME[g]}`);
    }
  }
}
const zeroViewOffsets = (slot: TunedSlot): TuneValues =>
  Object.fromEntries(Object.keys(COS_TUNE_FIELDS[slot]).filter((k) => /^d[xyz]_/.test(k)).map((k) => [k, 0]));

/**
 * Mounts: the values before the bench (owner-approved art fits, #192/#194/#198). The hoverboard and the
 * tortoise are out of the catalogue for now (owner 2026-11-10, #200), so these two rows are unused (no
 * sliders, saved values for them ignored); kept so they come back as they were if their lines return.
 */
const MOUNT_DEFAULTS: Record<string, { h: number; seat: number; board?: boolean; under?: boolean }> = {
  mount_wolf: { h: 1.5, seat: 0.5 },
  mount_warhorse: { h: 1.7, seat: 0.62 },
  mount_raptor: { h: 1.75, seat: 0.62 },
  mount_tortoise: { h: 1.8, seat: 0.7 },
  // Owner 2026-11-10 (#198): it was too small and off the feet. The rider stands on the deck and it
  // always stays right under the feet (`under`).
  mount_hoverboard: { h: 1.2, seat: 0.5, board: true, under: true },
};
const PET_FLYING = new Set(['pet_dragon', 'pet_bot', 'pet_wisp']);

/** The code default of every field of one cosmetic (undefined for an unknown id or a title set). */
export function cosTuneDefaults(id: string): TuneValues | undefined {
  const c = cosById(id);
  if (!c || c.slot === 'title') return undefined;
  const d = baseDefaults(id, c.slot);
  return d && { ...d, ...zeroViewOffsets(c.slot) };
}

function baseDefaults(id: string, slot: TunedSlot): TuneValues | undefined {
  switch (slot) {
    case 'wings':
      // Owner 2026-11-10: 25% bigger than the first 1.3 (#197); roots (60% up the picture) on the middle of
      // the back, 1.35 up standing and 1.0 above the saddle riding; behind the body, over the back when it
      // is turned to the camera (#200).
      return { h: 1.625, root: 0.6, backStand: 1.35, backSeat: 1, back: 0.22, shift: 0, depth: 0.15, overBack: true,
        oneSize: 0.9, oneBack: 1.125, oneBackSeat: 0.85, oneTilt: 0.18, oneSqueeze: 0.8, oneDepth: 0.15,
        nearSide: true, nearFrontDiag: false, nearBackDiag: false, nearCut: 0, nearDepth: 0.15, flap: 5, flapWalk: 10 };
    case 'mount': {
      const m = MOUNT_DEFAULTS[id];
      // Draw order by view (#198-#201): the head in front of the rider facing the camera; cut in two around
      // the rider on the front diagonal, the side and the back diagonal (the end nearer the camera in front,
      // the rest behind); the rider on top from straight behind; a board always just behind the feet.
      return {
        h: m?.h ?? 1.35, seat: m?.seat ?? 0.55, shift: 0, headOnLift: 0.18, front: 0.1, cutFrontDiag: true, cutSide: true, z: 0, cutBackDiag: true, splitFront: 0.1, frontDiag: true, behind: 0.1,
        under: m?.under ?? false, underBehind: 0.05, board: m?.board ?? false, anim: 11,
      };
    }
    case 'pet': {
      const fly = PET_FLYING.has(id);
      return { h: 0.8, back: 1.1, side: 0.6, fly, float: 0.8, bob: 0.1, anim: fly ? 7 : 10 };
    }
    case 'aura':
      return { size: 2.1, shift: 0, alpha: 0.55, pulse: 0.06, sparks: 4, sparkSize: 0.3, stepEvery: 0.28, stepSize: 0.32 };
  }
}

/** Saved server-wide changes: cosmetic id → only the fields that differ from the code default. */
export type CosTuning = Record<string, TuneValues>;

/** Key in the server's settings table. */
export const COS_TUNING_SETTING = 'cos_tuning';

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Checks tuning sent by a browser (`strict`: anything unknown, mistyped or out of range is an error) or
 * read back from the database (not strict: such entries are dropped, the rest kept). Numbers are rounded
 * to 3 decimals, fields equal to the code default left out, and the result is in catalogue/field order
 * (so two equal tunings give the same JSON). Returns the clean tuning or a Thai error.
 */
export function checkCosTuning(v: unknown, strict: boolean): { tuning: CosTuning; error?: undefined } | { tuning?: undefined; error: string } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return strict ? { error: 'ค่าของแต่งตัวไม่ถูกต้อง' } : { tuning: {} };
  const o = v as Record<string, unknown>;
  if (strict) {
    const bad = Object.keys(o).find((id) => !cosTuneDefaults(id));
    if (bad) return { error: `ไม่มีของแต่งตัว "${bad.slice(0, 30)}"` };
  }
  const out: CosTuning = {};
  for (const c of COSMETICS) {
    const defs = cosTuneDefaults(c.id);
    const given = o[c.id];
    if (!defs || given === undefined) continue;
    if (!given || typeof given !== 'object' || Array.isArray(given)) {
      if (strict) return { error: `ค่าของ ${c.id} ไม่ถูกต้อง` };
      continue;
    }
    const g = expandLegacy(given as Record<string, unknown>);
    const fields = COS_TUNE_FIELDS[c.slot as TunedSlot];
    if (strict) {
      const extra = Object.keys(g).find((k) => !(k in fields));
      if (extra) return { error: `${c.id}: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
    }
    const vals: TuneValues = {};
    for (const [k, f] of Object.entries(fields)) {
      const x = g[k];
      if (x === undefined) continue;
      let clean: number | boolean;
      if (f.kind === 'bool') {
        if (typeof x !== 'boolean') {
          if (strict) return { error: `${c.id}: ค่า ${k} ต้องเป็น true/false` };
          continue;
        }
        clean = x;
      } else {
        if (typeof x !== 'number' || !Number.isFinite(x)) {
          if (strict) return { error: `${c.id}: ค่า ${k} ต้องเป็นตัวเลข` };
          continue;
        }
        if (x < f.min || x > f.max) {
          if (strict) return { error: `${c.id}: ค่า ${k} ต้องอยู่ระหว่าง ${f.min} ถึง ${f.max}` };
          continue;
        }
        // The default itself is kept exact (e.g. the wings' 1.625), so it is never stored as a change.
        clean = x === defs[k] ? x : round3(x);
      }
      if (clean !== defs[k]) vals[k] = clean;
    }
    if (Object.keys(vals).length) out[c.id] = vals;
  }
  return { tuning: out };
}

/** The values one cosmetic uses: its code defaults with the saved changes on top. */
export function cosTuneOf(tuning: CosTuning, id: string): TuneValues | undefined {
  const d = cosTuneDefaults(id);
  return d && { ...d, ...tuning[id] };
}

/**
 * The tuning after saving only the fields of ONE cosmetic that `part` picks (its base values, or one view
 * group's offsets) from what is tried out now (`cur`): everything else stays as `saved`. Returns the clean tuning.
 */
export function savePartOf(saved: CosTuning, id: string, cur: TuneValues, part: (key: string) => boolean): CosTuning {
  const base = cosTuneOf(saved, id);
  const c = cosById(id);
  if (!base || !c || c.slot === 'title') return saved;
  const vals: TuneValues = { ...base };
  for (const k of Object.keys(COS_TUNE_FIELDS[c.slot])) if (part(k)) vals[k] = cur[k];
  return checkCosTuning({ ...saved, [id]: vals }, false).tuning ?? saved;
}

/**
 * Pasting text copied from the bench ("คัดลอกค่าที่ตั้งไว้") onto the saved tuning, for editing many pieces at
 * once (the /admin "จัดการของแต่งตัว" tab). The text is cosmetic id → its changes from the code default, so
 * every piece it names gets exactly those values (fields left out = code default); pieces it doesn't name stay
 * as saved. The copy button names every tuned piece (`{}` for one at its code default); older copies named only
 * the changed pieces and paste the same way. Checked strictly (an error on anything wrong); `only` limits it
 * to some of the named pieces. Returns the clean tuning and the ids it named.
 */
export function pasteCosTuning(saved: CosTuning, text: unknown, only?: readonly string[]): { tuning: CosTuning; ids: string[]; error?: undefined } | { tuning?: undefined; ids?: undefined; error: string } {
  const c = checkCosTuning(text, true);
  if (!c.tuning) return { error: c.error };
  const named = new Set(Object.keys(text as object));
  const ids = COSMETICS.filter((x) => named.has(x.id) && (!only || only.includes(x.id))).map((x) => x.id);
  const next: CosTuning = { ...saved };
  for (const id of ids) {
    if (c.tuning[id]) next[id] = c.tuning[id];
    else delete next[id];
  }
  return { tuning: checkCosTuning(next, false).tuning ?? {}, ids };
}

/** Same tuning? (both already clean, as checkCosTuning returns them) */
export function sameCosTuning(a: CosTuning, b: CosTuning): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Short text of what differs from `before`, for the audit log (e.g. "wings_angel.backStand 1.35 → 1.4"). */
export function cosTuningChanges(before: CosTuning, after: CosTuning): string {
  const out: string[] = [];
  for (const c of COSMETICS) {
    const a = cosTuneOf(before, c.id);
    const b = cosTuneOf(after, c.id);
    if (!a || !b) continue;
    for (const k of Object.keys(a)) if (a[k] !== b[k]) out.push(`${c.id}.${k} ${a[k]} → ${b[k]}`);
  }
  return out.join(', ');
}
