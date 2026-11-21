// Tiny DOM helpers for the property boxes the PR 7 tools return from `Tool.inspector` (the page's own `h` is not visible to a tool).
export type Kid = Node | string | null | false | undefined;
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') e.className = String(v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, String(v));
  }
  e.append(...kids.filter((k): k is Node | string => !!k));
  return e;
}
const round3 = (n: number): number => Math.round(n * 1000) / 1000;
/** A labelled number box that calls `set` once the value is typed in (one undo step per edit). */
export function numField(label: string, value: number, set: (n: number) => void, step = 0.1, min?: number, max?: number): HTMLElement {
  const i = el('input', { type: 'number', step, value: round3(value), ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) });
  i.addEventListener('change', () => { const n = Number(i.value); if (Number.isFinite(n)) set(n); });
  return el('label', {}, label, i);
}
export function selectField(label: string, value: string, options: [string, string][], set: (v: string) => void): HTMLElement {
  const s = el('select', { onchange: () => set(s.value) }, ...options.map(([v, t]) => el('option', { value: v, selected: v === value }, t)));
  return el('label', {}, label, s);
}
export const btn = (text: string, onclick: () => void, title = ''): HTMLButtonElement => el('button', { onclick, title }, text);
export const note = (text: string): HTMLElement => el('div', { class: 'muted me-hint' }, text);
