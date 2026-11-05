// The in-game system menu (Esc or the ☰ button): settings, controls help, back to character select, log out.
// Leaving closes the connection (the server saves on close) and reloads the page into the right menu screen,
// which is simpler and safer than tearing the 3D scene down by hand.
import type { Game } from './Game';
import { logout } from './net/api';

/** Read once by the title menu after the reload. */
export const AFTER_EXIT_KEY = 'multiverse-after-exit';
export type AfterExit = 'characters' | 'title';

/** Leaving while in combat waits this long; moving or getting hit cancels it (owner). */
const EXIT_COUNTDOWN = 5;
/** "In combat" = hurt or attacked within this many seconds, or Auto Play running. */
const COMBAT_WINDOW = 5;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export class SystemMenu {
  private readonly panel: HTMLElement;
  private readonly countdownEl: HTMLElement;
  private exit: { to: AfterExit; left: number } | null = null;
  private lastCombat = -99;
  private lastHp = -1;
  private clock = 0;

  constructor(private readonly g: Game) {
    const guest = g.backend.guest;
    const btn = document.createElement('button');
    btn.id = 'btn-menu';
    btn.textContent = '☰ เมนู (Esc)';
    btn.onclick = () => this.toggle();
    document.querySelector('#hud-topright .hud-buttons')!.prepend(btn);

    this.panel = document.createElement('div');
    this.panel.id = 'sys-menu';
    this.panel.className = 'panel hidden';
    this.panel.innerHTML = `
      <div class="panel-head"><span>เมนู</span><button data-act="close">✕</button></div>
      <div class="sys-view" data-view="main">
        <button data-act="resume" class="primary">กลับเข้าเกม</button>
        <button data-act="settings">ตั้งค่า</button>
        <button data-act="help">ปุ่มลัด / วิธีเล่น</button>
        <div class="sys-sep"></div>
        <button data-act="chars">${guest ? 'กลับไปหน้า Guest' : 'กลับไปเลือกตัวละคร'}</button>
        <button data-act="logout">${guest ? 'กลับหน้าแรก' : 'ออกจากระบบ'}</button>
        ${guest ? '<div class="sys-note">สมัครสมาชิกที่หน้าแรก<br>เพื่อเก็บตัวละคร Guest นี้ไว้ถาวร</div>' : ''}
      </div>
      <div class="sys-view hidden" data-view="settings">
        <button data-act="audio">เสียง</button>
        <button data-act="hudstyle" id="sys-hudstyle"></button>
        <button data-act="auto">ตั้งค่า Auto</button>
        <div class="sys-sep"></div>
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
      case 'auto':
        this.toggle(false);
        return $('btn-auto-set').click();
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
