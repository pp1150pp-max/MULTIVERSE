// "จัดหน้าจอเกม" (owner 2026-11-22, docs/systems/world-and-ui.md): admins move, resize and hide the game's HUD parts and
// windows from /admin, server-wide. Each part keeps the place the code's stylesheet gives it; the layout only stores how far
// it is moved (in % of the screen, so it works on any screen size), its size and whether it is hidden, separately for mouse
// screens and touch screens (body.touch-ui). Only parts that differ from the code are stored (`BalanceTuning.hudLayout`).
// The client turns the layout into one <style> (hudLayoutCss) using the CSS `translate` / `scale` properties, which add to
// the stylesheet's own placement and transforms instead of replacing them.
//
// Which buttons the menu window / top icon row show is a different setting: menuLayout.ts ("จัดเมนูเกม").

export type HudDevice = 'desktop' | 'touch';
export const HUD_DEVICES: readonly HudDevice[] = ['desktop', 'touch'];
export const HUD_DEVICE_NAME: Record<HudDevice, string> = { desktop: 'จอคอม (เมาส์)', touch: 'จอสัมผัส (มือถือ/iPad)' };
/** The size of the /admin mock screen per device, in px (the % values are the same on any real screen). */
export const HUD_FRAME: Record<HudDevice, { w: number; h: number }> = { desktop: { w: 1280, h: 720 }, touch: { w: 844, h: 390 } };

/** A rough box on the /admin mock screen: left, top, width, height in % of the screen. Only a guide, the game is the truth. */
export type HudBox = readonly [number, number, number, number];

export interface HudPartDef {
  /** The element's DOM id. */
  id: string;
  /** Thai name shown on /admin. */
  label: string;
  /** A HUD part (can be hidden) or a window (opened by the player: moved and resized only). */
  kind: 'hud' | 'window';
  /** Where it sits by default on each device it exists on (no entry = not on that device). */
  box: Partial<Record<HudDevice, HudBox>>;
  /** Scaling grows away from this corner (CSS transform-origin). */
  origin: string;
  /** Devices where it may not be hidden (the player must always reach the menu / move). */
  keep?: readonly HudDevice[];
  /** Why it can't be hidden, shown on /admin. */
  why?: string;
}

const WIN_LEFT: HudBox = [1, 14, 36, 72];
const WIN_MID: HudBox = [25, 12, 50, 72];

/** Every part, in the order /admin lists them. */
export const HUD_PARTS: readonly HudPartDef[] = [
  { id: 'hud-topleft', label: 'การ์ดตัวละคร + หลอด HP/MP', kind: 'hud', origin: 'top left', box: { desktop: [0.9, 1.7, 18.4, 44], touch: [1.4, 3.1, 30.4, 74.7] } },
  { id: 'hud-buffs', label: 'บัฟ/ดีบัฟ (มุมซ้ายบน)', kind: 'hud', origin: 'top left', box: { desktop: [0.9, 31.9, 18.4, 3.1], touch: [1.4, 52.4, 30.4, 5.6] } },
  { id: 'party-hud', label: 'สมาชิกปาร์ตี้', kind: 'hud', origin: 'top left', box: { desktop: [0.9, 36.1, 14.8, 9.6], touch: [1.4, 60, 22.5, 17.7] } },
  { id: 'boss-bar', label: 'หลอดเลือดบอส', kind: 'hud', origin: 'top center', box: { desktop: [32, 1.9, 35.9, 5.6], touch: [22.7, 3.6, 54.5, 10.3] } },
  { id: 'minimap-wrap', label: 'มินิแมพ', kind: 'hud', origin: 'top right', box: { desktop: [85.3, 1.7, 13.8, 24.4], touch: [83.4, 3.1, 15.2, 32.8] } },
  { id: 'hud-iconrow', label: 'แถวไอคอนมุมขวาบน (AUTO … เมนู)', kind: 'hud', origin: 'top right', box: { desktop: [45.2, 1.7, 39.5, 8.6] }, keep: ['desktop'], why: 'มีปุ่มเมนูกับปุ่ม AUTO จึงซ่อนไม่ได้' },
  { id: 'hud-ping', label: 'ปิง', kind: 'hud', origin: 'top right', box: { desktop: [95.9, 27.5, 3.1, 2.1], touch: [92.6, 31.8, 5.7, 3.8] } },
  { id: 'quest-tracker', label: 'ตัวติดตามเควส', kind: 'hud', origin: 'top left', box: { desktop: [0.9, 19.6, 18.4, 11.8], touch: [1.4, 29.5, 28, 21.8] } },
  { id: 'log', label: 'กล่องแชต/ข้อความ', kind: 'hud', origin: 'bottom left', box: { desktop: [0.9, 57.8, 32.8, 8.8], touch: [15.2, 71.5, 45, 16.2] } },
  { id: 'chat', label: 'ช่องพิมพ์แชต', kind: 'hud', origin: 'bottom left', box: { desktop: [0.9, 66.7, 32.8, 4.9], touch: [15.2, 89, 45, 9] } },
  { id: 'hud-bottom', label: 'แถบสกิล + EXP', kind: 'hud', origin: 'bottom center', box: { desktop: [28.1, 79.6, 43.8, 19.9], touch: [31, 1, 37.9, 3.1] } },
  { id: 'orb-hp', label: 'ลูกแก้ว HP', kind: 'hud', origin: 'bottom left', box: { desktop: [13.3, 71.8, 14.8, 27.6] } },
  { id: 'orb-mp', label: 'ลูกแก้ว MP', kind: 'hud', origin: 'bottom right', box: { desktop: [71.9, 71.8, 14.8, 27.6] } },
  { id: 'tc-menu', label: 'ปุ่มเมนู (จอสัมผัส)', kind: 'hud', origin: 'top left', box: { touch: [1.4, 41.5, 4.3, 9.2] }, keep: ['touch'], why: 'ทางเดียวที่เปิดเมนูบนจอสัมผัส จึงซ่อนไม่ได้' },
  { id: 'tc-stick', label: 'จอยเดิน', kind: 'hud', origin: 'bottom left', box: { touch: [1.9, 71.3, 11.4, 24.6] }, keep: ['touch'], why: 'ใช้เดิน จึงซ่อนไม่ได้' },
  { id: 'tc-pad', label: 'ปุ่มโจมตี + สกิล + AUTO', kind: 'hud', origin: 'bottom right', box: { touch: [70.3, 56.8, 28.1, 39.6] }, keep: ['touch'], why: 'ใช้โจมตี จึงซ่อนไม่ได้' },
  // Windows: opened by the player; the layout moves their default spot and their size. Dragging still works.
  { id: 'inventory', label: 'หน้าต่าง: กระเป๋า', kind: 'window', origin: 'top right', box: { desktop: [40.3, 0.6, 59.4, 98.9], touch: [38.8, 1, 60.7, 97.9] } },
  { id: 'skills-win', label: 'หน้าต่าง: สกิล', kind: 'window', origin: 'top left', box: { desktop: [14.1, 1.1, 71.9, 96.7], touch: [1.9, 2.1, 96.2, 93.8] } },
  { id: 'party-win', label: 'หน้าต่าง: ปาร์ตี้', kind: 'window', origin: 'top left', box: { desktop: [0.9, 16.7, 26.6, 26.3], touch: [1.4, 55.4, 40.3, 42.1] } },
  { id: 'friends-win', label: 'หน้าต่าง: เพื่อน', kind: 'window', origin: 'top left', box: { desktop: [0.9, 20.6, 32.8, 31.5], touch: [1.4, 62.6, 49.8, 37.4] } },
  { id: 'mail-win', label: 'หน้าต่าง: จดหมาย', kind: 'window', origin: 'top left', box: { desktop: [0.9, 24.4, 29.7, 35.3], touch: [1.4, 69.7, 45, 30.3] } },
  { id: 'trade-win', label: 'หน้าต่าง: เทรด', kind: 'window', origin: 'top left', box: { desktop: [28.1, 9.7, 43.8, 40.3], touch: [16.8, 17.9, 66.4, 74.4] } },
  { id: 'daily-win', label: 'หน้าต่าง: ล็อกอินรายวัน', kind: 'window', origin: 'top left', box: { desktop: [32, 1.1, 35.9, 68.6], touch: [9.7, 2.1, 80.6, 79.3] } },
  { id: 'fullmap', label: 'หน้าต่าง: แผนที่ใหญ่', kind: 'window', origin: 'top left', box: { desktop: [26.9, 0, 46.1, 100], touch: [31.1, 0, 37.9, 100] } },
  { id: 'cos-win', label: 'หน้าต่าง: แต่งตัว', kind: 'window', origin: 'top left', box: { desktop: [28.1, 9.7, 43.8, 70.4], touch: [16.8, 17.9, 66.4, 82.1] } },
  { id: 'cash-win', label: 'หน้าต่าง: แคชช็อป', kind: 'window', origin: 'top left', box: { desktop: [19.5, 7.8, 60.9, 74.9], touch: [3.8, 14.4, 92.4, 85.6] } },
  { id: 'auto-settings', label: 'หน้าต่าง: ตั้งค่า Auto', kind: 'window', origin: 'top right', box: { desktop: [63.4, 1.7, 23.4, 96.7], touch: [44.5, 3.1, 35.5, 93.8] } },
  { id: 'sys-menu', label: 'หน้าต่าง: เมนู', kind: 'window', origin: 'top left', box: { desktop: [36.7, 0, 26.6, 100], touch: [29.9, 0, 40.3, 100] } },
  { id: 'help', label: 'หน้าต่าง: วิธีเล่น', kind: 'window', origin: 'top left', box: { desktop: [32, 0, 35.9, 100], touch: [22.7, 0, 54.5, 100] } },
  { id: 'news-win', label: 'หน้าต่าง: มีอะไรใหม่', kind: 'window', origin: 'top left', box: { desktop: [25.8, 1.1, 48.4, 22.1], touch: [13.3, 2.1, 73.5, 40.8] } },
  { id: 'report-win', label: 'หน้าต่าง: แจ้งปัญหา', kind: 'window', origin: 'top left', box: { desktop: [34.4, 11.1, 31.3, 46.1], touch: [26.3, 20.5, 47.4, 79.5] } },
  { id: 'quest-win', label: 'หน้าต่าง: เควส The Seeker', kind: 'window', origin: 'top left', box: { desktop: WIN_MID, touch: [10, 4, 80, 92] } },
  { id: 'channels-win', label: 'หน้าต่าง: เลือกแชนแนล', kind: 'window', origin: 'top left', box: { desktop: [35, 20, 30, 50], touch: [20, 4, 60, 92] } },
  { id: 'room-win', label: 'หน้าต่าง: แท่นเรียกบอส', kind: 'window', origin: 'top left', box: { desktop: WIN_MID, touch: [10, 4, 80, 92] } },
  { id: 'shop', label: 'หน้าต่าง: พ่อค้า', kind: 'window', origin: 'top left', box: { desktop: [0.9, 16.7, 41.7, 49], touch: [1.4, 55.4, 63.3, 44.6] } },
  { id: 'stash', label: 'หน้าต่าง: คลัง', kind: 'window', origin: 'top left', box: { desktop: [0.9, 16.7, 41.7, 27.9], touch: [1.4, 55.4, 63.3, 44.6] } },
  { id: 'forge', label: 'หน้าต่าง: ช่างตีเหล็ก', kind: 'window', origin: 'top left', box: { desktop: [0.9, 16.7, 56.1, 56.4], touch: [1.4, 1, 62.7, 99] } },
  { id: 'market', label: 'หน้าต่าง: ตลาด', kind: 'window', origin: 'top left', box: { desktop: [0.9, 13.3, 50, 82.6], touch: [1.4, 50.3, 75.8, 47.2] } },
];

const DEF = new Map(HUD_PARTS.map((p) => [p.id, p]));
/**
 * Windows that no longer exist (2026-11-26: กราฟิก / เสียง / ปุ่มลัด became tabs of the settings page in the เมนู window).
 * A saved layout, draft or history entry may still name them: dropped quietly, never an error on /admin's save.
 */
const RETIRED_PARTS = new Set(['audio-panel', 'gfx-panel', 'keybind-panel']);

/**
 * An admin's floating shortcut button (menuLayout.ts `custom` with `free`), part id `hud-btn-<c…>`. It sits at the top left
 * corner of the screen in the code, so its x / y are simply where it is; it shows on a device only while the published
 * layout has an entry for it there (an entry equal to the code is kept, it means "placed at the corner"). A part whose
 * button was deleted since is harmless (no such element) and dropped by /admin on the next save.
 */
export const FREE_BTN_RE = /^hud-btn-(c\d{1,3})$/;
const FREE_BTN_MAX = 20;
export const isFreeBtnPart = (id: string): boolean => FREE_BTN_RE.test(id);
/** Where a newly placed floating button goes (right side, under the quest tracker), in % of the screen. */
export const FREE_BTN_START: Record<HudDevice, { x: number; y: number }> = { desktop: { x: 92, y: 50 }, touch: { x: 2, y: 56 } };
const freePart = (id: string): HudPartDef | undefined => {
  const m = FREE_BTN_RE.exec(id);
  if (!m) return undefined;
  return { id, label: `ปุ่มลัด ${m[1]}`, kind: 'hud', origin: 'top left', box: { desktop: [0, 0, 4.5, 8], touch: [0, 0, 7, 13] } };
};
export const hudPart = (id: string): HudPartDef | undefined => DEF.get(id) ?? freePart(id);
/** The floating-button part ids found in one device's layout, sorted (c2 before c10). */
const freeIds = (...devs: (Record<string, unknown> | undefined)[]): string[] =>
  [...new Set(devs.flatMap((d) => Object.keys(d ?? {}).filter(isFreeBtnPart)))].sort((a, b) => Number(a.slice(9)) - Number(b.slice(9)));

/** One part's change from the code: moved by x% of the screen width / y% of its height, scale s, hidden. Missing = unchanged. */
export interface HudPos {
  x?: number;
  y?: number;
  s?: number;
  hide?: true;
}
/** Per device, per part id: only the parts that differ from the code. */
export type HudLayoutConfig = Record<HudDevice, Record<string, HudPos>>;
export type HudLayoutTuning = Partial<HudLayoutConfig>;

export const HUD_RANGE = { move: 100, sMin: 0.5, sMax: 2 } as const;

export function codeHudLayout(): HudLayoutConfig {
  return { desktop: {}, touch: {} };
}

export function mergeHudLayout(t: HudLayoutTuning | undefined): HudLayoutConfig {
  const c = codeHudLayout();
  for (const d of HUD_DEVICES) if (t?.[d]) c[d] = structuredClone(t[d]!);
  return c;
}

const round = (v: number, step: number): number => Math.round(v / step) * step;
const clean = (v: number, step: number): number => Number(round(v, step).toFixed(3));

/** One part's change, cleaned (undefined = same as the code), or a Thai error. */
function checkPos(d: HudDevice, id: string, v: unknown, strict: boolean): HudPos | undefined | string {
  const part = hudPart(id);
  if (!part) return `ไม่รู้จักส่วน "${id.slice(0, 30)}"`;
  if (!part.box[d]) return `"${part.label}" ไม่มีบน${HUD_DEVICE_NAME[d]}`;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return `ค่าของ "${part.label}" ไม่ถูกต้อง`;
  const o = v as Record<string, unknown>;
  if (strict) {
    const extra = Object.keys(o).find((k) => !['x', 'y', 's', 'hide'].includes(k));
    if (extra) return `"${part.label}": ไม่รู้จักค่า "${extra.slice(0, 20)}"`;
  }
  const out: HudPos = {};
  for (const k of ['x', 'y'] as const) {
    const n = o[k];
    if (n === undefined) continue;
    if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > HUD_RANGE.move) {
      if (strict) return `"${part.label}": ระยะเลื่อนต้องอยู่ระหว่าง -${HUD_RANGE.move} ถึง ${HUD_RANGE.move}%`;
      continue;
    }
    const r = clean(n, 0.1);
    if (r !== 0) out[k] = r;
  }
  if (o.s !== undefined) {
    const n = o.s;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < HUD_RANGE.sMin || n > HUD_RANGE.sMax) {
      if (strict) return `"${part.label}": ขนาดต้องอยู่ระหว่าง ${HUD_RANGE.sMin * 100}–${HUD_RANGE.sMax * 100}%`;
    } else {
      const r = clean(n, 0.01);
      if (r !== 1) out.s = r;
    }
  }
  if (o.hide !== undefined && o.hide !== false) {
    if (o.hide !== true) {
      if (strict) return `"${part.label}": ค่าซ่อนไม่ถูกต้อง`;
    } else if (part.kind === 'window') {
      if (strict) return `"${part.label}" เป็นหน้าต่าง ซ่อนไม่ได้ (ผู้เล่นเปิดเอง)`;
    } else if (part.keep?.includes(d)) {
      if (strict) return `"${part.label}" ${part.why ?? 'ซ่อนไม่ได้'}`;
    } else out.hide = true;
  }
  // A floating button's entry is kept even when empty: it means "placed here on this device".
  return Object.keys(out).length || isFreeBtnPart(id) ? out : undefined;
}

/**
 * Checks the `hudLayout` part of a balance tuning, or a draft (strict = errors for anything wrong, else wrong parts are
 * dropped). Parts equal to the code are left out, parts come in HUD_PARTS order. Returns the clean tuning (undefined = nothing differs).
 */
export function checkHudLayoutTuning(x: unknown, strict: boolean): { tuning: HudLayoutTuning | undefined } | { error: string } {
  if (x === undefined || x === null) return { tuning: undefined };
  if (typeof x !== 'object' || Array.isArray(x)) return strict ? { error: 'ค่าจัดหน้าจอเกมไม่ถูกต้อง' } : { tuning: undefined };
  const o = x as Record<string, unknown>;
  if (strict) {
    const extra = Object.keys(o).find((k) => !(HUD_DEVICES as readonly string[]).includes(k));
    if (extra) return { error: `จัดหน้าจอเกม: ไม่รู้จักค่า "${extra.slice(0, 20)}"` };
  }
  const out: HudLayoutTuning = {};
  for (const d of HUD_DEVICES) {
    const v = o[d];
    if (v === undefined) continue;
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      if (strict) return { error: `จัดหน้าจอเกม (${HUD_DEVICE_NAME[d]}): ค่าไม่ถูกต้อง` };
      continue;
    }
    const parts = v as Record<string, unknown>;
    if (strict) {
      const unknown = Object.keys(parts).find((id) => !hudPart(id) && !RETIRED_PARTS.has(id));
      if (unknown) return { error: `จัดหน้าจอเกม: ไม่รู้จักส่วน "${unknown.slice(0, 30)}"` };
    }
    const dev: Record<string, HudPos> = {};
    const free = freeIds(parts);
    if (free.length > FREE_BTN_MAX) {
      if (strict) return { error: `จัดหน้าจอเกม: ปุ่มลัดวางอิสระได้ไม่เกิน ${FREE_BTN_MAX} ปุ่ม` };
      free.length = FREE_BTN_MAX;
    }
    for (const p of [...HUD_PARTS, ...free.map((id) => hudPart(id)!)]) {
      if (parts[p.id] === undefined) continue;
      const c = checkPos(d, p.id, parts[p.id], strict);
      if (typeof c === 'string') {
        if (strict) return { error: `จัดหน้าจอเกม (${HUD_DEVICE_NAME[d]}): ${c}` };
        continue;
      }
      if (c) dev[p.id] = c;
    }
    if (Object.keys(dev).length) out[d] = dev;
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

const fmt = (p: HudPos | undefined): string => {
  if (!p) return 'ค่าในโค้ด';
  const bits: string[] = [];
  if (p.hide) bits.push('ซ่อน');
  if (p.x || p.y) bits.push(`เลื่อน ${p.x ?? 0}%,${p.y ?? 0}%`);
  if (p.s) bits.push(`ขนาด ${Math.round(p.s * 100)}%`);
  return bits.join(' ') || 'ค่าในโค้ด';
};

/** Audit lines of what differs between two layouts. */
export function hudLayoutChanges(a: HudLayoutTuning | undefined, b: HudLayoutTuning | undefined): string[] {
  const out: string[] = [];
  for (const d of HUD_DEVICES) {
    const ad = a?.[d] ?? {};
    const bd = b?.[d] ?? {};
    const parts: string[] = [];
    for (const p of [...HUD_PARTS, ...freeIds(ad, bd).map((id) => hudPart(id)!)]) {
      if (JSON.stringify(ad[p.id] ?? null) === JSON.stringify(bd[p.id] ?? null)) continue;
      const show = (v: HudPos | undefined): string => (isFreeBtnPart(p.id) ? (v ? `วางที่ ${v.x ?? 0}%,${v.y ?? 0}%${v.s ? ` ขนาด ${Math.round(v.s * 100)}%` : ''}${v.hide ? ' (ซ่อน)' : ''}` : 'ไม่วาง') : fmt(v));
      parts.push(`${p.label}: ${show(ad[p.id])} → ${show(bd[p.id])}`);
    }
    if (parts.length) out.push(`จัดหน้าจอเกม ${HUD_DEVICE_NAME[d]}: ${parts.join(' · ')}`);
  }
  return out;
}

/** The stylesheet that puts a layout on the game page (body.touch-ui = touch screen). */
export function hudLayoutCss(cfg: HudLayoutConfig): string {
  const rules: string[] = [];
  for (const d of HUD_DEVICES) {
    const scope = d === 'touch' ? 'body.touch-ui' : 'body:not(.touch-ui)';
    for (const p of [...HUD_PARTS, ...freeIds(cfg[d]).map((id) => hudPart(id)!)]) {
      const v = cfg[d]?.[p.id];
      if (!v) continue;
      const sel = `${scope} #${p.id}`;
      // A floating button is hidden by the game's stylesheet until it has a place on this device.
      if (isFreeBtnPart(p.id) && !v.hide) rules.push(`${sel} { display: flex; }`);
      const decl: string[] = [];
      if (v.x || v.y) decl.push(`translate: ${v.x ?? 0}vw ${v.y ?? 0}vh`);
      if (v.s && v.s !== 1) decl.push(`scale: ${v.s}`, `transform-origin: ${p.origin}`);
      if (decl.length) rules.push(`${sel} { ${decl.join('; ')}; }`);
      if (v.hide && p.kind === 'hud' && !p.keep?.includes(d)) rules.push(`${sel} { display: none !important; }`);
    }
  }
  return rules.join('\n');
}
