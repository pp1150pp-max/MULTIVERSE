import { debuffIconsHtml, debuffsOn } from './debuffFx';
import type { Game, Npc } from './Game';
import type { Monster } from '../shared/sim/Monster';
import type { Loot } from '../shared/sim/Loot';
import type { Player } from '../shared/sim/Player';
import { RARITY_COLOR } from '../shared/types';
import { itemName } from '../shared/data/enhance';
import { expGapMult } from '../shared/formulas';
import { iconImg, skillIcon } from './icons';
import { imgUrl, paperUiOn } from './img';
import { PAPER_TITLES } from './paperTitles';
import { questRows, seekerMark } from '../shared/quests';
import { currentBalance } from '../shared/balance';
import { gearRows } from '../shared/gearQuests';
import { floorOf } from '../shared/data/zones';
import { navState } from '../shared/floorGate';
import { tutMark, tutRows } from '../shared/tutorial';
import type { RestSpot } from '../shared/sim/terrain';
import type { CosmeticDef } from '../shared/data/cosmetics';
import { shownCos } from './cosLook';
import { isTouchMode } from './touch/device';
import { rideScale, seatOf } from './cosmeticViews';

interface Num {
  el: HTMLDivElement; x: number; y: number; z: number; t: number; life: number; height: number; dx: number; dy: number; pop: number;
  /** Seconds since the pop last restarted (a merged hit pops it again). */
  popT: number;
  /** Merge key (target id + kind) and the number shown so far; key '' = never merges. */
  key: string;
  value: number;
}
/** Cached last-written values (w = fill width, f = class flags), so unchanged plates touch no styles. */
interface Plate { el: HTMLDivElement; fill: HTMLDivElement; title?: HTMLDivElement; name?: HTMLDivElement; cos?: string; debuffs?: HTMLDivElement; mask?: number; w?: string; f?: number }

/** DOM overlay for damage numbers, monster nameplates and loot labels. */
/** Which row of the number sheet each kind of number uses. */
const GLYPH_ROW: Record<string, number> = { dmg: 0, crit: 1, hurt: 2, heal: 3, shield: 2 };
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
  /** Hidden number elements to reuse (creating and removing a div per hit costs more). */
  private freeNums: HTMLDivElement[] = [];
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
  private vitals: { el: HTMLDivElement; hp: HTMLDivElement; mp: HTMLDivElement; buffs: HTMLDivElement; buffSig: string };

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
    // Skill buffs on us, under the bars: the skill's icon, darkened clockwise like a clock as its time runs out.
    const buffs = document.createElement('div');
    buffs.className = 'vbuffs';
    this.vitals = { el: vitals, hp: bar('hp'), mp: bar('mp'), buffs, buffSig: '' };
    vitals.append(buffs);
    root.append(vitals);
    // Fetched up front, so the first hit doesn't show an empty number.
    for (const src of [GLYPH_SHEET, CRIT_BURST]) new Image().src = src;
  }

  /**
   * A floating number or text. `on` = the unit it's over: with merging on (/admin effects card), a damage number on
   * the same unit and of the same kind (crit with crit) within the merge window adds to the one already showing.
   */
  text(x: number, y: number, z: number, text: string, cls: string, life = 0.9, on?: number): void {
    const fx = currentBalance().fxLayer;
    const row = GLYPH_ROW[cls];
    const drawn = row !== undefined && NUMBER.test(text);
    const key = drawn && on !== undefined && fx.mergeNums && fx.mergeSec > 0 ? `${on}:${cls}` : '';
    if (key) {
      for (let i = this.nums.length - 1; i >= 0; i--) {
        const n = this.nums[i];
        if (n.key !== key || n.t >= fx.mergeSec) continue;
        n.value += Math.abs(parseInt(text, 10));
        n.el.innerHTML = glyphs(numText(n.value, text), row, cls === 'crit');
        n.popT = 0;
        return;
      }
    }
    const el = this.freeNums.pop() ?? document.createElement('div');
    el.className = `fnum ${cls}`;
    el.style.display = '';
    el.style.opacity = '';
    if (drawn) el.innerHTML = glyphs(text, row, cls === 'crit');
    else el.textContent = text;
    // Crit numbers' size, set on /admin with the skill effects' layer (owner 2026-11-15).
    el.style.scale = cls === 'crit' && fx.crit !== 1 ? String(fx.crit) : '';
    if (!el.isConnected) this.root.append(el);
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
      el, x, y, z, t: 0, life, popT: 0, key, value: drawn ? Math.abs(parseInt(text, 10)) : 0,
      height: !drawn ? 0 : cls === 'crit' ? 38 : 26,
      dx: drawn ? side * (8 + Math.random() * 14) : 0,
      dy: drawn ? Math.min(below, MAX_STACK) : cls === 'exp' ? -30 : 0,
      pop: !drawn ? 0 : cls === 'crit' ? 0.8 : 0.3,
    });
    // Past the cap (/admin, owner 2026-11-17) the oldest go.
    const max = Math.max(1, Math.round(fx.maxNums));
    while (this.nums.length > max) this.freeNum(this.nums.shift()!);
  }

  /** Hides a number and keeps its element for the next one (a few spare at most). */
  private freeNum(n: Num): void {
    if (this.freeNums.length < 40) {
      n.el.style.display = 'none';
      this.freeNums.push(n.el);
    } else n.el.remove();
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

  /**
   * Our skill buffs under our HP and MP bars (owner 2026-11-19): each skill's own icon, darkening clockwise from 12
   * o'clock like a clock as its time runs out. The server sends seconds left; we count down between snapshots.
   */
  private drawMyBuffs(me: Player): void {
    const v = this.vitals;
    v.buffSig = paintBuffRow(v.buffs, currentBalance().fxLayer.buffIcons ? me.shownBuffs : [], v.buffSig, me.shownBuffsAt);
  }

  /** The same buff icons over the skill bar (owner 2026-11-19), shown while we are alive, wherever the camera is. */
  private drawBarBuffs(me: Player): void {
    this.barBuffs ??= document.getElementById('bar-buffs') as HTMLDivElement | null;
    if (!this.barBuffs) return;
    const on = me.alive && currentBalance().fxLayer.barBuffIcons;
    this.barBuffSig = paintBuffRow(this.barBuffs, on ? me.shownBuffs : [], this.barBuffSig, me.shownBuffsAt);
  }
  private barBuffs: HTMLDivElement | null = null;
  private barBuffSig = '';

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
    // The fountain's sits on its basin, over the water (owner 2026-11-19), not up by the statue.
    return kind === 'fountain' ? 2.2 : 1.9;
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
      const floor = floorOf(g.backend.zone);
      const mark = n.id === 'seeker' ? seekerMark([...questRows(g.player), ...gearRows(g.player)].filter((r) => floorOf(r.map) === floor))
        : n.id === 'navigator' ? (navState(g.player, currentBalance()) === 'offer' ? '!' : '') : tutMark(tutRows(g.player.tut, g.player.name), n.id);
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
      n.popT += dt;
      if (n.t >= n.life) {
        this.freeNum(n);
        this.nums.splice(i, 1);
        continue;
      }
      const s = g.toScreen(n.x, n.y, n.z);
      const k = n.t / n.life;
      // Jumps up fast then hangs in the air; a hit starts oversized and snaps down to size.
      const rise = 46 * (1 - (1 - k) * (1 - k));
      const pop = 1 + n.pop * Math.max(0, 1 - n.popT / POP_TIME);
      n.el.style.transform = `translate(${(s.sx + n.dx * k).toFixed(1)}px, ${(s.sy - n.dy - rise).toFixed(1)}px) translate(-50%, -50%) scale(${pop.toFixed(3)})`;
      const fade = k > 0.6 ? (1 - (k - 0.6) / 0.4).toFixed(2) : '';
      if (n.el.style.opacity !== fade) n.el.style.opacity = fade;
    }

    const seen = new Set<Monster>();
    for (const m of g.monsters) {
      // A debuffed monster shows its plate too, for the debuff icons (owner 2026-11-15).
      const shownDebuffs = debuffsOn() ? m.debuffs : 0;
      if (!m.alive || !(m === g.hovered || m.hp < m.maxHp || m.isBoss || shownDebuffs)) continue;
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
        const debuffs = document.createElement('div');
        debuffs.className = 'pdebuffs';
        el.append(debuffs, name, bar);
        this.root.append(el);
        pl = { el, fill, debuffs, mask: 0 };
        this.plates.set(m, pl);
      }
      pl.el.style.transform = `translate(${s.sx.toFixed(1)}px, ${s.sy.toFixed(1)}px) translate(-50%, -100%)`;
      setWidth(pl, (Math.max(0, m.hp) / m.maxHp) * 100);
      if (pl.debuffs && pl.mask !== shownDebuffs) {
        pl.mask = shownDebuffs;
        pl.debuffs.innerHTML = debuffIconsHtml(shownDebuffs);
      }
      // Grey name = too weak to give full EXP.
      const trivial = m.level < g.player.level && expGapMult(g.player.level, m.level) < 1;
      const flags = (m.isHostile ? 1 : 0) | (trivial ? 2 : 0);
      if (pl.f !== flags) {
        pl.f = flags;
        pl.el.classList.toggle('hostile', m.isHostile);
        pl.el.classList.toggle('trivial', trivial);
      }
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
      this.drawMyBuffs(me);
    }
    this.drawBarBuffs(me);

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
      const party = g.party.memberOf(p) ? 1 : 0;
      if (pl.f !== party) {
        pl.f = party;
        pl.el.classList.toggle('party', !!party);
      }
      pl.el.style.transform = `translate(${s.sx.toFixed(1)}px, ${s.sy.toFixed(1)}px) translate(-50%, -100%)`;
      setWidth(pl, (Math.max(0, p.hp) / Math.max(1, p.maxHp)) * 100);
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
  paintPaperFrame(el, set);
}

/**
 * Screen pixels per file pixel of the paper frames: the name frame's body is about 24 px tall, the bubble's 36 px at least,
 * × fxLayer.paperPlate / paperBubble (/admin → ปรับสมดุล → เอฟเฟกต์สกิล).
 */
const PAPER_FRAME_SCALE = { plate: 1 / 3, bubble: 0.3 };

/**
 * With the paper UI on, a title set's paper frame (tools/cut_paper_extras.cjs): the frame as a border-image that
 * repeats its plain middle, and its top and bottom middles (crown, bubble tail) drawn over it (style.css .paper-title).
 */
function paintPaperFrame(el: HTMLElement, set: CosmeticDef | undefined): void {
  const kind = el.classList.contains('chat-bubble') ? 'bubble' : 'plate';
  const f = set && paperUiOn() ? PAPER_TITLES[set.id]?.[kind] : undefined;
  el.classList.toggle('paper-title', !!f);
  const st = el.style;
  if (!f || !set) {
    for (const k of ['border-image-source', 'border-image-slice', 'border-image-width', 'border-image-outset', 'min-width', 'min-height', '--pt', '--pb', '--mw', '--mth', '--mbh', '--ot', '--ob']) st.removeProperty(k);
    return;
  }
  const fl = currentBalance().fxLayer;
  const s = PAPER_FRAME_SCALE[kind] * (kind === 'plate' ? fl.paperPlate : fl.paperBubble);
  const px = (v: number): string => `${(v * s).toFixed(1)}px`;
  // Absolute: a relative url() in a custom property would resolve against the stylesheet.
  const url = (suffix: string): string => `url("${new URL(imgUrl(`assets/sprites/paper/ui/${set.id}_${kind}${suffix}.png`), location.href).href}")`;
  const [sl, ou, mid] = [f.slice, f.outset, f.mid];
  st.setProperty('border-image-source', url(''));
  st.setProperty('border-image-slice', `${sl.join(' ')} fill`);
  st.setProperty('border-image-width', sl.map(px).join(' '));
  st.setProperty('border-image-outset', ou.map(px).join(' '));
  // Never smaller than its corners and middle piece, or the browser shrinks the whole frame to fit.
  st.setProperty('min-width', px(sl[1] + sl[3] - ou[1] - ou[3] + mid[0]));
  st.setProperty('min-height', px(sl[0] + sl[2] - ou[0] - ou[2]));
  st.setProperty('--pt', url('_t'));
  st.setProperty('--pb', url('_b'));
  st.setProperty('--mw', px(mid[0]));
  st.setProperty('--mth', px(mid[1]));
  st.setProperty('--mbh', px(mid[2]));
  st.setProperty('--ot', px(ou[0]));
  st.setProperty('--ob', px(ou[2]));
}

/** A plate's HP fill width in %, written only when it changes (a tenth of a percent is the finest shown). */
function setWidth(pl: Plate, pct: number): void {
  const w = `${pct.toFixed(1)}%`;
  if (pl.w === w) return;
  pl.w = w;
  pl.fill.style.width = w;
}

/** A merged damage total written like the hit it came from: "-123" for hurt, "123!" for a crit. */
function numText(value: number, like: string): string {
  return `${like.startsWith('-') ? '-' : like.startsWith('+') ? '+' : ''}${value}${like.endsWith('!') ? '!' : ''}`;
}

/** World height just over a character's head, where its nameplate and chat bubble go (higher on a mount). */
function headY(p: Player): number {
  return p.topY * rideScale(p) + 0.35 + seatOf(p);
}

/**
 * Paints a row of skill-buff icons (each darkening clockwise like a clock as its time runs out) and returns the row's
 * new signature. `at` = when the seconds in `list` came from the server; we count down from then.
 */
function paintBuffRow(row: HTMLElement, list: readonly { id: string; left: number; total: number }[], sig: string, at: number): string {
  const next = list.map((b) => b.id).join(',');
  if (next !== sig) row.innerHTML = list.map((b) => `<div class="vbuff">${skillIcon(b.id)}<i></i></div>`).join('');
  if (!list.length) return next;
  const gone = performance.now() / 1000 - at;
  list.forEach((b, i) => {
    const left = Math.max(0, b.left - gone);
    const done = b.total > 0 ? 1 - left / b.total : 1;
    (row.children[i] as HTMLElement | undefined)?.style.setProperty('--gone', `${Math.min(360, Math.max(0, done * 360)).toFixed(1)}deg`);
  });
  return next;
}
