// The megaphone window: type a message (up to MEGAPHONE_MAX characters) and announce it to the whole
// server. The server checks everything (Guest, length, the server-wide cooldown) and answers in chat;
// a refusal keeps the megaphone.
import type { Game } from './Game';
import { MEGAPHONE_EVERY_MS, MEGAPHONE_MAX, megaphoneText } from '../shared/data/stones';
import type { ChatLinkRef } from '../shared/chatLinks';
import type { BagEntry } from '../shared/types';
import { LinkDraft } from './chatLinks';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class MegaphoneUI {
  private readonly win: HTMLElement;
  private readonly text: HTMLTextAreaElement;
  private readonly count: HTMLElement;
  private readonly send: HTMLButtonElement;
  /** Item links typed in (Ctrl+click an item while this window is open). */
  private readonly links = new LinkDraft();

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'megaphone-win';
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.toggle(false);
    head.append(el('span', '', '📣 โทรโข่ง'), close);
    const body = el('div', 'mega-body');
    this.text = el('textarea');
    this.text.maxLength = MEGAPHONE_MAX;
    this.text.rows = 3;
    this.text.placeholder = `ข้อความถึงผู้เล่นทุกคนในเซิร์ฟเวอร์ (ไม่เกิน ${MEGAPHONE_MAX} ตัว)`;
    this.text.oninput = () => this.refresh();
    this.text.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submit();
      } else if (e.key === 'Escape') this.toggle(false);
    };
    this.count = el('div', 'mega-count');
    const note = el('div', 'mega-note', `ใช้โทรโข่ง 1 อันต่อครั้ง · ทั้งเซิร์ฟเวอร์ประกาศได้ 1 ครั้งต่อ ${MEGAPHONE_EVERY_MS / 1000} วินาที ถ้าติดคิว โทรโข่งไม่หาย`);
    this.send = el('button', 'primary', 'ประกาศ');
    this.send.onclick = () => this.submit();
    body.append(this.text, this.count, note, this.send);
    this.win.append(head, body);
    document.getElementById('hud')!.append(this.win);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    this.win.classList.toggle('hidden', !show);
    if (!show) return;
    this.refresh();
    // A refused message stays typed; selected, so typing a new one replaces it.
    this.text.focus();
    this.text.select();
  }

  private refresh(): void {
    const n = [...this.text.value.trim()].length;
    this.count.textContent = `${n}/${MEGAPHONE_MAX}`;
    this.send.disabled = n === 0 || n > MEGAPHONE_MAX;
  }

  /** Ctrl+click on an item while this window is open: its "[name]" goes in. Returns why not, or ''. */
  addLink(entry: BagEntry, ref: ChatLinkRef): string {
    const why = this.links.add(this.text, entry, ref, MEGAPHONE_MAX);
    this.text.focus();
    this.refresh();
    return why;
  }

  private submit(): void {
    const msg = megaphoneText(this.text.value);
    if ('error' in msg) return this.g.hud.log(msg.error, '#ff8a6a');
    if (this.g.player.stoneCount('megaphone') < 1) return this.g.hud.log('ไม่มีโทรโข่ง', '#ff8a6a');
    // The links stay with the text: a refused message is kept typed, and a link whose name is gone isn't sent.
    this.g.backend.useMegaphone(msg.text, this.links.refs(msg.text));
    this.toggle(false);
  }
}
