// The /admin "ปรับสมดุล" tab: every class's stats and the item tier tables (src/shared/balance.ts).
// Edits a draft with a live preview (class stats at Lv1/10/50 with nothing worn, tier chances); saving
// sends the whole draft, the server checks it, stores only what differs from the code, logs the change
// and applies it to everyone online at once.
import {
  BALANCE_RANGE, balanceChanges, checkBalance, classStatsAt, codeBalance, mergeBalance, STAT_MAX, STAT_PART_NAME, STAT_PARTS,
  type Balance, type BalanceTuning, type StatPart,
} from '../shared/balance';
import { CLASSES, CLASS_IDS } from '../shared/data/classes';
import { STAT_KEYS, STAT_LABEL, type ClassId, type StatKey } from '../shared/types';

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
export async function renderBalance(view: HTMLElement, h: H, api: Api, onSaved: (t: BalanceTuning) => void): Promise<void> {
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
  const tierCard = h('div', { class: 'card' });
  const drawTiers = (): void => {
    const chanceCells = draft.tierWeight.map(() => h('td', { class: 'bal-out' }));
    const bossCells = draft.tierWeight.map(() => h('td', { class: 'bal-out' }));
    const edgeCells = draft.tierWeight.map(() => h('td', { class: 'bal-out' }));
    const widthSum = h('span');
    const labelNote = h('div', { class: 'muted' });
    const refresh = (): void => {
      const total = draft.tierWeight.reduce((a, b) => a + b, 0);
      const bw = draft.tierWeight.map((w, i) => w * (1 + draft.bossTierBoost * (4 - i)));
      const btotal = bw.reduce((a, b) => a + b, 0);
      draft.tierWeight.forEach((w, i) => {
        chanceCells[i].textContent = total > 0 ? pct(w / total) : '—';
        bossCells[i].textContent = btotal > 0 ? pct(bw[i] / btotal) : '—';
      });
      // Where each tier sits in a line's range, as % of its highest roll (floor at 0 of the range).
      let top = 100;
      draft.tierWidth.forEach((w, i) => {
        const lo = top - w;
        const at = (x: number) => Math.round((draft.rangeFloor + (100 - draft.rangeFloor) * x / 100) * 10) / 10;
        edgeCells[i].textContent = `${at(lo)}–${at(top)}%`;
        top = lo;
      });
      const sum = Math.round(draft.tierWidth.reduce((a, b) => a + b, 0) * 1000) / 1000;
      widthSum.textContent = `รวม ${sum}%`;
      widthSum.className = Math.abs(sum - 100) <= 0.001 ? 'good' : 'warn';
      const labels = draft.rangeFloor !== mergeBalance(saved).rangeFloor || draft.tierWidth.join() !== mergeBalance(saved).tierWidth.join();
      labelNote.textContent = labels
        ? '⚠ เปลี่ยนความกว้าง/ค่าต่ำสุดแล้ว: ของที่ผู้เล่นมีอยู่ ค่าเดิมไม่เปลี่ยน แต่ป้าย tier และช่วง min–max ที่แสดงจะคำนวณใหม่ (สุ่มค่าตัวเลขที่ช่างตีเหล็กใช้ tier ใหม่)'
        : '';
      updateSummary();
    };
    const rows = draft.tierWeight.map((_, i) => h('tr', {},
      h('td', {}, `T${i + 1}`),
      h('td', {}, numBox(() => draft.tierWeight[i], (n) => { draft.tierWeight[i] = n; }, code.tierWeight[i], ...BALANCE_RANGE.tierWeight, 1, refresh)),
      chanceCells[i], bossCells[i],
      h('td', {}, numBox(() => draft.tierWidth[i], (n) => { draft.tierWidth[i] = n; }, code.tierWidth[i], ...BALANCE_RANGE.tierWidth, 0.5, refresh)),
      edgeCells[i],
    ));
    tierCard.replaceChildren(
      h('h2', {}, 'Tier T1–T5 ของสเตตัสบนไอเทม'),
      h('div', { class: 'muted' }, 'โอกาสเป็นน้ำหนัก (คิดเป็น % ให้เอง) · เปลี่ยนโอกาสมีผลกับของดรอปใหม่เท่านั้น ช่วงค่าไม่เลื่อน · ความกว้างรวมกันต้องได้ 100%'),
      h('div', { class: 'bal-scroll' }, h('table', { class: 'bal-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Tier'), h('th', {}, 'น้ำหนักโอกาส'), h('th', { class: 'bal-out' }, 'โอกาส'), h('th', { class: 'bal-out' }, 'โอกาส (บอส)'),
          h('th', {}, 'ความกว้าง %'), h('th', { class: 'bal-out' }, 'ช่วง (% ของค่าสูงสุด)'))),
        h('tbody', {}, ...rows))),
      h('div', { class: 'muted' }, widthSum),
      h('div', { class: 'row bal-line' },
        h('label', {}, 'ค่าต่ำสุดของช่วง (% ของค่าสูงสุด)', numBox(() => draft.rangeFloor, (n) => { draft.rangeFloor = n; }, code.rangeFloor, ...BALANCE_RANGE.rangeFloor, 1, refresh)),
        h('label', {}, 'บอสเพิ่มโอกาส tier ดี', numBox(() => draft.bossTierBoost, (n) => { draft.bossTierBoost = n; }, code.bossTierBoost, ...BALANCE_RANGE.bossTierBoost, 0.1, refresh)),
      ),
      labelNote,
    );
    refresh();
  };

  // ---------------------------------------------------------- save bar
  const summary = h('div', { class: 'muted' });
  /** The draft as the server would store it, or a Thai error. */
  const draftTuning = (): ReturnType<typeof checkBalance> => checkBalance(draft, true);
  function updateSummary(): void {
    const c = draftTuning();
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

  box.replaceChildren(classCard, regenCard, tierCard, bar);
  redraw();
}
