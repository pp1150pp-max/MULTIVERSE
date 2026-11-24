// Item links in chat, browser side (src/shared/chatLinks.ts has the rules): the links being typed,
// drawing a message with clickable item names, and the popup a click opens.
import { CHAT_LINK_MAX, linkLabel, splitLinks, type ChatLink, type ChatLinkRef } from '../shared/chatLinks';
import type { BagEntry } from '../shared/types';
import { makeDraggable } from './dragwindow';
import { said, t } from './i18n';
import { entryColor } from './ui/hudShared';

/** The links typed into one text box (the chat or the megaphone) since it was last sent or closed. */
export class LinkDraft {
  private links: { label: string; ref: ChatLinkRef }[] = [];

  /**
   * Puts "[name]" into the box at the caret (or the end) and remembers where the item is.
   * Returns why not (too many links, too long) or '' when done.
   */
  add(box: HTMLInputElement | HTMLTextAreaElement, entry: BagEntry, ref: ChatLinkRef, maxLen: number): string {
    const kept = this.refs(box.value);
    if (kept.length >= CHAT_LINK_MAX) return `ใส่ลิงก์ไอเทมได้ข้อความละ ${CHAT_LINK_MAX} ชิ้น`;
    const label = linkLabel(entry);
    const v = box.value;
    const focused = document.activeElement === box;
    const at = focused ? box.selectionStart ?? v.length : v.length;
    const end = focused ? box.selectionEnd ?? at : at;
    const before = v.slice(0, at);
    const after = v.slice(end);
    const pad = before && !/\s$/.test(before) ? ' ' : '';
    const next = `${before}${pad}${label} ${after.replace(/^\s+/, '')}`;
    if ([...next.trimEnd()].length > maxLen) return 'ข้อความยาวเกินไป ใส่ลิงก์เพิ่มไม่ได้';
    box.value = next;
    const caret = before.length + pad.length + label.length + 1;
    box.setSelectionRange(caret, caret);
    // A link put in at the caret goes before ones already further on, so keep them in text order.
    this.links = this.inOrder(next, [...this.links, { label, ref }]);
    return '';
  }

  /** The refs whose label is still in the text, in the order the server finds them (deleted ones dropped). */
  refs(text: string): ChatLinkRef[] {
    return this.inOrder(text, this.links).map((l) => l.ref);
  }

  clear(): void {
    this.links = [];
  }

  private inOrder(text: string, links: { label: string; ref: ChatLinkRef }[]): { label: string; ref: ChatLinkRef }[] {
    // Each label claims its first free place in the text; links whose label is gone drop out.
    const taken: number[] = [];
    const placed: { at: number; l: { label: string; ref: ChatLinkRef } }[] = [];
    for (const l of links) {
      let at = text.indexOf(l.label);
      while (at >= 0 && taken.includes(at)) at = text.indexOf(l.label, at + 1);
      if (at < 0) continue;
      taken.push(at);
      placed.push({ at, l });
    }
    return placed.sort((a, b) => a.at - b.at).map((p) => p.l).slice(0, CHAT_LINK_MAX);
  }
}

/**
 * Appends `text` to `el` as text nodes, with each link as a clickable name in its rarity colour.
 * Everything goes in as textContent: nothing anyone types becomes HTML. `el` should be marked as a
 * player's own words (translate="no", src/client/i18n.ts); the item names are put in the page's
 * language here with t(), since the page translator skips that whole branch.
 */
export function appendLinked(el: HTMLElement, text: string, links: readonly ChatLink[] | undefined, open: (entry: BagEntry) => void): void {
  for (const part of splitLinks(text, links ?? [])) {
    if (typeof part === 'string') {
      el.append(document.createTextNode(part));
      continue;
    }
    const a = document.createElement('span');
    a.className = 'ilink';
    a.textContent = t(text.slice(part.at, part.at + part.len));
    a.style.color = entryColor(part.entry);
    a.title = t('คลิกเพื่อดูข้อมูลไอเทม');
    a.addEventListener('mousedown', (e) => e.preventDefault()); // keep typing in the chat box
    a.addEventListener('click', (e) => {
      e.stopPropagation(); // not the whisper line's "answer" click
      open(part.entry);
    });
    el.append(a);
  }
}

/** A player's words with their item links, as a span the page translator leaves alone (like said()). */
export function linkedWords(text: string, links: readonly ChatLink[] | undefined, open: (entry: BagEntry) => void): HTMLSpanElement {
  const s = said('');
  appendLinked(s, text, links, open);
  return s;
}

/** What the popup needs from the HUD: the tooltip builders (they write into #tooltip). */
export interface LinkPopupHost {
  showEntryTip(entry: BagEntry, e: MouseEvent, hint: string): void;
  hideTip(): void;
}

/** The window a clicked item link opens: the item's tooltip, kept up until closed. Works on touch too. */
export class LinkPopup {
  private el: HTMLElement | null = null;

  constructor(private readonly host: LinkPopupHost) {}

  get isOpen(): boolean {
    return !!this.el && !this.el.classList.contains('hidden');
  }

  open(entry: BagEntry): void {
    if (!this.el) {
      const el = document.createElement('div');
      el.id = 'item-link-pop';
      el.className = 'panel hidden';
      const head = document.createElement('div');
      head.className = 'panel-head';
      const title = document.createElement('span');
      title.textContent = 'ข้อมูลไอเทม';
      const close = document.createElement('button');
      close.textContent = '✕';
      close.onclick = () => this.close();
      head.append(title, close);
      const body = document.createElement('div');
      body.className = 'ilp-body';
      el.append(head, body);
      document.getElementById('hud')!.append(el);
      makeDraggable(el, head);
      this.el = el;
    }
    // The tooltip builders write into #tooltip: borrow that HTML (as the touch item sheet does).
    this.host.showEntryTip(entry, new MouseEvent('mousemove'), '');
    const tip = document.getElementById('tooltip')!;
    this.el.querySelector('.ilp-body')!.innerHTML = tip.innerHTML;
    this.host.hideTip();
    this.el.classList.remove('hidden');
  }

  close(): void {
    this.el?.classList.add('hidden');
  }
}
