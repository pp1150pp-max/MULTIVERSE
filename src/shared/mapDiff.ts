// How many pieces a map edit changed (shown before publishing, and in the audit log). Shared by the server and /admin.
import type { MapData } from './mapSchema';

const jsonOf = (v: unknown): string => JSON.stringify(v);

export interface MapDiff { added: number; removed: number; changed: number }


/** What changed between two layouts, counting pieces: things with an id by id, the rest by what they hold (see below). */
export function diffMaps(a: MapData | undefined, b: MapData): MapDiff {
  const out: MapDiff = { added: 0, removed: 0, changed: 0 };
  const lists = ['props', 'blockers', 'npcs', 'paths', 'water', 'rest', 'portals', 'spawns', 'colliders', 'waveSpots'] as const;
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

// ---------------------------------------------------------------- one entry per changed piece (the editor's "เทียบ revision")

export type DiffKind = 'added' | 'removed' | 'moved' | 'changed';
export type DiffList = (typeof DIFF_LISTS)[number] | 'zone' | 'lair';
type Pos = [number, number];
/** One changed piece between layout A and layout B. `from` = where it was in A, `to` = where it is in B. */
export interface DiffItem {
  list: DiffList;
  kind: DiffKind;
  /** The piece's id (props, blockers, npcs, paths), or its index in B (A when removed) for lists without ids. */
  id: string;
  label: string;
  from?: Pos;
  to?: Pos;
  /** The piece in A / in B (for drawing it). */
  before?: unknown;
  after?: unknown;
  /** The fields that differ (moved/changed). */
  fields?: string[];
}

const DIFF_LISTS = ['props', 'blockers', 'npcs', 'paths', 'water', 'rest', 'portals', 'spawns', 'colliders', 'waveSpots'] as const;
type Entry = Record<string, unknown> & { id?: string; x?: number; z?: number; pts?: Pos[] };

function posOf(e: Entry): Pos | undefined {
  if (typeof e.x === 'number' && typeof e.z === 'number') return [e.x, e.z];
  if (Array.isArray(e.pts) && e.pts.length) {
    let x = 0, z = 0;
    for (const p of e.pts) { x += p[0]; z += p[1]; }
    return [x / e.pts.length, z / e.pts.length];
  }
  return undefined;
}

/** What a piece without an id is, so a moved door pairs with the door, not with a spawn ring that happens to be nearer. */
const sortOf = (e: Entry): string => String(e.to ?? e.monster ?? e.kind ?? '');

function labelOf(list: DiffList, e: Entry): string {
  switch (list) {
    case 'props': return `${String(e.key)} (${e.id})`;
    case 'npcs': return `NPC ${e.id}`;
    case 'blockers': return `ขอบเขต ${e.id}`;
    case 'paths': return `ทางเดิน ${e.id}`;
    case 'portals': return `ประตู → ${String(e.to)}`;
    case 'spawns': return `จุดเกิด ${String(e.monster)}`;
    case 'rest': return `จุดพัก ${String(e.kind)}`;
    case 'water': return e.kind === 'lava' ? 'ลาวา' : 'ทะเลสาบน้ำแข็ง';
    case 'colliders': return 'วงกั้น (ไม่มีภาพ)';
    case 'waveSpots': return 'จุดเกิดระลอก';
    case 'lair': return `ที่เรียกบอส ${String(e.boss)}`;
    default: return 'ค่าของแมพ (จุดเริ่ม/เขตปลอดภัย/กรอบเดิน)';
  }
}

/** A piece found in both: moved when its position changed (whatever else did too), else changed. null when identical. */
function pairItem(list: DiffList, id: string, a: Entry, b: Entry): DiffItem | null {
  const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => jsonOf(a[k]) !== jsonOf(b[k]));
  if (!fields.length) return null;
  const from = posOf(a), to = posOf(b);
  const moved = !!from && !!to && (Math.abs(from[0] - to[0]) > 1e-6 || Math.abs(from[1] - to[1]) > 1e-6);
  return { list, kind: moved ? 'moved' : 'changed', id, label: labelOf(list, b), from, to, before: a, after: b, fields };
}

/**
 * Every piece that differs between layout A and layout B, one entry each (for drawing on the canvas and listing). Pieces with
 * ids pair by id. Lists without ids pair identical entries first (as diffMaps does), then pair what is left over by kind and
 * nearest position (a door to a door, a spawn of the same monster), then any remainder by nearest position; what still has no
 * partner is added or removed. So the counts match diffMaps, which pairs the leftovers the same many-for-many way.
 */
export function diffMapItems(a: MapData, b: MapData): DiffItem[] {
  const out: DiffItem[] = [];
  for (const list of DIFF_LISTS) {
    const x = (Array.isArray(a[list]) ? a[list] : []) as unknown as Entry[];
    const y = (Array.isArray(b[list]) ? b[list] : []) as unknown as Entry[];
    if (!x.length && !y.length) continue;
    if (x.every((e) => e.id !== undefined) && y.every((e) => e.id !== undefined)) {
      const old = new Map(x.map((p) => [p.id!, p]));
      for (const p of y) {
        const o = old.get(p.id!);
        if (!o) out.push({ list, kind: 'added', id: p.id!, label: labelOf(list, p), to: posOf(p), after: p });
        else {
          const it = pairItem(list, p.id!, o, p);
          if (it) out.push(it);
          old.delete(p.id!);
        }
      }
      for (const o of old.values()) out.push({ list, kind: 'removed', id: o.id!, label: labelOf(list, o), from: posOf(o), before: o });
      continue;
    }
    // No ids: drop identical entries from both sides first.
    const left = x.map((e, i) => ({ e, i, j: jsonOf(e) }));
    const fresh: { e: Entry; i: number }[] = [];
    for (let i = 0; i < y.length; i++) {
      const j = jsonOf(y[i]);
      const k = left.findIndex((o) => o.j === j);
      if (k >= 0) left.splice(k, 1); else fresh.push({ e: y[i], i });
    }
    // Pair the rest: same kind first, nearest first.
    const dist = (p: Entry, q: Entry): number => { const u = posOf(p), v = posOf(q); return u && v ? Math.hypot(u[0] - v[0], u[1] - v[1]) : 1e9; };
    for (const sameKind of [true, false]) {
      const pairs: { li: number; fi: number; d: number }[] = [];
      left.forEach((o, li) => fresh.forEach((n, fi) => { if (!sameKind || sortOf(o.e) === sortOf(n.e)) pairs.push({ li, fi, d: dist(o.e, n.e) }); }));
      pairs.sort((p, q) => p.d - q.d);
      const usedL = new Set<number>(), usedF = new Set<number>();
      for (const p of pairs) {
        if (usedL.has(p.li) || usedF.has(p.fi)) continue;
        usedL.add(p.li); usedF.add(p.fi);
        const it = pairItem(list, String(fresh[p.fi].i), left[p.li].e, fresh[p.fi].e);
        if (it) out.push(it);
      }
      for (const i of [...usedL].sort((p, q) => q - p)) left.splice(i, 1);
      for (const i of [...usedF].sort((p, q) => q - p)) fresh.splice(i, 1);
    }
    for (const n of fresh) out.push({ list, kind: 'added', id: String(n.i), label: labelOf(list, n.e), to: posOf(n.e), after: n.e });
    for (const o of left) out.push({ list, kind: 'removed', id: String(o.i), label: labelOf(list, o.e), from: posOf(o.e), before: o.e });
  }
  // The lair, and the map's own settings (start, safe zone, walkable frame).
  const la = a.lair as Entry | undefined, lb = b.lair as Entry | undefined;
  if (la && lb) { const it = pairItem('lair', 'lair', la, lb); if (it) out.push(it); }
  else if (lb) out.push({ list: 'lair', kind: 'added', id: 'lair', label: labelOf('lair', lb), to: posOf(lb), after: lb });
  else if (la) out.push({ list: 'lair', kind: 'removed', id: 'lair', label: labelOf('lair', la), from: posOf(la), before: la });
  if (jsonOf(a.zone) !== jsonOf(b.zone) || jsonOf(a.walkable) !== jsonOf(b.walkable)) {
    const from: Pos = [a.zone.start.x, a.zone.start.z], to: Pos = [b.zone.start.x, b.zone.start.z];
    const moved = from[0] !== to[0] || from[1] !== to[1];
    out.push({ list: 'zone', kind: moved ? 'moved' : 'changed', id: 'zone', label: labelOf('zone', {}), from, to, before: a.zone, after: b.zone });
  }
  return out;
}
