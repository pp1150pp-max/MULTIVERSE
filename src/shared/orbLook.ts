// How the enhancement orbs look (palette, shape, sizes, motion). Pure data and checks, no rendering:
// the server keeps one server-wide look (settings table, changed by the owner on /admin) and sends it
// to every browser, which draws the orbs with it (src/client/orbs.ts).
//
// Built so a per-player look can come later: an OrbLook is a complete set of values, so a player's own
// choice could be stored the same way and sent instead of the server-wide one.

/** Palette ids (the names and colors are in src/client/orbs.ts, ORB_PALETTES). */
export const ORB_PALETTE_IDS = ['arcane', 'holy', 'fire', 'ice', 'nature', 'void', 'blood', 'ocean', 'moon', 'toxic', 'prism', 'slot', 'tier'] as const;
export type OrbPaletteId = (typeof ORB_PALETTE_IDS)[number];

/** Orb shapes (rows of the orb picture, src/client/orbs.ts ORB_SHAPES). */
export const ORB_SHAPE_IDS = ['sphere', 'crystal', 'flame', 'star'] as const;
export type OrbShapeId = (typeof ORB_SHAPE_IDS)[number];

export interface OrbLook {
  palette: OrbPaletteId;
  shape: OrbShapeId;
  /** Multiplies every orb, halo and spark size. */
  scale: number;
  /** Orbit radius around the character's feet. */
  radius: number;
  /** Turns per second of the whole ring. */
  speed: number;
  /** Moves the whole ring up (+) or down (−). */
  height: number;
  /** How far each orb floats up and down, and how fast (× its own rate). */
  bob: number;
  bobSpeed: number;
  /** How much each orb sways ahead/behind its place (× the default; 0 = a rigid wheel). */
  sway: number;
  /** Halo size and brightness (×). */
  glow: number;
  glowAlpha: number;
  /** Sparks and trail dots (× the level table). */
  particles: number;
  trail: number;
  /** true = soft round halo; false = the stepped pixel halo. */
  softGlow: boolean;
}

export type OrbLookNumber = Exclude<keyof OrbLook, 'palette' | 'shape' | 'softGlow'>;

/** Allowed range of each number (the admin sliders use the same ranges). */
export const ORB_LOOK_RANGES: Record<OrbLookNumber, [min: number, max: number]> = {
  scale: [0.5, 2.5],
  radius: [0.6, 1.6],
  speed: [0.05, 0.6],
  height: [-0.6, 0.8],
  bob: [0, 0.4],
  bobSpeed: [0.2, 3],
  sway: [0, 2],
  glow: [0.3, 2.5],
  glowAlpha: [0.2, 2],
  particles: [0, 2],
  trail: [0, 2],
};

/** The look until the owner saves another one (owner's pick 2026-11-10). */
export const DEFAULT_ORB_LOOK: Readonly<OrbLook> = {
  palette: 'arcane',
  shape: 'sphere',
  scale: 0.8,
  radius: 0.95,
  speed: 0.17,
  height: 0,
  bob: 0.09,
  bobSpeed: 1,
  sway: 1,
  glow: 1,
  glowAlpha: 1,
  particles: 1,
  trail: 1,
  softGlow: true,
};

/** Key in the server's settings table. */
export const ORB_LOOK_SETTING = 'orb_look';

const LOOK_KEYS = Object.keys(DEFAULT_ORB_LOOK) as (keyof OrbLook)[];

/**
 * Checks a look sent by a browser (or read back from the database): every field present and right,
 * numbers inside ORB_LOOK_RANGES, palette/shape from the lists, nothing extra. Numbers are rounded to
 * 2 decimals. Returns the clean look or a Thai error.
 */
export function checkOrbLook(v: unknown): { look: OrbLook; error?: undefined } | { look?: undefined; error: string } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { error: 'ค่าลูกแก้วไม่ถูกต้อง' };
  const o = v as Record<string, unknown>;
  const extra = Object.keys(o).find((k) => !(LOOK_KEYS as string[]).includes(k));
  if (extra) return { error: `ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  if (!(ORB_PALETTE_IDS as readonly unknown[]).includes(o.palette)) return { error: 'ไม่มีชุดสีนี้' };
  if (!(ORB_SHAPE_IDS as readonly unknown[]).includes(o.shape)) return { error: 'ไม่มีรูปทรงนี้' };
  if (typeof o.softGlow !== 'boolean') return { error: 'ค่า softGlow ต้องเป็น true/false' };
  const look = { palette: o.palette, shape: o.shape, softGlow: o.softGlow } as OrbLook;
  for (const [k, [lo, hi]] of Object.entries(ORB_LOOK_RANGES) as [OrbLookNumber, [number, number]][]) {
    const n = o[k];
    if (typeof n !== 'number' || !Number.isFinite(n)) return { error: `ค่า ${k} ต้องเป็นตัวเลข` };
    if (n < lo || n > hi) return { error: `ค่า ${k} ต้องอยู่ระหว่าง ${lo} ถึง ${hi}` };
    look[k] = Math.round(n * 100) / 100;
  }
  return { look };
}

/** Same look? */
export function sameOrbLook(a: OrbLook, b: OrbLook): boolean {
  return LOOK_KEYS.every((k) => a[k] === b[k]);
}

/** Short text of what differs from `before`, for the audit log. */
export function orbLookChanges(before: OrbLook, after: OrbLook): string {
  return LOOK_KEYS.filter((k) => before[k] !== after[k]).map((k) => `${k} ${before[k]} → ${after[k]}`).join(', ');
}
