// /admin preview of the level-up effect (owner 2026-11-25): a small dark scene with a ground grid and a stand-in
// character, playing levelUpFx.ts with the card's unsaved values. Loaded only when the preview button is pressed;
// draws frames only while an effect is playing.
import * as THREE from 'three';
import { playLevelUp, type LevelUpLook } from './levelUpFx';

interface Running { obj: THREE.Object3D; t: number; life: number; tick: (k: number, dt: number) => void }

export class LevelUpPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private list: Running[] = [];
  private raf = 0;
  private last = 0;

  constructor(host: HTMLElement, w = 420, h = 300) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.borderRadius = '6px';
    host.replaceChildren(this.renderer.domElement);
    this.scene.background = new THREE.Color('#0d1016');
    const view = 6.2;
    this.camera = new THREE.OrthographicCamera((-view * w) / h / 2, (view * w) / h / 2, view / 2, -view / 2, 0.1, 100);
    // seen from above at an angle, like the game's camera
    this.camera.position.copy(new THREE.Vector3(1, 1.25, 1).normalize().multiplyScalar(30)).add(new THREE.Vector3(0, 1.6, 0));
    this.camera.lookAt(0, 1.6, 0);
    const grid = new THREE.GridHelper(16, 16, 0x3a4458, 0x262c3a);
    this.scene.add(grid);
    // a dark stand-in for the character
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.1, 4, 12), new THREE.MeshBasicMaterial({ color: '#2a3040' }));
    body.position.y = 0.9;
    this.scene.add(body);
    this.renderer.render(this.scene, this.camera);
  }

  play(look: LevelUpLook): void {
    playLevelUp((obj, life, tick) => {
      this.scene.add(obj);
      this.list.push({ obj, t: 0, life, tick });
    }, 0, 0, look, { particles: 1, extras: true });
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private readonly frame = (now: number): void => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const r = this.list[i];
      r.t += dt;
      r.tick(Math.min(1, r.t / r.life), dt);
      if (r.t >= r.life) {
        this.scene.remove(r.obj);
        r.obj.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
          if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) (o.material as THREE.Material).dispose();
        });
        this.list.splice(i, 1);
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = this.list.length ? requestAnimationFrame(this.frame) : 0;
  };
}
