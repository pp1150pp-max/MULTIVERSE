// "แคชช็อป" tab of the admin page (src/admin/cashShop.ts): open / close sales, every item's settings, the
// top-up packages, cosmetic prices (kept in cos_shop, the same as the "จัดการของแต่งตัว" tab) and the newest
// purchases. Checked strictly here (src/shared/cashShop.ts), recorded in the audit, sent to every player.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db';
import type { GameWorld } from './world';
import { HttpError, readJson, send } from './http';
import { log, requireFeature, type Admin } from './admin';
import { cashShopChanges, checkCashShop, sameCashShop, type AdminCashShop } from '../src/shared/cashShop';
import { checkCosShop, cosShopChanges, sameCosShop, type CosShop } from '../src/shared/cosShop';
import { cosById } from '../src/shared/data/cosmetics';

/** Purchases listed on the tab. */
const RECENT = 200;

const state = (db: Db, world: GameWorld, a: Admin): AdminCashShop => ({
  cfg: world.cash.cfg(), cosShop: db.cosShop(), canEdit: a.features.includes('cashShopEdit'), recent: db.cashRecent(RECENT), orbs: db.orbItems().items,
});

const cut = (s: string) => (s.length > 1500 ? s.slice(0, 1500) + '…' : s);

/** Handles the cash shop routes; returns false for any other path. */
export async function cashAdminApi(
  req: IncomingMessage, res: ServerResponse, path: string, method: string, db: Db, world: GameWorld,
): Promise<boolean> {
  if (path !== '/api/admin/cash-shop') return false;
  if (method === 'GET') {
    send(res, 200, state(db, world, requireFeature(req, db, 'cashShop')));
    return true;
  }
  if (method !== 'POST') return false;
  const a = requireFeature(req, db, 'cashShopEdit');
  const body = await readJson(req);
  const beforeCfg = world.cash.cfg();
  const beforeCos = db.cosShop();
  // `base` = what the tab loaded. If the server's settings changed since, saving the whole set would undo that.
  const base = (body.base && typeof body.base === 'object' ? body.base : null) as { cfg?: unknown; cosShop?: unknown } | null;
  if (base) {
    const bCos = checkCosShop(base.cosShop, false).shop ?? {};
    const bCfg = checkCashShop(base.cfg, false, bCos).value;
    if (!bCfg || !sameCashShop(bCfg, beforeCfg) || !sameCosShop(bCos, beforeCos)) {
      throw new HttpError(409, 'ค่าของเซิร์ฟเปลี่ยนไปแล้วหลังโหลดหน้านี้ กดโหลดใหม่ก่อน');
    }
  }
  // Cosmetic prices: `cosPrices` = { id: price | null } for the changed ones; hiding stays as it is.
  let cos: CosShop = beforeCos;
  if (body.cosPrices !== undefined) {
    if (!body.cosPrices || typeof body.cosPrices !== 'object' || Array.isArray(body.cosPrices)) throw new HttpError(400, 'ราคาของแต่งตัวไม่ถูกต้อง');
    const next: Record<string, unknown> = JSON.parse(JSON.stringify(beforeCos));
    for (const [id, p] of Object.entries(body.cosPrices as Record<string, unknown>)) {
      if (!cosById(id)) throw new HttpError(400, `ไม่รู้จักของแต่งตัว ${id.slice(0, 40)}`);
      const e = { ...((next[id] as object | undefined) ?? {}) } as Record<string, unknown>;
      if (p === null) delete e.price;
      else e.price = p;
      next[id] = e;
    }
    const c = checkCosShop(next, true);
    if (!c.shop) throw new HttpError(400, c.error);
    cos = c.shop;
  }
  const c = checkCashShop(body.cfg, true, cos);
  if (!c.value) throw new HttpError(400, c.error);
  const cosChanged = !sameCosShop(beforeCos, cos);
  const cfgChanged = !sameCashShop(beforeCfg, c.value);
  if (cosChanged) {
    db.setCosShop(cos);
    log(db, a, 'cos-shop', 'ราคาของแต่งตัว (แท็บแคชช็อป)', cut(cosShopChanges(beforeCos, cos)));
  }
  if (cfgChanged) {
    world.cash.setCfg(c.value);
    log(db, a, 'cash-shop', 'แคชช็อป', cut(cashShopChanges(beforeCfg, c.value)));
  }
  if (cosChanged || cfgChanged) world.cashShopChanged();
  send(res, 200, state(db, world, a));
  return true;
}
