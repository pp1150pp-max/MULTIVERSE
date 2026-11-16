// The papercraft sword knight bench on /admin → หน้าตา → นักดาบกระดาษ (owner 2026-11-16): the old pixel knight and the
// paper rig (rig/RigActor.ts) side by side, any facing, any animation, any of the 3 swords and 2 armours, slowed down
// if wanted; plus this browser's switch to see the paper knight in the game. Loaded only when the tab opens.
import * as THREE from 'three';
import { animSets, groundTiles, loadGameAssets } from './assets';
import { AnimatedActor } from './AnimatedActor';
import { ISO_DIR } from './world';
import { loadSwordRig, RigActor } from './rig/RigActor';
import { paperSwordOn, setPaperSword } from './rig/paperSwitch';
import { RIG_ARMOR_NAME, RIG_ARMORS, RIG_WEAPON_NAME, RIG_WEAPONS, type RigArmor, type RigWeapon } from '../shared/rigLookTuning';

const CSS = `
.rigp { position: relative; overflow: hidden; background: #10131a; color: #e8e4d8; font: 13px/1.4 system-ui, sans-serif; }
.rigp .rigp-view { position: absolute; inset: 0; }
.rigp .rigp-view canvas { display: block; }
.rigp .rigp-panel { position: absolute; top: 8px; left: 8px; width: 330px; max-width: calc(100% - 16px); max-height: calc(100% - 16px); overflow: auto;
  background: rgba(16, 19, 26, 0.9); border: 1px solid #3a4152; border-radius: 6px; padding: 10px; box-sizing: border-box; }
.rigp h1 { font-size: 15px; margin: 0 0 6px; }
.rigp h2 { font-size: 12px; margin: 10px 0 4px; color: #f2d58a; }
.rigp .row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin: 4px 0; }
.rigp select { background: #1d2230; color: inherit; border: 1px solid #3a4152; border-radius: 3px; padding: 2px 4px; font: inherit; }
.rigp button { background: #2a3245; color: inherit; border: 1px solid #4a5570; border-radius: 3px; padding: 3px 6px; cursor: pointer; font: inherit; }
.rigp .dirs { display: grid; grid-template-columns: repeat(3, 36px); gap: 2px; }
.rigp .dirs button.on { background: #4a5a80; border-color: #8fa8e0; }
.rigp .note { color: #9aa3b8; font-size: 11px; }
.rigp .label { position: absolute; bottom: 10px; font-size: 12px; color: #cfd6e6; background: rgba(0,0,0,.45); padding: 2px 6px; border-radius: 3px; }
`;

/** Screen facings as world (dx, dz), in a 3×3 grid's order (the middle is empty). */
const DIRS: ([number, number] | null)[] = [
  [-1, 0], [-1, -1], [0, -1],
  [-1, 1], null, [1, -1],
  [0, 1], [1, 1], [1, 0],
];
const DIR_ARROW = ['↖', '↑', '↗', '←', '', '→', '↙', '↓', '↘'];
const ANIMS = ['idle', 'run', 'attack', 'attack_2', 'attack_3', 'combo'] as const;
type BenchAnim = (typeof ANIMS)[number];
const ANIM_NAME: Record<BenchAnim, string> = {
  idle: 'ยืน', run: 'วิ่ง', attack: 'ฟัน 1', attack_2: 'ฟัน 2', attack_3: 'ฟัน 3 (กระโดด)', combo: 'คอมโบ 3 จังหวะ',
};

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

/** Mounts the bench in `root` and returns a function that stops it (renderer, frame loop, listeners). */
export async function mountRigPreview(root: HTMLElement): Promise<() => void> {
  if (!document.getElementById('rigp-css')) document.head.append(h('style', { id: 'rigp-css' }, CSS));
  root.classList.add('rigp');
  root.style.height = 'min(78vh, 720px)';
  const viewEl = h('div', { class: 'rigp-view' });
  const panel = h('div', { class: 'rigp-panel' });
  root.replaceChildren(viewEl, panel);

  await loadGameAssets();
  const assets = await loadSwordRig();
  const swordSet = animSets.sword;
  if (!swordSet) throw new Error('ไม่มีภาพนักดาบแบบเดิม');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewEl.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2b3a2a');
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const state = { zoom: 4.2, dir: 7, anim: 'idle' as BenchAnim, speed: 1, weapon: 'katana' as RigWeapon, armor: 'dark' as RigArmor };
  const resize = () => {
    const w = Math.max(1, root.clientWidth);
    const hh = Math.max(1, root.clientHeight);
    renderer.setSize(w, hh);
    const half = state.zoom / 2;
    camera.left = (-half * w) / hh;
    camera.right = (half * w) / hh;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(root);
  resize();
  const target = new THREE.Vector3(0, 0.9, 0);
  camera.position.copy(target).addScaledVector(ISO_DIR, 80);
  camera.lookAt(target);

  const tile = groundTiles.grass;
  const groundMat = new THREE.MeshBasicMaterial({ color: tile ? '#ffffff' : '#3d5a36' });
  if (tile) {
    const t = tile.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    t.needsUpdate = true;
    groundMat.map = t;
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 24).rotateX(-Math.PI / 2), groundMat);
  scene.add(ground);

  // Left of the screen: the old pixel knight; right: the paper one. Screen-left in this camera is (-x, +z).
  const oldKnight = new AnimatedActor(swordSet, 0.4);
  oldKnight.group.position.set(-1.1, 0, 1.1);
  const paper = new RigActor(new AnimatedActor(swordSet, 0.4), assets);
  paper.group.position.set(1.1, 0, -1.1);
  scene.add(oldKnight.group, paper.group);
  const labels = [h('div', { class: 'label', style: 'left: 25%' }, 'แบบเดิม (พิกเซล)'), h('div', { class: 'label', style: 'left: 62%' }, 'แบบกระดูก (กระดาษ)')];
  viewEl.append(...labels);

  // ---- panel
  const sel = <V extends string>(values: readonly V[], names: Record<V, string>, get: () => V, set: (v: V) => void) =>
    h('select', { onchange: (e: Event) => set((e.target as HTMLSelectElement).value as V) },
      ...values.map((v) => h('option', { value: v, selected: get() === v }, names[v])));
  const dirBox = h('div', { class: 'dirs' });
  const drawDirs = () => dirBox.replaceChildren(...DIRS.map((d, i) => d
    ? h('button', { class: state.dir === i ? 'on' : '', onclick: () => { state.dir = i; drawDirs(); drawBones(); } }, DIR_ARROW[i])
    : h('span')));
  drawDirs();
  const speedOut = h('span', {}, '×1');
  // ---- pivots: the rig reads its bones every frame, so editing them in place shows at once.
  const shownView = () => (DIRS[state.dir]![0] + DIRS[state.dir]![1] >= 0 ? 'front' : 'back');
  let boneId = 'upper_arm_f';
  const boneBox = h('div');
  const copyOut = h('span', { class: 'note' });
  const slider = (label: string, get: () => number, set: (v: number) => void) => {
    const out = h('span', {}, get().toFixed(2));
    return h('div', { class: 'row' }, label, h('input', {
      type: 'range', min: '-0.5', max: '1.5', step: '0.01', value: String(get()),
      oninput: (e: Event) => { set(Number((e.target as HTMLInputElement).value)); out.textContent = get().toFixed(2); },
    }), out);
  };
  const drawBones = () => {
    const view = assets.rig.views[shownView()];
    const bone = view.bones.find((b) => b.id === boneId) ?? view.bones[0];
    boneId = bone.id;
    const pick = h('select', { onchange: (e: Event) => { boneId = (e.target as HTMLSelectElement).value; drawBones(); } },
      ...view.bones.map((b) => h('option', { value: b.id, selected: b.id === boneId }, b.id)));
    boneBox.replaceChildren(
      h('div', { class: 'row' }, `ชิ้น (${shownView() === 'front' ? 'มุมหน้า' : 'มุมหลัง'})`, pick),
      slider('จุดหมุน x', () => bone.pivot[0], (v) => { bone.pivot[0] = v; }),
      slider('จุดหมุน y', () => bone.pivot[1], (v) => { bone.pivot[1] = v; }),
      ...(bone.at ? [
        slider('จุดต่อบนชิ้นแม่ x', () => bone.at![0], (v) => { bone.at![0] = v; }),
        slider('จุดต่อบนชิ้นแม่ y', () => bone.at![1], (v) => { bone.at![1] = v; }),
      ] : []),
    );
  };
  const copyRig = async () => {
    const text = JSON.stringify(assets.rig, null, 1);
    try {
      await navigator.clipboard.writeText(text);
      copyOut.textContent = ' คัดลอกแล้ว';
    } catch {
      copyOut.textContent = ' คัดลอกไม่ได้ (เบราว์เซอร์ไม่อนุญาต)';
    }
  };
  drawBones();
  const sw = h('input', { type: 'checkbox', checked: paperSwordOn(), onchange: (e: Event) => setPaperSword((e.target as HTMLInputElement).checked) });
  panel.append(
    h('h1', {}, 'นักดาบกระดาษ (ทดลอง)'),
    h('div', { class: 'note' }, 'ตัวละครแบบกระดูก 2D: ชิ้นกระดาษต่อข้อ ขยับด้วยการหมุนกระดูก ท่าเก็บใน public/assets/sprites/player/sword_rig/rig.json · ท่าตาย ท่าขี่ และท่าฟื้นยังใช้ภาพเดิม'),
    h('h2', {}, 'ดูในเกม (เฉพาะเบราว์เซอร์นี้)'),
    h('label', {}, sw, ' เห็นนักดาบเป็นแบบกระดาษในเกม'),
    h('div', { class: 'note' }, 'คนอื่นยังเห็นแบบเดิม · มีผลตอนเข้าเกมครั้งถัดไป (รีเฟรชหน้าเกม) · ภาพดาบและเกราะตามไอเทม ตั้งในแท็บ ปรับเกม → ปรับสมดุล → "นักดาบกระดาษ"'),
    h('h2', {}, 'ท่า'),
    h('div', { class: 'row' }, 'ท่า', sel(ANIMS, ANIM_NAME, () => state.anim, (v) => { state.anim = v; restart(); })),
    h('div', { class: 'row' }, 'ความเร็ว ', h('input', {
      type: 'range', min: '0.1', max: '1.5', step: '0.05', value: '1',
      oninput: (e: Event) => { state.speed = Number((e.target as HTMLInputElement).value); speedOut.textContent = `×${state.speed}`; },
    }), speedOut),
    h('h2', {}, 'ชุด'),
    h('div', { class: 'row' }, 'ดาบ', sel(RIG_WEAPONS, RIG_WEAPON_NAME, () => state.weapon, (v) => { state.weapon = v; })),
    h('div', { class: 'row' }, 'เกราะ', sel(RIG_ARMORS, RIG_ARMOR_NAME, () => state.armor, (v) => { state.armor = v; })),
    h('h2', {}, 'หันไปทาง'),
    dirBox,
    h('h2', {}, 'จุดหมุน (มุมที่แสดงอยู่)'),
    h('div', { class: 'note' }, 'ปรับจุดต่อของแต่ละชิ้น เห็นผลทันที · ยังไม่บันทึกลงเกม: กด "คัดลอก rig.json" แล้วส่งให้ผู้พัฒนาใส่ไฟล์'),
    boneBox,
    h('div', { class: 'row' }, h('button', { onclick: copyRig }, 'คัดลอก rig.json'), copyOut),
    h('h2', {}, 'ซูม'),
    h('input', { type: 'range', min: '2.5', max: '8', step: '0.1', value: String(state.zoom), oninput: (e: Event) => { state.zoom = Number((e.target as HTMLInputElement).value); resize(); } }),
  );

  // ---- playing: an attack replays every so often; the combo plays the three swings one after another.
  let clock = 0;
  let nextAt = 0;
  let comboStep = 0;
  const restart = () => {
    for (const a of [oldKnight, paper]) a.reset();
    nextAt = clock;
    comboStep = 0;
  };
  const tick = () => {
    if (state.anim === 'idle' || state.anim === 'run') return;
    if (clock < nextAt) return;
    const name = state.anim === 'combo' ? (['attack', 'attack_2', 'attack_3'] as const)[comboStep++ % 3] : state.anim;
    for (const a of [oldKnight, paper]) a.play(name);
    const gap = state.anim === 'combo' ? (comboStep % 3 === 0 ? 1.2 : 0.55) : 1;
    nextAt = clock + gap;
  };

  let stopped = false;
  let last = performance.now();
  const frame = (now: number) => {
    if (stopped) return;
    requestAnimationFrame(frame);
    const dt = (Math.min(0.1, (now - last) / 1000)) * state.speed;
    last = now;
    clock += dt;
    tick();
    const d = DIRS[state.dir]!;
    const moving = state.anim === 'run';
    paper.setLook(state.armor, state.weapon);
    for (const a of [oldKnight, paper]) {
      a.face(d[0], d[1]);
      a.update(dt, moving);
    }
    renderer.render(scene, camera);
  };
  requestAnimationFrame(frame);

  return () => {
    stopped = true;
    ro.disconnect();
    oldKnight.dispose();
    paper.dispose();
    groundMat.map?.dispose();
    groundMat.dispose();
    ground.geometry.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
