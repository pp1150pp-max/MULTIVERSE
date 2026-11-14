// The skill window (owner 2026-11-14, K or the ⚔ icon) as one constellation: the class star in the middle with the
// passives around it, and the three skill lines as arms going out from it (each in its own colour). Along an arm the
// normal skills sit in unlock order, nearest first, and the two ultimates are big gold-ringed stars off its sides.
// A learned star turns gold with its rank, and the line leading to it lights up; a locked one is dashed with the level
// it opens at. Lines only show the order: reaching the level is enough to learn a skill (owner 2026-11-14).
// Clicking a star shows it in the details box with its buttons. Every click is a request: the server checks points,
// levels, gold and combat (Sim.learnSkill / refundSkill / wearSkill) and its snapshot redraws this.
// The sky is `ui/skill_sky.png` (the owner makes it, see art_templates/skills/PROMPTS.md) over a CSS star field.
import type { Game } from './Game';
import { KIND_NAME, SLOT_KIND, WEAR_SLOTS, type SkillDef, type WearSlot } from '../shared/data/classes';
import {
  learnBlock, maxRank, pointsEarned, pointsLeft, rankedCooldown, rankedDmg, rankedMp, rankOf, refundPrice, skillParamLines, skillReach, unlockLevel,
} from '../shared/skillBook';
import { reachText } from '../shared/data/skillRanges';
import { skillIcon } from './icons';
import { constellation, PAD } from './skillMap';

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
  private readonly wrap: HTMLElement;
  private readonly detail: HTMLElement;
  /** What the window shows, so it is redrawn only when something changed. */
  private drawn = '';
  /** The skill in the details box. */
  private sel = '';
  /** Points shown on the icon badge (-1 = not set yet). */
  private badge = -1;
  /** Scroll the map to its centre on the next draw (each time the window opens). */
  private centre = true;

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'skills-win';
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.toggle(false);
    head.append(el('span', '', `สกิล — ${g.player.cls.nameTh}`), close);
    this.top = el('div', 'sk-top');
    this.wrap = el('div', 'sk-mapwrap');
    this.detail = el('div', 'sk-detail');
    const body = el('div', 'sk-body');
    body.append(this.wrap, this.detail);
    this.win.append(head, this.top, body,
      el('div', 'hint', 'คลิกดาวเพื่อดูรายละเอียด · ถึงเลเวลแล้วเรียนได้เลย (1 แต้มต่อแรงก์) · ใส่หรือเปลี่ยนสกิลได้เมื่อไม่ได้ต่อสู้'));
    this.win.addEventListener('click', (e) => this.onClick(e));
    // The window is made draggable with the others (initDraggableWindows in Game, built right after this).
    document.getElementById('hud')!.append(this.win);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    this.win.classList.toggle('hidden', !show);
    if (show) {
      this.drawn = '';
      this.centre = true;
      this.update();
    }
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
    const key = JSON.stringify([p.skillBook, p.level, p.gold, this.sel]);
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
      return `<div class="sk-slot${s === 'r' ? ' ult' : ''}${s === 'passive' ? ' pas' : ''}" data-slot="${s}" ${sk ? `data-id="${sk.id}"` : ''} title="${sk ? 'คลิกเพื่อถอดออก' : `ช่อง${KIND_NAME[SLOT_KIND[s]]}`}">` +
        `<b>${SLOT_LABEL[s]}</b><span class="sk-ico">${sk ? skillIcon(sk.id) : ''}</span><span class="sk-sname">${sk ? sk.nameTh : 'ว่าง'}</span></div>`;
    }).join('');
    this.top.innerHTML =
      `<div class="sk-slots">${slots}</div>` +
      `<div class="sk-points"><span>แต้มคงเหลือ <b>${left}</b> / ${pointsEarned(p.level)}</span>` +
      `<span class="sk-refund">คืนแต้ม: ${price ? `${price.toLocaleString()} G/แต้ม` : 'ฟรี'}</span></div>`;
    this.renderMap();
    this.renderDetail();
  }

  /** The constellation: lines (gold up to learned stars, dashed to locked ones), the centre star, labels and stars. */
  private renderMap(): void {
    const p = this.g.player;
    const { stars, labels } = constellation(p.cls.skills);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of [...stars, ...labels, { x: 0, y: 0, size: 0 }]) {
      const h = ('size' in s ? s.size : 60) / 2;
      x0 = Math.min(x0, s.x - h); y0 = Math.min(y0, s.y - h);
      x1 = Math.max(x1, s.x + h); y1 = Math.max(y1, s.y + h);
    }
    const ox = PAD - x0, oy = PAD - y0;
    const w = Math.ceil(x1 - x0 + PAD * 2), h = Math.ceil(y1 - y0 + PAD * 2);
    const X = (v: number) => (v + ox).toFixed(1), Y = (v: number) => (v + oy).toFixed(1);
    const color = (sk: SkillDef) => (sk.line !== undefined ? p.cls.lines[sk.line].color : '#e8d9a8');

    const lines = stars.map((s) => {
      const learned = rankOf(p.skillBook, s.sk.id) > 0;
      const locked = p.level < unlockLevel(s.sk);
      return `<line x1="${X(s.from.x)}" y1="${Y(s.from.y)}" x2="${X(s.x)}" y2="${Y(s.y)}" class="${learned ? 'lit' : ''}${locked ? ' dash' : ''}" style="--lc:${color(s.sk)}"/>`;
    }).join('');
    // The class star: long and short rays.
    const rays = Array.from({ length: 16 }, (_, i) => {
      const a = (i * Math.PI) / 8, r = i % 2 ? 16 : 30;
      return `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(Math.cos(a) * r)}" y2="${Y(Math.sin(a) * r)}"/>`;
    }).join('');
    const svg = `<svg class="sk-lines" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${lines}` +
      `<g class="sk-core">${rays}<circle cx="${X(0)}" cy="${Y(0)}" r="6"/></g></svg>`;

    const names = p.cls.lines.map((l, i) =>
      `<div class="sk-lname" style="left:${X(labels[i].x)}px;top:${Y(labels[i].y)}px;--lc:${l.color}">${l.nameTh}</div>`).join('');

    const nodes = stars.map((s) => {
      const sk = s.sk;
      const rank = rankOf(p.skillBook, sk.id);
      const need = unlockLevel(sk);
      const locked = p.level < need;
      const can = !learnBlock(p.cls.id, p.level, p.skillBook, sk.id);
      const worn = WEAR_SLOTS.find((w2) => p.skillBook.worn[w2] === sk.id);
      const cls = `sk-node ${sk.kind}${rank ? ' learned' : ''}${locked ? ' locked' : ''}${can ? ' can' : ''}${sk.id === this.sel ? ' sel' : ''}`;
      return `<button class="${cls}" data-id="${sk.id}" title="${sk.nameTh}" style="left:${X(s.x)}px;top:${Y(s.y)}px;--sz:${s.size}px;--lc:${color(sk)}">` +
        `<span class="sk-ico">${skillIcon(sk.id)}</span>` +
        (rank ? `<span class="sk-nr">${rank}</span>` : '') +
        (locked ? `<span class="sk-nlv">Lv${need}</span>` : '') +
        (worn ? `<span class="sk-nw">${worn === 'passive' ? 'P' : SLOT_LABEL[worn]}</span>` : '') +
        '</button>';
    }).join('');

    const sl = this.wrap.scrollLeft, st = this.wrap.scrollTop;
    this.wrap.innerHTML = `<div class="sk-map" style="width:${w}px;height:${h}px">${svg}${names}${nodes}</div>`;
    // Shrink the whole map to fit the window (a desktop sees it all), but not below 70% (a phone scrolls instead).
    const maxH = parseFloat(getComputedStyle(this.wrap).maxHeight) || h;
    const z = Math.max(0.7, Math.min(1, this.wrap.clientWidth / w, maxH / h));
    (this.wrap.firstElementChild as HTMLElement).style.zoom = String(z);
    if (this.centre) {
      this.centre = false;
      this.wrap.scrollLeft = ox * z - this.wrap.clientWidth / 2;
      this.wrap.scrollTop = oy * z - this.wrap.clientHeight / 2;
    } else {
      this.wrap.scrollLeft = sl;
      this.wrap.scrollTop = st;
    }
  }

  /** The details box: the chosen skill now and at its next rank, and its buttons. */
  private renderDetail(): void {
    const p = this.g.player;
    const sk = p.cls.skills.find((s) => s.id === this.sel);
    if (!sk) {
      this.detail.innerHTML = '<div class="sk-empty">คลิกดาวเพื่อดูรายละเอียดของสกิล</div>';
      return;
    }
    const rank = rankOf(p.skillBook, sk.id);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const at = (r: number): string => [
      sk.kind !== 'passive' ? `ดาเมจ ${Math.round(rankedDmg(sk, r) * 100)}% ATK` : '',
      sk.mp ? `MP ${rankedMp(sk, p.cls.id, p.level, r)}` : '',
      sk.cooldown ? `คูลดาวน์ ${r2(rankedCooldown(sk, r))} วิ` : '',
      ...skillParamLines(sk, r),
    ].filter(Boolean).join(' · ');
    const reach = skillReach(sk);
    const line = sk.line !== undefined ? ` · <span style="color:${p.cls.lines[sk.line].color}">${p.cls.lines[sk.line].nameTh}</span>` : '';
    const block = learnBlock(p.cls.id, p.level, p.skillBook, sk.id);
    const slots = WEAR_SLOTS.filter((s) => SLOT_KIND[s] === sk.kind);
    const wornOn = slots.find((s) => p.skillBook.worn[s] === sk.id);
    const btns =
      `<button data-learn="${sk.id}" ${block ? 'disabled' : ''}>${rank ? '+ อัปแรงก์' : '+ เรียน'} (1 แต้ม)</button>` +
      (rank ? `<button data-refund="${sk.id}">− คืนแต้ม</button>` : '') +
      (rank ? slots.map((s) => `<button data-wear="${s}" data-id="${sk.id}" class="${wornOn === s ? 'on' : ''}">${wornOn === s ? 'ถอดจาก' : 'ใส่'}${s === 'passive' ? 'ช่องพาสซีฟ' : `ช่อง ${SLOT_LABEL[s]}`}</button>`).join('') : '');
    this.detail.innerHTML =
      `<div class="sk-dhead"><span class="sk-ico${sk.kind === 'ult' ? ' ult' : ''}">${skillIcon(sk.id)}</span><span><b>${sk.nameTh}</b> (${sk.name})<br>` +
      `<span class="sk-dsub">${KIND_NAME[sk.kind as 'normal']}${line} · ปลด Lv.${unlockLevel(sk)}${reach ? ` · ${reachText(reach)}` : ''}</span></span></div>` +
      `<div class="sk-desc">${sk.desc}</div>` +
      `<div class="sk-dval">แรงก์ <b>${rank}</b> / ${maxRank()}</div>` +
      (rank ? `<div class="sk-dval">ตอนนี้: <span class="tt-val">${at(rank)}</span></div>` : '') +
      (rank < maxRank() ? `<div class="sk-dval">${rank ? `แรงก์ ${rank + 1}` : 'เมื่อเรียน (แรงก์ 1)'}: <span class="tt-val">${at(rank + 1)}</span></div>` : '') +
      `<div class="sk-dbtns">${btns}</div>` +
      (block && rank < maxRank() ? `<div class="sk-dwhy">${block}</div>` : '');
  }

  private onClick(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    const b = this.g.backend;
    const p = this.g.player;
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
      // Pressing it for the slot it already sits on takes it off.
      return b.wearSkill(slot, p.skillBook.worn[slot] === wear.dataset.id ? null : wear.dataset.id!);
    }
    const slot = t.closest<HTMLElement>('.sk-slot[data-id]');
    if (slot) return b.wearSkill(slot.dataset.slot as WearSlot, null);
    const node = t.closest<HTMLElement>('.sk-node[data-id]');
    if (node) {
      this.sel = node.dataset.id!;
      this.update();
      // On a narrow screen the details sit under the map: bring them into view.
      if (getComputedStyle(this.detail.parentElement!).gridTemplateColumns.split(' ').length === 1) this.detail.scrollIntoView({ block: 'nearest' });
    }
  }
}
