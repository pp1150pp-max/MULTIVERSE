import * as THREE from 'three';
import { fxTex, type SheetInfo } from './assets';
import type { Actor, PlayOpts } from './AnimatedActor';
import { cloneShared } from './texShare';
import { moveSteps, stepColumn, type Step } from './paperMoves';

const S = Math.SQRT1_2;
const ROW_FRONT = 0;
const ROW_SIDE = 1;
const ROW_BACK = 2;
/** Sheets with this many rows also have diagonal views, so with mirroring they face 8 directions. */
const DIAGONAL_ROWS = 5;
/** Frame order while moving. Cosmetic sheets pass COS_CYCLE (rest, up, rest, down: a flap or a step each way). */
const WALK: readonly number[] = [0, 1, 2, 1];
/** A paper NPC's breathing loop, frames per second. */
const NPC_IDLE_FPS = 4;

let shadowGeo: THREE.PlaneGeometry | null = null;
let shadowMat: THREE.MeshBasicMaterial | null = null;

/** The blob shadow's plane, one for every actor (each scales its own mesh). */
export function shadowGeometry(): THREE.PlaneGeometry {
  return (shadowGeo ??= new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
}

/** The blob shadow's material, shared while an actor is fully shown; a fading actor takes its own copy (shadowFade). */
export function sharedShadowMat(): THREE.MeshBasicMaterial {
  return (shadowMat ??= new THREE.MeshBasicMaterial({ map: fxTex.shadow, transparent: true, depthWrite: false, opacity: 0.5 }));
}

/** Sets a shadow's opacity for actor opacity `o`, giving the mesh its own material first; returns the material now on it. */
export function shadowFade(shadow: THREE.Mesh, o: number): THREE.MeshBasicMaterial {
  let mat = shadow.material as THREE.MeshBasicMaterial;
  if (mat === shadowMat) {
    if (o >= 1) return mat;
    mat = mat.clone();
    shadow.material = mat;
  }
  mat.opacity = 0.5 * o;
  return mat;
}

/** Frees a shadow's own material (never the shared one). */
export function disposeShadow(shadow: THREE.Mesh): void {
  if (shadow.material !== shadowMat) (shadow.material as THREE.Material).dispose();
}

/** A camera-facing sprite standing on the ground (Ragnarok-style), with a blob shadow. */
export class SpriteActor implements Actor {
  readonly group = new THREE.Group();
  readonly sprite: THREE.Sprite;
  private readonly mat: THREE.SpriteMaterial;
  private readonly tex: THREE.Texture;
  private row = ROW_FRONT;
  private frame = 0;
  private flip = false;
  private animT = 0;
  private flashT = 0;
  /** A paper monster's move being played (paperMoves.ts), or null, and the seconds since it began. */
  private move: Step[] | null = null;
  private moveT = 0;
  private cycle: readonly number[];
  /** The paper move used as the walk ("walk" unless setWalkMove changed it). */
  private walkMove = 'walk';
  private readonly shadow: THREE.Mesh;

  /**
   * Walks with another of the paper sheet's moves (its 4 columns), e.g. the ship prisoner's "run" once its ball is gone
   * (owner 2026-11-25). Nothing happens when the sheet has no such move.
   */
  setWalkMove(name: string): void {
    const paper = this.sheet.paper;
    if (name === this.walkMove || !paper?.moves) return;
    const i = paper.moves.indexOf(name);
    if (i < 0) return;
    this.walkMove = name;
    this.cycle = Array.from({ length: paper.walk }, (_, f) => i * paper.walk + f);
  }

  constructor(private readonly sheet: SheetInfo, public height: number, shadowRadius: number, cycle: readonly number[] = WALK) {
    // A paper monster walks through its 4 walk frames in order.
    this.cycle = sheet.paper ? Array.from({ length: sheet.paper.walk }, (_, i) => i) : cycle;
    this.tex = cloneShared(sheet.texture);
    this.mat = new THREE.SpriteMaterial({ map: this.tex, alphaTest: 0.5, transparent: false });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.center.set(0.5, 0.02);
    this.setHeight(height);

    const shadow = new THREE.Mesh(shadowGeometry(), sharedShadowMat());
    this.shadow = shadow;
    shadow.scale.set(shadowRadius * 2.2, 1, shadowRadius * 1.4);
    shadow.position.y = 0.02;
    this.group.add(shadow, this.sprite);
    this.applyUV();
  }

  /** Changes the picture's world height (the cosmetics bench's size sliders). */
  setHeight(h: number): void {
    this.height = h;
    const drawn = h * (this.sheet.paper?.scale ?? 1);
    this.sprite.scale.set(drawn * this.sheet.cellAspect, drawn, 1);
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
    if (this.move) {
      this.moveT += dt;
      const col = stepColumn(this.move, this.moveT);
      if (col < 0) this.move = null;
      else this.frame = col;
    }
    if (this.move) {
      // Showing one of the move's frames.
    } else if (moving) {
      this.animT += dt * fps;
      this.frame = this.cycle[Math.floor(this.animT) % this.cycle.length];
    } else if (this.sheet.idleFrames) {
      // A paper NPC breathes while it stands: its frames in order, slowly.
      this.animT += dt * NPC_IDLE_FPS;
      this.frame = Math.floor(this.animT) % this.sheet.idleFrames;
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

  /**
   * Simple sheets only have walk frames, so one-shot animations are no-ops. A paper monster plays 'attack', and a floor 2
   * boss (or a field monster listed there) its own moves (paperMoves.ts): `duration` = the wind-up's or the hold's seconds, as the Sim sends it. A new move
   * takes over from the one playing.
   */
  play(name: string, opts?: PlayOpts): boolean {
    const steps = this.stepsFor(name, opts?.duration ?? 0.3);
    if (!steps) return false;
    this.move = steps;
    this.moveT = 0;
    return true;
  }

  has(name: string): boolean {
    return !!this.stepsFor(name, 0.3);
  }

  private stepsFor(name: string, duration: number): Step[] | null {
    const paper = this.sheet.paper;
    return paper ? moveSteps(paper.sheet, paper.moves, name, duration) : null;
  }

  reset(): void {
    this.move = null;
  }

  /** Cuts the picture with world-space planes (the renderer has localClippingEnabled); null = whole. */
  setClip(planes: THREE.Plane[] | null): void {
    this.mat.clippingPlanes = planes;
    this.mat.needsUpdate = true;
  }

  setOpacity(o: number): void {
    this.mat.transparent = true;
    this.mat.alphaTest = 0.02;
    this.mat.opacity = o;
    shadowFade(this.shadow, o);
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
    disposeShadow(this.shadow);
  }
}
