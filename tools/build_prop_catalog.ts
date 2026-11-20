// Builds src/shared/data/propCatalog.json: the picture library the map editor (/admin, docs/plans/map-editor.md 1.4) picks
// props from. Run it again whenever a paper picture is added to public/assets/sprites/paper/props/ or SHEET_SPECS changes:
//
//   node --import tsx tools/build_prop_catalog.ts
//
// Where each field comes from (nothing is guessed; what cannot be found is null):
//   key / inSheetSpecs  SHEET_SPECS in src/client/assets.ts (the props: pictures under sprites/props/ or sprites/paper/props/),
//                       plus any other .png the owner dropped into sprites/paper/props/ (inSheetSpecs false: the editor can
//                       show it, but validateMap() will not take it until it gets a SHEET_SPECS entry).
//   category            the key's prefix, by CATEGORY_RULES below.
//   paper / size        the paper file sprites/paper/props/<key>.png: whether it exists and its width x height in pixels.
//   h / hRange          what Terrain (src/shared/sim/terrain.ts) really draws it at: every zone and boss room is built and each
//                       addProp call recorded. h is the median height, hRange the [min, max] (they differ where terrain.ts
//                       randomises). null when no zone places the key.
//   solid               { r } the most common collide radius terrain.ts gave it (0 = walk-through); null when never placed.
//                       The few pieces whose collider terrain.ts pushes by hand (fountain, hub buildings, wall kit) use
//                       SOLID_OVERRIDES instead.
//   faceSets            the *_front / *_back pairs: one row per base name.
// Same input, same file: keys are sorted, nothing else varies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOSS_ROOMS, ZONES } from '../src/shared/data/zones';
import { HUB_BUILDING_SIZE, HUB_FOUNTAIN_RADIUS, Terrain } from '../src/shared/sim/terrain';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAPER_PROPS_DIR = path.join(ROOT, 'public/assets/sprites/paper/props');
export const CATALOG_PATH = path.join(ROOT, 'src/shared/data/propCatalog.json');

export const CATEGORIES = ['อาคาร', 'ตลาด', 'ป้ายและโคมไฟ', 'หิน', 'ต้นไม้', 'อื่นๆ'] as const;
export type Category = (typeof CATEGORIES)[number];

/** First match wins, so the order matters (e.g. crystal_stall is a stall before it is a crystal). */
const CATEGORY_RULES: [Category, RegExp][] = [
  ['อาคาร', /^(bld_|b3_|house_back_|row_|ruin_house|ruin_tower|town_forge|town_vault|town_market|watchtower|tent)/],
  ['ตลาด', /^(mk_|ml_|mr_|low_stall_|town_stall|crystal_stall|crates|barrels)/],
  ['ป้ายและโคมไฟ', /^(sign|lamp_post|banner_|flag|quest_board|room_\w+_brazier|brazier)/],
  ['หิน', /(^|_)(rock|rocks|pebble|mossrock|basalt|boulder|rubble|runestone|rune_stone)(_|$)|^(ice|magma)_crystal/],
  ['ต้นไม้', /(^|_)(tree|pine|willow|bush|shrub|reeds|fern|stump|hedge|mushrooms|garden_bed|flower_box|planter)(_|$)|^(tree_|snow_pine|burnt_pillar|potted_tree)/],
];
export const categoryOf = (key: string): Category => CATEGORY_RULES.find(([, re]) => re.test(key))?.[0] ?? 'อื่นๆ';

/** Solid pieces whose collider terrain.ts pushes by hand (its addProp radius is 0 for them). Read from terrain.ts placeTown. */
const SOLID_OVERRIDES: Record<string, number> = {
  town_fountain: HUB_FOUNTAIN_RADIUS,
  b3_vault: HUB_BUILDING_SIZE / 2 - 0.5,
  b3_crystal: HUB_BUILDING_SIZE / 2 - 0.5,
  b3_guild: HUB_BUILDING_SIZE / 2 - 0.5,
  b3_forge: HUB_BUILDING_SIZE / 2 - 0.5,
  // The wall's own line of r 0.6 colliders, one every 0.9.
  town_wall_a: 0.6, town_wall_a_broken: 0.6, town_wall_b: 0.6, town_wall_b_broken: 0.6,
};

export interface PropEntry {
  key: string;
  category: Category;
  inSheetSpecs: boolean;
  paper: boolean;
  /** [width, height] px of the paper picture. */
  size: [number, number] | null;
  h: number | null;
  hRange: [number, number] | null;
  solid: { r: number } | null;
}
export interface FaceSet { base: string; front: string | null; back: string | null }
export interface PropCatalog { schema: 1; faceSets: FaceSet[]; props: PropEntry[] }

/** A SHEET_SPECS entry that is a prop (map object), as opposed to a character, icon, effect or ground. */
export const isPropPath = (p: string): boolean => /(^|\/)sprites\/(paper\/)?props\/[^/]+\.png$/.test(p);

/** Every prop key in the client's SHEET_SPECS. assets.ts needs a browser-less import, which works: its drawing code only runs lazily. */
export async function sheetSpecProps(): Promise<Map<string, string>> {
  const file = '../src/client/assets.ts'; // a variable, so the type checkers do not pull the client into the shared projects
  const mod = (await import(file)) as { SHEET_SPECS: Record<string, { path: string }> };
  // key -> the picture's file name (town_statue draws ruin_statue.png)
  const rows = Object.entries(mod.SHEET_SPECS).filter(([, s]) => isPropPath(s.path)).map(([k, s]): [string, string] => [k, path.basename(s.path, '.png')]);
  return new Map(rows.sort((a, b) => cmp(a[0], b[0])));
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const round2 = (n: number): number => Math.round(n * 100) / 100;

function pngSize(file: string): [number, number] | null {
  if (!fs.existsSync(file)) return null;
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.toString('latin1', 1, 4) !== 'PNG') return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

interface Seen { heights: number[]; radii: number[] }

/** Builds every zone and boss room once and records each addProp call (height and collide radius). */
function observeTerrain(): Map<string, Seen> {
  const seen = new Map<string, Seen>();
  const proto = Terrain.prototype as unknown as { addProp: (key: string, x: number, z: number, height: number, collideR: number, fade?: boolean) => void };
  const orig = proto.addProp;
  proto.addProp = function (this: Terrain, key, x, z, height, collideR, fade) {
    const s = seen.get(key) ?? { heights: [], radii: [] };
    s.heights.push(height);
    s.radii.push(collideR);
    seen.set(key, s);
    orig.call(this, key, x, z, height, collideR, fade);
  };
  try {
    for (const z of [...Object.values(ZONES), ...Object.values(BOSS_ROOMS)]) new Terrain(z);
  } finally {
    proto.addProp = orig;
  }
  return seen;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
function mode(xs: number[]): number {
  const n = new Map<number, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  // Most common radius; a tie goes to the larger (so the order never matters).
  return [...n.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

export async function buildCatalog(): Promise<PropCatalog> {
  const specFiles = await sheetSpecProps();
  const specKeys = new Set(specFiles.keys());
  const files = fs.existsSync(PAPER_PROPS_DIR) ? fs.readdirSync(PAPER_PROPS_DIR).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)) : [];
  const keys = [...new Set([...specKeys, ...files])].sort(cmp);
  const seen = observeTerrain();

  const props: PropEntry[] = keys.map((key) => {
    const size = pngSize(path.join(PAPER_PROPS_DIR, `${specFiles.get(key) ?? key}.png`));
    const s = seen.get(key);
    const solidR = key in SOLID_OVERRIDES ? SOLID_OVERRIDES[key] : s ? mode(s.radii) : null;
    return {
      key,
      category: categoryOf(key),
      inSheetSpecs: specKeys.has(key),
      paper: size !== null,
      size,
      h: s ? round2(median(s.heights)) : null,
      hRange: s ? [round2(Math.min(...s.heights)), round2(Math.max(...s.heights))] : null,
      solid: solidR === null ? null : { r: round2(solidR) },
    };
  });

  const bases = new Set<string>();
  for (const k of keys) if (/_(front|back)$/.test(k)) bases.add(k.replace(/_(front|back)$/, ''));
  const faceSets: FaceSet[] = [...bases].sort(cmp).map((base) => ({
    base,
    front: keys.includes(`${base}_front`) ? `${base}_front` : null,
    back: keys.includes(`${base}_back`) ? `${base}_back` : null,
  }));
  return { schema: 1, faceSets, props };
}

/** One line per prop so a diff shows exactly which pieces changed. */
export function formatCatalog(c: PropCatalog): string {
  const lines = (xs: unknown[]) => xs.map((x) => '    ' + JSON.stringify(x)).join(',\n');
  return `{\n  "schema": 1,\n  "faceSets": [\n${lines(c.faceSets)}\n  ],\n  "props": [\n${lines(c.props)}\n  ]\n}\n`;
}

async function main(): Promise<void> {
  const cat = await buildCatalog();
  fs.writeFileSync(CATALOG_PATH, formatCatalog(cat));
  const counts = new Map<string, number>();
  for (const p of cat.props) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  console.log(`propCatalog.json: ${cat.props.length} keys, ${cat.faceSets.length} front/back sets`);
  for (const c of CATEGORIES) console.log(`  ${c}: ${counts.get(c) ?? 0}`);
  const noPaper = cat.props.filter((p) => !p.paper).map((p) => p.key);
  console.log(`no paper picture (${noPaper.length}): ${noPaper.join(', ')}`);
  const noPlace = cat.props.filter((p) => p.h === null).length;
  console.log(`not placed by terrain.ts (h and solid null): ${noPlace}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
