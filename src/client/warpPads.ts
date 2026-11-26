// Warp circles on the ground (ZoneDef.warps, owner 2026-11-26: "วงกลม ๆ ที่พื้น ไม่ต้องทำเป็นประตู"): a glowing ring with a turning
// inner ring and a soft disc, lying flat. Stand on one and press T (or click it) to step through (Game, Sim.useWarp).
import * as THREE from 'three';
import type { WarpPad } from '../shared/data/zones';

/** The circle's radius on the ground (WARP_RANGE, how close you must stand, is a little wider). */
const PAD_R = 1.3;
const COLOR = '#7fe0ff';

export class WarpPadViews {
  readonly group = new THREE.Group();
  private readonly spinners: THREE.Group[] = [];
  private readonly pulses: THREE.MeshBasicMaterial[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];

  constructor(pads: readonly WarpPad[]) {
    for (const p of pads) {
      const flat = (geo: THREE.BufferGeometry, opacity: number, y: number): THREE.Mesh => {
        const mat = new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        geo.rotateX(-Math.PI / 2);
        this.geos.push(geo);
        this.mats.push(mat);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(p.x, y, p.z);
        mesh.renderOrder = -4;
        this.group.add(mesh);
        return mesh;
      };
      const disc = flat(new THREE.CircleGeometry(PAD_R, 48), 0.18, 0.05);
      this.pulses.push(disc.material as THREE.MeshBasicMaterial);
      flat(new THREE.RingGeometry(PAD_R - 0.14, PAD_R, 64), 0.85, 0.052);
      // The inner ring: dashed (thetaLength in pieces) and turning.
      const inner = new THREE.Group();
      inner.position.set(p.x, 0.054, p.z);
      for (let i = 0; i < 6; i++) {
        const geo = new THREE.RingGeometry(PAD_R * 0.62, PAD_R * 0.72, 12, 1, (i / 6) * Math.PI * 2, Math.PI / 4.5).rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        this.geos.push(geo);
        this.mats.push(mat);
        inner.add(new THREE.Mesh(geo, mat));
      }
      this.group.add(inner);
      this.spinners.push(inner);
    }
  }

  update(t: number): void {
    for (const s of this.spinners) s.rotation.y = t * 0.8;
    for (const m of this.pulses) m.opacity = 0.14 + 0.1 * (0.5 + 0.5 * Math.sin(t * 2.4));
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
