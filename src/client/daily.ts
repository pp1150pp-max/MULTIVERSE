// The daily login calendar window (rules: src/shared/daily.ts). The server mails each day's reward the first
// time the account is in the game that day and then pops this up; the HUD button opens it any time. A missed
// day can be made up (DAILY_MAKEUPS a month): click it, then the make-up button. Everything is checked by the server.
import type { Game } from './Game';
import { DAILY_MAKEUPS, THAI_MONTHS, type DailyView } from '../shared/daily';
import { STONE_COLOR, STONE_NAME } from '../shared/data/stones';
import { stoneIcon } from './icons';

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class DailyUI {
  private readonly win: HTMLElement;
  private readonly title: HTMLElement;
  private readonly note: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly foot: HTMLElement;
  private readonly makeBtn: HTMLButtonElement;
  private view: DailyView | null = null;
  /** The missed day clicked, waiting for the make-up button. */
  private pick = 0;

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'daily-win';
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.toggle(false);
    this.title = el('span', '', 'ล็อกอินรายวัน');
    head.append(this.title, close);
    this.note = el('div', 'daily-note');
    this.grid = el('div', 'daily-grid');
    this.foot = el('div', 'daily-foot');
    this.makeBtn = el('button', 'primary');
    this.makeBtn.onclick = () => {
      if (this.pick) this.g.backend.dailyMakeup(this.pick);
      this.pick = 0;
    };
    const mailBtn = el('button', '', 'เปิดกล่องจดหมาย');
    mailBtn.onclick = () => {
      this.toggle(false);
      this.g.mailUI.toggle(true);
    };
    const btns = el('div', 'daily-btns');
    btns.append(this.makeBtn, mailBtn);
    this.win.append(head, this.note, this.grid, this.foot, btns);
    this.grid.addEventListener('click', (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-day]');
      const day = Number(cell?.dataset.day);
      if (!this.view || !day || this.view.days[day - 1]?.state !== 'missed') return;
      this.pick = this.pick === day ? 0 : day;
      this.render();
    });
    document.getElementById('hud')!.append(this.win);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  /** The button: open asks the server for this month's calendar (it answers with show()). */
  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    if (!show) return void this.win.classList.add('hidden');
    if (this.g.backend.guest) return this.g.hud.log('Guest ไม่มีปฏิทินล็อกอินรายวัน — สมัครสมาชิกเพื่อรับของทุกวัน', '#ff8a6a');
    this.g.backend.dailyOpen();
  }

  /** A calendar from the server. With `popup` it opens by itself (today's reward was just mailed). */
  show(v: DailyView): void {
    this.view = v;
    if (this.pick && v.days[this.pick - 1]?.state !== 'missed') this.pick = 0;
    this.render();
    this.win.classList.remove('hidden');
    if (v.popup) {
      const r = v.days[v.today - 1].reward;
      this.g.hud.log(`🎁 ล็อกอินรายวัน: ได้${STONE_NAME[r.stone]} ×${r.count} — ส่งเข้ากล่องจดหมายแล้ว`, '#ffd34a');
    }
  }

  private render(): void {
    const v = this.view;
    if (!v) return;
    this.title.textContent = `ล็อกอินรายวัน · ${THAI_MONTHS[v.month - 1]} ${v.year + 543}`;
    const today = v.days[v.today - 1];
    this.note.textContent = today.state === 'today'
      ? 'กำลังส่งของของวันนี้…'
      : 'ของของวันนี้ส่งเข้ากล่องจดหมายแล้ว — เข้าเกมทุกวันเพื่อรับของของวันนั้น (ตัดวันตอนเที่ยงคืน)';
    const cells: string[] = WEEKDAYS.map((w) => `<div class="daily-wd">${w}</div>`);
    for (let i = 0; i < v.firstWeekday; i++) cells.push('<div class="daily-cell blank"></div>');
    v.days.forEach((d, i) => {
      const day = i + 1;
      const mark = d.state === 'got' ? '<span class="daily-mark">✓</span>' : d.state === 'madeUp' ? '<span class="daily-mark">✓ ชดเชย</span>' : '';
      const cls = `daily-cell ${d.state}${day === v.today ? ' is-today' : ''}${day === this.pick ? ' picked' : ''}`;
      const tip = `${day} ${THAI_MONTHS[v.month - 1]}: ${STONE_NAME[d.reward.stone]} ×${d.reward.count}${d.state === 'missed' ? (v.makeupsLeft ? ' — คลิกเพื่อเลือกชดเชย' : ' — พลาดแล้ว') : ''}`;
      cells.push(
        `<div class="${cls}" data-day="${day}" title="${tip}" style="--rc:${STONE_COLOR[d.reward.stone]}">` +
          `<span class="daily-num">${day}</span>${stoneIcon(d.reward.stone)}<span class="daily-count">×${d.reward.count}</span>${mark}</div>`,
      );
    });
    this.grid.innerHTML = cells.join('');
    this.foot.textContent = `ชดเชยวันที่พลาดได้อีก ${v.makeupsLeft} / ${DAILY_MAKEUPS} ครั้งในเดือนนี้ · ของทุกวันส่งเข้ากล่องจดหมายของบัญชี`;
    this.makeBtn.disabled = !this.pick || v.makeupsLeft < 1;
    this.makeBtn.textContent = this.pick ? `ชดเชยวันที่ ${this.pick}` : v.makeupsLeft ? 'เลือกวันที่พลาดเพื่อชดเชย' : 'ชดเชยครบแล้วเดือนนี้';
  }
}
