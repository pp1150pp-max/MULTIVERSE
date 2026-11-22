// The "มีอะไรใหม่" window (docs/systems/news.md): the newest update notes the owner posted. The server pushes them to everyone
// (guests too) a moment after joining and whenever they change. The button shows a red dot while a note is newer than the last one
// this browser opened (localStorage); the window never opens by itself, except once on join when the /admin switch says so.
import type { Game } from './Game';
import { newsDate, type NewsView } from '../shared/news';

const SEEN_KEY = 'multiverse-news-seen';
/** Must match the label in src/shared/menuLayout.ts (the badge is found by it). */
export const NEWS_BADGE = 'มีอะไรใหม่';

/** The button exists only while the /admin switch is on (and the server has told us). */
let buttonOn = false;
export const newsButtonOn = (): boolean => buttonOn;

function seenId(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class NewsUI {
  private readonly win: HTMLElement;
  private readonly list: HTMLElement;
  private view: NewsView | null = null;
  /** The first news message of this page load may open the window; later ones (a live change) never do. */
  private first = true;

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'news-win';
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.toggle(false);
    head.append(el('span', '', 'มีอะไรใหม่'), close);
    this.list = el('div', 'news-list');
    this.win.append(head, this.list);
    document.getElementById('hud')!.append(this.win);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    if (show) {
      this.g.hud.closePanels();
      this.render();
      this.markSeen();
    }
    this.win.classList.toggle('hidden', !show);
  }

  /** From the server: the notes and switches (on join, and after every change). */
  show(v: NewsView): void {
    const changedButton = v.button !== buttonOn;
    this.view = v;
    buttonOn = v.button;
    if (changedButton) this.g.sysMenu.rebuild();
    if (this.open) {
      this.render();
      this.markSeen();
    } else {
      this.updateBadge();
      if (this.first && v.button && v.autopop && this.unread()) this.toggle(true);
    }
    this.first = false;
  }

  private unread(): boolean {
    const top = this.view?.notes[0];
    return !!top && top.id > seenId();
  }

  private updateBadge(): void {
    this.g.sysMenu.setBadge(NEWS_BADGE, this.view?.button && this.unread() ? 1 : 0);
  }

  private markSeen(): void {
    const top = this.view?.notes.reduce((m, n) => Math.max(m, n.id), 0) ?? 0;
    try {
      if (top > seenId()) localStorage.setItem(SEEN_KEY, String(top));
    } catch {
      // storage blocked: the dot just comes back next time
    }
    this.updateBadge();
  }

  private render(): void {
    const notes = this.view?.notes ?? [];
    if (!notes.length) {
      this.list.replaceChildren(el('div', 'news-empty', 'ยังไม่มีประกาศอัปเดต'));
      return;
    }
    this.list.replaceChildren(...notes.map((n) => {
      const box = el('section', 'news-note');
      const head = el('div', 'news-head');
      head.append(el('span', 'news-title', n.title), el('span', 'news-date', newsDate(n.at)));
      const ul = el('ul', 'news-lines');
      for (const l of n.lines) ul.append(el('li', '', l));
      box.append(head, ul);
      return box;
    }));
  }
}
