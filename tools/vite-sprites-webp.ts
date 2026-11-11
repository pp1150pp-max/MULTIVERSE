// Build-only Vite plugin: ships the sprite PNGs from public/assets/sprites/ as WebP.
// The PNGs stay in the repo (new art is still added as PNG); dev serves them as they are.
// - index.html and CSS: `assets/sprites/….png` is rewritten to `.webp` in the build output.
// - TS code: paths go through imgUrl() (src/client/img.ts), which does the same outside dev.
// - After the build, every PNG under <outDir>/assets/sprites/ is converted and the PNG copy removed,
//   so a path that missed the rewrite fails loudly instead of quietly loading the big file.
// Converted files are cached in node_modules/.cache/sprites-webp/ by content hash, so rebuilds are quick.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
// sharp is loaded only when a build converts files, so dev and checkouts without it still start.
type Sharp = typeof import('sharp');

/** Picked with the owner from side-by-side tests: q90 with smart chroma subsampling, alpha kept exact. */
const WEBP = { quality: 90, smartSubsample: true, alphaQuality: 100, effort: 4 } as const;
const SETTINGS_KEY = JSON.stringify(WEBP);
const SPRITE_PNG = /(assets\/sprites\/[^"'()\s]+)\.png/g;

async function listPngs(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listPngs(p)));
    else if (e.name.toLowerCase().endsWith('.png')) out.push(p);
  }
  return out;
}

async function convert(sharp: Sharp, png: string, cacheDir: string): Promise<{ before: number; after: number }> {
  const data = await readFile(png);
  const key = createHash('sha1').update(SETTINGS_KEY).update(data).digest('hex');
  const cached = join(cacheDir, key + '.webp');
  let webp: Buffer;
  try {
    webp = await readFile(cached);
  } catch {
    webp = await sharp(data).webp(WEBP).toBuffer();
    await writeFile(cached, webp);
  }
  const target = png.slice(0, -4) + '.webp';
  if (await stat(target).then(() => true, () => false)) throw new Error(`[sprites-webp] ${target} already exists next to its PNG`);
  await writeFile(target, webp);
  await rm(png);
  return { before: data.length, after: webp.length };
}

export function spritesWebp() {
  let outDir = '';
  let root = '';
  return {
    name: 'sprites-webp',
    apply: 'build' as const,
    configResolved(config: { root: string; build: { outDir: string } }) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    transformIndexHtml: {
      order: 'post' as const,
      handler: (html: string) => html.replace(SPRITE_PNG, '$1.webp'),
    },
    generateBundle(_opts: unknown, bundle: Record<string, { type: string; fileName: string; source?: string | Uint8Array }>) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || typeof file.source !== 'string') continue;
        if (file.fileName.endsWith('.css')) file.source = file.source.replace(SPRITE_PNG, '$1.webp');
      }
    },
    async closeBundle() {
      const sprites = join(outDir, 'assets', 'sprites');
      if (!(await stat(sprites).then((s) => s.isDirectory(), () => false))) return;
      const cacheDir = join(root, 'node_modules', '.cache', 'sprites-webp');
      await mkdir(cacheDir, { recursive: true });
      const pngs = await listPngs(sprites);
      const { default: sharp } = await import('sharp');
      let before = 0, after = 0, next = 0;
      const worker = async () => {
        while (next < pngs.length) {
          const r = await convert(sharp, pngs[next++], cacheDir);
          before += r.before;
          after += r.after;
        }
      };
      await Promise.all(Array.from({ length: 8 }, worker));
      const mb = (n: number) => (n / 1e6).toFixed(1) + ' MB';
      console.log(`[sprites-webp] ${pngs.length} PNG → WebP: ${mb(before)} → ${mb(after)}`);
    },
  };
}
