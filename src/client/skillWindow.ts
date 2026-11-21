// The skill window (owner 2026-11-14, K or the ⚔ icon) as one constellation: the class star in the middle with the
// passives around it, and the three skill lines as arms going out from it (each in its own colour). Along an arm the
// normal skills sit in unlock order, nearest first, and the two ultimates are big gold-ringed stars off its sides.
// A learned star turns gold with its rank, and the line leading to it lights up; a locked one is dashed with the level
// it opens at. Lines only show the order: reaching the level is enough to learn a skill (owner 2026-11-14).
// Clicking a star shows it in the details box with its buttons. Every click is a request: the server checks points,
// levels, gold and combat (Sim.learnSkill / refundSkill / resetSkills / wearSkill) and its snapshot redraws this.
// The sky is `ui/skill_sky.png` (the owner makes it, see art_templates/skills/PROMPTS.md) over a CSS star field.
import type { Game } from './Game';
import { KIND_NAME, SLOT_KIND, WEAR_SLOTS, type SkillDef, type WearSlot } from '../shared/data/classes';
import {
  learnBlock, maxRank, pointsEarned, pointsLeft, pointsSpent, rankedCooldown, rankedDmg, rankedMp, rankOf, refundPrice, skillParamLines, skillReach, unlockLevel,
} from '../shared/skillBook';
import { reachText } from '../shared/data/skillRanges';
import { currentBalance } from '../shared/balance';
import { chargeMax } from '../shared/skillTuning';
import { skillIcon } from './icons';
import { constellation, PAD, SIZE } from './skillMap';

/** Refund clicks this soon after a + click are ignored (rapid clicking that runs past rank 10). */
const REFUND_AFTER_LEARN_MS = 700;
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
  /** "Reset all skills" over the map's corner (owner 2026-11-15). */
  private readonly reset: HTMLButtonElement;
  private readonly detail: HTMLElement;
  /** What the window shows, so it is redrawn only when something changed. */
  private drawn = '';
  /** The skill in the details box. */
  private sel = '';
  /** Points shown on the icon badge (-1 = not set yet). */
  private badge = -1;
  /** Scroll the map to its centre on the next draw (each time the window opens). */
  private centre = true;
  /** The player's zoom on top of the fit-to-window size (1 = as it opens), the fit size, and the map's size in px. */
  private uz = 1;
  private fit = 1;
  private mapW = 1;
  private mapH = 1;
  private readonly zoomBox: HTMLElement;
  /** Pointers down on the map (pan with one, pinch with two) and whether the press became a drag (then its click is dropped). */
  private readonly ptrs = new Map<number, { x: number; y: number }>();
  private moved = false;
  private startPt = { x: 0, y: 0 };

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
    this.reset = el('button', 'sk-reset', '↺ รีเซ็ตสกิลทั้งหมด');
    this.reset.dataset.reset = '1';
    const mapBox = el('div', 'sk-mapbox');
    this.zoomBox = el('div', 'sk-zoom');
    const zbtns: [string, string, () => void][] = [['+', 'ซูมเข้า', () => this.zoomBy(1.25)], ['−', 'ซูมออก', () => this.zoomBy(0.8)], ['⤾', 'ขนาดเริ่มต้น', () => this.zoomReset()]];
    for (const [t, tip, f] of zbtns) {
      const b = el('button', '', t);
      b.title = tip;
      b.onclick = f;
      this.zoomBox.append(b);
    }
    mapBox.append(this.wrap, this.zoomBox, this.reset);
    this.initZoom();
    body.append(mapBox, this.detail);
    this.win.append(head, this.top, body,
      el('div', 'hint', 'คลิกดาวเพื่อดูรายละเอียด · ถึงเลเวลแล้วเรียนได้เลย (1 แต้มต่อแรงก์) · ใส่หรือเปลี่ยนสกิลได้เมื่อไม่ได้ต่อสู้'));
    this.win.addEventListener('click', (e) => this.onClick(e));
    // A new screen size (a phone turned, a window resized) fits and centres the map again.
    window.addEventListener('resize', () => {
      this.drawn = '';
      this.centre = true;
      this.uz = 1;
    });
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
      this.uz = 1;
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
    this.reset.disabled = pointsSpent(book) === 0;
    this.renderMap();
    this.renderDetail();
  }

  /** The constellation: lines (gold up to learned stars, dashed to locked ones), the centre star, labels and stars. */
  private renderMap(): void {
    const p = this.g.player;
    const { stars, labels, outline, spots } = constellation(p.cls.skills);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of [...stars, ...labels, ...spots.map((q) => ({ ...q, size: SIZE.ult })), { x: 0, y: 0, size: 0 }]) {
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
    const ghost = outline.map((s) => `<line class="ghost" x1="${X(s.from.x)}" y1="${Y(s.from.y)}" x2="${X(s.to.x)}" y2="${Y(s.to.y)}" style="--lc:${p.cls.lines[s.line].color}"/>`).join('') +
      spots.map((s) => `<circle class="spot" cx="${X(s.x)}" cy="${Y(s.y)}" r="3"/>`).join('');
    const svg = `<svg class="sk-lines" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${ghost}${lines}` +
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
    const zoomOn = currentBalance().skills.mapZoom;
    this.wrap.classList.toggle('zoomable', zoomOn);
    this.zoomBox.classList.toggle('hidden', !zoomOn);
    if (!zoomOn) this.uz = 1;
    this.mapW = w;
    this.mapH = h;
    // Shrink the whole map to fit the window (a desktop sees it all), but not below 70% (a phone scrolls instead).
    const maxH = parseFloat(getComputedStyle(this.wrap).maxHeight) || h;
    this.fit = Math.max(0.7, Math.min(1, this.wrap.clientWidth / w, maxH / h));
    // The frame keeps the size of the fit-to-window map: zooming only changes what is inside it, never the window.
    this.wrap.style.height = `${Math.round(Math.min(maxH, h * this.fit))}px`;
    const z = this.zoom();
    this.wrap.innerHTML = `<div class="sk-sizer" style="width:${w * z}px;height:${h * z}px"><div class="sk-map" style="width:${w}px;height:${h}px;transform:scale(${z})">${svg}${names}${nodes}</div></div>`;
    if (this.centre) {
      this.centre = false;
      this.wrap.scrollLeft = ox * z - this.wrap.clientWidth / 2;
      this.wrap.scrollTop = oy * z - this.wrap.clientHeight / 2;
    } else {
      this.wrap.scrollLeft = sl;
      this.wrap.scrollTop = st;
    }
  }

  /** The scale the map is drawn at: the fit size times the player's zoom, kept inside the /admin limits. */
  private zoom(): number {
    const cfg = currentBalance().skills;
    return this.fit * Math.min(cfg.zoomMax / 100, Math.max(cfg.zoomMin / 100, this.uz));
  }

  /** Zooms to `uz` keeping the map point under the screen position (cx, cy) where it is (the wrap's centre when not given). */
  private setZoom(uz: number, cx?: number, cy?: number): void {
    const cfg = currentBalance().skills;
    if (!cfg.mapZoom) return;
    const sizer = this.wrap.firstElementChild as HTMLElement | null;
    if (!sizer) return;
    const wr = this.wrap.getBoundingClientRect();
    const ax = cx ?? wr.left + wr.width / 2, ay = cy ?? wr.top + wr.height / 2;
    const r0 = sizer.getBoundingClientRect();
    const z0 = this.zoom();
    const mx = (ax - r0.left) / z0, my = (ay - r0.top) / z0;
    this.uz = Math.min(cfg.zoomMax / 100, Math.max(cfg.zoomMin / 100, uz));
    const z = this.zoom();
    sizer.style.width = `${this.mapW * z}px`;
    sizer.style.height = `${this.mapH * z}px`;
    (sizer.firstElementChild as HTMLElement).style.transform = `scale(${z})`;
    const r1 = sizer.getBoundingClientRect();
    this.wrap.scrollLeft += r1.left + mx * z - ax;
    this.wrap.scrollTop += r1.top + my * z - ay;
  }

  private zoomBy(f: number, cx?: number, cy?: number): void {
    this.setZoom(this.uz * f, cx, cy);
  }

  private zoomReset(): void {
    this.uz = 1;
    this.centre = true;
    this.drawn = '';
    this.update();
  }

  /** Mouse wheel zooms at the pointer, a drag pans, two fingers pinch. A press that moved is not a click on a star. */
  private initZoom(): void {
    const w = this.wrap;
    const on = () => currentBalance().skills.mapZoom;
    w.addEventListener('wheel', (e) => {
      if (!on()) return;
      e.preventDefault();
      this.zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    }, { passive: false });
    const pair = () => {
      const [a, b] = [...this.ptrs.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    let pinch = { d: 1, x: 0, y: 0 };
    w.addEventListener('pointerdown', (e) => {
      if (!on() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.ptrs.size === 1) {
        this.moved = false;
        this.startPt = { x: e.clientX, y: e.clientY };
      } else if (this.ptrs.size === 2) {
        this.moved = true;
        pinch = pair();
      }
    });
    w.addEventListener('pointermove', (e) => {
      const q = this.ptrs.get(e.pointerId);
      if (!q) return;
      const dx = e.clientX - q.x, dy = e.clientY - q.y;
      q.x = e.clientX;
      q.y = e.clientY;
      if (this.ptrs.size === 2) {
        const n = pair();
        this.zoomBy(n.d / pinch.d, n.x, n.y);
        w.scrollLeft -= n.x - pinch.x;
        w.scrollTop -= n.y - pinch.y;
        pinch = n;
        return;
      }
      if (!this.moved && Math.hypot(e.clientX - this.startPt.x, e.clientY - this.startPt.y) < 6) return;
      if (!this.moved) {
        try { w.setPointerCapture(e.pointerId); } catch { /* the pointer is gone: panning still works */ }
      }
      this.moved = true;
      w.classList.add('panning');
      w.scrollLeft -= dx;
      w.scrollTop -= dy;
    });
    const up = (e: PointerEvent) => {
      this.ptrs.delete(e.pointerId);
      if (!this.ptrs.size) w.classList.remove('panning');
    };
    w.addEventListener('pointerup', up);
    w.addEventListener('pointercancel', up);
    // A drag ends with a click on whatever is under the finger: drop it (capture, before the window's own handler).
    w.addEventListener('click', (e) => {
      if (!this.moved) return;
      this.moved = false;
      e.stopPropagation();
      e.preventDefault();
    }, true);
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
    // The "ลดคูลดาวน์สกิล %" item stat, as Player.skillCooldown uses it.
    const cut = Math.min(Math.max(0, p.stats.cdr ?? 0), currentBalance().cdrCap) / 100;
    const at = (r: number): string => [
      sk.kind !== 'passive' && sk.dmg > 0 ? `ดาเมจ ${Math.round(rankedDmg(sk, r) * 100)}% ATK` : '',
      sk.mp ? `MP ${rankedMp(sk, p.cls.id, p.level, r)}` : '',
      sk.cooldown ? `คูลดาวน์ ${r2(rankedCooldown(sk, r))} วิ${cut > 0 && sk.kind !== 'basic' && sk.kind !== 'dash' ? ` (ของที่ใส่ลดเหลือ ${r2(rankedCooldown(sk, r) * (1 - cut))} วิ)` : ''}` : '',
      chargeMax(currentBalance().skills, sk.id, r) ? `เก็บได้ ${chargeMax(currentBalance().skills, sk.id, r)} อัน (คืนทีละอัน)` : '',
      ...skillParamLines(sk, r),
    ].filter(Boolean).join(' · ');
    const reach = skillReach(sk);
    const line = sk.line !== undefined ? ` · <span style="color:${p.cls.lines[sk.line].color}">${p.cls.lines[sk.line].nameTh}</span>` : '';
    const block = learnBlock(p.cls.id, p.level, p.skillBook, sk.id);
    const slots = WEAR_SLOTS.filter((s) => SLOT_KIND[s] === sk.kind);
    const wornOn = slots.find((s) => p.skillBook.worn[s] === sk.id);
    // Row 1 never moves or changes size (owner 2026-11-20: clicking + fast past rank 10 hit − คืนแต้ม): both buttons are always
    // there, disabled when they can't be used, and the row sits above the values that grow or shrink with the rank.
    const full = rank >= maxRank();
    const main =
      `<button data-learn="${sk.id}" ${block || full ? 'disabled' : ''}>${full ? 'แรงก์สูงสุดแล้ว' : `${rank ? '+ อัปแรงก์' : '+ เรียน'} (1 แต้ม)`}</button>` +
      `<button data-refund="${sk.id}" ${rank ? '' : 'disabled'}>− คืนแต้ม</button>`;
    const btns =
      (rank > 1 ? `<button data-refund-all="${sk.id}">คืนแต้มสกิลนี้ทั้งหมด (${p.skillBook.ranks[sk.id]} แต้ม)</button>` : '') +
      (rank ? slots.map((s) => `<button data-wear="${s}" data-id="${sk.id}" class="${wornOn === s ? 'on' : ''}">${wornOn === s ? 'ถอดจาก' : 'ใส่'}${s === 'passive' ? 'ช่องพาสซีฟ' : `ช่อง ${SLOT_LABEL[s]}`}</button>`).join('') : '');
    this.detail.innerHTML =
      `<div class="sk-dhead"><span class="sk-ico${sk.kind === 'ult' ? ' ult' : ''}">${skillIcon(sk.id)}</span><span><b>${sk.nameTh}</b> (${sk.name})<br>` +
      `<span class="sk-dsub">${KIND_NAME[sk.kind as 'normal']}${line} · ปลด Lv.${unlockLevel(sk)}${reach ? ` · ${reachText(reach)}` : ''}</span></span></div>` +
      `<div class="sk-desc">${sk.desc}</div>` +
      `<div class="sk-dval">แรงก์ <b>${rank}</b> / ${maxRank()}</div>` +
      `<div class="sk-dbtns sk-dmain">${main}</div>` +
      (block && !full ? `<div class="sk-dwhy">${block}</div>` : '') +
      (rank ? `<div class="sk-dval">ตอนนี้: <span class="tt-val">${at(rank)}</span></div>` : '') +
      (rank < maxRank() ? `<div class="sk-dval">${rank ? `แรงก์ ${rank + 1}` : 'เมื่อเรียน (แรงก์ 1)'}: <span class="tt-val">${at(rank + 1)}</span></div>` : '') +
      (btns ? `<div class="sk-dbtns">${btns}</div>` : '');
  }

  /** " ราคา 3,000 G" for taking back n points now, or " (ฟรี)". */
  private costText(n: number): string {
    const price = refundPrice(this.g.player.level) * n;
    return price ? ` ราคา ${price.toLocaleString()} G` : ' (ฟรี)';
  }

  /** performance.now() of the last + เรียน / อัปแรงก์ click. */
  private learnAt = -Infinity;

  private onClick(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    const b = this.g.backend;
    const p = this.g.player;
    const learn = t.closest<HTMLElement>('[data-learn]');
    if (learn) {
      this.learnAt = performance.now();
      return b.learnSkill(learn.dataset.learn!);
    }
    // Fast clicks on + right before: not a refund (a stray click must never take a point back).
    if (performance.now() - this.learnAt < REFUND_AFTER_LEARN_MS && t.closest('[data-refund], [data-refund-all], [data-reset]')) return;
    // Every point of one skill, or of all skills: always asked first, with the gold it costs (owner 2026-11-15).
    const refundAll = t.closest<HTMLElement>('[data-refund-all]');
    if (refundAll) {
      const id = refundAll.dataset.refundAll!;
      const sk = p.cls.skills.find((s) => s.id === id);
      const n = p.skillBook.ranks[id] ?? 0;
      if (!sk || !n) return;
      this.g.hud.confirm(`คืนแต้มทั้งหมด ${n} แต้มจาก<b>${sk.nameTh}</b>${this.costText(n)}<br>สกิลนี้จะถูกลืมและถอดออกจากช่อง`, 'คืนทั้งหมด', () => b.refundSkill(id, true));
      return;
    }
    if (t.closest('[data-reset]')) {
      const n = pointsSpent(p.skillBook);
      if (!n) return;
      this.g.hud.confirm(`รีเซ็ตสกิลทั้งหมด ได้คืน ${n} แต้ม${this.costText(n)}<br>ทุกสกิลจะถูกลืมและถอดออกจากช่อง`, 'รีเซ็ต', () => b.resetSkills());
      return;
    }
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
