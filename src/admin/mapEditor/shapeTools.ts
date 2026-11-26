// PR 7 tools that edit shapes: blocker polygons (red, closed), walking paths (open lines) and ice lakes / lava pools (ellipses).
// All changes go through the PR 6 command stack (ed.exec, or live + commitLive while dragging).
import type { MapData, Pt } from '../../shared/mapSchema';
import { pointInPolygon } from '../../shared/mapSchema';
import type { EdPointer, Editor, Tool } from './editor';
import { centroid, nearestSegment, nextId, rotatePts } from './geom';
import { pick, type MapPatch } from './history';
import { gridSnap, keyOf } from './pointTools';
import { btn, el, note, numField, selectField } from './ui';

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const VERTEX_PX = 9;
const EDGE_PX = 7;

interface Shape { id: string; pts: Pt[] }
interface Kind {
  /** Selection key prefix. */
  prefix: 'blocker' | 'path';
  list: 'blockers' | 'paths';
  closed: boolean;
  /** Fewest points the schema accepts. */
  min: number;
  name: string;
}
const BLOCKER: Kind = { prefix: 'blocker', list: 'blockers', closed: true, min: 3, name: 'ขอบเขต' };
const PATH: Kind = { prefix: 'path', list: 'paths', closed: false, min: 2, name: 'ทางเดิน' };

type Drag =
  | { mode: 'vertex'; i: number; before: MapPatch; moved: boolean; label: string }
  | { mode: 'move'; start: [number, number]; before: MapPatch; moved: boolean };

/** One tool for a list of polylines (blockers are closed polygons, paths are open lines). */
function polylineTool(k: Kind): Tool {
  let drag: Drag | null = null;
  let vSel: number | null = null;
  /** New shape being drawn: the points clicked so far. */
  let draft: Pt[] | null = null;
  let cursorPt: Pt | null = null;

  const shapes = (ed: Editor): Shape[] => ed.map[k.list] as Shape[];
  const selId = (ed: Editor): string | null => keyOf(ed, k.prefix);
  const selShape = (ed: Editor): Shape | null => { const id = selId(ed); return shapes(ed).find((s) => s.id === id) ?? null; };
  const withPts = (ed: Editor, id: string, pts: Pt[], base: Shape[] = shapes(ed)): MapPatch => ({ [k.list]: base.map((s) => (s.id === id ? { ...s, pts } : s)) } as MapPatch);
  const listBefore = (ed: Editor): MapPatch => pick(ed.map, [k.list]);
  const baseOf = (b: MapPatch): Shape[] => (b as Record<string, Shape[]>)[k.list];
  const pointNear = (ed: Editor, p: Pt, px: number, py: number, r: number): boolean => { const [sx, sy] = ed.toScreen(p[0], p[1]); return Math.hypot(px - sx, py - sy) <= r; };

  const finishDraft = (ed: Editor): void => {
    const pts = draft;
    draft = null;
    if (!pts || pts.length < k.min) { ed.requestDraw(); ed.onSelect(); return; }
    const id = nextId(k.prefix === 'blocker' ? 'b' : 'path', shapes(ed).map((s) => s.id));
    const shape = k.closed ? { id, pts } : { id, w: 3, pts };
    ed.exec(`วาด${k.name}`, { [k.list]: [...shapes(ed), shape] } as MapPatch);
    ed.select([`${k.prefix}:${id}`]);
  };
  const removeSelected = (ed: Editor): void => {
    const s = selShape(ed);
    if (!s) return;
    if (vSel !== null && s.pts.length > k.min) {
      ed.exec('ลบจุด', withPts(ed, s.id, s.pts.filter((_, i) => i !== vSel)));
      vSel = null;
      ed.onSelect();
      return;
    }
    ed.exec(`ลบ${k.name}`, { [k.list]: shapes(ed).filter((x) => x.id !== s.id) } as MapPatch);
    vSel = null;
    ed.select([]);
  };
  const startDraft = (ed: Editor): void => { draft = []; vSel = null; ed.select([]); ed.onSelect(); };

  const pickShape = (ed: Editor, e: EdPointer): Shape | null => {
    const list = shapes(ed);
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (k.closed) { if (pointInPolygon(s.pts, e.x, e.z)) return s; continue; }
      const seg = nearestSegment(s.pts, false, e.x, e.z);
      const w = (s as Shape & { w?: number }).w ?? 3;
      if (seg && seg.d * ed.view.scale <= Math.max(EDGE_PX + 2, (w * ed.view.scale) / 2)) return s;
    }
    return null;
  };

  return {
    id: k.prefix,
    label: k.closed ? 'ขอบเขต (polygon)' : 'ทางเดิน',
    icon: k.closed ? '⛔' : '🛤️',
    hint: k.closed
      ? 'กด "＋ วาดใหม่" ด้านขวา แล้วคลิกจุดต่อกัน คลิกจุดแรก/Enter/ดับเบิลคลิก = ปิด polygon · คลิกก้อนเพื่อเลือก ลากก้อน = ย้ายทั้งก้อน · ลากจุดมุมสี่เหลี่ยม = แก้ · คลิกขอบ = เพิ่มจุด · เลือกจุดแล้ว Delete = ลบจุด (ถ้าไม่เลือกจุด = ลบทั้งก้อน) · หมุนด้วยแถบเลื่อนด้านขวา · ในเกม คนเดินเข้าข้างในไม่ได้'
      : 'กด "＋ วาดใหม่" ด้านขวา แล้วคลิกจุดต่อกัน ดับเบิลคลิก/Enter = จบเส้น · คลิกเส้นเพื่อเลือก ลากเส้น = ย้ายทั้งเส้น · ลากจุดมุมสี่เหลี่ยม = แก้ · คลิกบนเส้นที่เลือก = เพิ่มจุด · เลือกจุดแล้ว Delete = ลบจุด · ปรับความกว้างด้านขวา (ทางเดินเป็นภาพพื้นเท่านั้น ไม่กั้นการเดิน)',
    activate(ed) { draft = null; vSel = null; ed.select([]); },
    deactivate() { draft = null; vSel = null; drag = null; },
    pointerDown(ed, e) {
      if (draft) {
        const [x, z] = gridSnap(ed, e.x, e.z, e.alt);
        // Clicking the first point (closed) or the last point again closes / ends the shape.
        if (draft.length >= k.min && k.closed && pointNear(ed, draft[0], e.px, e.py, VERTEX_PX + 2)) { finishDraft(ed); return; }
        if (draft.length >= 1 && pointNear(ed, draft[draft.length - 1], e.px, e.py, VERTEX_PX)) { if (draft.length >= k.min) finishDraft(ed); return; }
        draft.push([x, z]);
        ed.requestDraw();
        return;
      }
      if (ed.isLocked('blockers') && k.closed) return;
      const s = selShape(ed);
      if (s) {
        const vi = s.pts.findIndex((p) => pointNear(ed, p, e.px, e.py, VERTEX_PX));
        if (vi >= 0) {
          vSel = vi;
          ed.onSelect();
          drag = { mode: 'vertex', i: vi, before: listBefore(ed), moved: false, label: 'ลากจุด' };
          return;
        }
        const seg = nearestSegment(s.pts, k.closed, e.x, e.z);
        if (seg && seg.d * ed.view.scale <= EDGE_PX) {
          const before = listBefore(ed);
          const pts = [...s.pts];
          pts.splice(seg.i + 1, 0, [round3(seg.pt[0]), round3(seg.pt[1])]);
          ed.live(withPts(ed, s.id, pts));
          vSel = seg.i + 1;
          ed.onSelect();
          drag = { mode: 'vertex', i: seg.i + 1, before, moved: true, label: 'เพิ่มจุด' };
          return;
        }
      }
      const hit = pickShape(ed, e);
      if (!hit) { vSel = null; ed.select([]); return; }
      vSel = null;
      ed.select([`${k.prefix}:${hit.id}`]);
      drag = { mode: 'move', start: [e.x, e.z], before: listBefore(ed), moved: false };
    },
    pointerMove(ed, e) {
      cursorPt = [e.x, e.z];
      if (draft) { ed.requestDraw(); return; }
      if (!drag) return;
      const base = baseOf(drag.before);
      const id = selId(ed);
      const s0 = base.find((s) => s.id === id);
      if (!s0) return;
      if (drag.mode === 'vertex') {
        const [x, z] = gridSnap(ed, e.x, e.z, e.alt);
        const pts = s0.pts.map((p, i) => (i === (drag as { i: number }).i ? ([x, z] as Pt) : p));
        drag.moved = true;
        ed.live(withPts(ed, s0.id, pts, base));
      } else {
        const dx = e.x - drag.start[0], dz = e.z - drag.start[1];
        if (!drag.moved && Math.hypot(dx, dz) * ed.view.scale < 4) return;
        drag.moved = true;
        const [sx, sz] = ed.opts.snap && !e.alt ? [Math.round(dx / ed.opts.grid) * ed.opts.grid, Math.round(dz / ed.opts.grid) * ed.opts.grid] : [dx, dz];
        ed.live(withPts(ed, s0.id, s0.pts.map(([x, z]) => [round3(x + sx), round3(z + sz)] as Pt), base));
      }
    },
    pointerUp(ed) {
      const d = drag;
      drag = null;
      if (d?.moved) ed.commitLive(d.mode === 'vertex' ? d.label : `ย้าย${k.name}`, d.before);
    },
    key(ed, e) {
      if (draft) {
        if (e.key === 'Enter') { finishDraft(ed); return true; }
        if (e.key === 'Escape') { draft = null; ed.requestDraw(); ed.onSelect(); return true; }
        if (e.key === 'Backspace') { draft.pop(); ed.requestDraw(); return true; }
        return false;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selShape(ed)) { removeSelected(ed); return true; } return false; }
      if (e.key === 'Escape') { vSel = null; ed.select([]); return true; }
      return false;
    },
    drawOverlay(ed, g) {
      const handle = (p: Pt, on: boolean): void => {
        const [px, py] = ed.toScreen(p[0], p[1]);
        g.fillStyle = on ? '#ffd24a' : '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1;
        g.fillRect(px - 4, py - 4, 8, 8); g.strokeRect(px - 4, py - 4, 8, 8);
      };
      const s = selShape(ed);
      if (s) {
        g.strokeStyle = '#ffd24a'; g.lineWidth = 2; g.setLineDash([6, 3]);
        ed.path(g, s.pts, k.closed); g.stroke();
        g.setLineDash([]);
        s.pts.forEach((p, i) => handle(p, i === vSel));
      }
      if (draft) {
        g.strokeStyle = '#ffd24a'; g.lineWidth = 2;
        const pts = cursorPt ? [...draft, cursorPt] : draft;
        if (pts.length > 1) { ed.path(g, pts, false); g.stroke(); }
        draft.forEach((p, i) => handle(p, i === 0));
      }
    },
    cursor: (ed, e) => (draft ? 'crosshair' : selShape(ed)?.pts.some((p) => pointNear(ed, p, e.px, e.py, VERTEX_PX)) ? 'move' : pickShape(ed, e) ? 'pointer' : undefined),
    inspector(ed) {
      const s = selShape(ed);
      const box = el('div', { class: 'me-inspector' });
      const draw = btn('＋ วาดใหม่', () => startDraft(ed), 'คลิกจุดบนแมพต่อกันเป็นรูปใหม่');
      if (draft) {
        box.append(el('div', { class: 'me-title' }, `กำลังวาด${k.name}ใหม่ · ${draft.length} จุด`),
          note(k.closed ? `ต้องมีอย่างน้อย ${k.min} จุด คลิกจุดแรกหรือกด Enter เพื่อปิด · Backspace ลบจุดล่าสุด · Esc ยกเลิก` : 'ดับเบิลคลิกจุดสุดท้าย หรือกด Enter เพื่อจบ · Backspace ลบจุดล่าสุด · Esc ยกเลิก'),
          btn('✔ เสร็จ (Enter)', () => finishDraft(ed)), btn('✖ ยกเลิก (Esc)', () => { draft = null; ed.requestDraw(); ed.onSelect(); }));
        return box;
      }
      if (!s) { box.append(note(`ยังไม่ได้เลือก${k.name} คลิกบนแมพ หรือกดวาดใหม่`), draw); return box; }
      box.append(el('div', { class: 'me-title' }, `${k.name} ${s.id} · ${s.pts.length} จุด`));
      if (!k.closed) {
        const w = (s as Shape & { w?: number }).w ?? 3;
        box.append(numField('ความกว้าง (0.5–30)', w, (n) => ed.exec('แก้ความกว้างทาง', { paths: ed.map.paths.map((p) => (p.id === s.id ? { ...p, w: Math.max(0.5, Math.min(30, n)) } : p)) }), 0.1, 0.5, 30));
      } else {
        // Turning is relative: the slider turns the shape about its middle from where it was when the drag began; one drag = one undo step.
        let before: MapPatch | null = null;
        let about: Pt = [0, 0];
        const label = el('div', { class: 'muted' }, 'หมุน: 0°');
        const rot = el('input', { type: 'range', min: -180, max: 180, step: 1, value: 0,
          oninput: () => {
            if (!before) { before = listBefore(ed); about = centroid(s.pts); }
            const deg = Number(rot.value);
            label.textContent = `หมุน: ${deg}°`;
            const base = baseOf(before);
            const src = base.find((x) => x.id === s.id);
            if (src) ed.live(withPts(ed, s.id, rotatePts(src.pts, about, deg), base));
          },
          onchange: () => { if (before) { ed.commitLive('หมุนขอบเขต', before); before = null; } } });
        box.append(el('label', {}, 'หมุนทั้งก้อน (องศา, หมุนรอบกลางก้อน)', rot), label);
      }
      box.append(
        ...(vSel !== null && s.pts.length > k.min ? [btn('✂ ลบจุดที่เลือก (Delete)', () => removeSelected(ed))] : []),
        btn(`🗑 ลบทั้ง${k.name}`, () => { vSel = null; ed.exec(`ลบ${k.name}`, { [k.list]: shapes(ed).filter((x) => x.id !== s.id) } as MapPatch); ed.select([]); }),
        draw, note('เลือกจุดมุมด้วยการคลิกสี่เหลี่ยม แล้วกด Delete = ลบจุดนั้น · คลิกขอบ = เพิ่มจุด'));
      return box;
    },
  };
}

export const blockerTool = (): Tool => polylineTool(BLOCKER);
export const pathTool = (): Tool => polylineTool(PATH);

// ---------------------------------------------------------------- lakes

const LAKE_KIND: [string, string][] = [['ice', 'ทะเลสาบน้ำแข็ง'], ['lava', 'สระลาวา'], ['whirlpool', 'น้ำวน (เดินเข้าไม่ได้ ใช้แค่ rx)']];

export function lakeTool(): Tool {
  let drag: { i: number; mode: 'move' | 'rx' | 'rz'; start: [number, number]; before: MapPatch; moved: boolean } | null = null;
  const selIdx = (ed: Editor): number => { const v = keyOf(ed, 'water'); return v === null ? -1 : Number(v); };
  const setLake = (ed: Editor, i: number, label: string, fn: (w: MapData['water'][number]) => MapData['water'][number]): void =>
    ed.exec(label, { water: ed.map.water.map((w, k) => (k === i ? fn(w) : w)) });
  const handles = (ed: Editor, w: MapData['water'][number]): { rx: [number, number]; rz: [number, number] } => ({ rx: ed.toScreen(w.x + w.rx, w.z), rz: ed.toScreen(w.x, w.z + w.rz) });
  const hit = (ed: Editor, e: EdPointer): { i: number; part: 'move' | 'rx' | 'rz' } | null => {
    const sel = selIdx(ed);
    const sw = ed.map.water[sel];
    if (sw) {
      const h = handles(ed, sw);
      if (Math.hypot(e.px - h.rx[0], e.py - h.rx[1]) <= VERTEX_PX + 2) return { i: sel, part: 'rx' };
      if (Math.hypot(e.px - h.rz[0], e.py - h.rz[1]) <= VERTEX_PX + 2) return { i: sel, part: 'rz' };
    }
    for (let i = ed.map.water.length - 1; i >= 0; i--) {
      const w = ed.map.water[i];
      if (((e.x - w.x) / w.rx) ** 2 + ((e.z - w.z) / w.rz) ** 2 <= 1) return { i, part: 'move' };
    }
    return null;
  };
  const add = (ed: Editor, kind: 'ice' | 'lava'): void => {
    const [x, z] = gridSnap(ed, ed.view.cx, ed.view.cz, false);
    ed.exec('เพิ่มทะเลสาบ', { water: [...ed.map.water, { kind, x, z, rx: 6, rz: 5 }] });
    ed.select([`water:${ed.map.water.length - 1}`]);
  };
  return {
    id: 'lake',
    label: 'ทะเลสาบ / ลาวา',
    icon: '🌊',
    hint: 'คลิกวงรีเพื่อเลือก ลากกลางวง = ย้าย ลากจุดฟ้าซ้าย-ขวา = ปรับรัศมีแกน x, จุดฟ้าล่าง = รัศมีแกน z · เพิ่มใหม่ด้วยปุ่มด้านขวา (วางกลางจอ) · Delete ลบ · ทะเลสาบน้ำแข็ง/ลาวาเป็นภาพพื้น (ลาวาทำดาเมจตามค่าเกมเดิม)',
    activate(ed) { ed.select([]); },
    pointerDown(ed, e) {
      const h = hit(ed, e);
      if (!h) { ed.select([]); return; }
      ed.select([`water:${h.i}`]);
      drag = { i: h.i, mode: h.part, start: [e.x, e.z], before: pick(ed.map, ['water']), moved: false };
    },
    pointerMove(ed, e) {
      const d = drag;
      if (!d) return;
      const base = (d.before as { water: MapData['water'] }).water;
      const w0 = base[d.i];
      if (!w0) return;
      let w = w0;
      if (d.mode === 'move') {
        const dx = e.x - d.start[0], dz = e.z - d.start[1];
        if (!d.moved && Math.hypot(dx, dz) * ed.view.scale < 4) return;
        const [x, z] = gridSnap(ed, w0.x + dx, w0.z + dz, e.alt);
        w = { ...w0, x, z };
      } else if (d.mode === 'rx') w = { ...w0, rx: Math.max(0.5, Math.min(200, Math.round(Math.abs(e.x - w0.x) * 2) / 2)) };
      else w = { ...w0, rz: Math.max(0.5, Math.min(200, Math.round(Math.abs(e.z - w0.z) * 2) / 2)) };
      d.moved = true;
      ed.live({ water: base.map((q, k) => (k === d.i ? w : q)) });
    },
    pointerUp(ed) {
      const d = drag;
      drag = null;
      if (d?.moved) ed.commitLive(d.mode === 'move' ? 'ย้ายทะเลสาบ' : 'ปรับขนาดทะเลสาบ', d.before);
    },
    key(ed, e) {
      const i = selIdx(ed);
      if (i < 0) return false;
      if (e.key === 'Delete' || e.key === 'Backspace') { ed.exec('ลบทะเลสาบ', { water: ed.map.water.filter((_, k) => k !== i) }); ed.select([]); return true; }
      if (e.key === 'Escape') { ed.select([]); return true; }
      return false;
    },
    drawOverlay(ed, g) {
      const w = ed.map.water[selIdx(ed)];
      if (!w) return;
      const pts: Pt[] = Array.from({ length: 48 }, (_, i) => [w.x + Math.cos((i / 48) * Math.PI * 2) * w.rx, w.z + Math.sin((i / 48) * Math.PI * 2) * w.rz]);
      g.strokeStyle = '#ffd24a'; g.lineWidth = 2; g.setLineDash([6, 3]);
      ed.path(g, pts); g.stroke(); g.setLineDash([]);
      const h = handles(ed, w);
      g.fillStyle = '#6cf'; g.strokeStyle = '#024';
      for (const [px, py] of [h.rx, h.rz]) { g.beginPath(); g.arc(px, py, 6, 0, Math.PI * 2); g.fill(); g.stroke(); }
    },
    cursor(ed, e) { const h = hit(ed, e); return h ? (h.part === 'move' ? 'move' : 'ew-resize') : undefined; },
    inspector(ed) {
      const i = selIdx(ed);
      const w = ed.map.water[i];
      const box = el('div', { class: 'me-inspector' });
      const adds = el('div', { class: 'row' }, btn('＋ น้ำแข็ง', () => add(ed, 'ice')), btn('＋ ลาวา', () => add(ed, 'lava')));
      if (!w) { box.append(note('ยังไม่ได้เลือก คลิกวงรีบนแมพ หรือเพิ่มใหม่'), adds); return box; }
      box.append(
        el('div', { class: 'me-title' }, `${w.kind === 'ice' ? 'ทะเลสาบน้ำแข็ง' : w.kind === 'whirlpool' ? 'น้ำวน (เดินเข้าไม่ได้)' : 'สระลาวา'} ที่ ${i + 1}`),
        selectField('ชนิด', w.kind, LAKE_KIND, (v) => setLake(ed, i, 'แก้ชนิดทะเลสาบ', (q) => ({ ...q, kind: v === 'lava' ? 'lava' : v === 'whirlpool' ? 'whirlpool' : 'ice' }))),
        el('div', { class: 'me-grid2' },
          numField('x', w.x, (n) => setLake(ed, i, 'ย้ายทะเลสาบ', (q) => ({ ...q, x: round3(n) })), 0.5),
          numField('z', w.z, (n) => setLake(ed, i, 'ย้ายทะเลสาบ', (q) => ({ ...q, z: round3(n) })), 0.5),
          numField('รัศมี x', w.rx, (n) => setLake(ed, i, 'ปรับขนาดทะเลสาบ', (q) => ({ ...q, rx: Math.max(0.5, Math.min(200, n)) })), 0.5, 0.5, 200),
          numField('รัศมี z', w.rz, (n) => setLake(ed, i, 'ปรับขนาดทะเลสาบ', (q) => ({ ...q, rz: Math.max(0.5, Math.min(200, n)) })), 0.5, 0.5, 200)),
        // A whirlpool's island (owner 2026-11-26): dry ground in its middle, reached only by a warp circle (pins tool). 0 = none.
        ...(w.kind === 'whirlpool' ? [numField('รัศมีเกาะกลาง (0 = ไม่มีเกาะ · ไปถึงได้ด้วยวงวาร์ปเท่านั้น)', w.island ?? 0, (n) => setLake(ed, i, 'ปรับเกาะกลางน้ำวน', (q) => {
          const { island: _old, ...rest } = q;
          const r = Math.round(Math.max(0, Math.min(q.rx - 1, n)) * 2) / 2;
          return r >= 1 ? { ...rest, island: r } : rest;
        }), 0.5, 0, 200)] : []),
        btn('🗑 ลบอันนี้ (Delete)', () => { ed.exec('ลบทะเลสาบ', { water: ed.map.water.filter((_, k) => k !== i) }); ed.select([]); }),
        adds);
      return box;
    },
  };
}
