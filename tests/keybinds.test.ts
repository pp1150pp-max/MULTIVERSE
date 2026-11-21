// Players' own keys (owner 2026-11-21, src/client/keybinds.ts): moving an action, a key another action had (it loses
// it), reset, what is kept in the browser, and the /admin switch.
import { ok, finish } from './check';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { applyBalance } = await import('../src/shared/balance');
const kb = await import('../src/client/keybinds');

ok(kb.keyOf('q') === 'KeyQ' && kb.gameKey('KeyQ') === 'KeyQ', 'defaults: Q is Q');
ok(kb.gameKey('ArrowUp') === 'ArrowUp' && kb.gameKey('Escape') === 'Escape', 'keys of no action pass through');

let changed = 0;
kb.onKeysChange(() => changed++);
ok(kb.bindKey('q', 'KeyX') === null, 'Q onto a free key: nobody loses one');
ok(kb.keyOf('q') === 'KeyX' && kb.gameKey('KeyX') === 'KeyQ', 'X now casts the Q skill');
ok(kb.gameKey('KeyQ') === null, 'the old Q key does nothing');
ok(changed === 1, 'listeners told');
ok(JSON.parse(store.get('multiverse-keybinds') ?? '{}').q === 'KeyX', 'kept in the browser');

const lost = kb.bindKey('e', 'KeyF');
ok(lost === 'เปิด/ปิด Auto', `a key Auto had: Auto loses it (${lost})`);
ok(kb.keyOf('auto') === '' && kb.gameKey('KeyF') === 'KeyE', 'F casts E, Auto has no key');
ok(kb.keyLabel(kb.keyOf('auto')) === '—' && kb.keyLabel('Digit1') === '1' && kb.keyLabel('Space') === 'SPACE', 'labels');

kb.bindKey('q', 'KeyQ');
ok(kb.keyOf('q') === 'KeyQ' && JSON.parse(store.get('multiverse-keybinds') ?? '{}').q === undefined, 'back on its default: nothing stored for it');

kb.clearKey('dash');
ok(kb.keyOf('dash') === '' && kb.gameKey('Space') === null, 'dash with no key: Space does nothing');

applyBalance({ fxLayer: { keyRebind: false } });
ok(kb.gameKey('KeyF') === 'KeyF' && kb.keyOf('auto') === 'KeyF' && !kb.isBoundKey('KeyX'), '/admin off: the code keys');
applyBalance({});
ok(kb.gameKey('KeyF') === 'KeyE', 'back on: the player keys again');

kb.resetKeys();
ok(kb.keyOf('auto') === 'KeyF' && kb.keyOf('e') === 'KeyE' && kb.keyOf('dash') === 'Space' && !store.has('multiverse-keybinds'), 'reset: all defaults, nothing stored');

finish('keybinds');
