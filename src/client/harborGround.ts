// The ground of floor 2's harbour town (src/shared/data/harbor.ts): turquoise water everywhere, the plank platforms
// laid over it with a darker rim and a shadow on the water along their edges, and the round plaza in the middle laid
// with its own boards. Paper tiles from tools/cut_papercraft.cjs floor2_hub (harbor_water / harbor_plank /
// harbor_plaza); plain colours stand in for any that is missing. Drawn by World instead of the island's ground.
import * as THREE from 'three';
import { HARBOR_DECKS, HARBOR_PLAZA_RADIUS } from '../shared/data/harbor';
import { groundTiles } from './assets';

/** World units one repeat of a harbour ground tile covers. */
const TILE_UNITS = 9;
const MASK_SIZE = 1024;

/** R = on a platform, G = on the plaza; blurred a little so the shader can draw soft rims. x → world x, y → world z. */
export function paintHarborMask(half: number, ox: number, oz: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = MASK_SIZE;
  const ctx = cv.getContext('2d')!;
  const px = (w: number) => ((w + half) / (2 * half)) * MASK_SIZE;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
  ctx.filter = 'blur(2px)';
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#ff0000';
  for (const d of HARBOR_DECKS) {
    ctx.beginPath();
    for (const [x, z] of d) ctx.lineTo(px(x + ox), px(z + oz));
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#00ff00';
  ctx.beginPath();
  ctx.arc(px(ox), px(oz), (HARBOR_PLAZA_RADIUS / (2 * half)) * MASK_SIZE, 0, Math.PI * 2);
  ctx.fill();
  return cv;
}

export const HARBOR_FRAG = /* glsl */ `
  uniform sampler2D uMask, uWaterTex, uPlankTex, uPlazaTex;
  uniform float uHalf, uTileUnits, uTime, uBake, uHasTex;
  varying vec2 vWorld;
  varying float vEdge;
  void main() {
    vec2 uv = (vWorld + uHalf) / (2.0 * uHalf);
    vec4 m = texture2D(uMask, uv);
    vec2 tile = vWorld / uTileUnits;
    // The water drifts a little (not on the baked map picture).
    vec2 flow = uBake > 0.5 ? vec2(0.0) : vec2(uTime * 0.012, uTime * 0.007);
    vec3 water = uHasTex > 0.5 ? texture2D(uWaterTex, tile * 0.8 + flow).rgb : vec3(0.36, 0.78, 0.82);
    vec3 plank = uHasTex > 0.5 ? texture2D(uPlankTex, tile).rgb : vec3(0.72, 0.52, 0.32);
    vec3 plaza = uHasTex > 0.5 ? texture2D(uPlazaTex, tile * 1.2).rgb : vec3(0.80, 0.62, 0.48);
    // A shadow on the water under each platform's edge, and a darker rim of plank ends along it.
    float onDeck = smoothstep(0.45, 0.55, m.r);
    float shade = smoothstep(0.0, 0.45, m.r) * (1.0 - onDeck);
    water *= 1.0 - shade * 0.45;
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
    gl_FragColor = vec4(c * mix(0.82 + 0.18 * (1.0 - vEdge), 1.0, onDeck), 1.0);
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
  };
}
