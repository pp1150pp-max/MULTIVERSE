// Stopping for a moment on each attack (owner 2026-11-18, docs/systems/world-and-ui.md "หยุดตอนโจมตี"): running and
// attacking at once looked like sliding, so a basic attack or a skill that is not a movement or buff skill holds the
// character still for a short while, then walking (a held key or a clicked spot) carries on by itself. The Sim decides
// it (Player.atkRootT); the browser predicts the same pause (src/client/net/online.ts) so it isn't pulled back.
// Tuned on /admin → ปรับสมดุล → "หยุดตอนโจมตี", saved inside the balance tuning (`BalanceTuning.attackRoot`), only what
// differs from the code.
import { CLASS_IDS, CLASSES } from './data/classes';
import type { ClassId } from './types';

export interface AttackRootClass {
  /** Stops at all for this class. */
  on: boolean;
  /** Seconds a basic attack holds still (never longer than the attack animation, see attackRootTime). */
  basicSec: number;
}

export interface AttackRootConfig {
  classes: Record<ClassId, AttackRootClass>;
  /** A skill holds still for the class's basicSec × this. */
  skillMult: number;
}

export interface AttackRootTuning {
  classes?: Partial<Record<ClassId, Partial<AttackRootClass>>>;
  skillMult?: number;
}

export const ATTACK_ROOT_RANGE = { basicSec: [0, 1], skillMult: [0, 3] } as const satisfies Record<string, readonly [number, number]>;

/** Code values: about each class's attack animation at its base attack speed (sword/mage 0.5 s, gun 0.37 s). */
const CODE_BASIC_SEC: Record<ClassId, number> = { sword: 0.45, mage: 0.4, gunslinger: 0.3 };

/**
 * Skills that never hold the player still: the ones that move them (dashes, leaps, hops back, vanishing strikes) and
 * buffs / shouts that swing nothing. Skills that already stand the player still themselves (Headshot, Unleash,
 * Charged Blast...) are skipped by the Sim on their own (Player.rootT). Shared so the browser predicts the same.
 */
export const NO_ATTACK_ROOT: ReadonlySet<string> = new Set([
  // Movement
  'charge', 'sw_hunt', 'sw_backstep', 'sw_spindodge', 'sw_bladedance', 'sw_shadowstep', 'sw_shadowswap', 'sw_thousandcuts', 'gs_counter',
  // Buffs and shouts (sword)
  'sw_overdrive', 'sw_guard', 'sw_thorns', 'sw_anchor', 'sw_warcry', 'sw_taunt', 'sw_unbreakable',
  // Buffs (gunslinger)
  'gs_sniperfocus', 'gs_hotrounds', 'gs_quickreload', 'gs_doubletap', 'gs_shockrounds', 'gs_stackfire', 'gs_splitshot',
  'gs_piercerounds', 'gs_overdrive', 'gs_bulletstorm',
  // Buffs (mage)
  'mg_empowerfield', 'mg_manashield', 'mg_manawell',
]);

/** The code's own numbers (a fresh copy). */
export function codeAttackRoot(): AttackRootConfig {
  const classes = {} as Record<ClassId, AttackRootClass>;
  for (const id of CLASS_IDS) classes[id] = { on: true, basicSec: CODE_BASIC_SEC[id] };
  return { classes, skillMult: 1 };
}
const CODE = codeAttackRoot();

export function mergeAttackRoot(t: AttackRootTuning | undefined): AttackRootConfig {
  const c = codeAttackRoot();
  if (!t) return c;
  for (const id of CLASS_IDS) Object.assign(c.classes[id], t.classes?.[id]);
  if (t.skillMult !== undefined) c.skillMult = t.skillMult;
  return c;
}

/**
 * Seconds this attack holds the player still (0 = not at all). `animSec` is the attack animation's length: a basic
 * attack never stops longer than it, so a fast attacker holding the button still gets a step in between.
 */
export function attackRootTime(c: AttackRootConfig, cls: ClassId, skillId: string | null, animSec: number): number {
  const k = c.classes[cls];
  if (!k?.on) return 0;
  if (skillId === null) return Math.min(k.basicSec, animSec);
  if (NO_ATTACK_ROOT.has(skillId)) return 0;
  return k.basicSec * c.skillMult;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const className = (id: ClassId) => CLASSES[id]?.nameTh ?? id;

/**
 * Checks the `attackRoot` part of a balance tuning (see checkBalance): strict = errors for anything wrong, else wrong
 * entries are dropped. Values equal to the code are left out. Returns the clean tuning (undefined = nothing differs).
 */
export function checkAttackRootTuning(x: unknown, strict: boolean): { tuning: AttackRootTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าหยุดตอนโจมตีไม่ถูกต้อง' } : { tuning: undefined };
  if (strict) {
    const extra = Object.keys(x).find((k) => k !== 'classes' && k !== 'skillMult');
    if (extra) return { error: `หยุดตอนโจมตี: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: AttackRootTuning = {};
  if (x.classes !== undefined) {
    if (!isObj(x.classes)) {
      if (strict) return { error: 'หยุดตอนโจมตี: ค่าอาชีพไม่ถูกต้อง' };
    } else {
      for (const [id, v] of Object.entries(x.classes)) {
        if (!(CLASS_IDS as readonly string[]).includes(id) || !isObj(v)) {
          if (strict) return { error: `หยุดตอนโจมตี: ไม่รู้จักอาชีพ "${id.slice(0, 20)}"` };
          continue;
        }
        const cid = id as ClassId;
        const o: Partial<AttackRootClass> = {};
        if (strict) {
          const extra = Object.keys(v).find((k) => k !== 'on' && k !== 'basicSec');
          if (extra) return { error: `หยุดตอนโจมตี ${className(cid)}: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
        }
        if (v.on !== undefined) {
          if (typeof v.on !== 'boolean') {
            if (strict) return { error: `หยุดตอนโจมตี ${className(cid)}: เปิด/ปิดไม่ถูกต้อง` };
          } else if (v.on !== CODE.classes[cid].on) o.on = v.on;
        }
        if (v.basicSec !== undefined) {
          const [lo, hi] = ATTACK_ROOT_RANGE.basicSec;
          const n = v.basicSec;
          if (typeof n !== 'number' || !Number.isFinite(n) || n < lo || n > hi) {
            if (strict) return { error: `หยุดตอนโจมตี ${className(cid)}: เวลาหยุดตีธรรมดาต้องอยู่ระหว่าง ${lo}–${hi} วิ` };
          } else if (round3(n) !== CODE.classes[cid].basicSec) o.basicSec = round3(n);
        }
        if (Object.keys(o).length) (out.classes ??= {})[cid] = o;
      }
    }
  }
  if (x.skillMult !== undefined) {
    const [lo, hi] = ATTACK_ROOT_RANGE.skillMult;
    const n = x.skillMult;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < lo || n > hi) {
      if (strict) return { error: `หยุดตอนโจมตี: ตัวคูณเวลาหยุดของสกิลต้องอยู่ระหว่าง ${lo}–${hi}` };
    } else if (round3(n) !== CODE.skillMult) out.skillMult = round3(n);
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. */
export function attackRootChanges(a: AttackRootConfig, b: AttackRootConfig): string[] {
  const out: string[] = [];
  for (const id of CLASS_IDS) {
    const x = a.classes[id];
    const y = b.classes[id];
    if (x.on !== y.on) out.push(`หยุดตอนโจมตี ${className(id)} ${x.on ? 'เปิด' : 'ปิด'} → ${y.on ? 'เปิด' : 'ปิด'}`);
    if (x.basicSec !== y.basicSec) out.push(`หยุดตอนตีธรรมดา ${className(id)} ${x.basicSec} → ${y.basicSec} วิ`);
  }
  if (a.skillMult !== b.skillMult) out.push(`ตัวคูณเวลาหยุดตอนใช้สกิล ×${a.skillMult} → ×${b.skillMult}`);
  return out;
}
