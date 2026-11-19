// Floor 2's town, the Dimensional Harbour (docs/plans/FLOOR2_PLAN.md 3, art_templates/papercraft_maps/FLOOR2_HUB.md):
// wooden plank platforms standing in the cloud sea, joined by bridges, with a long pier out to each corner. Players
// walk only on the planks (owner 2026-11-19); the water between is shut off by a chain of colliders along every
// platform edge (Terrain.placeHarbor), so walking, click-walk and the server's walk all keep working as they are.
// Shared, so the server and the browser lay out the same town.

export const HARBOR_ID = 'harbor_town';

/** A walkable platform: a convex polygon of world (x, z) points. */
export type Deck = [number, number][];

/** Half the size of the square main platform the plaza and the shops stand on. */
export const HARBOR_MAIN = 16;
/** The round plaza in the middle of the main platform, around the ship's-wheel fountain. */
export const HARBOR_PLAZA_RADIUS = 8.5;
/** How far out each pier's portal stands on each axis (the four corners, like nexus_city's). */
export const HARBOR_PIER = 46;
/** Half the width of a pier, and half the size of its end platform. */
const PIER_HALF = 3;
const PIER_END = 4.5;

const square = (cx: number, cz: number, h: number): Deck => [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]];

/** A straight strip from a to b, `half` wide either side of the line. */
function strip(ax: number, az: number, bx: number, bz: number, half: number): Deck {
  const len = Math.hypot(bx - ax, bz - az);
  const nx = (-(bz - az) / len) * half;
  const nz = ((bx - ax) / len) * half;
  return [[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]];
}

/** The four corners in nexus_city's order (ZoneDef.quadrants): top, right, left, bottom of the screen. */
export const HARBOR_CORNERS: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

/** The side platforms: [centre x, centre z, half size]. The lighthouse's is up-right on screen (−z). */
export const HARBOR_LIGHTHOUSE: [number, number, number] = [0, -32, 8];
export const HARBOR_SHIPYARD: [number, number, number] = [32, 0, 8];
export const HARBOR_GARDEN: [number, number, number] = [-30, 0, 6];
export const HARBOR_BOATS: [number, number, number] = [0, 30, 6];

/** Every platform, pier and bridge. Edges that lie inside another one are open (Terrain.placeHarbor). */
export const HARBOR_DECKS: Deck[] = [
  square(0, 0, HARBOR_MAIN),
  ...HARBOR_CORNERS.flatMap(([sx, sz]) => [
    strip(sx * (HARBOR_MAIN - 2), sz * (HARBOR_MAIN - 2), sx * (HARBOR_PIER - 2), sz * (HARBOR_PIER - 2), PIER_HALF),
    square(sx * HARBOR_PIER, sz * HARBOR_PIER, PIER_END),
  ]),
  ...[HARBOR_LIGHTHOUSE, HARBOR_SHIPYARD, HARBOR_GARDEN, HARBOR_BOATS].flatMap(([cx, cz, h]) => [
    square(cx, cz, h),
    // A bridge from the main platform's edge into the side platform.
    strip(Math.sign(cx) * (HARBOR_MAIN - 1), Math.sign(cz) * (HARBOR_MAIN - 1), cx - Math.sign(cx) * (h - 1), cz - Math.sign(cz) * (h - 1), 2),
  ]),
];

/** Whether (x, z) is on a platform, at least `margin` in from its edge. */
export function onDeck(x: number, z: number, margin = 0): boolean {
  return HARBOR_DECKS.some((d) => insideDeck(d, x, z, margin));
}

/** Inside one convex polygon (either winding), at least `margin` from every edge. */
export function insideDeck(d: Deck, x: number, z: number, margin = 0): boolean {
  let sign = 0;
  for (let i = 0; i < d.length; i++) {
    const [ax, az] = d[i];
    const [bx, bz] = d[(i + 1) % d.length];
    const len = Math.hypot(bx - ax, bz - az);
    const cross = ((bx - ax) * (z - az) - (bz - az) * (x - ax)) / len;
    if (sign === 0) sign = Math.sign(cross) || 1;
    if (cross * sign < margin) return false;
  }
  return true;
}

/** Where the way back to floor 1 stands: on the lighthouse platform, beside the lighthouse. */
export const HARBOR_RETURN = { x: HARBOR_LIGHTHOUSE[0] + 4, z: HARBOR_LIGHTHOUSE[1] - 3 };
