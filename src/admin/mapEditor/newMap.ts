// "＋ แมพใหม่" (tool mapCreate) and the settings card of a map made with it (owner 2026-11-21): copy a map, start from an empty floor,
// or import a JSON file; then name, floor, recommended levels, safe zone, channels, Auto Play. The server checks everything again
// (server/admin-maps.ts). A new map is a draft until it is published; players reach it through a door placed in another map.
import { EMPTY_HALF, NAME_MAX, type CustomZoneDef } from '../../shared/customZones';
import type { Api, H } from './mount';

export interface CustomInfo { def: CustomZoneDef | null; status: 'live' | 'hidden' }
const THEMES: [string, string][] = [['forest', 'ป่า'], ['marsh', 'หนอง'], ['snow', 'หิมะ'], ['volcano', 'ภูเขาไฟ']];
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const int = (v: string, d: number): number => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : d; };

/** The fields every editor-made map has (shared by the new-map form and the settings card). Returns the inputs and a reader. */
function defFields(h: H, d: Partial<CustomZoneDef>): { el: HTMLElement; read(): Omit<CustomZoneDef, 'id'> } {
  const nameTh = h('input', { type: 'text', maxlength: String(NAME_MAX), value: d.nameTh ?? '', placeholder: 'เช่น สนามวิ่งแข่ง' });
  const name = h('input', { type: 'text', maxlength: String(NAME_MAX), value: d.name ?? '', placeholder: 'เช่น Race Track (ใช้ตั้งรหัสแมพ)' });
  const floor = h('input', { type: 'number', min: '1', max: '9', step: '1', value: String(d.floor ?? 1) });
  const lo = h('input', { type: 'number', min: '1', max: '80', step: '1', value: String(d.levels?.[0] ?? 1) });
  const hi = h('input', { type: 'number', min: '1', max: '80', step: '1', value: String(d.levels?.[1] ?? 10) });
  const safe = h('input', { type: 'checkbox', checked: d.safe ?? false });
  const channels = h('input', { type: 'checkbox', checked: d.channels ?? false });
  const autoPlay = h('input', { type: 'checkbox', checked: d.autoPlay ?? true });
  return {
    el: h('div', { class: 'me-newmap-fields' },
      h('label', {}, 'ชื่อแมพ (ไทย) ', nameTh),
      h('label', {}, 'ชื่ออังกฤษ ', name),
      h('div', { class: 'row' },
        h('label', {}, 'ชั้น ', floor),
        h('label', { title: 'เลเวลแนะนำ แสดงเหมือนแมพอื่น · เลเวลขั้นต่ำที่เข้าได้ตั้งที่ประตูแต่ละบาน' }, 'เลเวลแนะนำ ', lo, ' – ', hi)),
      h('div', { class: 'row' },
        h('label', { title: 'ทั้งแมพ (หรือในกำแพงเมืองถ้าคัดลอกเมืองกลาง) ตีกันไม่ได้ มอนเข้าไม่ได้' }, safe, ' เขตปลอดภัย'),
        h('label', { title: 'แบ่งเป็น CH 1–10 แบบแมพฟาร์ม · ไม่ติ๊ก = ทุกคนอยู่ห้องเดียวกัน' }, channels, ' แชนแนล'),
        h('label', {}, autoPlay, ' ใช้ Auto Play ได้')),
    ),
    read: () => ({
      nameTh: nameTh.value.trim(), name: name.value.trim(), floor: int(floor.value, 1),
      levels: [int(lo.value, 1), int(hi.value, 10)], safe: safe.checked, channels: channels.checked, autoPlay: autoPlay.checked,
    }),
  };
}

/**
 * The "＋ แมพใหม่" form. `sources` = every map that can be copied ([id, name]); `onCreated` opens the new map.
 */
export function newMapForm(h: H, api: Api, sources: [string, string][], onCreated: (id: string) => void, onCancel: () => void): HTMLElement {
  const msg = h('div', { class: 'msg' });
  const say = (t: string, cls = ''): void => { msg.className = `msg ${cls}`; msg.textContent = t; };
  const mode = h('select', {}, h('option', { value: 'copy' }, 'คัดลอกแมพเดิม'), h('option', { value: 'empty' }, 'พื้นเปล่า'), h('option', { value: 'import' }, 'นำเข้าไฟล์ JSON'));
  const from = h('select', {}, ...sources.map(([v, t]) => h('option', { value: v }, t)));
  const theme = h('select', {}, ...THEMES.map(([v, t]) => h('option', { value: v }, t)));
  const half = h('input', { type: 'number', min: String(EMPTY_HALF.min), max: String(EMPTY_HALF.max), step: '1', value: String(EMPTY_HALF.def) });
  const file = h('input', { type: 'file', accept: '.json,application/json' });
  const copyRow = h('div', { class: 'row' }, h('label', {}, 'ต้นฉบับ ', from),
    h('span', { class: 'muted me-hint' }, 'ได้ผังตามที่เผยแพร่อยู่ (ยังไม่เคยเผยแพร่ = ไฟล์ในเกม) · ห้องบอสกลายเป็นแมพธรรมดา ไม่มีบอส · NPC และที่เรียกบอสไม่ติดมา'));
  const emptyRow = h('div', { class: 'row' }, h('label', {}, 'ธีม ', theme),
    h('label', { title: `ครึ่งความกว้าง ${EMPTY_HALF.min}–${EMPTY_HALF.max} หน่วยโลก (แมพฟาร์มประมาณ 100)` }, 'ครึ่งความกว้าง ', half, ' หน่วย'));
  const importRow = h('div', { class: 'row' }, h('label', {}, 'ไฟล์ ', file),
    h('span', { class: 'muted me-hint' }, 'ไฟล์ JSON ของตัวแก้แมพ (เช่น ที่ได้จาก 📦 ส่งออก) · บอสและ NPC ไม่ติดมา'));
  const showMode = (): void => {
    copyRow.style.display = mode.value === 'copy' ? '' : 'none';
    emptyRow.style.display = mode.value === 'empty' ? '' : 'none';
    importRow.style.display = mode.value === 'import' ? '' : 'none';
  };
  mode.addEventListener('change', showMode);
  showMode();
  const fields = defFields(h, {});
  const create = h('button', { class: 'primary', onclick: async () => {
    const def = fields.read();
    if (!def.nameTh) { say('ใส่ชื่อแมพ (ไทย) ก่อน', 'bad'); return; }
    const body: Record<string, unknown> = { mode: mode.value, def };
    try {
      if (mode.value === 'copy') body.from = from.value;
      if (mode.value === 'empty') { body.theme = theme.value; body.half = int(half.value, EMPTY_HALF.def); }
      if (mode.value === 'import') {
        const f = file.files?.[0];
        if (!f) { say('เลือกไฟล์ก่อน', 'bad'); return; }
        try { body.map = JSON.parse(await f.text()); } catch { say('ไฟล์นี้อ่านเป็น JSON ไม่ได้', 'bad'); return; }
      }
      create.disabled = true;
      say('กำลังสร้าง…');
      const r = await api<{ id: string }>('POST', '/admin/maps/new', body);
      say(`สร้างแมพ ${r.id} แล้ว (ยังเป็นร่าง ผู้เล่นยังไม่เห็นจนกว่าจะเผยแพร่)`, 'good');
      onCreated(r.id);
    } catch (e) {
      say(errText(e), 'bad');
    } finally {
      create.disabled = false;
    }
  } }, '＋ สร้างแมพ');
  return h('div', { class: 'me-newmap' },
    h('h4', {}, '＋ แมพใหม่'),
    h('label', {}, 'วิธีสร้าง ', mode), copyRow, emptyRow, importRow,
    fields.el,
    h('div', { class: 'muted me-hint' }, 'แมพใหม่เป็นร่างก่อน แก้ได้ทุกอย่างด้วยเครื่องมือเดิม กด 🚀 เผยแพร่ แล้ววางประตู (📍 ＋ เพิ่มประตู) ในแมพอื่นชี้มาที่แมพนี้ ผู้เล่นถึงจะเข้าได้ · ยังไม่มีบอสและ NPC ในแมพที่สร้างเอง'),
    h('div', { class: 'row' }, create, h('button', { onclick: onCancel }, 'ยกเลิก')),
    msg,
  );
}

/** The settings card of an editor-made map: its fields, hide / show, delete. `onChanged` reloads the page's list. */
export function customSettings(h: H, api: Api, id: string, info: CustomInfo, published: boolean, perms: { create: boolean; del: boolean }, onChanged: () => void, onDeleted: () => void): HTMLElement {
  const msg = h('div', { class: 'msg' });
  const say = (t: string, cls = ''): void => { msg.className = `msg ${cls}`; msg.textContent = t; };
  const d = info.def ?? { id, name: '', nameTh: id, floor: 1, levels: [1, 10] as [number, number], safe: false, channels: false, autoPlay: true };
  const fields = defFields(h, d);
  const state = info.status === 'hidden' ? 'ซ่อนอยู่ (ผู้เล่นเข้าไม่ได้ ประตูที่ชี้มาไม่ทำงาน)' : published ? 'อยู่ในเกม (เข้าผ่านประตูที่ชี้มา)' : 'ยังไม่เผยแพร่ (ผู้เล่นยังไม่เห็น)';
  const act = (fn: () => Promise<string>) => async (): Promise<void> => {
    try {
      const t = await fn();
      if (!t) return; // cancelled
      say(t, 'good');
      onChanged();
    } catch (e) { say(errText(e), 'bad'); }
  };
  const save = h('button', { class: 'primary', disabled: !perms.create, onclick: act(async () => {
    const def = fields.read();
    if (!confirm(`บันทึกค่าของแมพ "${def.nameTh}"?\n\nห้องที่เปิดใหม่ใช้ทันที ห้องที่มีคนอยู่ใช้ตอนเข้าแมพครั้งถัดไป`)) return '';
    await api('PUT', `/admin/maps/${id}/settings`, { def: { ...def, id } });
    return 'บันทึกค่าแมพแล้ว';
  }) }, '💾 บันทึกค่าแมพ');
  const hidden = info.status === 'hidden';
  const hide = h('button', { disabled: !perms.create, onclick: act(async () => {
    if (!confirm(hidden ? `เปิดแมพ "${d.nameTh}" กลับเข้าเกม?` : `ซ่อนแมพ "${d.nameTh}"?\n\nผู้เล่นที่อยู่ในแมพนี้จะถูกย้ายไปเมืองกลางทันที ประตูที่ชี้มาจะไม่ทำงานจนกว่าจะเปิดกลับ ร่างและประวัติยังอยู่`)) return '';
    const r = await api<{ moved: number }>('POST', `/admin/maps/${id}/hide`, { hidden: !hidden });
    return hidden ? 'เปิดแมพกลับเข้าเกมแล้ว' : `ซ่อนแมพแล้ว${r.moved ? ` (ย้ายผู้เล่น ${r.moved} คนไปเมืองกลาง)` : ''}`;
  }) }, hidden ? '👁 เปิดกลับเข้าเกม' : '🙈 ซ่อนจากเกม');
  const del = h('button', { class: 'danger', disabled: !perms.del, onclick: async () => {
    if (!confirm(`ลบแมพ "${d.nameTh}" ถาวร?\n\nร่าง ประวัติทุก revision และค่าแมพหายหมด กู้คืนไม่ได้ (ยกเว้นจากไฟล์สำรอง DB)\nผู้เล่นที่อยู่ในแมพนี้ถูกย้ายไปเมืองกลาง`)) return;
    if (prompt(`พิมพ์รหัสแมพ ${id} เพื่อยืนยันการลบ`) !== id) { say('รหัสไม่ตรง ไม่ได้ลบ', 'warn'); return; }
    try {
      const r = await api<{ moved: number }>('DELETE', `/admin/maps/${id}`);
      say(`ลบแมพแล้ว${r.moved ? ` (ย้ายผู้เล่น ${r.moved} คนไปเมืองกลาง)` : ''}`, 'good');
      onDeleted();
    } catch (e) {
      say(errText(e), 'bad');
    }
  } }, '🗑 ลบแมพนี้');
  return h('div', { class: 'me-mapset' },
    h('h4', {}, `⚙️ ตั้งค่าแมพ (สร้างเอง · ${id})`),
    h('div', { class: 'muted' }, `สถานะ: ${state}`),
    fields.el,
    h('div', { class: 'row' }, save, hide, del),
    !perms.create ? h('div', { class: 'muted me-hint' }, 'ต้องมีสิทธิ์ "สร้างแมพใหม่" เพื่อแก้ค่า/ซ่อน') : null,
    msg,
  );
}
