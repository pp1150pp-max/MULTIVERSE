// Bug reports / feedback (rules: docs/systems/reports.md). Everything is checked here: who may send, how
// often, what text. The context (map, position, level, ping) comes from the server's own view of the
// player, never from the client.
import type { Db } from './db';
import {
  cleanReportText, isReportTopic, REPORT_COOLDOWN_MS, REPORT_DAY_MS, REPORT_GUEST_MSG, REPORT_HOUR_MS, REPORT_MAX, REPORT_MIN,
  REPORT_PER_DAY, REPORT_PER_HOUR_ALL, REPORT_PER_IP_DAY, reportKey, type ReportReply, type ReportTopic,
} from '../src/shared/reports';

/** Who is sending and where they are, as the server sees it. */
export interface ReportSender {
  accountId: number;
  guest: boolean;
  username: string;
  charName: string;
  ip: string;
  zone: string;
  channel: number | null;
  x: number;
  z: number;
  level: number;
  rtt: number | null;
  fps: number | null;
}

export interface ReportResult extends ReportReply {
  /** Set when a report was stored (the world tells owners/GMs about "report a player" ones). */
  stored?: { id: number; topic: ReportTopic };
}

const no = (msg: string, cooldownMs?: number): ReportResult => ({ ok: false, msg, ...(cooldownMs ? { cooldownMs } : {}) });
const whole = (n: number | null): number | null => (n === null || !Number.isFinite(n) ? null : Math.round(n));

export class Reports {
  constructor(private readonly db: Db, private readonly now: () => number = () => Date.now()) {}

  submit(s: ReportSender, topic: unknown, rawText: unknown): ReportResult {
    if (s.guest) return no(REPORT_GUEST_MSG);
    if (this.db.isReportBanned(s.accountId)) return no('บัญชีนี้ถูกห้ามส่งรายงาน');
    if (!isReportTopic(topic)) return no('เลือกหัวข้อให้ถูกต้อง');
    const text = cleanReportText(rawText);
    const chars = [...text].length;
    if (chars < REPORT_MIN) return no(`ข้อความต้องยาวอย่างน้อย ${REPORT_MIN} ตัวอักษร`);
    if (chars > REPORT_MAX) return no(`ข้อความต้องไม่เกิน ${REPORT_MAX} ตัวอักษร`);

    const t = this.now();
    const mine = this.db.reportsOfAccountSince(s.accountId, t - REPORT_DAY_MS);
    if (mine.length && t - mine[0].at < REPORT_COOLDOWN_MS) {
      const left = REPORT_COOLDOWN_MS - (t - mine[0].at);
      return no(`ส่งรายงานถี่เกินไป — รออีก ${Math.ceil(left / 1000)} วินาที`, left);
    }
    if (mine.length >= REPORT_PER_DAY) return no(`วันนี้ส่งครบ ${REPORT_PER_DAY} รายงานแล้ว — ลองใหม่พรุ่งนี้`);
    if (this.db.reportCountByIpSince(s.ip, t - REPORT_DAY_MS) >= REPORT_PER_IP_DAY) return no('วันนี้ส่งรายงานจากเครื่อง/เครือข่ายนี้ครบจำนวนแล้ว — ลองใหม่พรุ่งนี้');
    const key = reportKey(text);
    if (mine.some((r) => reportKey(r.text) === key)) return no('คุณเพิ่งส่งข้อความนี้ไปแล้ว');
    if (this.db.reportCountSince(t - REPORT_HOUR_MS) >= REPORT_PER_HOUR_ALL) return no('ตอนนี้มีรายงานเข้ามามาก — ลองใหม่อีกสักครู่');

    const id = this.db.insertReport({
      at: t, accountId: s.accountId, username: s.username, charName: s.charName, topic, text, zone: s.zone, channel: s.channel,
      x: Math.round(s.x * 10) / 10, z: Math.round(s.z * 10) / 10, level: Math.round(s.level), rtt: whole(s.rtt), fps: whole(s.fps), ip: s.ip,
    });
    return { ok: true, msg: 'ส่งรายงานแล้ว ขอบคุณที่ช่วยแจ้ง', cooldownMs: REPORT_COOLDOWN_MS, stored: { id, topic } };
  }
}
