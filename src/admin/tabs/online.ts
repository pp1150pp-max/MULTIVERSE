import { BROADCAST_MAX, type AdminOnline, type AdminOnlineRow } from '../../shared/admin';
import { REFRESH_MS, PING_BAD, FPS_BAD, FRAME_BAD, h, hooks, ApiError, api, fmt, playedFor, className, me, online, setOnline, tab, timer, setTimer, zoneName, view, stopRefresh, can } from '../core';
import { openChar } from './characterEditor';

// ------------------------------------------------------------ online

export function renderOnline(): void {
  const zones = h('div', { class: 'zones' });
  const body = h('tbody');
  const total = h('span', { class: 'muted' });
  const err = h('div', { class: 'msg bad' });
  view.append(
    zones,
    h('div', { class: 'card' },
      h('h2', {}, 'ผู้เล่นออนไลน์ ', total),
      h('div', { class: 'muted', style: 'margin:-6px 0 8px' }, 'อัปเดตทุก 3 วินาที · กดที่แถวเพื่อแก้ไขตัวละคร'),
      h('table', { class: 'cards' },
        h('thead', {}, h('tr', {}, ...['ตัวละคร', 'บัญชี', 'คลาส', 'Lv', 'โซน', 'เล่นมาแล้ว', 'Ping', 'FPS', 'เฟรมนานสุด', 'GPU', 'IP',
          ...(can('broadcast') ? [''] : [])].map((t) => h('th', {}, t)))),
        body,
      ),
      err,
    ),
  );

  const refresh = async () => {
    try {
      setOnline(await api<AdminOnline>('GET', '/admin/online'));
      err.textContent = '';
    } catch (e) {
      err.textContent = (e as Error).message;
      if ((e as ApiError).status === 401 || (e as ApiError).status === 403) return;
    }
    if (tab !== 'online') return;
    if (online) {
      total.textContent = `(${online.players.length} คน)`;
      zones.replaceChildren(...online.zones.map((z) => h('div', { class: 'zone-chip' }, h('b', {}, String(z.count)), h('span', {}, z.ch ? `${z.nameTh} · CH ${z.ch}` : z.nameTh))));
      // Rows are updated in place (by character), so a tap that lands during a refresh still opens it.
      const old = new Map([...body.querySelectorAll<HTMLTableRowElement>('tr[data-char]')].map((tr) => [tr.dataset.char!, tr]));
      const rows = online.players.map((p) => {
        const fresh = onlineRow(p);
        const tr = old.get(String(p.charId));
        if (!tr) return fresh;
        [...fresh.cells].forEach((td, i) => {
          const cur = tr.cells[i];
          if (cur.textContent !== td.textContent || cur.className !== td.className) cur.replaceWith(td);
        });
        return tr;
      });
      if (rows.length !== body.children.length || rows.some((tr, i) => body.children[i] !== tr)) body.replaceChildren(...rows);
      if (!online.players.length) body.append(h('tr', {}, h('td', { colSpan: 12, class: 'muted' }, 'ยังไม่มีใครออนไลน์')));
    }
    if (!document.hidden) setTimer(window.setTimeout(refresh, REFRESH_MS));
  };
  void refresh();
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && tab === 'online' && me && !timer) hooks.setTab('online');
  if (document.hidden) stopRefresh();
});

function onlineRow(p: AdminOnlineRow): HTMLTableRowElement {
  const cell = (label: string, content: Node | string, cls = '') => h('td', { 'data-label': label, class: cls }, content);
  const numCell = (label: string, v: number | null, unit: string, bad: boolean) =>
    cell(label, v === null ? '—' : `${fmt(v)}${unit}`, `num${v !== null && bad ? ' warn' : ''}`);
  const view = can('charView');
  return h('tr', { class: view ? 'click' : '', 'data-char': String(p.charId), onclick: view ? () => void openChar(p.charId) : null },
    cell('ตัวละคร', h('span', {}, p.name, p.away ? h('span', { class: 'tag', title: 'หลุดการเชื่อมต่อ Auto ยังฟาร์มต่อ' }, 'หลุด · Auto') : null), 'head'),
    cell('บัญชี', h('span', {}, p.username, p.guest ? h('span', { class: 'tag' }, 'Guest') : null)),
    cell('คลาส', className(p.classId)),
    cell('Lv', String(p.level), 'num'),
    cell('โซน', online?.zones.some((z) => z.id === p.zone && z.ch) ? `${zoneName(p.zone)} · CH ${p.ch}` : zoneName(p.zone)),
    cell('เล่นมาแล้ว', playedFor(p.playedMs), 'num'),
    numCell('Ping', p.rtt, ' ms', (p.rtt ?? 0) > PING_BAD),
    p.hidden && p.fps === null ? cell('FPS', 'แท็บซ่อน', 'num muted') : numCell('FPS', p.fps, '', p.fps !== null && p.fps < FPS_BAD),
    numCell('เฟรมนานสุด', p.maxFrame, ' ms', (p.maxFrame ?? 0) >= FRAME_BAD),
    h('td', { 'data-label': 'GPU', class: 'gpu', title: p.gpu ?? '' }, p.gpu ?? '—'),
    h('td', { 'data-label': 'IP', class: 'ip', title: p.edge ? `${p.ip} · เข้าทาง Cloudflare ${p.edge}` : p.ip }, p.edge ? `${p.ip} · ${p.edge}` : p.ip),
    can('broadcast')
      ? h('td', { 'data-label': 'ข้อความ' }, h('button', {
        class: 'small',
        onclick: (ev: Event) => {
          ev.stopPropagation();
          void announceTo(p.charId, p.name);
        },
      }, '📢 ประกาศ'))
      : null,
  );
}

/** Asks for a message and sends it to one online player. */
async function announceTo(charId: number, name: string): Promise<void> {
  const text = prompt(`ข้อความถึง ${name} (ไม่เกิน ${BROADCAST_MAX} ตัว)`)?.trim();
  if (!text) return;
  try {
    alert((await api<{ msg: string }>('POST', '/admin/broadcast', { text, to: charId })).msg);
  } catch (e) {
    alert((e as Error).message);
  }
}
