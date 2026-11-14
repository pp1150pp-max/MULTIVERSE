// The skill system's rules (owner 2026-11-14), shared by the server's Sim, the HUD and the skill window:
// skill points (earned per level up to a set level), learning a skill = rank 1 for one point, one point per
// rank after that up to the max rank, unlock levels by kind and tier, taking points back (free early on, gold
// after), and what each rank does to damage, MP, cooldown and status times. Numbers come from the balance
// (skillTuning.ts) so the /admin page tunes them.
import { currentBalance, skillMpCost, type Balance } from './balance';
import {
  CLASSES, isLearnable, KIND_NAME, SLOT_KIND, WEAR_SLOTS, type LearnKind, type SkillDef, type WearSlot,
} from './data/classes';
import type { SkillConfig, SkillValues } from './skillTuning';
import { reachRadius, SKILL_REACH, type SkillReach } from './data/skillRanges';
import type { ClassId } from './types';

/** A character's learned ranks and worn skills, as saved (CharacterData.skills) and sent to its own browser. */
export interface SkillBook {
  /** Learnable skill id → rank (1 or more). Skills not learned are left out. */
  ranks: Record<string, number>;
  /** Skill worn in each slot: Q/E normal skills, R an ultimate, one passive. */
  worn: Partial<Record<WearSlot, string>>;
}

export const emptySkillBook = (): SkillBook => ({ ranks: {}, worn: {} });

const cfgOf = (b: Balance = currentBalance()): SkillConfig => b.skills;

/** A class's learnable skill by id. */
export function learnable(cls: ClassId, id: unknown): SkillDef | undefined {
  if (typeof id !== 'string') return undefined;
  const sk = CLASSES[cls].skills.find((s) => s.id === id);
  return sk && isLearnable(sk) ? sk : undefined;
}

/**
 * A skill book from a save or anywhere else, kept to this class: only its learnable skills, whole ranks from 1 up,
 * and worn skills that are learned, of the right kind for their slot and worn once. Old saves (no book) start empty
 * (owner 2026-11-14: everyone starts from zero; points come back from the level).
 */
export function cleanSkillBook(cls: ClassId, raw: unknown): SkillBook {
  const out = emptySkillBook();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as { ranks?: unknown; worn?: unknown };
  if (r.ranks && typeof r.ranks === 'object') {
    for (const [id, n] of Object.entries(r.ranks as Record<string, unknown>)) {
      if (learnable(cls, id) && typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 1000) out.ranks[id] = n;
    }
  }
  if (r.worn && typeof r.worn === 'object') {
    const used = new Set<string>();
    for (const slot of WEAR_SLOTS) {
      const id = (r.worn as Record<string, unknown>)[slot];
      const sk = learnable(cls, id);
      if (!sk || !out.ranks[sk.id] || sk.kind !== SLOT_KIND[slot] || used.has(sk.id)) continue;
      out.worn[slot] = sk.id;
      used.add(sk.id);
    }
  }
  return out;
}

/** Skill points a character of this level has earned in all. */
export function pointsEarned(level: number, b?: Balance): number {
  const c = cfgOf(b);
  return Math.max(0, Math.min(level, c.lastPointLevel)) * c.pointsPerLevel;
}

/** Points put into skills (every rank of every learned skill). */
export function pointsSpent(book: SkillBook): number {
  let n = 0;
  for (const r of Object.values(book.ranks)) n += r;
  return n;
}

/** Points left to spend (0 if the admin lowered the points below what was already spent). */
export function pointsLeft(level: number, book: SkillBook, b?: Balance): number {
  return Math.max(0, pointsEarned(level, b) - pointsSpent(book));
}

/** Level that unlocks this skill: by its kind and tier (a tier past the table takes the table's last level). */
export function unlockLevel(sk: SkillDef, b?: Balance): number {
  if (!isLearnable(sk)) return 1;
  const list = cfgOf(b).unlock[sk.kind as LearnKind];
  return list[Math.min(sk.tier ?? 0, list.length - 1)] ?? 1;
}

export const maxRank = (b?: Balance): number => cfgOf(b).maxRank;

/** The rank in use: what was learned, capped at the max rank in use (0 = not learned). */
export function rankOf(book: SkillBook, id: string, b?: Balance): number {
  return Math.min(book.ranks[id] ?? 0, cfgOf(b).maxRank);
}

/** Why this character can't learn this skill or its next rank now, or null if it can. */
export function learnBlock(cls: ClassId, level: number, book: SkillBook, id: string, b?: Balance): string | null {
  const sk = learnable(cls, id);
  if (!sk) return 'ไม่มีสกิลนี้';
  const need = unlockLevel(sk, b);
  if (level < need) return `ต้อง Lv.${need} ถึงจะเรียน${sk.nameTh}ได้`;
  if ((book.ranks[id] ?? 0) >= cfgOf(b).maxRank) return `${sk.nameTh} แรงก์เต็มแล้ว`;
  if (pointsLeft(level, book, b) <= 0) return 'แต้มสกิลไม่พอ';
  return null;
}

/** Gold to take one point back at this level: free while the character has earned few points (owner 2026-11-14). */
export function refundPrice(level: number, b?: Balance): number {
  const c = cfgOf(b);
  return pointsEarned(level, b) < c.freeRefundBelow ? 0 : c.refundCost;
}

/** Why a slot can't wear this skill, or null if it can (learned, and the slot's kind). `id` null = take it off. */
export function wearBlock(cls: ClassId, book: SkillBook, slot: WearSlot, id: string | null): string | null {
  if (id === null) return null;
  const sk = learnable(cls, id);
  if (!sk) return 'ไม่มีสกิลนี้';
  if (!book.ranks[id]) return `ยังไม่ได้เรียน${sk.nameTh}`;
  if (sk.kind !== SLOT_KIND[slot]) return `ช่องนี้ใส่ได้เฉพาะ${KIND_NAME[SLOT_KIND[slot]]}`;
  return null;
}

/** Puts `id` (or nothing) on `slot`; a skill worn elsewhere moves here (Q ↔ E swap their skills). */
export function wear(book: SkillBook, slot: WearSlot, id: string | null): void {
  const was = book.worn[slot];
  if (id !== null) {
    for (const s of WEAR_SLOTS) {
      if (s !== slot && book.worn[s] === id) {
        if (was) book.worn[s] = was;
        else delete book.worn[s];
      }
    }
    book.worn[slot] = id;
  } else delete book.worn[slot];
}

/** Takes one rank back; at rank 0 the skill is forgotten and taken off its slot. */
export function unlearnOne(book: SkillBook, id: string): void {
  const r = (book.ranks[id] ?? 0) - 1;
  if (r > 0) {
    book.ranks[id] = r;
    return;
  }
  delete book.ranks[id];
  for (const s of WEAR_SLOTS) if (book.worn[s] === id) delete book.worn[s];
}

// ------------------------------------------------------------ what a rank does

/** The skill's numbers in use (its code values if it has no entry, e.g. a basic attack). */
export function skillValues(sk: SkillDef, b?: Balance): SkillValues {
  const reach = SKILL_REACH[sk.id];
  return cfgOf(b).skills[sk.id] ?? {
    dmg: sk.dmg, dmgPerRank: 0, mp: sk.mp, mpPerRank: 0, cooldown: sk.cooldown, cdPerRank: 0, statusPerRank: 0, reach: reach ? reachRadius(reach) : 0,
    params: Object.fromEntries(Object.entries(sk.params ?? {}).map(([k, v]) => [k, v.v])),
  };
}

/** 1 + pct % for each rank above 1 (never below 0). */
const grow = (pct: number, rank: number): number => Math.max(0, 1 + (pct / 100) * Math.max(0, rank - 1));

/** Damage multiplier (× ATK) of each hit at this rank. */
export function rankedDmg(sk: SkillDef, rank: number, b?: Balance): number {
  const v = skillValues(sk, b);
  return v.dmg * grow(v.dmgPerRank, rank);
}

/** How a skill's extra damage numbers (on-hit, burning, bomblets) grow at this rank: by its damage %/rank. */
export function dmgGrowth(sk: SkillDef, rank: number, b?: Balance): number {
  return grow(skillValues(sk, b).dmgPerRank, rank);
}

/** Cooldown in seconds at this rank. */
export function rankedCooldown(sk: SkillDef, rank: number, b?: Balance): number {
  const v = skillValues(sk, b);
  return Math.round(v.cooldown * grow(v.cdPerRank, rank) * 100) / 100;
}

/** Multiplier of the skill's status times (stun, slow, armor break...) at this rank. */
export function statusScale(sk: SkillDef, rank: number, b?: Balance): number {
  return grow(skillValues(sk, b).statusPerRank, rank);
}

/**
 * MP at this character level and skill rank (owner 2026-11-14: a higher rank costs more): the class's
 * MP by level (skillMpCost, #256) × (1 + MP %/rank × (rank − 1)), rounded. Free skills stay free.
 */
export function rankedMp(sk: SkillDef, cls: ClassId, level: number, rank: number, b?: Balance): number {
  const v = skillValues(sk, b);
  const byLevel = skillMpCost(v.mp, cls, level, b);
  return Math.round(byLevel * grow(v.mpPerRank, rank));
}

/**
 * One of the skill's own numbers (SkillDef.params) as tuned; with a rank, a status one (stun, slow time...) grows by
 * the skill's status %/rank. 0 if the skill has no such number.
 */
export function skillParam(sk: SkillDef, key: string, rank?: number, b?: Balance): number {
  const v = skillValues(sk, b).params[key] ?? sk.params?.[key]?.v ?? 0;
  if (rank === undefined) return v;
  if (sk.params?.[key]?.status) return v * statusScale(sk, rank, b);
  if (sk.params?.[key]?.dmg) return v * dmgGrowth(sk, rank, b);
  return v;
}

/**
 * How the skill reaches, as tuned: its range (or radius around the player) from the balance, an explosion's or a
 * landing circle's size from its `blast` / `radius` numbers. The hits, the tooltips, the ground ring and touch
 * aiming all use it, so they always agree.
 */
export function skillReach(sk: SkillDef, b?: Balance): SkillReach | undefined {
  const base = SKILL_REACH[sk.id];
  if (!base || !isLearnable(sk)) return base;
  const v = skillValues(sk, b);
  switch (base.kind) {
    case 'self': return { kind: 'self', radius: v.reach };
    case 'cone': return { kind: 'cone', range: v.reach };
    case 'dash': return { kind: 'dash', range: v.reach };
    case 'shot': return base.blast !== undefined ? { kind: 'shot', range: v.reach, blast: skillParam(sk, 'blast', undefined, b) } : { kind: 'shot', range: v.reach };
    case 'point': return { kind: 'point', range: v.reach, radius: skillParam(sk, 'radius', undefined, b) };
  }
}

/** Thai lines of the skill's own numbers at a rank, e.g. "สตัน 1.05 วิ" (sizes are in the reach line instead). */
export function skillParamLines(sk: SkillDef, rank: number, b?: Balance): string[] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return Object.entries(sk.params ?? {})
    .filter(([k]) => k !== 'blast' && k !== 'radius')
    .map(([k, d]) => `${d.nameTh} ${r2(skillParam(sk, k, rank, b))} ${d.unit}`);
}
