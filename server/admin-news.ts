// "มีอะไรใหม่" tab of the admin page (src/admin/news.ts, docs/systems/news.md): add, edit, hide and delete the update notes
// the players read in the game, and the two switches. Looking = the `news` tool (owner + GM); changing = `newsEdit` (owner).
// Every value goes through cleanNews (src/shared/news.ts); every change is in the audit and reaches players online at once.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Db } from './db';
import type { GameWorld } from './world';
import { HttpError, readJson, send } from './http';
import { log, requireFeature } from './admin';
import { cleanNews, type AdminNews } from '../src/shared/news';

function state(db: Db, canEdit: boolean): AdminNews {
  return { notes: db.newsAll(), switches: db.newsSwitches(), canEdit };
}

/** Handles the news routes; returns false for any other path. */
export async function newsAdminApi(
  req: IncomingMessage, res: ServerResponse, path: string, method: string, db: Db, world: GameWorld,
): Promise<boolean> {
  if (!path.startsWith('/api/admin/news')) return false;

  if (method === 'GET' && path === '/api/admin/news') {
    const a = requireFeature(req, db, 'news');
    send(res, 200, state(db, a.features.includes('newsEdit')));
    return true;
  }
  if (method !== 'POST') return false;

  if (path === '/api/admin/news') {
    const a = requireFeature(req, db, 'newsEdit');
    const body = await readJson(req);
    const c = cleanNews(body.title, body.lines);
    if ('error' in c) throw new HttpError(400, c.error);
    const id = db.newsAdd(c.title, c.lines, a.acc.username);
    log(db, a, 'news-add', `#${id}`, `${c.title} · ${c.lines.length} บรรทัด`);
    world.newsPoll();
    send(res, 200, state(db, true));
    return true;
  }

  if (path === '/api/admin/news/switches') {
    const a = requireFeature(req, db, 'newsEdit');
    const body = await readJson(req);
    if (typeof body.button !== 'boolean' || typeof body.autopop !== 'boolean') throw new HttpError(400, 'ค่าสวิตช์ไม่ถูกต้อง');
    const before = db.newsSwitches();
    if (before.button !== body.button || before.autopop !== body.autopop) {
      db.setNewsSwitches({ button: body.button, autopop: body.autopop });
      log(db, a, 'news-switches', 'มีอะไรใหม่', `ปุ่ม ${before.button ? 'เปิด' : 'ปิด'} → ${body.button ? 'เปิด' : 'ปิด'} · เด้งเอง ${before.autopop ? 'เปิด' : 'ปิด'} → ${body.autopop ? 'เปิด' : 'ปิด'}`);
      world.newsPoll();
    }
    send(res, 200, state(db, true));
    return true;
  }

  const one = /^\/api\/admin\/news\/(\d{1,12})\/(edit|hide|delete)$/.exec(path);
  if (one) {
    const a = requireFeature(req, db, 'newsEdit');
    const id = Number(one[1]);
    const cur = db.newsGet(id);
    if (!cur) throw new HttpError(404, 'ไม่พบประกาศนี้ (อาจถูกลบไปแล้ว)');
    if (one[2] === 'edit') {
      const body = await readJson(req);
      const c = cleanNews(body.title, body.lines);
      if ('error' in c) throw new HttpError(400, c.error);
      db.newsEdit(id, { title: c.title, lines: c.lines });
      log(db, a, 'news-edit', `#${id}`, `${cur.title}${cur.title !== c.title ? ` → ${c.title}` : ''} · ${cur.lines.length} → ${c.lines.length} บรรทัด`);
    } else if (one[2] === 'hide') {
      const body = await readJson(req);
      if (typeof body.hidden !== 'boolean') throw new HttpError(400, 'ค่าไม่ถูกต้อง');
      db.newsEdit(id, { hidden: body.hidden });
      log(db, a, 'news-hide', `#${id}`, `${cur.title} · ${body.hidden ? 'ซ่อน' : 'แสดงอีกครั้ง'}`);
    } else {
      db.newsDelete(id);
      log(db, a, 'news-delete', `#${id}`, cur.title);
    }
    world.newsPoll();
    send(res, 200, state(db, true));
    return true;
  }
  return false;
}
