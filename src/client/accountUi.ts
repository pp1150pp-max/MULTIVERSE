// The player's account windows (docs/systems/accounts-and-admin.md, owner 2026-11-27), used on the character
// select screen and from the in-game menu:
// - "จัดการบัญชี": how the account logs in (username + password ✓/✗, Google + email), set / change the
//   password (a fresh Google login resets it without the old one), link / unlink Google, change the username.
// - "บันทึกตัวละคร" (a guest in the game): pick a username + password here, or go to Google.
// The server checks everything (server/account-api.ts); these only show what it allows (AccountInfoResponse.tools).
import { checkPassword, checkUsername, PASSWORD_MAX, type AccountInfoResponse } from '../shared/api';
import * as api from './net/api';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) if (k !== null) e.append(k);
  return e;
}

const when = (ms: number) => new Date(ms).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

/** A dark full-screen layer with one window; closes with ✕, Escape or a click outside. Returns the body and close(). */
function modal(title: string, onClose?: () => void): { body: HTMLElement; close: () => void } {
  const body = el('div', { class: 'logon-body acct-body' });
  const x = el('button', { type: 'button', class: 'acct-x', title: 'ปิด', 'aria-label': 'ปิด' }, '✕');
  const box = el('div', { class: 'online-box logon-box acct-box', role: 'dialog' },
    el('div', { class: 'logon-head' }, el('span', {}, '✦'), ` ${title} `, el('span', {}, '✦')), x, body);
  const layer = el('div', { class: 'acct-layer' }, box);
  const close = () => {
    layer.remove();
    document.removeEventListener('keydown', onKey, true);
    onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    close();
  };
  x.onclick = close;
  layer.addEventListener('pointerdown', (e) => e.target === layer && close());
  // Keys typed here are the window's, not the game's (the game ignores keys while an input has focus).
  box.addEventListener('keydown', (e) => e.stopPropagation());
  document.addEventListener('keydown', onKey, true);
  document.body.append(layer);
  return { body, close };
}

function passInput(id: string, label: string, autocomplete: string): { row: HTMLElement; input: HTMLInputElement } {
  const input = el('input', { id, type: 'password', maxlength: String(PASSWORD_MAX), autocomplete });
  const eye = el('button', { type: 'button', class: 'pass-eye', title: 'แสดงรหัสผ่าน', 'aria-label': 'แสดงรหัสผ่าน' }, '👁');
  eye.onclick = () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    eye.classList.toggle('on', show);
  };
  return { row: el('div', { class: 'form-row' }, el('label', { for: id }, label), el('span', { class: 'pass-wrap' }, input, eye)), input };
}

function textInput(id: string, label: string, value = ''): { row: HTMLElement; input: HTMLInputElement } {
  const input = el('input', { id, maxlength: '16', autocomplete: 'off' });
  input.value = value;
  return { row: el('div', { class: 'form-row' }, el('label', { for: id }, label), input), input };
}

/** A small form: its fields, a message line and a submit button that runs `go` (errors shown in the line). */
function form(fields: HTMLElement[], button: string, go: (msg: HTMLElement) => Promise<void>): HTMLFormElement {
  const msg = el('div', { class: 'form-error' });
  const btn = el('button', { type: 'submit', class: 'primary' }, button);
  const f = el('form', { class: 'acct-form', novalidate: '' }, ...fields, msg, el('div', { class: 'menu-buttons' }, btn));
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    if (btn.disabled) return;
    btn.disabled = true;
    msg.className = 'form-error';
    go(msg).catch((err: Error) => {
      msg.className = 'form-error';
      msg.textContent = err.message;
    }).finally(() => (btn.disabled = false));
  });
  return f;
}

const okLine = (msg: HTMLElement, text: string) => {
  msg.className = 'form-error acct-ok';
  msg.textContent = text;
};

export interface AccountWindowOpts {
  /** Off to Google to link it (from the game: leave the game first). */
  linkGoogle(): void;
  /** The username changed (the screen behind shows it). */
  renamed?(username: string): void;
  /** The window was closed. */
  closed?(): void;
}

/** "จัดการบัญชี". */
export function openAccountWindow(opts: AccountWindowOpts): void {
  const { body } = modal('จัดการบัญชี', opts.closed);
  body.append(el('div', { class: 'acct-note' }, 'กำลังโหลด…'));
  const draw = (a: AccountInfoResponse, note = '') => {
    body.replaceChildren();
    if (note) body.append(el('div', { class: 'form-error acct-ok' }, note));
    body.append(
      el('h2', {}, a.username),
      el('h3', {}, 'เข้าสู่ระบบได้ทาง'),
      el('div', { class: 'acct-way' }, a.hasPassword ? '✔' : '✖', ' ชื่อผู้ใช้ + รหัสผ่าน'),
      el('div', { class: 'acct-way' }, a.google ? '✔' : '✖', ' Google', a.google ? el('b', { translate: 'no' }, ` ${a.google}`) : null),
    );
    // ---- password
    const t = a.tools;
    if (!a.hasPassword) {
      if (t.setPassword) {
        const p1 = passInput('acct-pw1', 'รหัสผ่าน', 'new-password');
        const p2 = passInput('acct-pw2', 'ยืนยันรหัส', 'new-password');
        body.append(el('h3', {}, 'ตั้งรหัสผ่าน'),
          el('p', { class: 'hint' }, 'ตั้งแล้วเข้าเกมได้ทั้งด้วย Google และชื่อผู้ใช้ + รหัสผ่าน'),
          form([p1.row, p2.row], 'ตั้งรหัสผ่าน', async (msg) => {
            const bad = checkPassword(p1.input.value) ?? (p1.input.value !== p2.input.value ? 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' : null);
            if (bad) return void (msg.textContent = bad);
            draw(await api.setPassword(p1.input.value), 'ตั้งรหัสผ่านแล้ว — เครื่องอื่นที่เข้าบัญชีนี้ค้างไว้ต้องเข้าสู่ระบบใหม่');
          }));
      }
    } else if (a.recoverUntil !== null || t.changePassword) {
      const recover = a.recoverUntil !== null;
      const old = recover ? null : passInput('acct-old', 'รหัสเดิม', 'current-password');
      const p1 = passInput('acct-pw1', 'รหัสใหม่', 'new-password');
      const p2 = passInput('acct-pw2', 'ยืนยันรหัส', 'new-password');
      body.append(el('h3', {}, recover ? 'ตั้งรหัสผ่านใหม่' : 'เปลี่ยนรหัสผ่าน'),
        recover ? el('p', { class: 'hint' }, `เพิ่งเข้าสู่ระบบด้วย Google — ตั้งรหัสใหม่ได้โดยไม่ต้องใส่รหัสเดิม ถึง ${when(a.recoverUntil!)}`) : '',
        form([...(old ? [old.row] : []), p1.row, p2.row], recover ? 'ตั้งรหัสใหม่' : 'เปลี่ยนรหัสผ่าน', async (msg) => {
          const bad = (old && !old.input.value ? 'ใส่รหัสผ่านเดิม' : null) ?? checkPassword(p1.input.value)
            ?? (p1.input.value !== p2.input.value ? 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' : null);
          if (bad) return void (msg.textContent = bad);
          draw(await api.setPassword(p1.input.value, old?.input.value), 'เปลี่ยนรหัสผ่านแล้ว — เครื่องอื่นที่เข้าบัญชีนี้ค้างไว้ต้องเข้าสู่ระบบใหม่');
        }));
      if (!recover && a.google && t.recover) {
        body.append(el('p', { class: 'hint' }, `ลืมรหัสเดิม? ออกจากระบบ แล้วกด "เข้าสู่ระบบด้วย Google" แล้วเปิดหน้านี้อีกครั้งภายใน ${t.recoverMin} นาที จะตั้งรหัสใหม่ได้โดยไม่ต้องใส่รหัสเดิม`));
      }
    }
    // ---- Google
    body.append(el('h3', {}, 'บัญชี Google'));
    if (a.google) {
      const unlink = el('button', { type: 'button', class: 'small' }, 'ยกเลิกการผูก');
      const msg = el('div', { class: 'form-error' });
      unlink.disabled = !a.hasPassword;
      unlink.title = a.hasPassword ? '' : 'ตั้งรหัสผ่านก่อน ไม่งั้นจะเข้าบัญชีนี้ไม่ได้อีก';
      unlink.onclick = async () => {
        if (!confirm(`ยกเลิกการผูก Google (${a.google})? หลังจากนี้เข้าได้ด้วยชื่อผู้ใช้และรหัสผ่านเท่านั้น`)) return;
        try {
          await api.unlinkGoogle();
          draw(await api.account(), 'ยกเลิกการผูก Google แล้ว');
        } catch (e) {
          msg.textContent = (e as Error).message;
        }
      };
      body.append(el('div', { class: 'acct-way' }, el('span', { translate: 'no' }, a.google), ' ', unlink),
        a.hasPassword ? '' : el('p', { class: 'hint' }, 'ยกเลิกการผูกได้หลังตั้งรหัสผ่าน'), msg);
    } else if (a.googleOn) {
      const link = el('button', { type: 'button', class: 'logon-google' }, 'ผูกบัญชี Google');
      link.onclick = () => opts.linkGoogle();
      body.append(el('p', { class: 'hint' }, 'เข้าเกมด้วย Google ได้อีกทาง และใช้กู้รหัสผ่านได้ถ้าลืม (ชื่อผู้ใช้และรหัสผ่านเดิมยังใช้ได้)'), link);
    } else {
      body.append(el('p', { class: 'hint' }, 'ตอนนี้ปิดการเข้าสู่ระบบด้วย Google อยู่'));
    }
    // ---- username
    if (t.rename) {
      body.append(el('h3', {}, 'เปลี่ยนชื่อผู้ใช้'));
      if (a.renameAt !== null) {
        body.append(el('p', { class: 'hint' }, `เปลี่ยนได้อีกครั้ง ${when(a.renameAt)} (${t.renameDays} วันครั้ง)`));
      } else {
        const u = textInput('acct-user', 'ชื่อใหม่');
        body.append(
          el('p', { class: 'hint' }, `ชื่อที่ใช้เข้าสู่ระบบ (ไม่ใช่ชื่อตัวละคร) ยาว 3–16 ตัว A–Z, 0–9 และ _ ห้ามซ้ำกับคนอื่น${t.renameDays > 0 ? ` · เปลี่ยนได้ ${t.renameDays} วันครั้ง` : ''}`),
          form([u.row], 'เปลี่ยนชื่อ', async (msg) => {
            const name = u.input.value.trim();
            const bad = checkUsername(name);
            if (bad) return void (msg.textContent = bad);
            if (!confirm(`เปลี่ยนชื่อผู้ใช้เป็น ${name}?${t.renameDays > 0 ? ` (เปลี่ยนอีกได้หลัง ${t.renameDays} วัน)` : ''}`)) return;
            const next = await api.renameAccount(name);
            opts.renamed?.(next.username);
            draw(next, `เปลี่ยนชื่อผู้ใช้เป็น ${next.username} แล้ว — ครั้งหน้าเข้าสู่ระบบด้วยชื่อนี้`);
          }));
      }
    }
  };
  api.account().then((a) => draw(a), (e: Error) => body.replaceChildren(el('div', { class: 'form-error' }, e.message)));
}

export interface GuestSaveOpts {
  /** Google sign-in is on (offer it). */
  googleOn: boolean;
  /** Off to Google (from the game: leave first). */
  google(): void;
  /** The guest is now this account (the token is stored): carry on playing as it. */
  saved(username: string): void;
}

/** "บันทึกตัวละคร" for a guest: a username + password here, or Google. */
export function openGuestSave(opts: GuestSaveOpts): void {
  const { body, close } = modal('บันทึกตัวละคร');
  const u = textInput('gsave-user', 'ชื่อผู้ใช้');
  const p1 = passInput('gsave-pw1', 'รหัสผ่าน', 'new-password');
  const p2 = passInput('gsave-pw2', 'ยืนยันรหัส', 'new-password');
  body.append(
    el('p', { class: 'hint' }, 'Guest ถูกลบถ้าไม่เข้าเกม 24 ชม. บันทึกตัวละครนี้ไว้ในบัญชีถาวร ทุกอย่างของตัวละครอยู่ครบ'),
    el('h3', {}, 'ตั้งชื่อผู้ใช้และรหัสผ่าน'),
    form([u.row, p1.row, p2.row], 'บันทึก', async (msg) => {
      const name = u.input.value.trim();
      const bad = checkUsername(name) ?? checkPassword(p1.input.value) ?? (p1.input.value !== p2.input.value ? 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' : null);
      if (bad) return void (msg.textContent = bad);
      const r = await api.guestUpgrade(name, p1.input.value);
      okLine(msg, 'บันทึกแล้ว — กำลังต่อเข้าเกมในบัญชีใหม่…');
      close();
      opts.saved(r.username);
    }),
  );
  if (opts.googleOn) {
    const g = el('button', { type: 'button', class: 'logon-wide logon-google' }, 'ใช้บัญชี Google');
    g.onclick = () => {
      close();
      opts.google();
    };
    body.append(el('div', { class: 'logon-or' }, el('span', {}, 'หรือ')), g);
  }
}
