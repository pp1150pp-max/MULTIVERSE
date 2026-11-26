// The Kraken Maelstrom's whirlpools (ZoneDef.whirlpools, plan 5.4, FLOOR2_M4_WHIRLPOOL.md): four paper layers lying flat on the ground,
// each turning at its own speed, the inner ones faster, so the water looks sucked down into the middle (owner 2026-11-19). The foam along
// the rim is ordinary props (rim_0 … rim_7, Terrain.placeRims). Nobody can walk in (Terrain.isBlocked).
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
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(d, d).rotateX(-Math.PI / 2), mat);
        mesh.position.set(w.x, y, w.z);
        mesh.renderOrder = -5;
        this.group.add(mesh);
        this.layers.push({ mesh, spin });
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
