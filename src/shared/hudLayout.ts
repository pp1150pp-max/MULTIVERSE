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
  { id: 'hud-topleft', label: 'การ์ดตัวละคร + หลอด HP/MP', kind: 'hud', origin: 'top left', box: { desktop: [1, 1.7, 22, 13], touch: [1, 2, 40, 18] } },
  { id: 'hud-buffs', label: 'บัฟ/ดีบัฟ (มุมซ้ายบน)', kind: 'hud', origin: 'top left', box: { desktop: [1, 15, 16, 4], touch: [1, 21, 22, 6] } },
  { id: 'party-hud', label: 'สมาชิกปาร์ตี้', kind: 'hud', origin: 'top left', box: { desktop: [1, 21, 15, 20], touch: [1, 28, 20, 24] } },
  { id: 'boss-bar', label: 'หลอดเลือดบอส', kind: 'hud', origin: 'top center', box: { desktop: [30, 2, 40, 5], touch: [30, 18, 40, 7] } },
  { id: 'minimap-wrap', label: 'มินิแมพ', kind: 'hud', origin: 'top right', box: { desktop: [85.2, 1.7, 13.8, 24.4], touch: [83.6, 2, 15.2, 33] } },
  { id: 'hud-iconrow', label: 'แถวไอคอนมุมขวาบน (AUTO … เมนู)', kind: 'hud', origin: 'top right', box: { desktop: [52, 1.7, 32.5, 6] }, keep: ['desktop'], why: 'มีปุ่มเมนูกับปุ่ม AUTO จึงซ่อนไม่ได้' },
  { id: 'hud-ping', label: 'ปิง', kind: 'hud', origin: 'top right', box: { desktop: [89, 26.5, 10, 3], touch: [86, 36, 12, 5] } },
  { id: 'quest-tracker', label: 'ตัวติดตามเควส', kind: 'hud', origin: 'top right', box: { desktop: [80, 31, 19, 14], touch: [70, 42, 28, 20] } },
  { id: 'log', label: 'กล่องแชต/ข้อความ', kind: 'hud', origin: 'bottom left', box: { desktop: [1, 50, 33, 22], touch: [1, 56, 40, 30] } },
  { id: 'chat', label: 'ช่องพิมพ์แชต', kind: 'hud', origin: 'bottom left', box: { desktop: [1, 73, 33, 5], touch: [1, 87, 40, 10] } },
  { id: 'hud-bottom', label: 'แถบสกิล + EXP', kind: 'hud', origin: 'bottom center', box: { desktop: [28, 82, 44, 16], touch: [31, 1, 38, 15] } },
  { id: 'orb-hp', label: 'ลูกแก้ว HP', kind: 'hud', origin: 'bottom left', box: { desktop: [12, 76, 10, 22], touch: [1, 70, 12, 28] } },
  { id: 'orb-mp', label: 'ลูกแก้ว MP', kind: 'hud', origin: 'bottom right', box: { desktop: [78, 76, 10, 22], touch: [87, 70, 12, 28] } },
  { id: 'tc-menu', label: 'ปุ่มเมนู (จอสัมผัส)', kind: 'hud', origin: 'top left', box: { touch: [1, 40, 7, 13] }, keep: ['touch'], why: 'ทางเดียวที่เปิดเมนูบนจอสัมผัส จึงซ่อนไม่ได้' },
  { id: 'tc-stick', label: 'จอยเดิน', kind: 'hud', origin: 'bottom left', box: { touch: [4, 56, 24, 40] }, keep: ['touch'], why: 'ใช้เดิน จึงซ่อนไม่ได้' },
  { id: 'tc-pad', label: 'ปุ่มโจมตี + สกิล + AUTO', kind: 'hud', origin: 'bottom right', box: { touch: [68, 44, 31, 54] }, keep: ['touch'], why: 'ใช้โจมตี จึงซ่อนไม่ได้' },
  // Windows: opened by the player; the layout moves their default spot and their size. Dragging still works.
  { id: 'inventory', label: 'หน้าต่าง: กระเป๋า', kind: 'window', origin: 'top right', box: { desktop: [62, 10, 37, 76], touch: [52, 4, 47, 92] } },
  { id: 'skills-win', label: 'หน้าต่าง: สกิล', kind: 'window', origin: 'top left', box: { desktop: WIN_MID, touch: [10, 4, 80, 92] } },
  { id: 'party-win', label: 'หน้าต่าง: ปาร์ตี้', kind: 'window', origin: 'top left', box: { desktop: [1, 17, 28, 55], touch: [1, 17, 40, 75] } },
  { id: 'friends-win', label: 'หน้าต่าง: เพื่อน', kind: 'window', origin: 'top left', box: { desktop: [1, 21, 28, 55], touch: [1, 21, 40, 75] } },
  { id: 'mail-win', label: 'หน้าต่าง: จดหมาย', kind: 'window', origin: 'top left', box: { desktop: [1, 25, 28, 55], touch: [1, 25, 40, 72] } },
  { id: 'trade-win', label: 'หน้าต่าง: เทรด', kind: 'window', origin: 'top left', box: { desktop: WIN_MID, touch: [10, 4, 80, 92] } },
  { id: 'daily-win', label: 'หน้าต่าง: ล็อกอินรายวัน', kind: 'window', origin: 'top left', box: { desktop: WIN_MID, touch: [10, 4, 80, 92] } },
  { id: 'fullmap', label: 'หน้าต่าง: แผนที่ใหญ่', kind: 'window', origin: 'top left', box: { desktop: [20, 8, 60, 84], touch: [10, 4, 80, 92] } },
  { id: 'cos-win', label: 'หน้าต่าง: แต่งตัว', kind: 'window', origin: 'top left', box: { desktop: WIN_MID, touch: [10, 4, 80, 92] } },
  { id: 'cash-win', label: 'หน้าต่าง: แคชช็อป', kind: 'window', origin: 'top left', box: { desktop: [15, 8, 70, 84], touch: [5, 4, 90, 92] } },
  { id: 'auto-settings', label: 'หน้าต่าง: ตั้งค่า Auto', kind: 'window', origin: 'top right', box: { desktop: [66, 12, 30, 66], touch: [50, 4, 48, 92] } },
  { id: 'sys-menu', label: 'หน้าต่าง: เมนู', kind: 'window', origin: 'top left', box: { desktop: [35, 15, 30, 65], touch: [25, 4, 50, 92] } },
  { id: 'audio-panel', label: 'หน้าต่าง: เสียง', kind: 'window', origin: 'top left', box: { desktop: [35, 20, 30, 55], touch: [20, 4, 60, 92] } },
  { id: 'gfx-panel', label: 'หน้าต่าง: กราฟิก', kind: 'window', origin: 'top left', box: { desktop: [35, 20, 30, 55], touch: [20, 4, 60, 92] } },
  { id: 'keybind-panel', label: 'หน้าต่าง: ปุ่มลัด', kind: 'window', origin: 'top left', box: { desktop: WIN_MID, touch: [10, 4, 80, 92] } },
  { id: 'help', label: 'หน้าต่าง: วิธีเล่น', kind: 'window', origin: 'top left', box: { desktop: WIN_MID, touch: [10, 4, 80, 92] } },
  { id: 'news-win', label: 'หน้าต่าง: มีอะไรใหม่', kind: 'window', origin: 'top left', box: { desktop: WIN_MID, touch: [10, 4, 80, 92] } },
  { id: 'report-win', label: 'หน้าต่าง: แจ้งปัญหา', kind: 'window', origin: 'top left', box: { desktop: [32, 15, 36, 60], touch: [15, 4, 70, 92] } },
  { id: 'quest-win', label: 'หน้าต่าง: เควส The Seeker', kind: 'window', origin: 'top left', box: { desktop: WIN_MID, touch: [10, 4, 80, 92] } },
  { id: 'channels-win', label: 'หน้าต่าง: เลือกแชนแนล', kind: 'window', origin: 'top left', box: { desktop: [35, 20, 30, 50], touch: [20, 4, 60, 92] } },
  { id: 'room-win', label: 'หน้าต่าง: แท่นเรียกบอส', kind: 'window', origin: 'top left', box: { desktop: WIN_MID, touch: [10, 4, 80, 92] } },
  { id: 'shop', label: 'หน้าต่าง: พ่อค้า', kind: 'window', origin: 'top left', box: { desktop: WIN_LEFT, touch: [1, 4, 50, 92] } },
  { id: 'stash', label: 'หน้าต่าง: คลัง', kind: 'window', origin: 'top left', box: { desktop: WIN_LEFT, touch: [1, 4, 50, 92] } },
  { id: 'forge', label: 'หน้าต่าง: ช่างตีเหล็ก', kind: 'window', origin: 'top left', box: { desktop: WIN_LEFT, touch: [1, 4, 50, 92] } },
  { id: 'market', label: 'หน้าต่าง: ตลาด', kind: 'window', origin: 'top left', box: { desktop: [1, 8, 60, 84], touch: [1, 4, 70, 92] } },
];

const DEF = new Map(HUD_PARTS.map((p) => [p.id, p]));
export const hudPart = (id: string): HudPartDef | undefined => DEF.get(id);

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
  return Object.keys(out).length ? out : undefined;
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
      const unknown = Object.keys(parts).find((id) => !hudPart(id));
      if (unknown) return { error: `จัดหน้าจอเกม: ไม่รู้จักส่วน "${unknown.slice(0, 30)}"` };
    }
    const dev: Record<string, HudPos> = {};
    for (const p of HUD_PARTS) {
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
    for (const p of HUD_PARTS) {
      if (JSON.stringify(ad[p.id] ?? null) === JSON.stringify(bd[p.id] ?? null)) continue;
      parts.push(`${p.label}: ${fmt(ad[p.id])} → ${fmt(bd[p.id])}`);
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
    for (const p of HUD_PARTS) {
      const v = cfg[d]?.[p.id];
      if (!v) continue;
      const sel = `${scope} #${p.id}`;
      const decl: string[] = [];
      if (v.x || v.y) decl.push(`translate: ${v.x ?? 0}vw ${v.y ?? 0}vh`);
      if (v.s && v.s !== 1) decl.push(`scale: ${v.s}`, `transform-origin: ${p.origin}`);
      if (decl.length) rules.push(`${sel} { ${decl.join('; ')}; }`);
      if (v.hide && p.kind === 'hud' && !p.keep?.includes(d)) rules.push(`${sel} { display: none !important; }`);
    }
  }
  return rules.join('\n');
}
