// Online account API: request/response shapes and validation rules, shared by the browser and
// the server so both check names and passwords the same way.
import type { ClassId } from './types';
import { CLASS_IDS } from './data/classes';

export const MAX_CHARACTERS = 3;
export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72;
/** Letters (Thai included), digits, underscore and inner spaces; 2–16 characters. */
const CHAR_NAME_RE = /^[\p{L}\p{M}\p{N}_](?:[\p{L}\p{M}\p{N}_ ]{0,14}[\p{L}\p{M}\p{N}_])?$/u;

/** Returns an error message in Thai, or null when the value is fine. */
export function checkUsername(u: string): string | null {
  return USERNAME_RE.test(u) ? null : 'ชื่อผู้ใช้ต้องยาว 3–16 ตัว ใช้ได้เฉพาะ A–Z, 0–9 และ _';
}

export function checkPassword(p: string): string | null {
  if (p.length < PASSWORD_MIN) return `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN} ตัว`;
  if (p.length > PASSWORD_MAX) return `รหัสผ่านยาวได้ไม่เกิน ${PASSWORD_MAX} ตัว`;
  return null;
}

export function checkCharacterName(n: string): string | null {
  if (n.length < 2 || n.length > 16 || !CHAR_NAME_RE.test(n)) {
    return 'ชื่อตัวละครต้องยาว 2–16 ตัว ใช้ได้เฉพาะตัวอักษร ตัวเลข _ และเว้นวรรคตรงกลาง';
  }
  return null;
}

export function isClassId(v: unknown): v is ClassId {
  return typeof v === 'string' && (CLASS_IDS as string[]).includes(v);
}

// ------------------------------------------------------------ requests / responses

export interface AuthRequest { username: string; password: string }
export interface AuthResponse { token: string; username: string }
export interface MeResponse { username: string }

/** One row on the character select screen. */
export interface CharacterSummary { id: number; name: string; classId: ClassId; level: number }
export interface CreateCharacterRequest { name: string; classId: ClassId }

/** Every failed request answers with this body and a 4xx/5xx status. */
export interface ApiError { error: string }
