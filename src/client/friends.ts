// The friends window: friends (online / offline, level, class, map) with whisper / party invite / trade /
// remove buttons, friend requests (in and out), and the block list. The server decides everything
// (server/friends.ts) and sends the whole view on every change; this only shows it and asks.
// Party invites and trade requests go through the existing systems (backend.partyInvite / trade.request).
import type { Game } from './Game';
import { CLASSES } from '../shared/data/classes';
import { ZONES } from '../shared/data/zones';
import { FRIEND_MAX, FRIEND_NAME_MAX, type FriendEntry, type FriendsView } from '../shared/friends';
import { whisperPrefix } from './hud';

/** The icon badge's key (the icon's Thai label, see SystemMenu.setBadge). */
export const FRIENDS_BADGE = 'เพื่อน';

type Tab = 'friends' | 'requests' | 'blocked';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function button(label: string, onClick: () => void, cls = '', title = ''): HTMLButtonElement {
  const b = el('button', cls, label);
  b.onclick = onClick;
  if (title) b.title = title;
  return b;
}

/** A map's Thai name; boss rooms and maps this browser doesn't know get a plain label. */
function mapName(zone: string): string {
  return ZONES[zone]?.nameTh ?? (zone ? 'พื้นที่พิเศษ' : 'ไม่ทราบ');
}

export class FriendsUI {
  private readonly win: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly body: HTMLElement;
  private tab: Tab = 'friends';
  private view: FriendsView | null = null;
  /** What is typed in the add / block box (kept when the list redraws). */
  private typed = '';
  /** What was drawn last (the view, the tab and the map), so a redraw only happens on a change. */
  private drawn = '';

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'friends-win';
    const head = el('div', 'panel-head');
    head.append(el('span', '', 'เพื่อน'), button('✕', () => this.toggle(false)));
    this.tabs = el('div', 'ui-tabs');
    this.body = el('div', 'friends-body');
    this.win.append(head, this.tabs, this.body);
    $('hud').append(this.win);
    // A view that came before the game screen was up.
    if (g.backend.friends) this.show(g.backend.friends);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    if (this.g.backend.guest) {
      if (force !== false) this.g.hud.log('Guest ใช้ระบบเพื่อนไม่ได้ — สมัครสมาชิกเพื่อใช้งาน', '#ffcf6a');
      return;
    }
    const show = force ?? !this.open;
    this.win.classList.toggle('hidden', !show);
    if (show) {
      this.g.backend.friendList();
      this.drawn = '';
      this.update();
    }
  }

  /** The server sent a new view. */
  show(view: FriendsView): void {
    this.view = view;
    this.g.sysMenu.setBadge(FRIENDS_BADGE, view.incoming.length);
    this.update();
  }

  /** Whether this character's account is on the friends list. */
  isFriend(name: string): boolean {
    const n = name.toLowerCase();
    return !!this.view?.friends.some((f) => f.char?.name.toLowerCase() === n);
  }

  /** Called every frame: redraws only when something shown changed (your map decides the trade buttons). */
  update(): void {
    if (!this.open) return;
    const key = JSON.stringify([this.view, this.tab, this.g.backend.zone.id]);
    if (key === this.drawn) return;
    this.drawn = key;
    this.render();
  }

  // ------------------------------------------------------------ drawing

  private render(): void {
    const v = this.view ?? { friends: [], incoming: [], outgoing: [], blocked: [] };
    const online = v.friends.filter((f) => f.online).length;
    const tabs: [Tab, string][] = [
      ['friends', `เพื่อน ${online}/${v.friends.length}`],
      ['requests', `คำขอ${v.incoming.length ? ` (${v.incoming.length})` : ''}`],
      ['blocked', `บล็อก${v.blocked.length ? ` (${v.blocked.length})` : ''}`],
    ];
    this.tabs.replaceChildren(...tabs.map(([id, label]) => button(label, () => {
      this.tab = id;
      this.update();
    }, `ui-tab${this.tab === id ? ' active' : ''}`)));

    const b = this.body;
    b.replaceChildren();
    if (this.tab === 'friends') {
      b.append(this.nameBox('ชื่อตัวละครที่จะเพิ่มเป็นเพื่อน', 'ส่งคำขอ', (n) => this.g.backend.friendRequest(n)));
      b.append(el('div', 'hint', `เพื่อน ${v.friends.length}/${FRIEND_MAX} · หรือคลิกตัวละครในเกมแล้วเลือก "เพิ่มเป็นเพื่อน"`));
      const list = el('div', 'friends-list');
      if (!v.friends.length) list.append(el('div', 'friends-empty', 'ยังไม่มีเพื่อน'));
      for (const f of v.friends) list.append(this.friendRow(f));
      b.append(list);
    } else if (this.tab === 'requests') {
      b.append(el('div', 'friends-sub', 'คำขอถึงคุณ'));
      const inc = el('div', 'friends-list');
      if (!v.incoming.length) inc.append(el('div', 'friends-empty', 'ไม่มีคำขอ'));
      for (const f of v.incoming) {
        inc.append(this.row(f, [
          button('ยอมรับ', () => this.g.backend.friendAnswer(f.acc, true), 'primary'),
          button('ปฏิเสธ', () => this.g.backend.friendAnswer(f.acc, false)),
        ]));
      }
      b.append(inc, el('div', 'friends-sub', 'คำขอที่คุณส่ง (รอคำตอบ)'));
      const out = el('div', 'friends-list');
      if (!v.outgoing.length) out.append(el('div', 'friends-empty', 'ไม่มีคำขอ'));
      for (const f of v.outgoing) out.append(this.row(f, [button('ยกเลิก', () => this.g.backend.friendCancel(f.acc))]));
      b.append(out);
    } else {
      b.append(this.nameBox('ชื่อตัวละครที่จะบล็อก', 'บล็อก', (n) => this.askBlock(n)));
      b.append(el('div', 'hint', 'คนที่ถูกบล็อกส่งคำขอเพื่อน กระซิบ ชวนปาร์ตี้ หรือขอเทรดหาคุณไม่ได้ (บล็อกทั้งบัญชีของเขา)'));
      const list = el('div', 'friends-list');
      if (!v.blocked.length) list.append(el('div', 'friends-empty', 'ไม่ได้บล็อกใคร'));
      for (const x of v.blocked) {
        const row = el('div', 'friend-row');
        const info = el('div', 'friend-info');
        info.append(el('b', '', x.name));
        const btns = el('div', 'friend-btns');
        btns.append(button('ปลดบล็อก', () => this.g.backend.friendUnblock(x.acc)));
        row.append(info, btns);
        list.append(row);
      }
      b.append(list);
    }
  }

  /** A name box with one button (Enter does the same); clears itself after sending. */
  private nameBox(placeholder: string, label: string, act: (name: string) => void): HTMLElement {
    const box = el('div', 'friends-add');
    const input = el('input');
    input.maxLength = FRIEND_NAME_MAX;
    input.placeholder = placeholder;
    input.value = this.typed;
    const go = () => {
      const n = input.value.trim();
      if (!n) return;
      act(n);
      input.value = this.typed = '';
    };
    // Keys typed here are for the box, not the game (WASD, I, M…).
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') go();
      else if (e.key === 'Escape') input.blur();
    });
    input.addEventListener('input', () => (this.typed = input.value));
    box.append(input, button(label, go));
    return box;
  }

  /** Name, class, level, map and online state of one account. */
  private info(f: FriendEntry): HTMLElement {
    const info = el('div', 'friend-info');
    const top = el('div', 'friend-name');
    top.append(el('i', `friend-dot${f.online ? ' on' : ''}`), el('b', '', f.char?.name ?? '(ไม่มีตัวละคร)'));
    if (f.char) top.append(el('span', 'friend-lv', ` Lv.${f.char.lv} ${CLASSES[f.char.cls]?.name ?? ''}`));
    const sub = el('div', 'friend-sub', f.online ? mapName(f.char?.zone ?? '') : `ออฟไลน์${f.char?.zone ? ` · ล่าสุด ${mapName(f.char.zone)}` : ''}`);
    info.append(top, sub);
    return info;
  }

  private row(f: FriendEntry, btns: HTMLElement[]): HTMLElement {
    const row = el('div', `friend-row${f.online ? '' : ' offline'}`);
    const box = el('div', 'friend-btns');
    box.append(...btns);
    row.append(this.info(f), box);
    return row;
  }

  private friendRow(f: FriendEntry): HTMLElement {
    const name = f.char?.name ?? '';
    const on = f.online && !!name;
    const sameMap = on && f.char!.zone === this.g.backend.zone.id;
    const whisper = button('กระซิบ', () => {
      this.toggle(false);
      this.g.hud.openChat(whisperPrefix(name));
    }, '', on ? '' : 'เพื่อนต้องออนไลน์อยู่');
    whisper.disabled = !on;
    const party = button('ชวนตี้', () => this.g.backend.partyInvite(name), '', on ? 'ชวนเข้าปาร์ตี้' : 'เพื่อนต้องออนไลน์อยู่');
    party.disabled = !on;
    const trade = button('เทรด', () => this.g.trade.request(name), '', !on ? 'เพื่อนต้องออนไลน์อยู่' : sameMap ? 'ขอเทรด' : 'ต้องอยู่แมพเดียวกันถึงจะเทรดได้');
    trade.disabled = !sameMap;
    const remove = button('ลบ', () => this.g.hud.confirm(`ลบ <b>${esc(name || 'เพื่อนคนนี้')}</b> ออกจากรายชื่อเพื่อน?`, 'ลบเพื่อน', () => this.g.backend.friendRemove(f.acc)), 'friend-remove');
    return this.row(f, [whisper, party, trade, remove]);
  }

  /** Blocking asks first (it also ends a friendship). */
  askBlock(name: string): void {
    this.g.hud.confirm(
      `บล็อก <b>${esc(name)}</b>?<br><small>ถ้าเป็นเพื่อนกันจะถูกลบออก · เขาจะส่งคำขอเพื่อน กระซิบ ชวนปาร์ตี้ หรือขอเทรดหาคุณไม่ได้</small>`,
      'บล็อก',
      () => this.g.backend.friendBlock(name),
    );
  }
}
