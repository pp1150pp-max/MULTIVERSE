// The server-wide card tuning the owner sets on the /admin "การ์ด" tab: only what differs from the code
// defaults in data/cards.ts, stored in the settings table. Game code reads cards and numbers through
// cardDef / cardNum, which apply the current tuning (the server sets it at start and on every save).
import {
  CARD_DEFAULTS, CARD_FX, CARD_FX_MAX, CARD_FX_NAME, CARD_GROUP_NAME, CARD_GROUPS, CARD_NUM_FIELDS, isCardId,
  type CardDef, type CardFx, type CardGroup, type CardId,
} from './data/cards';

/** One card's changes: its group and/or its whole effect list. */
export interface CardChange {
  group?: CardGroup;
  fx?: Partial<Record<CardFx, number>>;
}
export interface CardTuning {
  cards?: Partial<Record<CardId, CardChange>>;
  nums?: Record<string, number>;
}

/** Key in the server's settings table. */
export const CARD_TUNING_SETTING = 'card_tuning';
/** Largest value one card effect may have. */
export const CARD_FX_LIMIT = 100;

const FIELD = new Map(CARD_NUM_FIELDS.map((f) => [f.key, f]));
const roundTo = (v: number, step: number): number => {
  const d = Math.max(0, Math.round(-Math.log10(step)));
  return Number(v.toFixed(d));
};
const sameFx = (a: Partial<Record<CardFx, number>>, b: Partial<Record<CardFx, number>>): boolean =>
  CARD_FX.every((f) => (a[f] ?? 0) === (b[f] ?? 0));

type Result = { tuning: CardTuning; error?: undefined } | { tuning?: undefined; error: string };

/**
 * Checks tuning sent by a browser (`strict`: anything unknown, mistyped or out of range is an error) or
 * read back from the database (not strict: such entries are dropped). Values equal to the code default
 * are left out and the result is in a fixed order, so equal tunings give the same JSON.
 */
export function checkCardTuning(v: unknown, strict: boolean): Result {
  const fail = (error: string): Result => (strict ? { error } : { tuning: {} });
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('ค่าการ์ดไม่ถูกต้อง');
  const o = v as Record<string, unknown>;
  const out: CardTuning = {};

  // Cards
  const cardsIn = o.cards ?? {};
  if (!cardsIn || typeof cardsIn !== 'object' || Array.isArray(cardsIn)) return fail('ค่าการ์ดไม่ถูกต้อง');
  const ci = cardsIn as Record<string, unknown>;
  if (strict) {
    const bad = Object.keys(ci).find((id) => !isCardId(id));
    if (bad) return { error: `ไม่มีการ์ด "${bad.slice(0, 30)}"` };
  }
  const cards: Partial<Record<CardId, CardChange>> = {};
  for (const d of CARD_DEFAULTS) {
    const g = ci[d.id];
    if (g === undefined) continue;
    if (!g || typeof g !== 'object' || Array.isArray(g)) {
      if (strict) return { error: `ค่าของ ${d.id} ไม่ถูกต้อง` };
      continue;
    }
    const gi = g as Record<string, unknown>;
    const ch: CardChange = {};
    if (gi.group !== undefined) {
      if (!CARD_GROUPS.includes(gi.group as CardGroup)) {
        if (strict) return { error: `กลุ่มช่องของ ${d.id} ไม่ถูกต้อง` };
      } else if (gi.group !== d.group) ch.group = gi.group as CardGroup;
    }
    if (gi.fx !== undefined) {
      const fx = cleanFx(gi.fx);
      if (typeof fx === 'string') {
        if (strict) return { error: `${d.id}: ${fx}` };
      } else if (!sameFx(fx, d.fx)) ch.fx = fx;
    }
    if (ch.group || ch.fx) cards[d.id] = ch;
  }
  if (Object.keys(cards).length) out.cards = cards;

  // Numbers
  const numsIn = o.nums ?? {};
  if (!numsIn || typeof numsIn !== 'object' || Array.isArray(numsIn)) return fail('ตัวเลขการ์ดไม่ถูกต้อง');
  const ni = numsIn as Record<string, unknown>;
  if (strict) {
    const bad = Object.keys(ni).find((k) => !FIELD.has(k));
    if (bad) return { error: `ไม่มีค่า "${bad.slice(0, 30)}"` };
  }
  const nums: Record<string, number> = {};
  for (const f of CARD_NUM_FIELDS) {
    const g = ni[f.key];
    if (g === undefined) continue;
    if (typeof g !== 'number' || !Number.isFinite(g) || g < f.min || g > f.max) {
      if (strict) return { error: `${f.name}: ต้องเป็นตัวเลข ${f.min}–${f.max}` };
      continue;
    }
    const val = roundTo(g, f.step);
    if (val !== f.def) nums[f.key] = val;
  }
  // The three drill odds must add up to 100%.
  const odd = (k: string) => nums[k] ?? FIELD.get(k)!.def;
  if (Math.abs(odd('drill0') + odd('drill1') + odd('drill2') - 100) > 1e-6) {
    if (strict) return { error: 'โอกาสเจาะรู 0/1/2 ช่อง รวมกันต้องได้ 100%' };
    delete nums.drill0;
    delete nums.drill1;
    delete nums.drill2;
  }
  if (Object.keys(nums).length) out.nums = nums;
  return { tuning: out };
}

/** A card's effect list from a browser: 1–CARD_FX_MAX known effects, each above 0 and at most CARD_FX_LIMIT. */
function cleanFx(v: unknown): Partial<Record<CardFx, number>> | string {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'ผลการ์ดไม่ถูกต้อง';
  const out: Partial<Record<CardFx, number>> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (!CARD_FX.includes(k as CardFx)) return `ไม่มีผล "${k.slice(0, 20)}"`;
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > CARD_FX_LIMIT) return `ค่าผลต้องมากกว่า 0 และไม่เกิน ${CARD_FX_LIMIT}`;
    out[k as CardFx] = roundTo(n, 0.01);
  }
  const n = Object.keys(out).length;
  if (n < 1 || n > CARD_FX_MAX) return `การ์ด 1 ใบมีผลได้ 1–${CARD_FX_MAX} อย่าง`;
  // Fixed order.
  return Object.fromEntries(CARD_FX.filter((f) => out[f] !== undefined).map((f) => [f, out[f]]));
}

export const sameCardTuning = (a: CardTuning, b: CardTuning): boolean => JSON.stringify(a) === JSON.stringify(b);

/** "ชื่อ: เดิม → ใหม่" lines for the audit log. */
export function cardTuningChanges(before: CardTuning, after: CardTuning, name: (id: CardId) => string): string {
  const out: string[] = [];
  const fxText = (fx: Partial<Record<CardFx, number>>) => CARD_FX.filter((f) => fx[f] !== undefined).map((f) => `${CARD_FX_NAME[f]} ${fx[f]}`).join(', ');
  const groupText = (g: CardGroup) => CARD_GROUP_NAME[g].replace(/\s*\(.*\)$/, '');
  for (const d of CARD_DEFAULTS) {
    const a = cardOf(before, d);
    const b = cardOf(after, d);
    if (a.group !== b.group) out.push(`${name(d.id)} ใส่ได้: ${groupText(a.group)} → ${groupText(b.group)}`);
    if (!sameFx(a.fx, b.fx)) out.push(`${name(d.id)}: ${fxText(a.fx)} → ${fxText(b.fx)}`);
  }
  for (const f of CARD_NUM_FIELDS) {
    const a = before.nums?.[f.key] ?? f.def;
    const b = after.nums?.[f.key] ?? f.def;
    if (a !== b) out.push(`${f.name}: ${a} → ${b}`);
  }
  return out.join(' · ') || 'ไม่มีการเปลี่ยน';
}

function cardOf(t: CardTuning, d: CardDef): CardDef {
  const ch = t.cards?.[d.id];
  return ch ? { ...d, group: ch.group ?? d.group, fx: ch.fx ?? d.fx } : d;
}

// ------------------------------------------------------------ the current tuning (game code reads these)

let current: CardTuning = {};

/** Sets the tuning in use (server: at start and after each save). Expects a checked tuning. */
export function applyCardTuning(t: CardTuning): void {
  current = t;
}
export const currentCardTuning = (): CardTuning => current;

/** A card with the current tuning applied, or undefined for an unknown id. */
export function cardDef(id: CardId): CardDef | undefined {
  const d = CARD_DEFAULTS.find((x) => x.id === id);
  return d && cardOf(current, d);
}

/** One card-system number with the current tuning applied (see CARD_NUM_FIELDS for keys and units). */
export function cardNum(key: string): number {
  return current.nums?.[key] ?? FIELD.get(key)?.def ?? 0;
}
