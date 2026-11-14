// Skill system numbers the owner (and GMs, if allowed) tune on the /admin "ปรับสมดุล" tab (owner 2026-11-14):
// skill points per level, the last level that gives one, the max rank, unlock levels, the point refund price,
// and every learnable skill's damage, MP, cooldown and growth per rank. Saved inside the balance tuning
// (`BalanceTuning.skills`), only what differs from the code.
import {
  CD_PER_RANK, DMG_PER_RANK, KIND_NAME, LEARN_KINDS, LEARNABLE_SKILLS, MP_PER_RANK, STATUS_PER_RANK, type LearnKind,
} from './data/classes';
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

export interface SkillConfig {
  /** Skill points given per level, up to `lastPointLevel` (owner: 1 a level up to Lv.40). */
  pointsPerLevel: number;
  lastPointLevel: number;
  /** Highest rank of every learnable skill (owner: 10, passives too). */
  maxRank: number;
  /** Level each tier unlocks at, per kind (owner: normal 1/3/6/9/12/16/20/25, ultimate 5/10, passive 10/20/30). */
  unlock: Record<LearnKind, number[]>;
  /** Taking points back is free while the character has earned fewer points than this (owner: free up to 20). */
  freeRefundBelow: number;
  /** Gold per point taken back after that (owner: 1,000 G). */
  refundCost: number;
  /** Per learnable skill id. */
  skills: Record<string, SkillValues>;
}

/** What is saved: only what differs from the code. Unlock lists are saved whole when any entry differs. */
export interface SkillTuning {
  pointsPerLevel?: number;
  lastPointLevel?: number;
  maxRank?: number;
  unlock?: Partial<Record<LearnKind, number[]>>;
  freeRefundBelow?: number;
  refundCost?: number;
  skills?: Record<string, SkillValuesTuning>;
}
/** One skill's saved differences. */
export type SkillValuesTuning = Partial<Record<SkillNum, number>> & { params?: Record<string, number> };

export const SKILL_RANGE = {
  pointsPerLevel: [0, 10],
  lastPointLevel: [1, MAX_LEVEL],
  maxRank: [1, 20],
  freeRefundBelow: [0, 1000],
  refundCost: [0, 100_000_000],
} as const satisfies Record<string, readonly [number, number]>;
export const SKILL_NUM_NAME: Record<keyof typeof SKILL_RANGE, string> = {
  pointsPerLevel: 'แต้มสกิลต่อเลเวล',
  lastPointLevel: 'ได้แต้มสกิลถึงเลเวล',
  maxRank: 'แรงก์สูงสุด',
  freeRefundBelow: 'คืนแต้มฟรีเมื่อแต้มรวมน้อยกว่า',
  refundCost: 'ค่าคืนแต้ม (G ต่อแต้ม)',
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
  return {
    pointsPerLevel: 1,
    lastPointLevel: 40,
    maxRank: 10,
    unlock: { normal: [1, 3, 6, 9, 12, 16, 20, 25], ult: [5, 10], passive: [10, 20, 30] },
    freeRefundBelow: 21,
    refundCost: 1000,
    skills,
  };
}
const CODE = codeSkills();

export function mergeSkills(t: SkillTuning | undefined): SkillConfig {
  const c = codeSkills();
  if (!t) return c;
  for (const k of NUMS) if (t[k] !== undefined) c[k] = t[k]!;
  for (const k of LEARN_KINDS) if (t.unlock?.[k]) c.unlock[k] = [...t.unlock[k]!];
  for (const [id, v] of Object.entries(t.skills ?? {})) {
    const one = c.skills[id];
    if (!one) continue;
    const { params, ...nums } = v;
    Object.assign(one, nums);
    Object.assign(one.params, params);
  }
  return c;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const whole = new Set<string>(['pointsPerLevel', 'lastPointLevel', 'maxRank', 'freeRefundBelow', 'refundCost']);
const skillName = (id: string): string => LEARNABLE_SKILLS.find((x) => x.sk.id === id)?.sk.nameTh ?? id;
const skillDef = (id: string) => LEARNABLE_SKILLS.find((x) => x.sk.id === id)?.sk;

/**
 * Checks the `skills` part of a balance tuning (see checkBalance): strict = errors for anything wrong,
 * else wrong entries are dropped. Values equal to the code are left out. Returns the clean tuning
 * (undefined = nothing differs) or a Thai error.
 */
export function checkSkillTuning(x: unknown, strict: boolean): { tuning: SkillTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าสกิลไม่ถูกต้อง' } : { tuning: undefined };
  const TOP = [...NUMS, 'unlock', 'skills'];
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
        for (const k of SKILL_VALUE_KEYS) {
          const v = g[k];
          if (v === undefined) continue;
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
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two skill configs. */
export function skillChanges(a: SkillConfig, b: SkillConfig): string[] {
  const out: string[] = [];
  for (const k of NUMS) if (a[k] !== b[k]) out.push(`${SKILL_NUM_NAME[k]} ${a[k]} → ${b[k]}`);
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
  return out;
}
