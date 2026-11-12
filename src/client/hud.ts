import { SPACE_COLOUR } from './island';
import { placeLabel } from '../shared/channels';
import type { Game } from './Game';
import { NPC_USE_RANGE, type NpcId } from '../shared/data/npcs';
import type { SkillSlot } from '../shared/data/classes';
import { SKILL_REACH, reachRadius, reachText } from '../shared/data/skillRanges';
import {
  bonusPct, DROP_ON_FAIL_FROM, dropsOnFail, FORGE_CD, effectiveStats, enhanceBonus, enhanceCost, ENHANCE_STONES_PER_TRY, itemName,
  MAX_PLUS, PITY_STEP, pityBonus, plusOf, rateFor, sellValue, STONE_FROM, stonesNeeded, successRate,
} from '../shared/data/enhance';
import {
  entryName, POTION_SIZES, POTION_SIZE_LABEL, POTION_STACK, POTIONS, potionHeal, potionName, potionSellPrice, stackLimit,
} from '../shared/data/potions';
import { BUFF_LABEL, MONSTER_STONES, REROLL_STONE, RETURN_CAST, RETURN_SCROLL_PRICE, STONE_COLOR, STONE_DESC, STONE_NAME, STONE_STACK, stoneSellPrice, stoneStackValue, stoneUnit, PHOENIX_PRICE } from '../shared/data/stones';
import { lineRanges, rerollBlock, statRerollOdds } from '../shared/data/items';
import { REROLL_NAME, rerollCost, type RerollKind } from '../shared/data/reroll';
import { FullMap } from './fullmap';
import { AUTO_PX_PER_UNIT, AUTO_RANGE_MAX, AUTO_RANGE_MIN, buybackPrice, cleanAutoSettings, lootPots, type AutoSkill, type Buffs, type LootFilter, type SortKey } from '../shared/sim/Player';
import { isBulkSellable } from '../shared/sim/Sim';
import { nextRowPrice, STASH_MAX, STASH_ROW, STASH_ROW_PRICES, STASH_START } from '../shared/sim/stash';
import { MONSTERS } from '../shared/data/monsters';
import { ZONE_1 } from '../shared/data/zones';
import { expToNext } from '../shared/formulas';
import { blockingGate } from '../shared/data/bossGates';
import {
  BUFF_SCROLLS, isBossKey, isBound, isBoundKind, isBuffScroll, isConsumable, isItem, isPotion, isStack, isStone, sameStack, RARITIES, RARITY_COLOR, RARITY_LABEL, EQUIP_SLOTS, EQUIP_SLOT_LABEL, SLOT_LABEL, STAT_KEYS, STAT_LABEL, wornPlaces,
  type BagEntry, type Item, type StatLine, type PotionKind, type PotionSize, type PotionStack, type Rarity, type StoneStack, type StoneKind, type EquipSlot, type StatKey,
} from '../shared/types';
import { drawEdgeMarker, drawMapIcon, drawPin, facingAngle, partyDot } from './mapIcons';
import type { MapIcon } from './mapIconNames';
import { NPC_MAP_ICON } from './fullmap';
import { MarketWindow } from './market';
import { playSound } from './audio/sfx';
import { COIN_ICON, emptySlotIcon, FORGE_ICON, itemIcon, potionIcon, skillIcon, stoneIcon } from './icons';
import { shutdownCancelled, shutdownWarning, type ShutdownMode } from '../shared/net/protocol';
import { isTouchMode, onPointerModeChange } from './touch/device';
import { imgUrl } from './img';

/** Yellow, like the game's level-up lines. */
const SHUTDOWN_COLOR = '#ffd34a';
/** How long an owner's announcement banner stays up. */
const ANNOUNCE_MS = 10_000;
/** Enhance tries whose target level is this or higher show "??" instead of the success chance (display only). */
const HIDDEN_RATE_FROM = 11;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Lines of chat and messages kept for scrolling back (with the chat open); while playing only the newest 9 show (style.css). */
const LOG_KEEP = 50;
/** Sockets whose empty look is their name, not a faded item picture (none: every slot has its picture now). */
const TEXT_SOCKETS: EquipSlot[] = [];

/** The minimap's size on screen, and pixels per world unit. Its canvas holds twice that, to stay sharp. */
const MINIMAP_SIZE = 176;
/** Zoom levels of the minimap (pixels per world unit): far, normal, near. The + and − buttons step through them. */
const MINIMAP_ZOOMS = [1.8, 2.6, 3.8];
const MINIMAP_ZOOM_KEY = 'multiverse-minimap-zoom';

type HudStyle = 'orbs' | 'bars';
const HUD_STYLE_KEY = 'multiverse-hud-style';

function loadHudStyle(): HudStyle {
  try {
    return localStorage.getItem(HUD_STYLE_KEY) === 'bars' ? 'bars' : 'orbs';
  } catch {
    return 'orbs';
  }
}

const KEY_LABEL: Record<SkillSlot, string> = { basic: 'LMB', q: 'Q', e: 'E', r: 'R', dash: 'SPACE' };
const POTION_CD = 1.5;
/** The blacksmith menu's one-line description of each system (left column, under the menu). */
const FORGE_DESC: Record<'enhance' | RerollKind, string> = {
  enhance: 'เพิ่มระดับ +N ทุกค่าบนชิ้นนั้นแรงขึ้นเป็น % · ยิ่งบวกสูง ยิ่งเสี่ยง',
  values: 'สุ่มค่าตัวเลขใหม่ทุกบรรทัด tier เท่าเดิม',
  stat: 'สุ่มสเตตัสเสริม 1 บรรทัด เป็นชนิดใหม่ พร้อม tier และค่าใหม่',
};
const fmtNum = (v: number) => String(Math.round(v * 10) / 10);

/** What the chat box starts with to whisper someone (quoted when the name has a space). */
export const whisperPrefix = (name: string): string => `/w ${name.includes(' ') ? `"${name}"` : name} `;
const SELL_RARITY_KEY = 'multiverse-sell-rarities';
/** Which rarities the merchant's "sell ticked" boxes had ticked last time (this browser only). */
function loadSellRarities(): Rarity[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(SELL_RARITY_KEY) ?? '[]');
    return Array.isArray(v) ? RARITIES.filter((r) => v.includes(r)) : [];
  } catch {
    return [];
  }
}
function saveSellRarities(rs: Rarity[]): void {
  try {
    localStorage.setItem(SELL_RARITY_KEY, JSON.stringify(rs));
  } catch {
    // Storage blocked: the ticks just won't be remembered.
  }
}

const POTION_COLOR: Record<PotionKind, string> = { hp: '#e8323c', mp: '#3a7bff' };

const SEEKER_LINES = [
  'ในที่สุดเจ้าก็ตื่นแล้ว… เจ้าคือผู้รอดชีวิตจากโลกที่ถูก The Devourer กลืนกิน',
  'ข้าคือ The Seeker ผู้ตามหาความจริงเบื้องหลังการล่มสลายของมิติทั้งหลาย ตั้งแต่ The Shattering แยก The First Cosmos ออกเป็นเสี่ยง ๆ',
  'แสงสีทองขาวที่พาเจ้ามาที่นี่… ข้าเคยเห็นมันในบันทึกโบราณที่เรียกว่า The Origin',
  'ที่นี่คือเมืองศูนย์กลางมิติ จุดเชื่อมของเศษเสี้ยวมิติที่ยังรอด สี่มุมของเกาะมีประตูสู่ดินแดนต่าง ๆ แต่สัตว์ในนั้นเริ่มคลุ้มคลั่งจากพลังที่รั่วไหล',
  'เหนื่อยเมื่อไหร่ ให้มาดื่มน้ำจากน้ำพุกลางเมือง หรือนั่งพักข้างกองไฟในแคมป์ของแต่ละดินแดน กด T เมื่ออยู่ใกล้ เลือดและมานาจะกลับมาเต็ม',
  'จงเริ่มฝึกฝนที่ป่ามรกต ผ่านประตูมุมบนของเมือง ลึกเข้าไปในป่ามีหมีใหญ่ที่ถูกพลังนั้นครอบงำ หากเจ้าปราบมันได้ เราจะได้เบาะแสแรกของ The Origin',
];

/** Six checkboxes: HP small/medium/large, MP small/medium/large. */
function potToggles(): string {
  return (['hp', 'mp'] as const).map((k) =>
    `<span class="pot-group">ยา ${k.toUpperCase()}` +
    POTION_SIZES.map((sz) => `<label><input type="checkbox" data-pot="${k}" data-size="${sz}">${POTION_SIZE_LABEL[sz]}</label>`).join('') +
    '</span>',
  ).join('');
}

function readPots(box: HTMLElement): LootFilter['pots'] {
  const pick = (k: 'hp' | 'mp') =>
    POTION_SIZES.filter((sz) => box.querySelector<HTMLInputElement>(`[data-pot="${k}"][data-size="${sz}"]`)?.checked);
  return { hp: pick('hp'), mp: pick('mp') };
}

function syncPots(box: HTMLElement, f: LootFilter): void {
  const pots = lootPots(f);
  for (const cb of box.querySelectorAll<HTMLInputElement>('[data-pot]')) {
    cb.checked = pots[cb.dataset.pot as 'hp' | 'mp'].includes(cb.dataset.size as 's' | 'm' | 'l');
  }
}

/** Ping colours: green below PING_GOOD_MS, yellow below PING_OK_MS, red from there on. */
const PING_GOOD_MS = 100;
const PING_OK_MS = 250;

export class Hud {
  dialogOpen = false;
  private fullMap: FullMap;
  private mapOpen = false;
  /** Index into MINIMAP_ZOOMS. */
  private mmZoom = 1;
  /** The player's own map pin. Only for the zone object it was placed in, so a new visit starts clean. Never saved. */
  private pin: { zone: object; x: number; z: number } | null = null;
  private slotEls: { kind: SkillSlot | PotionKind; el: HTMLElement; cd: HTMLElement; extra: HTMLElement }[] = [];
  private invDirty = true;
  private bagOpen = false;
  /** Level the bag was last drawn for (gear above it is marked as locked). */
  private drawnLevel = 0;
  /** Last buff row drawn (redrawn only when a second ticks over). */
  private drawnBuffs = '';
  /** A bag or stash item being dragged with the mouse (ghost appears once the mouse moves a few pixels). */
  private drag: { src: 'bag' | 'stash' | 'equip'; i: number; x: number; y: number; ghost: HTMLElement | null } | null = null;
  /** True right after a drag ends, so the click that follows mouseup does nothing. */
  private justDragged = false;
  /** Item uids last drawn in the buyback grid, so it is only rebuilt when the list changes. */
  private buybackKey = '';
  private mmT = 0;
  private readonly mm: CanvasRenderingContext2D;
  private dialogIdx = 0;
  private shopOpen = false;
  private stashOpen = false;
  private forgeOpen = false;
  private forgeSel: string | null = null;
  private confirmYes: (() => void) | null = null;
  /** Set while the amount dialog (stack split / partial sell) is open. */
  private amountDone: ((n: number) => void) | null = null;
  private enhancing = false;
  /** performance.now() when the next blacksmith action may be sent (FORGE_CD after the last one). */
  private forgeReadyAt = 0;
  /** Use a protection stone on attempts that can drop the level (the forge's tick box; off until ticked). */
  private forgeProtect = false;
  /** The blacksmith's menu: enhance, or one of the rerolls. */
  private forgeMode: 'enhance' | RerollKind = 'enhance';
  /** Lines of the item before its last reroll, shown next to the new ones until another item is picked. */
  private rerollPrev: { uid: string; lines: StatLine[] } | null = null;

  private readonly market: MarketWindow;
  /** The chat history tab picked last ('all', 'chat', 'system', 'party' or 'whisper'). */
  private chatTab = 'all';
  /** Who whispered you last ("/r" answers them). */
  private lastWhisperFrom = '';
  /** Who you whispered with last, either way (plain text in the whisper tab goes to them). */
  private whisperWith = '';

  constructor(private readonly g: Game) {
    this.market = new MarketWindow(g, this);
    $('hud').classList.remove('hidden');
    this.mm = $<HTMLCanvasElement>('minimap').getContext('2d')!;
    this.hudStyle = loadHudStyle();
    this.applyHudStyle();
    onPointerModeChange(() => this.applyHudStyle());
    // Big enough to show up late on first opening the bag, so it's fetched now.
    new Image().src = imgUrl('assets/sprites/ui/inventory.png');
    $('btn-hud-style').onclick = () => this.setHudStyle(this.hudStyle === 'orbs' ? 'bars' : 'orbs');
    this.fullMap = new FullMap($<HTMLCanvasElement>('fullmap-canvas'));
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
    $('fullmap-close').onclick = () => this.toggleMap(false);
    $('fullmap-canvas').addEventListener('click', (e) => {
      const to = this.fullMap.toWorld(e.clientX, e.clientY);
      // The map stays open so you can watch the route; M, Esc or ✕ close it.
      this.g.walkTo(to.x, to.z);
    });
    // Right-click: put the pin there; right-click the pin itself to take it off.
    $('fullmap-canvas').addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const pin = this.myPin();
      if (pin && this.fullMap.onPin(e.clientX, e.clientY, pin)) {
        this.pin = null;
      } else {
        const to = this.fullMap.toWorld(e.clientX, e.clientY);
        const h = this.g.world.half;
        if (Math.abs(to.x) > h || Math.abs(to.z) > h) return;
        this.pin = { zone: this.g.backend.zone, x: to.x, z: to.z };
      }
      this.syncPinUi();
      this.fullMap.draw(this.g, this.myPin());
    });
    $('fullmap-clearpin').onclick = () => {
      this.pin = null;
      this.syncPinUi();
      this.fullMap.draw(this.g, null);
    };
    $('hud-name').textContent = g.player.name;
    this.showZoneName();
    $('hud-online').classList.toggle('hidden', !g.backend.online);
    $('hud-guest').classList.toggle('hidden', !g.backend.guest);
    this.buildSkillbar();

    $('btn-auto').onclick = () => g.toggleAuto();
    $('btn-bag').onclick = () => this.toggleBag();
    $('btn-help').onclick = () => this.toggleHelp();
    $('btn-auto-set').onclick = () => this.toggleAutoSettings();
    $('auto-set-close').onclick = () => this.toggleAutoSettings(false);
    for (const id of ['aset-range', 'aset-hp', 'aset-mp', 'aset-loot']) $(id).addEventListener('change', () => this.applyAutoSettings());
    $('btn-respawn').onclick = () => g.respawn();
    $('inv-close').onclick = () => this.toggleBag(false);
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

    const bb = $('buyback-grid');
    bb.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-bb]');
      const i = el ? Number(el.dataset.bb) : -1;
      const entry = g.player.buyback[i];
      if (!entry) return;
      const price = buybackPrice(entry);
      if (g.player.gold < price) {
        this.log(`ทองไม่พอ — ต้องใช้ ${price.toLocaleString()} G`, '#ff8a6a');
        return;
      }
      if (!g.player.hasBagSpace()) {
        this.log('กระเป๋าเต็ม', '#ff8a6a');
        return;
      }
      g.backend.buyBack(i, entry.item.uid);
      this.hideTip();
      this.afterTrade();
    });
    bb.addEventListener('mousemove', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-bb]');
      const entry = el ? g.player.buyback[Number(el.dataset.bb)] : undefined;
      if (entry) this.showTip(entry.item, e, `คลิก: ซื้อคืน ${buybackPrice(entry).toLocaleString()} G`);
      else this.hideTip();
    });
    bb.addEventListener('mouseleave', () => this.hideTip());

    const bag = $('bag-grid');
    this.setupDrag(bag, 'bag');
    this.setupDragEnd();
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
        return;
      }
      // At the blacksmith a click on gear puts it in the forge's slot instead of wearing it.
      if (this.forgeOpen && isItem(entry)) {
        this.hideTip();
        this.forgePlace(entry);
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
      if (this.stashOpen) {
        g.backend.stashPut(i, -1);
        this.markInventory();
        return;
      }
      if (this.market.isOpen) {
        this.market.bagRightClick(i);
        return;
      }
      const name = `<b style="color:${this.entryColor(item)}">${entryName(item)}</b>`;
      if (this.shopOpen) {
        this.sellFromBag(i);
        return;
      }
      const dropAsk = () => this.confirm(
        `วาง ${name} ลงบนพื้น?<br><small>เก็บคืนได้ภายใน 60 วินาที · ถ้าจะขาย ให้ไปหาพ่อค้าที่เมือง</small>`,
        'วางลงพื้น',
        () => {
          if (g.player.bag[i] !== item) return;
          g.dropFromBag(i);
          this.markInventory();
          if (this.forgeOpen) this.renderForge();
        },
      );
      // Standing at the market broker: offer to list it or search for the same kind (the menu also has "drop").
      if (g.backend.npcDistance('broker') <= NPC_USE_RANGE) {
        this.market.bagMenu(i, e, dropAsk);
        return;
      }
      dropAsk();
    });
    bag.addEventListener('mousemove', (e) => {
      if (this.drag?.ghost) return;
      const i = this.cellIndex(e);
      const item = i >= 0 ? g.player.bag[i] : null;
      const right = this.stashOpen ? 'ฝากเข้าคลัง' : this.market.isOpen ? 'เลือกมาลงขายในตลาด' : this.shopOpen ? (isStack(item) ? 'ขายทั้งช่อง' : 'ขาย') : 'วางลงพื้น';
      const split = item && isStack(item) && item.count > 1 ? ' · Shift+ลาก: แบ่งกอง' : '';
      if (g.trade.open && item) {
        const part = isStack(item) && item.count > 1 ? ' · Shift+ลากไปที่หน้าต่างเทรด: เสนอบางส่วน' : '';
        this.showEntryTip(item, e, g.trade.offeredSlots().has(i) ? 'เสนออยู่ — เอาออกที่หน้าต่างเทรด' : `คลิก: เสนอในการเทรด${part}`);
        return;
      }
      if (isPotion(item)) this.showPotionTip(item, e, `คลิกซ้าย: ใช้กับปุ่มด่วน · คลิกขวา: ${right}${split}`);
      else if (isStone(item)) this.showStoneTip(item, e, `${item.stone === 'return_scroll' ? 'คลิกซ้าย / ปุ่ม G: ใช้ · ' : isBuffScroll(item.stone) || item.stone === 'megaphone' ? 'คลิกซ้าย: ใช้ · ' : ''}คลิกขวา: ${right}${split}`);
      else if (item) {
        const both = item.slot === 'ring' && g.player.equipment.ring && g.player.equipment.ring2;
        if (this.forgeOpen) this.showTip(item, e, `คลิกซ้าย / ลาก: วางที่ช่างตีเหล็ก · คลิกขวา: ${right}`);
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
      if (e.button !== 0 || !this.forgeOpen || !slot || !g.player.equipment[slot]) return;
      e.preventDefault();
      this.drag = { src: 'equip', i: EQUIP_SLOTS.indexOf(slot), x: e.clientX, y: e.clientY, ghost: null };
    });
    eq.addEventListener('click', (e) => {
      if (this.justDragged) return;
      const slot = eqSlot(e);
      if (!slot) return;
      this.hideTip();
      if (this.forgeOpen) {
        const item = g.player.equipment[slot];
        if (item) this.forgePlace(item);
        return;
      }
      g.backend.unequip(slot);
      this.markInventory();
    });
    eq.addEventListener('mousemove', (e) => {
      if (this.drag?.ghost) return;
      const slot = eqSlot(e);
      const item = slot ? g.player.equipment[slot] : undefined;
      if (item) this.showTip(item, e, this.forgeOpen ? 'คลิก / ลาก: วางที่ช่างตีเหล็ก' : 'คลิก: ถอดเก็บเข้ากระเป๋า');
      else this.hideTip();
    });
    eq.addEventListener('mouseleave', () => this.hideTip());

    // Merchant
    $('shop-close').onclick = () => this.closeShop();
    $('shop-tabs').addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
      if (t) this.setShopTab(t.dataset.tab as 'buy' | 'buyback');
    });
    // Buy tab: a grid of potion icons. Click buys one, right click (or shift click) buys a stack.
    const buyGrid = $('shop-buy');
    buyGrid.innerHTML = (['hp', 'mp'] as const).flatMap((k) => POTION_SIZES.map((s) =>
      `<div class="cell pot" data-buy="${k}:${s}" style="--rc:${POTION_COLOR[k]}">${potionIcon(k, s)}` +
      `<span class="psize">${POTION_SIZE_LABEL[s]}</span><span class="cell-price">${POTIONS[k][s].price}</span></div>`,
    )).join('') +
      // Phoenix feathers, for getting up again in a boss room, then the return scroll.
      `<div class="cell pot stone" data-phoenix style="--rc:${STONE_COLOR.phoenix}">${stoneIcon('phoenix')}<span class="cell-price">${PHOENIX_PRICE}</span></div>` +
      `<div class="cell pot stone" data-buy-scroll style="--rc:${STONE_COLOR.return_scroll}">${stoneIcon('return_scroll')}` +
      `<span class="cell-price">${RETURN_SCROLL_PRICE}</span></div>`;
    const phoenixCell = (e: Event) => !!(e.target as HTMLElement).closest('[data-phoenix]');
    const buyCell = (e: Event): [PotionKind, PotionSize] | null => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-buy]');
      return el ? (el.dataset.buy!.split(':') as [PotionKind, PotionSize]) : null;
    };
    const scrollCell = (e: Event): boolean => !!(e.target as HTMLElement).closest('[data-buy-scroll]');
    buyGrid.addEventListener('click', (e) => {
      if (phoenixCell(e)) return this.g.backend.buyPhoenix(e.shiftKey ? STONE_STACK : 1);
      if (scrollCell(e)) return this.buyReturnScroll(e.shiftKey ? STONE_STACK : 1);
      const c = buyCell(e);
      if (c) this.buyPotion(c[0], c[1], e.shiftKey ? POTION_STACK : 1);
    });
    buyGrid.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (phoenixCell(e)) return this.g.backend.buyPhoenix(STONE_STACK);
      if (scrollCell(e)) return this.buyReturnScroll(STONE_STACK);
      const c = buyCell(e);
      if (c) this.buyPotion(c[0], c[1], POTION_STACK);
    });
    buyGrid.addEventListener('mousemove', (e) => {
      if (phoenixCell(e)) return this.showStoneTip({ stone: 'phoenix', count: 1 }, e, `คลิก: ซื้อ 1 · คลิกขวา: ซื้อ ${STONE_STACK} (อันละ ${PHOENIX_PRICE.toLocaleString()} G)`);
      if (scrollCell(e)) return this.showShopScrollTip(e);
      const c = buyCell(e);
      if (c) this.showShopPotionTip(c[0], c[1], e);
      else this.hideTip();
    });
    buyGrid.addEventListener('mouseleave', () => this.hideTip());
    // Sell by rarity: tick the rarities, then one button sells them all. The ticks are remembered in this browser.
    const ticked = loadSellRarities();
    $('sell-rarity').innerHTML = RARITIES.map((r) =>
      `<label style="color:${RARITY_COLOR[r]}"><input type="checkbox" data-sell="${r}"${ticked.includes(r) ? ' checked' : ''}>` +
      `${RARITY_LABEL[r]} <span class="n" data-sell-n="${r}"></span></label>`).join('');
    $('sell-rarity').addEventListener('change', () => {
      saveSellRarities(this.checkedSellRarities());
      this.renderShopMoney();
    });
    $('sell-checked').onclick = () => this.sellChecked();

    // Warehouse keeper (stash)
    $('stash-close').onclick = () => this.closeStash();
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
      if ((e.target as HTMLElement).closest('[data-buyrow]')) this.buyStashRow();
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
    $('stash-deposit').onclick = () => this.stashGold(1);
    $('stash-withdraw').onclick = () => this.stashGold(-1);
    $('stash-deposit-all').onclick = () => this.stashGold(1, true);
    $('stash-withdraw-all').onclick = () => this.stashGold(-1, true);
    $('stash-gold-amt').addEventListener('keydown', (e) => e.stopPropagation());
    const sortChoice = (): [SortKey, boolean] =>
      [$<HTMLSelectElement>('sort-key').value as SortKey, $('sort-dir').dataset.desc === '1'];
    $('stash-sort-go').onclick = () => {
      g.backend.stashSort(...sortChoice());
      this.hideTip();
      this.markInventory();
    };

    // Blacksmith
    $('forge-close').onclick = () => this.closeForge();
    $('forge-go').onclick = () => (this.forgeMode === 'enhance' ? this.enhance() : this.askReroll(this.forgeMode));
    $('forge-cancel').onclick = () => this.forgePlace(null);
    $('forge-menu').addEventListener('click', (e) => {
      const mode = (e.target as HTMLElement).closest<HTMLElement>('[data-mode]')?.dataset.mode as typeof this.forgeMode | undefined;
      if (!mode || mode === this.forgeMode) return;
      this.forgeMode = mode;
      this.rerollPrev = null;
      this.forgeResult('', '');
      $('forge-rates').classList.add('hidden');
      this.renderForge();
    });
    $('forge-rates-btn').onclick = () => $('forge-rates').classList.toggle('hidden');
    $('forge-rates-close').onclick = () => $('forge-rates').classList.add('hidden');
    const fslot = $('forge-slot');
    fslot.addEventListener('mousemove', (e) => {
      const item = this.forgeItem();
      if (item) this.showTip(item, e, 'ลากชิ้นอื่นมาวางเพื่อเปลี่ยน · ปุ่ม "นำออก" เพื่อเอาออก');
      else this.hideTip();
    });
    fslot.addEventListener('mouseleave', () => this.hideTip());

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
      const stashCell = this.stashOpen ? target?.closest<HTMLElement>('#stash-grid [data-s]') : null;
      // Gear dropped anywhere on the blacksmith's window goes into its slot (worn gear stays worn).
      const forge = this.forgeOpen && d.src !== 'stash' ? target?.closest('#forge') : null;
      if (d.src === 'equip') {
        const worn = this.dragList('equip')[d.i];
        if (forge && worn) this.forgePlace(worn);
        return;
      }
      if (forge) {
        const entry = g.player.bag[d.i];
        if (entry) this.forgePlace(entry);
        return;
      }
      // While trading, dropping a bag item on the trade window offers it (Shift: part of a stack).
      if (d.src === 'bag' && g.trade.isTarget(target)) {
        const entry = g.player.bag[d.i];
        if (!entry) return;
        if (e.shiftKey && isStack(entry) && entry.count > 1) {
          const name = `<b style="color:${this.entryColor(entry)}">${entryName(entry)}</b>`;
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
      const shop = this.shopOpen ? target?.closest<HTMLElement>('#shop') : null;
      if (socket) {
        this.equipByDrag(d.i, socket.dataset.slot as EquipSlot);
      } else if (stashCell) {
        g.backend.stashPut(d.i, Number(stashCell.dataset.s));
      } else if (this.stashOpen && target?.closest('#stash')) {
        g.backend.stashPut(d.i, -1);
      } else if (shop) {
        this.sellFromBag(d.i);
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
        if (this.forgeOpen) this.renderForge();
      }
      this.markInventory();
    });
  }

  /**
   * Shift+drag of a stack (2 or more) onto a bag/stash slot that is empty or holds the same stack with room:
   * opens the amount dialog and moves that many. Returns false (normal drag rules apply) when it doesn't fit that.
   */
  private splitDrag(from: 'bag' | 'stash', i: number, cell: HTMLElement | null | undefined, stashCell: HTMLElement | null | undefined): boolean {
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
    const name = `<b style="color:${this.entryColor(a)}">${entryName(a)}</b>`;
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
    if (this.forgeOpen && this.drag?.src !== 'stash' && t?.closest('#forge')) {
      $('forge-slot').classList.add('drop-target');
      return;
    }
    if (this.drag?.src === 'equip') return;
    let sel = '#bag-grid [data-i], .skill-hp, .skill-mp';
    if (this.drag?.src === 'stash') sel = '#stash-grid [data-s], #bag-grid [data-i], #inventory .inv-window';
    else if (this.stashOpen) sel += ', #stash-grid [data-s], #stash';
    else if (this.shopOpen) sel += ', #shop';
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
    for (const s of this.g.player.cls.skills) add(s.slot, skillIcon(s.id), KEY_LABEL[s.slot]);
    add('hp', potionIcon('hp'), '1');
    add('mp', potionIcon('mp'), '2');
  }

  /** Tooltip for a skill-bar button (skill or potion); desktop only. Skills also ring their reach on the ground. */
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
    if (!sk) return;
    const reach = SKILL_REACH[sk.id];
    const remain = p.cd[kind] ?? 0;
    const stats = [
      sk.mp ? `<div>MP <span class="tt-val">${sk.mp}</span></div>` : '',
      sk.cooldown ? `<div>คูลดาวน์ <span class="tt-val">${sk.cooldown} วิ</span></div>` : '',
      sk.killCdCut ? `<div>ฆ่ามอนได้ ลดคูลดาวน์ที่เหลือ <span class="tt-val">${Math.round(sk.killCdCut * 100)}%</span></div>` : '',
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
    $('hp-text').textContent = hpText;
    $('mp-fill').style.width = mpShare;
    $('mp-text').textContent = mpText;
    $('orb-hp-fill').style.height = hpShare;
    $('orb-hp-text').textContent = hpText;
    $('orb-mp-fill').style.height = mpShare;
    $('orb-mp-text').textContent = mpText;
    $('exp-fill').style.width = `${(p.exp / need) * 100}%`;
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
      if (!sk) continue;
      const remain = p.cd[s.kind] ?? 0;
      s.cd.style.height = sk.cooldown ? `${(remain / sk.cooldown) * 100}%` : '0%';
      s.extra.textContent = remain > 0 ? remain.toFixed(1) : '';
      s.el.classList.toggle('nomp', p.mp < sk.mp);
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

    if (this.shopOpen) {
      if (this.g.npcDistance('merchant') > NPC_USE_RANGE || !p.alive) this.closeShop();
      else this.renderShopMoney();
    }
    if (this.forgeOpen && (this.g.npcDistance('blacksmith') > NPC_USE_RANGE || !p.alive)) this.closeForge();
    this.market.update();
    if (this.stashOpen) {
      if (this.g.npcDistance('keeper') > NPC_USE_RANGE || !p.alive) this.closeStash();
      else this.renderStashMoney();
    }

    this.mmT -= dt;
    if (this.mmT <= 0) {
      this.mmT = 0.1;
      this.drawMinimap();
      if (this.mapOpen) this.fullMap.draw(this.g, this.myPin());
    }
    if ((this.bagOpen || this.stashOpen) && this.invDirty) this.renderInventory();
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
    const pin = this.myPin();
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
    if (this.forgeOpen) this.renderForge();
  }

  toggleBag(force?: boolean): void {
    this.bagOpen = force ?? !this.bagOpen;
    $('inventory').classList.toggle('hidden', !this.bagOpen);
    if (!this.bagOpen) this.hideTip();
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

  // ------------------------------------------------------------ full map

  /** The pin placed in the zone the player is in now, if any. */
  private myPin(): { x: number; z: number } | null {
    return this.pin && this.pin.zone === this.g.backend.zone ? this.pin : null;
  }

  private syncPinUi(): void {
    $('fullmap-clearpin').classList.toggle('hidden', !this.myPin());
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

  toggleMap(force?: boolean): void {
    this.mapOpen = force ?? !this.mapOpen;
    $('fullmap').classList.toggle('hidden', !this.mapOpen);
    if (!this.mapOpen) return;
    const z = this.g.backend.zone;
    $('fullmap-title').textContent = `แผนที่ — ${z.nameTh} (Lv.${z.levels[0]}-${z.levels[1]})`;
    $('fullmap-hint').textContent = this.g.backend.online
      ? 'คลิกซ้ายเพื่อเดินไป · คลิกขวาเพื่อปักหมุด (คลิกขวาที่หมุดเพื่อลบ) · กด M หรือ Esc เพื่อปิด · ออนไลน์จะเห็นจุดมอน/ผู้เล่นเฉพาะที่อยู่ใกล้ตัว'
      : 'คลิกซ้ายเพื่อเดินไป · คลิกขวาเพื่อปักหมุด (คลิกขวาที่หมุดเพื่อลบ) · กด M หรือ Esc เพื่อปิด';
    this.syncPinUi();
    this.fullMap.draw(this.g, this.myPin());
  }

  // ------------------------------------------------------------ auto settings

  toggleAutoSettings(force?: boolean): void {
    const el = $('auto-settings');
    const open = force ?? el.classList.contains('hidden');
    el.classList.toggle('hidden', !open);
    if (open) this.fillAutoSettings();
  }

  /** The range being typed while the settings window is open (clamped), else null. */
  autoRangePreview(): number | null {
    if ($('auto-settings').classList.contains('hidden')) return null;
    const v = Number($<HTMLInputElement>('aset-range').value);
    if (!Number.isFinite(v) || v <= 0) return this.g.player.autoSettings.range;
    return Math.max(AUTO_RANGE_MIN, Math.min(AUTO_RANGE_MAX, v));
  }

  /** Put the player's current settings into the form. */
  private fillAutoSettings(): void {
    const p = this.g.player;
    const s = p.autoSettings;
    $<HTMLInputElement>('aset-range').min = String(AUTO_RANGE_MIN);
    $<HTMLInputElement>('aset-range').max = String(AUTO_RANGE_MAX);
    $<HTMLInputElement>('aset-range').value = String(s.range);
    $('aset-range-hint').textContent = `${AUTO_RANGE_MIN}–${AUTO_RANGE_MAX} px · ${AUTO_PX_PER_UNIT} px = 1 ช่องในแมพ`;
    $<HTMLInputElement>('aset-hp').value = String(s.hpPct);
    $<HTMLInputElement>('aset-mp').value = String(s.mpPct);
    $<HTMLInputElement>('aset-loot').checked = s.loot;
    syncPots($('aset-pots'), p.lootFilter);
    const box = $('aset-skills');
    box.innerHTML = '';
    s.order.forEach((slot, i) => {
      const sk = p.skill(slot);
      const row = document.createElement('div');
      row.className = 'aset-skill';
      row.dataset.slot = slot;
      row.innerHTML =
        `<span class="aset-rank">${i + 1}</span>` +
        `<span class="aset-grab" title="ลากเพื่อสลับลำดับ">${sk ? skillIcon(sk.id) : ''}<b class="aset-key">${slot.toUpperCase()}</b>` +
        `<span class="aset-name">${sk?.nameTh ?? sk?.name ?? '-'}</span></span>` +
        `<button class="aset-move" data-dir="-1" title="เลื่อนขึ้น"${i === 0 ? ' disabled' : ''}>▲</button>` +
        `<button class="aset-move" data-dir="1" title="เลื่อนลง"${i === s.order.length - 1 ? ' disabled' : ''}>▼</button>`;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.title = 'ให้ Auto ใช้สกิลนี้';
      cb.checked = s.skills[slot];
      cb.addEventListener('change', () => this.applyAutoSettings());
      row.append(cb);
      for (const b of row.querySelectorAll<HTMLButtonElement>('.aset-move')) {
        b.onclick = () => {
          const sib = Number(b.dataset.dir) < 0 ? row.previousElementSibling : row.nextElementSibling?.nextElementSibling ?? null;
          if (Number(b.dataset.dir) < 0 && !sib) return;
          box.insertBefore(row, sib);
          this.applyAutoSettings();
        };
      }
      this.dragAutoSkill(box, row, row.querySelector<HTMLElement>('.aset-grab')!);
      box.append(row);
    });
  }

  /** Drag a skill row by its icon and name to a new place in the order (mouse or finger). */
  private dragAutoSkill(box: HTMLElement, row: HTMLElement, grab: HTMLElement): void {
    grab.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const start = [...box.children].indexOf(row);
      const id = e.pointerId;
      row.classList.add('dragging');
      // Listen on window, not with pointer capture: moving the row in the DOM drops capture in Chromium.
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        // The row goes before the first other row whose middle is below the pointer.
        const rest = [...box.children].filter((c) => c !== row) as HTMLElement[];
        const before = rest.find((c) => { const r = c.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; }) ?? null;
        if (before === row.nextElementSibling) return;
        box.insertBefore(row, before);
        box.querySelectorAll('.aset-rank').forEach((r, i) => { r.textContent = String(i + 1); });
      };
      const end = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        row.classList.remove('dragging');
        if ([...box.children].indexOf(row) !== start) this.applyAutoSettings();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    });
  }

  /** Read the form, clamp it, send it, then show the clamped values. */
  private applyAutoSettings(): void {
    const num = (id: string) => Number($<HTMLInputElement>(id).value);
    const skills = { ...this.g.player.autoSettings.skills };
    const order: AutoSkill[] = [];
    for (const row of $('aset-skills').querySelectorAll<HTMLElement>('.aset-skill')) {
      const slot = row.dataset.slot as AutoSkill;
      order.push(slot);
      skills[slot] = row.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked;
    }
    const s = cleanAutoSettings({
      range: num('aset-range'), hpPct: num('aset-hp'), mpPct: num('aset-mp'), skills, order, loot: $<HTMLInputElement>('aset-loot').checked,
      rangeSet: this.g.player.autoSettings.rangeSet || num('aset-range') !== this.g.player.autoSettings.range,
    });
    this.g.backend.setAutoSettings(s);
    this.fillAutoSettings();
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
    this.closeChat();
    this.toggleAutoSettings(false);
    this.toggleMap(false);
    this.toggleBag(false);
    this.toggleHelp(false);
    this.closeShop();
    this.closeStash();
    this.closeForge();
    this.market.close();
    this.g.party.toggle(false);
    this.g.trade.toggleFind(false);
    this.g.mailUI.toggle(false);
    this.g.report.toggle(false);
    this.g.megaphone.toggle(false);
    this.g.daily.toggle(false);
    this.g.friends.toggle(false);
    this.g.cosmetics.toggle(false);
    if (this.dialogOpen) this.closeDialog();
  }

  talkTo(id: NpcId): void {
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
    else this.openForge();
  }

  // ------------------------------------------------------------ confirm

  confirm(html: string, yesLabel: string, onYes: () => void): void {
    $('confirm-text').innerHTML = html;
    $('confirm-yes').textContent = yesLabel;
    this.confirmYes = onYes;
    $('confirm').classList.remove('hidden');
  }

  private closeConfirm(): void {
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

  // ------------------------------------------------------------ merchant

  /** Market broker: the window lives in market.ts. Guests may look but not trade (the server refuses it too). */
  private openMarket(): void {
    this.closeShop();
    this.closeForge();
    this.closeStash();
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
    this.closeForge();
    this.closeStash();
    this.shopOpen = true;
    $('shop').classList.remove('hidden');
    this.toggleBag(true);
    this.renderShopMoney();
  }

  private closeShop(): void {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    $('shop').classList.add('hidden');
    this.closeConfirm();
    this.markInventory();
  }

  private renderShopMoney(): void {
    const p = this.g.player;
    $('shop-gold').innerHTML = `${COIN_ICON} ${p.gold.toLocaleString()} G`;
    $('shop-pots').innerHTML = this.potionTotals();
    this.renderBuyback();
    this.renderSellRarity();
    $('shop-buy').querySelectorAll<HTMLElement>('[data-buy]').forEach((el) => {
      const [kind, size] = el.dataset.buy!.split(':') as [PotionKind, PotionSize];
      el.classList.toggle('poor', p.gold < POTIONS[kind][size].price || p.potionRoom(kind, size) < 1);
    });
    $('shop-buy').querySelector('[data-phoenix]')?.classList.toggle('poor', p.gold < PHOENIX_PRICE || p.stoneRoom('phoenix') < 1);
    $('shop-buy').querySelector('[data-buy-scroll]')?.classList.toggle('poor', p.gold < RETURN_SCROLL_PRICE || p.stoneRoom('return_scroll') < 1);
  }

  private potionTotals(): string {
    const p = this.g.player;
    return `${potionIcon('hp')} ${p.potionCount('hp')} &nbsp; ${potionIcon('mp')} ${p.potionCount('mp')}`;
  }

  /** Switches the merchant window between buying potions and buying back sold items. */
  private setShopTab(tab: 'buy' | 'buyback'): void {
    $('shop-tabs').querySelectorAll<HTMLElement>('[data-tab]').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    $('shop').querySelectorAll<HTMLElement>('[data-pane]').forEach((b) => b.classList.toggle('hidden', b.dataset.pane !== tab));
    this.hideTip();
  }

  /** Tooltip for a potion on sale: what it does and what one or a stack costs. */
  private showShopPotionTip(kind: PotionKind, size: PotionSize, e: MouseEvent): void {
    const tip = $('tooltip');
    const price = POTIONS[kind][size].price;
    tip.innerHTML =
      `<div class="tt-name" style="color:${POTION_COLOR[kind]}">${potionName(kind, size)}</div>` +
      `<div class="tt-stats"><div>ฟื้น ${potionHeal(kind, size, this.g.player.cls.id)} ${kind.toUpperCase()} ต่อขวด</div></div>` +
      `<div class="tt-hint">คลิก: ซื้อ 1 (${price} G) · คลิกขวา: ซื้อ ${POTION_STACK} (${price * POTION_STACK} G)</div>` +
      `<div class="tt-val">มีอยู่ ${this.g.player.potionCount(kind, size)} ขวด</div>`;
    this.placeTip(tip, e);
  }

  /** Tooltip for the return scroll on sale. */
  private showShopScrollTip(e: MouseEvent): void {
    const tip = $('tooltip');
    const k = 'return_scroll';
    tip.innerHTML =
      `<div class="tt-name" style="color:${STONE_COLOR[k]}">${STONE_NAME[k]}</div>` +
      `<div class="tt-stats"><div>${STONE_DESC[k]}</div></div>` +
      `<div class="tt-hint">คลิก: ซื้อ 1 (${RETURN_SCROLL_PRICE} G) · คลิกขวา: ซื้อ ${STONE_STACK} (${(RETURN_SCROLL_PRICE * STONE_STACK).toLocaleString()} G)</div>` +
      `<div class="tt-val">มีอยู่ ${this.g.player.stoneCount(k)} ม้วน</div>`;
    this.placeTip(tip, e);
  }

  private buyReturnScroll(n: number): void {
    this.g.backend.buyReturnScroll(n);
    this.afterTrade();
  }

  /** Sells bag slot `i` to the merchant, asking first for a potion stack or an enhanced (+N) item. */
  private sellFromBag(i: number): void {
    const g = this.g;
    const item = g.player.bag[i];
    if (!item || !this.shopOpen) return;
    const name = `<b style="color:${this.entryColor(item)}">${entryName(item)}</b>`;
    const sell = () => {
      if (g.player.bag[i] !== item) return;
      g.backend.sell(i);
      this.afterTrade();
    };
    // A stack of 2+: ask how many to sell (the whole stack is the default).
    if (isStack(item) && item.count > 1) {
      const each = isPotion(item) ? potionSellPrice(item.potion, item.size) : stoneSellPrice(item.stone);
      const unit = isPotion(item) ? 'ขวด' : stoneUnit(item.stone);
      this.askAmount(
        `ขาย ${name} กี่${unit}?<br><small>${unit}ละ ${each.toLocaleString()} G${isStone(item) ? ' · ซื้อคืนไม่ได้' : ''}</small>`,
        item.count, item.count,
        (n) => {
          if (g.player.bag[i] !== item || item.count < n) return;
          g.backend.sell(i, n >= item.count ? undefined : n);
          this.afterTrade();
        },
      );
      return;
    }
    if (isPotion(item)) {
      sell();
      return;
    }
    if (isStone(item)) {
      // Boss-only stones: always ask, they are hard to get back.
      this.confirm(`ขาย ${name}?<br><small>ได้ ${stoneStackValue(item).toLocaleString()} G (${stoneUnit(item.stone)}ละ ${stoneSellPrice(item.stone).toLocaleString()} G) · ซื้อคืนไม่ได้</small>`, 'ขาย', sell);
      return;
    }
    if ((item.plus ?? 0) > 0) {
      const v = sellValue(item);
      this.confirm(
        `ขาย ${name}?<br><small>ของชิ้นนี้ตีบวกแล้ว · ได้ ${v.toLocaleString()} G · ซื้อคืนได้ ${buybackPrice({ item, paid: v }).toLocaleString()} G ภายใน 30 นาที</small>`,
        'ขาย', sell,
      );
      return;
    }
    sell();
  }

  /** Redraws the buyback grid when the list changes; the timer and affordability every frame. */
  private renderBuyback(): void {
    const p = this.g.player;
    const key = p.buyback.map((e) => e.item.uid).join(',');
    const grid = $('buyback-grid');
    if (key !== this.buybackKey) {
      this.buybackKey = key;
      grid.innerHTML = p.buyback.length
        ? p.buyback.map((e, i) => this.itemCell(e.item, `data-bb="${i}"`)).join('')
        : '<div class="empty-note">ยังไม่มีของที่ขายไป</div>';
      grid.querySelectorAll<HTMLElement>('[data-bb]').forEach((el) => {
        const e = p.buyback[Number(el.dataset.bb)];
        el.insertAdjacentHTML('beforeend', `<span class="cell-price">${buybackPrice(e).toLocaleString()}</span>`);
      });
    }
    grid.querySelectorAll<HTMLElement>('[data-bb]').forEach((el) => {
      const e = p.buyback[Number(el.dataset.bb)];
      el.classList.toggle('poor', !e || p.gold < buybackPrice(e));
    });
    $('buyback-count').textContent = p.buyback.length ? `(${p.buyback.length})` : '';
    const s = Math.max(0, Math.ceil(p.buybackLeft));
    $('buyback-timer').textContent = `รีเซตใน ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  private buyPotion(kind: PotionKind, size: PotionSize, n: number): void {
    this.g.backend.buyPotion(kind, size, n);
    this.afterTrade();
  }

  private checkedSellRarities(): Rarity[] {
    return [...$('sell-rarity').querySelectorAll<HTMLInputElement>('input[data-sell]')]
      .filter((c) => c.checked)
      .map((c) => c.dataset.sell as Rarity);
  }

  /** Bag items the "sell ticked" button would sell (enhanced items never). */
  private checkedSellItems(): Item[] {
    const rs = this.checkedSellRarities();
    return this.g.player.bag.filter((e): e is Item => rs.some((r) => isBulkSellable(e, r)));
  }

  /** Item counts next to each tick box, and what the sell button would do. */
  private renderSellRarity(): void {
    const bag = this.g.player.bag;
    for (const r of RARITIES) {
      const n = bag.filter((e) => isBulkSellable(e, r)).length;
      const el = $('sell-rarity').querySelector<HTMLElement>(`[data-sell-n="${r}"]`);
      if (el) el.textContent = `(${n})`;
    }
    const items = this.checkedSellItems();
    const total = items.reduce((s, it) => s + sellValue(it), 0);
    const btn = $<HTMLButtonElement>('sell-checked');
    btn.disabled = !items.length;
    btn.textContent = items.length ? `ขายที่เลือก ${items.length} ชิ้น · ${total.toLocaleString()} G` : 'ขายที่เลือก';
  }

  private sellChecked(): void {
    const rs = this.checkedSellRarities();
    const items = this.checkedSellItems();
    if (!rs.length) {
      this.log('ติ๊กเลือกระดับที่จะขายก่อน', '#b9b09a');
      return;
    }
    if (!items.length) {
      this.log('ไม่มีของระดับที่เลือกในกระเป๋า (ของที่ตีบวกแล้วจะไม่ถูกขาย)', '#b9b09a');
      return;
    }
    const total = items.reduce((s, it) => s + sellValue(it), 0);
    const labels = rs.map((r) => `<b style="color:${RARITY_COLOR[r]}">${RARITY_LABEL[r]}</b>`).join(', ');
    this.confirm(`ขายของระดับ ${labels} ทั้งหมด ${items.length} ชิ้น?<br><small>ได้ ${total.toLocaleString()} G · ของที่ตีบวกแล้วจะไม่ถูกขาย · ซื้อคืนได้ภายใน 30 นาที</small>`, 'ขายทั้งหมด', () => {
      const bag = this.g.player.bag;
      for (const r of rs) if (bag.some((e) => isBulkSellable(e, r))) this.g.backend.sellAllOfRarity(r);
      this.afterTrade();
    });
  }

  /** The trade itself (and its log line / save) happens in the simulation; just refresh the panels. */
  private afterTrade(): void {
    this.markInventory();
    this.renderShopMoney();
  }

  // ------------------------------------------------------------ warehouse keeper (stash)

  private openStash(): void {
    this.closeShop();
    this.closeForge();
    this.market.close();
    this.stashOpen = true;
    $('stash').classList.remove('hidden');
    this.toggleBag(true);
    this.markInventory();
    this.renderStash();
  }

  private closeStash(): void {
    if (!this.stashOpen) return;
    this.stashOpen = false;
    $('stash').classList.add('hidden');
    this.closeConfirm();
    this.hideTip();
    this.markInventory();
  }

  /** Bought slots, then one locked bar per row not bought yet (only the next one can be bought). */
  private renderStash(): void {
    const st = this.g.player.stash;
    let html = st.items.map((it, i) => this.itemCell(it, `data-s="${i}"`)).join('');
    for (let size = st.size; size < STASH_MAX; size += STASH_ROW) {
      const price = STASH_ROW_PRICES[(size - STASH_START) / STASH_ROW];
      const next = size === st.size;
      html += `<div class="stash-row-lock">🔒 แถวที่ ${size / STASH_ROW + 1} (+${STASH_ROW} ช่อง)` +
        `<button ${next ? 'data-buyrow' : 'disabled title="ซื้อแถวก่อนหน้าก่อน"'}>ซื้อ ${price.toLocaleString()} G</button></div>`;
    }
    $('stash-grid').innerHTML = html;
    $('stash-size').textContent = `ใช้ไป ${st.items.filter(Boolean).length} / ${st.size} ช่อง`;
    this.renderStashMoney();
  }

  private renderStashMoney(): void {
    const p = this.g.player;
    $('stash-gold-in').textContent = `${p.stash.gold.toLocaleString()} G`;
    $('stash-gold-carry').innerHTML = `ถืออยู่ ${COIN_ICON} ${p.gold.toLocaleString()} G`;
  }

  private buyStashRow(): void {
    const p = this.g.player;
    const price = nextRowPrice(p.stash);
    if (price === null) return;
    if (p.gold < price) {
      this.log(`ทองไม่พอ — ต้องใช้ ${price.toLocaleString()} G`, '#ff8a6a');
      return;
    }
    this.confirm(
      `ขยายคลังอีก ${STASH_ROW} ช่อง (${p.stash.size} → ${p.stash.size + STASH_ROW})?<br><small>จ่าย ${price.toLocaleString()} G · ใช้ได้ทุกตัวละครในบัญชี</small>`,
      `จ่าย ${price.toLocaleString()} G`,
      () => {
        this.g.backend.stashBuyRow();
        this.markInventory();
      },
    );
  }

  /** dir 1 = deposit the typed amount, -1 = withdraw it. `all` = every coin carried / stored instead. */
  private stashGold(dir: 1 | -1, all = false): void {
    const input = $<HTMLInputElement>('stash-gold-amt');
    const p = this.g.player;
    const amount = all ? (dir > 0 ? p.gold : p.stash.gold) : Math.floor(Number(input.value));
    if (all && amount <= 0) {
      this.log(dir > 0 ? 'ไม่มีทองติดตัว' : 'ไม่มีทองในคลัง', '#b9b09a');
      return;
    }
    if (!(amount > 0)) {
      this.log('ใส่จำนวนทองก่อน', '#b9b09a');
      return;
    }
    if (dir > 0 && amount > p.gold) {
      this.log(`ทองที่ถืออยู่ไม่พอ (มี ${p.gold.toLocaleString()} G)`, '#ff8a6a');
      return;
    }
    if (dir < 0 && amount > p.stash.gold) {
      this.log(`ทองในคลังไม่พอ (มี ${p.stash.gold.toLocaleString()} G)`, '#ff8a6a');
      return;
    }
    this.g.backend.stashGold(dir * amount);
    input.value = '';
    this.markInventory();
  }

  // ------------------------------------------------------------ blacksmith

  private openForge(): void {
    this.closeShop();
    this.closeStash();
    this.market.close();
    this.forgeOpen = true;
    // Owner: the slot starts empty and the bag opens beside it, ready to drag from.
    this.forgeSel = null;
    this.rerollPrev = null;
    this.forgeResult('', '');
    $('forge-rates').classList.add('hidden');
    $('forge').classList.remove('hidden');
    this.toggleBag(true);
    this.renderForge();
  }

  private closeForge(): void {
    if (!this.forgeOpen) return;
    this.forgeOpen = false;
    this.forgeSel = null;
    $('forge').classList.add('hidden');
    this.closeConfirm();
    this.markInventory();
  }

  /** Everything the blacksmith can work on: worn gear (weapon first), then gear in the bag. */
  private forgeItems(): Item[] {
    const p = this.g.player;
    const list: Item[] = [];
    for (const slot of EQUIP_SLOTS) {
      const it = p.equipment[slot];
      if (it) list.push(it);
    }
    for (const it of p.bag) if (isItem(it)) list.push(it);
    return list;
  }

  /** The item in the forge's slot, if it is still worn or in the bag. */
  private forgeItem(): Item | undefined {
    return this.forgeSel ? this.forgeItems().find((w) => w.uid === this.forgeSel) : undefined;
  }

  /** Puts gear in the forge's slot (null empties it). Potions and stones are turned away. */
  private forgePlace(entry: BagEntry | null): void {
    if (entry && !isItem(entry)) {
      this.log('ช่างตีเหล็กรับเฉพาะอุปกรณ์สวมใส่ (ไม่รับยาและหิน)', '#ff8a6a');
      return;
    }
    if (entry?.uid !== this.forgeSel) this.rerollPrev = null;
    this.forgeSel = entry?.uid ?? null;
    this.forgeResult('', '');
    this.renderForge();
  }

  /** The result that shows over the slot after an attempt (cls: ok / fail, '' clears it). */
  private forgeResult(cls: '' | 'ok' | 'fail', text: string): void {
    const res = $('forge-result');
    res.className = cls;
    res.textContent = text;
    const stage = $('forge-stage');
    stage.classList.remove('flash-ok', 'flash-fail');
    if (cls) {
      void stage.offsetWidth; // restart the flash
      stage.classList.add(`flash-${cls}`);
    }
  }

  private renderForge(): void {
    const p = this.g.player;
    const mode = this.forgeMode;
    for (const b of $('forge-menu').querySelectorAll<HTMLElement>('[data-mode]')) b.classList.toggle('active', b.dataset.mode === mode);
    $('forge-desc').textContent = FORGE_DESC[mode];
    // Odds table: enhance rates, or what "สุ่มสเตตัส" can give (for the item placed, if any).
    const hasRates = mode === 'enhance' || mode === 'stat';
    $('forge-rates-btn').classList.toggle('hidden', !hasRates);
    if (!hasRates) $('forge-rates').classList.add('hidden');

    const item = this.forgeItem();
    if (!item) this.forgeSel = null; // sold, dropped or stored since
    if (hasRates) {
      const btn = mode === 'enhance' ? 'ตารางโอกาสสำเร็จ' : 'ตารางโอกาส';
      const title = mode === 'enhance' ? 'ตารางโอกาสสำเร็จ / โบนัส' : 'ตารางโอกาส — สุ่มสเตตัส';
      const table = mode === 'enhance' ? this.rateTable() : this.statOddsTable(item);
      if ($('forge-rates-btn').textContent !== btn) $('forge-rates-btn').textContent = btn;
      if ($('forge-rates-title').textContent !== title) $('forge-rates-title').textContent = title;
      if ($('forge-table').innerHTML !== table) $('forge-table').innerHTML = table;
    }
    const stones: StoneKind[] = mode === 'enhance' ? ['enhance', 'protect'] : [REROLL_STONE[mode]];
    $('forge-foot').innerHTML = `<span class="ff-gold">${COIN_ICON} ${p.gold.toLocaleString()} G</span>` +
      stones.map((s) => `<span class="ff-stone" title="${STONE_NAME[s]}">${stoneIcon(s)} ${STONE_NAME[s]} ${p.stoneCount(s)}</span>`).join('');

    const slot = $('forge-slot');
    const go = $<HTMLButtonElement>('forge-go');
    $<HTMLButtonElement>('forge-cancel').disabled = !item;
    slot.className = item ? 'filled' : '';
    if (item) slot.style.setProperty('--rc', RARITY_COLOR[item.rarity]);
    else slot.style.removeProperty('--rc');
    const label = `${FORGE_ICON} ${mode === 'enhance' ? 'ตีบวก' : REROLL_NAME[mode]}`;
    if (!item) {
      slot.innerHTML = '';
      $('forge-drop-hint').innerHTML = 'ลากอุปกรณ์มาวางที่นี่<small>หรือคลิกอุปกรณ์ในกระเป๋า / ที่สวมอยู่</small>';
      $('forge-item').innerHTML = '<div class="fi-empty">ยังไม่ได้วางอุปกรณ์</div>';
      $('forge-cost').innerHTML = '';
      go.disabled = true;
      go.innerHTML = label;
      return;
    }
    const cur = plusOf(item);
    slot.innerHTML = itemIcon(item) + (cur ? `<span class="iplus">+${cur}</span>` : '');
    $('forge-drop-hint').innerHTML = `<span style="color:${RARITY_COLOR[item.rarity]}">${itemName(item)}</span>`;
    const worn = Object.values(p.equipment).includes(item);
    $('forge-item').innerHTML =
      `<div class="fi-name" style="color:${RARITY_COLOR[item.rarity]}">${itemName(item)}</div>` +
      `<div class="fi-meta">${SLOT_LABEL[item.slot]} · ${worn ? 'สวมใส่อยู่' : 'ในกระเป๋า'} · iLv.${item.level}` +
      ` · ${cur ? `+${cur} (โบนัส +${bonusPct(cur)}%)` : 'ยังไม่ตีบวก'}</div>` +
      `<div class="fi-lines">${this.forgeLines(item, mode)}</div>`;
    const why = mode === 'enhance' ? this.renderEnhanceCost(item) : this.renderRerollCost(item, mode);
    go.disabled = !!why;
    go.innerHTML = why || label;
  }

  /** The item's stat lines as they are now; after a reroll, what each line was before it. */
  private forgeLines(item: Item, mode: 'enhance' | RerollKind): string {
    const r1 = (v: number) => fmtNum(Math.round(v * 10) / 10);
    if (!item.lines?.length) {
      // Items from before tiers: totals only.
      const stats = effectiveStats(item);
      return (Object.keys(stats) as StatKey[]).map((k) => `<div class="fd-line">+${r1(stats[k] ?? 0)} ${STAT_LABEL[k]}</div>`).join('');
    }
    const ranges = lineRanges(item);
    const hasExtra = !!ranges?.some((r) => !r.main);
    const prev = mode !== 'enhance' && this.rerollPrev?.uid === item.uid ? this.rerollPrev.lines : null;
    return item.lines.map((l, i) => {
      const fixed = mode === 'stat' && hasExtra && !!ranges?.[i]?.main;
      const was = prev?.[i];
      const changed = was && (was.stat !== l.stat || was.value !== l.value || was.tier !== l.tier);
      const note = fixed ? '<span class="was">หลัก ไม่เปลี่ยน</span>'
        : changed && was.stat !== l.stat ? `<span class="was">เดิม +${fmtNum(was.value)} ${STAT_LABEL[was.stat]}</span>`
        // Same stat: how much it moved, green up or red down.
        : changed && was.value !== l.value ? `<span class="${l.value > was.value ? 'up' : 'down'}">${l.value > was.value ? '+' : '−'}${fmtNum(Math.abs(l.value - was.value))}</span>`
        : changed ? '<span class="was">เท่าเดิม</span>'
        : prev ? '<span class="was">เท่าเดิม</span>' : '';
      return `<div class="fd-line${fixed ? ' fixed' : ''}"><span>${this.lineHtml(l)}</span>${note}</div>`;
    }).join('');
  }

  /** Enhance: success chance, cost, stones and the protection tick box. Returns why it can't be done ('' = it can). */
  private renderEnhanceCost(item: Item): string {
    const p = this.g.player;
    const cur = plusOf(item);
    if (cur >= MAX_PLUS) {
      $('forge-cost').innerHTML = `<div class="fc-max">ตีบวกถึงระดับสูงสุด +${MAX_PLUS} แล้ว</div>`;
      return 'ระดับสูงสุดแล้ว';
    }
    const cost = enhanceCost(item);
    const rate = successRate(item);
    const pity = pityBonus(item);
    const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
    const hidden = cur + 1 >= HIDDEN_RATE_FROM;
    const pityNote = pity <= 0 ? ''
      : hidden ? `<small class="pity">ล้มมาแล้ว ${item.pity} ครั้ง (โอกาสเพิ่มขึ้น)</small>`
      : `<small class="pity">รวม +${pct(pity)} จากล้ม ${item.pity} ครั้ง</small>`;
    const need = stonesNeeded(item);
    const haveEnh = p.stoneCount('enhance');
    const canProtect = dropsOnFail(item);
    const haveProt = p.stoneCount('protect');
    if (haveProt < 1) this.forgeProtect = false;
    const protect = canProtect && this.forgeProtect;
    $('forge-cost').innerHTML =
      `<div class="fc-rate"${rate < 1 ? ` title="ล้มแต่ละครั้ง โอกาสครั้งถัดไป +${pct(PITY_STEP)} จนกว่าจะสำเร็จ"` : ''}><span>โอกาสสำเร็จ +${cur} → +${cur + 1}</span><b class="${rate < 1 ? 'risky' : ''}">${hidden ? '??' : pct(rate)}</b>` +
      `${pityNote}</div>` +
      `<div class="fd-row"><span>ค่าตีบวก</span><b class="${p.gold < cost ? 'bad' : ''}">${cost.toLocaleString()} G</b></div>` +
      (need ? `<div class="fd-row"><span>${stoneIcon('enhance')} ${STONE_NAME.enhance}</span><b class="${haveEnh < need ? 'bad' : ''}">ใช้ ${need} / มี ${haveEnh}</b></div>` : '') +
      (canProtect
        ? `<label class="fd-protect${haveProt < 1 ? ' off' : ''}"><input type="checkbox" id="forge-protect"${protect ? ' checked' : ''}${haveProt < 1 ? ' disabled' : ''}>` +
          `${stoneIcon('protect')} ใช้${STONE_NAME.protect} (มี ${haveProt})</label>` +
          (protect
            ? '<div class="safe">ถ้าล้มเหลว เสียทองและหิน แต่ระดับเท่าเดิม</div>'
            : `<div class="warn">⚠ ถ้าล้มเหลว ระดับลดเหลือ +${cur - 1}</div>`)
        : `<div class="safe">${rate >= 1 ? 'สำเร็จแน่นอน' : 'ถ้าล้มเหลว เสียแค่ทอง ระดับเท่าเดิม'}</div>`);
    (document.getElementById('forge-protect') as HTMLInputElement | null)?.addEventListener('change', (e) => {
      this.forgeProtect = (e.target as HTMLInputElement).checked;
      this.renderForge();
    });
    return p.gold < cost ? 'ทองไม่พอ' : haveEnh < need ? `${STONE_NAME.enhance}ไม่พอ` : '';
  }

  /** The reroll menus: what gets rerolled, the stone and the cost. Returns why it can't be done ('' = it can). */
  private renderRerollCost(item: Item, kind: RerollKind): string {
    const p = this.g.player;
    const block = rerollBlock(item);
    const ranges = lineRanges(item);
    if (block || !ranges || !item.lines) {
      $('forge-cost').innerHTML = `<div class="bad">${block ?? ''}</div>`;
      return 'สุ่มไม่ได้';
    }
    const hasExtra = ranges.some((r) => !r.main);
    const what = kind === 'values'
      ? 'ทุกบรรทัดได้ค่าใหม่ในช่วงของ tier เดิม'
      : hasExtra
        ? 'สุ่ม 1 บรรทัดจากสเตตัสเสริม · สเตตัสหลักไม่เปลี่ยน'
        : 'ไม่มีสเตตัสเสริม: สุ่ม tier และค่าใหม่ให้สเตตัสหลัก 1 บรรทัด (ชนิดเดิม)';
    const cost = rerollCost(item, kind);
    const stone = REROLL_STONE[kind];
    const have = p.stoneCount(stone);
    $('forge-cost').innerHTML =
      `<div class="safe">${what}${plusOf(item) ? ` · ระดับ +${plusOf(item)} ยังอยู่` : ''}</div>` +
      `<div class="fd-row"><span>${stoneIcon(stone)} ${STONE_NAME[stone]}</span><b class="${have < 1 ? 'bad' : ''}">ใช้ 1 / มี ${have}</b></div>` +
      `<div class="fd-row"><span>ค่าบริการ</span><b class="${p.gold < cost ? 'bad' : ''}">${cost.toLocaleString()} G</b></div>`;
    return have < 1 ? `ไม่มี${STONE_NAME[stone]}` : p.gold < cost ? 'ทองไม่พอ' : '';
  }

  /** One line as the blacksmith shows it: value, stat, tier and the tier's range. */
  private lineHtml(l: StatLine): string {
    return `+${fmtNum(l.value)} ${STAT_LABEL[l.stat]} <span class="tier t${l.tier}">T${l.tier}: ${fmtNum(l.min)}–${fmtNum(l.max)}</span>`;
  }

  /** Asks first (the old values are gone for good), then rerolls the selected item. */
  private askReroll(kind: RerollKind): void {
    const item = this.forgeItems().find((w) => w.uid === this.forgeSel);
    const ranges = item && lineRanges(item);
    if (!item || !ranges || !item.lines || this.enhancing || this.forgeCooling()) return;
    const over = item.lines.some((l) => l.value > l.max);
    this.confirm(
      `${REROLL_NAME[kind]} ${itemName(item)}?<br><small>ค่าบริการ ${rerollCost(item, kind).toLocaleString()} G + ${STONE_NAME[REROLL_STONE[kind]]} 1 ก้อน · ค่าเดิมจะหายไป ย้อนคืนไม่ได้` +
      `${over ? '<br>⚠ มีสเตตัสที่เกินช่วงปกติ จะกลับเข้าช่วงปกติ' : ''}</small>`,
      REROLL_NAME[kind],
      () => void this.reroll(item, kind),
    );
  }

  private async reroll(item: Item, kind: RerollKind): Promise<void> {
    if (this.enhancing || this.forgeCooling()) return;
    const before = (item.lines ?? []).map((l) => ({ ...l }));
    this.enhancing = true;
    this.startForgeCd();
    const [out] = await Promise.all([this.g.backend.reroll(item.uid, kind), this.swingHammer()])
      .finally(() => (this.enhancing = false));
    if (!out) {
      this.forgeResult('fail', 'สุ่มไม่สำเร็จ');
      return;
    }
    this.rerollPrev = { uid: item.uid, lines: before };
    this.forgeResult('ok', `${REROLL_NAME[kind]}แล้ว`);
    this.markInventory();
    this.renderForge();
  }

  /** True while the blacksmith cooldown (FORGE_CD) is running. */
  private forgeCooling(): boolean {
    return performance.now() < this.forgeReadyAt;
  }

  /** Starts the blacksmith cooldown: the action button shows a draining bar until it ends. */
  private startForgeCd(): void {
    this.forgeReadyAt = performance.now() + FORGE_CD * 1000;
    const go = $('forge-go');
    go.style.setProperty('--cd', `${FORGE_CD}s`);
    go.classList.remove('cooling');
    void go.offsetWidth; // restart the bar
    go.classList.add('cooling');
    setTimeout(() => {
      if (!this.forgeCooling()) go.classList.remove('cooling');
    }, FORGE_CD * 1000 + 20);
  }

  /** Swings the hammer over the forge slot; resolves when it has struck, so the result shows after the hit. */
  private swingHammer(): Promise<void> {
    const ms = 600;
    const el = $('forge-hammer');
    el.style.setProperty('--swing', `${ms}ms`);
    el.classList.remove('swing');
    void el.offsetWidth; // restart the animation
    el.classList.add('swing');
    return new Promise((done) => setTimeout(() => {
      el.classList.remove('swing');
      done();
    }, ms));
  }

  private async enhance(): Promise<void> {
    if (!this.forgeSel || this.enhancing || this.forgeCooling()) return;
    const sel = this.forgeItems().find((w) => w.uid === this.forgeSel);
    const protect = !!sel && dropsOnFail(sel) && this.forgeProtect;
    this.enhancing = true;
    this.startForgeCd();
    const [out] = await Promise.all([this.g.backend.enhance(this.forgeSel, protect), this.swingHammer()])
      .finally(() => (this.enhancing = false));
    if (!out) return;
    const { result, item } = out;
    if (result === 'success') {
      this.forgeResult('ok', `สำเร็จ! ${itemName(item)}`);
    } else {
      this.forgeResult('fail', result === 'drop' ? `ล้มเหลว! ระดับลดลงเหลือ +${plusOf(item)}`
        : result === 'saved' ? `ล้มเหลว… หินกันระดับลดทำงาน ระดับยังเป็น +${plusOf(item)}`
        : 'ล้มเหลว… ระดับเท่าเดิม');
    }
    this.markInventory();
    this.renderForge();
  }

  /** "สุ่มสเตตัส": which stats an extra line can become and the tier chances, for this item if one is placed. */
  private statOddsTable(item: Item | undefined): string {
    const odds = statRerollOdds(item);
    const pct = (c: number) => `${Math.round(c * 1000) / 10}%`;
    const forItem = !!item && !!lineRanges(item);
    let html = `<div class="odds-sub">${odds.mainOnly ? 'สเตตัสหลักที่อาจถูกสุ่ม' : 'ชนิดสเตตัสที่อาจได้'}${forItem ? ' (ชิ้นนี้)' : ''}</div>` +
      '<table class="odds-stats"><tr><th>สเตตัส</th><th>โอกาส</th></tr>';
    for (const s of odds.stats) {
      html += `<tr class="${s.chance > 0 ? '' : 'off'}"><td>${STAT_LABEL[s.stat]}</td><td>${s.chance > 0 ? pct(s.chance) : 'ซ้ำบรรทัดอื่น'}</td></tr>`;
    }
    html += '</table><div class="odds-sub">โอกาสได้แต่ละ tier</div><table><tr>' +
      odds.tiers.map((_, i) => `<th><span class="tier t${i + 1}">T${i + 1}</span></th>`).join('') + '</tr><tr>' +
      odds.tiers.map((c) => `<td>${pct(c)}</td>`).join('') + '</tr></table>';
    const note = odds.mainOnly
      ? 'ชิ้นนี้ไม่มีสเตตัสเสริม: สุ่มแค่ tier และค่าของสเตตัสหลัก 1 บรรทัด ชนิดไม่เปลี่ยน'
      : 'สุ่มเปลี่ยนสเตตัสเสริม 1 บรรทัด ทุกบรรทัดมีโอกาสเท่ากัน · ไม่ซ้ำกับสเตตัสเสริมบรรทัดอื่น · สเตตัสหลักไม่เปลี่ยน' +
        (forItem ? '' : ' · วางอุปกรณ์เพื่อดูโอกาสของชิ้นนั้น');
    return html + `<div class="hint">${note}</div>`;
  }

  private rateTable(): string {
    let html = '<table><tr><th>บวก</th><th>สำเร็จ</th><th>ถ้าล้ม</th><th>หินตีบวก</th><th>โบนัสรวม</th></tr>';
    for (let t = 1; t <= MAX_PLUS; t++) {
      const fail = rateFor(t) >= 1 ? '—' : t >= DROP_ON_FAIL_FROM ? 'ระดับ −1' : 'เสียแค่ทอง';
      html += `<tr><td>+${t}</td><td>${t >= HIDDEN_RATE_FROM ? '??' : `${Math.round(rateFor(t) * 1000) / 10}%`}</td><td>${fail}</td>` +
        `<td>${t >= STONE_FROM ? ENHANCE_STONES_PER_TRY : '—'}</td><td>+${bonusPct(t)}%</td></tr>`;
    }
    return html + '</table><div class="hint">ตีบวกได้ทุกช่อง (อาวุธ หมวก เกราะ รองเท้า แหวน) · โบนัสเป็น % ของทุกค่าบนชิ้นนั้น' +
      ` · ล้มแต่ละครั้งเพิ่มโอกาส +${Math.round(PITY_STEP * 100)}% จนกว่าจะสำเร็จ` +
      ` · ${STONE_NAME.protect}กันระดับลด, ${STONE_NAME.enhance}ใช้ตั้งแต่ +${STONE_FROM} — ดรอปจากบอสเท่านั้น</div>`;
  }

  private entryColor(e: BagEntry): string {
    return isPotion(e) ? POTION_COLOR[e.potion] : isStone(e) ? STONE_COLOR[e.stone] : RARITY_COLOR[e.rarity];
  }

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
      k === 'hpRegen' || k === 'mpRegen' ? v.toFixed(1) : String(Math.round(v));
    $('stat-list').innerHTML = STAT_KEYS.map((k) =>
      `<div class="stat"><span>${STAT_LABEL[k]}</span><b>${fmt(k, p.stats[k])}</b></div>`,
    ).join('');
    $('inv-gold').innerHTML = `${COIN_ICON} ${p.gold.toLocaleString()} G`;
    $('inv-pots').innerHTML = this.potionTotals();
    const lf = $('loot-filter');
    for (const r of RARITIES) lf.querySelector<HTMLInputElement>(`[data-rarity="${r}"]`)!.checked = p.lootFilter.rarities.includes(r);
    syncPots(lf, p.lootFilter);
    if (this.stashOpen) this.renderStash();
    $('bag-hint').textContent = this.g.trade.open
      ? 'กำลังเทรด: คลิกของเพื่อเสนอ · ลากไปที่หน้าต่างเทรดก็ได้ (Shift+ลาก = เสนอบางส่วนของกองยา/หิน) · ของที่เสนออยู่มีกรอบเขียว'
      : this.market.isOpen
      ? this.market.bagHint
      : this.stashOpen
      ? 'คลิกซ้าย = สวมใส่ / เลือกยาให้ปุ่มด่วน · คลิกขวา = ฝากเข้าคลัง · ลากไปวางในคลังได้'
      : this.shopOpen
      ? 'คลิกซ้าย = สวมใส่ / เลือกยาให้ปุ่มด่วน · คลิกขวา = ขายให้พ่อค้า · คลิกช่องสวมใส่ = ถอด'
      : 'คลิกซ้าย = สวมใส่ / เลือกยาให้ปุ่มด่วน · คลิกขวา = วางลงพื้น · คลิกช่องสวมใส่ = ถอด · ขายของได้ที่พ่อค้าเท่านั้น';
  }

  /** Dropping a bag item on a socket wears it there; a ring replaces the ring of that socket. */
  private equipByDrag(i: number, slot: EquipSlot): void {
    const g = this.g;
    const item = g.player.bag[i];
    if (!isItem(item)) return;
    const block = g.player.equipBlock(item);
    if (block) this.log(`ใส่ ${itemName(item)} ไม่ได้ — ${block}`, '#ff8a6a');
    else if (!wornPlaces(item.slot).includes(slot)) this.log(`${itemName(item)} ใส่ช่อง${EQUIP_SLOT_LABEL[slot]}ไม่ได้`, '#ff8a6a');
    else g.backend.equip(i, slot);
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
      lines = item.lines.map((l) => `<div class="tt-line">${this.lineHtml(l)}</div>`).join('');
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

  private showPotionTip(s: PotionStack, e: MouseEvent, hint: string): void {
    const tip = $('tooltip');
    const quick = this.g.player.potSel[s.potion] === s.size;
    tip.innerHTML =
      `<div class="tt-name" style="color:${POTION_COLOR[s.potion]}">${potionName(s.potion, s.size)}</div>` +
      `<div class="tt-sub">ยา · ${s.count} / ${POTION_STACK} ขวด${quick ? ` · ใช้กับปุ่ม ${s.potion === 'hp' ? 1 : 2} อยู่` : ''}</div>` +
      `<div class="tt-stats"><div>ฟื้น ${potionHeal(s.potion, s.size, this.g.player.cls.id)} ${s.potion.toUpperCase()} ต่อขวด</div></div>` +
      `<div class="tt-hint">${hint}</div><div class="tt-val">ขายให้พ่อค้าได้ขวดละ ${potionSellPrice(s.potion, s.size)} G</div>`;
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
        : isBound(s) ? 'กุญแจเควส · ผูกกับตัวละคร'
        : s.stone === 'phoenix' ? `ไอเทมชุบชีวิต · ${s.count} / ${STONE_STACK} อัน · ซื้อจากพ่อค้า`
        // Reroll stones also drop (rarely) from ordinary monsters: MONSTER_STONES.
        : MONSTER_STONES.includes(s.stone) ? `วัตถุดิบช่างตีเหล็ก · ${s.count} / ${STONE_STACK} ก้อน · ดรอปจากบอส และมอนสเตอร์ทั่วไป (หายาก)`
        : `วัตถุดิบตีบวก · ${s.count} / ${STONE_STACK} ก้อน · ดรอปจากบอสเท่านั้น`}</div>` +
      `<div class="tt-stats"><div>${STONE_DESC[s.stone]}</div></div>` +
      `<div class="tt-hint">${hint}</div><div class="tt-val">${isBound(s) ? 'ขาย ทิ้ง ฝากคลัง หรือเทรดไม่ได้' : `ขายให้พ่อค้าได้${stoneUnit(s.stone)}ละ ${stoneSellPrice(s.stone).toLocaleString()} G`}</div>`;
    this.placeTip(tip, e);
  }

  private placeTip(tip: HTMLElement, e: MouseEvent): void {
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
  announce(text: string, from: string, direct: boolean, megaphone = false): void {
    const wait = this.adminBannerUntil - performance.now();
    if (megaphone && wait > 0) {
      window.setTimeout(() => this.announce(text, from, direct, true), wait + 50);
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

  showDisconnect(msg: string): void {
    document.getElementById('shutdown-banner')?.remove();
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
