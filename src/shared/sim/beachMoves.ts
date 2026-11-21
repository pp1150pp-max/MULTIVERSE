// Shipwreck Beach's monster moves (plan 5.1, owner 2026-11-20). Their numbers live in src/shared/moveTuning.ts
// (/admin, card "ท่ามอนชั้น 2"), read here through mv() so a save takes effect at once.
//  - shell  (hermit crab):  hit → hides in its shell for a moment taking less damage, then strikes back.
//  - steal  (thief gull):   its hit takes real gold and it flies off; shot down in time, the gold goes back.
//  - chain  (shock eel):    a marked shock that jumps on to more players, weaker at each jump.
//  - thorns (spike turtle): close-range hits on it bounce part of their damage back.
import { currentBalance } from '../balance';
import type { Monster } from './Monster';
import type { Player } from './Player';
import type { Sim } from './Sim';

/** A move number in use (code or /admin). */
export const mv = (key: string): number => currentBalance().moves[key];

/** Gold a gull is carrying off: whose, how much, and until when it can still be won back (sim time). */
export interface StolenGold { pid: number; name: string; gold: number; until: number }

// ---- shell

/** Hit while ready: in it goes. Returns true when it started hiding. */
export function shellOnHit(sim: Sim, m: Monster): boolean {
  if (m.def.move !== 'shell' || m.hideT > 0 || m.shellCd > 0 || !m.alive) return false;
  const hide = mv('shell.hide');
  m.hideT = hide;
  m.shellCd = mv('shell.cd');
  guard(sim, m, mv('shell.cut'), hide);
  m.windupT = 0;
  sim.text(m.x, m.topY, m.z, 'หดกระดอง', 'info', 0.7);
  return true;
}

/** Out of the shell: one hit at whoever it is fighting, if they are still close. */
export function shellCounter(sim: Sim, m: Monster): void {
  const p = m.target;
  if (!p?.alive) return;
  const d = Math.hypot(p.x - m.x, p.z - m.z);
  m.face(p.x - m.x, p.z - m.z);
  sim.anim(m.id, 'attack', { duration: 0.3 });
  sim.fx('slash', m.x, m.z, Math.atan2(p.z - m.z, p.x - m.x), Math.PI * 0.7, m.def.attackRange + 1, '#ffb070');
  if (d <= m.def.attackRange + m.radius + p.radius + 0.6) sim.hitPlayer(m, p, mv('shell.counter'), { kb: 4, fromX: m.x, fromZ: m.z });
}

/** Takes `cut` less damage for `sec` seconds, with the paper dome over it (fx_shell_guard). */
export function guard(sim: Sim, m: Monster, cut: number, sec: number): void {
  m.guard = Math.max(0, Math.min(1, cut));
  m.guardUntil = sim.time + sec;
  sim.fx('sprite', 'fx_shell_guard', m.x, m.z, m.def.height * 0.75, sec, m.id);
}

// ---- steal

/** A gull's hit landed on `p`: it takes its share of their gold (if it isn't carrying some already) and flees. */
export function stealGold(sim: Sim, m: Monster, p: Player): void {
  if (m.def.move !== 'steal' || m.stolen || !p.alive) return;
  const gold = Math.min(Math.floor(mv('steal.max')), Math.floor(p.gold * mv('steal.share')));
  if (gold <= 0) return;
  p.gold -= gold;
  const flee = mv('steal.flee');
  m.stolen = { pid: p.id, name: p.name, gold, until: sim.time + flee };
  m.fleeFor(flee);
  sim.text(p.x, p.topY + 0.3, p.z, `-${gold} G`, 'hurt', 1, p.id);
  sim.log(`${m.def.nameTh}ขโมยทองไป ${gold.toLocaleString()} G! ตีมันตกภายใน ${flee} วินาทีเพื่อเอาคืน`, '#ffcf5a', p.id);
  sim.inventoryChanged(p);
}

/** Every tick: the time to win the gold back ran out, so it is gone. */
export function stealTick(sim: Sim, m: Monster): void {
  const s = m.stolen;
  if (!s || sim.time < s.until) return;
  m.stolen = null;
  sim.log(`${m.def.nameTh}บินหนีไปพร้อมทอง ${s.gold.toLocaleString()} G`, '#ff8a6a', s.pid);
}

/** The gull died while carrying gold: it goes back to whoever it was taken from, whoever shot it down. */
export function stealReturn(sim: Sim, m: Monster): void {
  const s = m.stolen;
  if (!s) return;
  m.stolen = null;
  const p = sim.players.find((x) => x.id === s.pid);
  if (!p) return;
  p.gold += s.gold;
  sim.text(p.x, p.topY + 0.3, p.z, `+${s.gold} G`, 'heal', 1, p.id);
  sim.log(`ได้ทองคืน ${s.gold.toLocaleString()} G จาก${m.def.nameTh}`, '#9ad86a', p.id);
  sim.inventoryChanged(p);
}

// ---- chain

/** Marks the first target: a ring under them while the eel charges up. */
export function chainWarn(sim: Sim, m: Monster, p: Player, warn: number): void {
  sim.fx('telegraph', p.x, p.z, 1.2, warn, '#ffe14a');
}

/**
 * The shock: the first target (still within reach), then on to the nearest players not hit yet, each within
 * the jump range of the last one, `falloff` weaker at every jump. Bolts drawn from link to link (fx_chain_bolt).
 */
export function chainStrike(sim: Sim, m: Monster, first: Player | null): void {
  if (!first?.alive || Math.hypot(first.x - m.x, first.z - m.z) > mv('chain.range') + 1) return;
  const hit = new Set<number>();
  let from: { x: number; z: number } = m;
  let p: Player | null = first;
  let mult = mv('chain.mult');
  const jumps = Math.round(mv('chain.jumps'));
  const reach = mv('chain.jumpRange');
  for (let i = 0; p && i <= jumps; i++) {
    hit.add(p.id);
    sim.fx('bolt', from.x, from.z, p.x, p.z, 0.35);
    sim.fx('sprite', 'fx_shock', p.x, p.z, 0.9, 0.4);
    sim.hitPlayer(m, p, mult, { stun: 0.2 });
    mult *= mv('chain.falloff');
    from = p;
    const last: Player = p;
    p = null;
    let best = reach;
    for (const o of sim.players) {
      if (!o.alive || hit.has(o.id) || sim.inSafe(o)) continue;
      const d = Math.hypot(o.x - last.x, o.z - last.z);
      if (d <= best) {
        best = d;
        p = o;
      }
    }
  }
}

// ---- thorns

/** A close hit on a spike turtle: part of the damage dealt comes straight back (no defense, no further reflect). */
export function thornsReflect(sim: Sim, m: Monster, p: Player, dealt: number): void {
  if (m.def.move !== 'thorns' || dealt <= 0 || !p.alive) return;
  if (Math.hypot(p.x - m.x, p.z - m.z) > mv('thorns.range') + m.radius) return;
  const back = Math.round(dealt * mv('thorns.share'));
  if (back <= 0) return;
  sim.fx('sprite', 'fx_spike_burst', m.x, m.z, m.def.height * 0.6, 0.4);
  sim.hurtPlayer(m, p, back);
}
