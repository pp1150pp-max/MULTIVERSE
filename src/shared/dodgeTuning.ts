// Perfect Dodge (owner 2026-11-27): a hit that the dash's own invulnerability let through as MISS, when the dash
// button was pressed at most `window` seconds before the hit landed, is a Perfect Dodge: a short extra
// invulnerability and a damage buff. Works on every hit that goes through Sim.hitPlayer (monster hits, shots,
// boss moves); `boss` off = bosses' hits don't count. Owner and GMs tune it on the /admin "ปรับสมดุล" tab
// (BalanceTuning.dodge), saved only where it differs from the code.

export interface DodgeConfig {
  on: boolean;
  /** Bosses' hits count too. */
  boss: boolean;
  /** Seconds between pressing dash and the hit landing, at most. */
  window: number;
  /** Extra invulnerability seconds it gives. */
  invuln: number;
  /** Damage dealt +% for `dmgSec` seconds. */
  dmgPct: number;
  dmgSec: number;
  /** Seconds before the next one can happen. */
  cooldown: number;
}

export type DodgeTuning = Partial<DodgeConfig>;

export const DODGE_RANGE = {
  window: [0.05, 1],
  invuln: [0, 3],
  dmgPct: [0, 300],
  dmgSec: [0, 30],
  cooldown: [0, 60],
} as const satisfies Record<string, readonly [number, number]>;
type NumKey = keyof typeof DODGE_RANGE;
const NUMS = Object.keys(DODGE_RANGE) as NumKey[];

export const DODGE_NAME: Record<NumKey | 'on' | 'boss', string> = {
  on: 'Perfect Dodge',
  boss: 'Perfect Dodge ใช้กับท่าบอสด้วย',
  window: 'Perfect Dodge: กดแดชก่อนโดนตีไม่เกิน (วิ)',
  invuln: 'Perfect Dodge: อมตะเพิ่ม (วิ)',
  dmgPct: 'Perfect Dodge: ดาเมจเพิ่ม (%)',
  dmgSec: 'Perfect Dodge: ดาเมจเพิ่มนาน (วิ)',
  cooldown: 'Perfect Dodge: เกิดซ้ำได้ทุก (วิ)',
};

export function codeDodge(): DodgeConfig {
  return { on: true, boss: true, window: 0.3, invuln: 0.5, dmgPct: 20, dmgSec: 3, cooldown: 5 };
}
const CODE = codeDodge();

export function mergeDodge(t: DodgeTuning | undefined): DodgeConfig {
  return { ...codeDodge(), ...(t ?? {}) };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Checks `BalanceTuning.dodge`: strict = errors for anything wrong, else wrong entries are dropped. Code values are left out. */
export function checkDodgeTuning(x: unknown, strict: boolean): { tuning: DodgeTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่า Perfect Dodge ไม่ถูกต้อง' } : { tuning: undefined };
  if (strict) {
    const extra = Object.keys(x).find((k) => k !== 'on' && k !== 'boss' && !(NUMS as string[]).includes(k));
    if (extra) return { error: `Perfect Dodge: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: DodgeTuning = {};
  for (const k of ['on', 'boss'] as const) {
    const v = x[k];
    if (v === undefined) continue;
    if (typeof v !== 'boolean') {
      if (strict) return { error: `${DODGE_NAME[k]} ต้องเป็นเปิด/ปิด` };
      continue;
    }
    if (v !== CODE[k]) out[k] = v;
  }
  for (const k of NUMS) {
    const v = x[k];
    if (v === undefined) continue;
    const [lo, hi] = DODGE_RANGE[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
      if (strict) return { error: `${DODGE_NAME[k]} ต้องอยู่ระหว่าง ${lo} ถึง ${hi}` };
      continue;
    }
    const n = round3(v);
    if (n !== CODE[k]) out[k] = n;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function dodgeChanges(a: DodgeConfig, b: DodgeConfig): string[] {
  const out: string[] = [];
  const onOff = (v: boolean) => (v ? 'เปิด' : 'ปิด');
  for (const k of ['on', 'boss'] as const) if (a[k] !== b[k]) out.push(`${DODGE_NAME[k]} ${onOff(a[k])} → ${onOff(b[k])}`);
  for (const k of NUMS) if (a[k] !== b[k]) out.push(`${DODGE_NAME[k]} ${a[k]} → ${b[k]}`);
  return out;
}
