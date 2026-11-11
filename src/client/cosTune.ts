// The cosmetic tuning in use in this browser (src/shared/cosTuning.ts): the server-wide one the server
// sends, or what the /admin bench is trying out. Read every frame by cosmeticViews.ts.
import { cosTuneOf, type CosTuning, type TuneValues } from '../shared/cosTuning';

let tuning: CosTuning = {};
const cache = new Map<string, TuneValues | undefined>();

/** Uses this tuning from now on (already checked by checkCosTuning). */
export function applyCosTuning(t: CosTuning): void {
  tuning = structuredClone(t);
  cache.clear();
}

/** The tuning in use (a copy). */
export function currentCosTuning(): CosTuning {
  return structuredClone(tuning);
}

/** The values one cosmetic uses now (code defaults + changes), or undefined for a title set / unknown id. */
export function cosTune(id: string): TuneValues | undefined {
  if (!cache.has(id)) cache.set(id, cosTuneOf(tuning, id));
  return cache.get(id);
}

/** A number field of a cosmetic (0 if it has no such field). */
export function tuneNum(id: string, key: string): number {
  const v = cosTune(id)?.[key];
  return typeof v === 'number' ? v : 0;
}

/** An on/off field of a cosmetic. */
export function tuneBool(id: string, key: string): boolean {
  return cosTune(id)?.[key] === true;
}

/** The bench changes one field (not checked here: the save is checked by the server). */
export function setCosTuneValue(id: string, key: string, v: number | boolean): void {
  tuning[id] = { ...tuning[id], [key]: v };
  cache.delete(id);
}

/** The bench puts one cosmetic back to `to` (the saved server-wide changes of it), or to its code defaults. */
export function resetCosTune(id: string, to?: TuneValues): void {
  if (to && Object.keys(to).length) tuning[id] = { ...to };
  else delete tuning[id];
  cache.delete(id);
}
