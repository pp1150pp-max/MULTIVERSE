// Undo / redo as a command stack (docs/plans/map-editor.md 2.2): every action is ONE command, 200 deep.
// A command stores the top-level lists it touched, before and after (lists are replaced, never edited in place, so
// keeping references is cheap even for the hub's 1,100 pieces). Any tool, including the PR 7 ones, can use it unchanged.
import type { MapData } from '../../shared/mapSchema';

export const HISTORY_DEPTH = 200;
export type MapPatch = Partial<MapData>;
export interface Command { label: string; before: MapPatch; after: MapPatch }

export class History {
  private undos: Command[] = [];
  private redos: Command[] = [];
  constructor(private readonly apply: (patch: MapPatch) => void) {}

  get canUndo(): boolean { return this.undos.length > 0; }
  get canRedo(): boolean { return this.redos.length > 0; }
  get undoLabel(): string | undefined { return this.undos[this.undos.length - 1]?.label; }
  get redoLabel(): string | undefined { return this.redos[this.redos.length - 1]?.label; }

  /** Runs a command now and records it. A new action clears what could be redone. */
  exec(cmd: Command): void {
    this.apply(cmd.after);
    this.record(cmd);
  }
  /** Records a command whose `after` is already applied (a drag that was drawn live). */
  record(cmd: Command): void {
    this.undos.push(cmd);
    if (this.undos.length > HISTORY_DEPTH) this.undos.shift();
    this.redos = [];
  }
  undo(): Command | undefined {
    const c = this.undos.pop();
    if (c) { this.apply(c.before); this.redos.push(c); }
    return c;
  }
  redo(): Command | undefined {
    const c = this.redos.pop();
    if (c) { this.apply(c.after); this.undos.push(c); }
    return c;
  }
  clear(): void { this.undos = []; this.redos = []; }
}

/** The values of `keys` on the map, as a patch (references, not copies). */
export function pick(map: MapData, keys: readonly (keyof MapData)[]): MapPatch {
  const o: Record<string, unknown> = {};
  for (const k of keys) o[k] = map[k];
  return o as MapPatch;
}
export const samePatch = (a: MapPatch, b: MapPatch): boolean =>
  (Object.keys(a) as (keyof MapData)[]).every((k) => a[k] === b[k]);
