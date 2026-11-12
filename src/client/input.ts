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
  /** The on-screen joystick (touch): screen direction, x right and y up, length 0..1. Null when not held. */
  stick: { x: number; y: number } | null = null;
  /** Touch drag-to-aim: the ground point a skill or attack button is aimed at (wins over the locked target). Null when not aiming. */
  aimOverride: { x: number; z: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (!e.repeat) this.pressedSet.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
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

  /** On-screen buttons (touch): hold a key down like the keyboard does… */
  press(code: string): void {
    if (!this.keys.has(code)) this.pressedSet.add(code);
    this.keys.add(code);
  }

  /** …and let it go. */
  release(code: string): void {
    this.keys.delete(code);
  }

  /** A key pressed and let go in one go (one frame's press), e.g. dash or a potion. */
  tap(code: string): void {
    this.pressedSet.add(code);
  }

  /** Lets go of everything held (switching apps, typing): no character left walking or attacking on its own. */
  releaseAll(): void {
    this.keys.clear();
    this.lmb = this.rmb = false;
    this.stick = null;
    this.aimOverride = null;
    for (const fn of this.releaseHooks) fn();
  }

  /** Called by releaseAll, so the on-screen controls can reset too. */
  readonly releaseHooks: (() => void)[] = [];

  endFrame(): void {
    this.pressedSet.clear();
    this.rmbPressed = false;
    this.lmbPressed = false;
    this.wheel = 0;
  }
}
