import type { Game } from '../Game';
import { AUTO_PX_PER_UNIT, AUTO_RANGE_MAX, AUTO_RANGE_MIN, cleanAutoSettings, type AutoSkill } from '../../shared/sim/Player';
import { MONSTERS } from '../../shared/data/monsters';
import { currentBalance } from '../../shared/balance';
import { AUTO_DEFAULT_KEYS, AUTO_LOOT_ORDER_NAME, AUTO_LOOT_ORDERS, AUTO_OUT_ACTION_NAME, AUTO_OUT_ACTIONS, AUTO_TARGET_MODES, AUTO_TARGET_NAME } from '../../shared/autoTuning';
import { skillIcon } from '../icons';
import { $, syncPots } from './hudShared';

/** The Auto Play settings window (range, potions %, skills and their order, loot and target options). */
export class AutoSettingsWindow {
  constructor(private readonly g: Game) {
    $('btn-auto-set').onclick = () => this.toggleAutoSettings();
    $('auto-set-close').onclick = () => this.toggleAutoSettings(false);
    for (const id of ['aset-range', 'aset-hp', 'aset-mp', 'aset-loot', 'aset-lootorder', 'aset-others', 'aset-nohp', 'aset-nomp', 'aset-bagfull', 'aset-target']) $(id).addEventListener('change', () => this.applyAutoSettings());
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
    skipBox.innerHTML = '';
    for (const id of kinds) {
      const label = document.createElement('label');
      label.className = 'aset-check';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.monster = id;
      cb.checked = !s.skip.includes(id);
      cb.addEventListener('change', () => this.applyAutoSettings());
      label.append(cb, ` ${MONSTERS[id].nameTh}`);
      skipBox.append(label);
    }
    syncPots($('aset-pots'), p.lootFilter);
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
    };
    // An option the player changes is theirs from now on; the others keep following the server's default.
    const optsSet = AUTO_DEFAULT_KEYS.filter((k) => cur.optsSet?.includes(k) || opts[k] !== cur[k]);
    const s = cleanAutoSettings({
      range: num('aset-range'), hpPct: num('aset-hp'), mpPct: num('aset-mp'), skills, order, loot: $<HTMLInputElement>('aset-loot').checked,
      rangeSet: cur.rangeSet || num('aset-range') !== cur.range,
      ...opts, optsSet, skip,
    });
    this.g.backend.setAutoSettings(s);
    this.fillAutoSettings();
  }
}
