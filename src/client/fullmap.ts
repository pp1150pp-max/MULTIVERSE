import type { Game } from './Game';
import { MONSTERS } from '../shared/data/monsters';
import { ZONES } from '../shared/data/zones';

const S = Math.SQRT1_2;
const NPC_COLOR = { seeker: '#fff3c0', merchant: '#7fe07a', blacksmith: '#ff9a4a' } as const;

/**
 * Whole-zone map (M or click the minimap). Drawn turned 45 degrees like the minimap so it matches the camera.
 * Spawn areas are labelled from zone data; dots are what this client can see right now
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
    const px = W / 640; // text and dot sizes are designed for a 640px map
    const c = W / 2;
    const H = g.world.half;
    const sc = (W * 0.96) / (2 * H * Math.SQRT2);
    const zone = g.backend.zone;
    const at = (x: number, z: number): [number, number] => [c + (x - z) * S * sc, c + (x + z) * S * sc];
    this.c = c;
    this.sc = sc;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);
    const k = (2 * H) / g.world.groundCanvas.width;
    const a = k * sc * S;
    ctx.setTransform(a, a, -a, a, c, c - 2 * H * S * sc);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(g.world.groundCanvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const label = (x: number, y: number, text: string, color: string, size = 12) => {
      ctx.font = `600 ${size * px}px Kanit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3 * px;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };
    const dot = (x: number, z: number, r: number, color: string, outline = false) => {
      const [sx, sy] = at(x, z);
      ctx.beginPath();
      ctx.arc(sx, sy, r * px, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (outline) {
        ctx.lineWidth = 1.5 * px;
        ctx.strokeStyle = '#000';
        ctx.stroke();
      }
    };
    const area = (x: number, z: number, r: number, fill: string, edge: string) => {
      const [sx, sy] = at(x, z);
      ctx.beginPath();
      ctx.arc(sx, sy, r * sc, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 1.5 * px;
      ctx.strokeStyle = edge;
      ctx.stroke();
    };

    // Spawn areas and the boss lair.
    for (const sp of zone.spawns) area(sp.x, sp.z, sp.radius, 'rgba(242,166,64,0.12)', 'rgba(242,166,64,0.55)');
    const b = zone.boss;
    area(b.x, b.z, 4, 'rgba(255,58,42,0.18)', 'rgba(255,90,70,0.8)');

    // Live dots.
    for (const m of g.monsters) {
      if (!m.alive) continue;
      if (m.isBoss) dot(m.x, m.z, 6, '#ff3a2a', true);
      else dot(m.x, m.z, 2.6, m.isHostile ? '#ff5a4a' : '#f2a640');
    }
    for (const n of g.npcs) dot(n.x, n.z, 4, NPC_COLOR[n.id], true);
    const me = g.player;
    for (const p of g.backend.players) {
      if (p === me) continue;
      dot(p.x, p.z, 4.5, '#6ac8ff', true);
      const [sx, sy] = at(p.x, p.z);
      label(sx, sy - 11 * px, p.name, '#bfe6ff', 11);
    }

    // Labels go on top of every dot.
    // Two areas of the same monster close together get one label, so the text doesn't overlap.
    const labelled: { monster: string; x: number; z: number }[] = [];
    for (const sp of zone.spawns) {
      if (labelled.some((l) => l.monster === sp.monster && Math.hypot(l.x - sp.x, l.z - sp.z) < 24)) continue;
      labelled.push({ monster: sp.monster, x: sp.x, z: sp.z });
      const d = MONSTERS[sp.monster];
      const [sx, sy] = at(sp.x, sp.z);
      label(sx, sy, `${d.nameTh} Lv.${d.levels[0]}-${d.levels[1]}`, '#ffe2a8');
    }
    const bd = MONSTERS[b.monster];
    const [bx, by] = at(b.x, b.z);
    label(bx, by - 16 * px, `👑 บอส: ${bd.nameTh} Lv.${bd.levels[0]}`, '#ff8a7a', 13);
    const [cx, cy] = at(zone.start.x, zone.start.z);
    // Below the camp: "คุณ" sits above the player, who is often standing in it.
    label(cx, cy + 34 * px, '🏕 แคมป์ (พ่อค้า · ช่างตีเหล็ก · The Seeker)', '#fff3c0', 12);
    for (const pt of zone.portals) {
      const to = ZONES[pt.to];
      const [sx, sy] = at(pt.x, pt.z);
      ctx.beginPath();
      ctx.arc(sx, sy, 7 * px, 0, Math.PI * 2);
      ctx.fillStyle = '#b07aff';
      ctx.fill();
      ctx.lineWidth = 2 * px;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      const lv = pt.minLevel > 0 ? ` (Lv.${pt.minLevel}+)` : '';
      label(sx, sy - 16 * px, `🌀 วาปไป ${to?.nameTh ?? pt.to}${lv}`, '#e0c8ff', 12);
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
      dot(end.x, end.z, 5, '#ffe08a', true);
    }

    // The player on top of everything.
    dot(me.x, me.z, 6, '#ffffff', true);
    const [mx, my] = at(me.x, me.z);
    label(mx, my - 14 * px, 'คุณ', '#ffffff', 12);
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
