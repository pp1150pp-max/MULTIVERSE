// Direct game connection (owner 2026-11-20, docs/systems/server-ops.md "ต่อตรง"): players' WebSocket may skip
// the Cloudflare tunnel and come straight to the VPS through a DNS-only hostname (lower ping). Caddy on the
// VPS takes TLS on 443 for that hostname and passes only /ws to DIRECT_PORT on 127.0.0.1 (tools/Caddyfile).
// That port is a listener of its own, so a connection is known to be direct by where it arrived — never by
// a header a player could write — and the CF-* headers are never trusted there.
import type { IncomingMessage } from 'node:http';
import type { Db } from './db';
import { DIRECT_WS_HOST_DEFAULT, DIRECT_WS_IP_MAX_DEFAULT, DIRECT_WS_IP_MAX_RANGE } from '../src/shared/admin';

/** Local port Caddy passes direct /ws traffic to. Env DIRECT_WS_PORT (0 = none); by default only the live port (2567) gets one. */
export function directPort(gamePort: number): number {
  const env = process.env.DIRECT_WS_PORT;
  if (env !== undefined && env !== '') return Math.max(0, Math.floor(Number(env)) || 0);
  return gamePort === 2567 ? 2569 : 0;
}

const ON_KEY = 'direct_ws';
const HOST_KEY = 'direct_ws_host';
const IP_MAX_KEY = 'direct_ws_ip_max';

export interface DirectSettings { on: boolean; host: string; ipMax: number }

/** Saved settings (only what differs from the code: off, DIRECT_WS_HOST_DEFAULT, DIRECT_WS_IP_MAX_DEFAULT). */
export function directSettings(db: Db): DirectSettings {
  const host = db.getSetting(HOST_KEY);
  const max = Number(db.getSetting(IP_MAX_KEY));
  return {
    on: db.getSetting(ON_KEY) === '1',
    host: host && checkDirectHost(host) === null ? host : DIRECT_WS_HOST_DEFAULT,
    ipMax: Number.isInteger(max) && max >= DIRECT_WS_IP_MAX_RANGE[0] && max <= DIRECT_WS_IP_MAX_RANGE[1] ? max : DIRECT_WS_IP_MAX_DEFAULT,
  };
}

export function saveDirectSettings(db: Db, s: DirectSettings): void {
  db.setSetting(ON_KEY, s.on ? '1' : null);
  db.setSetting(HOST_KEY, s.host === DIRECT_WS_HOST_DEFAULT ? null : s.host);
  db.setSetting(IP_MAX_KEY, s.ipMax === DIRECT_WS_IP_MAX_DEFAULT ? null : String(s.ipMax));
}

/** Null when `host` is a plain lowercase hostname with at least three labels (ws.example.com), else why not. */
export function checkDirectHost(host: string): string | null {
  if (host.length > 100) return 'ชื่อยาวเกินไป';
  const labels = host.split('.');
  if (labels.length < 3) return 'ต้องเป็นชื่อย่อยของโดเมน เช่น ws.multiverse-game.com';
  if (!labels.every((l) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) return 'ใช้ได้แค่ a–z 0–9 และ - (ตัวพิมพ์เล็ก)';
  return null;
}

/**
 * The browser page that opened this direct connection must be on the same domain as the direct hostname
 * (play.example.com for ws.example.com): other sites cannot use our direct port. No Origin = refused.
 */
export function directOriginOk(origin: string | undefined, host: string): boolean {
  if (!origin) return false;
  let page: string;
  try {
    page = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  const parent = host.split('.').slice(1).join('.');
  return page === parent || page.endsWith(`.${parent}`);
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * The player's address on the direct port: Caddy appends the address it saw to X-Forwarded-For, so the LAST
 * entry is Caddy's own (anything before it came from the player). From anything but this machine = the socket.
 */
export function directIp(req: IncomingMessage): string {
  const remote = req.socket.remoteAddress ?? 'unknown';
  if (!LOOPBACK.has(remote)) return remote;
  const xff = req.headers['x-forwarded-for'];
  const last = (Array.isArray(xff) ? xff.join(',') : xff ?? '').split(',').pop()?.trim();
  return last ? last.replace(/[\p{Cc}\p{Cf}\s]/gu, '').slice(0, 64) : remote;
}
