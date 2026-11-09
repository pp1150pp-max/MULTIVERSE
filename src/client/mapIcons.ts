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

/** A party member on the minimap and the full map: a bright green dot with a white ring (plain until it gets art). */
export function partyDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#5dff8a';
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.35);
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.beginPath();
  ctx.arc(x, y, r + ctx.lineWidth + 1, 0, Math.PI * 2);
  ctx.stroke();
}
