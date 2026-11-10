// Loading screen: a full-screen illustration with the progress bar and a random tip in its empty
// bottom band. Shown while the game files download on entering the world, and briefly on every
// zone change (owner 2026-11-10). Art: art_templates/loading/PROMPTS.md.
import type { ClassId } from '../shared/types';

const DIR = '/assets/sprites/ui/loading/';
const CLASS_ART: Record<ClassId, string> = { sword: 'sword', mage: 'mage', gunslinger: 'gunslinger' };
const ALL_ART = ['portal_1', 'portal_2', 'sword', 'mage', 'gunslinger'];

/** How long the zone-change screen stays up, then how long it fades out (ms). */
const ZONE_HOLD = 3000;
const ZONE_FADE = 300;

const TIPS = [
  'กด T ใกล้น้ำพุหรือกองไฟ เพื่อฟื้น HP และ MP',
  'กด F เปิด Auto Play แล้วตัวละครจะฟาร์มต่อแม้สลับแท็บไปทำอย่างอื่น',
  'กด 1 หรือ 2 เพื่อดื่มยา HP หรือ MP คลิกยาในกระเป๋าเพื่อเลือกขนาดที่จะใช้',
  'กด Space เพื่อพุ่งหลบการโจมตี',
  'กด M ดูแผนที่ กด I หรือ B เปิดกระเป๋า กด H ดูวิธีเล่น',
  'คลังเก็บของในเมืองใช้ร่วมกันได้ทุกตัวละครในบัญชีเดียวกัน',
  'นำของไปฝากขายในตลาด ให้ผู้เล่นคนอื่นซื้อได้',
  'EXP แบ่งตามดาเมจที่ทำ คนที่ทำดาเมจมากที่สุดได้สิทธิ์เก็บของก่อน 10 วินาที',
  'พ่อค้ามีปุ่มขายของทั้งหมดตามระดับความหายาก โดยไม่ขายของที่ตีบวกแล้ว',
  'ยิ่งคนช่วยกันตีมาก บอสก็ยิ่งเลือดเยอะ',
  'กด Enter เพื่อพิมพ์แชท',
  'ประตูเมืองพาไปป่ามรกต หนองน้ำหมอก ดินแดนหิมะ และเกาะภูเขาไฟ',
];

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** Half the time the player's own class, otherwise one of the other four pictures. */
function pickArt(classId: ClassId | null): string {
  const own = classId ? CLASS_ART[classId] : null;
  if (own && Math.random() < 0.5) return own;
  return pick(ALL_ART.filter((a) => a !== own));
}

let preloaded = false;
/** Fetches all five pictures (~1.2 MB) so the zone-change screen never shows up blank. */
export function preloadLoadingArt(): void {
  if (preloaded) return;
  preloaded = true;
  for (const a of ALL_ART) new Image().src = `${DIR}${a}.webp`;
}

const el = (): HTMLElement => document.getElementById('loading')!;
let fadeTimer = 0;
let hideTimer = 0;

export interface LoadingScreen {
  /** 0..1 */
  progress(f: number): void;
  hide(): void;
}

/** Puts the loading screen up with a fresh picture and tip. */
export function showLoading(classId: ClassId | null, label = 'กำลังโหลดภาพในเกม…'): LoadingScreen {
  clearTimeout(fadeTimer);
  clearTimeout(hideTimer);
  const root = el();
  root.innerHTML =
    `<div class="load-box"><div>${label} <span class="load-pct">0%</span></div>` +
    '<div class="load-bar"><i></i></div><p class="load-tip"></p></div>';
  root.querySelector('.load-tip')!.textContent = `เคล็ดลับ: ${pick(TIPS)}`;
  root.style.backgroundImage = `url(${DIR}${pickArt(classId)}.webp)`;
  root.classList.add('load-art');
  root.classList.remove('hidden', 'load-out');
  const pct = root.querySelector<HTMLElement>('.load-pct')!;
  const fill = root.querySelector<HTMLElement>('.load-bar i')!;
  return {
    progress(f) {
      const p = `${Math.floor(Math.max(0, Math.min(1, f)) * 100)}%`;
      if (pct) pct.textContent = p;
      fill.style.width = p;
    },
    hide() {
      root.classList.add('hidden');
    },
  };
}

/**
 * Zone change: the new map is already built underneath, so the screen only covers the swap:
 * the bar runs to full, then the screen fades away.
 */
export function flashZoneLoading(classId: ClassId): void {
  const screen = showLoading(classId, 'กำลังเดินทาง…');
  el().querySelector('.load-pct')?.remove();
  // Let the empty bar paint first so its CSS transition runs across the hold.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const fill = el().querySelector<HTMLElement>('.load-bar i');
    if (!fill) return;
    fill.style.transition = `width ${ZONE_HOLD}ms linear`;
    fill.style.width = '100%';
  }));
  fadeTimer = window.setTimeout(() => {
    el().classList.add('load-out');
    hideTimer = window.setTimeout(() => screen.hide(), ZONE_FADE);
  }, ZONE_HOLD);
}

/** The first entry's screen: up from the download until the world's first frames are drawn. */
let entry: LoadingScreen | null = null;

/** Puts up the first-entry screen; it stays until endEntryLoading (or cancelEntryLoading on a failure). */
export function beginEntryLoading(classId: ClassId | null): LoadingScreen {
  entry = showLoading(classId);
  return entry;
}

/** The world is drawn: fade the first-entry screen away. */
export function endEntryLoading(): void {
  const screen = entry;
  if (!screen) return;
  entry = null;
  screen.progress(1);
  el().classList.add('load-out');
  hideTimer = window.setTimeout(() => screen.hide(), ZONE_FADE);
}

/** Entering failed (back on the menu): drop the screen at once. */
export function cancelEntryLoading(): void {
  entry?.hide();
  entry = null;
}
