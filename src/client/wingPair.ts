// Wings drawn from ONE wing picture (public/assets/sprites/cosmetics/<id>_one.png, cut by tools/cut_cosmetics.cjs:
// 5 views × 3 flap frames, each frame's root at the cell's left edge half way down), mirrored into the pair
// (owner 2026-11-12, after the mock-ups):
// - front / back: the pair, behind the body from the front, over the back from behind;
// - side: the near wing over the back, the far one a little further back and darker behind the body;
// - diagonals: the front (or back) pair turned with the body: tilted, the far wing narrower; on the front
//   diagonal the near wing behind the body but over the cape where it reaches past the arm.
// Positions are in the class sheets' pixels (a body is 200 px tall), for a character facing LEFT on screen (as the
// pictures are); facing right mirrors everything.
import * as THREE from 'three';
import type { SheetInfo } from './assets';
import { ISO_DIR } from './world';

/** World units per pixel of the class sheets (sprite.json: 256 px cells, 2.4 units tall). */
export const PX = 2.4 / 256;
const COS_CYCLE = [0, 1, 0, 2];

/** Screen right and screen up, as world directions (both square to the camera, so moving along them keeps the depth). */
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const UP = new THREE.Vector3(0, 1, 0).addScaledVector(ISO_DIR, -ISO_DIR.y).normalize();

/** One wing in a view: the sheet row, root (px, + = toward the back / down), mirrored, squeeze, tilt, in front, shade. */
interface WingPart { row: number; x: number; y: number; mirror: boolean; squeeze: number; tilt: number; front: boolean; shade?: number; order?: number }

/** What each view draws (index = view row: front, front diagonal, side, back diagonal, back), bottom layer first. */
function viewParts(view: number, tilt: number, squeeze: number): WingPart[] {
  switch (view) {
    case 0: return [
      { row: 0, x: -4, y: 0, mirror: false, squeeze: 1, tilt: 0, front: false },
      { row: 0, x: 4, y: 0, mirror: true, squeeze: 1, tilt: 0, front: false },
    ];
    case 1: return [
      { row: 0, x: 14, y: 0, mirror: true, squeeze, tilt, front: false },
      { row: 0, x: 14, y: 0, mirror: false, squeeze: 1, tilt, front: false },
    ];
    case 2: return [
      { row: 2, x: 32, y: -2, mirror: false, squeeze: 1, tilt: 0, front: false, shade: 0.7 },
      { row: 2, x: 22, y: 10, mirror: false, squeeze: 1, tilt: 0, front: true },
    ];
    case 3: return [
      { row: 4, x: 16, y: 30, mirror: false, squeeze, tilt: -tilt, front: true, order: 0 },
      { row: 4, x: 16, y: 30, mirror: true, squeeze: 1, tilt: -tilt, front: true, order: 1 },
    ];
    default: return [
      { row: 4, x: 4, y: 0, mirror: true, squeeze: 1, tilt: 0, front: true, order: 0 },
      { row: 4, x: -4, y: 0, mirror: false, squeeze: 1, tilt: 0, front: true, order: 1 },
    ];
  }
}

/** On the front diagonal, the near wing's part past the arm (this many px from the middle, toward the back) is drawn over the cape. */
const PAST_ARM = 40;

export interface WingPose {
  /** The character's feet in the world (y = the rider's seat, 0 on foot). */
  x: number; y: number; z: number;
  /** Sheet view row (0 front … 4 back) and whether the character faces left on screen. */
  view: number; left: boolean;
  /** Root height above the feet, the wing picture's height scale, and how far from the body (depth) the wings sit. */
  back: number; size: number; depth: number;
  tilt: number; squeeze: number;
  /** Seconds of flapping (the frame comes from it) and frames per second. */
  t: number; fps: number;
  /** Extra world shift (the bench's per-view offsets). */
  dx: number; dy: number; dz: number;
  alpha: number;
}

export class WingPair {
  private readonly parts: { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; tex: THREE.Texture }[] = [];
  private readonly clip = new THREE.Plane();
  private alpha = 1;

  constructor(private readonly scene: THREE.Scene, private readonly sheet: SheetInfo) {
    // Two wings, plus the front diagonal's near wing again (cut past the arm).
    for (let i = 0; i < 3; i++) {
      const tex = sheet.texture.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1 / sheet.cols, 1 / sheet.rows);
      const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, transparent: false });
      const sprite = new THREE.Sprite(mat);
      scene.add(sprite);
      this.parts.push({ sprite, mat, tex });
    }
    this.parts[2].mat.clippingPlanes = [this.clip];
  }

  update(w: WingPose): void {
    if (w.alpha !== this.alpha) {
      this.alpha = w.alpha;
      for (const p of this.parts) {
        p.mat.transparent = w.alpha < 1;
        p.mat.alphaTest = w.alpha < 1 ? 0.02 : 0.5;
        p.mat.opacity = w.alpha;
        p.mat.needsUpdate = true;
      }
    }
    const img = this.sheet.texture.image as { width: number; height: number };
    const cellH = img.height / this.sheet.rows;
    const cellW = img.width / this.sheet.cols;
    const h = cellH * PX * w.size;
    const col = COS_CYCLE[Math.floor(w.t * w.fps) % COS_CYCLE.length];
    const side = w.left ? 1 : -1;
    const feet = new THREE.Vector3(w.x, w.y, w.z);
    const list = viewParts(w.view, w.tilt, w.squeeze);
    // The front diagonal adds the near wing (the last part) again, over the body past the arm.
    const shown = w.view === 1 ? [...list, { ...list[1], front: true, order: 2 }] : list;
    this.parts.forEach((p, i) => {
      const part = shown[i];
      p.sprite.visible = !!part;
      if (!part) return;
      // Mirrored by flipping the picture (a sprite ignores a negative scale): the root moves to the right edge.
      const mirror = part.mirror !== !w.left;
      const u = 1 / this.sheet.cols;
      p.tex.repeat.set(mirror ? -u : u, 1 / this.sheet.rows);
      p.tex.offset.set((col + (mirror ? 1 : 0)) * u, 1 - (part.row + 1) / this.sheet.rows);
      p.sprite.center.set(mirror ? 1 - 1 / cellW : 1 / cellW, 0.5);
      p.sprite.scale.set(h * (cellW / cellH) * part.squeeze, h, 1);
      p.mat.rotation = -part.tilt * side;
      p.mat.color.setScalar(part.shade ?? 1);
      // Root on screen: `back` above the feet, then the part's px offset (x toward the back = right when facing left).
      const pos = feet.clone()
        .addScaledVector(UP, w.back - part.y * PX)
        .addScaledVector(RIGHT, part.x * PX * side)
        .add(new THREE.Vector3(w.dx, w.dy, w.dz))
        .addScaledVector(ISO_DIR, (part.front ? 1 : -1) * w.depth + (part.order ?? 0) * 0.01);
      p.sprite.position.copy(pos);
    });
    if (w.view === 1) {
      // Keep only what lies past the arm, toward the back (screen right facing left).
      this.clip.normal.copy(RIGHT).multiplyScalar(side);
      this.clip.constant = -(this.clip.normal.dot(feet) + PAST_ARM * PX);
    }
  }

  dispose(): void {
    for (const p of this.parts) {
      this.scene.remove(p.sprite);
      p.tex.dispose();
      p.mat.dispose();
    }
  }
}
