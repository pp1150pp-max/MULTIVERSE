// Item sets (owner 2026-11-19, docs/systems/items-and-forge.md "เซ็ตไอเทม"): every worn place counts (both rings),
// at most 9, steps 3/6/9 in the code; the /admin switch and steps are saved only when they differ from the code.
// No item kind is in a set yet (they come with the floor-2 maps), so this test marks two kinds itself.
import { balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { ITEM_BASES, itemSet, makeItem } from '../src/shared/data/items';
import { CODE_SET_STEPS, setInfo, setPieces } from '../src/shared/data/sets';
import { EQUIP_SLOTS, type EquipSlot, type Item } from '../src/shared/types';
import { finish, ok } from './check';

const mark = (id: string) => { (ITEM_BASES.find((b) => b.id === id) as { set?: string }).set = 'pirate'; };
mark('ring_copper');
mark('cap');

const ring = () => makeItem('ring_copper', 'common', 1, 'sword')!;
const cap = makeItem('cap', 'common', 1, 'sword')!;
const plain = makeItem('sandals', 'common', 1, 'sword')!;
ok(itemSet(cap) === 'pirate', 'set comes from the item kind');
ok(itemSet(plain) === null, 'other kinds are in no set');

const eq: Partial<Record<EquipSlot, Item>> = { helmet: cap, ring: ring(), ring2: ring(), boots: plain };
ok(setPieces(eq, 'pirate') === 3, 'both rings count: helmet + 2 rings = 3');
ok(setPieces(eq, 'beach') === 0, 'another set counts 0');
const full: Partial<Record<EquipSlot, Item>> = {};
for (const s of EQUIP_SLOTS) full[s] = s === 'ring' || s === 'ring2' ? ring() : cap;
ok(setPieces(full, 'pirate') === 9, 'ten worn places still count at most 9');

const code = mergeBalance({});
ok(JSON.stringify(code.sets.steps.pirate) === JSON.stringify(CODE_SET_STEPS), 'code steps 3/6/9');
const info = setInfo(cap, eq, code.sets);
ok(info?.name === 'ชุดโจรสลัด' && info.pieces === 3, 'set line: ชุดโจรสลัด (3/9)');
ok(setInfo(plain, eq, code.sets) === null, 'no set line on other items');
ok(setInfo(cap, eq, mergeBalance({ sets: { on: false } }).sets) === null, 'switched off: no set line');

ok(JSON.stringify(checkBalance({ sets: code.sets }, true).tuning) === '{}', 'code values are not saved');
ok(checkBalance({ sets: { on: false } }, true).tuning?.sets?.on === false, 'off is kept');
const t = checkBalance({ sets: { steps: { pirate: [2, 4, 9] } } }, true).tuning;
ok(JSON.stringify(t?.sets) === '{"steps":{"pirate":[2,4,9]}}', 'changed steps are kept');
ok('error' in checkBalance({ sets: { steps: { pirate: [4, 4, 9] } } }, true), 'steps must go up');
ok('error' in checkBalance({ sets: { steps: { pirate: [3, 6, 10] } } }, true), 'steps at most 9');
ok('error' in checkBalance({ sets: { steps: { nope: [3, 6, 9] } } }, true), 'unknown set refused');
ok(checkBalance({ sets: { steps: { pirate: [9, 1, 2] } } }, false).tuning?.sets === undefined, 'a bad saved value is dropped when loading');
const audit = balanceChanges({}, { sets: { on: false, steps: { beach: [2, 4, 9] } } });
ok(audit.includes('เซ็ตไอเทม เปิด → ปิด') && audit.includes('ชุดชาวหาด ขั้นโบนัส 3/6/9 → 2/4/9 ชิ้น'), 'the audit names it');

finish('item-sets');
