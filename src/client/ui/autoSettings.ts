import type { Game } from '../Game';
import { AUTO_PX_PER_UNIT, AUTO_RANGE_MAX, AUTO_RANGE_MIN, cleanAutoSettings, lootPick, lootPots, type AutoSkill } from '../../shared/sim/Player';
import { LOOT_CAT_NAME, LOOT_CATS, LOOT_LV_MAX, LOOT_TIER_ANY, type LootCat, type PickupDefaults } from '../../shared/autoTuning';
import { RARITIES, RARITY_COLOR, RARITY_LABEL, type StoneKind } from '../../shared/types';
import { CARD_IDS } from '../../shared/data/cards';
import { MONSTERS } from '../../shared/data/monsters';
import { currentBalance } from '../../shared/balance';
import { AUTO_DEFAULT_KEYS, AUTO_LOOT_ORDER_NAME, AUTO_LOOT_ORDERS, AUTO_OUT_ACTION_NAME, AUTO_OUT_ACTIONS, AUTO_TARGET_MODES, AUTO_TARGET_NAME } from '../../shared/autoTuning';
import { cardIcon, iconImg, potionIcon, skillIcon, stoneIcon } from '../icons';
import { $, chkRow, syncPots } from './hudShared';

/** The small paper icon of each pickup category: the picture of an item of that kind (owner 2026-11-28). */
function catIcon(c: LootCat): string {
  const stone = (k: StoneKind) => stoneIcon(k);
  switch (c) {
    case 'gear': return iconImg('item_helm');
    case 'potion': return potionIcon('hp');
    case 'stone': return stone('enhance');
    case 'card': return CARD_IDS.length ? cardIcon(CARD_IDS[0]) : stone('enhance');
    case 'key': return stone('key_bear');
    case 'scroll': return stone('return_scroll');
    case 'box': return stone('mystery_box');
    case 'other': return stone('phoenix');
  }
}

/** The Auto Play settings window (range, potions %, skills and their order, loot and target options). */
export class AutoSettingsWindow {
  constructor(private readonly g: Game) {
    $('btn-auto-set').onclick = () => this.toggleAutoSettings();
    $('auto-set-close').onclick = () => this.toggleAutoSettings(false);
    this.buildPickup();
    for (const id of ['aset-range', 'aset-hp', 'aset-mp', 'aset-loot', 'aset-lootorder', 'aset-others', 'aset-nohp', 'aset-nomp', 'aset-bagfull', 'aset-target', 'aset-skillsonly', 'aset-skillgap']) $(id).addEventListener('change', () => this.applyAutoSettings());
  }

  // ------------------------------------------------------------ pickup filter

  /** Category ticks (with icons) and the gear detail box: rarity, best stat tier, level range. */
  private buildPickup(): void {
    const cats = $('aset-cats');
    const gear = $('aset-gear');
    const tiers = Array.from({ length: LOOT_TIER_ANY }, (_, i) => i + 1)
      .map((n) => `<option value="${n}">${n === LOOT_TIER_ANY ? 'ทุกเทียร์' : `มี T${n} ขึ้นไป`}</option>`).join('');
    gear.innerHTML =
      chkRow('เกรด', RARITIES.map((r) => `<label style="color:${RARITY_COLOR[r]}"><input type="checkbox" data-rarity="${r}">${RARITY_LABEL[r]}</label>`).join('')) +
      `<label class="aset-row">เทียร์ค่าสถานะ <select id="aset-gtier">${tiers}</select></label>` +
      `<label class="aset-row">เลเวลอุปกรณ์ <span><input id="aset-glo" type="number" min="1" max="${LOOT_LV_MAX}" step="1"> – ` +
      `<input id="aset-ghi" type="number" min="1" max="${LOOT_LV_MAX}" step="1"></span></label>` +
      '<div class="hint">T1 ดีที่สุด · "มี T2 ขึ้นไป" = เก็บเมื่อมีค่าสถานะอย่างน้อย 1 บรรทัดเป็น T1 หรือ T2 · อุปกรณ์เก่าที่ไม่มีเทียร์เก็บเสมอ</div>';
    $('aset-gear-more').onclick = () => {
      const open = $('aset-gear').classList.toggle('hidden') === false;
      $('aset-gear-more').textContent = open ? 'รายละเอียดอุปกรณ์ ▴' : 'รายละเอียดอุปกรณ์ ▾';
    };
    cats.addEventListener('change', () => this.sendPickup());
    gear.addEventListener('change', () => this.sendPickup());
  }

  /** Put the player's pickup filter into the ticks. */
  private fillPickup(): void {
    const f = this.g.player.lootFilter;
    const pick = lootPick(f);
    // Built on first open, not in the constructor: the paper icon paths are only known once the HUD art is set up.
    const box = $('aset-cats');
    if (!box.querySelector('[data-cat]')) {
      box.innerHTML = chkRow('', LOOT_CATS.map((c) =>
        `<label class="aset-cat"><input type="checkbox" data-cat="${c}">${catIcon(c)}<span>${LOOT_CAT_NAME[c]}</span></label>`).join(''));
    }
    for (const cb of $('aset-cats').querySelectorAll<HTMLInputElement>('[data-cat]')) cb.checked = pick.cats.includes(cb.dataset.cat as LootCat);
    for (const cb of $('aset-gear').querySelectorAll<HTMLInputElement>('[data-rarity]')) cb.checked = f.rarities.includes(cb.dataset.rarity as (typeof RARITIES)[number]);
    $<HTMLSelectElement>('aset-gtier').value = String(pick.gearTier);
    $<HTMLInputElement>('aset-glo').value = String(pick.gearLvMin);
    $<HTMLInputElement>('aset-ghi').value = String(pick.gearLvMax);
    // Without potions, the size ticks mean nothing.
    $('aset-pots').classList.toggle('aset-off', !pick.cats.includes('potion'));
    $('aset-gear-more').classList.toggle('aset-off', !pick.cats.includes('gear'));
  }

  /** Send the whole filter with the ticks as they are now (the server cleans it). */
  private sendPickup(): void {
    const f = this.g.player.lootFilter;
    const gear = $('aset-gear');
    const num = (id: string, def: number) => {
      const v = Math.round(Number($<HTMLInputElement>(id).value));
      return Number.isFinite(v) && v >= 1 ? Math.min(LOOT_LV_MAX, v) : def;
    };
    let lo = num('aset-glo', 1);
    let hi = num('aset-ghi', LOOT_LV_MAX);
    if (lo > hi) [lo, hi] = [hi, lo];
    const pick: PickupDefaults = {
      cats: LOOT_CATS.filter((c) => $('aset-cats').querySelector<HTMLInputElement>(`[data-cat="${c}"]`)?.checked),
      gearTier: Number($<HTMLSelectElement>('aset-gtier').value) || LOOT_TIER_ANY,
      gearLvMin: lo,
      gearLvMax: hi,
    };
    const pots = lootPots(f);
    this.g.backend.setLootFilter({
      rarities: RARITIES.filter((r) => gear.querySelector<HTMLInputElement>(`[data-rarity="${r}"]`)?.checked),
      potions: pots.hp.length + pots.mp.length > 0,
      pots,
      pick,
    });
    this.fillPickup();
    // The bag window shows the same rarity ticks.
    const lf = $('loot-filter');
    for (const r of RARITIES) {
      const cb = lf.querySelector<HTMLInputElement>(`[data-rarity="${r}"]`);
      if (cb) cb.checked = this.g.player.lootFilter.rarities.includes(r);
    }
  }

  // ------------------------------------------------------------ auto settings

  toggleAutoSettings(force?: boolean): void {
    const el = $('auto-settings');
    const open = force ?? el.classList.contains('hidden');
    el.classList.toggle('hidden', !open);
    if (open) this.fillAutoSettings();
  }

  /** The range being typed while the settings window is open (clamped), else null. */
  autoRangePreview(): number | null {
    if ($('auto-settings').classList.contains('hidden')) return null;
    const v = Number($<HTMLInputElement>('aset-range').value);
    if (!Number.isFinite(v) || v <= 0) return this.g.player.autoSettings.range;
    return Math.max(AUTO_RANGE_MIN, Math.min(AUTO_RANGE_MAX, v));
  }

  /** Put the player's current settings into the form. */
  private fillAutoSettings(): void {
    const p = this.g.player;
    const s = p.autoSettings;
    $<HTMLInputElement>('aset-range').min = String(AUTO_RANGE_MIN);
    $<HTMLInputElement>('aset-range').max = String(AUTO_RANGE_MAX);
    $<HTMLInputElement>('aset-range').value = String(s.range);
    $('aset-range-hint').textContent = `${AUTO_RANGE_MIN}–${AUTO_RANGE_MAX} px · ${AUTO_PX_PER_UNIT} px = 1 ช่องในแมพ`;
    $<HTMLInputElement>('aset-hp').value = String(s.hpPct);
    $<HTMLInputElement>('aset-mp').value = String(s.mpPct);
    $<HTMLInputElement>('aset-loot').checked = s.loot;
    $<HTMLInputElement>('aset-skillsonly').checked = s.skillsOnly;
    $<HTMLInputElement>('aset-skillgap').value = String(s.skillGap);
    // Options the server switched off (admin) can't be chosen; Auto uses the safe one for them.
    const allow = currentBalance().auto.allow;
    const off = ' (ปิดโดยผู้ดูแล)';
    const fillSelect = (id: string, opts: [string, string, boolean][], value: string) => {
      const sel = $<HTMLSelectElement>(id);
      sel.innerHTML = '';
      for (const [v, label, ok] of opts) sel.add(new Option(ok ? label : label + off, v));
      for (const [i, [, , ok]] of opts.entries()) sel.options[i].disabled = !ok;
      sel.value = value;
    };
    fillSelect('aset-lootorder', AUTO_LOOT_ORDERS.map((k) => [k, AUTO_LOOT_ORDER_NAME[k], k !== 'loot' || allow.lootFirst]), s.lootOrder);
    $('aset-lootorder-hint').textContent = {
      fight: 'ตีมอนที่ตีเราอยู่ให้หมดก่อน แล้วค่อยเก็บของ',
      balanced: 'ของใกล้ตัวเก็บแม้กำลังสู้ ของไกลเก็บตอนไม่มีมอนใกล้',
      loot: 'เห็นของในวงเดินไปเก็บทันที แม้มอนกำลังตี',
    }[s.lootOrder];
    fillSelect('aset-others', [['1', 'เก็บของคนอื่นด้วย', allow.othersLoot], ['0', 'เก็บเฉพาะของตัวเอง', true]], s.othersLoot ? '1' : '0');
    const outOpts = AUTO_OUT_ACTIONS.map((k): [string, string, boolean] => [k, AUTO_OUT_ACTION_NAME[k], k !== 'scroll' || allow.scroll]);
    fillSelect('aset-nohp', outOpts, s.noHp);
    fillSelect('aset-nomp', outOpts, s.noMp);
    fillSelect('aset-bagfull', outOpts, s.bagFull);
    fillSelect('aset-target', AUTO_TARGET_MODES.map((k) => [k, AUTO_TARGET_NAME[k], true]), s.target);
    // Monster kinds of this map: unticked = Auto leaves them alone.
    const kinds = [...new Set(this.g.zone.spawns.map((sp) => sp.monster))].filter((id) => MONSTERS[id] && MONSTERS[id].behavior !== 'boss');
    $('aset-skip-wrap').classList.toggle('hidden', !kinds.length || !allow.skip);
    const skipBox = $('aset-skip');
    skipBox.innerHTML = chkRow('', '');
    const skipOpts = skipBox.querySelector<HTMLElement>('.chk-opts')!;
    for (const id of kinds) {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.monster = id;
      cb.checked = !s.skip.includes(id);
      cb.addEventListener('change', () => this.applyAutoSettings());
      label.append(cb, ` ${MONSTERS[id].nameTh}`);
      skipOpts.append(label);
    }
    syncPots($('aset-pots'), p.lootFilter);
    this.fillPickup();
    const box = $('aset-skills');
    box.innerHTML = '';
    s.order.forEach((slot, i) => {
      const sk = p.skill(slot);
      const row = document.createElement('div');
      row.className = 'aset-skill';
      row.dataset.slot = slot;
      row.innerHTML =
        `<span class="aset-rank">${i + 1}</span>` +
        `<span class="aset-grab" title="ลากเพื่อสลับลำดับ">${sk ? skillIcon(sk.id) : ''}<b class="aset-key">${slot.toUpperCase()}</b>` +
        `<span class="aset-name">${sk?.nameTh ?? sk?.name ?? '-'}</span></span>` +
        `<button class="aset-move" data-dir="-1" title="เลื่อนขึ้น"${i === 0 ? ' disabled' : ''}>▲</button>` +
        `<button class="aset-move" data-dir="1" title="เลื่อนลง"${i === s.order.length - 1 ? ' disabled' : ''}>▼</button>`;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.title = 'ให้ Auto ใช้สกิลนี้';
      cb.checked = s.skills[slot];
      cb.addEventListener('change', () => this.applyAutoSettings());
      row.append(cb);
      for (const b of row.querySelectorAll<HTMLButtonElement>('.aset-move')) {
        b.onclick = () => {
          const sib = Number(b.dataset.dir) < 0 ? row.previousElementSibling : row.nextElementSibling?.nextElementSibling ?? null;
          if (Number(b.dataset.dir) < 0 && !sib) return;
          box.insertBefore(row, sib);
          this.applyAutoSettings();
        };
      }
      this.dragAutoSkill(box, row, row.querySelector<HTMLElement>('.aset-grab')!);
      box.append(row);
    });
  }

  /** Drag a skill row by its icon and name to a new place in the order (mouse or finger). */
  private dragAutoSkill(box: HTMLElement, row: HTMLElement, grab: HTMLElement): void {
    grab.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const start = [...box.children].indexOf(row);
      const id = e.pointerId;
      row.classList.add('dragging');
      // Listen on window, not with pointer capture: moving the row in the DOM drops capture in Chromium.
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        // The row goes before the first other row whose middle is below the pointer.
        const rest = [...box.children].filter((c) => c !== row) as HTMLElement[];
        const before = rest.find((c) => { const r = c.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; }) ?? null;
        if (before === row.nextElementSibling) return;
        box.insertBefore(row, before);
        box.querySelectorAll('.aset-rank').forEach((r, i) => { r.textContent = String(i + 1); });
      };
      const end = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        row.classList.remove('dragging');
        if ([...box.children].indexOf(row) !== start) this.applyAutoSettings();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    });
  }

  /** Read the form, clamp it, send it, then show the clamped values. */
  private applyAutoSettings(): void {
    const num = (id: string) => Number($<HTMLInputElement>(id).value);
    const skills = { ...this.g.player.autoSettings.skills };
    const order: AutoSkill[] = [];
    for (const row of $('aset-skills').querySelectorAll<HTMLElement>('.aset-skill')) {
      const slot = row.dataset.slot as AutoSkill;
      order.push(slot);
      skills[slot] = row.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked;
    }
    const cur = this.g.player.autoSettings;
    const val = (id: string) => $<HTMLSelectElement>(id).value;
    // Kinds skipped on other maps stay skipped; this map's follow the ticks.
    const boxes = [...$('aset-skip').querySelectorAll<HTMLInputElement>('input[data-monster]')];
    const here = new Set(boxes.map((b) => b.dataset.monster!));
    const skip = [...cur.skip.filter((id) => !here.has(id)), ...boxes.filter((b) => !b.checked).map((b) => b.dataset.monster!)];
    const opts = {
      lootOrder: val('aset-lootorder'), othersLoot: val('aset-others') === '1',
      noHp: val('aset-nohp'), noMp: val('aset-nomp'), bagFull: val('aset-bagfull'), target: val('aset-target'),
      skillsOnly: $<HTMLInputElement>('aset-skillsonly').checked,
    };
    // An option the player changes is theirs from now on; the others keep following the server's default.
    const optsSet = AUTO_DEFAULT_KEYS.filter((k) => cur.optsSet?.includes(k) || opts[k] !== cur[k]);
    const s = cleanAutoSettings({
      range: num('aset-range'), hpPct: num('aset-hp'), mpPct: num('aset-mp'), skills, order, loot: $<HTMLInputElement>('aset-loot').checked,
      rangeSet: cur.rangeSet || num('aset-range') !== cur.range,
      skillGap: num('aset-skillgap'),
      skillGapSet: cur.skillGapSet || num('aset-skillgap') !== cur.skillGap,
      ...opts, optsSet, skip,
    });
    this.g.backend.setAutoSettings(s);
    this.fillAutoSettings();
  }
}
