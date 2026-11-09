// Enhancement orb test bench: a character with orbs, plus a panel to switch palettes and shapes, set
// each worn place's + level and tune sizes. Uses the game's own character views, effects and orb
// renderer, so it looks like the game. Shown in the /admin "ลูกแก้วตีบวก" tab (owner + GM, the
// `orbPreview` switch in FEATURE_ROLES) and on orbs.html under `npm run dev`. Loaded only when opened.
import * as THREE from 'three';
import { loadGameAssets, groundTiles } from './assets';
import { Effects } from './effects';
import { PlayerView } from './views';
import { ISO_DIR } from './world';
import { applyOrbLook, currentOrbLook, ORB_LEVELS, ORB_PALETTES, ORB_SHAPES, orbMixState, orbPalette, orbShape, orbTuning, setOrbMix, setOrbPalette, setOrbShape } from './orbs';
import { DEFAULT_ORB_LOOK, sameOrbLook, type OrbLook } from '../shared/orbLook';
import { Player } from '../shared/sim/Player';
import type { Sim } from '../shared/sim/Sim';
import { auraTier, orbCodes, ORB_MIN_PLUS } from '../shared/data/enhance';
import { CLASS_IDS } from '../shared/data/classes';
import { BASE_MOVE_SPEED } from '../shared/formulas';
import { EQUIP_SLOTS, EQUIP_SLOT_LABEL, type ClassId, type EquipSlot, type Item } from '../shared/types';

const NO_SIM = null as unknown as Sim;

const CSS = `
.orbp { position: relative; overflow: hidden; background: #10131a; color: #e8e4d8; font: 13px/1.4 system-ui, sans-serif; }
.orbp .orbp-view { position: absolute; inset: 0; }
.orbp .orbp-view canvas { display: block; }
.orbp .orbp-panel { position: absolute; top: 8px; left: 8px; width: 360px; max-width: calc(100% - 16px); max-height: calc(100% - 16px); overflow: auto;
  background: rgba(16, 19, 26, 0.88); border: 1px solid #3a4152; border-radius: 6px; padding: 10px; box-sizing: border-box; }
.orbp h1 { font-size: 15px; margin: 0 0 6px; }
.orbp h2 { font-size: 12px; margin: 10px 0 4px; color: #f2d58a; }
.orbp .row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin: 3px 0; }
.orbp .row label { flex: 1; white-space: nowrap; }
.orbp .row > span, .orbp .row > select, .orbp .row > input { flex-shrink: 0; }
.orbp select, .orbp input[type=number], .orbp textarea { background: #1d2230; color: inherit; border: 1px solid #3a4152; border-radius: 3px; padding: 2px 4px; font: inherit; }
.orbp input[type=range] { width: 120px; }
.orbp button { background: #2a3245; color: inherit; border: 1px solid #4a5570; border-radius: 3px; padding: 3px 6px; margin: 2px 2px 2px 0; cursor: pointer; font: inherit; }
.orbp button:hover { background: #36405a; }
.orbp .orbp-stats { position: absolute; right: 8px; top: 8px; background: rgba(16, 19, 26, 0.8); padding: 4px 8px; border-radius: 4px; pointer-events: none; }
.orbp .note { color: #9aa3b8; font-size: 11px; }
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

const state = {
  cls: 'sword' as ClassId, aura: true, walk: false, extra: 0, zoom: 17,
  /** "Set N orbs" tool: how many, and at which + level (0 = a random level within lvMin–lvMax). */
  count: 5, countLv: 0,
  /** Ranges the orb dice picks from. */
  countMin: 1, countMax: 10, lvMin: 7, lvMax: 15,
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
  panel.textContent = 'กำลังโหลด…';
  const statsEl = document.createElement('div');
  statsEl.className = 'orbp-stats';
  root.replaceChildren(viewEl, panel, statsEl);

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
  const camTarget = new THREE.Vector3();
  const placeCamera = () => {
    camera.position.copy(camTarget).addScaledVector(ISO_DIR, 80);
    camera.lookAt(camTarget);
  };
  placeCamera();

  // Walking like in the game: WASD / arrow keys, or click the ground to walk there.
  const keys = new Set<string>();
  const typing = () => document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement;
  listen('keydown', (e) => {
    if (!typing()) keys.add(e.code);
  });
  listen('keyup', (e) => keys.delete(e.code));
  listen('blur', () => keys.clear());
  let walkTo: THREE.Vector3 | null = null;
  const ray = new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown', (e) => {
    const rc = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1), camera);
    const hit = ray.intersectObject(ground)[0];
    if (hit) {
      walkTo = hit.point.clone();
      state.walk = false;
      buildPanel();
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
    if (mx || mz) walkTo = null;
    else if (walkTo) {
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
      state.walk = false;
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

  function buildPanel(): void {
    panel.innerHTML = '';
    const h = (tag: string, text: string) => {
      const e = document.createElement(tag);
      e.textContent = text;
      panel.append(e);
      return e;
    };
    const row = (label: string, input: HTMLElement) => {
      const r = document.createElement('div');
      r.className = 'row';
      const l = document.createElement('label');
      l.textContent = label;
      r.append(l, input);
      panel.append(r);
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
    const slider = (min: number, max: number, step: number, value: number, on: (v: number) => void) => {
      const wrap = document.createElement('span');
      const s = document.createElement('input');
      s.type = 'range';
      s.min = String(min);
      s.max = String(max);
      s.step = String(step);
      s.value = String(value);
      const out = document.createElement('span');
      out.textContent = ` ${value}`;
      s.oninput = () => {
        out.textContent = ` ${s.value}`;
        on(Number(s.value));
      };
      wrap.append(s, out);
      return wrap;
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
    const button = (text: string, on: () => void) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = on;
      panel.append(b);
    };

    const stepPalette = (d: number) => {
      const i = ORB_PALETTES.indexOf(orbPalette());
      setOrbPalette(ORB_PALETTES[(i + d + ORB_PALETTES.length) % ORB_PALETTES.length].id);
      buildPanel();
    };

    h('h1', 'ทดลองลูกแก้วตีบวก');
    h('div', note).className = 'note';

    h('h2', 'ชุดสี');
    row('ชุดสี', select(ORB_PALETTES.map((p) => [p.id, p.name]), orbPalette().id, (v) => setOrbPalette(v)));
    row('รูปทรง', select(ORB_SHAPES.map((p) => [p.id, p.name]), orbShape(), (v) => setOrbShape(v)));
    button('🎲 สุ่มค่าทั้งหมด', () => {
      randomLook();
      buildPanel();
    });
    button('🎲 แต่ละลูกต่างสี+ต่างทรง', () => randomMix(true, true));
    button('🎲 ต่างสีอย่างเดียว', () => randomMix(true, false));
    button('🎲 ต่างทรงอย่างเดียว', () => randomMix(false, true));
    button('ทุกลูกแบบเดียวกัน', () => randomMix(false, false));
    button('◀ ชุดสีก่อนหน้า', () => stepPalette(-1));
    button('ชุดสีถัดไป ▶', () => stepPalette(1));
    h('div', 'เดิน: WASD / ลูกศร หรือคลิกที่พื้น (คลิกพื้นที่ว่างก่อนกดปุ่ม ถ้าเพิ่งเลือกเมนู)').className = 'note';

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

    h('h2', 'ระดับตีบวกของแต่ละช่อง');
    const lvOpts: [string, string][] = [['0', '—']];
    for (let p = ORB_MIN_PLUS; p <= 15; p++) lvOpts.push([String(p), `+${p}`]);
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
    for (let p = ORB_MIN_PLUS; p <= 15; p++) lvPick.push([String(p), `+${p} ทุกลูก`]);
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
    row('ระดับ ต่ำสุด (+)', numberBox(ORB_MIN_PLUS, 15, state.lvMin, (v) => { state.lvMin = v; }));
    row('ระดับ สูงสุด (+)', numberBox(ORB_MIN_PLUS, 15, state.lvMax, (v) => { state.lvMax = v; }));
    button('🎲 สุ่มจำนวน+ระดับ', () => {
      const n = randInt(Math.min(state.countMin, state.countMax), Math.max(state.countMin, state.countMax));
      const lo = Math.min(state.lvMin, state.lvMax);
      const hi = Math.max(state.lvMin, state.lvMax);
      setOrbCount(n, () => randInt(lo, hi));
      applyGear(hero, levels);
      buildPanel();
    });

    h('h2', 'ปรับขนาด/การหมุน (ทุกระดับพร้อมกัน)');
    row('ขนาด ×', slider(0.5, 2.5, 0.1, orbTuning.scale, (v) => { orbTuning.scale = v; }));
    row('รัศมีวง', slider(0.6, 1.6, 0.05, orbTuning.radius, (v) => { orbTuning.radius = v; }));
    row('รอบ/วินาที', slider(0.05, 0.6, 0.01, orbTuning.speed, (v) => { orbTuning.speed = v; }));
    row('ซูมกล้อง (เกมจริง 17)', slider(4, 17, 1, state.zoom, (v) => { state.zoom = v; resize(); }));

    h('h2', 'ลอยขึ้นลง');
    row('ความสูงวง (+ขึ้น −ลง)', slider(-0.6, 0.8, 0.05, orbTuning.height, (v) => { orbTuning.height = v; }));
    row('ระยะลอยขึ้นลง', slider(0, 0.4, 0.01, orbTuning.bob, (v) => { orbTuning.bob = v; }));
    row('ความเร็วลอย ×', slider(0.2, 3, 0.1, orbTuning.bobSpeed, (v) => { orbTuning.bobSpeed = v; }));
    row('ส่ายหน้า-หลัง ×', slider(0, 2, 0.1, orbTuning.sway, (v) => { orbTuning.sway = v; }));

    h('h2', 'แสง ประกาย หาง');
    row('แสงนุ่มกลม (ปิด = แสงพิกเซล)', check(orbTuning.softGlow, (v) => { orbTuning.softGlow = v; }));
    row('ขนาดแสง ×', slider(0.3, 2.5, 0.1, orbTuning.glow, (v) => { orbTuning.glow = v; }));
    row('ความสว่างแสง ×', slider(0.2, 2, 0.1, orbTuning.glowAlpha, (v) => { orbTuning.glowAlpha = v; }));
    row('จำนวนประกาย ×', slider(0, 2, 0.1, orbTuning.particles, (v) => { orbTuning.particles = v; }));
    row('ความยาวหาง ×', slider(0, 2, 0.1, orbTuning.trail, (v) => { orbTuning.trail = v; }));

    if (server) {
      h('h2', 'ค่าเริ่มต้นทั้งเซิร์ฟ (ที่ผู้เล่นทุกคนเห็น)');
      const same = serverLook && sameOrbLook(serverLook, currentOrbLook());
      h('div', serverMsg || (same ? '✓ ตอนนี้ตรงกับค่าของเซิร์ฟ' : '• ตอนนี้ต่างจากค่าของเซิร์ฟ (ยังไม่ได้บันทึก)')).className = 'note';
      button('โหลดค่าของเซิร์ฟ', () => {
        if (serverLook) applyOrbLook(serverLook);
        buildPanel();
      });
      if (canEdit) {
        const saveWith = async (what: OrbLook | 'reset', ask: string) => {
          if (!confirm(ask)) return;
          try {
            const r = await server.save(what);
            serverLook = r.look;
            applyOrbLook(r.look);
            serverMsg = '✓ บันทึกแล้ว ผู้เล่นที่ออนไลน์อยู่เห็นทันที';
          } catch (e) {
            serverMsg = `บันทึกไม่สำเร็จ: ${(e as Error).message}`;
          }
          buildPanel();
          serverMsg = '';
        };
        button('💾 บันทึกเป็นค่าเริ่มต้นทั้งเซิร์ฟ', () => void saveWith(currentOrbLook(), 'ใช้หน้าตาลูกแก้วนี้กับผู้เล่นทุกคนเลยไหม? ' + '(ค่าต่างสี/ต่างทรงรายลูกจากปุ่มสุ่ม ไม่ถูกบันทึก)'));
        button('คืนค่าของเซิร์ฟเป็นค่าเริ่มต้นในโค้ด', () => void saveWith('reset', 'คืนหน้าตาลูกแก้วของทุกคนเป็นค่าเริ่มต้นในโค้ดไหม?'));
      } else {
        h('div', 'บันทึกค่าของเซิร์ฟได้เฉพาะเจ้าของ (GM ทดลองได้อย่างเดียว)').className = 'note';
      }
    }

    h('h2', 'บันทึกค่า');
    button('คัดลอกค่าที่ตั้งไว้', () => {
      const mix = orbMixState();
      const perSlot = Object.fromEntries(EQUIP_SLOTS.map((s, i) => [s, [mix.palettes[i], mix.shapes[i]]]).filter(([, v]) => (v as unknown[]).some((x) => x)));
      const text = JSON.stringify({ palette: orbPalette().id, shape: orbShape(), ...orbTuning, ...(Object.keys(perSlot).length ? { perSlot } : {}) });
      out.value = text;
      navigator.clipboard?.writeText(text).catch(() => {});
    });
    button('คืนค่าเริ่มต้น (ในโค้ด)', () => {
      applyOrbLook(DEFAULT_ORB_LOOK);
      buildPanel();
    });
    const out = document.createElement('textarea');
    out.readOnly = true;
    out.rows = 3;
    out.style.width = '100%';
    out.placeholder = 'กด "คัดลอกค่าที่ตั้งไว้" แล้ววางข้อความนี้ให้ Claude';
    panel.append(out);

    h('h2', 'ทดสอบความลื่น');
    const n = document.createElement('input');
    n.type = 'number';
    n.min = '0';
    n.max = '60';
    n.value = String(state.extra);
    n.onchange = () => {
      state.extra = Math.max(0, Math.min(60, Number(n.value) || 0));
      rebuildCrowd();
    };
    row('ตัวละครเพิ่ม (+15 ครบ 10 ชิ้น)', n);

    h('h2', 'ตารางระดับ (src/client/orbs.ts)');
    const lines = Object.entries(ORB_LEVELS).map(([p, L]) =>
      `+${p}: ขนาด ${L.size} · แสง ${L.glow} · ประกาย ${L.particles} · หาง ${L.trail}`);
    h('div', lines.join('\n')).setAttribute('style', 'white-space:pre;font-size:11px;color:#9aa3b8');
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
  };
}
