// The harbour town's water going over the rim of the world (owner 2026-11-27, docs/systems/shaders.md): a curtain of
// torn paper strips hanging from the two shores that face the camera and breaking into foam over the cloud sea. Shown
// at every graphics level; it flows only while the water effects are on. The soft torn edge above it is in
// harborGround.ts.
import * as THREE from 'three';
import { groundTiles } from './assets';
import type { IslandOutline } from './island';
import { frac, noiseTexture } from './waterFx';

/** World units between two points of the curtain along the shore. */
const STEP = 0.35;
/** It starts this far inside the shore (under the water, so the torn edge never opens a gap) and ends this far past it. */
const TOP_IN = 0.4;
const FOOT_OUT = 0.6;

const VERT = /* glsl */ `
  attribute vec2 aFall;  // world units along the shore, 0 at the lip to 1 at the foot
  varying vec2 vFall;
  void main() {
    vFall = aFall;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// No colorspace_fragment, on purpose: HARBOR_FRAG has none (the owner tuned the harbour's colours by eye that way),
// so the same water picture comes out the same colour here.
const FRAG = /* glsl */ `
  uniform sampler2D uWaterTex, uNoise;
  uniform float uHasTex, uDepth, uFlow, uStreak;
  varying vec2 vFall;
  void main() {
    float along = vFall.x;
    float down = vFall.y;
    float fallen = down * uDepth;
    // Strips of uneven length with rounded ends.
    float reach = 0.45 + 0.65 * texture2D(uNoise, vec2(along * 0.05, 0.31)).r + 0.07 * abs(sin(along * 2.4));
    reach = min(reach, 1.0);
    if (down > reach) discard;
    vec3 water = uHasTex > 0.5 ? texture2D(uWaterTex, vec2(along * 0.09, fallen * 0.04 - uFlow)).rgb : vec3(0.36, 0.78, 0.82);
    water *= 1.05 + down * 0.25;
    // Pale ribbons sliding down.
    float ribbon = texture2D(uNoise, vec2(along * 0.21, fallen * 0.022 - uStreak)).g;
    vec3 c = mix(water, vec3(0.72, 0.90, 0.96), smoothstep(0.56, 0.60, ribbon) * 0.7);
    // The torn white lip it pours over.
    float torn = texture2D(uNoise, vec2(along * 0.37, 0.73)).g;
    c = mix(c, vec3(0.94, 0.98, 1.0), 1.0 - smoothstep(0.07, 0.10, down + (torn - 0.5) * 0.09));
    // The foot turns to foam and thins out into the clouds.
    c = mix(c, vec3(0.93, 0.95, 0.98), smoothstep(reach - 0.38, reach - 0.08, down + (torn - 0.5) * 0.12));
    gl_FragColor = vec4(c, 1.0 - smoothstep(reach - 0.16, reach, down));
  }
`;

export class HarborFalls {
  readonly mesh: THREE.Mesh;
  private readonly uniforms: Record<'uWaterTex' | 'uNoise' | 'uHasTex' | 'uDepth' | 'uFlow' | 'uStreak', THREE.IUniform>;

  /** `depth`: how far it falls, in world units. */
  constructor(shore: IslandOutline, depth: number) {
    const pos: number[] = [];
    const fall: number[] = [];
    const index: number[] = [];
    // The shores along +z and +x (s from 0 to 4) face the camera; a little past each end, round the corners.
    const past = 4 / shore.half;
    const steps = Math.ceil(((4 + past * 2) * shore.half) / STEP);
    let along = 0;
    let last: [number, number] | null = null;
    for (let i = 0; i <= steps; i++) {
      const s = -past + (i / steps) * (4 + past * 2);
      const [x, z] = shore.at(s);
      if (last) along += Math.hypot(x - last[0], z - last[1]);
      last = [x, z];
      const [tx, tz] = shore.at(s, -TOP_IN);
      const [fx, fz] = shore.at(s, FOOT_OUT);
      pos.push(tx, -0.02, tz, fx, -depth, fz);
      fall.push(along, 0, along, 1);
      if (i) index.push(i * 2 - 2, i * 2 - 1, i * 2 + 1, i * 2 - 2, i * 2 + 1, i * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aFall', new THREE.Float32BufferAttribute(fall, 2));
    geo.setIndex(index);
    const water = groundTiles.harbor_water;
    this.uniforms = {
      uWaterTex: { value: water ?? null }, uNoise: { value: noiseTexture() }, uHasTex: { value: water ? 1 : 0 },
      uDepth: { value: depth }, uFlow: { value: 0 }, uStreak: { value: 0 },
    };
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    }));
    // Under every other see-through thing; the land and the props in front of it still hide it by depth.
    this.mesh.renderOrder = -20;
    this.mesh.frustumCulled = false;
  }

  /** `flowed`: seconds of flow so far (0 while the water effects are off: a still picture). */
  update(flowed: number): void {
    this.uniforms.uFlow.value = frac(flowed * 0.32);
    this.uniforms.uStreak.value = frac(flowed * 0.16);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
