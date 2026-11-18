// Layout helpers for the admin page: they only change how cards look and where the page scrolls,
// never what a card sends to the server.

/** A card's note longer than this is cut to one line with a "อ่านต่อ" toggle. */
const LONG_NOTE = 140;

/** Cuts long notes (a plain-text `.muted` line straight inside a card) to one line with "อ่านต่อ". */
function clampNotes(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.card > .muted, .card > section > .muted').forEach((el) => {
    // Plain text only: a note with parts in it is usually a live preview (e.g. a skill's MP by level).
    if (el.dataset.clamp || el.children.length || el.closest('.save-bar')) return;
    if ((el.textContent ?? '').length < LONG_NOTE) return;
    el.dataset.clamp = '1';
    el.classList.add('clamp');
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'more';
    more.textContent = 'อ่านต่อ';
    more.addEventListener('click', () => {
      const open = el.classList.toggle('open');
      more.textContent = open ? 'ย่อ' : 'อ่านต่อ';
    });
    el.after(more);
  });
}

/** Watches the page's main area: every card drawn later (most tabs load from the server first) gets its long notes cut. */
export function watchCards(view: HTMLElement): void {
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    // A timer, not a frame: frames do not run in a tab in the background.
    setTimeout(() => {
      queued = false;
      clampNotes(view);
    }, 30);
  }).observe(view, { childList: true, subtree: true });
}

/** Scrolls to the card (or sub-heading) whose title starts with `title` and flashes it; waits for a tab still loading. */
export function jumpTo(view: HTMLElement, title: string, tries = 40): void {
  const want = title.trim();
  const head = [...view.querySelectorAll<HTMLElement>('.card h2, .card h3')]
    .find((x) => (x.textContent ?? '').trim().startsWith(want));
  if (!head) {
    if (tries > 0) setTimeout(() => jumpTo(view, title, tries - 1), 100);
    return;
  }
  const card = head.closest<HTMLElement>('.card') ?? head;
  card.classList.remove('folded');
  head.scrollIntoView({ behavior: 'smooth', block: 'start' });
  card.classList.remove('flash');
  void card.offsetWidth;
  card.classList.add('flash');
}

/** Every heading in the open tab that contains `q` (cards' h2 and their h3), for the search box's "ในหน้านี้". */
export function headsOnPage(view: HTMLElement, q: string): string[] {
  const out: string[] = [];
  for (const x of view.querySelectorAll<HTMLElement>('.card h2, .card h3')) {
    const t = (x.textContent ?? '').trim();
    const card = x.closest('.card');
    // A heading matches by its own text, a card's h2 also by anything written in the card (labels, notes).
    const hay = (x.tagName === 'H2' && card ? card.textContent ?? '' : t).toLowerCase();
    if (t && hay.includes(q) && !out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * A long tab of cards (the balance tab): a row of jump buttons on top, cards fold by their title,
 * and a card edited since the last save gets a dot. Call `refreshToc` after the cards are drawn;
 * `clearDirty` after a save or a cancel; set `box.dataset.clean = '1'` while nothing differs from what is saved.
 */
export function foldable(box: HTMLElement): { toc: HTMLElement; refreshToc: () => void; clearDirty: () => void } {
  box.classList.add('foldable');
  const toc = document.createElement('nav');
  toc.className = 'toc';
  box.addEventListener('click', (e) => {
    const head = (e.target as HTMLElement).closest('h2');
    const card = head?.parentElement;
    if (!head || !card?.classList.contains('card') || card.classList.contains('save-bar')) return;
    card.classList.toggle('folded');
    refreshToc();
  });
  const markDirty = (e: Event): void => {
    const card = (e.target as HTMLElement).closest('.card');
    // The tab's own handler runs first and sets data-clean when the draft matches what is saved.
    if (!card || card.classList.contains('save-bar') || box.dataset.clean === '1') return;
    card.classList.add('dirty');
    refreshToc();
  };
  box.addEventListener('input', markDirty);
  box.addEventListener('change', markDirty);
  const cards = (): HTMLElement[] => [...box.querySelectorAll<HTMLElement>(':scope > .card:not(.save-bar)')];
  function refreshToc(): void {
    toc.replaceChildren(...cards().map((c) => {
      const title = c.querySelector(':scope > h2')?.textContent?.trim() ?? '';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = c.classList.contains('dirty') ? 'chip dirty' : 'chip';
      b.textContent = title;
      b.addEventListener('click', () => {
        c.classList.remove('folded');
        c.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return b;
    }));
    const n = cards().filter((c) => c.classList.contains('dirty')).length;
    const all = document.createElement('button');
    all.type = 'button';
    all.className = 'chip ghost';
    const anyOpen = cards().some((c) => !c.classList.contains('folded'));
    all.textContent = anyOpen ? '▴ พับทั้งหมด' : '▾ กางทั้งหมด';
    all.addEventListener('click', () => {
      cards().forEach((c) => c.classList.toggle('folded', anyOpen));
      refreshToc();
    });
    toc.append(all);
    toc.dataset.dirty = String(n);
  }
  return {
    toc,
    refreshToc,
    clearDirty: () => {
      cards().forEach((c) => c.classList.remove('dirty'));
      refreshToc();
    },
  };
}
