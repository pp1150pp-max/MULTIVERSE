// The "จัดการของแต่งตัว" tab (owner 2026-11-13): every cosmetic with
// - shown / hidden in the in-game "แต่งตัว" window and its diamond price (not on sale yet), saved together
//   (switch cosManageEdit; src/shared/cosShop.ts, settings key cos_shop);
// - a box to paste the values copied from the bench ("ของแต่งตัว" tab, "คัดลอกค่าที่ตั้งไว้") for many
//   pieces at once: a preview of every value that would change (from → to), then save the ticked pieces
//   (switch cosLook; the same cos_tuning store and checks as the bench, merged on the server).
import { COS_PRICE_MAX, COS_PRICE_MIN, checkCosShop, cosShopChanges, type CosShop } from '../shared/cosShop';
import { COS_TUNE_FIELDS, cosTuneOf, pasteCosTuning, type CosTuning, type TunedSlot } from '../shared/cosTuning';
import { COSMETICS, COS_SLOTS, COS_SLOT_NAME, cosById } from '../shared/data/cosmetics';
import type { AdminCosLook, AdminCosShop } from '../shared/admin';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

const fmt = (n: number) => n.toLocaleString('en-US');

export async function renderCosManage(view: HTMLElement, h: H, api: Api): Promise<void> {
  const box = h('div', {}, h('div', { class: 'muted' }, 'กำลังโหลด…'));
  view.append(box);
  let st: AdminCosShop;
  try {
    st = await api<AdminCosShop>('GET', '/admin/cos-shop');
  } catch (e) {
    box.replaceChildren(h('div', { class: 'msg bad' }, `โหลดไม่สำเร็จ: ${(e as Error).message}`));
    return;
  }

  // ---------------------------------------------------------- shown / hidden + price
  const shopMsg = h('div', { class: 'msg' });
  const rows: { id: string; show: HTMLInputElement; price: HTMLInputElement }[] = [];
  const shopTable = h('table', {});
  const readShop = (): CosShop | string => {
    const out: Record<string, { hidden?: boolean; price?: number }> = {};
    for (const r of rows) {
      const e: { hidden?: boolean; price?: number } = {};
      if (!r.show.checked) e.hidden = true;
      const p = r.price.value.trim();
      if (p !== '') {
        const n = Number(p);
        if (!Number.isInteger(n) || n < COS_PRICE_MIN || n > COS_PRICE_MAX) return `${cosById(r.id)?.name ?? r.id}: ราคาต้องเป็นจำนวนเต็ม ${COS_PRICE_MIN}–${fmt(COS_PRICE_MAX)} เพชร (เว้นว่าง = ยังไม่ตั้งราคา)`;
        e.price = n;
      }
      if (e.hidden || e.price !== undefined) out[r.id] = e;
    }
    const c = checkCosShop(out, true);
    return c.shop ?? c.error;
  };
  const drawShop = (): void => {
    rows.length = 0;
    shopTable.replaceChildren(h('tr', {}, h('th', {}, 'ชิ้น'), h('th', {}, 'แสดงในเกม'), h('th', {}, 'ราคา (เพชร)')));
    for (const slot of COS_SLOTS) {
      shopTable.append(h('tr', {}, h('td', { colspan: '3', class: 'sub' }, COS_SLOT_NAME[slot])));
      for (const c of COSMETICS.filter((x) => x.slot === slot)) {
        const saved = st.shop[c.id] ?? {};
        const show = h('input', { type: 'checkbox' });
        show.checked = !saved.hidden;
        show.disabled = !st.canEdit;
        const price = h('input', { type: 'number', min: String(COS_PRICE_MIN), max: String(COS_PRICE_MAX), step: '1', placeholder: 'ยังไม่ตั้ง', style: 'width:110px' });
        price.value = saved.price === undefined ? '' : String(saved.price);
        price.disabled = !st.canEdit;
        const state = h('span', { class: 'tag' });
        const mark = () => {
          const ps = price.value.trim();
          const changed = show.checked !== !saved.hidden || ps !== (saved.price === undefined ? '' : String(saved.price));
          price.style.outline = show.style.outline = changed ? '1px solid #f2c230' : '';
          state.textContent = show.checked ? 'แสดง' : 'ซ่อน';
          state.className = show.checked ? 'tag on' : 'tag ban';
        };
        show.onchange = mark;
        price.oninput = mark;
        mark();
        rows.push({ id: c.id, show, price });
        shopTable.append(h('tr', {},
          h('td', {}, h('span', { style: `color:${c.color}` }, '■ '), c.name, ' ', h('span', { class: 'muted' }, c.id)),
          h('td', {}, h('label', {}, show, ' ', state)),
          h('td', {}, price)));
      }
    }
  };
  const saveShop = async (): Promise<void> => {
    const next = readShop();
    if (typeof next === 'string') {
      shopMsg.className = 'msg bad';
      shopMsg.textContent = next;
      return;
    }
    const changes = cosShopChanges(st.shop, next);
    if (!changes) {
      shopMsg.className = 'msg';
      shopMsg.textContent = 'ไม่มีอะไรเปลี่ยน';
      return;
    }
    if (!confirm(`บันทึกการเปลี่ยนแปลงนี้?\n\n${changes.split(', ').join('\n')}`)) return;
    try {
      st = await api<AdminCosShop>('POST', '/admin/cos-shop', { shop: next });
      drawShop();
      shopMsg.className = 'msg ok';
      shopMsg.textContent = '✓ บันทึกแล้ว ผู้เล่นที่ออนไลน์อยู่เห็นการซ่อน/แสดงทันที';
    } catch (e) {
      shopMsg.className = 'msg bad';
      shopMsg.textContent = `บันทึกไม่สำเร็จ: ${(e as Error).message}`;
    }
  };
  drawShop();
  const shopCard = h('div', { class: 'card' },
    h('h2', {}, 'ซ่อน/แสดง และราคา'),
    h('div', { class: 'muted' },
      'ชิ้นที่ซ่อน: ไม่โชว์ในหน้าต่าง "แต่งตัว" ของผู้เล่น (ทั้งแท็บร้านและของฉัน) และสวมใหม่ไม่ได้ · คนที่สวมอยู่แล้วใส่ต่อได้ คนอื่นยังเห็น (เห็นในของฉันเฉพาะตอนสวมอยู่ ถอดแล้วสวมกลับไม่ได้) · admin ยังให้ชิ้นที่ซ่อนแก่บัญชีได้ · '
      + 'ราคาเป็นเพชร ยังไม่เปิดขาย เก็บไว้เฉยๆ ผู้เล่นไม่เห็น · ช่องกรอบเหลือง = ยังไม่ได้บันทึก'),
    shopTable,
    st.canEdit
      ? h('div', { style: 'display:flex;gap:8px;margin-top:8px' }, h('button', { class: 'primary', onclick: () => void saveShop() }, 'บันทึก'),
        h('button', { onclick: () => { drawShop(); shopMsg.textContent = ''; } }, 'ยกเลิกที่แก้'))
      : h('div', { class: 'muted' }, 'ดูได้อย่างเดียว (บันทึกได้เฉพาะสิทธิ์ "ซ่อน/ตั้งราคาของแต่งตัว")'),
    shopMsg);

  // ---------------------------------------------------------- paste bench values for many pieces
  const pasteMsg = h('div', { class: 'msg' });
  const text = h('textarea', { rows: '4', style: 'width:100%', placeholder: 'วางข้อความจากปุ่ม "คัดลอกค่าที่ตั้งไว้" ในแท็บ "ของแต่งตัว" ที่นี่' });
  const preview = h('div', {});
  let parsed: unknown = null;
  /** Pieces ticked to save (all the changed ones at first). */
  let picked = new Set<string>();
  let base: CosTuning = st.tuning;

  const showPreview = (): void => {
    preview.replaceChildren();
    pasteMsg.className = 'msg';
    pasteMsg.textContent = '';
    parsed = null;
    try {
      parsed = JSON.parse(text.value);
    } catch {
      pasteMsg.className = 'msg bad';
      pasteMsg.textContent = 'อ่านข้อความไม่ได้ (ต้องเป็นข้อความที่คัดลอกจากแท่นทดลองทั้งก้อน)';
      return;
    }
    const r = pasteCosTuning(base, parsed);
    if (!r.tuning) {
      pasteMsg.className = 'msg bad';
      pasteMsg.textContent = r.error;
      parsed = null;
      return;
    }
    const changed: { id: string; lines: string[] }[] = [];
    let same = 0;
    for (const id of r.ids) {
      const c = cosById(id)!;
      const a = cosTuneOf(base, id)!;
      const b = cosTuneOf(r.tuning, id)!;
      const fields = COS_TUNE_FIELDS[c.slot as TunedSlot];
      const lines = Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => `${fields[k]?.label ?? k} (${k}): ${String(a[k])} → ${String(b[k])}`);
      if (lines.length) changed.push({ id, lines });
      else same++;
    }
    picked = new Set(changed.map((x) => x.id));
    if (!changed.length) {
      preview.append(h('div', { class: 'muted' }, `ข้อความนี้มี ${r.ids.length} ชิ้น ค่าตรงกับที่บันทึกไว้แล้วทั้งหมด ไม่มีอะไรเปลี่ยน`));
      return;
    }
    const saveBtn = h('button', { class: 'primary' });
    const label = () => { saveBtn.textContent = `บันทึก ${picked.size} ชิ้นที่เลือก`; saveBtn.disabled = !picked.size; };
    label();
    saveBtn.onclick = () => void savePaste();
    preview.append(
      h('div', { class: 'muted' }, `จะเปลี่ยน ${changed.length} ชิ้น` + (same ? ` · อีก ${same} ชิ้นในข้อความค่าเหมือนเดิม` : '') + ' · ชิ้นที่ไม่อยู่ในข้อความไม่ถูกแตะ · ติ๊กออกเพื่อข้ามชิ้นนั้น'),
      ...changed.map(({ id, lines }) => {
        const c = cosById(id)!;
        const tick = h('input', { type: 'checkbox' });
        tick.checked = true;
        tick.onchange = () => {
          if (tick.checked) picked.add(id);
          else picked.delete(id);
          label();
        };
        return h('div', { style: 'margin:8px 0' },
          h('label', { style: 'font-weight:600' }, tick, ' ', h('span', { style: `color:${c.color}` }, '■ '), `${COS_SLOT_NAME[c.slot]}: ${c.name} `, h('span', { class: 'muted' }, `${id} · ${lines.length} ค่า`)),
          h('ul', { class: 'items', style: 'margin:2px 0 0 22px' }, ...lines.map((l) => h('li', {}, l))));
      }),
      st.canPaste ? h('div', { style: 'display:flex;gap:8px;margin-top:8px' }, saveBtn)
        : h('div', { class: 'muted' }, 'ดูตัวอย่างได้อย่างเดียว (บันทึกได้เฉพาะสิทธิ์ "บันทึกของแต่งตัวทั้งเซิร์ฟ")'),
    );
  };

  const savePaste = async (): Promise<void> => {
    if (!parsed || !picked.size) return;
    if (!confirm(`ใช้ค่าที่วางกับ ${picked.size} ชิ้นนี้กับผู้เล่นทุกคนเลยไหม?`)) return;
    try {
      const r = await api<AdminCosLook>('POST', '/admin/cos-look', { paste: parsed, only: [...picked], base });
      base = st.tuning = r.tuning;
      showPreview();
      pasteMsg.className = 'msg ok';
      pasteMsg.textContent = '✓ บันทึกแล้ว ผู้เล่นที่ออนไลน์อยู่เห็นทันที';
    } catch (e) {
      pasteMsg.className = 'msg bad';
      pasteMsg.textContent = `บันทึกไม่สำเร็จ: ${(e as Error).message}`;
    }
  };

  /** Loads the saved tuning again (after someone else saved), then redoes the preview. */
  const reload = async (): Promise<void> => {
    try {
      st = await api<AdminCosShop>('GET', '/admin/cos-shop');
      base = st.tuning;
      if (text.value.trim()) showPreview();
    } catch (e) {
      pasteMsg.className = 'msg bad';
      pasteMsg.textContent = `โหลดไม่สำเร็จ: ${(e as Error).message}`;
    }
  };

  const pasteCard = h('div', { class: 'card' },
    h('h2', {}, 'วางค่าจากแท่นทดลอง (แก้หลายชิ้นพร้อมกัน)'),
    h('div', { class: 'muted' }, 'ในแท็บ "ของแต่งตัว" ปรับหลายชิ้นแล้วกด "คัดลอกค่าที่ตั้งไว้" แล้ววางที่นี่ กด "ดูตัวอย่าง" เพื่อดูว่าจะเปลี่ยนชิ้นไหน ค่าไหน จากเท่าไรเป็นเท่าไร ก่อนบันทึก · ทุกชิ้นที่อยู่ในข้อความใช้ค่าตามข้อความ (ค่าที่ไม่อยู่ = ค่าในโค้ด) · ข้อความแบบเก่า (มีแค่ชิ้นที่เปลี่ยน) ก็วางได้'),
    text,
    h('div', { style: 'display:flex;gap:8px;margin-top:8px' },
      h('button', { onclick: showPreview }, 'ดูตัวอย่าง'),
      h('button', { onclick: () => void reload() }, 'โหลดค่าของเซิร์ฟใหม่'),
      h('button', { onclick: () => { text.value = ''; parsed = null; preview.replaceChildren(); pasteMsg.textContent = ''; } }, 'ล้าง')),
    pasteMsg, preview);

  box.replaceChildren(shopCard, pasteCard);
}
