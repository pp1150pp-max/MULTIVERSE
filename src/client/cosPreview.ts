// Cosmetics test bench: a character wearing a chosen cosmetic in each slot, turned to any of the 8
// directions or walked around, plus sliders for each worn piece's placement and look (the tuning in
// src/shared/cosTuning.ts). Uses the game's own character views, so it looks like the game. Shown in
// the /admin "ของแต่งตัว" tab (owner + GM, the `cosPreview` switch in FEATURE_ROLES); saving the tuning
// for the whole server is the `cosLook` switch (owner only). Loaded only when the tab opens.
import * as THREE from 'three';
import { loadGameAssets, groundTiles } from './assets';
import { Effects } from './effects';
import { PlayerView } from './views';
import { ISO_DIR } from './world';
import { applyCosTuning, cosTune, currentCosTuning, resetCosTune, setCosTuneValue } from './cosTune';
import { axisHiddenInDir, checkCosTuning, COS_AXES, COS_TUNE_FIELDS, cosTuneOf, sameCosTuning, savePartOf, VIEW_DIR_NAME, VIEW_DIRS, viewOffKey, type CosTuning, type TunedSlot, type ViewDir } from '../shared/cosTuning';
import { COSMETICS, COS_SLOTS, COS_SLOT_NAME, cosById, MOUNT_SPEED, type CosSlot, type CosWorn } from '../shared/data/cosmetics';
import { Player } from '../shared/sim/Player';
import type { Sim } from '../shared/sim/Sim';
import { CLASS_IDS } from '../shared/data/classes';
import { BASE_MOVE_SPEED } from '../shared/formulas';
import type { ClassId } from '../shared/types';

const NO_SIM = null as unknown as Sim;

const CSS = `
.cosp { position: relative; overflow: hidden; background: #10131a; color: #e8e4d8; font: 13px/1.4 system-ui, sans-serif; }
.cosp .cosp-view { position: absolute; inset: 0; }
.cosp .cosp-view canvas { display: block; }
.cosp .cosp-panel { position: absolute; top: 8px; left: 8px; width: 380px; max-width: calc(100% - 16px); max-height: calc(100% - 16px); overflow: auto;
  background: rgba(16, 19, 26, 0.9); border: 1px solid #3a4152; border-radius: 6px; padding: 10px; box-sizing: border-box; }
.cosp h1 { font-size: 15px; margin: 0 0 6px; }
.cosp h2 { font-size: 12px; margin: 10px 0 4px; color: #f2d58a; }
.cosp details { border: 1px solid #2c3343; border-radius: 4px; padding: 4px 6px; margin: 4px 0; }
.cosp summary { cursor: pointer; color: #f2d58a; }
.cosp .row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin: 3px 0; }
.cosp .row label { flex: 1; min-width: 0; }
.cosp .row > span, .cosp .row > select, .cosp .row > input { flex-shrink: 0; }
.cosp select, .cosp textarea { background: #1d2230; color: inherit; border: 1px solid #3a4152; border-radius: 3px; padding: 2px 4px; font: inherit; }
.cosp input[type=range] { width: 110px; vertical-align: middle; }
.cosp .val { width: 64px; text-align: right; }
.cosp .val.changed { color: #7fd0ff; }
.cosp button { background: #2a3245; color: inherit; border: 1px solid #4a5570; border-radius: 3px; padding: 3px 6px; margin: 2px 2px 2px 0; cursor: pointer; font: inherit; }
.cosp button:hover { background: #36405a; }
.cosp .dirs { display: grid; grid-template-columns: repeat(3, 36px); gap: 2px; margin: 4px 0; }
.cosp .dirs button { margin: 0; padding: 3px 0; }
.cosp .dirs button.on { background: #4a5a80; border-color: #8fa8e0; }
.cosp .note { color: #9aa3b8; font-size: 11px; }
.cosp .title-prev { display: inline-block; margin: 4px 0; padding: 6px 10px; border-radius: 6px; border: 2px solid var(--c1); background: var(--c2); }
.cosp .title-prev .n { font-weight: bold; color: var(--c1); }
.cosp .title-prev .b { margin-top: 4px; padding: 3px 8px; border-radius: 10px; background: #fff; color: #222; border: 2px solid var(--c1); }
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
  /** Which worn piece's sliders are open. */
  open: 'wings' as CosSlot,
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
  panel.textContent = 'กำลังโหลด…';
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
    const w = Math.max(1, root.clientWidth);
    const hh = Math.max(1, root.clientHeight);
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
  ro.observe(root);
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
  const markDir = () => dirButtons.forEach((b, i) => b.classList.toggle('on', i === state.dir));
  let statusEl: HTMLElement | null = null;
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


  /** Is what the bench shows now the same as the server's? */
  // A function declaration (hoisted): buildPanel() above calls it before this line runs.
  function updateStatus(): void {
    if (!statusEl) return;
    const now = checkCosTuning(currentCosTuning(), false).tuning ?? {};
    const same = serverTuning && sameCosTuning(serverTuning, now);
    statusEl.textContent = serverMsg || (same ? '✓ ตอนนี้ตรงกับค่าของเซิร์ฟ' : '• ตอนนี้ต่างจากค่าของเซิร์ฟ (ยังไม่ได้บันทึก)');
  }

  /** The fields a view picker choice covers: the base values (`view` empty) or one facing's offsets. */
  function partOf(view: ViewDir | ''): (key: string) => boolean {
    if (!view) return (k) => !/^d[xyz]_/.test(k);
    return (k) => new RegExp(`^d[xyz]_at_${view}$`).test(k);
  }

  /**
   * Owner only: saves one piece's `part` (see partOf) for the whole server. Everything else stays as last saved:
   * other pieces, other views, and this piece's other fields (still only tried out on the bench).
   */
  async function savePart(id: string, slot: TunedSlot, part: (key: string) => boolean, partName: string): Promise<void> {
    if (!server || !confirm(`บันทึก${partName}ของ ${cosById(id)?.name ?? id} เป็นค่าเริ่มต้นทั้งเซิร์ฟเลยไหม? (ชิ้นอื่นและมุมอื่นไม่เปลี่ยน)`)) return;
    const next = savePartOf(serverTuning ?? {}, id, cosTune(id)!, part);
    try {
      const r = await server.save(next);
      serverTuning = r.tuning;
      serverMsg = '✓ บันทึกแล้ว ผู้เล่นที่ออนไลน์อยู่เห็นทันที';
    } catch (e) {
      serverMsg = `บันทึกไม่สำเร็จ: ${(e as Error).message}`;
    }
    buildPanel();
    serverMsg = '';
  }

  function buildPanel(): void {
    panel.innerHTML = '';
    const add = <T extends HTMLElement>(parent: HTMLElement, e: T): T => {
      parent.append(e);
      return e;
    };
    const h = (tag: string, text: string, parent: HTMLElement = panel) => {
      const e = document.createElement(tag);
      e.textContent = text;
      return add(parent, e);
    };
    const row = (label: string, input: HTMLElement, parent: HTMLElement = panel) => {
      const r = document.createElement('div');
      r.className = 'row';
      const l = document.createElement('label');
      l.textContent = label;
      r.append(l, input);
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
    const button = (text: string, on: () => void, parent: HTMLElement = panel) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = on;
      return add(parent, b);
    };

    h('h1', 'ทดลองของแต่งตัว');
    h('div', note).className = 'note';

    // ---- what to wear
    h('h2', 'ตัวละครและของที่สวม');
    row('อาชีพ', select(CLASS_IDS.map((c) => [c, c]), state.cls, (v) => {
      state.cls = v as ClassId;
      rebuildHero();
    }));
    for (const slot of COS_SLOTS) {
      const opts: [string, string][] = [['', '— ไม่ใส่ —'], ...COSMETICS.filter((c) => c.slot === slot).map((c): [string, string] => [c.id, c.name])];
      row(COS_SLOT_NAME[slot], select(opts, state.worn[slot] ?? '', (v) => {
        if (v) state.worn[slot] = v;
        else delete state.worn[slot];
        if (v && slot !== 'title') state.open = slot;
        if (slot === 'mount' && v) state.riding = true;
        dress(hero);
        buildPanel();
      }));
    }
    if (state.worn.mount) {
      row('ขี่สัตว์ขี่', check(state.riding, (v) => {
        state.riding = v;
        dress(hero);
      }));
    }
    const title = cosById(state.worn.title);
    if (title) {
      // Name frames and chat bubbles are page text in the game (no 3D placement): shown here to look at only.
      const box = document.createElement('div');
      box.className = 'title-prev';
      box.style.setProperty('--c1', title.color);
      box.style.setProperty('--c2', title.color2);
      h('div', 'ชื่อตัวละคร', box).className = 'n';
      h('div', 'สวัสดี!', box).className = 'b';
      panel.append(box);
      h('div', 'กรอบชื่อ/ฟองแชท: ดูได้อย่างเดียว ไม่มีค่าให้ปรับ').className = 'note';
    }

    // ---- facing and moving
    h('h2', 'หันตัว (ครบ 8 ทิศ)');
    const grid = document.createElement('div');
    grid.className = 'dirs';
    dirButtons = DIRS.map((d, i) => {
      if (!d.label) {
        const b = button(state.spin ? '⏸' : '⟳', () => {
          state.spin = !state.spin;
          state.walk = false;
          buildPanel();
        }, grid);
        b.title = 'หมุนเองทีละทิศ ทุก 1 วินาที';
        return b;
      }
      const b = button(d.label, () => {
        state.dir = i;
        state.view = dirOfButton(i); // a facing arrow also picks that facing for the position sliders (owner 2026-11-11)
        state.spin = state.walk = false;
        walkTo = null;
        face(hero, i);
        buildPanel();
      }, grid);
      b.title = d.name;
      return b;
    });
    panel.append(grid);
    markDir();
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
    row('ซูมกล้อง (เกมจริง 17)', rangeBox(4, 17, 1, state.zoom, (v) => { state.zoom = v; resize(); }));
    h('div', 'เดิน: WASD / ลูกศร หรือคลิกที่พื้น').className = 'note';

    // ---- sliders for each worn piece
    h('h2', 'ปรับค่าของแต่ละชิ้น (แยกรายชิ้น)');
    // The view the position sliders edit: every view (the base value) or one of the 5 facings (an offset added
    // in that view only; the front and front diagonal share one, the back and back diagonal too).
    row('มุมที่ปรับตำแหน่ง', select([['', 'ทุกมุม (ค่าหลัก)'], ...VIEW_DIRS.map((d): [string, string] => [d, `ทิศ${VIEW_DIR_NAME[d]}`])], state.view, (v) => {
      state.view = v as ViewDir | '';
      if (state.view) {
        state.dir = VIEW_DIR_BUTTON[state.view];
        state.spin = state.walk = false;
        walkTo = null;
        face(hero, state.dir);
      }
      buildPanel();
    }));
    h('div', 'X = ซ้าย/ขวาของตัวละคร · Y = ขึ้น/ลง · Z = หน้า/หลัง · เลือกมุมแล้วเห็นเฉพาะแกนที่มีผลในมุมนั้น (ส่วนปรับของแต่ละทิศ ทั้ง 8 ทิศแยกกัน บวกเพิ่มจากค่าหลัก)').className = 'note';
    for (const slot of COS_SLOTS) {
      if (slot === 'title') continue;
      const c = cosById(state.worn[slot]);
      if (!c) continue;
      // What "changed" means and what the reset buttons go back to: the last saved server-wide values.
      const defs = cosTuneOf(serverTuning ?? {}, c.id)!;
      const det = document.createElement('details');
      det.open = state.open === slot;
      det.ontoggle = () => {
        if (det.open) state.open = slot;
      };
      h('summary', `${COS_SLOT_NAME[slot]}: ${c.name}`, det);
      // ---- position: X / Y / Z
      const axisKeys = new Set<string>();
      const curNow = cosTune(c.id)!;
      const seen = new Set<string>();
      for (const spec of COS_AXES[slot as TunedSlot]) {
        axisKeys.add(spec.key);
        if (spec.onlyIf && curNow[spec.onlyIf] !== true) continue;
        const f = COS_TUNE_FIELDS[slot as TunedSlot][spec.key];
        if (f.kind !== 'num') continue;
        if (!state.view) {
          const lo = spec.sign === 1 ? f.min : -f.max;
          const hi = spec.sign === 1 ? f.max : -f.min;
          const r = rangeBox(lo, hi, Math.min(f.step, 0.005), round(spec.sign * (curNow[spec.key] as number)), (v) => {
            setCosTuneValue(c.id, spec.key, spec.sign === 1 ? v : v === 0 ? 0 : -v);
            updateStatus();
          }, (v) => Math.abs(spec.sign * v - (defs[spec.key] as number)) > 1e-6);
          r.title = `ค่าที่บันทึกไว้ ${round(spec.sign * (defs[spec.key] as number))}`;
          row(spec.label, r, det);
        } else {
          if (spec.ride || seen.has(spec.axis) || axisHiddenInDir(spec.axis, state.view)) continue;
          seen.add(spec.axis);
          const key = viewOffKey(spec.axis, state.view);
          const g = COS_TUNE_FIELDS[slot as TunedSlot][key];
          if (g.kind !== 'num') continue;
          const r = rangeBox(g.min, g.max, g.step, curNow[key] as number, (v) => {
            setCosTuneValue(c.id, key, v);
            updateStatus();
          }, (v) => Math.abs(v - (defs[key] as number)) > 1e-6);
          r.title = `ค่าที่บันทึกไว้ ${defs[key]}`;
          row(`${spec.label.slice(0, 1)} ส่วนปรับทิศ${VIEW_DIR_NAME[state.view]}`, r, det);
        }
      }
      if (state.view && !COS_AXES[slot as TunedSlot].some((s) => !axisHiddenInDir(s.axis, state.view as ViewDir))) h('div', 'ชิ้นนี้ไม่มีแกนที่มีผลในมุมนี้', det).className = 'note';
      // ---- everything else
      for (const [key, f] of Object.entries(COS_TUNE_FIELDS[slot as TunedSlot])) {
        if (axisKeys.has(key) || /^d[xyz]_/.test(key)) continue;
        const cur = cosTune(c.id)![key];
        const changed = (v: number | boolean) => v !== defs[key];
        if (f.kind === 'bool') {
          row(f.label, check(cur === true, (v) => {
            setCosTuneValue(c.id, key, v);
            updateStatus();
          }), det);
        } else {
          const r = rangeBox(f.min, f.max, f.step, cur as number, (v) => {
            setCosTuneValue(c.id, key, v);
            updateStatus();
          }, changed);
          r.title = `ค่าที่บันทึกไว้ ${defs[key]}`;
          row(f.label, r, det);
        }
      }
      // Save / reset just this piece, and just what the view picker shows: the base values (every view) or the
      // offsets of that view's group (front = front + front diagonal, back = back diagonal + back).
      const part = partOf(state.view);
      const partName = !state.view ? 'ค่าหลัก' : `ทิศ${VIEW_DIR_NAME[state.view]}`;
      button(`คืนค่า${partName}ของชิ้นนี้`, () => {
        const saved = cosTuneOf(serverTuning ?? {}, c.id)!;
        for (const k of Object.keys(COS_TUNE_FIELDS[slot as TunedSlot])) if (part(k)) setCosTuneValue(c.id, k, saved[k]);
        buildPanel();
      }, det);
      if (server && canEdit) button(`💾 บันทึก${partName}ของชิ้นนี้`, () => void savePart(c.id, slot as TunedSlot, part, partName), det);
      button('คืนค่าชิ้นนี้ทั้งหมดเป็นค่าที่บันทึกไว้', () => {
        resetCosTune(c.id, serverTuning?.[c.id]);
        buildPanel();
      }, det);
      panel.append(det);
    }
    if (!COS_SLOTS.some((s) => s !== 'title' && state.worn[s])) h('div', 'ใส่ของสักชิ้นด้านบนเพื่อปรับค่า').className = 'note';
    h('div', 'ตัวเลขสีฟ้า = ต่างจากค่าที่บันทึกไว้ล่าสุด (ค่าเริ่มต้นของเซิร์ฟ ถ้ายังไม่เคยบันทึกคือค่าในโค้ด) · ชี้ที่สไลเดอร์เพื่อดูค่านั้น').className = 'note';

    // ---- server-wide
    if (server) {
      h('h2', 'ค่าเริ่มต้นทั้งเซิร์ฟ (ที่ผู้เล่นทุกคนเห็น)');
      statusEl = h('div', '');
      statusEl.className = 'note';
      updateStatus();
      button('โหลดค่าของเซิร์ฟ', async () => {
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
        const saveWith = async (what: CosTuning | 'reset', ask: string) => {
          if (!confirm(ask)) return;
          try {
            const r = await server.save(what);
            serverTuning = r.tuning;
            applyCosTuning(r.tuning);
            serverMsg = '✓ บันทึกแล้ว ผู้เล่นที่ออนไลน์อยู่เห็นทันที';
          } catch (e) {
            serverMsg = `บันทึกไม่สำเร็จ: ${(e as Error).message}`;
          }
          buildPanel();
          serverMsg = '';
        };
        button('💾 บันทึกเป็นค่าเริ่มต้นทั้งเซิร์ฟ', () => void saveWith(currentCosTuning(), 'ใช้ค่าของแต่งตัวทุกชิ้นตามที่ตั้งไว้ตอนนี้กับผู้เล่นทุกคนเลยไหม?'));
        button('คืนค่าของเซิร์ฟเป็นค่าในโค้ด', () => void saveWith('reset', 'คืนค่าของแต่งตัวทุกชิ้นของทุกคนเป็นค่าในโค้ดไหม?'));
      } else {
        h('div', 'บันทึกค่าของเซิร์ฟได้เฉพาะเจ้าของ (GM ทดลองได้อย่างเดียว)').className = 'note';
      }
    }

    // ---- copy / reset
    h('h2', 'บันทึกค่า');
    button('คัดลอกค่าที่ตั้งไว้', () => {
      const text = JSON.stringify(checkCosTuning(currentCosTuning(), false).tuning ?? {});
      out.value = text;
      navigator.clipboard?.writeText(text).catch(() => {});
    });
    button('คืนค่าทุกชิ้นเป็นค่าที่บันทึกไว้', () => {
      applyCosTuning(serverTuning ?? {});
      buildPanel();
    });
    const out = document.createElement('textarea');
    out.readOnly = true;
    out.rows = 3;
    out.style.width = '100%';
    out.placeholder = 'กด "คัดลอกค่าที่ตั้งไว้" แล้ววางข้อความนี้ให้ Claude (เฉพาะค่าที่ต่างจากในโค้ด)';
    panel.append(out);
  }

  /** A slider with its value; `changed` colours the value when it differs from the code default. */
  function rangeBox(min: number, max: number, step: number, value: number, on: (v: number) => void, changed?: (v: number) => boolean): HTMLSpanElement {
    const wrap = document.createElement('span');
    const s = document.createElement('input');
    s.type = 'range';
    s.min = String(min);
    s.max = String(max);
    s.step = String(step);
    s.value = String(value);
    // The value is a box too: type an exact number (kept within the slider's range, 3 decimals).
    const out = document.createElement('input');
    out.type = 'number';
    out.className = 'val';
    out.min = String(min);
    out.max = String(max);
    out.step = '0.001';
    const mark = (v: number) => out.classList.toggle('changed', !!changed?.(v));
    out.value = String(value);
    mark(value);
    s.oninput = () => {
      const v = Number(s.value);
      out.value = String(v);
      mark(v);
      on(v);
    };
    out.onchange = () => {
      if (out.value.trim() === '' || !Number.isFinite(Number(out.value))) {
        out.value = s.value;
        return;
      }
      const v = round(Math.min(max, Math.max(min, Number(out.value))));
      out.value = String(v);
      s.value = String(v);
      mark(v);
      on(v);
    };
    wrap.append(s, out);
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
