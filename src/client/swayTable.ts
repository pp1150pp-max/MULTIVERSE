// What moves in the wind (docs/systems/shaders.md, owner 2026-11-28) and how much of it each graphics level draws.
// Plain data: no `three`, so the tests can check it. The shaders are in wind.ts.
import type { FxLayerConfig, ShaderLevel } from '../shared/fxLayerTuning';

/**
 * How a standing picture moves. `leaf` / `bush` / `stiff` lean from their foot (the flat picture is sheared, never bent):
 * trees a little, low plants more of their small height, bare wood and kelp on a rock barely. `ship` rocks whole.
 */
export type SwayKind = 'leaf' | 'bush' | 'stiff' | 'ship';

/** Sideways lean per unit of height at the strongest gust (wind ×1). */
export const SWAY_LEAN: Record<Exclude<SwayKind, 'ship'>, number> = { leaf: 0.016, bush: 0.032, stiff: 0.007 };
/** The grass and small plants on the ground, per unit of their picture's cell (they fill only its lower part). */
export const GRASS_LEAN = 0.1;
/** How far a ship rocks either way (owner 2026-11-28: ±0.5°), and how high up its picture the waterline it rocks about is. */
export const SHIP_ROCK = (0.5 * Math.PI) / 180;
export const SHIP_PIVOT = 0.12;

const of = (kind: SwayKind, keys: string[]): [string, SwayKind][] => keys.map((k) => [k, kind]);
const numbered = (name: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${name}_${i}`);

/** Prop key → how it sways. A key not listed stands still (flags and sails wait for pictures with the cloth cut apart). */
export const SWAY_PROPS: Readonly<Record<string, SwayKind>> = Object.fromEntries([
  ...of('leaf', [
    ...numbered('tree', 3), ...numbered('swamp_tree', 3), 'willow', 'frost_tree', ...numbered('snow_pine', 3),
    ...numbered('coconut_palm', 3), ...numbered('cliff_palm', 2), 'potted_tree', 'hb_palm_pot',
    ...['forest', 'marsh', 'snow', 'beach', 'cove'].map((t) => `room_${t}_tree`),
  ]),
  ...of('bush', [
    ...numbered('bush', 3), 'fern', 'tropical_fern', 'frost_fern', 'ember_fern', ...numbered('snow_shrub', 2),
    ...numbered('ash_shrub', 2), ...numbered('reeds', 2), 'hibiscus', ...numbered('thicket', 2),
  ]),
  ...of('stiff', ['charred_tree', 'room_volcano_tree', 'sea_kelp']),
  ...of('ship', ['hb_ship_blue', 'hb_ship_green', 'hb_ship_red', 'hb_ship_white']),
]);

/**
 * The strengths a level draws: the shear multiplier for standing plants and the grass, and the ships' rocking angle
 * (radians). Low moves the trees only; grass and ships at high only. All 0 = the picture as before the wind.
 */
export function windLook(level: ShaderLevel, cfg: Pick<FxLayerConfig, 'windK' | 'swayTree' | 'swayGrass' | 'swayShip'>): { tree: number; grass: number; ship: number } {
  return {
    tree: level >= 1 ? cfg.windK * cfg.swayTree : 0,
    grass: level >= 2 ? cfg.windK * cfg.swayGrass : 0,
    ship: level >= 2 ? SHIP_ROCK * cfg.windK * cfg.swayShip : 0,
  };
}
