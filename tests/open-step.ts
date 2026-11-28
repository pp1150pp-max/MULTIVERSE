// Where cosmetics-server steps to: a spot a straight `dist` away that the character really ends up on.
import type { Terrain } from '../src/shared/sim/terrain';

/** A player's collision radius (Player.radius). */
export const PLAYER_RADIUS = 0.4;

/**
 * The server accepts a walked-to position whose middle is open, then Player.tick pushes the body (radius 0.4) out of whatever
 * it overlaps there (Terrain.resolve), up to 0.4 away. So the spot must be clear for the whole body, or the character lands
 * somewhere else than asked (the "riding: a 3.2 step" check failed on the spawn spots where that happened).
 */
export function openStep(terrain: Terrain, from: { x: number; z: number }, dist: number): { x: number; z: number } {
  for (let a = 0; a < 16; a++) {
    const x = from.x + Math.cos((a * Math.PI) / 8) * dist;
    const z = from.z + Math.sin((a * Math.PI) / 8) * dist;
    if (!terrain.isBlocked(x, z, PLAYER_RADIUS)) return { x, z };
  }
  throw new Error('no open spot to step to');
}
