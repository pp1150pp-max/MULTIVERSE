// The tutorial talk window (owner 2026-11-14): clicking an NPC that shows a tutorial ! or ? opens this first,
// with what the step asks for, what it gives, a take / hand-in button and a button on to the NPC's own
// window. The server decides everything (Sim.tutAccept / tutTurnIn); rules in src/shared/tutorial.ts.
import type { Game } from './Game';
import { npcLook, type NpcId } from '../shared/data/npcs';
import { STONE_NAME } from '../shared/data/stones';
import { currentBalance } from '../shared/balance';
import {
  TUT_ACCEPT_GOLD, TUT_ACCEPT_STONES, TUT_INTRO, TUT_STEP_NAME, TUT_STEPS, TUT_TASK_NAME, TUT_TASKS,
  tutMark, tutRewardText, tutRows, tutTurnInReward, type TutStep,
} from '../shared/tutorial';
import { RewardWin, rewardIcons } from './rewardWin';
import { talkIconUrl } from './npcDialog';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class TutorialUI {
  private readonly win: HTMLElement;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private npc: NpcId | null = null;
  private drawn = '';
  /** The step just sent to hand in, and when: once it shows as done, the reward window (F) pops. */
  private turningIn: { step: TutStep; at: number } | null = null;
  private readonly reward = new RewardWin();

  /** `openNpc` opens the NPC's own window (shop, stash, forge, market). */
  constructor(private readonly g: Game, private readonly openNpc: (id: NpcId) => void) {
    // D (owner 2026-11-26): a parchment quest card with a scroll and the rewards as icons.
    this.win = el('div', 'panel hidden quest-card');
    this.win.id = 'tut-win';
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.close();
    this.title = el('span');
    head.append(this.title, close);
    this.body = el('div', 'quest-body');
    this.win.append(head, this.body);
    document.getElementById('hud')!.append(this.win);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  /** Whether this NPC has a tutorial step to give or take now (so a click talks first). */
  wants(id: NpcId): boolean {
    return tutMark(tutRows(this.g.player.tut, this.g.player.name), id) !== '';
  }

  show(id: NpcId): void {
    this.npc = id;
    this.drawn = '';
    this.win.classList.remove('hidden');
    this.update();
  }

  close(): void {
    this.win.classList.add('hidden');
    this.npc = null;
  }

  update(): void {
    this.watchTurnIns();
    const id = this.npc;
    if (!this.open || !id) return;
    // Walked away: the window closes.
    const n = this.g.backend.terrain.npcPos[id];
    if (!n || Math.hypot(this.g.player.x - n.x, this.g.player.z - n.z) > 6) return this.close();
    const p = this.g.player;
    const rows = tutRows(p.tut, p.name).filter((r) => r.npc === id && r.state !== 'locked' && r.state !== 'done');
    const sig = JSON.stringify([rows, this.g.backend.guest, currentBalance().tutorial]);
    if (sig === this.drawn) return;
    this.drawn = sig;
    this.title.textContent = npcLook(id, this.g.backend.zone.town).name;
    this.body.replaceChildren();
    for (const r of rows) {
      const top = el('div', 'qc-top');
      const scroll = el('img', 'qc-scroll');
      scroll.src = talkIconUrl(r.state === 'ready' ? 'turnin' : 'quest');
      scroll.alt = '';
      const txt = el('div');
      top.append(scroll, txt);
      this.body.append(top);
      txt.append(el('div', 'quest-head', `ภารกิจสอนระบบ ${TUT_STEPS.indexOf(r.step) + 1}/${TUT_STEPS.length}: ${TUT_STEP_NAME[r.step]}`));
      if (r.state === 'offer') txt.append(el('div', 'quest-intro', TUT_INTRO[r.step]));
      const list = el('div', 'tut-tasks');
      for (const k of TUT_TASKS[r.step]) {
        const got = r.got.includes(k);
        list.append(el('div', got ? 'tut-task got' : 'tut-task', `${got ? '✓' : '☐'} ${TUT_TASK_NAME[k]}`));
      }
      this.body.append(list);
      if (r.state === 'busy') {
        this.body.append(el('div', 'quest-sub', `ตัวละครอื่นในบัญชีนี้ (${p.tut.cur?.by ?? ''}) รับภารกิจนี้ไปแล้ว — ภารกิจสอนระบบได้ครั้งเดียวต่อบัญชี`));
        continue;
      }
      const stones = TUT_ACCEPT_STONES[r.step] ?? [];
      if (r.state === 'offer' && p.tut.paid?.includes(r.step)) {
        this.body.append(el('div', 'quest-sub', 'รับต่อจากตัวละครที่ถูกลบ — บัญชีนี้ได้ของตอนรับภารกิจไปแล้ว จะไม่ได้ซ้ำ'));
      } else if (r.state === 'offer') {
        const extra = stones.map((s) => `${STONE_NAME[s.stone]} ×${s.count}`).join(', ');
        this.body.append(el('div', 'quest-sub', `รับภารกิจแล้วได้ทันที: ${TUT_ACCEPT_GOLD.toLocaleString()} G${extra ? ` + ${extra} (เข้ากระเป๋า)` : ''}`));
      }
      const reward = tutTurnInReward(r.step, currentBalance().tutorial);
      this.body.append(el('div', 'quest-head', 'รางวัลเมื่อส่งภารกิจ (ส่งทางจดหมาย)'), rewardIcons(reward));
      if (!reward.gold && !reward.items.length) this.body.append(el('div', 'quest-sub', tutRewardText(reward)));
      if (r.state === 'ready' && this.g.backend.guest) {
        this.body.append(el('div', 'quest-sub tut-warn', 'Guest ไม่มีกล่องจดหมาย — สมัครสมาชิกก่อนจึงจะส่งภารกิจได้ (ตัวละครนี้จะย้ายไปอยู่ในบัญชีใหม่)'));
      }
      if (r.state === 'offer' || r.state === 'ready') {
        const btn = el('button', r.state === 'offer' ? 'quest-accept' : 'quest-turnin', r.state === 'offer' ? '! รับภารกิจ' : '? ส่งภารกิจ');
        btn.onclick = () => (r.state === 'offer' ? this.g.backend.tutAccept(r.step) : this.turnIn(r.step));
        const btns = el('div', 'qc-btns');
        btns.append(btn);
        if (r.state === 'offer') {
          const no = el('button', '', 'ปฏิเสธ');
          no.onclick = () => this.close();
          btns.append(no);
        }
        this.body.append(btns);
      } else if (r.state === 'going') {
        const btn = el('button', 'quest-progress', `กำลังทำ ${r.got.length}/${TUT_TASKS[r.step].length}`);
        btn.disabled = true;
        this.body.append(btn);
      }
    }
    const go = el('button', '', `${npcLook(id).action}`);
    go.onclick = () => {
      this.close();
      this.openNpc(id);
    };
    this.body.append(go);
  }

  private turnIn(step: TutStep): void {
    this.turningIn = { step, at: performance.now() };
    this.g.backend.tutTurnIn(step);
  }

  /** F: the step sent to hand in shows as done (within 20 s): show what was mailed. */
  private watchTurnIns(): void {
    const t = this.turningIn;
    if (!t) return;
    if (performance.now() - t.at > 20_000) {
      this.turningIn = null;
      return;
    }
    const p = this.g.player;
    if (!tutRows(p.tut, p.name).some((r) => r.step === t.step && r.state === 'done')) return;
    this.turningIn = null;
    this.reward.show('ได้รับรางวัลแล้ว!', `ภารกิจ ${TUT_STEP_NAME[t.step]} สำเร็จ — รางวัลส่งไปที่กล่องจดหมายแล้ว`,tutTurnInReward(t.step, currentBalance().tutorial));
  }
}
