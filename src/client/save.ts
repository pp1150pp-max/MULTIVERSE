// Local save for singleplayer. Online characters are stored by the server instead.
import { newCharacterData, type CharacterData } from '../shared/sim/Player';
import type { ClassId } from '../shared/types';

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

export function newSave(name: string, classId: ClassId): SaveData {
  return { v: 1, ...newCharacterData(name, classId), metSeeker: false };
}
