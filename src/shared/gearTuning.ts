// The /admin settings of the gear quests (src/shared/gearQuests.ts): one card for every floor, "เควสอุปกรณ์"
// (owner 2026-11-26). Per floor: a switch and how many monsters a quest asks for; per map: the rarity of its gear.
// The code values are the owner's: floor 1 asks for 20 and gives green on maps 1–2, blue on 3–4 (2026-11-12);
// floor 2 asks for 40 and gives blue on all four maps (2026-11-26). No balance import here (balance.ts imports this).
import { floorOf, ZONES, type ZoneDef } from './data/zones';
import { RARITIES, RARITY_LABEL, type Rarity } from './types';

export interface GearFloorConfig {
  /** The floor's gear quests are given (off = none offered, none handed in, kills not counted; saved progress kept). */
  on: boolean;
  /** Monsters of the map to kill for one quest. */
  kills: number;
}
export interface GearConfig {
  /** By floor number. */
  floors: Record<number, GearFloorConfig>;
  /** Rarity of each map's quest gear, by map id. */
  rarity: Record<string, Rarity>;
}
/** What is saved: only what differs from the code. */
export interface GearTuning {
  floors?: Record<string, Partial<GearFloorConfig>>;
  rarity?: Record<string, Rarity>;
}

export const GEAR_KILLS_MIN = 1;
/** Highest kill count /admin takes; saved counts are clamped to this, so lowering and raising the count keeps progress. */
export const GEAR_KILLS_MAX = 200;
/** Kills asked for by floor in the code (owner: floor 1 20, floor 2 40); a floor not listed asks for floor 1's. */
const CODE_KILLS: Record<number, number> = { 1: 20, 2: 40 };

/** Farm maps in order (the ones with a boss lair, so never a hub or a boss room), every floor. */
export function gearMaps(): ZoneDef[] {
  return Object.values(ZONES).filter((z) => z.lair).sort((a, b) => a.levels[0] - b.levels[0]);
}

/** The floors that have gear quests, low to high. */
export function gearFloors(): number[] {
  return [...new Set(gearMaps().map(floorOf))].sort((a, b) => a - b);
}

/** The code rarity of a map: floor 1 green on its first two maps, blue after; floor 2 blue on all. */
function codeRarity(map: ZoneDef): Rarity {
  const floor = floorOf(map);
  if (floor !== 1) return 'rare';
  return gearMaps().filter((z) => floorOf(z) === 1).indexOf(map) < 2 ? 'uncommon' : 'rare';
}

export function codeGear(): GearConfig {
  const floors: Record<number, GearFloorConfig> = {};
  for (const f of gearFloors()) floors[f] = { on: true, kills: CODE_KILLS[f] ?? CODE_KILLS[1] };
  const rarity: Record<string, Rarity> = {};
  for (const m of gearMaps()) rarity[m.id] = codeRarity(m);
  return { floors, rarity };
}

export function mergeGear(t: GearTuning | undefined): GearConfig {
  const c = codeGear();
  if (!t) return c;
  for (const [f, v] of Object.entries(t.floors ?? {})) {
    const row = c.floors[Number(f)];
    if (!row || !v) continue;
    if (v.on !== undefined) row.on = v.on;
    if (v.kills !== undefined) row.kills = v.kills;
  }
  for (const [id, r] of Object.entries(t.rarity ?? {})) if (id in c.rarity) c.rarity[id] = r;
  return c;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/**
 * Checks the `gear` part of a balance tuning: strict = errors for anything wrong, else wrong parts are dropped.
 * Parts equal to the code are left out. Returns the clean tuning (undefined = nothing differs) or a Thai error.
 */
export function checkGearTuning(x: unknown, strict: boolean): { tuning: GearTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าเควสอุปกรณ์ไม่ถูกต้อง' } : { tuning: undefined };
  const code = codeGear();
  if (strict) {
    const extra = Object.keys(x).find((k) => !['floors', 'rarity'].includes(k));
    if (extra) return { error: `เควสอุปกรณ์: ไม่รู้จัก "${extra.slice(0, 20)}"` };
  }
  const out: GearTuning = {};
  if (x.floors !== undefined) {
    if (!isObj(x.floors)) {
      if (strict) return { error: 'เควสอุปกรณ์: ค่าต่อชั้นไม่ถูกต้อง' };
    } else {
      const floors: Record<string, Partial<GearFloorConfig>> = {};
      for (const [f, v] of Object.entries(x.floors)) {
        const row = code.floors[Number(f)];
        if (!row || String(Number(f)) !== f || !isObj(v)) {
          if (strict) return { error: `เควสอุปกรณ์: ไม่รู้จักชั้น "${f.slice(0, 10)}"` };
          continue;
        }
        if (strict) {
          const extra = Object.keys(v).find((k) => !['on', 'kills'].includes(k));
          if (extra) return { error: `เควสอุปกรณ์ชั้น ${f}: ไม่รู้จัก "${extra.slice(0, 20)}"` };
        }
        const one: Partial<GearFloorConfig> = {};
        if (v.on !== undefined) {
          if (typeof v.on !== 'boolean') {
            if (strict) return { error: `เควสอุปกรณ์ชั้น ${f}: สวิตช์ไม่ถูกต้อง` };
          } else if (v.on !== row.on) one.on = v.on;
        }
        if (v.kills !== undefined) {
          const k = v.kills;
          if (typeof k !== 'number' || !Number.isInteger(k) || k < GEAR_KILLS_MIN || k > GEAR_KILLS_MAX) {
            if (strict) return { error: `เควสอุปกรณ์ชั้น ${f}: จำนวนที่ต้องล่าต้องเป็นจำนวนเต็ม ${GEAR_KILLS_MIN}–${GEAR_KILLS_MAX}` };
          } else if (k !== row.kills) one.kills = k;
        }
        if (Object.keys(one).length) floors[f] = one;
      }
      if (Object.keys(floors).length) out.floors = floors;
    }
  }
  if (x.rarity !== undefined) {
    if (!isObj(x.rarity)) {
      if (strict) return { error: 'เควสอุปกรณ์: เกรดของไม่ถูกต้อง' };
    } else {
      const rarity: Record<string, Rarity> = {};
      for (const [id, r] of Object.entries(x.rarity)) {
        if (!(id in code.rarity) || typeof r !== 'string' || !RARITIES.includes(r as Rarity)) {
          if (strict) return { error: `เควสอุปกรณ์: เกรดของแมพ "${id.slice(0, 30)}" ไม่ถูกต้อง` };
          continue;
        }
        if (r !== code.rarity[id]) rarity[id] = r as Rarity;
      }
      if (Object.keys(rarity).length) out.rarity = rarity;
    }
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function gearChanges(a: GearConfig, b: GearConfig): string[] {
  const out: string[] = [];
  for (const f of gearFloors()) {
    const x = a.floors[f];
    const y = b.floors[f];
    if (!x || !y) continue;
    if (x.on !== y.on) out.push(`เควสอุปกรณ์ชั้น ${f} ${x.on ? 'เปิด' : 'ปิด'} → ${y.on ? 'เปิด' : 'ปิด'}`);
    if (x.kills !== y.kills) out.push(`เควสอุปกรณ์ชั้น ${f} ล่า ${x.kills} → ${y.kills} ตัว`);
  }
  for (const m of gearMaps()) {
    if (a.rarity[m.id] !== b.rarity[m.id]) out.push(`เกรดของเควสอุปกรณ์${m.nameTh} ${RARITY_LABEL[a.rarity[m.id]]} → ${RARITY_LABEL[b.rarity[m.id]]}`);
  }
  return out;
}
