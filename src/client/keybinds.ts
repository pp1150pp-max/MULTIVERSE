// Players' own keys (owner 2026-11-21): each game action can be moved to another key, or reset, from เมนู → ตั้งค่า →
// ตั้งค่าปุ่ม (src/client/keybindPanel.ts). Kept in this browser only. The game itself still asks for each action's
// default key (Game.ts `i.pressed('KeyF')`, the touch buttons tap 'Space'...): Input turns the key really pressed into
// the default key of the action it is bound to, so nothing else has to change. Esc, the mouse and the on-screen touch
// buttons stay as they are. /admin fxLayer.keyRebind off = every key works as in the code.
import { currentBalance } from '../shared/balance';

export interface KeyAction { id: string; label: string; def: string }

/** Every action a player can move, with the key the game listens for (its default). */
export const KEY_ACTIONS: readonly KeyAction[] = [
  { id: 'up', label: 'เดินขึ้น', def: 'KeyW' },
  { id: 'left', label: 'เดินซ้าย', def: 'KeyA' },
  { id: 'down', label: 'เดินลง', def: 'KeyS' },
  { id: 'right', label: 'เดินขวา', def: 'KeyD' },
  { id: 'q', label: 'สกิลช่อง Q', def: 'KeyQ' },
  { id: 'e', label: 'สกิลช่อง E', def: 'KeyE' },
  { id: 'r', label: 'อัลติ (ช่อง R)', def: 'KeyR' },
  { id: 'dash', label: 'แดช', def: 'Space' },
  { id: 'hp', label: 'ยา HP', def: 'Digit1' },
  { id: 'mp', label: 'ยา MP', def: 'Digit2' },
  { id: 'auto', label: 'เปิด/ปิด Auto', def: 'KeyF' },
  { id: 'scroll', label: 'ม้วนกลับเมือง', def: 'KeyG' },
  { id: 'mount', label: 'ขึ้น/ลงสัตว์ขี่', def: 'KeyZ' },
  { id: 'bag', label: 'กระเป๋า', def: 'KeyI' },
  { id: 'skills', label: 'หน้าต่างสกิล', def: 'KeyK' },
  { id: 'map', label: 'แผนที่', def: 'KeyM' },
  { id: 'help', label: 'ช่วยเหลือ', def: 'KeyH' },
  { id: 'talk', label: 'คุย / ใช้', def: 'KeyT' },
  { id: 'chat', label: 'พิมพ์แชท', def: 'Enter' },
];

/** Keys that can't be taken: Esc (menus, and cancels picking a key). */
export const RESERVED_KEYS = new Set(['Escape']);

const STORE = 'multiverse-keybinds';
/** Action id → the key chosen ('' = none). Missing = the default. */
let custom: Record<string, string> = load();
/** Pressed key → the default key of the action it is bound to; built from `custom`. */
let toDefault = new Map<string, string>();
/** Default keys whose action now sits elsewhere or has no key (pressing them does nothing). */
let freed = new Set<string>();
const listeners = new Set<() => void>();

function load(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, string> = {};
    for (const a of KEY_ACTIONS) {
      const v = (raw as Record<string, unknown>)[a.id];
      if (typeof v === 'string' && v.length <= 32 && !RESERVED_KEYS.has(v)) out[a.id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function rebuild(): void {
  toDefault = new Map();
  freed = new Set();
  for (const a of KEY_ACTIONS) {
    // From the player's choice itself, not keyOf: the /admin switch is checked on every key press instead.
    const k = custom[a.id] ?? a.def;
    if (k) toDefault.set(k, a.def);
    if (k !== a.def) freed.add(a.def);
  }
}
rebuild();

function save(): void {
  try {
    if (Object.keys(custom).length) localStorage.setItem(STORE, JSON.stringify(custom));
    else localStorage.removeItem(STORE);
  } catch { /* private mode: kept for this visit only */ }
  rebuild();
  for (const fn of listeners) fn();
}

const on = (): boolean => currentBalance().fxLayer.keyRebind;

/** The key an action is on now ('' = none). With the /admin switch off, always the default. */
export function keyOf(id: string): string {
  const a = KEY_ACTIONS.find((x) => x.id === id);
  if (!a) return '';
  return on() ? custom[id] ?? a.def : a.def;
}

/**
 * The key the game should see for a key really pressed: the default key of the action it is bound to, null when it
 * is a default key whose action moved (it does nothing now), else the key itself (arrows, Esc, Tab...).
 */
export function gameKey(code: string): string | null {
  if (!on()) return code;
  const d = toDefault.get(code);
  if (d) return d;
  return freed.has(code) ? null : code;
}

/** Whether this key is bound to a game action (touch/device.ts: a key press means "playing with a keyboard"). */
export const isBoundKey = (code: string): boolean => on() && toDefault.has(code);

/**
 * Puts an action on a key. Another action already on that key loses it (owner: no key until set again); its label
 * is returned so the window can say so.
 */
export function bindKey(id: string, code: string): string | null {
  let lost: string | null = null;
  for (const a of KEY_ACTIONS) {
    if (a.id !== id && keyOf(a.id) === code) {
      custom[a.id] = '';
      lost = a.label;
    }
  }
  const a = KEY_ACTIONS.find((x) => x.id === id);
  if (a && code === a.def) delete custom[id];
  else custom[id] = code;
  tidy();
  save();
  return lost;
}

/** Leaves an action with no key. */
export function clearKey(id: string): void {
  custom[id] = '';
  save();
}

/** Every action back on its default key. */
export function resetKeys(): void {
  custom = {};
  save();
}

/** Drops entries that are just the default again. */
function tidy(): void {
  for (const a of KEY_ACTIONS) if (custom[a.id] === a.def) delete custom[a.id];
}

/** Called whenever the keys change (the skill bar redraws its labels, Input lets go of held keys). */
export function onKeysChange(fn: () => void): void {
  listeners.add(fn);
}

/** How a key is shown: 'KeyQ' → 'Q', 'Digit1' → '1', 'Space' → 'SPACE', '' → '—'. */
export function keyLabel(code: string): string {
  if (!code) return '—';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `Num${code.slice(6)}`;
  const names: Record<string, string> = {
    Space: 'SPACE', Enter: 'ENTER', Tab: 'TAB', Backspace: 'BKSP', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT',
    ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT', CapsLock: 'CAPS',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=',
    BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  };
  return names[code] ?? code.replace(/^(Numpad|Key)/, '');
}
