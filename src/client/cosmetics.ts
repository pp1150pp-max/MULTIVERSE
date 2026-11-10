// The cosmetics window ("แต่งตัว"), opened from the menu or at the stylist in town. Two tabs:
// - ร้าน: every cosmetic, with try-on (shown on your own character, only to you; taken off when the
//   window closes). Buying is not open yet (owner: no prices, a "เร็ว ๆ นี้" button).
// - ของฉัน: what the account owns (an admin gives them out), to wear or take off. The server checks it.
// Also the mount button (Z) shown while a mount is worn.
import type { Game } from './Game';
import { COSMETICS, COS_SLOTS, COS_SLOT_NAME, cosById, type CosmeticDef, type CosSlot, type CosWorn } from '../shared/data/cosmetics';
import { setLookOwner, setTryOn } from './cosLook';
import { cosCardImage } from './cosmeticViews';

type Tab = 'shop' | 'mine';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function button(label: string, onClick: () => void, cls = '', disabled = false): HTMLButtonElement {
  const b = el('button', cls, label);
  b.onclick = onClick;
  b.disabled = disabled;
  return b;
}

const picCache = new Map<string, string>();

/** The card picture (made once): the front view of the real sheet or its placeholder; a title set as text. */
function picture(c: CosmeticDef): HTMLElement {
  if (c.slot === 'title') {
    const box = el('div', 'cos-pic cos-pic-title');
    box.style.setProperty('--c1', c.color);
    box.style.setProperty('--c2', c.color2);
    box.append(el('div', 'cos-t', `《${c.title ?? ''}》`), el('div', 'cos-n', 'ชื่อตัวละคร'), el('div', 'cos-b', 'สวัสดี!'));
    return box;
  }
  let src = picCache.get(c.id);
  if (!src) {
    src = cosCardImage(c);
    picCache.set(c.id, src);
  }
  const img = el('img', 'cos-pic');
  img.src = src;
  img.alt = c.name;
  return img;
}

export class CosmeticsUI {
  private readonly win: HTMLElement;
  private readonly tabsEl: HTMLElement;
  private readonly slotsEl: HTMLElement;
  private readonly body: HTMLElement;
  private readonly mountBtn: HTMLButtonElement;
  private tab: Tab = 'shop';
  private slot: CosSlot = 'wings';
  private trying: CosWorn = {};
  private drawn = '';

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'cos-win';
    const head = el('div', 'panel-head');
    head.append(el('span', '', 'แต่งตัว'), button('✕', () => this.toggle(false)));
    this.tabsEl = el('div', 'ui-tabs');
    this.slotsEl = el('div', 'cos-slots');
    this.body = el('div', 'cos-body');
    this.win.append(head, this.tabsEl, this.slotsEl, this.body);
    document.getElementById('hud')!.append(this.win);

    this.mountBtn = button('', () => this.g.backend.toggleMount(), 'cos-mount-btn hidden');
    this.mountBtn.id = 'mount-btn';
    this.mountBtn.title = 'ขึ้น / ลงสัตว์ขี่ (Z)';
    document.getElementById('hud')!.append(this.mountBtn);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  /** `tab` picks the tab to open on (the stylist opens the shop). */
  toggle(force?: boolean, tab?: Tab): void {
    const show = force ?? !this.open;
    this.win.classList.toggle('hidden', !show);
    if (tab) this.tab = tab;
    if (!show) this.clearTry();
    this.drawn = '';
    this.update();
  }

  /** Every frame: the mount button, and a redraw when something the window shows changed. */
  update(): void {
    const me = this.g.player;
    setLookOwner(me);
    const mount = cosById(me.cosmetics.mount);
    this.mountBtn.classList.toggle('hidden', !mount || !me.alive);
    const label = me.mounted ? 'ลงจากสัตว์ขี่ (Z)' : 'ขี่ (Z)';
    if (this.mountBtn.textContent !== label) this.mountBtn.textContent = label;
    this.mountBtn.classList.toggle('on', me.mounted);
    if (!this.open) return;
    const key = JSON.stringify([this.tab, this.slot, this.trying, me.cosmetics, this.g.backend.cosOwned]);
    if (key === this.drawn) return;
    this.drawn = key;
    this.draw();
  }

  private clearTry(): void {
    this.trying = {};
    setTryOn(null);
  }

  private setTry(slot: CosSlot, id: string | null): void {
    if (id) this.trying[slot] = id;
    else delete this.trying[slot];
    setTryOn(this.trying);
  }

  private draw(): void {
    const owned = new Set(this.g.backend.cosOwned);
    const worn = this.g.player.cosmetics;
    const guest = this.g.backend.guest;

    this.tabsEl.replaceChildren(
      ...([['shop', 'ร้าน'], ['mine', `ของฉัน (${owned.size})`]] as [Tab, string][]).map(([t, label]) =>
        button(label, () => {
          this.tab = t;
          this.update();
        }, this.tab === t ? 'ui-tab active' : 'ui-tab'),
      ),
    );
    this.slotsEl.replaceChildren(
      ...COS_SLOTS.map((s) =>
        button(COS_SLOT_NAME[s], () => {
          this.slot = s;
          this.update();
        }, this.slot === s ? 'on' : ''),
      ),
    );

    const list = COSMETICS.filter((c) => c.slot === this.slot && (this.tab === 'shop' || owned.has(c.id)));
    const cards = list.map((c) => {
      const card = el('div', 'cos-card');
      if (worn[c.slot] === c.id) card.classList.add('worn');
      const info = el('div', 'cos-info');
      info.append(el('div', 'cos-name', c.name), el('div', 'cos-desc', c.desc));
      const tags = el('div', 'cos-tags');
      if (owned.has(c.id)) tags.append(el('span', 'tag on', 'มีแล้ว'));
      if (worn[c.slot] === c.id) tags.append(el('span', 'tag', 'สวมอยู่'));
      info.append(tags);
      const btns = el('div', 'cos-btns');
      if (this.tab === 'shop') {
        const tryingThis = this.trying[c.slot] === c.id;
        btns.append(
          button(tryingThis ? 'ถอดที่ลอง' : 'ลองสวม', () => {
            this.setTry(c.slot, tryingThis ? null : c.id);
            this.update();
          }, tryingThis ? 'on' : ''),
          button('เร็ว ๆ นี้', () => undefined, 'cos-buy', true),
        );
      } else if (worn[c.slot] === c.id) {
        btns.append(button('ถอด', () => this.g.backend.cosWear(c.slot, null)));
      } else {
        btns.append(button('สวม', () => this.g.backend.cosWear(c.slot, c.id), 'primary'));
      }
      card.append(picture(c), info, btns);
      return card;
    });

    const notes: HTMLElement[] = [];
    if (this.tab === 'shop') notes.push(el('div', 'cos-note', 'ยังไม่เปิดขาย ลองสวมได้ (เห็นแค่คุณ ปิดหน้าต่างแล้วจะถอดออก)'));
    else if (guest) notes.push(el('div', 'cos-note', 'Guest รับ Cosmetics ไม่ได้ สมัครสมาชิกเพื่อรับของ'));
    else if (!cards.length) notes.push(el('div', 'cos-note', `ยังไม่มี${COS_SLOT_NAME[this.slot]} ทุกตัวละครในบัญชีใช้ของที่ได้รับร่วมกัน`));
    if (this.slot === 'mount') notes.push(el('div', 'cos-note', 'สัตว์ขี่: เดินเร็วขึ้น 30% กด Z เพื่อขึ้น/ลง โจมตี ใช้สกิล หรือโดนตีจะลงเอง ขึ้นใหม่ได้หลังเลิกสู้ 3 วิ ขี่ในห้องบอสไม่ได้'));
    this.body.replaceChildren(...notes, el('div', 'cos-grid'));
    this.body.lastElementChild!.append(...cards);
  }
}
