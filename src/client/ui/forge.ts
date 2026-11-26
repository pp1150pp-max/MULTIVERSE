import type { Game } from '../Game';
import {
  bonusPct, dropsOnFail, forgeCd, forgeConfig, effectiveStats, enhanceCost, itemName,
  maxPlus, pityStep, pityBonus, plusOf, rateFor, stonesNeeded, successRate,
} from '../../shared/data/enhance';
import { REROLL_STONE, STONE_NAME } from '../../shared/data/stones';
import { lineRanges, rerollBlock, statRerollOdds } from '../../shared/data/items';
import { REROLL_NAME, rerollCost, type RerollKind } from '../../shared/data/reroll';
import { currentBalance } from '../../shared/balance';
import { isItem, EQUIP_SLOTS, RARITY_COLOR, SLOT_LABEL, STAT_LABEL, type BagEntry, type Item, type StatLine, type StoneKind, type StatKey } from '../../shared/types';
import { COIN_ICON, FORGE_ICON, itemIcon, stoneIcon } from '../icons';
import { $, fmtNum, lineHtml } from './hudShared';
import { drillCost, drillOdds, isDrilled, socketCount } from '../../shared/cardSockets';
import { gameSocketHost, openCardView, socketTipHtml } from './cardPopup';
import { cardDef } from '../../shared/cardTuning';
import { FUSE_COUNT, cardFloor, fuseBlock, fuseInfo } from '../../shared/cardFuse';
import { CARD_DEFAULTS, CARD_RARITY_NAME, cardName, isCardId, type CardId } from '../../shared/data/cards';
import { isStone } from '../../shared/types';
import { cardIcon } from '../icons';


/** The blacksmith's menus: enhance, the two rerolls, drilling (card plan PR 2) and card fusion (card plan 6.1). */
type ForgeMode = 'enhance' | RerollKind | 'drill' | 'fuse';

/** The blacksmith menu's one-line description of each system (left column, under the menu). */
const FORGE_DESC: Record<ForgeMode, string> = {
  enhance: 'เพิ่มระดับ +N ทุกค่าบนชิ้นนั้นแรงขึ้นเป็น % · ยิ่งบวกสูง ยิ่งเสี่ยง',
  values: 'สุ่มค่าตัวเลขใหม่ทุกบรรทัด tier เท่าเดิม',
  stat: 'สุ่มสเตตัสเสริม 1 บรรทัด เป็นชนิดใหม่ พร้อม tier และค่าใหม่',
  drill: 'เจาะรูสำหรับเสียบการ์ด ได้ 0–2 ช่อง · เจาะได้ครั้งเดียวต่อชิ้น',
  fuse: 'ใช้การ์ดระดับเดียวกันและชั้นเดียวกัน 3 ใบ สุ่มได้การ์ดใบใหม่ 1 ใบ (ระดับและชั้นเดิม)',
};

/** A running Auto enhance: the item, the level to stop at, and whether to use protection stones. */
type ForgeAutoRun = { uid: string; target: number; protect: boolean };
/** Auto enhance waits this long past the cooldown bar before the next attempt (the server's cooldown is tick-based). */
const FORGE_AUTO_GAP_MS = 200;

/** What the blacksmith window needs from the HUD. */
export interface ForgeHost {
  log(msg: string, color?: string): void;
  confirm(html: string, yesLabel: string, onYes: () => void): void;
  closeConfirm(): void;
  showTip(item: Item, e: MouseEvent, hint: string): void;
  hideTip(): void;
  toggleBag(force?: boolean): void;
  markInventory(): void;
}

/** The blacksmith's window: enhance (+ Auto enhance), value reroll and stat reroll. */
export class ForgeWindow {
  private forgeOpen = false;
  private forgeSel: string | null = null;
  private enhancing = false;
  /** performance.now() when the next blacksmith action may be sent (forgeCd() after the last one). */
  private forgeReadyAt = 0;
  /** Use a protection stone on attempts that can drop the level (the forge's tick box; off until ticked). */
  private forgeProtect = false;
  /** The blacksmith's menu: enhance, or one of the rerolls. */
  private forgeMode: ForgeMode = 'enhance';
  /**
   * Auto enhance while it runs (owner 2026-11-18): the item, the level to stop at, and whether to use protection
   * stones (taken from the tick box when it started). Browser side only: it sends the same enhance action as a click.
   */
  private forgeAuto: ForgeAutoRun | null = null;
  /** Lines of the item before its last reroll, shown next to the new ones until another item is picked. */
  private rerollPrev: { uid: string; lines: StatLine[] } | null = null;
  /** The cards in the fusion's 3 slots (repeats allowed). */
  private fuseSel: CardId[] = [];

  constructor(private readonly g: Game, private readonly host: ForgeHost) {
    $('forge-close').onclick = () => this.closeForge();
    $('forge-go').onclick = () => {
      if (this.forgeAuto) return;
      if (this.forgeMode === 'enhance') void this.enhance();
      else if (this.forgeMode === 'drill') this.askDrill();
      else if (this.forgeMode === 'fuse') this.askFuse();
      else this.askReroll(this.forgeMode);
    };
    $('forge-auto-btn').onclick = () => (this.forgeAuto ? this.stopForgeAuto('กดหยุด') : this.startForgeAuto());
    $('forge-cancel').onclick = () => (this.forgeMode === 'fuse' ? this.setFuse([]) : this.forgePlace(null));
    // Fusion: a card slot takes its card back out, a card in the list goes into the next empty slot.
    $('forge-slot').addEventListener('click', (e) => {
      const i = (e.target as HTMLElement).closest<HTMLElement>('[data-fuse-i]')?.dataset.fuseI;
      if (this.forgeMode !== 'fuse' || i === undefined) return;
      this.setFuse(this.fuseSel.filter((_, k) => k !== Number(i)));
    });
    $('forge-item').addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-fuse-card]')?.dataset.fuseCard;
      if (this.forgeMode === 'fuse' && isCardId(id)) this.addFuseCard(id);
    });
    $('forge-menu').addEventListener('click', (e) => {
      const mode = (e.target as HTMLElement).closest<HTMLElement>('[data-mode]')?.dataset.mode as typeof this.forgeMode | undefined;
      if (!mode || mode === this.forgeMode) return;
      this.stopForgeAuto('เปลี่ยนเมนู');
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
      const item = this.forgeMode === 'fuse' ? undefined : this.forgeItem();
      if (item) this.host.showTip(item, e,'ลากชิ้นอื่นมาวางเพื่อเปลี่ยน · ปุ่ม "นำออก" เพื่อเอาออก');
      else this.host.hideTip();
    });
    fslot.addEventListener('mouseleave', () => this.host.hideTip());
  }

  /** True while the card fusion menu is the one open (a click on a card in the bag goes into its slots). */
  get fusing(): boolean {
    return this.forgeOpen && this.forgeMode === 'fuse';
  }

  /** True while the blacksmith window is open. */
  get isOpen(): boolean {
    return this.forgeOpen;
  }

  // ------------------------------------------------------------ blacksmith

  /** Opens the window (hud.ts closes the other NPC windows first). */
  openForge(): void {
    this.forgeOpen = true;
    // Owner: the slot starts empty and the bag opens beside it, ready to drag from.
    this.forgeSel = null;
    this.rerollPrev = null;
    this.forgeResult('', '');
    $('forge-rates').classList.add('hidden');
    $('forge').classList.remove('hidden');
    this.host.toggleBag(true);
    this.renderForge();
  }

  closeForge(): void {
    if (!this.forgeOpen) return;
    this.stopForgeAuto('ปิดหน้าต่างช่างตีเหล็ก');
    this.forgeOpen = false;
    this.forgeSel = null;
    $('forge').classList.add('hidden');
    this.host.closeConfirm();
    this.host.markInventory();
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
  forgePlace(entry: BagEntry | null): void {
    if (this.forgeMode === 'fuse') {
      if (entry && isStone(entry) && isCardId(entry.stone)) this.addFuseCard(entry.stone);
      else if (entry) this.host.log('เมนูรวมการ์ดรับเฉพาะการ์ด', '#ff8a6a');
      else this.setFuse([]);
      return;
    }
    if (entry && !isItem(entry)) {
      this.host.log('ช่างตีเหล็กรับเฉพาะอุปกรณ์สวมใส่ (ไม่รับยาและหิน)', '#ff8a6a');
      return;
    }
    if (entry?.uid !== this.forgeSel) this.rerollPrev = null;
    if (this.forgeAuto && entry?.uid !== this.forgeAuto.uid) this.stopForgeAuto('เปลี่ยนอุปกรณ์');
    this.forgeSel = entry?.uid ?? null;
    this.forgeResult('', '');
    this.renderForge();
  }

  /** The result that shows over the slot after an attempt (cls: ok / fail, '' clears it). */
  private forgeResult(cls: '' | 'ok' | 'fail', text: string): void {
    const res = $('forge-result');
    res.className = cls;
    res.textContent = text;
    // One line always (owner 2026-11-18): a long result shrinks to fit the stage instead of wrapping.
    res.style.fontSize = '';
    for (let size = 14; text && res.scrollWidth > res.clientWidth && size > 9; size--) res.style.fontSize = `${size - 1}px`;
    const stage = $('forge-stage');
    stage.classList.remove('flash-ok', 'flash-fail');
    if (cls) {
      void stage.offsetWidth; // restart the flash
      stage.classList.add(`flash-${cls}`);
    }
  }

  renderForge(): void {
    // While an attempt runs, the snapshot may already carry the new level: hold it until the bar has filled.
    if (this.enhancing) return;
    const p = this.g.player;
    const mode = this.forgeMode;
    for (const b of $('forge-menu').querySelectorAll<HTMLElement>('[data-mode]')) b.classList.toggle('active', b.dataset.mode === mode);
    $('forge-desc').textContent = FORGE_DESC[mode];
    // Odds table: enhance rates, or what "สุ่มสเตตัส" can give (for the item placed, if any).
    const hasRates = mode === 'enhance' || mode === 'stat' || mode === 'drill' || mode === 'fuse';
    $('forge-rates-btn').classList.toggle('hidden', !hasRates);
    if (!hasRates) $('forge-rates').classList.add('hidden');

    if (mode === 'fuse') return this.renderFuse();
    $('forge-slot').classList.remove('fuse');
    const item = this.forgeItem();
    if (!item) this.forgeSel = null; // sold, dropped or stored since
    if (hasRates) {
      const btn = mode === 'enhance' ? 'ตารางโอกาสสำเร็จ' : 'ตารางโอกาส';
      const title = mode === 'enhance' ? 'ตารางโอกาสสำเร็จ / โบนัส' : mode === 'drill' ? 'ตารางโอกาส — เจาะรู' : 'ตารางโอกาส — สุ่มสเตตัส';
      const table = mode === 'enhance' ? this.rateTable() : mode === 'drill' ? this.drillOddsTable() : this.statOddsTable(item);
      if ($('forge-rates-btn').textContent !== btn) $('forge-rates-btn').textContent = btn;
      if ($('forge-rates-title').textContent !== title) $('forge-rates-title').textContent = title;
      if ($('forge-table').innerHTML !== table) $('forge-table').innerHTML = table;
    }
    const stones: StoneKind[] = mode === 'enhance' ? ['enhance', 'protect'] : mode === 'drill' ? ['drill'] : [REROLL_STONE[mode as RerollKind]];
    $('forge-foot').innerHTML = `<span class="ff-gold">${COIN_ICON} ${p.gold.toLocaleString()} G</span>` +
      stones.map((s) => `<span class="ff-stone" title="${STONE_NAME[s]}">${stoneIcon(s)} ${STONE_NAME[s]} ${p.stoneCount(s)}</span>`).join('');

    const slot = $('forge-slot');
    const go = $<HTMLButtonElement>('forge-go');
    $<HTMLButtonElement>('forge-cancel').disabled = !item;
    slot.className = item ? 'filled' : '';
    if (item) slot.style.setProperty('--rc', RARITY_COLOR[item.rarity]);
    else slot.style.removeProperty('--rc');
    const label = `${FORGE_ICON} ${mode === 'enhance' ? 'ตีบวก' : mode === 'drill' ? 'เจาะรู' : REROLL_NAME[mode as RerollKind]}`;
    if (!item) {
      slot.innerHTML = '';
      $('forge-drop-hint').innerHTML = 'ลากอุปกรณ์มาวางที่นี่<small>หรือคลิกอุปกรณ์ในกระเป๋า / ที่สวมอยู่</small>';
      $('forge-item').innerHTML = '<div class="fi-empty">ยังไม่ได้วางอุปกรณ์</div>';
      $('forge-cost').innerHTML = '';
      go.disabled = true;
      go.innerHTML = label;
      this.renderForgeAuto(undefined, 'x');
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
      `<div class="fi-lines">${this.forgeLines(item, mode === 'drill' ? 'enhance' : (mode as RerollKind | 'enhance'))}</div>` +
      (mode === 'drill' ? `<div class="fi-sock">${socketTipHtml(item)}</div>` : '');
    const why = mode === 'enhance' ? this.renderEnhanceCost(item) : mode === 'drill' ? this.renderDrillCost(item) : this.renderRerollCost(item, mode as RerollKind);
    go.disabled = !!why || !!this.forgeAuto;
    go.innerHTML = why || label;
    this.renderForgeAuto(item, why);
  }

  /** The Auto enhance controls: shown in the enhance menu with an item that can still go up, and the /admin switch on. */
  private renderForgeAuto(item: Item | undefined, why: string): void {
    const wrap = $('forge-auto');
    const run = this.forgeAuto;
    const show = currentBalance().forgeAuto && this.forgeMode === 'enhance' && !!item && (!!run || plusOf(item) < maxPlus());
    wrap.classList.toggle('hidden', !show);
    if (!show || !item) return;
    const sel = $<HTMLSelectElement>('forge-auto-target');
    const from = Math.min(plusOf(item) + 1, maxPlus());
    const key = `${item.uid}:${from}`;
    if (sel.dataset.key !== key) {
      // Keep the player's pick for the same item; a new item starts at one level up.
      const keep = sel.dataset.key?.startsWith(`${item.uid}:`) ? Number(sel.value) : 0;
      sel.innerHTML = '';
      for (let n = from; n <= maxPlus(); n++) sel.add(new Option(`ถึง +${n}`, String(n)));
      sel.value = String(run ? Math.max(run.target, from) : keep >= from ? keep : from);
      sel.dataset.key = key;
    }
    sel.disabled = !!run;
    const btn = $<HTMLButtonElement>('forge-auto-btn');
    btn.classList.toggle('running', !!run);
    btn.textContent = run ? '■ หยุด' : '▶ Auto';
    btn.disabled = !run && !!why;
    btn.title = run ? `ตีบวก Auto ถึง +${run.target} · กดเพื่อหยุด` : 'ตีบวกให้เองทีละครั้งจนถึงระดับที่เลือก หรือจนทอง/หินหมด';
  }

  /** Starts Auto enhance on the item in the slot, up to the level picked beside the button. */
  private startForgeAuto(): void {
    const item = this.forgeItem();
    if (!item || this.forgeAuto || !currentBalance().forgeAuto || this.forgeMode !== 'enhance') return;
    const target = Math.min(maxPlus(), Math.max(plusOf(item) + 1, Number($<HTMLSelectElement>('forge-auto-target').value) || 0));
    const run: ForgeAutoRun = { uid: item.uid, target, protect: this.forgeProtect };
    const why = this.forgeAutoBlock(run);
    if (why) {
      this.host.log(`🔨 ตีบวก Auto เริ่มไม่ได้: ${why}`, '#ff8a6a');
      return;
    }
    this.forgeAuto = run;
    this.host.log(`🔨 เริ่มตีบวก Auto ${itemName(item)} → +${target}${run.protect ? ' (ใช้หินกันระดับลด)' : ''}`, '#c9a8ff');
    if (!this.enhancing) this.renderForge();
    void this.runForgeAuto(run);
  }

  /** Stops Auto enhance (if it runs) and says why in the chat log. */
  private stopForgeAuto(why: string): void {
    if (!this.forgeAuto) return;
    this.forgeAuto = null;
    this.host.log(`🔨 ตีบวก Auto หยุด: ${why}`, '#c9a8ff');
    if (this.forgeOpen && !this.enhancing) this.renderForge();
  }

  /** Why Auto can't make another attempt now ('' = it can). The server checks it all again on every attempt. */
  private forgeAutoBlock(run: ForgeAutoRun): string {
    const p = this.g.player;
    if (!currentBalance().forgeAuto) return 'ผู้ดูแลปิดตีบวก Auto';
    if (!this.forgeOpen || this.forgeMode !== 'enhance') return 'ปิดหน้าต่างช่างตีเหล็ก';
    if (!p.alive) return 'ตัวละครล้ม';
    const item = this.forgeItem();
    if (!item || item.uid !== run.uid) return 'ไม่พบอุปกรณ์ในช่องแล้ว';
    if (plusOf(item) >= maxPlus()) return `ถึงระดับสูงสุด +${maxPlus()} แล้ว`;
    if (plusOf(item) >= run.target) return `ถึง +${plusOf(item)} แล้ว`;
    if (p.gold < enhanceCost(item)) return 'ทองไม่พอ';
    if (p.stoneCount('enhance') < stonesNeeded(item)) return `${STONE_NAME.enhance}ไม่พอ`;
    if (run.protect && dropsOnFail(item) && p.stoneCount('protect') < 1) return `${STONE_NAME.protect}หมด`;
    return '';
  }

  /** The Auto loop: one attempt at a time, each waiting for the bar and its result like a click would. */
  private async runForgeAuto(run: ForgeAutoRun): Promise<void> {
    const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, Math.max(0, ms)));
    let missed = 0;
    while (this.forgeAuto === run) {
      while (this.enhancing || this.forgeCooling()) await wait(Math.max(50, this.forgeReadyAt - performance.now() + 20));
      // A little past the bar, so the server's own cooldown (its tick and the ping) has surely ended too.
      await wait(FORGE_AUTO_GAP_MS);
      if (this.forgeAuto !== run) return;
      const why = this.forgeAutoBlock(run);
      if (why) {
        this.stopForgeAuto(why);
        return;
      }
      const got = await this.enhance(run.protect);
      if (this.forgeAuto !== run) return;
      if (got) {
        missed = 0;
        // Judge the target from the server's answer, not the snapshot (it may not have caught up yet).
        if (plusOf(got) >= Math.min(run.target, maxPlus())) {
          this.stopForgeAuto(`ถึง +${plusOf(got)} แล้ว`);
          return;
        }
      } else if (++missed >= 2) {
        // No answer twice in a row (lost link, or the server turned it down): stop rather than keep firing.
        this.stopForgeAuto('server ไม่ตอบรับ');
        return;
      }
    }
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
      return `<div class="fd-line${fixed ? ' fixed' : ''}"><span>${lineHtml(l)}</span>${note}</div>`;
    }).join('');
  }

  /** Enhance: success chance, cost, stones and the protection tick box. Returns why it can't be done ('' = it can). */
  private renderEnhanceCost(item: Item): string {
    const p = this.g.player;
    const cur = plusOf(item);
    if (cur >= maxPlus()) {
      $('forge-cost').innerHTML = `<div class="fc-max">ตีบวกถึงระดับสูงสุด +${maxPlus()} แล้ว</div>`;
      return 'ระดับสูงสุดแล้ว';
    }
    const cost = enhanceCost(item);
    const rate = successRate(item);
    const pity = pityBonus(item);
    const pct = (v: number) => `${Math.round(v * 10000) / 100}%`;
    const hidden = cur + 1 >= forgeConfig().hiddenFrom;
    const pityNote = pity <= 0 ? ''
      : hidden ? `<small class="pity">ล้มมาแล้ว ${item.pity} ครั้ง (โอกาสเพิ่มขึ้น)</small>`
      : `<small class="pity">รวม +${pct(pity)} จากล้ม ${item.pity} ครั้ง</small>`;
    const need = stonesNeeded(item);
    const haveEnh = p.stoneCount('enhance');
    const canProtect = dropsOnFail(item);
    const haveProt = p.stoneCount('protect');
    if (haveProt < 1) this.forgeProtect = false;
    // While Auto runs, show the choice it started with (the box is locked then).
    const protect = canProtect && (this.forgeAuto ? this.forgeAuto.protect : this.forgeProtect);
    $('forge-cost').innerHTML =
      `<div class="fc-rate"${rate < 1 ? ` title="ล้มแต่ละครั้ง โอกาสครั้งถัดไป +${pct(pityStep())} จนกว่าจะสำเร็จ"` : ''}><span>โอกาสสำเร็จ +${cur} → +${cur + 1}</span><b class="${rate < 1 ? 'risky' : ''}">${hidden ? '??' : pct(rate)}</b>` +
      `${pityNote}</div>` +
      `<div class="fd-row"><span>ค่าตีบวก</span><b class="${p.gold < cost ? 'bad' : ''}">${cost.toLocaleString()} G</b></div>` +
      (need ? `<div class="fd-row"><span>${stoneIcon('enhance')} ${STONE_NAME.enhance}</span><b class="${haveEnh < need ? 'bad' : ''}">ใช้ ${need} / มี ${haveEnh}</b></div>` : '') +
      (canProtect
        ? `<label class="fd-protect${haveProt < 1 ? ' off' : ''}"><input type="checkbox" id="forge-protect"${protect ? ' checked' : ''}${haveProt < 1 || this.forgeAuto ? ' disabled' : ''}>` +
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

  /** Asks first (the old values are gone for good), then rerolls the selected item. */
  private askReroll(kind: RerollKind): void {
    const item = this.forgeItems().find((w) => w.uid === this.forgeSel);
    const ranges = item && lineRanges(item);
    if (!item || !ranges || !item.lines || this.enhancing || this.forgeCooling()) return;
    const over = item.lines.some((l) => l.value > l.max);
    this.host.confirm(
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
    const [out] = await Promise.all([this.g.backend.reroll(item.uid, kind), this.swingHammer(), this.forgeCdDone()])
      .finally(() => (this.enhancing = false));
    if (!out) {
      this.forgeResult('fail', 'สุ่มไม่สำเร็จ');
      this.renderForge();
      return;
    }
    this.rerollPrev = { uid: item.uid, lines: before };
    this.forgeResult('ok', `${REROLL_NAME[kind]}แล้ว`);
    this.host.markInventory();
    this.renderForge();
  }

  /** Drilling: the stone, the cost, or why it can't be done ('' = it can). */
  private renderDrillCost(item: Item): string {
    const p = this.g.player;
    if (isDrilled(item)) {
      $('forge-cost').innerHTML = `<div class="fc-max">เจาะรูแล้ว (${socketCount(item) ? `${socketCount(item)} ช่อง` : 'ไม่มีช่อง'}) · เจาะซ้ำไม่ได้</div>`;
      return 'เจาะแล้ว';
    }
    const cost = drillCost(item);
    const have = p.stoneCount('drill');
    const [o0, o1, o2] = drillOdds();
    $('forge-cost').innerHTML =
      `<div class="safe">ได้ 0 ช่อง ${o0}% · 1 ช่อง ${o1}% · 2 ช่อง ${o2}%</div>` +
      `<div class="warn">⚠ เจาะได้ครั้งเดียวต่อชิ้น ได้ 0 ช่องก็เจาะใหม่ไม่ได้</div>` +
      `<div class="fd-row"><span>${stoneIcon('drill')} ${STONE_NAME.drill}</span><b class="${have < 1 ? 'bad' : ''}">ใช้ 1 / มี ${have}</b></div>` +
      `<div class="fd-row"><span>ค่าเจาะรู</span><b class="${p.gold < cost ? 'bad' : ''}">${cost.toLocaleString()} G</b></div>`;
    return have < 1 ? `ไม่มี${STONE_NAME.drill}` : p.gold < cost ? 'ทองไม่พอ' : '';
  }

  /** Asks first (drilling happens once per item), then drills the selected item. */
  private askDrill(): void {
    const item = this.forgeItem();
    if (!item || isDrilled(item) || this.enhancing || this.forgeCooling()) return;
    this.host.confirm(
      `เจาะรู ${itemName(item)}?<br><small>ค่าเจาะ ${drillCost(item).toLocaleString()} G + ${STONE_NAME.drill} 1 ก้อน · เจาะได้ครั้งเดียวต่อชิ้น ได้ 0 ช่องก็เจาะใหม่ไม่ได้</small>`,
      'เจาะรู',
      () => void this.drill(item),
    );
  }

  private async drill(item: Item): Promise<void> {
    if (this.enhancing || this.forgeCooling()) return;
    this.enhancing = true;
    this.startForgeCd();
    const [out] = await Promise.all([this.g.backend.drill(item.uid), this.swingHammer(), this.forgeCdDone()])
      .finally(() => (this.enhancing = false));
    if (!out) this.forgeResult('fail', 'เจาะไม่สำเร็จ');
    else if (socketCount(out) > 0) this.forgeResult('ok', `เจาะสำเร็จ! ได้ ${socketCount(out)} ช่อง`);
    else this.forgeResult('fail', 'เจาะแล้ว… ไม่ได้ช่อง');
    this.host.markInventory();
    this.renderForge();
  }

  /** "เจาะรู": the chance of 0 / 1 / 2 sockets (the /admin card tab's odds). */
  private drillOddsTable(): string {
    const odds = drillOdds();
    return '<table><tr><th>ผล</th><th>โอกาส</th></tr>' +
      odds.map((o, n) => `<tr><td>${n ? `${n} ช่อง` : 'ไม่ได้ช่อง'}</td><td>${o}%</td></tr>`).join('') +
      `</table><div class="hint">เจาะได้ครั้งเดียวต่อชิ้น · ใช้${STONE_NAME.drill} 1 ก้อน + ทอง · ช่องไม่หายตอนตีบวกหรือสุ่มค่า · เสียบการ์ดได้โดยคลิกการ์ดในกระเป๋า</div>`;
  }

  // ------------------------------------------------------------ card fusion (card plan 6.1, src/shared/cardFuse.ts)

  /** Every card in the bag with how many there are, in the card table's order. */
  private ownedCards(): { id: CardId; n: number }[] {
    const n = new Map<CardId, number>();
    for (const e of this.g.player.bag) if (isStone(e) && isCardId(e.stone)) n.set(e.stone, (n.get(e.stone) ?? 0) + e.count);
    return CARD_DEFAULTS.filter((d) => n.has(d.id)).map((d) => ({ id: d.id, n: n.get(d.id)! }));
  }

  private setFuse(sel: CardId[]): void {
    this.fuseSel = sel;
    this.forgeResult('', '');
    this.renderForge();
  }

  /** Puts a card into the next empty fusion slot: it must match the cards already in (rarity and floor) and be in the bag. */
  private addFuseCard(id: CardId): void {
    if (this.fuseSel.length >= FUSE_COUNT) return this.host.log('ช่องรวมการ์ดเต็มแล้ว (คลิกการ์ดในช่องเพื่อเอาออก)', '#ff8a6a');
    const first = this.fuseSel[0];
    if (first && cardDef(first)?.rarity !== cardDef(id)?.rarity) return this.host.log('การ์ดทั้ง 3 ใบต้องระดับเดียวกัน', '#ff8a6a');
    if (first && cardFloor(first) !== cardFloor(id)) return this.host.log('การ์ดทั้ง 3 ใบต้องมาจากชั้นเดียวกัน', '#ff8a6a');
    const used = this.fuseSel.filter((c) => c === id).length;
    if (this.g.player.stoneCount(id) <= used) return this.host.log(`${cardName(id)}ในกระเป๋าไม่พอ`, '#ff8a6a');
    this.setFuse([...this.fuseSel, id]);
  }

  /** The fusion menu: 3 card slots, the bag's cards to pick from, the cost and the odds. */
  private renderFuse(): void {
    const p = this.g.player;
    // Cards sold, traded or socketed since are taken back out of the slots.
    const left = new Map<CardId, number>();
    this.fuseSel = this.fuseSel.filter((id) => {
      const n = (left.get(id) ?? p.stoneCount(id)) - 1;
      left.set(id, n);
      return n >= 0;
    });
    const sel = this.fuseSel;
    const info = sel.length ? fuseInfo(sel) : null;
    const slot = $('forge-slot');
    slot.className = 'fuse';
    slot.style.removeProperty('--rc');
    slot.innerHTML = Array.from({ length: FUSE_COUNT }, (_, i) => {
      const id = sel[i];
      const d = id ? cardDef(id) : undefined;
      return id && d
        ? `<div class="fuse-card filled" data-fuse-i="${i}" style="--rc:${RARITY_COLOR[d.rarity]}" title="${cardName(id)} (คลิกเพื่อเอาออก)">${cardIcon(id)}</div>`
        : '<div class="fuse-card"></div>';
    }).join('');
    $('forge-drop-hint').innerHTML = info
      ? `การ์ด<span style="color:${RARITY_COLOR[info.rarity]}">${CARD_RARITY_NAME[info.rarity]}</span> ชั้น ${info.floor} · ${sel.length}/${FUSE_COUNT} ใบ`
      : 'คลิกการ์ดในกระเป๋าหรือรายการด้านขวา<small>ระดับเดียวกันและชั้นเดียวกัน 3 ใบ (ซ้ำกันได้)</small>';
    const owned = this.ownedCards();
    $('forge-item').innerHTML = owned.length
      ? '<div class="fi-name">การ์ดในกระเป๋า</div><div class="fuse-list">' + owned.map(({ id, n }) => {
        const d = cardDef(id)!;
        const free = n - sel.filter((c) => c === id).length;
        const fits = !sel.length || (cardDef(sel[0])?.rarity === d.rarity && cardFloor(sel[0]) === cardFloor(id));
        return `<button type="button" class="fuse-pick" data-fuse-card="${id}" ${free > 0 && fits && sel.length < FUSE_COUNT ? '' : 'disabled'}>` +
          `<span class="fp-icon">${cardIcon(id)}</span><span class="fp-name" style="color:${RARITY_COLOR[d.rarity]}">${cardName(id)}</span>` +
          `<span class="fp-n">ชั้น ${cardFloor(id)} · ×${free}</span></button>`;
      }).join('') + '</div>'
      : '<div class="fi-empty">ไม่มีการ์ดในกระเป๋า</div>';
    const why = sel.length < FUSE_COUNT ? `ใส่การ์ดอีก ${FUSE_COUNT - sel.length} ใบ` : fuseBlock(sel, (id) => p.stoneCount(id), p.gold);
    $('forge-cost').innerHTML = info
      ? `<div class="safe">สุ่มได้ 1 ใบจากการ์ด${CARD_RARITY_NAME[info.rarity]}ชั้น ${info.floor} ทั้งหมด ${info.pool.length} ใบ (ใบละ ${fmtPct(info.pool.length)}%)</div>` +
        '<div class="warn">⚠ การ์ดทั้ง 3 ใบหายไป อาจได้ใบเดิม</div>' +
        `<div class="fd-row"><span>ค่ารวมการ์ด</span><b class="${p.gold < info.cost ? 'bad' : ''}">${info.cost.toLocaleString()} G</b></div>`
      : '';
    const go = $<HTMLButtonElement>('forge-go');
    go.disabled = !!why;
    go.innerHTML = why || `${FORGE_ICON} รวมการ์ด`;
    $<HTMLButtonElement>('forge-cancel').disabled = !sel.length;
    const table = this.fuseOddsTable(info);
    if ($('forge-rates-btn').textContent !== 'ตารางโอกาส') $('forge-rates-btn').textContent = 'ตารางโอกาส';
    $('forge-rates-title').textContent = 'ตารางโอกาส — รวมการ์ด';
    if ($('forge-table').innerHTML !== table) $('forge-table').innerHTML = table;
    $('forge-foot').innerHTML = `<span class="ff-gold">${COIN_ICON} ${p.gold.toLocaleString()} G</span>`;
    this.renderForgeAuto(undefined, 'x');
  }

  /** "รวมการ์ด": every card the fusion can give and its chance (all equal). */
  private fuseOddsTable(info: ReturnType<typeof fuseInfo>): string {
    if (!info) return '<div class="hint">ใส่การ์ดใบแรกเพื่อดูว่าสุ่มได้ใบไหนบ้าง</div>';
    return '<table><tr><th>การ์ด</th><th>โอกาส</th></tr>' +
      info.pool.map((id) => `<tr><td style="color:${RARITY_COLOR[info.rarity]}">${cardName(id)}</td><td>${fmtPct(info.pool.length)}%</td></tr>`).join('') +
      `</table><div class="hint">การ์ด${CARD_RARITY_NAME[info.rarity]}ชั้น ${info.floor} · ทุกใบโอกาสเท่ากัน รวมใบที่ใส่ไปด้วย</div>`;
  }

  /** Asks first (the 3 cards are used up), then fuses. */
  private askFuse(): void {
    const sel = [...this.fuseSel];
    const info = fuseInfo(sel);
    if (sel.length !== FUSE_COUNT || !info || this.enhancing || this.forgeCooling()) return;
    this.host.confirm(
      `รวมการ์ด ${sel.map((id) => cardName(id)).join(' + ')}?<br><small>การ์ดทั้ง 3 ใบจะหายไป สุ่มได้การ์ด${CARD_RARITY_NAME[info.rarity]}ชั้น ${info.floor} 1 ใบ${info.cost ? ` · ค่ารวม ${info.cost.toLocaleString()} G` : ''}</small>`,
      'รวมการ์ด',
      () => void this.fuse(sel),
    );
  }

  private async fuse(sel: CardId[]): Promise<void> {
    if (this.enhancing || this.forgeCooling()) return;
    this.enhancing = true;
    this.startForgeCd();
    const [got] = await Promise.all([this.g.backend.fuseCards(sel), this.swingHammer(), this.forgeCdDone()])
      .finally(() => (this.enhancing = false));
    this.fuseSel = [];
    if (got && isCardId(got)) {
      this.forgeResult('ok', `ได้${cardName(got)}!`);
      openCardView(got, gameSocketHost(this.g));
    } else this.forgeResult('fail', 'รวมการ์ดไม่สำเร็จ');
    this.host.markInventory();
    this.renderForge();
  }

  /** True while the blacksmith cooldown (forgeCd()) is running. */
  private forgeCooling(): boolean {
    return performance.now() < this.forgeReadyAt;
  }

  /** Resolves when the cooldown bar has drained: results wait for it (owner 2026-11-18: never before the bar is full). */
  private forgeCdDone(): Promise<void> {
    return new Promise((done) => setTimeout(done, Math.max(0, this.forgeReadyAt - performance.now())));
  }

  /** Starts the blacksmith cooldown: the action button shows a draining bar until it ends. */
  private startForgeCd(): void {
    const cd = forgeCd();
    this.forgeReadyAt = performance.now() + cd * 1000;
    const go = $('forge-go');
    go.style.setProperty('--cd', `${cd}s`);
    go.classList.remove('cooling');
    void go.offsetWidth; // restart the bar
    go.classList.add('cooling');
    setTimeout(() => {
      if (!this.forgeCooling()) go.classList.remove('cooling');
    }, cd * 1000 + 20);
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

  /**
   * One enhance attempt on the item in the slot. `protectAuto` = Auto's protection choice (else the tick box).
   * Returns the item as the server left it, false when it didn't answer (or refused), null when nothing was sent.
   * Auto sends its protect choice as is: the snapshot may lag, and the server only uses a stone when a fail could drop.
   */
  private async enhance(protectAuto?: boolean): Promise<Item | false | null> {
    if (!this.forgeSel || this.enhancing || this.forgeCooling()) return null;
    const sel = this.forgeItems().find((w) => w.uid === this.forgeSel);
    const protect = protectAuto ?? (!!sel && dropsOnFail(sel) && this.forgeProtect);
    this.enhancing = true;
    this.startForgeCd();
    // The result waits for the hammer and for the cooldown bar to fill, whichever is later.
    const [out] = await Promise.all([this.g.backend.enhance(this.forgeSel, protect), this.swingHammer(), this.forgeCdDone()])
      .finally(() => (this.enhancing = false));
    if (!out) {
      this.renderForge();
      return false;
    }
    const { result, item } = out;
    // Short enough for one line on the narrow stage (owner 2026-11-18); forgeResult shrinks it if it still isn't.
    if (result === 'success') {
      this.forgeResult('ok', `สำเร็จ! ระดับขึ้นเป็น +${plusOf(item)}`);
    } else {
      this.forgeResult('fail', result === 'drop' ? `ล้มเหลว! ระดับลดลงเหลือ +${plusOf(item)}`
        : result === 'saved' ? `ล้มเหลว… หินกันระดับลด ยังเป็น +${plusOf(item)}`
        : 'ล้มเหลว… ระดับเท่าเดิม');
    }
    this.host.markInventory();
    this.renderForge();
    return item;
  }

  /** True while the blacksmith window is open (Game skips your own overhead enhance text then: the window shows it). */
  get forgeShown(): boolean {
    return this.forgeOpen;
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
    const f = forgeConfig();
    for (let t = 1; t <= maxPlus(); t++) {
      const fail = rateFor(t) >= 1 ? '—' : t >= f.dropFrom ? 'ระดับ −1' : 'เสียแค่ทอง';
      html += `<tr><td>+${t}</td><td>${t >= f.hiddenFrom ? '??' : `${Math.round(rateFor(t) * 10000) / 100}%`}</td><td>${fail}</td>` +
        `<td>${t >= f.stoneFrom && f.stonesPerTry > 0 ? f.stonesPerTry : '—'}</td><td>+${bonusPct(t)}%</td></tr>`;
    }
    return html + '</table><div class="hint">ตีบวกได้ทุกช่อง (อาวุธ หมวก เกราะ รองเท้า แหวน) · โบนัสเป็น % ของทุกค่าบนชิ้นนั้น' +
      (f.pity > 0 ? ` · ล้มแต่ละครั้งเพิ่มโอกาส +${f.pity}% จนกว่าจะสำเร็จ` : '') +
      ` · ${STONE_NAME.protect}กันระดับลด` +
      (f.stoneFrom <= maxPlus() && f.stonesPerTry > 0 ? `, ${STONE_NAME.enhance}ใช้ตั้งแต่ +${f.stoneFrom}` : '') + ' — ดรอปจากบอสเท่านั้น</div>';
  }
}

/** 100 / n as a short percent ("33.33"). */
function fmtPct(n: number): string {
  return String(Math.round((100 / Math.max(1, n)) * 100) / 100);
}
