import { ADMIN_NO_RIGHTS as NO_RIGHTS, BAN_FOREVER, type AdminFeature, type AdminMe, type AdminMeta, type AdminOnline } from '../shared/admin';
import { CLASSES } from '../shared/data/classes';
import { type ClassId } from '../shared/types';

export const ADMIN_TOKEN = 'multiverse-admin-token';
/** The game's own login: used when the owner is already logged in to the game in this browser. */
export const GAME_TOKEN = 'multiverse-online-token';
export const REFRESH_MS = 3000;
/** Above this ping / below this frame rate / above this frame time, the number is shown in red. */
export const PING_BAD = 200;
export const FPS_BAD = 30;
export const FRAME_BAD = 1000;

// ------------------------------------------------------------ small helpers

export type Kids = (Node | string | null | undefined | false)[];
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: Kids): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (k in el) (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function store(key: string, v: string | null): void {
  try {
    if (v) localStorage.setItem(key, v);
    else localStorage.removeItem(key);
  } catch {
    // storage blocked: the login just isn't remembered
  }
}

export let token: string | null = read(ADMIN_TOKEN) ?? read(GAME_TOKEN);
export function setToken(v: string | null): void {
  token = v;
}

/** Functions another module sets when it loads, so tab files need not import main.ts (or each other in a circle). */
export const hooks: { authLost: (e: ApiError) => void; setTab: (t: Tab) => void; openAccount: (id: number) => void } = {
  authLost: () => undefined,
  setTab: () => undefined,
  openAccount: () => undefined,
};

export class ApiError extends Error {
  constructor(readonly status: number, msg: string) {
    super(msg);
  }
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'เชื่อมต่อ server ไม่ได้');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const err = new ApiError(res.status, data.error ?? `server ตอบกลับผิดพลาด (${res.status})`);
    // A 403 with its own reason (e.g. a GM editing the owner's character) is shown where it happened;
    // only the plain "no rights" one means this login lost its role.
    if (res.status === 401 || (res.status === 403 && data.error === NO_RIGHTS)) hooks.authLost(err);
    throw err;
  }
  return data;
}

export const fmt = (n: number): string => n.toLocaleString('th-TH');
/** "12 นาที", or "1 ชม. 5 นาที" from an hour on. */
export const playedFor = (ms: number): string => {
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m} นาที` : `${Math.floor(m / 60)} ชม. ${m % 60} นาที`;
};
export const className = (id: ClassId): string => CLASSES[id]?.nameTh ?? id;
export const time = (ms: number): string =>
  new Date(ms).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const root = document.getElementById('admin')!;
export let me: AdminMe | null = null;
export let meta: AdminMeta | null = null;
export let online: AdminOnline | null = null;
// Imported bindings cannot be assigned from another module, so each has a setter.
export function setMe(v: AdminMe | null): void {
  me = v;
}
export function setMeta(v: AdminMeta | null): void {
  meta = v;
}
export function setOnline(v: AdminOnline | null): void {
  online = v;
}
export type Tab = 'online' | 'users' | 'stats' | 'sessions' | 'chat' | 'mail' | 'trades' | 'reports' | 'orbs' | 'cos' | 'cosManage' | 'rig' | 'anim' | 'cards' | 'balance' | 'skills' | 'menuLayout' | 'hudLayout' | 'maps' | 'daily' | 'news' | 'mysteryBox' | 'cashShop' | 'topup' | 'roles' | 'audit' | 'broadcast' | 'server';
export let tab: Tab = 'online';
export function setCurrentTab(t: Tab): void {
  tab = t;
}
export let timer = 0;
export function setTimer(v: number): void {
  timer = v;
}

export const zoneName = (id: string): string => meta?.zones.find((z) => z.id === id)?.nameTh ?? id;

export const view = h('main');

export function stopRefresh(): void {
  clearTimeout(timer);
  timer = 0;
}

/** The open character / account sheet (the pop-up over the page). */
export let sheet: HTMLElement | null = null;
export function setSheet(v: HTMLElement | null): void {
  sheet = v;
}

export function closeSheet(): void {
  sheet?.remove();
  sheet = null;
}

export const can = (f: AdminFeature): boolean => !!me?.features.includes(f);
/** A role's display name ("Owner", "GM", "ผู้ทดสอบ"…). */
export const roleLabel = (role: string): string => me?.roleNames[role] ?? role;
export const dateOnly = (ms: number): string => new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
export const ago = (ms: number): string => {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'เมื่อสักครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีก่อน`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ก่อน`;
  return `${Math.floor(s / 86400)} วันก่อน`;
};
export const banText = (until: number): string => (until >= BAN_FOREVER ? 'ถาวร' : `ถึง ${time(until)}`);
