// Per-facing fixes of the player characters' animations (owner 2026-11-18: running looked odd in some directions).
// Pure data and checks, no rendering. For each class × picture set × animation × screen facing the owner can pick
// the picture row, mirror it or not, speed it up / slow it down (the run cycle's step rate), nudge it and resize it,
// from the /admin "ท่าตัวละคร" tab. Saved server-wide in the settings table as changes only (nothing saved = the
// code as is), sent to every browser, used by AnimatedActor / RigActor when drawing.

export const ANIM_CLASSES = ['sword', 'gunslinger', 'mage'] as const;
export type AnimClass = (typeof ANIM_CLASSES)[number];
/** The picture sets: the old pixel art, the papercraft art (#316), the sword knight's 2D bone rig (#302). */
export const ANIM_ARTS = ['old', 'paper', 'rig'] as const;
export type AnimArt = (typeof ANIM_ARTS)[number];
export const ANIM_NAMES = ['idle', 'run', 'run_attack', 'attack', 'attack_2', 'attack_3', 'death', 'ride', 'ride_board'] as const;
export type AnimName = (typeof ANIM_NAMES)[number];
/** Facings on screen: n = away from the camera (up the screen), e = screen right. */
export const SCREEN_DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export type ScreenDir = (typeof SCREEN_DIRS)[number];
/** Picture rows a sprite sheet may have (AnimatedActor's Dir without the never-used left/right). */
export const ANIM_ROWS = ['down', 'down_side', 'side', 'up_side', 'up'] as const;
export type AnimRow = (typeof ANIM_ROWS)[number];

export interface DirTune {
  /** Picture row to use instead of the nearest one (absent = automatic). */
  row?: AnimRow;
  /** true = mirrored, false = as drawn (absent = automatic: the right side mirrors the left). */
  flip?: boolean;
  /** Playback speed: the run cycle's step rate, or the animation's fps (1 = as the game plays it). */
  rate?: number;
  /** Nudge on screen in world units (character ≈ 2.4 tall): x = right, y = up. */
  x?: number;
  y?: number;
  /** Size multiplier, around the feet. */
  scale?: number;
}
/** `${class}.${art}.${anim}` → facing → its changes. */
export type AnimTuning = Record<string, Partial<Record<ScreenDir, DirTune>>>;

export const ANIM_TUNING_SETTING = 'anim_tuning';

export const ANIM_TUNE_RANGE = {
  rate: { min: 0.25, max: 3, step: 0.01 },
  x: { min: -1, max: 1, step: 0.01 },
  y: { min: -1, max: 1, step: 0.01 },
  scale: { min: 0.5, max: 2, step: 0.01 },
} as const;
type NumField = keyof typeof ANIM_TUNE_RANGE;
const NUM_FIELDS = Object.keys(ANIM_TUNE_RANGE) as NumField[];
const NUM_DEFAULT: Record<NumField, number> = { rate: 1, x: 0, y: 0, scale: 1 };
/** The bone rig draws itself from a front and a back view: only its speed can be changed. */
const RIG_FIELDS: readonly (keyof DirTune)[] = ['rate'];

export const CLASS_NAME: Record<AnimClass, string> = { sword: 'นักดาบ', gunslinger: 'มือปืน', mage: 'จอมเวท' };
export const ART_NAME: Record<AnimArt, string> = { old: 'ภาพเดิม', paper: 'ภาพกระดาษ', rig: 'นักดาบกระดูก' };
export const ANIM_NAME: Record<AnimName, string> = {
  idle: 'ยืน', run: 'วิ่ง', run_attack: 'โจมตีขณะวิ่ง', attack: 'โจมตี 1', attack_2: 'โจมตี 2', attack_3: 'โจมตี 3',
  death: 'ตาย', ride: 'ขี่สัตว์', ride_board: 'ขี่บอร์ด',
};
export const DIR_NAME: Record<ScreenDir, string> = { n: '↑', ne: '↗', e: '→', se: '↘', s: '↓', sw: '↙', w: '←', nw: '↖' };
export const ROW_NAME: Record<AnimRow, string> = { down: 'หน้า', down_side: 'ทแยงหน้า', side: 'ข้าง', up_side: 'ทแยงหลัง', up: 'หลัง' };
const FIELD_NAME: Record<keyof DirTune, string> = { row: 'แถวภาพ', flip: 'พลิก', rate: 'ความเร็ว', x: 'เลื่อนขวา', y: 'เลื่อนขึ้น', scale: 'ขนาด' };

export const animKey = (cls: string, art: AnimArt, anim: string): string => `${cls}.${art}.${anim}`;

/**
 * The screen facing of an actor's (sx, sy) (AnimatedActor.face: sx > 0 = screen right, sy < 0 = toward the camera),
 * to the nearest of the 8.
 */
export function screenDirOf(sx: number, sy: number): ScreenDir {
  const deg = (Math.atan2(sx, -sy) * 180) / Math.PI; // 0 = down the screen, 90 = right
  const i = ((Math.round(deg / 45) % 8) + 8) % 8;
  return (['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'] as const)[i];
}

const isIn = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

/** One facing's changes, cleaned (defaults dropped, fields in a fixed order). Null = bad (strict) or empty. */
function checkDir(v: unknown, rig: boolean, strict: boolean, where: string): { tune?: DirTune; error?: string } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return strict ? { error: `${where}: ไม่ใช่ชุดค่า` } : {};
  const o = v as Record<string, unknown>;
  const out: DirTune = {};
  for (const [k, val] of Object.entries(o)) {
    const allowed = rig ? RIG_FIELDS.includes(k as keyof DirTune) : k in FIELD_NAME;
    if (!allowed) {
      if (strict) return { error: `${where}: ปรับ "${k}" ไม่ได้` };
      continue;
    }
    if (k === 'row') {
      if (isIn(ANIM_ROWS, val)) out.row = val;
      else if (strict) return { error: `${where}: แถวภาพไม่ถูกต้อง` };
    } else if (k === 'flip') {
      if (typeof val === 'boolean') out.flip = val;
      else if (strict) return { error: `${where}: พลิกต้องเป็นใช่/ไม่ใช่` };
    } else {
      const f = k as NumField;
      const r = ANIM_TUNE_RANGE[f];
      if (typeof val !== 'number' || !Number.isFinite(val) || val < r.min || val > r.max) {
        if (strict) return { error: `${where}: ${FIELD_NAME[f]} ต้องอยู่ระหว่าง ${r.min} ถึง ${r.max}` };
        continue;
      }
      const n = Math.round(val * 100) / 100;
      if (n !== NUM_DEFAULT[f]) out[f] = n;
    }
  }
  // Fixed field order, so two equal tunings serialize the same.
  const ordered: DirTune = {};
  for (const k of ['row', 'flip', ...NUM_FIELDS] as (keyof DirTune)[]) if (out[k] !== undefined) (ordered as Record<string, unknown>)[k] = out[k];
  return Object.keys(ordered).length ? { tune: ordered } : {};
}

/**
 * Checks a tuning from the admin page (strict: any bad value is an error) or the database / the server's message
 * (lenient: what the code no longer knows is dropped). Returns it clean: only changes, keys sorted.
 */
export function checkAnimTuning(v: unknown, strict: boolean): { tuning?: AnimTuning; error?: string } {
  if (v === undefined || v === null) return { tuning: {} };
  if (typeof v !== 'object' || Array.isArray(v)) return strict ? { error: 'ค่าท่าตัวละครไม่ถูกต้อง' } : { tuning: {} };
  const out: AnimTuning = {};
  for (const key of Object.keys(v as object).sort()) {
    const [cls, art, anim, extra] = key.split('.');
    if (!isIn(ANIM_CLASSES, cls) || !isIn(ANIM_ARTS, art) || !isIn(ANIM_NAMES, anim) || extra !== undefined || (art === 'rig' && cls !== 'sword')) {
      if (strict) return { error: `ไม่รู้จักท่า "${key}"` };
      continue;
    }
    const dirsIn = (v as Record<string, unknown>)[key];
    if (!dirsIn || typeof dirsIn !== 'object' || Array.isArray(dirsIn)) {
      if (strict) return { error: `${key}: ไม่ใช่ชุดค่า` };
      continue;
    }
    const dirs: Partial<Record<ScreenDir, DirTune>> = {};
    for (const d of Object.keys(dirsIn)) {
      if (!isIn(SCREEN_DIRS, d)) {
        if (strict) return { error: `${key}: ไม่รู้จักทิศ "${d}"` };
        continue;
      }
      const c = checkDir((dirsIn as Record<string, unknown>)[d], art === 'rig', strict, `${key} ${DIR_NAME[d]}`);
      if (c.error) return { error: c.error };
      if (c.tune) dirs[d] = c.tune;
    }
    const ordered: Partial<Record<ScreenDir, DirTune>> = {};
    for (const d of SCREEN_DIRS) if (dirs[d]) ordered[d] = dirs[d];
    if (Object.keys(ordered).length) out[key] = ordered;
  }
  return { tuning: out };
}

export const sameAnimTuning = (a: AnimTuning, b: AnimTuning): boolean =>
  JSON.stringify(checkAnimTuning(a, false).tuning) === JSON.stringify(checkAnimTuning(b, false).tuning);

const showField = (k: keyof DirTune, v: unknown): string => {
  if (v === undefined) return k === 'row' || k === 'flip' ? 'อัตโนมัติ' : k === 'rate' || k === 'scale' ? '×1' : '0';
  if (k === 'row') return ROW_NAME[v as AnimRow];
  if (k === 'flip') return v ? 'พลิก' : 'ไม่พลิก';
  return k === 'rate' || k === 'scale' ? `×${v}` : String(v);
};

/** Thai before → after of every changed value, for admin_audit. */
export function animTuningChanges(before: AnimTuning, after: AnimTuning): string {
  const out: string[] = [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const key of keys) {
    const [cls, art, anim] = key.split('.') as [AnimClass, AnimArt, AnimName];
    const name = `${CLASS_NAME[cls] ?? cls} ${ART_NAME[art] ?? art} ${ANIM_NAME[anim] ?? anim}`;
    for (const d of SCREEN_DIRS) {
      const a = before[key]?.[d] ?? {};
      const b = after[key]?.[d] ?? {};
      const diffs: string[] = [];
      for (const k of Object.keys(FIELD_NAME) as (keyof DirTune)[]) {
        if (a[k] !== b[k]) diffs.push(`${FIELD_NAME[k]} ${showField(k, a[k])} → ${showField(k, b[k])}`);
      }
      if (diffs.length) out.push(`${name} ${DIR_NAME[d]}: ${diffs.join(', ')}`);
    }
  }
  return out.join(' · ') || 'ไม่มีอะไรเปลี่ยน';
}
