// The wind (docs/systems/shaders.md, owner 2026-11-28): trees and plants lean from their foot, the grass with them, and
// the harbour's ships rock. Added to the materials the map already draws with, so there is no extra draw call; while an
// amplitude is 0 (level off, or the kind not drawn at this level) the shader skips the move altogether.
import * as THREE from 'three';
import type { FxLayerConfig, ShaderLevel } from '../shared/fxLayerTuning';
import { GRASS_LEAN, SHIP_PIVOT, SWAY_LEAN, windLook, type SwayKind } from './swayTable';
import { turn } from './waterFx';

/** Radians per second of flow: the slow swell, the quicker flutter on top, and the ships' own slower roll. */
const SWELL = 1.5;
const FLUTTER = 3.4;
const ROLL = 0.9;
/** Radians of the wave per world unit along the wind: a gust crosses about 18 units. */
const WAVE = 0.35;

/**
 * Where a piece standing at `at` is in the gust (never worked out per corner, so a picture keeps its shape), and the
 * lean at that moment, -0.4 to 1: a little toward where the wind blows, swinging about it.
 */
const HEAD = /* glsl */ `
  uniform float uWindSwell, uWindFlutter, uWindRoll, uWindLean, uSway;
  uniform vec2 uWindWave, uWindRight;
  float windPhase(vec2 at) {
    return dot(at, uWindWave) + sin(at.x * 1.7 + at.y * 2.3) * 1.2;
  }
  float windBend(float phase) {
    return uWindLean * 0.3 + sin(uWindSwell - phase) * 0.5 + sin(uWindFlutter - phase * 1.7) * 0.2;
  }
`;

const SPRITE_ANCHOR = 'vec2 rotatedPosition;';
const SPRITE_LEAN = /* glsl */ `
  if (uSway != 0.0) alignedPosition.x += uSway * windBend(windPhase(modelMatrix[3].xz)) * max(alignedPosition.y, 0.0);
`;
const SPRITE_ROCK = /* glsl */ `
  if (uSway != 0.0) {
    float a = uSway * sin(uWindRoll - windPhase(modelMatrix[3].xz));
    vec2 pivot = vec2(0.0, ${SHIP_PIVOT.toFixed(3)} * scale.y);
    vec2 p = alignedPosition - pivot;
    alignedPosition = pivot + vec2(cos(a) * p.x - sin(a) * p.y, sin(a) * p.x + cos(a) * p.y);
  }
`;
/** aWind: how far this corner may move (0 at the foot, and on anything that stays put), and where its quad stands. */
const QUAD_ANCHOR = '#include <begin_vertex>';
const QUAD_LEAN = /* glsl */ `
  if (uSway != 0.0) transformed.xz += uWindRight * (uSway * aWind.x * windBend(windPhase(aWind.yz)));
`;

type Group = 'leaf' | 'bush' | 'stiff' | 'ship' | 'grass';

/** One map's wind: the uniforms its swaying materials share. */
export class Wind {
  private flow = 0;
  private readonly shared = {
    uWindSwell: { value: 0 },
    uWindFlutter: { value: 0 },
    uWindRoll: { value: 0 },
    uWindLean: { value: 1 },
    uWindWave: { value: new THREE.Vector2() },
    uWindRight: { value: new THREE.Vector2() },
  };
  /** Each group's amplitude, 0 until the first update. */
  readonly sway: Record<Group, THREE.IUniform<number>> = {
    leaf: { value: 0 }, bush: { value: 0 }, stiff: { value: 0 }, ship: { value: 0 }, grass: { value: 0 },
  };
  /** The camera's right and the way toward it, on the ground (x, z). */
  private readonly right: THREE.Vector2;
  private readonly near: THREE.Vector2;

  constructor(camRight: THREE.Vector3) {
    this.right = new THREE.Vector2(camRight.x, camRight.z).normalize();
    this.near = new THREE.Vector2(-this.right.y, this.right.x);
    this.shared.uWindRight.value.copy(this.right);
  }

  /** Makes a prop's sprite material sway as `kind`. */
  sprite(mat: THREE.SpriteMaterial, kind: SwayKind): void {
    this.patch(mat, kind, SPRITE_ANCHOR, (kind === 'ship' ? SPRITE_ROCK : SPRITE_LEAN) + SPRITE_ANCHOR, '', `wind-sprite-${kind === 'ship' ? 'rock' : 'lean'}`);
  }

  /** Makes a mesh of standing ground details sway; its geometry carries `aWind`. */
  quads(mat: THREE.Material): void {
    this.patch(mat, 'grass', QUAD_ANCHOR, QUAD_ANCHOR + QUAD_LEAN, 'attribute vec3 aWind;\n', 'wind-quads');
  }

  private patch(mat: THREE.Material, group: Group, anchor: string, code: string, attributes: string, key: string): void {
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.shared, { uSway: this.sway[group] });
      shader.vertexShader = attributes + HEAD + shader.vertexShader.replace(anchor, code);
    };
    mat.customProgramCacheKey = () => key;
  }

  /**
   * Read every frame, so the player's setting and /admin apply at once. The flow is added up, so a new speed never
   * makes anything jump, and only angles within one turn reach the shader (exact however long the game stays open).
   */
  update(dt: number, level: ShaderLevel, cfg: FxLayerConfig): void {
    const look = windLook(level, cfg);
    this.flow += dt * cfg.windSpeed;
    const u = this.shared;
    u.uWindSwell.value = turn(this.flow * SWELL);
    u.uWindFlutter.value = turn(this.flow * FLUTTER);
    u.uWindRoll.value = turn(this.flow * ROLL);
    // windDir on screen: 0 blows to the right, 90 toward the camera (down), 180 left, 270 away (up).
    const a = (cfg.windDir * Math.PI) / 180;
    u.uWindLean.value = Math.cos(a);
    u.uWindWave.value.copy(this.right).multiplyScalar(Math.cos(a)).addScaledVector(this.near, Math.sin(a)).multiplyScalar(WAVE);
    this.sway.leaf.value = SWAY_LEAN.leaf * look.tree;
    this.sway.bush.value = SWAY_LEAN.bush * look.tree;
    this.sway.stiff.value = SWAY_LEAN.stiff * look.tree;
    this.sway.grass.value = GRASS_LEAN * look.grass;
    this.sway.ship.value = look.ship;
  }
}
