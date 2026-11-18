// The per-facing animation fixes in use in this browser (src/shared/animTuning.ts): the server-wide ones the server
// sends, or what the /admin "ท่าตัวละคร" bench is trying out. Read every frame by AnimatedActor / RigActor.
import { screenDirOf, type AnimTuning, type DirTune, type ScreenDir } from '../shared/animTuning';

let tuning: AnimTuning = {};

/** Uses this tuning from now on (already checked by checkAnimTuning). */
export function applyAnimTuning(t: AnimTuning): void {
  tuning = structuredClone(t);
}

/** The tuning in use (a copy). */
export function currentAnimTuning(): AnimTuning {
  return structuredClone(tuning);
}

/** The changes of one animation (`class.art.anim`) when facing (sx, sy) on screen, if any. */
export function animTuneAt(key: string, sx: number, sy: number): DirTune | undefined {
  const dirs = tuning[key];
  return dirs ? dirs[screenDirOf(sx, sy)] : undefined;
}

/** The bench sets one facing's changes (undefined = back to automatic; the save is checked by the server). */
export function setAnimDirTune(key: string, dir: ScreenDir, tune: DirTune | undefined): void {
  const dirs = { ...tuning[key] };
  if (tune && Object.keys(tune).length) dirs[dir] = tune;
  else delete dirs[dir];
  if (Object.keys(dirs).length) tuning[key] = dirs;
  else delete tuning[key];
}
