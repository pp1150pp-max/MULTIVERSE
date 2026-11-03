import type { Game } from './Game';
import { NPC_USE_RANGE, type NpcId } from '../shared/data/npcs';
import type { SkillSlot } from '../shared/data/classes';
import {
  dropsOnFail, effectiveStats, enhanceCost, itemName, MAX_PLUS, plusOf, sellValue, successRate,
  DROP_ON_FAIL_FROM,
} from '../shared/data/enhance';
import { POTION_PRICE } from '../shared/data/shop';
import { MONSTERS } from '../shared/data/monsters';
import { expToNext } from '../shared/formulas';
import {
  RARITY_COLOR, RARITY_LABEL, SLOTS, SLOT_LABEL, STAT_KEYS, STAT_LABEL,
  type Item, type SlotId, type StatKey,
} from '../shared/types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const KEY_LABEL: Record<SkillSlot, string> = { basic: 'LMB', q: 'Q', e: 'E', r: 'R', dash: 'SPACE' };
const SLOT_ICON: Record<SlotId, string> = { weapon: '🗡️', helmet: '⛑️', armor: '🥋', boots: '👢', ring: '💍' };
const POTION_CD = 1.5;
const fmtNum = (v: number) => String(Math.round(v * 10) / 10);

const SEEKER_LINES = [
  'ในที่สุดเจ้าก็ตื่นแล้ว… เจ้าคือผู้รอดชีวิตจากโลกที่ถูก The Devourer กลืนกิน',
  'ข้าคือ The Seeker ผู้ตามหาความจริงเบื้องหลังการล่มสลายของมิติทั้งหลาย ตั้งแต่ The Shattering แยก The First Cosmos ออกเป็นเสี่ยง ๆ',
  'แสงสีทองขาวที่พาเจ้ามาที่นี่… ข้าเคยเห็นมันในบันทึกโบราณที่เรียกว่า The Origin',
  'ป่ามรกตแห่งนี้คือเศษเสี้ยวของมิติที่ยังรอด แต่สัตว์ป่าเริ่มคลุ้มคลั่งจากพลังที่รั่วไหล จงฝึกฝนตัวเองที่นี่ก่อน',
  'ลึกเข้าไปทางตะวันตกเฉียงเหนือ มีหมีใหญ่ที่ถูกพลังนั้นครอบงำ หากเจ้าปราบมันได้ เราจะได้เบาะแสแรกของ The Origin',
];

export class Hud {
  dialogOpen = false;
  private slotEls: { kind: SkillSlot | 'hp' | 'mp'; el: HTMLElement; cd: HTMLElement; extra: HTMLElement }[] = [];
  private invDirty = true;
  private bagOpen = false;
  private mmT = 0;
  private readonly mm: CanvasRenderingContext2D;
  private dialogIdx = 0;
  private shopOpen = false;
  private forgeOpen = false;
  private forgeSel: string | null = null;
  private confirmYes: (() => void) | null = null;

  constructor(private readonly g: Game) {
    $('hud').classList.remove('hidden');
    this.mm = $<HTMLCanvasElement>('minimap').getContext('2d')!;
    $('hud-name').textContent = g.player.name;
    $('hud-zone').textContent = `${g.zone.name} · ${g.zone.nameTh}  (Lv.${g.zone.levels[0]}–${g.zone.levels[1]})`;
    this.buildSkillbar();

    $('btn-auto').onclick = () => g.toggleAuto();
    $('btn-bag').onclick = () => this.toggleBag();
    $('btn-help').onclick = () => this.toggleHelp();
    $('btn-respawn').onclick = () => g.respawn();
    $('inv-close').onclick = () => this.toggleBag(false);
    $('help-close').onclick = () => this.toggleHelp(false);
    $('dialog').onclick = () => this.advanceDialog();

    const bag = $('bag-grid');
    bag.addEventListener('click', (e) => {
      const i = this.cellIndex(e);
      if (i < 0) return;
      g.player.equipFromBag(i);
      this.hideTip();
      this.markInventory();
    });
    bag.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const i = this.cellIndex(e);
      const item = i >= 0 ? g.player.bag[i] : null;
      if (!item) return;
      this.hideTip();
      if (this.shopOpen) {
        // Selling only works while talking to the merchant.
        g.sim.sellItem(g.player, i);
        this.afterTrade();
        return;
      }
      this.confirm(
        `วาง <b style="color:${RARITY_COLOR[item.rarity]}">${itemName(item)}</b> ลงบนพื้น?<br><small>เก็บคืนได้ภายใน 60 วินาที · ถ้าจะขาย ให้ไปหาพ่อค้าที่แคมป์</small>`,
        'วางลงพื้น',
        () => {
          if (g.player.bag[i] !== item) return;
          g.dropFromBag(i);
          this.markInventory();
          if (this.forgeOpen) this.renderForge();
        },
      );
    });
    bag.addEventListener('mousemove', (e) => {
      const i = this.cellIndex(e);
      const item = i >= 0 ? g.player.bag[i] : null;
      if (item) this.showTip(item, e, this.shopOpen ? 'คลิกซ้าย: สวมใส่ · คลิกขวา: ขาย' : 'คลิกซ้าย: สวมใส่ · คลิกขวา: วางลงพื้น');
      else this.hideTip();
    });
    bag.addEventListener('mouseleave', () => this.hideTip());

    const eq = $('equip-slots');
    eq.addEventListener('click', (e) => {
      const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.dataset.slot as SlotId | undefined;
      if (!slot) return;
      g.player.unequip(slot);
      this.hideTip();
      this.markInventory();
    });
    eq.addEventListener('mousemove', (e) => {
      const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.dataset.slot as SlotId | undefined;
      const item = slot ? g.player.equipment[slot] : undefined;
      if (item) this.showTip(item, e, 'คลิก: ถอดเก็บเข้ากระเป๋า');
      else this.hideTip();
    });
    eq.addEventListener('mouseleave', () => this.hideTip());

    // Merchant
    $('shop-close').onclick = () => this.closeShop();
    $('price-hp').textContent = `${POTION_PRICE.hp} G`;
    $('price-mp').textContent = `${POTION_PRICE.mp} G`;
    $('shop').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-buy]');
      if (!b) return;
      const [kind, n] = b.dataset.buy!.split(':') as ['hp' | 'mp', string];
      this.buyPotion(kind, Number(n));
    });
    $('sell-common').onclick = () => this.sellAllCommon();

    // Blacksmith
    $('forge-close').onclick = () => this.closeForge();
    $('forge-list').addEventListener('click', (e) => {
      const uid = (e.target as HTMLElement).closest<HTMLElement>('[data-uid]')?.dataset.uid;
      if (!uid) return;
      this.forgeSel = uid;
      $('forge-result').textContent = '';
      this.renderForge();
    });
    $('forge-go').onclick = () => this.enhance();
    $('forge-table').innerHTML = this.rateTable();

    $('confirm-yes').onclick = () => {
      const fn = this.confirmYes;
      this.closeConfirm();
      fn?.();
    };
    $('confirm-no').onclick = () => this.closeConfirm();

    this.log(`ยินดีต้อนรับสู่ ${g.zone.name} — กด H เพื่อดูวิธีควบคุม`, '#cfe8ff');
  }

  private cellIndex(e: Event): number {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    return el ? Number(el.dataset.i) : -1;
  }

  // ------------------------------------------------------------ build

  private buildSkillbar(): void {
    const bar = $('skillbar');
    bar.innerHTML = '';
    const add = (kind: SkillSlot | 'hp' | 'mp', icon: string, key: string, title: string) => {
      const el = document.createElement('div');
      el.className = `skill skill-${kind}`;
      el.innerHTML = `<div class="icon">${icon}</div><div class="cd"></div><div class="key">${key}</div><div class="extra"></div>`;
      el.title = title;
      bar.append(el);
      this.slotEls.push({ kind, el, cd: el.querySelector('.cd')!, extra: el.querySelector('.extra')! });
    };
    for (const s of this.g.player.cls.skills) {
      add(s.slot, s.icon, KEY_LABEL[s.slot], `${s.name} (${s.nameTh})\n${s.desc}${s.mp ? `\nMP ${s.mp}` : ''}${s.cooldown ? ` · คูลดาวน์ ${s.cooldown} วิ` : ''}`);
    }
    add('hp', '❤️', '1', 'ยาฟื้น HP 40%');
    add('mp', '💧', '2', 'ยาฟื้น MP 50%');
  }

  // ------------------------------------------------------------ per-frame

  update(dt: number): void {
    const p = this.g.player;
    const need = expToNext(p.level);
    $('hp-fill').style.width = `${(Math.max(0, p.hp) / p.maxHp) * 100}%`;
    $('hp-text').textContent = `${Math.ceil(Math.max(0, p.hp))} / ${Math.round(p.maxHp)}`;
    $('mp-fill').style.width = `${(p.mp / p.stats.maxMp) * 100}%`;
    $('mp-text').textContent = `${Math.floor(p.mp)} / ${Math.round(p.stats.maxMp)}`;
    $('exp-fill').style.width = `${(p.exp / need) * 100}%`;
    $('exp-text').textContent = `EXP ${((p.exp / need) * 100).toFixed(1)}%`;
    $('hud-level').textContent = `Lv.${p.level} ${p.cls.name}`;
    $('hud-gold').textContent = `${p.gold.toLocaleString()} G`;

    for (const s of this.slotEls) {
      if (s.kind === 'hp' || s.kind === 'mp') {
        const count = s.kind === 'hp' ? p.hpPots : p.mpPots;
        s.extra.textContent = String(count);
        s.cd.style.height = `${(Math.max(0, p.potCd) / POTION_CD) * 100}%`;
        s.el.classList.toggle('empty', count <= 0);
        continue;
      }
      const sk = p.skill(s.kind);
      if (!sk) continue;
      const remain = p.cd[s.kind] ?? 0;
      s.cd.style.height = sk.cooldown ? `${(remain / sk.cooldown) * 100}%` : '0%';
      s.extra.textContent = remain > 0 ? remain.toFixed(1) : '';
      s.el.classList.toggle('nomp', p.mp < sk.mp);
    }

    const auto = $('btn-auto');
    auto.classList.toggle('active', this.g.autoPlay);
    auto.textContent = this.g.autoPlay ? 'AUTO: ON (F)' : 'AUTO: OFF (F)';

    const boss = this.g.monsters.find((m) => m.isBoss && m.alive && (m.isHostile || Math.hypot(m.x - p.x, m.z - p.z) < 16));
    const bb = $('boss-bar');
    bb.classList.toggle('hidden', !boss);
    if (boss) {
      $('boss-name').textContent = `Lv.${boss.level} ${boss.def.name}${boss.enraged ? ' — ENRAGED' : ''}`;
      $('boss-fill').style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    }

    if (this.shopOpen) {
      if (this.g.npcDistance('merchant') > NPC_USE_RANGE || !p.alive) this.closeShop();
      else this.renderShopMoney();
    }
    if (this.forgeOpen && (this.g.npcDistance('blacksmith') > NPC_USE_RANGE || !p.alive)) this.closeForge();

    this.mmT -= dt;
    if (this.mmT <= 0) {
      this.mmT = 0.1;
      this.drawMinimap();
    }
    if (this.bagOpen && this.invDirty) this.renderInventory();
  }

  private drawMinimap(): void {
    const ctx = this.mm;
    const W = ctx.canvas.width;
    const c = W / 2;
    const g = this.g;
    const p = g.player;
    const sc = 2.6;
    const S = Math.SQRT1_2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#10200f';
    ctx.fillRect(0, 0, W, W);
    // Draw the ground texture rotated to match the iso camera.
    const H = g.world.half;
    const k = (2 * H) / g.world.groundCanvas.width;
    const a = k * sc * S;
    ctx.setTransform(a, a, -a, a, (p.z - p.x) * sc * S + c, (-2 * H - p.x - p.z) * sc * S + c);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(g.world.groundCanvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const toMM = (x: number, z: number): [number, number] => {
      const dx = x - p.x;
      const dz = z - p.z;
      return [c + (dx - dz) * S * sc, c + (dx + dz) * S * sc];
    };
    const dot = (x: number, z: number, r: number, col: string) => {
      const [mx, my] = toMM(x, z);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const l of g.loots) if (l.kind.type === 'item') dot(l.x, l.z, 2, RARITY_COLOR[l.kind.item.rarity]);
    for (const m of g.monsters) {
      if (!m.alive) continue;
      if (m.isBoss) {
        dot(m.x, m.z, 5, '#ff3a2a');
        dot(m.x, m.z, 2.5, '#ffd34a');
      } else dot(m.x, m.z, 2.2, m.isHostile ? '#ff5a4a' : '#f2a640');
    }
    const npcColor: Record<NpcId, string> = { seeker: '#fff3c0', merchant: '#7fe07a', blacksmith: '#ff9a4a' };
    for (const n of g.npcs) dot(n.x, n.z, 3.5, npcColor[n.id]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c, c, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#c9a85a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ------------------------------------------------------------ inventory

  markInventory(): void {
    this.invDirty = true;
  }

  toggleBag(force?: boolean): void {
    this.bagOpen = force ?? !this.bagOpen;
    $('inventory').classList.toggle('hidden', !this.bagOpen);
    if (!this.bagOpen) this.hideTip();
    this.invDirty = true;
  }

  toggleHelp(force?: boolean): void {
    $('help').classList.toggle('hidden', !(force ?? $('help').classList.contains('hidden')));
  }

  closePanels(): void {
    if (this.confirmYes) return this.closeConfirm();
    this.toggleBag(false);
    this.toggleHelp(false);
    this.closeShop();
    this.closeForge();
    if (this.dialogOpen) this.closeDialog();
  }

  talkTo(id: NpcId): void {
    if (id === 'seeker') this.openDialog();
    else if (id === 'merchant') this.openShop();
    else this.openForge();
  }

  // ------------------------------------------------------------ confirm

  private confirm(html: string, yesLabel: string, onYes: () => void): void {
    $('confirm-text').innerHTML = html;
    $('confirm-yes').textContent = yesLabel;
    this.confirmYes = onYes;
    $('confirm').classList.remove('hidden');
  }

  private closeConfirm(): void {
    this.confirmYes = null;
    $('confirm').classList.add('hidden');
  }

  // ------------------------------------------------------------ merchant

  private openShop(): void {
    this.closeForge();
    this.shopOpen = true;
    $('shop').classList.remove('hidden');
    this.toggleBag(true);
    this.renderShopMoney();
  }

  private closeShop(): void {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    $('shop').classList.add('hidden');
    this.closeConfirm();
    this.markInventory();
  }

  private renderShopMoney(): void {
    const p = this.g.player;
    $('shop-gold').textContent = `💰 ${p.gold.toLocaleString()} G`;
    $('shop-pots').textContent = `❤️ ${p.hpPots}  💧 ${p.mpPots}`;
    $('shop').querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => {
      const [kind, n] = b.dataset.buy!.split(':') as ['hp' | 'mp', string];
      b.disabled = p.gold < POTION_PRICE[kind] * Number(n);
    });
  }

  private buyPotion(kind: 'hp' | 'mp', n: number): void {
    this.g.sim.buyPotion(this.g.player, kind, n);
    this.afterTrade();
  }

  private sellAllCommon(): void {
    this.g.sim.sellAllCommon(this.g.player);
    this.afterTrade();
  }

  /** The trade itself (and its log line / save) happens in the simulation; just refresh the panels. */
  private afterTrade(): void {
    this.markInventory();
    this.renderShopMoney();
  }

  // ------------------------------------------------------------ blacksmith

  private openForge(): void {
    this.closeShop();
    this.forgeOpen = true;
    this.forgeSel = this.g.player.equipment.weapon?.uid ?? null;
    $('forge-result').textContent = '';
    $('forge').classList.remove('hidden');
    this.renderForge();
  }

  private closeForge(): void {
    if (!this.forgeOpen) return;
    this.forgeOpen = false;
    $('forge').classList.add('hidden');
  }

  private forgeWeapons(): Item[] {
    const p = this.g.player;
    const list: Item[] = [];
    if (p.equipment.weapon) list.push(p.equipment.weapon);
    for (const it of p.bag) if (it && it.slot === 'weapon') list.push(it);
    return list;
  }

  private renderForge(): void {
    const p = this.g.player;
    const list = this.forgeWeapons();
    let item = list.find((w) => w.uid === this.forgeSel);
    if (!item) {
      item = list[0];
      this.forgeSel = item?.uid ?? null;
    }
    $('forge-list').innerHTML = list.length
      ? list.map((w) => this.itemCell(w, `data-uid="${w.uid}" title="${itemName(w)}${w === p.equipment.weapon ? ' (สวมใส่อยู่)' : ''}"`, '', w === item)).join('')
      : '<span class="hint">ไม่มีอาวุธ</span>';
    const go = $<HTMLButtonElement>('forge-go');
    if (!item) {
      $('forge-detail').innerHTML = '<span class="hint">เก็บอาวุธไว้ในกระเป๋าหรือสวมใส่ไว้ แล้วกลับมาใหม่</span>';
      go.disabled = true;
      return;
    }
    const cur = plusOf(item);
    const head = `<div class="fd-name" style="color:${RARITY_COLOR[item.rarity]}">${itemName(item)}</div>` +
      `<div class="hint" style="margin:0 0 4px">${item === p.equipment.weapon ? 'สวมใส่อยู่' : 'อยู่ในกระเป๋า'} · iLv.${item.level}</div>`;
    if (cur >= MAX_PLUS) {
      $('forge-detail').innerHTML = `${head}<div class="up">ตีบวกถึงระดับสูงสุด +${MAX_PLUS} แล้ว</div>`;
      go.disabled = true;
      go.textContent = 'ระดับสูงสุดแล้ว';
      return;
    }
    const now = effectiveStats(item);
    const next = effectiveStats(item, cur + 1);
    const cost = enhanceCost(item);
    const rate = Math.round(successRate(item) * 100);
    const row = (label: string, a: number, b: number, unit = '') =>
      `<div class="fd-row"><span>${label}</span><span>${fmtNum(a)}${unit} → <span class="up">${fmtNum(b)}${unit}</span></span></div>`;
    $('forge-detail').innerHTML = head +
      `<div class="fd-row"><span>ระดับ</span><b>+${cur} → +${cur + 1}</b></div>` +
      row('พลังโจมตี', now.atk ?? 0, next.atk ?? 0) +
      row('โอกาสคริติคอล', now.crit ?? 0, next.crit ?? 0, '%') +
      `<div class="fd-row"><span>โอกาสสำเร็จ</span><b class="${rate < 100 ? 'bad' : ''}">${rate}%</b></div>` +
      `<div class="fd-row"><span>ค่าตีบวก</span><b class="${p.gold < cost ? 'bad' : ''}">${cost.toLocaleString()} G</b></div>` +
      (dropsOnFail(item)
        ? `<div class="warn">⚠ ถ้าล้มเหลว จะเสียทองและระดับลดลงเหลือ +${cur - 1}</div>`
        : `<div class="safe">ถ้าล้มเหลว เสียแค่ทอง ระดับเท่าเดิม</div>`);
    go.disabled = p.gold < cost;
    go.textContent = p.gold < cost ? `ทองไม่พอ (มี ${p.gold.toLocaleString()} G)` : `🔨 ตีบวก (${cost.toLocaleString()} G)`;
  }

  private enhance(): void {
    if (!this.forgeSel) return;
    const out = this.g.sim.enhance(this.g.player, this.forgeSel);
    if (!out) return;
    const { result, item } = out;
    const res = $('forge-result');
    if (result === 'success') {
      res.className = 'ok';
      res.textContent = `สำเร็จ! ${itemName(item)}`;
    } else {
      res.className = 'fail';
      res.textContent = result === 'drop' ? `ล้มเหลว! ระดับลดลงเหลือ +${plusOf(item)}` : 'ล้มเหลว… ระดับเท่าเดิม';
    }
    this.markInventory();
    this.renderForge();
  }

  private rateTable(): string {
    let html = '<table><tr><th>บวก</th><th>สำเร็จ</th><th>ถ้าล้ม</th></tr>';
    const probe: Item = { uid: '', baseId: '', name: '', slot: 'weapon', rarity: 'common', level: 1, stats: { atk: 10 }, value: 0 };
    for (let t = 1; t <= MAX_PLUS; t++) {
      probe.plus = t - 1;
      html += `<tr><td>+${t}</td><td>${Math.round(successRate(probe) * 100)}%</td><td>${t >= DROP_ON_FAIL_FROM ? 'ระดับ −1' : 'เสียแค่ทอง'}</td></tr>`;
    }
    return html + '</table><div class="hint">ทุกระดับเพิ่มพลังโจมตีและโอกาสคริติคอลของอาวุธ</div>';
  }

  private itemCell(item: Item | null | undefined, attrs: string, placeholder = '', selected = false): string {
    if (!item) return `<div class="cell empty" ${attrs}>${placeholder}</div>`;
    const icon = item.slot === 'weapon'
      ? { sword: '🗡️', mage: '🪄', gunslinger: '🔫' }[this.g.player.cls.id]
      : SLOT_ICON[item.slot];
    const plus = plusOf(item) ? `<span class="iplus">+${plusOf(item)}</span>` : '';
    return `<div class="cell r-${item.rarity}${selected ? ' sel' : ''}" ${attrs} style="--rc:${RARITY_COLOR[item.rarity]}">${icon}${plus}<span class="ilv">${item.level}</span></div>`;
  }

  private renderInventory(): void {
    this.invDirty = false;
    const p = this.g.player;
    $('equip-slots').innerHTML = SLOTS.map((s) =>
      `<div class="eq-row"><span class="eq-label">${SLOT_LABEL[s]}</span>${this.itemCell(p.equipment[s], `data-slot="${s}"`, `<span class="ph">${SLOT_ICON[s]}</span>`)}</div>`,
    ).join('');
    $('bag-grid').innerHTML = p.bag.map((it, i) => this.itemCell(it, `data-i="${i}"`)).join('');
    const fmt = (k: StatKey, v: number) =>
      k === 'hpRegen' || k === 'mpRegen' ? v.toFixed(1) : String(Math.round(v));
    $('stat-list').innerHTML = STAT_KEYS.map((k) =>
      `<div class="stat"><span>${STAT_LABEL[k]}</span><b>${fmt(k, p.stats[k])}</b></div>`,
    ).join('');
    $('inv-gold').textContent = `💰 ${p.gold.toLocaleString()} G`;
    $('inv-pots').textContent = `❤️ ${p.hpPots}  💧 ${p.mpPots}`;
    $('bag-hint').textContent = this.shopOpen
      ? 'คลิกซ้าย = สวมใส่ · คลิกขวา = ขายให้พ่อค้า · คลิกช่องสวมใส่ = ถอด'
      : 'คลิกซ้าย = สวมใส่ · คลิกขวา = วางลงพื้น · คลิกช่องสวมใส่ = ถอด · ขายของได้ที่พ่อค้าเท่านั้น';
  }

  private showTip(item: Item, e: MouseEvent, hint: string): void {
    const tip = $('tooltip');
    const p = this.g.player;
    const eq = p.equipment[item.slot];
    const stats = effectiveStats(item);
    const eqStats = eq ? effectiveStats(eq) : {};
    const lines = (Object.keys(stats) as StatKey[]).map((k) => {
      const v = Math.round((stats[k] ?? 0) * 10) / 10;
      let diff = '';
      if (eq && eq !== item) {
        const d = v - (eqStats[k] ?? 0);
        if (Math.abs(d) > 0.05) diff = ` <span class="${d > 0 ? 'up' : 'down'}">(${d > 0 ? '+' : ''}${Math.round(d * 10) / 10})</span>`;
      }
      return `<div>+${v} ${STAT_LABEL[k]}${diff}</div>`;
    }).join('');
    tip.innerHTML =
      `<div class="tt-name" style="color:${RARITY_COLOR[item.rarity]}">${itemName(item)}</div>` +
      `<div class="tt-sub">${RARITY_LABEL[item.rarity]} · ${SLOT_LABEL[item.slot]} · iLv.${item.level}${plusOf(item) ? ` · ตีบวก +${plusOf(item)}` : ''}</div>` +
      `<div class="tt-stats">${lines || '<div>—</div>'}</div>` +
      `<div class="tt-hint">${hint}</div><div class="tt-val">ขายให้พ่อค้าได้ ${sellValue(item)} G</div>`;
    tip.classList.remove('hidden');
    const x = Math.min(e.clientX + 16, window.innerWidth - tip.offsetWidth - 8);
    const y = Math.min(e.clientY + 16, window.innerHeight - tip.offsetHeight - 8);
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  private hideTip(): void {
    $('tooltip').classList.add('hidden');
  }

  // ------------------------------------------------------------ log / overlays

  log(msg: string, color = '#e8e2d0'): void {
    const el = document.createElement('div');
    el.className = 'log-line';
    el.style.color = color;
    el.textContent = msg;
    const box = $('log');
    box.append(el);
    while (box.children.length > 7) box.firstChild?.remove();
    setTimeout(() => el.classList.add('fade'), 7000);
  }

  logItem(item: Item): void {
    this.log(`ได้รับ [${itemName(item)}] (${RARITY_LABEL[item.rarity]})`, RARITY_COLOR[item.rarity]);
  }

  showDeath(): void {
    $('death').classList.remove('hidden');
  }

  hideDeath(): void {
    $('death').classList.add('hidden');
  }

  openDialog(): void {
    this.dialogOpen = true;
    this.dialogIdx = 0;
    $('dialog').classList.remove('hidden');
    this.renderDialog();
  }

  private renderDialog(): void {
    $('dialog-text').textContent = SEEKER_LINES[this.dialogIdx];
    $('dialog-next').textContent = this.dialogIdx < SEEKER_LINES.length - 1 ? 'คลิกเพื่ออ่านต่อ ▸' : 'คลิกเพื่อออกเดินทาง ▸';
  }

  private advanceDialog(): void {
    this.dialogIdx++;
    if (this.dialogIdx >= SEEKER_LINES.length) this.closeDialog();
    else this.renderDialog();
  }

  private closeDialog(): void {
    this.dialogOpen = false;
    $('dialog').classList.add('hidden');
    if (!this.g.metSeeker) {
      this.g.metSeeker = true;
      this.g.save();
      const boss = MONSTERS[this.g.zone.boss.monster];
      this.log(`ภารกิจ: ฝึกฝนในป่ามรกต แล้วปราบ ${boss.name}`, '#ffd34a');
    }
  }
}
