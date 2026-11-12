// The "ล็อกอินรายวัน" tab (owner): the reward of each day of the month. Only days that differ from the code
// (DAILY_DEFAULT in src/shared/daily.ts) are stored; a change applies to rewards sent after saving.
import { DAILY_COUNT_MAX, DAILY_KINDS, type DailyOverrides, type DailyReward } from '../shared/daily';
import { STONE_NAME } from '../shared/data/stones';
import type { StoneKind } from '../shared/types';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

interface DailyState { defaults: DailyReward[]; overrides: DailyOverrides }

export async function renderDaily(view: HTMLElement, h: H, api: Api): Promise<void> {
  const box = h('div', {}, h('div', { class: 'muted' }, 'กำลังโหลด…'));
  view.append(box);
  let state: DailyState;
  try {
    state = await api<DailyState>('GET', '/admin/daily');
  } catch (e) {
    box.replaceChildren(h('div', { class: 'msg bad' }, `โหลดไม่สำเร็จ: ${(e as Error).message}`));
    return;
  }
  const msg = h('div', { class: 'msg' });
  const rows: { day: number; kind: HTMLSelectElement; count: HTMLInputElement }[] = [];
  const table = h('table', {}, h('tr', {}, h('th', {}, 'วันที่'), h('th', {}, 'ของ'), h('th', {}, 'จำนวน'), h('th', {}, 'ค่าในโค้ด')));
  const draw = (): void => {
    rows.length = 0;
    table.replaceChildren(table.firstChild!);
    state.defaults.forEach((def, i) => {
      const day = i + 1;
      const cur = state.overrides[String(day)] ?? def;
      const kind = h('select', {}, ...DAILY_KINDS.map((k) => h('option', { value: k }, STONE_NAME[k])));
      kind.value = cur.stone;
      const count = h('input', { type: 'number', min: '1', max: String(DAILY_COUNT_MAX), value: String(cur.count), style: 'width:60px' });
      const mark = () => {
        const changed = kind.value !== def.stone || Number(count.value) !== def.count;
        kind.style.outline = count.style.outline = changed ? '1px solid #f2c230' : '';
      };
      kind.onchange = mark;
      count.oninput = mark;
      mark();
      rows.push({ day, kind, count });
      table.append(h('tr', {}, h('td', {}, String(day)), h('td', {}, kind), h('td', {}, count), h('td', { class: 'muted' }, `${STONE_NAME[def.stone]} ×${def.count}`)));
    });
  };
  const save = async (overrides: Record<string, { stone: StoneKind; count: number }>): Promise<void> => {
    try {
      state = await api<DailyState>('POST', '/admin/daily', { overrides });
      draw();
      msg.className = 'msg ok';
      msg.textContent = 'บันทึกแล้ว — มีผลกับของที่ส่งหลังจากนี้';
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
    }
  };
  const saveBtn = h('button', { class: 'primary', onclick: () => {
    const o: Record<string, { stone: StoneKind; count: number }> = {};
    for (const r of rows) o[String(r.day)] = { stone: r.kind.value as StoneKind, count: Number(r.count.value) };
    void save(o);
  } }, 'บันทึก');
  const resetBtn = h('button', { onclick: () => confirm('คืนของทุกวันเป็นค่าในโค้ด?') && void save({}) }, 'คืนค่าในโค้ดทั้งหมด');
  draw();
  box.replaceChildren(h('div', { class: 'card' },
    h('h2', {}, 'ของรางวัลล็อกอินรายวัน'),
    h('div', { class: 'muted' }, 'ใช้ตารางเดียวกันทุกเดือน (เดือนที่มีไม่ถึง 31 วันใช้แค่วันที่มี) · ช่องที่ต่างจากค่าในโค้ดมีกรอบเหลือง · ของถูกส่งเข้ากล่องจดหมายของบัญชี'),
    table, h('div', { style: 'display:flex;gap:8px;margin-top:8px' }, saveBtn, resetBtn), msg));
}
