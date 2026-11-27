// Pets pick up loot (owner 2026-11-27, docs/systems/pet-loot.md): a worn pet cosmetic that may collect fetches drops for
// its owner, one every `interval` seconds. Auto on = anything Auto itself may take inside the Auto circle; Auto off = drops
// from monsters this player got the loot of, within `handRadius` of the player. The Sim decides it (sim/petLoot.ts).
// Tuned on the /admin "ปรับสมดุล" tab; saved inside the balance tuning (`BalanceTuning.petLoot`), only what differs from the code.
import { COSMETICS } from './data/cosmetics';

export interface PetLootConfig {
  /** Server-wide switch: off = no pet picks anything up. */
  on: boolean;
  /** Pets pick up while Auto Play is on (inside the Auto circle, Auto's own rules). */
  auto: boolean;
  /** Pets pick up while playing by hand (own drops near the player). */
  hand: boolean;
  /** Playing by hand: how far from the player (world units) the pet fetches. */
  handRadius: number;
  /** Seconds between two pickups of one pet. */
  interval: number;
  /** Which pets collect, by pet cosmetic id. A pet missing here (a new one) collects. */
  pets: Record<string, boolean>;
}

/** What is saved: only what differs from the code. */
export interface PetLootTuning {
  on?: boolean;
  auto?: boolean;
  hand?: boolean;
  handRadius?: number;
  interval?: number;
  /** Only the pets whose switch differs from the code's (on). */
  pets?: Record<string, boolean>;
}

export const PET_LOOT_RANGE = {
  handRadius: [1, 20],
  interval: [0.1, 5],
} as const satisfies Record<string, readonly [number, number]>;
export const PET_LOOT_NUM_NAME: Record<keyof typeof PET_LOOT_RANGE, string> = {
  handRadius: 'สัตว์เลี้ยงเก็บของ: ระยะตอนเล่นเอง (ม.)',
  interval: 'สัตว์เลี้ยงเก็บของ: เก็บทุก (วิ)',
};
export const PET_LOOT_FLAG_NAME = {
  on: 'สัตว์เลี้ยงช่วยเก็บของ (ทั้งเซิร์ฟ)',
  auto: 'สัตว์เลี้ยงเก็บของตอนเปิด Auto',
  hand: 'สัตว์เลี้ยงเก็บของตอนเล่นเอง',
} as const;
type Flag = keyof typeof PET_LOOT_FLAG_NAME;
const FLAGS = Object.keys(PET_LOOT_FLAG_NAME) as Flag[];
const NUMS = Object.keys(PET_LOOT_RANGE) as (keyof typeof PET_LOOT_RANGE)[];

/** The pet cosmetics' ids, in shop order (read each time: the cosmetics list can grow while the server runs). */
export function petIds(): string[] {
  return COSMETICS.filter((c) => c.slot === 'pet').map((c) => c.id);
}
function petName(id: string): string {
  return COSMETICS.find((c) => c.id === id)?.name ?? id;
}

/** The code's own numbers (a fresh copy): on, every pet collects, 6 m by hand, one drop every 0.5 s. */
export function codePetLoot(): PetLootConfig {
  const pets: Record<string, boolean> = {};
  for (const id of petIds()) pets[id] = true;
  return { on: true, auto: true, hand: true, handRadius: 6, interval: 0.5, pets };
}
const CODE = codePetLoot();

export function mergePetLoot(t: PetLootTuning | undefined): PetLootConfig {
  const c = codePetLoot();
  if (!t) return c;
  for (const k of FLAGS) if (t[k] !== undefined) c[k] = t[k]!;
  for (const k of NUMS) if (t[k] !== undefined) c[k] = t[k]!;
  if (t.pets) for (const [id, v] of Object.entries(t.pets)) if (id in c.pets) c.pets[id] = v;
  return c;
}

/** Whether pet cosmetic `id` may collect under this config (a pet the config doesn't list collects). */
export function petCollects(c: PetLootConfig, id: string | undefined): boolean {
  return !!id && c.on && c.pets[id] !== false && petIds().includes(id);
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Checks the `petLoot` part of a balance tuning (see checkBalance): strict = errors for anything wrong, else wrong entries
 * are dropped. Values equal to the code are left out. Returns the clean tuning (undefined = nothing differs) or a Thai error.
 */
export function checkPetLootTuning(x: unknown, strict: boolean): { tuning: PetLootTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าสัตว์เลี้ยงเก็บของไม่ถูกต้อง' } : { tuning: undefined };
  const TOP: string[] = [...FLAGS, ...NUMS, 'pets'];
  if (strict) {
    const extra = Object.keys(x).find((k) => !TOP.includes(k));
    if (extra) return { error: `สัตว์เลี้ยงเก็บของ: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: PetLootTuning = {};
  for (const k of FLAGS) {
    const v = x[k];
    if (v === undefined) continue;
    if (typeof v !== 'boolean') {
      if (strict) return { error: `${PET_LOOT_FLAG_NAME[k]} ต้องเป็นเปิด/ปิด` };
      continue;
    }
    if (v !== CODE[k]) out[k] = v;
  }
  for (const k of NUMS) {
    const v = x[k];
    if (v === undefined) continue;
    const [lo, hi] = PET_LOOT_RANGE[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
      if (strict) return { error: `${PET_LOOT_NUM_NAME[k]} ต้องอยู่ระหว่าง ${lo} ถึง ${hi}` };
      continue;
    }
    const n = round3(v);
    if (n !== CODE[k]) out[k] = n;
  }
  if (x.pets !== undefined) {
    if (!isObj(x.pets)) {
      if (strict) return { error: 'รายชื่อสัตว์เลี้ยงที่เก็บของไม่ถูกต้อง' };
    } else {
      const ids = petIds();
      const p: Record<string, boolean> = {};
      for (const [id, v] of Object.entries(x.pets)) {
        if (!ids.includes(id)) {
          if (strict) return { error: `สัตว์เลี้ยงเก็บของ: ไม่รู้จักสัตว์เลี้ยง "${id.slice(0, 20)}"` };
          continue;
        }
        if (typeof v !== 'boolean') {
          if (strict) return { error: `สัตว์เลี้ยงเก็บของ "${petName(id)}" ต้องเป็นเปิด/ปิด` };
          continue;
        }
        if (v !== true) p[id] = v;
      }
      if (Object.keys(p).length) out.pets = p;
    }
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function petLootChanges(a: PetLootConfig, b: PetLootConfig): string[] {
  const onOff = (v: boolean) => (v ? 'เปิด' : 'ปิด');
  const out: string[] = [];
  for (const k of FLAGS) if (a[k] !== b[k]) out.push(`${PET_LOOT_FLAG_NAME[k]} ${onOff(a[k])} → ${onOff(b[k])}`);
  for (const k of NUMS) if (a[k] !== b[k]) out.push(`${PET_LOOT_NUM_NAME[k]} ${a[k]} → ${b[k]}`);
  for (const id of petIds()) {
    const x = a.pets[id] !== false;
    const y = b.pets[id] !== false;
    if (x !== y) out.push(`สัตว์เลี้ยงเก็บของ ${petName(id)} ${onOff(x)} → ${onOff(y)}`);
  }
  return out;
}
