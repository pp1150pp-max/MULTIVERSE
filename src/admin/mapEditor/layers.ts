// What the editor canvas draws (each a Layer in editor.ts). The ground is the game's tiles (groundArt.ts) or, switched off, plain colours.
import { ROOM_EDGE, roomSpawnOf, type MapTheme } from '../../shared/mapSchema';
import { catalogEntry, spriteOf } from './sprites';
import type { Editor, Layer } from './editor';
import { decorLayer, drawRealGround } from './groundArt';
import { HARBOR_DECKS, HARBOR_ID } from '../../shared/data/harbor';

const GROUND: Record<MapTheme, string> = { forest: '#4f7a3f', marsh: '#566a43', snow: '#cfdbe3', volcano: '#4b3a34', beach: '#d9c79a', cove: '#9a8a8e', grave: '#5e6a72', kraken: '#4a5462' };
const PATH_COLOR = 'rgba(196,166,112,0.85)';

/** Floor colour by theme (the hub's four quarters in their own colours), the walkable frame, paths and lakes. */
const ground: Layer = {
  id: 'ground', label: 'พื้น', order: 0,
  draw(ed, g) {
    const { zone, walkable } = ed.map;
    const h = zone.half;
    if (ed.map.id === HARBOR_ID) harborGround(ed, g);
    else if (!(ed.opts.realGround && drawRealGround(ed, g))) plainGround(ed, g);
    // The frame the player may walk in, and the edge of the map.
    g.setLineDash([6, 5]);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1;
    ed.path(g, [[-walkable.half, -walkable.half], [walkable.half, -walkable.half], [walkable.half, walkable.half], [-walkable.half, walkable.half]]);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    ed.path(g, [[-h, -h], [h, -h], [h, h], [-h, h]]);
    g.stroke();
  },
};

/**
 * Floor 2's harbour: water with the plank platforms over it, as the game lays them (src/client/harborGround.ts). The platforms'
 * shape is in code (HARBOR_DECKS, round the map's middle), not in the map file: off them is water nobody can walk on
 * (Terrain.isBlocked), whatever the file says. Plain colours whatever the "พื้นแบบในเกม" switch says.
 */
function harborGround(ed: Editor, g: CanvasRenderingContext2D): void {
  const h = ed.map.zone.half;
  ed.path(g, [[-h, -h], [h, -h], [h, h], [-h, h]]);
  g.fillStyle = '#3f7fa6';
  g.fill();
  g.fillStyle = '#a77c4f';
  g.strokeStyle = 'rgba(60,35,15,0.8)';
  g.lineWidth = 1;
  for (const d of HARBOR_DECKS) {
    ed.path(g, d);
    g.fill();
    g.stroke();
  }
}

/** The plain colours (the "พื้นแบบในเกม" switch off, or while the ground tiles load). */
function plainGround(ed: Editor, g: CanvasRenderingContext2D): void {
    const { zone } = ed.map;
    const h = zone.half;
    const quarter = (x0: number, z0: number, x1: number, z1: number, theme: MapTheme): void => {
      ed.path(g, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
      g.fillStyle = GROUND[theme];
      g.fill();
    };
    if (zone.quadrants) {
      // Same rule as the game's themeAt: index = (x >= 0 ? 1 : 0) + (z >= 0 ? 2 : 0).
      quarter(-h, -h, 0, 0, zone.quadrants[0]); quarter(0, -h, h, 0, zone.quadrants[1]);
      quarter(-h, 0, 0, h, zone.quadrants[2]); quarter(0, 0, h, h, zone.quadrants[3]);
    } else quarter(-h, -h, h, h, zone.theme);
    // Paths.
    g.strokeStyle = PATH_COLOR;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const p of ed.map.paths) {
      g.lineWidth = Math.max(2, p.w * ed.view.scale * 0.55);
      ed.path(g, p.pts, false);
      g.stroke();
    }
    // Lakes.
    for (const w of ed.map.water) {
      const pts: [number, number][] = Array.from({ length: 36 }, (_, i) => [w.x + Math.cos((i / 36) * Math.PI * 2) * w.rx, w.z + Math.sin((i / 36) * Math.PI * 2) * w.rz]);
      ed.path(g, pts);
      g.fillStyle = w.kind === 'ice' ? 'rgba(150,200,235,0.8)' : w.kind === 'whirlpool' ? 'rgba(30,110,140,0.85)' : 'rgba(230,90,30,0.85)';
      g.fill();
    }
}

const grid: Layer = {
  id: 'grid', label: 'กริด', order: 10,
  draw(ed, g) {
    if (!ed.opts.showGrid) return;
    const h = ed.map.zone.half;
    // Skip lines that would be closer than ~8px.
    let step = ed.opts.grid;
    while (step * ed.view.scale * 0.7 < 8) step *= 2;
    g.lineWidth = 1;
    for (let i = Math.ceil(-h / step); i * step <= h; i++) {
      const v = i * step;
      g.strokeStyle = Math.abs(v) < 1e-9 ? 'rgba(255,255,255,0.28)' : i % 5 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)';
      ed.path(g, [[v, -h], [v, h]], false); g.stroke();
      ed.path(g, [[-h, v], [h, v]], false); g.stroke();
    }
  },
};

const props: Layer = {
  id: 'props', label: 'ของวาง', order: 20, pickable: true,
  draw(ed, g) {
    const W = ed.width, H = ed.height;
    for (const d of ed.drawnProps()) {
      const r = Math.max(d.wpx, d.hpx);
      if (d.px < -r || d.px > W + r || d.py < -r || d.py > H + r) continue;
      drawPiece(ed, g, d.p.key, d.px, d.py, d.wpx, d.hpx, d.anchor, d.p.rot, d.p.flip, 1);
    }
  },
};

/** One picture standing on (px, py): turned about its foot like the game's sprites (SpriteMaterial.rotation = -rot, on a y-down canvas that is +rot). */
export function drawPiece(ed: Editor, g: CanvasRenderingContext2D, key: string, px: number, py: number, wpx: number, hpx: number, anchor: number, rot: number, flip: boolean, alpha: number): void {
  const sp = spriteOf(key, () => ed.requestDraw());
  g.save();
  g.globalAlpha = alpha;
  g.translate(px, py);
  if (rot) g.rotate((rot * Math.PI) / 180);
  if (flip) g.scale(-1, 1);
  if (sp) g.drawImage(sp.img, -wpx / 2, -(1 - anchor) * hpx, wpx, hpx);
  else {
    g.fillStyle = 'rgba(200,200,200,0.25)';
    g.strokeStyle = 'rgba(200,200,200,0.6)';
    g.fillRect(-wpx / 2, -(1 - anchor) * hpx, wpx, hpx);
    g.strokeRect(-wpx / 2, -(1 - anchor) * hpx, wpx, hpx);
  }
  g.restore();
}

/** Read-only markers of what PR 7's tools will edit: NPCs, doors, rest spots, monster spawns, the lair. */
const markers: Layer = {
  id: 'markers', label: 'NPC / ประตู / จุดเกิด', order: 30, pickable: true,
  draw(ed, g) {
    const m = ed.map;
    const dot = (x: number, z: number, color: string, label: string): void => {
      const [px, py] = ed.toScreen(x, z);
      g.fillStyle = color;
      g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke();
      if (ed.view.scale >= 8) { g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(label, px + 8, py + 4); }
    };
    for (const n of m.npcs) dot(n.x, n.z, '#4ac0e8', n.id);
    for (const p of m.portals) dot(p.x, p.z, '#b070f0', `→ ${p.to}`);
    for (const r of m.rest) dot(r.x, r.z, '#e8c040', r.kind);
    for (const s of m.spawns) {
      const pts: [number, number][] = Array.from({ length: 20 }, (_, i) => [s.x + Math.cos((i / 20) * Math.PI * 2) * s.radius, s.z + Math.sin((i / 20) * Math.PI * 2) * s.radius]);
      ed.path(g, pts);
      g.strokeStyle = 'rgba(240,120,120,0.7)'; g.lineWidth = 1; g.stroke();
    }
    if (m.lair) dot(m.lair.x, m.lair.z, '#e05050', m.lair.boss);
  },
};

/** Boss rooms only: what is fixed in code, shown as a guide that cannot be dragged (the arena, its edge, the boss) and the pin for where players appear. */
const roomGuide: Layer = {
  id: 'roomGuide', label: 'แนวช่วยดู: สนามบอส / จุดเกิดผู้เล่น', order: 35,
  draw(ed, g) {
    const room = ed.map.room;
    if (!room) return;
    const circle = (r: number): [number, number][] => Array.from({ length: 72 }, (_, i) => [room.boss.x + Math.cos((i / 72) * Math.PI * 2) * r, room.boss.z + Math.sin((i / 72) * Math.PI * 2) * r]);
    g.lineWidth = 1.5;
    g.setLineDash([7, 5]);
    g.strokeStyle = 'rgba(255,210,74,0.9)';
    ed.path(g, circle(room.arena)); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(255,90,90,0.9)';
    ed.path(g, circle(room.arena + ROOM_EDGE)); g.stroke();
    const dot = (x: number, z: number, color: string, label: string): void => {
      const [px, py] = ed.toScreen(x, z);
      g.fillStyle = color;
      g.beginPath(); g.arc(px, py, 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(label, px + 9, py + 4);
    };
    dot(room.boss.x, room.boss.z, '#e05050', `บอส ${room.boss.monster} (ล็อก)`);
    const s = roomSpawnOf(ed.map.zone.start);
    dot(s.x, s.z, '#4cd06a', 'จุดเกิดผู้เล่น');
  },
};

/** The circles and boxes the player bumps into, see-through red. */
const collision: Layer = {
  id: 'collision', label: 'วง/กล่อง collision', order: 40,
  draw(ed, g) {
    if (!ed.opts.showSolid) return;
    g.fillStyle = 'rgba(230,50,50,0.28)';
    g.strokeStyle = 'rgba(255,90,90,0.9)';
    g.lineWidth = 1;
    for (const p of ed.map.props) {
      const o = ed.outlineOf(p);
      if (!o) continue;
      ed.path(g, o); g.fill(); g.stroke();
    }
    g.fillStyle = 'rgba(230,120,30,0.25)';
    g.strokeStyle = 'rgba(255,160,60,0.9)';
    for (const c of ed.map.colliders ?? []) {
      const pts: [number, number][] = Array.from({ length: 24 }, (_, i) => [c.x + Math.cos((i / 24) * Math.PI * 2) * c.r, c.z + Math.sin((i / 24) * Math.PI * 2) * c.r]);
      ed.path(g, pts); g.fill(); g.stroke();
    }
  },
};

/** The blocker polygons (PR 7): see-through red like the other collision, but shown even when the circles are hidden. */
const blockers: Layer = {
  id: 'blockers', label: 'ขอบเขต (polygon)', order: 41, pickable: true,
  draw(ed, g) {
    g.fillStyle = 'rgba(230,50,50,0.28)';
    g.strokeStyle = 'rgba(255,90,90,0.9)';
    g.lineWidth = 1.5;
    for (const b of ed.map.blockers) { ed.path(g, b.pts); g.fill(); g.stroke(); }
  },
};

/** Outline and foot of the selected pieces. */
const selection: Layer = {
  id: 'selection', label: 'กรอบที่เลือก', order: 50,
  draw(ed, g) {
    for (const p of ed.selectedProps()) {
      const d = ed.propBox(p);
      g.save();
      g.translate(d.px, d.py);
      if (p.rot) g.rotate((p.rot * Math.PI) / 180);
      g.strokeStyle = '#ffd24a';
      g.lineWidth = 1.5;
      g.setLineDash([5, 3]);
      g.strokeRect(-d.wpx / 2, -(1 - d.anchor) * d.hpx, d.wpx, d.hpx);
      g.restore();
      g.fillStyle = '#ffd24a';
      g.beginPath(); g.arc(d.px, d.py, 3, 0, Math.PI * 2); g.fill();
    }
  },
};

/** The piece about to be dropped, see-through. */
const ghost: Layer = {
  id: 'ghost', label: 'ภาพจาง', order: 60,
  draw(ed, g) {
    const gh = ed.ghost;
    if (!gh) return;
    const e = catalogEntry(gh.key);
    const h = e?.h ?? 2;
    const sp = spriteOf(gh.key, () => ed.requestDraw());
    const aspect = sp ? sp.w / sp.h : e?.size ? e.size[0] / e.size[1] : 1;
    const hpx = h * ed.view.scale;
    const [px, py] = ed.toScreen(gh.x, gh.z);
    drawPiece(ed, g, gh.key, px, py, hpx * aspect, hpx, 0.03, 0, false, 0.55);
    g.fillStyle = '#6cf'; g.beginPath(); g.arc(px, py, 3, 0, Math.PI * 2); g.fill();
  },
};

export const CORE_LAYERS: Layer[] = [ground, decorLayer, grid, props, markers, roomGuide, collision, blockers, selection, ghost];
