import * as THREE from 'three';
import { fxSheets, fxTex, type FxSheet } from './assets';
import type { FxApi, SkillEffect } from '../shared/sim/types';

const FRAMES = 6;
const SHEET_ROWS: Record<FxSheet, number> = { sword: 4, mage: 5, gun: 4, gun_ult: 3, enhance: 3 };

interface EffectDef {
  sheet: FxSheet;
  row: number;
  life: number;
  /** Lies flat on the ground, or faces the camera at this height. */
  height: number | 'ground';
  /** Facing the camera without turning to the effect's angle (things that rise, like the enhance burst). */
  upright?: boolean;
}

const EFFECTS: Record<SkillEffect, EffectDef> = {
  slash: { sheet: 'sword', row: 0, life: 0.22, height: 'ground' },
  whirlwind: { sheet: 'sword', row: 1, life: 0.38, height: 'ground' },
  charge: { sheet: 'sword', row: 2, life: 0.32, height: 0.95 },
  quake: { sheet: 'sword', row: 3, life: 0.6, height: 'ground' },
  explosion: { sheet: 'mage', row: 2, life: 0.5, height: 0.9 },
  frost: { sheet: 'mage', row: 3, life: 0.6, height: 'ground' },
  crater: { sheet: 'mage', row: 4, life: 0.7, height: 'ground' },
  muzzle: { sheet: 'gun', row: 0, life: 0.14, height: 0.95 },
  impact: { sheet: 'gun', row: 3, life: 0.32, height: 0.3 },
  // Headshot (Gunslinger R): the reticle locks on over the whole aim, then a big hit on the target.
  reticle: { sheet: 'gun_ult', row: 0, life: 0.8, height: 'ground' },
  headshot_hit: { sheet: 'gun_ult', row: 2, life: 0.42, height: 0.95 },
  // Blacksmith result over the player's head, seen by everyone nearby (row 0 is the hammer, played in the forge window).
  enhance_ok: { sheet: 'enhance', row: 1, life: 0.9, height: 2.5, upright: true },
  enhance_fail: { sheet: 'enhance', row: 2, life: 0.9, height: 2.5, upright: true },
};

/** Flying shots, looked up by the colour the simulation gives each projectile. */
const SHOT_ART: Record<string, { sheet: FxSheet; row: number; scale: number }> = {
  '#9fd8ff': { sheet: 'mage', row: 0, scale: 2.6 },
  '#ff7a2a': { sheet: 'mage', row: 1, scale: 2.4 },
  '#ffe08a': { sheet: 'gun', row: 1, scale: 2.4 },
  '#ffc85a': { sheet: 'gun', row: 1, scale: 2.4 },
  '#7affe0': { sheet: 'gun', row: 2, scale: 3 },
  '#ff6a5a': { sheet: 'gun_ult', row: 1, scale: 3 },
};

/** The on-screen angle of a world direction under the isometric camera. */
const screenAngle = (dx: number, dz: number) => Math.atan2(-dx - dz, dx - dz);

function frameTexture(sheet: FxSheet): THREE.Texture | null {
  const base = fxSheets[sheet];
  if (!base) return null;
  const tex = base.clone();
  tex.needsUpdate = true;
  tex.userData.effectFrame = true;
  return tex;
}

function showFrame(tex: THREE.Texture, sheet: FxSheet, row: number, frame: number): void {
  const rows = SHEET_ROWS[sheet];
  tex.repeat.set(1 / FRAMES, 1 / rows);
  tex.offset.set(frame / FRAMES, 1 - (row + 1) / rows);
}

/** A looping animated projectile sprite that points along its flight. */
export class ShotSprite {
  readonly sprite: THREE.Sprite;
  private t = Math.random();

  constructor(private readonly tex: THREE.Texture, private readonly art: { sheet: FxSheet; row: number; scale: number }, size: number) {
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, transparent: false }));
    this.sprite.scale.setScalar(size * art.scale);
    showFrame(tex, art.sheet, art.row, 0);
  }

  update(dt: number, dx: number, dz: number): void {
    this.t += dt;
    // The first and last frames are the small build-up and fade, so a flying shot loops the middle.
    showFrame(this.tex, this.art.sheet, this.art.row, 1 + (Math.floor(this.t * 14) % (FRAMES - 2)));
    if (dx || dz) this.sprite.material.rotation = screenAngle(dx, dz);
  }

  dispose(): void {
    this.tex.dispose();
    this.sprite.material.dispose();
  }
}

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
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
      const mat = o.material as THREE.MeshBasicMaterial | THREE.SpriteMaterial;
      // Each animated effect owns a copy of its sheet's texture for its own frame offset.
      if (mat.map?.userData.effectFrame) mat.map.dispose();
      mat.dispose();
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

  private mat(color: string, opacity: number, additive = true, map: THREE.Texture | null = null): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, map,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
  }

  /** Ground decal drawn from a pixel-art circle texture. Scale it by the radius. */
  private decal(m: THREE.MeshBasicMaterial): THREE.Mesh {
    return new THREE.Mesh(flat(new THREE.PlaneGeometry(2, 2)), m);
  }

  glowSprite(color: string, size: number, opacity = 1): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fxTex.glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity,
    }));
    s.scale.set(size, size, 1);
    return s;
  }

  /** Plays one row of a skill's animation sheet, once. */
  effect(name: SkillEffect, x: number, z: number, angle: number, size: number): void {
    const def = EFFECTS[name];
    const tex = frameTexture(def.sheet);
    if (!tex) {
      this.ring(x, z, size, '#ffe6a0');
      return;
    }
    showFrame(tex, def.sheet, def.row, 0);
    const play = (k: number) => showFrame(tex, def.sheet, def.row, Math.min(FRAMES - 1, Math.floor(k * FRAMES)));
    if (def.height === 'ground') {
      const mesh = this.decal(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide }));
      mesh.position.set(x, 0.09, z);
      mesh.rotation.y = -angle;
      mesh.scale.setScalar(size);
      this.add(mesh, def.life, play);
    } else {
      const rotation = def.upright ? 0 : screenAngle(Math.cos(angle), Math.sin(angle));
      const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, transparent: false, rotation });
      const spr = new THREE.Sprite(mat);
      spr.position.set(x, def.height, z);
      spr.scale.setScalar(size * 2);
      this.add(spr, def.life, play);
    }
  }

  /** Hand-drawn art for a flying shot, or null when this colour of shot has none. */
  shotSprite(color: string, size: number): ShotSprite | null {
    const art = SHOT_ART[color];
    const tex = art && frameTexture(art.sheet);
    return tex ? new ShotSprite(tex, art, size) : null;
  }

  /** Arc swipe on the ground. angle = atan2(dz, dx). */
  slash(x: number, z: number, angle: number, arc: number, radius: number, color: string): void {
    const m = this.mat(color, 0.85);
    // Few segments on purpose: a faceted arc reads as pixel art next to the sprites.
    const mesh = new THREE.Mesh(flat(new THREE.RingGeometry(radius * 0.35, radius, 8, 1, -arc / 2, arc)), m);
    mesh.position.set(x, 0.4, z);
    mesh.rotation.y = -angle;
    this.add(mesh, 0.18, (k) => {
      m.opacity = 0.85 * (1 - k);
      mesh.scale.setScalar(0.8 + 0.3 * k);
    });
  }

  ring(x: number, z: number, radius: number, color: string, life = 0.4): void {
    const m = this.mat(color, 0.9, true, fxTex.ring);
    const mesh = this.decal(m);
    mesh.position.set(x, 0.06, z);
    this.add(mesh, life, (k) => {
      mesh.scale.setScalar(radius * (0.3 + 0.7 * Math.sqrt(k)));
      m.opacity = 0.9 * (1 - k);
    });
  }

  disc(x: number, z: number, radius: number, color: string, life = 0.35): void {
    const m = this.mat(color, 0.55, true, fxTex.disc);
    const mesh = this.decal(m);
    mesh.position.set(x, 0.05, z);
    mesh.scale.setScalar(radius);
    this.add(mesh, life, (k) => {
      m.opacity = 0.55 * (1 - k);
    });
  }

  /** Red warning circle that fills up until the hit lands. */
  telegraph(x: number, z: number, radius: number, duration: number, color = '#ff3a2a'): void {
    const g = new THREE.Group();
    const edge = this.decal(this.mat(color, 0.7, false, fxTex.edge));
    const fill = this.decal(this.mat(color, 0.28, false, fxTex.disc));
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
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4, 8, 1, true), m);
    col.position.set(x, 2, z);
    this.add(col, 1.2, (k) => {
      m.opacity = 0.6 * (1 - k);
      col.scale.set(1 + k * 0.5, 1 + k, 1 + k * 0.5);
    });
    this.ring(x, z, 3, '#ffd34a', 0.8);
    this.burst(x, 1, z, '#ffe27a', 16, 5);
  }

  marker(x: number, z: number): void {
    const m = this.mat('#8cff8c', 0.9, true, fxTex.ring);
    const mesh = this.decal(m);
    mesh.position.set(x, 0.06, z);
    this.add(mesh, 0.35, (k) => {
      mesh.scale.setScalar(0.6 * (1 - k) + 0.1);
      m.opacity = 0.9 * (1 - k);
    });
  }

  /** Visual only: a fireball falling onto (x, z) over `duration`. */
  meteor(x: number, z: number, duration: number): void {
    const shot = this.shotSprite('#ff7a2a', 1.6);
    const s = shot?.sprite ?? this.glowSprite('#ff7a2a', 1.8);
    let last = 0;
    this.add(s, duration, (k) => {
      const e = k * k;
      s.position.set(x - 4 * (1 - e), 14 * (1 - e) + 0.4, z - 4 * (1 - e));
      // Falling straight down the screen, so the flame trails upward.
      shot?.update(k - last, 0, 0);
      if (shot) s.material.rotation = -Math.PI / 2;
      last = k;
    });
  }
}

/**
 * Touch drag-to-aim guide (mobile plan 3.3): a line along the aimed direction, sized to the skill's reach
 * (with a ring at its end for skills that burst there), or a circle on the ground where an area skill lands.
 * Drawn with plain Three.js shapes, no images. One persistent guide, moved every frame while a finger aims.
 */
export class AimGuide {
  private readonly group = new THREE.Group();
  private readonly line: THREE.Mesh;
  private readonly lineEdge: THREE.Mesh;
  private readonly spot = new THREE.Group();
  private readonly spotEdge: THREE.Mesh;
  private readonly spotDisc: THREE.Mesh;

  constructor(scene: THREE.Scene, color = '#9fd8ff') {
    // Drawn over trees and props (no depth test): an aim hidden behind a tree is no use.
    const mat = (opacity: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
    // A 1-unit strip from the origin along +x, stretched to the reach; a thin bright centre line on top.
    this.line = new THREE.Mesh(flat(new THREE.PlaneGeometry(1, 0.7).translate(0.5, 0, 0)), mat(0.3));
    this.lineEdge = new THREE.Mesh(flat(new THREE.PlaneGeometry(1, 0.1).translate(0.5, 0, 0)), mat(0.9));
    this.lineEdge.position.y = 0.005;
    this.spotDisc = new THREE.Mesh(flat(new THREE.CircleGeometry(1, 64)), mat(0.25));
    this.spotEdge = new THREE.Mesh(flat(new THREE.RingGeometry(0.93, 1, 64)), mat(0.85));
    this.spot.add(this.spotDisc, this.spotEdge);
    this.line.renderOrder = this.lineEdge.renderOrder = this.spotDisc.renderOrder = this.spotEdge.renderOrder = 50;
    this.group.add(this.line, this.lineEdge);
    this.group.position.y = 0.08;
    this.spot.position.y = 0.09;
    this.group.visible = this.spot.visible = false;
    scene.add(this.group, this.spot);
  }

  /** A line from (x, z) along `angle` (radians, atan2(dz, dx)) for `length` units; `endRadius` adds a ring at its end. */
  showLine(x: number, z: number, angle: number, length: number, endRadius = 0): void {
    this.group.visible = true;
    this.group.position.x = x;
    this.group.position.z = z;
    this.group.rotation.y = -angle;
    this.line.scale.x = this.lineEdge.scale.x = length;
    if (endRadius > 0) this.placeSpot(x + Math.cos(angle) * length, z + Math.sin(angle) * length, endRadius);
    else this.spot.visible = false;
  }

  /** A circle of `radius` on the ground at (x, z), for skills that land on a spot. */
  showCircle(x: number, z: number, radius: number): void {
    this.group.visible = false;
    this.placeSpot(x, z, radius);
  }

  hide(): void {
    this.group.visible = this.spot.visible = false;
  }

  private placeSpot(x: number, z: number, radius: number): void {
    this.spot.visible = true;
    this.spot.position.x = x;
    this.spot.position.z = z;
    this.spot.scale.setScalar(radius);
  }
}
