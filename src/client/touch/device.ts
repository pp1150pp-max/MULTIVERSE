// Which kind of pointer the player is using right now, so the game can show on-screen touch controls
// only to people playing by touch (mobile plan, section 4). The user agent isn't used: iPadOS Safari
// says it's a Mac. Instead the mode follows what the player actually does, so an iPad with a keyboard
// or mouse, or a laptop with a touch screen, switches back and forth by itself:
//   - a finger or pen touching the screen → 'touch'
//   - the mouse pressed, moved a few times in a row, or a game key pressed on a keyboard → 'mouse'
// While in touch mode <body> has the class `touch-ui`; CSS and the touch controls key off that.
// Also blocks the browser's own pinch zoom on the page (Safari ignores user-scalable=no).

export type PointerMode = 'mouse' | 'touch';

/** Mouse moves in a row (with no touch in between) before switching to mouse mode, so the odd stray
 *  mouse event on a touch device doesn't make the on-screen controls flicker. */
const MOUSE_MOVES_TO_SWITCH = 3;

/** Keys that mean "playing with a keyboard": walking, skills, dash, potions. */
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyQ', 'KeyE', 'KeyR', 'Space', 'Digit1', 'Digit2',
]);

const listeners = new Set<(mode: PointerMode) => void>();

function startsAsTouch(): boolean {
  const canTouch = matchMedia('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  return canTouch && !matchMedia('(pointer: fine)').matches;
}

let mode: PointerMode = startsAsTouch() ? 'touch' : 'mouse';
let mouseMoves = 0;

function apply(): void {
  document.body.classList.toggle('touch-ui', mode === 'touch');
}

function setMode(next: PointerMode): void {
  if (next === mode) return;
  mode = next;
  apply();
  for (const fn of listeners) fn(mode);
}

/** The current mode. */
export function pointerMode(): PointerMode {
  return mode;
}

/** True while the on-screen touch controls should show. */
export function isTouchMode(): boolean {
  return mode === 'touch';
}

/** Calls `fn` every time the mode changes. Returns a function that stops it. */
export function onPointerModeChange(fn: (mode: PointerMode) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el?.closest?.('input, textarea, [contenteditable="true"]');
}

apply();

// Held upright in touch play: ask to turn the phone (CSS shows it only then; touch play is landscape only).
const rotate = document.createElement('div');
rotate.id = 'rotate-hint';
rotate.innerHTML = '<div class="rotate-icon">📱</div><div>หมุนจอเป็นแนวนอนเพื่อเล่น</div>';
document.body.append(rotate);
// While typing, an on-screen keyboard can make the screen look upright: the hint waits.
document.addEventListener('focusin', (e) => {
  if (isTyping(e.target)) document.body.classList.add('typing');
});
document.addEventListener('focusout', () => document.body.classList.remove('typing'));

window.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') {
    setMode('mouse');
  } else {
    mouseMoves = 0;
    setMode('touch');
  }
}, true);

window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') {
    mouseMoves = 0;
    return;
  }
  if (mode === 'touch' && ++mouseMoves >= MOUSE_MOVES_TO_SWITCH) setMode('mouse');
}, true);

window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.has(e.code) && !isTyping(e.target)) setMode('mouse');
}, true);

// Safari's own pinch zoom (it ignores user-scalable=no in the viewport tag).
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
// Two-finger moves on the game canvas never zoom or scroll the page (pinch there is the game's own zoom).
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1 && (e.target as HTMLElement | null)?.tagName === 'CANVAS') e.preventDefault();
}, { passive: false });
