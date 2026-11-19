import { HISTORY_DAYS, HISTORY_PAGE, SESSION_PAGE_SIZES, SESSION_SEARCH_MAX, type AdminStats, type ChatLogRow, type PlaySessionRow, type SessionPage, type SessionSort, type StatsPoint, type StatsRange } from '../../shared/admin';
import { h, hooks, api, fmt, time, zoneName, view, can } from '../core';

// ------------------------------------------------------------ history: graphs, play sessions, chat log

const NO_HISTORY = 'เริ่มบันทึกตั้งแต่อัปเดตนี้ — ก่อนหน้านั้นไม่มีข้อมูล';
const SVG = 'http://www.w3.org/2000/svg';
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/**
 * One series as a line (or bars), inline SVG, with a hover/tap tooltip. One chart per measure (never two
 * y-axes). `fmtX` labels the time, `unit` follows each value.
 */
function chart(points: StatsPoint[], opts: { bars?: boolean; fmtX: (t: number) => string; fmtTip?: (t: number) => string; unit?: string; empty?: string; xFrom?: number; xTo?: number }): HTMLElement {
  // Narrower drawing on phones, so the axis text isn't shrunk to nothing.
  const W = window.innerWidth < 600 ? 360 : 640;
  const H = window.innerWidth < 600 ? 200 : 180;
  const L = 36;
  const R = 10;
  const T = 10;
  const B = 24;
  const wrap = h('div', { class: 'chart' });
  if (!points.length) {
    wrap.append(h('div', { class: 'muted chart-empty' }, opts.empty ?? 'ยังไม่มีข้อมูล'));
    return wrap;
  }
  const x0 = opts.xFrom ?? points[0].at;
  const x1 = Math.max(opts.xTo ?? points[points.length - 1].at, x0 + 1);
  const maxV = Math.max(1, ...points.map((p) => p.v));
  const niceMax = (() => {
    const m = Math.pow(10, Math.floor(Math.log10(maxV)));
    const n = [1, 2, 2.5, 5, 10].find((k) => k * m >= maxV)! * m;
    return n;
  })();
  const px = (t: number) => L + ((t - x0) / (x1 - x0)) * (W - L - R);
  const py = (v: number) => T + (1 - v / niceMax) * (H - T - B);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'chart-svg' });
  for (const f of [0, 0.5, 1]) {
    const y = py(niceMax * f);
    svg.append(s('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'grid' }));
    const lab = s('text', { x: L - 6, y: y + 4, class: 'axis', 'text-anchor': 'end' });
    lab.textContent = fmt(Math.round(niceMax * f * 10) / 10);
    svg.append(lab);
  }
  for (const t of [x0, (x0 + x1) / 2, x1]) {
    const lab = s('text', { x: px(t), y: H - 6, class: 'axis', 'text-anchor': t === x0 ? 'start' : t === x1 ? 'end' : 'middle' });
    lab.textContent = opts.fmtX(t);
    svg.append(lab);
  }
  if (opts.bars) {
    const bw = Math.max(2, ((W - L - R) / points.length) - 2);
    for (const p of points) {
      const y = py(p.v);
      const x = px(p.at) - bw / 2 + ((W - L - R) / points.length) / 2;
      if (p.v > 0) svg.append(s('rect', { x, y, width: bw, height: Math.max(1, py(0) - y), rx: Math.min(3, bw / 2), class: 'bar' }));
    }
  } else {
    // Breaks where the server was off (a gap of more than 3 points' spacing).
    const gap = 3 * Math.min(...points.slice(1).map((p, i) => p.at - points[i].at).concat([x1 - x0]));
    let d = '';
    points.forEach((p, i) => {
      d += `${i === 0 || p.at - points[i - 1].at > gap ? 'M' : 'L'}${px(p.at).toFixed(1)},${py(p.v).toFixed(1)}`;
    });
    svg.append(s('path', { d, class: 'line' }));
    if (points.length === 1) svg.append(s('circle', { cx: px(points[0].at), cy: py(points[0].v), r: 4, class: 'dot' }));
  }
  const cross = s('line', { y1: T, y2: H - B, class: 'cross hidden' });
  const mark = s('circle', { r: 4, class: 'dot hidden' });
  svg.append(cross, mark);
  const tip = h('div', { class: 'tip hidden' });
  const move = (ev: PointerEvent) => {
    const rect = svg.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * W;
    let best = points[0];
    for (const p of points) if (Math.abs(px(p.at) - x) < Math.abs(px(best.at) - x)) best = p;
    const bx = opts.bars ? px(best.at) + ((W - L - R) / points.length) / 2 : px(best.at);
    cross.setAttribute('x1', String(bx));
    cross.setAttribute('x2', String(bx));
    mark.setAttribute('cx', String(bx));
    mark.setAttribute('cy', String(py(best.v)));
    cross.classList.remove('hidden');
    mark.classList.remove('hidden');
    tip.textContent = `${(opts.fmtTip ?? opts.fmtX)(best.at)} · ${fmt(best.v)}${opts.unit ?? ''}`;
    tip.classList.remove('hidden');
    tip.style.left = `${Math.min(Math.max((bx / W) * rect.width, 60), rect.width - 60)}px`;
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', () => {
    cross.classList.add('hidden');
    mark.classList.add('hidden');
    tip.classList.add('hidden');
  });
  wrap.append(svg, tip);
  return wrap;
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (t: number) => new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
let statsRange: StatsRange = '24h';

export async function renderStats(): Promise<void> {
  const range = h('select', {}, ...([['24h', '24 ชั่วโมง'], ['7d', '7 วัน'], ['30d', '30 วัน']] as const)
    .map(([v, l]) => h('option', { value: v, selected: v === statsRange }, l)));
  const tiles = h('div', { class: 'zones' });
  const body = h('div');
  const msg = h('div', { class: 'msg' });
  const load = async () => {
    try {
      const st = await api<AdminStats>('GET', `/admin/stats?range=${statsRange}`);
      const short = st.range === '24h';
      const fx = short ? hhmm : dayLabel;
      const now = Date.now();
      const span = { '24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5 }[st.range];
      const peak = st.online.reduce((m, p) => Math.max(m, p.v), 0);
      tiles.replaceChildren(
        ...([['ออนไลน์ตอนนี้', fmt(st.now.online)], [`สูงสุดใน ${range.selectedOptions[0].text}`, fmt(peak)],
          ['Lv เฉลี่ยทุกตัวละคร', st.now.avgLevelAll === null ? '–' : (Math.round(st.now.avgLevelAll * 10) / 10).toString()],
          ['สมัคร 30 วัน', fmt(st.signups.reduce((a, p) => a + p.v, 0))]] as const)
          .map(([l, v]) => h('div', { class: 'zone-chip' }, h('b', {}, v), h('span', {}, l))));
      const note = st.since ? `ข้อมูลกราฟผู้เล่นเริ่มบันทึก ${time(st.since)} — ก่อนหน้านั้นไม่มีข้อมูล` : NO_HISTORY;
      body.replaceChildren(
        h('div', { class: 'card' }, h('h2', {}, 'ผู้เล่นออนไลน์'), h('div', { class: 'muted chart-note' }, `จำนวนสูงสุดในแต่ละช่วง · ${note}`),
          chart(st.online, { fmtX: fx, fmtTip: short ? hhmm : time, unit: ' คน', xFrom: now - span, xTo: now, empty: NO_HISTORY })),
        h('div', { class: 'card' }, h('h2', {}, 'สมัครสมาชิกต่อวัน'), h('div', { class: 'muted chart-note' }, 'บัญชีจริง 30 วันล่าสุด (บัญชีที่ถูกลบไปแล้วไม่นับ)'),
          chart(st.signups, { bars: true, fmtX: dayLabel, unit: ' บัญชี' })),
        h('div', { class: 'card' }, h('h2', {}, 'เลเวลเฉลี่ยของผู้เล่นที่ออนไลน์'), h('div', { class: 'muted chart-note' }, short ? 'เฉลี่ยรายชั่วโมง' : 'เฉลี่ยรายวัน'),
          chart(st.avgLevel, { fmtX: fx, xFrom: now - span, xTo: now, empty: NO_HISTORY })),
        h('div', { class: 'card' }, h('h2', {}, 'Ping เฉลี่ย'), h('div', { class: 'muted chart-note' }, short ? 'เฉลี่ยรายชั่วโมง' : 'เฉลี่ยรายวัน'),
          chart(st.avgPing, { fmtX: fx, unit: ' ms', xFrom: now - span, xTo: now, empty: NO_HISTORY })),
      );
      msg.textContent = '';
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
    }
  };
  range.onchange = () => {
    statsRange = range.value as StatsRange;
    void load();
  };
  view.append(h('div', { class: 'row', style: 'margin-bottom:12px' }, h('label', { style: 'max-width:200px' }, 'ช่วงเวลา', range)), tiles, msg, body);
  await load();
}

/** What the play-session table is showing: sort, page and filters (dates as the date inputs' yyyy-mm-dd). */
interface SessionView { sort: SessionSort; desc: boolean; page: number; size: number; q: string; from: string; to: string }
export const newSessionView = (): SessionView => ({ sort: 'joined', desc: true, page: 1, size: SESSION_PAGE_SIZES[0], q: '', from: '', to: '' });
/** The sessions tab keeps its place when you switch tabs; an account sheet starts fresh. */
const mainSessions = newSessionView();

/** Midnight (this browser's time) starting a yyyy-mm-dd day, plus `days`. */
const dayStart = (d: string, days = 0): number => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd + days).getTime();
};

/**
 * The play-session data table, sorted and paged on the server over every stored row: column headers
 * (or "เรียงตาม" on phones) sort, plus search, a date range, rows per page and numbered pages. With
 * `accountId` it shows that account only (no account column, rows don't open the account again).
 */
export function sessionsTable(st: SessionView, accountId?: number): HTMLElement {
  const showAccount = accountId === undefined;
  const cols: [SessionSort, string][] = [
    ['joined', 'เข้าเล่น'], ...(showAccount ? [['username', 'บัญชี'] as [SessionSort, string]] : []), ['char', 'ตัวละคร'], ['duration', 'นานเท่าไร'],
    ['ip', 'IP'], ['gpu', 'GPU'], ['ping', 'Ping เฉลี่ย'], ['fps', 'FPS เฉลี่ย'],
  ];
  /** Names and addresses start A→Z; times and numbers start biggest/newest first. */
  const firstDesc = (k: SessionSort) => !['username', 'char', 'ip', 'gpu'].includes(k);

  const q = h('input', { type: 'search', placeholder: showAccount ? 'ชื่อผู้ใช้ ตัวละคร หรือ IP' : 'ตัวละคร หรือ IP', value: st.q, maxLength: SESSION_SEARCH_MAX, autocapitalize: 'off' });
  const from = h('input', { type: 'date', value: st.from });
  const to = h('input', { type: 'date', value: st.to });
  const size = h('select', {}, ...SESSION_PAGE_SIZES.map((n) => h('option', { value: String(n), selected: n === st.size }, `${n} แถว`)));
  const sort = h('select', {}, ...cols.map(([k, l]) => h('option', { value: k, selected: k === st.sort }, `เรียงตาม${l}`)));
  const dir = h('button', { class: 'small', type: 'button' });
  const head = h('tr');
  const body = h('tbody');
  const info = h('div', { class: 'muted' });
  const pager = h('div', { class: 'pager' });
  const msg = h('div', { class: 'msg bad' });

  const dur = (r: PlaySessionRow) => {
    if (r.online) return h('span', { class: 'good' }, '🟢 กำลังเล่น');
    if (r.leftAt === null) return h('span', { class: 'muted' }, 'ไม่ทราบ');
    const m = Math.round((r.leftAt - r.joinedAt) / 60000);
    return m < 60 ? `${m} นาที` : `${Math.floor(m / 60)} ชม. ${m % 60} นาที`;
  };
  const cell = (label: string, content: Node | string, cls = '') => h('td', { 'data-label': label, class: cls }, content);

  const drawHead = () => {
    head.replaceChildren(...cols.map(([k, l]) => h('th', {
      class: 'sortable',
      'aria-sort': k === st.sort ? (st.desc ? 'descending' : 'ascending') : 'none',
      onclick: () => setSort(k, st.sort === k ? !st.desc : firstDesc(k)),
    }, l + (k === st.sort ? (st.desc ? ' ▼' : ' ▲') : ''))));
    sort.value = st.sort;
    dir.textContent = st.sort === 'joined' ? (st.desc ? '▼ ใหม่→เก่า' : '▲ เก่า→ใหม่')
      : !firstDesc(st.sort) ? (st.desc ? '▼ Z→A' : '▲ A→Z')
      : st.desc ? '▼ มากไปน้อย' : '▲ น้อยไปมาก';
  };

  /** 1 … 4 5 [6] 7 8 … 20, with ‹ › on the sides. */
  const drawPager = (page: number, pages: number) => {
    const btn = (label: string, to: number, opts: { current?: boolean; disabled?: boolean; title?: string } = {}) =>
      h('button', {
        class: 'small' + (opts.current ? ' current' : ''), type: 'button', disabled: opts.disabled || opts.current, title: opts.title,
        'aria-current': opts.current ? 'page' : undefined, onclick: () => go(to),
      }, label);
    const nums: (number | null)[] = [];
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - page) <= 2) nums.push(p);
      else if (nums.at(-1) !== null) nums.push(null);
    }
    pager.replaceChildren(
      btn('‹', page - 1, { disabled: page <= 1, title: 'หน้าก่อน' }),
      ...nums.map((p) => (p === null ? h('span', { class: 'muted' }, '…') : btn(String(p), p, { current: p === page }))),
      btn('›', page + 1, { disabled: page >= pages, title: 'หน้าถัดไป' }),
    );
    pager.classList.toggle('hidden', pages <= 1);
  };

  let ask = 0;
  const load = async () => {
    const mine = ++ask;
    if (st.from && st.to && st.from > st.to) {
      msg.textContent = 'วันที่เริ่มต้องไม่อยู่หลังวันที่สิ้นสุด';
      return;
    }
    const p = new URLSearchParams({ sort: st.sort, dir: st.desc ? 'desc' : 'asc', page: String(st.page), size: String(st.size) });
    if (st.q.trim()) p.set('q', st.q.trim());
    if (st.from) p.set('from', String(dayStart(st.from)));
    if (st.to) p.set('to', String(dayStart(st.to, 1)));
    if (accountId !== undefined) p.set('account', String(accountId));
    body.classList.add('loading');
    try {
      const r = await api<SessionPage>('GET', `/admin/sessions?${p}`);
      if (mine !== ask) return;
      st.page = r.page;
      msg.textContent = '';
      drawHead();
      body.replaceChildren(...r.rows.map((s) => h('tr', showAccount ? { class: 'click', onclick: () => void hooks.openAccount(s.accountId) } : {},
        cell('เข้าเล่น', time(s.joinedAt), 'head'),
        showAccount ? cell('บัญชี', s.username) : null,
        cell('ตัวละคร', s.charName),
        cell('นานเท่าไร', dur(s)),
        h('td', { 'data-label': 'IP', class: 'ip', title: s.ip }, s.ip),
        h('td', { 'data-label': 'GPU', class: 'gpu', title: s.gpu ?? '' }, s.gpu ?? '–'),
        cell('Ping เฉลี่ย', s.avgRtt === null ? '–' : `${fmt(s.avgRtt)} ms`, 'num'),
        cell('FPS เฉลี่ย', s.avgFps === null ? '–' : fmt(s.avgFps), 'num'),
      )));
      const filtered = !!(st.q.trim() || st.from || st.to);
      if (!r.rows.length) {
        body.append(h('tr', {}, h('td', { colSpan: cols.length, class: 'muted' }, filtered ? 'ไม่พบการเข้าเล่นที่ตรงกับตัวกรอง' : `ยังไม่มีประวัติ — ${NO_HISTORY}`)));
      }
      const first = (r.page - 1) * r.size;
      info.textContent = r.total ? `แสดง ${fmt(first + 1)}–${fmt(first + r.rows.length)} จาก ${fmt(r.total)} ครั้ง${filtered ? ' (กรองแล้ว)' : ''}` : '';
      drawPager(r.page, Math.max(1, Math.ceil(r.total / r.size)));
    } catch (e) {
      if (mine === ask) msg.textContent = (e as Error).message;
    }
    if (mine === ask) body.classList.remove('loading');
  };
  const go = (page: number) => {
    st.page = page;
    void load();
  };
  const setSort = (k: SessionSort, desc: boolean) => {
    st.sort = k;
    st.desc = desc;
    st.page = 1;
    drawHead();
    void load();
  };

  let typing = 0;
  q.addEventListener('input', () => {
    clearTimeout(typing);
    typing = window.setTimeout(() => {
      st.q = q.value;
      go(1);
    }, 300);
  });
  from.onchange = () => {
    st.from = from.value;
    go(1);
  };
  to.onchange = () => {
    st.to = to.value;
    go(1);
  };
  size.onchange = () => {
    st.size = Number(size.value);
    go(1);
  };
  sort.onchange = () => setSort(sort.value as SessionSort, firstDesc(sort.value as SessionSort));
  dir.onclick = () => setSort(st.sort, !st.desc);
  const clear = h('button', {
    class: 'small', type: 'button', onclick: () => {
      Object.assign(st, { q: '', from: '', to: '', page: 1 });
      q.value = from.value = to.value = '';
      void load();
    },
  }, 'ล้างตัวกรอง');

  drawHead();
  void load();
  return h('div', { class: 'sessions' },
    h('div', { class: 'row' },
      h('label', { class: 'grow2' }, 'ค้นหา', q),
      h('label', {}, 'ตั้งแต่วันที่', from),
      h('label', {}, 'ถึงวันที่', to),
      h('label', { class: 'narrow' }, 'ต่อหน้า', size),
    ),
    h('div', { class: 'row sort-row' }, h('label', {}, 'เรียง', sort), dir, clear),
    msg,
    h('table', { class: 'cards', style: 'margin-top:8px' }, h('thead', {}, head), body),
    h('div', { class: 'pager-bar' }, info, pager),
  );
}

export async function renderSessions(): Promise<void> {
  view.append(h('div', { class: 'card' }, h('h2', {}, 'การเข้าเล่น'),
    h('div', { class: 'muted', style: 'margin:-6px 0 8px' }, `${NO_HISTORY} · เก็บไว้ ${HISTORY_DAYS.sessions} วัน · กดหัวคอลัมน์เพื่อเรียง · กดแถวเพื่อดูบัญชี`),
    sessionsTable(mainSessions)));
}

export async function renderChat(): Promise<void> {
  const q = h('input', { placeholder: 'ข้อความ ชื่อผู้ใช้ หรือชื่อตัวละคร', autocapitalize: 'off' });
  const list = h('div');
  const more = h('button', {}, 'โหลดเพิ่ม');
  const msg = h('div', { class: 'msg' });
  let rows: ChatLogRow[] = [];
  const draw = () => {
    list.replaceChildren(...rows.map((r) => {
      const del = can('chatDelete') ? h('button', { class: 'small danger' }, 'ลบ') : null;
      if (del) {
        del.onclick = async () => {
          if (!confirm(`ลบข้อความนี้ออกจากบันทึก?\n\n${r.charName}: ${r.text}`)) return;
          try {
            await api('DELETE', `/admin/chat/${r.id}`);
            rows = rows.filter((x) => x.id !== r.id);
            draw();
          } catch (e) {
            msg.className = 'msg bad';
            msg.textContent = (e as Error).message;
          }
        };
      }
      return h('div', { class: 'list-item chat-row' },
        h('div', { class: 'grow' },
          h('div', { class: 'muted' }, `${time(r.at)} · ${zoneName(r.zone)} · ${r.username}`),
          h('div', {}, h('b', { class: 'chat-name' }, `${r.charName}: `), r.text)),
        del);
    }));
    if (!rows.length) list.append(h('div', { class: 'muted' }, q.value.trim() ? 'ไม่พบข้อความ' : `ยังไม่มีข้อความ — ${NO_HISTORY}`));
  };
  const load = async (reset: boolean) => {
    more.disabled = true;
    try {
      if (reset) rows = [];
      const qs = new URLSearchParams();
      if (q.value.trim()) qs.set('q', q.value.trim());
      if (rows.length) qs.set('before', String(rows.at(-1)!.id));
      const next = await api<ChatLogRow[]>('GET', `/admin/chat?${qs}`);
      rows = rows.concat(next);
      draw();
      more.classList.toggle('hidden', next.length < HISTORY_PAGE);
      msg.textContent = '';
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
    }
    more.disabled = false;
  };
  const form = h('form', { class: 'row' }, h('label', {}, 'ค้นหา', q), h('button', { class: 'primary', type: 'submit' }, 'ค้นหา'));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    void load(true);
  });
  more.onclick = () => void load(false);
  view.append(h('div', { class: 'card' }, h('h2', {}, 'บันทึกแชท'),
    h('div', { class: 'muted', style: 'margin:-6px 0 8px' }, `${NO_HISTORY} · เก็บไว้ ${HISTORY_DAYS.chat} วัน`),
    form, msg, list, more));
  await load(true);
}
