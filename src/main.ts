import './style.css';
import { loadAssets, assetSources } from './client/assets';
import { Game } from './client/Game';
import { buildMenu, portrait } from './client/menu';
import type { OnlineBackend } from './client/net/online';
import { audioEngine } from './client/audio/engine';

const $ = (id: string) => document.getElementById(id)!;

function start(game: Game, classId: string): void {
  $('menu').classList.add('hidden');
  $('hud-portrait').append(portrait(classId, 44));
  game.start();
  (window as unknown as { game: Game }).game = game;
}

function launch(backend: OnlineBackend): void {
  const game = new Game($('app'), backend);
  backend.onChat = (name, text) => game.hud.chatLine(name, text);
  backend.onDisconnect = (msg) => game.hud.showDisconnect(msg);
  start(game, backend.me.cls.id);
}

async function boot(): Promise<void> {
  audioEngine.init();
  await loadAssets();
  const fromFile = Object.entries(assetSources).filter(([, v]) => v === 'file').map(([k]) => k);
  console.info(`[assets] ${fromFile.length} loaded from files:`, fromFile.join(', ') || '(none — using placeholders)');
  $('loading').classList.add('hidden');
  buildMenu(launch);
}

boot();
