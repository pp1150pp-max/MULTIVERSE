// The Seeker's key quests: kill QUEST_KILLS monsters of a boss's map, come back, get a bound key that
// opens that boss's room at ×1 until the boss is beaten. This window lists what he offers, what is under
// way and what is ready to hand in. The server decides everything (Sim.questAccept / questTurnIn).
import type { Game } from './Game';
import { MONSTERS } from '../shared/data/monsters';
import { QUEST_KILLS, STONE_NAME } from '../shared/data/stones';
import { questRows } from '../shared/quests';
import { bossShortName } from '../shared/bossRoom';
import { stoneIcon } from './icons';
import { GEAR_KILLS, GEAR_PART_NAME, gearRarity, gearRewardText, gearRows, type GearRow } from '../shared/gearQuests';
import { RARITY_COLOR, RARITY_LABEL } from '../shared/types';

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
    const gear = gearRows(this.g.player);
    const sig = JSON.stringify([rows.map((r) => [r.state, r.kills]), gear.map((r) => [r.state, r.kills]), this.g.player.level]);
    if (sig === this.drawn) return;
    this.drawn = sig;
    this.body.replaceChildren(el('div', 'quest-intro',
      'ประตูสู่ห้องบอสต้องใช้กุญแจ — ช่วยข้าล่ามอนสเตอร์ แล้วข้าจะมอบกุญแจที่ใช้ได้จนกว่าเจ้าจะปราบบอสตัวนั้นได้'));
    if (rows.some((r) => r.state !== 'done')) this.body.append(el('div', 'quest-head', 'กุญแจบอส'));
    for (const r of rows) {
      // Finished quests (that boss is beaten) leave the list (owner 2026-11-12).
      if (r.state === 'done') continue;
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
    this.gearSection(gear);
    const story = el('button', '', 'ฟังเรื่องราว');
    story.onclick = () => {
      this.toggle(false);
      this.story();
    };
    this.body.append(story);
  }

  /** The gear quests: each map's next one (or the one under way), and a map not reached yet as one locked line. */
  private gearSection(rows: GearRow[]): void {
    const lvl = this.g.player.level;
    const shown = rows.filter((r) => r.state !== 'done' && (r.state !== 'locked' || (r.part === 'weapon' && lvl < r.map.levels[0])));
    if (!shown.length) return;
    this.body.append(el('div', 'quest-head', 'อุปกรณ์'));
    for (const r of shown) {
      const rarity = gearRarity(r.map);
      const row = el('div', `quest-row ${r.state}`);
      const text = el('div', 'quest-text');
      const grade = el('span', '', ` (${RARITY_LABEL[rarity]})`);
      grade.style.color = RARITY_COLOR[rarity];
      text.append(el('b', '', `${GEAR_PART_NAME[r.part]} · ${r.map.nameTh}`), grade);
      const sub = el('div', 'quest-sub');
      sub.textContent =
        r.state === 'offer' ? `ล่ามอนสเตอร์ใน${r.map.nameTh} ${GEAR_KILLS} ตัว · ได้ ${gearRewardText(r.part)}`
        : r.state === 'going' ? `ล่ามอนสเตอร์ใน${r.map.nameTh} ${r.kills}/${GEAR_KILLS}`
        : r.state === 'ready' ? `ล่าครบ ${GEAR_KILLS} ตัวแล้ว — รับ ${gearRewardText(r.part)} ได้เลย`
        : `ต้อง Lv.${r.map.levels[0]} ขึ้นไป`;
      text.append(sub);
      row.append(text);
      if (r.state === 'offer' || r.state === 'ready') {
        const btn = el('button', 'primary', r.state === 'offer' ? 'รับภารกิจ' : 'รับอุปกรณ์');
        btn.onclick = () => (r.state === 'offer' ? this.g.backend.gearAccept(r.id) : this.g.backend.gearTurnIn(r.id));
        row.append(btn);
      }
      this.body.append(row);
    }
  }
}
