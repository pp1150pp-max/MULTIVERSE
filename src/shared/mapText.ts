// The exact text of a map file in src/shared/data/maps/: one line per list item (git diffs stay readable), everything else compact.
// tools/bake_maps.ts writes the baked files with it and the admin "ส่งออกเข้า repo" gives a published layout in the same shape.
import type { MapData } from './mapSchema';

export function bakedText(map: MapData): string {
  const rows = Object.entries(map).map(([k, v]) => {
    const body = Array.isArray(v) && v.length ? `[\n${v.map((x) => '  ' + JSON.stringify(x)).join(',\n')}\n ]` : JSON.stringify(v);
    return ` ${JSON.stringify(k)}: ${body}`;
  });
  return `{\n${rows.join(',\n')}\n}\n`;
}
