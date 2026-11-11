// Imported first by every page (game, /admin, dev benches): no browser right-click menu anywhere,
// except in text fields (copy/paste), and the usual DevTools / view-source shortcuts blocked.
// shortcut: only deters casual use; the browser's own menu bar still opens DevTools.
window.addEventListener('contextmenu', (e) => {
  if (!(e.target as HTMLElement | null)?.closest?.('input, textarea')) e.preventDefault();
});
window.addEventListener('keydown', (e) => {
  const k = e.key.toUpperCase();
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && 'IJC'.includes(k) && k.length === 1) || (e.ctrlKey && k === 'U')) e.preventDefault();
}, true);
