// The "กล่องปริศนา" tab (owner 2026-11-22, rules: docs/systems/mystery-box.md): switch the box on, its drop
// chances, and every row of what is inside (on/off, % or "share the rest", amount, server-wide banner). The real
// chance of each row per box is worked out live as you type (boxOdds, the same as the server rolls with).
// Only what differs from the code is stored; saving needs mysteryBoxEdit (owner), looking mysteryBox.
import {
  BOX_COUNT_MAX, BOX_DEFAULTS, BOX_DROP_PCT_MAX, BOX_GOLD_MAX, BOX_ROWS, boxConfig, boxOdds, cleanBoxOverrides, fmtPct,
  type AdminBox, type BoxOverrides, type BoxRowOverride,
} from '../shared/mysteryBox';
import { can } from './core';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

export async function renderMysteryBox(view: HTMLElement, h: H, api: Api): Promise<void> {
  const box = h('div', {}, h('div', { class: 'muted' }, 'กำลังโหลด…'));
  view.append(box);
  let state: AdminBox;
  try {
    state = await api<AdminBox>('GET', '/admin/mystery-box');
  } catch (e) {
    box.replaceChildren(h('div', { class: 'msg bad' }, `โหลดไม่สำเร็จ: ${(e as Error).message}`));
    return;
  }
  const edit = can('mysteryBoxEdit');
  const msg = h('div', { class: 'msg' });
  const sum = h('div', { class: 'muted' });

  const draw = (): void => {
    const cfg = boxConfig(state.overrides);
    const enabled = h('input', { type: 'checkbox', checked: cfg.enabled, disabled: !edit });
    const inShop = h('input', { type: 'checkbox', checked: cfg.orbsInShop, disabled: !edit });
    const mob = h('input', { type: 'number', min: '0', max: String(BOX_DROP_PCT_MAX), step: 'any', value: String(cfg.mobPct), style: 'width:80px', disabled: !edit });
    const boss = h('input', { type: 'number', min: '0', max: String(BOX_DROP_PCT_MAX), step: 'any', value: String(cfg.bossPct), style: 'width:80px', disabled: !edit });

    type RowEls = { id: string; on: HTMLInputElement; share: HTMLInputElement; pct: HTMLInputElement; count: HTMLInputElement | null; announce: HTMLInputElement; real: HTMLElement; tr: HTMLElement };
    const els: RowEls[] = [];
    const table = h('table', {}, h('tr', {},
      h('th', {}, 'ใส่ในกล่อง'), h('th', {}, 'ของ'), h('th', {}, 'โอกาสที่ตั้ง %'), h('th', {}, 'แบ่งส่วนที่เหลือ'),
      h('th', {}, 'จำนวน'), h('th', {}, 'ประกาศทั้งเซิร์ฟ'), h('th', {}, 'โอกาสจริงต่อกล่อง'), h('th', {}, 'ค่าในโค้ด')));
    cfg.rows.forEach((r, i) => {
      const def = BOX_ROWS[i];
      const on = h('input', { type: 'checkbox', checked: r.on, disabled: !edit });
      const share = h('input', { type: 'checkbox', checked: r.pct === null, disabled: !edit });
      const pct = h('input', { type: 'number', min: '0', max: '100', step: 'any', value: r.pct === null ? '' : String(r.pct), style: 'width:80px', disabled: !edit || r.pct === null });
      const gold = r.prize.kind === 'gold';
      const count = r.prize.kind === 'gear' ? null
        : h('input', { type: 'number', min: '1', max: String(gold ? BOX_GOLD_MAX : BOX_COUNT_MAX), value: String(r.count), style: gold ? 'width:110px' : 'width:60px', disabled: !edit });
      const announce = h('input', { type: 'checkbox', checked: r.announce, disabled: !edit });
      const real = h('td', {});
      const name = r.prize.kind === 'orb' ? `${r.name} · ตอนนี้ ${state.orbs.length} ลูก` : r.name;
      const unit = gold ? ' G' : '';
      const defText = `${def.on ? '' : 'ปิด · '}${def.pct === null ? 'แบ่งส่วนที่เหลือ' : `${def.pct}%`}${def.prize.kind === 'gear' ? '' : ` · ${def.count.toLocaleString()}${unit}`}${def.announce ? ' · ประกาศ' : ''}`;
      const tr = h('tr', {}, h('td', {}, on), h('td', {}, name), h('td', {}, pct), h('td', {}, share), h('td', {}, count ?? '1 ชิ้น'), h('td', {}, announce), real, h('td', { class: 'muted' }, defText));
      share.onchange = () => {
        pct.disabled = !edit || share.checked;
        if (!share.checked && pct.value === '') pct.value = '0';
        update();
      };
      for (const x of [on, pct, count, announce]) if (x) x.oninput = x.onchange = update;
      els.push({ id: r.id, on, share, pct, count, announce, real, tr });
      table.append(tr);
    });
    for (const x of [enabled, inShop, mob, boss]) x.oninput = x.onchange = update;

    /** The page's values as overrides (cleaned like the server does), or a Thai error. */
    function read(): BoxOverrides | string {
      const rows: Record<string, BoxRowOverride> = {};
      for (const e of els) {
        const o: BoxRowOverride = { on: e.on.checked, announce: e.announce.checked, pct: e.share.checked ? null : Number(e.pct.value) };
        if (e.count) o.count = Number(e.count.value);
        rows[e.id] = o;
      }
      return cleanBoxOverrides({ enabled: enabled.checked, orbsInShop: inShop.checked, mobPct: Number(mob.value), bossPct: Number(boss.value), rows });
    }

    function update(): void {
      const o = read();
      if (typeof o === 'string') {
        sum.className = 'msg bad';
        sum.textContent = o;
        return;
      }
      const c = boxConfig(o);
      const odds = boxOdds(c, state.orbs.length);
      const by = new Map(odds.map((x) => [x.row.id, x.pct]));
      for (const e of els) {
        const p = by.get(e.id);
        e.real.textContent = p === undefined ? '—' : `${fmtPct(p)} (1 ใน ${Math.round(100 / p).toLocaleString()})`;
        e.tr.style.opacity = p === undefined ? '0.5' : '';
      }
      const fixed = c.rows.filter((r) => r.on && r.pct !== null && (r.prize.kind !== 'orb' || state.orbs.length)).reduce((a, r) => a + (r.pct ?? 0), 0);
      const shares = c.rows.filter((r) => r.on && r.pct === null).length;
      const total = odds.reduce((a, x) => a + x.pct, 0);
      sum.className = 'muted';
      sum.textContent = `ตั้งไว้รวม ${fmtPct(fixed)} · ส่วนที่เหลือ ${fmtPct(Math.max(0, 100 - fixed))} แบ่ง ${shares} แถว · รวมจริง ${fmtPct(total)}`
        + (shares ? '' : ' · ไม่มีแถว "แบ่งส่วนที่เหลือ": ย่อ/ขยายทุกแถวให้รวมเป็น 100%')
        + (state.orbs.length ? '' : ' · ตอนนี้ไม่มีลูกแก้วที่ออกได้ (ซ่อนหมดหรือยังไม่มี) แถวลูกแก้วจึงไม่นับ');
    }

    const save = async (overrides: BoxOverrides): Promise<void> => {
      try {
        state = await api<AdminBox>('POST', '/admin/mystery-box', { overrides, base: state.overrides });
        draw();
        msg.className = 'msg ok';
        msg.textContent = 'บันทึกแล้ว — มีผลทันที';
      } catch (e) {
        msg.className = 'msg bad';
        msg.textContent = (e as Error).message;
      }
    };
    const saveBtn = h('button', { class: 'primary', disabled: !edit, onclick: () => {
      const o = read();
      if (typeof o === 'string') {
        msg.className = 'msg bad';
        msg.textContent = o;
        return;
      }
      void save(o);
    } }, 'บันทึก');
    const resetBtn = h('button', { disabled: !edit, onclick: () => confirm('คืนค่ากล่องปริศนาทั้งหมดเป็นค่าในโค้ด?') && void save({}) }, 'คืนค่าในโค้ดทั้งหมด');

    box.replaceChildren(h('div', { class: 'card' },
      h('h2', {}, 'กล่องปริศนา'),
      h('div', { class: 'muted' }, 'มอนและบอสดรอปกล่อง ผู้เล่นคลิกเปิดในกระเป๋า (คลิกขวา = เปิดทั้งกอง) server เป็นคนสุ่ม · ใบคูณดรอป ×2 มีผลกับโอกาสดรอป · ค่าที่ต่างจากโค้ดเท่านั้นที่ถูกเก็บ'),
      h('div', { style: 'display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:8px 0' },
        h('label', {}, enabled, ' เปิดกล่อง (มอน/บอสดรอป และเปิดได้)'),
        h('label', {}, 'ดรอปจากมอน ', mob, ' %'),
        h('label', {}, 'ดรอปจากบอส (ต่อกุญแจ) ', boss, ' %'),
        h('label', {}, inShop, ' ขายลูกแก้วในแคชช็อปด้วย (ปิด = ขึ้นป้าย "เปิดได้จากกล่องปริศนา")')),
      h('div', { class: 'muted' }, `ค่าในโค้ด: ${BOX_DEFAULTS.enabled ? 'เปิด' : 'ปิด'} · มอน ${BOX_DEFAULTS.mobPct}% · บอส ${BOX_DEFAULTS.bossPct}% · ${BOX_DEFAULTS.orbsInShop ? 'ขายลูกแก้ว' : 'ไม่ขายลูกแก้ว'}`),
      table, sum,
      h('div', { style: 'display:flex;gap:8px;margin-top:8px' }, saveBtn, resetBtn), msg));
    update();
  };
  draw();
}
