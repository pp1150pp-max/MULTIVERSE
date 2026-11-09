// Trade screens: the request popups, the "find a player" window, and the trade window itself (two columns,
// 8 offer slots and a gold offer each, CONFIRM / CANCEL). The server decides everything (server/trade.ts);
// this only shows its TradeView and sends what the player does. Plain CSS on purpose (src/style.css, the
// "trade" part): every part has its own id (trade-win, trade-a-slots, trade-confirm …) so a friend can
// paint the art over it later.
import type { Game } from './Game';
import { PARTY_SEARCH_MAX } from '../shared/party';
import { CLASSES } from '../shared/data/classes';
import { afterTax, TRADE_GOLD_MAX, TRADE_SLOTS, TRADE_TAX_PCT, type TradeOffer, type TradeSideView, type TradeView } from '../shared/trade';
import { playSound } from './audio/sfx';

const BLOCK_KEY = 'multiverse-trade-block';
const SEARCH_DELAY_MS = 300;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '', id = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  if (id) e.id = id;
  return e;
}

function loadBlock(): boolean {
  try {
    return localStorage.getItem(BLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

type Col = 'a' | 'b';

export class TradeUI {
  private readonly win: HTMLElement;
  private readonly find: HTMLElement;
  private readonly requestsBox: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly confirmBtn: HTMLButtonElement;
  private readonly cols: Record<Col, {
    title: HTMLElement; count: HTMLElement; slots: HTMLElement; goldBox: HTMLElement; goldInput: HTMLInputElement; goldText: HTMLElement; state: HTMLElement;
  }>;
  private readonly taxHint: HTMLElement;
  /** Open requests: asker's character id → popup and when it runs out (performance.now()). */
  private readonly requests = new Map<number, { el: HTMLElement; until: number; count: HTMLElement }>();
  private view: TradeView | null = null;
  /** When the swap countdown ends (performance.now()), or null. */
  private cdEnd: number | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchInput: HTMLInputElement | null = null;
  private results: HTMLElement | null = null;
  block = loadBlock();

  constructor(private readonly g: Game) {
    // ---- the trade window
    this.win = el('div', 'panel hidden', '', 'trade-win');
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕', 'trade-close');
    close.onclick = () => this.cancel();
    head.append(el('span', '', 'เทรด', 'trade-title'), close);
    const colsBox = el('div', '', '', 'trade-cols');
    const mk = (c: Col) => {
      const box = el('div', 'trade-col', '', `trade-col-${c}`);
      const title = el('div', 'trade-col-title', '', `trade-${c}-title`);
      const countRow = el('div', 'trade-row');
      const count = el('span', 'trade-count', '', `trade-${c}-count`);
      countRow.append(el('span', 'trade-label', 'ของที่เสนอ', `trade-${c}-offer-label`), count);
      const slots = el('div', 'trade-slots', '', `trade-${c}-slots`);
      const goldBox = el('div', 'trade-gold', '', `trade-${c}-gold`);
      const goldInput = el('input', 'trade-gold-input', '', `trade-${c}-gold-input`);
      goldInput.type = 'number';
      goldInput.min = '0';
      goldInput.max = String(TRADE_GOLD_MAX);
      goldInput.step = '1';
      // Keys typed here are for the box, not the game (WASD, I, M…).
      goldInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') goldInput.blur();
        else if (e.key === 'Escape') {
          goldInput.value = String(this.sideOf(c)?.gold ?? 0);
          goldInput.blur();
        }
      });
      goldInput.addEventListener('change', () => this.sendGold(goldInput));
      const goldText = el('span', 'trade-gold-text', '0', `trade-${c}-gold-text`);
      goldBox.append(goldInput, goldText);
      const state = el('span', 'trade-state', '', `trade-${c}-state`);
      box.append(title, countRow, slots, el('div', 'trade-label', 'ทองที่เสนอ', `trade-${c}-gold-label`), goldBox);
      return { box, parts: { title, count, slots, goldBox, goldInput, goldText, state } };
    };
    const ma = mk('a');
    const mb = mk('b');
    this.cols = { a: ma.parts, b: mb.parts };
    colsBox.append(ma.box, mb.box);
    this.taxHint = el('div', 'trade-tax', '', 'trade-tax');
    const states = el('div', '', '', 'trade-states');
    for (const c of ['a', 'b'] as const) {
      const row = el('div', 'trade-state-row', '', `trade-${c}-state-row`);
      row.append(el('span', '', '', `trade-${c}-state-name`), this.cols[c].state);
      states.append(row);
    }
    const statusBox = el('div', '', '', 'trade-status-box');
    this.statusEl = el('div', '', '', 'trade-status');
    statusBox.append(el('div', 'trade-label', 'สถานะการเทรด', 'trade-status-label'), this.statusEl);
    const btns = el('div', '', '', 'trade-buttons');
    this.confirmBtn = el('button', 'primary', 'ยืนยัน', 'trade-confirm');
    this.confirmBtn.onclick = () => this.confirm();
    const cancelBtn = el('button', '', 'ยกเลิก', 'trade-cancel');
    cancelBtn.onclick = () => this.cancel();
    btns.append(this.confirmBtn, cancelBtn);
    this.win.append(head, colsBox, this.taxHint, states, statusBox, btns);
    $('hud').append(this.win);

    // ---- who to ask (the same online list the party invite uses)
    this.find = el('div', 'panel hidden', '', 'trade-find');
    const fhead = el('div', 'panel-head');
    const fclose = el('button', '', '✕');
    fclose.onclick = () => this.toggleFind(false);
    fhead.append(el('span', '', 'ขอเทรดกับผู้เล่น'), fclose);
    const fbody = el('div', '', '', 'trade-find-body');
    const input = el('input', '', '', 'trade-find-input');
    input.maxLength = PARTY_SEARCH_MAX;
    input.placeholder = 'ค้นหาชื่อผู้เล่นที่ออนไลน์';
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') input.blur();
    });
    input.addEventListener('input', () => this.searchSoon());
    const results = el('div', '', '', 'trade-find-results');
    fbody.append(input, results, el('div', 'hint', 'ต้องเป็นสมาชิก (ไม่ใช่ Guest) อยู่แมพเดียวกัน · หรือคลิกที่ตัวผู้เล่นในโลกแล้วเลือก "ขอเทรด"'));
    this.find.append(fhead, fbody);
    this.searchInput = input;
    this.results = results;
    $('hud').append(this.find);

    this.requestsBox = el('div', '', '', 'trade-requests');
    $('hud').append(this.requestsBox);

    g.backend.setTradeBlock(this.block);
  }

  // ------------------------------------------------------------ state

  /** The trade window is open. */
  get open(): boolean {
    return this.view !== null;
  }

  /** Bag slots on offer right now (marked in the bag, and refused by the server for other actions). */
  offeredSlots(): Set<number> {
    const v = this.view;
    if (!v) return new Set();
    return new Set(this.sideOf(v.you)?.items.map((o) => o.slot));
  }

  private sideOf(c: Col): TradeSideView | undefined {
    return this.view ? this.view[c] : undefined;
  }

  /** The "don't accept trade requests" setting (remembered by this browser). */
  setBlock(on: boolean): void {
    this.block = on;
    try {
      localStorage.setItem(BLOCK_KEY, on ? '1' : '0');
    } catch {
      // Storage blocked: it holds for this visit only.
    }
    this.g.backend.setTradeBlock(on);
  }

  // ------------------------------------------------------------ asking

  request(name: string): void {
    this.g.backend.tradeRequest(name);
  }

  toggleFind(force?: boolean): void {
    const show = force ?? this.find.classList.contains('hidden');
    this.find.classList.toggle('hidden', !show);
    if (show) {
      this.searchSoon(0);
      setTimeout(() => this.searchInput?.focus(), 0);
    }
  }

  private searchSoon(delay = SEARCH_DELAY_MS): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.search(), delay);
  }

  private async search(): Promise<void> {
    const input = this.searchInput;
    const out = this.results;
    if (!input || !out || this.find.classList.contains('hidden')) return;
    const list = await this.g.backend.partySearch(input.value);
    out.replaceChildren();
    if (!list.length) out.append(el('div', 'hint', 'ไม่พบผู้เล่นที่ออนไลน์'));
    for (const f of list) {
      const row = el('div', 'trade-found');
      row.append(el('span', '', `${f.name} Lv.${f.lv} ${CLASSES[f.cls]?.name ?? ''}`));
      const btn = el('button', '', 'ขอเทรด');
      btn.onclick = () => this.request(f.name);
      row.append(btn);
      out.append(row);
    }
  }

  /** Someone asks you to trade: a popup with accept / decline, counting down. */
  requested(from: number, name: string, seconds: number): void {
    this.removeRequest(from);
    const box = el('div', 'trade-request');
    const text = el('div');
    text.append(el('b', '', name), document.createTextNode(' ขอเทรดกับคุณ'));
    const count = el('span', 'trade-count-down');
    const yes = el('button', 'primary', 'ยอมรับ');
    const no = el('button', '', 'ปฏิเสธ');
    yes.onclick = () => {
      this.g.backend.tradeAnswer(from, true);
      this.removeRequest(from);
    };
    no.onclick = () => {
      this.g.backend.tradeAnswer(from, false);
      this.removeRequest(from);
    };
    const btns = el('div', 'trade-request-btns');
    btns.append(yes, no, count);
    box.append(text, btns);
    this.requestsBox.append(box);
    this.requests.set(from, { el: box, until: performance.now() + seconds * 1000, count });
    playSound('trade');
    this.update();
  }

  removeRequest(from: number): void {
    this.requests.get(from)?.el.remove();
    this.requests.delete(from);
  }

  // ------------------------------------------------------------ the open trade

  /** The server's state of the trade (sent on every change). Opens the window on the first one. */
  show(v: TradeView): void {
    const first = !this.view;
    this.view = v;
    this.cdEnd = v.cd === null ? null : performance.now() + v.cd * 1000;
    if (first) {
      this.toggleFind(false);
      this.g.hud.toggleBag(true);
      this.win.classList.remove('hidden');
    }
    this.render();
    this.g.hud.markInventory();
  }

  /** The trade is over (it went through, or was cancelled): the server's line is in the chat. */
  ended(ok: boolean): void {
    if (!this.view) return;
    this.view = null;
    this.cdEnd = null;
    this.win.classList.add('hidden');
    if (ok) playSound('trade');
    this.g.hud.markInventory();
  }

  private render(): void {
    const v = this.view;
    if (!v) return;
    for (const c of ['a', 'b'] as const) {
      const side = v[c];
      const mine = v.you === c;
      const p = this.cols[c];
      $(`trade-${c}-title`).textContent = `ผู้เล่น ${c.toUpperCase()}: ${side.name}${mine ? ' (คุณ)' : ''}`;
      p.count.textContent = `${side.items.length} / ${TRADE_SLOTS}`;
      this.renderSlots(c, side.items, mine);
      p.goldInput.classList.toggle('hidden', !mine);
      p.goldText.classList.toggle('hidden', mine);
      p.goldText.textContent = side.gold.toLocaleString();
      // Keep what is being typed; the box follows the server otherwise.
      if (mine && document.activeElement !== p.goldInput) p.goldInput.value = String(side.gold);
      $(`trade-${c}-state-name`).textContent = `ผู้เล่น ${c.toUpperCase()}${mine ? ' (คุณ)' : ''}`;
      p.state.textContent = side.confirmed ? 'ยืนยันแล้ว' : 'รอยืนยัน';
      p.state.className = `trade-state ${side.confirmed ? 'confirmed' : 'waiting'}`;
    }
    const mineSide = v[v.you];
    this.confirmBtn.disabled = mineSide.confirmed;
    this.confirmBtn.textContent = mineSide.confirmed ? 'ยืนยันแล้ว' : 'ยืนยัน';
    const other = v[v.you === 'a' ? 'b' : 'a'];
    this.taxHint.textContent = other.gold > 0
      ? `ทองที่ ${other.name} ส่งให้ ${other.gold.toLocaleString()} G · คุณจะได้ ${afterTax(other.gold).toLocaleString()} G (หักภาษี ${TRADE_TAX_PCT}%)`
      : `ทองที่ส่งโดนหักภาษี ${TRADE_TAX_PCT}% (ผู้รับได้ ${100 - TRADE_TAX_PCT}%)`;
    this.updateStatus();
  }

  private renderSlots(c: Col, items: TradeOffer[], mine: boolean): void {
    const box = this.cols[c].slots;
    box.replaceChildren();
    for (let i = 0; i < TRADE_SLOTS; i++) {
      const o = items[i];
      const slot = el('div', 'trade-slot', '', `trade-${c}-slot-${i}`);
      slot.innerHTML = this.g.hud.itemCell(o?.entry ?? null, '', '+');
      if (o) {
        slot.addEventListener('mousemove', (e) => this.g.hud.showEntryTip(o.entry, e, mine ? 'คลิก: เอาออกจากข้อเสนอ' : ''));
        slot.addEventListener('mouseleave', () => this.g.hud.hideTip());
        if (mine) {
          slot.addEventListener('click', () => {
            this.g.hud.hideTip();
            this.g.backend.tradeRemove(o.slot);
          });
        }
      }
      box.append(slot);
    }
  }

  private updateStatus(): void {
    const v = this.view;
    if (!v) return;
    const me = v[v.you];
    const other = v[v.you === 'a' ? 'b' : 'a'];
    let text: string;
    if (this.cdEnd !== null) text = `กำลังแลกเปลี่ยนใน ${Math.max(1, Math.ceil((this.cdEnd - performance.now()) / 1000))} วินาที… (ถ้ามีใครแก้ข้อเสนอ การยืนยันจะถูกยกเลิก)`;
    else if (me.confirmed && !other.confirmed) text = `รอ ${other.name} กดยืนยัน`;
    else if (!me.confirmed && other.confirmed) text = `${other.name} ยืนยันแล้ว — รอคุณกดยืนยัน`;
    else text = 'รอทั้งสองฝ่ายกดยืนยัน';
    if (this.statusEl.textContent !== text) this.statusEl.textContent = text;
  }

  private sendGold(input: HTMLInputElement): void {
    const v = this.view;
    if (!v) return;
    const raw = Number(input.value);
    const gold = Math.max(0, Math.min(Math.floor(Number.isFinite(raw) ? raw : 0), TRADE_GOLD_MAX, this.g.player.gold));
    input.value = String(gold);
    if (gold !== v[v.you].gold) this.g.backend.tradeGold(gold);
  }

  private confirm(): void {
    const v = this.view;
    if (v && !v[v.you].confirmed) this.g.backend.tradeConfirm(v.ver);
  }

  /** Closing the window (✕, Esc, CANCEL) cancels the trade. Nothing was ever taken from the bags, so nothing needs returning. */
  cancel(): void {
    if (this.view) this.g.backend.tradeCancel();
  }

  // ------------------------------------------------------------ the bag

  /** A bag slot was clicked or dragged onto the window while trading: offer all of it, or `n` of a stack. */
  offer(slot: number, n?: number): void {
    if (this.view) this.g.backend.tradeAdd(slot, n);
  }

  /** Whether this window (or its slots) is under the mouse target; for drag and drop from the bag. */
  isTarget(t: HTMLElement | null | undefined): boolean {
    return !!this.view && !!t?.closest('#trade-win');
  }

  // ------------------------------------------------------------ per frame

  update(): void {
    const now = performance.now();
    for (const [id, r] of this.requests) {
      const left = Math.ceil((r.until - now) / 1000);
      if (left <= 0) this.removeRequest(id);
      else r.count.textContent = `${left} วิ`;
    }
    if (this.view && this.cdEnd !== null) this.updateStatus();
  }
}
