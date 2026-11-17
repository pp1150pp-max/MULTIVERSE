// What the browser knows of the cash shop (src/shared/cashShop.ts): the catalogue and this account's
// crystals / purchase counts. Set from `welcome`, `{ t: 'cash' }` and `{ t: 'cashState' }`; the window
// (src/client/cashShop.ts) redraws when `cashVersion()` changes.
import type { CashCatalog, CashState } from '../shared/cashShop';

let catalog: CashCatalog = { open: false, items: [], packages: [] };
let state: CashState = { crystals: 0, bought: {} };
let version = 0;

export function useCash(cat: CashCatalog | undefined): void {
  if (!cat) return;
  catalog = cat;
  version++;
}

export function useCashState(st: CashState | undefined): void {
  if (!st) return;
  state = st;
  version++;
}

export const cashCatalogNow = (): CashCatalog => catalog;
export const cashStateNow = (): CashState => state;
export const cashVersion = (): number => version;
