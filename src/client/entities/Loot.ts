import * as THREE from 'three';
import type { Game } from '../Game';
import { sheets } from '../assets';
import type { Item } from '../../shared/types';

export type LootKind =
  | { type: 'gold'; amount: number }
  | { type: 'item'; item: Item }
  | { type: 'potion'; pot: 'hp' | 'mp' };

const POP_TIME = 0.35;
/** Items the player throws on the ground vanish after this many seconds. */
export const DROPPED_LIFE = 60;

export class Loot {
  dead = false;
  private t = 0;
  private readonly sprite: THREE.Sprite;
  private glow: THREE.Sprite | null = null;
  private blockedMsgT = 0;
  /** Thrown away by the player: auto play ignores it, and it can't be picked up until the player steps away. */
  readonly dropped: boolean;
  private armed: boolean;

  constructor(
    private readonly g: Game,
    public x: number,
    public z: number,
    private readonly fromX: number,
    private readonly fromZ: number,
    readonly kind: LootKind,
    opts: { dropped?: boolean } = {},
  ) {
    this.dropped = !!opts.dropped;
    this.armed = !this.dropped;
    const key = kind.type === 'gold' ? 'icon_coin'
      : kind.type === 'potion' ? `icon_potion_${kind.pot}`
      : `icon_bag_${kind.item.rarity}`;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sheets[key].texture, alphaTest: 0.5, transparent: false }));
    this.sprite.scale.set(0.55, 0.55, 1);
    g.scene.add(this.sprite);
    if (kind.type === 'item' && kind.item.rarity !== 'common') {
      const colors = { uncommon: '#62d862', rare: '#4fa0ff', epic: '#c56dff', legendary: '#ff9a2e' };
      this.glow = g.fx.glowSprite(colors[kind.item.rarity], 1.4, 0.7);
      g.scene.add(this.glow);
    }
    this.place();
  }

  private place(): void {
    const k = Math.min(1, this.t / POP_TIME);
    const px = this.fromX + (this.x - this.fromX) * k;
    const pz = this.fromZ + (this.z - this.fromZ) * k;
    const y = k < 1 ? 0.3 + Math.sin(k * Math.PI) * 1.2 : 0.3 + Math.sin(this.t * 3) * 0.06;
    this.sprite.position.set(px, y, pz);
    this.glow?.position.set(px, 0.3, pz);
  }

  update(dt: number): void {
    const g = this.g;
    const p = g.player;
    this.t += dt;
    this.blockedMsgT -= dt;
    if (this.dropped) {
      if (this.t > DROPPED_LIFE) {
        this.remove();
        return;
      }
      // Blink during the last 5 seconds.
      const blink = this.t > DROPPED_LIFE - 5 && Math.floor(this.t * 6) % 2 === 0;
      this.sprite.visible = !blink;
      if (this.glow) this.glow.visible = !blink;
    }
    if (this.t > POP_TIME + 0.15 && p.alive) {
      const dx = p.x - this.x;
      const dz = p.z - this.z;
      const d = Math.hypot(dx, dz);
      if (!this.armed) {
        if (d > 1.6) this.armed = true;
        this.place();
        return;
      }
      const magnet = this.kind.type === 'item' ? 0 : 2.5;
      if (d < magnet && d > 0.01) {
        const step = Math.min(d, 10 * dt);
        this.x += (dx / d) * step;
        this.z += (dz / d) * step;
      }
      if (d < 0.8) {
        if (g.pickup(this)) this.remove();
        else if (this.blockedMsgT <= 0) {
          g.floating.text(p.x, p.topY, p.z, 'กระเป๋าเต็ม', 'info');
          this.blockedMsgT = 2;
        }
      }
    }
    this.place();
  }

  remove(): void {
    this.dead = true;
    this.g.scene.remove(this.sprite);
    this.sprite.material.dispose();
    if (this.glow) {
      this.g.scene.remove(this.glow);
      this.glow.material.dispose();
    }
  }
}
