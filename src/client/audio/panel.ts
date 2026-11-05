// The sound button and its volume window. Built here rather than in index.html so all audio UI
// stays in one place.
import { audioEngine } from './engine';
import { playSound } from './sfx';

const CSS = `
#audio-panel { right: 168px; top: 56px; width: min(260px, 92vw); font-size: 13px; z-index: 5; }
#audio-panel .audio-row { display: block; margin-top: 8px; }
#audio-panel .audio-label { display: flex; justify-content: space-between; color: var(--ink-dim); }
#audio-panel input[type='range'] { width: 100%; margin: 4px 0 0; accent-color: var(--gold); cursor: pointer; }
#audio-panel #audio-mute { width: 100%; margin-top: 12px; }
`;

function slider(id: string, label: string): string {
  return `<label class="audio-row"><span class="audio-label"><span>${label}</span><span id="${id}-val"></span></span>` +
    `<input id="${id}" type="range" min="0" max="100" step="5" /></label>`;
}

/** Adds the button and window to the HUD. Safe to call again: it only builds them once. */
export function mountAudioPanel(): void {
  if (document.getElementById('audio-panel')) return;
  const buttons = document.querySelector('#hud-topright .hud-buttons');
  const hud = document.getElementById('hud');
  if (!buttons || !hud) return;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  const toggle = document.createElement('button');
  toggle.id = 'btn-audio';
  buttons.append(toggle);

  const panel = document.createElement('div');
  panel.id = 'audio-panel';
  panel.className = 'panel hidden';
  panel.innerHTML =
    '<div class="panel-head"><span>เสียง</span><button id="audio-close">✕</button></div>' +
    slider('audio-music', 'เพลงประกอบ') + slider('audio-sfx', 'เอฟเฟกต์') +
    '<button id="audio-mute"></button>';
  hud.append(panel);

  const music = panel.querySelector<HTMLInputElement>('#audio-music')!;
  const sfx = panel.querySelector<HTMLInputElement>('#audio-sfx')!;
  const mute = panel.querySelector<HTMLButtonElement>('#audio-mute')!;
  const s = audioEngine.settings;

  const render = () => {
    music.value = String(Math.round(s.music * 100));
    sfx.value = String(Math.round(s.sfx * 100));
    panel.querySelector('#audio-music-val')!.textContent = `${music.value}%`;
    panel.querySelector('#audio-sfx-val')!.textContent = `${sfx.value}%`;
    toggle.textContent = `${s.muted ? '🔇' : '🔊'} เสียง`;
    mute.textContent = s.muted ? '🔊 เปิดเสียง' : '🔇 ปิดเสียงทั้งหมด';
  };
  const close = () => panel.classList.add('hidden');

  toggle.onclick = () => panel.classList.toggle('hidden');
  panel.querySelector<HTMLButtonElement>('#audio-close')!.onclick = close;
  mute.onclick = () => {
    audioEngine.set({ muted: !s.muted });
    render();
  };
  music.addEventListener('input', () => {
    audioEngine.set({ music: Number(music.value) / 100 });
    render();
  });
  sfx.addEventListener('input', () => {
    audioEngine.set({ sfx: Number(sfx.value) / 100 });
    render();
  });
  // A preview once the slider is let go, so the new level can be heard.
  sfx.addEventListener('change', () => playSound('pickup_item'));
  // The game ignores the keyboard while an input has focus, so hand it back straight away.
  for (const el of [music, sfx]) el.addEventListener('change', () => el.blur());
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') close();
  });

  render();
}
