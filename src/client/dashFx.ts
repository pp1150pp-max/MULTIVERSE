// Dash effects, worn as a cosmetic (owner 2026-11-26, docs/systems/cosmetics.md "เอฟเฟกต์แดช"): six styles,
// played on the dash button of every class (not the skills that dash). Each has the same four parts, drawn in
// the style's own way:
//   ends   — a ring standing upright across the path where the dash starts and where it ends, and one on the ground
//   trail  — the path between them: wind speed lines, a flame track, a lightning bolt, blown leaves, a comet tail, smoke
//   ghosts — fading copies of the character's picture left along the path
//   sparks — small bits flying off the path
//   wind    — the owner's picture: blue-white rings, long glowing speed lines, pale afterimages
//   fire    — rings of flame, a burning track with flames rising, embers
//   thunder — a flash at both ends, a jagged bolt along the path flickering, electric sparks
//   leaf    — whirling wind rings, leaves fluttering along the path and drifting off
//   star    — constellation rings, a golden comet streak with twinkling stars, a star burst at the end
//   shadow  — dark vortex rings, smoke puffs along the path, many dark afterimages
// Everything is drawn in code (canvas textures made once; the plain ones are the level-up effect's). Each worn
// piece has its own colours, size, time and parts (cosTuning.ts `dash`, set on the /admin bench).
import * as THREE from 'three';
import { colorHex, type TuneValues } from '../shared/cosTuning';
import { canvas, ease, flamePath, groundMesh, leafPath, plainTex, rnd, shade, sprite, starPath, toTex, type Plain } from './levelUpFx';

export type DashStyle = 'wind' | 'fire' | 'thunder' | 'leaf' | 'star' | 'shadow';

/** Which drawing each dash cosmetic plays. */
export const DASH_STYLE: Readonly<Record<string, DashStyle>> = {
  dash_wind: 'wind',
  dash_fire: 'fire',
  dash_thunder: 'thunder',
  dash_leaf: 'leaf',
  dash_star: 'star',
  dash_shadow: 'shadow',
};

/** One piece's look (its cosTuning values). */
export interface DashLook {
  ends: boolean;
  trail: boolean;
  ghosts: boolean;
  sparks: boolean;
  /** × size of the whole effect. */
  size: number;
  /** How long it lasts, in seconds (the dash itself takes DASH_TIME). */
  sec: number;
  color1: string;
  color2: string;
}

/** A dash cosmetic's tuning values as the effect takes them. */
export const dashLookOf = (v: TuneValues | undefined): DashLook => ({
  ends: v?.ends !== false, trail: v?.trail !== false, ghosts: v?.ghosts !== false, sparks: v?.sparks !== false,
  size: typeof v?.size === 'number' ? v.size : 1, sec: typeof v?.sec === 'number' ? v.sec : 0.55,
  color1: colorHex(v?.color1 ?? 0xc8f4ff), color2: colorHex(v?.color2 ?? 0x3aa8ff),
});

/** The dash button's distance and time (Player.ts: startDash(dx, dz, 4.8, 0.18, 'dash')). */
export const DASH_DIST = 4.8;
export const DASH_TIME = 0.18;

export interface DashOpts {
  /** × the number of sparks (graphics quality, other players, touch screens). 0 = none. */
  particles: number;
  /** Draw the rings, the trail and the afterimages (off: quality "off" or another player's with "others: none"). */
  extras: boolean;
  /** Where the character is `t` seconds after the dash began (the end of the path follows it); null = unknown. */
  at: (t: number) => { x: number; z: number } | null;
  /**
   * A copy of the character's picture as drawn now, placed relative to its feet (add the feet's x / z), for an
   * afterimage; null = no picture to copy (the afterimage is a soft glow instead).
   */
  ghost?: () => THREE.Sprite | null;
}

/** Adds an object to the scene for `life` seconds, ticking it with k = 0…1 (Effects.add). */
export type DashHost = (obj: THREE.Object3D, life: number, tick: (k: number, dt: number) => void) => void;

const TAU = Math.PI * 2;
/** Height of the middle of the body (rings and the bolt are centred there). */
const MID_Y = 0.9;
/** The path keeps following the character this long, then stays put (a wall stops a dash short). */
const FOLLOW = 0.4;

// ------------------------------------------------------------------ textures of the dash's own (white, tinted)

interface DashTex {
  /** A horizontal streak: faint at the back (left), bright toward the head (right). */
  line: THREE.Texture;
  /** A soft band, for tracks on the ground. */
  band: THREE.Texture;
  /** Jagged horizontal bolts, left to right. */
  bolts: THREE.Texture[];
  /** A thin bright ring with a soft glow inside: the upright ring of the wind. */
  portal: THREE.Texture;
}
let own: DashTex | null = null;

function hBolt(): THREE.Texture {
  const [c, x] = canvas(512, 64);
  x.strokeStyle = '#fff';
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.shadowColor = '#fff';
  const pts: [number, number][] = [];
  let py = 32;
  for (let px = 0; px <= 512; px += 28) {
    pts.push([px, py]);
    py = Math.max(10, Math.min(54, py + rnd(-15, 15)));
  }
  pts[0][1] = 32;
  pts[pts.length - 1][1] = 32;
  const line = (p: [number, number][], w: number, blur: number) => {
    x.lineWidth = w;
    x.shadowBlur = blur;
    x.beginPath();
    p.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
    x.stroke();
  };
  line(pts, 7, 14);
  line(pts, 3, 4);
  for (let f = 0; f < 3; f++) {
    const at = 2 + Math.floor(Math.random() * (pts.length - 5));
    const fork: [number, number][] = [pts[at]];
    let [fx, fy] = pts[at];
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < 3; i++) {
      fx += rnd(16, 30);
      fy = Math.max(4, Math.min(60, fy + dir * rnd(5, 10)));
      fork.push([fx, fy]);
    }
    line(fork, 2.5, 6);
  }
  return toTex(c);
}

function dashTex(): DashTex {
  if (own) return own;
  const [l, lc] = canvas(256, 32);
  const lg = lc.createLinearGradient(0, 0, 256, 0);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.7, 'rgba(255,255,255,0.7)');
  lg.addColorStop(0.96, 'rgba(255,255,255,1)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  const vg = lc.createLinearGradient(0, 0, 0, 32);
  lc.fillStyle = lg;
  lc.fillRect(0, 12, 256, 8);
  lc.globalAlpha = 0.35;
  lc.fillRect(0, 6, 256, 20);
  vg.addColorStop(0, 'rgba(0,0,0,1)');
  vg.addColorStop(0.5, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,1)');
  lc.globalAlpha = 1;
  lc.globalCompositeOperation = 'destination-out';
  lc.fillStyle = vg;
  lc.fillRect(0, 0, 256, 32);
  const [b, bc] = canvas(128, 64);
  const bg = bc.createLinearGradient(0, 0, 0, 64);
  bg.addColorStop(0, 'rgba(255,255,255,0)');
  bg.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  bg.addColorStop(1, 'rgba(255,255,255,0)');
  bc.fillStyle = bg;
  bc.fillRect(0, 0, 128, 64);
  const fade = bc.createLinearGradient(0, 0, 128, 0);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.15, 'rgba(0,0,0,0)');
  fade.addColorStop(0.85, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  bc.globalCompositeOperation = 'destination-out';
  bc.fillStyle = fade;
  bc.fillRect(0, 0, 128, 64);
  const [p, pc] = canvas(256, 256);
  const pg = pc.createRadialGradient(128, 128, 60, 128, 128, 118);
  pg.addColorStop(0, 'rgba(255,255,255,0)');
  pg.addColorStop(0.75, 'rgba(255,255,255,0.25)');
  pg.addColorStop(1, 'rgba(255,255,255,0)');
  pc.fillStyle = pg;
  pc.fillRect(0, 0, 256, 256);
  pc.strokeStyle = '#fff';
  pc.shadowColor = '#fff';
  pc.shadowBlur = 14;
  pc.lineWidth = 9;
  pc.beginPath();
  pc.arc(128, 128, 104, 0, TAU);
  pc.stroke();
  pc.lineWidth = 3;
  pc.globalAlpha = 0.7;
  for (const [a, len] of [[0.2, 1.1], [1.9, 0.8], [3.3, 1.3], [5.1, 0.7]]) {
    pc.beginPath();
    pc.arc(128, 128, 88, a, a + len);
    pc.stroke();
  }
  own = { line: toTex(l), band: toTex(b), bolts: Array.from({ length: 3 }, hBolt), portal: toTex(p) };
  return own;
}

// ------------------------------------------------------------------ building blocks

/** What one dash's parts are built into: world coordinates, the path from (x0, z0) along (dx, dz). */
interface Ctx {
  group: THREE.Group;
  ticks: ((t: number, k: number, dt: number) => void)[];
  T: number;
  S: number;
  look: DashLook;
  tex: Plain;
  own: DashTex;
  n: number;
  x0: number;
  z0: number;
  dx: number;
  dz: number;
  /** Path length so far (grows while the character moves, then stays). */
  len: number;
}

/** A point `u` (0 = start, 1 = end) along the path, `side` across it, at height y. */
const along = (c: Ctx, u: number, side = 0): [number, number] => [
  c.x0 + c.dx * c.len * u - c.dz * side,
  c.z0 + c.dz * c.len * u + c.dx * side,
];

function basicMat(map: THREE.Texture, color: string, additive = true): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map, color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/**
 * A band along the path from u0 to u1: one flat plane and one upright plane sharing a material, so it shows
 * whichever way the dash goes on screen. `flatOnly` = only the flat one (a track on the ground).
 */
function band(c: Ctx, map: THREE.Texture, color: string, y: number, side: number, width: number, additive = true, flatOnly = false):
  { set: (u0: number, u1: number) => void; mat: THREE.MeshBasicMaterial } {
  const mat = basicMat(map, color, additive);
  const holder = new THREE.Group();
  const flat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
  holder.add(flat);
  if (!flatOnly) holder.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat));
  holder.rotation.y = Math.atan2(-c.dz, c.dx);
  c.group.add(holder);
  return {
    mat,
    set(u0: number, u1: number): void {
      const l = Math.max(0.01, (u1 - u0) * c.len);
      const [x, z] = along(c, (u0 + u1) / 2, side);
      holder.position.set(x, y, z);
      holder.scale.set(l, width, width);
    },
  };
}

/** An upright ring across the path at point u, facing along it (shows as an ellipse when the dash goes across the screen). */
function portal(c: Ctx, u: number, map: THREE.Texture, color: string, size: number, additive = true): { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; place: () => void } {
  const mat = basicMat(map, color, additive);
  const holder = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * c.S, size * c.S), mat);
  holder.add(mesh);
  holder.rotation.y = Math.atan2(c.dx, c.dz);
  c.group.add(holder);
  return {
    mesh, mat,
    place: () => {
      const [x, z] = along(c, u);
      holder.position.set(x, MID_Y * c.S, z);
    },
  };
}

/**
 * The ring at one end: appears at `at` seconds, grows a little, turns at `spin` and fades by `fadeAt` of the life.
 * `flicker` = random dimming each frame (fire, thunder).
 */
function endRing(c: Ctx, u: number, at: number, map: THREE.Texture, color: string, size: number, opacity: number, spin: number, additive = true, flicker = 0): void {
  const r = portal(c, u, map, color, size, additive);
  r.mesh.visible = false;
  c.ticks.push((t, k, dt) => {
    r.place();
    const q = (t - at) / Math.max(0.05, c.T - at);
    r.mesh.visible = q >= 0 && q <= 1;
    if (!r.mesh.visible) return;
    r.mesh.scale.setScalar(0.6 + 0.5 * ease(Math.min(1, q * 3)));
    r.mesh.rotation.z += spin * dt;
    r.mat.opacity = opacity * Math.min(1, q * 8) * (1 - q) * (flicker ? 1 - flicker * Math.random() : 1);
  });
}

/** A flat ring on the ground at one end, spreading out once. */
function groundWave(c: Ctx, u: number, at: number, map: THREE.Texture, color: string, size: number, additive = true, spin = 0): void {
  const m = groundMesh(map, color, additive);
  m.visible = false;
  c.group.add(m);
  c.ticks.push((t, k, dt) => {
    const q = (t - at) / Math.max(0.05, Math.min(0.5, c.T - at));
    m.visible = q >= 0 && q <= 1;
    if (!m.visible) return;
    const [x, z] = along(c, u);
    m.position.set(x, 0.06, z);
    m.scale.setScalar(size * c.S * (0.35 + 0.75 * ease(q)));
    m.rotation.y += spin * dt;
    m.material.opacity = 0.9 * (1 - q);
  });
}

/**
 * Sprites dotted along the path, each showing from when the dash passes its spot (u × DASH_TIME) for `life`
 * seconds; `f` places and fades it (q = 0…1 of its own life, [x, z] its spot on the path).
 */
function dotted(c: Ctx, count: number, make: (i: number) => THREE.Sprite, life: (i: number) => number, f: (s: THREE.Sprite, q: number, x: number, z: number, i: number) => void, side = 0.5): void {
  for (let i = 0; i < count; i++) {
    const s = make(i);
    const u = Math.random();
    const sd = rnd(-side, side) * c.S;
    const born = u * DASH_TIME + rnd(0, 0.04);
    const l = life(i);
    s.visible = false;
    c.group.add(s);
    c.ticks.push((t) => {
      const q = (t - born) / l;
      s.visible = q >= 0 && q <= 1;
      if (!s.visible) return;
      const [x, z] = along(c, u, sd);
      f(s, q, x, z, i);
    });
  }
}

/** Speed lines along the path: they reach the character, then their back ends catch up with the front and fade. */
function speedLines(c: Ctx, count: number, colors: string[], width: number, spread: number, map = c.own.line): void {
  for (let i = 0; i < count; i++) {
    const y = rnd(0.25, 1.75) * c.S;
    const side = rnd(-spread, spread) * c.S;
    const front = rnd(0.75, 1.05);
    const back = rnd(-0.1, 0.15);
    const b = band(c, map, colors[i % colors.length], y, side, width * c.S * rnd(0.7, 1.3));
    const fadeAt = rnd(0.45, 0.8) * c.T;
    c.ticks.push((t) => {
      const grow = Math.min(1, t / (DASH_TIME + 0.03));
      const shrink = Math.max(0, (t - DASH_TIME) / Math.max(0.05, fadeAt - DASH_TIME));
      const u1 = back + (front - back) * grow;
      const u0 = back + (u1 - back) * Math.min(1, shrink);
      b.set(u0, Math.max(u0 + 0.02, u1));
      b.mat.opacity = Math.max(0, 1 - shrink) * 0.95;
    });
  }
}

// ------------------------------------------------------------------ afterimages

/** Copies of the character's picture left along the path while it moves, fading out. */
function ghosts(c: Ctx, opts: DashOpts, tint: string, opacity: number, every: number, additive = false): void {
  const made: { s: THREE.Sprite; born: number }[] = [];
  let next = 0.02;
  const fade = Math.max(0.15, Math.min(0.45, c.T * 0.7));
  c.ticks.push((t) => {
    if (t >= next && t <= DASH_TIME + 0.02) {
      next = t + every;
      const at = opts.at(t);
      if (at) {
        let s = opts.ghost?.() ?? null;
        if (!s) {
          // No picture to copy: a soft upright glow where the body was.
          s = sprite(c.tex.disc, tint, true);
          s.scale.set(0.7 * c.S, 1.7 * c.S, 1);
          s.position.set(0, 0.9 * c.S, 0);
        }
        const m = s.material;
        m.color.set(tint);
        m.transparent = true;
        m.depthWrite = false;
        m.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
        s.position.x += at.x;
        s.position.z += at.z;
        s.renderOrder = -1;
        c.group.add(s);
        made.push({ s, born: t });
      }
    }
    for (const g of made) {
      const q = (t - g.born) / fade;
      g.s.visible = q < 1;
      g.s.material.opacity = Math.max(0, 1 - q) * opacity;
    }
  });
}

// ------------------------------------------------------------------ the six styles

const wind = {
  ends(c: Ctx): void {
    const { look } = c;
    endRing(c, 0, 0, c.own.portal, look.color1, 1.7, 1, 0);
    endRing(c, 0, 0, c.tex.disc, look.color2, 1.2, 0.45, 0);
    endRing(c, 1, DASH_TIME, c.own.portal, look.color1, 1.9, 1, 0);
    endRing(c, 1, DASH_TIME, c.tex.ringB, '#ffffff', 1.4, 0.8, 4);
    groundWave(c, 0, 0, c.tex.ringB, look.color2, 1.1);
    groundWave(c, 1, DASH_TIME, c.tex.ringB, look.color1, 1.3);
  },
  trail(c: Ctx): void {
    const { look } = c;
    speedLines(c, 9, [look.color1, '#ffffff', look.color2], 0.12, 0.45);
  },
  sparks(c: Ctx): void {
    const { look } = c;
    dotted(c, Math.round(14 * c.n), (i) => sprite(c.tex.spark, i % 2 ? look.color1 : '#ffffff'), () => rnd(0.2, 0.4), (s, q, x, z) => {
      s.position.set(x - c.dx * q * 0.8, (0.3 + q * 0.6) * c.S + s.id % 7 * 0.15 * c.S, z - c.dz * q * 0.8);
      s.scale.setScalar(0.12 * c.S * (1 - q * 0.5));
      s.material.opacity = 1 - q;
    });
  },
};

const fire = {
  ends(c: Ctx): void {
    const { look } = c;
    endRing(c, 0, 0, c.tex.fireRing, look.color1, 1.7, 1, 1.5, true, 0.25);
    endRing(c, 1, DASH_TIME, c.tex.fireRing, look.color1, 1.9, 1, -1.5, true, 0.25);
    endRing(c, 1, DASH_TIME, c.tex.disc, look.color2, 1.4, 0.55, 0, true, 0.2);
    groundWave(c, 0, 0, c.tex.fireRing, look.color2, 1.2, true, 1);
    groundWave(c, 1, DASH_TIME, c.tex.fireRing, look.color1, 1.4, true, -1);
  },
  trail(c: Ctx): void {
    const { look } = c;
    // a burning track on the ground, then flames rising along it
    const track = band(c, c.own.band, look.color2, 0.05, 0, 0.7 * c.S, true, true);
    c.ticks.push((t) => {
      track.set(0, Math.min(1, t / DASH_TIME));
      track.mat.opacity = 0.8 * Math.min(1, t / 0.05) * Math.max(0, 1 - t / c.T) * (0.85 + 0.15 * Math.random());
    });
    dotted(c, 12, (i) => {
      const s = sprite(c.tex.flame, i % 3 ? look.color1 : look.color2);
      s.center.set(0.5, 0.05);
      return s;
    }, () => rnd(0.3, 0.55) * Math.max(0.6, c.T / 0.55), (s, q, x, z) => {
      const h = (0.5 + 0.5 * Math.sin(q * Math.PI)) * 0.9 * c.S;
      s.position.set(x, 0.02, z);
      s.scale.set(h * 0.6, h, 1);
      s.material.opacity = Math.sin(q * Math.PI) * (0.8 + 0.2 * Math.random());
    }, 0.3);
  },
  sparks(c: Ctx): void {
    const { look } = c;
    dotted(c, Math.round(16 * c.n), (i) => sprite(c.tex.spark, i % 3 ? look.color1 : '#ffe6a0'), () => rnd(0.3, 0.6), (s, q, x, z) => {
      s.position.set(x + Math.sin(q * 9 + s.id) * 0.15, (0.1 + q * 1.6) * c.S, z);
      s.scale.setScalar(0.1 * c.S * (1 - q * 0.6));
      s.material.opacity = (1 - q) * (0.6 + 0.4 * Math.random());
    });
  },
};

const thunder = {
  ends(c: Ctx): void {
    const { look } = c;
    // a white flash, then a flickering ring
    endRing(c, 0, 0, c.tex.disc, '#ffffff', 2, 1, 0, true, 0.4);
    endRing(c, 0, 0.02, c.tex.ringA, look.color2, 1.6, 1, 3, true, 0.5);
    endRing(c, 1, DASH_TIME, c.tex.disc, '#ffffff', 2.4, 1, 0, true, 0.4);
    endRing(c, 1, DASH_TIME, c.tex.ringA, look.color1, 1.8, 1, -3, true, 0.5);
    groundWave(c, 0, 0, c.tex.crack, look.color2, 1.2);
    groundWave(c, 1, DASH_TIME, c.tex.crack, look.color1, 1.5);
  },
  trail(c: Ctx): void {
    const { look } = c;
    // a main bolt and two thin ones, each jumping to another bolt picture now and then
    const bolts = [
      { b: band(c, c.own.bolts[0], look.color1, MID_Y * c.S, 0, 0.5 * c.S), a: 1 },
      { b: band(c, c.own.bolts[1], look.color2, (MID_Y + 0.35) * c.S, 0.2 * c.S, 0.3 * c.S), a: 0.8 },
      { b: band(c, c.own.bolts[2], look.color2, (MID_Y - 0.35) * c.S, -0.2 * c.S, 0.3 * c.S), a: 0.8 },
    ];
    let swap = 0;
    c.ticks.push((t) => {
      if (t >= swap) {
        swap = t + 0.05;
        for (const x of bolts) x.b.mat.map = c.own.bolts[Math.floor(Math.random() * c.own.bolts.length)];
      }
      const fade = Math.max(0, 1 - Math.max(0, t - DASH_TIME) / Math.max(0.05, c.T * 0.75 - DASH_TIME));
      for (const x of bolts) {
        x.b.set(0, Math.min(1, t / DASH_TIME));
        x.b.mat.opacity = x.a * fade * (Math.random() < 0.15 ? 0.2 : 1);
      }
    });
  },
  sparks(c: Ctx): void {
    const { look } = c;
    dotted(c, Math.round(14 * c.n), (i) => sprite(c.tex.star4, i % 2 ? look.color1 : '#ffffff'), () => rnd(0.12, 0.3), (s, q, x, z, i) => {
      const a = i * 2.4;
      s.position.set(x + Math.cos(a) * q * 0.7 * c.S, (MID_Y + Math.sin(a) * q * 0.6) * c.S, z + Math.sin(a) * q * 0.7 * c.S);
      s.scale.setScalar(0.22 * c.S * (1 - q));
      s.material.opacity = Math.random() < 0.3 ? 0.3 : 1;
    }, 0.25);
  },
};

const leaf = {
  ends(c: Ctx): void {
    const { look } = c;
    endRing(c, 0, 0, c.tex.windRing, look.color1, 1.7, 1, 6);
    endRing(c, 1, DASH_TIME, c.tex.windRing, look.color1, 1.9, 1, -6);
    endRing(c, 1, DASH_TIME, c.tex.disc, look.color2, 1.2, 0.4, 0);
    groundWave(c, 0, 0, c.tex.windRing, look.color2, 1.2, true, 5);
    groundWave(c, 1, DASH_TIME, c.tex.windRing, look.color1, 1.4, true, -5);
  },
  trail(c: Ctx): void {
    const { look } = c;
    speedLines(c, 4, [look.color1, look.color2], 0.1, 0.35);
    dotted(c, 14, (i) => sprite(c.tex.leaf, i % 2 ? look.color1 : shade(look.color2, 0.15), false), () => rnd(0.35, 0.6) * Math.max(0.6, c.T / 0.55), (s, q, x, z, i) => {
      const side = (i % 2 ? 1 : -1) * q * 0.9 * c.S;
      s.position.set(x - c.dz * side - c.dx * q * 0.4, (0.5 + Math.sin(i) * 0.5 + q * 0.5 - q * q * 0.9) * c.S, z + c.dx * side - c.dz * q * 0.4);
      s.material.rotation = i + q * 9 * (i % 2 ? 1 : -1);
      s.scale.set(0.26 * c.S, 0.34 * c.S, 1);
      s.material.opacity = Math.min(1, q * 6) * (1 - q * q);
    }, 0.35);
  },
  sparks(c: Ctx): void {
    const { look } = c;
    dotted(c, Math.round(12 * c.n), () => sprite(c.tex.spark, look.color1), () => rnd(0.25, 0.45), (s, q, x, z, i) => {
      s.position.set(x + Math.cos(i + q * 6) * 0.3 * c.S, (0.2 + q * 1.2) * c.S, z + Math.sin(i + q * 6) * 0.3 * c.S);
      s.scale.setScalar(0.1 * c.S);
      s.material.opacity = 1 - q;
    });
  },
};

const star = {
  ends(c: Ctx): void {
    const { look } = c;
    endRing(c, 0, 0, c.tex.stars, look.color1, 1.7, 1, 1.5);
    endRing(c, 1, DASH_TIME, c.tex.stars, look.color1, 1.9, 1, -1.5);
    groundWave(c, 0, 0, c.tex.stars, look.color2, 1.2, true, 1);
    groundWave(c, 1, DASH_TIME, c.tex.stars, look.color1, 1.4, true, -1);
    // a big star bursting at the end
    const s = sprite(c.tex.star5, '#ffffff');
    s.visible = false;
    c.group.add(s);
    c.ticks.push((t) => {
      const q = (t - DASH_TIME) / Math.max(0.1, Math.min(0.35, c.T - DASH_TIME));
      s.visible = q >= 0 && q <= 1;
      if (!s.visible) return;
      const [x, z] = along(c, 1);
      s.position.set(x, MID_Y * c.S, z);
      s.scale.setScalar(c.S * (0.4 + 1.1 * ease(q)));
      s.material.rotation = q * 1.2;
      s.material.opacity = 1 - q;
    });
  },
  trail(c: Ctx): void {
    const { look } = c;
    speedLines(c, 3, [look.color1, look.color2, '#ffffff'], 0.28, 0.15);
    dotted(c, 12, (i) => sprite(i % 3 ? c.tex.star4 : c.tex.star5, i % 2 ? look.color1 : '#ffffff'), () => rnd(0.3, 0.55) * Math.max(0.6, c.T / 0.55), (s, q, x, z, i) => {
      s.position.set(x, (MID_Y + Math.sin(i * 1.7) * 0.45) * c.S, z);
      s.scale.setScalar(0.3 * c.S * (1 - q * 0.7) * (0.75 + 0.25 * Math.sin(q * 30 + i)));
      s.material.opacity = 1 - q;
    }, 0.35);
  },
  sparks(c: Ctx): void {
    const { look } = c;
    dotted(c, Math.round(12 * c.n), () => sprite(c.tex.star4, look.color1), () => rnd(0.25, 0.5), (s, q, x, z, i) => {
      s.position.set(x, (0.2 + q * 1.4 + (i % 3) * 0.2) * c.S, z);
      s.scale.setScalar(0.14 * c.S * (0.6 + 0.4 * Math.sin(q * 25 + i)));
      s.material.opacity = 1 - q;
    });
  },
};

const shadow = {
  ends(c: Ctx): void {
    const { look } = c;
    endRing(c, 0, 0, c.tex.vortex, shade(look.color2, -0.2), 1.8, 0.85, 5, false);
    endRing(c, 0, 0, c.tex.ringB, look.color1, 1.5, 0.8, -3);
    endRing(c, 1, DASH_TIME, c.tex.vortex, shade(look.color2, -0.2), 2, 0.85, -5, false);
    endRing(c, 1, DASH_TIME, c.tex.ringB, look.color1, 1.7, 0.8, 3);
    groundWave(c, 0, 0, c.tex.disc, shade(look.color2, -0.4), 1.2, false);
    groundWave(c, 1, DASH_TIME, c.tex.vortex, look.color1, 1.4, true, -4);
  },
  trail(c: Ctx): void {
    const { look } = c;
    dotted(c, 12, (i) => sprite(c.tex.smoke, i % 3 ? shade(look.color2, -0.3) : look.color2, false), () => rnd(0.35, 0.6) * Math.max(0.6, c.T / 0.55), (s, q, x, z, i) => {
      s.position.set(x, (0.5 + (i % 3) * 0.35 + q * 0.5) * c.S, z);
      s.scale.setScalar(c.S * (0.6 + 0.8 * ease(q)));
      s.material.rotation = i + q;
      s.material.opacity = 0.85 * Math.min(1, q * 5) * (1 - q);
    }, 0.3);
    dotted(c, 6, () => sprite(c.tex.smoke, look.color1), () => rnd(0.3, 0.5), (s, q, x, z) => {
      s.position.set(x, (0.9 + q * 0.6) * c.S, z);
      s.scale.setScalar(c.S * (0.4 + 0.5 * q));
      s.material.opacity = 0.5 * (1 - q);
    }, 0.3);
  },
  sparks(c: Ctx): void {
    const { look } = c;
    dotted(c, Math.round(12 * c.n), () => sprite(c.tex.spark, look.color1), () => rnd(0.3, 0.5), (s, q, x, z, i) => {
      s.position.set(x + Math.cos(i * 2) * q * 0.4 * c.S, (0.3 + q * 1.3) * c.S, z + Math.sin(i * 2) * q * 0.4 * c.S);
      s.scale.setScalar(0.11 * c.S);
      s.material.opacity = 1 - q;
    });
  },
};

const STYLES: Record<DashStyle, { ends(c: Ctx): void; trail(c: Ctx): void; sparks(c: Ctx): void }> = { wind, fire, thunder, leaf, star, shadow };
/** Afterimages per style: tint, opacity, seconds between copies, added light (bright) or not. */
const GHOST: Record<DashStyle, (l: DashLook) => [string, number, number, boolean]> = {
  wind: (l) => [shade(l.color1, 0.3), 0.55, 0.035, false],
  fire: (l) => [shade(l.color1, 0.2), 0.5, 0.04, false],
  thunder: (l) => [l.color1, 0.45, 0.04, true],
  leaf: (l) => [shade(l.color1, 0.2), 0.5, 0.04, false],
  star: (l) => [l.color1, 0.45, 0.04, true],
  shadow: (l) => [shade(l.color2, -0.35), 0.65, 0.025, false],
};

/**
 * Plays a dash style starting at (x, z) going toward angle `ang` (radians, x = cos, z = sin). The end follows
 * the character (opts.at) for a moment, so a dash stopped by a wall ends where it stopped.
 * Returns false when nothing would be drawn (the caller plays the old dash).
 */
export function playDash(add: DashHost, x: number, z: number, ang: number, style: DashStyle, look: DashLook, opts: DashOpts): boolean {
  const T = Math.max(0.2, look.sec);
  const S = Math.max(0.1, look.size);
  const group = new THREE.Group();
  const c: Ctx = {
    group, ticks: [], T, S, look, tex: plainTex(), own: dashTex(), n: opts.particles,
    x0: x, z0: z, dx: Math.cos(ang), dz: Math.sin(ang), len: DASH_DIST * 0.25,
  };
  const st = STYLES[style];
  if (look.ends && opts.extras) st.ends(c);
  if (look.trail && opts.extras) st.trail(c);
  if (look.sparks && opts.particles > 0) st.sparks(c);
  if (look.ghosts && opts.extras) {
    const [tint, a, every, additive] = GHOST[style](look);
    ghosts(c, opts, tint, a, every, additive);
  }
  if (!c.ticks.length) return false;
  let grown = 0;
  add(group, T, (k, dt) => {
    const t = k * T;
    if (t <= FOLLOW) {
      // how far along the dash direction the character has got (never back), within the dash's reach
      const p = opts.at(t);
      if (p) grown = Math.max(grown, Math.min(DASH_DIST * 1.05, (p.x - x) * c.dx + (p.z - z) * c.dz));
      c.len = Math.max(0.3, grown);
    }
    for (const f of c.ticks) f(t, k, dt);
  });
  return true;
}

// ------------------------------------------------------------------ the mage's Warp (class passive, owner 2026-11-27)

/** Warp's own numbers: × size, seconds, and the colours (the worn dash cosmetic's, or the /admin purple). */
export interface WarpFxLook { size: number; sec: number; color1: string; color2: string }

/**
 * The mage's Warp: a ring where the character vanished (x1, z1) and one where it appears (x2, z2), each with a magic
 * circle on the ground and bits in the worn dash style (`style` null = none worn: one purple magic circle). No path
 * between them and no afterimages (owner 2026-11-27). False = the graphics menu leaves nothing to draw.
 */
export function playWarp(add: DashHost, x1: number, z1: number, x2: number, z2: number, style: DashStyle | null, look: WarpFxLook, opts: { particles: number; extras: boolean }): boolean {
  if (!opts.extras && opts.particles <= 0) return false;
  const T = Math.max(0.15, look.sec);
  const S = Math.max(0.1, look.size);
  const tex = plainTex();
  const group = new THREE.Group();
  const ticks: ((t: number, dt: number) => void)[] = [];
  // Bits in the style's own shape.
  const bit = style === 'fire' ? tex.flame : style === 'leaf' ? tex.leaf : style === 'star' ? tex.star5 : style === 'shadow' ? tex.smoke
    : style === 'thunder' ? tex.spark : style === 'wind' ? tex.spark : tex.star4;
  const circle = style === 'fire' ? tex.fireRing : style === 'wind' || style === 'leaf' ? tex.windRing : style === 'shadow' ? tex.vortex
    : style === 'star' ? tex.stars : tex.ringA;
  const end = (x: number, z: number, at: number, appear: boolean): void => {
    const life = Math.max(0.1, T - at);
    if (opts.extras) {
      // the magic circle on the ground, turning
      const g = groundMesh(circle, look.color2, style !== 'shadow');
      g.visible = false;
      g.position.set(x, 0.06, z);
      group.add(g);
      // the upright ring: closing in where it vanished, opening out where it appears
      const r = sprite(tex.ringB, look.color1);
      r.visible = false;
      r.position.set(x, MID_Y * S, z);
      group.add(r);
      const glow = sprite(tex.disc, look.color1);
      glow.visible = false;
      glow.position.set(x, MID_Y * S, z);
      group.add(glow);
      ticks.push((t, dt) => {
        const q = (t - at) / life;
        const on = q >= 0 && q <= 1;
        g.visible = r.visible = glow.visible = on;
        if (!on) return;
        const fade = Math.min(1, q * 8) * (1 - q);
        g.scale.setScalar(S * (0.6 + 0.6 * ease(Math.min(1, q * 2))));
        g.rotation.y += (appear ? 2.4 : -2.4) * dt;
        g.material.opacity = 0.9 * fade;
        const k = appear ? 0.4 + 1.2 * ease(Math.min(1, q * 2.5)) : 1.6 - 1.3 * ease(Math.min(1, q * 2.5));
        r.scale.set(1.6 * S * k, 2.2 * S * k, 1);
        r.material.opacity = fade;
        glow.scale.setScalar(1.3 * S * (appear ? 1 - 0.5 * q : 0.5 + 0.5 * (1 - q)));
        glow.material.opacity = 0.55 * (appear ? 1 - q : Math.max(0, 1 - q * 2));
      });
    }
    // bits: drawn in to where it vanished, bursting out where it appears
    const n = Math.round(14 * opts.particles);
    for (let i = 0; i < n; i++) {
      const s = sprite(bit, i % 2 ? look.color1 : look.color2, style !== 'shadow');
      s.visible = false;
      group.add(s);
      const a = rnd(0, TAU);
      const d = rnd(0.7, 1.3) * S;
      const y = rnd(0.2, 1.6) * S;
      const born = at + rnd(0, 0.08);
      const len = rnd(0.25, 0.45) * Math.max(0.6, T / 0.6);
      ticks.push((t) => {
        const q = (t - born) / len;
        s.visible = q >= 0 && q <= 1;
        if (!s.visible) return;
        const out = appear ? ease(q) : 1 - ease(q);
        s.position.set(x + Math.cos(a) * d * out, y + (appear ? q * 0.5 : -q * 0.3) * S, z + Math.sin(a) * d * out);
        s.scale.setScalar((style === 'shadow' ? 0.35 : 0.14) * S * (1 - q * 0.4));
        s.material.opacity = 1 - q;
      });
    }
  };
  end(x1, z1, 0, false);
  end(x2, z2, 0.04, true);
  if (!ticks.length) return false;
  add(group, T, (k, dt) => {
    const t = k * T;
    for (const f of ticks) f(t, dt);
  });
  return true;
}

// ------------------------------------------------------------------ card pictures (shop, fashion bag)

const cards = new Map<string, string>();

/** A still of one style for its card (made once per piece and colours): two rings, the trail and an afterimage. */
export function dashCard(id: string, look: DashLook): string {
  const style = DASH_STYLE[id] ?? 'wind';
  const key = `${id}|${look.color1}|${look.color2}`;
  const had = cards.get(key);
  if (had) return had;
  const [cv, x] = canvas(128, 128);
  const { color1: c1, color2: c2 } = look;
  x.fillStyle = style === 'shadow' ? '#120a1c' : '#0d1016';
  x.fillRect(0, 0, 128, 128);
  // the path goes from bottom left to top right
  const [ax, ay, bx, by] = [26, 92, 104, 46];
  const ring = (cx: number, cy: number, r: number) => {
    x.save();
    x.translate(cx, cy);
    x.rotate(-0.53);
    x.scale(0.42, 1);
    x.strokeStyle = c1;
    x.shadowColor = c1;
    x.shadowBlur = 10;
    x.lineWidth = 6;
    x.beginPath();
    x.arc(0, 0, r, 0, TAU);
    x.stroke();
    x.strokeStyle = '#fff';
    x.lineWidth = 2;
    x.stroke();
    x.restore();
  };
  // an afterimage: a soft figure halfway
  const figure = (fx: number, fy: number, a: number) => {
    x.save();
    x.globalAlpha = a;
    x.fillStyle = style === 'shadow' ? '#2a0f40' : shade(c1, 0.3);
    x.beginPath();
    x.arc(fx, fy - 26, 7, 0, TAU);
    x.fill();
    x.beginPath();
    x.ellipse(fx, fy - 8, 8, 13, 0, 0, TAU);
    x.fill();
    x.restore();
  };
  figure(54, 84, 0.25);
  figure(70, 74, 0.4);
  x.save();
  x.shadowColor = c1;
  x.shadowBlur = 8;
  x.lineCap = 'round';
  const lerp = (u: number, side: number): [number, number] => [ax + (bx - ax) * u + side * 0.5, ay + (by - ay) * u + side];
  if (style === 'wind' || style === 'leaf' || style === 'star') {
    for (let i = 0; i < (style === 'wind' ? 7 : 3); i++) {
      const side = (i - 3) * 6;
      const [sx, sy] = lerp(0.05, side);
      const [ex, ey] = lerp(0.95, side);
      const g = x.createLinearGradient(sx, sy, ex, ey);
      g.addColorStop(0, c1 + '00');
      g.addColorStop(1, i % 2 ? '#ffffff' : c1);
      x.strokeStyle = g;
      x.lineWidth = style === 'star' ? 5 : 2.5;
      x.beginPath();
      x.moveTo(sx, sy - 20);
      x.lineTo(ex, ey - 20);
      x.stroke();
    }
  }
  if (style === 'fire') {
    for (let i = 0; i < 6; i++) {
      const [fx, fy] = lerp(0.1 + i * 0.16, 0);
      const g = x.createLinearGradient(0, fy - 40, 0, fy);
      g.addColorStop(0, '#fff2b0');
      g.addColorStop(0.5, c1);
      g.addColorStop(1, c2);
      x.fillStyle = g;
      flamePath(x, fx, fy, 14, 20 + (i % 2) * 12);
      x.fill();
    }
  } else if (style === 'thunder') {
    x.strokeStyle = '#fff';
    x.shadowColor = c2;
    x.shadowBlur = 14;
    x.lineWidth = 4;
    x.lineJoin = 'round';
    x.beginPath();
    for (let i = 0; i <= 8; i++) {
      const [px, py] = lerp(i / 8, i % 2 ? -8 : 6);
      if (i) x.lineTo(px, py - 20);
      else x.moveTo(px, py - 20);
    }
    x.stroke();
    x.strokeStyle = c1;
    x.lineWidth = 1.5;
    x.stroke();
  } else if (style === 'leaf') {
    for (let i = 0; i < 7; i++) {
      const [lx, ly] = lerp(0.1 + i * 0.13, (i % 2 ? 1 : -1) * 12);
      x.save();
      x.translate(lx, ly - 20);
      x.rotate(i * 1.3);
      x.fillStyle = i % 2 ? c1 : shade(c2, 0.2);
      leafPath(x, 0, 0, 14, 6);
      x.fill();
      x.restore();
    }
  } else if (style === 'star') {
    for (let i = 0; i < 5; i++) {
      const [sx, sy] = lerp(0.15 + i * 0.18, (i % 2 ? 1 : -1) * 9);
      x.fillStyle = i % 2 ? c1 : '#fff';
      starPath(x, sx, sy - 20, i % 2 ? 4 : 5, i % 2 ? 5 : 7, i % 2 ? 1.5 : 3);
      x.fill();
    }
  } else if (style === 'shadow') {
    for (let i = 0; i < 7; i++) {
      const [px, py] = lerp(0.1 + i * 0.13, (i % 2 ? 1 : -1) * 4);
      const r = 14;
      const g = x.createRadialGradient(px, py - 20, 0, px, py - 20, r);
      g.addColorStop(0, i % 2 ? c1 + 'aa' : 'rgba(30,5,45,0.9)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(px - r, py - 20 - r, r * 2, r * 2);
    }
  }
  x.restore();
  ring(ax, ay - 20, 22);
  ring(bx, by - 20, 24);
  // the character at the end
  figure(bx - 4, by + 2, 1);
  const url = cv.toDataURL();
  cards.set(key, url);
  return url;
}
