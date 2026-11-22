// The "เติมเงิน" tab (owner 2026-11-22, docs/systems/topup.md): PromptPay top-up requests waiting for the
// owner, confirm / reject / reverse, the history, the settings (PromptPay number, on/off, expiry, notice:
// owner only) and the close beta refund switch. The packages themselves are set on the "แคชช็อป" tab.
// The server checks everything again (server/admin-topup.ts).
import {
  bahtText, TOPUP_CONFIRMABLE, TOPUP_EXPIRE_HOURS_MAX, TOPUP_NOTICE_DEFAULT, TOPUP_PENDING_MAX, TOPUP_PER_DAY_MAX, TOPUP_STATUS_NAME,
  type AdminTopup, type TopupCfg, type TopupRow,
} from '../shared/topup';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

const fmt = (n: number) => n.toLocaleString('en-US');
const fmtTime = (ms: number | null) => (ms === null ? '' : new Date(ms).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' }));
/** Rows that stay under "รอยืนยัน" after running out / being cancelled (the player may have paid anyway). */
const RECENT_CLOSED_MS = 3 * 24 * 60 * 60 * 1000;

export async function renderTopup(view: HTMLElement, h: H, api: Api): Promise<void> {
  const box = h('div', {}, h('div', { class: 'muted' }, 'กำลังโหลด…'));
  view.append(box);
  let st: AdminTopup;
  try {
    st = await api<AdminTopup>('GET', '/admin/topup');
  } catch (e) {
    box.replaceChildren(h('div', { class: 'msg bad' }, `โหลดไม่สำเร็จ: ${(e as Error).message}`));
    return;
  }
  const msg = h('div', { class: 'msg' });
  const say = (text: string, ok: boolean) => {
    msg.className = ok ? 'msg ok' : 'msg bad';
    msg.textContent = text;
  };
  const run = async (f: () => Promise<AdminTopup>, done: string): Promise<void> => {
    try {
      st = await f();
      draw();
      say(done, true);
    } catch (e) {
      say((e as Error).message, false);
    }
  };

  const act = (r: TopupRow, op: 'confirm' | 'reject' | 'reverse'): void => {
    const n = fmt(r.crystals + r.bonus);
    const text = op === 'confirm'
      ? `ยืนยันคำขอ #${r.id} ของ ${r.username}?\n\nยอด ${bahtText(r.amount)} บาท → ${n} คริสตัล (รวมโบนัส) เข้าบัญชีทันที\n\nกดเมื่อเห็นยอดนี้เข้าในแอปธนาคารจริงแล้วเท่านั้น ห้ามเชื่อสลิป`
      : op === 'reject' ? `ปฏิเสธคำขอ #${r.id} ของ ${r.username} (ยอด ${bahtText(r.amount)} บาท)?`
      : `ย้อนรายการ #${r.id} ของ ${r.username}?\n\nเอา ${n} คริสตัลออกจากบัญชี (ถ้าผู้เล่นใช้ไปแล้วจะย้อนไม่ได้)`;
    if (!confirm(text)) return;
    const done = op === 'confirm' ? `ยืนยัน #${r.id} แล้ว +${n} คริสตัล` : op === 'reject' ? `ปฏิเสธ #${r.id} แล้ว` : `ย้อน #${r.id} แล้ว −${n} คริสตัล`;
    void run(() => api<AdminTopup>('POST', `/admin/topup/${r.id}/${op}`, {}), done);
  };

  const settings = (): HTMLElement => {
    const ro = !st.isOwner;
    const c = st.cfg;
    const open = h('input', { type: 'checkbox', disabled: ro }) as HTMLInputElement;
    open.checked = c.open;
    const pp = h('input', { type: 'text', value: c.promptpay, placeholder: 'เบอร์ 10 หลัก / เลข 13 หลัก', style: 'width:200px', disabled: ro, autocomplete: 'off' }) as HTMLInputElement;
    const num = (v: number, max: number) => h('input', { type: 'number', min: '1', max: String(max), value: String(v), style: 'width:70px', disabled: ro }) as HTMLInputElement;
    const hours = num(c.expireHours, TOPUP_EXPIRE_HOURS_MAX);
    const pending = num(c.maxPending, TOPUP_PENDING_MAX);
    const perDay = num(c.perDay, TOPUP_PER_DAY_MAX);
    const notice = h('textarea', { rows: '6', style: 'width:100%', disabled: ro }) as HTMLTextAreaElement;
    notice.value = c.notice;
    const save = (): void => {
      const cfg: TopupCfg = {
        open: open.checked, promptpay: pp.value.trim(), expireHours: Number(hours.value), maxPending: Number(pending.value),
        perDay: Number(perDay.value), notice: notice.value,
      };
      if (cfg.open !== c.open && !confirm(cfg.open ? 'เปิดการเติม: ผู้เล่นสร้างคำขอและเห็น QR ได้ทันที?' : 'ปิดการเติม: ผู้เล่นสร้างคำขอใหม่ไม่ได้ (คำขอที่ค้างยังยืนยันได้)?')) return;
      void run(() => api<AdminTopup>('POST', '/admin/topup/settings', { cfg, base: st.cfg }), 'บันทึกแล้ว');
    };
    const row = (label: string, input: Node, note = '') => h('div', { style: 'display:flex;gap:8px;align-items:center;margin:4px 0' }, h('span', { style: 'min-width:190px' }, label), input, note ? h('span', { class: 'muted' }, note) : null);
    return h('div', { class: 'card' },
      h('h2', {}, 'ตั้งค่าการเติม'),
      h('div', { class: 'muted' }, 'แพ็กเกจ (บาท + คริสตัล + โบนัส) ตั้งในแท็บ "แคชช็อป" · ผู้เล่นโอนตามยอดที่มีเศษสตางค์ไม่ซ้ำกัน แล้วเจ้าของยืนยันเมื่อเห็นยอดเข้าในแอปธนาคาร (ห้ามเชื่อสลิป) · เลขพร้อมเพย์เก็บใน DB ไม่ลง log/audit (เห็นแค่ 4 ตัวท้าย)'),
      h('label', { style: 'display:block;margin:6px 0' }, open, ' เปิดการเติม (ต้องมีเลขพร้อมเพย์)'),
      row('เลขพร้อมเพย์', pp, st.isOwner ? '' : 'owner เท่านั้น'),
      row('อายุคำขอ (ชั่วโมง)', hours, `1–${TOPUP_EXPIRE_HOURS_MAX} · หมดอายุแล้วยังยืนยันได้ในตารางด้านล่าง`),
      row('คำขอค้างต่อบัญชี', pending, `1–${TOPUP_PENDING_MAX}`),
      row('คำขอใหม่ต่อวันต่อบัญชี', perDay, `1–${TOPUP_PER_DAY_MAX} (กันกดสร้าง/ยกเลิกวน)`),
      h('div', {}, 'ข้อความแจ้งผู้เล่น (หน้าต่างเติม)'), notice,
      ro ? h('div', { class: 'muted' }, 'ดูได้อย่างเดียว (owner เท่านั้นที่แก้ได้)')
        : h('div', { style: 'display:flex;gap:8px;margin-top:6px' },
          h('button', { class: 'primary', onclick: save }, 'บันทึก'),
          h('button', { onclick: () => (notice.value = TOPUP_NOTICE_DEFAULT) }, 'ข้อความเริ่มต้น')),
    );
  };

  const table = (rows: TopupRow[], waiting: boolean): HTMLElement => {
    // An amount shared by two confirmable rows: the bank app alone can't tell which one was paid.
    const dup = new Map<number, number>();
    for (const r of rows) if (TOPUP_CONFIRMABLE.includes(r.status)) dup.set(r.amount, (dup.get(r.amount) ?? 0) + 1);
    const head = ['#', 'สร้างเมื่อ', 'บัญชี', 'ตัวละคร', 'แพ็ก', 'ยอดที่ต้องโอน', 'สถานะ', waiting ? 'หมดอายุ' : 'โดย', ''];
    return h('div', { style: 'overflow-x:auto' }, h('table', {},
      h('tr', {}, ...head.map((t) => h('th', {}, t))),
      ...rows.map((r) => {
        const btns: Node[] = [];
        if (st.canConfirm && TOPUP_CONFIRMABLE.includes(r.status)) {
          btns.push(h('button', { class: 'primary', onclick: () => act(r, 'confirm') }, 'ยืนยัน'), h('button', { onclick: () => act(r, 'reject') }, 'ปฏิเสธ'));
        }
        if (st.canConfirm && r.status === 'confirmed') btns.push(h('button', { onclick: () => act(r, 'reverse') }, 'ย้อน'));
        const warn = (dup.get(r.amount) ?? 0) > 1 ? h('div', { class: 'msg bad', style: 'font-size:11px' }, '⚠ ยอดซ้ำกับอีกรายการ') : null;
        return h('tr', {},
          h('td', {}, String(r.id)), h('td', {}, fmtTime(r.createdAt)), h('td', {}, r.username), h('td', {}, r.charName),
          h('td', {}, `${fmt(r.baht)} บาท → ${fmt(r.crystals)}${r.bonus ? ` + ${fmt(r.bonus)}` : ''}`),
          h('td', {}, h('b', { style: 'font-size:15px' }, `${bahtText(r.amount)} บาท`), warn),
          h('td', {}, TOPUP_STATUS_NAME[r.status]),
          h('td', {}, waiting ? fmtTime(r.expiresAt) : `${r.decidedBy ?? ''} ${fmtTime(r.decidedAt)}`),
          h('td', { style: 'white-space:nowrap' }, ...btns));
      })));
  };

  const refund = (): HTMLElement => {
    const r = st.refund;
    return h('div', { class: 'card' },
      h('h2', {}, 'คืนเพชร close beta'),
      h('div', { class: 'muted' }, 'เปิดแล้ว: บัญชีที่เข้าเกมครั้งถัดไปได้คริสตัลคืนเท่าที่ได้จากการเติมรวมโบนัส (เฉพาะรายการที่ยืนยันก่อนเวลาที่เปิด และไม่ได้ย้อน) ครั้งเดียวต่อบัญชี ลง audit · ล้างข้อมูลเกมก่อนแล้วค่อยเปิด (วิธีอยู่ใน docs/systems/server-ops.md)'),
      h('div', {}, r ? `เปิดอยู่ ตั้งแต่ ${fmtTime(r.at)} โดย ${r.by}` : 'ปิดอยู่'),
      h('div', {}, `คืนแล้ว ${fmt(st.refunded.accounts)} บัญชี รวม ${fmt(st.refunded.crystals)} คริสตัล`),
      st.isOwner ? h('button', {
        class: r ? '' : 'primary',
        onclick: () => {
          if (!confirm(r ? 'ปิดการคืนเพชร? (บัญชีที่ได้แล้วไม่ถูกหัก บัญชีที่ยังไม่ได้จะไม่ได้จนกว่าจะเปิดใหม่)' : 'เปิดคืนเพชร close beta?\n\nล้างข้อมูลเกมแล้วใช่ไหม? ทุกบัญชีที่เคยเติมจะได้คริสตัลคืนตอนเข้าเกมครั้งถัดไป')) return;
          void run(() => api<AdminTopup>('POST', '/admin/topup/refund', { on: !r }), r ? 'ปิดการคืนเพชรแล้ว' : 'เปิดการคืนเพชรแล้ว');
        },
      }, r ? 'ปิดการคืนเพชร' : 'เปิดคืนเพชร close beta') : h('div', { class: 'muted' }, 'owner เท่านั้นที่เปิด/ปิดได้'),
    );
  };

  const draw = (): void => {
    const now = Date.now();
    const waiting = st.rows.filter((r) => r.status === 'pending' || (TOPUP_CONFIRMABLE.includes(r.status) && now - r.createdAt < RECENT_CLOSED_MS));
    const rest = st.rows.filter((r) => !waiting.includes(r));
    box.replaceChildren(
      h('div', { class: 'card' },
        h('h2', {}, `รอยืนยัน (${st.rows.filter((r) => r.status === 'pending').length})`),
        h('div', { class: 'muted' }, `ดูยอดเข้าในแอปธนาคารให้ตรงทุกสตางค์ก่อนกดยืนยัน ห้ามเชื่อสลิป · รายการที่หมดอายุ/ผู้เล่นยกเลิกใน 3 วันยังอยู่ที่นี่ (ยืนยันได้ถ้าเงินเข้าจริง) · ${st.canConfirm ? '' : 'ดูได้อย่างเดียว (ต้องมีสิทธิ์ "ยืนยันการเติมเงิน")'}`),
        waiting.length ? table(waiting, true) : h('div', { class: 'muted' }, 'ไม่มีคำขอรอยืนยัน'),
        h('div', { style: 'margin-top:6px' }, h('button', { onclick: () => void run(() => api<AdminTopup>('GET', '/admin/topup'), 'โหลดใหม่แล้ว') }, 'โหลดใหม่')),
        msg),
      h('div', { class: 'card' },
        h('h2', {}, `ประวัติ (${st.rows.length} รายการล่าสุด)`),
        h('div', {}, `ยืนยันแล้วทั้งหมด ${fmt(st.totals.count)} รายการ · ${bahtText(st.totals.amount)} บาท · ${fmt(st.totals.crystals)} คริสตัลรวมโบนัส`),
        rest.length ? table(rest, false) : h('div', { class: 'muted' }, 'ยังไม่มี')),
      settings(),
      refund(),
    );
  };
  draw();
}
