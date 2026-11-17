// Which papercraft sword and armour each sword-class item shows on the sword rig (owner 2026-11-16, a trial of the
// papercraft style: 3 swords and 2 armours drawn so far). Set on /admin → ปรับสมดุล → "นักดาบกระดาษ: ภาพอาวุธ/เกราะ",
// saved inside the balance tuning (`BalanceTuning.rigLook`), only the items that differ from the code.
import { ITEM_BASES } from './data/items';

export const RIG_WEAPONS = ['katana', 'great', 'fire'] as const;
export type RigWeapon = (typeof RIG_WEAPONS)[number];
export const RIG_ARMORS = ['dark', 'silver'] as const;
export type RigArmor = (typeof RIG_ARMORS)[number];

export const RIG_WEAPON_NAME: Record<RigWeapon, string> = { katana: 'คาตานาอำพัน', great: 'ดาบใหญ่', fire: 'ดาบไฟ' };
export const RIG_ARMOR_NAME: Record<RigArmor, string> = { dark: 'เกราะเหล็กดำ', silver: 'เกราะเงินฟ้า' };

/** What a sword with no item (or an unknown one) shows. */
export const RIG_DEFAULT_WEAPON: RigWeapon = 'katana';
export const RIG_DEFAULT_ARMOR: RigArmor = 'dark';

export interface RigLookConfig {
  /** Weapon item kind (baseId) → sword picture. */
  weapons: Record<string, RigWeapon>;
  /** Armour item kind (baseId) → armour pictures. */
  armors: Record<string, RigArmor>;
}
export type RigLookTuning = Partial<RigLookConfig>;

/** Item kinds of a slot, in the order of the item list (level order). */
const kindsOf = (slot: 'weapon' | 'armor'): string[] =>
  ITEM_BASES.filter((b) => b.slot === slot).sort((a, b) => a.minLevel - b.minLevel).map((b) => b.id);
export const RIG_WEAPON_ITEMS = kindsOf('weapon');
export const RIG_ARMOR_ITEMS = kindsOf('armor');

/** The code's own pairing: the weapons split into thirds by level (katana, great, fire), the first 3 armours dark. */
export function codeRigLook(): RigLookConfig {
  const weapons: Record<string, RigWeapon> = {};
  const n = RIG_WEAPON_ITEMS.length;
  RIG_WEAPON_ITEMS.forEach((id, i) => (weapons[id] = RIG_WEAPONS[Math.min(2, Math.floor((i * 3) / Math.max(1, n)))]));
  const armors: Record<string, RigArmor> = {};
  RIG_ARMOR_ITEMS.forEach((id, i) => (armors[id] = i < 3 ? 'dark' : 'silver'));
  return { weapons, armors };
}
const CODE = codeRigLook();

export function mergeRigLook(t: RigLookTuning | undefined): RigLookConfig {
  const c = codeRigLook();
  if (t?.weapons) Object.assign(c.weapons, t.weapons);
  if (t?.armors) Object.assign(c.armors, t.armors);
  return c;
}

/** The pictures for a worn weapon / armour kind (missing or unknown = the defaults). */
export function rigLookOf(cfg: RigLookConfig, wpn: string | undefined, arm: string | undefined): { weapon: RigWeapon; armor: RigArmor } {
  return {
    weapon: (wpn && cfg.weapons[wpn]) || RIG_DEFAULT_WEAPON,
    armor: (arm && cfg.armors[arm]) || RIG_DEFAULT_ARMOR,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/**
 * Checks the `rigLook` part of a balance tuning (see checkBalance): strict = errors for anything wrong, else wrong
 * entries are dropped. Pairings equal to the code are left out. Returns the clean tuning (undefined = nothing differs).
 */
export function checkRigLookTuning(x: unknown, strict: boolean): { tuning: RigLookTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าภาพนักดาบกระดาษไม่ถูกต้อง' } : { tuning: undefined };
  if (strict) {
    const extra = Object.keys(x).find((k) => k !== 'weapons' && k !== 'armors');
    if (extra) return { error: `นักดาบกระดาษ: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: RigLookTuning = {};
  const part = <V extends string>(key: 'weapons' | 'armors', items: string[], values: readonly V[], code: Record<string, V>): string | null => {
    const v = x[key];
    if (v === undefined) return null;
    if (!isObj(v)) return strict ? 'นักดาบกระดาษ: รายการไม่ถูกต้อง' : null;
    const got: Record<string, V> = {};
    // Fixed key order (the item list's), so two equal tunings give the same JSON.
    for (const id of Object.keys(v)) {
      if (!items.includes(id)) {
        if (strict) return `นักดาบกระดาษ: ไม่รู้จักไอเทม "${id.slice(0, 20)}"`;
        continue;
      }
      if (!values.includes(v[id] as V)) {
        if (strict) return `นักดาบกระดาษ: ไม่รู้จักภาพ "${String(v[id]).slice(0, 20)}"`;
        continue;
      }
    }
    for (const id of items) {
      const pick = v[id] as V | undefined;
      if (pick !== undefined && values.includes(pick) && pick !== code[id]) got[id] = pick;
    }
    if (Object.keys(got).length) (out as Record<string, unknown>)[key] = got;
    return null;
  };
  const err = part('weapons', RIG_WEAPON_ITEMS, RIG_WEAPONS, CODE.weapons) ?? part('armors', RIG_ARMOR_ITEMS, RIG_ARMORS, CODE.armors);
  if (err) return { error: err };
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function rigLookChanges(a: RigLookConfig, b: RigLookConfig): string[] {
  const out: string[] = [];
  for (const id of RIG_WEAPON_ITEMS) {
    if (a.weapons[id] !== b.weapons[id]) out.push(`นักดาบกระดาษ ${id}: ${RIG_WEAPON_NAME[a.weapons[id]]} → ${RIG_WEAPON_NAME[b.weapons[id]]}`);
  }
  for (const id of RIG_ARMOR_ITEMS) {
    if (a.armors[id] !== b.armors[id]) out.push(`นักดาบกระดาษ ${id}: ${RIG_ARMOR_NAME[a.armors[id]]} → ${RIG_ARMOR_NAME[b.armors[id]]}`);
  }
  return out;
}
