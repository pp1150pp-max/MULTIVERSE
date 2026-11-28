// The "แต่งตัว" window switch (owner 2026-11-28: off in code): the /admin setting's checks. It only hides the
// window and the buttons that open it (browser side); wearing pieces from the fashion bag is not affected.
import { finish, ok } from './check';
import { balanceChanges, checkBalance, codeBalance, mergeBalance } from '../src/shared/balance';

ok(codeBalance().wardrobeMenu === false, 'code default: off');
const t1 = checkBalance({ wardrobeMenu: true }, true);
ok('tuning' in t1 && t1.tuning?.wardrobeMenu === true, 'switch on is saved');
const t2 = checkBalance({ wardrobeMenu: false }, true);
ok('tuning' in t2 && t2.tuning?.wardrobeMenu === undefined, 'off (the code value) is not saved');
ok('error' in checkBalance({ wardrobeMenu: 'yes' }, true), 'a switch that is not on/off refused');
ok(mergeBalance({ wardrobeMenu: true }).wardrobeMenu === true, 'merged config uses the saved value');
ok(mergeBalance({}).wardrobeMenu === false, 'unset = the code value');
ok(mergeBalance({}).menuLayout !== mergeBalance({}).menuLayout, 'every merge gives a new menu layout object, so the menu is drawn again');
ok(balanceChanges({}, { wardrobeMenu: true }).includes('หน้าต่างแต่งตัว'), 'the change makes a Thai audit line');
finish('wardrobe-menu');
