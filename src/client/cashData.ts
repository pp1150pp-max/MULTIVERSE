// What the browser knows of the cash shop (src/shared/cashShop.ts): the catalogue and this account's
// crystals / purchase counts. Set from `welcome`, `{ t: 'cash' }` and `{ t: 'cashState' }`; the window
// (src/client/cashShop.ts) redraws when `cashVersion()` changes.
import type { CashCatalog, CashState } from '../shared/cashShop';
import { closedTopup, type TopupView } from '../shared/topup';

let catalog: CashCatalog = { open: false, items: [], packages: [] };
let state: CashState = { crystals: 0, bought: {} };
let topup: TopupView = closedTopup();
let version = 0;

/** This account's top-up state (src/shared/topup.ts), from `welcome` and `{ t: 'topup' }`. */
export function useTopup(v: TopupView | undefined): void {
  if (!v) return;
  topup = v;
  version++;
}
export const topupNow = (): TopupView => topup;

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
