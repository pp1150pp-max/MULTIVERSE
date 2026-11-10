// The market broker's window: Buy (search with category, class, rarity and stat filters), Sell (list a
// bag item at a price, see and cancel your listings) and the claim box (gold from sales, items back).
// The server decides everything (server/market.ts); this only asks and shows the answers.
import type { Game } from './Game';
import { NPC_USE_RANGE } from '../shared/data/npcs';
import { CLASSES, CLASS_IDS } from '../shared/data/classes';
import { effectiveStats, enhanceBonus, plusOf, itemName } from '../shared/data/enhance';
import { STONE_COLOR, STONE_NAME, stoneUnit } from '../shared/data/stones';
import {
  isBossKey, isItem, isStone, RARITIES, RARITY_COLOR, RARITY_LABEL, SLOT_LABEL, STAT_KEYS, STAT_LABEL,
  type ClassId, type Item, type Rarity, type StatKey, type StoneStack,
} from '../shared/types';
import {
  listingFee, marketKind, marketSellable, saleTax, sellerGets, timeLeftText,
  MARKET_FEE_PCT, MARKET_HOURS, MARKET_KINDS, MARKET_PAGE, MARKET_PRICE_MAX, MARKET_SLOTS, MARKET_STAT_FILTERS, MARKET_TAX_PCT, MARKET_THROTTLE_MSG,
  type MarketCall, type MarketKind, type MarketMine, type MarketPriceRef, type MarketQuery, type MarketReply, type MarketRow, type MarketSort,
} from '../shared/sim/market';
import { COIN_ICON, emptySlotIcon, itemIcon, stoneIcon } from './icons';
import { playSound } from './audio/sfx';

/** What the window needs from the HUD. */
export interface MarketHost {
  log(msg: string, color?: string): void;
  confirm(html: string, yesLabel: string, onYes: () => void): void;
  askAmount(html: string, max: number, initial: number, onOk: (n: number) => void): void;
  showTip(item: Item, e: MouseEvent, hint: string): void;
  showStoneTip(s: StoneStack, e: MouseEvent, hint: string): void;
  hideTip(): void;
  toggleBag(force?: boolean): void;
  markInventory(): void;
}

type Tab = 'buy' | 'sell' | 'box';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const r1 = (v: number) => Math.round(v * 10) / 10;
const GOLD = '#f2c230';
const ERR = '#ff8a6a';

export class MarketWindow {
  isOpen = false;
  private tab: Tab = 'buy';
  // Buy filters, kept while the window is closed and opened again (this play session).
  private kind: MarketKind | null = null;
  private cls: ClassId | null = null;
  private rarities = new Set<Rarity>();
  private stats: { stat: StatKey; min: number | null }[] = [];
  private page = 0;
  private rows: MarketRow[] = [];
  private total = 0;
  private mine: MarketMine | null = null;
  /** Bag slot picked for listing, or -1. */
  private sellI = -1;
  /** Server clock minus this browser's, from the last answer. */
  private clockSkew = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  /** The "more filters" block (Lv, +, price, stats) is open; kept this play session. */
  private moreOpen = false;
  /** Price hints for the picked bag item (null = not asked or none yet), and which item they are for. */
  private ref: MarketPriceRef | null = null;
  private refFor = '';
  private menu: HTMLElement | null = null;

  constructor(private readonly g: Game, private readonly host: MarketHost) {
    $('market-close').onclick = () => this.close();
    for (const b of document.querySelectorAll<HTMLElement>('[data-mtab]')) b.onclick = () => this.showTab(b.dataset.mtab as Tab);
    this.buildFilters();
    $('mkt-moretoggle').onclick = () => {
      this.moreOpen = !this.moreOpen;
      this.renderMore();
    };
    this.renderMore();
    const later = () => this.searchSoon();
    for (const id of ['mkt-name', 'mkt-lvmin', 'mkt-lvmax', 'mkt-plus', 'mkt-pmax']) {
      const el = $<HTMLInputElement>(id);
      el.addEventListener('input', later);
      // Typing here must not move the character or trigger skills.
      el.addEventListener('keydown', (e) => e.stopPropagation());
    }
    $('mkt-sort').addEventListener('change', () => this.search(0));
    $('mkt-fit').addEventListener('change', () => this.search(0));
    $('mkt-reset').onclick = () => this.resetFilters();
    $('mkt-prev').onclick = () => this.page > 0 && this.search(this.page - 1);
    $('mkt-next').onclick = () => (this.page + 1) * MARKET_PAGE < this.total && this.search(this.page + 1);
    $('mkt-claimall').onclick = () => this.claim(-1);

    const list = $('mkt-list');
    list.addEventListener('click', (e) => {
      const id = Number((e.target as HTMLElement).closest<HTMLElement>('[data-buy]')?.dataset.buy);
      if (id) this.askBuy(id);
    });
    this.tipOn(list, () => this.rows, 'กดปุ่ม "ซื้อ" เพื่อซื้อ');
    const active = $('mkt-active');
    active.addEventListener('click', (e) => {
      const id = Number((e.target as HTMLElement).closest<HTMLElement>('[data-cancel]')?.dataset.cancel);
      if (id) this.askCancel(id);
    });
    this.tipOn(active, () => this.mine?.active ?? [], 'ของที่คุณลงขายอยู่');
    const box = $('mkt-box');
    box.addEventListener('click', (e) => {
      const id = Number((e.target as HTMLElement).closest<HTMLElement>('[data-claim]')?.dataset.claim);
      if (id) this.claim(id);
    });
    this.tipOn(box, () => this.mine?.box ?? [], 'กด "รับ" เพื่อรับเข้ากระเป๋า');
    const form = $('mkt-sellform');
    form.addEventListener('input', () => this.renderFee());
    form.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.list();
    });
    form.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('#mkt-listgo')) this.list();
      else if (t.closest('#mkt-listcancel')) this.pick(-1);
    });
  }

  // ------------------------------------------------------------ open / close

  open(): void {
    this.isOpen = true;
    $('market').classList.remove('hidden');
    this.host.toggleBag(true);
    this.showTab(this.tab);
    this.refreshMine();
    if (this.tab !== 'buy') this.search(this.page);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.closeMenu();
    this.sellI = -1;
    this.refFor = '';
    $('market').classList.add('hidden');
    this.host.hideTip();
    this.host.markInventory();
  }

  /** Every frame while open: closes when the player walks away or dies; keeps the gold and box count fresh. */
  update(): void {
    if (!this.isOpen) return;
    const p = this.g.player;
    if (this.g.backend.npcDistance('broker') > NPC_USE_RANGE || !p.alive) {
      this.close();
      return;
    }
    $('mkt-gold').innerHTML = `${COIN_ICON} ${p.gold.toLocaleString()} G`;
    const n = this.g.backend.marketBox;
    const boxN = $('mkt-boxn');
    const txt = n ? `(${n})` : '';
    if (boxN.textContent !== txt) {
      boxN.textContent = txt;
      if (this.tab === 'box') this.refreshMine();
    }
    // The picked bag slot changed under us (moved, sold): drop the pick.
    if (this.sellI >= 0 && !marketSellable(p.bag[this.sellI])) this.pick(-1);
  }

  /** Right click on a bag slot while the window is open: pick it for listing. */
  bagRightClick(i: number): void {
    const e = this.g.player.bag[i];
    if (!e) return;
    if (!marketSellable(e)) {
      this.say('ยาลงขายในตลาดไม่ได้ (ขายให้พ่อค้าแทน)', ERR);
      return;
    }
    if (this.g.backend.guest) {
      this.say('Guest ซื้อขายในตลาดไม่ได้ — สมัครสมาชิกเพื่อใช้ตลาด', ERR);
      return;
    }
    this.showTab('sell');
    this.pick(i);
  }

  get bagHint(): string {
    return 'คลิกขวา = เลือกของมาลงขายในตลาด · คลิกซ้าย = สวมใส่ · ยาลงขายไม่ได้';
  }

  private showTab(t: Tab): void {
    this.tab = t;
    this.say('');
    for (const b of document.querySelectorAll<HTMLElement>('[data-mtab]')) b.classList.toggle('active', b.dataset.mtab === t);
    for (const b of document.querySelectorAll<HTMLElement>('[data-mbody]')) b.classList.toggle('hidden', b.dataset.mbody !== t);
    if (t === 'buy') this.search(this.page);
    else {
      this.refreshMine();
      if (t === 'sell') this.renderSellForm();
    }
  }

  // ------------------------------------------------------------ requests

  private async call(c: MarketCall): Promise<MarketReply> {
    const r = await this.g.backend.market(c);
    if (r.now) this.clockSkew = r.now - Date.now();
    return r;
  }

  private say(msg: string, color = '#e8e2d0'): void {
    const el = $('mkt-msg');
    el.textContent = msg;
    el.style.color = color;
  }

  private searchSoon(delay = 500): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.search(0), delay);
  }

  private query(page: number): MarketQuery {
    const num = (id: string) => {
      const v = Number($<HTMLInputElement>(id).value);
      return $<HTMLInputElement>(id).value.trim() && Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined;
    };
    this.renderMore();
    const q: MarketQuery = { page, sort: $<HTMLSelectElement>('mkt-sort').value as MarketSort };
    if (this.kind) q.kind = this.kind;
    if (this.cls) q.cls = this.cls;
    if (this.rarities.size) q.rarities = [...this.rarities];
    const name = $<HTMLInputElement>('mkt-name').value.trim();
    if (name) q.name = name;
    q.lvMin = num('mkt-lvmin');
    q.lvMax = num('mkt-lvmax');
    q.plusMin = num('mkt-plus');
    q.priceMax = num('mkt-pmax');
    if ($<HTMLInputElement>('mkt-fit').checked) {
      // Gear this character can wear: its class (or any class) and up to its level.
      const p = this.g.player;
      q.cls = p.cls.id;
      q.lvMax = Math.min(q.lvMax ?? Infinity, p.level);
    }
    if (this.stats.length) q.stats = this.stats.map((f) => ({ stat: f.stat, min: f.min ?? 0 }));
    return q;
  }

  private async search(page: number): Promise<void> {
    if (!this.isOpen) return;
    const r = await this.call({ a: 'mktSearch', q: this.query(page) });
    if (!r.ok) {
      this.say(r.msg ?? '', ERR);
      // Asked too fast (the server says so): try again once the bucket has refilled a little.
      if (!r.msg || r.msg === MARKET_THROTTLE_MSG) {
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.search(page), 1500);
      }
      return;
    }
    if ($('mkt-msg').textContent === MARKET_THROTTLE_MSG) this.say('');
    if (!r.page) return;
    this.rows = r.page.rows;
    this.total = r.page.total;
    this.page = r.page.page;
    this.renderList();
  }

  private async refreshMine(): Promise<void> {
    if (!this.isOpen || this.g.backend.guest) {
      this.renderMine();
      return;
    }
    const r = await this.call({ a: 'mktMine' });
    if (r.ok && r.mine) {
      this.mine = r.mine;
      this.renderMine();
    } else if (!r.ok && !r.msg) setTimeout(() => this.refreshMine(), 300);
  }

  /** Sends a trade and shows what came back; returns whether it worked. */
  private async act(c: MarketCall): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      const r = await this.call(c);
      if (!r.ok && !r.msg) return false;
      this.say(r.msg ?? '', r.ok ? GOLD : ERR);
      if (r.msg) this.host.log(r.msg, r.ok ? GOLD : ERR);
      if (r.ok) playSound('trade');
      if (r.mine) {
        this.mine = r.mine;
        this.renderMine();
      }
      this.host.markInventory();
      return r.ok;
    } finally {
      this.busy = false;
    }
  }

  private askBuy(id: number): void {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return;
    if (this.g.backend.guest) {
      this.say('Guest ซื้อขายในตลาดไม่ได้ — สมัครสมาชิกเพื่อใช้ตลาด', ERR);
      return;
    }
    if (this.g.player.gold < row.price) {
      this.say(`ทองไม่พอ (ต้องใช้ ${row.price.toLocaleString()} G)`, ERR);
      return;
    }
    this.host.confirm(
      `ซื้อ ${this.nameHtml(row.entry)}<br>จาก ${esc(row.seller)} ราคา <b style="color:${GOLD}">${row.price.toLocaleString()} G</b>?` +
      `<br><small>ทองคงเหลือหลังซื้อ ${(this.g.player.gold - row.price).toLocaleString()} G</small>`,
      'ซื้อ',
      async () => {
        await this.act({ a: 'mktBuy', id, price: row.price });
        this.search(this.page);
      },
    );
  }

  private askCancel(id: number): void {
    const row = this.mine?.active.find((r) => r.id === id);
    if (!row) return;
    this.host.confirm(
      `ยกเลิกการขาย ${this.nameHtml(row.entry)}?<br><small>ของจะไปอยู่ในกล่องรับของ · ค่าลงขายไม่คืน</small>`,
      'ยกเลิกการขาย',
      () => void this.act({ a: 'mktCancel', id }),
    );
  }

  private claim(id: number): void {
    void this.act({ a: 'mktClaim', id });
  }

  private async list(): Promise<void> {
    const i = this.sellI;
    const e = this.g.player.bag[i];
    if (i < 0 || !marketSellable(e)) return;
    const price = this.priceInput();
    if (!price) {
      this.say(`ใส่ราคา 1 – ${MARKET_PRICE_MAX.toLocaleString()} G`, ERR);
      return;
    }
    const fee = listingFee(price);
    if (this.g.player.gold < fee) {
      this.say(`ทองไม่พอจ่ายค่าลงขาย ${fee.toLocaleString()} G`, ERR);
      return;
    }
    const send = async (n?: number) => {
      if (await this.act({ a: 'mktList', i, price, n })) {
        this.refFor = '';
        this.pick(-1);
      }
    };
    // A stone stack of 2+: ask how many to list (the whole stack is the default).
    if (isStone(e) && e.count > 1) {
      this.host.askAmount(`ลงขาย ${this.nameHtml(e)} กี่${stoneUnit(e.stone)}?`, e.count, e.count, (n) => void send(n >= e.count ? undefined : n));
      return;
    }
    await send();
  }

  // ------------------------------------------------------------ filters

  private buildFilters(): void {
    $('mkt-cls').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-cls]');
      if (!b) return;
      this.cls = (b.dataset.cls || null) as ClassId | null;
      this.renderFilters();
      this.search(0);
    });
    $('mkt-rar').addEventListener('click', (e) => {
      const r = (e.target as HTMLElement).closest<HTMLElement>('[data-rar]')?.dataset.rar as Rarity | undefined;
      if (!r) return;
      if (this.rarities.has(r)) this.rarities.delete(r);
      else this.rarities.add(r);
      this.renderFilters();
      this.search(0);
    });
    $('mkt-cats').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-kind]');
      if (!b) return;
      this.kind = (b.dataset.kind || null) as MarketKind | null;
      this.renderFilters();
      this.search(0);
    });
    const st = $('mkt-stats');
    st.addEventListener('change', (e) => {
      const t = e.target as HTMLElement;
      const row = Number(t.closest<HTMLElement>('[data-srow]')?.dataset.srow);
      if (t instanceof HTMLSelectElement && this.stats[row]) {
        this.stats[row].stat = t.value as StatKey;
        this.search(0);
      }
    });
    st.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      const row = Number(t.closest<HTMLElement>('[data-srow]')?.dataset.srow);
      if (t.tagName === 'INPUT' && this.stats[row]) {
        const v = Number(t.value);
        this.stats[row].min = t.value.trim() && Number.isFinite(v) && v > 0 ? v : null;
        this.searchSoon();
      }
    });
    st.addEventListener('keydown', (e) => e.stopPropagation());
    st.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-sadd]')) {
        const used = new Set(this.stats.map((f) => f.stat));
        const stat = STAT_KEYS.find((k) => !used.has(k));
        if (stat && this.stats.length < MARKET_STAT_FILTERS) this.stats.push({ stat, min: null });
        this.renderFilters();
        this.search(0);
      } else if (t.closest('[data-sdel]')) {
        this.stats.splice(Number(t.closest<HTMLElement>('[data-sdel]')!.dataset.sdel), 1);
        if (!this.stats.length && $<HTMLSelectElement>('mkt-sort').value === 'stat') $<HTMLSelectElement>('mkt-sort').value = 'priceAsc';
        this.renderFilters();
        this.search(0);
      }
    });
    this.renderFilters();
  }

  private resetFilters(): void {
    this.kind = null;
    this.cls = null;
    this.rarities.clear();
    this.stats = [];
    for (const id of ['mkt-name', 'mkt-lvmin', 'mkt-lvmax', 'mkt-plus', 'mkt-pmax']) $<HTMLInputElement>(id).value = '';
    $<HTMLInputElement>('mkt-fit').checked = false;
    $<HTMLSelectElement>('mkt-sort').value = 'priceAsc';
    this.renderFilters();
    this.renderMore();
    this.search(0);
  }

  private renderFilters(): void {
    const myCls = this.g.player.cls.id;
    const kindIcon = (k: MarketKind) => (k === 'stone' ? stoneIcon('enhance') : k === 'artifact' ? stoneIcon('key_bear') : k === 'consumable' ? stoneIcon('return_scroll') : emptySlotIcon(k, myCls));
    const kindLabel = (k: MarketKind) => (k === 'stone' ? 'หินตีบวก' : k === 'artifact' ? 'Artifact' : k === 'consumable' ? 'ของใช้' : SLOT_LABEL[k]);
    $('mkt-cats').innerHTML =
      `<button class="mkt-cat${this.kind ? '' : ' on'}" data-kind=""><span class="mkt-cat-ic">${COIN_ICON}</span>ทั้งหมด</button>` +
      MARKET_KINDS.map((k) =>
        `<button class="mkt-cat${this.kind === k ? ' on' : ''}" data-kind="${k}"><span class="mkt-cat-ic">${kindIcon(k)}</span>${kindLabel(k)}</button>`).join('');
    $('mkt-cls').innerHTML =
      `<button class="mkt-chip${this.cls ? '' : ' on'}" data-cls="">ทุกอาชีพ</button>` +
      CLASS_IDS.map((c) => `<button class="mkt-chip${this.cls === c ? ' on' : ''}" data-cls="${c}">${CLASSES[c].name}</button>`).join('');
    $('mkt-rar').innerHTML = RARITIES.map((r) =>
      `<button class="mkt-chip${this.rarities.has(r) ? ' on' : ''}" data-rar="${r}" style="--rc:${RARITY_COLOR[r]}">${RARITY_LABEL[r]}</button>`).join('');
    $('mkt-stats').innerHTML = this.stats.map((f, i) =>
      `<div class="mkt-srow" data-srow="${i}"><select>${STAT_KEYS.map((k) =>
        `<option value="${k}"${k === f.stat ? ' selected' : ''}${k !== f.stat && this.stats.some((o) => o.stat === k) ? ' disabled' : ''}>${STAT_LABEL[k]}</option>`).join('')}</select>` +
      ` อย่างน้อย <input type="number" min="0" step="any" placeholder="มีก็พอ" value="${f.min ?? ''}"><button data-sdel="${i}" title="ลบ">✕</button></div>`).join('') +
      (this.stats.length < MARKET_STAT_FILTERS ? `<button class="mkt-chip" data-sadd="1">+ เพิ่มสเตตัส</button>` : '');
  }

  // ------------------------------------------------------------ lists

  private nameHtml(e: Item | StoneStack): string {
    if (isStone(e)) return `<b style="color:${STONE_COLOR[e.stone]}">${STONE_NAME[e.stone]} ×${e.count}</b>`;
    return `<b style="color:${RARITY_COLOR[e.rarity]}">${esc(itemName(e))}</b>`;
  }

  private cell(e: Item | StoneStack): string {
    if (isStone(e)) {
      return `<div class="cell pot stone" style="--rc:${STONE_COLOR[e.stone]}">${stoneIcon(e.stone)}<span class="ilv">×${e.count}</span></div>`;
    }
    const plus = plusOf(e) ? `<span class="iplus">+${plusOf(e)}</span>` : '';
    const locked = this.g.player.canEquip(e) ? '' : ' locked';
    return `<div class="cell r-${e.rarity}${locked}" style="--rc:${RARITY_COLOR[e.rarity]}">${itemIcon(e)}${plus}<span class="ilv">Lv.${e.level}</span></div>`;
  }

  /** Every stat line of the item (main and extras, with tiers), the filtered ones highlighted. */
  private statLine(e: Item | StoneStack): string {
    if (isStone(e)) return `<span class="mkt-dim">${isBossKey(e.stone) ? 'Artifact · กุญแจห้องบอส' : 'วัตถุดิบตีบวก · ดรอปจากบอส'}</span>`;
    const want = new Set(this.stats.map((f) => f.stat));
    const pct = (k: StatKey) => (STAT_LABEL[k].endsWith('%') ? '%' : '');
    const label = (k: StatKey) => STAT_LABEL[k].replace(/ %$/, '');
    const one = (k: StatKey, v: number, tier?: number) =>
      `<span class="mkt-stat${want.has(k) ? ' hit' : ''}">${label(k)} +${r1(v)}${pct(k)}${tier ? ` <i class="tier t${tier}">T${tier}</i>` : ''}</span>`;
    let html = e.lines?.length
      ? e.lines.map((l) => one(l.stat, l.value, l.tier)).join('')
      : (Object.keys(effectiveStats(e)) as StatKey[]).map((k) => one(k, effectiveStats(e)[k] ?? 0)).join('');
    const bonus = enhanceBonus(e);
    const b = (Object.keys(bonus) as StatKey[]).filter((k) => bonus[k]).map((k) => `${label(k)} +${r1(bonus[k] ?? 0)}`).join(' · ');
    if (e.lines?.length && b) html += `<span class="mkt-enh">ตีบวก: ${b}</span>`;
    return html || '<span class="mkt-dim">—</span>';
  }

  /** "≈ 120 G/ก้อน · " for a stack of 2+ stones (price per unit), else nothing. */
  private unitPrice(e: Item | StoneStack, price: number): string {
    return isStone(e) && e.count > 1 ? `${Math.ceil(price / e.count).toLocaleString()} G/${stoneUnit(e.stone)} · ` : '';
  }

  private renderMore(): void {
    const filled = ['mkt-lvmin', 'mkt-lvmax', 'mkt-plus', 'mkt-pmax'].filter((id) => $<HTMLInputElement>(id).value.trim()).length + this.stats.length;
    $('mkt-more').classList.toggle('hidden', !this.moreOpen);
    $('mkt-moretoggle').textContent = `ตัวกรองเพิ่มเติม ${this.moreOpen ? '▴' : '▾'}${filled ? ` (ใช้อยู่ ${filled})` : ''}`;
  }

  private left(r: MarketRow): string {
    return timeLeftText(r.expiresAt - (Date.now() + this.clockSkew));
  }

  private renderList(): void {
    const gold = this.g.player.gold;
    $('mkt-list').innerHTML = this.rows.length
      ? this.rows.map((r) => {
        const e = r.entry;
        const sub = isItem(e)
          ? `${RARITY_LABEL[e.rarity]} · ${SLOT_LABEL[e.slot]}${e.cls ? ` · ${CLASSES[e.cls].name}` : ''}`
          : 'หิน';
        const buy = r.mine
          ? '<span class="mkt-dim">ของคุณ</span>'
          : `<button data-buy="${r.id}"${gold < r.price ? ' class="poor"' : ''}>ซื้อ</button>`;
        return `<div class="mkt-row" data-id="${r.id}">${this.cell(e)}` +
          `<div class="mkt-info"><div>${this.nameHtml(e)} <span class="mkt-dim">${sub} · ${esc(r.seller)}</span></div>` +
          `<div class="mkt-lines">${this.statLine(e)}</div></div>` +
          `<div class="mkt-price">${r.price.toLocaleString()} G<small>${this.unitPrice(e, r.price)}${this.left(r)}</small></div>${buy}</div>`;
      }).join('')
      : '<div class="mkt-empty">ไม่พบของที่ตรงกับตัวกรอง</div>';
    const pages = Math.max(1, Math.ceil(this.total / MARKET_PAGE));
    $('mkt-found').textContent = `พบ ${this.total.toLocaleString()} รายการ`;
    $('mkt-pageno').textContent = `หน้า ${this.page + 1} / ${pages}`;
    $<HTMLButtonElement>('mkt-prev').disabled = this.page <= 0;
    $<HTMLButtonElement>('mkt-next').disabled = this.page + 1 >= pages;
  }

  private renderMine(): void {
    const m = this.mine;
    const guest = this.g.backend.guest;
    $('mkt-slots').textContent = m ? `${m.slotsUsed}/${MARKET_SLOTS}` : '';
    $('mkt-active').innerHTML = guest
      ? '<div class="mkt-empty">Guest ซื้อขายในตลาดไม่ได้ — สมัครสมาชิกเพื่อใช้ตลาด</div>'
      : m?.active.length
      ? m.active.map((r) => `<div class="mkt-row" data-id="${r.id}">${this.cell(r.entry)}` +
        `<div class="mkt-info"><div>${this.nameHtml(r.entry)}</div><div class="mkt-lines">${this.statLine(r.entry)}</div></div>` +
        `<div class="mkt-price">${r.price.toLocaleString()} G<small>เหลือ ${this.left(r)}</small></div>` +
        `<button data-cancel="${r.id}">ยกเลิก</button></div>`).join('')
      : '<div class="mkt-empty">ยังไม่ได้ลงขายอะไร</div>';
    $('mkt-box').innerHTML = m?.box.length
      ? m.box.map((r) => {
        const what = r.status === 'sold'
          ? `<span style="color:${GOLD}">ขายได้ +${sellerGets(r.price).toLocaleString()} G</span> <span class="mkt-dim">(ราคา ${r.price.toLocaleString()} หักภาษี ${(r.tax ?? saleTax(r.price)).toLocaleString()} · ผู้ซื้อ ${esc(r.buyer ?? '')})</span>`
          : `<span class="mkt-dim">${r.status === 'expired' ? 'หมดเวลา' : 'ยกเลิกแล้ว'} — รับของคืน</span>`;
        return `<div class="mkt-row" data-id="${r.id}">${this.cell(r.entry)}` +
          `<div class="mkt-info"><div>${this.nameHtml(r.entry)}</div><div class="mkt-lines">${what}</div></div>` +
          `<button data-claim="${r.id}" class="primary">รับ</button></div>`;
      }).join('')
      : `<div class="mkt-empty">${guest ? 'Guest ซื้อขายในตลาดไม่ได้' : 'ไม่มีของรอรับ'}</div>`;
    $<HTMLButtonElement>('mkt-claimall').disabled = !m?.box.length;
    if (this.tab === 'sell') this.renderSellForm();
  }

  // ------------------------------------------------------------ listing

  private pick(i: number): void {
    this.sellI = i;
    this.renderSellForm();
    this.host.markInventory();
    void this.loadRef();
  }

  /** Asks for the lowest price now and the recent sold price of what is picked (once per kind of item). */
  private async loadRef(): Promise<void> {
    const e = this.sellI >= 0 ? this.g.player.bag[this.sellI] : null;
    if (!marketSellable(e) || this.g.backend.guest) {
      this.refFor = '';
      this.ref = null;
      return;
    }
    const key = isItem(e) ? `i${marketKind(e)}|${e.name}` : `s${e.stone}`;
    if (key === this.refFor) return;
    this.refFor = key;
    this.ref = null;
    this.renderRef();
    // The server drops anything that follows another market call within 100 ms (silently): wait, and retry once.
    let r: MarketReply = { ok: false };
    for (let tries = 0; tries < 3 && this.refFor === key; tries++) {
      await new Promise((res) => setTimeout(res, tries ? 1200 : 250));
      if (this.refFor !== key || this.sellI < 0 || !marketSellable(this.g.player.bag[this.sellI])) return;
      r = await this.call({ a: 'mktPrice', i: this.sellI });
      if (r.ok || (r.msg && r.msg !== MARKET_THROTTLE_MSG)) break;
    }
    if (this.refFor !== key) return;
    if (r.ok && r.priceRef) this.ref = r.priceRef;
    else {
      this.refFor = '';
      const el = document.getElementById('mkt-ref');
      if (el) el.innerHTML = '<span class="mkt-dim">ดูราคาตลาดไม่ได้ในตอนนี้</span>';
      return;
    }
    this.renderRef();
  }

  private renderRef(): void {
    const el = document.getElementById('mkt-ref');
    if (!el) return;
    const e = this.sellI >= 0 ? this.g.player.bag[this.sellI] : null;
    if (!marketSellable(e)) return;
    const unit = isStone(e) ? `/${stoneUnit(e.stone)}` : '';
    const g = (n: number | null, none: string) => (n === null ? `<span class="mkt-dim">${none}</span>` : `<b>${n.toLocaleString()} G${unit}</b>`);
    el.innerHTML = this.ref
      ? `ราคาต่ำสุดที่ขายอยู่ตอนนี้: ${g(this.ref.lowest, 'ยังไม่มีใครขาย')} · ` +
        `ขายได้ล่าสุด${this.ref.soldN ? ` (เฉลี่ย ${this.ref.soldN} ครั้ง)` : ''}: ${g(this.ref.sold, 'ยังไม่เคยขายได้')}`
      : '<span class="mkt-dim">กำลังดูราคาตลาด…</span>';
  }

  // ------------------------------------------------------------ bag right-click menu (near the broker)

  /** Right click on a bag item while standing at the broker with the window closed: list it, find its kind, or drop it. */
  bagMenu(i: number, ev: MouseEvent, drop: () => void): void {
    this.closeMenu();
    const e = this.g.player.bag[i];
    if (!marketSellable(e)) return drop();
    const m = document.createElement('div');
    m.className = 'mkt-ctx';
    const add = (label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = () => {
        this.closeMenu();
        fn();
      };
      m.appendChild(b);
    };
    add('ลงขายในตลาด', () => {
      if (this.g.backend.guest) return this.host.log('Guest ซื้อขายในตลาดไม่ได้ — สมัครสมาชิกเพื่อใช้ตลาด', ERR);
      this.tab = 'sell';
      this.open();
      this.pick(i);
    });
    add('หาชิ้นแบบนี้ในตลาด', () => this.searchLike(i));
    add('วางลงพื้น', drop);
    m.style.left = `${Math.min(ev.clientX, window.innerWidth - 190)}px`;
    m.style.top = `${Math.min(ev.clientY, window.innerHeight - 110)}px`;
    document.body.appendChild(m);
    this.menu = m;
    // Any click elsewhere (or Escape) closes it; listeners are added after this very click finishes.
    setTimeout(() => {
      const off = (x: Event) => {
        if (x instanceof KeyboardEvent && x.key !== 'Escape') return;
        if (x.target instanceof Node && m.contains(x.target)) return;
        this.closeMenu();
        document.removeEventListener('mousedown', off, true);
        document.removeEventListener('keydown', off, true);
      };
      document.addEventListener('mousedown', off, true);
      document.addEventListener('keydown', off, true);
    });
  }

  private closeMenu(): void {
    this.menu?.remove();
    this.menu = null;
  }

  /** Opens the Buy tab searching for this kind of item: same category and name, nothing else filtered. */
  private searchLike(i: number): void {
    const e = this.g.player.bag[i];
    if (!marketSellable(e)) return;
    this.kind = marketKind(e);
    this.cls = null;
    this.rarities.clear();
    this.stats = [];
    for (const id of ['mkt-lvmin', 'mkt-lvmax', 'mkt-plus', 'mkt-pmax']) $<HTMLInputElement>(id).value = '';
    $<HTMLInputElement>('mkt-fit').checked = false;
    $<HTMLSelectElement>('mkt-sort').value = 'priceAsc';
    $<HTMLInputElement>('mkt-name').value = (isItem(e) ? e.name : STONE_NAME[e.stone]).slice(0, 30);
    this.renderFilters();
    this.tab = 'buy';
    if (this.isOpen) this.showTab('buy');
    else this.open();
  }

  /** The bag slot picked for listing (the bag outlines it). */
  get picked(): number {
    return this.isOpen ? this.sellI : -1;
  }

  private priceInput(): number | null {
    const el = document.getElementById('mkt-price') as HTMLInputElement | null;
    const v = Number(el?.value);
    return el && Number.isInteger(v) && v >= 1 && v <= MARKET_PRICE_MAX ? v : null;
  }

  private renderSellForm(): void {
    const form = $('mkt-sellform');
    const e = this.sellI >= 0 ? this.g.player.bag[this.sellI] : null;
    if (this.g.backend.guest) {
      form.innerHTML = '';
      return;
    }
    if (!marketSellable(e)) {
      form.innerHTML = `<div class="mkt-help">คลิกขวาที่อุปกรณ์หรือหินในกระเป๋าเพื่อเลือกมาลงขาย<br>` +
        `<small>ค่าลงขาย ${MARKET_FEE_PCT}% (ไม่คืน) · ภาษีเมื่อขายได้ ${MARKET_TAX_PCT}% · วางขาย ${MARKET_HOURS} ชม. · ` +
        `ลงขายพร้อมกันได้ ${MARKET_SLOTS} ชิ้นต่อบัญชี · ยาลงขายไม่ได้</small></div>`;
      return;
    }
    const keep = (document.getElementById('mkt-price') as HTMLInputElement | null)?.value ?? '';
    form.innerHTML = `<div class="mkt-row">${this.cell(e)}<div class="mkt-info"><div>${this.nameHtml(e)}</div>` +
      `<div class="mkt-lines">${this.statLine(e)}</div></div></div>` +
      `<div class="mkt-line"><span>ราคา</span><input id="mkt-price" type="number" min="1" max="${MARKET_PRICE_MAX}" step="1" placeholder="ราคา (G)" value="${esc(keep)}" class="wide">` +
      `<button id="mkt-listgo" class="primary">ลงขาย</button><button id="mkt-listcancel">ไม่ขาย</button></div>` +
      `<div id="mkt-ref" class="mkt-ref"></div><div id="mkt-fee" class="mkt-small"></div>`;
    this.renderRef();
    this.renderFee();
    (document.getElementById('mkt-price') as HTMLInputElement).focus();
  }

  private renderFee(): void {
    const el = document.getElementById('mkt-fee');
    if (!el) return;
    const price = this.priceInput();
    el.innerHTML = price
      ? `ค่าลงขาย ${MARKET_FEE_PCT}%: <b>${listingFee(price).toLocaleString()} G</b> (จ่ายตอนนี้ ไม่คืน) · ` +
        `ภาษีเมื่อขายได้ ${MARKET_TAX_PCT}%: ${saleTax(price).toLocaleString()} G · ` +
        `ได้รับจริงเมื่อขายได้ <b style="color:${GOLD}">${sellerGets(price).toLocaleString()} G</b>`
      : `ใส่ราคา 1 – ${MARKET_PRICE_MAX.toLocaleString()} G`;
  }

  // ------------------------------------------------------------ tooltips

  private tipOn(el: HTMLElement, rows: () => readonly MarketRow[], hint: string): void {
    el.addEventListener('mousemove', (e) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.cell')) return this.host.hideTip();
      const id = Number(t.closest<HTMLElement>('[data-id]')?.dataset.id);
      const row = rows().find((r) => r.id === id);
      if (!row) return this.host.hideTip();
      if (isStone(row.entry)) this.host.showStoneTip(row.entry, e, hint);
      else this.host.showTip(row.entry, e, hint);
    });
    el.addEventListener('mouseleave', () => this.host.hideTip());
  }
}
