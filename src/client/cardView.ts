// One monster card shown big (owner 2026-11-25): the monster picture fills the card, a thin papercraft frame lies over
// it, a shine follows the pointer while the card tilts a little, and the name, rarity, slot and effects are written
// under the card. Used by the /admin "การ์ด" tab now and meant for the in-game card window (plan PR 6) later.
// The look numbers come from the card tuning (viewShine, viewShinePct, viewTiltDeg, viewRainbow in data/cards.ts).
import {
  CARD_GROUP_NAME, CARD_RARITY_NAME, cardArt, cardFrame, cardFxLines, cardName,
  type CardFx, type CardGroup, type CardId, type CardRarity,
} from '../shared/data/cards';
import { RARITY_COLOR } from '../shared/types';
import '../styles/cardView.css';

export interface CardLook {
  /** Shine on (viewShine). */
  shine: boolean;
  /** Shine strength 0–100 (viewShinePct). */
  shinePct: number;
  /** Largest tilt in degrees, 0 = flat (viewTiltDeg). */
  tiltDeg: number;
  /** Rainbow sheen on legendary cards (viewRainbow). */
  rainbow: boolean;
}

export interface CardShown {
  id: CardId;
  rarity: CardRarity;
  group: CardGroup;
  fx: Partial<Record<CardFx, number>>;
}

export { cardFxLines };

/** The card (picture, frame, shine) with its text under it. The card follows the pointer while it is over it. */
export function cardViewEl(c: CardShown, look: CardLook): HTMLElement {
  const name = cardName(c.id);
  const shine = document.createElement('div');
  shine.className = 'cv-shine';
  const rainbow = look.rainbow && c.rarity === 'legendary';
  const card = document.createElement('div');
  card.className = `cv-card cv-${c.rarity}${look.shine ? '' : ' cv-noshine'}${rainbow ? ' cv-rainbow' : ''}`;
  card.style.setProperty('--cv-shine', String(Math.max(0, Math.min(100, look.shinePct)) / 100));
  const art = new Image();
  art.className = 'cv-art';
  art.src = cardArt(c.id);
  art.alt = name;
  art.draggable = false;
  const frame = new Image();
  frame.className = 'cv-frame';
  frame.src = cardFrame(c.rarity);
  frame.alt = '';
  frame.draggable = false;
  card.append(art, shine, frame);

  // Tilt and shine from where the pointer is on the card (mouse, pen or a finger dragged over it).
  const tilt = Math.max(0, look.tiltDeg);
  const move = (e: PointerEvent) => {
    const r = card.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    card.style.setProperty('--cv-x', `${x * 100}%`);
    card.style.setProperty('--cv-y', `${y * 100}%`);
    card.style.transform = `rotateX(${((0.5 - y) * 2 * tilt).toFixed(2)}deg) rotateY(${((x - 0.5) * 2 * tilt).toFixed(2)}deg)`;
    card.classList.add('cv-live');
  };
  const leave = () => {
    card.style.transform = '';
    card.classList.remove('cv-live');
  };
  card.addEventListener('pointermove', move);
  card.addEventListener('pointerdown', move);
  card.addEventListener('pointerleave', leave);
  card.addEventListener('pointercancel', leave);

  const text = document.createElement('div');
  text.className = 'cv-text';
  const title = document.createElement('div');
  title.className = 'cv-name';
  title.textContent = name;
  const meta = document.createElement('div');
  meta.className = 'cv-meta';
  const rar = document.createElement('span');
  rar.textContent = CARD_RARITY_NAME[c.rarity];
  rar.style.color = RARITY_COLOR[c.rarity];
  meta.append(rar, ` · ใส่ได้: ${CARD_GROUP_NAME[c.group]}`);
  const fx = document.createElement('ul');
  fx.className = 'cv-fx';
  for (const line of cardFxLines(c.fx)) {
    const li = document.createElement('li');
    li.textContent = line;
    fx.append(li);
  }
  text.append(title, meta, fx);

  const box = document.createElement('div');
  box.className = 'cv';
  box.append(h3d(card), text);
  return box;
}

/** The card inside a box that gives it depth for the 3D tilt. */
function h3d(card: HTMLElement): HTMLElement {
  const stage = document.createElement('div');
  stage.className = 'cv-stage';
  stage.append(card);
  return stage;
}
