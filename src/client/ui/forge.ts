import type { Game } from '../Game';
import {
  bonusPct, DROP_ON_FAIL_FROM, dropsOnFail, FORGE_CD, effectiveStats, enhanceCost, ENHANCE_STONES_PER_TRY, itemName,
  MAX_PLUS, PITY_STEP, pityBonus, plusOf, rateFor, STONE_FROM, stonesNeeded, successRate,
} from '../../shared/data/enhance';
import { REROLL_STONE, STONE_NAME } from '../../shared/data/stones';
import { lineRanges, rerollBlock, statRerollOdds } from '../../shared/data/items';
import { REROLL_NAME, rerollCost, type RerollKind } from '../../shared/data/reroll';
import { currentBalance } from '../../shared/balance';
import { isItem, EQUIP_SLOTS, RARITY_COLOR, SLOT_LABEL, STAT_LABEL, type BagEntry, type Item, type StatLine, type StoneKind, type StatKey } from '../../shared/types';
import { COIN_ICON, FORGE_ICON, itemIcon, stoneIcon } from '../icons';
import { $, fmtNum, lineHtml } from './hudShared';

/** Enhance tries whose target level is this or higher show "??" instead of the success chance (display only). */
const HIDDEN_RATE_FROM = 11;

/** The blacksmith menu's one-line description of each system (left column, under the menu). */
const FORGE_DESC: Record<'enhance' | RerollKind, string> = {
  enhance: 'เพิ่มระดับ +N ทุกค่าบนชิ้นนั้นแรงขึ้นเป็น % · ยิ่งบวกสูง ยิ่งเสี่ยง',
  values: 'สุ่มค่าตัวเลขใหม่ทุกบรรทัด tier เท่าเดิม',
  stat: 'สุ่มสเตตัสเสริม 1 บรรทัด เป็นชนิดใหม่ พร้อม tier และค่าใหม่',
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
  /** performance.now() when the next blacksmith action may be sent (FORGE_CD after the last one). */
  private forgeReadyAt = 0;
  /** Use a protection stone on attempts that can drop the level (the forge's tick box; off until ticked). */
  private forgeProtect = false;
  /** The blacksmith's menu: enhance, or one of the rerolls. */
  private forgeMode: 'enhance' | RerollKind = 'enhance';
  /**
   * Auto enhance while it runs (owner 2026-11-18): the item, the level to stop at, and whether to use protection
   * stones (taken from the tick box when it started). Browser side only: it sends the same enhance action as a click.
   */
  private forgeAuto: ForgeAutoRun | null = null;
  /** Lines of the item before its last reroll, shown next to the new ones until another item is picked. */
  private rerollPrev: { uid: string; lines: StatLine[] } | null = null;

  constructor(private readonly g: Game, private readonly host: ForgeHost) {
    $('forge-close').onclick = () => this.closeForge();
    $('forge-go').onclick = () => {
      if (this.forgeAuto) return;
      if (this.forgeMode === 'enhance') void this.enhance();
      else this.askReroll(this.forgeMode);
    };
    $('forge-auto-btn').onclick = () => (this.forgeAuto ? this.stopForgeAuto('กดหยุด') : this.startForgeAuto());
    $('forge-cancel').onclick = () => this.forgePlace(null);
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
      const item = this.forgeItem();
      if (item) this.host.showTip(item, e, 'ลากชิ้นอื่นมาวางเพื่อเปลี่ยน · ปุ่ม "นำออก" เพื่อเอาออก');
      else this.host.hideTip();
    });
    fslot.addEventListener('mouseleave', () => this.host.hideTip());
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
      `<div class="fi-lines">${this.forgeLines(item, mode)}</div>`;
    const why = mode === 'enhance' ? this.renderEnhanceCost(item) : this.renderRerollCost(item, mode);
    go.disabled = !!why || !!this.forgeAuto;
    go.innerHTML = why || label;
    this.renderForgeAuto(item, why);
  }

  /** The Auto enhance controls: shown in the enhance menu with an item that can still go up, and the /admin switch on. */
  private renderForgeAuto(item: Item | undefined, why: string): void {
    const wrap = $('forge-auto');
    const run = this.forgeAuto;
    const show = currentBalance().forgeAuto && this.forgeMode === 'enhance' && !!item && (!!run || plusOf(item) < MAX_PLUS);
    wrap.classList.toggle('hidden', !show);
    if (!show || !item) return;
    const sel = $<HTMLSelectElement>('forge-auto-target');
    const from = Math.min(plusOf(item) + 1, MAX_PLUS);
    const key = `${item.uid}:${from}`;
    if (sel.dataset.key !== key) {
      // Keep the player's pick for the same item; a new item starts at one level up.
      const keep = sel.dataset.key?.startsWith(`${item.uid}:`) ? Number(sel.value) : 0;
      sel.innerHTML = '';
      for (let n = from; n <= MAX_PLUS; n++) sel.add(new Option(`ถึง +${n}`, String(n)));
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
    const target = Math.min(MAX_PLUS, Math.max(plusOf(item) + 1, Number($<HTMLSelectElement>('forge-auto-target').value) || 0));
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
    if (plusOf(item) >= MAX_PLUS) return `ถึงระดับสูงสุด +${MAX_PLUS} แล้ว`;
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
        if (plusOf(got) >= Math.min(run.target, MAX_PLUS)) {
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
    // While Auto runs, show the choice it started with (the box is locked then).
    const protect = canProtect && (this.forgeAuto ? this.forgeAuto.protect : this.forgeProtect);
    $('forge-cost').innerHTML =
      `<div class="fc-rate"${rate < 1 ? ` title="ล้มแต่ละครั้ง โอกาสครั้งถัดไป +${pct(PITY_STEP)} จนกว่าจะสำเร็จ"` : ''}><span>โอกาสสำเร็จ +${cur} → +${cur + 1}</span><b class="${rate < 1 ? 'risky' : ''}">${hidden ? '??' : pct(rate)}</b>` +
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

  /** True while the blacksmith cooldown (FORGE_CD) is running. */
  private forgeCooling(): boolean {
    return performance.now() < this.forgeReadyAt;
  }

  /** Resolves when the cooldown bar has drained: results wait for it (owner 2026-11-18: never before the bar is full). */
  private forgeCdDone(): Promise<void> {
    return new Promise((done) => setTimeout(done, Math.max(0, this.forgeReadyAt - performance.now())));
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
    for (let t = 1; t <= MAX_PLUS; t++) {
      const fail = rateFor(t) >= 1 ? '—' : t >= DROP_ON_FAIL_FROM ? 'ระดับ −1' : 'เสียแค่ทอง';
      html += `<tr><td>+${t}</td><td>${t >= HIDDEN_RATE_FROM ? '??' : `${Math.round(rateFor(t) * 1000) / 10}%`}</td><td>${fail}</td>` +
        `<td>${t >= STONE_FROM ? ENHANCE_STONES_PER_TRY : '—'}</td><td>+${bonusPct(t)}%</td></tr>`;
    }
    return html + '</table><div class="hint">ตีบวกได้ทุกช่อง (อาวุธ หมวก เกราะ รองเท้า แหวน) · โบนัสเป็น % ของทุกค่าบนชิ้นนั้น' +
      ` · ล้มแต่ละครั้งเพิ่มโอกาส +${Math.round(PITY_STEP * 100)}% จนกว่าจะสำเร็จ` +
      ` · ${STONE_NAME.protect}กันระดับลด, ${STONE_NAME.enhance}ใช้ตั้งแต่ +${STONE_FROM} — ดรอปจากบอสเท่านั้น</div>`;
  }
}
