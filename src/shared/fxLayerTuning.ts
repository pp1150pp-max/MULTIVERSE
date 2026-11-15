// Server-wide numbers of the skill effects' extra layer (owner 2026-11-15, docs/systems/skill-fx-layer.md): the glow,
// ground light and particles the game draws over a skill's hand-drawn frames, and the feel of a hit on the caster's
// own screen (screen shake, a short freeze, bigger crit numbers). Each effect's own recipe is in src/client/fxLayer.ts;
// these multiply all of them. Tuned on /admin → ปรับสมดุล → "เอฟเฟกต์สกิล (ชั้นเสริม)", saved inside the balance
// tuning (`BalanceTuning.fxLayer`), only what differs from the code.

export interface FxLayerConfig {
  /** The whole extra layer on or off. */
  enabled: boolean;
  /** Debuff icons over monsters' HP bars and their effects on the body (src/client/debuffFx.ts). */
  debuffs: boolean;
  /** Code-made pixel effects (pixelfx) instead of the pictures on the skills that try them (src/client/pixelFx.ts). */
  pixelfx: boolean;
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
}

export type FxLayerTuning = Partial<FxLayerConfig>;

export const FX_LAYER_RANGE = {
  glow: [0, 3],
  ground: [0, 3],
  particles: [0, 3],
  shake: [0, 3],
  hitstopMs: [0, 120],
  crit: [0.5, 2],
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
};

/** The code's own numbers (a fresh copy). */
export function codeFxLayer(): FxLayerConfig {
  return { enabled: true, debuffs: true, pixelfx: true, glow: 1, ground: 1, particles: 1, shake: 1, hitstopMs: 60, crit: 1 };
}
const CODE = codeFxLayer();

export function mergeFxLayer(t: FxLayerTuning | undefined): FxLayerConfig {
  const c = codeFxLayer();
  if (!t) return c;
  if (t.enabled !== undefined) c.enabled = t.enabled;
  if (t.debuffs !== undefined) c.debuffs = t.debuffs;
  if (t.pixelfx !== undefined) c.pixelfx = t.pixelfx;
  for (const k of FX_LAYER_NUMS) if (t[k] !== undefined) c[k] = t[k]!;
  return c;
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
    const extra = Object.keys(x).find((k) => k !== 'enabled' && k !== 'debuffs' && k !== 'pixelfx' && !(FX_LAYER_NUMS as string[]).includes(k));
    if (extra) return { error: `เอฟเฟกต์สกิล: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: FxLayerTuning = {};
  if (x.enabled !== undefined) {
    if (typeof x.enabled !== 'boolean') {
      if (strict) return { error: 'เอฟเฟกต์สกิล: เปิด/ปิด ไม่ถูกต้อง' };
    } else if (x.enabled !== CODE.enabled) out.enabled = x.enabled;
  }
  if (x.debuffs !== undefined) {
    if (typeof x.debuffs !== 'boolean') {
      if (strict) return { error: 'เอฟเฟกต์สกิล: เปิด/ปิด ดีบัฟบนมอน ไม่ถูกต้อง' };
    } else if (x.debuffs !== CODE.debuffs) out.debuffs = x.debuffs;
  }
  if (x.pixelfx !== undefined) {
    if (typeof x.pixelfx !== 'boolean') {
      if (strict) return { error: 'เอฟเฟกต์สกิล: เปิด/ปิด pixelfx ไม่ถูกต้อง' };
    } else if (x.pixelfx !== CODE.pixelfx) out.pixelfx = x.pixelfx;
  }
  for (const k of FX_LAYER_NUMS) {
    const v = x[k];
    if (v === undefined) continue;
    const [lo, hi] = FX_LAYER_RANGE[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
      if (strict) return { error: `เอฟเฟกต์สกิล "${FX_LAYER_NAME[k]}" ต้องอยู่ระหว่าง ${lo}–${hi}` };
      continue;
    }
    const n = round3(v);
    if (n !== CODE[k]) out[k] = n;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function fxLayerChanges(a: FxLayerConfig, b: FxLayerConfig): string[] {
  const out: string[] = [];
  if (a.pixelfx !== b.pixelfx) out.push(`เอฟเฟกต์โค้ด pixelfx (พื้นเพลิง วงน้ำแข็ง ปฐพีแยก) ${a.pixelfx ? 'เปิด' : 'ปิด'} → ${b.pixelfx ? 'เปิด' : 'ปิด'}`);
  if (a.debuffs !== b.debuffs) out.push(`ดีบัฟบนตัวมอน (ไอคอน + เอฟเฟกต์) ${a.debuffs ? 'เปิด' : 'ปิด'} → ${b.debuffs ? 'เปิด' : 'ปิด'}`);
  if (a.enabled !== b.enabled) out.push(`เอฟเฟกต์สกิล (ชั้นเสริม) ${a.enabled ? 'เปิด' : 'ปิด'} → ${b.enabled ? 'เปิด' : 'ปิด'}`);
  for (const k of FX_LAYER_NUMS) if (a[k] !== b[k]) out.push(`เอฟเฟกต์สกิล ${FX_LAYER_NAME[k]} ${a[k]} → ${b[k]}`);
  return out;
}
