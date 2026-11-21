import { TRADE_TAX_PCT, type TradeLogRow } from '../../shared/trade';
import { h, api, fmt, time, view } from '../core';

// ------------------------------------------------------------ trades (the log of finished player-to-player trades)

export async function renderTrades(): Promise<void> {
  const list = h('div');
  const more = h('button', { class: 'hidden' }, 'โหลดเพิ่ม');
  const msg = h('div', { class: 'msg bad' });
  const search = h('input', { placeholder: 'ค้นหาชื่อตัวละคร (ฝ่ายใดก็ได้)', maxLength: 40 });
  let oldest: number | undefined;
  const side = (s: TradeLogRow['a'], other: string) =>
    h('div', {},
      h('b', {}, s.name), ` ให้ ${other}: `,
      s.items.length || s.gold ? [...s.items, s.gold ? `ทอง ${fmt(s.gold)} G (ภาษี ${fmt(s.tax)} G · ผู้รับได้ ${fmt(s.gold - s.tax)} G)` : ''].filter(Boolean).join(', ') : 'ไม่ได้ให้อะไร');
  const draw = (r: TradeLogRow) => h('div', { class: 'list-item', style: 'flex-direction:column;align-items:stretch' },
    h('div', { class: 'muted' }, `#${r.id} · ${time(r.at)} · แมพ ${r.zone}`),
    side(r.a, r.b.name),
    side(r.b, r.a.name),
  );
  const load = async (reset: boolean) => {
    if (reset) {
      list.replaceChildren();
      oldest = undefined;
    }
    try {
      const q = search.value.trim();
      const qs = [oldest ? `before=${oldest}` : '', q ? `q=${encodeURIComponent(q)}` : ''].filter(Boolean).join('&');
      const rows = await api<TradeLogRow[]>('GET', `/admin/trades${qs ? `?${qs}` : ''}`);
      list.append(...rows.map(draw));
      if (rows.length) oldest = rows.at(-1)!.id;
      more.classList.toggle('hidden', rows.length < 30);
      if (!list.children.length) list.append(h('div', { class: 'muted' }, q ? 'ไม่พบการเทรดของชื่อนี้' : 'ยังไม่มีการเทรดที่สำเร็จ'));
      msg.textContent = '';
    } catch (e) {
      msg.textContent = (e as Error).message;
    }
  };
  more.onclick = () => void load(false);
  const go = h('button', {}, 'ค้นหา');
  go.onclick = () => void load(true);
  search.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') void load(true);
  });
  view.replaceChildren(h('div', { class: 'card' },
    h('h2', {}, 'ประวัติการเทรดระหว่างผู้เล่น'),
    h('div', { class: 'muted', style: 'margin:-6px 0 8px' }, `บันทึกเฉพาะการเทรดที่สำเร็จ (ใหม่สุดก่อน) · ทองที่ส่งโดนหักภาษี ${TRADE_TAX_PCT}% ซึ่งหายไปจากเกม`),
    h('div', { class: 'row' }, search, go),
    list, more, msg,
  ));
  await load(true);
}
