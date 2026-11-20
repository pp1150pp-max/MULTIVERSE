// How many pieces a map edit changed (shown before publishing, and in the audit log). Shared by the server and /admin.
import type { MapData } from './mapSchema';

const jsonOf = (v: unknown): string => JSON.stringify(v);

export interface MapDiff { added: number; removed: number; changed: number }


/** What changed between two layouts, counting pieces: things with an id by id, the rest by place in their list. */
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
      const n = Math.min(x.length, y.length);
      for (let i = 0; i < n; i++) if (jsonOf(x[i]) !== jsonOf(y[i])) out.changed++;
      if (y.length > n) out.added += y.length - n;
      if (x.length > n) out.removed += x.length - n;
    }
  }
  if (a && (jsonOf(a.zone) !== jsonOf(b.zone) || jsonOf(a.walkable) !== jsonOf(b.walkable) || jsonOf(a.lair) !== jsonOf(b.lair))) out.changed++;
  return out;
}
