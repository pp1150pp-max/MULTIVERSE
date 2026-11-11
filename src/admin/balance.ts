// The /admin "ปรับสมดุล" tab: every class's stats and the item tier tables: central, per stat and per item-level band,
// with a preview of the real numbers an item rolls (src/shared/balance.ts).
// Edits a draft with a live preview (class stats at Lv1/10/50 with nothing worn, tier chances); saving
// sends the whole draft, the server checks it, stores only what differs from the code, logs the change
// and applies it to everyone online at once.
import {
  applyBalance, BALANCE_RANGE, balanceChanges, checkBalance, classStatsAt, codeBalance, currentBalanceTuning, hasParts, mergeBalance, STAT_MAX,
  STAT_PART_NAME, STAT_PARTS, STAT_TIER_PARTS, statTierTable, tierLabelsChange, tierSourceName, withItemStatMult,
  type Balance, type BalanceTuning, type StatPart, type TierParts,
} from '../shared/balance';
import { CLASSES, CLASS_IDS } from '../shared/data/classes';
import { ITEM_BASES, itemRowKinds, rowRanges, TIER_BAND_NAME, TIER_BANDS, tierBandOf, tierChances, tierRanges } from '../shared/data/items';
import { MAX_LEVEL } from '../shared/formulas';
import { RARITIES, RARITY_LABEL, SLOT_LABEL, STAT_KEYS, STAT_LABEL, type ClassId, type Rarity, type StatKey } from '../shared/types';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

const PREVIEW_LEVELS = [1, 10, 50];
/** Stats shown with one decimal (the % ones and regen); the rest are whole numbers in the game. */
const DECIMAL = new Set<StatKey>(['crit', 'critDmg', 'atkSpeed', 'moveSpeed', 'hpRegen', 'mpRegen']);
const show = (k: StatKey, v: number): string => (DECIMAL.has(k) ? (Math.round(v * 10) / 10).toString() : Math.round(v).toLocaleString());
const pct = (n: number): string => `${(Math.round(n * 1000) / 10).toString()}%`;

/** The server's answer to GET/POST /api/admin/balance. */
interface BalanceState { tuning: BalanceTuning }

/**
 * Draws the tab into `view`. `onSaved` gets the new tuning after a save, so the page's other tools (the
 * custom-item tiers) can use it too.
 */
export async function renderBalance(view: HTMLElement, h: H, api: Api, onSaved: (t: BalanceTuning) => void, canConfirmMult = false): Promise<void> {
  const box = h('div', {}, h('div', { class: 'muted' }, 'กำลังโหลด…'));
  view.append(box);
  let saved: BalanceTuning;
  try {
    saved = (await api<BalanceState>('GET', '/admin/balance')).tuning;
  } catch (e) {
    box.replaceChildren(h('div', { class: 'msg bad' }, `โหลดไม่สำเร็จ: ${(e as Error).message}`));
    return;
  }
  const code = codeBalance();
  let draft: Balance = mergeBalance(saved);
  let cls: ClassId = 'sword';
  const msg = h('div', { class: 'msg' });

  /** A number box bound to a draft value; marked when it differs from the code. */
  const numBox = (get: () => number, set: (n: number) => void, codeVal: number, lo: number, hi: number, step: number, refresh: () => void): HTMLInputElement => {
    const inp = h('input', { type: 'number', min: String(lo), max: String(hi), step: String(step), value: String(get()), title: `ค่าในโค้ด: ${codeVal} · ช่วง ${lo}–${hi}` });
    inp.className = 'bal-num';
    const mark = () => inp.classList.toggle('bal-changed', get() !== codeVal);
    mark();
    inp.addEventListener('input', () => {
      const n = Number(inp.value);
      const ok = inp.value !== '' && Number.isFinite(n) && n >= lo && n <= hi;
      inp.classList.toggle('bal-bad', !ok);
      if (!ok) return;
      set(n);
      mark();
      refresh();
    });
    return inp;
  };

  // ---------------------------------------------------------- classes
  const classCard = h('div', { class: 'card' });
  const drawClass = (): void => {
    const c = draft.classes[cls];
    const cc = code.classes[cls];
    const tabs = h('div', { class: 'subtabs' }, ...CLASS_IDS.map((id) =>
      h('button', { class: id === cls ? 'on' : '', onclick: () => { cls = id; drawClass(); } }, CLASSES[id].nameTh)));
    const previewCells = new Map<StatKey, HTMLTableCellElement[]>();
    const refresh = (): void => {
      const at = PREVIEW_LEVELS.map((lv) => classStatsAt(cls, lv, draft));
      for (const k of STAT_KEYS) previewCells.get(k)!.forEach((td, i) => { td.textContent = show(k, at[i][k]); });
      updateSummary();
    };
    const rows = STAT_KEYS.map((k) => {
      const cells = PREVIEW_LEVELS.map(() => h('td', { class: 'bal-out' }));
      previewCells.set(k, cells);
      const inputs = STAT_PARTS.map((part: StatPart) => {
        const [lo, hi] = part === 'mult' ? BALANCE_RANGE.mult : [0, STAT_MAX[k]];
        const step = part === 'mult' ? 0.05 : DECIMAL.has(k) || part === 'growth' ? 0.01 : 1;
        return h('td', {}, numBox(() => c[part][k], (n) => { c[part][k] = n; }, cc[part][k], lo, hi, step, refresh));
      });
      return h('tr', {}, h('td', {}, STAT_LABEL[k]), ...inputs, ...cells);
    });
    const table = h('table', { class: 'bal-table' },
      h('thead', {}, h('tr', {},
        h('th', {}, 'สเตตัส'), ...STAT_PARTS.map((p) => h('th', {}, STAT_PART_NAME[p])),
        ...PREVIEW_LEVELS.map((lv) => h('th', { class: 'bal-out' }, `ได้จริง Lv${lv}`)))),
      h('tbody', {}, ...rows));
    const boss = numBox(() => c.bossDmgMult, (n) => { c.bossDmgMult = n; }, cc.bossDmgMult, ...BALANCE_RANGE.bossDmgMult, 0.05, refresh);
    classCard.replaceChildren(
      h('h2', {}, 'ค่าอาชีพ'),
      tabs,
      h('div', { class: 'muted' }, '"ได้จริง" = ค่าตอนไม่ใส่ของ หลังคูณตัวคูณอาชีพและตัวตัดฟื้นแล้ว · ตัวคูณใช้กับค่ารวมของใส่ด้วย · ช่องสีทอง = ต่างจากค่าในโค้ด (ชี้ค้างดูค่าในโค้ด)'),
      h('div', { class: 'bal-scroll' }, table),
      h('div', { class: 'row bal-line' }, h('label', {}, 'ดาเมจใส่บอส (×)', boss)),
    );
    refresh();
  };

  // ---------------------------------------------------------- game-wide regen cut
  const regenCard = h('div', { class: 'card' });
  const drawRegen = (): void => {
    const refresh = (): void => { drawClass(); };
    regenCard.replaceChildren(
      h('h2', {}, 'ตัวตัดฟื้นทั้งเกม'),
      h('div', { class: 'muted' }, 'คูณค่าฟื้น HP/MP ต่อวินาทีของทุกอาชีพ (รวมจากของใส่) เช่น 0.4 = เหลือ 40%'),
      h('div', { class: 'row bal-line' },
        h('label', {}, 'ตัวคูณฟื้น HP', numBox(() => draft.hpRegenMult, (n) => { draft.hpRegenMult = n; }, code.hpRegenMult, ...BALANCE_RANGE.regenMult, 0.05, refresh)),
        h('label', {}, 'ตัวคูณฟื้น MP', numBox(() => draft.mpRegenMult, (n) => { draft.mpRegenMult = n; }, code.mpRegenMult, ...BALANCE_RANGE.regenMult, 0.05, refresh)),
      ),
    );
  };

  // ---------------------------------------------------------- tiers
  /** One tier table being edited: the central one (bound to the draft's fields) or a stat's own. */
  interface TierEdit { weight: number[]; width: number[]; floor: number; bossBoost: number }
  const central: TierEdit = {
    get weight() { return draft.tierWeight; },
    get width() { return draft.tierWidth; },
    get floor() { return draft.rangeFloor; },
    set floor(n: number) { draft.rangeFloor = n; },
    get bossBoost() { return draft.bossTierBoost; },
    set bossBoost(n: number) { draft.bossTierBoost = n; },
  };
  /** Stats with their own table in the draft, in STAT_KEYS order. */
  /** The draft's own parts for a stat (null = every stat) at a band (null = every level); null stat and band = none (the central table). */
  const scopeParts = (stat: StatKey | null, band: number | null): TierParts | undefined => {
    const id = band === null ? null : TIER_BANDS[band];
    if (stat === null) return id ? draft.bandTiers[id] : undefined;
    const st = draft.statTiers[stat];
    return id ? st?.bands?.[id] : st;
  };
  const setScope = (stat: StatKey | null, band: number | null, t: TierParts): void => {
    const id = band === null ? null : TIER_BANDS[band];
    if (stat === null) {
      if (id) draft.bandTiers[id] = t;
      return;
    }
    const st = (draft.statTiers[stat] ??= {});
    if (id) (st.bands ??= {})[id] = t;
    else Object.assign(st, t);
  };
  const clearScope = (stat: StatKey | null, band: number | null): void => {
    const id = band === null ? null : TIER_BANDS[band];
    if (stat === null) {
      if (id) delete draft.bandTiers[id];
      return;
    }
    const st = draft.statTiers[stat];
    if (!st) return;
    if (id) {
      if (st.bands) delete st.bands[id];
      if (st.bands && !Object.keys(st.bands).length) delete st.bands;
    } else {
      for (const p of STAT_TIER_PARTS) delete st[p];
    }
    if (!hasParts(st) && !st.bands) delete draft.statTiers[stat];
  };
  /** Every stat × band with a table of its own in the draft. */
  const ownScopes = (): [StatKey | null, number | null][] => {
    const out: [StatKey | null, number | null][] = [];
    TIER_BANDS.forEach((_, b) => { if (hasParts(scopeParts(null, b))) out.push([null, b]); });
    for (const k of STAT_KEYS) {
      if (hasParts(scopeParts(k, null))) out.push([k, null]);
      TIER_BANDS.forEach((_, b) => { if (hasParts(scopeParts(k, b))) out.push([k, b]); });
    }
    return out;
  };
  const first = ownScopes()[0];
  let tierStat: StatKey | null = first ? first[0] : 'moveSpeed';
  let tierBand: number | null = first ? first[1] : null;

  /** The table, width total and floor/boss boxes of one tier table. Boxes are gold where they differ from the code's central table. */
  const tierEditor = (t: TierEdit, refresh: () => void): Node[] => {
    const chanceCells = t.weight.map(() => h('td', { class: 'bal-out' }));
    const bossCells = t.weight.map(() => h('td', { class: 'bal-out' }));
    const edgeCells = t.weight.map(() => h('td', { class: 'bal-out' }));
    const widthSum = h('span');
    const update = (): void => {
      const total = t.weight.reduce((a, b) => a + b, 0);
      const bw = t.weight.map((w, i) => w * (1 + t.bossBoost * (4 - i)));
      const btotal = bw.reduce((a, b) => a + b, 0);
      t.weight.forEach((w, i) => {
        chanceCells[i].textContent = total > 0 ? pct(w / total) : '—';
        bossCells[i].textContent = btotal > 0 ? pct(bw[i] / btotal) : '—';
      });
      // Where each tier sits in a line's range, as % of its highest roll (floor at 0 of the range).
      let top = 100;
      t.width.forEach((w, i) => {
        const lo = top - w;
        const at = (x: number) => Math.round((t.floor + (100 - t.floor) * x / 100) * 10) / 10;
        edgeCells[i].textContent = `${at(lo)}–${at(top)}%`;
        top = lo;
      });
      const sum = Math.round(t.width.reduce((a, b) => a + b, 0) * 1000) / 1000;
      widthSum.textContent = `รวม ${sum}%`;
      widthSum.className = Math.abs(sum - 100) <= 0.001 ? 'good' : 'warn';
    };
    const changed = (): void => { update(); refresh(); };
    const rows = t.weight.map((_, i) => h('tr', {},
      h('td', {}, `T${i + 1}`),
      h('td', {}, numBox(() => t.weight[i], (n) => { t.weight[i] = n; }, code.tierWeight[i], ...BALANCE_RANGE.tierWeight, 1, changed)),
      chanceCells[i], bossCells[i],
      h('td', {}, numBox(() => t.width[i], (n) => { t.width[i] = n; }, code.tierWidth[i], ...BALANCE_RANGE.tierWidth, 0.5, changed)),
      edgeCells[i],
    ));
    update();
    return [
      h('div', { class: 'bal-scroll' }, h('table', { class: 'bal-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Tier'), h('th', {}, 'น้ำหนักโอกาส'), h('th', { class: 'bal-out' }, 'โอกาส'), h('th', { class: 'bal-out' }, 'โอกาส (บอส)'),
          h('th', {}, 'ความกว้าง %'), h('th', { class: 'bal-out' }, 'ช่วง (% ของค่าสูงสุด)'))),
        h('tbody', {}, ...rows))),
      h('div', { class: 'muted' }, widthSum),
      h('div', { class: 'row bal-line' },
        h('label', {}, 'ค่าต่ำสุดของช่วง (% ของค่าสูงสุด)', numBox(() => t.floor, (n) => { t.floor = n; }, code.rangeFloor, ...BALANCE_RANGE.rangeFloor, 1, changed)),
        h('label', {}, 'บอสเพิ่มโอกาส tier ดี', numBox(() => t.bossBoost, (n) => { t.bossBoost = n; }, code.bossTierBoost, ...BALANCE_RANGE.bossTierBoost, 0.1, changed)),
      ),
    ];
  };

  const tierCard = h('div', { class: 'card' });
  const drawTiers = (): void => {
    const labelNote = h('div', { class: 'muted' });
    const refresh = (): void => {
      const c = draftTuning();
      labelNote.textContent = c.tuning && tierLabelsChange(saved, c.tuning)
        ? '⚠ เปลี่ยนความกว้าง/ค่าต่ำสุดแล้ว: ของที่ผู้เล่นมีอยู่ ค่าเดิมไม่เปลี่ยน แต่ป้าย tier และช่วง min–max ที่แสดงจะคำนวณใหม่ (สุ่มค่าตัวเลขที่ช่างตีเหล็กใช้ tier ใหม่)'
        : '';
      updateSummary();
    };

    // A table of its own for a stat and/or a level band: pick both, then edit it or give it one.
    const scopeName = (stat: StatKey | null, band: number | null): string =>
      `${stat ? STAT_LABEL[stat] : 'ทุกสเตตัส'} · ${band === null ? 'ทุกเลเวล' : TIER_BAND_NAME[TIER_BANDS[band]]}`;
    const own = scopeParts(tierStat, tierBand);
    let ownEdit: TierEdit | null = null;
    if (own && hasParts(own)) {
      // Parts left out (only possible through the API) are filled from the table they fall through to.
      const fill = statTierTable(draft, tierStat, tierBand);
      own.weight ??= [...fill.weight];
      own.width ??= [...fill.width];
      own.floor ??= fill.floor;
      own.bossBoost ??= fill.bossBoost;
      ownEdit = own as TierEdit;
    }
    const list = ownScopes().map(([k, b]) => scopeName(k, b));
    const pickStat = h('select', { onchange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; tierStat = v ? v as StatKey : null; drawTiers(); } },
      h('option', { value: '', selected: tierStat === null }, 'ทุกสเตตัส'),
      ...STAT_KEYS.map((k) => h('option', { value: k, selected: k === tierStat }, STAT_LABEL[k])));
    const pickBand = h('select', { onchange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; tierBand = v === '' ? null : Number(v); drawTiers(); } },
      h('option', { value: '', selected: tierBand === null }, 'ทุกเลเวล'),
      ...TIER_BANDS.map((id, i) => h('option', { value: String(i), selected: i === tierBand }, TIER_BAND_NAME[id])));
    let ownPart: Node[];
    if (tierStat === null && tierBand === null) {
      ownPart = [h('div', { class: 'muted' }, 'ทุกสเตตัส ทุกเลเวล = ตารางกลางด้านบน')];
    } else if (ownEdit) {
      ownPart = [
        ...tierEditor(ownEdit, refresh),
        h('div', { class: 'row bal-line' }, h('button', { onclick: () => { clearScope(tierStat, tierBand); drawTiers(); } }, '↩ เลิกตั้งตารางนี้ (กลับไปใช้ตารางที่ครอบอยู่)')),
      ];
    } else {
      ownPart = [
        h('div', { class: 'muted' }, `ตอนนี้ใช้: ${tierSourceName(draft, tierStat, tierBand)}`),
        h('div', { class: 'row bal-line' }, h('button', { onclick: () => {
          const t = statTierTable(draft, tierStat, tierBand);
          setScope(tierStat, tierBand, { weight: [...t.weight], width: [...t.width], floor: t.floor, bossBoost: t.bossBoost });
          drawTiers();
        } }, '✎ ตั้งตารางเอง (เริ่มจากค่าที่ใช้อยู่ตอนนี้)')),
      ];
    }

    tierCard.replaceChildren(
      h('h2', {}, 'Tier T1–T5 ของสเตตัสบนไอเทม'),
      h('div', { class: 'muted' }, 'โอกาสเป็นน้ำหนัก (คิดเป็น % ให้เอง) · เปลี่ยนโอกาสมีผลกับของดรอปใหม่เท่านั้น ช่วงค่าไม่เลื่อน · ความกว้างรวมกันต้องได้ 100%'),
      h('h3', {}, 'ตารางกลาง'),
      h('div', { class: 'muted' }, 'ใช้กับทุกสเตตัสทุกเลเวลที่ไม่ได้ตั้งตารางเอง'),
      ...tierEditor(central, refresh),
      h('h3', {}, 'ตารางแยกตามสเตตัส / ช่วงเลเวลไอเทม'),
      h('div', { class: 'muted' }, 'ลำดับที่ใช้ (ทีละช่อง): สเตตัส+ช่วงเลเวล → สเตตัสทุกเลเวล → ทุกสเตตัสในช่วงเลเวล → ตารางกลาง · ช่วงเลเวลดูจากเลเวลของไอเทม'),
      h('div', { class: 'muted' }, list.length ? `ตั้งเองอยู่: ${list.join(', ')}` : 'ยังไม่มี ทุกอย่างใช้ตารางกลาง'),
      h('div', { class: 'row bal-line' }, h('label', {}, 'สเตตัส', pickStat), h('label', {}, 'ช่วงเลเวล', pickBand)),
      ...ownPart,
      labelNote,
    );
    refresh();
  };

  // ---------------------------------------------------------- preview: real numbers
  const previewCard = h('div', { class: 'card' });
  let pvBase = ITEM_BASES[0].id;
  let pvRarity: Rarity = 'rare';
  let pvLevel = 10;
  // Item stat multipliers (owner 2026-11-11): typed here, "ทดลอง" shows them in the table (nothing saved),
  // "คอนเฟิร์ม" (owner only) applies them server-wide and scales every item. The normal save never sends them.
  const savedMult = (): Record<StatKey, number> => ({ ...mergeBalance(saved).itemStatMult });
  let multDraft = savedMult();
  let multTrial: Record<StatKey, number> | null = null;
  const multMsg = h('div', { class: 'msg' });
  const nonOne = (m: Record<StatKey, number>): Partial<Record<StatKey, number>> => {
    const out: Partial<Record<StatKey, number>> = {};
    for (const k of STAT_KEYS) if (m[k] !== 1) out[k] = m[k];
    return out;
  };
  const confirmMult = async (): Promise<void> => {
    if (!multTrial) {
      multMsg.className = 'msg bad';
      multMsg.textContent = 'กด "ทดลอง" ดูตัวอย่างก่อนคอนเฟิร์ม';
      return;
    }
    const before = mergeBalance(saved).itemStatMult;
    const list = STAT_KEYS.filter((k) => multTrial![k] !== before[k]).map((k) => `${STAT_LABEL[k]} ×${before[k]} → ×${multTrial![k]}`);
    if (!list.length) {
      multMsg.className = 'msg';
      multMsg.textContent = 'ตัวคูณเท่าที่ใช้อยู่แล้ว ไม่มีอะไรเปลี่ยน';
      return;
    }
    if (!confirm(`คูณค่าสเตตัสของไอเทมทุกชิ้นในเซิร์ฟจริงเลยไหม?\n\n${list.join('\n')}\n\n`
      + '• ของที่ใส่อยู่ กระเป๋า คลัง ตลาด ของบนพื้น และของดรอปใหม่ทั้งหมด\n'
      + '• สำรอง DB ให้อัตโนมัติก่อนคูณ\n'
      + '• ตั้งกลับ ×1 ทีหลัง ค่าอาจไม่กลับมาเท่าเดิมเป๊ะ (ปัดเศษ)\n'
      + '• ระหว่างคูณ เกมอาจกระตุกแวบเดียว')) return;
    multMsg.className = 'msg';
    multMsg.textContent = 'กำลังคูณ…';
    try {
      const r = await api<BalanceState & { scaled?: { characters: number; stashes: number; listings: number }; backup?: string; ms?: number }>(
        'POST', '/admin/balance/item-mult', { mult: nonOne(multTrial) });
      saved = r.tuning;
      // Only the multipliers change in the draft: other unsaved edits stay.
      draft.itemStatMult = { ...mergeBalance(saved).itemStatMult };
      multDraft = savedMult();
      multTrial = null;
      onSaved(saved);
      updateSummary();
      multMsg.className = 'msg good';
      multMsg.textContent = r.scaled
        ? `คูณแล้วทั้งเซิร์ฟ · ของที่บันทึกไว้: ตัวละคร ${r.scaled.characters} คลัง ${r.scaled.stashes} ตลาด ${r.scaled.listings} · ใช้เวลา ${r.ms ?? 0} ms · สำรองไว้ที่ ${r.backup ?? '-'}`
        : 'ไม่มีอะไรเปลี่ยน';
    } catch (e) {
      multMsg.className = 'msg bad';
      multMsg.textContent = (e as Error).message;
    }
  };
  const drawPreview = (): void => {
    const c = draftTuning();
    const body = h('div');
    const current = mergeBalance(saved).itemStatMult;
    const multBoxes = STAT_KEYS.map((k) => {
      const inp = h('input', { type: 'number', min: String(BALANCE_RANGE.itemStatMult[0]), max: String(BALANCE_RANGE.itemStatMult[1]), step: '0.05', value: String(multDraft[k]),
        title: `ใช้อยู่: ×${current[k]} · ช่วง ${BALANCE_RANGE.itemStatMult[0]}–${BALANCE_RANGE.itemStatMult[1]}` });
      inp.className = 'bal-num';
      inp.classList.toggle('bal-changed', multDraft[k] !== current[k]);
      inp.addEventListener('input', () => {
        const n = Number(inp.value);
        const ok = inp.value !== '' && Number.isFinite(n) && n >= BALANCE_RANGE.itemStatMult[0] && n <= BALANCE_RANGE.itemStatMult[1];
        inp.classList.toggle('bal-bad', !ok);
        if (!ok) return;
        multDraft[k] = Math.round(n * 1000) / 1000;
        inp.classList.toggle('bal-changed', multDraft[k] !== current[k]);
      });
      return h('label', {}, `${STAT_LABEL[k]} ×`, inp);
    });
    const multPart = h('div', {},
      h('h3', {}, 'ตัวคูณค่าสเตตัสบนไอเทม'),
      h('div', { class: 'muted' }, 'คูณทุกบรรทัดของสเตตัสนั้น (หลัก ล็อก เสริม) ทุกเลเวล ทุก tier เช่น 0.75 = ลด 25% · กด "ทดลอง" ดูในตารางข้างล่างก่อน (ยังไม่มีผล) · "คอนเฟิร์ม" = คูณของทุกชิ้นในเซิร์ฟจริง' + (canConfirmMult ? '' : ' (คอนเฟิร์มได้เฉพาะ owner)')),
      h('div', { class: 'row bal-line' }, ...multBoxes),
      h('div', { class: 'row bal-line' },
        h('button', { onclick: () => {
          if (multPart.querySelector('input.bal-bad')) {
            multMsg.className = 'msg bad';
            multMsg.textContent = 'มีช่องตัวคูณที่ใส่ค่าไม่ถูกต้อง (กรอบแดง)';
            return;
          }
          multTrial = { ...multDraft };
          multMsg.className = 'msg';
          multMsg.textContent = 'กำลังทดลอง: ตารางข้างล่างแสดง เดิม → ใหม่ (ยังไม่มีผลในเกม)';
          drawPreview();
        } }, '🧪 ทดลอง'),
        h('button', { onclick: () => { multTrial = null; multDraft = savedMult(); multMsg.textContent = ''; drawPreview(); } }, 'ยกเลิกทดลอง'),
        canConfirmMult ? h('button', { class: 'primary', onclick: () => void confirmMult() }, '✔ คอนเฟิร์ม คูณทั้งเซิร์ฟ') : null,
      ),
      multMsg,
    );
    const base = ITEM_BASES.find((b) => b.id === pvBase)!;
    const pickBase = h('select', { onchange: (e: Event) => { pvBase = (e.target as HTMLSelectElement).value; drawPreview(); } },
      ...ITEM_BASES.map((b) => h('option', { value: b.id, selected: b.id === pvBase },
        `${b.names.any ?? b.names.sword ?? b.id} [${SLOT_LABEL[b.slot]}] (Lv.${b.minLevel}+)`)));
    const pickRarity = h('select', { onchange: (e: Event) => { pvRarity = (e.target as HTMLSelectElement).value as Rarity; drawPreview(); } },
      ...RARITIES.map((r) => h('option', { value: r, selected: r === pvRarity }, RARITY_LABEL[r])));
    const lv = h('input', { type: 'number', min: '1', max: String(MAX_LEVEL), step: '1', value: String(pvLevel) });
    lv.className = 'bal-num';
    lv.addEventListener('change', () => {
      const n = Math.round(Number(lv.value));
      if (Number.isFinite(n) && n >= 1 && n <= MAX_LEVEL) { pvLevel = n; drawPreview(); }
    });
    if (!c.tuning) {
      body.append(h('div', { class: 'msg bad' }, `แก้ค่าที่ผิดก่อนถึงจะดูตัวอย่างได้: ${c.error}`));
    } else {
      // Work the numbers out with the draft's tables (and the multipliers in use, then the ones being tried),
      // then put the saved ones back.
      const keep = currentBalanceTuning();
      const rows = itemRowKinds(pvBase) ?? [];
      const rangesWith = (mult: Record<StatKey, number>) => {
        applyBalance(withItemStatMult(c.tuning!, nonOne(mult)));
        const ranges = rowRanges(pvBase, pvRarity, pvLevel, rows.map((r) => r.stat)) ?? [];
        return rows.map((row, i) => tierRanges(row.stat, pvLevel, ranges[i].lo, ranges[i].hi));
      };
      try {
        const oldT = rangesWith(current);
        const newT = multTrial ? rangesWith(multTrial) : oldT;
        const kindName = { main: 'หลัก', locked: 'ล็อก', extra: 'เสริม' } as const;
        const band = tierBandOf(pvLevel);
        const span = (x: { min: number; max: number }) => (x.min === x.max ? String(x.min) : `${x.min}–${x.max}`);
        const tr = rows.map((row, i) => {
          const ch = tierChances(row.stat, pvLevel);
          const bch = tierChances(row.stat, pvLevel, true);
          const moved = !!multTrial && multTrial[row.stat] !== current[row.stat];
          return h('tr', {},
            h('td', {}, STAT_LABEL[row.stat]),
            h('td', {}, kindName[row.kind]),
            ...newT[i].map((x, j) => h('td', { class: moved ? 'bal-out bal-changed' : 'bal-out', title: `โอกาส ${pct(ch[j])} · บอส ${pct(bch[j])}` },
              moved ? `${span(oldT[i][j])} → ${span(x)}` : span(x))),
            h('td', { class: 'muted' }, tierSourceName(mergeBalance(c.tuning!), row.stat, band) + (moved ? ` · ×${current[row.stat]} → ×${multTrial![row.stat]}` : current[row.stat] !== 1 ? ` · ×${current[row.stat]}` : '')),
          );
        });
        body.append(
          h('div', { class: 'bal-scroll' }, h('table', { class: 'bal-table' },
            h('thead', {}, h('tr', {}, h('th', {}, 'สเตตัส'), h('th', {}, 'บรรทัด'),
              ...[1, 2, 3, 4, 5].map((n) => h('th', { class: 'bal-out' }, `T${n}`)), h('th', {}, 'ใช้ตาราง'))),
            h('tbody', {}, ...tr))),
        );
      } finally {
        applyBalance(keep);
      }
    }
    previewCard.replaceChildren(
      h('h2', {}, 'ตัวอย่างค่าจริงที่สุ่มได้'),
      h('div', { class: 'muted' }, 'คิดจากค่าที่กำลังแก้ (ยังไม่บันทึกก็เห็น) · ชี้ค้างที่ช่องเพื่อดูโอกาสของ tier นั้น (ปกติ/บอส) · บรรทัด "เสริม" = สเตตัสที่สุ่มจากความหายาก'),
      h('div', { class: 'row bal-line' }, h('label', {}, 'ชนิดไอเทม', pickBase), h('label', {}, 'ความหายาก', pickRarity), h('label', {}, 'เลเวลไอเทม', lv)),
      multPart,
      h('h3', {}, 'ตาราง'),
      h('div', { class: 'muted' }, `${base.names.any ?? base.names.sword ?? base.id} ${RARITY_LABEL[pvRarity]} Lv.${pvLevel} · ช่วงเลเวล ${TIER_BAND_NAME[TIER_BANDS[tierBandOf(pvLevel)]]}`),
      body,
    );
  };

  // ---------------------------------------------------------- save bar
  const summary = h('div', { class: 'muted' });
  /** The draft as the server would store it, or a Thai error. */
  const draftTuning = (): ReturnType<typeof checkBalance> => checkBalance(draft, true);
  function updateSummary(): void {
    const c = draftTuning();
    drawPreview();
    if (!c.tuning) {
      summary.textContent = `⚠ ${c.error}`;
      summary.className = 'msg bad';
      return;
    }
    const changes = balanceChanges(saved, c.tuning);
    summary.className = 'muted';
    summary.textContent = changes ? `ยังไม่บันทึก: ${changes}` : 'ตรงกับที่บันทึกไว้';
  }
  const redraw = (): void => {
    drawClass();
    drawRegen();
    drawTiers();
  };
  const save = async (body: { tuning: BalanceTuning } | { reset: true }, ask: string): Promise<void> => {
    if (!confirm(ask)) return;
    msg.className = 'msg';
    msg.textContent = 'กำลังบันทึก…';
    try {
      saved = (await api<BalanceState>('POST', '/admin/balance', body)).tuning;
      draft = mergeBalance(saved);
      onSaved(saved);
      redraw();
      msg.className = 'msg good';
      msg.textContent = 'บันทึกแล้ว ผู้เล่นที่ออนไลน์ได้ค่าใหม่ทันที';
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
    }
  };
  const bar = h('div', { class: 'card' },
    h('h2', {}, 'บันทึก'),
    summary,
    h('div', { class: 'row bal-line' },
      h('button', { class: 'primary', onclick: () => {
        // A box with a value out of its range keeps the last good value in the draft: fix it first.
        if (box.querySelector('input.bal-bad')) {
          msg.className = 'msg bad';
          msg.textContent = 'มีช่องที่ใส่ค่าไม่ถูกต้อง (กรอบแดง) แก้ก่อนบันทึก';
          return;
        }
        const c = draftTuning();
        if (!c.tuning) {
          msg.className = 'msg bad';
          msg.textContent = c.error;
          return;
        }
        const changes = balanceChanges(saved, c.tuning);
        if (!changes) {
          msg.className = 'msg';
          msg.textContent = 'ไม่มีอะไรเปลี่ยน';
          return;
        }
        void save({ tuning: c.tuning }, `ใช้ค่าใหม่กับทั้งเซิร์ฟทันทีไหม?\n\n${changes.slice(0, 1200)}`);
      } }, '💾 บันทึกทั้งเซิร์ฟ'),
      h('button', { onclick: () => { draft = mergeBalance(saved); redraw(); msg.textContent = ''; } }, 'ยกเลิกที่ยังไม่บันทึก'),
      h('button', { onclick: () => void save({ reset: true }, 'คืนทุกค่า (อาชีพและ tier) เป็นค่าในโค้ดทั้งเซิร์ฟเลยไหม?') }, '↺ คืนค่าในโค้ด'),
    ),
    msg,
  );

  box.replaceChildren(classCard, regenCard, tierCard, previewCard, bar);
  redraw();
}
