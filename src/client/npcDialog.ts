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
    this.win.append(this.scene, this.face, this.answers, box, close);
    document.getElementById('hud')!.append(this.win);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  show(id: NpcId): void {
    this.npc = id;
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
    if (!n || !p.alive || this.g.backend.zoneSeq !== this.zoneSeq || Math.hypot(p.x - n.x, p.z - n.z) > NPC_USE_RANGE + 1) return this.close();
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

  private say(line: string): void {
    this.text.textContent = line;
    this.next.classList.toggle('hidden', !this.story);
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
        out.push({ icon: 'buy', label: 'ซื้อ/ขายของ', run: () => this.openThen(id, '#shop-tabs [data-tab="buy"]') });
        out.push({ icon: 'sell', label: 'ซื้อคืนของที่ขายไป', run: () => this.openThen(id, '#shop-tabs [data-tab="buyback"]') });
        break;
      case 'blacksmith':
        for (const b of document.querySelectorAll<HTMLElement>('#forge-menu [data-mode]')) {
          const mode = b.dataset.mode!;
          out.push({ icon: FORGE_ICON[mode] ?? 'enhance', label: b.textContent?.trim() || mode, run: () => this.openThen(id, `#forge-menu [data-mode="${mode}"]`) });
        }
        if (!out.length) out.push({ icon: 'enhance', label: 'ตีบวกอุปกรณ์', run: () => this.openThen(id) });
        break;
      case 'keeper':
        out.push({ icon: 'stash', label: 'เปิดคลังเก็บของ', run: () => this.openThen(id) });
        break;
      case 'broker': {
        const box = g.backend.marketBox;
        out.push({ icon: 'market', label: 'ตลาดฝากขาย', run: () => this.openThen(id, '[data-mtab="buy"]') });
        out.push({ icon: 'parcel', label: 'กล่องรับของ', note: box > 0 ? `${box}` : undefined, run: () => this.openThen(id, '[data-mtab="box"]') });
        break;
      }
      case 'crystal':
        out.push({ icon: 'crystal', label: 'เปิดแคชช็อป', run: () => this.openThen(id) });
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
