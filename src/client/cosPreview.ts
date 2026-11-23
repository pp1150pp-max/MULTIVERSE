// Cosmetics test bench: a character wearing a chosen cosmetic in each slot, turned to any of the 8
// directions or walked around, plus sliders for each worn piece's placement and look (the tuning in
// src/shared/cosTuning.ts). Uses the game's own character views, so it looks like the game. Shown in
// the /admin "ของแต่งตัว" tab (owner + GM, the `cosPreview` switch in FEATURE_ROLES); saving the tuning
// for the whole server is the `cosLook` switch (owner only). Loaded only when the tab opens.
import * as THREE from 'three';
import { assetSources, cosOneKey, loadGameAssets, groundTiles } from './assets';
import { Effects } from './effects';
import { PlayerView } from './views';
import { ISO_DIR } from './world';
import { applyCosTuning, cosTune, currentCosTuning, resetCosTune, setCosTuneValue } from './cosTune';
import { axisHiddenInDir, checkCosTuning, COS_AXES, COS_TUNE_FIELDS, cosTuneOf, dirFieldKey, isPerFacingKey, partOfView, savePartOf, TUNED_SLOTS, valueAtDir, VIEW_DIR_NAME, VIEW_DIRS, viewOffKey, WING_ONE_DIR_FIELDS, type AxisSpec, type CosTuning, type TunedSlot, type ViewDir } from '../shared/cosTuning';
import { COSMETICS, COS_SLOTS, COS_SLOT_NAME, cosById, MOUNT_SPEED, type CosSlot, type CosWorn } from '../shared/data/cosmetics';
import { Player } from '../shared/sim/Player';
import type { Sim } from '../shared/sim/Sim';
import { CLASS_IDS } from '../shared/data/classes';
import { BASE_MOVE_SPEED } from '../shared/formulas';
import type { ClassId } from '../shared/types';

const NO_SIM = null as unknown as Sim;

const CSS = `
.cosp { --cosp-w: min(400px, 55%); position: relative; overflow: hidden; background: #10131a; color: #e8e4d8; font: 13px/1.4 system-ui, sans-serif; }
.cosp .cosp-view { position: absolute; top: 0; bottom: 0; left: 0; right: var(--cosp-w); }
.cosp .cosp-view canvas { display: block; }
.cosp .cosp-panel { position: absolute; top: 0; right: 0; bottom: 0; width: var(--cosp-w); display: flex; flex-direction: column;
  background: #161a24; border-left: 1px solid #3a4152; box-sizing: border-box; }
.cosp .tabs { display: flex; flex-wrap: wrap; gap: 2px; padding: 6px 6px 0; border-bottom: 1px solid #3a4152; }
.cosp .tabs button { margin: 0; border-radius: 4px 4px 0 0; }
.cosp .tabs button.on { background: #4a5a80; border-color: #8fa8e0; }
.cosp .tabs button.off { opacity: 0.45; }
.cosp .body { flex: 1; overflow: auto; padding: 8px 10px; }
.cosp .bar { border-top: 1px solid #3a4152; padding: 6px 10px; background: #1b2030; }
.cosp button.save { background: #2f5a3a; border-color: #5aa070; font-weight: bold; }
.cosp button:disabled { opacity: 0.5; cursor: default; }
.cosp h1 { font-size: 15px; margin: 0 0 6px; }
.cosp h2 { font-size: 12px; margin: 10px 0 4px; color: #f2d58a; }
.cosp details { border: 1px solid #2c3343; border-radius: 4px; padding: 4px 6px; margin: 8px 0; }
.cosp summary { cursor: pointer; color: #f2d58a; }
.cosp .row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin: 3px 0; }
.cosp .row label { flex: 1; min-width: 0; }
.cosp .row > span, .cosp .row > select, .cosp .row > input { flex-shrink: 0; }
.cosp select, .cosp textarea { background: #1d2230; color: inherit; border: 1px solid #3a4152; border-radius: 3px; padding: 2px 4px; font: inherit; }
.cosp .grp { margin: 10px 0 2px; color: #f2d58a; font-size: 12px; border-bottom: 1px solid #2c3343; }
.cosp .fld { margin: 3px 0; }
.cosp .fld .lb { font-size: 12px; color: #c8c4b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cosp .ct { display: flex; align-items: center; gap: 3px; }
.cosp .fld input[type=range] { flex: 1; min-width: 60px; }
.cosp .fld button { margin: 0; padding: 1px 7px; }
.cosp .fld .undo { visibility: hidden; }
.cosp .fld.changed .undo { visibility: visible; }
.cosp .fld.changed .val, .cosp .fld.changed label { color: #7fd0ff; }
.cosp .val { width: 64px; text-align: right; }
.cosp .badge { display: inline-block; font-size: 10px; padding: 0 4px; margin-right: 4px; border-radius: 3px; background: #5a4a20; color: #ffe39a; }
.cosp button { background: #2a3245; color: inherit; border: 1px solid #4a5570; border-radius: 3px; padding: 3px 6px; margin: 2px 2px 2px 0; cursor: pointer; font: inherit; }
.cosp button:hover:not(:disabled) { background: #36405a; }
.cosp .dirs { display: grid; grid-template-columns: repeat(3, 52px); gap: 3px; margin: 4px 0; }
.cosp .dirs button { margin: 0; padding: 5px 0; position: relative; }
.cosp .dirs button.mid { font-size: 11px; }
.cosp .dirs button.on { background: #4a5a80; border-color: #8fa8e0; }
.cosp .dirs button.cur { box-shadow: inset 0 -2px 0 #f2d58a; }
.cosp .dirs button.has::after { content: '•'; position: absolute; top: -3px; right: 4px; color: #7fd0ff; font-size: 16px; }
.cosp .note { color: #9aa3b8; font-size: 11px; margin: 4px 0; }
.cosp .title-prev { display: inline-block; margin: 4px 0; padding: 6px 10px; border-radius: 6px; border: 2px solid var(--c1); background: var(--c2); }
.cosp .title-prev .n { font-weight: bold; color: var(--c1); }
.cosp .title-prev .b { margin-top: 4px; padding: 3px 8px; border-radius: 10px; background: #fff; color: #222; border: 2px solid var(--c1); }
.cosp .modal { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 5; }
.cosp .modal > div { background: #1b2030; border: 1px solid #4a5570; border-radius: 6px; padding: 12px; width: min(620px, 92%); max-height: 80%; display: flex; flex-direction: column; box-sizing: border-box; }
.cosp .modal .list { overflow: auto; flex: 1; margin: 6px 0; border: 1px solid #2c3343; padding: 4px 6px; }
.cosp .modal .list label { display: block; padding: 2px 0; }
`;

/**
 * The server-wide tuning on the admin page: read it, and (owner only) save it. Each call returns the
 * server's tuning after it, or throws with a message.
 */
export interface CosLookServer {
  load(): Promise<{ tuning: CosTuning; canEdit: boolean }>;
  save(tuning: CosTuning | 'reset'): Promise<{ tuning: CosTuning; canEdit: boolean }>;
}

/**
 * The 8 facings, as screen directions (x right, y up), in the order of a 3×3 grid (the middle is the
 * "turn around by itself" switch). Screen up is −x −z and screen right is +x −z with this camera.
 */
const DIRS: { label: string; sx: number; sy: number; name: string }[] = [
  { label: '↖', sx: -1, sy: 1, name: 'หลังเฉียงซ้าย' },
  { label: '↑', sx: 0, sy: 1, name: 'หันหลัง' },
  { label: '↗', sx: 1, sy: 1, name: 'หลังเฉียงขวา' },
  { label: '←', sx: -1, sy: 0, name: 'หันซ้าย' },
  { label: '', sx: 0, sy: 0, name: '' },
  { label: '→', sx: 1, sy: 0, name: 'หันขวา' },
  { label: '↙', sx: -1, sy: -1, name: 'หน้าเฉียงซ้าย' },
  { label: '↓', sx: 0, sy: -1, name: 'หันหน้า' },
  { label: '↘', sx: 1, sy: -1, name: 'หน้าเฉียงขวา' },
];
/** The 8 real facings in turning order (for "turn by itself"). */
const SPIN = [7, 8, 5, 2, 1, 0, 3, 6];

const worldDir = (sx: number, sy: number): [number, number] => {
  const x = (sx - sy) * Math.SQRT1_2;
  const z = (-sx - sy) * Math.SQRT1_2;
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
};

/** The 8 facings, and the facing button (DIRS index) each one turns the character to. */
const VIEW_DIR_BUTTON: Record<ViewDir, number> = { front: 7, frontRight: 8, right: 5, backRight: 2, back: 1, backLeft: 0, left: 3, frontLeft: 6 };
/** The facing of a facing button (DIRS index). */
const dirOfButton = (i: number): ViewDir => VIEW_DIRS.find((d) => VIEW_DIR_BUTTON[d] === i) ?? 'front';
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Wings drawn from a single-wing picture (wingPair.ts, all 5 wings since 2026-11-12) don't read the old pair
 * picture's fields: hidden on the bench for them (owner 2026-11-23; saved values are kept, the game ignores them).
 */
const PAIR_ONLY = new Set(['h', 'root', 'backStand', 'backSeat', 'back', 'shift', 'depth', 'overBack', 'nearSide', 'nearFrontDiag', 'nearBackDiag', 'nearCut', 'nearDepth']);
/** Their base Y (every facing) is the single wing's root height; X/Z have only the per-facing offsets. */
const ONE_WING_AXES: AxisSpec[] = [
  { axis: 'y', key: 'oneBack', sign: 1, label: 'Y ความสูงโคนปีก (ตอนยืน)' },
  { axis: 'y', key: 'oneBackSeat', sign: 1, label: 'Y ความสูงโคนปีก (ตอนขี่ จากอาน)', ride: true },
];

/** The panel's tabs: the character, one per kind of piece, and the rest (owner 2026-11-23). */
type Tab = 'char' | TunedSlot | 'more';
/** Slider groups on a piece's tab, in order; a field not listed below goes in the last one. */
const GROUP_ORDER = ['ตำแหน่ง', 'ขนาดและรูปทรง', 'การวาดหน้า/หลัง', 'การขยับ', 'อื่น ๆ'];
const GROUP_OF: Record<string, string> = {
  h: 'ขนาดและรูปทรง', root: 'ขนาดและรูปทรง', oneSize: 'ขนาดและรูปทรง', oneTilt: 'ขนาดและรูปทรง', oneSqueeze: 'ขนาดและรูปทรง',
  riderSword: 'ขนาดและรูปทรง', riderMage: 'ขนาดและรูปทรง', riderGunslinger: 'ขนาดและรูปทรง',
  size: 'ขนาดและรูปทรง', alpha: 'ขนาดและรูปทรง', sparkSize: 'ขนาดและรูปทรง', stepSize: 'ขนาดและรูปทรง',
  depth: 'การวาดหน้า/หลัง', overBack: 'การวาดหน้า/หลัง', oneDepth: 'การวาดหน้า/หลัง', nearSide: 'การวาดหน้า/หลัง', nearFrontDiag: 'การวาดหน้า/หลัง',
  nearBackDiag: 'การวาดหน้า/หลัง', nearCut: 'การวาดหน้า/หลัง', nearDepth: 'การวาดหน้า/หลัง', front: 'การวาดหน้า/หลัง', cutFrontDiag: 'การวาดหน้า/หลัง',
  cutSide: 'การวาดหน้า/หลัง', cutBackDiag: 'การวาดหน้า/หลัง', splitFront: 'การวาดหน้า/หลัง', frontDiag: 'การวาดหน้า/หลัง', behind: 'การวาดหน้า/หลัง',
  under: 'การวาดหน้า/หลัง', underBehind: 'การวาดหน้า/หลัง',
  headOnLift: 'ตำแหน่ง', fly: 'ตำแหน่ง', standFront: 'ตำแหน่ง', frontDist: 'ตำแหน่ง', frontSide: 'ตำแหน่ง',
  flap: 'การขยับ', flapWalk: 'การขยับ', anim: 'การขยับ', bob: 'การขยับ', pulse: 'การขยับ', sparks: 'การขยับ', stepEvery: 'การขยับ',
};
const groupOf = (key: string): string => GROUP_OF[key] ?? 'อื่น ๆ';
/** A shorter name for the slider (the full one shows on hover). */
const shortLabel = (label: string): string => label.replace(/^ปีกข้างเดียว: /, '');

const state = {
  /** The facing the position sliders edit: '' = every facing (the base value), else one of the 8. */
  view: '' as ViewDir | '',
  cls: 'sword' as ClassId,
  worn: { wings: 'wings_angel', mount: 'mount_wolf', pet: 'pet_slime', aura: 'aura_star' } as CosWorn,
  riding: false,
  walk: false,
  spin: false,
  dir: 7,
  zoom: 9,
  /** The panel's open tab. */
  tab: 'char' as Tab,
  /** The "used by every facing" box under a picked facing is open. */
  sharedOpen: false,
};

/** Builds the test bench inside `root` (which should have a size) and starts it. Returns a function that stops it and frees everything. */
export async function mountCosPreview(root: HTMLElement, note: string, server?: CosLookServer): Promise<() => void> {
  if (!document.getElementById('cosp-css')) {
    const st = document.createElement('style');
    st.id = 'cosp-css';
    st.textContent = CSS;
    document.head.append(st);
  }
  root.classList.add('cosp');
  const viewEl = document.createElement('div');
  viewEl.className = 'cosp-view';
  const panel = document.createElement('div');
  panel.className = 'cosp-panel';
  const tabsEl = document.createElement('div');
  tabsEl.className = 'tabs';
  const bodyEl = document.createElement('div');
  bodyEl.className = 'body';
  bodyEl.textContent = 'กำลังโหลด…';
  const barEl = document.createElement('div');
  barEl.className = 'bar';
  panel.append(tabsEl, bodyEl, barEl);
  /** The tab the panel was last built for (the scroll position is kept within a tab). */
  let builtTab: Tab | null = null;
  root.replaceChildren(viewEl, panel);

  // The server's tuning: the bench starts from it, and the owner can save over it.
  let serverTuning: CosTuning | null = null;
  let canEdit = false;
  let serverMsg = '';
  if (server) {
    try {
      const r = await server.load();
      serverTuning = r.tuning;
      canEdit = r.canEdit;
    } catch (e) {
      serverMsg = `โหลดค่าของเซิร์ฟไม่สำเร็จ: ${(e as Error).message}`;
    }
  }
  applyCosTuning(serverTuning ?? {});

  await loadGameAssets();
  let stopped = false;
  const cleanups: (() => void)[] = [];
  const listen = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void) => {
    window.addEventListener(type, fn);
    cleanups.push(() => window.removeEventListener(type, fn));
  };

  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Like the game: a mount on the front diagonal is cut in two around its rider (cosmeticViews.ts).
  renderer.localClippingEnabled = true;
  viewEl.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2b3a2a');
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const resize = () => {
    const w = Math.max(1, viewEl.clientWidth);
    const hh = Math.max(1, viewEl.clientHeight);
    renderer.setSize(w, hh);
    const aspect = w / hh;
    const h = state.zoom / 2;
    camera.left = -h * aspect;
    camera.right = h * aspect;
    camera.top = h;
    camera.bottom = -h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(viewEl);
  cleanups.push(() => ro.disconnect());
  resize();
  const camTarget = new THREE.Vector3(0, 0.9, 0);
  const placeCamera = () => {
    camera.position.copy(camTarget).addScaledVector(ISO_DIR, 80);
    camera.lookAt(camTarget);
  };
  placeCamera();

  // Walking like in the game: WASD / arrow keys, or click the ground to walk there.
  const keys = new Set<string>();
  const typing = () => document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement || document.activeElement instanceof HTMLTextAreaElement;
  listen('keydown', (e) => {
    if (!typing()) keys.add(e.code);
  });
  listen('keyup', (e) => keys.delete(e.code));
  listen('blur', () => keys.clear());
  let walkTo: THREE.Vector3 | null = null;
  const ray = new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown', (e) => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const rc = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1), camera);
    const hit = ray.intersectObject(ground)[0];
    if (hit) {
      walkTo = hit.point.clone();
      stopAutoMoves();
    }
  });

  const tile = groundTiles.grass;
  const groundMat = new THREE.MeshBasicMaterial({ color: tile ? '#ffffff' : '#3d5a36' });
  if (tile) {
    const t = tile.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(30, 30);
    t.needsUpdate = true;
    groundMat.map = t;
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), groundMat);
  ground.renderOrder = -2;
  scene.add(ground);

  const fx = new Effects(scene);
  let hero = makePlayer();
  let heroView = new PlayerView(hero, scene);

  function makePlayer(): Player {
    const p = new Player(1, NO_SIM, { name: 'P1', classId: state.cls, level: 30, exp: 0, gold: 0, equipment: {}, bag: [] });
    dress(p);
    face(p, state.dir);
    return p;
  }

  function dress(p: Player): void {
    p.cosmetics = { ...state.worn };
    p.mounted = state.riding && !!state.worn.mount;
  }

  function face(p: Player, i: number): void {
    const [x, z] = worldDir(DIRS[i].sx, DIRS[i].sy);
    p.faceX = x;
    p.faceZ = z;
  }

  function rebuildHero(): void {
    const { x, z, faceX, faceZ } = hero;
    heroView.dispose();
    hero = makePlayer();
    Object.assign(hero, { x, z, faceX, faceZ });
    heroView = new PlayerView(hero, scene);
  }

  /** Walking by hand (keys or a click) stops the circle walk and the turning. */
  function stopAutoMoves(): void {
    if (!state.walk && !state.spin) return;
    state.walk = state.spin = false;
    buildPanel();
  }

  let dirButtons: HTMLButtonElement[] = [];
  /** Puts the grid's dots on the facings that have their own values (set by the open piece's tab). */
  let refreshDots = () => {};
  const markDir = () => dirButtons.forEach((b, i) => b.classList.toggle('cur', i === state.dir));
  buildPanel();

  let last = performance.now();
  let t = 0;
  let spinT = 0;
  // For checks while the pane is hidden (no animation frames): window.cosPreview.step(n) runs n frames.
  (window as unknown as { cosPreview: object }).cosPreview = {
    step(n: number): void {
      for (let i = 0; i < n; i++) frame(last + 1000 / 60);
    },
  };
  let raf = 0;
  const loop = (now: number) => {
    if (stopped) return;
    frame(now);
    raf = requestAnimationFrame(loop);
  };
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    let mx = 0;
    let mz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) { mx -= 1; mz -= 1; }
    if (keys.has('KeyS') || keys.has('ArrowDown')) { mx += 1; mz += 1; }
    if (keys.has('KeyD') || keys.has('ArrowRight')) { mx += 1; mz -= 1; }
    if (keys.has('KeyA') || keys.has('ArrowLeft')) { mx -= 1; mz += 1; }
    if (mx || mz) {
      walkTo = null;
      stopAutoMoves();
    } else if (walkTo) {
      mx = walkTo.x - hero.x;
      mz = walkTo.z - hero.z;
      if (Math.hypot(mx, mz) < 0.1) {
        walkTo = null;
        mx = mz = 0;
      }
    }
    const speed = BASE_MOVE_SPEED * (hero.mounted ? MOUNT_SPEED : 1);
    if ((mx || mz) && hero.alive) {
      const len = Math.hypot(mx, mz);
      const step = Math.min(speed * dt, walkTo ? len : Infinity);
      hero.x += (mx / len) * step;
      hero.z += (mz / len) * step;
      hero.faceX = mx / len;
      hero.faceZ = mz / len;
      hero.moving = true;
    } else if (state.walk && hero.alive) {
      const a = t * 0.6;
      hero.x = Math.cos(a) * 3;
      hero.z = Math.sin(a) * 3;
      hero.faceX = -Math.sin(a);
      hero.faceZ = Math.cos(a);
      hero.moving = true;
    } else {
      hero.moving = false;
      if (state.spin) {
        spinT += dt;
        if (spinT >= 1) {
          spinT = 0;
          state.dir = SPIN[(SPIN.indexOf(state.dir) + 1) % SPIN.length];
          face(hero, state.dir);
          markDir();
        }
      }
    }
    heroView.update(dt, fx);
    const k = 1 - Math.exp(-dt * 8);
    camTarget.x += (hero.x - camTarget.x) * k;
    camTarget.z += (hero.z - camTarget.z) * k;
    placeCamera();
    fx.update(dt);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);


  /** Every value the bench shows that differs from the server's saved one (what the save button would save). */
  function pendingChanges(): { id: string; key: string; text: string }[] {
    const now = checkCosTuning(currentCosTuning(), false).tuning ?? {};
    const saved = serverTuning ?? {};
    const out: { id: string; key: string; text: string }[] = [];
    for (const c of COSMETICS) {
      const a = cosTuneOf(saved, c.id);
      const b = cosTuneOf(now, c.id);
      if (!a || !b) continue;
      const fields = COS_TUNE_FIELDS[c.slot as TunedSlot];
      for (const k of Object.keys(a)) {
        if (a[k] === b[k]) continue;
        const show = (v: number | boolean) => (typeof v === 'boolean' ? (v ? 'เปิด' : 'ปิด') : String(v));
        out.push({ id: c.id, key: k, text: `${c.name} · ${fields[k]?.label ?? k}: ${show(a[k])} → ${show(b[k])}` });
      }
    }
    return out;
  }

  /** The save bar and the arrow grid's dots follow every change (a function declaration: buildPanel() calls it early). */
  function updateStatus(): void {
    refreshDots();
    barEl.innerHTML = '';
    const n = pendingChanges().length;
    const line = document.createElement('div');
    line.className = 'note';
    line.textContent = serverMsg || (!server ? 'หน้านี้ทดลองอย่างเดียว ไม่มีปุ่มบันทึกของเซิร์ฟ' : n ? `• ยังไม่ได้บันทึก ${n} ค่า` : '✓ ตรงกับค่าของเซิร์ฟ');
    barEl.append(line);
    if (server) {
      const save = document.createElement('button');
      save.className = 'save';
      save.textContent = `💾 บันทึกที่แก้ (${n} ค่า)`;
      save.disabled = !n || !canEdit;
      save.onclick = () => openSaveDialog();
      barEl.append(save);
    }
    const undo = document.createElement('button');
    undo.textContent = 'ยกเลิกที่แก้ทั้งหมด';
    undo.disabled = !n;
    undo.onclick = () => {
      applyCosTuning(serverTuning ?? {});
      buildPanel();
    };
    barEl.append(undo);
    if (server && !canEdit) {
      const g = document.createElement('div');
      g.className = 'note';
      g.textContent = 'บันทึกค่าของเซิร์ฟได้เฉพาะเจ้าของ (GM ทดลองได้อย่างเดียว)';
      barEl.append(g);
    }
  }

  /**
   * Owner only: lists every changed value (all ticked), saves the ticked ones for the whole server. The rest
   * stays as last saved, and unticked changes stay tried out on the bench (savePartOf per piece).
   */
  function openSaveDialog(): void {
    if (!server) return;
    const list = pendingChanges();
    const modal = document.createElement('div');
    modal.className = 'modal';
    const box = document.createElement('div');
    modal.append(box);
    const title = document.createElement('h1');
    title.textContent = `บันทึกเป็นค่าเริ่มต้นทั้งเซิร์ฟ (${list.length} ค่า)`;
    const hint = document.createElement('div');
    hint.className = 'note';
    hint.textContent = 'ติ๊กค่าที่จะบันทึก ผู้เล่นที่ออนไลน์อยู่เห็นทันที · ค่าที่ไม่ติ๊กยังทดลองอยู่ในแท่น ไม่ถูกบันทึก';
    const items = document.createElement('div');
    items.className = 'list';
    const ticks = list.map((x) => {
      const l = document.createElement('label');
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.checked = true;
      l.append(c, ' ', x.text);
      items.append(l);
      return c;
    });
    const all = document.createElement('button');
    all.textContent = 'เลือกทั้งหมด / ไม่เลือก';
    all.onclick = () => {
      const on = !ticks.every((c) => c.checked);
      for (const c of ticks) c.checked = on;
    };
    const ok = document.createElement('button');
    ok.className = 'save';
    ok.textContent = '💾 บันทึกที่เลือก';
    const cancel = document.createElement('button');
    cancel.textContent = 'ยกเลิก';
    cancel.onclick = () => modal.remove();
    ok.onclick = async () => {
      const picked = new Set(list.filter((_, i) => ticks[i].checked).map((x) => `${x.id}\n${x.key}`));
      if (!picked.size) return;
      let next: CosTuning = serverTuning ?? {};
      for (const id of new Set(list.map((x) => x.id))) next = savePartOf(next, id, cosTune(id)!, (k) => picked.has(`${id}\n${k}`));
      ok.disabled = true;
      try {
        const r = await server.save(next);
        serverTuning = r.tuning;
        serverMsg = `✓ บันทึกแล้ว ${picked.size} ค่า ผู้เล่นที่ออนไลน์อยู่เห็นทันที`;
      } catch (e) {
        serverMsg = `บันทึกไม่สำเร็จ: ${(e as Error).message}`;
      }
      modal.remove();
      buildPanel();
      serverMsg = '';
    };
    box.append(title, hint, items, all, ok, cancel);
    root.append(modal);
  }

  function buildPanel(): void {
    const scroll = bodyEl.scrollTop;
    const sameTab = builtTab === state.tab;
    builtTab = state.tab;
    tabsEl.innerHTML = '';
    bodyEl.innerHTML = '';
    refreshDots = () => {};
    const add = <T extends HTMLElement>(parent: HTMLElement, e: T): T => {
      parent.append(e);
      return e;
    };
    const h = (tag: string, text: string, parent: HTMLElement = bodyEl) => {
      const e = document.createElement(tag);
      e.textContent = text;
      return add(parent, e);
    };
    const row = (label: string, input: HTMLElement, parent: HTMLElement = bodyEl) => {
      const r = document.createElement('div');
      r.className = 'row';
      const l = document.createElement('label');
      l.textContent = label;
      // a checkbox goes inside its label, in front of the text (same line, click the text to tick)
      if (input instanceof HTMLInputElement && input.type === 'checkbox') { l.prepend(input, ' '); r.append(l); } else r.append(l, input);
      return add(parent, r);
    };
    const select = (opts: [string, string][], value: string, on: (v: string) => void) => {
      const s = document.createElement('select');
      for (const [v, text] of opts) s.append(new Option(text, v, false, v === value));
      s.onchange = () => on(s.value);
      return s;
    };
    const check = (value: boolean, on: (v: boolean) => void) => {
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.checked = value;
      c.onchange = () => on(c.checked);
      return c;
    };
    const button = (text: string, on: () => void, parent: HTMLElement = bodyEl) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = on;
      return add(parent, b);
    };
    const wornSelect = (slot: CosSlot) => {
      const opts: [string, string][] = [['', '— ไม่ใส่ —'], ...COSMETICS.filter((c) => c.slot === slot).map((c): [string, string] => [c.id, c.name])];
      return select(opts, state.worn[slot] ?? '', (v) => {
        if (v) state.worn[slot] = v;
        else delete state.worn[slot];
        if (slot === 'mount' && v) state.riding = true;
        dress(hero);
        buildPanel();
      });
    };

    // ---- tabs
    const tabs: [Tab, string][] = [['char', 'ตัวละคร'], ...TUNED_SLOTS.map((s): [Tab, string] => [s, COS_SLOT_NAME[s]]), ['more', 'อื่น ๆ']];
    for (const [t, name] of tabs) {
      const b = button(name, () => {
        state.tab = t;
        buildPanel();
      }, tabsEl);
      b.classList.toggle('on', t === state.tab);
      if (t !== 'char' && t !== 'more' && !state.worn[t]) {
        b.classList.add('off');
        b.title = 'ยังไม่ได้สวม';
      }
    }

    if (state.tab === 'char') buildCharTab();
    else if (state.tab === 'more') buildMoreTab();
    else buildPieceTab(state.tab);
    if (sameTab) bodyEl.scrollTop = scroll;
    updateStatus();

    function buildCharTab(): void {
      h('div', note).className = 'note';
      h('h2', 'ตัวละครและของที่สวม');
      row('อาชีพ', select(CLASS_IDS.map((c) => [c, c]), state.cls, (v) => {
        state.cls = v as ClassId;
        rebuildHero();
      }));
      for (const slot of COS_SLOTS) {
        if (slot === 'orb') continue; // orb looks are made on the orb bench
        row(COS_SLOT_NAME[slot], wornSelect(slot));
      }
      if (state.worn.mount) row('ขี่สัตว์ขี่', check(state.riding, (v) => { state.riding = v; dress(hero); }));
      const title = cosById(state.worn.title);
      if (title) {
        // Name frames and chat bubbles are page text in the game (no 3D placement): shown here to look at only.
        const box = document.createElement('div');
        box.className = 'title-prev';
        box.style.setProperty('--c1', title.color);
        box.style.setProperty('--c2', title.color2);
        h('div', 'ชื่อตัวละคร', box).className = 'n';
        h('div', 'สวัสดี!', box).className = 'b';
        bodyEl.append(box);
        h('div', 'กรอบชื่อ/ฟองแชท: ดูได้อย่างเดียว ไม่มีค่าให้ปรับ').className = 'note';
      }
      h('h2', 'หันตัวและเดิน');
      dirGrid(undefined);
      moveRows();
      bodyEl.append(numField('ซูมกล้อง (เกมจริง 17)', '', 4, 17, 1, state.zoom, undefined, (v) => { state.zoom = v; resize(); }));
      h('div', 'เดิน: WASD / ลูกศร หรือคลิกที่พื้น').className = 'note';
    }

    function moveRows(): void {
      row('หมุนเองทีละทิศ (ทุก 1 วินาที)', check(state.spin, (v) => { state.spin = v; state.walk = false; buildPanel(); }));
      row('เดินเป็นวง', check(state.walk, (v) => {
        state.walk = v;
        state.spin = false;
        if (!v) hero.x = hero.z = 0;
        buildPanel();
      }));
      row('ตาย (ดูปีกจางหาย)', check(!hero.alive, (v) => {
        hero.alive = !v;
        if (v) heroView.onDied();
        else heroView.onRevived();
      }));
    }

    /**
     * One 3×3 grid for turning and for the facing the sliders edit (owner 2026-11-23): an arrow turns the
     * character and edits that facing, the middle edits every facing (the base values). Dots = facings with values of their own.
     */
    function dirGrid(id: string | undefined): void {
      const grid = document.createElement('div');
      grid.className = 'dirs';
      dirButtons = DIRS.map((d, i) => {
        const b = button(d.label || 'ทุกมุม', () => {
          if (!d.label) state.view = '';
          else {
            state.dir = i;
            state.view = dirOfButton(i);
            state.spin = state.walk = false;
            walkTo = null;
            face(hero, i);
          }
          buildPanel();
        }, grid);
        b.title = d.label ? `${d.name}: หันตัว + ปรับค่าเฉพาะทิศนี้` : 'ปรับค่าหลัก (ใช้ทุกทิศ)';
        b.classList.toggle('on', state.view ? VIEW_DIR_BUTTON[state.view] === i : !d.label);
        if (!d.label) b.classList.add('mid');
        return b;
      });
      bodyEl.append(grid);
      markDir();
      if (id) {
        refreshDots = () => {
          const v = cosTune(id);
          dirButtons.forEach((b, i) => {
            const dir = DIRS[i].label ? dirOfButton(i) : null;
            b.classList.toggle('has', !!dir && !!v && Object.entries(v).some(([k, x]) => k.endsWith(`_at_${dir}`) && typeof x === 'number' && x !== 0));
          });
        };
      }
    }

    function buildPieceTab(slot: TunedSlot): void {
      row(`${COS_SLOT_NAME[slot]}ที่สวม`, wornSelect(slot));
      const c = cosById(state.worn[slot]);
      if (!c) {
        h('div', 'ยังไม่ได้สวมชิ้นในช่องนี้ เลือกด้านบนเพื่อปรับค่า').className = 'note';
        return;
      }
      if ((slot === 'mount' || slot === 'wings') && state.worn.mount) row('ขี่สัตว์ขี่', check(state.riding, (v) => { state.riding = v; dress(hero); }));
      h('h2', 'ทิศที่ปรับ');
      dirGrid(c.id);
      row('หมุนเองทีละทิศ', check(state.spin, (v) => { state.spin = v; state.walk = false; buildPanel(); }));
      h('div', state.view
        ? `กำลังปรับ: ทิศ${VIEW_DIR_NAME[state.view]} — ค่าที่มีป้าย "ทิศนี้" ใช้เฉพาะทิศนี้ (บวกจากค่าหลัก) ค่าในกล่อง "ค่าที่ใช้ทุกทิศ" เปลี่ยนแล้วมีผลทุกทิศ`
        : 'กำลังปรับ: ทุกมุม (ค่าหลัก ใช้ทุกทิศ) · กดลูกศรเพื่อปรับเฉพาะทิศ · จุดฟ้า = ทิศที่มีค่าของตัวเอง').className = 'note';

      // What "changed" means and what ↺ goes back to: the last saved server-wide values.
      const defs = cosTuneOf(serverTuning ?? {}, c.id)!;
      const curNow = cosTune(c.id)!;
      const fields = COS_TUNE_FIELDS[slot];
      const groups = new Map<string, HTMLElement[]>();
      const shared = new Map<string, HTMLElement[]>();
      const put = (to: Map<string, HTMLElement[]>, group: string, el: HTMLElement) => {
        if (!to.has(group)) to.set(group, []);
        to.get(group)!.push(el);
      };
      // A single-wing picture (wingPair.ts): its own base Y, the old pair picture's fields hidden.
      const one = slot === 'wings' && assetSources[cosOneKey(c.id)] === 'file';
      const set = (key: string) => (v: number | boolean) => {
        setCosTuneValue(c.id, key, v);
        if (key === 'fly') buildPanel();
        else updateStatus();
      };

      // ---- position: X / Y / Z
      const axisKeys = new Set<string>();
      const seen = new Set<string>();
      for (const spec of one && !state.view ? ONE_WING_AXES : COS_AXES[slot]) {
        axisKeys.add(spec.key);
        if (spec.onlyIf && curNow[spec.onlyIf] !== true) continue;
        const f = fields[spec.key];
        if (f.kind !== 'num') continue;
        if (!state.view) {
          const lo = spec.sign === 1 ? f.min : -f.max;
          const hi = spec.sign === 1 ? f.max : -f.min;
          put(groups, 'ตำแหน่ง', numField(spec.label, f.label, lo, hi, Math.min(f.step, 0.005), round(spec.sign * (curNow[spec.key] as number)), round(spec.sign * (defs[spec.key] as number)), (v) => set(spec.key)(spec.sign === 1 ? v : v === 0 ? 0 : -v)));
        } else {
          if (spec.ride || seen.has(spec.axis) || axisHiddenInDir(spec.axis, state.view)) continue;
          seen.add(spec.axis);
          const key = viewOffKey(spec.axis, state.view);
          const g = fields[key];
          if (g.kind !== 'num') continue;
          put(groups, 'ตำแหน่ง', numField(spec.label.replace(/\s*\(.*\)$/, ''), g.label, g.min, g.max, g.step, curNow[key] as number, defs[key] as number, set(key), true));
        }
      }
      if (state.view && !COS_AXES[slot].some((s) => !axisHiddenInDir(s.axis, state.view as ViewDir))) put(groups, 'ตำแหน่ง', h('div', 'ชิ้นนี้ไม่มีแกนที่มีผลในมุมนี้'));

      // ---- single-wing picture, this facing only: the value used in it (base + this facing's offset, stored as the offset)
      if (one && state.view) {
        const view = state.view;
        for (const [key, dirs] of Object.entries(WING_ONE_DIR_FIELDS)) {
          if (!dirs.includes(view)) continue;
          const f = fields[key];
          if (f.kind !== 'num') continue;
          const offKey = dirFieldKey(key, view);
          put(groups, groupOf(key), numField(shortLabel(f.label), `${f.label} · ทิศ${VIEW_DIR_NAME[view]} (เก็บเป็นส่วนปรับจากค่าหลัก)`, f.min, f.max, f.step,
            round(valueAtDir('wings', curNow, key, view)), round(valueAtDir('wings', defs, key, view)),
            (v) => set(offKey)(round(v - (cosTune(c.id)![key] as number))), true));
        }
      }

      // ---- everything else (used by every facing: under a picked facing it goes in its own box)
      for (const [key, f] of Object.entries(fields)) {
        if (axisKeys.has(key) || isPerFacingKey(key)) continue;
        if (one && (PAIR_ONLY.has(key) || (state.view && key in WING_ONE_DIR_FIELDS))) continue;
        const el = f.kind === 'bool'
          ? boolField(shortLabel(f.label), f.label, curNow[key] === true, defs[key] === true, set(key))
          : numField(shortLabel(f.label), f.label, f.min, f.max, f.step, curNow[key] as number, defs[key] as number, set(key));
        put(state.view ? shared : groups, groupOf(key), el);
      }

      const draw = (m: Map<string, HTMLElement[]>, parent: HTMLElement) => {
        for (const g of GROUP_ORDER) {
          const els = m.get(g);
          if (!els?.length) continue;
          h('div', g, parent).className = 'grp';
          for (const el of els) parent.append(el);
        }
      };
      draw(groups, bodyEl);
      if (shared.size) {
        const box = document.createElement('details');
        box.open = state.sharedOpen;
        box.ontoggle = () => { state.sharedOpen = box.open; };
        h('summary', 'ค่าที่ใช้ทุกทิศ (เปลี่ยนแล้วมีผลทุกทิศ)', box);
        draw(shared, box);
        bodyEl.append(box);
      }
      if (one && !state.view) h('div', 'ปีกภาพข้างเดียว: ซ่อนค่าของภาพปีกคู่แบบเก่าที่ไม่มีผล · ขนาด ระยะ เอียง บีบ ที่นี่คือค่าหลัก ปรับเพิ่มต่อทิศได้เมื่อกดลูกศร').className = 'note';
      h('div', 'ตัวเลขสีฟ้า + ↺ = ต่างจากค่าที่บันทึกไว้ล่าสุด (กด ↺ เพื่อคืนค่านั้น) · ชี้ที่ชื่อเพื่อดูชื่อเต็ม · บันทึกด้วยปุ่มด้านล่าง').className = 'note';
    }

    function buildMoreTab(): void {
      h('h2', 'ค่าของเซิร์ฟ');
      if (server) {
        button('โหลดค่าของเซิร์ฟใหม่', async () => {
          if (pendingChanges().length && !confirm('ค่าที่แก้แต่ยังไม่ได้บันทึกจะหายทั้งหมด โหลดใหม่ไหม?')) return;
          try {
            const r = await server.load();
            serverTuning = r.tuning;
            canEdit = r.canEdit;
          } catch (e) {
            serverMsg = `โหลดค่าของเซิร์ฟไม่สำเร็จ: ${(e as Error).message}`;
          }
          if (serverTuning) applyCosTuning(serverTuning);
          buildPanel();
          serverMsg = '';
        });
        if (canEdit) {
          button('คืนค่าของเซิร์ฟเป็นค่าในโค้ด', async () => {
            if (!confirm('คืนค่าของแต่งตัวทุกชิ้นของทุกคนเป็นค่าในโค้ดไหม?')) return;
            try {
              const r = await server.save('reset');
              serverTuning = r.tuning;
              applyCosTuning(r.tuning);
              serverMsg = '✓ คืนค่าแล้ว ผู้เล่นที่ออนไลน์อยู่เห็นทันที';
            } catch (e) {
              serverMsg = `บันทึกไม่สำเร็จ: ${(e as Error).message}`;
            }
            buildPanel();
            serverMsg = '';
          });
        }
      } else h('div', 'หน้านี้ไม่ได้ต่อกับเซิร์ฟ (ทดลองอย่างเดียว)').className = 'note';
      h('h2', 'คัดลอกค่า');
      button('คัดลอกค่าที่ตั้งไว้', () => {
        // Every tuned piece by name ({} = its code defaults), so a copy says exactly what each piece uses.
        const t = checkCosTuning(currentCosTuning(), false).tuning ?? {};
        const text = JSON.stringify(Object.fromEntries(COSMETICS.filter((c) => c.slot !== 'title' && c.slot !== 'orb').map((c) => [c.id, t[c.id] ?? {}])));
        out.value = text;
        navigator.clipboard?.writeText(text).catch(() => {});
      });
      const out = document.createElement('textarea');
      out.readOnly = true;
      out.rows = 4;
      out.style.width = '100%';
      out.placeholder = 'กด "คัดลอกค่าที่ตั้งไว้" แล้ววางข้อความนี้ให้ Claude (ทุกชิ้น เฉพาะค่าที่ต่างจากในโค้ด) · แก้หลายชิ้นพร้อมกันได้ในแท็บ "จัดการของแต่งตัว"';
      bodyEl.append(out);
    }
  }

  /**
   * A number: name (full name on hover), − slider box + and ↺ (back to `saved`, shown when it differs).
   * `perDir` = the value belongs to the picked facing only.
   */
  function numField(label: string, full: string, min: number, max: number, step: number, value: number, saved: number | undefined, on: (v: number) => void, perDir = false): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'fld';
    const lb = document.createElement('div');
    lb.className = 'lb';
    if (perDir) {
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = 'ทิศนี้';
      lb.append(b);
    }
    lb.append(label);
    lb.title = `${full || label}${saved !== undefined ? ` · ค่าที่บันทึกไว้ ${round(saved)}` : ''}`;
    const ct = document.createElement('div');
    ct.className = 'ct';
    const s = document.createElement('input');
    s.type = 'range';
    s.min = String(min);
    s.max = String(max);
    s.step = String(step);
    s.value = String(value);
    // The value is a box too: type an exact number (kept within the slider's range, 3 decimals).
    const box = document.createElement('input');
    box.type = 'number';
    box.className = 'val';
    box.min = String(min);
    box.max = String(max);
    box.step = '0.001';
    box.value = String(value);
    const apply = (v: number) => {
      v = round(Math.min(max, Math.max(min, v)));
      s.value = String(v);
      box.value = String(v);
      wrap.classList.toggle('changed', saved !== undefined && Math.abs(v - saved) > 1e-6);
      on(v);
    };
    wrap.classList.toggle('changed', saved !== undefined && Math.abs(value - saved) > 1e-6);
    s.oninput = () => apply(Number(s.value));
    box.onchange = () => {
      if (box.value.trim() === '' || !Number.isFinite(Number(box.value))) {
        box.value = s.value;
        return;
      }
      apply(Number(box.value));
    };
    const stepBtn = (text: string, d: number) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.title = `${d > 0 ? 'เพิ่ม' : 'ลด'}ทีละ ${step}`;
      b.onclick = () => apply(Number(s.value) + d * step);
      return b;
    };
    const undo = document.createElement('button');
    undo.className = 'undo';
    undo.textContent = '↺';
    undo.title = `คืนเป็นค่าที่บันทึกไว้ ${saved !== undefined ? round(saved) : ''}`;
    undo.onclick = () => { if (saved !== undefined) apply(saved); };
    ct.append(stepBtn('−', -1), s, stepBtn('+', 1), box);
    if (saved !== undefined) ct.append(undo);
    wrap.append(lb, ct);
    return wrap;
  }

  /** An on/off switch with ↺ (back to `saved`, shown when it differs). */
  function boolField(label: string, full: string, value: boolean, saved: boolean, on: (v: boolean) => void): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'fld ct';
    const l = document.createElement('label');
    l.title = `${full} · ค่าที่บันทึกไว้ ${saved ? 'เปิด' : 'ปิด'}`;
    const c = document.createElement('input');
    c.type = 'checkbox';
    c.checked = value;
    const mark = () => wrap.classList.toggle('changed', c.checked !== saved);
    c.onchange = () => { mark(); on(c.checked); };
    l.append(c, ' ', label);
    l.style.flex = '1';
    const undo = document.createElement('button');
    undo.className = 'undo';
    undo.textContent = '↺';
    undo.title = 'คืนเป็นค่าที่บันทึกไว้';
    undo.onclick = () => { c.checked = saved; mark(); on(saved); };
    mark();
    wrap.append(l, undo);
    return wrap;
  }

  return () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    for (const c of cleanups) c();
    heroView.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    delete (window as unknown as { cosPreview?: object }).cosPreview;
    root.replaceChildren();
    root.classList.remove('cosp');
  };
}
