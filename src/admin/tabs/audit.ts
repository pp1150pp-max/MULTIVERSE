import { ADMIN_AUDIT_PAGE, type AuditRow } from '../../shared/admin';
import { h, api, time, view } from '../core';

// ------------------------------------------------------------ audit (owner)

const ACTION_TH: Record<string, string> = {
  level: 'ตั้งเลเวล', gold: 'ทอง', items: 'เสกไอเทม', kick: 'เตะ', teleport: 'ย้ายโซน', grant: 'ให้สิทธิ์', revoke: 'ถอนสิทธิ์',
  server: 'Server', password: 'ตั้งรหัสผ่าน', ban: 'แบน', unban: 'ปลดแบน', broadcast: 'ประกาศ', backup: 'สำรองข้อมูล',
  'delete-account': 'ลบบัญชี', 'delete-character': 'ลบตัวละคร', 'chat-delete': 'ลบแชท',
  'shutdown-text': 'ข้อความเตือนปิด server', 'snap-delta': 'ลดขนาด snapshot', 'google-login': 'เข้าสู่ระบบด้วย Google', 'google-unlink': 'ยกเลิกการผูก Google', 'orb-look': 'หน้าตาลูกแก้วตีบวก', 'cos-look': 'ค่าของแต่งตัว', 'anim-look': 'ค่าท่าตัวละคร', 'cos-shop': 'ซ่อน/ราคาของแต่งตัว', 'cash-shop': 'แคชช็อป', 'orb-items': 'ลูกแก้วในร้านค้า', balance: 'ปรับสมดุล', 'menu-layout': 'จัดเมนูเกม', daily: 'ล็อกอินรายวัน', mail: 'ส่งจดหมาย', mailRecall: 'ดึงจดหมายกลับ',
  'report-status': 'สถานะรายงาน', 'report-ban': 'ห้ามรายงาน', 'report-unban': 'ปลดห้ามรายงาน',
  'cosmetic-give': 'ให้ Cosmetics', 'cosmetic-take': 'ยึด Cosmetics คืน', 'crystal-give': 'ให้คริสตัลมิติ', 'crystal-take': 'ลดคริสตัลมิติ',
};

export async function renderAudit(): Promise<void> {
  const body = h('tbody');
  const more = h('button', {}, 'โหลดเพิ่ม');
  const msg = h('div', { class: 'msg bad' });
  let oldest: number | undefined;
  const load = async () => {
    more.disabled = true;
    try {
      const rows = await api<AuditRow[]>('GET', `/admin/audit${oldest ? `?before=${oldest}` : ''}`);
      for (const r of rows) {
        body.append(h('tr', {},
          h('td', { 'data-label': 'เวลา', class: 'head' }, time(r.at)),
          h('td', { 'data-label': 'ผู้ทำ' }, r.admin),
          h('td', { 'data-label': 'การกระทำ' }, ACTION_TH[r.action] ?? r.action),
          h('td', { 'data-label': 'เป้าหมาย' }, r.target),
          h('td', { 'data-label': 'รายละเอียด' }, r.details),
        ));
      }
      if (rows.length) oldest = rows.at(-1)!.id;
      more.classList.toggle('hidden', rows.length < ADMIN_AUDIT_PAGE);
      if (!body.children.length) body.append(h('tr', {}, h('td', { colSpan: 5, class: 'muted' }, 'ยังไม่มีประวัติ')));
    } catch (e) {
      msg.textContent = (e as Error).message;
    }
    more.disabled = false;
  };
  more.onclick = () => void load();
  view.append(h('div', { class: 'card' }, h('h2', {}, 'ประวัติการใช้สิทธิ์ผู้ดูแล'),
    h('table', { class: 'cards' },
      h('thead', {}, h('tr', {}, ...['เวลา', 'ผู้ทำ', 'การกระทำ', 'เป้าหมาย', 'รายละเอียด'].map((t) => h('th', {}, t)))),
      body,
    ), more, msg));
  await load();
}
