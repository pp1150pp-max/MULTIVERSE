// Auto Play numbers and switches the owner (and GMs, if allowed) tune on the /admin "ปรับสมดุล" tab
// (owner 2026-11-13): the defaults of the player's Auto options, how long Auto chases a drop it can't get,
// the "balanced" loot order's distances, and server-wide switches that turn player options off.
// Saved inside the balance tuning (`BalanceTuning.auto`), only what differs from the code.

/** When Auto picks up drops. 'fight' = kill whatever attacks first; 'balanced' = the old way; 'loot' = drops first. */
export type AutoLootOrder = 'fight' | 'balanced' | 'loot';
export const AUTO_LOOT_ORDERS: readonly AutoLootOrder[] = ['fight', 'balanced', 'loot'];
export const AUTO_LOOT_ORDER_NAME: Record<AutoLootOrder, string> = { fight: 'ตีก่อน', balanced: 'สมดุล (แบบเดิม)', loot: 'เก็บของก่อน' };

/** What Auto does when HP potions / MP potions run out or the bag is full. */
export type AutoOutAction = 'fight' | 'stop' | 'scroll';
export const AUTO_OUT_ACTIONS: readonly AutoOutAction[] = ['fight', 'stop', 'scroll'];
export const AUTO_OUT_ACTION_NAME: Record<AutoOutAction, string> = { fight: 'สู้ต่อ', stop: 'หยุด Auto', scroll: 'ม้วนกลับเมือง' };

/** Which monster Auto goes for. 'attacker' = those attacking the player first, then the nearest; 'near' = the nearest. */
export type AutoTargetMode = 'attacker' | 'near';
export const AUTO_TARGET_MODES: readonly AutoTargetMode[] = ['attacker', 'near'];
export const AUTO_TARGET_NAME: Record<AutoTargetMode, string> = { attacker: 'ตัวที่ตีเราก่อน', near: 'ใกล้สุด' };

/** The new Auto options of a character that hasn't saved them (see AutoSettings in sim/Player.ts). */
export interface AutoDefaults {
  lootOrder: AutoLootOrder;
  /** Also pick up other players' drops once their 10 s priority is over. */
  othersLoot: boolean;
  noHp: AutoOutAction;
  noMp: AutoOutAction;
  bagFull: AutoOutAction;
  target: AutoTargetMode;
}

/** Server-wide switches: an option switched off can't be chosen, and Auto uses the safe one instead. */
export type AutoAllow = 'lootFirst' | 'othersLoot' | 'scroll' | 'skip';
export const AUTO_ALLOWS: readonly AutoAllow[] = ['lootFirst', 'othersLoot', 'scroll', 'skip'];
export const AUTO_ALLOW_NAME: Record<AutoAllow, string> = {
  lootFirst: 'ลำดับ "เก็บของก่อน"',
  othersLoot: 'เก็บของคนอื่น',
  scroll: 'ใช้ม้วนกลับเมืองอัตโนมัติ',
  skip: 'ติ๊กชนิดมอนที่ไม่ตี',
};

export interface AutoConfig {
  defaults: AutoDefaults;
  /** Seconds Auto walks after one drop without getting it before it skips that drop. */
  giveUpSec: number;
  /** "Balanced": drops this close are fetched even mid-fight. */
  nearDist: number;
  /** "Balanced": a hostile monster this close counts as attacking. */
  threatDist: number;
  allow: Record<AutoAllow, boolean>;
}

/** What is saved: only what differs from the code. */
export interface AutoTuning {
  defaults?: Partial<AutoDefaults>;
  giveUpSec?: number;
  nearDist?: number;
  threatDist?: number;
  allow?: Partial<Record<AutoAllow, boolean>>;
}

export const AUTO_RANGE = {
  giveUpSec: [1, 30],
  nearDist: [1, 20],
  threatDist: [1, 15],
} as const satisfies Record<string, readonly [number, number]>;
export const AUTO_NUM_NAME: Record<keyof typeof AUTO_RANGE, string> = {
  giveUpSec: 'Auto ข้ามของที่เก็บไม่ได้หลัง (วิ)',
  nearDist: 'Auto สมดุล: ระยะของใกล้ตัว',
  threatDist: 'Auto สมดุล: ระยะนับว่าโดนตี',
};
const NUMS = Object.keys(AUTO_RANGE) as (keyof typeof AUTO_RANGE)[];

/** The code's own Auto numbers (a fresh copy). */
export function codeAuto(): AutoConfig {
  return {
    defaults: { lootOrder: 'fight', othersLoot: true, noHp: 'fight', noMp: 'fight', bagFull: 'fight', target: 'attacker' },
    giveUpSec: 4,
    nearDist: 5,
    threatDist: 3.5,
    allow: { lootFirst: true, othersLoot: true, scroll: true, skip: true },
  };
}
const CODE = codeAuto();

export function mergeAuto(t: AutoTuning | undefined): AutoConfig {
  const c = codeAuto();
  if (!t) return c;
  Object.assign(c.defaults, t.defaults);
  for (const k of NUMS) if (t[k] !== undefined) c[k] = t[k]!;
  Object.assign(c.allow, t.allow);
  return c;
}

const DEFAULT_CHOICES: { [K in keyof AutoDefaults]: readonly AutoDefaults[K][] } = {
  lootOrder: AUTO_LOOT_ORDERS,
  othersLoot: [true, false],
  noHp: AUTO_OUT_ACTIONS,
  noMp: AUTO_OUT_ACTIONS,
  bagFull: AUTO_OUT_ACTIONS,
  target: AUTO_TARGET_MODES,
};
const DEFAULT_KEYS = Object.keys(DEFAULT_CHOICES) as (keyof AutoDefaults)[];
export const AUTO_DEFAULT_NAME: Record<keyof AutoDefaults, string> = {
  lootOrder: 'ลำดับเก็บของ', othersLoot: 'เก็บของคนอื่น', noHp: 'ยา HP หมด', noMp: 'ยา MP หมด', bagFull: 'กระเป๋าเต็ม', target: 'เป้าหมาย',
};
/** Thai name of one default's value. */
export function autoDefaultValueName(k: keyof AutoDefaults, v: unknown): string {
  if (k === 'lootOrder') return AUTO_LOOT_ORDER_NAME[v as AutoLootOrder] ?? String(v);
  if (k === 'othersLoot') return v ? 'เก็บของคนอื่นด้วย' : 'เก็บเฉพาะของตัวเอง';
  if (k === 'target') return AUTO_TARGET_NAME[v as AutoTargetMode] ?? String(v);
  return AUTO_OUT_ACTION_NAME[v as AutoOutAction] ?? String(v);
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Checks the `auto` part of a balance tuning (see checkBalance): strict = errors for anything wrong,
 * else wrong entries are dropped. Values equal to the code are left out. Returns the clean tuning
 * (undefined = nothing differs) or a Thai error.
 */
export function checkAutoTuning(x: unknown, strict: boolean): { tuning: AutoTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่า Auto ไม่ถูกต้อง' } : { tuning: undefined };
  const TOP = ['defaults', ...NUMS, 'allow'];
  if (strict) {
    const extra = Object.keys(x).find((k) => !TOP.includes(k));
    if (extra) return { error: `Auto: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: AutoTuning = {};
  if (x.defaults !== undefined) {
    if (!isObj(x.defaults)) {
      if (strict) return { error: 'ค่าเริ่มต้นของ Auto ไม่ถูกต้อง' };
    } else {
      const g = x.defaults;
      if (strict) {
        const extra = Object.keys(g).find((k) => !(DEFAULT_KEYS as string[]).includes(k));
        if (extra) return { error: `ค่าเริ่มต้น Auto: ไม่รู้จัก "${extra.slice(0, 20)}"` };
      }
      const d: Partial<AutoDefaults> = {};
      for (const k of DEFAULT_KEYS) {
        const v = g[k];
        if (v === undefined) continue;
        if (!(DEFAULT_CHOICES[k] as readonly unknown[]).includes(v)) {
          if (strict) return { error: `ค่าเริ่มต้น Auto "${AUTO_DEFAULT_NAME[k]}" ไม่ถูกต้อง` };
          continue;
        }
        if (v !== CODE.defaults[k]) (d as Record<string, unknown>)[k] = v;
      }
      if (Object.keys(d).length) out.defaults = d;
    }
  }
  for (const k of NUMS) {
    const v = x[k];
    if (v === undefined) continue;
    const [lo, hi] = AUTO_RANGE[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
      if (strict) return { error: `${AUTO_NUM_NAME[k]} ต้องอยู่ระหว่าง ${lo} ถึง ${hi}` };
      continue;
    }
    const n = round3(v);
    if (n !== CODE[k]) out[k] = n;
  }
  if (x.allow !== undefined) {
    if (!isObj(x.allow)) {
      if (strict) return { error: 'สวิตช์ Auto ไม่ถูกต้อง' };
    } else {
      const g = x.allow;
      if (strict) {
        const extra = Object.keys(g).find((k) => !(AUTO_ALLOWS as readonly string[]).includes(k));
        if (extra) return { error: `สวิตช์ Auto: ไม่รู้จัก "${extra.slice(0, 20)}"` };
      }
      const a: Partial<Record<AutoAllow, boolean>> = {};
      for (const k of AUTO_ALLOWS) {
        const v = g[k];
        if (v === undefined) continue;
        if (typeof v !== 'boolean') {
          if (strict) return { error: `สวิตช์ Auto "${AUTO_ALLOW_NAME[k]}" ต้องเป็นเปิด/ปิด` };
          continue;
        }
        if (v !== CODE.allow[k]) a[k] = v;
      }
      if (Object.keys(a).length) out.allow = a;
    }
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two Auto configs. */
export function autoChanges(a: AutoConfig, b: AutoConfig): string[] {
  const out: string[] = [];
  for (const k of DEFAULT_KEYS) {
    if (a.defaults[k] !== b.defaults[k]) out.push(`Auto ค่าเริ่มต้น ${AUTO_DEFAULT_NAME[k]} ${autoDefaultValueName(k, a.defaults[k])} → ${autoDefaultValueName(k, b.defaults[k])}`);
  }
  for (const k of NUMS) if (a[k] !== b[k]) out.push(`${AUTO_NUM_NAME[k]} ${a[k]} → ${b[k]}`);
  for (const k of AUTO_ALLOWS) {
    if (a.allow[k] !== b.allow[k]) out.push(`Auto ${AUTO_ALLOW_NAME[k]} ${a.allow[k] ? 'เปิด' : 'ปิด'} → ${b.allow[k] ? 'เปิด' : 'ปิด'}`);
  }
  return out;
}
