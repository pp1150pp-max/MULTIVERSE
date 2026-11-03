// MULTIVERSE game server. Run with `npm run server` (or `npm run online` to build the game first).
// Serves the account API under /api and, when `dist/` exists, the game itself — so friends only
// need a browser and this computer's address.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Db } from './db';
import { AttemptLimiter, hashPassword, newToken, SESSION_MS, verifyPassword } from './auth';
import {
  checkCharacterName, checkPassword, checkUsername, isClassId, MAX_CHARACTERS,
  type AuthResponse, type CharacterSummary, type MeResponse,
} from '../src/shared/api';
import { newCharacterData } from '../src/shared/sim/Player';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 2567);
const DB_FILE = process.env.DB_FILE ?? join(ROOT, 'server', 'data', 'multiverse.db');
const DIST = join(ROOT, 'dist');
const MAX_BODY = 16 * 1024;

const db = new Db(DB_FILE);
const limiter = new AttemptLimiter();
db.deleteExpiredSessions();

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

// ------------------------------------------------------------ helpers

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'ข้อมูลที่ส่งมาใหญ่เกินไป');
    chunks.push(c as Buffer);
  }
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HttpError(400, 'รูปแบบข้อมูลไม่ถูกต้อง');
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function clientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? 'unknown';
}

function bearer(req: IncomingMessage): string {
  const h = req.headers.authorization ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

/** The logged-in account for this request, or a 401. */
function requireAccount(req: IncomingMessage): { id: number; username: string } {
  const token = bearer(req);
  const acc = token ? db.sessionAccount(token) : undefined;
  if (!acc) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่');
  return acc;
}

function startSession(accountId: number, username: string): AuthResponse {
  const token = newToken();
  db.createSession(token, accountId, Date.now() + SESSION_MS);
  return { token, username };
}

// ------------------------------------------------------------ API

async function api(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const method = req.method ?? 'GET';

  if (method === 'POST' && path === '/api/register') {
    const ip = clientIp(req);
    if (limiter.blocked(ip)) throw new HttpError(429, 'ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่');
    const body = await readJson(req);
    const username = str(body.username).trim();
    const password = str(body.password);
    const bad = checkUsername(username) ?? checkPassword(password);
    if (bad) throw new HttpError(400, bad);
    const id = db.createAccount(username, await hashPassword(password));
    if (id === null) {
      limiter.fail(ip);
      throw new HttpError(409, 'ชื่อผู้ใช้นี้มีคนใช้แล้ว');
    }
    console.log(`[account] registered ${username}`);
    return send(res, 201, startSession(id, username));
  }

  if (method === 'POST' && path === '/api/login') {
    const ip = clientIp(req);
    if (limiter.blocked(ip)) throw new HttpError(429, 'ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่');
    const body = await readJson(req);
    const acc = db.findAccount(str(body.username).trim());
    if (!acc || !(await verifyPassword(str(body.password), acc.pass_hash))) {
      limiter.fail(ip);
      throw new HttpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
    limiter.clear(ip);
    return send(res, 200, startSession(acc.id, acc.username));
  }

  if (method === 'POST' && path === '/api/logout') {
    const token = bearer(req);
    if (token) db.deleteSession(token);
    return send(res, 200, {});
  }

  if (method === 'GET' && path === '/api/me') {
    const acc = requireAccount(req);
    return send(res, 200, { username: acc.username } satisfies MeResponse);
  }

  if (path === '/api/characters' && method === 'GET') {
    const acc = requireAccount(req);
    return send(res, 200, db.listCharacters(acc.id) satisfies CharacterSummary[]);
  }

  if (path === '/api/characters' && method === 'POST') {
    const acc = requireAccount(req);
    const body = await readJson(req);
    const name = str(body.name).trim();
    const bad = checkCharacterName(name);
    if (bad) throw new HttpError(400, bad);
    if (!isClassId(body.classId)) throw new HttpError(400, 'กรุณาเลือกคลาส');
    if (db.countCharacters(acc.id) >= MAX_CHARACTERS) throw new HttpError(400, `สร้างตัวละครได้สูงสุด ${MAX_CHARACTERS} ตัวต่อบัญชี`);
    if (db.characterNameTaken(name)) throw new HttpError(409, 'ชื่อตัวละครนี้มีคนใช้แล้ว');
    const created = db.createCharacter(acc.id, newCharacterData(name, body.classId));
    console.log(`[character] ${acc.username} created ${name} (${body.classId})`);
    return send(res, 201, created);
  }

  const del = method === 'DELETE' && /^\/api\/characters\/(\d+)$/.exec(path);
  if (del) {
    const acc = requireAccount(req);
    if (!db.deleteCharacter(acc.id, Number(del[1]))) throw new HttpError(404, 'ไม่พบตัวละครนี้');
    console.log(`[character] ${acc.username} deleted character #${del[1]}`);
    return send(res, 200, {});
  }

  throw new HttpError(404, 'ไม่พบ API นี้');
}

// ------------------------------------------------------------ static game files

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function serveStatic(res: ServerResponse, path: string): Promise<void> {
  let file = resolve(DIST, '.' + decodeURIComponent(path));
  if (file !== DIST && !file.startsWith(DIST + sep)) throw new HttpError(403, 'Forbidden');
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    if (path === '/' || path === '/index.html') {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('ยังไม่ได้ build ตัวเกม — ปิด server แล้วรัน npm run online แทน npm run server');
      return;
    }
    throw new HttpError(404, 'Not found');
  }
}

// ------------------------------------------------------------ server

const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  try {
    if (path.startsWith('/api/')) await api(req, res, path);
    else if (req.method === 'GET' || req.method === 'HEAD') await serveStatic(res, path);
    else throw new HttpError(405, 'Method not allowed');
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: 'server มีปัญหา ลองใหม่อีกครั้ง' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nMULTIVERSE server พร้อมแล้ว — port ${PORT}`);
  console.log(`  เครื่องนี้:   http://localhost:${PORT}`);
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const tag = a.address.startsWith('100.') ? 'Tailscale' : 'วง LAN';
      console.log(`  ${tag.padEnd(10)} http://${a.address}:${PORT}`);
    }
  }
  console.log(`  ฐานข้อมูล:  ${DB_FILE}\n`);
});

const shutdown = () => {
  server.close();
  db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
