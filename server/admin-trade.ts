// Trades tab of the admin page: the log of every completed player-to-player trade, newest first.
// Read only. The log is written by server/trade.ts inside the transaction that does the swap.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db';
import { HttpError, send } from './http';
import { requireAdmin } from './admin';
import { ADMIN_NO_RIGHTS } from '../src/shared/admin';

/** Trades listed per page. */
export const TRADE_LOG_PAGE = 30;
/** Longest name search text. */
const SEARCH_MAX = 40;

/** Handles the trade log route; returns false for any other path. */
export function tradeAdminApi(req: IncomingMessage, res: ServerResponse, path: string, method: string, db: Db): boolean {
  if (method !== 'GET' || path !== '/api/admin/trades') return false;
  const a = requireAdmin(req, db);
  if (!a.features.includes('tradeLog')) throw new HttpError(403, ADMIN_NO_RIGHTS);
  const params = new URL(req.url ?? '/', 'http://localhost').searchParams;
  const before = Number(params.get('before'));
  const q = (params.get('q') ?? '').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, SEARCH_MAX);
  send(res, 200, db.tradeLog(TRADE_LOG_PAGE, Number.isSafeInteger(before) && before > 0 ? before : undefined, q || undefined));
  return true;
}
