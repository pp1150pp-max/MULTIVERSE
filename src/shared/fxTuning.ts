// Skill effect "extra layer" settings the owner (and GMs, if allowed) tune on the /admin "ปรับสมดุล" tab
// (owner 2026-11-15, docs/systems/skill-fx.md): glow, ground light, particles, and the feel of a hit (shake,
// hit-stop, white flash, big crit numbers). Visual only: the browser reads them, the Sim never does.
// Saved inside the balance tuning (`BalanceTuning.fx`), only what differs from the code.

export interface FxConfig {
  /** The whole extra layer on/off (off = the effects look exactly as before). */
  on: boolean;
  /** Screen shake of a layered skill's hit, × (0 = none). */
  shake: number;
  /** Hit-stop on the player's own layered hits, in ms (0 = none). Picture only, the game keeps running. */
  hitStopMs: number;
  /** Brightness of the light on the ground under an effect, × (0 = none). */
  ground: number;
  /** Glow around the effect's picture, × (0 = none). */
  glow: number;
  /** How many sparks/shards/embers, × (0 = none; phones get half). */
  particles: number;
  /** How big a critical number pops, × (1 = as before). */
  critPop: number;
}

/** What is saved: only what differs from the code. */
export type FxTuning = Partial<FxConfig>;

export const FX_RANGE = {
  shake: [0, 3],
  hitStopMs: [0, 150],
  ground: [0, 2],
  glow: [0, 2],
  particles: [0, 2],
  critPop: [0.5, 3],
} as const satisfies Record<string, readonly [number, number]>;
export const FX_NUM_NAME: Record<keyof typeof FX_RANGE, string> = {
  shake: 'จอสั่น ×',
  hitStopMs: 'ค้างตอนโดน (ms)',
  ground: 'แสงบนพื้น ×',
  glow: 'แสงเรือง ×',
  particles: 'อนุภาค ×',
  critPop: 'ตัวเลขคริเด้ง ×',
};
const NUMS = Object.keys(FX_RANGE) as (keyof typeof FX_RANGE)[];

/** The code's own settings (a fresh copy). */
export function codeFx(): FxConfig {
  return { on: true, shake: 1, hitStopMs: 65, ground: 1, glow: 1, particles: 1, critPop: 1.6 };
}
const CODE = codeFx();

export function mergeFx(t: FxTuning | undefined): FxConfig {
  return { ...codeFx(), ...t };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Checks the `fx` part of a balance tuning (like checkAutoTuning): clean tuning (undefined = same as code) or a Thai error. */
export function checkFxTuning(x: unknown, strict: boolean): { tuning: FxTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!x || typeof x !== 'object' || Array.isArray(x)) return strict ? { error: 'ค่าเอฟเฟกต์สกิลไม่ถูกต้อง' } : { tuning: undefined };
  const o = x as Record<string, unknown>;
  if (strict) {
    const extra = Object.keys(o).find((k) => k !== 'on' && !(NUMS as string[]).includes(k));
    if (extra) return { error: `เอฟเฟกต์สกิล: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: FxTuning = {};
  if (o.on !== undefined) {
    if (typeof o.on !== 'boolean') {
      if (strict) return { error: 'สวิตช์เอฟเฟกต์สกิลต้องเป็นเปิด/ปิด' };
    } else if (o.on !== CODE.on) out.on = o.on;
  }
  for (const k of NUMS) {
    const v = o[k];
    if (v === undefined) continue;
    const [lo, hi] = FX_RANGE[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
      if (strict) return { error: `${FX_NUM_NAME[k]} ต้องอยู่ระหว่าง ${lo} ถึง ${hi}` };
      continue;
    }
    const n = round3(v);
    if (n !== CODE[k]) out[k] = n;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs. */
export function fxChanges(a: FxConfig, b: FxConfig): string[] {
  const out: string[] = [];
  if (a.on !== b.on) out.push(`เอฟเฟกต์สกิลชั้นเสริม ${a.on ? 'เปิด' : 'ปิด'} → ${b.on ? 'เปิด' : 'ปิด'}`);
  for (const k of NUMS) if (a[k] !== b[k]) out.push(`เอฟเฟกต์สกิล ${FX_NUM_NAME[k]} ${a[k]} → ${b[k]}`);
  return out;
}
