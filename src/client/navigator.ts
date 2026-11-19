// The navigator of the dimensions in nexus_city (owner 2026-11-19, src/shared/floorGate.ts): his talk window.
// The first time it is the quest that opens floor 2 (hand it in: the way opens and the reward is mailed); after
// that a button takes the player up to the harbour. The server decides everything (Sim.floorTurnIn / floorTravel).
import type { Game } from './Game';
import { currentBalance } from '../shared/balance';
import { navState } from '../shared/floorGate';
import { tutRewardText } from '../shared/tutorial';
import { imgUrl } from './img';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class NavigatorUI {
  private readonly win: HTMLElement;
  private readonly body: HTMLElement;
  private drawn = '';

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'nav-win';
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.close();
    head.append(el('span', '', 'นักเดินเรือแห่งมิติ'), close);
    this.body = el('div', 'quest-body');
    this.win.append(head, this.body);
    document.getElementById('hud')!.append(this.win);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  show(): void {
    this.drawn = '';
    this.win.classList.remove('hidden');
    this.update();
  }

  close(): void {
    this.win.classList.add('hidden');
  }

  update(): void {
    if (!this.open) return;
    // Walked away (or no longer in his town): the window closes.
    const n = this.g.backend.terrain.npcPos.navigator;
    if (!n || this.g.backend.zone.town === 'harbor' || Math.hypot(this.g.player.x - n.x, this.g.player.z - n.z) > 6) return this.close();
    const p = this.g.player;
    const b = currentBalance();
    const state = navState(p, b);
    const sig = JSON.stringify([state, this.g.backend.guest, b.floorGate]);
    if (sig === this.drawn) return;
    this.drawn = sig;
    const face = el('img', 'nav-portrait');
    face.src = imgUrl('/assets/sprites/paper/ui/npc/navigator.png');
    face.alt = '';
    face.style.cssText = 'width:64px;height:64px;border-radius:6px;float:left;margin:0 10px 6px 0';
    this.body.replaceChildren(face);
    if (state === 'locked') {
      this.body.append(el('div', 'quest-intro', 'ทะเลเมฆยังไม่ต้อนรับเจ้า — กลับมาเมื่อเจ้าแข็งแกร่งพอ'));
      return;
    }
    if (state === 'closed') {
      this.body.append(el('div', 'quest-intro', 'คลื่นลมบนทะเลเมฆแรงเกินไป ทางขึ้นชั้น 2 ปิดอยู่ชั่วคราว ไว้ค่อยกลับมาใหม่'));
      return;
    }
    if (state === 'offer') {
      this.body.append(
        el('div', 'quest-head', 'ภารกิจ: ทางสู่ทะเลเมฆ'),
        el('div', 'quest-intro', 'เจ้าปราบหัวใจภูเขาไฟได้แล้ว… เหนือเกาะแห่งนี้ยังมีทะเลเมฆที่โจรสลัดแล่นเรือข้ามมิติ ข้าจะเปิดทางให้เจ้าขึ้นไปยังท่าเรือมิติ'),
        el('div', 'quest-sub', `รางวัล (ส่งทางจดหมาย ของผูกตัวละคร): ${tutRewardText(b.floorGate.reward)}`),
      );
      if (this.g.backend.guest) {
        this.body.append(el('div', 'quest-sub tut-warn', 'Guest ไม่มีกล่องจดหมาย — สมัครสมาชิกก่อนจึงจะส่งภารกิจได้ (ตัวละครนี้จะย้ายไปอยู่ในบัญชีใหม่)'));
        return;
      }
      const btn = el('button', 'primary', 'ส่งภารกิจ เปิดทางขึ้นชั้น 2');
      btn.onclick = () => this.g.backend.floorTurnIn();
      this.body.append(btn);
      return;
    }
    this.body.append(el('div', 'quest-intro', 'เรือพร้อมออกแล้ว จะขึ้นไปยังท่าเรือมิติเลยไหม? กลับลงมาได้ทางประตูข้างประภาคาร'));
    const go = el('button', 'primary', 'ไปท่าเรือมิติ');
    go.onclick = () => {
      this.close();
      this.g.backend.floorTravel();
    };
    this.body.append(go);
  }
}
