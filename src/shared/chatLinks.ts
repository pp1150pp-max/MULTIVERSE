// Item links in chat (owner 2026-11-23): Ctrl+click an item and its name goes into the chat box as
// "[name]"; anyone who sees the message can click the name for that exact item's details.
//
// The client only sends *where* the item is (a bag / stash / worn slot of its own, or a merchant
// stock kind). The server looks the item up in the sender's own state, copies it, and checks that its
// label really is in the text; the client never sends item data. Receivers get the copies with the
// label's place in the text, and draw the text with textContent (no HTML).
import { EQUIP_SLOTS, isItem, isPotion, isStone, type BagEntry, type EquipSlot, type Item, type PotionKind, type PotionSize } from './types';
import { itemName } from './data/enhance';
import { potionName } from './data/potions';
import { STONE_NAME } from './data/stones';

/** Links one message may carry. */
export const CHAT_LINK_MAX = 3;

/** What the merchant sells (src/client/ui/shop.ts): links to these are a plain one of the kind. */
export const SHOP_LINK_KINDS = ['hp:s', 'hp:m', 'hp:l', 'mp:s', 'mp:m', 'mp:l', 'phoenix', 'return_scroll'] as const;
export type ShopLinkKind = (typeof SHOP_LINK_KINDS)[number];

/** Where a linked item is, as the client sends it. */
export type ChatLinkRef = { bag: number } | { stash: number } | { slot: EquipSlot } | { shop: ShopLinkKind };

/** A link as the server sends it: the item's copy and where its "[label]" is in the text (UTF-16 offsets). */
export interface ChatLink {
  at: number;
  len: number;
  entry: BagEntry;
}

/** The sender's own things a link may point at. */
export interface LinkSource {
  bag: readonly (BagEntry | null)[];
  stash: readonly (BagEntry | null)[];
  equipment: Partial<Record<EquipSlot, Item>>;
}

/** The label a link shows in the text: the item's name (with +N) or the stack's kind, no count. */
export function linkLabel(e: BagEntry): string {
  const name = isPotion(e) ? potionName(e.potion, e.size) : isStone(e) ? STONE_NAME[e.stone] : itemName(e);
  return `[${name}]`;
}

const index = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1000;

/** The refs from a message, malformed ones dropped, at most CHAT_LINK_MAX. */
export function parseLinkRefs(raw: unknown): ChatLinkRef[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatLinkRef[] = [];
  for (const r of raw.slice(0, CHAT_LINK_MAX)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (index(o.bag)) out.push({ bag: o.bag });
    else if (index(o.stash)) out.push({ stash: o.stash });
    else if ((EQUIP_SLOTS as unknown[]).includes(o.slot)) out.push({ slot: o.slot as EquipSlot });
    else if ((SHOP_LINK_KINDS as readonly unknown[]).includes(o.shop)) out.push({ shop: o.shop as ShopLinkKind });
  }
  return out;
}

/** A copy of an entry for others to see: nothing that only matters to its owner (uid, pity, tuning keys). */
export function linkSnapshot(e: BagEntry): BagEntry {
  if (isPotion(e)) return { potion: e.potion, size: e.size, count: e.count };
  if (isStone(e)) return { stone: e.stone, count: e.count };
  const { uid: _uid, pity: _pity, tierK: _tierK, mulK: _mulK, ...rest } = structuredClone(e);
  return { ...rest, uid: '' };
}

/** The entry a ref points at in the sender's own things, or null. */
export function resolveLinkRef(ref: ChatLinkRef, src: LinkSource): BagEntry | null {
  if ('bag' in ref) return src.bag[ref.bag] ?? null;
  if ('stash' in ref) return src.stash[ref.stash] ?? null;
  if ('slot' in ref) return src.equipment[ref.slot] ?? null;
  if (ref.shop === 'phoenix' || ref.shop === 'return_scroll') return { stone: ref.shop, count: 1 };
  const [potion, size] = ref.shop.split(':') as [PotionKind, PotionSize];
  return { potion, size, count: 1 };
}

/**
 * The links of a message whose text is final (cleaned and cut to length): each ref is looked up in the
 * sender's things and kept only if its label is in the text after the previous link's. Unknown refs,
 * empty slots and labels that were edited out (or cut off) are dropped.
 */
export function buildChatLinks(text: string, raw: unknown, src: LinkSource): ChatLink[] {
  const out: ChatLink[] = [];
  let from = 0;
  for (const ref of parseLinkRefs(raw)) {
    const e = resolveLinkRef(ref, src);
    if (!e) continue;
    const label = linkLabel(e);
    const at = text.indexOf(label, from);
    if (at < 0) continue;
    out.push({ at, len: label.length, entry: linkSnapshot(e) });
    from = at + label.length;
  }
  return out;
}

/** Links as received: kept only when in order, inside the text and not overlapping (the client's check). */
export function validLinks(text: string, links: unknown): ChatLink[] {
  if (!Array.isArray(links)) return [];
  const out: ChatLink[] = [];
  let from = 0;
  for (const l of links.slice(0, CHAT_LINK_MAX)) {
    if (!l || typeof l !== 'object') continue;
    const { at, len, entry } = l as Partial<ChatLink>;
    if (!index(at) || !index(len) || len < 2 || at < from || at + len > text.length) continue;
    if (!entry || typeof entry !== 'object' || !(isPotion(entry) || isStone(entry) || (isItem(entry) && typeof entry.name === 'string'))) continue;
    out.push({ at, len, entry });
    from = at + len;
  }
  return out;
}

/** The text cut into plain pieces and links, in order (for drawing). */
export function splitLinks(text: string, links: readonly ChatLink[]): (string | ChatLink)[] {
  const out: (string | ChatLink)[] = [];
  let from = 0;
  for (const l of links) {
    if (l.at > from) out.push(text.slice(from, l.at));
    out.push(l);
    from = l.at + l.len;
  }
  if (from < text.length) out.push(text.slice(from));
  return out;
}
