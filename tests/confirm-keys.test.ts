// Enter/Esc in confirm boxes switch (owner 2026-11-28): the /admin setting's checks. The keys themselves are browser side.
import { finish, ok } from './check';
import { balanceChanges, checkBalance, codeBalance, mergeBalance } from '../src/shared/balance';

ok(codeBalance().confirmKeys === true, 'code default: on');
const t1 = checkBalance({ confirmKeys: false }, true);
ok('tuning' in t1 && t1.tuning?.confirmKeys === false, 'switch off is saved');
const t2 = checkBalance({ confirmKeys: true }, true);
ok('tuning' in t2 && t2.tuning?.confirmKeys === undefined, 'on (the code value) is not saved');
ok('error' in checkBalance({ confirmKeys: 'no' }, true), 'a non-boolean is refused');
ok(mergeBalance({ confirmKeys: false }).confirmKeys === false, 'merged config uses the saved value');
ok(mergeBalance({}).confirmKeys === true, 'unset = the code value');
ok(balanceChanges({}, { confirmKeys: false }).includes('Enter/Esc'), 'the change makes a Thai audit line');
finish("confirm-keys");
