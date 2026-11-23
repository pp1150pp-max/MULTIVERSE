// The "จัดหน้าจอเกม" tab (src/shared/hudLayout.ts): a mock game screen per device (mouse / touch) with a box for each HUD part
// or window. Drag a box = move it, drag its corner = resize, the list beside it has hide + exact numbers. Work goes into a
// draft on the server; "ดูในเกม" opens the real game with the draft (this admin only), "เผยแพร่" makes it live for everyone.
// The boxes are only where the parts roughly sit by default: the game itself is the truth.
import type { AdminHudLayout } from '../shared/admin';
import {
  FREE_BTN_START, HUD_DEVICE_NAME, HUD_DEVICES, HUD_FRAME, HUD_PARTS, HUD_RANGE, hudPart, isFreeBtnPart,
  type HudDevice, type HudLayoutConfig, type HudPartDef, type HudPos,
} from '../shared/hudLayout';
import { freeBtnDomId, type MenuLayoutConfig } from '../shared/menuLayout';
import type { AdminMenuLayout } from '../shared/admin';
import type { HudMockApi } from '../client/hudMock';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;
type Layer = 'hud' | 'window';

const r1 = (v: number): number => Math.round(v * 10) / 10;
const same = (a: HudLayoutConfig, b: HudLayoutConfig): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Drops zero / default values and empty entries so the draft equals what the server stores (a floating button's entry stays: "placed"). */
function tidy(p: HudPos, keep = false): HudPos | undefined {
  const o: HudPos = {};
  if (p.x) o.x = r1(p.x);
  if (p.y) o.y = r1(p.y);
  if (p.s && Math.abs(p.s - 1) > 0.001) o.s = Math.round(p.s * 100) / 100;
  if (p.hide) o.hide = true;
  return Object.keys(o).length || keep ? o : undefined;
}

export async function renderHudLayout(view: HTMLElement, h: H, api: Api): Promise<void> {
  const box = h('div', {}, h('div', { class: 'muted' }, 'กำลังโหลด…'));
  view.append(box);
  let state: AdminHudLayout;
  try {
    state = await api<AdminHudLayout>('GET', '/admin/hud-layout');
  } catch (e) {
    box.replaceChildren(h('div', { class: 'msg bad' }, `โหลดไม่สำเร็จ: ${(e as Error).message}`));
    return;
  }
  /** What the server's draft holds (or, with no draft, what is published): the "unsaved" mark compares to this. */
  /** Floating shortcut buttons deleted (or no longer floating) in "จัดเมนูเกม" leave the layout here; the next save stores that. */
  const dropGone = (c: HudLayoutConfig): HudLayoutConfig => {
    const live = new Set(state.freeButtons.map((b) => freeBtnDomId(b.id)));
    for (const d of HUD_DEVICES) for (const id of Object.keys(c[d])) if (isFreeBtnPart(id) && !live.has(id)) delete c[d][id];
    return c;
  };
  let base: HudLayoutConfig = dropGone(structuredClone(state.draft ?? state.published));
  let draft: HudLayoutConfig = structuredClone(base);
  let device: HudDevice = 'desktop';
  let layer: Layer = 'hud';
  let selected: string | null = null;
  const can = state.canEdit;

  const msg = h('div', { class: 'msg' });
  const status = h('div', { class: 'muted' });
  const frame = h('div', { class: 'hl-frame' });
  /** The boxes, laid over the live HUD example. */
  const boxLayer = h('div', { class: 'hl-boxes' });
  frame.append(boxLayer);

  // The real game page as a HUD example under the boxes (/?hudMock=1, src/client/hudMock.ts), one per device, made
  // when first shown. The boxes then sit where each part really is (measured from it), and the example moves with
  // every drag. Until it is ready (or if it fails) the boxes use the rough spots in HUD_PARTS.
  const mocks: Partial<Record<HudDevice, { frame: HTMLIFrameElement; api: HudMockApi | null }>> = {};
  let menuLayout: MenuLayoutConfig | null = null;
  void api<AdminMenuLayout>('GET', '/admin/menu-layout').then((m) => {
    menuLayout = m.layout;
    for (const d of HUD_DEVICES) mocks[d]?.api?.setMenu(m.layout);
    draw();
  }).catch(() => { /* no menu-layout tool: the code's buttons */ });
  const live = (): HudMockApi | null => mocks[device]?.api ?? null;
  const fitMocks = (): void => {
    for (const d of HUD_DEVICES) {
      const m = mocks[d];
      if (m) m.frame.style.transform = `scale(${frame.clientWidth / HUD_FRAME[d].w})`;
    }
  };
  new ResizeObserver(fitMocks).observe(frame);
  const showMock = (): void => {
    if (!mocks[device]) {
      const F = HUD_FRAME[device];
      const d = device;
      const el = h('iframe', { class: 'hl-mock', src: `/?hudMock=1&device=${d}`, title: 'ตัวอย่างหน้าจอเกม', tabindex: '-1' });
      el.style.width = `${F.w}px`;
      el.style.height = `${F.h}px`;
      const m = { frame: el, api: null as HudMockApi | null };
      mocks[d] = m;
      el.onload = () => {
        // The page sets window.hudMock once its HUD is drawn.
        let tries = 0;
        const wait = (): void => {
          const a = (el.contentWindow as (Window & { hudMock?: HudMockApi }) | null)?.hudMock;
          if (!a) {
            if (++tries < 50) setTimeout(wait, 100);
            return;
          }
          m.api = a;
          if (menuLayout) a.setMenu(menuLayout);
          draw();
        };
        wait();
      };
      frame.prepend(el);
      fitMocks();
    }
    for (const d of HUD_DEVICES) mocks[d]?.frame.classList.toggle('hidden', d !== device);
  };
  const list = h('div', { class: 'hl-list' });
  const history = h('details', { class: 'card' });
  const tabs = h('div', { class: 'row' });
  const saveBtn = h('button', { class: 'primary', disabled: !can }, 'บันทึกร่าง');
  const previewBtn = h('button', {}, '🎮 ดูในเกม (เฉพาะฉัน)');
  const publishBtn = h('button', { disabled: !can }, '📢 เผยแพร่ให้ทุกคน');
  const discardBtn = h('button', { disabled: !can }, 'ทิ้งร่าง');
  const resetBtn = h('button', { disabled: !can }, 'คืนค่าในโค้ดทั้งหมด');

  const pos = (id: string): HudPos => draft[device][id] ?? {};
  const setPos = (id: string, p: HudPos): void => {
    const t = tidy(p, isFreeBtnPart(id));
    if (t) draft[device][id] = t;
    else delete draft[device][id];
  };
  /** The floating shortcut buttons as parts (named after the button). */
  const freeParts = (): HudPartDef[] => state.freeButtons.map((b) => ({ ...hudPart(freeBtnDomId(b.id))!, label: `ปุ่มลัด: ${b.label}` }));
  /** What this device / layer shows: the code's parts, plus the floating buttons placed on this device. */
  const parts = (): HudPartDef[] => [
    ...HUD_PARTS.filter((p) => p.box[device] && p.kind === layer),
    ...(layer === 'hud' ? freeParts().filter((p) => draft[device][p.id]) : []),
  ];

  const drawStatus = (): void => {
    const dirty = !same(draft, base);
    const pub = same(state.draft ?? state.published, state.published);
    status.textContent = [
      state.draft ? `มีร่างบนเซิร์ฟ${state.draftBy ? ` (บันทึกโดย ${state.draftBy}${state.draftAt ? ` ${new Date(state.draftAt).toLocaleString('th-TH')}` : ''})` : ''}${pub ? ' — เหมือนที่เผยแพร่อยู่' : ' — ยังไม่ได้เผยแพร่'}` : 'ไม่มีร่าง (กำลังแก้จากค่าที่เผยแพร่อยู่)',
      dirty ? '· มีการแก้ที่ยังไม่บันทึกร่าง' : '',
    ].join(' ');
    publishBtn.disabled = !can || !state.draft || dirty;
    discardBtn.disabled = !can || (!state.draft && !dirty);
  };

  /** The mock screen: one box per part of this layer, moved and scaled as the draft says. */
  const drawFrame = (): void => {
    const F = HUD_FRAME[device];
    frame.style.aspectRatio = `${F.w} / ${F.h}`;
    showMock();
    const mock = live();
    mock?.setLayer(layer);
    mock?.setLayout(draft);
    frame.classList.toggle('hl-live', !!mock);
    boxLayer.replaceChildren(...parts().map((p) => {
      const [bx, by, bw, bh] = p.box[device]!;
      const v = pos(p.id);
      // Scale around the part's origin corner, like the game does.
      const ox = p.origin.includes('right') ? 1 : p.origin.includes('left') ? 0 : 0.5;
      const oy = p.origin.includes('bottom') ? 1 : p.origin.includes('top') ? 0 : 0.5;
      const place = (el: HTMLElement, q: HudPos): void => {
        // Where the part really is in the example (the layout already applied), else the rough spot.
        const r = live()?.rect(p.id);
        if (r) {
          el.style.left = `${r.x}%`;
          el.style.top = `${r.y}%`;
          el.style.width = `${r.w}%`;
          el.style.height = `${r.h}%`;
          return;
        }
        const s = q.s ?? 1;
        el.style.left = `${bx + (q.x ?? 0) + bw * (1 - s) * ox}%`;
        el.style.top = `${by + (q.y ?? 0) + bh * (1 - s) * oy}%`;
        el.style.width = `${bw * s}%`;
        el.style.height = `${bh * s}%`;
      };
      const el = h('div', {
        class: `hl-box${p.kind === 'window' ? ' hl-win' : ''}${v.hide ? ' hl-off' : ''}${selected === p.id ? ' hl-sel' : ''}${draft[device][p.id] ? ' hl-changed' : ''}`,
        title: p.label,
      }, h('span', {}, p.label + (v.hide ? ' (ซ่อน)' : '')));
      place(el, v);
      // The grip sits on the corner away from the anchor, so the box grows towards the pointer.
      const gx = ox === 1 ? 'left' : 'right';
      const gy = oy === 1 ? 'top' : 'bottom';
      const grip = h('div', { class: `hl-grip hl-grip-${gy}-${gx}`, title: 'ลากเพื่อย่อ/ขยาย' });
      if (can) el.append(grip);
      el.onpointerdown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        selected = p.id;
        const resize = e.target === grip;
        const fr = frame.getBoundingClientRect();
        const start = { x: e.clientX, y: e.clientY, p: { ...pos(p.id) } };
        // The part's width at size 100%: measured in the example when there is one.
        const r0 = live()?.rect(p.id);
        const baseW = r0 ? r0.w / (start.p.s ?? 1) : bw;
        if (!can) return draw();
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* pointer already gone */
        }
        el.classList.add('hl-sel');
        // Only this box moves while dragging (redrawing the frame would drop the pointer capture); the rest redraws on release.
        el.onpointermove = (m) => {
          const dx = ((m.clientX - start.x) / fr.width) * 100;
          const dy = ((m.clientY - start.y) / fr.height) * 100;
          const n = { ...start.p };
          if (resize) {
            // Grow by how far the corner moved compared with the box's width.
            const s0 = start.p.s ?? 1;
            const sign = ox === 1 ? -1 : 1;
            n.s = Math.min(HUD_RANGE.sMax, Math.max(HUD_RANGE.sMin, s0 + (sign * dx) / baseW));
          } else {
            n.x = Math.max(-HUD_RANGE.move, Math.min(HUD_RANGE.move, (start.p.x ?? 0) + dx));
            n.y = Math.max(-HUD_RANGE.move, Math.min(HUD_RANGE.move, (start.p.y ?? 0) + dy));
          }
          setPos(p.id, n);
          live()?.setLayout(draft);
          place(el, pos(p.id));
          drawStatus();
        };
        const end = (): void => {
          el.onpointermove = null;
          el.onpointerup = null;
          el.onpointercancel = null;
          draw();
        };
        el.onpointerup = end;
        el.onpointercancel = end;
      };
      return el;
    }));
  };

  const num = (id: string, k: 'x' | 'y' | 's', p: HudPartDef): HTMLInputElement => {
    const v = pos(id);
    const val = k === 's' ? Math.round((v.s ?? 1) * 100) : (v[k] ?? 0);
    const inp = h('input', { type: 'number', step: k === 's' ? '5' : '0.5', value: String(val), disabled: !can, class: 'hl-num', title: k === 's' ? 'ขนาด %' : k === 'x' ? 'เลื่อนซ้าย/ขวา (% ของความกว้างจอ)' : 'เลื่อนขึ้น/ลง (% ของความสูงจอ)' });
    inp.onchange = () => {
      const n = Number(inp.value);
      if (!Number.isFinite(n)) return;
      const cur = { ...pos(id) };
      if (k === 's') cur.s = Math.min(HUD_RANGE.sMax, Math.max(HUD_RANGE.sMin, n / 100));
      else cur[k] = Math.max(-HUD_RANGE.move, Math.min(HUD_RANGE.move, n));
      setPos(id, cur);
      selected = p.id;
      draw();
    };
    return inp;
  };

  const drawList = (): void => {
    list.replaceChildren(
      h('div', { class: 'hl-head' }, h('span', {}, 'ส่วน'), h('span', {}, 'X %'), h('span', {}, 'Y %'), h('span', {}, 'ขนาด %'), h('span', {}, 'ซ่อน'), h('span', {})),
      ...parts().map((p) => {
        const v = pos(p.id);
        const keep = p.kind === 'window' || p.keep?.includes(device);
        const hide = h('input', { type: 'checkbox', checked: !!v.hide, disabled: !can || keep, title: p.kind === 'window' ? 'หน้าต่างซ่อนไม่ได้ (ผู้เล่นเปิดเอง)' : keep ? p.why ?? 'ซ่อนไม่ได้' : 'ซ่อนส่วนนี้' });
        hide.onchange = () => {
          setPos(p.id, { ...pos(p.id), hide: hide.checked ? true : undefined });
          selected = p.id;
          draw();
        };
        const row = h('div', { class: `hl-row${selected === p.id ? ' hl-sel' : ''}${draft[device][p.id] ? ' hl-changed' : ''}` },
          h('span', { class: 'hl-name', onclick: () => { selected = p.id; draw(); } }, p.label),
          num(p.id, 'x', p), num(p.id, 'y', p), num(p.id, 's', p), hide,
          isFreeBtnPart(p.id)
            ? h('button', { title: 'เอาปุ่มนี้ออกจากจอนี้ (ผู้เล่นจะไม่เห็นบนจอนี้)', disabled: !can, onclick: () => { delete draft[device][p.id]; selected = null; draw(); } }, '🗑')
            : h('button', { title: 'กลับเป็นค่าในโค้ด', disabled: !can || !draft[device][p.id], onclick: () => { setPos(p.id, {}); draw(); } }, '↺'),
        );
        return row;
      }),
      ...(layer === 'hud' ? freeParts().filter((p) => !draft[device][p.id]).map((p) => h('div', { class: 'hl-row' },
        h('span', { class: 'hl-name muted' }, `${p.label} (ยังไม่วางบนจอนี้)`),
        h('button', { disabled: !can, onclick: () => { setPos(p.id, { ...FREE_BTN_START[device] }); selected = p.id; draw(); } }, '+ วางบนจอนี้'),
      )) : []),
      ...(layer === 'hud' && !state.freeButtons.length ? [h('div', { class: 'muted' }, 'ยังไม่มีปุ่มลัดวางอิสระ (เพิ่มได้ที่แท็บ "จัดเมนูเกม" → ปุ่มลัด → ติ๊ก "วางอิสระบนจอ")')] : []),
    );
  };

  /** Versions made live before (publish / reset): any of them can come back as the draft. */
  const drawHistory = (): void => {
    const what = { publish: 'เผยแพร่', reset: 'คืนค่าในโค้ด', before: 'ที่ใช้อยู่ก่อนมีประวัติ' } as const;
    const live = JSON.stringify(state.published);
    history.replaceChildren(
      h('summary', {}, `ประวัติที่เคยเผยแพร่ (${state.history.length}/20) — ย้อนกลับได้`),
      h('div', { class: 'muted' }, 'กด "ย้อนเป็นฉบับนี้" = ฉบับนั้นกลายเป็นร่าง (ทับร่างเดิม) ดูในเกมก่อนแล้วค่อยกดเผยแพร่ · เก็บ 20 ฉบับล่าสุด'),
      ...(state.history.length ? state.history.map((v) => h('div', { class: 'hl-hist' },
        h('span', {}, new Date(v.at).toLocaleString('th-TH')),
        h('span', { class: 'muted' }, `${what[v.what]}${v.by ? ` โดย ${v.by}` : ''}${JSON.stringify(v.layout) === live ? ' · ใช้อยู่ตอนนี้' : ''}`),
        h('button', { disabled: !can, onclick: () => confirm('เอาฉบับนี้มาเป็นร่าง? (ร่างเดิมและการแก้ที่ยังไม่บันทึกจะหาย ผู้เล่นยังไม่เห็นจนกว่าจะกดเผยแพร่)') && void send({ restore: v.at }, 'ย้อนเป็นร่างแล้ว — กด "ดูในเกม" เพื่อตรวจ แล้วกดเผยแพร่') }, 'ย้อนเป็นฉบับนี้'),
      )) : [h('div', { class: 'muted' }, 'ยังไม่มี (เริ่มเก็บตั้งแต่การเผยแพร่ครั้งถัดไป)')]),
    );
  };

  const drawTabs = (): void => {
    tabs.replaceChildren(
      ...HUD_DEVICES.map((d) => h('button', { class: d === device ? 'primary' : '', onclick: () => { device = d; selected = null; draw(); } }, HUD_DEVICE_NAME[d])),
      h('span', { class: 'muted' }, ' · '),
      ...(['hud', 'window'] as const).map((l) => h('button', { class: l === layer ? 'primary' : '', onclick: () => { layer = l; selected = null; draw(); } }, l === 'hud' ? 'HUD' : 'หน้าต่าง')),
    );
  };

  const draw = (): void => {
    drawTabs();
    drawFrame();
    drawList();
    drawHistory();
    drawStatus();
  };

  const send = async (body: unknown, ok: string): Promise<boolean> => {
    try {
      state = await api<AdminHudLayout>('POST', '/admin/hud-layout', body);
      base = dropGone(structuredClone(state.draft ?? state.published));
      draft = structuredClone(base);
      msg.className = 'msg ok';
      msg.textContent = ok;
      draw();
      return true;
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
      return false;
    }
  };
  saveBtn.onclick = () => void send({ draft }, 'บันทึกร่างแล้ว (ผู้เล่นยังไม่เห็น)');
  previewBtn.onclick = async () => {
    // Unsaved edits go into the draft first, so the game shows what is on screen here.
    if (can && !same(draft, base) && !(await send({ draft }, 'บันทึกร่างแล้ว — เปิดเกมในแท็บใหม่'))) return;
    window.open(`${location.origin}/?previewHud=1`, '_blank');
  };
  publishBtn.onclick = () => confirm('เผยแพร่ร่างนี้ให้ผู้เล่นทุกคน? (ผู้เล่นที่ออนไลน์เห็นทันที)') && void send({ publish: true }, 'เผยแพร่แล้ว — ผู้เล่นที่ออนไลน์เห็นทันที');
  discardBtn.onclick = () => confirm('ทิ้งร่างและการแก้ที่ยังไม่บันทึก?') && void send({ discard: true }, 'ทิ้งร่างแล้ว');
  resetBtn.onclick = () => confirm('คืนทุกส่วนเป็นค่าในโค้ด ทั้งจอคอมและจอสัมผัส ให้ผู้เล่นทุกคนทันที? (ร่างจะถูกทิ้งด้วย)') && void send({ reset: true }, 'คืนค่าในโค้ดแล้ว');

  draw();
  box.replaceChildren(
    h('div', { class: 'card' },
      h('h2', {}, 'จัดหน้าจอเกม'),
      h('div', { class: 'muted' }, 'ลากกล่องเพื่อย้าย · ลากมุมล่าง (จุดสีทอง) เพื่อย่อ/ขยาย 50–200% · ติ๊ก "ซ่อน" ในรายการ · จอคอมกับจอสัมผัสตั้งแยกกัน · ตัวเลขเป็น % ของจอ จึงใช้ได้ทุกขนาดจอ · กล่องในภาพจำลองเป็นตำแหน่งคร่าว ๆ ให้กด "ดูในเกม" เพื่อดูของจริง · หน้าต่างที่ผู้เล่นลากเองยังลากได้ (ดับเบิลคลิกแถบหัว = กลับที่ที่ตั้งไว้ที่นี่)'),
      can ? null : h('div', { class: 'msg bad' }, 'บัญชีนี้ดูได้อย่างเดียว (ไม่มีสิทธิ์ "แก้จัดหน้าจอเกม") แต่ "ดูในเกม" ได้'),
      h('details', {}, h('summary', {}, 'ส่วนที่ซ่อนไม่ได้'), h('ul', {}, ...HUD_PARTS.filter((p) => p.keep).map((p) => h('li', {}, `${p.label}: ${p.why}`)), h('li', {}, 'หน้าต่างทุกบาน: ผู้เล่นเปิดเอง จึงย้าย/ย่อขยายได้อย่างเดียว'))),
      tabs,
    ),
    h('div', { class: 'hl-wrap' }, frame, list),
    h('div', { class: 'row' }, saveBtn, previewBtn, publishBtn, discardBtn, resetBtn),
    status, msg, history,
  );
}
