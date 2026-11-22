// "มีอะไรใหม่" (docs/systems/news.md): the update notes players read in the game. Rows live in the DB table `news`
// (so they can be added without a PR); this file holds the limits, the cleaner every writer goes through, and the
// shapes sent to the browser.

/** The window shows this many of the newest visible notes. */
export const NEWS_SHOW = 5;
export const NEWS_TITLE_MAX = 60;
export const NEWS_LINE_MAX = 120;
export const NEWS_LINES_MAX = 12;
/** Notes listed on the /admin tab. */
export const NEWS_ADMIN_LIST = 100;

export interface NewsNote {
  id: number;
  /** Epoch ms the note was posted (shown in Thai time). */
  at: number;
  title: string;
  lines: string[];
}

/** What the server pushes to every player (guests too) on join and after any change. */
export interface NewsView {
  /** The button is shown (the /admin switch). */
  button: boolean;
  /** Open the window once on join when there is a note the player has not seen. */
  autopop: boolean;
  /** The newest visible notes, newest first, at most NEWS_SHOW. */
  notes: NewsNote[];
}

export interface NewsSwitches { button: boolean; autopop: boolean }
/** In the code: the button is on (it only shows once there is a note); the popup is off. */
export const NEWS_SWITCHES_DEFAULT: NewsSwitches = { button: true, autopop: false };

/** A note as the /admin tab lists it. */
export interface AdminNewsNote extends NewsNote { hidden: boolean; author: string; updatedAt: number }
export interface AdminNews {
  notes: AdminNewsNote[];
  switches: NewsSwitches;
  /** May add / edit / hide / delete and change the switches. */
  canEdit: boolean;
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g;
const clean = (s: string) => s.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();

/** Checks a title and its lines; returns the cleaned values or the Thai reason it is refused. */
export function cleanNews(title: unknown, lines: unknown): { title: string; lines: string[] } | { error: string } {
  if (typeof title !== 'string') return { error: 'ใส่หัวข้อ' };
  const t = clean(title);
  if (!t) return { error: 'ใส่หัวข้อ' };
  if (t.length > NEWS_TITLE_MAX) return { error: `หัวข้อยาวเกิน ${NEWS_TITLE_MAX} ตัวอักษร` };
  if (!Array.isArray(lines)) return { error: 'รายการต้องเป็นลิสต์' };
  const out: string[] = [];
  for (const l of lines) {
    if (typeof l !== 'string') return { error: 'รายการต้องเป็นข้อความ' };
    const c = clean(l);
    if (!c) continue;
    if (c.length > NEWS_LINE_MAX) return { error: `แต่ละบรรทัดยาวไม่เกิน ${NEWS_LINE_MAX} ตัวอักษร ("${c.slice(0, 20)}…")` };
    out.push(c);
  }
  if (!out.length) return { error: 'ใส่รายการอย่างน้อย 1 บรรทัด' };
  if (out.length > NEWS_LINES_MAX) return { error: `ใส่ได้ไม่เกิน ${NEWS_LINES_MAX} บรรทัด` };
  return { title: t, lines: out };
}

/** "22 พ.ย. 2569 14:30" in Thai time (Buddhist year), for the window and the admin tab. */
export function newsDate(at: number): string {
  const p = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
  return p;
}
