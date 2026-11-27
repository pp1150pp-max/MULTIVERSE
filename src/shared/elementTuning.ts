// The element system (owner 2026-11-27, docs/systems/skills.md "ระบบธาตุ"): every skill has one of water, fire,
// poison, lightning, wind or none. A hit of an element leaves that element's mark on the monster (with a small effect);
// a hit of another element while a mark is on sets off the pair's reaction and both marks are gone. The numbers and
// each skill's element are the owner's to change on the /admin "ระบบสกิล" tab (`SkillTuning.elements`), saved only
// where they differ from the code. The Sim side is src/shared/sim/elements.ts.

export const ELEMENTS = ['water', 'fire', 'poison', 'lightning', 'wind'] as const;
export type Element = (typeof ELEMENTS)[number];
/** A skill's element; 'none' = no mark, no reaction. */
export type SkillElement = Element | 'none';
export const SKILL_ELEMENTS: readonly SkillElement[] = ['none', ...ELEMENTS];

export const ELEMENT_NAME: Record<SkillElement, string> = { none: 'ไม่มีธาตุ', water: 'น้ำ', fire: 'ไฟ', poison: 'พิษ', lightning: 'สายฟ้า', wind: 'ลม' };
export const ELEMENT_ICON: Record<SkillElement, string> = { none: '', water: '💧', fire: '🔥', poison: '☠️', lightning: '⚡', wind: '🌪️' };
export const ELEMENT_COLOR: Record<SkillElement, string> = { none: '#c8c8c8', water: '#5ab4ff', fire: '#ff7a3a', poison: '#8ee05a', lightning: '#ffe45a', wind: '#9af0d8' };
/** The mark's name on a monster. */
export const MARK_NAME: Record<Element, string> = { water: 'เปียก', fire: 'ติดไฟ', poison: 'ติดพิษ', lightning: 'ช็อต', wind: 'ลมพัด' };

/** Every pair of two different elements, as a sorted key. */
export const REACTIONS = [
  'water+lightning', 'water+fire', 'water+wind', 'water+poison',
  'fire+wind', 'fire+poison', 'fire+lightning',
  'poison+wind', 'poison+lightning', 'lightning+wind',
] as const;
export type ReactionId = (typeof REACTIONS)[number];
export const REACTION_NAME: Record<ReactionId, string> = {
  'water+lightning': 'ไฟฟ้าลาม',
  'water+fire': 'ไอน้ำระเบิด',
  'water+wind': 'แช่แข็ง',
  'water+poison': 'แช่พิษ',
  'fire+wind': 'พายุเพลิง',
  'fire+poison': 'ระเบิดพิษ',
  'fire+lightning': 'ระเบิดพลาสมา',
  'poison+wind': 'หมอกพิษลาม',
  'poison+lightning': 'ประสาทชา',
  'lightning+wind': 'พายุฟ้าคะนอง',
};

/** The reaction of two elements (order doesn't matter), or null for the same element twice. */
export function reactionOf(a: Element, b: Element): ReactionId | null {
  if (a === b) return null;
  return (REACTIONS as readonly string[]).find((k) => k === `${a}+${b}` || k === `${b}+${a}`) as ReactionId | undefined ?? null;
}

/**
 * One reaction, all in one shape: `dmg` % ATK at once, to every monster within `r` metres of the target (0 = the target
 * only); `stun` seconds; `slow` % slower for `slowSec` seconds; `dot` % ATK a second for `dotSec` seconds; `kb` metres
 * of knockback away from the target. `boss` off = bosses are left out of it.
 */
export interface ReactionCfg { on: boolean; boss: boolean; dmg: number; r: number; stun: number; slow: number; slowSec: number; dot: number; dotSec: number; kb: number }
export const REACTION_KEYS = ['dmg', 'r', 'stun', 'slow', 'slowSec', 'dot', 'dotSec', 'kb'] as const;
export type ReactionNum = (typeof REACTION_KEYS)[number];
export const REACTION_RANGE: Record<ReactionNum, readonly [number, number]> = {
  dmg: [0, 1000], r: [0, 10], stun: [0, 5], slow: [0, 90], slowSec: [0, 10], dot: [0, 200], dotSec: [0, 20], kb: [0, 10],
};
export const REACTION_NUM_NAME: Record<ReactionNum, string> = {
  dmg: 'ดาเมจ (% ATK)', r: 'รัศมี (ม., 0 = ตัวเดียว)', stun: 'สตัน (วิ)', slow: 'ช้าลง (%)', slowSec: 'ช้านาน (วิ)', dot: 'ดาเมจต่อวิ (% ATK)', dotSec: 'นาน (วิ)', kb: 'ผลัก (ม.)',
};

/** The small effect of each element's mark: water slow %, fire / poison % ATK a second, lightning damage taken +%, wind knockback metres. */
export interface MarkCfg { water: number; fire: number; poison: number; lightning: number; wind: number }
export const MARK_EFFECT_NAME: Record<Element, string> = {
  water: 'น้ำ: ช้าลง (%)', fire: 'ไฟ: ดาเมจต่อวิ (% ATK)', poison: 'พิษ: ดาเมจต่อวิ (% ATK)', lightning: 'สายฟ้า: รับดาเมจเพิ่ม (%)', wind: 'ลม: ผลัก (ม.)',
};
const MARK_RANGE: Record<Element, readonly [number, number]> = { water: [0, 90], fire: [0, 200], poison: [0, 200], lightning: [0, 200], wind: [0, 10] };

export interface ElementConfig {
  on: boolean;
  /** Seconds a mark stays. */
  markSec: number;
  /**
   * Seconds before the same monster can have the same reaction again (each reaction its own timer), and the seconds after
   * any reaction in which that monster takes no new mark (owner 2026-11-27: 1 s).
   */
  reactCd: number;
  mark: MarkCfg;
  reactions: Record<ReactionId, ReactionCfg>;
  /** Each skill's element, by skill id (missing = none). */
  skill: Record<string, SkillElement>;
}

export interface ElementTuning {
  on?: boolean;
  markSec?: number;
  reactCd?: number;
  mark?: Partial<MarkCfg>;
  reactions?: Partial<Record<ReactionId, Partial<ReactionCfg>>>;
  /** Skills whose element differs from the code ('none' included). */
  skill?: Record<string, SkillElement>;
}

export const ELEMENT_RANGE = { markSec: [0.5, 30], reactCd: [0, 30] } as const;

const W: Element = 'water', F: Element = 'fire', P: Element = 'poison', L: Element = 'lightning', A: Element = 'wind';
/**
 * The owner's table (2026-11-27). Basic attacks, dashes, passives and self buffs have none. Gunslinger buffs that change
 * the basic shot (hot / shock rounds, split shot, bullet storm) give it their element while they run.
 */
export const CODE_SKILL_ELEMENT: Record<string, Element> = {
  // Sword
  whirlwind: A, sw_swordwave: A, sw_flurry: A, sw_bladering: A, sw_hunt: A, sw_spindodge: A, sw_bladedance: A, sw_thousandcuts: A,
  sw_heavyslash: F, sw_crush: F, charge: F, sw_triple: F,
  sw_execute: L, sw_unleash: L, sw_judgement: L, earthquake: L, sw_armorbash: L,
  sw_backstep: W, sw_shockwave: W, sw_cataclysm: W,
  sw_sunder: P, sw_shadowstep: P, sw_shadowswap: P,
  // Mage
  fireball: F, mg_flamewave: F, meteor: F, mg_flameground: F, mg_searingmark: F, mg_cursedash: F, mg_firerain: F,
  mg_arcanelance: L, mg_chainlightning: L, mg_volatileorb: L, mg_chargedblast: L, mg_starfall: L, mg_thunderstorm: L,
  mg_crystalrain: W, frostnova: W, mg_icecage: W, mg_sealveil: W, mg_timewarp: W, mg_manawell: W,
  mg_poisonmist: P, mg_decayring: P, mg_crystalspikes: P, mg_hexseed: P, mg_decayfield: P, mg_frailcurse: P,
  mg_manaburst: A, mg_forcewave: A, mg_gravitywell: A,
  // Gunslinger
  gs_finisher: F, headshot: F, rapidfire: F, gs_hotrounds: F, gs_explosive: F, gs_incendiary: F, gs_seeker: F, gs_cluster: F, gs_rocketrain: F,
  pierce: L, gs_ricochet: L, gs_lockon: L, gs_shockrounds: L, gs_mine: L, gs_railgun: L, gs_drone: L,
  gs_aimedshot: A, gs_counter: A, gs_splitshot: A, gs_bulletstorm: A,
  gs_weakspot: P, gs_smoke: P,
  gs_deadeye: W,
};

const r = (dmg: number, rad: number, stun: number, dot: number, dotSec: number, kb: number, more: Partial<ReactionCfg> = {}): ReactionCfg =>
  ({ on: true, boss: true, dmg, r: rad, stun, slow: 0, slowSec: 0, dot, dotSec, kb, ...more });

export function codeElements(): ElementConfig {
  return {
    on: true,
    markSec: 4,
    reactCd: 1,
    mark: { water: 15, fire: 10, poison: 8, lightning: 10, wind: 1 },
    reactions: {
      // Owner 2026-11-27 (second pass): no stun on Electrocute, Freeze slows instead of stunning, Numbing Shock 0.5 s and never on bosses.
      'water+lightning': r(120, 4, 0, 0, 0, 0),
      'water+fire': r(150, 3, 0, 0, 0, 0),
      'water+wind': r(0, 0, 0, 0, 0, 0, { slow: 50, slowSec: 1 }),
      'water+poison': r(0, 0, 0, 16, 5, 0),
      'fire+wind': r(0, 4, 0, 10, 4, 0),
      'fire+poison': r(200, 0, 0, 0, 0, 0),
      'fire+lightning': r(130, 3, 0, 0, 0, 0),
      'poison+wind': r(0, 4, 0, 8, 4, 0),
      'poison+lightning': r(0, 0, 0.5, 0, 0, 0, { boss: false }),
      'lightning+wind': r(100, 3, 0, 0, 0, 3),
    },
    skill: { ...CODE_SKILL_ELEMENT },
  };
}
const CODE = codeElements();

export function mergeElements(t: ElementTuning | undefined): ElementConfig {
  const c = codeElements();
  if (!t) return c;
  if (typeof t.on === 'boolean') c.on = t.on;
  if (t.markSec !== undefined) c.markSec = t.markSec;
  if (t.reactCd !== undefined) c.reactCd = t.reactCd;
  Object.assign(c.mark, t.mark);
  for (const k of REACTIONS) Object.assign(c.reactions[k], t.reactions?.[k]);
  for (const [id, e] of Object.entries(t.skill ?? {})) {
    if (e === 'none') delete c.skill[id];
    else c.skill[id] = e;
  }
  return c;
}

/** A skill's element with this config ('none' when it has none). */
export function skillElement(cfg: ElementConfig, id: string): SkillElement {
  return cfg.skill[id] ?? 'none';
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const num = (v: unknown, [lo, hi]: readonly [number, number]): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? round3(v) : null;

/**
 * Checks `SkillTuning.elements`: strict = errors for anything wrong, else wrong entries are dropped. Values equal to the
 * code are left out. `skillIds` = the skill ids an element may be set on (every class skill but passives).
 */
export function checkElements(x: unknown, strict: boolean, skillIds: ReadonlySet<string>): { tuning: ElementTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าระบบธาตุไม่ถูกต้อง' } : { tuning: undefined };
  const TOP = ['on', 'markSec', 'reactCd', 'mark', 'reactions', 'skill'];
  if (strict) {
    const extra = Object.keys(x).find((k) => !TOP.includes(k));
    if (extra) return { error: `ระบบธาตุ: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: ElementTuning = {};
  if (x.on !== undefined) {
    if (typeof x.on !== 'boolean') {
      if (strict) return { error: 'สวิตช์ระบบธาตุต้องเป็นเปิด/ปิด' };
    } else if (x.on !== CODE.on) out.on = x.on;
  }
  for (const k of ['markSec', 'reactCd'] as const) {
    if (x[k] === undefined) continue;
    const n = num(x[k], ELEMENT_RANGE[k]);
    if (n === null) {
      if (strict) return { error: `ระบบธาตุ: ${k === 'markSec' ? 'ป้ายธาตุอยู่นาน' : 'ปฏิกิริยาซ้ำได้ทุก'} ต้องอยู่ระหว่าง ${ELEMENT_RANGE[k][0]} ถึง ${ELEMENT_RANGE[k][1]} วิ` };
      continue;
    }
    if (n !== CODE[k]) out[k] = n;
  }
  if (x.mark !== undefined) {
    if (!isObj(x.mark)) {
      if (strict) return { error: 'ค่าป้ายธาตุไม่ถูกต้อง' };
    } else {
      const m: Partial<MarkCfg> = {};
      for (const [k, v] of Object.entries(x.mark)) {
        if (!(ELEMENTS as readonly string[]).includes(k)) {
          if (strict) return { error: `ป้ายธาตุ: ไม่รู้จัก "${k.slice(0, 20)}"` };
          continue;
        }
        const e = k as Element;
        const n = num(v, MARK_RANGE[e]);
        if (n === null) {
          if (strict) return { error: `${MARK_EFFECT_NAME[e]} ต้องอยู่ระหว่าง ${MARK_RANGE[e][0]} ถึง ${MARK_RANGE[e][1]}` };
          continue;
        }
        if (n !== CODE.mark[e]) m[e] = n;
      }
      if (Object.keys(m).length) out.mark = m;
    }
  }
  if (x.reactions !== undefined) {
    if (!isObj(x.reactions)) {
      if (strict) return { error: 'ค่าปฏิกิริยาธาตุไม่ถูกต้อง' };
    } else {
      const rs: Partial<Record<ReactionId, Partial<ReactionCfg>>> = {};
      for (const [k, v] of Object.entries(x.reactions)) {
        if (!(REACTIONS as readonly string[]).includes(k) || !isObj(v)) {
          if (strict) return { error: `ปฏิกิริยาธาตุ: ไม่รู้จัก "${k.slice(0, 20)}"` };
          continue;
        }
        const id = k as ReactionId;
        const one: Partial<ReactionCfg> = {};
        for (const [f, fv] of Object.entries(v)) {
          if (f === 'on' || f === 'boss') {
            if (typeof fv !== 'boolean') {
              if (strict) return { error: `${REACTION_NAME[id]}: สวิตช์ต้องเป็นเปิด/ปิด` };
              continue;
            }
            if (fv !== CODE.reactions[id][f]) one[f] = fv;
            continue;
          }
          if (!(REACTION_KEYS as readonly string[]).includes(f)) {
            if (strict) return { error: `${REACTION_NAME[id]}: ไม่รู้จักค่า "${f.slice(0, 20)}"` };
            continue;
          }
          const nk = f as ReactionNum;
          const n = num(fv, REACTION_RANGE[nk]);
          if (n === null) {
            if (strict) return { error: `${REACTION_NAME[id]} ${REACTION_NUM_NAME[nk]} ต้องอยู่ระหว่าง ${REACTION_RANGE[nk][0]} ถึง ${REACTION_RANGE[nk][1]}` };
            continue;
          }
          if (n !== CODE.reactions[id][nk]) one[nk] = n;
        }
        if (Object.keys(one).length) rs[id] = one;
      }
      if (Object.keys(rs).length) out.reactions = rs;
    }
  }
  if (x.skill !== undefined) {
    if (!isObj(x.skill)) {
      if (strict) return { error: 'ธาตุของสกิลไม่ถูกต้อง' };
    } else {
      const sk: Record<string, SkillElement> = {};
      for (const [id, v] of Object.entries(x.skill)) {
        if (!skillIds.has(id) || !(SKILL_ELEMENTS as readonly unknown[]).includes(v)) {
          if (strict) return { error: `ธาตุของสกิล "${id.slice(0, 20)}" ไม่ถูกต้อง` };
          continue;
        }
        if (v !== (CODE.skill[id] ?? 'none')) sk[id] = v as SkillElement;
      }
      if (Object.keys(sk).length) out.skill = sk;
    }
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two configs. `name` turns a skill id into its Thai name. */
export function elementChanges(a: ElementConfig, b: ElementConfig, name: (id: string) => string): string[] {
  const out: string[] = [];
  const onOff = (v: boolean) => (v ? 'เปิด' : 'ปิด');
  if (a.on !== b.on) out.push(`ระบบธาตุ ${onOff(a.on)} → ${onOff(b.on)}`);
  if (a.markSec !== b.markSec) out.push(`ระบบธาตุ: ป้ายธาตุอยู่นาน ${a.markSec} → ${b.markSec} วิ`);
  if (a.reactCd !== b.reactCd) out.push(`ระบบธาตุ: ปฏิกิริยาซ้ำได้ทุก ${a.reactCd} → ${b.reactCd} วิ`);
  for (const e of ELEMENTS) if (a.mark[e] !== b.mark[e]) out.push(`ป้ายธาตุ ${MARK_EFFECT_NAME[e]} ${a.mark[e]} → ${b.mark[e]}`);
  for (const k of REACTIONS) {
    const x = a.reactions[k];
    const y = b.reactions[k];
    if (x.on !== y.on) out.push(`ปฏิกิริยา ${REACTION_NAME[k]} ${onOff(x.on)} → ${onOff(y.on)}`);
    if (x.boss !== y.boss) out.push(`ปฏิกิริยา ${REACTION_NAME[k]} ใช้กับบอส ${onOff(x.boss)} → ${onOff(y.boss)}`);
    for (const f of REACTION_KEYS) if (x[f] !== y[f]) out.push(`ปฏิกิริยา ${REACTION_NAME[k]} ${REACTION_NUM_NAME[f]} ${x[f]} → ${y[f]}`);
  }
  for (const id of new Set([...Object.keys(a.skill), ...Object.keys(b.skill)])) {
    const x = a.skill[id] ?? 'none';
    const y = b.skill[id] ?? 'none';
    if (x !== y) out.push(`ธาตุของสกิล ${name(id)} ${ELEMENT_NAME[x]} → ${ELEMENT_NAME[y]}`);
  }
  return out;
}
