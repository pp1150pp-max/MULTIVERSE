import type { Game } from './Game';
import type { NpcId } from '../shared/data/npcs';
import { MONSTERS } from '../shared/data/monsters';
import { ZONES } from '../shared/data/zones';
import { sheets } from './assets';
import { drawMapIcon, facingAngle } from './mapIcons';
import type { MapIcon } from './mapIconNames';

const S = Math.SQRT1_2;
// The market broker borrows the merchant's marker until icons/map_market.png is painted.
export const NPC_MAP_ICON: Record<NpcId, MapIcon> = { seeker: 'seeker', merchant: 'merchant', blacksmith: 'blacksmith', keeper: 'keeper', broker: 'merchant' };

/** How a monster's level compares with the player's, as a colour for its spawn area and label. */
function dangerColour(monsterLevel: number, playerLevel: number): string {
  if (monsterLevel > playerLevel + 2) return '#ff8a7a';
  if (monsterLevel < playerLevel - 2) return '#a9d98a';
  return '#ffd98a';
}

interface Box { x0: number; y0: number; x1: number; y1: number }

/**
 * Whole-zone map (M or click the minimap). Drawn turned 45 degrees like the minimap so it matches the camera.
 * Spawn areas are labelled from zone data; markers are what this client can see right now
 * (online that is only what is near the player).
 */
export class FullMap {
  private readonly ctx: CanvasRenderingContext2D;
  /** Centre and scale of the last draw, for turning a click back into world coordinates. */
  private c = 0;
  private sc = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  draw(g: Game): void {
    const ctx = this.ctx;
    const cv = ctx.canvas;
    // Keep the backing store sharp at the size CSS gives it.
    const want = Math.round(cv.clientWidth * (window.devicePixelRatio || 1));
    if (want > 0 && cv.width !== want) cv.width = cv.height = want;
    const W = cv.width;
    const px = W / 640; // text and marker sizes are designed for a 640px map
    const c = W / 2;
    const H = g.world.half;
    const sc = (W * 0.96) / (2 * H * Math.SQRT2);
    const zone = g.backend.zone;
    const me = g.player;
    const at = (x: number, z: number): [number, number] => [c + (x - z) * S * sc, c + (x + z) * S * sc];
    this.c = c;
    this.sc = sc;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(g.world.mapImage, 0, 0, W, W);
    cv.style.borderColor = g.world.mapEdge;

    const icon = (name: MapIcon, x: number, z: number, size: number, angle = 0) => drawMapIcon(ctx, name, ...at(x, z), size * px, angle);
    const dot = (x: number, z: number, r: number, color: string) => {
      const [sx, sy] = at(x, z);
      ctx.beginPath();
      ctx.arc(sx, sy, r * px, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.2 * px;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.stroke();
    };
    const area = (x: number, z: number, r: number, colour: string) => {
      const [sx, sy] = at(x, z);
      ctx.beginPath();
      ctx.arc(sx, sy, r * sc, 0, Math.PI * 2);
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.2 * px;
      ctx.setLineDash([5 * px, 4 * px]);
      ctx.strokeStyle = colour;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    };

    // Spawn areas and the boss lair.
    for (const sp of zone.spawns) {
      const d = MONSTERS[sp.monster];
      area(sp.x, sp.z, Math.max(sp.radius, 2.5), dangerColour(d.levels[1], me.level));
    }
    const b = zone.boss;
    if (b) area(b.x, b.z, 5, '#ff5a46');
    if (zone.safe) {
      // The walled town: a square in the world, a diamond on the map.
      const { x, z, half } = zone.safe;
      ctx.beginPath();
      for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) ctx.lineTo(...at(x + cx * half, z + cz * half));
      ctx.closePath();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#9fe0ff';
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.2 * px;
      ctx.strokeStyle = '#9fe0ff';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Live markers.
    for (const m of g.monsters) {
      if (!m.alive || m.isBoss) continue;
      if (m.isHostile) icon('fight', m.x, m.z, 15);
      else dot(m.x, m.z, 2.8, '#f2a640');
    }
    for (const n of g.npcs) icon(NPC_MAP_ICON[n.id], n.x, n.z, 22);
    for (const p of g.backend.players) if (p !== me) icon('ally', p.x, p.z, 24, facingAngle(p.faceX, p.faceZ));

    // Labels go on top of every marker, each nudged clear of the ones already placed.
    const placed: Box[] = [];
    /** A dark pill with optional picture and text, centred on x. `step` is which way to dodge. */
    const label = (x: number, y: number, text: string, colour: string, opts: { size?: number; step?: number; art?: (ax: number, ay: number, s: number) => void } = {}) => {
      const size = (opts.size ?? 12) * px;
      ctx.font = `600 ${size}px Kanit, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const art = opts.art ? size * 1.5 : 0;
      const w = ctx.measureText(text).width + art + 12 * px;
      const h = size + 8 * px;
      let top = y - h / 2;
      const hits = (t: number) => placed.some((q) => x - w / 2 < q.x1 && x + w / 2 > q.x0 && t < q.y1 && t + h > q.y0);
      for (let i = 0; i < 12 && hits(top); i++) top += (h + 2 * px) * (opts.step ?? -1);
      placed.push({ x0: x - w / 2, y0: top, x1: x + w / 2, y1: top + h });
      ctx.beginPath();
      ctx.roundRect(x - w / 2, top, w, h, h / 2);
      ctx.fillStyle = 'rgba(14, 10, 6, 0.82)';
      ctx.fill();
      ctx.lineWidth = 1 * px;
      ctx.strokeStyle = 'rgba(201, 168, 90, 0.55)';
      ctx.stroke();
      if (opts.art) opts.art(x - w / 2 + 5 * px + art / 2, top + h / 2, art);
      ctx.fillStyle = colour;
      ctx.fillText(text, x - w / 2 + art + 7 * px, top + h / 2 + 1 * px);
    };

    // The fixed places first, so the rest move out of their way.
    if (b) {
      const bd = MONSTERS[b.monster];
      const [bx, by] = at(b.x, b.z);
      icon('boss', b.x, b.z, 34);
      label(bx, by - 30 * px, `${bd.nameTh} Lv.${bd.levels[0]}`, '#ff9a8a', { size: 13 });
    }
    if (zone.npcs) {
      const [cx, cy] = at(zone.start.x, zone.start.z);
      // Above the town rather than over it: the NPCs and often the player are standing there.
      label(cx, cy - 46 * px, zone.nameTh, '#fff0c0', {
        size: 13,
        art: (ax, ay, s) => drawMapIcon(ctx, 'camp', ax, ay, s),
      });
    }
    for (const pt of zone.portals) {
      const to = ZONES[pt.to];
      const [sx, sy] = at(pt.x, pt.z);
      icon('portal', pt.x, pt.z, 26);
      const lv = pt.minLevel > 0 ? ` (Lv.${pt.minLevel}+)` : '';
      // Toward the middle of the map, so a portal near the left or right edge keeps its label on screen.
      const side = sx > c + 40 * px ? -1 : sx < c - 40 * px ? 1 : 0;
      label(sx + side * 92 * px, sy + (side ? 0 : (sy < c ? 30 : -30) * px), `วาปไป ${to?.nameTh ?? pt.to}${lv}`, '#e0c8ff', { step: sy < c ? 1 : -1 });
    }

    // Two areas of the same monster close together get one label, so the text doesn't pile up.
    const labelled: { monster: string; x: number; z: number }[] = [];
    for (const sp of zone.spawns) {
      // The hub's single monsters stand in a long line in front of each portal: one label per kind per corner.
      const together = zone.quadrants ? 60 : 24;
      if (labelled.some((l) => l.monster === sp.monster && Math.hypot(l.x - sp.x, l.z - sp.z) < together)) continue;
      labelled.push({ monster: sp.monster, x: sp.x, z: sp.z });
      // In the middle of its group, not at its first spot (which in the hub is the one nearest town).
      const group = zone.spawns.filter((o) => o.monster === sp.monster && Math.hypot(o.x - sp.x, o.z - sp.z) < together);
      const gx = group.reduce((t, o) => t + o.x, 0) / group.length;
      const gz = group.reduce((t, o) => t + o.z, 0) / group.length;
      const d = MONSTERS[sp.monster];
      const [sx, sy] = at(gx, gz);
      const sheet = sheets[sp.monster];
      label(sx, sy, `${d.nameTh} Lv.${d.levels[0]}-${d.levels[1]}`, dangerColour(d.levels[1], me.level), {
        art: (ax, ay, s) => {
          // The first frame of the sheet: the monster facing the camera.
          const image = sheet.texture.image as HTMLImageElement;
          const fw = image.width / sheet.cols;
          const fh = image.height / sheet.rows;
          const dh = s * 1.15;
          const dw = dh * (fw / fh);
          ctx.drawImage(image, 0, 0, fw, fh, ax - dw / 2, ay - dh / 2, dw, dh);
        },
      });
    }
    for (const p of g.backend.players) {
      if (p === me) continue;
      const [sx, sy] = at(p.x, p.z);
      label(sx, sy - 20 * px, p.name, '#bfe6ff', { size: 11 });
    }

    // Where the player is walking to from a map click.
    const route = g.mapRoute;
    if (route.length) {
      ctx.beginPath();
      ctx.moveTo(...at(me.x, me.z));
      for (const pt of route) ctx.lineTo(...at(pt.x, pt.z));
      ctx.setLineDash([6 * px, 5 * px]);
      ctx.lineWidth = 2.5 * px;
      ctx.strokeStyle = 'rgba(255,243,192,0.9)';
      ctx.stroke();
      ctx.setLineDash([]);
      const end = route[route.length - 1];
      icon('flag', end.x, end.z, 26);
    }

    // The player on top of everything.
    icon('player', me.x, me.z, 32, facingAngle(me.faceX, me.faceZ));
  }

  /** The world point under a mouse position on the map canvas (uses the last draw). */
  toWorld(clientX: number, clientY: number): { x: number; z: number } {
    const cv = this.ctx.canvas;
    const rect = cv.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * cv.width;
    const sy = ((clientY - rect.top) / rect.height) * cv.height;
    const u = (sx - this.c) / (S * this.sc);
    const v = (sy - this.c) / (S * this.sc);
    return { x: (u + v) / 2, z: (v - u) / 2 };
  }
}
