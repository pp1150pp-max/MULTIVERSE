// Turns what happens in the game into sound. Events arrive
// through Game.handleEvent, so everything is decided here, from SimEvents and the Backend's state.
import type { SimEvent } from '../../shared/sim/types';
import type { Player } from '../../shared/sim/Player';
import type { SkillSlot } from '../../shared/data/classes';
import type { Backend } from '../backend';
import { HUB_ID } from '../../shared/data/zones';
import type { Rarity } from '../../shared/types';
import { AMBIENCE, STEP_OF } from './extraSounds';
import { bossRoomSong } from '../../shared/audioTuning';
import { currentBalance } from '../../shared/balance';
import { audioEngine } from './engine';
import { music, type TrackId } from './music';
import { mountAudioPanel } from '../legacy/audioWindow';
import { isSoundName, playSound, type SoundName } from './sfx';
import { BOSS_SOUNDS } from './bossSounds';
import { IMPACT_OF } from './skillSounds';

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

const ZONE_MUSIC: Record<string, TrackId> = { [HUB_ID]: 'town', emerald_forest: 'forest', misty_marsh: 'marsh', frost_reach: 'snow', ashen_isle: 'volcano' };
/** World units walked between two footsteps. */
const STRIDE = 1.5;
/** A monster this close that starts chasing gives a cry. */
const ALERT_RADIUS = 12;
const DROP_SOUND: Record<Rarity, SoundName> = { common: 'drop_item', uncommon: 'drop_item', rare: 'drop_rare', epic: 'drop_epic', legendary: 'drop_legend' };
/** Each room boss's own fight music (owner 2026-11-22); other bosses play 'boss'. */
const BOSS_MUSIC: Record<string, TrackId> = { forest_bear: 'boss_bear', bog_witch: 'boss_witch', yeti: 'boss_yeti', volcano_heart: 'boss_heart' };
const ANIM_SLOT: Record<string, SkillSlot> = { attack: 'basic', skill_q: 'q', skill_e: 'e', skill_r: 'r', dash: 'dash' };

export class GameAudio {
  private zoneId: string | null = null;
  private bossHold = 0;
  /** The boss fight track and its speed, kept while the boss is off the map (the Yeti's jump). */
  private bossTrack: TrackId = 'boss';
  private bossTempo = 1;
  private walked = 0;
  private lastX = NaN;
  private lastZ = NaN;
  private ambT = 3;
  /** Drops and monster states already seen, so only new ones make a sound. */
  private seenLoot = new Set<number>();
  private mobState = new Map<number, string>();

  constructor() {
    audioEngine.onUiClick = () => playSound('ui_click');
    mountAudioPanel(); // the old sound window, used only while /admin turns the tabbed settings off
    watchWindows();
  }

  /** Called once per frame: tracks zone changes and picks the music. */
  update(dt: number, b: Backend): void {
    const moved = this.zoneId !== b.zone.id;
    if (this.zoneId !== null && moved) playSound('portal');
    this.zoneId = b.zone.id;
    // Boss music never follows you into another map.
    if (moved) this.bossHold = 0;
    const look = b.zone.id === HUB_ID ? 'town' : b.zone.theme;
    this.footsteps(b, look, moved);
    this.drops(b, moved);
    this.mobAlerts(b, moved);
    this.ambience(dt, look);

    const fight = this.bossFight(b);
    if (fight) {
      const boss = fight.isBoss ? fight : b.monsters.find((m) => m.isBoss && m.alive);
      if (boss) {
        this.bossTrack = BOSS_MUSIC[boss.def.id] ?? 'boss';
        // Faster when it rages; the Heart speeds up with its phases (below half, below 30%).
        const left = boss.hp / boss.maxHp;
        this.bossTempo = boss.def.id === 'volcano_heart' ? (left < 0.3 ? 1.2 : left < 0.5 ? 1.1 : 1) : boss.enraged ? 1.12 : 1;
      }
    } else if (this.bossHold <= dt) {
      this.bossTrack = 'boss';
      this.bossTempo = 1;
    }
    this.bossHold = fight ? BOSS_MUSIC_HOLD : Math.max(0, this.bossHold - dt);
    // In a boss room the song file /admin gives it plays for the whole stay, over whichever chiptune would
    // play: that one is what you hear if there is no file.
    const song = bossRoomSong(currentBalance().audio.music, b.zone.roomOf ? b.zone.boss?.monster : undefined);
    if (this.bossHold > 0) music.play(this.bossTrack, this.bossTempo, song);
    else music.play(ZONE_MUSIC[b.zone.id] ?? 'forest', 1, song);
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
          const name: SoundName | undefined = IMPACT_OF[effect] ?? (effect in BOSS_SOUNDS ? (effect as keyof typeof BOSS_SOUNDS) : undefined);
          if (name) this.at(name, x, z, me);
        }
        break;
      case 'sfx':
        this.at(ev.name, ev.x, ev.z, me);
        break;
      case 'anim':
        this.onAnim(ev.id, ev.name, b, ev.skill);
        break;
      case 'bossSpawn':
        playSound('boss_appear');
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

  private onAnim(id: number, name: string, b: Backend, skill?: string): void {
    const slot = ANIM_SLOT[name];
    if (!slot) return;
    // A monster winding up a swing near us (bosses have their own sounds).
    if (name === 'attack') {
      const m = b.monsters.find((x) => x.id === id);
      if (m) {
        if (!m.isBoss) this.at('mob_swing', m.x, m.z, b.me);
        return;
      }
    }
    const p = b.players.find((x) => x.id === id);
    if (!p) return;
    // Charge is a dash too: its own sound plays from skill_r.
    if (slot === 'dash' && p.dashKind === 'charge') return;
    // A skill names itself (many share one animation row); the basic attack and dash are the class's own.
    const sound = slot === 'basic' || slot === 'dash' ? p.skill(slot)?.id : skill;
    if (!sound || !isSoundName(sound)) return;
    if (p === b.me) playSound(sound);
    else this.at(sound, p.x, p.z, b.me, OTHER_PLAYER_GAIN);
  }

  /** Our own footsteps, one each stride while walking on the ground. */
  private footsteps(b: Backend, look: string, moved: boolean): void {
    const me = b.me;
    const d = moved || Number.isNaN(this.lastX) ? 0 : Math.hypot(me.x - this.lastX, me.z - this.lastZ);
    this.lastX = me.x;
    this.lastZ = me.z;
    // A dash or a warp is not walking.
    if (!me.alive || d <= 0.001 || d > 1) return;
    this.walked += d;
    if (this.walked < STRIDE) return;
    this.walked = 0;
    const step = STEP_OF[look];
    if (step) playSound(step, 0.8 + Math.random() * 0.3);
  }

  /** Something new on the ground: a sound by what it is (rarity for items). Not on entering a map. */
  private drops(b: Backend, moved: boolean): void {
    const seen = new Set<number>();
    for (const l of b.loots) {
      seen.add(l.id);
      if (moved || this.seenLoot.has(l.id) || l.dropped) continue;
      const k = l.kind;
      const name: SoundName = k.type === 'gold' ? 'drop_gold' : k.type === 'item' ? DROP_SOUND[k.item.rarity] ?? 'drop_item' : 'drop_item';
      this.at(name, l.x, l.z, b.me);
    }
    this.seenLoot = seen;
  }

  /** A monster near us that starts chasing gives a short cry. */
  private mobAlerts(b: Backend, moved: boolean): void {
    const me = b.me;
    const now = new Map<number, string>();
    for (const m of b.monsters) {
      now.set(m.id, m.state);
      const was = this.mobState.get(m.id);
      if (moved || m.isBoss || !m.alive || m.state !== 'chase' || was === undefined || was === 'chase') continue;
      if (Math.hypot(m.x - me.x, m.z - me.z) <= ALERT_RADIUS) this.at('mob_alert', m.x, m.z, me);
    }
    this.mobState = now;
  }

  /** The map's ambience: one of its sounds now and then, somewhere around us. */
  private ambience(dt: number, look: string): void {
    const a = AMBIENCE[look];
    if (!a) return;
    this.ambT -= dt;
    if (this.ambT > 0) return;
    const [lo, hi] = a.every;
    this.ambT = lo + Math.random() * (hi - lo);
    playSound(a.sounds[Math.floor(Math.random() * a.sounds.length)], 0.7 + Math.random() * 0.3, (Math.random() - 0.5) * 0.8);
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

  private bossFight(b: Backend) {
    const me = b.me;
    // Leapers only ever come with a boss, so its music keeps playing while that boss is off the map.
    return b.monsters.find((m) =>
      (m.isBoss || m.def.leap) && m.alive &&
      Math.hypot(m.x - me.x, m.z - me.z) <= BOSS_MUSIC_RADIUS &&
      (m.state === 'chase' || m.state === 'charge' || (m.state !== 'return' && m.hp < m.maxHp)));
  }
}

/** A sound whenever a window (`.panel`) opens or closes, whichever code toggles it. */
function watchWindows(): void {
  new MutationObserver((list) => {
    for (const r of list) {
      const el = r.target as HTMLElement;
      if (!el.classList?.contains('panel')) continue;
      const wasHidden = (r.oldValue ?? '').split(' ').includes('hidden');
      const hidden = el.classList.contains('hidden');
      if (wasHidden !== hidden) playSound(hidden ? 'ui_close' : 'ui_open');
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
}
