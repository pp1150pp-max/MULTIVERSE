// The skill window (owner 2026-11-14, K or the ⚔ icon): one column per skill line with its own colour, skills in
// unlock order and ultimates in gold frames, the passives in a row under them, and the worn Q/E/R and passive slots
// with the points left on top. On a phone the three lines become tabs. Every click is a request: the server checks
// points, levels, gold and combat (Sim.learnSkill / refundSkill / wearSkill) and its snapshot redraws this.
import type { Game } from './Game';
import { KIND_NAME, SLOT_KIND, WEAR_SLOTS, type SkillDef, type WearSlot } from '../shared/data/classes';
import {
  learnBlock, maxRank, pointsEarned, pointsLeft, rankedCooldown, rankedDmg, rankedMp, rankOf, refundPrice, unlockLevel,
} from '../shared/skillBook';
import { SKILL_REACH, reachText } from '../shared/data/skillRanges';
import { skillIcon } from './icons';
import { makeDraggable } from './dragwindow';

const SLOT_LABEL: Record<WearSlot, string> = { q: 'Q', e: 'E', r: 'R', passive: 'พาสซีฟ' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class SkillWindow {
  private readonly win: HTMLElement;
  private readonly top: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly cols: HTMLElement;
  private readonly passives: HTMLElement;
  /** What the window shows, so it is redrawn only when something changed. */
  private drawn = '';
  /** The line shown on a narrow screen (tabs). */
  private tab = 0;
  /** Points shown on the icon badge (-1 = not set yet). */
  private badge = -1;

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'skills-win';
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.toggle(false);
    head.append(el('span', '', `สกิล — ${g.player.cls.nameTh}`), close);
    this.top = el('div', 'sk-top');
    this.tabs = el('div', 'sk-tabs');
    this.cols = el('div', 'sk-cols');
    this.passives = el('div', 'sk-passives');
    this.win.append(head, this.top, this.tabs, this.cols, this.passives, el('div', 'hint', 'คลิก + เรียนหรืออัปแรงก์ (1 แต้ม) · − คืนแต้ม · Q/E/R ใส่สกิลลงช่อง (ใส่หรือเปลี่ยนได้เมื่อไม่ได้ต่อสู้)'));
    this.win.addEventListener('click', (e) => this.onClick(e));
    this.win.addEventListener('mouseover', (e) => this.onHover(e));
    this.win.addEventListener('mouseleave', () => this.g.hud.hideTip());
    document.getElementById('hud')!.append(this.win);
    makeDraggable(this.win, head);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    this.win.classList.toggle('hidden', !show);
    if (show) {
      this.drawn = '';
      this.update();
    } else this.g.hud.hideTip();
  }

  /** Every frame: the icon badge shows unspent points; the open window redraws when the book, level or gold changed. */
  update(): void {
    const p = this.g.player;
    const left = pointsLeft(p.level, p.skillBook);
    if (left !== this.badge) {
      this.badge = left;
      this.g.sysMenu.setBadge('สกิล', left);
    }
    if (!this.open) return;
    const key = JSON.stringify([p.skillBook, p.level, p.gold, this.tab]);
    if (key === this.drawn) return;
    this.drawn = key;
    this.render();
  }

  private render(): void {
    const p = this.g.player;
    const book = p.skillBook;
    const left = pointsLeft(p.level, book);
    const price = refundPrice(p.level);
    // Worn slots and points.
    const slots = WEAR_SLOTS.map((s) => {
      const id = book.worn[s];
      const sk = id ? p.cls.skills.find((x) => x.id === id) : undefined;
      return `<div class="sk-slot${s === 'r' ? ' ult' : ''}" data-slot="${s}" ${sk ? `data-id="${sk.id}"` : ''} title="${sk ? 'คลิกเพื่อถอดออก' : `ช่อง${KIND_NAME[SLOT_KIND[s]]}`}">` +
        `<b>${SLOT_LABEL[s]}</b><span class="sk-ico">${sk ? skillIcon(sk.id) : ''}</span><span class="sk-sname">${sk ? sk.nameTh : 'ว่าง'}</span></div>`;
    }).join('');
    this.top.innerHTML =
      `<div class="sk-slots">${slots}</div>` +
      `<div class="sk-points"><span>แต้มคงเหลือ <b>${left}</b> / ${pointsEarned(p.level)}</span>` +
      `<span class="sk-refund">คืนแต้ม: ${price ? `${price.toLocaleString()} G/แต้ม` : 'ฟรี'}</span></div>`;
    // Line tabs (shown only on a narrow screen by CSS).
    this.tabs.innerHTML = p.cls.lines.map((l, i) =>
      `<button data-tab="${i}" class="${i === this.tab ? 'active' : ''}" style="--lc:${l.color}">${l.nameTh}</button>`).join('');
    // One column per line: its normal skills and ultimates in unlock order.
    this.cols.innerHTML = p.cls.lines.map((l, i) => {
      const list = p.cls.skills
        .filter((s) => (s.kind === 'normal' || s.kind === 'ult') && s.line === i)
        .sort((a, b) => unlockLevel(a) - unlockLevel(b) || (a.kind === 'ult' ? 1 : 0) - (b.kind === 'ult' ? 1 : 0));
      return `<div class="sk-col${i === this.tab ? ' active' : ''}" style="--lc:${l.color}"><div class="sk-col-head">${l.nameTh}</div>` +
        (list.length ? list.map((s) => this.row(s)).join('') : '<div class="sk-empty">ยังไม่มีสกิลในสายนี้</div>') + '</div>';
    }).join('');
    const passives = p.cls.skills.filter((s) => s.kind === 'passive').sort((a, b) => unlockLevel(a) - unlockLevel(b));
    this.passives.innerHTML = `<div class="sk-col-head">พาสซีฟ (ใส่ได้ 1 แบบ)</div>` +
      (passives.length ? `<div class="sk-prow">${passives.map((s) => this.row(s)).join('')}</div>` : '<div class="sk-empty">พาสซีฟของคลาสนี้จะมาในอัปเดตถัดไป</div>');
  }

  /** One skill: icon (gold frame for an ultimate), name, rank, unlock level and its buttons. */
  private row(sk: SkillDef): string {
    const p = this.g.player;
    const rank = rankOf(p.skillBook, sk.id);
    const need = unlockLevel(sk);
    const locked = p.level < need;
    const canLearn = !learnBlock(p.cls.id, p.level, p.skillBook, sk.id);
    const slots = WEAR_SLOTS.filter((s) => SLOT_KIND[s] === sk.kind);
    const wornOn = slots.find((s) => p.skillBook.worn[s] === sk.id);
    const wearBtns = rank
      ? slots.map((s) => `<button data-wear="${s}" data-id="${sk.id}" class="${wornOn === s ? 'on' : ''}">${s === 'passive' ? 'ใส่' : SLOT_LABEL[s]}</button>`).join('')
      : '';
    return `<div class="sk-row${sk.kind === 'ult' ? ' ult' : ''}${locked ? ' locked' : ''}${rank ? ' learned' : ''}" data-id="${sk.id}">` +
      `<span class="sk-ico">${skillIcon(sk.id)}</span>` +
      `<span class="sk-info"><span class="sk-name">${sk.nameTh}${sk.kind === 'ult' ? ' <i>อัลติ</i>' : ''}</span>` +
      `<span class="sk-rank">${locked ? `ปลด Lv.${need}` : `แรงก์ ${rank}/${maxRank()}`}</span></span>` +
      `<span class="sk-btns">${wearBtns}` +
      (rank ? `<button data-refund="${sk.id}" title="คืน 1 แต้ม">−</button>` : '') +
      `<button data-learn="${sk.id}" ${canLearn ? '' : 'disabled'} title="${rank ? 'อัปแรงก์ (1 แต้ม)' : 'เรียน (1 แต้ม)'}">+</button></span></div>`;
  }

  private onClick(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    const b = this.g.backend;
    const p = this.g.player;
    const tab = t.closest<HTMLElement>('[data-tab]');
    if (tab) {
      this.tab = Number(tab.dataset.tab);
      this.update();
      return;
    }
    const learn = t.closest<HTMLElement>('[data-learn]');
    if (learn) return b.learnSkill(learn.dataset.learn!);
    const refund = t.closest<HTMLElement>('[data-refund]');
    if (refund) {
      const id = refund.dataset.refund!;
      const price = refundPrice(p.level);
      const sk = p.cls.skills.find((s) => s.id === id);
      if (!price || !sk) return b.refundSkill(id);
      this.g.hud.confirm(`คืน 1 แต้มจาก<b>${sk.nameTh}</b> ราคา ${price.toLocaleString()} G?`, 'คืนแต้ม', () => b.refundSkill(id));
      return;
    }
    const wear = t.closest<HTMLElement>('[data-wear]');
    if (wear) {
      const slot = wear.dataset.wear as WearSlot;
      // Clicking the slot it already sits on takes it off.
      return b.wearSkill(slot, p.skillBook.worn[slot] === wear.dataset.id ? null : wear.dataset.id!);
    }
    const slot = t.closest<HTMLElement>('.sk-slot[data-id]');
    if (slot) b.wearSkill(slot.dataset.slot as WearSlot, null);
  }

  /** Tooltip: what the skill does now and at its next rank. */
  private onHover(e: MouseEvent): void {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.sk-row[data-id], .sk-slot[data-id]');
    const p = this.g.player;
    const sk = row ? p.cls.skills.find((s) => s.id === row.dataset.id) : undefined;
    if (!sk) return this.g.hud.hideTip();
    const rank = rankOf(p.skillBook, sk.id);
    const line = (r: number) => {
      const parts = [
        sk.kind !== 'passive' ? `ดาเมจ ${Math.round(rankedDmg(sk, r) * 100)}% ATK` : '',
        sk.mp ? `MP ${rankedMp(sk, p.cls.id, p.level, r)}` : '',
        sk.cooldown ? `คูลดาวน์ ${rankedCooldown(sk, r)} วิ` : '',
      ].filter(Boolean);
      return parts.join(' · ');
    };
    const reach = SKILL_REACH[sk.id];
    const tip = document.getElementById('tooltip')!;
    tip.innerHTML =
      `<div class="tt-name">${sk.name} (${sk.nameTh})</div>` +
      `<div class="tt-sub">${KIND_NAME[sk.kind as 'normal']}${sk.line !== undefined ? ` · ${p.cls.lines[sk.line].nameTh}` : ''} · ปลด Lv.${unlockLevel(sk)}</div>` +
      `<div class="tt-stats"><div>${sk.desc}</div>` +
      (reach ? `<div><span class="tt-val">${reachText(reach)}</span></div>` : '') +
      (rank ? `<div>ตอนนี้ (แรงก์ ${rank}): <span class="tt-val">${line(rank)}</span></div>` : '') +
      (rank < maxRank() ? `<div>แรงก์ ${rank + 1}: <span class="tt-val">${line(rank + 1)}</span></div>` : '') +
      `</div>`;
    tip.classList.remove('hidden');
    const x = Math.min(e.clientX + 16, window.innerWidth - tip.offsetWidth - 8);
    const y = Math.min(e.clientY + 16, window.innerHeight - tip.offsetHeight - 8);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }
}
