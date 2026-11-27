// The cash shop window ("แคชช็อป", owner 2026-11-15, docs/systems/cash-shop.md). Opened from the top-right
// icon, the menu, or the crystal merchant in town. Tabs แนะนำ / ของแต่งตัว / ของใช้ / หิน, a side list per
// kind, item cards with a corner badge and a price bar; hovering a card shows its details, clicking opens the
// buy window (quantity, try-on for cosmetics, total). The "+" by the crystals opens the top-up packages:
// when the owner opened top-up, a package makes a PromptPay request and its QR shows here until the owner
// confirms it (docs/systems/topup.md). The server checks and does every purchase (server/cashShop.ts).
import type { Game } from './Game';
import { COS_SLOTS, COS_SLOT_NAME, cosById, cosPerk, type CosSlot } from '../shared/data/cosmetics';
import { STONE_DESC, STONE_NAME } from '../shared/data/stones';
import { CASH_BADGE_NAME, CASH_QTY_MAX, cashBadge, cashBuyError, CURRENCY, vipBuyError, vipItemId, type CashEntry, type VipPackage } from '../shared/cashShop';
import { currentBalance } from '../shared/balance';
import { vipLeftText } from '../shared/vip';
import type { StoneKind } from '../shared/types';
import { cashCatalogNow, cashStateNow, cashVersion, topupNow } from './cashData';
import { bahtText, firstBonus, topupNewError, type TopupPending } from '../shared/topup';
import { cosPicture } from './cosmetics';
import { setTryOn, tryingOn, tryOnBlocked } from './cosLook';
import { stoneIcon } from './icons';
import { imgUrl } from './img';
import { playSound } from './audio/sfx';
import type { CashLineKey } from '../shared/npcTalk';

type Tab = 'featured' | 'cos' | 'use' | 'stone' | 'vip';
const TABS: [Tab, string][] = [['featured', 'แนะนำ'], ['cos', 'ของแต่งตัว'], ['use', 'ของใช้'], ['stone', 'หิน'], ['vip', 'VIP']];
/** Side lists of the ของใช้ tab. */
const USE_GROUPS: [string, string, string[]][] = [['scroll', 'ใบคูณ', ['exp_scroll', 'drop_scroll']], ['mega', 'โทรโข่ง', ['megaphone']]];
const BOUND_KINDS = new Set(['exp_scroll', 'drop_scroll', 'megaphone']);

/** The crystal mark (art_templates/cashshop/raw/crystal.png, cut by tools/cut_cashshop.cjs). */
export const CRYSTAL_ICON = `<img class="cry-ico" src="${imgUrl('assets/sprites/ui/crystal.png')}" alt="" draggable="false">`;
/** Package pictures, small heap to treasure chest (ui/cash_pack_1..4). */
const packPic = (tier: number) => `<img class="cash-pack-pic" src="${imgUrl(`assets/sprites/ui/cash_pack_${tier}.png`)}" alt="" draggable="false">`;

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

const fmt = (n: number) => n.toLocaleString('en-US');

/** QR pictures by payload (the encoder is loaded only when a QR is first shown). */
const qrSvg = new Map<string, string>();
let qrVersion = 0;
function qrPicture(payload: string, onReady: () => void): string | null {
  const svg = qrSvg.get(payload);
  if (svg !== undefined) return svg;
  qrSvg.set(payload, '');
  void import('qrcode-generator').then(({ default: qrcode }) => {
    const q = qrcode(0, 'M');
    q.addData(payload);
    q.make();
    qrSvg.set(payload, q.createSvgTag({ cellSize: 4, margin: 4, scalable: true }));
    qrVersion++;
    onReady();
  }).catch(() => qrSvg.delete(payload));
  return null;
}

/** "เหลือ 2 วัน" / "เหลือ 5 ชม." / "เหลือ 12 นาที". */
function timeLeft(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min >= 2 * 24 * 60) return `เหลือ ${Math.floor(min / (24 * 60))} วัน`;
  if (min >= 120) return `เหลือ ${Math.floor(min / 60)} ชม.`;
  return `เหลือ ${min} นาที`;
}

const entryName = (e: CashEntry) => (e.kind === 'cos' ? cosById(e.ref)?.name ?? e.ref : STONE_NAME[e.ref as StoneKind]);
const entryDesc = (e: CashEntry) => (e.kind === 'cos' ? cosById(e.ref)?.desc ?? '' : STONE_DESC[e.ref as StoneKind]);
/** The mount's speed and the like (cosPerk), or ''. */
const entryPerk = (e: CashEntry) => {
  const c = e.kind === 'cos' ? cosById(e.ref) : undefined;
  return (c && cosPerk(c)) ?? '';
};

function entryPic(e: CashEntry, big = false): HTMLElement {
  if (e.kind === 'cos') {
    const c = cosById(e.ref);
    if (c) return cosPicture(c);
  }
  const box = el('div', big ? 'cash-stone big' : 'cash-stone');
  box.innerHTML = stoneIcon(e.ref as StoneKind);
  return box;
}

function priceBar(e: CashEntry, qty = 1): HTMLElement {
  const bar = el('div', 'cash-price');
  // An orb that comes from the mystery box: no price.
  if (e.fromBox) {
    bar.classList.add('box');
    bar.textContent = '🎁 เปิดได้จากกล่องปริศนา';
    return bar;
  }
  bar.innerHTML = (e.now < e.price ? `<s>${fmt(e.price * qty)}</s> ` : '') + `${CRYSTAL_ICON}<b>${fmt(e.now * qty)}</b>`;
  return bar;
}

export class CashShopUI {
  private readonly win: HTMLElement;
  private readonly balance: HTMLElement;
  /** "VIP · เหลือ …" by the crystals while the account's VIP runs. */
  private readonly vipBadge: HTMLElement;
  private vipBusy = false;
  private readonly tabsEl: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly side: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly tip: HTMLElement;
  private readonly modal: HTMLElement;
  /** Shown instead of the window while trying a cosmetic on, so the character can be seen. */
  private readonly peekBar: HTMLElement;
  private tab: Tab = 'featured';
  private sub: Record<'cos' | 'use', string> = { cos: 'wings', use: 'scroll' };
  private drawn = '';
  /** The buy window's item, quantity and answer line; and whether we put a try-on on. */
  private buying: { id: string; qty: number; msg: string; ok: boolean; busy: boolean } | null = null;
  private trying = false;
  private packages = false;
  /** The top-up dialog: waiting for the server, and its last answer. */
  private topupBusy = false;
  private topupMsg: { text: string; ok: boolean } | null = null;
  /** Shown inside the NPC talk window (npcCashPane.ts, owner 2026-11-28). */
  private inTalk = false;
  /** The talk window's crystal merchant says something about what just happened (npcTalk.cash lines). */
  onTalk: ((key: CashLineKey, ...args: (string | number)[]) => void) | null = null;

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'cash-win';
    const head = el('div', 'panel-head');
    this.balance = el('span', 'cash-balance');
    const right = el('span', 'cash-head-right');
    const plus = button('+', () => this.showPackages(true), 'cash-plus');
    plus.title = `เติม${CURRENCY}`;
    this.vipBadge = el('span', 'cash-vip-badge hidden');
    right.append(this.vipBadge, this.balance, plus);
    head.append(el('span', '', 'แคชช็อป'), right, button('✕', () => this.toggle(false)));
    this.tabsEl = el('div', 'ui-tabs');
    this.banner = el('div', 'cash-banner', 'ร้านยังไม่เปิดขาย ดูสินค้าได้อย่างเดียว');
    const body = el('div', 'cash-body');
    this.side = el('div', 'cash-side');
    this.grid = el('div', 'cash-grid');
    body.append(this.side, this.grid);
    this.tip = el('div', 'cash-tip hidden');
    this.modal = el('div', 'cash-modal hidden');
    this.modal.addEventListener('click', (ev) => {
      if (ev.target === this.modal) this.closeModal();
    });
    this.win.append(head, this.tabsEl, this.banner, body, this.tip, this.modal);
    document.getElementById('hud')!.append(this.win);
    this.peekBar = el('div', 'hidden');
    this.peekBar.id = 'cash-peek';
    document.getElementById('hud')!.append(this.peekBar);
  }

  /** Hides the window and shows the try-on bar (`name` = what is tried on), or the other way round (null). */
  private setPeek(name: string | null): void {
    this.win.classList.toggle('peek', !!name);
    this.peekBar.classList.toggle('hidden', !name);
    if (!name) return;
    this.peekBar.replaceChildren(
      el('span', '', `กำลังลองสวม ${name} (เห็นแค่คุณ)`),
      button('กลับไปที่ร้าน', () => this.setPeek(null), 'primary'),
      button('ถอดที่ลอง', () => {
        this.trying = false;
        setTryOn(null);
        this.setPeek(null);
        this.drawn = '';
        this.update();
      }),
    );
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    // /admin "แคชช็อปในหน้าต่างคุย" (owner 2026-11-28): opening from anywhere (the top icon too) goes through the
    // crystal merchant's talk window, which calls openInTalk.
    if (show && !this.inTalk && this.g.npcDialog.cashInTalk) return this.g.npcDialog.openCash();
    if (!show) this.inTalk = false;
    this.win.classList.toggle('hidden', !show);
    this.setPeek(null);
    if (!show) this.closeModal();
    this.drawn = '';
    this.update();
  }

  /** Opens the window inside the NPC talk window (npcDialog moves it in). */
  openInTalk(): void {
    this.inTalk = true;
    this.toggle(true);
  }

  /** Whether the shop sells now (else it can only be looked at). */
  get saleOpen(): boolean {
    return cashCatalogNow().open;
  }

  /** Opens on the ของแต่งตัว tab at `slot` (the cosmetics window's "ซื้อในแคชช็อป"). */
  openCos(slot: CosSlot): void {
    this.tab = 'cos';
    this.sub.cos = slot;
    this.toggle(true);
  }

  /** Every frame: redraw when something shown changed (catalogue, crystals, owned cosmetics, the minute for timers). */
  update(): void {
    // The try-on came off elsewhere (stepped out of town, src/client/cosmetics.ts): drop it here too.
    if (this.trying && !tryingOn()) {
      this.trying = false;
      this.setPeek(null);
      this.drawn = '';
    }
    if (!this.open) return;
    const key = JSON.stringify([this.tab, this.sub, cashVersion(), this.g.backend.cosOwned, this.buying, this.vipBusy, this.packages, this.topupBusy, this.topupMsg, qrVersion, Math.floor(Date.now() / 30_000)]);
    if (key === this.drawn) return;
    this.drawn = key;
    this.draw();
  }

  private visible(now: number): CashEntry[] {
    return cashCatalogNow().items.filter((e) =>
      (e.start === undefined || e.start <= now) && (e.end === undefined || e.end > now) && (e.kind !== 'cos' || !!cosById(e.ref)));
  }

  private draw(): void {
    const cat = cashCatalogNow();
    const st = cashStateNow();
    const now = Date.now();
    const owned = new Set(this.g.backend.cosOwned);
    this.balance.innerHTML = `${CRYSTAL_ICON}<b>${fmt(st.crystals)}</b>`;
    this.balance.title = CURRENCY;
    const vipLeft = vipLeftText(st.vipUntil, now);
    this.vipBadge.classList.toggle('hidden', !vipLeft);
    this.vipBadge.textContent = vipLeft ? `VIP · เหลือ ${vipLeft}` : '';
    this.banner.classList.toggle('hidden', cat.open);
    this.tabsEl.replaceChildren(...TABS.map(([t, label]) => button(label, () => {
      this.tab = t;
      this.update();
    }, this.tab === t ? 'ui-tab active' : 'ui-tab')));

    const all = this.visible(now);
    let list: CashEntry[];
    const sides: [string, string][] = [];
    if (this.tab === 'vip') {
      this.side.classList.add('hidden');
      this.grid.replaceChildren(this.vipBox(vipLeft));
      this.drawModal(owned, now);
      return;
    }
    if (this.tab === 'featured') list = all.filter((e) => e.featured);
    else if (this.tab === 'cos') {
      sides.push(...COS_SLOTS.map((s): [string, string] => [s, COS_SLOT_NAME[s]]));
      list = all.filter((e) => e.kind === 'cos' && cosById(e.ref)?.slot === (this.sub.cos as CosSlot));
    } else if (this.tab === 'use') {
      sides.push(...USE_GROUPS.map(([id, name]): [string, string] => [id, name]));
      const kinds = USE_GROUPS.find(([id]) => id === this.sub.use)?.[2] ?? [];
      list = all.filter((e) => e.kind === 'stone' && kinds.includes(e.ref));
    } else list = all.filter((e) => e.kind === 'stone' && !BOUND_KINDS.has(e.ref));

    this.side.classList.toggle('hidden', !sides.length);
    const sub = this.tab === 'cos' || this.tab === 'use' ? this.tab : null;
    this.side.replaceChildren(...sides.map(([id, name]) => button(name, () => {
      if (sub) this.sub[sub] = id;
      this.update();
    }, sub && this.sub[sub] === id ? 'on' : '')));

    this.grid.replaceChildren(...list.map((e) => this.card(e, owned.has(e.ref), st.bought[e.id] ?? 0, now)));
    if (this.tab === 'featured') {
      const hero = el('div', 'cash-hero');
      hero.append(el('div', 'cash-hero-title', 'ตลาดมิติ'), el('div', 'cash-hero-sub', `ของพิเศษจากพ่อค้าคริสตัล ซื้อด้วย${CURRENCY}`));
      this.grid.prepend(hero);
    }
    if (!list.length) {
      this.grid.append(el('div', 'cash-empty', this.tab === 'featured' ? 'ยังไม่มีสินค้าแนะนำ' : 'ยังไม่มีสินค้าในหมวดนี้'));
    }
    this.drawModal(owned, now);
  }

  /** The VIP tab: what it gives, the time left, and a button per package (owner 2026-11-23, src/shared/vip.ts). */
  private vipBox(left: string): HTMLElement {
    const b = currentBalance();
    const box = el('div', 'cash-vip');
    box.append(
      el('div', 'cash-hero-title', 'VIP'),
      el('div', 'cash-vip-status', left ? `คุณเป็น VIP · เหลือ ${left}` : 'คุณยังไม่ได้เป็น VIP'),
      el('div', 'cash-vip-perk', `EXP +${b.vipExpPct}%`),
      el('div', 'cash-vip-perk', `โอกาสดรอป +${b.vipDropPct}%`),
      el('div', 'cash-vip-perk', 'เทรดได้ไม่จำกัดครั้งต่อวัน'),
      el('div', 'cash-note', 'ใช้ได้ทุกตัวละครในบัญชี · ซ้อนกับใบคูณ EXP/ดรอปได้ · ซื้อซ้ำ = บวกวันเพิ่ม · เวลาเดินตลอดแม้ไม่ได้ออนไลน์'),
    );
    const pk = cashCatalogNow().vip;
    if (!pk.length) {
      box.append(el('div', 'cash-empty', 'ยังไม่มี VIP ขาย'));
      return box;
    }
    const row = el('div', 'cash-vip-packs');
    for (const p of pk) {
      const btn = button('', () => void this.buyVip(p));
      btn.className = 'cash-vip-pack';
      btn.innerHTML = `<b>${fmt(p.days)} วัน</b><span>${CRYSTAL_ICON}${fmt(p.price)}</span>`;
      const err = vipBuyError(cashCatalogNow(), p.days, p.price, cashStateNow(), this.g.backend.guest);
      btn.disabled = this.vipBusy || !!err;
      if (err) btn.title = err;
      row.append(btn);
    }
    box.append(row);
    return box;
  }

  private async buyVip(p: VipPackage): Promise<void> {
    if (this.vipBusy) return;
    if (!confirm(`ซื้อ VIP ${fmt(p.days)} วัน ราคา ${fmt(p.price)} ${CURRENCY}?`)) return;
    this.vipBusy = true;
    this.update();
    const r = await this.g.backend.cashBuy(vipItemId(p.days), 1, p.price);
    this.vipBusy = false;
    if (r.ok) {
      playSound('cash_buy');
      this.onTalk?.('vip', fmt(p.days));
    }
    this.g.hud.log(r.msg, r.ok ? '#7ae8ff' : '#ffcf6a');
    this.drawn = '';
    this.update();
  }

  private card(e: CashEntry, owned: boolean, bought: number, now: number): HTMLElement {
    const badge = cashBadge(e);
    // The crystal-trimmed card for featured and sale items, the bronze one for the rest.
    const card = el('div', e.featured || badge === 'sale' ? 'cash-card hi' : 'cash-card');
    const well = el('div', 'cash-well');
    well.append(entryPic(e));
    const info = el('div', 'cash-info');
    const lim = e.kind === 'cos' ? (owned ? 'มีแล้ว' : 'ซื้อได้ครั้งเดียว')
      : e.limit !== undefined ? `ซื้อได้ ${fmt(bought)}/${fmt(e.limit)}` : 'ไม่จำกัดจำนวน';
    info.append(el('div', owned && e.kind === 'cos' ? 'cash-lim own' : 'cash-lim', lim));
    if (e.end !== undefined) info.append(el('div', 'cash-time', timeLeft(e.end - now)));
    card.append(well, el('div', 'cash-name', entryName(e)), info, priceBar(e));
    if (badge) {
      const rib = el('span', `cash-ribbon ${badge}`);
      rib.append(el('b', '', badge === 'sale' && e.pct ? `-${e.pct}%` : CASH_BADGE_NAME[badge]));
      card.append(rib);
    }
    card.onclick = () => {
      this.hideTip();
      this.buying = { id: e.id, qty: 1, msg: '', ok: false, busy: false };
      this.update();
    };
    card.onmousemove = (ev) => this.showTip(e, owned, ev);
    card.onmouseleave = () => this.hideTip();
    return card;
  }

  private showTip(e: CashEntry, owned: boolean, ev: MouseEvent): void {
    const lines = [`<b>${entryName(e)}</b>`, entryDesc(e)];
    if (entryPerk(e)) lines.push(entryPerk(e));
    if (e.kind === 'cos') lines.push(owned ? 'มีแล้วในบัญชี' : 'ได้ถาวร เข้าบัญชีทันที ทุกตัวละครในบัญชีใช้ได้');
    else lines.push(BOUND_KINDS.has(e.ref) ? 'ส่งเข้าจดหมาย · ผูกกับตัวละครที่กดรับ' : 'ส่งเข้าจดหมาย · เทรด/ขายได้');
    this.tip.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
    this.tip.classList.remove('hidden');
    const r = this.win.getBoundingClientRect();
    this.tip.style.left = `${Math.min(ev.clientX - r.left + 14, r.width - 220)}px`;
    this.tip.style.top = `${ev.clientY - r.top + 14}px`;
  }

  private hideTip(): void {
    this.tip.classList.add('hidden');
  }

  private showPackages(on: boolean): void {
    if (on && !this.packages) this.onTalk?.('topup');
    this.packages = on;
    this.topupMsg = null;
    if (on) this.buying = null;
    this.update();
  }

  private closeModal(): void {
    this.buying = null;
    this.packages = false;
    if (this.trying) {
      this.trying = false;
      setTryOn(null);
    }
    this.setPeek(null);
    this.modal.classList.add('hidden');
  }

  private drawModal(owned: Set<string>, now: number): void {
    if (this.packages) return this.drawPackages();
    const b = this.buying;
    const e = b ? cashCatalogNow().items.find((i) => i.id === b.id) : undefined;
    if (!b || !e) {
      if (b) this.closeModal();
      this.modal.classList.add('hidden');
      return;
    }
    const box = el('div', 'cash-dialog');
    const top = el('div', 'cash-dialog-top');
    const info = el('div', 'cash-dialog-info');
    info.append(el('div', 'cash-name', entryName(e)), el('div', 'cash-desc', entryDesc(e)));
    if (entryPerk(e)) info.append(el('div', 'cash-desc', entryPerk(e)));
    const notes: string[] = [];
    if (e.kind === 'cos') notes.push(owned.has(e.ref) ? 'มีแล้วในบัญชี' : 'ได้ถาวร เข้าบัญชีทันที ใส่ได้ทุกตัวละครในบัญชี');
    else notes.push(BOUND_KINDS.has(e.ref) ? 'ส่งเข้าจดหมายของบัญชี ผูกกับตัวละครที่กดรับ' : 'ส่งเข้าจดหมายของบัญชี เทรด/ขายได้');
    if (e.limit !== undefined && e.kind === 'stone') notes.push(`จำกัด ${fmt(e.limit)} ชิ้นต่อบัญชี (ซื้อแล้ว ${fmt(cashStateNow().bought[e.id] ?? 0)})`);
    if (e.end !== undefined) notes.push(`ขายถึง ${new Date(e.end).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} (${timeLeft(e.end - now)})`);
    for (const n of notes) info.append(el('div', 'cash-note', n));
    top.append(entryPic(e, true), info);
    box.append(top);

    const row = el('div', 'cash-dialog-row');
    if (e.kind === 'stone') {
      const sel = el('select');
      for (let i = 1; i <= CASH_QTY_MAX; i++) sel.append(new Option(`${i} ชิ้น`, String(i), false, i === b.qty));
      sel.onchange = () => {
        b.qty = Number(sel.value);
        b.msg = '';
        this.update();
      };
      row.append(el('span', '', 'จำนวน'), sel);
    } else {
      const c = cosById(e.ref)!;
      row.append(button(this.trying ? 'ถอดที่ลอง' : 'ลองสวม', () => {
        const why = this.trying ? null : tryOnBlocked(this.g.zone, this.g.player);
        if (why) return this.g.hud.log(why, '#ffcf6a');
        this.trying = !this.trying;
        setTryOn(this.trying ? { [c.slot]: c.id } : null);
        // The window covers the character: step aside while trying on (the bar brings it back).
        if (this.trying) {
          this.setPeek(c.name);
          this.onTalk?.('tryOn', c.name);
        }
        // A level-up effect plays once on your character to look at (only you see it).
        if (this.trying && c.slot === 'levelup') this.g.fx.levelUpWith(c.id, this.g.player.x, this.g.player.z, this.g.player.id);
        // A dash effect plays once as if you had just dashed there; pressing dash while trying it on shows it too.
        if (this.trying && c.slot === 'dash') this.g.fx.dashDemo(c.id, this.g.player);
        this.drawn = '';
        this.update();
      }, this.trying ? 'on' : ''));
      if (c.slot === 'orb') row.append(el('span', 'cash-note', 'เห็นเมื่อสวมของ +7 ขึ้นไป'));
      if (c.slot === 'levelup') row.append(el('span', 'cash-note', 'เห็นตอนเลเวลอัป คนรอบ ๆ เห็นด้วย'));
      if (c.slot === 'dash') row.append(el('span', 'cash-note', 'เห็นตอนกดแดช คนรอบ ๆ เห็นด้วย'));
    }
    box.append(row);

    const total = el('div', 'cash-total');
    total.append(el('span', '', 'รวม'), priceBar(e, b.qty));
    box.append(total);

    const err = cashBuyError(cashCatalogNow(), e.id, b.qty, e.now, cashStateNow(), this.g.backend.cosOwned, this.g.backend.guest, now);
    const line = b.msg || err || '';
    if (line) box.append(el('div', b.msg && b.ok ? 'cash-msg ok' : 'cash-msg', line));
    const btns = el('div', 'cash-dialog-btns');
    if (b.msg && b.ok) btns.dataset.done = '1';
    btns.append(
      button(b.busy ? 'กำลังซื้อ…' : 'ยืนยันการซื้อ', () => void this.buy(e, b.qty), 'primary', !!err || b.busy),
      button(b.msg && b.ok ? 'ปิด' : 'ยกเลิก', () => {
        this.closeModal();
        this.drawn = '';
        this.update();
      }),
    );
    box.append(btns);
    this.modal.replaceChildren(box);
    this.modal.classList.remove('hidden');
  }

  private async buy(e: CashEntry, qty: number): Promise<void> {
    const b = this.buying;
    if (!b || b.busy) return;
    b.busy = true;
    this.update();
    const r = await this.g.backend.cashBuy(e.id, qty, e.now);
    if (this.buying !== b) return;
    b.busy = false;
    b.ok = r.ok;
    b.msg = r.msg;
    if (r.ok) {
      playSound('cash_buy');
      this.onTalk?.('bought', entryName(e));
    }
    this.g.hud.log(r.msg, r.ok ? '#7ae8ff' : '#ffcf6a');
    this.drawn = '';
    this.update();
  }

  private drawPackages(): void {
    const box = el('div', 'cash-dialog wide');
    box.append(el('div', 'cash-name', `เติม${CURRENCY}`));
    const pk = cashCatalogNow().packages;
    const tv = topupNow();
    if (this.topupMsg) box.append(el('div', this.topupMsg.ok ? 'cash-msg ok' : 'cash-msg', this.topupMsg.text));
    // Open requests first: their QR (the packages show only while another request may be made).
    for (const p of tv.pending) box.append(this.pendingBox(p));
    if (!pk.length) box.append(el('div', 'cash-empty', `เติม${CURRENCY}ได้เร็วๆ นี้`));
    else if (tv.pending.length < tv.maxPending) {
      const list = el('div', 'cash-packs');
      // Pictures by rank among the packages (fewest crystals = the small heap, most = the chest).
      const order = pk.map((p) => p.crystals + p.bonus).sort((a, b) => a - b);
      for (const p of pk) {
        const card = el('div', 'cash-pack');
        const tier = 1 + Math.min(3, Math.floor((order.indexOf(p.crystals + p.bonus) * 4) / pk.length));
        card.innerHTML = packPic(tier) + `<div class="cash-pack-n">${CRYSTAL_ICON}<b>${fmt(p.crystals)}</b></div>`
          + (p.bonus ? `<div class="cash-pack-bonus">+ โบนัส ${fmt(p.bonus)}</div>` : '')
          + (firstBonus(tv, p) ? `<div class="cash-pack-first">ครั้งแรก + ${fmt(firstBonus(tv, p))}</div>` : '')
          + `<div class="cash-pack-baht">${fmt(p.baht)} บาท</div>`;
        const err = topupNewError(tv, pk, p, this.g.backend.guest);
        const label = !tv.open ? 'เร็วๆ นี้' : this.topupBusy ? 'รอสักครู่…' : 'เติม';
        const b = button(label, () => void this.topupNew(p), tv.open ? 'primary' : '', !!err || this.topupBusy);
        if (err && tv.open) b.title = err;
        card.append(b);
        list.append(card);
      }
      box.append(list);
      if (!tv.open) box.append(el('div', 'cash-note', 'ระบบเติมเงินยังไม่เปิด'));
      else if (this.g.backend.guest) box.append(el('div', 'cash-note', 'Guest เติมไม่ได้ สมัครสมาชิกก่อน'));
    }
    if (tv.open || tv.pending.length) box.append(el('div', 'cash-topup-notice', tv.notice));
    box.append(button('ปิด', () => {
      this.closeModal();
      this.drawn = '';
      this.update();
    }));
    this.modal.replaceChildren(box);
    this.modal.classList.remove('hidden');
  }

  /** One open request: QR, the exact amount to transfer, what it gives, until when, and cancel. */
  private pendingBox(p: TopupPending): HTMLElement {
    const wrap = el('div', 'cash-topup');
    const qr = el('div', 'cash-topup-qr');
    const svg = p.qr ? qrPicture(p.qr, () => this.update()) : '';
    if (svg) qr.innerHTML = svg;
    else qr.textContent = p.qr ? 'กำลังสร้าง QR…' : 'ยังไม่มี QR (ติดต่อทีมงาน)';
    const info = el('div', 'cash-topup-info');
    info.append(
      el('div', 'cash-note', 'สแกนด้วยแอปธนาคาร (พร้อมเพย์) แล้วโอนยอดนี้ให้ตรงทุกสตางค์'),
      el('div', 'cash-topup-amount', `${bahtText(p.amount)} บาท`),
      el('div', 'cash-note', `ได้ ${fmt(p.crystals)}${p.bonus ? ` + โบนัส ${fmt(p.bonus)}` : ''}${p.first ? ` + ครั้งแรก ${fmt(p.first)}` : ''} ${CURRENCY} หลังทีมงานตรวจยอดเข้าแล้ว`),
      el('div', 'cash-note', `รอยืนยันถึง ${new Date(p.expiresAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })} (${timeLeft(p.expiresAt - Date.now())})`),
      button('ยกเลิกคำขอ', () => {
        if (confirm(`ยกเลิกคำขอเติม ${bahtText(p.amount)} บาท?\nถ้าโอนไปแล้ว อย่ายกเลิก รอทีมงานยืนยัน`)) void this.topupCancel(p.id);
      }, '', this.topupBusy),
    );
    wrap.append(qr, info);
    return wrap;
  }

  private async topupNew(p: { crystals: number; bonus: number; baht: number; first?: number }): Promise<void> {
    if (this.topupBusy) return;
    const first = firstBonus(topupNow(), p);
    if (!confirm(`เติม ${fmt(p.crystals)}${p.bonus ? ` + โบนัส ${fmt(p.bonus)}` : ''}${first ? ` + ครั้งแรก ${fmt(first)}` : ''} ${CURRENCY} ราคา ${fmt(p.baht)} บาท?\n\n${topupNow().notice}`)) return;
    await this.topupCall(() => this.g.backend.topupNew({ crystals: p.crystals, bonus: p.bonus, baht: p.baht }));
  }

  private async topupCancel(id: number): Promise<void> {
    if (this.topupBusy) return;
    await this.topupCall(() => this.g.backend.topupCancel(id));
  }

  private async topupCall(f: () => Promise<{ ok: boolean; msg: string }>): Promise<void> {
    this.topupBusy = true;
    this.topupMsg = null;
    this.update();
    const r = await f();
    this.topupBusy = false;
    this.topupMsg = { text: r.msg, ok: r.ok };
    this.update();
  }
}
