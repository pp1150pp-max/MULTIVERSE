// The /admin "ปรับสมดุล" tab: every class's stats and the item tier tables: central, per stat and per item-level band,
// with a preview of the real numbers an item rolls (src/shared/balance.ts).
// Edits a draft with a live preview (class stats at Lv1/10/50/80 with nothing worn, tier chances); saving
// sends the whole draft, the server checks it, stores only what differs from the code, logs the change
// and applies it to everyone online at once.
import { foldable } from './ui';
import { CIRCLE_FALLBACKS, FX_LAYER_NAME, FX_LAYER_RANGE, QUARKS_SKILLS, quarksKey, SKILL_FX_RANGE, type FxLayerNum, type QuarksSkill, type SkillFxTune } from '../shared/fxLayerTuning';
import { circleDesign, drawInner, drawOuter } from '../client/circleDesigns';
import { skillExtras } from '../client/skillExtras';
import { ATTACK_ROOT_RANGE, NO_ATTACK_ROOT } from '../shared/attackRootTuning';
import { AUDIO_GAIN_RANGE, SFX_GROUP_NAME, SFX_GROUPS } from '../shared/audioTuning';
import { FORGE_RANGE, PLUS_CAP, PLUS_NEVER } from '../shared/forgeTuning';
import { RIG_ARMOR_ITEMS, RIG_ARMOR_NAME, RIG_ARMORS, RIG_WEAPON_ITEMS, RIG_WEAPON_NAME, RIG_WEAPONS } from '../shared/rigLookTuning';
import {
  applyBalance, BALANCE_RANGE, expTuneOf, PACK_ZONES, packCount, balanceChanges, checkBalance, classStatsAt, skillMpCost, codeBalance, currentBalanceTuning, hasParts, mergeBalance, MONSTER_STAT_NAME,
  MONSTER_STATS, monsterBandOf, monsterMults, NO_MONSTER_MULT, STAT_MAX, STAT_PART_NAME, STAT_PARTS, STAT_TIER_PARTS, statTierTable, tierLabelsChange,
  tierSourceName, TUNABLE_MONSTERS, withItemStatMult, POTION_KINDS, POTION_RANGE,
  type Balance, type BalanceTuning, type MonsterMults, type MonsterStat, type StatPart, type TierParts,
} from '../shared/balance';
import { DROP_GOLD_MULT, type MonsterDef } from '../shared/data/monsters';
import {
  AUTO_ALLOW_NAME, AUTO_ALLOWS, AUTO_HOME_WAIT_NAME, AUTO_OFFLINE_NAME, AUTO_AOE_GUARD_NAME, AUTO_DEFAULT_NAME, AUTO_LOOT_ORDERS, AUTO_NUM_NAME, AUTO_OUT_ACTIONS, AUTO_RANGE, AUTO_TARGET_MODES, autoDefaultValueName,
  type AutoAllow, type AutoDefaults,
} from '../shared/autoTuning';
import { NO_BOOST, ZONES, type MonsterBoost } from '../shared/data/zones';
import { CLASSES, CLASS_IDS } from '../shared/data/classes';
import { ITEM_BASES, itemRowKinds, statStep, rowRanges, TIER_BAND_NAME, TIER_BANDS, tierBandOf, tierChances, tierRanges } from '../shared/data/items';
import { expToNext, MAX_LEVEL } from '../shared/formulas';
import { ITEM_ONLY_STATS, RARITIES, RARITY_LABEL, SLOT_LABEL, STAT_KEYS, STAT_LABEL, type ClassId, type Rarity, type StatKey } from '../shared/types';
import { FLOOR_GATE_LEVEL_MAX, FLOOR_GATE_LEVEL_MIN } from '../shared/floorGate';
import { TUT_ACCEPT_GOLD, TUT_COUNT_MAX, TUT_GOLD_MAX, TUT_LINES_MAX, TUT_REWARD_KEYS, TUT_REWARD_NAME, TUT_STONES, tutRewardText, type TutRewardKey } from '../shared/tutorial';
import type { MailAttachItem } from '../shared/mail';
import { POTION_SIZES, potionName } from '../shared/data/potions';
import { STONE_NAME } from '../shared/data/stones';
import { CODE_SET_STEPS, SET_BONUS_MAX, SET_IDS, SET_MAX_PIECES, SET_NAME, setPieceKinds } from '../shared/data/sets';
import { MOVE_GROUPS } from '../shared/moveTuning';
import { BAG_EXPAND_FLAG_NAME, BAG_EXPAND_NUMS, BAG_TAB_START } from '../shared/bagTabs';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

const PREVIEW_LEVELS = [1, 10, 50, 80];
/** Levels shown in the skill MP preview. */
const MP_COST_LEVELS = [1, 20, 40, 50, 80];
/** Stats shown with one decimal (the % ones and regen); the rest are whole numbers in the game. */
const DECIMAL = new Set<StatKey>(['crit', 'critDmg', 'atkSpeed', 'moveSpeed', 'hpRegen', 'mpRegen', 'cdr', 'buffDur', 'armorPen']);
/** Stats a class has (the item-only mods are left out of the class table). */
const CLASS_STATS = STAT_KEYS.filter((k) => !ITEM_ONLY_STATS.includes(k));
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
  const fold = foldable(box);
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
    const mpCostOut = h('div', { class: 'muted' });
    const refresh = (): void => {
      const at = PREVIEW_LEVELS.map((lv) => classStatsAt(cls, lv, draft));
      for (const k of CLASS_STATS) previewCells.get(k)!.forEach((td, i) => { td.textContent = show(k, at[i][k]); });
      // Real MP of each paid skill at a few levels, e.g. "ลูกไฟ Lv1 10 → Lv40 22 → Lv50 25".
      mpCostOut.replaceChildren(...CLASSES[cls].skills.filter((sk) => sk.mp > 0).map((sk) =>
        h('div', {}, `${sk.nameTh} ${MP_COST_LEVELS.map((lv) => `Lv${lv} ${skillMpCost(sk.mp, cls, lv, draft)}`).join(' → ')}`)));
      updateSummary();
    };
    const rows = CLASS_STATS.map((k) => {
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
    const mpCost = numBox(() => c.mpCostPerLevel, (n) => { c.mpCostPerLevel = n; }, cc.mpCostPerLevel, ...BALANCE_RANGE.mpCostPerLevel, 0.5, refresh);
    classCard.replaceChildren(
      h('h2', {}, 'ค่าอาชีพ'),
      tabs,
      h('div', { class: 'muted' }, '"ได้จริง" = ค่าตอนไม่ใส่ของ หลังคูณตัวคูณอาชีพและตัวตัดฟื้นแล้ว · ตัวคูณใช้กับค่ารวมของใส่ด้วย · ช่องสีทอง = ต่างจากค่าในโค้ด (ชี้ค้างดูค่าในโค้ด)'),
      h('div', { class: 'bal-scroll' }, table),
      h('div', { class: 'row bal-line' }, h('label', {}, 'ดาเมจใส่บอส (×)', boss)),
      h('div', { class: 'row bal-line' }, h('label', {}, 'MP สกิลเพิ่ม % ต่อเลเวล', mpCost)),
      h('div', { class: 'muted' }, 'MP ที่สกิลใช้ = MP ในโค้ด × (1 + % × (เลเวล − 1)) ปัดเป็นจำนวนเต็มใกล้สุด · โจมตีปกติและพุ่งยังไม่ใช้ MP · ค่าจริงตามเลเวล:'),
      mpCostOut,
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

  // ---------------------------------------------------------- extra lines: weights, cooldown cut cap
  const affixCard = h('div', { class: 'card' });
  const drawAffix = (): void => {
    const refresh = (): void => { updateSummary(); };
    const total = (): number => STAT_KEYS.reduce((a, k) => a + Math.max(0, draft.affixWeight[k]), 0);
    const chanceOut = new Map<StatKey, HTMLElement>();
    const showChances = (): void => {
      const t = total();
      for (const k of STAT_KEYS) chanceOut.get(k)!.textContent = t > 0 ? pct(Math.max(0, draft.affixWeight[k]) / t) : '-';
    };
    const boxes = STAT_KEYS.map((k) => {
      const out = h('span', { class: 'muted' });
      chanceOut.set(k, out);
      return h('label', {}, `${STAT_LABEL[k]}`,
        numBox(() => draft.affixWeight[k], (n) => { draft.affixWeight[k] = n; }, code.affixWeight[k], ...BALANCE_RANGE.affixWeight, 0.1, () => { showChances(); refresh(); }),
        out);
    });
    affixCard.replaceChildren(
      h('h2', {}, 'สเตตัสเสริม: น้ำหนักสุ่ม · ลดคูลดาวน์สูงสุด'),
      h('div', { class: 'muted' }, 'น้ำหนักสุ่ม = โอกาสที่บรรทัดเสริม 1 บรรทัดจะได้สเตตัสนั้น เทียบกับตัวอื่น (ค่าในโค้ด 1 ทุกตัว = เท่ากัน, 0 = ไม่ออก) ใช้กับดรอปและ "สุ่มสเตตัส" ที่ช่างตีเหล็ก · % ข้างช่อง = โอกาสต่อบรรทัดเมื่อยังไม่มีสเตตัสอื่นบนของ · มีผลกับของใหม่เท่านั้น'),
      h('div', { class: 'row bal-line' }, ...boxes),
      h('div', { class: 'row bal-line' },
        h('label', {}, 'ลดคูลดาวน์สกิลได้สูงสุด %', numBox(() => draft.cdrCap, (n) => { draft.cdrCap = n; }, code.cdrCap, ...BALANCE_RANGE.cdrCap, 1, refresh))),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft.buffDurSummons, onchange: (e: Event) => { draft.buffDurSummons = (e.target as HTMLInputElement).checked; refresh(); } }),
          ' "เพิ่มเวลาบัฟ %" นับ summon ด้วย (ป้อมปืน โดรนสนับสนุน กับระเบิด อยู่นานขึ้นตาม %) · ปิด = นับแค่บัฟ')),
      h('div', { class: 'muted' }, 'สเตตัส "ลดคูลดาวน์สกิล %" จากของทุกชิ้นบวกกัน แล้วคูลดาวน์ Q/E/R × (1 − รวม%) ไม่เกินค่านี้ (ตีธรรมดาและแดชไม่ลด) · "เพิ่มเวลาบัฟ %" = เวลาบัฟที่สกิลให้ตัวเอง/ทีม × (1 + รวม%) · "เจาะเกราะ %" = DEF มอนที่ใช้คิดดาเมจ × (1 − รวม%) ต่อจากลดเกราะของสกิล'),
    );
    showChances();
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

  // ---------------------------------------------------------- ordinary monsters
  const monsterCard = h('div', { class: 'card' });
  /** The zone boost a monster kind spawns with (its spawn area's, else its map's). */
  const boostOf = (def: MonsterDef): MonsterBoost => {
    for (const z of Object.values(ZONES)) {
      const sp = z.spawns.find((s) => s.monster === def.id);
      if (sp) return sp.boost ?? z.monsterBoost ?? NO_BOOST;
    }
    return NO_BOOST;
  };
  /** Its real numbers at its lowest level with these multipliers, worked out like Monster and Sim do. */
  const realOf = (def: MonsterDef, m: Readonly<MonsterMults>): Record<MonsterStat, string> => {
    const b = boostOf(def);
    const tough = def.ignoreTough ? 1 : (b.tough ?? 1) * (b.mobTough ?? 1);
    const spd = b.speed * (def.speedMult ?? 1);
    const r1 = (n: number) => (Math.round(n * 10) / 10).toString();
    const gold = (n: number) => Math.round(n * DROP_GOLD_MULT * m.gold);
    return {
      hp: Math.max(1, Math.round(def.hp * b.stats * tough * m.hp)).toLocaleString(),
      atk: Math.round(def.atk * b.stats * m.atk).toLocaleString(),
      def: Math.round(def.def * b.stats * tough * m.def).toLocaleString(),
      speed: r1(def.speed * spd * m.speed),
      atkSpeed: `${(Math.round((def.attackCooldown / (spd * m.atkSpeed)) * 100) / 100).toString()} วิ`,
      exp: Math.round(def.exp * m.exp).toLocaleString(),
      gold: `${gold(def.gold[0])}–${gold(def.gold[1])}`,
      aggro: r1(Math.max(def.aggroRange * m.aggro, b.aggro ?? 0)),
      range: r1(def.attackRange * m.range) + (def.shot ? ` (ยิง ${r1(def.shot.range * m.range)})` : ''),
    };
  };
  /** A multiplier box for one set (a band's or a kind's) in the draft; ×1 removes the entry. */
  const multBox = (get: () => Partial<MonsterMults> | undefined, make: () => Partial<MonsterMults>, drop: () => void, k: MonsterStat, refresh: () => void): HTMLInputElement =>
    numBox(() => get()?.[k] ?? 1, (n) => {
      const set = make();
      if (n === 1) delete set[k];
      else set[k] = n;
      if (!Object.keys(set).length) drop();
    }, 1, ...BALANCE_RANGE.monsterMult, 0.05, refresh);
  const drawMonsters = (): void => {
    const mons = draft.monsters;
    // Typing only updates the "real numbers" rows (redrawing would take the focus away).
    const realCells: { def: MonsterDef; cells: HTMLTableCellElement[] }[] = [];
    const refresh = (): void => {
      for (const { def, cells } of realCells) {
        const before = realOf(def, NO_MONSTER_MULT);
        const after = realOf(def, monsterMults(def, draft));
        MONSTER_STATS.forEach((k, i) => {
          const moved = before[k] !== after[k];
          cells[i].textContent = moved ? `${before[k]} → ${after[k]}` : before[k];
          cells[i].classList.toggle('bal-changed', moved);
        });
      }
      updateSummary();
    };
    const bandRows = TIER_BANDS.map((id) => h('tr', {}, h('td', {}, TIER_BAND_NAME[id]), ...MONSTER_STATS.map((k) => h('td', {},
      multBox(() => mons.bands?.[id], () => ((mons.bands ??= {})[id] ??= {}), () => {
        delete mons.bands![id];
        if (!Object.keys(mons.bands!).length) delete mons.bands;
      }, k, refresh)))));
    const head = (first: string) => h('thead', {}, h('tr', {}, h('th', {}, first), ...MONSTER_STATS.map((k) => h('th', {}, `${MONSTER_STAT_NAME[k]} ×`))));
    const kindRows = TUNABLE_MONSTERS.flatMap((def) => {
      const band = TIER_BANDS[monsterBandOf(def)];
      const cells = MONSTER_STATS.map(() => h('td', { class: 'bal-out' }));
      realCells.push({ def, cells });
      const lv = def.levels[0] === def.levels[1] ? `Lv${def.levels[0]}` : `Lv${def.levels[0]}–${def.levels[1]}`;
      return [
        h('tr', {}, h('td', {}, h('b', {}, def.nameTh), ` ${lv}`),
          ...MONSTER_STATS.map((k) => h('td', {}, multBox(() => mons.types?.[def.id], () => ((mons.types ??= {})[def.id] ??= {}), () => {
            delete mons.types![def.id];
            if (!Object.keys(mons.types!).length) delete mons.types;
          }, k, refresh)))),
        h('tr', {}, h('td', { class: 'muted' }, `ค่าจริง Lv${def.levels[0]} (ช่วง ${TIER_BAND_NAME[band]})`),
          ...cells),
      ];
    });
    monsterCard.replaceChildren(
      h('h2', {}, 'มอนธรรมดา (ตัวคูณ)'),
      h('div', { class: 'muted' },
        `ไม่รวมบอสห้องบอส (ลูกน้องที่บอสเรียกโดนตามชนิดของมัน แต่ยังไม่ให้ EXP/ทอง/ของ) ·ค่าที่ใช้จริง = ตัวคูณช่วงเลเวล × ตัวคูณรายตัว · ช่วงเลเวลดูจากเลเวลต่ำสุดของชนิดมอน · ใส่ได้ ×${BALANCE_RANGE.monsterMult[0]}–×${BALANCE_RANGE.monsterMult[1]} · ` +
        'ตีเร็ว ×2 = ตีถี่ขึ้น 2 เท่า · ระยะโจมตีคูณระยะกระสุนของมอนยิงไกลด้วย · ระยะ aggro ของมอนที่ไม่ตีก่อน (0) ยังเป็น 0 · บันทึกแล้วมอนที่อยู่ในเกมได้ค่าใหม่ทันที (HP คงสัดส่วนเดิม)'),
      h('h3', {}, 'ตามช่วงเลเวล'),
      h('div', { class: 'bal-scroll' }, h('table', { class: 'bal-table' }, head('ช่วงเลเวล'), h('tbody', {}, ...bandRows))),
      h('h3', {}, 'รายตัว'),
      h('div', { class: 'muted' }, 'แถว "ค่าจริง" = ค่าในโค้ด → หลังคูณทั้งสองชั้น ที่เลเวลต่ำสุดของชนิดนั้น รวมที่แมพเพิ่มให้แล้ว (ทองรวมตัวคูณดรอปทองของเกม, ตีเร็วแสดงเป็นวินาทีต่อครั้ง)'),
      h('div', { class: 'bal-scroll' }, h('table', { class: 'bal-table' }, head('มอน'), h('tbody', {}, ...kindRows))),
      h('h3', {}, 'จำนวนมอนต่อจุดเกิด (ต่อแมพ)'),
      h('div', { class: 'muted' },
        `แต่ละจุดเกิดออกมอนเป็นฝูง ×เท่านี้ (แมพไม่มีที่ให้เพิ่มจุด) · ใส่ได้ ×${BALANCE_RANGE.mobPack[0]}–×${BALANCE_RANGE.mobPack[1]} ทศนิยมได้ (×1.5 = ครึ่งหนึ่งของจุดได้เพิ่ม 1 ตัว) · ไม่รวมบอส · ` +
        'บันทึกแล้วมีผลทันที: เพิ่ม = ตัวที่เพิ่มทยอยเกิดตามเวลาเกิดใหม่ของจุด, ลด = ตัวที่เกินตายแล้วไม่เกิดใหม่ · มอน ×3 ที่ 100 คน server ยุ่งราว 1.6 เท่า เน็ตต่อคนราว 1.8 เท่า (load test 2026-11-17)'),
      h('div', { class: 'bal-scroll' }, h('table', { class: 'bal-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'แมพ'), h('th', {}, 'มอนต่อจุด ×'), h('th', {}, 'มอนทั้งแมพ (ต่อ CH)'))),
        h('tbody', {}, ...PACK_ZONES.map((z) => {
          const total = h('td', { class: 'bal-out' });
          const spawns = ZONES[z.id].spawns;
          const count = (b: Parameters<typeof packCount>[3]) => spawns.reduce((n, a, i) => n + packCount(z.id, a.count, i, b), 0);
          const show = (): void => {
            const before = count(code);
            const after = count(draft);
            total.textContent = before === after ? String(before) : `${before} → ${after}`;
            total.classList.toggle('bal-changed', before !== after);
          };
          show();
          const box = numBox(() => draft.mobPack[z.id] ?? 1, (n) => {
            if (n === 1) delete draft.mobPack[z.id];
            else draft.mobPack[z.id] = n;
          }, 1, ...BALANCE_RANGE.mobPack, 0.1, () => { show(); updateSummary(); });
          return h('tr', {}, h('td', {}, z.nameTh), h('td', {}, box), total);
        })))),
      h('h3', {}, 'การไล่เป้าหมาย'),
      h('div', { class: 'muted' },
        'บอส: อยู่กับเป้าเดิมครบกี่วินาทีแล้วสุ่มเปลี่ยนไปหาผู้เล่นที่เคยตีบอสตัวนี้ (ยังมีชีวิต อยู่ห้องเดียวกัน ไม่ใช่เป้าเดิม) · เปลี่ยนตอนบอสว่างเท่านั้น (ไม่ขัดท่าที่กำลังง้าง/พุ่ง/กระโดด) · ไม่มีคนอื่น = ไม่เปลี่ยน · 0 = ปิด · ' +
        'มอนธรรมดา: ใส่เลขมากกว่า 0 = เลิกไล่เมื่อไม่โดนตีครบกี่วินาที แล้วเดินกลับบ้านฟื้น HP · 0 = ไม่เลิกไล่จนกว่าเป้าจะตาย/ออกแมพ/ถูกลากไกลเกินระยะวิ่งกลับ (ระยะนี้ยังทำงานเสมอ)'),
      h('div', { class: 'row bal-line' },
        h('label', {}, 'บอสเปลี่ยนเป้าทุก (วินาที, 0 = ปิด)', numBox(() => draft.bossSwitchSec, (n) => { draft.bossSwitchSec = n; }, code.bossSwitchSec, ...BALANCE_RANGE.bossSwitchSec, 1, updateSummary)),
        h('label', {}, 'มอนธรรมดาเลิกไล่เมื่อไม่โดนตี (วินาที, 0 = ไม่เลิก)', numBox(() => draft.mobGiveUpSec, (n) => { draft.mobGiveUpSec = n; }, code.mobGiveUpSec, ...BALANCE_RANGE.mobGiveUpSec, 1, updateSummary)),
      ),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft.mobReturnIgnoreHits, onchange: (e: Event) => { draft.mobReturnIgnoreHits = (e.target as HTMLInputElement).checked; updateSummary(); } }),
          ' มอนเดินกลับบ้านไม่สนการโจมตี (ถูกตีระหว่างทางก็ไม่หันมาไล่ ยังโดนดาเมจและฟื้น HP ตามปกติ · ปิด = หันกลับมาไล่เหมือนเดิม)'),
      ),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft.mobDropOnSafe, onchange: (e: Event) => { draft.mobDropOnSafe = (e.target as HTMLInputElement).checked; updateSummary(); } }),
          ' มอนเลิกไล่เมื่อผู้เล่นเข้าเมือง/safe zone (ทิ้งเป้าทันทีแล้วเดินกลับจุดเกิดของตัวเอง ไม่ไล่ซ้ำตราบที่ผู้เล่นอยู่ในเมือง · ผู้เล่นออกแมพหรือตายก็เดินกลับเช่นกัน · บอสไม่เกี่ยว · ปิด = พฤติกรรมเดิม)'),
      ),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft.hubChannels, onchange: (e: Event) => { draft.hubChannels = (e.target as HTMLInputElement).checked; updateSummary(); } }),
          ' แบ่งห้องเมืองกลาง (เมืองกลางมี CH 1–10 เหมือนแมพฟาร์ม: ห้องละ 20 คน ลูกตี้ตามหัวตี้ 22 ระบบจัดห้องคนน้อยสุด ย้ายเองได้ · ปิด = ห้องเดียว (CH 1) แบบเดิม ไม่ย้ายใคร คนที่อยู่ CH 2 ขึ้นไปอยู่ห้องเดิมจนออกจากเมือง คนที่เข้าเมืองใหม่ไป CH 1 · เปิดอีกครั้ง = ใช้ตอนคนเข้าเมืองครั้งถัดไป)'),
      ),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft.bossWipeKeepHp, onchange: (e: Event) => { draft.bossWipeKeepHp = (e.target as HTMLInputElement).checked; updateSummary(); } }),
          ' บอสไม่ฟื้นเลือดตอนทีมตายหมด (ห้องบอส: ทุกคนล้ม = บอสยืนรอ HP เท่าเดิม ไม่เดินกลับ/ไม่รีเซ็ต ชุบด้วยขนนกทันเวลาแล้วสู้ต่อ · ปิด = เดินกลับฟื้นเลือดเต็มเหมือนเดิม)'),
        h('label', {}, 'เวลาชุบตอนตายหมดทีม (วินาที)', numBox(() => draft.roomWipeSec, (n) => { draft.roomWipeSec = n; }, code.roomWipeSec, ...BALANCE_RANGE.roomWipeSec, 1, updateSummary)),
      ),
      h('div', { class: 'row bal-line' },
        h('label', { title: `ค่าในโค้ด: ${code.roomBossDelay} วิ` }, 'นับถอยหลังก่อนบอสเกิด (วินาที, 0 = เกิดทันที · ใช้กับห้องที่เปิดใหม่)', numBox(() => draft.roomBossDelay, (n) => { draft.roomBossDelay = n; }, code.roomBossDelay, ...BALANCE_RANGE.roomBossDelay, 1, updateSummary)),
        h('label', { title: `ค่าในโค้ด: ${code.roomLoadWait} วิ · นับถอยหลังเริ่มเมื่อทุกคนที่เข้าห้องโหลดแมพเสร็จ (คนที่หลุด/ออกไม่ต้องรอ) หรือรอครบเวลานี้ แล้วแต่อะไรถึงก่อน ระหว่างรอผู้เล่นเห็น "รอผู้เล่นโหลด… 2/3"` }, 'เวลารอผู้เล่นโหลดสูงสุด (วินาที, 0 = ไม่รอ · ใช้กับห้องบอสและมินิเกมระลอกที่เปิดใหม่)', numBox(() => draft.roomLoadWait, (n) => { draft.roomLoadWait = n; }, code.roomLoadWait, ...BALANCE_RANGE.roomLoadWait, 1, updateSummary)),
      ),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft.heartBlastRandom, onchange: (e: Event) => { draft.heartBlastRandom = (e.target as HTMLInputElement).checked; updateSummary(); } }),
          ' หัวใจภูเขาไฟ ระเบิดใหญ่: สุ่มจุดปลอดภัยทั่วลาน (ห่างผู้เล่นทุกคน แต่ทุกคนมีจุดที่วิ่งถึงทัน · ปิด = วงรอบบอสแบบเดิม)'),
        h('label', {}, 'จำนวนจุด', numBox(() => draft.heartBlastSpots, (n) => { draft.heartBlastSpots = Math.round(n); }, code.heartBlastSpots, ...BALANCE_RANGE.heartBlastSpots, 1, updateSummary)),
        h('label', {}, 'ห่างผู้เล่นขั้นต่ำ', numBox(() => draft.heartBlastMinDist, (n) => { draft.heartBlastMinDist = n; }, code.heartBlastMinDist, ...BALANCE_RANGE.heartBlastMinDist, 1, updateSummary)),
        h('label', { title: 'ส่วนของ (ความเร็ววิ่ง × เวลาเตือน) ที่นับว่าวิ่งทัน' }, 'ค่าเผื่อวิ่งทัน', numBox(() => draft.heartBlastReach, (n) => { draft.heartBlastReach = n; }, code.heartBlastReach, ...BALANCE_RANGE.heartBlastReach, 0.05, updateSummary)),
      ),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft.bossLootSpread, onchange: (e: Event) => { draft.bossLootSpread = (e.target as HTMLInputElement).checked; updateSummary(); } }),
          ' กระจายของดรอปบอส (ห้องบอส: ของวางกระจายทั่วลาน ยิ่งชิ้นเยอะยิ่งกว้าง รัศมี = ฐาน + ตัวคูณ×√จำนวนชิ้น ไม่เกินสูงสุด · สิทธิ์เก็บ/จำนวน/โอกาสดรอปไม่เปลี่ยน · ปิด = วางใกล้ตัวบอสเหมือนเดิม)'),
        h('label', {}, 'รัศมีฐาน', numBox(() => draft.bossLootBase, (n) => { draft.bossLootBase = n; }, code.bossLootBase, ...BALANCE_RANGE.bossLootBase, 0.5, updateSummary)),
        h('label', {}, 'ตัวคูณต่อ √จำนวน', numBox(() => draft.bossLootK, (n) => { draft.bossLootK = n; }, code.bossLootK, ...BALANCE_RANGE.bossLootK, 0.1, updateSummary)),
        h('label', {}, 'รัศมีสูงสุด', numBox(() => draft.bossLootMax, (n) => { draft.bossLootMax = n; }, code.bossLootMax, ...BALANCE_RANGE.bossLootMax, 0.5, updateSummary)),
      ),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft.reviveGuard, onchange: (e: Event) => { draft.reviveGuard = (e.target as HTMLInputElement).checked; updateSummary(); } }),
          ' อมตะหลังชุบด้วยขนนกฟีนิกซ์ (ห้องบอส: ไม่โดนดาเมจ/สตัน/ผลัก/ติดโคลน/ช้า/คางคก ตัวกะพริบให้ทุกคนเห็น · หายทันทีเมื่อตีธรรมดา ใช้สกิล บัฟ หรือแดช · เดินและกินยาไม่หาย)'),
        h('label', {}, 'เวลาอมตะ (วินาที)', numBox(() => draft.reviveGuardSec, (n) => { draft.reviveGuardSec = n; }, code.reviveGuardSec, ...BALANCE_RANGE.reviveGuardSec, 1, updateSummary)),
      ),
      h('div', { class: 'row bal-line' },
        h('span', { class: 'muted' }, 'VIP (ซื้อในแคชช็อป ผูกบัญชี · ซ้อนกับใบคูณ ×2 ได้ · เทรดไม่จำกัด)'),
        h('label', { title: `ค่าในโค้ด: ${code.vipExpPct}% (ปัดลง)` }, 'โบนัส EXP %', numBox(() => draft.vipExpPct, (n) => { draft.vipExpPct = n; }, code.vipExpPct, ...BALANCE_RANGE.vipExpPct, 1, updateSummary)),
        h('label', { title: `ค่าในโค้ด: ${code.vipDropPct}%` }, 'โบนัสโอกาสดรอป %', numBox(() => draft.vipDropPct, (n) => { draft.vipDropPct = n; }, code.vipDropPct, ...BALANCE_RANGE.vipDropPct, 1, updateSummary)),
      ),
    );
    refresh();
  };

  // ---------------------------------------------------------- save bar
  const summary = h('div', { class: 'muted' });
  /** The draft as the server would store it, or a Thai error. */
  // ---------------------------------------------------------- potions (owner 2026-11-17)
  // ---------------------------------------------------------- EXP needed to level, × per 10 levels
  const expCard = h('div', { class: 'card' });
  const drawExp = (): void => {
    const codeTune = expTuneOf(code);
    const fmt = (n: number) => n.toLocaleString();
    const rows = TIER_BANDS.map((id, i) => {
      const first = i * 10 + 1;
      const last = Math.min(MAX_LEVEL - 1, first + 9);
      const out = h('td', { class: 'bal-out' });
      const show = (): void => {
        const tune = expTuneOf(draft);
        const before = `${fmt(expToNext(first, codeTune))} … ${fmt(expToNext(last, codeTune))}`;
        const after = `${fmt(expToNext(first, tune))} … ${fmt(expToNext(last, tune))}`;
        out.textContent = before === after ? before : `${before} → ${after}`;
        out.classList.toggle('bal-changed', before !== after);
      };
      show();
      const box = numBox(() => draft.expMult[id] ?? 1, (n) => {
        if (n === 1) delete draft.expMult[id];
        else draft.expMult[id] = n;
      }, 1, ...BALANCE_RANGE.expMult, 0.05, () => { show(); updateSummary(); });
      return h('tr', {}, h('td', {}, TIER_BAND_NAME[id]), h('td', {}, box), out);
    });
    expCard.replaceChildren(
      h('h2', {}, `EXP ที่ต้องใช้อัปเลเวล (เพดาน Lv.${MAX_LEVEL})`),
      h('div', { class: 'muted' },
        `คูณ EXP ที่ต้องใช้อัปเลเวลตามสูตรในโค้ด แยกทีละ 10 เลเวล · ใส่ได้ ×${BALANCE_RANGE.expMult[0]}–×${BALANCE_RANGE.expMult[1]} (×2 = ต้องเก็บ EXP มากขึ้น 2 เท่า) · ` +
        'มีผลทันทีกับหลอด EXP ทุกคน (EXP ที่มีอยู่ไม่เปลี่ยน ลดตัวคูณจนเกินหลอด = เลเวลอัปตอนได้ EXP ครั้งถัดไป) · โทษตายเสีย 10% ของหลอดตามค่าใหม่'),
      h('div', { class: 'bal-scroll' }, h('table', { class: 'bal-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'ช่วงเลเวล'), h('th', {}, 'EXP ×'), h('th', { class: 'bal-out' }, 'EXP ต่อเลเวล (ต้นช่วง … ท้ายช่วง)'))),
        h('tbody', {}, ...rows))),
    );
  };

  const potionCard = h('div', { class: 'card' });
  const drawPotions = (): void => {
    const pb = draft.potions;
    const outs: (() => void)[] = [];
    const refresh = (): void => { outs.forEach((f) => f()); updateSummary(); };
    const rows = POTION_KINDS.flatMap((k) => POTION_SIZES.map((z) => {
      const v = pb[k][z];
      const cv = code.potions[k][z];
      const out = h('td', { class: 'bal-out' });
      outs.push(() => {
        out.textContent = `ขายคืน ${Math.floor(v.price / 2).toLocaleString()} G` + (k === 'hp' ? ` · นักดาบฟื้น ${Math.round((v.amount * (100 + pb.swordBonus)) / 100).toLocaleString()}` : '');
      });
      return h('tr', {},
        h('td', {}, potionName(k, z)),
        h('td', {}, numBox(() => v.amount, (n) => { v.amount = Math.round(n); }, cv.amount, ...POTION_RANGE.amount, 1, refresh)),
        h('td', {}, numBox(() => v.price, (n) => { v.price = Math.round(n); }, cv.price, ...POTION_RANGE.price, 1, refresh)),
        out);
    }));
    potionCard.replaceChildren(
      h('h2', {}, 'ยา'),
      h('div', { class: 'muted' }, 'ฟื้นต่อขวด (HP/MP ตามชนิดยา) และราคาที่พ่อค้าขาย · พ่อค้ารับซื้อคืนครึ่งราคา (ปัดลง) · มีผลทันทีกับร้าน tooltip การกินยา และการเรียงตามมูลค่า · ของที่อยู่ในกระเป๋าแล้วใช้ค่าใหม่'),
      h('div', { class: 'bal-scroll' }, h('table', { class: 'bal-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'ยา'), h('th', {}, 'ฟื้น'), h('th', {}, 'ราคา (G)'), h('th', { class: 'bal-out' }, 'ได้จริง'))),
        h('tbody', {}, ...rows))),
      h('div', { class: 'row bal-line' }, h('label', {}, 'นักดาบฟื้นจากยา HP เพิ่ม (%)', numBox(() => pb.swordBonus, (n) => { pb.swordBonus = n; }, code.potions.swordBonus, ...POTION_RANGE.swordBonus, 5, refresh))),
      h('div', { class: 'muted' }, 'ยาที่มอนดรอป (ทั้งมอนธรรมดาและบอส) ขนาดตามเลเวลของมอน: ต่ำกว่าเลเวลยากลาง = ยาเล็ก · 81 = ไม่ดรอปขนาดนั้น'),
      h('div', { class: 'row bal-line' }, h('label', {}, 'ดรอปยากลางตั้งแต่ Lv', numBox(() => pb.dropM, (n) => { pb.dropM = Math.round(n); }, code.potions.dropM, ...POTION_RANGE.dropLevel, 1, refresh))),
      h('div', { class: 'row bal-line' }, h('label', {}, 'ดรอปยาใหญ่ตั้งแต่ Lv', numBox(() => pb.dropL, (n) => { pb.dropL = Math.round(n); }, code.potions.dropL, ...POTION_RANGE.dropLevel, 1, refresh))),
    );
    outs.forEach((f) => f());
  };

  // ---------------------------------------------------------- blacksmith (forgeAuto: browser-side Auto enhance)
  const forgeCard = h('div', { class: 'card' });
  const drawForge = (): void => {
    const f = draft.forge;
    const cf = code.forge;
    const outs: (() => void)[] = [];
    const refresh = (): void => { outs.forEach((fn) => fn()); updateSummary(); };
    const COST_LEVELS = [1, 40, 80];
    const cost = (lv: number, t: number) => Math.round((f.costBase + lv * f.costPerLevel) * f.costMult[t]);
    const rows: HTMLTableRowElement[] = [];
    for (let t = 1; t <= PLUS_CAP; t++) {
      const out = h('td', { class: 'bal-out' });
      outs.push(() => {
        let sum = 0;
        for (let i = 1; i <= t; i++) sum += f.bonusStep[i];
        const notes = [
          `โบนัสรวม +${Math.round(sum * 1000) / 1000}%`,
          `ราคา ${COST_LEVELS.map((lv) => `Lv${lv} ${cost(lv, t).toLocaleString()}`).join(' / ')} G`,
          t > f.maxPlus ? 'เกินเพดาน (ตีไม่ได้)' : '',
          t >= f.dropFrom ? 'ล้ม = ระดับ −1' : '',
          t >= f.stoneFrom && f.stonesPerTry > 0 ? `หิน ${f.stonesPerTry}` : '',
          t >= f.hiddenFrom ? 'ผู้เล่นเห็น ??' : '',
        ].filter(Boolean);
        out.textContent = notes.join(' · ');
      });
      rows.push(h('tr', {},
        h('td', {}, `+${t}`),
        h('td', {}, numBox(() => f.rate[t], (n) => { f.rate[t] = Math.round(n * 100) / 100; }, cf.rate[t], ...FORGE_RANGE.rate, 0.5, refresh)),
        h('td', {}, numBox(() => f.costMult[t], (n) => { f.costMult[t] = n; }, cf.costMult[t], ...FORGE_RANGE.costMult, 1, refresh)),
        h('td', {}, numBox(() => f.bonusStep[t], (n) => { f.bonusStep[t] = n; }, cf.bonusStep[t], ...FORGE_RANGE.bonusStep, 1, refresh)),
        out));
    }
    type FNum = 'costBase' | 'costPerLevel' | 'pity' | 'dropFrom' | 'stoneFrom' | 'stonesPerTry' | 'announceFrom' | 'bannerFrom' | 'maxPlus' | 'cd' | 'orbMin' | 'sellPerPlus' | 'hiddenFrom';
    const num = (k: FNum, label: string, range: readonly [number, number], step: number, whole: boolean) =>
      h('label', {}, label, numBox(() => f[k], (n) => { f[k] = whole ? Math.round(n) : n; }, cf[k], range[0], range[1], step, refresh));
    const never = `${PLUS_NEVER} = ไม่มี`;
    const aura = f.aura.map((_, i) => numBox(() => f.aura[i], (n) => {
      f.aura[i] = Math.round(n);
    }, cf.aura[i], ...FORGE_RANGE.from, 1, refresh));
    const auraNote = h('span', { class: 'muted' });
    outs.push(() => {
      const ok = f.aura.every((n, i) => i === 0 || n >= f.aura[i - 1]);
      auraNote.textContent = ok ? '' : ' ⚠ ต้องเรียงจากน้อยไปมาก (server จะไม่รับ)';
    });
    forgeCard.replaceChildren(
      h('h2', {}, 'ตีบวก'),
      h('div', { class: 'muted' },
        'โอกาส ราคา โบนัส และกติกาตีบวกทั้งหมด (เจ้าของ 2026-11-20) · มีผลทันทีทั้ง server และหน้าต่างช่างตีเหล็ก · ' +
        `ราคา = (ราคาพื้นฐาน + เลเวลไอเทม × ราคาเพิ่มต่อเลเวล) × ตัวคูณของระดับเป้าหมาย · ล้มแต่ละครั้งได้ pity เพิ่มจนกว่าจะสำเร็จ · ` +
        `ระดับ "เริ่ม…" ใส่ ${never} · ลดเพดานแล้ว ของที่ตีเกินไปแล้วคงระดับ/โบนัส/ลูกแก้วเดิม แค่ตีต่อไม่ได้ (เพดานสูงสุด +${PLUS_CAP}) · ` +
        'แก้โบนัส % = ค่าสเตตัสของของที่ตีแล้วทุกชิ้นเปลี่ยนทันที'),
      h('div', { class: 'bal-scroll' }, h('table', { class: 'bal-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'ระดับเป้าหมาย'), h('th', {}, 'โอกาสสำเร็จ %'), h('th', {}, 'ตัวคูณราคา'), h('th', {}, 'โบนัส % ที่ได้เพิ่ม'), h('th', { class: 'bal-out' }, 'ได้จริง'))),
        h('tbody', {}, ...rows))),
      h('div', { class: 'row bal-line' },
        num('costBase', 'ราคาพื้นฐาน (G) ', FORGE_RANGE.costBase, 1, true),
        num('costPerLevel', 'ราคาเพิ่มต่อเลเวลไอเทม (G) ', FORGE_RANGE.costPerLevel, 1, false),
        num('pity', 'pity ต่อครั้งที่ล้ม (%) ', FORGE_RANGE.pity, 0.5, false),
        num('maxPlus', 'ระดับสูงสุด (+) ', FORGE_RANGE.maxPlus, 1, true),
        num('cd', 'คูลดาวน์ช่างตีเหล็ก (วิ, ตีบวก+สุ่ม) ', FORGE_RANGE.cd, 0.1, false)),
      h('div', { class: 'row bal-line' },
        num('dropFrom', 'ระดับเริ่มตกเมื่อล้ม (+) ', FORGE_RANGE.from, 1, true),
        num('stoneFrom', 'ระดับเริ่มใช้หินตีบวก (+) ', FORGE_RANGE.from, 1, true),
        num('stonesPerTry', 'หินตีบวกต่อครั้ง ', FORGE_RANGE.stonesPerTry, 1, true),
        num('announceFrom', 'ระดับเริ่มประกาศทั้งเซิร์ฟ (+) ', FORGE_RANGE.from, 1, true),
        num('bannerFrom', 'ระดับเริ่มป้ายประกาศกลางจอ (+) ', FORGE_RANGE.from, 1, true),
        num('hiddenFrom', 'ระดับเริ่มซ่อนโอกาสเป็น ?? (+) ', FORGE_RANGE.from, 1, true)),
      h('div', { class: 'row bal-line' },
        num('orbMin', 'ระดับเริ่มมีลูกแก้ว (+) ', FORGE_RANGE.from, 1, true),
        h('label', {}, 'ออร่าขั้น 1–4 เริ่มที่ (+) ', ...aura, auraNote),
        num('sellPerPlus', 'ราคาขายให้พ่อค้าเพิ่มต่อระดับ (%) ', FORGE_RANGE.sellPerPlus, 5, false)),
      h('h3', {}, 'ตีบวก Auto'),
      h('div', { class: 'muted' },
        'ตีบวก Auto: ปุ่มในหน้าต่างช่างตีเหล็ก (เมนูตีบวก) เลือกระดับเป้าหมายแล้วตีให้เองทีละครั้ง เร็วเท่ากดเอง (รอหลอดคูลดาวน์ + แสดงผลทุกครั้ง) · ' +
        'หยุดเมื่อถึงเป้า / ทองหรือหินไม่พอ / หินกันระดับลดหมด (ถ้าติ๊กไว้) / กดหยุด / ปิดหน้าต่าง เดินห่าง เปลี่ยนของ ตาย เปลี่ยนแมพ หลุด · ' +
        'server ตรวจทอง/หิน/คูลดาวน์ทุกครั้งเหมือนกดเอง (โอกาสและราคาไม่เปลี่ยน) · ปิด = ซ่อนปุ่ม และ Auto ที่กำลังตีอยู่หยุดทันที'),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft.forgeAuto, onchange: (e: Event) => { draft.forgeAuto = (e.target as HTMLInputElement).checked; updateSummary(); } }),
          ' เปิดใช้ตีบวก Auto'),
      ),
    );
    outs.forEach((fn) => fn());
  };

  // ---------------------------------------------------------- item sets (src/shared/data/sets.ts)
  const setCard = h('div', { class: 'card' });
  const drawSets = (): void => {
    const sc = draft.sets;
    const rows = SET_IDS.map((id) => h('tr', {},
      h('td', {}, SET_NAME[id]),
      ...CODE_SET_STEPS.map((_, i) => h('td', {}, numBox(() => sc.steps[id][i], (n) => { sc.steps[id][i] = n; }, code.sets.steps[id][i], 1, SET_MAX_PIECES, 1, updateSummary)))));
    setCard.replaceChildren(
      h('h2', {}, 'เซ็ตไอเทม'),
      h('div', { class: 'muted' },
        `ชิ้นเซ็ตนับทุกช่องที่ใส่ (แหวน 2 วงนับ 2 ชิ้น) สูงสุด ${SET_MAX_PIECES} ชิ้น · หน้ารายละเอียดไอเทมแสดง "ชื่อเซ็ต (ใส่อยู่/${SET_MAX_PIECES})" และขั้นโบนัส · ` +
        'โบนัสสะสม: ถึงขั้นไหนได้โบนัสของขั้นนั้นบวกขั้นก่อนหน้า (6 ชิ้น = ขั้น 1 + ขั้น 2) · ได้ตามเลขที่ตั้งตรง ๆ ไม่คูณตัวคูณอาชีพ · ' +
        'ค่าในโค้ดเป็น 0 ทุกช่อง · บันทึกแล้วคนที่ออนไลน์ได้ค่าใหม่ทันที · ปิด = ไม่แสดงเซ็ตบนไอเทม และไม่คิดโบนัส'),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: sc.on, onchange: (e: Event) => { sc.on = (e.target as HTMLInputElement).checked; updateSummary(); } }),
          ' เปิดระบบเซ็ตไอเทม'),
      ),
      h('table', { class: 'bal-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'เซ็ต'), ...CODE_SET_STEPS.map((_, i) => h('th', {}, `ขั้น ${i + 1} (ชิ้น)`)))),
        h('tbody', {}, ...rows)),
      h('div', { class: 'muted' }, `แต่ละขั้นต้องมากกว่าขั้นก่อน (1–${SET_MAX_PIECES}) · ค่าในโค้ด ${CODE_SET_STEPS.join(' / ')}`),
      h('h3', {}, 'โบนัสต่อขั้น'),
      ...SET_IDS.map((id) => h('details', { class: 'bal-line' },
        h('summary', {}, `${SET_NAME[id]} (${setPieceKinds(id).length} ชนิด, Lv${Math.min(...setPieceKinds(id).map((b) => b.minLevel))})`),
        h('table', { class: 'bal-table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'สเตตัส'), ...CODE_SET_STEPS.map((_, i) => h('th', {}, `ขั้น ${i + 1}`)))),
          h('tbody', {}, ...STAT_KEYS.map((k) => h('tr', {},
            h('td', {}, STAT_LABEL[k]),
            ...CODE_SET_STEPS.map((_, i) => h('td', {}, numBox(() => sc.bonus[id][i][k] ?? 0, (n) => {
              if (n) sc.bonus[id][i][k] = n;
              else delete sc.bonus[id][i][k];
            }, 0, 0, SET_BONUS_MAX, statStep(k), updateSummary))))))))),
    );
  };

  // ---------------------------------------------------------- floor gates (src/shared/floors.ts, plan 4.2)
  const floorCard = h('div', { class: 'card' });
  const drawFloor = (): void => {
    const box = (key: 'floorGateOpen' | 'floorGateQuest', label: string): HTMLElement =>
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft[key], onchange: (e: Event) => { draft[key] = (e.target as HTMLInputElement).checked; updateSummary(); } }),
          ` ${label}`));
    const fg = draft.floorGate;
    const cg = code.floorGate;
    floorCard.replaceChildren(
      h('h2', {}, 'ทางขึ้นชั้น 2'),
      h('div', { class: 'muted' },
        'ขึ้นชั้น 2 ผ่านนักเดินเรือแห่งมิติหน้าน้ำพุในเมืองศูนย์กลางมิติ (เห็นเฉพาะตัวที่ถึงเงื่อนไข) คุยครั้งแรก = ส่งเควส เปิดทาง + รางวัลทางจดหมาย (ผูกตัว ครั้งเดียวต่อตัวละคร Guest ส่งไม่ได้) แล้วพาไปท่าเรือมิติ · ' +
        'ปิด "เปิดทาง" = ไม่มีใครขึ้นได้ แม้ทำเควสแล้ว (เข้าเกมใหม่ไปเกิดที่เมืองชั้น 1) · ' +
        'ปิด "ต้องทำเควส" = ถึงเลเวลขั้นต่ำก็ขึ้นได้เลย ไม่ต้องปราบบอส ไม่ได้รางวัล · ตัวที่อยู่ชั้น 2 อยู่แล้วไม่ถูกย้ายออก'),
      box('floorGateOpen', 'เปิดทางขึ้นชั้น 2'),
      box('floorGateQuest', 'ต้องทำเควสก่อนขึ้น'),
      h('div', { class: 'row bal-line' },
        h('label', {}, 'เลเวลขั้นต่ำ ', numBox(() => fg.minLevel, (n) => { fg.minLevel = n; }, cg.minLevel, FLOOR_GATE_LEVEL_MIN, FLOOR_GATE_LEVEL_MAX, 1, () => updateSummary())),
        h('span', { class: 'muted' }, ` ค่าในโค้ด ${cg.minLevel}`)),
      h('div', { class: 'row bal-line' },
        h('label', { title: `ค่าในโค้ด: ${cg.needBoss ? 'เปิด' : 'ปิด'}` },
          h('input', { type: 'checkbox', checked: fg.needBoss, onchange: (e: Event) => { fg.needBoss = (e.target as HTMLInputElement).checked; updateSummary(); } }),
          ' ต้องเคยปราบหัวใจภูเขาไฟ')),
      floorRewardBox(),
    );
  };

  // ---------------------------------------------------------- floor 2 monster moves (src/shared/moveTuning.ts, plan 5)
  const moveCard = h('div', { class: 'card' });
  const drawMoves = (): void => {
    const groups = MOVE_GROUPS.map((g) => h('div', { class: 'bal-line' },
      h('h3', {}, g.title),
      ...g.params.map((q) => h('div', { class: 'row bal-line' },
        h('label', {}, `${q.label} `, numBox(() => draft.moves[q.key], (n) => { draft.moves[q.key] = n; }, q.code, q.min, q.max, q.step, () => updateSummary())),
        h('span', { class: 'muted' }, ` ${q.unit ?? ''} · ค่าในโค้ด ${q.code}`)))));
    moveCard.replaceChildren(
      h('h2', {}, 'ท่ามอนชั้น 2'),
      h('div', { class: 'muted' },
        'ค่าท่าใหม่ของมอนและบอสชั้น 2 (แมพ 1 หาดเรือแตก) มีผลทันทีหลังบันทึก · ×ATK = คูณพลังโจมตีของมอน (บอสในห้องคูณตามจำนวนกุญแจด้วย) · ' +
        'ค่า HP/ATK/DEF ของมอนธรรมดาปรับในการ์ดตัวคูณมอน · นางนวลขโมยทองจริง ตีตกภายในเวลาบินหนีได้คืนคนที่โดนขโมย ไม่ทัน = ทองหาย'),
      ...groups,
    );
  };

  // ---------------------------------------------------------- bag tabs + buying slots (src/shared/bagTabs.ts)
  const bagCard = h('div', { class: 'card' });
  const drawBag = (): void => {
    const b = draft.bagExpand;
    const cb = code.bagExpand;
    const out = h('div', { class: 'muted' });
    const refresh = (): void => {
      // The price of each buy from 30 slots up to the top, as players would see it.
      const rows: string[] = [];
      for (let n = BAG_TAB_START, k = 0; n < b.max && k < 30; n += b.step, k++) {
        const add = Math.min(b.step, b.max - n);
        rows.push(`${n}→${n + add}: ${Math.round(b.goldBase * b.goldGrow ** k).toLocaleString()} G / ${Math.round(b.crystalBase * b.crystalGrow ** k).toLocaleString()} คริสตัล`);
      }
      out.textContent = rows.length ? `ราคาแต่ละครั้ง (ต่อแท็บ): ${rows.join(' · ')}` : 'ขยายไม่ได้ (สูงสุดไม่เกิน 30)';
      updateSummary();
    };
    const flag = (k: 'on' | 'gold' | 'crystal') =>
      h('label', { title: `ค่าในโค้ด: ${cb[k] ? 'เปิด' : 'ปิด'}` },
        h('input', { type: 'checkbox', checked: b[k], onchange: (e: Event) => { b[k] = (e.target as HTMLInputElement).checked; refresh(); } }),
        ` ${BAG_EXPAND_FLAG_NAME[k]}`);
    const num = (k: keyof typeof BAG_EXPAND_NUMS, step: number) =>
      h('label', {}, `${BAG_EXPAND_NUMS[k].name} `, numBox(() => b[k], (n) => { b[k] = BAG_EXPAND_NUMS[k].dp ? n : Math.round(n); }, cb[k], ...BAG_EXPAND_NUMS[k].range, step, refresh));
    bagCard.replaceChildren(
      h('h2', {}, 'กระเป๋า'),
      h('div', { class: 'muted' }, 'กระเป๋ามี 2 แท็บ (เจ้าของ 2026-11-23): "กระเป๋า" ของสวมใส่ 30 ช่อง · "ประเภทใช้งาน" ยา หิน กุญแจ ขนนก ม้วน ใบคูณ โทรโข่ง กล่องปริศนา ลูกแก้ว 30 ช่อง · แท็บเต็ม = เก็บ/ซื้อ/รับไม่ได้'),
      h('div', { class: 'muted' }, 'ขยายช่อง: ปิด = ผู้เล่นไม่เห็นปุ่มและ server ไม่รับ · เปิด = ปุ่มใต้ช่องกระเป๋า ขยายทีละแท็บ ต่อตัวละคร · ครั้งที่ k (เริ่ม 0) ราคา = ราคาครั้งแรก × ตัวคูณ^k · คริสตัลหักใน transaction เดียวกับการเซฟ · Guest จ่ายคริสตัลไม่ได้'),
      h('div', { class: 'row bal-line' }, flag('on'), flag('gold'), flag('crystal')),
      h('div', { class: 'row bal-line' }, num('step', 1), num('max', 10)),
      h('div', { class: 'row bal-line' }, num('goldBase', 1000), num('goldGrow', 0.1)),
      h('div', { class: 'row bal-line' }, num('crystalBase', 10), num('crystalGrow', 0.1)),
      out,
    );
    refresh();
  };

  // ---------------------------------------------------------- English (docs/systems/i18n.md)
  const langCard = h('div', { class: 'card' });
  const drawLang = (): void => {
    langCard.replaceChildren(
      h('h2', {}, 'ภาษาอังกฤษ'),
      h('div', { class: 'muted' },
        'ผู้เล่นเลือกภาษา ไทย / English ได้ที่ เมนู → ตั้งค่า (ครั้งแรกเลือกตามภาษาของเบราว์เซอร์) มีผลตอนเปิดเกมครั้งถัดไป · ' +
        'ปิด = ทุกคนเห็นภาษาไทย และซ่อนปุ่มเลือกภาษา (คนที่เปิดเกมค้างเป็นอังกฤษอยู่จะกลับเป็นไทยตอนเปิดเกมใหม่)'),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft.english, onchange: (e: Event) => { draft.english = (e.target as HTMLInputElement).checked; updateSummary(); } }),
          ' เปิดให้เลือกภาษาอังกฤษ'),
      ),
    );
  };

  // ---------------------------------------------------------- Auto Play (src/shared/autoTuning.ts)
  const autoCard = h('div', { class: 'card' });
  const drawAuto = (): void => {
    const a = draft.auto;
    const ca = code.auto;
    const refresh = (): void => { updateSummary(); };
    const pick = <K extends keyof AutoDefaults>(k: K, values: readonly AutoDefaults[K][]): HTMLSelectElement => {
      const sel = h('select', {
        title: `ค่าในโค้ด: ${autoDefaultValueName(k, ca.defaults[k])}`,
        onchange: (e: Event) => {
          const i = (e.target as HTMLSelectElement).selectedIndex;
          a.defaults[k] = values[i];
          sel.classList.toggle('bal-changed', a.defaults[k] !== ca.defaults[k]);
          refresh();
        },
      }, ...values.map((v) => h('option', { selected: v === a.defaults[k] }, autoDefaultValueName(k, v))));
      sel.classList.toggle('bal-changed', a.defaults[k] !== ca.defaults[k]);
      return sel;
    };
    const num = (k: keyof typeof AUTO_RANGE, step: number) =>
      h('label', {}, AUTO_NUM_NAME[k], numBox(() => a[k], (n) => { a[k] = n; }, ca[k], AUTO_RANGE[k][0], AUTO_RANGE[k][1], step, refresh));
    const allow = (k: AutoAllow) => {
      const cb = h('input', { type: 'checkbox', checked: a.allow[k], onchange: (e: Event) => { a.allow[k] = (e.target as HTMLInputElement).checked; refresh(); } });
      return h('label', {}, cb, ` ${AUTO_ALLOW_NAME[k]}`);
    };
    autoCard.replaceChildren(
      h('h2', {}, 'Auto Play'),
      h('div', { class: 'muted' }, 'ค่าเริ่มต้น = ใช้กับตัวเลือกที่ผู้เล่นยังไม่เคยเปลี่ยนเองในหน้าต่างตั้งค่า Auto (มีผลทันทีแม้คนที่ออนไลน์ · ช่องที่ผู้เล่นเปลี่ยนเองแล้วใช้ค่าของเขา)'),
      h('div', { class: 'row bal-line' },
        h('label', {}, `${AUTO_DEFAULT_NAME.lootOrder} `, pick('lootOrder', AUTO_LOOT_ORDERS)),
        h('label', {}, `${AUTO_DEFAULT_NAME.othersLoot} `, pick('othersLoot', [true, false])),
        h('label', {}, `${AUTO_DEFAULT_NAME.target} `, pick('target', AUTO_TARGET_MODES)),
      ),
      h('div', { class: 'row bal-line' },
        h('label', {}, `${AUTO_DEFAULT_NAME.skillsOnly} `, pick('skillsOnly', [false, true])),
        num('skillGap', 0.1),
      ),
      h('div', { class: 'muted' }, 'ใช้สกิลอย่างเดียว = Auto ไม่ตีธรรมดา ยืนรอสกิล (สกิลพร้อมแต่ไม่ถึงเป้า = เดินเข้าไปใกล้) · เว้นระหว่างสกิล = หลัง Auto กดสกิลหนึ่ง รอเท่านี้ก่อนกดสกิลถัดไป (0 = ไม่เว้น) ผู้เล่นตั้งเองได้ในหน้าต่างตั้งค่า Auto'),
      h('div', { class: 'row bal-line' },
        h('label', {}, `${AUTO_DEFAULT_NAME.noHp} `, pick('noHp', AUTO_OUT_ACTIONS)),
        h('label', {}, `${AUTO_DEFAULT_NAME.noMp} `, pick('noMp', AUTO_OUT_ACTIONS)),
        h('label', {}, `${AUTO_DEFAULT_NAME.bagFull} `, pick('bagFull', AUTO_OUT_ACTIONS)),
      ),
      h('div', { class: 'row bal-line' }, num('giveUpSec', 0.5), num('nearDist', 0.5), num('threatDist', 0.5)),
      h('div', { class: 'muted' }, 'ข้ามของ = เดินไปหาของชิ้นเดิมแล้วไม่เข้าใกล้ขึ้นเลยนานเท่านี้ (ติดสิ่งกีดขวาง/เก็บไม่ได้) จะเลิกสนใจชิ้นนั้น · ระยะ 2 ช่องหลังใช้กับลำดับ "สมดุล" (1 ช่องในแมพ = 50 px)'),
      h('div', { class: 'muted' }, 'สวิตช์ทั้งเซิร์ฟ (ติ๊กออก = ผู้เล่นเลือกไม่ได้ Auto ใช้แบบปลอดภัยแทน: เก็บของก่อน→สมดุล, ของคนอื่น→ของตัวเอง, ม้วน→หยุด Auto, ชนิดมอนที่ไม่ตี→ตีทุกชนิด)'),
      h('div', { class: 'row bal-line' }, ...AUTO_ALLOWS.map(allow)),
      h('div', { class: 'row bal-line' },
        h('label', {}, h('input', { type: 'checkbox', checked: a.offline, onchange: (e: Event) => { a.offline = (e.target as HTMLInputElement).checked; refresh(); } }), ` ${AUTO_OFFLINE_NAME}`),
        num('offlineMin', 1),
      ),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด · ปิด = วิ่งไปรอที่จุดเกิดมอนในวง (แบบเดิม)' },
          h('input', { type: 'checkbox', checked: a.homeWait, onchange: (e: Event) => { a.homeWait = (e.target as HTMLInputElement).checked; refresh(); } }),
          ` ${AUTO_HOME_WAIT_NAME}`),
      ),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' }, h('input', { type: 'checkbox', checked: a.aoeGuard, onchange: (e: Event) => { a.aoeGuard = (e.target as HTMLInputElement).checked; refresh(); } }), ` ${AUTO_AOE_GUARD_NAME}`),
        num('aoeMargin', 0.1),
      ),
      h('div', { class: 'muted' }, 'ทุกอาชีพ: Auto กดสกิลเมื่อสกิลนั้นถึงจริงเท่านั้น (ระยะสกิลตามที่ปรับ + ขนาดตัวมอน − ระยะเผื่อพลาด: มอนต้องเข้ามาลึกกว่าขอบสกิลเท่านี้ กันวืด ยิ่งมากยิ่งกดช้า) · วงรอบตัว = มีมอนในวง · ยิง/พุ่ง/ฟันด้านหน้า = เป้าอยู่ในระยะสกิล (ยิงระเบิดบวกวงระเบิด) · ตกที่จุด = ระยะร่าย + วงตก · บัฟ/สกิลวงที่ไม่มีดาเมจ กดตามเดิม · ไม่ถึง = ข้ามไปสกิลถัดไปในลำดับ ไม่มีสกิลไหนถึง = ตีธรรมดาต่อ (ไม่เดินเข้าไปเพิ่ม) · ปิดสวิตช์ = แบบเดิม กดทันทีที่ตีธรรมดาถึง'),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft.walkHidden, onchange: (e: Event) => { draft.walkHidden = (e.target as HTMLInputElement).checked; refresh(); } }),
          ' เดินต่อเมื่อสลับแท็บ'),
      ),
      h('div', { class: 'muted' }, 'เดินต่อเมื่อสลับแท็บ (ไม่ใช่ Auto): คลิกเดินไปจุดไกลแล้วสลับไปแท็บอื่น/พับจอ server พาเดินต่อจนถึงจุดที่คลิก (เดินตรงไป ไถลอ้อมของกลมชิ้นเดียวได้ ไม่หาทางอ้อมกำแพง ติดแทบไม่ขยับ 0.8 วิ = หยุด) · กลับมาที่แท็บ ตัวเลื่อนไปที่จริงแล้วเดินต่อเอง · ตาย/เปลี่ยนแมพ/วาร์ป/เทรด/หลุด = หยุด · ปิด = แบบเดิม สลับแท็บแล้วตัวหยุด'),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft.shopNoEquip, onchange: (e: Event) => { draft.shopNoEquip = (e.target as HTMLInputElement).checked; refresh(); } }),
          ' ห้ามถอด/สวมขณะเปิดร้านพ่อค้า'),
      ),
      h('div', { class: 'muted' }, 'ห้ามถอด/สวมขณะเปิดร้านพ่อค้า: ตอนหน้าต่างร้านพ่อค้าเปิด คลิก/ลาก/ปุ่มในรายละเอียดที่จะสวมหรือถอดอุปกรณ์ (และของแต่งตัวในกระเป๋าแฟชั่น) ไม่ทำงาน ขึ้นข้อความ "ปิดร้านก่อน" กันกดขายผิด · หน้าต่างอื่น (ช่างตีเหล็ก คลัง ตลาด) ไม่โดน · ยาที่เลือกให้ปุ่มด่วนไม่โดน · กันกดผิดฝั่งเบราว์เซอร์เท่านั้น (server ไม่รู้ว่าหน้าต่างร้านเปิดอยู่) · ปิด = ถอด/สวมได้ตามเดิม'),
      h('div', { class: 'row bal-line' },
        h('label', { title: 'ค่าในโค้ด: เปิด' },
          h('input', { type: 'checkbox', checked: draft.chatLinks, onchange: (e: Event) => { draft.chatLinks = (e.target as HTMLInputElement).checked; refresh(); } }),
          ' ลิงก์ไอเทมในแชท'),
      ),
      h('div', { class: 'muted' }, 'ลิงก์ไอเทมในแชท: Ctrl+คลิกไอเทมในกระเป๋า/ชุดที่ใส่/คลัง/ร้านพ่อค้า = ใส่ [ชื่อไอเทม] ในช่องแชท (หรือโทรโข่งถ้าเปิดอยู่) ข้อความละไม่เกิน 3 ชิ้น · คนที่เห็นคลิกชื่อ (สีตามความหายาก) เปิดหน้าต่างข้อมูลของชิ้นนั้นตอนส่ง (+ตีบวก ค่าที่สุ่มได้) · server หาของจริงในตัวผู้ส่งเอง ปลอมไม่ได้ · ปิด = server ไม่ส่งลิงก์ (ชื่อเป็นข้อความธรรมดา) และ Ctrl+คลิกไม่ทำอะไร'),
      h('div', { class: 'muted' }, 'หลุดการเชื่อมต่อขณะเปิด Auto (ไม่ได้กดออกเกม): ตัวละครอยู่ในโลกต่อ Auto ฟาร์มเหมือนปกติ (EXP 50%) จนครบเวลา, Auto หยุดตามตัวเลือก (ยาหมด/กระเป๋าเต็ม/ม้วน) หรือตาย แล้วเซฟและออกจากโลก · เข้าเกมใหม่ = ได้ตัวที่กำลังฟาร์มคืน Auto ยังเปิด · ไม่รวม Guest และห้องบอส · ปิดสวิตช์ = คนที่ฟาร์มแบบหลุดอยู่ออกจากโลกทันที'),
    );
  };

  // ---------------------------------------------------------- skill effects' extra layer (src/shared/fxLayerTuning.ts)
  const fxCard = h('div', { class: 'card' });
  const drawFx = (): void => {
    const a = draft.fxLayer;
    const ca = code.fxLayer;
    const refresh = (): void => { updateSummary(); };
    const num = (k: FxLayerNum, step: number) =>
      h('label', {}, FX_LAYER_NAME[k], numBox(() => a[k], (n) => { a[k] = n; }, ca[k], FX_LAYER_RANGE[k][0], FX_LAYER_RANGE[k][1], step, refresh));
    const on = h('input', { type: 'checkbox', checked: a.enabled, onchange: (e: Event) => { a.enabled = (e.target as HTMLInputElement).checked; refresh(); } });
    const deb = h('input', { type: 'checkbox', checked: a.debuffs, onchange: (e: Event) => { a.debuffs = (e.target as HTMLInputElement).checked; refresh(); } });
    const mergeOn = h('input', { type: 'checkbox', checked: a.mergeNums, onchange: (e: Event) => { a.mergeNums = (e.target as HTMLInputElement).checked; refresh(); } });
    const ownOnly = h('input', { type: 'checkbox', checked: a.ownNumsOnly, onchange: (e: Event) => { a.ownNumsOnly = (e.target as HTMLInputElement).checked; refresh(); } });
    const smoothOn = h('input', { type: 'checkbox', checked: a.smoothShots, onchange: (e: Event) => { a.smoothShots = (e.target as HTMLInputElement).checked; refresh(); } });
    const droneOn = h('input', { type: 'checkbox', checked: a.droneFollow, onchange: (e: Event) => { a.droneFollow = (e.target as HTMLInputElement).checked; refresh(); } });
    const circlesOn = h('input', { type: 'checkbox', checked: a.circles, onchange: (e: Event) => { a.circles = (e.target as HTMLInputElement).checked; refresh(); } });
    const zoneCirclesOn = h('input', { type: 'checkbox', checked: a.zoneCircles, onchange: (e: Event) => { a.zoneCircles = (e.target as HTMLInputElement).checked; refresh(); } });
    const quarksOn = h('input', { type: 'checkbox', checked: a.quarks, onchange: (e: Event) => { a.quarks = (e.target as HTMLInputElement).checked; refresh(); } });
    const flag = (box: HTMLInputElement, changed: boolean, text: string) => h('label', { class: changed ? 'bal-changed' : '' }, box, text);
    // three.quarks: one switch per skill (QUARKS_SKILLS), grouped by class
    const qkBox = (s: QuarksSkill) => {
      const k = quarksKey(s);
      const box = h('input', { type: 'checkbox', checked: a[k], onchange: (e: Event) => { a[k] = (e.target as HTMLInputElement).checked; refresh(); } });
      return flag(box, a[k] !== ca[k], ` ${QUARKS_SKILLS[s]}`);
    };
    const qkRow = (title: string, ids: QuarksSkill[]) => h('div', { class: 'bal-group' }, h('b', {}, title), h('div', { class: 'row bal-line' }, ...ids.map(qkBox)));
    // the players' graphics window (src/client/gfxPrefs.ts)
    const GFX_LEVELS = ['ปิด', 'ต่ำ', 'กลาง', 'สูง'];
    const gfxPick = (k: 'gfxDefault' | 'gfxMax', label: string) => h('label', { class: a[k] !== ca[k] ? 'bal-changed' : '' }, label + ' ',
      h('select', { onchange: (e: Event) => { a[k] = Number((e.target as HTMLSelectElement).value); refresh(); drawFx(); } },
        ...GFX_LEVELS.map((t, i) => h('option', { value: String(i), selected: a[k] === i }, t)).reverse()));
    const gfxOn = h('input', { type: 'checkbox', checked: a.gfxMenu, onchange: (e: Event) => { a.gfxMenu = (e.target as HTMLInputElement).checked; refresh(); } });
    const enhSmoothOn = h('input', { type: 'checkbox', checked: a.enhAuraSmooth, onchange: (e: Event) => { a.enhAuraSmooth = (e.target as HTMLInputElement).checked; refresh(); } });
    const enhFrontOn = h('input', { type: 'checkbox', checked: a.enhOrbGlowFront, onchange: (e: Event) => { a.enhOrbGlowFront = (e.target as HTMLInputElement).checked; refresh(); } });
    const nearOn = h('input', { type: 'checkbox', checked: a.orbsNearBar, onchange: (e: Event) => { a.orbsNearBar = (e.target as HTMLInputElement).checked; refresh(); } });
    fxCard.replaceChildren(
      h('h2', {}, 'เอฟเฟกต์สกิล (ชั้นเสริม)'),
      h('div', { class: 'muted' }, 'แสงเรือง แสงบนพื้น และอนุภาคที่เกมวาดทับภาพเอฟเฟกต์ของสกิล ส่วนจอสั่นกับภาพค้างเกิดเฉพาะจอของคนที่ร่าย และเฉพาะตอนที่ท่าโดนมอน · ค่าของแต่ละท่าอยู่ใน src/client/fxLayer.ts (FX_RECIPES) ค่าในการ์ดนี้คูณทุกท่า · มีผลกับทุกคนทันทีหลังบันทึก'),
      h('div', { class: 'row bal-line' }, h('label', {}, on, ' เปิดชั้นเสริม'), h('label', {}, deb, ' แสดงดีบัฟบนตัวมอน (ไอคอนเหนือหลอด HP + เอฟเฟกต์บนตัว)')),
      h('div', { class: 'row bal-line' }, num('glow', 0.1), num('ground', 0.1), num('particles', 0.1)),
      h('div', { class: 'row bal-line' }, num('shake', 0.1), num('hitstopMs', 5), num('crit', 0.1)),
      h('div', { class: 'row bal-line' }, flag(circlesOn, a.circles !== ca.circles, ' วงเวทบนพื้น (ใต้มอนติดดีบัฟ ใต้ผู้เล่นติดบัฟ และพื้นที่สกิลวงกว้าง)'), flag(zoneCirclesOn, a.zoneCircles !== ca.zoneCircles, ' สกิลวงกว้างเป็นวงเวทอย่างเดียว (ปิด = ภาพพื้นที่เดิม)'), num('circleGlow', 0.1)),
      h('div', { class: 'row bal-line' }, num('slashLift', 0.05), num('craterBack', 0.05)),
      h('div', { class: 'row bal-line' }, num('townEdge', 0.1), num('townRound', 0.5), h('span', { class: 'muted' }, ' มีผลตอนโหลดแมพเมืองครั้งถัดไป')),
      h('div', { class: 'muted' }, 'ภาพค้างจริง = ค่านี้ × ความหนักของท่า (0–1) และไม่เกิน 120 ms · ตอนนี้เปิดชั้นเสริมให้พายุดาบท่าเดียวก่อน'),
      h('h3', {}, 'อนุภาค three.quarks (ทดลอง)'),
      h('div', { class: 'row bal-line' }, flag(quarksOn, a.quarks !== ca.quarks, ' ใช้ three.quarks วาดอนุภาคของสกิล')),
      h('div', { class: 'row bal-line' }, num('quarksOthers', 0.05), num('quarksTouch', 0.05), num('quarksCap', 100)),
      h('div', { class: 'muted' }, 'สวิตช์ใหญ่นี้เปิด = ผู้เล่นโหลดไลบรารี three.quarks (~67 KB) แล้วท่าที่ติ๊กด้านล่างใช้อนุภาคใหม่ วาดทับภาพเดิมของท่า (อุกกาบาต ดาวตก ฝนเพลิง: ของที่ตกลงมาใช้อนุภาคแทนของเดิม) · ปิด = แบบเดิมทุกอย่าง ไม่โหลดไลบรารี · มีผลกับทุกคนทันทีหลังบันทึก'),
      ...CLASS_IDS.map((c, i) => qkRow(`${CLASSES[c].nameTh}:`, CLASSES[c].skills.map((s) => s.id).filter((id): id is QuarksSkill => id in QUARKS_SKILLS && (id !== 'dash' || i === 0)))),
      h('div', { class: 'muted' }, 'จำนวนอนุภาคจริง = ในโค้ด × "× อนุภาค" ด้านบน × "ของคนอื่น" (ถ้าไม่ใช่ท่าของเรา) × "จอสัมผัส" (ถ้าเล่นบนมือถือ/แท็บเล็ต) · ท่าของเราไม่ถูกลดด้วย "ของคนอื่น" และไม่ถูกตัด · บนจอเกิน "สูงสุด" = ท่าใหม่ของคนอื่นไม่วาดจนกว่าจะลดลง (0 = ไม่วาดของคนอื่นเลย)'),
      h('h3', {}, 'เมนูกราฟิกของผู้เล่น'),
      h('div', { class: 'row bal-line' }, flag(gfxOn, a.gfxMenu !== ca.gfxMenu, ' แสดงปุ่ม "กราฟิก" ในเมนูเกม'), gfxPick('gfxDefault', 'คุณภาพเริ่มต้น'), gfxPick('gfxMax', 'สูงสุดที่เลือกได้')),
      h('div', { class: 'row bal-line' }, num('gfxMid', 0.05), num('gfxLow', 0.05)),
      h('div', { class: 'muted' }, 'ผู้เล่นเลือกเองในเมนู → กราฟิก (เก็บในเครื่องผู้เล่น): คุณภาพอนุภาค สูง/กลาง/ต่ำ/ปิด, อนุภาคของคนอื่น เต็ม/ครึ่ง/ปิด, จอสั่น, ภาพค้างตอนโดน, เลขดาเมจเฉพาะของเรา · สูง = ตามค่าในการ์ดนี้ กลาง/ต่ำ = × ค่าด้านบน ปิด = ไม่ใช้ three.quarks และไม่มีอนุภาคชั้นเสริม (ภาพสกิลหลักยังอยู่) · คนที่ยังไม่เคยเลือกใช้ "คุณภาพเริ่มต้น" (เปลี่ยนแล้วมีผลกับเขาด้วย) · เลือกได้ไม่เกิน "สูงสุดที่เลือกได้" · ปิดปุ่ม = ทุกคนใช้ค่าเริ่มต้นและไม่สนค่าที่เคยเลือก · "เห็นเฉพาะเลขดาเมจของตัวเอง" ด้านล่างเปิดอยู่ = ผู้เล่นปิดเองไม่ได้'),
      h('h3', {}, 'ตัวเลขดาเมจ (ลดอาการกระตุกตอนมอนเยอะ)'),
      h('div', { class: 'row bal-line' },
        num('maxNums', 5),
        flag(mergeOn, a.mergeNums !== ca.mergeNums, ' รวมเลขที่โดนพร้อมกัน'),
        num('mergeSec', 0.05),
        flag(ownOnly, a.ownNumsOnly !== ca.ownNumsOnly, ' เห็นเฉพาะเลขดาเมจของตัวเอง'),
      ),
      h('div', { class: 'muted' }, 'ตัวเลขบนจอสูงสุด: เกินแล้วอันเก่าสุดหาย (ค่าในโค้ด 40 เดิม 120) · รวมเลข: ดาเมจบนเป้าเดียวกันในช่วงเวลานี้รวมเป็นเลขเดียว (คริรวมกับคริ ธรรมดารวมกับธรรมดา เลขที่ตัวเองโดนก็รวม) · เห็นเฉพาะของตัวเอง: เห็นแค่ดาเมจที่ตัวเองตีและที่ตัวเองโดน (server ไม่ส่งของคนอื่นมาเลย) ข้อความอื่นยังเห็นเหมือนเดิม'),
      h('h3', {}, 'ภาพกระดาษ: กรอบชื่อ ฟองแชท รอยเท้าออร่า ลูกแก้วตีบวก'),
      h('div', { class: 'row bal-line' }, num('paperPlate', 0.05), num('paperBubble', 0.05), num('paperFoot', 0.1)),
      h('h3', {}, 'ช่องไอเทม (ทุกหน้าต่าง)'),
      h('div', { class: 'row bal-line' }, num('slotCorner', 0.1), num('slotInset', 0.1), num('slotIcon', 0.05)),
      h('div', { class: 'muted' }, 'ปรับกรอบช่องไอเทมทุกช่องพร้อมกัน (กระเป๋า ช่องสวม คลัง ร้าน ตลาด เทรด ตีบวก แฟชั่น) · 1 = ค่าในโค้ด'),
      h('div', { class: 'row bal-line' }, num('paperOrbLight', 0.01), num('paperOrbShade', 0.05)),
      h('div', { class: 'row bal-line' }, num('plateMaxW', 10), num('platePadY', 1), num('platePadX', 1)),
      h('div', { class: 'row bal-line' }, num('plateLift', 1)),
      h('div', { class: 'muted' }, 'ยกป้ายชื่อผู้เล่น (ชื่อ เลเวล HP ของคนอื่น และกรอบชื่อของตัวเอง) พร้อมฟองแชทให้สูงขึ้นเป็นพิกเซลบนจอ 0 = ตำแหน่งเดิม ติดลบ = ต่ำลง · ไม่รวมป้ายมอน'),
      h('div', { class: 'row bal-line' }, num('bubbleMaxW', 10), num('bubblePadY', 1), num('bubblePadX', 1)),
      h('div', { class: 'muted' }, 'มีผลเฉพาะตอนเปิดสวิตช์ภาพกระดาษ (แท็บ Server) · ขนาดออร่า/ความทึบ/ระยะรอยเท้ารายชิ้นอยู่ในแท็บของแต่งตัว · กรอบชื่อ/ฟองแชทยืดตามความยาวข้อความเอง (9 ช่อง ซ้ำขอบเรียบ มุมและลายกลางไม่ถูกบีบ) ความกว้างสุดใช้กับชื่อ/ฟองธรรมดาด้วย ขอบในใช้กับกรอบกระดาษ · กรอบชื่อเปลี่ยนเมื่อมีคนสวม/ถอดหรือรีโหลด ลูกแก้วเปลี่ยนทันที'),
      h('h3', {}, 'ออร่าตีบวกใต้เท้า (+7/+10/+13/+15)'),
      h('div', { class: 'row bal-line' }, flag(enhSmoothOn, a.enhAuraSmooth !== ca.enhAuraSmooth, ' ขอบนุ่ม (ไม่กะพริบ)'), num('enhAuraPulse', 0.01), num('enhAuraBreath', 0.01), num('enhAuraSpeed', 0.5)),
      h('div', { class: 'muted' }, 'ขอบนุ่ม เปิด (ค่าในโค้ด): ภาพแสงกรองแบบนุ่ม ขอบไม่กระโดดตอนหดขยาย · ปิด = ขอบพิกเซลแบบเดิม ซึ่งกะพริบตอนหดขยาย ยิ่ง +13/+15 (ใหญ่และสว่าง) ยิ่งเห็นชัด · หดขยาย 0.08 = ขนาด ±8% (ค่าเดิม) ยิ่งน้อยยิ่งนิ่ง · สว่างหรี่ 0 = ความสว่างคงที่ (ค่าเดิม) ใส่ 0.1–0.2 ให้หายใจด้วยความสว่างแทนขนาดได้ · ความเร็ว 3 = รอบละราว 2 วินาที · ประกายที่ลอยขึ้นจากออร่ายังเหมือนเดิม · มีผลกับทุกคนทันทีหลังบันทึก'),
      h('div', { class: 'row bal-line' }, num('enhAuraGlow', 0.05)),
      h('div', { class: 'row bal-line' }, num('enhSparkGlow', 0.05), num('enhSparkRate', 0.1), num('enhSparkFadeIn', 0.05)),
      h('div', { class: 'row bal-line' }, flag(enhFrontOn, a.enhOrbGlowFront !== ca.enhOrbGlowFront, ' แสงลูกแก้วตีบวกอยู่หน้าลูก (ปิด = หลังลูก)'), num('enhOrbBackFade', 0.1)),
      h('div', { class: 'muted' }, 'ประกาย = จุดแสงที่ลอยขึ้นจากออร่า +10 ขึ้นไป (ในโค้ด +10/+13/+15 = 3/6/12 ต่อวิ) เวลาค่อย ๆ สว่าง 0 = สว่างทันทีแบบเดิม · แสงลูกแก้วหน้าลูก (ค่าในโค้ด) = แสงทับตัวลูก ดูสว่าง · หลังลูก = ตัวลูกคมกว่า แสงหรี่ลงเล็กน้อย · ทั้งสองแบบไม่กะพริบ · แสงลูกแก้วที่อยู่หลังตัวจางลง: ตอนวิ่ง ขา/แขนที่ขยับตัดแสงของลูกด้านหลังต่างกันทุกเฟรม ค่านี้ทำให้แสงของลูกด้านหลังจางลง (ค่าในโค้ด 1 = หายหมด, 0 = แบบเดิม)'),
      h('h3', {}, 'ตำแหน่งลูกแก้ว HP/MP'),
      h('div', { class: 'row bal-line' }, flag(nearOn, a.orbsNearBar !== ca.orbsNearBar, ' ลูกแก้วชิดแถบสกิล (ปิด = มุมล่างซ้าย/ขวาของจอ)')),
      h('div', { class: 'muted' }, 'เปิด (ค่าในโค้ด): บนจอคอมกว้าง ≥ 1000px ลูกแก้ว HP ชิดซ้ายของแถบสกิล MP ชิดขวา ดูเป็นแผงเดียวกัน (จอกว้าง ≥ 1850px แชทกับข้อความระบบลงมาที่มุมซ้ายล่าง) · จอแคบกว่านั้นและมือถือใช้มุมจอเหมือนเดิม (มือถือใช้แถบ HP/MP อยู่แล้ว) · ผู้เล่นที่เลือก "HP/MP: แถบ" ในเกมไม่ได้รับผล · มีผลกับทุกคนทันทีหลังบันทึก'),
      h('h3', {}, 'กระสุน'),
      h('div', { class: 'row bal-line' }, flag(smoothOn, a.smoothShots !== ca.smoothShots, ' กระสุนบินลื่น (ไม่ดึงกลับตาม server)')),
      h('div', { class: 'muted' }, 'เปิด (ค่าในโค้ด): เบราว์เซอร์ให้กระสุนบินต่อเอง ตำแหน่งจาก server ดันไปข้างหน้าครึ่งหนึ่งของปิง ห่างนิดหน่อยค่อย ๆ ขยับเข้า ห่างเกิน 3 หน่วยค่อยกระโดด · ปิด: แบบเดิม กระสุนกระโดดไปตำแหน่งของ server ทุกครั้งที่ข้อมูลมา (เห็นกระตุกตอนยิงเยอะ เช่น Bullet Storm) · เป็นแค่ภาพ ดาเมจยังตัดสินที่ server'),
      h('h3', {}, 'โดรนสนับสนุน (มือปืน)'),
      h('div', { class: 'row bal-line' }, flag(droneOn, a.droneFollow !== ca.droneFollow, ' โดรนบินตามลื่น'), num('droneSpeed', 0.5), num('droneDist', 0.1)),
      h('div', { class: 'muted' }, 'เปิด (ค่าในโค้ด): โดรนเป็นตัวเดียวตลอดอายุสกิล บินตามหลังไหล่ตัวละครเหมือนสัตว์เลี้ยง ลอยขึ้นลงเบา ๆ หันไปทางมอนตอนยิง หมดเวลา/ตาย/เปลี่ยนแมพแล้วหายไป · ปิด: แบบเดิม วาดภาพโดรนใหม่ที่ไหล่ทุกนัด · ความเร็วตามยิ่งมากยิ่งติดตัว ระยะห่าง 1 = ตำแหน่งที่ server ใช้ปล่อยกระสุน · เป็นแค่ภาพ ดาเมจ/ระยะ/จังหวะยิงตัดสินที่ server'),
    );
  };

  // ---------------------------------------------------------- one magic circle and code effects per skill (owner 2026-11-18)
  const circleCard = h('div', { class: 'card' });
  const drawCircles = (): void => {
    const a = draft.fxLayer;
    const ca = code.fxLayer;
    const refresh = (): void => { updateSummary(); };
    const extrasOn = h('input', { type: 'checkbox', checked: a.extras, onchange: (e: Event) => { a.extras = (e.target as HTMLInputElement).checked; refresh(); } });
    /** One skill's entry, made only once something differs (an empty entry is dropped on save). */
    const ent = (id: string): SkillFxTune => (a.skills[id] ??= {});
    const row = (id: string, name: string): HTMLElement => {
      const d = circleDesign(id);
      const pic = h('span', { class: 'circ-pic' });
      if (d) {
        for (const [part, speed] of [['outer', d.spin], ['inner', d.spin * d.inner]] as const) {
          const c = document.createElement('canvas');
          c.width = c.height = 96;
          const g = c.getContext('2d')!;
          (part === 'outer' ? drawOuter : drawInner)(g, 96, d);
          // Tint the white picture in the skill's colour.
          g.globalCompositeOperation = 'source-in';
          g.fillStyle = part === 'outer' ? d.color : d.color2;
          g.fillRect(0, 0, 96, 96);
          c.style.animation = `circ-spin ${(Math.PI * 2 / Math.max(0.05, Math.abs(speed))).toFixed(1)}s linear infinite ${speed < 0 ? 'reverse' : 'normal'}`;
          pic.append(c);
        }
      }
      const t = a.skills[id] ?? {};
      const box = (k: 'circle' | 'extra', text: string) => {
        const inp = h('input', { type: 'checkbox', checked: t[k] !== false, onchange: (e: Event) => { ent(id)[k] = (e.target as HTMLInputElement).checked; refresh(); } });
        return h('label', { class: t[k] === false ? 'bal-changed' : '' }, inp, text);
      };
      const num = (k: keyof typeof SKILL_FX_RANGE, label: string) =>
        h('label', {}, label, numBox(() => a.skills[id]?.[k] ?? 1, (n) => { ent(id)[k] = n; }, 1, SKILL_FX_RANGE[k][0], SKILL_FX_RANGE[k][1], 0.1, refresh));
      const fx = skillExtras(id);
      return h('div', { class: 'row bal-line circ-row' }, pic, h('b', { style: 'min-width:120px' }, name),
        box('circle', ' วงเวท'), num('size', '×ขนาด'), num('speed', '×หมุน'), num('bright', '×สว่าง'),
        fx.length ? box('extra', ` เอฟเฟกต์ (${fx.join(', ')})`) : h('span', { class: 'muted' }, 'ไม่มีเอฟเฟกต์โค้ด'),
        fx.length ? num('extraK', '×แรง') : h('span'));
    };
    const FALLBACK_NAME: Record<string, string> = {
      buff_attack: 'บัฟโจมตี (ไม่รู้สกิล)', buff_guard: 'บัฟป้องกัน (ไม่รู้สกิล)', buff_speed: 'บัฟความเร็ว (ไม่รู้สกิล)',
      debuff_stun: 'ดีบัฟสตัน', debuff_dot: 'ดีบัฟติดไฟ/พิษ', debuff_slow: 'ดีบัฟช้าลง', debuff_weak: 'ดีบัฟโจมตีลด',
      debuff_armor: 'ดีบัฟเกราะแตก', debuff_mark: 'ดีบัฟมาร์ค', zone: 'พื้นที่ (ไม่รู้สกิล)',
    };
    circleCard.replaceChildren(
      h('style', {}, '@keyframes circ-spin { to { transform: rotate(360deg); } } .circ-pic { position: relative; display: inline-block; width: 48px; height: 48px; flex: none; background: #0c0a14; border-radius: 50%; } .circ-pic canvas { position: absolute; inset: 0; width: 48px; height: 48px; } .circ-row { align-items: center; }'),
      h('h2', {}, 'วงเวทและเอฟเฟกต์โค้ดรายสกิล'),
      h('div', { class: 'muted' }, 'ทุกสกิลมีวงเวทไม่ซ้ำกัน (โชว์ใต้มอนที่โดนดีบัฟของสกิลนั้น ใต้ผู้เล่นที่ได้บัฟของสกิลนั้น และบนพื้นที่สกิลวงกว้าง) ภาพหมุนตัวอย่างอยู่หน้าชื่อ · เอฟเฟกต์โค้ดเล่นทับภาพเดิมตอนร่าย 1 ครั้งต่อจุด · ค่าในโค้ด: เปิด ×1 · มีผลกับทุกคนทันทีหลังบันทึก'),
      h('div', { class: 'row bal-line' }, h('label', { class: a.extras !== ca.extras ? 'bal-changed' : '' }, extrasOn, ' เอฟเฟกต์โค้ดของสกิล (ทับภาพเดิม)'),
        h('label', {}, FX_LAYER_NAME.extrasK, numBox(() => a.extrasK, (n) => { a.extrasK = n; }, ca.extrasK, FX_LAYER_RANGE.extrasK[0], FX_LAYER_RANGE.extrasK[1], 0.1, refresh))),
      // Bosses' skills (owner 2026-11-21, src/client/bossFx.ts)
      h('h3', {}, 'สกิลบอส (หมี แม่มด เยติ หัวใจภูเขาไฟ)'),
      h('div', { class: 'row bal-line' },
        h('label', { class: a.bossFx !== ca.bossFx ? 'bal-changed' : '' },
          h('input', { type: 'checkbox', checked: a.bossFx, onchange: (e: Event) => { a.bossFx = (e.target as HTMLInputElement).checked; refresh(); } }), ' ภาพเอฟเฟกต์สกิลบอส (ปิด = ภาพแบบเดิม ท่าตีตอนร่ายยังเล่น)'),
        h('label', { class: a.bossExtras !== ca.bossExtras ? 'bal-changed' : '' },
          h('input', { type: 'checkbox', checked: a.bossExtras, onchange: (e: Event) => { a.bossExtras = (e.target as HTMLInputElement).checked; refresh(); } }), ' เอฟเฟกต์โค้ดทับภาพ'),
        h('label', {}, FX_LAYER_NAME.bossExtrasK, numBox(() => a.bossExtrasK, (n) => { a.bossExtrasK = n; }, ca.bossExtrasK, FX_LAYER_RANGE.bossExtrasK[0], FX_LAYER_RANGE.bossExtrasK[1], 0.1, refresh))),
      ...CLASS_IDS.flatMap((cid) => [h('h3', {}, CLASSES[cid].nameTh ?? cid), ...CLASSES[cid].skills.map((s) => row(s.id, s.nameTh))]),
      h('h3', {}, 'วงเวทตอนไม่รู้ว่ามาจากสกิลไหน'),
      ...CIRCLE_FALLBACKS.map((k) => row(k, FALLBACK_NAME[k] ?? k)),
    );
  };

  // ---------------------------------------------------------- stopping on attacks (src/shared/attackRootTuning.ts)
  const rootCard = h('div', { class: 'card' });
  const drawRoot = (): void => {
    const r = draft.attackRoot;
    const cr = code.attackRoot;
    const refresh = (): void => { updateSummary(); };
    const skillName = (id: string): string => {
      for (const c of Object.values(CLASSES)) {
        const sk = c.skills.find((s) => s.id === id);
        if (sk) return sk.nameTh;
      }
      return id;
    };
    rootCard.replaceChildren(
      h('h2', {}, 'หยุดตอนโจมตี'),
      h('div', { class: 'muted' }, 'ตีธรรมดาหรือใช้สกิลแล้วตัวละครยืนนิ่งสั้น ๆ (ยังหันตามเมาส์/เป้าได้) แล้ววิ่งต่อเองถ้ายังกดเดินอยู่ — แก้ภาพ "สไลด์" ตอนวิ่งแล้วตี · server ตัดสิน เบราว์เซอร์หยุดตามทันที · แดชระหว่างหยุดได้และยกเลิกการหยุด · ไม่เปลี่ยนคูลดาวน์ ดาเมจ ความเร็วโจมตี · มีผลกับทุกคนทันทีหลังบันทึก'),
      h('div', { class: 'row bal-line' }, ...CLASS_IDS.map((id) => {
        const c = r.classes[id];
        const cc = cr.classes[id];
        const on = h('input', { type: 'checkbox', checked: c.on, onchange: (e: Event) => { c.on = (e.target as HTMLInputElement).checked; refresh(); drawRoot(); } });
        return h('div', {},
          h('label', { class: c.on !== cc.on ? 'bal-changed' : '' }, on, ` ${CLASSES[id].nameTh} หยุดตอนโจมตี`),
          h('label', {}, ' หยุดตอนตีธรรมดา (วิ) ', numBox(() => c.basicSec, (n) => { c.basicSec = n; }, cc.basicSec, ATTACK_ROOT_RANGE.basicSec[0], ATTACK_ROOT_RANGE.basicSec[1], 0.05, refresh)));
      })),
      h('div', { class: 'row bal-line' },
        h('label', {}, '× เวลาหยุดตอนใช้สกิล (เทียบกับตีธรรมดา) ', numBox(() => r.skillMult, (n) => { r.skillMult = n; }, cr.skillMult, ATTACK_ROOT_RANGE.skillMult[0], ATTACK_ROOT_RANGE.skillMult[1], 0.1, refresh))),
      h('div', { class: 'muted' }, 'ตีธรรมดาหยุดไม่นานกว่าท่าโจมตี (ท่ายาว 0.95 ÷ ความเร็วตี ไม่เกิน 0.5 วิ: ดาบ/เวท ~0.5 ปืน ~0.37 ตีเร็วขึ้นท่าก็สั้นลง) · สกิลหยุด = เวลาตีธรรมดาของอาชีพ × ตัวคูณ · 0 = ไม่หยุด'),
      h('div', { class: 'muted' }, `สกิลที่ไม่หยุด (ท่าพุ่ง/กระโดดถอย/หายตัว และบัฟ): ${[...NO_ATTACK_ROOT].map(skillName).join(', ')} · สกิลที่ยืนเล็ง/ชาร์จเองอยู่แล้ว (ยิงหัว ยิงประณีต รางแม่เหล็ก เวทชาร์จ ปลดปล่อยพลัง) ใช้เวลาของสกิลนั้นแทน`),
    );
  };

  // ---------------------------------------------------------- sound effect groups (src/shared/audioTuning.ts)
  const audioCard = h('div', { class: 'card' });
  const drawAudio = (): void => {
    const refresh = (): void => { updateSummary(); };
    audioCard.replaceChildren(
      h('h2', {}, 'เสียงเอฟเฟกต์'),
      h('div', { class: 'muted' }, 'เปิด/ปิดและความดังของเสียงแต่ละหมวดทั้งเซิร์ฟ · คูณกับแถบเลื่อนของผู้เล่นในหน้าต่างเสียง · เสียงทุกอันสังเคราะห์ด้วยโค้ด (src/client/audio/sfx.ts) · ค่าในโค้ด: เปิด ×1 · มีผลกับทุกคนทันทีหลังบันทึก'),
      ...SFX_GROUPS.map((g) => {
        const c = draft.audio.groups[g];
        const cc = code.audio.groups[g];
        const on = h('input', { type: 'checkbox', checked: c.on, onchange: (e: Event) => { c.on = (e.target as HTMLInputElement).checked; refresh(); drawAudio(); } });
        return h('div', { class: 'row bal-line' },
          h('label', { class: c.on !== cc.on ? 'bal-changed' : '' }, on, ` เสียง${SFX_GROUP_NAME[g]}`),
          h('label', {}, ' × ความดัง ', numBox(() => c.gain, (n) => { c.gain = n; }, cc.gain, AUDIO_GAIN_RANGE[0], AUDIO_GAIN_RANGE[1], 0.1, refresh)));
      }),
      h('div', { class: 'muted' }, 'สกิลผู้เล่น = ตีธรรมดา พุ่งหลบ ทุกสกิล และเสียงตอนสกิลลง · บอส = ตีธรรมดา ท่าสกิล เข้าเฟส/คลั่ง บอสปรากฏ นับถอยหลังบอสเกิด บอสตาย · มอน = มอนโดนตี คริติคอล มอนตาย มอนเง้าตีเรา มอนเห็นเรา · ตัวละครและไอเทม = เจ็บ ตาย ฟื้น เลเวลอัป วาร์ป ฝีเท้า เก็บของ ของดรอปตามความหายาก ดื่มยา ซื้อขาย ตีบวก แคชช็อป เปิดกล่องสุ่ม · หน้าต่างและการแจ้งเตือน = คลิกปุ่ม เปิด/ปิดหน้าต่าง แชท จดหมาย คำเชิญ เควสสำเร็จ · บรรยากาศแมพ = นก กบ ลม ลาวา เสียงเมือง (สุ่มเป็นระยะ)'),
    );
  };

  // ---------------------------------------------------------- papercraft sword rig pictures (src/shared/rigLookTuning.ts)
  const rigCard = h('div', { class: 'card' });
  const drawRig = (): void => {
    const r = draft.rigLook;
    const cr = code.rigLook;
    const itemName = (id: string): string => {
      const b = ITEM_BASES.find((x) => x.id === id);
      return `${b?.names.sword ?? b?.names.any ?? id} (Lv${b?.minLevel ?? '?'})`;
    };
    const row = <V extends string>(map: Record<string, V>, codeMap: Record<string, V>, id: string, values: readonly V[], names: Record<V, string>) =>
      h('label', { class: map[id] !== codeMap[id] ? 'bal-changed' : '' }, `${itemName(id)} `,
        h('select', { onchange: (e: Event) => { map[id] = (e.target as HTMLSelectElement).value as V; updateSummary(); drawRig(); } },
          ...values.map((v) => h('option', { value: v, selected: map[id] === v }, names[v]))));
    rigCard.replaceChildren(
      h('h2', {}, 'นักดาบกระดาษ: ภาพอาวุธและเกราะ'),
      h('div', { class: 'muted' }, 'ทดลองสไตล์กระดาษตัดแปะ: เลือกว่าไอเทมแต่ละชิ้นของนักดาบใช้ดาบและเกราะกระดาษแบบไหน (มีดาบ 3 แบบ เกราะ 2 แบบ) · ทุกคนเห็นตามที่อีกคนใส่จริง แต่จะเห็นนักดาบกระดาษเฉพาะเบราว์เซอร์ที่เปิดสวิตช์ในแท็บ หน้าตา → นักดาบกระดาษ'),
      h('div', { class: 'row bal-line' }, ...RIG_WEAPON_ITEMS.map((id) => row(r.weapons, cr.weapons, id, RIG_WEAPONS, RIG_WEAPON_NAME))),
      h('div', { class: 'row bal-line' }, ...RIG_ARMOR_ITEMS.map((id) => row(r.armors, cr.armors, id, RIG_ARMORS, RIG_ARMOR_NAME))),
    );
  };

  // ---------------------------------------------------------- tutorial quest rewards (src/shared/tutorial.ts)
  const tutCard = h('div', { class: 'card' });
  /** Every potion and stone a reward may give, as select options (value = JSON of the line without count). */
  type TutLine = { kind: 'potion'; potion: 'hp' | 'mp'; size: 's' | 'm' | 'l' } | { kind: 'stone'; stone: string };
  const tutKinds: { label: string; line: TutLine }[] = [
    ...(['hp', 'mp'] as const).flatMap((potion) => POTION_SIZES.map((size) => ({ label: potionName(potion, size), line: { kind: 'potion' as const, potion, size } }))),
    ...TUT_STONES.map((stone) => ({ label: STONE_NAME[stone], line: { kind: 'stone' as const, stone } })),
  ];
  const lineKey = (x: TutLine | MailAttachItem): string =>
    x.kind === 'potion' ? `p:${x.potion}:${x.size}` : x.kind === 'stone' ? `s:${x.stone}` : 'e';
  /** The floor-2 quest's reward (ทางขึ้นชั้น 2 card), edited like a tutorial reward. */
  function floorRewardBox(): HTMLElement {
    const r = draft.floorGate.reward;
    const cr = code.floorGate.reward;
    const refresh = (): void => {
      updateSummary();
      drawFloor();
    };
    const lines = r.items.map((it, i) => {
      const sel = h('select', {
        onchange: (e: Event) => {
          const pick = tutKinds[(e.target as HTMLSelectElement).selectedIndex];
          r.items[i] = { ...pick.line, count: it.count } as MailAttachItem;
          refresh();
        },
      }, ...tutKinds.map((o) => h('option', { selected: lineKey(o.line) === lineKey(it) }, o.label)));
      const count = numBox(() => it.count, (n) => { it.count = n; }, it.count, 1, TUT_COUNT_MAX, 1, () => updateSummary());
      const del = h('button', { onclick: () => { r.items.splice(i, 1); refresh(); } }, '✕');
      return h('div', { class: 'row bal-line' }, sel, ' × ', count, del);
    });
    const add = h('button', {
      disabled: r.items.length >= TUT_LINES_MAX,
      onclick: () => { r.items.push({ ...tutKinds[0].line, count: 1 } as MailAttachItem); refresh(); },
    }, '+ เพิ่มของ');
    const changed = JSON.stringify(r) !== JSON.stringify(cr);
    return h('div', { class: changed ? 'bal-changed' : '', style: 'margin:6px 0;padding:6px;border:1px solid #444;border-radius:4px' },
      h('b', {}, 'รางวัลเควสเปิดทาง'),
      h('div', { class: 'muted' }, `ค่าในโค้ด: ${tutRewardText(cr)} · ส่งทางจดหมาย ของทุกชิ้นผูกตัวละคร`),
      h('div', { class: 'row bal-line' }, h('label', {}, 'ทอง (G) ', numBox(() => r.gold, (n) => { r.gold = n; }, cr.gold, 0, TUT_GOLD_MAX, 100, () => updateSummary()))),
      ...lines,
      add,
    );
  }
  const drawTut = (): void => {
    const refresh = (): void => {
      updateSummary();
      drawTut();
    };
    const reward = (k: TutRewardKey) => {
      const r = draft.tutorial[k];
      const changed = JSON.stringify(r) !== JSON.stringify(code.tutorial[k]);
      const lines = r.items.map((it, i) => {
        const sel = h('select', {
          onchange: (e: Event) => {
            const pick = tutKinds[(e.target as HTMLSelectElement).selectedIndex];
            r.items[i] = { ...pick.line, count: it.count } as MailAttachItem;
            refresh();
          },
        }, ...tutKinds.map((o) => h('option', { selected: lineKey(o.line) === lineKey(it) }, o.label)));
        const count = numBox(() => it.count, (n) => { it.count = n; }, it.count, 1, TUT_COUNT_MAX, 1, () => updateSummary());
        const del = h('button', { onclick: () => { r.items.splice(i, 1); refresh(); } }, '✕');
        return h('div', { class: 'row bal-line' }, sel, ' × ', count, del);
      });
      const add = h('button', {
        disabled: r.items.length >= TUT_LINES_MAX,
        onclick: () => { r.items.push({ ...tutKinds[0].line, count: 1 } as MailAttachItem); refresh(); },
      }, '+ เพิ่มของ');
      return h('div', { class: changed ? 'bal-changed' : '', style: 'margin:6px 0;padding:6px;border:1px solid #444;border-radius:4px' },
        h('b', {}, TUT_REWARD_NAME[k]),
        h('div', { class: 'muted' }, `ค่าในโค้ด: ${tutRewardText(code.tutorial[k])}`),
        h('div', { class: 'row bal-line' }, h('label', {}, 'ทอง (G) ', numBox(() => r.gold, (n) => { r.gold = n; }, code.tutorial[k].gold, 0, TUT_GOLD_MAX, 100, () => updateSummary()))),
        ...lines,
        add,
      );
    };
    tutCard.replaceChildren(
      h('h2', {}, 'เควสสอนระบบ: รางวัล'),
      h('div', { class: 'muted' }, `รางวัลส่งทางจดหมายถึงตัวละครที่ส่งภารกิจ ของทุกชิ้นผูกตัวละคร · ขั้นตลาดส่งพร้อมรางวัลจบสาย · มีผลกับการส่งภารกิจหลังบันทึก · ทองตอนรับภารกิจ ${TUT_ACCEPT_GOLD.toLocaleString()} G และหินตอนรับขั้นสุ่มค่าอยู่ในโค้ด`),
      ...TUT_REWARD_KEYS.map(reward),
    );
  };

  // The skill system's card is its own tab now (src/admin/skills.ts, owner 2026-11-19): this tab saves with
  // `part: 'rest'`, so the server keeps the skills as they are saved there.

  const draftTuning = (): ReturnType<typeof checkBalance> => checkBalance(draft, true);
  function updateSummary(): void {
    const c = draftTuning();
    drawPreview();
    if (!c.tuning) {
      box.dataset.clean = '';
      summary.textContent = `⚠ ${c.error}`;
      summary.className = 'msg bad';
      return;
    }
    const changes = balanceChanges(saved, c.tuning);
    summary.className = 'muted';
    summary.textContent = changes ? `ยังไม่บันทึก: ${changes}` : 'ตรงกับที่บันทึกไว้';
    box.dataset.clean = changes ? '' : '1';
    if (!changes) fold.clearDirty();
  }
  const redraw = (): void => {
    drawClass();
    drawRegen();
    drawAffix();
    drawTiers();
    drawMonsters();
    drawExp();
    drawPotions();
    drawBag();
    drawForge();
    drawSets();
    drawFloor();
    drawMoves();
    drawLang();
    drawAuto();
    drawTut();
    drawFx();
    drawCircles();
    drawRoot();
    drawAudio();
    drawRig();
    applyFilter(); // redrawn cards keep the chosen category / search
  };
  const save = async (body: { tuning: BalanceTuning; part: 'rest' } | { reset: true; part: 'rest' }, ask: string): Promise<void> => {
    if (!confirm(ask)) return;
    msg.className = 'msg';
    msg.textContent = 'กำลังบันทึก…';
    try {
      saved = (await api<BalanceState>('POST', '/admin/balance', body)).tuning;
      draft = mergeBalance(saved);
      onSaved(saved);
      redraw();
      fold.clearDirty();
      msg.className = 'msg good';
      msg.textContent = 'บันทึกแล้ว ผู้เล่นที่ออนไลน์ได้ค่าใหม่ทันที';
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
    }
  };
  const bar = h('div', { class: 'card save-bar' },
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
        void save({ tuning: c.tuning, part: 'rest' }, `ใช้ค่าใหม่กับทั้งเซิร์ฟทันทีไหม?\n\n${changes.slice(0, 1200)}`);
      } }, '💾 บันทึกทั้งเซิร์ฟ'),
      h('button', { onclick: () => { draft = mergeBalance(saved); redraw(); fold.clearDirty(); msg.textContent = ''; } }, 'ยกเลิกที่ยังไม่บันทึก'),
      h('button', { onclick: () => void save({ reset: true, part: 'rest' }, 'คืนทุกค่าในแท็บนี้ (อาชีพ tier ตัวคูณมอน ตัวคูณ EXP ยา เซ็ตไอเทม Auto Play รางวัลเควสสอนระบบ เอฟเฟกต์สกิล และหยุดตอนโจมตี) เป็นค่าในโค้ดทั้งเซิร์ฟเลยไหม?\n(ค่าในแท็บระบบสกิลไม่เปลี่ยน มีปุ่มคืนค่าของตัวเอง)') }, '↺ คืนค่าในโค้ด'),
    ),
    msg,
  );

  // Category buttons + search box (owner 2026-11-22). Cards are only hidden with CSS (`.cat-hide`), never removed.
  const CATS: { name: string; cards: HTMLElement[] }[] = [
    { name: 'อาชีพ', cards: [classCard, regenCard, rootCard, rigCard] },
    { name: 'มอน-บอส', cards: [monsterCard, moveCard] },
    { name: 'ไอเทม-ตีบวก-ยา', cards: [affixCard, tierCard, previewCard, potionCard, bagCard, forgeCard, setCard] },
    { name: 'Auto Play', cards: [autoCard] },
    { name: 'เอฟเฟกต์-เสียง', cards: [fxCard, circleCard, audioCard] },
    { name: 'ระบบ-อื่นๆ', cards: [expCard, floorCard, tutCard, langCard] },
  ];
  const ALL = 'ทั้งหมด';
  const CAT_KEY = 'adminBalanceCat';
  let curCat = CATS[0].name;
  try {
    const s = localStorage.getItem(CAT_KEY);
    if (s === ALL || CATS.some((c) => c.name === s)) curCat = s as string;
  } catch { /* storage blocked: default */ }
  const search = h('input', { type: 'search', class: 'bal-search', placeholder: '🔍 ค้นหาการ์ดหรือชื่อค่า', autocomplete: 'off' }) as HTMLInputElement;
  const noHit = h('div', { class: 'muted bal-nohit' }, 'ไม่พบ');
  noHit.style.display = 'none';
  const catBar = h('nav', { class: 'cat-bar' });
  function applyFilter(): void {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    for (const cat of CATS) {
      for (const c of cat.cards) {
        const inCat = curCat === ALL || cat.name === curCat;
        const hit = q ? (c.textContent ?? '').toLowerCase().includes(q) : inCat;
        c.classList.toggle('cat-hide', !hit);
        if (hit) shown++;
      }
    }
    noHit.style.display = shown ? 'none' : '';
    catBar.replaceChildren(...[ALL, ...CATS.map((c) => c.name)].map((name) => {
      const b = h('button', { type: 'button', class: !q && name === curCat ? 'chip active' : 'chip', onclick: () => {
        curCat = name;
        search.value = '';
        try { localStorage.setItem(CAT_KEY, name); } catch { /* ignore */ }
        applyFilter();
      } }, name);
      return b;
    }));
    fold.refreshToc();
  }
  search.addEventListener('input', applyFilter);

  fold.head.prepend(h('div', { class: 'cat-top' }, catBar, search));
  box.replaceChildren(fold.head, noHit, classCard, regenCard, affixCard, tierCard, previewCard, monsterCard, expCard, potionCard, bagCard, forgeCard, setCard, floorCard, moveCard, autoCard, tutCard, fxCard, circleCard, rootCard, audioCard, rigCard, langCard, bar);
  redraw();
}
