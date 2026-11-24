// Mystery box (owner 2026-11-22, rules: docs/systems/mystery-box.md). Monsters and bosses drop it; clicking it in
// the bag opens it on the server, which rolls one prize from the table below. Every row's chance, amount and
// on/off can be changed in /admin (settings key MYSTERY_BOX_SETTING keeps only what differs from here).
// Pure rules, no DOM: the server rolls, the browser and /admin only show the odds.
import type { Rng } from './rng';
import { COSMETICS } from './data/cosmetics';
import { BOSS_KEYS, QUEST_KEYS, type BaseStoneKind, type PotionKind, type PotionSize, type Rarity } from './types';

export const MYSTERY_BOX_SETTING = 'mystery_box';
/** Most of one item row (a bag stack holds 10). */
export const BOX_COUNT_MAX = 10;
/** Most gold one gold row may give. */
export const BOX_GOLD_MAX = 100_000_000;
/** Drop chances are typed as % in /admin; this is the most. */
export const BOX_DROP_PCT_MAX = 100;

export type BoxPrize =
  | { kind: 'gear'; rarity: Rarity }
  | { kind: 'stone'; stone: BaseStoneKind }
  | { kind: 'potion'; potion: PotionKind; size: PotionSize }
  | { kind: 'gold' }
  | { kind: 'orb' };

export interface BoxRowDef {
  id: string;
  name: string;
  prize: BoxPrize;
  /** In the box at all (owner can switch off). */
  on: boolean;
  /** Chance per box in %, or null = shares what the fixed rows leave equally with the other null rows. */
  pct: number | null;
  /** How many (gold rows: how much gold). Gear is always 1 piece. */
  count: number;
  /** Banner to the whole server when someone gets it. */
  announce: boolean;
}

const row = (id: string, name: string, prize: BoxPrize, pct: number | null, count = 1, on = true, announce = false): BoxRowDef =>
  ({ id, name, prize, on, pct, count, announce });
const KEY_NAME: Record<string, string> = { bear: 'หมี', witch: 'แม่มดหนอง', yeti: 'เยติ', heart: 'หัวใจลาวา', crab: 'ปูยักษ์' };
/** Floor 1's boss keys are in the owner's table; later floors' keys start switched off (the owner turns them on in /admin). */
const FLOOR1_KEY = new Set(['bear', 'witch', 'yeti', 'heart']);

/** The owner's table (2026-11-22). Order here is the order in /admin. */
export const BOX_ROWS: readonly BoxRowDef[] = [
  row('gear_epic', 'อุปกรณ์ม่วง (มหากาพย์)', { kind: 'gear', rarity: 'epic' }, 10),
  row('gear_legendary', 'อุปกรณ์ส้ม (ตำนาน)', { kind: 'gear', rarity: 'legendary' }, 5),
  ...BOSS_KEYS.map((k) => {
    const f1 = FLOOR1_KEY.has(k.slice(4));
    return row(`stone_${k}`, `กุญแจบอส ${KEY_NAME[k.slice(4)]}`, { kind: 'stone', stone: k }, f1 ? 2.5 : null, 1, f1);
  }),
  row('stone_enhance', 'หินตีบวก', { kind: 'stone', stone: 'enhance' }, 3),
  row('stone_protect', 'หินกันระดับลด', { kind: 'stone', stone: 'protect' }, 3),
  row('stone_reroll_values', 'หินสุ่มค่า', { kind: 'stone', stone: 'reroll_values' }, 5),
  row('stone_reroll_stat', 'หินสุ่มสเตตัส', { kind: 'stone', stone: 'reroll_stat' }, 5),
  row('stone_exp_scroll', 'ใบคูณ EXP 100%', { kind: 'stone', stone: 'exp_scroll' }, 1),
  row('stone_drop_scroll', 'ใบคูณดรอป 100%', { kind: 'stone', stone: 'drop_scroll' }, 1),
  row('stone_megaphone', 'โทรโข่ง', { kind: 'stone', stone: 'megaphone' }, 2),
  row('gold_big', 'ทองก้อนใหญ่', { kind: 'gold' }, 1, 1_000_000),
  row('orb', 'ลูกแก้วตีบวก (สุ่มเท่ากันทุกลูกที่ไม่ซ่อน)', { kind: 'orb' }, 0.05, 1, true, true),
  // The rest of 100% is shared equally by these.
  row('gear_rare', 'อุปกรณ์ฟ้า (หายาก)', { kind: 'gear', rarity: 'rare' }, null),
  row('gold_small', 'ทองก้อนเล็ก', { kind: 'gold' }, null, 10_000),
  row('pot_hp_l', 'ยา HP ใหญ่', { kind: 'potion', potion: 'hp', size: 'l' }, null, 5),
  row('pot_mp_l', 'ยา MP ใหญ่', { kind: 'potion', potion: 'mp', size: 'l' }, null, 5),
  row('stone_return_scroll', 'ม้วนคัมภีร์กลับเมือง', { kind: 'stone', stone: 'return_scroll' }, null),
  row('stone_phoenix', 'ขนนกฟีนิกซ์', { kind: 'stone', stone: 'phoenix' }, null),
  // Off: the owner can switch them on in /admin.
  row('gear_common', 'อุปกรณ์เทา (ธรรมดา)', { kind: 'gear', rarity: 'common' }, null, 1, false),
  row('gear_uncommon', 'อุปกรณ์เขียว (ดี)', { kind: 'gear', rarity: 'uncommon' }, null, 1, false),
  row('pot_hp_s', 'ยา HP เล็ก', { kind: 'potion', potion: 'hp', size: 's' }, null, 5, false),
  row('pot_hp_m', 'ยา HP กลาง', { kind: 'potion', potion: 'hp', size: 'm' }, null, 5, false),
  row('pot_mp_s', 'ยา MP เล็ก', { kind: 'potion', potion: 'mp', size: 's' }, null, 5, false),
  row('pot_mp_m', 'ยา MP กลาง', { kind: 'potion', potion: 'mp', size: 'm' }, null, 5, false),
  ...QUEST_KEYS.map((k) => row(`stone_${k}`, `กุญแจเควส ${KEY_NAME[k.slice(5)]}`, { kind: 'stone', stone: k }, null, 1, false)),
];
const ROW_BY_ID = new Map(BOX_ROWS.map((r) => [r.id, r]));

/** What the owner changed for one row (only the fields that differ). */
export interface BoxRowOverride {
  on?: boolean;
  pct?: number | null;
  count?: number;
  announce?: boolean;
}

/** The owner's changes. Missing = the code's value. */
export interface BoxOverrides {
  /** The box drops and opens at all (owner 2026-11-22: on from the start, can be switched off in /admin). */
  enabled?: boolean;
  /** Drop chance in % from a normal monster / a boss (before the drop scroll ×2). */
  mobPct?: number;
  /** Orbs are also sold in the cash shop (owner 2026-11-22: no, they come from the box). */
  orbsInShop?: boolean;
  bossPct?: number;
  rows?: Record<string, BoxRowOverride>;
}

export const BOX_DEFAULTS = { enabled: true, mobPct: 0.5, bossPct: 20, orbsInShop: false } as const;

/** A row with the owner's changes applied. */
export type BoxRow = BoxRowDef;

export interface BoxConfig {
  enabled: boolean;
  orbsInShop: boolean;
  mobPct: number;
  bossPct: number;
  rows: BoxRow[];
}

export function boxConfig(o: BoxOverrides = {}): BoxConfig {
  return {
    enabled: o.enabled ?? BOX_DEFAULTS.enabled,
    orbsInShop: o.orbsInShop ?? BOX_DEFAULTS.orbsInShop,
    mobPct: o.mobPct ?? BOX_DEFAULTS.mobPct,
    bossPct: o.bossPct ?? BOX_DEFAULTS.bossPct,
    rows: BOX_ROWS.map((d) => ({ ...d, ...o.rows?.[d.id] })),
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const pctOk = (v: unknown, max: number): v is number => isNum(v) && v >= 0 && v <= max;
const isGold = (d: BoxRowDef) => d.prize.kind === 'gold';
const countMax = (d: BoxRowDef) => (isGold(d) ? BOX_GOLD_MAX : d.prize.kind === 'gear' ? 1 : BOX_COUNT_MAX);

/**
 * A clean copy of the owner's changes (values equal to the code's dropped), or a Thai error. Fixed chances
 * of the rows that are on may not add up to more than 100%.
 */
export function cleanBoxOverrides(raw: unknown): BoxOverrides | string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'ค่ากล่องปริศนาไม่ถูกต้อง';
  const r = raw as Record<string, unknown>;
  const out: BoxOverrides = {};
  if (r.enabled !== undefined) {
    if (typeof r.enabled !== 'boolean') return 'สวิตช์เปิดกล่องไม่ถูกต้อง';
    if (r.enabled !== BOX_DEFAULTS.enabled) out.enabled = r.enabled;
  }
  if (r.orbsInShop !== undefined) {
    if (typeof r.orbsInShop !== 'boolean') return 'สวิตช์ขายลูกแก้วในแคชช็อปไม่ถูกต้อง';
    if (r.orbsInShop !== BOX_DEFAULTS.orbsInShop) out.orbsInShop = r.orbsInShop;
  }
  for (const k of ['mobPct', 'bossPct'] as const) {
    if (r[k] === undefined) continue;
    if (!pctOk(r[k], BOX_DROP_PCT_MAX)) return `โอกาสดรอป${k === 'mobPct' ? 'จากมอน' : 'จากบอส'}ต้องเป็น 0–${BOX_DROP_PCT_MAX}%`;
    if (r[k] !== BOX_DEFAULTS[k]) out[k] = r[k] as number;
  }
  if (r.rows !== undefined) {
    if (!r.rows || typeof r.rows !== 'object' || Array.isArray(r.rows)) return 'ตารางของในกล่องไม่ถูกต้อง';
    const rows: Record<string, BoxRowOverride> = {};
    for (const [id, v] of Object.entries(r.rows as Record<string, unknown>)) {
      const d = ROW_BY_ID.get(id);
      if (!d) return `ไม่รู้จักแถว ${id.slice(0, 30)}`;
      if (!v || typeof v !== 'object' || Array.isArray(v)) return `${d.name}: ค่าไม่ถูกต้อง`;
      const x = v as Record<string, unknown>;
      const o: BoxRowOverride = {};
      if (x.on !== undefined) {
        if (typeof x.on !== 'boolean') return `${d.name}: สวิตช์ไม่ถูกต้อง`;
        if (x.on !== d.on) o.on = x.on;
      }
      if (x.announce !== undefined) {
        if (typeof x.announce !== 'boolean') return `${d.name}: สวิตช์ประกาศไม่ถูกต้อง`;
        if (x.announce !== d.announce) o.announce = x.announce;
      }
      if (x.pct !== undefined) {
        if (x.pct !== null && !pctOk(x.pct, 100)) return `${d.name}: โอกาสต้องเป็น 0–100%`;
        if (x.pct !== d.pct) o.pct = x.pct as number | null;
      }
      if (x.count !== undefined) {
        const max = countMax(d);
        if (!isNum(x.count) || !Number.isInteger(x.count) || x.count < 1 || x.count > max) return `${d.name}: จำนวนต้องเป็น 1–${max.toLocaleString()}`;
        if (x.count !== d.count) o.count = x.count;
      }
      if (Object.keys(o).length) rows[id] = o;
    }
    if (Object.keys(rows).length) out.rows = rows;
  }
  const fixed = boxConfig(out).rows.filter((x) => x.on && x.pct !== null).reduce((a, x) => a + (x.pct ?? 0), 0);
  if (fixed > 100 + 1e-9) return `โอกาสที่ตั้งไว้รวมกัน ${+fixed.toFixed(4)}% เกิน 100%`;
  return out;
}

/** A row's real chance per box (%), as rolled. */
export interface BoxOdds {
  row: BoxRow;
  pct: number;
}

/**
 * The chance of every row that is in the box. `orbs` = how many orbs can come out (not hidden): the orb row is
 * left out when there are none, and its % goes to the rows that share the rest. The fixed rows keep their %;
 * the "share the rest" rows split what is left equally. With no share rows the chances are scaled to 100%.
 */
export function boxOdds(cfg: BoxConfig, orbs: number): BoxOdds[] {
  const live = cfg.rows.filter((r) => r.on && (r.prize.kind !== 'orb' || orbs > 0));
  const fixed = live.filter((r) => r.pct !== null);
  const share = live.filter((r) => r.pct === null);
  const fixedSum = fixed.reduce((a, r) => a + (r.pct ?? 0), 0);
  const each = share.length ? Math.max(0, 100 - fixedSum) / share.length : 0;
  const w = live.map((r) => ({ row: r, pct: r.pct ?? each }));
  const total = w.reduce((a, x) => a + x.pct, 0);
  if (total <= 0) return [];
  // Already 100% (the usual case): keep the typed values exact.
  if (Math.abs(total - 100) < 1e-9) return w.filter((x) => x.pct > 0);
  return w.map((x) => ({ row: x.row, pct: (x.pct * 100) / total })).filter((x) => x.pct > 0);
}

/** One roll: the row that came out, or null when nothing is in the box. */
export function rollBoxRow(odds: readonly BoxOdds[], r: Rng): BoxRow | null {
  if (!odds.length) return null;
  let roll = r() * odds.reduce((a, x) => a + x.pct, 0);
  for (const x of odds) {
    roll -= x.pct;
    if (roll < 0) return x.row;
  }
  return odds[odds.length - 1].row;
}

/** "0.05%" style text for /admin and tooltips (more digits for tiny chances). */
export function fmtPct(p: number): string {
  if (p === 0) return '0%';
  const digits = p >= 1 ? 2 : p >= 0.01 ? 4 : 6;
  return `${+p.toFixed(digits)}%`;
}

// ---------------------------------------------------------------- what the server uses now

let current: BoxConfig = boxConfig();
let hiddenCos: ReadonlySet<string> = new Set();
/** The server sets the owner's table at start and after every save in /admin. */
export function setBoxConfig(o: BoxOverrides): void {
  current = boxConfig(o);
}
export const boxNow = (): BoxConfig => current;
/** Cosmetics hidden in /admin (hidden orbs don't come out of the box). */
export function setBoxHiddenCos(ids: Iterable<string>): void {
  hiddenCos = new Set(ids);
}
/** The orbs that can come out now: every orb in the shop list that isn't hidden. */
export const boxOrbs = (): string[] => COSMETICS.filter((c) => c.slot === 'orb' && !hiddenCos.has(c.id)).map((c) => c.id);

// ---------------------------------------------------------- /admin

/** What the /admin tab gets: the owner's changes and the orbs that can come out now (not hidden). */
export interface AdminBox {
  overrides: BoxOverrides;
  orbs: { id: string; name: string }[];
}

/** Audit text of what changed (e.g. `เปิดกล่อง · หินตีบวก: 3% → 2%`). */
export function boxChanges(before: BoxOverrides, after: BoxOverrides): string {
  const a = boxConfig(before);
  const b = boxConfig(after);
  const out: string[] = [];
  if (a.enabled !== b.enabled) out.push(b.enabled ? 'เปิดกล่อง' : 'ปิดกล่อง');
  if (a.orbsInShop !== b.orbsInShop) out.push(b.orbsInShop ? 'ขายลูกแก้วในแคชช็อป' : 'ลูกแก้วได้จากกล่องเท่านั้น');
  if (a.mobPct !== b.mobPct) out.push(`ดรอปจากมอน ${a.mobPct}% → ${b.mobPct}%`);
  if (a.bossPct !== b.bossPct) out.push(`ดรอปจากบอส ${a.bossPct}% → ${b.bossPct}%`);
  const pct = (x: number | null) => (x === null ? 'แบ่งส่วนที่เหลือ' : `${x}%`);
  b.rows.forEach((r, i) => {
    const o = a.rows[i];
    const d: string[] = [];
    if (o.on !== r.on) d.push(r.on ? 'เปิด' : 'ปิด');
    if (o.pct !== r.pct) d.push(`${pct(o.pct)} → ${pct(r.pct)}`);
    if (o.count !== r.count) d.push(`จำนวน ${o.count.toLocaleString()} → ${r.count.toLocaleString()}`);
    if (o.announce !== r.announce) d.push(r.announce ? 'ประกาศ' : 'ไม่ประกาศ');
    if (d.length) out.push(`${r.name}: ${d.join(', ')}`);
  });
  return out.join(' · ');
}
