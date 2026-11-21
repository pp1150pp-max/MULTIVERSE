// The game camera's projection, shared by the game (src/client/world.ts) and the /admin map editor so both draw the same view.
// Plain numbers only: this folder may not import `three`. The game builds its THREE vectors from these tuples, so its values
// are unchanged. The camera sits along ISO_RAW from its target and looks at it (orthographic): 45° yaw, ~47° pitch.

export type Vec3 = readonly [number, number, number];

/** The direction from the target to the camera, NOT normalised (the game normalises it itself). */
export const ISO_RAW: Vec3 = [1, 1.45, 1];
const len = Math.hypot(ISO_RAW[0], ISO_RAW[1], ISO_RAW[2]);
/** ISO_RAW normalised. */
export const ISO: Vec3 = [ISO_RAW[0] / len, ISO_RAW[1] / len, ISO_RAW[2] / len];
/** The camera's right on the ground (to the right of the screen). */
export const CAM_RIGHT_RAW: Vec3 = [Math.SQRT1_2, 0, -Math.SQRT1_2];
/** The camera's up: cross(right, -ISO), normalised. */
export const CAM_UP_RAW: Vec3 = (() => {
  const r = CAM_RIGHT_RAW, d = [-ISO[0], -ISO[1], -ISO[2]];
  const c = [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]];
  const l = Math.hypot(c[0], c[1], c[2]);
  return [c[0] / l, c[1] / l, c[2] / l] as unknown as Vec3;
})();

/** Town pieces whose picture stands on its bottom edge (anchor y 0) instead of sunk 3% into the ground. */
export const TOWN2_PROP_RE = /^(bld_|town_fountain$|quest_board$|crystal_stall$|lamp_post$|bench_|planter$|banner_pole$|crates$|barrels$|flower_box$|potted_tree$|low_stall_|garden_bed$|hedge_|house_back_|woodpile$|town_statue$|row_|mk_|ml_|mr_|b3_)/;
/** Sprite anchor, from the bottom edge up, as a fraction of the picture's height. */
export const spriteAnchorY = (key: string): number => (TOWN2_PROP_RE.test(key) ? 0 : 0.03);

/** World point on the ground (x, 0, z) → camera plane: sx to the right, sy UP (both in world units). */
export function groundToCam(x: number, z: number, y = 0): [number, number] {
  return [x * CAM_RIGHT_RAW[0] + z * CAM_RIGHT_RAW[2], x * CAM_UP_RAW[0] + y * CAM_UP_RAW[1] + z * CAM_UP_RAW[2]];
}

/** Camera plane (sx right, sy up) → the ground point (y = 0) that lands there. */
export function camToGround(sx: number, sy: number): [number, number] {
  // sx = rx·x + rz·z ; sy = ux·x + uz·z  → solve the 2×2.
  const a = CAM_RIGHT_RAW[0], b = CAM_RIGHT_RAW[2], c = CAM_UP_RAW[0], d = CAM_UP_RAW[2];
  const det = a * d - b * c;
  return [(sx * d - b * sy) / det, (a * sy - c * sx) / det];
}

/** Larger = nearer the camera = drawn later. */
export const depthOf = (x: number, z: number): number => x * ISO[0] + z * ISO[2];
