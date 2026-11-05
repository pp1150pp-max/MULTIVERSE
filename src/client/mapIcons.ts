// Painted markers shared by the minimap and the full map. Files live in assets/sprites/icons/.
import { sheets } from './assets';
import type { MapIcon } from './mapIconNames';

/** Draws a marker centred on x, y. `angle` turns it clockwise, in radians. */
export function drawMapIcon(ctx: CanvasRenderingContext2D, name: MapIcon, x: number, y: number, size: number, angle = 0): void {
  const image = sheets[`map_${name}`].texture.image as CanvasImageSource;
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  ctx.drawImage(image, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/** Which way a unit is facing on the map, for an arrow that points up when unturned. */
export function facingAngle(faceX: number, faceZ: number): number {
  return Math.atan2(faceX - faceZ, -(faceX + faceZ));
}
