// Placeholder art drawn in code. Every sheet uses the same layout as the real art:
// 3 rows (front, side, back) × 3 walk frames. Drop a PNG with that layout into
// public/assets/... and it replaces the placeholder automatically (see assets.ts).
import { mulberry32, type Rng } from '../shared/rng';
import type { ClassId } from '../shared/types';

export type View = 'front' | 'side' | 'back';
type Ctx = CanvasRenderingContext2D;
export type DrawFn = (ctx: Ctx, view: View, frame: number, s: number) => void;

const VIEWS: View[] = ['front', 'side', 'back'];
const OUT = '#2a1c12';

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function makeSheet(cell: number, draw: DrawFn): HTMLCanvasElement {
  const c = newCanvas(cell * 3, cell * 3);
  const ctx = c.getContext('2d')!;
  VIEWS.forEach((view, row) => {
    for (let f = 0; f < 3; f++) {
      ctx.save();
      ctx.translate(f * cell, row * cell);
      ctx.beginPath();
      ctx.rect(0, 0, cell, cell);
      ctx.clip();
      draw(ctx, view, f, cell);
      ctx.restore();
    }
  });
  return c;
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  const ch = (v: number) => Math.round(v + (t - v) * k);
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

function ell(ctx: Ctx, s: number, x: number, y: number, rx: number, ry: number, fill: string, stroke: string | null = OUT) {
  ctx.beginPath();
  ctx.ellipse(x * s, y * s, Math.max(0.5, rx * s), Math.max(0.5, ry * s), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = Math.max(1, s / 30);
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function rect(ctx: Ctx, s: number, x: number, y: number, w: number, h: number, fill: string, stroke: string | null = OUT) {
  ctx.beginPath();
  ctx.rect(x * s, y * s, w * s, h * s);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = Math.max(1, s / 30);
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function poly(ctx: Ctx, s: number, pts: number[], fill: string, stroke: string | null = OUT) {
  ctx.beginPath();
  ctx.moveTo(pts[0] * s, pts[1] * s);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * s, pts[i + 1] * s);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = Math.max(1, s / 30);
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function eye(ctx: Ctx, s: number, x: number, y: number, r = 0.035) {
  ell(ctx, s, x, y, r, r * 1.2, '#1a1410', null);
  ell(ctx, s, x - r * 0.3, y - r * 0.45, r * 0.38, r * 0.38, '#ffffff', null);
}

// ---------------------------------------------------------------- creatures

export function drawSlime(pal: string[]): DrawFn {
  const [main, dark, light] = pal;
  return (ctx, view, f, s) => {
    const sq = [0, 0.035, -0.025][f];
    const rx = 0.36 + sq;
    const ry = 0.27 - sq;
    const cy = 0.95 - ry;
    ell(ctx, s, 0.5, cy, rx, ry, main);
    ell(ctx, s, 0.5, cy + ry * 0.5, rx * 0.78, ry * 0.36, dark, null);
    if (view === 'back') ell(ctx, s, 0.5, cy - ry * 0.5, 0.1, 0.04, light, null);
    else ell(ctx, s, view === 'side' ? 0.58 : 0.4, cy - ry * 0.5, 0.08, 0.05, light, null);
    if (view === 'front') {
      eye(ctx, s, 0.4, cy);
      eye(ctx, s, 0.6, cy);
    } else if (view === 'side') {
      eye(ctx, s, 0.72, cy - 0.02);
    }
  };
}

export interface QuadCfg {
  bodyRx: number;
  bodyRy: number;
  head: number;
  ears: 'pointy' | 'round' | 'long' | 'small';
  earSize: number;
  tail: 'bushy' | 'short' | 'puff' | 'none';
  tailTip?: string;
  legLen: number;
  legW: number;
  snout: number;
  tusks?: boolean;
  mane?: boolean;
  belly?: boolean;
}

function drawEars(ctx: Ctx, s: number, hx: number, hy: number, h: number, c: QuadCfg, main: string, inner: string, view: View) {
  const e = c.earSize;
  const xs = view === 'side' ? [hx - h * 0.35, hx + h * 0.05] : [hx - h * 0.62, hx + h * 0.62];
  for (const ex of xs) {
    const lean = view === 'side' ? 0 : ex < hx ? -e * 0.2 : e * 0.2;
    if (c.ears === 'pointy' || c.ears === 'small') {
      const tall = c.ears === 'pointy' ? 1.3 : 0.75;
      poly(ctx, s, [ex - e * 0.45, hy - h * 0.45, ex + e * 0.45, hy - h * 0.45, ex + lean, hy - h * 0.45 - e * tall], main);
      poly(ctx, s, [ex - e * 0.22, hy - h * 0.5, ex + e * 0.22, hy - h * 0.5, ex + lean * 0.6, hy - h * 0.5 - e * tall * 0.6], inner, null);
    } else if (c.ears === 'round') {
      ell(ctx, s, ex, hy - h * 0.75, e * 0.6, e * 0.55, main);
      ell(ctx, s, ex, hy - h * 0.75, e * 0.3, e * 0.28, inner, null);
    } else if (c.ears === 'long') {
      ell(ctx, s, ex + lean, hy - h * 0.55 - e, e * 0.32, e * 1.05, main);
      ell(ctx, s, ex + lean, hy - h * 0.55 - e, e * 0.14, e * 0.78, inner, null);
    }
  }
}

function drawTail(ctx: Ctx, s: number, x: number, y: number, view: View, c: QuadCfg, main: string, light: string) {
  const side = view === 'side';
  switch (c.tail) {
    case 'bushy':
      if (side) {
        ell(ctx, s, x - 0.08, y - 0.03, 0.11, 0.06, main);
        if (c.tailTip) ell(ctx, s, x - 0.16, y - 0.05, 0.045, 0.04, c.tailTip, null);
      } else {
        ell(ctx, s, x, y, 0.07, 0.11, main);
        if (c.tailTip) ell(ctx, s, x, y + 0.08, 0.045, 0.035, c.tailTip, null);
      }
      break;
    case 'short':
      ell(ctx, s, side ? x - 0.02 : x, y, 0.03, 0.025, main);
      break;
    case 'puff':
      ell(ctx, s, side ? x - 0.02 : x, y, 0.05, 0.05, light);
      break;
    case 'none':
      break;
  }
}

export function drawQuad(pal: string[], c: QuadCfg): DrawFn {
  const [main, dark, light, nose] = pal;
  const legFar = shade(main, -0.3);
  const legNear = shade(main, -0.12);
  return (ctx, view, f, s) => {
    const ground = 0.96;
    const bob = f === 0 ? 0 : 0.012;
    const by = ground - c.legLen - c.bodyRy * 0.5 - bob;
    const leg = (x: number, col: string, lift: number) =>
      rect(ctx, s, x - c.legW / 2, by, c.legW, ground - by - lift, col);

    if (view === 'side') {
      const bx = 0.47;
      const stride = f === 0 ? 0 : f === 1 ? 0.03 : -0.03;
      drawTail(ctx, s, bx - c.bodyRx * 0.9, by - c.bodyRy * 0.35, view, c, main, light);
      leg(bx - c.bodyRx * 0.55 + 0.03 - stride, legFar, 0);
      leg(bx + c.bodyRx * 0.55 + 0.03 + stride, legFar, 0);
      leg(bx - c.bodyRx * 0.55 + stride, legNear, 0);
      leg(bx + c.bodyRx * 0.55 - stride, legNear, 0);
      ell(ctx, s, bx, by, c.bodyRx, c.bodyRy, main);
      if (c.belly) ell(ctx, s, bx + 0.02, by + c.bodyRy * 0.45, c.bodyRx * 0.65, c.bodyRy * 0.35, light, null);
      if (c.mane) {
        for (let i = 0; i < 5; i++) {
          const mx = bx - c.bodyRx * 0.6 + i * c.bodyRx * 0.3;
          poly(ctx, s, [mx - 0.03, by - c.bodyRy * 0.8, mx + 0.03, by - c.bodyRy * 0.8, mx, by - c.bodyRy - 0.06], dark, null);
        }
      }
      const hx = bx + c.bodyRx * 0.85;
      const hy = by - c.bodyRy * 0.7;
      drawEars(ctx, s, hx, hy, c.head, c, main, dark, view);
      ell(ctx, s, hx, hy, c.head, c.head * 0.92, main);
      ell(ctx, s, hx + c.head * 0.75, hy + c.head * 0.3, c.snout, c.snout * 0.7, light);
      ell(ctx, s, hx + c.head * 0.75 + c.snout * 0.85, hy + c.head * 0.22, c.head * 0.14, c.head * 0.12, nose, null);
      if (c.tusks) poly(ctx, s, [hx + c.head * 0.6, hy + c.head * 0.5, hx + c.head * 0.8, hy + c.head * 0.5, hx + c.head * 0.85, hy + c.head * 0.05], '#f4ecd8');
      eye(ctx, s, hx + c.head * 0.3, hy - c.head * 0.15, c.head * 0.16);
    } else {
      const bx = 0.5;
      const front = view === 'front';
      const lx = c.bodyRx * 0.38;
      leg(bx - lx, legNear, f === 1 ? 0.025 : 0);
      leg(bx + lx, legNear, f === 2 ? 0.025 : 0);
      const drawHead = (hy: number) => {
        drawEars(ctx, s, bx, hy, c.head, c, main, dark, view);
        ell(ctx, s, bx, hy, c.head * 1.05, c.head, main);
      };
      if (!front) drawHead(by - c.bodyRy * 1.05);
      ell(ctx, s, bx, by, c.bodyRx * 0.62, c.bodyRy * 1.05, main);
      if (c.mane && !front) {
        for (let i = 0; i < 3; i++) {
          const mx = bx - 0.06 + i * 0.06;
          poly(ctx, s, [mx - 0.03, by - c.bodyRy * 0.7, mx + 0.03, by - c.bodyRy * 0.7, mx, by - c.bodyRy - 0.05], dark, null);
        }
      }
      if (front) {
        if (c.belly) ell(ctx, s, bx, by + 0.02, c.bodyRx * 0.32, c.bodyRy * 0.7, light, null);
        const hy = by - c.bodyRy * 0.75;
        drawHead(hy);
        eye(ctx, s, bx - c.head * 0.42, hy - c.head * 0.1, c.head * 0.15);
        eye(ctx, s, bx + c.head * 0.42, hy - c.head * 0.1, c.head * 0.15);
        ell(ctx, s, bx, hy + c.head * 0.45, c.snout * 0.9, c.snout * 0.7, light);
        ell(ctx, s, bx, hy + c.head * 0.32, c.head * 0.15, c.head * 0.11, nose, null);
        if (c.tusks) {
          poly(ctx, s, [bx - c.head * 0.55, hy + c.head * 0.6, bx - c.head * 0.4, hy + c.head * 0.6, bx - c.head * 0.6, hy + c.head * 0.1], '#f4ecd8');
          poly(ctx, s, [bx + c.head * 0.55, hy + c.head * 0.6, bx + c.head * 0.4, hy + c.head * 0.6, bx + c.head * 0.6, hy + c.head * 0.1], '#f4ecd8');
        }
      } else {
        drawTail(ctx, s, bx, by - c.bodyRy * 0.1, view, c, main, light);
      }
    }
  };
}

const HUMAN: Record<ClassId, { hair: string; cloth: string; trim: string; hat?: string }> = {
  sword: { hair: '#6b3f22', cloth: '#9a4f2c', trim: '#d9b36c' },
  mage: { hair: '#e8e0d0', cloth: '#3c5bb0', trim: '#e0c060', hat: '#5a3a8a' },
  gunslinger: { hair: '#2e2a26', cloth: '#3f5a52', trim: '#c9a05a', hat: '#6a4a2e' },
};

export function drawHuman(kind: ClassId): DrawFn {
  const { hair, cloth, trim, hat } = HUMAN[kind];
  const skin = '#f2c9a1';
  const pants = '#3a2e28';
  return (ctx, view, f, s) => {
    const st = f === 0 ? 0 : f === 1 ? 1 : -1;
    const bob = f === 0 ? 0 : 0.012;
    if (view === 'side') {
      rect(ctx, s, 0.44 + st * 0.05, 0.74, 0.08, 0.21, shade(pants, -0.25));
      rect(ctx, s, 0.48 - st * 0.05, 0.74, 0.08, 0.21, pants);
    } else {
      rect(ctx, s, 0.39, 0.74, 0.09, 0.21 - (st > 0 ? 0.03 : 0), pants);
      rect(ctx, s, 0.52, 0.74, 0.09, 0.21 - (st < 0 ? 0.03 : 0), pants);
    }
    if (view === 'back') drawWeapon(ctx, s, 0.5, 0.6, view, kind);
    const by = 0.52 - bob;
    if (kind === 'mage') {
      poly(ctx, s, [0.33, 0.84, 0.67, 0.84, 0.61, by, 0.39, by], cloth);
      rect(ctx, s, 0.34, 0.79, 0.32, 0.04, trim, null);
    } else if (kind === 'gunslinger') {
      poly(ctx, s, [0.34, 0.82, 0.66, 0.82, 0.63, by, 0.37, by], cloth);
      rect(ctx, s, 0.37, 0.68, 0.26, 0.035, '#3a2a1a', null);
      rect(ctx, s, 0.48, 0.68, 0.04, 0.035, trim, null);
    } else {
      rect(ctx, s, 0.36, by, 0.28, 0.26, cloth);
      rect(ctx, s, 0.36, by + 0.18, 0.28, 0.04, '#3a2a1a', null);
      rect(ctx, s, 0.47, by + 0.18, 0.06, 0.04, trim, null);
    }
    if (view === 'side') {
      rect(ctx, s, 0.47 - st * 0.04, by + 0.02, 0.08, 0.18, shade(HUMAN[kind].cloth, -0.15));
    } else {
      rect(ctx, s, 0.29, by + 0.02, 0.08, 0.18, cloth);
      rect(ctx, s, 0.63, by + 0.02, 0.08, 0.18, cloth);
      ell(ctx, s, 0.33, by + 0.22, 0.04, 0.04, skin);
      ell(ctx, s, 0.67, by + 0.22, 0.04, 0.04, skin);
    }
    const hy = 0.37 - bob;
    ell(ctx, s, 0.5, hy, 0.15, 0.15, skin);
    if (view === 'front') {
      ell(ctx, s, 0.5, hy - 0.08, 0.16, 0.09, hair);
      rect(ctx, s, 0.42, hy, 0.035, 0.05, '#2a1c12', null);
      rect(ctx, s, 0.545, hy, 0.035, 0.05, '#2a1c12', null);
    } else if (view === 'side') {
      ell(ctx, s, 0.46, hy - 0.06, 0.15, 0.11, hair);
      rect(ctx, s, 0.6, hy, 0.035, 0.05, '#2a1c12', null);
    } else {
      ell(ctx, s, 0.5, hy - 0.01, 0.155, 0.155, hair);
    }
    if (kind === 'mage' && hat) {
      poly(ctx, s, [0.3, hy - 0.08, 0.7, hy - 0.08, 0.56, hy - 0.34], hat);
      ell(ctx, s, 0.5, hy - 0.08, 0.22, 0.045, shade(hat, -0.2));
    } else if (kind === 'gunslinger' && hat) {
      ell(ctx, s, 0.5, hy - 0.09, 0.25, 0.05, hat);
      rect(ctx, s, 0.39, hy - 0.2, 0.22, 0.11, hat);
      rect(ctx, s, 0.39, hy - 0.12, 0.22, 0.025, trim, null);
    }
    if (view !== 'back') drawWeapon(ctx, s, view === 'side' ? 0.6 : 0.69, 0.62, view, kind);
  };
}

function drawWeapon(ctx: Ctx, s: number, x: number, y: number, view: View, kind: ClassId) {
  if (kind === 'mage') {
    rect(ctx, s, x - 0.018, y - 0.34, 0.036, 0.58, '#7a5230');
    ell(ctx, s, x, y - 0.36, 0.05, 0.05, '#7fe0ff');
  } else if (kind === 'gunslinger') {
    if (view === 'back') return;
    rect(ctx, s, x - 0.02, y - 0.02, 0.05, 0.09, '#4a3020');
    rect(ctx, s, x - 0.02, y - 0.05, view === 'side' ? 0.14 : 0.05, 0.05, '#8a8f96');
  } else if (view === 'back') {
    poly(ctx, s, [x - 0.14, y + 0.1, x - 0.1, y + 0.13, x + 0.14, y - 0.22, x + 0.11, y - 0.25], '#cfd6dc');
  } else {
    rect(ctx, s, x - 0.02, y - 0.34, 0.04, 0.32, '#d6dde3');
    rect(ctx, s, x - 0.06, y - 0.03, 0.12, 0.03, '#a07a30');
    rect(ctx, s, x - 0.015, y, 0.03, 0.07, '#5a3a20');
  }
}

export function drawSeeker(): DrawFn {
  // Hooded figure with a golden-white lantern — the guide from The Origin Realm.
  return (ctx, view, f, s) => {
    const bob = f === 0 ? 0 : 0.01;
    poly(ctx, s, [0.3, 0.95, 0.7, 0.95, 0.62, 0.45 - bob, 0.38, 0.45 - bob], '#e8e2d0');
    rect(ctx, s, 0.31, 0.9, 0.38, 0.04, '#c9a85a', null);
    ell(ctx, s, 0.5, 0.36 - bob, 0.17, 0.17, '#d9d1bc');
    if (view !== 'back') ell(ctx, s, view === 'side' ? 0.56 : 0.5, 0.39 - bob, 0.1, 0.1, '#2a2430', null);
    if (view === 'front') {
      ell(ctx, s, 0.46, 0.39 - bob, 0.018, 0.018, '#ffe9a0', null);
      ell(ctx, s, 0.54, 0.39 - bob, 0.018, 0.018, '#ffe9a0', null);
    }
    if (view !== 'back') {
      rect(ctx, s, 0.7, 0.42, 0.02, 0.2, '#6a5a40', null);
      ell(ctx, s, 0.71, 0.66, 0.06, 0.07, '#fff3c0');
    }
  };
}

export function drawMerchant(): DrawFn {
  // Plump trader in a green coat with a big backpack and a coin pouch.
  const skin = '#f2c9a1';
  return (ctx, view, f, s) => {
    const bob = f === 0 ? 0 : 0.01;
    rect(ctx, s, 0.39, 0.78, 0.09, 0.17, '#4a3a2a');
    rect(ctx, s, 0.52, 0.78, 0.09, 0.17, '#4a3a2a');
    if (view !== 'front') rect(ctx, s, view === 'side' ? 0.24 : 0.3, 0.42 - bob, view === 'side' ? 0.2 : 0.4, 0.32, '#8a5a2a');
    ell(ctx, s, 0.5, 0.64 - bob, 0.2, 0.19, '#3e7a3a');
    rect(ctx, s, 0.31, 0.7 - bob, 0.38, 0.04, '#d9b36c', null);
    if (view === 'front') {
      rect(ctx, s, 0.2, 0.36 - bob, 0.06, 0.34, '#8a5a2a');
      rect(ctx, s, 0.74, 0.36 - bob, 0.06, 0.34, '#8a5a2a');
      ell(ctx, s, 0.6, 0.76 - bob, 0.06, 0.06, '#c9a227');
    }
    const hy = 0.36 - bob;
    ell(ctx, s, 0.5, hy, 0.14, 0.14, skin);
    if (view === 'front') {
      rect(ctx, s, 0.43, hy, 0.03, 0.04, '#2a1c12', null);
      rect(ctx, s, 0.54, hy, 0.03, 0.04, '#2a1c12', null);
      ell(ctx, s, 0.5, hy + 0.08, 0.07, 0.03, '#6b3f22', null);
    } else if (view === 'side') {
      rect(ctx, s, 0.58, hy, 0.03, 0.04, '#2a1c12', null);
    }
    ell(ctx, s, 0.5, hy - 0.1, 0.22, 0.05, '#7a5a2a');
    rect(ctx, s, 0.39, hy - 0.22, 0.22, 0.12, '#7a5a2a');
  };
}

export function drawBlacksmith(): DrawFn {
  // Broad smith with a leather apron, beard and a hammer.
  const skin = '#d9a77f';
  return (ctx, view, f, s) => {
    const bob = f === 0 ? 0 : 0.01;
    rect(ctx, s, 0.38, 0.76, 0.1, 0.19, '#2e2622');
    rect(ctx, s, 0.52, 0.76, 0.1, 0.19, '#2e2622');
    const by = 0.5 - bob;
    rect(ctx, s, 0.32, by, 0.36, 0.28, '#8a8f96');
    if (view !== 'back') rect(ctx, s, 0.37, by + 0.04, 0.26, 0.3, '#6b4530');
    if (view === 'side') {
      rect(ctx, s, 0.46, by + 0.02, 0.1, 0.2, skin);
    } else {
      rect(ctx, s, 0.24, by + 0.02, 0.09, 0.2, skin);
      rect(ctx, s, 0.67, by + 0.02, 0.09, 0.2, skin);
    }
    const hy = 0.36 - bob;
    ell(ctx, s, 0.5, hy, 0.14, 0.14, skin);
    if (view === 'back') ell(ctx, s, 0.5, hy - 0.02, 0.145, 0.13, '#3a2418');
    else {
      ell(ctx, s, view === 'side' ? 0.55 : 0.5, hy + 0.09, 0.11, 0.08, '#b8521e');
      rect(ctx, s, view === 'side' ? 0.58 : 0.43, hy - 0.03, 0.03, 0.04, '#2a1c12', null);
      if (view === 'front') rect(ctx, s, 0.54, hy - 0.03, 0.03, 0.04, '#2a1c12', null);
      ell(ctx, s, 0.5, hy - 0.1, 0.13, 0.05, '#3a2418');
    }
    if (view !== 'back') {
      const hx = view === 'side' ? 0.66 : 0.74;
      rect(ctx, s, hx - 0.015, 0.42, 0.03, 0.3, '#6b4530');
      rect(ctx, s, hx - 0.07, 0.38, 0.14, 0.08, '#5a5f66');
    }
  };
}

// ---------------------------------------------------------------- props

export function drawTree(variant: number): HTMLCanvasElement {
  const r = mulberry32(variant * 977 + 13);
  const W = 64;
  const H = 96;
  const c = newCanvas(W, H);
  const ctx = c.getContext('2d')!;
  const greens = [
    ['#244a22', '#2f6a2c', '#4a8c3a', '#73b04e'],
    ['#2a4d2a', '#356b34', '#4f8f45', '#86bf5e'],
    ['#1f4430', '#2a5e3e', '#3f8452', '#6aaa6a'],
  ][variant % 3];
  poly(ctx, 1, [26, 94, 38, 94, 35, 56, 29, 56], '#6a4428');
  rect(ctx, 1, 30, 60, 2, 30, '#8a5e3a', null);
  poly(ctx, 1, [22, 95, 28, 88, 30, 95], '#5a3a22');
  poly(ctx, 1, [42, 95, 36, 88, 34, 95], '#5a3a22');
  const blobs = (cy: number, rad: number, col: string, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r();
      ell(ctx, 1, 32 + Math.cos(a) * rad * 0.85, cy + Math.sin(a) * rad * 0.45, rad * 0.5 + r() * 3, rad * 0.45 + r() * 3, col);
    }
    ell(ctx, 1, 32, cy, rad * 0.8, rad * 0.55, col, null);
  };
  blobs(54, 19, greens[0], 7);
  blobs(42, 16, greens[1], 6);
  blobs(30, 12, greens[2], 5);
  ell(ctx, 1, 32, 21, 8, 7, greens[2]);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = greens[3];
    ctx.fillRect(Math.floor(18 + r() * 28), Math.floor(16 + r() * 40), 2, 2);
  }
  return c;
}

export function drawBush(variant: number): HTMLCanvasElement {
  const r = mulberry32(variant * 31 + 7);
  const c = newCanvas(40, 28);
  const ctx = c.getContext('2d')!;
  const cols = ['#2f6a2c', '#3f7f36', '#58983f'];
  for (let i = 0; i < 6; i++) ell(ctx, 1, 8 + r() * 24, 15 + r() * 6, 7 + r() * 3, 6 + r() * 2, cols[i % 3]);
  ell(ctx, 1, 20, 17, 12, 7, cols[2], null);
  if (variant % 2) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = r() > 0.5 ? '#e84a5a' : '#ffffff';
      ctx.fillRect(Math.floor(8 + r() * 24), Math.floor(10 + r() * 12), 2, 2);
    }
  }
  return c;
}

export function drawRock(variant: number): HTMLCanvasElement {
  const c = newCanvas(36, 26);
  const ctx = c.getContext('2d')!;
  const base = variant ? '#8a8f8a' : '#7d8077';
  ell(ctx, 1, 18, 17, 15, 8, base);
  ell(ctx, 1, variant ? 13 : 22, 13, 9, 7, shade(base, 0.12));
  ell(ctx, 1, 15, 11, 4, 2, shade(base, 0.35), null);
  ctx.fillStyle = '#5a8a3a';
  ctx.fillRect(6, 20, 5, 2);
  ctx.fillRect(25, 21, 4, 2);
  return c;
}

export function drawStump(): HTMLCanvasElement {
  const c = newCanvas(28, 24);
  const ctx = c.getContext('2d')!;
  rect(ctx, 1, 6, 9, 16, 12, '#6a4428');
  ell(ctx, 1, 14, 9, 8, 3.5, '#c49a62');
  ell(ctx, 1, 14, 9, 4, 1.6, '#a07a48', null);
  return c;
}

export function drawTent(): HTMLCanvasElement {
  const c = newCanvas(64, 56);
  const ctx = c.getContext('2d')!;
  poly(ctx, 1, [4, 52, 60, 52, 32, 6], '#c9b48a');
  poly(ctx, 1, [32, 6, 60, 52, 44, 52], '#a8916a', null);
  poly(ctx, 1, [24, 52, 40, 52, 32, 26], '#4a3626');
  rect(ctx, 1, 31, 2, 2, 8, '#6a4428', null);
  poly(ctx, 1, [33, 2, 42, 5, 33, 8], '#d0473a', null);
  return c;
}

export function drawCampfire(): HTMLCanvasElement {
  const c = newCanvas(32, 32);
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ell(ctx, 1, 16 + Math.cos(a) * 11, 25 + Math.sin(a) * 4, 3, 2.2, '#7d8077');
  }
  poly(ctx, 1, [7, 27, 25, 21, 26, 24, 8, 30], '#6a4428');
  poly(ctx, 1, [7, 21, 25, 27, 24, 30, 6, 24], '#5a3a22');
  poly(ctx, 1, [10, 24, 22, 24, 16, 6], '#ff8a2a', null);
  poly(ctx, 1, [12, 24, 20, 24, 16, 12], '#ffd34a', null);
  return c;
}

export function drawSign(): HTMLCanvasElement {
  const c = newCanvas(24, 32);
  const ctx = c.getContext('2d')!;
  rect(ctx, 1, 10, 12, 4, 19, '#6a4428');
  poly(ctx, 1, [2, 4, 18, 4, 22, 9, 18, 14, 2, 14], '#a07a48');
  ctx.fillStyle = '#4a3626';
  ctx.fillRect(5, 8, 10, 1);
  ctx.fillRect(5, 10, 7, 1);
  return c;
}

export function drawFence(): HTMLCanvasElement {
  const c = newCanvas(48, 28);
  const ctx = c.getContext('2d')!;
  rect(ctx, 1, 2, 8, 44, 4, '#8a6440');
  rect(ctx, 1, 2, 16, 44, 4, '#7a5636');
  for (const x of [4, 22, 40]) poly(ctx, 1, [x, 27, x + 5, 27, x + 5, 5, x + 2.5, 2, x, 5], '#9a7048');
  return c;
}

export function drawRunestone(): HTMLCanvasElement {
  const c = newCanvas(28, 44);
  const ctx = c.getContext('2d')!;
  poly(ctx, 1, [5, 42, 23, 42, 21, 8, 14, 2, 7, 8], '#6f7a80');
  poly(ctx, 1, [14, 2, 21, 8, 23, 42, 16, 42], '#5a646a', null);
  ctx.fillStyle = '#ffe9a0';
  ctx.fillRect(12, 14, 4, 2);
  ctx.fillRect(13, 18, 2, 8);
  ctx.fillRect(11, 28, 6, 2);
  return c;
}

// ---------------------------------------------------------------- icons & fx

export function drawIcon(kind: 'coin' | 'potion_hp' | 'potion_mp' | 'bag', color = '#d8d8d8'): HTMLCanvasElement {
  const c = newCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  if (kind === 'coin') {
    ell(ctx, 1, 8, 9, 5.5, 5, '#f2c230');
    ell(ctx, 1, 8, 9, 3, 2.8, '#ffe27a', null);
  } else if (kind === 'bag') {
    ell(ctx, 1, 8, 10, 5.5, 5, color);
    rect(ctx, 1, 6, 3, 4, 3, color);
    rect(ctx, 1, 5, 5, 6, 1, '#6a4428', null);
  } else {
    const liquid = kind === 'potion_hp' ? '#e8323c' : '#3a7bff';
    rect(ctx, 1, 6, 2, 4, 4, '#d8d0c0');
    ell(ctx, 1, 8, 10.5, 5, 4.5, liquid);
    ell(ctx, 1, 6.5, 9, 1.3, 1.3, '#ffffff', null);
  }
  return c;
}

export function radialCanvas(size: number, inner: string, outer: string): HTMLCanvasElement {
  const c = newCanvas(size, size);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export type { Rng };
