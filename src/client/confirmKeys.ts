// Enter / Esc for the game's confirm boxes (owner 2026-11-28): Enter presses the gold confirm button, Esc presses cancel.
// Covers the shared confirm box (#confirm: throwing away, unsocketing a card, skill refunds, bag expansion...), the amount
// box (#amount), the merchant's prompts in the talk window (.ns-modal) and the cash shop purchase box (.cash-modal).
// While one is open the keys are swallowed here (capture phase), so Enter never opens the chat and Esc never closes
// another window or opens the menu. Switch: Balance.confirmKeys (off = keys behave as before, buttons only).
import { currentBalance } from '../shared/balance';

interface Dialog {
  root: HTMLElement;
  yes: HTMLElement | null;
  no: HTMLElement | null;
}

const byId = (id: string): HTMLElement | null => document.getElementById(id);

/** The topmost open confirm-style box, if any. */
function openDialog(): Dialog | null {
  const open = (root: HTMLElement | null) => (root && !root.classList.contains('hidden') ? root : null);
  const amount = open(byId('amount'));
  if (amount) return { root: amount, yes: byId('amount-ok'), no: byId('amount-cancel') };
  const confirm = open(byId('confirm'));
  if (confirm) return { root: confirm, yes: byId('confirm-yes'), no: byId('confirm-no') };
  const ns = open(document.querySelector<HTMLElement>('.ns-modal'));
  if (ns) {
    const btns = ns.querySelectorAll<HTMLElement>('.ns-row button');
    return { root: ns, yes: btns[0] ?? null, no: btns[btns.length - 1] ?? null };
  }
  const cash = open(document.querySelector<HTMLElement>('.cash-modal'));
  const row = cash?.querySelector<HTMLElement>('.cash-dialog-btns');
  if (cash && row) {
    const btns = row.querySelectorAll<HTMLElement>('button');
    const last = btns[btns.length - 1] ?? null;
    // After a purchase the box only offers "close": Enter closes it, never buys again.
    return { root: cash, yes: row.dataset.done ? last : btns[0] ?? null, no: last };
  }
  return null;
}

const editable = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

/** Enter was acted on a moment ago: a second tap must not answer the next box too. */
let lastActed = 0;
const GUARD_MS = 300;

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== 'Escape') return;
  if (!currentBalance().confirmKeys) return;
  if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
  const d = openDialog();
  if (!d) return;
  const target = e.target as HTMLElement | null;
  // Typing somewhere else (chat, a search box) keeps its own keys; typing inside the box itself is the box's.
  if (editable(target) && !d.root.contains(target)) return;
  // Enter on a focused button inside the box: let that button do its own thing (it may be Cancel), only keep the game out of it.
  if (e.key === 'Enter' && target instanceof HTMLButtonElement && d.root.contains(target)) {
    e.stopPropagation();
    return;
  }
  e.preventDefault();
  e.stopImmediatePropagation();
  if (e.repeat) return;
  const now = performance.now();
  if (now - lastActed < GUARD_MS) return;
  const btn = e.key === 'Enter' ? d.yes : d.no;
  if (!btn || (btn instanceof HTMLButtonElement && btn.disabled)) return;
  lastActed = now;
  btn.click();
}, true);
