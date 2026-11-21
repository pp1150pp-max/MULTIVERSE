// Each skill's extra effects drawn in code over its painted frames (owner 2026-11-18): shock rings, ground cracks,
// light pillars, lightning, smoke, embers, sparkles, speed streaks, snow, and a flash of the skill's own magic
// circle. Played once per cast spot (Effects.effect). A skill's set comes from its element (circleDesigns.ts), with
// its own set where it needs one (OWN below). Switches: /admin → ปรับสมดุล → เอฟเฟกต์สกิล (fxLayer.extras, extrasK,
// and per skill fxLayer.skills[id].extra / extraK).
import * as THREE from 'three';
import { currentBalance } from '../shared/balance';
import { circleDesign, ELEMENT_COLOR, skillElement, type Element } from './circleDesigns';
import { MagicCircle } from './magicCircles';
import type { Effects } from './effects';

export type Extra = 'shock' | 'flash' | 'cracks' | 'pillar' | 'burst' | 'smoke' | 'embers' | 'sparkle' | 'runes' | 'bolt' | 'snow' | 'streak';

const BY_ELEMENT: Record<Element, Extra[]> = {
  fire: ['flash', 'embers', 'smoke'],
  ice: ['shock', 'sparkle', 'snow'],
  poison: ['smoke', 'embers'],
  lightning: ['bolt', 'flash', 'sparkle'],
  arcane: ['runes', 'sparkle'],
  mana: ['runes', 'shock'],
  dark: ['smoke', 'runes'],
  void: ['shock', 'runes', 'sparkle'],
  time: ['runes', 'sparkle'],
  earth: ['cracks', 'smoke', 'shock'],
  wind: ['streak', 'shock'],
  holy: ['pillar', 'sparkle'],
  blood: ['flash', 'streak', 'burst'],
  steel: ['streak', 'burst'],
  tech: ['burst', 'smoke'],
  shadow: ['smoke', 'streak'],
};

/** Skills whose own look needs a set of its own. */
const OWN: Record<string, Extra[]> = {
  meteor: ['cracks', 'pillar', 'shock', 'embers'], sw_cataclysm: ['cracks', 'shock', 'pillar', 'smoke'],
  earthquake: ['cracks', 'shock', 'smoke'], sw_shockwave: ['shock', 'cracks'], sw_crush: ['cracks', 'burst'],
  mg_thunderstorm: ['bolt', 'bolt', 'flash'], mg_chainlightning: ['bolt', 'sparkle'], gs_shockrounds: ['bolt', 'burst'],
  gs_railgun: ['streak', 'flash', 'shock'], sw_judgement: ['pillar', 'shock', 'sparkle'], mg_starfall: ['pillar', 'sparkle', 'shock'],
  frostnova: ['shock', 'snow', 'sparkle'], mg_icecage: ['pillar', 'snow'], gs_explosive: ['flash', 'shock', 'smoke', 'burst'],
  gs_cluster: ['burst', 'smoke', 'flash'], gs_rocketrain: ['flash', 'smoke', 'embers'], gs_mine: ['flash', 'smoke', 'burst'],
  gs_smoke: ['smoke', 'smoke'], mg_gravitywell: ['runes', 'shock'], mg_timewarp: ['runes', 'sparkle'],
  sw_warcry: ['shock', 'runes'], sw_taunt: ['shock', 'flash'], sw_guard: ['runes', 'pillar'], mg_manashield: ['runes', 'pillar'],
  sw_unbreakable: ['pillar', 'runes', 'shock'], whirlwind: ['streak', 'shock'], sw_bladering: ['streak', 'runes'],
  sw_execute: ['flash', 'burst', 'streak'], headshot: ['flash', 'burst'], gs_finisher: ['flash', 'streak', 'burst'],
};

/** The code effects a skill plays (empty = none). */
export function skillExtras(id: string): Extra[] {
  if (OWN[id]) return OWN[id];
  const el = skillElement(id);
  return el ? BY_ELEMENT[el] : [];
}

function strength(id: string): number {
  const fl = currentBalance().fxLayer;
  if (!fl.enabled || !fl.extras) return 0;
  const t = fl.skills[id];
  if (t?.extra === false) return 0;
  return fl.extrasK * (t?.extraK ?? 1);
}

// ------------------------------------------------------------ pictures drawn once

const texCache = new Map<string, THREE.CanvasTexture>();
function canvasTex(key: string, px: number, draw: (g: CanvasRenderingContext2D, n: number) => void): THREE.CanvasTexture {
  let t = texCache.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    draw(c.getContext('2d')!, px);
    t = new THREE.CanvasTexture(c);
    texCache.set(key, t);
  }
  return t;
}
const ringTex = (): THREE.CanvasTexture => canvasTex('ring', 256, (g, n) => {
  const grad = g.createRadialGradient(n / 2, n / 2, n * 0.3, n / 2, n / 2, n / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.75, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, n, n);
});
const discTex = (): THREE.CanvasTexture => canvasTex('disc', 128, (g, n) => {
  const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, n, n);
});
const cracksTex = (): THREE.CanvasTexture => canvasTex('cracks', 256, (g, n) => {
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  const C = n / 2;
  let seed = 7;
  const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9; i++) {
    let a = (i / 9) * Math.PI * 2 + rnd() * 0.4;
    let x = C, y = C, r = 0;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x, y);
    while (r < n * 0.46) {
      const step = n * (0.04 + rnd() * 0.05);
      a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      r = Math.hypot(x - C, y - C);
      g.lineTo(x, y);
      g.lineWidth = Math.max(1.5, 5 - r / (n * 0.1));
    }
    g.stroke();
  }
});

const flatGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

function groundMesh(tex: THREE.Texture, color: string, additive = true): { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial } {
  const mat = new THREE.MeshBasicMaterial({
    map: tex, color, transparent: true, depthWrite: false, opacity: 0,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(flatGeo.clone(), mat);
  mesh.renderOrder = -1;
  return { mesh, mat };
}

function sprite(fx: Effects, color: string, size: number, opacity: number, additive = true): THREE.Sprite {
  const s = fx.glowSprite(color, size, opacity);
  if (!additive) s.material.blending = THREE.NormalBlending;
  return s;
}

// ------------------------------------------------------------ the effects

/** Plays skill `id`'s code effects at (x, z), facing `angle`, about `size` big. */
export function playSkillExtras(fx: Effects, id: string, x: number, z: number, angle: number, size: number): void {
  const k = strength(id);
  if (k <= 0) return;
  const list = skillExtras(id);
  if (!list.length) return;
  playExtras(fx, list, skillElement(id) ?? 'arcane', k, x, z, angle, size, id);
}

/**
 * Plays a list of code effects in element `el`'s colours at strength `k` (also the bosses' skills, bossFx.ts).
 * `circleId`: whose magic circle a 'runes' flashes (none = no runes).
 */
export function playExtras(fx: Effects, list: readonly Extra[], el: Element, k: number, x: number, z: number, angle: number, size: number, circleId?: string): void {
  const id = circleId ?? '';
  const [c1, c2] = ELEMENT_COLOR[el];
  const r = Math.max(0.8, size);
  let bolts = 0;
  for (const e of list) {
    switch (e) {
      case 'shock': {
        const { mesh, mat } = groundMesh(ringTex(), c1);
        mesh.position.set(x, 0.06, z);
        fx.add(mesh, 0.45, (t) => {
          mesh.scale.setScalar(r * 2 * (0.3 + 1.1 * t));
          mat.opacity = Math.min(1, 0.9 * k) * (1 - t);
        });
        break;
      }
      case 'flash': {
        const { mesh, mat } = groundMesh(discTex(), c2);
        mesh.position.set(x, 0.07, z);
        mesh.scale.setScalar(r * 2.2);
        fx.add(mesh, 0.25, (t) => { mat.opacity = Math.min(1, k) * (1 - t) * (1 - t); });
        const s = sprite(fx, c2, r * 1.6, 0);
        s.position.set(x, 0.6, z);
        fx.add(s, 0.2, (t) => { s.material.opacity = Math.min(1, 0.8 * k) * (1 - t); });
        break;
      }
      case 'cracks': {
        const { mesh, mat } = groundMesh(cracksTex(), c1);
        mesh.position.set(x, 0.065, z);
        mesh.rotation.y = angle;
        mesh.scale.setScalar(r * 2.2);
        fx.add(mesh, 1.4, (t) => { mat.opacity = Math.min(1, k) * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9); });
        break;
      }
      case 'pillar': {
        const s = sprite(fx, c2, 1, 0);
        s.position.set(x, 2, z);
        fx.add(s, 0.6, (t) => {
          s.scale.set(r * 0.7 * (1 - 0.5 * t), 4.5, 1);
          s.position.y = 2 + t * 0.8;
          s.material.opacity = Math.min(1, 0.85 * k) * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
        });
        break;
      }
      case 'burst':
        fx.burst(x, 0.5, z, c2, Math.round(6 + 6 * Math.min(2, k)), 3 + r);
        break;
      case 'smoke': {
        const grey = el === 'poison' ? '#6a9a4a' : el === 'dark' || el === 'shadow' ? '#3a2a4a' : '#5a5650';
        for (let i = 0; i < Math.round(4 * Math.min(2, k)); i++) {
          const s = sprite(fx, grey, 0.8, 0, false);
          const a = Math.random() * Math.PI * 2, d = Math.random() * r * 0.7;
          s.position.set(x + Math.cos(a) * d, 0.3, z + Math.sin(a) * d);
          const vy = 0.5 + Math.random() * 0.5;
          fx.add(s, 1.2, (t, dt) => {
            s.position.y += vy * dt;
            s.scale.setScalar(0.8 + 1.4 * t);
            s.material.opacity = 0.45 * (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8);
          });
        }
        break;
      }
      case 'embers':
        for (let i = 0; i < Math.round(8 * Math.min(2, k)); i++) {
          const s = sprite(fx, i % 2 ? c1 : c2, 0.16, 0);
          const a = Math.random() * Math.PI * 2, d = Math.random() * r;
          s.position.set(x + Math.cos(a) * d, 0.2, z + Math.sin(a) * d);
          const vy = 1 + Math.random() * 1.5, sway = Math.random() * 6;
          fx.add(s, 0.9 + Math.random() * 0.5, (t, dt) => {
            s.position.y += vy * dt;
            s.position.x += Math.sin(t * 8 + sway) * dt * 0.4;
            s.material.opacity = (1 - t);
          });
        }
        break;
      case 'sparkle':
        for (let i = 0; i < Math.round(7 * Math.min(2, k)); i++) {
          const s = sprite(fx, c2, 0.22, 0);
          const a = Math.random() * Math.PI * 2, d = Math.random() * r;
          s.position.set(x + Math.cos(a) * d, 0.3 + Math.random() * 1.4, z + Math.sin(a) * d);
          const ph = Math.random() * 6;
          fx.add(s, 0.7, (t) => {
            s.material.opacity = (1 - t) * (0.5 + 0.5 * Math.sin(t * 24 + ph));
            s.scale.setScalar(0.22 * (1 + Math.sin(t * 12 + ph) * 0.4));
          });
        }
        break;
      case 'runes': {
        if (!id || !circleDesign(id)) break;
        const at = new THREE.Group();
        at.position.set(x, 0.01, z);
        const circle = new MagicCircle(at, r * 2, true);
        circle.set(id);
        fx.add(at, 0.8, (t, dt) => {
          if (t > 0.55) circle.set(null);
          circle.update(dt * (1 + 2 * (1 - t)));
          if (t >= 1) circle.dispose();
        });
        break;
      }
      case 'bolt': {
        // A jagged line of light from the sky, made of glow dots.
        const ox = x + (bolts ? (Math.random() - 0.5) * r * 1.5 : 0), oz = z + (bolts ? (Math.random() - 0.5) * r * 1.5 : 0);
        bolts++;
        let px = ox, pz = oz;
        for (let i = 0; i < 14; i++) {
          const y = 6 - i * 0.45;
          px += (Math.random() - 0.5) * 0.35;
          pz += (Math.random() - 0.5) * 0.35;
          const s = sprite(fx, i % 3 ? c2 : '#ffffff', 0.35, 0);
          s.position.set(px, y, pz);
          fx.add(s, 0.28, (t) => { s.material.opacity = Math.min(1, k) * (1 - t) * (t < 0.1 ? 1 : 0.6 + 0.4 * Math.random()); });
        }
        break;
      }
      case 'snow':
        for (let i = 0; i < Math.round(10 * Math.min(2, k)); i++) {
          const s = sprite(fx, '#ffffff', 0.14, 0);
          const a = Math.random() * Math.PI * 2, d = Math.random() * r;
          s.position.set(x + Math.cos(a) * d, 1.5 + Math.random() * 1.5, z + Math.sin(a) * d);
          const vy = 0.8 + Math.random() * 0.6;
          fx.add(s, 1.3, (t, dt) => {
            s.position.y = Math.max(0.05, s.position.y - vy * dt);
            s.material.opacity = 0.9 * (1 - t);
          });
        }
        break;
      case 'streak':
        for (let i = 0; i < Math.round(5 * Math.min(2, k)); i++) {
          const s = sprite(fx, i % 2 ? c1 : c2, 1, 0);
          const side = (Math.random() - 0.5) * r * 1.2;
          const cx = Math.cos(angle), cz = Math.sin(angle);
          const sx = x - cz * side, sz = z + cx * side;
          s.position.set(sx, 0.4 + Math.random() * 1, sz);
          const v = 6 + Math.random() * 4;
          fx.add(s, 0.25, (t, dt) => {
            s.position.x += cx * v * dt;
            s.position.z += cz * v * dt;
            s.scale.set(0.9, 0.08, 1);
            s.material.rotation = -angle;
            s.material.opacity = (1 - t);
          });
        }
        break;
    }
  }
}
