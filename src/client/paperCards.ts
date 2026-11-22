// Card pictures of auras and title sets from their paper art (owner 2026-11-22: the soft glows and the small text
// labels didn't tell the pieces apart). Used by cosPicture (cosmetics window, cash shop, fashion bag).
// - aura: its paper ring (sprites/paper/fx/<id>_ring.png) with two of its footprints inside.
// - title set: its real name frame around "ชื่อตัวละคร" over its chat bubble saying "สวัสดี!", drawn 9-slice like
//   floating.ts paintPaperFrame (corners and middle pieces whole, the plain edges repeated).
import { t } from './i18n';
import type { CosmeticDef } from '../shared/data/cosmetics';
import { imgUrl, paperUiOn } from './img';
import { PAPER_TITLES, type PaperFrame } from './paperTitles';

function load(path: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = fail;
    im.src = imgUrl(path);
  });
}

/** Whether this piece gets a paper card picture. */
export function hasPaperCard(c: CosmeticDef): boolean {
  if (!paperUiOn()) return false;
  return c.slot === 'aura' || (c.slot === 'title' && !!PAPER_TITLES[c.id]);
}

/** The card picture as a data URL, or null when its art couldn't be loaded. */
export async function paperCardImage(c: CosmeticDef): Promise<string | null> {
  try {
    return c.slot === 'aura' ? await auraCard(c.id) : await titleCard(c.id);
  } catch {
    return null;
  }
}

async function auraCard(id: string): Promise<string> {
  const [ring, foot] = await Promise.all([load(`assets/sprites/paper/fx/${id}_ring.png`), load(`assets/sprites/paper/fx/${id}_foot.png`)]);
  const cv = document.createElement('canvas');
  cv.width = ring.width;
  cv.height = ring.height;
  const g = cv.getContext('2d')!;
  g.drawImage(ring, 0, 0);
  // Two steps walking up the middle of the ring, left then right foot (mirrored).
  const fh = ring.height * 0.36;
  const fw = (foot.width / foot.height) * fh;
  for (const [dx, dy, flip] of [[-0.09, 0.08, 1], [0.09, -0.08, -1]] as const) {
    g.save();
    g.translate(cv.width * (0.5 + dx), cv.height * (0.5 + dy));
    g.scale(flip, 1);
    g.drawImage(foot, -fw / 2, -fh / 2, fw, fh);
    g.restore();
  }
  return cv.toDataURL();
}

/**
 * Draws a 9-slice frame `f` (file pixels) `w` wide at (x, y), at its file height: corners whole, the top and bottom
 * edges repeated a whole number of times (like border-image-repeat: round), the sides and the middle stretched,
 * then its top and bottom middle pieces over it.
 */
function drawFrame(g: CanvasRenderingContext2D, im: HTMLImageElement, t: HTMLImageElement, b: HTMLImageElement, f: PaperFrame, x: number, y: number, w: number): void {
  const [st, sr, sb, sl] = f.slice;
  const [iw, ih] = [f.w, f.h];
  const srcMidW = iw - sl - sr;
  const dstMidW = w - sl - sr;
  const n = Math.max(1, Math.round(dstMidW / srcMidW));
  const tile = dstMidW / n;
  // corners
  g.drawImage(im, 0, 0, sl, st, x, y, sl, st);
  g.drawImage(im, iw - sr, 0, sr, st, x + w - sr, y, sr, st);
  g.drawImage(im, 0, ih - sb, sl, sb, x, y + ih - sb, sl, sb);
  g.drawImage(im, iw - sr, ih - sb, sr, sb, x + w - sr, y + ih - sb, sr, sb);
  // sides (their own height: the card draws the frame at its file height)
  g.drawImage(im, 0, st, sl, ih - st - sb, x, y + st, sl, ih - st - sb);
  g.drawImage(im, iw - sr, st, sr, ih - st - sb, x + w - sr, y + st, sr, ih - st - sb);
  // top and bottom edges, then the middle, a whole number of tiles each
  for (let i = 0; i < n; i++) {
    const dx = x + sl + i * tile;
    g.drawImage(im, sl, 0, srcMidW, st, dx, y, tile + 0.5, st);
    g.drawImage(im, sl, ih - sb, srcMidW, sb, dx, y + ih - sb, tile + 0.5, sb);
    g.drawImage(im, sl, st, srcMidW, ih - st - sb, dx, y + st, tile + 0.5, ih - st - sb);
  }
  // middle pieces (crown, bubble tail) at the frame's top and bottom, centred
  const [mw, mth, mbh] = f.mid;
  g.drawImage(t, x + (w - mw) / 2, y, mw, mth);
  g.drawImage(b, x + (w - mw) / 2, y + ih - mbh, mw, mbh);
}

async function titleCard(id: string): Promise<string> {
  const set = PAPER_TITLES[id]!;
  const path = (kind: string, s: string) => `assets/sprites/paper/ui/${id}_${kind}${s}.png`;
  const [pl, plT, plB, bu, buT, buB] = await Promise.all([
    load(path('plate', '')), load(path('plate', '_t')), load(path('plate', '_b')),
    load(path('bubble', '')), load(path('bubble', '_t')), load(path('bubble', '_b')),
  ]);
  await document.fonts?.ready;
  const font = getComputedStyle(document.body).fontFamily;
  const g0 = document.createElement('canvas').getContext('2d')!;
  // Text in file pixels: the game shows the frame at 1/3 (11 px name) and the bubble at 0.3 (14 px chat).
  const plateFont = `600 ${11 * 3}px ${font}`;
  const bubbleFont = `${14 / 0.3}px ${font}`;
  const [pf, bf] = [set.plate, set.bubble];
  const widthFor = (f: PaperFrame, text: string, fnt: string): number => {
    g0.font = fnt;
    const min = f.slice[1] + f.slice[3] + f.mid[0];
    return Math.ceil(Math.max(f.w, min, g0.measureText(text).width + (f.slice[1] + f.slice[3]) * 0.8));
  };
  const pw = widthFor(pf, 'ชื่อตัวละคร', plateFont);
  const bw = widthFor(bf, 'สวัสดี!', bubbleFont);
  const gap = 14;
  const cv = document.createElement('canvas');
  cv.width = Math.max(pw, bw);
  cv.height = pf.h + gap + bf.h;
  const g = cv.getContext('2d')!;
  const px = (cv.width - pw) / 2;
  const bx = (cv.width - bw) / 2;
  const by = pf.h + gap;
  drawFrame(g, pl, plT, plB, pf, px, 0, pw);
  drawFrame(g, bu, buT, buB, bf, bx, by, bw);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // Text in the middle of each frame's body (between its plain edges).
  const midY = (f: PaperFrame, top: number) => top + f.outset[0] + (f.h - f.outset[0] - f.outset[2]) / 2;
  g.font = plateFont;
  g.shadowColor = '#000';
  g.shadowBlur = 6;
  g.shadowOffsetY = 3;
  g.fillStyle = '#fff';
  g.fillText(t('ชื่อตัวละคร'), cv.width / 2, midY(pf, 0));
  g.shadowColor = 'transparent';
  g.font = bubbleFont;
  g.fillStyle = '#2a1c10';
  g.fillText(t('สวัสดี!'), cv.width / 2, midY(bf, by));
  return cv.toDataURL();
}
