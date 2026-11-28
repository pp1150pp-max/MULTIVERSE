// Daily login (rules: docs/systems/daily-login.md, calendar rules: src/shared/daily.ts). The first time an
// account is in the game on a Thai calendar day, that day's reward is mailed to the account. Make-ups mail
// an earlier day of this month, DAILY_MAKEUPS a month. The claim row and the mail go in one transaction,
// and the claim row's key (account, day) makes a second delivery impossible. The milestone bonuses work the
// same way, with one claim row per (account, month, tier).
import type { Db } from './db';
import {
  BONUS_DEFAULT, bonusItems, bonusNeed, cleanBonus, cleanDailyOverrides, dailyReward, dailyView, dayKey,
  DAILY_BONUS_DAYS, DAILY_BONUS_SETTING, DAILY_MAKEUPS, DAILY_SETTING, thaiDate, THAI_MONTHS,
  type BonusConfig, type DailyOverrides, type DailyReward, type DailyView,
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

  /** The bonus settings (the code's, unless the owner saved others). */
  bonusConfig(): BonusConfig {
    const v = this.db.getSetting(DAILY_BONUS_SETTING);
    if (!v) return BONUS_DEFAULT;
    // A broken stored value gives nothing, so a bonus the owner switched off can't come back by itself.
    const off = { ...BONUS_DEFAULT, on: false };
    try {
      const c = cleanBonus(JSON.parse(v));
      return typeof c === 'string' ? off : c;
    } catch {
      return off;
    }
  }

  /** Saves the bonus settings; returns the clean copy or a Thai error. */
  setBonus(raw: unknown): BonusConfig | string {
    const c = cleanBonus(raw);
    if (typeof c === 'string') return c;
    const json = JSON.stringify(c);
    this.db.setSetting(DAILY_BONUS_SETTING, json === JSON.stringify(BONUS_DEFAULT) ? null : json);
    return c;
  }

  /** This month's calendar for the account. */
  view(accountId: number): DailyView {
    const now = this.now();
    const month = thaiDate(now).key.slice(0, 7);
    return dailyView(now, this.db.dailyMonth(accountId, month), this.overrides(), this.bonusConfig(), this.db.dailyBonusGot(accountId, month));
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

  /**
   * Mails every bonus tier this month's days have reached and the account hasn't got (so a tier switched on
   * later in the month still arrives); returns the tiers just sent.
   */
  bonus(accountId: number): number[] {
    const config = this.bonusConfig();
    if (!config.on) return [];
    const now = this.now();
    const t = thaiDate(now);
    const month = t.key.slice(0, 7);
    const count = this.db.dailyMonth(accountId, month).size;
    return DAILY_BONUS_DAYS.filter((tier, i) => {
      const items = bonusItems(config.tiers[i]);
      const need = bonusNeed(tier, t.year, t.month);
      if (!items.length || count < need) return false;
      return this.db.transaction(() => {
        if (!this.db.dailyBonusClaim(accountId, month, tier, now)) return false;
        const title = `โบนัสล็อกอินสะสมครบ ${need} วัน`;
        this.mail(accountId, `${t.key}|bonus${tier}`, title, title, 'ขอบคุณที่เข้าเกมสม่ำเสมอ กดรับของแนบได้เลย', items, now);
        return true;
      });
    });
  }

  /** Marks the day and mails its reward in one transaction; false = already had it. */
  private give(accountId: number, day: number, makeup: boolean, now: number): boolean {
    const t = thaiDate(now);
    const reward = dailyReward(day, this.overrides());
    return this.db.transaction(() => {
      if (!this.db.dailyClaim(accountId, dayKey(t.year, t.month, day), makeup, now)) return false;
      const date = `${day} ${THAI_MONTHS[t.month - 1]}`;
      this.mail(
        accountId, `${t.key}|${day}|${makeup ? 'm' : 'd'}`,
        makeup ? `ชดเชยล็อกอินรายวัน ${date}` : `ล็อกอินรายวัน ${date}`,
        makeup ? `ชดเชยของรางวัลวันที่ ${date}` : `ของรางวัลล็อกอินวันที่ ${date}`,
        `${STONE_NAME[reward.stone]} ×${reward.count}\nกดรับของแนบได้เลย (ผูกกับตัวละครที่กดรับ ถ้าเป็นของใช้)`,
        [reward], now,
      );
      return true;
    });
  }

  /**
   * Mails the rewards to the account. One send per key and rewards: everyone getting the same thing today
   * shares it. Call inside the transaction that writes the claim row.
   */
  private mail(accountId: number, base: string, target: string, title: string, body: string, rewards: DailyReward[], now: number): void {
    const attach: MailAttach = { gold: 0, items: rewards.map((r) => ({ kind: 'stone' as const, stone: r.stone, count: r.count })) };
    const attachJson = JSON.stringify(attach);
    const key = `${base}|${attachJson}`;
    let sendId = this.db.dailyMailSend(key);
    if (sendId === undefined) {
      sendId = this.db.mailSendInsert({
        senderId: null, senderName: DAILY_SENDER, target, title, body,
        attach: attachJson, hasAttach: true, at: now, expiresAt: now + MAIL_MS,
      });
      this.db.dailyMailKeep(key, sendId);
    }
    this.db.mailBoxAdd(sendId, accountId, null);
  }
}
