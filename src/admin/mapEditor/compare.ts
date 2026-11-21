// "เทียบ revision" on the canvas: what differs between layout A and layout B (diffMapItems), drawn over the map on screen.
// Added = green, removed = red, moved/changed = yellow with a line from where it was to where it is. Read-only: it never
// touches the draft; the canvas underneath still shows the draft.
import type { DiffItem, DiffKind } from '../../shared/mapDiff';
import type { MapProp, Pt } from '../../shared/mapSchema';
import type { Editor, Layer } from './editor';
import { solidOutline } from './geom';
import { drawPiece } from './layers';
import { catalogEntry, spriteOf } from './sprites';

export interface CompareState { labelA: string; labelB: string; items: DiffItem[]; /** The item clicked in the list (drawn highlighted). */ focus: number }

export const DIFF_COLOR: Record<DiffKind, string> = { added: '#46d16a', removed: '#ff5a5a', moved: '#ffd24a', changed: '#ffd24a' };
export const DIFF_WORD: Record<DiffKind, string> = { added: 'เพิ่ม', removed: 'ลบ', moved: 'ย้าย', changed: 'แก้' };

/** The overlay layer and its state (null = not comparing). */
export function compareOverlay(): { layer: Layer; get(): CompareState | null; set(ed: Editor, s: CompareState | null): void } {
  let state: CompareState | null = null;
  const layer: Layer = {
    id: 'compare', label: 'เทียบ revision', order: 55,
    draw(ed, g) {
      if (!state) return;
      // Dim the map a little so the colours stand out.
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(0, 0, ed.width, ed.height);
      state.items.forEach((it, i) => drawItem(ed, g, it, i === state!.focus));
    },
  };
  return {
    layer,
    get: () => state,
    set(ed, s) { state = s; ed.requestDraw(); },
  };
}

function shapeOf(v: unknown): { pts?: Pt[]; closed: boolean; r?: number; prop?: MapProp } {
  const e = v as Record<string, unknown> | undefined;
  if (!e) return { closed: false };
  if (Array.isArray(e.pts)) return { pts: e.pts as Pt[], closed: !('w' in e) };
  if (typeof e.key === 'string') return { prop: e as unknown as MapProp, closed: true };
  if (typeof e.rx === 'number') return { closed: true, r: Math.max(e.rx as number, e.rz as number) };
  if (typeof e.radius === 'number') return { closed: true, r: e.radius as number };
  if (typeof e.r === 'number') return { closed: true, r: e.r as number };
  return { closed: true };
}

function drawShape(ed: Editor, g: CanvasRenderingContext2D, v: unknown, at: Pt | undefined, color: string, ghost: boolean, bold: boolean): void {
  const s = shapeOf(v);
  g.strokeStyle = color;
  g.lineWidth = bold ? 3.5 : 2;
  if (s.pts) {
    ed.path(g, s.pts, s.closed);
    g.stroke();
    return;
  }
  if (!at) return;
  if (s.prop && ghost) {
    // The piece's own picture, see-through: the draft on screen may not hold it (removed), or hold it elsewhere.
    const e = catalogEntry(s.prop.key);
    const sp = spriteOf(s.prop.key, () => ed.requestDraw());
    const aspect = sp ? sp.w / sp.h : e?.size ? e.size[0] / e.size[1] : 1;
    const hpx = s.prop.h * ed.view.scale;
    const [px, py] = ed.toScreen(at[0], at[1]);
    drawPiece(ed, g, s.prop.key, px, py, hpx * aspect, hpx, 0.03, s.prop.rot, s.prop.flip, 0.45);
  }
  const outline = s.prop ? solidOutline({ ...s.prop, x: at[0], z: at[1] }) : null;
  if (outline) { ed.path(g, outline); g.stroke(); }
  const [px, py] = ed.toScreen(at[0], at[1]);
  const rpx = Math.max(bold ? 11 : 7, (s.r ?? 0) * ed.view.scale * 0.7);
  g.beginPath(); g.arc(px, py, rpx, 0, Math.PI * 2); g.stroke();
}

function drawItem(ed: Editor, g: CanvasRenderingContext2D, it: DiffItem, bold: boolean): void {
  const c = DIFF_COLOR[it.kind];
  g.save();
  if (it.kind === 'removed') drawShape(ed, g, it.before, it.from, c, true, bold);
  else if (it.kind === 'added') drawShape(ed, g, it.after, it.to, c, false, bold);
  else {
    // Where it was (dashed, faint picture), where it is (solid), and the line between.
    g.setLineDash([4, 4]);
    drawShape(ed, g, it.before, it.from, c, it.kind === 'moved', false);
    g.setLineDash([]);
    drawShape(ed, g, it.after, it.to, c, false, bold);
    if (it.kind === 'moved' && it.from && it.to) {
      const [ax, ay] = ed.toScreen(it.from[0], it.from[1]);
      const [bx, by] = ed.toScreen(it.to[0], it.to[1]);
      g.strokeStyle = c; g.lineWidth = bold ? 3 : 1.5;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      // An arrow head at the new place.
      const a = Math.atan2(by - ay, bx - ax);
      g.fillStyle = c;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - 9 * Math.cos(a - 0.4), by - 9 * Math.sin(a - 0.4)); g.lineTo(bx - 9 * Math.cos(a + 0.4), by - 9 * Math.sin(a + 0.4)); g.closePath(); g.fill();
    }
  }
  const at = it.to ?? it.from;
  if (at) {
    const [px, py] = ed.toScreen(at[0], at[1]);
    g.fillStyle = c;
    g.beginPath(); g.arc(px, py, bold ? 5 : 3, 0, Math.PI * 2); g.fill();
    if (bold) { g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.fillText(`${DIFF_WORD[it.kind]}: ${it.label}`, px + 12, py - 8); }
  }
  g.restore();
}
