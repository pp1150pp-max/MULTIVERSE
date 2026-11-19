// The way up to floor 2 (docs/plans/FLOOR2_PLAN.md 4.1–4.2, owner 2026-11-19): the navigator of the dimensions
// stands in nexus_city beside the knight's statue, seen only by characters who may go up (Lv40 and the Volcano Heart
// beaten). Talking to him the first time is the quest: it opens the way (Player.unlocks 'floor2') and mails a reward,
// bound, once per character (Guests can't hand it in: no mailbox). After that he takes them to the harbour.
// One place for the rules, so his window, the server and the NPC's visibility never disagree. /admin: the
// "ทางขึ้นชั้น 2" card (BalanceTuning.floorGate + the two switches floorGateOpen / floorGateQuest).
import { describeAttach, type MailAttach } from './mail';
import { checkReward } from './tutorial';

/** The boss a character must have beaten to be offered the way up (when needBoss is on). */
export const FLOOR2_BOSS = 'volcano_heart';
/** The unlock the quest gives (same as floors.ts floorUnlock(2)). */
export const FLOOR2_UNLOCK = 'floor2';

export interface FloorGateConfig {
  /** The level the quest asks for (code 40). */
  minLevel: number;
  /** Whether the Volcano Heart must have been beaten too (code on). */
  needBoss: boolean;
  /** Mailed on handing the quest in, every item bound (owner: an EXP scroll and a drop scroll). */
  reward: MailAttach;
}
/** What is saved: only what differs from the code. */
export type FloorGateTuning = Partial<FloorGateConfig>;

export const FLOOR_GATE_LEVEL_MIN = 1;
export const FLOOR_GATE_LEVEL_MAX = 80;

export function codeFloorGate(): FloorGateConfig {
  return {
    minLevel: 40,
    needBoss: true,
    reward: { gold: 0, items: [{ kind: 'stone', stone: 'exp_scroll', count: 1 }, { kind: 'stone', stone: 'drop_scroll', count: 1 }] },
  };
}
const CODE = codeFloorGate();

export function mergeFloorGate(t: FloorGateTuning | undefined): FloorGateConfig {
  const c = codeFloorGate();
  if (!t) return c;
  if (t.minLevel !== undefined) c.minLevel = t.minLevel;
  if (t.needBoss !== undefined) c.needBoss = t.needBoss;
  if (t.reward) c.reward = structuredClone(t.reward);
  return c;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Checks the `floorGate` part of a balance tuning: strict = errors for anything wrong, else wrong parts are dropped.
 * Parts equal to the code are left out. Returns the clean tuning (undefined = nothing differs) or a Thai error.
 */
export function checkFloorGateTuning(x: unknown, strict: boolean): { tuning: FloorGateTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าทางขึ้นชั้น 2 ไม่ถูกต้อง' } : { tuning: undefined };
  if (strict) {
    const extra = Object.keys(x).find((k) => !['minLevel', 'needBoss', 'reward'].includes(k));
    if (extra) return { error: `ทางขึ้นชั้น 2: ไม่รู้จัก "${extra.slice(0, 20)}"` };
  }
  const out: FloorGateTuning = {};
  if (x.minLevel !== undefined) {
    const v = x.minLevel;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < FLOOR_GATE_LEVEL_MIN || v > FLOOR_GATE_LEVEL_MAX) {
      if (strict) return { error: `เลเวลขั้นต่ำขึ้นชั้น 2 ต้องเป็นจำนวนเต็ม ${FLOOR_GATE_LEVEL_MIN}–${FLOOR_GATE_LEVEL_MAX}` };
    } else if (v !== CODE.minLevel) out.minLevel = v;
  }
  if (x.needBoss !== undefined) {
    if (typeof x.needBoss !== 'boolean') {
      if (strict) return { error: 'สวิตช์ต้องปราบหัวใจภูเขาไฟไม่ถูกต้อง' };
    } else if (x.needBoss !== CODE.needBoss) out.needBoss = x.needBoss;
  }
  if (x.reward !== undefined) {
    const r = checkReward(x.reward, 'เควสเปิดทางชั้น 2');
    if (typeof r === 'string') {
      if (strict) return { error: r };
    } else if (!same(r, CODE.reward)) out.reward = r;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function floorGateChanges(a: FloorGateConfig, b: FloorGateConfig): string[] {
  const out: string[] = [];
  if (a.minLevel !== b.minLevel) out.push(`เลเวลขั้นต่ำเควสขึ้นชั้น 2 ${a.minLevel} → ${b.minLevel}`);
  if (a.needBoss !== b.needBoss) out.push(`เควสขึ้นชั้น 2 ต้องปราบหัวใจภูเขาไฟ ${a.needBoss ? 'เปิด' : 'ปิด'} → ${b.needBoss ? 'เปิด' : 'ปิด'}`);
  const text = (r: MailAttach) => describeAttach(r).join(', ') || 'ไม่มี';
  if (!same(a.reward, b.reward)) out.push(`รางวัลเควสขึ้นชั้น 2: ${text(a.reward)} → ${text(b.reward)}`);
  return out;
}

/** The reward as mailed: every item bound to the character. */
export function floorGateReward(c: FloorGateConfig): MailAttach {
  return { gold: c.reward.gold, items: c.reward.items.map((it) => (it.kind === 'equip' ? it : { ...it, bound: true as const })) };
}

/** What the navigator in nexus_city does for a player. */
export type NavState =
  /** Not for them yet: he isn't there (level or the Volcano Heart missing). */
  | 'locked'
  /** The way up is shut for everyone (/admin floorGateOpen off). */
  | 'closed'
  /** He offers the quest: talk, and it is done. */
  | 'offer'
  /** He takes them up. */
  | 'go';

/** The settings the rules read (Balance has them all). */
export interface FloorGateRules { floorGateOpen: boolean; floorGateQuest: boolean; floorGate: FloorGateConfig }

/** Where a player stands with the navigator. With the quest switched off (floorGateQuest) only the level counts. */
export function navState(p: { level: number; bossKills: readonly string[]; unlocks: readonly string[] }, b: FloorGateRules): NavState {
  const c = b.floorGate;
  const done = p.unlocks.includes(FLOOR2_UNLOCK);
  const level = p.level >= c.minLevel;
  const ready = level && (!c.needBoss || p.bossKills.includes(FLOOR2_BOSS));
  if (!b.floorGateQuest ? !level && !done : !ready && !done) return 'locked';
  if (!b.floorGateOpen) return 'closed';
  return done || !b.floorGateQuest ? 'go' : 'offer';
}
