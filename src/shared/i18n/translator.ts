// English for the game (owner 2026-11-22, docs/systems/i18n.md). Thai stays the source of truth: the code keeps
// writing Thai, and in English mode the client swaps each Thai text for its English from the dictionary (en.ts),
// keyed by the Thai text itself. A text with no English stays Thai. Pure: no DOM, no three (the tests and the
// server can use it too).

export type Lang = 'th' | 'en';

const THAI = /[฀-๿]/;

/** Is there any Thai letter in it? (Nothing else is ever looked up.) */
export const hasThai = (s: string): boolean => THAI.test(s);

/** The lookup form of a text: NFC, runs of white space as one space, no space at the ends. */
export function normKey(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim();
}

const PLACEHOLDER = /\{(\w+)\}/g;

interface Template {
  re: RegExp;
  /** The placeholder names in the order they appear in the Thai. */
  names: string[];
  en: string;
  /** Characters of fixed Thai text: the more literal templates are tried first. */
  weight: number;
}

/**
 * Turns Thai into English with one dictionary. A key may hold placeholders (`{0}`, `{name}`): it then
 * matches any text of that shape, and each value it caught is itself looked up again (so an item or
 * monster name inside a server notice is English too) unless the key is in `keep`.
 */
export class Translator {
  private readonly exact = new Map<string, string>();
  private readonly templates: Template[] = [];
  private readonly cache = new Map<string, string | null>();

  constructor(dict: Record<string, string>) {
    for (const [th, en] of Object.entries(dict)) {
      if (!en) continue;
      const key = normKey(th);
      if (!key.match(PLACEHOLDER)) {
        this.exact.set(key, en);
        continue;
      }
      const fixed = key.replace(PLACEHOLDER, '');
      // A key that is all placeholders (or has no Thai left) would catch anything: never a template.
      if (!hasThai(fixed)) continue;
      const names: string[] = [];
      const src = key
        .split(PLACEHOLDER)
        .map((part, i) => {
          if (i % 2 === 1) {
            names.push(part);
            return '(.+?)';
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('');
      this.templates.push({ re: new RegExp(`^${src}$`, 's'), names, en, weight: fixed.length });
    }
    this.templates.sort((a, b) => b.weight - a.weight);
  }

  /** English for one whole text, or null when the dictionary has none (white space at the ends is kept). */
  translate(text: string): string | null {
    if (!hasThai(text)) return null;
    const cached = this.cache.get(text);
    if (cached !== undefined) return cached;
    const key = normKey(text);
    let out = this.lookup(key, 0);
    // "Whirlwind (พายุดาบ)" (English and Thai name side by side) would read "Whirlwind (Whirlwind)".
    if (out !== null) out = out.replace(/^(.+) \(\1\)$/s, '$1');
    if (out !== null) {
      const lead = text.match(/^\s*/)![0];
      const trail = text.slice(lead.length).match(/\s*$/)![0];
      out = lead + out + trail;
    }
    if (this.cache.size > 5000) this.cache.clear();
    this.cache.set(text, out);
    return out;
  }

  /** `translate`, or the Thai itself when there is no English. */
  tr(text: string): string {
    return this.translate(text) ?? text;
  }

  private lookup(key: string, depth: number): string | null {
    const hit = this.exact.get(key);
    if (hit !== undefined) return hit;
    if (depth > 2) return null;
    for (const t of this.templates) {
      const m = t.re.exec(key);
      if (!m) continue;
      const vals = new Map<string, string>();
      t.names.forEach((name, i) => {
        const v = m[i + 1];
        vals.set(name, hasThai(v) ? (this.lookup(normKey(v), depth + 1) ?? v) : v);
      });
      return t.en.replace(PLACEHOLDER, (all, name: string) => vals.get(name) ?? all);
    }
    return depth === 0 ? this.byPieces(key) : null;
  }

  /**
   * Last try: each run of Thai (between numbers, Latin letters, symbols) on its own, e.g. "5 วิ" → "5 s",
   * "Lv 5 นักดาบ" → "Lv 5 Swordsman". Null when not one run has English.
   */
  private byPieces(key: string): string | null {
    let any = false;
    const out = key.replace(/[฀-๿](?:[฀-๿\s]*[฀-๿])?/g, (run, at: number) => {
      const en = this.lookup(run, 1);
      if (en === null) return run;
      any = true;
      const before = at > 0 && /[\p{L}\p{N}]/u.test(key[at - 1]!) ? ' ' : '';
      const after = /[\p{L}\p{N}]/u.test(key[at + run.length] ?? '') ? ' ' : '';
      return before + en + after;
    });
    return any ? out : null;
  }
}

/** Fills `{name}` / `{0}` in a text from `vars` (for code that builds its own line from a key). */
export function fill(text: string, vars?: Record<string, string | number> | (string | number)[]): string {
  if (!vars) return text;
  return text.replace(PLACEHOLDER, (all, name: string) => {
    const v = (vars as Record<string, string | number>)[name];
    return v === undefined ? all : String(v);
  });
}

/** GET: may players pick English (the /admin switch)? Asked by the title screen before anything is drawn. */
export const LANG_CONFIG_PATH = '/lang';
export interface LangConfigResponse {
  english: boolean;
}
