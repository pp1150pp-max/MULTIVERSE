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
import { tuneBool, tuneNum } from './cosTune';
import { ISO_DIR } from './world';
import { axisHiddenInRow, viewGroupOfRow, viewOffKey, type Axis } from '../shared/cosTuning';

/**
 * Draw order between the character and its cosmetics. The camera is orthographic and looks down, so a
 * picture raised off the ground counts as nearer the camera than one on the ground: a rider on a saddle
 * would always cover the mount, and wings raised to the shoulders would cover the body. Sliding a piece
 * along the camera's own direction changes only that, never where it shows on screen; this returns the
 * position `(x, z)` slid so the piece sits `depth` units nearer the camera than the character's feet
 * (negative = behind), counting its lift `raised` above them.
 */
/**
 * A sideways nudge on screen, in every view (owner 2026-11-11): + is screen right, mirrored while the
 * character faces left (as its picture is), so one value fits both sides. Screen right in the world is +x −z.
 */
function screenShift(p: Player, amount: number): [number, number] {
  if (!amount) return [0, 0];
  const sx = (p.faceX - p.faceZ) * Math.SQRT1_2;
  const dir = sx < -0.05 ? -1 : 1;
  return [dir * amount * Math.SQRT1_2, -dir * amount * Math.SQRT1_2];
}

/**
 * The per-view X/Y/Z offsets of a piece (owner 2026-11-11, see cosTuning.ts): X = the character's right,
 * Y = up, Z = forward, in the view the character shows now. An axis that has no visible effect in the view
 * (Z straight from the front or back, X from the side) is left out.
 */
function viewOff(p: Player, id: string): { x: number; y: number; z: number; rx: number; rz: number; fx: number; fz: number } {
  const row = viewRow(p);
  const g = viewGroupOfRow(row);
  const val = (a: Axis) => (axisHiddenInRow(a, row) ? 0 : tuneNum(id, viewOffKey(a, g)));
  const fl = Math.hypot(p.faceX, p.faceZ) || 1;
  // forward (fx, fz) and the character's right (−fz, fx), as unit vectors in the world's x/z plane.
  return { x: val('x'), y: val('y'), z: val('z'), rx: -p.faceZ / fl, rz: p.faceX / fl, fx: p.faceX / fl, fz: p.faceZ / fl };
}

/** World x/z shift of a piece for `dx` to the character's right and `dz` forward. */
function moveBy(o: ReturnType<typeof viewOff>, dx: number, dz: number): [number, number] {
  return [o.rx * dx + o.fx * dz, o.rz * dx + o.fz * dz];
}

function depthAt(x: number, z: number, raised: number, depth: number): [number, number, number] {
  const k = depth - raised * ISO_DIR.y;
  return [x + ISO_DIR.x * k, ISO_DIR.y * k, z + ISO_DIR.z * k];
}

// Every size and distance below is the cosmetic's tuning (src/shared/cosTuning.ts: the code defaults,
// with the owner's server-wide changes from the /admin "ของแต่งตัว" tab on top), read each frame.

/** How high a character's feet sit: on its mount's saddle while riding (or trying one on), else 0. */
export function seatOf(p: Player): number {
  const m = shownRiding(p) ? shownCos(p, 'mount') : undefined;
  if (!m) return 0;
  // Seen head-on or from behind the rider sits higher, so the mount's head (or rear) in front of them
  // doesn't hide their body.
  return tuneNum(m.id, 'seat') + viewOff(p, m.id).y + (!tuneBool(m.id, 'under') && headOn(p) ? tuneNum(m.id, 'headOnLift') : 0);
}

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

/** On the front diagonal the mount is cut in two around the rider (see CosmeticRig: mountHead). */
function mountSplit(p: Player, id: string): boolean {
  // Owner 2026-11-10: the front diagonal (#200), the side and back diagonal too (#201: the legs showed in
  // front of the whole animal). Each view can be switched off on the bench.
  const row = viewRow(p);
  return (row === 1 && tuneBool(id, 'cutFrontDiag')) || (row === 2 && tuneBool(id, 'cutSide')) || (row === 3 && tuneBool(id, 'cutBackDiag'));
}

/**
 * Facing the camera (front and front diagonal) the mount's head is nearer the camera than the rider and is
 * drawn in front of their legs. From the side and from behind the rider sits on its back, drawn over it
 * (owner 2026-11-10: the legs covered the wolf's head on the diagonal; from behind the wolf hid the rider).
 */
function mountInFront(p: Player, id: string): boolean {
  return viewRow(p) <= (tuneBool(id, 'frontDiag') ? 1 : 0);
}

/** The riding pose a character plays now, or null on foot. */
export function ridePose(p: Player): 'ride' | 'ride_board' | null {
  const m = p.alive && shownRiding(p) ? shownCos(p, 'mount') : undefined;
  return m ? (tuneBool(m.id, 'board') ? 'ride_board' : 'ride') : null;
}
/** Toward the camera (it looks from +x +z), one unit. */
const TO_CAM = { x: Math.SQRT1_2, z: Math.SQRT1_2 };
/**
 * Owner 2026-11-10: the wings belong in the middle of the back. Their roots (the binding between them) sit
 * `root` of the way up the picture; this puts them `backStand` up standing, `backSeat` above the saddle riding.
 */
function wingsLift(id: string, riding: boolean): number {
  return tuneNum(id, riding ? 'backSeat' : 'backStand') - tuneNum(id, 'h') * tuneNum(id, 'root');
}
/** Seconds the wings take to fade out after dying, along with the fall (owner 2026-11-10). */
const WINGS_FADE = 1;

interface Piece { id: string; actor: SpriteActor; h: number }

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
  /** The mount's head half, drawn in front of the rider on the front diagonal (see mountSplit). */
  private mountHead: SpriteActor | null = null;
  private readonly headClip = new THREE.Plane();
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
    if (cur && cur.id === c?.id) {
      if (cur.h !== height) {
        cur.h = height;
        cur.actor.setHeight(height);
      }
      return cur;
    }
    if (cur) {
      this.scene.remove(cur.actor.group);
      cur.actor.dispose();
    }
    const sheet = c && sheets[cosSheetKey(c.id)];
    if (!c || !sheet) return null;
    const actor = new SpriteActor(sheet, height, shadow, COS_CYCLE);
    this.scene.add(actor.group);
    return { id: c.id, actor, h: height };
  }

  update(dt: number, p: Player, fx: Effects): void {
    this.clock += dt;
    // Cursed into a toad by the Bog Witch: no wings, mount or aura on the toad (the pet still follows).
    const alive = p.alive && p.toadT <= 0;
    const seat = alive ? this.seat(p) : 0;

    // ---- wings: on the back, flapping all the time (faster while walking). Behind the body seen from the
    // front and the side, over the back when it is turned to the camera (owner 2026-11-10).
    // Dying: they fade out with the fall, and come back with the revive.
    this.deadT = p.alive ? 0 : this.deadT + dt;
    const fade = p.alive ? 1 : Math.max(0, 1 - this.deadT / WINGS_FADE);
    const showWings = (alive || (!p.alive && fade > 0)) && p.toadT <= 0;
    const wc = showWings ? shownCos(p, 'wings') : undefined;
    this.wings = this.piece(this.wings, wc, wc ? tuneNum(wc.id, 'h') : 0, 0);
    if (!this.wings) this.wingsAlpha = 1;
    if (this.wings) {
      const id = this.wings.id;
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
      const vo = viewOff(p, id);
      // Z (forward +) is the old "back" turned around, with this view's offset on top.
      const backBy = tuneNum(id, 'back') - vo.z;
      const [ox, oz] = moveBy(vo, vo.x, 0);
      const sx = (bx - along * TO_CAM.x) * backBy + ox;
      const sz = (bz - along * TO_CAM.z) * backBy + oz;
      // Roots on the middle of the back (wingsLift over the rider's own base); 0.15 behind the body, or in front of it when
      // the back is turned to the camera.
      // (Tuned: `depth` from the body, `overBack` switches the in-front-from-behind part.)
      const back = tuneBool(id, 'overBack') && (p.faceX + p.faceZ) / fl < -0.3;
      const lift = wingsLift(id, seat > 0) + vo.y;
      const depth = tuneNum(id, 'depth');
      const [hx, hz] = screenShift(p, tuneNum(id, 'shift'));
      const [wx, wy, wz] = depthAt(p.x + sx + hx, p.z + sz + hz, lift, back ? depth : -depth);
      a.group.position.set(wx, wy, wz);
      a.setLift(lift + seat);
      a.face(p.faceX, p.faceZ);
      a.update(dt, true, tuneNum(id, p.moving ? 'flapWalk' : 'flap'));
    }

    // ---- mount: under the rider
    const mc = shownRiding(p) && alive ? shownCos(p, 'mount') : undefined;
    const hadMount = this.mount;
    this.mount = this.piece(this.mount, mc, mc ? tuneNum(mc.id, 'h') : 0, 0.6);
    if (this.mount !== hadMount) this.dropMountHead();
    if (this.mount) {
      const id = this.mount.id;
      const mh = tuneNum(id, 'h');
      const a = this.mount.actor;
      // Head-on or from behind: the mount's head (or rear) in front of the rider. Else a little behind the
      // rider, who sits astride it (or stands on the board).
      // A board stays right under the feet, just behind the rider.
      // The rider's feet are `seat` up, the mount on the ground: measured from the rider's base it is `-seat` raised.
      const under = tuneBool(id, 'under');
      const split = !under && mountSplit(p, id);
      const d = under ? -tuneNum(id, 'underBehind') : !split && mountInFront(p, id) ? tuneNum(id, 'front') : -tuneNum(id, 'behind');
      const [shx, shz] = screenShift(p, tuneNum(id, 'shift'));
      const vo = viewOff(p, id);
      const [ox, oz] = moveBy(vo, vo.x, tuneNum(id, 'z') + vo.z);
      const [mx, my, mz] = depthAt(p.x + shx + ox, p.z + shz + oz, -seat, d);
      a.group.position.set(mx, my, mz);
      a.face(p.faceX, p.faceZ);
      // On the front diagonal: the whole mount behind the rider, plus its head half again in front of them,
      // cut at the rider's middle on screen. One leg shows over the body, the other goes behind the neck.
      // Made with the mount and animated with it every frame, so the two halves always show the same frame.
      if (!this.mountHead) {
        this.mountHead = new SpriteActor(sheets[cosSheetKey(this.mount.id)], mh, 0, COS_CYCLE);
        this.mountHead.setClip([this.headClip]);
        this.scene.add(this.mountHead.group);
      }
      if (this.mountHead) {
        if (this.mountHead.height !== mh) this.mountHead.setHeight(mh);
        this.mountHead.group.visible = split;
        this.mountHead.face(p.faceX, p.faceZ);
        this.mountHead.update(dt, p.moving, tuneNum(id, 'anim'));
        if (split) {
          // Screen right in the world is +x −z. In front of the rider: the head half on the front diagonal and
          // from the side, the tail half on the back diagonal (the end nearer the camera), cut at the rider's middle.
          const sx = (p.faceX - p.faceZ) * Math.SQRT1_2;
          const sign = (sx >= 0 ? 1 : -1) * (viewRow(p) === 3 ? -1 : 1);
          this.headClip.normal.set(sign * Math.SQRT1_2, 0, -sign * Math.SQRT1_2);
          this.headClip.constant = -(this.headClip.normal.x * p.x + this.headClip.normal.z * p.z);
          const [hx, hy, hz] = depthAt(p.x + shx + ox, p.z + shz + oz, -seat, tuneNum(id, 'splitFront'));
          this.mountHead.group.position.set(hx, hy, hz);
        }
      }
      a.update(dt, p.moving, tuneNum(id, 'anim'));
    }

    // ---- pet: follows a step behind and beside, on the ground or floating
    const pt = shownCos(p, 'pet');
    const hadPet = this.pet;
    const pc = this.piece(this.pet, pt, pt ? tuneNum(pt.id, 'h') : 0, 0.25);
    if (!pc) this.pet = null;
    else if (pc !== hadPet) this.pet = { ...pc, x: p.x - 1, z: p.z, fx: p.faceX, fz: p.faceZ };
    if (this.pet) {
      const pet = this.pet;
      const fl = Math.hypot(p.faceX, p.faceZ) || 1;
      const back = tuneNum(pet.id, 'back');
      const side = tuneNum(pet.id, 'side');
      const vo = viewOff(p, pet.id);
      const [ox, oz] = moveBy(vo, vo.x, vo.z);
      const tx = p.x - (p.faceX / fl) * back + (p.faceZ / fl) * side + ox;
      const tz = p.z - (p.faceZ / fl) * back - (p.faceX / fl) * side + oz;
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
      const flying = tuneBool(pet.id, 'fly');
      const a = pet.actor;
      a.group.position.set(pet.x, 0, pet.z);
      a.setLift(flying ? tuneNum(pet.id, 'float') + vo.y + Math.sin(this.clock * 3) * tuneNum(pet.id, 'bob') : 0);
      a.face(pet.fx, pet.fz);
      a.update(dt, walking || flying, tuneNum(pet.id, 'anim'));
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
        map: fxTex.glow, color: au.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: tuneNum(au.id, 'alpha'),
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = -1;
      this.scene.add(mesh);
      this.aura = { id: au.id, m: mesh };
    }
    if (this.aura && au) {
      const id = au.id;
      (this.aura.m.material as THREE.MeshBasicMaterial).opacity = tuneNum(id, 'alpha');
      const size = tuneNum(id, 'size') * (1 + Math.sin(this.clock * 2.5) * tuneNum(id, 'pulse'));
      const [ax, az] = screenShift(p, tuneNum(id, 'shift'));
      const vo = viewOff(p, id);
      const [ox, oz] = moveBy(vo, vo.x, 0);
      this.aura.m.position.set(p.x + ax + ox, 0.05, p.z + az + oz);
      this.aura.m.scale.set(size, size, 1);
      if (Math.random() < tuneNum(id, 'sparks') * dt) {
        const ang = Math.random() * Math.PI * 2;
        fx.puff(p.x + Math.cos(ang) * 0.6, 0.3 + Math.random() * 1.2 + seat, p.z + Math.sin(ang) * 0.6, au.color, 0.8, tuneNum(id, 'sparkSize'));
      }
      this.stepT -= dt;
      if (p.moving && this.stepT <= 0) {
        this.stepT = tuneNum(id, 'stepEvery');
        this.stepSide = -this.stepSide;
        const fl = Math.hypot(p.faceX, p.faceZ) || 1;
        const sx = (p.faceZ / fl) * 0.18 * this.stepSide;
        const sz = (-p.faceX / fl) * 0.18 * this.stepSide;
        fx.puff(p.x + sx, 0.06, p.z + sz, au.color2, 1.1, tuneNum(id, 'stepSize'));
      }
    }
  }

  private dropMountHead(): void {
    if (!this.mountHead) return;
    this.scene.remove(this.mountHead.group);
    this.mountHead.dispose();
    this.mountHead = null;
  }

  dispose(): void {
    this.dropMountHead();
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
