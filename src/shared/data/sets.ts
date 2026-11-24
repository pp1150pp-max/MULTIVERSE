// Item sets (floor 2 plan, docs/plans/FLOOR2_PLAN.md section 8; rules in docs/systems/items-and-forge.md "เซ็ตไอเทม").
// One set per floor-2 map. A set piece is an ordinary item kind with `set` on its BaseItem (data/items.ts), so saves
// need nothing new: the set comes from the item's baseId. Owner 2026-11-19: every worn place counts (weapon, off-hand,
// helmet, necklace, armor, gloves, belt, boots and both rings), at most SET_MAX_PIECES; bonus steps at 3 / 6 / 9.
// Bonuses (owner 2026-11-24): each step reached adds its own stats on top of the steps below it (6 pieces = step 1 +
// step 2), any of the 13 stats, flat: exactly the number set in /admin, after the class multipliers (Player.recompute).
// All 0 in the code; the owner sets them. `BalanceTuning.sets`: the switch, each set's steps and its bonuses, only
// what differs from the code. Set pieces: data/items.ts (SET_ROWS).
import { EQUIP_SLOTS, STAT_KEYS, STAT_LABEL, type EquipSlot, type Item, type StatKey, type Stats } from '../types';
import { ITEM_BASES, itemSet } from './items';

export const SET_IDS = ['beach', 'pirate', 'ghost_sailor', 'sea_king'] as const;
export type SetId = (typeof SET_IDS)[number];

/** Thai name shown on items, e.g. "ชุดโจรสลัด (2/9)". */
export const SET_NAME: Record<SetId, string> = {
  beach: 'ชุดชาวหาด',
  pirate: 'ชุดโจรสลัด',
  ghost_sailor: 'ชุดกะลาสีผี',
  sea_king: 'ชุดราชาท้องทะเล',
};

/** Most pieces a set counts (9 kinds of gear; two rings of the set may stand in for another piece). */
export const SET_MAX_PIECES = 9;
/** Pieces worn for each bonus step, in the code (owner 2026-11-19). */
export const CODE_SET_STEPS: readonly number[] = [3, 6, 9];

export interface SetConfig {
  /** Sets on server-wide; off = no set lines on items (and, once there are bonuses, no bonuses). */
  on: boolean;
  /** Pieces for each bonus step, per set: three whole numbers 1–9, each higher than the last. */
  steps: Record<SetId, number[]>;
  /** Per set, what each step adds (one entry per step, only the stats it gives; empty = nothing). */
  bonus: Record<SetId, SetBonus[]>;
}

/** What one bonus step gives: flat stats in Stats units (atkSpeed 5 = +5% attack speed). */
export type SetBonus = Partial<Record<StatKey, number>>;
/** Highest bonus a step may give per stat (sanity cap for /admin). */
export const SET_BONUS_MAX = 100_000;

export interface SetTuning {
  on?: boolean;
  steps?: Partial<Record<SetId, number[]>>;
  /** Per set, the bonuses of each step (one object per step; only non-zero stats). */
  bonus?: Partial<Record<SetId, SetBonus[]>>;
}

const noBonus = (): SetBonus[] => CODE_SET_STEPS.map(() => ({}));

export function codeSets(): SetConfig {
  const steps = {} as Record<SetId, number[]>;
  const bonus = {} as Record<SetId, SetBonus[]>;
  for (const id of SET_IDS) {
    steps[id] = [...CODE_SET_STEPS];
    bonus[id] = noBonus();
  }
  return { on: true, steps, bonus };
}
const CODE = codeSets();

export function mergeSets(t: SetTuning | undefined): SetConfig {
  const c = codeSets();
  if (!t) return c;
  if (t.on !== undefined) c.on = t.on;
  for (const id of SET_IDS) if (t.steps?.[id]) c.steps[id] = [...t.steps[id]!];
  for (const id of SET_IDS) if (t.bonus?.[id]) c.bonus[id] = c.bonus[id].map((_, i) => ({ ...t.bonus![id]![i] }));
  return c;
}

/** How many pieces of this set are worn, counting every worn place (both rings), at most SET_MAX_PIECES. */
export function setPieces(equipment: Partial<Record<EquipSlot, Item | null>>, set: SetId): number {
  let n = 0;
  for (const place of EQUIP_SLOTS) {
    const it = equipment[place];
    if (it && itemSet(it) === set) n++;
  }
  return Math.min(n, SET_MAX_PIECES);
}

/**
 * What an item's details show about its set, as worn by someone with this equipment: the set's name, pieces worn
 * and the steps (null when the item is in no set or sets are switched off).
 */
export function setInfo(item: Item, equipment: Partial<Record<EquipSlot, Item | null>>, c: SetConfig): { set: SetId; name: string; pieces: number; steps: number[]; bonus: SetBonus[] } | null {
  const set = itemSet(item);
  if (!set || !c.on) return null;
  return { set, name: SET_NAME[set], pieces: setPieces(equipment, set), steps: c.steps[set], bonus: c.bonus[set] };
}

/** The item kinds of a set (data/items.ts SET_ROWS). */
export const setPieceKinds = (id: SetId) => ITEM_BASES.filter((b) => b.set === id);

/** How many bonus steps of this set the pieces reach. */
export function stepsReached(pieces: number, steps: readonly number[]): number {
  return steps.filter((n) => pieces >= n).length;
}

/**
 * Every set bonus this equipment earns, summed (sets off = nothing): each set's pieces worn, and for every step
 * reached its own bonus on top of the ones below. Added to the player's stats as they are (Player.recompute).
 */
export function setBonusStats(equipment: Partial<Record<EquipSlot, Item | null>>, c: SetConfig): Partial<Stats> {
  const out: Partial<Stats> = {};
  if (!c.on) return out;
  for (const id of SET_IDS) {
    const reached = stepsReached(setPieces(equipment, id), c.steps[id]);
    for (let i = 0; i < reached; i++) {
      for (const [k, v] of Object.entries(c.bonus[id][i] ?? {}) as [StatKey, number][]) if (v) out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/** "พลังโจมตี +20, HP สูงสุด +300" (empty when the step gives nothing). */
export function bonusText(b: SetBonus | undefined): string {
  return STAT_KEYS.filter((k) => b?.[k]).map((k) => `${STAT_LABEL[k]} +${b![k]}`).join(', ');
}

const isObj =(x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const sameSteps = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Three whole numbers 1–SET_MAX_PIECES, each higher than the last. */
function stepsOk(x: unknown): x is number[] {
  return Array.isArray(x) && x.length === CODE_SET_STEPS.length &&
    x.every((n, i) => Number.isInteger(n) && n >= 1 && n <= SET_MAX_PIECES && (i === 0 || n > (x[i - 1] as number)));
}

/**
 * Checks the `sets` part of a balance tuning (see checkBalance): strict = errors for anything wrong, else wrong
 * entries are dropped. Values equal to the code are left out. Returns the clean tuning (undefined = nothing differs).
 */
export function checkSetTuning(x: unknown, strict: boolean): { tuning: SetTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าเซ็ตไอเทมไม่ถูกต้อง' } : { tuning: undefined };
  if (strict) {
    const extra = Object.keys(x).find((k) => k !== 'on' && k !== 'steps' && k !== 'bonus');
    if (extra) return { error: `เซ็ตไอเทม: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: SetTuning = {};
  if (x.on !== undefined) {
    if (typeof x.on !== 'boolean') {
      if (strict) return { error: 'เซ็ตไอเทม: สวิตช์ต้องเป็นเปิด/ปิด' };
    } else if (x.on !== CODE.on) out.on = x.on;
  }
  if (x.steps !== undefined) {
    if (!isObj(x.steps)) {
      if (strict) return { error: 'เซ็ตไอเทม: จำนวนชิ้นไม่ถูกต้อง' };
    } else {
      for (const [id, v] of Object.entries(x.steps)) {
        if (!(SET_IDS as readonly string[]).includes(id)) {
          if (strict) return { error: `เซ็ตไอเทม: ไม่รู้จักเซ็ต "${id.slice(0, 20)}"` };
          continue;
        }
        const sid = id as SetId;
        if (!stepsOk(v)) {
          if (strict) return { error: `${SET_NAME[sid]}: จำนวนชิ้นต้องเป็น 3 ขั้น จำนวนเต็ม 1–${SET_MAX_PIECES} มากขึ้นทีละขั้น` };
          continue;
        }
        if (!sameSteps(v, CODE.steps[sid])) (out.steps ??= {})[sid] = [...v];
      }
    }
  }
  if (x.bonus !== undefined) {
    if (!isObj(x.bonus)) {
      if (strict) return { error: 'เซ็ตไอเทม: โบนัสไม่ถูกต้อง' };
    } else {
      for (const [id, v] of Object.entries(x.bonus)) {
        if (!(SET_IDS as readonly string[]).includes(id)) {
          if (strict) return { error: `เซ็ตไอเทม: ไม่รู้จักเซ็ต "${id.slice(0, 20)}"` };
          continue;
        }
        const sid = id as SetId;
        if (!Array.isArray(v) || v.length !== CODE_SET_STEPS.length) {
          if (strict) return { error: `${SET_NAME[sid]}: โบนัสต้องมี ${CODE_SET_STEPS.length} ขั้น` };
          continue;
        }
        const clean: SetBonus[] = [];
        for (const step of v) {
          const b: SetBonus = {};
          if (step !== undefined && step !== null && !isObj(step)) {
            if (strict) return { error: `${SET_NAME[sid]}: โบนัสไม่ถูกต้อง` };
          } else {
            for (const [k, n] of Object.entries(step ?? {})) {
              if (!(STAT_KEYS as readonly string[]).includes(k)) {
                if (strict) return { error: `${SET_NAME[sid]}: ไม่รู้จักสเตตัส "${k.slice(0, 20)}"` };
                continue;
              }
              if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > SET_BONUS_MAX) {
                if (strict) return { error: `${SET_NAME[sid]}: ${STAT_LABEL[k as StatKey]} ต้องอยู่ระหว่าง 0–${SET_BONUS_MAX.toLocaleString()}` };
                continue;
              }
              const r = Math.round(n * 10) / 10;
              if (r) b[k as StatKey] = r;
            }
          }
          clean.push(b);
        }
        if (clean.some((b) => Object.keys(b).length)) (out.bonus ??= {})[sid] = clean;
      }
    }
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function setChanges(a: SetConfig, b: SetConfig): string[] {
  const out: string[] = [];
  if (a.on !== b.on) out.push(`เซ็ตไอเทม ${a.on ? 'เปิด' : 'ปิด'} → ${b.on ? 'เปิด' : 'ปิด'}`);
  for (const id of SET_IDS) {
    if (!sameSteps(a.steps[id], b.steps[id])) out.push(`${SET_NAME[id]} ขั้นโบนัส ${a.steps[id].join('/')} → ${b.steps[id].join('/')} ชิ้น`);
    a.bonus[id].forEach((x, i) => {
      const y = b.bonus[id][i];
      for (const k of STAT_KEYS) {
        if ((x[k] ?? 0) !== (y?.[k] ?? 0)) out.push(`${SET_NAME[id]} โบนัสขั้น ${i + 1} ${STAT_LABEL[k]} ${x[k] ?? 0} → ${y?.[k] ?? 0}`);
      }
    });
  }
  return out;
}
