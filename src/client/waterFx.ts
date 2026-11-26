// Shared bits of the water shaders (docs/systems/shaders.md): a small repeating noise picture, made once in code
// instead of working noise out for every pixel, and the wrapping that keeps moving offsets exact.
import * as THREE from 'three';
import { mulberry32 } from '../shared/rng';
import { tileNoise } from './island';

const SIZE = 128;
let noise: THREE.DataTexture | null = null;

/** Two unrelated smooth noises (R and G, 0–1) that repeat in both directions. Shared by every map; never disposed. */
export function noiseTexture(): THREE.DataTexture {
  if (noise) return noise;
  const r = mulberry32(20261126);
  const octaves = [0, 1].map(() => [tileNoise(r, 8), tileNoise(r, 17)] as const);
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      octaves.forEach(([big, small], c) => {
        data[i + c] = Math.round((big(x / SIZE, y / SIZE) * 0.65 + small(x / SIZE, y / SIZE) * 0.35) * 255);
      });
      data[i + 3] = 255;
    }
  }
  noise = new THREE.DataTexture(data, SIZE, SIZE);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.magFilter = noise.minFilter = THREE.LinearFilter;
  noise.needsUpdate = true;
  return noise;
}

/** The fraction part: offsets of repeating pictures stay exact however long the game stays open. */
export const frac = (v: number): number => v - Math.floor(v);
/** An angle kept within one turn, for the same reason. */
export const turn = (v: number): number => frac(v / (Math.PI * 2)) * Math.PI * 2;
