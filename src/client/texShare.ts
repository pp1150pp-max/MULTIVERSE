import * as THREE from 'three';

/**
 * A copy of a sprite sheet's texture with its own frame offset / repeat that draws from the SAME picture on the GPU.
 *
 * three.js (r170) `Texture.clone()` ends with `needsUpdate = true`, which marks the shared image itself as changed, so
 * every copy sent the whole sheet to the GPU again (an effect sheet is 1536×1024 or more: ~10–20 ms each). Every shot's
 * muzzle flash and hit made one, so the faster a gunslinger fired (Quick Reload, Overdrive) the more frames hitched
 * (owner report 2026-11-21). Here the copy keeps the image's version, so it only binds the picture already uploaded.
 *
 * The original texture is also given its own GPU copy once (initTexture), which it keeps for good: otherwise the GPU
 * picture would be deleted whenever the last copy is disposed (a short effect) and sent again with the next one.
 */
export function cloneShared(base: THREE.Texture): THREE.Texture {
  keepUploaded(base);
  const version = base.source.version;
  const t = base.clone();
  t.source.version = version;
  return t;
}

let renderer: THREE.WebGLRenderer | null = null;
const kept = new WeakSet<THREE.Texture>();

/** Set once by the game, so cloneShared can keep each original sheet's GPU copy. */
export function setTexShareRenderer(r: THREE.WebGLRenderer): void {
  renderer = r;
}

function keepUploaded(base: THREE.Texture): void {
  if (!renderer || kept.has(base)) return;
  const img = base.image as { complete?: boolean } | null;
  if (!img || img.complete === false) return;
  kept.add(base);
  renderer.initTexture(base);
}
