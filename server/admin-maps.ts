// The map editor's server side (docs/plans/map-editor.md, sections 3.1–3.3), PR 5. Admin routes under /api/admin/maps
// and the two public ones the game's browser reads (GET /api/maps, GET /api/maps/:id).
//
//   GET  /api/admin/maps                       every map: bundled / published rev, draft
//   GET  /api/admin/maps/:id/draft             the draft (else the newest published layout, else the bundled one) to edit
//   PUT  /api/admin/maps/:id/draft             saves the draft; it is checked again here, a draft that fails is kept but can't be published
//   POST /api/admin/maps/:id/publish           publishes the saved draft as the next revision
//   GET  /api/admin/maps/:id/revisions[/:rev]  the published revisions (with a JSON when one is named)
//   POST /api/admin/maps/:id/rollback          publishes an old revision again as a new one (mapRollback)
//   GET  /api/admin/maps/:id/export            the newest published JSON, to be saved as the file in the repo (mapExport)
//
// Every value from the page is checked here; saves, publishes and rollbacks go to admin_audit.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db';
import { HttpError, readJson, send } from './http';
import { log, requireFeature, type Admin } from './admin';
import { applyMaps, checkMap, isMapZone, parseMap, publishedRevs } from './maps-live';
import { MapRegistry } from '../src/shared/mapRegistry';
import { currentBalance } from '../src/shared/balance';
import type { MapData, MapIssue } from '../src/shared/mapSchema';

/** The biggest layout the page may send (a baked map is 100–300 KB). */
const MAP_BODY_MAX = 2 * 1024 * 1024;
const NOTE_MAX = 200;

export interface MapDiff { added: number; removed: number; changed: number }

const jsonOf = (v: unknown): string => JSON.stringify(v);

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

const diffText = (d: MapDiff): string => `เพิ่ม ${d.added} · ลบ ${d.removed} · แก้ ${d.changed} ชิ้น`;
const errorsOf = (issues: MapIssue[]): MapIssue[] => issues.filter((i) => i.severity === 'error');

function zoneParam(id: string): string {
  if (!isMapZone(id)) throw new HttpError(404, 'ไม่มีแมพนี้');
  return id;
}

function noteOf(v: unknown): string {
  const n = typeof v === 'string' ? v.replace(/[\p{Cc}\p{Cf}]/gu, ' ').trim() : '';
  return [...n].slice(0, NOTE_MAX).join('');
}

/** What the game uses for a zone right now before an edit: the newest published layout, else the bundled one. */
function currentOf(db: Db, id: string): MapData | undefined {
  const row = db.mapPublished(id);
  return (row && parseMap(row.json)) || MapRegistry.bundled(id);
}

function publish(db: Db, a: Admin, id: string, map: MapData, note: string, action: 'map-publish' | 'map-rollback'): { rev: number; diff: MapDiff } {
  const diff = diffMaps(currentOf(db, id), map);
  const rev = db.publishMap(id, (r) => jsonOf({ ...map, rev: r }), a.acc.username, note, MapRegistry.bundled(id)?.rev ?? 0);
  applyMaps(db); // new rooms use it at once; rooms with players keep theirs (Channels.sweep, Sim terrain)
  log(db, a, action, id, `rev ${rev} · ${diffText(diff)}${note ? ` · ${note}` : ''}`);
  return { rev, diff };
}

/** Handles the admin map routes; false for any other path. */
export async function mapsAdminApi(req: IncomingMessage, res: ServerResponse, path: string, method: string, db: Db): Promise<boolean> {
  if (method === 'GET' && path === '/api/admin/maps') {
    requireFeature(req, db, 'mapEdit');
    const maps = MapRegistry.ids().map((id) => {
      const pub = db.mapPublished(id);
      const draft = db.mapDraft(id);
      return {
        id, bundledRev: MapRegistry.bundled(id)?.rev ?? 0, publishedRev: pub?.rev ?? null, publishedAt: pub?.updatedAt ?? null,
        draft: draft ? { baseRev: draft.rev, author: draft.author, note: draft.note, updatedAt: draft.updatedAt } : null,
      };
    });
    send(res, 200, { maps, fromDb: currentBalance().mapFromDb });
    return true;
  }

  const m = /^\/api\/admin\/maps\/([a-z0-9_]{1,40})\/(draft|publish|revisions|rollback|export)(?:\/(\d{1,9}))?$/.exec(path);
  if (!m) return false;
  const [, id, what, revText] = m;

  if (what === 'draft' && method === 'GET') {
    requireFeature(req, db, 'mapEdit');
    zoneParam(id);
    const draft = db.mapDraft(id);
    const pub = db.mapPublished(id);
    const map = (draft && parseMap(draft.json)) ?? (pub && parseMap(pub.json)) ?? MapRegistry.bundled(id);
    send(res, 200, { map, source: draft ? 'draft' : pub ? 'published' : 'bundled', baseRev: draft?.rev ?? pub?.rev ?? 0, publishedRev: pub?.rev ?? null, issues: map ? checkMap(map) : [] });
    return true;
  }

  if (what === 'draft' && method === 'PUT') {
    const a = requireFeature(req, db, 'mapEdit');
    zoneParam(id);
    const body = await readJson(req, MAP_BODY_MAX);
    const map = body.map as MapData | undefined;
    if (!map || typeof map !== 'object' || Array.isArray(map)) throw new HttpError(400, 'ไม่มีข้อมูลแมพ');
    if (map.id !== id) throw new HttpError(400, 'รหัสแมพในข้อมูลไม่ตรงกับแมพที่บันทึก');
    const note = noteOf(body.note);
    // A draft may be unfinished: it is kept whatever the check says. The page sees the issues, publishing refuses them.
    const issues = checkMap(map);
    const baseRev = Number.isSafeInteger(map.rev) && map.rev >= 0 ? map.rev : 0;
    db.saveMapDraft(id, baseRev, jsonOf(map), a.acc.username, note);
    const diff = diffMaps(currentOf(db, id), map);
    log(db, a, 'map-draft', id, `ร่างจาก rev ${baseRev} · ${diffText(diff)} · ${errorsOf(issues).length} ข้อผิดพลาด`);
    send(res, 200, { ok: true, issues, diff });
    return true;
  }

  if (what === 'publish' && method === 'POST') {
    const a = requireFeature(req, db, 'mapEdit');
    zoneParam(id);
    const body = await readJson(req);
    const draft = db.mapDraft(id);
    const map = draft && parseMap(draft.json);
    if (!map) throw new HttpError(400, 'ยังไม่มีร่างให้เผยแพร่ บันทึกร่างก่อน');
    const issues = errorsOf(checkMap(map));
    if (issues.length) {
      send(res, 400, { error: `แมพยังไม่ผ่านการตรวจ (${issues.length} ข้อ) เผยแพร่ไม่ได้`, issues });
      return true;
    }
    send(res, 200, { ok: true, ...publish(db, a, id, map, noteOf(body.note), 'map-publish') });
    return true;
  }

  if (what === 'revisions' && method === 'GET') {
    requireFeature(req, db, 'mapEdit');
    zoneParam(id);
    if (revText === undefined) {
      send(res, 200, { revisions: db.mapRevisions(id), bundledRev: MapRegistry.bundled(id)?.rev ?? 0 });
      return true;
    }
    const row = db.mapPublished(id, Number(revText));
    if (!row) throw new HttpError(404, 'ไม่มี revision นี้ (เก็บย้อนหลังไว้ 20 revision)');
    send(res, 200, { rev: row.rev, author: row.author, note: row.note, updatedAt: row.updatedAt, map: parseMap(row.json) });
    return true;
  }

  if (what === 'rollback' && method === 'POST') {
    const a = requireFeature(req, db, 'mapEdit');
    if (!a.features.includes('mapRollback')) throw new HttpError(403, 'ต้องมีสิทธิ์ "ย้อนแมพกลับ revision เก่า"');
    zoneParam(id);
    const body = await readJson(req);
    const to = body.rev;
    if (typeof to !== 'number' || !Number.isSafeInteger(to) || to < 1) throw new HttpError(400, 'revision ไม่ถูกต้อง');
    const row = db.mapPublished(id, to);
    const map = row && parseMap(row.json);
    if (!row || !map) throw new HttpError(404, 'ไม่มี revision นี้ (เก็บย้อนหลังไว้ 20 revision)');
    const issues = errorsOf(checkMap(map));
    if (issues.length) {
      send(res, 400, { error: `revision นี้ไม่ผ่านการตรวจตามกฎปัจจุบัน (${issues.length} ข้อ)`, issues });
      return true;
    }
    const note = noteOf(body.note) || `ย้อนกลับไป rev ${to}`;
    send(res, 200, { ok: true, ...publish(db, a, id, map, note, 'map-rollback') });
    return true;
  }

  if (what === 'export' && method === 'GET') {
    const a = requireFeature(req, db, 'mapEdit');
    if (!a.features.includes('mapExport')) throw new HttpError(403, 'ต้องมีสิทธิ์ "ส่งออกแมพเข้า repo"');
    zoneParam(id);
    const row = db.mapPublished(id);
    if (!row) throw new HttpError(404, 'แมพนี้ยังไม่เคยเผยแพร่ (ใช้ไฟล์ใน repo อยู่แล้ว)');
    send(res, 200, { rev: row.rev, file: `src/shared/data/maps/${id}.json`, json: row.json });
    return true;
  }

  throw new HttpError(405, 'ใช้วิธีเรียกนี้ไม่ได้');
}

/** The public routes the game's browser reads before it loads pictures: {zoneId: rev} (empty while the switch is off), and one published layout. */
export function mapsPublicApi(res: ServerResponse, path: string, method: string, url: URL, db: Db): boolean {
  if (method !== 'GET') return false;
  if (path === '/api/maps') {
    send(res, 200, publishedRevs(db));
    return true;
  }
  const m = /^\/api\/maps\/([a-z0-9_]{1,40})$/.exec(path);
  if (!m) return false;
  // Served whatever the switch says: a room built from this revision may still be running, and its players must fetch the same layout.
  const q = url.searchParams.get('rev');
  const rev = q === null ? undefined : Number(q);
  if (rev !== undefined && (!Number.isSafeInteger(rev) || rev < 1)) throw new HttpError(400, 'revision ไม่ถูกต้อง');
  const row = db.mapPublished(m[1], rev);
  if (!row) throw new HttpError(404, 'ไม่มีแมพนี้');
  // A revision never changes, so browsers may keep it; "newest" must be asked again.
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': rev === undefined ? 'no-store' : 'public, max-age=31536000, immutable',
  });
  res.end(row.json);
  return true;
}
