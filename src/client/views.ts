// Sprites for simulation entities. Each view reads its entity every frame; the simulation never
// touches Three.js, so the same entities can come from a local Sim or (later) the server.
import * as THREE from 'three';
import type { Player } from '../shared/sim/Player';
import type { Monster } from '../shared/sim/Monster';
import { itemArt } from '../shared/data/items';
import { STONE_COLOR } from '../shared/data/stones';
import { LOOT_POP_TIME, type Loot } from '../shared/sim/Loot';
import type { SimEvent } from '../shared/sim/types';
import { SpriteActor } from './SpriteActor';
import { OrbRing } from './orbs';
import { AnimatedActor, type Actor } from './AnimatedActor';
import { animSets, decalTex, fxTex, sheets } from './assets';
import type { Effects, ShotSprite } from './effects';
import type { ProjectileLike } from './backend';

type AnimEvent = Extract<SimEvent, { t: 'anim' }>;

/**
 * Enhancement aura by tier (+7 / +10 / +13 / +15 on the best worn item). Placeholder look until the
 * real art exists: a glow on the ground, and sparks rising from the higher tiers.
 */
/** World size of the crater a dead player lies in (the player is about 1.9 units tall). */
const CRATER_SIZE = 3.2;
/**
 * The lying body in the last death frame stands about 1 unit above the feet line on its billboard, which the
 * camera shows over the ground about this far behind the player, so the crater moves back to sit under it.
 */
const CRATER_BACK = 1.4;

const AURA: { color: string; size: number; sparks: number }[] = [
  { color: '', size: 0, sparks: 0 },
  { color: '#6fb8ff', size: 1.5, sparks: 0 },
  { color: '#c56dff', size: 1.9, sparks: 3 },
  { color: '#ff9a2e', size: 2.3, sparks: 6 },
  { color: '#ffd34a', size: 2.7, sparks: 12 },
];

/** Move speed (units/s) at which the run cycle plays as drawn; slower or faster scales it, within MIN–MAX. */
const STRIDE_SPEED = 5;
const STRIDE_MIN = 0.6;
const STRIDE_MAX = 1.6;

export class PlayerView {
  readonly actor: Actor;
  private aura: THREE.Mesh | null = null;
  /** One orb per worn item at +7 or higher (on top of the aura). */
  private readonly orbs: OrbRing;
  private auraTier = 0;
  private clock = 0;
  private combo = 0;
  private lastAttackAt = -99;
  private crater: THREE.Mesh | null = null;
  /** Ground speed actually seen on screen (smoothed), and where the player was last frame. */
  private seenSpeed = 0;
  private lastX = NaN;
  private lastZ = NaN;

  constructor(readonly p: Player, private readonly scene: THREE.Scene) {
    const anim = animSets[p.cls.id];
    this.actor = anim ? new AnimatedActor(anim, 0.4) : new SpriteActor(sheets[p.cls.id], 1.9, 0.4);
    scene.add(this.actor.group);
    this.orbs = new OrbRing(scene, p.id * 3.7);
    this.sync();
    // Came into view (or logged in) while already lying dead: no fall, just the body in its crater.
    if (!p.alive) this.showDead(true);
  }

  update(dt: number, fx: Effects): void {
    const p = this.p;
    this.clock += dt;
    this.actor.face(p.faceX, p.faceZ);
    if (p.isDashing && Math.random() < 0.7) fx.puff(p.x, 0.9, p.z, p.dashKind === 'charge' ? '#ffcf7a' : '#cfe8ff', 0.25, 1.1);
    this.matchStride(dt);
    this.actor.update(dt, p.moving, p.isDashing ? 14 : undefined);
    this.updateAura(dt, fx);
    // Owner 2026-11-10: the orbs stay while dead (only the aura goes).
    this.orbs.update(this.clock, p.x, p.z, p.orbs, true);
    this.sync();
  }

  /**
   * Plays the run cycle as fast as the player really moves, so each step covers the same ground: slow at
   * the start (few long steps instead of many short ones), quicker with move speed, slowed or iced alike.
   */
  private matchStride(dt: number): void {
    const p = this.p;
    if (dt > 0 && Number.isFinite(this.lastX)) {
      const v = Math.hypot(p.x - this.lastX, p.z - this.lastZ) / dt;
      // Snapshots arrive in steps: smooth over ~0.25 s, and ignore teleports (zone change, respawn).
      if (v < 40) this.seenSpeed += (v - this.seenSpeed) * Math.min(1, dt * 4);
    }
    this.lastX = p.x;
    this.lastZ = p.z;
    if (this.actor instanceof AnimatedActor) {
      this.actor.setStride(Math.min(STRIDE_MAX, Math.max(STRIDE_MIN, this.seenSpeed / STRIDE_SPEED)));
    }
  }

  private updateAura(dt: number, fx: Effects): void {
    const p = this.p;
    const tier = p.alive ? Math.max(0, Math.min(AURA.length - 1, p.aura)) : 0;
    if (tier !== this.auraTier) {
      this.auraTier = tier;
      this.disposeAura();
      if (tier > 0) {
        const mat = new THREE.MeshBasicMaterial({
          map: fxTex.glow, color: AURA[tier].color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7,
        });
        this.aura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        this.aura.rotation.x = -Math.PI / 2;
        this.aura.renderOrder = -1;
        this.scene.add(this.aura);
      }
    }
    if (!this.aura) return;
    const a = AURA[tier];
    const pulse = 1 + Math.sin(this.clock * 3) * 0.08;
    this.aura.position.set(p.x, 0.06, p.z);
    this.aura.scale.set(a.size * pulse, a.size * pulse, 1);
    if (a.sparks && Math.random() < a.sparks * dt) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * a.size * 0.35;
      fx.puff(p.x + Math.cos(ang) * r, 0.2, p.z + Math.sin(ang) * r, a.color, 0.9, 0.35);
    }
  }

  private disposeAura(): void {
    if (!this.aura) return;
    this.scene.remove(this.aura);
    this.aura.geometry.dispose();
    (this.aura.material as THREE.Material).dispose();
    this.aura = null;
  }

  private sync(): void {
    this.actor.group.position.x = this.p.x;
    this.actor.group.position.z = this.p.z;
  }

  /** Cycles attack → attack_2 → attack_3 while hits keep coming within a second. */
  private playAttack(duration?: number): void {
    const names = ['attack', 'attack_2', 'attack_3'].filter((n) => this.actor.has(n));
    if (!names.length) return;
    this.combo = this.clock - this.lastAttackAt < 1 ? (this.combo + 1) % names.length : 0;
    this.lastAttackAt = this.clock;
    this.actor.play(names[this.combo], { duration });
  }

  onAnim(ev: AnimEvent): void {
    if (ev.name === 'attack') this.playAttack(ev.duration);
    else if (ev.fallback === 'attack') {
      // A dedicated skill animation wins over the dash animation a movement skill just started.
      if (this.actor.has(ev.name)) {
        this.actor.reset();
        this.actor.play(ev.name);
      } else if (!this.p.isDashing) this.playAttack(ev.duration);
    } else this.actor.play(ev.name, { duration: ev.duration });
  }

  onDied(): void {
    this.showDead(false);
  }

  private showDead(atEnd: boolean): void {
    this.actor.reset();
    if (!this.actor.play('death', { hold: true, atEnd })) {
      this.actor.setOpacity(0.4);
      return;
    }
    // Only with the death animation: a fading stand-in standing in a crater would look odd.
    const tex = decalTex.deathCrater;
    if (!tex || this.crater) return;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    this.crater = new THREE.Mesh(new THREE.PlaneGeometry(CRATER_SIZE, CRATER_SIZE).rotateX(-Math.PI / 2), mat);
    // Away from the camera (it looks from +x +z, see ISO_DIR).
    this.crater.position.set(this.p.x - CRATER_BACK * Math.SQRT1_2, 0.03, this.p.z - CRATER_BACK * Math.SQRT1_2);
    this.crater.renderOrder = -1;
    this.scene.add(this.crater);
  }

  private disposeCrater(): void {
    if (!this.crater) return;
    this.scene.remove(this.crater);
    this.crater.geometry.dispose();
    (this.crater.material as THREE.Material).dispose();
    this.crater = null;
  }

  onRevived(): void {
    this.disposeCrater();
    this.actor.reset();
    this.actor.setOpacity(1);
    this.actor.play('revive');
    this.sync();
  }

  dispose(): void {
    this.disposeAura();
    this.orbs.dispose();
    this.disposeCrater();
    this.scene.remove(this.actor.group);
    this.actor.dispose();
  }
}

export class MonsterView {
  readonly actor: SpriteActor;

  constructor(readonly m: Monster, private readonly scene: THREE.Scene) {
    this.actor = new SpriteActor(sheets[m.def.id], m.def.height, m.def.radius * 1.1);
    this.actor.face(m.faceX, m.faceZ);
    scene.add(this.actor.group);
    this.update(0);
  }

  update(dt: number): void {
    const m = this.m;
    const g = this.actor.group;
    g.position.x = m.x;
    g.position.z = m.z;
    this.actor.setLift(m.lift);
    if (!m.alive) {
      this.actor.setOpacity(Math.max(0, 1 - m.deadT / 0.8));
      g.position.y = -m.deadT * 0.25;
      return;
    }
    this.actor.face(m.faceX, m.faceZ);
    this.actor.update(dt, m.moving, m.state === 'idle' ? 6 : 10);
  }

  dispose(): void {
    this.scene.remove(this.actor.group);
    this.actor.dispose();
  }
}

/** A monster's shot, drawn from its own picture and pointing the way it flies (the picture points right). */
function enemyShotSprite(art: string, size: number): THREE.Sprite {
  const sheet = sheets[`fx_${art}`];
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sheet.texture, alphaTest: 0.5, transparent: false }));
  s.scale.set(size * sheet.cellAspect, size, 1);
  return s;
}

export class ProjectileView {
  private readonly sprite: THREE.Sprite;
  private readonly shot: ShotSprite | null;
  private readonly art: boolean;
  private lastX: number;
  private lastZ: number;

  constructor(readonly pr: ProjectileLike, private readonly scene: THREE.Scene, private readonly fx: Effects) {
    this.art = !!pr.o.art;
    this.shot = pr.o.art ? null : fx.shotSprite(pr.o.color, pr.o.size);
    this.sprite = pr.o.art ? enemyShotSprite(pr.o.art, pr.o.size) : this.shot?.sprite ?? fx.glowSprite(pr.o.color, pr.o.size);
    this.lastX = pr.x;
    this.lastZ = pr.z;
    scene.add(this.sprite);
    this.update();
  }

  update(): void {
    const pr = this.pr;
    this.sprite.position.set(pr.x, 0.85, pr.z);
    if (this.art) {
      const dx = pr.x - this.lastX;
      const dz = pr.z - this.lastZ;
      // Screen right is +x −z with this camera, and screen up is −x −z.
      if (dx || dz) this.sprite.material.rotation = Math.atan2(-(dx + dz) * 0.7, dx - dz);
      this.lastX = pr.x;
      this.lastZ = pr.z;
    } else if (this.shot) {
      // Works out its heading from how it moved, so local and online shots behave the same.
      this.shot.update(1 / 60, pr.x - this.lastX, pr.z - this.lastZ);
      this.lastX = pr.x;
      this.lastZ = pr.z;
    } else if (Math.random() < 0.5) {
      this.fx.puff(pr.x, 0.85, pr.z, pr.o.color, 0.18, pr.o.size * 0.6);
    }
  }

  dispose(): void {
    this.scene.remove(this.sprite);
    if (this.shot) this.shot.dispose();
    else this.sprite.material.dispose();
  }
}

const GLOW: Record<string, string> = { uncommon: '#62d862', rare: '#4fa0ff', epic: '#c56dff', legendary: '#ff9a2e' };

export class LootView {
  private readonly sprite: THREE.Sprite;
  private readonly glow: THREE.Sprite | null = null;

  constructor(readonly l: Loot, private readonly scene: THREE.Scene, fx: Effects) {
    const k = l.kind;
    const key = k.type === 'gold' ? 'icon_coin'
      : k.type === 'potion' ? `icon_potion_${k.pot}`
      : k.type === 'stone' ? `icon_stone_${k.stone}`
      : itemArt(k.item);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sheets[key].texture, alphaTest: 0.5, transparent: true }));
    const size = k.type === 'item' ? 0.85 : 0.55;
    this.sprite.scale.set(size, size, 1);
    // Drawn after the glow, so the rarity light sits behind the picture instead of washing it out.
    this.sprite.renderOrder = 2;
    scene.add(this.sprite);
    if (k.type === 'stone') {
      this.glow = fx.glowSprite(STONE_COLOR[k.stone], 1.5, 0.55);
      scene.add(this.glow);
    } else if (k.type === 'item' && k.item.rarity !== 'common') {
      this.glow = fx.glowSprite(GLOW[k.item.rarity], 1.5, 0.55);
      scene.add(this.glow);
    }
    this.update();
  }

  update(): void {
    const l = this.l;
    const k = Math.min(1, l.t / LOOT_POP_TIME);
    const px = l.fromX + (l.x - l.fromX) * k;
    const pz = l.fromZ + (l.z - l.fromZ) * k;
    const y = k < 1 ? 0.3 + Math.sin(k * Math.PI) * 1.2 : 0.3 + Math.sin(l.t * 3) * 0.06;
    this.sprite.position.set(px, y, pz);
    this.glow?.position.set(px, 0.3, pz);
    // Blink during the last 5 seconds.
    const blink = l.t > l.life - 5 && Math.floor(l.t * 6) % 2 === 0;
    this.sprite.visible = !blink;
    if (this.glow) this.glow.visible = !blink;
  }

  dispose(): void {
    this.scene.remove(this.sprite);
    this.sprite.material.dispose();
    if (this.glow) {
      this.scene.remove(this.glow);
      this.glow.material.dispose();
    }
  }
}

/** Keeps one view per entity in sync with a list that the simulation adds to and removes from. */
export class ViewSet<E, V extends { dispose(): void }> {
  private readonly views = new Map<E, V>();

  constructor(private readonly make: (e: E) => V) {}

  sync(list: readonly E[], each?: (v: V) => void): void {
    const alive = new Set(list);
    for (const [e, v] of this.views) {
      if (!alive.has(e)) {
        v.dispose();
        this.views.delete(e);
      }
    }
    for (const e of list) {
      let v = this.views.get(e);
      if (!v) {
        v = this.make(e);
        this.views.set(e, v);
      }
      each?.(v);
    }
  }

  get(e: E): V | undefined {
    return this.views.get(e);
  }

  values(): IterableIterator<V> {
    return this.views.values();
  }
}
