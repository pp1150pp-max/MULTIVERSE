import type { Player } from '../shared/sim/Player';
import type { Terrain } from '../shared/sim/terrain';
import type { Vec2 } from '../shared/types';

/** A walk-to point is given up when the character has moved less than this in WALK_GIVE_UP seconds (pressed into a corner). */
const WALK_MIN_MOVE = 0.1;
const WALK_GIVE_UP = 0.8;

/**
 * Our character's click-to-walk point: never inside an NPC, the forge or a tree (walks up beside
 * it instead), and dropped when the character is stuck, so it doesn't keep pushing into a corner.
 */
export class WalkTarget {
  private anchor: Vec2 = { x: 0, z: 0 };
  private stuckT = 0;

  /** Before the step: takes this frame's walk-to point, if any. */
  aim(p: Player, to: Vec2 | null, terrain: Terrain): void {
    if (!to) return;
    const spot = terrain.standSpot(to.x, to.z, p.radius, p) ?? to;
    const old = p.moveTarget;
    if (!old || Math.hypot(old.x - spot.x, old.z - spot.z) > 0.5) this.restart(p);
    p.moveTarget = { x: spot.x, z: spot.z };
  }

  /** After the step: drops the point once the character has hardly moved for a while. */
  check(p: Player, dt: number): void {
    if (!p.moveTarget) return;
    if (Math.hypot(p.x - this.anchor.x, p.z - this.anchor.z) > WALK_MIN_MOVE) this.restart(p);
    else if ((this.stuckT += dt) > WALK_GIVE_UP) p.moveTarget = null;
  }

  private restart(p: Player): void {
    this.anchor = { x: p.x, z: p.z };
    this.stuckT = 0;
  }
}
