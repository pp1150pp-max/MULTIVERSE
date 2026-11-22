// The "จัดหน้าจอเกม" tab (src/shared/hudLayout.ts): a mock game screen per device (mouse / touch) with a box for each HUD part
// or window. Drag a box = move it, drag its corner = resize, the list beside it has hide + exact numbers. Work goes into a
// draft on the server; "ดูในเกม" opens the real game with the draft (this admin only), "เผยแพร่" makes it live for everyone.
// The boxes are only where the parts roughly sit by default: the game itself is the truth.
import type { AdminHudLayout } from '../shared/admin';
import {
  HUD_DEVICE_NAME, HUD_DEVICES, HUD_FRAME, HUD_PARTS, HUD_RANGE,
  type HudDevice, type HudLayoutConfig, type HudPartDef, type HudPos,
} from '../shared/hudLayout';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;
type Layer = 'hud' | 'window';

const r1 = (v: number): number => Math.round(v * 10) / 10;
const same = (a: HudLayoutConfig, b: HudLayoutConfig): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Drops zero / default values and empty entries so the draft equals what the server stores. */
function tidy(p: HudPos): HudPos | undefined {
  const o: HudPos = {};
  if (p.x) o.x = r1(p.x);
  if (p.y) o.y = r1(p.y);
  if (p.s && Math.abs(p.s - 1) > 0.001) o.s = Math.round(p.s * 100) / 100;
  if (p.hide) o.hide = true;
  return Object.keys(o).length ? o : undefined;
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
  let base: HudLayoutConfig = structuredClone(state.draft ?? state.published);
  let draft: HudLayoutConfig = structuredClone(base);
  let device: HudDevice = 'desktop';
  let layer: Layer = 'hud';
  let selected: string | null = null;
  const can = state.canEdit;

  const msg = h('div', { class: 'msg' });
  const status = h('div', { class: 'muted' });
  const frame = h('div', { class: 'hl-frame' });
  const list = h('div', { class: 'hl-list' });
  const tabs = h('div', { class: 'row' });
  const saveBtn = h('button', { class: 'primary', disabled: !can }, 'บันทึกร่าง');
  const previewBtn = h('button', {}, '🎮 ดูในเกม (เฉพาะฉัน)');
  const publishBtn = h('button', { disabled: !can }, '📢 เผยแพร่ให้ทุกคน');
  const discardBtn = h('button', { disabled: !can }, 'ทิ้งร่าง');
  const resetBtn = h('button', { disabled: !can }, 'คืนค่าในโค้ดทั้งหมด');

  const pos = (id: string): HudPos => draft[device][id] ?? {};
  const setPos = (id: string, p: HudPos): void => {
    const t = tidy(p);
    if (t) draft[device][id] = t;
    else delete draft[device][id];
  };
  const parts = (): HudPartDef[] => HUD_PARTS.filter((p) => p.box[device] && p.kind === layer);

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
    frame.replaceChildren(...parts().map((p) => {
      const [bx, by, bw, bh] = p.box[device]!;
      const v = pos(p.id);
      const s = v.s ?? 1;
      // Scale around the part's origin corner, like the game does.
      const ox = p.origin.includes('right') ? 1 : p.origin.includes('left') ? 0 : 0.5;
      const oy = p.origin.includes('bottom') ? 1 : p.origin.includes('top') ? 0 : 0.5;
      const left = bx + (v.x ?? 0) + bw * (1 - s) * ox;
      const top = by + (v.y ?? 0) + bh * (1 - s) * oy;
      const el = h('div', {
        class: `hl-box${p.kind === 'window' ? ' hl-win' : ''}${v.hide ? ' hl-off' : ''}${selected === p.id ? ' hl-sel' : ''}${draft[device][p.id] ? ' hl-changed' : ''}`,
        style: `left:${left}%;top:${top}%;width:${bw * s}%;height:${bh * s}%`,
        title: p.label,
      }, h('span', {}, p.label + (v.hide ? ' (ซ่อน)' : '')));
      const grip = h('div', { class: 'hl-grip', title: 'ลากเพื่อย่อ/ขยาย' });
      if (can) el.append(grip);
      el.onpointerdown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        selected = p.id;
        const resize = e.target === grip;
        const fr = frame.getBoundingClientRect();
        const start = { x: e.clientX, y: e.clientY, p: { ...pos(p.id) } };
        if (!can) return draw();
        el.setPointerCapture(e.pointerId);
        el.classList.add('hl-sel');
        el.onpointermove = (m) => {
          const dx = ((m.clientX - start.x) / fr.width) * 100;
          const dy = ((m.clientY - start.y) / fr.height) * 100;
          const n = { ...start.p };
          if (resize) {
            // Grow by how far the corner moved compared with the box's width.
            const s0 = start.p.s ?? 1;
            const sign = ox === 1 ? -1 : 1;
            n.s = Math.min(HUD_RANGE.sMax, Math.max(HUD_RANGE.sMin, s0 + (sign * dx) / bw));
          } else {
            n.x = Math.max(-HUD_RANGE.move, Math.min(HUD_RANGE.move, (start.p.x ?? 0) + dx));
            n.y = Math.max(-HUD_RANGE.move, Math.min(HUD_RANGE.move, (start.p.y ?? 0) + dy));
          }
          setPos(p.id, n);
          drawFrame();
          drawStatus();
        };
        el.onpointerup = () => {
          el.onpointermove = null;
          draw();
        };
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
          h('button', { title: 'กลับเป็นค่าในโค้ด', disabled: !can || !draft[device][p.id], onclick: () => { setPos(p.id, {}); draw(); } }, '↺'),
        );
        return row;
      }),
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
    drawStatus();
  };

  const send = async (body: unknown, ok: string): Promise<boolean> => {
    try {
      state = await api<AdminHudLayout>('POST', '/admin/hud-layout', body);
      base = structuredClone(state.draft ?? state.published);
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
    status, msg,
  );
}
