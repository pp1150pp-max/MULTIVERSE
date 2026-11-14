// Talks to the game server's account API. The server is the same address the game was loaded
// from (Vite forwards /api to it during development).
//
// The browser remembers up to two tokens: the logged-in account's, and a guest's. A guest is a
// temporary account on the server with one character; the token is all this browser keeps of it.
import type {
  ApiError, AuthResponse, CharacterSummary, GoogleConfigResponse, GoogleFinishResponse, GoogleStartRequest, GoogleStartResponse, GuestResponse, MeResponse,
} from '../../shared/api';
import type { ClassId } from '../../shared/types';

const TOKEN_KEY = 'multiverse-online-token';
const GUEST_KEY = 'multiverse-guest-token';

export class ApiFailure extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, token: string | null): void {
  try {
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
  } catch {
    // Storage blocked: the login just won't be remembered.
  }
}

export const savedToken = (): string | null => read(TOKEN_KEY);
export const guestToken = (): string | null => read(GUEST_KEY);

/** Calls the API as the account (default) or as the guest; a 401 forgets the token that was used. */
async function call<T>(method: string, path: string, body?: unknown, as: 'account' | 'guest' = 'account'): Promise<T> {
  const key = as === 'guest' ? GUEST_KEY : TOKEN_KEY;
  const token = read(key);
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
    throw new ApiFailure(0, 'เชื่อมต่อ server ไม่ได้ — server เปิดอยู่หรือเปล่า? (npm run dev)');
  }
  const data = (await res.json().catch(() => ({}))) as T | ApiError;
  if (!res.ok) {
    const msg = (data as ApiError).error ?? `server ตอบกลับผิดพลาด (${res.status})`;
    if (res.status === 401) store(key, null);
    throw new ApiFailure(res.status, msg);
  }
  return data as T;
}

/** Signing up from a browser with a guest moves that guest's character into the new account. */
export async function register(username: string, password: string): Promise<AuthResponse> {
  const r = await call<AuthResponse>('POST', '/register', { username, password, guestToken: guestToken() ?? undefined });
  store(TOKEN_KEY, r.token);
  store(GUEST_KEY, null);
  return r;
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const r = await call<AuthResponse>('POST', '/login', { username, password });
  store(TOKEN_KEY, r.token);
  return r;
}

export async function logout(): Promise<void> {
  await call('POST', '/logout').catch(() => undefined);
  store(TOKEN_KEY, null);
}

export const me = () => call<MeResponse>('GET', '/me');
export const listCharacters = () => call<CharacterSummary[]>('GET', '/characters');
export const createCharacter = (name: string, classId: ClassId) => call<CharacterSummary>('POST', '/characters', { name, classId });
export const deleteCharacter = (id: number) => call<object>('DELETE', `/characters/${id}`);

// ------------------------------------------------------------ Google login (server/google.ts)

/** Whether the Login page offers Google (false on any failure: the button just stays hidden). */
export const googleEnabled = (): Promise<boolean> =>
  call<GoogleConfigResponse>('GET', '/auth/google/config').then((r) => r.enabled, () => false);

/**
 * Leaves for Google. login / upgrade send this browser's guest token (a new account takes the guest's
 * character); link uses the logged-in account's token.
 */
export async function googleStart(mode: GoogleStartRequest['mode']): Promise<never> {
  const r = await call<GoogleStartResponse>('POST', '/auth/google/start',
    { mode, guestToken: mode === 'link' ? undefined : guestToken() ?? undefined } satisfies GoogleStartRequest);
  location.assign(r.url);
  return new Promise<never>(() => {});
}

/** Reads the ticket Google's round trip came back with; with `username`, makes the new account. A login is remembered. */
export async function googleFinish(ticket: string, username?: string, movedGuest = false): Promise<GoogleFinishResponse> {
  const r = await call<GoogleFinishResponse>('POST', '/auth/google/finish', { ticket, username });
  if (r.kind === 'session') {
    store(TOKEN_KEY, r.token);
    if (movedGuest) store(GUEST_KEY, null);
  }
  return r;
}

export const unlinkGoogle = () => call<object>('POST', '/auth/google/unlink', {});

// ------------------------------------------------------------ guest

/** This browser's guest character, or null when there is none (never made, or deleted for being away a day). */
export async function guestCharacter(): Promise<CharacterSummary | null> {
  if (!guestToken()) return null;
  try {
    return (await call<CharacterSummary[]>('GET', '/characters', undefined, 'guest'))[0] ?? null;
  } catch (e) {
    if (e instanceof ApiFailure && e.status === 401) return null;
    throw e;
  }
}

/** Makes a new guest; replaces this browser's old guest (the server deletes it). */
export async function createGuest(name: string, classId: ClassId): Promise<GuestResponse> {
  const r = await call<GuestResponse>('POST', '/guest', { name, classId }, 'guest');
  store(GUEST_KEY, r.token);
  return r;
}
