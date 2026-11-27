// The light of each map (docs/systems/shaders.md, plan 4.3 and 4.7, owner 2026-11-27): its tone, mist and sun shafts, and
// what the full-screen light layer (src/client/postFx.ts) draws from them at each level. Code defaults per map; /admin →
// ปรับสมดุล → "น้ำ ลม และแสง (shader)" changes them, saved inside the balance tuning (`BalanceTuning.sceneGrade`), only
// what differs from the code.
import type { FxLayerConfig, ShaderLevel } from './fxLayerTuning';

export interface SceneGrade {
  /** The colour the screen is washed with (#rrggbb) and how strongly (0 = not at all). The sun shafts take its hue too. */
  tint: string;
  tintK: number;
  /** × colour strength and × brightness of the whole picture (high level only). */
  saturation: number;
  brightness: number;
  /** × the thickness of the map's drifting mist (high level only; maps without mist have none). */
  mist: number;
  /** × the sun shafts' strength (0 = none). */
  shaft: number;
}

export type SceneGradeKey = Exclude<keyof SceneGrade, 'tint'>;
export const SCENE_GRADE_RANGE: Record<SceneGradeKey, [number, number]> = {
  tintK: [0, 0.5],
  saturation: [0, 1.5],
  brightness: [0.7, 1.2],
  mist: [0, 2],
  shaft: [0, 2],
};
export const SCENE_GRADE_NAME: Record<keyof SceneGrade, string> = {
  tint: 'สีย้อม',
  tintK: 'แรงย้อม',
  saturation: '× ความอิ่มสี',
  brightness: '× ความสว่าง',
  mist: '× หมอก',
  shaft: '× ลำแสง',
};
const NUM_KEYS = Object.keys(SCENE_GRADE_RANGE) as SceneGradeKey[];

/** Per map, only what differs from the code. */
export type SceneGradeTuning = Record<string, Partial<SceneGrade>>;

const NEUTRAL: SceneGrade = { tint: '#ffe2a8', tintK: 0, saturation: 1, brightness: 1, mist: 1, shaft: 0 };
/** The warm daytime maps (owner 2026-11-27, the soft set). Every other map, boss rooms and custom maps start neutral. */
const CODE: Record<string, Partial<SceneGrade>> = {
  emerald_forest: { tint: '#ffe59a', tintK: 0.07, shaft: 1 },
  nexus_city: { tint: '#ffe2b8', tintK: 0.04, shaft: 0.5 },
  harbor_town: { tint: '#ffe2b8', tintK: 0.04, shaft: 0.5 },
  shipwreck_beach: { tint: '#ffd36b', tintK: 0.08, shaft: 1 },
  // Evening, orange-pink (FLOOR2_SKY.md).
  smugglers_cove: { tint: '#ff8f73', tintK: 0.16, shaft: 1 },
};

export const codeSceneGrade = (zoneId: string): SceneGrade => ({ ...NEUTRAL, ...CODE[zoneId] });
export const sceneGradeOf = (zoneId: string, t: SceneGradeTuning): SceneGrade => ({ ...codeSceneGrade(zoneId), ...t[zoneId] });
export const mergeSceneGrade = (t: SceneGradeTuning | undefined): SceneGradeTuning =>
  Object.fromEntries(Object.entries(t ?? {}).map(([id, g]) => [id, { ...g }]));

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/**
 * Checks the `sceneGrade` part of a balance tuning (see checkBalance): strict = errors for anything wrong, else wrong
 * entries are dropped. `known` says which map ids exist. Values equal to the code's are left out.
 */
export function checkSceneGrade(x: unknown, known: (id: string) => boolean, strict: boolean): { tuning: SceneGradeTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'โทนสีต่อแมพไม่ถูกต้อง' } : { tuning: undefined };
  const out: SceneGradeTuning = {};
  for (const [id, v] of Object.entries(x)) {
    if (!known(id) || !isObj(v)) {
      if (strict) return { error: `โทนสีต่อแมพ: ไม่รู้จักแมพ "${id.slice(0, 30)}"` };
      continue;
    }
    if (strict) {
      const extra = Object.keys(v).find((k) => !(k in SCENE_GRADE_NAME));
      if (extra) return { error: `โทนสีต่อแมพ ${id}: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
    }
    const code = codeSceneGrade(id);
    const g: Partial<SceneGrade> = {};
    if (v.tint !== undefined) {
      if (typeof v.tint !== 'string' || !/^#[0-9a-f]{6}$/i.test(v.tint)) {
        if (strict) return { error: `โทนสีต่อแมพ ${id}: สีต้องเป็น #rrggbb` };
      } else if (v.tint.toLowerCase() !== code.tint) g.tint = v.tint.toLowerCase();
    }
    for (const k of NUM_KEYS) {
      const n = v[k];
      if (n === undefined) continue;
      const [lo, hi] = SCENE_GRADE_RANGE[k];
      if (typeof n !== 'number' || !Number.isFinite(n) || n < lo || n > hi) {
        if (strict) return { error: `โทนสีต่อแมพ ${id}: ${SCENE_GRADE_NAME[k]} ต้องอยู่ระหว่าง ${lo}–${hi}` };
        continue;
      }
      const r = Math.round(n * 1000) / 1000;
      if (r !== code[k]) g[k] = r;
    }
    if (Object.keys(g).length) out[id] = g;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two sets of overrides. */
export function sceneGradeChanges(a: SceneGradeTuning, b: SceneGradeTuning, nameOf: (id: string) => string): string[] {
  const out: string[] = [];
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = sceneGradeOf(id, a);
    const y = sceneGradeOf(id, b);
    for (const k of Object.keys(SCENE_GRADE_NAME) as (keyof SceneGrade)[]) {
      if (x[k] !== y[k]) out.push(`โทนสีแมพ ${nameOf(id)}: ${SCENE_GRADE_NAME[k]} ${x[k]} → ${y[k]}`);
    }
  }
  return out;
}

/** The opacity of a sun shaft at its brightest, at /admin's ×1 on a map with shaft 1 (owner 2026-11-27). */
export const SHAFT_PEAK = 0.14;

/** What the full-screen light layer draws on a map. */
export interface PostLook {
  /** How much darker the corners get. */
  vignette: number;
  tint: string;
  tintK: number;
  /** The shafts' opacity at their brightest. */
  shaft: number;
  /** Noise streaks inside the shafts (high). */
  streaks: boolean;
  saturation: number;
  brightness: number;
  /** The picture on screen has to be copied and redrawn (colour strength or brightness changed). */
  read: boolean;
}

type PostCfg = Pick<FxLayerConfig, 'vignette' | 'shShafts' | 'shaftK' | 'bossRoomPostK'>;

/** The light layer at a level (1 low, 2 high); `room` = a boss room, where everything is weaker. Null = nothing to draw. */
export function postLook(level: Exclude<ShaderLevel, 0>, cfg: PostCfg, grade: SceneGrade, room: boolean): PostLook | null {
  const k = room ? cfg.bossRoomPostK : 1;
  const saturation = level === 2 ? 1 + (grade.saturation - 1) * k : 1;
  const brightness = level === 2 ? 1 + (grade.brightness - 1) * k : 1;
  const look: PostLook = {
    vignette: cfg.vignette * k,
    tint: grade.tint,
    tintK: grade.tintK * k,
    shaft: cfg.shShafts ? Math.min(0.5, SHAFT_PEAK * cfg.shaftK * grade.shaft * k) : 0,
    streaks: level === 2,
    saturation,
    brightness,
    read: saturation !== 1 || brightness !== 1,
  };
  return look.vignette > 0 || look.tintK > 0 || look.shaft > 0 || look.read ? look : null;
}

/**
 * The drifting mist at a level: × its thickness, how strongly it streams in ribbons, and how much thicker than the plain
 * blob a ribbon's densest part is. Below the high level it stays as it was; in a boss room it never gets thicker, not even
 * inside a ribbon. The ghost captain's mist is a game mechanic and is not touched.
 */
export function mistLook(level: ShaderLevel, mistFlow: number, grade: SceneGrade, room: boolean): { thick: number; flow: number; peak: number } {
  if (level !== 2) return { thick: 1, flow: 0, peak: 1 };
  // Past ×1 the ribbons' gaps would turn negative and the rest overshoot, so a room stops there.
  return room
    ? { thick: Math.min(1, grade.mist), flow: Math.min(1, mistFlow), peak: 1 }
    : { thick: grade.mist, flow: mistFlow, peak: 1.8 };
}
