// The game page as a HUD example, for the /admin "จัดหน้าจอเกม" mock screen (src/admin/hudLayout.ts), opened as
// /?hudMock=1&device=desktop|touch in a same-origin iframe. No login, no connection, no 3D: the real HUD markup and
// stylesheet with sample data, the real top icon row / floating shortcuts (menuButtonsHtml) and the real touch controls
// (touchControlsHtml), so what the admin drags is what players see. The admin page drives it through `window.hudMock`:
// it pushes the draft layout (the same CSS the game uses, hidden parts drawn faint instead of gone) and reads where each
// part ends up. The page never calls the admin API itself, so a player opening it only sees a still picture.
import { currentBalance } from '../shared/balance';
import { CLASSES } from '../shared/data/classes';
import { codeMenuLayout, type MenuLayoutConfig } from '../shared/menuLayout';
import { hudLayoutCss, type HudLayoutConfig } from '../shared/hudLayout';
import { BUFF_LABEL } from '../shared/data/stones';
import { BUFF_SCROLLS } from '../shared/types';
import { potionIcon, skillIcon, stoneIcon } from './icons';
import { facePortrait } from './menu';
import { menuButtonsHtml } from './sysmenu';
import { lockPointerMode } from './touch/device';
import { touchControlsHtml } from './touch/controls';

/** Windows that are plain markup in index.html, shown on the "หน้าต่าง" layer (the others need a running game). */
const STATIC_WINDOWS = ['inventory', 'shop', 'stash', 'forge', 'help'];

export interface HudMockApi {
  /** Shows a layout (hidden parts faint, so they can still be seen and grabbed). */
  setLayout(cfg: HudLayoutConfig): void;
  /** The HUD alone, or with the windows that can be shown open. */
  setLayer(layer: 'hud' | 'window'): void;
  /** Draws the top row / floating shortcuts / touch menu of this menu layout. */
  setMenu(layout: MenuLayoutConfig): void;
  /** Where a part is now, in % of the screen (null = not on this page, or not drawn). */
  rect(id: string): { x: number; y: number; w: number; h: number } | null;
}

export function hudMockParam(): boolean {
  try {
    return new URLSearchParams(location.search).get('hudMock') === '1';
  } catch {
    return false;
  }
}

const $ = (id: string): HTMLElement => document.getElementById(id)!;
const setText = (id: string, t: string): void => void (document.getElementById(id) && ($(id).textContent = t));
const fill = (id: string, pct: number): void => void (document.getElementById(id) && ($(id).style.width = `${pct}%`));

export function runHudMock(): void {
  const touch = new URLSearchParams(location.search).get('device') === 'touch';
  lockPointerMode(touch ? 'touch' : 'mouse');
  document.getElementById('menu')?.classList.add('hidden');
  document.getElementById('loading')?.classList.add('hidden');
  document.body.classList.add('hud-mock');
  document.body.style.background = 'radial-gradient(ellipse at 50% 45%, #3c5a3a 0%, #22341f 60%, #141e12 100%)';
  const hud = $('hud');
  hud.classList.remove('hidden');
  // Touch play always shows bars; mouse screens default to the orbs (Hud.applyHudStyle).
  hud.classList.toggle('hud-orbs', !touch);
  hud.classList.toggle('hud-bars', touch);
  hud.classList.toggle('orbs-near', currentBalance().fxLayer.orbsNearBar);

  // Character card and bars.
  $('hud-portrait').append(facePortrait('sword', 44));
  setText('hud-name', 'ตัวอย่าง');
  setText('hud-level', 'Lv. 35 นักดาบ');
  setText('hud-gold', '12,345 G');
  fill('hp-fill', 72);
  setText('hp-text', '1,440 / 2,000');
  fill('mp-fill', 55);
  setText('mp-text', '110 / 200');
  setText('hud-zone', 'ป่ามรกต · CH 1');
  const online = $('hud-online');
  online.textContent = 'ออนไลน์ 12 คน';
  online.classList.remove('hidden');
  $('hud-buffs').innerHTML = BUFF_SCROLLS.map((k) => `<div class="buff">${stoneIcon(k)}<span>${BUFF_LABEL[k]} 0:24:10</span></div>`).join('');

  // A party member (PartyUI.renderHud) and a quest (QuestTracker.update), with the same classes.
  const party = document.createElement('div');
  party.id = 'party-hud';
  party.innerHTML = `<div class="party-member"><div class="party-name"><span class="party-ico leader">♛</span><b>เพื่อนร่วมทีม</b><span class="party-lv"> Lv.33 นักเวท</span></div>`
    + `<div class="party-bars"><div class="party-bar hp"><div class="party-fill" style="width:80%"></div><span>800 / 1000</span></div>`
    + `<div class="party-bar mp"><div class="party-fill" style="width:60%"></div><span>180 / 300</span></div></div>`
    + `<div class="party-place">ป่ามรกต · CH 1</div></div>`;
  $('hud-topleft').append(party);
  const quest = document.createElement('div');
  quest.id = 'quest-tracker';
  quest.innerHTML = `<button class="qt-head"><span class="qt-arrow">▾</span> 📜 เควส (1)</button>`
    + `<div class="qt-list"><div class="qt-row going"><div class="qt-name">หินกุญแจ · ป่ามรกต</div><div class="qt-goal">ล่ามอนสเตอร์ในป่ามรกต 12/30</div><div class="qt-bar"><div style="width:40%"></div></div></div></div>`;
  online.after(quest);

  // Boss bar, ping, chat log, skill bar, EXP, orbs.
  $('boss-bar').classList.remove('hidden');
  setText('boss-name', 'บอสตัวอย่าง');
  fill('boss-fill', 64);
  setText('hud-ping-ms', '42 ms');
  $('log').insertAdjacentHTML('beforeend', ['ยินดีต้อนรับสู่ Multiverse', 'ได้รับ 1,200 EXP', 'เพื่อนร่วมทีม: ไปบอสกัน'].map((t, i) => `<div class="log-line ${i < 2 ? 'system' : 'chat party'}">${t}</div>`).join(''));
  // The chat box only opens on Enter in the game; shown here so it can be placed.
  $('chat').classList.remove('hidden');
  const sk = CLASSES.sword.skills;
  const slotSkill: Record<string, string | undefined> = {
    basic: sk.find((s) => s.kind === 'basic')?.id,
    q: sk.find((s) => s.kind === 'normal')?.id,
    e: sk.filter((s) => s.kind === 'normal')[1]?.id,
    r: sk.find((s) => s.kind === 'ult')?.id,
    dash: 'dash',
  };
  const icon = (slot: string): string => (slotSkill[slot] ? skillIcon(slotSkill[slot]!) : '');
  $('skillbar').innerHTML = [
    ...(['basic', 'q', 'e', 'r', 'dash'] as const).map((s, i) => `<div class="skill skill-${s}"><div class="icon">${icon(s)}</div><div class="cd"></div><div class="key">${['LMB', 'Q', 'E', 'R', 'Space'][i]}</div><div class="extra"></div></div>`),
    `<div class="skill skill-hp"><div class="icon">${potionIcon('hp')}</div><div class="cd"></div><div class="key">1</div><div class="extra"></div></div>`,
    `<div class="skill skill-mp"><div class="icon">${potionIcon('mp')}</div><div class="cd"></div><div class="key">2</div><div class="extra"></div></div>`,
  ].join('');
  fill('exp-fill', 38);
  setText('exp-text', 'EXP 38.0%');
  const orb = (id: string, pct: number, text: string): void => {
    const f = document.getElementById(`${id}-fill`);
    if (f) f.style.height = `${pct}%`;
    setText(`${id}-text`, text);
  };
  orb('orb-hp', 72, '1,440');
  orb('orb-mp', 55, '110');
  const mm = document.getElementById('minimap') as HTMLCanvasElement | null;
  const ctx = mm?.getContext('2d');
  if (mm && ctx) {
    ctx.fillStyle = '#2f4a2c';
    ctx.fillRect(0, 0, mm.width, mm.height);
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(mm.width / 2, mm.height / 2, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // The real top icon row and floating shortcuts (SystemMenu does this in the game), and the touch controls.
  const row = document.createElement('div');
  row.id = 'hud-iconrow';
  $('hud-topright').prepend(row);
  const free = document.createElement('div');
  free.id = 'hud-free';
  hud.append(free);
  if (touch) {
    const tc = document.createElement('div');
    tc.id = 'touch-ui';
    tc.innerHTML = touchControlsHtml((slot) => icon(slot));
    hud.prepend(tc);
  }

  // Nothing in the mock is clicked or typed into: the admin page drags boxes laid over it.
  const block = document.createElement('style');
  block.textContent = 'body.hud-mock, body.hud-mock * { pointer-events: none !important; } body.hud-mock #rotate-hint { display: none !important; }';
  document.head.append(block);
  const style = document.createElement('style');
  style.id = 'hud-layout-style';
  document.head.append(style);

  const api: HudMockApi = {
    setLayout(cfg) {
      // Hidden parts stay on the page, faint, so the admin still sees and grabs them.
      style.textContent = hudLayoutCss(cfg).replace(/display: none !important/g, 'opacity: 0.3');
    },
    setLayer(layer) {
      for (const id of STATIC_WINDOWS) document.getElementById(id)?.classList.toggle('hidden', layer !== 'window');
    },
    setMenu(layout) {
      const h = menuButtonsHtml(layout, false);
      row.innerHTML = h.top;
      free.innerHTML = h.free;
    },
    rect(id) {
      const el = document.getElementById(id);
      if (!el) return null;
      let r: { left: number; top: number; width: number; height: number } = el.getBoundingClientRect();
      // A zero-size holder of absolutely placed buttons (the touch attack pad): the area its children cover.
      if (r.width < 1 || r.height < 1) {
        const kids = [...el.querySelectorAll<HTMLElement>('*')].map((k) => k.getBoundingClientRect()).filter((k) => k.width >= 1 && k.height >= 1);
        if (!kids.length) return null;
        const left = Math.min(...kids.map((k) => k.left));
        const top = Math.min(...kids.map((k) => k.top));
        r = { left, top, width: Math.max(...kids.map((k) => k.right)) - left, height: Math.max(...kids.map((k) => k.bottom)) - top };
      }
      const W = window.innerWidth;
      const H = window.innerHeight;
      return { x: (r.left / W) * 100, y: (r.top / H) * 100, w: (r.width / W) * 100, h: (r.height / H) * 100 };
    },
  };
  api.setMenu(codeMenuLayout());
  api.setLayer('hud');
  (window as unknown as { hudMock: HudMockApi }).hudMock = api;
}
