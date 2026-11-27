// Treasure chests and shrines on the farm maps (docs/systems/chests-shrines.md). Placeholder art drawn in code for now: the owner
// paints the papercraft pictures with GPT (art_templates/chests-shrines/PROMPTS.md) and they replace these later.
// A chest: a little wooden box with a gold band, hidden while it is opened (Backend.chestsGone). A shrine: a stone pillar with a
// floating orb in its buff's colour, dimmed while it is cooling down for us.
import * as THREE from 'three';
import type { MapChest, MapShrine, ShrineKind } from '../shared/mapSchema';

const ORB_COLOR: Record<ShrineKind, string> = { atk: '#ff6a5a', speed: '#6aff9a', exp: '#ffd24a', random: '#f070c0' };

export class TreasureViews {
  readonly group = new THREE.Group();
  private readonly chests = new Map<string, THREE.Group>();
  private readonly orbs: { id: string; mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; glow: THREE.MeshBasicMaterial; y: number }[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];

  constructor(chests: readonly MapChest[], shrines: readonly MapShrine[]) {
    const mat = (color: string, opts: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial => {
      const m = new THREE.MeshBasicMaterial({ color, ...opts });
      this.mats.push(m);
      return m;
    };
    const geo = <G extends THREE.BufferGeometry>(g: G): G => {
      this.geos.push(g);
      return g;
    };
    const wood = mat('#8a5a2b');
    const woodDark = mat('#5e3a1a');
    const gold = mat('#f2c230');
    const stone = mat('#9a9488');
    const stoneDark = mat('#6f6a60');
    for (const c of chests) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(geo(new THREE.BoxGeometry(1.1, 0.55, 0.75)), wood);
      body.position.y = 0.28;
      const lid = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.375, 0.375, 1.1, 12, 1, false, 0, Math.PI)), woodDark);
      lid.rotation.z = Math.PI / 2;
      lid.position.y = 0.55;
      const band = new THREE.Mesh(geo(new THREE.BoxGeometry(0.14, 0.62, 0.78)), gold);
      band.position.y = 0.31;
      const lock = new THREE.Mesh(geo(new THREE.BoxGeometry(0.18, 0.2, 0.06)), gold);
      lock.position.set(0, 0.45, 0.4);
      g.add(body, lid, band, lock);
      g.position.set(c.x, 0, c.z);
      g.rotation.y = Math.PI / 4;
      this.group.add(g);
      this.chests.set(c.id, g);
    }
    for (const s of shrines) {
      const base = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.9, 1, 0.3, 8)), stoneDark);
      base.position.set(s.x, 0.15, s.z);
      const pillar = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.32, 0.42, 1.6, 6)), stone);
      pillar.position.set(s.x, 1.1, s.z);
      const cap = new THREE.Mesh(geo(new THREE.BoxGeometry(1, 0.16, 1)), stoneDark);
      cap.position.set(s.x, 1.98, s.z);
      const orbMat = mat(ORB_COLOR[s.buff] ?? ORB_COLOR.random);
      const orb = new THREE.Mesh(geo(new THREE.SphereGeometry(0.28, 16, 12)), orbMat);
      const glowMat = mat(ORB_COLOR[s.buff] ?? ORB_COLOR.random, { transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
      const glow = new THREE.Mesh(geo(new THREE.SphereGeometry(0.5, 16, 12)), glowMat);
      orb.add(glow);
      orb.position.set(s.x, 2.5, s.z);
      this.group.add(base, pillar, cap, orb);
      this.orbs.push({ id: s.id, mesh: orb, mat: orbMat, glow: glowMat, y: 2.5 });
    }
  }

  /** Hides opened chests and dims shrines cooling down for us (`cooling(id)`). `on` = the /admin switches. */
  update(t: number, gone: ReadonlySet<string>, cooling: (id: string) => boolean, on: { chests: boolean; shrines: boolean }): void {
    for (const [id, g] of this.chests) g.visible = on.chests && !gone.has(id);
    this.orbs.forEach((o, i) => {
      const cool = cooling(o.id);
      o.mesh.visible = on.shrines;
      o.mesh.position.y = o.y + Math.sin(t * 2 + i) * 0.08;
      o.mat.opacity = cool ? 0.35 : 1;
      o.mat.transparent = cool;
      o.glow.opacity = cool ? 0.05 : 0.18 + 0.1 * (0.5 + 0.5 * Math.sin(t * 3 + i));
    });
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
