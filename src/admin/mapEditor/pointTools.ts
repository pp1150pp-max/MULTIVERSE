// PR 7 tools that edit single points: named pins (NPC, doors, rest spots, the boss lair) and monster spawn circles.
// Each is one `Tool` added with `ed.addTool`; every change is one command of the PR 6 stack (ed.exec / live + commitLive).
import { MONSTERS } from '../../shared/data/monsters';
import { ZONES } from '../../shared/data/zones';
import { ROOM_SPAWN_OFFSET, roomSpawnOf, type MapData, type MapSpawn } from '../../shared/mapSchema';
import type { EdPointer, Editor, Tool } from './editor';
import { pick, type MapPatch } from './history';
import { btn, el, note, numField, selectField } from './ui';

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const HIT_PX = 11;

/** A world point after the grid snap (Alt = off for the moment). */
export function gridSnap(ed: Editor, x: number, z: number, alt: boolean): [number, number] {
  if (!ed.opts.snap || alt) return [round3(x), round3(z)];
  const g = ed.opts.grid;
  return [round3(Math.round(x / g) * g), round3(Math.round(z / g) * g)];
}

/** The id part of the selected `<kind>:<id>` key (null when nothing of that kind is selected). */
export function keyOf(ed: Editor, kind: string): string | null {
  for (const s of ed.selection) if (s.startsWith(`${kind}:`)) return s.slice(kind.length + 1);
  return null;
}

// ---------------------------------------------------------------- pins

type PinKind = 'npc' | 'portal' | 'rest' | 'lair';
interface Pin { key: string; kind: PinKind; id: string; x: number; z: number; label: string; color: string }
const PIN_COLOR: Record<PinKind, string> = { npc: '#4ac0e8', portal: '#b070f0', rest: '#e8c040', lair: '#e05050' };

/** Zones a door may lead to: the maps themselves (boss rooms are reached by the boss summoner, not by a door). */
/** Where a door may lead: the game's maps, then (set by the page from its map list) the maps made in the editor. */
let DOOR_TARGETS: [string, string][] = Object.values(ZONES).filter((z) => !z.roomOf).map((z) => [z.id, `${z.nameTh} (${z.id})`]);
export function setDoorTargets(extra: [string, string][]): void {
  DOOR_TARGETS = [...Object.values(ZONES).filter((z) => !z.roomOf && !z.custom).map((z): [string, string] => [z.id, `${z.nameTh} (${z.id})`]), ...extra];
}

function pinsOf(m: MapData): Pin[] {
  const out: Pin[] = [];
  for (const n of m.npcs) out.push({ key: `npc:${n.id}`, kind: 'npc', id: n.id, x: n.x, z: n.z, label: n.id, color: PIN_COLOR.npc });
  m.portals.forEach((p, i) => out.push({ key: `portal:${i}`, kind: 'portal', id: String(i), x: p.x, z: p.z, label: `→ ${p.to}`, color: PIN_COLOR.portal }));
  m.rest.forEach((r, i) => out.push({ key: `rest:${i}`, kind: 'rest', id: String(i), x: r.x, z: r.z, label: r.kind, color: PIN_COLOR.rest }));
  if (m.lair) out.push({ key: 'lair:lair', kind: 'lair', id: 'lair', x: m.lair.x, z: m.lair.z, label: m.lair.boss, color: PIN_COLOR.lair });
  return out;
}

/** The map list holding the pin, with the pin moved to (x, z); only the touched list is replaced. */
function movePin(m: MapData, pin: Pin, x: number, z: number): MapPatch {
  switch (pin.kind) {
    case 'npc': return { npcs: m.npcs.map((n) => (n.id === pin.id ? { ...n, x, z } : n)) };
    case 'portal': return { portals: m.portals.map((p, i) => (String(i) === pin.id ? { ...p, x, z } : p)) };
    case 'rest': return { rest: m.rest.map((r, i) => (String(i) === pin.id ? { ...r, x, z } : r)) };
    case 'lair': return { lair: m.lair ? { ...m.lair, x, z } : m.lair };
  }
}
const pinKeys = (k: PinKind): (keyof MapData)[] => [k === 'npc' ? 'npcs' : k === 'portal' ? 'portals' : k === 'rest' ? 'rest' : 'lair'];

function removePortal(ed: Editor, i: number): void {
  ed.exec('ลบประตู', { portals: ed.map.portals.filter((_, k) => k !== i) });
  ed.select([]);
}

export function pinTool(): Tool {
  let drag: { pin: Pin; before: MapPatch; moved: boolean } | null = null;
  const hitPin = (ed: Editor, px: number, py: number): Pin | null => {
    if (ed.isLocked('markers')) return null;
    let best: Pin | null = null, bd = HIT_PX;
    for (const p of pinsOf(ed.map)) {
      const [sx, sy] = ed.toScreen(p.x, p.z);
      const d = Math.hypot(px - sx, py - sy);
      if (d <= bd) { best = p; bd = d; }
    }
    return best;
  };
  const selected = (ed: Editor): Pin | null => {
    const k = [...ed.selection].find((s) => s.includes(':'));
    return pinsOf(ed.map).find((p) => p.key === k) ?? null;
  };
  return {
    id: 'pins',
    label: 'NPC / ประตู',
    icon: '📍',
    hint: 'คลิกหมุดเพื่อเลือก ลากเพื่อย้าย (Alt = ปิด snap) · ฟ้า = NPC (หนึ่งตัวมีหมุดเดียว ย้ายได้ เพิ่ม/ลบไม่ได้) · ม่วง = ประตู เลือกปลายทางและเลเวลขั้นต่ำที่ช่องขวา · เหลือง = จุดพัก · แดง = ที่เรียกบอส · Delete ลบประตู',
    activate(ed) { ed.select([]); },
    pointerDown(ed, e) {
      const hit = hitPin(ed, e.px, e.py);
      if (!hit) { ed.select([]); return; }
      ed.select([hit.key]);
      drag = { pin: hit, before: pick(ed.map, pinKeys(hit.kind)), moved: false };
    },
    pointerMove(ed, e) {
      if (!drag) return;
      const [x, z] = gridSnap(ed, e.x, e.z, e.alt);
      if (!drag.moved && x === drag.pin.x && z === drag.pin.z) return;
      drag.moved = true;
      ed.live(movePin({ ...ed.map, ...drag.before } as MapData, drag.pin, x, z));
    },
    pointerUp(ed) {
      const d = drag;
      drag = null;
      if (d?.moved) ed.commitLive(`ย้ายหมุด ${d.pin.label}`, d.before);
    },
    key(ed, e) {
      const p = selected(ed);
      if (!p) return false;
      if ((e.key === 'Delete' || e.key === 'Backspace') && p.kind === 'portal') { removePortal(ed, Number(p.id)); return true; }
      if (e.key === 'Escape') { ed.select([]); return true; }
      return false;
    },
    drawOverlay(ed, g) {
      const p = selected(ed);
      if (!p) return;
      const [px, py] = ed.toScreen(p.x, p.z);
      g.strokeStyle = '#ffd24a'; g.lineWidth = 2;
      g.beginPath(); g.arc(px, py, 10, 0, Math.PI * 2); g.stroke();
    },
    cursor: (ed, e) => (hitPin(ed, e.px, e.py) ? 'move' : undefined),
    inspector(ed) {
      const p = selected(ed);
      const box = el('div', { class: 'me-inspector' });
      const addDoor = btn('＋ เพิ่มประตู', () => {
        const [x, z] = gridSnap(ed, ed.view.cx, ed.view.cz, false);
        ed.exec('เพิ่มประตู', { portals: [...ed.map.portals, { to: DOOR_TARGETS[0]?.[0] ?? 'nexus_city', x, z, minLevel: 0 }] });
        ed.select([`portal:${ed.map.portals.length - 1}`]);
      }, 'วางประตูใหม่กลางจอ แล้วลากไปที่ที่ต้องการ');
      if (!p) { box.append(note('ยังไม่ได้เลือกหมุด คลิกหมุดบนแมพ'), addDoor); return box; }
      const kindName = p.kind === 'npc' ? 'NPC' : p.kind === 'portal' ? 'ประตู' : p.kind === 'rest' ? 'จุดพัก' : 'ที่เรียกบอส';
      box.append(el('div', { class: 'me-title' }, `${kindName} · ${p.label}`),
        el('div', { class: 'me-grid2' },
          numField('x', p.x, (n) => ed.exec('ย้ายหมุด', movePin(ed.map, p, round3(n), p.z)), 0.5),
          numField('z', p.z, (n) => ed.exec('ย้ายหมุด', movePin(ed.map, p, p.x, round3(n))), 0.5)));
      if (p.kind === 'portal') {
        const i = Number(p.id);
        const door = ed.map.portals[i];
        if (door) {
          const targets = DOOR_TARGETS.some(([v]) => v === door.to) ? DOOR_TARGETS : [...DOOR_TARGETS, [door.to, door.to] as [string, string]];
          box.append(
            selectField('ปลายทาง', door.to, targets, (v) => ed.exec('แก้ปลายทางประตู', { portals: ed.map.portals.map((q, k) => (k === i ? { ...q, to: v } : q)) })),
            numField('เลเวลขั้นต่ำ (0 = ไม่จำกัด)', door.minLevel, (n) => ed.exec('แก้เลเวลขั้นต่ำ', { portals: ed.map.portals.map((q, k) => (k === i ? { ...q, minLevel: Math.max(0, Math.min(200, Math.round(n))) } : q)) }), 1, 0, 200),
            btn('🗑 ลบประตูนี้ (Delete)', () => removePortal(ed, i)));
        }
      }
      if (p.kind === 'npc') box.append(note('NPC ย้ายตำแหน่งได้เท่านั้น (id ผูกกับระบบเกม)'));
      box.append(addDoor);
      return box;
    },
  };
}

// ---------------------------------------------------------------- monster spawns

/** Monsters a field spawn may use (bosses and summoned-only ones come another way). */
const SPAWN_MONSTERS: [string, string][] = Object.values(MONSTERS).filter((m) => m.behavior !== 'boss' && !m.summonOnly).map((m) => [m.id, `${m.nameTh} (Lv ${m.levels[0]}–${m.levels[1]})`]);

export function spawnTool(): Tool {
  let brush = SPAWN_MONSTERS[0]?.[0] ?? 'green_slime';
  let drag: { i: number; mode: 'move' | 'radius'; before: MapPatch; moved: boolean } | null = null;
  const selIdx = (ed: Editor): number => { const k = keyOf(ed, 'spawn'); return k === null ? -1 : Number(k); };
  const setSpawn = (ed: Editor, i: number, label: string, fn: (s: MapSpawn) => MapSpawn): void =>
    ed.exec(label, { spawns: ed.map.spawns.map((s, k) => (k === i ? fn(s) : s)) });
  const radiusHandle = (ed: Editor, s: MapSpawn): [number, number] => ed.toScreen(s.x + s.radius, s.z);
  const hit = (ed: Editor, e: EdPointer): { i: number; part: 'radius' | 'body' } | null => {
    if (ed.isLocked('markers')) return null;
    const sel = selIdx(ed);
    if (sel >= 0 && ed.map.spawns[sel]) {
      // The handle wins only when it is nearer than the circle's middle (a small circle at low zoom has both close together).
      const sp = ed.map.spawns[sel];
      const [hx, hy] = radiusHandle(ed, sp);
      const [cx, cy] = ed.toScreen(sp.x, sp.z);
      const dh = Math.hypot(e.px - hx, e.py - hy);
      if (dh <= HIT_PX && dh < Math.hypot(e.px - cx, e.py - cy)) return { i: sel, part: 'radius' };
    }
    let best = -1, bd = Infinity;
    ed.map.spawns.forEach((s, i) => {
      const d = Math.hypot(e.x - s.x, e.z - s.z);
      if (d <= Math.max(s.radius, 10 / ed.view.scale) && d < bd) { best = i; bd = d; }
    });
    return best >= 0 ? { i: best, part: 'body' } : null;
  };
  return {
    id: 'spawns',
    label: 'จุดเกิดมอน',
    icon: '👹',
    hint: 'คลิกพื้นว่างเพื่อวางจุดเกิดใหม่ (ชนิดตามที่เลือกด้านขวา) · คลิกวงเพื่อเลือก ลากกลางวง = ย้าย ลากจุดแดงที่ขอบ = ปรับรัศมี · Delete ลบ · ถ้ามีวงที่เลือกอยู่ คลิกพื้นว่างจะเป็นการเลิกเลือกก่อน',
    activate(ed) { ed.select([]); },
    pointerDown(ed, e) {
      const h = hit(ed, e);
      if (h) {
        ed.select([`spawn:${h.i}`]);
        drag = { i: h.i, mode: h.part === 'radius' ? 'radius' : 'move', before: pick(ed.map, ['spawns']), moved: false };
        return;
      }
      if (selIdx(ed) >= 0) { ed.select([]); return; }
      const [x, z] = gridSnap(ed, e.x, e.z, e.alt);
      ed.exec('วางจุดเกิดมอน', { spawns: [...ed.map.spawns, { monster: brush, x, z, radius: 2.5, count: 1, respawn: [6, 10] }] });
      ed.select([`spawn:${ed.map.spawns.length - 1}`]);
    },
    pointerMove(ed, e) {
      if (!drag) return;
      const d = drag;
      const base = (d.before as { spawns: MapSpawn[] }).spawns;
      const s0 = base[d.i];
      if (!s0) return;
      d.moved = true;
      let s: MapSpawn;
      if (d.mode === 'radius') s = { ...s0, radius: Math.max(0.5, Math.min(50, Math.round(Math.hypot(e.x - s0.x, e.z - s0.z) * 10) / 10)) };
      else { const [x, z] = gridSnap(ed, e.x, e.z, e.alt); s = { ...s0, x, z }; }
      ed.live({ spawns: base.map((q, k) => (k === d.i ? s : q)) });
    },
    pointerUp(ed) {
      const d = drag;
      drag = null;
      if (d?.moved) ed.commitLive(d.mode === 'radius' ? 'ปรับรัศมีจุดเกิด' : 'ย้ายจุดเกิด', d.before);
    },
    key(ed, e) {
      const i = selIdx(ed);
      if (i < 0) return false;
      if (e.key === 'Delete' || e.key === 'Backspace') { ed.exec('ลบจุดเกิดมอน', { spawns: ed.map.spawns.filter((_, k) => k !== i) }); ed.select([]); return true; }
      if (e.key === 'Escape') { ed.select([]); return true; }
      return false;
    },
    drawOverlay(ed, g) {
      const s = ed.map.spawns[selIdx(ed)];
      if (!s) return;
      const [px, py] = ed.toScreen(s.x, s.z);
      const pts: [number, number][] = Array.from({ length: 40 }, (_, i) => [s.x + Math.cos((i / 40) * Math.PI * 2) * s.radius, s.z + Math.sin((i / 40) * Math.PI * 2) * s.radius]);
      g.fillStyle = 'rgba(255,210,74,0.12)'; g.strokeStyle = '#ffd24a'; g.lineWidth = 2;
      ed.path(g, pts); g.fill(); g.stroke();
      g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(px, py, 4, 0, Math.PI * 2); g.fill();
      const [hx, hy] = radiusHandle(ed, s);
      g.fillStyle = '#f55'; g.strokeStyle = '#300'; g.lineWidth = 1;
      g.beginPath(); g.arc(hx, hy, 6, 0, Math.PI * 2); g.fill(); g.stroke();
    },
    cursor(ed, e) { const h = hit(ed, e); return h ? (h.part === 'radius' ? 'ew-resize' : 'move') : 'copy'; },
    inspector(ed) {
      const i = selIdx(ed);
      const s = ed.map.spawns[i];
      const box = el('div', { class: 'me-inspector' });
      const monsters = (cur: string): [string, string][] => (SPAWN_MONSTERS.some(([v]) => v === cur) ? SPAWN_MONSTERS : [...SPAWN_MONSTERS, [cur, cur]]);
      if (!s) {
        box.append(note('ยังไม่ได้เลือกจุดเกิด คลิกพื้นว่างเพื่อวางใหม่'),
          selectField('ชนิดมอนที่จะวางต่อไป', brush, monsters(brush), (v) => { brush = v; }));
        return box;
      }
      box.append(
        el('div', { class: 'me-title' }, `จุดเกิดที่ ${i + 1}`),
        selectField('ชนิดมอน', s.monster, monsters(s.monster), (v) => { brush = v; setSpawn(ed, i, 'เปลี่ยนชนิดมอน', (q) => ({ ...q, monster: v })); }),
        el('div', { class: 'me-grid2' },
          numField('x', s.x, (n) => setSpawn(ed, i, 'ย้ายจุดเกิด', (q) => ({ ...q, x: round3(n) })), 0.5),
          numField('z', s.z, (n) => setSpawn(ed, i, 'ย้ายจุดเกิด', (q) => ({ ...q, z: round3(n) })), 0.5),
          numField('รัศมี', s.radius, (n) => setSpawn(ed, i, 'ปรับรัศมีจุดเกิด', (q) => ({ ...q, radius: Math.max(0, Math.min(50, round3(n))) })), 0.5, 0, 50),
          numField('จำนวน (1–50)', s.count, (n) => setSpawn(ed, i, 'แก้จำนวนมอน', (q) => ({ ...q, count: Math.max(1, Math.min(50, Math.round(n))) })), 1, 1, 50),
          numField('เกิดใหม่เร็วสุด (วิ)', s.respawn[0], (n) => setSpawn(ed, i, 'แก้เวลาเกิดใหม่', (q) => ({ ...q, respawn: [Math.max(1, n), Math.max(q.respawn[1], Math.max(1, n))] })), 1, 1, 3600),
          numField('เกิดใหม่ช้าสุด (วิ)', s.respawn[1], (n) => setSpawn(ed, i, 'แก้เวลาเกิดใหม่', (q) => ({ ...q, respawn: [Math.min(q.respawn[0], Math.max(1, n)), Math.max(1, n)] })), 1, 1, 3600)),
        btn('🗑 ลบจุดเกิดนี้ (Delete)', () => { ed.exec('ลบจุดเกิดมอน', { spawns: ed.map.spawns.filter((_, k) => k !== i) }); ed.select([]); }));
      return box;
    },
  };
}

// ---------------------------------------------------------------- boss rooms: where players appear

/**
 * The only point a boss room lets you move besides props and blockers: where players stand when they come in (docs/plans/map-editor.md,
 * boss rooms). The file keeps `zone.start`, which lies ROOM_SPAWN_OFFSET further out than the spot (Sim.spawnPoint), so the pin and the
 * numbers here are the spot itself and the tool writes `start` back. validateMap() keeps the spot inside the arena and out of collision.
 */
export function playerStartTool(): Tool {
  let drag: { before: MapPatch; moved: boolean } | null = null;
  const spotOf = (m: MapData) => roomSpawnOf(m.zone.start);
  const moved = (m: MapData, x: number, z: number): MapPatch => ({ zone: { ...m.zone, start: { x: round3(x + ROOM_SPAWN_OFFSET), z: round3(z + ROOM_SPAWN_OFFSET) } } });
  const onPin = (ed: Editor, px: number, py: number): boolean => {
    const s = spotOf(ed.map);
    const [sx, sy] = ed.toScreen(s.x, s.z);
    return Math.hypot(px - sx, py - sy) <= HIT_PX + 4;
  };
  return {
    id: 'startpin',
    label: 'จุดเกิดผู้เล่น',
    icon: '🧍',
    hint: 'ลากหมุดเขียว = ที่ที่ผู้เล่นยืนตอนเข้าห้องบอส (Alt = ปิด snap) · ต้องอยู่ในวงสนามบอส ไม่ทับของที่ชน และเดินไปถึงบอสได้ · ตำแหน่งบอส วงสนาม และขนาดห้องล็อกไว้ แก้ไม่ได้',
    pointerDown(ed, e) {
      if (!onPin(ed, e.px, e.py)) return;
      drag = { before: pick(ed.map, ['zone']), moved: false };
    },
    pointerMove(ed, e) {
      if (!drag) return;
      const [x, z] = gridSnap(ed, e.x, e.z, e.alt);
      drag.moved = true;
      ed.live(moved({ ...ed.map, ...drag.before } as MapData, x, z));
    },
    pointerUp(ed) {
      const d = drag;
      drag = null;
      if (d?.moved) ed.commitLive('ย้ายจุดเกิดผู้เล่น', d.before);
    },
    cursor: (ed, e) => (onPin(ed, e.px, e.py) ? 'move' : undefined),
    inspector(ed) {
      const s = spotOf(ed.map);
      return el('div', { class: 'me-inspector' },
        el('div', { class: 'me-title' }, 'จุดเกิดผู้เล่น (ห้องบอส)'),
        el('div', { class: 'me-grid2' },
          numField('x', s.x, (n) => ed.exec('ย้ายจุดเกิดผู้เล่น', moved(ed.map, n, s.z)), 0.5),
          numField('z', s.z, (n) => ed.exec('ย้ายจุดเกิดผู้เล่น', moved(ed.map, s.x, n)), 0.5)),
        note('ตำแหน่งบอส รัศมีสนาม และขนาดห้องเป็นค่าในโค้ด แก้ในตัวแก้ไม่ได้ · วงเหลืองประ = สนามบอส (Auto/บอสใช้) · วงแดง = ขอบที่ผู้เล่นเดินออกไม่ได้'));
    },
  };
}
