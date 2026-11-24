// The standing layer of area skills (owner 2026-11-15: area skills looked flat, like stickers, so their art is made in
// two layers). The ground layer is the skill's flat picture as before; this is the second one: small pieces drawn from
// the side at the isometric angle (rock spikes, flame tongues, ice shards, light pillars…), scattered over the area,
// each standing up, growing out of the ground and animating out of step with the others, so the area has height and
// pieces in front cover pieces behind. One row per skill (art_templates/skills/AOE_PROPS.md); the owner makes the art,
// and a skill whose sheet isn't there yet just has no standing layer.
import * as THREE from 'three';
import { fxSheets } from './assets';
import { PROP_SHEET_ROWS, SKILL_PROPS, type PropDef } from './zonePropsTable';
import { cloneShared } from './texShare';

const FRAMES = 6;

/** What the standing layer needs from the effects. */
export interface PropHost {
  add(obj: THREE.Object3D, life: number, tick?: (k: number, dt: number) => void): void;
}

/** One standing piece: a sprite standing on the ground, showing frame `f` of its row. */
function piece(tex: THREE.Texture, def: PropDef): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, transparent: false }));
  s.center.set(0.5, 0.05);
  return s;
}

function frame(tex: THREE.Texture, def: PropDef, f: number): void {
  tex.repeat.set(1 / FRAMES, 1 / PROP_SHEET_ROWS);
  tex.offset.set(f / FRAMES, 1 - (def.row + 1) / PROP_SHEET_ROWS);
}

/** Where the pieces stand: spread evenly-ish over the area (each in its own slice, jittered), centre at 0,0. */
function spots(def: PropDef, size: number, angle: number): { x: number; z: number }[] {
  const area = def.shape === 'line' ? size * 2 * size * 0.7 : Math.PI * size * size;
  const n = Math.max(3, Math.min(18, Math.round(area * def.density)));
  const out: { x: number; z: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    if (def.shape === 'line') {
      const along = ((i + 0.5) / n) * 2 - 1 + (Math.random() - 0.5) * (1 / n);
      const across = (Math.random() - 0.5) * 0.7;
      const ax = along * size, az = across * size;
      out.push({ x: Math.cos(angle) * ax - Math.sin(angle) * az, z: Math.sin(angle) * ax + Math.cos(angle) * az });
    } else {
      // A sunflower spiral covers a disc evenly; the jitter keeps it from looking like a pattern.
      const r = Math.sqrt((i + 0.5) / n) * size * 0.9;
      const a = i * golden + Math.random() * 0.6;
      out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
    }
  }
  return out;
}

/** Each piece owns a copy of the sheet (its own frame offset). */
function sheetTex(def: PropDef): THREE.Texture | null {
  const base = fxSheets[def.sheet];
  if (!base) return null;
  const t = cloneShared(base);
  t.userData.effectFrame = true;
  return t;
}

/**
 * Plays a skill's standing pieces once over its area (a one-shot effect): each grows out of the ground at a slightly
 * different moment, plays its row's 6 frames and sinks back.
 */
export function playProps(host: PropHost, skill: string | undefined, x: number, z: number, angle: number, size: number, life: number): void {
  const def = skill ? SKILL_PROPS[skill] : undefined;
  if (!def || !fxSheets[def.sheet]) return;
  const total = Math.max(0.5, life * 1.4);
  for (const p of spots(def, size, angle)) {
    const tex = sheetTex(def);
    if (!tex) return;
    const s = piece(tex, def);
    s.position.set(x + p.x, 0, z + p.z);
    const h = def.h * (0.75 + Math.random() * 0.5);
    const delay = Math.random() * 0.2;
    s.scale.set(0.001, 0.001, 1);
    frame(tex, def, 0);
    host.add(s, total, (k) => {
      const t = Math.max(0, (k * total - delay) / (total - delay));
      // Grows out over the first 15 %, sinks back over the last 20 %.
      const g = Math.min(1, t / 0.15, (1 - t) / 0.2);
      s.scale.set(h * Math.max(0.001, g), h * Math.max(0.001, g), 1);
      frame(tex, def, Math.min(FRAMES - 1, Math.floor(t * FRAMES)));
    });
  }
}

/**
 * A lasting zone's standing pieces, looping for `duration` (each out of step), following `pos` (a zone that follows
 * its caster moves them with it). Returns nothing to stop: they end with the zone.
 */
export function loopProps(host: PropHost, skill: string | undefined, pos: { x: number; z: number }, size: number, duration: number): void {
  const def = skill ? SKILL_PROPS[skill] : undefined;
  if (!def || !fxSheets[def.sheet] || duration <= 0) return;
  for (const p of spots(def, size, 0)) {
    const tex = sheetTex(def);
    if (!tex) return;
    const s = piece(tex, def);
    const h = def.h * (0.75 + Math.random() * 0.5);
    const offset = Math.random() * FRAMES;
    const fps = 7 + Math.random() * 3;
    let t = 0;
    host.add(s, duration, (_k, dt) => {
      t += dt;
      s.position.set(pos.x + p.x, 0, pos.z + p.z);
      const g = Math.min(1, t / 0.3, (duration - t) / 0.4);
      s.scale.set(h * Math.max(0.001, g), h * Math.max(0.001, g), 1);
      // The art grows in frame 1 and shrinks in frame 6: a lasting zone loops the full-size middle (frames 2–5).
      frame(tex, def, 1 + (Math.floor(offset + t * fps) % (FRAMES - 2)));
    });
  }
}
