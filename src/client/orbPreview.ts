// Enhancement orb test bench: a character with orbs, plus a panel to switch palettes and shapes, set
// each worn place's + level and tune sizes. Uses the game's own character views, effects and orb
// renderer, so it looks like the game. Shown in the /admin "ลูกแก้วตีบวก" tab (owner + GM, the
// `orbPreview` switch in FEATURE_ROLES) and on orbs.html under `npm run dev`. Loaded only when opened.
// Laid out like the cosmetics bench (src/client/cosPreview.ts, owner 2026-11-23): the view on the left, a
// tabbed panel on the right, grouped sliders with − / + / ↺, and one save button that lists the changed values.
import * as THREE from 'three';
import { loadGameAssets, groundTiles } from './assets';
import { Effects } from './effects';
import { PlayerView } from './views';
import { ISO_DIR } from './world';
import { applyOrbLook, currentOrbLook, ORB_LEVELS, ORB_PALETTES, ORB_SHAPES, orbMixState, orbPalette, orbShape, orbTuning, setOrbMix, setOrbPalette, setOrbShape } from './orbs';
import { DEFAULT_ORB_LOOK, ORB_LOOK_RANGES, ORB_PALETTE_NAME, ORB_SHAPE_NAME, type OrbLook, type OrbLookNumber } from '../shared/orbLook';
import type { AdminOrbItems } from '../shared/admin';
import { Player } from '../shared/sim/Player';
import type { Sim } from '../shared/sim/Sim';
import { auraTier, orbCodes, orbMinPlus, PLUS_CAP } from '../shared/data/enhance';
import { CLASS_IDS } from '../shared/data/classes';
import { BASE_MOVE_SPEED } from '../shared/formulas';
import { EQUIP_SLOTS, EQUIP_SLOT_LABEL, type ClassId, type EquipSlot, type Item } from '../shared/types';

const NO_SIM = null as unknown as Sim;

const CSS = `
.orbp { --orbp-w: min(400px, 55%); position: relative; overflow: hidden; background: #10131a; color: #e8e4d8; font: 13px/1.4 system-ui, sans-serif; }
.orbp .orbp-view { position: absolute; top: 0; bottom: 0; left: 0; right: var(--orbp-w); }
.orbp .orbp-view canvas { display: block; }
.orbp .orbp-panel { position: absolute; top: 0; right: 0; bottom: 0; width: var(--orbp-w); display: flex; flex-direction: column;
  background: #161a24; border-left: 1px solid #3a4152; box-sizing: border-box; }
.orbp .tabs { display: flex; flex-wrap: wrap; gap: 2px; padding: 6px 6px 0; border-bottom: 1px solid #3a4152; }
.orbp .tabs button { margin: 0; border-radius: 4px 4px 0 0; }
.orbp .tabs button.on { background: #4a5a80; border-color: #8fa8e0; }
.orbp .body { flex: 1; overflow: auto; padding: 8px 10px; }
.orbp .bar { border-top: 1px solid #3a4152; padding: 6px 10px; background: #1b2030; }
.orbp button.save { background: #2f5a3a; border-color: #5aa070; font-weight: bold; }
.orbp button:disabled { opacity: 0.5; cursor: default; }
.orbp h1 { font-size: 15px; margin: 0 0 6px; }
.orbp h2 { font-size: 12px; margin: 10px 0 4px; color: #f2d58a; }
.orbp .row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin: 3px 0; }
.orbp .row label { flex: 1; min-width: 0; }
/* label + pick-list: the label keeps its own width (never squeezed to 1-2 letters); the box takes what is left */
.orbp .row > label:not(:only-child) { flex: 0 0 auto; max-width: 45%; min-width: 4.5em; }
.orbp .row > select { flex: 1 1 9em; min-width: 0; max-width: none; width: auto; } /* too narrow for both on one line = the box drops under its label */
.orbp .row > span, .orbp .row > input { flex-shrink: 0; }
.orbp select, .orbp input[type=number], .orbp textarea { background: #1d2230; color: inherit; border: 1px solid #3a4152; border-radius: 3px; padding: 2px 4px; font: inherit; }
.orbp .grp { margin: 10px 0 2px; color: #f2d58a; font-size: 12px; border-bottom: 1px solid #2c3343; }
.orbp .fld { margin: 3px 0; }
.orbp .fld .lb { font-size: 12px; color: #c8c4b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.orbp .ct { display: flex; align-items: center; gap: 3px; }
.orbp .fld input[type=range] { flex: 1; min-width: 60px; }
.orbp .fld select { flex: 1; min-width: 0; }
.orbp .fld button { margin: 0; padding: 1px 7px; }
.orbp .fld .undo { visibility: hidden; }
.orbp .fld.changed .undo { visibility: visible; }
.orbp .fld.changed .val, .orbp .fld.changed label, .orbp .fld.changed select { color: #7fd0ff; }
.orbp .val { width: 64px; text-align: right; }
.orbp button { background: #2a3245; color: inherit; border: 1px solid #4a5570; border-radius: 3px; padding: 3px 6px; margin: 2px 2px 2px 0; cursor: pointer; font: inherit; }
.orbp button:hover:not(:disabled) { background: #36405a; }
.orbp .orbp-stats { position: absolute; left: 8px; top: 8px; background: rgba(16, 19, 26, 0.8); padding: 4px 8px; border-radius: 4px; pointer-events: none; }
.orbp .note { color: #9aa3b8; font-size: 11px; margin: 4px 0; }
.orbp .modal { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 5; }
.orbp .modal > div { background: #1b2030; border: 1px solid #4a5570; border-radius: 6px; padding: 12px; width: min(620px, 92%); max-height: 80%; display: flex; flex-direction: column; box-sizing: border-box; }
.orbp .modal .list { overflow: auto; flex: 1; margin: 6px 0; border: 1px solid #2c3343; padding: 4px 6px; }
.orbp .modal .list label { display: block; padding: 2px 0; }
`;

/** + level per worn place (0 = nothing at +7 or more). */
const levels: Record<EquipSlot, number> = Object.fromEntries(EQUIP_SLOTS.map((s) => [s, 0])) as Record<EquipSlot, number>;
levels.weapon = 7;
levels.armor = 7;
levels.ring = 15;

/**
 * The server-wide look on the admin page: read it, and (owner only) save it. Each call returns the
 * server's look after it, or throws with a message.
 */
export interface OrbLookServer {
  load(): Promise<{ look: OrbLook; canEdit: boolean }>;
  save(look: OrbLook | 'reset'): Promise<{ look: OrbLook; canEdit: boolean }>;
  /** The orb looks in the shop (src/shared/orbItems.ts): add the bench's look as a new one, or save over one. */
  shop?: OrbShopServer;
}

export interface OrbShopServer {
  load(): Promise<AdminOrbItems>;
  add(name: string, look: OrbLook): Promise<AdminOrbItems>;
  overwrite(id: string, look: OrbLook): Promise<AdminOrbItems>;
  /** Open with this piece's look ("เปิดในแท่นทดลอง" in the shop tab). */
  open?: string;
}

/** Ranges the dice button picks from (kept inside what still looks sensible, narrower than the sliders). */
const RANDOM_RANGE: Partial<Record<keyof typeof orbTuning, [number, number, number]>> = {
  scale: [0.7, 1.6, 0.1],
  radius: [0.75, 1.3, 0.05],
  speed: [0.08, 0.4, 0.01],
  height: [-0.3, 0.4, 0.05],
  bob: [0, 0.2, 0.01],
  bobSpeed: [0.5, 2, 0.1],
  sway: [0, 1.5, 0.1],
  glow: [0.6, 1.8, 0.1],
  glowAlpha: [0.6, 1.6, 0.1],
  particles: [0, 2, 0.1],
  trail: [0, 2, 0.1],
};

/** Picks a random palette, shape and tuning (not the gear). */
function randomLook(): void {
  const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
  setOrbPalette(pick(ORB_PALETTES).id);
  setOrbShape(pick(ORB_SHAPES).id);
  const t = orbTuning as unknown as Record<string, number | boolean>;
  for (const [key, [lo, hi, step]] of Object.entries(RANDOM_RANGE)) {
    const v = lo + Math.round((Math.random() * (hi - lo)) / step) * step;
    t[key] = Math.round(v * 100) / 100;
  }
  orbTuning.softGlow = true;
}

/** Gives every worn place its own random palette and/or shape (or clears them with `on` false). */
function randomMix(colors: boolean, shapes: boolean): void {
  const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
  EQUIP_SLOTS.forEach((_, i) => setOrbMix(i, colors ? pick(ORB_PALETTES).id : null, shapes ? pick(ORB_SHAPES).id : null));
}

/** Walk speed (units/s): the game's base move speed. */
const WALK_SPEED = BASE_MOVE_SPEED;

/** The panel's tabs (owner 2026-11-23, like the cosmetics bench). */
type Tab = 'char' | 'gear' | 'look' | 'more';

/** The look's sliders, grouped as on the old panel: [key, name, step]. The ranges are ORB_LOOK_RANGES (the server's). */
const LOOK_GROUPS: { name: string; fields: [OrbLookNumber | 'softGlow', string, number][] }[] = [
  { name: 'ขนาดและการหมุน (ทุกระดับพร้อมกัน)', fields: [['scale', 'ขนาด ×', 0.1], ['radius', 'รัศมีวง', 0.05], ['speed', 'รอบ/วินาที', 0.01]] },
  { name: 'ลอยขึ้นลง', fields: [['height', 'ความสูงวง (+ขึ้น −ลง)', 0.05], ['bob', 'ระยะลอยขึ้นลง', 0.01], ['bobSpeed', 'ความเร็วลอย ×', 0.1], ['sway', 'ส่ายหน้า-หลัง ×', 0.1]] },
  { name: 'แสง ประกาย หาง', fields: [['softGlow', 'แสงนุ่มกลม (ปิด = แสงพิกเซล)', 0], ['glow', 'ขนาดแสง ×', 0.1], ['glowAlpha', 'ความสว่างแสง ×', 0.1], ['particles', 'จำนวนประกาย ×', 0.1], ['trail', 'ความยาวหาง ×', 0.1]] },
];
/** Every value's name (the save list). */
const LOOK_NAME: Record<keyof OrbLook, string> = {
  palette: 'ชุดสี', shape: 'รูปทรง',
  ...(Object.fromEntries(LOOK_GROUPS.flatMap((g) => g.fields.map(([k, n]) => [k, n]))) as Record<OrbLookNumber | 'softGlow', string>),
};
const LOOK_KEYS = Object.keys(DEFAULT_ORB_LOOK) as (keyof OrbLook)[];
/** The server keeps 2 decimals (checkOrbLook), so the bench does too. */
const round2 = (n: number) => Math.round(n * 100) / 100;

const state = {
  cls: 'sword' as ClassId, aura: true, walk: false, extra: 0, zoom: 17,
  /** "Set N orbs" tool: how many, and at which + level (0 = a random level within lvMin–lvMax). */
  count: 5, countLv: 0,
  /** Ranges the orb dice picks from. */
  countMin: 1, countMax: 10, lvMin: 7, lvMax: 15,
  tab: 'look' as Tab,
};

const randInt = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (hi - lo + 1));

/** Fills the first `n` worn places (EQUIP_SLOTS order) with orbs, the rest empty. */
function setOrbCount(n: number, level: (i: number) => number): void {
  EQUIP_SLOTS.forEach((s, i) => { levels[s] = i < n ? level(i) : 0; });
}

/** Gear with just the + levels set: enough for orbCodes (the same code the server uses). */
function fakeGear(lv: Record<EquipSlot, number>): Partial<Record<EquipSlot, Item>> {
  const eq: Partial<Record<EquipSlot, Item>> = {};
  for (const s of EQUIP_SLOTS) if (lv[s]) eq[s] = { plus: lv[s] } as Item;
  return eq;
}

function applyGear(p: Player, lv: Record<EquipSlot, number>): void {
  p.orbs = orbCodes(fakeGear(lv));
  const best = Math.max(0, ...EQUIP_SLOTS.map((s) => lv[s]));
  p.aura = state.aura ? auraTier(best) : 0;
}

/**
 * Builds the test bench inside `root` (which should have a size, e.g. the page or a tab) and starts it.
 * `note` is the line under the title. Returns a function that stops it and frees everything.
 */
export async function mountOrbPreview(root: HTMLElement, note: string, server?: OrbLookServer): Promise<() => void> {
  if (!document.getElementById('orbp-css')) {
    const st = document.createElement('style');
    st.id = 'orbp-css';
    st.textContent = CSS;
    document.head.append(st);
  }
  root.classList.add('orbp');
  const viewEl = document.createElement('div');
  viewEl.className = 'orbp-view';
  const panel = document.createElement('div');
  panel.className = 'orbp-panel';
  const tabsEl = document.createElement('div');
  tabsEl.className = 'tabs';
  const bodyEl = document.createElement('div');
  bodyEl.className = 'body';
  bodyEl.textContent = 'กำลังโหลด…';
  const barEl = document.createElement('div');
  barEl.className = 'bar';
  panel.append(tabsEl, bodyEl, barEl);
  const statsEl = document.createElement('div');
  statsEl.className = 'orbp-stats';
  viewEl.append(statsEl);
  /** The tab the panel was last built for (the scroll position is kept within a tab). */
  let builtTab: Tab | null = null;
  root.replaceChildren(viewEl, panel);

  // The server's look (admin page): the bench starts from it, and the owner can save over it.
  let serverLook: OrbLook | null = null;
  let canEdit = false;
  let serverMsg = '';
  if (server) {
    try {
      const r = await server.load();
      serverLook = r.look;
      canEdit = r.canEdit;
      applyOrbLook(r.look);
    } catch (e) {
      serverMsg = `โหลดค่าของเซิร์ฟไม่สำเร็จ: ${(e as Error).message}`;
    }
  }
  // The orb looks in the shop, and what the save button saves into: null = the server-wide look, else a shop piece's id.
  let shopState: AdminOrbItems | null = null;
  let editing: string | null = null;
  const shop = server?.shop;
  if (shop) {
    try {
      shopState = await shop.load();
      const it = shopState.orbs.items.find((i) => i.id === shop.open);
      if (it) {
        applyOrbLook(it.look);
        editing = it.id;
      }
    } catch (e) {
      serverMsg = `โหลดลูกแก้วในร้านค้าไม่สำเร็จ: ${(e as Error).message}`;
    }
  }
  const editedPiece = () => shopState?.orbs.items.find((i) => i.id === editing) ?? null;
  /** What "changed" means and what ↺ goes back to: the look last saved where the save button saves. */
  const savedLook = (): OrbLook => editedPiece()?.look ?? serverLook ?? DEFAULT_ORB_LOOK;
  const canSave = (): boolean => !!server && (editing ? !!shopState?.canEdit && !!editedPiece() : canEdit && !!serverLook);

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
  viewEl.prepend(renderer.domElement);
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
  const camTarget = new THREE.Vector3();
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
      stopCircle();
    }
  });

  // Ground: the game's grass tile when it's there.
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
  let hero = makePlayer(1, state.cls);
  let heroView = new PlayerView(hero, scene);
  let crowd: { p: Player; v: PlayerView; ang: number }[] = [];

  function makePlayer(id: number, cls: ClassId): Player {
    const p = new Player(id, NO_SIM, { name: `P${id}`, classId: cls, level: 30, exp: 0, gold: 0, equipment: {}, bag: [] });
    p.faceX = 1;
    p.faceZ = 1;
    return p;
  }

  function rebuildHero(): void {
    heroView.dispose();
    hero = makePlayer(1, state.cls);
    heroView = new PlayerView(hero, scene);
    applyGear(hero, levels);
  }

  function rebuildCrowd(): void {
    for (const c of crowd) c.v.dispose();
    crowd = [];
    // Everyone in full +15 gear (10 orbs each): the worst case for the frame rate.
    const full = Object.fromEntries(EQUIP_SLOTS.map((s) => [s, 15])) as Record<EquipSlot, number>;
    for (let i = 0; i < state.extra; i++) {
      const p = makePlayer(100 + i, CLASS_IDS[i % CLASS_IDS.length]);
      const ang = (i / Math.max(1, state.extra)) * Math.PI * 2;
      const r = 4 + (i % 3) * 2;
      p.x = Math.cos(ang) * r;
      p.z = Math.sin(ang) * r;
      applyGear(p, full);
      crowd.push({ p, v: new PlayerView(p, scene), ang });
    }
  }

  /** Walking by hand (keys or a click) stops the circle walk. */
  function stopCircle(): void {
    if (!state.walk) return;
    state.walk = false;
    if (state.tab === 'char') buildPanel();
  }

  applyGear(hero, levels);
  buildPanel();

  let last = performance.now();
  let t = 0;
  let frames = 0;
  let fpsT = 0;
  // For checks while the pane is hidden (no animation frames): window.orbPreview.step(n) runs n frames.
  (window as unknown as { orbPreview: object }).orbPreview = {
    step(n: number): number {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) frame(last + 1000 / 60);
      return (performance.now() - t0) / n;
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
    // Screen up is −x −z and screen right is +x −z with this camera.
    let mx = 0;
    let mz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) { mx -= 1; mz -= 1; }
    if (keys.has('KeyS') || keys.has('ArrowDown')) { mx += 1; mz += 1; }
    if (keys.has('KeyD') || keys.has('ArrowRight')) { mx += 1; mz -= 1; }
    if (keys.has('KeyA') || keys.has('ArrowLeft')) { mx -= 1; mz += 1; }
    if (mx || mz) {
      walkTo = null;
      stopCircle();
    } else if (walkTo) {
      mx = walkTo.x - hero.x;
      mz = walkTo.z - hero.z;
      if (Math.hypot(mx, mz) < 0.1) {
        walkTo = null;
        mx = mz = 0;
      }
    }
    if ((mx || mz) && hero.alive) {
      const len = Math.hypot(mx, mz);
      const step = Math.min(WALK_SPEED * dt, walkTo ? len : Infinity);
      hero.x += (mx / len) * step;
      hero.z += (mz / len) * step;
      hero.faceX = mx / len;
      hero.faceZ = mz / len;
      hero.moving = true;
    } else if (state.walk) {
      const a = t * 0.6;
      hero.x = Math.cos(a) * 3;
      hero.z = Math.sin(a) * 3;
      hero.faceX = -Math.sin(a);
      hero.faceZ = Math.cos(a);
      hero.moving = true;
    } else {
      hero.moving = false;
    }
    heroView.update(dt, fx);
    const k = 1 - Math.exp(-dt * 8);
    camTarget.x += (hero.x - camTarget.x) * k;
    camTarget.z += (hero.z - camTarget.z) * k;
    placeCamera();
    for (const c of crowd) c.v.update(dt, fx);
    fx.update(dt);
    renderer.render(scene, camera);
    frames++;
    fpsT += dt;
    if (fpsT >= 0.5) {
      statsEl.textContent = `${Math.round(frames / fpsT)} FPS · ลูกแก้วตัวหลัก ${hero.orbs.length} · ตัวละครเพิ่ม ${crowd.length} (×10 ลูก) · draw calls ${renderer.info.render.calls}`;
      frames = 0;
      fpsT = 0;
    }
  };
  raf = requestAnimationFrame(loop);

  const show = (k: keyof OrbLook, v: OrbLook[keyof OrbLook]): string =>
    k === 'palette' ? ORB_PALETTE_NAME[v as OrbLook['palette']] : k === 'shape' ? ORB_SHAPE_NAME[v as OrbLook['shape']] : typeof v === 'boolean' ? (v ? 'เปิด' : 'ปิด') : String(v);

  /** Every value on the bench that differs from where the save button saves (what it would save). */
  function pendingChanges(): { key: keyof OrbLook; text: string }[] {
    const saved = savedLook();
    const now = currentOrbLook();
    return LOOK_KEYS.filter((k) => now[k] !== saved[k]).map((k) => ({ key: k, text: `${LOOK_NAME[k]}: ${show(k, saved[k])} → ${show(k, now[k])}` }));
  }

  /** The save bar follows every change (a function declaration: buildPanel() calls it early). */
  function updateStatus(): void {
    barEl.innerHTML = '';
    const n = pendingChanges().length;
    const piece = editedPiece();
    const where = piece ? `"${piece.name}" ในร้าน` : 'ค่าของเซิร์ฟ';
    const line = document.createElement('div');
    line.className = 'note';
    line.textContent = serverMsg || (!server ? 'หน้านี้ทดลองอย่างเดียว ไม่มีปุ่มบันทึกของเซิร์ฟ' : n ? `• ยังไม่ได้บันทึก ${n} ค่า (เทียบกับ ${where})` : `✓ ตรงกับ ${where}`);
    barEl.append(line);
    if (server) {
      const save = document.createElement('button');
      save.className = 'save';
      save.textContent = `💾 บันทึกที่แก้ (${n} ค่า)`;
      save.disabled = !n || !canSave();
      save.onclick = () => openSaveDialog();
      barEl.append(save);
    }
    const undo = document.createElement('button');
    undo.textContent = 'ยกเลิกที่แก้ทั้งหมด';
    undo.disabled = !n;
    undo.onclick = () => {
      applyOrbLook(savedLook());
      buildPanel();
    };
    barEl.append(undo);
    if (server && !canSave()) {
      const g = document.createElement('div');
      g.className = 'note';
      g.textContent = piece
        ? 'บันทึกทับชิ้นในร้านได้เฉพาะผู้มีสิทธิ์ "ซ่อน/ตั้งราคาของแต่งตัว"'
        : 'บันทึกค่าของเซิร์ฟได้เฉพาะเจ้าของ (GM ทดลองได้อย่างเดียว)';
      barEl.append(g);
    }
    if (orbMixState().palettes.some((x) => x) || orbMixState().shapes.some((x) => x)) {
      const m = document.createElement('div');
      m.className = 'note';
      m.textContent = 'ต่างสี/ต่างทรงรายลูกจากปุ่มสุ่มเป็นของทดลอง ไม่ถูกบันทึก (บันทึกชุดสีและรูปทรงหลัก)';
      barEl.append(m);
    }
  }

  /**
   * Lists every changed value (all ticked) and saves the ticked ones where the save button saves (the
   * server-wide look, or the open shop piece). The rest stays as last saved; unticked changes stay tried out on the bench.
   */
  function openSaveDialog(): void {
    if (!server) return;
    const list = pendingChanges();
    const piece = editedPiece();
    const modal = document.createElement('div');
    modal.className = 'modal';
    const box = document.createElement('div');
    modal.append(box);
    const title = document.createElement('h1');
    title.textContent = piece ? `บันทึกทับ "${piece.name}" ในร้าน (${list.length} ค่า)` : `บันทึกเป็นค่าเริ่มต้นทั้งเซิร์ฟ (${list.length} ค่า)`;
    const hint = document.createElement('div');
    hint.className = 'note';
    hint.textContent = (piece ? 'ติ๊กค่าที่จะบันทึก คนที่สวมชิ้นนี้อยู่เห็นแบบใหม่ทันที' : 'ติ๊กค่าที่จะบันทึก ผู้เล่นที่ออนไลน์อยู่เห็นทันที')
      + ' · ค่าที่ไม่ติ๊กยังทดลองอยู่ในแท่น ไม่ถูกบันทึก · ต่างสี/ต่างทรงรายลูกไม่ถูกบันทึก';
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
      const picked = list.filter((_, i) => ticks[i].checked);
      if (!picked.length) return;
      // A whole look (the saved format is unchanged): the last saved one with the ticked values from the bench.
      const now = currentOrbLook();
      const next = { ...savedLook() } as Record<keyof OrbLook, unknown>;
      for (const { key } of picked) next[key] = now[key];
      ok.disabled = true;
      try {
        if (piece && shop) {
          shopState = await shop.overwrite(piece.id, next as unknown as OrbLook);
          serverMsg = `✓ บันทึกทับ "${piece.name}" แล้ว ${picked.length} ค่า คนที่สวมอยู่เห็นแบบใหม่ทันที`;
        } else {
          const r = await server.save(next as unknown as OrbLook);
          serverLook = r.look;
          serverMsg = `✓ บันทึกแล้ว ${picked.length} ค่า ผู้เล่นที่ออนไลน์อยู่เห็นทันที`;
        }
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
    const numberBox = (min: number, max: number, value: number, on: (v: number) => void) => {
      const n = document.createElement('input');
      n.type = 'number';
      n.min = String(min);
      n.max = String(max);
      n.value = String(value);
      n.style.width = '56px';
      n.onchange = () => {
        const v = Math.max(min, Math.min(max, Math.round(Number(n.value) || 0)));
        n.value = String(v);
        on(v);
      };
      return n;
    };
    const button = (text: string, on: () => void, parent: HTMLElement = bodyEl) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = on;
      return add(parent, b);
    };

    // ---- tabs
    const tabs: [Tab, string][] = [['char', 'ตัวละคร'], ['gear', 'ระดับ/จำนวนลูก'], ['look', 'หน้าตา'], ['more', 'อื่น ๆ']];
    for (const [tb, name] of tabs) {
      const b = button(name, () => {
        state.tab = tb;
        buildPanel();
      }, tabsEl);
      b.classList.toggle('on', tb === state.tab);
    }

    if (state.tab === 'char') buildCharTab();
    else if (state.tab === 'gear') buildGearTab();
    else if (state.tab === 'look') buildLookTab();
    else buildMoreTab();
    if (sameTab) bodyEl.scrollTop = scroll;
    updateStatus();

    function buildCharTab(): void {
      h('div', note).className = 'note';
      h('h2', 'ตัวละคร');
      row('อาชีพ', select(CLASS_IDS.map((c) => [c, c]), state.cls, (v) => {
        state.cls = v as ClassId;
        rebuildHero();
      }));
      row('ออร่าเดิม (ของชิ้นที่บวกสูงสุด)', check(state.aura, (v) => {
        state.aura = v;
        applyGear(hero, levels);
      }));
      row('เดินเป็นวง (ดูหาง)', check(state.walk, (v) => {
        state.walk = v;
        if (!v) hero.x = hero.z = 0;
      }));
      row('ตาย (ออร่าหาย ลูกแก้วยังอยู่)', check(!hero.alive, (v) => {
        hero.alive = !v;
        if (v) heroView.onDied();
        else heroView.onRevived();
      }));
      bodyEl.append(numField('ซูมกล้อง (เกมจริง 17)', 4, 17, 1, state.zoom, undefined, (v) => { state.zoom = v; resize(); }));
      h('div', 'เดิน: WASD / ลูกศร หรือคลิกที่พื้น').className = 'note';
    }

    function buildGearTab(): void {
      h('h2', 'ระดับตีบวกของแต่ละช่อง');
      const lvOpts: [string, string][] = [['0', '—']];
      for (let p = Math.min(PLUS_CAP, orbMinPlus()); p <= PLUS_CAP; p++) lvOpts.push([String(p), `+${p}`]);
      for (const s of EQUIP_SLOTS) {
        row(EQUIP_SLOT_LABEL[s], select(lvOpts, String(levels[s]), (v) => {
          levels[s] = Number(v);
          applyGear(hero, levels);
        }));
      }
      const preset = (text: string, lv: Partial<Record<EquipSlot, number>>) => button(text, () => {
        for (const s of EQUIP_SLOTS) levels[s] = lv[s] ?? 0;
        applyGear(hero, levels);
        buildPanel();
      });
      preset('2×+7', { weapon: 7, armor: 7 });
      preset('1×+15', { weapon: 15 });
      preset('2×+7 · 1×+15', { weapon: 7, armor: 7, ring: 15 });
      preset('+7 ถึง +15', Object.fromEntries(EQUIP_SLOTS.slice(0, 9).map((s, i) => [s, 7 + i])));
      preset('ครบ 10 ชิ้น +15', Object.fromEntries(EQUIP_SLOTS.map((s) => [s, 15])));
      preset('ล้าง', {});

      h('h2', 'กำหนดจำนวนลูกแก้ว');
      const lvPick: [string, string][] = [['0', 'สุ่ม (ตามช่วงด้านล่าง)']];
      for (let p = Math.min(PLUS_CAP, orbMinPlus()); p <= PLUS_CAP; p++) lvPick.push([String(p), `+${p} ทุกลูก`]);
      row('จำนวนลูก', numberBox(0, EQUIP_SLOTS.length, state.count, (v) => { state.count = v; }));
      row('ระดับ', select(lvPick, String(state.countLv), (v) => { state.countLv = Number(v); }));
      button('ใส่ตามนี้', () => {
        const lo = Math.min(state.lvMin, state.lvMax);
        const hi = Math.max(state.lvMin, state.lvMax);
        setOrbCount(state.count, () => state.countLv || randInt(lo, hi));
        applyGear(hero, levels);
        buildPanel();
      });

      h('h2', 'สุ่มจำนวนและระดับ (ต่ำสุด–สูงสุด)');
      row('จำนวนลูก ต่ำสุด', numberBox(0, EQUIP_SLOTS.length, state.countMin, (v) => { state.countMin = v; }));
      row('จำนวนลูก สูงสุด', numberBox(0, EQUIP_SLOTS.length, state.countMax, (v) => { state.countMax = v; }));
      row('ระดับ ต่ำสุด (+)', numberBox(Math.min(PLUS_CAP, orbMinPlus()), PLUS_CAP, state.lvMin, (v) => { state.lvMin = v; }));
      row('ระดับ สูงสุด (+)', numberBox(Math.min(PLUS_CAP, orbMinPlus()), PLUS_CAP, state.lvMax, (v) => { state.lvMax = v; }));
      button('🎲 สุ่มจำนวน+ระดับ', () => {
        const n = randInt(Math.min(state.countMin, state.countMax), Math.max(state.countMin, state.countMax));
        const lo = Math.min(state.lvMin, state.lvMax);
        const hi = Math.max(state.lvMin, state.lvMax);
        setOrbCount(n, () => randInt(lo, hi));
        applyGear(hero, levels);
        buildPanel();
      });
    }

    function buildLookTab(): void {
      const saved = savedLook();
      if (shop) {
        // What the save button saves into. Switching loads that look (asks first if changes are unsaved, owner 2026-11-23).
        const list = shopState?.orbs.items ?? [];
        const pick = select([['', 'ค่าของเซิร์ฟ (ที่ผู้เล่นทุกคนเห็น)'], ...list.map((i): [string, string] => [i.id, `ชิ้นในร้าน: ${i.name}`])], editing ?? '', (v) => {
          if (pendingChanges().length && !confirm('ค่าที่แก้แต่ยังไม่ได้บันทึกจะหาย แล้วโหลดหน้าตาของที่ที่เลือกมาแทน ไปต่อไหม?')) {
            pick.value = editing ?? '';
            return;
          }
          editing = v || null;
          applyOrbLook(savedLook());
          buildPanel();
        });
        row('กำลังแก้', pick);
        if (shopState?.canAdd) {
          button('➕ เพิ่มในร้านค้า', () => {
            const name = prompt('ชื่อลูกแก้วชิ้นใหม่ (ไม่เกิน 30 ตัวอักษร) · ใช้หน้าตาที่ตั้งอยู่ตอนนี้', '')?.trim();
            if (!name) return;
            void (async () => {
              try {
                shopState = await shop.add(name, currentOrbLook());
                editing = shopState.added ?? null;
                serverMsg = `✓ เพิ่ม "${name}" แล้ว (ซ่อนอยู่ ยังไม่มีราคา) ตั้งราคา/แสดงได้ที่แท็บ "จัดการของแต่งตัว"`;
              } catch (e) {
                serverMsg = `ไม่สำเร็จ: ${(e as Error).message}`;
              }
              buildPanel();
              serverMsg = '';
            })();
          });
        } else if (shopState) h('div', 'เพิ่มในร้านค้าได้เฉพาะผู้มีสิทธิ์ "เพิ่มลูกแก้วในร้านค้า"').className = 'note';
      }

      h('div', 'ชุดสีและรูปทรง').className = 'grp';
      const stepPick = <T extends { id: string }>(arr: readonly T[], cur: string, set: (id: string) => void) => (d: number) => {
        const i = arr.findIndex((x) => x.id === cur);
        set(arr[(i + d + arr.length) % arr.length].id);
        buildPanel();
      };
      bodyEl.append(pickField('ชุดสี', ORB_PALETTES.map((p) => [p.id, p.name]), orbPalette().id, saved.palette, (v) => { setOrbPalette(v); buildPanel(); },
        stepPick(ORB_PALETTES, orbPalette().id, setOrbPalette)));
      bodyEl.append(pickField('รูปทรง', ORB_SHAPES.map((p) => [p.id, p.name]), orbShape(), saved.shape, (v) => { setOrbShape(v); buildPanel(); },
        stepPick(ORB_SHAPES, orbShape(), setOrbShape)));
      button('🎲 สุ่มค่าทั้งหมด', () => {
        randomLook();
        buildPanel();
      });
      button('🎲 แต่ละลูกต่างสี+ต่างทรง', () => { randomMix(true, true); updateStatus(); });
      button('🎲 ต่างสีอย่างเดียว', () => { randomMix(true, false); updateStatus(); });
      button('🎲 ต่างทรงอย่างเดียว', () => { randomMix(false, true); updateStatus(); });
      button('ทุกลูกแบบเดียวกัน', () => { randomMix(false, false); updateStatus(); });

      const tu = orbTuning as unknown as Record<string, number | boolean>;
      for (const g of LOOK_GROUPS) {
        h('div', g.name).className = 'grp';
        for (const [key, name, step] of g.fields) {
          if (key === 'softGlow') {
            bodyEl.append(boolField(name, orbTuning.softGlow, saved.softGlow, (v) => { orbTuning.softGlow = v; updateStatus(); }));
            continue;
          }
          const [lo, hi] = ORB_LOOK_RANGES[key];
          bodyEl.append(numField(name, lo, hi, step, tu[key] as number, saved[key], (v) => { tu[key] = v; updateStatus(); }));
        }
      }
      h('div', 'ตัวเลขสีฟ้า + ↺ = ต่างจากค่าที่บันทึกไว้ล่าสุดของที่ที่กำลังแก้ (กด ↺ เพื่อคืนค่านั้น) · บันทึกด้วยปุ่มด้านล่าง').className = 'note';
    }

    function buildMoreTab(): void {
      h('h2', 'ค่าของเซิร์ฟ');
      if (server) {
        button('โหลดค่าของเซิร์ฟใหม่', async () => {
          if (pendingChanges().length && !confirm('ค่าที่แก้แต่ยังไม่ได้บันทึกจะหายทั้งหมด โหลดใหม่ไหม?')) return;
          try {
            const r = await server.load();
            serverLook = r.look;
            canEdit = r.canEdit;
            if (shop) shopState = await shop.load();
            if (!editedPiece()) editing = null;
          } catch (e) {
            serverMsg = `โหลดค่าของเซิร์ฟไม่สำเร็จ: ${(e as Error).message}`;
          }
          applyOrbLook(savedLook());
          buildPanel();
          serverMsg = '';
        });
        if (canEdit) {
          button('คืนค่าของเซิร์ฟเป็นค่าเริ่มต้นในโค้ด', async () => {
            if (!confirm('คืนหน้าตาลูกแก้วของทุกคนเป็นค่าเริ่มต้นในโค้ดไหม? (ชิ้นในร้านไม่เปลี่ยน)')) return;
            try {
              const r = await server.save('reset');
              serverLook = r.look;
              if (!editing) applyOrbLook(r.look);
              serverMsg = '✓ คืนค่าแล้ว ผู้เล่นที่ออนไลน์อยู่เห็นทันที';
            } catch (e) {
              serverMsg = `บันทึกไม่สำเร็จ: ${(e as Error).message}`;
            }
            buildPanel();
            serverMsg = '';
          });
        }
      } else h('div', 'หน้านี้ไม่ได้ต่อกับเซิร์ฟ (ทดลองอย่างเดียว)').className = 'note';
      button('ใส่ค่าเริ่มต้นในโค้ดลงในแท่น (ยังไม่บันทึก)', () => {
        applyOrbLook(DEFAULT_ORB_LOOK);
        buildPanel();
      });

      h('h2', 'คัดลอกค่า');
      button('คัดลอกค่าที่ตั้งไว้', () => {
        const mix = orbMixState();
        const perSlot = Object.fromEntries(EQUIP_SLOTS.map((s, i) => [s, [mix.palettes[i], mix.shapes[i]]]).filter(([, v]) => (v as unknown[]).some((x) => x)));
        const text = JSON.stringify({ palette: orbPalette().id, shape: orbShape(), ...orbTuning, ...(Object.keys(perSlot).length ? { perSlot } : {}) });
        out.value = text;
        navigator.clipboard?.writeText(text).catch(() => {});
      });
      const out = document.createElement('textarea');
      out.readOnly = true;
      out.rows = 3;
      out.style.width = '100%';
      out.placeholder = 'กด "คัดลอกค่าที่ตั้งไว้" แล้ววางข้อความนี้ให้ Claude';
      bodyEl.append(out);

      h('h2', 'ทดสอบความลื่น');
      row('ตัวละครเพิ่ม (+15 ครบ 10 ชิ้น)', numberBox(0, 60, state.extra, (v) => {
        state.extra = v;
        rebuildCrowd();
      }));

      h('h2', 'ตารางระดับ (src/client/orbs.ts)');
      const lines = Object.entries(ORB_LEVELS).map(([p, L]) =>
        `+${p}: ขนาด ${L.size} · แสง ${L.glow} · ประกาย ${L.particles} · หาง ${L.trail}`);
      h('div', lines.join('\n')).setAttribute('style', 'white-space:pre;font-size:11px;color:#9aa3b8');
    }
  }

  /** A number: name, − slider + box and ↺ (back to `saved`, shown when it differs). Kept to 2 decimals like the server. */
  function numField(label: string, min: number, max: number, step: number, value: number, saved: number | undefined, on: (v: number) => void): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'fld';
    const lb = document.createElement('div');
    lb.className = 'lb';
    lb.append(label);
    lb.title = `${label} · ช่วง ${min} ถึง ${max}${saved !== undefined ? ` · ค่าที่บันทึกไว้ ${saved}` : ''}`;
    const ct = document.createElement('div');
    ct.className = 'ct';
    const s = document.createElement('input');
    s.type = 'range';
    s.min = String(min);
    s.max = String(max);
    s.step = String(step);
    s.value = String(value);
    const box = document.createElement('input');
    box.type = 'number';
    box.className = 'val';
    box.min = String(min);
    box.max = String(max);
    box.step = '0.01';
    box.value = String(value);
    const mark = (v: number) => wrap.classList.toggle('changed', saved !== undefined && Math.abs(v - saved) > 1e-6);
    const apply = (v: number) => {
      v = round2(Math.min(max, Math.max(min, v)));
      s.value = String(v);
      box.value = String(v);
      mark(v);
      on(v);
    };
    mark(value);
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
    ct.append(stepBtn('−', -1), s, stepBtn('+', 1), box);
    if (saved !== undefined) {
      const undo = document.createElement('button');
      undo.className = 'undo';
      undo.textContent = '↺';
      undo.title = `คืนเป็นค่าที่บันทึกไว้ ${saved}`;
      undo.onclick = () => apply(saved);
      ct.append(undo);
    }
    wrap.append(lb, ct);
    return wrap;
  }

  /** A list choice (palette / shape): name, ◀ list ▶ and ↺ (back to `saved`). */
  function pickField(label: string, opts: [string, string][], value: string, saved: string, on: (v: string) => void, step: (d: number) => void): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'fld';
    wrap.classList.toggle('changed', value !== saved);
    const lb = document.createElement('div');
    lb.className = 'lb';
    lb.append(label);
    lb.title = `${label} · ค่าที่บันทึกไว้ ${opts.find(([v]) => v === saved)?.[1] ?? saved}`;
    const ct = document.createElement('div');
    ct.className = 'ct';
    const s = document.createElement('select');
    for (const [v, text] of opts) s.append(new Option(text, v, false, v === value));
    s.onchange = () => on(s.value);
    const btn = (text: string, title: string, fn: () => void, cls = '') => {
      const b = document.createElement('button');
      b.textContent = text;
      b.title = title;
      if (cls) b.className = cls;
      b.onclick = fn;
      return b;
    };
    ct.append(btn('◀', 'ก่อนหน้า', () => step(-1)), s, btn('▶', 'ถัดไป', () => step(1)), btn('↺', 'คืนเป็นค่าที่บันทึกไว้', () => on(saved), 'undo'));
    wrap.append(lb, ct);
    return wrap;
  }

  /** An on/off switch with ↺ (back to `saved`, shown when it differs). */
  function boolField(label: string, value: boolean, saved: boolean, on: (v: boolean) => void): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'fld ct';
    const l = document.createElement('label');
    l.title = `${label} · ค่าที่บันทึกไว้ ${saved ? 'เปิด' : 'ปิด'}`;
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
    for (const c of crowd) c.v.dispose();
    crowd = [];
    renderer.dispose();
    renderer.forceContextLoss();
    delete (window as unknown as { orbPreview?: object }).orbPreview;
    root.replaceChildren();
    root.classList.remove('orbp');
  };
}
