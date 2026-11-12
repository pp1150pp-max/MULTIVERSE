// Daily login calendar (owner 2026-11-12, rules: docs/systems/daily-login.md). One calendar per month and
// account: the first time an account is in the game on a day (Thai time, the day turns at 00:00), that day's
// reward goes to the account's mailbox. A missed day is gone, except for DAILY_MAKEUPS free make-ups a
// month, which can pick any earlier day of this month. Guests have no calendar. Pure rules, no DOM.
import { BLACKSMITH_STONES, REWARD_ITEMS, type StoneKind } from './types';

/** Thailand is UTC+7 all year (no daylight saving), so the calendar day is just this offset. */
export const DAILY_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Free make-ups a month (owner: 3). */
export const DAILY_MAKEUPS = 3;
/** Most of one reward (a bag stack holds 10). */
export const DAILY_COUNT_MAX = 10;
/** The server setting that holds the owner's changes to the table (only days that differ from DAILY_DEFAULT). */
export const DAILY_SETTING = 'daily_rewards';
export const DAILY_GUEST_MSG = 'Guest ไม่มีปฏิทินล็อกอินรายวัน — สมัครสมาชิกเพื่อรับของทุกวัน';

/** What a day can give: the reward consumables and the blacksmith stones. */
export const DAILY_KINDS: StoneKind[] = [...REWARD_ITEMS, ...BLACKSMITH_STONES];

export interface DailyReward {
  stone: StoneKind;
  count: number;
}

/** A calendar day in Thai time. `key` is 'YYYY-MM-DD'. */
export interface DailyDate {
  year: number;
  month: number;
  day: number;
  key: string;
}

export function thaiDate(ms: number): DailyDate {
  const d = new Date(ms + DAILY_TZ_OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return { year, month, day, key: dayKey(year, month, day) };
}

export const dayKey = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** The owner's draft (2026-11-12): a weekly round of stones and items, more enhance stones on days 7/14/21/28. */
const r = (stone: StoneKind, count = 1): DailyReward => ({ stone, count });
const WEEK: DailyReward[] = [r('reroll_values'), r('exp_scroll'), r('reroll_stat'), r('drop_scroll'), r('protect'), r('megaphone')];
export const DAILY_DEFAULT: DailyReward[] = [
  ...WEEK, r('enhance', 2),
  ...WEEK, r('enhance', 2),
  ...WEEK, r('enhance', 3),
  ...WEEK, r('enhance', 3),
  r('exp_scroll', 2), r('drop_scroll', 2), r('protect', 2),
];

/** The owner's changes: day of the month (1–31) → reward. */
export type DailyOverrides = Record<string, DailyReward>;

/** A clean copy of the owner's changes (bad entries and entries equal to the default dropped), or a Thai error. */
export function cleanDailyOverrides(raw: unknown): DailyOverrides | string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'ตารางของรางวัลไม่ถูกต้อง';
  const out: DailyOverrides = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const day = Number(k);
    if (!Number.isInteger(day) || day < 1 || day > 31) return `วันที่ ${k} ไม่ถูกต้อง`;
    const x = v as { stone?: unknown; count?: unknown } | null;
    const stone = DAILY_KINDS.find((s) => s === x?.stone);
    if (!stone) return `วันที่ ${day}: ชนิดของไม่ถูกต้อง`;
    const count = x?.count;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > DAILY_COUNT_MAX) return `วันที่ ${day}: จำนวนต้องเป็น 1–${DAILY_COUNT_MAX}`;
    const def = DAILY_DEFAULT[day - 1];
    if (def.stone === stone && def.count === count) continue;
    out[String(day)] = { stone, count };
  }
  return out;
}

export const dailyReward = (day: number, overrides: DailyOverrides): DailyReward => overrides[String(day)] ?? DAILY_DEFAULT[day - 1];

/** One calendar cell: got it, missed it (make-up possible while any are left), today, or still to come. */
export type DailyState = 'got' | 'madeUp' | 'missed' | 'today' | 'future';

/** What the browser draws. `popup`: the first time today, open it by itself. */
export interface DailyView {
  year: number;
  month: number;
  today: number;
  /** Weekday of the 1st (0 = Sunday), to lay the grid out. */
  firstWeekday: number;
  days: { reward: DailyReward; state: DailyState }[];
  makeupsLeft: number;
  popup?: boolean;
}

/**
 * The month's calendar for one account: `claimed` holds the day numbers got this month (and whether each
 * was a make-up). Today is 'today' only while it is still unclaimed (it is claimed on sight, so rarely).
 */
export function dailyView(now: number, claimed: Map<number, boolean>, overrides: DailyOverrides): DailyView {
  const t = thaiDate(now);
  const n = daysInMonth(t.year, t.month);
  const makeups = [...claimed.values()].filter(Boolean).length;
  const days = Array.from({ length: n }, (_, i) => {
    const day = i + 1;
    const got = claimed.get(day);
    const state: DailyState = got === undefined ? (day < t.day ? 'missed' : day === t.day ? 'today' : 'future') : got ? 'madeUp' : 'got';
    return { reward: dailyReward(day, overrides), state };
  });
  return {
    year: t.year, month: t.month, today: t.day, firstWeekday: new Date(Date.UTC(t.year, t.month - 1, 1)).getUTCDay(),
    days, makeupsLeft: Math.max(0, DAILY_MAKEUPS - makeups),
  };
}

export const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
