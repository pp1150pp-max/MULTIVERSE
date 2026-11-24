// The Ghost Ship Graveyard's monster moves (plan 5.3, owner 2026-11-24). Their numbers live in src/shared/moveTuning.ts
// (/admin, card "ท่ามอนชั้น 2"), read through mv() so a save takes effect at once.
//  - curse (ghost sailor monkey): its thrown skull leaves a curse ring on the ground for a while; whoever stands in it is slowed.
//  - phase (ghost sailor):        walks through props; now and then fades out (can't be hit), drifts up to its target and
//                                 comes back beside them with a strike after a short warning.
//  - song  (ghost siren):         sings; players in the circle are made to walk to her for a moment. A dash breaks it.
//  - split (barnacle ghost crew): killed, it breaks into small barnacle ghosts (summons: no rewards, owner 2026-11-24).
// The curse rings go out in `Sim.hazards` (k 'curse', drawn by src/client/hazards.ts), so every player sees the same ring.
import { mv } from './beachMoves';
import type { HazardBase } from './volcanoHeart';
import type { Monster } from './Monster';
import type { Sim } from './Sim';

/** A curse ring on the ground from `hit` until `end`: slows whoever stands in it. */
export interface CurseHazard extends HazardBase { k: 'curse'; r: number; end: number }

/** How long a slow from a curse ring lasts after stepping out of it. */
const CURSE_LINGER = 0.3;
/** Where a phasing ghost sailor comes back: this far behind its target. */
const PHASE_BEHIND = 1.2;
/** Its strike's reach around where it comes back. */
const PHASE_REACH = 1.8;

// ---- curse

/** The skull landed (on a player or at the end of its flight): a curse ring there. */
export function curseLand(sim: Sim, x: number, z: number): void {
  const r = mv('curse.radius');
  const h: CurseHazard = { id: sim.nextHazardId(), k: 'curse', x, z, r, start: sim.time, hit: sim.time, end: sim.time + mv('curse.sec') };
  sim.hazards = [...sim.hazards, h];
  sim.fx('sprite', 'fx_ghost_skull', x, z, 0.9, 0.35);
}

/** Every tick: players in a curse ring are slowed; rings whose time is up go. */
export function tickCurses(sim: Sim): void {
  let gone = false;
  for (const h of sim.hazards) {
    if (h.k !== 'curse') continue;
    if (sim.time >= h.end) {
      gone = true;
      continue;
    }
    for (const p of sim.players) {
      if (!p.alive || sim.inSafe(p) || Math.hypot(p.x - h.x, p.z - h.z) > h.r + p.radius) continue;
      p.slowAmt = Math.max(p.slowT > 0 ? p.slowAmt : 0, mv('curse.slow'));
      p.slowT = Math.max(p.slowT, CURSE_LINGER);
    }
  }
  if (gone) sim.hazards = sim.hazards.filter((h) => h.k !== 'curse' || sim.time < h.end);
}

// ---- phase / song

/** A ghost's own move in progress: fading (phase) or singing (song). */
export interface GhostMove { cd: number; t: number; kind: 'fade' | 'strike' | 'sing' | null }

/**
 * A ghost sailor's or a siren's own move, once Monster has done the stun and target checks. True = it acted this tick (the
 * usual chase and melee are skipped); false = Monster goes on as usual.
 */
export function ghostAct(dt: number, sim: Sim, m: Monster): boolean {
  const g = (m.ghost ??= { cd: 2 + Math.random() * 2, t: 0, kind: null });
  g.cd -= dt * m.skillSpeed;
  const p = m.target;
  if (g.kind && (!p?.alive || m.state === 'return' || sim.inSafe(p))) {
    endFade(sim, m);
    g.kind = null;
    return false;
  }
  if (g.kind === 'fade' && p) {
    // Drifting unseen toward its target; when time is up it comes back behind them.
    g.t -= dt;
    const dx = p.x - m.x;
    const dz = p.z - m.z;
    const d = Math.hypot(dx, dz) || 0.001;
    const s = Math.min(d, m.def.speed * mv('phase.speed') * dt);
    m.x += (dx / d) * s;
    m.z += (dz / d) * s;
    sim.terrain.resolve(m, true);
    m.moving = true;
    m.face(dx, dz);
    if (g.t <= 0) {
      const fl = Math.hypot(p.faceX, p.faceZ) || 1;
      m.x = p.x - (p.faceX / fl) * PHASE_BEHIND;
      m.z = p.z - (p.faceZ / fl) * PHASE_BEHIND;
      sim.terrain.resolve(m, true);
      m.face(p.x - m.x, p.z - m.z);
      endFade(sim, m);
      g.kind = 'strike';
      g.t = mv('phase.windup') * m.skillMult();
      sim.fx('telegraph', m.x, m.z, PHASE_REACH, g.t);
      sim.anim(m.id, 'attack', { duration: g.t });
    }
    return true;
  }
  if (g.kind === 'strike' && p) {
    g.t -= dt;
    if (g.t > 0) return true;
    g.kind = null;
    sim.fx('slash', m.x, m.z, Math.atan2(p.z - m.z, p.x - m.x), Math.PI * 0.8, PHASE_REACH + 0.4, '#7fe0d0');
    if (Math.hypot(p.x - m.x, p.z - m.z) <= PHASE_REACH + p.radius) sim.hitPlayer(m, p, mv('phase.mult'), { kb: 3, fromX: m.x, fromZ: m.z });
    return true;
  }
  if (g.kind === 'sing') {
    g.t -= dt;
    if (g.t > 0) return true;
    g.kind = null;
    sing(sim, m);
    return true;
  }
  if (!p || m.state !== 'chase' || m.windupT > 0 || g.cd > 0) return false;
  const d = Math.hypot(p.x - m.x, p.z - m.z);
  if (m.def.move === 'phase' && d > m.def.attackRange + 0.6 + p.radius) {
    // Only when it isn't already in reach: it closes the gap unseen.
    g.cd = mv('phase.cd');
    g.kind = 'fade';
    g.t = mv('phase.sec');
    m.fade = true;
    m.noHit = true;
    sim.fx('sprite', 'fx_spirit_puff', m.x, m.z, 1.6, 0.5);
    sim.anim(m.id, 'fade', { duration: 0.4, fallback: 'attack' });
    return true;
  }
  if (m.def.move === 'song' && d <= mv('song.radius')) {
    g.cd = mv('song.cd');
    g.kind = 'sing';
    g.t = mv('song.windup') * m.skillMult();
    sim.fx('telegraph', m.x, m.z, mv('song.radius'), g.t, '#8ae8e0');
    sim.fx('sprite', 'fx_music_notes', m.x, m.z, 1.8, g.t, m.id);
    sim.anim(m.id, 'sing', { duration: g.t, fallback: 'attack' });
    m.face(p.x - m.x, p.z - m.z);
    return true;
  }
  return false;
}

function endFade(sim: Sim, m: Monster): void {
  if (!m.fade) return;
  m.fade = false;
  m.noHit = false;
  sim.fx('sprite', 'fx_spirit_puff', m.x, m.z, 1.6, 0.5);
}

/** The song: everyone in the circle is hurt a little and walks to her for a moment (Player.charm; a dash breaks it). */
function sing(sim: Sim, m: Monster): void {
  const r = mv('song.radius');
  sim.fx('ring', m.x, m.z, r, '#8ae8e0', 0.5);
  for (const p of sim.players) {
    if (!p.alive || sim.inSafe(p) || Math.hypot(p.x - m.x, p.z - m.z) > r + p.radius) continue;
    if (mv('song.mult') > 0) sim.hitPlayer(m, p, mv('song.mult'), {});
    if (!p.alive) continue;
    p.charmBy = m;
    p.charmT = mv('song.sec');
    sim.fx('sprite', 'fx_siren_pull', p.x, p.z, 1.4, mv('song.sec'), p.id);
    sim.text(p.x, p.topY + 0.4, p.z, 'ถูกเพลงไซเรนดึงดูด!', 'info', 0.9, p.id);
  }
}

// ---- split

/** A barnacle ghost crew was killed: it breaks into small ones around where it fell (summons, no rewards). */
export function splitOnDeath(sim: Sim, m: Monster): void {
  const n = Math.max(0, Math.round(mv('split.count')));
  if (n > 0) sim.fx('sprite', 'fx_shell_burst', m.x, m.z, 1.8, 0.5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random();
    const s = sim.spawnSummon('barnacle_small', m.x + Math.cos(a) * 0.9, m.z + Math.sin(a) * 0.9, m.level);
    if (!s) continue;
    sim.terrain.resolve(s);
    // Straight at whoever killed it (or the nearest player): they come out fighting.
    if (m.target?.alive) s.taunt(m.target);
  }
}
