import * as THREE from 'three';

const EDGE = 0.12;

/** Circle on the ground showing how far Auto Play may wander. Drawn in world units. */
export class AutoRing {
  private readonly group = new THREE.Group();
  private readonly edge: THREE.Mesh;
  private readonly disc: THREE.Mesh;
  private radius = 0;

  constructor(scene: THREE.Scene, color = '#9fd8ff') {
    // The edge is rebuilt when the radius changes so the line keeps the same thickness at any size.
    this.edge = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false }),
    );
    this.edge.renderOrder = this.disc.renderOrder = 2;
    this.group.add(this.disc, this.edge);
    this.group.position.y = 0.06;
    this.group.visible = false;
    scene.add(this.group);
  }

  show(x: number, z: number, radius: number): void {
    this.group.visible = true;
    this.group.position.x = x;
    this.group.position.z = z;
    if (radius !== this.radius) {
      this.radius = radius;
      this.edge.geometry.dispose();
      this.edge.geometry = new THREE.RingGeometry(Math.max(0, radius - EDGE), radius, 128).rotateX(-Math.PI / 2);
      this.disc.scale.set(radius, 1, radius);
    }
  }

  hide(): void {
    this.group.visible = false;
  }
}
