// The map editor's "ทดลองเดิน" (docs/plans/map-editor.md 2.3): the game opened with ?previewMap=<zoneId> walks the owner's draft of that map.
//
// The page asks for the draft with the player's own login (GET /api/admin/maps/:id/draft, which needs the mapEdit tool), puts it into
// MapRegistry, and joins with `previewMap`. The server checks the tool again and builds a private room from the same draft; anyone
// without the tool simply gets the normal join, and the browser drops the draft again when the welcome does not say `preview`.
// Nothing here is stored (no cache entry, no save): closing the tab ends it.
import { refreshZone } from '../shared/data/zones';
import { MapRegistry } from '../shared/mapRegistry';
import type { MapData, MapIssue } from '../shared/mapSchema';
import { putCustomDef, type CustomZoneDef } from '../shared/customZones';

/** The zone named by ?previewMap, or null (a zone id is lowercase letters, digits and underscore). */
export function previewParam(): string | null {
  try {
    const v = new URLSearchParams(location.search).get('previewMap');
    return v && /^[a-z0-9_]{1,40}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** The zone whose draft this tab runs on right now (set once the server agreed), for a reconnect to ask for it again. */
let active: string | null = null;
export const activePreview = (): string | null => active;

/** Fetches the draft and makes the zone use it. Returns the zone id when the draft is in place and passes the check, else null. */
export async function loadPreviewDraft(id: string, token: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/admin/maps/${id}/draft`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null; // no mapEdit tool, or not a map: play normally
    const body = (await r.json()) as { map?: MapData; issues?: MapIssue[]; custom?: CustomZoneDef };
    if (!body.map || body.map.id !== id) return null;
    if ((body.issues ?? []).some((i) => i.severity === 'error')) {
      alert('ร่างของแมพนี้ยังไม่ผ่านการตรวจ ทดลองเดินไม่ได้ กลับไปแก้ในตัวแก้แมพก่อน');
      return null;
    }
    if (body.custom?.id === id) putCustomDef(body.custom); // a map made in the editor: its settings build the zone
    MapRegistry.set(body.map);
    refreshZone(id);
    return id;
  } catch {
    return null;
  }
}

/** The server did (or did not) accept the preview: keep the draft and show the banner, or go back to the published layout. */
export function settlePreview(id: string | null, accepted: boolean): void {
  if (id && accepted) {
    active = id;
    showBanner(id);
    return;
  }
  active = null;
  if (id) {
    // Refused: the zone goes back to what the server runs (ensureMap fetches the published revision it names).
    MapRegistry.clear(id);
    refreshZone(id);
  }
}

function showBanner(id: string): void {
  if (document.getElementById('map-preview-banner')) return;
  const bar = document.createElement('div');
  bar.id = 'map-preview-banner';
  bar.textContent = `👁 โหมดพรีวิวร่างแมพ "${id}" · เห็นแค่คุณคนเดียว ไม่บันทึกตัวละคร ไม่ได้ของ/EXP จริง · ปิดแท็บนี้เมื่อเสร็จ`;
  bar.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:99999;background:#c0392b;color:#fff;font:600 13px system-ui,sans-serif;padding:5px 14px;border-radius:0 0 8px 8px;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.4)';
  document.body.append(bar);
}
