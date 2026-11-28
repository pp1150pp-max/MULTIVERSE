// Treasure chests (the farm maps of floors 1 and 2) and shrines (floor 1's) (owner 2026-11-27, rules: docs/systems/chests-shrines.md).
// Which a map has is map data (MapData.chests / MapData.shrines, placed in the /admin map editor); a chest comes up at a random spot
// every time (src/shared/chestSpots.ts, owner 2026-11-28) unless that is switched off. Every number here is a code
// default the owner can change in /admin (BalanceTuning.treasure, stored as what differs from the code). Pure rules, no DOM:
// the server's Sim rolls and decides, the browser and /admin only show.
import type { Rng } from './rng';
import type { ShrineBuff } from './mapSchema';
import type { BaseStoneKind, PotionKind, PotionSize, Rarity } from './types';

/** What one row of the chest table gives (on top of the gold every chest has). `key` = the boss key of the chest's map. */
export type ChestPrize =
  | { kind: 'gear'; rarity: Rarity }
  | { kind: 'stone'; stone: BaseStoneKind }
  | { kind: 'potion'; potion: PotionKind; size: PotionSize }
  | { kind: 'key' };

export interface ChestRowDef {
  id: string;
  name: string;
  prize: ChestPrize;
  /** Chance per chest in %, or null = shares what the fixed rows leave equally with the other null rows (like the mystery box). */
  pct: number | null;
  /** How many (gear is always 1 piece). */
  count: number;
}

const row = (id: string, name: string, prize: ChestPrize, pct: number | null, count = 1): ChestRowDef => ({ id, name, prize, pct, count });

/**
 * The owner's table (2026-11-27, "ใช้ตามที่เสนอ"; purple 15% and orange 5% the same day). Every chest drops TreasureConfig.pieces
 * pieces: epicSure of them are always purple gear, each of the others is one roll of this table (repeats allowed). Order = /admin.
 */
export const CHEST_ROWS: readonly ChestRowDef[] = [
  row('gear_uncommon', 'อุปกรณ์เขียว (ดี)', { kind: 'gear', rarity: 'uncommon' }, 30),
  row('gear_rare', 'อุปกรณ์ฟ้า (หายาก)', { kind: 'gear', rarity: 'rare' }, 15),
  row('gear_epic', 'อุปกรณ์ม่วง (มหากาพย์)', { kind: 'gear', rarity: 'epic' }, 15),
  row('gear_legendary', 'อุปกรณ์ส้ม (ตำนาน)', { kind: 'gear', rarity: 'legendary' }, 5),
  row('stone_reroll_values', 'หินสุ่มค่า', { kind: 'stone', stone: 'reroll_values' }, 6),
  row('stone_reroll_stat', 'หินสุ่มสเตตัส', { kind: 'stone', stone: 'reroll_stat' }, 6),
  row('stone_enhance', 'หินตีบวก', { kind: 'stone', stone: 'enhance' }, 3),
  row('stone_protect', 'หินกันระดับลด', { kind: 'stone', stone: 'protect' }, 2),
  row('stone_mystery_box', 'กล่องปริศนา', { kind: 'stone', stone: 'mystery_box' }, 2),
  row('boss_key', 'กุญแจบอสของแมพนั้น', { kind: 'key' }, 1),
  row('pot_hp_m', 'ยา HP กลาง', { kind: 'potion', potion: 'hp', size: 'm' }, null, 3),
  row('pot_mp_m', 'ยา MP กลาง', { kind: 'potion', potion: 'mp', size: 'm' }, null, 3),
  row('stone_return_scroll', 'ม้วนคัมภีร์กลับเมือง', { kind: 'stone', stone: 'return_scroll' }, null),
];

/** Most of one item row (a bag stack holds 10). */
export const CHEST_COUNT_MAX = 10;

/** A row as the server uses it now: the code's row with the owner's changes. */
export interface ChestRow extends ChestRowDef {
  /** In the chest at all (the owner can switch a row off). */
  on: boolean;
}

export interface TreasureConfig {
  /** Chests can be opened / shrines touched at all (off: they are not drawn and do nothing). */
  chests: boolean;
  shrines: boolean;
  /** The glow round chests and shrines (owner 2026-11-27 "ให้มีออร่าด้วย"): a light on the ground, a turning ring, rising sparks. */
  aura: boolean;
  /** A chest comes up at a new random spot every time (off: where the map editor put it). */
  randomSpots: boolean;
  /** World units a random spot keeps from other chests (and its last spot), the camp, doors and warp circles, the boss summoner. */
  spotGap: number;
  campGap: number;
  doorGap: number;
  bossGap: number;
  /** Seconds before an opened chest is back. */
  chestRespawn: number;
  /** Seconds a player stands at the chest to open it (moving, attacking or being hit stops it; 0 = at once). */
  openSec: number;
  /** How close (world units) a player must stand to a chest / a shrine. */
  range: number;
  /** Gold in every chest: this × the middle level of the map's band, ± goldSpread %. */
  goldPerLevel: number;
  goldSpread: number;
  /** Pieces one chest drops on the ground around it (owner 2026-11-27: 10), and how many of them are surely purple gear (1). */
  pieces: number;
  epicSure: number;
  /** A shrine's buff: how long it lasts, and the seconds before the same player can use the same shrine again. */
  buffSec: number;
  shrineCd: number;
  /** The three buffs, in %: attack, move speed (outside the gear's move-speed cap) and EXP. */
  atkPct: number;
  speedPct: number;
  expPct: number;
  rows: ChestRow[];
}

type FlagKey = 'chests' | 'shrines' | 'aura' | 'randomSpots';
const FLAG_KEYS: readonly FlagKey[] = ['chests', 'shrines', 'aura', 'randomSpots'];
/** Each switch's name in /admin errors and the audit log. */
const FLAG_NAME: Record<FlagKey, string> = { chests: 'หีบสมบัติ', shrines: 'ศาลเจ้า', aura: 'ออร่าหีบ/ศาล', randomSpots: 'หีบสุ่มจุดเกิด' };
type NumKey = Exclude<keyof TreasureConfig, FlagKey | 'rows'>;
/** Each number's name in /admin, its range and the step of its field. */
export const TREASURE_NUMS: Record<NumKey, { name: string; range: [number, number]; step: number }> = {
  chestRespawn: { name: 'หีบเกิดใหม่หลังถูกเปิด (วิ)', range: [10, 86400], step: 1 },
  openSec: { name: 'ยืนเปิดหีบนาน (วิ, 0 = ทันที)', range: [0, 10], step: 0.1 },
  range: { name: 'ระยะกดหีบ/ศาล (หน่วย)', range: [1, 6], step: 0.1 },
  goldPerLevel: { name: 'ทองในหีบ (× เลเวลกลางของแมพ)', range: [0, 100000], step: 1 },
  goldSpread: { name: 'ทองแกว่ง ± (%)', range: [0, 100], step: 1 },
  pieces: { name: 'ของต่อหีบ (ชิ้น ตกพื้นรอบหีบ)', range: [1, 30], step: 1 },
  epicSure: { name: 'ในนั้นเป็นอุปกรณ์ม่วงแน่นอน (ชิ้น)', range: [0, 30], step: 1 },
  buffSec: { name: 'บัฟศาลเจ้านาน (วิ)', range: [5, 3600], step: 1 },
  shrineCd: { name: 'ใช้ศาลเดิมซ้ำได้อีกใน (วิ ต่อคน)', range: [0, 86400], step: 1 },
  atkPct: { name: 'บัฟพลังโจมตี (%)', range: [0, 200], step: 1 },
  speedPct: { name: 'บัฟความเร็วเคลื่อนที่ (%)', range: [0, 200], step: 1 },
  expPct: { name: 'บัฟ EXP (%)', range: [0, 500], step: 1 },
  spotGap: { name: 'สุ่มจุดหีบ: ห่างหีบอื่น/จุดเดิม (หน่วย)', range: [0, 100], step: 1 },
  campGap: { name: 'สุ่มจุดหีบ: ห่างจุดเริ่ม/จุดพัก (หน่วย)', range: [0, 100], step: 1 },
  doorGap: { name: 'สุ่มจุดหีบ: ห่างประตู/วงวาร์ป (หน่วย)', range: [0, 100], step: 1 },
  bossGap: { name: 'สุ่มจุดหีบ: ห่างจุดเรียกบอส (หน่วย)', range: [0, 100], step: 1 },
};
const NUM_KEYS = Object.keys(TREASURE_NUMS) as NumKey[];

/** The owner's changes to one row (only what differs). */
export interface ChestRowTuning {
  on?: boolean;
  pct?: number | null;
  count?: number;
}
/** What is saved: only what differs from the code. */
export type TreasureTuning = Partial<Omit<TreasureConfig, 'rows'>> & { rows?: Record<string, ChestRowTuning> };

/** The values in code (owner 2026-11-27). */
export function codeTreasure(): TreasureConfig {
  return {
    chests: true, shrines: true, aura: true, randomSpots: true, spotGap: 30, campGap: 25, doorGap: 12, bossGap: 16,
    chestRespawn: 600, openSec: 1.5, range: 2.5, goldPerLevel: 50, goldSpread: 30, pieces: 10, epicSure: 1,
    buffSec: 180, shrineCd: 600, atkPct: 15, speedPct: 20, expPct: 30,
    rows: CHEST_ROWS.map((r) => ({ ...r, prize: { ...r.prize }, on: true })),
  };
}

export function mergeTreasure(t: TreasureTuning | undefined): TreasureConfig {
  const c = codeTreasure();
  const { rows, ...rest } = t ?? {};
  return { ...c, ...rest, rows: c.rows.map((r) => ({ ...r, ...rows?.[r.id] })) };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Cleans what /admin sent: unknown keys and bad values are errors when `strict`, else dropped. Keeps only what differs from the code. */
export function checkTreasureTuning(x: unknown, strict: boolean): { tuning: TreasureTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!x || typeof x !== 'object' || Array.isArray(x)) return strict ? { error: 'ค่าหีบสมบัติ/ศาลเจ้าไม่ถูกต้อง' } : { tuning: undefined };
  const o = x as Record<string, unknown>;
  if (strict) {
    const extra = Object.keys(o).find((k) => k !== 'rows' && !(FLAG_KEYS as readonly string[]).includes(k) && !(NUM_KEYS as string[]).includes(k));
    if (extra) return { error: `หีบสมบัติ/ศาลเจ้า: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const code = codeTreasure();
  const out: TreasureTuning = {};
  for (const k of FLAG_KEYS) {
    const v = o[k];
    if (v === undefined) continue;
    if (typeof v !== 'boolean') { if (strict) return { error: `สวิตช์${FLAG_NAME[k]}ต้องเป็นเปิด/ปิด` }; } else if (v !== code[k]) out[k] = v;
  }
  for (const k of NUM_KEYS) {
    const v = o[k];
    if (v === undefined) continue;
    const { name, range: [lo, hi], step } = TREASURE_NUMS[k];
    if (!isNum(v) || v < lo || v > hi) {
      if (strict) return { error: `${name} ต้องอยู่ระหว่าง ${lo} ถึง ${hi}` };
      continue;
    }
    const n = step < 1 ? Math.round(v * 10) / 10 : Math.round(v);
    if (n !== code[k]) out[k] = n;
  }
  // The whole config sent back (rows as the list mergeTreasure gives) is read by row id like the saved form.
  const rowsIn = Array.isArray(o.rows)
    ? Object.fromEntries((o.rows as unknown[]).filter((r): r is { id: string } => !!r && typeof (r as { id?: unknown }).id === 'string').map((r) => [r.id, r]))
    : o.rows;
  if (rowsIn !== undefined) {
    if (!rowsIn || typeof rowsIn !== 'object') {
      if (strict) return { error: 'ตารางของในหีบไม่ถูกต้อง' };
    } else {
      const rows: Record<string, ChestRowTuning> = {};
      for (const [id, raw] of Object.entries(rowsIn as Record<string, unknown>)) {
        const d = code.rows.find((r) => r.id === id);
        if (!d) { if (strict) return { error: `ตารางของในหีบ: ไม่รู้จักแถว "${id.slice(0, 30)}"` }; continue; }
        if (!raw || typeof raw !== 'object') { if (strict) return { error: `${d.name}: ค่าไม่ถูกต้อง` }; continue; }
        const r = raw as Record<string, unknown>;
        const t: ChestRowTuning = {};
        if (r.on !== undefined) {
          if (typeof r.on !== 'boolean') { if (strict) return { error: `${d.name}: เปิด/ปิดไม่ถูกต้อง` }; } else if (r.on !== d.on) t.on = r.on;
        }
        if (r.pct !== undefined) {
          if (r.pct !== null && (!isNum(r.pct) || r.pct < 0 || r.pct > 100)) { if (strict) return { error: `${d.name}: โอกาสต้องเป็น 0–100%` }; }
          else if (r.pct !== d.pct) t.pct = r.pct === null ? null : Math.round(r.pct * 10000) / 10000;
        }
        if (r.count !== undefined) {
          const max = d.prize.kind === 'gear' ? 1 : CHEST_COUNT_MAX;
          if (!isNum(r.count) || !Number.isInteger(r.count) || r.count < 1 || r.count > max) { if (strict) return { error: `${d.name}: จำนวนต้องเป็น 1–${max}` }; }
          else if (r.count !== d.count) t.count = r.count;
        }
        if (Object.keys(t).length) rows[id] = t;
      }
      if (Object.keys(rows).length) out.rows = rows;
    }
  }
  const fixed = mergeTreasure(out).rows.filter((r) => r.on && r.pct !== null).reduce((a, r) => a + (r.pct ?? 0), 0);
  if (strict && fixed > 100 + 1e-9) return { error: `โอกาสของในหีบที่ตั้งไว้รวมกัน ${+fixed.toFixed(4)}% เกิน 100%` };
  const m = mergeTreasure(out);
  if (strict && m.epicSure > m.pieces) return { error: `อุปกรณ์ม่วงแน่นอน (${m.epicSure}) มากกว่าของต่อหีบ (${m.pieces}) ไม่ได้` };
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** What changed, in Thai, for the audit log. */
export function treasureChanges(a: TreasureConfig, b: TreasureConfig): string[] {
  const out: string[] = [];
  const onOff = (v: boolean) => (v ? 'เปิด' : 'ปิด');
  for (const k of FLAG_KEYS) if (a[k] !== b[k]) out.push(`${FLAG_NAME[k]} ${onOff(a[k])} → ${onOff(b[k])}`);
  for (const k of NUM_KEYS) if (a[k] !== b[k]) out.push(`หีบ/ศาล: ${TREASURE_NUMS[k].name} ${a[k]} → ${b[k]}`);
  const pct = (x: number | null) => (x === null ? 'แบ่งส่วนที่เหลือ' : `${x}%`);
  b.rows.forEach((r, i) => {
    const o = a.rows[i];
    if (!o) return;
    if (o.on !== r.on) out.push(`ของในหีบ ${r.name}: ${onOff(o.on)} → ${onOff(r.on)}`);
    if (o.pct !== r.pct) out.push(`ของในหีบ ${r.name}: ${pct(o.pct)} → ${pct(r.pct)}`);
    if (o.count !== r.count) out.push(`ของในหีบ ${r.name}: จำนวน ${o.count} → ${r.count}`);
  });
  return out;
}

/** A row's real chance per chest (%). */
export interface ChestOdds { row: ChestRow; pct: number }

/**
 * The chance of every row that is in the chest. `hasKey` = the map has a boss key (the key row is left out otherwise, its % going
 * to the rows that share the rest). The fixed rows keep their %; the null rows split what is left; with none, scaled to 100%.
 */
export function chestOdds(cfg: TreasureConfig, hasKey: boolean): ChestOdds[] {
  const live = cfg.rows.filter((r) => r.on && (r.prize.kind !== 'key' || hasKey));
  const fixedSum = live.filter((r) => r.pct !== null).reduce((a, r) => a + (r.pct ?? 0), 0);
  const share = live.filter((r) => r.pct === null);
  const each = share.length ? Math.max(0, 100 - fixedSum) / share.length : 0;
  const w = live.map((r) => ({ row: r, pct: r.pct ?? each }));
  const total = w.reduce((a, x) => a + x.pct, 0);
  if (total <= 0) return [];
  if (Math.abs(total - 100) < 1e-9) return w.filter((x) => x.pct > 0);
  return w.map((x) => ({ row: x.row, pct: (x.pct * 100) / total })).filter((x) => x.pct > 0);
}

/** One roll of the table: the row that came out (null when the table is empty). */
export function rollChestRow(odds: readonly ChestOdds[], r: Rng): ChestRow | null {
  if (!odds.length) return null;
  let roll = r() * odds.reduce((a, x) => a + x.pct, 0);
  for (const x of odds) {
    roll -= x.pct;
    if (roll < 0) return x.row;
  }
  return odds[odds.length - 1].row;
}

/** The gold in one chest on a map of `levels` (at least 1 when goldPerLevel > 0). */
export function chestGold(cfg: TreasureConfig, levels: readonly [number, number], r: Rng): number {
  if (cfg.goldPerLevel <= 0) return 0;
  const mid = (levels[0] + levels[1]) / 2;
  const spread = (cfg.goldSpread / 100) * (r() * 2 - 1);
  return Math.max(1, Math.round(cfg.goldPerLevel * mid * (1 + spread)));
}

/** A shrine buff's % now. */
export const shrinePct = (cfg: TreasureConfig, b: ShrineBuff): number => (b === 'atk' ? cfg.atkPct : b === 'speed' ? cfg.speedPct : cfg.expPct);
/** Its name on screen. */
export const SHRINE_BUFF_NAME: Record<ShrineBuff, string> = { atk: 'พลังโจมตี', speed: 'ความเร็วเคลื่อนที่', exp: 'EXP' };
/** Its icon (placeholder until the owner's papercraft icons, art_templates/chests-shrines/PROMPTS.md). */
export const SHRINE_BUFF_ICON: Record<ShrineBuff, string> = { atk: '⚔️', speed: '👟', exp: '✨' };

/** What the browser is sent of the shrine state of its own character (PrivateSnap.shr). */
export interface ShrineSnap {
  /** Buffs running: [buff, seconds left, seconds given, %]. */
  b?: [ShrineBuff, number, number, number][];
  /** Shrines of this map still cooling down for us: shrine id → seconds left. */
  cd?: Record<string, number>;
}
