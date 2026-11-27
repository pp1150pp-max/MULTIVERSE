// The merchant's shop inside the NPC talk window (owner 2026-11-27, layout "A"; docs/systems/world-and-ui.md
// "ร้านพ่อค้าในหน้าต่างคุย"): "ซื้อ/ขายของ" grows the talk window, the portrait shrinks to a round medallion with a
// speech bubble beside it, the merchant's side (ซื้อ / ซื้อคืน / ขาย) on the left and the bag on the right.
// Click a bag item = into the sell basket, right click = sell it now. Every prompt opens inside the window (the HUD's
// confirm/amount boxes sit under it). Trades go through the same backend calls as the old window, plus sellMany.
// Switch: currentBalance().npcTalk.shopPane (off = the old small shop window). Browser only.
import type { Game } from '../Game';
import { sellValue } from '../../shared/data/enhance';
import { anyStackValue, entryName, POTION_SIZES, POTION_STACK, potionHeal, potionName, potionPrice } from '../../shared/data/potions';
import { PHOENIX_PRICE, RETURN_SCROLL_PRICE, STONE_COLOR, STONE_DESC, STONE_NAME, STONE_STACK, stoneUnit } from '../../shared/data/stones';
import { buybackPrice } from '../../shared/sim/Player';
import { isBulkSellable, sellPickKey, sellPickOf, type SellPick } from '../../shared/sim/Sim';
import { hasCards, isDrilled } from '../../shared/cardSockets';
import { tabRange, type BagTab } from '../../shared/bagTabs';
import { isBound, isItem, isOrbStone, isPotion, isStack, isStone, RARITIES, RARITY_COLOR, RARITY_LABEL, type BagEntry, type PotionKind, type PotionSize, type Rarity } from '../../shared/types';
import { COIN_ICON, potionIcon, stoneIcon } from '../icons';
import { entryColor, POTION_COLOR, potionTotals } from './hudShared';
import { isTouchMode } from '../touch/device';

type MerTab = 'buy' | 'bb' | 'sell';
/** Something on sale: a potion size, the phoenix feather or the return scroll. */
type Good = { kind: 'pot'; potion: PotionKind; size: PotionSize } | { kind: 'phoenix' } | { kind: 'scroll' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
const fmt = (n: number): string => Math.round(n).toLocaleString();
const gold = (n: number): string => `${COIN_ICON} ${fmt(n)}`;
/** What a whole bag slot sells for. */
const slotValue = (e: BagEntry): number => (isStack(e) ? anyStackValue(e) : sellValue(e));
/** The merchant takes it (bound things and orb items he does not). */
const sellable = (e: BagEntry | null | undefined): boolean => !!e && !isBound(e) && !(isStone(e) && isOrbStone(e.stone));
const nameHtml = (e: BagEntry): string => `<b style="color:${entryColor(e)}">${entryName(e)}</b>`;

export class NpcShopPane {
  readonly root: HTMLElement;
  private readonly medal: HTMLElement;
  private readonly medalImg: HTMLImageElement;
  private readonly bubble: HTMLElement;
  private readonly merTabs: HTMLElement;
  private readonly merBody: HTMLElement;
  private readonly bagTabs: HTMLElement;
  private readonly bagBody: HTMLElement;
  private readonly foot: HTMLElement;
  private readonly modal: HTMLElement;
  private readonly card: HTMLElement;
  private tab: MerTab = 'buy';
  private bagTab: BagTab = 'gear';
  /** Bag slot → what was picked there (Sim.sellMany checks it again). */
  private readonly basket = new Map<number, SellPick>();
  private drawn = '';

  constructor(private readonly g: Game, private readonly say: (html: string) => void) {
    this.root = el('div', 'ns');
    this.medal = el('div', 'ns-medal');
    this.medalImg = el('img');
    this.medalImg.alt = '';
    this.medal.append(this.medalImg);
    this.bubble = el('div', 'ns-bubble');

    const mer = el('section', 'ns-pnl ns-mer');
    mer.append(el('div', 'ns-title', 'สินค้าของพ่อค้า'));
    this.merTabs = el('div', 'ns-tabs');
    for (const [t, label] of [['buy', 'ซื้อ'], ['bb', 'ซื้อคืน'], ['sell', 'ขาย']] as const) {
      const b = el('button', 'ns-tab', `${label}<span class="n"></span>`);
      b.dataset.t = t;
      b.onclick = () => { this.tab = t; this.redraw(); };
      this.merTabs.append(b);
    }
    this.merBody = el('div', 'ns-body');
    mer.append(this.merTabs, this.merBody);

    const bag = el('section', 'ns-pnl ns-bag');
    bag.append(el('div', 'ns-title', 'กระเป๋าของฉัน'));
    this.bagTabs = el('div', 'ns-tabs');
    for (const [t, label] of [['gear', 'กระเป๋า'], ['use', 'ประเภทใช้งาน']] as const) {
      const b = el('button', 'ns-tab', label);
      b.dataset.b = t;
      b.onclick = () => { this.bagTab = t; this.redraw(); };
      this.bagTabs.append(b);
    }
    this.bagBody = el('div', 'ns-body');
    const hint = el('div', 'ns-hint', isTouchMode()
      ? 'แตะ = ใส่/เอาออกจากตะกร้าขาย · <b>ห้ามสวม/ถอดขณะเปิดร้าน</b>'
      : 'คลิก = ใส่/เอาออกจากตะกร้าขาย · คลิกขวา = ขายทันที · <b>ห้ามสวม/ถอดขณะเปิดร้าน</b>');
    this.foot = el('div', 'ns-foot');
    bag.append(this.bagTabs, this.bagBody, hint, this.foot);

    this.modal = el('div', 'ns-modal hidden');
    this.card = el('div', 'ns-card');
    this.modal.append(this.card);
    this.modal.onclick = (e) => { if (e.target === this.modal) this.closeModal(); };

    this.root.append(this.medal, this.bubble, mer, bag, this.modal);
    this.root.addEventListener('mouseleave', () => this.g.hud.hideTip());
  }

  /** Shows the shop on tab `tab`; `face` = the portrait picture, `small` = a square harbour portrait. */
  open(tab: MerTab, face: string, small: boolean): void {
    this.tab = tab;
    this.basket.clear();
    this.closeModal();
    this.medalImg.src = face;
    this.medal.classList.toggle('small', small);
    this.medal.classList.toggle('hidden', !face);
    this.drawn = '';
    this.redraw();
  }

  close(): void {
    this.closeModal();
    this.basket.clear();
    this.g.hud.hideTip();
  }

  /** The bubble beside the medallion (the talk box is hidden while shopping). */
  setLine(html: string): void {
    this.bubble.innerHTML = html;
    this.bubble.classList.remove('pop');
    void this.bubble.offsetWidth;
    this.bubble.classList.add('pop');
  }

  /** Every frame: redraws only when something shown changed; the buyback timer ticks on its own. */
  update(): void {
    const p = this.g.player;
    this.prune();
    const bagSig = p.bag.map((e) => (!e ? '' : isItem(e) ? `${e.uid}+${e.plus ?? 0}` : `${sellPickKey(e)}x${e.count}`)).join(',');
    const sig = [this.tab, this.bagTab, p.gold, bagSig, p.buyback.map((b) => b.item.uid).join(','), [...this.basket.keys()].join(',')].join('|');
    if (sig !== this.drawn) this.redraw(sig);
    const tm = this.merBody.querySelector('.ns-timer');
    if (tm) {
      const s = Math.max(0, Math.ceil(p.buybackLeft));
      tm.textContent = `รีเซ็ตใน ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
  }

  /** Drops basket picks whose slot no longer holds what was picked. */
  private prune(): void {
    const bag = this.g.player.bag;
    for (const [i, pk] of this.basket) {
      const e = bag[i];
      if (!e || (isItem(e) ? e.uid !== pk.uid : sellPickKey(e) !== pk.k)) this.basket.delete(i);
    }
  }

  private redraw(sig = ''): void {
    this.drawn = sig;
    const p = this.g.player;
    for (const b of this.merTabs.querySelectorAll<HTMLElement>('.ns-tab')) {
      b.classList.toggle('on', b.dataset.t === this.tab);
      const n = b.querySelector('.n')!;
      n.textContent = b.dataset.t === 'bb' && p.buyback.length ? ` (${p.buyback.length})` : b.dataset.t === 'sell' && this.basket.size ? ` (${this.basket.size})` : '';
    }
    for (const b of this.bagTabs.querySelectorAll<HTMLElement>('.ns-tab')) b.classList.toggle('on', b.dataset.b === this.bagTab);
    this.foot.innerHTML = `<span class="g">${gold(p.gold)} G</span><span class="pots">${potionTotals(p)}</span>`;
    if (this.tab === 'buy') this.drawBuy();
    else if (this.tab === 'bb') this.drawBuyback();
    else this.drawSell();
    this.drawBag();
    if (!sig) this.drawn = '';
  }

  // ------------------------------------------------------------ merchant side

  private goods(): Good[] {
    return [
      ...(['hp', 'mp'] as const).flatMap((potion) => POTION_SIZES.map((size): Good => ({ kind: 'pot', potion, size }))),
      { kind: 'phoenix' }, { kind: 'scroll' },
    ];
  }
  private goodInfo(gd: Good): { icon: string; name: string; sub: string; price: number; room: number; color: string } {
    const p = this.g.player;
    if (gd.kind === 'pot') {
      return {
        icon: potionIcon(gd.potion, gd.size), name: potionName(gd.potion, gd.size), color: POTION_COLOR[gd.potion],
        sub: `ฟื้น ${potionHeal(gd.potion, gd.size, p.cls.id)} ${gd.potion.toUpperCase()} · มี ${p.potionCount(gd.potion, gd.size)}`,
        price: potionPrice(gd.potion, gd.size), room: p.potionRoom(gd.potion, gd.size),
      };
    }
    const k = gd.kind === 'phoenix' ? 'phoenix' : 'return_scroll';
    return {
      icon: stoneIcon(k), name: STONE_NAME[k], color: STONE_COLOR[k], sub: `${STONE_DESC[k]} · มี ${p.stoneCount(k)}`,
      price: gd.kind === 'phoenix' ? PHOENIX_PRICE : RETURN_SCROLL_PRICE, room: p.stoneRoom(k),
    };
  }

  private drawBuy(): void {
    const b = this.merBody;
    b.replaceChildren(el('div', 'ns-note', '<span>คลิกสินค้าเพื่อเลือกจำนวน</span>'));
    const list = el('div', 'ns-goods');
    for (const gd of this.goods()) {
      const it = this.goodInfo(gd);
      const row = el('button', 'ns-good', `<span class="ic" style="--rc:${it.color}">${it.icon}</span><span class="tx"><span class="nm">${it.name}</span><span class="sub">${it.sub}</span></span><span class="pr">${gold(it.price)}</span>`);
      row.classList.toggle('poor', this.g.player.gold < it.price || it.room < 1);
      row.onclick = () => this.askBuy(gd);
      list.append(row);
    }
    b.append(list);
  }

  private drawBuyback(): void {
    const p = this.g.player;
    const b = this.merBody;
    b.replaceChildren(el('div', 'ns-note', '<span>ของที่ขายไป ซื้อคืนได้ราคา <b>+20%</b> · เก็บ 30 ชิ้นล่าสุด</span><span class="ns-timer"></span>'));
    if (!p.buyback.length) {
      b.append(el('div', 'ns-empty', 'ยังไม่มีของที่ขายไป'));
      return;
    }
    const grid = el('div', 'ns-grid ns-bb');
    p.buyback.forEach((entry, i) => {
      const w = el('div', 'ns-bbcell');
      w.innerHTML = this.g.hud.itemCell(entry.item, '') + `<span class="pr">${fmt(buybackPrice(entry))}</span>`;
      const c = w.firstElementChild as HTMLElement;
      c.classList.toggle('poor', p.gold < buybackPrice(entry));
      c.onmousemove = (e) => { if (!isTouchMode()) this.g.hud.showTip(entry.item, e, `คลิก: ซื้อคืน ${fmt(buybackPrice(entry))} G`); };
      c.onclick = () => this.askBuyback(i);
      grid.append(w);
    });
    b.append(grid);
  }

  private drawSell(): void {
    const p = this.g.player;
    const b = this.merBody;
    b.replaceChildren(el('div', 'ns-note', '<span>คลิกของในกระเป๋าเพื่อใส่ตะกร้า หรือเลือกตามความหายาก (ไม่รวมของที่ตีบวก/เจาะรูแล้ว)</span>'));
    const chips = el('div', 'ns-chips');
    for (const r of RARITIES) {
      const idx = p.bag.flatMap((e, i) => (isBulkSellable(e, r) ? [i] : []));
      const all = idx.length > 0 && idx.every((i) => this.basket.has(i));
      const c = el('button', `ns-chip${all ? ' on' : ''}`, `${RARITY_LABEL[r]} <span class="n">(${idx.length})</span>`);
      c.style.setProperty('--rc', RARITY_COLOR[r]);
      c.disabled = !idx.length;
      c.onclick = () => this.toggleRarity(r, idx, all);
      chips.append(c);
    }
    b.append(chips);
    const picks = this.pickedEntries();
    const box = el('div', 'ns-basket');
    if (!picks.length) box.append(el('div', 'ns-empty', 'ตะกร้าว่าง · คลิกของในกระเป๋าทางขวาเพื่อใส่'));
    else {
      const grid = el('div', 'ns-grid');
      for (const [i, e] of picks) {
        const w = el('div', '');
        w.innerHTML = this.g.hud.itemCell(e, '');
        const c = w.firstElementChild as HTMLElement;
        c.onmousemove = (ev) => { if (!isTouchMode()) this.g.hud.showEntryTip(e, ev, `ขายได้ ${fmt(slotValue(e))} G · คลิก: เอาออกจากตะกร้า`); };
        c.onclick = () => { this.basket.delete(i); this.g.hud.hideTip(); this.redraw(); };
        grid.append(c);
      }
      box.append(grid);
    }
    b.append(box);
    const total = picks.reduce((s, [, e]) => s + slotValue(e), 0);
    const bar = el('div', 'ns-sellbar', `<span class="sum">${picks.length} ชิ้น · ได้ <b>${gold(total)}</b> G</span>`);
    const clr = el('button', 'ns-ghost', 'ล้าง');
    clr.disabled = !picks.length;
    clr.onclick = () => { this.basket.clear(); this.redraw(); };
    const go = el('button', 'ns-big', 'ขายทั้งหมด');
    go.disabled = !picks.length;
    go.onclick = () => this.askSellBasket();
    bar.append(clr, go);
    b.append(bar);
  }

  private pickedEntries(): [number, BagEntry][] {
    const bag = this.g.player.bag;
    return [...this.basket.keys()].sort((a, b) => a - b).flatMap((i) => (bag[i] ? [[i, bag[i]!] as [number, BagEntry]] : []));
  }

  private toggleRarity(r: Rarity, idx: number[], all: boolean): void {
    const bag = this.g.player.bag;
    for (const i of idx) {
      if (all) this.basket.delete(i);
      else this.basket.set(i, sellPickOf(bag[i]!, i));
    }
    if (!all && idx.length) this.say(`ของระดับ<span class="hl">${RARITY_LABEL[r]}</span> ${idx.length} ชิ้น… ข้ารับหมด!`);
    this.redraw();
  }

  // ------------------------------------------------------------ bag side

  private drawBag(): void {
    const p = this.g.player;
    const [a, z] = tabRange(p.bagSlots, this.bagTab);
    const grid = el('div', 'ns-grid ns-baggrid');
    for (let i = a; i < z; i++) {
      const e = p.bag[i];
      const w = el('div', '');
      w.innerHTML = this.g.hud.itemCell(e, '');
      const c = w.firstElementChild as HTMLElement;
      if (e) {
        if (this.basket.has(i)) c.classList.add('ns-picked');
        if (!sellable(e)) c.classList.add('ns-nosell');
        c.onmousemove = (ev) => {
          if (isTouchMode()) return;
          this.g.hud.showEntryTip(e, ev, sellable(e) ? `ขายได้ ${fmt(slotValue(e))} G · คลิก: ${this.basket.has(i) ? 'เอาออกจากตะกร้า' : 'ใส่ตะกร้าขาย'} · คลิกขวา: ขายทันที` : 'พ่อค้าไม่รับซื้อ');
        };
        c.onclick = () => this.pick(i);
        c.oncontextmenu = (ev) => { ev.preventDefault(); this.quickSell(i); };
      }
      grid.append(c);
    }
    this.bagBody.replaceChildren(grid);
  }

  private pick(i: number): void {
    const e = this.g.player.bag[i];
    if (!e) return;
    this.g.hud.hideTip();
    if (!sellable(e)) {
      this.say(isStone(e) && isOrbStone(e.stone) ? 'ข้าไม่รับซื้อลูกแก้วนะ ลองเทรดหรือลงตลาดดู' : 'อันนี้<span class="hl">ผูกกับตัวเจ้า</span> ข้ารับซื้อไม่ได้หรอก');
      return;
    }
    if (this.basket.has(i)) this.basket.delete(i);
    else {
      this.basket.set(i, sellPickOf(e, i));
      this.say(isItem(e) && e.rarity === 'legendary'
        ? `โอ้โห ${nameHtml(e)} ของตำนานเลยนี่! จะขายจริงเหรอ?`
        : `${nameHtml(e)}… ข้าให้ <span class="hl">${fmt(slotValue(e))} G</span>`);
    }
    this.tab = 'sell';
    this.redraw();
  }

  /** Right click: sell this slot now (asks how many for a stack, and first for enhanced/drilled gear or stones). */
  private quickSell(i: number): void {
    const g = this.g;
    const e = g.player.bag[i];
    if (!e) return;
    g.hud.hideTip();
    if (!sellable(e)) return this.pick(i);
    const sell = (n?: number) => {
      if (g.player.bag[i] !== e) return;
      g.backend.sell(i, n);
      this.basket.delete(i);
      this.say(`ตกลง! ${nameHtml(e)} ได้ <span class="hl">${fmt(n && isStack(e) ? Math.round(slotValue(e) * n / e.count) : slotValue(e))} G</span>`);
    };
    if (isStack(e) && e.count > 1) {
      const unit = isPotion(e) ? 'ขวด' : stoneUnit(e.stone);
      return this.askAmount(`ขาย ${nameHtml(e)} กี่${unit}?`, isStone(e) ? 'หิน/ม้วนซื้อคืนไม่ได้' : '', e.count, e.count,
        (n) => Math.round(slotValue(e) * n / e.count), (n) => sell(n >= e.count ? undefined : n), 'ขาย');
    }
    const warn = this.warnings([e]);
    if (warn.length) return this.confirm('ขาย', [e], slotValue(e), warn, () => sell());
    sell();
  }

  // ------------------------------------------------------------ trades

  /** What to warn about before selling these: the old shop's warnings, kept. */
  private warnings(list: BagEntry[]): string[] {
    const out: string[] = [];
    const plus = list.filter((e) => isItem(e) && ((e.plus ?? 0) > 0 || isDrilled(e))).length;
    const cards = list.filter((e) => isItem(e) && hasCards(e)).length;
    const stones = list.filter((e) => isStone(e)).length;
    const top = list.filter((e) => isItem(e) && (e.rarity === 'epic' || e.rarity === 'legendary')).length;
    if (plus) out.push(`มีของที่ตีบวกหรือเจาะรูแล้ว ${plus} ชิ้น`);
    if (cards) out.push(`⚠ มีการ์ดเสียบอยู่ ${cards} ชิ้น การ์ดจะไปกับอุปกรณ์ ราคาไม่รวมการ์ด`);
    if (top) out.push(`มีของมหากาพย์/ตำนาน ${top} ชิ้น`);
    if (stones) out.push('หิน/ม้วน/ยาที่ขายซื้อคืนไม่ได้');
    return out;
  }

  private askSellBasket(): void {
    const picks = this.pickedEntries().filter(([, e]) => sellable(e));
    if (!picks.length) return;
    const total = picks.reduce((s, [, e]) => s + slotValue(e), 0);
    this.confirm(`ขาย ${picks.length} ชิ้น`, picks.map(([, e]) => e), total, this.warnings(picks.map(([, e]) => e)), () => {
      this.g.backend.sellMany(picks.map(([i, e]) => sellPickOf(e, i)));
      this.basket.clear();
      this.say(picks.length > 3 ? `ว้าว ขนมาเยอะเลย! รับไป <span class="hl">${fmt(total)} G</span>` : `ตกลง! นี่ <span class="hl">${fmt(total)} G</span> ของเจ้า`);
    });
  }

  private askBuy(gd: Good): void {
    const p = this.g.player;
    const it = this.goodInfo(gd);
    const max = Math.min(99, it.room, Math.floor(p.gold / it.price));
    if (it.room < 1) return this.say('กระเป๋าเต็มแล้ว! ขายอะไรออกก่อนสิ');
    if (max < 1) return this.say('ทองไม่พอนะ… ไป<span class="hl">ล่ามอน</span>มาเพิ่มก่อนแล้วค่อยมาใหม่');
    const stack = gd.kind === 'pot' ? POTION_STACK : STONE_STACK;
    this.askAmount(`<span class="ns-cardic" style="--rc:${it.color}">${it.icon}</span><div class="nm">${it.name}</div>`, `${it.sub} · ช่องละ ${stack}`, max, 1,
      (n) => n * it.price, (n) => {
        if (gd.kind === 'pot') this.g.backend.buyPotion(gd.potion, gd.size, n);
        else if (gd.kind === 'phoenix') this.g.backend.buyPhoenix(n);
        else this.g.backend.buyReturnScroll(n);
        this.say(`ขอบใจนะ! <span class="hl">${it.name} ×${n}</span> ใช้ให้คุ้มล่ะ`);
      }, 'ซื้อ', stack);
  }

  private askBuyback(i: number): void {
    const g = this.g;
    const entry = g.player.buyback[i];
    if (!entry) return;
    const price = buybackPrice(entry);
    g.hud.hideTip();
    if (g.player.gold < price) return this.say('ทองไม่พอซื้อคืนนะ');
    if (!g.player.hasBagSpace('gear')) return this.say('กระเป๋าเต็มแล้ว! ขายอะไรออกก่อนสิ');
    this.confirm('ซื้อคืน', [entry.item], price, [], () => {
      if (g.player.buyback[i]?.item.uid !== entry.item.uid) return;
      g.backend.buyBack(i, entry.item.uid);
      this.say(`เอ้า คืนให้แล้ว ${nameHtml(entry.item)} ดูแลให้ดีล่ะ`);
    }, 'จ่าย');
  }

  // ------------------------------------------------------------ prompts inside the window

  /** Closes an open prompt; false when none was open. */
  dismissPrompt(): boolean {
    if (this.modal.classList.contains('hidden')) return false;
    this.closeModal();
    return true;
  }

  private closeModal(): void {
    this.modal.classList.add('hidden');
    this.card.replaceChildren();
  }

  private showModal(title: string, body: string, buttons: [string, string, () => void][]): void {
    this.g.hud.hideTip();
    this.card.innerHTML = `<div class="ns-title">${title}</div>${body}`;
    const row = el('div', 'ns-row');
    for (const [label, cls, run] of buttons) {
      const b = el('button', cls, label);
      b.onclick = () => { this.closeModal(); run(); };
      row.append(b);
    }
    this.card.append(row);
    this.modal.classList.remove('hidden');
  }

  private confirm(title: string, list: BagEntry[], total: number, warn: string[], yes: () => void, verb = 'ได้รับ'): void {
    const icons = list.slice(0, 10).map((e) => this.g.hud.itemCell(e, '')).join('');
    const more = list.length > 10 ? `<div class="ns-more">และอีก ${list.length - 10} ชิ้น</div>` : '';
    const one = list.length === 1 ? `<div class="nm">${nameHtml(list[0])}</div>` : '';
    this.showModal(title,
      `<div class="ns-grid ns-confirm">${icons}</div>${more}${one}` +
      (warn.length ? `<div class="ns-warn">${warn.join('<br>')}</div>` : '') +
      (verb === 'ได้รับ' && list.some(isItem) ? '<div class="ns-msg">อุปกรณ์ซื้อคืนได้ภายหลังในราคา +20%</div>' : '') +
      `<div class="ns-tot">${verb} <b>${gold(total)}</b> G</div>`,
      [[title.startsWith('ขาย') ? 'ขาย' : title, 'ns-big', yes], ['ยกเลิก', 'ns-ghost', () => undefined]]);
  }

  /** Picks an amount 1..max with −/+ buttons; `cost(n)` is shown live. */
  private askAmount(head: string, sub: string, max: number, start: number, cost: (n: number) => number, ok: (n: number) => void, verb: string, step = 10): void {
    let n = Math.max(1, Math.min(max, start));
    this.showModal(verb === 'ซื้อ' ? 'ซื้อสินค้า' : 'ขาย',
      `${head}${sub ? `<div class="ns-msg">${sub}</div>` : ''}` +
      `<div class="ns-qty"><button data-d="${-step}">«</button><button data-d="-1">−</button><span class="v"></span><button data-d="1">+</button><button data-d="${step}">»</button></div>` +
      `<div class="ns-tot">${verb === 'ซื้อ' ? 'รวม' : 'ได้รับ'} <b class="t"></b> G <span class="ns-max">(ได้สูงสุด ${max})</span></div>`,
      [[verb, 'ns-big', () => ok(n)], ['ยกเลิก', 'ns-ghost', () => undefined]]);
    const draw = () => {
      this.card.querySelector('.v')!.textContent = String(n);
      this.card.querySelector('.t')!.innerHTML = gold(cost(n));
    };
    this.card.querySelector('.ns-qty')!.addEventListener('click', (e) => {
      const d = Number((e.target as HTMLElement).dataset.d ?? 0);
      n = Math.max(1, Math.min(max, n + d));
      draw();
    });
    draw();
  }
}
