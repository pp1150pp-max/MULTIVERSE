// Item links in chat (owner 2026-11-23): the server builds each link from the sender's own things and
// keeps it only when its "[label]" is in the text; nothing the client says about the item is used.
import { finish, ok } from './check';
import { buildChatLinks, linkLabel, parseLinkRefs, splitLinks, validLinks, type LinkSource } from '../src/shared/chatLinks';
import { starterWeapon } from '../src/shared/data/items';
import { isItem, type BagEntry, type Item } from '../src/shared/types';

const sword: Item = { ...starterWeapon('sword'), plus: 7, pity: 3, mulK: 'x', tierK: 'y' };
const ring: Item = { ...starterWeapon('sword'), uid: 'r1', name: 'แหวนทดสอบ', slot: 'ring', rarity: 'epic' };
const potion: BagEntry = { potion: 'hp', size: 'm', count: 7 };
const src: LinkSource = { bag: [sword, potion, null], stash: [ring], equipment: { ring } };
const L = (e: BagEntry) => linkLabel(e);

// ---- labels
ok(L(sword) === `[+7 ${sword.name}]`, 'gear label has its + level');
ok(!L(potion).includes('×'), 'stack label has no count');

// ---- a good link: snapshot of the real item, private fields gone
{
  const text = `ดูนี่ ${L(sword)} สวยไหม`;
  const links = buildChatLinks(text, [{ bag: 0 }], src);
  ok(links.length === 1 && links[0].at === text.indexOf('[') && links[0].len === L(sword).length, 'link points at its label');
  const e = links[0].entry;
  ok(isItem(e) && e.plus === 7 && e.name === sword.name && JSON.stringify(e.stats) === JSON.stringify(sword.stats), 'exact item copied');
  ok(isItem(e) && e.uid === '' && e.pity === undefined && e.mulK === undefined && e.tierK === undefined, 'uid/pity/tuning keys stripped');
  ok(e !== sword && isItem(e) && e.stats !== sword.stats, 'a copy, not the live item');
}

// ---- forged data is ignored: only where the item is counts
{
  const fake = { bag: 0, entry: { name: 'ดาบเทพ', plus: 15 } };
  const links = buildChatLinks(`${L(sword)}`, [fake], src);
  ok(links.length === 1 && isItem(links[0].entry) && links[0].entry.plus === 7, 'client item data ignored');
  ok(buildChatLinks('[ดาบเทพ +15]', [{ bag: 0 }], src).length === 0, 'label not in text = dropped');
}

// ---- refs that point nowhere, wrong shapes, too many
ok(buildChatLinks('[x]', [{ bag: 2 }], src).length === 0, 'empty bag slot dropped');
ok(buildChatLinks('[x]', [{ bag: 99 }], src).length === 0, 'slot past the bag dropped');
ok(parseLinkRefs([{ bag: -1 }, { bag: 1.5 }, { stash: '0' }, { slot: 'hat' }, { shop: 'gold' }, null, 'x']).length === 0, 'malformed refs dropped');
ok(parseLinkRefs('nope').length === 0, 'not an array = none');
ok(parseLinkRefs([{ bag: 0 }, { bag: 1 }, { stash: 0 }, { slot: 'ring' }]).length === 3, 'at most 3 refs');
{
  const text = `${L(sword)} ${L(potion)} ${L(ring)} ${L(ring)}`;
  const links = buildChatLinks(text, [{ bag: 0 }, { bag: 1 }, { stash: 0 }, { slot: 'ring' }], src);
  ok(links.length === 3, 'a 4th link is dropped');
  ok(links.every((l, i) => i === 0 || l.at >= links[i - 1].at + links[i - 1].len), 'links in text order, not overlapping');
}

// ---- stash, worn and merchant stock
ok(buildChatLinks(L(ring), [{ stash: 0 }], src).length === 1, 'stash item links');
ok(buildChatLinks(L(ring), [{ slot: 'ring' }], src).length === 1, 'worn item links');
{
  const shop = buildChatLinks('[x]', [{ shop: 'phoenix' }], src);
  ok(shop.length === 0, 'shop link still needs its label');
  const t = L({ stone: 'phoenix', count: 1 });
  const ok1 = buildChatLinks(`ซื้อ ${t}`, [{ shop: 'phoenix' }], src);
  ok(ok1.length === 1 && 'stone' in ok1[0].entry && ok1[0].entry.count === 1, 'merchant stock links as one of the kind');
  ok(parseLinkRefs([{ shop: 'enhance' }]).length === 0, 'only what the merchant sells');
}

// ---- a label cut off by the length limit is dropped
{
  const text = `${'ก'.repeat(110)} ${L(sword)}`.slice(0, 120);
  ok(buildChatLinks(text, [{ bag: 0 }], src).length === 0, 'cut label dropped');
}

// ---- receiving side: bad offsets are ignored, pieces rebuild the text
{
  const text = `a ${L(sword)} b`;
  const links = buildChatLinks(text, [{ bag: 0 }], src);
  ok(validLinks(text, links).length === 1, 'server links pass the client check');
  ok(validLinks(text, [{ at: 0, len: 999, entry: sword }]).length === 0, 'link past the text ignored');
  ok(validLinks(text, [{ at: 2, len: 3, entry: { evil: 1 } }]).length === 0, 'link without a real entry ignored');
  ok(validLinks(text, 'x').length === 0, 'not an array = none');
  const parts = splitLinks(text, links);
  ok(parts.map((p) => (typeof p === 'string' ? p : text.slice(p.at, p.at + p.len))).join('') === text, 'pieces rebuild the text');
}

finish('chat-links');
