// The cosmetics window ("แต่งตัว"), opened from the menu or at the stylist in town. Two tabs:
// - ร้าน: every cosmetic, with try-on (shown on your own character, only to you; taken off when the
//   window closes). Buying is in the cash shop (src/client/cashShop.ts): the button opens it.
// Pieces the owner hid in /admin (src/shared/cosShop.ts) aren't listed, except under ของฉัน while worn (to take off).
// - ของฉัน: what the account owns (an admin gives them out), to wear or take off. The server checks it.
// Also the mount button (Z) shown while a mount is worn.
import type { Game } from './Game';
import { COSMETICS, COS_SLOTS, COS_SLOT_NAME, cosById, cosPerk, type CosmeticDef, type CosSlot, type CosWorn } from '../shared/data/cosmetics';
import { setLookOwner, setTryOn, tryingOn, tryOnBlocked, TRY_ON_TOWN_MSG } from './cosLook';
import { cosHiddenKey, isCosHidden } from './cosTune';
import { cosCardImage } from './cosmeticViews';
import { hasPaperCard, paperCardImage } from './paperCards';
import { orbItemLook, orbItemsVersion } from '../shared/orbItems';
import { ORB_PALETTES } from './orbs';
import { cashCatalogNow, cashVersion } from './cashData';
import { levelUpCard, levelUpLookOf } from './levelUpFx';
import { dashCard, dashLookOf } from './dashFx';
import { cosTune } from './cosTune';
import { keyHint } from './keybinds';

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

/**
 * An aura's or a title set's card picture from its paper art (paperCards.ts). It loads in the background: until then the
 * old picture shows, then every copy on the page (copies made with cloneNode too, found by data-cos-pic) gets it.
 */
function paperPicture(c: CosmeticDef, fallback: string): HTMLElement {
  const img = el('img', 'cos-pic cos-pic-paper');
  img.alt = c.name;
  img.dataset.cosPic = c.id;
  const done = picCache.get(`paper:${c.id}`);
  img.src = done ?? fallback;
  if (!done && !paperLoading.has(c.id)) {
    paperLoading.add(c.id);
    void paperCardImage(c).then((src) => {
      if (!src) return; // art missing: keep the old picture (and try again next time)
      picCache.set(`paper:${c.id}`, src);
      for (const im of document.querySelectorAll<HTMLImageElement>(`img[data-cos-pic="${c.id}"]`)) im.src = src;
    }).finally(() => paperLoading.delete(c.id));
  }
  return img;
}
const paperLoading = new Set<string>();
/** Until the paper title card loads: nothing (a transparent pixel). */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

/** The card picture (made once): the front view of the real sheet or its placeholder; a title set as text. */
export function cosPicture(c: CosmeticDef): HTMLElement {
  if (hasPaperCard(c)) {
    if (c.slot === 'title') return paperPicture(c, BLANK);
    let src = picCache.get(c.id);
    if (!src) {
      src = cosCardImage(c);
      picCache.set(c.id, src);
    }
    return paperPicture(c, src);
  }
  if (c.slot === 'title') {
    const box = el('div', 'cos-pic cos-pic-title');
    box.style.setProperty('--c1', c.color);
    box.style.setProperty('--c2', c.color2);
    box.append(el('div', 'cos-n', 'ชื่อตัวละคร'), el('div', 'cos-b', 'สวัสดี!'));
    return box;
  }
  if (c.slot === 'levelup') {
    // A still of the style in the piece's own colours, drawn in code (levelUpFx.ts).
    const img = el('img', 'cos-pic');
    img.src = levelUpCard(c.id, levelUpLookOf(cosTune(c.id)));
    img.alt = c.name;
    return img;
  }
  if (c.slot === 'dash') {
    // A still of the style in the piece's own colours, drawn in code (dashFx.ts).
    const img = el('img', 'cos-pic');
    img.src = dashCard(c.id, dashLookOf(cosTune(c.id)));
    img.alt = c.name;
    return img;
  }
  if (c.slot === 'orb') {
    // Three orbs in the look's palette and shape (at +7, +11 and +15), drawn with CSS.
    const look = orbItemLook(c.id);
    const pal = ORB_PALETTES.find((p) => p.id === look?.palette) ?? ORB_PALETTES[0];
    const box = el('div', `cos-pic cos-pic-orb ${look?.shape ?? ''}`);
    for (const [slot, plus] of [[0, 7], [3, 11], [6, 15]]) {
      const col = pal.colors(slot, plus);
      const o = el('i');
      o.style.setProperty('--c1', col.core);
      o.style.setProperty('--c2', col.accent);
      o.style.setProperty('--c3', col.glow);
      box.append(o);
    }
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
    // Out of town with a try-on on (Balance.tryOnTownOnly): it comes off, for this window and the cash shop alike.
    if (tryingOn() && tryOnBlocked(this.g.zone, me)) {
      this.clearTry();
      this.drawn = '';
      this.g.hud.log(`${TRY_ON_TOWN_MSG} ถอดที่ลองแล้ว`, '#ffcf6a');
    }
    const mount = cosById(me.cosmetics.mount);
    this.mountBtn.classList.toggle('hidden', !mount || !me.alive);
    const label = me.mounted ? 'ลงจากสัตว์ขี่ (Z)' : 'ขี่ (Z)';
    if (this.mountBtn.textContent !== label) this.mountBtn.textContent = label;
    this.mountBtn.classList.toggle('on', me.mounted);
    if (!this.open) return;
    const key = JSON.stringify([this.tab, this.slot, this.trying, me.cosmetics, this.g.backend.cosOwned, cosHiddenKey(), orbItemsVersion(), cashVersion()]);
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
    if (id && slot === 'levelup') this.playLevelUp(id);
    if (id && slot === 'dash') this.playDash(id);
  }

  /** A dash effect played once as if your character had just dashed to where it stands (only you see it). */
  private playDash(id: string): void {
    this.g.fx.dashDemo(id, this.g.player);
  }

  /** A level-up effect played once on your own character to look at (only you see it). */
  private playLevelUp(id: string): void {
    const p = this.g.player;
    this.g.fx.levelUpWith(id, p.x, p.z, p.id);
  }

  private draw(): void {
    const owned = new Set(this.g.backend.cosOwned);
    const worn = this.g.player.cosmetics;
    const guest = this.g.backend.guest;
    /** Listed under ของฉัน: owned, and not hidden unless worn. */
    const mine = (c: CosmeticDef) => owned.has(c.id) && (!isCosHidden(c.id) || worn[c.slot] === c.id);
    // A piece being tried on that just got hidden (or an orb look deleted) comes off.
    const gone = (id: string | undefined) => !!id && (isCosHidden(id) || !cosById(id));
    if (COS_SLOTS.some((s) => gone(this.trying[s]))) {
      for (const s of COS_SLOTS) if (gone(this.trying[s])) delete this.trying[s];
      setTryOn(this.trying);
    }

    this.tabsEl.replaceChildren(
      ...([['shop', 'ร้าน'], ['mine', `ของฉัน (${COSMETICS.filter(mine).length})`]] as [Tab, string][]).map(([t, label]) =>
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

    const onSale = new Set(cashCatalogNow().items.filter((e) => e.kind === 'cos').map((e) => e.ref));
    const list = COSMETICS.filter((c) => c.slot === this.slot && (this.tab === 'shop' ? !isCosHidden(c.id) : mine(c)));
    const cards = list.map((c) => {
      const card = el('div', 'cos-card');
      if (worn[c.slot] === c.id) card.classList.add('worn');
      const info = el('div', 'cos-info');
      info.append(el('div', 'cos-name', c.name), el('div', 'cos-desc', c.desc));
      const perk = cosPerk(c);
      if (perk) info.append(el('div', 'cos-desc', perk));
      const tags = el('div', 'cos-tags');
      if (owned.has(c.id)) tags.append(el('span', 'tag on', 'มีแล้ว'));
      if (worn[c.slot] === c.id) tags.append(el('span', 'tag', 'สวมอยู่'));
      if (isCosHidden(c.id)) tags.append(el('span', 'tag', 'ปิดชั่วคราว ถอดแล้วสวมใหม่ไม่ได้'));
      info.append(tags);
      const btns = el('div', 'cos-btns');
      if (this.tab === 'shop') {
        const tryingThis = this.trying[c.slot] === c.id;
        btns.append(
          button(tryingThis ? 'ถอดที่ลอง' : 'ลองสวม', () => {
            const why = tryingThis ? null : tryOnBlocked(this.g.zone, this.g.player);
            if (why) return this.g.hud.log(why, '#ffcf6a');
            this.setTry(c.slot, tryingThis ? null : c.id);
            this.update();
          }, tryingThis ? 'on' : ''),
          ...(tryingThis && c.slot === 'levelup' ? [button('▶ เล่นอีกครั้ง', () => this.playLevelUp(c.id))] : []),
          ...(tryingThis && c.slot === 'dash' ? [button('▶ เล่นอีกครั้ง', () => this.playDash(c.id))] : []),
          ...(onSale.has(c.id) ? [button('ซื้อในแคชช็อป', () => this.g.cashShop.openCos(c.slot), 'cos-buy')] : []),
        );
      } else if (worn[c.slot] === c.id) {
        btns.append(button('ถอด', () => this.g.backend.cosWear(c.slot, null)));
      } else {
        btns.append(button('สวม', () => this.g.backend.cosWear(c.slot, c.id), 'primary'));
      }
      card.append(cosPicture(c), info, btns);
      return card;
    });

    const notes: HTMLElement[] = [];
    if (this.tab === 'shop') notes.push(el('div', 'cos-note', 'ลองสวมได้ (เห็นแค่คุณ ปิดหน้าต่างแล้วจะถอดออก) · ซื้อได้ที่แคชช็อป'));
    else if (guest) notes.push(el('div', 'cos-note', 'Guest รับ Cosmetics ไม่ได้ สมัครสมาชิกเพื่อรับของ'));
    else if (!cards.length) notes.push(el('div', 'cos-note', `ยังไม่มี${COS_SLOT_NAME[this.slot]} ทุกตัวละครในบัญชีใช้ของที่ได้รับร่วมกัน`));
    if (this.slot === 'orb') notes.push(el('div', 'cos-note', 'ลูกแก้วตีบวก: เปลี่ยนหน้าตาลูกแก้วของคุณ ลูกแก้วมีเมื่อสวมของที่ตีบวก +7 ขึ้นไป (1 ชิ้น = 1 ลูก) ไม่มีของ +7 จะไม่เห็นลูกแก้ว'));
    if (this.slot === 'dash') notes.push(el('div', 'cos-note', 'เอฟเฟกต์แดช: เล่นตอนกดแดช (ไม่รวมสกิลที่พุ่งตัว) คนรอบ ๆ เห็นด้วย ไม่ได้สวม = แดชแบบเดิม · ลองสวมแล้วจะเล่นให้ดูบนตัวคุณ 1 ครั้ง และกดแดชดูเองได้ขณะลองสวม'));
    if (this.slot === 'levelup') notes.push(el('div', 'cos-note', 'เอฟเฟกต์เลเวลอัป: เล่นตอนตัวละครเลเวลอัป คนรอบ ๆ เห็นด้วย ไม่ได้สวม = เสาแสงสีทองแบบเดิม · ลองสวมแล้วจะเล่นให้ดูบนตัวคุณ 1 ครั้ง'));
    if (this.slot === 'mount') notes.push(el('div', 'cos-note', `สัตว์ขี่: เดินเร็วขึ้น 30% กด ${keyHint('mount')} เพื่อขึ้น/ลง โจมตี ใช้สกิล หรือโดนตีจะลงเอง ขึ้นใหม่ได้หลังเลิกสู้ 3 วิ ขี่ในห้องบอสไม่ได้`));
    this.body.replaceChildren(...notes, el('div', 'cos-grid'));
    this.body.lastElementChild!.append(...cards);
  }
}
