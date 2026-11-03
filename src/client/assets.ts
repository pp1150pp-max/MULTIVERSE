import * as THREE from 'three';
import {
  makeSheet, drawHuman, drawSlime, drawQuad, drawSeeker, drawMerchant, drawBlacksmith, drawTree, drawBush, drawRock, drawStump,
  drawTent, drawCampfire, drawSign, drawFence, drawRunestone, drawIcon, radialCanvas,
} from './placeholder';
import { RARITIES, RARITY_COLOR } from '../shared/types';
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
  /** Side-row direction for real PNG files (concept sheet faces left). Placeholders face right. */
  fileSideFaces: 'left' | 'right';
  placeholder: () => HTMLCanvasElement;
}

const BASE = 'assets/sprites/';
const sheet = (path: string, placeholder: () => HTMLCanvasElement): SheetSpec =>
  ({ path: BASE + path, cols: 3, rows: 3, fileSideFaces: 'left', placeholder });
const single = (path: string, placeholder: () => HTMLCanvasElement): SheetSpec =>
  ({ path: BASE + path, cols: 1, rows: 1, fileSideFaces: 'left', placeholder });

export const SHEET_SPECS: Record<string, SheetSpec> = {
  sword: sheet('player/sword.png', () => makeSheet(32, drawHuman('sword'))),
  mage: sheet('player/mage.png', () => makeSheet(32, drawHuman('mage'))),
  gunslinger: sheet('player/gunslinger.png', () => makeSheet(32, drawHuman('gunslinger'))),
  seeker: sheet('npc/seeker.png', () => makeSheet(32, drawSeeker())),
  merchant: sheet('npc/merchant.png', () => makeSheet(32, drawMerchant())),
  blacksmith: sheet('npc/blacksmith.png', () => makeSheet(32, drawBlacksmith())),

  green_slime: sheet('monsters/green_slime.png', () => makeSheet(32, drawSlime(['#6cc25a', '#4a9a3e', '#c8f0b0']))),
  wild_rabbit: sheet('monsters/wild_rabbit.png', () => makeSheet(32, drawQuad(['#e8d3bf', '#d89a9a', '#fbeee2', '#d88a8a'], {
    bodyRx: 0.2, bodyRy: 0.15, head: 0.13, ears: 'long', earSize: 0.13, tail: 'puff', legLen: 0.06, legW: 0.06, snout: 0.05, belly: true,
  }))),
  forest_fox: sheet('monsters/forest_fox.png', () => makeSheet(36, drawQuad(['#e07a2a', '#5a2a10', '#fbf1e4', '#2a1c12'], {
    bodyRx: 0.24, bodyRy: 0.12, head: 0.13, ears: 'pointy', earSize: 0.1, tail: 'bushy', tailTip: '#fbf1e4', legLen: 0.12, legW: 0.05, snout: 0.06, belly: true,
  }))),
  wild_boar: sheet('monsters/wild_boar.png', () => makeSheet(40, drawQuad(['#6b4530', '#3e281c', '#a07a5c', '#d9a0a0'], {
    bodyRx: 0.3, bodyRy: 0.17, head: 0.14, ears: 'small', earSize: 0.07, tail: 'short', legLen: 0.1, legW: 0.07, snout: 0.07, tusks: true, mane: true,
  }))),
  forest_wolf: sheet('monsters/forest_wolf.png', () => makeSheet(40, drawQuad(['#6e6e74', '#3d3d44', '#d9d6cf', '#1a1a1a'], {
    bodyRx: 0.28, bodyRy: 0.13, head: 0.13, ears: 'pointy', earSize: 0.09, tail: 'bushy', tailTip: '#d9d6cf', legLen: 0.15, legW: 0.055, snout: 0.07, belly: true,
  }))),
  forest_bear: sheet('monsters/forest_bear.png', () => makeSheet(56, drawQuad(['#7a4a2a', '#4a2c18', '#b88a64', '#1a1410'], {
    bodyRx: 0.36, bodyRy: 0.22, head: 0.16, ears: 'round', earSize: 0.08, tail: 'none', legLen: 0.13, legW: 0.1, snout: 0.08, belly: true,
  }))),

  // Zone 2 — Misty Marsh. Placeholders only show if the PNGs are missing.
  bog_toad: sheet('monsters/bog_toad.png', () => makeSheet(40, drawQuad(['#6f6a34', '#4a4622', '#c9b98a', '#2a2412'], {
    bodyRx: 0.3, bodyRy: 0.2, head: 0.14, ears: 'small', earSize: 0.04, tail: 'none', legLen: 0.06, legW: 0.08, snout: 0.04, belly: true,
  }))),
  marsh_leech: sheet('monsters/marsh_leech.png', () => makeSheet(36, drawSlime(['#4a3450', '#2e1e34', '#9a7aa8']))),
  swamp_serpent: sheet('monsters/swamp_serpent.png', () => makeSheet(36, drawSlime(['#3e8a78', '#2a5e52', '#e0d070']))),
  mire_ghoul: sheet('monsters/mire_ghoul.png', () => makeSheet(40, drawSlime(['#3a3228', '#221c16', '#a8e08a']))),
  will_o_wisp: sheet('monsters/will_o_wisp.png', () => makeSheet(36, drawSlime(['#6ad8d0', '#3a9aa8', '#e8fffa']))),
  bog_witch: sheet('monsters/bog_witch.png', () => makeSheet(56, drawSeeker())),

  swamp_tree_0: single('props/swamp_tree_0.png', () => drawTree(0)),
  swamp_tree_1: single('props/swamp_tree_1.png', () => drawTree(1)),
  swamp_tree_2: single('props/swamp_tree_2.png', () => drawTree(2)),
  willow: single('props/willow.png', () => drawTree(1)),
  reeds_0: single('props/reeds_0.png', () => drawBush(0)),
  reeds_1: single('props/reeds_1.png', () => drawBush(1)),
  fern: single('props/fern.png', () => drawBush(0)),
  mushrooms: single('props/mushrooms.png', () => drawBush(1)),
  mossrock_0: single('props/mossrock_0.png', () => drawRock(0)),
  mossrock_1: single('props/mossrock_1.png', () => drawRock(1)),
  swamp_stump: single('props/swamp_stump.png', drawStump),
  portal: single('props/portal.png', drawRunestone),

  tree_0: single('props/tree_0.png', () => drawTree(0)),
  tree_1: single('props/tree_1.png', () => drawTree(1)),
  tree_2: single('props/tree_2.png', () => drawTree(2)),
  bush_0: single('props/bush_0.png', () => drawBush(0)),
  bush_1: single('props/bush_1.png', () => drawBush(1)),
  rock_0: single('props/rock_0.png', () => drawRock(0)),
  rock_1: single('props/rock_1.png', () => drawRock(1)),
  stump: single('props/stump.png', drawStump),
  tent: single('props/tent.png', drawTent),
  campfire: single('props/campfire.png', drawCampfire),
  sign: single('props/sign.png', drawSign),
  fence: single('props/fence.png', drawFence),
  runestone: single('props/runestone.png', drawRunestone),

  icon_coin: single('icons/coin.png', () => drawIcon('coin')),
  icon_potion_hp: single('icons/potion_hp.png', () => drawIcon('potion_hp')),
  icon_potion_mp: single('icons/potion_mp.png', () => drawIcon('potion_mp')),
  ...Object.fromEntries(RARITIES.map((r) => [`icon_bag_${r}`, single(`icons/bag_${r}.png`, () => drawIcon('bag', RARITY_COLOR[r]))])),
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
export const fxTex = {} as { glow: THREE.Texture; shadow: THREE.Texture };

function prep(tex: THREE.Texture): void {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
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
        // and smooth filtering (the pixel-art `prep` settings would shimmer).
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
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

export async function loadAssets(): Promise<void> {
  const loader = new THREE.TextureLoader();
  await Promise.all(
    Object.entries(SHEET_SPECS).map(async ([key, spec]) => {
      let tex: THREE.Texture;
      let sideFaces = spec.fileSideFaces;
      try {
        tex = await loader.loadAsync(spec.path);
        assetSources[key] = 'file';
      } catch {
        tex = new THREE.CanvasTexture(spec.placeholder());
        sideFaces = 'right';
        assetSources[key] = 'placeholder';
      }
      prep(tex);
      const img = tex.image as { width: number; height: number };
      // Big painted files (e.g. the marsh art) are drawn smaller than their source, so they need
      // mipmaps or they shimmer. Small pixel-art keeps the crisp nearest-pixel look.
      if (assetSources[key] === 'file' && img.height / spec.rows > 72) {
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
      }
      sheets[key] = {
        texture: tex,
        cols: spec.cols,
        rows: spec.rows,
        sideFaces,
        cellAspect: img.width / spec.cols / (img.height / spec.rows),
      };
    }),
  );
  await Promise.all(Object.entries(ANIM_SET_DIRS).map(([key, dir]) => loadAnimSet(loader, key, BASE + dir)));
  fxTex.glow = new THREE.CanvasTexture(radialCanvas(64, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
  fxTex.shadow = new THREE.CanvasTexture(radialCanvas(64, 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'));
}
