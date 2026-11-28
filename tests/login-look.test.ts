// "หน้า login แบบใหม่" switch (owner 2026-11-28): the /admin setting's checks. The look itself is CSS (src/styles/login-new.css).
import { finish, ok } from './check';
import { balanceChanges, checkBalance, codeBalance, mergeBalance } from '../src/shared/balance';

ok(codeBalance().loginLook === true, 'code default: on');
const t1 = checkBalance({ loginLook: false }, true);
ok('tuning' in t1 && t1.tuning?.loginLook === false, 'switch off is saved');
const t2 = checkBalance({ loginLook: true }, true);
ok('tuning' in t2 && t2.tuning?.loginLook === undefined, 'on (the code value) is not saved');
ok('error' in checkBalance({ loginLook: 'no' }, true), 'a non-boolean is refused');
ok(mergeBalance({ loginLook: false }).loginLook === false, 'merged config uses the saved value');
ok(mergeBalance({}).loginLook === true, 'unset = the code value');
ok(balanceChanges({}, { loginLook: false }).includes('หน้า login แบบใหม่'), 'the change makes a Thai audit line');
finish('login-look');
