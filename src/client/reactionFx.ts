// What each element reaction looks like (owner 2026-11-27: "code-drawn effects when elements mix"). All drawn in code
// (no pictures): every reaction mixes the colours and the feel of its two elements. Sim sends
// fx('reaction', id, x, z, r, hits): where it went off, its radius and the spots of the monsters it reached.
// The amount of particles follows the player's graphics menu (gfxParticles), with a small floor so it always reads.
import * as THREE from 'three';
import { fxTex } from './assets';
import { gfxParticles } from './gfxPrefs';
import type { ReactionId } from '../shared/elementTuning';

type Add = (obj: THREE.Object3D, life: number, tick?: (k: number, dt: number) => void) => void;

const C = {
  water: '#4aa8ff', waterHi: '#bfe6ff',
  fire: '#ff6a1a', fireHi: '#ffd24a',
  poison: '#6ad83a', poisonDark: '#2f7a1c', poisonHi: '#c8ff6a',
  lightning: '#ffe84a', lightningHi: '#ffffff',
  wind: '#8ff0d4', windHi: '#e8fff8',
  steam: '#e8f2f8', ice: '#d8f4ff', plasma: '#c58aff',
};

const glow = (color: string, size: number, opacity = 1, additive = true): THREE.Sprite => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: fxTex.glow, color, transparent: true, depthWrite: false, opacity,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  s.scale.set(size, size, 1);
  return s;
};

const groundMat = (color: string, opacity: number, map: THREE.Texture, additive = true): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, map, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });

/** A flat decal on the ground (ring / disc texture), scaled by radius. */
const decal = (m: THREE.MeshBasicMaterial): THREE.Mesh => new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), m);

/** A jagged electric arc between two points at height y: short flat segments jittered sideways, flickering. */
function arc(add: Add, x1: number, z1: number, x2: number, z2: number, y: number, color: string, life: number, width = 0.14, jag = 0.35): void {
  const len = Math.hypot(x2 - x1, z2 - z1);
  if (len < 0.05) return;
  const n = Math.max(3, Math.round(len / 0.45));
  const nx = -(z2 - z1) / len;
  const nz = (x2 - x1) / len;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 2 * jag;
    pts.push([x1 + (x2 - x1) * t + nx * off, z1 + (z2 - z1) * t + nz * off]);
  }
  const g = new THREE.Group();
  const mats: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < n; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const l = Math.hypot(bx - ax, bz - az);
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    mats.push(m);
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(l + 0.04, width).rotateX(-Math.PI / 2), m);
    seg.position.set((ax + bx) / 2, y, (az + bz) / 2);
    seg.rotation.y = -Math.atan2(bz - az, bx - ax);
    g.add(seg);
  }
  add(g, life, (k) => {
    const o = (1 - k) * (0.55 + 0.45 * Math.random());
    for (const m of mats) m.opacity = o;
  });
}

/** A standing bolt from the sky onto (x, z): a tall thin glow, a flash on the ground. */
function skyBolt(add: Add, x: number, z: number, color: string, life: number): void {
  const s = glow(color, 1, 1);
  s.scale.set(0.35, 6, 1);
  s.position.set(x, 3, z);
  add(s, life, (k) => {
    s.material.opacity = (1 - k) * (0.6 + 0.4 * Math.random());
  });
  const f = glow(C.lightningHi, 1.6, 1);
  f.position.set(x, 0.2, z);
  add(f, life, (k) => {
    f.material.opacity = 1 - k;
  });
}

/** A ring on the ground growing to `radius`. */
function ring(add: Add, x: number, z: number, radius: number, color: string, life: number, from = 0.2): void {
  const m = groundMat(color, 0.9, fxTex.ring);
  const mesh = decal(m);
  mesh.position.set(x, 0.07, z);
  add(mesh, life, (k) => {
    mesh.scale.setScalar(Math.max(0.05, radius * (from + (1 - from) * Math.sqrt(k))));
    m.opacity = 0.9 * (1 - k);
  });
}

/** A soft disc on the ground (a pool), fading in and out. */
function pool(add: Add, x: number, z: number, radius: number, color: string, life: number, additive = false): void {
  const m = groundMat(color, 0, fxTex.disc, additive);
  const mesh = decal(m);
  mesh.position.set(x, 0.05, z);
  mesh.scale.setScalar(radius);
  add(mesh, life, (k) => {
    m.opacity = 0.5 * Math.min(1, k * 5) * (1 - k);
  });
}

/** A glow that moves with a velocity (and gravity `grav`), shrinking / fading out. */
function spark(add: Add, x: number, y: number, z: number, vx: number, vy: number, vz: number, color: string, size: number, life: number, grav = 0, additive = true): void {
  const s = glow(color, size, 1, additive);
  s.position.set(x, y, z);
  let v = vy;
  add(s, life, (k, dt) => {
    s.position.x += vx * dt;
    s.position.z += vz * dt;
    s.position.y = Math.max(0.05, s.position.y + v * dt);
    v -= grav * dt;
    s.material.opacity = 1 - k;
    s.scale.setScalar(size * (1 - 0.4 * k));
  });
}

/** A soft cloud puff that grows while it rises and fades (steam, smoke, fog). */
function cloud(add: Add, x: number, y: number, z: number, vx: number, vy: number, vz: number, color: string, size: number, life: number, alpha = 0.7): void {
  const s = glow(color, size * 0.5, 0, false);
  s.position.set(x, y, z);
  add(s, life, (k, dt) => {
    s.position.x += vx * dt;
    s.position.y += vy * dt;
    s.position.z += vz * dt;
    s.scale.setScalar(size * (0.5 + 0.8 * k));
    s.material.opacity = alpha * Math.min(1, k * 6) * (1 - k);
  });
}

/** Particles on a spiral around (x, z): turning `spin` rad/s, radius from r0 to r1, rising `rise` m/s. */
function swirl(add: Add, x: number, z: number, n: number, r0: number, r1: number, spin: number, rise: number, colors: string[], size: number, life: number): void {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const s = glow(colors[i % colors.length], size, 1);
    const y0 = 0.2 + Math.random() * 0.6;
    const delay = Math.random() * 0.15;
    add(s, life, (k) => {
      const t = Math.max(0, k - delay) / (1 - delay);
      const a = a0 + spin * t * life;
      const r = r0 + (r1 - r0) * t;
      s.position.set(x + Math.cos(a) * r, y0 + rise * t * life, z + Math.sin(a) * r);
      s.material.opacity = t <= 0 ? 0 : 1 - t;
    });
  }
}

/** A small flat diamond (an ice shard / a flake) spinning on the ground plane, flying from `from` to `to`. */
function shard(add: Add, fx: number, fz: number, tx: number, tz: number, y: number, color: string, size: number, life: number): void {
  const geo = new THREE.PlaneGeometry(size * 0.45, size).rotateX(-Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, map: fxTex.glow, blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(geo, m);
  const spin = (Math.random() - 0.5) * 12;
  add(mesh, life, (k) => {
    const e = 1 - (1 - k) * (1 - k);
    mesh.position.set(fx + (tx - fx) * e, y, fz + (tz - fz) * e);
    mesh.rotation.y = spin * k;
    m.opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
  });
}

/** The spots of the monsters a reaction reached, as pairs (Sim sends them flat: x0, z0, x1, z1 ...). */
const spots = (hits: number[]): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < hits.length; i += 2) out.push([hits[i], hits[i + 1]]);
  return out;
};

/**
 * Plays reaction `id` at (x, z), `r` its radius (0 = the target alone), `hits` the monsters it reached. Particle counts
 * × the graphics menu's particle amount, never below a third, so a reaction always reads.
 */
export function playReaction(add: Add, id: ReactionId, x: number, z: number, r: number, hits: number[]): void {
  const amt = Math.max(0.35, gfxParticles());
  const N = (n: number) => Math.max(2, Math.round(n * amt));
  const rad = Math.max(1.2, r);
  const rnd = (s: number) => (Math.random() - 0.5) * 2 * s;
  const others = spots(hits).filter(([hx, hz]) => Math.hypot(hx - x, hz - z) > 0.3);
  switch (id) {
    case 'water+lightning': {
      // Electrocute: a splash of water, then lightning running from the target to every monster it spread to.
      pool(add, x, z, 1.4, C.water, 0.7, true);
      ring(add, x, z, rad, C.water, 0.45);
      for (let i = 0; i < N(10); i++) spark(add, x, 0.4, z, rnd(3), 3 + Math.random() * 2, rnd(3), C.waterHi, 0.3, 0.5, 14);
      for (const [hx, hz] of others) {
        arc(add, x, z, hx, hz, 0.9, C.lightning, 0.35);
        arc(add, x, z, hx, hz, 0.9, C.water, 0.25, 0.08, 0.5);
        spark(add, hx, 0.9, hz, 0, 0, 0, C.lightningHi, 1.2, 0.3);
      }
      for (let i = 0; i < N(4); i++) arc(add, x, z, x + rnd(1.6), z + rnd(1.6), 0.9, C.lightning, 0.25, 0.08);
      spark(add, x, 0.9, z, 0, 0, 0, C.lightningHi, 2, 0.25);
      break;
    }
    case 'water+fire': {
      // Steam Burst: an orange flash in the middle, then a thick white steam cloud billowing out and up.
      spark(add, x, 0.8, z, 0, 0, 0, C.fireHi, 2.6, 0.25);
      ring(add, x, z, rad, C.steam, 0.55);
      for (let i = 0; i < N(14); i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 1.2 + Math.random() * 1.8;
        cloud(add, x, 0.4, z, Math.cos(a) * v, 0.8 + Math.random() * 1.2, Math.sin(a) * v, i % 4 ? C.steam : C.waterHi, 1.8 + Math.random(), 0.9 + Math.random() * 0.4, 0.75);
      }
      for (let i = 0; i < N(8); i++) spark(add, x, 0.6, z, rnd(4), 2 + Math.random() * 3, rnd(4), C.fire, 0.3, 0.45, 10);
      break;
    }
    case 'water+wind': {
      // Freeze (slows): ice shards whirled in by the wind onto the target, a frost ring and a cold mist.
      pool(add, x, z, 1.6, C.ice, 0.9, true);
      for (let i = 0; i < N(12); i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 2 + Math.random() * 1.5;
        shard(add, x + Math.cos(a) * d, z + Math.sin(a) * d, x + rnd(0.4), z + rnd(0.4), 0.3 + Math.random() * 1.1, i % 2 ? C.ice : C.water, 0.5, 0.5 + Math.random() * 0.2);
      }
      swirl(add, x, z, N(10), 1.8, 0.4, 5, 0.6, [C.wind, C.waterHi], 0.4, 0.6);
      ring(add, x, z, 1.6, C.ice, 0.6, 1);
      for (let i = 0; i < N(5); i++) cloud(add, x + rnd(0.8), 0.2, z + rnd(0.8), rnd(0.3), 0.3, rnd(0.3), C.ice, 1.4, 0.9, 0.45);
      break;
    }
    case 'water+poison': {
      // Soaked in Poison: a dark green pool and green bubbles welling up and popping.
      pool(add, x, z, 1.5, C.poisonDark, 1.4);
      pool(add, x, z, 1.1, C.water, 1.2, true);
      for (let i = 0; i < N(14); i++) {
        const delay = Math.random() * 0.6;
        const bx = x + rnd(0.9);
        const bz = z + rnd(0.9);
        const s = glow(i % 3 ? C.poison : C.waterHi, 0.25, 0);
        const top = 0.6 + Math.random() * 1.2;
        add(s, 1.3, (k) => {
          const t = Math.max(0, (k * 1.3 - delay) / 0.7);
          s.position.set(bx + Math.sin(t * 9) * 0.06, 0.1 + top * Math.min(1, t), bz);
          s.scale.setScalar(0.18 + 0.25 * Math.min(1, t));
          s.material.opacity = t <= 0 || t >= 1 ? 0 : 0.95;
        });
      }
      break;
    }
    case 'fire+wind': {
      // Firestorm: a turning column of flames spreading out to the radius.
      swirl(add, x, z, N(26), 0.4, rad, 7, 1.2, [C.fire, C.fireHi, C.fire, C.wind], 0.55, 0.9);
      ring(add, x, z, rad, C.fire, 0.7);
      for (const [hx, hz] of others) {
        for (let i = 0; i < N(4); i++) spark(add, hx, 0.3, hz, rnd(1), 2 + Math.random() * 2, rnd(1), C.fire, 0.45, 0.6, 3);
      }
      for (let i = 0; i < N(6); i++) cloud(add, x + rnd(1), 0.5, z + rnd(1), rnd(0.6), 1.2, rnd(0.6), '#5a4a42', 1.6, 1.0, 0.35);
      break;
    }
    case 'fire+poison': {
      // Toxic Blast: a sickly green flash with a burning orange heart, then a green-black smoke bloom.
      spark(add, x, 0.9, z, 0, 0, 0, C.poisonHi, 3, 0.3);
      spark(add, x, 0.9, z, 0, 0, 0, C.fire, 1.8, 0.35);
      ring(add, x, z, 2.2, C.poison, 0.45);
      ring(add, x, z, 1.6, C.fire, 0.35);
      for (let i = 0; i < N(16); i++) spark(add, x, 0.8, z, rnd(6), 2 + Math.random() * 4, rnd(6), i % 3 ? C.poison : C.fireHi, 0.35, 0.55, 12);
      for (let i = 0; i < N(8); i++) {
        const a = Math.random() * Math.PI * 2;
        cloud(add, x, 0.6, z, Math.cos(a) * 1.2, 0.9, Math.sin(a) * 1.2, i % 2 ? C.poisonDark : '#3a3a2a', 1.8, 1.1, 0.55);
      }
      break;
    }
    case 'fire+lightning': {
      // Plasma Burst: a white-violet ball blowing up, electric sparks flung out, a hot ring.
      const ball = glow(C.plasma, 0.6, 1);
      ball.position.set(x, 0.9, z);
      add(ball, 0.45, (k) => {
        ball.scale.setScalar(0.6 + rad * 1.6 * Math.sqrt(k));
        ball.material.opacity = 1 - k;
      });
      spark(add, x, 0.9, z, 0, 0, 0, C.lightningHi, 2.2, 0.2);
      ring(add, x, z, rad, C.fireHi, 0.45);
      ring(add, x, z, rad * 0.8, C.plasma, 0.35);
      for (let i = 0; i < N(8); i++) {
        const a = Math.random() * Math.PI * 2;
        arc(add, x, z, x + Math.cos(a) * rad, z + Math.sin(a) * rad, 0.6 + Math.random() * 0.6, i % 2 ? C.lightning : C.fire, 0.3, 0.09);
      }
      for (let i = 0; i < N(12); i++) spark(add, x, 0.9, z, rnd(7), 1 + Math.random() * 3, rnd(7), C.fireHi, 0.28, 0.4, 8);
      break;
    }
    case 'poison+wind': {
      // Spreading Miasma: green fog blown out in a slow swirl to the radius, lingering.
      for (let i = 0; i < N(18); i++) {
        const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
        const v = rad / 1.4;
        cloud(add, x, 0.4 + Math.random() * 0.4, z, Math.cos(a + 0.6) * v, 0.15, Math.sin(a + 0.6) * v, i % 3 ? C.poison : C.poisonDark, 1.6 + Math.random() * 0.8, 1.4, 0.5);
      }
      swirl(add, x, z, N(10), 0.3, rad, 3, 0.3, [C.wind, C.poisonHi], 0.35, 1.2);
      for (const [hx, hz] of others) pool(add, hx, hz, 0.8, C.poisonDark, 1.4);
      break;
    }
    case 'poison+lightning': {
      // Numbing Shock: green-yellow crackles around the target's body, a few sparks falling.
      for (let i = 0; i < N(6); i++) {
        const a = Math.random() * Math.PI * 2;
        const b = a + 1 + Math.random() * 2;
        arc(add, x + Math.cos(a) * 0.6, z + Math.sin(a) * 0.6, x + Math.cos(b) * 0.6, z + Math.sin(b) * 0.6, 0.5 + Math.random() * 0.9, i % 2 ? C.poisonHi : C.lightning, 0.5, 0.07, 0.2);
      }
      spark(add, x, 1.0, z, 0, 0, 0, C.poisonHi, 1.6, 0.4);
      ring(add, x, z, 1.2, C.poison, 0.4, 1);
      for (let i = 0; i < N(8); i++) spark(add, x + rnd(0.5), 1.4, z + rnd(0.5), rnd(1.5), 1, rnd(1.5), C.lightning, 0.22, 0.5, 9);
      break;
    }
    case 'lightning+wind': {
      // Thunder Gale: a gust ring sweeping out with the knockback, and bolts striking from the sky around it.
      ring(add, x, z, rad, C.wind, 0.5);
      ring(add, x, z, rad * 0.7, C.windHi, 0.4);
      swirl(add, x, z, N(16), 0.5, rad + 0.5, 6, 0.4, [C.wind, C.windHi, C.lightning], 0.35, 0.55);
      skyBolt(add, x, z, C.lightning, 0.35);
      const targets = others.length ? others : [[x + rnd(rad), z + rnd(rad)] as [number, number]];
      for (const [hx, hz] of targets.slice(0, N(4))) skyBolt(add, hx, hz, C.lightning, 0.3);
      for (let i = 0; i < N(3); i++) skyBolt(add, x + rnd(rad), z + rnd(rad), C.windHi, 0.25);
      break;
    }
  }
}
