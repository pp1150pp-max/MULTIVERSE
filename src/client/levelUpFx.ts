// Level-up effect, new look (owner 2026-11-25, docs/systems/skill-fx-layer.md "เอฟเฟกต์เลเวลอัป"): a glowing magic
// circle on the ground with broken rings turning round it, thin light streaks and sparks rising from it, chevrons
// (^) floating up over the head and a glowing "LEVEL UP !" title. Everything is drawn in code (canvas textures made
// once per colour pair), two colours set on /admin. Kept free of the game's own textures so the /admin preview
// (levelUpPreview.ts) can play it in its own little scene.
import * as THREE from 'three';
import type { FxLayerConfig } from '../shared/fxLayerTuning';

/** /admin's settings of the effect (fxLayer.lu*). */
export interface LevelUpLook {
  ground: boolean;
  sparks: boolean;
  arrows: boolean;
  text: boolean;
  /** × size of the whole effect. */
  size: number;
  /** How long it lasts, in seconds. */
  sec: number;
  color1: string;
  color2: string;
}

/** /admin's level-up settings (fxLayer.lu*) as the effect takes them. */
export const levelUpLook = (c: FxLayerConfig): LevelUpLook => ({
  ground: c.luGround, sparks: c.luSparks, arrows: c.luArrows, text: c.luText, size: c.luSize, sec: c.luSec, color1: c.luColor1, color2: c.luColor2,
});

export interface LevelUpOpts {
  /** × the number of sparks and streaks (graphics quality, other players, touch screens). 0 = none. */
  particles: number;
  /** Draw the ground circle and the arrows (off: quality "off" or another player's with "others: none"). */
  extras: boolean;
  /** Where the player is now (the effect follows them); null = stays where it began. */
  follow?: () => { x: number; z: number } | null;
}

/** Adds an object to the scene for `life` seconds, ticking it with k = 0…1 (Effects.add). */
export type LevelUpHost = (obj: THREE.Object3D, life: number, tick: (k: number, dt: number) => void) => void;

/** Height over the ground of the title (a player's head is at 1.9). */
const TEXT_Y = 2.75;

// ------------------------------------------------------------------ textures (made once, colour pairs cached)

const canvas = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
};
const toTex = (c: HTMLCanvasElement): THREE.CanvasTexture => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

let plain: { disc: THREE.Texture; ringA: THREE.Texture; ringB: THREE.Texture; streak: THREE.Texture; spark: THREE.Texture } | null = null;

/** White textures, tinted by their material's colour. */
function plainTex(): NonNullable<typeof plain> {
  if (plain) return plain;
  // soft glow disc
  const [d, dc] = canvas(128, 128);
  const g = dc.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  dc.fillStyle = g;
  dc.fillRect(0, 0, 128, 128);
  // a ring broken into arcs of different lengths, with a faint whole ring inside
  const ring = (arcs: [number, number][], width: number, inner: boolean): THREE.Texture => {
    const [c, x] = canvas(256, 256);
    x.strokeStyle = '#fff';
    x.shadowColor = '#fff';
    x.shadowBlur = 10;
    x.lineCap = 'round';
    x.lineWidth = width;
    for (const [a, len] of arcs) {
      x.beginPath();
      x.arc(128, 128, 112, a, a + len);
      x.stroke();
    }
    if (inner) {
      x.globalAlpha = 0.35;
      x.lineWidth = 2;
      x.beginPath();
      x.arc(128, 128, 96, 0, Math.PI * 2);
      x.stroke();
      // small marks around the inner ring
      x.globalAlpha = 0.6;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        x.beginPath();
        x.moveTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88);
        x.lineTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100);
        x.stroke();
      }
    }
    return toTex(c);
  };
  const ringA = ring([[0, 1.1], [1.35, 0.5], [2.1, 1.3], [3.7, 0.35], [4.3, 1.2], [5.75, 0.4]], 7, true);
  const ringB = ring([[0.3, 0.7], [1.6, 0.9], [3.0, 0.5], [3.9, 0.8], [5.2, 0.6]], 4, false);
  // a thin upright streak, brightest in the middle
  const [s, sc] = canvas(16, 128);
  const sg = sc.createLinearGradient(0, 0, 0, 128);
  sg.addColorStop(0, 'rgba(255,255,255,0)');
  sg.addColorStop(0.45, 'rgba(255,255,255,1)');
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  sc.fillStyle = sg;
  sc.fillRect(6, 0, 4, 128);
  sc.globalAlpha = 0.35;
  sc.fillRect(3, 0, 10, 128);
  // a spark
  const [p, pc] = canvas(32, 32);
  const pg = pc.createRadialGradient(16, 16, 0, 16, 16, 16);
  pg.addColorStop(0, 'rgba(255,255,255,1)');
  pg.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  pg.addColorStop(1, 'rgba(255,255,255,0)');
  pc.fillStyle = pg;
  pc.fillRect(0, 0, 32, 32);
  plain = { disc: toTex(d), ringA, ringB, streak: toTex(s), spark: toTex(p) };
  return plain;
}

/** `hex` mixed toward white (k > 0) or black (k < 0). */
function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  const to = k > 0 ? new THREE.Color('#ffffff') : new THREE.Color('#000000');
  return '#' + c.lerp(to, Math.abs(k)).getHexString();
}

const colored = new Map<string, { text: THREE.Texture; arrow: THREE.Texture }>();

/** The title and the chevron, painted in the two colours. */
function colorTex(c1: string, c2: string): { text: THREE.Texture; arrow: THREE.Texture } {
  const key = `${c1}|${c2}`;
  const had = colored.get(key);
  if (had) return had;
  if (colored.size > 8) colored.clear(); // /admin trying colours: keep only a few
  // title
  const [t, tc] = canvas(512, 128);
  tc.font = '900 76px "Arial Black", Impact, "Segoe UI", sans-serif';
  tc.textAlign = 'center';
  tc.textBaseline = 'middle';
  const fill = tc.createLinearGradient(0, 24, 0, 104);
  fill.addColorStop(0, shade(c1, 0.75));
  fill.addColorStop(0.5, c1);
  fill.addColorStop(1, c2);
  tc.lineJoin = 'round';
  tc.shadowColor = c1;
  tc.shadowBlur = 22;
  tc.lineWidth = 10;
  tc.strokeStyle = shade(c2, -0.65);
  tc.strokeText('LEVEL UP !', 256, 66);
  tc.shadowBlur = 8;
  tc.fillStyle = fill;
  tc.fillText('LEVEL UP !', 256, 66);
  // chevron
  const [a, ac] = canvas(128, 96);
  const ag = ac.createLinearGradient(0, 8, 0, 80);
  ag.addColorStop(0, shade(c1, 0.6));
  ag.addColorStop(1, c2);
  ac.shadowColor = c1;
  ac.shadowBlur = 14;
  ac.fillStyle = ag;
  ac.beginPath();
  ac.moveTo(64, 10);
  ac.lineTo(116, 62);
  ac.lineTo(94, 82);
  ac.lineTo(64, 52);
  ac.lineTo(34, 82);
  ac.lineTo(12, 62);
  ac.closePath();
  ac.fill();
  const out = { text: toTex(t), arrow: toTex(a) };
  colored.set(key, out);
  return out;
}

// ------------------------------------------------------------------ the effect

const ease = (k: number) => 1 - (1 - k) * (1 - k);
/** 0 → 1 over the first `a` of the life, 1 → 0 over the last `b`. */
const envelope = (k: number, a: number, b: number) => Math.min(1, k / a, (1 - k) / b);

function sprite(map: THREE.Texture, color: string, additive: boolean): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map, color, transparent: true, depthWrite: false, opacity: 0,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  return s;
}

function groundMesh(map: THREE.Texture, color: string): THREE.Mesh {
  const g = new THREE.PlaneGeometry(2, 2);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    map, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  m.renderOrder = -1;
  return m;
}

/** Plays the level-up effect at (x, z). */
export function playLevelUp(add: LevelUpHost, x: number, z: number, look: LevelUpLook, opts: LevelUpOpts): void {
  const T = Math.max(0.3, look.sec);
  const S = Math.max(0.1, look.size);
  const tex = plainTex();
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const ticks: ((k: number, dt: number) => void)[] = [];

  if (look.ground && opts.extras) {
    const disc = groundMesh(tex.disc, look.color2);
    const ringA = groundMesh(tex.ringA, look.color1);
    const ringB = groundMesh(tex.ringB, look.color2);
    // a quick flash ring spreading out at the start
    const wave = groundMesh(tex.ringB, look.color1);
    disc.position.y = 0.04;
    ringA.position.y = 0.05;
    ringB.position.y = 0.055;
    wave.position.y = 0.06;
    group.add(disc, ringA, ringB, wave);
    ticks.push((k, dt) => {
      const e = envelope(k, 0.12, 0.35);
      const grow = 0.55 + 0.45 * ease(Math.min(1, k / 0.18));
      disc.scale.setScalar(1.55 * S * grow);
      (disc.material as THREE.MeshBasicMaterial).opacity = 0.75 * e;
      ringA.scale.setScalar(1.75 * S * grow);
      ringA.rotation.y += 0.9 * dt;
      (ringA.material as THREE.MeshBasicMaterial).opacity = 0.95 * e;
      ringB.scale.setScalar(1.35 * S * grow);
      ringB.rotation.y -= 1.6 * dt;
      (ringB.material as THREE.MeshBasicMaterial).opacity = 0.8 * e;
      const w = Math.min(1, (k * T) / 0.55);
      wave.scale.setScalar(S * (0.4 + 2 * ease(w)));
      (wave.material as THREE.MeshBasicMaterial).opacity = w < 1 ? 0.9 * (1 - w) : 0;
    });
  }

  if (look.sparks && opts.particles > 0) {
    // thin light streaks shooting up
    const nStreak = Math.round(8 * opts.particles);
    for (let i = 0; i < nStreak; i++) {
      const s = sprite(tex.streak, i % 2 ? look.color1 : look.color2, true);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.9 * S;
      const start = Math.random() * 0.55; // share of the life before it starts
      const dur = (0.45 + Math.random() * 0.35) / T; // seconds → share of the life
      const h = (1.2 + Math.random() * 1.2) * S;
      s.scale.set(0.09 * S, h, 1);
      s.position.set(Math.cos(a) * r, -10, Math.sin(a) * r);
      group.add(s);
      ticks.push((k) => {
        const q = (k - start) / dur;
        if (q < 0 || q > 1) { s.material.opacity = 0; return; }
        s.position.y = h / 2 + ease(q) * 2.4 * S;
        s.material.opacity = Math.sin(q * Math.PI) * 0.9;
      });
    }
    // sparks rising and swirling
    const nSpark = Math.round(24 * opts.particles);
    for (let i = 0; i < nSpark; i++) {
      const s = sprite(tex.spark, i % 3 ? look.color1 : '#ffffff', true);
      const a0 = Math.random() * Math.PI * 2;
      const r = (0.15 + Math.random() * 1.1) * S;
      const start = Math.random() * 0.6;
      const dur = (0.7 + Math.random() * 0.7) / T;
      const up = (1.5 + Math.random() * 2.2) * S;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random());
      const size = (0.07 + Math.random() * 0.1) * S;
      const tw = Math.random() * 20;
      s.scale.setScalar(size);
      s.position.y = -10;
      group.add(s);
      ticks.push((k) => {
        const q = (k - start) / dur;
        if (q < 0 || q > 1) { s.material.opacity = 0; return; }
        const a = a0 + spin * q;
        const rr = r * (1 - 0.45 * q);
        s.position.set(Math.cos(a) * rr, 0.1 + up * ease(q), Math.sin(a) * rr);
        s.material.opacity = (1 - q) * (0.65 + 0.35 * Math.sin(tw + q * 30));
      });
    }
  }

  const ct = look.arrows || look.text ? colorTex(look.color1, look.color2) : null;

  if (look.arrows && opts.extras && ct) {
    // three chevrons flowing upward over the head, one after another
    for (let i = 0; i < 3; i++) {
      const s = sprite(ct.arrow, '#ffffff', false);
      s.renderOrder = 60;
      s.material.depthTest = false;
      group.add(s);
      const w = 0.75 * S * (1 - i * 0.12);
      ticks.push((k) => {
        const e = envelope(k, 0.1, 0.25);
        const cycle = ((k * T) / 0.9 + i / 3) % 1; // each chevron rises over 0.9 s, then starts again
        s.scale.set(w, w * 0.75, 1);
        s.position.y = TEXT_Y + 0.45 * S + cycle * 0.9 * S;
        s.material.opacity = e * Math.sin(cycle * Math.PI);
      });
    }
  }

  if (look.text && ct) {
    const s = sprite(ct.text, '#ffffff', false);
    s.renderOrder = 61;
    s.material.depthTest = false;
    group.add(s);
    const W = 2.6 * S;
    ticks.push((k) => {
      const t = k * T;
      // pops in a little too big, then settles
      const pop = t < 0.18 ? 0.4 + (t / 0.18) * 0.8 : t < 0.32 ? 1.2 - ((t - 0.18) / 0.14) * 0.2 : 1;
      s.scale.set(W * pop, (W / 4) * pop, 1);
      s.position.y = TEXT_Y + 0.25 * S * ease(k);
      s.material.opacity = Math.min(1, t / 0.12, (1 - k) / 0.25);
    });
  }

  if (!ticks.length) return;
  add(group, T, (k, dt) => {
    const p = opts.follow?.();
    if (p) group.position.set(p.x, 0, p.z);
    for (const f of ticks) f(k, dt);
  });
}
