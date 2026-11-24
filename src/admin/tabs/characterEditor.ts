import { ADMIN_SET_SIZE, ADMIN_ITEM_ROWS_MAX, ADMIN_STAT_MULT, statStep, type AdminItemRow, type AdminCharRow, type AdminEditResult, type AdminOnline } from '../../shared/admin';
import { POTION_SIZES, potionName } from '../../shared/data/potions';
import { STONE_NAME } from '../../shared/data/stones';
import { CLASS_IDS } from '../../shared/data/classes';
import { itemNames, makeItem, roundStat, rowRanges, tierOf } from '../../shared/data/items';
import { RARITY_COLOR, RARITY_LABEL, SLOT_LABEL, SLOTS, STAT_KEYS, STAT_LABEL, BLACKSMITH_STONES, BOSS_KEYS, REWARD_ITEMS, type ClassId, type Rarity } from '../../shared/types';
import { h, api, fmt, className, meta, online, zoneName, view, sheet, setSheet, closeSheet, can } from '../core';

// ------------------------------------------------------------ search

let lastQuery = '';

export function renderSearch(): void {
  const q = h('input', { placeholder: 'ชื่อตัวละคร', value: lastQuery, autocapitalize: 'off' });
  const list = h('tbody');
  const msg = h('div', { class: 'msg' });
  const go = async () => {
    lastQuery = q.value.trim();
    if (!lastQuery) return;
    msg.className = 'msg';
    msg.textContent = 'กำลังค้นหา…';
    try {
      const rows = await api<AdminCharRow[]>('GET', `/admin/characters?q=${encodeURIComponent(lastQuery)}`);
      msg.textContent = rows.length ? '' : 'ไม่พบตัวละคร';
      list.replaceChildren(...rows.map((c) => {
        const cell = (label: string, content: Node | string, cls = '') => h('td', { 'data-label': label, class: cls }, content);
        return h('tr', { class: 'click', onclick: () => void openChar(c.charId) },
          cell('ตัวละคร', h('span', {}, c.name, h('span', { class: c.online ? 'tag on' : 'tag' }, c.online ? 'ออนไลน์' : 'ออฟไลน์')), 'head'),
          cell('บัญชี', c.username),
          cell('คลาส', className(c.classId)),
          cell('Lv', String(c.level), 'num'),
          cell('ทอง', fmt(c.gold), 'num'),
          cell('โซน', zoneName(c.zone)),
        );
      }));
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
    }
  };
  const form = h('form', { class: 'row' }, h('label', {}, 'ค้นหาตัวละคร (ทั้งออนไลน์และออฟไลน์)', q), h('button', { class: 'primary', type: 'submit' }, 'ค้นหา'));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    void go();
  });
  view.append(h('div', { class: 'card' }, form, msg,
    h('table', { class: 'cards', style: 'margin-top:10px' },
      h('thead', {}, h('tr', {}, ...['ตัวละคร', 'บัญชี', 'คลาส', 'Lv', 'ทอง', 'โซน'].map((t) => h('th', {}, t)))),
      list,
    )));
  if (lastQuery) void go();
  q.focus();
}

// ------------------------------------------------------------ character editor

/** The spawn/gold choices, kept while the sheet redraws after each edit (and between characters). */
const form = { baseId: '', rarity: 'common', plus: '0', count: '1', gold: '10000', level: '' };
/**
 * The example item of the chosen-stats spawn (owner): rolled like a drop, then edited. Kept while the
 * sheet redraws; `key` is what it was rolled for (kind, rarity, level, class), a change rolls a new one.
 */
let example: { key: string; name: string; rows: AdminItemRow[] } | null = null;


export async function openChar(charId: number): Promise<void> {
  let c: AdminCharRow;
  try {
    c = await api<AdminCharRow>('GET', `/admin/characters/${charId}`);
  } catch (e) {
    alert((e as Error).message);
    return;
  }
  renderSheet(c);
}

function renderSheet(c: AdminCharRow, note?: { text: string; ok: boolean }): void {
  if (!meta) return;
  const m = meta;
  // Redrawing after an edit keeps the scroll position, so the phone doesn't jump back to the top.
  const scroll = sheet?.scrollTop ?? 0;
  closeSheet();
  const result = h('div', { class: `msg ${note ? (note.ok ? 'ok' : 'bad') : ''}` }, note?.text ?? '');

  /** Sends one edit; on success the sheet redraws with the new numbers. */
  const run = async (what: string, body: unknown, btn: HTMLButtonElement, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    btn.disabled = true;
    result.className = 'msg';
    result.textContent = 'กำลังส่ง…';
    try {
      const r = await api<AdminEditResult>('POST', `/admin/characters/${c.charId}/${what}`, body);
      if (r.char) renderSheet(r.char, { text: r.msg, ok: true });
      else {
        result.className = 'msg ok';
        result.textContent = r.msg;
      }
    } catch (e) {
      result.className = 'msg bad';
      result.textContent = (e as Error).message;
      btn.disabled = false;
    }
  };
  const numInput = (value: number, min: number, max: number) => h('input', { type: 'number', inputMode: 'numeric', value: String(value), min: String(min), max: String(max), step: '1' });
  const intOf = (i: HTMLInputElement) => Math.trunc(Number(i.value));

  // Level
  const lv = numInput(c.level, 1, m.maxLevel);
  const exp = numInput(c.exp, 0, c.expToNext - 1);
  const lvBtn = h('button', { class: 'primary' }, 'ตั้งเลเวล');
  lvBtn.onclick = () => void run('level', { level: intOf(lv), exp: intOf(exp) }, lvBtn);

  // Gold
  const gold = numInput(Number(form.gold) || 10000, 1, m.goldMax);
  gold.oninput = () => (form.gold = gold.value);
  const giveBtn = h('button', { class: 'primary' }, 'ให้ทอง');
  const takeBtn = h('button', {}, 'ลดทอง');
  giveBtn.onclick = () => void run('gold', { delta: intOf(gold) }, giveBtn);
  takeBtn.onclick = () => void run('gold', { delta: -intOf(gold) }, takeBtn);

  // Items: gear is made for the class picked here (default: this character's), so a GM can hand over gear for another class to pass on.
  const forCls = h('select', {}, ...CLASS_IDS.map((k) => h('option', { value: k, selected: k === c.classId }, k === c.classId ? `${className(k)} (อาชีพตัวนี้)` : className(k))));
  const cls = (): ClassId => forCls.value as ClassId;
  const base = h('select');
  const fillBases = () => {
    const keep = base.value;
    base.replaceChildren();
    for (const slot of SLOTS) {
      const group = h('optgroup', { label: SLOT_LABEL[slot] });
      // Off-hands exist per class: only the picked class's are offered.
      for (const b of m.bases.filter((x) => x.slot === slot && (x.names.any || x.names[cls()]))) {
        group.append(h('option', { value: b.id }, `${b.names[cls()] ?? b.names.any ?? b.id} [${b.names.any ? 'ทุกอาชีพ' : className(cls())}] (Lv.${b.minLevel}+)`));
      }
      base.append(group);
    }
    // Potions and blacksmith stones share the list; their value is "potion:hp:l" / "stone:protect".
    base.append(
      h('optgroup', { label: 'ยา' }, ...(['hp', 'mp'] as const).flatMap((k) => POTION_SIZES.map((sz) => h('option', { value: `potion:${k}:${sz}` }, potionName(k, sz))))),
      h('optgroup', { label: 'หินช่างตีเหล็ก' }, ...BLACKSMITH_STONES.map((k) => h('option', { value: `stone:${k}` }, STONE_NAME[k]))),
      h('optgroup', { label: 'กุญแจห้องบอส (Artifact)' }, ...BOSS_KEYS.map((k) => h('option', { value: `stone:${k}` }, STONE_NAME[k]))),
      h('optgroup', { label: 'ของใช้ (ผูกตัวละคร)' }, ...REWARD_ITEMS.map((k) => h('option', { value: `stone:${k}` }, STONE_NAME[k]))),
    );
    if ([...base.options].some((o) => o.value === keep)) base.value = keep;
  };
  fillBases();
  /** The potion/stone picked, as the request fields; null while gear is picked. */
  const stackPick = (): Record<string, string> | null => {
    const [kind, a, b] = base.value.split(':');
    if (kind === 'potion') return { kind, potion: a, size: b };
    if (kind === 'stone') return { kind, stone: a };
    return null;
  };
  const rarity = h('select', {}, ...m.rarities.map((r) => h('option', { value: r, style: `color:${RARITY_COLOR[r]}` }, RARITY_LABEL[r])));
  const plus = h('select', {}, ...Array.from({ length: m.maxPlus + 1 }, (_, i) => h('option', { value: String(i) }, `+${i}`)));
  const plusWrap = h('label', {}, 'ตีบวก', plus);
  if ([...base.options].some((o) => o.value === form.baseId)) base.value = form.baseId;
  rarity.value = form.rarity;
  plus.value = form.plus;
  base.onchange = () => (form.baseId = base.value);
  rarity.onchange = () => (form.rarity = rarity.value);
  plus.onchange = () => (form.plus = plus.value);
  const itemLv = numInput(Number(form.level) || c.level, 1, m.maxLevel);
  itemLv.oninput = () => (form.level = itemLv.value);
  const count = numInput(Number(form.count) || 1, 1, m.itemsMax);
  count.oninput = () => (form.count = count.value);
  const itemBtn = h('button', { class: 'primary' }, 'เสกไอเทม');
  const custom = can('customItem');
  /** The item level actually used: a kind never comes below its own minimum level. */
  const effLevel = (): number => {
    const b = m.bases.find((x) => x.id === base.value);
    return Math.max(b?.minLevel ?? 1, Math.min(m.maxLevel, Math.max(1, intOf(itemLv) || 1)));
  };
  const exampleBox = h('div', { class: 'example' });
  /** Rolls a new example for the current choices (or keeps the one already made for them). */
  const ensureExample = (reroll = false) => {
    const key = `${base.value}|${rarity.value}|${effLevel()}|${cls()}`;
    if (!reroll && example?.key === key) return;
    const item = makeItem(base.value, rarity.value as Rarity, effLevel(), cls());
    example = item ? { key, name: item.name, rows: (item.lines ?? []).map((l) => ({ stat: l.stat, value: l.value })) } : null;
  };
  const drawExample = () => {
    exampleBox.replaceChildren();
    if (!example) return;
    const ex = example;
    const rar = rarity.value as Rarity;
    const ranges = rowRanges(base.value, rar, effLevel(), ex.rows.map((r) => r.stat)) ?? [];
    const names = itemNames(base.value, rar, cls());
    const nameEl = names.length > 1
      ? h('select', { onchange: (e: Event) => (ex.name = (e.target as HTMLSelectElement).value) }, ...names.map((n) => h('option', { value: n, selected: n === ex.name }, n)))
      : h('b', {}, ex.name);
    const rerollBtn = h('button', { class: 'small', type: 'button' }, 'สุ่มใหม่');
    rerollBtn.onclick = () => { ensureExample(true); drawExample(); };
    const addBtn = h('button', { class: 'small', type: 'button', disabled: ex.rows.length >= ADMIN_ITEM_ROWS_MAX }, '+ เพิ่มแถว');
    addBtn.onclick = () => {
      const used = new Set(ex.rows.map((r) => r.stat));
      const stat = STAT_KEYS.find((k) => !used.has(k)) ?? 'atk';
      const r = rowRanges(base.value, rar, effLevel(), [...ex.rows.map((x) => x.stat), stat])!.at(-1)!;
      ex.rows.push({ stat, value: roundStat(stat, (r.lo + r.hi) / 2) });
      drawExample();
    };
    const rows = ex.rows.map((row, i) => {
      const r = ranges[i];
      const top = roundStat(row.stat, r.hi * ADMIN_STAT_MULT);
      const step = statStep(row.stat);
      const info = h('span', { class: 'muted' });
      const showInfo = () => {
        const bad = !(row.value >= step && row.value <= top);
        const t = tierOf(row.stat, r.level, row.value, r.lo, r.hi);
        info.textContent = `ปกติ ${r.min}–${r.max} · T${t.tier} (${t.min}–${t.max})${r.main ? ' · สเตตัสหลัก' : ''}${bad ? ` · ต้องอยู่ระหว่าง ${step}–${top}` : ''}`;
        info.style.color = bad ? 'var(--bad)' : '';
      };
      const stat = h('select', {}, ...STAT_KEYS.map((k) => h('option', { value: k, selected: k === row.stat }, STAT_LABEL[k])));
      stat.onchange = () => {
        row.stat = stat.value as AdminItemRow['stat'];
        const nr = rowRanges(base.value, rar, effLevel(), ex.rows.map((x) => x.stat))![i];
        row.value = roundStat(row.stat, (nr.lo + nr.hi) / 2);
        drawExample();
      };
      const val = h('input', { type: 'number', value: String(row.value), min: String(step), max: String(top), step: String(step) });
      val.oninput = () => { row.value = Number(val.value); showInfo(); };
      const del = h('button', { class: 'small', type: 'button', title: 'ลบแถว' }, '✕');
      del.onclick = () => { ex.rows.splice(i, 1); drawExample(); };
      showInfo();
      return h('div', { class: 'row example-row' }, stat, val, info, del);
    });
    exampleBox.append(
      h('div', { class: 'row example-head' }, h('span', {}, 'ตัวอย่าง: ', nameEl, ` [${RARITY_LABEL[rar]}] Lv.${effLevel()}`), rerollBtn),
      ...rows,
      ...(ex.rows.length ? [] : [h('div', { class: 'muted' }, 'ไม่มีสเตตัส')]),
      h('div', { class: 'row' }, addBtn, h('span', { class: 'muted' }, `สูงสุด ${ADMIN_ITEM_ROWS_MAX} แถว · ค่าได้ถึง ${ADMIN_STAT_MULT} เท่าของค่าสูงสุดปกติ · ทุกชิ้นได้ตามตัวอย่างนี้`)),
    );
  };
  const rarityWrap = h('label', {}, 'ความหายาก', rarity);
  const itemLvWrap = h('label', {}, 'เลเวลไอเทม', itemLv);
  /** Potions and stones have no rarity, +N, level or stats: only the count shows. */
  let wasGear = !stackPick();
  const showGearFields = () => {
    const gear = !stackPick();
    // Switching from potions/stones (a stack of 10) to gear: back to 1 piece.
    if (gear && !wasGear) form.count = count.value = '1';
    wasGear = gear;
    for (const el of [rarityWrap, plusWrap, itemLvWrap, exampleBox]) el.style.display = gear ? '' : 'none';
  };
  const refreshExample = () => {
    showGearFields();
    if (!custom || stackPick()) return;
    // Show the level the example is really made at (a kind's minimum level can raise it).
    if (intOf(itemLv) !== effLevel()) form.level = itemLv.value = String(effLevel());
    ensureExample();
    drawExample();
  };
  base.addEventListener('change', refreshExample);
  forCls.onchange = () => {
    fillBases();
    form.baseId = base.value;
    refreshExample();
  };
  rarity.addEventListener('change', refreshExample);
  itemLv.addEventListener('change', refreshExample);
  refreshExample();
  itemBtn.onclick = () => {
    const stack = stackPick();
    if (stack) return void run('items', { ...stack, count: intOf(count) }, itemBtn);
    void run('items', {
    baseId: base.value, classId: cls(), rarity: rarity.value, plus: Number(plus.value), level: custom ? effLevel() : intOf(itemLv), count: intOf(count),
    ...(custom && example ? { name: example.name, lines: example.rows } : {}),
    }, itemBtn);
  };

  // Whole set: every wear slot at one rarity / tier / level / +N (spawnSet tool, owner 2026-11-21).
  const setCls = h('select', {}, ...CLASS_IDS.map((k) => h('option', { value: k, selected: k === c.classId }, k === c.classId ? `${className(k)} (อาชีพตัวนี้)` : className(k))));
  const setRarity = h('select', {}, ...m.rarities.map((r) => h('option', { value: r, style: `color:${RARITY_COLOR[r]}` }, RARITY_LABEL[r])));
  const setTier = h('select', {}, ...[1, 2, 3, 4, 5].map((t) => h('option', { value: String(t) }, `T${t}${t === 1 ? ' (ดีสุด)' : t === 5 ? ' (ต่ำสุด)' : ''}`)));
  const setLv = numInput(c.level, 1, m.maxLevel);
  const setPlus = h('select', {}, ...Array.from({ length: m.maxPlus + 1 }, (_, i) => h('option', { value: String(i) }, `+${i}`)));
  const setBtn = h('button', { class: 'primary' }, 'เสกทั้งเซต');
  setBtn.onclick = () => void run('itemset', { classId: setCls.value, rarity: setRarity.value, tier: Number(setTier.value), level: intOf(setLv), plus: Number(setPlus.value) }, setBtn,
    `เสกเซตทุกช่อง (${setRarity.selectedOptions[0].text} T${setTier.value} Lv.${intOf(setLv)} +${setPlus.value}) ให้ ${c.name}?`);

  // Zone
  const zone = h('select', {}, ...m.zones.map((z) => h('option', { value: z.id, selected: z.id === c.zone }, `${z.nameTh} (Lv.${z.levels[0]}–${z.levels[1]})`)));
  const tpBtn = h('button', { class: 'primary' }, 'ย้ายโซน');
  // Channel (channelWarp, maps with channels only): "auto" = placed like anyone, or into a chosen CH however full.
  const chSel = h('select', {}) as HTMLSelectElement;
  const chWrap = h('label', { class: 'hidden' }, 'CH', chSel);
  let chList: AdminOnline | null = online;
  const fillCh = () => {
    const list = chList?.zones.filter((z) => z.id === zone.value && z.ch) ?? [];
    const here = chList?.players.find((p) => p.charId === c.charId);
    chWrap.classList.toggle('hidden', !can('channelWarp') || !list.length);
    chSel.replaceChildren(h('option', { value: '' }, 'อัตโนมัติ'), ...list.map((z) => h('option', { value: String(z.ch) },
      `CH ${z.ch} (${z.count} คน)${here && here.zone === z.id && here.ch === z.ch ? ' · อยู่ที่นี่' : ''}`)));
  };
  zone.addEventListener('change', fillCh);
  fillCh();
  if (can('channelWarp') && c.online) {
    void api<AdminOnline>('GET', '/admin/online').then((o) => {
      chList = o;
      fillCh();
    }).catch(() => undefined);
  }
  tpBtn.onclick = () => void run('teleport', { zone: zone.value, ...(chSel.value ? { ch: Number(chSel.value) } : {}) }, tpBtn);

  const kickBtn = h('button', { class: 'danger' }, 'เตะออกจากเกม');
  kickBtn.onclick = () => void run('kick', {}, kickBtn, `เตะ ${c.name} ออกจากเกม?`);

  const rarityLabel = (t: string, el: HTMLElement) => h('label', {}, t, el);
  const fact = (label: string, v: string) => h('div', {}, `${label} `, h('b', {}, v));
  const edit = can('charEdit');
  const bg = h('div', { class: 'sheet-bg', onclick: (ev: Event) => ev.target === bg && closeSheet() });
  bg.append(h('div', { class: 'sheet' },
    h('div', { class: 'sheet-head' },
      h('div', {},
        h('h2', {}, c.name, h('span', { class: c.online ? 'tag on' : 'tag' }, c.online ? 'ออนไลน์' : 'ออฟไลน์')),
        h('div', { class: 'muted' }, `บัญชี ${c.username} · ${className(c.classId)}`),
      ),
      h('button', { class: 'x small', onclick: closeSheet }, '✕'),
    ),
    h('div', { class: 'facts' },
      fact('เลเวล', String(c.level)),
      fact('EXP', `${fmt(c.exp)} / ${fmt(c.expToNext)}`),
      fact('ทอง', `${fmt(c.gold)} G`),
      fact('โซน', zoneName(c.zone)),
      fact('กระเป๋าว่าง', `${c.bagFree} ช่อง`),
    ),
    c.online ? null : h('div', { class: 'muted' }, 'ตัวละครออฟไลน์: แก้ในเซฟ มีผลเมื่อเข้าเกมครั้งถัดไป'),
    edit ? h('section', {}, h('h3', {}, `เลเวล / EXP (สูงสุด Lv.${m.maxLevel})`),
      h('div', { class: 'row' }, h('label', {}, 'เลเวล', lv), h('label', {}, 'EXP', exp), lvBtn)) : null,
    edit ? h('section', {}, h('h3', {}, `ทอง (ครั้งละไม่เกิน ${fmt(m.goldMax)} G)`),
      h('div', { class: 'row' }, h('label', {}, 'จำนวน', gold), giveBtn, takeBtn)) : null,
    !edit ? null : h('section', {}, h('h3', {}, `เสกไอเทมใส่กระเป๋า (ครั้งละไม่เกิน ${m.itemsMax} ชิ้น · ยา/หินนับทีละขวด/ก้อน)`),
      h('div', { class: 'row' }, h('label', {}, 'ของอาชีพ', forCls), h('label', { style: 'flex:1' }, 'ชนิด', base)),
      h('div', { class: 'row', style: 'margin-top:8px' },
        rarityWrap, plusWrap, itemLvWrap, h('label', {}, 'จำนวน', count), itemBtn),
      custom ? exampleBox : null),
    !edit || !can('spawnSet') ? null : h('section', {}, h('h3', {}, `เสกของเป็นเซต (ทุกช่องสวมใส่ สูงสุด ${ADMIN_SET_SIZE} ชิ้น เข้ากระเป๋า)`),
      h('div', { class: 'row' }, h('label', {}, 'อาชีพ', setCls), rarityLabel('ความหายาก', setRarity), h('label', {}, 'tier สเตตัส', setTier),
        h('label', {}, 'เลเวลไอเทม', setLv), h('label', {}, 'ตีบวก', setPlus), setBtn),
      h('div', { class: 'muted' }, `แต่ละช่องใช้ชนิดที่ดีที่สุดที่เลเวลนี้ใส่ได้ · ทุกแถวสเตตัสอยู่กลางช่วง tier ที่เลือก · แหวน 2 วง · กระเป๋าว่างไม่พอ = ไม่เสกเลย`)),
    can('teleport') ? h('section', {}, h('h3', {}, 'ย้ายโซน (ไปที่แคมป์)'),
      h('div', { class: 'row' }, h('label', {}, 'โซน', zone), chWrap, tpBtn),
      can('channelWarp') ? h('div', { class: 'muted' }, 'เลือก CH ได้เฉพาะแมพที่มีแชนแนล · เลือก CH แล้วเข้าได้แม้ห้องเต็ม') : null) : null,
    c.online && can('kick') ? h('section', {}, h('div', { class: 'row' }, kickBtn)) : null,
    h('div', { class: 'result' }, result),
  ));
  setSheet(bg);
  document.body.append(bg);
  bg.scrollTop = scroll;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});
