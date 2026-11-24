// Minigame "รอดมอนเป็นระลอก" (survive the waves, owner 2026-11-21): a map made in the editor with this minigame gives every group
// that walks in its own room; after a countdown, waves of monsters come out of the map's wave spots, each wave bigger and stronger;
// clearing one pays gold, clearing the last pays a bonus. All the numbers are here, server-wide, adjustable in /admin (BalanceTuning.waves,
// stored as what differs from the code). Shared by the server's Sim, the browser and /admin.
import type { LoadWait } from './bossRoom';

export interface WaveConfig {
  /** The minigame on at all (/admin switch "minigameWaves"). Off: its maps' doors say it is closed. */
  on: boolean;
  /** Waves in one run. */
  waves: number;
  /** Monsters in wave 1, and how many more each wave after it. */
  base: number;
  grow: number;
  /** % more HP and attack per wave after the first. */
  statUp: number;
  /** Seconds from entering to wave 1, and between waves. */
  countdown: number;
  rest: number;
  /** Gold for clearing wave n: goldPerWave × n, to everyone in the room. */
  goldPerWave: number;
  /** For clearing the last wave: gold and EXP to everyone in the room. */
  bonusGold: number;
  bonusExp: number;
  /** Runs one character may start per day (Thai time); 0 = no limit. */
  dailyLimit: number;
  /** Seconds the winners stay (to see the result) before being sent out. */
  endSec: number;
}

export type WaveTuning = Partial<WaveConfig>;
type NumKey = Exclude<keyof WaveConfig, 'on'>;

/** Each number's name in /admin and its allowed range. */
export const WAVE_NUMS: Record<NumKey, { name: string; range: [number, number] }> = {
  waves: { name: 'จำนวนระลอก', range: [1, 50] },
  base: { name: 'มอนระลอกแรก (ตัว)', range: [1, 50] },
  grow: { name: 'มอนเพิ่มต่อระลอก (ตัว)', range: [0, 20] },
  statUp: { name: 'มอนแรงขึ้นต่อระลอก (% HP/พลังโจมตี)', range: [0, 100] },
  countdown: { name: 'นับถอยหลังก่อนระลอกแรก (วิ)', range: [0, 60] },
  rest: { name: 'พักระหว่างระลอก (วิ)', range: [0, 60] },
  goldPerWave: { name: 'ทองต่อระลอก (× เลขระลอก)', range: [0, 100000] },
  bonusGold: { name: 'โบนัสทองเมื่อผ่านครบ', range: [0, 1000000] },
  bonusExp: { name: 'โบนัส EXP เมื่อผ่านครบ', range: [0, 10000000] },
  dailyLimit: { name: 'เล่นได้ต่อวันต่อตัวละคร (0 = ไม่จำกัด)', range: [0, 100] },
  endSec: { name: 'รอก่อนส่งออกหลังชนะ (วิ)', range: [0, 120] },
};
const NUM_KEYS = Object.keys(WAVE_NUMS) as NumKey[];

/** The values in code (owner 2026-11-21). */
export function codeWaves(): WaveConfig {
  return { on: true, waves: 10, base: 5, grow: 2, statUp: 10, countdown: 10, rest: 5, goldPerWave: 100, bonusGold: 2000, bonusExp: 1000, dailyLimit: 0, endSec: 10 };
}

export function mergeWaves(t: WaveTuning | undefined): WaveConfig {
  return { ...codeWaves(), ...(t ?? {}) };
}

/** Cleans what /admin sent: unknown keys and bad values are errors when `strict`, else dropped. Keeps only what differs from the code. */
export function checkWaveTuning(x: unknown, strict: boolean): { tuning: WaveTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!x || typeof x !== 'object' || Array.isArray(x)) return strict ? { error: 'ค่ามินิเกมระลอกไม่ถูกต้อง' } : { tuning: undefined };
  const o = x as Record<string, unknown>;
  if (strict) {
    const extra = Object.keys(o).find((k) => k !== 'on' && !(NUM_KEYS as string[]).includes(k));
    if (extra) return { error: `มินิเกมระลอก: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const code = codeWaves();
  const out: WaveTuning = {};
  if (o.on !== undefined) {
    if (typeof o.on !== 'boolean') { if (strict) return { error: 'สวิตช์มินิเกมระลอกต้องเป็นเปิด/ปิด' }; } else if (o.on !== code.on) out.on = o.on;
  }
  for (const k of NUM_KEYS) {
    const v = o[k];
    if (v === undefined) continue;
    const [lo, hi] = WAVE_NUMS[k].range;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
      if (strict) return { error: `${WAVE_NUMS[k].name} ต้องอยู่ระหว่าง ${lo} ถึง ${hi}` };
      continue;
    }
    const n = Math.round(v);
    if (n !== code[k]) out[k] = n;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** What changed, in Thai, for the audit log. */
export function waveChanges(a: WaveConfig, b: WaveConfig): string[] {
  const out: string[] = [];
  if (a.on !== b.on) out.push(`มินิเกมรอดมอนเป็นระลอก ${a.on ? 'เปิด' : 'ปิด'} → ${b.on ? 'เปิด' : 'ปิด'}`);
  for (const k of NUM_KEYS) if (a[k] !== b[k]) out.push(`มินิเกมระลอก: ${WAVE_NUMS[k].name} ${a[k]} → ${b[k]}`);
  return out;
}

/** Monsters in wave `n` (1-based). */
export const waveCount = (c: WaveConfig, n: number): number => c.base + c.grow * (n - 1);
/** The strength multiplier of wave `n`. */
export const waveStats = (c: WaveConfig, n: number): number => 1 + (c.statUp / 100) * (n - 1);

/** What the browser shows of a run (in the snapshot). */
export interface WaveSnap {
  /** The wave on now (0 = not started yet). */
  wave: number;
  of: number;
  /** Monsters of this wave still standing. */
  left: number;
  /** Seconds before the next wave (the countdown, or the rest). */
  nextIn?: number;
  /** The countdown to wave 1 waits for players still loading the map (owner 2026-11-24). */
  wait?: LoadWait;
  /** Won: seconds before everyone is sent out. */
  wonIn?: number;
  /** Everyone is down: seconds left to get up before the group has lost. */
  wipeIn?: number;
  /** How many more times you may get up here with a phoenix feather. */
  revives: number;
}

/** A wave spot drawn on the map in the editor (MapData.waveSpots). */
export interface WaveSpot { x: number; z: number; radius: number }
