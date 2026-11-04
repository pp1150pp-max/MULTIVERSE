import type { Sim } from './Sim';
import type { Player } from './Player';
import type { Item, PotionKind, PotionSize } from '../types';

export type LootKind =
  | { type: 'gold'; amount: number }
  | { type: 'item'; item: Item }
  /** `count` > 1 when a player throws a whole stack on the ground. */
  | { type: 'potion'; pot: PotionKind; size: PotionSize; count: number };

/** Seconds of the pop-out arc when loot drops; it can't be picked up before it lands. */
export const LOOT_POP_TIME = 0.35;
/** Items the player throws on the ground vanish after this many seconds. */
export const DROPPED_LIFE = 60;
/** Monster drops nobody picks up vanish after this many seconds, so they don't pile up on the server. */
export const DROP_LIFE = 30;
/** The player who did the most damage may pick up a monster's drops alone for this long. */
export const LOOT_PRIORITY_TIME = 10;

export class Loot {
  dead = false;
  /** Seconds since it dropped (the renderer uses it for the pop arc and blinking). */
  t = 0;
  /** Thrown away by a player: auto play ignores it, and it can't be picked up until that player steps away. */
  readonly dropped: boolean;
  private armed: boolean;
  private blockedMsgT = 0;
  /** Player id with pickup priority until `ownerUntil` (simulation time), or null for anyone. */
  owner: number | null;
  ownerUntil: number;

  constructor(
    readonly id: number,
    public x: number,
    public z: number,
    readonly fromX: number,
    readonly fromZ: number,
    readonly kind: LootKind,
    opts: { dropped?: boolean; owner?: number; ownerUntil?: number } = {},
  ) {
    this.dropped = !!opts.dropped;
    this.armed = !this.dropped;
    this.owner = opts.owner ?? null;
    this.ownerUntil = opts.ownerUntil ?? 0;
  }

  /** Seconds it stays on the ground before vanishing. */
  get life(): number {
    return this.dropped ? DROPPED_LIFE : DROP_LIFE;
  }

  /** Whether this player may pick it up right now. */
  canTake(playerId: number, time: number): boolean {
    return this.owner === null || this.owner === playerId || time >= this.ownerUntil;
  }

  update(dt: number, sim: Sim): void {
    this.t += dt;
    this.blockedMsgT -= dt;
    if (this.t > this.life) {
      this.dead = true;
      return;
    }
    if (this.t <= LOOT_POP_TIME + 0.15) return;

    // Goes to the nearest player with room for it; a full bag neither pulls it in nor blocks others.
    let p: Player | null = null;
    let d = Infinity;
    let full: Player | null = null;
    let fd = Infinity;
    for (const pl of sim.players) {
      if (!pl.alive || !this.canTake(pl.id, sim.time) || !pl.wantsLoot(this.kind, this.dropped)) continue;
      const pd = Math.hypot(pl.x - this.x, pl.z - this.z);
      if (!pl.canFit(this.kind)) {
        if (pd < fd) {
          fd = pd;
          full = pl;
        }
      } else if (pd < d) {
        d = pd;
        p = pl;
      }
    }
    if (!this.armed) {
      if (Math.min(d, fd) > 1.6) this.armed = true;
      return;
    }
    if (full && fd < 0.8 && fd < d && this.blockedMsgT <= 0) {
      sim.text(full.x, full.topY, full.z, 'กระเป๋าเต็ม', 'info', undefined, full.id);
      this.blockedMsgT = 2;
    }
    if (!p) return;
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
