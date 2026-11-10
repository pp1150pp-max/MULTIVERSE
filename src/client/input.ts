const isTyping = (e: Event) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
};

export class Input {
  private readonly keys = new Set<string>();
  private readonly pressedSet = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  lmb = false;
  rmb = false;
  rmbPressed = false;
  /** Left button went down this frame (a click), not just held. */
  lmbPressed = false;
  wheel = 0;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (!e.repeat) this.pressedSet.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.lmb = this.rmb = false;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.lmb = true;
        this.lmbPressed = true;
      }
      if (e.button === 2) {
        this.rmb = true;
        this.rmbPressed = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.lmb = false;
      if (e.button === 2) this.rmb = false;
    });
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    // No browser right-click menu anywhere in the game, except in text fields (copy/paste).
    window.addEventListener('contextmenu', (e) => {
      if (!(e.target as HTMLElement | null)?.closest?.('input, textarea')) e.preventDefault();
    });
    // Block the usual DevTools / view-source shortcuts. shortcut: only deters casual use; the browser menu still opens them.
    window.addEventListener('keydown', (e) => {
      const k = e.key.toUpperCase();
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && 'IJC'.includes(k) && k.length === 1) || (e.ctrlKey && k === 'U')) e.preventDefault();
    }, true);
    canvas.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  pressed(code: string): boolean {
    return this.pressedSet.has(code);
  }

  endFrame(): void {
    this.pressedSet.clear();
    this.rmbPressed = false;
    this.lmbPressed = false;
    this.wheel = 0;
  }
}
