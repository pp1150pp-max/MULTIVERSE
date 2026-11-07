// The admin page (/admin). Shows what /api/admin returns and sends edits to it; the server checks the
// role and every value, so nothing here is a safeguard. Names, GPU strings and the like come from
// players: they are only ever put on the page as text (never as HTML).
import './admin.css';
import { ADMIN_AUDIT_PAGE, ADMIN_ITEM_ROWS_MAX, ADMIN_STAT_MULT, statStep, type AdminItemRow, ADMIN_NO_RIGHTS as NO_RIGHTS, HISTORY_DAYS, HISTORY_PAGE, BAN_DURATIONS, BAN_FOREVER, BAN_REASON_MAX, BROADCAST_EVERY_MS, BROADCAST_MAX } from '../shared/admin';
import { MAX_CHARACTERS } from '../shared/api';
import { entryName } from '../shared/data/potions';
import type {
  AdminAccountDetail, AdminAccountsResponse, AdminFeature, AdminStats, BackupRow, ChatLogRow, PlaySessionRow, StatsPoint, StatsRange, AdminCharRow, AdminEditResult, AdminMe, AdminMeta, AdminOnline, AdminOnlineRow, AdminServerState, AuditRow, RoleRow,
} from '../shared/admin';
import { CLASSES } from '../shared/data/classes';
import { itemNames, makeItem, roundStat, rowRanges, tierOf } from '../shared/data/items';
import { SHUTDOWN_SECONDS, type ShutdownMode } from '../shared/net/protocol';
import { isStack, RARITY_COLOR, RARITY_LABEL, SLOT_LABEL, SLOTS, STAT_KEYS, STAT_LABEL, type BagEntry, type ClassId, type Item, type Rarity } from '../shared/types';

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
    // A 403 with its own reason (e.g. a GM editing the owner's character) is shown where it happened;
    // only the plain "no rights" one means this login lost its role.
    if (res.status === 401 || (res.status === 403 && data.error === NO_RIGHTS)) onAuthLost(err);
    throw err;
  }
  return data;
}

const fmt = (n: number): string => n.toLocaleString('th-TH');
/** "12 นาที", or "1 ชม. 5 นาที" from an hour on. */
const playedFor = (ms: number): string => {
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m} นาที` : `${Math.floor(m / 60)} ชม. ${m % 60} นาที`;
};
const className = (id: ClassId): string => CLASSES[id]?.nameTh ?? id;
const time = (ms: number): string =>
  new Date(ms).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });

// ------------------------------------------------------------ state

const root = document.getElementById('admin')!;
let me: AdminMe | null = null;
let meta: AdminMeta | null = null;
let online: AdminOnline | null = null;
type Tab = 'online' | 'search' | 'users' | 'stats' | 'sessions' | 'chat' | 'roles' | 'audit' | 'server';
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
  if (me.features.includes('users')) tabs.push(['users', 'ผู้ใช้ทั้งหมด']);
  if (me.features.includes('stats')) tabs.push(['stats', 'สถิติ']);
  if (me.features.includes('sessions')) tabs.push(['sessions', 'การเข้าเล่น']);
  if (me.features.includes('chatLog')) tabs.push(['chat', 'แชท']);
  if (me.role === 'owner') tabs.push(['roles', 'สิทธิ์ GM'], ['audit', 'ประวัติ']);
  if (me.role === 'owner' || me.features.includes('broadcast') || me.features.includes('backup')) tabs.push(['server', 'Server']);
  const bar = h('nav', { class: 'tabs' }, ...tabs.map(([id, label]) =>
    h('button', { class: id === tab ? 'on' : '', 'data-tab': id, onclick: () => setTab(id) }, label)));
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
  document.querySelectorAll<HTMLElement>('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  // On a phone the tab row scrolls: keep the chosen tab in view.
  document.querySelector<HTMLElement>('.tabs button.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  view.replaceChildren();
  if (t === 'online') renderOnline();
  else if (t === 'search') renderSearch();
  else if (t === 'users') void renderUsers();
  else if (t === 'stats') void renderStats();
  else if (t === 'sessions') void renderSessions();
  else if (t === 'chat') void renderChat();
  else if (t === 'roles') void renderRoles();
  else if (t === 'audit') void renderAudit();
  else void renderServer();
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
        h('thead', {}, h('tr', {}, ...['ตัวละคร', 'บัญชี', 'คลาส', 'Lv', 'โซน', 'เล่นมาแล้ว', 'Ping', 'FPS', 'เฟรมนานสุด', 'GPU', 'IP',
          ...(can('broadcast') ? [''] : [])].map((t) => h('th', {}, t)))),
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
      if (!online.players.length) body.append(h('tr', {}, h('td', { colSpan: 12, class: 'muted' }, 'ยังไม่มีใครออนไลน์')));
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
    cell('เล่นมาแล้ว', playedFor(p.playedMs), 'num'),
    numCell('Ping', p.rtt, ' ms', (p.rtt ?? 0) > PING_BAD),
    p.hidden && p.fps === null ? cell('FPS', 'แท็บซ่อน', 'num muted') : numCell('FPS', p.fps, '', p.fps !== null && p.fps < FPS_BAD),
    numCell('เฟรมนานสุด', p.maxFrame, ' ms', (p.maxFrame ?? 0) >= FRAME_BAD),
    h('td', { 'data-label': 'GPU', class: 'gpu', title: p.gpu ?? '' }, p.gpu ?? '—'),
    h('td', { 'data-label': 'IP', class: 'ip', title: p.ip }, p.ip),
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
const form = { baseId: '', rarity: 'common', plus: '0', count: '1', gold: '10000', level: '' };
/**
 * The example item of the chosen-stats spawn (owner): rolled like a drop, then edited. Kept while the
 * sheet redraws; `key` is what it was rolled for (kind, rarity, level, class), a change rolls a new one.
 */
let example: { key: string; name: string; rows: AdminItemRow[] } | null = null;

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
  for (const slot of SLOTS) {
    const group = h('optgroup', { label: SLOT_LABEL[slot] });
    // Off-hands exist per class: only this character's are offered.
    for (const b of m.bases.filter((x) => x.slot === slot && (x.names.any || x.names[c.classId]))) {
      group.append(h('option', { value: b.id }, `${b.names[c.classId] ?? b.names.any ?? b.id} (Lv.${b.minLevel}+)`));
    }
    base.append(group);
  }
  const rarity = h('select', {}, ...m.rarities.map((r) => h('option', { value: r, style: `color:${RARITY_COLOR[r]}` }, RARITY_LABEL[r])));
  const plus = h('select', {}, ...Array.from({ length: m.maxPlus + 1 }, (_, i) => h('option', { value: String(i) }, `+${i}`)));
  const plusWrap = h('label', {}, 'ตีบวก', plus);
  if (m.bases.some((b) => b.id === form.baseId)) base.value = form.baseId;
  rarity.value = form.rarity;
  plus.value = form.plus;
  base.onchange = () => (form.baseId = base.value);
  rarity.onchange = () => (form.rarity = rarity.value);
  plus.onchange = () => (form.plus = plus.value);
  const itemLv = numInput(Number(form.level) || c.level, 1, m.maxLevel);
  itemLv.oninput = () => (form.level = itemLv.value);
  const count = numInput(Number(form.count) || 1, 1, m.itemsMax);
  count.oninput = () => (form.count = count.value);
  const itemBtn = h('button', { class: 'primary' }, 'เสกไอเทม');
  const custom = can('customItem');
  /** The item level actually used: a kind never comes below its own minimum level. */
  const effLevel = (): number => {
    const b = m.bases.find((x) => x.id === base.value);
    return Math.max(b?.minLevel ?? 1, Math.min(m.maxLevel, Math.max(1, intOf(itemLv) || 1)));
  };
  const exampleBox = h('div', { class: 'example' });
  /** Rolls a new example for the current choices (or keeps the one already made for them). */
  const ensureExample = (reroll = false) => {
    const key = `${base.value}|${rarity.value}|${effLevel()}|${c.classId}`;
    if (!reroll && example?.key === key) return;
    const item = makeItem(base.value, rarity.value as Rarity, effLevel(), c.classId);
    example = item ? { key, name: item.name, rows: (item.lines ?? []).map((l) => ({ stat: l.stat, value: l.value })) } : null;
  };
  const drawExample = () => {
    exampleBox.replaceChildren();
    if (!example) return;
    const ex = example;
    const rar = rarity.value as Rarity;
    const ranges = rowRanges(base.value, rar, effLevel(), ex.rows.map((r) => r.stat)) ?? [];
    const names = itemNames(base.value, rar, c.classId);
    const nameEl = names.length > 1
      ? h('select', { onchange: (e: Event) => (ex.name = (e.target as HTMLSelectElement).value) }, ...names.map((n) => h('option', { value: n, selected: n === ex.name }, n)))
      : h('b', {}, ex.name);
    const rerollBtn = h('button', { class: 'small', type: 'button' }, 'สุ่มใหม่');
    rerollBtn.onclick = () => { ensureExample(true); drawExample(); };
    const addBtn = h('button', { class: 'small', type: 'button', disabled: ex.rows.length >= ADMIN_ITEM_ROWS_MAX }, '+ เพิ่มแถว');
    addBtn.onclick = () => {
      const used = new Set(ex.rows.map((r) => r.stat));
      const stat = STAT_KEYS.find((k) => !used.has(k)) ?? 'atk';
      const r = rowRanges(base.value, rar, effLevel(), [...ex.rows.map((x) => x.stat), stat])!.at(-1)!;
      ex.rows.push({ stat, value: roundStat(stat, (r.lo + r.hi) / 2) });
      drawExample();
    };
    const rows = ex.rows.map((row, i) => {
      const r = ranges[i];
      const top = roundStat(row.stat, r.hi * ADMIN_STAT_MULT);
      const step = statStep(row.stat);
      const info = h('span', { class: 'muted' });
      const showInfo = () => {
        const bad = !(row.value >= step && row.value <= top);
        info.textContent = `ปกติ ${r.min}–${r.max} · T${tierOf(row.value, r.lo, r.hi)}${r.main ? ' · สเตตัสหลัก' : ''}${bad ? ` · ต้องอยู่ระหว่าง ${step}–${top}` : ''}`;
        info.style.color = bad ? 'var(--bad)' : '';
      };
      const stat = h('select', {}, ...STAT_KEYS.map((k) => h('option', { value: k, selected: k === row.stat }, STAT_LABEL[k])));
      stat.onchange = () => {
        row.stat = stat.value as AdminItemRow['stat'];
        const nr = rowRanges(base.value, rar, effLevel(), ex.rows.map((x) => x.stat))![i];
        row.value = roundStat(row.stat, (nr.lo + nr.hi) / 2);
        drawExample();
      };
      const val = h('input', { type: 'number', value: String(row.value), min: String(step), max: String(top), step: String(step) });
      val.oninput = () => { row.value = Number(val.value); showInfo(); };
      const del = h('button', { class: 'small', type: 'button', title: 'ลบแถว' }, '✕');
      del.onclick = () => { ex.rows.splice(i, 1); drawExample(); };
      showInfo();
      return h('div', { class: 'row example-row' }, stat, val, info, del);
    });
    exampleBox.append(
      h('div', { class: 'row example-head' }, h('span', {}, 'ตัวอย่าง: ', nameEl, ` [${RARITY_LABEL[rar]}] Lv.${effLevel()}`), rerollBtn),
      ...rows,
      ...(ex.rows.length ? [] : [h('div', { class: 'muted' }, 'ไม่มีสเตตัส')]),
      h('div', { class: 'row' }, addBtn, h('span', { class: 'muted' }, `สูงสุด ${ADMIN_ITEM_ROWS_MAX} แถว · ค่าได้ถึง ${ADMIN_STAT_MULT} เท่าของค่าสูงสุดปกติ · ทุกชิ้นได้ตามตัวอย่างนี้`)),
    );
  };
  const refreshExample = () => {
    if (!custom) return;
    // Show the level the example is really made at (a kind's minimum level can raise it).
    if (intOf(itemLv) !== effLevel()) form.level = itemLv.value = String(effLevel());
    ensureExample();
    drawExample();
  };
  base.addEventListener('change', refreshExample);
  rarity.addEventListener('change', refreshExample);
  itemLv.addEventListener('change', refreshExample);
  refreshExample();
  itemBtn.onclick = () => void run('items', {
    baseId: base.value, rarity: rarity.value, plus: Number(plus.value), level: custom ? effLevel() : intOf(itemLv), count: intOf(count),
    ...(custom && example ? { name: example.name, lines: example.rows } : {}),
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
        h('label', {}, 'ความหายาก', rarity), plusWrap, h('label', {}, 'เลเวลไอเทม', itemLv), h('label', {}, 'จำนวน', count), itemBtn),
      custom ? exampleBox : null),
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

  let admins: RoleRow[] = [];
  const drawList = (rows: RoleRow[]) => {
    admins = rows;
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
      void drawMatches();
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
    matches.replaceChildren(...hits.map((p) => {
      // Already an admin: say so (and offer the revoke for a GM) instead of another "ให้ GM".
      const role = admins.find((r) => r.username === p.username)?.role;
      return h('div', { class: 'list-item' },
        h('div', { class: 'grow' }, p.username, h('span', { class: 'muted' }, ` · ${p.name} Lv.${p.level} (ออนไลน์)`)),
        role ? h('span', { class: 'role' }, role === 'owner' ? 'Owner' : 'GM แล้ว') : null,
        role === 'gm' ? h('button', { class: 'small danger', onclick: () => void setRole(p.username, null) }, 'ถอนสิทธิ์') : null,
        role ? null : h('button', { class: 'small', onclick: () => void setRole(p.username, 'gm') }, 'ให้ GM'),
      );
    }));
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
  server: 'Server', password: 'ตั้งรหัสผ่าน', ban: 'แบน', unban: 'ปลดแบน', broadcast: 'ประกาศ', backup: 'สำรองข้อมูล',
  'delete-account': 'ลบบัญชี', 'delete-character': 'ลบตัวละคร', 'chat-delete': 'ลบแชท',
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

// ------------------------------------------------------------ server (owner)

async function renderServer(): Promise<void> {
  // Restart / shut down first: it is what the owner comes here for in a hurry (the backup list is long).
  const restart = me?.role === 'owner' ? renderRestart() : null;
  if (can('broadcast')) view.append(broadcastCard());
  if (can('backup')) view.append(backupCard());
  await restart;
}

async function renderRestart(): Promise<void> {
  const status = h('div', { class: 'msg' });
  const restart = h('button', { class: 'primary' }, 'รีสตาร์ท');
  const stop = h('button', { class: 'danger' }, 'ปิด server');
  const cancel = h('button', { class: 'primary hidden' }, 'ยกเลิกการนับถอยหลัง');
  const draw = (st: AdminServerState) => {
    restart.disabled = stop.disabled = !!st.stopping;
    cancel.classList.toggle('hidden', !st.stopping);
    cancel.disabled = false;
    if (!st.stopping) {
      status.className = 'msg';
      status.textContent = '';
    }
    restart.title = st.supervised ? '' : 'server นี้ไม่ได้เปิดด้วย npm run online';
    if (!st.supervised) restart.disabled = true;
    if (st.stopping) {
      status.className = 'msg bad';
      status.textContent = st.stopping === 'restart'
        ? `กำลังนับถอยหลังรีสตาร์ท (${SHUTDOWN_SECONDS} วินาที) — หน้านี้จะต่อไม่ได้ชั่วครู่ แล้วรีเฟรชใหม่`
        : `กำลังนับถอยหลังปิด server (${SHUTDOWN_SECONDS} วินาที)`;
    }
  };
  const go = async (mode: ShutdownMode, btn: HTMLButtonElement) => {
    const what = mode === 'restart' ? 'รีสตาร์ท server' : 'ปิด server';
    if (!confirm(`${what}?

ผู้เล่นทุกคนจะเห็นคำเตือน ${SHUTDOWN_SECONDS} วินาที แล้วถูกเซฟและตัดการเชื่อมต่อ`)) return;
    btn.disabled = true;
    try {
      draw(await api<AdminServerState>('POST', '/admin/server', { mode }));
    } catch (e) {
      status.className = 'msg bad';
      status.textContent = (e as Error).message;
      btn.disabled = false;
    }
  };
  cancel.onclick = async () => {
    cancel.disabled = true;
    try {
      draw(await api<AdminServerState>('POST', '/admin/server', { mode: 'cancel' }));
      status.className = 'msg ok';
      status.textContent = 'ยกเลิกแล้ว — ผู้เล่นได้รับแจ้ง และเข้าเกมได้ตามปกติ';
    } catch (e) {
      status.className = 'msg bad';
      status.textContent = (e as Error).message;
      cancel.disabled = false;
    }
  };
  restart.onclick = () => void go('restart', restart);
  stop.onclick = () => void go('shutdown', stop);
  const note = h('div', { class: 'muted', style: 'margin:-6px 0 10px' },
    `ทั้งสองแบบ: ผู้เล่นเห็นคำเตือนนับถอยหลัง ${SHUTDOWN_SECONDS} วินาที และเข้าเกมใหม่ไม่ได้ระหว่างนั้น แล้ว server เซฟทุกคนก่อนตัดการเชื่อมต่อ · `
    + 'รีสตาร์ท = เปิดใหม่ด้วยโค้ดที่ build ไว้แล้ว (ไม่ build ใหม่) ลิงก์เพื่อนไม่เปลี่ยน · ปิด server = ปิดเลย ต้องเปิดใหม่เองที่เครื่อง');
  view.append(h('div', { class: 'card' }, h('h2', {}, 'รีสตาร์ท / ปิด server'), note, h('div', { class: 'row' }, restart, stop, cancel), status));
  try {
    const st = await api<AdminServerState>('GET', '/admin/server');
    draw(st);
    if (!st.supervised && !st.stopping) {
      status.className = 'msg';
      status.textContent = 'server นี้ไม่ได้เปิดด้วย npm run online จึงรีสตาร์ทเองไม่ได้ (ปิดได้อย่างเดียว)';
    }
  } catch (e) {
    status.className = 'msg bad';
    status.textContent = (e as Error).message;
  }
}


// ------------------------------------------------------------ every account (owner tools)

const can = (f: AdminFeature): boolean => !!me?.features.includes(f);
const dateOnly = (ms: number): string => new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
const ago = (ms: number): string => {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'เมื่อสักครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีก่อน`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ก่อน`;
  return `${Math.floor(s / 86400)} วันก่อน`;
};
const banText = (until: number): string => (until >= BAN_FOREVER ? 'ถาวร' : `ถึง ${time(until)}`);

type UserSort = 'username' | 'createdAt' | 'lastOnline' | 'characters' | 'maxLevel' | 'totalGold' | 'stashSize';
const users = { q: '', filter: 'all', sort: 'createdAt' as UserSort, desc: true };

async function renderUsers(): Promise<void> {
  const chips = h('div', { class: 'zones' });
  const body = h('tbody');
  const msg = h('div', { class: 'msg' });
  const q = h('input', { placeholder: 'ชื่อผู้ใช้ หรือชื่อตัวละคร', value: users.q, autocapitalize: 'off' });
  const filter = h('select', {},
    ...[['all', 'ทั้งหมด'], ['real', 'บัญชีจริง'], ['guest', 'Guest'], ['admin', 'GM / Owner'], ['banned', 'ถูกแบน'], ['online', 'ออนไลน์']]
      .map(([v, l]) => h('option', { value: v, selected: v === users.filter }, l)));
  const cols: [UserSort | null, string][] = [
    ['username', 'ชื่อผู้ใช้'], [null, 'ประเภท'], [null, 'สิทธิ์'], ['createdAt', 'สมัครเมื่อ'], ['lastOnline', 'ออนไลน์ล่าสุด'],
    ['characters', 'ตัวละคร'], ['maxLevel', 'Lv สูงสุด'], ['totalGold', 'ทองรวม'], ['stashSize', 'คลัง'],
  ];
  const sort = h('select', {}, ...cols.filter(([k]) => k).map(([k, l]) => h('option', { value: k!, selected: k === users.sort }, `เรียงตาม${l}`)));
  const head = h('tr');
  let data: AdminAccountsResponse | null = null;

  const draw = () => {
    if (!data) return;
    const s = data.summary;
    chips.replaceChildren(...([['บัญชี', s.accounts], ['Guest', s.guests], ['ตัวละคร', s.characters], ['สมัครวันนี้', s.signupsToday]] as const)
      .map(([l, n]) => h('div', { class: 'zone-chip' }, h('b', {}, fmt(n)), h('span', {}, l))));
    head.replaceChildren(...cols.map(([k, l]) => h('th', {
      class: k ? 'sortable' : '',
      onclick: k ? () => {
        users.desc = users.sort === k ? !users.desc : k !== 'username';
        users.sort = k;
        sort.value = k;
        draw();
      } : undefined,
    }, l + (k && k === users.sort ? (users.desc ? ' ▼' : ' ▲') : ''))));
    const needle = users.q.trim().toLowerCase();
    const rows = data.rows.filter((r) => {
      if (users.filter === 'real' && r.guest) return false;
      if (users.filter === 'guest' && !r.guest) return false;
      if (users.filter === 'admin' && !r.role) return false;
      if (users.filter === 'banned' && !r.bannedUntil) return false;
      if (users.filter === 'online' && !r.online) return false;
      return !needle || r.username.toLowerCase().includes(needle) || r.names.some((n) => n.toLowerCase().includes(needle));
    });
    const key = users.sort;
    rows.sort((a, b) => {
      const va = key === 'lastOnline' ? (a.online ? Infinity : a.lastOnline ?? 0) : key === 'stashSize' ? a.stashSize ?? 0 : a[key];
      const vb = key === 'lastOnline' ? (b.online ? Infinity : b.lastOnline ?? 0) : key === 'stashSize' ? b.stashSize ?? 0 : b[key];
      const c = typeof va === 'string' ? va.localeCompare(String(vb)) : (va as number) - (vb as number);
      return users.desc ? -c : c;
    });
    msg.textContent = `แสดง ${rows.length} จาก ${data.rows.length} บัญชี`;
    body.replaceChildren(...rows.map((r) => {
      const cell = (label: string, content: Node | string, cls = '') => h('td', { 'data-label': label, class: cls }, content);
      return h('tr', { class: 'click', onclick: () => void openAccount(r.accountId) },
        cell('ชื่อผู้ใช้', h('span', {}, r.guest ? `Guest · ${r.names[0] ?? ''}` : r.username,
          r.bannedUntil ? h('span', { class: 'tag ban' }, 'แบน') : null), 'head'),
        cell('ประเภท', r.guest ? 'Guest' : 'บัญชีจริง'),
        cell('สิทธิ์', r.role ? h('span', { class: 'role' }, r.role === 'owner' ? 'Owner' : 'GM') : '–'),
        cell('สมัครเมื่อ', dateOnly(r.createdAt)),
        cell('ออนไลน์ล่าสุด', r.online ? h('span', { class: 'good' }, '🟢 ออนไลน์') : r.lastOnline ? ago(r.lastOnline) : '–'),
        cell('ตัวละคร', `${r.characters}/${MAX_CHARACTERS}`, 'num'),
        cell('Lv สูงสุด', r.maxLevel ? String(r.maxLevel) : '–', 'num'),
        cell('ทองรวม', fmt(r.totalGold), 'num'),
        cell('คลัง', r.stashSize === null ? '–' : `${r.stashSize} ช่อง`, 'num'),
      );
    }));
    if (!rows.length) body.append(h('tr', {}, h('td', { colSpan: cols.length, class: 'muted' }, 'ไม่พบบัญชี')));
  };
  const load = async () => {
    try {
      data = await api<AdminAccountsResponse>('GET', '/admin/accounts');
      draw();
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
    }
  };
  reloadUsers = () => void load();
  q.addEventListener('input', () => {
    users.q = q.value;
    draw();
  });
  filter.onchange = () => {
    users.filter = filter.value;
    draw();
  };
  sort.onchange = () => {
    users.sort = sort.value as UserSort;
    users.desc = users.sort !== 'username';
    draw();
  };
  view.append(chips, h('div', { class: 'card' },
    h('h2', {}, 'ผู้ใช้ทั้งหมด'),
    h('div', { class: 'muted', style: 'margin:-6px 0 8px' }, 'กดที่บัญชีเพื่อดูตัวละคร กระเป๋า และคลัง · "ออนไลน์ล่าสุด" ของบัญชีจริงเริ่มบันทึกตั้งแต่อัปเดตนี้'),
    h('div', { class: 'row' }, h('label', { style: 'flex-basis:200px' }, 'ค้นหา', q), h('label', {}, 'แสดง', filter), h('label', {}, 'เรียง', sort)),
    msg,
    h('table', { class: 'cards', style: 'margin-top:8px' }, h('thead', {}, head), body),
  ));
  await load();
}

/** Redraws the users table after an action in the account sheet. */
let reloadUsers: () => void = () => {};

function itemLabel(e: BagEntry): Node {
  if (isStack(e)) return h('span', {}, entryName(e));
  return h('span', { style: `color:${RARITY_COLOR[e.rarity]}` },
    `${e.plus ? `+${e.plus} ` : ''}${e.name}`, h('span', { class: 'muted' }, ` Lv.${e.level} · ${RARITY_LABEL[e.rarity]}`));
}

function itemList(entries: (BagEntry | null)[], empty: string): HTMLElement {
  const items = entries.filter((e): e is BagEntry => !!e);
  if (!items.length) return h('div', { class: 'muted' }, empty);
  return h('ul', { class: 'items' }, ...items.map((e) => h('li', {}, itemLabel(e))));
}

/** The account sheet's open tab, kept while it redraws after an action. */
let acctTab = { id: -1, key: '' };

async function openAccount(id: number, note?: { text: string; ok: boolean; password?: string }): Promise<void> {
  let d: AdminAccountDetail;
  try {
    d = await api<AdminAccountDetail>('GET', `/admin/accounts/${id}`);
  } catch (e) {
    alert((e as Error).message);
    return;
  }
  const a = d.account;
  const scroll = sheet?.scrollTop ?? 0;
  closeSheet();
  const result = h('div', { class: `msg ${note ? (note.ok ? 'ok' : 'bad') : ''}` }, note?.text ?? '');
  const fail = (e: unknown) => {
    result.className = 'msg bad';
    result.textContent = (e as Error).message;
  };
  const after = (text: string, password?: string) => {
    reloadUsers();
    void openAccount(id, { text, ok: true, password });
  };
  const display = a.guest ? `Guest · ${a.names[0] ?? ''}` : a.username;
  const confirmText = a.guest ? (a.names[0] ?? 'Guest') : a.username;

  const sections: (Node | null)[] = [];
  if (note?.password) {
    sections.push(h('div', { class: 'temp-pw' },
      h('div', {}, 'รหัสผ่านชั่วคราว (แสดงครั้งเดียว — จดไว้ส่งให้ผู้เล่น):'),
      h('code', {}, note.password)));
  }
  // Tools
  const tools: Node[] = [];
  if (can('resetPassword') && !a.guest) {
    const btn = h('button', {}, 'ตั้งรหัสผ่านชั่วคราว');
    btn.onclick = async () => {
      if (!confirm(`ตั้งรหัสผ่านใหม่ให้ ${a.username}?\nรหัสเดิมใช้ไม่ได้อีก และเขาจะถูกออกจากระบบทุกเครื่อง`)) return;
      try {
        const r = await api<{ password: string; msg: string }>('POST', `/admin/accounts/${id}/password`);
        after(r.msg, r.password);
      } catch (e) {
        fail(e);
      }
    };
    tools.push(h('section', {}, h('h3', {}, 'รหัสผ่าน'), btn));
  }
  if (can('ban')) {
    if (a.bannedUntil) {
      const btn = h('button', { class: 'primary' }, 'ปลดแบน');
      btn.onclick = async () => {
        try {
          after((await api<{ msg: string }>('POST', `/admin/accounts/${id}/unban`)).msg);
        } catch (e) {
          fail(e);
        }
      };
      tools.push(h('section', {}, h('h3', {}, 'แบนอยู่'),
        h('div', { class: 'msg bad' }, `ถูกระงับ${banText(a.bannedUntil)} — ${a.banReason ?? ''}`), btn));
    } else {
      const dur = h('select', {}, ...BAN_DURATIONS.map((d) => h('option', { value: d.id }, d.label)));
      const reason = h('input', { placeholder: 'เหตุผล (ผู้เล่นจะเห็น)', maxLength: BAN_REASON_MAX });
      const btn = h('button', { class: 'danger' }, 'แบน');
      btn.onclick = async () => {
        const label = BAN_DURATIONS.find((d) => d.id === dur.value)?.label;
        if (!confirm(`แบน ${display} ${label}?${a.online ? '\n(ออนไลน์อยู่ จะถูกเตะออกทันที)' : ''}`)) return;
        try {
          after((await api<{ msg: string }>('POST', `/admin/accounts/${id}/ban`, { duration: dur.value, reason: reason.value })).msg);
        } catch (e) {
          fail(e);
        }
      };
      tools.push(h('section', {}, h('h3', {}, 'แบน / ระงับบัญชี'),
        h('div', { class: 'row' }, h('label', {}, 'นานเท่าไร', dur), h('label', { style: 'flex-basis:200px' }, 'เหตุผล', reason), btn)));
    }
  }
  if (me?.role === 'owner' && a.role !== 'owner') {
    const input = h('input', { placeholder: confirmText, autocapitalize: 'off' });
    const btn = h('button', { class: 'danger' }, 'ลบบัญชีถาวร');
    btn.onclick = async () => {
      if (input.value.trim().toLowerCase() !== confirmText.toLowerCase()) return fail(new Error(`พิมพ์ "${confirmText}" ให้ตรงก่อน`));
      if (!confirm(`ลบบัญชี ${display} พร้อมตัวละครทั้งหมดและคลัง?\nสำรองฐานข้อมูลอัตโนมัติก่อนลบ`)) return;
      try {
        const r = await api<{ msg: string }>('DELETE', `/admin/accounts/${id}`, { confirm: input.value });
        closeSheet();
        reloadUsers();
        alert(r.msg);
      } catch (e) {
        fail(e);
      }
    };
    tools.push(h('section', {}, h('h3', {}, 'ลบบัญชี'),
      h('div', { class: 'muted' }, `ขั้นที่ 1: พิมพ์ "${confirmText}" · ขั้นที่ 2: กดยืนยัน (สำรองฐานข้อมูลให้ก่อนลบ)`),
      h('div', { class: 'row', style: 'margin-top:6px' }, h('label', {}, 'พิมพ์ชื่อเพื่อยืนยัน', input), btn)));
  }

  /** More tabs (added by other features), shown before "จัดการ". */
  const extraPanes: [string, string, () => Node][] = [];

  // Characters
  const chars = d.characters.map((c) => {
    const eq = Object.values(c.equipment).filter((x): x is Item => !!x);
    let del: Node | null = null;
    if (me?.role === 'owner') {
      const input = h('input', { placeholder: c.name, autocapitalize: 'off' });
      const btn = h('button', { class: 'danger small' }, 'ลบตัวละคร');
      btn.onclick = async () => {
        if (input.value.trim().toLowerCase() !== c.name.toLowerCase()) return fail(new Error(`พิมพ์ "${c.name}" ให้ตรงก่อน`));
        if (!confirm(`ลบตัวละคร ${c.name} ถาวร?\nสำรองฐานข้อมูลอัตโนมัติก่อนลบ`)) return;
        try {
          after((await api<{ msg: string }>('DELETE', `/admin/characters/${c.charId}`, { confirm: input.value })).msg);
        } catch (e) {
          fail(e);
        }
      };
      del = h('details', {}, h('summary', { class: 'muted' }, 'ลบตัวละครนี้…'),
        h('div', { class: 'row', style: 'margin-top:6px' }, h('label', {}, `พิมพ์ "${c.name}"`, input), btn));
    }
    return h('div', { class: 'char-card' },
      h('div', { class: 'row', style: 'align-items:center' },
        h('div', { style: 'flex:1' }, h('b', {}, c.name), h('span', { class: c.online ? 'tag on' : 'tag' }, c.online ? 'ออนไลน์' : 'ออฟไลน์'),
          h('div', { class: 'muted' }, `${className(c.classId)} · Lv.${c.level} · ${zoneName(c.zone)} · ${fmt(c.gold)} G`)),
        h('button', { class: 'small', onclick: () => void openChar(c.charId) }, 'แก้ไข')),
      h('div', { class: 'sub' }, 'สวมใส่'), itemList(eq, 'ไม่ได้สวมอะไร'),
      h('div', { class: 'sub' }, `กระเป๋า (ว่าง ${c.bagFree} ช่อง)`), itemList(c.bag, 'กระเป๋าว่าง'),
      del,
    );
  });

  let sessionsBox: HTMLElement | null = null;
  if (can('sessions')) {
    const holder = h('div', { class: 'muted' }, 'กำลังโหลด…');
    sessionsBox = h('section', {}, h('h3', {}, 'การเข้าเล่นล่าสุด (10 ครั้ง)'), holder);
    void api<PlaySessionRow[]>('GET', `/admin/sessions?account=${id}`).then(
      (rows) => holder.replaceWith(sessionTable(rows.slice(0, 10), false)),
      (e) => (holder.textContent = (e as Error).message),
    );
  }
  if (sessionsBox) {
    const box = sessionsBox;
    extraPanes.push(['sessions', 'การเข้าเล่น', () => box]);
  }
  // One tab per character, then the stash, play history and the account tools (owner's choice).
  const panes: [string, string, () => Node][] = d.characters.map((c, i) => [`c${c.charId}`, c.name, () => chars[i]]);
  if (!chars.length) panes.push(['none', 'ตัวละคร', () => h('div', { class: 'muted' }, 'ไม่มีตัวละคร')]);
  if (!a.guest) {
    panes.push(['stash', 'คลัง', () => h('div', { class: 'char-card' },
      h('div', { class: 'sub', style: 'margin-top:0' }, d.stash ? `คลัง ${d.stash.size} ช่อง · ทอง ${fmt(d.stash.gold)} G` : 'คลัง'),
      d.stash ? itemList(d.stash.items, 'คลังว่าง') : h('div', { class: 'muted' }, 'ยังไม่เคยใช้คลัง'))]);
  }
  for (const [key, label, make] of extraPanes) panes.push([key, label, make]);
  if (tools.length) panes.push(['manage', 'จัดการ', () => h('div', {}, ...tools)]);
  if (acctTab.id !== id || !panes.some(([k]) => k === acctTab.key)) acctTab = { id, key: panes[0][0] };
  const pane = h('div', { class: 'subpane' });
  const tabBar = h('div', { class: 'subtabs' });
  const show = (key: string) => {
    acctTab = { id, key };
    tabBar.querySelectorAll<HTMLElement>('button').forEach((b) => b.classList.toggle('on', b.dataset.key === key));
    pane.replaceChildren(panes.find(([k]) => k === key)![2]());
  };
  tabBar.append(...panes.map(([key, label]) => h('button', { class: 'small', 'data-key': key, onclick: () => show(key) }, label)));
  show(acctTab.key);

  const bg = h('div', { class: 'sheet-bg', onclick: (ev: Event) => ev.target === bg && closeSheet() });
  bg.append(h('div', { class: 'sheet' },
    h('div', { class: 'sheet-head' },
      h('div', {},
        h('h2', {}, display, a.role ? h('span', { class: 'role', style: 'margin-left:6px' }, a.role === 'owner' ? 'Owner' : 'GM') : null,
          a.online ? h('span', { class: 'tag on' }, 'ออนไลน์') : null, a.bannedUntil ? h('span', { class: 'tag ban' }, 'แบน') : null),
        h('div', { class: 'muted' }, `${a.guest ? 'Guest' : 'บัญชีจริง'} · สมัคร ${dateOnly(a.createdAt)} · ${a.online ? 'ออนไลน์อยู่' : a.lastOnline ? `ออนไลน์ล่าสุด ${ago(a.lastOnline)}` : 'ยังไม่มีข้อมูลออนไลน์ล่าสุด'}`),
      ),
      h('button', { class: 'x small', onclick: closeSheet }, '✕'),
    ),
    h('div', { class: 'result' }, result),
    ...sections,
    h('div', { class: 'muted', style: 'margin-top:8px' }, `ตัวละคร ${d.characters.length}/${MAX_CHARACTERS} · ทองรวม ${fmt(a.totalGold)} G`),
    tabBar,
    pane,
  ));
  sheet = bg;
  document.body.append(bg);
  bg.scrollTop = scroll;
}

// ------------------------------------------------------------ broadcast + backups (Server tab)

/** Backups listed before "แสดงเพิ่ม". */
const BACKUP_LIST_SHORT = 5;

function broadcastCard(): HTMLElement {
  const text = h('textarea', { rows: 3, maxLength: BROADCAST_MAX, placeholder: 'เช่น อีก 30 นาทีจะปิดปรับปรุง' }) as HTMLTextAreaElement;
  const count = h('span', { class: 'muted' }, `0/${BROADCAST_MAX}`);
  const msg = h('div', { class: 'msg' });
  const btn = h('button', { class: 'primary' }, 'ส่ง');
  // Everyone, or one online player (the list is filled from the online table).
  const target = h('select', {}, h('option', { value: '' }, 'ทุกคน'));
  const fillTargets = async () => {
    try {
      const o = await api<AdminOnline>('GET', '/admin/online');
      const keep = target.value;
      target.replaceChildren(h('option', { value: '' }, 'ทุกคน'),
        ...o.players.slice().sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => h('option', { value: String(p.charId) }, `${p.name} (${p.username})`)));
      target.value = [...target.options].some((op) => op.value === keep) ? keep : '';
    } catch {
      // keep "everyone"
    }
  };
  target.addEventListener('focus', () => void fillTargets());
  void fillTargets();
  text.oninput = () => (count.textContent = `${text.value.length}/${BROADCAST_MAX}`);
  btn.onclick = async () => {
    if (!text.value.trim()) return;
    const who = target.value ? target.selectedOptions[0].text : 'ผู้เล่นทุกคนที่ออนไลน์';
    if (!confirm(`ส่งถึง ${who}?\n\n${text.value.trim()}`)) return;
    btn.disabled = true;
    try {
      const r = await api<{ msg: string }>('POST', '/admin/broadcast', { text: text.value, to: target.value ? Number(target.value) : undefined });
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
  return h('div', { class: 'card' }, h('h2', {}, 'ประกาศถึงผู้เล่น'),
    h('div', { class: 'muted', style: 'margin:-6px 0 8px' },
      `ผู้เล่นเห็นป้ายกลางจอ 10 วินาที และข้อความในแชท พร้อมชื่อผู้ส่ง · ส่งได้ทุก ${BROADCAST_EVERY_MS / 1000} วินาที · ส่งถึงคนเดียวได้จากปุ่ม 📢 ในตารางออนไลน์ด้วย`),
    h('div', { class: 'row', style: 'margin-bottom:8px' }, h('label', {}, 'ส่งถึง', target)),
    text, h('div', { class: 'row', style: 'margin-top:8px;align-items:center' }, count, h('span', { style: 'flex:1' }), btn), msg);
}

function backupCard(): HTMLElement {
  const list = h('div');
  const msg = h('div', { class: 'msg' });
  const btn = h('button', { class: 'primary' }, 'สำรองตอนนี้');
  const KIND: Record<string, string> = { daily: 'อัตโนมัติรายวัน', manual: 'กดเอง', 'before-delete': 'ก่อนลบ' };
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
      'เก็บใน server/data/backups/ · สำรองอัตโนมัติวันละครั้ง (เก็บ 7 ไฟล์ล่าสุด) และก่อนลบบัญชี/ตัวละครทุกครั้ง · ' +
      'กู้คืน: ปิด server (npm run stop-server) แล้วคัดลอกไฟล์สำรองทับ server/data/multiverse.db (ลบไฟล์ -wal และ -shm ข้าง ๆ ก่อน) แล้วเปิด server ใหม่'),
    h('div', { class: 'row' }, btn), msg, list);
}


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

async function renderStats(): Promise<void> {
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

function sessionTable(rows: PlaySessionRow[], showAccount: boolean): HTMLElement {
  const body = h('tbody');
  const cell = (label: string, content: Node | string, cls = '') => h('td', { 'data-label': label, class: cls }, content);
  const dur = (r: PlaySessionRow) => {
    if (r.online) return h('span', { class: 'good' }, '🟢 กำลังเล่น');
    if (r.leftAt === null) return h('span', { class: 'muted' }, 'ไม่ทราบ');
    const m = Math.round((r.leftAt - r.joinedAt) / 60000);
    return m < 60 ? `${m} นาที` : `${Math.floor(m / 60)} ชม. ${m % 60} นาที`;
  };
  body.append(...rows.map((r) => h('tr', showAccount ? { class: 'click', onclick: () => void openAccount(r.accountId) } : {},
    cell('เข้าเล่น', time(r.joinedAt), 'head'),
    showAccount ? cell('บัญชี', r.username) : null,
    cell('ตัวละคร', r.charName),
    cell('นานเท่าไร', dur(r)),
    h('td', { 'data-label': 'IP', class: 'ip', title: r.ip }, r.ip),
    h('td', { 'data-label': 'GPU', class: 'gpu', title: r.gpu ?? '' }, r.gpu ?? '–'),
    cell('Ping เฉลี่ย', r.avgRtt === null ? '–' : `${fmt(r.avgRtt)} ms`, 'num'),
    cell('FPS เฉลี่ย', r.avgFps === null ? '–' : fmt(r.avgFps), 'num'),
  )));
  if (!rows.length) body.append(h('tr', {}, h('td', { colSpan: 8, class: 'muted' }, `ยังไม่มีประวัติ — ${NO_HISTORY}`)));
  const heads = ['เข้าเล่น', ...(showAccount ? ['บัญชี'] : []), 'ตัวละคร', 'นานเท่าไร', 'IP', 'GPU', 'Ping เฉลี่ย', 'FPS เฉลี่ย'];
  return h('table', { class: 'cards' }, h('thead', {}, h('tr', {}, ...heads.map((t) => h('th', {}, t)))), body);
}

async function renderSessions(): Promise<void> {
  const holder = h('div');
  const more = h('button', {}, 'โหลดเพิ่ม');
  const msg = h('div', { class: 'msg bad' });
  let rows: PlaySessionRow[] = [];
  const load = async () => {
    more.disabled = true;
    try {
      const next = await api<PlaySessionRow[]>('GET', `/admin/sessions${rows.length ? `?before=${rows.at(-1)!.id}` : ''}`);
      rows = rows.concat(next);
      holder.replaceChildren(sessionTable(rows, true));
      more.classList.toggle('hidden', next.length < HISTORY_PAGE);
    } catch (e) {
      msg.textContent = (e as Error).message;
    }
    more.disabled = false;
  };
  more.onclick = () => void load();
  view.append(h('div', { class: 'card' }, h('h2', {}, 'การเข้าเล่นล่าสุด'),
    h('div', { class: 'muted', style: 'margin:-6px 0 8px' }, `${NO_HISTORY} · เก็บไว้ ${HISTORY_DAYS.sessions} วัน · กดแถวเพื่อดูบัญชี`),
    holder, more, msg));
  await load();
}

async function renderChat(): Promise<void> {
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

void start();
