import type { Game } from './Game';
import type { Monster } from '../shared/sim/Monster';
import type { Loot } from '../shared/sim/Loot';
import { RARITY_COLOR } from '../shared/types';
import { itemName } from '../shared/data/enhance';
import { expGapMult } from '../shared/formulas';

interface Num { el: HTMLDivElement; x: number; y: number; z: number; t: number; life: number; dx: number }
interface Plate { el: HTMLDivElement; fill: HTMLDivElement }

/** DOM overlay for damage numbers, monster nameplates and loot labels. */
export class Floating {
  private nums: Num[] = [];
  private plates = new Map<Monster, Plate>();
  private labels = new Map<Loot, HTMLDivElement>();
  private prompt: HTMLDivElement;

  constructor(private readonly root: HTMLElement) {
    this.prompt = document.createElement('div');
    this.prompt.className = 'npc-prompt hidden';
    root.append(this.prompt);
  }

  text(x: number, y: number, z: number, text: string, cls: string, life = 0.9): void {
    const el = document.createElement('div');
    el.className = `fnum ${cls}`;
    el.textContent = text;
    this.root.append(el);
    this.nums.push({ el, x, y, z, t: 0, life, dx: (Math.random() - 0.5) * 24 });
  }

  /** Small label above an NPC, or hidden when text is null. */
  npcPrompt(g: Game, x: number, y: number, z: number, text: string | null): void {
    if (!text) {
      this.prompt.classList.add('hidden');
      return;
    }
    const s = g.toScreen(x, y, z);
    this.prompt.textContent = text;
    this.prompt.classList.remove('hidden');
    this.prompt.style.transform = `translate(${s.sx}px, ${s.sy}px) translate(-50%, -100%)`;
  }

  update(dt: number, g: Game): void {
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      const s = g.toScreen(n.x, n.y, n.z);
      const k = n.t / n.life;
      n.el.style.transform = `translate(${s.sx + n.dx * k}px, ${s.sy - 50 * k}px) translate(-50%, -50%)`;
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
      pl.el.classList.toggle('trivial', expGapMult(g.player.level, m.level) < 1);
    }
    for (const [m, pl] of this.plates) {
      if (!seen.has(m)) {
        pl.el.remove();
        this.plates.delete(m);
      }
    }

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
        el.textContent = itemName(l.kind.item);
        el.style.color = RARITY_COLOR[l.kind.item.rarity];
        this.root.append(el);
        this.labels.set(l, el);
      }
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
