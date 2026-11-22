import { SPACE_COLOUR } from './island';
import { placeLabel } from '../shared/channels';
import type { Game } from './Game';
import { NPC_USE_RANGE, type NpcId } from '../shared/data/npcs';
import { LEARNABLE_SKILLS, type SkillSlot } from '../shared/data/classes';
import { keyLabel, keyOf, onKeysChange } from './keybinds';
import { reachRadius, reachText } from '../shared/data/skillRanges';
import { rankedDmg, skillParamLines, skillReach } from '../shared/skillBook';
import { effectiveStats, enhanceBonus, itemName, plusOf, sellValue } from '../shared/data/enhance';
import {
  entryName, POTION_SIZE_LABEL, POTION_STACK, potionHeal, potionName, potionSellPrice, stackLimit,
} from '../shared/data/potions';
import { BUFF_LABEL, MONSTER_STONES, RETURN_CAST, STONE_COLOR, STONE_DESC, STONE_NAME, STONE_STACK, stoneSellPrice, stoneUnit } from '../shared/data/stones';
import { lootPots, type Buffs, type LootFilter, type SortKey } from '../shared/sim/Player';
import { MONSTERS } from '../shared/data/monsters';
import { currentBalance } from '../shared/balance';
import { ZONE_1 } from '../shared/data/zones';
import { expToNext } from '../shared/formulas';
import { blockingGate } from '../shared/data/bossGates';
import {
  BUFF_SCROLLS, isBossKey, isBound, isBoundKind, isBuffScroll, isConsumable, isOrbStone, isItem, isPotion, isStack, isStone, sameStack, RARITIES, RARITY_COLOR, RARITY_LABEL, EQUIP_SLOTS, EQUIP_SLOT_LABEL, SLOT_LABEL, STAT_KEYS, STAT_LABEL, wornPlaces,
  type BagEntry, type Item, type PotionKind, type PotionStack, type StoneStack, type EquipSlot, type StatKey,
} from '../shared/types';
import { drawEdgeMarker, drawMapIcon, drawPin, facingAngle, partyDot } from './mapIcons';
import type { MapIcon } from './mapIconNames';
import { NPC_MAP_ICON } from './fullmap';
import { MarketWindow } from './market';
import { playSound } from './audio/sfx';
import { COIN_ICON, emptySlotIcon, itemIcon, potionIcon, skillIcon, stoneIcon } from './icons';
import { shutdownCancelled, shutdownWarning, type ShutdownMode } from '../shared/net/protocol';
import { isTouchMode, onPointerModeChange } from './touch/device';
import { FashionBag } from './fashionBag';
import { imgUrl } from './img';
import { $, entryColor, lineHtml, POTION_COLOR, potionTotals, potToggles, readPots, syncPots } from './ui/hudShared';
import { ForgeWindow } from './ui/forge';
import { ShopWindow } from './ui/shop';
import { StashWindow } from './ui/stash';
import { AutoSettingsWindow } from './ui/autoSettings';
import { MapWindow } from './ui/mapWindow';
import { ItemDetail } from './ui/itemDetail';

/** Yellow, like the game's level-up lines. */
const SHUTDOWN_COLOR = '#ffd34a';
/** How long an owner's announcement banner stays up. */
const ANNOUNCE_MS = 10_000;

/** Lines of chat and messages kept for scrolling back (with the chat open); while playing only the newest 9 show (style.css). */
const LOG_KEEP = 50;
/** Sockets whose empty look is their name, not a faded item picture (none: every slot has its picture now). */
const TEXT_SOCKETS: EquipSlot[] = [];

/** The minimap's size on screen, and pixels per world unit. Its canvas holds twice that, to stay sharp. */
const MINIMAP_SIZE = 176;
/** Zoom levels of the minimap (pixels per world unit): far, normal, near. The + and − buttons step through them. */
const MINIMAP_ZOOMS = [1.8, 2.6, 3.8];
const MINIMAP_ZOOM_KEY = 'multiverse-minimap-zoom';
const BAG_SIDE_KEY = 'multiverse-bag-side-collapsed';

type HudStyle = 'orbs' | 'bars';
const HUD_STYLE_KEY = 'multiverse-hud-style';

function loadHudStyle(): HudStyle {
  try {
    return localStorage.getItem(HUD_STYLE_KEY) === 'bars' ? 'bars' : 'orbs';
  } catch {
    return 'orbs';
  }
}

/** The label on each skill-bar button: the mouse for the basic attack, else the key the player has it on (keybinds.ts). */
const keyFor = (slot: SkillSlot | 'hp' | 'mp'): string => (slot === 'basic' ? 'LMB' : keyLabel(keyOf(slot)));
const POTION_CD = 1.5;

/** What the chat box starts with to whisper someone (quoted when the name has a space). */
export const whisperPrefix = (name: string): string => `/w ${name.includes(' ') ? `"${name}"` : name} `;

const SEEKER_LINES = [
  'ในที่สุดเจ้าก็ตื่นแล้ว… เจ้าคือผู้รอดชีวิตจากโลกที่ถูก The Devourer กลืนกิน',
  'ข้าคือ The Seeker ผู้ตามหาความจริงเบื้องหลังการล่มสลายของมิติทั้งหลาย ตั้งแต่ The Shattering แยก The First Cosmos ออกเป็นเสี่ยง ๆ',
  'แสงสีทองขาวที่พาเจ้ามาที่นี่… ข้าเคยเห็นมันในบันทึกโบราณที่เรียกว่า The Origin',
  'ที่นี่คือเมืองศูนย์กลางมิติ จุดเชื่อมของเศษเสี้ยวมิติที่ยังรอด สี่มุมของเกาะมีประตูสู่ดินแดนต่าง ๆ แต่สัตว์ในนั้นเริ่มคลุ้มคลั่งจากพลังที่รั่วไหล',
  'เหนื่อยเมื่อไหร่ ให้มาดื่มน้ำจากน้ำพุกลางเมือง หรือนั่งพักข้างกองไฟในแคมป์ของแต่ละดินแดน กด T เมื่ออยู่ใกล้ เลือดและมานาจะกลับมาเต็ม',
  'จงเริ่มฝึกฝนที่ป่ามรกต ผ่านประตูมุมบนของเมือง ลึกเข้าไปในป่ามีหมีใหญ่ที่ถูกพลังนั้นครอบงำ หากเจ้าปราบมันได้ เราจะได้เบาะแสแรกของ The Origin',
];

/** Ping colours: green below PING_GOOD_MS, yellow below PING_OK_MS, red from there on. */
const PING_GOOD_MS = 100;
const PING_OK_MS = 250;

export class Hud {
  dialogOpen = false;
  /** Index into MINIMAP_ZOOMS. */
  private mmZoom = 1;
  private slotEls: { kind: SkillSlot | PotionKind; el: HTMLElement; cd: HTMLElement; extra: HTMLElement }[] = [];
  private invDirty = true;
  /** The fashion page of the bag window (owned cosmetics). */
  private fashion!: FashionBag;
  private bagOpen = false;
  /** Level the bag was last drawn for (gear above it is marked as locked). */
  private drawnLevel = 0;
  /** Last buff row drawn (redrawn only when a second ticks over). */
  private drawnBuffs = '';
  /** A bag or stash item being dragged with the mouse (ghost appears once the mouse moves a few pixels). */
  private drag: { src: 'bag' | 'stash' | 'equip'; i: number; x: number; y: number; ghost: HTMLElement | null } | null = null;
  /** True right after a drag ends, so the click that follows mouseup does nothing. */
  private justDragged = false;
  private mmT = 0;
  private readonly mm: CanvasRenderingContext2D;
  private dialogIdx = 0;
  private confirmYes: (() => void) | null = null;
  /** Set while the amount dialog (stack split / partial sell) is open. */
  private amountDone: ((n: number) => void) | null = null;

  private readonly market: MarketWindow;
  /** NPC windows and other windows split out of this file (src/client/ui/). */
  private readonly forge: ForgeWindow;
  private readonly shop: ShopWindow;
  private readonly stash: StashWindow;
  private readonly autoSet: AutoSettingsWindow;
  private readonly map: MapWindow;
  private readonly detail: ItemDetail;
  /** The chat history tab picked last ('all', 'chat', 'system', 'party' or 'whisper'). */
  private chatTab = 'all';
  /** Who whispered you last ("/r" answers them). */
  private lastWhisperFrom = '';
  /** Who you whispered with last, either way (plain text in the whisper tab goes to them). */
  private whisperWith = '';

  constructor(private readonly g: Game) {
    // The skill-buff icons over the skill bar (owner 2026-11-19): point at one for that skill's details and time left.
    const barBuffs = $('bar-buffs');
    const buffTip = (e: MouseEvent) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('.vbuff');
      if (cell?.dataset.skill) this.showBuffTip(cell.dataset.skill, e);
      else this.hideTip();
    };
    barBuffs.addEventListener('mouseover', buffTip);
    barBuffs.addEventListener('mousemove', buffTip);
    barBuffs.addEventListener('mouseleave', () => this.hideTip());
    this.market = new MarketWindow(g, this);
    this.shop = new ShopWindow(g, this);
    this.stash = new StashWindow(g, this);
    this.forge = new ForgeWindow(g, this);
    this.autoSet = new AutoSettingsWindow(g);
    this.map = new MapWindow(g);
    this.detail = new ItemDetail(g, this, { forge: this.forge, shop: this.shop, stash: this.stash, market: this.market });
    $('hud').classList.remove('hidden');
    this.mm = $<HTMLCanvasElement>('minimap').getContext('2d')!;
    this.hudStyle = loadHudStyle();
    this.applyHudStyle();
    onPointerModeChange(() => this.applyHudStyle());
    // Big enough to show up late on first opening the bag, so it's fetched now.
    new Image().src = imgUrl('assets/sprites/ui/inventory.png');
    $('btn-hud-style').onclick = () => this.setHudStyle(this.hudStyle === 'orbs' ? 'bars' : 'orbs');
    try {
      const saved = Number(localStorage.getItem(MINIMAP_ZOOM_KEY));
      if (Number.isInteger(saved) && saved >= 0 && saved < MINIMAP_ZOOMS.length) this.mmZoom = saved;
    } catch {
      // Blocked storage only means the zoom isn't remembered.
    }
    this.syncMinimapZoom();
    $('minimap').onclick = () => this.toggleMap(true);
    $('mm-search').onclick = () => this.toggleMap(true);
    $('mm-plus').onclick = () => this.setMinimapZoom(this.mmZoom + 1);
    $('mm-minus').onclick = () => this.setMinimapZoom(this.mmZoom - 1);
    $('hud-name').textContent = g.player.name;
    this.showZoneName();
    $('hud-online').classList.toggle('hidden', !g.backend.online);
    $('hud-guest').classList.toggle('hidden', !g.backend.guest);
    this.buildSkillbar();
    onKeysChange(() => this.buildSkillbar());

    $('btn-auto').onclick = () => g.toggleAuto();
    $('btn-bag').onclick = () => this.toggleBag();
    $('btn-help').onclick = () => this.toggleHelp();
    $('btn-respawn').onclick = () => g.respawn();
    $('inv-close').onclick = () => this.toggleBag(false);
    this.fashion = new FashionBag(g, () => this.hideTip());
    // Fold the bag's left panel away (and back); remembered in this browser only.
    const bagBox = $('inventory');
    const sideBtn = $('inv-side-toggle');
    const setSide = (collapsed: boolean): void => {
      bagBox.classList.toggle('side-collapsed', collapsed);
      sideBtn.textContent = collapsed ? '▶' : '◀';
      const tip = collapsed ? 'แสดงแผงค่าสถานะ' : 'พับแผงค่าสถานะ';
      sideBtn.title = tip;
      sideBtn.setAttribute('aria-label', tip);
    };
    let sideCollapsed = false;
    try {
      sideCollapsed = localStorage.getItem(BAG_SIDE_KEY) === '1';
    } catch {
      /* storage blocked: start with the panel shown */
    }
    setSide(sideCollapsed);
    sideBtn.onclick = () => {
      sideCollapsed = !sideCollapsed;
      setSide(sideCollapsed);
      try {
        localStorage.setItem(BAG_SIDE_KEY, sideCollapsed ? '1' : '0');
      } catch {
        /* storage blocked: only this session remembers */
      }
    };
    $('help-close').onclick = () => this.toggleHelp(false);
    $('dialog').onclick = () => this.advanceDialog();
    $('btn-reconnect').onclick = () => location.reload();
    const chat = $<HTMLInputElement>('chat-input');
    // History tabs (shown while the chat is open): everything, players' chat only, or the game's own lines.
    for (const b of $('log-tabs').querySelectorAll<HTMLButtonElement>('[data-tab]')) {
      b.addEventListener('mousedown', (e) => e.preventDefault()); // keep typing in the chat box
      b.onclick = () => {
        const log = $('log');
        log.classList.remove('tab-chat', 'tab-system', 'tab-party', 'tab-whisper');
        this.chatTab = b.dataset.tab ?? 'all';
        if (b.dataset.tab !== 'all') log.classList.add(`tab-${b.dataset.tab}`);
        for (const o of $('log-tabs').querySelectorAll('[data-tab]')) o.classList.toggle('active', o === b);
        log.scrollTop = log.scrollHeight;
      };
    }
    chat.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const text = chat.value.trim();
        // The party tab sends to the party; "/p text" does from any tab. Whispers: "/w Name text"
        // ("/w "Two Words" text" for a name with a space), "/r text" answers the last whisper, and the
        // whisper tab sends plain text to whoever you whispered with last.
        const p = /^\/p\s+/i.exec(text);
        const w = /^\/w\s+(?:"([^"]+)"|(\S+))\s+([\s\S]+)$/i.exec(text);
        const r = /^\/r\s+([\s\S]+)$/i.exec(text);
        if (p) g.backend.chat(text.slice(p[0].length), true);
        else if (w) g.backend.whisper((w[1] ?? w[2]).trim(), w[3]);
        else if (/^\/w(\s|$)/i.test(text)) this.log('กระซิบ: พิมพ์ /w ชื่อ ข้อความ (ชื่อที่มีเว้นวรรคใส่ "…")', '#e6a0ff');
        else if (r || (text && this.chatTab === 'whisper' && !text.startsWith('/'))) {
          const to = r ? this.lastWhisperFrom : this.whisperWith;
          if (to) g.backend.whisper(to, r ? r[1] : text);
          else this.log(r ? 'ยังไม่มีใครกระซิบหาคุณ' : 'ยังไม่ได้เลือกคนกระซิบ — พิมพ์ /w ชื่อ ข้อความ', '#e6a0ff');
        } else if (text) g.backend.chat(text, this.chatTab === 'party');
        this.closeChat();
      } else if (e.key === 'Escape') this.closeChat();
    });
    chat.addEventListener('blur', () => this.closeChat());

    const bag = $('bag-grid');
    this.setupDrag(bag, 'bag');
    this.setupDragEnd();
    // Touch: a tap opens the item's detail sheet with buttons, since a phone has no hover or right click.
    bag.addEventListener('click', (e) => {
      if (!isTouchMode() || this.justDragged) return;
      const i = this.cellIndex(e);
      if (i < 0 || !g.player.bag[i]) return;
      e.stopImmediatePropagation();
      this.detail.openDetail({ bag: i });
    }, true);
    bag.addEventListener('click', (e) => {
      if (this.justDragged) return;
      const i = this.cellIndex(e);
      if (i < 0) return;
      const entry = g.player.bag[i];
      // While trading a click offers the item (all of it; Shift+drag onto the trade window offers part of a stack).
      if (g.trade.open) {
        if (entry) g.trade.offer(i);
        return;
      }
      if (isStone(entry)) {
        if (entry.stone === 'return_scroll') g.useReturnScroll();
        else if (isBuffScroll(entry.stone)) g.backend.useBuffScroll(entry.stone);
        else if (entry.stone === 'megaphone') g.megaphone.toggle(true);
        else if (entry.stone === 'mystery_box') g.backend.openBox(i, false);
        else if (isOrbStone(entry.stone)) g.backend.useOrbItem(i);
        return;
      }
      // At the blacksmith a click on gear puts it in the forge's slot instead of wearing it.
      if (this.forge.isOpen && isItem(entry)) {
        this.hideTip();
        this.forge.forgePlace(entry);
        return;
      }
      const block = isItem(entry) ? g.player.equipBlock(entry) : null;
      if (block && isItem(entry)) {
        this.log(`ใส่ ${itemName(entry)} ไม่ได้ — ${block}`, '#ff8a6a');
        return;
      }
      g.backend.equip(i);
      if (isPotion(entry)) this.log(`ปุ่ม ${entry.potion === 'hp' ? 1 : 2} จะใช้${potionName(entry.potion, entry.size)}`, '#9fd8ff');
      this.hideTip();
      this.markInventory();
    });
    bag.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const i = this.cellIndex(e);
      const item = i >= 0 ? g.player.bag[i] : null;
      if (!item) return;
      this.hideTip();
      if (g.trade.open) {
        g.trade.offer(i);
        return;
      }
      if (this.stash.isOpen) {
        g.backend.stashPut(i, -1);
        this.markInventory();
        return;
      }
      if (this.market.isOpen) {
        this.market.bagRightClick(i);
        return;
      }
      const name = `<b style="color:${entryColor(item)}">${entryName(item)}</b>`;
      if (this.shop.isOpen) {
        this.shop.sellFromBag(i);
        return;
      }
      // A mystery box: right click opens the whole stack (owner 2026-11-22).
      if (isStone(item) && item.stone === 'mystery_box') {
        g.backend.openBox(i, true);
        return;
      }
      const dropAsk = () => this.askDrop(i);
      // Standing at the market broker: offer to list it or search for the same kind (the menu also has "drop").
      if (g.backend.npcDistance('broker') <= NPC_USE_RANGE) {
        this.market.bagMenu(i, e, dropAsk);
        return;
      }
      dropAsk();
    });
    bag.addEventListener('mousemove', (e) => {
      // On touch a tooltip popping up on the first tap makes iOS drop the tap's click.
      if (this.drag?.ghost || isTouchMode()) return;
      const i = this.cellIndex(e);
      const item = i >= 0 ? g.player.bag[i] : null;
      const right = this.stash.isOpen ? 'ฝากเข้าคลัง' : this.market.isOpen ? 'เลือกมาลงขายในตลาด' : this.shop.isOpen ? (isStack(item) ? 'ขายทั้งช่อง' : 'ขาย') : 'วางลงพื้น';
      const split = item && isStack(item) && item.count > 1 ? ' · Shift+ลาก: แบ่งกอง' : '';
      if (g.trade.open && item) {
        const part = isStack(item) && item.count > 1 ? ' · Shift+ลากไปที่หน้าต่างเทรด: เสนอบางส่วน' : '';
        this.showEntryTip(item, e, g.trade.offeredSlots().has(i) ? 'เสนออยู่ — เอาออกที่หน้าต่างเทรด' : `คลิก: เสนอในการเทรด${part}`);
        return;
      }
      if (isPotion(item)) this.showPotionTip(item, e, `คลิกซ้าย: ใช้กับปุ่มด่วน · คลิกขวา: ${right}${split}`);
      else if (isStone(item) && item.stone === 'mystery_box' && !this.stash.isOpen && !this.market.isOpen && !this.shop.isOpen) this.showStoneTip(item, e, `คลิกซ้าย: เปิด 1 กล่อง · คลิกขวา: เปิดทั้งกอง${split}`);
      else if (isStone(item)) this.showStoneTip(item, e, `${item.stone === 'return_scroll' ? 'คลิกซ้าย / ปุ่ม G: ใช้ · ' : isBuffScroll(item.stone) || item.stone === 'megaphone' || item.stone === 'mystery_box' || isOrbStone(item.stone) ? 'คลิกซ้าย: ใช้ · ' : ''}คลิกขวา: ${right}${split}`);
      else if (item) {
        const both = item.slot === 'ring' && g.player.equipment.ring && g.player.equipment.ring2;
        if (this.forge.isOpen) this.showTip(item, e, `คลิกซ้าย / ลาก: วางที่ช่างตีเหล็ก · คลิกขวา: ${right}`);
        else this.showTip(item, e, `คลิกซ้าย: สวมใส่${both ? ' (แทนแหวน 1 · ลากไปช่องแหวน 2 เพื่อแทนวงนั้น)' : ''} · คลิกขวา: ${right}`);
      }
      else this.hideTip();
    });
    bag.addEventListener('mouseleave', () => this.hideTip());

    // The bag's sort controls and the stash's always show the same choice.
    const sortDir = (desc: boolean) => {
      for (const b of [$('sort-dir'), $('stash-sort-dir')]) {
        b.dataset.desc = desc ? '1' : '0';
        b.textContent = desc ? 'มาก → น้อย' : 'น้อย → มาก';
      }
    };
    $('sort-dir').onclick = () => sortDir($('sort-dir').dataset.desc !== '1');
    $('stash-sort-dir').onclick = () => sortDir($('sort-dir').dataset.desc !== '1');
    const sortKeys = ['sort-key', 'stash-sort-key'].map((id) => $<HTMLSelectElement>(id));
    for (const sel of sortKeys) sel.addEventListener('change', () => sortKeys.forEach((o) => (o.value = sel.value)));
    const lf = $('loot-filter');
    lf.innerHTML = '<span>เก็บ</span>' +
      RARITIES.map((r) => `<label style="color:${RARITY_COLOR[r]}"><input type="checkbox" data-rarity="${r}">${RARITY_LABEL[r]}</label>`).join('') +
      potToggles();
    lf.addEventListener('change', () => {
      const rarities = RARITIES.filter((r) => lf.querySelector<HTMLInputElement>(`[data-rarity="${r}"]`)!.checked);
      this.sendLootFilter({ rarities, pots: readPots(lf) });
    });
    lf.title = 'ของ/ยาที่ไม่ได้ติ๊กจะไม่ถูกเก็บ (ทั้งตอน Auto และเดินเอง) · ทองเก็บเสมอ';
    // The same potion toggles in the Auto settings window.
    const ap = $('aset-pots');
    ap.innerHTML = potToggles();
    ap.addEventListener('change', () => this.sendLootFilter({ pots: readPots(ap) }));
    $('sort-go').onclick = () => {
      g.backend.sortBag($<HTMLSelectElement>('sort-key').value as SortKey, $('sort-dir').dataset.desc === '1');
      this.hideTip();
      this.markInventory();
    };

    const eq = $('equip-slots');
    const eqSlot = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.dataset.slot as EquipSlot | undefined;
    // Worn gear can only be dragged to the blacksmith's slot, so dragging starts only while it is open.
    eq.addEventListener('mousedown', (e) => {
      const slot = eqSlot(e);
      if (e.button !== 0 || !this.forge.isOpen || !slot || !g.player.equipment[slot]) return;
      e.preventDefault();
      this.drag = { src: 'equip', i: EQUIP_SLOTS.indexOf(slot), x: e.clientX, y: e.clientY, ghost: null };
    });
    eq.addEventListener('click', (e) => {
      if (!isTouchMode() || this.justDragged) return;
      const slot = eqSlot(e);
      if (!slot || !g.player.equipment[slot]) return;
      e.stopImmediatePropagation();
      this.detail.openDetail({ slot });
    }, true);
    eq.addEventListener('click', (e) => {
      if (this.justDragged) return;
      const slot = eqSlot(e);
      if (!slot) return;
      this.hideTip();
      if (this.forge.isOpen) {
        const item = g.player.equipment[slot];
        if (item) this.forge.forgePlace(item);
        return;
      }
      g.backend.unequip(slot);
      this.markInventory();
    });
    eq.addEventListener('mousemove', (e) => {
      if (this.drag?.ghost || isTouchMode()) return;
      const slot = eqSlot(e);
      const item = slot ? g.player.equipment[slot] : undefined;
      if (item) this.showTip(item, e, this.forge.isOpen ? 'คลิก / ลาก: วางที่ช่างตีเหล็ก' : 'คลิก: ถอดเก็บเข้ากระเป๋า');
      else this.hideTip();
    });
    eq.addEventListener('mouseleave', () => this.hideTip());

    const sg = $('stash-grid');
    this.setupDrag(sg, 'stash');
    sg.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const i = this.stashIndex(e);
      if (i < 0 || !g.player.stash.items[i]) return;
      this.hideTip();
      g.backend.stashTake(i, -1);
      this.markInventory();
    });
    sg.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-buyrow]')) return this.stash.buyStashRow();
      if (!isTouchMode() || this.justDragged) return;
      const i = this.stashIndex(e);
      if (i >= 0 && g.player.stash.items[i]) this.detail.openDetail({ stash: i });
    });
    sg.addEventListener('mousemove', (e) => {
      if (this.drag?.ghost) return;
      const i = this.stashIndex(e);
      const item = i >= 0 ? g.player.stash.items[i] : null;
      const hint = 'คลิกขวา: ย้ายเข้ากระเป๋า · ลากเพื่อย้าย' + (item && isStack(item) && item.count > 1 ? ' · Shift+ลาก: แบ่งกอง' : '');
      if (isPotion(item)) this.showPotionTip(item, e, hint);
      else if (isStone(item)) this.showStoneTip(item, e, hint);
      else if (item) this.showTip(item, e, hint);
      else this.hideTip();
    });
    sg.addEventListener('mouseleave', () => this.hideTip());

    $('confirm-yes').onclick = () => {
      const fn = this.confirmYes;
      this.closeConfirm();
      fn?.();
    };
    $('confirm-no').onclick = () => this.closeConfirm();

    // Amount dialog: the slider and the number box follow each other.
    const range = $<HTMLInputElement>('amount-range');
    const num = $<HTMLInputElement>('amount-num');
    range.oninput = () => (num.value = range.value);
    num.oninput = () => {
      const v = Math.floor(Number(num.value));
      if (Number.isFinite(v)) range.value = String(Math.max(1, Math.min(Number(range.max), v)));
    };
    const amountOk = () => {
      const fn = this.amountDone;
      const n = Number(num.value);
      if (!fn) return;
      // Out of range or not a whole number: keep the dialog open.
      if (!Number.isInteger(n) || n < 1 || n > Number(range.max)) {
        num.value = range.value;
        return;
      }
      this.closeAmount();
      fn(n);
    };
    $('amount-ok').onclick = amountOk;
    $('amount-cancel').onclick = () => this.closeAmount();
    for (const el of [range, num]) {
      el.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') amountOk();
        else if (e.key === 'Escape') this.closeAmount();
      });
    }

    this.log(`ยินดีต้อนรับสู่ ${g.zone.name} — กด H เพื่อดูวิธีควบคุม`, '#cfe8ff');
  }

  private showZoneName(): void {
    const z = this.g.zone;
    $('hud-zone').textContent = `${z.name} · ${z.nameTh}  (Lv.${z.levels[0]}–${z.levels[1]})`;
  }

  /** Called after walking through a portal. */
  onZoneChanged(): void {
    const z = this.g.zone;
    this.showZoneName();
    this.closePanels();
    this.markInventory();
    this.log(`เดินทางสู่ ${z.name} · ${placeLabel(z, this.g.backend.channel)} (Lv.${z.levels[0]}–${z.levels[1]})`, '#9fffd8');
    this.log(z.subtitle, '#b9c9c0');
  }

  /** The bag or stash slot list a drag started from. */
  private dragList(src: 'bag' | 'stash' | 'equip'): readonly (BagEntry | null)[] {
    const p = this.g.player;
    return src === 'bag' ? p.bag : src === 'stash' ? p.stash.items : EQUIP_SLOTS.map((s) => p.equipment[s] ?? null);
  }

  /** Starts dragging items out of the bag grid or the stash grid (bag cells carry data-i, stash cells data-s). */
  private setupDrag(grid: HTMLElement, src: 'bag' | 'stash'): void {
    grid.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const i = src === 'bag' ? this.cellIndex(e) : this.stashIndex(e);
      if (i < 0 || !this.dragList(src)[i]) return;
      e.preventDefault();
      this.drag = { src, i, x: e.clientX, y: e.clientY, ghost: null };
    });
  }

  /**
   * Drag & drop, for both grids:
   * - bag → another bag slot: swap places (the same potion merges up to a full stack)
   * - bag → the potion quick key (1 / 2): that key uses the dragged potion's size
   * - bag → the game world: drop it on the ground right away (no confirm)
   * - bag → the shop: sell · bag → a stash slot or the stash window: store it
   * - stash → another stash slot: swap / merge · stash → a bag slot or the bag window: take it out
   */
  private setupDragEnd(): void {
    const g = this.g;
    window.addEventListener('mousemove', (e) => {
      const d = this.drag;
      if (!d) return;
      if (!d.ghost) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
        const src = d.src === 'bag'
          ? $('bag-grid').querySelector<HTMLElement>(`[data-i="${d.i}"]`)
          : d.src === 'stash'
            ? $('stash-grid').querySelector<HTMLElement>(`[data-s="${d.i}"]`)
            : $('equip-slots').querySelector<HTMLElement>(`[data-slot="${EQUIP_SLOTS[d.i]}"]`);
        if (!src || !this.dragList(d.src)[d.i]) {
          this.drag = null;
          return;
        }
        const ghost = src.cloneNode(true) as HTMLElement;
        ghost.removeAttribute('data-i');
        ghost.removeAttribute('data-s');
        ghost.removeAttribute('data-slot');
        ghost.classList.add('drag-ghost');
        document.body.append(ghost);
        d.ghost = ghost;
        src.classList.add('dragging');
        this.hideTip();
      }
      d.ghost.style.left = `${e.clientX}px`;
      d.ghost.style.top = `${e.clientY}px`;
      this.markDropTarget(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', (e) => {
      const d = this.drag;
      this.drag = null;
      if (!d?.ghost) return;
      d.ghost.remove();
      this.markDropTarget(-1, -1);
      document.querySelector('.cell.dragging')?.classList.remove('dragging');
      this.justDragged = true;
      setTimeout(() => (this.justDragged = false), 0);
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const cell = target?.closest<HTMLElement>('#bag-grid [data-i]');
      const stashCell = this.stash.isOpen ? target?.closest<HTMLElement>('#stash-grid [data-s]') : null;
      // Gear dropped anywhere on the blacksmith's window goes into its slot (worn gear stays worn).
      const forge = this.forge.isOpen && d.src !== 'stash' ? target?.closest('#forge') : null;
      if (d.src === 'equip') {
        const worn = this.dragList('equip')[d.i];
        if (forge && worn) this.forge.forgePlace(worn);
        return;
      }
      if (forge) {
        const entry = g.player.bag[d.i];
        if (entry) this.forge.forgePlace(entry);
        return;
      }
      // While trading, dropping a bag item on the trade window offers it (Shift: part of a stack).
      if (d.src === 'bag' && g.trade.isTarget(target)) {
        const entry = g.player.bag[d.i];
        if (!entry) return;
        if (e.shiftKey && isStack(entry) && entry.count > 1) {
          const name = `<b style="color:${entryColor(entry)}">${entryName(entry)}</b>`;
          this.askAmount(`เสนอ ${name} กี่${isPotion(entry) ? 'ขวด' : 'ก้อน'}?`, entry.count, entry.count, (n) => g.trade.offer(d.i, n));
        } else g.trade.offer(d.i);
        return;
      }
      // Shift+drag a stack onto an empty slot (or the same stack): ask how many to move.
      if (e.shiftKey && this.splitDrag(d.src, d.i, cell, stashCell)) return;
      if (d.src === 'stash') {
        if (!g.player.stash.items[d.i]) return;
        if (stashCell) {
          const to = Number(stashCell.dataset.s);
          if (to !== d.i) g.backend.stashMove(d.i, to);
        } else if (cell) {
          g.backend.stashTake(d.i, Number(cell.dataset.i));
        } else if (target?.closest('#inventory .inv-window')) {
          g.backend.stashTake(d.i, -1);
        }
        this.markInventory();
        return;
      }
      const item = g.player.bag[d.i];
      if (!item) return;
      const socket = target?.closest<HTMLElement>('#equip-slots [data-slot]');
      const quick = target?.closest<HTMLElement>('.skill-hp, .skill-mp');
      const shop = this.shop.isOpen ? target?.closest<HTMLElement>('#shop') : null;
      if (socket) {
        this.equipByDrag(d.i, socket.dataset.slot as EquipSlot);
      } else if (stashCell) {
        g.backend.stashPut(d.i, Number(stashCell.dataset.s));
      } else if (this.stash.isOpen && target?.closest('#stash')) {
        g.backend.stashPut(d.i, -1);
      } else if (shop) {
        this.shop.sellFromBag(d.i);
      } else if (cell) {
        const to = Number(cell.dataset.i);
        if (to !== d.i) g.backend.moveInBag(d.i, to);
      } else if (quick) {
        const kind: PotionKind = quick.classList.contains('skill-hp') ? 'hp' : 'mp';
        if (isPotion(item) && item.potion === kind) {
          g.backend.equip(d.i);
          this.log(`ปุ่ม ${kind === 'hp' ? 1 : 2} จะใช้${potionName(item.potion, item.size)}`, '#9fd8ff');
        } else {
          this.log('ลากยา HP ไปที่ปุ่ม 1 · ยา MP ไปที่ปุ่ม 2', '#ff8a6a');
        }
      } else if (target === g.renderer.domElement) {
        g.dropFromBag(d.i);
        if (this.forge.isOpen) this.forge.renderForge();
      }
      this.markInventory();
    });
  }

  /**
   * Shift+drag of a stack (2 or more) onto a bag/stash slot that is empty or holds the same stack with room:
   * opens the amount dialog and moves that many. Returns false (normal drag rules apply) when it doesn't fit that.
   */
  splitDrag(from: 'bag' | 'stash', i: number, cell: HTMLElement | null | undefined, stashCell: HTMLElement | null | undefined): boolean {
    const to: 'bag' | 'stash' | null = stashCell ? 'stash' : cell ? 'bag' : null;
    const j = stashCell ? Number(stashCell.dataset.s) : cell ? Number(cell.dataset.i) : -1;
    if (!to || (from === to && i === j)) return false;
    const a = this.dragList(from)[i];
    if (!isStack(a) || a.count < 2) return false;
    const b = this.dragList(to)[j];
    let max = a.count - 1;
    if (b) {
      if (!isStack(b) || !sameStack(a, b)) return false;
      max =Math.min(max, stackLimit(b) - b.count);
    }
    if (max < 1) return false;
    const name = `<b style="color:${entryColor(a)}">${entryName(a)}</b>`;
    this.askAmount(`ย้าย ${name} กี่${isPotion(a) ? 'ขวด' : 'ก้อน'}?`, max, Math.min(max, Math.ceil(a.count / 2)), (n) => {
      if (from === 'bag' && to === 'bag') this.g.backend.splitInBag(i, j, n);
      else this.g.backend.stashSplit(from, i, to, j, n);
      this.markInventory();
    });
    return true;
  }

  /** Highlights whatever the dragged item would land on. Pass (-1, -1) to clear. */
  private markDropTarget(x: number, y: number): void {
    document.querySelector('.drop-target')?.classList.remove('drop-target');
    if (x < 0) return;
    const t = document.elementFromPoint(x, y) as HTMLElement | null;
    if (this.forge.isOpen && this.drag?.src !== 'stash' && t?.closest('#forge')) {
      $('forge-slot').classList.add('drop-target');
      return;
    }
    if (this.drag?.src === 'equip') return;
    let sel = '#bag-grid [data-i], .skill-hp, .skill-mp';
    if (this.drag?.src === 'stash') sel = '#stash-grid [data-s], #bag-grid [data-i], #inventory .inv-window';
    else if (this.stash.isOpen) sel += ', #stash-grid [data-s], #stash';
    else if (this.shop.isOpen) sel += ', #shop';
    const el = t?.closest<HTMLElement>(sel);
    el?.classList.add('drop-target');
  }

  private cellIndex(e: Event): number {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    return el ? Number(el.dataset.i) : -1;
  }

  private stashIndex(e: Event): number {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-s]');
    return el ? Number(el.dataset.s) : -1;
  }

  // ------------------------------------------------------------ build

  private buildSkillbar(): void {
    const bar = $('skillbar');
    bar.innerHTML = '';
    const add = (kind: SkillSlot | PotionKind, icon: string, key: string) => {
      const el = document.createElement('div');
      el.className = `skill skill-${kind}`;
      el.innerHTML = `<div class="icon">${icon}</div><div class="cd"></div><div class="key">${key}</div><div class="extra"></div>`;
      // The game's own tooltip, not the browser's `title`. Rebuilt on every move so the cooldown stays current.
      el.addEventListener('mouseenter', (e) => this.showSkillTip(kind, key, e));
      el.addEventListener('mousemove', (e) => this.showSkillTip(kind, key, e));
      el.addEventListener('mouseleave', () => {
        this.hideTip();
        this.g.showSkillRange(null);
      });
      bar.append(el);
      this.slotEls.push({ kind, el, cd: el.querySelector('.cd')!, extra: el.querySelector('.extra')! });
    };
    // Basic attack, the three loadout slots (their icons follow the skill worn, see update) and the dash.
    for (const slot of ['basic', 'q', 'e', 'r', 'dash'] as const) {
      const sk = this.g.player.skill(slot);
      add(slot, sk ? skillIcon(sk.id) : '', keyFor(slot));
    }
    add('hp', potionIcon('hp'), keyFor('hp'));
    add('mp', potionIcon('mp'), keyFor('mp'));
  }

  /** Tooltip for a skill-bar button (skill or potion); desktop only. Skills also ring their reach on the ground. */
  /** Tooltip of a skill buff running on us: the skill (rank and numbers when it is one of ours) and the time left. */
  private showBuffTip(id: string, e: MouseEvent): void {
    if (isTouchMode()) return;
    const p = this.g.player;
    const tip = $('tooltip');
    const sk = LEARNABLE_SKILLS.find((x) => x.sk.id === id)?.sk;
    const buff = p.shownBuffs.find((b) => b.id === id);
    if (!sk || !buff) {
      this.hideTip();
      return;
    }
    const left = Math.max(0, buff.left - (performance.now() / 1000 - p.shownBuffsAt));
    // A party member's buff: its numbers depend on their rank, which we don't know, so only its description.
    const rank = p.skillRank(sk);
    const lines = rank > 0 ? skillParamLines(sk, rank).map((l) => `<div><span class="tt-val">${l}</span></div>`).join('') : '';
    tip.innerHTML =
      `<div class="tt-name">${sk.name} (${sk.nameTh})</div>` +
      `<div class="tt-sub">บัพที่ได้รับ${rank > 0 ? ` · แรงก์ ${rank}` : ''}</div>` +
      `<div class="tt-stats"><div>${sk.desc}</div>${lines}</div>` +
      `<div class="tt-hint">เหลือ ${left.toFixed(1)} วิ (จาก ${buff.total.toFixed(1)} วิ)</div>`;
    this.placeTip(tip, e);
  }

  private showSkillTip(kind: SkillSlot | PotionKind, key: string, e: MouseEvent): void {
    if (isTouchMode()) return;
    const p = this.g.player;
    const tip = $('tooltip');
    if (kind === 'hp' || kind === 'mp') {
      const size = p.potionToUse(kind) ?? p.potSel[kind];
      tip.innerHTML =
        `<div class="tt-name" style="color:${POTION_COLOR[kind]}">${potionName(kind, size)}</div>` +
        `<div class="tt-sub">ยา · ปุ่ม ${key}</div>` +
        `<div class="tt-stats"><div>ฟื้น <span class="tt-val">${potionHeal(kind, size, p.cls.id)} ${kind.toUpperCase()}</span></div></div>` +
        `<div class="tt-hint">คลิกยาในกระเป๋าเพื่อเลือกขนาด</div>`;
      this.placeTip(tip, e);
      return;
    }
    const sk = p.skill(kind);
    if (!sk) {
      tip.innerHTML = `<div class="tt-name">ช่อง ${key} ว่าง</div><div class="tt-hint">กด K เปิดหน้าต่างสกิลเพื่อเรียนและใส่สกิล</div>`;
      this.placeTip(tip, e);
      return;
    }
    const reach = skillReach(sk);
    const stacks = p.chargeMax(sk);
    const held = p.chargesOf(sk);
    const remain = stacks ? (held < stacks ? p.cd[sk.id] ?? 0 : 0) : p.cd[sk.id] ?? 0;
    const rank = p.skillRank(sk);
    const full = p.skillCooldown(sk);
    const stats = [
      sk.kind === 'normal' || sk.kind === 'ult' ? `<div>แรงก์ <span class="tt-val">${rank}</span>${sk.dmg > 0 ? ` · ดาเมจ <span class="tt-val">${Math.round(rankedDmg(sk, rank) * 100)}% ATK</span>` : ''}</div>` : '',
      // The basic attack's damage and speed (tuned on /admin, owner 2026-11-20).
      sk.kind === 'basic' ? `<div>ดาเมจ <span class="tt-val">${Math.round(rankedDmg(sk, 1) * 100)}% ATK</span> · <span class="tt-val">${Math.round(p.attackRate * 100) / 100} ครั้ง/วิ</span></div>` : '',
      sk.mp ? `<div>MP <span class="tt-val">${p.skillMp(sk)}</span></div>` : '',
      full ? `<div>คูลดาวน์ <span class="tt-val">${full} วิ${stacks ? ' ต่อ 1 อัน' : ''}</span></div>` : '',
      stacks ? `<div>เก็บได้ <span class="tt-val">${held} / ${stacks} อัน</span></div>` : '',
      ...skillParamLines(sk, Math.max(1, rank)).map((l) => `<div><span class="tt-val">${l}</span></div>`),
      reach ? `<div><span class="tt-val">${reachText(reach)}</span></div>` : '',
    ].join('');
    tip.innerHTML =
      `<div class="tt-name">${sk.name} (${sk.nameTh})</div>` +
      `<div class="tt-sub">ปุ่ม ${key}</div>` +
      `<div class="tt-stats"><div>${sk.desc}</div>${stats}</div>` +
      (remain > 0 ? `<div class="tt-hint">คูลดาวน์เหลือ ${remain.toFixed(1)} วิ</div>` : '');
    this.placeTip(tip, e);
    this.g.showSkillRange(reach ? reachRadius(reach) : null);
  }

  // ------------------------------------------------------------ per-frame

  update(dt: number): void {
    const p = this.g.player;
    // Return-scroll cast bar, filling up over RETURN_CAST seconds.
    const cast = $('cast-bar');
    cast.classList.toggle('hidden', !(p.castT > 0));
    if (p.castT > 0) (cast.firstElementChild as HTMLElement).style.width = `${(1 - p.castT / RETURN_CAST) * 100}%`;
    this.drawBuffs(p.buffs);
    if (p.level !== this.drawnLevel) {
      this.drawnLevel = p.level;
      this.markInventory();
    }
    const need = expToNext(p.level);
    const hpShare = `${(Math.max(0, p.hp) / p.maxHp) * 100}%`;
    const mpShare = `${(p.mp / p.stats.maxMp) * 100}%`;
    const hpText = `${Math.ceil(Math.max(0, p.hp))} / ${Math.round(p.maxHp)}`;
    const mpText = `${Math.floor(p.mp)} / ${Math.round(p.stats.maxMp)}`;
    $('hp-fill').style.width = hpShare;
    // What is left of a skill's shield, in blue next to the HP (shown only while there is one).
    const shield = Math.ceil(p.shield);
    $('hp-text').textContent = shield > 0 ? `${hpText}  · โล่ ${shield}` : hpText;
    const orbShield = $('orb-hp-shield');
    orbShield.classList.toggle('hidden', shield <= 0);
    if (shield > 0) orbShield.textContent = `โล่ ${shield}`;
    $('mp-fill').style.width = mpShare;
    $('mp-text').textContent = mpText;
    $('hud').classList.toggle('orbs-near', currentBalance().fxLayer.orbsNearBar); // /admin can flip it live
    $('orb-hp-fill').style.height = hpShare;
    $('orb-hp-text').textContent = hpText;
    $('orb-mp-fill').style.height = mpShare;
    $('orb-mp-text').textContent = mpText;
    $('exp-fill').style.width = `${Math.min(1, p.exp / need) * 100}%`; // /admin can lower the EXP needed below what is held
    const gate = blockingGate(p.level, p.bossKills);
    $('exp-text').textContent = gate ? `EXP เต็ม — ต้องลงบอส ${gate.nameTh}` : `EXP ${((p.exp / need) * 100).toFixed(1)}%`;
    $('expbar').title = gate ? `ต้องลงบอส ${gate.nameTh} ก่อนถึงจะเลเวลเกิน ${gate.level} ได้ (EXP ที่เกินจะหายไป)` : '';
    $('hud-level').textContent = `Lv.${p.level} ${p.cls.name}`;
    $('hud-gold').textContent = `${p.gold.toLocaleString()} G`;
    if (this.g.backend.online) {
      $('hud-online').textContent = `🌐 ในแมพนี้ ${this.g.backend.hereCount} คน${isTouchMode() ? '' : ' · กด Enter เพื่อแชท'}`;
      // The whole server's count: the server sends it to owner and GM only.
      const all = this.g.backend.onlineCount;
      $('hud-online-all').classList.toggle('hidden', all === null);
      if (all !== null) $('hud-online-all').textContent = `🛡 ออนไลน์ทั้งหมด ${all} คน`;
    }
    this.showPing(this.g.backend.ping);

    for (const s of this.slotEls) {
      if (s.kind === 'hp' || s.kind === 'mp') {
        const size = p.potionToUse(s.kind) ?? p.potSel[s.kind];
        const count = p.potionCount(s.kind, size);
        s.extra.textContent = `${POTION_SIZE_LABEL[size]} ${count}`;
        const img = s.el.querySelector<HTMLImageElement>('.icon img');
        const src = imgUrl(`assets/sprites/icons/potion_${s.kind}_${size}.png`);
        if (img && img.getAttribute('src') !== src) img.setAttribute('src', src);
        s.el.title = `${potionName(s.kind, size)} — ฟื้น ${potionHeal(s.kind, size, p.cls.id)} ${s.kind.toUpperCase()}\nคลิกยาในกระเป๋าเพื่อเลือกขนาด`;
        s.cd.style.height = `${(Math.max(0, p.potCd) / POTION_CD) * 100}%`;
        s.el.classList.toggle('empty', count <= 0);
        continue;
      }
      const sk = p.skill(s.kind);
      // The skill worn on Q/E/R can change (skill window): swap the icon, empty slots show none.
      if (s.el.dataset.sk !== (sk?.id ?? '')) {
        s.el.dataset.sk = sk?.id ?? '';
        s.el.querySelector('.icon')!.innerHTML = sk ? skillIcon(sk.id) : '';
        s.el.classList.toggle('empty', !sk);
      }
      if (!sk) {
        s.cd.style.height = '0%';
        s.extra.textContent = '';
        continue;
      }
      const full = p.skillCooldown(sk);
      const stacks = p.chargeMax(sk);
      const held = p.chargesOf(sk);
      // A charge skill shows the charges left on the icon and the wheel of the one coming back.
      const remain = stacks ? (held < stacks ? p.cd[sk.id] ?? 0 : 0) : p.cd[sk.id] ?? 0;
      s.cd.style.height = full ? `${(remain / full) * 100}%` : '0%';
      s.extra.textContent = stacks ? `×${held}${held === 0 && remain > 0 ? ` ${remain.toFixed(1)}` : ''}` : remain > 0 ? remain.toFixed(1) : '';
      s.el.classList.toggle('nomp', p.mp < p.skillMp(sk));
    }

    const auto = $('btn-auto');
    auto.classList.toggle('active', this.g.autoPlay);
    auto.textContent = this.g.autoPlay ? 'AUTO: ON (F)' : 'AUTO: OFF (F)';

    const boss = this.g.monsters.find((m) => m.isBoss && m.alive && (m.isHostile || Math.hypot(m.x - p.x, m.z - p.z) < 16));
    const bb = $('boss-bar');
    bb.classList.toggle('hidden', !boss);
    if (boss) {
      $('boss-name').textContent = `Lv.${boss.level} ${boss.def.name}${boss.enraged ? ' — ENRAGED' : ''}`;
      $('boss-fill').style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    }

    if (this.shop.isOpen) {
      if (this.g.npcDistance('merchant') > NPC_USE_RANGE || !p.alive) this.shop.closeShop();
      else this.shop.renderShopMoney();
    }
    if (this.forge.isOpen && (this.g.npcDistance('blacksmith') > NPC_USE_RANGE || !p.alive)) this.forge.closeForge();
    this.market.update();
    if (this.stash.isOpen) {
      if (this.g.npcDistance('keeper') > NPC_USE_RANGE || !p.alive) this.stash.closeStash();
      else this.stash.renderStashMoney();
    }

    this.mmT -= dt;
    if (this.mmT <= 0) {
      this.mmT = 0.1;
      this.drawMinimap();
      this.map.redraw();
    }
    if ((this.bagOpen || this.stash.isOpen) && this.invDirty) this.renderInventory();
    if (this.bagOpen) this.fashion.update(this.shop.isOpen || this.stash.isOpen || this.forge.isOpen || this.market.isOpen || this.g.trade.open);
  }

  /** HP and MP as orbs in the bottom corners, or long bars at the top. The player picks; each browser remembers it. */
  private shownPing: number | null | undefined;

  /** "● 85 ms" under the minimap, coloured by how slow the connection is; "—" when disconnected. */
  private showPing(ms: number | null): void {
    if (ms === this.shownPing) return;
    this.shownPing = ms;
    // A pong overdue for 10 s or more: the connection has stalled, shown in whole seconds.
    $('hud-ping-ms').textContent = ms === null ? '—' : ms >= 10_000 ? `${Math.floor(ms / 1000)} s` : `${ms} ms`;
    const cls = ms === null ? 'ping-none' : ms < PING_GOOD_MS ? 'ping-good' : ms < PING_OK_MS ? 'ping-ok' : 'ping-bad';
    $('hud-ping').className = cls;
  }

  /** The player's HP/MP choice (orbs or bars). Touch play shows the bars whatever it is (owner 2026-11-11). */
  private hudStyle: HudStyle = 'orbs';

  private applyHudStyle(): void {
    const shown = isTouchMode() ? 'bars' : this.hudStyle;
    const hud = $('hud');
    hud.classList.toggle('hud-orbs', shown === 'orbs');
    hud.classList.toggle('hud-bars', shown === 'bars');
    hud.classList.toggle('orbs-near', currentBalance().fxLayer.orbsNearBar);
    $('btn-hud-style').textContent = this.hudStyle === 'orbs' ? 'HP/MP: ลูกแก้ว' : 'HP/MP: แถบ';
  }

  private setHudStyle(style: HudStyle): void {
    this.hudStyle = style;
    this.applyHudStyle();
    try {
      localStorage.setItem(HUD_STYLE_KEY, style);
    } catch {
      // Blocked storage only means the choice isn't remembered.
    }
  }

  private drawMinimap(): void {
    const ctx = this.mm;
    const W = MINIMAP_SIZE;
    const c = W / 2;
    const g = this.g;
    const p = g.player;
    const sc = MINIMAP_ZOOMS[this.mmZoom];
    const S = Math.SQRT1_2;
    const zoom = ctx.canvas.width / W;
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, c - 3, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = SPACE_COLOUR;
    ctx.fillRect(0, 0, W, W);
    // The zone's map picture, slid so the player sits in the middle.
    const world = g.world;
    const f = sc / world.mapScale;
    const [ix, iy] = world.mapAt(p.x, p.z);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(world.mapImage, c - ix * f, c - iy * f, world.mapImage.width * f, world.mapImage.height * f);
    const toMM = (x: number, z: number): [number, number] => {
      const dx = x - p.x;
      const dz = z - p.z;
      return [c + (dx - dz) * S * sc, c + (dx + dz) * S * sc];
    };
    const dot = (x: number, z: number, r: number, col: string) => {
      const [mx, my] = toMM(x, z);
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.stroke();
    };
    const icon = (name: MapIcon, x: number, z: number, size: number) => drawMapIcon(ctx, name, ...toMM(x, z), size);
    for (const l of g.loots) if (l.kind.type === 'item') dot(l.x, l.z, 2.4, RARITY_COLOR[l.kind.item.rarity]);
    let boss: { x: number; z: number } | null = null;
    for (const m of g.monsters) {
      if (!m.alive) continue;
      if (m.isBoss) boss = m;
      else if (m.isHostile) icon('fight', m.x, m.z, 12);
      else dot(m.x, m.z, 2.4, '#f2a640');
    }
    if (boss) icon('boss', boss.x, boss.z, 20);
    for (const pt of g.backend.zone.portals) icon('portal', pt.x, pt.z, 18);
    for (const r of g.backend.terrain.restSpots) icon('camp', r.x, r.z, 14);
    for (const n of g.npcs) icon(NPC_MAP_ICON[n.id], n.x, n.z, 15);
    for (const o of g.backend.players) {
      if (o !== p && !g.party.memberOf(o)) drawMapIcon(ctx, 'ally', ...toMM(o.x, o.z), 16, facingAngle(o.faceX, o.faceZ));
    }
    // Party members on this map, even far away (the snapshot carries them all): a green ring, kept on the edge when out of range.
    for (const m of g.party.mapMates()) {
      let [mx, my] = toMM(m.x, m.z);
      const d = Math.hypot(mx - c, my - c);
      const edge = c - 9;
      if (d > edge) {
        mx = c + ((mx - c) / d) * edge;
        my = c + ((my - c) / d) * edge;
      }
      partyDot(ctx, mx, my, 5);
    }
    // Where a map click is sending the player: the rest of the route and its end.
    const route = g.mapRoute;
    const rim = c - 3;
    if (route.length) {
      ctx.beginPath();
      ctx.moveTo(c, c);
      for (const pt of route) ctx.lineTo(...toMM(pt.x, pt.z));
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 243, 192, 0.9)';
      ctx.stroke();
      ctx.setLineDash([]);
      const end = route[route.length - 1];
      const [ex, ey] = toMM(end.x, end.z);
      if (Math.hypot(ex - c, ey - c) <= rim - 8) drawMapIcon(ctx, 'flag', ex, ey, 18);
      else drawEdgeMarker(ctx, c, rim, ex, ey, (x, y, s) => drawMapIcon(ctx, 'flag', x, y, s));
    }
    const pin = this.map.myPin();
    if (pin) {
      const [px, py] = toMM(pin.x, pin.z);
      if (Math.hypot(px - c, py - c) <= rim - 8) drawPin(ctx, px, py, 20);
      else drawEdgeMarker(ctx, c, rim, px, py, (x, y, s) => drawPin(ctx, x, y + s * 0.4, s * 1.1));
    }
    // Town NPCs and gates beyond the minimap's reach: a small icon on the rim, pointing their way.
    for (const pt of g.backend.zone.portals) drawEdgeMarker(ctx, c, rim, ...toMM(pt.x, pt.z), (x, y, s) => drawMapIcon(ctx, 'portal', x, y, s));
    for (const n of g.npcs) drawEdgeMarker(ctx, c, rim, ...toMM(n.x, n.z), (x, y, s) => drawMapIcon(ctx, NPC_MAP_ICON[n.id], x, y, s));
    drawMapIcon(ctx, 'player', c, c, 22, facingAngle(p.faceX, p.faceZ));
    ctx.restore();
    // A two-tone gold rim.
    for (const [width, colour] of [[6, '#2a1d0c'], [4, '#c9a85a'], [1, '#f6e3a1']] as const) {
      ctx.lineWidth = width;
      ctx.strokeStyle = colour;
      ctx.beginPath();
      ctx.arc(c, c, c - 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------ inventory

  markInventory(): void {
    this.invDirty = true;
    if (this.forge.isOpen) this.forge.renderForge();
  }

  toggleBag(force?: boolean): void {
    this.bagOpen = force ?? !this.bagOpen;
    $('inventory').classList.toggle('hidden', !this.bagOpen);
    if (!this.bagOpen) {
      this.hideTip();
      this.detail.closeDetail();
      this.fashion.reset();
    }
    this.invDirty = true;
  }

  toggleHelp(force?: boolean): void {
    $('help').classList.toggle('hidden', !(force ?? $('help').classList.contains('hidden')));
  }

  /** Change part of the loot filter, keeping the rest. */
  private sendLootFilter(change: Partial<LootFilter>): void {
    const cur = this.g.player.lootFilter;
    const pots = change.pots ?? lootPots(cur);
    this.g.backend.setLootFilter({
      rarities: change.rarities ?? [...cur.rarities],
      potions: pots.hp.length + pots.mp.length > 0,
      pots,
    });
    syncPots($('loot-filter'), this.g.player.lootFilter);
    syncPots($('aset-pots'), this.g.player.lootFilter);
  }

  private setMinimapZoom(i: number): void {
    this.mmZoom = Math.max(0, Math.min(MINIMAP_ZOOMS.length - 1, i));
    this.syncMinimapZoom();
    try {
      localStorage.setItem(MINIMAP_ZOOM_KEY, String(this.mmZoom));
    } catch {
      // Blocked storage only means the zoom isn't remembered.
    }
  }

  private syncMinimapZoom(): void {
    $<HTMLButtonElement>('mm-plus').disabled = this.mmZoom >= MINIMAP_ZOOMS.length - 1;
    $<HTMLButtonElement>('mm-minus').disabled = this.mmZoom <= 0;
  }

  // ------------------------------------------------------------ full map (ui/mapWindow.ts)

  toggleMap(force?: boolean): void {
    this.map.toggleMap(force);
  }

  // ------------------------------------------------------------ auto settings (ui/autoSettings.ts)

  toggleAutoSettings(force?: boolean): void {
    this.autoSet.toggleAutoSettings(force);
  }

  /** The range being typed while the settings window is open (clamped), else null. */
  autoRangePreview(): number | null {
    return this.autoSet.autoRangePreview();
  }

  /** Anything Esc would close: a window, the chat box or an NPC conversation (the system menu aside). */
  anyPanelOpen(): boolean {
    if (this.dialogOpen || !$('chat').classList.contains('hidden')) return true;
    return !!document.querySelector('#hud .panel:not(.hidden):not(#sys-menu)');
  }

  /** The amount dialog or a confirm box is up (Esc closes that first). */
  hasOverlay(): boolean {
    return !!this.amountDone || !!this.confirmYes;
  }

  closePanels(): void {
    if (this.amountDone) return this.closeAmount();
    if (this.confirmYes) return this.closeConfirm();
    if (this.detail.isOpen) return this.detail.closeDetail();
    this.closeChat();
    this.toggleAutoSettings(false);
    this.toggleMap(false);
    this.toggleBag(false);
    this.toggleHelp(false);
    this.g.skillWin.toggle(false);
    this.shop.closeShop();
    this.stash.closeStash();
    this.forge.closeForge();
    this.market.close();
    this.g.party.toggle(false);
    this.g.trade.toggleFind(false);
    this.g.mailUI.toggle(false);
    this.g.report.toggle(false);
    this.g.megaphone.toggle(false);
    this.g.daily.toggle(false);
    this.g.friends.toggle(false);
    this.g.cosmetics.toggle(false);
    this.g.quests.toggle(false);
    this.g.cashShop.toggle(false);
    this.g.channels.toggle(false);
    this.g.rooms.toggle(false);
    this.g.rooms.hideLobby();
    if (this.dialogOpen) this.closeDialog();
    this.g.tutorial.close();
  }

  talkTo(id: NpcId): void {
    // A tutorial step to take or hand in here: talk about it first (that window has a button on to the NPC's own).
    if (id !== 'seeker' && this.g.tutorial.wants(id)) return this.g.tutorial.show(id);
    this.openNpcWindow(id);
  }

  /** The NPC's own window (shop, stash, forge, market…), skipping the tutorial talk. */
  openNpcWindow(id: NpcId): void {
    // His key quests; his story is a button in that window.
    if (id === 'seeker') this.g.quests.toggle(true);
    else if (id === 'merchant') this.openShop();
    else if (id === 'keeper') {
      // The server refuses guests' stash actions too; this just says why up front.
      if (this.g.backend.guest) this.log('Guest ใช้คลังเก็บของไม่ได้ — สมัครสมาชิกเพื่อใช้คลัง (ตัวละครนี้จะย้ายไปอยู่ในบัญชีใหม่)', '#ffcf6a');
      else this.openStash();
    }
    else if (id === 'broker') this.openMarket();
    else if (id === 'stylist') this.g.cosmetics.toggle(true, 'shop');
    else if (id === 'crystal') this.g.cashShop.toggle(true);
    else this.openForge();
  }

  // ------------------------------------------------------------ confirm

  confirm(html: string, yesLabel: string, onYes: () => void): void {
    $('confirm-text').innerHTML = html;
    $('confirm-yes').textContent = yesLabel;
    this.confirmYes = onYes;
    $('confirm').classList.remove('hidden');
  }

  closeConfirm(): void {
    this.confirmYes = null;
    $('confirm').classList.add('hidden');
  }

  /** Asks "how many?" (1 to `max`, starting at `initial`) with a slider and a number box; `onOk` gets the whole number. */
  askAmount(html: string, max: number, initial: number, onOk: (n: number) => void): void {
    $('amount-text').innerHTML = html;
    for (const id of ['amount-range', 'amount-num']) {
      const el = $<HTMLInputElement>(id);
      el.max = String(max);
      el.value = String(Math.max(1, Math.min(max, initial)));
    }
    this.amountDone = onOk;
    $('amount').classList.remove('hidden');
    $<HTMLInputElement>('amount-num').focus();
  }

  private closeAmount(): void {
    this.amountDone = null;
    $('amount').classList.add('hidden');
  }

  // ------------------------------------------------------------ NPC windows (ui/shop.ts, ui/stash.ts, ui/forge.ts)

  /** Market broker: the window lives in market.ts. Guests may look but not trade (the server refuses it too). */
  private openMarket(): void {
    this.shop.closeShop();
    this.forge.closeForge();
    this.stash.closeStash();
    this.market.open();
  }

  /** Something of yours sold or expired at the market: a banner, a chat line and the trade sound. */
  marketNote(text: string, sub?: string): void {
    this.banner(text, sub, '#f2c230');
    this.log(sub ? `${text} — ${sub}` : text, '#f2c230');
    playSound('trade');
  }

  private openShop(): void {
    this.market.close();
    this.forge.closeForge();
    this.stash.closeStash();
    this.shop.openShop();
  }

  private openStash(): void {
    this.shop.closeShop();
    this.forge.closeForge();
    this.market.close();
    this.stash.openStash();
  }

  private openForge(): void {
    this.shop.closeShop();
    this.stash.closeStash();
    this.market.close();
    this.forge.openForge();
  }

  /** True while the blacksmith window is open (Game skips your own overhead enhance text then: the window shows it). */
  get forgeShown(): boolean {
    return this.forge.forgeShown;
  }

  // ------------------------------------------------------------ bag

  itemCell(item: BagEntry | null | undefined, attrs: string, placeholder = '', selected = false): string {
    if (!item) return `<div class="cell empty" ${attrs}>${placeholder}</div>`;
    if (isPotion(item)) {
      // The outline marks the size the quick key uses.
      const quick = this.g.player.potSel[item.potion] === item.size;
      return `<div class="cell pot${quick ? ' quick' : ''}" ${attrs} style="--rc:${POTION_COLOR[item.potion]}">${potionIcon(item.potion, item.size)}` +
        `<span class="psize">${POTION_SIZE_LABEL[item.size]}</span><span class="ilv">×${item.count}</span></div>`;
    }
    if (isStone(item)) {
      return `<div class="cell pot stone" ${attrs} style="--rc:${STONE_COLOR[item.stone]}">${stoneIcon(item.stone)}` +
        `<span class="ilv">×${item.count}</span></div>`;
    }
    const icon = itemIcon(item);
    const plus = plusOf(item) ? `<span class="iplus">+${plusOf(item)}</span>` : '';
    const locked = this.g.player.canEquip(item) ? '' : ' locked';
    return `<div class="cell r-${item.rarity}${selected ? ' sel' : ''}${locked}" ${attrs} style="--rc:${RARITY_COLOR[item.rarity]}">${icon}${plus}<span class="ilv">Lv.${item.level}</span></div>`;
  }

  private renderInventory(): void {
    this.invDirty = false;
    const p = this.g.player;
    const emptyLook = (s: EquipSlot): string => TEXT_SOCKETS.includes(s)
      ? `<span class="ph-label">${EQUIP_SLOT_LABEL[s]}</span>`
      : `<span class="ph">${emptySlotIcon(s, p.cls.id)}</span>`;
    $('equip-slots').innerHTML = EQUIP_SLOTS.map((s) =>
      `<div class="eq-row eq-${s}" title="${EQUIP_SLOT_LABEL[s]}">${this.itemCell(p.equipment[s], `data-slot="${s}"`, emptyLook(s))}</div>`,
    ).join('');
    const picked = this.market.picked;
    // Things on offer in an open trade stay in the bag but are marked (and the server refuses to move them).
    const offered = this.g.trade.offeredSlots();
    $('bag-grid').innerHTML = p.bag.map((it, i) => {
      const cell = this.itemCell(it, `data-i="${i}"`, '', i === picked);
      return offered.has(i) ? cell.replace('class="cell ', 'class="cell trade-offered ') : cell;
    }).join('');
    const fmt = (k: StatKey, v: number) =>
      k === 'hpRegen' || k === 'mpRegen' || k === 'cdr' || k === 'buffDur' || k === 'armorPen' ? v.toFixed(1) : String(Math.round(v));
    $('stat-list').innerHTML = STAT_KEYS.map((k) =>
      `<div class="stat"><span>${STAT_LABEL[k]}</span><b>${fmt(k, p.stats[k])}</b></div>`,
    ).join('');
    $('inv-gold').innerHTML = `${COIN_ICON} ${p.gold.toLocaleString()} G`;
    $('inv-pots').innerHTML = potionTotals(this.g.player);
    const lf = $('loot-filter');
    for (const r of RARITIES) lf.querySelector<HTMLInputElement>(`[data-rarity="${r}"]`)!.checked = p.lootFilter.rarities.includes(r);
    syncPots(lf, p.lootFilter);
    if (this.stash.isOpen) this.stash.renderStash();
    $('bag-hint').textContent = this.g.trade.open
      ? 'กำลังเทรด: คลิกของเพื่อเสนอ · ลากไปที่หน้าต่างเทรดก็ได้ (Shift+ลาก = เสนอบางส่วนของกองยา/หิน) · ของที่เสนออยู่มีกรอบเขียว'
      : this.market.isOpen
      ? this.market.bagHint
      : this.stash.isOpen
      ? 'คลิกซ้าย = สวมใส่ / เลือกยาให้ปุ่มด่วน · คลิกขวา = ฝากเข้าคลัง · ลากไปวางในคลังได้'
      : this.shop.isOpen
      ? 'คลิกซ้าย = สวมใส่ / เลือกยาให้ปุ่มด่วน · คลิกขวา = ขายให้พ่อค้า · คลิกช่องสวมใส่ = ถอด'
      : 'คลิกซ้าย = สวมใส่ / เลือกยาให้ปุ่มด่วน · คลิกขวา = วางลงพื้น · คลิกช่องสวมใส่ = ถอด · ขายของได้ที่พ่อค้าเท่านั้น';
  }

  /** Dropping a bag item on a socket wears it there; a ring replaces the ring of that socket. */
  equipByDrag(i: number, slot: EquipSlot): void {
    const g = this.g;
    const item = g.player.bag[i];
    if (!isItem(item)) return;
    const block = g.player.equipBlock(item);
    if (block) this.log(`ใส่ ${itemName(item)} ไม่ได้ — ${block}`, '#ff8a6a');
    else if (!wornPlaces(item.slot).includes(slot)) this.log(`${itemName(item)} ใส่ช่อง${EQUIP_SLOT_LABEL[slot]}ไม่ได้`, '#ff8a6a');
    else g.backend.equip(i, slot);
  }

  /** Ask before dropping a bag item on the ground. */
  askDrop(i: number): void {
    const item = this.g.player.bag[i];
    if (!item) return;
    const name = `<b style="color:${entryColor(item)}">${entryName(item)}</b>`;
    this.confirm(
      `วาง ${name} ลงบนพื้น?<br><small>เก็บคืนได้ภายใน 60 วินาที · ถ้าจะขาย ให้ไปหาพ่อค้าที่เมือง</small>`,
      'วางลงพื้น',
      () => {
        if (this.g.player.bag[i] !== item) return;
        this.g.dropFromBag(i);
        this.markInventory();
        if (this.forge.isOpen) this.forge.renderForge();
      },
    );
  }
  /** The tooltip for any bag entry (gear, potion or stone). */
  showEntryTip(entry: BagEntry, e: MouseEvent, hint: string): void {
    if (isPotion(entry)) this.showPotionTip(entry, e, hint);
    else if (isStone(entry)) this.showStoneTip(entry, e, hint);
    else this.showTip(entry, e, hint);
  }

  showTip(item: Item, e: MouseEvent, hint: string): void {
    const tip = $('tooltip');
    const p = this.g.player;
    // A worn item compares with nothing; one in the bag with what a click would replace.
    const eq = Object.values(p.equipment).includes(item) ? item : p.equipment[p.equipPlace(item)];
    const stats = effectiveStats(item);
    const eqStats = eq ? effectiveStats(eq) : {};
    const r1 = (v: number) => Math.round(v * 10) / 10;
    const diffOf = (k: StatKey) => {
      if (!eq || eq === item) return '';
      const d = r1((stats[k] ?? 0) - (eqStats[k] ?? 0));
      return Math.abs(d) > 0.05 ? `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>` : '';
    };
    let lines: string;
    if (item.lines?.length) {
      // Each rolled line with its tier (T1 best) and that tier's range at this item level.
      lines = item.lines.map((l) => `<div class="tt-line">${lineHtml(l)}</div>`).join('');
      const bonus = enhanceBonus(item);
      const bonusText = (Object.keys(bonus) as StatKey[]).filter((k) => bonus[k]).map((k) => `+${r1(bonus[k] ?? 0)} ${STAT_LABEL[k]}`).join(' · ');
      if (bonusText) lines += `<div class="tt-enh">ตีบวก: ${bonusText}</div>`;
      if (eq && eq !== item) {
        // One row per stat that changes: equipped value, this item's value, then ▲/▼ by how much.
        const keys = [...new Set([...Object.keys(stats), ...Object.keys(eqStats)])] as StatKey[];
        const rows = keys.map((k) => {
          const was = r1(eqStats[k] ?? 0), now = r1(stats[k] ?? 0), d = r1(now - was);
          if (Math.abs(d) <= 0.05) return '';
          const change = `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}</span>`;
          return `<tr><td>${STAT_LABEL[k]}</td><td class="was">${was}</td><td>${now}</td><td>${change}</td></tr>`;
        }).join('');
        if (rows) {
          lines += `<div class="tt-cmp"><div class="tt-cmp-title">เทียบกับที่ใส่อยู่</div><table>` +
            `<tr><th></th><th>ใส่อยู่</th><th>ชิ้นนี้</th><th></th></tr>${rows}</table></div>`;
        }
      }
    } else {
      // Items from before tiers: totals only.
      lines = (Object.keys(stats) as StatKey[]).map((k) => {
        const d = diffOf(k);
        return `<div>+${r1(stats[k] ?? 0)} ${STAT_LABEL[k]}${d ? ` (${d})` : ''}</div>`;
      }).join('');
    }
    tip.innerHTML =
      `<div class="tt-name" style="color:${RARITY_COLOR[item.rarity]}">${itemName(item)}</div>` +
      `<div class="tt-sub">${RARITY_LABEL[item.rarity]} · ${SLOT_LABEL[item.slot]} · iLv.${item.level}${plusOf(item) ? ` · ตีบวก +${plusOf(item)}` : ''}</div>` +
      `<div class="tt-stats">${lines || '<div>—</div>'}</div>` +
      (p.equipBlock(item) ? `<div class="tt-req">${p.equipBlock(item)}</div>` : '') +
      `<div class="tt-hint">${hint}</div><div class="tt-val">ขายให้พ่อค้าได้ ${sellValue(item)} G</div>`;
    this.placeTip(tip, e);
  }

  showPotionTip(s: PotionStack, e: MouseEvent, hint: string): void {
    const tip = $('tooltip');
    const quick = this.g.player.potSel[s.potion] === s.size;
    tip.innerHTML =
      `<div class="tt-name" style="color:${POTION_COLOR[s.potion]}">${potionName(s.potion, s.size)}</div>` +
      `<div class="tt-sub">ยา · ${s.count} / ${POTION_STACK} ขวด${quick ? ` · ใช้กับปุ่ม ${s.potion === 'hp' ? 1 : 2} อยู่` : ''}${s.bound ? ' · ผูกกับตัวละคร (รางวัลภารกิจ)' : ''}</div>` +
      `<div class="tt-stats"><div>ฟื้น ${potionHeal(s.potion, s.size, this.g.player.cls.id)} ${s.potion.toUpperCase()} ต่อขวด</div></div>` +
      `<div class="tt-hint">${hint}</div><div class="tt-val">${s.bound ? 'ขาย ทิ้ง ฝากคลัง หรือเทรดไม่ได้' : `ขายให้พ่อค้าได้ขวดละ ${potionSellPrice(s.potion, s.size)} G`}</div>`;
    this.placeTip(tip, e);
  }

  /** Running buff scrolls under the online line: icon, label and time left (h:mm:ss). */
  private drawBuffs(buffs: Buffs): void {
    const parts: string[] = [];
    for (const k of BUFF_SCROLLS) {
      const t = buffs[k];
      if (!t || t <= 0) continue;
      const s = Math.ceil(t);
      const time = `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      parts.push(`<div class="buff" style="--bc:${STONE_COLOR[k]}" title="${STONE_NAME[k]} — เวลาที่เหลือ (นับเฉพาะตอนออนไลน์)">${stoneIcon(k)}<span>${BUFF_LABEL[k]} ${time}</span></div>`);
    }
    const html = parts.join('');
    if (html === this.drawnBuffs) return;
    this.drawnBuffs = html;
    $('hud-buffs').innerHTML = html;
  }

  showStoneTip(s: StoneStack, e: MouseEvent, hint: string): void {
    const tip = $('tooltip');
    tip.innerHTML =
      `<div class="tt-name" style="color:${STONE_COLOR[s.stone]}">${STONE_NAME[s.stone]}</div>` +
      `<div class="tt-sub">${
        isBoundKind(s.stone) && isConsumable(s.stone) ? `ของใช้ · ${s.count} / ${STONE_STACK} ${stoneUnit(s.stone)} · ผูกกับตัวละคร`
        : isConsumable(s.stone) ? `ของใช้ · ${s.count} / ${STONE_STACK} ${stoneUnit(s.stone)} · ซื้อได้ที่พ่อค้า`
        : isBossKey(s.stone) ? `Artifact · ${s.count} / ${STONE_STACK} อัน · ดรอปจากมอนสเตอร์ในแมพของบอส`
        : isBound(s) && !s.bound ? 'กุญแจเควส · ผูกกับตัวละคร'
        : s.stone === 'phoenix' ? `ไอเทมชุบชีวิต · ${s.count} / ${STONE_STACK} อัน · ซื้อจากพ่อค้า`
        // Reroll stones also drop (rarely) from ordinary monsters: MONSTER_STONES.
        : MONSTER_STONES.includes(s.stone) ? `วัตถุดิบช่างตีเหล็ก · ${s.count} / ${STONE_STACK} ก้อน · ดรอปจากบอส และมอนสเตอร์ทั่วไป (หายาก)`
        : `วัตถุดิบตีบวก · ${s.count} / ${STONE_STACK} ก้อน · ดรอปจากบอสเท่านั้น`}${s.bound ? ' · ผูกกับตัวละคร (รางวัลภารกิจ)' : ''}</div>` +
      `<div class="tt-stats"><div>${STONE_DESC[s.stone]}</div></div>` +
      `<div class="tt-hint">${hint}</div><div class="tt-val">${isBound(s) ? 'ขาย ทิ้ง ฝากคลัง หรือเทรดไม่ได้' : `ขายให้พ่อค้าได้${stoneUnit(s.stone)}ละ ${stoneSellPrice(s.stone).toLocaleString()} G`}</div>`;
    this.placeTip(tip, e);
  }

  placeTip(tip: HTMLElement, e: MouseEvent): void {
    // Touch: never pop up. iOS drops a tap's click when the tap's hover changes the page, so every
    // tooltip on a tappable cell (shop, stash, market, trade, forge) would eat the tap.
    if (isTouchMode()) {
      tip.classList.add('hidden');
      return;
    }
    tip.classList.remove('hidden');
    const x = Math.min(e.clientX + 16, window.innerWidth - tip.offsetWidth - 8);
    const y = Math.min(e.clientY + 16, window.innerHeight - tip.offsetHeight - 8);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  hideTip(): void {
    $('tooltip').classList.add('hidden');
  }

  // ------------------------------------------------------------ log / overlays

  // ------------------------------------------------------------ online

  /** Opens the chat box; `prefill` (e.g. "/w Name ") replaces what is typed, for answering a whisper. */
  openChat(prefill?: string): void {
    const box = $('chat');
    const input = $<HTMLInputElement>('chat-input');
    if (!box.classList.contains('hidden')) {
      if (prefill !== undefined) {
        input.value = prefill;
        input.focus();
      }
      return;
    }
    box.classList.remove('hidden');
    // The log turns into a scrollable history (every kept line, faded or not) while the chat is open.
    const log = $('log');
    log.classList.add('open');
    log.scrollTop = log.scrollHeight;
    // Focus after this frame so the Enter that opened it doesn't also send it.
    setTimeout(() => {
      if (prefill !== undefined) input.value = prefill;
      input.focus();
    }, 0);
  }

  closeChat(): void {
    const input = $<HTMLInputElement>('chat-input');
    input.value = '';
    $('chat').classList.add('hidden');
    $('log').classList.remove('open');
    input.blur();
  }

  /**
   * A chat line; an empty name means a server notice (someone joined or left). `ch: 'party'` = party chat or
   * a party notice; `ch: 'whisper'` = a whisper from `name`, or (with `to`) your own whisper to `to`.
   */
  chatLine(name: string, text: string, fadeMs = 15000, ch?: 'party' | 'whisper', to?: string): void {
    const party = ch === 'party';
    const el = document.createElement('div');
    if (name && ch === 'whisper') {
      el.className = 'log-line chat whisper';
      const b = document.createElement('b');
      b.textContent = to ? `[กระซิบถึง ${to}]: ` : `[กระซิบ] ${name}: `;
      // Click the line to answer that person.
      const other = to ?? name;
      el.title = `คลิกเพื่อกระซิบตอบ ${other}`;
      el.onclick = () => this.openChat(whisperPrefix(other));
      el.addEventListener('mousedown', (e) => e.preventDefault()); // keep typing in the chat box
      if (!to) this.lastWhisperFrom = name;
      this.whisperWith = other;
      el.append(b, document.createTextNode(text));
    } else if (name) {
      el.className = `log-line chat${party ? ' party' : ''}`;
      const b = document.createElement('b');
      b.textContent = party ? `[ปาร์ตี้] ${name}: ` : `${name}: `;
      el.append(b, document.createTextNode(text));
    } else {
      el.className = `log-line system${party ? ' party' : ''}`;
      el.textContent = text;
    }
    this.pushLog(el, fadeMs);
  }

  /**
   * The server is about to stop or restart: a banner that stays up and ticks down (until the
   * connection closes), and the same count as yellow lines in the chat.
   */
  shutdownCountdown(mode: ShutdownMode, seconds: number | null, serverText?: string): void {
    if (seconds === null) {
      document.getElementById('shutdown-banner')?.remove();
      const text = shutdownCancelled(mode);
      this.banner(text, undefined, SHUTDOWN_COLOR);
      this.log(text, SHUTDOWN_COLOR);
      return;
    }
    // The server's line (the owner's wording, set on the admin page); textContent only, never HTML.
    const text = typeof serverText === 'string' && serverText ? serverText : shutdownWarning(mode, seconds);
    let el = document.getElementById('shutdown-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'shutdown-banner';
      $('hud').append(el);
    }
    el.textContent = text;
    this.log(text, SHUTDOWN_COLOR);
  }

  /** performance.now() until which the owner's banner is up: a megaphone waits for it instead of covering it. */
  private adminBannerUntil = 0;

  /**
   * An announcement: a banner for a while (like the restart warning) and a chat line. From the server's
   * owner, or (`megaphone`) from a player's megaphone: same frame, its own heading and the character's name.
   */
  announce(text: string, from: string, direct: boolean, megaphone = false, box = false): void {
    const wait = this.adminBannerUntil - performance.now();
    // Players' banners (megaphone, mystery box prize) wait for the owner's instead of covering it.
    if ((megaphone || box) && wait > 0) {
      window.setTimeout(() => this.announce(text, from, direct, megaphone, box), wait + 50);
      return;
    }
    if (box) {
      this.boxBanner(text);
      return;
    }
    if (!megaphone) this.adminBannerUntil = performance.now() + ANNOUNCE_MS;
    document.getElementById('announce-banner')?.remove();
    const el = document.createElement('div');
    el.id = 'announce-banner';
    if (megaphone) el.classList.add('megaphone');
    // Text only (textContent), so nothing the sender types can become HTML on anyone's screen.
    const head = document.createElement('div');
    head.className = 'announce-head';
    head.textContent = megaphone ? '📣 โทรโข่ง' : direct ? '📢 ข้อความจาก GM ถึงคุณ' : '📢 ประกาศ';
    const body = document.createElement('div');
    body.textContent = text;
    const sign = document.createElement('div');
    sign.className = 'announce-from';
    sign.textContent = `— ${from}`;
    el.append(head, body, sign);
    $('hud').append(el);
    setTimeout(() => el.remove(), ANNOUNCE_MS);
    const line = document.createElement('div');
    line.className = 'log-line';
    line.style.color = megaphone ? STONE_COLOR.megaphone : SHUTDOWN_COLOR;
    line.textContent = megaphone ? `📣 ${from}: ${text}` : direct ? `📢 ข้อความจาก ${from} ถึงคุณ: ${text}` : `📢 ประกาศ: ${text} — ${from}`;
    this.pushLog(line, ANNOUNCE_MS * 3);
  }

  /** A mystery box prize for the whole server (owner 2026-11-22): the announcement banner with its own heading and no sender. */
  private boxBanner(text: string): void {
    document.getElementById('announce-banner')?.remove();
    const el = document.createElement('div');
    el.id = 'announce-banner';
    el.classList.add('megaphone');
    const head = document.createElement('div');
    head.className = 'announce-head';
    head.textContent = '🎁 กล่องปริศนา';
    const body = document.createElement('div');
    body.textContent = text;
    el.append(head, body);
    $('hud').append(el);
    setTimeout(() => el.remove(), ANNOUNCE_MS);
    const line = document.createElement('div');
    line.className = 'log-line';
    line.style.color = STONE_COLOR.mystery_box;
    line.textContent = text;
    this.pushLog(line, ANNOUNCE_MS * 3);
  }

  /** Reconnecting on its own: try `attempt` is on its way; null = back in (the banner goes). */
  showReconnecting(attempt: number | null): void {
    let el = document.getElementById('reconnect-banner');
    if (attempt === null) {
      if (el) {
        el.remove();
        this.log('เชื่อมต่อใหม่สำเร็จ', '#9fd8ff');
      }
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'reconnect-banner';
      $('hud').append(el);
      this.log('หลุดการเชื่อมต่อ — กำลังเชื่อมต่อใหม่…', '#ff8a6a');
    }
    const big = document.createElement('div');
    big.textContent = 'กำลังเชื่อมต่อใหม่…';
    const small = document.createElement('small');
    small.textContent = `ครั้งที่ ${attempt}${this.g.autoPlay && !this.g.backend.guest ? ' · Auto ยังฟาร์มต่อบน server' : ''}`;
    el.replaceChildren(big, small);
  }

  showDisconnect(msg: string): void {
    document.getElementById('shutdown-banner')?.remove();
    document.getElementById('reconnect-banner')?.remove();
    $('disconnect-msg').textContent = msg;
    $('disconnect').classList.remove('hidden');
  }

  /** Big centred text that fades out by itself. */
  banner(text: string, sub?: string, color = '#ff6a5a'): void {
    const el = document.createElement('div');
    el.className = 'banner';
    el.style.color = color;
    const big = document.createElement('div');
    big.className = 'banner-text';
    big.textContent = text;
    el.append(big);
    if (sub) {
      const small = document.createElement('div');
      small.className = 'banner-sub';
      small.textContent = sub;
      el.append(small);
    }
    $('hud').append(el);
    setTimeout(() => el.remove(), 2600);
  }

  log(msg: string, color = '#e8e2d0'): void {
    const el = document.createElement('div');
    el.className = 'log-line';
    el.style.color = color;
    el.textContent = msg;
    this.pushLog(el, 7000);
  }

  private pushLog(el: HTMLElement, fadeMs: number): void {
    const box = $('log');
    // Pinned to the newest line unless the player scrolled up to read older ones.
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 8;
    box.append(el);
    const lines = box.getElementsByClassName('log-line');
    while (lines.length > LOG_KEEP) lines[0].remove();
    if (atBottom) box.scrollTop = box.scrollHeight;
    setTimeout(() => el.classList.add('fade'), fadeMs);
  }

  logItem(item: Item): void {
    this.log(`ได้รับ [${itemName(item)}] (${RARITY_LABEL[item.rarity]})`, RARITY_COLOR[item.rarity]);
  }

  showDeath(): void {
    $('death').classList.remove('hidden');
  }

  hideDeath(): void {
    $('death').classList.add('hidden');
  }

  openDialog(): void {
    this.dialogOpen = true;
    this.dialogIdx = 0;
    $('dialog').classList.remove('hidden');
    this.renderDialog();
  }

  private renderDialog(): void {
    $('dialog-text').textContent = SEEKER_LINES[this.dialogIdx];
    $('dialog-next').textContent = this.dialogIdx < SEEKER_LINES.length - 1 ? 'คลิกเพื่ออ่านต่อ ▸' : 'คลิกเพื่อออกเดินทาง ▸';
  }

  private advanceDialog(): void {
    this.dialogIdx++;
    if (this.dialogIdx >= SEEKER_LINES.length) this.closeDialog();
    else this.renderDialog();
  }

  private closeDialog(): void {
    this.dialogOpen = false;
    $('dialog').classList.add('hidden');
    if (!this.g.metSeeker) {
      this.g.metSeeker = true;
      const boss = MONSTERS[ZONE_1.lair!.boss];
      this.log(`ภารกิจ: ฝึกฝนในป่ามรกต แล้วปราบ ${boss.name}`, '#ffd34a');
    }
  }
}
