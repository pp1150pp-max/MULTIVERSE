// The players' keys (owner 2026-11-21): the ปุ่ม tab of เมนู → ตั้งค่า (src/client/sysmenu.ts; until 2026-11-26 a window
// of its own). Click an action, press the new key (Esc cancels). A key another action had leaves that action with no key,
// and the tab says so. "รีเซ็ตทั้งหมด" puts every key back. Kept in this browser (src/client/keybinds.ts).
import { bindKey, clearKey, KEY_ACTIONS, keyLabel, keyOf, RESERVED_KEYS, resetKeys } from './keybinds';

/** The action waiting for its new key, or null. */
let waiting: string | null = null;
let msg = '';
let msgWarn = false;
/** The tab's host while it is drawn, and how to draw it again. */
let host: HTMLElement | null = null;
let redrawTab = (): void => {};
let listening = false;

/** Forgets a half-picked key and the last message (the tab was opened again or left). */
export function resetKeybindTab(): void {
  waiting = null;
  msg = '';
  msgWarn = false;
}

/** Whether a key is being picked right now (the menu's Esc must leave it to the tab). */
export const keybindWaiting = (): boolean => waiting !== null && !!host?.isConnected && host.offsetParent !== null;

/** Draws the key list into `el`; `redraw` draws the whole tab again. */
export function renderKeybindSettings(el: HTMLElement, redraw: () => void): void {
  host = el;
  redrawTab = redraw;
  listen();
  const list = document.createElement('div');
  list.className = 'kb-list';
  for (const a of KEY_ACTIONS) {
    const row = document.createElement('div');
    row.className = 'set-row kb-row';
    const name = document.createElement('span');
    name.className = 'set-name';
    name.textContent = a.label;
    const ctl = document.createElement('div');
    ctl.className = 'set-ctl';
    const key = document.createElement('button');
    const code = keyOf(a.id);
    key.className = `kb-key${code ? '' : ' none'}${waiting === a.id ? ' wait' : ''}`;
    key.textContent = waiting === a.id ? 'กดปุ่มใหม่…' : code ? keyLabel(code) : 'ไม่มีปุ่ม';
    key.title = 'คลิกแล้วกดปุ่มที่ต้องการ (Esc = ยกเลิก)';
    key.onclick = () => {
      waiting = waiting === a.id ? null : a.id;
      msg = waiting ? `กดปุ่มใหม่สำหรับ "${a.label}" (Esc = ยกเลิก)` : '';
      msgWarn = false;
      redraw();
    };
    const clear = document.createElement('button');
    clear.className = 'kb-clear';
    clear.textContent = '✕';
    clear.title = 'เอาปุ่มออก';
    clear.disabled = !code;
    clear.onclick = () => {
      clearKey(a.id);
      waiting = null;
      msg = `"${a.label}" ไม่มีปุ่มแล้ว`;
      msgWarn = false;
      redraw();
    };
    ctl.append(key, clear);
    row.append(name, ctl);
    list.append(row);
  }

  const note = document.createElement('div');
  note.className = `kb-msg${msgWarn ? '' : ' ok'}`;
  note.textContent = msg || 'ปุ่มเมาส์ Esc และปุ่มบนจอมือถือเปลี่ยนไม่ได้ · ลูกศรเดินได้เสมอ · จำไว้ในเครื่องนี้';

  const reset = document.createElement('button');
  reset.className = 'kb-reset';
  reset.textContent = 'รีเซ็ตทั้งหมด';
  reset.onclick = () => {
    resetKeys();
    waiting = null;
    msg = 'คืนปุ่มทั้งหมดเป็นค่าเริ่มต้นแล้ว';
    msgWarn = false;
    redraw();
  };
  el.append(list, note, reset);
}

/** Picking a key: caught before the game sees it, so the key pressed does nothing else. Added once. */
function listen(): void {
  if (listening) return;
  listening = true;
  window.addEventListener('keydown', (e) => {
    if (!keybindWaiting()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    const id = waiting;
    waiting = null;
    if (e.code === 'Escape') {
      msg = '';
    } else if (RESERVED_KEYS.has(e.code)) {
      msg = `ใช้ปุ่ม ${keyLabel(e.code)} ไม่ได้`;
      msgWarn = true;
    } else if (id) {
      const label = KEY_ACTIONS.find((a) => a.id === id)?.label ?? '';
      const lost = bindKey(id, e.code);
      msg = lost
        ? `⚠ ปุ่ม ${keyLabel(e.code)} ซ้ำกับ "${lost}" — "${lost}" ไม่มีปุ่มแล้ว ตั้งใหม่ได้`
        : `"${label}" ใช้ปุ่ม ${keyLabel(e.code)} แล้ว`;
      msgWarn = !!lost;
    }
    redrawTab();
  }, true);
}
