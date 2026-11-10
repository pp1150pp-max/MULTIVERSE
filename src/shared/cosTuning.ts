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
    h: num(0.3, 3, 0.05, 'ขนาด (ความสูงภาพ)'),
    lift: num(-0.5, 2.5, 0.05, 'ความสูงบนหลัง'),
    back: num(-0.6, 0.8, 0.02, 'ถอยไปข้างหลัง (มองด้านข้าง)'),
    depth: num(0, 0.5, 0.01, 'ระยะหน้า/หลังตัว (กันทับตัว)'),
    flap: num(0, 20, 0.5, 'ความเร็วกระพือ ตอนยืน'),
    flapWalk: num(0, 25, 0.5, 'ความเร็วกระพือ ตอนเดิน'),
  },
  mount: {
    h: num(0.3, 3.5, 0.05, 'ขนาด (ความสูงภาพ)'),
    seat: num(0, 1.5, 0.02, 'ความสูงที่นั่ง'),
    headOnLift: num(0, 0.8, 0.02, 'ที่นั่งยกเพิ่ม ตอนหันหน้า/หลังเข้ากล้อง'),
    front: num(-0.5, 0.5, 0.01, 'สัตว์ขี่อยู่หน้าผู้ขี่ ตอนหันหน้า/หลัง'),
    behind: num(-0.5, 0.5, 0.01, 'สัตว์ขี่อยู่หลังผู้ขี่ ตอนหันข้าง/เฉียง'),
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
    alpha: num(0, 1, 0.05, 'ความสว่างวง'),
    pulse: num(0, 0.3, 0.01, 'ระยะเต้นของวง'),
    sparks: num(0, 20, 0.5, 'ประกายต่อวินาที'),
    sparkSize: num(0, 1.5, 0.02, 'ขนาดประกาย'),
    stepEvery: num(0.1, 1, 0.02, 'รอยเท้าทุก ๆ (วินาที)'),
    stepSize: num(0, 1.5, 0.02, 'ขนาดรอยเท้า'),
  },
};

export type TuneValues = Record<string, number | boolean>;

/** Mounts: the values before the bench (owner-approved art fits, #192/#194). */
const MOUNT_DEFAULTS: Record<string, { h: number; seat: number; board?: boolean }> = {
  mount_wolf: { h: 1.5, seat: 0.5 },
  mount_warhorse: { h: 1.7, seat: 0.62 },
  mount_raptor: { h: 1.75, seat: 0.62 },
  mount_tortoise: { h: 1.8, seat: 0.7 },
  mount_hoverboard: { h: 0.7, seat: 0.32, board: true },
};
const PET_FLYING = new Set(['pet_dragon', 'pet_bot', 'pet_wisp']);

/** The code default of every field of one cosmetic (undefined for an unknown id or a title set). */
export function cosTuneDefaults(id: string): TuneValues | undefined {
  const c = cosById(id);
  if (!c || c.slot === 'title') return undefined;
  switch (c.slot) {
    case 'wings':
      // Measured from the art (owner 2026-11-10, #195): the wings' middle sits on the shoulders (~1.35).
      return { h: 1.3, lift: 0.8, back: 0.22, depth: 0.15, flap: 5, flapWalk: 10 };
    case 'mount': {
      const m = MOUNT_DEFAULTS[id];
      return { h: m?.h ?? 1.35, seat: m?.seat ?? 0.55, headOnLift: 0.18, front: 0.12, behind: 0.1, board: m?.board ?? false, anim: 11 };
    }
    case 'pet': {
      const fly = PET_FLYING.has(id);
      return { h: 0.8, back: 1.1, side: 0.6, fly, float: 0.8, bob: 0.1, anim: fly ? 7 : 10 };
    }
    case 'aura':
      return { size: 2.1, alpha: 0.55, pulse: 0.06, sparks: 4, sparkSize: 0.3, stepEvery: 0.28, stepSize: 0.32 };
  }
}

/** Saved server-wide changes: cosmetic id → only the fields that differ from the code default. */
export type CosTuning = Record<string, TuneValues>;

/** Key in the server's settings table. */
export const COS_TUNING_SETTING = 'cos_tuning';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Checks tuning sent by a browser (`strict`: anything unknown, mistyped or out of range is an error) or
 * read back from the database (not strict: such entries are dropped, the rest kept). Numbers are rounded
 * to 2 decimals, fields equal to the code default left out, and the result is in catalogue/field order
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
    const g = given as Record<string, unknown>;
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
        clean = round2(x);
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

/** Same tuning? (both already clean, as checkCosTuning returns them) */
export function sameCosTuning(a: CosTuning, b: CosTuning): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Short text of what differs from `before`, for the audit log (e.g. "wings_angel.lift 0.8 → 0.9"). */
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
