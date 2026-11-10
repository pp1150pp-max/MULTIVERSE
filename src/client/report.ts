// The "แจ้งปัญหา" window: pick a topic, write what happened, send. The server checks every limit
// (server/reports.ts) and adds the map, position, level and ping itself; this only mirrors the limits so
// the player sees them, greys the button while the cooldown runs and shows the server's refusal.
import type { Game } from './Game';
import { REPORT_COOLDOWN_MS, REPORT_MAX, REPORT_MIN, REPORT_TOPICS } from '../shared/reports';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class ReportUI {
  private readonly win: HTMLElement;
  private readonly topic: HTMLSelectElement;
  private readonly text: HTMLTextAreaElement;
  private readonly count: HTMLElement;
  private readonly send: HTMLButtonElement;
  private readonly msg: HTMLElement;
  private busy = false;
  /** performance.now() when the send button works again. */
  private readyAt = 0;
  private timer = 0;

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'report-win';
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.toggle(false);
    head.append(el('span', '', 'แจ้งปัญหา / ข้อเสนอแนะ'), close);
    const body = el('div', 'report-body');
    this.topic = el('select');
    for (const t of REPORT_TOPICS) this.topic.append(new Option(t.label, t.id));
    this.text = el('textarea');
    this.text.maxLength = REPORT_MAX;
    this.text.rows = 6;
    this.text.placeholder = `เล่าให้ละเอียด (${REPORT_MIN}–${REPORT_MAX} ตัวอักษร) — ถ้าแจ้งผู้เล่น ใส่ชื่อตัวละครและเหตุผลด้วย`;
    this.text.oninput = () => this.refresh();
    this.count = el('div', 'report-count');
    const note = el('div', 'report-note', 'ระบบแนบแมพ ตำแหน่ง เลเวล และค่า Ping/FPS ให้เอง ไม่ต้องพิมพ์');
    this.send = el('button', 'primary', 'ส่งรายงาน');
    this.send.onclick = () => void this.submit();
    this.msg = el('div', 'report-msg');
    body.append(this.topic, this.text, this.count, note, this.send, this.msg);
    this.win.append(head, body);
    document.getElementById('hud')!.append(this.win);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    this.win.classList.toggle('hidden', !show);
    if (show) this.refresh();
  }

  /** Counter text and the send button's state (typed length, a request in flight, the cooldown). */
  private refresh(): void {
    const n = [...this.text.value.trim()].length;
    this.count.textContent = `${n}/${REPORT_MAX}`;
    const wait = Math.ceil((this.readyAt - performance.now()) / 1000);
    if (wait > 0) {
      this.send.disabled = true;
      this.send.textContent = `ส่งได้อีกใน ${wait} วินาที`;
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.refresh(), 500);
      return;
    }
    this.send.disabled = this.busy || n < REPORT_MIN;
    this.send.textContent = 'ส่งรายงาน';
  }

  private say(msg: string, ok: boolean): void {
    this.msg.textContent = msg;
    this.msg.style.color = ok ? '#9fe0a0' : '#ff9a8a';
  }

  private async submit(): Promise<void> {
    if (this.busy || this.send.disabled) return;
    this.busy = true;
    this.refresh();
    try {
      const r = await this.g.backend.report(this.topic.value, this.text.value);
      this.say(r.msg, r.ok);
      if (r.ok) this.text.value = '';
      if (r.cooldownMs) this.readyAt = performance.now() + Math.min(r.cooldownMs, REPORT_COOLDOWN_MS);
    } finally {
      this.busy = false;
      this.refresh();
    }
  }
}
