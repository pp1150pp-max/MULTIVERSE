import type { IncomingMessage } from 'node:http';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Who sent the request (an HTTP call or a WebSocket upgrade). Everyone arriving through the Cloudflare
 * tunnel shows up as this computer, so trust the tunnel's headers — but only on connections from this
 * computer: CF-Connecting-IP, else the first X-Forwarded-For entry, else the socket address.
 */
export function clientIp(req: IncomingMessage): string {
  const remote = req.socket.remoteAddress ?? 'unknown';
  if (!LOOPBACK.has(remote)) return remote;
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return clean(cf);
  const xff = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0];
  return first?.trim() ? clean(first) : remote;
}

/** Headers are whatever the sender wrote: keep them short and on one line in the log. */
function clean(s: string): string {
  return s.replace(/[\p{Cc}\p{Cf}\s]/gu, '').slice(0, 64);
}
