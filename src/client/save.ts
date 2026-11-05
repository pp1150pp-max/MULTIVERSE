// Local save for singleplayer. Online characters are stored by the server instead.
import { newCharacterData, type CharacterData } from '../shared/sim/Player';
import type { ClassId } from '../shared/types';
import { cleanStash, type StashData } from '../shared/sim/stash';

export interface SaveData extends CharacterData {
  v: 1;
  metSeeker: boolean;
}

const KEY = 'multiverse-save-v1';

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    return d && d.v === 1 ? d : null;
  } catch {
    return null;
  }
}

export function writeSave(d: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Storage blocked or full: the session keeps working without saving.
  }
}

/** The singleplayer stash: its own key, so it outlives deleting or replacing the character. */
const STASH_KEY = 'multiverse-stash-v1';

export function loadStash(): StashData {
  try {
    const raw = localStorage.getItem(STASH_KEY);
    return cleanStash(raw ? JSON.parse(raw) : null);
  } catch {
    return cleanStash(null);
  }
}

export function writeStash(s: StashData): void {
  try {
    localStorage.setItem(STASH_KEY, JSON.stringify(s));
  } catch {
    // Storage blocked or full: the session keeps working without saving.
  }
}

export function newSave(name: string, classId: ClassId): SaveData {
  return { v: 1, ...newCharacterData(name, classId), metSeeker: false };
}
