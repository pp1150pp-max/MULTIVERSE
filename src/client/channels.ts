// Channels on screen: the "ป่ามรกต · CH 2" label under the minimap (only on maps with channels), and the
// channel window it opens: every channel of this map with how many players are in it, and a button to
// move. The server decides everything (server/channels.ts); this only shows its answers and asks.
// Also the "ไปห้องเดียวกัน" helper that the friends list and the party frames use.
import type { Game } from './Game';
import { ZONES } from '../shared/data/zones';
import { CH_PARTY_CAP, CH_SOLO_CAP, CH_SWITCH_CALM, hasChannels, placeLabel, type ChannelsView } from '../shared/channels';

/** While the window is open, ask for a fresh list this often (ms). */
const REFRESH_MS = 2000;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * "ป่ามรกต · CH 2" for someone in that zone and channel (just the name on a map without channels);
 * boss rooms and maps this browser doesn't know get a plain label.
 */
export function placeText(zoneId: string, ch: number | undefined): string {
  const z = ZONES[zoneId];
  if (!z) return zoneId ? 'พื้นที่พิเศษ' : 'ไม่ทราบ';
  return placeLabel(z, ch ?? 1);
}

/** Whether someone at this zone / channel is on your map (one with channels) but in another channel. */
export function otherChannelHere(g: Game, zoneId: string, ch: number | undefined): boolean {
  return zoneId === g.backend.zone.id && hasChannels(g.backend.zone) && (ch ?? 1) !== g.backend.channel;
}

/** The "ไปห้องเดียวกัน" button: go to the channel `name` (a friend or party member) is in. */
export function joinButton(g: Game, name: string): HTMLButtonElement {
  const b = el('button', 'ch-join', 'ไปห้องเดียวกัน');
  b.title = `ย้ายไปแชนแนลเดียวกับ ${name} (ต้องไม่อยู่ในการต่อสู้ ${CH_SWITCH_CALM} วินาที)`;
  // On press, not click: the party frames redraw whenever a member's HP changes, which could swallow a click.
  b.onpointerdown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    g.backend.chJoin(name);
  };
  return b;
}

export class ChannelUI {
  private readonly label: HTMLButtonElement;
  private readonly win: HTMLElement;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private view: ChannelsView | null = null;
  private askedAt = -Infinity;
  /** What the label and the window last showed, so they only redraw on a change. */
  private drawnLabel = '';
  private drawnWin = '';

  constructor(private readonly g: Game) {
    this.label = el('button', 'hidden');
    this.label.id = 'hud-ch';
    this.label.title = 'เปิดหน้าต่างแชนแนล';
    this.label.onclick = () => this.toggle();
    $('hud-ping').after(this.label);

    this.win = el('div', 'panel hidden');
    this.win.id = 'channels-win';
    const head = el('div', 'panel-head');
    this.title = el('span', '', 'แชนแนล');
    const close = el('button', '', '✕');
    close.onclick = () => this.toggle(false);
    head.append(this.title, close);
    this.body = el('div', 'ch-body');
    this.win.append(head, this.body);
    $('hud').append(this.win);
    g.backend.onChannels = (view) => {
      this.view = view;
      this.drawnWin = '';
    };
  }

  get open(): boolean {
    return !this.win.classList.contains('hidden');
  }

  toggle(force?: boolean): void {
    const show = (force ?? !this.open) && hasChannels(this.g.backend.zone);
    this.win.classList.toggle('hidden', !show);
    if (show) this.ask();
  }

  private ask(): void {
    this.askedAt = performance.now();
    this.g.backend.chList();
  }

  /** Called every frame. */
  update(): void {
    const b = this.g.backend;
    const on = hasChannels(b.zone);
    const text = on ? placeLabel(b.zone, b.channel) : '';
    if (text !== this.drawnLabel) {
      this.drawnLabel = text;
      this.label.textContent = text;
      this.label.classList.toggle('hidden', !on);
      // Moved to another map or channel: the list is out of date.
      this.view = null;
      this.drawnWin = '';
      if (!on) this.toggle(false);
      else if (this.open) this.ask();
    }
    if (!this.open) return;
    if (performance.now() - this.askedAt > REFRESH_MS) this.ask();
    const key = JSON.stringify([this.view, b.channel, this.leaderCh()]);
    if (key !== this.drawnWin) {
      this.drawnWin = key;
      this.render();
    }
  }

  /** Your party leader's channel when the leader is on this map (you may follow them up to CH_PARTY_CAP). */
  private leaderCh(): number | null {
    const b = this.g.backend;
    const lead = b.party?.members.find((m) => m.leader);
    if (!lead?.online || lead.zone !== b.zone.id) return null;
    const me = b.party?.members.find((m) => m.pid === b.me.id && m.zone === b.zone.id && m.ch === b.channel);
    return me && !me.leader ? lead.ch : null;
  }

  private render(): void {
    const b = this.g.backend;
    this.title.textContent = `แชนแนล — ${b.zone.nameTh}`;
    const v = this.view;
    this.body.replaceChildren();
    if (!v || v.zone !== b.zone.id) {
      this.body.append(el('div', 'hint', 'กำลังโหลด…'));
      return;
    }
    if (v.wait > 0) this.body.append(el('div', 'hint ch-wait', `ยังอยู่ในการต่อสู้ — ย้ายแชนแนลได้อีกใน ${v.wait} วินาที`));
    const lead = this.leaderCh();
    const list = el('div', 'ch-list');
    for (const c of v.list) {
      const here = c.ch === b.channel;
      const cap = c.ch === lead ? CH_PARTY_CAP : CH_SOLO_CAP;
      const full = c.n >= cap;
      const row = el('div', `ch-row${here ? ' here' : ''}`);
      const name = el('b', '', `CH ${c.ch}`);
      const n = el('span', 'ch-n', `${c.n} คน${c.n >= CH_SOLO_CAP ? ' · เต็ม' : ''}${c.ch === lead ? ' · หัวตี้อยู่ที่นี่' : ''}`);
      const go = el('button', '', here ? 'อยู่ที่นี่' : 'ย้าย');
      go.disabled = here || full || v.wait > 0;
      go.onclick = () => b.chSwitch(c.ch);
      row.append(name, n, go);
      list.append(row);
    }
    this.body.append(list);
    this.body.append(el('div', 'hint', `แชนแนลละ ${CH_SOLO_CAP} คน (ลูกตี้ตามหัวตี้ได้ถึง ${CH_PARTY_CAP}) · ต้องไม่อยู่ในการต่อสู้ ${CH_SWITCH_CALM} วินาทีถึงจะย้ายได้`));
  }
}
