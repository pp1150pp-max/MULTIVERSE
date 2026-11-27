// The blacksmith inside the NPC talk window (owner 2026-11-27, same layout as the merchant's shop, npcShopPane.ts):
// a blacksmith menu answer grows the talk window, the portrait shrinks to a medallion with a speech bubble, the
// blacksmith's own window (forge.ts, moved in as it is: all its menus, the hammer, Auto, the odds) on the left and the
// bag on the right with a "สวมอยู่" tab, since worn gear can be worked on too. A click on gear (or a card, in the
// fusion menu) puts it in the forge's slot. Switch: currentBalance().npcTalk.forgePane (off = the old window). Browser only.
import type { Game } from '../Game';
import type { ForgeWindow } from './forge';
import { currentBalance } from '../../shared/balance';
import type { ForgeLineKey } from '../../shared/npcTalk';
import { tabRange } from '../../shared/bagTabs';
import { EQUIP_SLOTS, isItem, isStone, type BagEntry } from '../../shared/types';
import { isCardId } from '../../shared/data/cards';
import { sellPickKey } from '../../shared/sim/Sim';
import { COIN_ICON } from '../icons';
import { potionTotals } from './hudShared';
import { isTouchMode } from '../touch/device';

type BagView = 'worn' | 'gear' | 'use';
/** The forge window's own width (px) its layout was made for; narrower panels zoom it down. */
const FORGE_DESIGN_W = 740;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export class NpcForgePane {
  readonly root: HTMLElement;
  private readonly medal: HTMLElement;
  private readonly medalImg: HTMLImageElement;
  private readonly bubble: HTMLElement;
  private readonly forgeBox: HTMLElement;
  private readonly bagTabs: HTMLElement;
  private readonly bagBody: HTMLElement;
  private readonly foot: HTMLElement;
  private view: BagView = 'gear';
  private drawn = '';
  /** The forge menu last seen: switching to fusion shows the cards' tab, leaving it goes back to the gear. */
  private lastMode = '';
  /** Where the forge window lives when it is not in here (put back on close). */
  private home: { parent: HTMLElement; next: Node | null } | null = null;

  constructor(private readonly g: Game, private readonly say: (text: string) => void) {
    this.root = el('div', 'ns nf');
    this.medal = el('div', 'ns-medal');
    this.medalImg = el('img');
    this.medalImg.alt = '';
    this.medal.append(this.medalImg);
    this.bubble = el('div', 'ns-bubble');

    const left = el('section', 'ns-pnl nf-forge');
    left.append(el('div', 'ns-title', 'ช่างตีเหล็ก'));
    this.forgeBox = el('div', 'nf-box');
    left.append(this.forgeBox);

    const bag = el('section', 'ns-pnl nf-bag');
    bag.append(el('div', 'ns-title', 'อุปกรณ์ของฉัน'));
    this.bagTabs = el('div', 'ns-tabs');
    for (const [v, label] of [['worn', 'สวมอยู่'], ['gear', 'กระเป๋า'], ['use', 'ประเภทใช้งาน']] as const) {
      const b = el('button', 'ns-tab', label);
      b.dataset.v = v;
      b.onclick = () => { this.view = v; this.drawn = ''; this.update(); };
      this.bagTabs.append(b);
    }
    this.bagBody = el('div', 'ns-body');
    const hint = el('div', 'ns-hint', `${isTouchMode() ? 'แตะ' : 'คลิก'}อุปกรณ์ = วางบนแท่นช่างตีเหล็ก · เมนูรวมการ์ด: ${isTouchMode() ? 'แตะ' : 'คลิก'}การ์ดในแท็บประเภทใช้งาน`);
    this.foot = el('div', 'ns-foot');
    bag.append(this.bagTabs, this.bagBody, hint, this.foot);

    this.root.append(this.medal, this.bubble, left, bag);
    this.root.addEventListener('mouseleave', () => this.g.hud.hideTip());
  }

  private get forge(): ForgeWindow {
    return this.g.hud.forgeWin;
  }

  /** Moves the forge window in and shows the menu `mode`; `face` = the portrait, `small` = a square harbour one. */
  open(mode: string, face: string, small: boolean): void {
    const fw = document.getElementById('forge')!;
    if (!this.home) this.home = { parent: fw.parentElement!, next: fw.nextSibling };
    this.forgeBox.append(fw);
    this.medalImg.src = face;
    this.medal.classList.toggle('small', small);
    this.medal.classList.toggle('hidden', !face);
    document.querySelector<HTMLElement>(`#forge-menu [data-mode="${mode}"]`)?.click();
    // Fusion works on cards: start on the tab that holds them.
    this.view = mode === 'fuse' ? 'use' : 'gear';
    this.lastMode = mode;
    this.drawn = '';
    this.update();
  }

  /** Puts the forge window back where it lives (the HUD closes it). */
  close(): void {
    this.g.hud.hideTip();
    const fw = document.getElementById('forge');
    if (fw && this.home) this.home.parent.insertBefore(fw, this.home.next);
    this.home = null;
  }

  /** The blacksmith says one of his /admin lines for `key` (npcTalk.forge, picked at random), {0} {1} filled in. Plain text. */
  line(key: ForgeLineKey, ...args: (string | number)[]): void {
    const lines = currentBalance().npcTalk.forge[key];
    if (!lines.length) return;
    const raw = lines[Math.floor(Math.random() * lines.length)];
    this.say(raw.replace(/\{(\d)\}/g, (m, d: string) => (args[Number(d)] !== undefined ? String(args[Number(d)]) : m)));
  }

  /** The bubble beside the medallion. Plain text. */
  setLine(text: string): void {
    this.bubble.textContent = text;
    this.bubble.classList.remove('pop');
    void this.bubble.offsetWidth;
    this.bubble.classList.add('pop');
  }

  /** Every frame: fits the forge window to the panel; redraws the bag only when something shown changed. */
  update(): void {
    const w = this.forgeBox.clientWidth;
    if (w > 0) {
      const z = String(Math.min(1, w / FORGE_DESIGN_W));
      const fw = document.getElementById('forge');
      if (fw && fw.style.zoom !== z) fw.style.zoom = z;
    }
    const mode = this.forge.mode;
    if (mode !== this.lastMode) {
      if (mode === 'fuse') this.view = 'use';
      else if (this.lastMode === 'fuse' && this.view === 'use') this.view = 'gear';
      this.lastMode = mode;
    }
    const p = this.g.player;
    const key = (e: BagEntry | null | undefined) => (!e ? '' : isItem(e) ? `${e.uid}+${e.plus ?? 0}` : `${sellPickKey(e)}x${e.count}`);
    const sig = [this.view, this.forge.mode, this.forge.selected, p.gold, p.bag.map(key).join(','), EQUIP_SLOTS.map((s) => key(p.equipment[s])).join(',')].join('|');
    if (sig === this.drawn) return;
    this.drawn = sig;
    for (const b of this.bagTabs.querySelectorAll<HTMLElement>('.ns-tab')) b.classList.toggle('on', b.dataset.v === this.view);
    this.foot.innerHTML = `<span class="g">${COIN_ICON} ${p.gold.toLocaleString()} G</span><span class="pots">${potionTotals(p)}</span>`;
    this.drawBag();
  }

  private drawBag(): void {
    const p = this.g.player;
    const cells: (BagEntry | null | undefined)[] = [];
    if (this.view === 'worn') for (const s of EQUIP_SLOTS) cells.push(p.equipment[s]);
    else {
      const [a, z] = tabRange(p.bagSlots, this.view);
      for (let i = a; i < z; i++) cells.push(p.bag[i]);
    }
    const fusing = this.forge.fusing;
    const grid = el('div', 'ns-grid nf-grid');
    for (const e of cells) {
      if (this.view === 'worn' && !e) continue;
      const w = el('div', '');
      w.innerHTML = this.g.hud.itemCell(e, '');
      const c = w.firstElementChild as HTMLElement;
      if (e) {
        const usable = isItem(e) ? !fusing : isStone(e) && isCardId(e.stone) && fusing;
        if (!usable) c.classList.add('ns-nosell');
        if (isItem(e) && e.uid === this.forge.selected) c.classList.add('nf-on');
        c.onmousemove = (ev) => {
          if (isTouchMode()) return;
          this.g.hud.showEntryTip(e, ev, usable ? (fusing ? 'คลิก: ใส่ช่องรวมการ์ด' : 'คลิก: วางบนแท่นช่างตีเหล็ก') : fusing ? 'เมนูรวมการ์ดรับเฉพาะการ์ด' : 'ช่างตีเหล็กรับเฉพาะอุปกรณ์สวมใส่');
        };
        c.onclick = () => {
          this.g.hud.hideTip();
          this.forge.forgePlace(e);
          this.drawn = '';
        };
      }
      grid.append(c);
    }
    if (!grid.children.length) this.bagBody.replaceChildren(el('div', 'ns-empty', 'ไม่ได้สวมอุปกรณ์'));
    else this.bagBody.replaceChildren(grid);
  }
}
