// The class passives' numbers (classPassives.ts, owner 2026-11-27), tuned on /admin → ระบบสกิล → "พาสซีฟประจำอาชีพ",
// saved inside the skill tuning (`SkillTuning.classPassive`), only what differs from the code.
import { MAX_LEVEL } from './formulas';

export interface ClassPassiveOne {
  /** Works at all. */
  on: boolean;
  /** Level it unlocks at (owner: Lv 1). */
  level: number;
}

export interface WarpLook {
  /** × size of the two rings. */
  size: number;
  /** Seconds the rings last. */
  sec: number;
  /** Colours when no dash cosmetic is worn (owner: one purple magic circle). */
  color1: string;
  color2: string;
}

export interface ClassPassiveConfig {
  hitrun: ClassPassiveOne;
  warp: ClassPassiveOne & {
    /** Warps held at most (owner: 2), each coming back after the dash cooldown, one at a time. */
    stacks: number;
    /** Seconds between two warps back to back (owner: 0.2). */
    gap: number;
    look: WarpLook;
  };
  /** The sword's Dash Slash (owner 2026-11-28): the plain dash hits every monster on its way once. */
  slash: ClassPassiveOne & {
    /** × ATK per hit (owner: 0.8). */
    dmg: number;
    /** Slow share 0–0.9 (owner: 0.3). */
    slow: number;
    /** Seconds of slow (owner: 1.5). */
    slowT: number;
    /** Full width of the slashed strip in metres, half each side of the path, plus the monster's own radius (code: 2.4). */
    width: number;
  };
}

export interface ClassPassiveTuning {
  hitrun?: Partial<ClassPassiveOne>;
  warp?: Partial<ClassPassiveOne> & { stacks?: number; gap?: number; look?: Partial<WarpLook> };
  slash?: Partial<ClassPassiveConfig['slash']>;
}

export const CP_RANGE = { level: [1, MAX_LEVEL], stacks: [1, 5], gap: [0, 5], size: [0.2, 4], sec: [0.1, 3], dmg: [0, 10], slow: [0, 0.9], slowT: [0, 15], width: [0.2, 8] } as const;

export function codeClassPassive(): ClassPassiveConfig {
  return {
    hitrun: { on: true, level: 1 },
    warp: { on: true, level: 1, stacks: 2, gap: 0.2, look: { size: 1, sec: 0.6, color1: '#e2c6ff', color2: '#8a4dff' } },
    slash: { on: true, level: 1, dmg: 0.8, slow: 0.3, slowT: 1.5, width: 2.4 },
  };
}
const CODE = codeClassPassive();

export function mergeClassPassive(t: ClassPassiveTuning | undefined): ClassPassiveConfig {
  const c = codeClassPassive();
  if (!t) return c;
  Object.assign(c.hitrun, t.hitrun);
  const { look, ...warp } = t.warp ?? {};
  Object.assign(c.warp, warp);
  Object.assign(c.warp.look, look);
  Object.assign(c.slash, t.slash);
  return c;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const COLOR = /^#[0-9a-f]{6}$/;
const SLASH_NUMS = ['dmg', 'slow', 'slowT', 'width'] as const;
const NAME = { hitrun: 'ยิงแล้ววิ่ง', warp: 'ก้าวมิติ', slash: 'ฟันทะลวง' } as const;
const NUM_NAME = { level: 'เลเวลปลดล็อก', stacks: 'จำนวนครั้งที่เก็บได้', gap: 'หน่วงระหว่างวาร์ป (วิ)', size: 'ขนาดวง', sec: 'เวลาวง (วิ)', dmg: 'ดาเมจ (×ATK)', slow: 'ช้าลง', slowT: 'เวลาช้า (วิ)', width: 'ความกว้าง (ม.)' } as const;

/**
 * Checks the `classPassive` part of the skill tuning: strict = errors for anything wrong, else wrong entries are dropped.
 * Values equal to the code are left out.
 */
export function checkClassPassive(x: unknown, strict: boolean): { tuning: ClassPassiveTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าพาสซีฟประจำอาชีพไม่ถูกต้อง' } : { tuning: undefined };
  const fail = (msg: string) => ({ error: `พาสซีฟประจำอาชีพ: ${msg}` });
  if (strict) {
    const extra = Object.keys(x).find((k) => k !== 'hitrun' && k !== 'warp' && k !== 'slash');
    if (extra) return fail(`ไม่รู้จักค่า "${extra.slice(0, 20)}"`);
  }
  const out: ClassPassiveTuning = {};
  const num = (v: unknown, k: keyof typeof CP_RANGE, int: boolean): number | null | 'bad' => {
    if (v === undefined) return null;
    const [lo, hi] = CP_RANGE[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || (int && !Number.isInteger(v))) return 'bad';
    return round3(v);
  };
  for (const key of ['hitrun', 'warp', 'slash'] as const) {
    const v = x[key];
    if (v === undefined) continue;
    if (!isObj(v)) {
      if (strict) return fail(`${NAME[key]} ไม่ถูกต้อง`);
      continue;
    }
    const allowed = key === 'warp' ? ['on', 'level', 'stacks', 'gap', 'look'] : key === 'slash' ? ['on', 'level', ...SLASH_NUMS] : ['on', 'level'];
    if (strict) {
      const extra = Object.keys(v).find((k) => !allowed.includes(k));
      if (extra) return fail(`${NAME[key]}: ไม่รู้จักค่า "${extra.slice(0, 20)}"`);
    }
    const o: Record<string, unknown> = {};
    const code = CODE[key] as unknown as Record<string, unknown>;
    if (v.on !== undefined) {
      if (typeof v.on !== 'boolean') {
        if (strict) return fail(`${NAME[key]}: เปิด/ปิดไม่ถูกต้อง`);
      } else if (v.on !== code.on) o.on = v.on;
    }
    const nums = (key === 'warp' ? ['level', 'stacks', 'gap'] : key === 'slash' ? ['level', ...SLASH_NUMS] : ['level']) as (keyof typeof CP_RANGE)[];
    for (const k of nums) {
      const n = num(v[k], k, k === 'level' || k === 'stacks');
      if (n === 'bad') {
        if (strict) return fail(`${NAME[key]}: ${NUM_NAME[k]} ต้องอยู่ระหว่าง ${CP_RANGE[k][0]}–${CP_RANGE[k][1]}`);
      } else if (n !== null && n !== code[k]) o[k] = n;
    }
    if (key === 'warp' && v.look !== undefined) {
      const l = v.look;
      if (!isObj(l)) {
        if (strict) return fail('ค่าภาพวาร์ปไม่ถูกต้อง');
      } else {
        if (strict) {
          const extra = Object.keys(l).find((k) => !['size', 'sec', 'color1', 'color2'].includes(k));
          if (extra) return fail(`ภาพวาร์ป: ไม่รู้จักค่า "${extra.slice(0, 20)}"`);
        }
        const look: Partial<WarpLook> = {};
        for (const k of ['size', 'sec'] as const) {
          const n = num(l[k], k, false);
          if (n === 'bad') {
            if (strict) return fail(`ภาพวาร์ป: ${NUM_NAME[k]} ต้องอยู่ระหว่าง ${CP_RANGE[k][0]}–${CP_RANGE[k][1]}`);
          } else if (n !== null && n !== CODE.warp.look[k]) look[k] = n;
        }
        for (const k of ['color1', 'color2'] as const) {
          const c = l[k];
          if (c === undefined) continue;
          if (typeof c !== 'string' || !COLOR.test(c.toLowerCase())) {
            if (strict) return fail('ภาพวาร์ป: สีต้องเป็น #rrggbb');
          } else if (c.toLowerCase() !== CODE.warp.look[k]) look[k] = c.toLowerCase();
        }
        if (Object.keys(look).length) o.look = look;
      }
    }
    if (Object.keys(o).length) (out as Record<string, unknown>)[key] = o;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function classPassiveChanges(a: ClassPassiveConfig, b: ClassPassiveConfig): string[] {
  const out: string[] = [];
  const onOff = (v: boolean) => (v ? 'เปิด' : 'ปิด');
  for (const key of ['hitrun', 'warp', 'slash'] as const) {
    if (a[key].on !== b[key].on) out.push(`พาสซีฟอาชีพ ${NAME[key]} ${onOff(a[key].on)} → ${onOff(b[key].on)}`);
    if (a[key].level !== b[key].level) out.push(`พาสซีฟอาชีพ ${NAME[key]} ${NUM_NAME.level} ${a[key].level} → ${b[key].level}`);
  }
  for (const k of ['stacks', 'gap'] as const) if (a.warp[k] !== b.warp[k]) out.push(`พาสซีฟอาชีพ ${NAME.warp} ${NUM_NAME[k]} ${a.warp[k]} → ${b.warp[k]}`);
  for (const k of SLASH_NUMS) if (a.slash[k] !== b.slash[k]) out.push(`พาสซีฟอาชีพ ${NAME.slash} ${NUM_NAME[k]} ${a.slash[k]} → ${b.slash[k]}`);
  for (const k of ['size', 'sec'] as const) if (a.warp.look[k] !== b.warp.look[k]) out.push(`ภาพวาร์ป ${NUM_NAME[k]} ${a.warp.look[k]} → ${b.warp.look[k]}`);
  for (const k of ['color1', 'color2'] as const) if (a.warp.look[k] !== b.warp.look[k]) out.push(`ภาพวาร์ป สี${k === 'color1' ? 'ใน' : 'นอก'} ${a.warp.look[k]} → ${b.warp.look[k]}`);
  return out;
}
