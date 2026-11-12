// The quest tracker under the "online" line at the top left: every quest taken from The Seeker, how far
// along it is, and when it is ready to hand in. It folds away (remembered per browser); on a narrow
// portrait screen it starts folded. Clicking a quest opens the map.
import type { Game } from './Game';
import { QUEST_KILLS, STONE_NAME } from '../shared/data/stones';
import { questRows } from '../shared/quests';
import { GEAR_KILLS, GEAR_PART_NAME, gearRows } from '../shared/gearQuests';

const FOLD_KEY = 'multiverse-quest-tracker-folded';

/** Folded state the player chose, or null if they never chose. */
function savedFold(): boolean | null {
  try {
    const v = localStorage.getItem(FOLD_KEY);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

export class QuestTracker {
  private readonly box: HTMLElement;
  private readonly head: HTMLButtonElement;
  private readonly list: HTMLElement;
  private folded: boolean;
  private drawn = '';

  constructor(private readonly g: Game) {
    this.folded = savedFold() ?? matchMedia('(max-width: 700px) and (orientation: portrait)').matches;
    this.box = document.createElement('div');
    this.box.id = 'quest-tracker';
    this.box.className = 'hidden';
    this.head = document.createElement('button');
    this.head.className = 'qt-head';
    this.head.onclick = () => {
      this.folded = !this.folded;
      try {
        localStorage.setItem(FOLD_KEY, this.folded ? '1' : '0');
      } catch { /* private window: just not remembered */ }
      this.drawn = '';
      this.update();
    };
    this.list = document.createElement('div');
    this.list.className = 'qt-list';
    this.box.append(this.head, this.list);
    // Right under the online line, above the guest badge.
    document.getElementById('hud-online')!.after(this.box);
  }

  update(): void {
    // Key quests then gear quests, each as a name, the map, kills so far and the goal.
    const rows = [
      ...questRows(this.g.player).map((r) => ({ id: r.boss, name: STONE_NAME[r.key], map: r.map, state: r.state, kills: r.kills, max: QUEST_KILLS })),
      ...gearRows(this.g.player).map((r) => ({ id: r.id, name: `${GEAR_PART_NAME[r.part]} · ${r.map.nameTh}`, map: r.map, state: r.state, kills: r.kills, max: GEAR_KILLS })),
    ].filter((r) => r.state === 'going' || r.state === 'ready');
    const sig = JSON.stringify([this.folded, rows.map((r) => [r.id, r.state, r.kills])]);
    if (sig === this.drawn) return;
    this.drawn = sig;
    this.box.classList.toggle('hidden', !rows.length);
    this.box.classList.toggle('folded', this.folded);
    const ready = rows.some((r) => r.state === 'ready');
    this.head.innerHTML = `<span class="qt-arrow">${this.folded ? '▸' : '▾'}</span> 📜 เควส (${rows.length})` +
      (this.folded && ready ? ' <span class="qt-ready-dot">?</span>' : '');
    this.head.title = this.folded ? 'กางรายการเควส' : 'พับรายการเควส';
    this.list.replaceChildren();
    if (this.folded) return;
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = `qt-row ${r.state}`;
      row.title = 'คลิกเพื่อเปิดแผนที่';
      row.onclick = () => this.g.hud.toggleMap(true);
      const name = document.createElement('div');
      name.className = 'qt-name';
      name.textContent = r.name;
      const goal = document.createElement('div');
      goal.className = 'qt-goal';
      goal.textContent = r.state === 'ready'
        ? 'ล่าครบแล้ว — กลับไปหา The Seeker'
        : `ล่ามอนสเตอร์ใน${r.map.nameTh} ${r.kills}/${r.max}`;
      const bar = document.createElement('div');
      bar.className = 'qt-bar';
      const fill = document.createElement('div');
      fill.style.width = `${Math.min(100, (r.kills / r.max) * 100)}%`;
      bar.append(fill);
      row.append(name, goal, bar);
      this.list.append(row);
    }
  }
}
