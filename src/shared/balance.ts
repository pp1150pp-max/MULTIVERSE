// Game balance the owner (and GMs, if allowed) tune from the /admin "ปรับสมดุล" tab: every class's stats
// (Lv1, per level, multipliers, boss damage), the game-wide regen cuts, and the item tier tables
// (chances, widths, floor, bosses' tier boost). Pure data and checks: the code defaults are in
// data/classes.ts and data/items.ts, and changes are saved in the server's settings table as overrides
// only (like cos_tuning), so an untouched server runs exactly the code. The server applies them at start
// and on every save, and sends them to every browser so tooltips and the blacksmith's odds match.
import { CLASSES, CLASS_IDS } from './data/classes';
import { CODE_BOSS_TIER_BOOST, CODE_RANGE_FLOOR, CODE_TIER_WEIGHT, CODE_TIER_WIDTH, setTierTables } from './data/items';
import { addInto, emptyStats } from './formulas';
import { STAT_KEYS, STAT_LABEL, type ClassId, type StatKey, type Stats } from './types';

/** Key in the server's settings table. */
export const BALANCE_SETTING = 'balance';

/** Share of the HP regen stat that actually applies (owner: -60%). */
export const CODE_HP_REGEN_MULT = 0.4;
/** Same for MP regen (owner: -75%, so skills lean on MP potions). */
export const CODE_MP_REGEN_MULT = 0.25;

/** One class's numbers: Lv1 stats, added per level, final multipliers (gear included), damage to bosses. */
export interface ClassBalance { base: Stats; growth: Stats; mult: Stats; bossDmgMult: number }
export type StatPart = 'base' | 'growth' | 'mult';
export const STAT_PARTS: readonly StatPart[] = ['base', 'growth', 'mult'];
export const STAT_PART_NAME: Record<StatPart, string> = { base: 'Lv1', growth: 'ต่อเลเวล', mult: 'ตัวคูณ' };

/** Every tunable number, as the game uses it. Tier arrays are T1 first; widths and floor in %. */
export interface Balance {
  classes: Record<ClassId, ClassBalance>;
  hpRegenMult: number;
  mpRegenMult: number;
  tierWeight: number[];
  tierWidth: number[];
  rangeFloor: number;
  bossTierBoost: number;
}

/** What is saved: only what differs from the code. Tier arrays are saved whole when any entry differs. */
export interface BalanceTuning {
  classes?: Partial<Record<ClassId, { base?: Partial<Stats>; growth?: Partial<Stats>; mult?: Partial<Stats>; bossDmgMult?: number }>>;
  hpRegenMult?: number;
  mpRegenMult?: number;
  tierWeight?: number[];
  tierWidth?: number[];
  rangeFloor?: number;
  bossTierBoost?: number;
}

/** Highest Lv1 / per-level value of each stat (owner 2026-11-11); the lowest is 0. */
export const STAT_MAX: Record<StatKey, number> = {
  maxHp: 100000, maxMp: 100000, atk: 10000, def: 10000, crit: 100, critDmg: 1000, atkSpeed: 300, moveSpeed: 300, hpRegen: 1000, mpRegen: 1000,
};
/** Ranges of the other numbers (owner 2026-11-11), both ends allowed. */
export const BALANCE_RANGE = {
  mult: [0, 10],
  bossDmgMult: [0.1, 10],
  regenMult: [0, 5],
  tierWeight: [0, 1000],
  tierWidth: [1, 96],
  rangeFloor: [5, 95],
  bossTierBoost: [0, 10],
} as const satisfies Record<string, readonly [number, number]>;

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const full = (p: Partial<Stats> | undefined, fill: number): Stats => {
  const s = emptyStats();
  for (const k of STAT_KEYS) s[k] = p?.[k] ?? fill;
  return s;
};

/** The code's own numbers (a fresh copy). */
export function codeBalance(): Balance {
  const classes = {} as Record<ClassId, ClassBalance>;
  for (const id of CLASS_IDS) {
    const c = CLASSES[id];
    classes[id] = { base: full(c.base, 0), growth: full(c.growth, 0), mult: full(c.statMult, 1), bossDmgMult: c.bossDmgMult ?? 1 };
  }
  return {
    classes,
    hpRegenMult: CODE_HP_REGEN_MULT,
    mpRegenMult: CODE_MP_REGEN_MULT,
    tierWeight: [...CODE_TIER_WEIGHT],
    tierWidth: [...CODE_TIER_WIDTH],
    rangeFloor: CODE_RANGE_FLOOR,
    bossTierBoost: CODE_BOSS_TIER_BOOST,
  };
}

const CODE = codeBalance();

/** The numbers with this (clean) tuning on top of the code. */
export function mergeBalance(t: BalanceTuning): Balance {
  const b = codeBalance();
  for (const id of CLASS_IDS) {
    const ct = t.classes?.[id];
    if (!ct) continue;
    const c = b.classes[id];
    for (const part of STAT_PARTS) Object.assign(c[part], ct[part]);
    if (ct.bossDmgMult !== undefined) c.bossDmgMult = ct.bossDmgMult;
  }
  if (t.hpRegenMult !== undefined) b.hpRegenMult = t.hpRegenMult;
  if (t.mpRegenMult !== undefined) b.mpRegenMult = t.mpRegenMult;
  if (t.tierWeight) b.tierWeight = [...t.tierWeight];
  if (t.tierWidth) b.tierWidth = [...t.tierWidth];
  if (t.rangeFloor !== undefined) b.rangeFloor = t.rangeFloor;
  if (t.bossTierBoost !== undefined) b.bossTierBoost = t.bossTierBoost;
  return b;
}

let tuning: BalanceTuning = {};
let current: Balance = mergeBalance({});

/** Uses this tuning from now on, everywhere (already checked by checkBalance). */
export function applyBalance(t: BalanceTuning): void {
  tuning = t;
  current = mergeBalance(t);
  setTierTables(current.tierWidth, current.rangeFloor, current.tierWeight, current.bossTierBoost);
}

/** The numbers in use. */
export const currentBalance = (): Balance => current;
/** The tuning in use (only the changes from the code). */
export const currentBalanceTuning = (): BalanceTuning => tuning;
/** One class's numbers in use. */
export const classBalance = (id: ClassId): ClassBalance => current.classes[id];

/**
 * The last steps of a character's stats, after class, level and gear are added up: the class multipliers
 * (gear included), then the regen cuts so players lean on potions. Player.recompute and the admin preview
 * both use it.
 */
export function finishStats(s: Stats, id: ClassId, b: Balance = current): void {
  const m = b.classes[id].mult;
  for (const k of STAT_KEYS) s[k] *= m[k];
  s.hpRegen *= b.hpRegenMult;
  s.mpRegen *= b.mpRegenMult;
}

/** A class's stats at a level with nothing worn (the admin preview). */
export function classStatsAt(id: ClassId, level: number, b: Balance = current): Stats {
  const c = b.classes[id];
  const s = emptyStats();
  addInto(s, c.base);
  addInto(s, c.growth, level - 1);
  finishStats(s, id, b);
  return s;
}

type Checked = { tuning: BalanceTuning; error?: undefined } | { tuning?: undefined; error: string };

/**
 * Checks tuning sent by a browser (`strict`: anything unknown, mistyped or out of range is an error) or
 * read back from the database (not strict: such entries are dropped, the rest kept). Numbers are rounded
 * to 3 decimals, values equal to the code left out, and keys come in a fixed order (so two equal tunings
 * give the same JSON). Returns the clean tuning or a Thai error.
 */
export function checkBalance(v: unknown, strict: boolean): Checked {
  const bad = (error: string): Checked | null => (strict ? { error } : null);
  if (!v || typeof v !== 'object' || Array.isArray(v)) return strict ? { error: 'ค่าสมดุลไม่ถูกต้อง' } : { tuning: {} };
  const o = v as Record<string, unknown>;
  const TOP = ['classes', 'hpRegenMult', 'mpRegenMult', 'tierWeight', 'tierWidth', 'rangeFloor', 'bossTierBoost'];
  if (strict) {
    const extra = Object.keys(o).find((k) => !TOP.includes(k));
    if (extra) return { error: `ไม่รู้จักค่า "${extra.slice(0, 30)}"` };
  }
  /** A number in [lo, hi] rounded, or undefined (missing / dropped); a string is an error to return. */
  const num = (x: unknown, lo: number, hi: number, what: string): number | undefined | string => {
    if (x === undefined) return undefined;
    if (typeof x !== 'number' || !Number.isFinite(x)) return strict ? `${what} ต้องเป็นตัวเลข` : undefined;
    if (x < lo || x > hi) return strict ? `${what} ต้องอยู่ระหว่าง ${lo} ถึง ${hi}` : undefined;
    return round3(x);
  };
  const out: BalanceTuning = {};

  // Classes
  if (o.classes !== undefined) {
    if (!o.classes || typeof o.classes !== 'object' || Array.isArray(o.classes)) {
      const e = bad('ค่าอาชีพไม่ถูกต้อง');
      if (e) return e;
    } else {
      const given = o.classes as Record<string, unknown>;
      if (strict) {
        const extra = Object.keys(given).find((k) => !(CLASS_IDS as string[]).includes(k));
        if (extra) return { error: `ไม่มีอาชีพ "${extra.slice(0, 30)}"` };
      }
      const classes: NonNullable<BalanceTuning['classes']> = {};
      for (const id of CLASS_IDS) {
        const g = given[id];
        if (g === undefined) continue;
        const name = CLASSES[id].nameTh;
        if (!g || typeof g !== 'object' || Array.isArray(g)) {
          const e = bad(`ค่าของ${name}ไม่ถูกต้อง`);
          if (e) return e;
          continue;
        }
        const go = g as Record<string, unknown>;
        if (strict) {
          const extra = Object.keys(go).find((k) => !(STAT_PARTS as string[]).includes(k) && k !== 'bossDmgMult');
          if (extra) return { error: `${name}: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
        }
        const code = CODE.classes[id];
        const cls: NonNullable<BalanceTuning['classes']>[ClassId] = {};
        for (const part of STAT_PARTS) {
          const gp = go[part];
          if (gp === undefined) continue;
          if (!gp || typeof gp !== 'object' || Array.isArray(gp)) {
            const e = bad(`${name}: ค่า${STAT_PART_NAME[part]}ไม่ถูกต้อง`);
            if (e) return e;
            continue;
          }
          const gs = gp as Record<string, unknown>;
          if (strict) {
            const extra = Object.keys(gs).find((k) => !(STAT_KEYS as readonly string[]).includes(k));
            if (extra) return { error: `${name}: ไม่รู้จักสเตตัส "${extra.slice(0, 20)}"` };
          }
          const vals: Partial<Stats> = {};
          for (const k of STAT_KEYS) {
            const [lo, hi] = part === 'mult' ? BALANCE_RANGE.mult : [0, STAT_MAX[k]];
            const n = num(gs[k], lo, hi, `${name} ${STAT_PART_NAME[part]} ${STAT_LABEL[k]}`);
            if (typeof n === 'string') return { error: n };
            if (n !== undefined && n !== code[part][k]) vals[k] = n;
          }
          if (Object.keys(vals).length) cls[part] = vals;
        }
        const bm = num(go.bossDmgMult, ...BALANCE_RANGE.bossDmgMult, `${name} ดาเมจใส่บอส`);
        if (typeof bm === 'string') return { error: bm };
        if (bm !== undefined && bm !== code.bossDmgMult) cls.bossDmgMult = bm;
        if (Object.keys(cls).length) classes[id] = cls;
      }
      if (Object.keys(classes).length) out.classes = classes;
    }
  }

  // Single numbers
  const one = (key: 'hpRegenMult' | 'mpRegenMult' | 'rangeFloor' | 'bossTierBoost', range: readonly [number, number], what: string): string | null => {
    const n = num(o[key], range[0], range[1], what);
    if (typeof n === 'string') return n;
    if (n !== undefined && n !== CODE[key]) out[key] = n;
    return null;
  };
  // Tier arrays: 5 numbers, T1 first.
  const arr = (key: 'tierWeight' | 'tierWidth', range: readonly [number, number], what: string, whole: (a: number[]) => string | null): string | null => {
    const x = o[key];
    if (x === undefined) return null;
    if (!Array.isArray(x) || x.length !== 5) return strict ? `${what} ต้องมี 5 ค่า (T1–T5)` : null;
    const a: number[] = [];
    for (let i = 0; i < 5; i++) {
      const n = num(x[i], range[0], range[1], `${what} T${i + 1}`);
      if (typeof n === 'string') return n;
      if (n === undefined) return strict ? `${what} T${i + 1} ต้องเป็นตัวเลข` : null;
      a.push(n);
    }
    const e = whole(a);
    if (e) return strict ? e : null;
    if (a.some((n, i) => n !== CODE[key][i])) out[key] = a;
    return null;
  };
  const err =
    one('hpRegenMult', BALANCE_RANGE.regenMult, 'ตัวคูณฟื้น HP') ??
    one('mpRegenMult', BALANCE_RANGE.regenMult, 'ตัวคูณฟื้น MP') ??
    arr('tierWeight', BALANCE_RANGE.tierWeight, 'โอกาส tier', (a) => (a.reduce((s, n) => s + n, 0) > 0 ? null : 'โอกาส tier รวมกันต้องมากกว่า 0')) ??
    arr('tierWidth', BALANCE_RANGE.tierWidth, 'ความกว้าง tier', (a) => {
      const sum = round3(a.reduce((s, n) => s + n, 0));
      return Math.abs(sum - 100) <= 0.001 ? null : `ความกว้าง tier รวมกันต้องได้ 100% (ตอนนี้ ${sum}%)`;
    }) ??
    one('rangeFloor', BALANCE_RANGE.rangeFloor, 'ค่าต่ำสุดของช่วง %') ??
    one('bossTierBoost', BALANCE_RANGE.bossTierBoost, 'บอสเพิ่มโอกาส tier ดี');
  if (err) return { error: err };
  // Fixed key order.
  const ordered: BalanceTuning = {};
  for (const k of TOP) if ((out as Record<string, unknown>)[k] !== undefined) (ordered as Record<string, unknown>)[k] = (out as Record<string, unknown>)[k];
  return { tuning: ordered };
}

/** Same tuning? (both already clean, as checkBalance returns them) */
export function sameBalance(a: BalanceTuning, b: BalanceTuning): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Whether the tier widths or floor differ (so item tier labels are redone). */
export function tierLabelsChange(a: BalanceTuning, b: BalanceTuning): boolean {
  return JSON.stringify([a.tierWidth, a.rangeFloor]) !== JSON.stringify([b.tierWidth, b.rangeFloor]);
}

/** Short Thai text of what differs, for the audit log (e.g. "นักดาบ Lv1 พลังโจมตี 12 → 15"). */
export function balanceChanges(before: BalanceTuning, after: BalanceTuning): string {
  const a = mergeBalance(before);
  const b = mergeBalance(after);
  const out: string[] = [];
  for (const id of CLASS_IDS) {
    const name = CLASSES[id].nameTh;
    for (const part of STAT_PARTS) {
      for (const k of STAT_KEYS) {
        const x = a.classes[id][part][k];
        const y = b.classes[id][part][k];
        if (x !== y) out.push(`${name} ${STAT_PART_NAME[part]} ${STAT_LABEL[k]} ${x} → ${y}`);
      }
    }
    if (a.classes[id].bossDmgMult !== b.classes[id].bossDmgMult) out.push(`${name} ดาเมจใส่บอส ×${a.classes[id].bossDmgMult} → ×${b.classes[id].bossDmgMult}`);
  }
  if (a.hpRegenMult !== b.hpRegenMult) out.push(`ตัวคูณฟื้น HP ${a.hpRegenMult} → ${b.hpRegenMult}`);
  if (a.mpRegenMult !== b.mpRegenMult) out.push(`ตัวคูณฟื้น MP ${a.mpRegenMult} → ${b.mpRegenMult}`);
  if (a.tierWeight.join() !== b.tierWeight.join()) out.push(`โอกาส tier ${a.tierWeight.join('/')} → ${b.tierWeight.join('/')}`);
  if (a.tierWidth.join() !== b.tierWidth.join()) out.push(`ความกว้าง tier ${a.tierWidth.join('/')} → ${b.tierWidth.join('/')}`);
  if (a.rangeFloor !== b.rangeFloor) out.push(`ค่าต่ำสุดของช่วง ${a.rangeFloor}% → ${b.rangeFloor}%`);
  if (a.bossTierBoost !== b.bossTierBoost) out.push(`บอสเพิ่มโอกาส tier ดี ${a.bossTierBoost} → ${b.bossTierBoost}`);
  return out.join(', ');
}
