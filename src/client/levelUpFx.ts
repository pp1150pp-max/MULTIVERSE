// Level-up effects, worn as a cosmetic (owner 2026-11-25, docs/systems/cosmetics.md "เอฟเฟกต์เลเวลอัป"): six
// styles, each its own drawing, all with a "LEVEL UP !" title in the style's own lettering:
//   cyan    — the magic circle of #485: broken rings turning, light streaks and sparks rising, chevrons over the head
//   fire    — a ring of flame on the ground, flames spiralling up round the body, embers flying
//   thunder — bolts striking down one after another, a flash and cracks on the ground, electric sparks
//   leaf    — a whirlwind of rings rising like a funnel, leaves spiralling up and drifting off
//   star    — a constellation circle, shooting stars falling onto the player, twinkling stars
//   shadow  — a dark pool with a turning vortex, smoke spiralling up, dark wisps
// Everything is drawn in code (canvas textures made once, the coloured titles cached per colour pair). Each
// worn piece has its own colours, size, time and parts (cosTuning.ts `levelup`, set on the /admin bench).
// Kept free of the game's own textures so the /admin benches can play it in their own scenes.
// The plain textures and the small helpers are shared with the dash effects (dashFx.ts).
import * as THREE from 'three';
import { colorHex, type TuneValues } from '../shared/cosTuning';

export type LevelUpStyle = 'cyan' | 'fire' | 'thunder' | 'leaf' | 'star' | 'shadow';

/** Which drawing each level-up cosmetic plays. */
export const LEVELUP_STYLE: Readonly<Record<string, LevelUpStyle>> = {
  levelup_cyan: 'cyan',
  levelup_fire: 'fire',
  levelup_thunder: 'thunder',
  levelup_leaf: 'leaf',
  levelup_star: 'star',
  levelup_shadow: 'shadow',
};

/** One piece's look (its cosTuning values). */
export interface LevelUpLook {
  ground: boolean;
  sparks: boolean;
  /** The style's centrepiece: chevrons, the fire spiral, the bolts, the leaf whirl, the shooting stars, the smoke vortex. */
  main: boolean;
  text: boolean;
  /** × size of the whole effect. */
  size: number;
  /** How long it lasts, in seconds. */
  sec: number;
  color1: string;
  color2: string;
}

/** A level-up cosmetic's tuning values as the effect takes them. */
export const levelUpLookOf = (v: TuneValues | undefined): LevelUpLook => ({
  ground: v?.ground !== false, sparks: v?.sparks !== false, main: v?.main !== false, text: v?.text !== false,
  size: typeof v?.size === 'number' ? v.size : 1, sec: typeof v?.sec === 'number' ? v.sec : 2.2,
  color1: colorHex(v?.color1 ?? 0x4dfff0), color2: colorHex(v?.color2 ?? 0x2a9fe0),
});

export interface LevelUpOpts {
  /** × the number of sparks and streaks (graphics quality, other players, touch screens). 0 = none. */
  particles: number;
  /** Draw the ground and the centrepiece (off: quality "off" or another player's with "others: none"). */
  extras: boolean;
  /** Where the player is now (the effect follows them); null = stays where it began. */
  follow?: () => { x: number; z: number } | null;
}

/** Adds an object to the scene for `life` seconds, ticking it with k = 0…1 (Effects.add). */
export type LevelUpHost = (obj: THREE.Object3D, life: number, tick: (k: number, dt: number) => void) => void;

/** Height over the ground of the title (a player's head is at 1.9). */
const TEXT_Y = 2.75;
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ textures (white, tinted by the material)

export const canvas = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
};
export const toTex = (c: HTMLCanvasElement): THREE.CanvasTexture => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export interface Plain {
  disc: THREE.Texture; ringA: THREE.Texture; ringB: THREE.Texture; streak: THREE.Texture; spark: THREE.Texture;
  star4: THREE.Texture; star5: THREE.Texture; flame: THREE.Texture; leaf: THREE.Texture; smoke: THREE.Texture;
  fireRing: THREE.Texture; crack: THREE.Texture; windRing: THREE.Texture; stars: THREE.Texture; vortex: THREE.Texture;
  bolts: THREE.Texture[];
}
let plain: Plain | null = null;

export function starPath(x: CanvasRenderingContext2D, cx: number, cy: number, points: number, outer: number, inner: number, rot = -Math.PI / 2): void {
  x.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i / (points * 2)) * TAU;
    if (i) x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  x.closePath();
}

export function flamePath(x: CanvasRenderingContext2D, cx: number, base: number, w: number, h: number): void {
  x.beginPath();
  x.moveTo(cx, base - h);
  x.bezierCurveTo(cx + w * 0.15, base - h * 0.6, cx + w * 0.6, base - h * 0.45, cx + w * 0.5, base - h * 0.15);
  x.bezierCurveTo(cx + w * 0.45, base + h * 0.02, cx - w * 0.45, base + h * 0.02, cx - w * 0.5, base - h * 0.15);
  x.bezierCurveTo(cx - w * 0.6, base - h * 0.45, cx - w * 0.15, base - h * 0.6, cx, base - h);
  x.closePath();
}

export function leafPath(x: CanvasRenderingContext2D, cx: number, cy: number, len: number, wid: number): void {
  x.beginPath();
  x.moveTo(cx, cy - len / 2);
  x.quadraticCurveTo(cx + wid, cy, cx, cy + len / 2);
  x.quadraticCurveTo(cx - wid, cy, cx, cy - len / 2);
  x.closePath();
}

/** A jagged bolt from the top to the bottom of a tall canvas, with a couple of forks. */
function boltTex(): THREE.Texture {
  const [c, x] = canvas(64, 512);
  x.strokeStyle = '#fff';
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.shadowColor = '#fff';
  const pts: [number, number][] = [];
  let px = 32;
  for (let y = 0; y <= 512; y += 32) {
    pts.push([px, y]);
    px = Math.max(10, Math.min(54, px + rnd(-14, 14)));
  }
  pts[pts.length - 1][0] = 32;
  const line = (p: [number, number][], w: number, blur: number) => {
    x.lineWidth = w;
    x.shadowBlur = blur;
    x.beginPath();
    p.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
    x.stroke();
  };
  line(pts, 7, 16);
  line(pts, 3, 4);
  for (let f = 0; f < 2; f++) {
    const at = 3 + Math.floor(Math.random() * (pts.length - 7));
    const fork: [number, number][] = [pts[at]];
    let [fx, fy] = pts[at];
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < 3; i++) {
      fx = Math.max(4, Math.min(60, fx + dir * rnd(6, 12)));
      fy += rnd(24, 40);
      fork.push([fx, fy]);
    }
    line(fork, 3, 8);
  }
  return toTex(c);
}

export function plainTex(): Plain {
  if (plain) return plain;
  // soft glow disc
  const [d, dc] = canvas(128, 128);
  const g = dc.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  dc.fillStyle = g;
  dc.fillRect(0, 0, 128, 128);
  // a ring broken into arcs of different lengths, with a faint whole ring inside
  const ring = (arcs: [number, number][], width: number, inner: boolean): THREE.Texture => {
    const [c, x] = canvas(256, 256);
    x.strokeStyle = '#fff';
    x.shadowColor = '#fff';
    x.shadowBlur = 10;
    x.lineCap = 'round';
    x.lineWidth = width;
    for (const [a, len] of arcs) {
      x.beginPath();
      x.arc(128, 128, 112, a, a + len);
      x.stroke();
    }
    if (inner) {
      x.globalAlpha = 0.35;
      x.lineWidth = 2;
      x.beginPath();
      x.arc(128, 128, 96, 0, TAU);
      x.stroke();
      x.globalAlpha = 0.6;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        x.beginPath();
        x.moveTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88);
        x.lineTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100);
        x.stroke();
      }
    }
    return toTex(c);
  };
  const ringA = ring([[0, 1.1], [1.35, 0.5], [2.1, 1.3], [3.7, 0.35], [4.3, 1.2], [5.75, 0.4]], 7, true);
  const ringB = ring([[0.3, 0.7], [1.6, 0.9], [3.0, 0.5], [3.9, 0.8], [5.2, 0.6]], 4, false);
  // a thin upright streak, brightest in the middle
  const [s, sc] = canvas(16, 128);
  const sg = sc.createLinearGradient(0, 0, 0, 128);
  sg.addColorStop(0, 'rgba(255,255,255,0)');
  sg.addColorStop(0.45, 'rgba(255,255,255,1)');
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  sc.fillStyle = sg;
  sc.fillRect(6, 0, 4, 128);
  sc.globalAlpha = 0.35;
  sc.fillRect(3, 0, 10, 128);
  // a spark
  const [p, pc] = canvas(32, 32);
  const pg = pc.createRadialGradient(16, 16, 0, 16, 16, 16);
  pg.addColorStop(0, 'rgba(255,255,255,1)');
  pg.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  pg.addColorStop(1, 'rgba(255,255,255,0)');
  pc.fillStyle = pg;
  pc.fillRect(0, 0, 32, 32);
  // a four-point twinkle and a five-point star
  const [s4, s4c] = canvas(64, 64);
  s4c.fillStyle = '#fff';
  s4c.shadowColor = '#fff';
  s4c.shadowBlur = 8;
  starPath(s4c, 32, 32, 4, 30, 5);
  s4c.fill();
  const [s5, s5c] = canvas(64, 64);
  s5c.fillStyle = '#fff';
  s5c.shadowColor = '#fff';
  s5c.shadowBlur = 10;
  starPath(s5c, 32, 34, 5, 26, 11);
  s5c.fill();
  // a flame tongue: bright core, soft edge
  const [f, fc] = canvas(64, 96);
  const fg = fc.createRadialGradient(32, 70, 2, 32, 60, 44);
  fg.addColorStop(0, 'rgba(255,255,255,1)');
  fg.addColorStop(0.5, 'rgba(255,255,255,0.75)');
  fg.addColorStop(1, 'rgba(255,255,255,0.1)');
  fc.fillStyle = fg;
  fc.shadowColor = '#fff';
  fc.shadowBlur = 8;
  flamePath(fc, 32, 88, 44, 82);
  fc.fill();
  // a leaf with its middle vein
  const [l, lc] = canvas(48, 64);
  lc.fillStyle = '#fff';
  leafPath(lc, 24, 32, 56, 22);
  lc.fill();
  lc.strokeStyle = 'rgba(0,0,0,0.35)';
  lc.lineWidth = 2;
  lc.beginPath();
  lc.moveTo(24, 6);
  lc.lineTo(24, 58);
  lc.stroke();
  // a lumpy smoke puff
  const [m, mc] = canvas(128, 128);
  for (let i = 0; i < 7; i++) {
    const cx = 64 + rnd(-22, 22);
    const cy = 64 + rnd(-22, 22);
    const r = rnd(26, 42);
    const mg = mc.createRadialGradient(cx, cy, 0, cx, cy, r);
    mg.addColorStop(0, 'rgba(255,255,255,0.5)');
    mg.addColorStop(1, 'rgba(255,255,255,0)');
    mc.fillStyle = mg;
    mc.fillRect(0, 0, 128, 128);
  }
  // a ring of flame tongues pointing out
  const [fr, frc] = canvas(256, 256);
  frc.fillStyle = '#fff';
  frc.shadowColor = '#fff';
  frc.shadowBlur = 12;
  for (let i = 0; i < 18; i++) {
    frc.save();
    frc.translate(128, 128);
    frc.rotate((i / 18) * TAU);
    flamePath(frc, 0, -84, 22, 28 + (i % 3) * 10);
    frc.fill();
    frc.restore();
  }
  frc.lineWidth = 5;
  frc.strokeStyle = '#fff';
  frc.beginPath();
  frc.arc(128, 128, 84, 0, TAU);
  frc.stroke();
  // cracks spreading from the middle
  const [cr, crc] = canvas(256, 256);
  crc.strokeStyle = '#fff';
  crc.shadowColor = '#fff';
  crc.shadowBlur = 8;
  crc.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    let a = (i / 9) * TAU + rnd(-0.2, 0.2);
    let r = 14;
    let [x0, y0] = [128 + Math.cos(a) * r, 128 + Math.sin(a) * r];
    crc.lineWidth = 4;
    crc.beginPath();
    crc.moveTo(x0, y0);
    while (r < 118) {
      r += rnd(12, 22);
      a += rnd(-0.25, 0.25);
      [x0, y0] = [128 + Math.cos(a) * r, 128 + Math.sin(a) * r];
      crc.lineTo(x0, y0);
      crc.lineWidth = Math.max(1, crc.lineWidth - 0.5);
    }
    crc.stroke();
  }
  // wind: three comma-like arcs turning the same way
  const [w, wc] = canvas(256, 256);
  wc.strokeStyle = '#fff';
  wc.shadowColor = '#fff';
  wc.shadowBlur = 8;
  wc.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a0 = (i / 3) * TAU;
    for (let j = 0; j < 14; j++) {
      const a = a0 + (j / 14) * 1.7;
      const r = 112 - j * 2.5;
      wc.lineWidth = 9 - j * 0.55;
      wc.beginPath();
      wc.arc(128, 128, r, a, a + 0.14);
      wc.stroke();
    }
  }
  // a constellation: a ring of stars joined by thin lines into a star figure
  const [st, stc] = canvas(256, 256);
  stc.strokeStyle = '#fff';
  stc.fillStyle = '#fff';
  stc.shadowColor = '#fff';
  stc.shadowBlur = 8;
  stc.globalAlpha = 0.6;
  stc.lineWidth = 2;
  stc.beginPath();
  stc.arc(128, 128, 112, 0, TAU);
  stc.stroke();
  stc.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + ((i * 2) % 5) * (TAU / 5);
    const [x0, y0] = [128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96];
    if (i) stc.lineTo(x0, y0);
    else stc.moveTo(x0, y0);
  }
  stc.stroke();
  stc.globalAlpha = 1;
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * TAU;
    const r = i % 2 ? 112 : 96;
    starPath(stc, 128 + Math.cos(a) * r, 128 + Math.sin(a) * r, i % 2 ? 4 : 5, i % 2 ? 7 : 11, i % 2 ? 2 : 4.5);
    stc.fill();
  }
  // a vortex: spiral arms winding in
  const [v, vc] = canvas(256, 256);
  vc.strokeStyle = '#fff';
  vc.shadowColor = '#fff';
  vc.shadowBlur = 10;
  vc.lineCap = 'round';
  for (let arm = 0; arm < 4; arm++) {
    vc.beginPath();
    for (let j = 0; j <= 40; j++) {
      const q = j / 40;
      const a = (arm / 4) * TAU + q * 4.2;
      const r = 118 * (1 - q * 0.88);
      const [x0, y0] = [128 + Math.cos(a) * r, 128 + Math.sin(a) * r];
      if (j) vc.lineTo(x0, y0);
      else vc.moveTo(x0, y0);
    }
    vc.lineWidth = 6;
    vc.stroke();
  }
  plain = {
    disc: toTex(d), ringA, ringB, streak: toTex(s), spark: toTex(p), star4: toTex(s4), star5: toTex(s5), flame: toTex(f),
    leaf: toTex(l), smoke: toTex(m), fireRing: toTex(fr), crack: toTex(cr), windRing: toTex(w), stars: toTex(st), vortex: toTex(v),
    bolts: Array.from({ length: 5 }, boltTex),
  };
  return plain;
}

/** `hex` mixed toward white (k > 0) or black (k < 0). */
export function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  const to = k > 0 ? new THREE.Color('#ffffff') : new THREE.Color('#000000');
  return '#' + c.lerp(to, Math.abs(k)).getHexString();
}

// ------------------------------------------------------------------ the titles and the chevron, per style and colours

const TW = 640;
const TH = 160;
const colored = new Map<string, { text: THREE.Texture; arrow: THREE.Texture }>();

function paintTitle(style: LevelUpStyle, c1: string, c2: string): HTMLCanvasElement {
  const [t, tc] = canvas(TW, TH);
  const cx = TW / 2;
  const cy = TH / 2 + 4;
  const fonts: Record<LevelUpStyle, string> = {
    cyan: '900 76px "Arial Black", Impact, "Segoe UI", sans-serif',
    fire: 'italic 900 78px Impact, "Arial Black", sans-serif',
    thunder: 'italic 900 80px Impact, "Arial Black", sans-serif',
    leaf: '900 74px "Trebuchet MS", "Arial Rounded MT Bold", "Segoe UI", sans-serif',
    star: '900 76px Georgia, "Times New Roman", serif',
    shadow: '900 76px "Arial Black", Impact, sans-serif',
  };
  tc.font = fonts[style];
  tc.textAlign = 'center';
  tc.textBaseline = 'middle';
  tc.lineJoin = 'round';
  const text = 'LEVEL UP !';
  const half = tc.measureText(text).width / 2;

  // decorations behind the letters
  tc.save();
  if (style === 'fire') {
    // flame tongues licking up from the letters
    for (let i = 0; i < 11; i++) {
      const x = cx - half + (i + 0.5) * ((half * 2) / 11);
      const fg = tc.createLinearGradient(0, cy - 70, 0, cy);
      fg.addColorStop(0, shade(c1, 0.6));
      fg.addColorStop(1, c2);
      tc.fillStyle = fg;
      tc.shadowColor = c1;
      tc.shadowBlur = 14;
      flamePath(tc, x + rnd(-6, 6), cy - 8, 30, rnd(46, 66));
      tc.fill();
    }
  } else if (style === 'thunder') {
    // two bolts crossing behind the title
    tc.strokeStyle = shade(c1, 0.5);
    tc.shadowColor = c2;
    tc.shadowBlur = 16;
    tc.lineWidth = 5;
    for (const side of [-1, 1]) {
      tc.beginPath();
      let x = cx + side * (half + 22);
      tc.moveTo(x, 8);
      for (let y = 8; y < TH - 8; y += 24) {
        x += rnd(-12, 12);
        tc.lineTo(x, y + 24);
      }
      tc.stroke();
    }
  } else if (style === 'leaf') {
    // a leaf at each end
    for (const side of [-1, 1]) {
      tc.save();
      tc.translate(cx + side * (half + 30), cy);
      tc.rotate(side * 0.7);
      const lg = tc.createLinearGradient(0, -30, 0, 30);
      lg.addColorStop(0, shade(c1, 0.3));
      lg.addColorStop(1, c2);
      tc.fillStyle = lg;
      tc.shadowColor = c1;
      tc.shadowBlur = 10;
      leafPath(tc, 0, 0, 56, 22);
      tc.fill();
      tc.restore();
    }
  } else if (style === 'star') {
    // stars round the title
    tc.fillStyle = shade(c1, 0.5);
    tc.shadowColor = c1;
    tc.shadowBlur = 12;
    const spots: [number, number, number][] = [[-half - 26, -10, 18], [half + 26, -14, 16], [-half + 30, -48, 10], [half - 20, -50, 11], [0, -56, 9], [-half - 6, 40, 9], [half + 8, 42, 10]];
    for (const [dx, dy, r] of spots) {
      starPath(tc, cx + dx, cy + dy, 5, r, r * 0.42);
      tc.fill();
    }
  } else if (style === 'shadow') {
    // smoke under and behind the title
    for (let i = 0; i < 12; i++) {
      const x = cx + rnd(-half - 10, half + 10);
      const y = cy + rnd(-10, 34);
      const r = rnd(24, 40);
      const sg = tc.createRadialGradient(x, y, 0, x, y, r);
      sg.addColorStop(0, 'rgba(10,0,20,0.7)');
      sg.addColorStop(1, 'rgba(10,0,20,0)');
      tc.fillStyle = sg;
      tc.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  tc.restore();

  // the letters
  const fill = tc.createLinearGradient(0, cy - 40, 0, cy + 40);
  let stroke = shade(c2, -0.65);
  let glow = c1;
  if (style === 'fire') {
    fill.addColorStop(0, '#fff6c8');
    fill.addColorStop(0.45, c1);
    fill.addColorStop(1, c2);
    stroke = shade(c2, -0.7);
  } else if (style === 'thunder') {
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(0.6, shade(c1, 0.3));
    fill.addColorStop(1, c2);
    glow = c2;
    stroke = shade(c2, -0.75);
  } else if (style === 'star') {
    fill.addColorStop(0, '#fffbe6');
    fill.addColorStop(0.5, c1);
    fill.addColorStop(1, c2);
    stroke = shade(c2, -0.7);
  } else if (style === 'shadow') {
    fill.addColorStop(0, shade(c1, 0.35));
    fill.addColorStop(0.55, c1);
    fill.addColorStop(1, shade(c2, -0.4));
    stroke = '#07000d';
  } else {
    fill.addColorStop(0, shade(c1, 0.75));
    fill.addColorStop(0.5, c1);
    fill.addColorStop(1, c2);
  }
  tc.shadowColor = glow;
  tc.shadowBlur = style === 'thunder' ? 30 : 22;
  tc.lineWidth = 10;
  tc.strokeStyle = stroke;
  tc.strokeText(text, cx, cy);
  tc.shadowBlur = 8;
  tc.fillStyle = fill;
  tc.fillText(text, cx, cy);
  if (style === 'star' || style === 'thunder') {
    // a thin bright line along the top of the letters
    tc.shadowBlur = 0;
    tc.lineWidth = 1.5;
    tc.strokeStyle = 'rgba(255,255,255,0.7)';
    tc.strokeText(text, cx, cy - 1);
  }
  return t;
}

function colorTex(style: LevelUpStyle, c1: string, c2: string): { text: THREE.Texture; arrow: THREE.Texture } {
  const key = `${style}|${c1}|${c2}`;
  const had = colored.get(key);
  if (had) return had;
  if (colored.size > 16) colored.clear(); // /admin trying colours: keep only a few
  // chevron (the cyan style's centrepiece)
  const [a, ac] = canvas(128, 96);
  const ag = ac.createLinearGradient(0, 8, 0, 80);
  ag.addColorStop(0, shade(c1, 0.6));
  ag.addColorStop(1, c2);
  ac.shadowColor = c1;
  ac.shadowBlur = 14;
  ac.fillStyle = ag;
  ac.beginPath();
  ac.moveTo(64, 10);
  ac.lineTo(116, 62);
  ac.lineTo(94, 82);
  ac.lineTo(64, 52);
  ac.lineTo(34, 82);
  ac.lineTo(12, 62);
  ac.closePath();
  ac.fill();
  const out = { text: toTex(paintTitle(style, c1, c2)), arrow: toTex(a) };
  colored.set(key, out);
  return out;
}

// ------------------------------------------------------------------ building blocks

export const ease = (k: number) => 1 - (1 - k) * (1 - k);
/** 0 → 1 over the first `a` of the life, 1 → 0 over the last `b`. */
export const envelope = (k: number, a: number, b: number) => Math.max(0, Math.min(1, k / a, (1 - k) / b));

export function sprite(map: THREE.Texture, color: string, additive = true): THREE.Sprite {
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map, color, transparent: true, depthWrite: false, opacity: 0,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
}

export function groundMesh(map: THREE.Texture, color: string, additive = true): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const g = new THREE.PlaneGeometry(2, 2);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    map, color, transparent: true, opacity: 0, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  m.renderOrder = -1;
  return m;
}

/** What one style's parts are built into. */
interface Ctx {
  group: THREE.Group;
  ticks: ((k: number, dt: number) => void)[];
  /** Seconds and × size. */
  T: number;
  S: number;
  look: LevelUpLook;
  tex: Plain;
  /** × the particle counts. */
  n: number;
}

/** A part that comes and goes once over [start, start + dur] of the life (shares 0…1); `f` gets q = 0…1 inside. */
function once(c: Ctx, obj: THREE.Object3D & { material: THREE.Material }, start: number, dur: number, f: (q: number) => void): void {
  c.group.add(obj);
  obj.visible = false;
  c.ticks.push((k) => {
    const q = (k - start) / dur;
    obj.visible = q >= 0 && q <= 1;
    if (obj.visible) f(q);
  });
}

/** The quick flash ring spreading out at the start (every style's ground). */
function startWave(c: Ctx, color: string): void {
  const wave = groundMesh(c.tex.ringB, color);
  wave.position.y = 0.06;
  c.group.add(wave);
  c.ticks.push((k) => {
    const w = Math.min(1, (k * c.T) / 0.55);
    wave.scale.setScalar(c.S * (0.4 + 2 * ease(w)));
    wave.material.opacity = w < 1 ? 0.9 * (1 - w) : 0;
  });
}

/** A ground layer that grows in at the start, fades at the end, turns at `spin` per second and pulses. */
function groundLayer(c: Ctx, map: THREE.Texture, color: string, size: number, opacity: number, spin: number, y: number, additive = true, flicker = 0): void {
  const m = groundMesh(map, color, additive);
  m.position.y = y;
  c.group.add(m);
  c.ticks.push((k, dt) => {
    const e = envelope(k, 0.12, 0.35);
    const grow = 0.55 + 0.45 * ease(Math.min(1, k / 0.18));
    m.scale.setScalar(size * c.S * grow);
    m.rotation.y += spin * dt;
    m.material.opacity = opacity * e * (flicker ? 1 - flicker * Math.random() : 1);
  });
}

// ------------------------------------------------------------------ cyan (#485)

const cyan = {
  ground(c: Ctx): void {
    const { look } = c;
    groundLayer(c, c.tex.disc, look.color2, 1.55, 0.75, 0, 0.04);
    groundLayer(c, c.tex.ringA, look.color1, 1.75, 0.95, 0.9, 0.05);
    groundLayer(c, c.tex.ringB, look.color2, 1.35, 0.8, -1.6, 0.055);
    startWave(c, look.color1);
  },
  sparks(c: Ctx): void {
    const { look, S, T } = c;
    const nStreak = Math.round(8 * c.n);
    for (let i = 0; i < nStreak; i++) {
      const s = sprite(c.tex.streak, i % 2 ? look.color1 : look.color2);
      const a = Math.random() * TAU;
      const r = Math.random() * 0.9 * S;
      const h = (1.2 + Math.random() * 1.2) * S;
      s.scale.set(0.09 * S, h, 1);
      once(c, s, Math.random() * 0.55, (0.45 + Math.random() * 0.35) / T, (q) => {
        s.position.set(Math.cos(a) * r, h / 2 + ease(q) * 2.4 * S, Math.sin(a) * r);
        s.material.opacity = Math.sin(q * Math.PI) * 0.9;
      });
    }
    const nSpark = Math.round(24 * c.n);
    for (let i = 0; i < nSpark; i++) {
      const s = sprite(c.tex.spark, i % 3 ? look.color1 : '#ffffff');
      const a0 = Math.random() * TAU;
      const r = (0.15 + Math.random() * 1.1) * S;
      const up = (1.5 + Math.random() * 2.2) * S;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random());
      const tw = Math.random() * 20;
      s.scale.setScalar((0.07 + Math.random() * 0.1) * S);
      once(c, s, Math.random() * 0.6, (0.7 + Math.random() * 0.7) / T, (q) => {
        const a = a0 + spin * q;
        const rr = r * (1 - 0.45 * q);
        s.position.set(Math.cos(a) * rr, 0.1 + up * ease(q), Math.sin(a) * rr);
        s.material.opacity = (1 - q) * (0.65 + 0.35 * Math.sin(tw + q * 30));
      });
    }
  },
  main(c: Ctx, ct: { arrow: THREE.Texture }): void {
    // three chevrons flowing upward over the head, one after another
    const { S, T } = c;
    for (let i = 0; i < 3; i++) {
      const s = sprite(ct.arrow, '#ffffff', false);
      s.renderOrder = 60;
      s.material.depthTest = false;
      c.group.add(s);
      const w = 0.75 * S * (1 - i * 0.12);
      c.ticks.push((k) => {
        const e = envelope(k, 0.1, 0.25);
        const cycle = ((k * T) / 0.9 + i / 3) % 1;
        s.scale.set(w, w * 0.75, 1);
        s.position.y = TEXT_Y + 0.45 * S + cycle * 0.9 * S;
        s.material.opacity = e * Math.sin(cycle * Math.PI);
      });
    }
  },
};

// ------------------------------------------------------------------ fire

const fire = {
  ground(c: Ctx): void {
    const { look } = c;
    groundLayer(c, c.tex.disc, look.color2, 1.8, 0.7, 0, 0.04, true, 0.15);
    groundLayer(c, c.tex.fireRing, look.color1, 1.7, 0.95, 0.5, 0.05, true, 0.25);
    groundLayer(c, c.tex.fireRing, look.color2, 1.25, 0.8, -0.8, 0.055, true, 0.3);
    startWave(c, '#fff0b0');
  },
  sparks(c: Ctx): void {
    // embers rising, swaying and flickering
    const { look, S, T } = c;
    const n = Math.round(30 * c.n);
    const cols = [look.color1, '#ffe6a0', look.color2];
    for (let i = 0; i < n; i++) {
      const s = sprite(c.tex.spark, cols[i % 3]);
      const a = Math.random() * TAU;
      const r = (0.2 + Math.random() * 1.2) * S;
      const up = (2 + Math.random() * 2.5) * S;
      const sway = rnd(0.15, 0.4) * S;
      const ph = Math.random() * TAU;
      const size = rnd(0.05, 0.13) * S;
      s.scale.setScalar(size);
      once(c, s, Math.random() * 0.7, rnd(0.6, 1.2) / T, (q) => {
        const sw = Math.sin(ph + q * 9) * sway;
        s.position.set(Math.cos(a) * r + sw, 0.1 + up * q, Math.sin(a) * r - sw);
        s.material.opacity = (1 - q) * (0.6 + 0.4 * Math.random());
        s.scale.setScalar(size * (1 - 0.5 * q));
      });
    }
  },
  main(c: Ctx): void {
    // flames on three arms of a helix, winding up round the body and narrowing
    const { look, S, T } = c;
    const per = 7;
    for (let arm = 0; arm < 3; arm++) {
      for (let j = 0; j < per; j++) {
        const s = sprite(c.tex.flame, j % 2 ? look.color1 : look.color2);
        c.group.add(s);
        const off = j / per;
        const w = rnd(0.35, 0.5) * S;
        c.ticks.push((k) => {
          const e = envelope(k, 0.12, 0.3);
          const q = ((k * T) / 1.2 + off) % 1;
          const a = (arm / 3) * TAU + q * 3.4 + k * T * 2.2;
          const r = (1.05 - 0.6 * q) * S;
          s.position.set(Math.cos(a) * r, 0.2 + q * 3 * S, Math.sin(a) * r);
          const g = Math.sin(q * Math.PI);
          s.scale.set(w * (0.6 + 0.6 * g), w * 1.5 * (0.6 + 0.6 * g), 1);
          s.material.opacity = e * g * (0.75 + 0.25 * Math.random());
        });
      }
    }
    // a hot glow up the middle
    const core = sprite(c.tex.disc, look.color1);
    c.group.add(core);
    c.ticks.push((k) => {
      const e = envelope(k, 0.1, 0.35);
      core.position.y = 1.2 * S;
      core.scale.set(1.6 * S, 3 * S, 1);
      core.material.opacity = 0.45 * e * (0.85 + 0.15 * Math.random());
    });
  },
};

// ------------------------------------------------------------------ thunder

/** When the bolts strike (seconds) and where (× size from the middle; the first one on the player). */
function strikes(T: number): { t: number; x: number; z: number }[] {
  const out: { t: number; x: number; z: number }[] = [];
  const times = [0.05, 0.42, 0.7, 1.05, 1.35];
  times.forEach((t, i) => {
    if (t > T * 0.75 && i) return;
    const a = Math.random() * TAU;
    const r = i ? rnd(0.5, 1.3) : 0;
    out.push({ t, x: Math.cos(a) * r, z: Math.sin(a) * r });
  });
  return out;
}

const thunder = {
  ground(c: Ctx, hits: { t: number }[]): void {
    const { look, T } = c;
    groundLayer(c, c.tex.disc, look.color2, 1.7, 0.55, 0, 0.04);
    groundLayer(c, c.tex.ringB, look.color1, 1.5, 0.85, 2.6, 0.055, true, 0.6);
    // the cracks light up with every strike
    const crack = groundMesh(c.tex.crack, look.color1);
    crack.position.y = 0.05;
    crack.rotation.y = Math.random() * TAU;
    c.group.add(crack);
    c.ticks.push((k) => {
      const t = k * T;
      let flash = 0;
      for (const h of hits) if (t >= h.t) flash = Math.max(flash, Math.exp(-(t - h.t) * 5));
      crack.scale.setScalar(1.9 * c.S);
      crack.material.opacity = Math.min(1, 0.25 + flash) * envelope(k, 0.02, 0.3);
    });
    startWave(c, '#ffffff');
  },
  sparks(c: Ctx): void {
    // electric sparks jumping off the ground and falling back
    const { look, S, T } = c;
    const n = Math.round(26 * c.n);
    for (let i = 0; i < n; i++) {
      const s = sprite(i % 4 ? c.tex.spark : c.tex.star4, i % 2 ? look.color1 : '#ffffff');
      const a = Math.random() * TAU;
      const r0 = rnd(0, 0.8) * S;
      const v = rnd(1.2, 2.6) * S;
      const vy = rnd(2, 4.5) * S;
      const size = rnd(0.06, 0.14) * S;
      s.scale.setScalar(size);
      const dur = rnd(0.25, 0.5);
      once(c, s, Math.random() * 0.8, dur / T, (q) => {
        const t = q * dur;
        const r = r0 + v * t;
        s.position.set(Math.cos(a) * r, Math.max(0.05, vy * t - 9 * S * t * t), Math.sin(a) * r);
        s.material.opacity = (1 - q) * (Math.random() < 0.8 ? 1 : 0.2);
      });
    }
  },
  main(c: Ctx, hits: { t: number; x: number; z: number }[]): void {
    const { look, S, T } = c;
    for (const h of hits) {
      const bolt = sprite(c.tex.bolts[Math.floor(Math.random() * c.tex.bolts.length)], look.color1);
      const H = 9 * S;
      bolt.renderOrder = 55;
      const life = 0.2;
      once(c, bolt, h.t / T, life / T, (q) => {
        bolt.position.set(h.x * S, H * 0.45, h.z * S);
        bolt.scale.set(1.1 * S, H, 1);
        bolt.material.opacity = (1 - q) * (Math.random() < 0.75 ? 1 : 0.35);
      });
      // a second, thinner copy in the other colour, a hair later (a flickering double strike)
      const echo = sprite(c.tex.bolts[Math.floor(Math.random() * c.tex.bolts.length)], look.color2);
      once(c, echo, (h.t + 0.06) / T, 0.14 / T, (q) => {
        echo.position.set(h.x * S + 0.15 * S, H * 0.45, h.z * S);
        echo.scale.set(0.8 * S, H, 1);
        echo.material.opacity = (1 - q) * 0.8;
      });
      // the flash where it lands
      const flash = sprite(c.tex.disc, '#ffffff');
      once(c, flash, h.t / T, 0.35 / T, (q) => {
        flash.position.set(h.x * S, 0.4 * S, h.z * S);
        flash.scale.setScalar((1.2 + 2 * q) * S);
        flash.material.opacity = (1 - q) * 0.9;
      });
      const glow = sprite(c.tex.disc, look.color2);
      once(c, glow, h.t / T, 0.5 / T, (q) => {
        glow.position.set(h.x * S, 0.2, h.z * S);
        glow.scale.setScalar(2.6 * S * (0.6 + 0.4 * q));
        glow.material.opacity = (1 - q) * 0.6;
      });
    }
  },
};

// ------------------------------------------------------------------ leaf storm

const leaf = {
  ground(c: Ctx): void {
    const { look } = c;
    groundLayer(c, c.tex.disc, look.color2, 1.6, 0.45, 0, 0.04);
    groundLayer(c, c.tex.windRing, look.color1, 1.8, 0.9, 3.2, 0.05);
    groundLayer(c, c.tex.windRing, look.color2, 1.3, 0.75, -4, 0.055);
    startWave(c, look.color1);
  },
  sparks(c: Ctx): void {
    // loose leaves blown outward, tumbling
    const { look, S, T } = c;
    const n = Math.round(22 * c.n);
    const cols = [look.color1, look.color2, shade(look.color1, 0.45)];
    for (let i = 0; i < n; i++) {
      const s = sprite(c.tex.leaf, cols[i % 3], false);
      const a0 = Math.random() * TAU;
      const r0 = rnd(0.3, 0.9) * S;
      const out = rnd(1, 2.2) * S;
      const up = rnd(0.8, 2.6) * S;
      const spin = rnd(-8, 8);
      const size = rnd(0.16, 0.28) * S;
      s.scale.setScalar(size);
      once(c, s, Math.random() * 0.65, rnd(0.8, 1.4) / T, (q) => {
        const a = a0 + q * 2;
        const r = r0 + out * ease(q);
        s.position.set(Math.cos(a) * r, 0.2 + up * Math.sin(q * Math.PI * 0.8), Math.sin(a) * r);
        s.material.rotation = spin * q;
        s.material.opacity = Math.min(1, q * 6, (1 - q) * 3);
      });
    }
  },
  main(c: Ctx): void {
    // a funnel of wind rings rising and widening, with leaves riding a helix up through it
    const { look, S, T } = c;
    for (let i = 0; i < 4; i++) {
      const m = groundMesh(c.tex.windRing, i % 2 ? look.color2 : look.color1);
      m.renderOrder = 0;
      c.group.add(m);
      const spin = 5 + i;
      c.ticks.push((k, dt) => {
        const e = envelope(k, 0.12, 0.3);
        const q = ((k * T) / 1.3 + i / 4) % 1;
        m.position.y = 0.2 + q * 3 * S;
        m.scale.setScalar((0.8 + 0.55 * q) * S);
        m.rotation.y += spin * dt;
        m.material.opacity = e * Math.sin(q * Math.PI) * 0.75;
      });
    }
    const n = 16;
    for (let j = 0; j < n; j++) {
      const s = sprite(c.tex.leaf, j % 2 ? look.color1 : shade(look.color2, 0.2), false);
      c.group.add(s);
      const off = j / n;
      const size = rnd(0.22, 0.34) * S;
      const spin = rnd(4, 9);
      c.ticks.push((k) => {
        const e = envelope(k, 0.1, 0.25);
        const q = ((k * T) / 1.4 + off) % 1;
        const a = off * TAU + q * 5;
        const r = (0.75 + 0.6 * q) * S;
        s.position.set(Math.cos(a) * r, 0.2 + q * 3.2 * S, Math.sin(a) * r);
        s.scale.setScalar(size);
        s.material.rotation = spin * k * T;
        s.material.opacity = e * Math.min(1, Math.sin(q * Math.PI) * 2);
      });
    }
  },
};

// ------------------------------------------------------------------ shooting stars

/** Screen tilt of the falling stars: they come from up and to the right of the player. */
const STAR_DX = 2.6;
const STAR_DY = 7;

const star = {
  ground(c: Ctx): void {
    const { look } = c;
    groundLayer(c, c.tex.disc, look.color2, 1.6, 0.55, 0, 0.04);
    groundLayer(c, c.tex.stars, look.color1, 1.8, 1, 0.35, 0.05);
    groundLayer(c, c.tex.ringB, look.color2, 1.35, 0.6, -0.9, 0.055);
    startWave(c, '#fff6d0');
  },
  sparks(c: Ctx): void {
    // stars twinkling here and there round the body
    const { look, S, T } = c;
    const n = Math.round(22 * c.n);
    for (let i = 0; i < n; i++) {
      const s = sprite(i % 3 ? c.tex.star4 : c.tex.star5, i % 2 ? look.color1 : '#ffffff');
      const a = Math.random() * TAU;
      const r = rnd(0.3, 1.5) * S;
      const y = rnd(0.2, 3) * S;
      const size = rnd(0.14, 0.3) * S;
      const rot = Math.random() * TAU;
      once(c, s, Math.random() * 0.8, rnd(0.35, 0.7) / T, (q) => {
        s.position.set(Math.cos(a) * r, y + q * 0.3 * S, Math.sin(a) * r);
        s.scale.setScalar(size * Math.sin(q * Math.PI));
        s.material.rotation = rot + q * 1.5;
        s.material.opacity = 1;
      });
    }
  },
  main(c: Ctx): void {
    // stars falling from the sky onto the player, each with a tail and a little burst where it lands
    const { look, S, T } = c;
    // the screen direction of the fall: right +x −z, up +y (the trail sprite turned to it)
    const ux = Math.SQRT1_2;
    const uz = -Math.SQRT1_2;
    const rot = Math.atan2(-STAR_DX, STAR_DY * 0.8);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const r = i ? rnd(0.3, 1.3) : 0;
      const lx = Math.cos(a) * r * S;
      const lz = Math.sin(a) * r * S;
      const start = (i / n) * 0.55;
      const fall = 0.42;
      const head = sprite(c.tex.star5, '#ffffff');
      const tail = sprite(c.tex.streak, look.color1);
      const p = (q: number) => {
        const b = 1 - q;
        return { x: lx + ux * STAR_DX * S * b, y: 0.25 + STAR_DY * S * b, z: lz + uz * STAR_DX * S * b };
      };
      once(c, head, start, fall / T, (q) => {
        const at = p(ease(q));
        head.position.set(at.x, at.y, at.z);
        head.scale.setScalar(0.42 * S);
        head.material.rotation = q * 6;
        head.material.opacity = 1;
        head.material.color.set(q > 0.5 ? look.color1 : '#ffffff');
      });
      once(c, tail, start, fall / T, (q) => {
        const at = p(ease(q));
        const back = p(Math.max(0, ease(q) - 0.18));
        tail.position.set((at.x + back.x) / 2, (at.y + back.y) / 2, (at.z + back.z) / 2);
        tail.scale.set(0.16 * S, 2.4 * S, 1);
        tail.material.rotation = rot;
        tail.material.opacity = 0.85 * Math.min(1, q * 4);
      });
      const burst = sprite(c.tex.star4, look.color2);
      once(c, burst, start + fall / T, 0.4 / T, (q) => {
        burst.position.set(lx, 0.3, lz);
        burst.scale.setScalar((0.6 + 1.4 * q) * S);
        burst.material.rotation = q;
        burst.material.opacity = 1 - q;
      });
    }
  },
};

// ------------------------------------------------------------------ shadow

const shadow = {
  ground(c: Ctx): void {
    const { look } = c;
    // a dark pool first (drawn normally so it darkens the ground), then a glowing vortex on it
    groundLayer(c, c.tex.disc, '#05000a', 2, 0.8, 0, 0.035, false);
    groundLayer(c, c.tex.vortex, look.color1, 1.7, 0.85, -2.2, 0.05);
    groundLayer(c, c.tex.vortex, look.color2, 1.25, 0.9, -3.4, 0.055, false);
    startWave(c, look.color1);
  },
  sparks(c: Ctx): void {
    // dark smoke puffs rising and spreading, with a few faint glowing wisps
    const { look, S, T } = c;
    const n = Math.round(18 * c.n);
    for (let i = 0; i < n; i++) {
      const dark = i % 3 !== 0;
      const s = sprite(c.tex.smoke, dark ? shade(look.color2, -0.3) : look.color1, !dark);
      const a = Math.random() * TAU;
      const r = rnd(0.2, 1.2) * S;
      const up = rnd(1.2, 2.6) * S;
      const size = rnd(0.5, 0.9) * S;
      const rot = Math.random() * TAU;
      once(c, s, Math.random() * 0.65, rnd(0.9, 1.5) / T, (q) => {
        s.position.set(Math.cos(a) * r * (1 + q * 0.4), 0.2 + up * ease(q), Math.sin(a) * r * (1 + q * 0.4));
        s.scale.setScalar(size * (0.6 + 0.8 * q));
        s.material.rotation = rot + q;
        s.material.opacity = Math.sin(q * Math.PI) * (dark ? 0.7 : 0.5);
      });
    }
  },
  main(c: Ctx): void {
    // smoke drawn into a vortex: puffs wind inward and up round the body, glowing wisps among them
    const { look, S, T } = c;
    const n = 16;
    for (let j = 0; j < n; j++) {
      const dark = j % 2 === 0;
      const s = sprite(c.tex.smoke, dark ? '#140220' : look.color1, !dark);
      c.group.add(s);
      const off = j / n;
      const size = (dark ? rnd(0.8, 1.1) : rnd(0.5, 0.7)) * S;
      c.ticks.push((k) => {
        const e = envelope(k, 0.15, 0.3);
        const q = ((k * T) / 1.6 + off) % 1;
        const a = off * TAU - q * 6;
        const r = (1.5 - 1.1 * q) * S;
        s.position.set(Math.cos(a) * r, 0.2 + q * 2.8 * S, Math.sin(a) * r);
        s.scale.setScalar(size * (1 - 0.4 * q));
        s.material.rotation = -q * 3;
        s.material.opacity = e * Math.sin(q * Math.PI) * (dark ? 0.75 : 0.6);
      });
    }
    // thin dark streaks pulled up the middle
    for (let i = 0; i < 6; i++) {
      const s = sprite(c.tex.streak, look.color1);
      c.group.add(s);
      const a = (i / 6) * TAU;
      c.ticks.push((k) => {
        const e = envelope(k, 0.15, 0.3);
        const q = ((k * T) / 0.9 + i / 6) % 1;
        s.position.set(Math.cos(a) * 0.35 * S, 0.6 * S + q * 2.2 * S, Math.sin(a) * 0.35 * S);
        s.scale.set(0.08 * S, 1.4 * S, 1);
        s.material.opacity = e * Math.sin(q * Math.PI) * 0.7;
      });
    }
  },
};

// ------------------------------------------------------------------ the title's motion, per style

function titleTick(style: LevelUpStyle, s: THREE.Sprite, S: number, T: number): (k: number) => void {
  const W = 2.6 * S * (TW / 512);
  const aspect = TH / TW;
  return (k) => {
    const t = k * T;
    let pop = t < 0.18 ? 0.4 + (t / 0.18) * 0.8 : t < 0.32 ? 1.2 - ((t - 0.18) / 0.14) * 0.2 : 1;
    let op = Math.min(1, t / 0.12, (1 - k) / 0.25);
    let wide = 1;
    s.material.rotation = 0;
    if (style === 'thunder') {
      // slams in big and flickers for its first half second
      pop = t < 0.12 ? 1.7 - (t / 0.12) * 0.7 : 1;
      if (t < 0.5 && Math.random() < 0.3) op *= 0.25;
    } else if (style === 'leaf') {
      s.material.rotation = Math.sin(t * 3.2) * 0.06;
    } else if (style === 'star') {
      pop *= 1 + 0.04 * Math.sin(t * 9);
    } else if (style === 'shadow') {
      // rises out of the smoke: wide and faint first, then settles
      pop = 1;
      wide = 1 + 0.35 * (1 - ease(Math.min(1, t / 0.5)));
      op = Math.min(1, t / 0.45, (1 - k) / 0.25);
    } else if (style === 'fire') {
      pop *= 1 + 0.025 * Math.sin(t * 23);
    }
    s.scale.set(W * pop * wide, W * aspect * pop, 1);
    s.position.y = TEXT_Y + 0.25 * S * ease(k);
    s.material.opacity = Math.max(0, op);
  };
}

// ------------------------------------------------------------------ the effect

/** Plays one style of the level-up effect at (x, z). */
export function playLevelUp(add: LevelUpHost, x: number, z: number, style: LevelUpStyle, look: LevelUpLook, opts: LevelUpOpts): void {
  const T = Math.max(0.3, look.sec);
  const S = Math.max(0.1, look.size);
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const c: Ctx = { group, ticks: [], T, S, look, tex: plainTex(), n: opts.particles };
  const ct = look.main || look.text ? colorTex(style, look.color1, look.color2) : null;
  const hits = style === 'thunder' ? strikes(T) : [];
  const ground = look.ground && opts.extras;
  const sparks = look.sparks && opts.particles > 0;
  const main = look.main && opts.extras;

  switch (style) {
    case 'cyan':
      if (ground) cyan.ground(c);
      if (sparks) cyan.sparks(c);
      if (main && ct) cyan.main(c, ct);
      break;
    case 'fire':
      if (ground) fire.ground(c);
      if (sparks) fire.sparks(c);
      if (main) fire.main(c);
      break;
    case 'thunder':
      if (ground) thunder.ground(c, hits);
      if (sparks) thunder.sparks(c);
      if (main) thunder.main(c, hits);
      break;
    case 'leaf':
      if (ground) leaf.ground(c);
      if (sparks) leaf.sparks(c);
      if (main) leaf.main(c);
      break;
    case 'star':
      if (ground) star.ground(c);
      if (sparks) star.sparks(c);
      if (main) star.main(c);
      break;
    case 'shadow':
      if (ground) shadow.ground(c);
      if (sparks) shadow.sparks(c);
      if (main) shadow.main(c);
      break;
  }

  if (look.text && ct) {
    const s = sprite(ct.text, '#ffffff', false);
    s.renderOrder = 61;
    s.material.depthTest = false;
    group.add(s);
    c.ticks.push(titleTick(style, s, S, T));
  }

  if (!c.ticks.length) return;
  add(group, T, (k, dt) => {
    const p = opts.follow?.();
    if (p) group.position.set(p.x, 0, p.z);
    for (const f of c.ticks) f(k, dt);
  });
}

// ------------------------------------------------------------------ card pictures (shop, fashion bag)

const cards = new Map<string, string>();

/**
 * A still of one style for its card (made once per piece and colours): the ground circle seen at a slant,
 * the style's centrepiece in miniature and the title. Drawn on a 2D canvas, no WebGL.
 */
export function levelUpCard(id: string, look: LevelUpLook): string {
  const style = LEVELUP_STYLE[id] ?? 'cyan';
  const key = `${id}|${look.color1}|${look.color2}`;
  const had = cards.get(key);
  if (had) return had;
  const [cv, x] = canvas(128, 128);
  const { color1: c1, color2: c2 } = look;
  x.fillStyle = style === 'shadow' ? '#120a1c' : '#0d1016';
  x.fillRect(0, 0, 128, 128);
  // the ground circle (an ellipse, like the game's slanted view)
  const cx = 64;
  const gy = 96;
  x.save();
  x.translate(cx, gy);
  x.scale(1, 0.42);
  const disc = x.createRadialGradient(0, 0, 0, 0, 0, 56);
  disc.addColorStop(0, shade(c2, 0.2) + 'cc');
  disc.addColorStop(1, c2 + '00');
  x.fillStyle = style === 'shadow' ? 'rgba(0,0,0,0.85)' : disc;
  x.beginPath();
  x.arc(0, 0, 56, 0, TAU);
  x.fill();
  x.strokeStyle = c1;
  x.shadowColor = c1;
  x.shadowBlur = 8;
  x.lineWidth = 4;
  x.beginPath();
  x.arc(0, 0, 48, 0, TAU);
  x.stroke();
  x.restore();
  x.save();
  x.shadowColor = c1;
  x.shadowBlur = 10;
  // the centrepiece in miniature
  if (style === 'cyan') {
    x.fillStyle = c1;
    for (let i = 0; i < 3; i++) {
      const y = 30 + i * 16;
      x.beginPath();
      x.moveTo(cx, y - 8);
      x.lineTo(cx + 14, y + 6);
      x.lineTo(cx + 8, y + 11);
      x.lineTo(cx, y + 3);
      x.lineTo(cx - 8, y + 11);
      x.lineTo(cx - 14, y + 6);
      x.closePath();
      x.fill();
    }
  } else if (style === 'fire') {
    for (let i = 0; i < 5; i++) {
      const fx = cx + (i - 2) * 13;
      const g = x.createLinearGradient(0, 30, 0, gy);
      g.addColorStop(0, '#fff2b0');
      g.addColorStop(0.5, c1);
      g.addColorStop(1, c2);
      x.fillStyle = g;
      flamePath(x, fx, gy, 22, 40 + (i % 2 ? 0 : 22) + (i === 2 ? 14 : 0));
      x.fill();
    }
  } else if (style === 'thunder') {
    x.strokeStyle = '#fff';
    x.shadowColor = c2;
    x.shadowBlur = 14;
    x.lineWidth = 5;
    x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(cx + 10, 4);
    x.lineTo(cx - 6, 40);
    x.lineTo(cx + 8, 44);
    x.lineTo(cx - 8, 78);
    x.lineTo(cx + 6, 82);
    x.lineTo(cx, gy);
    x.stroke();
    x.strokeStyle = c1;
    x.lineWidth = 2;
    x.stroke();
  } else if (style === 'leaf') {
    for (let i = 0; i < 9; i++) {
      const q = i / 8;
      const a = q * 9;
      x.save();
      x.translate(cx + Math.cos(a) * (14 + q * 26), gy - 8 - q * 64);
      x.rotate(a);
      x.fillStyle = i % 2 ? c1 : shade(c2, 0.2);
      leafPath(x, 0, 0, 16, 7);
      x.fill();
      x.restore();
    }
  } else if (style === 'star') {
    x.strokeStyle = c1;
    x.lineWidth = 3;
    for (const [sx, sy, ex, ey] of [[110, 6, 74, 60], [88, 2, 46, 52]] as const) {
      const g = x.createLinearGradient(sx, sy, ex, ey);
      g.addColorStop(0, c1 + '00');
      g.addColorStop(1, c1);
      x.strokeStyle = g;
      x.beginPath();
      x.moveTo(sx, sy);
      x.lineTo(ex, ey);
      x.stroke();
      x.fillStyle = '#fff';
      starPath(x, ex, ey, 5, 8, 3.4);
      x.fill();
    }
    x.fillStyle = c1;
    starPath(x, cx - 22, 30, 4, 6, 1.5);
    x.fill();
  } else if (style === 'shadow') {
    for (let i = 0; i < 8; i++) {
      const q = i / 7;
      const px = cx + Math.cos(q * 7) * (30 - q * 18);
      const py = gy - 4 - q * 66;
      const r = 16 - q * 6;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, i % 2 ? c1 + 'aa' : 'rgba(30,5,45,0.9)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
  }
  x.restore();
  // the title across the top
  const title = paintTitle(style, c1, c2);
  x.drawImage(title, 0, 0, TW, TH, 4, 2, 120, 30);
  const url = cv.toDataURL();
  cards.set(key, url);
  return url;
}
