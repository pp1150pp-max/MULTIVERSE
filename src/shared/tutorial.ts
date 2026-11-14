// System tutorial quests (owner 2026-11-14, docs/systems/tutorial-quests.md): one chain, step by step, each
// given by the NPC who runs that system (merchant → keeper → blacksmith ×2 → broker). Each step asks the
// player to really use the system once; taking a step gives gold now (and the stones the reroll step needs),
// handing it in mails a reward, everything bound to the character. Once per account: the state is the
// account's, shared by its characters, and a step one character took can't be taken by another.
// One place for the rules, so the NPC marks, the talk window, the quest tracker and Sim never disagree.
import type { NpcId } from './data/npcs';
import { POTION_SIZES } from './data/potions';
import { describeAttach, type MailAttach, type MailAttachItem } from './mail';
import { STONE_KINDS, isQuestKey, type StoneKind } from './types';

export type TutStep = 'shop' | 'stash' | 'enhance' | 'reroll' | 'market';
/** The chain, in order (owner): the next step opens once the one before is handed in. */
export const TUT_STEPS: readonly TutStep[] = ['shop', 'stash', 'enhance', 'reroll', 'market'];
export const TUT_STEP_NAME: Record<TutStep, string> = {
  shop: 'ร้านค้า', stash: 'คลังเก็บของ', enhance: 'ตีบวก', reroll: 'สุ่มค่า', market: 'ตลาดฝากขาย',
};
/** Who gives and takes each step. */
export const TUT_NPC: Record<TutStep, NpcId> = {
  shop: 'merchant', stash: 'keeper', enhance: 'blacksmith', reroll: 'blacksmith', market: 'broker',
};

/** One thing a step asks for, counted by the server when the action really happened (after taking the step). */
export type TutTask = 'buyPotion' | 'buyScroll' | 'sell' | 'stashItem' | 'stashGold' | 'enhance' | 'rerollValues' | 'rerollStat' | 'marketList';
export const TUT_TASKS: Record<TutStep, readonly TutTask[]> = {
  shop: ['buyPotion', 'buyScroll', 'sell'],
  stash: ['stashItem', 'stashGold'],
  enhance: ['enhance'],
  reroll: ['rerollValues', 'rerollStat'],
  market: ['marketList'],
};
export const TUT_TASK_NAME: Record<TutTask, string> = {
  buyPotion: 'ซื้อยา 1 ครั้ง',
  buyScroll: 'ซื้อม้วนคัมภีร์กลับเมือง 1 ครั้ง',
  sell: 'ขายของให้พ่อค้า 1 ชิ้น',
  stashItem: 'ฝากของเข้าคลัง 1 ชิ้น',
  stashGold: 'ฝากทองเข้าคลัง',
  enhance: 'ตีบวกอุปกรณ์ 1 ครั้ง (สำเร็จหรือล้มเหลวก็นับ)',
  rerollValues: 'สุ่มค่าตัวเลข 1 ครั้ง',
  rerollStat: 'สุ่มสเตตัส 1 ครั้ง',
  marketList: 'ลงขายของในตลาด 1 ชิ้น',
};
/** What the NPC says when offering the step. */
export const TUT_INTRO: Record<TutStep, string> = {
  shop: 'มือใหม่ใช่ไหม? ก่อนออกไปล่า ต้องรู้จักซื้อขายกับข้าก่อน ลองซื้อยา ซื้อม้วนคัมภีร์กลับเมือง แล้วขายของที่ไม่ใช้ให้ข้าสักชิ้นดู',
  stash: 'กระเป๋ามีที่จำกัด ของสำคัญและทองฝากไว้กับข้าได้ ตัวละครทุกตัวในบัญชีใช้คลังเดียวกัน ลองฝากของสักชิ้นและฝากทองดูสิ',
  enhance: 'อาวุธดีต้องตีบวก! เอาอุปกรณ์ชิ้นไหนก็ได้มาให้ข้าตีบวกสักครั้ง สำเร็จหรือล้มเหลวก็ไม่เป็นไร',
  reroll: 'ค่าบนอุปกรณ์ไม่ถูกใจ? ข้าสุ่มใหม่ได้ เอาหินที่ข้าให้ไปลองสุ่มค่าตัวเลขหนึ่งครั้ง และสุ่มสเตตัสอีกหนึ่งครั้ง กับอุปกรณ์ชิ้นไหนก็ได้',
  market: 'ของที่เหลือใช้ ฝากข้าขายให้ผู้เล่นคนอื่นได้ ลองลงขายของสักชิ้นในตลาด แล้วรับรางวัลใหญ่ไปเลย',
};

/** Gold given when taking any step (owner: 1,000 G each). */
export const TUT_ACCEPT_GOLD = 1000;
/** Stones given into the bag (bound) when taking a step, so it can be done (owner: the reroll step, one of each). */
export const TUT_ACCEPT_STONES: Partial<Record<TutStep, { stone: StoneKind; count: number }[]>> = {
  reroll: [{ stone: 'reroll_values', count: 1 }, { stone: 'reroll_stat', count: 1 }],
};

// ------------------------------------------------------------ rewards (tunable on /admin, see TutorialTuning)

/** Reward keys: each step's hand-in reward, and `final` for finishing the chain (sent with the last step's). */
export type TutRewardKey = TutStep | 'final';
export const TUT_REWARD_KEYS: readonly TutRewardKey[] = [...TUT_STEPS, 'final'];
export const TUT_REWARD_NAME: Record<TutRewardKey, string> = { ...TUT_STEP_NAME, final: 'จบสาย (ส่งพร้อมขั้นตลาด)' };

export type TutorialConfig = Record<TutRewardKey, MailAttach>;
/** What is saved: only the rewards that differ from the code, each one whole. */
export type TutorialTuning = Partial<Record<TutRewardKey, MailAttach>>;

/** The code's rewards (owner 2026-11-14), a fresh copy. Every item is given bound. */
export function codeTutorial(): TutorialConfig {
  return {
    shop: { gold: 0, items: [{ kind: 'potion', potion: 'hp', size: 's', count: 10 }, { kind: 'potion', potion: 'mp', size: 's', count: 10 }] },
    stash: { gold: 3000, items: [] },
    enhance: { gold: 0, items: [{ kind: 'stone', stone: 'protect', count: 1 }] },
    reroll: { gold: 0, items: [{ kind: 'stone', stone: 'reroll_values', count: 2 }, { kind: 'stone', stone: 'reroll_stat', count: 2 }] },
    market: { gold: 0, items: [] },
    final: { gold: 10000, items: [{ kind: 'stone', stone: 'exp_scroll', count: 1 }, { kind: 'stone', stone: 'drop_scroll', count: 1 }] },
  };
}
const CODE = codeTutorial();

export function mergeTutorial(t: TutorialTuning | undefined): TutorialConfig {
  const c = codeTutorial();
  if (!t) return c;
  for (const k of TUT_REWARD_KEYS) if (t[k]) c[k] = structuredClone(t[k]!);
  return c;
}

/** Limits of a reward on the admin page. */
export const TUT_GOLD_MAX = 1_000_000;
export const TUT_LINES_MAX = 6;
export const TUT_COUNT_MAX = 100;
/** Stone kinds a reward may give (not quest keys: those belong to The Seeker's boss quests). */
export const TUT_STONES: readonly StoneKind[] = STONE_KINDS.filter((k) => !isQuestKey(k));

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const sameAttach = (a: MailAttach, b: MailAttach) => JSON.stringify(a) === JSON.stringify(b);

/** One reward from a request, or a Thai error. */
function checkReward(x: unknown, name: string): MailAttach | string {
  if (!isObj(x)) return `รางวัล${name}ไม่ถูกต้อง`;
  const gold = x.gold ?? 0;
  if (typeof gold !== 'number' || !Number.isInteger(gold) || gold < 0 || gold > TUT_GOLD_MAX) return `ทองของรางวัล${name}ต้องเป็นจำนวนเต็ม 0–${TUT_GOLD_MAX.toLocaleString()}`;
  const list = x.items ?? [];
  if (!Array.isArray(list) || list.length > TUT_LINES_MAX) return `รางวัล${name}มีของได้ไม่เกิน ${TUT_LINES_MAX} รายการ`;
  const items: MailAttachItem[] = [];
  for (const it of list) {
    if (!isObj(it)) return `ของในรางวัล${name}ไม่ถูกต้อง`;
    const count = it.count;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > TUT_COUNT_MAX) return `จำนวนของในรางวัล${name}ต้องเป็น 1–${TUT_COUNT_MAX}`;
    if (it.kind === 'potion') {
      if ((it.potion !== 'hp' && it.potion !== 'mp') || !POTION_SIZES.includes(it.size as never)) return `ยาในรางวัล${name}ไม่ถูกต้อง`;
      items.push({ kind: 'potion', potion: it.potion, size: it.size as 's' | 'm' | 'l', count });
    } else if (it.kind === 'stone') {
      if (!TUT_STONES.includes(it.stone as StoneKind)) return `ของในรางวัล${name}ไม่ถูกต้อง`;
      items.push({ kind: 'stone', stone: it.stone as string, count });
    } else return `ของในรางวัล${name}ไม่ถูกต้อง`;
  }
  return { gold, items };
}

/**
 * Checks the `tutorial` part of a balance tuning: strict = errors for anything wrong, else wrong entries are
 * dropped. Rewards equal to the code are left out. Returns the clean tuning (undefined = nothing differs) or a Thai error.
 */
export function checkTutorialTuning(x: unknown, strict: boolean): { tuning: TutorialTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าเควสสอนระบบไม่ถูกต้อง' } : { tuning: undefined };
  if (strict) {
    const extra = Object.keys(x).find((k) => !(TUT_REWARD_KEYS as readonly string[]).includes(k));
    if (extra) return { error: `เควสสอนระบบ: ไม่รู้จัก "${extra.slice(0, 20)}"` };
  }
  const out: TutorialTuning = {};
  for (const k of TUT_REWARD_KEYS) {
    if (x[k] === undefined) continue;
    const r = checkReward(x[k], TUT_REWARD_NAME[k]);
    if (typeof r === 'string') {
      if (strict) return { error: r };
      continue;
    }
    if (!sameAttach(r, CODE[k])) out[k] = r;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** A reward as one line of Thai text ("ทอง 3,000 G, ยา HP เล็ก × 10"), or "ไม่มี". */
export function tutRewardText(a: MailAttach): string {
  const lines = describeAttach(a);
  return lines.length ? lines.join(', ') : 'ไม่มี';
}

/** Audit lines of what differs between two configs. */
export function tutorialChanges(a: TutorialConfig, b: TutorialConfig): string[] {
  return TUT_REWARD_KEYS.filter((k) => !sameAttach(a[k], b[k])).map((k) => `รางวัลเควสสอนระบบ ${TUT_REWARD_NAME[k]}: ${tutRewardText(a[k])} → ${tutRewardText(b[k])}`);
}

/** The reward mailed when a step is handed in, every item bound (the last step adds the chain's reward). */
export function tutTurnInReward(step: TutStep, cfg: TutorialConfig): MailAttach {
  const parts = step === TUT_STEPS[TUT_STEPS.length - 1] ? [cfg[step], cfg.final] : [cfg[step]];
  return {
    gold: parts.reduce((n, a) => n + a.gold, 0),
    items: parts.flatMap((a) => a.items).map((it) => (it.kind === 'equip' ? it : { ...it, bound: true as const })),
  };
}

// ------------------------------------------------------------ the account's progress

/** The step under way: which character took it (by name) and what it has done so far. */
export interface TutCur { step: TutStep; by: string; got: TutTask[] }
/**
 * One account's tutorial (saved in the `tutorials` table, shared by its characters online). `paid`: steps
 * whose accept gold (and stones) the account already got. When the character holding a step is deleted the
 * step opens again for the account's other characters, but taking it again pays nothing (owner 2026-11-14),
 * so deleting characters can't farm it.
 */
export interface TutorialData { done: TutStep[]; cur?: TutCur; paid?: TutStep[] }

const steps = (v: unknown): TutStep[] => (Array.isArray(v) ? [...new Set(v.filter((s): s is TutStep => TUT_STEPS.includes(s as TutStep)))] : []);

/** Read from storage: known steps and tasks only, so a broken or old row never breaks a login. */
export function cleanTutorial(raw: unknown): TutorialData {
  const r = isObj(raw) ? raw : {};
  const done = steps(r.done);
  const out: TutorialData = { done };
  const paid = steps(r.paid);
  if (paid.length) out.paid = paid;
  const c = r.cur;
  if (isObj(c) && TUT_STEPS.includes(c.step as TutStep) && !done.includes(c.step as TutStep) && typeof c.by === 'string' && c.by) {
    const step = c.step as TutStep;
    const got = Array.isArray(c.got) ? [...new Set(c.got.filter((t): t is TutTask => TUT_TASKS[step].includes(t as TutTask)))] : [];
    out.cur = { step, by: c.by, got };
  }
  return out;
}

/**
 * offer: this character can take it · going: taken by this character · ready: all done, hand it in ·
 * busy: another character of the account has it · done: handed in · locked: a step before isn't done.
 */
export type TutState = 'offer' | 'going' | 'ready' | 'busy' | 'done' | 'locked';
export interface TutRow { step: TutStep; npc: NpcId; state: TutState; got: readonly TutTask[] }

/** Every step as this character (`name`) sees it, in chain order. */
export function tutRows(t: TutorialData, name: string): TutRow[] {
  let open = true;
  return TUT_STEPS.map((step) => {
    const cur = t.cur?.step === step ? t.cur : undefined;
    const state: TutState = t.done.includes(step) ? 'done'
      : cur ? (cur.by !== name ? 'busy' : TUT_TASKS[step].every((k) => cur.got.includes(k)) ? 'ready' : 'going')
      : open && !t.cur ? 'offer' : 'locked';
    if (state !== 'done') open = false;
    return { step, npc: TUT_NPC[step], state, got: cur?.by === name ? cur.got : [] };
  });
}

/** The mark over an NPC from the tutorial: ? when one of its steps waits to be handed in, ! when it has one to give. */
export function tutMark(rows: readonly TutRow[], npc: NpcId): '?' | '!' | '' {
  const mine = rows.filter((r) => r.npc === npc);
  return mine.some((r) => r.state === 'ready') ? '?' : mine.some((r) => r.state === 'offer') ? '!' : '';
}
