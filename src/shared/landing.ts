// The landing page (docs/systems/landing.md, landing.html): the close beta countdown and the latest "มีอะไรใหม่" notes,
// read without logging in from GET /api/landing. The owner changes the window and the news switch in /admin → มีอะไรใหม่.
import type { NewsNote } from './news';

export const LANDING_API = '/api/landing';
/** How many notes the landing page lists. */
export const LANDING_NEWS = 4;

export interface LandingConfig {
  /** Epoch ms the close beta opens. */
  start: number;
  /** Epoch ms it ends. */
  end: number;
  /** List the latest notes on the page. */
  news: boolean;
}

/** In the code: 28 Nov 2026 18:00 – 5 Dec 2026 18:00 Thai time (UTC+7), news on. The page has the same times built in for when the server can't be reached. */
export const LANDING_DEFAULT: LandingConfig = {
  start: Date.UTC(2026, 10, 28, 11),
  end: Date.UTC(2026, 11, 5, 11),
  news: true,
};

/** What GET /api/landing answers (public, CORS open: it holds nothing a guest in the game can't already see). */
export interface LandingView {
  start: number;
  end: number;
  /** Newest first; empty when the news switch is off. */
  news: NewsNote[];
  /** The /admin "ภาษาอังกฤษ" switch (docs/systems/i18n.md): off = the page stays Thai and hides its EN button. */
  english: boolean;
}

/** The /admin tab's view. */
export interface AdminLanding {
  config: LandingConfig;
  canEdit: boolean;
}

const MIN = Date.UTC(2024, 0, 1);
const MAX = Date.UTC(2100, 0, 1);

/** Checks a window from /admin; returns the config or the Thai reason it is refused. */
export function cleanLanding(v: { start?: unknown; end?: unknown; news?: unknown }): LandingConfig | { error: string } {
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= MIN && n <= MAX;
  if (!ok(v.start) || !ok(v.end)) return { error: 'เวลาเริ่ม/จบไม่ถูกต้อง' };
  if (v.end <= v.start) return { error: 'เวลาจบต้องหลังเวลาเริ่ม' };
  if (typeof v.news !== 'boolean') return { error: 'ค่าสวิตช์ข่าวไม่ถูกต้อง' };
  return { start: v.start, end: v.end, news: v.news };
}

/** "2026-11-28T18:00" in Thai time, for <input type="datetime-local"> on /admin. */
export function toThaiInput(at: number): string {
  return new Date(at + 7 * 3600_000).toISOString().slice(0, 16);
}

/** Reads a datetime-local value as Thai time; NaN when it isn't one. */
export function fromThaiInput(v: string): number {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? Date.parse(`${v}:00+07:00`) : NaN;
}
