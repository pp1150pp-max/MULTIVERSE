// An NPC's own window shown inside the grown NPC talk window (owner 2026-11-27, the merchant's layout "A"): the
// portrait shrinks to a medallion with a speech bubble, the NPC's existing window (moved in as it is, zoomed to fit)
// on the left and the player's gear/bag on the right (or the whole width). The blacksmith, the warehouse keeper,
// the market broker and the crystal merchant (npc*Pane.ts) are specs of this. Browser only.
import type { Game } from '../Game';
import { currentBalance } from '../../shared/balance';
import type { PanePart } from '../../shared/npcTalk';
import { tabRange } from '../../shared/bagTabs';
import { EQUIP_SLOTS, isItem, type BagEntry } from '../../shared/types';
import { sellPickKey } from '../../shared/sim/Sim';
import { COIN_ICON } from '../icons';
import { potionTotals } from './hudShared';
import { isTouchMode } from '../touch/device';

export type BagView = 'worn' | 'gear' | 'use';
/** How a cell on the right looks and what pointing at it says. */
export interface CellInfo {
  /** The NPC takes it in its current menu (else it is greyed). */
  usable: boolean;
  /** Marked as picked (gold outline). */
  on?: boolean;
  tip: string;
}

export interface HostPaneSpec {
  /** Its line set in npcTalk (and the CSS class on the pane). */
  kind: Exclude<PanePart, 'shop'>;
  /** The id of the NPC's own window that is moved in. */
  hostId: string;
  title: string;
  bagTitle: string;
  /** The tabs on the right; none = no right side, the NPC window takes the whole width (the cash shop). */
  views: readonly (readonly [BagView, string])[];
  /** The line under the bag (mouse / touch wording). */
  hint: (touch: boolean) => string;
  /** The width (px) the NPC window's layout was made for; a narrower panel zooms it down. */
  designW: number;
  /** The NPC window fills the panel's height too (it scrolls inside itself, not the panel): the cash shop's new layout. */
  fill?(): boolean;
  /** `index` = its bag slot, or its place in EQUIP_SLOTS on the worn tab. */
  cell(e: BagEntry, view: BagView, index: number): CellInfo;
  /** A click (tap) on a cell: `index` = its bag slot, or its place in EQUIP_SLOTS on the worn tab. */
  click(e: BagEntry, view: BagView, index: number): void;
  /** What else changes the right side (redrawn when it does). */
  sig(): string;
  /** Each frame: the tab to show (a menu change may switch it). */
  pickView?(view: BagView): BagView;
  /** On open with the answer's argument (a menu): the tab to start on. */
  onOpen?(arg: string): BagView;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export class NpcHostPane {
  readonly root: HTMLElement;
  private readonly medal: HTMLElement;
  private readonly medalImg: HTMLImageElement;
  private readonly bubble: HTMLElement;
  private readonly box: HTMLElement;
  private readonly bagTabs: HTMLElement;
  private readonly bagBody: HTMLElement;
  private readonly foot: HTMLElement;
  private view: BagView;
  private drawn = '';
  /** Where the NPC window lives when it is not in here (put back on close). */
  private home: { parent: HTMLElement; next: Node | null } | null = null;

  constructor(private readonly g: Game, private readonly say: (text: string) => void, readonly spec: HostPaneSpec) {
    this.view = spec.views[0]?.[0] ?? 'gear';
    this.root = el('div', `ns nh nh-${spec.kind}${spec.views.length ? '' : ' nh-wide'}`);
    this.medal = el('div', 'ns-medal');
    this.medalImg = el('img');
    this.medalImg.alt = '';
    this.medal.append(this.medalImg);
    this.bubble = el('div', 'ns-bubble');

    const left = el('section', 'ns-pnl nh-host');
    left.append(el('div', 'ns-title', spec.title));
    this.box = el('div', 'nh-box');
    left.append(this.box);

    const bag = el('section', 'ns-pnl nh-bag');
    bag.append(el('div', 'ns-title', spec.bagTitle));
    this.bagTabs = el('div', 'ns-tabs');
    for (const [v, label] of spec.views) {
      const b = el('button', 'ns-tab', label);
      b.dataset.v = v;
      b.onclick = () => { this.view = v; this.drawn = ''; this.update(); };
      this.bagTabs.append(b);
    }
    this.bagBody = el('div', 'ns-body');
    this.foot = el('div', 'ns-foot');
    bag.append(this.bagTabs, this.bagBody, el('div', 'ns-hint', spec.hint(isTouchMode())), this.foot);

    this.root.append(this.medal, this.bubble, left);
    if (spec.views.length) this.root.append(bag);
    this.root.addEventListener('mouseleave', () => this.g.hud.hideTip());
  }

  /** Moves the NPC window in; `arg` = the answer's menu, `face` = the portrait, `small` = a square harbour one. */
  open(arg: string, face: string, small: boolean): void {
    const host = document.getElementById(this.spec.hostId)!;
    if (!this.home) this.home = { parent: host.parentElement!, next: host.nextSibling };
    this.box.append(host);
    this.medalImg.src = face;
    this.medal.classList.toggle('small', small);
    this.medal.classList.toggle('hidden', !face);
    this.view = this.spec.onOpen?.(arg) ?? this.spec.views[0]?.[0] ?? 'gear';
    this.drawn = '';
    this.update();
  }

  /** Puts the NPC window back where it lives (the HUD closes it). */
  close(): void {
    this.g.hud.hideTip();
    const host = document.getElementById(this.spec.hostId);
    if (host && this.home) {
      host.style.zoom = '';
      host.style.height = '';
      this.home.parent.insertBefore(host, this.home.next);
    }
    this.home = null;
  }

  /** The NPC says one of its /admin lines for `key` (picked at random), {0} {1} filled in. Plain text. */
  line(key: string, ...args: (string | number)[]): void {
    const lines = (currentBalance().npcTalk[this.spec.kind] as Record<string, string[]>)[key] ?? [];
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

  /** Every frame: fits the NPC window to the panel; redraws the right side only when something shown changed. */
  update(): void {
    const w = this.box.clientWidth;
    const host = document.getElementById(this.spec.hostId);
    if (w > 0 && host) {
      const zn = Math.min(1, w / this.spec.designW);
      const z = String(zn);
      if (host.style.zoom !== z) host.style.zoom = z;
      // Zoom scales its lengths too: the panel's height ÷ zoom shows as the panel's height.
      const fill = this.spec.fill?.() ?? false;
      const hgt = fill ? `${Math.floor(this.box.clientHeight / zn)}px` : '';
      if (host.style.height !== hgt) host.style.height = hgt;
      this.box.classList.toggle('nh-fill', fill);
    }
    if (this.spec.pickView) this.view = this.spec.pickView(this.view);
    const p = this.g.player;
    const key = (e: BagEntry | null | undefined) => (!e ? '' : isItem(e) ? `${e.uid}+${e.plus ?? 0}` : `${sellPickKey(e)}x${e.count}`);
    const sig = [this.view, this.spec.sig(), p.gold, p.bag.map(key).join(','), EQUIP_SLOTS.map((s) => key(p.equipment[s])).join(',')].join('|');
    if (sig === this.drawn || !this.spec.views.length) return;
    this.drawn = sig;
    for (const b of this.bagTabs.querySelectorAll<HTMLElement>('.ns-tab')) b.classList.toggle('on', b.dataset.v === this.view);
    this.foot.innerHTML = `<span class="g">${COIN_ICON} ${p.gold.toLocaleString()} G</span><span class="pots">${potionTotals(p)}</span>`;
    this.drawBag();
  }

  /** Redraw on the next frame (after an action changed what the cells show). */
  dirty(): void {
    this.drawn = '';
  }

  private drawBag(): void {
    const p = this.g.player;
    const cells: [BagEntry | null | undefined, number][] = [];
    if (this.view === 'worn') EQUIP_SLOTS.forEach((s, k) => cells.push([p.equipment[s], k]));
    else {
      const [a, z] = tabRange(p.bagSlots, this.view);
      for (let i = a; i < z; i++) cells.push([p.bag[i], i]);
    }
    const grid = el('div', 'ns-grid nh-grid');
    for (const [e, index] of cells) {
      if (this.view === 'worn' && !e) continue;
      const w = el('div', '');
      w.innerHTML = this.g.hud.itemCell(e, '');
      const c = w.firstElementChild as HTMLElement;
      if (e) {
        const info = this.spec.cell(e, this.view, index);
        if (!info.usable) c.classList.add('ns-nosell');
        if (info.on) c.classList.add('nh-on');
        c.onmousemove = (ev) => { if (!isTouchMode()) this.g.hud.showEntryTip(e, ev, info.tip); };
        c.onclick = () => {
          this.g.hud.hideTip();
          this.spec.click(e, this.view, index);
          this.drawn = '';
        };
      }
      grid.append(c);
    }
    if (!grid.children.length) this.bagBody.replaceChildren(el('div', 'ns-empty', 'ไม่ได้สวมอุปกรณ์'));
    else this.bagBody.replaceChildren(grid);
  }
}
