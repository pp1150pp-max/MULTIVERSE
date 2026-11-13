// The "จัดการของแต่งตัว" tab (owner 2026-11-13): one table of every cosmetic with
// - shown / hidden in the in-game "แต่งตัว" window and its diamond price (not on sale yet)
//   (switch cosManageEdit; src/shared/cosShop.ts, settings key cos_shop);
// - one look value per piece, picked per kind (wings / mount / pet / aura: any field of the bench, view
//   offsets too), typed per piece or added to every ticked piece at once (e.g. all wings 0.1 higher)
//   (switch cosLook; the same cos_tuning store and strict checks as the bench, merged on the server);
// - the orb looks added from the orb bench ("ลูกแก้วตีบวก", src/shared/orbItems.ts): name, one look value
//   the same way, open on the orb bench, delete (one no account owns) (switch cosManageEdit).
// One "บันทึก" saves everything after a confirm listing every change (from → to).
import { COS_PRICE_MAX, COS_PRICE_MIN, checkCosShop, cosShopChanges, type CosShop } from '../shared/cosShop';
import { COS_TUNE_FIELDS, cosTuneOf, cosTuningChanges, pasteCosTuning, TUNED_SLOTS, type CosTuning, type TunedSlot, type TuneValues } from '../shared/cosTuning';
import { COSMETICS, COS_SLOTS, COS_SLOT_NAME } from '../shared/data/cosmetics';
import { checkOrbName, orbItemsChanges, registerOrbItems, type OrbItems } from '../shared/orbItems';
import { ORB_LOOK_RANGES, ORB_PALETTE_IDS, ORB_PALETTE_NAME, ORB_SHAPE_IDS, ORB_SHAPE_NAME, sameOrbLook, type OrbLook, type OrbLookNumber } from '../shared/orbLook';
import type { AdminCosShop } from '../shared/admin';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

const fmt = (n: number) => n.toLocaleString('en-US');
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const isTuned = (slot: string): slot is TunedSlot => (TUNED_SLOTS as readonly string[]).includes(slot);
/** The value shown first for each kind: the height on the character (owner's example), the aura's size. */
const FIRST_FIELD: Record<TunedSlot, string> = { wings: 'backStand', mount: 'seat', pet: 'float', aura: 'size' };
const CHANGED = '1px solid #f2c230';

/** The orb look values, with the names of the orb bench's sliders (steps as there). */
const ORB_FIELD: Record<keyof OrbLook, { label: string; step?: number }> = {
  palette: { label: 'ชุดสี' },
  shape: { label: 'รูปทรง' },
  scale: { label: 'ขนาด ×', step: 0.1 },
  radius: { label: 'รัศมีวง', step: 0.05 },
  speed: { label: 'ความเร็วหมุน (รอบ/วิ)', step: 0.01 },
  height: { label: 'ความสูงวง (+ขึ้น −ลง)', step: 0.05 },
  bob: { label: 'ระยะลอยขึ้นลง', step: 0.01 },
  bobSpeed: { label: 'ความเร็วลอย ×', step: 0.1 },
  sway: { label: 'ส่ายหน้า-หลัง ×', step: 0.1 },
  glow: { label: 'ขนาดแสง ×', step: 0.1 },
  glowAlpha: { label: 'ความสว่างแสง ×', step: 0.1 },
  particles: { label: 'จำนวนประกาย ×', step: 0.1 },
  trail: { label: 'ความยาวหาง ×', step: 0.1 },
  softGlow: { label: 'แสงนุ่มกลม' },
};
const isOrbNumber = (k: string): k is OrbLookNumber => k in ORB_LOOK_RANGES;

/**
 * `openOrb` opens an orb look on the orb bench (null when this admin can't open that tab).
 */
export async function renderCosManage(view: HTMLElement, h: H, api: Api, openOrb: ((id: string) => void) | null = null): Promise<void> {
  const box = h('div', {}, h('div', { class: 'muted' }, 'กำลังโหลด…'));
  view.append(box);
  let st = undefined as unknown as AdminCosShop;
  const load = async (): Promise<void> => {
    st = await api<AdminCosShop>('GET', '/admin/cos-shop');
    // The orb looks are cosmetics too: put them in the list this page loops over.
    registerOrbItems(st.orbs.items);
  };
  try {
    await load();
  } catch (e) {
    box.replaceChildren(h('div', { class: 'msg bad' }, `โหลดไม่สำเร็จ: ${(e as Error).message}`));
    return;
  }

  // What the table edits (kept across redraws until saved or undone).
  let shown: Record<string, boolean> = {};
  let price: Record<string, string> = {};
  let look: Record<string, TuneValues> = {};
  let orbName: Record<string, string> = {};
  let orbLook: Record<string, OrbLook> = {};
  const picked: Record<TunedSlot, string> = { ...FIRST_FIELD };
  let orbPicked: keyof OrbLook = 'scale';
  const ticked = new Set<string>();
  const startEdit = (): void => {
    shown = {};
    price = {};
    look = {};
    orbName = {};
    orbLook = {};
    for (const c of COSMETICS) {
      shown[c.id] = !st.shop[c.id]?.hidden;
      price[c.id] = st.shop[c.id]?.price === undefined ? '' : String(st.shop[c.id]!.price);
      const v = cosTuneOf(st.tuning, c.id);
      if (v) look[c.id] = { ...v };
    }
    for (const it of st.orbs.items) {
      orbName[it.id] = it.name;
      orbLook[it.id] = { ...it.look };
    }
  };
  startEdit();
  const savedOrb = (id: string) => st.orbs.items.find((i) => i.id === id);

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
      table.append(slot === 'orb' ? orbHead(pieces.map((c) => c.id)) : slotHead(slot, pieces.map((c) => c.id)));
      if (slot === 'orb' && !pieces.length) {
        table.append(h('tr', {}, h('td', {}, ''), h('td', { colspan: '4', class: 'muted' }, 'ยังไม่มี · ทำหน้าตาในแท็บ "ลูกแก้วตีบวก" แล้วกด "เพิ่มในร้านค้า"')));
      }
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
        if (isTuned(slot) || slot === 'orb') {
          const t = h('input', { type: 'checkbox', title: 'เลือกชิ้นนี้สำหรับ "บวก/ลบทุกชิ้นที่ติ๊ก"' });
          t.checked = ticked.has(c.id);
          t.onchange = () => {
            if (t.checked) ticked.add(c.id);
            else ticked.delete(c.id);
          };
          tick = t;
        }
        const nameCell = slot === 'orb' ? orbNameCell(c.id) : h('td', {}, h('span', { style: `color:${c.color}` }, '■ '), c.name, ' ', h('span', { class: 'muted' }, c.id));
        table.append(h('tr', {},
          h('td', {}, tick),
          nameCell,
          h('td', {}, h('label', {}, show, ' ', state)),
          h('td', {}, pr),
          h('td', {}, isTuned(slot) ? valueBox(slot, c.id) : slot === 'orb' ? orbValueBox(c.id) : h('span', { class: 'muted' }, '—'))));
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
    const f = fields[picked[slot]];
    let bulk: Node | null = null;
    if (f?.kind === 'num' && st.canPaste) {
      bulk = bulkBox(ids, COS_SLOT_NAME[slot], f.step, f.min, f.max, round3, (id) => look[id][picked[slot]] as number, (id, v) => { look[id][picked[slot]] = v; });
    }
    return h('tr', {}, h('td', {}, tickAll(ids)), h('td', { colspan: '4', class: 'sub' }, COS_SLOT_NAME[slot], ' · ค่าที่แก้ ', pick, bulk));
  };

  /** The orb looks' header row: the value picker and the bulk add (numbers), like the other kinds. */
  const orbHead = (ids: string[]): HTMLElement => {
    const pick = h('select', { style: 'max-width:340px' }, ...(Object.keys(ORB_FIELD) as (keyof OrbLook)[]).map((k) => h('option', { value: k }, `${ORB_FIELD[k].label} (${k})`)));
    pick.value = orbPicked;
    pick.onchange = () => {
      orbPicked = pick.value as keyof OrbLook;
      draw();
    };
    const k = orbPicked;
    let bulk: Node | null = null;
    if (isOrbNumber(k) && st.canEdit && ids.length) {
      const [lo, hi] = ORB_LOOK_RANGES[k];
      bulk = bulkBox(ids, 'ลูกแก้ว', ORB_FIELD[k].step ?? 0.01, lo, hi, round2, (id) => orbLook[id][k], (id, v) => { orbLook[id][k] = v; });
    }
    return h('tr', {}, h('td', {}, ids.length ? tickAll(ids) : ''), h('td', { colspan: '4', class: 'sub' },
      COS_SLOT_NAME.orb, h('span', { class: 'muted' }, ' (เปลี่ยนแค่หน้าตา ลูกแก้วมาจากของที่สวม +7 ขึ้นไป)'), ' · ค่าที่แก้ ', pick, bulk));
  };

  const tickAll = (ids: string[]): HTMLInputElement => {
    const all = h('input', { type: 'checkbox', title: 'ติ๊ก/เอาออกทุกชิ้นของชนิดนี้' });
    all.checked = ids.every((id) => ticked.has(id));
    all.onchange = () => {
      for (const id of ids) {
        if (all.checked) ticked.add(id);
        else ticked.delete(id);
      }
      draw();
    };
    return all;
  };

  /** "บวก/ลบทุกชิ้นที่ติ๊ก": the same amount added to each ticked piece's own value, stopped at the range's ends. */
  const bulkBox = (ids: string[], kind: string, step: number, min: number, max: number, round: (n: number) => number,
    get: (id: string) => number, set: (id: string, v: number) => void): HTMLElement => {
    const amount = h('input', { type: 'number', step: String(step), placeholder: '+0.1 / -0.1', style: 'width:90px' });
    const add = (): void => {
      const d = Number(amount.value);
      const mine = ids.filter((id) => ticked.has(id));
      if (!amount.value.trim() || !Number.isFinite(d) || d === 0) return say('ใส่จำนวนที่จะบวก (ลบ = ใส่ค่าติดลบ)', 'bad');
      if (!mine.length) return say(`ยังไม่ได้ติ๊ก${kind}ชิ้นไหน`, 'bad');
      let capped = 0;
      for (const id of mine) {
        const cur = get(id);
        const next = round(Math.min(max, Math.max(min, cur + d)));
        if (next !== round(cur + d)) capped++;
        set(id, next);
      }
      say(`${d > 0 ? 'บวก' : 'ลบ'} ${Math.abs(d)} ให้ ${mine.length} ชิ้นแล้ว (ยังไม่บันทึก)` + (capped ? ` · ${capped} ชิ้นชนขอบช่วง ${min}–${max}` : ''), 'ok');
      draw();
    };
    return h('span', { style: 'margin-left:10px' }, 'บวก/ลบทุกชิ้นที่ติ๊ก ', amount, ' ', h('button', { class: 'small', onclick: add }, 'ใช้'));
  };

  /** The picked value of one piece: a number box (range of the bench slider) or an on/off box. */
  const valueBox = (slot: TunedSlot, id: string): HTMLElement => {
    const k = picked[slot];
    const f = COS_TUNE_FIELDS[slot][k];
    const savedV = cosTuneOf(st.tuning, id)?.[k];
    if (f.kind === 'bool') {
      return boolBox(look[id][k] === true, savedV === true, !st.canPaste, (v) => { look[id][k] = v; });
    }
    return numberBox(look[id][k] as number, savedV as number, f.min, f.max, f.step, !st.canPaste, (v) => { look[id][k] = v; });
  };

  const boolBox = (v: boolean, savedV: boolean, disabled: boolean, set: (v: boolean) => void): HTMLElement => {
    const b = h('input', { type: 'checkbox' });
    b.checked = v;
    b.disabled = disabled;
    const mark = () => { b.style.outline = b.checked !== savedV ? CHANGED : ''; };
    b.onchange = () => {
      set(b.checked);
      mark();
    };
    mark();
    return h('label', {}, b, ' เปิด');
  };

  const numberBox = (v: number, savedV: number | undefined, min: number, max: number, step: number, disabled: boolean, set: (v: number) => void): HTMLElement => {
    const n = h('input', { type: 'number', min: String(min), max: String(max), step: String(step), style: 'width:90px' });
    n.value = String(v);
    n.disabled = disabled;
    const mark = () => { n.style.outline = Number(n.value) !== savedV ? CHANGED : ''; };
    n.oninput = () => {
      if (n.value.trim() !== '' && Number.isFinite(Number(n.value))) set(Number(n.value));
      mark();
    };
    mark();
    return h('span', {}, n, h('span', { class: 'muted' }, ` ${min}–${max}`));
  };

  /** An orb look's name (editable), id, owners and its buttons. */
  const orbNameCell = (id: string): HTMLElement => {
    const saved = savedOrb(id);
    const name = h('input', { type: 'text', maxlength: '30', style: 'width:160px' });
    name.value = orbName[id];
    name.disabled = !st.canEdit;
    const mark = () => { name.style.outline = name.value.trim() !== saved?.name ? CHANGED : ''; };
    name.oninput = () => {
      orbName[id] = name.value;
      mark();
    };
    mark();
    const owners = st.orbOwners[id] ?? 0;
    const open = openOrb ? h('button', { class: 'small', title: 'เปิดหน้าตาชิ้นนี้ในแท็บ "ลูกแก้วตีบวก" แก้แล้วกด "บันทึกทับ"', onclick: () => openOrb(id) }, 'เปิดในแท่นทดลอง') : null;
    let del: Node | null = null;
    if (st.canEdit) {
      const b = h('button', { class: 'small danger', title: owners ? 'ลบไม่ได้: มีบัญชีที่มีชิ้นนี้ (ซ่อนไว้แทนได้)' : 'ลบชิ้นนี้ออกจากร้าน' }, 'ลบ');
      b.disabled = owners > 0;
      b.onclick = () => void remove(id);
      del = b;
    }
    return h('td', {}, h('span', { style: 'color:#9ad0ff' }, '● '), name, ' ', h('span', { class: 'muted' }, `${id} · ${owners} บัญชีมี`), ' ', open, ' ', del);
  };

  /** The picked orb look value of one piece. */
  const orbValueBox = (id: string): HTMLElement => {
    const k = orbPicked;
    const savedV = savedOrb(id)?.look[k];
    const disabled = !st.canEdit;
    if (k === 'palette' || k === 'shape') {
      const ids: readonly string[] = k === 'palette' ? ORB_PALETTE_IDS : ORB_SHAPE_IDS;
      const names: Record<string, string> = k === 'palette' ? ORB_PALETTE_NAME : ORB_SHAPE_NAME;
      const s = h('select', {}, ...ids.map((v) => h('option', { value: v }, names[v])));
      s.value = orbLook[id][k];
      s.disabled = disabled;
      const mark = () => { s.style.outline = s.value !== savedV ? CHANGED : ''; };
      s.onchange = () => {
        (orbLook[id] as unknown as Record<string, string>)[k] = s.value;
        mark();
      };
      mark();
      return s;
    }
    if (k === 'softGlow') return boolBox(orbLook[id].softGlow, savedV === true, disabled, (v) => { orbLook[id].softGlow = v; });
    const [lo, hi] = ORB_LOOK_RANGES[k];
    return numberBox(orbLook[id][k], savedV as number | undefined, lo, hi, ORB_FIELD[k].step ?? 0.01, disabled, (v) => { orbLook[id][k] = v; });
  };

  /** Deletes an orb look right away (asked first); unsaved edits are dropped with the reload. */
  const remove = async (id: string): Promise<void> => {
    const it = savedOrb(id);
    if (!it || !confirm(`ลบลูกแก้ว "${it.name}" (${id}) ออกจากร้านเลยไหม? ลบแล้วกู้คืนไม่ได้ (ทำหน้าตาใหม่ได้) · ที่แก้ไว้แต่ยังไม่บันทึกจะหาย`)) return;
    try {
      await api('POST', '/admin/orb-items', { remove: id });
      await load();
      startEdit();
      draw();
      say(`✓ ลบ "${it.name}" แล้ว`, 'ok');
    } catch (e) {
      say(`ลบไม่สำเร็จ: ${(e as Error).message}`, 'bad');
    }
  };

  /** What would be saved: the shop settings, the look values and the orb looks that changed (or an error). */
  type Collected = { shop?: CosShop; look?: { paste: CosTuning; after: CosTuning }; orbs?: { edit: Record<string, { name?: string; look?: OrbLook }>; after: OrbItems } };
  const collect = (): Collected & { error?: string } => {
    const out: Collected = {};
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

      const edit: Record<string, { name?: string; look?: OrbLook }> = {};
      const items = st.orbs.items.map((it) => {
        const n = checkOrbName(orbName[it.id]);
        if (!n.name) throw new Error(`${it.id}: ${n.error}`);
        const l = { ...orbLook[it.id] };
        for (const k of Object.keys(ORB_LOOK_RANGES) as OrbLookNumber[]) {
          const [lo, hi] = ORB_LOOK_RANGES[k];
          if (!(l[k] >= lo && l[k] <= hi)) throw new Error(`${n.name}: ${ORB_FIELD[k].label} ต้องอยู่ระหว่าง ${lo} ถึง ${hi}`);
          l[k] = round2(l[k]);
        }
        const e: { name?: string; look?: OrbLook } = {};
        if (n.name !== it.name) e.name = n.name;
        if (!sameOrbLook(l, it.look)) e.look = l;
        if (e.name || e.look) edit[it.id] = e;
        return { ...it, name: n.name, look: l };
      });
      if (Object.keys(edit).length) out.orbs = { edit, after: { next: st.orbs.next, items } };
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
    let c: ReturnType<typeof collect>;
    try {
      c = collect();
    } catch (e) {
      return say((e as Error).message, 'bad');
    }
    if (c.error) return say(c.error, 'bad');
    const lines = [
      ...(c.shop ? cosShopChanges(st.shop, c.shop).split(', ') : []),
      ...(c.orbs ? orbItemsChanges(st.orbs, c.orbs.after).split(' · ') : []),
      ...(c.look ? cosTuningChanges(st.tuning, c.look.after).split(', ') : []),
    ].filter(Boolean);
    if (!lines.length) return say('ไม่มีอะไรเปลี่ยน');
    const shownLines = lines.length > 40 ? [...lines.slice(0, 40), `…และอีก ${lines.length - 40} รายการ`] : lines;
    if (!confirm(`บันทึก ${lines.length} รายการนี้ ใช้กับผู้เล่นทุกคนทันที?\n\n${shownLines.join('\n')}`)) return;
    try {
      // Each with what this page was showing (`base`): if the server's changed since, it refuses (409).
      if (c.orbs) await api('POST', '/admin/orb-items', { edit: c.orbs.edit, base: st.orbs });
      if (c.shop) await api('POST', '/admin/cos-shop', { shop: c.shop, base: st.shop });
      if (c.look) await api('POST', '/admin/cos-look', { paste: c.look.paste, base: st.tuning });
      await load();
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
      await load();
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
      + 'ราคาเป็นเพชร ยังไม่เปิดขาย ผู้เล่นไม่เห็น · ค่าหน้าตา: เลือกค่าที่แก้ที่หัวแต่ละชนิด (ค่าเดียวกับในแท่นทดลอง "ของแต่งตัว"/"ลูกแก้วตีบวก") พิมพ์รายชิ้น หรือติ๊กหลายชิ้นแล้ว "บวก/ลบ" ทีเดียว · '
      + 'ช่องกรอบเหลือง = ต่างจากที่บันทึกไว้ (ยังไม่บันทึก) · เปลี่ยนค่าที่แก้ได้เรื่อย ๆ แล้วกดบันทึกครั้งเดียว'),
    !st.canEdit ? h('div', { class: 'muted' }, 'ซ่อน/ราคา และลูกแก้ว: ดูได้อย่างเดียว (ต้องมีสิทธิ์ "ซ่อน/ตั้งราคาของแต่งตัว")') : null,
    !st.canPaste ? h('div', { class: 'muted' }, 'ค่าหน้าตา (ปีก สัตว์ขี่ สัตว์เลี้ยง ออร่า): ดูได้อย่างเดียว (ต้องมีสิทธิ์ "บันทึกของแต่งตัวทั้งเซิร์ฟ")') : null,
    table,
    h('div', { style: 'display:flex;gap:8px;margin-top:8px;position:sticky;bottom:0;background:var(--panel);padding:6px 0' },
      canSave ? h('button', { class: 'primary', onclick: () => void save() }, 'บันทึก') : null,
      canSave ? h('button', { onclick: () => { startEdit(); draw(); say(''); } }, 'ยกเลิกที่แก้') : null,
      h('button', { onclick: () => void reload() }, 'โหลดค่าของเซิร์ฟใหม่')),
    msg));
}
