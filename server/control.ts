// Stopping the server from a script (npm run stop-server): the server writes a file next to its database
// with its pid and a random token, and accepts POST /api/server/stop only with that token, from this
// computer. A file plus an HTTP call works the same on Windows, where a killed npm task sends node no signal.
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { dirname, join } from 'node:path';

export const STOP_PATH = '/api/server/stop';
export const TOKEN_HEADER = 'x-control-token';

export interface ControlFile { pid: number; port: number; token: string }

/** Where the server keeps its control file: beside the database (server/data, git-ignored). */
export function controlFilePath(dbFile: string, port: number): string {
  return join(dirname(dbFile), `control-${port}.json`);
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * True only for a request made on this computer with the right token. The tunnel (cloudflared) also
 * connects from this computer, so requests it forwards (they carry Cloudflare headers) are refused too;
 * the token is the real lock.
 */
export function isLocalControl(req: IncomingMessage, token: string): boolean {
  if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) return false;
  if (req.headers['cf-connecting-ip'] || req.headers['cf-ray'] || req.headers['x-forwarded-for']) return false;
  const got = Buffer.from(String(req.headers[TOKEN_HEADER] ?? ''));
  const want = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}
