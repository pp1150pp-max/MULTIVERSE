// Picture picker for "what to spawn" on the admin page (owner 2026-11-25, card-system PR 1): replaces the "ชนิด" dropdown
// of the character sheet (เสกไอเทมใส่กระเป๋า) and of mail attachments. A button shows the picked thing; clicking it opens
// a window with 3 tabs (gear by slot · monster cards by floor and map · usable items) and a name search. The value
// is the same text the dropdown gave, so the requests don't change: a gear base id, "potion:hp:s" or "stone:<kind>"
// (cards are stones: "stone:card_<monster>").
import type { AdminMeta } from '../shared/admin';
import { POTION_SIZES, potionName } from '../shared/data/potions';
import { STONE_NAME } from '../shared/data/stones';
import { CARD_DEFAULTS, CARD_RARITY_NAME, cardArt, cardName } from '../shared/data/cards';
import { cardDef } from '../shared/cardTuning';
import { BLACKSMITH_STONES, BOSS_KEYS, RARITY_COLOR, REWARD_ITEMS, SLOT_LABEL, SLOTS, type ClassId, type StoneKind } from '../shared/types';
import { className, h } from './core';
import { baseIcon, entryIcon } from './items';

type Base = AdminMeta['bases'][number];
type Tab = 'gear' | 'card' | 'use';
const TAB_NAME: Record<Tab, string> = { gear: 'ของสวมใส่', card: 'การ์ด', use: 'ของใช้' };

/** Map names of each floor's 4 farm maps (CardDef.map), for the card headings. */
const MAP_NAME: Record<1 | 2, string[]> = {
  1: ['ป่ามรกต', 'หนองน้ำหมอก', 'ดินแดนหิมะ', 'เกาะภูเขาไฟ'],
  2: ['หาดเรือแตก', 'อ่าวลักลอบ', 'สุสานเรือผี', 'วังวนกลางทะเล'],
};

/** One pickable thing. */
interface Choice {
  value: string;
  name: string;
  /** Small text under the name (Lv / rarity). */
  sub?: string;
  subColor?: string;
  icon: () => HTMLElement;
  /** Card tiles are portrait. */
  card?: boolean;
}
interface Section { title: string; items: Choice[] }

export interface ItemPickerOpts {
  bases: Base[];
  /**
   * The class whose gear is offered (character sheet: the "ของอาชีพ" select). Omitted = every class's gear, named per
   * class (mail: gear is made for whoever claims it).
   */
  cls?: () => ClassId;
  /** Called after the user picks something. */
  onChange?: () => void;
}

export class ItemPicker {
  /** The button that shows the pick and opens the window. */
  readonly el: HTMLButtonElement;
  private v = '';
  private tab: Tab = 'gear';
  private query = '';

  constructor(private readonly o: ItemPickerOpts) {
    this.el = h('button', { type: 'button', class: 'ipick-btn', onclick: () => this.open() });
    this.v = this.all()[0]?.value ?? '';
    this.draw();
  }

  get value(): string {
    return this.v;
  }
  set value(v: string) {
    if (!this.has(v)) return;
    this.v = v;
    this.draw();
  }

  /** Whether `v` is something the picker offers now (gear of the current class, a card, a usable item). */
  has(v: string): boolean {
    return this.all().some((c) => c.value === v);
  }

  /** After the class changed: keeps the pick if that class still has it, else the first gear piece. */
  refresh(): void {
    if (!this.has(this.v)) this.v = this.all()[0]?.value ?? '';
    this.draw();
  }

  // ---------------------------------------------------------- choices

  private gearName(b: Base): string {
    const cls = this.o.cls?.();
    if (cls) return b.names[cls] ?? b.names.any ?? b.id;
    return b.names.any ?? Object.entries(b.names).map(([k, n]) => `${n} [${className(k as ClassId)}]`).join(' / ');
  }

  private sections(tab: Tab): Section[] {
    const cls = this.o.cls?.() ?? null;
    if (tab === 'gear') {
      return SLOTS.map((slot) => ({
        title: SLOT_LABEL[slot],
        // Off-hands exist per class: with a class picked only its own are offered.
        items: this.o.bases.filter((b) => b.slot === slot && (!cls || b.names.any || b.names[cls])).map((b): Choice => ({
          value: b.id,
          name: this.gearName(b),
          sub: `Lv.${b.minLevel}+`,
          icon: () => baseIcon(b, cls),
        })),
      }));
    }
    if (tab === 'card') {
      const out: Section[] = [];
      for (const d0 of CARD_DEFAULTS) {
        // The tuned rarity when the page has the card tuning (the /admin card tab can change it).
        const d = cardDef(d0.id) ?? d0;
        const title = `ชั้น ${d.floor} · แมพ ${d.map} ${MAP_NAME[d.floor][d.map - 1] ?? ''}`.trim();
        let s = out.find((x) => x.title === title);
        if (!s) out.push((s = { title, items: [] }));
        s.items.push({
          value: `stone:${d.id}`,
          name: cardName(d.id),
          sub: CARD_RARITY_NAME[d.rarity],
          subColor: RARITY_COLOR[d.rarity],
          card: true,
          icon: () => h('img', { class: 'ipick-card', src: cardArt(d.id), alt: '', loading: 'lazy', draggable: false, style: `--rc:${RARITY_COLOR[d.rarity]}` }),
        });
      }
      return out;
    }
    const stone = (k: StoneKind): Choice => ({ value: `stone:${k}`, name: STONE_NAME[k], icon: () => entryIcon({ stone: k, count: 1 }) });
    return [
      {
        title: 'ยา',
        items: (['hp', 'mp'] as const).flatMap((k) => POTION_SIZES.map((sz): Choice => ({
          value: `potion:${k}:${sz}`, name: potionName(k, sz), icon: () => entryIcon({ potion: k, size: sz, count: 1 }),
        }))),
      },
      { title: 'หินช่างตีเหล็ก', items: BLACKSMITH_STONES.map(stone) },
      { title: 'กุญแจห้องบอส (Artifact)', items: BOSS_KEYS.map(stone) },
      { title: 'ของใช้ (ผูกตัวละคร)', items: REWARD_ITEMS.map(stone) },
    ];
  }

  private all(): Choice[] {
    return (['gear', 'card', 'use'] as Tab[]).flatMap((t) => this.sections(t).flatMap((s) => s.items));
  }

  private tabOf(v: string): Tab {
    return v.startsWith('stone:card_') ? 'card' : /^(potion|stone):/.test(v) ? 'use' : 'gear';
  }

  // ---------------------------------------------------------- drawing

  /** The button: the picked thing's picture and name. */
  private draw(): void {
    const c = this.all().find((x) => x.value === this.v);
    this.el.replaceChildren(
      h('span', { class: `ipick-ic${c?.card ? ' card' : ''}` }, c ? c.icon() : null),
      h('span', { class: 'ipick-name' }, c ? c.name : 'เลือกไอเทม', c?.sub ? h('small', { style: c.subColor ? `color:${c.subColor}` : '' }, ` ${c.sub}`) : null),
      h('span', { class: 'ipick-arrow' }, '▾'),
    );
  }

  /** The picking window over the page. */
  private open(): void {
    this.tab = this.tabOf(this.v);
    this.query = '';
    const body = h('div', { class: 'ipick-body' });
    const tabs = h('div', { class: 'ipick-tabs' });
    const search = h('input', { type: 'search', placeholder: 'ค้นหาชื่อ', autocapitalize: 'off' });
    const close = () => {
      bg.remove();
      window.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Only this window closes, not the character sheet under it.
      e.stopPropagation();
      close();
    };
    const fill = () => {
      tabs.replaceChildren(...(['gear', 'card', 'use'] as Tab[]).map((t) =>
        h('button', { type: 'button', class: t === this.tab && !this.query ? 'on' : '', onclick: () => { this.tab = t; search.value = this.query = ''; fill(); } }, TAB_NAME[t])));
      // A search looks through every tab.
      const q = this.query.trim().toLowerCase();
      const secs = q
        ? (['gear', 'card', 'use'] as Tab[]).flatMap((t) => this.sections(t).map((s) => ({ title: `${TAB_NAME[t]} · ${s.title}`, items: s.items.filter((c) => c.name.toLowerCase().includes(q)) })))
        : this.sections(this.tab);
      const shown = secs.filter((s) => s.items.length);
      body.replaceChildren(...(shown.length ? shown.map((s) => h('section', {},
        h('h4', {}, s.title),
        h('div', { class: 'ipick-grid' }, ...s.items.map((c) => h('button', {
          type: 'button', class: `ipick-tile${c.card ? ' card' : ''}${c.value === this.v ? ' sel' : ''}`, title: c.name,
          onclick: () => {
            this.v = c.value;
            this.draw();
            close();
            this.o.onChange?.();
          },
        },
        h('span', { class: `ipick-ic${c.card ? ' card' : ''}` }, c.icon()),
        h('span', { class: 'ipick-tname' }, c.name),
        c.sub ? h('span', { class: 'ipick-sub', style: c.subColor ? `color:${c.subColor}` : '' }, c.sub) : null))),
      )) : [h('div', { class: 'muted' }, 'ไม่พบไอเทมที่ตรงกับคำค้น')]));
      body.querySelector('.sel')?.scrollIntoView({ block: 'center' });
    };
    search.oninput = () => {
      this.query = search.value;
      fill();
    };
    const bg: HTMLElement = h('div', { class: 'ipick-bg', onclick: (e: Event) => e.target === bg && close() },
      h('div', { class: 'ipick' },
        h('div', { class: 'ipick-head' },
          h('b', {}, this.o.cls ? `เลือกไอเทม (ของสวมใส่: ${className(this.o.cls())})` : 'เลือกไอเทม'),
          h('button', { type: 'button', class: 'x small', onclick: close }, '✕')),
        h('div', { class: 'row' }, tabs, search),
        body));
    document.body.append(bg);
    window.addEventListener('keydown', onKey, true);
    fill();
    // A phone would pop its keyboard over the grid: focus the search on a mouse only.
    if (matchMedia('(pointer: fine)').matches) search.focus();
  }
}
