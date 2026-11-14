import type { Game, Npc } from './Game';
import type { Monster } from '../shared/sim/Monster';
import type { Loot } from '../shared/sim/Loot';
import type { Player } from '../shared/sim/Player';
import { RARITY_COLOR } from '../shared/types';
import { itemName } from '../shared/data/enhance';
import { expGapMult } from '../shared/formulas';
import { iconImg } from './icons';
import { imgUrl } from './img';
import { questRows, seekerMark } from '../shared/quests';
import { gearRows } from '../shared/gearQuests';
import { tutMark, tutRows } from '../shared/tutorial';
import type { RestSpot } from '../shared/sim/terrain';
import type { CosmeticDef } from '../shared/data/cosmetics';
import { shownCos } from './cosLook';
import { isTouchMode } from './touch/device';
import { seatOf } from './cosmeticViews';

interface Num { el: HTMLDivElement; x: number; y: number; z: number; t: number; life: number; height: number; dx: number; dy: number; pop: number }
interface Plate { el: HTMLDivElement; fill: HTMLDivElement; title?: HTMLDivElement; name?: HTMLDivElement; cos?: string }

/** DOM overlay for damage numbers, monster nameplates and loot labels. */
/** Which row of the number sheet each kind of number uses. */
const GLYPH_ROW: Record<string, number> = { dmg: 0, crit: 1, hurt: 2, heal: 3 };
const NUMBER = /^[-+]?\d+!?$/;
export const GLYPH_SHEET = imgUrl('assets/sprites/icons/digits.png');
export const CRIT_BURST = imgUrl('assets/sprites/icons/crit_burst.png');
const GLYPH_ORDER = '0123456789+-!';
/** Width of each cell in the sheet, and of each character in it, as a share of its height. */
const GLYPH_CELL = 58 / 64;
const GLYPH_WIDTH: Record<string, number> = {
  0: 0.734, 1: 0.609, 2: 0.734, 3: 0.703, 4: 0.781, 5: 0.734, 6: 0.734, 7: 0.719, 8: 0.75, 9: 0.703, '+': 0.672, '-': 0.594, '!': 0.375,
};
/** Hits this close together in time are treated as one burst and spread out. */
const STACK_TIME = 0.35;
const POP_TIME = 0.14;
const MAX_NUMS = 120;
/** Highest a stack of numbers climbs, in pixels. */
const MAX_STACK = 110;
/** How long a chat bubble stays over a head. */
const BUBBLE_MS = 5000;

/** A number as pieces of the sheet, sized in em so the font size scales it. */
function glyphs(text: string, row: number, burst: boolean): string {
  const size = `${GLYPH_ORDER.length * GLYPH_CELL}em 4em`;
  const parts = [...text].map((ch) => {
    const w = GLYPH_WIDTH[ch];
    const x = GLYPH_ORDER.indexOf(ch) * GLYPH_CELL + (GLYPH_CELL - w) / 2;
    return `<span class="dg" style="width:${w}em;background:url(${GLYPH_SHEET}) -${x}em -${row}em / ${size} no-repeat"></span>`;
  });
  return (burst ? `<span class="dburst" style="background-image:url(${CRIT_BURST})"></span>` : '') + parts.join('');
}

/** Seconds as m:ss, rounded up so it never shows 0:00 before the boss is back. */
export function countdown(seconds: number): string {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class Floating {
  private nums: Num[] = [];
  private plates = new Map<Monster, Plate>();
  private labels = new Map<Loot, HTMLDivElement>();
  private names = new Map<Player, Plate>();
  private bubbles = new Map<string, { el: HTMLDivElement; until: number; cos?: string }>();
  /** The title set over your own head (you have no nameplate). */
  private myTitle: Plate | null = null;
  private prompt: HTMLDivElement;
  private bossTimerEl: HTMLDivElement;
  private badges = new Map<Npc, HTMLDivElement>();
  private readonly restEls: HTMLDivElement[] = [];
  private vitals: { el: HTMLDivElement; hp: HTMLDivElement; mp: HTMLDivElement };

  constructor(private readonly root: HTMLElement) {
    this.prompt = document.createElement('div');
    this.prompt.className = 'npc-prompt hidden';
    root.append(this.prompt);
    this.bossTimerEl = document.createElement('div');
    this.bossTimerEl.className = 'boss-timer hidden';
    root.append(this.bossTimerEl);
    const vitals = document.createElement('div');
    vitals.className = 'vitals hidden';
    const bar = (cls: string): HTMLDivElement => {
      const track = document.createElement('div');
      track.className = `vbar ${cls}`;
      const fill = document.createElement('div');
      track.append(fill);
      vitals.append(track);
      return fill;
    };
    this.vitals = { el: vitals, hp: bar('hp'), mp: bar('mp') };
    root.append(vitals);
    // Fetched up front, so the first hit doesn't show an empty number.
    for (const src of [GLYPH_SHEET, CRIT_BURST]) new Image().src = src;
  }

  text(x: number, y: number, z: number, text: string, cls: string, life = 0.9): void {
    const el = document.createElement('div');
    el.className = `fnum ${cls}`;
    const row = GLYPH_ROW[cls];
    const drawn = row !== undefined && NUMBER.test(text);
    if (drawn) el.innerHTML = glyphs(text, row, cls === 'crit');
    else el.textContent = text;
    this.root.append(el);
    // Numbers landing on the same spot stack up and fan out, so a burst of hits stays readable.
    let below = 0;
    let count = 0;
    if (drawn) {
      for (const n of this.nums) {
        if (n.height && n.t < STACK_TIME && Math.abs(n.x - x) < 1 && Math.abs(n.z - z) < 1) {
          below += n.height;
          count++;
        }
      }
    }
    const side = count % 2 ? 1 : -1;
    this.nums.push({
      el, x, y, z, t: 0, life,
      height: !drawn ? 0 : cls === 'crit' ? 38 : 26,
      dx: drawn ? side * (8 + Math.random() * 14) : 0,
      dy: drawn ? Math.min(below, MAX_STACK) : cls === 'exp' ? -30 : 0,
      pop: !drawn ? 0 : cls === 'crit' ? 0.8 : 0.3,
    });
    if (this.nums.length > MAX_NUMS) this.nums.shift()!.el.remove();
  }

  /** A chat bubble over a character (matched by name); a new one from the same name replaces the old. Plain text only. */
  bubble(name: string, text: string, party: boolean): void {
    this.bubbles.get(name)?.el.remove();
    const el = document.createElement('div');
    el.className = `chat-bubble${party ? ' party' : ''}`;
    el.textContent = text;
    el.style.display = 'none';
    this.root.append(el);
    this.bubbles.set(name, { el, until: performance.now() + BUBBLE_MS });
  }

  /** Places the bubbles above the nameplates; drops the expired ones and those whose character isn't on screen. */
  private updateBubbles(g: Game): void {
    const now = performance.now();
    for (const [name, b] of this.bubbles) {
      if (now >= b.until) {
        b.el.remove();
        this.bubbles.delete(name);
        continue;
      }
      const p = g.player.name === name ? g.player : g.backend.players.find((o) => o.name === name);
      const s = p ? g.toScreen(p.x, headY(p), p.z) : null;
      if (!p || !s || !s.on) {
        b.el.style.display = 'none';
        continue;
      }
      b.el.style.display = '';
      const set = shownCos(p, 'title');
      if (b.cos !== set?.id) {
        b.cos = set?.id;
        paintCos(b.el, set);
      }
      // Above the nameplate (own character has no plate, so it sits a little lower).
      // Your own framed name plate (a title set worn) sits where other players' plates do.
      const extra = p === g.player && shownCos(p, 'title') ? 30 : 0;
      const lift = p === g.player ? 14 + extra : 32;
      b.el.style.transform = `translate(${s.sx}px, ${s.sy - lift}px) translate(-50%, -100%)`;
    }
  }

  /** Your own title set over your head (title and framed name), while you wear one or try one on. */
  private updateMyTitle(g: Game): void {
    const me = g.player;
    const set = me.alive ? shownCos(me, 'title') : undefined;
    if (!set) {
      this.myTitle?.el.classList.add('hidden');
      return;
    }
    if (!this.myTitle) {
      const el = document.createElement('div');
      el.className = 'plate ally self';
      const title = document.createElement('div');
      title.className = 'cos-title';
      const name = document.createElement('div');
      name.className = 'pname';
      el.append(title, name);
      this.root.append(el);
      this.myTitle = { el, fill: name, title };
    }
    const t = this.myTitle;
    if (t.cos !== set.id) {
      t.cos = set.id;
      paintTitle(t.title!, set);
      paintCos(t.fill, set);
    }
    if (t.fill.textContent !== me.name) t.fill.textContent = me.name;
    const s = g.toScreen(me.x, headY(me), me.z);
    t.el.classList.toggle('hidden', !s.on);
    // Lower than other players' plates: it sits where the chat bubble's own-character spot expects it.
    t.el.style.transform = `translate(${s.sx}px, ${s.sy + 4}px) translate(-50%, -100%)`;
  }

  /** Countdown over the boss's empty lair, or hidden when text is null. */
  bossTimer(g: Game, x: number, z: number, text: string | null): void {
    if (!text) {
      this.bossTimerEl.classList.add('hidden');
      return;
    }
    const s = g.toScreen(x, 1.5, z);
    if (this.bossTimerEl.textContent !== text) this.bossTimerEl.textContent = text;
    this.bossTimerEl.classList.remove('hidden');
    this.bossTimerEl.style.transform = `translate(${s.sx}px, ${s.sy}px) translate(-50%, -100%)`;
  }

  /** Small label above an NPC, or hidden when text is null. liftPx raises it further, in screen pixels. */
  npcPrompt(g: Game, x: number, y: number, z: number, text: string | null, liftPx = 0): void {
    if (!text) {
      this.prompt.classList.add('hidden');
      return;
    }
    const s = g.toScreen(x, y, z);
    this.prompt.textContent = text;
    this.prompt.classList.remove('hidden');
    this.prompt.style.transform = `translate(${s.sx}px, ${s.sy - liftPx}px) translate(-50%, -100%)`;
  }

  /** Height in pixels of the badge over this rest spot, so the press-T label can sit above it. */
  restBadgeHeight(i: number): number {
    return this.restEls[i]?.offsetHeight ?? 0;
  }

  /** World height the badge over a rest spot is pinned to: above the fountain's statue, or the campfire's flames. */
  static restBadgeY(kind: RestSpot['kind']): number {
    return kind === 'fountain' ? 4.4 : 1.9;
  }

  /** Badge over the fountain and each campfire: that resting there restores HP/MP, and when it can be used again. */
  restBadges(g: Game, spots: readonly RestSpot[], readyIn: number): void {
    while (this.restEls.length < spots.length) {
      const el = document.createElement('div');
      el.className = 'npc-badge rest-badge';
      el.innerHTML = '<div class="npc-bob"><div class="npc-role"></div><div class="npc-name"></div></div>';
      this.root.append(el);
      this.restEls.push(el);
    }
    while (this.restEls.length > spots.length) this.restEls.pop()!.remove();
    spots.forEach((r, i) => {
      const el = this.restEls[i];
      const role = r.kind === 'fountain' ? '💧 ฟื้นพลัง' : '🔥 พักฟื้น';
      const name = readyIn > 0 ? `พักได้อีก ${readyIn} วิ` : `HP/MP เต็ม · ${isTouchMode() ? 'แตะ' : 'กด T'}`;
      const roleEl = el.querySelector('.npc-role')!;
      const nameEl = el.querySelector('.npc-name')!;
      if (roleEl.textContent !== role) roleEl.textContent = role;
      if (nameEl.textContent !== name) nameEl.textContent = name;
      el.classList.toggle('waiting', readyIn > 0);
      const s = g.toScreen(r.x, Floating.restBadgeY(r.kind), r.z);
      el.classList.toggle('hidden', !s.on);
      el.style.transform = `translate(${s.sx}px, ${s.sy}px) translate(-50%, -100%)`;
    });
  }

  /** Always-on badge over each camp NPC: an icon and what it does, then its name. */
  npcBadges(g: Game, npcs: readonly Npc[]): void {
    const seen = new Set<Npc>();
    for (const n of npcs) {
      seen.add(n);
      let el = this.badges.get(n);
      if (!el) {
        el = document.createElement('div');
        el.className = `npc-badge npc-${n.id}`;
        const bob = document.createElement('div');
        bob.className = 'npc-bob';
        const role = document.createElement('div');
        role.className = 'npc-role';
        role.innerHTML = `${iconImg(n.icon)} ${n.role}`;
        const name = document.createElement('div');
        name.className = 'npc-name';
        name.textContent = n.name;
        bob.append(role, name);
        // ! (a quest to take) or ? (one to hand in) over a quest giver, bouncing on its own.
        const mark = document.createElement('div');
        mark.className = 'npc-mark hidden';
        el.append(mark, bob);
        this.root.append(el);
        this.badges.set(n, el);
      }
      const s = g.toScreen(n.x, 2.45, n.z);
      el.classList.toggle('hidden', !s.on);
      // Gold or items wait in your claim box at the market broker.
      el.classList.toggle('alert', n.id === 'broker' && g.backend.marketBox > 0);
      // The Seeker's quests, or a tutorial step at the NPC that runs that system (src/shared/tutorial.ts).
      const mark = n.id === 'seeker' ? seekerMark([...questRows(g.player), ...gearRows(g.player)]) : tutMark(tutRows(g.player.tut, g.player.name), n.id);
      const markEl = el.querySelector<HTMLElement>('.npc-mark');
      if (markEl) {
        if (markEl.textContent !== mark) markEl.textContent = mark;
        markEl.classList.toggle('hidden', !mark);
        markEl.classList.toggle('turn-in', mark === '?');
      }
      el.style.transform = `translate(${s.sx}px, ${s.sy}px) translate(-50%, -100%)`;
    }
    for (const [n, el] of this.badges) {
      if (!seen.has(n)) {
        el.remove();
        this.badges.delete(n);
      }
    }
  }

  update(dt: number, g: Game): void {
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      const s = g.toScreen(n.x, n.y, n.z);
      const k = n.t / n.life;
      // Jumps up fast then hangs in the air; a hit starts oversized and snaps down to size.
      const rise = 46 * (1 - (1 - k) * (1 - k));
      const pop = 1 + n.pop * Math.max(0, 1 - n.t / POP_TIME);
      n.el.style.transform = `translate(${s.sx + n.dx * k}px, ${s.sy - n.dy - rise}px) translate(-50%, -50%) scale(${pop})`;
      n.el.style.opacity = String(1 - Math.max(0, (k - 0.6) / 0.4));
      if (n.t >= n.life) {
        n.el.remove();
        this.nums.splice(i, 1);
      }
    }

    const seen = new Set<Monster>();
    for (const m of g.monsters) {
      if (!m.alive || !(m === g.hovered || m.hp < m.maxHp || m.isBoss)) continue;
      const s = g.toScreen(m.x, m.topY + 0.3, m.z);
      if (!s.on) continue;
      seen.add(m);
      let pl = this.plates.get(m);
      if (!pl) {
        const el = document.createElement('div');
        el.className = m.isBoss ? 'plate boss' : 'plate';
        const name = document.createElement('div');
        name.className = 'pname';
        name.textContent = `Lv.${m.level} ${m.def.name}`;
        const bar = document.createElement('div');
        bar.className = 'pbar';
        const fill = document.createElement('div');
        fill.className = 'pfill';
        bar.append(fill);
        el.append(name, bar);
        this.root.append(el);
        pl = { el, fill };
        this.plates.set(m, pl);
      }
      pl.el.style.transform = `translate(${s.sx}px, ${s.sy}px) translate(-50%, -100%)`;
      pl.fill.style.width = `${(Math.max(0, m.hp) / m.maxHp) * 100}%`;
      pl.el.classList.toggle('hostile', m.isHostile);
      // Grey name = too weak to give full EXP.
      pl.el.classList.toggle('trivial', m.level < g.player.level && expGapMult(g.player.level, m.level) < 1);
    }
    for (const [m, pl] of this.plates) {
      if (!seen.has(m)) {
        pl.el.remove();
        this.plates.delete(m);
      }
    }

    // Our own HP and MP, under the feet.
    const me = g.player;
    const feet = g.toScreen(me.x, 0, me.z);
    const showVitals = me.alive && feet.on;
    this.vitals.el.classList.toggle('hidden', !showVitals);
    if (showVitals) {
      this.vitals.el.style.transform = `translate(${feet.sx}px, ${feet.sy}px) translate(-50%, 6px)`;
      this.vitals.hp.style.width = `${(Math.max(0, me.hp) / Math.max(1, me.maxHp)) * 100}%`;
      this.vitals.mp.style.width = `${(Math.max(0, me.mp) / Math.max(1, me.stats.maxMp)) * 100}%`;
    }

    this.updateMyTitle(g);

    // Other players: name, level and HP above their heads.
    const seenP = new Set<Player>();
    for (const p of g.backend.players) {
      if (p === g.player) continue;
      const s = g.toScreen(p.x, headY(p), p.z);
      if (!s.on) continue;
      seenP.add(p);
      let pl = this.names.get(p);
      if (!pl) {
        const el = document.createElement('div');
        el.className = 'plate ally';
        const name = document.createElement('div');
        name.className = 'pname';
        const bar = document.createElement('div');
        bar.className = 'pbar';
        const fill = document.createElement('div');
        fill.className = 'pfill';
        bar.append(fill);
        const title = document.createElement('div');
        title.className = 'cos-title hidden';
        el.append(title, name, bar);
        this.root.append(el);
        pl = { el, fill, title, name };
        this.names.set(p, pl);
      }
      const set = shownCos(p, 'title');
      if (pl.cos !== set?.id) {
        pl.cos = set?.id;
        paintTitle(pl.title!, set);
        paintCos(pl.name!, set);
      }
      // The name row, not firstChild: the (usually hidden) title row comes first in the plate.
      const label = `Lv.${p.level} ${p.name}${p.alive ? '' : ' 💀'}`;
      if (pl.name!.textContent !== label) pl.name!.textContent = label;
      pl.el.classList.toggle('party', !!g.party.memberOf(p));
      pl.el.style.transform = `translate(${s.sx}px, ${s.sy}px) translate(-50%, -100%)`;
      pl.fill.style.width = `${(Math.max(0, p.hp) / Math.max(1, p.maxHp)) * 100}%`;
    }
    for (const [p, pl] of this.names) {
      if (!seenP.has(p)) {
        pl.el.remove();
        this.names.delete(p);
      }
    }

    this.updateBubbles(g);

    const seenLoot = new Set<Loot>();
    for (const l of g.loots) {
      if (l.dead || l.kind.type !== 'item') continue;
      const s = g.toScreen(l.x, 0.75, l.z);
      if (!s.on) continue;
      seenLoot.add(l);
      let el = this.labels.get(l);
      if (!el) {
        el = document.createElement('div');
        el.className = 'loot-label';
        el.style.color = RARITY_COLOR[l.kind.item.rarity];
        this.root.append(el);
        this.labels.set(l, el);
      }
      // 🔒 = another player did the most damage and still has first pick.
      const locked = !l.canTake(g.player, g.time);
      el.textContent = locked ? `🔒 ${itemName(l.kind.item)}` : itemName(l.kind.item);
      el.classList.toggle('locked', locked);
      el.style.transform = `translate(${s.sx}px, ${s.sy}px) translate(-50%, -100%)`;
    }
    for (const [l, el] of this.labels) {
      if (!seenLoot.has(l)) {
        el.remove();
        this.labels.delete(l);
      }
    }
  }
}

/**
 * The title text of a title set over a nameplate. Owner 2026-11-10: no titles for now (the set is a name frame
 * and a chat bubble), so it stays hidden; CosmeticDef.title keeps the texts for later.
 */
function paintTitle(el: HTMLElement, _set: CosmeticDef | undefined): void {
  el.textContent = '';
  el.classList.add('hidden');
}

/** A title set's colours on a name frame or a chat bubble (class `cos`), or back to the plain look. */
function paintCos(el: HTMLElement, set: CosmeticDef | undefined): void {
  el.classList.toggle('cos', !!set);
  el.style.setProperty('--c1', set?.color ?? '');
  el.style.setProperty('--c2', set?.color2 ?? '');
}

/** World height just over a character's head, where its nameplate and chat bubble go (higher on a mount). */
function headY(p: Player): number {
  return p.topY + 0.35 + seatOf(p);
}
