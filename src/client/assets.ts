import * as THREE from 'three';
import {
  makeSheet, drawHuman, drawSlime, drawQuad, drawSeeker, drawMerchant, drawBlacksmith, drawKeeper, drawTree, drawBush, drawRock, drawStump,
  drawTent, drawCampfire, drawSign, drawFence, drawRunestone, drawIcon, pixelCircle,
} from './placeholder';
import { ITEM_ART } from '../shared/data/items';
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

export const SHEET_SPECS: Record<string, SheetSpec> = {
  sword: sheet('player/sword.png', () => makeSheet(32, drawHuman('sword'))),
  mage: sheet('player/mage.png', () => makeSheet(32, drawHuman('mage'))),
  gunslinger: sheet('player/gunslinger.png', () => makeSheet(32, drawHuman('gunslinger'))),
  seeker: sheet('npc/seeker.png', () => makeSheet(32, drawSeeker())),
  merchant: sheet('npc/merchant.png', () => makeSheet(32, drawMerchant())),
  blacksmith: sheet('npc/blacksmith.png', () => makeSheet(32, drawBlacksmith())),
  // No painted sheet yet: until npc/keeper.png exists the placeholder drawing is used.
  keeper: sheet('npc/keeper.png', () => makeSheet(32, drawKeeper())),

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

  ...Object.fromEntries(MAP_ICONS.map((name) => [`map_${name}`, single(`icons/map_${name}.png`, () => drawIcon('coin'))])),
  icon_coin: single('icons/coin.png', () => drawIcon('coin')),
  icon_potion_hp: single('icons/potion_hp.png', () => drawIcon('potion_hp')),
  icon_potion_mp: single('icons/potion_mp.png', () => drawIcon('potion_mp')),
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
export const fxTex = {} as Record<'glow' | 'shadow' | 'mist' | 'ring' | 'edge' | 'disc', THREE.Texture>;

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

async function loadAnimSet(loader: THREE.TextureLoader, key: string, dir: string): Promise<void> {
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
        const tex = await loader.loadAsync(`${dir}/${def.file}`);
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
export type GroundTile = 'grass' | 'dirt' | 'water' | 'marsh' | 'mud' | 'pave';
export const groundTiles: Partial<Record<GroundTile, THREE.Texture>> = {};

async function loadGroundTile(loader: THREE.TextureLoader, name: GroundTile): Promise<void> {
  try {
    const tex = await loader.loadAsync(`${BASE}ground/${name}.png`);
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
export type FxSheet = 'sword' | 'mage' | 'gun';
export const fxSheets: Partial<Record<FxSheet, THREE.Texture>> = {};

async function loadFxSheet(loader: THREE.TextureLoader, name: FxSheet): Promise<void> {
  try {
    const tex = await loader.loadAsync(`${BASE}fx/${name}.png`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    fxSheets[name] = tex;
  } catch {
    console.warn(`[assets] missing effect sheet "${name}"`);
  }
}

export async function loadAssets(): Promise<void> {
  const loader = new THREE.TextureLoader();
  await Promise.all((['sword', 'mage', 'gun'] as const).map((n) => loadFxSheet(loader, n)));
  await Promise.all((['grass', 'dirt', 'water', 'marsh', 'mud', 'pave'] as const).map((n) => loadGroundTile(loader, n)));
  await Promise.all(
    Object.entries(SHEET_SPECS).map(async ([key, spec]) => {
      let tex: THREE.Texture;
      let sideFaces = spec.fileSideFaces;
      let rows = spec.rows;
      try {
        tex = await loader.loadAsync(spec.path);
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
  );
  await Promise.all(Object.entries(ANIM_SET_DIRS).map(([key, dir]) => loadAnimSet(loader, key, BASE + dir)));
  const band = (d: number, steps: [number, number][]) => steps.find(([edge]) => d <= edge)?.[1] ?? 0;
  fxTex.glow = fxTexture(pixelCircle(32, '255,255,255', (d) => band(d, [[0.3, 1], [0.55, 0.6], [0.78, 0.28], [1, 0.1]])));
  fxTex.shadow = fxTexture(pixelCircle(32, '0,0,0', (d) => band(d, [[0.72, 0.85], [1, 0.42]])));
  // Smooth rather than dithered: mist sprites are far bigger than their texture, so a dither
  // shows up as a screen-door grid over the ground.
  fxTex.mist = fxTexture(pixelCircle(128, '255,255,255', (d) => (1 - d) * (1 - d)));
  fxTex.mist.magFilter = fxTex.mist.minFilter = THREE.LinearFilter;
  fxTex.ring = fxTexture(pixelCircle(128, '255,255,255', (d) => (d >= 0.82 && d <= 1 ? 1 : 0)));
  fxTex.edge = fxTexture(pixelCircle(128, '255,255,255', (d) => (d >= 0.94 && d <= 1 ? 1 : 0)));
  fxTex.disc = fxTexture(pixelCircle(128, '255,255,255', (d) => (d <= 1 ? 1 : 0)));
}
