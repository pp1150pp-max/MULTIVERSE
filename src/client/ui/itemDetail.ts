import type { Game } from '../Game';
import { isBuffScroll, isOrbStone, isItem, isPotion, isStack, isStone, EQUIP_SLOT_LABEL, wornPlaces, type BagEntry, type EquipSlot } from '../../shared/types';
import type { MarketWindow } from '../market';
import type { ForgeWindow } from './forge';
import type { ShopWindow } from './shop';
import type { StashWindow } from './stash';
import { $ } from './hudShared';

/** What the item detail sheet needs from the HUD (tooltips, bag actions). */
export interface ItemDetailHost {
  showEntryTip(entry: BagEntry, e: MouseEvent, hint: string): void;
  hideTip(): void;
  markInventory(): void;
  equipByDrag(i: number, slot: EquipSlot): void;
  splitDrag(from: 'bag' | 'stash', i: number, cell: HTMLElement | null | undefined, stashCell: HTMLElement | null | undefined): boolean;
  askDrop(i: number): void;
}

/** The windows whose open state decides the sheet's buttons. */
export interface ItemDetailWindows {
  forge: ForgeWindow;
  shop: ShopWindow;
  stash: StashWindow;
  market: MarketWindow;
}

/** What the touch detail sheet shows: a bag slot, a stash slot or a worn item. */
export type DetailAt = { bag: number } | { stash: number } | { slot: EquipSlot };

/** Touch only: the item detail sheet with a button for each thing that can be done with the item now. */
export class ItemDetail {
  constructor(private readonly g: Game, private readonly host: ItemDetailHost, private readonly w: ItemDetailWindows) {}

  /** True while the sheet is up (Esc closes it first). */
  get isOpen(): boolean {
    return !!this.detail;
  }

  // ------------------------------------------------------------ item detail (touch)

  /** What the open detail sheet shows: a bag slot or a worn item. */
  private detail: DetailAt | null = null;
  private detailEl: HTMLElement | null = null;


  /**
   * Touch only: the item's details with a button for each thing that can be done with it right now.
   * Wear / use and drop are always there; sell, store, list, forge and trade show while that window is open.
   */
  openDetail(at: DetailAt): void {
    const g = this.g;
    const p = g.player;
    const entry = 'bag' in at ? p.bag[at.bag] : 'stash' in at ? p.stash.items[at.stash] : p.equipment[at.slot];
    if (!entry) return this.closeDetail();
    if (!this.detailEl) {
      const el = document.createElement('div');
      el.id = 'item-detail';
      el.className = 'panel hidden';
      el.innerHTML = '<div class="panel-head"><span>รายละเอียดไอเทม</span><button data-close>✕</button></div>' +
        '<div class="idt-top"></div><div class="idt-acts"></div>';
      el.querySelector('[data-close]')!.addEventListener('click', () => this.closeDetail());
      $('hud').append(el);
      this.detailEl = el;
    }
    this.detail = at;
    // The tooltip builders write into #tooltip: borrow that HTML for the sheet.
    this.host.showEntryTip(entry, new MouseEvent('mousemove'), '');
    const info = $('tooltip').innerHTML;
    this.host.hideTip();
    const cell = 'bag' in at
      ? $('bag-grid').querySelector<HTMLElement>(`[data-i="${at.bag}"]`)
      : 'stash' in at
        ? $('stash-grid').querySelector<HTMLElement>(`[data-s="${at.stash}"]`)
        : $('equip-slots').querySelector<HTMLElement>(`[data-slot="${at.slot}"]`);
    const icon = cell?.cloneNode(true) as HTMLElement | undefined;
    icon?.removeAttribute('data-i');
    icon?.removeAttribute('data-s');
    icon?.removeAttribute('data-slot');
    icon?.classList.remove('sel', 'dragging');
    this.detailEl.querySelector('.idt-top')!.innerHTML = `<div class="idt-icon">${icon?.outerHTML ?? ''}</div><div class="idt-info">${info}</div>`;

    const acts: { label: string; run: () => void; main?: boolean; off?: boolean }[] = [];
    if ('stash' in at) {
      const i = at.stash;
      acts.push({ label: 'ย้ายเข้ากระเป๋า', run: () => g.backend.stashTake(i, -1), main: true });
    } else if ('slot' in at) {
      const slot = at.slot;
      if (this.w.forge.isOpen) acts.push({ label: 'วางที่ช่างตีเหล็ก', run: () => this.w.forge.forgePlace(entry), main: true });
      else acts.push({ label: 'ถอด', run: () => g.backend.unequip(slot), main: true });
    } else {
      const i = at.bag;
      if (g.trade.open) acts.push({ label: 'เสนอในการเทรด', run: () => g.trade.offer(i), main: true });
      else if (this.w.forge.isOpen && isItem(entry)) acts.push({ label: 'วางที่ช่างตีเหล็ก', run: () => this.w.forge.forgePlace(entry), main: true });
      else if (isItem(entry)) {
        const block = p.equipBlock(entry);
        const places = wornPlaces(entry.slot);
        if (block) acts.push({ label: `สวมใส่ไม่ได้ — ${block}`, run: () => undefined, main: true, off: true });
        else if (places.length > 1) {
          for (const place of places) acts.push({ label: `ใส่ช่อง${EQUIP_SLOT_LABEL[place]}`, run: () => this.host.equipByDrag(i, place), main: true });
        } else acts.push({ label: 'สวมใส่', run: () => g.backend.equip(i), main: true });
      } else if (isPotion(entry)) {
        acts.push({ label: `ใช้กับปุ่มยา ${entry.potion === 'hp' ? 1 : 2}`, run: () => g.backend.equip(i), main: true });
      } else if (isStone(entry)) {
        const st = entry.stone;
        if (st === 'return_scroll') acts.push({ label: 'ใช้', run: () => g.useReturnScroll(), main: true });
        else if (isBuffScroll(st)) acts.push({ label: 'ใช้', run: () => g.backend.useBuffScroll(st), main: true });
        else if (st === 'megaphone') acts.push({ label: 'ใช้', run: () => g.megaphone.toggle(true), main: true });
        else if (st === 'mystery_box') {
          acts.push({ label: 'เปิด 1 กล่อง', run: () => g.backend.openBox(i, false), main: true });
          if (entry.count > 1) acts.push({ label: 'เปิดทั้งกอง', run: () => g.backend.openBox(i, true) });
        } else if (isOrbStone(st)) acts.push({ label: 'ใช้ (เข้าบัญชี)', run: () => g.backend.useOrbItem(i), main: true });
      }
      if (this.w.shop.isOpen) acts.push({ label: isStack(entry) ? 'ขายทั้งช่อง' : 'ขาย', run: () => this.w.shop.sellFromBag(i) });
      if (this.w.stash.isOpen) acts.push({ label: 'ฝากเข้าคลัง', run: () => g.backend.stashPut(i, -1) });
      if (this.w.market.isOpen) acts.push({ label: 'ลงขายในตลาด', run: () => this.w.market.bagRightClick(i) });
      if (isStack(entry) && entry.count > 1) {
        const free = p.bag.findIndex((x) => !x);
        acts.push({
          label: free < 0 ? 'แบ่งกองไม่ได้ — กระเป๋าเต็ม' : 'แบ่งกอง',
          run: () => this.host.splitDrag('bag', i, $('bag-grid').querySelector<HTMLElement>(`[data-i="${free}"]`), null),
          off: free < 0,
        });
      }
      acts.push({ label: 'วางลงพื้น', run: () => this.host.askDrop(i) });
    }
    const box = this.detailEl.querySelector<HTMLElement>('.idt-acts')!;
    box.replaceChildren(...acts.map((a) => {
      const b = document.createElement('button');
      b.textContent = a.label;
      if (a.main) b.classList.add('primary');
      b.disabled = !!a.off;
      b.onclick = () => {
        this.closeDetail();
        a.run();
        this.host.markInventory();
      };
      return b;
    }));
    this.detailEl.classList.remove('hidden');
  }

  closeDetail(): void {
    this.detail = null;
    this.detailEl?.classList.add('hidden');
  }
}
