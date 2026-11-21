// The /admin "แมพ" tab (docs/plans/map-editor.md): the map editor (permission mapEdit, src/admin/mapEditor/) and the switch
// "ใช้แมพจาก DB". The switch is stored with the balance settings (BalanceTuning.mapFromDb), so it uses the same permission,
// audit and "only what differs from the code" storage as the balance tab.
import { mountMapEditor } from './mapEditor/mount';
import { CODE_MAP_FROM_DB, mergeBalance, type BalanceTuning } from '../shared/balance';
import { codeWaves, WAVE_NUMS, type WaveConfig, type WaveTuning } from '../shared/waveGame';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

/** What the signed-in role may do here: the switch needs balance, the editor needs mapEdit. */
export interface MapsPerms { balance: boolean; mapEdit: boolean; mapRollback?: boolean; mapExport?: boolean; mapCreate?: boolean; mapDelete?: boolean }

/** Stops the editor's key listeners and saves its last edits when the tab is left (the page calls the old one before drawing a new tab). */
let stopEditor: (() => void) | null = null;

export async function renderMaps(view: HTMLElement, h: H, api: Api, onSaved: (tuning: BalanceTuning) => void, perms: MapsPerms): Promise<void> {
  stopEditor?.();
  stopEditor = null;
  const editorBox = h('div', { class: 'card me-card' });
  const switchBox = h('div', { class: 'card' });
  const wavesBox = h('div', { class: 'card' });
  view.replaceChildren(
    h('h2', {}, 'แมพ'),
    ...(perms.mapEdit ? [editorBox] : []),
    ...(perms.balance ? [switchBox, wavesBox] : []),
    ...(!perms.mapEdit && !perms.balance ? [h('div', { class: 'msg bad' }, 'ไม่มีสิทธิ์ในหน้านี้')] : []),
  );
  if (perms.mapEdit) stopEditor = mountMapEditor(editorBox, h, api, { rollback: !!perms.mapRollback, export: !!perms.mapExport, create: !!perms.mapCreate, del: !!perms.mapDelete });
  if (perms.balance) {
    await renderSwitch(switchBox, h, api, onSaved);
    await renderWaves(wavesBox, h, api, onSaved);
  }
}

/**
 * The card "มินิเกม: รอดมอนเป็นระลอก" (owner 2026-11-21): the switch and every number of the minigame, server-wide. Stored with the
 * balance settings (BalanceTuning.waves, only what differs from the code), so it uses the balance permission and its audit.
 */
async function renderWaves(view: HTMLElement, h: H, api: Api, onSaved: (tuning: BalanceTuning) => void): Promise<void> {
  view.replaceChildren(h('div', { class: 'muted' }, 'กำลังโหลด…'));
  let saved: BalanceTuning;
  try {
    saved = (await api<{ tuning: BalanceTuning }>('GET', '/admin/balance')).tuning;
  } catch (e) {
    view.replaceChildren(h('div', { class: 'msg bad' }, e instanceof Error ? e.message : String(e)));
    return;
  }
  const code = codeWaves();
  const cur = mergeBalance(saved).waves;
  const msg = h('div', { class: 'msg' });
  const on = h('input', { type: 'checkbox', checked: cur.on });
  const keys = Object.keys(WAVE_NUMS) as Exclude<keyof WaveConfig, 'on'>[];
  const inputs = Object.fromEntries(keys.map((k) => [k, h('input', { type: 'number', step: '1', min: String(WAVE_NUMS[k].range[0]), max: String(WAVE_NUMS[k].range[1]), value: String(cur[k]) })])) as Record<string, HTMLInputElement>;
  const send = async (waves: WaveTuning | undefined, text: string): Promise<void> => {
    if (!confirm(text)) return;
    const tuning: BalanceTuning = { ...saved };
    if (waves && Object.keys(waves).length) tuning.waves = waves;
    else delete tuning.waves;
    msg.className = 'msg';
    msg.textContent = 'กำลังบันทึก…';
    try {
      saved = (await api<{ tuning: BalanceTuning }>('POST', '/admin/balance', { tuning, part: 'rest' })).tuning;
      onSaved(saved);
      await renderWaves(view, h, api, onSaved);
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = e instanceof Error ? e.message : String(e);
    }
  };
  const save = h('button', { class: 'primary', onclick: () => {
    const w: WaveTuning = {};
    if (on.checked !== code.on) w.on = on.checked;
    for (const k of keys) {
      const n = Number(inputs[k].value);
      if (Number.isFinite(n) && n !== code[k]) w[k] = n;
    }
    void send(w, 'บันทึกค่ามินิเกม "รอดมอนเป็นระลอก" ทั้งเซิร์ฟเลยไหม?\n\nห้องที่เริ่มใหม่ใช้ค่าใหม่ ห้องที่กำลังเล่นอยู่ใช้ค่าเดิมจนจบ');
  } }, '💾 บันทึก');
  const reset = h('button', { onclick: () => void send(undefined, 'คืนค่ามินิเกม "รอดมอนเป็นระลอก" เป็นค่าในโค้ดทั้งหมด?') }, '↺ คืนค่าในโค้ด');
  view.replaceChildren(
    h('h3', {}, 'มินิเกม: รอดมอนเป็นระลอก'),
    h('div', { class: 'muted me-hint' }, 'แมพที่สร้างเองซึ่งตั้งค่าแมพเป็นมินิเกมนี้: เข้าทางประตูแล้วได้ห้องของกลุ่มตัวเอง มอนออกเป็นระลอกจากจุดเกิดระลอก ผ่านแต่ละระลอกได้ทอง (ทองต่อระลอก × เลขระลอก) ผ่านครบได้โบนัส มอนในระลอกให้ EXP ไม่ดรอปของ · ตายหมดทีมมีเวลาชุบตาม "เวลาชุบตอนตายหมดทีม" ในแท็บปรับสมดุล · ค่าในวงเล็บ = ค่าในโค้ด'),
    h('div', { class: 'row bal-line' }, h('label', { title: `ค่าในโค้ด: ${code.on ? 'เปิด' : 'ปิด'}` }, on, ' เปิดมินิเกมนี้ (ปิด = ประตูเข้าแมพมินิเกมบอกว่าปิดอยู่)')),
    h('div', { class: 'me-grid2' }, ...keys.map((k) => h('label', { title: `${WAVE_NUMS[k].range[0]}–${WAVE_NUMS[k].range[1]}` }, `${WAVE_NUMS[k].name} (${code[k]}) `, inputs[k]))),
    h('div', { class: 'row' }, save, reset, msg),
  );
}

async function renderSwitch(view: HTMLElement, h: H, api: Api, onSaved: (tuning: BalanceTuning) => void): Promise<void> {
  view.replaceChildren(h('div', { class: 'muted' }, 'กำลังโหลด…'));
  let saved: BalanceTuning;
  try {
    saved = (await api<{ tuning: BalanceTuning }>('GET', '/admin/balance')).tuning;
  } catch (e) {
    view.replaceChildren(h('div', { class: 'msg bad' }, e instanceof Error ? e.message : String(e)));
    return;
  }
  const msg = h('div', { class: 'msg' });
  const box = h('input', { type: 'checkbox', checked: mergeBalance(saved).mapFromDb });
  const save = h('button', { class: 'primary', onclick: async () => {
    const on = box.checked;
    // The whole tuning is sent back with only this value changed (the server stores only what differs from the code).
    const tuning: BalanceTuning = { ...saved };
    if (on === CODE_MAP_FROM_DB) delete tuning.mapFromDb;
    else tuning.mapFromDb = on;
    if (!confirm(`ใช้แมพจาก DB ${on ? 'เปิด' : 'ปิด'} ทั้งเซิร์ฟเลยไหม?`)) return;
    msg.className = 'msg';
    msg.textContent = 'กำลังบันทึก…';
    try {
      saved = (await api<{ tuning: BalanceTuning }>('POST', '/admin/balance', { tuning, part: 'rest' })).tuning;
      onSaved(saved);
      msg.className = 'msg good';
      msg.textContent = 'บันทึกแล้ว';
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = e instanceof Error ? e.message : String(e);
    }
  } }, '💾 บันทึก');
  view.replaceChildren(
    h('h3', {}, 'ที่มาของแมพ'),
    h('div', { class: 'row bal-line' },
      h('label', { title: 'ค่าในโค้ด: เปิด' }, box,
        ' ใช้แมพจาก DB (เมื่อมีตัวแก้แมพ แมพที่เจ้าของเผยแพร่แล้วจะแทนที่ไฟล์ JSON ที่มากับเกม · ปิด = ใช้ไฟล์ JSON ในเกมเสมอ ทางหนีฉุกเฉินถ้าแมพที่เผยแพร่พัง · มีผลกับห้องที่เปิดใหม่ ห้องที่มีคนอยู่ใช้ตอนผู้เล่นเข้าแมพครั้งถัดไป)')),
    h('div', { class: 'row' }, save, msg),
  );
}
