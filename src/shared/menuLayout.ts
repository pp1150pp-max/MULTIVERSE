// Which buttons the in-game menu window and the top-right icon row show, and in what order (owner 2026-11-19,
// docs/systems/world-and-ui.md "จัดเมนูเกม"). Set on /admin → ปรับเกม → "จัดเมนูเกม", saved inside the balance tuning
// (`BalanceTuning.menuLayout`), only the lists that differ from the code. The buttons' pictures and what they do live in
// src/client/sysmenu.ts, keyed by the same ids as here.

export type MenuPlace = 'menu' | 'top';

export interface MenuEntryDef {
  id: string;
  /** Thai name shown on the button (and on /admin). */
  label: string;
  /** Only this place can hold it (a state button, or one that has no meaning elsewhere); omitted = either. */
  only?: MenuPlace;
  /** Why it can't move, shown on /admin. */
  why?: string;
  /** Always shown (the player must always be able to open the menu and the settings). */
  pinned?: boolean;
  /** Also always the last one of its list. */
  last?: boolean;
}

/** Every button, in the order /admin lists them. */
export const MENU_ENTRIES: readonly MenuEntryDef[] = [
  { id: 'bag', label: 'กระเป๋า' },
  { id: 'skills', label: 'สกิล' },
  { id: 'party', label: 'ปาร์ตี้' },
  { id: 'friends', label: 'เพื่อน' },
  { id: 'trade', label: 'เทรด' },
  { id: 'daily', label: 'ล็อกอินรายวัน' },
  { id: 'map', label: 'แผนที่' },
  { id: 'cosmetics', label: 'แต่งตัว' },
  { id: 'cashshop', label: 'แคชช็อป' },
  { id: 'autoset', label: 'ตั้งค่า Auto' },
  { id: 'audio', label: 'เสียง' },
  { id: 'graphics', label: 'กราฟิก' },
  { id: 'help', label: 'วิธีเล่น' },
  { id: 'news', label: 'มีอะไรใหม่' },
  { id: 'mail', label: 'จดหมาย' },
  { id: 'report', label: 'แจ้งปัญหา' },
  { id: 'fullscreen', label: 'เต็มจอ', only: 'menu', why: 'ใช้เฉพาะจอสัมผัส (ซ่อนเองเมื่อใช้เมาส์) จึงอยู่ได้แค่ในหน้าต่างเมนู' },
  { id: 'auto', label: 'AUTO เปิด/ปิด', only: 'top', why: 'ปุ่มสลับ Auto โชว์สถานะ ON/OFF จึงอยู่ได้แค่แถวมุมขวาบน', pinned: true },
  { id: 'menu', label: 'เมนู', only: 'top', why: 'ปุ่มเปิดหน้าต่างเมนู ต้องมีเสมอ (ท้ายแถวมุมขวาบน)', pinned: true, last: true },
  { id: 'settings', label: 'ตั้งค่า', only: 'menu', why: 'ต้องมีเสมอ และอยู่ท้ายสุดของหน้าต่างเมนู (ออกจากเกม/เปลี่ยนตัวละครอยู่ในนี้)', pinned: true, last: true },
];

const DEF = new Map(MENU_ENTRIES.map((e) => [e.id, e]));
export const menuEntry = (id: string): MenuEntryDef | undefined => DEF.get(id);
export const MENU_PLACE_NAME: Record<MenuPlace, string> = { menu: 'หน้าต่างเมนู', top: 'แถวไอคอนมุมขวาบน' };

export interface MenuLayoutConfig {
  /** Button ids in the menu window, first to last (a button not listed is not shown there). */
  menu: string[];
  /** Button ids in the top-right icon row, left to right. */
  top: string[];
}
export type MenuLayoutTuning = Partial<MenuLayoutConfig>;

/** The code's own layout (a fresh copy). */
export function codeMenuLayout(): MenuLayoutConfig {
  return {
    menu: ['bag', 'skills', 'party', 'friends', 'trade', 'daily', 'map', 'cosmetics', 'cashshop', 'autoset', 'audio', 'graphics', 'help', 'news', 'mail', 'fullscreen', 'settings'],
    top: ['auto', 'bag', 'skills', 'party', 'friends', 'report', 'daily', 'cashshop', 'map', 'menu'],
  };
}
const CODE = codeMenuLayout();

/**
 * Buttons added after /admin layouts were first saved: a saved layout that lists them in neither place gets them in the
 * menu window (just before ตั้งค่า), or the button would never show on a server whose owner had arranged the menu.
 * Move one to the top row to put it there; hide it with its own switch, not by leaving it out.
 */
const ADDED_LATER = ['news'];

export function mergeMenuLayout(t: MenuLayoutTuning | undefined): MenuLayoutConfig {
  const c = codeMenuLayout();
  if (t?.menu) c.menu = [...t.menu];
  if (t?.top) c.top = [...t.top];
  if (t?.menu || t?.top) {
    for (const id of ADDED_LATER) {
      if (c.menu.includes(id) || c.top.includes(id)) continue;
      const at = c.menu.indexOf('settings');
      c.menu.splice(at < 0 ? c.menu.length : at, 0, id);
    }
  }
  return c;
}

/** Why this list is not allowed, or null when fine. */
function listProblem(place: MenuPlace, ids: string[]): string | null {
  const seen = new Set<string>();
  for (const id of ids) {
    const e = menuEntry(id);
    if (!e) return `ไม่รู้จักปุ่ม "${id.slice(0, 20)}"`;
    if (e.only && e.only !== place) return `ปุ่ม "${e.label}" อยู่ได้แค่ที่${MENU_PLACE_NAME[e.only]}`;
    if (seen.has(id)) return `ปุ่ม "${e.label}" ซ้ำในรายการเดียวกัน`;
    seen.add(id);
  }
  for (const e of MENU_ENTRIES) {
    if (!e.pinned || e.only !== place) continue;
    if (!ids.includes(e.id)) return `ปุ่ม "${e.label}" ต้องมีเสมอ`;
    if (e.last && ids[ids.length - 1] !== e.id) return `ปุ่ม "${e.label}" ต้องอยู่ท้ายสุด`;
  }
  return null;
}

/**
 * Checks the `menuLayout` part of a balance tuning (see checkBalance): strict = errors for anything wrong, else a wrong
 * list is dropped. A list equal to the code's is left out. Returns the clean tuning (undefined = nothing differs).
 */
export function checkMenuLayoutTuning(x: unknown, strict: boolean): { tuning: MenuLayoutTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!x || typeof x !== 'object' || Array.isArray(x)) return strict ? { error: 'ค่าจัดเมนูเกมไม่ถูกต้อง' } : { tuning: undefined };
  const o = x as Record<string, unknown>;
  if (strict) {
    const extra = Object.keys(o).find((k) => k !== 'menu' && k !== 'top');
    if (extra) return { error: `จัดเมนูเกม: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: MenuLayoutTuning = {};
  for (const place of ['menu', 'top'] as const) {
    const v = o[place];
    if (v === undefined) continue;
    if (!Array.isArray(v) || v.length > 40 || v.some((i) => typeof i !== 'string')) {
      if (strict) return { error: `จัดเมนูเกม: รายการ${MENU_PLACE_NAME[place]}ไม่ถูกต้อง` };
      continue;
    }
    const why = listProblem(place, v as string[]);
    if (why) {
      if (strict) return { error: `จัดเมนูเกม (${MENU_PLACE_NAME[place]}): ${why}` };
      continue;
    }
    if (JSON.stringify(v) !== JSON.stringify(CODE[place])) out[place] = [...(v as string[])];
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

/** Audit lines of what differs between two layouts. */
export function menuLayoutChanges(a: MenuLayoutConfig, b: MenuLayoutConfig): string[] {
  const out: string[] = [];
  const name = (id: string) => menuEntry(id)?.label ?? id;
  for (const place of ['menu', 'top'] as const) {
    if (a[place].join() === b[place].join()) continue;
    const added = b[place].filter((i) => !a[place].includes(i)).map(name);
    const removed = a[place].filter((i) => !b[place].includes(i)).map(name);
    const parts = [added.length ? `เพิ่ม ${added.join('/')}` : '', removed.length ? `เอาออก ${removed.join('/')}` : ''].filter(Boolean);
    const order = b[place].filter((i) => a[place].includes(i)).join() !== a[place].filter((i) => b[place].includes(i)).join();
    if (order) parts.push('เปลี่ยนลำดับ');
    out.push(`จัดเมนูเกม ${MENU_PLACE_NAME[place]}: ${parts.join(', ')} → ${b[place].map(name).join(' · ')}`);
  }
  return out;
}
