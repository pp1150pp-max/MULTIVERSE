// Talks to the game server's account API. The server is the same address the game was loaded
// from (Vite forwards /api to it during development).
import type { ApiError, AuthResponse, CharacterSummary, MeResponse } from '../../shared/api';
import type { ClassId } from '../../shared/types';

const TOKEN_KEY = 'multiverse-online-token';

export class ApiFailure extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function savedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the login just won't be remembered.
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = savedToken();
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
    throw new ApiFailure(0, 'เชื่อมต่อ server ไม่ได้ — server เปิดอยู่หรือเปล่า? (npm run server)');
  }
  const data = (await res.json().catch(() => ({}))) as T | ApiError;
  if (!res.ok) {
    const msg = (data as ApiError).error ?? `server ตอบกลับผิดพลาด (${res.status})`;
    if (res.status === 401) storeToken(null);
    throw new ApiFailure(res.status, msg);
  }
  return data as T;
}

export async function register(username: string, password: string): Promise<AuthResponse> {
  const r = await call<AuthResponse>('POST', '/register', { username, password });
  storeToken(r.token);
  return r;
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const r = await call<AuthResponse>('POST', '/login', { username, password });
  storeToken(r.token);
  return r;
}

export async function logout(): Promise<void> {
  await call('POST', '/logout').catch(() => undefined);
  storeToken(null);
}

export const me = () => call<MeResponse>('GET', '/me');
export const listCharacters = () => call<CharacterSummary[]>('GET', '/characters');
export const createCharacter = (name: string, classId: ClassId) => call<CharacterSummary>('POST', '/characters', { name, classId });
export const deleteCharacter = (id: number) => call<object>('DELETE', `/characters/${id}`);
