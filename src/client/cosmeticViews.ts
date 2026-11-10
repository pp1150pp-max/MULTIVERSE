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

/** How high a rider sits above the ground. */
export const MOUNT_SEAT = 0.55;
/**
 * Per mount: the world height of its picture (the whole cell, as cut by tools/cut_cosmetics.cjs), how high
 * the rider's feet sit, and which riding pose the classes play (`ride` astride, `ride_board` standing).
 */
export const MOUNT_LOOK: Record<string, { h: number; seat: number; pose: 'ride' | 'ride_board' }> = {
  mount_wolf: { h: 1.5, seat: 0.5, pose: 'ride' },
  mount_warhorse: { h: 1.7, seat: 0.62, pose: 'ride' },
  mount_raptor: { h: 1.75, seat: 0.62, pose: 'ride' },
  mount_tortoise: { h: 1.8, seat: 0.7, pose: 'ride' },
  mount_hoverboard: { h: 0.7, seat: 0.32, pose: 'ride_board' },
};

/** How high a character's feet sit: on its mount's saddle while riding (or trying one on), else 0. */
export function seatOf(p: Player): number {
  const m = shownRiding(p) ? shownCos(p, 'mount') : undefined;
  return m ? (MOUNT_LOOK[m.id]?.seat ?? MOUNT_SEAT) : 0;
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
const WINGS_H = 1.3;
const WINGS_LIFT = 0.55;
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

    // ---- wings: on the back, flapping all the time (faster while walking). Behind the body seen from
    // the front, in front of it seen from behind (nudged toward or away from the camera).
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
      const d = p.faceX + p.faceZ > 0 ? -0.15 : 0.15;
      a.group.position.set(p.x + TO_CAM.x * d, 0, p.z + TO_CAM.z * d);
      a.setLift(WINGS_LIFT + seat);
      a.face(p.faceX, p.faceZ);
      a.update(dt, true, p.moving ? 10 : 5);
    }

    // ---- mount: under the rider
    const mc = shownRiding(p) && alive ? shownCos(p, 'mount') : undefined;
    this.mount = this.piece(this.mount, mc, mc ? (MOUNT_LOOK[mc.id]?.h ?? MOUNT_H) : MOUNT_H, 0.6);
    if (this.mount) {
      const a = this.mount.actor;
      // A little behind the rider, who sits astride it (or stands on the board) in front.
      a.group.position.set(p.x - TO_CAM.x * 0.1, 0, p.z - TO_CAM.z * 0.1);
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
