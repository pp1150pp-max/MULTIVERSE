// Top-up by PromptPay on the server (rules: docs/systems/topup.md, data and checks: src/shared/topup.ts).
// The server alone makes requests (amount = package price + satang no other open request has), and only
// the owner's confirm in /admin gives crystals, in one transaction that moves the request out of its state
// first (a second click finds nothing to move). The PromptPay number never goes into a log.
import type { Db } from './db';
import {
  checkTopup, closedTopup, pickAmount, promptPayPayload, TOPUP_REFUND_SETTING, TOPUP_SETTING, topupNewError, topupToStore,
  type TopupCfg, type TopupRow, type TopupView,
} from '../src/shared/topup';
import type { CashPackage } from '../src/shared/cashShop';

const DAY = 24 * 60 * 60 * 1000;

export type TopupResult = { ok: true; msg: string } | { ok: false; msg: string };

export class Topup {
  constructor(private readonly db: Db, private readonly now: () => number = Date.now) {}

  cfg(): TopupCfg {
    const v = this.db.getSetting(TOPUP_SETTING);
    try {
      return checkTopup(v ? JSON.parse(v) : {}, false).value!;
    } catch {
      return checkTopup({}, false).value!;
    }
  }

  setCfg(c: TopupCfg): void {
    const s = topupToStore(c);
    this.db.setSetting(TOPUP_SETTING, s ? JSON.stringify(s) : null);
  }

  /** Players may ask: switched on and a number set. */
  private live(c: TopupCfg): boolean {
    return c.open && !!c.promptpay;
  }

  /** What one account's windows are sent (guests: closed). */
  view(accountId: number, guest: boolean): TopupView {
    const c = this.cfg();
    if (guest) return { ...closedTopup(), notice: c.notice };
    this.db.topupExpire(this.now());
    const pending = this.db.topupPending(accountId).map((r) => ({
      id: r.id, crystals: r.crystals, bonus: r.bonus, baht: r.baht, amount: r.amount, expiresAt: r.expiresAt,
      // An open request keeps its QR even if the owner switched top-up off since (they may confirm it).
      qr: c.promptpay ? promptPayPayload(c.promptpay, r.amount) : '',
    }));
    return { open: this.live(c), notice: c.notice, pending, maxPending: c.maxPending };
  }

  /** A player asks for a package; every value from the browser is checked here. */
  create(b: { accountId: number; guest: boolean; username: string; charName: string; packages: readonly CashPackage[]; crystals: unknown; bonus: unknown; baht: unknown }): TopupResult {
    const c = this.cfg();
    const now = this.now();
    const err = topupNewError(this.view(b.accountId, b.guest), b.packages, b, b.guest);
    if (err) return { ok: false, msg: err };
    if (this.db.topupCountSince(b.accountId, now - DAY) >= c.perDay) return { ok: false, msg: `ขอเติมได้ไม่เกิน ${c.perDay} ครั้งต่อวัน ลองใหม่ภายหลัง` };
    const baht = b.baht as number;
    const amount = pickAmount(baht, this.db.topupOpenAmounts());
    if (amount === null) return { ok: false, msg: 'มีคนขอเติมยอดนี้อยู่มาก ลองใหม่ภายหลัง' };
    this.db.topupInsert({
      accountId: b.accountId, username: b.username, charName: b.charName, crystals: b.crystals as number, bonus: b.bonus as number,
      baht, amount, at: now, expiresAt: now + c.expireHours * 60 * 60 * 1000,
    });
    return { ok: true, msg: 'สร้างคำขอเติมแล้ว สแกน QR แล้วโอนตามยอดที่แสดง' };
  }

  /** The player cancels their own open request (the owner can still confirm it if money came). */
  cancel(accountId: number, id: unknown, by: string): TopupResult {
    const r = typeof id === 'number' && Number.isInteger(id) ? this.db.topupGet(id) : undefined;
    if (!r || r.accountId !== accountId) return { ok: false, msg: 'ไม่พบคำขอนี้' };
    if (!this.db.topupSetStatus(r.id, ['pending'], 'cancelled', by, this.now())) return { ok: false, msg: 'คำขอนี้ไม่ได้รอยืนยันแล้ว' };
    return { ok: true, msg: 'ยกเลิกคำขอเติมแล้ว' };
  }

  /** Owner's confirm: the request leaves its state and the crystals (with bonus) go in, all or nothing. */
  confirm(id: number, by: string): { ok: true; row: TopupRow } | { ok: false; msg: string } {
    return this.db.transaction(() => {
      if (!this.db.topupSetStatus(id, ['pending', 'expired', 'cancelled'], 'confirmed', by, this.now(), true)) {
        return { ok: false as const, msg: 'คำขอนี้ยืนยัน/ปฏิเสธไปแล้ว หรือไม่มีอยู่' };
      }
      const row = this.db.topupGet(id)!;
      if (this.db.crystalsAdd(row.accountId, row.crystals + row.bonus) === null) throw new Error('topup confirm: account missing');
      return { ok: true as const, row };
    });
  }

  reject(id: number, by: string): { ok: true; row: TopupRow } | { ok: false; msg: string } {
    if (!this.db.topupSetStatus(id, ['pending', 'expired', 'cancelled'], 'rejected', by, this.now())) {
      return { ok: false, msg: 'คำขอนี้ยืนยัน/ปฏิเสธไปแล้ว หรือไม่มีอยู่' };
    }
    return { ok: true, row: this.db.topupGet(id)! };
  }

  /**
   * Undoing a wrong confirm: the crystals come back out. If the player already spent some, nothing is
   * done (the account can't go below 0); the message says how many are left.
   */
  reverse(id: number, by: string): { ok: true; row: TopupRow } | { ok: false; msg: string } {
    return this.db.transaction(() => {
      if (!this.db.topupSetStatus(id, ['confirmed'], 'reversed', by, this.now())) return { ok: false as const, msg: 'คำขอนี้ไม่ได้อยู่ในสถานะยืนยันแล้ว' };
      const row = this.db.topupGet(id)!;
      const n = row.crystals + row.bonus;
      if (this.db.crystalsAdd(row.accountId, -n) === null) {
        const have = this.db.crystals(row.accountId);
        throw new ReverseShort(`ย้อนไม่ได้: ผู้เล่นใช้คริสตัลไปแล้ว เหลือ ${have.toLocaleString('en-US')} จาก ${n.toLocaleString('en-US')}`);
      }
      return { ok: true as const, row };
    });
  }

  refundCfg(): { at: number; by: string } | null {
    const v = this.db.getSetting(TOPUP_REFUND_SETTING);
    if (!v) return null;
    try {
      const o = JSON.parse(v) as { at?: unknown; by?: unknown };
      return typeof o.at === 'number' ? { at: o.at, by: String(o.by ?? '') } : null;
    } catch {
      return null;
    }
  }

  setRefund(on: boolean, by: string): void {
    this.db.setSetting(TOPUP_REFUND_SETTING, on ? JSON.stringify({ at: this.now(), by }) : null);
  }

  /**
   * The close beta refund, once per account, when it enters the world: crystals (with bonus) of every
   * top-up confirmed before the owner switched it on and not reversed. Returns the crystals given (0 = none).
   */
  refundOnJoin(accountId: number, username: string): number {
    const r = this.refundCfg();
    if (!r) return 0;
    return this.db.transaction(() => {
      const n = this.db.topupRefundDue(accountId, r.at);
      if (n <= 0 || !this.db.topupRefundAdd(accountId, n, this.now())) return 0;
      if (this.db.crystalsAdd(accountId, n) === null) throw new Error('topup refund: account missing');
      this.db.audit(null, 'ระบบ', 'topup-refund', username, `คืนคริสตัล close beta ${n.toLocaleString('en-US')} (รวมโบนัส)`);
      return n;
    });
  }
}

/** Thrown inside reverse() to roll it back; the admin API turns it into a 409. */
export class ReverseShort extends Error {}
