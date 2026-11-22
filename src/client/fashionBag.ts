// The fashion bag (กระเป๋าแฟชั่น, owner 2026-11-18, docs/systems/cosmetics.md): a second page of the bag
// window, switched with the "กระเป๋า" / "แฟชั่น" tabs above the bag slots. It shows the cosmetics the
// account owns in the painted 30 slots (in COS_SLOTS order, pages past 30) and, over the equipment
// area, a bar of the six cosmetic slots with what is worn. Click = wear / take off at once (touch: a
// sheet with the button). Wearing goes through backend.cosWear, which the server checks (wearCosmetic).
// Unowned pieces are not shown; pieces hidden in /admin follow the cosmetics window's rule (only while worn).
// The window goes back to the normal bag while a shop, stash, market, trade or forge is open.
import type { Game } from './Game';
import { COSMETICS, COS_SLOTS, COS_SLOT_NAME, cosById, cosPerk, type CosmeticDef, type CosSlot } from '../shared/data/cosmetics';
import { cosPicture } from './cosmetics';
import { cosHiddenKey, isCosHidden } from './cosTune';
import { orbItemsVersion } from '../shared/orbItems';
import { isTouchMode } from './touch/device';
import { imgUrl } from './img';

/** Painted bag slots per page. */
const PAGE = 30;

// Where things are painted on inventory_fashion.png, in pixels of its 815 x 1086 (turned into % so they scale).
const ART_W = 815;
const ART_H = 1086;
/** Left edge of each frame column, top of each frame row, frame size, and how far in the slot starts. */
const FRAME_X = [97, 313, 529];
const FRAME_Y = [243, 435];
const FRAME_W = 190;
const FRAME_H = 129;
const FRAME_IN = 11;
/** The flat face of the name plate under each frame, between its rivets (left offset from its frame, top per row, size). */
const PLATE_DX = 49;
const PLATE_Y = [388, 579];
const PLATE_W = 98;
const PLATE_H = 21;
/** Shorter names where COS_SLOT_NAME doesn't fit on a plate (owner 2026-11-18); the full name stays in the tooltip. */
const PLATE_NAME: Partial<Record<CosSlot, string>> = { title: 'กรอบชื่อ/แชท' };
/** The heading plate, and the line of help text under the frames: [left, top, width, height]. */
const HEAD: Box = [268, 172, 288, 30];
const NOTE: Box = [90, 607, 635, 26];
type Box = [number, number, number, number];

/** Puts an element on the painted window at a box measured in art pixels. */
function place<T extends HTMLElement>(e: T, [x, y, w, h]: Box): T {
  e.style.left = `${(x / ART_W) * 100}%`;
  e.style.top = `${(y / ART_H) * 100}%`;
  e.style.width = `${(w / ART_W) * 100}%`;
  e.style.height = `${(h / ART_H) * 100}%`;
  return e;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class FashionBag {
  private on = false;
  private page = 0;
  private drawn = '';
  private readonly box: HTMLElement;
  private readonly tabBag: HTMLButtonElement;
  private readonly tabFashion: HTMLButtonElement;
  private readonly pager: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly worn: HTMLElement;
  private readonly note: HTMLElement;
  private readonly title: HTMLElement;
  private readonly bagTitle: string;
  private sheet: HTMLElement | null = null;
  private sheetId = '';

  constructor(private readonly g: Game, private readonly hideTip: () => void) {
    this.box = document.getElementById('inventory')!;
    const win = this.box.querySelector<HTMLElement>('.inv-window')!;
    this.title = win.querySelector<HTMLElement>('.inv-title')!;
    this.bagTitle = this.title.textContent ?? '';
    // The fashion page's window art (CSS swaps it in); fetched now so it doesn't show up late.
    new Image().src = imgUrl('assets/sprites/ui/inventory_fashion.png');

    const tabs = el('div', 'inv-tabs');
    this.tabBag = el('button', 'ui-tab active', 'กระเป๋า');
    this.tabFashion = el('button', 'ui-tab', 'แฟชั่น');
    this.tabBag.onclick = () => this.set(false);
    this.tabFashion.onclick = () => this.set(true);
    tabs.append(this.tabBag, this.tabFashion);

    this.pager = el('div', 'fashion-pager hidden');
    this.grid = el('div');
    this.grid.id = 'fashion-grid';
    this.worn = el('div');
    this.worn.id = 'fashion-worn';
    this.note = el('div', 'fashion-note');
    win.append(tabs, this.pager, this.worn, this.grid);

    const onClick = (e: MouseEvent, attr: 'cos' | 'wornSlot') => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>(`[data-${attr === 'cos' ? 'cos' : 'worn-slot'}]`);
      if (!cell) return;
      const c = attr === 'cos' ? cosById(cell.dataset.cos) : cosById(this.g.player.cosmetics[cell.dataset.wornSlot as CosSlot]);
      if (!c) return;
      this.hideTip();
      if (isTouchMode()) this.openSheet(c);
      else this.toggleWear(c);
    };
    this.grid.addEventListener('click', (e) => onClick(e, 'cos'));
    this.worn.addEventListener('click', (e) => onClick(e, 'wornSlot'));
    const onMove = (e: MouseEvent, attr: 'cos' | 'wornSlot') => {
      if (isTouchMode()) return;
      const cell = (e.target as HTMLElement).closest<HTMLElement>(`[data-${attr === 'cos' ? 'cos' : 'worn-slot'}]`);
      const c = cell && (attr === 'cos' ? cosById(cell.dataset.cos) : cosById(this.g.player.cosmetics[cell.dataset.wornSlot as CosSlot]));
      if (c) this.showTip(c, e);
      else this.hideTip();
    };
    this.grid.addEventListener('mousemove', (e) => onMove(e, 'cos'));
    this.worn.addEventListener('mousemove', (e) => onMove(e, 'wornSlot'));
    this.grid.addEventListener('mouseleave', () => this.hideTip());
    this.worn.addEventListener('mouseleave', () => this.hideTip());
    // Right-click in the fashion bag does nothing (no dropping cosmetics on the ground).
    this.grid.addEventListener('contextmenu', (e) => e.preventDefault());
    this.worn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private set(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    this.box.classList.toggle('fashion', on);
    this.tabBag.classList.toggle('active', !on);
    this.tabFashion.classList.toggle('active', on);
    if (!on) this.pager.classList.add('hidden');
    this.title.textContent = on ? 'กระเป๋าแฟชั่น' : this.bagTitle;
    this.hideTip();
    if (!on) this.closeSheet();
    this.drawn = '';
  }

  /** Every frame while the bag window is open. `busy`: a window that works with the normal bag is open. */
  update(busy: boolean): void {
    if (busy && this.on) this.set(false);
    this.tabFashion.disabled = busy;
    this.tabFashion.title = busy ? 'ปิดร้านค้า คลัง ตลาด เทรด หรือช่างตีเหล็กก่อน' : 'ของแต่งตัวที่บัญชีมี';
    if (!this.on) return;
    const me = this.g.player;
    const key = JSON.stringify([this.page, me.cosmetics, this.g.backend.cosOwned, this.g.backend.guest, cosHiddenKey(), orbItemsVersion()]);
    if (key === this.drawn) return;
    this.drawn = key;
    this.draw();
  }

  /** Back to the normal bag (when the bag window closes). */
  reset(): void {
    this.set(false);
    this.closeSheet();
  }

  /** What the fashion bag lists: owned, and not hidden in /admin unless worn. In COS_SLOTS order. */
  private list(): CosmeticDef[] {
    const owned = new Set(this.g.backend.cosOwned);
    const worn = this.g.player.cosmetics;
    const mine = COSMETICS.filter((c) => owned.has(c.id) && (!isCosHidden(c.id) || worn[c.slot] === c.id));
    return COS_SLOTS.flatMap((s) => mine.filter((c) => c.slot === s));
  }

  private draw(): void {
    const worn = this.g.player.cosmetics;
    const list = this.list();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (this.page >= pages) this.page = pages - 1;

    // Bag slots: this page's pieces, then empty slots up to 30.
    const shown = list.slice(this.page * PAGE, this.page * PAGE + PAGE);
    const cells: HTMLElement[] = [];
    for (let i = 0; i < PAGE; i++) {
      const c = shown[i];
      const cell = el('div', c ? 'cell fashion-cell' : 'cell empty');
      if (c) {
        cell.dataset.cos = c.id;
        cell.style.setProperty('--rc', c.color);
        if (worn[c.slot] === c.id) cell.classList.add('worn');
        cell.append(cosPicture(c).cloneNode(true));
      }
      cells.push(cell);
    }
    this.grid.replaceChildren(...cells);

    // Pages.
    this.pager.classList.toggle('hidden', pages < 2);
    if (pages > 1) {
      const prev = el('button', '', '◀');
      const next = el('button', '', '▶');
      prev.disabled = this.page === 0;
      next.disabled = this.page >= pages - 1;
      prev.onclick = () => {
        this.page = Math.max(0, this.page - 1);
        this.drawn = '';
      };
      next.onclick = () => {
        this.page = Math.min(pages - 1, this.page + 1);
        this.drawn = '';
      };
      this.pager.replaceChildren(prev, el('span', '', `${this.page + 1} / ${pages}`), next);
    }

    // What is worn, on the six painted frames of inventory_fashion.png (3 x 2), each with its name plate.
    const parts: HTMLElement[] = [place(el('div', 'fashion-head', 'ของแต่งตัวที่สวมอยู่'), HEAD)];
    COS_SLOTS.forEach((s, i) => {
      const c = cosById(worn[s]);
      const x = FRAME_X[i % 3];
      const y = FRAME_Y[Math.floor(i / 3)];
      const cell = el('div', c ? 'cell fashion-cell worn' : 'cell empty');
      if (c) {
        cell.dataset.wornSlot = s;
        cell.style.setProperty('--rc', c.color);
        cell.append(cosPicture(c).cloneNode(true));
      }
      parts.push(
        place(cell, [x + FRAME_IN, y + FRAME_IN, FRAME_W - FRAME_IN * 2, FRAME_H - FRAME_IN * 2]),
        place(el('div', 'fashion-slot-name', PLATE_NAME[s] ?? COS_SLOT_NAME[s]), [x + PLATE_DX, PLATE_Y[Math.floor(i / 3)], PLATE_W, PLATE_H]),
      );
    });
    this.note.textContent = this.g.backend.guest
      ? 'Guest รับ Cosmetics ไม่ได้ สมัครสมาชิกเพื่อรับของ'
      : !list.length
        ? 'ยังไม่มีของแต่งตัว ซื้อได้ที่แคชช็อป · ทุกตัวละครในบัญชีใช้ของร่วมกัน'
        : isTouchMode()
          ? 'แตะของเพื่อสวม / ถอด · ไม่มีค่าสถานะ'
          : 'คลิกของในกระเป๋าเพื่อสวม / ถอด · คลิกช่องด้านบนเพื่อถอด · ไม่มีค่าสถานะ';
    this.worn.replaceChildren(...parts, place(this.note, NOTE));

    if (this.sheet && !this.sheet.classList.contains('hidden')) {
      const c = cosById(this.sheetId);
      if (c && list.includes(c)) this.openSheet(c);
      else this.closeSheet();
    }
  }

  private toggleWear(c: CosmeticDef): void {
    const isWorn = this.g.player.cosmetics[c.slot] === c.id;
    this.g.backend.cosWear(c.slot, isWorn ? null : c.id);
  }

  private showTip(c: CosmeticDef, e: MouseEvent): void {
    const tip = document.getElementById('tooltip')!;
    const isWorn = this.g.player.cosmetics[c.slot] === c.id;
    const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
    tip.innerHTML =
      `<div class="tt-name" style="color:${esc(c.color)}">${esc(c.name)}</div>` +
      `<div class="tt-sub">ของแต่งตัว · ${COS_SLOT_NAME[c.slot]}${isWorn ? ' · สวมอยู่' : ''}</div>` +
      `<div class="tt-stats"><div>${esc(c.desc)}</div>${cosPerk(c) ? `<div>${esc(cosPerk(c)!)}</div>` : ''}</div>` +
      (isCosHidden(c.id) ? '<div class="tt-req">ปิดชั่วคราว ถอดแล้วสวมใหม่ไม่ได้</div>' : '') +
      `<div class="tt-hint">คลิก: ${isWorn ? 'ถอด' : 'สวม'}</div>`;
    tip.classList.remove('hidden');
    const x = Math.min(e.clientX + 16, window.innerWidth - tip.offsetWidth - 8);
    const y = Math.min(e.clientY + 16, window.innerHeight - tip.offsetHeight - 8);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  /** Touch: the piece's details with the wear / take-off button. */
  private openSheet(c: CosmeticDef): void {
    if (!this.sheet) {
      const s = el('div', 'panel hidden');
      s.id = 'fashion-detail';
      document.getElementById('hud')!.append(s);
      this.sheet = s;
    }
    this.sheetId = c.id;
    const isWorn = this.g.player.cosmetics[c.slot] === c.id;
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.closeSheet();
    head.append(el('span', '', 'ของแต่งตัว'), close);
    const top = el('div', 'idt-top');
    const icon = el('div', 'cell fashion-cell');
    icon.style.setProperty('--rc', c.color);
    icon.append(cosPicture(c).cloneNode(true));
    const info = el('div', 'idt-info');
    const name = el('div', 'tt-name', c.name);
    name.style.color = c.color;
    info.append(name, el('div', 'tt-sub', `${COS_SLOT_NAME[c.slot]}${isWorn ? ' · สวมอยู่' : ''}`), el('div', 'tt-stats', c.desc));
    const perk = cosPerk(c);
    if (perk) info.append(el('div', 'tt-stats', perk));
    if (isCosHidden(c.id)) info.append(el('div', 'tt-req', 'ปิดชั่วคราว ถอดแล้วสวมใหม่ไม่ได้'));
    top.append(icon, info);
    const acts = el('div', 'idt-acts');
    const btn = el('button', 'primary', isWorn ? 'ถอด' : 'สวม');
    btn.onclick = () => {
      this.toggleWear(c);
      this.closeSheet();
    };
    acts.append(btn);
    this.sheet.replaceChildren(head, top, acts);
    this.sheet.classList.remove('hidden');
  }

  private closeSheet(): void {
    this.sheet?.classList.add('hidden');
    this.sheetId = '';
  }
}
