// Local save for the offline prototype. When the Colyseus server lands,
// this becomes the account/character record stored server-side.
import type { ClassId, Item, SlotId } from '../shared/types';
import { starterWeapon } from '../shared/data/items';

export interface SaveData {
  v: 1;
  name: string;
  classId: ClassId;
  level: number;
  exp: number;
  gold: number;
  hpPots: number;
  mpPots: number;
  equipment: Partial<Record<SlotId, Item>>;
  bag: (Item | null)[];
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
  return {
    v: 1,
    name,
    classId,
    level: 1,
    exp: 0,
    gold: 0,
    hpPots: 5,
    mpPots: 5,
    equipment: { weapon: starterWeapon(classId) },
    bag: [],
    metSeeker: false,
  };
}
