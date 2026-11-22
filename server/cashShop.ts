// Cash shop on the server (rules: docs/systems/cash-shop.md, data and checks: src/shared/cashShop.ts).
// The server alone takes crystals and gives things. A purchase is one transaction: the crystals are taken
// with `UPDATE … WHERE crystals >= cost` (two characters of one account buying at once can't both spend
// them), the per-account limit is counted again inside it, a cosmetic must really be new to the account,
// stones are mailed to the account; any failure rolls all of it back.
import type { Db } from './db';
import {
  CASH_SETTING, cashBuyError, cashCatalog, checkCashShop, CURRENCY, emptyCashShop,
  type CashCatalog, type CashShopCfg, type CashState,
} from '../src/shared/cashShop';
import { cosById } from '../src/shared/data/cosmetics';
import { boxNow } from '../src/shared/mysteryBox';
import { STONE_NAME } from '../src/shared/data/stones';
import { MAIL_MS, type MailAttach } from '../src/shared/mail';

/** Who the purchase mail says it is from. */
export const CASH_SENDER = 'แคชช็อป';

/** Thrown inside the transaction to roll it back with a reason for the buyer. */
class Refused extends Error {}

export type CashBuyResult = { ok: true; msg: string; kind: 'cos' | 'stone' } | { ok: false; msg: string };

export class CashShop {
  constructor(private readonly db: Db, private readonly now: () => number = Date.now) {}

  /** The saved settings (defaults when none: closed, code prices, no packages). */
  cfg(): CashShopCfg {
    const v = this.db.getSetting(CASH_SETTING);
    if (!v) return emptyCashShop();
    try {
      return checkCashShop(JSON.parse(v), false, this.db.cosShop()).value ?? emptyCashShop();
    } catch {
      return emptyCashShop();
    }
  }

  /** Saves settings already checked strictly (all defaults = no row). */
  setCfg(cfg: CashShopCfg): void {
    const empty = !cfg.open && !Object.keys(cfg.items).length && !cfg.packages.length;
    this.db.setSetting(CASH_SETTING, empty ? null : JSON.stringify(cfg));
  }

  /** What players are sent now. */
  catalog(): CashCatalog {
    return cashCatalog(this.cfg(), this.db.cosShop(), this.now(), !boxNow().orbsInShop);
  }

  state(accountId: number, guest: boolean): CashState {
    return guest ? { crystals: 0, bought: {} } : { crystals: this.db.crystals(accountId), bought: this.db.cashBought(accountId) };
  }

  /** One purchase; every value from the browser is checked here. */
  buy(b: { accountId: number; guest: boolean; charId: number; charName: string; id: unknown; qty: unknown; price: unknown }): CashBuyResult {
    const now = this.now();
    const cat = this.catalog();
    const owned = b.guest ? [] : this.db.cosmeticsOwned(b.accountId);
    const err = cashBuyError(cat, b.id, b.qty, b.price, this.state(b.accountId, b.guest), owned, b.guest, now);
    if (err) return { ok: false, msg: err };
    const e = cat.items.find((i) => i.id === b.id)!;
    const qty = b.qty as number;
    const cost = e.now * qty;
    try {
      this.db.transaction(() => {
        if (!this.db.crystalsSpend(b.accountId, cost)) throw new Refused(`${CURRENCY}ไม่พอ`);
        if (e.limit !== undefined && (this.db.cashBought(b.accountId)[e.id] ?? 0) + qty > e.limit) throw new Refused('ซื้อครบจำนวนที่จำกัดแล้ว');
        if (e.kind === 'cos') {
          if (!this.db.grantCosmetic(b.accountId, e.ref, CASH_SENDER)) throw new Refused('มีของแต่งตัวชิ้นนี้แล้ว');
        } else {
          const attach: MailAttach = { gold: 0, items: [{ kind: 'stone', stone: e.ref, count: qty }] };
          const sendId = this.db.mailSendInsert({
            senderId: null, senderName: CASH_SENDER, target: `ซื้อจากแคชช็อป: ${b.charName}`,
            title: `ของที่ซื้อจากแคชช็อป: ${STONE_NAME[e.ref as keyof typeof STONE_NAME]} ×${qty}`,
            body: `ซื้อด้วย ${cost.toLocaleString('en-US')} ${CURRENCY} (ตัวละคร ${b.charName})\nกดรับของแนบได้เลย (ใบคูณและโทรโข่งผูกกับตัวละครที่กดรับ)`,
            attach: JSON.stringify(attach), hasAttach: true, at: now, expiresAt: now + MAIL_MS,
          });
          this.db.mailBoxAdd(sendId, b.accountId, null);
        }
        this.db.cashPurchaseAdd({ accountId: b.accountId, charId: b.charId, charName: b.charName, item: e.id, qty, price: e.now, at: now });
      });
    } catch (x) {
      if (x instanceof Refused) return { ok: false, msg: x.message };
      throw x;
    }
    const name = e.kind === 'cos' ? cosById(e.ref)?.name ?? e.ref : `${STONE_NAME[e.ref as keyof typeof STONE_NAME]} ×${qty}`;
    const where = e.kind === 'cos' ? 'ใช้ได้เลยในหน้าต่าง "แต่งตัว"' : 'ของอยู่ในจดหมาย';
    return { ok: true, kind: e.kind, msg: `ซื้อ ${name} แล้ว (−${cost.toLocaleString('en-US')} ${CURRENCY}) ${where}` };
  }
}
