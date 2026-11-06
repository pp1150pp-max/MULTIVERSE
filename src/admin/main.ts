// The admin page (/admin). Shows what /api/admin returns and sends edits to it; the server checks the
// role and every value, so nothing here is a safeguard. Names, GPU strings and the like come from
// players: they are only ever put on the page as text (never as HTML).
import './admin.css';
import { ADMIN_AUDIT_PAGE } from '../shared/admin';
import type {
  AdminCharRow, AdminEditResult, AdminMe, AdminMeta, AdminOnline, AdminOnlineRow, AuditRow, RoleRow,
} from '../shared/admin';
import { CLASSES } from '../shared/data/classes';
import { RARITY_COLOR, RARITY_LABEL, SLOT_LABEL, type ClassId } from '../shared/types';

const ADMIN_TOKEN = 'multiverse-admin-token';
/** The game's own login: used when the owner is already logged in to the game in this browser. */
const GAME_TOKEN = 'multiverse-online-token';
const REFRESH_MS = 3000;
/** Above this ping / below this frame rate / above this frame time, the number is shown in red. */
const PING_BAD = 200;
const FPS_BAD = 30;
const FRAME_BAD = 1000;

// ------------------------------------------------------------ small helpers

type Kids = (Node | string | null | undefined | false)[];
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: Kids): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (k in el) (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, v: string | null): void {
  try {
    if (v) localStorage.setItem(key, v);
    else localStorage.removeItem(key);
  } catch {
    // storage blocked: the login just isn't remembered
  }
}

let token: string | null = read(ADMIN_TOKEN) ?? read(GAME_TOKEN);

class ApiError extends Error {
  constructor(readonly status: number, msg: string) {
    super(msg);
  }
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'เชื่อมต่อ server ไม่ได้');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const err = new ApiError(res.status, data.error ?? `server ตอบกลับผิดพลาด (${res.status})`);
    if (res.status === 401 || res.status === 403) onAuthLost(err);
    throw err;
  }
  return data;
}

const fmt = (n: number): string => n.toLocaleString('th-TH');
const className = (id: ClassId): string => CLASSES[id]?.nameTh ?? id;
const time = (ms: number): string =>
  new Date(ms).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });

// ------------------------------------------------------------ state

const root = document.getElementById('admin')!;
let me: AdminMe | null = null;
let meta: AdminMeta | null = null;
let online: AdminOnline | null = null;
type Tab = 'online' | 'search' | 'roles' | 'audit';
let tab: Tab = 'online';
let timer = 0;

const zoneName = (id: string): string => meta?.zones.find((z) => z.id === id)?.nameTh ?? id;

function onAuthLost(e: ApiError): void {
  stopRefresh();
  if (e.status === 401) {
    store(ADMIN_TOKEN, null);
    token = null;
    showLogin('กรุณาเข้าสู่ระบบใหม่');
  } else if (e.status === 403 && !me) {
    showNoRights();
  } else if (e.status === 403) {
    // Lost the role while the page was open.
    me = null;
    showNoRights();
  }
}

// ------------------------------------------------------------ login / no rights

function showLogin(note = ''): void {
  closeSheet();
  const user = h('input', { placeholder: 'ชื่อผู้ใช้', autocomplete: 'username', autocapitalize: 'off' });
  const pass = h('input', { type: 'password', placeholder: 'รหัสผ่าน', autocomplete: 'current-password' });
  const msg = h('div', { class: note ? 'msg bad' : 'msg' }, note);
  const btn = h('button', { class: 'primary', type: 'submit' }, 'เข้าสู่ระบบ');
  const form = h('form', { class: 'card' },
    h('h1', {}, 'MULTIVERSE'),
    h('div', { class: 'muted', style: 'text-align:center' }, 'หน้าผู้ดูแล — ใช้บัญชีเกมเดิม'),
    user, pass, btn, msg,
  );
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    btn.disabled = true;
    msg.className = 'msg';
    msg.textContent = 'กำลังเข้าสู่ระบบ…';
    try {
      const r = await fetch('api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.value.trim(), password: pass.value }),
      });
      const data = (await r.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!r.ok || !data.token) throw new Error(data.error ?? 'เข้าสู่ระบบไม่สำเร็จ');
      token = data.token;
      store(ADMIN_TOKEN, token);
      await start();
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
      btn.disabled = false;
    }
  });
  root.replaceChildren(h('div', { class: 'center' }, form));
  user.focus();
}

function logout(): void {
  stopRefresh();
  // Only the admin page's own login is ended; a game login borrowed from this browser stays.
  if (token && token === read(ADMIN_TOKEN)) void fetch('api/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  store(ADMIN_TOKEN, null);
  token = null;
  me = null;
  showLogin();
}

function showNoRights(): void {
  closeSheet();
  root.replaceChildren(h('div', { class: 'center' },
    h('div', { class: 'card', style: 'text-align:center' },
      h('h1', {}, 'ไม่มีสิทธิ์'),
      h('div', { class: 'muted' }, 'บัญชีนี้ไม่ได้เป็นผู้ดูแลเกม'),
      h('button', { onclick: logout }, 'เข้าสู่ระบบด้วยบัญชีอื่น'),
    ),
  ));
}

// ------------------------------------------------------------ main layout

const view = h('main');

async function start(): Promise<void> {
  if (!token) return showLogin();
  try {
    me = await api<AdminMe>('GET', '/admin/me');
    meta = await api<AdminMeta>('GET', '/admin/meta');
  } catch (e) {
    if ((e as ApiError).status === 0) {
      root.replaceChildren(h('div', { class: 'center' }, h('div', { class: 'card msg bad' }, (e as Error).message)));
    }
    return;
  }
  renderShell();
}

function renderShell(): void {
  if (!me) return;
  const tabs: [Tab, string][] = [['online', 'ออนไลน์'], ['search', 'ค้นหาตัวละคร']];
  if (me.role === 'owner') tabs.push(['roles', 'สิทธิ์ GM'], ['audit', 'ประวัติ']);
  const bar = h('nav', { class: 'tabs' }, ...tabs.map(([id, label]) =>
    h('button', { class: id === tab ? 'on' : '', onclick: () => setTab(id) }, label)));
  root.replaceChildren(
    h('header', { class: 'top' },
      h('div', { class: 'brand' }, 'MULTIVERSE', h('small', {}, 'ผู้ดูแล')),
      h('div', { class: 'who' }, me.username, h('span', { class: 'role' }, me.role === 'owner' ? 'Owner' : 'GM'),
        h('button', { class: 'small', onclick: logout }, 'ออก')),
    ),
    bar,
    view,
  );
  setTab(tab);
}

function setTab(t: Tab): void {
  tab = t;
  stopRefresh();
  document.querySelectorAll('.tabs button').forEach((b, i) => b.classList.toggle('on', ['online', 'search', 'roles', 'audit'][i] === t));
  view.replaceChildren();
  if (t === 'online') renderOnline();
  else if (t === 'search') renderSearch();
  else if (t === 'roles') void renderRoles();
  else void renderAudit();
}

function stopRefresh(): void {
  clearTimeout(timer);
  timer = 0;
}

// ------------------------------------------------------------ online

function renderOnline(): void {
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
        h('thead', {}, h('tr', {}, ...['ตัวละคร', 'บัญชี', 'คลาส', 'Lv', 'โซน', 'Ping', 'FPS', 'เฟรมนานสุด', 'GPU', 'IP'].map((t) => h('th', {}, t)))),
        body,
      ),
      err,
    ),
  );

  const refresh = async () => {
    try {
      online = await api<AdminOnline>('GET', '/admin/online');
      err.textContent = '';
    } catch (e) {
      err.textContent = (e as Error).message;
      if ((e as ApiError).status === 401 || (e as ApiError).status === 403) return;
    }
    if (tab !== 'online') return;
    if (online) {
      total.textContent = `(${online.players.length} คน)`;
      zones.replaceChildren(...online.zones.map((z) => h('div', { class: 'zone-chip' }, h('b', {}, String(z.count)), h('span', {}, z.nameTh))));
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
      if (!online.players.length) body.append(h('tr', {}, h('td', { colSpan: 10, class: 'muted' }, 'ยังไม่มีใครออนไลน์')));
    }
    if (!document.hidden) timer = window.setTimeout(refresh, REFRESH_MS);
  };
  void refresh();
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && tab === 'online' && me && !timer) setTab('online');
  if (document.hidden) stopRefresh();
});

function onlineRow(p: AdminOnlineRow): HTMLTableRowElement {
  const cell = (label: string, content: Node | string, cls = '') => h('td', { 'data-label': label, class: cls }, content);
  const numCell = (label: string, v: number | null, unit: string, bad: boolean) =>
    cell(label, v === null ? '—' : `${fmt(v)}${unit}`, `num${v !== null && bad ? ' warn' : ''}`);
  return h('tr', { class: 'click', 'data-char': String(p.charId), onclick: () => void openChar(p.charId) },
    cell('ตัวละคร', p.name, 'head'),
    cell('บัญชี', h('span', {}, p.username, p.guest ? h('span', { class: 'tag' }, 'Guest') : null)),
    cell('คลาส', className(p.classId)),
    cell('Lv', String(p.level), 'num'),
    cell('โซน', zoneName(p.zone)),
    numCell('Ping', p.rtt, ' ms', (p.rtt ?? 0) > PING_BAD),
    p.hidden && p.fps === null ? cell('FPS', 'แท็บซ่อน', 'num muted') : numCell('FPS', p.fps, '', p.fps !== null && p.fps < FPS_BAD),
    numCell('เฟรมนานสุด', p.maxFrame, ' ms', (p.maxFrame ?? 0) >= FRAME_BAD),
    h('td', { 'data-label': 'GPU', class: 'gpu', title: p.gpu ?? '' }, p.gpu ?? '—'),
    cell('IP', p.ip),
  );
}

// ------------------------------------------------------------ search

let lastQuery = '';

function renderSearch(): void {
  const q = h('input', { placeholder: 'ชื่อตัวละคร', value: lastQuery, autocapitalize: 'off' });
  const list = h('tbody');
  const msg = h('div', { class: 'msg' });
  const go = async () => {
    lastQuery = q.value.trim();
    if (!lastQuery) return;
    msg.className = 'msg';
    msg.textContent = 'กำลังค้นหา…';
    try {
      const rows = await api<AdminCharRow[]>('GET', `/admin/characters?q=${encodeURIComponent(lastQuery)}`);
      msg.textContent = rows.length ? '' : 'ไม่พบตัวละคร';
      list.replaceChildren(...rows.map((c) => {
        const cell = (label: string, content: Node | string, cls = '') => h('td', { 'data-label': label, class: cls }, content);
        return h('tr', { class: 'click', onclick: () => void openChar(c.charId) },
          cell('ตัวละคร', h('span', {}, c.name, h('span', { class: c.online ? 'tag on' : 'tag' }, c.online ? 'ออนไลน์' : 'ออฟไลน์')), 'head'),
          cell('บัญชี', c.username),
          cell('คลาส', className(c.classId)),
          cell('Lv', String(c.level), 'num'),
          cell('ทอง', fmt(c.gold), 'num'),
          cell('โซน', zoneName(c.zone)),
        );
      }));
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
    }
  };
  const form = h('form', { class: 'row' }, h('label', {}, 'ค้นหาตัวละคร (ทั้งออนไลน์และออฟไลน์)', q), h('button', { class: 'primary', type: 'submit' }, 'ค้นหา'));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    void go();
  });
  view.append(h('div', { class: 'card' }, form, msg,
    h('table', { class: 'cards', style: 'margin-top:10px' },
      h('thead', {}, h('tr', {}, ...['ตัวละคร', 'บัญชี', 'คลาส', 'Lv', 'ทอง', 'โซน'].map((t) => h('th', {}, t)))),
      list,
    )));
  if (lastQuery) void go();
  q.focus();
}

// ------------------------------------------------------------ character editor

let sheet: HTMLElement | null = null;
/** The spawn/gold choices, kept while the sheet redraws after each edit (and between characters). */
const form = { baseId: '', rarity: 'common', plus: '0', count: '1', gold: '10000' };

function closeSheet(): void {
  sheet?.remove();
  sheet = null;
}

async function openChar(charId: number): Promise<void> {
  let c: AdminCharRow;
  try {
    c = await api<AdminCharRow>('GET', `/admin/characters/${charId}`);
  } catch (e) {
    alert((e as Error).message);
    return;
  }
  renderSheet(c);
}

function renderSheet(c: AdminCharRow, note?: { text: string; ok: boolean }): void {
  if (!meta) return;
  const m = meta;
  // Redrawing after an edit keeps the scroll position, so the phone doesn't jump back to the top.
  const scroll = sheet?.scrollTop ?? 0;
  closeSheet();
  const result = h('div', { class: `msg ${note ? (note.ok ? 'ok' : 'bad') : ''}` }, note?.text ?? '');

  /** Sends one edit; on success the sheet redraws with the new numbers. */
  const run = async (what: string, body: unknown, btn: HTMLButtonElement, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    btn.disabled = true;
    result.className = 'msg';
    result.textContent = 'กำลังส่ง…';
    try {
      const r = await api<AdminEditResult>('POST', `/admin/characters/${c.charId}/${what}`, body);
      if (r.char) renderSheet(r.char, { text: r.msg, ok: true });
      else {
        result.className = 'msg ok';
        result.textContent = r.msg;
      }
    } catch (e) {
      result.className = 'msg bad';
      result.textContent = (e as Error).message;
      btn.disabled = false;
    }
  };
  const numInput = (value: number, min: number, max: number) => h('input', { type: 'number', inputMode: 'numeric', value: String(value), min: String(min), max: String(max), step: '1' });
  const intOf = (i: HTMLInputElement) => Math.trunc(Number(i.value));

  // Level
  const lv = numInput(c.level, 1, m.maxLevel);
  const exp = numInput(c.exp, 0, c.expToNext - 1);
  const lvBtn = h('button', { class: 'primary' }, 'ตั้งเลเวล');
  lvBtn.onclick = () => void run('level', { level: intOf(lv), exp: intOf(exp) }, lvBtn);

  // Gold
  const gold = numInput(Number(form.gold) || 10000, 1, m.goldMax);
  gold.oninput = () => (form.gold = gold.value);
  const giveBtn = h('button', { class: 'primary' }, 'ให้ทอง');
  const takeBtn = h('button', {}, 'ลดทอง');
  giveBtn.onclick = () => void run('gold', { delta: intOf(gold) }, giveBtn);
  takeBtn.onclick = () => void run('gold', { delta: -intOf(gold) }, takeBtn);

  // Items
  const base = h('select');
  for (const slot of Object.keys(SLOT_LABEL) as (keyof typeof SLOT_LABEL)[]) {
    const group = h('optgroup', { label: SLOT_LABEL[slot] });
    for (const b of m.bases.filter((x) => x.slot === slot)) {
      group.append(h('option', { value: b.id }, `${b.names[c.classId] ?? b.names.any ?? b.id} (Lv.${b.minLevel}+)`));
    }
    base.append(group);
  }
  const rarity = h('select', {}, ...m.rarities.map((r) => h('option', { value: r, style: `color:${RARITY_COLOR[r]}` }, RARITY_LABEL[r])));
  const plus = h('select', {}, ...Array.from({ length: m.maxPlus + 1 }, (_, i) => h('option', { value: String(i) }, `+${i}`)));
  const plusWrap = h('label', {}, 'ตีบวก', plus);
  const syncPlus = () => {
    const weapon = m.bases.find((b) => b.id === base.value)?.slot === 'weapon';
    plusWrap.classList.toggle('hidden', !weapon);
    if (!weapon) plus.value = '0';
  };
  if (m.bases.some((b) => b.id === form.baseId)) base.value = form.baseId;
  rarity.value = form.rarity;
  plus.value = form.plus;
  base.onchange = () => {
    form.baseId = base.value;
    syncPlus();
  };
  rarity.onchange = () => (form.rarity = rarity.value);
  plus.onchange = () => (form.plus = plus.value);
  syncPlus();
  const itemLv = numInput(c.level, 1, m.maxLevel);
  const count = numInput(Number(form.count) || 1, 1, m.itemsMax);
  count.oninput = () => (form.count = count.value);
  const itemBtn = h('button', { class: 'primary' }, 'เสกไอเทม');
  itemBtn.onclick = () => void run('items', {
    baseId: base.value, rarity: rarity.value, plus: Number(plus.value), level: intOf(itemLv), count: intOf(count),
  }, itemBtn);

  // Zone
  const zone = h('select', {}, ...m.zones.map((z) => h('option', { value: z.id, selected: z.id === c.zone }, `${z.nameTh} (Lv.${z.levels[0]}–${z.levels[1]})`)));
  const tpBtn = h('button', { class: 'primary' }, 'ย้ายโซน');
  tpBtn.onclick = () => void run('teleport', { zone: zone.value }, tpBtn);

  const kickBtn = h('button', { class: 'danger' }, 'เตะออกจากเกม');
  kickBtn.onclick = () => void run('kick', {}, kickBtn, `เตะ ${c.name} ออกจากเกม?`);

  const fact = (label: string, v: string) => h('div', {}, `${label} `, h('b', {}, v));
  const bg = h('div', { class: 'sheet-bg', onclick: (ev: Event) => ev.target === bg && closeSheet() });
  bg.append(h('div', { class: 'sheet' },
    h('div', { class: 'sheet-head' },
      h('div', {},
        h('h2', {}, c.name, h('span', { class: c.online ? 'tag on' : 'tag' }, c.online ? 'ออนไลน์' : 'ออฟไลน์')),
        h('div', { class: 'muted' }, `บัญชี ${c.username} · ${className(c.classId)}`),
      ),
      h('button', { class: 'x small', onclick: closeSheet }, '✕'),
    ),
    h('div', { class: 'facts' },
      fact('เลเวล', String(c.level)),
      fact('EXP', `${fmt(c.exp)} / ${fmt(c.expToNext)}`),
      fact('ทอง', `${fmt(c.gold)} G`),
      fact('โซน', zoneName(c.zone)),
      fact('กระเป๋าว่าง', `${c.bagFree} ช่อง`),
    ),
    c.online ? null : h('div', { class: 'muted' }, 'ตัวละครออฟไลน์: แก้ในเซฟ มีผลเมื่อเข้าเกมครั้งถัดไป'),
    h('section', {}, h('h3', {}, `เลเวล / EXP (สูงสุด Lv.${m.maxLevel})`),
      h('div', { class: 'row' }, h('label', {}, 'เลเวล', lv), h('label', {}, 'EXP', exp), lvBtn)),
    h('section', {}, h('h3', {}, `ทอง (ครั้งละไม่เกิน ${fmt(m.goldMax)} G)`),
      h('div', { class: 'row' }, h('label', {}, 'จำนวน', gold), giveBtn, takeBtn)),
    h('section', {}, h('h3', {}, `เสกไอเทมใส่กระเป๋า (ครั้งละไม่เกิน ${m.itemsMax} ชิ้น)`),
      h('div', { class: 'row' }, h('label', { style: 'flex-basis:100%' }, 'ชนิด', base)),
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('label', {}, 'ความหายาก', rarity), plusWrap, h('label', {}, 'เลเวลไอเทม', itemLv), h('label', {}, 'จำนวน', count), itemBtn)),
    h('section', {}, h('h3', {}, 'ย้ายโซน (ไปที่แคมป์)'),
      h('div', { class: 'row' }, h('label', {}, 'โซน', zone), tpBtn)),
    c.online ? h('section', {}, h('div', { class: 'row' }, kickBtn)) : null,
    h('div', { class: 'result' }, result),
  ));
  sheet = bg;
  document.body.append(bg);
  bg.scrollTop = scroll;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});

// ------------------------------------------------------------ roles (owner)

async function renderRoles(): Promise<void> {
  const list = h('div');
  const msg = h('div', { class: 'msg' });
  const user = h('input', { placeholder: 'ชื่อผู้ใช้ หรือชื่อตัวละครที่ออนไลน์', autocapitalize: 'off' });
  const matches = h('div');

  const drawList = (rows: RoleRow[]) => {
    list.replaceChildren(...rows.map((r) => h('div', { class: 'list-item' },
      h('div', { class: 'grow' }, r.username, h('span', { class: 'role', style: 'margin-left:8px' }, r.role === 'owner' ? 'Owner' : 'GM')),
      r.role === 'gm' ? h('button', { class: 'small danger', onclick: () => void setRole(r.username, null) }, 'ถอนสิทธิ์') : null,
    )));
    if (!rows.length) list.append(h('div', { class: 'muted' }, 'ยังไม่มีผู้ดูแล'));
  };
  const setRole = async (username: string, role: 'gm' | null) => {
    if (!confirm(role ? `ให้สิทธิ์ GM กับบัญชี ${username}?` : `ถอนสิทธิ์ GM ของ ${username}?`)) return;
    msg.className = 'msg';
    msg.textContent = 'กำลังส่ง…';
    try {
      drawList(await api<RoleRow[]>('POST', '/admin/roles', { username, role }));
      msg.className = 'msg ok';
      msg.textContent = role ? `ให้สิทธิ์ GM กับ ${username} แล้ว` : `ถอนสิทธิ์ GM ของ ${username} แล้ว`;
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
    }
  };
  // Online players matching what is typed (account or character name), to pick from.
  const drawMatches = async () => {
    const q = user.value.trim().toLowerCase();
    if (!q) return matches.replaceChildren();
    try {
      online = await api<AdminOnline>('GET', '/admin/online');
    } catch {
      return;
    }
    const hits = online.players.filter((p) => !p.guest && (p.username.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))).slice(0, 8);
    matches.replaceChildren(...hits.map((p) => h('div', { class: 'list-item' },
      h('div', { class: 'grow' }, p.username, h('span', { class: 'muted' }, ` · ${p.name} Lv.${p.level} (ออนไลน์)`)),
      h('button', { class: 'small', onclick: () => void setRole(p.username, 'gm') }, 'ให้ GM'),
    )));
  };
  let debounce = 0;
  user.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = window.setTimeout(() => void drawMatches(), 250);
  });
  const form = h('form', { class: 'row' }, h('label', {}, 'ค้นหาผู้เล่นออนไลน์ หรือพิมพ์ชื่อบัญชี', user), h('button', { class: 'primary', type: 'submit' }, 'ให้สิทธิ์ GM'));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const u = user.value.trim();
    if (u) void setRole(u, 'gm');
  });

  view.append(
    h('div', { class: 'card' }, h('h2', {}, 'ผู้ดูแลตอนนี้'), list),
    h('div', { class: 'card' }, h('h2', {}, 'ให้สิทธิ์ GM'),
      h('div', { class: 'muted', style: 'margin:-6px 0 8px' }, 'GM ดูผู้เล่นและแก้ตัวละครได้ แต่ให้สิทธิ์คนอื่นหรือดูประวัติไม่ได้'),
      form, matches, msg),
  );
  try {
    drawList(await api<RoleRow[]>('GET', '/admin/roles'));
  } catch (e) {
    msg.className = 'msg bad';
    msg.textContent = (e as Error).message;
  }
}

// ------------------------------------------------------------ audit (owner)

const ACTION_TH: Record<string, string> = {
  level: 'ตั้งเลเวล', gold: 'ทอง', items: 'เสกไอเทม', kick: 'เตะ', teleport: 'ย้ายโซน', grant: 'ให้สิทธิ์', revoke: 'ถอนสิทธิ์',
};

async function renderAudit(): Promise<void> {
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

void start();
