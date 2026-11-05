// MULTIVERSE game server. Run with `npm run server` (or `npm run online` to build the game first).
// Serves the account API under /api and, when `dist/` exists, the game itself — so friends only
// need a browser and this computer's address.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { clientIp } from './clientIp';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { Db, type SessionAccount } from './db';
import { AttemptLimiter, hashPassword, newToken, SESSION_MS, verifyPassword } from './auth';
import {
  checkCharacterName, checkPassword, checkUsername, GUEST_PER_IP_HOUR, isClassId, MAX_CHARACTERS,
  type AuthResponse, type CharacterSummary, type GuestResponse, type MeResponse,
} from '../src/shared/api';
import { newCharacterData } from '../src/shared/sim/Player';
import { GameWorld } from './world';
import { announceShared, runningTunnel, startTunnel } from './tunnel';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 2567);
const DB_FILE = process.env.DB_FILE ?? join(ROOT, 'server', 'data', 'multiverse.db');
const DIST = join(ROOT, 'dist');
const MAX_BODY = 16 * 1024;
/** `--public`: also open a Cloudflare link so friends can join from anywhere (npm run online). */
const PUBLIC = process.argv.includes('--public');

const db = new Db(DB_FILE);
const limiter = new AttemptLimiter();
/** Brake on making guests: each new guest counts as one "attempt" for its address. */
const guestLimiter = new AttemptLimiter(GUEST_PER_IP_HOUR, 60 * 60 * 1000);
const CLEANUP_MS = 60 * 60 * 1000;
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

function bearer(req: IncomingMessage): string {
  const h = req.headers.authorization ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

/** The logged-in account (or guest) for this request, or a 401. */
function requireAccount(req: IncomingMessage): SessionAccount {
  const token = bearer(req);
  const acc = token ? db.sessionAccount(token) : undefined;
  if (!acc) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่');
  return acc;
}

/** Like requireAccount, but guests (who have exactly one character) are turned away. */
function requireRealAccount(req: IncomingMessage): SessionAccount {
  const acc = requireAccount(req);
  if (acc.guest) throw new HttpError(403, 'Guest ทำแบบนี้ไม่ได้ — สมัครสมาชิกก่อน');
  return acc;
}

/** Deletes guests nobody has played for a day (never one that is in the world right now). */
function cleanupGuests(): void {
  const n = db.deleteStaleGuests(world.onlineAccounts());
  if (n) console.log(`[guest] deleted ${n} guest(s) not online for a day`);
  db.deleteExpiredSessions();
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
    if (db.findAccount(username)) {
      limiter.fail(ip);
      throw new HttpError(409, 'ชื่อผู้ใช้นี้มีคนใช้แล้ว');
    }
    const passHash = await hashPassword(password);
    // Signing up from a browser that plays a guest: that guest becomes the new account, character and all.
    const guestToken = str(body.guestToken);
    const guest = guestToken ? db.sessionAccount(guestToken) : undefined;
    if (guest?.guest) {
      world.kickAccount(guest.id, 'ตัวละคร Guest ย้ายเข้าบัญชีใหม่แล้ว — เข้าสู่ระบบเพื่อเล่นต่อ');
      if (!db.upgradeGuest(guest.id, username, passHash)) throw new HttpError(409, 'ชื่อผู้ใช้นี้มีคนใช้แล้ว');
      console.log(`[account] registered ${username} (from guest #${guest.id})`);
      return send(res, 201, startSession(guest.id, username));
    }
    const id = db.createAccount(username, passHash);
    if (id === null) {
      limiter.fail(ip);
      throw new HttpError(409, 'ชื่อผู้ใช้นี้มีคนใช้แล้ว');
    }
    console.log(`[account] registered ${username}`);
    return send(res, 201, startSession(id, username));
  }

  // New guest (name + class). Sent with a guest's token, it replaces that guest ("start a new guest").
  if (method === 'POST' && path === '/api/guest') {
    const ip = clientIp(req);
    if (guestLimiter.blocked(ip)) throw new HttpError(429, `สร้าง Guest ได้ไม่เกิน ${GUEST_PER_IP_HOUR} ตัวต่อชั่วโมง รอสักครู่แล้วลองใหม่`);
    const body = await readJson(req);
    const name = str(body.name).trim();
    const bad = checkCharacterName(name);
    if (bad) throw new HttpError(400, bad);
    if (!isClassId(body.classId)) throw new HttpError(400, 'กรุณาเลือกคลาส');
    const token = bearer(req);
    const old = token ? db.sessionAccount(token) : undefined;
    const replacing = old?.guest ? old.id : -1;
    if (db.characterNameTaken(name, replacing)) throw new HttpError(409, 'ชื่อตัวละครนี้มีคนใช้แล้ว');
    if (replacing >= 0) {
      world.kickAccount(replacing, 'เริ่ม Guest ใหม่แล้ว');
      db.deleteGuest(replacing);
    }
    guestLimiter.fail(ip);
    const { accountId, character } = db.createGuest(randomBytes(8).toString('hex'), newCharacterData(name, body.classId));
    const session = startSession(accountId, '');
    console.log(`[guest] #${accountId} created ${name} (${body.classId})${replacing >= 0 ? ` replacing guest #${replacing}` : ''}`);
    return send(res, 201, { token: session.token, character } satisfies GuestResponse);
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
    return send(res, 200, { username: acc.guest ? 'Guest' : acc.username, guest: acc.guest } satisfies MeResponse);
  }

  if (path === '/api/characters' && method === 'GET') {
    const acc = requireAccount(req);
    return send(res, 200, db.listCharacters(acc.id) satisfies CharacterSummary[]);
  }

  if (path === '/api/characters' && method === 'POST') {
    const acc = requireRealAccount(req);
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
    const acc = requireRealAccount(req);
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

/** Vite's build output: `assets/<name>-<hash>.<ext>`. A new build gets new names, so these never change. */
const HASHED = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|jpg|svg)$/;

/**
 * Browser caching. Hashed build files are cached for a year: new code ships under new names.
 * Everything else (index.html, the sprites copied from public/ under fixed names) is `no-cache`:
 * the browser keeps its copy but checks every time, and gets a body-less 304 when the file is
 * unchanged. So art and code changed before a restart reach players right away.
 */
function cacheControl(path: string): string {
  return HASHED.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache';
}

/** True when the browser's copy (If-None-Match, else If-Modified-Since) is still current. */
function notModified(req: IncomingMessage, etag: string, mtime: Date): boolean {
  const inm = req.headers['if-none-match'];
  if (inm) return inm.split(',').some((t) => t.trim() === etag || t.trim() === '*');
  const ims = req.headers['if-modified-since'];
  // HTTP dates carry whole seconds only.
  return !!ims && Math.floor(mtime.getTime() / 1000) <= Math.floor(Date.parse(ims) / 1000);
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  let file = resolve(DIST, '.' + decodeURIComponent(path));
  if (file !== DIST && !file.startsWith(DIST + sep)) throw new HttpError(403, 'Forbidden');
  try {
    let info = await stat(file);
    if (info.isDirectory()) {
      file = join(file, 'index.html');
      info = await stat(file);
    }
    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const headers = { 'Cache-Control': cacheControl(path), ETag: etag, 'Last-Modified': info.mtime.toUTCString() };
    if (notModified(req, etag, info.mtime)) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      ...headers,
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': data.length,
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    if (path === '/' || path === '/index.html') {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
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
    else if (req.method === 'GET' || req.method === 'HEAD') await serveStatic(req, res, path);
    else throw new HttpError(405, 'Method not allowed');
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: 'server มีปัญหา ลองใหม่อีกครั้ง' });
  }
});

const world = new GameWorld(db, server);
cleanupGuests();
setInterval(cleanupGuests, CLEANUP_MS);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nMULTIVERSE server พร้อมแล้ว — port ${PORT}`);
  console.log(`  เครื่องนี้:   http://localhost:${PORT}`);
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      console.log(`  Wi-Fi บ้าน:  http://${a.address}:${PORT}`);
    }
  }
  console.log(`  ฐานข้อมูล:  ${DB_FILE}\n`);
  // A tunnel window (npm run tunnel) that is already up keeps its link across server restarts.
  const shared = PUBLIC ? runningTunnel(PORT) : null;
  if (shared) announceShared(shared);
  else if (PUBLIC) void startTunnel(PORT).then((t) => (tunnel = t));
  else console.log('  (อยากได้ลิงก์ให้เพื่อนนอกบ้าน: ปิดหน้าต่างนี้ แล้วใช้ npm run online แทน)\n');
});

let tunnel: Awaited<ReturnType<typeof startTunnel>> = null;

const shutdown = () => {
  world.saveAll();
  tunnel?.kill();
  server.close();
  db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
