// A monster card shown big over the game (card-system PR 1): clicking a card in the bag opens it. The game behind
// darkens; ✕, Esc or a click anywhere closes it. The card's effects and group come from the card tuning the server
// sends (src/shared/cardTuning.ts), its look from the /admin card tab numbers viewShine / viewShinePct / viewTiltDeg / viewRainbow.
import { cardDef, cardNum } from '../../shared/cardTuning';
import type { CardId } from '../../shared/data/cards';
import { CARD_SOON } from '../../shared/data/stones';
import { cardViewEl } from '../cardView';

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

/** Opens the card window for this card (replacing one already open). */
export function openCardView(id: CardId): void {
  const d = cardDef(id);
  if (!d) return;
  closeCardView();
  const view = cardViewEl(d, {
    shine: cardNum('viewShine') === 1,
    shinePct: cardNum('viewShinePct'),
    tiltDeg: cardNum('viewTiltDeg'),
    rainbow: cardNum('viewRainbow') === 1,
  });
  const soon = document.createElement('div');
  soon.className = 'cardpop-soon';
  soon.textContent = CARD_SOON;
  const hint = document.createElement('div');
  hint.className = 'cardpop-hint';
  hint.textContent = 'คลิกที่ไหนก็ได้เพื่อปิด';
  view.append(soon, hint);
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
