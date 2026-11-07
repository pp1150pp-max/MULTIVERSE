// Draws the boss ground attacks the server lists in its snapshots. Everything is worked out from the
// hazard's own numbers and the server's clock, so every player sees the same thing at the same time.
import * as THREE from 'three';
import { fxTex } from './assets';
import { beamAngleAt, ringRadiusAt, type BeamsHazard, type BlastHazard, type Hazard, type MeteorHazard, type RingHazard } from '../shared/sim/volcanoHeart';

const WARN = '#ff3a2a';
const SAFE = '#6affa0';
const FIRE = '#ffb03a';
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
}

function meteorView(h: MeteorHazard): View {
  const group = new THREE.Group();
  const edge = decal(mat(WARN, 0.75, fxTex.edge));
  const fill = decal(mat(WARN, 0.3, fxTex.disc));
  const rock = new THREE.Sprite(new THREE.SpriteMaterial({ map: fxTex.glow, color: FIRE, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  rock.scale.setScalar(1.6);
  group.add(edge, fill, rock);
  group.position.set(h.x, Y, h.z);
  edge.scale.setScalar(h.r);
  return {
    group,
    update(t) {
      const k = Math.min(1, Math.max(0, (t - h.start) / (h.hit - h.start)));
      fill.scale.setScalar(h.r * Math.max(0.01, k));
      rock.position.set(0, (1 - k) * 12 + 0.5, 0);
    },
  };
}

function ringView(h: RingHazard): View {
  const group = new THREE.Group();
  group.position.set(h.x, Y, h.z);
  // Green wedges show the gaps, only over the ground this wave reaches next: from its own front out
  // to the front of the wave ahead. So at any spot, green means safe from the next wave to arrive.
  const safe = new THREE.Mesh(new THREE.BufferGeometry(), mat(SAFE, 0.2));
  const wave = new THREE.Mesh(new THREE.BufferGeometry(), mat(FIRE, 0.9, null, true));
  group.add(safe, wave);
  const walls = (Math.PI * 2) / h.gaps.length - h.gapArc;
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
  const live = mat(FIRE, 0.9, null, true);
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < h.n; i++) {
    const geo = new THREE.PlaneGeometry(h.len, h.width);
    geo.translate(h.len / 2, 0, 0);
    const mesh = new THREE.Mesh(flat(geo), warn);
    meshes.push(mesh);
    group.add(mesh);
  }
  return {
    group,
    update(t) {
      const on = t >= h.hit;
      meshes.forEach((mesh, i) => {
        mesh.material = on ? live : warn;
        mesh.rotation.y = -beamAngleAt(h, i, t);
      });
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

const MAKE: { [K in Hazard['k']]: (h: Extract<Hazard, { k: K }>) => View } = {
  meteor: meteorView, ring: ringView, beams: beamsView, blast: blastView,
};

function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    } else if (o instanceof THREE.Sprite) o.material.dispose();
  });
}

export class HazardViews {
  private readonly views = new Map<number, View>();

  constructor(private readonly scene: THREE.Scene) {}

  update(list: readonly Hazard[], time: number): void {
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
