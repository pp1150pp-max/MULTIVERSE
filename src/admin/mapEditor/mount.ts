// The map editor page inside the /admin "แมพ" tab: the panels round the canvas (docs/plans/map-editor.md 2.1) and the
// load / autosave / publish flow against the /api/admin/maps routes (PR 5). The canvas itself is editor.ts.
import type { MapData, MapIssue, MapProp } from '../../shared/mapSchema';
import type { MapDiff } from '../../shared/mapDiff';
import { Editor } from './editor';
import { CORE_LAYERS } from './layers';
import { dropPoint, placePiece, placeTool, selectTool, deleteSelected, duplicateSelected } from './tools';
import { CATALOG, propUrl } from './sprites';
import { pick } from './history';
import { transformProps, normDeg } from './geom';

type Kids = (Node | string | null | undefined | false)[];
export type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
export type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

interface MapRow { id: string; bundledRev: number; publishedRev: number | null; publishedAt: number | null; draft: { baseRev: number; author: string; updatedAt: number } | null }
interface DraftReply { map?: MapData; source: 'draft' | 'published' | 'bundled'; baseRev: number; publishedRev: number | null; issues: MapIssue[] }
interface SaveReply { ok: boolean; issues: MapIssue[]; diff: MapDiff }

const MAP_NAMES: Record<string, string> = {
  nexus_city: 'เมืองกลาง (Nexus City)', emerald_forest: 'ฟาร์ม 1 · Emerald Forest', misty_marsh: 'ฟาร์ม 2 · Misty Marsh',
  frost_reach: 'ฟาร์ม 3 · Frost Reach', ashen_isle: 'ฟาร์ม 4 · Ashen Isle',
};
const SAVE_DELAY_MS = 1000;
const num = (v: string, d: number): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const round3 = (n: number): number => Math.round(n * 1000) / 1000;
/** replaceChildren that skips the empty slots (null / false) a conditional child leaves. */
const fill = (el: HTMLElement, ...kids: Kids): void => el.replaceChildren(...kids.filter((k): k is Node | string => !!k));
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The front/back variants a piece's key can switch between (propCatalog faceSets): base, front, back, in that order. */
function variantsOf(key: string): string[] {
  for (const f of CATALOG.faceSets) {
    const all = [f.base, f.front, f.back].filter((k): k is string => !!k);
    if (all.includes(key)) return all;
  }
  return [];
}

/** Builds the editor into `host`. Returns a function that stops its listeners. */
export function mountMapEditor(host: HTMLElement, h: H, api: Api): () => void {
  // -------------------------------------------------------------- state
  let ed: Editor | null = null;
  let current = '';
  let rows: MapRow[] = [];
  let dirty = false;
  let saving = false;
  let timer = 0;
  let lastSaved = 0;
  let issues: MapIssue[] = [];
  let diff: MapDiff | null = null;
  let disposed = false;

  // -------------------------------------------------------------- DOM
  const canvas = h('canvas', { class: 'me-canvas', tabindex: '0' });
  const status = h('span', { class: 'me-status' }, 'ยังไม่ได้เลือกแมพ');
  const mapSel = h('select', { class: 'me-mapsel', onchange: () => void loadMap(mapSel.value) });
  const undoBtn = h('button', { title: 'ย้อนกลับ (Ctrl+Z)', onclick: () => ed?.undo() }, '↶ ย้อน');
  const redoBtn = h('button', { title: 'ทำซ้ำ (Ctrl+Y)', onclick: () => ed?.redo() }, '↷ ทำซ้ำ');
  const publishBtn = h('button', { class: 'primary', onclick: () => void publish() }, '🚀 เผยแพร่');
  const latestBtn = h('button', { title: 'ทิ้งร่างที่บันทึกไว้ แล้วโหลดฉบับที่เผยแพร่ล่าสุดมาแก้ต่อ', onclick: () => void loadLatest() }, '↩ โหลดที่เผยแพร่ล่าสุด');
  const fitBtn = h('button', { title: 'ดูทั้งแมพ', onclick: () => ed?.fit() }, '⛶ ทั้งแมพ');
  const diffText = h('span', { class: 'muted me-diff' });
  const issueBox = h('div', { class: 'me-issues' });
  const toolBox = h('div', { class: 'me-tools' });
  const toolHint = h('div', { class: 'muted me-hint' });
  const optBox = h('div', { class: 'me-opts' });
  const layerBox = h('div', { class: 'me-layers' });
  const inspector = h('div', { class: 'me-inspector' });
  const palette = h('div', { class: 'me-palette' });
  const search = h('input', { type: 'search', placeholder: 'ค้นหาภาพ…', oninput: () => renderPalette() });
  const catSel = h('select', { onchange: () => renderPalette() }, h('option', { value: '' }, 'ทุกหมวด'),
    ...[...new Set(CATALOG.props.filter((p) => p.paper && p.inSheetSpecs).map((p) => p.category))].map((c) => h('option', { value: c }, c)));
  const paletteCount = h('span', { class: 'muted' });

  const root = h('div', { class: 'me' },
    h('div', { class: 'me-top' }, mapSel, undoBtn, redoBtn, fitBtn, latestBtn, status, diffText, publishBtn),
    h('div', { class: 'me-body' },
      h('div', { class: 'me-left' }, h('h4', {}, 'เครื่องมือ'), toolBox, toolHint, h('h4', {}, 'ตัวช่วยวาง'), optBox, h('h4', {}, 'เลเยอร์'), layerBox, h('h4', {}, 'ข้อผิดพลาดจากการตรวจ'), issueBox),
      h('div', { class: 'me-center' }, canvas),
      h('div', { class: 'me-right' },
        h('h4', {}, 'คุณสมบัติ'), inspector,
        h('h4', {}, 'คลังภาพกระดาษ ', paletteCount),
        h('div', { class: 'me-palette-bar' }, search, catSel), palette)),
  );
  host.replaceChildren(root);

  // -------------------------------------------------------------- status and saving
  function setStatus(text: string, cls = ''): void {
    status.textContent = text;
    status.className = `me-status ${cls}`;
  }
  const clock = (): string => new Date().toLocaleTimeString('th-TH', { hour12: false });

  function refreshTop(): void {
    undoBtn.disabled = !ed?.history.canUndo;
    redoBtn.disabled = !ed?.history.canRedo;
    undoBtn.title = ed?.history.undoLabel ? `ย้อนกลับ: ${ed.history.undoLabel} (Ctrl+Z)` : 'ย้อนกลับ (Ctrl+Z)';
    redoBtn.title = ed?.history.redoLabel ? `ทำซ้ำ: ${ed.history.redoLabel} (Ctrl+Y)` : 'ทำซ้ำ (Ctrl+Y)';
    publishBtn.disabled = !ed || saving;
    diffText.textContent = diff ? `ต่างจากที่เผยแพร่: เพิ่ม ${diff.added} · ลบ ${diff.removed} · แก้ ${diff.changed} ชิ้น` : '';
  }

  function scheduleSave(): void {
    dirty = true;
    setStatus('มีการแก้ไข รอบันทึกร่าง…', 'warn');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void save(), SAVE_DELAY_MS);
  }

  /** Saves the draft (one request at a time; edits made meanwhile go in the next one). */
  async function save(): Promise<boolean> {
    window.clearTimeout(timer);
    if (!ed || !dirty) return true;
    if (saving) { timer = window.setTimeout(() => void save(), 300); return false; }
    saving = true;
    const id = current;
    const map = ed.map;
    dirty = false;
    setStatus('กำลังบันทึกร่าง…');
    refreshTop();
    try {
      const r = await api<SaveReply>('PUT', `/admin/maps/${id}/draft`, { map });
      if (id === current) {
        issues = r.issues;
        diff = r.diff;
        lastSaved = Date.now();
        const errs = issues.filter((i) => i.severity === 'error').length;
        setStatus(`บันทึกร่างแล้ว ${clock()}${errs ? ` · ข้อผิดพลาด ${errs} ข้อ (เผยแพร่ไม่ได้จนกว่าจะแก้)` : ''}`, errs ? 'bad' : 'good');
        renderIssues();
      }
      saving = false;
      if (dirty) scheduleSave();
      refreshTop();
      return true;
    } catch (e) {
      saving = false;
      dirty = true;
      setStatus(`บันทึกร่างไม่สำเร็จ: ${errText(e)} (จะลองใหม่เมื่อแก้ต่อ)`, 'bad');
      refreshTop();
      return false;
    }
  }

  async function publish(): Promise<void> {
    if (!ed) return;
    publishBtn.disabled = true;
    try {
      dirty = true; // always save once so the server holds exactly what is on the screen
      if (!(await save())) return;
      while (saving) await new Promise((r) => setTimeout(r, 100));
      if (issues.some((i) => i.severity === 'error')) {
        setStatus('แมพยังไม่ผ่านการตรวจ เผยแพร่ไม่ได้ ดูข้อผิดพลาดด้านซ้าย', 'bad');
        return;
      }
      const d = diff;
      const text = `เผยแพร่แมพ "${MAP_NAMES[current] ?? current}"?\n\n${d ? `เพิ่ม ${d.added} · ลบ ${d.removed} · แก้ ${d.changed} ชิ้น` : 'ไม่มีข้อมูลสรุปการเปลี่ยน'}\n\nห้องที่เปิดใหม่ใช้ทันที ห้องที่มีคนอยู่ใช้ตอนผู้เล่นเข้าแมพนี้ครั้งถัดไป`;
      if (!confirm(text)) return;
      setStatus('กำลังเผยแพร่…');
      const r = await api<{ rev: number }>('POST', `/admin/maps/${current}/publish`, {});
      ed.map.rev = r.rev; // later drafts are based on this revision
      diff = { added: 0, removed: 0, changed: 0 };
      setStatus(`เผยแพร่แล้ว rev ${r.rev} · ${clock()}`, 'good');
      await refreshRows();
    } catch (e) {
      setStatus(`เผยแพร่ไม่สำเร็จ: ${errText(e)}`, 'bad');
    } finally {
      refreshTop();
    }
  }

  /** Drops the saved draft and loads the newest published layout (or the bundled file when none was published yet). */
  async function loadLatest(): Promise<void> {
    if (!ed) return;
    const row = rows.find((r) => r.id === current);
    const from = row?.publishedRev != null ? `rev ${row.publishedRev} ที่เผยแพร่ล่าสุด` : 'ไฟล์ที่มากับเกม (ยังไม่เคยเผยแพร่)';
    if (!confirm(`ทิ้งการแก้ที่ยังไม่เผยแพร่ของแมพนี้ แล้วโหลด ${from} มาแทน?\n\nร่างที่บันทึกไว้จะถูกเขียนทับ`)) return;
    try {
      let map: MapData | undefined;
      if (row?.publishedRev != null) map = (await api<{ map?: MapData }>('GET', `/admin/maps/${current}/revisions/${row.publishedRev}`)).map;
      else map = structuredClone((await import('../../shared/mapRegistry')).MapRegistry.bundled(current));
      if (!map) throw new Error('ไม่พบข้อมูล');
      ed.setMap(map);
      diff = { added: 0, removed: 0, changed: 0 };
      scheduleSave(); // the draft now holds exactly this
      setStatus(`โหลด ${from} แล้ว (ร่างถูกเขียนทับ)`, 'warn');
    } catch (err) {
      setStatus(`โหลดไม่สำเร็จ: ${errText(err)}`, 'bad');
    }
  }

  function renderIssues(): void {
    if (!issues.length) { issueBox.replaceChildren(h('div', { class: 'muted' }, 'ไม่มี')); return; }
    issueBox.replaceChildren(...issues.slice(0, 40).map((i) => h('button', {
      class: `me-issue ${i.severity}`,
      title: i.message,
      onclick: () => {
        if (!ed || i.kind !== 'prop' || !i.id) return;
        const p = ed.map.props.find((q) => q.id === i.id);
        if (p) { ed.select([p.id]); ed.centerOn(p.x, p.z); }
      },
    }, `${i.severity === 'error' ? '⛔' : '⚠️'} ${i.message}`)), ...(issues.length > 40 ? [h('div', { class: 'muted' }, `…อีก ${issues.length - 40} ข้อ`)] : []));
  }

  // -------------------------------------------------------------- loading
  async function refreshRows(): Promise<void> {
    const r = await api<{ maps: MapRow[] }>('GET', '/admin/maps');
    rows = r.maps;
    const keep = current;
    mapSel.replaceChildren(...rows.map((m) => {
      const note = m.draft ? ' · มีร่าง' : m.publishedRev !== null ? ` · เผยแพร่ rev ${m.publishedRev}` : '';
      return h('option', { value: m.id, selected: m.id === keep }, `${MAP_NAMES[m.id] ?? m.id}${note}`);
    }));
  }

  async function loadMap(id: string): Promise<void> {
    if (!id) return;
    if (ed && dirty) await save();
    if (disposed) return;
    setStatus('กำลังโหลดแมพ…');
    try {
      const r = await api<DraftReply>('GET', `/admin/maps/${id}/draft`);
      if (!r.map) throw new Error('ไม่มีข้อมูลแมพนี้');
      current = id;
      mapSel.value = id;
      issues = r.issues;
      diff = null;
      dirty = false;
      if (!ed) startEditor(r.map); else ed.setMap(r.map);
      const src = r.source === 'draft' ? 'ร่างที่บันทึกไว้' : r.source === 'published' ? `ที่เผยแพร่ล่าสุด (rev ${r.publishedRev})` : 'ไฟล์ที่มากับเกม';
      setStatus(`โหลด${src}แล้ว · ${r.map.props.length} ชิ้น`);
      renderIssues();
      renderInspector(true);
      refreshTop();
    } catch (e) {
      setStatus(`โหลดไม่สำเร็จ: ${errText(e)}`, 'bad');
    }
  }

  // -------------------------------------------------------------- the editor and its panels
  function startEditor(map: MapData): void {
    const e = new Editor(canvas, map);
    ed = e;
    (canvas as HTMLCanvasElement & { editor?: Editor }).editor = e; // a handle for checking the page from the console
    for (const l of CORE_LAYERS) e.addLayer(l);
    const place = placeTool();
    e.addTool(selectTool());
    e.addTool(place);
    placeBrush = place;
    e.onChange = () => { scheduleSave(); renderInspector(false); };
    e.onSelect = () => renderInspector(true);
    e.onTool = () => renderTools();
    e.onHistory = () => refreshTop();
    renderTools();
    renderOptions();
    renderLayers();
    e.fit();
    wireDrop();
  }
  let placeBrush: ReturnType<typeof placeTool> | null = null;

  function renderTools(): void {
    if (!ed) return;
    toolBox.replaceChildren(...ed.tools.map((t) => h('button', {
      class: t === ed!.tool ? 'on' : '', onclick: () => ed!.setTool(t.id), title: t.label,
    }, `${t.icon} ${t.label}`)));
    toolHint.textContent = ed.tool.hint;
  }

  function renderOptions(): void {
    if (!ed) return;
    const e = ed;
    const box = (label: string, get: () => boolean, set: (v: boolean) => void, title = ''): HTMLElement =>
      h('label', { title }, h('input', { type: 'checkbox', checked: get(), onchange: (ev: Event) => { set((ev.target as HTMLInputElement).checked); e.requestDraw(); } }), ` ${label}`);
    optBox.replaceChildren(
      box('Snap เข้ากริด', () => e.opts.snap, (v) => { e.opts.snap = v; }, 'ถือ Alt ค้างตอนลาก = ปิดชั่วคราว'),
      h('label', {}, 'ขนาดช่อง ', h('select', { onchange: (ev: Event) => { e.opts.grid = Number((ev.target as HTMLSelectElement).value) as 0.5 | 1 | 2; e.requestDraw(); } },
        ...[0.5, 1, 2].map((g) => h('option', { value: String(g), selected: e.opts.grid === g }, `${g} หน่วยโลก`)))),
      box('ชิดขอบชิ้นข้างเคียง', () => e.opts.edges, (v) => { e.opts.edges = v; }),
      box('โชว์วง/กล่อง collision', () => e.opts.showSolid, (v) => { e.opts.showSolid = v; }),
      box('โชว์กริด', () => e.opts.showGrid, (v) => { e.opts.showGrid = v; }),
    );
  }

  function renderLayers(): void {
    if (!ed) return;
    const e = ed;
    layerBox.replaceChildren(...e.layers.filter((l) => !['selection', 'ghost'].includes(l.id)).map((l) => h('div', { class: 'me-layer' },
      h('label', {}, h('input', { type: 'checkbox', checked: e.layerState[l.id].visible, onchange: (ev: Event) => { e.layerState[l.id].visible = (ev.target as HTMLInputElement).checked; e.requestDraw(); } }), ` ${l.label}`),
      l.pickable ? h('label', { title: 'ล็อก = เลือก/ลากไม่ได้' }, h('input', { type: 'checkbox', checked: e.layerState[l.id].locked, onchange: (ev: Event) => { e.layerState[l.id].locked = (ev.target as HTMLInputElement).checked; if (e.layerState[l.id].locked) e.select([]); } }), ' 🔒') : null)));
  }

  // -------------------------------------------------------------- inspector
  let inspKey = '';
  const inputs: Record<string, HTMLInputElement | HTMLSelectElement> = {};

  function renderInspector(rebuild: boolean): void {
    if (!ed) return;
    const e = ed;
    const custom = e.tool.inspector?.(e);
    if (custom) { inspKey = ''; inspector.replaceChildren(custom); return; }
    const sel = e.selectedProps();
    const key = [...e.selection].sort().join(',');
    if (!rebuild && key === inspKey && sel.length) { syncInspector(sel); return; }
    inspKey = key;
    if (!sel.length) {
      inspector.replaceChildren(h('div', { class: 'muted' }, 'ยังไม่ได้เลือกชิ้นไหน คลิกชิ้นบนแมพ หรือลากกรอบเลือกหลายชิ้น'));
      return;
    }
    const first = sel[0];
    const multi = sel.length > 1;
    // One edit = one undo step: typing commits on `change`; the slider is live while dragging and commits on release.
    const field = (name: string, label: string, v: number, apply: (p: MapProp, n: number) => MapProp, step = 0.1, min?: number, disabled = false): HTMLElement => {
      const i = h('input', { type: 'number', step: String(step), value: String(round3(v)), disabled, ...(min !== undefined ? { min: String(min) } : {}),
        onchange: () => { const n = num(i.value, v); e.editSelected(`แก้ ${label}`, (p) => apply(p, n)); } });
      inputs[name] = i;
      return h('label', {}, label, i);
    };
    let rotBefore: ReturnType<typeof pick> | null = null;
    const rotNum = field('rot', 'หมุน (องศา)', first.rot, (p, n) => ({ ...p, rot: normDeg(n) }), 1);
    const rotRange = h('input', { type: 'range', min: '0', max: '359', step: '1', value: String(Math.round(first.rot)),
      oninput: () => {
        if (!rotBefore) rotBefore = pick(e.map, ['props', 'colliders']);
        const deg = num(rotRange.value, 0);
        const base = rotBefore as Pick<MapData, 'props' | 'colliders'>;
        const r = transformProps(base, e.selection, (p) => ({ ...p, rot: deg }));
        e.live(r.colliders === base.colliders ? { props: r.props } : { props: r.props, colliders: r.colliders });
        (inputs.rot as HTMLInputElement).value = String(deg);
      },
      onchange: () => { if (rotBefore) { e.commitLive('หมุน', rotBefore); rotBefore = null; } } });
    inputs.rotRange = rotRange;

    const solidKind = !first.solid ? 'none' : 'r' in first.solid ? 'circle' : 'box';
    const solidSel = h('select', { onchange: () => {
      const k = solidSel.value;
      e.editSelected('แก้ collision', (p) => {
        const { solid: _old, ...rest } = p;
        void _old;
        if (k === 'circle') return { ...rest, solid: { r: 1 } };
        if (k === 'box') return { ...rest, solid: { w: 2, d: 2 } };
        return rest;
      });
    } }, h('option', { value: 'none', selected: solidKind === 'none' }, 'เดินทะลุได้'),
      h('option', { value: 'circle', selected: solidKind === 'circle' }, 'วงกลม'), h('option', { value: 'box', selected: solidKind === 'box' }, 'กล่อง (หมุนตาม)'));
    inputs.solidKind = solidSel;
    const solidFields = first.solid
      ? ('r' in first.solid
        ? [field('sr', 'รัศมี', first.solid.r, (p, n) => ({ ...p, solid: { r: Math.max(0.05, n) } }), 0.1, 0.05)]
        : [field('sw', 'กว้าง (แกน x)', first.solid.w, (p, n) => ({ ...p, solid: { w: Math.max(0.1, n), d: p.solid && 'd' in p.solid ? p.solid.d : 1 } }), 0.1, 0.1),
          field('sd', 'ลึก (แกน z)', first.solid.d, (p, n) => ({ ...p, solid: { w: p.solid && 'w' in p.solid ? p.solid.w : 1, d: Math.max(0.1, n) } }), 0.1, 0.1)])
      : [];
    const variants = variantsOf(first.key);
    const flip = h('input', { type: 'checkbox', checked: first.flip, onchange: () => e.editSelected('กลับซ้าย-ขวา', (p) => ({ ...p, flip: flip.checked })) });
    inputs.flip = flip;
    const fade = h('input', { type: 'checkbox', checked: first.fade, onchange: () => e.editSelected('แก้ fade', (p) => ({ ...p, fade: fade.checked })) });
    inputs.fade = fade;
    fill(inspector,
      h('div', { class: 'me-title' }, multi ? `เลือก ${sel.length} ชิ้น (ค่าที่แก้ใช้กับทุกชิ้น)` : first.key),
      multi ? null : h('div', { class: 'muted' }, `id ${first.id}`),
      h('div', { class: 'me-grid2' },
        field('x', 'x', first.x, (p, n) => ({ ...p, x: n }), 0.5, undefined, multi),
        field('z', 'z', first.z, (p, n) => ({ ...p, z: n }), 0.5, undefined, multi),
        field('h', 'สูง (h)', first.h, (p, n) => ({ ...p, h: Math.max(0.1, n) }), 0.1, 0.1)),
      h('div', { class: 'me-rot' }, rotNum, rotRange,
        h('div', { class: 'muted me-hint' }, 'หมุนได้อิสระ 360° ภาพกระดาษเป็นภาพแบน จึงแค่เอียงบนจอ (บ้านใหญ่ที่หมุนมากจะดูเหมือนสติกเกอร์เอียง) ส่วน collision หมุนตามจริง เหมาะกับกำแพง รั้ว สะพาน ป้าย')),
      h('div', { class: 'row' },
        h('label', {}, flip, ' กลับซ้าย-ขวา'),
        h('label', { title: 'จางเมื่อตัวละครเดินอยู่ข้างหลัง' }, fade, ' จางเมื่อบัง')),
      h('label', {}, 'collision', solidSel),
      h('div', { class: 'me-grid2' }, ...solidFields),
      variants.length > 1 ? h('button', {
        title: `ชุดภาพนี้มี ${variants.join(' / ')}`,
        onclick: () => e.editSelected('สลับชุดภาพหน้า/หลัง', (p) => {
          const v = variantsOf(p.key);
          return v.length > 1 ? { ...p, key: v[(v.indexOf(p.key) + 1) % v.length] } : p;
        }),
      }, '🔄 สลับด้านหน้า/หลังของชุดภาพ') : null,
      h('div', { class: 'row' },
        h('button', { onclick: () => duplicateSelected(e) }, '⧉ ทำสำเนา (Ctrl+D)'),
        h('button', { onclick: () => deleteSelected(e) }, '🗑 ลบ (Delete)')),
    );
  }

  /** The document changed under an unchanged selection: refresh the numbers without rebuilding (keeps the caret). */
  function syncInspector(sel: MapProp[]): void {
    const p = sel[0];
    const set = (k: string, v: number): void => {
      const i = inputs[k] as HTMLInputElement | undefined;
      if (i && document.activeElement !== i) i.value = String(round3(v));
    };
    set('x', p.x); set('z', p.z); set('h', p.h); set('rot', p.rot); set('rotRange', Math.round(p.rot));
    const flip = inputs.flip as HTMLInputElement | undefined, fade = inputs.fade as HTMLInputElement | undefined;
    if (flip) flip.checked = p.flip;
    if (fade) fade.checked = p.fade;
    const kind = !p.solid ? 'none' : 'r' in p.solid ? 'circle' : 'box';
    const ks = inputs.solidKind as HTMLSelectElement | undefined;
    if (ks && ks.value !== kind) renderInspector(true);
    else if (p.solid) {
      if ('r' in p.solid) set('sr', p.solid.r); else { set('sw', p.solid.w); set('sd', p.solid.d); }
    }
    if (inspector.querySelector('.me-title')?.textContent !== (sel.length > 1 ? `เลือก ${sel.length} ชิ้น (ค่าที่แก้ใช้กับทุกชิ้น)` : p.key)) renderInspector(true);
  }

  // -------------------------------------------------------------- palette
  function renderPalette(): void {
    const q = search.value.trim().toLowerCase();
    const cat = catSel.value;
    const list = CATALOG.props.filter((p) => p.paper && p.inSheetSpecs && (!cat || p.category === cat) && (!q || p.key.toLowerCase().includes(q)));
    paletteCount.textContent = `(${list.length})`;
    palette.replaceChildren(...list.map((p) => {
      const img = h('img', { src: propUrl(p.key), alt: p.key, loading: 'lazy', decoding: 'async', draggable: true,
        ondragstart: (ev: DragEvent) => { dragKey = p.key; ev.dataTransfer?.setData('text/plain', p.key); if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy'; },
        ondragend: () => { dragKey = null; if (ed) { ed.ghost = null; ed.requestDraw(); } } });
      return h('button', {
        class: `me-item${placeBrush?.brush === p.key ? ' on' : ''}`, title: `${p.key} · ${p.category}`,
        onclick: () => { if (!ed || !placeBrush) return; placeBrush.brush = p.key; ed.setTool('place'); renderPalette(); },
      }, img, h('span', {}, p.key));
    }));
  }
  let dragKey: string | null = null;

  function wireDrop(): void {
    canvas.addEventListener('dragover', (ev) => {
      if (!ed || !dragKey) return;
      ev.preventDefault();
      const p = dropPoint(ed, ev.clientX, ev.clientY, ev.altKey);
      ed.ghost = { key: dragKey, x: p.x, z: p.z };
      ed.requestDraw();
    });
    canvas.addEventListener('dragleave', () => { if (ed) { ed.ghost = null; ed.requestDraw(); } });
    canvas.addEventListener('drop', (ev) => {
      if (!ed) return;
      ev.preventDefault();
      const key = dragKey ?? ev.dataTransfer?.getData('text/plain');
      ed.ghost = null;
      if (!key) return;
      const p = dropPoint(ed, ev.clientX, ev.clientY, ev.altKey);
      placePiece(ed, key, p.x, p.z, ev.altKey);
      dragKey = null;
    });
  }

  // -------------------------------------------------------------- keys and leaving
  const onKey = (ev: KeyboardEvent): void => {
    if (!root.isConnected) { dispose(); return; }
    const t = ev.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
      if (!(t as HTMLInputElement).type || (t as HTMLInputElement).type !== 'range') return;
    }
    if (!ed) return;
    if (ed.key(ev)) ev.preventDefault();
  };
  const onUnload = (ev: BeforeUnloadEvent): void => {
    if (dirty || saving) { ev.preventDefault(); ev.returnValue = ''; }
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKey);
  window.addEventListener('beforeunload', onUnload);

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKey);
    window.removeEventListener('beforeunload', onUnload);
    if (dirty) void save(); // leaving the tab: the last edits still go to the draft
    ed?.dispose();
  }

  // -------------------------------------------------------------- go
  renderPalette();
  renderIssues();
  refreshTop();
  void (async () => {
    try {
      await refreshRows();
      await loadMap(rows[0]?.id ?? '');
    } catch (e) {
      setStatus(`โหลดรายการแมพไม่สำเร็จ: ${errText(e)}`, 'bad');
    }
  })();
  void lastSaved;
  return dispose;
}
