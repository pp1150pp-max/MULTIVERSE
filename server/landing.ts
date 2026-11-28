// The landing page's data (docs/systems/landing.md): GET /api/landing (public) and the close beta card on the
// /admin "มีอะไรใหม่" tab (src/admin/news.ts). Looking = the `news` tool, changing = `newsEdit`, like the notes.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db';
import { HttpError, readJson, send } from './http';
import { log, requireFeature } from './admin';
import { currentBalance } from '../src/shared/balance';
import { LANDING_API, LANDING_NEWS, cleanLanding, toThaiInput, type AdminLanding, type LandingView } from '../src/shared/landing';

export function landingView(db: Db): LandingView {
  const c = db.landingConfig();
  return { start: c.start, end: c.end, news: c.news ? db.newsVisible(LANDING_NEWS) : [], english: currentBalance().english };
}

/** GET /api/landing: no login, readable from another site (the page may live on its own domain), cached 30 s. */
export function landingPublicApi(res: ServerResponse, path: string, method: string, db: Db): boolean {
  if (path !== LANDING_API) return false;
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' });
    res.end();
    return true;
  }
  if (method !== 'GET') return false;
  const body = JSON.stringify(landingView(db));
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=30',
  });
  res.end(body);
  return true;
}

/** /api/admin/landing: the close beta window and the news switch. */
export async function landingAdminApi(req: IncomingMessage, res: ServerResponse, path: string, method: string, db: Db): Promise<boolean> {
  if (path !== '/api/admin/landing') return false;
  if (method === 'GET') {
    const a = requireFeature(req, db, 'news');
    send(res, 200, { config: db.landingConfig(), canEdit: a.features.includes('newsEdit') } satisfies AdminLanding);
    return true;
  }
  if (method !== 'POST') return false;
  const a = requireFeature(req, db, 'newsEdit');
  const c = cleanLanding(await readJson(req));
  if ('error' in c) throw new HttpError(400, c.error);
  const before = db.landingConfig();
  if (before.start !== c.start || before.end !== c.end || before.news !== c.news || before.apex !== c.apex) {
    db.setLandingConfig(c);
    const t = (at: number) => toThaiInput(at).replace('T', ' ');
    log(db, a, 'landing', 'หน้าแนะนำเกม', `${t(before.start)} – ${t(before.end)} → ${t(c.start)} – ${t(c.end)} · ข่าว ${before.news ? 'เปิด' : 'ปิด'} → ${c.news ? 'เปิด' : 'ปิด'} · โดเมนหลัก ${before.apex ? 'เปิด' : 'ปิด'} → ${c.apex ? 'เปิด' : 'ปิด'}`);
  }
  send(res, 200, { config: db.landingConfig(), canEdit: true } satisfies AdminLanding);
  return true;
}
