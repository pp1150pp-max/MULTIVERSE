// "No wear / take off while the merchant window is open" switch (owner 2026-11-22): the /admin setting's checks.
// The block itself is browser side (the server cannot tell the window is open), so there is no server part.
import { finish, ok } from './check';
import { balanceChanges, checkBalance, codeBalance, mergeBalance } from '../src/shared/balance';

ok(codeBalance().shopNoEquip === true, 'code default: on');
const t1 = checkBalance({ shopNoEquip: false }, true);
ok('tuning' in t1 && t1.tuning?.shopNoEquip === false, 'switch off is saved');
const t2 = checkBalance({ shopNoEquip: true }, true);
ok('tuning' in t2 && t2.tuning?.shopNoEquip === undefined, 'on (the code value) is not saved');
ok('error' in checkBalance({ shopNoEquip: 'no' }, true), 'a switch that is not on/off refused');
ok(mergeBalance({ shopNoEquip: false }).shopNoEquip === false, 'merged config uses the saved value');
ok(mergeBalance({}).shopNoEquip === true, 'unset = the code value');
ok(balanceChanges({}, { shopNoEquip: false }).includes('ห้ามถอด/สวมขณะเปิดร้าน'), 'the change makes a Thai audit line');
finish('shop-no-equip');
