// The "จัดเมนูเกม" tab: which buttons the in-game menu window and the top-right icon row show, in what order
// (src/shared/menuLayout.ts). Each place is a list: drag a row (or use ↑ ↓), ⇄ moves it to the other place, ✕ hides it
// there. Buttons the player must always have (เมนู, ตั้งค่า, AUTO) can't be removed; เมนู and ตั้งค่า stay last.
// Below the lists: rename / re-icon any code button, and the admins' own shortcut buttons (a name, an icon and one action
// from SHORTCUT_ACTS; they sit in the lists like the others and/or float on the screen, placed in "จัดหน้าจอเกม").
import type { AdminMenuLayout } from '../shared/admin';
import {
  actName, buttonIcon, buttonLabel, CODE_ICON, codeMenuLayout, CUSTOM_MAX, ICON_IMAGE_NAME, ICON_IMAGES, isCustomId, LABEL_MAX,
  MENU_ENTRIES, MENU_PLACE_NAME, menuEntry, NO_RENAME, SHORTCUT_ACTS, sameIcon,
  type CustomButton, type IconImage, type MenuIcon, type MenuLayoutConfig, type MenuPlace, type ShortcutAct,
} from '../shared/menuLayout';
import { imgUrl } from '../client/img';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

const PLACES: MenuPlace[] = ['menu', 'top'];
const other = (p: MenuPlace): MenuPlace => (p === 'menu' ? 'top' : 'menu');

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
  const can = state.canEdit;
  const msg = h('div', { class: 'msg' });
  const lists = h('div', { class: 'ml-lists' });
  const spare = h('div', { class: 'ml-spare' });
  const namesCard = h('div', { class: 'card' });
  const customCard = h('div', { class: 'card' });
  const saveBtn = h('button', { class: 'primary' }, 'บันทึก');
  const resetBtn = h('button', {}, 'คืนค่าในโค้ดทั้งหมด');
  const dirtyNote = h('span', { class: 'muted' });

  const label = (id: string): string => buttonLabel(draft, id);
  /** The game's own picture of an icon (the paper badges). */
  const iconEl = (i: MenuIcon): HTMLElement =>
    h('span', { class: 'ml-ico' }, h('img', { src: imgUrl(`/assets/sprites/paper/ui/ico_${i.img}.png`), alt: '' }), i.glyph ? h('span', { class: 'ml-glyph' }, i.glyph) : null);
  const allIds = (): string[] => [...MENU_ENTRIES.map((e) => e.id), ...draft.custom.map((c) => c.id)];

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

  /** An icon picker: badge select + glyph box. Calls `set` with the new icon (already as typed). */
  const iconPicker = (cur: MenuIcon, set: (i: MenuIcon) => void): HTMLElement => {
    const sel = h('select', { disabled: !can, title: 'ภาพไอคอน' }, ...ICON_IMAGES.map((k) => h('option', { value: k, selected: k === cur.img }, ICON_IMAGE_NAME[k])));
    const gl = h('input', { type: 'text', value: cur.glyph ?? '', placeholder: 'อีโมจิ', maxlength: '16', disabled: !can, class: 'ml-glyph-in', title: 'อีโมจิ 1–2 ตัว วาดทับภาพ (เว้นว่าง = ไม่มี)' });
    const upd = (): void => set({ img: sel.value as IconImage, ...(gl.value.trim() ? { glyph: gl.value.trim() } : {}) });
    sel.onchange = upd;
    gl.onchange = upd;
    return h('span', { class: 'ml-icopick' }, iconEl(cur), sel, gl);
  };

  const drawLists = (): void => {
    lists.replaceChildren(...PLACES.map((p) => {
      const ids = movable(p);
      const diff = draft[p].join() !== code[p].join();
      const rows = ids.map((id, i) => {
        const e = menuEntry(id);
        const row = h('div', { class: 'ml-row', draggable: can ? 'true' : 'false', 'data-i': String(i) },
          h('span', { class: 'ml-grip', title: 'ลากเพื่อเรียง' }, '☰'),
          iconEl(buttonIcon(draft, id)),
          h('span', { class: 'ml-name' }, label(id) + (isCustomId(id) ? ' (ปุ่มลัด)' : '')),
          h('button', { title: 'เลื่อนขึ้น', disabled: !can || i === 0, onclick: () => move(p, i, i - 1) }, '↑'),
          h('button', { title: 'เลื่อนลง', disabled: !can || i === ids.length - 1, onclick: () => move(p, i, i + 1) }, '↓'),
          // Move = put it in the other place and take it out of this one (only for a button that may sit in both places).
          e?.only || e?.pinned ? null : h('button', { title: `ย้ายไป${MENU_PLACE_NAME[other(p)]}`, disabled: !can, onclick: () => { add(other(p), id); remove(p, id); } }, '⇄'),
          h('button', { title: e?.pinned ? 'ต้องมีเสมอ' : 'ซ่อนจากที่นี่', disabled: !can || !!e?.pinned, onclick: () => remove(p, id) }, '✕'),
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
        last ? h('div', { class: 'ml-row ml-locked', title: menuEntry(last)!.why }, h('span', { class: 'ml-grip' }, '🔒'), iconEl(buttonIcon(draft, last)), h('span', { class: 'ml-name' }, `${label(last)} (ล็อก ท้ายสุดเสมอ)`)) : null,
        pinnedAuto ? h('div', { class: 'msg bad' }, 'ขาดปุ่ม AUTO') : null,
      );
    }));
    // Buttons not in a place, to put there. The ones locked to the other place say why.
    spare.replaceChildren(h('b', {}, 'ปุ่มที่ยังไม่แสดง'), ...allIds().flatMap((id) => {
      const only = menuEntry(id)?.only;
      const to = PLACES.filter((p) => (!only || only === p) && !draft[p].includes(id));
      if (!to.length) return [];
      return [h('div', { class: 'ml-chip' }, iconEl(buttonIcon(draft, id)), h('span', { class: 'ml-name' }, label(id)),
        ...to.map((p) => h('button', { disabled: !can, onclick: () => add(p, id) }, `+ ${MENU_PLACE_NAME[p]}`)))];
    }));
    const hiddenAll = allIds().filter((id) => !PLACES.some((p) => draft[p].includes(id)) && !draft.custom.find((c) => c.id === id)?.free).map(label);
    spare.append(h('div', { class: 'muted' }, hiddenAll.length ? `ซ่อนทั้งสองที่: ${hiddenAll.join(', ')}` : 'ทุกปุ่มมีที่แสดงอย่างน้อยหนึ่งที่'));
  };

  /** Rename / re-icon the code buttons. */
  const drawNames = (): void => {
    const rows = MENU_ENTRIES.map((e) => {
      const n = draft.names[e.id] ?? {};
      const setName = (v: { label?: string; icon?: MenuIcon }): void => {
        const next = { ...n, ...v };
        if (!next.label || next.label === e.label) delete next.label;
        if (!next.icon || sameIcon(next.icon, CODE_ICON[e.id])) delete next.icon;
        if (Object.keys(next).length) draft.names[e.id] = next;
        else delete draft.names[e.id];
        draw();
      };
      const nameIn = h('input', { type: 'text', value: n.label ?? '', placeholder: e.label, maxlength: String(LABEL_MAX), disabled: !can || NO_RENAME.has(e.id), title: NO_RENAME.has(e.id) ? 'ปุ่มนี้เปลี่ยนชื่อไม่ได้ (เกมเขียน AUTO: ON/OFF ทับ)' : `ชื่อใหม่ (เว้นว่าง = ${e.label})` });
      nameIn.onchange = () => setName({ label: nameIn.value.trim() || undefined });
      return h('div', { class: `ml-row${draft.names[e.id] ? ' ml-changed' : ''}` },
        h('span', { class: 'ml-name' }, e.label),
        nameIn,
        iconPicker(buttonIcon(draft, e.id), (icon) => setName({ icon })),
        h('button', { title: 'กลับเป็นชื่อ/ไอคอนในโค้ด', disabled: !can || !draft.names[e.id], onclick: () => { delete draft.names[e.id]; draw(); } }, '↺'),
      );
    });
    namesCard.replaceChildren(
      h('h2', {}, 'ชื่อและไอคอนปุ่ม'),
      h('div', { class: 'muted' }, `ชื่อยาวได้ ${LABEL_MAX} ตัวอักษร · ไอคอนเลือกภาพที่มี หรือ "พื้นเปล่า" + อีโมจิ 1–2 ตัว · จุดแดง/ตัวเลขแจ้งเตือนยังตามปุ่มเดิมแม้เปลี่ยนชื่อ · ปุ่ม AUTO เปลี่ยนได้แค่ไอคอน`),
      h('details', {}, h('summary', {}, `เปิดรายการ (${Object.keys(draft.names).length} ปุ่มที่เปลี่ยนแล้ว)`), ...rows),
    );
  };

  /** The admins' own shortcut buttons. */
  const drawCustom = (): void => {
    const rows = draft.custom.map((c, i) => {
      const set = (v: Partial<CustomButton>): void => {
        draft.custom[i] = { ...c, ...v };
        if (!draft.custom[i].free) delete draft.custom[i].free;
        draw();
      };
      const nameIn = h('input', { type: 'text', value: c.label, maxlength: String(LABEL_MAX), disabled: !can, title: 'ชื่อปุ่ม' });
      nameIn.onchange = () => set({ label: nameIn.value.trim() });
      const actSel = h('select', { disabled: !can, title: 'กดแล้วทำอะไร' }, ...SHORTCUT_ACTS.map((a) => h('option', { value: a, selected: a === c.act }, actName(a))));
      actSel.onchange = () => set({ act: actSel.value as ShortcutAct });
      const free = h('input', { type: 'checkbox', checked: !!c.free, disabled: !can });
      free.onchange = () => set({ free: free.checked ? true : undefined });
      const where = PLACES.filter((p) => draft[p].includes(c.id)).map((p) => MENU_PLACE_NAME[p]);
      if (c.free) where.push('วางอิสระบนจอ');
      return h('div', { class: 'ml-row' },
        h('span', { class: 'muted' }, c.id),
        nameIn,
        h('span', {}, '→ ', actSel),
        iconPicker(c.icon, (icon) => set({ icon })),
        h('label', { title: 'ลอยบนจอ ตำแหน่งตั้งในแท็บ "จัดหน้าจอเกม" แล้วกดเผยแพร่ (ยังไม่เผยแพร่ = ผู้เล่นยังไม่เห็น)' }, free, ' วางอิสระบนจอ'),
        h('span', { class: 'muted' }, where.length ? `อยู่ที่: ${where.join(', ')}` : 'ยังไม่ได้วางที่ไหน'),
        h('button', { title: 'ลบปุ่มลัดนี้', disabled: !can, onclick: () => {
          if (!confirm(`ลบปุ่มลัด "${c.label}"?`)) return;
          draft.custom.splice(i, 1);
          for (const p of PLACES) draft[p] = draft[p].filter((id) => id !== c.id);
          draw();
        } }, '🗑'),
      );
    });
    const addBtn = h('button', { disabled: !can || draft.custom.length >= CUSTOM_MAX, onclick: () => {
      // Ids are never reused within the layout, so a floating place saved for a deleted button can't land on a new one.
      const n = Math.max(0, ...draft.custom.map((c) => Number(c.id.slice(1))), ...(state.layout.custom.map((c) => Number(c.id.slice(1))))) + 1;
      const id = `c${n}`;
      draft.custom.push({ id, label: 'ปุ่มลัด', icon: { img: 'blank', glyph: '⭐' }, act: 'bag' });
      add('menu', id);
    } }, `+ เพิ่มปุ่มลัด (${draft.custom.length}/${CUSTOM_MAX})`);
    customCard.replaceChildren(
      h('h2', {}, 'ปุ่มลัด'),
      h('div', { class: 'muted' }, 'ปุ่มใหม่ที่เปิดหน้าต่าง/ฟังก์ชันที่มีอยู่แล้ว (เลือกจากรายการเท่านั้น) · ปุ่มใหม่จะอยู่ในหน้าต่างเมนู ย้าย/ซ่อนได้ในรายการด้านบนเหมือนปุ่มอื่น · ติ๊ก "วางอิสระบนจอ" แล้วไปวางที่แท็บ "จัดหน้าจอเกม" → เผยแพร่ ผู้เล่นถึงจะเห็นบนจอ · ปุ่มที่ Guest ใช้ไม่ได้ (จดหมาย เทรด ฯลฯ) จะไม่โชว์ให้ Guest เหมือนปุ่มเดิม'),
      ...rows,
      h('div', { class: 'row' }, addBtn),
    );
  };

  const draw = (): void => {
    const dirty = JSON.stringify(draft) !== JSON.stringify(state.layout);
    dirtyNote.textContent = dirty ? 'มีการแก้ที่ยังไม่บันทึก' : '';
    saveBtn.disabled = !can || !dirty;
    drawLists();
    drawNames();
    drawCustom();
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
  resetBtn.onclick = () => confirm('คืนเมนูทั้งสองที่ ชื่อ/ไอคอนทุกปุ่มเป็นค่าในโค้ด และลบปุ่มลัดทั้งหมด?') && void send({ reset: true }, 'คืนค่าในโค้ดแล้ว');
  resetBtn.disabled = !can;

  const locked = MENU_ENTRIES.filter((e) => e.only && (e.pinned || e.why)).map((e) => h('li', {}, `${e.label}: ${e.why}`));
  draw();
  box.replaceChildren(h('div', { class: 'card' },
    h('h2', {}, 'จัดเมนูเกม'),
    h('div', { class: 'muted' }, 'จัดลำดับ ซ่อน หรือย้ายปุ่มระหว่างหน้าต่างเมนูกับแถวไอคอนมุมขวาบน เปลี่ยนชื่อ/ไอคอน และเพิ่มปุ่มลัด · ปุ่มเดียวอยู่ได้ทั้งสองที่ · ป้ายแจ้งเตือน (เลขแดง/จุดแดง) และคีย์ลัดทำงานเหมือนเดิมไม่ว่าอยู่ที่ไหน · มีผลกับผู้เล่นที่ออนไลน์ทันทีหลังบันทึก'),
    can ? null : h('div', { class: 'msg bad' }, 'บัญชีนี้ดูได้อย่างเดียว (ไม่มีสิทธิ์ "บันทึกจัดเมนูเกม")'),
    h('details', {}, h('summary', {}, 'ปุ่มที่ล็อกไว้และเหตุผล'), h('ul', {}, ...locked)),
  ), lists, h('div', { class: 'card' }, spare), customCard, namesCard,
  h('div', { class: 'row' }, saveBtn, resetBtn, dirtyNote), msg);
}
