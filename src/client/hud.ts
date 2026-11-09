import { SPACE_COLOUR } from './island';
import type { Game } from './Game';
import { NPC_USE_RANGE, type NpcId } from '../shared/data/npcs';
import type { SkillSlot } from '../shared/data/classes';
import {
  bonusPct, DROP_ON_FAIL_FROM, dropsOnFail, effectiveStats, enhanceBonus, enhanceCost, ENHANCE_STONES_PER_TRY, itemName,
  MAX_PLUS, PITY_STEP, pityBonus, plusOf, rateFor, sellValue, STONE_FROM, stonesNeeded, successRate,
} from '../shared/data/enhance';
import {
  entryName, POTION_SIZES, POTION_SIZE_LABEL, POTION_STACK, POTIONS, potionName, potionSellPrice,
} from '../shared/data/potions';
import { REROLL_STONE, STONE_COLOR, STONE_DESC, STONE_NAME, STONE_SELL, STONE_STACK, stoneStackValue } from '../shared/data/stones';
import { lineRanges, rerollBlock } from '../shared/data/items';
import { REROLL_NAME, rerollCost, type RerollKind } from '../shared/data/reroll';
import { FullMap } from './fullmap';
import { AUTO_PX_PER_UNIT, AUTO_RANGE_MAX, AUTO_RANGE_MIN, buybackPrice, cleanAutoSettings, lootPots, type LootFilter, type SortKey } from '../shared/sim/Player';
import { isBulkSellable } from '../shared/sim/Sim';
import { nextRowPrice, STASH_MAX, STASH_ROW, STASH_ROW_PRICES, STASH_START } from '../shared/sim/stash';
import { MONSTERS } from '../shared/data/monsters';
import { ZONE_1 } from '../shared/data/zones';
import { expToNext } from '../shared/formulas';
import {
  isItem, isPotion, isStack, isStone, RARITIES, RARITY_COLOR, RARITY_LABEL, EQUIP_SLOTS, EQUIP_SLOT_LABEL, SLOT_LABEL, STAT_KEYS, STAT_LABEL, wornPlaces,
  type BagEntry, type Item, type StatLine, type PotionKind, type PotionSize, type PotionStack, type Rarity, type StoneStack, type StoneKind, type EquipSlot, type StatKey,
} from '../shared/types';
import { drawMapIcon, facingAngle } from './mapIcons';
import type { MapIcon } from './mapIconNames';
import { NPC_MAP_ICON } from './fullmap';
import { MarketWindow } from './market';
import { playSound } from './audio/sfx';
import { COIN_ICON, emptySlotIcon, FORGE_ICON, itemIcon, potionIcon, skillIcon, stoneIcon } from './icons';
import { shutdownCancelled, shutdownWarning, type ShutdownMode } from '../shared/net/protocol';

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
const MINIMAP_SCALE = 2.6;

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
  private slotEls: { kind: SkillSlot | PotionKind; el: HTMLElement; cd: HTMLElement; extra: HTMLElement }[] = [];
  private invDirty = true;
  private bagOpen = false;
  /** Level the bag was last drawn for (gear above it is marked as locked). */
  private drawnLevel = 0;
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
  private enhancing = false;
  /** Use a protection stone on attempts that can drop the level (the forge's tick box; off until ticked). */
  private forgeProtect = false;
  /** The blacksmith's menu: enhance, or one of the rerolls. */
  private forgeMode: 'enhance' | RerollKind = 'enhance';
  /** Lines of the item before its last reroll, shown next to the new ones until another item is picked. */
  private rerollPrev: { uid: string; lines: StatLine[] } | null = null;

  private readonly market: MarketWindow;

  constructor(private readonly g: Game) {
    this.market = new MarketWindow(g, this);
    $('hud').classList.remove('hidden');
    this.mm = $<HTMLCanvasElement>('minimap').getContext('2d')!;
    this.setHudStyle(loadHudStyle());
    // Big enough to show up late on first opening the bag, so it's fetched now.
    new Image().src = 'assets/sprites/ui/inventory.png';
    $('btn-hud-style').onclick = () => this.setHudStyle($('hud').classList.contains('hud-orbs') ? 'bars' : 'orbs');
    this.fullMap = new FullMap($<HTMLCanvasElement>('fullmap-canvas'));
    $('minimap').onclick = () => this.toggleMap(true);
    $('fullmap-close').onclick = () => this.toggleMap(false);
    $('fullmap-canvas').addEventListener('click', (e) => {
      const to = this.fullMap.toWorld(e.clientX, e.clientY);
      if (this.g.walkTo(to.x, to.z)) this.toggleMap(false);
    });
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
        log.classList.remove('tab-chat', 'tab-system');
        if (b.dataset.tab !== 'all') log.classList.add(`tab-${b.dataset.tab}`);
        for (const o of $('log-tabs').querySelectorAll('[data-tab]')) o.classList.toggle('active', o === b);
        log.scrollTop = log.scrollHeight;
      };
    }
    chat.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const text = chat.value.trim();
        if (text) g.backend.chat(text);
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
      if (isStone(entry)) return;
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
      this.confirm(
        `วาง ${name} ลงบนพื้น?<br><small>เก็บคืนได้ภายใน 60 วินาที · ถ้าจะขาย ให้ไปหาพ่อค้าที่เมือง</small>`,
        'วางลงพื้น',
        () => {
          if (g.player.bag[i] !== item) return;
          g.dropFromBag(i);
          this.markInventory();
          if (this.forgeOpen) this.renderForge();
        },
      );
    });
    bag.addEventListener('mousemove', (e) => {
      if (this.drag?.ghost) return;
      const i = this.cellIndex(e);
      const item = i >= 0 ? g.player.bag[i] : null;
      const right = this.stashOpen ? 'ฝากเข้าคลัง' : this.market.isOpen ? 'เลือกมาลงขายในตลาด' : this.shopOpen ? (isStack(item) ? 'ขายทั้งช่อง' : 'ขาย') : 'วางลงพื้น';
      if (isPotion(item)) this.showPotionTip(item, e, `คลิกซ้าย: ใช้กับปุ่มด่วน · คลิกขวา: ${right}`);
      else if (isStone(item)) this.showStoneTip(item, e, `คลิกขวา: ${right}`);
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
      `<div class="cell pot" data-buy="${k}:${s}" style="--rc:${POTION_COLOR[k]}">${potionIcon(k)}` +
      `<span class="psize">${POTION_SIZE_LABEL[s]}</span><span class="cell-price">${POTIONS[k][s].price}</span></div>`,
    )).join('');
    const buyCell = (e: Event): [PotionKind, PotionSize] | null => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-buy]');
      return el ? (el.dataset.buy!.split(':') as [PotionKind, PotionSize]) : null;
    };
    buyGrid.addEventListener('click', (e) => {
      const c = buyCell(e);
      if (c) this.buyPotion(c[0], c[1], e.shiftKey ? POTION_STACK : 1);
    });
    buyGrid.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const c = buyCell(e);
      if (c) this.buyPotion(c[0], c[1], POTION_STACK);
    });
    buyGrid.addEventListener('mousemove', (e) => {
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
      const hint = 'คลิกขวา: ย้ายเข้ากระเป๋า · ลากเพื่อย้าย';
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
    $('forge-table').innerHTML = this.rateTable();
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
    this.log(`เดินทางสู่ ${z.name} · ${z.nameTh} (Lv.${z.levels[0]}–${z.levels[1]})`, '#9fffd8');
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
    const add = (kind: SkillSlot | PotionKind, icon: string, key: string, title: string) => {
      const el = document.createElement('div');
      el.className = `skill skill-${kind}`;
      el.innerHTML = `<div class="icon">${icon}</div><div class="cd"></div><div class="key">${key}</div><div class="extra"></div>`;
      el.title = title;
      bar.append(el);
      this.slotEls.push({ kind, el, cd: el.querySelector('.cd')!, extra: el.querySelector('.extra')! });
    };
    for (const s of this.g.player.cls.skills) {
      add(s.slot, skillIcon(s.id), KEY_LABEL[s.slot], `${s.name} (${s.nameTh})\n${s.desc}${s.mp ? `\nMP ${s.mp}` : ''}${s.cooldown ? ` · คูลดาวน์ ${s.cooldown} วิ` : ''}`);
    }
    add('hp', potionIcon('hp'), '1', '');
    add('mp', potionIcon('mp'), '2', '');
  }

  // ------------------------------------------------------------ per-frame

  update(dt: number): void {
    const p = this.g.player;
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
    $('exp-text').textContent = `EXP ${((p.exp / need) * 100).toFixed(1)}%`;
    $('hud-level').textContent = `Lv.${p.level} ${p.cls.name}`;
    $('hud-gold').textContent = `${p.gold.toLocaleString()} G`;
    if (this.g.backend.online) $('hud-online').textContent = `🌐 ออนไลน์ ${this.g.backend.onlineCount} คน · กด Enter เพื่อแชท`;
    this.showPing(this.g.backend.ping);

    for (const s of this.slotEls) {
      if (s.kind === 'hp' || s.kind === 'mp') {
        const size = p.potionToUse(s.kind) ?? p.potSel[s.kind];
        const count = p.potionCount(s.kind, size);
        s.extra.textContent = `${POTION_SIZE_LABEL[size]} ${count}`;
        s.el.title = `${potionName(s.kind, size)} — ฟื้น ${POTIONS[s.kind][size].amount} ${s.kind.toUpperCase()}\nคลิกยาในกระเป๋าเพื่อเลือกขนาด`;
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
      if (this.mapOpen) this.fullMap.draw(this.g);
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

  private setHudStyle(style: HudStyle): void {
    const hud = $('hud');
    hud.classList.toggle('hud-orbs', style === 'orbs');
    hud.classList.toggle('hud-bars', style === 'bars');
    $('btn-hud-style').textContent = style === 'orbs' ? 'HP/MP: ลูกแก้ว' : 'HP/MP: แถบ';
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
    const sc = MINIMAP_SCALE;
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
      if (o !== p) drawMapIcon(ctx, 'ally', ...toMM(o.x, o.z), 16, facingAngle(o.faceX, o.faceZ));
    }
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

  toggleMap(force?: boolean): void {
    this.mapOpen = force ?? !this.mapOpen;
    $('fullmap').classList.toggle('hidden', !this.mapOpen);
    if (!this.mapOpen) return;
    const z = this.g.backend.zone;
    $('fullmap-title').textContent = `แผนที่ — ${z.nameTh} (Lv.${z.levels[0]}-${z.levels[1]})`;
    $('fullmap-hint').textContent = this.g.backend.online
      ? 'คลิกบนแผนที่เพื่อเดินไป · กด M หรือ Esc เพื่อปิด · ออนไลน์จะเห็นจุดมอน/ผู้เล่นเฉพาะที่อยู่ใกล้ตัว'
      : 'คลิกบนแผนที่เพื่อเดินไป · กด M หรือ Esc เพื่อปิด';
    this.fullMap.draw(this.g);
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
    for (const slot of ['q', 'e', 'r'] as const) {
      const sk = p.skill(slot);
      const label = document.createElement('label');
      label.className = 'aset-check';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.slot = slot;
      cb.checked = s.skills[slot];
      cb.addEventListener('change', () => this.applyAutoSettings());
      label.append(cb, ` ${slot.toUpperCase()} — ${sk?.nameTh ?? sk?.name ?? '-'}`);
      box.append(label);
    }
  }

  /** Read the form, clamp it, send it, then show the clamped values. */
  private applyAutoSettings(): void {
    const num = (id: string) => Number($<HTMLInputElement>(id).value);
    const skills = { ...this.g.player.autoSettings.skills };
    for (const cb of $('aset-skills').querySelectorAll<HTMLInputElement>('input[data-slot]')) {
      skills[cb.dataset.slot as 'q' | 'e' | 'r'] = cb.checked;
    }
    const s = cleanAutoSettings({
      range: num('aset-range'), hpPct: num('aset-hp'), mpPct: num('aset-mp'), skills, loot: $<HTMLInputElement>('aset-loot').checked,
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

  closePanels(): void {
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
    if (this.dialogOpen) this.closeDialog();
  }

  talkTo(id: NpcId): void {
    if (id === 'seeker') this.openDialog();
    else if (id === 'merchant') this.openShop();
    else if (id === 'keeper') {
      // The server refuses guests' stash actions too; this just says why up front.
      if (this.g.backend.guest) this.log('Guest ใช้คลังเก็บของไม่ได้ — สมัครสมาชิกเพื่อใช้คลัง (ตัวละครนี้จะย้ายไปอยู่ในบัญชีใหม่)', '#ffcf6a');
      else this.openStash();
    }
    else if (id === 'broker') this.openMarket();
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
      `<div class="tt-stats"><div>ฟื้น ${POTIONS[kind][size].amount} ${kind.toUpperCase()} ต่อขวด</div></div>` +
      `<div class="tt-hint">คลิก: ซื้อ 1 (${price} G) · คลิกขวา: ซื้อ ${POTION_STACK} (${price * POTION_STACK} G)</div>` +
      `<div class="tt-val">มีอยู่ ${this.g.player.potionCount(kind, size)} ขวด</div>`;
    this.placeTip(tip, e);
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
    if (isPotion(item)) {
      // A whole stack of potions is worth asking about first.
      if (item.count > 1) {
        const each = potionSellPrice(item.potion, item.size);
        this.confirm(`ขาย ${name} ทั้งช่อง?<br><small>ได้ ${each * item.count} G (ขวดละ ${each} G)</small>`, 'ขาย', sell);
      } else sell();
      return;
    }
    if (isStone(item)) {
      // Boss-only stones: always ask, they are hard to get back.
      this.confirm(`ขาย ${name}?<br><small>ได้ ${stoneStackValue(item).toLocaleString()} G (ก้อนละ ${STONE_SELL.toLocaleString()} G) · ซื้อคืนไม่ได้</small>`, 'ขาย', sell);
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
    $('forge-rates-btn').classList.toggle('hidden', mode !== 'enhance');
    if (mode !== 'enhance') $('forge-rates').classList.add('hidden');

    const item = this.forgeItem();
    if (!item) this.forgeSel = null; // sold, dropped or stored since
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
    if (!item || !ranges || !item.lines || this.enhancing) return;
    const over = item.lines.some((l) => l.value > l.max);
    this.confirm(
      `${REROLL_NAME[kind]} ${itemName(item)}?<br><small>ค่าบริการ ${rerollCost(item, kind).toLocaleString()} G + ${STONE_NAME[REROLL_STONE[kind]]} 1 ก้อน · ค่าเดิมจะหายไป ย้อนคืนไม่ได้` +
      `${over ? '<br>⚠ มีสเตตัสที่เกินช่วงปกติ จะกลับเข้าช่วงปกติ' : ''}</small>`,
      REROLL_NAME[kind],
      () => void this.reroll(item, kind),
    );
  }

  private async reroll(item: Item, kind: RerollKind): Promise<void> {
    if (this.enhancing) return;
    const before = (item.lines ?? []).map((l) => ({ ...l }));
    this.enhancing = true;
    const out = await this.g.backend.reroll(item.uid, kind).finally(() => (this.enhancing = false));
    if (!out) {
      this.forgeResult('fail', 'สุ่มไม่สำเร็จ');
      return;
    }
    this.rerollPrev = { uid: item.uid, lines: before };
    this.forgeResult('ok', `${REROLL_NAME[kind]}แล้ว`);
    this.markInventory();
    this.renderForge();
  }

  private async enhance(): Promise<void> {
    if (!this.forgeSel || this.enhancing) return;
    const sel = this.forgeItems().find((w) => w.uid === this.forgeSel);
    const protect = !!sel && dropsOnFail(sel) && this.forgeProtect;
    this.enhancing = true;
    const out = await this.g.backend.enhance(this.forgeSel, protect).finally(() => (this.enhancing = false));
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

  private itemCell(item: BagEntry | null | undefined, attrs: string, placeholder = '', selected = false): string {
    if (!item) return `<div class="cell empty" ${attrs}>${placeholder}</div>`;
    if (isPotion(item)) {
      // The outline marks the size the quick key uses.
      const quick = this.g.player.potSel[item.potion] === item.size;
      return `<div class="cell pot${quick ? ' quick' : ''}" ${attrs} style="--rc:${POTION_COLOR[item.potion]}">${potionIcon(item.potion)}` +
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
    $('bag-grid').innerHTML = p.bag.map((it, i) => this.itemCell(it, `data-i="${i}"`, '', i === picked)).join('');
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
    $('bag-hint').textContent = this.market.isOpen
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
      `<div class="tt-stats"><div>ฟื้น ${POTIONS[s.potion][s.size].amount} ${s.potion.toUpperCase()} ต่อขวด</div></div>` +
      `<div class="tt-hint">${hint}</div><div class="tt-val">ขายให้พ่อค้าได้ขวดละ ${potionSellPrice(s.potion, s.size)} G</div>`;
    this.placeTip(tip, e);
  }

  showStoneTip(s: StoneStack, e: MouseEvent, hint: string): void {
    const tip = $('tooltip');
    tip.innerHTML =
      `<div class="tt-name" style="color:${STONE_COLOR[s.stone]}">${STONE_NAME[s.stone]}</div>` +
      `<div class="tt-sub">วัตถุดิบตีบวก · ${s.count} / ${STONE_STACK} ก้อน · ดรอปจากบอสเท่านั้น</div>` +
      `<div class="tt-stats"><div>${STONE_DESC[s.stone]}</div></div>` +
      `<div class="tt-hint">${hint}</div><div class="tt-val">ขายให้พ่อค้าได้ก้อนละ ${STONE_SELL.toLocaleString()} G</div>`;
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

  openChat(): void {
    const box = $('chat');
    if (!box.classList.contains('hidden')) return;
    box.classList.remove('hidden');
    // The log turns into a scrollable history (every kept line, faded or not) while the chat is open.
    const log = $('log');
    log.classList.add('open');
    log.scrollTop = log.scrollHeight;
    // Focus after this frame so the Enter that opened it doesn't also send it.
    setTimeout(() => $<HTMLInputElement>('chat-input').focus(), 0);
  }

  closeChat(): void {
    const input = $<HTMLInputElement>('chat-input');
    input.value = '';
    $('chat').classList.add('hidden');
    $('log').classList.remove('open');
    input.blur();
  }

  /** A chat line; an empty name means a server notice (someone joined or left). */
  chatLine(name: string, text: string, fadeMs = 15000): void {
    const el = document.createElement('div');
    if (name) {
      el.className = 'log-line chat';
      const b = document.createElement('b');
      b.textContent = `${name}: `;
      el.append(b, document.createTextNode(text));
    } else {
      el.className = 'log-line system';
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

  /** An announcement from the server's owner: a banner for a while (like the restart warning) and a chat line. */
  announce(text: string, from: string, direct: boolean): void {
    document.getElementById('announce-banner')?.remove();
    const el = document.createElement('div');
    el.id = 'announce-banner';
    // Text only (textContent), so nothing the sender types can become HTML on anyone's screen.
    const head = document.createElement('div');
    head.className = 'announce-head';
    head.textContent = direct ? '📢 ข้อความจาก GM ถึงคุณ' : '📢 ประกาศ';
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
    line.style.color = SHUTDOWN_COLOR;
    line.textContent = direct ? `📢 ข้อความจาก ${from} ถึงคุณ: ${text}` : `📢 ประกาศ: ${text} — ${from}`;
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
      const boss = MONSTERS[ZONE_1.boss!.monster];
      this.log(`ภารกิจ: ฝึกฝนในป่ามรกต แล้วปราบ ${boss.name}`, '#ffd34a');
    }
  }
}
