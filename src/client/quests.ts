// The Seeker's key quests: kill QUEST_KILLS monsters of a boss's map, come back, get a bound key that
// opens that boss's room at ×1 until the boss is beaten. This window lists what he offers, what is under
// way and what is ready to hand in. The server decides everything (Sim.questAccept / questTurnIn).
import type { Game } from './Game';
import { MONSTERS } from '../shared/data/monsters';
import { QUEST_KILLS, STONE_NAME } from '../shared/data/stones';
import { questRows } from '../shared/quests';
import { bossShortName } from '../shared/bossRoom';
import { stoneIcon } from './icons';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class QuestUI {
  private readonly win: HTMLElement;
  private readonly body: HTMLElement;
  private drawn = '';

  constructor(private readonly g: Game, private readonly story: () => void) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'quest-win';
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.toggle(false);
    head.append(el('span', '', 'The Seeker'), close);
    this.body = el('div', 'quest-body');
    this.win.append(head, this.body);
    $('hud').append(this.win);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    this.win.classList.toggle('hidden', !show);
    this.drawn = '';
    if (show) this.update();
  }

  update(): void {
    if (!this.open) return;
    // Walked away from him: the window closes.
    const n = this.g.backend.terrain.npcPos.seeker;
    if (!n || Math.hypot(this.g.player.x - n.x, this.g.player.z - n.z) > 6) {
      this.toggle(false);
      return;
    }
    const rows = questRows(this.g.player);
    const sig = JSON.stringify(rows.map((r) => [r.state, r.kills]));
    if (sig === this.drawn) return;
    this.drawn = sig;
    this.body.replaceChildren(el('div', 'quest-intro',
      'ประตูสู่ห้องบอสต้องใช้กุญแจ — ช่วยข้าล่ามอนสเตอร์ แล้วข้าจะมอบกุญแจที่ใช้ได้จนกว่าเจ้าจะปราบบอสตัวนั้นได้'));
    for (const r of rows) {
      const name = bossShortName(MONSTERS[r.boss].nameTh);
      const row = el('div', `quest-row ${r.state}`);
      const text = el('div', 'quest-text');
      text.innerHTML = `${stoneIcon(r.key)} <b>${STONE_NAME[r.key]}</b>`;
      const sub = el('div', 'quest-sub');
      sub.textContent =
        r.state === 'offer' ? `ล่ามอนสเตอร์ใน${r.map.nameTh} ${QUEST_KILLS} ตัว`
        : r.state === 'going' ? `ล่ามอนสเตอร์ใน${r.map.nameTh} ${r.kills}/${QUEST_KILLS}`
        : r.state === 'ready' ? `ล่าครบ ${QUEST_KILLS} ตัวแล้ว — รับกุญแจได้เลย`
        : r.state === 'holding' ? `มีกุญแจแล้ว — ใส่ที่แท่นเรียก${name}`
        : r.state === 'done' ? `ปราบ${name}แล้ว`
        : `ต้อง Lv.${r.map.levels[0]} ขึ้นไป`;
      text.append(sub);
      row.append(text);
      if (r.state === 'offer' || r.state === 'ready') {
        const btn = el('button', 'primary', r.state === 'offer' ? 'รับภารกิจ' : 'รับกุญแจ');
        btn.onclick = () => (r.state === 'offer' ? this.g.backend.questAccept(r.boss) : this.g.backend.questTurnIn(r.boss));
        row.append(btn);
      }
      this.body.append(row);
    }
    const story = el('button', '', 'ฟังเรื่องราว');
    story.onclick = () => {
      this.toggle(false);
      this.story();
    };
    this.body.append(story);
  }
}
