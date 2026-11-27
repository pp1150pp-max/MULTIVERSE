// The /admin "แมพ" tab (docs/plans/map-editor.md): the map editor (permission mapEdit, src/admin/mapEditor/) and the switch
// "ใช้แมพจาก DB". The switch is stored with the balance settings (BalanceTuning.mapFromDb), so it uses the same permission,
// audit and "only what differs from the code" storage as the balance tab.
import { mountMapEditor } from './mapEditor/mount';
import { CODE_MAP_FROM_DB, mergeBalance, type BalanceTuning } from '../shared/balance';
import { codeWaves, WAVE_NUMS, type WaveConfig, type WaveTuning } from '../shared/waveGame';
import { chestOdds, codeTreasure, TREASURE_NUMS, type ChestRowTuning, type TreasureConfig, type TreasureTuning } from '../shared/treasure';
import { fmtPct } from '../shared/mysteryBox';

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
  const treasureBox = h('div', { class: 'card' });
  view.replaceChildren(
    h('h2', {}, 'แมพ'),
    ...(perms.mapEdit ? [editorBox] : []),
    ...(perms.balance ? [switchBox, treasureBox, wavesBox] : []),
    ...(!perms.mapEdit && !perms.balance ? [h('div', { class: 'msg bad' }, 'ไม่มีสิทธิ์ในหน้านี้')] : []),
  );
  if (perms.mapEdit) stopEditor = mountMapEditor(editorBox, h, api, { rollback: !!perms.mapRollback, export: !!perms.mapExport, create: !!perms.mapCreate, del: !!perms.mapDelete });
  if (perms.balance) {
    await renderSwitch(switchBox, h, api, onSaved);
    await renderTreasure(treasureBox, h, api, onSaved);
    await renderWaves(wavesBox, h, api, onSaved);
  }
}

/**
 * The card "หีบสมบัติ + ศาลเจ้า" (owner 2026-11-27, docs/systems/chests-shrines.md): the two switches, every number and the chest
 * table, server-wide. Where chests and shrines stand is edited in the map editor above (📍 tool). Stored with the balance settings
 * (BalanceTuning.treasure, only what differs from the code), so it uses the balance permission and its audit.
 */
async function renderTreasure(view: HTMLElement, h: H, api: Api, onSaved: (tuning: BalanceTuning) => void): Promise<void> {
  view.replaceChildren(h('div', { class: 'muted' }, 'กำลังโหลด…'));
  let saved: BalanceTuning;
  try {
    saved = (await api<{ tuning: BalanceTuning }>('GET', '/admin/balance')).tuning;
  } catch (e) {
    view.replaceChildren(h('div', { class: 'msg bad' }, e instanceof Error ? e.message : String(e)));
    return;
  }
  const code = codeTreasure();
  const cur = mergeBalance(saved).treasure;
  const msg = h('div', { class: 'msg' });
  const chestsOn = h('input', { type: 'checkbox', checked: cur.chests });
  const shrinesOn = h('input', { type: 'checkbox', checked: cur.shrines });
  const keys = Object.keys(TREASURE_NUMS) as (keyof typeof TREASURE_NUMS)[];
  const inputs = Object.fromEntries(keys.map((k) => {
    const d = TREASURE_NUMS[k];
    return [k, h('input', { type: 'number', step: String(d.step), min: String(d.range[0]), max: String(d.range[1]), value: String(cur[k]) })];
  })) as Record<string, HTMLInputElement>;
  // The chest table: on/off, % (empty = shares what is left) and how many, per row; the real odds update as you type.
  const rowInputs = cur.rows.map((r) => ({
    id: r.id,
    on: h('input', { type: 'checkbox', checked: r.on }),
    pct: h('input', { type: 'number', step: '0.01', min: '0', max: '100', value: r.pct === null ? '' : String(r.pct), placeholder: 'แบ่งที่เหลือ', style: 'width:7em' }),
    count: h('input', { type: 'number', step: '1', min: '1', max: r.prize.kind === 'gear' ? '1' : '10', value: String(r.count), style: 'width:4em', disabled: r.prize.kind === 'gear' }),
    real: h('span', { class: 'muted' }),
  }));
  /** The table as typed (bad numbers fall back to the code's). */
  const typedRows = (): TreasureConfig['rows'] => code.rows.map((d, i) => {
    const x = rowInputs[i];
    const p = x.pct.value.trim() === '' ? null : Number(x.pct.value);
    const n = Number(x.count.value);
    return { ...d, on: x.on.checked, pct: p === null || Number.isFinite(p) ? p : d.pct, count: Number.isInteger(n) && n >= 1 ? n : d.count };
  });
  const sumNote = h('div', { class: 'muted' });
  const showOdds = (): void => {
    const rows = typedRows();
    const odds = chestOdds({ ...code, rows }, true);
    rowInputs.forEach((x) => {
      const o = odds.find((y) => y.row.id === x.id);
      x.real.textContent = o ? `จริง ${fmtPct(o.pct)}` : 'ไม่ออก';
    });
    const fixed = rows.filter((r) => r.on && r.pct !== null).reduce((a, r) => a + (r.pct ?? 0), 0);
    sumNote.textContent = `โอกาสที่ตั้งไว้รวม ${+fixed.toFixed(4)}%${fixed > 100 ? ' — เกิน 100% บันทึกไม่ได้' : ''} · แถวที่เว้นว่างแบ่งส่วนที่เหลือเท่า ๆ กัน · "จริง" = โอกาสบนแมพที่มีกุญแจบอส (แมพไม่มีบอส แถวกุญแจไม่ออก ส่วนของมันไปแถวที่แบ่งส่วนที่เหลือ)`;
  };
  for (const x of rowInputs) for (const el of [x.on, x.pct, x.count]) el.addEventListener('input', showOdds);
  showOdds();
  const send = async (t: TreasureTuning | undefined, text: string): Promise<void> => {
    if (!confirm(text)) return;
    const tuning: BalanceTuning = { ...saved };
    if (t && Object.keys(t).length) tuning.treasure = t;
    else delete tuning.treasure;
    msg.className = 'msg';
    msg.textContent = 'กำลังบันทึก…';
    try {
      saved = (await api<{ tuning: BalanceTuning }>('POST', '/admin/balance', { tuning, part: 'rest' })).tuning;
      onSaved(saved);
      await renderTreasure(view, h, api, onSaved);
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = e instanceof Error ? e.message : String(e);
    }
  };
  const save = h('button', { class: 'primary', onclick: () => {
    const t: TreasureTuning = {};
    if (chestsOn.checked !== code.chests) t.chests = chestsOn.checked;
    if (shrinesOn.checked !== code.shrines) t.shrines = shrinesOn.checked;
    for (const k of keys) {
      const n = Number(inputs[k].value);
      if (Number.isFinite(n) && n !== code[k]) t[k] = n;
    }
    const rows: Record<string, ChestRowTuning> = {};
    typedRows().forEach((r, i) => {
      const d = code.rows[i];
      const o: ChestRowTuning = {};
      if (r.on !== d.on) o.on = r.on;
      if (r.pct !== d.pct) o.pct = r.pct;
      if (r.count !== d.count) o.count = r.count;
      if (Object.keys(o).length) rows[d.id] = o;
    });
    if (Object.keys(rows).length) t.rows = rows;
    void send(t, 'บันทึกค่า "หีบสมบัติ + ศาลเจ้า" ทั้งเซิร์ฟเลยไหม?\n\nมีผลทันที (หีบที่ถูกเปิดไปแล้วนับเวลาเกิดใหม่ตามค่าเดิมจนกลับมา บัฟที่ได้ไปแล้วใช้ค่าเดิมจนหมด)');
  } }, '💾 บันทึก');
  const reset = h('button', { onclick: () => void send(undefined, 'คืนค่า "หีบสมบัติ + ศาลเจ้า" เป็นค่าในโค้ดทั้งหมด?') }, '↺ คืนค่าในโค้ด');
  const codeRow = (i: number) => {
    const d = code.rows[i];
    return `${d.pct === null ? 'แบ่งที่เหลือ' : `${d.pct}%`}${d.prize.kind === 'gear' ? '' : ` ×${d.count}`}`;
  };
  view.replaceChildren(
    h('h3', {}, 'หีบสมบัติ + ศาลเจ้า'),
    h('div', { class: 'muted me-hint' }, 'วางจุดหีบ/ศาลในตัวแก้แมพด้านบน (เครื่องมือ 📍 NPC / ประตู → "＋ เพิ่มหีบสมบัติ" / "＋ เพิ่มศาลเจ้า" เฉพาะแมพฟาร์มชั้น 1) · หีบ: คนแรกที่เปิดได้ทอง + ของ 1 อย่างจากตาราง แล้วหีบหายไปจนเกิดใหม่ · ศาล: แตะแล้วได้บัฟ 1 อย่าง (ตามที่ตั้งในศาล หรือสุ่ม) ใช้ศาลเดิมซ้ำได้ตามคูลดาวน์ต่อคน · Auto Play ไม่เปิดหีบ/ไม่ใช้ศาล · Guest ใช้ได้ · ค่าในวงเล็บ = ค่าในโค้ด'),
    h('div', { class: 'row bal-line' },
      h('label', { title: `ค่าในโค้ด: ${code.chests ? 'เปิด' : 'ปิด'}` }, chestsOn, ' เปิดหีบสมบัติ (ปิด = หีบไม่แสดง เปิดไม่ได้)'),
      h('label', { title: `ค่าในโค้ด: ${code.shrines ? 'เปิด' : 'ปิด'}` }, shrinesOn, ' เปิดศาลเจ้า (ปิด = ใช้ไม่ได้ บัฟที่ได้ไปแล้วอยู่จนหมดเวลา)')),
    h('div', { class: 'me-grid2' }, ...keys.map((k) => h('label', { title: `${TREASURE_NUMS[k].range[0]}–${TREASURE_NUMS[k].range[1]}` }, `${TREASURE_NUMS[k].name} (${code[k]}) `, inputs[k]))),
    h('h4', {}, 'ของในหีบ (ได้ทองทุกหีบ + สุ่ม 1 แถว)'),
    h('table', { class: 'tbl' },
      h('tr', {}, h('th', {}, 'เปิด'), h('th', {}, 'ของ'), h('th', {}, 'โอกาส %'), h('th', {}, 'จำนวน'), h('th', {}, ''), h('th', {}, 'ค่าในโค้ด')),
      ...rowInputs.map((x, i) => h('tr', {}, h('td', {}, x.on), h('td', {}, code.rows[i].name), h('td', {}, x.pct), h('td', {}, x.count), h('td', {}, x.real), h('td', { class: 'muted' }, codeRow(i))))),
    sumNote,
    h('div', { class: 'muted' }, 'อุปกรณ์สุ่มตามเลเวลของคนเปิด (ไม่เกินช่วงเลเวลของแมพ) และอาชีพของคนเปิด · กุญแจ = กุญแจบอสของแมพนั้น · กระเป๋าเต็ม = ของตกที่หีบ เก็บได้เฉพาะคนเปิด'),
    h('div', { class: 'row' }, save, reset, msg),
  );
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
