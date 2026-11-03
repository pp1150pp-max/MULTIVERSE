import './style.css';
import { loadAssets, assetSources } from './client/assets';
import { Game } from './client/Game';
import { buildMenu, portrait } from './client/menu';
import type { SaveData } from './client/save';

const $ = (id: string) => document.getElementById(id)!;

function launch(data: SaveData): void {
  $('menu').classList.add('hidden');
  const game = new Game($('app'), data);
  $('hud-portrait').append(portrait(data.classId, 44));
  game.start();
  (window as unknown as { game: Game }).game = game;
}

async function boot(): Promise<void> {
  await loadAssets();
  const fromFile = Object.entries(assetSources).filter(([, v]) => v === 'file').map(([k]) => k);
  console.info(`[assets] ${fromFile.length} loaded from files:`, fromFile.join(', ') || '(none — using placeholders)');
  $('loading').classList.add('hidden');
  buildMenu(launch);
}

boot();
