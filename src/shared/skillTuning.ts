// Skill system numbers the owner (and GMs, if allowed) tune on the /admin "ปรับสมดุล" tab (owner 2026-11-14):
// skill points per level, the last level that gives one, the max rank, unlock levels, the point refund price,
// and every learnable skill's damage, MP, cooldown and growth per rank. Saved inside the balance tuning
// (`BalanceTuning.skills`), only what differs from the code.
import {
  CD_PER_RANK, CLASSES, CLASS_IDS, DMG_PER_RANK, KIND_NAME, LEARN_KINDS, LEARNABLE_SKILLS, MP_PER_RANK, STATUS_PER_RANK, type LearnKind, type SkillDef,
} from './data/classes';
import type { ClassId } from './types';
import { MAX_LEVEL } from './formulas';
import { reachRadius, SKILL_REACH } from './data/skillRanges';

/** One learnable skill's numbers. Growth is in % per rank above 1 (negative = less). */
export interface SkillValues {
  /** Damage multiplier (× ATK) of each hit at rank 1. */
  dmg: number;
  dmgPerRank: number;
  /** MP at rank 1 and Lv.1 (the class's MP % per level comes on top, see skillMpCost). */
  mp: number;
  mpPerRank: number;
  /** Cooldown in seconds at rank 1. */
  cooldown: number;
  cdPerRank: number;
  /** Status times (stun, slow, armor break, guard, lifesteal): % per rank. */
  statusPerRank: number;
  /** How far it reaches in metres: its range, or its radius for a skill around the player (see SKILL_REACH). */
  reach: number;
  /** The skill's own numbers (SkillDef.params): stun seconds, slow %, shots... */
  params: Record<string, number>;
}
/** The plain numbers of SkillValues (params are checked against each skill's own list). */
export type SkillNum = Exclude<keyof SkillValues, 'params'>;
export const SKILL_VALUE_KEYS: readonly SkillNum[] = ['dmg', 'dmgPerRank', 'mp', 'mpPerRank', 'cooldown', 'cdPerRank', 'statusPerRank', 'reach'];
export const SKILL_VALUE_NAME: Record<SkillNum, string> = {
  dmg: 'ดาเมจ ×ATK', dmgPerRank: 'ดาเมจ %/แรงก์', mp: 'MP', mpPerRank: 'MP %/แรงก์', cooldown: 'คูลดาวน์ วิ', cdPerRank: 'คูลดาวน์ %/แรงก์', statusPerRank: 'เวลาสถานะ/ผลพาสซีฟ %/แรงก์', reach: 'ระยะ/รัศมี ม.',
};
export const SKILL_VALUE_RANGE: Record<SkillNum, readonly [number, number]> = {
  dmg: [0, 100], dmgPerRank: [-50, 200], mp: [0, 10000], mpPerRank: [-50, 200], cooldown: [0, 600], cdPerRank: [-20, 50], statusPerRank: [-50, 200], reach: [0.5, 40],
};

// ------------------------------------------------------------ extra effects (owner 2026-11-20)
/**
 * Effects the owner adds to any damaging skill or basic attack on the /admin "ระบบสกิล" tab, on top of what the skill
 * does in code: every hit of that skill (each tick, each bullet, its summons) gives them, to normal monsters, bosses or
 * both. Applied in Sim.hitMonster (sim/extraEffects.ts). Flat numbers: they do not grow with the skill's rank.
 */
export type ExtraKind = 'stun' | 'slow' | 'dot' | 'armor' | 'weak' | 'kb';
/** Who it works on: every monster, normal monsters only (boss minions count as normal), or bosses only. */
export type ExtraTarget = 'all' | 'mob' | 'boss';
/** `v` = the strength (seconds, %, × ATK a second, metres), `t` = seconds it lasts (0 for stun and knockback). */
export interface ExtraEffect { k: ExtraKind; to: ExtraTarget; v: number; t: number }
export const EXTRA_KINDS: readonly ExtraKind[] = ['stun', 'slow', 'dot', 'armor', 'weak', 'kb'];
export const EXTRA_TARGETS: readonly ExtraTarget[] = ['mob', 'boss', 'all'];
export const EXTRA_TARGET_NAME: Record<ExtraTarget, string> = { all: 'ทั้งคู่', mob: 'มอนธรรมดาเท่านั้น', boss: 'บอสเท่านั้น' };
/** Most extra effects one skill can carry. */
export const MAX_EXTRAS = 4;
export interface ExtraNum { nameTh: string; unit: string; lo: number; hi: number; def: number; step: number }
/** Each kind: its Thai name, its strength box and (when it lasts) its time box, with the ranges /admin allows. */
export const EXTRA_DEF: Record<ExtraKind, { nameTh: string; v: ExtraNum; t?: ExtraNum }> = {
  stun: { nameTh: 'สตัน', v: { nameTh: 'เวลาสตัน', unit: 'วิ', lo: 0, hi: 5, def: 0.5, step: 0.1 } },
  slow: {
    nameTh: 'ทำให้ช้า',
    v: { nameTh: 'ช้าลง', unit: '%', lo: 0, hi: 90, def: 30, step: 5 },
    t: { nameTh: 'นาน', unit: 'วิ', lo: 0, hi: 15, def: 2, step: 0.5 },
  },
  dot: {
    nameTh: 'ไฟ/พิษ (ดาเมจต่อเนื่อง)',
    v: { nameTh: 'ดาเมจต่อวิ', unit: '×ATK', lo: 0, hi: 10, def: 0.3, step: 0.05 },
    t: { nameTh: 'นาน', unit: 'วิ', lo: 1, hi: 15, def: 3, step: 1 },
  },
  armor: {
    nameTh: 'ลดเกราะ',
    v: { nameTh: 'ลดเกราะ', unit: '%', lo: 0, hi: 90, def: 20, step: 5 },
    t: { nameTh: 'นาน', unit: 'วิ', lo: 0, hi: 15, def: 3, step: 0.5 },
  },
  weak: {
    nameTh: 'ลดพลังโจมตี',
    v: { nameTh: 'ลดพลังโจมตี', unit: '%', lo: 0, hi: 90, def: 20, step: 5 },
    t: { nameTh: 'นาน', unit: 'วิ', lo: 0, hi: 15, def: 3, step: 0.5 },
  },
  kb: { nameTh: 'ผลักกระเด็น', v: { nameTh: 'ระยะผลัก', unit: 'ม.', lo: 0, hi: 10, def: 2, step: 0.5 } },
};

/** A new effect of this kind with its suggested numbers (the /admin add button). */
export function newExtra(k: ExtraKind, to: ExtraTarget = 'mob'): ExtraEffect {
  const d = EXTRA_DEF[k];
  return { k, to, v: d.v.def, t: d.t?.def ?? 0 };
}

/** Thai line of one extra effect for players and the audit, e.g. "สตัน 0.5 วิ (มอนธรรมดา)". */
export function extraText(e: ExtraEffect): string {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const who = e.to === 'mob' ? ' (มอนธรรมดา)' : e.to === 'boss' ? ' (บอส)' : '';
  switch (e.k) {
    case 'stun': return `สตัน ${r2(e.v)} วิ${who}`;
    case 'slow': return `ช้าลง ${r2(e.v)}% ${r2(e.t)} วิ${who}`;
    case 'dot': return `ไฟ/พิษ ${Math.round(e.v * 100)}% ATK ต่อวิ ${r2(e.t)} วิ${who}`;
    case 'armor': return `ลดเกราะ ${r2(e.v)}% ${r2(e.t)} วิ${who}`;
    case 'weak': return `ลดพลังโจมตี ${r2(e.v)}% ${r2(e.t)} วิ${who}`;
    case 'kb': return `ผลักกระเด็น ${r2(e.v)} ม.${who}`;
  }
}

/** Every class's basic attack (tuned on the same tab: damage, reach, attacks a second, extra effects). */
export const BASIC_SKILLS: readonly { cls: ClassId; sk: SkillDef }[] = CLASS_IDS.map((cls) => ({ cls, sk: CLASSES[cls].skills.find((s) => s.kind === 'basic')! }));
/** The only SkillValues a basic attack takes (the rest stays at the code value). */
export const BASIC_VALUE_KEYS: readonly SkillNum[] = ['dmg', 'reach'];
export const BASIC_RATE_RANGE = [0.2, 10] as const;
export const isBasicId = (id: string): boolean => BASIC_SKILLS.some((b) => b.sk.id === id);

export interface SkillConfig {
  /** Skill points given per level, up to `lastPointLevel` (owner: 1 a level up to Lv.40). */
  pointsPerLevel: number;
  lastPointLevel: number;
  /** Highest rank of every learnable skill (owner: 10, passives too). */
  maxRank: number;
  /** Level each tier unlocks at, per kind (owner: normal 1/3/6/9/12/16/20/25, ultimate 5/10, passive 10/20/30). */
  unlock: Record<LearnKind, number[]>;
  /** Taking points back is free while the character has earned fewer points than this (owner: free up to Lv.31, 2026-11-17; was up to 20). */
  freeRefundBelow: number;
  /** Gold per point taken back after that (owner: 1,000 G). */
  refundCost: number;
  /** The skill map can be zoomed and panned (owner 2026-11-19). Off = the fixed fit-to-window map. */
  mapZoom: boolean;
  /** Zoom limits of the skill map in % of the fit-to-window size (100 = the size it opens at). */
  zoomMin: number;
  zoomMax: number;
  /** Land Mine charges (owner 2026-11-19): at most `mineMax` stacks, stack N is gained at rank `mineRanks[N-1]`. */
  mineMax: number;
  mineRanks: number[];
  /** Seconds between two mines laid back to back. */
  mineGap: number;
  /** Laying a mine does not hold the player still (the attack-root stop skips it). */
  mineNoRoot: boolean;
  /** Per learnable skill id, and each class's basic attack (only its dmg and reach mean anything). */
  skills: Record<string, SkillValues>;
  /** Basic attacks a second per class, before the attack speed stat (code: ClassDef.attackRate). */
  basicRate: Record<ClassId, number>;
  /**
   * An extra stun stuns the same monster again (from the same skill) only this many seconds after the last one began,
   * so a skill that hits many times (ticks, waves) cannot keep a monster stunned (owner 2026-11-20, code 2 s).
   */
  extraStunGap: number;
  /** Extra effects per skill id (learnable or basic); none in code. */
  effects: Record<string, ExtraEffect[]>;
}

/** What is saved: only what differs from the code. Unlock lists are saved whole when any entry differs. */
export interface SkillTuning {
  pointsPerLevel?: number;
  lastPointLevel?: number;
  maxRank?: number;
  unlock?: Partial<Record<LearnKind, number[]>>;
  freeRefundBelow?: number;
  refundCost?: number;
  mapZoom?: boolean;
  zoomMin?: number;
  zoomMax?: number;
  mineMax?: number;
  mineRanks?: number[];
  mineGap?: number;
  mineNoRoot?: boolean;
  extraStunGap?: number;
  skills?: Record<string, SkillValuesTuning>;
  basicRate?: Partial<Record<ClassId, number>>;
  /** Saved whole per skill (a skill with none is left out). */
  effects?: Record<string, ExtraEffect[]>;
}
/** One skill's saved differences. */
export type SkillValuesTuning = Partial<Record<SkillNum, number>> & { params?: Record<string, number> };

/** How many stacks the Land Mine can be set up to hold. */
export const MINE_RANK_SLOTS = 5;
/** Skills that keep charges instead of one cooldown (the browser and Sim treat them the same way). */
export const CHARGE_SKILLS: ReadonlySet<string> = new Set(['gs_mine']);

export const SKILL_RANGE = {
  pointsPerLevel: [0, 10],
  lastPointLevel: [1, MAX_LEVEL],
  maxRank: [1, 20],
  freeRefundBelow: [0, 1000],
  refundCost: [0, 100_000_000],
  zoomMin: [20, 100],
  zoomMax: [100, 500],
  mineMax: [1, MINE_RANK_SLOTS],
  mineGap: [0, 10],
  extraStunGap: [0, 30],
} as const satisfies Record<string, readonly [number, number]>;
export const SKILL_NUM_NAME: Record<keyof typeof SKILL_RANGE, string> = {
  pointsPerLevel: 'แต้มสกิลต่อเลเวล',
  lastPointLevel: 'ได้แต้มสกิลถึงเลเวล',
  maxRank: 'แรงก์สูงสุด',
  freeRefundBelow: 'คืนแต้มฟรีเมื่อแต้มรวมน้อยกว่า',
  refundCost: 'ค่าคืนแต้ม (G ต่อแต้ม)',
  zoomMin: 'ซูมผังต่ำสุด (%)',
  zoomMax: 'ซูมผังสูงสุด (%)',
  mineMax: 'กับระเบิด: สแตคสูงสุด',
  mineGap: 'กับระเบิด: หน่วงวางติด (วิ)',
  extraStunGap: 'เอฟเฟกต์พิเศษ: สตันมอนตัวเดิมซ้ำได้ทุก (วิ)',
};
const NUMS = Object.keys(SKILL_RANGE) as (keyof typeof SKILL_RANGE)[];

/** How many tiers each kind has in a line (owner 2026-11-14: 8 normal and 2 ultimates per line, 3 passives a class). */
export const UNLOCK_TIERS: Record<LearnKind, number> = { normal: 8, ult: 2, passive: 3 };

/** The code's own skill numbers (a fresh copy). */
export function codeSkills(): SkillConfig {
  const skills: Record<string, SkillValues> = {};
  for (const { sk } of LEARNABLE_SKILLS) {
    const reach = SKILL_REACH[sk.id];
    skills[sk.id] = {
      dmg: sk.dmg, dmgPerRank: DMG_PER_RANK, mp: sk.mp, mpPerRank: MP_PER_RANK, cooldown: sk.cooldown, cdPerRank: CD_PER_RANK, statusPerRank: STATUS_PER_RANK,
      reach: reach ? reachRadius(reach) : 0,
      params: Object.fromEntries(Object.entries(sk.params ?? {}).map(([k, v]) => [k, v.v])),
    };
  }
  // Basic attacks: damage and reach only, no MP, cooldown or growth per rank.
  for (const { sk } of BASIC_SKILLS) {
    const reach = SKILL_REACH[sk.id];
    skills[sk.id] = { dmg: sk.dmg, dmgPerRank: 0, mp: 0, mpPerRank: 0, cooldown: 0, cdPerRank: 0, statusPerRank: 0, reach: reach ? reachRadius(reach) : 0, params: {} };
  }
  return {
    pointsPerLevel: 1,
    lastPointLevel: 40,
    maxRank: 10,
    unlock: { normal: [1, 3, 6, 9, 12, 16, 20, 25], ult: [5, 10], passive: [10, 20, 30] },
    freeRefundBelow: 32,
    refundCost: 1000,
    mapZoom: true,
    zoomMin: 50,
    zoomMax: 250,
    mineMax: 3,
    mineRanks: [1, 5, 10, 10, 10],
    mineGap: 0.3,
    mineNoRoot: true,
    skills,
    basicRate: Object.fromEntries(CLASS_IDS.map((c) => [c, CLASSES[c].attackRate])) as Record<ClassId, number>,
    extraStunGap: 2,
    effects: {},
  };
}
const CODE = codeSkills();

/**
 * Stacks a charge skill holds at this rank (0 = not a charge skill, or rank 0): stack N counts once the rank reaches
 * `mineRanks[N-1]`, up to `mineMax`. Owner 2026-11-19: rank 1 = 1, rank 5 = 2, rank 10 = 3.
 */
export function chargeMax(cfg: SkillConfig, skillId: string, rank: number): number {
  if (!CHARGE_SKILLS.has(skillId) || rank < 1) return 0;
  let n = 0;
  for (let i = 0; i < Math.min(cfg.mineMax, cfg.mineRanks.length); i++) if (rank >= cfg.mineRanks[i]) n++;
  return Math.max(1, n);
}

/** True when this skill must not hold the player still on cast (Land Mine with its switch on). */
export function skipsAttackRoot(cfg: SkillConfig, skillId: string): boolean {
  return skillId === 'gs_mine' && cfg.mineNoRoot;
}

export function mergeSkills(t: SkillTuning | undefined): SkillConfig {
  const c = codeSkills();
  if (!t) return c;
  for (const k of NUMS) if (t[k] !== undefined) c[k] = t[k]!;
  if (typeof t.mapZoom === 'boolean') c.mapZoom = t.mapZoom;
  if (typeof t.mineNoRoot === 'boolean') c.mineNoRoot = t.mineNoRoot;
  if (t.mineRanks) c.mineRanks = [...t.mineRanks];
  for (const k of LEARN_KINDS) if (t.unlock?.[k]) c.unlock[k] = [...t.unlock[k]!];
  for (const [id, v] of Object.entries(t.skills ?? {})) {
    const one = c.skills[id];
    if (!one) continue;
    const { params, ...nums } = v;
    Object.assign(one, nums);
    Object.assign(one.params, params);
  }
  for (const id of CLASS_IDS) if (t.basicRate?.[id] !== undefined) c.basicRate[id] = t.basicRate[id]!;
  // A copy: the /admin page edits its draft in place.
  for (const [id, list] of Object.entries(t.effects ?? {})) if (c.skills[id]) c.effects[id] = list.map((e) => ({ ...e }));
  return c;
}

/** The extra effects of a skill (none = an empty list). */
export function skillExtras(cfg: SkillConfig, id: string): readonly ExtraEffect[] {
  return cfg.effects[id] ?? [];
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const whole = new Set<string>(['pointsPerLevel', 'lastPointLevel', 'maxRank', 'freeRefundBelow', 'refundCost', 'zoomMin', 'zoomMax', 'mineMax']);
const skillName = (id: string): string => {
  const b = BASIC_SKILLS.find((x) => x.sk.id === id);
  if (b) return `${b.sk.nameTh} (ตีธรรมดา${CLASSES[b.cls].nameTh})`;
  return LEARNABLE_SKILLS.find((x) => x.sk.id === id)?.sk.nameTh ?? id;
};
const skillDef = (id: string) => LEARNABLE_SKILLS.find((x) => x.sk.id === id)?.sk ?? BASIC_SKILLS.find((x) => x.sk.id === id)?.sk;

/** Checks one skill's extra effect list: the clean list, or a Thai error (strict) / null (dropped). */
function checkExtras(id: string, v: unknown, strict: boolean): ExtraEffect[] | string | null {
  const name = skillName(id);
  if (!Array.isArray(v) || v.length > MAX_EXTRAS) return strict ? `สกิล ${name}: เอฟเฟกต์พิเศษได้ไม่เกิน ${MAX_EXTRAS} อัน` : null;
  const inRange = (n: unknown, r: ExtraNum): n is number => typeof n === 'number' && Number.isFinite(n) && n >= r.lo && n <= r.hi;
  const out: ExtraEffect[] = [];
  for (const e of v) {
    if (!isObj(e) || typeof e.k !== 'string' || !(EXTRA_KINDS as readonly string[]).includes(e.k)) {
      if (strict) return `สกิล ${name}: ไม่รู้จักชนิดเอฟเฟกต์พิเศษ`;
      continue;
    }
    const k = e.k as ExtraKind;
    const d = EXTRA_DEF[k];
    if (typeof e.to !== 'string' || !(EXTRA_TARGETS as readonly string[]).includes(e.to)) {
      if (strict) return `สกิล ${name} ${d.nameTh}: เป้าหมายไม่ถูกต้อง`;
      continue;
    }
    if (!inRange(e.v, d.v)) {
      if (strict) return `สกิล ${name} ${d.nameTh}: ${d.v.nameTh} ต้องอยู่ระหว่าง ${d.v.lo} ถึง ${d.v.hi} ${d.v.unit}`;
      continue;
    }
    if (d.t && !inRange(e.t, d.t)) {
      if (strict) return `สกิล ${name} ${d.nameTh}: เวลาต้องอยู่ระหว่าง ${d.t.lo} ถึง ${d.t.hi} วิ`;
      continue;
    }
    out.push({ k, to: e.to as ExtraTarget, v: round3(e.v), t: d.t ? round3(e.t as number) : 0 });
  }
  return out;
}

/**
 * Checks the `skills` part of a balance tuning (see checkBalance): strict = errors for anything wrong,
 * else wrong entries are dropped. Values equal to the code are left out. Returns the clean tuning
 * (undefined = nothing differs) or a Thai error.
 */
export function checkSkillTuning(x: unknown, strict: boolean): { tuning: SkillTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าสกิลไม่ถูกต้อง' } : { tuning: undefined };
  const TOP = [...NUMS, 'mapZoom', 'mineNoRoot', 'mineRanks', 'unlock', 'skills', 'basicRate', 'effects'];
  if (strict) {
    const extra = Object.keys(x).find((k) => !TOP.includes(k));
    if (extra) return { error: `สกิล: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: SkillTuning = {};
  for (const k of NUMS) {
    const v = x[k];
    if (v === undefined) continue;
    const [lo, hi] = SKILL_RANGE[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || (whole.has(k) && !Number.isInteger(v))) {
      if (strict) return { error: `${SKILL_NUM_NAME[k]} ต้องเป็นจำนวนเต็ม ${lo} ถึง ${hi}` };
      continue;
    }
    if (v !== CODE[k]) out[k] = v;
  }
  if (x.mapZoom !== undefined) {
    if (typeof x.mapZoom !== 'boolean') {
      if (strict) return { error: 'สวิตช์ซูมผังสกิลไม่ถูกต้อง' };
    } else if (x.mapZoom !== CODE.mapZoom) out.mapZoom = x.mapZoom;
  }
  if (x.mineNoRoot !== undefined) {
    if (typeof x.mineNoRoot !== 'boolean') {
      if (strict) return { error: 'สวิตช์กับระเบิดวางไม่ชะงักไม่ถูกต้อง' };
    } else if (x.mineNoRoot !== CODE.mineNoRoot) out.mineNoRoot = x.mineNoRoot;
  }
  if (x.mineRanks !== undefined) {
    const v = x.mineRanks;
    const ok = Array.isArray(v) && v.length === MINE_RANK_SLOTS &&
      v.every((n, i) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 20 && (i === 0 || n >= (v[i - 1] as number)));
    if (!ok) {
      if (strict) return { error: `กับระเบิด: แรงก์ที่ได้สแตคต้องเป็น ${MINE_RANK_SLOTS} ค่า 1–20 เรียงจากน้อยไปมาก` };
    } else if ((v as number[]).join() !== CODE.mineRanks.join()) out.mineRanks = [...(v as number[])];
  }
  if (x.unlock !== undefined) {
    if (!isObj(x.unlock)) {
      if (strict) return { error: 'เลเวลปลดล็อกสกิลไม่ถูกต้อง' };
    } else {
      const u: Partial<Record<LearnKind, number[]>> = {};
      if (strict) {
        const extra = Object.keys(x.unlock).find((k) => !(LEARN_KINDS as readonly string[]).includes(k));
        if (extra) return { error: `เลเวลปลดล็อก: ไม่รู้จัก "${extra.slice(0, 20)}"` };
      }
      for (const k of LEARN_KINDS) {
        const v = x.unlock[k];
        if (v === undefined) continue;
        const ok = Array.isArray(v) && v.length === UNLOCK_TIERS[k] &&
          v.every((n, i) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_LEVEL && (i === 0 || n >= (v[i - 1] as number)));
        if (!ok) {
          if (strict) return { error: `เลเวลปลดล็อก${KIND_NAME[k]}ต้องเป็น ${UNLOCK_TIERS[k]} ค่า 1–${MAX_LEVEL} เรียงจากน้อยไปมาก` };
          continue;
        }
        if ((v as number[]).join() !== CODE.unlock[k].join()) u[k] = [...(v as number[])];
      }
      if (Object.keys(u).length) out.unlock = u;
    }
  }
  if (x.skills !== undefined) {
    if (!isObj(x.skills)) {
      if (strict) return { error: 'ค่ารายสกิลไม่ถูกต้อง' };
    } else {
      const s: Record<string, SkillValuesTuning> = {};
      for (const [id, g] of Object.entries(x.skills)) {
        const code = CODE.skills[id];
        if (!code || !isObj(g)) {
          if (strict) return { error: `ไม่รู้จักสกิล "${id.slice(0, 20)}"` };
          continue;
        }
        if (strict) {
          const extra = Object.keys(g).find((k) => k !== 'params' && !(SKILL_VALUE_KEYS as readonly string[]).includes(k));
          if (extra) return { error: `สกิล ${skillName(id)}: ไม่รู้จัก "${extra.slice(0, 20)}"` };
        }
        const one: SkillValuesTuning = {};
        const basic = isBasicId(id);
        for (const k of SKILL_VALUE_KEYS) {
          const v = g[k];
          if (v === undefined) continue;
          // A basic attack takes only damage and reach (the rest may come along at the code value, e.g. a whole config).
          if (basic && !BASIC_VALUE_KEYS.includes(k)) {
            if (strict && v !== code[k]) return { error: `${skillName(id)}: ปรับได้แค่ดาเมจและระยะ` };
            continue;
          }
          // A skill with no reach (buffs, passives) keeps reach 0: nothing to tune.
          if (k === 'reach' && !SKILL_REACH[id]) continue;
          const [lo, hi] = SKILL_VALUE_RANGE[k];
          if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
            if (strict) return { error: `สกิล ${skillName(id)} ${SKILL_VALUE_NAME[k]} ต้องอยู่ระหว่าง ${lo} ถึง ${hi}` };
            continue;
          }
          const n = round3(v);
          if (n !== code[k]) one[k] = n;
        }
        if (g.params !== undefined) {
          const defs = skillDef(id)?.params ?? {};
          if (!isObj(g.params)) {
            if (strict) return { error: `สกิล ${skillName(id)}: ค่าพิเศษไม่ถูกต้อง` };
          } else {
            const ps: Record<string, number> = {};
            for (const [pk, pv] of Object.entries(g.params)) {
              const d = defs[pk];
              if (!d) {
                if (strict) return { error: `สกิล ${skillName(id)}: ไม่รู้จัก "${pk.slice(0, 20)}"` };
                continue;
              }
              if (typeof pv !== 'number' || !Number.isFinite(pv) || pv < d.lo || pv > d.hi) {
                if (strict) return { error: `สกิล ${skillName(id)} ${d.nameTh} ต้องอยู่ระหว่าง ${d.lo} ถึง ${d.hi}` };
                continue;
              }
              const n = round3(pv);
              if (n !== code.params[pk]) ps[pk] = n;
            }
            if (Object.keys(ps).length) one.params = ps;
          }
        }
        if (Object.keys(one).length) s[id] = one;
      }
      if (Object.keys(s).length) out.skills = s;
    }
  }
  if (x.basicRate !== undefined) {
    if (!isObj(x.basicRate)) {
      if (strict) return { error: 'ความเร็วตีธรรมดาไม่ถูกต้อง' };
    } else {
      const r: Partial<Record<ClassId, number>> = {};
      for (const [c, v] of Object.entries(x.basicRate)) {
        if (!(CLASS_IDS as string[]).includes(c)) {
          if (strict) return { error: `ความเร็วตีธรรมดา: ไม่รู้จักอาชีพ "${c.slice(0, 20)}"` };
          continue;
        }
        const [lo, hi] = BASIC_RATE_RANGE;
        if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
          if (strict) return { error: `ความเร็วตีธรรมดา${CLASSES[c as ClassId].nameTh} ต้องอยู่ระหว่าง ${lo} ถึง ${hi} ครั้ง/วิ` };
          continue;
        }
        const n = round3(v);
        if (n !== CODE.basicRate[c as ClassId]) r[c as ClassId] = n;
      }
      if (Object.keys(r).length) out.basicRate = r;
    }
  }
  if (x.effects !== undefined) {
    if (!isObj(x.effects)) {
      if (strict) return { error: 'เอฟเฟกต์พิเศษไม่ถูกต้อง' };
    } else {
      const fx: Record<string, ExtraEffect[]> = {};
      for (const [id, list] of Object.entries(x.effects)) {
        // Passives never hit: nothing to add to.
        if (!CODE.skills[id] || skillDef(id)?.kind === 'passive') {
          if (strict) return { error: `เอฟเฟกต์พิเศษ: ใส่ให้สกิล "${id.slice(0, 20)}" ไม่ได้` };
          continue;
        }
        const c = checkExtras(id, list, strict);
        if (typeof c === 'string') return { error: c };
        if (c?.length) fx[id] = c;
      }
      if (Object.keys(fx).length) out.effects = fx;
    }
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two skill configs. */
export function skillChanges(a: SkillConfig, b: SkillConfig): string[] {
  const out: string[] = [];
  for (const k of NUMS) if (a[k] !== b[k]) out.push(`${SKILL_NUM_NAME[k]} ${a[k]} → ${b[k]}`);
  if (a.mapZoom !== b.mapZoom) out.push(`ซูมผังสกิล ${a.mapZoom ? 'เปิด' : 'ปิด'} → ${b.mapZoom ? 'เปิด' : 'ปิด'}`);
  if (a.mineNoRoot !== b.mineNoRoot) out.push(`กับระเบิดวางไม่ชะงัก ${a.mineNoRoot ? 'เปิด' : 'ปิด'} → ${b.mineNoRoot ? 'เปิด' : 'ปิด'}`);
  if (a.mineRanks.join() !== b.mineRanks.join()) out.push(`กับระเบิดแรงก์ที่ได้สแตค ${a.mineRanks.join('/')} → ${b.mineRanks.join('/')}`);
  for (const k of LEARN_KINDS) {
    if (a.unlock[k].join() !== b.unlock[k].join()) out.push(`เลเวลปลดล็อก${KIND_NAME[k]} ${a.unlock[k].join('/')} → ${b.unlock[k].join('/')}`);
  }
  for (const id of Object.keys(a.skills)) {
    for (const k of SKILL_VALUE_KEYS) {
      if (a.skills[id][k] !== b.skills[id]?.[k]) out.push(`สกิล ${skillName(id)} ${SKILL_VALUE_NAME[k]} ${a.skills[id][k]} → ${b.skills[id]?.[k]}`);
    }
    for (const [pk, d] of Object.entries(skillDef(id)?.params ?? {})) {
      const x = a.skills[id].params[pk];
      const y = b.skills[id]?.params[pk];
      if (x !== y) out.push(`สกิล ${skillName(id)} ${d.nameTh} ${x} → ${y} ${d.unit}`);
    }
  }
  for (const c of CLASS_IDS) if (a.basicRate[c] !== b.basicRate[c]) out.push(`ความเร็วตีธรรมดา${CLASSES[c].nameTh} ${a.basicRate[c]} → ${b.basicRate[c]} ครั้ง/วิ`);
  const fxText = (l: readonly ExtraEffect[]) => (l.length ? l.map(extraText).join(', ') : 'ไม่มี');
  for (const id of new Set([...Object.keys(a.effects), ...Object.keys(b.effects)])) {
    const x = fxText(skillExtras(a, id));
    const y = fxText(skillExtras(b, id));
    if (x !== y) out.push(`สกิล ${skillName(id)} เอฟเฟกต์พิเศษ ${x} → ${y}`);
  }
  return out;
}
