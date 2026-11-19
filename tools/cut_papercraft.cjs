// Cuts the papercraft map sheets in art_templates/papercraft_maps/raw/<map>/ into the game's paper sprite files,
// public/assets/sprites/paper/{props,ground}/, with the same names and sizes as the old art they stand in for
// (see art_templates/papercraft_maps/PROMPTS.md). Usage: node tools/cut_papercraft.cjs map1_forest
// (floor 2: floor2_hub, floor2_m1 … floor2_m4)
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { keyBg, trackedSprites } = require('./paper_key.cjs');

const ROOT = path.join(__dirname, '..');
const OLD = path.join(ROOT, 'public/assets/sprites');
const OUT = path.join(ROOT, 'public/assets/sprites/paper');

/** Every map's sheets: [raw file, kind, options]. */
const MAPS = {
  map1_forest: [
    ['props.png', 'props', { cols: 4, rows: 3, names: ['tree_0', 'tree_1', 'tree_2', 'stump_tall', 'bush_0', 'bush_1', 'bush_2', 'stump', 'rock_0', 'rock_1', 'rock_2', 'pebble_0'], extra: [['pebble_1', 9]] }],
    ['camp.png', 'props', { cols: 4, rows: 3, names: ['tent', 'campfire', 'sign', 'portal', 'runestone', 'well', 'barrel', 'chest', 'cart', 'banner_red', 'flag', 'watchtower'] }],
    ['room_props.png', 'props', { cols: 4, rows: 2, names: ['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_forest_${n}`) }],
    ['decor.png', 'atlas', { cols: 4, rows: 3, out: 'decor_forest', cell: [128, 128], place: 'bottom', fit: 'shared' }],
    ['island_cliff.png', 'atlas', { cols: 4, rows: 2, out: 'island_cliff_forest', cell: [384, 384], place: 'top', fit: 'each' }],
    ['island_slabs.png', 'atlas', { cols: 4, rows: 2, out: 'island_slabs_forest', place: 'centre', fit: 'shared' }],
    ['island_debris.png', 'atlas', { cols: 4, rows: 3, out: 'island_debris', place: 'centre', fit: 'rows' }],
    ['island_cracks.png', 'atlas', { cols: 4, rows: 2, out: 'island_cracks', place: 'centre', fit: 'each' }],
    ['ground_grass.png', 'ground', { out: 'grass' }],
    ['ground_dirt.png', 'ground', { out: 'dirt' }],
    ['ground_pave.png', 'ground', { out: 'pave' }],
    ['ground_room.png', 'ground', { out: 'room_forest' }],
  ],
  map2_marsh: [
    // The 12th cell is a spare (the portal moved to the camp sheet).
    ['props.png', 'props', { cols: 4, rows: 3, names: ['swamp_tree_0', 'swamp_tree_1', 'swamp_tree_2', 'willow', 'reeds_0', 'reeds_1', 'fern', 'mushrooms', 'mossrock_0', 'mossrock_1', 'swamp_stump'] }],
    ['room_props.png', 'props', { cols: 4, rows: 2, names: ['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_marsh_${n}`) }],
    ['decor.png', 'atlas', { cols: 4, rows: 3, out: 'decor_marsh', place: 'bottom', fit: 'shared' }],
    ['planks.png', 'planks', { out: 'marsh_planks', cols: 3, aspect: 2.9 / 5, inner: [0.17, 0.83] }],
    ['island_cliff.png', 'atlas', { cols: 4, rows: 2, out: 'island_cliff_marsh', place: 'top', fit: 'each' }],
    ['island_slabs.png', 'atlas', { cols: 4, rows: 2, out: 'island_slabs_marsh', place: 'centre', fit: 'shared' }],
    ['ground_marsh.png', 'ground', { out: 'marsh' }],
    ['ground_mud.png', 'ground', { out: 'mud' }],
    ['ground_water.png', 'ground', { out: 'water' }],
    ['ground_room.png', 'ground', { out: 'room_marsh' }],
  ],
  map3_snow: [
    ['props.png', 'props', { cols: 4, rows: 3, names: ['snow_pine_0', 'snow_pine_1', 'snow_pine_2', 'frost_tree', 'snow_shrub_0', 'snow_shrub_1', 'frost_fern', 'snow_stump', 'snow_rock_0', 'snow_rock_1', 'ice_crystal_0', 'ice_crystal_1'] }],
    ['room_props.png', 'props', { cols: 4, rows: 2, names: ['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_snow_${n}`) }],
    // Cells 6-8 lie flat on the ground (world.ts DECOR.snow.flat), so they sit in the middle of their cell.
    ['decor.png', 'atlas', { cols: 4, rows: 3, out: 'decor_snow', place: 'bottom', fit: 'shared', flat: [6, 7, 8] }],
    ['island_cliff.png', 'atlas', { cols: 4, rows: 2, out: 'island_cliff_snow', place: 'top', fit: 'each' }],
    ['island_slabs.png', 'atlas', { cols: 4, rows: 2, out: 'island_slabs_snow', place: 'centre', fit: 'shared' }],
    ['ground_snow.png', 'ground', { out: 'snow' }],
    ['ground_snow_path.png', 'ground', { out: 'snow_path' }],
    ['ground_ice.png', 'ground', { out: 'ice' }],
    ['ground_room.png', 'ground', { out: 'room_snow' }],
  ],
  map4_volcano: [
    ['props.png', 'props', { cols: 4, rows: 3, names: ['burnt_pillar_0', 'burnt_pillar_1', 'burnt_pillar_2', 'charred_tree', 'ash_shrub_0', 'ash_shrub_1', 'ember_fern', 'charred_stump', 'basalt_0', 'basalt_1', 'magma_crystal_0', 'magma_crystal_1'] }],
    ['room_props.png', 'props', { cols: 4, rows: 2, names: ['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_volcano_${n}`) }],
    ['decor.png', 'atlas', { cols: 4, rows: 3, out: 'decor_volcano', place: 'bottom', fit: 'shared', flat: [6, 7, 8] }],
    ['island_cliff.png', 'atlas', { cols: 4, rows: 2, out: 'island_cliff_volcano', place: 'top', fit: 'each' }],
    ['island_slabs.png', 'atlas', { cols: 4, rows: 2, out: 'island_slabs_volcano', place: 'centre', fit: 'shared' }],
    ['ground_ash_rock.png', 'ground', { out: 'ash_rock' }],
    ['ground_ash_path.png', 'ground', { out: 'ash_path' }],
    ['ground_lava.png', 'ground', { out: 'lava' }],
    ['ground_room.png', 'ground', { out: 'room_volcano' }],
  ],
  hub: [
    ['town.png', 'props', { cols: 5, rows: 2, names: ['ruin_fountain', 'ruin_statue', 'ruin_pillar', 'ruin_house', 'ruin_tower', 'ruin_rubble', 'town_stall', 'town_forge', 'town_vault', 'town_market'] }],
    // Walls are stretched to the old pictures' exact size: terrain.ts lines copies up by those pixel sizes. The 6th cell is a spare.
    ['walls.png', 'props', { cols: 3, rows: 2, exact: true, names: ['town_wall_a', 'town_wall_a_broken', 'town_wall_end', 'town_wall_b', 'town_wall_b_broken'] }],
    ['summoners.png', 'props', { cols: 2, rows: 2, names: ['summoner_forest', 'summoner_marsh', 'summoner_snow', 'summoner_volcano'] }],
    ['ground_brick.png', 'ground', { out: 'brick' }],
    // The rebuilt town (owner 2026-11-18, hub_redesign/HUB_REDESIGN.md): new pictures with no old file, so each gets a
    // fixed height. Sheet B is on green (the tailor's cloth is pink).
    ['town2_buildings_a.png', 'props', { cols: 2, rows: 2, height: 384, names: ['bld_store', 'bld_market', 'bld_forge', 'bld_guild'] }],
    ['town2_buildings_b.png', 'props', { cols: 2, rows: 2, height: 384, bg: 'green', names: ['bld_tailor', 'bld_vault', 'bld_house_a', 'bld_house_b'] }],
    // Round 6 (owner 2026-11-19, HUB.md 7): attached townhouses for the two top walls, and the bottom market.
    ['row_left.png', 'props', { cols: 3, rows: 2, height: 448, names: ['row_l_vault', 'row_l_crystal', 'row_l_house_a', 'row_l_house_b', 'row_l_house_c', 'row_l_shop'] }],
    ['row_right.png', 'props', { cols: 3, rows: 2, height: 448, names: ['row_r_guild', 'row_r_forge', 'row_r_house_a', 'row_r_house_b', 'row_r_house_c', 'row_r_shop'] }],
    ['market.png', 'props', { cols: 4, rows: 2, height: 256, names: ['mk_goods_front', 'mk_auction_front', 'mk_veg_front', 'mk_wagon', 'mk_handcart', 'mk_sacks', 'mk_potion_table', 'mk_tag_table'] }],
    // The three stalls again, seen from behind (facing away from the camera); market.png has their fronts (*_front).
    ['market_backs.png', 'props', { cols: 3, rows: 1, height: 256, slope: true, names: ['mk_goods_stall', 'mk_auction_booth', 'mk_veg_stall'] }],
    // Round 6b (owner 2026-11-19): each top wall's whole row of attached townhouses as one picture, sheared so its foot
    // runs at the game's own slope for a world axis (World ISO_DIR), like the walls (HUB.md 7.5).
    ['row_left_long.png', 'strip', { out: 'row_left_long', rise: true, width: 1600 }],
    ['row_right_long.png', 'strip', { out: 'row_right_long', rise: false, width: 1600 }],
    // The four NPC buildings against the top walls (owner 2026-11-19, HUB.md 7.7): crystal shop and vault open to the
    // lower right, guild hall and forge to the lower left.
    ['town3_buildings.png', 'props', { cols: 2, rows: 2, height: 384,
      // The forge's puff of smoke reaches up between the vault and the row above it: blanked before cutting.
      erase: [[1070, 555, 1215, 645], [0, 589, 1305, 598]], names: ['b3_crystal', 'b3_vault', 'b3_guild', 'b3_forge'] }],
    // Each seller's own half-ellipse of stalls (HUB.md 7.6): main stall from behind, a wing stall from the front and one
    // from behind, a table, then four odds and ends.
    ['market_left.png', 'props', { cols: 4, rows: 2, height: 256, names: ['ml_main_back', 'ml_wing_front', 'ml_wing_back', 'ml_table', 'ml_cart', 'ml_barrels', 'ml_sacks', 'ml_crates'] }],
    ['market_right.png', 'props', { cols: 4, rows: 2, height: 256, names: ['mr_main_back', 'mr_wing_front', 'mr_wing_back', 'mr_table', 'mr_wagon', 'mr_strongbox', 'mr_chests', 'mr_rugs'] }],
    // Low things along the bottom two walls (HUB.md 6): skipped until the sheet is there.
    ['town2_low.png', 'props', { cols: 4, rows: 2, height: 256, names: ['low_stall_a', 'low_stall_b', 'garden_bed', 'hedge_a', 'hedge_b', 'house_back_a', 'house_back_b', 'woodpile'] }],
    ['town2_props.png', 'props', { cols: 4, rows: 3, height: 256, names: ['town_fountain', 'quest_board', 'crystal_stall', 'lamp_post', 'bench_a', 'bench_b', 'planter', 'banner_pole', 'crates', 'barrels', 'flower_box', 'potted_tree'] }],
  ],
  // Floor 2 (art_templates/papercraft_maps/FLOOR2_*.md). New pictures with no old file: props get a fixed height
  // (`share`: one scale for the whole sheet, its tallest piece that tall, for pieces that must match each other),
  // atlases floor 1's sizes. Names that clashed with floor 1 or between maps were renamed (owner 2026-11-19).
  // The background is measured from each sheet's border, so green and off-magenta sheets key the same way.
  floor2_hub: [
    ['buildings_a.png', 'props', { cols: 2, rows: 2, height: 384, names: ['bld_supply', 'bld_broker', 'bld_shipforge', 'bld_warehouse'] }],
    ['buildings_b.png', 'props', { cols: 2, rows: 2, height: 384, names: ['bld_smuggler', 'bld_lighthouse', 'bld_shipyard', 'moored_dinghy'] }],
    ['props.png', 'props', { cols: 4, rows: 3, height: 256, names: ['wheel_fountain', 'brass_globe', 'harbor_lamp', 'harbor_flagpole', 'dock_bench_a', 'dock_bench_b', 'bunting_post', 'cask_stack', 'cargo_crates', 'sacks', 'hawser_coil', 'palm_pot'] }],
    // The two pier directions must keep the same width and thickness: one scale for the sheet.
    ['docks.png', 'props', { cols: 4, rows: 2, share: 256, names: ['dock_a', 'dock_b', 'dock_end', 'bollard', 'rail_a', 'rail_b', 'edge_a', 'edge_b'] }],
    ['ships.png', 'props', { cols: 2, rows: 2, height: 384, names: ['ship_red', 'ship_blue', 'ship_green', 'ship_white'] }],
    ['water.png', 'props', { cols: 3, rows: 2, share: 256, names: ['falls_a', 'falls_b', 'foam_post', 'wave', 'float_barrel', 'gull_post'] }],
    ['portals.png', 'props', { cols: 3, rows: 1, height: 256, names: ['portal_dock', 'portal_return', 'portal_floor2'] }],
    ['ground_plank.png', 'ground', { out: 'plank' }],
    ['ground_plaza.png', 'ground', { out: 'plaza' }],
    ['ground_water.png', 'ground', { out: 'harbor_water' }],
  ],
  floor2_m1: [
    ['props.png', 'props', { cols: 4, rows: 3, height: 256, names: ['coconut_palm_0', 'coconut_palm_1', 'coconut_palm_2', 'wreck_hull', 'torn_sail_mast', 'sea_rock_0', 'sea_rock_1', 'rock_pillar', 'hibiscus', 'tropical_fern', 'giant_clam', 'broken_ladder'] }],
    ['camp.png', 'props', { cols: 4, rows: 3, height: 256, names: ['treasure_chest', 'wreck_crates', 'salvage_barrel', 'brass_lantern', 'plank_pile', 'stuck_anchor', 'beached_rowboat', 'old_cannon', 'driftwood_sign', 'skull_flag', 'tide_pool', 'coin_pile'] }],
    ['room_props.png', 'props', { cols: 3, rows: 3, height: 256, names: ['summoner_crab', ...['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'rune_stone', 'tree'].map((n) => `room_beach_${n}`)] }],
    ['decor.png', 'atlas', { cols: 4, rows: 3, out: 'decor_beach', size: [512, 384], place: 'bottom', fit: 'shared' }],
    ['island_cliff.png', 'atlas', { cols: 4, rows: 2, out: 'island_cliff_beach', size: [1536, 768], place: 'top', fit: 'each' }],
    ['island_slabs.png', 'atlas', { cols: 4, rows: 2, out: 'island_slabs_beach', size: [887, 443], place: 'centre', fit: 'shared' }],
    ['fx.png', 'props', { cols: 3, rows: 2, dir: 'fx', box: 256, see: true, names: ['fx_cannonball', 'fx_warn_ring', 'fx_chain_bolt', 'fx_shock', 'fx_spike_burst', 'fx_shell_guard'] }],
    ['ground_sand.png', 'ground', { out: 'sand' }],
    ['ground_wreck.png', 'ground', { out: 'wreck' }],
    ['ground_shallow.png', 'ground', { out: 'shallow' }],
    ['ground_room.png', 'ground', { out: 'room_beach' }],
  ],
  floor2_m2: [
    ['props.png', 'props', { cols: 4, rows: 3, height: 256, names: ['cliff_palm_0', 'cliff_palm_1', 'cliff_rock_0', 'cliff_rock_1', 'cliff_rock_2', 'cave_mouth', 'tent_0', 'tent_1', 'stilt_hut', 'small_falls', 'thicket_0', 'thicket_1'] }],
    ['camp.png', 'props', { cols: 4, rows: 3, height: 256, names: ['powder_keg', 'smuggled_crates', 'rum_barrel', 'pirate_lantern', 'wanted_board', 'cliff_cannon', 'cannonball_pile', 'smuggler_flag', 'cargo_net', 'bottles', 'loot_chest', 'pirate_boat'] }],
    ['room_props.png', 'props', { cols: 3, rows: 3, height: 256, names: ['summoner_captain', ...['gunboat', 'wall', 'brazier', 'boulder', 'pillar', 'rubble', 'mast', 'tree'].map((n) => `room_cove_${n}`)] }],
    ['decor.png', 'atlas', { cols: 4, rows: 3, out: 'decor_cove', size: [512, 384], place: 'bottom', fit: 'shared' }],
    ['island_cliff.png', 'atlas', { cols: 4, rows: 2, out: 'island_cliff_cove', size: [1536, 768], place: 'top', fit: 'each' }],
    ['island_slabs.png', 'atlas', { cols: 4, rows: 2, out: 'island_slabs_cove', size: [887, 443], place: 'centre', fit: 'shared' }],
    ['fx.png', 'props', { cols: 4, rows: 2, dir: 'fx', box: 256, see: true, names: ['fx_iron_ball', 'fx_bomb', 'fx_explosion', 'fx_anchor', 'fx_pellets', 'fx_shout_ring', 'fx_parrot_mark', 'fx_ship_shell'] }],
    ['ground_rock.png', 'ground', { out: 'rock' }],
    ['ground_boardwalk.png', 'ground', { out: 'boardwalk' }],
    ['ground_cove_water.png', 'ground', { out: 'cove_water' }],
    ['ground_room.png', 'ground', { out: 'room_cove' }],
  ],
  floor2_m3: [
    ['props.png', 'props', { cols: 4, rows: 3, height: 256, names: ['wreck_hull_0', 'wreck_hull_1', 'ghost_mast', 'bell_mast', 'mossy_rock_0', 'mossy_rock_1', 'ghost_lamp_post', 'slime_post', 'wreck_small', 'rotten_stump', 'broken_rail', 'figurehead'] }],
    ['camp.png', 'props', { cols: 4, rows: 3, height: 256, names: ['candles', 'skull_barrel', 'skull_pile', 'net', 'rotten_chest', 'rusty_anchor', 'green_lantern', 'grave_marker', 'torn_flag', 'rope_coil', 'spirit_bottle', 'fallen_bell'] }],
    ['room_props.png', 'props', { cols: 3, rows: 3, height: 256, names: ['summoner_ghost', ...['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'mast', 'figurehead'].map((n) => `room_grave_${n}`)] }],
    ['decor.png', 'atlas', { cols: 4, rows: 3, out: 'decor_graveyard', size: [512, 384], place: 'bottom', fit: 'shared' }],
    ['island_cliff.png', 'atlas', { cols: 4, rows: 2, out: 'island_cliff_graveyard', size: [1536, 768], place: 'top', fit: 'each' }],
    ['island_slabs.png', 'atlas', { cols: 4, rows: 2, out: 'island_slabs_graveyard', size: [887, 443], place: 'centre', fit: 'shared' }],
    ['fx.png', 'props', { cols: 4, rows: 2, dir: 'fx', box: 256, see: true, names: ['fx_ghost_skull', 'fx_curse_ring', 'fx_music_notes', 'fx_siren_pull', 'fx_mist', 'fx_bell_waves', 'fx_spirit_puff', 'fx_shell_burst'] }],
    ['ground_stone.png', 'ground', { out: 'stone' }],
    ['ground_rotten_deck.png', 'ground', { out: 'rotten_deck' }],
    ['ground_misty_water.png', 'ground', { out: 'misty_water' }],
    ['ground_room.png', 'ground', { out: 'room_grave' }],
  ],
  floor2_m4: [
    ['props.png', 'props', { cols: 4, rows: 3, height: 256, names: ['storm_rock_0', 'storm_rock_1', 'storm_rock_2', 'wreck_0', 'wreck_1', 'broken_mast', 'coral_0', 'coral_1', 'kraken_flag', 'storm_lamp', 'rope_post', 'storm_anchor'] }],
    // This sheet came with 10 pieces, two altars in the top row (owner 2026-11-19: the tentacle altar with the eye is the
    // summoner, the flagged portal gate is kept as an extra piece): `cols` per row.
    ['room_props.png', 'props', { cols: [4, 3, 3], rows: 3, height: 256, names: ['room_kraken_gate', 'summoner_kraken', ...['pillar_0', 'wall', 'brazier', 'boulder', 'pillar_1', 'rubble', 'coral', 'mast'].map((n) => `room_kraken_${n}`)] }],
    ['decor.png', 'atlas', { cols: 4, rows: 3, out: 'decor_maelstrom', size: [512, 384], place: 'bottom', fit: 'shared' }],
    ['island_cliff.png', 'atlas', { cols: 4, rows: 2, out: 'island_cliff_maelstrom', size: [1536, 768], place: 'top', fit: 'each' }],
    ['island_slabs.png', 'atlas', { cols: 4, rows: 2, out: 'island_slabs_maelstrom', size: [887, 443], place: 'centre', fit: 'shared' }],
    ['fx.png', 'props', { cols: 4, rows: 2, dir: 'fx', box: 256, see: true, names: ['fx_shark_fin', 'fx_bubble', 'fx_bubble_trap', 'fx_sword_wave', 'fx_ink_blob', 'fx_ink_splat', 'fx_suction', 'fx_slam_splash'] }],
    // The whirlpool's four layers (FLOOR2_M4_WHIRLPOOL.md): squares centred on the circle, sized as they stack.
    ['whirlpool_ring_1.png', 'disc', { out: 'whirlpool_ring_1', size: 1024 }],
    ['whirlpool_ring_2.png', 'disc', { out: 'whirlpool_ring_2', size: 768 }],
    ['whirlpool_ring_3.png', 'disc', { out: 'whirlpool_ring_3', size: 512 }],
    ['whirlpool_core.png', 'disc', { out: 'whirlpool_core', size: 288 }],
    ['whirlpool_rim.png', 'props', { cols: 4, rows: 2, share: 192, names: ['rim_0', 'rim_1', 'rim_2', 'rim_3', 'rim_4', 'rim_5', 'rim_6', 'rim_7'] }],
    ['ground_storm_rock.png', 'ground', { out: 'storm_rock' }],
    ['ground_wet_planks.png', 'ground', { out: 'wet_planks' }],
    ['ground_rough_sea.png', 'ground', { out: 'rough_sea' }],
    ['ground_room.png', 'ground', { out: 'room_kraken' }],
  ],
};

async function readRaw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, d: data };
}

/**
 * Magenta becomes transparent and a purple fringe is pulled back (as in cut_zone3.cjs); specks are dropped.
 * `bg: 'green'`: the same for a pure green background, its green fringe pulled back.
 */
function key(img, minSpeck = 40, bg = 'magenta') {
  const { w, h, d } = img;
  for (let i = 0; i < w * h * 4; i += 4) {
    if (bg === 'green') {
      const over = d[i + 1] - Math.max(d[i], d[i + 2]);
      if (over > 70) d[i + 3] = 0;
      else {
        d[i + 3] = 255;
        if (over > 25) d[i + 1] = Math.max(d[i], d[i + 2]) + 22;
      }
      continue;
    }
    const low = Math.min(d[i], d[i + 2]) - d[i + 1];
    if (low > 70 && Math.abs(d[i] - d[i + 2]) < 90) d[i + 3] = 0;
    else {
      d[i + 3] = 255;
      if (low > 25) {
        const g = d[i + 1];
        d[i] = Math.min(d[i], g + 22);
        d[i + 2] = Math.min(d[i + 2], g + 22);
      }
    }
  }
  const seen = new Uint8Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !d[s * 4 + 3]) continue;
    const stack = [s];
    const comp = [];
    seen[s] = 1;
    while (stack.length) {
      const k = stack.pop();
      comp.push(k);
      const x = k % w;
      for (const t of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k - w, k + w]) {
        if (t >= 0 && t < w * h && !seen[t] && d[t * 4 + 3]) {
          seen[t] = 1;
          stack.push(t);
        }
      }
    }
    if (comp.length < minSpeck) for (const k of comp) d[k * 4 + 3] = 0;
  }
  return img;
}

/** The tight box of everything opaque inside [x0, y0, x1, y1). */
function tight(img, [x0, y0, x1, y1], label) {
  let a = x1, b = y1, c = x0 - 1, e = y0 - 1;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (!img.d[(y * img.w + x) * 4 + 3]) continue;
    if (x < a) a = x;
    if (x > c) c = x;
    if (y < b) b = y;
    if (y > e) e = y;
  }
  if (c < a) throw new Error(`${label}: empty cell`);
  return [a, b, c + 1, e + 1];
}

/**
 * Runs of lines that have something in them, split where at least `gap` empty lines come between. When there are
 * more runs than wanted (a small part floating off a piece), the closest neighbours are joined until it fits.
 */
function bandsOf(has, size, gap, want, label) {
  const bands = [];
  let start = -1;
  let empty = 0;
  for (let i = 0; i < size; i++) {
    if (has(i)) {
      if (start < 0) start = i;
      empty = 0;
    } else if (start >= 0 && ++empty >= gap) {
      bands.push([start, i - empty + 1]);
      start = -1;
    }
  }
  if (start >= 0) bands.push([start, size]);
  while (bands.length > want) {
    let best = 0;
    for (let i = 1; i < bands.length - 1; i++) if (bands[i + 1][0] - bands[i][1] < bands[best + 1][0] - bands[best][1]) best = i;
    bands.splice(best, 2, [bands[best][0], bands[best + 1][1]]);
  }
  if (bands.length !== want) throw new Error(`${label}: found ${bands.length} bands, wanted ${want}: ${JSON.stringify(bands)}`);
  return bands;
}

/**
 * When a piece reaches past the next row (a flag pole beside a ship's mast) no empty line splits the rows. Then the
 * cols × rows biggest pieces are the objects: rows cut where their centres jump down the most, columns where they jump
 * across the most, and every smaller piece (smoke, a loose coin) joins the nearest object. Boxes in reading order.
 */
function cellsByPieces(img, cols, rows, label) {
  const { w, h, d } = img;
  const seen = new Int32Array(w * h).fill(-1);
  const all = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] >= 0 || !d[s * 4 + 3]) continue;
    const stack = [s];
    seen[s] = all.length;
    let n = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (stack.length) {
      const k = stack.pop();
      const x = k % w, y = (k - x) / w;
      n++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const t = ny * w + nx;
        if (seen[t] < 0 && d[t * 4 + 3]) { seen[t] = all.length; stack.push(t); }
      }
    }
    all.push({ n, cx: sx / n, cy: sy / n, box: [x0, y0, x1 + 1, y1 + 1] });
  }
  const want = cols * rows;
  const big = [...all].sort((a, b) => b.n - a.n).slice(0, want);
  if (big.length < want) throw new Error(`${label}: only ${big.length} pieces, wanted ${want}`);
  const splitAt = (list, key, parts) => {
    const s = [...list].sort((a, b) => a[key] - b[key]);
    const cuts = s.slice(1).map((p, i) => ({ i: i + 1, gap: p[key] - s[i][key] })).sort((a, b) => b.gap - a.gap).slice(0, parts - 1).map((c) => c.i).sort((a, b) => a - b);
    const b = [0, ...cuts, s.length];
    return b.slice(0, -1).map((v, i) => s.slice(v, b[i + 1]));
  };
  const grid = [];
  for (const row of splitAt(big, 'cy', rows)) {
    if (row.length !== cols) throw new Error(`${label}: a row has ${row.length} objects, wanted ${cols}`);
    grid.push(...splitAt(row, 'cx', cols).map((c) => c[0]));
  }
  const boxes = grid.map((p) => [...p.box]);
  const gapTo = (b, q) => Math.hypot(Math.max(0, b[0] - q.box[2], q.box[0] - b[2]), Math.max(0, b[1] - q.box[3], q.box[1] - b[3]));
  for (const p of all) {
    if (grid.includes(p)) continue;
    let best = 0;
    for (let i = 1; i < grid.length; i++) if (gapTo(grid[i].box, p) < gapTo(grid[best].box, p)) best = i;
    const b = boxes[best];
    b[0] = Math.min(b[0], p.box[0]); b[1] = Math.min(b[1], p.box[1]); b[2] = Math.max(b[2], p.box[2]); b[3] = Math.max(b[3], p.box[3]);
  }
  console.log(`  ${label}: split by pieces`);
  return boxes;
}

/** Splits a keyed sheet into rows, then each row into columns, on empty lines. Boxes in reading order. */
function cells(img, cols, rows, label, gap = 6) {
  try {
    return cellsOnLines(img, cols, rows, label, gap);
  } catch (e) {
    if (!piecesFallback) throw e;
    return cellsByPieces(img, cols, rows, label);
  }
}
/** Floor 2 only: fall back to cellsByPieces. */
let piecesFallback = false;

function cellsOnLines(img, cols, rows, label, gap = 6) {
  const { w, h, d } = img;
  const opaque = (x, y) => d[(y * w + x) * 4 + 3] !== 0;
  const out = [];
  const rowBands = bandsOf((y) => { for (let x = 0; x < w; x++) if (opaque(x, y)) return true; return false; }, h, gap, rows, `${label} rows`);
  for (const [y0, y1] of rowBands) {
    const colBands = bandsOf((x) => { for (let y = y0; y < y1; y++) if (opaque(x, y)) return true; return false; }, w, gap, Array.isArray(cols) ? cols[rowBands.findIndex(([a]) => a === y0)] : cols, `${label} cols`);
    for (const [x0, x1] of colBands) out.push(tight(img, [x0, y0, x1, y1], `${label} cell ${out.length}`));
  }
  return out;
}

const crop = (img, [x0, y0, x1, y1]) =>
  sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 });

async function sizeOf(rel) {
  const m = await sharp(path.join(OLD, rel)).metadata();
  return [m.width, m.height];
}

/** For the floor 2 sets: files git already tracks, which they must never overwrite. */
let tracked = null;

async function save(pipeline, rel) {
  const file = path.join(OUT, rel);
  if (tracked?.has(path.resolve(file))) throw new Error(`${rel} is already in git (a floor 1 file): refusing to overwrite`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await pipeline.png({ compressionLevel: 9 }).toFile(file);
  const m = await sharp(file).metadata();
  console.log(`  ${rel} ${m.width}x${m.height}`);
}

/** One file per cell, as tall as the old file of that name (the game sizes props by height). */
async function props(img, o, label) {
  // `erase`: blank these boxes [x0, y0, x1, y1] first (the forge's puff of smoke, which reached up into the row above).
  for (const [x0, y0, x1, y1] of o.erase ?? []) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) img.d[(y * img.w + x) * 4 + 3] = 0;
  const boxes = cells(img, o.cols, o.rows, label);
  const dir = o.dir ?? 'props';
  // `share`: one scale for the sheet, its tallest piece this tall.
  const shared = o.share ? o.share / Math.max(...boxes.map((b) => b[3] - b[1])) : 0;
  const one = async (name, box) => {
    if (o.share || o.box) {
      const bw = box[2] - box[0], bh = box[3] - box[1];
      // `box`: each piece fitted inside a square this big (effects: long bolts and round bursts alike).
      const k = o.share ? shared : o.box / Math.max(bw, bh);
      await save(crop(img, box).resize(Math.max(1, Math.round(bw * k)), Math.max(1, Math.round(bh * k)), { kernel: 'lanczos3', fit: 'fill' }), `${dir}/${name}.png`);
      return;
    }
    // `slope`: a long piece lying along a world axis, drawn a little flatter than the game sees it: sheared so its
    // foot climbs at the game's slope (as strip() does for whole rows, but at most a little, so it isn't stretched).
    if (o.shear?.[name] !== undefined) {
      const buf = await crop(img, box).png().toBuffer();
      const sheared = await sharp(buf).affine([[1, 0], [o.shear[name], 1]], { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const t = await sharp(sheared).trim({ threshold: 1 }).png().toBuffer();
      const m = await sharp(t).metadata();
      await save(sharp(t).resize(Math.max(1, Math.round(m.width * (o.height / m.height))), o.height, { kernel: 'lanczos3', fit: 'fill' }), `props/${name}.png`);
      return;
    }
    if (o.slope) {
      const buf = await crop(img, box).png().toBuffer();
      const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const xs = [];
      const ys = [];
      for (let x = Math.round(info.width * 0.2); x < info.width * 0.8; x++) {
        for (let y = info.height - 1; y >= 0; y--) if (data[(y * info.width + x) * 4 + 3]) { xs.push(x); ys.push(y); break; }
      }
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = ys.reduce((a, b) => a + b, 0) / ys.length;
      let sxy = 0;
      let sxx = 0;
      for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
      const slope = sxy / sxx;
      const want = (slope > 0 ? 1 : -1) * Math.sin(Math.atan2(1.45, Math.SQRT2));
      const k = Math.max(-0.3, Math.min(0.3, want - slope));
      console.log(`  ${name}: foot slope ${slope.toFixed(3)}, sheared by ${k.toFixed(3)}`);
      const sheared = await sharp(buf).affine([[1, 0], [k, 1]], { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const t = await sharp(sheared).trim({ threshold: 1 }).png().toBuffer();
      const m = await sharp(t).metadata();
      await save(sharp(t).resize(Math.max(1, Math.round(m.width * (o.height / m.height))), o.height, { kernel: 'lanczos3', fit: 'fill' }), `props/${name}.png`);
      return;
    }
    // `height`: a new picture with no old file, cut to this many pixels tall.
    const [oldW, oldH] = o.height ? [0, o.height] : await sizeOf(`props/${name}.png`);
    const k = oldH / (box[3] - box[1]);
    // `exact`: the old file's width too (pieces placed by their pixel size, like the town walls).
    const w = o.exact ? oldW : Math.max(1, Math.round((box[2] - box[0]) * k));
    await save(crop(img, box).resize(w, oldH, { kernel: 'lanczos3', fit: 'fill' }), `props/${name}.png`);
  };
  for (let i = 0; i < o.names.length; i++) await one(o.names[i], boxes[i]);
  for (const [name, i] of o.extra ?? []) await one(name, boxes[i]);
}

/**
 * A grid sheet the game reads by cell, the same size as the old one. `fit`: 'shared' = one scale for every
 * piece (keeps their sizes relative), 'rows' = one per row, 'each' = every piece fills its cell.
 * `place`: where a piece sits in its cell ('bottom' = standing on the cell's floor, 'top' = hanging from its top).
 */
async function atlas(img, o, label) {
  const [W, H] = o.size ?? await sizeOf(`props/${o.out}.png`);
  const cw = W / o.cols;
  const ch = H / o.rows;
  const pad = 0.04;
  const boxes = cells(img, o.cols, o.rows, label);
  const fitOf = (b) => Math.min((cw * (1 - 2 * pad)) / (b[2] - b[0]), (ch * (1 - 2 * pad)) / (b[3] - b[1]));
  const scale = boxes.map((b, i) => {
    if (o.fit === 'each') return fitOf(b);
    const group = o.fit === 'rows' ? boxes.filter((_, j) => Math.floor(j / o.cols) === Math.floor(i / o.cols)) : boxes;
    return Math.min(...group.map(fitOf));
  });
  const layers = [];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const w = Math.max(1, Math.round((b[2] - b[0]) * scale[i]));
    const h = Math.max(1, Math.round((b[3] - b[1]) * scale[i]));
    const cx = (i % o.cols) * cw;
    const cy = Math.floor(i / o.cols) * ch;
    const left = Math.round(cx + (cw - w) / 2);
    const place = o.flat?.includes(i) ? 'centre' : o.place;
    const top = Math.round(place === 'bottom' ? cy + ch - ch * pad - h : place === 'top' ? cy + ch * pad : cy + (ch - h) / 2);
    layers.push({ input: await crop(img, b).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer(), left, top });
  }
  const sheet = sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers);
  await save(sheet, `props/${o.out}.png`);
}

/**
 * Boardwalk pieces (world.ts PLANK_SHEET): one row of cells, each stretched over a board `aspect` wide for its length.
 * The sheets come as long strips, so each cell takes a piece of its strip that already has that shape.
 */
async function planks(img, o, label) {
  const [W, H] = await sizeOf(`props/${o.out}.png`);
  const cw = W / o.cols;
  const strips = cells(img, o.cols, 1, label);
  const layers = [];
  for (let i = 0; i < o.cols; i++) {
    // `inner`: keep only this middle part of the strip's width (owner 2026-11-17: the boards alone, no side rails or posts).
    const [sx0, y0, sx1, y1] = strips[i];
    const [a, b] = o.inner ?? [0, 1];
    const x0 = Math.round(sx0 + (sx1 - sx0) * a);
    const x1 = Math.round(sx0 + (sx1 - sx0) * b);
    const len = Math.min(y1 - y0, Math.round((x1 - x0) / o.aspect));
    const top = Math.round(y0 + (y1 - y0 - len) / 2);
    layers.push({ input: await crop(img, [x0, top, x1, top + len]).resize(Math.round(cw), H, { kernel: 'lanczos3', fit: 'fill' }).png().toBuffer(), left: Math.round(i * cw), top: 0 });
  }
  await save(sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers), `props/${o.out}.png`);
}

/**
 * A long row seen along a world axis: its bottom edge is fitted with a straight line (the middle 70% of the columns)
 * and the picture is sheared up or down until that line has the slope a world axis has on screen. The camera looks
 * down ISO_DIR (1, 1.45, 1), so a world axis climbs sin(elevation) = 1.45 / √(1 + 1.45² + 1) ... per unit across.
 * `rise`: the row climbs to the right (the top-left wall), else it falls.
 */
async function strip(img, o, label) {
  const [x0, y0, x1, y1] = tight(img, [0, 0, img.w, img.h], label);
  const xs = [];
  const ys = [];
  for (let x = Math.round(x0 + (x1 - x0) * 0.15); x < x0 + (x1 - x0) * 0.85; x++) {
    for (let y = y1 - 1; y >= y0; y--) if (img.d[(y * img.w + x) * 4 + 3]) { xs.push(x); ys.push(y); break; }
  }
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const slope = sxy / sxx;
  const want = (o.rise ? -1 : 1) * Math.sin(Math.atan2(1.45, Math.SQRT2));
  const k = want - slope;
  console.log(`  ${label}: foot slope ${slope.toFixed(3)} → ${want.toFixed(3)}`);
  const sheared = await crop(img, [x0, y0, x1, y1])
    .affine([[1, 0], [k, 1]], { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  const t = await sharp(sheared).trim({ threshold: 1 }).png().toBuffer();
  await save(sharp(t).resize({ width: o.width, kernel: 'lanczos3' }), `props/${o.out}.png`);
}

/** A round layer that the game spins: a square centred on the circle's own box, so it turns without wobbling. */
async function disc(img, o, label) {
  const [x0, y0, x1, y1] = tight(img, [0, 0, img.w, img.h], label);
  const side = Math.max(x1 - x0, y1 - y0);
  const left = Math.round((x0 + x1) / 2 - side / 2), top = Math.round((y0 + y1) / 2 - side / 2);
  // The circle may touch the picture's edge: pad with transparency before taking the square.
  const big = await sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } })
    .extend({ top: side, bottom: side, left: side, right: side, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  console.log(`  ${label}: circle ${x1 - x0}x${y1 - y0}`);
  await save(sharp(big).extract({ left: left + side, top: top + side, width: side, height: side }).resize(o.size, o.size, { kernel: 'lanczos3' }), `props/${o.out}.png`);
}

/** A repeating ground tile: shrunk to 1024 square, its edges blended into the opposite ones so it repeats without a seam. */
async function ground(file, o) {
  const N = 1024;
  const { data } = await sharp(file).removeAlpha().resize(N, N, { kernel: 'lanczos3', fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const B = 96; // Blend band in pixels: each edge fades into the wrapped-around copy of the far side.
  const at = (x, y, c) => data[(((y + N) % N) * N + ((x + N) % N)) * 3 + c];
  const out = Buffer.alloc(N * N * 3);
  // Shift by half a tile so the old edges sit in the middle, then blend that cross with a smooth weight.
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = Math.abs(x - N / 2);
    const dy = Math.abs(y - N / 2);
    const wx = dx < B ? 1 - dx / B : 0; // Near the vertical seam: fade to the picture not shifted across.
    const wy = dy < B ? 1 - dy / B : 0;
    for (let c = 0; c < 3; c++) {
      const shifted = at(x + N / 2, y + N / 2, c);
      const across = at(x, y + N / 2, c); // Same row band, no x shift: hides the vertical seam.
      const down = at(x + N / 2, y, c); // Same column band, no y shift: hides the horizontal seam.
      let v = shifted;
      v = v * (1 - wx) + across * wx;
      v = v * (1 - wy) + down * wy;
      out[(y * N + x) * 3 + c] = Math.round(v);
    }
  }
  await save(sharp(out, { raw: { width: N, height: N, channels: 3 } }), `ground/${o.out}.png`);
}

async function main() {
  const map = process.argv[2];
  const specs = MAPS[map];
  if (!specs) throw new Error(`usage: node tools/cut_papercraft.cjs <${Object.keys(MAPS).join('|')}>`);
  const RAW = path.join(ROOT, 'art_templates/papercraft_maps/raw', map);
  const floor2 = map.startsWith('floor2_');
  if (floor2) {
    tracked = trackedSprites(ROOT);
    piecesFallback = true;
  }
  for (const [file, kind, o] of specs) {
    const src = path.join(RAW, file);
    if (!fs.existsSync(src)) {
      console.warn(`- ${file}: not there yet, skipped`);
      continue;
    }
    console.log(file);
    if (kind === 'ground') await ground(src, o);
    else {
      const img = await readRaw(src);
      if (floor2) {
        // `see`: tissue-paper effects drawn see-through over the background keep their see-through parts (as the ghosts).
        const { bg, green } = keyBg(img, o.see ? { soft: true, ghost: true } : {});
        console.log(`  background ${green ? 'green' : 'magenta'} ${bg.join(',')}`);
      } else key(img, 40, o.bg);
      if (kind === 'disc') await disc(img, o, file);
      else if (kind === 'props') await props(img, o, file);
      else if (kind === 'planks') await planks(img, o, file);
      else if (kind === 'strip') await strip(img, o, file);
      else await atlas(img, o, file);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
