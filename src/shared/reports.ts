// Bug reports / feedback (rules: docs/systems/reports.md): topics, limits and the shapes shared by the game,
// the admin page and the server. Pure rules, no DOM. The server checks every limit; the window only mirrors them.

export const REPORT_TOPICS = [
  { id: 'bug', label: 'บัค' },
  { id: 'lag', label: 'แลค / หลุด' },
  { id: 'player', label: 'รายงานผู้เล่น' },
  { id: 'idea', label: 'อยากให้เพิ่ม / ข้อเสนอแนะ' },
  { id: 'other', label: 'อื่น ๆ' },
] as const;
export type ReportTopic = (typeof REPORT_TOPICS)[number]['id'];
export const REPORT_TOPIC_LABEL = Object.fromEntries(REPORT_TOPICS.map((t) => [t.id, t.label])) as Record<ReportTopic, string>;
export const isReportTopic = (v: unknown): v is ReportTopic => REPORT_TOPICS.some((t) => t.id === v);

export const REPORT_STATUSES = [
  { id: 'new', label: 'ใหม่' },
  { id: 'seen', label: 'กำลังดู' },
  { id: 'done', label: 'แก้แล้ว' },
  { id: 'closed', label: 'ปิด' },
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number]['id'];
export const REPORT_STATUS_LABEL = Object.fromEntries(REPORT_STATUSES.map((t) => [t.id, t.label])) as Record<ReportStatus, string>;
export const isReportStatus = (v: unknown): v is ReportStatus => REPORT_STATUSES.some((t) => t.id === v);

// Anti-spam limits (owner 2026-11-10; the per-IP and global ones were proposed and approved with the plan).
export const REPORT_MIN = 10;
export const REPORT_MAX = 500;
/** One report per account this often. */
export const REPORT_COOLDOWN_MS = 60_000;
/** Reports per account / per IP in any 24 hours, and the whole server's per hour. */
export const REPORT_PER_DAY = 5;
export const REPORT_PER_IP_DAY = 15;
export const REPORT_PER_HOUR_ALL = 60;
export const REPORT_DAY_MS = 24 * 60 * 60 * 1000;
export const REPORT_HOUR_MS = 60 * 60 * 1000;
/** Rows per page of the admin list. */
export const REPORT_ADMIN_PAGE = 30;

export const REPORT_GUEST_MSG = 'Guest ส่งรายงานไม่ได้ — สมัครสมาชิกเพื่อใช้งาน';

/** What the game sends. The context (map, position, level, ping…) is added by the server. */
export interface ReportCall { a: 'reportSend'; topic: string; text: string }
export interface ReportReply {
  ok: boolean;
  msg: string;
  /** Set when the answer is "too soon": how long until this account may send again. */
  cooldownMs?: number;
}

/** Control and invisible characters out (a new line stays), runs of blank lines and edge spaces trimmed. */
export function cleanReportText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === '\n' ? c : ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Same text, different spacing or case: counts as a duplicate. */
export const reportKey = (text: string): string => text.replace(/\s+/g, ' ').trim().toLowerCase();

/** One row of the admin list. */
export interface AdminReportRow {
  id: number;
  at: number;
  accountId: number;
  username: string;
  charName: string;
  topic: ReportTopic;
  text: string;
  status: ReportStatus;
  zone: string;
  /** Boss room channel, null outside rooms. */
  channel: number | null;
  x: number;
  z: number;
  level: number;
  rtt: number | null;
  fps: number | null;
  ip: string;
  /** This account may no longer send reports. */
  banned: boolean;
}
