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
//   POST /api/admin/maps/new                   a new map (copy / empty floor / imported JSON) with its settings (mapCreate)
//   PUT  /api/admin/maps/:id/settings          an editor-made map's settings: name, floor, levels, safe, channels, Auto (mapCreate)
//   POST /api/admin/maps/:id/hide              takes an editor-made map out of the game or puts it back (mapCreate)
//   DELETE /api/admin/maps/:id                 deletes an editor-made map for good (mapDelete), refused while a door leads to it
//   GET  /api/zones                            (public) the editor-made maps the game runs: settings + published revision
//
// Every value from the page is checked here; saves, publishes and rollbacks go to admin_audit.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db';
import { HttpError, readJson, send } from './http';
import { log, requireFeature, type Admin } from './admin';
import { applyMaps, checkMap, isCustomZone, isMapZone, liveCustomZones, parseDef, parseMap, publishedRevs } from './maps-live';
import type { GameWorld } from './world';
import { cleanCustomDef, copyMap, CUSTOM_ID_RE, emptyMap, EMPTY_HALF } from '../src/shared/customZones';
import { ZONES } from '../src/shared/data/zones';
import type { MapTheme } from '../src/shared/mapSchema';
import { diffMaps, type MapDiff } from '../src/shared/mapDiff';
import { MapRegistry } from '../src/shared/mapRegistry';
import { bakedText } from '../src/shared/mapText';
import { currentBalance } from '../src/shared/balance';
import type { MapData, MapIssue } from '../src/shared/mapSchema';

/** The biggest layout the page may send (a baked map is 100–300 KB). */
const MAP_BODY_MAX = 2 * 1024 * 1024;
const NOTE_MAX = 200;

const jsonOf = (v: unknown): string => JSON.stringify(v);

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

/** Needs this tool on top of mapEdit. */
function requireAlso(a: Admin, tool: 'mapCreate' | 'mapDelete'): void {
  if (!a.features.includes(tool)) throw new HttpError(403, tool === 'mapCreate' ? 'ต้องมีสิทธิ์ "สร้างแมพใหม่"' : 'ต้องมีสิทธิ์ "ลบแมพที่สร้างเอง"');
}

/** A fresh id for a new map from its English name (else "map"): c_<name>, c_<name>_2, … never one in use. */
function newZoneId(db: Db, name: string): string {
  const base = 'c_' + (name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'map');
  const used = (id: string): boolean => !!MapRegistry.bundled(id) || !!ZONES[id] || !!db.customZone(id) || !!db.mapDraft(id) || !!db.mapPublished(id);
  let id = base;
  for (let n = 2; used(id); n++) id = `${base}_${n}`;
  return id;
}

/** The layout a copy starts from: what the game runs (published, else the bundled file), else the draft of a map never published. */
function sourceOf(db: Db, id: string): MapData | undefined {
  const pub = db.mapPublished(id);
  const draft = db.mapDraft(id);
  return (pub && parseMap(pub.json)) ?? MapRegistry.bundled(id) ?? (draft && parseMap(draft.json)) ?? undefined;
}

/** The maps (other than `id`) whose draft, newest published layout or bundled file has a door to `id`. */
function doorsTo(db: Db, id: string): string[] {
  const out: string[] = [];
  const all = [...MapRegistry.ids(), ...db.customZones().map((r) => r.id)];
  for (const other of new Set(all)) {
    if (other === id) continue;
    const layouts = [db.mapDraft(other), db.mapPublished(other)].map((r) => r && parseMap(r.json));
    layouts.push(MapRegistry.bundled(other));
    if (layouts.some((m) => m?.portals?.some((p) => p.to === id))) out.push(ZONES[other]?.nameTh ?? parseDef(db.customZone(other)?.def ?? '')?.nameTh ?? other);
  }
  return out;
}

const THEMES: MapTheme[] = ['forest', 'marsh', 'snow', 'volcano'];

/** Handles the admin map routes; false for any other path. */
export async function mapsAdminApi(req: IncomingMessage, res: ServerResponse, path: string, method: string, db: Db, world: GameWorld): Promise<boolean> {
  if (method === 'GET' && path === '/api/admin/maps') {
    requireFeature(req, db, 'mapEdit');
    const row = (id: string, custom?: { def: unknown; status: string }) => {
      const pub = db.mapPublished(id);
      const draft = db.mapDraft(id);
      return {
        id, of: MapRegistry.bundled(id)?.room?.of ?? null, bundledRev: MapRegistry.bundled(id)?.rev ?? 0, publishedRev: pub?.rev ?? null, publishedAt: pub?.updatedAt ?? null,
        draft: draft ? { baseRev: draft.rev, author: draft.author, note: draft.note, updatedAt: draft.updatedAt } : null,
        ...(custom ? { custom } : {}),
      };
    };
    const bundled = MapRegistry.ids().filter((id) => !!MapRegistry.bundled(id));
    const maps = [...bundled.map((id) => row(id)), ...db.customZones().map((c) => row(c.id, { def: parseDef(c.def) ?? null, status: c.status }))];
    send(res, 200, { maps, fromDb: currentBalance().mapFromDb });
    return true;
  }

  if (method === 'POST' && path === '/api/admin/maps/new') {
    const a = requireFeature(req, db, 'mapEdit');
    requireAlso(a, 'mapCreate');
    const body = await readJson(req, MAP_BODY_MAX);
    const rawDef = (body.def ?? {}) as Record<string, unknown>;
    const id = newZoneId(db, typeof rawDef.name === 'string' ? rawDef.name : '');
    if (!CUSTOM_ID_RE.test(id)) throw new HttpError(500, 'สร้างรหัสแมพไม่ได้');
    const cleaned = cleanCustomDef(rawDef, id);
    if ('error' in cleaned) throw new HttpError(400, cleaned.error);
    const def = cleaned.def;
    let map: MapData;
    let how: string;
    if (body.mode === 'copy') {
      const from = typeof body.from === 'string' ? body.from : '';
      if (!isMapZone(from)) throw new HttpError(400, 'ไม่มีแมพต้นฉบับนี้');
      const src = sourceOf(db, from);
      if (!src) throw new HttpError(400, 'อ่านแมพต้นฉบับไม่ได้');
      map = copyMap(src, id, def.floor);
      how = `คัดลอกจาก ${from}`;
    } else if (body.mode === 'empty') {
      const theme = THEMES.includes(body.theme as MapTheme) ? (body.theme as MapTheme) : null;
      const half = body.half;
      if (!theme) throw new HttpError(400, 'ธีมไม่ถูกต้อง');
      if (typeof half !== 'number' || !Number.isFinite(half) || half < EMPTY_HALF.min || half > EMPTY_HALF.max) throw new HttpError(400, `ขนาดต้องเป็น ${EMPTY_HALF.min}–${EMPTY_HALF.max}`);
      map = emptyMap(id, def.floor, theme, half);
      how = `พื้นเปล่า ${theme} ครึ่งกว้าง ${Math.round(half)}`;
    } else if (body.mode === 'import') {
      const src = body.map as MapData | undefined;
      const fin = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);
      if (!src || typeof src !== 'object' || Array.isArray(src) || !src.zone || typeof src.zone !== 'object' || !Array.isArray(src.props)
        || !src.zone.start || !fin(src.zone.start.x) || !fin(src.zone.start.z)) throw new HttpError(400, 'ไฟล์นี้ไม่ใช่แมพ (JSON ของตัวแก้แมพ)');
      map = copyMap(src, id, def.floor);
      how = 'นำเข้าไฟล์ JSON';
    } else throw new HttpError(400, 'วิธีสร้างไม่ถูกต้อง');
    db.createCustomZone(id, jsonOf(def), jsonOf(map), a.acc.username);
    applyMaps(db); // the editor and the checks now know the id (it is not in the game until it is published)
    log(db, a, 'map-create', id, `${def.nameTh} · ${how}`);
    send(res, 200, { ok: true, id, issues: checkMap(map) });
    return true;
  }

  const del = /^\/api\/admin\/maps\/([a-z0-9_]{1,40})$/.exec(path);
  if (del && method === 'DELETE') {
    const a = requireFeature(req, db, 'mapEdit');
    requireAlso(a, 'mapDelete');
    const id = del[1];
    if (MapRegistry.bundled(id)) throw new HttpError(400, 'แมพที่มากับเกมลบไม่ได้');
    const row = db.customZone(id);
    if (!row) throw new HttpError(404, 'ไม่มีแมพนี้');
    const doors = doorsTo(db, id);
    if (doors.length) throw new HttpError(409, `ยังมีประตูจากแมพอื่นชี้มาที่แมพนี้: ${doors.join(', ')} · ลบหรือเปลี่ยนปลายทางประตูเหล่านั้น (ทั้งร่างและที่เผยแพร่) ก่อน`);
    const name = parseDef(row.def)?.nameTh ?? id;
    const moved = world.closeZone(id, `แมพ "${name}" ถูกลบ คุณถูกย้ายมาที่เมืองกลาง`);
    db.deleteCustomZone(id);
    applyMaps(db);
    log(db, a, 'map-delete', id, `${name}${moved ? ` · ย้ายผู้เล่น ${moved} คนไปเมืองกลาง` : ''}`);
    send(res, 200, { ok: true, moved });
    return true;
  }

  const m = /^\/api\/admin\/maps\/([a-z0-9_]{1,40})\/(draft|publish|revisions|rollback|export|settings|hide)(?:\/(\d{1,9}))?$/.exec(path);
  if (!m) return false;
  const [, id, what, revText] = m;

  if (what === 'settings' && method === 'PUT') {
    const a = requireFeature(req, db, 'mapEdit');
    requireAlso(a, 'mapCreate');
    if (!isCustomZone(id)) throw new HttpError(400, 'ตั้งค่าได้เฉพาะแมพที่สร้างเอง');
    const body = await readJson(req);
    const cleaned = cleanCustomDef(body.def, id);
    if ('error' in cleaned) throw new HttpError(400, cleaned.error);
    const d = cleaned.def;
    db.updateCustomZone(id, { def: jsonOf(d) });
    applyMaps(db); // rooms opened from now on use it; rooms with players keep theirs
    log(db, a, 'map-settings', id, `${d.nameTh} · ชั้น ${d.floor} · Lv ${d.levels[0]}–${d.levels[1]} · ปลอดภัย ${d.safe ? 'ใช่' : 'ไม่'} · แชนแนล ${d.channels ? 'ใช่' : 'ไม่'} · Auto ${d.autoPlay ? 'ได้' : 'ไม่ได้'}`);
    send(res, 200, { ok: true, def: d });
    return true;
  }

  if (what === 'hide' && method === 'POST') {
    const a = requireFeature(req, db, 'mapEdit');
    requireAlso(a, 'mapCreate');
    const row = db.customZone(id);
    if (!row) throw new HttpError(400, 'ซ่อนได้เฉพาะแมพที่สร้างเอง');
    const body = await readJson(req);
    const hidden = body.hidden === true;
    db.updateCustomZone(id, { status: hidden ? 'hidden' : 'live' });
    applyMaps(db);
    const name = parseDef(row.def)?.nameTh ?? id;
    const moved = hidden ? world.closeZone(id, `แมพ "${name}" ปิดชั่วคราว คุณถูกย้ายมาที่เมืองกลาง`) : 0;
    log(db, a, hidden ? 'map-hide' : 'map-show', id, `${name}${moved ? ` · ย้ายผู้เล่น ${moved} คนไปเมืองกลาง` : ''}`);
    send(res, 200, { ok: true, moved });
    return true;
  }

  if (what === 'draft' && method === 'GET') {
    requireFeature(req, db, 'mapEdit');
    zoneParam(id);
    const draft = db.mapDraft(id);
    const pub = db.mapPublished(id);
    const map = (draft && parseMap(draft.json)) ?? (pub && parseMap(pub.json)) ?? MapRegistry.bundled(id);
    // An editor-made map's settings come along: the game's "ทดลองเดิน" builds its zone from them (src/client/mapPreview.ts).
    const custom = isCustomZone(id) ? parseDef(db.customZone(id)?.def ?? '') : undefined;
    send(res, 200, { map, source: draft ? 'draft' : pub ? 'published' : 'bundled', baseRev: draft?.rev ?? pub?.rev ?? 0, publishedRev: pub?.rev ?? null, issues: map ? checkMap(map) : [], ...(custom ? { custom } : {}) });
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
    const map = parseMap(row.json);
    // `text` is the file exactly as the bake tool writes it (one line per list item), ready to save at `file`; `json` is the stored text as before.
    send(res, 200, { rev: row.rev, file: `src/shared/data/maps/${id}.json`, json: row.json, custom: isCustomZone(id), ...(map ? { text: bakedText(map) } : {}) });
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
  if (path === '/api/zones') {
    send(res, 200, { zones: liveCustomZones(db) });
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
