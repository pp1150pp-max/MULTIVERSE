// The landing page (landing.html, docs/systems/landing.md): close beta countdown, latest notes, TH/EN.
// Times and notes come from GET /api/landing (set in /admin → มีอะไรใหม่); without the server the code's window is used.
// ?now=2026-12-01T12:00:00Z pretends the clock reads that time (to check the before / open / ended states).
import { LANDING_API, LANDING_DEFAULT, type LandingView } from '../shared/landing';
import type { NewsNote } from '../shared/news';

type Lang = 'th' | 'en';
/** The game's own key (src/client/i18n.ts): a pick here carries into the game on the same site. */
const PREF_KEY = 'multiverse-lang';
const PLAY_HOST = 'play.multiverse-game.com';

const EN: Record<string, string> = {
  skip: 'Skip to content',
  'nav.home': 'Home', 'nav.news': 'News', 'nav.classes': 'Classes', 'nav.world': 'World', 'nav.bosses': 'Bosses', 'nav.systems': 'Features',
  play: 'Play now',
  h1: 'MULTIVERSE, an online action RPG',
  tag: 'An online action RPG in a cut-paper world · <b>free to play in your browser</b> on PC and mobile',
  'cd.d': 'days', 'cd.h': 'hours', 'cd.m': 'min', 'cd.s': 'sec',
  free: 'Nothing to download · play as a guest right away',
  'news.h': 'Latest news and updates', 'news.loading': 'Loading news…', 'news.none': 'No news yet', 'news.fail': 'News could not be loaded right now. The latest notes are in the game under "What’s new"', 'news.thai': 'Notes are written in Thai',
  'start.h': 'Start playing in a minute', 'start.1': 'Opens in your browser, nothing to install', 'start.2': 'Play as a guest or sign in with Google', 'start.3': 'Everyone shares one server: bring friends and form a party',
  'cls.h': 'Pick one of three classes',
  'cls.sword': 'Swordsman', 'cls.sword.p': 'Close range and tough. Passive "Piercing Slash": dash through monsters and cut every one you pass',
  'cls.gun': 'Gunslinger', 'cls.gun.p': 'Long range and landmines. Passive "Run and Gun": basic attacks without stopping',
  'cls.mage': 'Mage', 'cls.mage.p': 'Wide elemental spells. Passive "Dimension Step": the dash lands at its end at once',
  'world.h': 'Two floors of the multiverse, Lv 1–80',
  'f1.h': 'Floor 1 · Nexus City', 'f2.h': 'Floor 2 · Dimensional Harbour',
  'z.forest': 'Emerald Forest', 'z.marsh': 'Misty Marsh', 'z.snow': 'Frost Reach', 'z.volcano': 'Ashen Isle',
  'z.beach': 'Shipwreck Beach', 'z.cove': "Smugglers' Cove", 'z.grave': 'Ghost Ship Graveyard', 'z.kraken': 'Kraken Maelstrom',
  'boss.h': '8 bosses, summoned with keys: more keys, harder fights, bigger rewards',
  'b.bear': 'Forest Bear', 'b.witch': 'Bog Witch', 'b.yeti': 'Yeti', 'b.heart': 'Volcano Heart',
  'b.crab': 'Giant Cannon Crab', 'b.pegleg': 'Peg-Leg Captain', 'b.ghost': 'Ghost Captain', 'b.kraken': 'Kraken',
  'sys.h': 'Features',
  'sys.party': '3-player parties', 'sys.party.p': 'Drops shared by the team, EXP split with those on the map',
  'sys.elem': '5 elements', 'sys.elem.p': 'Water, fire, poison, lightning, wind: 10 reactions when they meet',
  'sys.forge': 'Enhancing + cards', 'sys.forge.p': 'Enhance gear, drill sockets, slot cards that monsters drop',
  'sys.market': 'Market and trade', 'sys.market.p': 'List items for 48 hours, or trade with a friend directly',
  'sys.auto': 'Auto Play', 'sys.auto.p': 'Keeps farming on the server even if you drop, with a summary',
  'sys.dodge': 'Perfect Dodge', 'sys.dodge.p': 'Dash at the right moment: longer invincibility and more damage',
  'sys.sets': 'Floor 2 item sets', 'sys.sets.p': '4 sets with bonuses at 3, 6 and 9 pieces',
  'sys.cos': 'Cosmetics', 'sys.cos.p': 'Wings, mounts, pets, auras, dash effects',
  'close.h': 'Ready to cross over?',
  privacy: 'Privacy policy', terms: 'Terms of use',
};
const TEXT = {
  th: { before: 'Close Beta เริ่มในอีก', open: 'Close Beta เปิดแล้ว! เหลือเวลาอีก', ended: 'Close Beta จบแล้ว ขอบคุณทุกคนที่มาร่วมทดสอบ', zone: 'น. (เวลาไทย)', none: 'ยังไม่มีประกาศ', fail: 'โหลดข่าวไม่ได้ในตอนนี้ ดูประกาศล่าสุดได้ในเกมที่ปุ่ม "มีอะไรใหม่"', menuOpen: 'เปิดเมนู', menuClose: 'ปิดเมนู', langBtn: 'Switch to English' },
  en: { before: 'Close Beta starts in', open: 'Close Beta is live! Time left', ended: 'Close Beta has ended. Thank you for testing', zone: '(Thai time, UTC+7)', none: EN['news.none'], fail: EN['news.fail'], menuOpen: 'Open menu', menuClose: 'Close menu', langBtn: 'เปลี่ยนเป็นภาษาไทย' },
};

function readPref(): Lang {
  try {
    const v = localStorage.getItem(PREF_KEY);
    if (v === 'th' || v === 'en') return v;
  } catch {
    // storage blocked
  }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((l) => /^th\b/i.test(l ?? '')) ? 'th' : 'en';
}

let lang: Lang = readPref();
let view: LandingView = { start: LANDING_DEFAULT.start, end: LANDING_DEFAULT.end, news: [], english: true };
let newsLoaded = false;
/** The server answered; false = it could not be reached (say so instead of "no news"). */
let newsOk = false;
const thai = new Map<Element, string>();
const $ = (id: string) => document.getElementById(id)!;

const THAI_TITLE = document.title;

function applyLang(): void {
  document.documentElement.lang = lang;
  document.title = lang === 'en' ? 'MULTIVERSE — Close Beta, 28 Nov – 5 Dec 2026' : THAI_TITLE;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    if (!thai.has(el)) thai.set(el, el.textContent ?? '');
    el.textContent = lang === 'en' ? EN[el.dataset.i18n!] ?? thai.get(el)! : thai.get(el)!;
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    if (!thai.has(el)) thai.set(el, el.innerHTML);
    el.innerHTML = lang === 'en' ? EN[el.dataset.i18nHtml!] ?? thai.get(el)! : thai.get(el)!;
  });
  const btn = $('lang');
  btn.textContent = lang === 'en' ? 'TH' : 'EN';
  btn.setAttribute('aria-label', TEXT[lang].langBtn);
  const menu = $('menu');
  menu.setAttribute('aria-label', menu.getAttribute('aria-expanded') === 'true' ? TEXT[lang].menuClose : TEXT[lang].menuOpen);
  drawDates();
  drawNews();
  tick();
}

// ---- countdown
const skewQ = new URLSearchParams(location.search).get('now');
const skew = skewQ && !Number.isNaN(Date.parse(skewQ)) ? Date.parse(skewQ) - Date.now() : 0;
const pad = (n: number) => String(n).padStart(2, '0');
let lastState = '';

function tick(): void {
  const now = Date.now() + skew;
  const state = now < view.start ? 'before' : now < view.end ? 'open' : 'ended';
  const left = Math.max(0, (state === 'before' ? view.start : view.end) - now);
  const s = Math.floor(left / 1000);
  const cd = $('cd');
  cd.dataset.state = state;
  $('cd-d').textContent = String(Math.floor(s / 86400));
  $('cd-h').textContent = pad(Math.floor(s / 3600) % 24);
  $('cd-m').textContent = pad(Math.floor(s / 60) % 60);
  $('cd-s').textContent = pad(s % 60);
  // Screen readers: the time left in words, refreshed once a minute (the ticking digits are hidden from them).
  const sr = state === 'ended' ? '' : lang === 'th'
    ? `${Math.floor(s / 86400)} วัน ${Math.floor(s / 3600) % 24} ชั่วโมง ${Math.floor(s / 60) % 60} นาที`
    : `${Math.floor(s / 86400)} days ${Math.floor(s / 3600) % 24} hours ${Math.floor(s / 60) % 60} minutes`;
  const srEl = $('cd-sr');
  if (srEl.textContent !== sr) srEl.textContent = sr;
  // The label is the live region: it changes only with the state, so screen readers aren't told every second.
  const label = TEXT[lang][state];
  if (lastState !== state + lang) {
    $('cd-label').textContent = label;
    lastState = state + lang;
  }
}

function fmt(at: number, withYear: boolean): string {
  const loc = lang === 'th' ? 'th-TH-u-ca-buddhist' : 'en-GB';
  return new Intl.DateTimeFormat(loc, { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(at);
}
function hm(at: number): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
}

function drawDates(): void {
  const sameYear = fmt(view.start, true).slice(-4) === fmt(view.end, true).slice(-4);
  const sameTime = hm(view.start) === hm(view.end);
  const a = `${fmt(view.start, !sameYear)}${sameTime ? '' : ` ${hm(view.start)}`}`;
  const b = `${fmt(view.end, true)}${sameTime ? '' : ` ${hm(view.end)}`}`;
  $('cd-dates').textContent = sameTime ? `${a} – ${b} · ${hm(view.start)} ${TEXT[lang].zone}` : `${a} – ${b} ${TEXT[lang].zone}`;
}

// ---- news (text only, never HTML: the notes come from the database)
function drawNews(): void {
  if (!newsLoaded) return;
  const list = $('news-list');
  if (!view.news.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = newsOk ? TEXT[lang].none : TEXT[lang].fail;
    list.replaceChildren(li);
    return;
  }
  list.replaceChildren(...view.news.map((n: NewsNote) => {
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.dateTime = new Date(n.at).toISOString();
    time.textContent = fmt(n.at, true);
    const h = document.createElement('h3');
    h.textContent = n.title;
    h.lang = 'th';
    const p = document.createElement('p');
    p.lang = 'th';
    p.textContent = n.lines.slice(0, 3).join(' · ');
    li.append(time, h, p);
    return li;
  }));
}

/** Same server as the game → its own /api; the page on another multiverse-game.com host → the game server's. */
function apiUrl(): string {
  const h = location.hostname;
  return h !== PLAY_HOST && h.endsWith('multiverse-game.com') ? `https://${PLAY_HOST}${LANDING_API}` : LANDING_API;
}

async function load(): Promise<void> {
  try {
    const r = await fetch(apiUrl(), { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    const v = (await r.json()) as LandingView;
    if (Number.isFinite(v.start) && Number.isFinite(v.end) && Array.isArray(v.news)) {
      view = v;
      newsOk = true;
    }
    if (v.english === false) {
      // English is off in /admin: Thai only (the game does the same).
      $('lang').hidden = true;
      if (lang !== 'th') {
        lang = 'th';
        applyLang();
      }
    }
  } catch {
    // No server (or it is down): the code's window, no notes.
  }
  newsLoaded = true;
  drawDates();
  drawNews();
  tick();
}

// ---- nav: solid once scrolled, full-screen menu on phones
const nav = document.querySelector('.nav')!;
const onScroll = () => nav.classList.toggle('solid', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true });
onScroll();
const menu = $('menu');
const links = $('nav-links');
const setMenu = (open: boolean) => {
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? TEXT[lang].menuClose : TEXT[lang].menuOpen);
  links.classList.toggle('open', open);
};
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
links.addEventListener('click', (e) => (e.target as HTMLElement).closest('a') && setMenu(false));
addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

// The nav marks the section in view (aria-current), checked on scroll.
const navLinks = [...links.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
const targets = navLinks.map((a) => document.getElementById(a.hash.slice(1))).filter((t): t is HTMLElement => !!t && t.id !== 'top');
function markCurrent(): void {
  // A line just under the fixed bar: a short section still counts once its top passes it.
  const line = 68 + Math.min(160, innerHeight * 0.2);
  let cur = 'top';
  for (const t of targets) if (t.getBoundingClientRect().top <= line) cur = t.id;
  for (const a of navLinks) {
    if (a.hash === `#${cur}`) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  }
}
addEventListener('scroll', markCurrent, { passive: true });
addEventListener('resize', markCurrent);
markCurrent();

$('lang').addEventListener('click', () => {
  lang = lang === 'th' ? 'en' : 'th';
  try {
    localStorage.setItem(PREF_KEY, lang);
  } catch {
    // storage blocked: this page only
  }
  applyLang();
});

applyLang();
setInterval(tick, 1000);
void load();
