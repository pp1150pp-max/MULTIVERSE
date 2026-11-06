// Windows can be moved by dragging their title bar (owner). Positions are not remembered: a window
// goes back to its stylesheet position when it closes, and a double-click on the title bar puts it back too.
// A moved window gets inline left/top in px, which beat the stylesheet's own placement (centering
// transforms, right-anchoring, the bag's spot beside an open shop).

function clamp(el: HTMLElement): void {
  if (!el.dataset.moved) return;
  const parent = (el.offsetParent as HTMLElement | null) ?? document.body;
  const pr = parent.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const maxX = pr.width - w;
  const maxY = pr.height - h;
  // Fits: stay fully inside. Bigger than the screen: slide between its two edges so every part can be reached.
  const x = Math.min(Math.max(parseFloat(el.style.left) || 0, Math.min(0, maxX)), Math.max(0, maxX));
  const y = Math.min(Math.max(parseFloat(el.style.top) || 0, Math.min(0, maxY)), Math.max(0, maxY));
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
}

function reset(el: HTMLElement): void {
  if (!el.dataset.moved) return;
  delete el.dataset.moved;
  for (const p of ['left', 'top', 'right', 'bottom', 'transform']) el.style.removeProperty(p);
}

/** Make `win` draggable by `handle` (its title bar). Buttons, inputs and selects inside the handle still click. */
export function makeDraggable(win: HTMLElement, handle: HTMLElement): void {
  handle.classList.add('drag-handle');
  let drag: { id: number; x: number; y: number; dx: number; dy: number } | null = null;

  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, select, textarea')) return;
    e.preventDefault(); // no text selection while dragging
    const r = win.getBoundingClientRect();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top };
    try {
      handle.setPointerCapture(e.pointerId); // keep following the pointer even off the bar
    } catch {
      /* pointer already gone */
    }
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const pr = ((win.offsetParent as HTMLElement | null) ?? document.body).getBoundingClientRect();
    if (!win.dataset.moved) {
      // A click (or a double-click) without moving leaves the window alone.
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 3) return;
      // Switch to plain left/top from where it is now.
      win.dataset.moved = '1';
      win.style.right = 'auto';
      win.style.bottom = 'auto';
      win.style.transform = 'none';
    }
    win.style.left = `${e.clientX - drag.dx - pr.left}px`;
    win.style.top = `${e.clientY - drag.dy - pr.top}px`;
    clamp(win);
  });
  const end = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('dblclick', (e) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea')) return;
    reset(win);
  });

  // Closed → back to the default spot next time (also when closed and reopened within one tick).
  const hidden = /(^|\s)hidden(\s|$)/;
  new MutationObserver((records) => {
    if (win.classList.contains('hidden') || records.some((r) => hidden.test(r.oldValue ?? ''))) reset(win);
  }).observe(win, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  // The window's own size can change (the bag's stat column hides beside a shop, the forge list grows).
  new ResizeObserver(() => clamp(win)).observe(win);
}

/** Every game window that opens and closes: drag by its title bar. */
export function initDraggableWindows(root: HTMLElement): void {
  const wins: HTMLElement[] = [];
  for (const win of root.querySelectorAll<HTMLElement>('.panel')) {
    if (win.id === 'confirm') continue; // owner: the confirm box stays where it is
    const handle = win.querySelector<HTMLElement>(':scope > .panel-head, :scope .inv-title');
    if (!handle) continue;
    makeDraggable(win, handle);
    wins.push(win);
  }
  // The screen got smaller: pull moved windows back inside. #hud covers the whole screen.
  const refit = (): void => wins.forEach(clamp);
  new ResizeObserver(refit).observe(root);
  window.addEventListener('resize', refit);
}
