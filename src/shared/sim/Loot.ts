import type { Sim } from './Sim';
import type { Player } from './Player';
import type { Item } from '../types';

export type LootKind =
  | { type: 'gold'; amount: number }
  | { type: 'item'; item: Item }
  | { type: 'potion'; pot: 'hp' | 'mp' };

/** Seconds of the pop-out arc when loot drops; it can't be picked up before it lands. */
export const LOOT_POP_TIME = 0.35;
/** Items the player throws on the ground vanish after this many seconds. */
export const DROPPED_LIFE = 60;

export class Loot {
  dead = false;
  /** Seconds since it dropped (the renderer uses it for the pop arc and blinking). */
  t = 0;
  /** Thrown away by a player: auto play ignores it, and it can't be picked up until that player steps away. */
  readonly dropped: boolean;
  private armed: boolean;
  private blockedMsgT = 0;

  constructor(
    readonly id: number,
    public x: number,
    public z: number,
    readonly fromX: number,
    readonly fromZ: number,
    readonly kind: LootKind,
    opts: { dropped?: boolean } = {},
  ) {
    this.dropped = !!opts.dropped;
    this.armed = !this.dropped;
  }

  update(dt: number, sim: Sim): void {
    this.t += dt;
    this.blockedMsgT -= dt;
    if (this.dropped && this.t > DROPPED_LIFE) {
      this.dead = true;
      return;
    }
    if (this.t <= LOOT_POP_TIME + 0.15) return;

    let p: Player | null = null;
    let d = Infinity;
    for (const pl of sim.players) {
      if (!pl.alive) continue;
      const pd = Math.hypot(pl.x - this.x, pl.z - this.z);
      if (pd < d) {
        d = pd;
        p = pl;
      }
    }
    if (!p) return;
    if (!this.armed) {
      if (d > 1.6) this.armed = true;
      return;
    }
    const magnet = this.kind.type === 'item' ? 0 : 2.5;
    if (d < magnet && d > 0.01) {
      const step = Math.min(d, 10 * dt);
      this.x += ((p.x - this.x) / d) * step;
      this.z += ((p.z - this.z) / d) * step;
    }
    if (d < 0.8) {
      if (sim.pickup(p, this)) this.dead = true;
      else if (this.blockedMsgT <= 0) {
        sim.text(p.x, p.topY, p.z, 'กระเป๋าเต็ม', 'info', undefined, p.id);
        this.blockedMsgT = 2;
      }
    }
  }
}
