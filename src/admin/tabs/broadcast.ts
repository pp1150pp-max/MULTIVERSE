import { BROADCAST_EVERY_MS, BROADCAST_MAX } from '../../shared/admin';
import { h, api } from '../core';

export function broadcastCard(): HTMLElement {
  const text = h('textarea', { rows: 3, maxLength: BROADCAST_MAX, placeholder: 'เช่น อีก 30 นาทีจะปิดปรับปรุง' }) as HTMLTextAreaElement;
  const count = h('span', { class: 'muted' }, `0/${BROADCAST_MAX}`);
  const msg = h('div', { class: 'msg' });
  const btn = h('button', { class: 'primary' }, 'ส่ง');
  text.oninput = () => (count.textContent = `${text.value.length}/${BROADCAST_MAX}`);
  btn.onclick = async () => {
    if (!text.value.trim()) return;
    if (!confirm(`ส่งถึงผู้เล่นทุกคนที่ออนไลน์?\n\n${text.value.trim()}`)) return;
    btn.disabled = true;
    try {
      const r = await api<{ msg: string }>('POST', '/admin/broadcast', { text: text.value });
      msg.className = 'msg ok';
      msg.textContent = r.msg;
      text.value = '';
      count.textContent = `0/${BROADCAST_MAX}`;
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
    }
    btn.disabled = false;
  };
  return h('div', { class: 'card' }, h('h2', {}, 'ประกาศถึงผู้เล่นทุกคน'),
    h('div', { class: 'muted', style: 'margin:-6px 0 8px' },
      `ผู้เล่นเห็นป้ายกลางจอ 10 วินาที และข้อความในแชท พร้อมชื่อผู้ส่ง · ส่งได้ทุก ${BROADCAST_EVERY_MS / 1000} วินาที · ส่งถึงคนเดียวได้จากปุ่ม 📢 ในตารางออนไลน์`),
    text, h('div', { class: 'row', style: 'margin-top:8px;align-items:center' }, count, h('span', { style: 'flex:1' }), btn), msg);
}
