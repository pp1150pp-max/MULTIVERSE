// Auto Play numbers and switches the owner (and GMs, if allowed) tune on the /admin "ปรับสมดุล" tab
// (owner 2026-11-13): the defaults of the player's Auto options, how long Auto chases a drop it can't get,
// the "balanced" loot order's distances, and server-wide switches that turn player options off.
// Saved inside the balance tuning (`BalanceTuning.auto`), only what differs from the code.

/** When Auto picks up drops. 'fight' = kill whatever attacks first; 'balanced' = the old way; 'loot' = drops first. */
export type AutoLootOrder = 'fight' | 'balanced' | 'loot';
export const AUTO_LOOT_ORDERS: readonly AutoLootOrder[] = ['fight', 'balanced', 'loot'];
export const AUTO_LOOT_ORDER_NAME: Record<AutoLootOrder, string> = { fight: 'ตีก่อน', balanced: 'สมดุล (แบบเดิม)', loot: 'เก็บของก่อน' };

/** What Auto does when HP potions / MP potions run out or the bag is full. */
export type AutoOutAction = 'fight' | 'stop' | 'scroll';
export const AUTO_OUT_ACTIONS: readonly AutoOutAction[] = ['fight', 'stop', 'scroll'];
export const AUTO_OUT_ACTION_NAME: Record<AutoOutAction, string> = { fight: 'สู้ต่อ', stop: 'หยุด Auto', scroll: 'ม้วนกลับเมือง' };

/** Which monster Auto goes for. 'attacker' = those attacking the player first, then the nearest; 'near' = the nearest. */
export type AutoTargetMode = 'attacker' | 'near';
export const AUTO_TARGET_MODES: readonly AutoTargetMode[] = ['attacker', 'near'];
export const AUTO_TARGET_NAME: Record<AutoTargetMode, string> = { attacker: 'ตัวที่ตีเราก่อน', near: 'ใกล้สุด' };

/** The new Auto options of a character that hasn't saved them (see AutoSettings in sim/Player.ts). */
export interface AutoDefaults {
  lootOrder: AutoLootOrder;
  /** Also pick up other players' drops once their 10 s priority is over. */
  othersLoot: boolean;
  noHp: AutoOutAction;
  noMp: AutoOutAction;
  bagFull: AutoOutAction;
  target: AutoTargetMode;
  /** Skills only: Auto never uses the basic attack and waits for a skill instead (owner 2026-11-22). */
  skillsOnly: boolean;
}

/** Server-wide switches: an option switched off can't be chosen, and Auto uses the safe one instead. */
export type AutoAllow = 'lootFirst' | 'othersLoot' | 'scroll' | 'skip';
export const AUTO_ALLOWS: readonly AutoAllow[] = ['lootFirst', 'othersLoot', 'scroll', 'skip'];
export const AUTO_ALLOW_NAME: Record<AutoAllow, string> = {
  lootFirst: 'ลำดับ "เก็บของก่อน"',
  othersLoot: 'เก็บของคนอื่น',
  scroll: 'ใช้ม้วนกลับเมืองอัตโนมัติ',
  skip: 'ติ๊กชนิดมอนที่ไม่ตี',
};

export interface AutoConfig {
  defaults: AutoDefaults;
  /** Seconds Auto walks after one drop without getting it before it skips that drop. */
  giveUpSec: number;
  /** "Balanced": drops this close are fetched even mid-fight. */
  nearDist: number;
  /** "Balanced": a hostile monster this close counts as attacking. */
  threatDist: number;
  allow: Record<AutoAllow, boolean>;
  /**
   * Keep farming after a dropped connection (owner 2026-11-17): a non-guest whose connection drops
   * while Auto is on stays in the world with Auto on for up to `offlineMin` minutes (server/world.ts).
   */
  offline: boolean;
  /** Minutes Auto keeps farming after a dropped connection. */
  offlineMin: number;
  /**
   * Nothing to fight in the circle (owner 2026-11-19): true = go back to the spot where Auto was switched on and
   * stand still there; false = the old way, walk to a monster spawn spot inside the circle.
   */
  homeWait: boolean;
  /**
   * Auto casts a skill only when it would reach (AutoPlay.inReach): a circle around the player needs a monster
   * inside it (mage, owner 2026-11-19), and every other skill of every class needs the target within its reach
   * (owner 2026-11-20); otherwise the next skill in the order goes. Off = cast as soon as the basic attack reaches.
   */
  aoeGuard: boolean;
  /** Safety metres taken off a skill's reach for that check, so the monster is well inside it (owner 2026-11-20; it used to be added). */
  aoeMargin: number;
  /**
   * Stones, boxes, keys, scrolls, cards and any kind without a loot-filter setting (Loot.isPriorityLoot) are fetched first,
   * even mid-fight and whatever the player's loot order (owner 2026-11-25). Off = they follow the loot order like the rest.
   */
  priorityLoot: boolean;
  /** How far (units) Auto goes for those mid-fight; 0 = anywhere in its circle (the code's). */
  priorityDist: number;
  /** Default seconds Auto waits after casting one skill before it casts the next (owner 2026-11-22; 0 = no wait). Players can set their own. */
  skillGap: number;
  /**
   * The "while you were away" summary (owner 2026-11-27, src/client/autoSummary.ts): with Auto on and the game not
   * touched for `summaryMin` minutes, a window counts what Auto earned until the player closes it.
   */
  summary: boolean;
  summaryMin: number;
  /** The newest pieces of gear the summary keeps as pictures per Auto run (owner 2026-11-28); more = a "+N" cell. */
  summaryGear: number;
}

/** What is saved: only what differs from the code. */
export interface AutoTuning {
  defaults?: Partial<AutoDefaults>;
  giveUpSec?: number;
  nearDist?: number;
  threatDist?: number;
  allow?: Partial<Record<AutoAllow, boolean>>;
  offline?: boolean;
  offlineMin?: number;
  homeWait?: boolean;
  aoeGuard?: boolean;
  aoeMargin?: number;
  skillGap?: number;
  priorityLoot?: boolean;
  priorityDist?: number;
  summary?: boolean;
  summaryMin?: number;
  summaryGear?: number;
}

export const AUTO_RANGE = {
  giveUpSec: [1, 30],
  nearDist: [1, 20],
  threatDist: [1, 15],
  offlineMin: [1, 240],
  aoeMargin: [0, 3],
  skillGap: [0, 2],
  priorityDist: [0, 60],
  summaryMin: [1, 60],
  summaryGear: [10, 500],
} as const satisfies Record<string, readonly [number, number]>;
export const AUTO_NUM_NAME: Record<keyof typeof AUTO_RANGE, string> = {
  giveUpSec: 'Auto ข้ามของที่เก็บไม่ได้หลัง (วิ)',
  nearDist: 'Auto สมดุล: ระยะของใกล้ตัว',
  threatDist: 'Auto สมดุล: ระยะนับว่าโดนตี',
  offlineMin: 'Auto ฟาร์มต่อหลังหลุดได้นาน (นาที)',
  aoeMargin: 'Auto ระยะสกิล: หักระยะเผื่อพลาด (ม.)',
  skillGap: 'Auto เว้นระหว่างสกิล ค่าเริ่มต้น (วิ)',
  priorityDist: 'Auto เก็บก่อน: ระยะสูงสุด (0 = ทั้งวง Auto)',
  summaryMin: 'หน้าสรุป Auto ขึ้นเมื่อไม่แตะเกม (นาที)',
  summaryGear: 'หน้าสรุป Auto: เก็บภาพอุปกรณ์สูงสุด (ชิ้นต่อรอบ)',
};
/** Name of the "while you were away" summary switch. */
export const AUTO_SUMMARY_NAME = 'หน้าสรุปผล Auto ตอนไม่แตะเกม';
/** Name of the "keep farming after a dropped connection" switch. */
/** Name of the "only cast a skill that reaches" switch (key `aoeGuard`, kept from the mage-only version). */
export const AUTO_AOE_GUARD_NAME = 'Auto กดสกิลเมื่อสกิลถึงเป้าเท่านั้น (ทุกอาชีพ)';
/** Name of the "fetch stones / boxes / cards first" switch. */
export const AUTO_PRIORITY_LOOT_NAME = 'Auto เก็บหิน กล่อง กุญแจ ม้วน การ์ด (ของที่ไม่มีตัวกรอง ไม่รวมทอง) ก่อนเสมอ แม้มอนตีอยู่';
export const AUTO_OFFLINE_NAME = 'Auto ฟาร์มต่อหลังหลุดการเชื่อมต่อ (ไม่ใช่ Guest)';
/** Name of the "no monster in the circle = wait at the Auto start spot" switch. */
export const AUTO_HOME_WAIT_NAME = 'ไม่มีมอนในวง = กลับไปรอที่จุดกด Auto';
const NUMS = Object.keys(AUTO_RANGE) as (keyof typeof AUTO_RANGE)[];

/** The code's own Auto numbers (a fresh copy). */
export function codeAuto(): AutoConfig {
  return {
    defaults: { lootOrder: 'fight', othersLoot: true, noHp: 'fight', noMp: 'fight', bagFull: 'fight', target: 'attacker', skillsOnly: false },
    giveUpSec: 4,
    nearDist: 5,
    threatDist: 3.5,
    allow: { lootFirst: true, othersLoot: true, scroll: true, skip: true },
    offline: true,
    offlineMin: 30,
    homeWait: true,
    aoeGuard: true,
    aoeMargin: 0.5,
    skillGap: 0.3,
    priorityLoot: true,
    priorityDist: 0,
    summary: true,
    summaryMin: 3,
    summaryGear: 100,
  };
}
const CODE = codeAuto();

export function mergeAuto(t: AutoTuning | undefined): AutoConfig {
  const c = codeAuto();
  if (!t) return c;
  Object.assign(c.defaults, t.defaults);
  for (const k of NUMS) if (t[k] !== undefined) c[k] = t[k]!;
  Object.assign(c.allow, t.allow);
  if (t.offline !== undefined) c.offline = t.offline;
  if (t.homeWait !== undefined) c.homeWait = t.homeWait;
  if (t.aoeGuard !== undefined) c.aoeGuard = t.aoeGuard;
  if (t.priorityLoot !== undefined) c.priorityLoot = t.priorityLoot;
  if (t.summary !== undefined) c.summary = t.summary;
  return c;
}

const DEFAULT_CHOICES: { [K in keyof AutoDefaults]: readonly AutoDefaults[K][] } = {
  lootOrder: AUTO_LOOT_ORDERS,
  othersLoot: [true, false],
  noHp: AUTO_OUT_ACTIONS,
  noMp: AUTO_OUT_ACTIONS,
  bagFull: AUTO_OUT_ACTIONS,
  target: AUTO_TARGET_MODES,
  skillsOnly: [false, true],
};
/** The options that have a server default (and a player's own pick, AutoSettings.optsSet). */
export const AUTO_DEFAULT_KEYS = Object.keys(DEFAULT_CHOICES) as (keyof AutoDefaults)[];
const DEFAULT_KEYS = AUTO_DEFAULT_KEYS;
export const AUTO_DEFAULT_NAME: Record<keyof AutoDefaults, string> = {
  lootOrder: 'ลำดับเก็บของ', othersLoot: 'เก็บของคนอื่น', noHp: 'ยา HP หมด', noMp: 'ยา MP หมด', bagFull: 'กระเป๋าเต็ม', target: 'เป้าหมาย', skillsOnly: 'วิธีตี',
};
/** Thai name of one default's value. */
export function autoDefaultValueName(k: keyof AutoDefaults, v: unknown): string {
  if (k === 'lootOrder') return AUTO_LOOT_ORDER_NAME[v as AutoLootOrder] ?? String(v);
  if (k === 'othersLoot') return v ? 'เก็บของคนอื่นด้วย' : 'เก็บเฉพาะของตัวเอง';
  if (k === 'skillsOnly') return v ? 'ใช้สกิลอย่างเดียว' : 'ตีธรรมดา + สกิล';
  if (k === 'target') return AUTO_TARGET_NAME[v as AutoTargetMode] ?? String(v);
  return AUTO_OUT_ACTION_NAME[v as AutoOutAction] ?? String(v);
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Checks the `auto` part of a balance tuning (see checkBalance): strict = errors for anything wrong,
 * else wrong entries are dropped. Values equal to the code are left out. Returns the clean tuning
 * (undefined = nothing differs) or a Thai error.
 */
export function checkAutoTuning(x: unknown, strict: boolean): { tuning: AutoTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่า Auto ไม่ถูกต้อง' } : { tuning: undefined };
  const TOP = ['defaults', ...NUMS, 'allow', 'offline', 'homeWait', 'aoeGuard', 'priorityLoot', 'summary'];
  if (strict) {
    const extra = Object.keys(x).find((k) => !TOP.includes(k));
    if (extra) return { error: `Auto: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: AutoTuning = {};
  if (x.defaults !== undefined) {
    if (!isObj(x.defaults)) {
      if (strict) return { error: 'ค่าเริ่มต้นของ Auto ไม่ถูกต้อง' };
    } else {
      const g = x.defaults;
      if (strict) {
        const extra = Object.keys(g).find((k) => !(DEFAULT_KEYS as string[]).includes(k));
        if (extra) return { error: `ค่าเริ่มต้น Auto: ไม่รู้จัก "${extra.slice(0, 20)}"` };
      }
      const d: Partial<AutoDefaults> = {};
      for (const k of DEFAULT_KEYS) {
        const v = g[k];
        if (v === undefined) continue;
        if (!(DEFAULT_CHOICES[k] as readonly unknown[]).includes(v)) {
          if (strict) return { error: `ค่าเริ่มต้น Auto "${AUTO_DEFAULT_NAME[k]}" ไม่ถูกต้อง` };
          continue;
        }
        if (v !== CODE.defaults[k]) (d as Record<string, unknown>)[k] = v;
      }
      if (Object.keys(d).length) out.defaults = d;
    }
  }
  for (const k of NUMS) {
    const v = x[k];
    if (v === undefined) continue;
    const [lo, hi] = AUTO_RANGE[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) {
      if (strict) return { error: `${AUTO_NUM_NAME[k]} ต้องอยู่ระหว่าง ${lo} ถึง ${hi}` };
      continue;
    }
    const n = round3(v);
    if (n !== CODE[k]) out[k] = n;
  }
  if (x.allow !== undefined) {
    if (!isObj(x.allow)) {
      if (strict) return { error: 'สวิตช์ Auto ไม่ถูกต้อง' };
    } else {
      const g = x.allow;
      if (strict) {
        const extra = Object.keys(g).find((k) => !(AUTO_ALLOWS as readonly string[]).includes(k));
        if (extra) return { error: `สวิตช์ Auto: ไม่รู้จัก "${extra.slice(0, 20)}"` };
      }
      const a: Partial<Record<AutoAllow, boolean>> = {};
      for (const k of AUTO_ALLOWS) {
        const v = g[k];
        if (v === undefined) continue;
        if (typeof v !== 'boolean') {
          if (strict) return { error: `สวิตช์ Auto "${AUTO_ALLOW_NAME[k]}" ต้องเป็นเปิด/ปิด` };
          continue;
        }
        if (v !== CODE.allow[k]) a[k] = v;
      }
      if (Object.keys(a).length) out.allow = a;
    }
  }
  if (x.offline !== undefined) {
    if (typeof x.offline !== 'boolean') {
      if (strict) return { error: `${AUTO_OFFLINE_NAME} ต้องเป็นเปิด/ปิด` };
    } else if (x.offline !== CODE.offline) out.offline = x.offline;
  }
  if (x.homeWait !== undefined) {
    if (typeof x.homeWait !== 'boolean') {
      if (strict) return { error: `${AUTO_HOME_WAIT_NAME} ต้องเป็นเปิด/ปิด` };
    } else if (x.homeWait !== CODE.homeWait) out.homeWait = x.homeWait;
  }
  if (x.aoeGuard !== undefined) {
    if (typeof x.aoeGuard !== 'boolean') {
      if (strict) return { error: `${AUTO_AOE_GUARD_NAME} ต้องเป็นเปิด/ปิด` };
    } else if (x.aoeGuard !== CODE.aoeGuard) out.aoeGuard = x.aoeGuard;
  }
  if (x.priorityLoot !== undefined) {
    if (typeof x.priorityLoot !== 'boolean') {
      if (strict) return { error: `${AUTO_PRIORITY_LOOT_NAME} ต้องเป็นเปิด/ปิด` };
    } else if (x.priorityLoot !== CODE.priorityLoot) out.priorityLoot = x.priorityLoot;
  }
  if (x.summary !== undefined) {
    if (typeof x.summary !== 'boolean') {
      if (strict) return { error: `${AUTO_SUMMARY_NAME} ต้องเป็นเปิด/ปิด` };
    } else if (x.summary !== CODE.summary) out.summary = x.summary;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two Auto configs. */
export function autoChanges(a: AutoConfig, b: AutoConfig): string[] {
  const out: string[] = [];
  for (const k of DEFAULT_KEYS) {
    if (a.defaults[k] !== b.defaults[k]) out.push(`Auto ค่าเริ่มต้น ${AUTO_DEFAULT_NAME[k]} ${autoDefaultValueName(k, a.defaults[k])} → ${autoDefaultValueName(k, b.defaults[k])}`);
  }
  for (const k of NUMS) if (a[k] !== b[k]) out.push(`${AUTO_NUM_NAME[k]} ${a[k]} → ${b[k]}`);
  for (const k of AUTO_ALLOWS) {
    if (a.allow[k] !== b.allow[k]) out.push(`Auto ${AUTO_ALLOW_NAME[k]} ${a.allow[k] ? 'เปิด' : 'ปิด'} → ${b.allow[k] ? 'เปิด' : 'ปิด'}`);
  }
  if (a.offline !== b.offline) out.push(`${AUTO_OFFLINE_NAME} ${a.offline ? 'เปิด' : 'ปิด'} → ${b.offline ? 'เปิด' : 'ปิด'}`);
  if (a.homeWait !== b.homeWait) out.push(`${AUTO_HOME_WAIT_NAME} ${a.homeWait ? 'เปิด' : 'ปิด'} → ${b.homeWait ? 'เปิด' : 'ปิด'}`);
  if (a.priorityLoot !== b.priorityLoot) out.push(`${AUTO_PRIORITY_LOOT_NAME} ${a.priorityLoot ? 'เปิด' : 'ปิด'} → ${b.priorityLoot ? 'เปิด' : 'ปิด'}`);
  if (a.aoeGuard !== b.aoeGuard) out.push(`${AUTO_AOE_GUARD_NAME} ${a.aoeGuard ? 'เปิด' : 'ปิด'} → ${b.aoeGuard ? 'เปิด' : 'ปิด'}`);
  if (a.summary !== b.summary) out.push(`${AUTO_SUMMARY_NAME} ${a.summary ? 'เปิด' : 'ปิด'} → ${b.summary ? 'เปิด' : 'ปิด'}`);
  return out;
}
