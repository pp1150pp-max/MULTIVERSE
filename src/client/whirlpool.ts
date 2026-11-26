// The Kraken Maelstrom's whirlpools (ZoneDef.whirlpools, plan 5.4, FLOOR2_M4_WHIRLPOOL.md): four paper layers lying flat on the ground,
// each turning at its own speed, the inner ones faster, so the water looks sucked down into the middle (owner 2026-11-19). The foam along
// the rim is ordinary props (rim_0 … rim_7, Terrain.placeRims). Nobody can walk in (Terrain.isBlocked).
import * as THREE from 'three';
import { sheets } from './assets';
import type { Whirlpool } from '../shared/data/zones';
import type { FxLayerConfig, ShaderLevel } from '../shared/fxLayerTuning';
import { turn } from './waterFx';

/** Each layer: its picture, its width as a share of the whirlpool's, how fast it turns (radians a second, clockwise) and its height. */
const LAYERS: [key: string, size: number, spin: number, y: number][] = [
  ['whirlpool_ring_1', 1, 0.12, 0.03],
  ['whirlpool_ring_2', 0.75, 0.26, 0.034],
  ['whirlpool_ring_3', 0.5, 0.5, 0.038],
  ['whirlpool_core', 0.28, 1.1, 0.042],
];

/** Shader water (docs/systems/shaders.md), added to each layer's plain material. uSize: the layer's share of the whirlpool. */
const SHADER_DECL = /* glsl */ `
  uniform float uShLevel, uRot, uSize, uPhase, uPulse, uTwist, uGlow;
`;
/** Stands in for three's map_fragment. Level 0 reads the picture exactly as it did. */
const SHADER_MAP = /* glsl */ `
  #ifdef USE_MAP
    vec2 fromMid = vMapUv - 0.5;
    float r = length(fromMid);
    vec2 at = vMapUv;
    if (uShLevel > 1.5) {
      // A spiral twist: only the angle changes, so nothing outside the circle is ever read.
      float a = 0.22 * uTwist * sin(r * 18.0 + uPhase) * (1.0 - smoothstep(0.35, 0.5, r));
      at = 0.5 + mat2(cos(a), sin(a), -sin(a), cos(a)) * fromMid;
    }
    vec4 sampledDiffuseColor = texture2D(map, at);
    if (uShLevel > 0.5) {
      // Bands of light spiralling into the middle, the same pattern across all four layers however each one turns.
      float angle = atan(fromMid.y, fromMid.x) + uRot;
      float d = r * 2.0 * uSize;
      float band = smoothstep(0.86, 0.97, sin(angle * 3.0 + d * 22.0 + uPhase))
        * smoothstep(0.04, 0.2, d) * (1.0 - smoothstep(0.75, 0.97, d));
      // Lifts the water's own colour: plain white added here read as grey smears on the dark rings.
      sampledDiffuseColor.rgb = sampledDiffuseColor.rgb * (1.0 + band * 0.5 * uGlow) + vec3(0.0, 0.035, 0.05) * band * uGlow;
      if (uShLevel > 1.5) {
        // The eye darkens and clears again, slowly.
        float eye = 1.0 - smoothstep(0.02, 0.22, d);
        sampledDiffuseColor.rgb *= 1.0 - eye * (0.5 + 0.5 * sin(uPulse)) * 0.3 * min(uGlow, 1.5);
      }
    }
    diffuseColor *= sampledDiffuseColor;
  #endif
`;

type Uniforms = Record<'uShLevel' | 'uRot' | 'uSize' | 'uPhase' | 'uPulse' | 'uTwist' | 'uGlow', THREE.IUniform<number>>;

export class WhirlpoolViews {
  readonly group = new THREE.Group();
  private readonly layers: { mesh: THREE.Mesh; spin: number; u: Uniforms }[] = [];

  constructor(pools: readonly Whirlpool[]) {
    for (const w of pools) {
      for (const [key, size, spin, y] of LAYERS) {
        const sheet = sheets[key];
        const mat = new THREE.MeshBasicMaterial({
          map: sheet?.texture ?? null, color: sheet ? '#ffffff' : '#1e5a7a', transparent: true, depthWrite: false, alphaTest: 0.02,
        });
        const u: Uniforms = {
          uShLevel: { value: 0 }, uRot: { value: 0 }, uSize: { value: size }, uPhase: { value: 0 }, uPulse: { value: 0 },
          uTwist: { value: 1 }, uGlow: { value: 1 },
        };
        mat.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, u);
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${SHADER_DECL}`)
            .replace('#include <map_fragment>', SHADER_MAP);
        };
        mat.customProgramCacheKey = () => 'mv-whirlpool';
        const d = w.r * 2 * size;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(d, d).rotateX(-Math.PI / 2), mat);
        mesh.position.set(w.x, y, w.z);
        mesh.renderOrder = -5;
        this.group.add(mesh);
        this.layers.push({ mesh, spin, u });
      }
    }
  }

  update(t: number, level: ShaderLevel, cfg: FxLayerConfig): void {
    for (const l of this.layers) {
      l.mesh.rotation.y = -t * l.spin;
      l.u.uShLevel.value = level;
      l.u.uRot.value = turn(-t * l.spin);
      l.u.uPhase.value = turn(t * 1.6);
      l.u.uPulse.value = turn(t * 1.1);
      l.u.uTwist.value = cfg.whirlTwist;
      l.u.uGlow.value = cfg.whirlGlow;
    }
  }

  dispose(): void {
    for (const l of this.layers) {
      l.mesh.geometry.dispose();
      (l.mesh.material as THREE.Material).dispose();
    }
  }
}
