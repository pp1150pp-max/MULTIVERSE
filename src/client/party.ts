// Party screens: the party window (create, members, invite search, leave), the members panel under the
// character card, invite popups, and the small menu for kicking a member or inviting a player clicked
// in the world. The server decides everything (server/party.ts); this only shows its snapshot and asks.
// Plain CSS on purpose: the icons (.party-ico) and frames are easy to swap for painted art later.
import type { Game } from './Game';
import type { Player } from '../shared/sim/Player';
import { PARTY_SEARCH_MAX, type PartyMemberSnap, type PartySnap } from '../shared/party';
import { CLASSES } from '../shared/data/classes';

const BLOCK_KEY = 'multiverse-party-block';
/** Wait this long after typing before searching (the server allows one search per 250 ms). */
const SEARCH_DELAY_MS = 300;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function loadBlock(): boolean {
  try {
    return localStorage.getItem(BLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

/** HP and MP bars with numbers, for one member. */
function bars(m: PartyMemberSnap): HTMLElement {
  const box = el('div', 'party-bars');
  for (const [kind, v, max] of [['hp', m.hp, m.maxHp], ['mp', m.mp, m.maxMp]] as const) {
    const bar = el('div', `party-bar ${kind}`);
    const fill = el('div', 'party-fill');
    fill.style.width = `${m.online ? Math.min(100, (v / Math.max(1, max)) * 100) : 0}%`;
    bar.append(fill, el('span', '', m.online ? `${v} / ${max}` : '—'));
    box.append(bar);
  }
  return box;
}

/** Name line: leader icon, name, level, class, offline tag. */
function nameLine(m: PartyMemberSnap): HTMLElement {
  const line = el('div', 'party-name');
  if (m.leader) line.append(el('span', 'party-ico leader', '♛'));
  line.append(el('b', '', m.name), el('span', 'party-lv', ` Lv.${m.lv} ${CLASSES[m.cls]?.name ?? ''}`));
  if (!m.online) line.append(el('span', 'party-off', ' ออฟไลน์'));
  return line;
}

export class PartyUI {
  private readonly win: HTMLElement;
  private readonly body: HTMLElement;
  private readonly hudBox: HTMLElement;
  private readonly invitesBox: HTMLElement;
  private readonly menu: HTMLElement;
  /** Open invites: party id → popup and when it runs out (performance.now()). */
  private readonly invites = new Map<number, { el: HTMLElement; until: number; count: HTMLElement }>();
  private searchOpen = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchInput: HTMLInputElement | null = null;
  private results: HTMLElement | null = null;
  /**
   * What was last drawn, so things only rebuild when it changes: the window's layout (who leads, who is
   * in, the search open), its member rows (HP/MP too), and the HUD panel. The layout holds the search
   * box, so HP changing never wipes what is being typed.
   */
  private drawnLayout = '';
  private drawnList = '';
  private drawnHud = '';
  private listBox: HTMLElement | null = null;
  block = loadBlock();

  constructor(private readonly g: Game) {
    this.win = el('div', 'panel hidden');
    this.win.id = 'party-win';
    const head = el('div', 'panel-head');
    const close = el('button', '', '✕');
    close.onclick = () => this.toggle(false);
    head.append(el('span', '', 'ปาร์ตี้'), close);
    this.body = el('div', 'party-body');
    this.win.append(head, this.body);
    $('hud').append(this.win);

    this.hudBox = el('div');
    this.hudBox.id = 'party-hud';
    $('hud-topleft').append(this.hudBox);

    this.invitesBox = el('div');
    this.invitesBox.id = 'party-invites';
    $('hud').append(this.invitesBox);

    this.menu = el('div', 'hidden');
    this.menu.id = 'party-menu';
    $('hud').append(this.menu);
    document.addEventListener('pointerdown', (e) => {
      if (!this.menu.contains(e.target as Node)) this.closeMenu();
    });

    g.backend.setPartyBlock(this.block);
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  get party(): PartySnap | null {
    return this.g.backend.party;
  }

  toggle(force?: boolean): void {
    const show = force ?? !this.open;
    this.win.classList.toggle('hidden', !show);
    if (!show) {
      this.searchOpen = false;
      this.closeMenu();
    }
    this.drawnLayout = '';
    if (show) this.update();
  }

  /** The "don't accept party invites" setting (remembered by this browser). */
  setBlock(on: boolean): void {
    this.block = on;
    try {
      localStorage.setItem(BLOCK_KEY, on ? '1' : '0');
    } catch {
      // Storage blocked: it holds for this visit only.
    }
    this.g.backend.setPartyBlock(on);
  }

  /** The party member in this zone with this player id (for nameplates and the map), if any. */
  memberOf(p: Player): PartyMemberSnap | undefined {
    const zone = this.g.backend.zone.id;
    return this.party?.members.find((m) => m.online && m.pid === p.id && m.zone === zone);
  }

  /** Other members online on this map, wherever they are (for the minimap and the full map). */
  mapMates(): PartyMemberSnap[] {
    const zone = this.g.backend.zone.id;
    const me = this.g.player.id;
    return this.party?.members.filter((m) => m.online && m.zone === zone && m.pid !== me) ?? [];
  }

  private get isMe(): (m: PartyMemberSnap) => boolean {
    const zone = this.g.backend.zone.id;
    const me = this.g.player.id;
    return (m) => m.online && m.pid === me && m.zone === zone;
  }

  private get canInvite(): boolean {
    const p = this.party;
    return !this.g.backend.guest && (!p || p.members.some((m) => m.leader && this.isMe(m)));
  }

  // ------------------------------------------------------------ per frame

  update(): void {
    const key = JSON.stringify(this.party);
    if (key !== this.drawnHud) {
      this.drawnHud = key;
      this.renderHud();
    }
    if (this.open) {
      const p = this.party;
      const layout = JSON.stringify([p?.id, p?.members.map((m) => [m.charId, m.leader]), this.canInvite, this.searchOpen]);
      if (layout !== this.drawnLayout) {
        this.drawnLayout = layout;
        this.drawnList = '';
        this.render();
      }
      if (key !== this.drawnList) {
        this.drawnList = key;
        this.renderList();
      }
    }
    const now = performance.now();
    for (const [id, inv] of this.invites) {
      const left = Math.ceil((inv.until - now) / 1000);
      if (left <= 0) this.removeInvite(id);
      else inv.count.textContent = `${left} วิ`;
    }
  }

  /** Members other than you, under the character card. */
  private renderHud(): void {
    this.hudBox.replaceChildren();
    const isMe = this.isMe;
    for (const m of this.party?.members ?? []) {
      if (isMe(m)) continue;
      const row = el('div', `party-member${m.online ? '' : ' offline'}`);
      row.append(nameLine(m), bars(m));
      this.hudBox.append(row);
    }
  }

  /** The party window's layout; the member rows are filled in by renderList. */
  private render(): void {
    const b = this.body;
    b.replaceChildren();
    this.listBox = null;
    if (this.g.backend.guest) {
      b.append(el('div', 'hint', 'Guest ใช้ระบบปาร์ตี้ไม่ได้ — สมัครสมาชิกเพื่อใช้งาน'));
      return;
    }
    const party = this.party;
    if (!party) {
      b.append(el('div', 'party-empty', 'คุณยังไม่มีปาร์ตี้'));
      const create = el('button', 'primary', 'สร้างปาร์ตี้');
      create.onclick = () => this.g.backend.partyCreate();
      b.append(create);
    } else {
      this.listBox = el('div', 'party-list');
      b.append(this.listBox);
      if (this.canInvite && party.members.length > 1) b.append(el('div', 'hint', 'คลิกขวาที่สมาชิกเพื่อจัดการ'));
    }
    if (this.canInvite) {
      const inv = el('button', '', this.searchOpen ? 'ปิดการค้นหา' : 'ชวน');
      inv.onclick = () => {
        this.searchOpen = !this.searchOpen;
        this.update();
      };
      b.append(inv);
      if (this.searchOpen) b.append(this.searchBox());
    }
    if (party) {
      const leave = el('button', 'party-leave', 'ออกจากปาร์ตี้');
      leave.onclick = () => this.g.hud.confirm('ออกจากปาร์ตี้?', 'ออกจากปาร์ตี้', () => this.g.backend.partyLeave());
      b.append(leave);
    }
  }

  private renderList(): void {
    const list = this.listBox;
    const party = this.party;
    if (!list || !party) return;
    list.replaceChildren();
    const isMe = this.isMe;
    const leader = this.canInvite;
    for (const m of party.members) {
      const row = el('div', `party-member${m.online ? '' : ' offline'}${isMe(m) ? ' me' : ''}`);
      row.append(nameLine(m), bars(m));
      // Right click: the manage menu (only kick so far), for the leader on someone else.
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!leader || isMe(m)) return;
        this.showMenu(e.clientX, e.clientY, [[`เตะ ${m.name} ออกจากปาร์ตี้`, () => this.g.backend.partyKick(m.charId)]]);
      });
      list.append(row);
    }
  }

  /** Search box and results: online, non-guest characters whose name holds the text. */
  private searchBox(): HTMLElement {
    const box = el('div', 'party-search');
    const input = el('input');
    input.maxLength = PARTY_SEARCH_MAX;
    input.placeholder = 'ค้นหาชื่อผู้เล่นที่ออนไลน์';
    input.value = this.searchInput?.value ?? '';
    // Keys typed here are for the box, not the game (WASD, I, M…).
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') input.blur();
    });
    input.addEventListener('input', () => this.searchSoon());
    const results = el('div', 'party-results');
    box.append(input, results);
    this.searchInput = input;
    this.results = results;
    this.searchSoon(0);
    setTimeout(() => input.focus(), 0);
    return box;
  }

  private searchSoon(delay = SEARCH_DELAY_MS): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.search(), delay);
  }

  private async search(): Promise<void> {
    const input = this.searchInput;
    const out = this.results;
    if (!input || !out) return;
    const list = await this.g.backend.partySearch(input.value);
    if (out !== this.results) return; // The window was redrawn meanwhile.
    out.replaceChildren();
    if (!list.length) out.append(el('div', 'hint', 'ไม่พบผู้เล่นที่ออนไลน์'));
    for (const f of list) {
      const row = el('div', 'party-found');
      row.append(el('span', '', `${f.name} Lv.${f.lv} ${CLASSES[f.cls]?.name ?? ''}`));
      const btn = el('button', '', f.inParty ? 'มีปาร์ตี้แล้ว' : 'ชวน');
      btn.disabled = f.inParty;
      btn.onclick = () => this.g.backend.partyInvite(f.name);
      row.append(btn);
      out.append(row);
    }
  }

  // ------------------------------------------------------------ menus and popups

  /** Clicked another player in the world: offer an invite. */
  playerMenu(p: Player, x: number, y: number): void {
    if (this.memberOf(p)) return;
    this.showMenu(x, y, [[`ชวน ${p.name} เข้าปาร์ตี้`, () => this.g.backend.partyInvite(p.name)]]);
  }

  private showMenu(x: number, y: number, items: [string, () => void][]): void {
    this.menu.replaceChildren();
    for (const [label, act] of items) {
      const b = el('button', '', label);
      b.onclick = () => {
        this.closeMenu();
        act();
      };
      this.menu.append(b);
    }
    this.menu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
    this.menu.style.top = `${Math.min(y, window.innerHeight - 40 * items.length)}px`;
    this.menu.classList.remove('hidden');
  }

  closeMenu(): void {
    this.menu.classList.add('hidden');
  }

  get menuOpen(): boolean {
    return !this.menu.classList.contains('hidden');
  }

  /** Someone invites you: a popup with accept / decline, counting down. */
  invited(party: number, from: string, seconds: number): void {
    this.removeInvite(party);
    const box = el('div', 'party-invite');
    const text = el('div');
    text.append(el('b', '', from), document.createTextNode(' ชวนคุณเข้าปาร์ตี้'));
    const count = el('span', 'party-count');
    const yes = el('button', 'primary', 'ยอมรับ');
    const no = el('button', '', 'ปฏิเสธ');
    yes.onclick = () => {
      this.g.backend.partyAnswer(party, true);
      this.removeInvite(party);
    };
    no.onclick = () => {
      this.g.backend.partyAnswer(party, false);
      this.removeInvite(party);
    };
    const btns = el('div', 'party-invite-btns');
    btns.append(yes, no, count);
    box.append(text, btns);
    this.invitesBox.append(box);
    this.invites.set(party, { el: box, until: performance.now() + seconds * 1000, count });
    this.update();
  }

  removeInvite(party: number): void {
    this.invites.get(party)?.el.remove();
    this.invites.delete(party);
  }
}
