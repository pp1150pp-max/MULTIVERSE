// The /admin "ระบบสกิล" tab (owner 2026-11-19; it used to be a card in the balance tab): the skill system's shared
// numbers, and each skill's own numbers picked from the class constellation the player sees on K (skillMap.ts).
// It edits only `skills` of the balance tuning (src/shared/skillTuning.ts): saving sends `part: 'skills'`, so the server
// keeps everything else as it is saved there, stores only what differs from the code and logs it (admin_audit).
import { foldable } from './ui';
import { checkBalance, codeBalance, balanceChanges, mergeBalance, type Balance, type BalanceTuning } from '../shared/balance';
import { SKILL_NUM_NAME, SKILL_RANGE, SKILL_VALUE_KEYS, SKILL_VALUE_NAME, SKILL_VALUE_RANGE, UNLOCK_TIERS, type SkillValues } from '../shared/skillTuning';
import { rankedCooldown, rankedDmg, rankedMp } from '../shared/skillBook';
import { SKILL_REACH } from '../shared/data/skillRanges';
import { CLASSES, CLASS_IDS, isLearnable, KIND_NAME, LEARN_KINDS, type SkillDef } from '../shared/data/classes';
import { MAX_LEVEL } from '../shared/formulas';
import type { ClassId } from '../shared/types';
import { constellation, PAD, SIZE } from '../client/skillMap';
import { imgUrl } from '../client/img';

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
const sameValues = (a: SkillValues, b: SkillValues): boolean =>
  SKILL_VALUE_KEYS.every((k) => a[k] === b[k]) && Object.keys(b.params).every((k) => a.params[k] === b.params[k]);

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

  // ---------------------------------------------------------- shared numbers
  const sharedCard = h('div', { class: 'card' });
  const drawShared = (): void => {
    const sc = draft.skills;
    const cs = code.skills;
    const refresh = (): void => { updateSummary(); drawPanel(); };
    const num = (k: keyof typeof SKILL_RANGE, step: number) =>
      h('label', {}, `${SKILL_NUM_NAME[k]} `, numBox(`g.${k}`, SKILL_NUM_NAME[k], () => sc[k], (n) => { sc[k] = n; }, cs[k], SKILL_RANGE[k][0], SKILL_RANGE[k][1], step, refresh));
    const unlockRows = LEARN_KINDS.map((k) => h('div', { class: 'row bal-line' },
      h('span', {}, `เลเวลปลดล็อก${KIND_NAME[k]} (ลำดับที่ 1–${UNLOCK_TIERS[k]}) `),
      ...sc.unlock[k].map((_, i) => numBox(`u.${k}.${i}`, `เลเวลปลดล็อก${KIND_NAME[k]} ลำดับที่ ${i + 1}`, () => sc.unlock[k][i], (n) => { sc.unlock[k][i] = n; }, cs.unlock[k][i], 1, MAX_LEVEL, 1, refresh))));
    sharedCard.replaceChildren(
      h('h2', {}, 'ระบบสกิล: ค่ารวม'),
      h('div', { class: 'muted' }, 'แต้มสกิล = เลเวล (ไม่เกินเลเวลที่ตั้ง) × แต้มต่อเลเวล · เรียนสกิล = แรงก์ 1 ใช้ 1 แต้ม อัปแรงก์ละ 1 แต้ม · คืนแต้มฟรีเมื่อแต้มรวมน้อยกว่าที่ตั้ง หลังจากนั้นเสียทองต่อแต้ม'),
      h('div', { class: 'row bal-line' }, num('pointsPerLevel', 1), num('lastPointLevel', 1), num('maxRank', 1)),
      h('div', { class: 'row bal-line' }, num('freeRefundBelow', 1), num('refundCost', 100)),
      h('div', { class: 'row bal-line' },
        h('label', {}, h('input', { type: 'checkbox', checked: sc.mapZoom, onchange: (e: Event) => { sc.mapZoom = (e.target as HTMLInputElement).checked; updateSummary(); } }), ' ผังสกิลในเกมซูม/เลื่อนได้ (ล้อเมาส์ ปุ่ม +/− นิ้วถ่าง)'),
        num('zoomMin', 5), num('zoomMax', 10)),
      h('div', { class: 'muted' }, 'ซูมคิดเป็น % ของขนาดที่ผังเปิดมาพอดีกรอบ (100 = ขนาดเริ่มต้น) · ปิดสวิตช์ = ผังในเกมพอดีกรอบแบบเดิม ไม่ซูม (ผังในหน้านี้ซูมได้เสมอ)'),
      ...unlockRows,
    );
  };

  // ---------------------------------------------------------- per-skill numbers: the constellation + the editing panel
  const mapCard = h('div', { class: 'card' });
  const wrap = h('div', { class: 'skm-wrap' });
  const panel = h('div', { class: 'skm-panel' });
  const found = h('div', { class: 'skm-found' });
  const changedList = h('div', { class: 'skm-found' });
  let zoom = 1;
  let mapW = 1, mapH = 1, ox = 0, oy = 0;

  const skillById = (id: string): { sk: SkillDef; c: ClassId } | undefined => {
    for (const c of CLASS_IDS) {
      const sk = learnable(c).find((s) => s.id === id);
      if (sk) return { sk, c };
    }
    return undefined;
  };
  const differsFromCode = (id: string): boolean => !sameValues(draft.skills.skills[id], code.skills.skills[id]);
  const unsaved = (id: string): boolean => !sameValues(draft.skills.skills[id], savedB.skills.skills[id]);
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
    const changed = CLASS_IDS.flatMap((c) => learnable(c).filter((sk) => differsFromCode(sk.id)).map((sk) => ({ c, sk })));
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
    const refresh = (): void => { showOut(); markStars(); updateSummary(); };
    const line = sk.line !== undefined ? c.lines[sk.line] : undefined;
    const fields = SKILL_VALUE_KEYS.map((k) => h('label', { class: 'skm-field' }, h('span', {}, SKILL_VALUE_NAME[k]),
      // Buffs and passives reach nothing: no reach box.
      k === 'reach' && !SKILL_REACH[sk.id] ? h('span', { class: 'muted' }, '—')
        : numBox(`s.${sk.id}.${k}`, `${sk.nameTh} ${SKILL_VALUE_NAME[k]}`, () => v[k], (n) => { v[k] = n; }, cv[k], SKILL_VALUE_RANGE[k][0], SKILL_VALUE_RANGE[k][1], k === 'dmg' || k === 'reach' ? 0.05 : k === 'cooldown' ? 0.5 : 1, refresh)));
    // The skill's own numbers (stun, slow, shots...): * grow with เวลาสถานะ/ผลพาสซีฟ %/แรงก์, † (extra damage) with ดาเมจ %/แรงก์.
    const params = Object.entries(sk.params ?? {}).map(([pk, d]) => h('label', { class: 'skm-field' },
      h('span', {}, `${d.nameTh}${d.status ? ' *' : d.dmg ? ' †' : ''} (${d.unit})`),
      numBox(`s.${sk.id}.p.${pk}`, `${sk.nameTh} ${d.nameTh}`, () => v.params[pk], (n) => { v.params[pk] = n; }, cv.params[pk], d.lo, d.hi, COUNT_UNITS.has(d.unit) ? 1 : 0.05, refresh)));
    const backBtn = h('button', { type: 'button', class: 'small', onclick: () => {
      draft.skills.skills[sk.id] = structuredClone(cv);
      for (const k of [...bad.keys()]) if (k.startsWith(`s.${sk.id}.`)) bad.delete(k);
      drawPanel(); markStars(); updateSummary();
    } }, '↺ สกิลนี้กลับเป็นค่าในโค้ด');
    backBtn.disabled = !differsFromCode(sk.id);
    panel.replaceChildren(...[
      h('h3', {}, sk.nameTh),
      h('div', { class: 'muted' }, `${sk.name} · ${KIND_NAME[sk.kind as 'normal']}`, line ? h('span', { style: `color:${line.color}` }, ` · ${line.nameTh}`) : null),
      h('div', { class: 'skm-desc' }, sk.desc),
      h('div', { class: 'skm-fields' }, ...fields),
      params.length ? h('div', { class: 'skm-sub' }, 'ค่าพิเศษ (* = โตตามเวลาสถานะ/ผลพาสซีฟ · † = โตตามดาเมจ)') : null,
      params.length ? h('div', { class: 'skm-fields' }, ...params) : null,
      h('div', { class: 'skm-sub' }, 'ได้จริง (แรงก์ 1 → สูงสุด)'),
      out,
      h('div', { class: 'row' }, backBtn),
    ].filter((x): x is HTMLDivElement | HTMLHeadingElement => !!x));
    showOut();
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
    mapCard.replaceChildren(
      h('h2', {}, 'ค่ารายสกิล'),
      h('div', { class: 'muted' }, 'ค่ารายสกิล: % ต่อแรงก์คิดจากแรงก์ 1 (เช่น ดาเมจ 5% → แรงก์ 10 = ×1.45) · คูลดาวน์ %/แรงก์ ติดลบ = สั้นลง · MP คูณต่อจาก MP สกิล/เลเวลของอาชีพ · เวลาสถานะ = สตัน ช้า ลดเกราะ ไม่รับดาเมจ ดูดเลือด · ระยะ/รัศมี = ระยะยิง/พุ่ง หรือรัศมีรอบตัว (วงระเบิด/วงตกอยู่ในค่าพิเศษ)'),
      tabs,
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
      zoom = Math.min(1, Math.max(ZOOM_MIN, Math.min(w / mapW, hh / mapH)));
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

  box.replaceChildren(fold.toc, sharedCard, mapCard, bar);
  redraw();
  fold.refreshToc();
}
