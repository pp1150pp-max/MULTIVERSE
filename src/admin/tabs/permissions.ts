import { FEATURE_GROUPS, FEATURE_INFO, OWNER_ONLY_TOOLS, OWNER_ROLE, ROLE_ID_RE, ROLE_NAME_MAX, type RoleDef, type RoleDefsResponse, type AdminFeature, type AdminOnline } from '../../shared/admin';
import { h, api, me, online, setOnline, view, roleLabel } from '../core';

// ------------------------------------------------------------ permissions (owner)

/**
 * The Permissions tab: every role with the tools it may use (tick boxes with a Thai name and what it
 * unlocks), adding / renaming / deleting roles, and who holds which role. The server checks everything.
 */
export async function renderRoles(): Promise<void> {
  const msg = h('div', { class: 'msg' });
  const rolesBox = h('div');
  const adminsBox = h('div');
  const matches = h('div');
  const user = h('input', { placeholder: 'ชื่อผู้ใช้ หรือชื่อตัวละครที่ออนไลน์', autocapitalize: 'off' });
  const giveAs = h('select');
  let data: RoleDefsResponse = { roles: [], admins: [] };
  /** The role whose editor is open ('' = the new-role form). */
  let open: string | null = null;

  const say = (text: string, good: boolean) => {
    msg.className = `msg ${good ? 'ok' : 'bad'}`;
    msg.textContent = text;
  };
  const assignable = () => data.roles.filter((r) => r.id !== OWNER_ROLE);
  const draw = (d: RoleDefsResponse) => {
    data = d;
    if (me) me.roleNames = Object.fromEntries(d.roles.map((r) => [r.id, r.name]));
    drawRoles();
    drawAdmins();
    const keep = giveAs.value;
    giveAs.replaceChildren(...assignable().map((r) => h('option', { value: r.id }, r.name)));
    if (assignable().some((r) => r.id === keep)) giveAs.value = keep;
    void drawMatches();
  };

  /** Tick boxes for every tool, grouped; `on` = ticked at the start. */
  const editor = (role: RoleDef | null): HTMLElement => {
    const boxes = new Map<AdminFeature, HTMLInputElement>();
    const groups = FEATURE_GROUPS.map((g) => {
      const fs = (Object.keys(FEATURE_INFO) as AdminFeature[]).filter((f) => FEATURE_INFO[f].group === g);
      return h('div', { class: 'perm-group' }, h('div', { class: 'sub' }, g), ...fs.map((f) => {
        const box = h('input', { type: 'checkbox', checked: !!role?.features.includes(f) });
        boxes.set(f, box);
        return h('label', { class: 'perm' }, box,
          h('span', {}, FEATURE_INFO[f].name, h('div', { class: 'muted' }, FEATURE_INFO[f].desc)));
      }));
    });
    const idIn = h('input', { placeholder: 'เช่น tester', autocapitalize: 'off', maxLength: 20 });
    const nameIn = h('input', { value: role?.name ?? '', placeholder: 'เช่น ผู้ทดสอบ', maxLength: ROLE_NAME_MAX });
    const all = (on: boolean) => boxes.forEach((b) => (b.checked = on));
    const save = h('button', { class: 'primary' }, role ? 'บันทึก' : 'สร้าง role');
    save.onclick = async () => {
      const id = role ? role.id : idIn.value.trim().toLowerCase();
      if (!role && !ROLE_ID_RE.test(id)) return say('รหัส role ใช้ a–z 0–9 _ ขึ้นต้นด้วยตัวอักษร ยาว 2–20 ตัว', false);
      const features = [...boxes].filter(([, b]) => b.checked).map(([f]) => f);
      save.disabled = true;
      try {
        const d = await api<RoleDefsResponse>('POST', '/admin/role-defs', { id, name: nameIn.value, features, create: !role });
        open = null;
        draw(d);
        say(role ? `บันทึกสิทธิ์ของ ${nameIn.value.trim()} แล้ว` : `สร้าง role ${nameIn.value.trim()} (${id}) แล้ว`, true);
      } catch (e) {
        say((e as Error).message, false);
        save.disabled = false;
      }
    };
    let del: HTMLButtonElement | null = null;
    if (role && !role.builtin) {
      const d = h('button', { class: 'danger' }, 'ลบ role');
      d.onclick = async () => {
        if (role.members > 0) return say(`ยังมี ${role.members} บัญชีใช้ role นี้ เปลี่ยน role ของบัญชีเหล่านั้นก่อน`, false);
        if (!confirm(`ลบ role ${role.name} (${role.id})?`)) return;
        try {
          const r = await api<RoleDefsResponse>('DELETE', `/admin/role-defs/${role.id}`);
          open = null;
          draw(r);
          say(`ลบ role ${role.name} แล้ว`, true);
        } catch (e) {
          say((e as Error).message, false);
        }
      };
      del = d;
    }
    return h('div', { class: 'role-editor' },
      h('div', { class: 'row' },
        role ? null : h('label', {}, 'รหัส (ภาษาอังกฤษ เปลี่ยนไม่ได้)', idIn),
        h('label', {}, 'ชื่อที่แสดง', nameIn)),
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('button', { class: 'small', onclick: () => all(true) }, 'เลือกทั้งหมด'),
        h('button', { class: 'small', onclick: () => all(false) }, 'ไม่เลือกเลย')),
      ...groups,
      h('div', { class: 'row', style: 'margin-top:10px' }, save,
        h('button', { onclick: () => { open = null; drawRoles(); } }, 'ยกเลิก'), del),
    );
  };

  const total = Object.keys(FEATURE_INFO).length;
  const drawRoles = () => {
    rolesBox.replaceChildren(...data.roles.map((r) => {
      const owner = r.id === OWNER_ROLE;
      const head = h('div', { class: 'list-item' },
        h('div', { class: 'grow' },
          h('span', { class: 'role' }, r.name), h('span', { class: 'muted' }, ` ${r.id}`),
          h('div', { class: 'muted' }, owner ? 'ใช้ได้ทุกอย่างเสมอ (แก้ไม่ได้)' : `ใช้ได้ ${r.features.length}/${total} อย่าง`, ` · ${r.members} บัญชี`)),
        owner ? null : h('button', { class: 'small', onclick: () => { open = open === r.id ? null : r.id; drawRoles(); } }, open === r.id ? 'ปิด' : 'แก้ไข'));
      return h('div', {}, head, open === r.id ? editor(r) : null);
    }),
    open === '' ? editor(null) : h('div', { class: 'row', style: 'margin-top:10px' },
      h('button', { class: 'primary', onclick: () => { open = ''; drawRoles(); } }, '+ สร้าง role ใหม่')));
  };

  const setRole = async (username: string, role: string | null) => {
    const label = role ? roleLabel(role) : '';
    if (!confirm(role ? `ให้ role ${label} กับบัญชี ${username}?` : `ถอนสิทธิ์ผู้ดูแลของ ${username}?`)) return;
    try {
      await api('POST', '/admin/roles', { username, role });
      draw(await api<RoleDefsResponse>('GET', '/admin/role-defs'));
      say(role ? `ให้ role ${label} กับ ${username} แล้ว` : `ถอนสิทธิ์ของ ${username} แล้ว`, true);
    } catch (e) {
      say((e as Error).message, false);
    }
  };

  const drawAdmins = () => {
    adminsBox.replaceChildren(...data.admins.map((r) => {
      if (r.role === OWNER_ROLE) {
        return h('div', { class: 'list-item' }, h('div', { class: 'grow' }, r.username), h('span', { class: 'role' }, roleLabel(r.role)));
      }
      const sel = h('select', { style: 'flex:0 1 160px' }, ...assignable().map((x) => h('option', { value: x.id, selected: x.id === r.role }, x.name)));
      sel.addEventListener('change', () => {
        const to = sel.value;
        sel.value = r.role;
        void setRole(r.username, to);
      });
      return h('div', { class: 'list-item' }, h('div', { class: 'grow' }, r.username), sel,
        h('button', { class: 'small danger', onclick: () => void setRole(r.username, null) }, 'ถอนสิทธิ์'));
    }));
    if (!data.admins.length) adminsBox.append(h('div', { class: 'muted' }, 'ยังไม่มีผู้ดูแล'));
  };

  // Online players matching what is typed (account or character name), to pick from.
  const drawMatches = async () => {
    const q = user.value.trim().toLowerCase();
    if (!q) return matches.replaceChildren();
    try {
      setOnline(await api<AdminOnline>('GET', '/admin/online'));
    } catch {
      return;
    }
    const hits = online!.players.filter((p) => !p.guest && (p.username.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))).slice(0, 8);
    matches.replaceChildren(...hits.map((p) => {
      const role = data.admins.find((r) => r.username === p.username)?.role;
      return h('div', { class: 'list-item' },
        h('div', { class: 'grow' }, p.username, h('span', { class: 'muted' }, ` · ${p.name} Lv.${p.level} (ออนไลน์)`)),
        role ? h('span', { class: 'role' }, roleLabel(role)) : h('button', { class: 'small', onclick: () => void setRole(p.username, giveAs.value) }, 'ให้สิทธิ์'),
      );
    }));
  };
  let debounce = 0;
  user.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = window.setTimeout(() => void drawMatches(), 250);
  });
  const form = h('form', { class: 'row' },
    h('label', {}, 'ค้นหาผู้เล่นออนไลน์ หรือพิมพ์ชื่อบัญชี', user),
    h('label', { style: 'flex:0 1 160px' }, 'role', giveAs),
    h('button', { class: 'primary', type: 'submit' }, 'ให้สิทธิ์'));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const u = user.value.trim();
    if (u && giveAs.value) void setRole(u, giveAs.value);
  });

  view.append(
    h('div', { class: 'card' }, h('h2', {}, 'Role และเครื่องมือที่ใช้ได้'),
      h('div', { class: 'muted', style: 'margin:-6px 0 8px' }, 'กด "แก้ไข" เพื่อติ๊กเครื่องมือที่ role นั้นใช้ได้ · มีผลทันทีโดยไม่ต้องออกจากระบบ'),
      rolesBox, msg),
    h('div', { class: 'card' }, h('h2', {}, 'ผู้ดูแลตอนนี้'), adminsBox),
    h('div', { class: 'card' }, h('h2', {}, 'ให้สิทธิ์ผู้ดูแล'), form, matches),
    h('div', { class: 'card' }, h('h2', {}, 'ของ owner เท่านั้น (ให้ role อื่นไม่ได้)'),
      h('ul', { class: 'items' }, ...OWNER_ONLY_TOOLS.map((t) => h('li', {}, t)))),
  );
  try {
    draw(await api<RoleDefsResponse>('GET', '/admin/role-defs'));
  } catch (e) {
    say((e as Error).message, false);
  }
}
