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
import { STONE_COLOR, STONE_DESC, STONE_NAME, STONE_SELL, STONE_STACK, stoneStackValue } from '../shared/data/stones';
import { FullMap } from './fullmap';
import { AUTO_PX_PER_UNIT, AUTO_RANGE_MAX, AUTO_RANGE_MIN, buybackPrice, cleanAutoSettings, lootPots, type LootFilter, type SortKey } from '../shared/sim/Player';
import { isBulkSellable } from '../shared/sim/Sim';
import { nextRowPrice, STASH_MAX, STASH_ROW, STASH_ROW_PRICES, STASH_START } from '../shared/sim/stash';
import { MONSTERS } from '../shared/data/monsters';
import { expToNext } from '../shared/formulas';
import {
  isItem, isPotion, isStack, isStone, RARITIES, RARITY_COLOR, RARITY_LABEL, SLOTS, SLOT_LABEL, STAT_KEYS, STAT_LABEL,
  type BagEntry, type Item, type PotionKind, type PotionSize, type PotionStack, type Rarity, type StoneStack, type SlotId, type StatKey,
} from '../shared/types';
import { drawMapIcon, facingAngle } from './mapIcons';
import type { MapIcon } from './mapIconNames';
import { NPC_MAP_ICON } from './fullmap';
import { COIN_ICON, emptySlotIcon, FORGE_ICON, itemIcon, potionIcon, skillIcon, stoneIcon } from './icons';
import { shutdownCancelled, shutdownWarning, type ShutdownMode } from '../shared/net/protocol';

/** Yellow, like the game's level-up lines. */
const SHUTDOWN_COLOR = '#ffd34a';
/** How long an owner's announcement banner stays up. */
const ANNOUNCE_MS = 10_000;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

interface PreviewSlot { id: string; label: string; like?: SlotId }
/** Sockets shown in the window but not wired to the game yet: no data-slot, so they take no clicks or drops. */
const PREVIEW_SLOTS: PreviewSlot[] = [
  { id: 'offhand', label: 'อาวุธรอง', like: 'weapon' },
  { id: 'necklace', label: 'สร้อย' },
  { id: 'gloves', label: 'ถุงมือ' },
  { id: 'belt', label: 'เข็มขัด' },
  { id: 'ring2', label: 'แหวน 2', like: 'ring' },
];

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
  'ป่ามรกตแห่งนี้คือเศษเสี้ยวของมิติที่ยังรอด แต่สัตว์ป่าเริ่มคลุ้มคลั่งจากพลังที่รั่วไหล จงฝึกฝนตัวเองที่นี่ก่อน',
  'ลึกเข้าไปทางตะวันตกเฉียงเหนือ มีหมีใหญ่ที่ถูกพลังนั้นครอบงำ หากเจ้าปราบมันได้ เราจะได้เบาะแสแรกของ The Origin',
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
  private drag: { src: 'bag' | 'stash'; i: number; x: number; y: number; ghost: HTMLElement | null } | null = null;
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

  constructor(private readonly g: Game) {
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
      const name = `<b style="color:${this.entryColor(item)}">${entryName(item)}</b>`;
      if (this.shopOpen) {
        this.sellFromBag(i);
        return;
      }
      this.confirm(
        `วาง ${name} ลงบนพื้น?<br><small>เก็บคืนได้ภายใน 60 วินาที · ถ้าจะขาย ให้ไปหาพ่อค้าที่แคมป์</small>`,
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
      const right = this.stashOpen ? 'ฝากเข้าคลัง' : this.shopOpen ? (isStack(item) ? 'ขายทั้งช่อง' : 'ขาย') : 'วางลงพื้น';
      if (isPotion(item)) this.showPotionTip(item, e, `คลิกซ้าย: ใช้กับปุ่มด่วน · คลิกขวา: ${right}`);
      else if (isStone(item)) this.showStoneTip(item, e, `คลิกขวา: ${right}`);
      else if (item) this.showTip(item, e, `คลิกซ้าย: สวมใส่ · คลิกขวา: ${right}`);
      else this.hideTip();
    });
    bag.addEventListener('mouseleave', () => this.hideTip());

    // The bag's sort controls and their copies in the stash and shop windows always show the same choice.
    const sortDir = (desc: boolean) => {
      for (const b of [$('sort-dir'), $('stash-sort-dir'), $('shop-sort-dir')]) {
        b.dataset.desc = desc ? '1' : '0';
        b.textContent = desc ? 'มาก → น้อย' : 'น้อย → มาก';
      }
    };
    $('sort-dir').onclick = () => sortDir($('sort-dir').dataset.desc !== '1');
    $('stash-sort-dir').onclick = () => sortDir($('sort-dir').dataset.desc !== '1');
    $('shop-sort-dir').onclick = () => sortDir($('sort-dir').dataset.desc !== '1');
    const sortKeys = ['sort-key', 'stash-sort-key', 'shop-sort-key'].map((id) => $<HTMLSelectElement>(id));
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
    eq.addEventListener('click', (e) => {
      const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.dataset.slot as SlotId | undefined;
      if (!slot) return;
      g.backend.unequip(slot);
      this.hideTip();
      this.markInventory();
    });
    eq.addEventListener('mousemove', (e) => {
      const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.dataset.slot as SlotId | undefined;
      const item = slot ? g.player.equipment[slot] : undefined;
      if (item) this.showTip(item, e, 'คลิก: ถอดเก็บเข้ากระเป๋า');
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
    // The bag's own sort panel is hidden beside the stash and the shop, so the bag can be sorted from there too.
    $('stash-sort-bag').onclick = $('shop-sort-bag').onclick = () => {
      g.backend.sortBag(...sortChoice());
      this.hideTip();
      this.markInventory();
    };

    // Blacksmith
    $('forge-close').onclick = () => this.closeForge();
    $('forge-list').addEventListener('click', (e) => {
      const uid = (e.target as HTMLElement).closest<HTMLElement>('[data-uid]')?.dataset.uid;
      if (!uid) return;
      this.forgeSel = uid;
      $('forge-result').textContent = '';
      this.renderForge();
    });
    $('forge-go').onclick = () => this.enhance();
    $('forge-table').innerHTML = this.rateTable();

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
  private dragList(src: 'bag' | 'stash'): readonly (BagEntry | null)[] {
    return src === 'bag' ? this.g.player.bag : this.g.player.stash.items;
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
          : $('stash-grid').querySelector<HTMLElement>(`[data-s="${d.i}"]`);
        if (!src || !this.dragList(d.src)[d.i]) {
          this.drag = null;
          return;
        }
        const ghost = src.cloneNode(true) as HTMLElement;
        ghost.removeAttribute('data-i');
        ghost.removeAttribute('data-s');
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
      const quick = target?.closest<HTMLElement>('.skill-hp, .skill-mp');
      const shop = this.shopOpen ? target?.closest<HTMLElement>('#shop') : null;
      if (stashCell) {
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
    else this.openForge();
  }

  // ------------------------------------------------------------ confirm

  private confirm(html: string, yesLabel: string, onYes: () => void): void {
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

  private openShop(): void {
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
    this.forgeOpen = true;
    this.forgeSel = this.g.player.equipment.weapon?.uid ?? null;
    $('forge-result').textContent = '';
    $('forge').classList.remove('hidden');
    this.renderForge();
  }

  private closeForge(): void {
    if (!this.forgeOpen) return;
    this.forgeOpen = false;
    $('forge').classList.add('hidden');
  }

  /** Everything the blacksmith can work on: worn gear (weapon first), then gear in the bag. */
  private forgeItems(): Item[] {
    const p = this.g.player;
    const list: Item[] = [];
    for (const slot of SLOTS) {
      const it = p.equipment[slot];
      if (it) list.push(it);
    }
    for (const it of p.bag) if (isItem(it)) list.push(it);
    return list;
  }

  private renderForge(): void {
    const p = this.g.player;
    const list = this.forgeItems();
    const worn = (it: Item) => p.equipment[it.slot] === it;
    let item = list.find((w) => w.uid === this.forgeSel);
    if (!item) {
      item = list[0];
      this.forgeSel = item?.uid ?? null;
    }
    $('forge-list').innerHTML = list.length
      ? list.map((w) => this.itemCell(w, `data-uid="${w.uid}" title="${itemName(w)}${worn(w) ? ' (สวมใส่อยู่)' : ''}"`, '', w === item)).join('')
      : '<span class="hint">ไม่มีอุปกรณ์</span>';
    const go = $<HTMLButtonElement>('forge-go');
    if (!item) {
      $('forge-detail').innerHTML = '<span class="hint">เก็บอุปกรณ์ไว้ในกระเป๋าหรือสวมใส่ไว้ แล้วกลับมาใหม่</span>';
      go.disabled = true;
      return;
    }
    const cur = plusOf(item);
    const head = `<div class="fd-name" style="color:${RARITY_COLOR[item.rarity]}">${itemName(item)}</div>` +
      `<div class="hint" style="margin:0 0 4px">${SLOT_LABEL[item.slot]} · ${worn(item) ? 'สวมใส่อยู่' : 'อยู่ในกระเป๋า'} · iLv.${item.level}</div>`;
    if (cur >= MAX_PLUS) {
      $('forge-detail').innerHTML = `${head}<div class="up">ตีบวกถึงระดับสูงสุด +${MAX_PLUS} แล้ว (โบนัส +${bonusPct(cur)}%)</div>`;
      go.disabled = true;
      go.textContent = 'ระดับสูงสุดแล้ว';
      return;
    }
    const now = effectiveStats(item);
    const next = effectiveStats(item, cur + 1);
    const cost = enhanceCost(item);
    const rate = successRate(item);
    const pity = pityBonus(item);
    const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
    const r1 = (v: number) => fmtNum(Math.round(v * 10) / 10);
    const row = (label: string, a: string, b: string) =>
      `<div class="fd-row"><span>${label}</span><span>${a} → <span class="up">${b}</span></span></div>`;
    const statRows = (Object.keys(next) as StatKey[]).map((k) => row(STAT_LABEL[k], r1(now[k] ?? 0), r1(next[k] ?? 0))).join('');
    const need = stonesNeeded(item);
    const haveEnh = p.stoneCount('enhance');
    const canProtect = dropsOnFail(item);
    const haveProt = p.stoneCount('protect');
    if (haveProt < 1) this.forgeProtect = false;
    const protect = canProtect && this.forgeProtect;
    const short = p.gold < cost ? `ทองไม่พอ (มี ${p.gold.toLocaleString()} G)` : haveEnh < need ? `หินตีบวกไม่พอ (มี ${haveEnh})` : '';
    $('forge-detail').innerHTML = head +
      `<div class="fd-row"><span>ระดับ</span><b>+${cur} → +${cur + 1}</b></div>` +
      row('โบนัสตีบวก (ทุกค่าของชิ้นนี้)', `+${bonusPct(cur)}%`, `+${bonusPct(cur + 1)}%`) +
      statRows +
      `<div class="fd-row"><span>โอกาสสำเร็จ</span><b class="${rate < 1 ? 'bad' : ''}">${pct(rate)}` +
      `${pity > 0 ? ` <span class="pity">(+${pct(pity)} จากล้ม ${item.pity} ครั้ง)</span>` : ''}</b></div>` +
      `<div class="fd-row"><span>ค่าตีบวก</span><b class="${p.gold < cost ? 'bad' : ''}">${cost.toLocaleString()} G</b></div>` +
      (need ? `<div class="fd-row"><span>${stoneIcon('enhance')} ${STONE_NAME.enhance}</span><b class="${haveEnh < need ? 'bad' : ''}">ใช้ ${need} / มี ${haveEnh}</b></div>` : '') +
      (canProtect
        ? `<label class="fd-protect${haveProt < 1 ? ' off' : ''}"><input type="checkbox" id="forge-protect"${protect ? ' checked' : ''}${haveProt < 1 ? ' disabled' : ''}>` +
          `${stoneIcon('protect')} ใช้${STONE_NAME.protect} 1 ก้อน (มี ${haveProt})</label>` +
          (protect
            ? `<div class="safe">ถ้าล้มเหลว เสียทองและหิน แต่ระดับเท่าเดิม</div>`
            : `<div class="warn">⚠ ถ้าล้มเหลว จะเสียทองและระดับลดลงเหลือ +${cur - 1}</div>`)
        : `<div class="safe">${rate >= 1 ? 'สำเร็จแน่นอน' : 'ถ้าล้มเหลว เสียแค่ทอง ระดับเท่าเดิม'}</div>`) +
      (rate < 1 ? `<div class="hint">ล้มเหลวแต่ละครั้งเพิ่มโอกาสครั้งถัดไป +${pct(PITY_STEP)} (รีเซ็ตเมื่อสำเร็จ)</div>` : '');
    (document.getElementById('forge-protect') as HTMLInputElement | null)?.addEventListener('change', (e) => {
      this.forgeProtect = (e.target as HTMLInputElement).checked;
      this.renderForge();
    });
    go.disabled = !!short;
    go.innerHTML = short || `${FORGE_ICON} ตีบวก (${cost.toLocaleString()} G)`;
  }

  private async enhance(): Promise<void> {
    if (!this.forgeSel || this.enhancing) return;
    const sel = this.forgeItems().find((w) => w.uid === this.forgeSel);
    const protect = !!sel && dropsOnFail(sel) && this.forgeProtect;
    this.enhancing = true;
    const out = await this.g.backend.enhance(this.forgeSel, protect).finally(() => (this.enhancing = false));
    if (!out) return;
    const { result, item } = out;
    const res = $('forge-result');
    if (result === 'success') {
      res.className = 'ok';
      res.textContent = `สำเร็จ! ${itemName(item)}`;
    } else {
      res.className = 'fail';
      res.textContent = result === 'drop' ? `ล้มเหลว! ระดับลดลงเหลือ +${plusOf(item)}`
        : result === 'saved' ? `ล้มเหลว… หินกันระดับลดทำงาน ระดับยังเป็น +${plusOf(item)}`
        : 'ล้มเหลว… ระดับเท่าเดิม';
    }
    this.markInventory();
    this.renderForge();
  }

  private rateTable(): string {
    let html = '<table><tr><th>บวก</th><th>สำเร็จ</th><th>ถ้าล้ม</th><th>หินตีบวก</th><th>โบนัสรวม</th></tr>';
    for (let t = 1; t <= MAX_PLUS; t++) {
      const fail = rateFor(t) >= 1 ? '—' : t >= DROP_ON_FAIL_FROM ? 'ระดับ −1' : 'เสียแค่ทอง';
      html += `<tr><td>+${t}</td><td>${Math.round(rateFor(t) * 1000) / 10}%</td><td>${fail}</td>` +
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
    const previewIcon = (s: PreviewSlot): string => s.like
      ? `<span class="ph">${emptySlotIcon(s.like, p.cls.id)}</span>`
      : `<span class="ph-label">${s.label}</span>`;
    $('equip-slots').innerHTML = SLOTS.map((s) =>
      `<div class="eq-row eq-${s}" title="${SLOT_LABEL[s]}">${this.itemCell(p.equipment[s], `data-slot="${s}"`, `<span class="ph">${emptySlotIcon(s, p.cls.id)}</span>`)}</div>`,
    ).join('') + PREVIEW_SLOTS.map((s) =>
      `<div class="eq-row eq-${s.id}" title="${s.label} (ยังไม่เปิดใช้)"><div class="cell empty">${previewIcon(s)}</div></div>`,
    ).join('');
    $('bag-grid').innerHTML = p.bag.map((it, i) => this.itemCell(it, `data-i="${i}"`)).join('');
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
    $('bag-hint').textContent = this.stashOpen
      ? 'คลิกซ้าย = สวมใส่ / เลือกยาให้ปุ่มด่วน · คลิกขวา = ฝากเข้าคลัง · ลากไปวางในคลังได้'
      : this.shopOpen
      ? 'คลิกซ้าย = สวมใส่ / เลือกยาให้ปุ่มด่วน · คลิกขวา = ขายให้พ่อค้า · คลิกช่องสวมใส่ = ถอด'
      : 'คลิกซ้าย = สวมใส่ / เลือกยาให้ปุ่มด่วน · คลิกขวา = วางลงพื้น · คลิกช่องสวมใส่ = ถอด · ขายของได้ที่พ่อค้าเท่านั้น';
  }

  private showTip(item: Item, e: MouseEvent, hint: string): void {
    const tip = $('tooltip');
    const p = this.g.player;
    const eq = p.equipment[item.slot];
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
      // Each rolled line with its tier (1 = best 20% of the range) and the range at this item level.
      lines = item.lines.map((l) =>
        `<div class="tt-line">+${r1(l.value)} ${STAT_LABEL[l.stat]} <span class="tier t${l.tier}">T${l.tier}</span>` +
        ` <span class="tt-range">(${l.min}–${l.max})</span></div>`).join('');
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

  private showStoneTip(s: StoneStack, e: MouseEvent, hint: string): void {
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

  private hideTip(): void {
    $('tooltip').classList.add('hidden');
  }

  // ------------------------------------------------------------ log / overlays

  // ------------------------------------------------------------ online

  openChat(): void {
    const box = $('chat');
    if (!box.classList.contains('hidden')) return;
    box.classList.remove('hidden');
    // Focus after this frame so the Enter that opened it doesn't also send it.
    setTimeout(() => $<HTMLInputElement>('chat-input').focus(), 0);
  }

  closeChat(): void {
    const input = $<HTMLInputElement>('chat-input');
    input.value = '';
    $('chat').classList.add('hidden');
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
  shutdownCountdown(mode: ShutdownMode, seconds: number | null): void {
    if (seconds === null) {
      document.getElementById('shutdown-banner')?.remove();
      const text = shutdownCancelled(mode);
      this.banner(text, undefined, SHUTDOWN_COLOR);
      this.log(text, SHUTDOWN_COLOR);
      return;
    }
    const text = shutdownWarning(mode, seconds);
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
    box.append(el);
    while (box.children.length > 9) box.firstChild?.remove();
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
      const boss = MONSTERS[this.g.zone.boss.monster];
      this.log(`ภารกิจ: ฝึกฝนในป่ามรกต แล้วปราบ ${boss.name}`, '#ffd34a');
    }
  }
}
