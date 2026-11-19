// The "จัดเมนูเกม" tab: which buttons the in-game menu window and the top-right icon row show, in what order
// (src/shared/menuLayout.ts). Each place is a list: drag a row (or use ↑ ↓), ⇄ moves it to the other place, ✕ hides it
// there. Buttons the player must always have (เมนู, ตั้งค่า, AUTO) can't be removed; เมนู and ตั้งค่า stay last.
import type { AdminMenuLayout } from '../shared/admin';
import { codeMenuLayout, MENU_ENTRIES, MENU_PLACE_NAME, menuEntry, type MenuLayoutConfig, type MenuPlace } from '../shared/menuLayout';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

const PLACES: MenuPlace[] = ['menu', 'top'];
const other = (p: MenuPlace): MenuPlace => (p === 'menu' ? 'top' : 'menu');
const label = (id: string): string => menuEntry(id)?.label ?? id;

export async function renderMenuLayout(view: HTMLElement, h: H, api: Api, onSaved: (layout: MenuLayoutConfig) => void): Promise<void> {
  const box = h('div', {}, h('div', { class: 'muted' }, 'กำลังโหลด…'));
  view.append(box);
  let state: AdminMenuLayout;
  try {
    state = await api<AdminMenuLayout>('GET', '/admin/menu-layout');
  } catch (e) {
    box.replaceChildren(h('div', { class: 'msg bad' }, `โหลดไม่สำเร็จ: ${(e as Error).message}`));
    return;
  }
  const code = codeMenuLayout();
  let draft: MenuLayoutConfig = structuredClone(state.layout);
  const msg = h('div', { class: 'msg' });
  const lists = h('div', { class: 'ml-lists' });
  const spare = h('div', { class: 'ml-spare' });
  const saveBtn = h('button', { class: 'primary' }, 'บันทึก');
  const resetBtn = h('button', {}, 'คืนค่าในโค้ดทั้งหมด');
  const dirtyNote = h('span', { class: 'muted' });

  /** The ids a player may reorder: all but the one pinned to the end (shown locked under the list). */
  const lastId = (p: MenuPlace): string | undefined => MENU_ENTRIES.find((e) => e.last && e.only === p)?.id;
  const movable = (p: MenuPlace): string[] => draft[p].filter((id) => id !== lastId(p));
  const setMovable = (p: MenuPlace, ids: string[]): void => {
    const last = lastId(p);
    draft[p] = last ? [...ids, last] : ids;
  };
  const move = (p: MenuPlace, from: number, to: number): void => {
    const ids = movable(p);
    if (to < 0 || to >= ids.length || from === to) return;
    const [x] = ids.splice(from, 1);
    ids.splice(to, 0, x);
    setMovable(p, ids);
    draw();
  };
  const remove = (p: MenuPlace, id: string): void => {
    setMovable(p, movable(p).filter((i) => i !== id));
    draw();
  };
  const add = (p: MenuPlace, id: string): void => {
    if (!draft[p].includes(id)) setMovable(p, [...movable(p), id]);
    draw();
  };

  const draw = (): void => {
    const dirty = PLACES.some((p) => draft[p].join() !== state.layout[p].join());
    dirtyNote.textContent = dirty ? 'มีการแก้ที่ยังไม่บันทึก' : '';
    saveBtn.disabled = !state.canEdit || !dirty;
    lists.replaceChildren(...PLACES.map((p) => {
      const ids = movable(p);
      const diff = draft[p].join() !== code[p].join();
      const rows = ids.map((id, i) => {
        const e = menuEntry(id)!;
        const row = h('div', { class: 'ml-row', draggable: state.canEdit ? 'true' : 'false', 'data-i': String(i) },
          h('span', { class: 'ml-grip', title: 'ลากเพื่อเรียง' }, '☰'),
          h('span', { class: 'ml-name' }, e.label),
          h('button', { title: 'เลื่อนขึ้น', disabled: !state.canEdit || i === 0, onclick: () => move(p, i, i - 1) }, '↑'),
          h('button', { title: 'เลื่อนลง', disabled: !state.canEdit || i === ids.length - 1, onclick: () => move(p, i, i + 1) }, '↓'),
          // Move = put it in the other place and take it out of this one (only for a button that may sit in both places).
          e.only || e.pinned ? null : h('button', { title: `ย้ายไป${MENU_PLACE_NAME[other(p)]}`, disabled: !state.canEdit, onclick: () => { add(other(p), id); remove(p, id); } }, '⇄'),
          h('button', { title: e.pinned ? 'ต้องมีเสมอ' : 'ซ่อนจากที่นี่', disabled: !state.canEdit || !!e.pinned, onclick: () => remove(p, id) }, '✕'),
        );
        row.ondragstart = (ev) => { ev.dataTransfer?.setData('text/plain', `${p}:${i}`); };
        row.ondragover = (ev) => ev.preventDefault();
        row.ondrop = (ev) => {
          ev.preventDefault();
          const [fp, fi] = (ev.dataTransfer?.getData('text/plain') ?? '').split(':');
          if (fp === p) move(p, Number(fi), i);
        };
        return row;
      });
      const last = lastId(p);
      const pinnedAuto = p === 'top' && !draft.top.includes('auto');
      return h('div', { class: 'card ml-card' },
        h('h2', {}, MENU_PLACE_NAME[p]),
        h('div', { class: 'muted' }, p === 'menu' ? 'ตารางปุ่ม 3 คอลัมน์ เรียงซ้ายไปขวา บนลงล่าง' : 'แถวไอคอนใต้/ข้างแผนที่ย่อ เรียงซ้ายไปขวา · จอสัมผัสไม่มีแถวนี้ ปุ่มที่ใส่ไว้จะไปอยู่ในหน้าต่างเมนูแทน (ก่อนปุ่มตั้งค่า)'),
        diff ? h('div', { class: 'muted', style: 'color:#f2c230' }, 'ต่างจากค่าในโค้ด') : null,
        ...rows,
        last ? h('div', { class: 'ml-row ml-locked', title: menuEntry(last)!.why }, h('span', { class: 'ml-grip' }, '🔒'), h('span', { class: 'ml-name' }, `${label(last)} (ล็อก ท้ายสุดเสมอ)`)) : null,
        pinnedAuto ? h('div', { class: 'msg bad' }, 'ขาดปุ่ม AUTO') : null,
      );
    }));
    // Buttons not in a place, to put there. The ones locked to the other place say why.
    spare.replaceChildren(h('b', {}, 'ปุ่มที่ยังไม่แสดง'), ...MENU_ENTRIES.flatMap((e) => {
      const to = PLACES.filter((p) => (!e.only || e.only === p) && !draft[p].includes(e.id));
      if (!to.length) return [];
      return [h('div', { class: 'ml-chip' }, h('span', { class: 'ml-name' }, e.label),
        ...to.map((p) => h('button', { disabled: !state.canEdit, onclick: () => add(p, e.id) }, `+ ${MENU_PLACE_NAME[p]}`)))];
    }));
    const hiddenAll = MENU_ENTRIES.filter((e) => !PLACES.some((p) => draft[p].includes(e.id))).map((e) => e.label);
    spare.append(h('div', { class: 'muted' }, hiddenAll.length ? `ซ่อนทั้งสองที่: ${hiddenAll.join(', ')}` : 'ทุกปุ่มมีที่แสดงอย่างน้อยหนึ่งที่'));
  };

  const send = async (body: unknown, ok: string): Promise<void> => {
    try {
      state = await api<AdminMenuLayout>('POST', '/admin/menu-layout', body);
      draft = structuredClone(state.layout);
      onSaved(state.layout);
      msg.className = 'msg ok';
      msg.textContent = ok;
      draw();
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
    }
  };
  saveBtn.onclick = () => void send({ layout: draft }, 'บันทึกแล้ว — ผู้เล่นที่ออนไลน์เห็นทันที');
  resetBtn.onclick = () => confirm('คืนเมนูทั้งสองที่เป็นค่าในโค้ด?') && void send({ reset: true }, 'คืนค่าในโค้ดแล้ว');
  resetBtn.disabled = !state.canEdit;

  const locked = MENU_ENTRIES.filter((e) => e.only && (e.pinned || e.why)).map((e) => h('li', {}, `${e.label}: ${e.why}`));
  draw();
  box.replaceChildren(h('div', { class: 'card' },
    h('h2', {}, 'จัดเมนูเกม'),
    h('div', { class: 'muted' }, 'จัดลำดับ ซ่อน หรือย้ายปุ่มระหว่างหน้าต่างเมนูกับแถวไอคอนมุมขวาบน · ปุ่มเดียวอยู่ได้ทั้งสองที่ · ป้ายแจ้งเตือน (เลขแดง/จุดแดง) และคีย์ลัดทำงานเหมือนเดิมไม่ว่าอยู่ที่ไหน · มีผลกับผู้เล่นที่ออนไลน์ทันทีหลังบันทึก'),
    state.canEdit ? null : h('div', { class: 'msg bad' }, 'บัญชีนี้ดูได้อย่างเดียว (ไม่มีสิทธิ์ "บันทึกจัดเมนูเกม")'),
    h('details', {}, h('summary', {}, 'ปุ่มที่ล็อกไว้และเหตุผล'), h('ul', {}, ...locked)),
  ), lists, h('div', { class: 'card' }, spare),
  h('div', { class: 'row' }, saveBtn, resetBtn, dirtyNote), msg);
}
