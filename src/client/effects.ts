import * as THREE from 'three';
import { fxTex } from './assets';
import type { FxApi } from '../shared/sim/types';

interface Fx {
  obj: THREE.Object3D;
  t: number;
  life: number;
  tick?: (k: number, dt: number) => void;
}

const flat = (geo: THREE.BufferGeometry) => geo.rotateX(-Math.PI / 2);

function disposeObj(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    // Sprite geometry is shared by every sprite in three.js, so only dispose materials there.
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    } else if (o instanceof THREE.Sprite) {
      o.material.dispose();
    }
  });
}

export class Effects implements FxApi {
  private list: Fx[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  add(obj: THREE.Object3D, life: number, tick?: (k: number, dt: number) => void): void {
    this.scene.add(obj);
    this.list.push({ obj, t: 0, life, tick });
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const fx = this.list[i];
      fx.t += dt;
      fx.tick?.(Math.min(1, fx.t / fx.life), dt);
      if (fx.t >= fx.life) {
        this.scene.remove(fx.obj);
        disposeObj(fx.obj);
        this.list.splice(i, 1);
      }
    }
  }

  private mat(color: string, opacity: number, additive = true): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
  }

  glowSprite(color: string, size: number, opacity = 1): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fxTex.glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity,
    }));
    s.scale.set(size, size, 1);
    return s;
  }

  /** Arc swipe on the ground. angle = atan2(dz, dx). */
  slash(x: number, z: number, angle: number, arc: number, radius: number, color: string): void {
    const m = this.mat(color, 0.85);
    const mesh = new THREE.Mesh(flat(new THREE.RingGeometry(radius * 0.35, radius, 24, 1, -arc / 2, arc)), m);
    mesh.position.set(x, 0.4, z);
    mesh.rotation.y = -angle;
    this.add(mesh, 0.18, (k) => {
      m.opacity = 0.85 * (1 - k);
      mesh.scale.setScalar(0.8 + 0.3 * k);
    });
  }

  ring(x: number, z: number, radius: number, color: string, life = 0.4): void {
    const m = this.mat(color, 0.9);
    const mesh = new THREE.Mesh(flat(new THREE.RingGeometry(0.82, 1, 48)), m);
    mesh.position.set(x, 0.06, z);
    this.add(mesh, life, (k) => {
      mesh.scale.setScalar(radius * (0.3 + 0.7 * Math.sqrt(k)));
      m.opacity = 0.9 * (1 - k);
    });
  }

  disc(x: number, z: number, radius: number, color: string, life = 0.35): void {
    const m = this.mat(color, 0.55);
    const mesh = new THREE.Mesh(flat(new THREE.CircleGeometry(1, 40)), m);
    mesh.position.set(x, 0.05, z);
    mesh.scale.setScalar(radius);
    this.add(mesh, life, (k) => {
      m.opacity = 0.55 * (1 - k);
    });
  }

  /** Red warning circle that fills up until the hit lands. */
  telegraph(x: number, z: number, radius: number, duration: number, color = '#ff3a2a'): void {
    const g = new THREE.Group();
    const edge = new THREE.Mesh(flat(new THREE.RingGeometry(0.94, 1, 48)), this.mat(color, 0.7, false));
    const fillMat = this.mat(color, 0.28, false);
    const fill = new THREE.Mesh(flat(new THREE.CircleGeometry(1, 40)), fillMat);
    g.add(edge, fill);
    g.position.set(x, 0.07, z);
    g.scale.setScalar(radius);
    this.add(g, duration, (k) => {
      fill.scale.setScalar(Math.max(0.01, k));
    });
  }

  lineTelegraph(x: number, z: number, angle: number, length: number, width: number, duration: number): void {
    const geo = new THREE.PlaneGeometry(length, width);
    geo.translate(length / 2, 0, 0);
    flat(geo);
    const m = this.mat('#ff3a2a', 0.3, false);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, 0.07, z);
    mesh.rotation.y = -angle;
    this.add(mesh, duration, (k) => {
      m.opacity = 0.2 + 0.3 * k;
    });
  }

  puff(x: number, y: number, z: number, color: string, life: number, size: number): void {
    const s = this.glowSprite(color, size, 0.8);
    s.position.set(x, y, z);
    const mat = s.material;
    this.add(s, life, (k) => {
      mat.opacity = 0.8 * (1 - k);
      s.scale.setScalar(size * (1 - 0.5 * k));
    });
  }

  burst(x: number, y: number, z: number, color: string, n = 8, speed = 4): void {
    for (let i = 0; i < n; i++) {
      const s = this.glowSprite(color, 0.35, 1);
      s.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.5 + Math.random() * 0.7);
      const vx = Math.cos(a) * v;
      const vz = Math.sin(a) * v;
      let vy = 2 + Math.random() * 3;
      const mat = s.material;
      this.add(s, 0.45, (k, dt) => {
        s.position.x += vx * dt;
        s.position.z += vz * dt;
        s.position.y = Math.max(0.05, s.position.y + vy * dt);
        vy -= 12 * dt;
        mat.opacity = 1 - k;
      });
    }
  }

  levelUp(x: number, z: number): void {
    const m = this.mat('#ffd34a', 0.6);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4, 24, 1, true), m);
    col.position.set(x, 2, z);
    this.add(col, 1.2, (k) => {
      m.opacity = 0.6 * (1 - k);
      col.scale.set(1 + k * 0.5, 1 + k, 1 + k * 0.5);
    });
    this.ring(x, z, 3, '#ffd34a', 0.8);
    this.burst(x, 1, z, '#ffe27a', 16, 5);
  }

  marker(x: number, z: number): void {
    const m = this.mat('#8cff8c', 0.9);
    const mesh = new THREE.Mesh(flat(new THREE.RingGeometry(0.7, 1, 24)), m);
    mesh.position.set(x, 0.06, z);
    this.add(mesh, 0.35, (k) => {
      mesh.scale.setScalar(0.6 * (1 - k) + 0.1);
      m.opacity = 0.9 * (1 - k);
    });
  }

  /** Visual only: a fireball falling onto (x, z) over `duration`. */
  meteor(x: number, z: number, duration: number): void {
    const s = this.glowSprite('#ff7a2a', 1.8);
    const core = this.glowSprite('#fff0a0', 0.9);
    s.add(core);
    core.scale.setScalar(0.5);
    this.add(s, duration, (k) => {
      const e = k * k;
      s.position.set(x - 4 * (1 - e), 14 * (1 - e) + 0.4, z - 4 * (1 - e));
      if (Math.random() < 0.6) this.puff(s.position.x, s.position.y, s.position.z, '#ff5a1a', 0.3, 1.1);
    });
  }
}
