// How the game lays its ground, as plain data: which repeating tile each theme uses, how wide the roads are worn, and the small
// decor details. Shared by the game (src/client/world.ts) and the /admin map editor (src/admin/mapEditor/groundArt.ts), so the
// editor's ground follows the game's. No `three` here.
import type { MapTheme } from './mapSchema';

/** A repeating ground picture in sprites/paper/ground/<name>.png. */
export type GroundTileName = 'grass' | 'dirt' | 'water' | 'marsh' | 'mud' | 'pave' | 'brick' | 'snow' | 'snow_path' | 'ice' | 'ash_rock' | 'ash_path' | 'lava'
  | 'room_forest' | 'room_marsh' | 'room_snow' | 'room_volcano';

/** Each theme's tiles. `dirt` also covers clearings and pond banks; `water` and `pave` fall back to 'water' and 'pave'. */
export const THEME_TILES: Record<MapTheme, { base: GroundTileName; dirt: GroundTileName; water?: GroundTileName; pave?: GroundTileName }> = {
  forest: { base: 'grass', dirt: 'dirt' },
  marsh: { base: 'marsh', dirt: 'mud' },
  snow: { base: 'snow', dirt: 'snow_path', water: 'ice', pave: 'snow_path' },
  volcano: { base: 'ash_rock', dirt: 'ash_path', water: 'lava', pave: 'ash_path' },
};

/** World units covered by one repeat of a ground tile: about the same pixel size as the sprites. */
export const TILE_UNITS = 10.4;
/** Bare ground around the camp at a zone's start. */
export const CAMP_RADIUS = 7;
/** How wide each theme's roads are worn into the grass (the game draws every path this wide, whatever its `w`). */
export const TRAIL_WIDTH: Record<MapTheme, number> = { forest: 4.2, marsh: 3.6, snow: 3.8, volcano: 3.8 };

/** Where a small ground detail belongs. */
export type DecorSpot = 'verge' | 'field' | 'road' | 'shore' | 'water';

/**
 * Small details with no collision, one atlas per theme (sprites/paper/props/<key>.png, a grid read left to right, top to bottom).
 * Each spot lists the cells that grow there, repeated to make some more common. `flat` cells are painted lying on the ground.
 */
export const DECOR: Record<MapTheme, { key: string; cols: number; rows: number; spots: Record<DecorSpot, number[]>; flat?: number[] }> = {
  forest: {
    key: 'decor_forest',
    cols: 4,
    rows: 3,
    spots: {
      verge: [0, 0, 0, 1, 1, 6, 7],
      field: [0, 0, 1, 2, 2, 3, 4, 5, 6, 9, 10, 11],
      road: [8, 8, 10],
      shore: [],
      water: [],
    },
  },
  marsh: {
    key: 'decor_marsh',
    cols: 4,
    rows: 3,
    spots: {
      verge: [0, 0, 0, 1, 10, 11],
      field: [0, 0, 1, 2, 3, 4, 5, 9, 10, 11],
      road: [8, 8, 11],
      shore: [1, 1, 10, 10, 2, 9],
      water: [6, 6, 7],
    },
    flat: [8],
  },
  snow: {
    key: 'decor_snow',
    cols: 4,
    rows: 3,
    spots: {
      verge: [0, 0, 0, 1, 10, 11],
      field: [0, 0, 1, 2, 3, 4, 5, 9, 10, 11],
      road: [8, 8, 11],
      shore: [1, 1, 10, 10, 2, 9],
      water: [6, 6, 7],
    },
    flat: [6, 7, 8],
  },
  volcano: {
    key: 'decor_volcano',
    cols: 4,
    rows: 3,
    spots: {
      verge: [0, 0, 0, 1, 10, 11],
      field: [0, 0, 1, 2, 3, 4, 5, 9, 10, 11],
      road: [8, 8, 11],
      shore: [6, 7, 2, 9],
      water: [],
    },
    flat: [6, 7, 8],
  },
};
/** World size of one decor atlas cell: 128 pixels at about the same density as the ground tiles. */
export const DECOR_CELL_UNITS = 1.33;
