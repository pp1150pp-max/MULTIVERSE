// One monster card shown big (owner 2026-11-25): the monster picture fills the card, a thin papercraft frame lies over
// it, a shine follows the pointer while the card tilts a little, and the name, rarity, slot and effects are written
// under the card. Used by the /admin "การ์ด" tab and the in-game card window (src/client/ui/cardPopup.ts).
// The shine differs by rarity (owner 2026-11-26, card plan 7.1): rare a white sweep · epic the sweep + colour sparkles
// · legendary a rainbow holo that changes colour with the tilt. Light rays in the rarity's colour can shine behind the
// card, and on a touch screen the shine drifts slowly by itself while the card isn't touched.
// The look numbers come from the card tuning (viewShine, viewShinePct_<rarity>, viewSparkle, viewRainbow, viewRays,
// viewIdle, viewTiltDeg in data/cards.ts): cardLook() reads them.
import {
  CARD_GROUP_NAME, CARD_RARITY_NAME, cardArt, cardFrame, cardFxLines, cardName,
  type CardFx, type CardGroup, type CardId, type CardRarity,
} from '../shared/data/cards';
import { RARITY_COLOR } from '../shared/types';
import '../styles/cardView.css';

export interface CardLook {
  /** Strength 0–100 of the pointer shine; 0 = none. */
  shinePct: number;
  /** Largest tilt in degrees, 0 = flat (viewTiltDeg). */
  tiltDeg: number;
  /** Colour sparkles (epic, viewSparkle). */
  sparkle: boolean;
  /** Rainbow holo that follows the tilt (legendary, viewRainbow). */
  holo: boolean;
  /** Light rays behind the card in the rarity's colour (viewRays). */
  rays: boolean;
  /** Touch screens: the shine drifts by itself while the card isn't touched (viewIdle). */
  idle: boolean;
}

/** The look of a card of `rarity` from the card numbers (`num` = cardNum, or the /admin tab's unsaved values). */
export function cardLook(num: (key: string) => number, rarity: CardRarity): CardLook {
  const on = num('viewShine') === 1;
  return {
    shinePct: on ? Math.max(0, Math.min(100, num(`viewShinePct_${rarity}`))) : 0,
    tiltDeg: Math.max(0, num('viewTiltDeg')),
    sparkle: on && rarity === 'epic' && num('viewSparkle') === 1,
    holo: on && rarity === 'legendary' && num('viewRainbow') === 1,
    rays: num('viewRays') === 1,
    idle: num('viewIdle') === 1,
  };
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
  const layer = (cls: string) => {
    const el = document.createElement('div');
    el.className = cls;
    return el;
  };
  const card = document.createElement('div');
  const shine = look.shinePct > 0;
  card.className = `cv-card cv-${c.rarity}${shine ? '' : ' cv-noshine'}${look.sparkle ? ' cv-sparkle' : ''}${look.holo ? ' cv-holo' : ''}`;
  card.style.setProperty('--cv-shine', String(look.shinePct / 100));
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
  // Picture, then the colour layers (holo / sparkles), the white glare on top, then the frame.
  card.append(art);
  if (look.holo) card.append(layer('cv-holo-l'));
  if (look.sparkle) card.append(layer('cv-spark'));
  card.append(layer('cv-shine'), frame);

  // Tilt and shine from where the pointer is on the card (mouse, pen or a finger dragged over it).
  const tilt = Math.max(0, look.tiltDeg);
  const place = (x: number, y: number) => {
    card.style.setProperty('--cv-x', `${x * 100}%`);
    card.style.setProperty('--cv-y', `${y * 100}%`);
    // -1..1 from the middle, for the holo's colour shift.
    card.style.setProperty('--cv-dx', ((x - 0.5) * 2).toFixed(3));
    card.style.setProperty('--cv-dy', ((y - 0.5) * 2).toFixed(3));
    card.style.transform = `rotateX(${((0.5 - y) * 2 * tilt).toFixed(2)}deg) rotateY(${((x - 0.5) * 2 * tilt).toFixed(2)}deg)`;
  };
  let touching = false;
  const move = (e: PointerEvent) => {
    const r = card.getBoundingClientRect();
    touching = true;
    place(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
    card.classList.add('cv-live');
  };
  const leave = () => {
    touching = false;
    card.style.transform = '';
    card.classList.remove('cv-live');
  };
  card.addEventListener('pointermove', move);
  card.addEventListener('pointerdown', move);
  card.addEventListener('pointerleave', leave);
  card.addEventListener('pointercancel', leave);
  card.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') leave();
  });
  // Touch screens: a slow drift while nobody touches the card (stops once the card leaves the page).
  if (shine && look.idle && matchMedia('(hover: none)').matches) {
    const t0 = performance.now();
    const drift = (now: number) => {
      if (!card.isConnected && now - t0 > 1000) return;
      if (!touching) {
        const t = (now - t0) / 1000;
        place(0.5 + 0.42 * Math.sin(t * 0.7), 0.5 + 0.3 * Math.sin(t * 0.45 + 1));
        card.style.transform = `rotateX(${(Math.sin(t * 0.45 + 1) * -0.3 * tilt).toFixed(2)}deg) rotateY(${(Math.sin(t * 0.7) * 0.4 * tilt).toFixed(2)}deg)`;
        card.classList.add('cv-live');
      }
      requestAnimationFrame(drift);
    };
    requestAnimationFrame(drift);
  }

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

  const stage = document.createElement('div');
  stage.className = 'cv-stage';
  stage.style.setProperty('--cv-ray', RARITY_COLOR[c.rarity]);
  if (look.rays) stage.append(layer('cv-rays'));
  stage.append(card);
  const box = document.createElement('div');
  box.className = 'cv';
  box.append(stage, text);
  return box;
}
