// Title menu: play as a guest, or log in / sign up. Either way the game runs on the server.
import { loadGameAssets, loadMenuAssets, onAssetProgress, portraitSource } from './assets';
import { loadSwordRig } from './rig/RigActor';
import { paperSwordOn } from './rig/paperSwitch';
import { CLASSES, CLASS_IDS } from '../shared/data/classes';
import { MAX_CHARACTERS, PASSWORD_MIN, checkCharacterName, checkPassword, checkUsername, type CharacterSummary } from '../shared/api';
import type { ClassId } from '../shared/types';
import * as api from './net/api';
import { connectOnline, type OnlineBackend } from './net/online';
import { preloadHudImages } from './icons';
import { AFTER_EXIT_KEY, GOOGLE_AFTER_EXIT_KEY } from './sysmenu';
import { beginEntryLoading, cancelEntryLoading, preloadLoadingArt } from './loadingScreen';
import { imgUrl } from './img';

export type Launcher = (backend: OnlineBackend) => void;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Painted head-and-shoulders picture of a class (ui/portrait_<class>.png), for the HUD frame and the character list. */
export function facePortrait(classId: string, size: number): HTMLImageElement {
  const img = new Image(size, size);
  img.className = 'face-portrait';
  img.alt = '';
  img.draggable = false;
  img.src = imgUrl(`assets/sprites/ui/portrait_${classId}.png`);
  return img;
}

export function portrait(key: string, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const draw = (): void => {
    // First cell = front view, frame 0 (of the idle animation when there is a full set).
    const src = portraitSource(key);
    if (!src) return;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const [sx, sy, side] = src.crop ?? [0, 0, 0];
    if (src.crop) ctx.drawImage(src.img, sx, sy, side, side, 0, 0, size, size);
    else ctx.drawImage(src.img, 0, 0, src.cw, src.ch, 0, 0, size, size);
  };
  // The menu shows before the portraits arrive on a slow link; they fill in when loaded.
  if (portraitSource(key)) draw();
  else void loadMenuAssets(CLASS_IDS).then(draw);
  return c;
}

/**
 * Puts the loading screen up and waits, with a progress bar, until every game texture and HUD picture
 * has loaded (the textures keep loading in the background while the menu is up). Runs before
 * connecting, so the character doesn't stand in the world unseen while a slow link finishes the
 * download. The screen stays up after this: the game takes it down once its first frames are drawn
 * (endEntryLoading), or the menu does if entering fails (cancelEntryLoading).
 */
async function waitForGameAssets(classId: ClassId | null, floor = 1): Promise<void> {
  const screen = beginEntryLoading(classId, floor);
  // Its picture before the hundreds of game files, which would otherwise hold it up.
  await screen.ready;
  // Game textures are most of the bytes; the HUD pictures are the last stretch of the bar.
  let tex = 0;
  let hud = 0;
  const show = (): void => screen.progress(tex * 0.9 + hud * 0.1);
  const stop = onAssetProgress((f) => {
    tex = f;
    show();
  });
  try {
    await Promise.all([loadGameAssets(), preloadHudImages((f) => {
      hud = f;
      show();
    }),
    // The papercraft sword knight trial: loaded only where its switch is on (a failed load keeps the old sprite).
    paperSwordOn() ? loadSwordRig().catch((e) => console.warn('[sword rig]', e)) : null]);
  } finally {
    stop();
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
      `<ul>${c.lines.map((l) => `<li><i class="line-dot" style="background:${l.color}"></i>${l.nameTh}</li>`).join('')}</ul>`;
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

/** Owner turned Guest Login back on (2026-11-12). Set to false to make the button picture-only again. */
const GUEST_LOGIN_ENABLED: boolean = true;

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

  constructor(private readonly launch: Launcher, private readonly googleOn: Promise<boolean>) {
    this.chosenClass = buildClassCards($('guest-class-cards'));
    $('btn-guest-google').onclick = () => {
      $('guest-error').textContent = 'กำลังไปที่ Google…';
      api.googleStart('upgrade').catch((e: Error) => ($('guest-error').textContent = e.message));
    };
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
      cancelEntryLoading();
      $('guest-error').textContent = (e as Error).message;
      return;
    }
    $('guest-error').textContent = '';
    if (!this.char) return this.showCreate();
    $('guest-continue').classList.remove('hidden');
    $('btn-guest-continue').textContent = `เล่นต่อ: ${describe(this.char)}`;
    $('btn-guest-google').classList.toggle('hidden', !(await this.googleOn));
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
      await waitForGameAssets(this.char?.classId ?? null, this.char?.floor);
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
  /** A Google round trip that needs a username for the new account. */
  private googleTicket: { ticket: string; guest: boolean } | null = null;

  constructor(private readonly launch: Launcher, private readonly googleOn: Promise<boolean>) {
    this.chosenClass = buildClassCards($('online-class-cards'));
    $('btn-google').onclick = () => {
      $('login-error').textContent = 'กำลังไปที่ Google…';
      api.googleStart('login').catch((e: Error) => ($('login-error').textContent = e.message));
    };
    $('google-name-box').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.googleName();
    });
    $('btn-google-name-back').onclick = () => {
      this.googleTicket = null;
      this.showLogin();
    };
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
      const ch = this.chars.find((c) => c.id === this.selected);
      await waitForGameAssets(ch?.classId ?? null, ch?.floor);
      const backend = await connectOnline(token, this.selected);
      $('char-error').textContent = '';
      this.launch(backend);
    } catch (e) {
      cancelEntryLoading();
      $('char-error').textContent = (e as Error).message;
      btn.disabled = false;
    } finally {
      this.busy = false;
    }
  }

  /**
   * Shows the Login form. If a saved token still works, it also offers a one-click way back in,
   * or goes straight to the character list when `goToCharacters` is set (back from the game's "เลือกตัวละคร": the
   * character screen waits for the server instead of the Login form flashing up, owner 2026-11-26; the Login form
   * shows only when the saved login no longer works).
   */
  async open(goToCharacters = false): Promise<void> {
    const resume = $('btn-account-continue');
    resume.classList.add('hidden');
    const waiting = goToCharacters && !!api.savedToken();
    if (waiting) this.showWaiting();
    else this.showLogin();
    void this.googleOn.then((on) => $('btn-google').classList.toggle('hidden', !on));
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
      if (waiting) this.showLogin();
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

  /** The character screen, empty, while the saved login is checked (open with goToCharacters). */
  private showWaiting(): void {
    $('login-box').classList.add('hidden');
    $('register-box').classList.add('hidden');
    $('google-name-box').classList.add('hidden');
    $('google-link-row').classList.add('hidden');
    $('char-create').classList.add('hidden');
    $('btn-create-char').classList.add('hidden');
    $<HTMLButtonElement>('btn-enter-world').disabled = true;
    $('account-name').textContent = '';
    $('char-error').textContent = '';
    $('char-list').textContent = 'กำลังโหลด…';
    $('char-box').classList.remove('hidden');
  }

  private showLogin(error = ''): void {
    $('login-box').classList.remove('hidden');
    $('register-box').classList.add('hidden');
    $('google-name-box').classList.add('hidden');
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
    $('google-name-box').classList.add('hidden');
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

  private async showCharacters(username: string, note = ''): Promise<void> {
    $('account-name').textContent = username;
    $('login-box').classList.add('hidden');
    $('register-box').classList.add('hidden');
    $('google-name-box').classList.add('hidden');
    $('char-box').classList.remove('hidden');
    $('char-error').textContent = note;
    void this.showGoogleRow();
    this.chars = await api.listCharacters();
    if (!this.chars.some((c) => c.id === this.selected)) this.selected = this.chars[0]?.id ?? null;
    this.creating = this.chars.length === 0;
    this.render();
  }

  /** Under the account name: the linked Google account (unlink when there is a password), or a button to link one. */
  private async showGoogleRow(): Promise<void> {
    const row = $('google-link-row');
    row.classList.add('hidden');
    const [me, on] = await Promise.all([api.me().catch(() => null), this.googleOn]);
    if (!me || me.guest) return;
    row.replaceChildren();
    if (me.google) {
      const label = document.createElement('span');
      label.innerHTML = `ผูก Google แล้ว: <b>${escapeHtml(me.google)}</b>`;
      row.append(label);
      if (me.hasPassword) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'ยกเลิกการผูก';
        b.onclick = async () => {
          if (!confirm(`ยกเลิกการผูก Google (${me.google})? หลังจากนี้เข้าได้ด้วยชื่อผู้ใช้และรหัสผ่านเท่านั้น`)) return;
          try {
            await api.unlinkGoogle();
            $('char-error').textContent = 'ยกเลิกการผูก Google แล้ว';
          } catch (e) {
            $('char-error').textContent = (e as Error).message;
          }
          void this.showGoogleRow();
        };
        row.append(b);
      }
    } else if (on) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'logon-google';
      b.textContent = 'ผูกบัญชี Google';
      b.title = 'เข้าเกมด้วย Google ได้อีกทาง (ชื่อผู้ใช้และรหัสผ่านเดิมยังใช้ได้)';
      b.onclick = () => void this.linkGoogle();
      row.append(b);
    } else {
      return;
    }
    row.classList.remove('hidden');
  }

  /** Leaves for Google to link it to the logged-in account. */
  async linkGoogle(): Promise<void> {
    $('char-error').textContent = 'กำลังไปที่ Google…';
    await api.googleStart('link').catch((e: Error) => ($('char-error').textContent = e.message));
  }

  /** Back from Google (the ticket from /#google=…). */
  async googleReturn(ticket: string): Promise<void> {
    show('online');
    this.showLogin('กำลังเข้าสู่ระบบด้วย Google…');
    let r;
    try {
      r = await api.googleFinish(ticket);
    } catch (e) {
      return this.showLogin((e as Error).message);
    }
    if (r.kind === 'error') {
      // A failed link happened while logged in: back to the character list with the reason.
      const me = api.savedToken() ? await api.me().catch(() => null) : null;
      if (me && !me.guest) return void this.showCharacters(me.username, r.message).catch((e: Error) => this.showLogin(e.message));
      return this.showLogin(r.message);
    }
    if (r.kind === 'session') return void this.showCharacters(r.username).catch((e: Error) => this.showLogin(e.message));
    if (r.kind === 'linked') {
      const me = await api.me().catch(() => null);
      if (me) return void this.showCharacters(me.username, `ผูก Google (${r.email}) แล้ว — ครั้งหน้ากด "เข้าสู่ระบบด้วย Google" ได้เลย`);
      return this.showLogin(`ผูก Google (${r.email}) แล้ว`);
    }
    this.googleTicket = { ticket, guest: r.guest };
    $('login-box').classList.add('hidden');
    $('google-name-box').classList.remove('hidden');
    $('google-name-email').textContent = r.email;
    $('google-guest-hint').classList.toggle('hidden', !r.guest);
    $('google-name-error').textContent = '';
    $<HTMLInputElement>('google-user').focus();
  }

  private async googleName(): Promise<void> {
    const t = this.googleTicket;
    if (this.busy || !t) return;
    const username = $<HTMLInputElement>('google-user').value.trim();
    const bad = checkUsername(username);
    const err = $('google-name-error');
    if (bad) return void (err.textContent = bad);
    this.busy = true;
    err.textContent = 'กำลังสร้างบัญชี…';
    try {
      const r = await api.googleFinish(t.ticket, username, t.guest);
      if (r.kind !== 'session') throw new Error(r.kind === 'error' ? r.message : 'ลองใหม่อีกครั้ง');
      this.googleTicket = null;
      err.textContent = '';
      await this.showCharacters(r.username);
    } catch (e) {
      err.textContent = (e as Error).message;
    } finally {
      this.busy = false;
    }
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
      slot.append(facePortrait(c.classId, 80));
      const armed = this.armedDelete?.id === c.id && Date.now() - this.armedDelete.t < 3000;
      slot.insertAdjacentHTML('beforeend',
        `<div class="cname" translate="no">${escapeHtml(c.name)}</div><div class="cmeta">Lv.${c.level} ${CLASSES[c.classId].name}</div>` +
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
  // The loading pictures download while the player logs in, so the entry screen has its art at once.
  preloadLoadingArt();
  const googleOn = api.googleEnabled();
  const online = new OnlineMenu(launch, googleOn);
  if (GUEST_LOGIN_ENABLED) {
    const guest = new GuestMenu(launch, googleOn);
    $('btn-mode-guest').removeAttribute('aria-disabled');
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
  // Back from Google: the ticket is in the fragment. Taken out of the address bar at once.
  const ticket = /^#google=([\w-]{16,64})$/.exec(location.hash)?.[1];
  if (ticket) {
    history.replaceState(null, '', location.pathname + location.search);
    void online.googleReturn(ticket);
    return;
  }
  // "ผูก Google" from the in-game menu: the game was left first (sysmenu.ts), now off to Google.
  let viaGoogle: string | null = null;
  try {
    viaGoogle = sessionStorage.getItem(GOOGLE_AFTER_EXIT_KEY);
    sessionStorage.removeItem(GOOGLE_AFTER_EXIT_KEY);
  } catch {
    // Storage blocked: nothing to resume.
  }
  if (viaGoogle === 'upgrade') {
    show('guest');
    $('guest-error').textContent = 'กำลังไปที่ Google…';
    api.googleStart('upgrade').catch((e: Error) => ($('guest-error').textContent = e.message));
    return;
  }
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
  if (viaGoogle === 'link') void online.linkGoogle();
}
