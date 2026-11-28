// How the game lays its ground, as plain data: which repeating tile each theme uses, how wide the roads are worn, and the small
// decor details. Shared by the game (src/client/world.ts) and the /admin map editor (src/admin/mapEditor/groundArt.ts), so the
// editor's ground follows the game's. No `three` here.
import type { MapTheme } from './mapSchema';

/** A repeating ground picture in sprites/paper/ground/<name>.png. */
export type GroundTileName = 'grass' | 'dirt' | 'water' | 'marsh' | 'mud' | 'pave' | 'brick' | 'snow' | 'snow_path' | 'ice' | 'ash_rock' | 'ash_path' | 'lava'
  | 'room_forest' | 'room_marsh' | 'room_snow' | 'room_volcano' | 'harbor_plank' | 'harbor_plaza' | 'harbor_water'
  // Floor 2's Shipwreck Beach (paper only).
  | 'sand' | 'wreck' | 'shallow' | 'room_beach'
  // Floor 2's Smugglers' Cove (paper only).
  | 'rock' | 'boardwalk' | 'cove_water' | 'room_cove'
  // Floor 2's Ghost Ship Graveyard (paper only).
  | 'stone' | 'rotten_deck' | 'misty_water' | 'room_grave'
  // Floor 2's Kraken Maelstrom (paper only).
  | 'storm_rock' | 'wet_planks' | 'rough_sea' | 'room_kraken';

/** Each theme's tiles. `dirt` also covers clearings and pond banks; `water` and `pave` fall back to 'water' and 'pave'. */
export const THEME_TILES: Record<MapTheme, { base: GroundTileName; dirt: GroundTileName; water?: GroundTileName; pave?: GroundTileName }> = {
  forest: { base: 'grass', dirt: 'dirt' },
  marsh: { base: 'marsh', dirt: 'mud' },
  snow: { base: 'snow', dirt: 'snow_path', water: 'ice', pave: 'snow_path' },
  volcano: { base: 'ash_rock', dirt: 'ash_path', water: 'lava', pave: 'ash_path' },
  // Floor 2's Shipwreck Beach: warm cream sand, salvaged planks for the roads and turquoise tide pools (FLOOR2_M1_BEACH.md).
  beach: { base: 'sand', dirt: 'wreck', water: 'shallow', pave: 'wreck' },
  // Floor 2's Smugglers' Cove: mauve-grey rock floor, dark plank boardwalks for the roads, turquoise cove water (FLOOR2_M2_COVE.md).
  cove: { base: 'rock', dirt: 'boardwalk', water: 'cove_water', pave: 'boardwalk' },
  // Floor 2's Ghost Ship Graveyard: wet slate flagstones, rotten ship decks for the roads, dark misty sea water (FLOOR2_M3_GRAVEYARD.md).
  grave: { base: 'stone', dirt: 'rotten_deck', water: 'misty_water', pave: 'rotten_deck' },
  // Floor 2's Kraken Maelstrom: rain-soaked slate rock, wet pier planks for the roads, rough stormy sea (FLOOR2_M4_MAELSTROM.md).
  kraken: { base: 'storm_rock', dirt: 'wet_planks', water: 'rough_sea', pave: 'wet_planks' },
};

/** World units covered by one repeat of a ground tile: about the same pixel size as the sprites. */
export const TILE_UNITS = 10.4;
/** Bare ground around the camp at a zone's start. */
export const CAMP_RADIUS = 7;
/** How wide each theme's roads are worn into the grass (the game draws every path this wide, whatever its `w`). */
export const TRAIL_WIDTH: Record<MapTheme, number> = { forest: 4.2, marsh: 3.6, snow: 3.8, volcano: 3.8, beach: 3.8, cove: 3.6, grave: 3.6, kraken: 3.6 };

/** Where a small ground detail belongs. */
export type DecorSpot = 'verge' | 'field' | 'road' | 'shore' | 'water';

/**
 * Small details with no collision, one atlas per theme (sprites/paper/props/<key>.png, a grid read left to right, top to bottom).
 * Each spot lists the cells that grow there, repeated to make some more common. `flat` cells are painted lying on the ground.
 * `sway` cells are standing plants, which move in the wind (never stones, shells, logs and the like).
 */
export const DECOR: Record<MapTheme, { key: string; cols: number; rows: number; spots: Record<DecorSpot, number[]>; sway: number[]; flat?: number[] }> = {
  forest: {
    key: 'decor_forest',
    cols: 4,
    rows: 3,
    sway: [0, 1, 2, 3, 4, 5, 6],
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
    sway: [0, 1, 2, 10],
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
    sway: [0, 1, 4, 5, 10],
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
    sway: [0, 1, 4, 5, 10],
    spots: {
      verge: [0, 0, 0, 1, 10, 11],
      field: [0, 0, 1, 2, 3, 4, 5, 9, 10, 11],
      road: [8, 8, 11],
      shore: [6, 7, 2, 9],
      water: [],
    },
    flat: [6, 7, 8],
  },
  // FLOOR2_M1_BEACH.md 4: shells, starfish / pebbles, seaweed, driftwood, beach grass / hibiscus, crab hole, coins, a plank.
  beach: {
    key: 'decor_beach',
    cols: 4,
    rows: 3,
    sway: [7, 8],
    spots: {
      verge: [7, 7, 7, 0, 1, 8],
      field: [0, 0, 1, 1, 2, 3, 4, 5, 6, 7, 9, 10],
      road: [11, 11, 4],
      shore: [5, 5, 2, 3, 0, 6],
      water: [],
    },
    flat: [2, 3, 9, 10],
  },
  // FLOOR2_M2_COVE.md 4: pebbles, flat rock, grass, plant / rope coil, broken bottle, cannonball, coins / wanted poster, chain, plank, seaweed.
  cove: {
    key: 'decor_cove',
    cols: 4,
    rows: 3,
    sway: [2, 3],
    spots: {
      verge: [2, 2, 3, 0, 1, 4],
      field: [0, 0, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      road: [10, 10, 8, 9],
      shore: [11, 11, 0, 1, 2],
      water: [],
    },
    flat: [8, 9, 10],
  },
  // FLOOR2_M3_GRAVEYARD.md 4: pebbles, seaweed, starfish, shells / skull, candle, plank, chain / dead grass, mossy stone, puddle, nail.
  grave: {
    key: 'decor_graveyard',
    cols: 4,
    rows: 3,
    sway: [1, 8],
    spots: {
      verge: [8, 8, 1, 0, 9, 3],
      field: [0, 0, 1, 2, 3, 4, 5, 8, 9, 9, 7, 11],
      road: [6, 6, 7, 11],
      shore: [1, 1, 2, 3, 0, 10],
      water: [],
    },
    flat: [2, 6, 7, 10, 11],
  },
  // FLOOR2_M4_MAELSTROM.md 4: pebbles, flat stone, coral sprig, starfish / seaweed, puddle, plank, rope / shells, foam, stave, sucker stone.
  kraken: {
    key: 'decor_maelstrom',
    cols: 4,
    rows: 3,
    sway: [4],
    spots: {
      verge: [0, 1, 4, 8, 2],
      field: [0, 0, 1, 1, 2, 3, 4, 5, 8, 11],
      road: [6, 7, 10, 10],
      shore: [9, 9, 8, 3, 4, 0],
      water: [],
    },
    flat: [1, 3, 5, 6, 7, 9, 10],
  },
};
/** World size of one decor atlas cell: 128 pixels at about the same density as the ground tiles. */
export const DECOR_CELL_UNITS = 1.33;
