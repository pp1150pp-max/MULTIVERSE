// The in-game system menu (Esc or the ☰ button): settings, controls help, back to character select, log out.
// Leaving closes the connection (the server saves on close) and reloads the page into the right menu screen,
// which is simpler and safer than tearing the 3D scene down by hand.
import type { Game } from './Game';
import { googleEnabled, logout } from './net/api';
import { imgUrl } from './img';
import { gfxMenuOn } from './gfxPrefs';
import { toggleGfxPanel } from './gfxPanel';
import { toggleKeybindPanel } from './keybindPanel';
import { currentBalance } from '../shared/balance';
import { newsButtonOn } from './news';
import { codeMenuLayout, menuEntry, type MenuLayoutConfig } from '../shared/menuLayout';

/** Read once by the title menu after the reload. */
export const AFTER_EXIT_KEY = 'multiverse-after-exit';
export type AfterExit = 'characters' | 'title';
/** sessionStorage: 'link' / 'upgrade' = go on to Google once the game is left (menu.ts buildMenu). */
export const GOOGLE_AFTER_EXIT_KEY = 'multiverse-google-after-exit';

/** Leaving while in combat waits this long; moving or getting hit cancels it (owner). */
const EXIT_COUNTDOWN = 5;
/** "In combat" = hurt or attacked within this many seconds, or Auto Play running. */
const COMBAT_WINDOW = 5;

/** Painted badge from public/assets/sprites/ui/ico_<name>.png. A glyph draws on the blank badge for systems with no art yet. */
const badge = (name: string, glyph = ''): string =>
  `<img src="${imgUrl(`assets/sprites/ui/ico_${name}.png`)}" alt="">${glyph ? `<span class="ico-glyph">${glyph}</span>` : ''}`;

/** Party has no painted badge yet: the blank one with a glyph. Swap for badge('party') once ico_party.png exists. */
const PARTY_ICON = badge('blank', '👥');

/** Mail has no painted badge yet (a friend adds ico_mail.png later): the blank one with a glyph. Swap for badge('mail'). */
const MAIL_ICON = badge('blank', '✉');

/** Trade has no painted badge yet: the blank one with a glyph. Swap for badge('trade') once ico_trade.png exists. */
const TRADE_ICON = badge('blank', '🤝');

/** Friends: painted badge (art_templates/ui/raw/ico_friends.png, magenta keyed out and cut to 96×96). */
const FRIENDS_ICON = badge('friends');

/** Daily login calendar: painted badge (art_templates/ui/raw/ico_daily.png, magenta keyed out, 96×96). */
const DAILY_ICON = badge('daily');

/** Cash shop: painted badge (art_templates/cashshop/raw/ico_cashshop.png, cut by tools/cut_cashshop.cjs). */
const CASH_ICON = badge('cashshop');

/** Skills have no painted badge yet: the blank one with a glyph. Swap for badge('skills') once ico_skills.png exists. */
const SKILLS_ICON = badge('blank', '⚔');

/** Every button's picture, by id (the ids and Thai names are in src/shared/menuLayout.ts; where each sits is set on /admin → จัดเมนูเกม). */
const ICONS: Record<string, string> = {
  bag: badge('bag'), skills: SKILLS_ICON, party: PARTY_ICON, friends: FRIENDS_ICON, trade: TRADE_ICON, daily: DAILY_ICON, map: badge('map'),
  cosmetics: badge('blank', '👑'), cashshop: CASH_ICON, autoset: badge('autoset'), audio: badge('blank', '🔊'), graphics: badge('blank', '🎨'),
  help: badge('help'), news: badge('blank', '📰'), mail: MAIL_ICON, report: badge('blank', '🐞'), fullscreen: badge('blank', '⛶'), settings: badge('settings'),
  auto: badge('auto'), menu: badge('menu'),
};
/** The top row's own short name where it differs from the menu's. */
const TOP_LABEL: Record<string, string> = { daily: 'รายวัน' };
/** No such buttons for a guest (no mail, reports, trade, friends, daily login). */
const GUEST_NO = new Set(['mail', 'report', 'trade', 'friends', 'daily']);

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export class SystemMenu {
  private readonly panel: HTMLElement;
  private readonly countdownEl: HTMLElement;
  private exit: { to: AfterExit; left: number } | null = null;
  /** The pending exit goes on to Google (the "ผูก Google" button); written to sessionStorage only once really leaving. */
  private toGoogle = false;
  private lastCombat = -99;
  private lastHp = -1;
  private clock = 0;
  private autoBtn!: HTMLElement;
  private readonly row: HTMLElement;
  /** The layout drawn now (the balance's object, so a new one from the server is noticed by identity). */
  private drawn: MenuLayoutConfig | null = null;

  constructor(private readonly g: Game) {
    const guest = g.backend.guest;
    // Top-right icon row (the old button column under the minimap is hidden by CSS, its buttons are still clicked from here).
    this.row = document.createElement('div');
    this.row.id = 'hud-iconrow';
    $('hud-topright').prepend(this.row);
    this.row.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('.top-icon')?.dataset.entry;
      if (id) this.onTop(id);
    });

    this.panel = document.createElement('div');
    this.panel.id = 'sys-menu';
    this.panel.className = 'panel hidden';
    this.panel.innerHTML = `
      <div class="panel-head"><span>เมนู</span><button data-act="close">✕</button></div>
      <div class="sys-view sys-grid" data-view="main"></div>
      <div class="sys-view hidden" data-view="settings">
        <button data-act="hudstyle" id="sys-hudstyle"></button>
        <button data-act="partyblock" id="sys-partyblock"></button>
        <button data-act="keybinds" id="sys-keybinds">ตั้งค่าปุ่ม</button>
        ${guest ? '' : '<button data-act="tradeblock" id="sys-tradeblock"></button>'}
        <div class="sys-sep"></div>
        <button data-act="google" id="sys-google" class="hidden">${guest ? 'บันทึกตัวละครด้วย Google' : 'ผูกบัญชี Google'}</button>
        <button data-act="chars">${guest ? 'กลับไปหน้า Guest' : 'กลับไปเลือกตัวละคร'}</button>
        <button data-act="logout">${guest ? 'กลับหน้าแรก' : 'ออกจากระบบ'}</button>
        ${guest ? '<div class="sys-note">สมัครสมาชิกที่หน้าแรก<br>เพื่อเก็บตัวละคร Guest นี้ไว้ถาวร</div>' : ''}
        <div class="sys-sep"></div>
        <button data-act="resume" class="primary">กลับเข้าเกม</button>
        <button data-act="back">‹ กลับ</button>
      </div>`;
    this.build();
    void googleEnabled().then((on) => this.panel.querySelector('#sys-google')?.classList.toggle('hidden', !on));
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
   *  The top-right เมนู icon shows the total of all the others. The mailbox sets 'จดหมาย' (src/client/mail.ts). */
  setBadge(key: string, count: number): void {
    this.badges.set(key, count);
    this.renderBadges();
  }

  private renderBadges(): void {
    // The เมนู icon adds up only what sits in the menu window (a button moved to the top row shows its own badge).
    const inMenu = new Set((this.drawn?.menu ?? []).map((id) => menuEntry(id)?.label));
    const total = [...this.badges].reduce((a, [k, n]) => a + (k !== 'เมนู' && inMenu.has(k) ? n : 0), 0);
    for (const el of document.querySelectorAll<HTMLElement>('i.badge')) {
      const n = el.dataset.badge === 'เมนู' ? total : (this.badges.get(el.dataset.badge!) ?? 0);
      el.classList.toggle('hidden', n <= 0);
      el.classList.toggle('dot', n === 1);
      el.textContent = n > 1 ? String(n) : '';
    }
  }

  /** Draws the buttons again (the news switch changed). */
  rebuild(): void {
    this.build();
  }

  /** Draws the top row and the menu grid from the balance's layout (again whenever the server sends a new one). */
  private build(): void {
    const lay = currentBalance().menuLayout;
    this.drawn = lay;
    const guest = this.g.backend.guest;
    // No เต็มจอ where the browser can't do it (iPhone Safari); none of mail / report / trade / friends / daily for a guest.
    const ok = (id: string) => !(guest && GUEST_NO.has(id)) && !(id === 'fullscreen' && !document.fullscreenEnabled) && !(id === 'news' && !newsButtonOn());
    const label = (id: string) => menuEntry(id)?.label ?? id;
    const tile = (id: string, extra = '') =>
      `<button class="sys-tile${extra}" data-act="${id}"><span class="sys-ico">${ICONS[id] ?? ''}</span><span class="sys-label">${label(id)}</span><i class="badge hidden" data-badge="${label(id)}"></i></button>`;
    this.row.innerHTML = lay.top.filter(ok).map(
      (id) => `<button id="top-${id}" class="top-icon" data-entry="${id}" data-act="${id}"><span class="sys-ico">${ICONS[id] ?? ''}</span><span class="sys-label">${TOP_LABEL[id] ?? (id === 'auto' ? 'AUTO: OFF' : label(id))}</span><i class="badge hidden" data-badge="${label(id)}"></i></button>`,
    ).join('');
    // Touch play hides the top row (CSS), so what was put there also goes in the menu window, just before ตั้งค่า (which stays last).
    // (Not what the code only ever had up there, i.e. แจ้งปัญหา: touch never had it in the menu window.)
    const code = codeMenuLayout();
    const touchExtra = lay.top.filter((id) => id !== 'auto' && id !== 'menu' && !lay.menu.includes(id) && !(code.top.includes(id) && !code.menu.includes(id)));
    const menu = lay.menu.filter((id) => id !== 'settings');
    const html = [...menu.filter(ok).map((id) => tile(id)), ...touchExtra.filter(ok).map((id) => tile(id, ' touch-extra')), tile('settings')];
    this.panel.querySelector('[data-view="main"]')!.innerHTML = html.join('');
    this.autoBtn = document.getElementById('top-auto') ?? document.createElement('button');
    this.applyGfxTile();
    this.renderBadges();
  }

  /** The graphics window's button only while /admin shows it (fxLayer.gfxMenu). */
  private applyGfxTile(): void {
    for (const el of document.querySelectorAll<HTMLElement>('#sys-menu [data-act="graphics"], #hud-iconrow [data-act="graphics"]')) el.classList.toggle('hidden', !gfxMenuOn());
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
    // Esc closes the trade window = cancels the trade (nothing left the bags, so nothing to return).
    if (this.g.trade.open && !this.g.hud.hasOverlay()) return this.g.trade.cancel();
    if (this.g.hud.anyPanelOpen()) return this.g.hud.closePanels();
    this.toggle(true);
  }

  /** Called every frame with what the player is doing, to track combat and run the exit countdown. */
  update(dt: number, acting: boolean, moving: boolean): void {
    this.clock += dt;
    if (this.drawn !== currentBalance().menuLayout) this.build();
    this.autoBtn.classList.toggle('active', this.g.autoPlay);
    const autoLabel = this.autoBtn.querySelector('.sys-label');
    if (autoLabel) autoLabel.textContent = this.g.autoPlay ? 'AUTO: ON' : 'AUTO: OFF';
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
    this.applyGfxTile();
    this.panel.querySelectorAll<HTMLElement>('.sys-view').forEach((el) => el.classList.toggle('hidden', el.dataset.view !== v));
    $('sys-hudstyle').textContent = $('btn-hud-style').textContent;
    // The /admin switch can change while playing: shown only while players may set their own keys.
    document.getElementById('sys-keybinds')?.classList.toggle('hidden', !currentBalance().fxLayer.keyRebind);
    $('sys-partyblock').textContent = `${this.g.party.block ? '☑' : '☐'} ไม่รับคำชวนปาร์ตี้`;
    const tb = document.getElementById('sys-tradeblock');
    if (tb) tb.textContent = `${this.g.trade.block ? '☑' : '☐'} ไม่รับคำขอเทรด`;
  }

  /** A click on a top-row icon: the ones that were always there toggle their window, the rest open like from the menu window. */
  private onTop(id: string): void {
    const g = this.g;
    switch (id) {
      case 'auto': return g.toggleAuto();
      case 'bag': return g.hud.toggleBag();
      case 'skills': return g.skillWin.toggle();
      case 'party': return g.party.toggle();
      case 'friends': return g.friends.toggle();
      case 'report': return g.report.toggle();
      case 'daily': return g.daily.toggle();
      case 'news': return g.news.toggle();
      case 'cashshop': return g.cashShop.toggle();
      case 'map': return g.hud.toggleMap();
      case 'menu': return this.toggle();
      default: return this.onAct(id);
    }
  }

  private onAct(act: string): void {
    switch (act) {
      case 'close':
      case 'resume':
        return this.toggle(false);
      case 'bag':
        this.toggle(false);
        return this.g.hud.toggleBag(true);
      case 'skills':
        this.toggle(false);
        return this.g.skillWin.toggle(true);
      case 'map':
        this.toggle(false);
        return this.g.hud.toggleMap(true);
      case 'party':
        this.toggle(false);
        return this.g.party.toggle(true);
      case 'friends':
        this.toggle(false);
        return this.g.friends.toggle(true);
      case 'cosmetics':
        this.toggle(false);
        return this.g.cosmetics.toggle(true);
      case 'cashshop':
        this.toggle(false);
        return this.g.cashShop.toggle(true);
      case 'trade':
        this.toggle(false);
        return this.g.trade.toggleFind(true);
      case 'tradeblock':
        this.g.trade.setBlock(!this.g.trade.block);
        return this.showView('settings');
      case 'mail':
        this.toggle(false);
        return this.g.mailUI.toggle(true);
      case 'daily':
        this.toggle(false);
        return this.g.daily.toggle(true);
      case 'news':
        this.toggle(false);
        return this.g.news.toggle(true);
      case 'report':
        this.toggle(false);
        return this.g.report.toggle(true);
      case 'partyblock':
        this.g.party.setBlock(!this.g.party.block);
        return this.showView('settings');
      case 'autoset':
        this.toggle(false);
        return $('btn-auto-set').click();
      case 'settings':
        return this.showView('settings');
      case 'keybinds':
        this.toggle(false);
        return toggleKeybindPanel(true);
      case 'back':
        return this.showView('main');
      case 'help':
        this.toggle(false);
        return this.g.hud.toggleHelp(true);
      case 'fullscreen':
        this.toggle(false);
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void document.documentElement.requestFullscreen().catch(() => {});
        return;
      case 'audio':
        this.toggle(false);
        return $('btn-audio')?.click();
      case 'graphics':
        this.toggle(false);
        return toggleGfxPanel(true);
      case 'hudstyle':
        $('btn-hud-style').click();
        return void ($('sys-hudstyle').textContent = $('btn-hud-style').textContent);
      case 'chars':
        this.toGoogle = false;
        return this.requestExit('characters');
      case 'google':
        if (!confirm(this.g.backend.guest
          ? 'ออกจากเกมแล้วไปหน้า Google เพื่อเก็บตัวละคร Guest นี้ไว้ในบัญชี Google?'
          : 'ออกจากเกมแล้วไปหน้า Google เพื่อผูกบัญชี? (ชื่อผู้ใช้และรหัสผ่านเดิมยังใช้ได้)')) return;
        this.toGoogle = true;
        return this.requestExit('characters');
      case 'logout':
        this.toGoogle = false;
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
    this.toGoogle = false;
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
      // Set only now: an exit cancelled in combat must not send a later plain exit to Google.
      if (this.toGoogle && to === 'characters') sessionStorage.setItem(GOOGLE_AFTER_EXIT_KEY, this.g.backend.guest ? 'upgrade' : 'link');
    } catch {
      // Storage blocked: the page just opens on the title screen.
    }
    location.reload();
  }
}
