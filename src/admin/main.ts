// The admin page (/admin). Shows what /api/admin returns and sends edits to it; the server checks the
// role and every value, so nothing here is a safeguard. Names, GPU strings and the like come from
// players: they are only ever put on the page as text (never as HTML).
// The page is split by tab: shared helpers/state in core.ts, one file per tab under tabs/.
import '../client/noBrowserMenu';
import './admin.css';
import { FEATURE_GROUPS, OWNER_ROLE, type AdminMe, type AdminMeta } from '../shared/admin';
import { applyBalance, checkBalance } from '../shared/balance';
import { renderBalance } from './balance';
import { renderSkills } from './skills';
import { headsOnPage, jumpTo, watchCards } from './ui';
import { renderDaily } from './daily';
import { renderMenuLayout } from './menuLayout';
import { renderMaps } from './maps';
import { renderCosManage } from './cosManage';
import { renderCashShop } from './cashShop';
import { renderTopup } from './topup';
import { ADMIN_TOKEN, h, read, store, token, setToken, hooks, ApiError, api, root, me, setMe, setMeta, type Tab, tab, setCurrentTab, view, stopRefresh, closeSheet, can } from './core';
import { stopOrbBench, setOrbOpenId, renderOrbs, renderCos, renderRig, renderAnim } from './tabs/orbBench';
import { renderCards } from './tabs/cards';
import { renderOnline } from './tabs/online';
import { renderRoles } from './tabs/permissions';
import { renderMail } from './tabs/mail';
import { renderTrades } from './tabs/trades';
import { renderReports } from './tabs/reports';
import { renderAudit } from './tabs/audit';
import { renderServer } from './tabs/server';
import { broadcastCard } from './tabs/broadcast';
import { renderUsers } from './tabs/accounts';
import { renderStats, renderSessions, renderChat } from './tabs/history';

// ------------------------------------------------------------ stale page notice
// A tab left open across a server update keeps running the old script, which may not understand the
// new API. The built page names its script by content hash (assets/admin-<hash>.js): when the page the
// server serves now names a different one, show a bar asking to reload. Dev builds have no hash: skip.

const MY_SCRIPT = /\/assets\/(admin-[\w-]+\.js)$/.exec(new URL(import.meta.url).pathname)?.[1] ?? null;
const STALE_CHECK_MS = 2 * 60_000;
let staleShown = false;
let lastStaleCheck = 0;

async function checkStale(): Promise<void> {
  if (!MY_SCRIPT || staleShown || Date.now() - lastStaleCheck < 10_000) return;
  lastStaleCheck = Date.now();
  try {
    const res = await fetch(location.pathname, { cache: 'no-cache' });
    if (!res.ok) return;
    const now = /assets\/(admin-[\w-]+\.js)/.exec(await res.text())?.[1];
    if (!now || now === MY_SCRIPT || staleShown) return;
    staleShown = true;
    document.body.prepend(h('div', { class: 'stale-bar', role: 'alert' },
      h('span', {}, 'หน้า admin มีเวอร์ชันใหม่ (server อัปเดตแล้ว) — โหลดหน้าใหม่ก่อนใช้งานต่อ'),
      h('button', { class: 'small', onclick: () => location.reload() }, 'โหลดหน้าใหม่')));
  } catch {
    // server restarting or offline: try again later
  }
}
if (MY_SCRIPT) {
  window.setInterval(() => void checkStale(), STALE_CHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkStale();
  });
}

function onAuthLost(e: ApiError): void {
  stopRefresh();
  if (e.status === 401) {
    store(ADMIN_TOKEN, null);
    setToken(null);
    showLogin('กรุณาเข้าสู่ระบบใหม่');
  } else if (e.status === 403 && !me) {
    showNoRights();
  } else if (e.status === 403) {
    // Lost the role while the page was open.
    setMe(null);
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
      setToken(data.token);
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
  setToken(null);
  setMe(null);
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

watchCards(view);

async function start(): Promise<void> {
  if (!token) return showLogin();
  try {
    setMe(await api<AdminMe>('GET', '/admin/me'));
    const loaded = await api<AdminMeta>('GET', '/admin/meta');
    setMeta(loaded);
    // The server's game balance, so the custom-item form's tiers match the server's.
    applyBalance(checkBalance(loaded.balance, false).tuning ?? {});
  } catch (e) {
    if ((e as ApiError).status === 0) {
      root.replaceChildren(h('div', { class: 'center' }, h('div', { class: 'card msg bad' }, (e as Error).message)));
    }
    return;
  }
  renderShell();
}

/** The top row: categories (names match the Permissions tab's FEATURE_GROUPS), each with its sub-tabs. */
const CATEGORIES: { name: (typeof FEATURE_GROUPS)[number]; tabs: Tab[] }[] = [
  { name: 'ผู้เล่น', tabs: ['online', 'users'] },
  { name: 'ประวัติ', tabs: ['stats', 'sessions', 'chat', 'trades', 'audit'] },
  { name: 'สื่อสาร', tabs: ['mail', 'reports', 'broadcast'] },
  { name: 'ปรับเกม', tabs: ['balance', 'skills', 'cards', 'daily', 'cashShop', 'topup', 'menuLayout', 'maps'] },
  { name: 'หน้าตา', tabs: ['orbs', 'cos', 'cosManage', 'rig', 'anim'] },
  { name: 'ระบบ', tabs: ['server', 'roles'] },
];
const TAB_LABEL: Record<Tab, string> = {
  online: 'ออนไลน์', users: 'ผู้ใช้และตัวละคร', stats: 'สถิติ', sessions: 'การเข้าเล่น', chat: 'แชท', trades: 'เทรด',
  audit: 'ประวัติ (audit)', mail: 'จดหมาย', reports: 'รายงาน', broadcast: 'ประกาศ', balance: 'ปรับสมดุล', skills: 'ระบบสกิล', cards: 'การ์ด', daily: 'ล็อกอินรายวัน', cashShop: 'แคชช็อป', topup: 'เติมเงิน', menuLayout: 'จัดเมนูเกม', maps: 'แมพ',
  orbs: 'ลูกแก้วตีบวก', cos: 'ของแต่งตัว', cosManage: 'จัดการของแต่งตัว', rig: 'นักดาบกระดาษ', anim: 'ท่าตัวละคร', server: 'Server', roles: 'สิทธิ์',
};

/** Whether the signed-in role may see a tab (the server checks again on every call). */
function tabAllowed(t: Tab): boolean {
  if (!me) return false;
  const f = me.features;
  switch (t) {
    case 'online': return f.includes('online');
    case 'users': return f.includes('users') || f.includes('charView');
    case 'stats': return f.includes('stats');
    case 'sessions': return f.includes('sessions');
    case 'chat': return f.includes('chatLog');
    case 'trades': return f.includes('tradeLog');
    case 'audit': case 'roles': return me.role === OWNER_ROLE;
    case 'mail': return f.includes('mail');
    case 'reports': return f.includes('reports');
    case 'broadcast': return f.includes('broadcast');
    // The skill system's page uses the same switch as the balance tab (owner 2026-11-19).
    case 'balance': case 'skills': return f.includes('balance');
    // The map tab: the editor (mapEdit) and the switch "ใช้แมพจาก DB" (balance).
    case 'maps': return f.includes('mapEdit') || f.includes('balance');
    case 'daily': return f.includes('daily');
    case 'cashShop': return f.includes('cashShop');
    case 'topup': return f.includes('topup');
    case 'menuLayout': return f.includes('menuLayout');
    case 'cards': return f.includes('cardView');
    case 'orbs': return f.includes('orbPreview');
    case 'cos': return f.includes('cosPreview');
    case 'cosManage': return f.includes('cosManage');
    // The papercraft sword trial bench: whoever may use the cosmetics bench (it changes nothing on the server).
    case 'rig': return f.includes('cosPreview');
    case 'anim': return f.includes('animPreview');
    case 'server': return me.role === 'owner' || f.includes('backup') || f.includes('shutdownText') || f.includes('netDelta') || f.includes('directWs') || f.includes('googleLogin');
  }
}

const catOf = (t: Tab) => CATEGORIES.find((c) => c.tabs.includes(t))!;

/** An icon per tab in the side menu (looks only). */
const TAB_ICON: Record<Tab, string> = {
  online: '🟢', users: '👤', stats: '📈', sessions: '🕒', chat: '💬', trades: '🤝', audit: '📜', mail: '✉️', reports: '🚩',
  broadcast: '📢', balance: '⚖️', skills: '✨', cards: '🃏', daily: '📅', cashShop: '💎', topup: '💳', menuLayout: '🧭', maps: '🗺️', orbs: '🔮', cos: '🪽', cosManage: '🧺', rig: '🗡️',
  anim: '🏃', server: '🖥️', roles: '🔑',
};

/**
 * What the search box finds besides tab names: each tab's cards by title (the jump looks for a heading
 * that starts with it) and words people may type for them. Cards inside the open tab are also found live.
 */
const SEARCH_INDEX: { tab: Tab; title: string; words?: string }[] = [
  { tab: 'online', title: 'ผู้เล่นออนไลน์', words: 'ping fps gpu ip เตะ ประกาศคนเดียว' },
  { tab: 'users', title: 'ผู้ใช้ทั้งหมด', words: 'บัญชี ตัวละคร แบน รหัสผ่าน ทอง คลัง ไอเทม ค้นหา' },
  { tab: 'stats', title: 'ผู้เล่นออนไลน์', words: 'กราฟ สถิติ' },
  { tab: 'stats', title: 'สมัครสมาชิกต่อวัน' },
  { tab: 'stats', title: 'เลเวลเฉลี่ย' },
  { tab: 'stats', title: 'Ping เฉลี่ย' },
  { tab: 'sessions', title: 'การเข้าเล่น', words: 'ip gpu เข้าออก' },
  { tab: 'chat', title: 'บันทึกแชท', words: 'ลบแชท' },
  { tab: 'trades', title: 'ประวัติการเทรด' },
  { tab: 'audit', title: 'ประวัติการใช้สิทธิ์ผู้ดูแล', words: 'audit log' },
  { tab: 'mail', title: 'ส่งจดหมาย', words: 'ของแนบ ดึงกลับ' },
  { tab: 'mail', title: 'จดหมายที่ส่งแล้ว' },
  { tab: 'reports', title: 'รายงานปัญหา', words: 'ข้อเสนอแนะ ห้ามรายงาน' },
  { tab: 'broadcast', title: 'ประกาศถึงผู้เล่นทุกคน' },
  { tab: 'balance', title: 'ค่าอาชีพ', words: 'สเตตัส hp mp นักดาบ เวท' },
  { tab: 'balance', title: 'ตัวตัดฟื้นทั้งเกม', words: 'regen ฟื้น' },
  { tab: 'balance', title: 'Tier T1–T5', words: 'tier ตัวคูณสเตตัส ไอเทม' },
  { tab: 'balance', title: 'ตัวอย่างค่าจริงที่สุ่มได้' },
  { tab: 'balance', title: 'มอนธรรมดา (ตัวคูณ)', words: 'มอน จุดเกิด เลิกไล่ กลับบ้าน บอส สลับเป้า ชุบ ห้องบอส' },
  { tab: 'balance', title: 'ยา', words: 'potion hp mp' },
  { tab: 'balance', title: 'ตีบวก', words: 'forge auto ช่างตีเหล็ก' },
  { tab: 'balance', title: 'Auto Play', words: 'ออโต้ ฟาร์มต่อ หลุด walkhidden เดิน' },
  { tab: 'balance', title: 'เอฟเฟกต์สกิล (ชั้นเสริม)', words: 'quarks อนุภาค กราฟิก เลขดาเมจ กระสุน จอสั่น' },
  { tab: 'balance', title: 'วงเวทและเอฟเฟกต์โค้ดรายสกิล' },
  { tab: 'balance', title: 'หยุดตอนโจมตี' },
  { tab: 'balance', title: 'นักดาบกระดาษ: ภาพอาวุธและเกราะ' },
  { tab: 'balance', title: 'เควสสอนระบบ: รางวัล', words: 'tutorial' },
  { tab: 'skills', title: 'ระบบสกิล: ค่ารวม', words: 'แต้มสกิล แรงก์ คืนแต้ม ปลดล็อก ซูมผัง' },
  { tab: 'skills', title: 'ค่ารายสกิล', words: 'สกิล ดาเมจ คูลดาวน์ mp ระยะ ผังดาว' },
  { tab: 'maps', title: 'ตัวแก้แมพ', words: 'แมพ แก้แมพ วางบ้าน ลากวาง หมุน ร่าง เผยแพร่ undo snap คลังภาพ' },
  { tab: 'maps', title: 'แมพ: ใช้แมพจาก DB', words: 'แมพ json ใช้แมพจาก db ฉุกเฉิน' },
  { tab: 'menuLayout', title: 'จัดเมนูเกม', words: 'ปุ่ม ลำดับ ซ่อน ย้าย ไอคอน มุมขวาบน หน้าต่างเมนู ตั้งค่า' },
  { tab: 'cards', title: 'การ์ด', words: 'เรทดรอป' },
  { tab: 'cards', title: 'ตัวเลขของระบบการ์ด' },
  { tab: 'daily', title: 'ของรางวัลล็อกอินรายวัน' },
  { tab: 'cashShop', title: 'แคชช็อป', words: 'คริสตัลมิติ เปิดขาย แพ็กเกจ' },
  { tab: 'topup', title: 'เติมเงิน', words: 'พร้อมเพย์ QR ยืนยัน โอน คืนเพชร close beta' },
  { tab: 'cosManage', title: 'จัดการของแต่งตัว', words: 'ซ่อน ราคา ปีก สัตว์ขี่ สัตว์เลี้ยง ออร่า' },
  { tab: 'roles', title: 'Role และเครื่องมือที่ใช้ได้', words: 'สิทธิ์ gm' },
  { tab: 'roles', title: 'ผู้ดูแลตอนนี้' },
  { tab: 'roles', title: 'ให้สิทธิ์ผู้ดูแล' },
  { tab: 'server', title: 'รีสตาร์ท / ปิด server', words: 'restart countdown' },
  { tab: 'server', title: 'ข้อความเตือนก่อนรีสตาร์ท' },
  { tab: 'server', title: 'ลดขนาด snapshot', words: 'delta เน็ต' },
  { tab: 'server', title: 'ภาพกระดาษตัดแปะ', words: 'paper' },
  { tab: 'server', title: 'เข้าสู่ระบบด้วย Google' },
  { tab: 'server', title: 'สำรองฐานข้อมูล', words: 'backup db' },
];

let sideNav: HTMLElement | null = null;
let allowedTabs = new Set<Tab>();

function renderShell(): void {
  if (!me) return;
  const cats = CATEGORIES.map((c) => ({ ...c, tabs: c.tabs.filter(tabAllowed) })).filter((c) => c.tabs.length);
  // A role without the tab that was open (or with no tabs at all) starts on its first one.
  if (!cats.length) cats.push({ name: 'ระบบ', tabs: ['server'] });
  allowedTabs = new Set(cats.flatMap((c) => c.tabs));
  // A link to a tab (/admin#balance) opens it, when this role may see it.
  const fromHash = location.hash.slice(1) as Tab;
  if (allowedTabs.has(fromHash)) setCurrentTab(fromHash);
  if (!allowedTabs.has(tab)) setCurrentTab(cats[0].tabs[0]);
  sideNav = h('nav', { class: 'side' }, ...cats.map((c) => h('div', { class: 'side-cat' },
    h('div', { class: 'side-cat-name' }, c.name),
    ...c.tabs.map((id) => h('button', { 'data-tab': id, onclick: () => { closeMenu(); setTab(id); } },
      h('span', { class: 'ico' }, TAB_ICON[id]), TAB_LABEL[id])))));
  const shade = h('div', { class: 'side-shade', onclick: () => closeMenu() });
  root.replaceChildren(
    h('header', { class: 'top' },
      h('button', { class: 'menu-btn', title: 'เมนู', onclick: () => document.body.classList.toggle('menu-open') }, '☰'),
      h('div', { class: 'brand' }, 'MULTIVERSE', h('small', {}, 'ผู้ดูแล')),
      searchBox(),
      h('div', { class: 'who' }, h('span', { class: 'who-name' }, me.username), h('span', { class: 'role' }, me.roleName),
        h('button', { class: 'small', onclick: logout }, 'ออก')),
    ),
    h('div', { class: 'layout' }, sideNav, shade, view),
  );
  setTab(tab);
}

function closeMenu(): void {
  document.body.classList.remove('menu-open');
}

/** The search box in the top bar: tabs, cards of every tab (SEARCH_INDEX), and anything written in the open tab. */
function searchBox(): HTMLElement {
  const input = h('input', { type: 'search', placeholder: '🔍 ค้นหา เช่น ยา บอส auto แบน', autocomplete: 'off' });
  const list = h('div', { class: 'search-list hidden' });
  let picks: (() => void)[] = [];
  let at = 0;
  const go = (t: Tab, title?: string): void => {
    input.value = '';
    list.classList.add('hidden');
    input.blur();
    closeMenu();
    if (t !== tab || !title) setTab(t);
    if (title) jumpTo(view, title);
  };
  const draw = (): void => {
    const q = input.value.trim().toLowerCase();
    picks = [];
    if (!q) {
      list.classList.add('hidden');
      return;
    }
    const rows: HTMLElement[] = [];
    const add = (label: string, where: string, fn: () => void): void => {
      if (rows.length >= 14) return;
      picks.push(fn);
      // mousedown keeps the focus in the box, so its blur does not hide the list before the click lands.
      rows.push(h('button', { type: 'button', class: 'search-row', onmousedown: (e: Event) => e.preventDefault(), onclick: fn },
        h('span', {}, label), h('span', { class: 'muted' }, where)));
    };
    const has = (s: string) => s.toLowerCase().includes(q);
    for (const t of allowedTabs) if (has(TAB_LABEL[t])) add(`${TAB_ICON[t]} ${TAB_LABEL[t]}`, catOf(t).name, () => go(t));
    for (const head of headsOnPage(view, q)) add(head, `ในหน้านี้ (${TAB_LABEL[tab]})`, () => go(tab, head));
    for (const e of SEARCH_INDEX) {
      if (e.tab === tab) continue; // the live list above already covers the open tab
      if (!allowedTabs.has(e.tab) || !(has(e.title) || (e.words && has(e.words)))) continue;
      add(e.title, `${TAB_ICON[e.tab]} ${TAB_LABEL[e.tab]}`, () => go(e.tab, e.title));
    }
    if (!rows.length) rows.push(h('div', { class: 'muted search-none' }, 'ไม่พบ'));
    at = 0;
    list.replaceChildren(...rows);
    list.querySelector('.search-row')?.classList.add('at');
    list.classList.remove('hidden');
  };
  input.addEventListener('input', draw);
  input.addEventListener('focus', draw);
  input.addEventListener('blur', () => list.classList.add('hidden'));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      draw();
      input.blur();
      return;
    }
    if (!picks.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      at = (at + (e.key === 'ArrowDown' ? 1 : picks.length - 1)) % picks.length;
      list.querySelectorAll('.search-row').forEach((b, i) => b.classList.toggle('at', i === at));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      picks[at]?.();
    }
  });
  return h('div', { class: 'search' }, input, list);
}

// "/" anywhere (not while typing) jumps to the search box.
document.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement;
  if (e.key !== '/' || el.closest('input, textarea, select, [contenteditable]')) return;
  const box = document.querySelector<HTMLInputElement>('.search input');
  if (!box) return;
  e.preventDefault();
  box.focus();
});

// A pasted link to a tab or the browser's back button opens that tab.
window.addEventListener('hashchange', () => {
  const t = location.hash.slice(1) as Tab;
  if (me && allowedTabs.has(t) && t !== tab) setTab(t);
});

function setTab(t: Tab): void {
  setCurrentTab(t);
  stopRefresh();
  stopOrbBench();
  void checkStale();
  if (location.hash !== `#${t}`) history.replaceState(null, '', `#${t}`);
  sideNav?.querySelectorAll<HTMLElement>('button[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  sideNav?.querySelector<HTMLElement>('button.on')?.scrollIntoView({ block: 'nearest' });
  document.title = `${TAB_LABEL[t]} · Multiverse Admin`;
  window.scrollTo(0, 0);
  view.replaceChildren();
  if (t === 'online') renderOnline();
  else if (t === 'users') void renderUsers();
  else if (t === 'stats') void renderStats();
  else if (t === 'sessions') void renderSessions();
  else if (t === 'chat') void renderChat();
  else if (t === 'mail') void renderMail();
  else if (t === 'trades') void renderTrades();
  else if (t === 'reports') void renderReports();
  else if (t === 'orbs') void renderOrbs();
  else if (t === 'cos') void renderCos();
  else if (t === 'rig') void renderRig();
  else if (t === 'anim') void renderAnim();
  else if (t === 'balance') void renderBalance(view, h, api, (tuning) => applyBalance(tuning), can('itemStatMult'));
  else if (t === 'skills') void renderSkills(view, h, api, (tuning) => applyBalance(tuning));
  else if (t === 'daily') void renderDaily(view, h, api);
  else if (t === 'cashShop') void renderCashShop(view, h, api);
  else if (t === 'topup') void renderTopup(view, h, api);
  else if (t === 'menuLayout') void renderMenuLayout(view, h, api, () => undefined);
  else if (t === 'maps') void renderMaps(view, h, api, (tuning) => applyBalance(tuning), { balance: can('balance'), mapEdit: can('mapEdit'), mapRollback: can('mapRollback'), mapExport: can('mapExport'), mapCreate: can('mapCreate'), mapDelete: can('mapDelete') });
  else if (t === 'cosManage') void renderCosManage(view, h, api, allowedTabs.has('orbs') ? (id) => { setOrbOpenId(id); setTab('orbs'); } : null);
  else if (t === 'roles') void renderRoles();
  else if (t === 'audit') void renderAudit();
  else if (t === 'cards') void renderCards();
  else if (t === 'broadcast') view.append(broadcastCard());
  else void renderServer();
}

hooks.authLost = onAuthLost;
hooks.setTab = setTab;
void start();
