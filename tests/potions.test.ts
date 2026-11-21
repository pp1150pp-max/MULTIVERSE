// Potion numbers (owner 2026-11-17): 100/500/1000 for HP and MP, prices scaling with the heal, swordsman +75% on HP;
// all of it tunable from /admin "ปรับสมดุล" → ยา, saved only when different from the code, effective at once.
import { applyBalance, balanceChanges, checkBalance } from '../src/shared/balance';
import { dropPotionSize, potionAmount, potionHeal, potionPrice, potionSellPrice } from '../src/shared/data/potions';
import { newCharacterData } from '../src/shared/sim/Player';
import { Sim } from '../src/shared/sim/Sim';
import { ZONES } from '../src/shared/data/zones';
import { finish, ok } from './check';

const eq = (a: unknown[], b: unknown[]) => JSON.stringify(a) === JSON.stringify(b);
const S = ['s', 'm', 'l'] as const;

applyBalance({});
ok(eq(S.map((z) => potionAmount('hp', z)), [100, 500, 1000]) && eq(S.map((z) => potionAmount('mp', z)), [100, 500, 1000]), 'heal 100/500/1000 for HP and MP');
ok(eq(S.map((z) => potionPrice('hp', z)), [25, 125, 220]), 'HP prices 25/125/220');
ok(eq(S.map((z) => potionPrice('mp', z)), [40, 208, 367]), 'MP prices 40/208/367');
ok(eq(S.map((z) => potionSellPrice('hp', z)), [12, 62, 110]) && eq(S.map((z) => potionSellPrice('mp', z)), [20, 104, 183]), 'buy-back is half, rounded down');
ok(eq(S.map((z) => potionHeal('hp', z, 'sword')), [175, 875, 1750]), 'swordsman HP potions +75%');
ok(eq(S.map((z) => potionHeal('hp', z, 'mage')), [100, 500, 1000]) && eq(S.map((z) => potionHeal('mp', z, 'sword')), [100, 500, 1000]), 'others and MP potions are not boosted');

// ---------------------------------------------------------- what may be saved
ok(JSON.stringify(checkBalance({ potions: { hp: { s: { amount: 100, price: 25 } }, swordBonus: 75 } }, true).tuning) === '{}', 'the code values are not saved');
ok('error' in checkBalance({ potions: { hp: { s: { amount: 0 } } } }, true), 'a heal of 0 is refused');
ok('error' in checkBalance({ potions: { hp: { x: { amount: 5 } } } }, true), 'an unknown size is refused');
ok('error' in checkBalance({ potions: { sp: {} } }, true), 'an unknown kind is refused');
ok('error' in checkBalance({ potions: { swordBonus: -1 } }, true), 'a negative bonus is refused');
const t = checkBalance({ potions: { hp: { m: { amount: 600, price: 125 } }, mp: { l: { price: 400 } }, swordBonus: 100 } }, true).tuning!;
ok(eq([t.potions?.hp?.m?.amount, t.potions?.hp?.m?.price, t.potions?.mp?.l?.price, t.potions?.swordBonus], [600, undefined, 400, 100]), 'only the differing numbers are kept');
const ch = balanceChanges({}, t);
ok(ch.includes('ยา HP กลาง ฟื้น 500 → 600') && ch.includes('ยา MP ใหญ่ ราคา 367 → 400') && ch.includes('+75% → +100%'), 'the audit names the changes');

// ---------------------------------------------------------- an /admin override is live
{
  applyBalance(t);
  ok(potionAmount('hp', 'm') === 600 && potionPrice('mp', 'l') === 400 && potionSellPrice('mp', 'l') === 200, 'override changes amount and prices');
  ok(potionHeal('hp', 'm', 'sword') === 1200 && potionHeal('hp', 'm', 'mage') === 600, 'the swordsman bonus follows the override');
  const sim = new Sim(Object.values(ZONES)[0]);
  const data = newCharacterData('T', 'mage');
  data.level = 30;
  data.gold = 1000;
  const p = sim.addPlayer(data);
  const near = (sim as unknown as { near(p: unknown, id: string): boolean }).near.bind(sim);
  outer: for (let x = -60; x <= 60; x++) for (let z = -60; z <= 60; z++) {
    p.x = x;
    p.z = z;
    if (near(p, 'merchant')) break outer;
  }
  ok(sim.buyPotion(p, 'mp', 'l', 2) && p.gold === 1000 - 800, 'the shop charges the overridden price');
  applyBalance({});
  const g = p.gold;
  ok(sim.buyPotion(p, 'hp', 's', 4) && p.gold === g - 100, 'back to the code price after the override is removed');
}
// Dropped potion size follows the monster's level (owner 2026-11-21): small, medium from Lv21, large from Lv41; tunable.
applyBalance({});
ok(eq([1, 20, 21, 40, 41, 80].map(dropPotionSize), ['s', 's', 'm', 'm', 'l', 'l']), 'drops: Lv1-20 small, Lv21-40 medium, Lv41+ large');
ok(JSON.stringify(checkBalance({ potions: { dropM: 21, dropL: 41 } }, true).tuning) === '{}', 'drop levels equal to the code are not stored');
const dt = checkBalance({ potions: { dropM: 11, dropL: 81 } }, true).tuning!;
ok(dt.potions?.dropM === 11 && dt.potions?.dropL === 81, 'changed drop levels are stored');
ok('error' in checkBalance({ potions: { dropM: 0 } }, true) && 'error' in checkBalance({ potions: { dropL: 82 } }, true), 'drop levels out of 1-81 are refused');
applyBalance(dt);
ok(eq([10, 11, 80].map(dropPotionSize), ['s', 'm', 'm']), 'tuned: medium from Lv11, large never (81)');
ok(balanceChanges({}, dt).includes('ยากลางตั้งแต่ Lv 21 → 11'), 'the audit names the drop-level change');
applyBalance({});
finish('potions');
