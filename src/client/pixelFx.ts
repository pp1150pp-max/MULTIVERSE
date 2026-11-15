// Trying code-made pixel-art effects (owner 2026-11-15: three skills first, from the pixelfx library, vendored in
// src/vendor/pixelfx). An effect draws itself into a small pixel buffer every frame; we copy that into a canvas texture
// on an upright sprite standing where the skill lands, with nearest filtering so its pixels stay crisp. The pixel
// effects play instead of the skill's picture, its standing layer and its extra layer. The /admin switch "pixelfx" on
// the skill effects card turns them off again, to compare with the pictures.
import * as THREE from 'three';
import { clearFrame, composite, createFrame, createFx, type PixelFxModule } from '../vendor/pixelfx/core/index.js';
import * as frostNova from '../vendor/pixelfx/fx/ice/frost-nova.js';
import * as quake from '../vendor/pixelfx/fx/nature/quake.js';
import * as fireRing from '../vendor/pixelfx/fx/fire/fire-ring.js';
import { currentBalance } from '../shared/balance';

interface PixelSkill {
  mod: PixelFxModule;
  /** Seconds to play it in (the library's own timing is slow for a fight); a lasting zone takes the zone's time. */
  seconds: number;
}

/** The skills that try a pixelfx effect, by skill id. */
export const PIXEL_SKILLS: Record<string, PixelSkill> = {
  frostnova: { mod: frostNova, seconds: 1.6 },
  earthquake: { mod: quake, seconds: 1.5 },
  mg_flameground: { mod: fireRing, seconds: 3 },
};

export const pixelFxOn = (skill: string | undefined): boolean => !!skill && !!PIXEL_SKILLS[skill] && currentBalance().fxLayer.pixelfx;

export interface PixelHost {
  add(obj: THREE.Object3D, life: number, tick?: (k: number, dt: number) => void): void;
}

/**
 * Plays the skill's pixel effect at x, z: its own reach (pixels) is fitted to `size` (the skill's radius in world
 * units). `duration` = a lasting zone's time (the effect is stretched to it). Returns false when the skill has none.
 */
export function playPixelFx(host: PixelHost, skill: string | undefined, x: number, z: number, size: number, duration?: number): boolean {
  if (!pixelFxOn(skill)) return false;
  const def = PIXEL_SKILLS[skill!];
  const meta = def.mod.meta ?? { name: '' };
  const [w, h] = meta.size ?? [256, 128];
  const [ox, oy] = meta.origin ?? [w / 2, h * 0.8];
  const reach = Number(meta.options?.reach ?? w / 3);
  const seconds = duration && duration > 0 ? duration : def.seconds;
  const speed = (meta.duration ?? 1) / seconds;
  // Pixels per world unit: the effect's reach covers the skill's radius.
  const ppu = reach / Math.max(0.5, size);

  const frame = createFrame(w, h);
  const fx = createFx(def.mod, { x: ox, y: oy, seed: (Math.random() * 1e6) | 0 });
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  // Effects own their texture (disposed with them, see effects.ts disposeObj).
  tex.userData.effectFrame = true;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.center.set(ox / w, 1 - oy / h);
  spr.scale.set(w / ppu, h / ppu, 1);
  spr.position.set(x, 0.02, z);

  const draw = (): void => {
    clearFrame(frame);
    fx.draw(frame);
    composite(frame, img.data, null);
    ctx.putImageData(img, 0, 0);
    tex.needsUpdate = true;
  };
  draw();
  host.add(spr, seconds, (_k, dt) => {
    fx.update(dt * speed);
    draw();
  });
  return true;
}
