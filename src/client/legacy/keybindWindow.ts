// LEGACY (owner 2026-11-26): the old separate window, used only while /admin turns the tabbed settings page off
// (fxLayer.settingsTabs). Kept as it was before the tabs; the tabbed page draws the same settings in sysmenu.ts.
// The players' key window (owner 2026-11-21): เมนู → ตั้งค่า → ตั้งค่าปุ่ม. Click an action, press the new key (Esc
// cancels). A key another action had leaves that action with no key, and the window says so. "รีเซ็ตทั้งหมด" puts every
// key back. Kept in this browser (src/client/keybinds.ts).
import { bindKey, clearKey, KEY_ACTIONS, keyLabel, keyOf, RESERVED_KEYS, resetKeys } from '../keybinds';

const CSS = `
#keybind-panel { right: 168px; top: 56px; width: min(340px, 92vw); max-height: 80vh; display: flex; flex-direction: column; font-size: 13px; z-index: 6; }
#keybind-panel .kb-list { overflow-y: auto; margin-top: 6px; }
#keybind-panel .kb-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
#keybind-panel .kb-name { flex: 1; }
#keybind-panel .kb-key { min-width: 86px; padding: 3px 8px; font-weight: 600; }
#keybind-panel .kb-key.none { color: var(--ink-dim); }
#keybind-panel .kb-key.wait { outline: 2px solid var(--gold); color: var(--gold); }
#keybind-panel .kb-clear { padding: 3px 7px; }
#keybind-panel .kb-msg { min-height: 1.4em; margin-top: 6px; font-size: 12px; color: #ffb35a; }
#keybind-panel .kb-msg.ok { color: var(--ink-dim); }
#keybind-panel .kb-foot { display: flex; gap: 6px; margin-top: 6px; }
#keybind-panel .kb-foot button { flex: 1; }
`;

let panel: HTMLDivElement | null = null;
/** The action waiting for its new key, or null. */
let waiting: string | null = null;
let msg = '';
let msgWarn = false;
let render = (): void => {};

function build(): HTMLDivElement | null {
  const hud = document.getElementById('hud');
  if (!hud) return null;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const el = document.createElement('div');
  el.id = 'keybind-panel';
  el.className = 'panel hidden';
  hud.append(el);

  const close = (): void => {
    waiting = null;
    el.classList.add('hidden');
  };

  render = () => {
    el.replaceChildren();
    const head = document.createElement('div');
    head.className = 'panel-head';
    const title = document.createElement('span');
    title.textContent = 'ตั้งค่าปุ่ม';
    const x = document.createElement('button');
    x.textContent = '✕';
    x.onclick = close;
    head.append(title, x);

    const list = document.createElement('div');
    list.className = 'kb-list';
    for (const a of KEY_ACTIONS) {
      const row = document.createElement('div');
      row.className = 'kb-row';
      const name = document.createElement('span');
      name.className = 'kb-name';
      name.textContent = a.label;
      const key = document.createElement('button');
      const code = keyOf(a.id);
      key.className = `kb-key${code ? '' : ' none'}${waiting === a.id ? ' wait' : ''}`;
      key.textContent = waiting === a.id ? 'กดปุ่มใหม่…' : code ? keyLabel(code) : 'ไม่มีปุ่ม';
      key.title = 'คลิกแล้วกดปุ่มที่ต้องการ (Esc = ยกเลิก)';
      key.onclick = () => {
        waiting = waiting === a.id ? null : a.id;
        msg = waiting ? `กดปุ่มใหม่สำหรับ "${a.label}" (Esc = ยกเลิก)` : '';
        msgWarn = false;
        render();
        key.blur();
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
        render();
      };
      row.append(name, key, clear);
      list.append(row);
    }

    const note = document.createElement('div');
    note.className = `kb-msg${msgWarn ? '' : ' ok'}`;
    note.textContent = msg || 'ปุ่มเมาส์ Esc และปุ่มบนจอมือถือเปลี่ยนไม่ได้ · ลูกศรเดินได้เสมอ · จำไว้ในเครื่องนี้';

    const foot = document.createElement('div');
    foot.className = 'kb-foot';
    const reset = document.createElement('button');
    reset.textContent = 'รีเซ็ตทั้งหมด';
    reset.onclick = () => {
      resetKeys();
      waiting = null;
      msg = 'คืนปุ่มทั้งหมดเป็นค่าเริ่มต้นแล้ว';
      msgWarn = false;
      render();
    };
    const done = document.createElement('button');
    done.className = 'primary';
    done.textContent = 'เสร็จ';
    done.onclick = close;
    foot.append(reset, done);

    el.append(head, list, note, foot);
  };

  // Picking a key: caught before the game sees it, so the key pressed does nothing else.
  window.addEventListener('keydown', (e) => {
    if (el.classList.contains('hidden')) return;
    if (!waiting) {
      if (e.code === 'Escape') close();
      return;
    }
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
    } else {
      const label = KEY_ACTIONS.find((a) => a.id === id)?.label ?? '';
      const lost = bindKey(id, e.code);
      msg = lost
        ? `⚠ ปุ่ม ${keyLabel(e.code)} ซ้ำกับ "${lost}" — "${lost}" ไม่มีปุ่มแล้ว ตั้งใหม่ได้`
        : `"${label}" ใช้ปุ่ม ${keyLabel(e.code)} แล้ว`;
      msgWarn = !!lost;
    }
    render();
  }, true);
  return el;
}

/** Opens (or closes) the window, built the first time. */
export function toggleKeybindPanel(show?: boolean): void {
  panel ??= build();
  if (!panel) return;
  waiting = null;
  msg = '';
  render();
  panel.classList.toggle('hidden', show === undefined ? !panel.classList.contains('hidden') : !show);
}
