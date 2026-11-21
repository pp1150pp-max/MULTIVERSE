import { PROP_SHEETS, type PropSheet } from './zonePropsTable';
import * as THREE from 'three';
import {
  makeSheet, drawHuman, drawSlime, drawQuad, drawSeeker, drawMerchant, drawBlacksmith, drawKeeper, drawBroker, drawStylist, drawCrystalMerchant, drawCosmetic, drawTree, drawBush, drawRock, drawStump,
  drawSnowPine, drawSnowRock, drawIceCrystal, drawIceShard, drawEmberBolt, drawBurntPillar, drawBasalt, drawMagmaCrystal, drawSnowball,
  drawTent, drawCampfire, drawSign, drawFence, drawRunestone, drawIcon, pixelCircle,
  drawWitchVial, drawWitchPool, drawWitchHand, drawWitchSigil, drawWitchCircle,
} from './placeholder';
import { ITEM_ART } from '../shared/data/items';
import { STONE_KINDS } from '../shared/types';
import { MAP_ICONS } from './mapIconNames';
import { imgUrl } from './img';
import { COSMETICS } from '../shared/data/cosmetics';
import type { AnimSet, CharManifest } from './AnimatedActor';

export interface SheetInfo {
  texture: THREE.Texture;
  cols: number;
  rows: number;
  /** Which way the "side" row faces in the image. The other side is mirrored. */
  sideFaces: 'left' | 'right';
  cellAspect: number;
  /**
   * A paper monster sheet (tools/cut_paper_monsters.cjs): columns 0-3 walk, 4-7 attack, and the picture drawn this
   * much taller than the unit's height (its cell has room for the attack poses).
   */
  paper?: { walk: number; attack: number; scale: number };
  /** A paper NPC sheet: this many breathing frames across, looped while it stands (SpriteActor). */
  idleFrames?: number;
}

interface SheetSpec {
  path: string;
  cols: number;
  rows: number;
  /** Rows in the real PNG when it differs from the placeholder (monsters have diagonal views). */
  fileRows?: number;
  /** Side-row direction for real PNG files (concept sheet faces left). Placeholders face right. */
  fileSideFaces: 'left' | 'right';
  placeholder: () => HTMLCanvasElement;
  /** An existing picture to borrow while this one hasn't been made yet (before the placeholder drawing). */
  standIn?: string;
}

const BASE = 'assets/sprites/';

/**
 * Papercraft map art (src/shared/paperArt.ts, cut by tools/cut_papercraft.cjs): the props/ and ground/ files that have
 * a paper version under sprites/paper/, same name and size. Each map adds its own as it is made.
 */
const PAPER_PROPS = new Set([
  // Map 1 Emerald Forest
  'tree_0', 'tree_1', 'tree_2', 'stump_tall', 'bush_0', 'bush_1', 'bush_2', 'stump', 'rock_0', 'rock_1', 'rock_2', 'pebble_0', 'pebble_1',
  'decor_forest', 'island_cliff_forest', 'island_slabs_forest',
  ...['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_forest_${n}`),
  // Map 2 Misty Marsh
  'swamp_tree_0', 'swamp_tree_1', 'swamp_tree_2', 'willow', 'reeds_0', 'reeds_1', 'fern', 'mushrooms', 'mossrock_0', 'mossrock_1', 'swamp_stump',
  'decor_marsh', 'marsh_planks', 'island_cliff_marsh', 'island_slabs_marsh',
  ...['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_marsh_${n}`),
  // Map 3 Frost Reach
  'snow_pine_0', 'snow_pine_1', 'snow_pine_2', 'frost_tree', 'snow_shrub_0', 'snow_shrub_1', 'frost_fern', 'snow_stump',
  'snow_rock_0', 'snow_rock_1', 'ice_crystal_0', 'ice_crystal_1', 'decor_snow', 'island_cliff_snow', 'island_slabs_snow',
  ...['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_snow_${n}`),
  // Map 4 Ashen Isle
  'burnt_pillar_0', 'burnt_pillar_1', 'burnt_pillar_2', 'charred_tree', 'ash_shrub_0', 'ash_shrub_1', 'ember_fern', 'charred_stump',
  'basalt_0', 'basalt_1', 'magma_crystal_0', 'magma_crystal_1', 'decor_volcano', 'island_cliff_volcano', 'island_slabs_volcano',
  ...['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_volcano_${n}`),
  // The hub town and the boss summoners
  'ruin_fountain', 'ruin_statue', 'ruin_pillar', 'ruin_house', 'ruin_tower', 'ruin_rubble', 'town_stall', 'town_forge', 'town_vault', 'town_market',
  'town_wall_a', 'town_wall_a_broken', 'town_wall_b', 'town_wall_b_broken', 'town_wall_end',
  'summoner_forest', 'summoner_marsh', 'summoner_snow', 'summoner_volcano',
  // Every map's camp and island rim
  'tent', 'campfire', 'sign', 'portal', 'runestone', 'well', 'barrel', 'chest', 'cart', 'banner_red', 'flag', 'watchtower',
  'island_debris', 'island_cracks',
]);
/** Floor 2's harbour town pieces (FLOOR2_HUB.md), cut to sprites/paper/props/hb_*.png. */
const HARBOR_PROPS = [
  'hb_supply', 'hb_broker', 'hb_forge', 'hb_warehouse', 'hb_smuggler', 'hb_lighthouse', 'hb_shipyard', 'hb_rowboat',
  'hb_wheel_fountain', 'hb_brass_globe', 'hb_lamp_post', 'hb_banner_pole', 'hb_bench_a', 'hb_bench_b', 'hb_bunting_post', 'hb_barrels',
  'hb_crates', 'hb_sacks', 'hb_rope_coil', 'hb_palm_pot', 'hb_dock_a', 'hb_dock_b', 'hb_dock_end', 'hb_bollard', 'hb_rail_a', 'hb_rail_b',
  'hb_edge_a', 'hb_edge_b', 'hb_ship_red', 'hb_ship_blue', 'hb_ship_green', 'hb_ship_white', 'hb_falls_a', 'hb_falls_b', 'hb_foam_post',
  'hb_wave', 'hb_float_barrel', 'hb_gull_post', 'hb_portal_dock', 'hb_portal_return', 'hb_portal_floor2',
];
/**
 * Floor 2's Shipwreck Beach (FLOOR2_M1_BEACH.md, tools/cut_papercraft.cjs floor2_m1 on art/floor2-cut): paper only, under
 * sprites/paper/props/. Until that art is merged each falls back to its placeholder drawing.
 */
const BEACH_PROPS = [
  'coconut_palm_0', 'coconut_palm_1', 'coconut_palm_2', 'wreck_hull', 'torn_sail_mast', 'sea_rock_0', 'sea_rock_1', 'rock_pillar',
  'hibiscus', 'tropical_fern', 'giant_clam', 'broken_ladder', 'treasure_chest', 'wreck_crates', 'salvage_barrel', 'brass_lantern',
  'plank_pile', 'stuck_anchor', 'beached_rowboat', 'old_cannon', 'driftwood_sign', 'skull_flag', 'tide_pool', 'coin_pile',
  'summoner_crab', 'decor_beach', 'island_cliff_beach', 'island_slabs_beach',
  ...['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_beach_${n}`),
];
/** Floor 2's move effects (sim/beachMoves.ts, cannonCrab.ts: Sim fx 'sprite' and the crab's cannonballs), paper only. */
const BEACH_FX = ['fx_cannonball', 'fx_warn_ring', 'fx_chain_bolt', 'fx_shock', 'fx_spike_burst', 'fx_shell_guard'];
/** The harbour's NPC sheets and the navigator's (SHEET_SPECS keys): paper only. */
const PAPER_ONLY_NPC = new Set(['hb_supply_merchant', 'hb_dock_keeper', 'hb_shipwright', 'hb_harbor_broker', 'hb_smuggler', 'navigator']);
const PAPER_GROUND = new Set(['grass', 'dirt', 'pave', 'room_forest', 'marsh', 'mud', 'water', 'room_marsh',
  'snow', 'snow_path', 'ice', 'room_snow', 'ash_rock', 'ash_path', 'lava', 'room_volcano', 'brick',
  // Floor 2's harbour town (tools/cut_papercraft.cjs floor2_hub): paper only.
  'harbor_plank', 'harbor_plaza', 'harbor_water', 'sky_day']);
/** Classes with a paper animation set in sprites/paper/player/<class>/ (tools/cut_paper_char.cjs). */
const PAPER_CHARS = new Set(['sword', 'mage', 'gunslinger']);
let paperMaps = false;
let paperAnswer: Promise<boolean> = Promise.resolve(false);

/**
 * The server's art switch (true = the paper pictures wherever one exists), given as the pending answer so the game's
 * load waits for it, however early it starts. Pages that never call this (the /admin previews) keep the old art.
 */
export function usePaperMaps(answer: Promise<boolean>): void {
  paperAnswer = answer;
}

const sheet = (path: string, placeholder: () => HTMLCanvasElement): SheetSpec =>
  ({ path: BASE + path, cols: 3, rows: 3, fileSideFaces: 'left', placeholder });
/** Monster files: 3 frames across, and front, front diagonal, side, back diagonal, back down. */
const monster = (path: string, placeholder: () => HTMLCanvasElement): SheetSpec =>
  ({ ...sheet(path, placeholder), fileRows: 5 });
const single = (path: string, placeholder: () => HTMLCanvasElement): SheetSpec =>
  ({ path: BASE + path, cols: 1, rows: 1, fileSideFaces: 'left', placeholder });
const prop = (key: string, placeholder: () => HTMLCanvasElement): SheetSpec => single(`props/${key}.png`, placeholder);
/** The hub's ruined-city props: their own picture once it exists, until then an older prop's. */
const ruin = (key: string, standIn: string | null): SheetSpec =>
  standIn ? { ...prop(key, () => drawRock(0)), standIn: `${BASE}props/${standIn}.png` } : prop(key, () => document.createElement('canvas'));

/** The sheets key of a cosmetic's walk sheet. */
export const cosSheetKey = (id: string): string => `cos_${id}`;
/** The sheets key of a wing's single-wing picture (wingPair.ts). */
export const cosOneKey = (id: string): string => `cos_${id}_one`;

export const SHEET_SPECS: Record<string, SheetSpec> = {
  sword: sheet('player/sword.png', () => makeSheet(32, drawHuman('sword'))),
  mage: sheet('player/mage.png', () => makeSheet(32, drawHuman('mage'))),
  gunslinger: sheet('player/gunslinger.png', () => makeSheet(32, drawHuman('gunslinger'))),
  seeker: sheet('npc/seeker.png', () => makeSheet(32, drawSeeker())),
  merchant: sheet('npc/merchant.png', () => makeSheet(32, drawMerchant())),
  blacksmith: sheet('npc/blacksmith.png', () => makeSheet(32, drawBlacksmith())),
  keeper: sheet('npc/keeper.png', () => makeSheet(32, drawKeeper())),
  broker: sheet('npc/broker.png', () => makeSheet(32, drawBroker())),
  stylist: sheet('npc/stylist.png', () => makeSheet(32, drawStylist())),
  crystal: sheet('npc/crystal_merchant.png', () => makeSheet(32, drawCrystalMerchant())),
  // Cosmetics with a body (wings, mounts, pets): 8-direction walk sheets like the monsters' (see cosmeticViews.ts).
  ...Object.fromEntries(COSMETICS.filter((c) => c.slot !== 'aura' && c.slot !== 'title' && c.slot !== 'orb').map((c) => [
    cosSheetKey(c.id), monster(`cosmetics/${c.id}.png`, () => makeSheet(c.slot === 'pet' ? 32 : 48, drawCosmetic(c))),
  ])),
  // Wings from ONE wing picture, mirrored into the pair (wingPair.ts). Used only when the file exists
  // (assetSources 'file'); otherwise the pair sheet above is drawn as before.
  ...Object.fromEntries(COSMETICS.filter((c) => c.slot === 'wings').map((c) => [
    cosOneKey(c.id), { path: `${BASE}cosmetics/${c.id}_one.png`, cols: 3, rows: 5, fileSideFaces: 'left' as const, placeholder: () => document.createElement('canvas') },
  ])),

  green_slime: monster('monsters/green_slime.png', () => makeSheet(32, drawSlime(['#6cc25a', '#4a9a3e', '#c8f0b0']))),
  wild_rabbit: monster('monsters/wild_rabbit.png', () => makeSheet(32, drawQuad(['#e8d3bf', '#d89a9a', '#fbeee2', '#d88a8a'], {
    bodyRx: 0.2, bodyRy: 0.15, head: 0.13, ears: 'long', earSize: 0.13, tail: 'puff', legLen: 0.06, legW: 0.06, snout: 0.05, belly: true,
  }))),
  forest_fox: monster('monsters/forest_fox.png', () => makeSheet(36, drawQuad(['#e07a2a', '#5a2a10', '#fbf1e4', '#2a1c12'], {
    bodyRx: 0.24, bodyRy: 0.12, head: 0.13, ears: 'pointy', earSize: 0.1, tail: 'bushy', tailTip: '#fbf1e4', legLen: 0.12, legW: 0.05, snout: 0.06, belly: true,
  }))),
  wild_boar: monster('monsters/wild_boar.png', () => makeSheet(40, drawQuad(['#6b4530', '#3e281c', '#a07a5c', '#d9a0a0'], {
    bodyRx: 0.3, bodyRy: 0.17, head: 0.14, ears: 'small', earSize: 0.07, tail: 'short', legLen: 0.1, legW: 0.07, snout: 0.07, tusks: true, mane: true,
  }))),
  forest_wolf: monster('monsters/forest_wolf.png', () => makeSheet(40, drawQuad(['#6e6e74', '#3d3d44', '#d9d6cf', '#1a1a1a'], {
    bodyRx: 0.28, bodyRy: 0.13, head: 0.13, ears: 'pointy', earSize: 0.09, tail: 'bushy', tailTip: '#d9d6cf', legLen: 0.15, legW: 0.055, snout: 0.07, belly: true,
  }))),
  forest_bear: monster('monsters/forest_bear.png', () => makeSheet(56, drawQuad(['#7a4a2a', '#4a2c18', '#b88a64', '#1a1410'], {
    bodyRx: 0.36, bodyRy: 0.22, head: 0.16, ears: 'round', earSize: 0.08, tail: 'none', legLen: 0.13, legW: 0.1, snout: 0.08, belly: true,
  }))),

  // Zone 2 — Misty Marsh. Placeholders only show if the PNGs are missing.
  bog_toad: monster('monsters/bog_toad.png', () => makeSheet(40, drawQuad(['#6f6a34', '#4a4622', '#c9b98a', '#2a2412'], {
    bodyRx: 0.3, bodyRy: 0.2, head: 0.14, ears: 'small', earSize: 0.04, tail: 'none', legLen: 0.06, legW: 0.08, snout: 0.04, belly: true,
  }))),
  marsh_leech: monster('monsters/marsh_leech.png', () => makeSheet(36, drawSlime(['#4a3450', '#2e1e34', '#9a7aa8']))),
  swamp_serpent: monster('monsters/swamp_serpent.png', () => makeSheet(36, drawSlime(['#3e8a78', '#2a5e52', '#e0d070']))),
  mire_ghoul: monster('monsters/mire_ghoul.png', () => makeSheet(40, drawSlime(['#3a3228', '#221c16', '#a8e08a']))),
  will_o_wisp: monster('monsters/will_o_wisp.png', () => makeSheet(36, drawSlime(['#6ad8d0', '#3a9aa8', '#e8fffa']))),
  bog_witch: monster('monsters/bog_witch.png', () => makeSheet(56, drawSeeker())),

  // Zone 3 — Frost Reach. Placeholders only show if the PNGs are missing.
  frost_penguin: monster('monsters/frost_penguin.png', () => makeSheet(36, drawSlime(['#2c3a4e', '#172130', '#eef4f8']))),
  tusk_seal: monster('monsters/tusk_seal.png', () => makeSheet(40, drawQuad(['#7f8c98', '#4e5a66', '#c3ccd4', '#1d242b'], {
    bodyRx: 0.34, bodyRy: 0.18, head: 0.14, ears: 'small', earSize: 0.03, tail: 'none', legLen: 0.04, legW: 0.1, snout: 0.06, tusks: true, belly: true,
  }))),
  snow_owl: monster('monsters/snow_owl.png', () => makeSheet(36, drawSlime(['#dce6ee', '#94a6b6', '#f7c844']))),
  snow_sprite: monster('monsters/snow_sprite.png', () => makeSheet(36, drawSlime(['#9fdcf2', '#5aa6c8', '#f2fbff']))),
  snow_brawler: monster('monsters/snow_brawler.png', () => makeSheet(36, drawSlime(['#b8d8ec', '#5aa6c8', '#f2fbff']))),
  polar_bear: monster('monsters/polar_bear.png', () => makeSheet(48, drawQuad(['#e6ecf0', '#9fb0bc', '#fbfdfe', '#1d242b'], {
    bodyRx: 0.36, bodyRy: 0.2, head: 0.15, ears: 'round', earSize: 0.07, tail: 'none', legLen: 0.13, legW: 0.1, snout: 0.08, belly: true,
  }))),
  yeti: monster('monsters/yeti.png', () => makeSheet(56, drawQuad(['#c9d8e4', '#7f96aa', '#eaf2f8', '#3a4a5a'], {
    bodyRx: 0.34, bodyRy: 0.27, head: 0.17, ears: 'small', earSize: 0.06, tail: 'none', legLen: 0.15, legW: 0.12, snout: 0.05, tusks: true, mane: true, belly: true,
  }))),
  yeti_minion: monster('monsters/yeti_minion.png', () => makeSheet(44, drawQuad(['#7f9cb4', '#4f6b82', '#b4c8d8', '#2a3644'], {
    bodyRx: 0.3, bodyRy: 0.24, head: 0.17, ears: 'small', earSize: 0.06, tail: 'none', legLen: 0.14, legW: 0.1, snout: 0.05, mane: true, belly: true,
  }))),
  // Zone 4 — Ashen Isle. Placeholders only show if the PNGs are missing.
  ember_wisp: monster('monsters/ember_wisp.png', () => makeSheet(36, drawSlime(['#ff9a3a', '#c8501a', '#ffe58a']))),
  salamander: monster('monsters/salamander.png', () => makeSheet(40, drawQuad(['#d8562a', '#7a2a14', '#f2c070', '#2a1410'], {
    bodyRx: 0.32, bodyRy: 0.13, head: 0.13, ears: 'small', earSize: 0.03, tail: 'short', legLen: 0.06, legW: 0.07, snout: 0.06, belly: true,
  }))),
  lava_bat: monster('monsters/lava_bat.png', () => makeSheet(36, drawSlime(['#4a3038', '#2a1a20', '#ff9a4a']))),
  magma_golem: monster('monsters/magma_golem.png', () => makeSheet(48, drawQuad(['#4a4044', '#2a2428', '#ff8a3a', '#1a1416'], {
    bodyRx: 0.36, bodyRy: 0.24, head: 0.14, ears: 'small', earSize: 0.03, tail: 'none', legLen: 0.14, legW: 0.11, snout: 0.03, belly: true,
  }))),
  ash_mage: monster('monsters/ash_mage.png', () => makeSheet(36, drawSlime(['#6e6668', '#3e383a', '#ffb06a']))),
  ash_knight: monster('monsters/ash_knight.png', () => makeSheet(36, drawSlime(['#55504e', '#2e2a2a', '#e8783a']))),
  volcano_heart: monster('monsters/volcano_heart.png', () => makeSheet(56, drawSlime(['#c8341a', '#6a1a10', '#ffc04a']))),
  // Floor 2, Shipwreck Beach: paper sheets only (sprites/paper/monsters/, art/floor2-cut). Placeholders until then.
  hermit_crab: monster('monsters/hermit_crab.png', () => makeSheet(40, drawSlime(['#e0603a', '#8a2a14', '#f2e2c0']))),
  thief_gull: monster('monsters/thief_gull.png', () => makeSheet(36, drawSlime(['#f4f4f0', '#9aa4ae', '#f2c24a']))),
  shock_eel: monster('monsters/shock_eel.png', () => makeSheet(36, drawSlime(['#22305a', '#121a34', '#ffe14a']))),
  spike_turtle: monster('monsters/spike_turtle.png', () => makeSheet(44, drawQuad(['#5a8a4a', '#4a3424', '#d8dcd8', '#1a2014'], {
    bodyRx: 0.34, bodyRy: 0.2, head: 0.12, ears: 'small', earSize: 0.02, tail: 'short', legLen: 0.06, legW: 0.09, snout: 0.04, belly: true,
  }))),
  // Its pictures are cut as giant_crab (4 moves, waiting for the owner's cannon and shell sheets); a placeholder until then.
  cannon_crab: monster('monsters/cannon_crab.png', () => makeSheet(56, drawQuad(['#d8502a', '#7a2410', '#c89a5a', '#2a1410'], {
    bodyRx: 0.4, bodyRy: 0.2, head: 0.1, ears: 'small', earSize: 0.03, tail: 'none', legLen: 0.08, legW: 0.08, snout: 0.03, tusks: true, belly: true,
  }))),
  fx_ember_bolt: single('fx/ember_bolt.png', drawEmberBolt),

  burnt_pillar_0: single('props/burnt_pillar_0.png', () => drawBurntPillar(0)),
  burnt_pillar_1: single('props/burnt_pillar_1.png', () => drawBurntPillar(1)),
  burnt_pillar_2: single('props/burnt_pillar_2.png', () => drawBurntPillar(2)),
  charred_tree: single('props/charred_tree.png', () => drawBurntPillar(1)),
  ash_shrub_0: single('props/ash_shrub_0.png', () => drawBasalt(0)),
  ash_shrub_1: single('props/ash_shrub_1.png', () => drawBasalt(1)),
  ember_fern: single('props/ember_fern.png', () => drawMagmaCrystal(0)),
  basalt_0: single('props/basalt_0.png', () => drawBasalt(0)),
  basalt_1: single('props/basalt_1.png', () => drawBasalt(1)),
  charred_stump: single('props/charred_stump.png', drawStump),
  magma_crystal_0: single('props/magma_crystal_0.png', () => drawMagmaCrystal(0)),
  magma_crystal_1: single('props/magma_crystal_1.png', () => drawMagmaCrystal(1)),
  decor_volcano: single('props/decor_volcano.png', () => drawBasalt(0)),
  island_cliff_volcano: single('props/island_cliff_volcano.png', () => drawBasalt(0)),
  island_slabs_volcano: single('props/island_slabs_volcano.png', () => drawBasalt(0)),

  fx_ice_shard: single('fx/ice_shard.png', drawIceShard),
  fx_snowball: single('fx/snowball.png', drawSnowball),
  // The Bog Witch's spells (cut from art_templates/boss_witch/raw/witch_fx.png).
  fx_witch_vial: single('fx/witch_vial.png', drawWitchVial),
  fx_witch_pool: single('fx/witch_pool.png', drawWitchPool),
  fx_witch_hand: single('fx/witch_hand.png', drawWitchHand),
  fx_witch_sigil: single('fx/witch_sigil.png', drawWitchSigil),
  fx_witch_circle: single('fx/witch_circle.png', drawWitchCircle),

  snow_pine_0: single('props/snow_pine_0.png', () => drawSnowPine(0)),
  snow_pine_1: single('props/snow_pine_1.png', () => drawSnowPine(1)),
  snow_pine_2: single('props/snow_pine_2.png', () => drawSnowPine(2)),
  frost_tree: single('props/frost_tree.png', () => drawSnowPine(1)),
  snow_shrub_0: single('props/snow_shrub_0.png', () => drawSnowRock(0)),
  snow_shrub_1: single('props/snow_shrub_1.png', () => drawSnowRock(1)),
  frost_fern: single('props/frost_fern.png', () => drawIceCrystal(0)),
  snow_rock_0: single('props/snow_rock_0.png', () => drawSnowRock(0)),
  snow_rock_1: single('props/snow_rock_1.png', () => drawSnowRock(1)),
  snow_stump: single('props/snow_stump.png', drawStump),
  ice_crystal_0: single('props/ice_crystal_0.png', () => drawIceCrystal(0)),
  ice_crystal_1: single('props/ice_crystal_1.png', () => drawIceCrystal(1)),
  decor_snow: single('props/decor_snow.png', () => drawBush(0)),
  island_cliff_snow: single('props/island_cliff_snow.png', () => drawRock(0)),
  island_slabs_snow: single('props/island_slabs_snow.png', () => drawRock(0)),

  swamp_tree_0: single('props/swamp_tree_0.png', () => drawTree(0)),
  swamp_tree_1: single('props/swamp_tree_1.png', () => drawTree(1)),
  swamp_tree_2: single('props/swamp_tree_2.png', () => drawTree(2)),
  willow: single('props/willow.png', () => drawTree(1)),
  reeds_0: single('props/reeds_0.png', () => drawBush(0)),
  reeds_1: single('props/reeds_1.png', () => drawBush(1)),
  fern: single('props/fern.png', () => drawBush(0)),
  mushrooms: single('props/mushrooms.png', () => drawBush(1)),
  decor_forest: single('props/decor_forest.png', () => drawBush(0)),
  decor_marsh: single('props/decor_marsh.png', () => drawBush(0)),
  marsh_planks: single('props/marsh_planks.png', () => drawBush(0)),
  island_cliff_forest: single('props/island_cliff_forest.png', () => drawRock(0)),
  island_cliff_marsh: single('props/island_cliff_marsh.png', () => drawRock(0)),
  island_slabs_forest: single('props/island_slabs_forest.png', () => drawRock(0)),
  island_slabs_marsh: single('props/island_slabs_marsh.png', () => drawRock(0)),
  island_debris: single('props/island_debris.png', () => drawRock(1)),
  island_cracks: single('props/island_cracks.png', () => drawRock(1)),
  mossrock_0: single('props/mossrock_0.png', () => drawRock(0)),
  mossrock_1: single('props/mossrock_1.png', () => drawRock(1)),
  swamp_stump: single('props/swamp_stump.png', drawStump),
  portal: single('props/portal.png', drawRunestone),

  tree_0: prop('tree_0', () => drawTree(0)),
  tree_1: prop('tree_1', () => drawTree(1)),
  tree_2: prop('tree_2', () => drawTree(2)),
  bush_0: prop('bush_0', () => drawBush(0)),
  bush_1: prop('bush_1', () => drawBush(1)),
  bush_2: prop('bush_2', () => drawBush(0)),
  rock_0: prop('rock_0', () => drawRock(0)),
  rock_1: prop('rock_1', () => drawRock(1)),
  rock_2: prop('rock_2', () => drawRock(1)),
  pebble_0: prop('pebble_0', () => drawRock(0)),
  pebble_1: prop('pebble_1', () => drawRock(0)),
  stump: prop('stump', drawStump),
  stump_tall: prop('stump_tall', drawStump),
  tent: prop('tent', drawTent),
  campfire: prop('campfire', drawCampfire),
  sign: prop('sign', drawSign),
  banner_red: prop('banner_red', drawSign),
  flag: prop('flag', drawSign),
  runestone: prop('runestone', drawRunestone),
  well: prop('well', drawRunestone),
  barrel: prop('barrel', drawStump),
  cart: prop('cart', drawFence),
  chest: prop('chest', drawStump),
  watchtower: prop('watchtower', drawFence),
  ruin_fountain: ruin('ruin_fountain', 'well'),
  // The town wall kit: pieces that line up end to end (see tools/cut_hub.cjs and Terrain.placeTown).
  ruin_pillar: ruin('ruin_pillar', 'runestone'),
  ruin_house: ruin('ruin_house', 'tent'),
  ruin_tower: ruin('ruin_tower', 'watchtower'),
  ruin_statue: ruin('ruin_statue', 'runestone'),
  // Boss summoners: the statue stands in until their own pictures exist (art_templates/boss_rooms).
  summoner_forest: ruin('summoner_forest', 'ruin_statue'),
  summoner_marsh: ruin('summoner_marsh', 'ruin_statue'),
  summoner_snow: ruin('summoner_snow', 'ruin_statue'),
  summoner_volcano: ruin('summoner_volcano', 'ruin_statue'),
  // Boss rooms' ruins, one kit per theme (tools/cut_boss_rooms.cjs).
  ...Object.fromEntries((['forest', 'marsh', 'snow', 'volcano'] as const).flatMap((t) =>
    ['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => [`room_${t}_${n}`, ruin(`room_${t}_${n}`, 'ruin_pillar')]))),
  ruin_rubble: ruin('ruin_rubble', 'rock_2'),
  town_stall: ruin('town_stall', 'cart'),
  town_forge: ruin('town_forge', 'cart'),
  town_vault: ruin('town_vault', 'chest'),
  town_market: ruin('town_market', 'town_stall'),
  // The rebuilt town (Terrain.placeTown): paper pictures only, whatever the art switch says (owner 2026-11-18).
  ...Object.fromEntries(['bld_store', 'bld_market', 'bld_forge', 'bld_guild', 'bld_tailor', 'bld_vault', 'bld_house_a', 'bld_house_b',
    'town_fountain', 'quest_board', 'crystal_stall', 'lamp_post', 'bench_a', 'bench_b', 'planter', 'banner_pole', 'crates', 'barrels',
    'flower_box', 'potted_tree', 'low_stall_a', 'low_stall_b', 'garden_bed', 'hedge_a', 'hedge_b', 'house_back_a', 'house_back_b', 'woodpile',
    // The town's statue and wall kit in paper too: the whole town is paper (owner 2026-11-19).
    // Round 6: the rows of townhouses and the market (HUB.md 7).
    ...['vault', 'crystal', 'house_a', 'house_b', 'house_c', 'shop'].flatMap((n) => [`row_l_${n}`, `row_r_${n === 'vault' ? 'guild' : n === 'crystal' ? 'forge' : n}`]),
    'row_left_long', 'row_right_long', 'b3_crystal', 'b3_vault', 'b3_guild', 'b3_forge',
    'mk_goods_front', 'mk_auction_front', 'mk_veg_front',
    ...['main_back', 'wing_front', 'wing_back', 'table', 'cart', 'barrels', 'sacks', 'crates'].map((n) => `ml_${n}`),
    ...['main_back', 'wing_front', 'wing_back', 'table', 'wagon', 'strongbox', 'chests', 'rugs'].map((n) => `mr_${n}`),
    'mk_goods_stall', 'mk_auction_booth', 'mk_veg_stall', 'mk_wagon', 'mk_handcart', 'mk_sacks', 'mk_potion_table', 'mk_tag_table',
    'town_statue', 'town_wall_a', 'town_wall_a_broken', 'town_wall_b', 'town_wall_b_broken', 'town_wall_end',
  ].map((k) => [k, single(`paper/props/${k === 'town_statue' ? 'ruin_statue' : k}.png`, () => drawRock(0))])),
  // Floor 2's Shipwreck Beach props and move effects: paper pictures only.
  ...Object.fromEntries(BEACH_PROPS.map((k) => [k, single(`paper/props/${k}.png`, () => drawRock(0))])),
  ...Object.fromEntries(BEACH_FX.map((k) => [k, single(`paper/fx/${k}.png`, () => drawRunestone())])),
  // Floor 2's harbour town (Terrain.placeHarbor, tools/cut_papercraft.cjs floor2_hub): paper pictures only.
  ...Object.fromEntries(HARBOR_PROPS.map((k) => [k, single(`paper/props/${k}.png`, () => drawRock(0))])),
  // The harbour's NPCs and the navigator (also in nexus_city): paper sheets (src/shared/data/npcs.ts npcLook).
  hb_supply_merchant: sheet('npc/supply_merchant.png', () => makeSheet(32, drawMerchant())),
  hb_dock_keeper: sheet('npc/dock_keeper.png', () => makeSheet(32, drawKeeper())),
  hb_shipwright: sheet('npc/shipwright.png', () => makeSheet(32, drawBlacksmith())),
  hb_harbor_broker: sheet('npc/harbor_broker.png', () => makeSheet(32, drawBroker())),
  hb_smuggler: sheet('npc/smuggler.png', () => makeSheet(32, drawCrystalMerchant())),
  navigator: sheet('npc/navigator.png', () => makeSheet(32, drawSeeker())),

  ...Object.fromEntries(MAP_ICONS.map((name) => [`map_${name}`, single(`icons/map_${name}.png`, () => drawIcon('coin'))])),
  icon_coin: single('icons/coin.png', () => drawIcon('coin')),
  icon_potion_hp: single('icons/potion_hp.png', () => drawIcon('potion_hp')),
  icon_potion_mp: single('icons/potion_mp.png', () => drawIcon('potion_mp')),
  // Painted stones; the placeholder gem is only used if a picture is missing.
  ...Object.fromEntries(STONE_KINDS.map((k) => [`icon_stone_${k}`, single(`icons/stone_${k}.png`, () => drawIcon(`stone_${k}`))])),
  ...Object.fromEntries(ITEM_ART.map((name) => [name, single(`icons/${name}.png`, () => drawIcon('bag'))])),
};

/**
 * Characters with full animation sets. Each folder holds a `sprite.json` (see AnimatedActor's
 * CharManifest) plus one PNG per animation. Missing folder = fall back to the simple 3×3 sheet.
 */
const ANIM_SET_DIRS: Record<string, string> = {
  sword: 'player/sword',
  mage: 'player/mage',
  gunslinger: 'player/gunslinger',
};

export const sheets: Record<string, SheetInfo> = {};
export const animSets: Record<string, AnimSet> = {};
export const assetSources: Record<string, 'file' | 'placeholder'> = {};
export const fxTex = {} as Record<'glow' | 'shadow' | 'propShadow' | 'mist' | 'ring' | 'edge' | 'disc', THREE.Texture>;

/** Hard pixels up close. Big files add mipmaps in loadAssets so they don't shimmer when shrunk. */
function prep(tex: THREE.Texture): void {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
}

function fxTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

/** A character's animation set; with the paper switch on, its paper set (sprites/paper/…) when there is one. */
async function loadCharSet(key: string, dir: string): Promise<void> {
  if (paperMaps && PAPER_CHARS.has(key) && (await loadAnimSet(key, `${BASE}paper/${dir}`))) return;
  await loadAnimSet(key, BASE + dir);
}

/** True when the set loaded (at least its idle animation). */
async function loadAnimSet(key: string, dir: string): Promise<boolean> {
  const set = await fetchAnimSet(key, dir);
  if (!set) return false;
  animSets[key] = set;
  assetSources[`${key} (animations)`] = 'file';
  return true;
}

/**
 * A character's animation set from `sprites/<dir>` (e.g. `player/sword` or `paper/player/sword`) without touching
 * the game's own sets: the /admin animation bench shows the old and the paper pictures side by side.
 */
export function loadCharAnimSet(key: string, dir: string): Promise<AnimSet | null> {
  return fetchAnimSet(key, BASE + dir);
}

async function fetchAnimSet(key: string, dir: string): Promise<AnimSet | null> {
  let manifest: CharManifest;
  try {
    const res = await fetch(`${dir}/sprite.json`);
    if (!res.ok) return null;
    manifest = (await res.json()) as CharManifest;
  } catch {
    return null; // No folder yet (the dev server answers with index.html, which isn't JSON).
  }
  const textures: AnimSet['textures'] = {};
  await Promise.all(
    Object.entries(manifest.animations).map(async ([name, def]) => {
      try {
        const tex = await loadTexture(`${dir}/${def.file}`);
        // High-res painted art is drawn smaller than its source size, so it needs mipmaps
        // when shrunk, or they shimmer. Up close they keep hard pixels like everything else.
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.NearestFilter;
        tex.anisotropy = 4;
        textures[name] = tex;
      } catch {
        console.warn(`[assets] ${key}: missing ${def.file} for animation "${name}"`);
      }
    }),
  );
  if (!textures.idle) {
    console.warn(`[assets] ${key}: sprite.json found but idle animation failed to load — using the simple sheet`);
    return null;
  }
  for (const name of Object.keys(manifest.animations)) if (!textures[name]) delete manifest.animations[name];
  // Which per-facing fixes apply (src/shared/animTuning.ts): `class.old` or `class.paper`.
  return { manifest, textures, tuneKey: `${key}.${dir.includes('paper/') ? 'paper' : 'old'}` };
}

/** Repeating ground textures. A zone falls back to its code-painted ground if one is missing. */
export type GroundTile = 'grass' | 'dirt' | 'water' | 'marsh' | 'mud' | 'pave' | 'brick' | 'snow' | 'snow_path' | 'ice' | 'ash_rock' | 'ash_path' | 'lava'
  | 'room_forest' | 'room_marsh' | 'room_snow' | 'room_volcano' | 'harbor_plank' | 'harbor_plaza' | 'harbor_water'
  // Floor 2's Shipwreck Beach (paper only).
  | 'sand' | 'wreck' | 'shallow' | 'room_beach'
  // Floor 2's cloud-sea backdrop (FLOOR2_SKY.md), once the owner has made it; until then island.ts paintSky.
  | 'sky_day';
export const groundTiles: Partial<Record<GroundTile, THREE.Texture>> = {};

/** Ground tiles that exist only as paper (floor 2's): loaded from sprites/paper/ground/ whatever the art switch says. */
const PAPER_ONLY_GROUND = new Set<string>(['harbor_plank', 'harbor_plaza', 'harbor_water', 'sky_day', 'sand', 'wreck', 'shallow', 'room_beach']);

async function loadGroundTile(name: GroundTile): Promise<void> {
  try {
    const old = PAPER_ONLY_GROUND.has(name) ? `${BASE}paper/ground/${name}.png` : `${BASE}ground/${name}.png`;
    const tex = paperMaps && PAPER_GROUND.has(name)
      ? await loadTexture(`${BASE}paper/ground/${name}.png`).catch(() => loadTexture(old))
      : await loadTexture(old);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    groundTiles[name] = tex;
  } catch {
    // The cloud-sea tile isn't made yet (FLOOR2_SKY.md): island.ts paints a stand-in, nothing to warn about.
    if (name !== 'sky_day') console.warn(`[assets] missing ground tile "${name}"`);
  }
}

/** Skill animation sheets, one per class: 6 frames across, one effect per row. */
export type FxSheet = 'sword' | 'mage' | 'gun' | 'gun_ult' | 'enhance'
  // Sword skill lines (2026-11-15): Blade, Gale, Bulwark.
  | 'sw_blade' | 'sw_gale' | 'sw_bulwark'
  // Mage skills and passive auras (owner 2026-11-15)
  | 'mg_a' | 'mg_b' | 'mg_c' | 'mg_d' | 'mg_e' | 'mg_f' | 'mg_g'
  // Gunslinger skills (art_templates/skills/FX_GUNSLINGER.md)
  | 'gs_skill' | 'gs_gear' | 'gs_passive'
  // Area skills' standing layer (zoneProps.ts, art_templates/skills/AOE_PROPS.md); missing ones just aren't drawn.
  | PropSheet;
export const fxSheets: Partial<Record<FxSheet, THREE.Texture>> = {};

async function loadFxSheet(name: FxSheet): Promise<void> {
  try {
    const old = `${BASE}fx/${name}.png`;
    // Papercraft effects (tools/cut_paper_fx.cjs), the old sheet when there is no paper one.
    const tex = paperMaps ? await loadTexture(`${BASE}paper/fx/${name}.png`).catch(() => loadTexture(old)) : await loadTexture(old);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    fxSheets[name] = tex;
  } catch {
    console.warn(`[assets] missing effect sheet "${name}"`);
  }
}

/**
 * Paper cosmetics drawn in code (tools/cut_paper_extras.cjs), loaded only with the paper switch on: per aura the ring
 * laid under the character and one footprint, and the white enhancement-orb atlas the orbs are tinted from.
 */
export const paperTex: { auras: Record<string, { ring: THREE.Texture; foot: THREE.Texture }>; orbs?: THREE.Texture } = { auras: {} };

async function loadPaperCosmetics(): Promise<void> {
  const smooth = (t: THREE.Texture, srgb = true): THREE.Texture => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  };
  await Promise.all([
    ...COSMETICS.filter((c) => c.slot === 'aura').map(async (c) => {
      try {
        const [ring, foot] = await Promise.all([loadTexture(`${BASE}paper/fx/${c.id}_ring.png`), loadTexture(`${BASE}paper/fx/${c.id}_foot.png`)]);
        paperTex.auras[c.id] = { ring: smooth(ring), foot: smooth(foot) };
      } catch {
        // No paper picture: the old glow.
      }
    }),
    // Raw greys: the orb shader reads them as they are in the file (like its code-made atlas).
    loadTexture(`${BASE}paper/fx/orbs.png`).then((t) => { paperTex.orbs = smooth(t, false); }, () => undefined),
  ]);
}

/** Ground decals laid flat under things. `death_crater` is colourless shade, so the map's ground shows through. */
export const decalTex: { deathCrater?: THREE.Texture } = {};

async function loadDecals(): Promise<void> {
  try {
    const tex = await loadTexture(`${BASE}fx/death_crater.png`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    decalTex.deathCrater = tex;
  } catch {
    console.warn('[assets] missing death crater');
  }
}

// ------------------------------------------------------------ loading

/** One game file for the loading bar. `size` is null until its response headers arrive. */
interface Download {
  loaded: number;
  size: number | null;
}
const downloads: Download[] = [];
let bestProgress = 0;
const progressListeners = new Set<(fraction: number) => void>();

/**
 * Bytes received over bytes expected. Files whose size isn't known yet (still queued in the
 * browser) count as the average known size. A few big files dominate the download, so counting
 * files instead would leave the bar standing still for most of it.
 */
function reportProgress(): void {
  let loaded = 0;
  let known = 0;
  let knownCount = 0;
  for (const d of downloads) {
    loaded += d.loaded;
    if (d.size !== null) {
      known += d.size;
      knownCount++;
    }
  }
  const avg = knownCount ? known / knownCount : 1;
  const total = known + (downloads.length - knownCount) * avg;
  // Animation files join once their sprite.json arrives, so never let the bar go back.
  bestProgress = Math.max(bestProgress, total ? Math.min(1, loaded / total) : 0);
  for (const fn of progressListeners) fn(bestProgress);
}

/** Every texture made from a file, so the first entry can send them all to the GPU behind the loading screen. */
const fileTextures: THREE.Texture[] = [];

/** Uploads every loaded texture to the GPU now, instead of one by one the first time each is drawn. */
export function uploadAllTextures(renderer: THREE.WebGLRenderer): void {
  for (const t of fileTextures) renderer.initTexture(t);
}

/** Like THREE.TextureLoader.loadAsync, but counts the bytes as they arrive for the loading bar. */
async function loadTexture(url: string): Promise<THREE.Texture> {
  const d: Download = { loaded: 0, size: null };
  downloads.push(d);
  try {
    const res = await fetch(imgUrl(url));
    if (!res.ok || !res.body) throw new Error(`missing ${url}`);
    d.size = Number(res.headers.get('content-length')) || null;
    const chunks: Uint8Array[] = [];
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      d.loaded += value.length;
      reportProgress();
    }
    const blobUrl = URL.createObjectURL(new Blob(chunks, { type: res.headers.get('content-type') ?? 'image/png' }));
    try {
      // Decode errors (e.g. the dev server's index.html for a missing file) reject here.
      const tex = new THREE.Texture(await loadImage(blobUrl));
      tex.needsUpdate = true;
      fileTextures.push(tex);
      return tex;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } finally {
    d.size = d.loaded;
    reportProgress();
  }
}

/** Calls `fn` with the game assets' progress (0..1) now and as bytes arrive; returns an unsubscribe. */
export function onAssetProgress(fn: (fraction: number) => void): () => void {
  progressListeners.add(fn);
  fn(bestProgress);
  return () => progressListeners.delete(fn);
}

let gameLoad: Promise<void> | null = null;
let gameLoaded = false;

/** Starts loading every game texture (once) and resolves when they are all ready. */
export function loadGameAssets(): Promise<void> {
  gameLoad ??= loadAssets().then(() => {
    gameLoaded = true;
  });
  return gameLoad;
}

export const gameAssetsReady = (): boolean => gameLoaded;

/** First frame of a class's front view, for menu portraits. Ready before the game assets are. */
export interface PortraitSource {
  img: CanvasImageSource;
  cw: number;
  ch: number;
  /** The square of the first cell to draw (x, y, side), when not the whole cell: the paper cells are wider, with room around. */
  crop?: [number, number, number];
}
const portraitSources: Record<string, PortraitSource> = {};
let menuLoad: Promise<void> | null = null;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error(`missing ${url}`));
    img.src = imgUrl(url);
  });
}

async function loadPortrait(key: string): Promise<void> {
  const base = ANIM_SET_DIRS[key];
  // With the art switch on, the menu's class pictures are the paper ones too (owner 2026-11-18). Waits for the server's
  // answer; the cards fill in when it comes.
  const paper = base && PAPER_CHARS.has(key) && (await paperAnswer);
  for (const dir of paper ? [`paper/${base}`, base] : base ? [base] : []) {
    try {
      const res = await fetch(`${BASE}${dir}/sprite.json`);
      const m = (await res.json()) as CharManifest;
      const idle = m.animations.idle;
      const img = await loadImage(`${BASE}${dir}/${idle.file}`);
      const cw = idle.frameWidth ?? m.frameWidth;
      const ch = idle.frameHeight ?? m.frameHeight;
      // A cell bigger than the body's own (the paper cut: 384 × 320 around a 256 body): the 256 square standing on the
      // cell's feet line, so the character fills the card as before instead of shrinking.
      const side = Math.min(cw, ch, m.frameHeight);
      const feet = idle.feet ?? m.feet;
      const crop: [number, number, number] | undefined = side < cw || side < ch
        ? [(cw - side) / 2, Math.max(0, ch * (1 - feet) - side * (1 - m.feet)), side] : undefined;
      portraitSources[key] = { img, cw, ch, crop };
      return;
    } catch {
      // No full set: same fallback as the game, the simple sheet below.
    }
  }
  const spec = SHEET_SPECS[key];
  let img: HTMLImageElement | HTMLCanvasElement;
  let rows = spec.rows;
  try {
    img = await loadImage(spec.path);
    rows = spec.fileRows ?? spec.rows;
  } catch {
    img = spec.placeholder();
  }
  portraitSources[key] = { img, cw: img.width / spec.cols, ch: img.height / rows };
}

/** Loads only what the title menu draws itself: the class portraits (a few MB instead of the whole game). */
export function loadMenuAssets(classKeys: readonly string[]): Promise<void> {
  menuLoad ??= Promise.all(classKeys.map(loadPortrait)).then(() => undefined);
  return menuLoad;
}

export function portraitSource(key: string): PortraitSource | undefined {
  return portraitSources[key];
}

async function loadAssets(): Promise<void> {
  paperMaps = await paperAnswer;
  // Paper monsters (tools/cut_paper_monsters.cjs): which ones exist, and how much taller each picture is drawn.
  const paperMonsters: Record<string, { scale: number }> = paperMaps
    ? await fetch(`${BASE}paper/monsters/meta.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    : {};
  // Everything at once: the files don't depend on each other.
  await Promise.all([
    ...(['sword', 'mage', 'gun', 'gun_ult', 'enhance', 'sw_blade', 'sw_gale', 'sw_bulwark', 'mg_a', 'mg_b', 'mg_c', 'mg_d', 'mg_e', 'mg_f', 'mg_g'] as const).map((n) => loadFxSheet(n)),
    ...PROP_SHEETS.map((n) => loadFxSheet(n)),
    // Gunslinger
    ...(['gs_skill', 'gs_gear', 'gs_passive'] as const).map((n) => loadFxSheet(n)),
    loadDecals(),
    ...(paperMaps ? [loadPaperCosmetics()] : []),
    ...(['grass', 'dirt', 'water', 'marsh', 'mud', 'pave', 'brick', 'snow', 'snow_path', 'ice', 'ash_rock', 'ash_path', 'lava',
      'room_forest', 'room_marsh', 'room_snow', 'room_volcano', 'harbor_plank', 'harbor_plaza', 'harbor_water', 'sky_day',
      'sand', 'wreck', 'shallow', 'room_beach'] as const).map((n) => loadGroundTile(n)),
    ...Object.entries(ANIM_SET_DIRS).map(([key, dir]) => loadCharSet(key, dir)),
    ...Object.entries(SHEET_SPECS).map(async ([key, spec]) => {
      let tex: THREE.Texture;
      let sideFaces = spec.fileSideFaces;
      let rows = spec.rows;
      let cols = spec.cols;
      let paperMonster: SheetInfo['paper'];
      let idleFrames: number | undefined;
      try {
        const monster = paperMonsters[key];
        // Floor 2's NPC sheets exist only as paper: from sprites/paper/npc/ whatever the art switch says.
        const npcPaper = (paperMaps || PAPER_ONLY_NPC.has(key)) && spec.path.startsWith(`${BASE}npc/`) ? spec.path.replace(`${BASE}npc/`, `${BASE}paper/npc/`) : null;
        if (npcPaper && (tex = await loadTexture(npcPaper).catch(() => null as unknown as THREE.Texture))) {
          // Paper NPCs (art_templates/papercraft_chars/NPC.md): 3 views × 4 breathing frames.
          cols = 4;
          idleFrames = 4;
        } else if (monster) {
          tex = await loadTexture(`${BASE}paper/monsters/${key}.png`);
          paperMonster = { walk: 4, attack: 4, scale: monster.scale };
          cols = 8;
        } else {
          // Cosmetics (wings, mounts, pets, single wings: tools/cut_cosmetics.cjs with COS_PAPER=1) have a paper copy
          // of the same name under sprites/paper/cosmetics/.
          const paper = !paperMaps ? null
            : PAPER_PROPS.has(key) ? `${BASE}paper/props/${key}.png`
            : spec.path.startsWith(`${BASE}cosmetics/`) ? spec.path.replace(`${BASE}cosmetics/`, `${BASE}paper/cosmetics/`)
            : spec.path.startsWith(`${BASE}fx/`) ? spec.path.replace(`${BASE}fx/`, `${BASE}paper/fx/`)
            : null;
          tex = await (paper ? loadTexture(paper).catch(() => loadTexture(spec.path)) : loadTexture(spec.path))
            .catch((e) => (spec.standIn ? loadTexture(spec.standIn) : Promise.reject(e)));
        }
        assetSources[key] = 'file';
        rows = spec.fileRows ?? spec.rows;
      } catch {
        tex = new THREE.CanvasTexture(spec.placeholder());
        sideFaces = 'right';
        assetSources[key] = 'placeholder';
      }
      prep(tex);
      const img = tex.image as { width: number; height: number };
      // Big painted files (e.g. the marsh art) are drawn smaller than their source, so they need
      // mipmaps or they shimmer. Small pixel-art keeps the crisp nearest-pixel look.
      if (assetSources[key] === 'file' && img.height / rows > 72) {
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
      }
      sheets[key] = {
        texture: tex,
        cols,
        rows,
        sideFaces,
        cellAspect: img.width / cols / (img.height / rows),
        ...(paperMonster ? { paper: paperMonster } : {}),
        ...(idleFrames ? { idleFrames } : {}),
      };
    }),
  ]);
  const band = (d: number, steps: [number, number][]) => steps.find(([edge]) => d <= edge)?.[1] ?? 0;
  fxTex.glow = fxTexture(pixelCircle(32, '255,255,255', (d) => band(d, [[0.3, 1], [0.55, 0.6], [0.78, 0.28], [1, 0.1]])));
  fxTex.shadow = fxTexture(pixelCircle(32, '0,0,0', (d) => band(d, [[0.72, 0.85], [1, 0.42]])));
  // Props are many times wider than an actor, so the 32px banded shadow turned into big stair steps
  // under them. Theirs fades smoothly instead: solid in the middle, soft at the rim.
  fxTex.propShadow = fxTexture(pixelCircle(64, '0,0,0', (d) => (d >= 1 ? 0 : Math.min(1, (1 - d) / 0.45))));
  fxTex.propShadow.magFilter = fxTex.propShadow.minFilter = THREE.LinearFilter;
  // Smooth rather than dithered: mist sprites are far bigger than their texture, so a dither
  // shows up as a screen-door grid over the ground.
  fxTex.mist = fxTexture(pixelCircle(128, '255,255,255', (d) => (1 - d) * (1 - d)));
  fxTex.mist.magFilter = fxTex.mist.minFilter = THREE.LinearFilter;
  fxTex.ring = fxTexture(pixelCircle(128, '255,255,255', (d) => (d >= 0.82 && d <= 1 ? 1 : 0)));
  fxTex.edge = fxTexture(pixelCircle(128, '255,255,255', (d) => (d >= 0.94 && d <= 1 ? 1 : 0)));
  fxTex.disc = fxTexture(pixelCircle(128, '255,255,255', (d) => (d <= 1 ? 1 : 0)));
}
