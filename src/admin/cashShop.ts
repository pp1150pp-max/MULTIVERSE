// The "แคชช็อป" tab (owner 2026-11-15, docs/systems/cash-shop.md): open / close sales, every item's
// settings (on sale, price, sale price, per-account limit, sale window in Thai time, corner badge, แนะนำ),
// the top-up packages shown as "เร็วๆ นี้", and the newest purchases. Cosmetic prices are the ones of the
// "จัดการของแต่งตัว" tab (saved there too). The server checks everything again (server/admin-cash.ts).
import {
  CASH_LIMIT_MAX, CASH_PRICE_MAX, CASH_STONE_PRICE, CASH_STONES, CURRENCY, cashItemName, cosItemId, stoneItemId,
  type AdminCashShop, type CashBadge, type CashItemCfg, type CashPackage, type CashShopCfg,
} from '../shared/cashShop';
import { COSMETICS, COS_SLOTS, COS_SLOT_NAME } from '../shared/data/cosmetics';
import { registerOrbItems } from '../shared/orbItems';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

const TH_MS = 7 * 60 * 60 * 1000;
/** ms → the datetime-local value in Thai time (UTC+7, no daylight saving). */
const toLocal = (ms: number | undefined) => (ms === undefined ? '' : new Date(ms + TH_MS).toISOString().slice(0, 16));
/** A datetime-local value typed as Thai time → ms (NaN if not a date). */
const fromLocal = (v: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - TH_MS : NaN;
};
const fmt = (n: number) => n.toLocaleString('en-US');
const fmtTime = (ms: number) => new Date(ms).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' });

interface Row {
  id: string;
  cos: string | null;
  sell: HTMLInputElement;
  price: HTMLInputElement;
  sale: HTMLInputElement;
  limit: HTMLInputElement | null;
  start: HTMLInputElement;
  end: HTMLInputElement;
  badge: HTMLSelectElement;
  featured: HTMLInputElement;
}

export async function renderCashShop(view: HTMLElement, h: H, api: Api): Promise<void> {
  const box = h('div', {}, h('div', { class: 'muted' }, 'กำลังโหลด…'));
  view.append(box);
  let st: AdminCashShop;
  try {
    st = await api<AdminCashShop>('GET', '/admin/cash-shop');
  } catch (e) {
    box.replaceChildren(h('div', { class: 'msg bad' }, `โหลดไม่สำเร็จ: ${(e as Error).message}`));
    return;
  }
  const msg = h('div', { class: 'msg' });
  const say = (text: string, ok: boolean) => {
    msg.className = ok ? 'msg ok' : 'msg bad';
    msg.textContent = text;
  };

  const draw = (): void => {
    // The orb looks are cosmetics too: list them (and name them in the history) like the rest.
    registerOrbItems(st.orbs);
    const ro = !st.canEdit;
    const rows: Row[] = [];
    const open = h('input', { type: 'checkbox', disabled: ro }) as HTMLInputElement;
    open.checked = st.cfg.open;

    const num = (v: number | undefined, max: number, placeholder = '') =>
      h('input', { type: 'number', min: '1', max: String(max), value: v === undefined ? '' : String(v), placeholder, style: 'width:76px', disabled: ro }) as HTMLInputElement;
    const time = (v: number | undefined) => h('input', { type: 'datetime-local', value: toLocal(v), style: 'width:170px', disabled: ro }) as HTMLInputElement;
    const row = (id: string, cos: string | null): HTMLTableRowElement => {
      const c: CashItemCfg = st.cfg.items[id] ?? {};
      const sell = h('input', { type: 'checkbox', disabled: ro }) as HTMLInputElement;
      sell.checked = !c.off;
      const stone = cos ? null : (id.slice(6) as (typeof CASH_STONES)[number]);
      const price = cos ? num(st.cosShop[cos]?.price, CASH_PRICE_MAX, 'ไม่ขาย') : num(c.price ?? CASH_STONE_PRICE[stone!], CASH_PRICE_MAX);
      const sale = num(c.sale, CASH_PRICE_MAX, '—');
      const limit = cos ? null : num(c.limit, CASH_LIMIT_MAX, 'ไม่จำกัด');
      const start = time(c.start);
      const end = time(c.end);
      const badge = h('select', { disabled: ro },
        h('option', { value: '' }, '—'), h('option', { value: 'new' }, 'ใหม่'), h('option', { value: 'hot' }, 'ขายดี')) as HTMLSelectElement;
      badge.value = c.badge ?? '';
      const featured = h('input', { type: 'checkbox', disabled: ro }) as HTMLInputElement;
      featured.checked = !!c.featured;
      rows.push({ id, cos, sell, price, sale, limit, start, end, badge, featured });
      const note = cos && st.cosShop[cos]?.hidden ? h('span', { class: 'muted' }, ' (ซ่อนอยู่ ไม่ขาย)') : null;
      return h('tr', {},
        h('td', {}, cashItemName(id), note), h('td', {}, sell), h('td', {}, price), h('td', {}, sale),
        h('td', {}, limit ?? h('span', { class: 'muted' }, '1 ครั้ง')), h('td', {}, start), h('td', {}, end), h('td', {}, badge), h('td', {}, featured));
    };
    const head = () => h('tr', {}, ...['สินค้า', 'ขาย', `ราคา (${CURRENCY})`, 'ราคาลด', 'จำกัด/บัญชี', 'เริ่มขาย (เวลาไทย)', 'หมดเวลา (เวลาไทย)', 'ป้าย', 'แนะนำ'].map((t) => h('th', {}, t)));
    const group = (title: string) => h('tr', {}, h('th', { colspan: '9', style: 'text-align:left' }, title));
    const table = h('table', {}, head(), group('ของใช้และหิน (ส่งเข้าจดหมาย)'), ...CASH_STONES.map((k) => row(stoneItemId(k), null)));
    for (const slot of COS_SLOTS) {
      const list = COSMETICS.filter((c) => c.slot === slot);
      if (!list.length) continue;
      table.append(group(`ของแต่งตัว: ${COS_SLOT_NAME[slot]}`), ...list.map((c) => row(cosItemId(c.id), c.id)));
    }

    // Packages: crystals + bonus for baht, shown "เร็วๆ นี้" (no real-money top-up yet).
    const packs: CashPackage[] = st.cfg.packages.map((p) => ({ ...p }));
    const packBox = h('div', {});
    const drawPacks = (): void => {
      const t = h('table', {}, h('tr', {}, h('th', {}, 'คริสตัล'), h('th', {}, 'โบนัส'), h('th', {}, 'ราคา (บาท)'), h('th', {}, '')));
      packs.forEach((p, i) => {
        const field = (k: keyof CashPackage, min: number) => {
          const inp = h('input', { type: 'number', min: String(min), value: String(p[k]), style: 'width:90px', disabled: ro }) as HTMLInputElement;
          inp.oninput = () => (p[k] = Number(inp.value));
          return inp;
        };
        t.append(h('tr', {}, h('td', {}, field('crystals', 1)), h('td', {}, field('bonus', 0)), h('td', {}, field('baht', 1)),
          h('td', {}, ro ? null : h('button', { onclick: () => (packs.splice(i, 1), drawPacks()) }, 'ลบ'))));
      });
      packBox.replaceChildren(t, ro ? '' : h('button', { onclick: () => (packs.push({ crystals: 100, bonus: 0, baht: 35 }), drawPacks()) }, '+ เพิ่มแพ็กเกจ'),
        packs.length ? '' : h('div', { class: 'muted' }, 'ยังไม่มีแพ็กเกจ: ผู้เล่นเห็น "เติมคริสตัลมิติได้เร็วๆ นี้"'));
    };
    drawPacks();

    const collect = (): { cfg: CashShopCfg; cosPrices: Record<string, number | null> } | string => {
      const cfg: CashShopCfg = { open: open.checked, items: {}, packages: packs.map((p) => ({ ...p })) };
      const cosPrices: Record<string, number | null> = {};
      const int = (inp: HTMLInputElement): number | undefined | string => {
        if (inp.value.trim() === '') return undefined;
        const n = Number(inp.value);
        return Number.isInteger(n) ? n : 'ไม่ใช่จำนวนเต็ม';
      };
      for (const r of rows) {
        const name = cashItemName(r.id);
        const e: CashItemCfg = {};
        if (!r.sell.checked) e.off = true;
        const price = int(r.price);
        if (typeof price === 'string') return `${name}: ราคา${price}`;
        if (r.cos) {
          if (price !== st.cosShop[r.cos]?.price) cosPrices[r.cos] = price ?? null;
        } else if (price === undefined) return `${name}: ต้องใส่ราคา`;
        else e.price = price;
        const sale = int(r.sale);
        if (typeof sale === 'string') return `${name}: ราคาลด${sale}`;
        if (sale !== undefined) e.sale = sale;
        if (r.limit) {
          const lim = int(r.limit);
          if (typeof lim === 'string') return `${name}: จำกัด${lim}`;
          if (lim !== undefined) e.limit = lim;
        }
        for (const k of ['start', 'end'] as const) {
          const v = r[k].value;
          if (!v) continue;
          const ms = fromLocal(v);
          if (Number.isNaN(ms)) return `${name}: เวลาไม่ถูกต้อง`;
          e[k] = ms;
        }
        if (r.badge.value) e.badge = r.badge.value as CashBadge;
        if (r.featured.checked) e.featured = true;
        cfg.items[r.id] = e;
      }
      return { cfg, cosPrices };
    };

    const save = async (): Promise<void> => {
      const c = collect();
      if (typeof c === 'string') return say(c, false);
      const lines: string[] = [];
      if (c.cfg.open !== st.cfg.open) lines.push(c.cfg.open ? '⚠ เปิดขาย: ผู้เล่นซื้อได้ทันที' : 'ปิดขาย: ผู้เล่นดูได้อย่างเดียว');
      const n = Object.keys(c.cosPrices).length;
      if (n) lines.push(`ราคาของแต่งตัวเปลี่ยน ${n} ชิ้น (ใช้กับแท็บ "จัดการของแต่งตัว" ด้วย)`);
      if (!confirm(`บันทึกแคชช็อป ใช้กับผู้เล่นทุกคนทันที?${lines.length ? `\n\n${lines.join('\n')}` : ''}`)) return;
      try {
        st = await api<AdminCashShop>('POST', '/admin/cash-shop', { cfg: c.cfg, cosPrices: c.cosPrices, base: { cfg: st.cfg, cosShop: st.cosShop } });
        draw();
        say('บันทึกแล้ว', true);
      } catch (e) {
        say((e as Error).message, false);
      }
    };
    const reload = async (): Promise<void> => {
      try {
        st = await api<AdminCashShop>('GET', '/admin/cash-shop');
        draw();
        say('โหลดค่าของเซิร์ฟใหม่แล้ว', true);
      } catch (e) {
        say((e as Error).message, false);
      }
    };

    const recent = h('table', {}, h('tr', {}, ...['เวลา', 'บัญชี', 'ตัวละคร', 'สินค้า', 'จำนวน', `ราคา/ชิ้น`, 'รวม'].map((t) => h('th', {}, t))),
      ...st.recent.map((p) => h('tr', {}, h('td', {}, fmtTime(p.at)), h('td', {}, p.username), h('td', {}, p.charName), h('td', {}, cashItemName(p.item)),
        h('td', {}, fmt(p.qty)), h('td', {}, fmt(p.price)), h('td', {}, fmt(p.price * p.qty)))));

    box.replaceChildren(
      h('div', { class: 'card cash-admin' },
        h('h2', {}, 'แคชช็อป'),
        h('div', { class: 'muted' }, `ซื้อด้วย${CURRENCY} (เก็บต่อบัญชี) · ยังไม่มีระบบเติมเงิน ผู้เล่นยังไม่มีทางได้${CURRENCY} · ของแต่งตัวเข้าบัญชีทันที ใบคูณ/โทรโข่ง/หินส่งเข้าจดหมาย (หินไม่ผูก ใบคูณ/โทรโข่งผูกตัวละครที่กดรับ) · ช่องราคาของแต่งตัวคือราคาเดียวกับแท็บ "จัดการของแต่งตัว" เว้นว่าง = ไม่ขาย · ราคาลดต้องต่ำกว่าราคาเต็ม ป้าย "ลดราคา" ขึ้นเอง · เวลาเว้นว่าง = ไม่จำกัด`),
        h('label', { class: 'cash-open' }, open, 'เปิดขาย (ปิด = ผู้เล่นดูสินค้าได้แต่ซื้อไม่ได้)'),
        h('div', { style: 'overflow-x:auto' }, table),
        h('h3', {}, 'แพ็กเกจเติมคริสตัล (แสดงเป็น "เร็วๆ นี้")'), packBox,
        h('div', { style: 'display:flex;gap:8px;margin-top:8px' },
          ro ? h('span', { class: 'muted' }, 'ดูได้อย่างเดียว (ต้องมีสิทธิ์ "แก้แคชช็อป")') : h('button', { class: 'primary', onclick: () => void save() }, 'บันทึก'),
          h('button', { onclick: () => void reload() }, 'โหลดค่าของเซิร์ฟใหม่')),
        msg),
      h('div', { class: 'card cash-admin' }, h('h2', {}, `ประวัติการซื้อ (${st.recent.length} รายการล่าสุด)`), st.recent.length ? h('div', { style: 'overflow-x:auto' }, recent) : h('div', { class: 'muted' }, 'ยังไม่มีการซื้อ')),
    );
  };
  draw();
}
