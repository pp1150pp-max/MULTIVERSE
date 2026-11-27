// The ground of floor 2's harbour town (src/shared/data/harbor.ts): turquoise water everywhere, the plank platforms
// laid over it with a darker rim and a shadow on the water along their edges, and the round plaza in the middle laid
// with its own boards. Paper tiles from tools/cut_papercraft.cjs floor2_hub (harbor_water / harbor_plank /
// harbor_plaza); plain colours stand in for any that is missing. Drawn by World instead of the island's ground.
import * as THREE from 'three';
import { HARBOR_DECKS, HARBOR_PLAZA_RADIUS } from '../shared/data/harbor';
import { groundTiles } from './assets';
import type { FxLayerConfig, ShaderLevel } from '../shared/fxLayerTuning';
import { frac, noiseTexture, turn } from './waterFx';

/** World units one repeat of a harbour ground tile covers. */
const TILE_UNITS = 9;
const MASK_SIZE = 1024;

/**
 * R = on a platform, G = on the plaza; blurred a little so the shader can draw soft rims. B = the platforms blurred
 * wide, how near open water is to one (the foam line). x → world x, y → world z.
 */
export function paintHarborMask(half: number, ox: number, oz: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = MASK_SIZE;
  const ctx = cv.getContext('2d')!;
  const px = (w: number) => ((w + half) / (2 * half)) * MASK_SIZE;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
  ctx.filter = 'blur(2px)';
  ctx.globalCompositeOperation = 'lighter';
  const decks = (colour: string) => {
    ctx.fillStyle = colour;
    for (const d of HARBOR_DECKS) {
      ctx.beginPath();
      for (const [x, z] of d) ctx.lineTo(px(x + ox), px(z + oz));
      ctx.closePath();
      ctx.fill();
    }
  };
  decks('#ff0000');
  ctx.filter = 'blur(7px)';
  decks('#0000ff');
  ctx.filter = 'blur(2px)';
  ctx.fillStyle = '#00ff00';
  ctx.beginPath();
  ctx.arc(px(ox), px(oz), (HARBOR_PLAZA_RADIUS / (2 * half)) * MASK_SIZE, 0, Math.PI * 2);
  ctx.fill();
  return cv;
}

export const HARBOR_FRAG = /* glsl */ `
  uniform sampler2D uMask, uWaterTex, uPlankTex, uPlazaTex, uNoise;
  uniform float uHalf, uTileUnits, uTime, uBake, uHasTex;
  // Shader water (docs/systems/shaders.md): level 0 = as before, 1 = two sliding layers, 2 = + waves, foam and glints.
  uniform float uShLevel, uPhase, uWave, uFoam;
  uniform vec2 uFlowA, uFlowB, uShift;
  // 1 = the water ends in a torn paper edge over a waterfall (harborFalls.ts), at every level; 0 = cut off as before.
  uniform float uFalls;
  varying vec2 vWorld;
  varying float vEdge;
  void main() {
    vec2 uv = (vWorld + uHalf) / (2.0 * uHalf);
    vec4 m = texture2D(uMask, uv);
    vec2 tile = vWorld / uTileUnits;
    // The water drifts a little (not on the baked map picture).
    vec2 flow = uBake > 0.5 ? vec2(0.0) : vec2(uTime * 0.012, uTime * 0.007);
    vec3 water = uHasTex > 0.5 ? texture2D(uWaterTex, tile * 0.8 + flow).rgb : vec3(0.36, 0.78, 0.82);
    bool live = uShLevel > 0.5 && uBake < 0.5;
    if (live && uHasTex > 0.5) {
      vec2 bend = uShLevel > 1.5 ? (texture2D(uNoise, tile * 0.45 + uShift).rg - 0.5) * 0.07 * uWave : vec2(0.0);
      vec3 under = texture2D(uWaterTex, tile * 0.8 + uFlowA + bend).rgb;
      vec3 over = texture2D(uWaterTex, tile * 1.15 + uFlowB - bend).rgb;
      water = mix(under, over, 0.4);
    }
    vec3 plank = uHasTex > 0.5 ? texture2D(uPlankTex, tile).rgb : vec3(0.72, 0.52, 0.32);
    vec3 plaza = uHasTex > 0.5 ? texture2D(uPlazaTex, tile * 1.2).rgb : vec3(0.80, 0.62, 0.48);
    // A shadow on the water under each platform's edge, and a darker rim of plank ends along it.
    float onDeck = smoothstep(0.45, 0.55, m.r);
    float shade = smoothstep(0.0, 0.45, m.r) * (1.0 - onDeck);
    water *= 1.0 - shade * 0.45;
    if (live && uShLevel > 1.5) {
      // A line of white foam moving in and out round every platform (m.b falls off away from one).
      vec2 n = texture2D(uNoise, tile * 1.3 - uShift).rg;
      float at = 0.24 + 0.09 * sin(uPhase + n.r * 6.2831) + (n.g - 0.5) * 0.08;
      float foam = (1.0 - smoothstep(0.018, 0.036, abs(m.b - at))) * step(0.04, m.b);
      // Glints on the open water, where two noises moving apart are both high.
      float spark = texture2D(uNoise, tile * 3.1 + uShift).r * texture2D(uNoise, tile * 2.7 - uShift.yx).g;
      float glint = step(0.6, spark) * (1.0 - step(0.05, m.b));
      water = mix(water, vec3(0.94, 0.99, 1.0), clamp((foam * 0.75 + glint * 0.6) * uFoam, 0.0, 1.0));
    }
    // Pulled toward warm honey and lifted (owner 2026-11-20: the tile alone read too dark beside the buildings).
    plank = mix(plank, vec3(0.92, 0.72, 0.48), 0.45) * 1.12;
    plaza = mix(plaza, vec3(0.95, 0.80, 0.62), 0.35) * 1.08;
    float rim = 1.0 - smoothstep(0.55, 0.9, m.r);
    plank *= 1.0 - rim * 0.2;
    float onPlaza = smoothstep(0.4, 0.6, m.g);
    vec3 deck = mix(plank, plaza, onPlaza);
    // A ring of darker boards round the plaza.
    deck *= 1.0 - (smoothstep(0.2, 0.5, m.g) - smoothstep(0.5, 0.8, m.g)) * 0.3;
    vec3 c = mix(water, deck, onDeck);
    // The island's own shore fade (IslandOutline's aEdge) is kept: the water thins out at the rim of the world.
    c *= mix(0.82 + 0.18 * (1.0 - vEdge), 1.0, onDeck);
    if (uFalls > 0.5 && vEdge < 0.5) {
      // aEdge runs 0 at the shore to 1 about 1.4 units in: torn unevenly, with a white lip where the water goes over.
      float torn = texture2D(uNoise, tile * 2.3).r * 0.6 + texture2D(uNoise, tile * 5.1).g * 0.4;
      float rim = vEdge - (torn - 0.5) * 0.2;
      if (rim < 0.03) discard;
      c = mix(c, vec3(0.94, 0.98, 1.0), (1.0 - smoothstep(0.17, 0.21, rim)) * (1.0 - onDeck));
    }
    gl_FragColor = vec4(c, 1.0);
  }
`;

/** The shader's uniforms (World keeps them as its groundUniforms, so readGround / uTime work the same). */
export function harborUniforms(mask: THREE.Texture, half: number): Record<string, THREE.IUniform> {
  const water = groundTiles.harbor_water;
  const plank = groundTiles.harbor_plank;
  const plaza = groundTiles.harbor_plaza;
  const has = !!(water && plank && plaza);
  return {
    uMask: { value: mask },
    uWaterTex: { value: water ?? null },
    uPlankTex: { value: plank ?? null },
    uPlazaTex: { value: plaza ?? null },
    uHasTex: { value: has ? 1 : 0 },
    uHalf: { value: half },
    uTileUnits: { value: TILE_UNITS },
    uTime: { value: 0 },
    uBake: { value: 0 },
    uNoise: { value: noiseTexture() },
    uShLevel: { value: 0 },
    uPhase: { value: 0 },
    uWave: { value: 1 },
    uFoam: { value: 1 },
    uFlowA: { value: new THREE.Vector2() },
    uFlowB: { value: new THREE.Vector2() },
    uShift: { value: new THREE.Vector2() },
    uFalls: { value: 0 },
  };
}

/** The shader water this frame. `flowed`: seconds of flow so far (already × /admin's speed). */
export function updateHarborWater(u: Record<string, THREE.IUniform>, level: ShaderLevel, flowed: number, cfg: FxLayerConfig): void {
  u.uShLevel.value = level;
  u.uWave.value = cfg.waterWave;
  u.uFoam.value = cfg.waterFoam;
  u.uFlowA.value.set(frac(flowed * 0.02), frac(flowed * 0.011));
  u.uFlowB.value.set(frac(flowed * -0.014), frac(flowed * 0.009));
  u.uShift.value.set(frac(flowed * 0.03), frac(flowed * 0.023));
  u.uPhase.value = turn(flowed * 1.3);
}
