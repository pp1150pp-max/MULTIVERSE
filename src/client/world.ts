import * as THREE from 'three';
import { clearingRadius } from '../shared/data/zones';
import type { PropSpec, Terrain } from '../shared/sim/terrain';
import type { ZoneTheme } from '../shared/data/zones';
import { mulberry32, pick, rand, type Rng } from '../shared/rng';
import { assetSources, fxTex, groundTiles, sheets, type GroundTile } from './assets';
import { closeBias, IslandOutline, paintSpace, PieceBatch } from './island';

/** World units covered by one repeat of a ground tile: about the same pixel size as the sprites. */
const TILE_UNITS = 10.4;
/** Size of the picture the maps are cut from, and of the ground rendered for it. */
const MAP_SIZE = 1400;
const MAP_GROUND_SIZE = 1024;
/** Trees and buildings are drawn smaller than life on the map; anything shorter is left out as clutter. */
const MAP_PROP_SCALE = 0.7;
const MAP_MIN_PROP = 2;
/** Bare ground around the camp at a zone's start. */
const CAMP_RADIUS = 7;
/** How wide each theme's roads are worn into the grass. */
const TRAIL_WIDTH: Record<ZoneTheme, number> = { forest: 4.2, marsh: 3.6, snow: 3.8, volcano: 3.8 };
/** Pictures of the broken land around each theme's island. */
const ISLAND_ART: Record<ZoneTheme, { cliff: string; slabs: string }> = {
  forest: { cliff: 'island_cliff_forest', slabs: 'island_slabs_forest' },
  marsh: { cliff: 'island_cliff_marsh', slabs: 'island_slabs_marsh' },
  snow: { cliff: 'island_cliff_snow', slabs: 'island_slabs_snow' },
  volcano: { cliff: 'island_cliff_volcano', slabs: 'island_slabs_volcano' },
};
/** Light snowfall: how many flakes hang around the player, inside a box this many units across. */
const SNOW_FLAKES = 240;
const SNOW_BOX = 46;
const SNOW_HEIGHT = 16;

/** Camera sits along this direction from its target: 45° yaw, ~47° pitch. */
export const ISO_DIR = new THREE.Vector3(1, 1.45, 1).normalize();

/** The camera's right and up, for quads drawn facing it. */
const CAM_RIGHT = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
const CAM_UP = new THREE.Vector3().crossVectors(CAM_RIGHT, ISO_DIR.clone().negate()).normalize();

/** Screen pixels per pixel of the space picture, and how many of them it slides per world unit walked. */
const SPACE_PIXEL = 2;
const SPACE_DRIFT = 8;

/**
 * Rock columns under the near shores: huge ones behind and low, smaller ones in front. Each starts far
 * enough inside the shore that the land hides its top, so the real ground runs to the edge above it.
 */
const CLIFF_LAYERS = [
  { width: [20, 27], inset: 9, y: -2.5, step: [4, 6] },
  { width: [12, 16], inset: 5, y: -1, step: [2.6, 4] },
  { width: [7.5, 10], inset: 2.2, y: -0.05, step: [1.6, 2.4] },
];

/** Where a small ground detail belongs. */
type DecorSpot = 'verge' | 'field' | 'road' | 'shore' | 'water';

/**
 * Small details with no collision, one atlas per theme (a grid read left to right, top to bottom).
 * Each spot lists the cells that grow there, repeated to make some more common.
 */
const DECOR: Record<ZoneTheme, { key: string; cols: number; rows: number; spots: Record<DecorSpot, number[]> }> = {
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
  },
};
/** World size of one decor atlas cell: 128 pixels at about the same density as the ground tiles. */
const DECOR_CELL_UNITS = 1.33;
/** Rotted boards laid over the wet stretches of a marsh trail: a row of separate pieces, seen from above. */
const PLANK_SHEET = { key: 'marsh_planks', cols: 3, width: 2.9, length: 5 };
const enum GroundId { Base, WaterEdge, Water }

const GROUND_VERT = /* glsl */ `
  attribute float aEdge;
  varying vec2 vWorld;
  varying float vEdge;
  void main() {
    vWorld = position.xz;
    vEdge = aEdge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GROUND_FRAG = /* glsl */ `
  uniform sampler2D uMask, uCover, uBase, uDirt, uPave, uWater;
  uniform float uHalf, uBound, uTileUnits, uTime, uBake, uFlow;
  varying vec2 vWorld;
  varying float vEdge;

  /**
   * Quietens a ground tile so characters stand out from it: pulls each pixel toward the tile's
   * average colour (its smallest mipmap), then takes out some saturation.
   */
  vec3 calm(vec3 c, sampler2D tile, float contrast, float saturation, float brightness) {
    vec3 mean = textureLod(tile, vec2(0.5), 20.0).rgb;
    vec3 flat_ = mean + (c - mean) * contrast;
    float grey = dot(flat_, vec3(0.3, 0.59, 0.11));
    return mix(vec3(grey), flat_, saturation) * brightness;
  }

  float luma(vec3 c) {
    return dot(c, vec3(0.3, 0.59, 0.11));
  }

  /** How far this pixel of a tile stands above the tile's average, so tall bits win a blend. */
  float relief(vec3 c, sampler2D tile) {
    return luma(c) - luma(textureLod(tile, vec2(0.5), 20.0).rgb);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec2 uv = (vWorld + uHalf) / (2.0 * uHalf);
    vec2 tile = vWorld / uTileUnits;
    // Grass breaks into a covered patch in chunky pixels rather than along a smooth line.
    vec2 snapped = floor(vWorld * 14.0) / 14.0;
    float lobes = noise(snapped * 0.7) * 0.45 + noise(snapped * 2.3) * 0.33 + noise(snapped * 6.1) * 0.22 - 0.5;
    // Broad light and dark patches hide the repeat of the tiles.
    float macro = noise(vWorld * 0.09) * 0.6 + noise(vWorld * 0.23) * 0.4 - 0.5;
    // Roads and clearings are laid out from straight lines and circles; this makes them meander.
    vec2 meander = (vec2(noise(vWorld * 0.14 + 3.0), noise(vWorld * 0.14 + 41.0)) - 0.5) * 3.2 / (2.0 * uHalf);
    vec4 cover = texture2D(uCover, uv + meander);

    // Patches of the same tile turned a quarter turn hide the repeat too.
    float patchy = sin(vWorld.x * 0.17 + sin(vWorld.y * 0.13) * 1.3) + sin(vWorld.y * 0.19 + sin(vWorld.x * 0.11) * 1.7);
    vec3 baseTex = texture2D(uBase, patchy > 0.0 ? tile : vec2(tile.y, -tile.x) + 0.37).rgb;
    vec3 base = calm(baseTex, uBase, 0.95, 1.1, 1.0) * (1.0 + macro * 0.2);
    vec3 dirt = calm(texture2D(uDirt, tile).rgb, uDirt, 0.9, 1.0, 1.0) * (1.0 + macro * 0.14);
    // Grass blades reach over the dirt, and grass thins out and darkens just before it gives way.
    float bare = cover.r + lobes * 0.85 - relief(baseTex, uBase) * 1.4;
    vec3 col = mix(base * (1.0 - 0.12 * smoothstep(0.18, 0.46, bare)), dirt, smoothstep(0.46, 0.54, bare));
    // Paving: raised stones show first, so grass and dirt fill the gaps at its edge.
    vec3 paveTex = texture2D(uPave, tile).rgb;
    float laid = cover.g + lobes * 0.6 + relief(paveTex, uPave) * 1.0;
    col = mix(col, calm(paveTex, uPave, 0.9, 1.0, 1.0) * (1.0 + macro * 0.1), smoothstep(0.46, 0.54, laid));

    // Pool shores wander instead of following the smooth shapes drawn in the mask.
    vec2 wander = (vec2(noise(vWorld * 1.3), noise(vWorld * 1.3 + 17.0)) - 0.5) * 0.5 / (2.0 * uHalf);
    int id = int(floor(texture2D(uMask, uv + wander).r * 255.0 / 16.0 + 0.5));
    if (id == 1) {
      col = dirt * 0.4;
    } else if (id == 2) {
      col = calm(texture2D(uWater, tile + vec2(uTime * 0.012, sin(uTime * 0.25) * 0.006) * uFlow).rgb, uWater, 0.7, 0.8, 1.0);
    }
    // Past the walkable square the land darkens, without showing the square's straight lines.
    float past = max(abs(vWorld.x), abs(vWorld.y)) - uBound;
    col *= 1.0 - 0.32 * smoothstep(0.0, 2.5, past + lobes * 3.0);
    // The shore breaks up in chunky pixels: the grass gives way to bare soil, darkening to the very edge.
    float rough = noise(snapped * 1.7) * 0.55 + noise(snapped * 5.3) * 0.45;
    float shore = vEdge - rough * 0.5;
    if (shore < 0.0) discard;
    col = mix(dirt * 0.62, col, step(0.2, shore + (noise(snapped * 3.1) - 0.5) * 0.14));
    if (shore < 0.07) col = dirt * 0.3;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    // A render target stays linear, but the map picture read back from it is used as sRGB.
    if (uBake > 0.5) gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0 / 2.2));
  }
`;

interface Fadeable { mat: THREE.SpriteMaterial; x: number; z: number; w: number; h: number; o: number }
interface Fog { spr: THREE.Sprite; vx: number; vz: number; base: number; phase: number }

const S = Math.SQRT1_2;

/** Colours for painting a zone's ground (the minimap, and the fallback if a tile is missing). */
interface GroundPalette {
  /** Repeating textures for the real ground. `dirt` also covers clearings and pond banks. */
  tiles: { base: GroundTile; dirt: GroundTile; water?: GroundTile; pave?: GroundTile };
  background: string;
  /** Border of the maps. */
  mapEdge: string;
  /** Road on the maps: its full width, then a thin line down the middle. */
  mapRoad: [string, string];
  base: string;
  patchDark: string[];
  patchLight: string[];
  specks: string[];
  tuft: [string, string];
  clearing: string[];
  clearingRim: string[];
  clearingStone: string;
  path: [number, string[]][];
  /** Pebbles along the path, or plank seams for a boardwalk. */
  pathDetail: { kind: 'pebbles' | 'planks'; colors: string[] };
  flowers: string[];
  flowerCore: string;
  edge: string;
  /** Murky water pools scattered off the path. */
  pools: number;
  /** Drifting mist sprites. */
  fog: number;
  portalGlow: string;
}

const PALETTES: Record<ZoneTheme, GroundPalette> = {
  forest: {
    tiles: { base: 'grass', dirt: 'dirt' },
    background: '#16301a',
    mapEdge: '#a8c070',
    mapRoad: ['rgba(206, 170, 112, 0.6)', 'rgba(240, 214, 160, 0.55)'],
    base: '#4e8a39',
    patchDark: ['#467f35', '#427a33', '#4a8337'],
    patchLight: ['#56933f', '#5b9842', '#528e3c'],
    specks: ['#3f7530', '#5a9842', '#36692a', '#6aa94c', '#47823a', '#7bb85a'],
    tuft: ['#356628', '#7fbf5c'],
    clearing: ['#96794f', '#9f8257', '#8f7450'],
    clearingRim: ['#7d6a45', '#86724c'],
    clearingStone: '#b5976b',
    path: [
      [4.8, ['#5c4528', '#654d2e']],
      [4.2, ['#8a6d47', '#967a52', '#7f6440']],
      [3.0, ['#a98b62', '#b49670', '#9c7f57', '#a98b62']],
    ],
    pathDetail: { kind: 'pebbles', colors: ['#8a6c48', '#b5976b', '#7a5e3e', '#c2a77c'] },
    flowers: ['#f5f1e0', '#f6d84a', '#ee8fb4', '#a9c9ff', '#ffffff'],
    flowerCore: '#c9a227',
    edge: 'rgba(10,35,12,0.45)',
    pools: 0,
    fog: 0,
    portalGlow: '#6affd0',
  },
  marsh: {
    tiles: { base: 'marsh', dirt: 'mud' },
    background: '#121c19',
    mapEdge: '#8a9460',
    mapRoad: ['rgba(150, 122, 84, 0.65)', 'rgba(214, 186, 138, 0.5)'],
    base: '#46573b',
    patchDark: ['#3e4f37', '#3a4b34', '#425239'],
    patchLight: ['#4e5e40', '#546343', '#4a5a3d'],
    specks: ['#3b4a30', '#56663e', '#31402c', '#5f6f45', '#4a5a38', '#6b7a4c'],
    tuft: ['#2d3b27', '#71844f'],
    clearing: ['#62543c', '#6a5b41', '#5a4e38'],
    clearingRim: ['#4e4632', '#574e38'],
    clearingStone: '#7a6a4c',
    path: [
      [4.2, ['#2e2116']],
      [3.5, ['#6a4f33', '#634a30']],
      [2.7, ['#7c5f3f', '#856846', '#75593a']],
    ],
    pathDetail: { kind: 'planks', colors: ['#3e2c1c', '#8a6c48'] },
    flowers: ['#c9b6e8', '#8fd0c0', '#e8e2c0'],
    flowerCore: '#6a5a8a',
    edge: 'rgba(8,16,14,0.55)',
    pools: 70,
    fog: 34,
    portalGlow: '#6affd0',
  },
  // A muted blue-grey rather than white, so characters and damage numbers stay readable.
  snow: {
    tiles: { base: 'snow', dirt: 'snow_path', water: 'ice', pave: 'snow_path' },
    background: '#101824',
    mapEdge: '#a9c4d8',
    mapRoad: ['rgba(92, 112, 132, 0.65)', 'rgba(196, 214, 228, 0.5)'],
    base: '#8296a8',
    patchDark: ['#7a8ea1', '#76899c', '#7e92a4'],
    patchLight: ['#8a9daf', '#8fa2b3', '#869aab'],
    specks: ['#7588a0', '#92a5b6', '#6d8097', '#9aacbc', '#7f92a5', '#a4b5c4'],
    tuft: ['#6a7d92', '#a8b9c8'],
    clearing: ['#6f8295', '#76899b', '#6a7d90'],
    clearingRim: ['#62758a', '#687b8f'],
    clearingStone: '#93a6b7',
    path: [
      [4.6, ['#5b6c7f', '#5f7083']],
      [3.9, ['#6d7e91', '#708194', '#69798c']],
      [2.8, ['#7a8b9d', '#7f90a1', '#758699', '#7a8b9d']],
    ],
    pathDetail: { kind: 'pebbles', colors: ['#66778a', '#93a4b4', '#596a7c', '#a4b4c2'] },
    flowers: ['#c8dcea', '#b4cfe0', '#dbe8f0'],
    flowerCore: '#a0bed2',
    edge: 'rgba(8,14,24,0.5)',
    pools: 0,
    fog: 8,
    portalGlow: '#8fdcff',
  },
  // Dark, but lifted well off black, so characters stay the brightest thing on screen.
  volcano: {
    tiles: { base: 'ash_rock', dirt: 'ash_path', water: 'lava', pave: 'ash_path' },
    background: '#140d0e',
    mapEdge: '#c0764a',
    mapRoad: ['rgba(70, 58, 54, 0.7)', 'rgba(190, 160, 140, 0.5)'],
    base: '#4a4342',
    patchDark: ['#443d3d', '#403a3a', '#474040'],
    patchLight: ['#524a48', '#574e4b', '#4f4745'],
    specks: ['#3e3838', '#5a514e', '#363031', '#625854', '#4b4443', '#6a5f5a'],
    tuft: ['#332d2d', '#6a4e3e'],
    clearing: ['#5a4a42', '#615047', '#54453e'],
    clearingRim: ['#463b37', '#4d413c'],
    clearingStone: '#6e5e54',
    path: [
      [4.6, ['#332c2b', '#37302e']],
      [3.9, ['#5c5250', '#5f5553', '#584e4c']],
      [2.8, ['#6b605c', '#70645f', '#675c58', '#6b605c']],
    ],
    pathDetail: { kind: 'pebbles', colors: ['#524846', '#7c6f69', '#463d3b', '#8a7c75'] },
    flowers: ['#ff9a4a', '#e87a3a', '#ffc070'],
    flowerCore: '#c8501a',
    edge: 'rgba(14,8,8,0.55)',
    pools: 0,
    fog: 10,
    portalGlow: '#ffb06a',
  },
};

/** Draws a zone: painted ground plus the props laid out by the shared Terrain. */
export class World {
  readonly groundCanvas: HTMLCanvasElement;
  readonly half: number;
  readonly bound: number;
  private readonly pal: GroundPalette;
  private readonly fadeables: Fadeable[] = [];
  private readonly flames: THREE.Sprite[] = [];
  private readonly portals: THREE.Sprite[] = [];
  private readonly fog: Fog[] = [];
  private snow: { geo: THREE.BufferGeometry; speeds: Float32Array } | null = null;
  /** Glow over the lava pools and along the cracks, pulsing slowly. */
  private readonly lavaGlows: THREE.Material[] = [];
  /** Everything added to the scene, so a zone change can take it all down again. */
  private readonly objects: THREE.Object3D[] = [];
  private readonly ownMats: THREE.Material[] = [];
  private readonly ownGeos: THREE.BufferGeometry[] = [];
  private readonly sharedMats = new Map<string, THREE.SpriteMaterial>();
  private readonly shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private readonly groundTex: THREE.CanvasTexture;
  private readonly groundMesh: THREE.Mesh;
  /** The whole zone drawn for the maps, turned 45 degrees to match the camera. See bakeMap. */
  readonly mapImage = document.createElement('canvas');
  private groundCover: THREE.CanvasTexture | null = null;
  private groundUniforms: Record<string, THREE.IUniform> | null = null;
  /** Scratch canvas for paintBand; released once the ground is painted. */
  private maskCtx: CanvasRenderingContext2D | null = null;
  /** Water shapes, so flowers don't grow on the pools. */
  private poolBlobs: { x: number; z: number; rx: number; rz: number }[] = [];
  private t = 0;
  /** The land's broken shoreline. */
  private readonly outline: IslandOutline;
  /** The props actually drawn: the rim forest has gaps in it, and nothing stands out over space. */
  private readonly props: PropSpec[];
  private readonly spaceTex: THREE.CanvasTexture;
  private readonly pieceUniforms: Record<string, THREE.IUniform>;

  constructor(private readonly scene: THREE.Scene, private readonly terrain: Terrain) {
    this.half = terrain.half;
    this.bound = terrain.bound;
    this.pal = PALETTES[terrain.zone.theme];
    this.outline = new IslandOutline(this.half, this.bound, terrain.zone.seed + 21);
    this.props = this.visibleProps(mulberry32(terrain.zone.seed + 23));
    this.spaceTex = new THREE.CanvasTexture(paintSpace());
    this.spaceTex.colorSpace = THREE.SRGBColorSpace;
    this.spaceTex.wrapS = this.spaceTex.wrapT = THREE.RepeatWrapping;
    this.spaceTex.magFilter = this.spaceTex.minFilter = THREE.NearestFilter;
    this.spaceTex.generateMipmaps = false;
    scene.background = this.spaceTex;
    this.pieceUniforms = {
      uTime: { value: 0 },
      uHalf: { value: this.half },
      uRight: { value: CAM_RIGHT },
      uUp: { value: CAM_UP },
    };
    this.shadowMat = new THREE.MeshBasicMaterial({ map: fxTex.shadow, transparent: true, depthWrite: false, opacity: 0.4 });

    this.groundCanvas = this.paintGround(mulberry32(terrain.zone.seed));
    const t = this.pal.tiles;
    const tiles = [groundTiles[t.base], groundTiles[t.dirt], groundTiles[t.water ?? 'water'], groundTiles[t.pave ?? 'pave']];
    if (tiles.every(Boolean)) {
      const mask = new THREE.CanvasTexture(this.paintMask());
      mask.colorSpace = THREE.NoColorSpace;
      mask.flipY = false;
      mask.magFilter = THREE.NearestFilter;
      mask.minFilter = THREE.NearestFilter;
      mask.generateMipmaps = false;
      this.groundTex = mask;
      this.groundUniforms = {
        uMask: { value: mask },
        uCover: { value: (this.groundCover = this.paintCover()) },
        uBase: { value: tiles[0] },
        uDirt: { value: tiles[1] },
        uWater: { value: tiles[2] },
        uPave: { value: tiles[3] },
        uHalf: { value: this.half },
        uBound: { value: this.bound },
        uTileUnits: { value: TILE_UNITS },
        uTime: { value: 0 },
        uBake: { value: 0 },
        // Ice doesn't flow.
        uFlow: { value: terrain.zone.iceLakes ? 0 : 1 },
      };
    } else {
      const tex = new THREE.CanvasTexture(this.groundCanvas);
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      this.groundTex = tex;
    }
    this.maskCtx = null;
    this.groundMesh = this.add(new THREE.Mesh(
      this.ownGeo(this.outline.groundGeometry()),
      this.own(this.groundUniforms
        ? new THREE.ShaderMaterial({ uniforms: this.groundUniforms, vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, side: THREE.DoubleSide })
        : new THREE.MeshBasicMaterial({ map: this.groundTex, side: THREE.DoubleSide })),
    ));

    this.addCliffs(mulberry32(terrain.zone.seed + 27));
    this.addShoreTufts(mulberry32(terrain.zone.seed + 28));
    this.addCracks(mulberry32(terrain.zone.seed + 29));
    this.addPieces(mulberry32(terrain.zone.seed + 31));

    for (const p of this.props) this.addProp(p.key, p.x, p.z, p.height, p.fade);
    const fire = terrain.props.find((p) => p.key === 'campfire');
    if (fire) this.flames.push(this.glow(fire.x, 0.5, fire.z, '#ffa040', 0.55));
    for (const p of terrain.zone.portals) this.portals.push(this.glow(p.x, 1.5, p.z, this.pal.portalGlow, 0.5));
    this.addFog(mulberry32(terrain.zone.seed + 7));
    if (terrain.zone.theme === 'snow') this.addSnow(mulberry32(terrain.zone.seed + 41));
    if (terrain.zone.theme === 'volcano') {
      this.addSnow(mulberry32(terrain.zone.seed + 41), { color: '#b8aca2', size: 2, opacity: 0.55, speed: [0.25, 0.7] });
      this.addEmberCracks(mulberry32(terrain.zone.seed + 43));
      for (const l of terrain.zone.lavaPools ?? []) {
        const mat = this.own(new THREE.MeshBasicMaterial({
          // Faint: the lava tile is bright already, and this only lifts the rock around it.
          map: fxTex.glow, color: '#5a2408', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        const halo = this.add(new THREE.Mesh(this.ownGeo(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2)), mat));
        halo.position.set(l.x, 0.04, l.z);
        halo.scale.set(l.rx * 1.5, 1, l.rz * 1.5);
        this.lavaGlows.push(mat);
      }
    }
    if (this.groundUniforms) {
      this.addDecor(mulberry32(terrain.zone.seed + 11));
      if (terrain.zone.theme === 'marsh') this.addPlanks(mulberry32(terrain.zone.seed + 13));
    }
  }

  private get zone() {
    return this.terrain.zone;
  }

  private get segs() {
    return this.terrain.pathSegments;
  }

  private distToPath(x: number, z: number): number {
    return this.terrain.distToPath(x, z);
  }

  private add<T extends THREE.Object3D>(o: T): T {
    this.scene.add(o);
    this.objects.push(o);
    return o;
  }

  private ownGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.ownGeos.push(g);
    return g;
  }

  private own<T extends THREE.Material>(m: T): T {
    this.ownMats.push(m);
    return m;
  }

  private glow(x: number, y: number, z: number, color: string, opacity: number): THREE.Sprite {
    const s = this.add(new THREE.Sprite(this.own(new THREE.SpriteMaterial({
      map: fxTex.glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity,
    }))));
    s.position.set(x, y, z);
    return s;
  }

  /** Where a world point lands on mapImage. */
  mapAt(x: number, z: number): [number, number] {
    const c = MAP_SIZE / 2;
    const s = this.mapScale;
    return [c + (x - z) * S * s, c + (x + z) * S * s];
  }

  /** Pixels of mapImage per world unit. */
  get mapScale(): number {
    return (MAP_SIZE * 0.96) / (2 * this.half * Math.SQRT2);
  }

  /** Border colour for the full map, to suit this zone. */
  get mapEdge(): string {
    return this.pal.mapEdge;
  }

  /**
   * Draws mapImage once: the real ground seen from above, then the zone's trees, rocks and camp on
   * it, so the maps always look like the place itself.
   */
  bakeMap(renderer: THREE.WebGLRenderer): void {
    const ground = this.groundUniforms ? this.readGround(renderer) : this.groundCanvas;
    const cv = this.mapImage;
    cv.width = cv.height = MAP_SIZE;
    const ctx = cv.getContext('2d')!;
    const c = MAP_SIZE / 2;
    const H = this.half;
    const s = this.mapScale;

    ctx.fillStyle = ctx.createPattern(paintSpace(), 'repeat')!;
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    this.bakeMapPieces(ctx);

    const shore = this.outline.points();
    const shorePath = (dy = 0) => {
      ctx.beginPath();
      for (const [x, z] of shore) {
        const [mx, my] = this.mapAt(x, z);
        ctx.lineTo(mx, my + dy);
      }
      ctx.closePath();
    };
    // The land's underside shows below its near shores.
    for (const [dy, colour] of [[MAP_SIZE * 0.022, '#241c2e'], [MAP_SIZE * 0.012, '#4a3a38']] as const) {
      shorePath(dy);
      ctx.fillStyle = colour;
      ctx.fill();
    }

    ctx.save();
    shorePath();
    ctx.clip();
    const a = ((2 * H) / ground.width) * s * S;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(a, a, -a, a, c, c - 2 * H * S * s);
    ctx.drawImage(ground, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();

    // Roads are too soft on the real ground to follow at this size, so they're marked over it.
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const [width, colour] of [[TRAIL_WIDTH[this.zone.theme] * s, this.pal.mapRoad[0]], [1.4 * s, this.pal.mapRoad[1]]] as const) {
      ctx.lineWidth = width;
      ctx.strokeStyle = colour;
      ctx.beginPath();
      for (const [ax, az, bx, bz] of this.segs) {
        ctx.moveTo(...this.mapAt(ax, az));
        ctx.lineTo(...this.mapAt(bx, bz));
      }
      ctx.stroke();
    }

    // Back to front, so nearer trees overlap the ones behind them.
    const props = this.props
      .filter((p) => p.height >= MAP_MIN_PROP && p.key !== 'portal')
      .sort((p, q) => p.x + p.z - (q.x + q.z));
    for (const p of props) {
      const sh = sheets[p.key];
      const h = p.height * s * MAP_PROP_SCALE;
      const w = h * sh.cellAspect;
      const [x, y] = this.mapAt(p.x, p.z);
      ctx.drawImage(sh.texture.image as CanvasImageSource, x - w / 2, y - h, w, h);
    }

    // Everything past the walkable area sinks into shadow, so the playable shape stands out.
    const B = this.bound;
    shorePath();
    ctx.moveTo(...this.mapAt(-B, -B));
    ctx.lineTo(...this.mapAt(B, -B));
    ctx.lineTo(...this.mapAt(B, B));
    ctx.lineTo(...this.mapAt(-B, B));
    ctx.closePath();
    ctx.fillStyle = 'rgba(4, 8, 6, 0.55)';
    ctx.fill('evenodd');

    ctx.lineWidth = 3;
    ctx.strokeStyle = this.pal.mapEdge;
    shorePath();
    ctx.stroke();
  }

  /** Rocks and star shards drifting around the island on the map picture. */
  private bakeMapPieces(ctx: CanvasRenderingContext2D): void {
    if (assetSources.island_debris !== 'file') return;
    const image = sheets.island_debris.texture.image as HTMLImageElement;
    const cw = image.width / 4;
    const ch = image.height / 3;
    const r = mulberry32(this.zone.seed + 33);
    for (let i = 0; i < 120; i++) {
      const [x, z] = this.outline.at(r() * 8, closeBias(r, 0.5, 34));
      const [mx, my] = this.mapAt(x, z);
      const shard = r() < 0.2;
      const cell = shard ? 8 + ((r() * 4) | 0) : (r() * 4) | 0;
      const size = shard ? rand(r, 10, 16) : rand(r, 6, 20);
      ctx.drawImage(image, (cell % 4) * cw, Math.floor(cell / 4) * ch, cw, ch, mx - size / 2, my - size / 2, size, size);
    }
  }

  /** The rim forest with gaps in it. Only trees whose colliders can't reach the walkable square are left out. */
  private visibleProps(r: Rng): PropSpec[] {
    return this.terrain.props.filter((p) => {
      if (Math.max(Math.abs(p.x), Math.abs(p.z)) - this.bound <= 1.5) return true;
      if (!this.outline.contains(p.x, p.z, 0.7)) return false;
      return r() > (this.outline.sparseness(p.x, p.z) > 0.56 ? 0.92 : 0.3);
    });
  }

  /** Broken rock under the two shores that face the camera. One mesh, as with the decor. */
  private addCliffs(r: Rng): void {
    const key = ISLAND_ART[this.zone.theme].cliff;
    if (assetSources[key] !== 'file') return;
    const positions: number[] = [];
    const uvs: number[] = [];
    const H = this.half;
    const span = 4 / H; // Past each end of the near shores by 4 world units.
    for (const layer of CLIFF_LAYERS) {
      for (let s = -span; s < 4 + span; s += rand(r, layer.step[0], layer.step[1]) / H) {
        const [sx, sz] = this.outline.at(s);
        const k = 1 - layer.inset / Math.max(Math.abs(sx), Math.abs(sz));
        const width = rand(r, layer.width[0], layer.width[1]);
        const height = width;
        const ax = sx * k;
        const ay = layer.y;
        const az = sz * k;
        const hx = (CAM_RIGHT.x * width) / 2;
        const hz = (CAM_RIGHT.z * width) / 2;
        const dx = CAM_UP.x * height;
        const dy = CAM_UP.y * height;
        const dz = CAM_UP.z * height;
        positions.push(
          ax - hx - dx, ay - dy, az - hz - dz,
          ax + hx - dx, ay - dy, az + hz - dz,
          ax + hx, ay, az + hz,
          ax - hx, ay, az - hz,
        );
        const cell = (r() * 8) | 0;
        const u0 = (cell % 4) / 4;
        const u1 = u0 + 1 / 4;
        const v1 = 1 - Math.floor(cell / 4) / 2;
        const v0 = v1 - 1 / 2;
        const [ul, ur] = r() < 0.5 ? [u0, u1] : [u1, u0];
        uvs.push(ul, v0, ur, v0, ur, v1, ul, v1);
      }
    }
    this.addQuads(key, positions, uvs);
  }

  /** Grass and weeds along the shore, all rooted on solid land just inside its crumbled edge. */
  private addShoreTufts(r: Rng): void {
    const set = DECOR[this.zone.theme];
    if (assetSources[set.key] !== 'file') return;
    const positions: number[] = [];
    const uvs: number[] = [];
    const step = 8 / (8 * this.half);
    for (let s = 0; s < 8; s += rand(r, 0.45, 1) * step) {
      const [x, z] = this.outline.at(s, -rand(r, 0.85, 1.7));
      const cell = pick(r, set.spots.verge);
      const size = DECOR_CELL_UNITS * rand(r, 0.85, 1.3);
      const hx = (CAM_RIGHT.x * size) / 2;
      const hz = (CAM_RIGHT.z * size) / 2;
      const dx = CAM_UP.x * size;
      const dy = CAM_UP.y * size;
      const dz = CAM_UP.z * size;
      positions.push(x - hx, 0.02, z - hz, x + hx, 0.02, z + hz, x + hx + dx, 0.02 + dy, z + hz + dz, x - hx + dx, 0.02 + dy, z - hz + dz);
      const u0 = (cell % set.cols) / set.cols;
      const u1 = u0 + 1 / set.cols;
      const v1 = 1 - Math.floor(cell / set.cols) / set.rows;
      const v0 = v1 - 1 / set.rows;
      const [ul, ur] = r() < 0.5 ? [u1, u0] : [u0, u1];
      uvs.push(ul, v0, ur, v0, ur, v1, ul, v1);
    }
    this.addQuads(set.key, positions, uvs);
  }

  /** Fissures in the land around the rim, where it's coming apart. */
  private addCracks(r: Rng): void {
    if (assetSources.island_cracks !== 'file') return;
    const positions: number[] = [];
    const uvs: number[] = [];
    let placed = 0;
    for (let i = 0; i < 600 && placed < 70; i++) {
      const size = rand(r, 3.6, 7.5);
      const [x, z] = this.outline.at(r() * 8, -rand(r, 0.8, 7));
      if (!this.outline.contains(x, z, size * 0.34)) continue;
      const a = r() * Math.PI * 2;
      const cx = Math.cos(a) * size * 0.5;
      const cz = Math.sin(a) * size * 0.5;
      positions.push(
        x - cx - cz, 0.015, z - cz + cx,
        x + cx - cz, 0.015, z + cz + cx,
        x + cx + cz, 0.015, z + cz - cx,
        x - cx + cz, 0.015, z - cz - cx,
      );
      const cell = (r() * 8) | 0;
      const u0 = (cell % 4) / 4;
      const v1 = 1 - Math.floor(cell / 4) / 2;
      uvs.push(u0, v1 - 0.5, u0 + 0.25, v1 - 0.5, u0 + 0.25, v1, u0, v1);
      placed++;
    }
    if (positions.length) this.addQuads('island_cracks', positions, uvs);
  }

  /** Rocks, star shards and slabs of land coming away from the island, and crumbs falling off it. */
  private addPieces(r: Rng): void {
    const slabsKey = ISLAND_ART[this.zone.theme].slabs;
    if (assetSources.island_debris !== 'file' || assetSources[slabsKey] !== 'file') return;
    const H = this.half;
    const cell = (cols: number, rows: number, i: number) => {
      const u0 = (i % cols) / cols;
      const v1 = 1 - Math.floor(i / cols) / rows;
      return { u0, u1: u0 + 1 / cols, v0: v1 - 1 / rows, v1 };
    };
    /** Distance past the zone's square of the shore at this point, which is never positive. */
    const shoreAt = (s: number) => {
      const [x, z] = this.outline.at(s);
      return Math.max(Math.abs(x), Math.abs(z)) - H;
    };
    const rocks = new PieceBatch(r);
    const halos = new PieceBatch(r);
    const slabs = new PieceBatch(r);

    const rock = (s: number, past: number, y: number, speed: number) => {
      const small = r() < 0.3;
      const large = !small && r() < 0.07;
      const half = small ? rand(r, 0.25, 0.55) : large ? rand(r, 2, 3.2) : rand(r, 0.55, 1.6);
      rocks.add({
        s, past, y, speed, w: half, h: half, spin: r() * 6.3, turn: rand(r, -0.3, 0.3), bob: rand(r, 0, 0.4),
        ...cell(4, 3, small ? 6 + ((r() * 2) | 0) : (r() * 4) | 0),
      });
    };
    const shard = (s: number, past: number, y: number, speed: number) => {
      const half = rand(r, 0.45, 1.15);
      const spin = r() * 6.3;
      const turn = rand(r, -0.5, 0.5);
      rocks.add({ s, past, y, speed, w: half, h: half, spin, turn, ...cell(4, 3, 8 + ((r() * 4) | 0)) });
      halos.add({ s, past, y, speed, w: half * 1.7, h: half * 1.7, u0: 0, u1: 1, v0: 0, v1: 1 });
    };

    // Circling the island, slow enough to read as drifting. Those low enough slide behind the land.
    for (let i = 0; i < 340; i++) rock(r() * 8, closeBias(r, -2, 46), -closeBias(r, 0.6, 30), rand(r, 0.25, 0.9));
    for (let i = 0; i < 70; i++) shard(r() * 8, closeBias(r, -1, 42), -closeBias(r, 0.6, 26), rand(r, 0.3, 1));
    // Hanging just off each shore. Behind the land they float high enough to be seen past its edge.
    for (let i = 0; i < 70; i++) rock(rand(r, 4, 8), closeBias(r, -3, 22), rand(r, -2, 3), 0);
    for (let i = 0; i < 18; i++) shard(rand(r, 4, 8), closeBias(r, -3, 20), rand(r, -1, 4), 0);
    for (let i = 0; i < 40; i++) rock(rand(r, -0.1, 4.1), closeBias(r, -1, 12), -rand(r, 1, 16), 0);
    // Rubble just coming loose along the far shores, which have no cliff to show.
    for (let i = 0; i < 70; i++) {
      const s = rand(r, 3.95, 8.05);
      rock(s, shoreAt(s) + rand(r, 0.1, 1.6), rand(r, -0.6, 0.6), 0);
    }
    // Crumbs of soil and stone dropping from the near cliffs.
    for (let i = 0; i < 100; i++) {
      const s = rand(r, -0.05, 4.05);
      const half = rand(r, 0.16, 0.48);
      rocks.add({
        s, past: shoreAt(s) + rand(r, 0.2, 1.8), y: -rand(r, 0, 2.5), speed: 0, w: half, h: half,
        spin: r() * 6.3, turn: rand(r, -1.4, 1.4), fall: [rand(r, 0.9, 2.4), rand(r, 10, 26)],
        ...cell(4, 3, 4 + ((r() * 4) | 0)),
      });
    }
    // Whole slabs of land, adrift. They hang low enough not to cover the walkable ground.
    for (let i = 0; i < 28; i++) {
      const near = i < 16;
      const s = near ? rand(r, -0.05, 4.05) : rand(r, 4, 8);
      const half = rand(r, 1.7, 3.8);
      const past = shoreAt(s) + (near ? closeBias(r, 1.5, 15) : closeBias(r, half * 0.6, 18));
      slabs.add({
        s, past, y: near ? -half * 0.9 - rand(r, 0, 7) : rand(r, -0.5, 3.5), speed: 0, w: half, h: half,
        bob: rand(r, 0.15, 0.5), ...cell(4, 2, (r() * 8) | 0),
      });
    }

    for (const [batch, map, glow] of [
      [rocks, sheets.island_debris.texture, false],
      [slabs, sheets[slabsKey].texture, false],
      [halos, fxTex.glow, true],
    ] as const) {
      const { mesh, geo, mat } = batch.build(map, this.pieceUniforms, glow);
      this.ownGeo(geo);
      this.own(mat);
      this.add(mesh);
    }
  }

  /** Renders the ground straight down into a canvas whose x and y run along world x and z. */
  private readGround(renderer: THREE.WebGLRenderer): HTMLCanvasElement {
    const H = this.half;
    const target = new THREE.WebGLRenderTarget(MAP_GROUND_SIZE, MAP_GROUND_SIZE);
    const cam = new THREE.OrthographicCamera(-H, H, H, -H, 0.1, 100);
    cam.position.set(0, 50, 0);
    cam.up.set(0, 0, -1);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    const uniforms = this.groundUniforms!;
    const before = renderer.getRenderTarget();
    uniforms.uBake.value = 1;
    renderer.setRenderTarget(target);
    renderer.render(this.groundMesh, cam);
    const pixels = new Uint8Array(MAP_GROUND_SIZE * MAP_GROUND_SIZE * 4);
    renderer.readRenderTargetPixels(target, 0, 0, MAP_GROUND_SIZE, MAP_GROUND_SIZE, pixels);
    renderer.setRenderTarget(before);
    uniforms.uBake.value = 0;
    target.dispose();

    const out = document.createElement('canvas');
    out.width = out.height = MAP_GROUND_SIZE;
    const ctx = out.getContext('2d')!;
    const image = ctx.createImageData(MAP_GROUND_SIZE, MAP_GROUND_SIZE);
    // WebGL's first row is the bottom one.
    const row = MAP_GROUND_SIZE * 4;
    for (let y = 0; y < MAP_GROUND_SIZE; y++) {
      image.data.set(pixels.subarray(y * row, (y + 1) * row), (MAP_GROUND_SIZE - 1 - y) * row);
    }
    ctx.putImageData(image, 0, 0);
    return out;
  }

  /** Adds many quads from one atlas as a single mesh, so hundreds of details cost one draw call. */
  private addQuads(key: string, positions: number[], uvs: number[]): void {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const index: number[] = [];
    for (let i = 0; i < positions.length / 12; i++) {
      const v = i * 4;
      index.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    geo.setIndex(index);
    const mesh = new THREE.Mesh(geo, this.own(new THREE.MeshBasicMaterial({ map: sheets[key].texture, alphaTest: 0.5 })));
    mesh.frustumCulled = false;
    this.ownGeos.push(geo);
    this.add(mesh);
  }

  /** Grass tufts, flowers, stones and the like, in clumps along roads, clearings and pool shores. */
  private addDecor(r: Rng): void {
    const set = DECOR[this.zone.theme];
    if (assetSources[set.key] !== 'file') return;
    const B = this.bound;
    const { start, boss, portals, spawns } = this.zone;
    const trail = TRAIL_WIDTH[this.zone.theme] / 2;
    const near = (x: number, z: number, p: { x: number; z: number }, d: number) => Math.hypot(x - p.x, z - p.z) < d;
    const inPool = (x: number, z: number, grow: number) =>
      this.poolBlobs.some((b) => Math.hypot((x - b.x) / (b.rx + grow), (z - b.z) / (b.rz + grow)) < 1);

    const right = new THREE.Vector3(S, 0, -S);
    const up = new THREE.Vector3().crossVectors(right, ISO_DIR.clone().negate()).normalize();
    const positions: number[] = [];
    const uvs: number[] = [];
    const place = (cell: number, x: number, z: number) => {
      const size = DECOR_CELL_UNITS * rand(r, 0.85, 1.15);
      const flip = r() < 0.5;
      const u0 = (cell % set.cols) / set.cols;
      const u1 = u0 + 1 / set.cols;
      const v1 = 1 - Math.floor(cell / set.cols) / set.rows;
      const v0 = v1 - 1 / set.rows;
      const rx = (right.x * size) / 2;
      const rz = (right.z * size) / 2;
      const ux = up.x * size;
      const uy = up.y * size;
      const uz = up.z * size;
      positions.push(x - rx, 0, z - rz, x + rx, 0, z + rz, x + rx + ux, uy, z + rz + uz, x - rx + ux, uy, z - rz + uz);
      const [ul, ur] = flip ? [u1, u0] : [u0, u1];
      uvs.push(ul, v0, ur, v0, ur, v1, ul, v1);
    };
    /** A clump of details around a point, skipping anything that would land somewhere odd. */
    const clump = (spot: DecorSpot, x: number, z: number, count: number, spread: number) => {
      const cells = set.spots[spot];
      if (!cells.length) return;
      for (let i = 0; i < count; i++) {
        const px = x + rand(r, -spread, spread);
        const pz = z + rand(r, -spread, spread);
        if (Math.abs(px) > B || Math.abs(pz) > B) continue;
        if (spot === 'water' ? !inPool(px, pz, -0.3) : inPool(px, pz, 0.5)) continue;
        if (spot !== 'road' && this.distToPath(px, pz) < trail + 0.2) continue;
        if (near(px, pz, start, CAMP_RADIUS * 0.8) || portals.some((g) => near(px, pz, g, 2.5))) continue;
        if (this.terrain.colliders.some((c) => near(px, pz, c, c.r + 0.3))) continue;
        place(pick(r, cells), px, pz);
      }
    };

    for (const [ax, az, bx, bz] of this.segs) {
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      for (let t = rand(r, 0, 2); t < len; t += rand(r, 1.8, 4)) {
        const f = t / len;
        const off = (r() < 0.5 ? -1 : 1) * (trail + rand(r, 0.5, 2.4));
        clump('verge', ax + (bx - ax) * f + nx * off, az + (bz - az) * f + nz * off, 1 + ((r() * 3) | 0), 0.7);
        if (r() < 0.12) {
          const across = rand(r, -trail * 0.6, trail * 0.6);
          clump('road', ax + (bx - ax) * f + nx * across, az + (bz - az) * f + nz * across, 1, 0.3);
        }
      }
    }
    for (const [c, rad, count] of [[start, CAMP_RADIUS + 1.2, 26], [boss, clearingRadius(this.zone) + 0.4, 34]] as const) {
      for (let i = 0; i < count; i++) {
        const a = r() * Math.PI * 2;
        clump('verge', c.x + Math.cos(a) * rad, c.z + Math.sin(a) * rad, 2, 0.8);
      }
    }
    for (const b of this.poolBlobs) {
      for (let i = 0; i < 2; i++) {
        const a = r() * Math.PI * 2;
        clump('shore', b.x + Math.cos(a) * (b.rx + 0.8), b.z + Math.sin(a) * (b.rz + 0.8), 1 + ((r() * 2) | 0), 0.4);
      }
      if (r() < 0.45) clump('water', b.x, b.z, 2, Math.min(b.rx, b.rz) * 0.6);
    }
    for (let i = 0; i < 520; i++) {
      const x = rand(r, -B, B);
      const z = rand(r, -B, B);
      // Thin in the hunting grounds, so monsters stay easy to see.
      if (spawns.some((sp) => near(x, z, sp, sp.radius * 0.6)) && r() < 0.7) continue;
      clump('field', x, z, 2 + ((r() * 4) | 0), 1.3);
    }
    this.addQuads(set.key, positions, uvs);
  }

  /** Short runs of old boards lying flat across the trail, instead of a boardwalk all the way. */
  private addPlanks(r: Rng): void {
    const { key, cols, width, length } = PLANK_SHEET;
    if (assetSources[key] !== 'file') return;
    const { start, boss } = this.zone;
    const positions: number[] = [];
    const uvs: number[] = [];
    for (const [ax, az, bx, bz] of this.segs) {
      const dist = Math.hypot(bx - ax, bz - az);
      for (let t = rand(r, 3, 8); t < dist - 3; t += rand(r, 11, 20)) {
        const f = t / dist;
        const x = ax + (bx - ax) * f;
        const z = az + (bz - az) * f;
        if (Math.hypot(x - start.x, z - start.z) < CAMP_RADIUS + 3 || Math.hypot(x - boss.x, z - boss.z) < clearingRadius(this.zone) + 1) continue;
        const a = Math.atan2(bz - az, bx - ax) + rand(r, -0.12, 0.12);
        const along = [Math.cos(a), Math.sin(a)];
        const across = [-along[1], along[0]];
        const hw = (width / 2) * rand(r, 0.9, 1.05);
        const hl = (length / 2) * rand(r, 0.8, 1.2);
        for (const [sa, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          positions.push(x + across[0] * hw * sa + along[0] * hl * sb, 0.01, z + across[1] * hw * sa + along[1] * hl * sb);
        }
        const cell = (r() * cols) | 0;
        uvs.push(cell / cols, 1, (cell + 1) / cols, 1, (cell + 1) / cols, 0, cell / cols, 0);
      }
    }
    if (positions.length) this.addQuads(key, positions, uvs);
  }

  /** Big soft mist blobs drifting slowly over the zone. */
  private addFog(r: Rng): void {
    const B = this.bound;
    for (let i = 0; i < this.pal.fog; i++) {
      const base = rand(r, 0.09, 0.17);
      const spr = this.add(new THREE.Sprite(this.own(new THREE.SpriteMaterial({
        map: fxTex.mist, color: '#d8e6e0', transparent: true, depthWrite: false, depthTest: false, opacity: base,
      }))));
      const size = rand(r, 12, 22);
      spr.scale.set(size, size * 0.55, 1);
      spr.position.set(rand(r, -B, B), rand(r, 0.8, 2.2), rand(r, -B, B));
      spr.renderOrder = 5;
      this.fog.push({ spr, vx: rand(r, 0.25, 0.6), vz: rand(r, -0.3, 0.3), base, phase: r() * Math.PI * 2 });
    }
  }

  /** Flakes falling in a box that follows the player, so there is no need for many of them. */
  private addSnow(r: Rng, look: { color: string; size: number; opacity: number; speed: [number, number] } = { color: '#eef5fb', size: 3, opacity: 0.8, speed: [0.9, 1.9] }): void {
    const positions = new Float32Array(SNOW_FLAKES * 3);
    const speeds = new Float32Array(SNOW_FLAKES);
    for (let i = 0; i < SNOW_FLAKES; i++) {
      positions[i * 3] = rand(r, 0, SNOW_BOX);
      positions[i * 3 + 1] = rand(r, 0, SNOW_HEIGHT);
      positions[i * 3 + 2] = rand(r, 0, SNOW_BOX);
      speeds[i] = rand(r, look.speed[0], look.speed[1]);
    }
    const geo = this.ownGeo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = this.add(new THREE.Points(geo, this.own(new THREE.PointsMaterial({
      color: look.color, size: look.size, sizeAttenuation: false, transparent: true, opacity: look.opacity, depthWrite: false,
    }))));
    points.frustumCulled = false;
    points.renderOrder = 6;
    this.snow = { geo, speeds };
  }

  /** Drops the flakes, wrapping each one around so it stays within the box around the player. */
  private updateSnow(dt: number, px: number, pz: number): void {
    if (!this.snow) return;
    const { geo, speeds } = this.snow;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const wrap = (v: number, around: number) => around - SNOW_BOX / 2 + ((((v - around + SNOW_BOX / 2) % SNOW_BOX) + SNOW_BOX) % SNOW_BOX);
    for (let i = 0; i < speeds.length; i++) {
      const y = pos.getY(i) - speeds[i] * dt;
      pos.setXYZ(
        i,
        wrap(pos.getX(i) + Math.sin(this.t * 0.5 + i) * 0.4 * dt, px),
        y < 0 ? SNOW_HEIGHT : y,
        wrap(pos.getZ(i) + 0.25 * dt, pz),
      );
    }
    pos.needsUpdate = true;
  }

  /** Thin glowing cracks across the rock. Only decoration: walking on them is safe, unlike the pools. */
  private addEmberCracks(r: Rng): void {
    const B = this.bound - 4;
    const { start, boss } = this.zone;
    const pos: number[] = [];
    for (let made = 0, tries = 0; made < 26 && tries < 400; tries++) {
      let x = rand(r, -B, B);
      let z = rand(r, -B, B);
      if (Math.hypot(x - start.x, z - start.z) < CAMP_RADIUS + 5 || Math.hypot(x - boss.x, z - boss.z) < clearingRadius(this.zone) + 1) continue;
      if (this.terrain.onLava(x, z) || this.terrain.distToPath(x, z) < 3) continue;
      made++;
      let a = r() * Math.PI * 2;
      for (let s = 0, n = 3 + ((r() * 4) | 0); s < n; s++) {
        a += rand(r, -0.8, 0.8);
        const len = rand(r, 0.8, 1.8);
        const nx = x + Math.cos(a) * len;
        const nz = z + Math.sin(a) * len;
        const w = rand(r, 0.05, 0.11);
        const px = -Math.sin(a) * w;
        const pz = Math.cos(a) * w;
        pos.push(x + px, 0.03, z + pz, x - px, 0.03, z - pz, nx + px, 0.03, nz + pz, nx + px, 0.03, nz + pz, x - px, 0.03, z - pz, nx - px, 0.03, nz - pz);
        x = nx;
        z = nz;
      }
    }
    const geo = this.ownGeo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = this.own(new THREE.MeshBasicMaterial({ color: '#f0641e', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    this.add(new THREE.Mesh(geo, mat));
    this.lavaGlows.push(mat);
  }

  /** Takes everything this zone added back out of the scene. */
  dispose(): void {
    for (const o of this.objects) this.scene.remove(o);
    for (const m of this.ownMats) m.dispose();
    for (const g of this.ownGeos) g.dispose();
    for (const m of this.sharedMats.values()) m.dispose();
    this.shadowGeo.dispose();
    this.shadowMat.dispose();
    this.groundTex.dispose();
    this.groundCover?.dispose();
    this.spaceTex.dispose();
  }

  /** Fade trees that stand between the camera and the player. */
  update(dt: number, px: number, pz: number): void {
    this.t += dt;
    if (this.groundUniforms) this.groundUniforms.uTime.value = this.t;
    this.pieceUniforms.uTime.value = this.t;
    this.updateSnow(dt, px, pz);
    // Space slides past far slower than the land, as if very far behind it.
    const tile = paintSpace().width * SPACE_PIXEL;
    this.spaceTex.repeat.set(window.innerWidth / tile, window.innerHeight / tile);
    this.spaceTex.offset.set(((px - pz) * S * SPACE_DRIFT) / tile, (-(px + pz) * S * SPACE_DRIFT) / tile);
    for (const f of this.fadeables) {
      const depth = f.x + f.z - (px + pz);
      let target = 1;
      if (depth > 0 && depth < f.h * 1.9) {
        const sdx = (f.x - f.z - (px - pz)) * S;
        if (Math.abs(sdx) < f.w * 0.42) target = 0.35;
      }
      if (target === f.o) continue;
      f.o += (target - f.o) * Math.min(1, dt * 10);
      if (Math.abs(f.o - target) < 0.01) f.o = target;
      const faded = f.o < 0.99;
      f.mat.transparent = faded;
      f.mat.depthWrite = !faded;
      f.mat.alphaTest = faded ? 0.05 : 0.5;
      f.mat.opacity = f.o;
    }
    for (const g of this.lavaGlows) g.opacity = 0.55 + Math.sin(this.t * 1.7) * 0.2;
    for (const fl of this.flames) {
      const k = 1 + Math.sin(this.t * 13) * 0.08 + Math.sin(this.t * 7.3) * 0.06;
      fl.scale.set(3.2 * k, 3.2 * k, 1);
    }
    for (const p of this.portals) {
      const k = 1 + Math.sin(this.t * 2.4) * 0.12;
      p.scale.set(4.6 * k, 5 * k, 1);
      (p.material as THREE.SpriteMaterial).opacity = 0.4 + Math.sin(this.t * 3.1) * 0.12;
    }
    const B = this.bound;
    for (const f of this.fog) {
      const s = f.spr.position;
      s.x += f.vx * dt;
      s.z += f.vz * dt;
      if (s.x > B) s.x = -B;
      if (s.z > B) s.z = -B;
      if (s.z < -B) s.z = B;
      (f.spr.material as THREE.SpriteMaterial).opacity = f.base * (0.75 + 0.25 * Math.sin(this.t * 0.4 + f.phase));
    }
  }

  private addProp(key: string, x: number, z: number, height: number, fade: boolean): void {
    const sh = sheets[key];
    let mat: THREE.SpriteMaterial;
    if (fade) {
      mat = this.own(new THREE.SpriteMaterial({ map: sh.texture, alphaTest: 0.5, transparent: false }));
    } else {
      mat = this.sharedMats.get(key) ?? new THREE.SpriteMaterial({ map: sh.texture, alphaTest: 0.5, transparent: false });
      this.sharedMats.set(key, mat);
    }
    const spr = this.add(new THREE.Sprite(mat));
    const w = height * sh.cellAspect;
    spr.center.set(0.5, 0.03);
    spr.scale.set(w, height, 1);
    spr.position.set(x, 0, z);
    const sd = this.add(new THREE.Mesh(this.shadowGeo, this.shadowMat));
    sd.scale.set(w * 0.8, 1, w * 0.45);
    sd.position.set(x, 0.015, z);
    if (fade) this.fadeables.push({ mat, x, z, w, h: height, o: 1 });
  }

  /** Darkens everything outside the walkable area. */
  private paintEdge(ctx: CanvasRenderingContext2D, P: (x: number, z: number) => [number, number]): void {
    const N = ctx.canvas.width;
    const [lo] = P(-this.bound, 0);
    const [hi] = P(this.bound, 0);
    ctx.fillStyle = this.pal.edge;
    ctx.fillRect(0, 0, N, lo);
    ctx.fillRect(0, hi, N, N - hi);
    ctx.fillRect(0, lo, lo, hi - lo);
    ctx.fillRect(hi, lo, N - hi, hi - lo);
  }

  private paintGround(r: Rng): HTMLCanvasElement {
    const N = 2048;
    const H = this.half;
    const k = N / (2 * H);
    const pal = this.pal;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d')!;
    const P = (x: number, z: number): [number, number] => [(x + H) * k, (z + H) * k];

    ctx.fillStyle = pal.base;
    ctx.fillRect(0, 0, N, N);
    // Grass patches: overlapping hard-edged blobs of darker and lighter ground.
    const patches = (count: number) => (m: CanvasRenderingContext2D) => {
      m.beginPath();
      for (let i = 0; i < count; i++) {
        const x = r() * N;
        const y = r() * N;
        const rad = 14 + r() * 80;
        m.moveTo(x + rad, y);
        m.ellipse(x, y, rad, rad * (0.6 + r() * 0.4), 0, 0, Math.PI * 2);
      }
      m.fill();
    };
    this.paintBand(ctx, pal.patchDark, 3, patches(260));
    this.paintBand(ctx, pal.patchLight, 3, patches(200));
    const specks = pal.specks;
    for (let i = 0; i < 70000; i++) {
      ctx.fillStyle = specks[(r() * specks.length) | 0];
      ctx.fillRect((r() * N) | 0, (r() * N) | 0, 2 + ((r() * 2) | 0), 2);
    }
    for (let i = 0; i < 9000; i++) {
      const x = (r() * N) | 0;
      const y = (r() * N) | 0;
      ctx.fillStyle = pal.tuft[0];
      ctx.fillRect(x, y, 1, 4);
      ctx.fillRect(x + 2, y + 1, 1, 3);
      ctx.fillStyle = pal.tuft[1];
      ctx.fillRect(x + 1, y, 1, 2);
    }

    if (pal.pools) this.paintPools(ctx, r, P, k);
    if (this.zone.iceLakes) this.paintIce(ctx, r, P, k);
    if (this.zone.lavaPools) this.paintLava(ctx, r, P, k);

    // Bare ground around the camp and the boss: a rough outer rim, then packed dirt with stones.
    const clearings: [number, number, number][] = [
      [this.zone.start.x, this.zone.start.z, 7],
      [this.zone.boss.x, this.zone.boss.z, clearingRadius(this.zone) - 1],
    ];
    const clearing = (scale: number) => (m: CanvasRenderingContext2D) => {
      m.beginPath();
      for (const [x, z, rad] of clearings) {
        const [px, py] = P(x, z);
        m.moveTo(px + rad * scale * k, py);
        m.arc(px, py, rad * scale * k, 0, Math.PI * 2);
      }
      m.fill();
    };
    this.paintBand(ctx, pal.clearingRim, 3, clearing(1));
    this.paintBand(ctx, pal.clearing, 3, clearing(0.84));
    for (const [cx, cz, rad] of clearings) {
      for (let i = 0; i < rad * 12; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * rad * 0.8;
        const [px, py] = P(cx + Math.cos(a) * d, cz + Math.sin(a) * d);
        const x = px | 0;
        const y = py | 0;
        ctx.fillStyle = pal.clearingRim[0];
        ctx.fillRect(x, y + 1, 3, 1);
        ctx.fillStyle = pal.clearingStone;
        ctx.fillRect(x, y, 3, 1);
      }
    }

    const lines = [this.zone.path, ...this.zone.branches];
    const detail = pal.pathDetail;
    // Dirt roads get a wobbly edge; a boardwalk is built, so its edge stays straight.
    const roadWobble = detail.kind === 'planks' ? 0 : 2;
    for (const [w, tones] of pal.path) {
      this.paintBand(ctx, tones, roadWobble, (m) => {
        m.lineCap = 'round';
        m.lineJoin = 'round';
        m.lineWidth = w * k;
        for (const l of lines) {
          m.beginPath();
          l.forEach(([x, z], i) => {
            const [px, py] = P(x, z);
            if (i) m.lineTo(px, py);
            else m.moveTo(px, py);
          });
          m.stroke();
        }
      });
    }
    if (detail.kind === 'planks') {
      // Boardwalk: a seam across the walkway every half unit, with a lighter edge beside it.
      const half = (pal.path[pal.path.length - 1][0] / 2) * 0.95;
      const seams = (width: number, shift: number) => (m: CanvasRenderingContext2D) => {
        m.lineWidth = width;
        m.beginPath();
        for (const [ax, az, bx, bz] of this.segs) {
          const len = Math.hypot(bx - ax, bz - az);
          const nx = -(bz - az) / len;
          const nz = (bx - ax) / len;
          for (let t = 0; t < len; t += 0.55) {
            const f = t / len;
            const cx = ax + (bx - ax) * f;
            const cz = az + (bz - az) * f;
            const [x0, y0] = P(cx - nx * half, cz - nz * half);
            const [x1, y1] = P(cx + nx * half, cz + nz * half);
            m.moveTo(x0 + shift, y0 + shift);
            m.lineTo(x1 + shift, y1 + shift);
          }
        }
        m.stroke();
      };
      this.paintBand(ctx, [detail.colors[0]], 0, seams(2.5, 0));
      this.paintBand(ctx, [detail.colors[1]], 0, seams(1.5, 2));
    } else {
      for (const [ax, az, bx, bz] of this.segs) {
        const len = Math.hypot(bx - ax, bz - az);
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        // Small stones: a lit top and a shaded bottom so they read as pixel-art pebbles.
        for (let t = 0; t < len; t += 0.5) {
          const f = t / len;
          const [px, py] = P(ax + (bx - ax) * f + rand(r, -1.5, 1.5), az + (bz - az) * f + rand(r, -1.5, 1.5));
          const x = px | 0;
          const y = py | 0;
          const w = 3 + ((r() * 3) | 0);
          ctx.fillStyle = detail.colors[0];
          ctx.fillRect(x, y, w, 3);
          ctx.fillStyle = detail.colors[3];
          ctx.fillRect(x, y, w - 1, 1);
          ctx.fillStyle = detail.colors[2];
          ctx.fillRect(x, y + 2, w, 1);
        }
        // Grass tufts growing over both road edges hide the join with the ground.
        for (let t = 0; t < len; t += 0.4) {
          const f = t / len;
          const side = r() < 0.5 ? -1 : 1;
          const off = side * rand(r, 2.0, 2.5);
          const [px, py] = P(ax + (bx - ax) * f + nx * off, az + (bz - az) * f + nz * off);
          const x = px | 0;
          const y = py | 0;
          ctx.fillStyle = pal.tuft[0];
          ctx.fillRect(x, y, 1, 4);
          ctx.fillRect(x + 2, y + 1, 1, 3);
          ctx.fillStyle = pal.tuft[1];
          ctx.fillRect(x + 1, y, 1, 2);
        }
      }
    }

    for (let i = 0; i < 700; i++) {
      const x = rand(r, -H, H);
      const z = rand(r, -H, H);
      if (this.distToPath(x, z) < 3) continue;
      if (this.poolBlobs.some((b) => Math.hypot((x - b.x) / (b.rx + 2), (z - b.z) / (b.rz + 2)) < 1)) continue;
      const col = pick(r, pal.flowers);
      const n = 3 + ((r() * 7) | 0);
      for (let j = 0; j < n; j++) {
        const [px, py] = P(x + rand(r, -1.2, 1.2), z + rand(r, -1.2, 1.2));
        ctx.fillStyle = col;
        ctx.fillRect(px | 0, py | 0, 3, 3);
        ctx.fillStyle = pal.flowerCore;
        ctx.fillRect((px | 0) + 1, (py | 0) + 1, 1, 1);
      }
    }

    const [lo] = P(-this.bound, 0);
    const [hi] = P(this.bound, 0);
    ctx.fillStyle = pal.edge;
    ctx.fillRect(0, 0, N, lo);
    ctx.fillRect(0, hi, N, N - hi);
    ctx.fillRect(0, lo, lo, hi - lo);
    ctx.fillRect(hi, lo, N - hi, hi - lo);
    return c;
  }

  /**
   * Fills a shape with hard pixel edges and no blending. `draw` marks the shape in solid white on
   * a scratch canvas; every marked ground pixel then takes one of `tones`, in small clumps.
   * `ripple` lays the tones in short horizontal strokes, like still water.
   */
  private paintBand(
    ctx: CanvasRenderingContext2D,
    tones: string[],
    wobble: number,
    draw: (mask: CanvasRenderingContext2D) => void,
    ripple = false,
  ): void {
    const N = ctx.canvas.width;
    if (!this.maskCtx) {
      const scratch = document.createElement('canvas');
      scratch.width = scratch.height = N;
      this.maskCtx = scratch.getContext('2d', { willReadFrequently: true })!;
    }
    const m = this.maskCtx;
    m.clearRect(0, 0, N, N);
    m.fillStyle = m.strokeStyle = '#fff';
    draw(m);
    const src = m.getImageData(0, 0, N, N).data;
    const image = ctx.getImageData(0, 0, N, N);
    const dst = image.data;
    const rgb = tones.map((t) => [parseInt(t.slice(1, 3), 16), parseInt(t.slice(3, 5), 16), parseInt(t.slice(5, 7), 16)]);
    const wave = new Int8Array((N >> 2) + 1);
    for (let i = 0; i < wave.length; i++) wave[i] = Math.round((wobble * (Math.sin(i * 1.7) + Math.sin(i * 0.53))) / 2);
    for (let y = 0; y < N; y++) {
      const wx = wave[y >> 2];
      for (let x = 0; x < N; x++) {
        const sx = x + wx;
        const sy = y + wave[x >> 2];
        if (sx < 0 || sy < 0 || sx >= N || sy >= N || src[(sy * N + sx) * 4 + 3] < 128) continue;
        const cell = ripple
          ? Math.imul((x + (y >> 2) * 11) >> 3, 73856093) ^ Math.imul(y >> 1, 19349663)
          : Math.imul(x >> 1, 73856093) ^ Math.imul(y >> 1, 19349663);
        const c = rgb[(cell >>> 7) % rgb.length];
        const d = (y * N + x) * 4;
        dst[d] = c[0];
        dst[d + 1] = c[1];
        dst[d + 2] = c[2];
        dst[d + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  /** Map of the pools for the ground shader: red holds a GroundId. Call paintGround first, which lays them out. */
  private paintMask(): HTMLCanvasElement {
    const N = 2048;
    const H = this.half;
    const k = N / (2 * H);
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, N, N);
    const hex = (v: number) => v.toString(16).padStart(2, '0');
    const pool = (id: GroundId, grow: number) => {
      this.paintBand(ctx, [`#${hex(id * 16)}0000`], 2, (m) => {
        m.beginPath();
        for (const b of this.poolBlobs) {
          const px = (b.x + H) * k;
          const rx = Math.max(0.1, b.rx + grow) * k;
          m.moveTo(px + rx, (b.z + H) * k);
          m.ellipse(px, (b.z + H) * k, rx, Math.max(0.1, b.rz + grow) * k, 0, 0, Math.PI * 2);
        }
        m.fill();
      });
    };
    if (this.poolBlobs.length) {
      pool(GroundId.WaterEdge, 0.25);
      pool(GroundId.Water, 0.1);
    }
    return c;
  }

  /**
   * Soft map of what the ground is worn down to, which the ground shader breaks up into irregular
   * patches: red is bare ground (roads, clearings, pond banks), green is paving. Its low resolution
   * and smooth filtering give the gradual falloff the shader needs.
   */
  private paintCover(): THREE.CanvasTexture {
    const N = 256;
    const H = this.half;
    const k = N / (2 * H);
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, N, N);
    ctx.globalCompositeOperation = 'lighter';
    const P = (x: number, z: number): [number, number] => [(x + H) * k, (z + H) * k];
    const circle = (x: number, z: number, rad: number) => {
      const [px, py] = P(x, z);
      ctx.beginPath();
      ctx.arc(px, py, rad * k, 0, Math.PI * 2);
      ctx.fill();
    };
    const { start, boss } = this.zone;

    ctx.fillStyle = ctx.strokeStyle = '#ff0000';
    circle(start.x, start.z, CAMP_RADIUS);
    circle(boss.x, boss.z, clearingRadius(this.zone) - 1);
    for (const b of this.poolBlobs) {
      const [px, py] = P(b.x, b.z);
      ctx.beginPath();
      ctx.ellipse(px, py, (b.rx + 1) * k, (b.rz + 1) * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.lineWidth = TRAIL_WIDTH[this.terrain.zone.theme] * k;
    ctx.beginPath();
    for (const [ax, az, bx, bz] of this.segs) {
      ctx.moveTo(...P(ax, az));
      ctx.lineTo(...P(bx, bz));
    }
    ctx.stroke();

    ctx.fillStyle = '#00ff00';
    circle(start.x, start.z, CAMP_RADIUS * 0.72);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = false;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  /** Lava pools where the zone says they are: a dark burnt rim, then bright molten rock. */
  private paintLava(ctx: CanvasRenderingContext2D, r: Rng, P: (x: number, z: number) => [number, number], k: number): void {
    const pools = this.zone.lavaPools!;
    this.poolBlobs = pools.map((l) => ({ ...l }));
    const fill = (grow: number) => (m: CanvasRenderingContext2D) => {
      m.beginPath();
      for (const l of pools) {
        const [px, py] = P(l.x, l.z);
        m.moveTo(px + (l.rx + grow) * k, py);
        m.ellipse(px, py, (l.rx + grow) * k, (l.rz + grow) * k, 0, 0, Math.PI * 2);
      }
      m.fill();
    };
    this.paintBand(ctx, ['#251a18', '#2e201c'], 2, fill(0.5));
    this.paintBand(ctx, ['#d8501a', '#e05a1e', '#c84a18'], 2, fill(0), true);
    this.paintBand(ctx, ['#ff8a2a', '#ff9a34', '#f57e24'], 2, fill(-1), true);
    for (const l of pools) {
      for (let i = 0; i < (l.rx + l.rz) * 3; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * 0.7;
        const [x, y] = P(l.x + Math.cos(a) * l.rx * d, l.z + Math.sin(a) * l.rz * d);
        ctx.fillStyle = '#ffd97a';
        ctx.fillRect(x | 0, y | 0, 3, 2);
      }
    }
  }

  /** Frozen lakes where the zone says they are (they matter to the rules, unlike the marsh's pools). */
  private paintIce(ctx: CanvasRenderingContext2D, r: Rng, P: (x: number, z: number) => [number, number], k: number): void {
    const lakes = this.zone.iceLakes!;
    this.poolBlobs = lakes.map((l) => ({ ...l }));
    const fill = (grow: number) => (m: CanvasRenderingContext2D) => {
      m.beginPath();
      for (const l of lakes) {
        const [px, py] = P(l.x, l.z);
        m.moveTo(px + (l.rx + grow) * k, py);
        m.ellipse(px, py, (l.rx + grow) * k, (l.rz + grow) * k, 0, 0, Math.PI * 2);
      }
      m.fill();
    };
    this.paintBand(ctx, ['#566a7e', '#5c7084'], 2, fill(0.4));
    this.paintBand(ctx, ['#7fb0cc', '#86b6d0', '#7aabc8'], 2, fill(0), true);
    this.paintBand(ctx, ['#93c2da', '#9ac8df', '#8ebed7'], 2, fill(-1.2), true);
    // Pale cracks and glints, so it reads as ice and not water.
    for (const l of lakes) {
      for (let i = 0; i < (l.rx + l.rz) * 2; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * 0.85;
        const [x, y] = P(l.x + Math.cos(a) * l.rx * d, l.z + Math.sin(a) * l.rz * d);
        let cx = x | 0;
        let cy = y | 0;
        ctx.fillStyle = '#d8eef8';
        for (let s = 0; s < 8; s++) {
          ctx.fillRect(cx, cy, 3, 1);
          cx += 2 + ((r() * 3) | 0);
          cy += ((r() * 3) | 0) - 1;
        }
      }
    }
  }

  /** Dark, still water pools with a muddy rim, a few lily pads and light glints. */
  private paintPools(ctx: CanvasRenderingContext2D, r: Rng, P: (x: number, z: number) => [number, number], k: number): void {
    const B = this.bound;
    const zone = this.zone;
    const away = (x: number, z: number, p: { x: number; z: number }, d: number) => Math.hypot(x - p.x, z - p.z) > d;
    const allBlobs: { x: number; z: number; rx: number; rz: number }[][] = [];
    for (let i = 0, made = 0; i < 600 && made < this.pal.pools; i++) {
      const x = rand(r, -B, B);
      const z = rand(r, -B, B);
      const rad = rand(r, 1.4, 4.2);
      if (this.distToPath(x, z) < rad + 2.2) continue;
      if (!away(x, z, zone.start, 12 + rad) || !away(x, z, zone.boss, clearingRadius(zone) + rad)) continue;
      made++;
      allBlobs.push(Array.from({ length: 3 + ((r() * 3) | 0) }, () => ({
        x: x + rand(r, -rad * 0.6, rad * 0.6),
        z: z + rand(r, -rad * 0.6, rad * 0.6),
        rx: rad * rand(r, 0.5, 0.9),
        rz: rad * rand(r, 0.4, 0.75),
      })));
    }
    this.poolBlobs = allBlobs.flat();
    const fill = (grow: number) => (m: CanvasRenderingContext2D) => {
      m.beginPath();
      for (const blobs of allBlobs) {
        for (const b of blobs) {
          const [px, py] = P(b.x, b.z);
          const rx = Math.max(0.1, b.rx + grow) * k;
          m.moveTo(px + rx, py);
          m.ellipse(px, py, rx, Math.max(0.1, b.rz + grow) * k, 0, 0, Math.PI * 2);
        }
      }
      m.fill();
    };
    this.paintBand(ctx, ['#3c3426', '#4a3f2c', '#352e22'], 2, fill(0.55));
    this.paintBand(ctx, ['#16261f'], 2, fill(0.25));
    this.paintBand(ctx, ['#1f3a3a', '#1b3436'], 2, fill(0), true);
    this.paintBand(ctx, ['#25464a', '#2a5053', '#25464a'], 2, fill(-0.35), true);
    this.paintBand(ctx, ['#2e585a', '#356668', '#2e585a'], 2, fill(-0.85), true);
    for (const blobs of allBlobs) {
      const spot = () => {
        const b = pick(r, blobs);
        const [px, py] = P(b.x + rand(r, -b.rx * 0.5, b.rx * 0.5), b.z + rand(r, -b.rz * 0.5, b.rz * 0.5));
        return [px | 0, py | 0];
      };
      // Glints
      for (let j = 0; j < 5; j++) {
        const [x, y] = spot();
        const w = 5 + ((r() * 8) | 0);
        ctx.fillStyle = '#8fc4bc';
        ctx.fillRect(x, y, w, 1);
        ctx.fillStyle = '#d8efe8';
        ctx.fillRect(x + 1, y, Math.max(1, w >> 2), 1);
      }
      // Lily pads: a pixel disc with a wedge cut out, a dark rim and a lit patch.
      for (let j = 0; j < 3; j++) {
        if (r() < 0.4) continue;
        const [cx, cy] = spot();
        const s = Math.round(0.35 * k);
        for (let dy = -s; dy <= s; dy++) {
          for (let dx = -s; dx <= s; dx++) {
            const d = dx * dx + dy * dy;
            if (d > s * s || (dx > 0 && Math.abs(dy) <= dx / 2)) continue;
            ctx.fillStyle = d > (s - 1) * (s - 1) ? '#274a24' : dx + dy < -s * 0.4 ? '#5d8f45' : '#3f6b34';
            ctx.fillRect(cx + dx, cy + dy, 1, 1);
          }
        }
        if (r() < 0.3) {
          ctx.fillStyle = '#e9c6e0';
          ctx.fillRect(cx - 1, cy - 2, 3, 3);
          ctx.fillStyle = '#f7c844';
          ctx.fillRect(cx, cy - 1, 1, 1);
        }
      }
    }
  }
}
