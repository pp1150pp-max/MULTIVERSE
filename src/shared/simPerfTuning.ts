// Server load switches for the game rules (owner 2026-11-28, docs/systems/balance.md "ภาระ server"): the live VPS ran at ~100%
// CPU with a few farm channels open, so everyone's ping went up whenever one more channel opened.
//   grid   Terrain.resolve and Sim.separateMonsters look only at what is near (a grid of 4 m cells) instead of every one of
//          the ~1,500 colliders / ~200 monsters. Same results; off = the old loops over everything.
//   doze   an ordinary monster standing idle with no player within `dozeRadius` thinks only every `dozeEvery` ticks (with the
//          time of the ticks it skipped, so it walks and heals the same in the end). Nobody sees it: browsers only get
//          monsters within INTEREST_RADIUS (34). It wakes up at once when a player comes near or it gets hit.
// Tuned on the /admin "ปรับสมดุล" tab; saved inside the balance tuning (`BalanceTuning.simPerf`), only what differs from the code.

export interface SimPerfConfig {
  grid: boolean;
  doze: boolean;
  /** Metres: no player (alive or not) this close = an idle monster may doze. */
  dozeRadius: number;
  /** A dozing monster updates once every this many ticks (30 ticks a second). */
  dozeEvery: number;
}

export type SimPerfTuning = Partial<SimPerfConfig>;

export const SIM_PERF_RANGE = {
  dozeRadius: [36, 200],
  dozeEvery: [2, 15],
} as const satisfies Record<string, readonly [number, number]>;
export const SIM_PERF_NUM_NAME: Record<keyof typeof SIM_PERF_RANGE, string> = {
  dozeRadius: 'มอนไกลผู้เล่น: ระยะจากผู้เล่นที่นับว่าไกล (ม.)',
  dozeEvery: 'มอนไกลผู้เล่น: คิดทุกกี่ tick',
};
export const SIM_PERF_FLAG_NAME = {
  grid: 'เช็คชนแบบตาราง (เร็ว)',
  doze: 'มอนไกลผู้เล่นคิดช้าลง',
} as const;
type Flag = keyof typeof SIM_PERF_FLAG_NAME;
type Num = keyof typeof SIM_PERF_RANGE;
const FLAGS = Object.keys(SIM_PERF_FLAG_NAME) as Flag[];
const NUMS = Object.keys(SIM_PERF_RANGE) as Num[];

/** The code's own values (a fresh copy). */
export function codeSimPerf(): SimPerfConfig {
  return { grid: true, doze: true, dozeRadius: 45, dozeEvery: 4 };
}
const CODE = codeSimPerf();

export function mergeSimPerf(t: SimPerfTuning | undefined): SimPerfConfig {
  const c = codeSimPerf();
  if (!t) return c;
  for (const k of FLAGS) if (t[k] !== undefined) c[k] = t[k]!;
  for (const k of NUMS) if (t[k] !== undefined) c[k] = t[k]!;
  return c;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Checks the `simPerf` part of a balance tuning (strict = errors, else wrong entries dropped); values equal to the code are left out. */
export function checkSimPerfTuning(x: unknown, strict: boolean): { tuning: SimPerfTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าภาระ server ไม่ถูกต้อง' } : { tuning: undefined };
  if (strict) {
    const extra = Object.keys(x).find((k) => !(FLAGS as string[]).includes(k) && !(NUMS as string[]).includes(k));
    if (extra) return { error: `ภาระ server: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: SimPerfTuning = {};
  for (const k of FLAGS) {
    const v = x[k];
    if (v === undefined) continue;
    if (typeof v !== 'boolean') {
      if (strict) return { error: `${SIM_PERF_FLAG_NAME[k]} ต้องเป็นเปิด/ปิด` };
      continue;
    }
    if (v !== CODE[k]) out[k] = v;
  }
  for (const k of NUMS) {
    const v = x[k];
    if (v === undefined) continue;
    const [lo, hi] = SIM_PERF_RANGE[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
      if (strict) return { error: `${SIM_PERF_NUM_NAME[k]} ต้องอยู่ระหว่าง ${lo} ถึง ${hi}` };
      continue;
    }
    const n = Math.round(v);
    if (n !== CODE[k]) out[k] = n;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function simPerfChanges(a: SimPerfConfig, b: SimPerfConfig): string[] {
  const onOff = (v: boolean) => (v ? 'เปิด' : 'ปิด');
  const out: string[] = [];
  for (const k of FLAGS) if (a[k] !== b[k]) out.push(`${SIM_PERF_FLAG_NAME[k]} ${onOff(a[k])} → ${onOff(b[k])}`);
  for (const k of NUMS) if (a[k] !== b[k]) out.push(`${SIM_PERF_NUM_NAME[k]} ${a[k]} → ${b[k]}`);
  return out;
}
