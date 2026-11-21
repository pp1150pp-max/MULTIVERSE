// Which road the game connection takes (owner 2026-11-20): straight to the VPS through a DNS-only hostname
// (lower ping) when the admin switch is on, else — or when that does not open within a few seconds — the
// usual `/ws` on this page's host through the Cloudflare tunnel. Asked again on every (re)connect, so turning
// the switch off moves everyone back on their next reconnect.
import { WS_PATH } from '../../shared/net/protocol';
import { NET_ROUTE_PATH, type NetRouteResponse } from '../../shared/api';

/** A direct try that has not opened by then falls back to the tunnel. */
export const DIRECT_OPEN_MS = 2500;
/** After a direct try failed, this tab uses the tunnel only for this long. */
export const DIRECT_BACKOFF_MS = 10 * 60_000;
/** How long the route question may take before the last answer (or the tunnel) is used. */
const ROUTE_ASK_MS = 1500;

/** The tunnel road: `/ws` on this page's own host. */
export function tunnelUrl(loc: { protocol: string; host: string } = location): string {
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}${WS_PATH}`;
}

/**
 * The direct URL the server offered, only if it is safe to send the login token there: `wss://<host>/ws`
 * (no port, query or credentials) on a sibling or parent-domain host of this page (ws.example.com for
 * play.example.com), and only on an https page. Anything else = null (tunnel only).
 */
export function checkDirectUrl(url: unknown, pageHostname: string, pageProtocol: string): string | null {
  if (typeof url !== 'string' || pageProtocol !== 'https:') return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'wss:' || u.pathname !== WS_PATH || u.search || u.hash || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  const page = pageHostname.toLowerCase();
  const labels = host.split('.');
  if (labels.length < 3 || host === page) return null;
  const parent = labels.slice(1).join('.');
  return page === parent || page.endsWith(`.${parent}`) ? u.href : null;
}

/** Roads to try in order: direct first unless it failed in this tab less than DIRECT_BACKOFF_MS ago. */
export function routeOrder(direct: string | null, tunnel: string, now: number, directFailedAt: number): string[] {
  return direct && now - directFailedAt >= DIRECT_BACKOFF_MS ? [direct, tunnel] : [tunnel];
}

/** The last answer to the route question (kept when asking fails, e.g. while the network is down). */
let lastDirect: string | null = null;
let directFailedAt = -Infinity;
/** Whether the connection opened last went direct (for the console). */
export let usingDirect = false;

async function askRoute(): Promise<string | null> {
  try {
    const res = await fetch(`/api${NET_ROUTE_PATH}`, { signal: AbortSignal.timeout(ROUTE_ASK_MS), cache: 'no-store' });
    if (res.ok) lastDirect = checkDirectUrl(((await res.json()) as NetRouteResponse).direct, location.hostname, location.protocol);
  } catch {
    // Keep the last answer.
  }
  return lastDirect;
}

/** A direct connection opened but died before the game started: use the tunnel for a while, like a failed open. */
export function directBroke(): void {
  if (usingDirect) directFailedAt = performance.now();
}

/** One connection being opened; cancel() stops it (and closes whatever socket it has). */
export class SocketAttempt {
  cancelled = false;
  private ws: WebSocket | null = null;
  private abort: (() => void) | null = null;

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    this.abort?.();
    const ws = this.ws;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try {
        ws.close();
      } catch {
        // Already closing.
      }
    }
  }

  /** Resolves with the socket once open; rejects on error/close, after `ms`, or when cancelled. */
  openOne(url: string, ms: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      if (this.cancelled) return reject(new Error('cancelled'));
      const ws = new WebSocket(url);
      this.ws = ws;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = (ok: boolean) => {
        clearTimeout(timer);
        this.abort = null;
        ws.onopen = ws.onerror = ws.onclose = null;
        if (ok) return resolve(ws);
        try {
          ws.close();
        } catch {
          // Already closing.
        }
        reject(new Error('not open'));
      };
      if (ms < Infinity) timer = setTimeout(() => done(false), ms);
      this.abort = () => done(false);
      ws.onopen = () => done(true);
      ws.onerror = ws.onclose = () => done(false);
    });
  }
}

/**
 * Opens the game connection: direct (when offered and not failed lately) with DIRECT_OPEN_MS to open, then
 * the tunnel (its own caller's timer limits it). Resolves with an open socket.
 */
export async function openGameSocket(att: SocketAttempt): Promise<WebSocket> {
  const tunnel = tunnelUrl();
  const direct = await askRoute();
  for (const url of routeOrder(direct, tunnel, performance.now(), directFailedAt)) {
    if (att.cancelled) break;
    const isDirect = url !== tunnel;
    try {
      const ws = await att.openOne(url, isDirect ? DIRECT_OPEN_MS : Infinity);
      if (usingDirect !== isDirect) console.info(`[net] connected ${isDirect ? 'direct' : 'through Cloudflare'}`);
      usingDirect = isDirect;
      return ws;
    } catch {
      if (isDirect && !att.cancelled) {
        directFailedAt = performance.now();
        console.warn(`[net] direct connection failed, using Cloudflare for ${DIRECT_BACKOFF_MS / 60_000} minutes`);
      }
    }
  }
  throw new Error('connect failed');
}
