// Account sheet of the admin page: worn gear, bag and stash drawn as slot grids like the game's bag
// (icon, rarity colour, +N, count). Clicking a slot shows everything about the entry (like the game's
// tooltip) and, with the `itemEdit` tool, a form that changes any part of it or deletes it. The server
// (server/admin-items.ts) checks every value; this page is only a view.
// Icons are built here from itemArt (src/client/icons.ts would pull the game's 3D code into this page).
import { ADMIN_ITEM_ROWS_MAX, ADMIN_PITY_MAX, adminRowInfo, entrySig, type AdminItemPlace, type AdminItemRow, type AdminMeta } from '../shared/admin';
import { itemArt, itemClass, itemNames, roundStat, rowRanges } from '../shared/data/items';
import { enhanceBonus, itemName, plusOf, sellValue } from '../shared/data/enhance';
import { CLASSES, CLASS_IDS } from '../shared/data/classes';
import { POTION_SIZE_LABEL, potionName, potionSellPrice, stackLimit } from '../shared/data/potions';
import { STONE_COLOR, STONE_DESC, STONE_NAME, stoneSellPrice } from '../shared/data/stones';
import { drawIcon } from '../client/placeholder';
import {
  EQUIP_SLOTS, EQUIP_SLOT_LABEL, isPotion, isStack, isStone, RARITY_COLOR, RARITY_LABEL, SLOT_LABEL, SLOTS, STAT_KEYS, STAT_LABEL, wornPlaces,
  type BagEntry, type ClassId, type EquipSlot, type Item, type Rarity, type StatLine,
} from '../shared/types';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

/** What the grids need from the page. */
export interface ItemCtx {
  h: H;
  api: Api;
  meta: AdminMeta;
  /** May edit / delete (the itemEdit tool). */
  canEdit: boolean;
  /** After a saved edit: redraw the sheet with this message. */
  done: (msg: string) => void;
}

/** Which grid a slot belongs to, for the request. */
export type ItemOwner = { place: 'equip' | 'bag'; charId: number; cls: ClassId; level: number } | { place: 'stash'; accountId: number };

const POTION_COLOR = { hp: '#e8323c', mp: '#3a7bff' } as const;
const fmtNum = (v: number): string => (Number.isInteger(v) ? v.toLocaleString() : String(v));

const fallback = new Map<string, string>();
function img(file: string, alt: () => HTMLCanvasElement, key: string): HTMLImageElement {
  const el = document.createElement('img');
  el.className = 'gi';
  el.alt = '';
  el.draggable = false;
  el.src = `assets/sprites/icons/${file}.png`;
  el.onerror = () => {
    el.onerror = null;
    let src = fallback.get(key);
    if (!src) fallback.set(key, (src = alt().toDataURL()));
    el.src = src;
  };
  return el;
}

function entryIcon(e: BagEntry): HTMLImageElement {
  if (isPotion(e)) return img(`potion_${e.potion}_${e.size}`, () => drawIcon(`potion_${e.potion}`), `p${e.potion}`);
  if (isStone(e)) return img(`stone_${e.stone.replace(/^qkey_/, 'key_')}`, () => drawIcon(`stone_${e.stone}`), e.stone);
  return img(itemArt(e), () => drawIcon('bag'), 'bag');
}

const entryColor = (e: BagEntry): string => (isPotion(e) ? POTION_COLOR[e.potion] : isStone(e) ? STONE_COLOR[e.stone] : RARITY_COLOR[e.rarity]);

/** One slot: the entry's icon with +N / level / count, or empty (with a label). */
function cell(ctx: ItemCtx, e: BagEntry | null | undefined, label: string, onPick: (el: HTMLElement) => void): HTMLElement {
  const { h } = ctx;
  if (!e) return h('div', { class: 'icell empty', title: label }, label ? h('span', { class: 'ph' }, label) : null);
  const kids: Node[] = [entryIcon(e)];
  if (isStack(e)) {
    if (isPotion(e)) kids.push(h('span', { class: 'psize' }, POTION_SIZE_LABEL[e.size]));
    kids.push(h('span', { class: 'ilv' }, `×${e.count}`));
  } else {
    if (plusOf(e)) kids.push(h('span', { class: 'iplus' }, `+${plusOf(e)}`));
    kids.push(h('span', { class: 'ilv' }, `Lv.${e.level}`));
  }
  const el = h('button', { type: 'button', class: 'icell', style: `--rc:${entryColor(e)}`, title: isStack(e) ? '' : itemName(e) }, ...kids);
  el.onclick = () => onPick(el);
  return el;
}

/**
 * A grid of slots (worn places when `equip`, else bag / stash slots in order) with the detail panel
 * under it. Clicking a slot opens its panel; clicking it again closes it.
 */
export function itemGrid(ctx: ItemCtx, owner: ItemOwner, entries: { key: EquipSlot | number; e: BagEntry | null | undefined }[]): HTMLElement {
  const { h } = ctx;
  const detail = h('div', { class: 'idetail hidden' });
  let open: HTMLElement | null = null;
  const cells = entries.map(({ key, e }) => {
    const label = typeof key === 'number' ? '' : EQUIP_SLOT_LABEL[key];
    return cell(ctx, e, label, (el) => {
      open?.classList.remove('sel');
      if (open === el) {
        open = null;
        detail.classList.add('hidden');
        return;
      }
      open = el;
      el.classList.add('sel');
      detail.classList.remove('hidden');
      detail.replaceChildren(entryDetail(ctx, owner, key, e!));
    });
  });
  return h('div', {}, h('div', { class: owner.place === 'equip' ? 'igrid equip' : 'igrid' }, ...cells), detail);
}

/** Worn places in the game's order. */
export const equipEntries = (eq: Partial<Record<EquipSlot, Item>>) => EQUIP_SLOTS.map((s) => ({ key: s, e: eq[s] }));
export const listEntries = (list: (BagEntry | null)[]) => list.map((e, i) => ({ key: i, e }));

// ------------------------------------------------------------ the detail panel (like the game's tooltip)

function lineEl(h: H, l: StatLine): HTMLElement {
  return h('div', { class: 'tt-line' }, `+${fmtNum(l.value)} ${STAT_LABEL[l.stat]} `,
    h('span', { class: `tier t${l.tier}` }, `T${l.tier}: ${fmtNum(l.min)}–${fmtNum(l.max)}`));
}

function gearInfo(h: H, it: Item): HTMLElement {
  const bonus = enhanceBonus(it);
  const bonusText = (Object.keys(bonus) as (keyof typeof bonus)[]).filter((k) => bonus[k]).map((k) => `+${Math.round((bonus[k] ?? 0) * 10) / 10} ${STAT_LABEL[k]}`).join(' · ');
  const totals = (Object.keys(it.stats) as (keyof typeof it.stats)[]).map((k) => h('div', {}, `+${fmtNum(it.stats[k] ?? 0)} ${STAT_LABEL[k]}`));
  const cls = itemClass(it);
  return h('div', { class: 'tt' },
    h('div', { class: 'tt-name', style: `color:${RARITY_COLOR[it.rarity]}` }, itemName(it)),
    h('div', { class: 'tt-sub' }, `${RARITY_LABEL[it.rarity]} · ${SLOT_LABEL[it.slot]} · iLv.${it.level}${plusOf(it) ? ` · ตีบวก +${plusOf(it)}` : ''}`),
    h('div', { class: 'tt-stats' }, ...(it.lines?.length ? it.lines.map((l) => lineEl(h, l)) : totals.length ? totals : [h('div', {}, '—')])),
    bonusText ? h('div', { class: 'tt-enh' }, `ตีบวก: ${bonusText}`) : null,
    h('div', { class: 'tt-meta' }, `${cls ? `ใส่ได้เฉพาะสาย ${CLASSES[cls].nameTh}` : 'ทุกอาชีพ'} · pity ${it.pity ?? 0} · ขายได้ ${sellValue(it).toLocaleString()} G`),
    h('div', { class: 'tt-meta muted' }, `uid ${it.uid} · ชนิด ${it.baseId}`),
  );
}

function stackInfo(h: H, e: BagEntry): HTMLElement {
  if (isPotion(e)) {
    return h('div', { class: 'tt' },
      h('div', { class: 'tt-name', style: `color:${POTION_COLOR[e.potion]}` }, potionName(e.potion, e.size)),
      h('div', { class: 'tt-sub' }, `ยา · ${e.count} / ${stackLimit(e)} ขวด`),
      h('div', { class: 'tt-meta' }, `ขายได้ขวดละ ${potionSellPrice(e.potion, e.size).toLocaleString()} G`));
  }
  if (!isStone(e)) return h('div');
  return h('div', { class: 'tt' },
    h('div', { class: 'tt-name', style: `color:${STONE_COLOR[e.stone]}` }, STONE_NAME[e.stone]),
    h('div', { class: 'tt-sub' }, `${e.count} / ${stackLimit(e)}`),
    h('div', { class: 'tt-stats' }, STONE_DESC[e.stone]),
    h('div', { class: 'tt-meta' }, `ขายได้ชิ้นละ ${stoneSellPrice(e.stone).toLocaleString()} G`));
}

function entryDetail(ctx: ItemCtx, owner: ItemOwner, key: EquipSlot | number, e: BagEntry): HTMLElement {
  const { h } = ctx;
  const info = isStack(e) ? stackInfo(h, e) : gearInfo(h, e);
  if (!ctx.canEdit) return info;
  return h('div', { class: 'idetail-body' }, info, isStack(e) ? stackEditor(ctx, owner, key, e) : gearEditor(ctx, owner, key, e));
}

// ------------------------------------------------------------ editors

/** Sends an edit of the slot; shows the error in `msg`, or redraws the sheet on success. */
async function send(ctx: ItemCtx, owner: ItemOwner, key: EquipSlot | number, e: BagEntry, body: Record<string, unknown>, msg: HTMLElement, btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true;
  msg.className = 'msg';
  msg.textContent = 'กำลังส่ง…';
  const who = owner.place === 'stash' ? { accountId: owner.accountId } : { charId: owner.charId };
  try {
    const r = await ctx.api<{ msg: string }>('POST', '/admin/items', { place: owner.place as AdminItemPlace, ...who, key, sig: entrySig(e), ...body });
    ctx.done(r.msg);
  } catch (err) {
    msg.className = 'msg bad';
    msg.textContent = (err as Error).message;
    btn.disabled = false;
  }
}

function deleteButton(ctx: ItemCtx, owner: ItemOwner, key: EquipSlot | number, e: BagEntry, msg: HTMLElement): HTMLButtonElement {
  const btn = ctx.h('button', { type: 'button', class: 'danger' }, 'ลบไอเทมนี้');
  btn.onclick = () => {
    const name = isStack(e) ? (isPotion(e) ? potionName(e.potion, e.size) : isStone(e) ? STONE_NAME[e.stone] : '') : itemName(e);
    if (!confirm(`ลบ ${name}${isStack(e) ? ` ×${e.count}` : ''} ทิ้งถาวร?\n(ลงประวัติ audit)`)) return;
    void send(ctx, owner, key, e, { op: 'delete' }, msg, btn);
  };
  return btn;
}

function stackEditor(ctx: ItemCtx, owner: ItemOwner, key: EquipSlot | number, e: BagEntry & { count: number }): HTMLElement {
  const { h } = ctx;
  const msg = h('div', { class: 'msg' });
  const limit = stackLimit(e as Parameters<typeof stackLimit>[0]);
  const count = h('input', { type: 'number', inputMode: 'numeric', value: String(e.count), min: '1', max: String(limit), step: '1' });
  const save = h('button', { type: 'button', class: 'primary' }, 'บันทึก');
  save.onclick = () => void send(ctx, owner, key, e, { op: 'save', count: Math.trunc(Number(count.value)) }, msg, save);
  return h('section', { class: 'iedit' }, h('h3', {}, 'แก้ไข'),
    h('div', { class: 'row' }, h('label', {}, `จำนวน (1–${limit})`, count), save, deleteButton(ctx, owner, key, e, msg)), msg);
}

function gearEditor(ctx: ItemCtx, owner: ItemOwner, key: EquipSlot | number, it: Item): HTMLElement {
  const { h, meta: m } = ctx;
  const msg = h('div', { class: 'msg' });
  const worn = owner.place === 'equip' ? (key as EquipSlot) : null;
  const draft = {
    baseId: it.baseId, rarity: it.rarity, level: it.level, classId: (itemClass(it) ?? (owner.place !== 'stash' ? owner.cls : CLASS_IDS[0])) as ClassId,
    name: it.name, plus: plusOf(it), pity: it.pity ?? 0,
    rows: (it.lines ?? []).map((l) => ({ stat: l.stat, value: l.value })) as AdminItemRow[],
  };
  // Items from before tiers have totals only: they start as one row per total.
  if (!it.lines?.length) draft.rows = (Object.keys(it.stats) as AdminItemRow['stat'][]).map((k) => ({ stat: k, value: it.stats[k] ?? 0 }));

  const num = (value: number, min: number, max: number, step = 1) => h('input', { type: 'number', value: String(value), min: String(min), max: String(max), step: String(step) });
  const cls = h('select', {}, ...CLASS_IDS.map((k) => h('option', { value: k, selected: k === draft.classId }, CLASSES[k].nameTh)));
  const base = h('select');
  const rarity = h('select', {}, ...m.rarities.map((r) => h('option', { value: r, selected: r === draft.rarity, style: `color:${RARITY_COLOR[r]}` }, RARITY_LABEL[r])));
  const level = num(draft.level, 1, m.maxLevel);
  const name = h('select');
  const plus = h('select', {}, ...Array.from({ length: m.maxPlus + 1 }, (_, i) => h('option', { value: String(i), selected: i === draft.plus }, `+${i}`)));
  const pity = num(draft.pity, 0, ADMIN_PITY_MAX);
  const rowsBox = h('div', { class: 'example' });

  const fillBases = () => {
    base.replaceChildren();
    for (const slot of SLOTS) {
      // A worn item may only become something worn in the same place.
      if (worn && !wornPlaces(slot).includes(worn)) continue;
      const list = m.bases.filter((b) => b.slot === slot && (b.names.any || b.names[draft.classId]));
      if (!list.length) continue;
      base.append(h('optgroup', { label: SLOT_LABEL[slot] }, ...list.map((b) =>
        h('option', { value: b.id }, `${b.names[draft.classId] ?? b.names.any ?? b.id} (Lv.${b.minLevel}+)`))));
    }
    if ([...base.options].some((o) => o.value === draft.baseId)) base.value = draft.baseId;
    draft.baseId = base.value;
  };
  const fillNames = () => {
    const names = itemNames(draft.baseId, draft.rarity, draft.classId);
    name.replaceChildren(...names.map((n) => h('option', { value: n }, n)));
    if (names.includes(draft.name)) name.value = draft.name;
    draft.name = name.value;
  };
  const minLevel = () => m.bases.find((b) => b.id === draft.baseId)?.minLevel ?? 1;

  const drawRows = () => {
    rowsBox.replaceChildren();
    const stats = draft.rows.map((r) => r.stat);
    const rows = draft.rows.map((row, i) => {
      const infoEl = h('span', { class: 'muted' });
      const showInfo = () => {
        const r = adminRowInfo(draft.baseId, draft.rarity, draft.level, stats, i, row.value);
        if (!r) return void (infoEl.textContent = '');
        const bad = !(row.value >= r.step && row.value <= r.top);
        infoEl.textContent = `ปกติ ${r.min}–${r.max} · T${r.tier} (${r.tmin}–${r.tmax})${r.main ? ' · สเตตัสหลัก' : ''}${bad ? ` · ต้องอยู่ระหว่าง ${r.step}–${r.top}` : ''}`;
        infoEl.style.color = bad ? 'var(--bad)' : '';
      };
      const stat = h('select', {}, ...STAT_KEYS.map((k) => h('option', { value: k, selected: k === row.stat }, STAT_LABEL[k])));
      stat.onchange = () => {
        row.stat = stat.value as AdminItemRow['stat'];
        const r = rowRanges(draft.baseId, draft.rarity, draft.level, draft.rows.map((x) => x.stat))?.[i];
        if (r) row.value = roundStat(row.stat, (r.lo + r.hi) / 2);
        drawRows();
      };
      const val = h('input', { type: 'number', value: String(row.value), step: 'any' });
      val.oninput = () => {
        row.value = Number(val.value);
        showInfo();
      };
      const del = h('button', { class: 'small', type: 'button', title: 'ลบแถว' }, '✕');
      del.onclick = () => {
        draft.rows.splice(i, 1);
        drawRows();
      };
      showInfo();
      return h('div', { class: 'row example-row' }, stat, val, infoEl, del);
    });
    const add = h('button', { class: 'small', type: 'button', disabled: draft.rows.length >= ADMIN_ITEM_ROWS_MAX }, '+ เพิ่มแถว');
    add.onclick = () => {
      const used = new Set(draft.rows.map((r) => r.stat));
      const stat = STAT_KEYS.find((k) => !used.has(k)) ?? 'atk';
      const r = rowRanges(draft.baseId, draft.rarity, draft.level, [...draft.rows.map((x) => x.stat), stat])?.at(-1);
      draft.rows.push({ stat, value: r ? roundStat(stat, (r.lo + r.hi) / 2) : 1 });
      drawRows();
    };
    rowsBox.append(
      h('div', { class: 'sub', style: 'margin:0' }, 'สเตตัส (tier คำนวณจากค่าเอง)'),
      ...rows,
      ...(draft.rows.length ? [] : [h('div', { class: 'muted' }, 'ไม่มีสเตตัส')]),
      h('div', { class: 'row' }, add, h('span', { class: 'muted' }, `สูงสุด ${ADMIN_ITEM_ROWS_MAX} แถว · ค่าได้ถึง 2 เท่าของค่าสูงสุดปกติ`)),
    );
  };

  const changed = () => {
    if (draft.level < minLevel()) level.value = String((draft.level = minLevel()));
    fillNames();
    drawRows();
  };
  cls.onchange = () => {
    draft.classId = cls.value as ClassId;
    fillBases();
    changed();
  };
  base.onchange = () => {
    draft.baseId = base.value;
    changed();
  };
  rarity.onchange = () => {
    draft.rarity = rarity.value as Rarity;
    changed();
  };
  level.onchange = () => {
    draft.level = Math.trunc(Number(level.value)) || 1;
    changed();
  };
  name.onchange = () => (draft.name = name.value);
  plus.onchange = () => (draft.plus = Number(plus.value));
  pity.oninput = () => (draft.pity = Math.trunc(Number(pity.value)));
  fillBases();
  fillNames();
  drawRows();

  const save = h('button', { type: 'button', class: 'primary' }, 'บันทึก');
  save.onclick = () => void send(ctx, owner, key, it, {
    op: 'save', baseId: draft.baseId, rarity: draft.rarity, level: draft.level, classId: draft.classId, name: draft.name,
    plus: draft.plus, pity: draft.pity, lines: draft.rows,
  }, msg, save);
  const reqNote = worn && owner.place !== 'stash'
    ? h('div', { class: 'muted' }, `สวมอยู่ช่อง${EQUIP_SLOT_LABEL[worn]}: ต้องเป็นของช่องนี้ ของสาย ${CLASSES[owner.cls].nameTh} และไม่เกิน Lv.${owner.level}`)
    : null;
  return h('section', { class: 'iedit' }, h('h3', {}, 'แก้ไข'),
    reqNote,
    h('div', { class: 'row' }, h('label', {}, 'อาชีพ', cls), h('label', { style: 'flex:1' }, 'ชนิด', base)),
    h('div', { class: 'row' }, h('label', {}, 'ความหายาก', rarity), h('label', {}, 'เลเวล', level), h('label', { style: 'flex:1' }, 'ชื่อ', name)),
    h('div', { class: 'row' }, h('label', {}, 'ตีบวก', plus), h('label', {}, `pity (0–${ADMIN_PITY_MAX})`, pity)),
    rowsBox,
    h('div', { class: 'row' }, save, deleteButton(ctx, owner, key, it, msg)),
    msg);
}
