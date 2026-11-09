/// <reference types="vite/client" />
// Dev-only preview of the enhancement orbs (orbs.html, `npm run dev` → http://localhost:5173/orbs.html).
// Uses the game's own character views, effects and orb renderer, so it looks like the game; the panel
// switches palettes and sets each worn place's + level. Not a build input, so players never get it.
import * as THREE from 'three';
import { loadGameAssets, groundTiles } from '../client/assets';
import { Effects } from '../client/effects';
import { PlayerView } from '../client/views';
import { ISO_DIR } from '../client/world';
import { ORB_LEVELS, ORB_PALETTES, orbPalette, orbTuning, setOrbPalette } from '../client/orbs';
import { Player } from '../shared/sim/Player';
import type { Sim } from '../shared/sim/Sim';
import { auraTier, orbCodes, ORB_MIN_PLUS } from '../shared/data/enhance';
import { CLASS_IDS } from '../shared/data/classes';
import { EQUIP_SLOTS, EQUIP_SLOT_LABEL, type ClassId, type EquipSlot, type Item } from '../shared/types';

if (!import.meta.env.DEV) throw new Error('orb preview is for npm run dev only');

const NO_SIM = null as unknown as Sim;
const $ = (id: string) => document.getElementById(id)!;

/** + level per worn place (0 = nothing at +7 or more). */
const levels: Record<EquipSlot, number> = Object.fromEntries(EQUIP_SLOTS.map((s) => [s, 0])) as Record<EquipSlot, number>;
levels.weapon = 7;
levels.armor = 7;
levels.ring = 15;

const state = { cls: 'sword' as ClassId, aura: true, walk: false, extra: 0, zoom: 17 };

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

async function main(): Promise<void> {
  await loadGameAssets();

  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  $('view').append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2b3a2a');
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    const aspect = window.innerWidth / window.innerHeight;
    const h = state.zoom / 2;
    camera.left = -h * aspect;
    camera.right = h * aspect;
    camera.top = h;
    camera.bottom = -h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  camera.position.copy(ISO_DIR).multiplyScalar(80);
  camera.lookAt(0, 0, 0);

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
  const loop = (now: number) => {
    frame(now);
    requestAnimationFrame(loop);
  };
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (state.walk) {
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
    for (const c of crowd) c.v.update(dt, fx);
    fx.update(dt);
    renderer.render(scene, camera);
    frames++;
    fpsT += dt;
    if (fpsT >= 0.5) {
      $('stats').textContent = `${Math.round(frames / fpsT)} FPS · ลูกแก้วตัวหลัก ${hero.orbs.length} · ตัวละครเพิ่ม ${crowd.length} (×10 ลูก) · draw calls ${renderer.info.render.calls}`;
      frames = 0;
      fpsT = 0;
    }
  };
  requestAnimationFrame(loop);

  function buildPanel(): void {
    const panel = $('panel');
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
    const button = (text: string, on: () => void) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = on;
      panel.append(b);
    };

    h('h1', 'ทดลองลูกแก้วตีบวก');
    h('div', 'หน้านี้มีเฉพาะตอน npm run dev (ผู้เล่นไม่เห็น)').className = 'note';

    h('h2', 'ชุดสี');
    row('ชุดสี', select(ORB_PALETTES.map((p) => [p.id, p.name]), orbPalette().id, (v) => setOrbPalette(v)));

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
    row('ตาย (ซ่อนลูกแก้ว)', check(!hero.alive, (v) => {
      hero.alive = !v;
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

    h('h2', 'ปรับขนาด/การหมุน (ทุกระดับพร้อมกัน)');
    row('ขนาด ×', slider(0.5, 2.5, 0.1, orbTuning.scale, (v) => { orbTuning.scale = v; }));
    row('รัศมีวง', slider(0.6, 1.6, 0.05, orbTuning.radius, (v) => { orbTuning.radius = v; }));
    row('รอบ/วินาที', slider(0.05, 0.6, 0.01, orbTuning.speed, (v) => { orbTuning.speed = v; }));
    row('ซูมกล้อง (เกมจริง 17)', slider(4, 17, 1, state.zoom, (v) => { state.zoom = v; resize(); }));

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
}

main().catch((e) => {
  $('panel').textContent = `โหลดไม่สำเร็จ: ${e}`;
  console.error(e);
});
