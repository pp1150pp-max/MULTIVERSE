// Boss room screens: the summoner's window (how many keys to put in), the leader's lobby (who answered,
// start / call off), the invite popup party members get, and the room line on the HUD (which boss, ×keys,
// which room, and the countdown home once the boss is dead). The server decides everything
// (server/bossRooms.ts); this only shows its messages and asks. Plain CSS, ids for painted art later.
import type { Game } from './Game';
import { MONSTERS } from '../shared/data/monsters';
import { BOSS_KEY, BOSS_QUEST_KEY, STONE_COLOR, STONE_NAME } from '../shared/data/stones';
import { bossShortName, ROOM_KEYS_MAX, roomInviteText, type RoomAnswer, type RoomLobbyView } from '../shared/bossRoom';
import { potionIcon, stoneIcon } from './icons';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

const ANSWER_LABEL: Record<RoomAnswer, string> = { wait: 'รอตอบ…', yes: 'ไป', no: 'ไม่ไป' };

/**
 * Reminder shown every time before going into a boss room (owner 2026-11-10): bring phoenix feathers
 * and potions. Lists what the player carries; anything they have none of is red.
 */
function packLine(g: Game): HTMLElement {
  const p = g.player;
  const n = (have: number, unit: string) => `<b class="${have > 0 ? '' : 'room-pack-none'}">${have} ${unit}</b>`;
  const line = el('div', 'room-pack');
  line.innerHTML = 'ก่อนเข้า เตรียมขนนกฟีนิกซ์และยาไปด้วย: ' +
    `<span>${stoneIcon('phoenix')} ${n(p.stoneCount('phoenix'), 'อัน')}</span>` +
    `<span>${potionIcon('hp')} ${n(p.potionCount('hp'), 'ขวด')}</span>` +
    `<span>${potionIcon('mp')} ${n(p.potionCount('mp'), 'ขวด')}</span>`;
  return line;
}

export class RoomUI {
  /** The summoner's window. */
  private readonly win: HTMLElement;
  private readonly body: HTMLElement;
  /** Keys picked in the summoner's window. */
  private keys = 1;
  /** The leader's lobby, and when its countdown ends (performance.now()). */
  private readonly lobbyBox: HTMLElement;
  private lobbyUntil = 0;
  private lobbyCount: HTMLElement | null = null;
  /** The start button while members are still answering, and when their time runs out (performance.now()). */
  private lobbyStart: HTMLButtonElement | null = null;
  private answerUntil = 0;
  private readonly invitesBox: HTMLElement;
  private readonly invites = new Map<number, { el: HTMLElement; until: number; count: HTMLElement }>();
  /** The line on the HUD while in a room. */
  private readonly line: HTMLElement;
  private drawnLine = '';
  private readonly countdown: HTMLElement;
  private drawnCount = 0;
  private readonly exitBtn: HTMLButtonElement;

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'room-win';
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.toggle(false);
    head.append(el('span', '', 'แท่นเรียกบอส'), close);
    this.body = el('div', 'room-body');
    this.win.append(head, this.body);
    $('hud').append(this.win);

    this.lobbyBox = el('div', 'panel hidden');
    this.lobbyBox.id = 'room-lobby';
    $('hud').append(this.lobbyBox);

    this.invitesBox = el('div');
    this.invitesBox.id = 'room-invites';
    $('hud').append(this.invitesBox);

    $('btn-revive').onclick = () => this.g.backend.roomRevive();
    // The countdown before the boss appears, big in the middle of the screen (owner 2026-11-12).
    this.countdown = el('div', 'hidden');
    this.countdown.id = 'room-countdown';
    $('hud').append(this.countdown);
    // The boss is dead: the way out, from anywhere in the room (there is no portal, owner 2026-11-12).
    this.exitBtn = el('button', 'primary hidden', 'ออกจากห้องบอส');
    this.exitBtn.id = 'btn-room-exit';
    this.exitBtn.onclick = () => this.g.backend.roomLeave();
    $('hud').append(this.exitBtn);
    this.line = el('div', 'hidden');
    this.line.id = 'room-line';
    $('hud').append(this.line);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  /** The summoner of this map: its boss and that boss's key. */
  private get summoner() {
    const s = this.g.backend.terrain.summoner;
    const key = s && BOSS_KEY[s.boss];
    return s && key ? { ...s, key, name: bossShortName(MONSTERS[s.boss].nameTh) } : null;
  }

  toggle(force?: boolean): void {
    const show = (force ?? !this.open) && !!this.summoner;
    this.win.classList.toggle('hidden', !show);
    if (show) this.render();
  }

  /** The summoner's window: the boss, your keys, how many to put in, and what that means. */
  private render(): void {
    const s = this.summoner;
    if (!s) return;
    const have = this.g.player.stoneCount(s.key);
    this.keys = Math.max(1, Math.min(this.keys, ROOM_KEYS_MAX, Math.max(1, have)));
    const def = MONSTERS[s.boss];
    this.body.replaceChildren();
    const title = el('div', 'room-title');
    title.append(el('b', '', `${s.name} Lv.${def.levels[0]}`));
    const keyLine = el('div', 'room-key');
    keyLine.innerHTML = `${stoneIcon(s.key)} <span style="color:${STONE_COLOR[s.key]}">${STONE_NAME[s.key]}</span> มี ${have} อัน`;
    const pick = el('div', 'room-pick');
    const minus = el('button', '', '−');
    const plus = el('button', '', '+');
    const num = el('b', 'room-num', `×${this.keys}`);
    minus.disabled = this.keys <= 1;
    plus.disabled = this.keys >= Math.min(ROOM_KEYS_MAX, have);
    minus.onclick = () => {
      this.keys--;
      this.render();
    };
    plus.onclick = () => {
      this.keys++;
      this.render();
    };
    pick.append(el('span', '', 'ใส่กุญแจ'), minus, num, plus);
    const note = el('div', 'room-note',
      `บอส HP และดาเมจ ×${this.keys} · รางวัล ×${this.keys} · กุญแจหายทันทีที่ใส่ (ได้คืนถ้ายกเลิกก่อนเริ่ม)`);
    const party = this.g.backend.party;
    const leader = party?.members[0];
    const lead = !leader || (leader.online && leader.pid === this.g.player.id && leader.zone === this.g.backend.zone.id);
    const who = el('div', 'room-note', party
      ? lead ? 'สมาชิกปาร์ตี้ที่ออนไลน์จะได้รับคำเชิญ แล้วคุณกดเริ่มได้' : 'ในปาร์ตี้ เฉพาะหัวตี้เท่านั้นที่ใส่กุญแจได้'
      : 'ไม่มีปาร์ตี้: เข้าห้องบอสคนเดียวทันที');
    const go = el('button', 'primary', party && lead ? 'ใส่กุญแจและเชิญปาร์ตี้' : 'ใส่กุญแจและเข้าห้อง');
    go.id = 'room-go';
    go.disabled = have < 1 || !lead;
    go.onclick = () => {
      this.g.backend.roomOpen(this.keys);
      this.toggle(false);
    };
    if (have < 1) note.textContent = `ยังไม่มี${STONE_NAME[s.key]} — ดรอปจากมอนสเตอร์ในแมพนี้ ซื้อในตลาด หรือรับภารกิจจาก The Seeker`;
    this.body.append(title, keyLine, pick, note, who, packLine(this.g), go);
    // The Seeker's key: ×1, not used up.
    const qkey = BOSS_QUEST_KEY[s.boss];
    if (qkey && this.g.player.stoneCount(qkey) > 0) {
      const q = el('button', '', `ใช้${STONE_NAME[qkey]} (×1 ไม่หาย)`);
      q.id = 'room-quest';
      q.disabled = !lead;
      q.onclick = () => {
        this.g.backend.roomOpen(1, true);
        this.toggle(false);
      };
      this.body.append(q);
    }
  }

  // ------------------------------------------------------------ the leader's lobby

  lobby(view: RoomLobbyView | null): void {
    this.lobbyBox.classList.toggle('hidden', !view);
    this.lobbyBox.replaceChildren();
    this.lobbyCount = null;
    this.lobbyStart = null;
    if (!view) return;
    this.lobbyUntil = performance.now() + view.left * 1000;
    const head = el('div', 'panel-head');
    head.append(el('span', '', `${bossShortName(MONSTERS[view.boss]?.nameTh ?? view.boss)} ×${view.keys}`));
    this.lobbyCount = el('span', 'party-count');
    head.append(this.lobbyCount);
    const list = el('div', 'room-members');
    for (const m of view.members) {
      const row = el('div', `room-member ${m.answer}`);
      row.append(el('span', '', m.name), el('b', '', ANSWER_LABEL[m.answer]));
      list.append(row);
    }
    const btns = el('div', 'party-invite-btns');
    const start = el('button', 'primary', 'เริ่ม');
    start.id = 'room-start';
    const cancel = el('button', '', 'ยกเลิก');
    cancel.id = 'room-cancel';
    start.onclick = () => this.g.backend.roomStart();
    // Everyone answers first (or the answer time runs out): the server sends the lobby again then.
    this.lobbyStart = view.members.some((m) => m.answer === 'wait') ? start : null;
    this.answerUntil = performance.now() + view.answerLeft * 1000;
    start.disabled = !!this.lobbyStart;
    cancel.onclick = () => this.g.hud.confirm('ยกเลิกการตีบอส?<br><small>กุญแจจะคืนเข้ากระเป๋า</small>', 'ยกเลิก', () => this.g.backend.roomCancel());
    btns.append(start, cancel);
    this.lobbyBox.append(head, list, el('div', 'room-note', 'กดเริ่มได้เมื่อทุกคนตอบแล้ว หรือครบ 30 วิ · คนที่ตอบ "ไป" จะวาร์ปเข้าห้องพร้อมคุณ'), btns);
    this.update();
  }

  // ------------------------------------------------------------ invites

  invited(id: number, from: string, boss: string, keys: number, seconds: number): void {
    this.removeInvite(id);
    const box = el('div', 'party-invite room-invite');
    box.append(el('div', '', roomInviteText(from, boss, keys)), packLine(this.g));
    const count = el('span', 'party-count');
    const yes = el('button', 'primary', 'ไป');
    const no = el('button', '', 'ไม่ไป');
    yes.onclick = () => {
      this.g.backend.roomAnswer(id, true);
      this.removeInvite(id);
    };
    no.onclick = () => {
      this.g.backend.roomAnswer(id, false);
      this.removeInvite(id);
    };
    const btns = el('div', 'party-invite-btns');
    btns.append(yes, no, count);
    box.append(btns);
    this.invitesBox.append(box);
    this.invites.set(id, { el: box, until: performance.now() + seconds * 1000, count });
    this.update();
  }

  removeInvite(id: number): void {
    this.invites.get(id)?.el.remove();
    this.invites.delete(id);
  }

  /** The leave button: in a boss room whose boss is dead, alive. Shows how long until everyone is sent out. */
  private updateExit(): void {
    const r = this.g.backend.room;
    const show = !!r && r.leaveIn !== undefined && this.g.player.alive;
    this.exitBtn.classList.toggle('hidden', !show);
    if (!show) return;
    const label = `ออกจากห้องบอส (ออกอัตโนมัติใน ${Math.ceil(r.leaveIn!)} วิ)`;
    if (this.exitBtn.textContent !== label) this.exitBtn.textContent = label;
  }

  private updateCountdown(): void {
    const left = this.g.backend.room?.bossIn;
    const n = left === undefined ? 0 : Math.ceil(left);
    if (n === this.drawnCount) return;
    this.drawnCount = n;
    this.countdown.classList.toggle('hidden', n <= 0);
    if (n <= 0) return;
    this.countdown.textContent = String(n);
    // Replays the pop for each new number.
    this.countdown.classList.remove('pop');
    void this.countdown.offsetWidth;
    this.countdown.classList.add('pop');
  }

  /** Dead in a boss room: the death screen offers getting up here with a phoenix feather. */
  private updateRevive(): void {
    const btn = $<HTMLButtonElement>('btn-revive');
    const r = this.g.backend.room;
    const have = this.g.player.stoneCount('phoenix');
    const show = !!r && !this.g.player.alive;
    const respawn = r ? 'ฟื้นคืนชีพที่แท่นเรียกบอส' : 'ฟื้นคืนชีพที่เมือง';
    const rb = $('btn-respawn');
    if (rb.textContent !== respawn) rb.textContent = respawn;
    btn.classList.toggle('hidden', !show);
    if (!show) return;
    btn.disabled = r.revives <= 0 || have <= 0;
    const label = r.revives <= 0 ? 'ชุบชีวิตในห้องนี้ครบแล้ว'
      : have <= 0 ? `ไม่มี${STONE_NAME.phoenix}`
      : `❤ ใช้${STONE_NAME.phoenix} ฟื้นที่นี่ (เหลือ ${r.revives} ครั้ง · มี ${have} อัน)`;
    if (btn.textContent !== label) btn.textContent = label;
  }

  // ------------------------------------------------------------ every frame

  update(): void {
    const now = performance.now();
    for (const [id, inv] of this.invites) {
      const left = Math.ceil((inv.until - now) / 1000);
      if (left <= 0) this.removeInvite(id);
      else inv.count.textContent = `${left} วิ`;
    }
    if (this.lobbyCount) this.lobbyCount.textContent = `${Math.max(0, Math.ceil((this.lobbyUntil - now) / 1000))} วิ`;
    if (this.lobbyStart) this.lobbyStart.textContent = `รอสมาชิกตอบ (${Math.max(0, Math.ceil((this.answerUntil - now) / 1000))} วิ)`;
    // Walked away from the summoner: its window closes.
    const s = this.g.backend.terrain.summoner;
    if (this.open && (!s || Math.hypot(this.g.player.x - s.x, this.g.player.z - s.z) > 6)) this.toggle(false);
    const r = this.g.backend.room;
    const text = r
      ? `${bossShortName(MONSTERS[r.boss]?.nameTh ?? r.boss)} ×${r.keys} · ห้อง ${r.channel} · ❤ ${r.revives}` +
        (r.wipeIn !== undefined ? ` · ทุกคนล้มหมด! ชุบภายใน ${Math.ceil(r.wipeIn)} วิ` : '') +
        (r.leaveIn !== undefined ? ` · ออกไปที่แท่นเรียกบอสใน ${Math.ceil(r.leaveIn)} วิ` : '')
      : '';
    this.updateRevive();
    this.updateCountdown();
    this.updateExit();
    if (text !== this.drawnLine) {
      this.drawnLine = text;
      this.line.textContent = text;
      this.line.classList.toggle('hidden', !text);
    }
  }
}
