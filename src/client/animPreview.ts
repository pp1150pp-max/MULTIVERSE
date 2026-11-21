// The character animation bench on /admin → หน้าตา → ท่าตัวละคร (owner 2026-11-18: running looked odd in some
// directions). One class, one animation, all 8 screen facings at once, each over its own ground that slides under the
// feet at the chosen move speed, so a foot that slides or a step that is too short/long shows. Drawn by the game's
// own AnimatedActor / RigActor with the game's stride rule (strideRate), so it looks exactly like the game.
// Loaded only when the tab opens.
import * as THREE from 'three';
import { groundTiles, loadCharAnimSet, loadGameAssets } from './assets';
import { AnimatedActor, strideRate, type Actor, type AnimSet } from './AnimatedActor';
import { ISO_DIR } from './world';
import { loadSwordRig, RigActor, type RigAssets } from './rig/RigActor';
import { BASE_MOVE_SPEED } from '../shared/formulas';
import { applyAnimTuning, currentAnimTuning, setAnimDirTune } from './animTune';
import {
  ANIM_ROWS, ANIM_TUNE_RANGE, animKey, checkAnimTuning, ROW_NAME as TUNE_ROW_NAME, sameAnimTuning, screenDirOf,
  type AnimTuning, type DirTune, type ScreenDir,
} from '../shared/animTuning';
import type { AdminAnimLook } from '../shared/admin';

/** How the bench reads and saves the server-wide fixes (the /admin page's API). */
export interface AnimBenchIo {
  load(): Promise<AdminAnimLook>;
  save(t: AnimTuning | 'reset'): Promise<AdminAnimLook>;
}

const CSS = `
.animp { display: flex; gap: 0; background: #10131a; color: #e8e4d8; font: 13px/1.4 system-ui, sans-serif; }
.animp .animp-panel { width: 290px; flex: none; overflow: auto; padding: 10px; box-sizing: border-box; border-right: 1px solid #3a4152; }
.animp .animp-view { position: relative; flex: 1; min-width: 0; overflow: hidden; }
.animp .animp-view canvas { display: block; }
.animp h1 { font-size: 15px; margin: 0 0 6px; }
.animp h2 { font-size: 12px; margin: 10px 0 4px; color: #f2d58a; }
.animp .row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin: 4px 0; }
.animp select { background: #1d2230; color: inherit; border: 1px solid #3a4152; border-radius: 3px; padding: 2px 4px; font: inherit; }
.animp button { background: #2a3245; color: inherit; border: 1px solid #4a5570; border-radius: 3px; padding: 3px 8px; cursor: pointer; font: inherit; }
.animp button.on { background: #4a5a80; border-color: #8fa8e0; }
.animp input[type=range] { width: 130px; }
.animp .note { color: #9aa3b8; font-size: 11px; }
.animp .cell-label.sel { outline: 2px solid #ffe066; }
.animp .tune-sum { color: #ffe066; }
.animp .saved { color: #8fd18f; } .animp .dirty { color: #ffb35c; } .animp .err { color: #ff7a7a; }
.animp .cell-label { position: absolute; font-size: 11px; color: #e8ecf6; background: rgba(0,0,0,.5); padding: 1px 5px; border-radius: 3px; pointer-events: none; white-space: nowrap; }
.animp .cell-mid { position: absolute; background: #10131a; display: flex; align-items: center; justify-content: center; text-align: center; color: #9aa3b8; font-size: 11px; padding: 6px; box-sizing: border-box; }
@media (max-width: 720px) { .animp { flex-direction: column; } .animp .animp-panel { width: auto; border-right: 0; max-height: 45%; } }
`;

/** Screen facings as world (dx, dz), in a 3×3 grid's order (the middle is empty), as on the rig bench. */
const DIRS: ([number, number] | null)[] = [
  [-1, 0], [-1, -1], [0, -1],
  [-1, 1], null, [1, -1],
  [0, 1], [1, 1], [1, 0],
];
const DIR_ARROW = ['↖', '↑', '↗', '←', '', '→', '↙', '↓', '↘'];
const ROW_NAME: Record<string, string> = { down: 'หน้า', down_side: 'ทแยงหน้า', side: 'ข้าง', up_side: 'ทแยงหลัง', up: 'หลัง', left: 'ซ้าย', right: 'ขวา' };

const CLASSES = ['sword', 'gunslinger', 'mage'] as const;
type Cls = (typeof CLASSES)[number];
const CLASS_NAME: Record<Cls, string> = { sword: 'นักดาบ', gunslinger: 'มือปืน', mage: 'จอมเวท' };
type Art = 'old' | 'paper' | 'rig';
const ART_NAME: Record<Art, string> = { old: 'ภาพเดิม', paper: 'ภาพกระดาษ', rig: 'นักดาบกระดูก (ทดลอง)' };

/** What the bench can play; `combo` = the sword's three swings in a row, `run_attack` = attacking while running. */
const ANIM_NAME: Record<string, string> = {
  idle: 'ยืน', run: 'วิ่ง', run_attack: 'โจมตีขณะวิ่ง', attack: 'โจมตี 1', attack_2: 'โจมตี 2', attack_3: 'โจมตี 3', combo: 'คอมโบ 3 จังหวะ',
  death: 'ตาย', ride: 'ขี่สัตว์', ride_board: 'ขี่บอร์ด',
};
const ANIM_ORDER = ['idle', 'run', 'run_attack', 'attack', 'attack_2', 'attack_3', 'combo', 'death', 'ride', 'ride_board'];
/** The ground texture repeats every this many world units (24-unit plane, repeat 6), so the slide wraps seamlessly. */
const TILE = 4;

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (v !== false && v !== undefined) el.setAttribute(k, v === true ? '' : String(v));
  }
  el.append(...kids);
  return el;
};

interface Cell {
  dir: [number, number];
  arrow: string;
  scene: THREE.Scene;
  slide: THREE.Group;
  actor: Actor | null;
  label: HTMLElement;
}

/** Mounts the bench in `root` and returns a function that stops it (renderer, frame loop, listeners). */
export async function mountAnimPreview(root: HTMLElement, io?: AnimBenchIo): Promise<() => void> {
  if (!document.getElementById('animp-css')) document.head.append(h('style', { id: 'animp-css' }, CSS));
  root.classList.add('animp');
  root.style.height = 'min(82vh, 820px)';
  const panel = h('div', { class: 'animp-panel' });
  const viewEl = h('div', { class: 'animp-view' });
  root.replaceChildren(panel, viewEl);

  await loadGameAssets();
  const sets = new Map<string, Promise<AnimSet | null>>();
  const setOf = (cls: Cls, paper: boolean) => {
    const key = `${cls}:${paper ? 'paper' : 'old'}`;
    if (!sets.has(key)) sets.set(key, loadCharAnimSet(cls, paper ? `paper/player/${cls}` : `player/${cls}`));
    return sets.get(key)!;
  };
  let rigAssets: RigAssets | null = null;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setScissorTest(true);
  viewEl.append(renderer.domElement);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const target = new THREE.Vector3(0, 1, 0);
  camera.position.copy(target).addScaledVector(ISO_DIR, 80);
  camera.lookAt(target);

  const state = {
    cls: 'sword' as Cls, art: 'paper' as Art, anim: 'run', speed: 1, move: BASE_MOVE_SPEED, zoom: 3.2,
    paused: false, ground: true, rideMove: true, line: true,
    /** The facing being tuned: an index of DIRS. */
    sel: 1,
  };

  // ---- one small scene per facing: a ground (texture + 1-unit grid) that slides, a fixed line along the run.
  const tile = groundTiles.grass;
  const groundMat = new THREE.MeshBasicMaterial({ color: tile ? '#ffffff' : '#3d5a36' });
  if (tile) {
    const t = tile.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    t.needsUpdate = true;
    groundMat.map = t;
  }
  const groundGeo = new THREE.PlaneGeometry(24, 24).rotateX(-Math.PI / 2);
  const lineMat = new THREE.LineBasicMaterial({ color: '#ffe066' });
  const disposables: { dispose(): void }[] = [groundMat, groundGeo, lineMat];
  const cells: (Cell | null)[] = DIRS.map((d, i) => {
    if (!d) return null;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#2b3a2a');
    const slide = new THREE.Group();
    slide.add(new THREE.Mesh(groundGeo, groundMat));
    const grid = new THREE.GridHelper(24, 24, 0x000000, 0x000000);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.22;
    grid.position.y = 0.01;
    disposables.push(grid.geometry, grid.material as THREE.Material);
    slide.add(grid);
    const len = Math.hypot(d[0], d[1]);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3((-d[0] / len) * 1.6, 0.03, (-d[1] / len) * 1.6),
      new THREE.Vector3((d[0] / len) * 1.6, 0.03, (d[1] / len) * 1.6),
    ]);
    disposables.push(lineGeo);
    const line = new THREE.Line(lineGeo, lineMat);
    line.name = 'line';
    scene.add(slide, line);
    const label = h('div', { class: 'cell-label' });
    viewEl.append(label);
    return { dir: d, arrow: DIR_ARROW[i], scene, slide, actor: null, label };
  });
  const mid = h('div', { class: 'cell-mid' }, 'ลูกศร = ทิศที่วิ่ง · เส้นเหลือง = แนววิ่ง · พื้นเลื่อนสวนเท้าตามความเร็ว ถ้าเท้าไถลบนพื้นแปลว่าก้าวไม่พอดี');
  viewEl.append(mid);

  /** Redraws the per-facing fixes box (set up below, once the saved fixes have loaded). */
  let drawTune = (): void => {};

  // ---- actors: rebuilt when the class or the art changes.
  let building = 0;
  const animsOf = (a: Actor) => ANIM_ORDER.filter((n) => (n === 'combo' ? a.has('attack_3') : a.has(n)));
  const rebuild = async () => {
    const my = ++building;
    const paper = state.art === 'paper';
    const set = await setOf(state.cls, paper);
    if (state.art === 'rig' && !rigAssets) rigAssets = await loadSwordRig();
    if (my !== building) return;
    for (const c of cells) {
      if (!c) continue;
      if (c.actor) {
        c.scene.remove(c.actor.group);
        c.actor.dispose();
        c.actor = null;
      }
      if (!set) continue;
      const animated = new AnimatedActor(set, 0.4);
      c.actor = state.art === 'rig' && rigAssets ? new RigActor(animated, rigAssets) : animated;
      c.scene.add(c.actor.group);
    }
    if (!set) note.textContent = `ไม่มี${ART_NAME[state.art]}ของ${CLASS_NAME[state.cls]}`;
    else note.textContent = '';
    drawAnims();
    restart();
    drawTune();
  };

  // ---- panel
  const sel = <V extends string>(values: readonly V[], names: Record<string, string>, get: () => V, set: (v: V) => void) =>
    h('select', { onchange: (e: Event) => set((e.target as HTMLSelectElement).value as V) },
      ...values.map((v) => h('option', { value: v, selected: get() === v }, names[v] ?? v)));
  const note = h('div', { class: 'note' });
  const artBox = h('span');
  const drawArt = () => {
    const arts: Art[] = state.cls === 'sword' ? ['paper', 'rig'] : ['paper'];
    if (!arts.includes(state.art)) state.art = 'paper';
    artBox.replaceChildren(sel(arts, ART_NAME, () => state.art, (v) => { state.art = v; void rebuild(); }));
  };
  const animBox = h('span');
  const drawAnims = () => {
    const first = cells.find((c) => c?.actor)?.actor;
    const list = first ? animsOf(first) : ['idle'];
    if (!list.includes(state.anim)) state.anim = list.includes('run') ? 'run' : list[0];
    animBox.replaceChildren(sel(list, ANIM_NAME, () => state.anim, (v) => { state.anim = v; restart(); drawTune(); }));
  };
  const range = (min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string) => {
    const out = h('span', {}, fmt(get()));
    const input = h('input', {
      type: 'range', min: String(min), max: String(max), step: String(step), value: String(get()),
      oninput: (e: Event) => { set(Number((e.target as HTMLInputElement).value)); out.textContent = fmt(get()); },
    });
    return h('span', {}, input, ' ', out);
  };
  const check = (label: string, get: () => boolean, set: (v: boolean) => void) =>
    h('label', { class: 'row', style: 'justify-content: flex-start' },
      h('input', { type: 'checkbox', checked: get(), onchange: (e: Event) => set((e.target as HTMLInputElement).checked) }), label);
  const strideOut = h('span', { class: 'note' });
  const pauseBtn = h('button', { onclick: () => { state.paused = !state.paused; drawPause(); } });
  const drawPause = () => {
    pauseBtn.textContent = state.paused ? '▶ เล่น' : '⏸ หยุด';
    pauseBtn.classList.toggle('on', state.paused);
  };
  drawPause();
  let stepDt = 0;
  const stepBtn = h('button', {
    onclick: () => {
      state.paused = true;
      drawPause();
      // One drawn frame of what is showing (the run cycle plays at its fps × the stride).
      const a = cells.find((c) => c?.actor)?.actor;
      const old = a instanceof RigActor ? null : (a as AnimatedActor | undefined);
      const fps = old ? (setFps(old) ?? 10) : 10;
      stepDt = 1 / fps;
    },
  }, 'ทีละเฟรม ⏭');

  panel.append(
    h('h1', {}, 'ท่าตัวละคร ทุกทิศ'),
    h('div', { class: 'note' }, 'วาดด้วยตัววาดเดียวกับในเกม ความเร็วก้าววิ่งคิดแบบเดียวกับในเกม (ตามความเร็วที่เคลื่อนจริง) · ดูอย่างเดียว ไม่เปลี่ยนอะไรในเกม'),
    h('h2', {}, 'ตัวละคร'),
    h('div', { class: 'row' }, 'อาชีพ', sel(CLASSES, CLASS_NAME, () => state.cls, (v) => { state.cls = v; drawArt(); void rebuild(); })),
    h('div', { class: 'row' }, 'ภาพ', artBox),
    h('div', { class: 'row' }, 'ท่า', animBox),
    note,
    check('ขี่สัตว์/บอร์ด: กำลังเคลื่อนที่', () => state.rideMove, (v) => { state.rideMove = v; }),
    h('h2', {}, 'การเล่น'),
    h('div', { class: 'row' }, 'ความเร็วเคลื่อนที่', range(0, 10, 0.1, () => state.move, (v) => { state.move = v; }, (v) => `${v.toFixed(1)}`)),
    h('div', { class: 'note' }, `หน่วยต่อวินาที · ปกติในเกม ${BASE_MOVE_SPEED} (+ค่าความเร็วเคลื่อนที่ของชุด) · ขี่สัตว์เร็วขึ้น`),
    strideOut,
    h('div', { class: 'row' }, 'ความเร็วเล่น (สโลว์)', range(0.05, 2, 0.05, () => state.speed, (v) => { state.speed = v; }, (v) => `×${v.toFixed(2)}`)),
    h('div', { class: 'row' }, pauseBtn, stepBtn),
    h('h2', {}, 'มุมมอง'),
    check('พื้นเลื่อนใต้เท้า', () => state.ground, (v) => { state.ground = v; }),
    check('เส้นแนววิ่ง', () => state.line, (v) => { state.line = v; }),
    h('div', { class: 'row' }, 'ซูม', range(2, 6, 0.1, () => state.zoom, (v) => { state.zoom = v; layout(); }, (v) => v.toFixed(1))),
    h('div', { class: 'note' }, 'ป้ายแต่ละช่อง: แถวภาพที่ใช้ (พลิก = ใช้ภาพอีกข้างกลับด้าน) · เฟรมที่แสดง'),
  );
  drawArt();

  // ---- per-facing fixes (src/shared/animTuning.ts): tried out here at once, saved server-wide by the owner.
  let saved: AnimTuning = {};
  let canEdit = false;
  if (io) {
    try {
      const r = await io.load();
      saved = checkAnimTuning(r.tuning, false).tuning ?? {};
      canEdit = r.canEdit;
    } catch (e) {
      saved = {};
      note.textContent = `โหลดค่าที่บันทึกไว้ไม่สำเร็จ: ${(e as Error).message}`;
    }
  }
  applyAnimTuning(saved);
  const camR = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
  const camU = new THREE.Vector3().crossVectors(camR, ISO_DIR.clone().negate()).normalize();
  /** How long a step of the world looks on screen at this facing, sideways = 1 (the camera looks down at ~46°). */
  const screenFactor = (d: [number, number]) => {
    const v = new THREE.Vector3(d[0], 0, d[1]).normalize();
    return Math.hypot(v.dot(camR), v.dot(camU));
  };
  const cellDir = (i: number): ScreenDir => {
    const d = DIRS[i]!;
    return screenDirOf((d[0] - d[1]) * Math.SQRT1_2, (-d[0] - d[1]) * Math.SQRT1_2);
  };
  /** The tuning key of what is shown, or null when it can't be tuned as one animation (the combo). */
  const tuneKey = (): string | null => (state.anim === 'combo' ? null : animKey(state.cls, state.art, state.anim));
  const dirTune = (key: string, d: ScreenDir): DirTune => ({ ...currentAnimTuning()[key]?.[d] });
  const tuneBox = h('div');
  const saveOut = h('div', { class: 'note' });
  const drawSaveState = (msg?: string, cls = '') => {
    const dirty = !sameAnimTuning(currentAnimTuning(), saved);
    saveOut.className = msg ? cls : dirty ? 'dirty' : 'saved';
    saveOut.textContent = msg ?? (dirty ? 'มีค่าที่ยังไม่บันทึก (เห็นเฉพาะที่นี่)' : 'ตรงกับค่าที่บันทึกไว้ทั้งเซิร์ฟ');
  };
  const sumOf = (t: DirTune | undefined): string => {
    if (!t) return '';
    const out: string[] = [];
    if (t.row) out.push(TUNE_ROW_NAME[t.row]);
    if (t.flip !== undefined) out.push(t.flip ? 'พลิก' : 'ไม่พลิก');
    if (t.rate !== undefined) out.push(`เร็ว×${t.rate}`);
    if (t.x !== undefined || t.y !== undefined) out.push(`เลื่อน ${t.x ?? 0},${t.y ?? 0}`);
    if (t.scale !== undefined) out.push(`ขนาด×${t.scale}`);
    return out.join(' ');
  };
  const isMoving = () => state.anim === 'run' || state.anim === 'run_attack' || state.anim.startsWith('ride');
  const shownAnims = () => {
    const a = cells.find((c) => c?.actor)?.actor;
    return a ? animsOf(a).filter((n) => n !== 'combo') : [];
  };
  drawTune = () => {
    const key = tuneKey();
    if (!key) {
      tuneBox.replaceChildren(h('div', { class: 'note' }, 'คอมโบเล่นโจมตี 1–3 ต่อกัน: เลือกท่าโจมตีทีละท่าเพื่อปรับ'));
      return;
    }
    const d = cellDir(state.sel);
    const t = dirTune(key, d);
    const setT = (next: DirTune) => {
      setAnimDirTune(key, d, checkAnimTuning({ [key]: { [d]: next } }, false).tuning?.[key]?.[d]);
      drawTune();
      drawSaveState();
    };
    const rig = state.art === 'rig';
    const set = shownSet;
    const rows = (set?.manifest.animations[state.anim]?.directions ?? set?.manifest.directions ?? [])
      .filter((r): r is (typeof ANIM_ROWS)[number] => (ANIM_ROWS as readonly string[]).includes(r));
    const num = (field: keyof typeof ANIM_TUNE_RANGE, label: string, def: number) => {
      const r = ANIM_TUNE_RANGE[field];
      const cur = t[field] ?? def;
      const out = h('span', {}, String(cur));
      return h('div', { class: 'row' }, label, h('span', {}, h('input', {
        type: 'range', min: String(r.min), max: String(r.max), step: String(r.step), value: String(cur),
        oninput: (e: Event) => { out.textContent = (e.target as HTMLInputElement).value; },
        onchange: (e: Event) => setT({ ...t, [field]: Number((e.target as HTMLInputElement).value) }),
      }), ' ', out));
    };
    const moving = isMoving();
    tuneBox.replaceChildren(
      h('div', { class: 'row' }, `ทิศที่ปรับ ${DIR_ARROW[state.sel]}`, h('span', { class: 'note' }, 'คลิกช่องทางขวาเพื่อเลือกทิศ')),
      ...(rig ? [h('div', { class: 'note' }, 'นักดาบกระดูกปรับได้แค่ความเร็ว (ท่าตาย/ขี่ของมันใช้ภาพนักดาบตามสวิตช์ภาพของเซิร์ฟ ปรับที่ "ภาพเดิม" หรือ "ภาพกระดาษ")')] : [
        h('div', { class: 'row' }, 'แถวภาพ', h('select', {
          onchange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; setT({ ...t, row: v ? (v as DirTune['row']) : undefined }); },
        }, h('option', { value: '', selected: !t.row }, 'อัตโนมัติ'), ...rows.map((r) => h('option', { value: r, selected: t.row === r }, TUNE_ROW_NAME[r])))),
        h('div', { class: 'row' }, 'พลิกภาพ', h('select', {
          onchange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; setT({ ...t, flip: v === '' ? undefined : v === '1' }); },
        }, h('option', { value: '', selected: t.flip === undefined }, 'อัตโนมัติ'), h('option', { value: '1', selected: t.flip === true }, 'พลิก'), h('option', { value: '0', selected: t.flip === false }, 'ไม่พลิก'))),
      ]),
      num('rate', moving ? 'ความเร็วก้าว ×' : 'ความเร็วเล่น ×', 1),
      ...(rig ? [] : [num('x', 'เลื่อนขวา (หน่วย)', 0), num('y', 'เลื่อนขึ้น (หน่วย)', 0), num('scale', 'ขนาด ×', 1)]),
      h('div', { class: 'row', style: 'flex-wrap: wrap; justify-content: flex-start' },
        h('button', { onclick: () => setT({}) }, 'ล้างทิศนี้'),
        h('button', {
          onclick: () => {
            for (const n of shownAnims()) setAnimDirTune(animKey(state.cls, state.art, n), d, Object.keys(t).length ? { ...t } : undefined);
            drawTune();
            drawSaveState();
          },
        }, 'ใช้ค่าทิศนี้กับทุกท่า'),
        ...(moving ? [h('button', {
          onclick: () => {
            // Every moving animation of this class and picture set at once: run and run_attack share one stride, so
            // different speeds would make the legs jump when firing starts.
            const keys = shownAnims().filter((n) => n === 'run' || n === 'run_attack' || n.startsWith('ride')).map((n) => animKey(state.cls, state.art, n));
            for (const k of keys) DIRS.forEach((w, i) => {
              if (!w) return;
              const dd = cellDir(i);
              const f = Math.round(screenFactor(w) * 100) / 100;
              setAnimDirTune(k, dd, checkAnimTuning({ [k]: { [dd]: { ...dirTune(k, dd), rate: f } } }, false).tuning?.[k]?.[dd]);
            });
            drawTune();
            drawSaveState();
          },
        }, 'ตั้งความเร็วก้าวตามมุมกล้อง (ทุกทิศ ทุกท่าที่เคลื่อนที่)')] : []),
      ),
      ...(moving ? [h('div', { class: 'note' }, `บนจอ วิ่งขึ้น/ลงเห็นระยะแค่ ×${screenFactor([1, 1]).toFixed(2)} ของวิ่งด้านข้าง ทแยง ×${screenFactor([1, 0]).toFixed(2)} · ปุ่มมุมกล้องตั้งความเร็วก้าวตามนั้นให้เท้าไม่ไถล`)] : []),
      ...(state.anim.startsWith('attack') ? [h('div', { class: 'note' }, 'ท่าโจมตี: เร็ว/ช้าลงแค่ภาพ จังหวะตีจริงในเกมเท่าเดิม')] : []),
    );
  };
  const doSave = async (what: AnimTuning | 'reset') => {
    if (!io) return;
    try {
      const r = await io.save(what);
      saved = checkAnimTuning(r.tuning, false).tuning ?? {};
      applyAnimTuning(saved);
      drawTune();
      drawSaveState('บันทึกแล้ว ทุกคนในเกมเห็นทันที', 'saved');
    } catch (e) {
      drawSaveState(`บันทึกไม่สำเร็จ: ${(e as Error).message}`, 'err');
    }
  };
  panel.append(
    h('h2', {}, 'ปรับค่าต่อทิศ'),
    h('div', { class: 'note' }, `ค่าแยกต่อ อาชีพ × ภาพ × ท่า × ทิศ · ลองที่นี่เห็นทันทีเฉพาะหน้านี้ ${canEdit ? 'จนกว่าจะกด "บันทึกทั้งเซิร์ฟ"' : '(บันทึกทั้งเซิร์ฟได้เฉพาะเจ้าของ)'}`),
    tuneBox,
    h('div', { class: 'row', style: 'flex-wrap: wrap; justify-content: flex-start; margin-top: 8px' },
      ...(canEdit ? [h('button', { onclick: () => void doSave(currentAnimTuning()) }, 'บันทึกทั้งเซิร์ฟ')] : []),
      h('button', { onclick: () => { applyAnimTuning(saved); drawTune(); drawSaveState(); } }, 'กลับไปค่าที่บันทึกไว้'),
      ...(canEdit ? [h('button', { onclick: () => { if (confirm('ล้างค่าที่ปรับทั้งหมดของทุกอาชีพ กลับไปตามโค้ด และบันทึกทั้งเซิร์ฟ?')) void doSave('reset'); } }, 'คืนค่าเริ่มต้นทั้งหมด')] : []),
    ),
    saveOut,
  );
  drawSaveState();
  viewEl.addEventListener('click', (e) => {
    const r = viewEl.getBoundingClientRect();
    const i = Math.floor(((e.clientY - r.top) / r.height) * 3) * 3 + Math.floor(((e.clientX - r.left) / r.width) * 3);
    if (DIRS[i]) {
      state.sel = i;
      drawTune();
    }
  });

  /** fps of what an AnimatedActor shows now, times the stride for the run cycle. */
  function setFps(a: AnimatedActor): number | null {
    const name = a.shownAnim;
    const set = cellsSet();
    const def = set?.manifest.animations[name];
    if (!def) return null;
    const run = name === 'run' || name === 'run_attack' || name === 'walk';
    return def.fps * (run ? strideRate(state.move) : 1);
  }
  let shownSet: AnimSet | null = null;
  const cellsSet = () => shownSet;
  const refreshSet = async () => {
    shownSet = await setOf(state.cls, state.art === 'paper');
  };

  // ---- layout: a 3×3 grid of square-ish cells
  let cellW = 1;
  let cellH = 1;
  function layout(): void {
    const w = Math.max(1, viewEl.clientWidth);
    const hh = Math.max(1, viewEl.clientHeight);
    renderer.setSize(w, hh);
    cellW = w / 3;
    cellH = hh / 3;
    const half = state.zoom / 2;
    camera.left = (-half * cellW) / cellH;
    camera.right = (half * cellW) / cellH;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    cells.forEach((c, i) => {
      if (!c) return;
      c.label.style.left = `${(i % 3) * cellW + 4}px`;
      c.label.style.top = `${Math.floor(i / 3) * cellH + 4}px`;
    });
    Object.assign(mid.style, { left: `${cellW}px`, top: `${cellH}px`, width: `${cellW}px`, height: `${cellH}px` });
  }
  const ro = new ResizeObserver(layout);
  ro.observe(viewEl);
  layout();

  // ---- playing: attacks replay every so often; the combo plays the three swings in a row; death replays.
  let clock = 0;
  let nextAt = 0;
  let comboStep = 0;
  function restart(): void {
    void refreshSet().then(() => drawTune());
    for (const c of cells) c?.actor?.reset();
    nextAt = clock;
    comboStep = 0;
  }
  const tick = () => {
    const anim = state.anim;
    if (anim === 'idle' || anim === 'run' || anim.startsWith('ride')) return;
    if (clock < nextAt) return;
    let name = anim;
    let gap = 1;
    if (anim === 'combo') {
      name = (['attack', 'attack_2', 'attack_3'] as const)[comboStep++ % 3];
      gap = comboStep % 3 === 0 ? 1.2 : 0.55;
    } else if (anim === 'run_attack') {
      name = 'attack';
      gap = 0.45;
    } else if (anim === 'death') {
      for (const c of cells) c?.actor?.reset();
      gap = 2.2;
    }
    for (const c of cells) c?.actor?.play(name, anim === 'death' ? { hold: true } : {});
    nextAt = clock + gap;
  };

  let stopped = false;
  let last = performance.now();
  const frame = (now: number) => {
    if (stopped) return;
    requestAnimationFrame(frame);
    const real = Math.min(0.1, (now - last) / 1000);
    last = now;
    const dt = state.paused ? stepDt : real * state.speed;
    stepDt = 0;
    clock += dt;
    tick();
    const anim = state.anim;
    const ride = anim.startsWith('ride') ? anim : null;
    const moving = anim === 'run' || anim === 'run_attack' || (!!ride && state.rideMove);
    const rate = strideRate(state.move);
    strideOut.textContent = `จังหวะก้าววิ่ง ×${rate.toFixed(2)} ของที่วาด (เกมจำกัด ×0.6–×1.6)`;
    const tunings = currentAnimTuning();
    for (const c of cells) {
      if (!c) continue;
      const a = c.actor;
      const len = Math.hypot(c.dir[0], c.dir[1]);
      if (moving && state.ground) {
        c.slide.position.x = (((c.slide.position.x - (c.dir[0] / len) * state.move * dt) % TILE) + TILE) % TILE;
        c.slide.position.z = (((c.slide.position.z - (c.dir[1] / len) * state.move * dt) % TILE) + TILE) % TILE;
      }
      c.scene.getObjectByName('line')!.visible = state.line;
      if (!a) continue;
      a.face(c.dir[0], c.dir[1]);
      a.setStride?.(rate);
      a.setRide?.(ride);
      a.update(dt, moving);
      const d = a instanceof AnimatedActor ? a.drawnFrame : null;
      const key = tuneKey();
      const sum = key ? sumOf(tunings[key]?.[cellDir(cells.indexOf(c))]) : '';
      const text = d ? `${c.arrow} ${ROW_NAME[d.dir] ?? d.dir}${d.flip ? ' (พลิก)' : ''} · เฟรม ${d.frame + 1}/${d.frames}` : c.arrow;
      if (c.label.dataset.text !== text + sum) {
        c.label.dataset.text = text + sum;
        c.label.replaceChildren(text, ...(sum ? [h('span', { class: 'tune-sum' }, ` · ${sum}`)] : []));
      }
      c.label.classList.toggle('sel', cells.indexOf(c) === state.sel);
    }
    const fullH = viewEl.clientHeight;
    cells.forEach((c, i) => {
      if (!c) return;
      const x = (i % 3) * cellW;
      const yTop = Math.floor(i / 3) * cellH;
      const y = fullH - yTop - cellH;
      renderer.setViewport(x, y, cellW, cellH);
      renderer.setScissor(x + 1, y + 1, cellW - 2, cellH - 2);
      renderer.render(c.scene, camera);
    });
  };
  await rebuild();
  requestAnimationFrame(frame);

  return () => {
    stopped = true;
    ro.disconnect();
    for (const c of cells) c?.actor?.dispose();
    for (const d of disposables) d.dispose();
    groundMat.map?.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
