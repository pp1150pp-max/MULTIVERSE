/// <reference types="vite/client" />
import { PAPER_ICONS } from './paperIcons';
import { currentBalance } from '../shared/balance';
/**
 * The real URL of a sprite PNG under public/assets/sprites/. The build ships those PNGs as WebP
 * (see the webp plugin in vite.config.ts), so outside dev `.png` becomes `.webp`. Dev serves the PNGs as they are.
 * Every sprite path written in TS goes through this; index.html and CSS are rewritten by the plugin.
 * On the game page (papercraft is the only art style), UI pictures that have a paper version come from sprites/paper/ui/.
 */
export const imgUrl = (path: string): string => {
  const p = paperUi ? toPaperUi(path) : path;
  return import.meta.env.DEV ? p : p.replace(/\.png$/, '.webp');
};

/** UI files under sprites/ui/ with a paper version under sprites/paper/ui/ (tools/cut_paper_ui.cjs). */
const PAPER_UI = new Set([
  'skillbar', 'expbar', 'bar_frame', 'orb_cradle', 'corner', 'close',
  'bar_hp', 'bar_mp', 'orb_hp_liquid', 'orb_hp_wave', 'orb_mp_liquid', 'orb_mp_wave',
  'ico_auto', 'ico_autoset', 'ico_bag', 'ico_blank', 'ico_cashshop', 'ico_daily', 'ico_friends', 'ico_help', 'ico_map', 'ico_menu', 'ico_settings',
  'crystal', 'cash_pack_1', 'cash_pack_2', 'cash_pack_3', 'cash_pack_4',
  'cash_frame', 'cash_dialog', 'cash_card', 'cash_card_hi', 'cash_well', 'cash_check', 'cash_plus', 'cash_btn', 'cash_btn_main',
  'cash_balance', 'cash_price', 'cash_tab', 'cash_tab_on', 'cash_side', 'cash_side_on', 'cash_divider',
  'cash_ribbon_hot', 'cash_ribbon_new', 'cash_ribbon_sale', 'cash_banner', 'inventory', 'login_bg',
  'portrait_sword', 'portrait_mage', 'portrait_gunslinger',
  'touch/btn_attack', 'touch/stick_base', 'touch/btn_skill', 'touch/stick_knob',
  'touch/icon_chat', 'touch/icon_dash', 'touch/icon_mount', 'touch/icon_talk',
  'loading/sword', 'loading/mage', 'loading/gunslinger', 'loading/portal_1', 'loading/portal_2',
]);
const UI_PATH = /sprites\/(ui|icons)\/([a-z0-9_/]+)\.(png|webp)/g;

let paperUi = false;
/** Whether the paper UI is on (usePaperUi). */
export const paperUiOn = (): boolean => paperUi;

/** `sprites/ui|icons/x.png` → `sprites/paper/ui|icons/x.png` for every file in the text that has a paper version. */
function toPaperUi(text: string): string {
  return text.replace(UI_PATH, (all, dir: string, name: string, ext: string) =>
    ((dir === 'ui' ? PAPER_UI : PAPER_ICONS).has(name) ? `sprites/paper/${dir}/${name}.${ext}` : all));
}

/**
 * Turns the paper UI on: later imgUrl calls, the stylesheets' rules and the images already on the page all switch.
 * Called once by the game page at boot (main.ts).
 */
export function usePaperUi(): void {
  if (paperUi) return;
  paperUi = true;
  // CSS that has to differ for the paper pictures (their slots sit elsewhere), e.g. the bag grid.
  document.documentElement.classList.add('paper-ui');
  const fix = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        const st = rule.style;
        for (let i = 0; i < st.length; i++) {
          const prop = st[i];
          const v = st.getPropertyValue(prop);
          if (v.includes('sprites/ui/') || v.includes('sprites/icons/')) {
            const nv = toPaperUi(v);
            if (nv !== v) st.setProperty(prop, nv, st.getPropertyPriority(prop));
          }
        }
      }
      if ('cssRules' in rule) fix((rule as CSSGroupingRule).cssRules);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      fix(sheet.cssRules);
    } catch {
      // A stylesheet from another origin (fonts): nothing of ours in it.
    }
  }
  // The paper logo is one picture of the whole word (owner 2026-11-18), not a picture per letter.
  const logo = document.querySelector<HTMLElement>('.logo');
  if (logo) {
    const img = document.createElement('img');
    img.src = (import.meta.env.DEV ? 'assets/sprites/paper/ui/logo.png' : 'assets/sprites/paper/ui/logo.webp');
    img.alt = '';
    logo.replaceChildren(img);
  }
  for (const el of Array.from(document.querySelectorAll<HTMLImageElement>('img[src*="sprites/ui/"], img[src*="sprites/icons/"]'))) {
    const v = el.getAttribute('src')!;
    const nv = toPaperUi(v);
    if (nv !== v) el.setAttribute('src', nv);
  }
}

/** Item slot look knobs from /admin (fxLayer.slot*) as CSS variables on <html>; used by the .cell rules in late.css. */
export function applySlotVars(): void {
  const fx = currentBalance().fxLayer;
  const st = document.documentElement.style;
  st.setProperty('--slot-corner', String(fx.slotCorner));
  st.setProperty('--slot-inset', String(fx.slotInset));
  st.setProperty('--slot-icon', String(fx.slotIcon));
}
