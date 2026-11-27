// The NPC talk window (owner 2026-11-26, docs/systems/world-and-ui.md "หน้าต่างคุย NPC"): clicking an NPC opens a
// scene of its place with a big waist-up portrait on the left, what it says in a box at the bottom (name plate on
// top) and its answers above that box on the right, each with an icon. An answer opens the NPC's own window (shop,
// forge menu, stash, market tab…), the tutorial quest card, or pages through a story in the box.
// Lines and the on/off switch: currentBalance().npcTalk (src/shared/npcTalk.ts, /admin → ปรับสมดุล). Browser only.
import type { Game } from './Game';
import { npcLook, NPC_USE_RANGE, type NpcId } from '../shared/data/npcs';
import { currentBalance } from '../shared/balance';
import { tutRows, TUT_STEP_NAME } from '../shared/tutorial';
import { imgUrl } from './img';
import { NpcShopPane } from './ui/npcShopPane';
import { npcForgePane } from './ui/npcForgePane';
import { npcStashPane } from './ui/npcStashPane';
import { npcMarketPane } from './ui/npcMarketPane';
import { npcCashPane } from './ui/npcCashPane';
import type { MarketTab } from './market';
import type { NpcHostPane } from './ui/npcHostPane';

/** The NPC windows that open inside the talk window, how to tell they are still open, and how to close them. */
type HostKind = 'forge' | 'stash' | 'market' | 'cash';
const HOST_KINDS: readonly HostKind[] = ['forge', 'stash', 'market', 'cash'];
const HOST_OPEN: Record<HostKind, (g: Game) => boolean> = {
  forge: (g) => g.hud.forgeWin.isOpen, stash: (g) => g.hud.stashWin.isOpen, market: (g) => g.hud.marketWin.isOpen, cash: (g) => g.cashShop.open,
};
const HOST_CLOSE: Record<HostKind, (g: Game) => void> = {
  forge: (g) => g.hud.forgeWin.closeForge(), stash: (g) => g.hud.stashWin.closeStash(), market: (g) => g.hud.marketWin.close(),
  cash: (g) => { if (g.cashShop.open) g.cashShop.toggle(false); },
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** The answer icons (tools/cut_npc_dialog.cjs). */
export type TalkIcon = 'enhance' | 'reroll' | 'restat' | 'card' | 'buy' | 'sell' | 'stash' | 'market' | 'parcel' | 'crystal'
  | 'quest' | 'turnin' | 'talk' | 'key' | 'story' | 'leave';
export const talkIconUrl = (icon: TalkIcon): string => imgUrl(`/assets/sprites/paper/ui/npc_dialog/icon_${icon}.png`);

/** Floor 1's NPCs with their own painted scene and portrait. Others borrow a scene and use their small portrait. */
const PAINTED: readonly NpcId[] = ['seeker', 'merchant', 'blacksmith', 'keeper', 'broker', 'crystal'];
const SCENE: Partial<Record<NpcId, NpcId>> = { navigator: 'seeker', stylist: 'crystal' };
/** The scene's colours while its picture loads (or when there is none). */
const TINT: Record<NpcId, string> = {
  seeker: '#2a2f52', merchant: '#4a5a2a', blacksmith: '#5a2e1a', keeper: '#3e3224', broker: '#3a2a1e',
  crystal: '#1e2450', navigator: '#1f3a52', stylist: '#4a2848',
};

/** Forge menu modes → icons (the buttons are read from #forge-menu, so a new mode shows here by itself). */
const FORGE_ICON: Record<string, TalkIcon> = { enhance: 'enhance', values: 'reroll', stat: 'restat', card: 'card', socket: 'card' };

interface Answer {
  icon: TalkIcon;
  label: string;
  /** Small text after the label (a count). */
  note?: string;
  run: () => void;
}

export class NpcDialog {
  private readonly win: HTMLElement;
  private readonly scene: HTMLElement;
  private readonly face: HTMLImageElement;
  private readonly answers: HTMLElement;
  private readonly name: HTMLElement;
  private readonly text: HTMLElement;
  private readonly next: HTMLElement;
  private npc: NpcId | null = null;
  private zoneSeq = -1;
  private lineIdx = -1;
  /** A story being paged through in the box (The Seeker's), and what runs after its last line. */
  private story: { lines: readonly string[]; at: number; done: () => void } | null = null;
  private drawn = '';
  /** Opened away from the NPC (the cash shop's top icon): walking doesn't close it, nor does the NPC's absence. */
  private remote = false;
  /** The windows that grow out of this one (owner 2026-11-27): the merchant's shop and the blacksmith. */
  private readonly shopPane: NpcShopPane;
  /** The NPC windows moved into this one (the blacksmith's, the stash). */
  private readonly hosts: Record<HostKind, NpcHostPane>;
  /** Which of them is open (null = talking). */
  private pane: 'shop' | HostKind | null = null;

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'npc-talk';
    this.scene = el('div', 'nt-scene');
    this.face = el('img', 'nt-face');
    this.face.alt = '';
    this.answers = el('div', 'nt-answers');
    const box = el('div', 'nt-box');
    this.name = el('div', 'nt-name');
    this.text = el('div', 'nt-text');
    this.next = el('div', 'nt-next', '▸');
    box.append(this.name, this.text, this.next);
    box.onclick = () => this.advance();
    const close = el('button', 'nt-close', '✕');
    close.onclick = () => this.close();
    const back = el('button', 'nt-back', '◀ กลับไปคุย');
    back.onclick = () => this.leavePane(true);
    this.shopPane = new NpcShopPane(g, (text) => this.say(text));
    const say = (text: string) => this.say(text);
    this.hosts = { forge: npcForgePane(g, say), stash: npcStashPane(g, say), market: npcMarketPane(g, say), cash: npcCashPane(g, say) };
    g.hud.forgeWin.onTalk = (key, ...args) => { if (this.pane === 'forge') this.hosts.forge.line(key, ...args); };
    g.hud.stashWin.onTalk = (key, ...args) => { if (this.pane === 'stash') this.hosts.stash.line(key, ...args); };
    g.hud.marketWin.onTalk = (key, ...args) => { if (this.pane === 'market') this.hosts.market.line(key, ...args); };
    g.cashShop.onTalk = (key, ...args) => { if (this.pane === 'cash') this.hosts.cash.line(key, ...args); };
    this.win.append(this.scene, this.face, this.answers, box, this.shopPane.root, this.hosts.forge.root, this.hosts.stash.root, this.hosts.market.root, this.hosts.cash.root, back, close);
    document.getElementById('hud')!.append(this.win);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  show(id: NpcId, remote = false): void {
    this.leavePane(false);
    this.npc = id;
    this.remote = remote;
    this.zoneSeq = this.g.backend.zoneSeq;
    this.story = null;
    this.drawn = '';
    const look = npcLook(id, this.g.backend.zone.town);
    const sceneId = PAINTED.includes(id) ? id : SCENE[id];
    this.scene.style.backgroundColor = TINT[id];
    this.scene.style.backgroundImage = sceneId ? `url("${imgUrl(`/assets/sprites/paper/ui/npc_dialog/bg_${sceneId}.png`)}")` : '';
    // Harbour NPCs and the navigator have their own (small, square) paper portrait; floor 1's have the big painted one.
    const small = !!look.portrait;
    this.face.classList.toggle('small', small);
    this.face.src = small ? imgUrl(`/assets/sprites/paper/ui/npc/${look.portrait}.png`)
      : PAINTED.includes(id) ? imgUrl(`/assets/sprites/paper/ui/npc_dialog/portrait_${id}.png`) : '';
    this.face.classList.toggle('hidden', !this.face.src);
    this.name.textContent = look.name;
    this.lineIdx = -1;
    this.say(this.nextGreet());
    this.win.classList.remove('hidden');
    this.update();
  }

  close(): void {
    if (!this.open) return;
    this.leavePane(false);
    this.win.classList.add('hidden');
    this.npc = null;
    this.story = null;
  }

  /** Every frame: closes when the player walks away, dies or changes map; redraws the answers when they change. */
  update(): void {
    const id = this.npc;
    if (!this.open || !id) return;
    const p = this.g.player;
    const n = this.g.backend.terrain.npcPos[id];
    // Shop / blacksmith / stash / market: the server deals only within NPC_USE_RANGE, so the window closes there (and when the HUD closed theirs).
    const reach = this.pane ? NPC_USE_RANGE : NPC_USE_RANGE + 1;
    const far = !this.remote && (!n || Math.hypot(p.x - n.x, p.z - n.z) > reach);
    if (far || !p.alive || this.g.backend.zoneSeq !== this.zoneSeq) return this.close();
    if (this.pane === 'shop') {
      if (!this.g.hud.shopOpen) return this.close();
      return this.shopPane.update();
    }
    if (this.pane) {
      if (!HOST_OPEN[this.pane](this.g)) return this.close();
      return this.hosts[this.pane].update();
    }
    const list = this.story ? [] : this.answerList(id);
    const sig = JSON.stringify(list.map((a) => [a.icon, a.label, a.note]));
    if (sig === this.drawn) return;
    this.drawn = sig;
    this.answers.replaceChildren(...list.map((a, i) => {
      const b = el('button', `nt-ans${i === 0 ? ' first' : ''}`);
      const ic = el('img', 'nt-icon');
      ic.src = talkIconUrl(a.icon);
      ic.alt = '';
      b.append(ic, el('span', 'nt-label', a.label));
      if (a.note) b.append(el('span', 'nt-note', a.note));
      b.onclick = () => a.run();
      return b;
    }));
  }

  /** What the NPC says: in the text box, and (shopping) the bubble beside the medallion. Plain text. */
  private say(line: string): void {
    this.text.textContent = line;
    this.next.classList.toggle('hidden', !this.story);
    if (this.pane === 'shop') this.shopPane.setLine(line);
    else if (this.pane) this.hosts[this.pane].setLine(line);
  }

  /** Whether the merchant's shop shows inside this window (/admin: talk window on and "ร้านพ่อค้าในหน้าต่างคุย" on). */
  get shopInTalk(): boolean {
    const t = currentBalance().npcTalk;
    return t.on && t.shopPane;
  }

  /** Closes a prompt open inside the shop (Esc); false when there was none. */
  dismissPrompt(): boolean {
    return this.pane === 'shop' && this.shopPane.dismissPrompt();
  }

  /** Opens this window on the merchant's shop straight away (the quest card's button). */
  openShop(id: NpcId): void {
    this.show(id);
    this.enterShop(id, 'buy');
  }

  /** Whether the blacksmith's menus open inside this window (/admin: talk window on and "ช่างตีเหล็กในหน้าต่างคุย" on). */
  get forgeInTalk(): boolean {
    const t = currentBalance().npcTalk;
    return t.on && t.forgePane;
  }

  /** Whether the stash opens inside this window (/admin: talk window on and "คลังในหน้าต่างคุย" on). */
  get stashInTalk(): boolean {
    const t = currentBalance().npcTalk;
    return t.on && t.stashPane;
  }

  /** Whether the market opens inside this window (/admin: talk window on and "ตลาดในหน้าต่างคุย" on). */
  get marketInTalk(): boolean {
    const t = currentBalance().npcTalk;
    return t.on && t.marketPane;
  }

  /** Opens this window on the market straight away (the quest card's button). */
  openMarket(id: NpcId): void {
    this.show(id);
    this.enterMarket(id, 'buy');
  }

  /** Whether the cash shop opens inside this window (/admin: talk window on and "แคชช็อปในหน้าต่างคุย" on). */
  get cashInTalk(): boolean {
    const t = currentBalance().npcTalk;
    return t.on && t.cashPane;
  }

  /** Opens the cash shop in this window with the crystal merchant: at the NPC, or from anywhere (the top icon). */
  openCash(): void {
    const n = this.g.backend.terrain.npcPos.crystal;
    const p = this.g.player;
    const near = !!n && Math.hypot(p.x - n.x, p.z - n.z) <= NPC_USE_RANGE;
    if (!(this.pane === 'cash' && this.open)) this.show('crystal', !near);
    if (this.pane !== 'cash') this.enterCash('crystal');
  }

  /** The window grows into the cash shop (owner 2026-11-28: the whole width, no bag). */
  private enterCash(id: NpcId): void {
    this.g.cashShop.openInTalk();
    this.enterHost('cash', id, '');
    this.hosts.cash.line(this.g.cashShop.saleOpen ? 'open' : 'notOpen');
  }

  /** Opens this window on the stash straight away (the quest card's button). */
  openStash(id: NpcId): void {
    this.show(id);
    this.enterStash(id);
  }

  /** Opens this window on the blacksmith's menu `mode` straight away (the quest card's button). */
  openForge(id: NpcId, mode = 'enhance'): void {
    this.show(id);
    this.enterForge(id, mode);
  }

  /** The face shown in the medallion, and whether it is a square harbour portrait. */
  private medalFace(id: NpcId): [string, boolean] {
    const look = npcLook(id, this.g.backend.zone.town);
    return [this.face.classList.contains('hidden') ? '' : this.face.src, !!look.portrait];
  }

  /** "ซื้อ/ขายของ": the window grows into the merchant's shop (owner 2026-11-27, layout A). */
  private enterShop(id: NpcId, tab: 'buy' | 'bb'): void {
    this.g.hud.openShopInTalk();
    this.pane = 'shop';
    this.shopPane.open(tab, ...this.medalFace(id));
    for (const k of HOST_KINDS) this.hosts[k].root.classList.remove('on');
    this.shopPane.root.classList.add('on');
    this.win.classList.add('shop');
    this.shopPane.line(tab === 'bb' ? 'openBuyback' : 'open');
  }

  /** A blacksmith menu: the window grows into the blacksmith's window, on that menu (owner 2026-11-27). */
  private enterForge(id: NpcId, mode: string): void {
    this.g.hud.openForgeInTalk();
    this.enterHost('forge', id, mode);
    this.hosts.forge.line('open', this.g.hud.forgeWin.modeLabel());
  }

  /** "เปิดคลังเก็บของ": the window grows into the stash (owner 2026-11-27). Guests can't use it (the server refuses too). */
  private enterStash(id: NpcId): void {
    if (this.g.backend.guest) {
      this.say(currentBalance().npcTalk.stash.guest[0] ?? 'Guest ใช้คลังเก็บของไม่ได้');
      return;
    }
    this.g.hud.openStashInTalk();
    this.enterHost('stash', id, '');
    this.hosts.stash.line('open');
  }

  /** "ตลาดฝากขาย" / "กล่องรับของ": the window grows into the market on that tab (owner 2026-11-27). Guests may look. */
  private enterMarket(id: NpcId, tab: MarketTab): void {
    this.g.hud.marketWin.openTab(tab);
    this.g.hud.openMarketInTalk();
    this.enterHost('market', id, tab);
    this.hosts.market.line(tab === 'box' ? 'box' : 'open');
  }

  private enterHost(kind: HostKind, id: NpcId, arg: string): void {
    this.pane = kind;
    this.win.classList.add('shop');
    for (const k of HOST_KINDS) this.hosts[k].root.classList.toggle('on', k === kind);
    this.shopPane.root.classList.remove('on');
    this.hosts[kind].open(arg, ...this.medalFace(id));
  }

  /** Back from the shop, the blacksmith or the stash: `talk` = to the talk window (◀), else the window is closing. */
  private leavePane(talk: boolean): void {
    const was = this.pane;
    if (!was) return;
    this.pane = null;
    if (was === 'shop') {
      this.shopPane.close();
      if (this.g.hud.shopOpen) this.g.hud.closeShop();
    } else {
      HOST_CLOSE[was](this.g);
      this.hosts[was].close();
    }
    this.win.classList.remove('shop');
    this.drawn = '';
    if (talk) {
      this.say(this.nextGreet());
      this.update();
    }
  }

  private nextGreet(): string {
    const lines = this.npc ? currentBalance().npcTalk.greet[this.npc] : [];
    if (!lines.length) return '…';
    // "พูดคุย" never says the same line twice in a row.
    let i = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && i === this.lineIdx) i = (i + 1) % lines.length;
    this.lineIdx = i;
    return lines[i];
  }

  /** Click on the text box: the next line of a story; the last one ends it. */
  private advance(): void {
    const s = this.story;
    if (!s) return;
    s.at++;
    if (s.at >= s.lines.length) {
      this.story = null;
      this.drawn = '';
      s.done();
      this.say(this.nextGreet());
      return;
    }
    this.say(s.lines[s.at]);
  }

  /** Pages `lines` through the box (the answers hide until the last one is read). */
  private tell(lines: readonly string[], done: () => void): void {
    if (!lines.length) return;
    this.story = { lines, at: 0, done };
    this.drawn = '';
    this.say(lines[0]);
    this.update();
  }

  /** Opens the NPC's own window, then picks a tab or menu in it by clicking its button. */
  private openThen(id: NpcId, selector?: string): void {
    this.close();
    this.g.hud.openNpcWindow(id);
    if (selector) document.querySelector<HTMLElement>(selector)?.click();
  }

  private answerList(id: NpcId): Answer[] {
    const g = this.g;
    const out: Answer[] = [];
    // A tutorial step here: the quest card first (src/client/tutorial.ts).
    if (id !== 'seeker' && id !== 'navigator' && g.tutorial.wants(id)) {
      const row = tutRows(g.player.tut, g.player.name).find((r) => r.npc === id && (r.state === 'offer' || r.state === 'ready'));
      const ready = row?.state === 'ready';
      out.push({
        icon: ready ? 'turnin' : 'quest',
        label: `${ready ? 'ส่งเควส' : 'รับเควส'}${row ? `: ${TUT_STEP_NAME[row.step]}` : ''}`,
        run: () => { this.close(); g.tutorial.show(id); },
      });
    }
    switch (id) {
      case 'seeker':
        out.push({ icon: 'key', label: 'เควสกุญแจบอส', run: () => this.openThen(id) });
        out.push({ icon: 'story', label: 'ฟังเรื่องราว', run: () => this.tell(g.hud.seekerLines, () => g.hud.seekerStoryDone()) });
        break;
      case 'navigator':
        out.push({ icon: 'quest', label: 'ทางขึ้นชั้น 2', run: () => this.openThen(id) });
        break;
      case 'merchant':
        // /admin "ร้านพ่อค้าในหน้าต่างคุย" off = the old small shop window.
        if (currentBalance().npcTalk.shopPane) {
          out.push({ icon: 'buy', label: 'ซื้อ/ขายของ', run: () => this.enterShop(id, 'buy') });
          out.push({ icon: 'sell', label: 'ซื้อคืนของที่ขายไป', run: () => this.enterShop(id, 'bb') });
          break;
        }
        out.push({ icon: 'buy', label: 'ซื้อ/ขายของ', run: () => this.openThen(id, '#shop-tabs [data-tab="buy"]') });
        out.push({ icon: 'sell', label: 'ซื้อคืนของที่ขายไป', run: () => this.openThen(id, '#shop-tabs [data-tab="buyback"]') });
        break;
      case 'blacksmith':
        // /admin "ช่างตีเหล็กในหน้าต่างคุย" off = the old blacksmith window.
        for (const b of document.querySelectorAll<HTMLElement>('#forge-menu [data-mode]')) {
          const mode = b.dataset.mode!;
          const run = currentBalance().npcTalk.forgePane ? () => this.enterForge(id, mode) : () => this.openThen(id, `#forge-menu [data-mode="${mode}"]`);
          out.push({ icon: FORGE_ICON[mode] ?? 'enhance', label: b.textContent?.trim() || mode, run });
        }
        if (!out.length) out.push({ icon: 'enhance', label: 'ตีบวกอุปกรณ์', run: () => this.openThen(id) });
        break;
      case 'keeper':
        // /admin "คลังในหน้าต่างคุย" off = the old stash window.
        out.push({ icon: 'stash', label: 'เปิดคลังเก็บของ', run: () => (currentBalance().npcTalk.stashPane ? this.enterStash(id) : this.openThen(id)) });
        break;
      case 'broker': {
        const box = g.backend.marketBox;
        // /admin "ตลาดในหน้าต่างคุย" off = the old market window.
        const inTalk = currentBalance().npcTalk.marketPane;
        out.push({ icon: 'market', label: 'ตลาดฝากขาย', run: () => (inTalk ? this.enterMarket(id, 'buy') : this.openThen(id, '[data-mtab="buy"]')) });
        out.push({ icon: 'parcel', label: 'กล่องรับของ', note: box > 0 ? `${box}` : undefined, run: () => (inTalk ? this.enterMarket(id, 'box') : this.openThen(id, '[data-mtab="box"]')) });
        break;
      }
      case 'crystal':
        // /admin "แคชช็อปในหน้าต่างคุย" off = the old cash shop window.
        out.push({ icon: 'crystal', label: 'เปิดแคชช็อป', run: () => (currentBalance().npcTalk.cashPane ? this.enterCash(id) : this.openThen(id)) });
        break;
      case 'stylist':
        out.push({ icon: 'buy', label: 'ร้านแต่งตัว', run: () => this.openThen(id) });
        break;
    }
    out.push({ icon: 'talk', label: 'พูดคุย', run: () => this.say(this.nextGreet()) });
    out.push({ icon: 'leave', label: 'ลาก่อน', run: () => this.close() });
    return out;
  }
}
