// The merchant's sell basket (owner 2026-11-27, Sim.sellMany): sells the whole of every picked slot in one go, and
// skips a pick whose slot now holds something else, bound things, orb items, repeats and bad slots.
import { newCharacterData } from '../src/shared/sim/Player';
import { Sim, sellPickKey, sellPickOf, type SellPick } from '../src/shared/sim/Sim';
import { ZONES } from '../src/shared/data/zones';
import { sellValue } from '../src/shared/data/enhance';
import { makeItem } from '../src/shared/data/items';
import { anyStackValue } from '../src/shared/data/potions';
import type { BagEntry, Item } from '../src/shared/types';
import { checkNpcTalkTuning, codeNpcTalk, mergeNpcTalk, npcTalkChanges, SHOP_LINE_KEYS, FORGE_LINE_KEYS, STASH_LINE_KEYS, MARKET_LINE_KEYS, CASH_LINE_KEYS, SEEKER_LINE_KEYS } from '../src/shared/npcTalk';
import { finish, ok } from './check';

const sim = new Sim(Object.values(ZONES)[0]);
const data = newCharacterData('T', 'sword');
data.level = 30;
const p = sim.addPlayer(data);
const near = (sim as unknown as { near(p: unknown, id: string): boolean }).near.bind(sim);
const stand = () => {
  for (let x = -60; x <= 60; x++) for (let z = -60; z <= 60; z++) {
    p.x = x;
    p.z = z;
    if (near(p, 'merchant')) return;
  }
};
const gear = (uid: string, rarity: Item['rarity'] = 'common', plus = 0): Item => {
  const it = makeItem('weapon_1', rarity, 20, 'sword')!;
  return { ...it, uid, plus };
};
const U = p.bagSlots.gear;
type Stk = Parameters<typeof anyStackValue>[0];

function fill(): void {
  p.bag = p.bag.map(() => null);
  p.bag[0] = gear('a');
  p.bag[1] = gear('b', 'rare');
  p.bag[2] = gear('c', 'epic', 5);
  p.bag[U] = { potion: 'hp', size: 'm', count: 7 };
  p.bag[U + 1] = { stone: 'protect', count: 3 };
  p.bag[U + 2] = { stone: 'protect', count: 2, bound: true } as BagEntry;
  p.bag[U + 3] = { stone: 'orb_1', count: 1 } as BagEntry;
  p.buyback = [];
}

stand();
ok(near(p, 'merchant'), 'test player stands by the merchant');

// Everything sellable at once: gold, emptied slots, gear into buyback.
fill();
let gold = p.gold;
const want = sellValue(p.bag[0] as Item) + sellValue(p.bag[1] as Item) + sellValue(p.bag[2] as Item)
  + anyStackValue(p.bag[U] as Stk) + anyStackValue(p.bag[U + 1] as Stk);
const got = sim.sellMany(p, [0, 1, 2, U, U + 1].map((i) => sellPickOf(p.bag[i]!, i)));
ok(got === want && p.gold === gold + want, `paid the sum of each slot (${got} = ${want})`);
ok([0, 1, 2, U, U + 1].every((i) => p.bag[i] === null), 'sold slots are empty');
ok(p.buyback.length === 3 && p.buyback.some((b) => b.item.uid === 'c'), 'gear goes to the buyback list, stacks do not');

// A pick whose slot changed is skipped.
fill();
gold = p.gold;
ok(sim.sellMany(p, [{ i: 0, uid: 'zzz' }, { i: U, k: sellPickKey({ potion: 'mp', size: 'm', count: 1 }) }, { i: 1, k: 'p:hp:m' }]) === 0, 'wrong uid / stack kind / kind for gear: nothing sold');
ok(p.gold === gold && p.bag[0] && p.bag[U] && p.bag[1], 'and nothing moved');

// Bound stacks and orb items stay.
ok(sim.sellMany(p, [sellPickOf(p.bag[U + 2]!, U + 2), sellPickOf(p.bag[U + 3]!, U + 3)]) === 0 && p.bag[U + 2] && p.bag[U + 3], 'bound and orb are refused');

// The same slot twice is paid once; bad slots do nothing.
gold = p.gold;
const one = sellValue(p.bag[0] as Item);
const bad = [{ i: -1 }, { i: 1.5 }, { i: 9999 }, { i: NaN }] as SellPick[];
ok(sim.sellMany(p, [sellPickOf(p.bag[0]!, 0), sellPickOf(p.bag[0]!, 0), ...bad]) === one && p.gold === gold + one, 'a repeated slot is paid once, bad slots ignored');

// Away from the merchant: nothing.
fill();
gold = p.gold;
p.x += 500;
ok(sim.sellMany(p, [sellPickOf(p.bag[0]!, 0)]) === 0 && p.gold === gold && p.bag[0], 'away from the merchant: refused');

// The /admin switch for the shop inside the talk window (BalanceTuning.npcTalk.shopPane).
ok(codeNpcTalk().shopPane === true, 'shop pane: on in the code');
const t1 = checkNpcTalkTuning({ shopPane: false }, true);
ok('tuning' in t1 && t1.tuning?.shopPane === false, 'shop pane off is saved');
const t2 = checkNpcTalkTuning({ shopPane: true }, true);
ok('tuning' in t2 && t2.tuning === undefined, 'on (the code value) is not saved');
ok('error' in checkNpcTalkTuning({ shopPane: 'x' }, true), 'not on/off: refused');
ok(mergeNpcTalk({ shopPane: false }).shopPane === false && mergeNpcTalk({}).shopPane === true, 'merge');
ok(npcTalkChanges(codeNpcTalk(), mergeNpcTalk({ shopPane: false })).some((l) => l.includes('ร้านพ่อค้าในหน้าต่างคุย')), 'audit line');

// The merchant's shop lines (npcTalk.shop), edited on /admin.
ok(SHOP_LINE_KEYS.every((k) => codeNpcTalk().shop[k].length > 0), 'every shop line has a code default');
const t3 = checkNpcTalkTuning({ shop: { sold: ['  เอาไป {0} G  ', ''] } }, true);
ok('tuning' in t3 && JSON.stringify(t3.tuning?.shop) === JSON.stringify({ sold: ['เอาไป {0} G'] }), 'a changed line is saved trimmed, empty rows dropped');
const t4 = checkNpcTalkTuning({ shop: { sold: codeNpcTalk().shop.sold } }, true);
ok('tuning' in t4 && t4.tuning === undefined, 'the code lines are not saved');
ok('error' in checkNpcTalkTuning({ shop: { nope: ['x'] } }, true), 'unknown line key refused');
ok('error' in checkNpcTalkTuning({ shop: { sold: ['x'.repeat(200)] } }, true), 'too long a line refused');
ok(mergeNpcTalk({ shop: { poor: ['ไม่มีตังค์'] } }).shop.poor[0] === 'ไม่มีตังค์' && mergeNpcTalk({}).shop.poor[0] === codeNpcTalk().shop.poor[0], 'merge shop lines');
ok(npcTalkChanges(codeNpcTalk(), mergeNpcTalk({ shop: { poor: ['ไม่มีตังค์'] } })).some((l) => l.includes('บทพูดร้านพ่อค้า')), 'shop line audit');

// The blacksmith inside the talk window (npcTalk.forgePane + npcTalk.forge lines).
ok(codeNpcTalk().forgePane === true, 'forge pane: on in the code');
const f1 = checkNpcTalkTuning({ forgePane: false, forge: { success: ['เย้ {0}'] } }, true);
ok('tuning' in f1 && f1.tuning?.forgePane === false && f1.tuning?.forge?.success?.[0] === 'เย้ {0}', 'forge switch and lines saved');
ok('error' in checkNpcTalkTuning({ forge: { nope: ['x'] } }, true), 'unknown forge line refused');
ok(FORGE_LINE_KEYS.every((k) => codeNpcTalk().forge[k].length > 0), 'every forge line has a code default');
const fm = mergeNpcTalk({ forgePane: false, forge: { fail: ['พลาด'] } });
ok(!fm.forgePane && fm.forge.fail[0] === 'พลาด' && fm.forge.success[0] === codeNpcTalk().forge.success[0], 'forge merge');
const fc = npcTalkChanges(codeNpcTalk(), fm);
ok(fc.some((l) => l.includes('ช่างตีเหล็กในหน้าต่างคุย')) && fc.some((l) => l.includes('บทพูดช่างตีเหล็ก')), 'forge audit lines');

// The stash inside the talk window (npcTalk.stashPane + npcTalk.stash lines).
ok(codeNpcTalk().stashPane === true, 'stash pane: on in the code');
ok(STASH_LINE_KEYS.every((k) => codeNpcTalk().stash[k].length > 0), 'every stash line has a code default');
const s1 = checkNpcTalkTuning({ stashPane: false, stash: { put: ['เก็บ {0}'] } }, true);
ok('tuning' in s1 && s1.tuning?.stashPane === false && s1.tuning?.stash?.put?.[0] === 'เก็บ {0}', 'stash switch and lines saved');
ok('error' in checkNpcTalkTuning({ stash: { nope: ['x'] } }, true), 'unknown stash line refused');
const sm = mergeNpcTalk({ stashPane: false, stash: { take: ['คืน'] } });
ok(!sm.stashPane && sm.stash.take[0] === 'คืน' && sm.stash.put[0] === codeNpcTalk().stash.put[0], 'stash merge');
const sc = npcTalkChanges(codeNpcTalk(), sm);
ok(sc.some((l) => l.includes('คลังในหน้าต่างคุย')) && sc.some((l) => l.includes('บทพูดผู้ดูแลคลัง')), 'stash audit lines');

// The market inside the talk window (npcTalk.marketPane + npcTalk.market lines).
ok(codeNpcTalk().marketPane === true, 'market pane: on in the code');
ok(MARKET_LINE_KEYS.every((k) => codeNpcTalk().market[k].length > 0), 'every market line has a code default');
const m1 = checkNpcTalkTuning({ marketPane: false, market: { listed: ['ลงแล้ว'] } }, true);
ok('tuning' in m1 && m1.tuning?.marketPane === false && m1.tuning?.market?.listed?.[0] === 'ลงแล้ว', 'market switch and lines saved');
ok('error' in checkNpcTalkTuning({ market: { nope: ['x'] } }, true), 'unknown market line refused');
const mm = mergeNpcTalk({ marketPane: false, market: { bought: ['ได้แล้ว'] } });
ok(!mm.marketPane && mm.market.bought[0] === 'ได้แล้ว' && mm.market.open[0] === codeNpcTalk().market.open[0], 'market merge');
const mc = npcTalkChanges(codeNpcTalk(), mm);
ok(mc.some((l) => l.includes('ตลาดในหน้าต่างคุย')) && mc.some((l) => l.includes('บทพูดนายหน้าตลาด')), 'market audit lines');

// The cash shop inside the talk window (npcTalk.cashPane + npcTalk.cash lines, owner 2026-11-28).
ok(codeNpcTalk().cashPane === true, 'cash pane: on in the code');
ok(CASH_LINE_KEYS.every((k) => codeNpcTalk().cash[k].length > 0), 'every cash line has a code default');
const c1 = checkNpcTalkTuning({ cashPane: false, cash: { bought: ['ได้ {0}'] } }, true);
ok('tuning' in c1 && c1.tuning?.cashPane === false && c1.tuning?.cash?.bought?.[0] === 'ได้ {0}', 'cash switch and lines saved');
ok('error' in checkNpcTalkTuning({ cash: { nope: ['x'] } }, true), 'unknown cash line refused');
const cm = mergeNpcTalk({ cashPane: false, cash: { open: ['เชิญ'] } });
ok(!cm.cashPane && cm.cash.open[0] === 'เชิญ' && cm.cash.vip[0] === codeNpcTalk().cash.vip[0], 'cash merge');
const cc = npcTalkChanges(codeNpcTalk(), cm);
ok(cc.some((l) => l.includes('แคชช็อปในหน้าต่างคุย')) && cc.some((l) => l.includes('บทพูดพ่อค้าคริสตัล')), 'cash audit lines');

// The Seeker's quests inside the talk window (npcTalk.seekerPane + npcTalk.seeker lines, owner 2026-11-28).
ok(codeNpcTalk().seekerPane === true, 'seeker pane: on in the code');
ok(SEEKER_LINE_KEYS.every((k) => codeNpcTalk().seeker[k].length > 0), 'every seeker line has a code default');
const k1 = checkNpcTalkTuning({ seekerPane: false, seeker: { accept: ['รับ {0}'] } }, true);
ok('tuning' in k1 && k1.tuning?.seekerPane === false && k1.tuning?.seeker?.accept?.[0] === 'รับ {0}', 'seeker switch and lines saved');
ok('error' in checkNpcTalkTuning({ seeker: { nope: ['x'] } }, true), 'unknown seeker line refused');
const km = mergeNpcTalk({ seekerPane: false, seeker: { open: ['มา'] } });
ok(!km.seekerPane && km.seeker.open[0] === 'มา' && km.seeker.turnIn[0] === codeNpcTalk().seeker.turnIn[0], 'seeker merge');
const kc = npcTalkChanges(codeNpcTalk(), km);
ok(kc.some((l) => l.includes('เควส The Seeker ในหน้าต่างคุย')) && kc.some((l) => l.includes('บทพูดThe Seeker')), 'seeker audit lines');

finish('sell-many');
