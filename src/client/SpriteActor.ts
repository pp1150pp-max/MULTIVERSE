import * as THREE from 'three';
import { fxTex, type SheetInfo } from './assets';
import type { Actor } from './AnimatedActor';

const S = Math.SQRT1_2;
const ROW_FRONT = 0;
const ROW_SIDE = 1;
const ROW_BACK = 2;
/** Sheets with this many rows also have diagonal views, so with mirroring they face 8 directions. */
const DIAGONAL_ROWS = 5;
/** Frame order while moving. Cosmetic sheets pass COS_CYCLE (rest, up, rest, down: a flap or a step each way). */
const WALK: readonly number[] = [0, 1, 2, 1];

let shadowGeo: THREE.PlaneGeometry | null = null;

/** A camera-facing sprite standing on the ground (Ragnarok-style), with a blob shadow. */
export class SpriteActor implements Actor {
  readonly group = new THREE.Group();
  readonly sprite: THREE.Sprite;
  private readonly mat: THREE.SpriteMaterial;
  private readonly tex: THREE.Texture;
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private row = ROW_FRONT;
  private frame = 0;
  private flip = false;
  private animT = 0;
  private flashT = 0;
  private readonly shadow: THREE.Mesh;

  constructor(private readonly sheet: SheetInfo, public height: number, shadowRadius: number, private readonly cycle: readonly number[] = WALK) {
    this.tex = sheet.texture.clone();
    this.tex.needsUpdate = true;
    this.mat = new THREE.SpriteMaterial({ map: this.tex, alphaTest: 0.5, transparent: false });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.center.set(0.5, 0.02);
    this.sprite.scale.set(height * sheet.cellAspect, height, 1);

    shadowGeo ??= new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: fxTex.shadow, transparent: true, depthWrite: false, opacity: 0.5 });
    const shadow = new THREE.Mesh(shadowGeo, this.shadowMat);
    this.shadow = shadow;
    shadow.scale.set(shadowRadius * 2.2, 1, shadowRadius * 1.4);
    shadow.position.y = 0.02;
    this.group.add(shadow, this.sprite);
    this.applyUV();
  }

  /** Changes the picture's world height (the cosmetics bench's size sliders). */
  setHeight(h: number): void {
    this.height = h;
    this.sprite.scale.set(h * this.sheet.cellAspect, h, 1);
  }

  /** Raises the sprite off the ground, leaving its shadow behind. */
  setLift(y: number): void {
    this.sprite.position.y = y;
    this.shadow.visible = y < 6;
  }

  /** Pick the sheet row from a world-space direction, relative to the iso camera. */
  face(dx: number, dz: number): void {
    if (dx * dx + dz * dz < 1e-6) return;
    const sx = (dx - dz) * S;
    const sy = (-dx - dz) * S; // + = up the screen (away from camera)
    if (this.sheet.rows === DIAGONAL_ROWS) {
      // Rows run front, front diagonal, side, back diagonal, back: 45 degrees apart on screen.
      const angle = Math.atan2(Math.abs(sx), -sy);
      this.row = Math.round(angle / (Math.PI / 4));
      this.flip = this.row !== 0 && this.row !== 4 && (this.sheet.sideFaces === 'right') !== sx > 0;
    } else if (Math.abs(sy) > Math.abs(sx) * 1.2) {
      this.row = sy > 0 ? ROW_BACK : ROW_FRONT;
      this.flip = false;
    } else {
      this.row = ROW_SIDE;
      this.flip = (this.sheet.sideFaces === 'right') !== sx > 0;
    }
  }

  update(dt: number, moving: boolean, fps = 9): void {
    if (moving) {
      this.animT += dt * fps;
      this.frame = this.cycle[Math.floor(this.animT) % this.cycle.length];
    } else {
      this.animT = 0;
      this.frame = 0;
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      const k = Math.max(0, this.flashT) / 0.15;
      this.mat.color.setRGB(1, 1 - 0.65 * k, 1 - 0.65 * k);
    }
    this.applyUV();
  }

  flash(): void {
    this.flashT = 0.15;
  }

  // Simple sheets only have walk frames, so one-shot animations are no-ops.
  play(): boolean {
    return false;
  }

  has(): boolean {
    return false;
  }

  reset(): void {}

  setOpacity(o: number): void {
    this.mat.transparent = true;
    this.mat.alphaTest = 0.02;
    this.mat.opacity = o;
    this.shadowMat.opacity = 0.5 * o;
  }

  private applyUV(): void {
    const w = 1 / this.sheet.cols;
    const h = 1 / this.sheet.rows;
    const row = Math.min(this.row, this.sheet.rows - 1);
    const frame = Math.min(this.frame, this.sheet.cols - 1);
    const v = 1 - (row + 1) * h;
    if (this.flip) {
      this.tex.repeat.set(-w, h);
      this.tex.offset.set((frame + 1) * w, v);
    } else {
      this.tex.repeat.set(w, h);
      this.tex.offset.set(frame * w, v);
    }
  }

  dispose(): void {
    this.tex.dispose();
    this.mat.dispose();
    this.shadowMat.dispose();
  }
}
