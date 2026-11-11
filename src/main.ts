import './client/noBrowserMenu';
import './style.css';
import './client/touch/device';
import { assetSources, loadGameAssets, loadMenuAssets } from './client/assets';
import { CLASS_IDS } from './shared/data/classes';
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
  backend.onChat = (name, text, ch, to) => {
    game.hud.chatLine(name, text, undefined, ch, to);
    // Whispers are private: no speech bubble over the head.
    if (name && ch !== 'whisper') game.floating.bubble(name, text, ch === 'party');
  };
  backend.onFriends = (view) => game.friends.show(view);
  backend.onPartyInvite = (party, from, seconds) => game.party.invited(party, from, seconds);
  backend.onPartyInviteGone = (party) => game.party.removeInvite(party);
  backend.onTradeRequest = (from, name, seconds) => game.trade.requested(from, name, seconds);
  backend.onTradeRequestGone = (from) => game.trade.removeRequest(from);
  backend.onRoomInvite = (id, from, boss, keys, seconds) => game.rooms.invited(id, from, boss, keys, seconds);
  backend.onRoomInviteGone = (id) => game.rooms.removeInvite(id);
  backend.onRoomLobby = (view) => game.rooms.lobby(view);
  backend.onTrade = (view) => game.trade.show(view);
  backend.onTradeEnd = (ok) => game.trade.ended(ok);
  backend.onDisconnect = (msg) => game.hud.showDisconnect(msg);
  backend.onShutdown = (mode, seconds, text) => game.hud.shutdownCountdown(mode, seconds, text);
  backend.onAnnounce = (text, from, direct) => game.hud.announce(text, from, direct);
  backend.onMarketNote = (text, sub) => game.hud.marketNote(text, sub);
  backend.onMailNote = (unread, fresh) => game.mailUI.note(unread, fresh);
  start(game, backend.me.cls.id);
}

/** Keeps the logo hidden until all its letters have loaded (or failed), then fades it in whole. */
function revealLogoWhenLoaded(): void {
  const logo = document.querySelector<HTMLElement>('.logo');
  if (!logo) return;
  const imgs = [...logo.querySelectorAll('img')];
  const pending = imgs.filter((img) => !img.complete);
  if (!pending.length) return;
  logo.classList.add('logo-wait');
  let left = pending.length;
  const one = (): void => {
    if (--left === 0) logo.classList.remove('logo-wait');
  };
  for (const img of pending) {
    img.addEventListener('load', one, { once: true });
    img.addEventListener('error', one, { once: true });
  }
}

async function boot(): Promise<void> {
  audioEngine.init();
  // The Login form needs no images, so it shows as soon as this code runs. The logo letters and
  // background (index.html / CSS) are already downloading; the class portraits (a few MB) come
  // next, and only then the rest of the game (~40 MB), in the background. A slow link isn't
  // split with files the menu doesn't need yet. Entering the world waits for the game files
  // (menu.ts enterWorld).
  revealLogoWhenLoaded();
  $('loading').classList.add('hidden');
  buildMenu(launch);
  await loadMenuAssets(CLASS_IDS);
  await loadGameAssets();
  const fromFile = Object.entries(assetSources).filter(([, v]) => v === 'file').map(([k]) => k);
  console.info(`[assets] ${fromFile.length} loaded from files:`, fromFile.join(', ') || '(none — using placeholders)');
}

boot();
