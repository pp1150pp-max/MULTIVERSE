import { CARD_DEFAULTS, CARD_FX, CARD_FX_MAX, CARD_FX_NAME, CARD_GROUPS, CARD_GROUP_NAME, CARD_NUM_FIELDS, CARD_RARITIES, CARD_RARITY_NAME, cardArt, cardName, type CardFx, type CardGroup, type CardId, type CardRarity } from '../../shared/data/cards';
import { cardLook, cardViewEl } from '../../client/cardView';
import { applyCardTuning, CARD_FX_LIMIT, type CardTuning } from '../../shared/cardTuning';
import { type AdminCardTune } from '../../shared/admin';
import { RARITY_COLOR } from '../../shared/types';
import { h, api, tab, view } from '../core';

// ------------------------------------------------------------ card tuning (plan: docs/plans/card-system.md)

/** What the tab edits: every card and every number in full (the server keeps only what differs from the code). */
interface CardWork {
  cards: Record<CardId, { rarity: CardRarity; group: CardGroup; fx: [CardFx | '', number][] }>;
  nums: Record<string, number>;
}

function cardWork(t: CardTuning): CardWork {
  const cards = {} as CardWork['cards'];
  for (const d of CARD_DEFAULTS) {
    const ch = t.cards?.[d.id];
    const fx = ch?.fx ?? d.fx;
    const rows: [CardFx | '', number][] = CARD_FX.filter((f) => fx[f] !== undefined).map((f) => [f, fx[f]!]);
    while (rows.length < CARD_FX_MAX) rows.push(['', 0]);
    cards[d.id] = { rarity: ch?.rarity ?? d.rarity, group: ch?.group ?? d.group, fx: rows };
  }
  const nums: Record<string, number> = {};
  for (const f of CARD_NUM_FIELDS) nums[f.key] = t.nums?.[f.key] ?? f.def;
  return { cards, nums };
}

/** The whole tab as tuning to send (effects without a kind chosen are left out). */
function workTuning(w: CardWork): CardTuning {
  const cards: NonNullable<CardTuning['cards']> = {};
  for (const d of CARD_DEFAULTS) {
    const c = w.cards[d.id];
    const fx: Partial<Record<CardFx, number>> = {};
    for (const [f, v] of c.fx) if (f) fx[f] = v;
    cards[d.id] = { rarity: c.rarity, group: c.group, fx };
  }
  return { cards, nums: { ...w.nums } };
}

/**
 * A card full size over the page as players will see it (src/client/cardView.ts), with the tab's current values,
 * saved or not: its group and effects, and the look numbers. A click outside the card or Esc closes it.
 */
function showCardArt(id: CardId, w: CardWork): void {
  const close = () => {
    over.remove();
    window.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  const c = w.cards[id];
  const fx: Partial<Record<CardFx, number>> = {};
  for (const [f, v] of c.fx) if (f) fx[f] = v;
  const cardEl = cardViewEl({ id, rarity: c.rarity, group: c.group, fx }, cardLook((k) => w.nums[k] ?? 0, c.rarity));
  cardEl.onclick = (e) => e.stopPropagation();
  const over = h('div', { class: 'card-art-view', onclick: close }, cardEl,
    h('div', { class: 'muted', style: 'font-size:13px' }, 'ขยับเมาส์บนการ์ดเพื่อดูแสงสะท้อน · คลิกที่ว่างหรือกด Esc เพื่อปิด'));
  window.addEventListener('keydown', onKey);
  document.body.append(over);
}

/** The "การ์ด" tab: every card's group and effects, and every number of the card system. */
export async function renderCards(): Promise<void> {
  const box = h('div', {}, 'กำลังโหลด…');
  view.append(box);
  let st: AdminCardTune;
  try {
    st = await api<AdminCardTune>('GET', '/admin/card-tune');
  } catch (e) {
    box.textContent = `โหลดไม่สำเร็จ: ${(e as Error).message}`;
    return;
  }
  if (tab !== 'cards' || !box.isConnected) return;
  const canEdit = st.canEdit;
  applyCardTuning(st.tuning);
  const def = cardWork({});
  let savedJson = JSON.stringify(workTuning(cardWork(st.tuning)));
  let work = cardWork(st.tuning);
  const msg = h('div', { class: 'msg' });
  const save = h('button', { class: 'primary' }, 'บันทึกเป็นค่าของทั้งเซิร์ฟ');
  const discard = h('button', {}, 'ยกเลิกที่ยังไม่บันทึก');
  const reset = h('button', { class: 'small' }, 'คืนค่าในโค้ดทั้งหมด');
  const sum = h('div', { class: 'muted', style: 'margin-bottom:6px' });
  const mark = (el: Element, on: boolean) => el.classList.toggle('changed', on);

  // ---- the 26 cards
  const body = h('tbody');
  const cardRow = (id: CardId): HTMLTableRowElement => {
    const d = CARD_DEFAULTS.find((x) => x.id === id)!;
    const c = work.cards[id];
    const group = h('select', { disabled: !canEdit },
      ...CARD_GROUPS.map((g) => h('option', { value: g, selected: g === c.group }, CARD_GROUP_NAME[g])));
    group.onchange = () => {
      c.group = group.value as CardGroup;
      update();
    };
    // Rarity per card (owner 2026-11-26): sell price, colour, frame and the fusion pool follow it.
    const rarity = h('select', { disabled: !canEdit, style: `color:${RARITY_COLOR[c.rarity]}` },
      ...CARD_RARITIES.map((r) => h('option', { value: r, selected: r === c.rarity, style: `color:${RARITY_COLOR[r]}` }, CARD_RARITY_NAME[r])));
    rarity.onchange = () => {
      c.rarity = rarity.value as CardRarity;
      rarity.style.color = RARITY_COLOR[c.rarity];
      update();
    };
    const fxBox = h('div', { class: 'card-fx' });
    for (const row of c.fx) {
      const sel = h('select', { disabled: !canEdit }, h('option', { value: '' }, '— ไม่มี —'),
        ...CARD_FX.map((f) => h('option', { value: f, selected: f === row[0] }, CARD_FX_NAME[f])));
      const num = h('input', { type: 'number', min: 0, max: CARD_FX_LIMIT, step: 0.1, value: row[0] ? String(row[1]) : '', disabled: !canEdit || !row[0], style: 'width:80px' });
      sel.onchange = () => {
        row[0] = sel.value as CardFx | '';
        num.disabled = !canEdit || !row[0];
        if (!row[0]) num.value = '';
        else if (!num.value) num.value = '1';
        row[1] = Number(num.value) || 0;
        update();
      };
      num.oninput = () => {
        row[1] = Number(num.value);
        update();
      };
      fxBox.append(h('div', { class: 'row', style: 'align-items:center;margin-bottom:3px' }, sel, num));
    }
    return h('tr', { 'data-card': id },
      h('td', { 'data-label': 'แมพ' }, `ชั้น ${d.floor} แมพ ${d.map}`, d.dropFrom ? h('div', { class: 'muted' }, 'ดรอปตอนฆ่ากัปตันขาไม้') : null),
      h('td', { 'data-label': 'การ์ด' },
        h('img', { class: 'card-thumb', src: cardArt(id), alt: cardName(id), title: 'คลิกเพื่อดูภาพใหญ่', loading: 'lazy', onclick: () => showCardArt(id, work) }),
        h('div', {}, cardName(id))),
      h('td', { 'data-label': 'ระดับ' }, rarity, h('div', { class: 'muted' }, `ในโค้ด ${CARD_RARITY_NAME[d.rarity]}`)),
      h('td', { 'data-label': 'ใส่ได้' }, group),
      h('td', { 'data-label': 'ผล' }, fxBox),
    );
  };

  // ---- the numbers, under their headings
  const numInputs = new Map<string, HTMLInputElement>();
  const numCard = h('div', { class: 'card' }, h('h2', {}, 'ตัวเลขของระบบการ์ด'));
  for (const g of [...new Set(CARD_NUM_FIELDS.map((f) => f.group))]) {
    numCard.append(h('h3', { class: 'card-num-head' }, g));
    if (g.startsWith('เจาะรู')) numCard.append(sum);
    for (const f of CARD_NUM_FIELDS.filter((x) => x.group === g)) {
      const inp = h('input', { type: 'number', min: f.min, max: f.max, step: f.step, disabled: !canEdit, style: 'width:130px' });
      inp.oninput = () => {
        work.nums[f.key] = Number(inp.value);
        update();
      };
      numInputs.set(f.key, inp);
      numCard.append(h('div', { class: 'row card-num', style: 'align-items:center' },
        h('span', { style: 'flex:1 1 260px' }, f.name),
        inp, h('span', { class: 'muted', style: 'width:20px' }, f.unit),
        h('span', { class: 'muted', style: 'width:150px' }, `ค่าในโค้ด ${f.def.toLocaleString()}`)));
    }
  }

  const update = () => {
    // Yellow = differs from the code default.
    const now = workTuning(work);
    const base = workTuning(def);
    for (const tr of body.querySelectorAll<HTMLTableRowElement>('tr')) {
      const id = tr.dataset.card as CardId;
      mark(tr.cells[2], now.cards![id]!.rarity !== base.cards![id]!.rarity);
      mark(tr.cells[3], now.cards![id]!.group !== base.cards![id]!.group);
      mark(tr.cells[4], JSON.stringify(now.cards![id]!.fx) !== JSON.stringify(base.cards![id]!.fx));
    }
    for (const [k, inp] of numInputs) mark(inp, work.nums[k] !== def.nums[k]);
    const total = work.nums.drill0 + work.nums.drill1 + work.nums.drill2;
    const sumOk = Math.abs(total - 100) < 1e-6;
    sum.textContent = `รวม 3 ช่องตอนนี้ ${Math.round(total * 10) / 10}%`;
    sum.className = sumOk ? 'muted' : 'warn';
    const dirty = JSON.stringify(now) !== savedJson;
    save.disabled = !canEdit || !dirty || !sumOk;
    discard.disabled = !dirty;
  };

  const draw = () => {
    body.replaceChildren(...CARD_DEFAULTS.map((d) => cardRow(d.id)));
    for (const [k, inp] of numInputs) inp.value = String(work.nums[k]);
    update();
  };
  const load = (s: AdminCardTune) => {
    // The rest of the admin page (item picker, item editor) follows the saved tuning too.
    applyCardTuning(s.tuning);
    savedJson = JSON.stringify(workTuning(cardWork(s.tuning)));
    work = cardWork(s.tuning);
    draw();
  };
  const say = (ok: boolean, text: string) => {
    msg.className = ok ? 'msg ok' : 'msg bad';
    msg.textContent = text;
  };
  save.onclick = async () => {
    if (!confirm('บันทึกค่าการ์ดนี้เป็นค่าของทั้งเซิร์ฟ?')) return;
    save.disabled = true;
    try {
      load(await api<AdminCardTune>('POST', '/admin/card-tune', { tuning: workTuning(work) }));
      say(true, 'บันทึกแล้ว ใช้ทั้งเซิร์ฟทันที');
    } catch (e) {
      say(false, (e as Error).message);
      update();
    }
  };
  discard.onclick = () => {
    work = cardWork(JSON.parse(savedJson) as CardTuning);
    msg.textContent = '';
    draw();
  };
  reset.onclick = async () => {
    if (!confirm('คืนค่าการ์ดทั้งหมดเป็นค่าในโค้ด และบันทึกทั้งเซิร์ฟเลย?')) return;
    try {
      load(await api<AdminCardTune>('POST', '/admin/card-tune', { reset: true }));
      say(true, 'คืนค่าในโค้ดแล้ว');
    } catch (e) {
      say(false, (e as Error).message);
    }
  };

  box.replaceChildren(
    h('div', { class: 'card card-save' },
      h('div', { class: 'row', style: 'align-items:center' },
        h('span', { class: 'muted', style: 'flex:1 1 300px' }, canEdit
          ? 'ช่องสีเหลือง = ต่างจากค่าในโค้ด · ระบบการ์ดในเกมยังไม่เปิด ค่าที่บันทึกไว้จะใช้ทันทีที่เปิด'
          : 'ดูได้อย่างเดียว (ต้องมีสิทธิ์ "แก้ค่าการ์ดทั้งเซิร์ฟ" จึงจะบันทึกได้)'),
        canEdit && reset, canEdit && discard, canEdit && save),
      msg),
    h('div', { class: 'card' }, h('h2', {}, `การ์ด ${CARD_DEFAULTS.length} ใบ (ชั้น 1 + ชั้น 2)`),
      h('div', { class: 'muted', style: 'margin:-6px 0 10px' }, `การ์ด 1 ใบมีผลได้ 1–${CARD_FX_MAX} อย่าง ค่าเป็นเปอร์เซ็นต์ (มากกว่า 0 ไม่เกิน ${CARD_FX_LIMIT})`),
      h('table', { class: 'cards' },
        h('thead', {}, h('tr', {}, h('th', {}, 'แมพ'), h('th', {}, 'การ์ด'), h('th', {}, 'ระดับ'), h('th', {}, 'ใส่ได้'), h('th', {}, 'ผล'))),
        body)),
    numCard,
  );
  draw();
}
