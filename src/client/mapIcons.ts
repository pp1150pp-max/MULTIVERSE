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

/** The player's own map pin: a magenta teardrop whose tip is on the spot (x, y). */
export function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const r = size * 0.32;
  const cy = y - size * 0.62;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - r * 0.85, cy + r * 0.55);
  ctx.arc(x, cy, r, Math.PI * 0.82, Math.PI * 0.18, false);
  ctx.closePath();
  ctx.fillStyle = '#ff4fa0';
  ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.strokeStyle = '#2a0c1a';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, cy, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
}

/**
 * A marker that is off the minimap: draws `art` on the rim in the direction of (mx, my) with a small gold arrow
 * pointing outward. c is the minimap's centre and radius the rim's inner edge. Does nothing if the point is inside.
 */
export function drawEdgeMarker(
  ctx: CanvasRenderingContext2D,
  c: number,
  radius: number,
  mx: number,
  my: number,
  art: (x: number, y: number, size: number) => void,
): void {
  const d = Math.hypot(mx - c, my - c);
  if (d <= radius - 8) return;
  const a = Math.atan2(my - c, mx - c);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const ir = radius - 15;
  art(c + ux * ir, c + uy * ir, 13);
  const tip = radius - 4;
  const base = radius - 10;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(c + ux * tip, c + uy * tip);
  ctx.lineTo(c + ux * base - uy * 3.5, c + uy * base + ux * 3.5);
  ctx.lineTo(c + ux * base + uy * 3.5, c + uy * base - ux * 3.5);
  ctx.closePath();
  ctx.fillStyle = '#f6e3a1';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#2a1d0c';
  ctx.stroke();
  ctx.restore();
}
