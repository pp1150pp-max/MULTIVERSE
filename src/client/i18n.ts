// The game's language (owner 2026-11-22, docs/systems/i18n.md). Thai is the source: the code writes Thai everywhere,
// and in English mode a translator swaps every Thai text that reaches the page (text, title, placeholder, alert,
// confirm, server notices) for its English from the dictionary (src/shared/i18n). Thai with no English stays Thai.
// The language is fixed for the page: picking another in เมนู → ตั้งค่า takes effect the next time the game opens.
// Player-written text (names, chat, mail, megaphone) is marked translate="no" and never touched.
import { fill, hasThai, LANG_CONFIG_PATH, Translator, type Lang, type LangConfigResponse } from '../shared/i18n/translator';
import { englishDict } from '../shared/i18n/dict';
import { setLoginLook } from './loginLook';

const PREF_KEY = 'multiverse-lang';
/** The /admin switch as last heard from the server ('0' = English off), so the first frame already knows. */
const ALLOWED_KEY = 'multiverse-lang-allowed';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, v: string): void {
  try {
    localStorage.setItem(key, v);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

/** The browser's own language: Thai → ไทย, anything else → English. */
function browserLang(): Lang {
  const langs = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((l) => /^th\b/i.test(l ?? '')) ? 'th' : 'en';
}

/** The player's pick in this browser, or null when they never picked. */
export function langPref(): Lang | null {
  const v = read(PREF_KEY);
  return v === 'th' || v === 'en' ? v : null;
}

const englishAllowed = (): boolean => read(ALLOWED_KEY) !== '0';

/** The language of this page (fixed until the game is opened again). */
export const LANG: Lang = englishAllowed() ? (langPref() ?? browserLang()) : 'th';

let translator: Translator | null = null;
/** True once startTranslator() ran: only the game page (main.ts) translates; /admin and the tool pages stay Thai. */
let started = false;
const tr = (): Translator => (translator ??= new Translator(englishDict()));

/** A Thai text in the page's language (for text that never reaches the page as text: canvas, WebGL labels). */
export function t(th: string, vars?: Record<string, string | number> | (string | number)[]): string {
  const s = fill(th, vars);
  return started ? tr().tr(s) : s;
}

// ------------------------------------------------------------------ English mode: the page translator

const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
const SKIP = '[translate="no"], script, style, textarea, [contenteditable="true"]';

/** Thai still on screen with no English (deduplicated): `__i18nMisses()` in the console lists them. */
const misses = new Set<string>();

/** Same Thai, other English inside one window (the settings page's "ปิด" / "เปิด" are Off / On, not Close / Open). */
const CONTEXT: [selector: string, dict: Record<string, string>][] = [['#sys-menu .set-pane', { 'ปิด': 'Off', 'เปิด': 'On' }], ['#gfx-panel', { 'ปิด': 'Off' }]];

/** English for a text node or attribute of `el`, or null. */
function english(el: Element | null, text: string): string | null {
  for (const [sel, d] of CONTEXT) {
    const en = el?.closest(sel) ? d[text.trim()] : undefined;
    if (en !== undefined) return text.replace(text.trim(), en);
  }
  return tr().translate(text);
}

function miss(text: string): void {
  const k = text.trim();
  if (misses.has(k) || misses.size > 2000) return;
  misses.add(k);
  console.debug('[i18n] no English:', k);
}

function translateText(n: Text): void {
  const v = n.data;
  if (!hasThai(v) || n.parentElement?.closest(SKIP)) return;
  const out = english(n.parentElement, v);
  // Thai still showing (no English, or only part of it) is listed for __i18nMisses().
  if (out === null || hasThai(out)) miss(v);
  if (out !== null && out !== v) n.data = out;
}

function translateAttrs(el: Element): void {
  if (el.closest(SKIP)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v || !hasThai(v)) continue;
    const out = english(el, v);
    if (out === null || hasThai(out)) miss(v);
    if (out !== null && out !== v) el.setAttribute(a, out);
  }
  if (el instanceof HTMLInputElement && (el.type === 'button' || el.type === 'submit') && hasThai(el.value)) {
    el.value = tr().tr(el.value);
  }
}

function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (el.closest(SKIP)) return;
  translateAttrs(el);
  const it = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE && (n as Element).matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = it.nextNode(); n; n = it.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text);
    else translateAttrs(n as Element);
  }
}

/** English mode only: translates the page now and everything put on it from now on. Call once, first thing. */
export function startTranslator(): void {
  if (LANG !== 'en' || started || typeof document === 'undefined') return;
  started = true;
  document.documentElement.lang = 'en';
  walk(document.documentElement);
  new MutationObserver((recs) => {
    for (const r of recs) {
      if (r.type === 'childList') r.addedNodes.forEach(walk);
      else if (r.type === 'characterData') translateText(r.target as Text);
      else if (r.type === 'attributes') translateAttrs(r.target as Element);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  // Browser dialogs never reach the page.
  const { alert: al, confirm: co, prompt: pr } = window;
  window.alert = (m?: unknown) => al.call(window, typeof m === 'string' ? tr().tr(m) : m);
  window.confirm = (m?: string) => co.call(window, m === undefined ? m : tr().tr(m));
  window.prompt = (m?: string, d?: string) => pr.call(window, m === undefined ? m : tr().tr(m), d);
  (window as unknown as { __i18nMisses: () => string[] }).__i18nMisses = () => [...misses];
}

/**
 * Asks the server whether English is allowed (the /admin switch) and remembers it for the next page. If English was
 * switched off while this page is in English and the game has not been entered yet, the page opens again in Thai.
 */
export async function checkLangAllowed(inGame: () => boolean): Promise<void> {
  try {
    const r = (await (await fetch(`api${LANG_CONFIG_PATH}`)).json()) as LangConfigResponse;
    // The same answer carries the "หน้า login แบบใหม่" switch (src/client/loginLook.ts).
    setLoginLook(r?.loginLook);
    if (typeof r?.english !== 'boolean') return;
    const was = englishAllowed();
    write(ALLOWED_KEY, r.english ? '1' : '0');
    if (was && !r.english && LANG === 'en' && !inGame()) location.reload();
  } catch {
    // Offline or an older server: keep what we knew.
  }
}

// ------------------------------------------------------------------ the row in เมนู → ตั้งค่า → ทั่วไป

/** Whether the language row shows (the /admin switch as last heard). */
export const langRowShown = (): boolean => englishAllowed();
/** The language picked for the next time the game opens (or this page's). */
export const langWanted = (): Lang => langPref() ?? LANG;
/** Picks the language for the next time the game opens. */
export function setLangPref(l: Lang): void {
  write(PREF_KEY, l);
}
/** Names in both languages, never translated, so either reader finds them. */
export const LANG_NAME: Record<Lang, string> = { th: 'ไทย', en: 'English' };
/** The settings row's name and its "next time" note, in both languages (kept here, where the extractor never looks). */
export const LANG_ROW_LABEL = 'ภาษา / Language';
export const LANG_ROW_NOTE = 'มีผลเมื่อเปิดเกมใหม่ / Takes effect when you open the game again';

/**
 * The old one-button language switch (the settings button list used while /admin turns the tabbed page off): click =
 * ไทย ↔ English for the next time the game opens. Hidden while English is off.
 */
export function legacyLangButton(): HTMLButtonElement {
  const b = document.createElement('button');
  b.id = 'sys-lang';
  b.setAttribute('translate', 'no');
  const draw = () => {
    const want = langWanted();
    b.classList.toggle('hidden', !langRowShown());
    b.textContent = want === LANG ? `ภาษา / Language: ${LANG_NAME[want]}` : `ภาษา / Language: ${LANG_NAME[want]} (เปิดเกมใหม่ / reopen game)`;
    b.title = want === LANG ? 'ไทย ↔ English' : 'มีผลเมื่อเปิดเกมใหม่ / Takes effect when you open the game again';
  };
  b.addEventListener('click', () => {
    setLangPref(langWanted() === 'th' ? 'en' : 'th');
    draw();
  });
  draw();
  return b;
}

// ------------------------------------------------------------------ player-written text

/** Marks an element as players' own words (names, chat, mail): the translator never touches it. */
export function noTranslate<T extends HTMLElement>(e: T): T {
  e.translate = false;
  return e;
}

/** What a player said, as a span the translator leaves alone. */
export function said(text: string): HTMLSpanElement {
  const s = document.createElement('span');
  s.translate = false;
  s.textContent = text;
  return s;
}
