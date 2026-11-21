import { type BackupRow } from '../../shared/admin';
import { h, api, time } from '../core';

/** Backups listed before "แสดงเพิ่ม". */
const BACKUP_LIST_SHORT = 5;

export function backupCard(): HTMLElement {
  const list = h('div');
  const msg = h('div', { class: 'msg' });
  const btn = h('button', { class: 'primary' }, 'สำรองตอนนี้');
  const KIND: Record<string, string> = { daily: 'อัตโนมัติ (ทุก 6 ชม.)', manual: 'กดเอง', 'before-delete': 'ก่อนลบ', 'before-item-mult': 'ก่อนคูณสเตตัสไอเทม' };
  let showAll = false;
  let last: BackupRow[] = [];
  const draw = (rows: BackupRow[]) => {
    last = rows;
    const shown = showAll ? rows : rows.slice(0, BACKUP_LIST_SHORT);
    list.replaceChildren(...shown.map((b) => h('div', { class: 'list-item' },
      h('div', { class: 'grow' }, h('div', {}, time(b.at)), h('div', { class: 'muted', style: 'word-break:break-all' }, b.name)),
      h('div', { style: 'text-align:right' }, h('div', {}, `${(b.size / 1024).toFixed(0)} KB`), h('div', { class: 'muted' }, KIND[b.kind] ?? b.kind)),
    )));
    if (!rows.length) list.append(h('div', { class: 'muted' }, 'ยังไม่มีไฟล์สำรอง'));
    if (rows.length > shown.length) {
      list.append(h('button', { class: 'small', style: 'margin-top:8px', onclick: () => { showAll = true; draw(last); } },
        `แสดงเพิ่ม (อีก ${rows.length - shown.length} ไฟล์)`));
    }
  };
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const r = await api<{ msg: string; rows: BackupRow[] }>('POST', '/admin/backups');
      msg.className = 'msg ok';
      msg.textContent = r.msg;
      draw(r.rows);
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
    }
    btn.disabled = false;
  };
  void api<BackupRow[]>('GET', '/admin/backups').then(draw, (e) => {
    msg.className = 'msg bad';
    msg.textContent = (e as Error).message;
  });
  return h('div', { class: 'card' }, h('h2', {}, 'สำรองฐานข้อมูล'),
    h('div', { class: 'muted', style: 'margin:-6px 0 8px' },
      'เก็บใน server/data/backups/ · สำรองอัตโนมัติทุก 6 ชั่วโมง (เก็บ 28 ไฟล์ล่าสุด = 7 วัน) และก่อนลบบัญชี/ตัวละครทุกครั้ง · ' +
      'กู้คืน: ปิด server (npm run stop-server) แล้วคัดลอกไฟล์สำรองทับ server/data/multiverse.db (ลบไฟล์ -wal และ -shm ข้าง ๆ ก่อน) แล้วเปิด server ใหม่'),
    h('div', { class: 'row' }, btn), msg, list);
}

