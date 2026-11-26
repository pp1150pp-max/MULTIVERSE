// The in-game system menu (Esc or the ☰ button): settings, controls help, back to character select, log out.
// Leaving closes the connection (the server saves on close) and reloads the page into the right menu screen,
// which is simpler and safer than tearing the 3D scene down by hand.
import type { Game } from './Game';
import { googleEnabled, logout } from './net/api';
import { imgUrl } from './img';
import { gfxMenuOn } from './gfxPrefs';
import { renderGfxSettings } from './gfxPanel';
import { keybindWaiting, renderKeybindSettings, resetKeybindTab } from './keybindPanel';
import { renderAudioSettings } from './audio/panel';
import { LANG, LANG_NAME, LANG_ROW_LABEL, LANG_ROW_NOTE, langRowShown, langWanted, legacyLangButton, setLangPref } from './i18n';
import { toggleGfxPanel } from './legacy/gfxWindow';
import { toggleKeybindPanel } from './legacy/keybindWindow';
import { setRow, setSelect, setSwitch } from './settingsUi';
import { currentBalance } from '../shared/balance';
import { newsButtonOn } from './news';
import { albumOn } from '../shared/cardAlbum';
import { hasChannels } from '../shared/channels';
import { buttonAct, buttonIcon, buttonLabel, codeMenuLayout, freeBtnDomId, menuEntry, type MenuIcon, type MenuLayoutConfig } from '../shared/menuLayout';

/** Read once by the title menu after the reload. */
export const AFTER_EXIT_KEY = 'multiverse-after-exit';
export type AfterExit = 'characters' | 'title';
/** sessionStorage: 'link' / 'upgrade' = go on to Google once the game is left (menu.ts buildMenu). */
export const GOOGLE_AFTER_EXIT_KEY = 'multiverse-google-after-exit';

/** Leaving while in combat waits this long; moving or getting hit cancels it (owner). */
const EXIT_COUNTDOWN = 5;
/** "In combat" = hurt or attacked within this many seconds, or Auto Play running. */
const COMBAT_WINDOW = 5;

/** Text from /admin (button names, glyphs) goes into HTML: never as markup. */
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Painted badge from public/assets/sprites/ui/ico_<name>.png, with a glyph drawn on top for systems with no art yet. Each
 * button's picture is CODE_ICON in src/shared/menuLayout.ts (or an admin's choice on /admin → จัดเมนูเกม).
 */
const badge = (i: MenuIcon): string =>
  `<img src="${imgUrl(`assets/sprites/ui/ico_${i.img}.png`)}" alt="">${i.glyph ? `<span class="ico-glyph">${esc(i.glyph)}</span>` : ''}`;

/** No such buttons for a guest (no mail, reports, trade, friends, daily login); keyed by what the button does. */
const GUEST_NO = new Set(['mail', 'report', 'trade', 'friends', 'daily', 'album']);

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** The settings page's tabs (owner 2026-11-26): side tabs left, rows right, big exit buttons at the bottom. */
type SetTab = 'general' | 'graphics' | 'audio' | 'keys';
const SET_TABS: Array<[SetTab, string, string]> = [
  ['general', '⚙️', 'ทั่วไป'],
  ['graphics', '🖥️', 'กราฟิก'],
  ['audio', '🔊', 'เสียง'],
  ['keys', '🎮', 'ปุ่ม'],
];
/** The tabbed page is on (/admin fxLayer.settingsTabs; off = the old button list and separate windows). */
const tabsOn = (): boolean => currentBalance().fxLayer.settingsTabs;
/** Each tab's heading on the right. */
const SET_TITLE: Record<SetTab, string> = { general: 'ตั้งค่าทั่วไป', graphics: 'กราฟิก', audio: 'เสียง', keys: 'ตั้งค่าปุ่ม' };

/**
 * The top row, the floating shortcut buttons and the menu window's tiles for a layout (src/shared/menuLayout.ts).
 * Also drawn by the /admin HUD mock (src/client/hudMock.ts), so the mock shows the real buttons.
 */
export function menuButtonsHtml(lay: MenuLayoutConfig, guest: boolean): { top: string; free: string; tiles: string } {
  // No เต็มจอ where the browser can't do it (iPhone Safari); none of mail / report / trade / friends / daily for a guest.
  // Checked on what the button does, so an admin's shortcut to the same thing follows the same rules.
  const okAct = (a: string) => !(guest && GUEST_NO.has(a)) && !(a === 'fullscreen' && !document.fullscreenEnabled) && !(a === 'news' && !newsButtonOn()) && !(a === 'album' && !albumOn())
    && !(a === 'keybinds' && !currentBalance().fxLayer.keyRebind);
  const ok = (id: string) => okAct(buttonAct(lay, id));
  // The badge key stays the code button's own Thai name (what setBadge uses), whatever the button is called now.
  const badgeKey = (id: string) => esc(menuEntry(buttonAct(lay, id))?.label ?? '');
  const ico = (id: string) => badge(buttonIcon(lay, id));
  // data-act = what it does (a shortcut runs its action like the menu's own button; the graphics switch hides both).
  const tile = (id: string, extra = '') =>
    `<button class="sys-tile${extra}" data-act="${esc(buttonAct(lay, id))}"><span class="sys-ico">${ico(id)}</span><span class="sys-label">${esc(buttonLabel(lay, id))}</span><i class="badge hidden" data-badge="${badgeKey(id)}"></i></button>`;
  const icon = (id: string, domId: string, extra = '') =>
    `<button id="${domId}" class="top-icon${extra}" data-entry="${esc(id)}" data-act="${esc(buttonAct(lay, id))}"><span class="sys-ico">${ico(id)}</span><span class="sys-label">${id === 'auto' ? 'AUTO: OFF' : esc(buttonLabel(lay, id, true))}</span><i class="badge hidden" data-badge="${badgeKey(id)}"></i></button>`;
  const top = lay.top.filter(ok).map((id) => icon(id, `top-${id}`)).join('');
  const free = lay.custom.filter((b) => b.free && okAct(b.act)).map((b) => icon(b.id, freeBtnDomId(b.id), ' hud-free-btn')).join('');
  // Touch play hides the top row (CSS), so what was put there also goes in the menu window, just before ตั้งค่า (which stays last).
  // (Not what the code only ever had up there, i.e. แจ้งปัญหา: touch never had it in the menu window.)
  const code = codeMenuLayout();
  const touchExtra = lay.top.filter((id) => id !== 'auto' && id !== 'menu' && !lay.menu.includes(id) && !(code.top.includes(id) && !code.menu.includes(id)));
  const menu = lay.menu.filter((id) => id !== 'settings');
  const tiles = [...menu.filter(ok).map((id) => tile(id)), ...touchExtra.filter(ok).map((id) => tile(id, ' touch-extra')), tile('settings')];
  return { top, free, tiles: tiles.join('') };
}

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
  private readonly free: HTMLElement;
  /** The layout drawn now (the balance's object, so a new one from the server is noticed by identity). */
  private drawn: MenuLayoutConfig | null = null;
  /** The settings tab showing. */
  private tab: SetTab = 'general';
  /** The Google button is offered (server has Google sign-in on). */
  private googleOn = false;

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
    // The admins' floating shortcut buttons (each moved into place by "จัดหน้าจอเกม", hidden until placed).
    this.free = document.createElement('div');
    this.free.id = 'hud-free';
    $('hud').append(this.free);
    this.free.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('.top-icon')?.dataset.entry;
      if (id) this.onTop(id);
    });

    this.panel = document.createElement('div');
    this.panel.id = 'sys-menu';
    this.panel.className = 'panel hidden';
    this.panel.innerHTML = `
      <div class="panel-head"><span id="sys-title">เมนู</span><button data-act="close">✕</button></div>
      <div class="sys-view sys-grid" data-view="main"></div>
      <div class="sys-view hidden" data-view="settings">
        <div class="set-body">
          <nav class="set-tabs">
            ${SET_TABS.map(([id, ico, name]) => `<button class="set-tab" data-tab="${id}"><span class="set-tab-ico">${ico}</span><span class="set-tab-name">${name}</span></button>`).join('')}
            <button class="set-back" data-act="back">‹ กลับ</button>
          </nav>
          <section class="set-pane">
            <div class="set-title"></div>
            <div class="set-rows"></div>
          </section>
        </div>
        <div class="set-foot">
          <button data-act="resume" class="primary set-big">กลับเข้าเกม</button>
          <button data-act="chars" class="set-big">${guest ? 'กลับไปหน้า Guest' : 'เลือกตัวละคร'}</button>
          <button data-act="logout" class="set-big danger">${guest ? 'กลับหน้าแรก' : 'ออกจากระบบ'}</button>
        </div>
        ${guest ? '<div class="sys-note">สมัครสมาชิกที่หน้าแรก เพื่อเก็บตัวละคร Guest นี้ไว้ถาวร</div>' : ''}
      </div>
      <div class="sys-view hidden" data-view="settings-old">
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
    // The old list (/admin settingsTabs off): the language button goes before ตั้งค่าปุ่ม, as it always did.
    const oldView = this.panel.querySelector('[data-view="settings-old"]')!;
    oldView.insertBefore(legacyLangButton(), oldView.querySelector('#sys-keybinds'));
    void googleEnabled().then((on) => {
      this.googleOn = on;
      this.panel.querySelector('#sys-google')?.classList.toggle('hidden', !on);
      if (this.tab === 'general') this.drawTab();
    });
    this.panel.addEventListener('click', (e) => {
      const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')?.dataset.tab;
      if (tab) return this.selectTab(tab as SetTab);
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
    const lay = this.drawn;
    const inMenu = new Set((lay?.menu ?? []).map((id) => menuEntry(buttonAct(lay!, id))?.label));
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
    const html = menuButtonsHtml(lay, this.g.backend.guest);
    this.row.innerHTML = html.top;
    this.free.innerHTML = html.free;
    this.panel.querySelector('[data-view="main"]')!.innerHTML = html.tiles;
    this.autoBtn = document.getElementById('top-auto') ?? document.createElement('button');
    this.applyGfxTile();
    this.renderBadges();
  }

  /** The graphics window's button only while /admin shows it (fxLayer.gfxMenu). */
  private applyGfxTile(): void {
    for (const el of document.querySelectorAll<HTMLElement>('#sys-menu [data-act="graphics"], #hud-iconrow [data-act="graphics"], #hud-free [data-act="graphics"]')) el.classList.toggle('hidden', !gfxMenuOn());
  }

  get open(): boolean {
    return !this.panel.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    if (show) {
      this.g.hud.closePanels();
      resetKeybindTab();
      this.showView('main');
    }
    this.panel.classList.toggle('hidden', !show);
  }

  /** Esc: cancel a pending exit, else close what's open, else open this menu. */
  onEscape(): void {
    if (keybindWaiting()) return; // the ปุ่ม tab takes this Esc (cancels picking a key)
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
    // ตั้งค่า shows the tabbed page, or the old button list while /admin turns the tabs off.
    if (v === 'settings' && !tabsOn()) v = 'settings-old';
    this.panel.querySelectorAll<HTMLElement>('.sys-view').forEach((el) => el.classList.toggle('hidden', el.dataset.view !== v));
    this.panel.classList.toggle('sys-settings', v === 'settings');
    $('sys-title').textContent = v === 'settings' ? 'ตั้งค่า' : 'เมนู';
    if (v === 'settings') this.selectTab(this.tab);
    if (v === 'settings-old') this.drawOldList();
  }

  /** The old list's texts (HP/MP, the ☐/☑ blocks, ตั้งค่าปุ่ม only while players may set keys). */
  private drawOldList(): void {
    $('sys-hudstyle').textContent = $('btn-hud-style').textContent;
    document.getElementById('sys-keybinds')?.classList.toggle('hidden', !currentBalance().fxLayer.keyRebind);
    $('sys-partyblock').textContent = `${this.g.party.block ? '☑' : '☐'} ไม่รับคำชวนปาร์ตี้`;
    const tb = document.getElementById('sys-tradeblock');
    if (tb) tb.textContent = `${this.g.trade.block ? '☑' : '☐'} ไม่รับคำขอเทรด`;
  }

  /** Whether a tab may show: กราฟิก and ปุ่ม follow their /admin switches (fxLayer.gfxMenu / keyRebind). */
  private tabOn(t: SetTab): boolean {
    if (t === 'graphics') return gfxMenuOn();
    if (t === 'keys') return currentBalance().fxLayer.keyRebind;
    return true;
  }

  /** Shows a settings tab (ทั่วไป when that one is switched off on /admin). */
  private selectTab(t: SetTab): void {
    if (t !== this.tab) resetKeybindTab();
    this.tab = this.tabOn(t) ? t : 'general';
    for (const b of this.panel.querySelectorAll<HTMLElement>('.set-tab')) {
      const id = b.dataset.tab as SetTab;
      b.classList.toggle('hidden', !this.tabOn(id));
      b.classList.toggle('on', id === this.tab);
    }
    this.drawTab();
  }

  /** Draws the rows of the tab showing (again after every change, so each control shows what is in use). */
  private drawTab(): void {
    const pane = this.panel.querySelector<HTMLElement>('.set-pane');
    if (!pane) return;
    pane.querySelector('.set-title')!.textContent = SET_TITLE[this.tab];
    const rows = pane.querySelector<HTMLElement>('.set-rows')!;
    rows.replaceChildren();
    rows.dataset.tab = this.tab;
    const redraw = () => this.drawTab();
    if (this.tab === 'graphics') return renderGfxSettings(rows, redraw);
    if (this.tab === 'audio') return renderAudioSettings(rows, redraw);
    if (this.tab === 'keys') return renderKeybindSettings(rows, redraw);
    const g = this.g;
    if (langRowShown()) {
      // Written in both languages and never translated, so either reader finds it.
      const want = langWanted();
      const row = setRow(LANG_ROW_LABEL, setSelect([['th', LANG_NAME.th], ['en', LANG_NAME.en]], want, (l) => { setLangPref(l); redraw(); }),
        want === LANG ? undefined : LANG_ROW_NOTE);
      row.setAttribute('translate', 'no');
      rows.append(row);
    }
    rows.append(
      setRow('HP / MP', setSelect([['orbs', 'ลูกแก้ว'], ['bars', 'แถบ']], g.hud.hpStyle, (v) => { g.hud.setHudStyle(v); redraw(); })),
      setRow('รับคำชวนปาร์ตี้', setSwitch(!g.party.block, (on) => { g.party.setBlock(!on); redraw(); })),
    );
    if (!g.backend.guest) rows.append(setRow('รับคำขอเทรด', setSwitch(!g.trade.block, (on) => { g.trade.setBlock(!on); redraw(); })));
    if (this.googleOn) {
      const b = document.createElement('button');
      b.className = 'set-btn';
      b.dataset.act = 'google';
      b.textContent = g.backend.guest ? 'บันทึกตัวละครด้วย Google' : 'ผูกบัญชี Google';
      rows.append(setRow('บัญชี Google', b));
    }
  }

  /** Opens the menu straight on a settings tab (the menu tiles, top-row icons and admins' shortcuts). */
  private openTab(t: SetTab): void {
    if (!tabsOn()) {
      // The old way: ตั้งค่า = the button list, the others = their own windows.
      if (t === 'general') {
        if (!this.open) this.toggle(true);
        return this.showView('settings');
      }
      this.toggle(false);
      if (t === 'graphics') return toggleGfxPanel(true);
      if (t === 'keys') return toggleKeybindPanel(true);
      return $('btn-audio')?.click();
    }
    if (!this.open) this.toggle(true);
    this.tab = t;
    this.showView('settings');
  }

  /** A click on a top-row icon: the ones that were always there toggle their window, the rest open like from the menu window. */
  private onTop(id: string): void {
    const g = this.g;
    // An admin's shortcut (top row or floating) runs its action like that button would; ตั้งค่า opens the menu on its settings page.
    const act = this.drawn ? buttonAct(this.drawn, id) : id;
    if (act !== id) {
      if (act !== 'settings') return this.onTop(act);
      return this.openTab('general');
    }
    switch (id) {
      case 'auto': return g.toggleAuto();
      case 'bag': return g.hud.toggleBag();
      case 'skills': return g.skillWin.toggle();
      case 'party': return g.party.toggle();
      case 'friends': return g.friends.toggle();
      case 'report': return g.report.toggle();
      case 'daily': return g.daily.toggle();
      case 'news': return g.news.toggle();
      case 'album': return g.album.toggle();
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
      case 'album':
        this.toggle(false);
        return this.g.album.toggle(true);
      case 'autoset':
        this.toggle(false);
        return $('btn-auto-set').click();
      case 'settings':
        return this.openTab('general');
      case 'keybinds':
        return this.openTab('keys');
      case 'channels':
        // Only on maps with channels (the window stays shut elsewhere).
        this.toggle(false);
        if (!hasChannels(this.g.backend.zone)) return this.g.hud.log('แมพนี้ไม่มีแชนแนลให้เลือก', '#ffcf6a');
        return this.g.channels.toggle(true);
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
        return this.openTab('audio');
      case 'graphics':
        return this.openTab('graphics');
      case 'hudstyle':
        // The old list's button, or an admin's shortcut: flips HP/MP at once.
        this.g.hud.setHudStyle(this.g.hud.hpStyle === 'orbs' ? 'bars' : 'orbs');
        if (this.open && tabsOn() && this.tab === 'general') this.drawTab();
        return this.drawOldList();
      case 'partyblock':
        this.g.party.setBlock(!this.g.party.block);
        return this.drawOldList();
      case 'tradeblock':
        this.g.trade.setBlock(!this.g.trade.block);
        return this.drawOldList();
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
