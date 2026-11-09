// Title menu: play as a guest, or log in / sign up. Either way the game runs on the server.
import { gameAssetsReady, loadGameAssets, loadMenuAssets, onAssetProgress, portraitSource } from './assets';
import { CLASSES, CLASS_IDS } from '../shared/data/classes';
import { MAX_CHARACTERS, PASSWORD_MIN, checkCharacterName, checkPassword, checkUsername, type CharacterSummary } from '../shared/api';
import type { ClassId } from '../shared/types';
import * as api from './net/api';
import { connectOnline, type OnlineBackend } from './net/online';
import { skillIcon } from './icons';
import { AFTER_EXIT_KEY } from './sysmenu';
import { showLoading } from './loadingScreen';

export type Launcher = (backend: OnlineBackend) => void;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function portrait(key: string, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const draw = (): void => {
    // First cell = front view, frame 0 (of the idle animation when there is a full set).
    const src = portraitSource(key);
    if (!src) return;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src.img, 0, 0, src.cw, src.ch, 0, 0, size, size);
  };
  // The menu shows before the portraits arrive on a slow link; they fill in when loaded.
  if (portraitSource(key)) draw();
  else void loadMenuAssets(CLASS_IDS).then(draw);
  return c;
}

/**
 * Waits, with a progress bar, until every game texture has loaded (they keep loading in the
 * background while the menu is up). Runs before connecting, so the character doesn't stand
 * in the world unseen while a slow link finishes the download.
 */
async function waitForGameAssets(classId: ClassId | null): Promise<void> {
  if (gameAssetsReady()) return;
  const screen = showLoading(classId);
  const stop = onAssetProgress((f) => screen.progress(f));
  try {
    await loadGameAssets();
  } finally {
    stop();
    screen.hide();
  }
}

/** Fills a container with clickable class cards; returns a getter for the chosen class. */
function buildClassCards(container: HTMLElement): () => ClassId {
  let chosen: ClassId = 'sword';
  for (const id of CLASS_IDS) {
    const c = CLASSES[id];
    const card = document.createElement('div');
    card.className = 'class-card';
    card.append(portrait(id, 96));
    const body = document.createElement('div');
    body.innerHTML =
      `<h3>${c.name} <small>${c.nameTh}</small></h3><p>${c.desc}</p>` +
      `<ul>${c.skills.filter((s) => s.slot !== 'dash').map((s) => `<li>${skillIcon(s.id)} <b>${s.name}</b> — ${s.nameTh}</li>`).join('')}</ul>`;
    card.append(body);
    card.onclick = () => {
      chosen = id;
      container.querySelectorAll('.class-card').forEach((el) => el.classList.toggle('selected', el === card));
    };
    container.append(card);
  }
  (container.firstElementChild as HTMLElement).classList.add('selected');
  return () => chosen;
}

/** Owner's decision: the Guest Login button is picture-only for now. Set to true to connect it again. */
const GUEST_LOGIN_ENABLED: boolean = false;

type Panel = 'guest' | 'online';

function show(panel: Panel): void {
  $('guest-panel').classList.toggle('hidden', panel !== 'guest');
  $('online-panel').classList.toggle('hidden', panel !== 'online');
}

const describe = (c: CharacterSummary) => `${c.name} · Lv.${c.level} ${CLASSES[c.classId].name}`;

// ------------------------------------------------------------ guest

/** Guest: one character kept on the server; this browser only remembers its token. */
class GuestMenu {
  private char: CharacterSummary | null = null;
  private busy = false;
  private readonly chosenClass: () => ClassId;

  constructor(private readonly launch: Launcher) {
    this.chosenClass = buildClassCards($('guest-class-cards'));
    $('btn-guest-continue').onclick = () => this.char && void this.enter(this.char.id);
    $('btn-guest-new').onclick = () => {
      if (!this.char) return;
      if (!confirm(`เริ่ม Guest ใหม่จะลบตัวละคร Guest เดิม (${this.char.name}) ทิ้งเมื่อสร้างตัวใหม่เสร็จ ต้องการดำเนินการต่อหรือไม่?`)) return;
      this.showCreate();
    };
    $('btn-guest-start').onclick = () => void this.create();
    $('guest-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void this.create();
    });
  }

  async open(): Promise<void> {
    $('guest-continue').classList.add('hidden');
    $('guest-create').classList.add('hidden');
    $('guest-error').textContent = 'กำลังโหลด…';
    try {
      this.char = await api.guestCharacter();
    } catch (e) {
      $('guest-error').textContent = (e as Error).message;
      return;
    }
    $('guest-error').textContent = '';
    if (!this.char) return this.showCreate();
    $('guest-continue').classList.remove('hidden');
    $('btn-guest-continue').textContent = `เล่นต่อ: ${describe(this.char)}`;
  }

  private showCreate(): void {
    $('guest-continue').classList.add('hidden');
    $('guest-create').classList.remove('hidden');
    $<HTMLInputElement>('guest-name').focus();
  }

  private async create(): Promise<void> {
    if (this.busy) return;
    const name = $<HTMLInputElement>('guest-name').value.trim();
    const bad = checkCharacterName(name);
    if (bad) return void ($('guest-error').textContent = bad);
    this.busy = true;
    $('guest-error').textContent = 'กำลังสร้างตัวละคร…';
    let created: CharacterSummary;
    try {
      created = (await api.createGuest(name, this.chosenClass())).character;
    } catch (e) {
      $('guest-error').textContent = (e as Error).message;
      return;
    } finally {
      this.busy = false;
    }
    this.char = created;
    $<HTMLInputElement>('guest-name').value = '';
    await this.enter(created.id);
  }

  private async enter(charId: number): Promise<void> {
    const token = api.guestToken();
    if (this.busy || !token) return;
    this.busy = true;
    $('guest-error').textContent = 'กำลังเข้าสู่โลก…';
    try {
      await waitForGameAssets(this.char?.classId ?? null);
      const backend = await connectOnline(token, charId);
      $('guest-error').textContent = '';
      this.launch(backend);
    } catch (e) {
      $('guest-error').textContent = (e as Error).message;
    } finally {
      this.busy = false;
    }
  }
}

// ------------------------------------------------------------ account

class OnlineMenu {
  private chars: CharacterSummary[] = [];
  private selected: number | null = null;
  private creating = false;
  private busy = false;
  private readonly chosenClass: () => ClassId;
  private armedDelete: { id: number; t: number } | null = null;

  constructor(private readonly launch: Launcher) {
    this.chosenClass = buildClassCards($('online-class-cards'));
    $('login-box').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.login();
    });
    $('btn-register').onclick = () => this.showRegister();
    $('btn-register-back').onclick = () => this.showLogin();
    $('register-box').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.register();
    });
    for (const id of ['reg-user', 'reg-pass', 'reg-pass2', 'reg-agree']) $(id).addEventListener('input', () => this.checkRegister());
    document.querySelector('#register-box [data-rule="pass-len"]')!.textContent = `อย่างน้อย ${PASSWORD_MIN} ตัว`;
    document.querySelectorAll<HTMLButtonElement>('.pass-eye').forEach((b) => (b.onclick = () => togglePassword(b)));
    $('btn-logout').onclick = () => void this.logout();
    $('btn-create-char').onclick = () => void this.onCreateClick();
    $('char-list').addEventListener('click', (e) => this.onListClick(e));
    $('btn-enter-world').onclick = () => void this.enterWorld();
  }

  private async enterWorld(): Promise<void> {
    const token = api.savedToken();
    if (this.busy || this.selected === null || !token) return;
    this.busy = true;
    const btn = $<HTMLButtonElement>('btn-enter-world');
    btn.disabled = true;
    $('char-error').textContent = 'กำลังเข้าสู่โลก…';
    try {
      await waitForGameAssets(this.chars.find((c) => c.id === this.selected)?.classId ?? null);
      const backend = await connectOnline(token, this.selected);
      $('char-error').textContent = '';
      this.launch(backend);
    } catch (e) {
      $('char-error').textContent = (e as Error).message;
      btn.disabled = false;
    } finally {
      this.busy = false;
    }
  }

  /**
   * Shows the Login form. If a saved token still works, it also offers a one-click way back in,
   * or goes straight to the character list when `goToCharacters` is set.
   */
  async open(goToCharacters = false): Promise<void> {
    const resume = $('btn-account-continue');
    resume.classList.add('hidden');
    this.showLogin();
    void this.showGuestMoveHint();
    if (!api.savedToken()) return;
    try {
      const me = await api.me();
      resume.textContent = `เข้าต่อในชื่อ ${me.username}`;
      resume.onclick = () => {
        this.showCharacters(me.username).catch((e: Error) => this.showLogin(e.message));
      };
      resume.classList.remove('hidden');
      if (goToCharacters) resume.click();
    } catch (e) {
      if (e instanceof api.ApiFailure && e.status !== 401) $('login-error').textContent = e.message;
    }
  }

  /** Under the sign-up form: which guest character will move into the new account. */
  private async showGuestMoveHint(): Promise<void> {
    const hint = $('guest-move-hint');
    hint.classList.add('hidden');
    const c = await api.guestCharacter().catch(() => null);
    if (!c) return;
    hint.textContent = `สมัครสมาชิกใหม่จากเครื่องนี้ ตัวละคร Guest “${describe(c)}” จะย้ายเข้าบัญชีใหม่ทันที`;
    hint.classList.remove('hidden');
  }

  private showLogin(error = ''): void {
    $('login-box').classList.remove('hidden');
    $('register-box').classList.add('hidden');
    $('char-box').classList.add('hidden');
    $('login-error').textContent = error;
    $<HTMLInputElement>('login-user').focus();
  }

  private async login(): Promise<void> {
    if (this.busy) return;
    const username = $<HTMLInputElement>('login-user').value.trim();
    const password = $<HTMLInputElement>('login-pass').value;
    const err = $('login-error');
    if (!username || !password) return void (err.textContent = 'กรุณาใส่ชื่อผู้ใช้และรหัสผ่าน');
    this.busy = true;
    err.textContent = 'กำลังเข้าสู่ระบบ…';
    try {
      const r = await api.login(username, password);
      $<HTMLInputElement>('login-pass').value = '';
      err.textContent = '';
      await this.showCharacters(r.username);
    } catch (e) {
      err.textContent = (e as Error).message;
    } finally {
      this.busy = false;
    }
  }

  private showRegister(): void {
    $('login-box').classList.add('hidden');
    $('register-box').classList.remove('hidden');
    $('register-error').textContent = '';
    // Carry over a username typed into the Login form by mistake.
    const typed = $<HTMLInputElement>('login-user').value.trim();
    if (typed && !$<HTMLInputElement>('reg-user').value) $<HTMLInputElement>('reg-user').value = typed;
    this.checkRegister();
    $<HTMLInputElement>('reg-user').focus();
  }

  /**
   * Ticks each rule under the Register fields while typing, and returns the first problem
   * (null when the form is good). The server checks everything again.
   */
  private checkRegister(): string | null {
    const user = $<HTMLInputElement>('reg-user').value.trim();
    const pass = $<HTMLInputElement>('reg-pass').value;
    const pass2 = $<HTMLInputElement>('reg-pass2').value;
    const mark = (rule: string, typed: boolean, ok: boolean): void => {
      const li = document.querySelector(`#register-box [data-rule="${rule}"]`)!;
      li.classList.toggle('ok', typed && ok);
      li.classList.toggle('bad', typed && !ok);
    };
    mark('user-len', user.length > 0, user.length >= 3 && user.length <= 16);
    mark('user-chars', user.length > 0, /^[A-Za-z0-9_]*$/.test(user));
    mark('pass-len', pass.length > 0, pass.length >= PASSWORD_MIN);
    mark('pass-match', pass2.length > 0, pass2 === pass);
    $<HTMLButtonElement>('btn-register-submit').disabled = !$<HTMLInputElement>('reg-agree').checked;
    return checkUsername(user) ?? checkPassword(pass) ?? (pass2 === pass ? null : 'รหัสผ่านกับยืนยันรหัสผ่านไม่ตรงกัน');
  }

  private async register(): Promise<void> {
    if (this.busy || !$<HTMLInputElement>('reg-agree').checked) return;
    const err = $('register-error');
    const bad = this.checkRegister();
    if (bad) return void (err.textContent = bad);
    this.busy = true;
    err.textContent = 'กำลังสมัคร…';
    try {
      // A guest token on this browser makes the server turn that guest into the new account.
      const r = await api.register($<HTMLInputElement>('reg-user').value.trim(), $<HTMLInputElement>('reg-pass').value);
      for (const id of ['reg-user', 'reg-pass', 'reg-pass2']) $<HTMLInputElement>(id).value = '';
      $<HTMLInputElement>('reg-agree').checked = false;
      err.textContent = '';
      await this.showCharacters(r.username);
    } catch (e) {
      err.textContent = (e as Error).message;
    } finally {
      this.busy = false;
    }
  }

  private async logout(): Promise<void> {
    await api.logout();
    this.chars = [];
    this.selected = null;
    await this.open();
  }

  private async showCharacters(username: string): Promise<void> {
    $('account-name').textContent = username;
    $('login-box').classList.add('hidden');
    $('register-box').classList.add('hidden');
    $('char-box').classList.remove('hidden');
    $('char-error').textContent = '';
    this.chars = await api.listCharacters();
    if (!this.chars.some((c) => c.id === this.selected)) this.selected = this.chars[0]?.id ?? null;
    this.creating = this.chars.length === 0;
    this.render();
  }

  private render(): void {
    const list = $('char-list');
    list.innerHTML = '';
    for (let i = 0; i < MAX_CHARACTERS; i++) {
      const c = this.chars[i];
      const slot = document.createElement('div');
      if (!c) {
        slot.className = 'char-slot empty';
        slot.dataset.new = '1';
        slot.textContent = '+ ช่องว่าง';
        list.append(slot);
        continue;
      }
      slot.className = `char-slot${c.id === this.selected && !this.creating ? ' selected' : ''}`;
      slot.dataset.id = String(c.id);
      slot.append(portrait(c.classId, 80));
      const armed = this.armedDelete?.id === c.id && Date.now() - this.armedDelete.t < 3000;
      slot.insertAdjacentHTML('beforeend',
        `<div class="cname">${escapeHtml(c.name)}</div><div class="cmeta">Lv.${c.level} ${CLASSES[c.classId].name}</div>` +
        `<button class="cdel${armed ? ' armed' : ''}" data-del="${c.id}" title="ลบตัวละคร">${armed ? 'กดอีกครั้งเพื่อลบ' : '✕'}</button>`);
      list.append(slot);
    }
    const full = this.chars.length >= MAX_CHARACTERS;
    $('char-create').classList.toggle('hidden', !this.creating);
    const createBtn = $<HTMLButtonElement>('btn-create-char');
    createBtn.classList.toggle('hidden', full && !this.creating);
    createBtn.textContent = this.creating ? '✔ ยืนยันสร้างตัวละคร' : '+ สร้างตัวละคร';
    createBtn.classList.toggle('primary', this.creating);
    if (this.creating) $<HTMLInputElement>('new-char-name').focus();
    $<HTMLButtonElement>('btn-enter-world').disabled = this.creating || this.selected === null;
  }

  private onListClick(e: Event): void {
    const t = e.target as HTMLElement;
    const del = t.closest<HTMLElement>('[data-del]');
    if (del) {
      e.stopPropagation();
      void this.onDelete(Number(del.dataset.del));
      return;
    }
    const slot = t.closest<HTMLElement>('.char-slot');
    if (!slot) return;
    if (slot.dataset.new) {
      this.creating = true;
    } else {
      this.creating = false;
      this.selected = Number(slot.dataset.id);
    }
    $('char-error').textContent = '';
    this.render();
  }

  private async onCreateClick(): Promise<void> {
    if (!this.creating) {
      this.creating = true;
      return this.render();
    }
    if (this.busy) return;
    const name = $<HTMLInputElement>('new-char-name').value.trim();
    const err = $('char-error');
    const bad = checkCharacterName(name);
    if (bad) return void (err.textContent = bad);
    this.busy = true;
    try {
      const c = await api.createCharacter(name, this.chosenClass());
      $<HTMLInputElement>('new-char-name').value = '';
      this.chars.push(c);
      this.selected = c.id;
      this.creating = false;
      err.textContent = '';
      this.render();
    } catch (e) {
      err.textContent = (e as Error).message;
      if (e instanceof api.ApiFailure && e.status === 401) this.showLogin('กรุณาเข้าสู่ระบบใหม่');
    } finally {
      this.busy = false;
    }
  }

  /** First click arms the delete button for 3 seconds; the second click deletes. */
  private async onDelete(id: number): Promise<void> {
    if (!this.armedDelete || this.armedDelete.id !== id || Date.now() - this.armedDelete.t > 3000) {
      this.armedDelete = { id, t: Date.now() };
      this.render();
      setTimeout(() => this.render(), 3100);
      return;
    }
    this.armedDelete = null;
    try {
      await api.deleteCharacter(id);
      this.chars = this.chars.filter((c) => c.id !== id);
      if (this.selected === id) this.selected = this.chars[0]?.id ?? null;
      if (!this.chars.length) this.creating = true;
      this.render();
    } catch (e) {
      $('char-error').textContent = (e as Error).message;
    }
  }
}

/** The 👁 button next to a password field: shows or hides what was typed. */
function togglePassword(btn: HTMLButtonElement): void {
  const input = $<HTMLInputElement>(btn.dataset.for!);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.classList.toggle('on', show);
  btn.title = show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน';
  btn.setAttribute('aria-label', btn.title);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

export function buildMenu(launch: Launcher): void {
  const online = new OnlineMenu(launch);
  if (GUEST_LOGIN_ENABLED) {
    const guest = new GuestMenu(launch);
    $('btn-mode-guest').onclick = () => {
      show('guest');
      void guest.open();
    };
  }
  const toLogin = (resume = false): void => {
    show('online');
    void online.open(resume);
  };
  document.querySelectorAll<HTMLElement>('.btn-back').forEach((b) => (b.onclick = () => toLogin()));
  $('menu').classList.remove('hidden');
  // Back from the in-game menu: open the character list (or the guest screen) instead of the Login form.
  let after: string | null = null;
  try {
    after = sessionStorage.getItem(AFTER_EXIT_KEY);
    sessionStorage.removeItem(AFTER_EXIT_KEY);
  } catch {
    // Storage blocked: stay on the Login form.
  }
  toLogin(after === 'characters');
  if (after === 'guest') $('btn-mode-guest').click();
}
