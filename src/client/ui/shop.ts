import type { Game } from '../Game';
import { sellValue } from '../../shared/data/enhance';
import { POTION_SIZES, POTION_SIZE_LABEL, POTION_STACK, potionHeal, potionPrice, potionName, potionSellPrice, entryName } from '../../shared/data/potions';
import { RETURN_SCROLL_PRICE, STONE_COLOR, STONE_DESC, STONE_NAME, STONE_STACK, stoneSellPrice, stoneStackValue, stoneUnit, PHOENIX_PRICE } from '../../shared/data/stones';
import { buybackPrice } from '../../shared/sim/Player';
import { isBulkSellable } from '../../shared/sim/Sim';
import { isPotion, isStack, isStone, RARITIES, RARITY_COLOR, RARITY_LABEL, type BagEntry, type Item, type PotionKind, type PotionSize, type Rarity, type StoneStack } from '../../shared/types';
import { COIN_ICON, potionIcon, stoneIcon } from '../icons';
import { currentBalance } from '../../shared/balance';
import { $, entryColor, POTION_COLOR, potionTotals } from './hudShared';

const SELL_RARITY_KEY = 'multiverse-sell-rarities';
/** Which rarities the merchant's "sell ticked" boxes had ticked last time (this browser only). */
function loadSellRarities(): Rarity[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(SELL_RARITY_KEY) ?? '[]');
    return Array.isArray(v) ? RARITIES.filter((r) => v.includes(r)) : [];
  } catch {
    return [];
  }
}
function saveSellRarities(rs: Rarity[]): void {
  try {
    localStorage.setItem(SELL_RARITY_KEY, JSON.stringify(rs));
  } catch {
    // Storage blocked: the ticks just won't be remembered.
  }
}

/** What the merchant window needs from the HUD. */
export interface ShopHost {
  log(msg: string, color?: string): void;
  confirm(html: string, yesLabel: string, onYes: () => void): void;
  closeConfirm(): void;
  askAmount(html: string, max: number, initial: number, onOk: (n: number) => void): void;
  showTip(item: Item, e: MouseEvent, hint: string): void;
  showStoneTip(s: StoneStack, e: MouseEvent, hint: string): void;
  placeTip(tip: HTMLElement, e: MouseEvent): void;
  hideTip(): void;
  toggleBag(force?: boolean): void;
  markInventory(): void;
  itemCell(item: BagEntry | null | undefined, attrs: string, placeholder?: string, selected?: boolean): string;
}

/** The merchant's window: buy potions / phoenix feathers / return scrolls, sell, sell by rarity, buy back. */
export class ShopWindow {
  /** Item uids last drawn in the buyback grid, so it is only rebuilt when the list changes. */
  private buybackKey = '';
  private shopOpen = false;

  constructor(private readonly g: Game, private readonly host: ShopHost) {
    const bb = $('buyback-grid');
    bb.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-bb]');
      const i = el ? Number(el.dataset.bb) : -1;
      const entry = g.player.buyback[i];
      if (!entry) return;
      const price = buybackPrice(entry);
      if (g.player.gold < price) {
        this.host.log(`ทองไม่พอ — ต้องใช้ ${price.toLocaleString()} G`, '#ff8a6a');
        return;
      }
      if (!g.player.hasBagSpace()) {
        this.host.log('กระเป๋าเต็ม', '#ff8a6a');
        return;
      }
      g.backend.buyBack(i, entry.item.uid);
      this.host.hideTip();
      this.afterTrade();
    });
    bb.addEventListener('mousemove', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-bb]');
      const entry = el ? g.player.buyback[Number(el.dataset.bb)] : undefined;
      if (entry) this.host.showTip(entry.item, e, `คลิก: ซื้อคืน ${buybackPrice(entry).toLocaleString()} G`);
      else this.host.hideTip();
    });
    bb.addEventListener('mouseleave', () => this.host.hideTip());

    $('shop-close').onclick = () => this.closeShop();
    $('shop-tabs').addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
      if (t) this.setShopTab(t.dataset.tab as 'buy' | 'buyback');
    });
    // Buy tab: a grid of potion icons. Click buys one, right click (or shift click) buys a stack.
    const buyGrid = $('shop-buy');
    buyGrid.innerHTML = (['hp', 'mp'] as const).flatMap((k) => POTION_SIZES.map((s) =>
      `<div class="cell pot" data-buy="${k}:${s}" style="--rc:${POTION_COLOR[k]}">${potionIcon(k, s)}` +
      `<span class="psize">${POTION_SIZE_LABEL[s]}</span><span class="cell-price">${potionPrice(k, s)}</span></div>`,
    )).join('') +
      // Phoenix feathers, for getting up again in a boss room, then the return scroll.
      `<div class="cell pot stone" data-phoenix style="--rc:${STONE_COLOR.phoenix}">${stoneIcon('phoenix')}<span class="cell-price">${PHOENIX_PRICE}</span></div>` +
      `<div class="cell pot stone" data-buy-scroll style="--rc:${STONE_COLOR.return_scroll}">${stoneIcon('return_scroll')}` +
      `<span class="cell-price">${RETURN_SCROLL_PRICE}</span></div>`;
    const phoenixCell = (e: Event) => !!(e.target as HTMLElement).closest('[data-phoenix]');
    const buyCell = (e: Event): [PotionKind, PotionSize] | null => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-buy]');
      return el ? (el.dataset.buy!.split(':') as [PotionKind, PotionSize]) : null;
    };
    const scrollCell = (e: Event): boolean => !!(e.target as HTMLElement).closest('[data-buy-scroll]');
    buyGrid.addEventListener('click', (e) => {
      if (phoenixCell(e)) return this.g.backend.buyPhoenix(e.shiftKey ? STONE_STACK : 1);
      if (scrollCell(e)) return this.buyReturnScroll(e.shiftKey ? STONE_STACK : 1);
      const c = buyCell(e);
      if (c) this.buyPotion(c[0], c[1], e.shiftKey ? POTION_STACK : 1);
    });
    buyGrid.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (phoenixCell(e)) return this.g.backend.buyPhoenix(STONE_STACK);
      if (scrollCell(e)) return this.buyReturnScroll(STONE_STACK);
      const c = buyCell(e);
      if (c) this.buyPotion(c[0], c[1], POTION_STACK);
    });
    buyGrid.addEventListener('mousemove', (e) => {
      if (phoenixCell(e)) return this.host.showStoneTip({ stone: 'phoenix', count: 1 }, e, `คลิก: ซื้อ 1 · คลิกขวา: ซื้อ ${STONE_STACK} (อันละ ${PHOENIX_PRICE.toLocaleString()} G)`);
      if (scrollCell(e)) return this.showShopScrollTip(e);
      const c = buyCell(e);
      if (c) this.showShopPotionTip(c[0], c[1], e);
      else this.host.hideTip();
    });
    buyGrid.addEventListener('mouseleave', () => this.host.hideTip());
    // Sell by rarity: tick the rarities, then one button sells them all. The ticks are remembered in this browser.
    const ticked = loadSellRarities();
    $('sell-rarity').innerHTML = RARITIES.map((r) =>
      `<label style="color:${RARITY_COLOR[r]}"><input type="checkbox" data-sell="${r}"${ticked.includes(r) ? ' checked' : ''}>` +
      `${RARITY_LABEL[r]} <span class="n" data-sell-n="${r}"></span></label>`).join('');
    $('sell-rarity').addEventListener('change', () => {
      saveSellRarities(this.checkedSellRarities());
      this.renderShopMoney();
    });
    $('sell-checked').onclick = () => this.sellChecked();
  }

  /** True while the merchant window is open. */
  get isOpen(): boolean {
    return this.shopOpen;
  }

  /** True (with a log line) when wearing/taking off must be refused because the merchant window is open (Balance.shopNoEquip). */
  blocksEquip(): boolean {
    if (!this.shopOpen || !currentBalance().shopNoEquip) return false;
    this.host.log('ปิดร้านก่อนถึงจะถอด/สวมได้', '#ff8a6a');
    return true;
  }

  // ------------------------------------------------------------ merchant

  /** Opens the window (hud.ts closes the other NPC windows first). */
  openShop(): void {
    this.shopOpen = true;
    $('shop').classList.remove('hidden');
    this.host.toggleBag(true);
    this.renderShopMoney();
  }

  closeShop(): void {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    $('shop').classList.add('hidden');
    this.host.closeConfirm();
    this.host.markInventory();
  }

  renderShopMoney(): void {
    const p = this.g.player;
    $('shop-gold').innerHTML = `${COIN_ICON} ${p.gold.toLocaleString()} G`;
    $('shop-pots').innerHTML = potionTotals(this.g.player);
    this.renderBuyback();
    this.renderSellRarity();
    $('shop-buy').querySelectorAll<HTMLElement>('[data-buy]').forEach((el) => {
      const [kind, size] = el.dataset.buy!.split(':') as [PotionKind, PotionSize];
      el.classList.toggle('poor', p.gold < potionPrice(kind, size) || p.potionRoom(kind, size) < 1);
    });
    $('shop-buy').querySelector('[data-phoenix]')?.classList.toggle('poor', p.gold < PHOENIX_PRICE || p.stoneRoom('phoenix') < 1);
    $('shop-buy').querySelector('[data-buy-scroll]')?.classList.toggle('poor', p.gold < RETURN_SCROLL_PRICE || p.stoneRoom('return_scroll') < 1);
  }


  /** Switches the merchant window between buying potions and buying back sold items. */
  private setShopTab(tab: 'buy' | 'buyback'): void {
    $('shop-tabs').querySelectorAll<HTMLElement>('[data-tab]').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    $('shop').querySelectorAll<HTMLElement>('[data-pane]').forEach((b) => b.classList.toggle('hidden', b.dataset.pane !== tab));
    this.host.hideTip();
  }

  /** Tooltip for a potion on sale: what it does and what one or a stack costs. */
  private showShopPotionTip(kind: PotionKind, size: PotionSize, e: MouseEvent): void {
    const tip = $('tooltip');
    const price = potionPrice(kind, size);
    tip.innerHTML =
      `<div class="tt-name" style="color:${POTION_COLOR[kind]}">${potionName(kind, size)}</div>` +
      `<div class="tt-stats"><div>ฟื้น ${potionHeal(kind, size, this.g.player.cls.id)} ${kind.toUpperCase()} ต่อขวด</div></div>` +
      `<div class="tt-hint">คลิก: ซื้อ 1 (${price} G) · คลิกขวา: ซื้อ ${POTION_STACK} (${price * POTION_STACK} G)</div>` +
      `<div class="tt-val">มีอยู่ ${this.g.player.potionCount(kind, size)} ขวด</div>`;
    this.host.placeTip(tip, e);
  }

  /** Tooltip for the return scroll on sale. */
  private showShopScrollTip(e: MouseEvent): void {
    const tip = $('tooltip');
    const k = 'return_scroll';
    tip.innerHTML =
      `<div class="tt-name" style="color:${STONE_COLOR[k]}">${STONE_NAME[k]}</div>` +
      `<div class="tt-stats"><div>${STONE_DESC[k]}</div></div>` +
      `<div class="tt-hint">คลิก: ซื้อ 1 (${RETURN_SCROLL_PRICE} G) · คลิกขวา: ซื้อ ${STONE_STACK} (${(RETURN_SCROLL_PRICE * STONE_STACK).toLocaleString()} G)</div>` +
      `<div class="tt-val">มีอยู่ ${this.g.player.stoneCount(k)} ม้วน</div>`;
    this.host.placeTip(tip, e);
  }

  private buyReturnScroll(n: number): void {
    this.g.backend.buyReturnScroll(n);
    this.afterTrade();
  }

  /** Sells bag slot `i` to the merchant, asking first for a potion stack or an enhanced (+N) item. */
  sellFromBag(i: number): void {
    const g = this.g;
    const item = g.player.bag[i];
    if (!item || !this.shopOpen) return;
    const name = `<b style="color:${entryColor(item)}">${entryName(item)}</b>`;
    const sell = () => {
      if (g.player.bag[i] !== item) return;
      g.backend.sell(i);
      this.afterTrade();
    };
    // A stack of 2+: ask how many to sell (the whole stack is the default).
    if (isStack(item) && item.count > 1) {
      const each = isPotion(item) ? potionSellPrice(item.potion, item.size) : stoneSellPrice(item.stone);
      const unit = isPotion(item) ? 'ขวด' : stoneUnit(item.stone);
      this.host.askAmount(
        `ขาย ${name} กี่${unit}?<br><small>${unit}ละ ${each.toLocaleString()} G${isStone(item) ? ' · ซื้อคืนไม่ได้' : ''}</small>`,
        item.count, item.count,
        (n) => {
          if (g.player.bag[i] !== item || item.count < n) return;
          g.backend.sell(i, n >= item.count ? undefined : n);
          this.afterTrade();
        },
      );
      return;
    }
    if (isPotion(item)) {
      sell();
      return;
    }
    if (isStone(item)) {
      // Boss-only stones: always ask, they are hard to get back.
      this.host.confirm(`ขาย ${name}?<br><small>ได้ ${stoneStackValue(item).toLocaleString()} G (${stoneUnit(item.stone)}ละ ${stoneSellPrice(item.stone).toLocaleString()} G) · ซื้อคืนไม่ได้</small>`, 'ขาย', sell);
      return;
    }
    if ((item.plus ?? 0) > 0) {
      const v = sellValue(item);
      this.host.confirm(
        `ขาย ${name}?<br><small>ของชิ้นนี้ตีบวกแล้ว · ได้ ${v.toLocaleString()} G · ซื้อคืนได้ ${buybackPrice({ item, paid: v }).toLocaleString()} G ภายใน 30 นาที</small>`,
        'ขาย', sell,
      );
      return;
    }
    sell();
  }

  /** Redraws the buyback grid when the list changes; the timer and affordability every frame. */
  private renderBuyback(): void {
    const p = this.g.player;
    const key = p.buyback.map((e) => e.item.uid).join(',');
    const grid = $('buyback-grid');
    if (key !== this.buybackKey) {
      this.buybackKey = key;
      grid.innerHTML = p.buyback.length
        ? p.buyback.map((e, i) => this.host.itemCell(e.item, `data-bb="${i}"`)).join('')
        : '<div class="empty-note">ยังไม่มีของที่ขายไป</div>';
      grid.querySelectorAll<HTMLElement>('[data-bb]').forEach((el) => {
        const e = p.buyback[Number(el.dataset.bb)];
        el.insertAdjacentHTML('beforeend', `<span class="cell-price">${buybackPrice(e).toLocaleString()}</span>`);
      });
    }
    grid.querySelectorAll<HTMLElement>('[data-bb]').forEach((el) => {
      const e = p.buyback[Number(el.dataset.bb)];
      el.classList.toggle('poor', !e || p.gold < buybackPrice(e));
    });
    $('buyback-count').textContent = p.buyback.length ? `(${p.buyback.length})` : '';
    const s = Math.max(0, Math.ceil(p.buybackLeft));
    $('buyback-timer').textContent = `รีเซตใน ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  private buyPotion(kind: PotionKind, size: PotionSize, n: number): void {
    this.g.backend.buyPotion(kind, size, n);
    this.afterTrade();
  }

  private checkedSellRarities(): Rarity[] {
    return [...$('sell-rarity').querySelectorAll<HTMLInputElement>('input[data-sell]')]
      .filter((c) => c.checked)
      .map((c) => c.dataset.sell as Rarity);
  }

  /** Bag items the "sell ticked" button would sell (enhanced items never). */
  private checkedSellItems(): Item[] {
    const rs = this.checkedSellRarities();
    return this.g.player.bag.filter((e): e is Item => rs.some((r) => isBulkSellable(e, r)));
  }

  /** Item counts next to each tick box, and what the sell button would do. */
  private renderSellRarity(): void {
    const bag = this.g.player.bag;
    for (const r of RARITIES) {
      const n = bag.filter((e) => isBulkSellable(e, r)).length;
      const el = $('sell-rarity').querySelector<HTMLElement>(`[data-sell-n="${r}"]`);
      if (el) el.textContent = `(${n})`;
    }
    const items = this.checkedSellItems();
    const total = items.reduce((s, it) => s + sellValue(it), 0);
    const btn = $<HTMLButtonElement>('sell-checked');
    btn.disabled = !items.length;
    btn.textContent = items.length ? `ขายที่เลือก ${items.length} ชิ้น · ${total.toLocaleString()} G` : 'ขายที่เลือก';
  }

  private sellChecked(): void {
    const rs = this.checkedSellRarities();
    const items = this.checkedSellItems();
    if (!rs.length) {
      this.host.log('ติ๊กเลือกระดับที่จะขายก่อน', '#b9b09a');
      return;
    }
    if (!items.length) {
      this.host.log('ไม่มีของระดับที่เลือกในกระเป๋า (ของที่ตีบวกแล้วจะไม่ถูกขาย)', '#b9b09a');
      return;
    }
    const total = items.reduce((s, it) => s + sellValue(it), 0);
    const labels = rs.map((r) => `<b style="color:${RARITY_COLOR[r]}">${RARITY_LABEL[r]}</b>`).join(', ');
    this.host.confirm(`ขายของระดับ ${labels} ทั้งหมด ${items.length} ชิ้น?<br><small>ได้ ${total.toLocaleString()} G · ของที่ตีบวกแล้วจะไม่ถูกขาย · ซื้อคืนได้ภายใน 30 นาที</small>`, 'ขายทั้งหมด', () => {
      const bag = this.g.player.bag;
      for (const r of rs) if (bag.some((e) => isBulkSellable(e, r))) this.g.backend.sellAllOfRarity(r);
      this.afterTrade();
    });
  }

  /** The trade itself (and its log line / save) happens in the simulation; just refresh the panels. */
  private afterTrade(): void {
    this.host.markInventory();
    this.renderShopMoney();
  }
}
