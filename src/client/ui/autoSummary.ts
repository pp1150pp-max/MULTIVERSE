// The "while you were away" summary (owner 2026-11-27, docs/systems/world-and-ui.md): with Auto Play on and the game
// not touched (no key, click, tap or wheel) for `auto.summaryMin` minutes (/admin, code 3), a window shows what Auto
// earned since the game was last touched, and keeps counting until the player closes it (✕ or a double click).
// The numbers are the server's (`PrivateSnap.at`, src/shared/sim/autoTally.ts), so a hidden tab and a dropped
// connection that kept farming are both counted.
import type { Game } from '../Game';
import { currentBalance } from '../../shared/balance';
import { copyTally, emptyTally, tallySince, type AutoTally } from '../../shared/sim/autoTally';
import { RARITIES, RARITY_COLOR, RARITY_LABEL } from '../../shared/types';

const ACTIVITY = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m}:${ss} นาที`;
}

export class AutoSummaryWindow {
  private readonly root = el('div', 'auto-sum-back hidden');
  private readonly body = el('div', 'auto-sum-body');
  private readonly status = el('div', 'auto-sum-status');
  private readonly since = el('div', 'auto-sum-since');
  private open = false;
  /** When the game was last touched (performance.now()). */
  private lastActive = performance.now();
  /** The Auto tally when the game was last touched (null = no Auto run seen since). */
  private base: AutoTally | null = null;
  /** True until the first tally after the page loaded: it becomes the base (what came before is not "away"). */
  private fresh = true;
  /** Auto ran at some point since the game was last touched. */
  private autoSeen = false;
  /** Why Auto switched itself off since then (the server's message), if it did. */
  private stopMsg: string | null = null;
  /** Opened from the settings as a rest screen: all black, the game is not drawn (Game.restScreen). */
  private rest = false;

  constructor(private readonly g: Game) {
    const panel = el('div', 'panel auto-sum');
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.close();
    head.append(el('span', '', 'สรุปผล Auto'), close);
    panel.append(head, this.since, this.status, this.body, el('div', 'hint auto-sum-hint', 'ดับเบิลคลิกเพื่อปิด'));
    this.root.append(panel);
    this.root.addEventListener('dblclick', () => this.close());
    // Phones don't always send dblclick (double tap zooms): two taps within 0.4 s close it too.
    let lastTap = -Infinity;
    this.root.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.timeStamp - lastTap < 400) this.close();
      lastTap = e.timeStamp;
    });
    document.body.append(this.root);
    for (const t of ACTIVITY) window.addEventListener(t, () => this.touched(), { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => this.tick());
    window.setInterval(() => this.tick(), 1000);
  }

  /** Auto switched itself off (bag full, out of potions, ...): shown as the reason. */
  autoStopped(msg: string): void {
    this.stopMsg = msg;
    if (this.open) this.render();
  }

  private tally(): AutoTally | null {
    return this.g.player.autoTally;
  }

  /** The player touched the game: start counting from now, unless the summary is due (then it opens instead). */
  private touched(): void {
    if (this.open) return;
    if (this.due()) return this.show();
    this.restart();
  }

  private restart(): void {
    this.lastActive = performance.now();
    const t = this.tally();
    this.base = t ? copyTally(t) : null;
    if (t) this.fresh = false;
    this.autoSeen = this.g.autoPlay;
    this.stopMsg = null;
  }

  private due(): boolean {
    const cfg = currentBalance().auto;
    return cfg.summary && this.autoSeen && performance.now() - this.lastActive >= cfg.summaryMin * 60_000;
  }

  private tick(): void {
    const t = this.tally();
    if (t && (this.fresh || !this.base)) {
      // First numbers after the page loaded: count from here. A run with no base yet (Auto just switched on): from zero.
      this.base = this.fresh ? copyTally(t) : emptyTally(t.id);
      this.fresh = false;
    } else if (t && this.base && t.id !== this.base.id) this.base = emptyTally(t.id);
    if (this.g.autoPlay) this.autoSeen = true;
    if (!this.open && this.due()) this.show();
    else if (this.open) this.render();
  }

  private show(): void {
    this.open = true;
    this.root.classList.remove('hidden');
    this.render();
  }

  /**
   * "พักหน้าจอ" from the settings (owner 2026-11-27): the summary at once, over a black screen, counting from now; the
   * game stops drawing until it is closed (Auto keeps farming on the server).
   */
  openRest(): void {
    if (this.open) this.close();
    this.restart();
    this.rest = true;
    this.root.classList.add('rest');
    this.g.restScreen = true;
    this.show();
  }

  private close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.add('hidden');
    if (this.rest) {
      this.rest = false;
      this.root.classList.remove('rest');
      this.g.restScreen = false;
    }
    this.restart();
  }

  private render(): void {
    const t = this.tally();
    const d = t && this.base ? tallySince(t, this.base) : emptyTally(0);
    this.since.textContent = `${this.rest ? 'พักหน้าจอ' : 'ระหว่างที่คุณไม่อยู่'} · ${clock(performance.now() - this.lastActive)}`;
    this.status.textContent = this.g.autoPlay ? 'Auto กำลังทำงาน' : `Auto หยุดแล้ว${this.stopMsg ? ` — ${this.stopMsg}` : ''}`;
    this.status.classList.toggle('off', !this.g.autoPlay);
    const rows: [string, string][] = [
      ['EXP', `+${d.exp.toLocaleString()}`],
      ...(d.lv > 0 ? [['เลเวลอัพ', `+${d.lv}`] as [string, string]] : []),
      ['ทอง', `+${d.gold.toLocaleString()} G`],
      ['มอนที่ล่า', `${d.kills.toLocaleString()} ตัว`],
    ];
    const items = d.items.reduce((a, b) => a + b, 0);
    rows.push(['ไอเทม', `${items.toLocaleString()} ชิ้น`]);
    if (d.stones > 0) rows.push(['หิน / กุญแจ', `${d.stones.toLocaleString()} ชิ้น`]);
    rows.push(['ยาที่เก็บได้', `${d.potGot.toLocaleString()} ขวด`], ['ยาที่ใช้', `${d.potUsed.toLocaleString()} ขวด`]);
    if (d.deaths > 0) rows.push(['ตาย', `${d.deaths} ครั้ง`]);
    const list = rows.map(([k, v]) => {
      const r = el('div', 'auto-sum-row');
      r.append(el('span', '', k), el('b', '', v));
      return r;
    });
    const chips = el('div', 'auto-sum-rarity');
    RARITIES.forEach((r, i) => {
      if (!d.items[i]) return;
      const c = el('span', 'auto-sum-chip', `${RARITY_LABEL[r]} ${d.items[i]}`);
      c.style.color = RARITY_COLOR[r];
      chips.append(c);
    });
    this.body.replaceChildren(...list, ...(chips.childElementCount ? [chips] : []));
  }
}
