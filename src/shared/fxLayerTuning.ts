// Server-wide numbers of the skill effects' extra layer (owner 2026-11-15, docs/systems/skill-fx-layer.md): the glow,
// ground light and particles the game draws over a skill's hand-drawn frames, and the feel of a hit on the caster's
// own screen (screen shake, a short freeze, bigger crit numbers), and how many damage numbers show (owner 2026-11-17:
// cap, merging hits on one target, only your own) and how bullets move between snapshots (2026-11-18). Each effect's own recipe is in src/client/fxLayer.ts;
// these multiply all of them. Tuned on /admin → ปรับสมดุล → "เอฟเฟกต์สกิล (ชั้นเสริม)", saved inside the balance
// tuning (`BalanceTuning.fxLayer`), only what differs from the code.

import { CLASSES } from './data/classes';

export interface FxLayerConfig {
  /** The whole extra layer on or off. */
  enabled: boolean;
  /** Debuff icons over monsters' HP bars and their effects on the body (src/client/debuffFx.ts). */
  debuffs: boolean;
  /** × the glow around the frames. */
  glow: number;
  /** × the light on the ground. */
  ground: number;
  /** × the number of particles. */
  particles: number;
  /** × the screen shake of a hit. */
  shake: number;
  /** Freeze of a full-weight hit (weight 1), in milliseconds. */
  hitstopMs: number;
  /** × the size of crit numbers. */
  crit: number;
  /** Most damage/text numbers on screen at once; past it the oldest goes (owner 2026-11-17, was 120 in code). */
  maxNums: number;
  /** Hits on the same target within `mergeSec` show as one number (summed); crits merge only with crits. */
  mergeNums: boolean;
  /** The merge window, in seconds. */
  mergeSec: number;
  /** Damage numbers only of your own hits and of hits on you (others' are not even sent). */
  ownNumsOnly: boolean;
  /** Bullets fly on smoothly between snapshots instead of snapping back to the server's (older) spot (owner 2026-11-18). */
  smoothShots: boolean;
  /** Magic circles on the ground under debuffed monsters, buffed players and area skills (src/client/magicCircles.ts). */
  circles: boolean;
  /** Lasting area skills shown as a magic circle only, instead of their painted area and standing pieces. */
  zoneCircles: boolean;
  /** × the magic circles' brightness. */
  circleGlow: number;
  /** Paper art (owner 2026-11-18): × the size of a title set's name frame and of its chat bubble. */
  paperPlate: number;
  paperBubble: number;
  /** Paper aura footprint length, × the aura's own step size (cosmetics tab). */
  paperFoot: number;
  /** Paper enhancement orbs: grey from which a part takes the accent colour (band, star), and the darkest shading. */
  paperOrbLight: number;
  paperOrbShade: number;
  /** Each skill's extra effects drawn in code over its painted frames (src/client/skillExtras.ts), and × their strength. */
  extras: boolean;
  extrasK: number;
  /** Per skill (or circle fallback key, CIRCLE_FALLBACKS): only what differs from on / ×1 (owner 2026-11-18). */
  skills: Record<string, SkillFxTune>;
}

/** One skill's magic circle and code effects, as set on /admin. Missing = on / ×1. */
export interface SkillFxTune {
  circle?: boolean;
  /** × the circle's size, turning speed and brightness. */
  size?: number;
  speed?: number;
  bright?: number;
  /** Its code effects on/off and × their strength. */
  extra?: boolean;
  extraK?: number;
}
export const SKILL_FX_RANGE = { size: [0.3, 3], speed: [0, 4], bright: [0, 3], extraK: [0, 3] } as const;
/** Circles shown when the skill is not known (src/client/circleDesigns.ts FALLBACK). */
export const CIRCLE_FALLBACKS = ['buff_attack', 'buff_guard', 'buff_speed', 'debuff_stun', 'debuff_dot', 'debuff_slow', 'debuff_weak', 'debuff_armor', 'debuff_mark', 'zone'] as const;
const SKILL_FX_KEYS = new Set<string>([...Object.values(CLASSES).flatMap((c) => c.skills.map((s) => s.id)), ...CIRCLE_FALLBACKS]);

export type FxLayerTuning = Partial<FxLayerConfig>;

export const FX_LAYER_RANGE = {
  glow: [0, 3],
  ground: [0, 3],
  particles: [0, 3],
  shake: [0, 3],
  hitstopMs: [0, 120],
  crit: [0.5, 2],
  maxNums: [10, 200],
  mergeSec: [0, 1],
  circleGlow: [0, 3],
  paperPlate: [0.5, 2],
  paperBubble: [0.5, 2],
  paperFoot: [0.3, 4],
  paperOrbLight: [0.8, 1],
  paperOrbShade: [0, 1],
  extrasK: [0, 3],
} as const satisfies Record<string, readonly [number, number]>;
export type FxLayerNum = keyof typeof FX_LAYER_RANGE;
export const FX_LAYER_NUMS = Object.keys(FX_LAYER_RANGE) as FxLayerNum[];
export const FX_LAYER_NAME: Record<FxLayerNum, string> = {
  glow: '× แสงเรือง',
  ground: '× แสงบนพื้น',
  particles: '× อนุภาค',
  shake: '× จอสั่น',
  hitstopMs: 'ภาพค้างตอนโดน (ms)',
  crit: '× ขนาดตัวเลขคริ',
  maxNums: 'ตัวเลขบนจอสูงสุด',
  mergeSec: 'รวมเลขที่โดนในช่วง (วิ)',
  circleGlow: '× ความสว่างวงเวท',
  paperPlate: '× ขนาดกรอบชื่อ',
  paperBubble: '× ขนาดฟองแชท',
  paperFoot: 'ขนาดรอยเท้าออร่า (× ขนาดรอยเท้าของชิ้น)',
  paperOrbLight: 'ลูกแก้ว: ส่วนที่ขาวกว่านี้เป็นสีเน้น',
  paperOrbShade: 'ลูกแก้ว: ความสว่างส่วนมืดสุด',
  extrasK: '× ความแรงเอฟเฟกต์โค้ดของสกิล',
};

const FX_LAYER_BOOLS = ['enabled', 'debuffs', 'mergeNums', 'ownNumsOnly', 'smoothShots', 'circles', 'zoneCircles', 'extras'] as const;
type FxLayerBool = (typeof FX_LAYER_BOOLS)[number];
const FX_LAYER_BOOL_NAME: Record<FxLayerBool, string> = {
  enabled: 'เอฟเฟกต์สกิล (ชั้นเสริม)',
  debuffs: 'ดีบัฟบนตัวมอน (ไอคอน + เอฟเฟกต์)',
  mergeNums: 'รวมเลขดาเมจที่โดนพร้อมกัน',
  ownNumsOnly: 'เห็นเฉพาะเลขดาเมจของตัวเอง',
  smoothShots: 'กระสุนบินลื่น (ไม่ดึงกลับตาม server)',
  circles: 'วงเวทบนพื้น (บัฟ ดีบัฟ สกิลวงกว้าง)',
  zoneCircles: 'สกิลวงกว้างเป็นวงเวทอย่างเดียว (แทนภาพพื้นที่)',
  extras: 'เอฟเฟกต์โค้ดของสกิล (ทับภาพเดิม)',
};

/** The code's own numbers (a fresh copy). */
export function codeFxLayer(): FxLayerConfig {
  return {
    enabled: true, debuffs: true, glow: 1, ground: 1, particles: 1, shake: 1, hitstopMs: 60, crit: 1,
    maxNums: 40, mergeNums: true, mergeSec: 0.15, ownNumsOnly: false, smoothShots: true, circles: true, zoneCircles: true, circleGlow: 1,
    paperPlate: 1, paperBubble: 1, paperFoot: 1.6, paperOrbLight: 0.95, paperOrbShade: 0.15,
    extras: true, extrasK: 1, skills: {},
  };
}
const CODE = codeFxLayer();

export function mergeFxLayer(t: FxLayerTuning | undefined): FxLayerConfig {
  const c = codeFxLayer();
  if (!t) return c;
  for (const k of FX_LAYER_BOOLS) if (t[k] !== undefined) c[k] = t[k]!;
  for (const k of FX_LAYER_NUMS) if (t[k] !== undefined) c[k] = t[k]!;
  if (t.skills) c.skills = { ...t.skills };
  return c;
}

/** Checks the per-skill part: known keys only, numbers in range, entries equal to the code's left out. */
function checkSkillFx(x: unknown, strict: boolean): { skills: Record<string, SkillFxTune> | undefined } | { error: string } {
  if (x === undefined) return { skills: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าวงเวท/เอฟเฟกต์รายสกิลไม่ถูกต้อง' } : { skills: undefined };
  const out: Record<string, SkillFxTune> = {};
  for (const [id, v] of Object.entries(x)) {
    if (!SKILL_FX_KEYS.has(id) || !isObj(v)) {
      if (strict) return { error: `ไม่รู้จักสกิล "${id.slice(0, 30)}"` };
      continue;
    }
    const t: SkillFxTune = {};
    for (const k of ['circle', 'extra'] as const) {
      if (v[k] === undefined) continue;
      if (typeof v[k] !== 'boolean') { if (strict) return { error: `${id}: เปิด/ปิดไม่ถูกต้อง` }; continue; }
      if (v[k] === false) t[k] = false;
    }
    for (const k of Object.keys(SKILL_FX_RANGE) as (keyof typeof SKILL_FX_RANGE)[]) {
      const n = v[k];
      if (n === undefined) continue;
      const [lo, hi] = SKILL_FX_RANGE[k];
      if (typeof n !== 'number' || !Number.isFinite(n) || n < lo || n > hi) {
        if (strict) return { error: `${id}: ค่า ${k} ต้องอยู่ระหว่าง ${lo}–${hi}` };
        continue;
      }
      if (round3(n) !== 1) t[k] = round3(n);
    }
    for (const k of Object.keys(v)) if (strict && !['circle', 'extra', ...Object.keys(SKILL_FX_RANGE)].includes(k)) return { error: `${id}: ไม่รู้จักค่า "${k.slice(0, 20)}"` };
    if (Object.keys(t).length) out[id] = t;
  }
  return { skills: Object.keys(out).length ? out : undefined };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Checks the `fxLayer` part of a balance tuning (see checkBalance): strict = errors for anything wrong, else wrong
 * entries are dropped. Values equal to the code are left out. Returns the clean tuning (undefined = nothing differs).
 */
export function checkFxLayerTuning(x: unknown, strict: boolean): { tuning: FxLayerTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าเอฟเฟกต์สกิลไม่ถูกต้อง' } : { tuning: undefined };
  if (strict) {
    const extra = Object.keys(x).find((k) => k !== 'skills' && !(FX_LAYER_BOOLS as readonly string[]).includes(k) && !(FX_LAYER_NUMS as string[]).includes(k));
    if (extra) return { error: `เอฟเฟกต์สกิล: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: FxLayerTuning = {};
  for (const k of FX_LAYER_BOOLS) {
    const v = x[k];
    if (v === undefined) continue;
    if (typeof v !== 'boolean') {
      if (strict) return { error: `เปิด/ปิด ${FX_LAYER_BOOL_NAME[k]} ไม่ถูกต้อง` };
    } else if (v !== CODE[k]) out[k] = v;
  }
  for (const k of FX_LAYER_NUMS) {
    const v = x[k];
    if (v === undefined) continue;
    const [lo, hi] = FX_LAYER_RANGE[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
      if (strict) return { error: `เอฟเฟกต์สกิล "${FX_LAYER_NAME[k]}" ต้องอยู่ระหว่าง ${lo}–${hi}` };
      continue;
    }
    const n = k === 'maxNums' ? Math.round(v) : round3(v);
    if (n !== CODE[k]) out[k] = n;
  }
  const sk = checkSkillFx(x.skills, strict);
  if ('error' in sk) return sk;
  if (sk.skills) out.skills = sk.skills;
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function fxLayerChanges(a: FxLayerConfig, b: FxLayerConfig): string[] {
  const out: string[] = [];
  for (const k of FX_LAYER_BOOLS) if (a[k] !== b[k]) out.push(`${FX_LAYER_BOOL_NAME[k]} ${a[k] ? 'เปิด' : 'ปิด'} → ${b[k] ? 'เปิด' : 'ปิด'}`);
  for (const k of FX_LAYER_NUMS) if (a[k] !== b[k]) out.push(`เอฟเฟกต์สกิล ${FX_LAYER_NAME[k]} ${a[k]} → ${b[k]}`);
  for (const id of new Set([...Object.keys(a.skills), ...Object.keys(b.skills)])) {
    const x = JSON.stringify(a.skills[id] ?? {}), y = JSON.stringify(b.skills[id] ?? {});
    if (x !== y) out.push(`วงเวท/เอฟเฟกต์ ${id} ${x} → ${y}`);
  }
  return out;
}
