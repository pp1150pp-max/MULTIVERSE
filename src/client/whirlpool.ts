// The Kraken Maelstrom's whirlpools (ZoneDef.whirlpools, plan 5.4, FLOOR2_M4_WHIRLPOOL.md): four paper layers lying flat on the ground,
// each turning at its own speed, the inner ones faster, so the water looks sucked down into the middle (owner 2026-11-19). The foam along
// the rim is ordinary props (rim_0 … rim_7, Terrain.placeRims). Nobody can walk in (Terrain.isBlocked). A whirlpool with an island
// (owner 2026-11-26, the Kraken Maelstrom's summoner) has a hole in each layer the island's size, where the ground shows, and a foam
// line round the island's shore.
import * as THREE from 'three';
import { sheets } from './assets';
import type { Whirlpool } from '../shared/data/zones';

/** Each layer: its picture, its width as a share of the whirlpool's, how fast it turns (radians a second, clockwise) and its height. */
const LAYERS: [key: string, size: number, spin: number, y: number][] = [
  ['whirlpool_ring_1', 1, 0.12, 0.03],
  ['whirlpool_ring_2', 0.75, 0.26, 0.034],
  ['whirlpool_ring_3', 0.5, 0.5, 0.038],
  ['whirlpool_core', 0.28, 1.1, 0.042],
];

export class WhirlpoolViews {
  readonly group = new THREE.Group();
  private readonly layers: { mesh: THREE.Mesh; spin: number }[] = [];

  constructor(pools: readonly Whirlpool[]) {
    for (const w of pools) {
      for (const [key, size, spin, y] of LAYERS) {
        const sheet = sheets[key];
        const mat = new THREE.MeshBasicMaterial({
          map: sheet?.texture ?? null, color: sheet ? '#ffffff' : '#1e5a7a', transparent: true, depthWrite: false, alphaTest: 0.02,
        });
        const d = w.r * 2 * size;
        const hole = w.island ?? 0;
        // A layer no wider than the island would only be a sliver round its shore: left out.
        if (hole && d / 2 <= hole + 1.5) {
          mat.dispose();
          continue;
        }
        // RingGeometry's UVs are planar over its outer square, so the picture lies as it would on the full plane.
        const geo = hole ? new THREE.RingGeometry(hole, d / 2, 96, 1) : new THREE.PlaneGeometry(d, d);
        const mesh = new THREE.Mesh(geo.rotateX(-Math.PI / 2), mat);
        mesh.position.set(w.x, y, w.z);
        mesh.renderOrder = -5;
        this.group.add(mesh);
        this.layers.push({ mesh, spin });
      }
      if (w.island) {
        // Foam along the island's shore, above the water layers.
        const mat = new THREE.MeshBasicMaterial({ color: '#d8f4ff', transparent: true, opacity: 0.55, depthWrite: false });
        const mesh = new THREE.Mesh(new THREE.RingGeometry(w.island - 0.15, w.island + 0.45, 96, 1).rotateX(-Math.PI / 2), mat);
        mesh.position.set(w.x, 0.046, w.z);
        mesh.renderOrder = -5;
        this.group.add(mesh);
        this.layers.push({ mesh, spin: 0.05 });
      }
    }
  }

  update(t: number): void {
    for (const l of this.layers) l.mesh.rotation.y = -t * l.spin;
  }

  dispose(): void {
    for (const l of this.layers) {
      l.mesh.geometry.dispose();
      (l.mesh.material as THREE.Material).dispose();
    }
  }
}
