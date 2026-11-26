// Building blocks of the settings page (เมนู → ตั้งค่า, src/client/sysmenu.ts): one row = name on the left, control on the
// right (drop-down, ON/OFF switch or slider), with an optional small note under it. Drawn with CSS only
// (src/styles/menu-system.css `.set-*`). Every control hands the keyboard back to the game once used (the game ignores
// keys while a form field has focus).

/** A row: name left, control right, note (if any) under both. */
export function setRow(label: string, control: HTMLElement, note?: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'set-row';
  const name = document.createElement('span');
  name.className = 'set-name';
  name.textContent = label;
  const ctl = document.createElement('div');
  ctl.className = 'set-ctl';
  ctl.append(control);
  row.append(name, ctl);
  if (note) {
    const n = document.createElement('div');
    n.className = 'set-note';
    n.textContent = note;
    row.append(n);
  }
  return row;
}

/** A section title inside a tab (e.g. the sound groups). */
export function setSub(text: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = 'set-sub';
  d.textContent = text;
  return d;
}

/** ON/OFF switch. `pick` gets the new state; the caller redraws. */
export function setSwitch(on: boolean, pick: (on: boolean) => void, disabled = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `set-switch${on ? ' on' : ''}`;
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-checked', String(on));
  b.disabled = disabled;
  const t = document.createElement('span');
  t.className = 'set-switch-text';
  t.textContent = on ? 'เปิด' : 'ปิด';
  const knob = document.createElement('i');
  b.append(t, knob);
  b.onclick = () => {
    pick(!on);
    b.blur();
  };
  return b;
}

/** Drop-down. Options: [value, text, allowed?]. */
export function setSelect<T extends string | number>(opts: Array<[T, string, boolean?]>, value: T, pick: (v: T) => void): HTMLSelectElement {
  const s = document.createElement('select');
  s.className = 'set-select';
  for (const [v, text, allowed] of opts) {
    const o = document.createElement('option');
    o.value = String(v);
    o.textContent = text;
    o.disabled = allowed === false;
    o.selected = v === value;
    s.append(o);
  }
  s.onchange = () => {
    const hit = opts.find(([v]) => String(v) === s.value);
    if (hit) pick(hit[0]);
    s.blur();
  };
  return s;
}

/** 0–100 slider with its number. `input` fires while dragging, `done` once let go. */
export function setSlider(value: number, input: (v: number) => void, done?: () => void): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'set-slider';
  const r = document.createElement('input');
  r.type = 'range';
  r.min = '0';
  r.max = '100';
  r.step = '5';
  r.value = String(value);
  const num = document.createElement('span');
  num.className = 'set-num';
  const paint = () => {
    num.textContent = `${r.value}%`;
    r.style.setProperty('--fill', `${r.value}%`);
  };
  paint();
  r.addEventListener('input', () => {
    paint();
    input(Number(r.value));
  });
  r.addEventListener('change', () => {
    done?.();
    r.blur();
  });
  wrap.append(r, num);
  return wrap;
}
