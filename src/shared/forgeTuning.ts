// Blacksmith enhancement (ตีบวก) numbers the owner tunes on /admin → ปรับสมดุล → "ตีบวก" (owner 2026-11-20: every
// number). Saved inside the balance tuning (`BalanceTuning.forge`), only what differs from the code. The rules that use
// them are in data/enhance.ts, which reads currentBalance().forge, so the server's Sim and the browser's forge window
// see the same numbers. No imports: balance.ts and enhance.ts both depend on this file.

/** Structural top + level: orb codes pack the level in 4 bits and every table runs 0..15. maxPlus can only go lower. */
export const PLUS_CAP = 15;
/** "From" levels set to this never happen (no drop / no stones / no announce / nothing hidden / no orbs / no aura tier). */
export const PLUS_NEVER = PLUS_CAP + 1;

export interface ForgeConfig {
  /** Success chance in % to reach each + level (index = target level, 0 unused). */
  rate: number[];
  /** Gold cost multiplier to reach each + level (index = target level, 0 unused). */
  costMult: number[];
  /** Bonus % of every stat line gained on reaching each + level (index = level, 0 unused); the totals add up. */
  bonusStep: number[];
  /** Gold cost = (costBase + item level × costPerLevel) × costMult. */
  costBase: number;
  costPerLevel: number;
  /** Each failed attempt adds this many % to the item's next chance, until it succeeds. */
  pity: number;
  /** Attempts aiming at this level or higher lose one level on a fail (PLUS_NEVER = never). */
  dropFrom: number;
  /** Attempts aiming at this level or higher use enhancement stones (PLUS_NEVER = never). */
  stoneFrom: number;
  stonesPerTry: number;
  /** Reaching this level or higher is announced to the whole server (PLUS_NEVER = never). */
  announceFrom: number;
  /** Highest level the blacksmith enhances to (1..PLUS_CAP). Gear already above it keeps its level. */
  maxPlus: number;
  /** Seconds between two blacksmith actions (enhance or reroll) by the same player. */
  cd: number;
  /** Each worn item at this level or higher gets an orb (PLUS_NEVER = no orbs). */
  orbMin: number;
  /** The aura's 4 tiers start at these levels (non-decreasing; PLUS_NEVER = that tier never shows). */
  aura: number[];
  /** The merchant pays this many % more per + level. */
  sellPerPlus: number;
  /** The forge window shows "??" instead of the chance from this target level up (display only; PLUS_NEVER = never). */
  hiddenFrom: number;
}

type Levels = Partial<Record<string, number>>;
export interface ForgeTuning {
  rate?: Levels;
  costMult?: Levels;
  bonusStep?: Levels;
  costBase?: number;
  costPerLevel?: number;
  pity?: number;
  dropFrom?: number;
  stoneFrom?: number;
  stonesPerTry?: number;
  announceFrom?: number;
  maxPlus?: number;
  cd?: number;
  orbMin?: number;
  aura?: number[];
  sellPerPlus?: number;
  hiddenFrom?: number;
}

/** Allowed ranges, both ends included. */
export const FORGE_RANGE = {
  rate: [0, 100],
  costMult: [0, 10000],
  bonusStep: [0, 1000],
  costBase: [0, 1000000],
  costPerLevel: [0, 100000],
  pity: [0, 100],
  from: [1, PLUS_NEVER],
  stonesPerTry: [0, 99],
  maxPlus: [1, PLUS_CAP],
  cd: [0.3, 30],
  sellPerPlus: [0, 1000],
} as const satisfies Record<string, readonly [number, number]>;

/** The code's numbers (owner 2026-11-06 / 2026-11-08 / 2026-11-10). */
export function codeForge(): ForgeConfig {
  return {
    rate: [100, 100, 100, 100, 100, 40, 40, 40, 20, 20, 10, 15, 10, 5, 2.5, 1],
    costMult: [0, 1, 2, 3, 4, 5, 7, 9, 12, 15, 20, 30, 40, 55, 75, 100],
    bonusStep: [0, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 10, 10, 10, 10, 10],
    costBase: 15,
    costPerLevel: 6,
    pity: 1,
    dropFrom: 7,
    stoneFrom: 11,
    stonesPerTry: 1,
    announceFrom: 10,
    maxPlus: PLUS_CAP,
    cd: 1,
    orbMin: 7,
    aura: [7, 10, 13, 15],
    sellPerPlus: 50,
    hiddenFrom: 11,
  };
}
const CODE = codeForge();

const TABLES = ['rate', 'costMult', 'bonusStep'] as const;
type TableKey = (typeof TABLES)[number];
const NUMS = ['costBase', 'costPerLevel', 'pity', 'dropFrom', 'stoneFrom', 'stonesPerTry', 'announceFrom', 'maxPlus', 'cd', 'orbMin', 'sellPerPlus', 'hiddenFrom'] as const;
type NumKey = (typeof NUMS)[number];

export function mergeForge(t: ForgeTuning | undefined): ForgeConfig {
  const c = codeForge();
  if (!t) return c;
  for (const k of TABLES) {
    const m = t[k];
    if (m) for (const [lv, v] of Object.entries(m)) if (v !== undefined) c[k][Number(lv)] = v;
  }
  for (const k of NUMS) if (t[k] !== undefined) c[k] = t[k]!;
  if (t.aura) c.aura = [...t.aura];
  return c;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

const TABLE_NAME: Record<TableKey, string> = { rate: 'โอกาสสำเร็จ %', costMult: 'ตัวคูณราคา', bonusStep: 'โบนัสสเตตัส % ที่ได้เพิ่ม' };
/** Name, range, decimals (0 = whole number). */
const NUM_SPEC: Record<NumKey, [string, readonly [number, number], number]> = {
  costBase: ['ราคาพื้นฐาน', FORGE_RANGE.costBase, 0],
  costPerLevel: ['ราคาเพิ่มต่อเลเวลไอเทม', FORGE_RANGE.costPerLevel, 3],
  pity: ['pity ต่อครั้งที่ล้ม %', FORGE_RANGE.pity, 2],
  dropFrom: ['ระดับเริ่มตกเมื่อล้ม', FORGE_RANGE.from, 0],
  stoneFrom: ['ระดับเริ่มใช้หินตีบวก', FORGE_RANGE.from, 0],
  stonesPerTry: ['หินตีบวกต่อครั้ง', FORGE_RANGE.stonesPerTry, 0],
  announceFrom: ['ระดับเริ่มประกาศทั้งเซิร์ฟ', FORGE_RANGE.from, 0],
  maxPlus: ['ระดับตีบวกสูงสุด', FORGE_RANGE.maxPlus, 0],
  cd: ['คูลดาวน์ช่างตีเหล็ก (วินาที)', FORGE_RANGE.cd, 2],
  orbMin: ['ระดับเริ่มมีลูกแก้ว', FORGE_RANGE.from, 0],
  sellPerPlus: ['ราคาขายเพิ่มต่อระดับ %', FORGE_RANGE.sellPerPlus, 2],
  hiddenFrom: ['ระดับเริ่มซ่อนโอกาส (??)', FORGE_RANGE.from, 0],
};
const TABLE_DEC: Record<TableKey, number> = { rate: 2, costMult: 3, bonusStep: 3 };

/**
 * Checks the `forge` part of a balance tuning (see checkBalance): strict = errors for anything wrong, else wrong
 * entries are dropped. Values equal to the code are left out. Returns the clean tuning (undefined = nothing differs).
 */
export function checkForgeTuning(x: unknown, strict: boolean): { tuning: ForgeTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าตีบวกไม่ถูกต้อง' } : { tuning: undefined };
  const known = [...TABLES, ...NUMS, 'aura'] as string[];
  if (strict) {
    const extra = Object.keys(x).find((k) => !known.includes(k));
    if (extra) return { error: `ตีบวก: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: ForgeTuning = {};
  for (const k of TABLES) {
    let m = x[k];
    if (m === undefined) continue;
    // The /admin page sends the whole draft, where each table is an array (index = level, 0 unused).
    if (Array.isArray(m) && m.length === PLUS_CAP + 1) m = Object.fromEntries(m.slice(1).map((v, i) => [String(i + 1), v]));
    if (!isObj(m)) {
      if (strict) return { error: `ตีบวก: ${TABLE_NAME[k]} ไม่ถูกต้อง` };
      continue;
    }
    const [lo, hi] = FORGE_RANGE[k];
    const res: Levels = {};
    for (const [lv, v] of Object.entries(m)) {
      const n = Number(lv);
      if (!/^\d+$/.test(lv) || n < 1 || n > PLUS_CAP) {
        if (strict) return { error: `ตีบวก: ${TABLE_NAME[k]} ไม่รู้จักระดับ "${lv.slice(0, 10)}"` };
        continue;
      }
      if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
        if (strict) return { error: `ตีบวก: ${TABLE_NAME[k]} ของ +${n} ต้องอยู่ระหว่าง ${lo}–${hi}` };
        continue;
      }
      const r = round(v, TABLE_DEC[k]);
      if (r !== CODE[k][n]) res[String(n)] = r;
    }
    // Fixed key order (1..15) so two equal tunings give the same JSON.
    const keys = Object.keys(res).map(Number).sort((a, b) => a - b);
    if (keys.length) out[k] = Object.fromEntries(keys.map((n) => [String(n), res[String(n)]]));
  }
  for (const k of NUMS) {
    const v = x[k];
    if (v === undefined) continue;
    const [name, [lo, hi], dec] = NUM_SPEC[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || (dec === 0 && !Number.isInteger(v))) {
      if (strict) return { error: `ตีบวก: ${name} ต้องเป็น${dec === 0 ? 'จำนวนเต็ม' : 'ตัวเลข'}ระหว่าง ${lo}–${hi}` };
      continue;
    }
    const r = round(v, dec);
    if (r !== CODE[k]) out[k] = r;
  }
  if (x.aura !== undefined) {
    const a = x.aura;
    const [lo, hi] = FORGE_RANGE.from;
    const okArr = Array.isArray(a) && a.length === CODE.aura.length
      && a.every((n, i) => typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi && (i === 0 || n >= (a[i - 1] as number)));
    if (!okArr) {
      if (strict) return { error: `ตีบวก: ระดับเริ่มออร่า 4 ขั้นต้องเป็นจำนวนเต็ม ${lo}–${hi} เรียงจากน้อยไปมาก` };
    } else if ((a as number[]).some((n, i) => n !== CODE.aura[i])) out.aura = [...(a as number[])];
  }
  // Keys in a fixed order.
  const ordered: ForgeTuning = {};
  for (const k of [...TABLES, ...NUMS, 'aura'] as (keyof ForgeTuning)[]) if (out[k] !== undefined) (ordered as Record<string, unknown>)[k] = out[k];
  return { tuning: Object.keys(ordered).length ? ordered : undefined };
}

const lvText = (n: number) => (n >= PLUS_NEVER ? 'ไม่มี' : `+${n}`);

/** Audit lines of what differs between two configs. */
export function forgeChanges(a: ForgeConfig, b: ForgeConfig): string[] {
  const out: string[] = [];
  for (const k of TABLES) {
    for (let n = 1; n <= PLUS_CAP; n++) {
      if (a[k][n] !== b[k][n]) out.push(`ตีบวก ${TABLE_NAME[k]} +${n} ${a[k][n]} → ${b[k][n]}`);
    }
  }
  for (const k of NUMS) {
    if (a[k] === b[k]) continue;
    const name = NUM_SPEC[k][0];
    const lv = k === 'dropFrom' || k === 'stoneFrom' || k === 'announceFrom' || k === 'orbMin' || k === 'hiddenFrom' || k === 'maxPlus';
    out.push(`ตีบวก ${name} ${lv ? lvText(a[k]) : a[k]} → ${lv ? lvText(b[k]) : b[k]}`);
  }
  if (a.aura.join() !== b.aura.join()) out.push(`ตีบวก ระดับเริ่มออร่า ${a.aura.map(lvText).join('/')} → ${b.aura.map(lvText).join('/')}`);
  return out;
}
