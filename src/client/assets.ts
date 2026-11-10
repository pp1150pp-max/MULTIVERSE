import * as THREE from 'three';
import {
  makeSheet, drawHuman, drawSlime, drawQuad, drawSeeker, drawMerchant, drawBlacksmith, drawKeeper, drawBroker, drawTree, drawBush, drawRock, drawStump,
  drawSnowPine, drawSnowRock, drawIceCrystal, drawIceShard, drawEmberBolt, drawBurntPillar, drawBasalt, drawMagmaCrystal, drawSnowball,
  drawTent, drawCampfire, drawSign, drawFence, drawRunestone, drawIcon, pixelCircle,
} from './placeholder';
import { ITEM_ART } from '../shared/data/items';
import { STONE_KINDS } from '../shared/types';
import { MAP_ICONS } from './mapIconNames';
import type { AnimSet, CharManifest } from './AnimatedActor';

export interface SheetInfo {
  texture: THREE.Texture;
  cols: number;
  rows: number;
  /** Which way the "side" row faces in the image. The other side is mirrored. */
  sideFaces: 'left' | 'right';
  cellAspect: number;
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

export const SHEET_SPECS: Record<string, SheetSpec> = {
  sword: sheet('player/sword.png', () => makeSheet(32, drawHuman('sword'))),
  mage: sheet('player/mage.png', () => makeSheet(32, drawHuman('mage'))),
  gunslinger: sheet('player/gunslinger.png', () => makeSheet(32, drawHuman('gunslinger'))),
  seeker: sheet('npc/seeker.png', () => makeSheet(32, drawSeeker())),
  merchant: sheet('npc/merchant.png', () => makeSheet(32, drawMerchant())),
  blacksmith: sheet('npc/blacksmith.png', () => makeSheet(32, drawBlacksmith())),
  keeper: sheet('npc/keeper.png', () => makeSheet(32, drawKeeper())),
  broker: sheet('npc/broker.png', () => makeSheet(32, drawBroker())),

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
  fence: prop('fence', drawFence),
  runestone: prop('runestone', drawRunestone),
  well: prop('well', drawRunestone),
  barrel: prop('barrel', drawStump),
  cart: prop('cart', drawFence),
  chest: prop('chest', drawStump),
  watchtower: prop('watchtower', drawFence),
  ruin_fountain: ruin('ruin_fountain', 'well'),
  // The town wall kit: pieces that line up end to end (see tools/cut_hub.cjs and Terrain.placeTown).
  ...Object.fromEntries(['town_wall_a', 'town_wall_a_broken', 'town_wall_b', 'town_wall_b_broken', 'town_wall_end']
    .map((k) => [k, ruin(k, null)])),
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

async function loadAnimSet(key: string, dir: string): Promise<void> {
  let manifest: CharManifest;
  try {
    const res = await fetch(`${dir}/sprite.json`);
    if (!res.ok) return;
    manifest = (await res.json()) as CharManifest;
  } catch {
    return; // No folder yet (the dev server answers with index.html, which isn't JSON).
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
    return;
  }
  for (const name of Object.keys(manifest.animations)) if (!textures[name]) delete manifest.animations[name];
  animSets[key] = { manifest, textures };
  assetSources[`${key} (animations)`] = 'file';
}

/** Repeating ground textures. A zone falls back to its code-painted ground if one is missing. */
export type GroundTile = 'grass' | 'dirt' | 'water' | 'marsh' | 'mud' | 'pave' | 'brick' | 'snow' | 'snow_path' | 'ice' | 'ash_rock' | 'ash_path' | 'lava'
  | 'room_forest' | 'room_marsh' | 'room_snow' | 'room_volcano';
export const groundTiles: Partial<Record<GroundTile, THREE.Texture>> = {};

async function loadGroundTile(name: GroundTile): Promise<void> {
  try {
    const tex = await loadTexture(`${BASE}ground/${name}.png`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    groundTiles[name] = tex;
  } catch {
    console.warn(`[assets] missing ground tile "${name}"`);
  }
}

/** Skill animation sheets, one per class: 6 frames across, one effect per row. */
export type FxSheet = 'sword' | 'mage' | 'gun' | 'gun_ult';
export const fxSheets: Partial<Record<FxSheet, THREE.Texture>> = {};

async function loadFxSheet(name: FxSheet): Promise<void> {
  try {
    const tex = await loadTexture(`${BASE}fx/${name}.png`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    fxSheets[name] = tex;
  } catch {
    console.warn(`[assets] missing effect sheet "${name}"`);
  }
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

/** Like THREE.TextureLoader.loadAsync, but counts the bytes as they arrive for the loading bar. */
async function loadTexture(url: string): Promise<THREE.Texture> {
  const d: Download = { loaded: 0, size: null };
  downloads.push(d);
  try {
    const res = await fetch(url);
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
}
const portraitSources: Record<string, PortraitSource> = {};
let menuLoad: Promise<void> | null = null;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error(`missing ${url}`));
    img.src = url;
  });
}

async function loadPortrait(key: string): Promise<void> {
  const dir = ANIM_SET_DIRS[key];
  if (dir) {
    try {
      const res = await fetch(`${BASE}${dir}/sprite.json`);
      const m = (await res.json()) as CharManifest;
      const img = await loadImage(`${BASE}${dir}/${m.animations.idle.file}`);
      portraitSources[key] = { img, cw: m.frameWidth, ch: m.frameHeight };
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
  // Everything at once: the files don't depend on each other.
  await Promise.all([
    ...(['sword', 'mage', 'gun', 'gun_ult'] as const).map((n) => loadFxSheet(n)),
    loadDecals(),
    ...(['grass', 'dirt', 'water', 'marsh', 'mud', 'pave', 'brick', 'snow', 'snow_path', 'ice', 'ash_rock', 'ash_path', 'lava',
      'room_forest', 'room_marsh', 'room_snow', 'room_volcano'] as const).map((n) => loadGroundTile(n)),
    ...Object.entries(ANIM_SET_DIRS).map(([key, dir]) => loadAnimSet(key, BASE + dir)),
    ...Object.entries(SHEET_SPECS).map(async ([key, spec]) => {
      let tex: THREE.Texture;
      let sideFaces = spec.fileSideFaces;
      let rows = spec.rows;
      try {
        tex = await loadTexture(spec.path).catch((e) => (spec.standIn ? loadTexture(spec.standIn) : Promise.reject(e)));
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
        cols: spec.cols,
        rows,
        sideFaces,
        cellAspect: img.width / spec.cols / (img.height / rows),
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
