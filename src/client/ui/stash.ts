import type { Game } from '../Game';
import type { SortKey } from '../../shared/sim/Player';
import { nextRowPrice, STASH_MAX, STASH_ROW, STASH_ROW_PRICES, STASH_START } from '../../shared/sim/stash';
import type { BagEntry } from '../../shared/types';
import { COIN_ICON } from '../icons';
import { $ } from './hudShared';
import type { StashLineKey } from '../../shared/npcTalk';

/** What the stash window needs from the HUD. */
export interface StashHost {
  log(msg: string, color?: string): void;
  confirm(html: string, yesLabel: string, onYes: () => void): void;
  closeConfirm(): void;
  hideTip(): void;
  toggleBag(force?: boolean): void;
  markInventory(): void;
  itemCell(item: BagEntry | null | undefined, attrs: string, placeholder?: string, selected?: boolean): string;
}

/**
 * The warehouse keeper's window (account stash): slots, rows to buy, gold in/out, sort.
 * Dragging and the grid's clicks stay in hud.ts with the bag's drag & drop.
 */
export class StashWindow {
  private stashOpen = false;
  /** The talk window's keeper says something about what just happened (npcTalk.stash lines); null = nobody listens. */
  onTalk: ((key: StashLineKey, ...args: (string | number)[]) => void) | null = null;

  constructor(private readonly g: Game, private readonly host: StashHost) {
    $('stash-close').onclick = () => this.closeStash();
    $('stash-deposit').onclick = () => this.stashGold(1);
    $('stash-withdraw').onclick = () => this.stashGold(-1);
    $('stash-deposit-all').onclick = () => this.stashGold(1, true);
    $('stash-withdraw-all').onclick = () => this.stashGold(-1, true);
    $('stash-gold-amt').addEventListener('keydown', (e) => e.stopPropagation());
    const sortChoice = (): [SortKey, boolean] =>
      [$<HTMLSelectElement>('sort-key').value as SortKey, $('sort-dir').dataset.desc === '1'];
    $('stash-sort-go').onclick = () => {
      g.backend.stashSort(...sortChoice());
      this.host.hideTip();
      this.host.markInventory();
    };
  }

  /** True while the stash window is open. */
  get isOpen(): boolean {
    return this.stashOpen;
  }

  // ------------------------------------------------------------ warehouse keeper (stash)

  /** Opens the window (hud.ts closes the other NPC windows first). `inTalk` = inside the NPC talk window: no bag window. */
  openStash(inTalk = false): void {
    this.stashOpen = true;
    $('stash').classList.remove('hidden');
    if (!inTalk) this.host.toggleBag(true);
    this.host.markInventory();
    this.renderStash();
  }

  closeStash(): void {
    if (!this.stashOpen) return;
    this.stashOpen = false;
    $('stash').classList.add('hidden');
    this.host.closeConfirm();
    this.host.hideTip();
    this.host.markInventory();
  }

  /** Bought slots, then one locked bar per row not bought yet (only the next one can be bought). */
  renderStash(): void {
    const st = this.g.player.stash;
    let html = st.items.map((it, i) => this.host.itemCell(it, `data-s="${i}"`)).join('');
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

  renderStashMoney(): void {
    const p = this.g.player;
    $('stash-gold-in').textContent = `${p.stash.gold.toLocaleString()} G`;
    $('stash-gold-carry').innerHTML = `ถืออยู่ ${COIN_ICON} ${p.gold.toLocaleString()} G`;
  }

  buyStashRow(): void {
    const p = this.g.player;
    const price = nextRowPrice(p.stash);
    if (price === null) return;
    if (p.gold < price) {
      this.host.log(`ทองไม่พอ — ต้องใช้ ${price.toLocaleString()} G`, '#ff8a6a');
      return;
    }
    this.host.confirm(
      `ขยายคลังอีก ${STASH_ROW} ช่อง (${p.stash.size} → ${p.stash.size + STASH_ROW})?<br><small>จ่าย ${price.toLocaleString()} G · ใช้ได้ทุกตัวละครในบัญชี</small>`,
      `จ่าย ${price.toLocaleString()} G`,
      () => {
        this.g.backend.stashBuyRow();
        this.host.markInventory();
        this.onTalk?.('row', p.stash.size + STASH_ROW);
      },
    );
  }

  /** dir 1 = deposit the typed amount, -1 = withdraw it. `all` = every coin carried / stored instead. */
  private stashGold(dir: 1 | -1, all = false): void {
    const input = $<HTMLInputElement>('stash-gold-amt');
    const p = this.g.player;
    const amount = all ? (dir > 0 ? p.gold : p.stash.gold) : Math.floor(Number(input.value));
    if (all && amount <= 0) {
      this.host.log(dir > 0 ? 'ไม่มีทองติดตัว' : 'ไม่มีทองในคลัง', '#b9b09a');
      return;
    }
    if (!(amount > 0)) {
      this.host.log('ใส่จำนวนทองก่อน', '#b9b09a');
      return;
    }
    if (dir > 0 && amount > p.gold) {
      this.host.log(`ทองที่ถืออยู่ไม่พอ (มี ${p.gold.toLocaleString()} G)`, '#ff8a6a');
      return;
    }
    if (dir < 0 && amount > p.stash.gold) {
      this.host.log(`ทองในคลังไม่พอ (มี ${p.stash.gold.toLocaleString()} G)`, '#ff8a6a');
      return;
    }
    this.g.backend.stashGold(dir * amount);
    this.onTalk?.(dir > 0 ? 'goldIn' : 'goldOut', amount.toLocaleString());
    input.value = '';
    this.host.markInventory();
  }
}
