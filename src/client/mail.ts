// The mailbox window (server/mail.ts decides everything; this only shows the answers and asks).
// A list of mail, and a read view with Claim and Delete. Plain CSS on purpose: the icon and frame are
// easy to swap for painted art later.
import { noTranslate as noTr } from './i18n';
import type { Game } from './Game';
import type { MailAttachItem, MailFull, MailHead, MailReply } from '../shared/mail';
import { playSound } from './audio/sfx';
import { makeItem } from '../shared/data/items';
import { isStoneKind, RARITY_COLOR, type BagEntry } from '../shared/types';
import { COIN_ICON, itemIcon } from './icons';

const BADGE_KEY = 'จดหมาย';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

const when = (ms: number): string => new Date(ms).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const daysLeft = (ms: number): string => {
  const d = Math.ceil((ms - Date.now()) / 86_400_000);
  return d > 1 ? `หมดอายุใน ${d} วัน` : 'หมดอายุภายใน 1 วัน';
};

export class MailUI {
  private readonly win: HTMLElement;
  private readonly body: HTMLElement;
  private readonly msg: HTMLElement;
  private list: MailHead[] = [];
  /** The mail being read (null = the list). */
  private reading: MailFull | null = null;
  private busy = false;

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'mail-win';
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.toggle(false);
    head.append(el('span', '', 'จดหมาย'), close);
    this.body = el('div', 'mail-body');
    this.msg = el('div', 'mail-msg');
    this.win.append(head, this.body, this.msg);
    $('hud').append(this.win);
    this.setBadge(g.backend.mailUnread);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    this.win.classList.toggle('hidden', !show);
    if (!show) return this.g.hud.hideTip();
    this.reading = null;
    this.say('');
    this.render();
    void this.refresh();
  }

  /** The server says new mail came, or what you have when you join. */
  note(unread: number, fresh: number): void {
    this.setBadge(unread);
    if (fresh > 0) {
      this.g.hud.log(`✉ มีจดหมายใหม่ ${fresh} ฉบับ — เปิดดูที่ไอคอนจดหมาย`, '#f2c230');
      playSound('trade');
    }
    if (this.open && !this.reading) void this.refresh();
  }

  private setBadge(n: number): void {
    this.g.sysMenu.setBadge(BADGE_KEY, n);
  }

  private say(msg: string, ok = true): void {
    this.msg.textContent = msg;
    this.msg.style.color = ok ? '#e8e2d0' : '#ff9a8a';
  }

  /** Sends one request and applies what comes back (list, open mail, badge, message). */
  private async call(c: Parameters<Game['backend']['mail']>[0]): Promise<MailReply | null> {
    if (this.busy) return null;
    this.busy = true;
    try {
      const r = await this.g.backend.mail(c);
      if (r.unread !== undefined) this.setBadge(r.unread);
      if (r.list) this.list = r.list;
      if (r.mail) this.reading = r.mail;
      // ok false with no message = asked too fast: just try again.
      if (r.msg) this.say(r.msg, r.ok);
      return r;
    } finally {
      this.busy = false;
    }
  }

  private async refresh(): Promise<void> {
    await this.call({ a: 'mailList' });
    if (this.open) this.render();
  }

  private async openMail(id: number): Promise<void> {
    this.say('');
    const r = await this.call({ a: 'mailRead', id });
    if (r?.mail) this.reading = r.mail;
    this.render();
  }

  private async claim(id: number): Promise<void> {
    const r = await this.call({ a: 'mailClaim', id });
    if (r && id === -1) this.reading = null;
    this.render();
  }

  private async remove(id: number): Promise<void> {
    const r = await this.call({ a: 'mailDelete', id });
    if (r?.ok) this.reading = null;
    this.render();
  }

  private async readAll(): Promise<void> {
    await this.call({ a: 'mailReadAll' });
    this.render();
  }

  private async removeRead(): Promise<void> {
    await this.call({ a: 'mailDeleteRead' });
    this.render();
  }

  private render(): void {
    this.g.hud.hideTip(); // the cell it points at is about to go
    this.body.replaceChildren();
    if (this.reading) return this.renderMail(this.reading);
    const bar = el('div', 'mail-bar');
    const all = el('button', '', 'รับทั้งหมด');
    all.onclick = () => void this.claim(-1);
    const readAll = el('button', '', 'อ่านทั้งหมด');
    readAll.title = 'ทำเครื่องหมายว่าอ่านแล้วทุกฉบับ (ไม่รับของแนบ)';
    readAll.onclick = () => void this.readAll();
    const del = el('button', '', 'ลบที่อ่านแล้วทั้งหมด');
    del.onclick = () => void this.removeRead();
    bar.append(all, readAll, del);
    const list = el('div', 'mail-list');
    for (const m of this.list) {
      const row = el('button', `mail-row${m.read ? '' : ' unread'}`);
      row.append(
        el('span', 'mail-title', `${m.read ? '' : '● '}${m.attach ? '🎁 ' : ''}${m.title}`),
        el('span', 'mail-meta', `${m.from} · ${when(m.at)}`),
      );
      row.onclick = () => void this.openMail(m.id);
      list.append(row);
    }
    if (!this.list.length) list.append(el('div', 'mail-empty', 'ไม่มีจดหมาย'));
    this.body.append(bar, list);
  }

  private renderMail(m: MailFull): void {
    const back = el('button', '', '‹ กลับ');
    back.onclick = () => {
      this.reading = null;
      this.say('');
      this.render();
      void this.refresh();
    };
    const claim = el('button', 'primary', 'รับของ');
    claim.disabled = !m.attach;
    claim.onclick = () => void this.claim(m.id);
    const del = el('button', '', 'ลบ');
    del.disabled = m.attach;
    del.title = m.attach ? 'ยังมีของแนบที่ยังไม่ได้รับ ลบไม่ได้' : '';
    del.onclick = () => void this.remove(m.id);
    const attach = el('div', 'mail-attach');
    if (m.lines.length) {
      const items = el('div', 'mail-items');
      items.append(...this.attachRows(m));
      attach.append(el('b', '', 'ของแนบ'), items);
    } else if (!m.attach) attach.append(el('span', 'mail-meta', 'ไม่มีของแนบที่รอรับ'));
    const bar = el('div', 'mail-bar');
    bar.append(back, claim, del);
    this.body.append(
      noTr(el('div', 'mail-subject', m.title)),
      el('div', 'mail-meta', `จาก ${m.from} · ${when(m.at)} · ${daysLeft(m.expiresAt)}`),
      noTr(el('div', 'mail-text', m.body)),
      attach,
      bar,
    );
  }

  /** Each attachment as a bag cell with its name beside it. m.lines and the cells share one order: gold, then the items. */
  private attachRows(m: MailFull): HTMLElement[] {
    const { gold = 0, items = [] } = m.gifts ?? {};
    const cells = [
      ...(gold ? [{ html: `<div class="cell" style="--rc:#d8b45a">${COIN_ICON}</div>` }] : []),
      ...items.map((x) => this.attachCell(x)),
    ];
    return m.lines.map((line, i) => {
      const row = el('div', 'mail-item');
      const c: { html: string; entry?: BagEntry } | undefined = cells[i];
      row.innerHTML = c?.html ?? ''; // our own icon markup only, never mail text
      const entry = c?.entry;
      const cell = row.querySelector<HTMLElement>('.cell');
      if (entry && cell) {
        cell.onmousemove = (e) => this.g.hud.showEntryTip(entry, e, '');
        cell.onmouseleave = () => this.g.hud.hideTip();
      }
      row.append(el('span', '', line));
      return row;
    });
  }

  /**
   * One attachment's cell. Potions and stones are the bag's own cell and tooltip. Gear is only rolled when it is
   * claimed, so its cell shows the look (picture for your class, rarity frame, +N, ×count) and no stats.
   */
  private attachCell(x: MailAttachItem): { html: string; entry?: BagEntry } {
    if (x.kind === 'equip') {
      const p = this.g.player;
      const item = makeItem(x.baseId, x.rarity, x.level ?? p.level, p.cls.id);
      if (!item) return { html: '<div class="cell empty"></div>' }; // a kind removed since it was sent
      const plus = x.plus ? `<span class="iplus">+${x.plus}</span>` : '';
      return { html: `<div class="cell r-${item.rarity}" style="--rc:${RARITY_COLOR[item.rarity]}">${itemIcon(item)}${plus}<span class="ilv">×${x.count}</span></div>` };
    }
    let entry: BagEntry;
    if (x.kind === 'potion') entry = { potion: x.potion, size: x.size, count: x.count };
    else if (isStoneKind(x.stone)) entry = { stone: x.stone, count: x.count };
    else return { html: '<div class="cell empty"></div>' };
    return { html: this.g.hud.itemCell(entry, ''), entry };
  }
}
