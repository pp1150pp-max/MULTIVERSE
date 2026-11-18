// Blacksmith Auto enhance (owner 2026-11-18): a browser-side button that sends the usual enhance action again and
// again. Its /admin switch (balance tab, "ตีบวก" card) is on in the code and only an off is saved.
import { balanceChanges, checkBalance, mergeBalance } from '../src/shared/balance';
import { finish, ok } from './check';

ok(mergeBalance({}).forgeAuto === true, 'code default: on');
ok(JSON.stringify(checkBalance({ forgeAuto: true }, true).tuning) === '{}', 'the code value is not saved');
ok(checkBalance({ forgeAuto: false }, true).tuning?.forgeAuto === false, 'off is kept');
ok(mergeBalance({ forgeAuto: false }).forgeAuto === false, 'off is applied');
ok('error' in checkBalance({ forgeAuto: 'yes' }, true), 'a non-boolean is refused');
ok(checkBalance({ forgeAuto: 'yes' }, false).tuning?.forgeAuto === undefined, 'a bad saved value is dropped when loading');
ok(balanceChanges({}, { forgeAuto: false }).includes('ตีบวก Auto เปิด → ปิด'), 'the audit names it');

finish('forge-auto');
