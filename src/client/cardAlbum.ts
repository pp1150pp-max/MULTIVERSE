// The card album window (rules: src/shared/cardAlbum.ts, plan section 14): one tab per farm map, its cards in colour
// once registered (grey until then). A card in the bag can be registered (it is used up); a page's two bonus steps
// show under it. Opened from the top-row "อัลบั้ม" button. The server checks everything.
import type { Game } from './Game';
import { ALBUM_PAGES, albumBonus, albumOn, albumStep, albumStepBonus, type AlbumPage } from '../shared/cardAlbum';
import { ALBUM_PAGE_NAME, ALBUM_STATS, ALBUM_STAT_NAME, CARD_RARITY_NAME, cardArt, cardName, type AlbumStat, type CardId } from '../shared/data/cards';
import { cardDef } from '../shared/cardTuning';
import { STONE_COLOR } from '../shared/data/stones';
import { openCardView } from './ui/cardPopup';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** "HP สูงสุด % +2, พลังโจมตี % +2" (nothing = "-"). */
function bonusText(b: Record<AlbumStat, number>): string {
  const parts = ALBUM_STATS.filter((s) => b[s]).map((s) => `${ALBUM_STAT_NAME[s].replace(' %', '')} +${+b[s].toFixed(1)}%`);
  return parts.length ? parts.join(', ') : '-';
}

export class AlbumUI {
  private readonly win: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly body: HTMLElement;
  private readonly total: HTMLElement;
  private page = 0;
  /** What the window shows now (album + cards in the bag): redrawn only when it changes. */
  private shown = '';
  private timer = 0;

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'album-win';
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.toggle(false);
    head.append(el('span', '', 'อัลบั้มการ์ด'), close);
    this.tabs = el('div', 'album-tabs');
    this.body = el('div', 'album-body');
    this.total = el('div', 'album-total');
    this.win.append(head, this.tabs, this.body, this.total);
    this.tabs.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-page]');
      if (!t) return;
      this.page = Number(t.dataset.page);
      this.render(true);
    });
    this.body.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const reg = target.closest<HTMLElement>('[data-reg]');
      if (reg) return this.g.backend.albumRegister(reg.dataset.reg as CardId);
      const card = target.closest<HTMLElement>('[data-card]');
      if (card) openCardView(card.dataset.card as CardId);
    });
    document.getElementById('hud')!.append(this.win);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    if (!show) {
      this.win.classList.add('hidden');
      clearInterval(this.timer);
      return;
    }
    if (this.g.backend.guest) return this.g.hud.log('Guest ใช้อัลบั้มการ์ดไม่ได้ — สมัครสมาชิกก่อน', '#ff8a6a');
    this.win.classList.remove('hidden');
    this.render(true);
    // Registering, a card picked up or the album of another character: redraw when what is shown changes.
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.render(), 400);
  }

  private count(id: CardId): number {
    return this.g.backend.me.stoneCount(id);
  }

  private render(force = false): void {
    if (!this.open) return;
    const me = this.g.backend.me;
    const album = me.album;
    const p = ALBUM_PAGES[this.page];
    const key = `${this.page}|${album.join(',')}|${[...p.normal, ...p.boss].map((c) => this.count(c)).join(',')}|${albumOn()}`;
    if (!force && key === this.shown) return;
    this.shown = key;
    const has = new Set(album);
    this.tabs.innerHTML = ALBUM_PAGES.map((pg, i) => {
      const step = albumStep(pg, has);
      const mark = step === 2 ? ' ★★' : step === 1 ? ' ★' : '';
      return `<button class="album-tab${i === this.page ? ' on' : ''}" data-page="${i}">${ALBUM_PAGE_NAME[pg.key]}${mark}</button>`;
    }).join('');
    this.body.innerHTML = '';
    if (!albumOn()) this.body.append(el('div', 'album-note', 'อัลบั้มการ์ดปิดอยู่ตอนนี้ (โบนัสยังไม่มีผล)'));
    this.body.append(this.section(p, 'normal', has), this.section(p, 'boss', has));
    this.total.textContent = `โบนัสอัลบั้มรวม (ทุกตัวละครในบัญชี): ${bonusText(albumBonus(album))}`;
  }

  private section(p: AlbumPage, part: 'normal' | 'boss', has: Set<CardId>): HTMLElement {
    const cards = p[part];
    const got = cards.filter((c) => has.has(c)).length;
    const step = part === 'normal' ? 1 : 2;
    const reached = albumStep(p, has) >= step;
    const box = el('div', 'album-sec');
    const title = part === 'normal' ? 'การ์ดมอนทั่วไป' : 'การ์ดบอส';
    box.append(el('div', 'album-sec-head', `${title} ${got}/${cards.length}`));
    const grid = el('div', 'album-grid');
    grid.innerHTML = cards.map((id) => {
      const d = cardDef(id);
      const n = this.count(id);
      const on = has.has(id);
      const btn = !on && n > 0 && albumOn() ? `<button class="primary album-reg" data-reg="${id}">ลงทะเบียน</button>` : '';
      const state = on ? '<span class="album-ok">✓ ลงแล้ว</span>' : n > 0 ? `<span class="album-have">มี ×${n}</span>` : '<span class="album-none">ยังไม่มี</span>';
      return `<div class="album-card${on ? ' on' : ''}" style="--card-c:${STONE_COLOR[id]}">` +
        `<img src="${cardArt(id)}" alt="" draggable="false" data-card="${id}" title="${cardName(id)} (${d ? CARD_RARITY_NAME[d.rarity] : ''}) — คลิกเพื่อดูการ์ด">` +
        `<div class="album-name">${cardName(id).replace(/^การ์ด/, '')}</div>${state}${btn}</div>`;
    }).join('');
    const bonus = el('div', `album-bonus${reached ? ' on' : ''}`,
      `${reached ? '✓' : '○'} ขั้น ${step} (${part === 'normal' ? 'ครบการ์ดมอนทั่วไป' : 'ครบทุกใบรวมบอส'}): ${bonusText(albumStepBonus(p.key, step))}`);
    box.append(grid, bonus);
    return box;
  }
}
