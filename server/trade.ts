// Player-to-player trade (rules: docs/systems/trade.md). Requests work like party invites; an accepted
// request opens a trade both players edit, confirm, wait 3 s for, and that then swaps in ONE database
// transaction together with both characters' saves (like the market's and the mailbox's claims).
//
// Everything is in memory except the finished-trade log, keyed on the character id. The server is the
// only authority: offered things stay in the bags (the client only marks them) and are checked again
// at the moment of the swap, so a trade can never create or lose an item or any gold.
import type { Db } from './db';
import type { Player } from '../src/shared/sim/Player';
import type { Sim } from '../src/shared/sim/Sim';
import {
  afterTax, describeEntry, makeOffer, planSwap, TRADE_COUNTDOWN, TRADE_GOLD_MAX, TRADE_REQUEST_TTL, TRADE_REREQUEST_GAP, TRADE_SLOTS,
  taxOf, type SwapSide, type TradeOffer, type TradeSideView, type TradeView,
} from '../src/shared/trade';

/** A character in the world, as far as trading cares. `player` / `sim` are the live ones (they change when it walks through a portal). */
export interface TradeActor {
  charId: number;
  accountId: number;
  name: string;
  guest: boolean;
  zone: string;
  alive: boolean;
  player: Player;
  sim: Sim;
}

/** What the world passes on to the players involved. */
export interface TradeHost {
  /** The character if it is in the world right now. */
  actor(charId: number): TradeActor | undefined;
  /** Show this character a request popup. */
  requested(toCharId: number, fromCharId: number, fromName: string, seconds: number): void;
  /** Close a request popup that is no longer valid. */
  requestGone(toCharId: number, fromCharId: number): void;
  /** A one-off line in this character's chat. */
  tell(charId: number, text: string): void;
  /** The trade window's state for this character. */
  view(charId: number, v: TradeView): void;
  /** The trade is over (ok = it went through); closes the window. */
  ended(charId: number, ok: boolean, msg: string): void;
}

interface Request {
  from: number;
  to: number;
  fromName: string;
  toName: string;
  until: number;
}

interface Side {
  charId: number;
  accountId: number;
  name: string;
  offers: TradeOffer[];
  gold: number;
  confirmed: boolean;
}

interface Trade {
  id: number;
  a: Side;
  b: Side;
  ver: number;
  /** When (ms) the 3 s countdown ends, or null. */
  countdownEnd: number | null;
}

const GUEST_MSG = 'Guest เทรดไม่ได้ — สมัครสมาชิกเพื่อใช้งาน';

export class Trades {
  private readonly byChar = new Map<number, Trade>();
  private requests: Request[] = [];
  /** `${from}:${to}` → when (ms) the last request between them went out. */
  private readonly lastRequest = new Map<string, number>();
  private nextId = 1;

  constructor(private readonly db: Db, private readonly host: TradeHost, private readonly now: () => number = () => Date.now()) {}

  /** Whether this character has a trade window open (the world then refuses actions that move bag items). */
  busy(charId: number): boolean {
    return this.byChar.has(charId);
  }

  // ------------------------------------------------------------ requests

  /** Why `from` and `to` can't trade right now, or null. Checked when asking and again when accepting. */
  private block(from: TradeActor, to: TradeActor): string | null {
    if (from.guest) return GUEST_MSG;
    if (to.guest) return 'เทรดกับ Guest ไม่ได้';
    if (from.charId === to.charId) return 'เทรดกับตัวเองไม่ได้';
    if (from.accountId === to.accountId) return 'เทรดกับตัวละครของบัญชีตัวเองไม่ได้';
    if (!from.alive) return 'ตายอยู่ — เทรดไม่ได้';
    if (!to.alive) return `${to.name} ตายอยู่ — เทรดไม่ได้`;
    if (from.zone !== to.zone) return `${to.name} อยู่คนละแมพ — ต้องอยู่แมพเดียวกันถึงจะเทรดได้`;
    if (this.byChar.has(from.charId)) return 'คุณกำลังเทรดอยู่';
    if (this.byChar.has(to.charId)) return `${to.name} กำลังเทรดอยู่`;
    return null;
  }

  /** `from` asks `to` (undefined = not online) to trade. `toBlocks` = the target turned requests off. Returns an error line, or null. */
  request(from: TradeActor, to: TradeActor | undefined, toBlocks: boolean): string | null {
    if (from.guest) return GUEST_MSG;
    if (!to) return 'ไม่พบผู้เล่นนี้ (ต้องออนไลน์อยู่)';
    const why = this.block(from, to);
    if (why) return why;
    if (toBlocks) return `${to.name} ปิดการรับคำขอเทรดไว้`;
    const t = this.now();
    if (this.requests.some((r) => r.from === from.charId && r.until > t)) return 'คุณมีคำขอเทรดที่รอคำตอบอยู่ — รอให้เขาตอบหรือหมดเวลาก่อน';
    if (this.requests.some((r) => r.to === to.charId && r.until > t)) return `${to.name} มีคำขอเทรดอื่นรอคำตอบอยู่ — ลองใหม่อีกสักครู่`;
    const key = `${from.charId}:${to.charId}`;
    const last = this.lastRequest.get(key);
    if (last !== undefined && t - last < TRADE_REREQUEST_GAP * 1000) {
      return `ขอเทรดกับ ${to.name} ซ้ำได้อีกใน ${Math.ceil((last + TRADE_REREQUEST_GAP * 1000 - t) / 1000)} วินาที`;
    }
    this.lastRequest.set(key, t);
    this.requests.push({ from: from.charId, to: to.charId, fromName: from.name, toName: to.name, until: t + TRADE_REQUEST_TTL * 1000 });
    this.host.requested(to.charId, from.charId, from.name, TRADE_REQUEST_TTL);
    this.host.tell(from.charId, `ส่งคำขอเทรดถึง ${to.name} แล้ว`);
    return null;
  }

  /** `c` accepts or declines the request from character `fromChar`. Returns an error line for `c`, or null. */
  answer(c: TradeActor, fromChar: number, yes: boolean): string | null {
    const t = this.now();
    const req = this.requests.find((r) => r.from === fromChar && r.to === c.charId && r.until > t);
    this.requests = this.requests.filter((r) => !(r.from === fromChar && r.to === c.charId));
    this.host.requestGone(c.charId, fromChar);
    if (!req) return yes ? 'คำขอเทรดนี้หมดอายุแล้ว' : null;
    if (!yes) {
      this.host.tell(req.from, `${c.name} ปฏิเสธคำขอเทรด`);
      return null;
    }
    const from = this.host.actor(req.from);
    if (!from) return `${req.fromName} ออกจากเกมไปแล้ว`;
    const why = this.block(from, c);
    if (why) {
      this.host.tell(req.from, `เทรดกับ ${c.name} ไม่ได้ — ${why}`);
      return why;
    }
    // Anything else either of them was asked meanwhile can't be taken any more.
    for (const r of this.requests.filter((x) => x.to === c.charId || x.to === from.charId || x.from === c.charId)) this.host.requestGone(r.to, r.from);
    this.requests = this.requests.filter((x) => x.to !== c.charId && x.to !== from.charId && x.from !== c.charId);
    const trade: Trade = {
      id: this.nextId++, ver: 0, countdownEnd: null,
      a: { charId: from.charId, accountId: from.accountId, name: from.name, offers: [], gold: 0, confirmed: false },
      b: { charId: c.charId, accountId: c.accountId, name: c.name, offers: [], gold: 0, confirmed: false },
    };
    this.byChar.set(from.charId, trade);
    this.byChar.set(c.charId, trade);
    this.push(trade);
    return null;
  }

  // ------------------------------------------------------------ the open trade

  private mine(c: TradeActor): { trade: Trade; me: Side; other: Side } | string {
    const trade = this.byChar.get(c.charId);
    if (!trade) return 'คุณไม่ได้อยู่ในการเทรด';
    return trade.a.charId === c.charId ? { trade, me: trade.a, other: trade.b } : { trade, me: trade.b, other: trade.a };
  }

  /** Something changed: every confirm and the countdown are void, and both windows are redrawn. */
  private changed(trade: Trade): void {
    trade.ver++;
    trade.a.confirmed = trade.b.confirmed = false;
    trade.countdownEnd = null;
    this.push(trade);
  }

  private sideView(s: Side): TradeSideView {
    return { name: s.name, items: s.offers, gold: s.gold, confirmed: s.confirmed };
  }

  private push(trade: Trade): void {
    const left = trade.countdownEnd === null ? null : Math.max(0, (trade.countdownEnd - this.now()) / 1000);
    for (const s of [trade.a, trade.b]) {
      this.host.view(s.charId, { id: trade.id, ver: trade.ver, you: s === trade.a ? 'a' : 'b', a: this.sideView(trade.a), b: this.sideView(trade.b), cd: left });
    }
  }

  /** Puts one bag slot (all of it, or `n` of a potion/stone stack) in the offer. Offering the same slot again changes the amount. */
  add(c: TradeActor, slot: unknown, n?: unknown): string | null {
    const m = this.mine(c);
    if (typeof m === 'string') return m;
    const offer = makeOffer(c.player.bag, slot, n);
    if (typeof offer === 'string') return offer;
    const at = m.me.offers.findIndex((o) => o.slot === offer.slot);
    if (at < 0 && m.me.offers.length >= TRADE_SLOTS) return `เสนอของได้สูงสุด ${TRADE_SLOTS} ช่อง`;
    if (at >= 0) m.me.offers[at] = offer;
    else m.me.offers.push(offer);
    this.changed(m.trade);
    return null;
  }

  /** Takes the offer made from bag slot `slot` back. */
  remove(c: TradeActor, slot: unknown): string | null {
    const m = this.mine(c);
    if (typeof m === 'string') return m;
    const at = m.me.offers.findIndex((o) => o.slot === slot);
    if (at < 0) return 'ของชิ้นนี้ไม่ได้อยู่ในข้อเสนอ';
    m.me.offers.splice(at, 1);
    this.changed(m.trade);
    return null;
  }

  setGold(c: TradeActor, amount: unknown): string | null {
    const m = this.mine(c);
    if (typeof m === 'string') return m;
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > TRADE_GOLD_MAX) return 'จำนวนทองไม่ถูกต้อง';
    if (amount > c.player.gold) return 'ทองไม่พอ';
    if (amount === m.me.gold) return null;
    m.me.gold = amount;
    this.changed(m.trade);
    return null;
  }

  /** The two sides as the swap check wants them (live bags and gold). */
  private sides(trade: Trade, a: TradeActor, b: TradeActor): [SwapSide, SwapSide] {
    return [
      { name: trade.a.name, bag: a.player.bag, gold: a.player.gold, offers: trade.a.offers, offerGold: trade.a.gold },
      { name: trade.b.name, bag: b.player.bag, gold: b.player.gold, offers: trade.b.offers, offerGold: trade.b.gold },
    ];
  }

  /** Confirms the offer as it was when the player last saw it (`ver`). Both confirmed starts the countdown. */
  confirm(c: TradeActor, ver: unknown): string | null {
    const m = this.mine(c);
    if (typeof m === 'string') return m;
    if (ver !== m.trade.ver) return 'ข้อเสนอเพิ่งเปลี่ยน — ตรวจดูอีกครั้งแล้วกดยืนยัน';
    if (m.me.confirmed) return null;
    const { trade } = m;
    if (!trade.a.offers.length && !trade.b.offers.length && !trade.a.gold && !trade.b.gold) return 'ยังไม่มีของหรือทองในการเทรด';
    const a = this.host.actor(trade.a.charId);
    const b = this.host.actor(trade.b.charId);
    if (!a || !b) return 'อีกฝ่ายออกจากเกมไปแล้ว';
    // Refuse a confirm that could not go through (full bag, missing gold), so nobody waits for a doomed swap.
    const plan = planSwap(...this.sides(trade, a, b));
    if (!plan.ok) return plan.msg;
    m.me.confirmed = true;
    if (trade.a.confirmed && trade.b.confirmed) trade.countdownEnd = this.now() + TRADE_COUNTDOWN * 1000;
    this.push(trade);
    return null;
  }

  /** Either player closes the trade. */
  cancel(c: TradeActor): string | null {
    const m = this.mine(c);
    if (typeof m === 'string') return m;
    this.end(m.trade, false, `${c.name} ยกเลิกการเทรด`);
    return null;
  }

  /** A player left the game, died, changed map…: the trade (and any request they are part of) ends at once, everything stays where it is. */
  cancelChar(charId: number, why: string): void {
    const trade = this.byChar.get(charId);
    if (trade) this.end(trade, false, `ยกเลิกการเทรด — ${why}`);
    for (const r of this.requests.filter((x) => x.from === charId || x.to === charId)) {
      this.host.requestGone(r.to, r.from);
      this.host.tell(r.from === charId ? r.to : r.from, `คำขอเทรดของ ${r.from === charId ? r.fromName : r.toName} ถูกยกเลิก (${why})`);
    }
    this.requests = this.requests.filter((x) => x.from !== charId && x.to !== charId);
  }

  private end(trade: Trade, ok: boolean, msg: string): void {
    this.byChar.delete(trade.a.charId);
    this.byChar.delete(trade.b.charId);
    for (const s of [trade.a, trade.b]) {
      this.host.ended(s.charId, ok, msg);
      this.host.tell(s.charId, msg);
    }
  }

  // ------------------------------------------------------------ the swap

  /** The countdown ran out: check everything once more and swap, or cancel. */
  private commit(trade: Trade): void {
    const a = this.host.actor(trade.a.charId);
    const b = this.host.actor(trade.b.charId);
    if (!a || !b) return this.end(trade, false, 'ยกเลิกการเทรด — อีกฝ่ายออกจากเกม');
    if (!a.alive || !b.alive) return this.end(trade, false, 'ยกเลิกการเทรด — มีผู้เล่นเสียชีวิต');
    if (a.zone !== b.zone) return this.end(trade, false, 'ยกเลิกการเทรด — ผู้เล่นอยู่คนละแมพ');
    const plan = planSwap(...this.sides(trade, a, b));
    if (!plan.ok) return this.end(trade, false, `ยกเลิกการเทรด — ${plan.msg}`);

    const pa = a.player;
    const pb = b.player;
    // The plan holds copies, so the old entries themselves are never touched: a shallow copy of each bag is enough to put back.
    const before = { a: { bag: [...pa.bag], gold: pa.gold }, b: { bag: [...pb.bag], gold: pb.gold } };
    // Apply in place (the Player objects keep their bag arrays), then save both; put it all back if the save fails.
    for (let i = 0; i < pa.bag.length; i++) pa.bag[i] = plan.bagA[i];
    for (let i = 0; i < pb.bag.length; i++) pb.bag[i] = plan.bagB[i];
    pa.gold = plan.goldA;
    pb.gold = plan.goldB;
    const at = this.now();
    try {
      this.db.transaction(() => {
        this.db.tradeLogInsert({
          at, zone: a.zone,
          a: { charId: a.charId, accountId: a.accountId, name: a.name, items: trade.a.offers.map((o) => describeEntry(o.entry)), gold: trade.a.gold, tax: plan.taxA },
          b: { charId: b.charId, accountId: b.accountId, name: b.name, items: trade.b.offers.map((o) => describeEntry(o.entry)), gold: trade.b.gold, tax: plan.taxB },
        });
        this.db.writeCharacterAndStash(a.charId, pa.toData(), a.accountId, pa.stash);
        this.db.writeCharacterAndStash(b.charId, pb.toData(), b.accountId, pb.stash);
      });
    } catch (e) {
      for (let i = 0; i < pa.bag.length; i++) pa.bag[i] = before.a.bag[i];
      for (let i = 0; i < pb.bag.length; i++) pb.bag[i] = before.b.bag[i];
      pa.gold = before.a.gold;
      pb.gold = before.b.gold;
      console.error('[trade] saving failed, trade cancelled', e);
      return this.end(trade, false, 'ยกเลิกการเทรด — บันทึกข้อมูลไม่สำเร็จ ไม่มีอะไรเปลี่ยนแปลง');
    }
    a.sim.inventoryChanged(pa);
    b.sim.inventoryChanged(pb);
    const got = (me: Side, other: Side, taxOnMine: number): string => {
      const parts: string[] = [];
      if (other.offers.length) parts.push(`ของ ${other.offers.length} ช่อง`);
      if (other.gold) parts.push(`ทอง ${afterTax(other.gold).toLocaleString()} G (หักภาษี ${taxOf(other.gold).toLocaleString()} G)`);
      const gave = me.gold ? ` · คุณส่งทอง ${me.gold.toLocaleString()} G (ภาษี ${taxOnMine.toLocaleString()} G)` : '';
      return `เทรดสำเร็จ — คุณได้รับ ${parts.join(' + ') || 'ไม่มีอะไร'}${gave}`;
    };
    this.byChar.delete(trade.a.charId);
    this.byChar.delete(trade.b.charId);
    this.host.ended(trade.a.charId, true, got(trade.a, trade.b, plan.taxA));
    this.host.ended(trade.b.charId, true, got(trade.b, trade.a, plan.taxB));
    this.host.tell(trade.a.charId, got(trade.a, trade.b, plan.taxA));
    this.host.tell(trade.b.charId, got(trade.b, trade.a, plan.taxB));
  }

  // ------------------------------------------------------------ clock

  /** Called a few times a second: ends unanswered requests, cancels trades whose player died or left the map, runs the countdown. */
  tick(): void {
    const t = this.now();
    for (const r of this.requests.filter((x) => x.until <= t)) {
      this.host.requestGone(r.to, r.from);
      this.host.tell(r.from, `${r.toName} ไม่ได้ตอบรับคำขอเทรด (หมดเวลา)`);
    }
    this.requests = this.requests.filter((x) => x.until > t);
    for (const [k, at] of this.lastRequest) if (t - at >= TRADE_REREQUEST_GAP * 1000) this.lastRequest.delete(k);
    for (const trade of new Set(this.byChar.values())) {
      const a = this.host.actor(trade.a.charId);
      const b = this.host.actor(trade.b.charId);
      if (!a || !b) {
        this.end(trade, false, 'ยกเลิกการเทรด — อีกฝ่ายออกจากเกม');
        continue;
      }
      const dead = !a.alive ? a : !b.alive ? b : null;
      if (dead) {
        this.end(trade, false, `ยกเลิกการเทรด — ${dead.name} เสียชีวิต`);
        continue;
      }
      if (a.zone !== b.zone) {
        this.end(trade, false, 'ยกเลิกการเทรด — ผู้เล่นอยู่คนละแมพ');
        continue;
      }
      if (trade.countdownEnd !== null && trade.countdownEnd <= t) this.commit(trade);
    }
  }
}
