// The per-browser switch for the papercraft sword knight trial (owner 2026-11-16: only the owner looks at it while
// it is being tried; everyone else keeps the old sprite). Set from /admin → หน้าตา → นักดาบกระดาษ (same site, so
// the game reads the same storage). Takes effect when a character is next drawn (reload, or change zone).
const KEY = 'multiverse-paper-sword';

export function paperSwordOn(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setPaperSword(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the switch just stays off.
  }
}
