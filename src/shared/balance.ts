// Game balance the owner (and GMs, if allowed) tune from the /admin "ปรับสมดุล" tab: every class's stats
// (Lv1, per level, multipliers, boss damage), the game-wide regen cuts, and the item tier tables
// (chances, widths, floor, bosses' tier boost). Pure data and checks: the code defaults are in
// data/classes.ts and data/items.ts, and changes are saved in the server's settings table as overrides
// only (like cos_tuning), so an untouched server runs exactly the code. The server applies them at start
// and on every save, and sends them to every browser so tooltips and the blacksmith's odds match.
import { CLASSES, CLASS_IDS } from './data/classes';
import {
  CODE_BOSS_TIER_BOOST, CODE_RANGE_FLOOR, CODE_TIER_WEIGHT, CODE_TIER_WIDTH, setTierTables, TIER_BAND_NAME, TIER_BANDS, type TierBand, type TierTableDef,
} from './data/items';
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

/**
 * Some parts of a tier table (owner 2026-11-11): each part given replaces the one it would otherwise use, each
 * part left out falls through. Arrays T1 first; widths and floor in %. A stat at an item's level band takes
 * each part from the first that has it: the stat's table for that band -> the stat's table for every level ->
 * the band's table for every stat -> the central table.
 */
export interface TierParts { weight?: number[]; width?: number[]; floor?: number; bossBoost?: number }
/** One stat's own tier table for every level, plus its tables for single level bands. */
export interface StatTierTuning extends TierParts { bands?: Partial<Record<TierBand, TierParts>> }
export type StatTierPart = keyof TierParts;
export const STAT_TIER_PARTS: readonly StatTierPart[] = ['weight', 'width', 'floor', 'bossBoost'];
export const STAT_TIER_PART_NAME: Record<StatTierPart, string> = { weight: 'โอกาส', width: 'ความกว้าง', floor: 'ค่าต่ำสุด', bossBoost: 'บอสเพิ่ม tier' };

/** Every tunable number, as the game uses it. Tier arrays are T1 first; widths and floor in %. */
export interface Balance {
  classes: Record<ClassId, ClassBalance>;
  hpRegenMult: number;
  mpRegenMult: number;
  tierWeight: number[];
  tierWidth: number[];
  rangeFloor: number;
  bossTierBoost: number;
  /** Stats with a tier table of their own (none in code); the others use the central one above. */
  statTiers: Partial<Record<StatKey, StatTierTuning>>;
  /** Level bands with a tier table of their own for every stat (none in code). */
  bandTiers: Partial<Record<TierBand, TierParts>>;
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
  /**
   * A stat listed here has its own tier table (only the parts given; the rest follow the central table).
   * Kept even when its numbers equal the code's: listing it is the change ("ตั้งเอง").
   */
  statTiers?: Partial<Record<StatKey, StatTierTuning>>;
  /** Same for level bands (all stats on items of that level band). */
  bandTiers?: Partial<Record<TierBand, TierParts>>;
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
    statTiers: {},
    bandTiers: {},
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
  if (t.statTiers) b.statTiers = structuredClone(t.statTiers);
  if (t.bandTiers) b.bandTiers = structuredClone(t.bandTiers);
  return b;
}

let tuning: BalanceTuning = {};
let current: Balance = mergeBalance({});

/** Uses this tuning from now on, everywhere (already checked by checkBalance). */
export function applyBalance(t: BalanceTuning): void {
  tuning = t;
  current = mergeBalance(t);
  const b = current;
  setTierTables((stat, band) => statTierTable(b, stat, band));
}

/** The tables a stat at a band takes parts from, first first (see TierParts); null stat / band = any. */
function tierChain(b: Balance, stat: StatKey | null, band: number | null): TierParts[] {
  const id = band === null ? null : TIER_BANDS[band];
  const st = stat ? b.statTiers[stat] : undefined;
  const out: (TierParts | undefined)[] = [id ? st?.bands?.[id] : undefined, st, id ? b.bandTiers[id] : undefined];
  return out.filter((x): x is TierParts => !!x);
}

/**
 * The whole tier table a stat uses on items of a level band (index into TIER_BANDS). `stat` null = stats
 * without their own; `band` null = every level (the stat's own table for all levels, or the central one).
 */
export function statTierTable(b: Balance, stat: StatKey | null, band: number | null): TierTableDef {
  const chain = tierChain(b, stat, band);
  const pick = <P extends StatTierPart>(p: P): TierParts[P] => chain.find((c) => c[p] !== undefined)?.[p];
  return {
    width: pick('width') ?? b.tierWidth,
    floor: pick('floor') ?? b.rangeFloor,
    weight: pick('weight') ?? b.tierWeight,
    bossBoost: pick('bossBoost') ?? b.bossTierBoost,
  };
}

/** Where a stat at a band takes its table from, in Thai (for the admin page). */
export function tierSourceName(b: Balance, stat: StatKey | null, band: number | null): string {
  const id = band === null ? null : TIER_BANDS[band];
  const st = stat ? b.statTiers[stat] : undefined;
  if (stat && id && hasParts(st?.bands?.[id])) return `${STAT_LABEL[stat]} ${TIER_BAND_NAME[id]}`;
  if (stat && hasParts(st)) return `${STAT_LABEL[stat]} ทุกเลเวล`;
  if (id && hasParts(b.bandTiers[id])) return `ทุกสเตตัส ${TIER_BAND_NAME[id]}`;
  return 'ตารางกลาง';
}

/** Whether these tier parts set anything. */
export const hasParts = (t: TierParts | undefined): boolean => !!t && STAT_TIER_PARTS.some((p) => t[p] !== undefined);

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
  const TOP = ['classes', 'hpRegenMult', 'mpRegenMult', 'tierWeight', 'tierWidth', 'rangeFloor', 'bossTierBoost', 'statTiers', 'bandTiers'];
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
  /** A tier array (5 numbers, T1 first): the array, undefined (missing / dropped), or an error to return. */
  const tierArr = (x: unknown, range: readonly [number, number], what: string, whole: (a: number[]) => string | null): number[] | undefined | string => {
    if (x === undefined) return undefined;
    if (!Array.isArray(x) || x.length !== 5) return strict ? `${what} ต้องมี 5 ค่า (T1–T5)` : undefined;
    const a: number[] = [];
    for (let i = 0; i < 5; i++) {
      const n = num(x[i], range[0], range[1], `${what} T${i + 1}`);
      if (typeof n === 'string') return n;
      if (n === undefined) return strict ? `${what} T${i + 1} ต้องเป็นตัวเลข` : undefined;
      a.push(n);
    }
    const e = whole(a);
    if (e) return strict ? e : undefined;
    return a;
  };
  const weightsOk = (what: string) => (a: number[]): string | null => (a.reduce((s, n) => s + n, 0) > 0 ? null : `${what} รวมกันต้องมากกว่า 0`);
  const widthsOk = (what: string) => (a: number[]): string | null => {
    const sum = round3(a.reduce((s, n) => s + n, 0));
    return Math.abs(sum - 100) <= 0.001 ? null : `${what} รวมกันต้องได้ 100% (ตอนนี้ ${sum}%)`;
  };
  // Central tier arrays: saved whole when any entry differs from the code.
  const arr = (key: 'tierWeight' | 'tierWidth', range: readonly [number, number], what: string, whole: (a: number[]) => string | null): string | null => {
    const a = tierArr(o[key], range, what, whole);
    if (typeof a === 'string') return a;
    if (a && a.some((n, i) => n !== CODE[key][i])) out[key] = a;
    return null;
  };
  /** Tier parts of one table (`what` names it): every part given is kept, equal to the code or not, in STAT_TIER_PARTS order. */
  const tierParts = (go: Record<string, unknown>, what: string, extraKeys: readonly string[]): TierParts | string => {
    if (strict) {
      const extra = Object.keys(go).find((p) => !(STAT_TIER_PARTS as readonly string[]).includes(p) && !extraKeys.includes(p));
      if (extra) return `ตาราง ${what}: ไม่รู้จักค่า "${extra.slice(0, 20)}"`;
    }
    const t: TierParts = {};
    const w = tierArr(go.weight, BALANCE_RANGE.tierWeight, `โอกาส ${what}`, weightsOk(`โอกาส ${what}`));
    if (typeof w === 'string') return w;
    if (w) t.weight = w;
    const wd = tierArr(go.width, BALANCE_RANGE.tierWidth, `ความกว้าง ${what}`, widthsOk(`ความกว้าง ${what}`));
    if (typeof wd === 'string') return wd;
    if (wd) t.width = wd;
    const f = num(go.floor, ...BALANCE_RANGE.rangeFloor, `ค่าต่ำสุดของช่วง ${what} %`);
    if (typeof f === 'string') return f;
    if (f !== undefined) t.floor = f;
    const bb = num(go.bossBoost, ...BALANCE_RANGE.bossTierBoost, `บอสเพิ่มโอกาส ${what} ดี`);
    if (typeof bb === 'string') return bb;
    if (bb !== undefined) t.bossBoost = bb;
    return t;
  };
  const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
  /** Tables per level band from `x` (in TIER_BANDS order), or an error; `what` names whose. */
  const bandTables = (x: unknown, what: string): Partial<Record<TierBand, TierParts>> | string => {
    const res: Partial<Record<TierBand, TierParts>> = {};
    if (x === undefined) return res;
    if (!isObj(x)) return strict ? `ตาราง tier ตามช่วงเลเวล${what}ไม่ถูกต้อง` : res;
    if (strict) {
      const extra = Object.keys(x).find((k) => !(TIER_BANDS as readonly string[]).includes(k));
      if (extra) return `ตาราง tier${what}: ไม่รู้จักช่วงเลเวล "${extra.slice(0, 20)}"`;
    }
    for (const id of TIER_BANDS) {
      const g = x[id];
      if (g === undefined) continue;
      const name = `tier${what} ${TIER_BAND_NAME[id]}`;
      if (!isObj(g)) {
        if (strict) return `ตาราง ${name} ไม่ถูกต้อง`;
        continue;
      }
      const t = tierParts(g, name, []);
      if (typeof t === 'string') return t;
      if (hasParts(t)) res[id] = t;
    }
    return res;
  };
  // Stats' own tier tables (every level, then per level band), in STAT_KEYS order.
  const statTiers = (): string | null => {
    const x = o.statTiers;
    if (x === undefined) return null;
    if (!isObj(x)) return strict ? 'ตาราง tier ต่อสเตตัสไม่ถูกต้อง' : null;
    if (strict) {
      const extra = Object.keys(x).find((k) => !(STAT_KEYS as readonly string[]).includes(k));
      if (extra) return `ตาราง tier: ไม่รู้จักสเตตัส "${extra.slice(0, 20)}"`;
    }
    const res: Partial<Record<StatKey, StatTierTuning>> = {};
    for (const k of STAT_KEYS) {
      const g = x[k];
      if (g === undefined) continue;
      const name = `tier ${STAT_LABEL[k]}`;
      if (!isObj(g)) {
        if (strict) return `ตาราง ${name} ไม่ถูกต้อง`;
        continue;
      }
      const t: StatTierTuning | string = tierParts(g, name, ['bands']);
      if (typeof t === 'string') return t;
      const bands = bandTables(g.bands, ` ${STAT_LABEL[k]}`);
      if (typeof bands === 'string') return bands;
      if (Object.keys(bands).length) t.bands = bands;
      if (hasParts(t) || t.bands) res[k] = t;
    }
    if (Object.keys(res).length) out.statTiers = res;
    return null;
  };
  // Level bands' own tier tables (all stats).
  const bandTiers = (): string | null => {
    const bands = bandTables(o.bandTiers, '');
    if (typeof bands === 'string') return bands;
    if (Object.keys(bands).length) out.bandTiers = bands;
    return null;
  };
  const err =
    one('hpRegenMult', BALANCE_RANGE.regenMult, 'ตัวคูณฟื้น HP') ??
    one('mpRegenMult', BALANCE_RANGE.regenMult, 'ตัวคูณฟื้น MP') ??
    arr('tierWeight', BALANCE_RANGE.tierWeight, 'โอกาส tier', weightsOk('โอกาส tier')) ??
    arr('tierWidth', BALANCE_RANGE.tierWidth, 'ความกว้าง tier', widthsOk('ความกว้าง tier')) ??
    one('rangeFloor', BALANCE_RANGE.rangeFloor, 'ค่าต่ำสุดของช่วง %') ??
    one('bossTierBoost', BALANCE_RANGE.bossTierBoost, 'บอสเพิ่มโอกาส tier ดี') ??
    statTiers() ??
    bandTiers();
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

/** Whether any stat's tier widths or floor differ, central or its own (so item tier labels are redone). */
export function tierLabelsChange(a: BalanceTuning, b: BalanceTuning): boolean {
  const labels = (t: BalanceTuning): string => {
    const m = mergeBalance(t);
    return JSON.stringify([null, ...STAT_KEYS].map((k) => TIER_BANDS.map((_, band) => {
      const d = statTierTable(m, k, band);
      return [d.width, d.floor];
    })));
  };
  return labels(a) !== labels(b);
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
  const part = (p: StatTierPart, v: TierParts[StatTierPart]): string =>
    v === undefined ? 'ไม่ได้ตั้ง' : Array.isArray(v) ? v.join('/') : p === 'floor' ? `${v}%` : String(v);
  const parts = (what: string, x: TierParts | undefined, y: TierParts | undefined): void => {
    for (const p of STAT_TIER_PARTS) {
      if (JSON.stringify(x?.[p]) !== JSON.stringify(y?.[p])) out.push(`tier ${what} ${STAT_TIER_PART_NAME[p]} ${part(p, x?.[p])} → ${part(p, y?.[p])}`);
    }
  };
  for (const id of TIER_BANDS) parts(`ทุกสเตตัส ${TIER_BAND_NAME[id]}`, a.bandTiers[id], b.bandTiers[id]);
  for (const k of STAT_KEYS) {
    parts(STAT_LABEL[k], a.statTiers[k], b.statTiers[k]);
    for (const id of TIER_BANDS) parts(`${STAT_LABEL[k]} ${TIER_BAND_NAME[id]}`, a.statTiers[k]?.bands?.[id], b.statTiers[k]?.bands?.[id]);
  }
  return out.join(', ');
}
