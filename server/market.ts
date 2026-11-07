// The consignment market run by the market broker in town (rules and limits: src/shared/sim/market.ts).
//
// Listings live only in the database, never in a character's save. Every move of an item or gold
// between a character and the market writes the listing change AND that character's save in one
// transaction, so a crash can't leave an item both listed and in the old save (or in neither).
// Node runs one message at a time and node:sqlite is synchronous, so two buyers can't interleave;
// the `status = 'active'` check in the UPDATE still guards against anything already sold or ended.
// What sold, expired or was cancelled waits in the seller's claim box, so nothing ever has to change
// a character that isn't online.
import type { Db, MarketDbRow } from './db';
import type { Player } from '../src/shared/sim/Player';
import type { Sim } from '../src/shared/sim/Sim';
import { entryName } from '../src/shared/data/potions';
import { STONE_NAME } from '../src/shared/data/stones';
import { plusOf } from '../src/shared/data/enhance';
import { isItem, isStone, type Item, type StoneStack } from '../src/shared/types';
import { upgradeItem } from '../src/shared/data/items';
import {
  cleanQuery, listingClass, listingFee, marketKind, marketSellable, saleTax, searchStats, sellerGets,
  MARKET_MS, MARKET_PAGE, MARKET_PRICE_MAX, MARKET_PRICE_MIN, MARKET_SLOTS,
  type MarketCall, type MarketMine, type MarketReply, type MarketRow,
} from '../src/shared/sim/market';

/** Who is using the market: an online character (the world's session). */
export interface MarketActor {
  accountId: number;
  charId: number;
  guest: boolean;
  player: Player;
  sim: Sim;
}

/** A message for a seller: something of theirs sold or expired. */
export interface MarketNote { text: string; sub?: string }

export interface MarketOutcome {
  reply: MarketReply;
  /** A listing that just sold (to tell its seller). */
  sold?: MarketDbRow;
  /** Accounts whose claim box changed. */
  boxChanged?: number[];
}

export const GUEST_MARKET_MSG = 'Guest ซื้อขายในตลาดไม่ได้ — สมัครสมาชิกเพื่อใช้ตลาด (ตัวละครนี้จะย้ายไปอยู่ในบัญชีใหม่)';
const FAR_MSG = 'ต้องยืนใกล้นายหน้าตลาดก่อน';

const fail = (msg: string): MarketOutcome => ({ reply: { ok: false, msg } });

function parseEntry(json: string): Item | StoneStack | null {
  try {
    const e = JSON.parse(json) as Item | StoneStack;
    // Listings made before the current tier tables show and come back with today's tiers (values kept).
    return marketSellable(e) ? upgradeItem(e) : null;
  } catch {
    return null;
  }
}

/** A stored row as the browser sees it. Rows whose entry can't be read are left out. */
export function toRow(r: MarketDbRow, viewer: number): MarketRow | null {
  const entry = parseEntry(r.entry);
  if (!entry) return null;
  const row: MarketRow = {
    id: r.id, entry, price: r.price, fee: r.fee, seller: r.seller_name, createdAt: r.created_at, expiresAt: r.expires_at, status: r.status,
  };
  if (r.buyer_name) row.buyer = r.buyer_name;
  if (r.sold_at !== null) row.soldAt = r.sold_at;
  if (r.tax !== null) row.tax = r.tax;
  if (r.seller_account === viewer) row.mine = true;
  return row;
}

const rows = (list: MarketDbRow[], viewer: number): MarketRow[] => list.map((r) => toRow(r, viewer)).filter((r): r is MarketRow => !!r);

/** The display name of a stored listing. */
function rowName(r: MarketDbRow): string {
  const e = parseEntry(r.entry);
  return e ? entryName(e) : r.name;
}

export class Market {
  constructor(private readonly db: Db, private readonly now: () => number = Date.now) {}

  handle(a: MarketActor, call: MarketCall): MarketOutcome {
    // Browsing is fine for guests; trading is not (a guest is deleted after a day offline, and is free
    // to make, so it could carry gear or gold between accounts with no one to trace).
    if (a.guest && call.a !== 'mktSearch') return fail(GUEST_MARKET_MSG);
    if (!a.sim.near(a.player, 'broker')) return fail(FAR_MSG);
    switch (call.a) {
      case 'mktSearch': return this.search(a, call.q);
      case 'mktMine': return { reply: { ok: true, mine: this.mine(a.accountId) } };
      case 'mktList': return this.list(a, call.i, call.price);
      case 'mktCancel': return this.cancel(a, call.id);
      case 'mktBuy': return this.buy(a, call.id, call.price);
      case 'mktClaim': return this.claim(a, call.id);
      default: return fail('คำสั่งไม่ถูกต้อง');
    }
  }

  mine(accountId: number): MarketMine {
    const m = this.db.marketMine(accountId);
    return { active: rows(m.active, accountId), box: rows(m.box, accountId), slotsUsed: m.active.length };
  }

  private search(a: MarketActor, raw: unknown): MarketOutcome {
    const q = cleanQuery(raw);
    const { rows: found, total } = this.db.marketSearch(q, this.now(), MARKET_PAGE);
    return { reply: { ok: true, page: { rows: rows(found, a.accountId), total, page: q.page ?? 0 } } };
  }

  /** Saves the character (and its account's stash, as a normal save does) inside the current transaction. */
  private write(a: MarketActor): void {
    const data = a.player.toData();
    if (a.guest) this.db.saveCharacter(a.charId, data);
    else this.db.writeCharacterAndStash(a.charId, data, a.accountId, a.player.stash);
  }

  private list(a: MarketActor, i: unknown, price: unknown): MarketOutcome {
    const p = a.player;
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= p.bag.length) return fail('ช่องกระเป๋าไม่ถูกต้อง');
    if (typeof price !== 'number' || !Number.isInteger(price) || price < MARKET_PRICE_MIN || price > MARKET_PRICE_MAX) {
      return fail(`ราคาต้องอยู่ระหว่าง ${MARKET_PRICE_MIN.toLocaleString()} – ${MARKET_PRICE_MAX.toLocaleString()} G`);
    }
    const entry = p.bag[i];
    if (!marketSellable(entry)) return fail(entry ? 'ยาลงขายในตลาดไม่ได้ (ขายให้พ่อค้าแทน)' : 'ช่องนี้ว่าง');
    if (isItem(entry) && this.db.marketUidListed(entry.uid)) return fail('ของชิ้นนี้ลงขายอยู่แล้ว');
    if (this.db.marketActiveCount(a.accountId) >= MARKET_SLOTS) return fail(`ลงขายได้พร้อมกันสูงสุด ${MARKET_SLOTS} ชิ้นต่อบัญชี`);
    const fee = listingFee(price);
    if (p.gold < fee) return fail(`ทองไม่พอจ่ายค่าลงขาย ${fee.toLocaleString()} G`);
    const now = this.now();
    p.bag[i] = null;
    p.gold -= fee;
    try {
      this.db.transaction(() => {
        this.db.marketInsert({
          sellerAccount: a.accountId, sellerChar: a.charId, sellerName: p.name, entry: JSON.stringify(entry),
          uid: isItem(entry) ? entry.uid : null, name: isItem(entry) ? entry.name : STONE_NAME[entry.stone],
          kind: marketKind(entry), rarity: isItem(entry) ? entry.rarity : null, level: isItem(entry) ? entry.level : 0,
          plus: isItem(entry) ? plusOf(entry) : 0, cls: listingClass(entry), count: isStone(entry) ? entry.count : 1,
          price, fee, createdAt: now, expiresAt: now + MARKET_MS, stats: searchStats(entry),
        });
        this.write(a);
      });
    } catch (e) {
      p.bag[i] = entry;
      p.gold += fee;
      console.error('[market] listing failed', e);
      return fail('ลงขายไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
    a.sim.inventoryChanged(p);
    return { reply: { ok: true, msg: `ลงขาย ${entryName(entry)} ราคา ${price.toLocaleString()} G แล้ว (ค่าลงขาย ${fee.toLocaleString()} G)`, mine: this.mine(a.accountId) } };
  }

  private cancel(a: MarketActor, id: unknown): MarketOutcome {
    if (typeof id !== 'number' || !Number.isInteger(id)) return fail('ไม่พบรายการนี้');
    if (!this.db.marketCancel(id, a.accountId)) return fail('ยกเลิกไม่ได้ — ขายไปแล้วหรือหมดเวลาแล้ว');
    const r = this.db.marketGet(id);
    return {
      reply: { ok: true, msg: `ยกเลิกการขาย ${r ? rowName(r) : ''} แล้ว — ของอยู่ในกล่องรับของ`, mine: this.mine(a.accountId) },
      boxChanged: [a.accountId],
    };
  }

  private buy(a: MarketActor, id: unknown, price: unknown): MarketOutcome {
    const p = a.player;
    if (typeof id !== 'number' || !Number.isInteger(id)) return fail('ไม่พบรายการนี้');
    const now = this.now();
    const r = this.db.marketGet(id);
    if (!r || r.status !== 'active' || r.expires_at <= now) return fail('ของชิ้นนี้ขายไปแล้ว หรือหมดเวลาแล้ว');
    if (r.seller_account === a.accountId) return fail('ซื้อของที่บัญชีตัวเองลงขายไม่ได้');
    if (price !== r.price) return fail('ราคาไม่ตรงกับที่ลงขายไว้ — กดค้นหาใหม่');
    const entry = parseEntry(r.entry);
    if (!entry) return fail('ของชิ้นนี้เสียหาย ซื้อไม่ได้');
    if (p.gold < r.price) return fail(`ทองไม่พอ (ต้องใช้ ${r.price.toLocaleString()} G)`);
    if (isItem(entry) ? !p.hasBagSpace() : p.stoneRoom(entry.stone) < entry.count) return fail('กระเป๋าเต็ม');
    p.gold -= r.price;
    if (isItem(entry)) p.addToBag(entry);
    else p.addStones(entry.stone, entry.count);
    const tax = saleTax(r.price);
    try {
      this.db.transaction(() => {
        if (!this.db.marketMarkSold(id, a.accountId, p.name, now, tax)) throw new SoldOut();
        this.write(a);
      });
    } catch (e) {
      p.gold += r.price;
      if (isItem(entry)) {
        const at = p.bag.indexOf(entry);
        if (at >= 0) p.bag[at] = null;
      } else p.takeStones(entry.stone, entry.count);
      if (e instanceof SoldOut) return fail('ของชิ้นนี้เพิ่งมีคนซื้อไป');
      console.error('[market] buying failed', e);
      return fail('ซื้อไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
    a.sim.inventoryChanged(p);
    const sold = this.db.marketGet(id) ?? r;
    return {
      reply: { ok: true, msg: `ซื้อ ${entryName(entry)} ราคา ${r.price.toLocaleString()} G แล้ว` },
      sold,
      boxChanged: [r.seller_account],
    };
  }

  /** Collects one claim box row, or (id -1) every one that fits. */
  private claim(a: MarketActor, id: unknown): MarketOutcome {
    const p = a.player;
    if (typeof id !== 'number' || !Number.isInteger(id)) return fail('ไม่พบรายการนี้');
    const box = this.db.marketBox(a.accountId).filter((r) => id === -1 || r.id === id);
    if (!box.length) return fail('ไม่มีของรอรับ');
    const taken: MarketDbRow[] = [];
    const undo: (() => void)[] = [];
    let gold = 0;
    let items = 0;
    let full = false;
    for (const r of box) {
      if (r.status === 'sold') {
        const g = sellerGets(r.price);
        p.gold += g;
        gold += g;
        undo.push(() => (p.gold -= g));
      } else {
        const e = parseEntry(r.entry);
        if (!e) continue;
        if (isItem(e)) {
          if (!p.addToBag(e)) {
            full = true;
            continue;
          }
          undo.push(() => {
            const at = p.bag.indexOf(e);
            if (at >= 0) p.bag[at] = null;
          });
        } else {
          if (!p.addStones(e.stone, e.count)) {
            full = true;
            continue;
          }
          undo.push(() => p.takeStones(e.stone, e.count));
        }
        items++;
      }
      taken.push(r);
    }
    if (!taken.length) return fail('กระเป๋าเต็ม — ทำช่องว่างก่อนแล้วค่อยรับของ');
    const now = this.now();
    try {
      this.db.transaction(() => {
        for (const r of taken) if (!this.db.marketMarkClaimed(r.id, a.accountId, now)) throw new SoldOut();
        this.write(a);
      });
    } catch (e) {
      for (const u of undo.reverse()) u();
      if (!(e instanceof SoldOut)) console.error('[market] claiming failed', e);
      return fail('รับของไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
    a.sim.inventoryChanged(p);
    const parts: string[] = [];
    if (gold) parts.push(`รับเงิน ${gold.toLocaleString()} G`);
    if (items) parts.push(`รับของคืน ${items} ชิ้น`);
    if (full) parts.push('กระเป๋าเต็ม ของบางชิ้นยังอยู่ในกล่อง');
    return { reply: { ok: true, msg: parts.join(' · '), mine: this.mine(a.accountId) }, boxChanged: [a.accountId] };
  }

  /** The message for one listing that just sold or expired. */
  note(r: MarketDbRow): MarketNote {
    return r.status === 'sold'
      ? { text: `💰 ขาย ${rowName(r)} ได้ ${sellerGets(r.price).toLocaleString()} G`, sub: `ผู้ซื้อ ${r.buyer_name ?? ''} · รับเงินที่นายหน้าตลาดในเมือง` }
      : { text: `⌛ ${rowName(r)} หมดเวลาขาย`, sub: 'รับของคืนที่นายหน้าตลาดในเมือง' };
  }

  /**
   * What sold or expired while the account was away, as one message (null = nothing), marked as told.
   */
  awayNote(accountId: number): MarketNote | null {
    const list = this.db.marketUnnotified(accountId);
    if (!list.length) return null;
    this.db.marketSetNotified(list.map((r) => r.id), this.now());
    const sold = list.filter((r) => r.status === 'sold');
    const expired = list.length - sold.length;
    const gold = sold.reduce((n, r) => n + sellerGets(r.price), 0);
    const parts: string[] = [];
    if (sold.length) parts.push(`ขายได้ ${sold.length} ชิ้น รวม ${gold.toLocaleString()} G`);
    if (expired) parts.push(`หมดเวลา ${expired} ชิ้น`);
    return { text: `💰 ตลาด: ระหว่างที่ไม่อยู่ ${parts.join(' · ')}`, sub: 'รับเงินและของที่นายหน้าตลาดในเมือง' };
  }

  markNotified(ids: readonly number[]): void {
    if (ids.length) this.db.marketSetNotified(ids, this.now());
  }

  boxCount(accountId: number): number {
    return this.db.marketBoxCount(accountId);
  }

  /** Ends listings whose time is up; returns them. */
  expire(): MarketDbRow[] {
    return this.db.marketExpire(this.now());
  }
}

/** Thrown inside a transaction when a listing was no longer there to buy or collect. */
class SoldOut extends Error {}
