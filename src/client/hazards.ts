// Draws the boss ground attacks the server lists in its snapshots. Everything is worked out from the
// hazard's own numbers and the server's clock, so every player sees the same thing at the same time.
import * as THREE from 'three';
import { assetSources, fxSheets, fxTex, sheets } from './assets';
import type { ShellHazard } from '../shared/sim/cannonCrab';
import type { CurseHazard } from '../shared/sim/graveMoves';
import type { FogHazard } from '../shared/sim/ghostCaptain';
import type { InkHazard, SuctionHazard } from '../shared/sim/kraken';
import { imgUrl } from './img';
import { bossFxOn } from './bossFx';
import { cloneShared } from './texShare';
import type { GraspHazard, HexHazard, PoolHazard, VialHazard } from '../shared/sim/bogWitch';
import { beamAngleAt, ringRadiusAt, type BeamsHazard, type BlastHazard, type Hazard, type MeteorHazard, type RingHazard } from '../shared/sim/volcanoHeart';

const WARN = '#ff3a2a';
const SAFE = '#6affa0';
// Red is where it hurts, green is where it doesn't. FIRE is only the falling rock itself.
const FIRE = '#ffb03a';
const HURT = '#ff2a1a';
const Y = 0.08;

const flat = (geo: THREE.BufferGeometry) => geo.rotateX(-Math.PI / 2);

function mat(color: string, opacity: number, map: THREE.Texture | null = null, additive = false): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color, opacity, map, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/** A flat circle, radius 1, from the same pixel-art textures as the other warnings. */
const decal = (m: THREE.MeshBasicMaterial) => new THREE.Mesh(flat(new THREE.PlaneGeometry(2, 2)), m);

/** A piece of a ring on the ground. World angles run the other way round from the flattened geometry's. */
function arc(inner: number, outer: number, from: number, length: number): THREE.BufferGeometry {
  return flat(new THREE.RingGeometry(Math.max(0.01, inner), outer, 48, 1, -(from + length), length));
}

interface View {
  group: THREE.Group;
  /** `outer`: for a wave, how far out its gaps still matter. */
  update(t: number, outer?: number): void;
  /** The server's latest copy of the hazard, for those that move (the witch's vials and curses follow players). */
  sync?(h: Hazard): void;
}

/** Glides a group toward where the server last put its hazard, so snapshot steps don't show. */
function follower(group: THREE.Group): { sync(h: Hazard): void; step(): void } {
  let tx = group.position.x;
  let tz = group.position.z;
  return {
    sync(h) {
      tx = h.x;
      tz = h.z;
    },
    step() {
      group.position.x += (tx - group.position.x) * 0.35;
      group.position.z += (tz - group.position.z) * 0.35;
    },
  };
}

// ---- The Volcano Heart's painted effects (owner 2026-11-21, sheet boss_heart: rows falling rock, impact, fire wave,
// fire beam, blast; the impact and blast are played by the server's effect events). Off (fxLayer.bossFx) = the old look.
const HEART_COLS = 6;
const HEART_ROWS = 5;
const HEART_ROCK = 0;
const HEART_WAVE = 2;
const HEART_BEAM = 3;
/** Most flame pieces one wave draws (a wave near the arena's edge would want dozens). */
const WAVE_PIECES = 40;
/** Flame pieces about this far apart along a wave. */
const WAVE_STEP = 1.5;

/** Its own copy of the heart's sheet (so it can show its own frame), or null when the art is off or missing. */
function heartTex(): THREE.Texture | null {
  const base = fxSheets.boss_heart;
  if (!base || !bossFxOn()) return null;
  // The same GPU picture with its own frame (texShare.ts: a plain clone sends the whole sheet to the GPU again).
  const tex = cloneShared(base);
  tex.userData.ownFrame = true;
  return tex;
}

function heartFrame(tex: THREE.Texture, row: number, frame: number): void {
  tex.repeat.set(1 / HEART_COLS, 1 / HEART_ROWS);
  tex.offset.set((Math.floor(frame) % HEART_COLS) / HEART_COLS, 1 - (row + 1) / HEART_ROWS);
}

function meteorView(h: MeteorHazard): View {
  const group = new THREE.Group();
  const edge = decal(mat(WARN, 0.75, fxTex.edge));
  const fill = decal(mat(WARN, 0.3, fxTex.disc));
  const paper = heartTex();
  // A burning paper rock, or (art off) the old glow.
  const rock = paper
    ? new THREE.Sprite(new THREE.SpriteMaterial({ map: paper, transparent: true, alphaTest: 0.3, depthWrite: false }))
    : new THREE.Sprite(new THREE.SpriteMaterial({ map: fxTex.glow, color: FIRE, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  rock.scale.setScalar(paper ? 2.6 : 1.6);
  group.add(edge, fill, rock);
  group.position.set(h.x, Y, h.z);
  edge.scale.setScalar(h.r);
  return {
    group,
    update(t) {
      const k = Math.min(1, Math.max(0, (t - h.start) / (h.hit - h.start)));
      fill.scale.setScalar(h.r * Math.max(0.01, k));
      rock.position.set(0, (1 - k) * 12 + (paper ? 1.1 : 0.5), 0);
      // Its flames grow as it falls (frame 1 → 6).
      if (paper) heartFrame(paper, HEART_ROCK, k * (HEART_COLS - 0.01));
    },
  };
}

function ringView(h: RingHazard): View {
  const group = new THREE.Group();
  group.position.set(h.x, Y, h.z);
  // Green wedges show the gaps, only over the ground this wave reaches next: from its own front out
  // to the front of the wave ahead. So at any spot, green means safe from the next wave to arrive.
  const safe = new THREE.Mesh(new THREE.BufferGeometry(), mat(SAFE, 0.2));
  const wave = new THREE.Mesh(new THREE.BufferGeometry(), mat(HURT, 0.85));
  group.add(safe, wave);
  const walls = (Math.PI * 2) / h.gaps.length - h.gapArc;
  // A wall of paper flames standing along the wave, two frames apart so it flickers.
  const paperA = heartTex();
  const paperB = paperA && heartTex();
  const flames: THREE.Sprite[] = [];
  if (paperA && paperB) {
    const ma = new THREE.SpriteMaterial({ map: paperA, transparent: true, alphaTest: 0.3, depthWrite: false });
    const mb = new THREE.SpriteMaterial({ map: paperB, transparent: true, alphaTest: 0.3, depthWrite: false });
    for (let i = 0; i < WAVE_PIECES; i++) {
      const s = new THREE.Sprite(i % 2 ? mb : ma);
      s.visible = false;
      flames.push(s);
      group.add(s);
    }
    // The band under them stays (it is what hurts), dimmer.
    (wave.material as THREE.MeshBasicMaterial).opacity = 0.45;
  }
  const inWall = (a: number): boolean => h.gaps.some((g) => {
    const d = ((a - (g + h.gapArc / 2)) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return d <= walls;
  });
  const rebuild = (mesh: THREE.Mesh, geos: THREE.BufferGeometry[]) => {
    mesh.geometry.dispose();
    mesh.geometry = merge(geos);
    for (const geo of geos) geo.dispose();
  };
  return {
    group,
    update(t, outer = h.maxR) {
      const rr = ringRadiusAt(h, t);
      const inner = Math.max(0.2, rr);
      safe.visible = outer > inner;
      if (safe.visible) rebuild(safe, h.gaps.map((g) => arc(inner, outer, g - h.gapArc / 2, h.gapArc)));
      wave.visible = t >= h.hit && rr > 0;
      // The band keeps its width as it grows, so its shape is rebuilt.
      if (wave.visible) rebuild(wave, h.gaps.map((g) => arc(rr - h.width / 2, rr + h.width / 2, g + h.gapArc / 2, walls)));
      if (!flames.length) return;
      const f = t * 12;
      heartFrame(paperA!, HEART_WAVE, f);
      heartFrame(paperB!, HEART_WAVE, f + 3);
      const n = wave.visible ? Math.min(WAVE_PIECES, Math.max(6, Math.round((Math.PI * 2 * rr) / WAVE_STEP))) : 0;
      const size = h.width * 1.9;
      flames.forEach((s, i) => {
        const a = (i / n) * Math.PI * 2;
        s.visible = i < n && inWall(a);
        if (!s.visible) return;
        s.position.set(Math.cos(a) * rr, size * 0.42, Math.sin(a) * rr);
        s.scale.set(size, size, 1);
      });
    },
  };
}

/** Joins indexed pieces into one geometry. */
function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const index: number[] = [];
  for (const g of geos) {
    const start = pos.length / 3;
    pos.push(...(g.getAttribute('position').array as Float32Array));
    for (const i of g.getIndex()!.array) index.push(i + start);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(index);
  return out;
}

function beamsView(h: BeamsHazard): View {
  const group = new THREE.Group();
  group.position.set(h.x, Y + 0.01, h.z);
  const warn = mat(WARN, 0.35);
  const paper = heartTex();
  // With the paper beam on top, the red band under it (what hurts) is dimmer.
  const live = mat(HURT, paper ? 0.4 : 0.8);
  const meshes: THREE.Mesh[] = [];
  const fire: THREE.Mesh[] = [];
  const fireMat = paper && new THREE.MeshBasicMaterial({ map: paper, transparent: true, alphaTest: 0.2, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < h.n; i++) {
    const geo = new THREE.PlaneGeometry(h.len, h.width);
    geo.translate(h.len / 2, 0, 0);
    const mesh = new THREE.Mesh(flat(geo), warn);
    meshes.push(mesh);
    group.add(mesh);
    if (fireMat) {
      // The painted beam: the flame strip fills about the middle half of its cell, so the plane is wider than the band.
      const g2 = new THREE.PlaneGeometry(h.len, h.width * 2.2);
      g2.translate(h.len / 2, 0, 0);
      const m2 = new THREE.Mesh(flat(g2), fireMat);
      m2.position.y = 0.02;
      m2.visible = false;
      fire.push(m2);
      group.add(m2);
    }
  }
  return {
    group,
    update(t) {
      const on = t >= h.hit;
      meshes.forEach((mesh, i) => {
        mesh.material = on ? live : warn;
        mesh.rotation.y = -beamAngleAt(h, i, t);
        if (fire[i]) {
          fire[i].visible = on;
          fire[i].rotation.y = mesh.rotation.y;
        }
      });
      if (paper && on) heartFrame(paper, HEART_BEAM, t * 12);
      if (!on) warn.opacity = 0.2 + 0.3 * Math.min(1, (t - h.start) / (h.hit - h.start));
    },
  };
}

function blastView(h: BlastHazard): View {
  const group = new THREE.Group();
  group.position.set(h.x, Y, h.z);
  const edge = decal(mat(WARN, 0.8, fxTex.edge));
  edge.scale.setScalar(h.r);
  const fill = decal(mat(WARN, 0.34, fxTex.disc));
  group.add(edge, fill);
  const spots = h.safe.map((s) => {
    // Drawn over the red and over each other's edges, so a safe circle can't be missed.
    const m = mat(SAFE, 0.55, fxTex.disc);
    const spot = decal(m);
    spot.position.set(s.x - h.x, 0.02, s.z - h.z);
    spot.scale.setScalar(h.safeR);
    spot.renderOrder = 2;
    const rim = decal(mat(SAFE, 0.95, fxTex.edge));
    rim.position.set(s.x - h.x, 0.03, s.z - h.z);
    rim.scale.setScalar(h.safeR);
    rim.renderOrder = 3;
    group.add(spot, rim);
    return m;
  });
  return {
    group,
    update(t) {
      const k = Math.min(1, Math.max(0, (t - h.start) / (h.hit - h.start)));
      fill.scale.setScalar(h.r * Math.max(0.01, k));
      for (const m of spots) m.opacity = 0.4 + 0.25 * Math.sin(t * 9);
    },
  };
}

// ---- The Bog Witch's spells (shared/sim/bogWitch.ts). Red still means "this will hurt"; the curse is violet.
const HEX_COLOR = '#9a7aff';

/** A standing picture (mud hand, sigil, vial) from the witch's effect sheet, its feet at the origin. */
function witchSprite(key: string, height: number, bottom = true): THREE.Sprite {
  const sheet = sheets[key];
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sheet.texture, transparent: true, depthWrite: false }));
  if (bottom) s.center.set(0.5, 0);
  s.scale.set(height * sheet.cellAspect, height, 1);
  return s;
}

/** A picture lying flat on the ground, radius r (the pool, the curse circle). */
function witchDecal(key: string, r: number, opacity: number): THREE.Mesh {
  const d = decal(mat('#ffffff', opacity, sheets[key].texture));
  d.scale.setScalar(r);
  return d;
}

/** Warning circle that fills up until it lands, like the meteor's. */
function landing(group: THREE.Group, r: number, color: string): (k: number) => void {
  const edge = decal(mat(color, 0.75, fxTex.edge));
  const fill = decal(mat(color, 0.3, fxTex.disc));
  edge.scale.setScalar(r);
  group.add(edge, fill);
  return (k) => fill.scale.setScalar(r * Math.max(0.01, Math.min(1, k)));
}

function vialView(h: VialHazard): View {
  const group = new THREE.Group();
  group.position.set(h.x, Y, h.z);
  const fill = landing(group, h.r, WARN);
  const vial = witchSprite('fx_witch_vial', 0.9, false);
  group.add(vial);
  const follow = follower(group);
  return {
    group,
    sync: follow.sync,
    update(t) {
      follow.step();
      const k = Math.min(1, Math.max(0, (t - h.start) / (h.hit - h.start)));
      fill(k);
      // Flies in an arc from where she stood to whoever it is after, spinning.
      const gx = group.position.x;
      const gz = group.position.z;
      vial.position.set((h.fromX - gx) * (1 - k), 1.2 + Math.sin(Math.PI * k) * 3, (h.fromZ - gz) * (1 - k));
      vial.material.rotation = t * 9;
    },
  };
}

function poolView(h: PoolHazard): View {
  const group = new THREE.Group();
  group.position.set(h.x, Y, h.z);
  const pool = witchDecal('fx_witch_pool', h.r, 0.9);
  const rim = decal(mat(HURT, 0.45, fxTex.edge));
  rim.scale.setScalar(h.r);
  group.add(pool, rim);
  const mats = [pool.material as THREE.MeshBasicMaterial, rim.material as THREE.MeshBasicMaterial];
  const full = mats.map((m) => m.opacity);
  return {
    group,
    update(t) {
      // Grows in fast, fades out over its last half second.
      const grow = Math.min(1, (t - h.start) / 0.25);
      pool.scale.setScalar(h.r * Math.max(0.05, grow));
      const fade = Math.min(1, Math.max(0, (h.end - t) / 0.5));
      mats.forEach((m, i) => (m.opacity = full[i] * fade));
    },
  };
}

function graspView(h: GraspHazard): View {
  const group = new THREE.Group();
  group.position.set(h.x, Y, h.z);
  const fill = landing(group, h.r, WARN);
  const hand = witchSprite('fx_witch_hand', 2.4);
  hand.visible = false;
  group.add(hand);
  return {
    group,
    update(t) {
      fill((t - h.start) / (h.hit - h.start));
      hand.visible = t >= h.hit;
      if (!hand.visible) return;
      // Bursts up, holds, then sinks back into the mud.
      const k = (t - h.hit) / (h.end - h.hit);
      const up = Math.min(1, k / 0.2) * Math.min(1, (1 - k) / 0.3);
      hand.position.y = -2.4 * (1 - Math.max(0, up));
      // Sways from the wrist while it holds on.
      hand.material.rotation = Math.sin(t * 7) * 0.14 * Math.max(0, up);
    },
  };
}

function hexView(h: HexHazard): View {
  const group = new THREE.Group();
  group.position.set(h.x, Y, h.z);
  const circle = witchDecal('fx_witch_circle', h.r, 0.95);
  const fill = landing(group, h.r, HEX_COLOR);
  const sigil = witchSprite('fx_witch_sigil', 1.1, false);
  // Flashes white over the circle once it stops: the moment to dash out.
  const flash = decal(mat('#ffffff', 0, fxTex.disc, true));
  flash.scale.setScalar(h.r);
  group.add(circle, sigil, flash);
  const follow = follower(group);
  let lock = h.lock;
  return {
    group,
    sync(x) {
      follow.sync(x);
      if (x.k === 'hex') lock = x.lock;
    },
    update(t) {
      // Follows its player until it locks, then stays put.
      if (t < lock) follow.step();
      fill((t - h.start) / (lock - h.start));
      circle.rotation.y = t * (t < lock ? 0.8 : 4);
      sigil.position.set(0, 3 + Math.sin(t * 5) * 0.15, 0);
      sigil.material.opacity = 0.6 + 0.4 * Math.sin(t * 12);
      (flash.material as THREE.MeshBasicMaterial).opacity = t >= lock ? 0.25 + 0.35 * (Math.sin(t * 40) > 0 ? 1 : 0) : 0;
    },
  };
}

// ---- The Giant Cannon Crab's cannonballs (shared/sim/cannonCrab.ts): a warning ring on the ground, a ball in an arc.

/** Its paper picture (fx_cannonball, fx_warn_ring) once cut, else null (the plain warning and a dark glow instead). */
const paperFx = (key: string): THREE.Texture | null => (assetSources[key] === 'file' ? sheets[key]?.texture ?? null : null);

function shellView(h: ShellHazard): View {
  const group = new THREE.Group();
  group.position.set(h.x, Y, h.z);
  const ringTex = paperFx('fx_warn_ring');
  const fill = landing(group, h.r, WARN);
  if (ringTex) {
    const ring = decal(mat('#ffffff', 0.9, ringTex));
    ring.scale.setScalar(h.r);
    ring.position.y = 0.01;
    group.add(ring);
  }
  const ballTex = paperFx('fx_cannonball');
  const ball = new THREE.Sprite(new THREE.SpriteMaterial(ballTex
    ? { map: ballTex, transparent: true, depthWrite: false }
    : { map: fxTex.glow, color: '#3a3430', transparent: true, depthWrite: false }));
  ball.scale.setScalar(ballTex ? 1.1 : 1.4);
  group.add(ball);
  return {
    group,
    update(t) {
      const k = Math.min(1, Math.max(0, (t - h.start) / (h.hit - h.start)));
      fill(k);
      // Fired up from the crab, falling onto the circle.
      ball.visible = t < h.hit;
      ball.position.set((h.fromX - h.x) * (1 - k), 1 + Math.sin(Math.PI * k) * 7 * (1 - k * 0.6), (h.fromZ - h.z) * (1 - k));
      ball.material.rotation = t * 6;
    },
  };
}

/** The Ghost Ship Graveyard: a ghost monkey's curse ring (paper fx_curse_ring, or a teal disc), fading out at its end. */
function curseView(h: CurseHazard): View {
  const group = new THREE.Group();
  group.position.set(h.x, Y, h.z);
  const tex = paperFx('fx_curse_ring');
  const ring = decal(mat(tex ? '#ffffff' : '#5ad8c0', tex ? 0.9 : 0.35, tex ?? fxTex.disc));
  const rim = decal(mat('#5ad8c0', 0.5, fxTex.edge));
  rim.scale.setScalar(h.r);
  group.add(ring, rim);
  const mats = [ring.material as THREE.MeshBasicMaterial, rim.material as THREE.MeshBasicMaterial];
  const full = mats.map((m) => m.opacity);
  return {
    group,
    update(t) {
      const grow = Math.min(1, (t - h.start) / 0.25);
      ring.scale.setScalar(h.r * Math.max(0.05, grow));
      ring.rotation.y = t * 0.6;
      const fade = Math.min(1, Math.max(0, (h.end - t) / 0.5));
      mats.forEach((m, i) => (m.opacity = full[i] * fade));
    },
  };
}

/** Where the fog's clear circle is: this browser's own player (HazardViews.update sets it). */
const fogCentre = { x: 0, z: 0 };
/** How far out the fog reaches past the clear circle (past any arena). */
const FOG_OUTER = 90;

/**
 * The Ghost Captain's fog: dark mist over everything but a circle around this browser's own player, drawn over the
 * whole scene (no depth test), closing in until `hit` and lifting over its last half second.
 */
function fogView(h: FogHazard): View {
  const group = new THREE.Group();
  const soft = new THREE.Mesh(arc(h.r, h.r + 1.6, 0, Math.PI * 2), mat('#0c1a20', 0.5));
  const thick = new THREE.Mesh(arc(h.r + 1.6, FOG_OUTER, 0, Math.PI * 2), mat('#0c1a20', 0.88));
  for (const o of [soft, thick]) {
    (o.material as THREE.MeshBasicMaterial).depthTest = false;
    o.renderOrder = 900;
    group.add(o);
  }
  group.position.y = 0.2;
  const mats = [soft.material as THREE.MeshBasicMaterial, thick.material as THREE.MeshBasicMaterial];
  const full = mats.map((m) => m.opacity);
  return {
    group,
    update(t) {
      group.position.x = fogCentre.x;
      group.position.z = fogCentre.z;
      const k = Math.min(1, Math.max(0, (t - h.start) / Math.max(0.01, h.hit - h.start))) * Math.min(1, Math.max(0, (h.end - t) / 0.5));
      mats.forEach((m, i) => (m.opacity = full[i] * k));
    },
  };
}

/** This browser's own player id (HazardViews.update sets it): the kraken's ink covers only its victim's screen. */
let myId = -1;

/**
 * The kraken's ink on this browser's own screen (sim/kraken.ts): ink blots over the page (not the world), splashing in at once and
 * running off over its last second. Someone else's ink draws nothing here.
 */
function inkView(h: InkHazard): View {
  const group = new THREE.Group();
  if (h.pid !== myId || typeof document === 'undefined') return { group, update() {} };
  const el = document.createElement('div');
  el.className = 'kraken-ink';
  el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40;overflow:hidden;';
  const src = imgUrl('assets/sprites/paper/fx/fx_ink_splat.png');
  // A few big blots over the middle of the screen, with gaps between them to peek through.
  const BLOTS: [number, number, number, number][] = [[50, 48, 62, 0], [22, 30, 46, 40], [78, 34, 44, 160], [30, 74, 50, 260], [74, 72, 48, 90], [52, 18, 36, 200]];
  for (const [x, y, w, rot] of BLOTS) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.draggable = false;
    img.style.cssText = `position:absolute;left:${x}%;top:${y}%;width:${w}vmin;transform:translate(-50%,-50%) rotate(${rot}deg);opacity:0.92;`;
    el.appendChild(img);
  }
  document.body.appendChild(el);
  // Removed with the group (disposeGroup runs on every view that goes).
  group.userData.dom = el;
  return {
    group,
    update(t) {
      el.style.opacity = String(Math.min(1, Math.max(0, h.end - t)));
    },
  };
}

/** The kraken's whirlpool pulling (sim/kraken.ts): rings closing in on it across the room, faint while it warns, strong while it pulls. */
function suctionView(h: SuctionHazard): View {
  const group = new THREE.Group();
  group.position.set(h.x, Y, h.z);
  const mats: THREE.MeshBasicMaterial[] = [];
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const m = mat('#8ae0f0', 0.5);
    mats.push(m);
    const ring = new THREE.Mesh(arc(0.92, 1, 0, Math.PI * 2), m);
    rings.push(ring);
    group.add(ring);
  }
  return {
    group,
    update(t) {
      const on = t >= h.hit;
      const fade = Math.min(1, Math.max(0, (h.end - t) / 0.4)) * Math.min(1, Math.max(0, (t - h.start) / 0.3));
      rings.forEach((ring, i) => {
        // Each ring runs from the room's edge in to the whirlpool, over and over.
        const k = 1 - ((((t - h.start) * (on ? 0.6 : 0.25)) + i / rings.length) % 1);
        ring.scale.setScalar(Math.max(0.5, h.r * k));
        mats[i].opacity = (on ? 0.55 : 0.22) * fade * Math.min(1, k * 2);
      });
    },
  };
}

const MAKE: { [K in Hazard['k']]: (h: Extract<Hazard, { k: K }>) => View } = {
  shell: shellView, curse: curseView, fog: fogView, ink: inkView, suction: suctionView,
  meteor: meteorView, ring: ringView, beams: beamsView, blast: blastView,
  vial: vialView, pool: poolView, grasp: graspView, hex: hexView,
};

function disposeGroup(g: THREE.Object3D): void {
  (g.userData.dom as HTMLElement | undefined)?.remove();
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    } else if (o instanceof THREE.Sprite) o.material.dispose();
    // The Volcano Heart's own sheet copies (heartTex).
    const map = (o as THREE.Mesh | THREE.Sprite).material && ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).map;
    if (map?.userData.ownFrame && !map.userData.disposed) {
      map.userData.disposed = true;
      map.dispose();
    }
  });
}

export class HazardViews {
  private readonly views = new Map<number, View>();

  constructor(private readonly scene: THREE.Scene) {}

  /** `me`: this browser's own player (the Ghost Captain's fog clears around them). */
  update(list: readonly Hazard[], time: number, me?: { x: number; z: number; id?: number }): void {
    if (me) {
      fogCentre.x = me.x;
      fogCentre.z = me.z;
      myId = me.id ?? -1;
    }
    const seen = new Set<number>();
    // Oldest wave first: each one's gaps stop where the wave ahead of it has got to.
    const outer = new Map<number, number>();
    let ahead: RingHazard | null = null;
    for (const h of list) {
      if (h.k !== 'ring') continue;
      if (ahead) outer.set(h.id, ringRadiusAt(ahead, time));
      ahead = h;
    }
    for (const h of list) {
      seen.add(h.id);
      let v = this.views.get(h.id);
      if (!v) {
        v = (MAKE[h.k] as (x: Hazard) => View)(h);
        this.views.set(h.id, v);
        this.scene.add(v.group);
      }
      v.sync?.(h);
      v.update(time, outer.get(h.id));
    }
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      this.scene.remove(v.group);
      disposeGroup(v.group);
      this.views.delete(id);
    }
  }
}
