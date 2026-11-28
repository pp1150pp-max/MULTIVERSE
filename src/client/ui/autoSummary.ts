// The "while you were away" summary (owner 2026-11-27, docs/systems/world-and-ui.md): with Auto Play on and the game
// not touched (no key, click, tap or wheel) for `auto.summaryMin` minutes (/admin, code 3), a window shows what Auto
// earned since the game was last touched, and keeps counting until the player closes it (✕ or a double click).
// The numbers are the server's (`PrivateSnap.at`, src/shared/sim/autoTally.ts), so a hidden tab and a dropped
// connection that kept farming are both counted.
//
// Look (owner 2026-11-28): three big numbers (EXP, gold, monsters) with icons, then every item picked up as a grid of
// bag cells (the bag's own Hud.itemCell: paper icons, rarity frames, +N, ×count), best first, scrolling, pointing at
// a cell shows the bag's tooltip. Gear beyond what the server keeps pictures of (auto.summaryGear) is one "+N" cell.
import type { Game } from '../Game';
import { t } from '../i18n';
import { COIN_ICON, iconImg } from '../icons';
import { currentBalance } from '../../shared/balance';
import { copyTally, emptyTally, rarityRank, tallySince, type AutoTally } from '../../shared/sim/autoTally';
import { isStoneKind, type BagEntry, type PotionKind, type PotionSize } from '../../shared/types';

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
  return h > 0 ? t('{0} ชม. {1} นาที', [h, m]) : t('{0}:{1} นาที', [m, ss]);
}

const POT_ORDER: Record<string, number> = { hp: 0, mp: 1 };
const SIZE_ORDER: Record<string, number> = { l: 0, m: 1, s: 2 };

/**
 * Everything picked up in `d`, as bag entries in the summary's order: gear (best rarity, then highest level), then
 * stones / keys / cards / boxes / scrolls (as picked up), then potions (HP before MP, big before small).
 */
export function summaryEntries(d: AutoTally): BagEntry[] {
  const gear = [...(d.gear ?? [])].map((g) => g.item)
    .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || b.level - a.level);
  const stones: BagEntry[] = [];
  const pots: { potion: PotionKind; size: PotionSize; count: number }[] = [];
  for (const [key, count] of Object.entries(d.got ?? {})) {
    if (count <= 0) continue;
    if (key.startsWith('st:')) {
      const stone = key.slice(3);
      if (isStoneKind(stone)) stones.push({ stone, count });
    } else if (key.startsWith('pot:')) {
      const [, potion, size] = key.split(':');
      if ((potion === 'hp' || potion === 'mp') && (size === 's' || size === 'm' || size === 'l')) pots.push({ potion, size, count });
    }
  }
  pots.sort((a, b) => POT_ORDER[a.potion] - POT_ORDER[b.potion] || SIZE_ORDER[a.size] - SIZE_ORDER[b.size]);
  return [...gear, ...stones, ...pots];
}

export class AutoSummaryWindow {
  private readonly root = el('div', 'auto-sum-back hidden');
  private readonly status = el('div', 'auto-sum-status');
  private readonly since = el('div', 'auto-sum-since');
  private readonly stats = el('div', 'auto-sum-stats');
  private readonly itemsHead = el('div', 'auto-sum-items-head');
  private readonly grid = el('div', 'auto-sum-grid');
  private readonly foot = el('div', 'auto-sum-foot');
  /** What the grid shows (index = data-i), and its signature (the grid is rebuilt only when it changes). */
  private shown: BagEntry[] = [];
  private gridKey = '';
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
    head.append(el('span', '', t('สรุปผล Auto')), close);
    const items = el('div', 'auto-sum-items');
    items.append(this.itemsHead, this.grid);
    panel.append(head, this.since, this.status, this.stats, items, this.foot, el('div', 'hint auto-sum-hint', t('ดับเบิลคลิกเพื่อปิด')));
    this.root.append(panel);
    this.root.addEventListener('dblclick', () => this.close());
    // Phones don't always send dblclick (double tap zooms): two taps within 0.4 s close it too. A tap is a touch that
    // didn't move, so flicking the item grid up and down never closes it.
    let lastTap = -Infinity;
    let down: { x: number; y: number } | null = null;
    this.root.addEventListener('pointerdown', (e) => {
      down = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
    });
    this.root.addEventListener('pointerup', (e) => {
      if (!down || e.pointerType === 'mouse') return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10;
      down = null;
      if (moved) return;
      if (e.timeStamp - lastTap < 400) this.close();
      lastTap = e.timeStamp;
    });
    // Pointing at a cell: the bag's tooltip for it.
    this.grid.addEventListener('mousemove', (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
      const entry = cell ? this.shown[Number(cell.dataset.i)] : undefined;
      if (entry) this.g.hud.showEntryTip(entry, e, '');
      else this.g.hud.hideTip();
    });
    this.grid.addEventListener('mouseleave', () => this.g.hud.hideTip());
    document.body.append(this.root);
    for (const k of ACTIVITY) window.addEventListener(k, () => this.touched(), { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => this.tick());
    window.setInterval(() => this.tick(), 1000);
  }

  /** Auto switched itself off (bag full, out of potions, ...): shown as the reason. */
  autoStopped(msg: string): void {
    this.stopMsg = msg;
    if (this.open) this.render();
  }

  /** The run's tally with its gear pictures (they come apart, PrivateSnap.ag). */
  private tally(): AutoTally | null {
    const t0 = this.g.player.autoTally;
    return t0 ? { ...t0, gear: this.g.player.autoGear } : null;
  }

  /** The player touched the game: start counting from now, unless the summary is due (then it opens instead). */
  private touched(): void {
    if (this.open) return;
    if (this.due()) return this.show();
    this.restart();
  }

  private restart(): void {
    this.lastActive = performance.now();
    const tl = this.tally();
    this.base = tl ? copyTally(tl) : null;
    if (tl) this.fresh = false;
    this.autoSeen = this.g.autoPlay;
    this.stopMsg = null;
  }

  private due(): boolean {
    const cfg = currentBalance().auto;
    return cfg.summary && this.autoSeen && performance.now() - this.lastActive >= cfg.summaryMin * 60_000;
  }

  private tick(): void {
    const tl = this.tally();
    if (tl && (this.fresh || !this.base)) {
      // First numbers after the page loaded: count from here. A run with no base yet (Auto just switched on): from zero.
      this.base = this.fresh ? copyTally(tl) : emptyTally(tl.id);
      this.fresh = false;
    } else if (tl && this.base && tl.id !== this.base.id) this.base = emptyTally(tl.id);
    if (this.g.autoPlay) this.autoSeen = true;
    if (!this.open && this.due()) this.show();
    else if (this.open) this.render();
  }

  private show(): void {
    this.open = true;
    this.root.classList.remove('hidden');
    this.gridKey = '';
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
    this.g.hud.hideTip();
    if (this.rest) {
      this.rest = false;
      this.root.classList.remove('rest');
      this.g.restScreen = false;
    }
    this.restart();
  }

  /** One big number: icon, value, label, and an optional small line under it. */
  private stat(cls: string, icon: string, value: string, label: string, sub?: string): HTMLElement {
    const box = el('div', `auto-sum-stat ${cls}`);
    const ic = el('div', 'auto-sum-ic');
    ic.innerHTML = icon;
    const txt = el('div', 'auto-sum-txt');
    txt.append(el('b', '', value), el('span', '', label));
    if (sub) txt.append(el('small', '', sub));
    box.append(ic, txt);
    return box;
  }

  /** The short reason EXP did not all count (level cap / boss gate), or ''. */
  private expReason(d: AutoTally): string {
    if (!(d.expLost ?? 0) || !d.expWhy) return '';
    if (d.expWhy === 'max') return t('เลเวลสูงสุดแล้ว');
    return t('ต้องลงบอส {0} ก่อน EXP ถึงจะขึ้น', [d.expWhy.slice(5)]);
  }

  private render(): void {
    const tl = this.tally();
    const d = tl && this.base ? tallySince(tl, this.base) : emptyTally(0);
    this.since.textContent = `${this.rest ? t('พักหน้าจอ') : t('ระหว่างที่คุณไม่อยู่')} · ${clock(performance.now() - this.lastActive)}`;
    this.status.textContent = this.g.autoPlay ? t('Auto กำลังทำงาน') : t('Auto หยุดแล้ว{0}', [this.stopMsg ? ` — ${this.stopMsg}` : '']);
    this.status.classList.toggle('off', !this.g.autoPlay);

    const expSub = this.expReason(d) || (d.lv > 0 ? t('เลเวลอัพ +{0}', [d.lv]) : undefined);
    this.stats.replaceChildren(
      this.stat('exp', iconImg('exp'), `+${d.exp.toLocaleString()}`, t('EXP'), expSub),
      this.stat('gold', COIN_ICON, `+${d.gold.toLocaleString()}`, t('ทอง')),
      this.stat('kills', iconImg('map_fight'), d.kills.toLocaleString(), t('มอนที่ล่า')),
    );

    const total = d.items.reduce((a, b) => a + b, 0) + d.stones + d.potGot;
    this.itemsHead.textContent = t('ไอเทมที่ได้ · {0} ชิ้น', [total.toLocaleString()]);
    const entries = summaryEntries(d);
    const more = Math.max(0, (d.gearN ?? 0) - (d.gear?.length ?? 0));
    const key = `${d.id}|${d.gearN}|${JSON.stringify(d.got)}|${more}`;
    if (key !== this.gridKey) {
      this.gridKey = key;
      this.shown = entries;
      const cells = entries.map((e, i) => this.g.hud.itemCell(e, `data-i="${i}"`));
      if (more > 0) cells.push(`<div class="cell auto-sum-more" title="${t('อุปกรณ์อีก {0} ชิ้น', [more])}"><span>+${more}</span></div>`);
      this.grid.innerHTML = cells.length ? cells.join('') : `<div class="auto-sum-none">${t('ยังไม่ได้ไอเทม')}</div>`;
    }

    const foot: string[] = [t('ยาที่ใช้ {0} ขวด', [d.potUsed.toLocaleString()])];
    if (d.deaths > 0) foot.push(t('ตาย {0} ครั้ง', [d.deaths]));
    this.foot.textContent = foot.join(' · ');
  }
}
