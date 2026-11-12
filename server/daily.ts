// Daily login (rules: docs/systems/daily-login.md, calendar rules: src/shared/daily.ts). The first time an
// account is in the game on a Thai calendar day, that day's reward is mailed to the account. Make-ups mail
// an earlier day of this month, DAILY_MAKEUPS a month. The claim row and the mail go in one transaction,
// and the claim row's key (account, day) makes a second delivery impossible.
import type { Db } from './db';
import {
  cleanDailyOverrides, dailyReward, dailyView, dayKey, DAILY_MAKEUPS, DAILY_SETTING, thaiDate, THAI_MONTHS,
  type DailyOverrides, type DailyView,
} from '../src/shared/daily';
import { MAIL_MS, type MailAttach } from '../src/shared/mail';
import { STONE_NAME } from '../src/shared/data/stones';

/** Who the reward mail says it is from. */
export const DAILY_SENDER = 'ล็อกอินรายวัน';

export class Daily {
  constructor(private readonly db: Db, private readonly now: () => number = Date.now) {}

  /** The owner's changes to the table (only the days that differ from the code). */
  overrides(): DailyOverrides {
    const v = this.db.getSetting(DAILY_SETTING);
    if (!v) return {};
    try {
      const o = cleanDailyOverrides(JSON.parse(v));
      return typeof o === 'string' ? {} : o;
    } catch {
      return {};
    }
  }

  /** Saves the owner's changes; returns the clean copy or a Thai error. */
  setOverrides(raw: unknown): DailyOverrides | string {
    const o = cleanDailyOverrides(raw);
    if (typeof o === 'string') return o;
    this.db.setSetting(DAILY_SETTING, Object.keys(o).length ? JSON.stringify(o) : null);
    return o;
  }

  /** This month's calendar for the account. */
  view(accountId: number): DailyView {
    const now = this.now();
    const t = thaiDate(now);
    return dailyView(now, this.db.dailyMonth(accountId, t.key.slice(0, 7)), this.overrides());
  }

  /** Today's reward, mailed if the account doesn't have it yet. True = it was just sent. */
  deliver(accountId: number): boolean {
    const now = this.now();
    const t = thaiDate(now);
    return this.give(accountId, t.day, false, now);
  }

  /** A make-up for an earlier day of this month; null = sent, else a Thai reason. */
  makeup(accountId: number, day: unknown): string | null {
    const now = this.now();
    const t = thaiDate(now);
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day >= t.day) return 'ชดเชยได้เฉพาะวันที่ผ่านมาแล้วในเดือนนี้';
    const got = this.db.dailyMonth(accountId, t.key.slice(0, 7));
    if (got.has(day)) return 'วันนี้รับของไปแล้ว';
    if ([...got.values()].filter(Boolean).length >= DAILY_MAKEUPS) return `ชดเชยครบ ${DAILY_MAKEUPS} ครั้งของเดือนนี้แล้ว`;
    return this.give(accountId, day, true, now) ? null : 'วันนี้รับของไปแล้ว';
  }

  /** Marks the day and mails its reward in one transaction; false = already had it. */
  private give(accountId: number, day: number, makeup: boolean, now: number): boolean {
    const t = thaiDate(now);
    const reward = dailyReward(day, this.overrides());
    const attach: MailAttach = { gold: 0, items: [{ kind: 'stone', stone: reward.stone, count: reward.count }] };
    const attachJson = JSON.stringify(attach);
    return this.db.transaction(() => {
      if (!this.db.dailyClaim(accountId, dayKey(t.year, t.month, day), makeup, now)) return false;
      // One send per delivery day, reward day and reward: everyone getting the same thing today shares it.
      const key = `${t.key}|${day}|${makeup ? 'm' : 'd'}|${attachJson}`;
      let sendId = this.db.dailyMailSend(key);
      if (sendId === undefined) {
        const date = `${day} ${THAI_MONTHS[t.month - 1]}`;
        sendId = this.db.mailSendInsert({
          senderId: null, senderName: DAILY_SENDER, target: makeup ? `ชดเชยล็อกอินรายวัน ${date}` : `ล็อกอินรายวัน ${date}`,
          title: makeup ? `ชดเชยของรางวัลวันที่ ${date}` : `ของรางวัลล็อกอินวันที่ ${date}`,
          body: `${STONE_NAME[reward.stone]} ×${reward.count}\nกดรับของแนบได้เลย (ผูกกับตัวละครที่กดรับ ถ้าเป็นของใช้)`,
          attach: attachJson, hasAttach: true, at: now, expiresAt: now + MAIL_MS,
        });
        this.db.dailyMailKeep(key, sendId);
      }
      this.db.mailBoxAdd(sendId, accountId, null);
      return true;
    });
  }
}
