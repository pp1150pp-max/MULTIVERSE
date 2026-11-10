// Cosmetics on a character in the world: wings, a mount under it, a pet that follows it, and a ground
// aura with footprints. Wings, mounts and pets are 8-direction walk sheets like the monsters'
// (public/assets/sprites/cosmetics/<id>.png: 3 frames × 5 rows front, front diagonal, side, back diagonal,
// back, the other three directions mirrored); until a file exists its placeholder is drawn in code
// (placeholder.ts drawCosmetic, see SHEET_SPECS in assets.ts).
import * as THREE from 'three';
import type { Player } from '../shared/sim/Player';
import type { CosmeticDef } from '../shared/data/cosmetics';
import { cosSheetKey, fxTex, sheets } from './assets';
import { SpriteActor } from './SpriteActor';
import type { Effects } from './effects';
import { shownCos, shownRiding } from './cosLook';
import { ISO_DIR } from './world';

/**
 * Draw order between the character and its cosmetics. The camera is orthographic and looks down, so a
 * picture raised off the ground counts as nearer the camera than one on the ground: a rider on a saddle
 * would always cover the mount, and wings raised to the shoulders would cover the body. Sliding a piece
 * along the camera's own direction changes only that, never where it shows on screen; this returns the
 * position `(x, z)` slid so the piece sits `depth` units nearer the camera than the character's feet
 * (negative = behind), counting its lift `raised` above them.
 */
function depthAt(x: number, z: number, raised: number, depth: number): [number, number, number] {
  const k = depth - raised * ISO_DIR.y;
  return [x + ISO_DIR.x * k, ISO_DIR.y * k, z + ISO_DIR.z * k];
}

/** How high a rider sits above the ground. */
export const MOUNT_SEAT = 0.55;
/**
 * Per mount: the world height of its picture (the whole cell, as cut by tools/cut_cosmetics.cjs), how high
 * the rider's feet sit, and which riding pose the classes play (`ride` astride, `ride_board` standing).
 */
export const MOUNT_LOOK: Record<string, { h: number; seat: number; pose: 'ride' | 'ride_board'; under?: boolean }> = {
  mount_wolf: { h: 1.5, seat: 0.5, pose: 'ride' },
  mount_warhorse: { h: 1.7, seat: 0.62, pose: 'ride' },
  mount_raptor: { h: 1.75, seat: 0.62, pose: 'ride' },
  mount_tortoise: { h: 1.8, seat: 0.7, pose: 'ride' },
  // Owner 2026-11-10: it was too small and off the feet. Its side view is ~2 units long now, the rider
  // stands on the deck (~47% of the picture's height) and it always stays right under the feet (`under`).
  mount_hoverboard: { h: 1.2, seat: 0.5, pose: 'ride_board', under: true },
};

/** How high a character's feet sit: on its mount's saddle while riding (or trying one on), else 0. */
export function seatOf(p: Player): number {
  const m = shownRiding(p) ? shownCos(p, 'mount') : undefined;
  if (!m) return 0;
  // Seen head-on or from behind the rider sits higher, so the mount's head (or rear) in front of them
  // doesn't hide their body.
  const look = MOUNT_LOOK[m.id];
  return (look?.seat ?? MOUNT_SEAT) + (!look?.under && headOn(p) ? HEAD_ON_LIFT : 0);
}

/** Extra seat height when the mount is seen head-on or from behind. */
const HEAD_ON_LIFT = 0.18;

/** The sheet row a facing shows: 0 front, 1 front diagonal, 2 side, 3 back diagonal, 4 back. */
function viewRow(p: Player): number {
  const sx = (p.faceX - p.faceZ) * Math.SQRT1_2;
  const sy = (-p.faceX - p.faceZ) * Math.SQRT1_2;
  return Math.round(Math.atan2(Math.abs(sx), -sy) / (Math.PI / 4));
}

/** Facing straight toward the camera: the rider sits a little higher to show over the mount's head. */
function headOn(p: Player): boolean {
  return viewRow(p) === 0;
}

/**
 * Facing the camera (front and front diagonal) the mount's head is nearer the camera than the rider and is
 * drawn in front of their legs. From the side and from behind the rider sits on its back, drawn over it
 * (owner 2026-11-10: the legs covered the wolf's head on the diagonal; from behind the wolf hid the rider).
 */
function mountInFront(p: Player): boolean {
  return viewRow(p) <= 1;
}

/** The riding pose a character plays now, or null on foot. */
export function ridePose(p: Player): 'ride' | 'ride_board' | null {
  const m = p.alive && shownRiding(p) ? shownCos(p, 'mount') : undefined;
  return m ? (MOUNT_LOOK[m.id]?.pose ?? 'ride') : null;
}
/** Toward the camera (it looks from +x +z), one unit. */
const TO_CAM = { x: Math.SQRT1_2, z: Math.SQRT1_2 };
const PET_FLYING = new Set(['pet_dragon', 'pet_bot', 'pet_wisp']);
/** World height of each kind's picture, and how high wings sit on the back. */
// Owner 2026-11-10: 25% bigger than the first 1.3.
const WINGS_H = 1.625;
// Measured from the art (owner 2026-11-10: they hung at the hips): the wings' middle sits on the shoulders (~1.35).
// Kept centred on the shoulders when they grew 25% (was 0.8 at 1.3 tall).
const WINGS_LIFT = 0.64;
/** How far the wings sit behind the back, seen from the side (sideways on screen only). */
const WINGS_BACK = 0.22;
const MOUNT_H = 1.35;
const PET_H = 0.8;
/** Seconds the wings take to fade out after dying, along with the fall (owner 2026-11-10). */
const WINGS_FADE = 1;

interface Piece { id: string; actor: SpriteActor }

/** Frame order of the cosmetic sheets: 1-2-1-3 (rest, flap up / step one way, rest, flap down / step the other way). */
const COS_CYCLE = [0, 1, 0, 2];

/** A card picture for the shop: the front view's first frame (wings, mounts, pets) or a glow (auras). */
export function cosCardImage(c: CosmeticDef): string {
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const sheet = sheets[cosSheetKey(c.id)];
  const img = sheet?.texture.image as CanvasImageSource & { width: number; height: number } | undefined;
  if (sheet && img) {
    const cw = img.width / sheet.cols;
    const ch = img.height / sheet.rows;
    cv.width = cw;
    cv.height = ch;
    g.drawImage(img, 0, 0, cw, ch, 0, 0, cw, ch);
  } else {
    cv.width = cv.height = 32;
    const grad = g.createRadialGradient(16, 16, 2, 16, 16, 15);
    grad.addColorStop(0, c.color2);
    grad.addColorStop(0.5, c.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
  }
  return cv.toDataURL();
}

/** Everything one character shows of its cosmetics. Owned by its PlayerView. */
export class CosmeticRig {
  private wings: Piece | null = null;
  private mount: Piece | null = null;
  private pet: (Piece & { x: number; z: number; fx: number; fz: number }) | null = null;
  private aura: { id: string; m: THREE.Mesh } | null = null;
  private clock = 0;
  private stepT = 0;
  private stepSide = 1;
  /** Seconds since dying (0 while alive), for the wings' fade. */
  private deadT = 0;
  private wingsAlpha = 1;

  constructor(private readonly scene: THREE.Scene) {}

  /** Came into view already dead: the wings are gone, no fade to watch. */
  skipDeathFade(): void {
    this.deadT = WINGS_FADE;
  }

  /** Riding (or trying a mount on): how high the character's picture should sit. */
  seat(p: Player): number {
    return seatOf(p);
  }

  /** Swaps a piece for the one now shown (or none), keeping it while it stays the same. */
  private piece(cur: Piece | null, c: CosmeticDef | undefined, height: number, shadow: number): Piece | null {
    if (cur && cur.id === c?.id) return cur;
    if (cur) {
      this.scene.remove(cur.actor.group);
      cur.actor.dispose();
    }
    const sheet = c && sheets[cosSheetKey(c.id)];
    if (!c || !sheet) return null;
    const actor = new SpriteActor(sheet, height, shadow, COS_CYCLE);
    this.scene.add(actor.group);
    return { id: c.id, actor };
  }

  update(dt: number, p: Player, fx: Effects): void {
    this.clock += dt;
    // Cursed into a toad by the Bog Witch: no wings, mount or aura on the toad (the pet still follows).
    const alive = p.alive && p.toadT <= 0;
    const seat = alive ? this.seat(p) : 0;

    // ---- wings: on the back, flapping all the time (faster while walking). Always drawn behind the body,
    // from every side (owner 2026-11-10).
    // Dying: they fade out with the fall, and come back with the revive.
    this.deadT = p.alive ? 0 : this.deadT + dt;
    const fade = p.alive ? 1 : Math.max(0, 1 - this.deadT / WINGS_FADE);
    const showWings = (alive || (!p.alive && fade > 0)) && p.toadT <= 0;
    this.wings = this.piece(this.wings, showWings ? shownCos(p, 'wings') : undefined, WINGS_H, 0);
    if (!this.wings) this.wingsAlpha = 1;
    if (this.wings) {
      const a = this.wings.actor;
      if (fade !== this.wingsAlpha) {
        this.wingsAlpha = fade;
        a.setOpacity(fade);
      }
      const fl = Math.hypot(p.faceX, p.faceZ) || 1;
      // Behind the back: the part of "backward" that runs across the screen (none facing the camera or away).
      const bx = -p.faceX / fl;
      const bz = -p.faceZ / fl;
      const along = bx * TO_CAM.x + bz * TO_CAM.z;
      const sx = (bx - along * TO_CAM.x) * WINGS_BACK;
      const sz = (bz - along * TO_CAM.z) * WINGS_BACK;
      // Behind the body: lifted WINGS_LIFT over the rider's own base (seat), then 0.15 further back.
      const [wx, wy, wz] = depthAt(p.x + sx, p.z + sz, WINGS_LIFT, -0.15);
      a.group.position.set(wx, wy, wz);
      a.setLift(WINGS_LIFT + seat);
      a.face(p.faceX, p.faceZ);
      a.update(dt, true, p.moving ? 10 : 5);
    }

    // ---- mount: under the rider
    const mc = shownRiding(p) && alive ? shownCos(p, 'mount') : undefined;
    this.mount = this.piece(this.mount, mc, mc ? (MOUNT_LOOK[mc.id]?.h ?? MOUNT_H) : MOUNT_H, 0.6);
    if (this.mount) {
      const a = this.mount.actor;
      // Head-on or from behind: the mount's head (or rear) in front of the rider. Else a little behind the
      // rider, who sits astride it (or stands on the board).
      // A board stays right under the feet, just behind the rider.
      // The rider's feet are `seat` up, the mount on the ground: measured from the rider's base it is `-seat` raised.
      const d = MOUNT_LOOK[mc!.id]?.under ? -0.05 : mountInFront(p) ? 0.1 : -0.1;
      const [mx, my, mz] = depthAt(p.x, p.z, -seat, d);
      a.group.position.set(mx, my, mz);
      a.face(p.faceX, p.faceZ);
      a.update(dt, p.moving, 11);
    }

    // ---- pet: follows a step behind and beside, on the ground or floating
    const pt = shownCos(p, 'pet');
    const hadPet = this.pet;
    const pc = this.piece(this.pet, pt, PET_H, 0.25);
    if (!pc) this.pet = null;
    else if (pc !== hadPet) this.pet = { ...pc, x: p.x - 1, z: p.z, fx: p.faceX, fz: p.faceZ };
    if (this.pet) {
      const pet = this.pet;
      const fl = Math.hypot(p.faceX, p.faceZ) || 1;
      const tx = p.x - (p.faceX / fl) * 1.1 + (p.faceZ / fl) * 0.6;
      const tz = p.z - (p.faceZ / fl) * 1.1 - (p.faceX / fl) * 0.6;
      const dx = tx - pet.x;
      const dz = tz - pet.z;
      const dist = Math.hypot(dx, dz);
      const walking = dist > 0.3;
      if (dist > 12) {
        pet.x = tx;
        pet.z = tz;
      } else if (walking) {
        const k = Math.min(1, dt * (dist > 3 ? 6 : 3.5));
        pet.x += dx * k;
        pet.z += dz * k;
        pet.fx = dx;
        pet.fz = dz;
      } else {
        // Standing next to the owner: looks the same way.
        pet.fx = p.faceX;
        pet.fz = p.faceZ;
      }
      const flying = PET_FLYING.has(pet.id);
      const a = pet.actor;
      a.group.position.set(pet.x, 0, pet.z);
      a.setLift(flying ? 0.8 + Math.sin(this.clock * 3) * 0.1 : 0);
      a.face(pet.fx, pet.fz);
      a.update(dt, walking || flying, flying ? 7 : 10);
    }

    // ---- aura: a glow on the ground, sparks around, and footprints while walking
    const au = alive ? shownCos(p, 'aura') : undefined;
    if (this.aura && this.aura.id !== au?.id) {
      this.scene.remove(this.aura.m);
      this.aura.m.geometry.dispose();
      (this.aura.m.material as THREE.Material).dispose();
      this.aura = null;
    }
    if (au && !this.aura) {
      const mat = new THREE.MeshBasicMaterial({
        map: fxTex.glow, color: au.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = -1;
      this.scene.add(mesh);
      this.aura = { id: au.id, m: mesh };
    }
    if (this.aura && au) {
      const size = 2.1 * (1 + Math.sin(this.clock * 2.5) * 0.06);
      this.aura.m.position.set(p.x, 0.05, p.z);
      this.aura.m.scale.set(size, size, 1);
      if (Math.random() < 4 * dt) {
        const ang = Math.random() * Math.PI * 2;
        fx.puff(p.x + Math.cos(ang) * 0.6, 0.3 + Math.random() * 1.2 + seat, p.z + Math.sin(ang) * 0.6, au.color, 0.8, 0.3);
      }
      this.stepT -= dt;
      if (p.moving && this.stepT <= 0) {
        this.stepT = 0.28;
        this.stepSide = -this.stepSide;
        const fl = Math.hypot(p.faceX, p.faceZ) || 1;
        const sx = (p.faceZ / fl) * 0.18 * this.stepSide;
        const sz = (-p.faceX / fl) * 0.18 * this.stepSide;
        fx.puff(p.x + sx, 0.06, p.z + sz, au.color2, 1.1, 0.32);
      }
    }
  }

  dispose(): void {
    for (const pc of [this.wings, this.mount, this.pet]) {
      if (!pc) continue;
      this.scene.remove(pc.actor.group);
      pc.actor.dispose();
    }
    if (this.aura) {
      this.scene.remove(this.aura.m);
      this.aura.m.geometry.dispose();
      (this.aura.m.material as THREE.Material).dispose();
    }
    this.wings = this.mount = this.pet = null;
    this.aura = null;
  }
}
