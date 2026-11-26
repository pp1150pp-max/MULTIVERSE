// The players' sound settings: the เสียง tab of เมนู → ตั้งค่า (src/client/sysmenu.ts; until 2026-11-26 a window of its
// own). Music, effects and each effect group (multiplied by /admin's group volume), plus mute-all. Kept in this browser.
import { SFX_GROUP_NAME, SFX_GROUPS, type SfxGroup } from '../../shared/audioTuning';
import { audioEngine } from './engine';
import { playSound, type SoundName } from './sfx';
import { setRow, setSlider, setSub, setSwitch } from '../settingsUi';

/** What each group's slider plays when let go, so its new level can be heard. */
const GROUP_PREVIEW: Record<SfxGroup, SoundName> = { skill: 'slash', boss: 'boss_slam', monster: 'monster_die', player: 'pickup_item', ui: 'notify_mail', ambient: 'amb_bird' };

const pct = (v: number) => Math.round(v * 100);

/** Draws the sound rows into `host`; `redraw` is called after a change that alters other rows. */
export function renderAudioSettings(host: HTMLElement, redraw: () => void): void {
  const s = audioEngine.settings;
  host.append(
    setRow('ปิดเสียงทั้งหมด', setSwitch(s.muted, (on) => { audioEngine.set({ muted: on }); redraw(); })),
    setRow('เพลงประกอบ', setSlider(pct(s.music), (v) => audioEngine.set({ music: v / 100 }))),
    setRow('เอฟเฟกต์', setSlider(pct(s.sfx), (v) => audioEngine.set({ sfx: v / 100 }), () => playSound('pickup_item'))),
    setSub('เอฟเฟกต์แยกหมวด'),
    ...SFX_GROUPS.map((g) => setRow(SFX_GROUP_NAME[g],
      setSlider(pct(s.groups[g]), (v) => audioEngine.set({ groups: { ...audioEngine.settings.groups, [g]: v / 100 } }), () => playSound(GROUP_PREVIEW[g])))),
  );
}
