// Which buttons the in-game menu window and the top-right icon row show, and in what order (owner 2026-11-19,
// docs/systems/world-and-ui.md "จัดเมนูเกม"). Set on /admin → ปรับเกม → "จัดเมนูเกม", saved inside the balance tuning
// (`BalanceTuning.menuLayout`), only what differs from the code. What each button does lives in src/client/sysmenu.ts,
// keyed by the same ids as here; its picture is CODE_ICON below.
//
// Since 2026-11-22 (PR 2 of "จัดหน้าจอเกม") admins may also rename a code button / change its icon (`names`) and add their
// own shortcut buttons (`custom`, ids c1…) that run one of SHORTCUT_ACTS — never anything else. A shortcut sits in the menu
// window and/or the top row like any button, and may also float on the screen (`free`: where it floats, and on which
// device, is set in "จัดหน้าจอเกม" as the hudLayout part `hud-btn-<id>`; it shows only once that place is published).

export type MenuPlace = 'menu' | 'top';

export interface MenuEntryDef {
  id: string;
  /** Thai name shown on the button (and on /admin). Also the key of its notification badge, so it never changes. */
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
  { id: 'album', label: 'อัลบั้มการ์ด' },
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

/** The painted badges in public/assets/sprites/ui/ico_<name>.png an admin may pick ('blank' = the empty one, for a glyph). */
export const ICON_IMAGES = [
  'blank', 'bag', 'skills', 'party', 'friends', 'trade', 'daily', 'map', 'cosmetics', 'cashshop', 'autoset', 'audio', 'graphics', 'help', 'news',
  'album', 'mail', 'report', 'fullscreen', 'settings', 'auto', 'menu',
] as const;
export type IconImage = (typeof ICON_IMAGES)[number];
export const ICON_IMAGE_NAME: Record<IconImage, string> = {
  blank: 'พื้นเปล่า (ใส่อีโมจิ)', bag: 'กระเป๋า', map: 'แผนที่', friends: 'เพื่อน', daily: 'ปฏิทิน', cashshop: 'แคชช็อป', autoset: 'ตั้งค่า Auto',
  help: 'วิธีเล่น', settings: 'ฟันเฟือง', auto: 'AUTO', menu: 'เมนู',
  skills: 'สกิล', party: 'ปาร์ตี้', trade: 'เทรด', cosmetics: 'แต่งตัว', audio: 'เสียง', graphics: 'กราฟิก', news: 'ข่าว', album: 'อัลบั้มการ์ด',
  mail: 'จดหมาย', report: 'แจ้งปัญหา', fullscreen: 'เต็มจอ',
};
/** A button's picture: a painted badge, with an optional emoji / short glyph drawn on top. */
export interface MenuIcon {
  img: IconImage;
  glyph?: string;
}
/** Each code button's own picture: its painted badge. */
export const CODE_ICON: Readonly<Record<string, MenuIcon>> = {
  bag: { img: 'bag' }, skills: { img: 'skills' }, party: { img: 'party' }, friends: { img: 'friends' },
  trade: { img: 'trade' }, daily: { img: 'daily' }, map: { img: 'map' }, cosmetics: { img: 'cosmetics' },
  cashshop: { img: 'cashshop' }, autoset: { img: 'autoset' }, audio: { img: 'audio' }, graphics: { img: 'graphics' },
  help: { img: 'help' }, news: { img: 'news' }, album: { img: 'album' }, mail: { img: 'mail' }, report: { img: 'report' },
  fullscreen: { img: 'fullscreen' }, settings: { img: 'settings' }, auto: { img: 'auto' }, menu: { img: 'menu' },
};
/** The top row's own short name where it differs from the menu's (an admin's rename wins over it). */
export const TOP_LABEL: Readonly<Record<string, string>> = { daily: 'รายวัน', album: 'อัลบั้ม' };
/** Code buttons whose name can't be changed (the game writes AUTO: ON / OFF on it every frame). */
export const NO_RENAME = new Set(['auto']);

/**
 * What an admin's shortcut button may do: open one of these windows / run one of these player functions, exactly like the
 * menu's own button (src/client/sysmenu.ts runAct). Left out on purpose: the Seeker quest window and the boss altar (they
 * close when the player is away from their NPC), AUTO on/off and leaving the game.
 */
export const SHORTCUT_ACTS = [
  'bag', 'skills', 'party', 'friends', 'trade', 'daily', 'map', 'cosmetics', 'cashshop', 'autoset', 'audio', 'graphics', 'help', 'news', 'album',
  'mail', 'report', 'fullscreen', 'settings', 'keybinds', 'channels', 'hudstyle',
] as const;
export type ShortcutAct = (typeof SHORTCUT_ACTS)[number];
const ACT_EXTRA_NAME: Record<string, string> = { keybinds: 'ตั้งค่าปุ่มลัดคีย์บอร์ด', channels: 'เลือกแชนแนล (เฉพาะแมพฟาร์ม)', hudstyle: 'สลับ HP/MP ลูกแก้ว/แถบ' };
/** Thai name of a shortcut action, for /admin. */
export const actName = (a: string): string => ACT_EXTRA_NAME[a] ?? menuEntry(a)?.label ?? a;
const isAct = (a: unknown): a is ShortcutAct => typeof a === 'string' && (SHORTCUT_ACTS as readonly string[]).includes(a);

/** A code button's new name / icon (missing = the code's). */
export interface MenuName {
  label?: string;
  icon?: MenuIcon;
}
/** An admin's own shortcut button. */
export interface CustomButton {
  /** c1, c2, … */
  id: string;
  label: string;
  icon: MenuIcon;
  act: ShortcutAct;
  /** Also floats on the screen (shown once its place is published in "จัดหน้าจอเกม"). */
  free?: true;
}
export const CUSTOM_MAX = 20;
export const LABEL_MAX = 20;
export const isCustomId = (id: string): boolean => /^c\d{1,3}$/.test(id);
/** The DOM id / hudLayout part id of a floating shortcut. */
export const freeBtnDomId = (id: string): string => `hud-btn-${id}`;

export interface MenuLayoutConfig {
  /** Button ids in the menu window, first to last (a button not listed is not shown there). */
  menu: string[];
  /** Button ids in the top-right icon row, left to right. */
  top: string[];
  /** Code buttons an admin renamed / gave another icon, by id. */
  names: Record<string, MenuName>;
  /** An admin's own shortcut buttons (placed through `menu` / `top` like the others, and/or floating). */
  custom: CustomButton[];
}
export type MenuLayoutTuning = Partial<MenuLayoutConfig>;

/** The code's own layout (a fresh copy). */
export function codeMenuLayout(): MenuLayoutConfig {
  return {
    menu: ['bag', 'skills', 'party', 'friends', 'trade', 'daily', 'map', 'cosmetics', 'cashshop', 'autoset', 'audio', 'graphics', 'help', 'news', 'mail', 'fullscreen', 'settings'],
    top: ['auto', 'bag', 'skills', 'party', 'friends', 'report', 'daily', 'cashshop', 'map', 'album', 'menu'],
    names: {},
    custom: [],
  };
}
const CODE = codeMenuLayout();

/** A button's shown name (an admin's rename, else the code's; `top` = as shown in the top row). */
export function buttonLabel(cfg: MenuLayoutConfig, id: string, top = false): string {
  const c = cfg.custom.find((b) => b.id === id);
  if (c) return c.label;
  return cfg.names[id]?.label ?? (top ? TOP_LABEL[id] : undefined) ?? menuEntry(id)?.label ?? id;
}
/** A button's picture (an admin's, else the code's). */
export function buttonIcon(cfg: MenuLayoutConfig, id: string): MenuIcon {
  const c = cfg.custom.find((b) => b.id === id);
  if (c) return c.icon;
  return cfg.names[id]?.icon ?? CODE_ICON[id] ?? { img: 'blank' };
}
/** What a button does: its own id for a code button, the chosen action for a shortcut. */
export function buttonAct(cfg: MenuLayoutConfig, id: string): string {
  return cfg.custom.find((b) => b.id === id)?.act ?? id;
}

/**
 * Buttons added after /admin layouts were first saved: a saved layout that lists them in neither place gets them in the
 * menu window (just before ตั้งค่า), or the button would never show on a server whose owner had arranged the menu.
 * Move one to the top row to put it there; hide it with its own switch, not by leaving it out.
 */
const ADDED_LATER = ['news'];
/** Like ADDED_LATER, but put in the top row (just before เมนู): the card album (owner 2026-11-25: "in the top row"). */
const ADDED_LATER_TOP = ['album'];

export function mergeMenuLayout(t: MenuLayoutTuning | undefined): MenuLayoutConfig {
  const c = codeMenuLayout();
  if (t?.menu) c.menu = [...t.menu];
  if (t?.top) c.top = [...t.top];
  if (t?.names) c.names = structuredClone(t.names);
  if (t?.custom) c.custom = structuredClone(t.custom);
  if (t?.menu || t?.top) {
    for (const id of ADDED_LATER_TOP) {
      if (c.menu.includes(id) || c.top.includes(id)) continue;
      const at = c.top.indexOf('menu');
      c.top.splice(at < 0 ? c.top.length : at, 0, id);
    }
    for (const id of ADDED_LATER) {
      if (c.menu.includes(id) || c.top.includes(id)) continue;
      const at = c.menu.indexOf('settings');
      c.menu.splice(at < 0 ? c.menu.length : at, 0, id);
    }
  }
  return c;
}

/** Characters never allowed in an admin's name or glyph (the game escapes what it shows anyway). */
const BAD_TEXT = /[<>&"'`\\\u0000-\u001f\u007f]/;
function graphemes(s: string): number {
  try {
    return [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(s)].length;
  } catch {
    return [...s].length;
  }
}
/** A clean name, or a Thai error. */
function checkLabel(v: unknown): string | { error: string } {
  if (typeof v !== 'string') return { error: 'ชื่อปุ่มไม่ถูกต้อง' };
  const s = v.trim().replace(/\s+/g, ' ');
  if (!s) return { error: 'ชื่อปุ่มว่างไม่ได้' };
  if ([...s].length > LABEL_MAX) return { error: `ชื่อปุ่มยาวได้ไม่เกิน ${LABEL_MAX} ตัวอักษร` };
  if (BAD_TEXT.test(s)) return { error: 'ชื่อปุ่มมีอักขระต้องห้าม (< > & " \' ` \\)' };
  return s;
}
/** A clean icon, or a Thai error. */
function checkIcon(v: unknown): MenuIcon | { error: string } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { error: 'ไอคอนไม่ถูกต้อง' };
  const o = v as Record<string, unknown>;
  if (Object.keys(o).some((k) => k !== 'img' && k !== 'glyph')) return { error: 'ไอคอนไม่ถูกต้อง' };
  if (typeof o.img !== 'string' || !(ICON_IMAGES as readonly string[]).includes(o.img)) return { error: 'ไม่รู้จักภาพไอคอน' };
  const out: MenuIcon = { img: o.img as IconImage };
  if (o.glyph !== undefined && o.glyph !== '') {
    if (typeof o.glyph !== 'string') return { error: 'อีโมจิไม่ถูกต้อง' };
    const g = o.glyph.trim();
    if (g) {
      if (g.length > 16 || graphemes(g) > 2 || BAD_TEXT.test(g) || /\s/.test(g)) return { error: 'อีโมจิบนไอคอนใส่ได้ 1–2 ตัว (ไม่มีช่องว่าง/อักขระต้องห้าม)' };
      out.glyph = g;
    }
  }
  return out;
}
export const sameIcon = (a: MenuIcon | undefined, b: MenuIcon | undefined): boolean => (a?.img ?? '') === (b?.img ?? '') && (a?.glyph ?? '') === (b?.glyph ?? '');

/** Why this list is not allowed, or null when fine (`custom` = the shortcut ids that exist). */
function listProblem(place: MenuPlace, ids: string[], custom: ReadonlySet<string>): string | null {
  const seen = new Set<string>();
  for (const id of ids) {
    const e = menuEntry(id);
    if (!e && !custom.has(id)) return `ไม่รู้จักปุ่ม "${id.slice(0, 20)}"`;
    if (e?.only && e.only !== place) return `ปุ่ม "${e.label}" อยู่ได้แค่ที่${MENU_PLACE_NAME[e.only]}`;
    if (seen.has(id)) return `ปุ่ม "${e?.label ?? id}" ซ้ำในรายการเดียวกัน`;
    seen.add(id);
  }
  for (const e of MENU_ENTRIES) {
    if (!e.pinned || e.only !== place) continue;
    if (!ids.includes(e.id)) return `ปุ่ม "${e.label}" ต้องมีเสมอ`;
    if (e.last && ids[ids.length - 1] !== e.id) return `ปุ่ม "${e.label}" ต้องอยู่ท้ายสุด`;
  }
  return null;
}

type Checked<T> = { ok: T } | { error: string };

/** The `custom` list: strict = errors, else bad buttons are dropped. */
function checkCustom(v: unknown, strict: boolean): Checked<CustomButton[]> {
  if (v === undefined) return { ok: [] };
  if (!Array.isArray(v) || v.length > CUSTOM_MAX) return strict ? { error: `ปุ่มลัดต้องเป็นรายการ ไม่เกิน ${CUSTOM_MAX} ปุ่ม` } : { ok: [] };
  const out: CustomButton[] = [];
  for (const x of v) {
    const bad = (why: string): Checked<CustomButton[]> | null => (strict ? { error: `ปุ่มลัด: ${why}` } : null);
    if (!x || typeof x !== 'object' || Array.isArray(x)) {
      const b = bad('ค่าไม่ถูกต้อง');
      if (b) return b;
      continue;
    }
    const o = x as Record<string, unknown>;
    const extra = Object.keys(o).find((k) => !['id', 'label', 'icon', 'act', 'free'].includes(k));
    const id = typeof o.id === 'string' ? o.id : '';
    const label = checkLabel(o.label);
    const icon = checkIcon(o.icon);
    const why = extra ? `ไม่รู้จักค่า "${extra.slice(0, 20)}"`
      : !isCustomId(id) ? `id "${id.slice(0, 20)}" ไม่ถูกต้อง`
      : out.some((b) => b.id === id) ? `id "${id}" ซ้ำ`
      : typeof label !== 'string' ? label.error
      : 'error' in icon ? icon.error
      : !isAct(o.act) ? `"${label}": สั่งได้เฉพาะรายการที่กำหนด`
      : o.free !== undefined && typeof o.free !== 'boolean' ? `"${label}": ค่าวางอิสระไม่ถูกต้อง`
      : null;
    if (why) {
      const b = bad(why);
      if (b) return b;
      continue;
    }
    const btn: CustomButton = { id, label: label as string, icon: icon as MenuIcon, act: o.act as ShortcutAct };
    if (o.free === true) btn.free = true;
    out.push(btn);
  }
  return { ok: out };
}

/** The `names` object: strict = errors, else bad entries are dropped. Names equal to the code are left out. */
function checkNames(v: unknown, strict: boolean): Checked<Record<string, MenuName>> {
  if (v === undefined) return { ok: {} };
  if (!v || typeof v !== 'object' || Array.isArray(v)) return strict ? { error: 'ชื่อ/ไอคอนปุ่มไม่ถูกต้อง' } : { ok: {} };
  const out: Record<string, MenuName> = {};
  const src = v as Record<string, unknown>;
  for (const id of Object.keys(src)) {
    const e = menuEntry(id);
    const x = src[id];
    let why: string | null = null;
    const n: MenuName = {};
    if (!e) why = `ไม่รู้จักปุ่ม "${id.slice(0, 20)}"`;
    else if (!x || typeof x !== 'object' || Array.isArray(x)) why = `ค่าของปุ่ม "${e.label}" ไม่ถูกต้อง`;
    else {
      const o = x as Record<string, unknown>;
      const extra = Object.keys(o).find((k) => k !== 'label' && k !== 'icon');
      if (extra) why = `ปุ่ม "${e.label}": ไม่รู้จักค่า "${extra.slice(0, 20)}"`;
      if (!why && o.label !== undefined && o.label !== '') {
        const l = checkLabel(o.label);
        if (typeof l !== 'string') why = `ปุ่ม "${e.label}": ${l.error}`;
        else if (NO_RENAME.has(id) && l !== e.label) why = `ปุ่ม "${e.label}" เปลี่ยนชื่อไม่ได้ (เกมเขียน ON/OFF ทับ)`;
        else if (l !== e.label) n.label = l;
      }
      if (!why && o.icon !== undefined && o.icon !== null) {
        const i = checkIcon(o.icon);
        if ('error' in i) why = `ปุ่ม "${e.label}": ${i.error}`;
        else if (!sameIcon(i, CODE_ICON[id])) n.icon = i;
      }
    }
    if (why) {
      if (strict) return { error: why };
      continue;
    }
    if (Object.keys(n).length) out[id] = n;
  }
  // In MENU_ENTRIES order, so the same names always store the same way.
  const sorted: Record<string, MenuName> = {};
  for (const e of MENU_ENTRIES) if (out[e.id]) sorted[e.id] = out[e.id];
  return { ok: sorted };
}

/**
 * Checks the `menuLayout` part of a balance tuning (see checkBalance): strict = errors for anything wrong, else a wrong
 * part is dropped (a shortcut that no longer exists is only taken out of the lists, the rest of the order stays).
 * What equals the code is left out. Returns the clean tuning (undefined = nothing differs).
 */
export function checkMenuLayoutTuning(x: unknown, strict: boolean): { tuning: MenuLayoutTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!x || typeof x !== 'object' || Array.isArray(x)) return strict ? { error: 'ค่าจัดเมนูเกมไม่ถูกต้อง' } : { tuning: undefined };
  const o = x as Record<string, unknown>;
  if (strict) {
    const extra = Object.keys(o).find((k) => !['menu', 'top', 'names', 'custom'].includes(k));
    if (extra) return { error: `จัดเมนูเกม: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: MenuLayoutTuning = {};
  const custom = checkCustom(o.custom, strict);
  if ('error' in custom) return { error: `จัดเมนูเกม: ${custom.error}` };
  if (custom.ok.length) out.custom = custom.ok;
  const customIds = new Set(custom.ok.map((b) => b.id));
  const names = checkNames(o.names, strict);
  if ('error' in names) return { error: `จัดเมนูเกม: ${names.error}` };
  if (Object.keys(names.ok).length) out.names = names.ok;
  for (const place of ['menu', 'top'] as const) {
    const v = o[place];
    if (v === undefined) continue;
    if (!Array.isArray(v) || v.length > 40 + CUSTOM_MAX || v.some((i) => typeof i !== 'string')) {
      if (strict) return { error: `จัดเมนูเกม: รายการ${MENU_PLACE_NAME[place]}ไม่ถูกต้อง` };
      continue;
    }
    // Read back leniently: a shortcut deleted since (or otherwise unknown) just leaves the list.
    const ids = strict ? (v as string[]) : (v as string[]).filter((id) => menuEntry(id) || customIds.has(id));
    const why = listProblem(place, ids, customIds);
    if (why) {
      if (strict) return { error: `จัดเมนูเกม (${MENU_PLACE_NAME[place]}): ${why}` };
      continue;
    }
    if (JSON.stringify(ids) !== JSON.stringify(CODE[place])) out[place] = [...ids];
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

const iconText = (i: MenuIcon | undefined): string => (i ? `${i.img}${i.glyph ? `+${i.glyph}` : ''}` : 'ในโค้ด');

/** Audit lines of what differs between two layouts. */
export function menuLayoutChanges(a: MenuLayoutConfig, b: MenuLayoutConfig): string[] {
  const out: string[] = [];
  const name = (cfg: MenuLayoutConfig) => (id: string) => buttonLabel(cfg, id);
  for (const place of ['menu', 'top'] as const) {
    if (a[place].join() === b[place].join()) continue;
    const added = b[place].filter((i) => !a[place].includes(i)).map(name(b));
    const removed = a[place].filter((i) => !b[place].includes(i)).map(name(a));
    const parts = [added.length ? `เพิ่ม ${added.join('/')}` : '', removed.length ? `เอาออก ${removed.join('/')}` : ''].filter(Boolean);
    const order = b[place].filter((i) => a[place].includes(i)).join() !== a[place].filter((i) => b[place].includes(i)).join();
    if (order) parts.push('เปลี่ยนลำดับ');
    out.push(`จัดเมนูเกม ${MENU_PLACE_NAME[place]}: ${parts.join(', ')} → ${b[place].map(name(b)).join(' · ')}`);
  }
  for (const e of MENU_ENTRIES) {
    const x = a.names[e.id];
    const y = b.names[e.id];
    if ((x?.label ?? '') !== (y?.label ?? '')) out.push(`จัดเมนูเกม ชื่อปุ่ม ${e.label}: ${x?.label ?? 'ในโค้ด'} → ${y?.label ?? 'ในโค้ด'}`);
    if (!sameIcon(x?.icon, y?.icon)) out.push(`จัดเมนูเกม ไอคอน ${e.label}: ${iconText(x?.icon)} → ${iconText(y?.icon)}`);
  }
  for (const c of b.custom) {
    const old = a.custom.find((o) => o.id === c.id);
    const desc = `${c.label} (${actName(c.act)}, ${iconText(c.icon)}${c.free ? ', วางอิสระ' : ''})`;
    if (!old) out.push(`จัดเมนูเกม เพิ่มปุ่มลัด ${c.id}: ${desc}`);
    else if (JSON.stringify(old) !== JSON.stringify(c)) out.push(`จัดเมนูเกม แก้ปุ่มลัด ${c.id}: ${old.label} → ${desc}`);
  }
  for (const c of a.custom) if (!b.custom.some((n) => n.id === c.id)) out.push(`จัดเมนูเกม ลบปุ่มลัด ${c.id}: ${c.label}`);
  return out;
}
