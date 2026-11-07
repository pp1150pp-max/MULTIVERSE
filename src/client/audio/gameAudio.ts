// Turns what happens in the game into sound. Events arrive
// through Game.handleEvent, so everything is decided here, from SimEvents and the Backend's state.
import type { SimEvent } from '../../shared/sim/types';
import type { Player } from '../../shared/sim/Player';
import type { SkillSlot } from '../../shared/data/classes';
import type { Backend } from '../backend';
import { audioEngine } from './engine';
import { music, type TrackId } from './music';
import { mountAudioPanel } from './panel';
import { isSoundName, playSound, type SoundName } from './sfx';

/** Full volume within this distance of our character, in world units. */
const FULL_RADIUS = 7;
/** Silent past this distance. Online, attacks and hits arrive from anywhere in the zone. */
const HEAR_RADIUS = 24;
/** Other players' skills sit behind our own. */
const OTHER_PLAYER_GAIN = 0.5;
/** Fights count as "boss music" only this close to the boss. */
const BOSS_MUSIC_RADIUS = 22;
/** Stops the music flipping back and forth when a boss is at the edge of its leash. */
const BOSS_MUSIC_HOLD = 4;

const ZONE_MUSIC: Record<string, TrackId> = { emerald_forest: 'forest', misty_marsh: 'marsh', frost_reach: 'snow', ashen_isle: 'volcano' };
const ANIM_SLOT: Record<string, SkillSlot> = { attack: 'basic', skill_q: 'q', skill_e: 'e', skill_r: 'r', dash: 'dash' };
const IMPACT_SOUND: Record<string, SoundName> = { explosion: 'explosion', crater: 'crater', impact: 'impact' };

export class GameAudio {
  private zoneId: string | null = null;
  private bossHold = 0;

  constructor() {
    audioEngine.onUiClick = () => playSound('ui_click');
    mountAudioPanel();
  }

  /** Called once per frame: tracks zone changes and picks the music. */
  update(dt: number, b: Backend): void {
    if (this.zoneId !== null && this.zoneId !== b.zone.id) playSound('portal');
    this.zoneId = b.zone.id;

    this.bossHold = this.bossFight(b) ? BOSS_MUSIC_HOLD : Math.max(0, this.bossHold - dt);
    music.play(this.bossHold > 0 ? 'boss' : ZONE_MUSIC[b.zone.id] ?? 'forest');
  }

  /** The event already passed Game's "is this for me" check. */
  onEvent(ev: SimEvent, b: Backend): void {
    const me = b.me;
    switch (ev.t) {
      case 'fx':
        if (ev.name === 'levelUp') {
          const [x, z] = ev.args;
          this.at('level_up', x, z, me);
        } else if (ev.name === 'effect') {
          const [effect, x, z] = ev.args;
          const name = IMPACT_SOUND[effect];
          if (name) this.at(name, x, z, me);
        }
        break;
      case 'sfx':
        this.at(ev.name, ev.x, ev.z, me);
        break;
      case 'banner':
        this.at('enrage', ev.x, ev.z, me);
        break;
      case 'anim':
        this.onAnim(ev.id, ev.name, b);
        break;
      case 'flash': {
        if (ev.id === me.id) {
          playSound('hurt');
          break;
        }
        const m = b.monsters.find((x) => x.id === ev.id);
        if (m) this.at('hit', m.x, m.z, me);
        break;
      }
      case 'died':
        if (ev.id === me.id) playSound('death');
        break;
      case 'revived':
        if (ev.id === me.id) playSound('revive');
        break;
    }
  }

  private onAnim(id: number, name: string, b: Backend): void {
    const slot = ANIM_SLOT[name];
    if (!slot) return;
    const p = b.players.find((x) => x.id === id);
    if (!p) return;
    // Charge is a dash too: its own sound plays from skill_e.
    if (slot === 'dash' && p.dashKind === 'charge') return;
    const sound = p.skill(slot)?.id;
    if (!sound || !isSoundName(sound)) return;
    if (p === b.me) playSound(sound);
    else this.at(sound, p.x, p.z, b.me, OTHER_PLAYER_GAIN);
  }

  /** Plays a sound from a place in the world, quieter with distance and panned toward its side. */
  private at(name: SoundName, x: number, z: number, me: Player, gain = 1): void {
    const dx = x - me.x;
    const dz = z - me.z;
    const d = Math.hypot(dx, dz);
    if (d >= HEAR_RADIUS) return;
    const near = d <= FULL_RADIUS ? 1 : 1 - (d - FULL_RADIUS) / (HEAR_RADIUS - FULL_RADIUS);
    // Screen right is +x −z with this camera.
    const pan = Math.max(-0.5, Math.min(0.5, ((dx - dz) * Math.SQRT1_2) / HEAR_RADIUS));
    playSound(name, gain * near, pan);
  }

  private bossFight(b: Backend): boolean {
    const me = b.me;
    // Leapers only ever come with a boss, so its music keeps playing while that boss is off the map.
    return b.monsters.some((m) =>
      (m.isBoss || m.def.leap) && m.alive &&
      Math.hypot(m.x - me.x, m.z - me.z) <= BOSS_MUSIC_RADIUS &&
      (m.state === 'chase' || m.state === 'charge' || (m.state !== 'return' && m.hp < m.maxHp)));
  }
}
