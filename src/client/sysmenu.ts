// The in-game system menu (Esc or the ☰ button): settings, controls help, back to character select, log out.
// Leaving closes the connection (the server saves on close) and reloads the page into the right menu screen,
// which is simpler and safer than tearing the 3D scene down by hand.
import type { Game } from './Game';
import { logout } from './net/api';
import { audioEngine } from './audio/engine';

/** Read once by the title menu after the reload. */
export const AFTER_EXIT_KEY = 'multiverse-after-exit';
export type AfterExit = 'characters' | 'title';

/** Leaving while in combat waits this long; moving or getting hit cancels it (owner). */
const EXIT_COUNTDOWN = 5;
/** "In combat" = hurt or attacked within this many seconds, or Auto Play running. */
const COMBAT_WINDOW = 5;

/** Painted badge from public/assets/sprites/ui/ico_<name>.png. A glyph draws on the blank badge for systems with no art yet. */
const badge = (name: string, glyph = ''): string =>
  `<img src="assets/sprites/ui/ico_${name}.png" alt="">${glyph ? `<span class="ico-glyph">${glyph}</span>` : ''}`;

/** Icon grid, 3 columns: [action, icon, label]. Only systems that exist; add a tile when a new one is built. */
const MENU_ITEMS: [string, string, string][] = [
  ['bag', badge('bag'), 'กระเป๋า'], ['map', badge('map'), 'แผนที่'], ['autoset', badge('autoset'), 'ตั้งค่า Auto'],
  ['audio', badge('blank', '🔊'), 'เสียง'], ['help', badge('help'), 'วิธีเล่น'], ['settings', badge('settings'), 'ตั้งค่า'],
];

/** Top-right icon row: [button id, icon, label]. */
const TOP_ICONS: [string, string, string][] = [
  ['top-auto', badge('auto'), 'AUTO: OFF'], ['top-autoset', badge('autoset'), 'ตั้งค่า Auto'], ['top-bag', badge('bag'), 'กระเป๋า'],
  ['top-map', badge('map'), 'แผนที่'], ['top-mute', badge('blank', '🔊'), 'เสียง'], ['top-settings', badge('settings'), 'ตั้งค่า'], ['top-menu', badge('menu'), 'เมนู'],
];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export class SystemMenu {
  private readonly panel: HTMLElement;
  private readonly countdownEl: HTMLElement;
  private exit: { to: AfterExit; left: number } | null = null;
  private lastCombat = -99;
  private lastHp = -1;
  private clock = 0;
  private readonly autoBtn: HTMLElement;
  private readonly muteBtn: HTMLElement;

  constructor(private readonly g: Game) {
    const guest = g.backend.guest;
    // Top-right icon row (the old button column under the minimap is hidden by CSS, its buttons are still clicked from here).
    const row = document.createElement('div');
    row.id = 'hud-iconrow';
    row.innerHTML = TOP_ICONS.map(
      ([id, icon, label]) =>
        `<button id="${id}" class="top-icon"${id ? '' : ' disabled'}><span class="sys-ico">${icon}</span><span class="sys-label">${label}</span><i class="badge hidden" data-badge="${label}"></i></button>`,
    ).join('');
    $('hud-topright').prepend(row);
    this.autoBtn = $('top-auto');
    this.muteBtn = $('top-mute');
    $('top-auto').onclick = () => g.toggleAuto();
    $('top-autoset').onclick = () => $('btn-auto-set').click();
    // Reuses the sound window's own mute button, so its text stays in sync.
    $('top-mute').onclick = () => $('audio-mute')?.click();
    $('top-bag').onclick = () => g.hud.toggleBag();
    $('top-map').onclick = () => g.hud.toggleMap();
    $('top-settings').onclick = () => {
      this.toggle(true);
      this.showView('settings');
    };
    $('top-menu').onclick = () => this.toggle();

    this.panel = document.createElement('div');
    this.panel.id = 'sys-menu';
    this.panel.className = 'panel hidden';
    this.panel.innerHTML = `
      <div class="panel-head"><span>เมนู</span><button data-act="close">✕</button></div>
      <div class="sys-view sys-grid" data-view="main">
        ${MENU_ITEMS.map(
          ([act, icon, label]) =>
            `<button class="sys-tile" ${act ? `data-act="${act}"` : 'disabled'}>` +
            `<span class="sys-ico">${icon}</span><span class="sys-label">${label}</span><i class="badge hidden" data-badge="${label}"></i></button>`,
        ).join('')}
      </div>
      <div class="sys-view hidden" data-view="settings">
        <button data-act="audio">เสียง</button>
        <button data-act="hudstyle" id="sys-hudstyle"></button>
        <button data-act="help">ปุ่มลัด / วิธีเล่น</button>
        <div class="sys-sep"></div>
        <button data-act="chars">${guest ? 'กลับไปหน้า Guest' : 'กลับไปเลือกตัวละคร'}</button>
        <button data-act="logout">${guest ? 'กลับหน้าแรก' : 'ออกจากระบบ'}</button>
        ${guest ? '<div class="sys-note">สมัครสมาชิกที่หน้าแรก<br>เพื่อเก็บตัวละคร Guest นี้ไว้ถาวร</div>' : ''}
        <div class="sys-sep"></div>
        <button data-act="resume" class="primary">กลับเข้าเกม</button>
        <button data-act="back">‹ กลับ</button>
      </div>`;
    this.panel.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act) this.onAct(act);
    });
    $('hud').append(this.panel);

    this.countdownEl = document.createElement('div');
    this.countdownEl.id = 'exit-countdown';
    this.countdownEl.className = 'hidden';
    $('hud').append(this.countdownEl);
  }

  private readonly badges = new Map<string, number>();

  /** Player notification on an icon (key = the icon's Thai label, e.g. 'จดหมาย'): 0 hides it, 1 = red dot, 2+ = number.
   *  The top-right เมนู icon shows the total of all the others. Nothing calls this yet: no feature sends notifications. */
  setBadge(key: string, count: number): void {
    this.badges.set(key, count);
    const total = [...this.badges].reduce((a, [k, n]) => a + (k === 'เมนู' ? 0 : n), 0);
    for (const el of document.querySelectorAll<HTMLElement>('i.badge')) {
      const n = el.dataset.badge === 'เมนู' ? total : (this.badges.get(el.dataset.badge!) ?? 0);
      el.classList.toggle('hidden', n <= 0);
      el.classList.toggle('dot', n === 1);
      el.textContent = n > 1 ? String(n) : '';
    }
  }

  get open(): boolean {
    return !this.panel.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    if (show) {
      this.g.hud.closePanels();
      this.showView('main');
    }
    this.panel.classList.toggle('hidden', !show);
  }

  /** Esc: cancel a pending exit, else close what's open, else open this menu. */
  onEscape(): void {
    if (this.exit) return this.cancelExit('ยกเลิกการออก');
    if (this.open) return this.toggle(false);
    if (this.g.hud.anyPanelOpen()) return this.g.hud.closePanels();
    this.toggle(true);
  }

  /** Called every frame with what the player is doing, to track combat and run the exit countdown. */
  update(dt: number, acting: boolean, moving: boolean): void {
    this.clock += dt;
    this.autoBtn.classList.toggle('active', this.g.autoPlay);
    this.autoBtn.querySelector('.sys-label')!.textContent = this.g.autoPlay ? 'AUTO: ON' : 'AUTO: OFF';
    const muted = audioEngine.settings.muted;
    this.muteBtn.querySelector('.ico-glyph')!.textContent = muted ? '🔇' : '🔊';
    this.muteBtn.querySelector('.sys-label')!.textContent = muted ? 'ปิดเสียง' : 'เสียง';
    const p = this.g.player;
    if (this.lastHp >= 0 && p.hp < this.lastHp - 0.5) {
      this.lastCombat = this.clock;
      if (this.exit) this.cancelExit('ยกเลิกการออก — โดนโจมตี');
    }
    this.lastHp = p.hp;
    if (acting) this.lastCombat = this.clock;
    if (!this.exit) return;
    if (moving) return this.cancelExit('ยกเลิกการออก — ขยับตัว');
    this.exit.left -= dt;
    if (this.exit.left <= 0) return void this.leave(this.exit.to);
    this.countdownEl.textContent = `กำลังออกใน ${Math.ceil(this.exit.left)} วินาที… (ขยับ โดนโจมตี หรือกด Esc เพื่อยกเลิก)`;
  }

  private get inCombat(): boolean {
    return this.g.autoPlay || this.clock - this.lastCombat < COMBAT_WINDOW;
  }

  private showView(v: string): void {
    this.panel.querySelectorAll<HTMLElement>('.sys-view').forEach((el) => el.classList.toggle('hidden', el.dataset.view !== v));
    $('sys-hudstyle').textContent = $('btn-hud-style').textContent;
  }

  private onAct(act: string): void {
    switch (act) {
      case 'close':
      case 'resume':
        return this.toggle(false);
      case 'bag':
        this.toggle(false);
        return this.g.hud.toggleBag(true);
      case 'map':
        this.toggle(false);
        return this.g.hud.toggleMap(true);
      case 'autoset':
        this.toggle(false);
        return $('btn-auto-set').click();
      case 'settings':
        return this.showView('settings');
      case 'back':
        return this.showView('main');
      case 'help':
        this.toggle(false);
        return this.g.hud.toggleHelp(true);
      case 'audio':
        this.toggle(false);
        return $('btn-audio')?.click();
      case 'hudstyle':
        $('btn-hud-style').click();
        return void ($('sys-hudstyle').textContent = $('btn-hud-style').textContent);
      case 'chars':
        return this.requestExit('characters');
      case 'logout':
        return this.requestExit('title');
    }
  }

  private requestExit(to: AfterExit): void {
    this.toggle(false);
    if (!this.inCombat || !this.g.player.alive) return void this.leave(to);
    this.exit = { to, left: EXIT_COUNTDOWN };
    this.countdownEl.classList.remove('hidden');
    this.update(0, false, false);
  }

  private cancelExit(msg: string): void {
    this.exit = null;
    this.countdownEl.classList.add('hidden');
    this.g.hud.log(msg, '#ffcf6a');
  }

  private async leave(to: AfterExit): Promise<void> {
    this.exit = null;
    this.countdownEl.textContent = 'กำลังออก…';
    this.countdownEl.classList.remove('hidden');
    this.g.backend.close();
    // Log out of the account; a guest keeps its token so it can come back from the title screen.
    if (to === 'title' && !this.g.backend.guest) await logout().catch(() => undefined);
    try {
      sessionStorage.setItem(AFTER_EXIT_KEY, to === 'characters' ? (this.g.backend.guest ? 'guest' : 'characters') : 'title');
    } catch {
      // Storage blocked: the page just opens on the title screen.
    }
    location.reload();
  }
}
