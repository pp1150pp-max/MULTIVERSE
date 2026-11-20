// The paper pictures the editor draws (sprites/paper/props/<key>.png), loaded when first needed, with a small alpha mask
// so a click picks the piece under the cursor's visible pixels, not its whole rectangle.
import { imgUrl } from '../../client/img';
import propCatalog from '../../shared/data/propCatalog.json';

export interface PropEntry { key: string; category: string; paper: boolean; size: [number, number] | null; h: number; solid: { r: number } | null }
export const CATALOG = propCatalog as unknown as { faceSets: { base: string; front: string | null; back: string | null }[]; props: PropEntry[] };
const BY_KEY = new Map(CATALOG.props.map((p) => [p.key, p]));
export const catalogEntry = (key: string): PropEntry | undefined => BY_KEY.get(key);

/** The picture's file name (the game stores the town statue's picture under another name). */
const fileOf = (key: string): string => (key === 'town_statue' ? 'ruin_statue' : key);
export const propUrl = (key: string): string => imgUrl(`assets/sprites/paper/props/${fileOf(key)}.png`);

export interface Sprite { img: HTMLImageElement; w: number; h: number; mask: Uint8Array; mw: number; mh: number }
const loaded = new Map<string, Sprite | null>();
const loading = new Map<string, Promise<void>>();

/** The sprite if it has loaded; otherwise starts loading it (`onLoad` runs once it has) and returns undefined. */
export function spriteOf(key: string, onLoad: () => void): Sprite | undefined {
  const got = loaded.get(key);
  if (got) return got;
  if (got === null || loading.has(key)) return undefined;
  const img = new Image();
  loading.set(key, new Promise<void>((resolve) => {
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      const mw = Math.min(64, w), mh = Math.max(1, Math.round((mw * h) / w));
      const cv = document.createElement('canvas');
      cv.width = mw; cv.height = mh;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      let mask = new Uint8Array(mw * mh).fill(1);
      if (cx) {
        cx.drawImage(img, 0, 0, mw, mh);
        const d = cx.getImageData(0, 0, mw, mh).data;
        mask = new Uint8Array(mw * mh);
        for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] > 40 ? 1 : 0;
      }
      loaded.set(key, { img, w, h, mask, mw, mh });
      loading.delete(key);
      resolve();
      onLoad();
    };
    img.onerror = () => { loaded.set(key, null); loading.delete(key); resolve(); };
    img.src = propUrl(key);
  }));
  return undefined;
}

/** Is the picture visible at (u, v) in 0..1 across and 0..1 down? */
export function opaqueAt(s: Sprite, u: number, v: number): boolean {
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
  return s.mask[Math.floor(v * s.mh) * s.mw + Math.floor(u * s.mw)] === 1;
}
