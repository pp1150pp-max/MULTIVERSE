// Server-wide numbers of the skill effects' extra layer (owner 2026-11-15, docs/systems/skill-fx-layer.md): the glow,
// ground light and particles the game draws over a skill's hand-drawn frames, and the feel of a hit on the caster's
// own screen (screen shake, a short freeze, bigger crit numbers), and how many damage numbers show (owner 2026-11-17:
// cap, merging hits on one target, only your own) and how bullets move between snapshots (2026-11-18). Each effect's own recipe is in src/client/fxLayer.ts;
// these multiply all of them. Tuned on /admin → ปรับสมดุล → "เอฟเฟกต์สกิล (ชั้นเสริม)", saved inside the balance
// tuning (`BalanceTuning.fxLayer`), only what differs from the code.

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
}

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
};

const FX_LAYER_BOOLS = ['enabled', 'debuffs', 'mergeNums', 'ownNumsOnly', 'smoothShots', 'circles', 'zoneCircles'] as const;
type FxLayerBool = (typeof FX_LAYER_BOOLS)[number];
const FX_LAYER_BOOL_NAME: Record<FxLayerBool, string> = {
  enabled: 'เอฟเฟกต์สกิล (ชั้นเสริม)',
  debuffs: 'ดีบัฟบนตัวมอน (ไอคอน + เอฟเฟกต์)',
  mergeNums: 'รวมเลขดาเมจที่โดนพร้อมกัน',
  ownNumsOnly: 'เห็นเฉพาะเลขดาเมจของตัวเอง',
  smoothShots: 'กระสุนบินลื่น (ไม่ดึงกลับตาม server)',
  circles: 'วงเวทบนพื้น (บัฟ ดีบัฟ สกิลวงกว้าง)',
  zoneCircles: 'สกิลวงกว้างเป็นวงเวทอย่างเดียว (แทนภาพพื้นที่)',
};

/** The code's own numbers (a fresh copy). */
export function codeFxLayer(): FxLayerConfig {
  return {
    enabled: true, debuffs: true, glow: 1, ground: 1, particles: 1, shake: 1, hitstopMs: 60, crit: 1,
    maxNums: 40, mergeNums: true, mergeSec: 0.15, ownNumsOnly: false, smoothShots: true, circles: true, zoneCircles: true, circleGlow: 1,
  };
}
const CODE = codeFxLayer();

export function mergeFxLayer(t: FxLayerTuning | undefined): FxLayerConfig {
  const c = codeFxLayer();
  if (!t) return c;
  for (const k of FX_LAYER_BOOLS) if (t[k] !== undefined) c[k] = t[k]!;
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
    const extra = Object.keys(x).find((k) => !(FX_LAYER_BOOLS as readonly string[]).includes(k) && !(FX_LAYER_NUMS as string[]).includes(k));
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
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function fxLayerChanges(a: FxLayerConfig, b: FxLayerConfig): string[] {
  const out: string[] = [];
  for (const k of FX_LAYER_BOOLS) if (a[k] !== b[k]) out.push(`${FX_LAYER_BOOL_NAME[k]} ${a[k] ? 'เปิด' : 'ปิด'} → ${b[k] ? 'เปิด' : 'ปิด'}`);
  for (const k of FX_LAYER_NUMS) if (a[k] !== b[k]) out.push(`เอฟเฟกต์สกิล ${FX_LAYER_NAME[k]} ${a[k]} → ${b[k]}`);
  return out;
}
