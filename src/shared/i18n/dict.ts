// The English dictionary (docs/systems/i18n.md): keyed by the Thai text exactly as the page shows it, `{0}` / `{name}`
// for the parts that change. Names the data already has in English (monsters, skills) come from the data; the rest is
// written in en/*.ts. Later entries win over earlier ones. Pure data: no DOM.
import { MONSTERS } from '../data/monsters';
import { CLASSES } from '../data/classes';
import { normKey } from './translator';
import { EN_UI } from './en/ui';
import { EN_HUD } from './en/hud';
import { EN_SKILLS } from './en/skills';
import { EN_ITEMS } from './en/items';
import { EN_SHOPS } from './en/shops';
import { EN_GAME } from './en/game';
import { EN_PANELS } from './en/panels';
import { EN_SERVER } from './en/server';
import { EN_EXTRAS } from './en/extras';
import { EN_MISC } from './en/misc';

let built: Record<string, string> | null = null;

/** Thai → English for everything the game shows. */
export function englishDict(): Record<string, string> {
  if (built) return built;
  const d: Record<string, string> = {};
  const put = (th: string | undefined, en: string | undefined): void => {
    if (th && en) d[normKey(th)] = en;
  };
  for (const m of Object.values(MONSTERS)) put(m.nameTh, m.name);
  for (const c of Object.values(CLASSES)) for (const s of c.skills) put(s.nameTh, s.name);
  for (const part of [EN_UI, EN_HUD, EN_SKILLS, EN_ITEMS, EN_SHOPS, EN_GAME, EN_PANELS, EN_SERVER, EN_EXTRAS, EN_MISC]) for (const [th, en] of Object.entries(part)) put(th, en);
  return (built = d);
}
