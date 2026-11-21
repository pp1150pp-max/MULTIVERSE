// 🖌️ The scatter brush and eraser: paint random pieces of the picked kinds inside a circle, or rub pieces out. A whole stroke
// (press, drag, release) is ONE undo step. The settings are this editor's own (kept in this browser, not server-wide).
import type { Editor, Tool } from './editor';
import { pick } from './history';
import { eraseInCircle, idMaker, scatterStamp, type ScatterKind, type ScatterOpts } from './scatter';
import { catalogEntry, propUrl } from './sprites';
import { btn, el, note } from './ui';

const STORE = 'me.scatter';
/** Pieces per 100 square world units in one dab. */
const DENSITY: Record<string, [number, string]> = { low: [1.5, 'น้อย'], mid: [4, 'กลาง'], high: [9, 'มาก'] };
const R_MIN = 1, R_MAX = 25;

interface Settings extends Omit<ScatterOpts, 'density'> { mode: 'paint' | 'erase'; density: keyof typeof DENSITY | string; keys: string[]; eraseOnlyPicked: boolean }
const DEFAULTS: Settings = { mode: 'paint', radius: 4, density: 'mid', hMin: 0.85, hMax: 1.15, flip: true, rotate: false, avoidPaths: true, keys: [], eraseOnlyPicked: false };

function load(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Partial<Settings> | null;
    return s ? { ...DEFAULTS, ...s, keys: Array.isArray(s.keys) ? s.keys.filter((k) => typeof k === 'string') : [] } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

export interface BrushTool extends Tool {
  /** The kinds the brush lays (catalog keys). */
  readonly keys: ReadonlySet<string>;
  /** Adds or removes a kind (the palette's click while this tool is on). */
  toggle(key: string): void;
}

/** `refresh` rebuilds the properties box (after the palette changes the picked kinds). */
export function brushTool(refresh: () => void): BrushTool {
  const st = load();
  const keys = new Set(st.keys);
  const save = (): void => { st.keys = [...keys]; try { localStorage.setItem(STORE, JSON.stringify(st)); } catch { /* per-browser only */ } };
  let hover: [number, number] | null = null;
  let stroke: { before: ReturnType<typeof pick>; last: [number, number]; count: number; newId: () => string } | null = null;

  const kinds = (): ScatterKind[] => [...keys].map((k) => { const e = catalogEntry(k); return { key: k, h: e?.h ?? 2, r: e?.solid?.r ?? 0 }; });
  const opts = (): ScatterOpts => ({ radius: st.radius, density: DENSITY[st.density]?.[0] ?? 4, hMin: Math.min(st.hMin, st.hMax), hMax: Math.max(st.hMin, st.hMax), flip: st.flip, rotate: st.rotate, avoidPaths: st.avoidPaths });
  /** Nothing to do: the pieces' layer is locked/hidden, or no kinds are picked where kinds are needed. */
  const blocked = (ed: Editor): boolean => ed.isLocked('props') || ed.layerState.props?.visible === false
    || (!keys.size && (st.mode === 'paint' || st.eraseOnlyPicked));

  function dab(ed: Editor, x: number, z: number): void {
    if (!stroke) return;
    if (st.mode === 'erase') {
      const r = eraseInCircle(ed.map, x, z, st.radius, st.eraseOnlyPicked ? keys : null);
      if (!r.removed) return;
      stroke.count += r.removed;
      ed.live(r.colliders === ed.map.colliders ? { props: r.props } : { props: r.props, colliders: r.colliders });
    } else {
      const add = scatterStamp(ed.map, x, z, kinds(), opts(), Math.random, stroke.newId);
      if (!add.length) return;
      stroke.count += add.length;
      ed.live({ props: [...ed.map.props, ...add] });
    }
  }

  const t: BrushTool = {
    id: 'scatter',
    label: 'แปรงโปรย / ยางลบ',
    icon: '🖌️',
    hint: 'โปรย: เลือกภาพในคลังด้านขวา (คลิกได้หลายภาพ) แล้วคลิก/ลากบนแมพ ของจะสุ่มตำแหน่ง ขนาด กลับด้าน ในวง ไม่ทับของที่กั้นทาง NPC ประตู จุดเกิด ขอบเขต · ยางลบ: ลากลบของในวง · ลากหนึ่งครั้ง = ย้อนได้ในขั้นเดียว · [ ] ย่อ/ขยายวง · Esc เลิก',
    get keys() { return keys; },
    toggle(key) {
      if (keys.has(key)) keys.delete(key); else keys.add(key);
      save();
      refresh();
    },
    deactivate(ed) { hover = null; if (stroke) { ed.commitLive('โปรย', stroke.before); stroke = null; } ed.requestDraw(); },
    pointerDown(ed, e) {
      if (blocked(ed)) return;
      stroke = { before: pick(ed.map, ['props', 'colliders']), last: [e.x, e.z], count: 0, newId: idMaker(ed.map) };
      dab(ed, e.x, e.z);
    },
    pointerMove(ed, e) {
      hover = [e.x, e.z];
      if (stroke && Math.hypot(e.x - stroke.last[0], e.z - stroke.last[1]) >= (st.mode === 'erase' ? st.radius * 0.25 : st.radius * 0.5)) {
        stroke.last = [e.x, e.z];
        dab(ed, e.x, e.z);
      }
      ed.requestDraw();
    },
    pointerUp(ed) {
      const s = stroke;
      stroke = null;
      if (!s) return;
      ed.commitLive(st.mode === 'erase' ? `ยางลบ ${s.count} ชิ้น` : `โปรย ${s.count} ชิ้น`, s.before);
    },
    key(ed, e) {
      if (e.key === 'Escape') { ed.setTool('select'); return true; }
      if (e.key === '[' || e.key === ']') {
        st.radius = Math.max(R_MIN, Math.min(R_MAX, st.radius + (e.key === ']' ? 1 : -1)));
        save(); refresh(); ed.requestDraw();
        return true;
      }
      return false;
    },
    drawOverlay(ed, g) {
      if (!hover) return;
      const [x, z] = hover;
      const pts: [number, number][] = Array.from({ length: 48 }, (_, i) => [x + Math.cos((i / 48) * Math.PI * 2) * st.radius, z + Math.sin((i / 48) * Math.PI * 2) * st.radius]);
      ed.path(g, pts);
      const erase = st.mode === 'erase';
      g.fillStyle = erase ? 'rgba(255,80,80,0.12)' : 'rgba(80,220,120,0.10)';
      g.fill();
      g.strokeStyle = erase ? '#ff6a6a' : '#5fe08a';
      g.lineWidth = 1.5;
      g.setLineDash(blocked(ed) ? [4, 4] : []);
      g.stroke();
    },
    cursor: () => 'crosshair',
    inspector(ed) {
      const set = <K extends keyof Settings>(k: K, v: Settings[K]): void => { st[k] = v; save(); ed.requestDraw(); };
      const check = (label: string, k: 'flip' | 'rotate' | 'avoidPaths' | 'eraseOnlyPicked', title = ''): HTMLElement =>
        el('label', { title }, el('input', { type: 'checkbox', checked: st[k], onchange: (ev: Event) => set(k, (ev.target as HTMLInputElement).checked) }), ` ${label}`);
      const radNum = el('span', {}, `${st.radius}`);
      const radius = el('input', { type: 'range', min: R_MIN, max: R_MAX, step: 0.5, value: st.radius,
        oninput: () => { set('radius', Number(radius.value)); radNum.textContent = radius.value; } });
      const modeBtn = (m: Settings['mode'], text: string): HTMLButtonElement => {
        const b = btn(text, () => { set('mode', m); refresh(); });
        if (st.mode === m) b.className = 'on';
        return b;
      };
      const hNum = (k: 'hMin' | 'hMax'): HTMLInputElement => {
        const i = el('input', { type: 'number', step: 0.05, min: 0.2, max: 5, value: st[k] });
        i.addEventListener('change', () => { const n = Number(i.value); if (Number.isFinite(n) && n > 0) set(k, Math.min(5, Math.max(0.2, n))); });
        return i;
      };
      const picked = [...keys];
      return el('div', { class: 'me-inspector' },
        el('div', { class: 'row' }, modeBtn('paint', '🖌️ โปรย'), modeBtn('erase', '🧽 ยางลบ')),
        el('label', {}, 'รัศมีวง ', radNum, ' หน่วย', radius),
        st.mode === 'paint' ? el('div', {},
          el('label', {}, 'ความหนาแน่น ', el('select', { onchange: (ev: Event) => set('density', (ev.target as HTMLSelectElement).value) },
            ...Object.entries(DENSITY).map(([v, [, txt]]) => el('option', { value: v, selected: v === st.density }, txt)))),
          el('div', { class: 'me-grid2' }, el('label', {}, 'ขนาดสุ่ม ต่ำสุด ×', hNum('hMin')), el('label', {}, 'สูงสุด ×', hNum('hMax'))),
          check('สุ่มกลับซ้าย-ขวา', 'flip'),
          check('สุ่มหมุน', 'rotate', 'ภาพกระดาษแบน หมุนแล้วดูเหมือนสติกเกอร์เอียง (collision หมุนตามจริง)'),
          check('หลบทางเดินและทะเลสาบ', 'avoidPaths'),
          note('วงกั้นของชิ้นขยายตามขนาดที่สุ่ม · ไม่วางทับชิ้นที่กั้นทาง วงกั้น NPC ประตู จุดพัก จุดเกิดมอน ที่เรียกบอส จุดเริ่ม ขอบเขต (polygon) สนามบอส และนอกกรอบเดินได้')) : el('div', {},
          check('ลบเฉพาะภาพที่เลือกไว้', 'eraseOnlyPicked', 'ปิด = ลบทุกชิ้นในวง'),
          note('ลบของวางที่จุดยืนอยู่ในวง (ไม่ลบ NPC ประตู จุดเกิด ขอบเขต) · ชั้นของวางที่ล็อก/ซ่อนอยู่ลบไม่ได้')),
        el('div', { class: 'me-title' }, `ภาพที่เลือก (${picked.length})`),
        picked.length
          ? el('div', { class: 'me-brush-keys' }, ...picked.map((k) => el('button', { class: 'me-item on', title: `${k} · คลิกเพื่อเอาออก`, onclick: () => t.toggle(k) },
            el('img', { src: propUrl(k), alt: k, loading: 'lazy' }), el('span', {}, k))))
          : note(st.mode === 'paint' ? 'ยังไม่ได้เลือก คลิกภาพในคลังด้านล่าง (เลือกได้หลายภาพ แปรงสุ่มจากภาพที่เลือก)'
            : st.eraseOnlyPicked ? 'ยังไม่ได้เลือกภาพ ยางลบจึงยังไม่ลบอะไร (ปิด "ลบเฉพาะภาพที่เลือกไว้" = ลบทุกชิ้นในวง)' : 'ยังไม่ได้เลือก (ยางลบลบทุกชิ้นในวง)'),
        picked.length ? btn('ล้างภาพที่เลือก', () => { keys.clear(); save(); refresh(); }) : null,
      );
    },
  };
  return t;
}
