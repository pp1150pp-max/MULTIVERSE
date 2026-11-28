// The "ล็อกอินรายวัน" tab (owner): the milestone bonuses (7, 15, 30 days) and the reward of each day of the month.
// Only what differs from the code (src/shared/daily.ts) is stored; a change applies to rewards sent after saving.
import {
  DAILY_BONUS_DAYS, DAILY_BONUS_KINDS, DAILY_COUNT_MAX, DAILY_KINDS, type BonusConfig, type DailyOverrides, type DailyReward,
} from '../shared/daily';
import { STONE_NAME, stoneStackMax } from '../shared/data/stones';
import type { StoneKind } from '../shared/types';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

interface DailyState { defaults: DailyReward[]; overrides: DailyOverrides; bonus: BonusConfig; bonusDefault: BonusConfig }

function bonusCard(h: H, api: Api, state: DailyState): HTMLElement {
  const msg = h('div', { class: 'msg' });
  const check = (on: boolean) => Object.assign(h('input', { type: 'checkbox' }), { checked: on });
  const master = check(state.bonus.on);
  const rows = state.bonus.tiers.map((t) => ({
    on: check(t.on),
    counts: DAILY_BONUS_KINDS.map((k) => h('input', { type: 'number', min: '0', max: String(stoneStackMax(k)), value: String(t[k]), style: 'width:70px' })),
  }));
  const fill = (c: BonusConfig): void => {
    master.checked = c.on;
    rows.forEach((r, i) => {
      r.on.checked = c.tiers[i].on;
      r.counts.forEach((input, k) => (input.value = String(c.tiers[i][DAILY_BONUS_KINDS[k]])));
    });
  };
  const save = async (bonus: unknown): Promise<void> => {
    try {
      state.bonus = (await api<{ bonus: BonusConfig }>('POST', '/admin/daily-bonus', { bonus })).bonus;
      fill(state.bonus);
      msg.className = 'msg ok';
      msg.textContent = 'บันทึกแล้ว — มีผลกับโบนัสที่ส่งหลังจากนี้';
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
    }
  };
  const read = () => ({
    on: master.checked,
    tiers: rows.map((r) => ({ on: r.on.checked, ...Object.fromEntries(DAILY_BONUS_KINDS.map((k, i) => [k, Number(r.counts[i].value)])) })),
  });
  return h('div', { class: 'card' },
    h('h2', {}, 'โบนัสสะสม 7 / 15 / 30 วัน'),
    h('div', { class: 'muted' }, 'นับวันที่ได้ของในเดือนนั้น (รวมวันชดเชย) ได้ขั้นละครั้งต่อเดือน ส่งเข้ากล่องจดหมาย · เดือนที่สั้นกว่าขั้น 30 ใช้ครบทุกวันของเดือน · จำนวน 0 = ไม่ให้ · คนที่ครบแล้วแต่ยังไม่ได้ (เช่นเพิ่งเปิดสวิตช์) จะได้ตอนเข้าเกมครั้งถัดไปในเดือนนั้น'),
    h('label', { style: 'display:flex;gap:6px;margin:8px 0' }, master, 'เปิดโบนัสสะสม'),
    h('table', {},
      h('tr', {}, h('th', {}, 'ขั้น'), h('th', {}, 'เปิด'), ...DAILY_BONUS_KINDS.map((k) => h('th', {}, STONE_NAME[k]))),
      ...rows.map((r, i) => h('tr', {}, h('td', {}, `${DAILY_BONUS_DAYS[i]} วัน`), h('td', {}, r.on), ...r.counts.map((c) => h('td', {}, c))))),
    h('div', { style: 'display:flex;gap:8px;margin-top:8px' },
      h('button', { class: 'primary', onclick: () => void save(read()) }, 'บันทึกโบนัส'),
      h('button', { onclick: () => confirm('คืนโบนัสเป็นค่าในโค้ด?') && void save(state.bonusDefault) }, 'คืนค่าในโค้ด')),
    msg);
}

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
  box.replaceChildren(bonusCard(h, api, state), h('div', { class: 'card' },
    h('h2', {}, 'ของรางวัลล็อกอินรายวัน'),
    h('div', { class: 'muted' }, 'ใช้ตารางเดียวกันทุกเดือน (เดือนที่มีไม่ถึง 31 วันใช้แค่วันที่มี) · ช่องที่ต่างจากค่าในโค้ดมีกรอบเหลือง · ของถูกส่งเข้ากล่องจดหมายของบัญชี'),
    table, h('div', { style: 'display:flex;gap:8px;margin-top:8px' }, saveBtn, resetBtn), msg));
}
