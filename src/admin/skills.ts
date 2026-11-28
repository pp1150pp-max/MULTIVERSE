// The /admin "ระบบสกิล" tab (owner 2026-11-19; it used to be a card in the balance tab): the skill system's shared
// numbers, and each skill's own numbers picked from the class constellation the player sees on K (skillMap.ts).
// It edits only `skills` of the balance tuning (src/shared/skillTuning.ts): saving sends `part: 'skills'`, so the server
// keeps everything else as it is saved there, stores only what differs from the code and logs it (admin_audit).
import { foldable } from './ui';
import { checkBalance, codeBalance, balanceChanges, mergeBalance, type Balance, type BalanceTuning } from '../shared/balance';
import {
  BASIC_RATE_RANGE, BASIC_SKILLS, BASIC_VALUE_KEYS, EXTRA_DEF, EXTRA_KINDS, EXTRA_TARGET_NAME, EXTRA_TARGETS, MAX_EXTRAS, newExtra, SKILL_NUM_NAME, SKILL_RANGE,
  SKILL_VALUE_KEYS, SKILL_VALUE_NAME, SKILL_VALUE_RANGE, perRankLimit, UNLOCK_TIERS, type ExtraEffect, type ExtraKind, type ExtraTarget, type SkillValues,
} from '../shared/skillTuning';
import { isCountParam, rankedCooldown, rankedDmg, rankedMp, skillParam } from '../shared/skillBook';
import { SKILL_REACH } from '../shared/data/skillRanges';
import { CLASSES, CLASS_IDS, isLearnable, KIND_NAME, LEARN_KINDS, type SkillDef } from '../shared/data/classes';
import { MAX_LEVEL } from '../shared/formulas';
import type { ClassId } from '../shared/types';
import { constellation, PAD, SIZE } from '../client/skillMap';
import { imgUrl } from '../client/img';
import { CLASS_PASSIVES } from '../shared/classPassives';
import { CP_RANGE } from '../shared/classPassiveTuning';
import { ELEMENTS, ELEMENT_ICON, ELEMENT_NAME, ELEMENT_RANGE, MARK_EFFECT_NAME, MARK_NAME, REACTIONS, REACTION_KEYS, REACTION_NAME, REACTION_NUM_NAME, REACTION_RANGE, SKILL_ELEMENTS, type Element } from '../shared/elementTuning';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

/** Units of skill numbers that are counts (step 1). */
const COUNT_UNITS = new Set(['นัด', 'ลูก', 'ครั้ง', 'ชั้น', '°']);
/** The map's zoom limits here (the game's own limits are the settings on this page). */
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3;

interface BalanceState { tuning: BalanceTuning }

const learnable = (c: ClassId): SkillDef[] => CLASSES[c].skills.filter(isLearnable);
/** The class's basic attack (tuned on this tab too, owner 2026-11-20). */
const basicOf = (c: ClassId): SkillDef => BASIC_SKILLS.find((b) => b.cls === c)!.sk;
/** Learnable skills and the basic attack: everything with numbers on this tab. */
const tunable = (c: ClassId): SkillDef[] => [basicOf(c), ...learnable(c)];
const sameValues = (a: SkillValues, b: SkillValues): boolean =>
  SKILL_VALUE_KEYS.every((k) => a[k] === b[k]) && Object.keys(b.params).every((k) => a.params[k] === b.params[k] && (a.paramsPerRank[k] ?? 0) === (b.paramsPerRank[k] ?? 0));
/** A skill's numbers, its extra effects and (a basic attack) its speed are the same in both balances. */
const sameSkill = (a: Balance, b: Balance, id: string): boolean => {
  const basic = BASIC_SKILLS.find((x) => x.sk.id === id);
  return sameValues(a.skills.skills[id], b.skills.skills[id]) &&
    JSON.stringify(a.skills.effects[id] ?? []) === JSON.stringify(b.skills.effects[id] ?? []) &&
    (!basic || a.skills.basicRate[basic.cls] === b.skills.basicRate[basic.cls]);
};

export async function renderSkills(view: HTMLElement, h: H, api: Api, onSaved: (t: BalanceTuning) => void): Promise<void> {
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
  /** What is saved now, merged (a separate copy: the draft is edited in place). */
  let savedB: Balance = mergeBalance(saved);
  let cls: ClassId = 'sword';
  let sel = '';
  let query = '';
  const msg = h('div', { class: 'msg' });
  const summary = h('div', { class: 'muted' });
  /** Boxes holding a value out of range, by key: a box can leave the page (another star picked) while still bad. */
  const bad = new Map<string, { v: string; what: string }>();

  /** A number box bound to a draft value; marked when it differs from the code. */
  const numBox = (key: string, what: string, get: () => number, set: (n: number) => void, codeVal: number, lo: number, hi: number, step: number, refresh: () => void): HTMLInputElement => {
    const inp = h('input', { type: 'number', min: String(lo), max: String(hi), step: String(step), value: String(get()), title: `ค่าในโค้ด: ${codeVal} · ช่วง ${lo}–${hi}` });
    inp.className = 'bal-num';
    const mark = () => inp.classList.toggle('bal-changed', get() !== codeVal);
    mark();
    if (bad.has(key)) {
      inp.value = bad.get(key)!.v;
      inp.classList.add('bal-bad');
    }
    inp.addEventListener('input', () => {
      const n = Number(inp.value);
      const ok = inp.value !== '' && Number.isFinite(n) && n >= lo && n <= hi;
      inp.classList.toggle('bal-bad', !ok);
      if (!ok) {
        bad.set(key, { v: inp.value, what });
      } else {
        bad.delete(key);
        set(n);
        mark();
      }
      refresh();
    });
    return inp;
  };

  // ---------------------------------------------------------- shared numbers (four cards, folded: the map comes first)
  const cardPoints = h('div', { class: 'card folded' });
  const cardUnlock = h('div', { class: 'card folded' });
  const cardZoom = h('div', { class: 'card folded' });
  const cardFx = h('div', { class: 'card folded' });
  const cardCp = h('div', { class: 'card folded' });
  const cardEl = h('div', { class: 'card folded' });
  /** One setting: its name and hint on the left, the box on the right. */
  const setRow = (label: string, hint: string | null, ctl: Node, unit = ''): HTMLElement =>
    h('div', { class: 'set-row' }, h('div', { class: 'set-name' }, h('div', {}, label), hint ? h('div', { class: 'muted set-hint' }, hint) : null), h('div', { class: 'set-ctl' }, ctl, unit ? h('span', { class: 'muted' }, ` ${unit}`) : null));
  const drawShared = (): void => {
    const sc = draft.skills;
    const cs = code.skills;
    const refresh = (): void => { updateSummary(); drawPanel(); };
    const numRow = (k: keyof typeof SKILL_RANGE, step: number, hint: string | null, unit = ''): HTMLElement =>
      setRow(SKILL_NUM_NAME[k], hint, numBox(`g.${k}`, SKILL_NUM_NAME[k], () => sc[k], (n) => { sc[k] = n; }, cs[k], SKILL_RANGE[k][0], SKILL_RANGE[k][1], step, refresh), unit);
    const unlockRows = LEARN_KINDS.map((k) => setRow(`${KIND_NAME[k]}: เลเวลที่ปลดล็อกลำดับที่ 1–${UNLOCK_TIERS[k]}`, null,
      h('div', { class: 'set-multi' }, ...sc.unlock[k].map((_, i) => numBox(`u.${k}.${i}`, `เลเวลปลดล็อก${KIND_NAME[k]} ลำดับที่ ${i + 1}`, () => sc.unlock[k][i], (n) => { sc.unlock[k][i] = n; }, cs.unlock[k][i], 1, MAX_LEVEL, 1, refresh)))));
    cardPoints.replaceChildren(
      h('h2', {}, 'ค่ารวม 1: แต้มสกิลและแรงก์'),
      h('div', { class: 'muted' }, 'แต้มสกิล = เลเวล (ไม่เกินเลเวลที่ตั้ง) × แต้มต่อเลเวล · เรียนสกิล = แรงก์ 1 ใช้ 1 แต้ม อัปแรงก์ละ 1 แต้ม'),
      numRow('pointsPerLevel', 1, null, 'แต้ม'),
      numRow('lastPointLevel', 1, 'เลเวลสูงกว่านี้ไม่ได้แต้มเพิ่ม', 'เลเวล'),
      numRow('maxRank', 1, null, 'แรงก์'),
      numRow('freeRefundBelow', 1, 'แต้มรวมที่เคยได้น้อยกว่านี้ = คืนแต้มฟรี', 'แต้ม'),
      numRow('refundCost', 100, 'ใช้เมื่อพ้นช่วงคืนฟรี', 'G ต่อแต้ม'),
    );
    cardUnlock.replaceChildren(
      h('h2', {}, 'ค่ารวม 2: เลเวลปลดล็อกสกิล'),
      h('div', { class: 'muted' }, 'เลเวลที่ผู้เล่นต้องถึงเพื่อเรียนสกิลลำดับที่ 1, 2, 3, … ของแต่ละประเภท (เรียงจากน้อยไปมาก)'),
      ...unlockRows,
    );
    cardZoom.replaceChildren(
      h('h2', {}, 'ค่ารวม 3: ผังสกิลในเกม (ซูม)'),
      setRow('ผังสกิลซูม/เลื่อนได้', 'ล้อเมาส์ ปุ่ม +/− นิ้วถ่าง · ปิด = ผังพอดีกรอบแบบเดิม (ผังในหน้านี้ซูมได้เสมอ)',
        h('input', { type: 'checkbox', checked: sc.mapZoom, onchange: (e: Event) => { sc.mapZoom = (e.target as HTMLInputElement).checked; updateSummary(); } })),
      numRow('zoomMin', 5, '100 = ขนาดที่ผังเปิดมาพอดีกรอบ', '%'),
      numRow('zoomMax', 10, null, '%'),
    );
    cardFx.replaceChildren(
      h('h2', {}, 'ค่ารวม 4: เอฟเฟกต์พิเศษ'),
      h('div', { class: 'muted' }, 'เพิ่มเอฟเฟกต์ให้แต่ละสกิลได้ที่แผงของสกิลนั้น (คลิกดาวบนผัง) ส่วนนี้คือค่ากลางของเอฟเฟกต์'),
      numRow('extraStunGap', 0.5, 'มอนตัวเดิมโดนสตันซ้ำจากสกิลเดิมได้เมื่อพ้นเวลานี้ (กันสกิลที่ตีหลายครั้งสตันค้าง) · 0 = สตันทุกครั้งที่โดน', 'วิ'),
    );
    // Class passives (owner 2026-11-27, src/shared/classPassives.ts): always on from their level, no points.
    const cp = sc.classPassive;
    const ccp = cs.classPassive;
    const sw = (get: () => boolean, set: (v: boolean) => void): HTMLInputElement =>
      h('input', { type: 'checkbox', checked: get(), onchange: (e: Event) => { set((e.target as HTMLInputElement).checked); updateSummary(); } });
    const cpNum = (key: string, what: string, get: () => number, set: (n: number) => void, codeVal: number, r: readonly [number, number], step: number): HTMLInputElement =>
      numBox(`cp.${key}`, what, get, set, codeVal, r[0], r[1], step, refresh);
    const color = (get: () => string, set: (v: string) => void, codeVal: string): HTMLInputElement =>
      h('input', { type: 'color', value: get(), title: `ค่าในโค้ด: ${codeVal}`, oninput: (e: Event) => { set((e.target as HTMLInputElement).value.toLowerCase()); updateSummary(); } });
    const hr = CLASS_PASSIVES.gunslinger!;
    const wp = CLASS_PASSIVES.mage!;
    const sl = CLASS_PASSIVES.sword!;
    cardCp.replaceChildren(
      h('h2', {}, 'ค่ารวม 5: พาสซีฟประจำอาชีพ'),
      h('div', { class: 'muted' }, 'ดาวกลางของผังสกิล ติดตัวตลอดเมื่อถึงเลเวล ไม่ใช้แต้ม ไม่มีแรงก์ ไม่ต้องใส่ช่อง (ใช้คู่กับพาสซีฟ 1 ช่องเดิมได้)'),
      h('div', { class: 'skm-sub' }, `มือปืน: ${hr.nameTh} (${hr.name})`),
      setRow('เปิดใช้', hr.desc, sw(() => cp.hitrun.on, (v) => { cp.hitrun.on = v; })),
      setRow('เลเวลปลดล็อก', null, cpNum('hitrun.level', 'เลเวลปลดล็อกยิงแล้ววิ่ง', () => cp.hitrun.level, (n) => { cp.hitrun.level = n; }, ccp.hitrun.level, CP_RANGE.level, 1), 'เลเวล'),
      h('div', { class: 'skm-sub' }, `เมจ: ${wp.nameTh} (${wp.name})`),
      setRow('เปิดใช้', 'กดแดชแล้วหายตัวไปโผล่ปลายทางทันที (ระยะเท่าแดช ชนกำแพง/ของ/ขอบแมพหยุดตรงนั้น) · ปิด = แดชพุ่งแบบเดิม', sw(() => cp.warp.on, (v) => { cp.warp.on = v; })),
      setRow('เลเวลปลดล็อก', null, cpNum('warp.level', 'เลเวลปลดล็อกก้าวมิติ', () => cp.warp.level, (n) => { cp.warp.level = n; }, ccp.warp.level, CP_RANGE.level, 1), 'เลเวล'),
      setRow('จำนวนครั้งที่เก็บได้', 'คืนทีละครั้งตามคูลดาวน์แดชเดิม', cpNum('warp.stacks', 'จำนวนครั้งที่เก็บวาร์ปได้', () => cp.warp.stacks, (n) => { cp.warp.stacks = n; }, ccp.warp.stacks, CP_RANGE.stacks, 1), 'ครั้ง'),
      setRow('หน่วงระหว่างวาร์ป', 'วาร์ปสองครั้งติดกันต้องห่างอย่างน้อยเท่านี้', cpNum('warp.gap', 'หน่วงระหว่างวาร์ป', () => cp.warp.gap, (n) => { cp.warp.gap = n; }, ccp.warp.gap, CP_RANGE.gap, 0.05), 'วิ'),
      setRow('ขนาดวง', 'วงหายตัว + วงโผล่ (คูณกับขนาดของเอฟเฟกต์แดชที่สวม)', cpNum('warp.size', 'ขนาดวงวาร์ป', () => cp.warp.look.size, (n) => { cp.warp.look.size = n; }, ccp.warp.look.size, CP_RANGE.size, 0.1), '×'),
      setRow('เวลาวง', null, cpNum('warp.sec', 'เวลาวงวาร์ป', () => cp.warp.look.sec, (n) => { cp.warp.look.sec = n; }, ccp.warp.look.sec, CP_RANGE.sec, 0.05), 'วิ'),
      setRow('สีใน / สีนอก (ไม่ได้สวมเอฟเฟกต์แดช)', 'สวมเอฟเฟกต์แดชอยู่ = ใช้สีและอนุภาคของชิ้นนั้น',
        h('div', { class: 'set-multi' },
          color(() => cp.warp.look.color1, (v) => { cp.warp.look.color1 = v; }, ccp.warp.look.color1),
          color(() => cp.warp.look.color2, (v) => { cp.warp.look.color2 = v; }, ccp.warp.look.color2))),
      h('div', { class: 'skm-sub' }, `นักดาบ: ${sl.nameTh} (${sl.name})`),
      setRow('เปิดใช้', 'กดแดชแล้วฟันมอนทุกตัวที่พุ่งผ่าน ตัวละ 1 ครั้งต่อแดช ใช้กับบอสด้วย (ไม่มีธาตุ คริได้ ไม่ทะลุกำแพง ในเขตปลอดภัยไม่โดน) จำนวนแดชและคูลดาวน์เท่าเดิม · ปิด = แดชธรรมดา', sw(() => cp.slash.on, (v) => { cp.slash.on = v; })),
      setRow('เลเวลปลดล็อก', null, cpNum('slash.level', 'เลเวลปลดล็อกฟันทะลวง', () => cp.slash.level, (n) => { cp.slash.level = n; }, ccp.slash.level, CP_RANGE.level, 1), 'เลเวล'),
      setRow('ดาเมจ', 'ต่อมอน 1 ตัว (0.8 = 80% ของพลังโจมตี)', cpNum('slash.dmg', 'ดาเมจฟันทะลวง', () => cp.slash.dmg, (n) => { cp.slash.dmg = n; }, ccp.slash.dmg, CP_RANGE.dmg, 0.05), '×ATK'),
      setRow('ทำให้ช้า', '0.3 = ช้าลง 30% · 0 = ไม่ทำให้ช้า', cpNum('slash.slow', 'ช้าลงจากฟันทะลวง', () => cp.slash.slow, (n) => { cp.slash.slow = n; }, ccp.slash.slow, CP_RANGE.slow, 0.05), 'สัดส่วน'),
      setRow('เวลาช้า', null, cpNum('slash.slowT', 'เวลาช้าจากฟันทะลวง', () => cp.slash.slowT, (n) => { cp.slash.slowT = n; }, ccp.slash.slowT, CP_RANGE.slowT, 0.1), 'วิ'),
      setRow('ความกว้าง', 'ความกว้างทั้งหมดของแนวฟันตามทางแดช (ข้างละครึ่ง บวกตัวมอน)', cpNum('slash.width', 'ความกว้างฟันทะลวง', () => cp.slash.width, (n) => { cp.slash.width = n; }, ccp.slash.width, CP_RANGE.width, 0.1), 'ม.'),
    );

    // The element system (owner 2026-11-27, src/shared/elementTuning.ts).
    const el = sc.elements;
    const ce = cs.elements;
    const elNum = (key: string, what: string, get: () => number, set: (n: number) => void, codeVal: number, r: readonly [number, number], step: number): HTMLInputElement =>
      numBox(`el.${key}`, what, get, set, codeVal, r[0], r[1], step, refresh);
    const elementPick = (id: string): HTMLSelectElement => {
      const now = el.skill[id] ?? 'none';
      const was = ce.skill[id] ?? 'none';
      const s = h('select', {
        title: `ค่าในโค้ด: ${ELEMENT_NAME[was]}`,
        onchange: (e: Event) => {
          const v = SKILL_ELEMENTS[(e.target as HTMLSelectElement).selectedIndex];
          if (v === 'none') delete el.skill[id];
          else el.skill[id] = v;
          s.classList.toggle('bal-changed', v !== was);
          updateSummary();
        },
      }, ...SKILL_ELEMENTS.map((v) => h('option', { selected: v === now }, `${ELEMENT_ICON[v]} ${ELEMENT_NAME[v]}`.trim())));
      s.classList.toggle('bal-changed', now !== was);
      return s;
    };
    const hitting = (c: ClassId) => CLASSES[c].skills.filter((sk) => sk.kind !== 'passive');
    cardEl.replaceChildren(
      h('h2', {}, 'ค่ารวม 6: ระบบธาตุ'),
      h('div', { class: 'muted' }, 'เจ้าของ 2026-11-27: สกิลที่มีธาตุตีโดนมอน = ติดป้ายธาตุพร้อมผลเล็ก ๆ · โดนธาตุอื่นตอนยังมีป้าย = เกิดปฏิกิริยาของคู่นั้น ป้ายทั้งคู่หาย (มอนตัวเดิมเกิดซ้ำได้ตามคูลดาวน์) · ดาเมจต่อวิของไฟ/พิษและการตีของปฏิกิริยาเองไม่ทำให้ติดป้าย · ของที่เรียกมา (ป้อมปืน โดรน กับระเบิด) ใช้ธาตุของสกิลที่เรียก · บัฟมือปืนที่เปลี่ยนยิงปกติ (กระสุนร้อน/ช็อต/แยก/พายุลูกกระสุน) ให้ยิงปกติได้ธาตุนั้นระหว่างบัฟ · บอสโดนสตันจากปฏิกิริยา 30% ไม่โดนผลักตามกติกาเดิม'),
      setRow('เปิดระบบธาตุ', 'ปิด = ไม่มีป้าย ไม่มีปฏิกิริยา ไม่โชว์ธาตุบนสกิล', h('input', { type: 'checkbox', checked: el.on, onchange: (e: Event) => { el.on = (e.target as HTMLInputElement).checked; updateSummary(); } })),
      setRow('ป้ายธาตุอยู่นาน', null, elNum('markSec', 'ป้ายธาตุอยู่นาน', () => el.markSec, (n) => { el.markSec = n; }, ce.markSec, ELEMENT_RANGE.markSec, 0.5), 'วิ'),
      setRow('คูลดาวน์ปฏิกิริยา', 'ปฏิกิริยาเดิมกับมอนตัวเดิมเกิดซ้ำได้ทุกเท่านี้ (แต่ละปฏิกิริยานับแยก) และหลังเกิดปฏิกิริยา มอนตัวนั้นไม่ติดป้ายธาตุนานเท่านี้', elNum('reactCd', 'ปฏิกิริยาซ้ำได้ทุก', () => el.reactCd, (n) => { el.reactCd = n; }, ce.reactCd, ELEMENT_RANGE.reactCd, 0.5), 'วิ'),
      h('div', { class: 'skm-sub' }, 'ผลเล็ก ๆ ของป้ายแต่ละธาตุ (ตลอดเวลาที่ป้ายอยู่)'),
      ...ELEMENTS.map((e) => setRow(`${ELEMENT_ICON[e]} ${MARK_EFFECT_NAME[e]}`, `ป้าย "${MARK_NAME[e]}"`,
        elNum(`mark.${e}`, MARK_EFFECT_NAME[e], () => el.mark[e], (n) => { el.mark[e] = n; }, ce.mark[e], e === 'wind' ? [0, 10] : e === 'water' ? [0, 90] : [0, 200], e === 'wind' ? 0.5 : 1))),
      h('div', { class: 'skm-sub' }, 'ปฏิกิริยา (ดาเมจ/สตัน/ผลัก ใส่ทุกตัวในรัศมีรอบมอนที่เกิด · 0 = ตัวนั้นตัวเดียว · ดาเมจต่อวิ = ติดไฟ/พิษแบบปฏิกิริยา)'),
      ...REACTIONS.map((k) => {
        const rc = el.reactions[k];
        const cr = ce.reactions[k];
        const [a, b] = k.split('+') as [Element, Element];
        return setRow(`${ELEMENT_ICON[a]}+${ELEMENT_ICON[b]} ${REACTION_NAME[k]}`, null,
          h('div', { class: 'set-multi' },
            h('label', { class: rc.on !== cr.on ? 'bal-changed' : '' }, h('input', { type: 'checkbox', checked: rc.on, onchange: (e: Event) => { rc.on = (e.target as HTMLInputElement).checked; updateSummary(); } }), ' เปิด'),
            h('label', { class: rc.boss !== cr.boss ? 'bal-changed' : '' }, h('input', { type: 'checkbox', checked: rc.boss, onchange: (e: Event) => { rc.boss = (e.target as HTMLInputElement).checked; updateSummary(); } }), ' ใช้กับบอส'),
            ...REACTION_KEYS.map((f) => h('label', {}, ` ${REACTION_NUM_NAME[f]} `,
              elNum(`r.${k}.${f}`, `${REACTION_NAME[k]} ${REACTION_NUM_NAME[f]}`, () => rc[f], (n) => { rc[f] = n; }, cr[f], REACTION_RANGE[f], f === 'dmg' || f === 'dot' ? 5 : 0.5)))));
      }),
      h('div', { class: 'skm-sub' }, 'ธาตุของแต่ละสกิล (ช่องขอบทอง = ต่างจากค่าในโค้ด)'),
      ...CLASS_IDS.map((c) => h('div', {},
        h('div', { class: 'muted' }, CLASSES[c].nameTh),
        h('div', { class: 'set-multi', style: 'flex-wrap: wrap; gap: 6px 12px' },
          ...hitting(c).map((sk) => h('label', {}, `${sk.nameTh} `, elementPick(sk.id)))))),
    );
  };

  /** Land Mine charges (owner 2026-11-20: shown in the Land Mine own panel, not apart): the game-wide numbers it uses. */
  const mineBox = (refresh: () => void): HTMLElement => {
    const sc = draft.skills;
    const cs = code.skills;
    const numRow = (k: 'mineMax' | 'mineGap', step: number, hint: string | null, unit: string): HTMLElement =>
      setRow(SKILL_NUM_NAME[k], hint, numBox(`g.${k}`, SKILL_NUM_NAME[k], () => sc[k], (n) => { sc[k] = n; }, cs[k], SKILL_RANGE[k][0], SKILL_RANGE[k][1], step, refresh), unit);
    return h('div', {},
      h('div', { class: 'skm-sub' }, 'สแตค (เก็บได้หลายอัน คืนทีละอัน)'),
      h('div', { class: 'muted' }, 'ใช้แล้วนับคูลดาวน์ของสกิล (รวมแรงก์และมอดลดคูลดาวน์) คืน 1 อัน จบแล้วถ้ายังไม่เต็มนับอันถัดไปต่อ · กับระเบิดบนพื้นพร้อมกันได้เท่าจำนวนสแตคสูงสุดที่ได้ตามแรงก์ วางเกินอันเก่าสุดหาย'),
      numRow('mineMax', 1, null, 'อัน'),
      numRow('mineGap', 0.1, 'หน่วงระหว่างวางสองอันติดกัน', 'วิ'),
      setRow('วางไม่ชะงัก', 'ไม่หยุดเดินตอนวาง', h('input', { type: 'checkbox', checked: sc.mineNoRoot, onchange: (e: Event) => { sc.mineNoRoot = (e.target as HTMLInputElement).checked; refresh(); } })),
      setRow('แรงก์ที่ได้สแตคที่ 1–5', 'สแตคที่ N ได้เมื่อแรงก์ถึงค่านี้ (นับเฉพาะ N ไม่เกิน "สแตคสูงสุด")',
        h('div', { class: 'set-multi' }, ...sc.mineRanks.map((_, i) => numBox(`mr.${i}`, `แรงก์ที่ได้สแตคที่ ${i + 1}`, () => sc.mineRanks[i], (n) => { sc.mineRanks[i] = n; }, cs.mineRanks[i], 1, 20, 1, refresh)))),
    );
  };

  // ---------------------------------------------------------- per-skill numbers: the constellation + the editing panel
  const mapCard = h('div', { class: 'card' });
  const wrap = h('div', { class: 'skm-wrap' });
  const panel = h('div', { class: 'skm-panel' });
  const found = h('div', { class: 'skm-found' });
  const changedList = h('div', { class: 'skm-found' });
  let basicBtn: HTMLButtonElement | null = null;
  let zoom = 1;
  let mapW = 1, mapH = 1, ox = 0, oy = 0;

  const skillById = (id: string): { sk: SkillDef; c: ClassId } | undefined => {
    for (const c of CLASS_IDS) {
      const sk = tunable(c).find((s) => s.id === id);
      if (sk) return { sk, c };
    }
    return undefined;
  };
  const mineSame = (a: Balance, b: Balance): boolean => (['mineMax', 'mineGap', 'mineNoRoot'] as const).every((k) => a.skills[k] === b.skills[k]) && a.skills.mineRanks.join() === b.skills.mineRanks.join();
  const differsFromCode = (id: string): boolean => !sameSkill(draft, code, id) || (id === 'gs_mine' && !mineSame(draft, code));
  const unsaved = (id: string): boolean => !sameSkill(draft, savedB, id) || (id === 'gs_mine' && !mineSame(draft, savedB));
  const pick = (c: ClassId, id: string): void => {
    const newCls = c !== cls;
    cls = c;
    sel = id;
    if (newCls) drawMapCard();
    else { markStars(); drawPanel(); }
    if (getComputedStyle(panel.parentElement!).gridTemplateColumns.split(' ').length === 1) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  /** The marks on the stars (changed / unsaved / picked / search) without drawing the map again. */
  const markStars = (): void => {
    const q = query.trim().toLowerCase();
    for (const n of wrap.querySelectorAll<HTMLElement>('.skm-node')) {
      const id = n.dataset.id!;
      const sk = skillById(id)?.sk;
      n.classList.toggle('changed', differsFromCode(id));
      n.classList.toggle('unsaved', unsaved(id));
      n.classList.toggle('sel', id === sel);
      n.classList.toggle('dim', !!q && !!sk && !`${sk.nameTh} ${sk.name} ${sk.id}`.toLowerCase().includes(q));
    }
    // Search results across every class, and the list of changed skills.
    found.replaceChildren();
    if (q) {
      const hits = CLASS_IDS.flatMap((c) => learnable(c).filter((sk) => `${sk.nameTh} ${sk.name} ${sk.id}`.toLowerCase().includes(q)).map((sk) => ({ c, sk })));
      found.append(h('span', { class: 'muted' }, hits.length ? 'พบ: ' : 'ไม่พบสกิลชื่อนี้'),
        ...hits.slice(0, 30).map(({ c, sk }) => h('button', { class: `chip${sk.id === sel ? ' on' : ''}`, onclick: () => pick(c, sk.id) }, `${sk.nameTh} (${CLASSES[c].nameTh})`)));
    }
    const changed = CLASS_IDS.flatMap((c) => tunable(c).filter((sk) => differsFromCode(sk.id)).map((sk) => ({ c, sk })));
    basicBtn?.classList.toggle('on', basicOf(cls).id === sel);
    basicBtn?.classList.toggle('dirty', unsaved(basicOf(cls).id));
    changedList.replaceChildren(...(changed.length
      ? [h('span', { class: 'muted' }, `แก้ต่างจากโค้ด ${changed.length} สกิล: `),
        ...changed.map(({ c, sk }) => h('button', { class: `chip${unsaved(sk.id) ? ' dirty' : ''}`, onclick: () => pick(c, sk.id) }, `${sk.nameTh} (${CLASSES[c].nameTh})`))]
      : [h('span', { class: 'muted' }, 'ยังไม่มีสกิลที่แก้ต่างจากโค้ด')]));
  };

  const applyZoom = (z: number, cx?: number, cy?: number): void => {
    const sizer = wrap.firstElementChild as HTMLElement | null;
    if (!sizer) return;
    const wr = wrap.getBoundingClientRect();
    const ax = cx ?? wr.left + wr.width / 2, ay = cy ?? wr.top + wr.height / 2;
    const r0 = sizer.getBoundingClientRect();
    const mx = (ax - r0.left) / zoom, my = (ay - r0.top) / zoom;
    zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    sizer.style.width = `${mapW * zoom}px`;
    sizer.style.height = `${mapH * zoom}px`;
    (sizer.firstElementChild as HTMLElement).style.transform = `scale(${zoom})`;
    const r1 = sizer.getBoundingClientRect();
    wrap.scrollLeft += r1.left + mx * zoom - ax;
    wrap.scrollTop += r1.top + my * zoom - ay;
  };
  const centre = (): void => {
    wrap.scrollLeft = ox * zoom - wrap.clientWidth / 2;
    wrap.scrollTop = oy * zoom - wrap.clientHeight / 2;
  };

  /** The class's constellation, as in the game's skill window (no player: no ranks, no locks). */
  const drawMap = (): void => {
    const c = CLASSES[cls];
    const { stars, labels, outline, spots } = constellation(learnable(cls));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of [...stars, ...labels.map((q) => ({ ...q, size: 60 })), ...spots.map((q) => ({ ...q, size: SIZE.ult })), { x: 0, y: 0, size: 0 }]) {
      const r = s.size / 2;
      x0 = Math.min(x0, s.x - r); y0 = Math.min(y0, s.y - r);
      x1 = Math.max(x1, s.x + r); y1 = Math.max(y1, s.y + r);
    }
    ox = PAD - x0; oy = PAD - y0;
    mapW = Math.ceil(x1 - x0 + PAD * 2); mapH = Math.ceil(y1 - y0 + PAD * 2);
    const X = (v: number) => (v + ox).toFixed(1), Y = (v: number) => (v + oy).toFixed(1);
    const color = (sk: SkillDef) => (sk.line !== undefined ? c.lines[sk.line].color : '#e8d9a8');
    const ghost = outline.map((s) => `<line class="ghost" x1="${X(s.from.x)}" y1="${Y(s.from.y)}" x2="${X(s.to.x)}" y2="${Y(s.to.y)}" style="--lc:${c.lines[s.line].color}"/>`).join('') +
      spots.map((s) => `<circle class="spot" cx="${X(s.x)}" cy="${Y(s.y)}" r="3"/>`).join('');
    const lines = stars.map((s) => `<line x1="${X(s.from.x)}" y1="${Y(s.from.y)}" x2="${X(s.x)}" y2="${Y(s.y)}" style="--lc:${color(s.sk)}"/>`).join('');
    const rays = Array.from({ length: 16 }, (_, i) => {
      const a = (i * Math.PI) / 8, r = i % 2 ? 16 : 30;
      return `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(Math.cos(a) * r)}" y2="${Y(Math.sin(a) * r)}"/>`;
    }).join('');
    const svg = `<svg class="skm-lines" width="${mapW}" height="${mapH}" viewBox="0 0 ${mapW} ${mapH}">${ghost}${lines}<g class="skm-core">${rays}<circle cx="${X(0)}" cy="${Y(0)}" r="6"/></g></svg>`;
    const names = c.lines.map((l, i) => `<div class="skm-lname" style="left:${X(labels[i].x)}px;top:${Y(labels[i].y)}px;--lc:${l.color}">${l.nameTh}</div>`).join('');
    const blank = imgUrl('assets/sprites/ui/ico_blank.png');
    const nodes = stars.map((s) =>
      `<button type="button" class="skm-node ${s.sk.kind}" data-id="${s.sk.id}" title="${s.sk.nameTh}" style="left:${X(s.x)}px;top:${Y(s.y)}px;--sz:${s.size}px;--lc:${color(s.sk)}">` +
      `<img src="${imgUrl(`assets/sprites/icons/skill_${s.sk.id}.png`)}" alt="" draggable="false" onerror="this.onerror=null;this.src='${blank}'"><i></i></button>`).join('');
    wrap.innerHTML = `<div class="skm-sizer" style="width:${mapW * zoom}px;height:${mapH * zoom}px"><div class="skm-map" style="width:${mapW}px;height:${mapH}px;transform:scale(${zoom})">${svg}${names}${nodes}</div></div>`;
    markStars();
  };

  // Wheel zooms at the pointer, a drag pans, two fingers pinch; a press that moved is not a click on a star.
  {
    const ptrs = new Map<number, { x: number; y: number }>();
    let moved = false;
    let start = { x: 0, y: 0 };
    let pinch = { d: 1, x: 0, y: 0 };
    const pair = () => {
      const [a, b] = [...ptrs.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    wrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      applyZoom(zoom * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    }, { passive: false });
    wrap.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { moved = false; start = { x: e.clientX, y: e.clientY }; }
      else if (ptrs.size === 2) { moved = true; pinch = pair(); }
    });
    wrap.addEventListener('pointermove', (e) => {
      const q = ptrs.get(e.pointerId);
      if (!q) return;
      const dx = e.clientX - q.x, dy = e.clientY - q.y;
      q.x = e.clientX; q.y = e.clientY;
      if (ptrs.size === 2) {
        const n = pair();
        applyZoom(zoom * (n.d / pinch.d), n.x, n.y);
        wrap.scrollLeft -= n.x - pinch.x;
        wrap.scrollTop -= n.y - pinch.y;
        pinch = n;
        return;
      }
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
      if (!moved) { try { wrap.setPointerCapture(e.pointerId); } catch { /* pointer gone */ } }
      moved = true;
      wrap.classList.add('panning');
      wrap.scrollLeft -= dx;
      wrap.scrollTop -= dy;
    });
    const up = (e: PointerEvent) => {
      ptrs.delete(e.pointerId);
      if (!ptrs.size) wrap.classList.remove('panning');
    };
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', up);
    wrap.addEventListener('click', (e) => {
      if (moved) { moved = false; e.stopPropagation(); e.preventDefault(); return; }
      const n = (e.target as HTMLElement).closest<HTMLElement>('.skm-node');
      if (n) pick(cls, n.dataset.id!);
    }, true);
  }

  /** The picked skill's numbers (all the boxes the old table had) and what they give at rank 1 → the top rank. */
  function drawPanel(): void {
    const c = CLASSES[cls];
    if (sel === basicOf(cls).id) {
      drawBasicPanel();
      return;
    }
    const sk = learnable(cls).find((s) => s.id === sel);
    if (!sk) {
      panel.replaceChildren(h('div', { class: 'muted' }, 'คลิกดาวบนผังเพื่อแก้ค่าของสกิลนั้น · ดาวขอบทอง = แก้ต่างจากค่าในโค้ด · จุดส้ม = ยังไม่บันทึก'));
      return;
    }
    const v = draft.skills.skills[sk.id];
    const cv = code.skills.skills[sk.id];
    const out = h('div', { class: 'skm-out' });
    const top = draft.skills.maxRank;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const showOut = (): void => {
      out.replaceChildren(
        h('div', {}, `ดาเมจ ${Math.round(rankedDmg(sk, 1, draft) * 100)}% → ${Math.round(rankedDmg(sk, top, draft) * 100)}% ATK`),
        h('div', {}, `MP Lv1 ${rankedMp(sk, cls, 1, 1, draft)} → Lv${draft.skills.lastPointLevel} แรงก์ ${top} ${rankedMp(sk, cls, draft.skills.lastPointLevel, top, draft)}`),
        h('div', {}, `คูลดาวน์ ${r2(rankedCooldown(sk, 1, draft))} → ${r2(rankedCooldown(sk, top, draft))} วิ`),
      );
    };
    /** Previews of each own number at rank 1 / 5 / 10 (they follow the boxes). */
    const previews: (() => void)[] = [];
    const refresh = (): void => { showOut(); previews.forEach((f) => f()); markStars(); updateSummary(); };
    const line = sk.line !== undefined ? c.lines[sk.line] : undefined;
    const fields = SKILL_VALUE_KEYS.map((k) => h('label', { class: 'skm-field' }, h('span', {}, SKILL_VALUE_NAME[k]),
      // Buffs and passives reach nothing: no reach box.
      k === 'reach' && !SKILL_REACH[sk.id] ? h('span', { class: 'muted' }, '—')
        : numBox(`s.${sk.id}.${k}`, `${sk.nameTh} ${SKILL_VALUE_NAME[k]}`, () => v[k], (n) => { v[k] = n; }, cv[k], SKILL_VALUE_RANGE[k][0], SKILL_VALUE_RANGE[k][1], k === 'dmg' || k === 'reach' ? 0.05 : k === 'cooldown' ? 0.5 : 1, refresh)));
    // The skill's own numbers (stun, slow, shots...): * grow with เวลาสถานะ/ผลพาสซีฟ %/แรงก์, † (extra damage) with ดาเมจ %/แรงก์.
    // "+ ต่อแรงก์" (owner 2026-11-20): added to the number for each rank above 1, in its own unit, on top of the * / † growth.
    const params = Object.entries(sk.params ?? {}).map(([pk, d]) => {
      const lim = perRankLimit(d);
      const prev = h('span', { class: 'muted' });
      const upd = (): void => {
        const at = (r: number) => r2(skillParam(sk, pk, r, draft));
        prev.textContent = `แรงก์ 1 = ${at(1)} · 5 = ${at(5)} · ${top} = ${at(top)} ${d.unit}`;
      };
      previews.push(upd);
      upd();
      const step = COUNT_UNITS.has(d.unit) || isCountParam(d) ? 1 : 0.05;
      return h('div', { class: 'skm-field', style: 'flex-direction:column;align-items:stretch;gap:2px' },
        h('label', { class: 'skm-field' },
          h('span', {}, `${d.nameTh}${d.status ? ' *' : d.dmg ? ' †' : ''} (${d.unit})`),
          numBox(`s.${sk.id}.p.${pk}`, `${sk.nameTh} ${d.nameTh}`, () => v.params[pk], (n) => { v.params[pk] = n; }, cv.params[pk], d.lo, d.hi, step, refresh)),
        h('label', { class: 'skm-field' },
          h('span', {}, '+ ต่อแรงก์'),
          numBox(`s.${sk.id}.pr.${pk}`, `${sk.nameTh} ${d.nameTh} + ต่อแรงก์`, () => v.paramsPerRank[pk] ?? 0, (n) => { v.paramsPerRank[pk] = n; }, 0, -lim, lim, step === 1 ? 1 : 0.01, refresh)),
        prev);
    });
    const backBtn = h('button', { type: 'button', class: 'small', onclick: () => resetSkill(sk.id) }, '↺ สกิลนี้กลับเป็นค่าในโค้ด');
    backBtn.disabled = !differsFromCode(sk.id);
    panel.replaceChildren(...[
      h('h3', {}, sk.nameTh),
      h('div', { class: 'muted' }, `${sk.name} · ${KIND_NAME[sk.kind as 'normal']}`, line ? h('span', { style: `color:${line.color}` }, ` · ${line.nameTh}`) : null),
      h('div', { class: 'skm-desc' }, sk.desc),
      h('div', { class: 'skm-fields' }, ...fields),
      params.length ? h('div', { class: 'skm-sub' }, 'ค่าพิเศษ (* = โตตามเวลาสถานะ/ผลพาสซีฟ % · † = โตตามดาเมจ % · "+ ต่อแรงก์" บวกเพิ่มต่อแรงก์ในหน่วยของค่านั้น ซ้อนกับ * † ได้ · ค่าจำนวนนับปัดเป็นจำนวนเต็ม · ไม่เกินช่วงต่ำสุด/สูงสุดของค่านั้น)') : null,
      params.length ? h('div', { class: 'skm-fields' }, ...params) : null,
      sk.id === 'gs_mine' ? mineBox(() => { updateSummary(); markStars(); }) : null,
      h('div', { class: 'skm-sub' }, 'ได้จริง (แรงก์ 1 → สูงสุด)'),
      out,
      sk.kind === 'passive' ? null : extrasBox(sk),
      h('div', { class: 'row' }, backBtn),
    ].filter((x): x is HTMLDivElement | HTMLHeadingElement => !!x));
    showOut();
  }

  /** Puts a skill (and, for a basic attack, its speed) back to the code's numbers and no extra effects. */
  function resetSkill(id: string): void {
    draft.skills.skills[id] = structuredClone(code.skills.skills[id]);
    delete draft.skills.effects[id];
    const basic = BASIC_SKILLS.find((x) => x.sk.id === id);
    if (basic) draft.skills.basicRate[basic.cls] = code.skills.basicRate[basic.cls];
    for (const k of [...bad.keys()]) if (k.startsWith(`s.${id}.`) || k.startsWith(`fx.${id}.`) || k === `rate.${id}`) bad.delete(k);
    drawPanel(); markStars(); updateSummary();
  }

  /** The class's basic attack: damage, reach, attacks a second and its extra effects (owner 2026-11-20). */
  function drawBasicPanel(): void {
    const sk = basicOf(cls);
    const v = draft.skills.skills[sk.id];
    const cv = code.skills.skills[sk.id];
    const out = h('div', { class: 'skm-out' });
    const showOut = (): void => {
      out.replaceChildren(h('div', {}, `ดาเมจ ${Math.round(v.dmg * 100)}% ATK · ${draft.skills.basicRate[cls]} ครั้ง/วิ (ก่อนบวกความเร็วโจมตีจากของ) · ระยะ ${v.reach} ม.`));
    };
    const refresh = (): void => { showOut(); markStars(); updateSummary(); };
    const fields = BASIC_VALUE_KEYS.map((k) => h('label', { class: 'skm-field' }, h('span', {}, SKILL_VALUE_NAME[k]),
      numBox(`s.${sk.id}.${k}`, `${sk.nameTh} ${SKILL_VALUE_NAME[k]}`, () => v[k], (n) => { v[k] = n; }, cv[k], SKILL_VALUE_RANGE[k][0], SKILL_VALUE_RANGE[k][1], 0.05, refresh)));
    fields.push(h('label', { class: 'skm-field' }, h('span', {}, 'ตีต่อวิ (ครั้ง)'),
      numBox(`rate.${sk.id}`, `${sk.nameTh} ตีต่อวิ`, () => draft.skills.basicRate[cls], (n) => { draft.skills.basicRate[cls] = n; }, code.skills.basicRate[cls], BASIC_RATE_RANGE[0], BASIC_RATE_RANGE[1], 0.1, refresh)));
    const backBtn = h('button', { type: 'button', class: 'small', onclick: () => resetSkill(sk.id) }, '↺ ตีธรรมดานี้กลับเป็นค่าในโค้ด');
    backBtn.disabled = !differsFromCode(sk.id);
    panel.replaceChildren(
      h('h3', {}, `ตีธรรมดา: ${sk.nameTh}`),
      h('div', { class: 'muted' }, `${sk.name} · ตีธรรมดาของ${CLASSES[cls].nameTh} (ไม่มีแรงก์ MP คูลดาวน์)`),
      h('div', { class: 'skm-desc' }, sk.desc),
      h('div', { class: 'skm-fields' }, ...fields),
      h('div', { class: 'muted' }, 'ระยะ = ระยะฟัน (นักดาบ) / ระยะยิง (เมจ มือปืน) · Auto Play ยืนห่างตามสัดส่วนระยะที่ตั้ง · ตีต่อวิ คูณกับ "ความเร็วโจมตี %" ของตัวละครอีกที'),
      out,
      extrasBox(sk),
      h('div', { class: 'row' }, backBtn),
    );
    showOut();
  }

  /** "เอฟเฟกต์พิเศษ": the extra effects of a skill or basic attack (add, kind, numbers, target, remove). */
  function extrasBox(sk: SkillDef): HTMLElement {
    const id = sk.id;
    const list = (): ExtraEffect[] => (draft.skills.effects[id] ??= []);
    const box = h('div', { class: 'skm-extras' });
    const changed = (): void => {
      if (!list().length) delete draft.skills.effects[id];
      markStars(); updateSummary();
    };
    const redrawBox = (): void => {
      // Boxes of removed / re-typed rows must not stay "bad".
      for (const k of [...bad.keys()]) if (k.startsWith(`fx.${id}.`)) bad.delete(k);
      box.replaceChildren(...build());
      changed();
    };
    const build = (): HTMLElement[] => {
      const rows = (draft.skills.effects[id] ?? []).map((e, i) => {
        const d = EXTRA_DEF[e.k];
        const kind = h('select', { onchange: (ev: Event) => {
          list()[i] = newExtra((ev.target as HTMLSelectElement).value as ExtraKind, e.to);
          redrawBox();
        } }, ...EXTRA_KINDS.map((k) => h('option', { value: k, selected: k === e.k }, EXTRA_DEF[k].nameTh)));
        const who = h('select', { onchange: (ev: Event) => {
          e.to = (ev.target as HTMLSelectElement).value as ExtraTarget;
          changed();
        } }, ...EXTRA_TARGETS.map((t) => h('option', { value: t, selected: t === e.to }, EXTRA_TARGET_NAME[t])));
        const vBox = numBox(`fx.${id}.${i}.v`, `${sk.nameTh} ${d.nameTh}`, () => e.v, (n) => { e.v = n; }, NaN, d.v.lo, d.v.hi, d.v.step, changed);
        const tBox = d.t ? numBox(`fx.${id}.${i}.t`, `${sk.nameTh} ${d.nameTh} เวลา`, () => e.t, (n) => { e.t = n; }, NaN, d.t.lo, d.t.hi, d.t.step, changed) : null;
        const del = h('button', { type: 'button', class: 'small', title: 'ลบเอฟเฟกต์นี้', onclick: () => { list().splice(i, 1); redrawBox(); } }, '✕');
        return h('div', { class: 'row bal-line skm-extra' }, kind,
          h('label', {}, `${d.v.nameTh} `, vBox, ` ${d.v.unit}`),
          tBox ? h('label', {}, `${d.t!.nameTh} `, tBox, ' วิ') : null,
          h('label', {}, 'ใช้กับ ', who), del);
      });
      const pickKind = h('select', {}, ...EXTRA_KINDS.map((k) => h('option', { value: k }, EXTRA_DEF[k].nameTh)));
      const full = (draft.skills.effects[id]?.length ?? 0) >= MAX_EXTRAS;
      const add = h('button', { type: 'button', class: 'small', onclick: () => {
        if (list().length >= MAX_EXTRAS) return;
        list().push(newExtra(pickKind.value as ExtraKind));
        redrawBox();
      } }, '+ เพิ่ม');
      add.disabled = full;
      return [
        h('div', { class: 'skm-sub' }, `เอฟเฟกต์พิเศษ (เพิ่มเอง ไม่เกิน ${MAX_EXTRAS} อัน)`),
        h('div', { class: 'muted' }, 'ติดทุกครั้งที่สกิลนี้โดน (ทุกลูก ทุกวิ ของที่วางไว้ด้วย) เพิ่มจากที่สกิลทำอยู่แล้ว · ซ้ำกับของสกิลเอง = เอาค่าที่แรงกว่า · ไม่โตตามแรงก์ · บอส: สตันเหลือ 30% บอสที่มีท่าพิเศษไม่ติดสตัน ผลักบอสไม่ได้ (กติกาเดิม) · ไฟ/พิษไม่ซ้อนกันเอง โดนซ้ำ = นับเวลาใหม่'),
        ...rows,
        h('div', { class: 'row bal-line' }, pickKind, add, full ? h('span', { class: 'muted' }, 'ครบแล้ว') : null),
      ];
    };
    box.replaceChildren(...build());
    return box;
  }

  const drawMapCard = (): void => {
    const tabs = h('div', { class: 'subtabs' }, ...CLASS_IDS.map((id) =>
      h('button', { class: id === cls ? 'on' : '', onclick: () => { if (id !== cls) { cls = id; sel = ''; drawMapCard(); } } }, CLASSES[id].nameTh)));
    const search = h('input', { type: 'search', placeholder: '🔍 ค้นหาชื่อสกิล (ทุกอาชีพ)', value: query, class: 'skm-search' });
    // Typing a search is not an edit: keep it from marking the card as changed.
    search.addEventListener('input', (e) => { e.stopPropagation(); query = search.value; markStars(); });
    const zoomBtns = h('div', { class: 'skm-zoom' },
      h('button', { type: 'button', title: 'ซูมเข้า', onclick: () => applyZoom(zoom * 1.25) }, '+'),
      h('button', { type: 'button', title: 'ซูมออก', onclick: () => applyZoom(zoom * 0.8) }, '−'),
      h('button', { type: 'button', title: 'ขนาดเริ่มต้น', onclick: fitMap }, '⤾'));
    const b = basicOf(cls);
    basicBtn = h('button', { class: 'chip', onclick: () => pick(cls, b.id) }, `⚔ ตีธรรมดา: ${b.nameTh} (ดาเมจ ระยะ ความเร็ว เอฟเฟกต์พิเศษ)`);
    mapCard.replaceChildren(
      h('h2', {}, 'ค่ารายสกิล'),
      h('div', { class: 'muted' }, 'ค่ารายสกิล: % ต่อแรงก์คิดจากแรงก์ 1 (เช่น ดาเมจ 5% → แรงก์ 10 = ×1.45) · คูลดาวน์ %/แรงก์ ติดลบ = สั้นลง · MP คูณต่อจาก MP สกิล/เลเวลของอาชีพ · เวลาสถานะ = สตัน ช้า ลดเกราะ ไม่รับดาเมจ ดูดเลือด · ระยะ/รัศมี = ระยะยิง/พุ่ง หรือรัศมีรอบตัว (วงระเบิด/วงตกอยู่ในค่าพิเศษ)'),
      tabs,
      h('div', { class: 'skm-found' }, basicBtn),
      search,
      found,
      h('div', { class: 'skm-body' }, h('div', { class: 'skm-box' }, wrap, zoomBtns), panel),
      changedList,
    );
    drawPanel();
    fitMap();
  };
  /** Draws the map at a size that fits its frame (a phone sees it smaller and can zoom in), centred. */
  function fitMap(): void {
    zoom = 1;
    drawMap();
    const w = wrap.clientWidth, hh = wrap.clientHeight;
    if (w && hh) {
      // A phone keeps stars big enough for a finger (as the game does: not below 70%) and scrolls instead.
      zoom = Math.min(1, Math.max(w < 500 ? 0.7 : ZOOM_MIN, Math.min(w / mapW, hh / mapH)));
      drawMap();
    }
    centre();
  }

  // ---------------------------------------------------------- save bar
  const draftTuning = (): ReturnType<typeof checkBalance> => checkBalance(draft, true);
  /** Only the skills part of a check (the rest of the page's draft is never sent). */
  const skillsOnly = (t: BalanceTuning): BalanceTuning => (t.skills ? { skills: t.skills } : {});
  const savedSkillsOnly = (): BalanceTuning => skillsOnly(saved);
  function updateSummary(): void {
    if (bad.size) {
      box.dataset.clean = '';
      summary.textContent = `⚠ มีช่องที่ใส่ค่าไม่ถูกต้อง: ${[...bad.values()].map((x) => x.what).join(', ')}`;
      summary.className = 'msg bad';
      return;
    }
    const c = draftTuning();
    if (!c.tuning) {
      box.dataset.clean = '';
      summary.textContent = `⚠ ${c.error}`;
      summary.className = 'msg bad';
      return;
    }
    const changes = balanceChanges(savedSkillsOnly(), skillsOnly(c.tuning));
    summary.className = 'muted';
    summary.textContent = changes ? `ยังไม่บันทึก: ${changes}` : 'ตรงกับที่บันทึกไว้';
    box.dataset.clean = changes ? '' : '1';
    if (!changes) fold.clearDirty();
  }
  const redraw = (): void => {
    bad.clear();
    drawShared();
    drawMapCard();
    updateSummary();
  };
  const save = async (body: { tuning: BalanceTuning; part: 'skills' } | { reset: true; part: 'skills' }, ask: string): Promise<void> => {
    if (!confirm(ask)) return;
    msg.className = 'msg';
    msg.textContent = 'กำลังบันทึก…';
    try {
      saved = (await api<BalanceState>('POST', '/admin/balance', body)).tuning;
      draft = mergeBalance(saved);
      savedB = mergeBalance(saved);
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
        if (bad.size) {
          msg.className = 'msg bad';
          msg.textContent = `มีช่องที่ใส่ค่าไม่ถูกต้อง (กรอบแดง) แก้ก่อนบันทึก: ${[...bad.values()].map((x) => x.what).join(', ')}`;
          return;
        }
        const c = draftTuning();
        if (!c.tuning) {
          msg.className = 'msg bad';
          msg.textContent = c.error;
          return;
        }
        const changes = balanceChanges(savedSkillsOnly(), skillsOnly(c.tuning));
        if (!changes) {
          msg.className = 'msg';
          msg.textContent = 'ไม่มีอะไรเปลี่ยน';
          return;
        }
        // Only the skills go: the server keeps the rest of the balance as it is saved there now.
        void save({ tuning: skillsOnly(c.tuning), part: 'skills' }, `ใช้ค่าสกิลใหม่กับทั้งเซิร์ฟทันทีไหม?\n\n${changes.slice(0, 1200)}`);
      } }, '💾 บันทึกทั้งเซิร์ฟ'),
      h('button', { onclick: () => { draft = mergeBalance(saved); redraw(); fold.clearDirty(); msg.textContent = ''; } }, 'ยกเลิกที่ยังไม่บันทึก'),
      h('button', { onclick: () => void save({ reset: true, part: 'skills' }, 'คืนค่าระบบสกิลทั้งหมด (ค่ารวมและค่ารายสกิลทุกอาชีพ) เป็นค่าในโค้ดทั้งเซิร์ฟเลยไหม?\n(ค่าในแท็บปรับสมดุลไม่เปลี่ยน)') }, '↺ คืนค่าระบบสกิลในโค้ด'),
    ),
    msg,
  );

  box.replaceChildren(fold.head, mapCard, cardPoints, cardUnlock, cardZoom, cardFx, cardCp, cardEl, bar);
  redraw();
  fold.refreshToc();
}
