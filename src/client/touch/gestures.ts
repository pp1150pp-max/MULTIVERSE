// Fingers on the game itself (the canvas) in touch play (mobile plan 3.2):
//   - a finger landing on the left part of the screen brings up a floating joystick there; dragging walks
//   - a quick tap (anywhere) is Game.tapAt: lock on to a monster, walk to and use a drop / NPC / rest spot,
//     open another player's menu, or walk to open ground
//   - two fingers pinch to zoom the camera (the mouse wheel on PC)
// Mouse input on the canvas is left alone: Input.ts handles it as before.
import type { Game } from '../Game';

/** A tap: the finger lifted within this long… */
const TAP_MS = 350;
/** …and moved less than this many px. */
const TAP_SLOP = 12;
/** Joystick dead zone, as a share of the knob's travel. */
const DEAD_ZONE = 0.15;

interface Finger { x0: number; y0: number; x: number; y: number; t: number; moved: boolean; pinched: boolean }

export class TouchGestures {
  private readonly fingers = new Map<number, Finger>();
  private stickId: number | null = null;
  private pinch: { a: number; b: number; d0: number; zoom0: number } | null = null;

  constructor(private readonly g: Game, canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', (e) => this.down(e, canvas), { passive: false });
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e, true));
    canvas.addEventListener('pointercancel', (e) => this.up(e, false));
    g.input.releaseHooks.push(() => this.reset());
  }

  /** The joystick comes up for a finger landing here: the left 40% (landscape), or the lower-left (portrait). */
  private inStickZone(x: number, y: number): boolean {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return h > w ? x < w * 0.5 && y > h * 0.4 : x < w * 0.4;
  }

  private down(e: PointerEvent, canvas: HTMLCanvasElement): void {
    if (e.pointerType === 'mouse') return;
    // No mouse events copied from this touch (they would attack on PC paths) and no browser gestures.
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    const f: Finger = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, pinched: false };
    this.fingers.set(e.pointerId, f);
    // A second finger while walking with the joystick is a tap (lock on, talk…). A second finger while the
    // first one is still (a joystick not yet moved, or a finger resting on the game) starts a pinch zoom.
    const stick = this.stickId === null ? null : this.fingers.get(this.stickId);
    if (this.fingers.size === 2 && !(stick && stick.moved)) {
      this.endStick();
      const [[ia, a], [ib, b]] = [...this.fingers];
      a.pinched = b.pinched = true;
      this.pinch = { a: ia, b: ib, d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom0: this.g.zoom };
      return;
    }
    if (this.fingers.size === 1 && this.inStickZone(f.x, f.y)) {
      this.stickId = e.pointerId;
      this.g.touch.showStick(f.x, f.y);
    }
  }

  private move(e: PointerEvent): void {
    const f = this.fingers.get(e.pointerId);
    if (!f) return;
    f.x = e.clientX;
    f.y = e.clientY;
    if (Math.hypot(f.x - f.x0, f.y - f.y0) > TAP_SLOP) f.moved = true;
    const a = this.pinch && this.fingers.get(this.pinch.a);
    const b = this.pinch && this.fingers.get(this.pinch.b);
    if (this.pinch && a && b) {
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      // Fingers apart = closer in (a smaller view), like zooming a map.
      this.g.zoom = this.pinch.zoom0 * (this.pinch.d0 / d);
      return;
    }
    if (e.pointerId !== this.stickId) return;
    const r = this.g.touch.stickRadius;
    let dx = f.x - f.x0;
    let dy = f.y - f.y0;
    const len = Math.hypot(dx, dy);
    if (len > r) {
      dx *= r / len;
      dy *= r / len;
    }
    this.g.touch.moveKnob(dx, dy);
    // Screen y grows downward; the stick's y is "up".
    this.g.input.stick = len > r * DEAD_ZONE ? { x: dx / r, y: -dy / r } : null;
  }

  private up(e: PointerEvent, lifted: boolean): void {
    const f = this.fingers.get(e.pointerId);
    if (!f) return;
    this.fingers.delete(e.pointerId);
    if (e.pointerId === this.stickId) this.endStick();
    if (this.pinch && (e.pointerId === this.pinch.a || e.pointerId === this.pinch.b)) this.pinch = null;
    if (lifted && !f.moved && !f.pinched && performance.now() - f.t < TAP_MS) this.g.tapAt(f.x, f.y);
  }

  private endStick(): void {
    if (this.stickId === null) return;
    this.stickId = null;
    this.g.input.stick = null;
    this.g.touch.hideStick();
  }

  private reset(): void {
    this.fingers.clear();
    this.pinch = null;
    this.stickId = null;
    // Input.releaseAll already cleared the stick; the controls hide the joystick themselves.
  }
}
