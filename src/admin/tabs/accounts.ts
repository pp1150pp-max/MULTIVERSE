import { ADMIN_CRYSTAL_MAX, BAN_DURATIONS, BAN_REASON_MAX, type AdminAccountDetail, type AdminAccountsResponse } from '../../shared/admin';
import { MAX_CHARACTERS } from '../../shared/api';
import { VIP_DAYS_MAX, vipLeftText } from '../../shared/vip';
import { entryName } from '../../shared/data/potions';
import { COSMETICS, COS_SLOTS, COS_SLOT_NAME } from '../../shared/data/cosmetics';
import { registerOrbItems } from '../../shared/orbItems';
import { equipEntries, itemGrid, listEntries, type ItemCtx } from '../items';
import { BAG_TABS, TAB_NAME, tabRange } from '../../shared/bagTabs';
import { isStack, RARITY_COLOR, RARITY_LABEL, type BagEntry, type Item } from '../../shared/types';
import { h, hooks, api, fmt, className, me, meta, zoneName, view, sheet, setSheet, closeSheet, can, roleLabel, dateOnly, ago, banText } from '../core';
import { renderSearch, openChar } from './characterEditor';
import { newSessionView, sessionsTable } from './history';

type UserSort = 'username' | 'createdAt' | 'lastOnline' | 'characters' | 'maxLevel' | 'totalGold' | 'stashSize';
const users = { q: '', filter: 'all', sort: 'createdAt' as UserSort, desc: true };

export async function renderUsers(): Promise<void> {
  // Character search needs charView, the account table needs users: a role may have either or both.
  if (can('charView')) renderSearch();
  if (!can('users')) return;
  const chips = h('div', { class: 'zones' });
  const body = h('tbody');
  const msg = h('div', { class: 'msg' });
  const q = h('input', { placeholder: 'ชื่อผู้ใช้ หรือชื่อตัวละคร', value: users.q, autocapitalize: 'off' });
  const filter = h('select', {},
    ...[['all', 'ทั้งหมด'], ['real', 'บัญชีจริง'], ['guest', 'Guest'], ['google', 'ผูก Google'], ['admin', 'GM / Owner'], ['banned', 'ถูกแบน']]
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
      if (users.filter === 'google' && !r.google) return false;
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
          r.bannedUntil ? h('span', { class: 'tag ban' }, 'แบน') : null,
          r.google ? h('span', { class: 'tag', title: `Google: ${r.google}` }, 'G') : null), 'head'),
        cell('ประเภท', r.guest ? 'Guest' : 'บัญชีจริง'),
        cell('สิทธิ์', r.role ? h('span', { class: 'role' }, roleLabel(r.role)) : '–'),
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

export async function openAccount(id: number, note?: { text: string; ok: boolean; password?: string }): Promise<void> {
  let d: AdminAccountDetail;
  try {
    d = await api<AdminAccountDetail>('GET', `/admin/accounts/${id}`);
    registerOrbItems(d.orbItems ?? []);
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
  if (d.crystals !== null && d.crystals !== undefined) {
    sections.push(h('div', { class: 'muted' }, `คริสตัลมิติ (แคชช็อป): ${d.crystals.toLocaleString()}`));
    if (can('crystalGrant')) {
      // Give (+) or take (−) crystals, like the gold tool on a character.
      const amount = h('input', { type: 'number', min: '1', max: String(ADMIN_CRYSTAL_MAX), placeholder: 'จำนวน', style: 'width:110px' });
      const send = (sign: 1 | -1) => async () => {
        const n = Math.floor(Number(amount.value));
        if (!Number.isFinite(n) || n < 1 || n > ADMIN_CRYSTAL_MAX) return fail(new Error(`ใส่จำนวน 1–${ADMIN_CRYSTAL_MAX.toLocaleString()}`));
        if (sign < 0 && !confirm(`ลดคริสตัลมิติ ${n.toLocaleString()} จาก ${display}?`)) return;
        try {
          after((await api<{ msg: string }>('POST', `/admin/accounts/${id}/crystals`, { delta: sign * n })).msg);
        } catch (e) {
          fail(e);
        }
      };
      const give = h('button', { class: 'primary' }, 'ให้คริสตัล');
      give.onclick = send(1);
      const take = h('button', { class: 'danger' }, 'ลดคริสตัล');
      take.onclick = send(-1);
      sections.push(h('div', { class: 'row' }, h('label', {}, 'เสกคริสตัลมิติ', amount), give, take));
    }
  }
  if (d.vipUntil !== null && d.vipUntil !== undefined) {
    const left = vipLeftText(d.vipUntil, Date.now());
    sections.push(h('div', { class: 'muted' }, left ? `VIP: เหลือ ${left} (ถึง ${new Date(d.vipUntil).toLocaleString('th-TH')})` : 'VIP: ไม่ได้เป็น'));
    if (can('vipGrant')) {
      const days = h('input', { type: 'number', min: '1', max: String(VIP_DAYS_MAX), placeholder: 'วัน', style: 'width:80px' });
      const give = h('button', { class: 'primary' }, 'ให้ VIP');
      give.onclick = async () => {
        const n = Math.floor(Number(days.value));
        if (!Number.isFinite(n) || n < 1 || n > VIP_DAYS_MAX) return fail(new Error(`ใส่จำนวนวัน 1–${VIP_DAYS_MAX}`));
        try {
          after((await api<{ msg: string }>('POST', `/admin/accounts/${id}/vip`, { days: n })).msg);
        } catch (e) {
          fail(e);
        }
      };
      const row: Node[] = [h('label', {}, 'เพิ่มวัน VIP', days), give];
      if (left) {
        const remove = h('button', { class: 'danger' }, 'ถอด VIP');
        remove.onclick = async () => {
          if (!confirm(`ถอด VIP ของ ${display}? (เวลาที่เหลือ ${left} หายทั้งหมด)`)) return;
          try {
            after((await api<{ msg: string }>('POST', `/admin/accounts/${id}/vip`, { remove: true })).msg);
          } catch (e) {
            fail(e);
          }
        };
        row.push(remove);
      }
      sections.push(h('div', { class: 'row' }, ...row));
    }
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

  // Worn gear, bag and stash as slot grids; a click shows the item (and the edit form with itemEdit).
  const ictx: ItemCtx | null = meta && {
    h, api, meta, canEdit: can('itemEdit'),
    done: (text) => {
      reloadUsers();
      void openAccount(id, { text, ok: true });
    },
  };

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
        can('charView') ? h('button', { class: 'small', onclick: () => void openChar(c.charId) }, 'แก้ไข') : null),
      h('div', { class: 'sub' }, 'สวมใส่'),
      ictx ? itemGrid(ictx, { place: 'equip', charId: c.charId, cls: c.classId, level: c.level }, equipEntries(c.equipment)) : itemList(eq, 'ไม่ได้สวมอะไร'),
      // The two bag tabs (src/shared/bagTabs.ts): gear, then everything that stacks. Keys stay whole-bag slot numbers.
      ...BAG_TABS.flatMap((t) => {
        const [a, b] = tabRange(c.bagSlots, t);
        const part = c.bag.slice(a, b);
        return [
          h('div', { class: 'sub' }, `${TAB_NAME[t]} ${b - a} ช่อง (ว่าง ${part.filter((e) => !e).length})`),
          ictx ? itemGrid(ictx, { place: 'bag', charId: c.charId, cls: c.classId, level: c.level }, part.map((e, k) => ({ key: a + k, e }))) : itemList(part, `${TAB_NAME[t]}ว่าง`),
        ];
      }),
      del,
    );
  });

  let sessionsBox: HTMLElement | null = null;
  if (can('sessions')) {
    sessionsBox = h('section', {}, h('h3', {}, 'การเข้าเล่น'), sessionsTable(newSessionView(), id));
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
      !d.stash ? h('div', { class: 'muted' }, 'ยังไม่เคยใช้คลัง')
        : ictx ? itemGrid(ictx, { place: 'stash', accountId: id }, listEntries(d.stash.items)) : itemList(d.stash.items, 'คลังว่าง'))]);
  }
  if (!a.guest && d.cosmetics) {
    const owned = new Set(d.cosmetics);
    const hidden = new Set(d.cosHidden ?? []);
    const canEdit = can('cosmetics');
    panes.push(['cosmetics', `Cosmetics (${owned.size})`, () => h('div', { class: 'char-card' },
      h('div', { class: 'muted' }, canEdit
        ? 'ให้หรือยึดคืนได้ทันที ผูกกับบัญชี (ทุกตัวละครใช้ได้) ให้แล้วผู้เล่นได้จดหมายแจ้ง ยึดคืนแล้วถ้าสวมอยู่จะถอดออกเอง'
        : 'ดูได้อย่างเดียว'),
      ...COS_SLOTS.map((slot) => h('div', {},
        h('div', { class: 'sub' }, COS_SLOT_NAME[slot]),
        h('ul', { class: 'items' }, ...COSMETICS.filter((c) => c.slot === slot).map((c) => {
          const has = owned.has(c.id);
          let btn: Node | null = null;
          if (canEdit) {
            const b = h('button', { class: has ? 'small danger' : 'small primary' }, has ? 'ยึดคืน' : 'ให้');
            b.onclick = async () => {
              if (has && !confirm(`ยึด ${c.name} คืนจาก ${display}?`)) return;
              try {
                after((await api<{ msg: string }>('POST', `/admin/accounts/${id}/cosmetics`, { id: c.id, give: !has })).msg);
              } catch (e) {
                fail(e);
              }
            };
            btn = b;
          }
          return h('li', {}, h('span', { style: `color:${c.color}` }, '■ '), c.name, ' ',
            has ? h('span', { class: 'tag on' }, 'มีแล้ว') : null, ' ',
            hidden.has(c.id) ? h('span', { class: 'tag', title: 'ซ่อนในหน้าต่างแต่งตัว: ให้ได้ แต่ผู้เล่นสวมไม่ได้จนกว่าจะแสดงกลับ' }, 'ซ่อนอยู่') : null, ' ', btn);
        }))))) ]);
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
        h('h2', {}, display, a.role ? h('span', { class: 'role', style: 'margin-left:6px' }, roleLabel(a.role)) : null,
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
  setSheet(bg);
  document.body.append(bg);
  bg.scrollTop = scroll;
}

hooks.openAccount = (id) => void openAccount(id);
