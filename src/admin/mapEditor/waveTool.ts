// 🌀 "จุดเกิดระลอก": where the monsters of minigame "รอดมอนเป็นระลอก" come out (MapData.waveSpots, src/shared/waveGame.ts).
// Click empty ground = a new spot there; drag its middle = move; drag the blue dot = radius; Delete = remove. Each is one undo step.
// Only maps made with "＋ แมพใหม่" have it (the page hides the tool elsewhere); the spots do something once the map's settings pick the minigame.
import type { MapData } from '../../shared/mapSchema';
import type { EdPointer, Editor, Layer, Tool } from './editor';
import { pick, type MapPatch } from './history';
import { gridSnap, keyOf } from './pointTools';
import { btn, el, note, numField } from './ui';

type Spot = NonNullable<MapData['waveSpots']>[number];
const COLOR = '#ff9a3a';
const R_MIN = 0.5, R_MAX = 30, R_NEW = 4;
const spotsOf = (m: MapData): Spot[] => m.waveSpots ?? [];

export function waveSpotTool(): Tool {
  let drag: { i: number; mode: 'move' | 'radius'; start: [number, number]; before: MapPatch; moved: boolean } | null = null;
  const selIdx = (ed: Editor): number => { const v = keyOf(ed, 'wave'); return v === null ? -1 : Number(v); };
  const handle = (ed: Editor, s: Spot): [number, number] => ed.toScreen(s.x + s.radius, s.z);
  const hit = (ed: Editor, e: EdPointer): { i: number; part: 'move' | 'radius' } | null => {
    const sel = selIdx(ed);
    const ss = spotsOf(ed.map)[sel];
    if (ss) {
      const [hx, hy] = handle(ed, ss);
      if (Math.hypot(e.px - hx, e.py - hy) <= 11) return { i: sel, part: 'radius' };
    }
    const list = spotsOf(ed.map);
    for (let i = list.length - 1; i >= 0; i--) if (Math.hypot(e.x - list[i].x, e.z - list[i].z) <= Math.max(list[i].radius, 0.8)) return { i, part: 'move' };
    return null;
  };
  return {
    id: 'wavespot',
    label: 'จุดเกิดระลอก (มินิเกม)',
    icon: '🌀',
    hint: 'มินิเกมรอดมอนเป็นระลอก: มอนแต่ละระลอกโผล่ในวงเหล่านี้ (วนทีละวง) · คลิกพื้นว่าง = เพิ่มจุด · ลากกลางวง = ย้าย · ลากจุดฟ้า = รัศมี · Delete ลบ · ไม่มีจุดเลย = มอนโผล่รอบจุดเริ่ม · ใช้ได้เมื่อตั้งค่าแมพเลือกมินิเกมนี้',
    activate(ed) { ed.select([]); },
    pointerDown(ed, e) {
      const h = hit(ed, e);
      if (!h) {
        const [x, z] = gridSnap(ed, e.x, e.z, e.alt);
        const list = spotsOf(ed.map);
        if (list.length >= 30) return;
        ed.exec('เพิ่มจุดเกิดระลอก', { waveSpots: [...list, { x, z, radius: R_NEW }] });
        ed.select([`wave:${list.length}`]);
        return;
      }
      ed.select([`wave:${h.i}`]);
      drag = { i: h.i, mode: h.part, start: [e.x, e.z], before: pick(ed.map, ['waveSpots']), moved: false };
    },
    pointerMove(ed, e) {
      const d = drag;
      if (!d) return;
      const base = (d.before as { waveSpots?: Spot[] }).waveSpots ?? [];
      const s0 = base[d.i];
      if (!s0) return;
      let s = s0;
      if (d.mode === 'move') {
        const dx = e.x - d.start[0], dz = e.z - d.start[1];
        if (!d.moved && Math.hypot(dx, dz) * ed.view.scale < 4) return;
        const [x, z] = gridSnap(ed, s0.x + dx, s0.z + dz, e.alt);
        s = { ...s0, x, z };
      } else s = { ...s0, radius: Math.max(R_MIN, Math.min(R_MAX, Math.round(Math.hypot(e.x - s0.x, e.z - s0.z) * 2) / 2)) };
      d.moved = true;
      ed.live({ waveSpots: base.map((q, k) => (k === d.i ? s : q)) });
    },
    pointerUp(ed) {
      const d = drag;
      drag = null;
      if (d?.moved) ed.commitLive(d.mode === 'move' ? 'ย้ายจุดเกิดระลอก' : 'ปรับรัศมีจุดเกิดระลอก', d.before);
    },
    key(ed, e) {
      const i = selIdx(ed);
      if (i < 0) return false;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        ed.exec('ลบจุดเกิดระลอก', { waveSpots: spotsOf(ed.map).filter((_, k) => k !== i) });
        ed.select([]);
        return true;
      }
      if (e.key === 'Escape') { ed.select([]); return true; }
      return false;
    },
    drawOverlay(ed, g) {
      const s = spotsOf(ed.map)[selIdx(ed)];
      if (!s) return;
      const pts: [number, number][] = Array.from({ length: 40 }, (_, i) => [s.x + Math.cos((i / 40) * Math.PI * 2) * s.radius, s.z + Math.sin((i / 40) * Math.PI * 2) * s.radius]);
      g.strokeStyle = '#ffd24a'; g.lineWidth = 2; g.setLineDash([6, 3]);
      ed.path(g, pts); g.stroke(); g.setLineDash([]);
      const [hx, hy] = handle(ed, s);
      g.fillStyle = '#6cf'; g.strokeStyle = '#024';
      g.beginPath(); g.arc(hx, hy, 6, 0, Math.PI * 2); g.fill(); g.stroke();
    },
    cursor(ed, e) { const h = hit(ed, e); return h ? (h.part === 'move' ? 'move' : 'ew-resize') : 'copy'; },
    inspector(ed) {
      const i = selIdx(ed);
      const s = spotsOf(ed.map)[i];
      const box = el('div', { class: 'me-inspector' });
      if (!s) {
        box.append(note(`จุดเกิดระลอก ${spotsOf(ed.map).length} จุด · คลิกพื้นว่างเพื่อเพิ่ม คลิกวงเพื่อเลือก`));
        return box;
      }
      const set = (label: string, fn: (q: Spot) => Spot): void => ed.exec(label, { waveSpots: spotsOf(ed.map).map((q, k) => (k === i ? fn(q) : q)) });
      box.append(
        el('div', { class: 'me-title' }, `จุดเกิดระลอก ${i + 1}`),
        el('div', { class: 'me-grid2' },
          numField('x', s.x, (n) => set('ย้ายจุดเกิดระลอก', (q) => ({ ...q, x: n })), 0.5),
          numField('z', s.z, (n) => set('ย้ายจุดเกิดระลอก', (q) => ({ ...q, z: n })), 0.5),
          numField('รัศมี', s.radius, (n) => set('ปรับรัศมีจุดเกิดระลอก', (q) => ({ ...q, radius: Math.max(R_MIN, Math.min(R_MAX, n)) })), 0.5, R_MIN, R_MAX)),
        btn('🗑 ลบจุดนี้ (Delete)', () => { ed.exec('ลบจุดเกิดระลอก', { waveSpots: spotsOf(ed.map).filter((_, k) => k !== i) }); ed.select([]); }),
      );
      return box;
    },
  };
}

/** The wave spots on the canvas, always (orange dashed rings with their number), on maps that have them. */
export const waveSpotLayer: Layer = {
  id: 'waveSpots', label: 'จุดเกิดระลอก (มินิเกม)', order: 32,
  draw(ed, g) {
    spotsOf(ed.map).forEach((s, i) => {
      const pts: [number, number][] = Array.from({ length: 32 }, (_, k) => [s.x + Math.cos((k / 32) * Math.PI * 2) * s.radius, s.z + Math.sin((k / 32) * Math.PI * 2) * s.radius]);
      ed.path(g, pts);
      g.fillStyle = 'rgba(255,154,58,0.12)'; g.fill();
      g.strokeStyle = COLOR; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]);
      const [px, py] = ed.toScreen(s.x, s.z);
      g.fillStyle = COLOR; g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.fillText(`🌀${i + 1}`, px + 7, py + 4);
    });
  },
};
