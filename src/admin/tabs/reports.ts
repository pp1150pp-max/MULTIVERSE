import { REPORT_ADMIN_PAGE, REPORT_STATUSES, REPORT_TOPICS, REPORT_TOPIC_LABEL, type AdminReportRow } from '../../shared/reports';
import { h, api, time, me, zoneName, view } from '../core';

// ------------------------------------------------------------ reports (bug reports / feedback from players)

export async function renderReports(): Promise<void> {
  const list = h('div');
  const more = h('button', { class: 'hidden' }, 'โหลดเพิ่ม');
  const msg = h('div', { class: 'msg bad' });
  const topic = h('select', {}, h('option', { value: '' }, 'ทุกหัวข้อ'), ...REPORT_TOPICS.map((t) => h('option', { value: t.id }, t.label)));
  const status = h('select', {}, h('option', { value: '' }, 'ทุกสถานะ'), ...REPORT_STATUSES.map((s) => h('option', { value: s.id }, s.label)));
  const canBan = !!me?.features.includes('reportBan');
  let oldest: number | undefined;
  const draw = (r: AdminReportRow) => {
    const st = h('select', {}, ...REPORT_STATUSES.map((s) => h('option', { value: s.id, selected: s.id === r.status }, s.label)));
    st.onchange = async () => {
      try {
        await api('POST', '/admin/reports/status', { id: r.id, status: st.value });
        msg.textContent = '';
      } catch (e) {
        msg.textContent = (e as Error).message;
        st.value = r.status;
      }
    };
    const ban = canBan ? h('button', { class: 'small' }, r.banned ? 'อนุญาตให้รายงานอีก' : 'ห้ามรายงาน') : null;
    if (ban) {
      ban.onclick = async () => {
        try {
          const banned = !r.banned;
          await api('POST', '/admin/reports/ban', { accountId: r.accountId, banned });
          // Every report of this account on the page shows the same state: reload the list.
          await load(true);
          msg.textContent = '';
        } catch (e) {
          msg.textContent = (e as Error).message;
        }
      };
    }
    return h('div', { class: 'list-item', style: 'flex-direction:column;align-items:stretch' },
      h('div', { class: 'row' },
        h('b', {}, `#${r.id} ${REPORT_TOPIC_LABEL[r.topic] ?? r.topic}`), st, ban, r.banned ? h('span', { class: 'muted' }, '(ถูกห้ามรายงาน)') : null),
      h('div', { class: 'muted' },
        `${time(r.at)} · ${r.username} / ${r.charName} Lv ${r.level} · ${zoneName(r.zone)}${r.channel ? ` ห้อง ${r.channel}` : ''} (${r.x}, ${r.z}) · ` +
        `ping ${r.rtt ?? '-'} ms · FPS ${r.fps ?? '-'} · IP ${r.ip}`),
      h('div', { style: 'white-space:pre-wrap;word-break:break-word' }, r.text),
    );
  };
  const load = async (reset: boolean) => {
    if (reset) {
      list.replaceChildren();
      oldest = undefined;
    }
    try {
      const qs = [oldest ? `before=${oldest}` : '', topic.value ? `topic=${topic.value}` : '', status.value ? `status=${status.value}` : ''].filter(Boolean).join('&');
      const rows = await api<AdminReportRow[]>('GET', `/admin/reports${qs ? `?${qs}` : ''}`);
      list.append(...rows.map(draw));
      if (rows.length) oldest = rows.at(-1)!.id;
      more.classList.toggle('hidden', rows.length < REPORT_ADMIN_PAGE);
      if (!list.children.length) list.append(h('div', { class: 'muted' }, 'ไม่มีรายงาน'));
      msg.textContent = '';
    } catch (e) {
      msg.textContent = (e as Error).message;
    }
  };
  more.onclick = () => void load(false);
  topic.onchange = () => void load(true);
  status.onchange = () => void load(true);
  view.replaceChildren(h('div', { class: 'card' },
    h('h2', {}, 'รายงานปัญหา / ข้อเสนอแนะจากผู้เล่น'),
    h('div', { class: 'muted', style: 'margin:-6px 0 8px' }, 'ใหม่สุดก่อน · เฉพาะ "รายงานผู้เล่น" จะแจ้งเตือน owner/GM ที่ออนไลน์ทันที ที่เหลือมาดูที่หน้านี้'),
    h('div', { class: 'row' }, topic, status),
    list, more, msg,
  ));
  await load(true);
}
