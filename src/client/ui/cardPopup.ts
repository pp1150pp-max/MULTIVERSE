// A monster card shown big over the game (card-system PR 1): clicking a card in the bag opens it. The game behind
// darkens; ✕, Esc or a click outside the socket list closes it. The card's effects and group come from the card tuning
// the server sends (src/shared/cardTuning.ts), its look from the /admin card tab numbers viewShine / viewShinePct /
// viewTiltDeg / viewRainbow.
// Under the card: "เสียบการ์ด" (owner 2026-11-26: socket from the bag, anywhere) lists the player's drilled gear
// (worn first, then the bag) the card fits; a click puts one card into that item's first empty socket.
import { cardDef, cardNum } from '../../shared/cardTuning';
import { CARD_FX, CARD_FX_NAME, CARD_GROUP_NAME, cardFxLines, cardName, type CardId } from '../../shared/data/cards';
import { cardFxCap, cardFxRaw, freeSocket, isDrilled, SLOT_CARD_GROUP, socketCards, socketCount } from '../../shared/cardSockets';
import { itemName } from '../../shared/data/enhance';
import { EQUIP_SLOTS, isItem, RARITY_COLOR, SLOT_LABEL, type Item } from '../../shared/types';
import type { Game } from '../Game';
import { cardViewEl } from '../cardView';
import { itemIcon } from '../icons';

/** What the socket list needs from the game: the player's gear and how to send a socket action. */
export interface CardSocketHost {
  /** Worn gear first, then gear in the bag. */
  gear(): { item: Item; worn: boolean }[];
  /** How many of this card are in the bag. */
  count(id: CardId): number;
  socket(uid: string, id: CardId): void;
}

/** The socket host for the game's own player: worn gear (EQUIP_SLOTS order), then the bag. */
export function gameSocketHost(g: Game): CardSocketHost {
  return {
    gear: () => {
      const p = g.player;
      const out: { item: Item; worn: boolean }[] = [];
      for (const s of EQUIP_SLOTS) {
        const it = p.equipment[s];
        if (it) out.push({ item: it, worn: true });
      }
      for (const e of p.bag) if (isItem(e)) out.push({ item: e, worn: false });
      return out;
    },
    count: (id) => g.player.stoneCount(id),
    socket: (uid, id) => g.backend.socketCard(uid, id),
  };
}

/**
 * The tooltip lines of an item's sockets (card plan 7.2): nothing before drilling, "เจาะแล้ว: ไม่มีช่อง", or one line per
 * socket, "◇ ช่องว่าง" / "◆ การ์ดหมาป่า: พลังโจมตี +2% · ดูดเลือด +0.5%".
 */
export function socketTipHtml(item: Item): string {
  if (!isDrilled(item)) return '<div class="tt-sock off">ยังไม่เจาะรู (เจาะได้ที่ช่างตีเหล็ก)</div>';
  if (socketCount(item) === 0) return '<div class="tt-sock off">เจาะแล้ว: ไม่มีช่อง</div>';
  return `<div class="tt-sock">${socketCards(item).map((c) => {
    const d = c ? cardDef(c) : undefined;
    return d && c
      ? `<div><span style="color:${RARITY_COLOR[d.rarity]}">◆ ${cardName(c)}</span>: ${cardFxLines(d.fx).join(' · ')}</div>`
      : '<div class="off">◇ ช่องว่าง</div>';
  }).join('')}</div>`;
}

/**
 * The character window's "ผลการ์ด" (card plan 7.4): every card effect from worn gear, summed; one at its cap shows
 * "(เต็ม)" with what the cards add up to before the cap. Nothing when no card is worn.
 */
export function cardFxHtml(worn: Iterable<Item | null | undefined>): string {
  const list = [...worn];
  const raw = cardFxRaw(list);
  const rows = CARD_FX.filter((f) => raw[f] > 0).map((f) => {
    const cap = cardFxCap(f);
    const full = raw[f] >= cap;
    const v = Math.min(raw[f], cap);
    return `<div class="stat card-fx"><span>${CARD_FX_NAME[f].replace(/\s*%$/, '')}</span>` +
      `<b>+${v}%${full ? ` <small title="การ์ดรวม ${raw[f]}%">(เต็ม)</small>` : ''}</b></div>`;
  });
  return rows.length ? `<div class="stat-head">ผลการ์ด</div>${rows.join('')}` : '';
}

let open: HTMLElement | null = null;

const onKey = (e: KeyboardEvent): void => {
  if (e.key === 'Escape') {
    e.stopPropagation();
    closeCardView();
  }
};

export function closeCardView(): void {
  open?.remove();
  open = null;
  window.removeEventListener('keydown', onKey, true);
}

/** The "เสียบการ์ด" list: gear of the card's group, those with an empty socket clickable. */
function socketList(id: CardId, host: CardSocketHost): HTMLElement {
  const d = cardDef(id)!;
  const box = document.createElement('div');
  box.className = 'cardpop-sock';
  // Clicks in here never close the window.
  box.addEventListener('click', (e) => e.stopPropagation());
  const title = document.createElement('div');
  title.className = 'cs-title';
  title.textContent = `เสียบการ์ด (มี ${host.count(id)} ใบ)`;
  box.append(title);
  const fits = host.gear().filter((g) => SLOT_CARD_GROUP[g.item.slot] === d.group && isDrilled(g.item) && socketCount(g.item) > 0);
  if (!fits.length) {
    const none = document.createElement('div');
    none.className = 'cs-none';
    none.textContent = `ยังไม่มีอุปกรณ์ที่เจาะรูแล้วในกลุ่ม ${CARD_GROUP_NAME[d.group]} · เจาะรูได้ที่ช่างตีเหล็ก`;
    box.append(none);
    return box;
  }
  const list = document.createElement('div');
  list.className = 'cs-list';
  for (const { item, worn } of fits) {
    const free = freeSocket(item) >= 0;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'cs-row';
    row.disabled = !free || host.count(id) < 1;
    const holes = socketCards(item).map((c) => (c ? '◆' : '◇')).join('');
    row.innerHTML = `<span class="cs-icon">${itemIcon(item)}</span>` +
      `<span class="cs-name" style="color:${RARITY_COLOR[item.rarity]}">${itemName(item)}</span>` +
      `<span class="cs-meta">${SLOT_LABEL[item.slot]} · ${worn ? 'สวมอยู่' : 'ในกระเป๋า'} · <b>${holes}</b>${free ? '' : ' (เต็ม)'}</span>`;
    row.title = free ? 'คลิกเพื่อเสียบการ์ดลงช่องว่างแรก' : 'ไม่มีช่องว่าง: ถอดการ์ดเดิมก่อน (การ์ดเดิมจะแตก)';
    row.addEventListener('click', () => {
      host.socket(item.uid, id);
      closeCardView();
    });
    list.append(row);
  }
  box.append(list);
  return box;
}

/**
 * The sockets of one item (Shift+click gear with cards, or "ถอดการ์ด" on the touch sheet): each card with a button that
 * takes it out after `confirm` (the card breaks, owner 2026-11-11). `unsocket` sends the action.
 */
export function openSocketView(
  item: Item,
  confirm: (html: string, yes: string, onYes: () => void) => void,
  unsocket: (uid: string, i: number) => void,
): void {
  closeCardView();
  const box = document.createElement('div');
  box.className = 'cardpop-sock cardpop-item';
  box.addEventListener('click', (e) => e.stopPropagation());
  const title = document.createElement('div');
  title.className = 'cs-title';
  title.innerHTML = `<span style="color:${RARITY_COLOR[item.rarity]}">${itemName(item)}</span> · ${socketCount(item)} ช่อง`;
  box.append(title);
  const cost = cardNum('unsocketCost');
  socketCards(item).forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'cs-slot';
    const d = c ? cardDef(c) : undefined;
    row.innerHTML = d && c
      ? `<span class="cs-name" style="color:${RARITY_COLOR[d.rarity]}">◆ ${cardName(c)}</span><span class="cs-meta">${cardFxLines(d.fx).join(' · ')}</span>`
      : '<span class="cs-name">◇ ช่องว่าง</span><span class="cs-meta">คลิกการ์ดในกระเป๋าเพื่อเสียบ</span>';
    if (c) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cs-out';
      b.textContent = 'ถอด (การ์ดแตก)';
      b.addEventListener('click', () => {
        closeCardView();
        confirm(
          `ถอด${cardName(c)}ออกจาก ${itemName(item)}?<br><small>⚠ การ์ดจะแตกหายไป ย้อนคืนไม่ได้${cost ? ` · ค่าถอด ${cost.toLocaleString()} G` : ''}</small>`,
          'ถอดการ์ด',
          () => unsocket(item.uid, i),
        );
      });
      row.append(b);
    }
    box.append(row);
  });
  const hint = document.createElement('div');
  hint.className = 'cardpop-hint';
  hint.textContent = 'คลิกที่ว่างเพื่อปิด';
  const bg = document.createElement('div');
  bg.id = 'card-view';
  const x = document.createElement('button');
  x.className = 'cardpop-x';
  x.type = 'button';
  x.textContent = '✕';
  x.title = 'ปิด';
  const wrap = document.createElement('div');
  wrap.className = 'cardpop-itemwrap';
  wrap.append(box, hint);
  bg.append(wrap, x);
  bg.addEventListener('click', () => closeCardView());
  x.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCardView();
  });
  document.body.append(bg);
  open = bg;
  window.addEventListener('keydown', onKey, true);
}

/** Opens the card window for this card (replacing one already open), with the socket list when `host` is given. */
export function openCardView(id: CardId, host?: CardSocketHost): void {
  const d = cardDef(id);
  if (!d) return;
  closeCardView();
  const view = cardViewEl(d, {
    shine: cardNum('viewShine') === 1,
    shinePct: cardNum('viewShinePct'),
    tiltDeg: cardNum('viewTiltDeg'),
    rainbow: cardNum('viewRainbow') === 1,
  });
  if (host) view.append(socketList(id, host));
  const hint = document.createElement('div');
  hint.className = 'cardpop-hint';
  hint.textContent = host ? 'คลิกที่ว่างเพื่อปิด' : 'คลิกที่ไหนก็ได้เพื่อปิด';
  view.append(hint);
  const x = document.createElement('button');
  x.className = 'cardpop-x';
  x.type = 'button';
  x.textContent = '✕';
  x.title = 'ปิด';
  const bg = document.createElement('div');
  bg.id = 'card-view';
  bg.append(view, x);
  // A click anywhere closes, but not the end of a drag (tilting the card with a finger or the mouse).
  let down = { x: 0, y: 0 };
  bg.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  bg.addEventListener('click', (e) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10) closeCardView();
  });
  x.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCardView();
  });
  document.body.append(bg);
  open = bg;
  window.addEventListener('keydown', onKey, true);
}
