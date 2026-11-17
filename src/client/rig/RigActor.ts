// The papercraft sword knight drawn as a 2D skeleton (owner 2026-11-16, a trial before the whole game moves to the
// papercraft style). Flat paper pieces on bones (rigMath.ts), facing the camera, played from rig.json.
//
// It wraps the knight's usual AnimatedActor: the rig draws idle, run and the three attacks; for anything else
// (death and its crater, riding, revive, skill animations, the toad) it hands over to the old sprite, which keeps
// running underneath all the time so it is always in the right state to take over. The shadow is the old one's.
import * as THREE from 'three';
import { imgUrl } from '../img';
import { ISO_DIR } from '../world';
import type { Actor, AnimatedActor, PlayOpts } from '../AnimatedActor';
import { blendPose, parseRig, partCenter, partOf, samplePose, solveView, viewFor, type RigDef, type RigViewName, type Vec } from './rigMath';
import { allRigParts, RIG_DIR, rigPartPath, type RigArmor, type RigWeapon } from './rigLook';
import { RIG_DEFAULT_ARMOR, RIG_DEFAULT_WEAPON } from '../../shared/rigLookTuning';

const BASE = 'assets/sprites/';
const RAD = Math.PI / 180;
/** Seconds to ease from one animation into the next (what makes it look smooth instead of snapping). */
const BLEND = 0.12;
/**
 * Each piece sits this much nearer the camera than the one behind it (world units): enough to keep the draw order
 * in the depth buffer, thin enough that the whole body stays about as flat as the old sprite (wings and other
 * cosmetics are placed by small offsets toward or away from the camera).
 */
const LAYER = 0.0005;
/** Animations the rig draws itself; anything else the old sprite shows. */
const RIG_BASE = new Set(['idle', 'run', 'run_attack']);

export interface RigAssets {
  rig: RigDef;
  textures: Map<string, THREE.Texture>;
}

let loading: Promise<RigAssets> | null = null;
let loaded: RigAssets | null = null;

/** Loads rig.json and every piece once (later calls share it). */
export function loadSwordRig(): Promise<RigAssets> {
  loading ??= (async () => {
    const res = await fetch(`${BASE}${RIG_DIR}/rig.json`);
    if (!res.ok) throw new Error(`rig.json: ${res.status}`);
    const rig = parseRig(await res.json());
    const parts = new Set<string>();
    for (const v of Object.values(rig.views)) for (const b of v.bones) {
      const p = partOf(b);
      if (p) parts.add(p);
    }
    const loader = new THREE.TextureLoader();
    const textures = new Map<string, THREE.Texture>();
    await Promise.all(allRigParts(parts).map(async (path) => {
      try {
        const tex = await loader.loadAsync(imgUrl(`${BASE}${RIG_DIR}/${path}.png`));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        textures.set(path, tex);
      } catch {
        // A piece missing for one armour falls back to the dark set's piece (see texFor).
      }
    }));
    loaded = { rig, textures };
    return loaded;
  })();
  return loading;
}

/** The rig if it has finished loading (else null and the old sprite is shown). */
export const swordRigReady = (): RigAssets | null => loaded;

/** The paper faces the camera: the camera never turns, so this is worked out once (on first use). */
let facing: THREE.Quaternion | null = null;
function cameraFacing(): THREE.Quaternion {
  if (!facing) {
    const right = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
    const up = new THREE.Vector3().crossVectors(right, ISO_DIR.clone().negate()).normalize();
    facing = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, ISO_DIR.clone()));
  }
  return facing;
}
/** One square shared by every piece of every rig (never disposed). */
let square: THREE.PlaneGeometry | null = null;

interface Piece {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

type Snapshot = { pose: Record<string, number>; move: Vec };

export class RigActor implements Actor {
  readonly group = new THREE.Group();
  readonly height: number;
  /** The paper body, turned to the camera; its origin is the feet. */
  private readonly paper = new THREE.Group();
  private readonly pieces = new Map<RigViewName, Map<string, Piece>>();
  private view: RigViewName = 'front';
  private mirror = false;
  private armor: RigArmor = RIG_DEFAULT_ARMOR;
  private weapon: RigWeapon = RIG_DEFAULT_WEAPON;
  private sx = 0;
  private sy = -1;
  private base = 'idle';
  private baseT = 0;
  private stride = 1;
  private oneShot: { name: string; t: number; duration: number } | null = null;
  private shownName = '';
  private from: Snapshot | null = null;
  private blendT = 0;
  private last: Snapshot = { pose: {}, move: [0, 0] };
  private flashT = 0;
  private opacity = 1;

  constructor(private readonly old: AnimatedActor, private readonly assets: RigAssets) {
    this.height = old.height;
    this.group.add(old.group);
    this.paper.quaternion.copy(cameraFacing());
    this.group.add(this.paper);
    for (const view of ['front', 'back'] as RigViewName[]) this.pieces.set(view, this.build(view));
    this.showView();
  }

  private build(view: RigViewName): Map<string, Piece> {
    const out = new Map<string, Piece>();
    const v = this.assets.rig.views[view];
    square ??= new THREE.PlaneGeometry(1, 1);
    const geo = square;
    for (const id of v.order) {
      const b = v.bones.find((x) => x.id === id)!;
      if (!partOf(b)) continue;
      const mat = new THREE.MeshBasicMaterial({ alphaTest: 0.5, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.paper.add(mesh);
      out.set(id, { mesh, mat });
    }
    return out;
  }

  /** The sword and armour pictures to show. */
  setLook(armor: RigArmor, weapon: RigWeapon): void {
    this.armor = armor;
    this.weapon = weapon;
  }

  private texFor(view: RigViewName, part: string): THREE.Texture | undefined {
    const t = this.assets.textures;
    return t.get(rigPartPath(view, part, this.armor, this.weapon)) ?? t.get(rigPartPath(view, part, 'dark', this.weapon));
  }

  has(name: string): boolean {
    return name in this.assets.rig.anims || this.old.has(name);
  }

  face(dx: number, dz: number): void {
    this.old.face(dx, dz);
    if (dx * dx + dz * dz < 1e-6) return;
    this.sx = (dx - dz) * Math.SQRT1_2;
    this.sy = (-dx - dz) * Math.SQRT1_2;
  }

  play(name: string, opts: PlayOpts = {}): boolean {
    const oldOk = this.old.play(name, opts);
    const anim = this.assets.rig.anims[name];
    if (!anim || anim.loop) return oldOk;
    this.startBlend();
    this.oneShot = { name, t: 0, duration: opts.duration ?? anim.duration };
    return true;
  }

  reset(): void {
    this.old.reset();
    this.oneShot = null;
  }

  setRide(name: string | null): void {
    this.old.setRide(name);
  }

  setStride(rate: number): void {
    this.old.setStride(rate);
    this.stride = rate;
  }

  flash(): void {
    this.old.flash();
    this.flashT = 0.15;
  }

  setOpacity(o: number): void {
    this.old.setOpacity(o);
    this.opacity = o;
    for (const view of this.pieces.values()) for (const p of view.values()) {
      p.mat.transparent = o < 1;
      p.mat.alphaTest = o < 1 ? 0.02 : 0.5;
      p.mat.opacity = o;
    }
  }

  private startBlend(): void {
    this.from = this.last;
    this.blendT = 0;
  }

  update(dt: number, moving: boolean): void {
    this.old.update(dt, moving);
    // The old sprite decides what is shown; the rig only draws what it has an animation for.
    const shown = this.old.shownAnim;
    const rigDraws = (RIG_BASE.has(shown) || shown.startsWith('attack')) && shown !== 'ride' && !shown.startsWith('ride');
    this.old.setSpriteVisible(!rigDraws);
    this.paper.visible = rigDraws;
    if (!rigDraws) {
      this.oneShot = null;
      return;
    }

    const anims = this.assets.rig.anims;
    let snap: Snapshot;
    if (this.oneShot) {
      const o = this.oneShot;
      o.t += dt;
      if (o.t >= o.duration) {
        this.oneShot = null;
        this.startBlend();
      }
    }
    if (this.oneShot) {
      snap = samplePose(anims[this.oneShot.name], Math.min(1, this.oneShot.t / this.oneShot.duration));
      this.shownName = this.oneShot.name;
    } else {
      const want = moving && anims.run ? 'run' : 'idle';
      if (want !== this.base) {
        this.base = want;
        this.baseT = 0;
        this.startBlend();
      }
      const a = anims[this.base];
      this.baseT += this.base === 'run' ? dt * this.stride : dt;
      snap = samplePose(a, (this.baseT / a.duration) % 1);
      this.shownName = this.base;
    }
    if (this.from) {
      this.blendT += dt;
      const k = Math.min(1, this.blendT / BLEND);
      snap = blendPose(this.from, snap, k * k * (3 - 2 * k));
      if (k >= 1) this.from = null;
    }
    this.last = snap;

    const { view, mirror } = viewFor(this.sx, this.sy);
    if (view !== this.view || mirror !== this.mirror) {
      this.view = view;
      this.mirror = mirror;
      this.showView();
    }
    this.draw(snap);

    if (this.flashT > 0) {
      this.flashT -= dt;
      const k = Math.max(0, this.flashT) / 0.15;
      for (const p of this.pieces.get(this.view)!.values()) p.mat.color.setRGB(1, 1 - 0.65 * k, 1 - 0.65 * k);
    }
  }

  /** Which animation the rig drew last (the /admin bench shows it). */
  get current(): string {
    return this.shownName;
  }

  private showView(): void {
    for (const [view, pieces] of this.pieces) for (const p of pieces.values()) p.mesh.visible = view === this.view;
    this.paper.scale.x = this.mirror ? -1 : 1;
  }

  private draw(snap: Snapshot): void {
    const rig = this.assets.rig;
    const v = rig.views[this.view];
    const unit = 1 / rig.pxPerUnit;
    const sizes = (part: string) => {
      const t = this.texFor(this.view, part);
      const img = t?.image as { width: number; height: number } | undefined;
      return img ? { w: img.width, h: img.height } : undefined;
    };
    const solved = solveView(v, sizes, snap.pose, snap.move);
    const pieces = this.pieces.get(this.view)!;
    v.order.forEach((id, i) => {
      const p = pieces.get(id);
      if (!p) return;
      const b = v.bones.find((x) => x.id === id)!;
      const part = partOf(b)!;
      const tex = this.texFor(this.view, part);
      if (!tex) {
        p.mesh.visible = false;
        return;
      }
      if (p.mat.map !== tex) {
        p.mat.map = tex;
        p.mat.needsUpdate = true;
      }
      const size = sizes(part)!;
      const bp = solved.get(id)!;
      const [cx, cy] = partCenter(b, bp, size);
      p.mesh.visible = true;
      p.mesh.position.set(cx * unit, cy * unit, i * LAYER);
      p.mesh.rotation.z = bp.rot * RAD;
      p.mesh.scale.set(size.w * unit, size.h * unit, 1);
      p.mat.opacity = this.opacity;
    });
  }

  dispose(): void {
    this.old.dispose();
    // The textures and the square are shared by every rig and kept.
    for (const view of this.pieces.values()) for (const p of view.values()) p.mat.dispose();
  }
}
