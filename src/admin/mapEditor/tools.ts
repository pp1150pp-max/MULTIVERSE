// The two tools of the basic editor: select/move/rotate and place. A new tool (PR 7: NPC, door, spawn, polygon, path, lake)
// is one more object of the `Tool` interface (editor.ts) added with `ed.addTool`, nothing else changes.
import type { MapData, MapProp, Pt } from '../../shared/mapSchema';
import type { EdPointer, Editor, Tool } from './editor';
import { followersOf, halfExtent, moveFollower, nextPropId, normDeg, snapPoint, transformProps } from './geom';
import { pick } from './history';
import { catalogEntry } from './sprites';

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const DRAG_PX = 4;
const HANDLE_GAP = 26;
const HANDLE_R = 9;

/** The piece's own half-size (for snapping edge to edge). */
const extOf = (p: MapProp): [number, number] => halfExtent(p);

/** Where a piece lands after the snap switches (Alt = off for the moment). */
export function snapFor(ed: Editor, moving: ReadonlySet<string>, x: number, z: number, ext: [number, number], alt: boolean, base: Pick<MapData, 'props'> = ed.map): Pt {
  if (!ed.opts.snap || alt) return [round3(x), round3(z)];
  return snapPoint(base as MapData, moving, x, z, ext, { grid: ed.opts.grid, edges: ed.opts.edges });
}

/** A new prop from the catalog's defaults for `key`. */
export function newProp(map: MapData, key: string, x: number, z: number): MapProp {
  const e = catalogEntry(key);
  const h = e?.h ?? 2;
  const solid = e?.solid && e.solid.r > 0 ? { r: e.solid.r } : undefined;
  return { id: nextPropId(map), key, x, z, h, rot: 0, flip: false, fade: !solid && h >= 1.6, ...(solid ? { solid } : {}) };
}

/** Drops `key` at the world point (snapped). Returns the new piece's id. */
export function placePiece(ed: Editor, key: string, x: number, z: number, alt = false): string {
  const e = catalogEntry(key);
  const ext: [number, number] = e?.solid && e.solid.r > 0 ? [e.solid.r, e.solid.r] : [0.4, 0.4];
  const [sx, sz] = snapFor(ed, new Set(), x, z, ext, alt);
  const p = newProp(ed.map, key, sx, sz);
  ed.exec('วาง', { props: [...ed.map.props, p] });
  ed.select([p.id]);
  return p.id;
}

/** Removes the selected pieces (and the loose colliders that belong to them). */
export function deleteSelected(ed: Editor): void {
  const sel = ed.selection;
  if (![...sel].some((s) => !s.includes(':'))) return;
  const gone = new Set<number>();
  for (const p of ed.map.props) if (sel.has(p.id)) followersOf(ed.map, p).forEach((i) => gone.add(i));
  const patch: Partial<MapData> = { props: ed.map.props.filter((p) => !sel.has(p.id)) };
  if (gone.size && ed.map.colliders) patch.colliders = ed.map.colliders.filter((_, i) => !gone.has(i));
  ed.exec('ลบ', patch);
  ed.select([]);
}

/** Copies the selected pieces one grid step down-right and selects the copies. */
export function duplicateSelected(ed: Editor): void {
  const src = ed.selectedProps();
  if (!src.length) return;
  const step = ed.opts.grid;
  let next = ed.map.props.length;
  const used = new Set(ed.map.props.map((p) => p.id));
  const copies: MapProp[] = [];
  const extra = [];
  for (const p of src) {
    let id = `p${++next}`;
    while (used.has(id)) id = `p${++next}`;
    used.add(id);
    copies.push({ ...p, id, x: round3(p.x + step), z: round3(p.z + step), ...(p.solid ? { solid: { ...p.solid } } : {}) });
    for (const i of followersOf(ed.map, p)) extra.push(moveFollower(ed.map.colliders![i], [p.x, p.z], step, step, 0));
  }
  const patch: Partial<MapData> = { props: [...ed.map.props, ...copies] };
  if (extra.length) patch.colliders = [...(ed.map.colliders ?? []), ...extra];
  ed.exec('ทำสำเนา', patch);
  ed.select(copies.map((c) => c.id));
}

type Drag =
  | { mode: 'move'; start: [number, number]; startPx: [number, number]; primary: MapProp; before: Partial<MapData>; moved: boolean; ids: Set<string> }
  | { mode: 'rotate'; p: MapProp; before: Partial<MapData> }
  | { mode: 'box'; from: [number, number]; to: [number, number]; add: boolean }
  | { mode: 'click'; id: string };

/** Where the rotate handle of the only selected piece sits on the canvas. */
function handleOf(ed: Editor): { p: MapProp; x: number; y: number } | null {
  const sel = ed.selectedProps();
  if (sel.length !== 1 || ed.isLocked('props')) return null;
  const d = ed.propBox(sel[0]);
  const a = (sel[0].rot * Math.PI) / 180;
  const L = d.hpx * (1 - d.anchor) + HANDLE_GAP;
  return { p: sel[0], x: d.px + L * Math.sin(a), y: d.py - L * Math.cos(a) };
}

export function selectTool(): Tool {
  let drag: Drag | null = null;
  return {
    id: 'select',
    label: 'เลือก / ย้าย',
    icon: '🖱️',
    hint: 'คลิกเลือก · Shift คลิก = เลือกเพิ่ม · ลากชิ้น = ย้าย · ลากพื้นว่าง = กรอบเลือกหลายชิ้น · ลากจุดฟ้าเหนือชิ้น = หมุน (Shift = ทีละ 15°) · Alt = ปิด snap · ล้อเมาส์ = ซูม · ลากด้วยปุ่มขวา/กลาง หรือ Space = เลื่อนมุมมอง · ลูกศร = ขยับทีละช่อง · Delete ลบ · Ctrl+D ทำสำเนา',
    pointerDown(ed, e) {
      const h = handleOf(ed);
      if (h && Math.hypot(e.px - h.x, e.py - h.y) <= HANDLE_R + 3) {
        drag = { mode: 'rotate', p: h.p, before: pick(ed.map, ['props', 'colliders']) };
        return;
      }
      const hit = ed.pickProp(e.px, e.py);
      if (!hit) {
        drag = { mode: 'box', from: [e.px, e.py], to: [e.px, e.py], add: e.shift };
        return;
      }
      if (e.shift) {
        const s = new Set(ed.selection);
        if (s.has(hit.id)) s.delete(hit.id); else s.add(hit.id);
        ed.select(s);
        drag = null;
        return;
      }
      const keepGroup = ed.selection.has(hit.id) && ed.selection.size > 1;
      if (!keepGroup) ed.select([hit.id]);
      drag = {
        mode: 'move', start: [e.x, e.z], startPx: [e.px, e.py], primary: hit, moved: false,
        before: pick(ed.map, ['props', 'colliders']), ids: new Set(ed.selection),
      };
    },
    pointerMove(ed, e) {
      if (!drag) return;
      if (drag.mode === 'box') {
        drag.to = [e.px, e.py];
        ed.requestDraw();
      } else if (drag.mode === 'rotate') {
        const d = ed.propBox(drag.p);
        let deg = (Math.atan2(e.px - d.px, -(e.py - d.py)) * 180) / Math.PI;
        if (e.shift) deg = Math.round(deg / 15) * 15;
        const rot = round3(normDeg(deg)) % 360;
        const base = drag.before as Pick<MapData, 'props' | 'colliders'>;
        const r = transformProps(base, new Set([drag.p.id]), (p) => ({ ...p, rot }));
        ed.live(r.colliders === base.colliders ? { props: r.props } : { props: r.props, colliders: r.colliders });
      } else if (drag.mode === 'move') {
        if (!drag.moved && Math.hypot(e.px - drag.startPx[0], e.py - drag.startPx[1]) < DRAG_PX) return;
        drag.moved = true;
        const mv = drag;
        const base = mv.before as Pick<MapData, 'props' | 'colliders'>;
        const p0 = base.props!.find((p) => p.id === mv.primary.id) ?? mv.primary;
        const [tx, ty] = snapFor(ed, drag.ids, p0.x + (e.x - drag.start[0]), p0.z + (e.z - drag.start[1]), extOf(p0), e.alt, { props: base.props! });
        const dx = tx - p0.x, dz = ty - p0.z;
        const r = transformProps(base, drag.ids, (p) => ({ ...p, x: round3(p.x + dx), z: round3(p.z + dz) }));
        ed.live(r.colliders === base.colliders ? { props: r.props } : { props: r.props, colliders: r.colliders });
      }
    },
    pointerUp(ed, e) {
      const d = drag;
      drag = null;
      if (!d) return;
      if (d.mode === 'box') {
        const [x0, x1] = [Math.min(d.from[0], d.to[0]), Math.max(d.from[0], d.to[0])];
        const [y0, y1] = [Math.min(d.from[1], d.to[1]), Math.max(d.from[1], d.to[1])];
        const ids = new Set(d.add ? ed.selection : []);
        if (x1 - x0 >= DRAG_PX || y1 - y0 >= DRAG_PX) {
          if (!ed.isLocked('props') && ed.layerState.props?.visible) {
            for (const q of ed.drawnProps()) {
              const cy = q.py - (q.hpx * (1 - q.anchor)) / 2;
              const foot = q.px >= x0 && q.px <= x1 && q.py >= y0 && q.py <= y1;
              const mid = q.px >= x0 && q.px <= x1 && cy >= y0 && cy <= y1;
              if (foot || mid) ids.add(q.p.id);
            }
          }
          ed.select(ids);
        } else if (!d.add) ed.select([]);
      } else if (d.mode === 'rotate') ed.commitLive('หมุน', d.before);
      else if (d.mode === 'move') {
        if (d.moved) ed.commitLive(d.ids.size > 1 ? `ย้าย ${d.ids.size} ชิ้น` : 'ย้าย', d.before);
        else if (!e.shift && d.ids.size > 1) ed.select([d.primary.id]); // a plain click on a group picks just that piece
      }
    },
    key(ed, e) {
      const k = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      if (k === 'Delete' || k === 'Backspace') { deleteSelected(ed); return true; }
      if (ctrl && (k === 'd' || k === 'D')) { duplicateSelected(ed); return true; }
      if (ctrl && (k === 'a' || k === 'A')) { ed.select(ed.map.props.map((p) => p.id)); return true; }
      if (k === 'Escape') { ed.select([]); return true; }
      // Arrows move along the screen's own up/down/left/right: one grid cell on both ground axes (a diagonal step on the ground).
      const dir: Record<string, [number, number]> = { ArrowUp: [-1, -1], ArrowDown: [1, 1], ArrowLeft: [-1, 1], ArrowRight: [1, -1] };
      if (dir[k]) {
        const s = ed.opts.grid;
        const [ax, az] = dir[k];
        ed.editSelected('ขยับ', (p) => ({ ...p, x: round3(p.x + ax * s), z: round3(p.z + az * s) }));
        return true;
      }
      return false;
    },
    drawOverlay(ed, g) {
      const h = handleOf(ed);
      if (h) {
        const d = ed.propBox(h.p);
        g.strokeStyle = '#6cf'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(d.px, d.py); g.lineTo(h.x, h.y); g.stroke();
        g.fillStyle = '#6cf';
        g.beginPath(); g.arc(h.x, h.y, HANDLE_R - 2, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#024'; g.stroke();
      }
      if (drag?.mode === 'box') {
        g.fillStyle = 'rgba(100,170,255,0.15)';
        g.strokeStyle = 'rgba(120,190,255,0.9)';
        g.lineWidth = 1;
        const x = Math.min(drag.from[0], drag.to[0]), y = Math.min(drag.from[1], drag.to[1]);
        g.fillRect(x, y, Math.abs(drag.to[0] - drag.from[0]), Math.abs(drag.to[1] - drag.from[1]));
        g.strokeRect(x, y, Math.abs(drag.to[0] - drag.from[0]), Math.abs(drag.to[1] - drag.from[1]));
      }
    },
    cursor(ed, e) {
      const h = handleOf(ed);
      if (h && Math.hypot(e.px - h.x, e.py - h.y) <= HANDLE_R + 3) return 'grab';
      return ed.pickProp(e.px, e.py) ? 'move' : undefined;
    },
    deactivate() { drag = null; },
  };
}

export interface PlaceTool extends Tool { brush: string | null }

export function placeTool(): PlaceTool {
  const t: PlaceTool = {
    brush: null,
    id: 'place',
    label: 'วางของ',
    icon: '➕',
    hint: 'เลือกภาพจากคลังด้านขวา แล้วคลิกบนแมพเพื่อวาง (วางต่อได้เรื่อยๆ) หรือลากภาพจากคลังมาปล่อยบนแมพ · Esc/คลิกขวา = เลิกวาง',
    activate(ed) { if (t.brush) ed.requestDraw(); },
    deactivate(ed) { ed.ghost = null; ed.requestDraw(); },
    pointerDown(ed, e) {
      if (!t.brush) { ed.setTool('select'); return; }
      placePiece(ed, t.brush, e.x, e.z, e.alt);
    },
    pointerMove(ed, e) {
      if (!t.brush) return;
      const en = catalogEntry(t.brush);
      const ext: [number, number] = en?.solid && en.solid.r > 0 ? [en.solid.r, en.solid.r] : [0.4, 0.4];
      const [x, z] = snapFor(ed, new Set(), e.x, e.z, ext, e.alt);
      ed.ghost = { key: t.brush, x, z };
      ed.requestDraw();
    },
    key(ed, e) {
      if (e.key === 'Escape') { t.brush = null; ed.ghost = null; ed.setTool('select'); return true; }
      return false;
    },
    cursor: () => 'copy',
  };
  return t;
}

/** Pointer helper for palette drops: the snapped world point under a client position. */
export function dropPoint(ed: Editor, clientX: number, clientY: number, alt: boolean): EdPointer {
  const p = ed.pointerAt(clientX, clientY);
  p.alt = alt;
  return p;
}
