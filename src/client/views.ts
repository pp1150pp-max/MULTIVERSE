// Sprites for simulation entities. Each view reads its entity every frame; the simulation never
// touches Three.js, so the same entities can come from a local Sim or (later) the server.
import * as THREE from 'three';
import type { Player } from '../shared/sim/Player';
import type { Monster } from '../shared/sim/Monster';
import { DROPPED_LIFE, LOOT_POP_TIME, type Loot } from '../shared/sim/Loot';
import type { SimEvent } from '../shared/sim/types';
import { SpriteActor } from './SpriteActor';
import { AnimatedActor, type Actor } from './AnimatedActor';
import { animSets, sheets } from './assets';
import type { Effects } from './effects';
import type { ProjectileLike } from './backend';

type AnimEvent = Extract<SimEvent, { t: 'anim' }>;

export class PlayerView {
  readonly actor: Actor;
  private clock = 0;
  private combo = 0;
  private lastAttackAt = -99;

  constructor(readonly p: Player, private readonly scene: THREE.Scene) {
    const anim = animSets[p.cls.id];
    this.actor = anim ? new AnimatedActor(anim, 0.4) : new SpriteActor(sheets[p.cls.id], 1.9, 0.4);
    scene.add(this.actor.group);
    this.sync();
  }

  update(dt: number, fx: Effects): void {
    const p = this.p;
    this.clock += dt;
    this.actor.face(p.faceX, p.faceZ);
    if (p.isDashing && Math.random() < 0.7) fx.puff(p.x, 0.9, p.z, p.dashKind === 'charge' ? '#ffcf7a' : '#cfe8ff', 0.25, 1.1);
    this.actor.update(dt, p.moving, p.isDashing ? 14 : undefined);
    this.sync();
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
    if (!this.actor.play('death', { hold: true })) this.actor.setOpacity(0.4);
  }

  onRevived(): void {
    this.actor.reset();
    this.actor.setOpacity(1);
    this.actor.play('revive');
    this.sync();
  }

  dispose(): void {
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

export class ProjectileView {
  private readonly sprite: THREE.Sprite;

  constructor(readonly pr: ProjectileLike, private readonly scene: THREE.Scene, private readonly fx: Effects) {
    this.sprite = fx.glowSprite(pr.o.color, pr.o.size);
    scene.add(this.sprite);
    this.update();
  }

  update(): void {
    const pr = this.pr;
    this.sprite.position.set(pr.x, 0.85, pr.z);
    if (Math.random() < 0.5) this.fx.puff(pr.x, 0.85, pr.z, pr.o.color, 0.18, pr.o.size * 0.6);
  }

  dispose(): void {
    this.scene.remove(this.sprite);
    this.sprite.material.dispose();
  }
}

const GLOW: Record<string, string> = { uncommon: '#62d862', rare: '#4fa0ff', epic: '#c56dff', legendary: '#ff9a2e' };

export class LootView {
  private readonly sprite: THREE.Sprite;
  private readonly glow: THREE.Sprite | null = null;

  constructor(readonly l: Loot, private readonly scene: THREE.Scene, fx: Effects) {
    const k = l.kind;
    const key = k.type === 'gold' ? 'icon_coin' : k.type === 'potion' ? `icon_potion_${k.pot}` : `icon_bag_${k.item.rarity}`;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sheets[key].texture, alphaTest: 0.5, transparent: false }));
    this.sprite.scale.set(0.55, 0.55, 1);
    scene.add(this.sprite);
    if (k.type === 'item' && k.item.rarity !== 'common') {
      this.glow = fx.glowSprite(GLOW[k.item.rarity], 1.4, 0.7);
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
    if (l.dropped) {
      // Blink during the last 5 seconds.
      const blink = l.t > DROPPED_LIFE - 5 && Math.floor(l.t * 6) % 2 === 0;
      this.sprite.visible = !blink;
      if (this.glow) this.glow.visible = !blink;
    }
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
