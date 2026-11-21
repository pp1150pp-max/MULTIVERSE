// The map editor's "ground that looks like the game": the game's repeating ground tiles (sprites/paper/ground/) laid the way
// src/client/world.ts lays them (theme per quarter in the hub, worn roads, camp and lair clearings, the hub's bricked town and
// plaza, a boss room's flagstones, ice/lava lakes), plus an optional layer of the small decor details. An approximation: the
// game's shader adds noise, blending and lighting that a 2D canvas does not try to copy.
//
// Fast at any zoom: each tile is drawn as ONE pattern fill in world space (the canvas transform carries the isometric view), and
// every tile keeps smaller copies (a mip chain) so a zoomed-out map samples a small picture, not the 1024px one.
import { imgUrl } from '../../client/img';
import { CAMP_RADIUS, DECOR, DECOR_CELL_UNITS, THEME_TILES, TILE_UNITS, TRAIL_WIDTH, type DecorSpot, type GroundTileName } from '../../shared/groundLook';
import { clearingRadius, ZONES } from '../../shared/data/zones';
import { HUB_PLAZA_RADIUS, QUADRANT_JITTER } from '../../shared/sim/terrain';
import { mulberry32, pick, rand } from '../../shared/rng';
import type { MapData, MapTheme } from '../../shared/mapSchema';
import { halfExtent } from './geom';
import { spriteOf } from './sprites';
import type { Editor, Layer } from './editor';

// ------------------------------------------------------------------ tiles

interface Tile { levels: (HTMLImageElement | HTMLCanvasElement)[]; patterns: (CanvasPattern | null)[] }
const tiles = new Map<GroundTileName, Tile | null>();
const loading = new Set<GroundTileName>();

/** The tile once loaded (with its smaller copies); starts loading it otherwise. null = the file is missing. */
function tileOf(name: GroundTileName, onLoad: () => void): Tile | null | undefined {
  if (tiles.has(name)) return tiles.get(name);
  if (loading.has(name)) return undefined;
  loading.add(name);
  const img = new Image();
  img.onload = () => {
    const levels: (HTMLImageElement | HTMLCanvasElement)[] = [img];
    let prev: HTMLImageElement | HTMLCanvasElement = img;
    for (let s = Math.floor(img.naturalWidth / 2); s >= 16; s = Math.floor(s / 2)) {
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const cx = c.getContext('2d');
      if (!cx) break;
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(prev, 0, 0, s, s);
      levels.push(c);
      prev = c;
    }
    tiles.set(name, { levels, patterns: levels.map(() => null) });
    loading.delete(name);
    onLoad();
  };
  img.onerror = () => { tiles.set(name, null); loading.delete(name); onLoad(); };
  img.src = imgUrl(`assets/sprites/paper/ground/${name}.png`);
  return undefined;
}

/** A pattern of the tile whose copy is about as big as one repeat shows on screen (`px` device pixels), scaled to TILE_UNITS world units. */
function patternOf(g: CanvasRenderingContext2D, t: Tile, px: number): CanvasPattern | null {
  let i = 0;
  while (i + 1 < t.levels.length && t.levels[i + 1].width >= px) i++;
  let p = t.patterns[i];
  if (!p) p = t.patterns[i] = g.createPattern(t.levels[i], 'repeat');
  if (!p) return null;
  const k = TILE_UNITS / t.levels[i].width;
  p.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
  return p;
}

/** Makes (x, z) world units the canvas's own coordinates (affine: the projection is a plain linear map). */
function toWorldSpace(ed: Editor, g: CanvasRenderingContext2D): void {
  const [ox, oy] = ed.toScreen(0, 0);
  const [ax, ay] = ed.toScreen(1, 0);
  const [bx, by] = ed.toScreen(0, 1);
  g.transform(ax - ox, ay - oy, bx - ox, by - oy, ox, oy);
}

// ------------------------------------------------------------------ what the map's ground is made of

/** The hub's quarter borders wander (the game's themeAt jitter): x = bx(z) and z = bz(x) are the lines a quarter changes on. */
const borderX = (z: number): number => -QUADRANT_JITTER * Math.sin(z * 0.21 + Math.sin(z * 0.057) * 3);
const borderZ = (x: number): number => -QUADRANT_JITTER * Math.sin(x * 0.19 + Math.sin(x * 0.061) * 3);

/** The arena's bare ground radius round a field's lair, as the game draws it. */
function lairClearing(map: MapData): number {
  const z = ZONES[map.id];
  return z ? clearingRadius(z) : 13;
}

function ellipse(g: CanvasRenderingContext2D, x: number, z: number, rx: number, rz: number): void {
  g.moveTo(x + rx, z);
  g.ellipse(x, z, Math.max(0.05, rx), Math.max(0.05, rz), 0, 0, Math.PI * 2);
}
function circle(g: CanvasRenderingContext2D, x: number, z: number, r: number): void {
  g.moveTo(x + r, z);
  g.arc(x, z, Math.max(0.05, r), 0, Math.PI * 2);
}

/** Every tile this map needs. */
function tilesFor(map: MapData): GroundTileName[] {
  const themes = map.zone.quadrants ?? [map.zone.theme];
  const out = new Set<GroundTileName>();
  for (const t of themes) { out.add(THEME_TILES[t].base); out.add(THEME_TILES[t].dirt); }
  for (const w of map.water) out.add(w.kind === 'lava' ? 'lava' : 'ice');
  out.add(paveOf(map));
  if (map.zone.safe) out.add('pave');
  return [...out];
}
function paveOf(map: MapData): GroundTileName {
  if (map.room) return `room_${map.zone.theme}` as GroundTileName;
  if (map.zone.safe) return 'brick';
  return THEME_TILES[map.zone.theme].pave ?? 'pave';
}

/**
 * Draws the game-like ground (in place of the plain colours). Returns false while a tile is still loading (or missing): the
 * caller draws the plain colours then, and the editor redraws once the tiles are in.
 */
export function drawRealGround(ed: Editor, g: CanvasRenderingContext2D): boolean {
  const map = ed.map;
  const redraw = (): void => ed.requestDraw();
  const got = new Map<GroundTileName, Tile>();
  let ready = true;
  for (const n of tilesFor(map)) {
    const t = tileOf(n, redraw);
    if (!t) ready = false; else got.set(n, t);
  }
  if (!ready) return false;
  const H = map.zone.half;
  // One repeat on screen, in device pixels (a little over, the iso view squashes it).
  const repeatPx = TILE_UNITS * ed.view.scale * (window.devicePixelRatio || 1);
  const pat = (n: GroundTileName): CanvasPattern | null => patternOf(g, got.get(n)!, repeatPx);

  g.save();
  toWorldSpace(ed, g);

  const { zone } = map;
  const quads = zone.quadrants;
  const regions: { theme: MapTheme; clip: (() => void) | null }[] = quads
    ? ([0, 1, 2, 3] as const).map((i) => ({
      theme: quads[i],
      clip: () => {
        const right = (i & 1) === 1, below = (i & 2) === 2;
        // The side of the x border, then the side of the z border.
        g.beginPath();
        for (let z = -H; z <= H + 0.01; z += 1) g.lineTo(borderX(z), z);
        g.lineTo(right ? H + 1 : -H - 1, H); g.lineTo(right ? H + 1 : -H - 1, -H);
        g.closePath();
        g.clip();
        g.beginPath();
        for (let x = -H; x <= H + 0.01; x += 1) g.lineTo(x, borderZ(x));
        g.lineTo(H, below ? H + 1 : -H - 1); g.lineTo(-H, below ? H + 1 : -H - 1);
        g.closePath();
        g.clip();
      },
    }))
    : [{ theme: zone.theme, clip: null }];

  for (const r of regions) {
    g.save();
    r.clip?.();
    const tiles = THEME_TILES[r.theme];
    // The land.
    g.fillStyle = pat(tiles.base) ?? '#444';
    g.fillRect(-H, -H, 2 * H, 2 * H);
    // Bare ground: the camp (or the hub's walled town), the lair's clearing, lake banks.
    g.fillStyle = pat(tiles.dirt) ?? '#665';
    g.beginPath();
    if (zone.safe) g.rect(zone.safe.x - zone.safe.half + 0.4, zone.safe.z - zone.safe.half + 0.4, 2 * zone.safe.half - 0.8, 2 * zone.safe.half - 0.8);
    else if (!map.room) circle(g, zone.start.x, zone.start.z, CAMP_RADIUS);
    if (map.lair) circle(g, map.lair.x, map.lair.z, lairClearing(map) - 1);
    if (map.room) circle(g, map.room.boss.x, map.room.boss.z, map.room.arena + 1);
    for (const w of map.water) ellipse(g, w.x, w.z, w.rx + 1, w.rz + 1);
    g.fill();
    // Roads, worn as wide as the game wears them (it does not read a path's `w`).
    g.strokeStyle = g.fillStyle;
    g.lineWidth = TRAIL_WIDTH[zone.theme];
    g.lineCap = g.lineJoin = 'round';
    g.beginPath();
    for (const p of map.paths) p.pts.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z)));
    g.stroke();
    g.restore();
  }

  // Paving: the hub's bricked town with its stone plaza, a boss room's flagstones, a field's camp.
  g.fillStyle = pat(paveOf(map)) ?? '#777';
  g.beginPath();
  if (zone.safe) g.rect(zone.safe.x - zone.safe.half + 0.2, zone.safe.z - zone.safe.half + 0.2, 2 * zone.safe.half - 0.4, 2 * zone.safe.half - 0.4);
  else if (map.room) circle(g, map.room.boss.x, map.room.boss.z, map.room.arena + 2);
  else circle(g, zone.start.x, zone.start.z, CAMP_RADIUS * 0.72);
  g.fill();
  if (zone.safe) {
    g.fillStyle = pat('pave') ?? '#888';
    g.beginPath(); circle(g, zone.safe.x, zone.safe.z, HUB_PLAZA_RADIUS); g.fill();
    // A kerb of darker stones round its edge.
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.lineWidth = 0.5;
    g.beginPath(); circle(g, zone.safe.x, zone.safe.z, HUB_PLAZA_RADIUS - 0.2); g.stroke();
  }

  // Lakes: a dark wet rim, then the ice or the lava.
  if (map.water.length) {
    g.fillStyle = 'rgba(20,16,12,0.6)';
    g.beginPath();
    for (const w of map.water) ellipse(g, w.x, w.z, w.rx + 0.25, w.rz + 0.25);
    g.fill();
    for (const w of map.water) {
      g.fillStyle = pat(w.kind === 'lava' ? 'lava' : 'ice') ?? (w.kind === 'lava' ? '#e65a1e' : '#96c8eb');
      g.beginPath(); ellipse(g, w.x, w.z, w.rx + 0.1, w.rz + 0.1); g.fill();
    }
  }

  // Past the walkable square the land darkens.
  const B = map.walkable.half;
  g.fillStyle = 'rgba(0,0,0,0.32)';
  g.beginPath();
  g.rect(-H, -H, 2 * H, 2 * H);
  g.rect(-B, -B, 2 * B, 2 * B);
  g.fill('evenodd');
  g.restore();
  return true;
}

// ------------------------------------------------------------------ decor (a sample, not the game's exact placement)

interface DecorBit { x: number; z: number; key: string; cell: number; cols: number; rows: number; size: number; flip: boolean }
let decorCache: { ref: unknown[]; bits: DecorBit[] } | null = null;

/** A stable number from the map's id, so the sample decor does not jump about between redraws or reloads. */
function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Distance from (x, z) to the nearest path segment. */
function distToPaths(map: MapData, x: number, z: number): number {
  let best = Infinity;
  for (const p of map.paths) {
    for (let i = 1; i < p.pts.length; i++) {
      const [ax, az] = p.pts[i - 1], [bx, bz] = p.pts[i];
      const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
      best = Math.min(best, Math.hypot(x - (ax + vx * t), z - (az + vz * t)));
    }
  }
  return best;
}

/** The decor sample for this map: grass and stones along the roads, clumps across the fields and round the lakes. */
function decorOf(map: MapData): DecorBit[] {
  const ref = [map.id, map.props, map.paths, map.water, map.portals, map.colliders, map.zone, map.walkable];
  if (decorCache && decorCache.ref.length === ref.length && decorCache.ref.every((v, i) => v === ref[i])) return decorCache.bits;
  const r = mulberry32(seedOf(map.id));
  const bits: DecorBit[] = [];
  const B = map.walkable.half;
  const { zone } = map;
  const trail = TRAIL_WIDTH[zone.theme] / 2;
  const camp = zone.safe ? zone.safe.half * 1.45 : CAMP_RADIUS;
  const solids = map.props.filter((p) => p.solid).map((p) => { const [hx, hz] = halfExtent(p); return { x: p.x, z: p.z, r: Math.max(hx, hz) }; });
  const inLake = (x: number, z: number, grow: number): boolean => map.water.some((w) => Math.hypot((x - w.x) / (w.rx + grow), (z - w.z) / (w.rz + grow)) < 1);
  const themeAt = (x: number, z: number): MapTheme => {
    const q = zone.quadrants;
    if (!q) return zone.theme;
    return q[(x >= borderX(z) ? 1 : 0) + (z >= borderZ(x) ? 2 : 0)];
  };
  const clump = (spot: DecorSpot, x: number, z: number, count: number, spread: number): void => {
    const set = DECOR[themeAt(x, z)];
    const cells = set.spots[spot].filter((c) => !set.flat?.includes(c));
    if (!cells.length) return;
    for (let i = 0; i < count; i++) {
      const px = x + rand(r, -spread, spread), pz = z + rand(r, -spread, spread);
      if (Math.abs(px) > B || Math.abs(pz) > B) continue;
      if (spot === 'water' ? !inLake(px, pz, -0.3) : inLake(px, pz, 0.5)) continue;
      if (spot !== 'road' && distToPaths(map, px, pz) < trail + 0.2) continue;
      if (Math.hypot(px - zone.start.x, pz - zone.start.z) < camp * 0.8) continue;
      if (map.room && Math.hypot(px - map.room.boss.x, pz - map.room.boss.z) < map.room.arena + 2) continue;
      if (map.portals.some((g) => Math.hypot(px - g.x, pz - g.z) < 2.5)) continue;
      if ((map.colliders ?? []).some((c) => Math.hypot(px - c.x, pz - c.z) < c.r + 0.3)) continue;
      if (solids.some((s) => Math.hypot(px - s.x, pz - s.z) < s.r + 0.3)) continue;
      bits.push({ x: px, z: pz, key: set.key, cell: pick(r, cells), cols: set.cols, rows: set.rows, size: DECOR_CELL_UNITS * rand(r, 0.85, 1.15), flip: r() < 0.5 });
    }
  };
  // Along the roads, on both verges.
  for (const p of map.paths) {
    for (let i = 1; i < p.pts.length; i++) {
      const [ax, az] = p.pts[i - 1], [bx, bz] = p.pts[i];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const nx = -(bz - az) / len, nz = (bx - ax) / len;
      for (let t = rand(r, 0, 2); t < len; t += rand(r, 1.8, 4)) {
        const f = t / len;
        const off = (r() < 0.5 ? -1 : 1) * (trail + rand(r, 0.5, 2.4));
        clump('verge', ax + (bx - ax) * f + nx * off, az + (bz - az) * f + nz * off, 1 + ((r() * 3) | 0), 0.7);
        if (r() < 0.12) clump('road', ax + (bx - ax) * f, az + (bz - az) * f, 1, trail * 0.6);
      }
    }
  }
  // Round the lakes.
  for (const w of map.water) {
    const n = Math.round((w.rx + w.rz) * 1.5);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      clump('shore', w.x + Math.cos(a) * (w.rx + 1.3), w.z + Math.sin(a) * (w.rz + 1.3), 1 + ((r() * 2) | 0), 0.5);
      if (r() < 0.4) clump('water', w.x + Math.cos(a) * w.rx * 0.6, w.z + Math.sin(a) * w.rz * 0.6, 1, 0.6);
    }
  }
  // Clumps across the open ground.
  const clumps = Math.round(((2 * B) ** 2) / 45);
  for (let i = 0; i < clumps; i++) clump('field', rand(r, -B, B), rand(r, -B, B), 2 + ((r() * 3) | 0), 1.4);
  decorCache = { ref, bits };
  return bits;
}

/** A layer of the game's small decor (grass, flowers, stones), placed like the game does but NOT in the same spots. Not editable. */
export const decorLayer: Layer = {
  id: 'decor', label: 'ของประดับเล็ก (ตัวอย่าง ไม่ตรงเป๊ะ)', order: 5,
  draw(ed, g) {
    if (ed.view.scale < 3) return; // too small to read; saves drawing thousands of specks
    const W = ed.width, Hh = ed.height;
    // Drawn in placement order: they are short and seldom overlap.
    for (const b of decorOf(ed.map)) {
      const [px, py] = ed.toScreen(b.x, b.z);
      const s = b.size * ed.view.scale;
      if (px < -s || px > W + s || py < -s || py > Hh + s) continue;
      const sp = spriteOf(b.key, () => ed.requestDraw());
      if (!sp) continue;
      const cw = sp.w / b.cols, ch = sp.h / b.rows;
      g.save();
      g.translate(px, py);
      if (b.flip) g.scale(-1, 1);
      g.drawImage(sp.img, (b.cell % b.cols) * cw, Math.floor(b.cell / b.cols) * ch, cw, ch, -s / 2, -s, s, s);
      g.restore();
    }
  },
};
