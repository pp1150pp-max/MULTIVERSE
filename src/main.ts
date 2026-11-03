import './style.css';
import { loadAssets, assetSources, animSets, sheets } from './client/assets';
import { Game } from './client/Game';
import { CLASSES, CLASS_IDS } from './shared/data/classes';
import { loadSave, newSave, writeSave, type SaveData } from './client/save';
import type { ClassId } from './shared/types';

const $ = (id: string) => document.getElementById(id)!;

function portrait(key: string, size: number): HTMLCanvasElement {
  // First cell = front view, frame 0 — of the idle animation when there is a full set.
  const set = animSets[key];
  const sh = sheets[key];
  const img = (set ? set.textures.idle.image : sh.texture.image) as CanvasImageSource & { width: number; height: number };
  const cw = set ? set.manifest.frameWidth : img.width / sh.cols;
  const ch = set ? set.manifest.frameHeight : img.height / sh.rows;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, cw, ch, 0, 0, size, size);
  return c;
}

function launch(data: SaveData): void {
  $('menu').classList.add('hidden');
  const game = new Game($('app'), data);
  $('hud-portrait').append(portrait(data.classId, 44));
  game.start();
  (window as unknown as { game: Game }).game = game;
}

function buildMenu(): void {
  const save = loadSave();
  let chosen: ClassId = 'sword';
  const cards = $('class-cards');
  for (const id of CLASS_IDS) {
    const c = CLASSES[id];
    const card = document.createElement('div');
    card.className = 'class-card';
    card.dataset.id = id;
    card.append(portrait(id, 96));
    const body = document.createElement('div');
    body.innerHTML =
      `<h3>${c.name} <small>${c.nameTh}</small></h3><p>${c.desc}</p>` +
      `<ul>${c.skills.filter((s) => s.slot !== 'dash').map((s) => `<li>${s.icon} <b>${s.name}</b> — ${s.nameTh}</li>`).join('')}</ul>`;
    card.append(body);
    card.onclick = () => {
      chosen = id;
      cards.querySelectorAll('.class-card').forEach((el) => el.classList.toggle('selected', el === card));
    };
    cards.append(card);
  }
  (cards.firstElementChild as HTMLElement).classList.add('selected');

  if (save) {
    const btn = $('btn-continue');
    btn.classList.remove('hidden');
    btn.textContent = `เล่นต่อ: ${save.name} · Lv.${save.level} ${CLASSES[save.classId].name}`;
    btn.onclick = () => launch(save);
  }

  $('btn-start').onclick = () => {
    if (save && !confirm('การเริ่มเกมใหม่จะลบตัวละครเดิม ต้องการดำเนินการต่อหรือไม่?')) return;
    const name = ($('name-input') as HTMLInputElement).value.trim().slice(0, 16) || 'Wanderer';
    const data = newSave(name, chosen);
    writeSave(data);
    launch(data);
  };
  $('menu').classList.remove('hidden');
}

async function boot(): Promise<void> {
  await loadAssets();
  const fromFile = Object.entries(assetSources).filter(([, v]) => v === 'file').map(([k]) => k);
  console.info(`[assets] ${fromFile.length} loaded from files:`, fromFile.join(', ') || '(none — using placeholders)');
  $('loading').classList.add('hidden');
  buildMenu();
}

boot();
