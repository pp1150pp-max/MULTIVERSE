// How many pieces a map edit changed (shown before publishing, and in the audit log). Shared by the server and /admin.
import type { MapData } from './mapSchema';

const jsonOf = (v: unknown): string => JSON.stringify(v);

export interface MapDiff { added: number; removed: number; changed: number }


/** What changed between two layouts, counting pieces: things with an id by id, the rest by what they hold (see below). */
export function diffMaps(a: MapData | undefined, b: MapData): MapDiff {
  const out: MapDiff = { added: 0, removed: 0, changed: 0 };
  const lists = ['props', 'blockers', 'npcs', 'paths', 'water', 'rest', 'portals', 'spawns', 'colliders'] as const;
  for (const k of lists) {
    const x = (a?.[k] ?? []) as { id?: string }[];
    const y = (Array.isArray(b[k]) ? b[k] : []) as { id?: string }[];
    if (x.length && y.length && x[0].id !== undefined && y[0].id !== undefined) {
      const old = new Map(x.map((p) => [p.id, p]));
      for (const p of y) {
        const o = old.get(p.id);
        if (!o) out.added++;
        else {
          if (jsonOf(o) !== jsonOf(p)) out.changed++;
          old.delete(p.id);
        }
      }
      out.removed += old.size;
    } else {
      // No ids (portals, spawns, loose colliders): match identical entries whatever their place in the list, so deleting one
      // from the middle does not count every later entry as changed. What is left over pairs up as "changed".
      const left = new Map<string, number>();
      for (const e of x) left.set(jsonOf(e), (left.get(jsonOf(e)) ?? 0) + 1);
      let fresh = 0;
      for (const e of y) {
        const j = jsonOf(e), c = left.get(j) ?? 0;
        if (c > 0) left.set(j, c - 1); else fresh++;
      }
      let gone = 0;
      for (const c of left.values()) gone += c;
      const pair = Math.min(gone, fresh);
      out.changed += pair;
      out.added += fresh - pair;
      out.removed += gone - pair;
    }
  }
  if (a && (jsonOf(a.zone) !== jsonOf(b.zone) || jsonOf(a.walkable) !== jsonOf(b.walkable) || jsonOf(a.lair) !== jsonOf(b.lair))) out.changed++;
  return out;
}
