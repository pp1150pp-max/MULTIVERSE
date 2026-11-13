// The "จัดการของแต่งตัว" tab (owner 2026-11-13): one table of every cosmetic with
// - shown / hidden in the in-game "แต่งตัว" window and its diamond price (not on sale yet)
//   (switch cosManageEdit; src/shared/cosShop.ts, settings key cos_shop);
// - one look value per piece, picked per kind (wings / mount / pet / aura: any field of the bench, view
//   offsets too), typed per piece or added to every ticked piece at once (e.g. all wings 0.1 higher)
//   (switch cosLook; the same cos_tuning store and strict checks as the bench, merged on the server).
// One "บันทึก" saves both after a confirm listing every change (from → to).
import { COS_PRICE_MAX, COS_PRICE_MIN, checkCosShop, cosShopChanges, type CosShop } from '../shared/cosShop';
import { COS_TUNE_FIELDS, cosTuneOf, cosTuningChanges, pasteCosTuning, TUNED_SLOTS, type CosTuning, type TunedSlot, type TuneValues } from '../shared/cosTuning';
import { COSMETICS, COS_SLOTS, COS_SLOT_NAME, cosById } from '../shared/data/cosmetics';
import type { AdminCosShop } from '../shared/admin';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

const fmt = (n: number) => n.toLocaleString('en-US');
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const isTuned = (slot: string): slot is TunedSlot => (TUNED_SLOTS as readonly string[]).includes(slot);
/** The value shown first for each kind: the height on the character (owner's example), the aura's size. */
const FIRST_FIELD: Record<TunedSlot, string> = { wings: 'backStand', mount: 'seat', pet: 'float', aura: 'size' };
const CHANGED = '1px solid #f2c230';

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

  // What the table edits (kept across redraws until saved or undone).
  let shown: Record<string, boolean> = {};
  let price: Record<string, string> = {};
  let look: Record<string, TuneValues> = {};
  const picked: Record<TunedSlot, string> = { ...FIRST_FIELD };
  const ticked = new Set<string>();
  const startEdit = (): void => {
    shown = {};
    price = {};
    look = {};
    for (const c of COSMETICS) {
      shown[c.id] = !st.shop[c.id]?.hidden;
      price[c.id] = st.shop[c.id]?.price === undefined ? '' : String(st.shop[c.id]!.price);
      const v = cosTuneOf(st.tuning, c.id);
      if (v) look[c.id] = { ...v };
    }
  };
  startEdit();

  const msg = h('div', { class: 'msg' });
  const say = (text: string, cls = ''): void => {
    msg.className = `msg ${cls}`;
    msg.textContent = text;
  };
  const table = h('table', {});

  const draw = (): void => {
    table.replaceChildren(h('tr', {}, h('th', {}, ''), h('th', {}, 'ชิ้น'), h('th', {}, 'แสดงในเกม'), h('th', {}, 'ราคา (เพชร)'), h('th', {}, 'ค่าหน้าตา')));
    for (const slot of COS_SLOTS) {
      const pieces = COSMETICS.filter((x) => x.slot === slot);
      table.append(slotHead(slot, pieces.map((c) => c.id)));
      for (const c of pieces) {
        const saved = st.shop[c.id] ?? {};
        const show = h('input', { type: 'checkbox' });
        show.checked = shown[c.id];
        show.disabled = !st.canEdit;
        const state = h('span', {});
        const pr = h('input', { type: 'number', min: String(COS_PRICE_MIN), max: String(COS_PRICE_MAX), step: '1', placeholder: 'ยังไม่ตั้ง', style: 'width:100px' });
        pr.value = price[c.id];
        pr.disabled = !st.canEdit;
        const mark = (): void => {
          show.style.outline = show.checked !== !saved.hidden ? CHANGED : '';
          pr.style.outline = pr.value.trim() !== (saved.price === undefined ? '' : String(saved.price)) ? CHANGED : '';
          state.textContent = show.checked ? 'แสดง' : 'ซ่อน';
          state.className = show.checked ? 'tag on' : 'tag ban';
        };
        show.onchange = () => {
          shown[c.id] = show.checked;
          mark();
        };
        pr.oninput = () => {
          price[c.id] = pr.value;
          mark();
        };
        mark();
        let tick: Node | string = '';
        if (isTuned(slot)) {
          const t = h('input', { type: 'checkbox', title: 'เลือกชิ้นนี้สำหรับ "บวก/ลบทุกชิ้นที่ติ๊ก"' });
          t.checked = ticked.has(c.id);
          t.onchange = () => {
            if (t.checked) ticked.add(c.id);
            else ticked.delete(c.id);
          };
          tick = t;
        }
        table.append(h('tr', {},
          h('td', {}, tick),
          h('td', {}, h('span', { style: `color:${c.color}` }, '■ '), c.name, ' ', h('span', { class: 'muted' }, c.id)),
          h('td', {}, h('label', {}, show, ' ', state)),
          h('td', {}, pr),
          h('td', {}, isTuned(slot) ? valueBox(slot, c.id) : h('span', { class: 'muted' }, '—'))));
      }
    }
  };

  /** One kind's header row: which value the column shows, and adding the same amount to every ticked piece. */
  const slotHead = (slot: (typeof COS_SLOTS)[number], ids: string[]): HTMLElement => {
    if (!isTuned(slot)) return h('tr', {}, h('td', { colspan: '5', class: 'sub' }, COS_SLOT_NAME[slot], h('span', { class: 'muted' }, ' (ไม่มีค่าหน้าตา)')));
    const fields = COS_TUNE_FIELDS[slot];
    const pick = h('select', { style: 'max-width:340px' }, ...Object.entries(fields).map(([k, f]) => h('option', { value: k }, `${f.label} (${k})`)));
    pick.value = picked[slot];
    pick.onchange = () => {
      picked[slot] = pick.value;
      draw();
    };
    const all = h('input', { type: 'checkbox', title: 'ติ๊ก/เอาออกทุกชิ้นของชนิดนี้' });
    all.checked = ids.every((id) => ticked.has(id));
    all.onchange = () => {
      for (const id of ids) {
        if (all.checked) ticked.add(id);
        else ticked.delete(id);
      }
      draw();
    };
    const f = fields[picked[slot]];
    let bulk: Node | null = null;
    if (f?.kind === 'num' && st.canPaste) {
      const amount = h('input', { type: 'number', step: String(f.step), placeholder: '+0.1 / -0.1', style: 'width:90px' });
      const add = (): void => {
        const d = Number(amount.value);
        const mine = ids.filter((id) => ticked.has(id));
        if (!amount.value.trim() || !Number.isFinite(d) || d === 0) return say('ใส่จำนวนที่จะบวก (ลบ = ใส่ค่าติดลบ)', 'bad');
        if (!mine.length) return say(`ยังไม่ได้ติ๊ก${COS_SLOT_NAME[slot]}ชิ้นไหน`, 'bad');
        let capped = 0;
        for (const id of mine) {
          const cur = look[id][picked[slot]] as number;
          const next = round3(Math.min(f.max, Math.max(f.min, cur + d)));
          if (next !== round3(cur + d)) capped++;
          look[id][picked[slot]] = next;
        }
        say(`${d > 0 ? 'บวก' : 'ลบ'} ${Math.abs(d)} ให้ ${mine.length} ชิ้นแล้ว (ยังไม่บันทึก)` + (capped ? ` · ${capped} ชิ้นชนขอบช่วง ${f.min}–${f.max}` : ''), 'ok');
        draw();
      };
      bulk = h('span', { style: 'margin-left:10px' }, 'บวก/ลบทุกชิ้นที่ติ๊ก ', amount, ' ', h('button', { class: 'small', onclick: add }, 'ใช้'));
    }
    return h('tr', {}, h('td', {}, all), h('td', { colspan: '4', class: 'sub' }, COS_SLOT_NAME[slot], ' · ค่าที่แก้ ', pick, bulk));
  };

  /** The picked value of one piece: a number box (range of the bench slider) or an on/off box. */
  const valueBox = (slot: TunedSlot, id: string): HTMLElement => {
    const k = picked[slot];
    const f = COS_TUNE_FIELDS[slot][k];
    const savedV = cosTuneOf(st.tuning, id)?.[k];
    if (f.kind === 'bool') {
      const b = h('input', { type: 'checkbox' });
      b.checked = look[id][k] === true;
      b.disabled = !st.canPaste;
      const mark = () => { b.style.outline = b.checked !== savedV ? CHANGED : ''; };
      b.onchange = () => {
        look[id][k] = b.checked;
        mark();
      };
      mark();
      return h('label', {}, b, ' เปิด');
    }
    const n = h('input', { type: 'number', min: String(f.min), max: String(f.max), step: String(f.step), style: 'width:90px' });
    n.value = String(look[id][k]);
    n.disabled = !st.canPaste;
    const mark = () => { n.style.outline = Number(n.value) !== savedV ? CHANGED : ''; };
    n.oninput = () => {
      if (n.value.trim() !== '' && Number.isFinite(Number(n.value))) look[id][k] = Number(n.value);
      mark();
    };
    mark();
    return h('span', {}, n, h('span', { class: 'muted' }, ` ${f.min}–${f.max}`));
  };

  /** What would be saved: the shop settings and the look values of the pieces that changed (or an error). */
  const collect = (): { shop?: CosShop; look?: { paste: CosTuning; after: CosTuning }; error?: string } => {
    const out: { shop?: CosShop; look?: { paste: CosTuning; after: CosTuning } } = {};
    if (st.canEdit) {
      const raw: Record<string, { hidden?: boolean; price?: number }> = {};
      for (const c of COSMETICS) {
        const e: { hidden?: boolean; price?: number } = {};
        if (!shown[c.id]) e.hidden = true;
        const p = price[c.id].trim();
        if (p !== '') {
          const n = Number(p);
          if (!Number.isInteger(n) || n < COS_PRICE_MIN || n > COS_PRICE_MAX) return { error: `${c.name}: ราคาต้องเป็นจำนวนเต็ม ${COS_PRICE_MIN}–${fmt(COS_PRICE_MAX)} เพชร (เว้นว่าง = ยังไม่ตั้งราคา)` };
          e.price = n;
        }
        if (e.hidden || e.price !== undefined) raw[c.id] = e;
      }
      const c = checkCosShop(raw, true);
      if (!c.shop) return { error: c.error };
      if (cosShopChanges(st.shop, c.shop)) out.shop = c.shop;
    }
    if (st.canPaste) {
      const paste: CosTuning = {};
      for (const [id, v] of Object.entries(look)) {
        const was = cosTuneOf(st.tuning, id)!;
        if (Object.keys(v).some((k) => v[k] !== was[k])) paste[id] = v;
      }
      if (Object.keys(paste).length) {
        const r = pasteCosTuning(st.tuning, paste);
        if (!r.tuning) return { error: r.error };
        out.look = { paste, after: r.tuning };
      }
    }
    return out;
  };

  const save = async (): Promise<void> => {
    const c = collect();
    if (c.error) return say(c.error, 'bad');
    const lines = [
      ...(c.shop ? cosShopChanges(st.shop, c.shop).split(', ') : []),
      ...(c.look ? cosTuningChanges(st.tuning, c.look.after).split(', ') : []),
    ].filter(Boolean);
    if (!lines.length) return say('ไม่มีอะไรเปลี่ยน');
    const shownLines = lines.length > 40 ? [...lines.slice(0, 40), `…และอีก ${lines.length - 40} รายการ`] : lines;
    if (!confirm(`บันทึก ${lines.length} รายการนี้ ใช้กับผู้เล่นทุกคนทันที?\n\n${shownLines.join('\n')}`)) return;
    try {
      if (c.shop) await api('POST', '/admin/cos-shop', { shop: c.shop });
      if (c.look) await api('POST', '/admin/cos-look', { paste: c.look.paste, base: st.tuning });
      st = await api<AdminCosShop>('GET', '/admin/cos-shop');
      startEdit();
      draw();
      say(`✓ บันทึกแล้ว ${lines.length} รายการ ผู้เล่นที่ออนไลน์อยู่เห็นทันที`, 'ok');
    } catch (e) {
      say(`บันทึกไม่สำเร็จ: ${(e as Error).message}`, 'bad');
    }
  };

  const reload = async (): Promise<void> => {
    if (!confirm('โหลดค่าของเซิร์ฟใหม่? ที่แก้ไว้แต่ยังไม่บันทึกจะหาย')) return;
    try {
      st = await api<AdminCosShop>('GET', '/admin/cos-shop');
      startEdit();
      draw();
      say('');
    } catch (e) {
      say(`โหลดไม่สำเร็จ: ${(e as Error).message}`, 'bad');
    }
  };

  draw();
  const canSave = st.canEdit || st.canPaste;
  box.replaceChildren(h('div', { class: 'card' },
    h('h2', {}, 'จัดการของแต่งตัว'),
    h('div', { class: 'muted' },
      'ชิ้นที่ซ่อน: ไม่โชว์ในหน้าต่าง "แต่งตัว" ของผู้เล่น (ทั้งแท็บร้านและของฉัน) และสวมใหม่ไม่ได้ · คนที่สวมอยู่แล้วใส่ต่อได้ คนอื่นยังเห็น (เห็นในของฉันเฉพาะตอนสวมอยู่ ถอดแล้วสวมกลับไม่ได้) · admin ยังให้ชิ้นที่ซ่อนแก่บัญชีได้ · '
      + 'ราคาเป็นเพชร ยังไม่เปิดขาย ผู้เล่นไม่เห็น · ค่าหน้าตา: เลือกค่าที่แก้ที่หัวแต่ละชนิด (ค่าเดียวกับในแท่นทดลอง "ของแต่งตัว") พิมพ์รายชิ้น หรือติ๊กหลายชิ้นแล้ว "บวก/ลบ" ทีเดียว · '
      + 'ช่องกรอบเหลือง = ต่างจากที่บันทึกไว้ (ยังไม่บันทึก) · เปลี่ยนค่าที่แก้ได้เรื่อย ๆ แล้วกดบันทึกครั้งเดียว'),
    !st.canEdit ? h('div', { class: 'muted' }, 'ซ่อน/ราคา: ดูได้อย่างเดียว (ต้องมีสิทธิ์ "ซ่อน/ตั้งราคาของแต่งตัว")') : null,
    !st.canPaste ? h('div', { class: 'muted' }, 'ค่าหน้าตา: ดูได้อย่างเดียว (ต้องมีสิทธิ์ "บันทึกของแต่งตัวทั้งเซิร์ฟ")') : null,
    table,
    h('div', { style: 'display:flex;gap:8px;margin-top:8px;position:sticky;bottom:0;background:var(--panel);padding:6px 0' },
      canSave ? h('button', { class: 'primary', onclick: () => void save() }, 'บันทึก') : null,
      canSave ? h('button', { onclick: () => { startEdit(); draw(); say(''); } }, 'ยกเลิกที่แก้') : null,
      h('button', { onclick: () => void reload() }, 'โหลดค่าของเซิร์ฟใหม่')),
    msg));
}
