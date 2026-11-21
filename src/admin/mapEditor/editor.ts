// The map editor's core (docs/plans/map-editor.md section 2): one canvas in the game's isometric view, a document (the map),
// a selection, an undo stack, and two small registries a new feature plugs into WITHOUT touching this file:
//   Tool   what the mouse and keys do while it is picked (select/move and place now; PR 7 adds NPC, door, spawn, polygon, path, lake)
//   Layer  something drawn on the canvas, in `order` (ground, grid, props, collision, ...)
// A selection is a set of string keys: a prop's own id, and for the things PR 7 adds `<kind>:<id>` (they have no ids of their own).
import { camToGround, depthOf, groundToCam, spriteAnchorY } from '../../shared/isoProjection';
import type { MapData, MapProp } from '../../shared/mapSchema';
import { solidOutline, transformProps } from './geom';
import { History, pick, samePatch, type Command, type MapPatch } from './history';
import { catalogEntry, opaqueAt, spriteOf } from './sprites';

export interface View { cx: number; cz: number; scale: number }
export interface EditorOptions {
  /** Snap to the grid (and to neighbours' edges). Holding Alt turns it off for the moment. */
  snap: boolean;
  grid: 0.5 | 1 | 2;
  edges: boolean;
  showSolid: boolean;
  showGrid: boolean;
  /** Draw the ground with the game's tiles (groundArt.ts); off = plain colours. */
  realGround: boolean;
}
export interface EdPointer { px: number; py: number; x: number; z: number; shift: boolean; alt: boolean; ctrl: boolean; button: number }

export interface Tool {
  id: string;
  label: string;
  icon: string;
  /** One or two lines shown under the tool list (what it does, what to know). */
  hint: string;
  activate?(ed: Editor): void;
  deactivate?(ed: Editor): void;
  pointerDown?(ed: Editor, e: EdPointer): void;
  pointerMove?(ed: Editor, e: EdPointer): void;
  pointerUp?(ed: Editor, e: EdPointer): void;
  /** Return true when the key was used. */
  key?(ed: Editor, e: KeyboardEvent): boolean;
  drawOverlay?(ed: Editor, g: CanvasRenderingContext2D): void;
  /** The properties box while this tool is picked (a new tool shows its own fields here: a door's target, a spawn's monster). Return null for the default prop box. */
  inspector?(ed: Editor): HTMLElement | null;
  cursor?(ed: Editor, e: EdPointer): string | undefined;
}
export interface Layer {
  id: string;
  label: string;
  order: number;
  /** Layers that hold pieces you can pick (the lock toggle only shows on these). */
  pickable?: boolean;
  draw(ed: Editor, g: CanvasRenderingContext2D): void;
}

/** A prop as drawn in the last frame (canvas pixels), kept for picking. */
export interface Drawn { p: MapProp; px: number; py: number; wpx: number; hpx: number; anchor: number }

export class Editor {
  map: MapData;
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  readonly history: History;
  selection = new Set<string>();
  view: View = { cx: 0, cz: 0, scale: 10 };
  opts: EditorOptions = { snap: true, grid: 1, edges: true, showSolid: true, showGrid: true, realGround: true };
  readonly tools: Tool[] = [];
  readonly layers: Layer[] = [];
  layerState: Record<string, { visible: boolean; locked: boolean }> = {};
  tool!: Tool;
  /** The piece that follows the mouse before it is dropped (the palette drag, the place tool). */
  ghost: { key: string; x: number; z: number } | null = null;
  /** Called after the document changed (autosave listens), after the selection changed, the tool changed, the history changed. */
  onChange: () => void = () => undefined;
  onSelect: () => void = () => undefined;
  onTool: () => void = () => undefined;
  onHistory: () => void = () => undefined;
  private drawn: Drawn[] = [];
  /** The picking list is out of date (something changed since it was made). */
  private stale = true;
  private raf = 0;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private pan: { px: number; py: number; cx: number; cz: number } | null = null;
  private spaceDown = false;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, map: MapData) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d')!;
    this.map = map;
    this.history = new History((patch) => {
      Object.assign(this.map, patch);
      this.dropMissing();
      this.changed();
    });
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  // ------------------------------------------------------------------ registries

  addTool(t: Tool): void {
    this.tools.push(t);
    if (!this.tool) this.tool = t;
  }
  addLayer(l: Layer): void {
    this.layers.push(l);
    this.layers.sort((a, b) => a.order - b.order);
    this.layerState[l.id] ??= { visible: true, locked: false };
  }
  setTool(id: string): void {
    const t = this.tools.find((x) => x.id === id);
    if (!t || t === this.tool) return;
    this.tool.deactivate?.(this);
    this.tool = t;
    t.activate?.(this);
    this.onTool();
    this.requestDraw();
  }

  // ------------------------------------------------------------------ the document

  setMap(map: MapData): void {
    this.map = map;
    this.selection.clear();
    this.history.clear();
    this.ghost = null;
    this.fit();
    this.onSelect();
    this.onHistory();
    this.requestDraw();
  }
  /** Marks the document as changed: autosave, the panels, a redraw. */
  changed(): void {
    this.onChange();
    this.onHistory();
    this.requestDraw();
  }
  /** Runs `patch` as ONE undoable step. */
  exec(label: string, patch: MapPatch): void {
    const keys = Object.keys(patch) as (keyof MapData)[];
    const before = pick(this.map, keys);
    if (samePatch(before, patch)) return;
    this.history.exec({ label, before, after: patch });
  }
  /** Applies a patch for drawing only (a drag in progress). Pair with `commitLive`. */
  live(patch: MapPatch): void {
    Object.assign(this.map, patch);
    this.requestDraw();
  }
  /** Ends a live edit: records it as one step, from `before` (taken with `pick` when the drag began). */
  commitLive(label: string, before: MapPatch): void {
    const keys = Object.keys(before) as (keyof MapData)[];
    const after = pick(this.map, keys);
    if (samePatch(before, after)) { this.requestDraw(); return; }
    const cmd: Command = { label, before, after };
    this.history.record(cmd);
    this.changed();
  }
  cancelLive(before: MapPatch): void {
    Object.assign(this.map, before);
    this.requestDraw();
  }
  undo(): void { this.history.undo(); }
  redo(): void { this.history.redo(); }
  private dropMissing(): void {
    const ids = new Set(this.map.props.map((p) => p.id));
    let lost = false;
    for (const s of [...this.selection]) if (!s.includes(':') && !ids.has(s)) { this.selection.delete(s); lost = true; }
    if (lost) this.onSelect();
  }

  /** Applies `fn` to every selected prop as one undoable step (moves loose colliders with their piece, see geom.followersOf). */
  editSelected(label: string, fn: (p: MapProp) => MapProp): void {
    if (!this.selection.size) return;
    const { props, colliders } = transformProps(this.map, this.selection, fn);
    this.exec(label, colliders === this.map.colliders ? { props } : { props, colliders });
  }
  selectedProps(): MapProp[] {
    return this.map.props.filter((p) => this.selection.has(p.id));
  }
  select(ids: Iterable<string>): void {
    this.selection = new Set(ids);
    this.onSelect();
    this.requestDraw();
  }
  isLocked(layer: string): boolean { return !!this.layerState[layer]?.locked; }

  // ------------------------------------------------------------------ view

  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.requestDraw();
  }
  get width(): number { return this.w; }
  get height(): number { return this.h; }
  /** World ground point → canvas pixels (y = height above the ground in world units). */
  toScreen(x: number, z: number, y = 0): [number, number] {
    const [sx, sy] = groundToCam(x, z, y);
    const [cx, cy] = groundToCam(this.view.cx, this.view.cz);
    return [this.w / 2 + (sx - cx) * this.view.scale, this.h / 2 - (sy - cy) * this.view.scale];
  }
  /** Canvas pixels → the ground point there. */
  toWorld(px: number, py: number): [number, number] {
    const [cx, cy] = groundToCam(this.view.cx, this.view.cz);
    return camToGround(cx + (px - this.w / 2) / this.view.scale, cy - (py - this.h / 2) / this.view.scale);
  }
  /** Shows the whole map. */
  fit(): void {
    const half = this.map.zone.half;
    const pts = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([x, z]) => groundToCam(x, z));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys) + 8;
    this.view = { cx: 0, cz: 0, scale: Math.max(2, Math.min(this.w / bw, this.h / bh) * 0.95) };
    this.requestDraw();
  }
  centerOn(x: number, z: number): void {
    this.view.cx = x;
    this.view.cz = z;
    this.requestDraw();
  }
  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const [wx, wz] = this.toWorld(px, py);
    this.view.scale = Math.min(120, Math.max(2, this.view.scale * Math.exp(-e.deltaY * 0.0015)));
    // Keep the point under the mouse where it was.
    const [nx, nz] = this.toWorld(px, py);
    this.view.cx += wx - nx;
    this.view.cz += wz - nz;
    this.requestDraw();
  }

  // ------------------------------------------------------------------ pointer and keys

  private pointer(e: PointerEvent): EdPointer {
    return this.pointerAt(e.clientX, e.clientY, e);
  }
  /** The pointer at a client point (also used for drops from the palette). */
  pointerAt(clientX: number, clientY: number, e?: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean; button?: number }): EdPointer {
    const r = this.canvas.getBoundingClientRect();
    const px = clientX - r.left, py = clientY - r.top;
    const [x, z] = this.toWorld(px, py);
    return { px, py, x, z, shift: !!e?.shiftKey, alt: !!e?.altKey, ctrl: !!(e?.ctrlKey || e?.metaKey), button: e?.button ?? 0 };
  }
  private down(e: PointerEvent): void {
    this.canvas.focus({ preventScroll: true });
    const p = this.pointer(e);
    if (e.button === 1 || e.button === 2 || (e.button === 0 && this.spaceDown)) {
      this.pan = { px: p.px, py: p.py, cx: this.view.cx, cz: this.view.cz };
      this.capture(e);
      return;
    }
    if (e.button !== 0) return;
    this.capture(e);
    this.tool.pointerDown?.(this, p);
  }
  /** Keeps the drag going when the mouse leaves the canvas (not every pointer can be captured, e.g. synthetic ones). */
  private capture(e: PointerEvent): void {
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* fine without */ }
  }
  private move(e: PointerEvent): void {
    const p = this.pointer(e);
    if (this.pan) {
      // Drag the ground with the mouse: the world point under the start stays under the mouse.
      const [sx, sy] = groundToCam(this.pan.cx, this.pan.cz);
      const [nx, nz] = camToGround(sx - (p.px - this.pan.px) / this.view.scale, sy + (p.py - this.pan.py) / this.view.scale);
      this.view.cx = nx;
      this.view.cz = nz;
      this.requestDraw();
      return;
    }
    this.tool.pointerMove?.(this, p);
    this.canvas.style.cursor = this.spaceDown ? 'grab' : this.tool.cursor?.(this, p) ?? '';
  }
  private up(e: PointerEvent): void {
    if (this.pan) { this.pan = null; return; }
    this.tool.pointerUp?.(this, this.pointer(e));
  }
  /** Keys (the page forwards them while the editor is on screen). Returns true when used. */
  key(e: KeyboardEvent): boolean {
    if (e.key === ' ') { this.spaceDown = e.type === 'keydown'; return true; }
    if (e.type !== 'keydown') return false;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (e.key === 'z' || e.key === 'Z')) { if (e.shiftKey) this.redo(); else this.undo(); return true; }
    if (ctrl && (e.key === 'y' || e.key === 'Y')) { this.redo(); return true; }
    return this.tool.key?.(this, e) ?? false;
  }

  // ------------------------------------------------------------------ picking

  /** The topmost piece whose visible pixels (or foot) are under the canvas point; none when the props layer is hidden or locked. */
  pickProp(px: number, py: number): MapProp | null {
    this.refreshDrawn();
    const st = this.layerState.props;
    if (!st || st.locked || !st.visible) return null;
    for (let i = this.drawn.length - 1; i >= 0; i--) {
      const d = this.drawn[i];
      const dx = px - d.px, dy = py - d.py;
      if (Math.hypot(dx, dy) < 9) return d.p;
      const a = (d.p.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      let lx = dx * c + dy * s;
      const ly = -dx * s + dy * c;
      if (d.p.flip) lx = -lx;
      const u = (lx + d.wpx / 2) / d.wpx, v = (ly + (1 - d.anchor) * d.hpx) / d.hpx;
      const sp = spriteOf(d.p.key, () => this.requestDraw());
      if (sp ? opaqueAt(sp, u, v) : u >= 0 && u < 1 && v >= 0 && v < 1) return d.p;
    }
    return null;
  }
  /** The pieces drawn in the last frame, farthest first. */
  drawnProps(): readonly Drawn[] { this.refreshDrawn(); return this.drawn; }
  /** Screen geometry of a prop (pixels), as it is drawn now. */
  propBox(p: MapProp): Drawn {
    const e = catalogEntry(p.key);
    const sp = spriteOf(p.key, () => this.requestDraw());
    const aspect = sp ? sp.w / sp.h : e?.size ? e.size[0] / e.size[1] : 1;
    const hpx = p.h * this.view.scale;
    const [px, py] = this.toScreen(p.x, p.z);
    return { p, px, py, wpx: hpx * aspect, hpx, anchor: spriteAnchorY(p.key) };
  }

  // ------------------------------------------------------------------ drawing

  requestDraw(): void {
    this.stale = true;
    if (this.raf || this.disposed) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); });
  }
  dispose(): void {
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
  }
  private draw(): void {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#1b1d22';
    g.fillRect(0, 0, this.w, this.h);
    this.refreshDrawn(true);
    for (const l of this.layers) {
      if (this.layerState[l.id]?.visible === false) continue;
      g.save();
      l.draw(this, g);
      g.restore();
    }
    g.save();
    this.tool.drawOverlay?.(this, g);
    g.restore();
  }

  /** Sorts the props nearest-the-camera-last (the game draws them in the same order) and works out where each stands on the canvas. */
  private refreshDrawn(force = false): void {
    if (!force && !this.stale) return;
    this.stale = false;
    const sorted = [...this.map.props].sort((a, b) => depthOf(a.x, a.z) - depthOf(b.x, b.z) || (a.id < b.id ? -1 : 1));
    this.drawn = sorted.map((p) => this.propBox(p));
  }

  /** A path through world ground points, in canvas pixels. */
  path(g: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], close = true): void {
    g.beginPath();
    pts.forEach(([x, z], i) => {
      const [px, py] = this.toScreen(x, z);
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    });
    if (close) g.closePath();
  }
  /** The outline of a prop's solid (world points), or null. */
  outlineOf(p: MapProp): [number, number][] | null { return solidOutline(p); }
}
