// Item sets (floor 2 plan, docs/plans/FLOOR2_PLAN.md section 8; rules in docs/systems/items-and-forge.md "เซ็ตไอเทม").
// One set per floor-2 map. A set piece is an ordinary item kind with `set` on its BaseItem (data/items.ts), so saves
// need nothing new: the set comes from the item's baseId. Owner 2026-11-19: every worn place counts (weapon, off-hand,
// helmet, necklace, armor, gloves, belt, boots and both rings), at most SET_MAX_PIECES; bonus steps at 3 / 6 / 9.
// Bonuses are not worked out yet (owner: later); this is the set data, the piece count and the /admin card
// (`BalanceTuning.sets`: a server-wide switch and each set's steps, only what differs from the code).
import { EQUIP_SLOTS, type EquipSlot, type Item } from '../types';
import { itemSet } from './items';

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
}

export interface SetTuning {
  on?: boolean;
  steps?: Partial<Record<SetId, number[]>>;
}

export function codeSets(): SetConfig {
  const steps = {} as Record<SetId, number[]>;
  for (const id of SET_IDS) steps[id] = [...CODE_SET_STEPS];
  return { on: true, steps };
}
const CODE = codeSets();

export function mergeSets(t: SetTuning | undefined): SetConfig {
  const c = codeSets();
  if (!t) return c;
  if (t.on !== undefined) c.on = t.on;
  for (const id of SET_IDS) if (t.steps?.[id]) c.steps[id] = [...t.steps[id]!];
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
export function setInfo(item: Item, equipment: Partial<Record<EquipSlot, Item | null>>, c: SetConfig): { name: string; pieces: number; steps: number[] } | null {
  const set = itemSet(item);
  if (!set || !c.on) return null;
  return { name: SET_NAME[set], pieces: setPieces(equipment, set), steps: c.steps[set] };
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
    const extra = Object.keys(x).find((k) => k !== 'on' && k !== 'steps');
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
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function setChanges(a: SetConfig, b: SetConfig): string[] {
  const out: string[] = [];
  if (a.on !== b.on) out.push(`เซ็ตไอเทม ${a.on ? 'เปิด' : 'ปิด'} → ${b.on ? 'เปิด' : 'ปิด'}`);
  for (const id of SET_IDS) {
    if (!sameSteps(a.steps[id], b.steps[id])) out.push(`${SET_NAME[id]} ขั้นโบนัส ${a.steps[id].join('/')} → ${b.steps[id].join('/')} ชิ้น`);
  }
  return out;
}
