import * as THREE from 'three';
import { circlesOn, MagicCircle, zoneAsCircle, zoneColor } from './magicCircles';
import { fxSheets, fxTex, type FxSheet } from './assets';
import type { FxApi, SkillEffect } from '../shared/sim/types';
import { loopProps, playProps } from './zoneProps';
import { playLayer, ShotLayer, type FxLayerHooks, type FxLayerHost } from './fxLayer';
import { QuarksFx, quarksOn } from './quarksFx';

const FRAMES = 6;
const SHEET_ROWS: Record<FxSheet, number> = {
  sword: 4, mage: 5, gun: 4, gun_ult: 3, enhance: 3,
  // Sword
  sw_blade: 4, sw_gale: 4, sw_bulwark: 4,

  // Mage
  mg_a: 6, mg_b: 6, mg_c: 6, mg_d: 3, mg_e: 4, mg_f: 4, mg_g: 5,
  // Gunslinger
  gs_skill: 6, gs_gear: 6, gs_passive: 3,
  // Area skills' standing layer (zoneProps.ts)
  ap_sw_a: 4, ap_sw_b: 4, ap_sw_c: 4, ap_mg_a: 4, ap_mg_b: 4, ap_mg_c: 4, ap_mg_d: 4, ap_mg_e: 4, ap_gs_a: 4,
};

interface EffectDef {
  sheet: FxSheet;
  row: number;
  life: number;
  /** Lies flat on the ground, or faces the camera at this height. */
  height: number | 'ground';
  /** Facing the camera without turning to the effect's angle (things that rise, like the enhance burst). */
  upright?: boolean;
  /** Standing on the ground whatever its size (art drawn at the bottom of its cell: a dome, a sword stuck in the ground). */
  stand?: boolean;
  /** Multiplies the art's colours (a tinted copy of a row, e.g. the sword's dark-red Execute). */
  tint?: string;
  /** The row is drawn as one seamless loop (all 6 frames at full strength), for zones; otherwise a zone loops frames 2–5. */
  loop?: boolean;
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
  // Sword skills (owner 2026-11-15, docs/plans/sword-fx.md): one sheet per line, several skills share a row.
  sw_cleave: { sheet: 'sw_blade', row: 0, life: 0.26, height: 'ground' },
  sw_cleave_red: { sheet: 'sw_blade', row: 0, life: 0.3, height: 'ground', tint: '#ff6a6a' },
  sw_wave: { sheet: 'sw_blade', row: 1, life: 0.3, height: 0.9 },
  sw_bigsword: { sheet: 'sw_blade', row: 2, life: 0.5, height: 0, upright: true, stand: true },
  sw_nova: { sheet: 'sw_blade', row: 3, life: 0.5, height: 'ground' },
  sw_streak: { sheet: 'sw_gale', row: 0, life: 0.3, height: 0.95 },
  sw_windring: { sheet: 'sw_gale', row: 1, life: 0.36, height: 'ground' },
  sw_xslash: { sheet: 'sw_gale', row: 2, life: 0.28, height: 1, upright: true },
  sw_xslash_gold: { sheet: 'sw_gale', row: 2, life: 0.28, height: 1, upright: true, tint: '#ffd36a' },
  sw_aura: { sheet: 'sw_gale', row: 3, life: 0.6, height: 0, upright: true, stand: true },
  sw_barrier: { sheet: 'sw_bulwark', row: 0, life: 0.7, height: 0, upright: true, stand: true },
  sw_shout: { sheet: 'sw_bulwark', row: 1, life: 0.55, height: 'ground' },
  sw_crack: { sheet: 'sw_bulwark', row: 2, life: 0.5, height: 'ground' },
  sw_armorhit: { sheet: 'sw_bulwark', row: 3, life: 0.32, height: 0.9 },

  // Mage (art_templates/mage/SKILL_FX_PROMPTS.md). Lasting zones are sent again each tick, so their life ≈ one tick.
  mg_lightning: { sheet: 'mg_a', row: 4, life: 0.35, height: 1.4, upright: true },
  mg_burst: { sheet: 'mg_a', row: 5, life: 0.5, height: 0.9, upright: true },
  mg_starhit: { sheet: 'mg_b', row: 0, life: 0.4, height: 0.9, upright: true },
  mg_firefield: { sheet: 'mg_e', row: 0, life: 0.55, height: 'ground', loop: true },
  mg_flamewave: { sheet: 'mg_b', row: 2, life: 0.4, height: 'ground' },
  mg_poison: { sheet: 'mg_e', row: 1, life: 1.1, height: 'ground', loop: true },
  mg_ash: { sheet: 'mg_b', row: 4, life: 0.5, height: 'ground' },
  mg_decay: { sheet: 'mg_e', row: 2, life: 1, height: 'ground', loop: true },
  mg_shock: { sheet: 'mg_g', row: 0, life: 0.45, height: 'ground' },
  mg_curse: { sheet: 'mg_f', row: 0, life: 0.9, height: 'ground', loop: true },
  mg_vortex: { sheet: 'mg_e', row: 3, life: 0.3, height: 'ground', loop: true },
  mg_empower: { sheet: 'mg_f', row: 1, life: 0.9, height: 'ground', loop: true },
  mg_shield: { sheet: 'mg_f', row: 2, life: 1, height: 'ground', loop: true },
  mg_timewarp: { sheet: 'mg_f', row: 3, life: 1, height: 'ground', loop: true },
  // Frost Nova's own ring (round 2, top-down); the old `frost` row stays for Ice Cage's hit.
  mg_frostnova: { sheet: 'mg_g', row: 1, life: 0.6, height: 'ground' },
  // Gunslinger (art_templates/skills/FX_GUNSLINGER.md). Lasting things (mine, drone, turret, smoke, burning) are
  // played again by the sim every tick, so their life is about one tick.
  // The aura and smoke are drawn already seen at an angle, so they face the camera at the feet instead of lying flat.
  gs_aura_crit: { sheet: 'gs_skill', row: 2, life: 0.5, height: 0.4, upright: true, tint: '#ff5a6a' },
  gs_aura_rapid: { sheet: 'gs_skill', row: 2, life: 0.5, height: 0.4, upright: true, tint: '#ffc85a' },
  gs_burn: { sheet: 'gs_skill', row: 4, life: 0.6, height: 0.8, upright: true },
  gs_smoke: { sheet: 'gs_skill', row: 5, life: 1, height: 0.7, upright: true },
  gs_mine: { sheet: 'gs_gear', row: 1, life: 1, height: 'ground' },
  gs_drone: { sheet: 'gs_gear', row: 2, life: 0.8, height: 1.9, upright: true },
  gs_turret: { sheet: 'gs_gear', row: 3, life: 1, height: 0.7, upright: true },
  gs_blast: { sheet: 'gs_gear', row: 5, life: 0.5, height: 0.9, upright: true },
  gs_hawkeye: { sheet: 'gs_passive', row: 0, life: 0.45, height: 2.2, upright: true },
  gs_trigger: { sheet: 'gs_passive', row: 1, life: 0.3, height: 0.95, upright: true },
  gs_special: { sheet: 'gs_passive', row: 2, life: 0.5, height: 'ground' },
};

/** Flying shots, looked up by the colour the simulation gives each projectile. */
const SHOT_ART: Record<string, { sheet: FxSheet; row: number; scale: number }> = {
  '#9fd8ff': { sheet: 'mage', row: 0, scale: 2.6 },
  '#ff7a2a': { sheet: 'mage', row: 1, scale: 2.4 },
  '#ffe08a': { sheet: 'gun', row: 1, scale: 2.4 },
  '#ffc85a': { sheet: 'gun', row: 1, scale: 2.4 },
  '#7affe0': { sheet: 'gun', row: 2, scale: 3 },
  '#ff6a5a': { sheet: 'gun_ult', row: 1, scale: 3 },
  // Sword
  '#ff7a4a': { sheet: 'sw_blade', row: 1, scale: 2.6 },

  // Mage: Arcane Lance, Volatile Orb, Ice Cage, venom bolts (Searing Mark, Crystal Spikes)
  '#ffb06a': { sheet: 'mg_a', row: 0, scale: 3 },
  '#ff9a4a': { sheet: 'mg_a', row: 1, scale: 2.2 },
  '#bfe6ff': { sheet: 'mg_a', row: 2, scale: 2.6 },
  '#9be05a': { sheet: 'mg_a', row: 3, scale: 2.6 },
  // Gunslinger: crit round, buffed basic shot, incendiary, rocket, railgun
  '#ff5a6a': { sheet: 'gs_skill', row: 0, scale: 2.4 },
  '#ffb040': { sheet: 'gs_skill', row: 1, scale: 2.4 },
  '#ff8a3a': { sheet: 'gs_skill', row: 3, scale: 2.6 },
  '#6affc8': { sheet: 'gs_gear', row: 0, scale: 2.8 },
  '#a0fff4': { sheet: 'gs_gear', row: 4, scale: 3.4 },
};

/**
 * Mage passive auras under the feet (sheet mg_g), by worn passive id; everyone sees them (owner 2026-11-15).
 * `center`: where the art's middle is in its 256-px cell (measured over the row's frames), so it can be put
 * under the feet: Arcane Power's is drawn high in its cell and showed up beside the character (owner 2026-11-18).
 */
const PASSIVE_AURA: Record<string, { sheet: FxSheet; row: number; size: number; center: [number, number] }> = {
  mg_elementmastery: { sheet: 'mg_g', row: 2, size: 1.1, center: [131, 109] },
  mg_manasource: { sheet: 'mg_g', row: 3, size: 1.1, center: [132, 93] },
  mg_arcanepower: { sheet: 'mg_g', row: 4, size: 1.1, center: [129, 73] },
};
/** Pixels per frame cell of the fx sheets. */
const FX_CELL = 256;

/** A looping ground aura under a player for the passive they wear (null when that passive or its sheet has none). */
export class PassiveAura {
  readonly mesh: THREE.Mesh;
  private t = 0;

  private constructor(private readonly tex: THREE.Texture, private readonly art: { sheet: FxSheet; row: number; size: number; center: [number, number] }) {
    this.mesh = new THREE.Mesh(
      flat(new THREE.PlaneGeometry(2, 2)),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.mesh.scale.setScalar(art.size);
    showFrame(tex, art.sheet, art.row, 0);
  }

  static for(passive: string | undefined): PassiveAura | null {
    const art = passive ? PASSIVE_AURA[passive] : undefined;
    const tex = art && frameTexture(art.sheet);
    return art && tex ? new PassiveAura(tex, art) : null;
  }

  update(dt: number, x: number, z: number): void {
    this.t += dt;
    showFrame(this.tex, this.art.sheet, this.art.row, Math.floor(this.t * 8) % FRAMES);
    // The plane lies flat: picture right = +x, picture down = +z, 2 × size wide. Slide it so the art's middle is under the feet.
    const k = (2 * this.art.size) / FX_CELL;
    this.mesh.position.set(x - (this.art.center[0] - FX_CELL / 2) * k, 0.07, z - (this.art.center[1] - FX_CELL / 2) * k);
  }

  dispose(): void {
    this.tex.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/** Lasting zones: frames a second, fade in / out seconds, and how often their extra layer plays again (and for how long). */
const ZONE_FPS = 8;
const ZONE_FADE_IN = 0.25;
const ZONE_FADE_OUT = 0.45;
const ZONE_LAYER_EVERY = 0.45;
const ZONE_LAYER_LIFE = 0.9;

let softEdgeTex: THREE.Texture | null = null;
/** Alpha mask for zones: solid in the middle, fading to nothing at the rim, so the art melts into the ground. */
function softEdge(): THREE.Texture {
  if (softEdgeTex) return softEdgeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.62, '#fff');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  softEdgeTex = new THREE.CanvasTexture(c);
  return softEdgeTex;
}

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

  /** Its glow and trail (fxLayer.ts), if its colour has one. */
  private readonly layer: ShotLayer | null;

  constructor(private readonly tex: THREE.Texture, private readonly art: { sheet: FxSheet; row: number; scale: number }, size: number, host: FxLayerHost, color: string) {
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, transparent: false }));
    this.sprite.scale.setScalar(size * art.scale);
    showFrame(tex, art.sheet, art.row, 0);
    this.layer = ShotLayer.for(host, color, this.sprite);
  }

  update(dt: number, dx: number, dz: number): void {
    this.t += dt;
    // The first and last frames are the small build-up and fade, so a flying shot loops the middle.
    showFrame(this.tex, this.art.sheet, this.art.row, 1 + (Math.floor(this.t * 14) % (FRAMES - 2)));
    if (dx || dz) this.sprite.material.rotation = screenAngle(dx, dz);
    this.layer?.update(dt);
  }

  dispose(): void {
    this.layer?.dispose();
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
  /** Whose screen this is and the hit feel, for the extra layer (set by Game). */
  layerHooks: FxLayerHooks | null = null;
  /** When and where each skill last scattered its standing pieces (see effect()). */
  private readonly lastProps = new Map<string, { t: number; x: number; z: number }>();
  /** Where a player is now (for zones that follow their caster); set by Game. */
  posOf: ((id: number) => { x: number; z: number } | null) | null = null;

  /** three.quarks particles (trial, fxLayer.quarks): made the first time a skill that uses them plays. */
  private quarksFx: QuarksFx | null = null;
  private get quarks(): QuarksFx {
    return (this.quarksFx ??= new QuarksFx(this.scene, (by) => by === undefined || !this.layerHooks || by === this.layerHooks.me()));
  }

  constructor(private readonly scene: THREE.Scene) {}

  add(obj: THREE.Object3D, life: number, tick?: (k: number, dt: number) => void): void {
    this.scene.add(obj);
    this.list.push({ obj, t: 0, life, tick });
  }

  update(dt: number): void {
    this.quarksFx?.update(dt);
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
  effect(name: SkillEffect, x: number, z: number, angle: number, size: number, by?: number, hit?: boolean, skill?: string): void {
    // The standing layer of an area skill (zoneProps.ts), once per cast spot: a skill that plays two pictures at the
    // same place (Unleash: ring + quake) shouldn't double it.
    if (skill) {
      const now = performance.now();
      const last = this.lastProps.get(skill);
      if (!last || now - last.t > 150 || Math.hypot(last.x - x, last.z - z) > 0.5) {
        this.lastProps.set(skill, { t: now, x, z });
        playProps(this, skill, x, z, angle, size, EFFECTS[name].life);
      }
    }
    // The Meteor's blast in three.quarks, over its hand-drawn crater (trial, docs/systems/skill-fx-layer.md).
    if (name === 'crater' && skill === 'meteor' && quarksOn()) this.quarks.meteorBlast(x, z, by);
    const def = EFFECTS[name];
    const tex = frameTexture(def.sheet);
    if (!tex) {
      this.ring(x, z, size, '#ffe6a0');
      return;
    }
    showFrame(tex, def.sheet, def.row, 0);
    const play = (k: number) => showFrame(tex, def.sheet, def.row, Math.min(FRAMES - 1, Math.floor(k * FRAMES)));
    if (def.height === 'ground') {
      const mesh = this.decal(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide, color: def.tint ?? '#ffffff' }));
      mesh.position.set(x, 0.09, z);
      mesh.rotation.y = -angle;
      mesh.scale.setScalar(size);
      this.add(mesh, def.life, play);
      playLayer(this, this.layerHooks, name, mesh, x, 0, z, size, def.life, by, hit);
    } else {
      const rotation = def.upright ? 0 : screenAngle(Math.cos(angle), Math.sin(angle));
      const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, transparent: false, rotation, color: def.tint ?? '#ffffff' });
      const spr = new THREE.Sprite(mat);
      // The sprite is size × 2 tall: centred at `size` its bottom edge is on the ground.
      spr.position.set(x, def.stand ? size * 0.9 : def.height, z);
      spr.scale.setScalar(size * 2);
      this.add(spr, def.life, play);
      playLayer(this, this.layerHooks, name, spr, x, spr.position.y, z, size, def.life, by, hit);
    }
  }

  /**
   * A lasting area (owner 2026-11-15: zones that restart every tick look like a sticker): the row loops for the whole
   * `duration` with a fade in and out, its edge fades softly into the ground, and the extra layer (glow, ground light,
   * particles) is played again lightly while it lasts. `follow` keeps it under that player.
   */
  zone(name: SkillEffect, x: number, z: number, size: number, duration: number, follow?: number | null, skill?: string): void {
    // Owner 2026-11-18: a lasting area is drawn as a magic circle only (no painted area, no standing pieces).
    if (zoneAsCircle() && duration > 0) {
      this.zoneCircle(name, x, z, size, duration, follow);
      return;
    }
    const def = EFFECTS[name];
    const tex = frameTexture(def.sheet);
    if (!tex || duration <= 0) {
      if (!tex) this.ring(x, z, size, '#ffe6a0', Math.min(duration, 1));
      return;
    }
    // Rows drawn as a full loop use all 6 frames; the older rows (appear, …, fade) loop their middle four.
    const [from, count] = def.loop ? [0, FRAMES] : [1, FRAMES - 2];
    const mat = new THREE.MeshBasicMaterial({
      map: tex, alphaMap: softEdge(), transparent: true, alphaTest: 0.02, depthWrite: false, side: THREE.DoubleSide,
      color: def.tint ?? '#ffffff', opacity: 0,
    });
    const mesh = this.decal(mat);
    mesh.position.set(x, 0.08, z);
    mesh.scale.setScalar(size);
    const pos = { x, z };
    // Its standing layer loops with it and follows it (zoneProps.ts).
    loopProps(this, skill, pos, size, duration);
    let t = 0;
    let layerT = 0;
    // A magic circle under the area while it lasts (magicCircles.ts), in the class's colour.
    const circleAt = new THREE.Group();
    circleAt.position.set(x, 0, z);
    const circle = circlesOn() ? new MagicCircle(circleAt, size * 1.05) : null;
    if (circle) this.add(circleAt, duration, (k, dt) => {
      circle.set(duration - k * duration > ZONE_FADE_OUT ? zoneColor(name) : null);
      circle.update(dt);
      if (k >= 1) circle.dispose();
    });
    this.add(mesh, duration, (_k, dt) => {
      t += dt;
      const p = follow != null ? this.posOf?.(follow) : null;
      if (p) {
        pos.x = p.x;
        pos.z = p.z;
        mesh.position.set(p.x, 0.08, p.z);
        circleAt.position.set(p.x, 0, p.z);
      }
      showFrame(tex, def.sheet, def.row, from + (Math.floor(t * ZONE_FPS) % count));
      mat.opacity = Math.min(1, t / ZONE_FADE_IN, (duration - t) / ZONE_FADE_OUT);
      // The glow, ground light and particles, again every so often while it lasts.
      layerT -= dt;
      if (layerT <= 0 && duration - t > ZONE_FADE_OUT) {
        layerT = ZONE_LAYER_EVERY;
        playLayer(this, null, name, new THREE.Object3D(), pos.x, 0, pos.z, size, ZONE_LAYER_LIFE);
      }
    });
  }

  /** A lasting area as a magic circle (magicCircles.ts) in the skill's colour, following `follow` when given. */
  private zoneCircle(name: SkillEffect, x: number, z: number, size: number, duration: number, follow?: number | null): void {
    const at = new THREE.Group();
    at.position.set(x, 0, z);
    const circle = new MagicCircle(at, size, true);
    let t = 0;
    this.add(at, duration, (k, dt) => {
      t += dt;
      const p = follow != null ? this.posOf?.(follow) : null;
      if (p) at.position.set(p.x, 0, p.z);
      circle.set(duration - t > ZONE_FADE_OUT ? zoneColor(name) : null);
      circle.update(dt);
      if (k >= 1) circle.dispose();
    });
  }

  /** Hand-drawn art for a flying shot, or null when this colour of shot has none. */
  shotSprite(color: string, size: number): ShotSprite | null {
    const art = SHOT_ART[color];
    const tex = art && frameTexture(art.sheet);
    return tex ? new ShotSprite(tex, art, size, this, color) : null;
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

  /**
   * A crystal cluster standing on the ground (Crystal Spikes, owner 2026-11-15), drawn in code until it has art:
   * it grows out of the ground, glows and bobs gently while it lasts, then sinks away. Faces are shaded light / dark so
   * it reads as a solid gem from the isometric camera.
   */
  crystal(x: number, z: number, duration: number, color: string): void {
    const g = new THREE.Group();
    const base = new THREE.Color(color);
    const shard = (h: number, r: number, ox: number, oz: number, tilt: number, turn: number): void => {
      const geo = new THREE.OctahedronGeometry(1, 0).toNonIndexed();
      geo.scale(r, h, r);
      // Light on the faces turned up and toward the camera, dark on the rest.
      const pos = geo.getAttribute('position');
      const cols: number[] = [];
      for (let i = 0; i < pos.count; i += 3) {
        const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
        const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3 + (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
        const c = base.clone().multiplyScalar(cy > 0 ? (cx > 0 ? 1.35 : 1) : cx > 0 ? 0.75 : 0.5);
        for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }));
      m.position.set(ox, h, oz);
      m.rotation.set(tilt, turn, tilt * 0.6);
      g.add(m);
    };
    shard(0.75, 0.22, 0, 0, 0, 0.4);
    shard(0.45, 0.15, 0.28, 0.1, 0.45, 1.1);
    shard(0.4, 0.14, -0.22, 0.18, -0.4, 2.2);
    shard(0.32, 0.12, 0.05, -0.28, 0.35, 0.2);
    const glow = this.glowSprite(color, 2.2, 0.55);
    glow.position.y = 0.7;
    g.add(glow);
    g.position.set(x, 0, z);
    g.scale.setScalar(0.01);
    let t = 0;
    this.add(g, duration, (_k, dt) => {
      t += dt;
      // Grows out in 0.2 s, sinks away in the last 0.3 s.
      const s = Math.min(1, t / 0.2, (duration - t) / 0.3);
      g.scale.setScalar(Math.max(0.01, s));
      g.position.y = 0.05 * Math.sin(t * 3);
      g.rotation.y = t * 0.6;
      glow.material.opacity = 0.35 + 0.15 * Math.sin(t * 5);
    });
    this.ring(x, z, 1.4, color, 0.5);
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

  /**
   * A footprint picture (paper auras) lying on the ground, toes towards `angle` (rotation about Y: 0 = −Z),
   * `size` long, mirrored for the other foot, fading out over `life` seconds.
   */
  footprint(x: number, z: number, angle: number, tex: THREE.Texture, size: number, mirror: boolean, life: number): void {
    const img = tex.image as { width: number; height: number };
    const geo = new THREE.PlaneGeometry(img.width / img.height, 1);
    geo.rotateX(-Math.PI / 2);
    // Both sides: the mirrored foot is flipped.
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, 0.06, z);
    mesh.rotation.y = angle;
    mesh.scale.set(mirror ? -size : size, 1, size);
    mesh.renderOrder = -1;
    this.add(mesh, life, (k) => {
      m.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
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
  meteor(x: number, z: number, duration: number, by?: number): void {
    if (quarksOn()) {
      this.quarks.meteorFall(x, z, duration, by);
      return;
    }
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
