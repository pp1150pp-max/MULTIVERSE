// On-screen buttons for touch play (mobile plan 3.1–3.2; no chat or Auto-settings buttons — owner 2026-11-11; "พูดคุย" only near an NPC — owner 2026-11-12). They only show while <body> has `touch-ui`
// (touch/device.ts), and they work by writing into the same Input the keyboard does: holding the Q button
// holds KeyQ, the dash button taps Space, and so on, so the game reacts exactly as it does on PC.
// Walking (the joystick), taps on the game and pinch zoom are in touch/gestures.ts.
import type { Game } from '../Game';
import { potionIcon, skillIcon, stoneIcon } from '../icons';
import { POTION_SIZES, POTION_SIZE_LABEL, potionName } from '../../shared/data/potions';
import { isPotion, type PotionKind, type PotionSize } from '../../shared/types';
import type { SkillSlot } from '../../shared/data/classes';
import { isTouchMode, onPointerModeChange } from './device';
import { imgUrl } from '../img';
import type { Vec2 } from '../../shared/types';

/** The virtual key the attack button holds down (read by Game.manualIntent as "basic attack"). */
export const TOUCH_ATTACK = 'TouchAttack';

/** Holding a potion button this long opens the size picker instead of drinking (owner 2026-11-11). */
const POTION_HOLD_MS = 450;

const POTION_CD = 1.5;

/** Drag-to-aim (mobile plan 3.3, PR 3): a finger dragged this far (px) off a skill button starts aiming. */
const AIM_DRAG_PX = 12;
/** How long a released aimed skill keeps its key down, so the next input sent to the server carries it. */
const CAST_HOLD_MS = 120;

/**
 * Skills that can be aimed by dragging, by skill id: the reach of the aim line (world units, as the server
 * uses it), a ring at the line's end for skills that burst there, or `spot` for skills that land on a point
 * (the circle goes as far as the finger drags). Skills around the player (Whirlwind, Earthquake, Frost Nova)
 * and the Swordsman's Slash are not listed: they have no aiming, as before.
 */
const AIM: Record<string, { range: number; burst?: number; spot?: boolean }> = {
  bolt: { range: 11 },
  shot: { range: 12 },
  charge: { range: 7 },
  fireball: { range: 12, burst: 2.6 },
  meteor: { range: 12, burst: 3.5, spot: true },
  rapidfire: { range: 12 },
  pierce: { range: 16 },
  headshot: { range: 18 },
};
type AimSpec = (typeof AIM)[string];

const art = (name: string): string => `<img src="${imgUrl(`assets/sprites/ui/touch/${name}.png`)}" alt="" draggable="false">`;
const badgeArt = (name: string): string => `<img src="${imgUrl(`assets/sprites/ui/ico_${name}.png`)}" alt="" draggable="false">`;

interface SkillButton { slot: SkillSlot; el: HTMLElement; cd: HTMLElement; num: HTMLElement }
interface PotionButton { kind: PotionKind; el: HTMLElement; cd: HTMLElement; num: HTMLElement; img: HTMLImageElement | null }

export class TouchControls {
  private readonly root: HTMLElement;
  private readonly stick: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly picker: HTMLElement;
  private readonly skills: SkillButton[] = [];
  private readonly potions: PotionButton[] = [];
  private readonly autoBtn: HTMLElement;
  private readonly talkBtn: HTMLElement;
  private readonly scrollBtn: HTMLElement;
  private readonly scrollNum: HTMLElement;
  private readonly mountBtn: HTMLElement;
  /** The button a finger is dragging off to aim, and the aimed offset from the player (null = back on the button: cancel). */
  private aim: { slot: SkillSlot; spec: AimSpec; offset: Vec2 | null } | null = null;

  constructor(private readonly g: Game) {
    const p = g.player;
    const skillArt = (slot: SkillSlot): string => {
      const s = p.skill(slot);
      return s ? skillIcon(s.id) : '';
    };
    this.root = document.createElement('div');
    this.root.id = 'touch-ui';
    this.root.innerHTML = `
      <div id="tc-stick">${art('stick_base')}<div id="tc-knob">${art('stick_knob')}</div></div>
      <button id="tc-menu" class="tc-btn tc-small" aria-label="เมนู"><span class="tc-ico">${badgeArt('menu')}</span><i class="badge hidden" data-badge="เมนู"></i></button>
      <div id="tc-pad">
        <button class="tc-btn tc-attack" data-slot="basic"><span class="tc-ico">${skillArt('basic')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button class="tc-btn tc-skill" data-slot="q"><span class="tc-ico">${skillArt('q')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button class="tc-btn tc-skill" data-slot="e"><span class="tc-ico">${skillArt('e')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button class="tc-btn tc-skill" data-slot="r"><span class="tc-ico">${skillArt('r')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button class="tc-btn tc-skill" data-slot="dash"><span class="tc-ico">${art('icon_dash')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button class="tc-btn tc-small tc-pot" data-pot="hp"><span class="tc-ico">${potionIcon('hp')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button class="tc-btn tc-small tc-pot" data-pot="mp"><span class="tc-ico">${potionIcon('mp')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button id="tc-talk" class="tc-btn tc-talk hidden"><span class="tc-ico">${art('icon_talk')}</span><span class="tc-label">พูดคุย</span></button>
        <button id="tc-auto" class="tc-btn tc-skill"><span class="tc-ico">${badgeArt('auto')}</span><span class="tc-label">AUTO</span></button>
        <button id="tc-scroll" class="tc-btn tc-small" aria-label="ม้วนคัมภีร์กลับเมือง"><span class="tc-ico">${stoneIcon('return_scroll')}</span><span class="tc-num"></span></button>
        <button id="tc-mount" class="tc-btn tc-small" aria-label="สัตว์ขี่"><span class="tc-ico">${art('icon_mount')}</span></button>
      </div>
      <div id="tc-potpick" class="hidden"></div>`;
    document.getElementById('hud')!.prepend(this.root);
    const q = <T extends HTMLElement = HTMLElement>(sel: string) => this.root.querySelector<T>(sel)!;
    this.stick = q('#tc-stick');
    this.knob = q('#tc-knob');
    this.picker = q('#tc-potpick');
    this.autoBtn = q('#tc-auto');
    this.talkBtn = q('#tc-talk');
    this.scrollBtn = q('#tc-scroll');
    this.scrollNum = q('#tc-scroll .tc-num');
    this.mountBtn = q('#tc-mount');

    const input = g.input;
    this.hold(this.talkBtn, () => input.tap('KeyT'));
    // Attack and skills: held down for as long as the finger stays on them (as on PC).
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-slot]')) {
      const slot = el.dataset.slot as SkillSlot;
      const code = slot === 'basic' ? TOUCH_ATTACK : slot === 'dash' ? '' : `Key${slot.toUpperCase()}`;
      this.skills.push({ slot, el, cd: el.querySelector('.tc-cd')!, num: el.querySelector('.tc-num')! });
      if (slot === 'dash') this.hold(el, () => input.tap('Space'));
      else this.aimButton(el, slot, code);
    }
    // Potions: a tap drinks the chosen size, holding opens the size picker.
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-pot]')) {
      const kind = el.dataset.pot as PotionKind;
      this.potions.push({ kind, el, cd: el.querySelector('.tc-cd')!, num: el.querySelector('.tc-num')!, img: el.querySelector('img') });
      let timer = 0;
      this.hold(el, () => {
        timer = window.setTimeout(() => {
          timer = 0;
          this.openPicker(kind, el);
        }, POTION_HOLD_MS);
      }, () => {
        if (!timer) return;
        clearTimeout(timer);
        timer = 0;
        input.tap(kind === 'hp' ? 'Digit1' : 'Digit2');
      });
    }
    this.hold(this.autoBtn, () => g.toggleAuto());
    this.hold(this.scrollBtn, () => input.tap('KeyG'));
    this.hold(this.mountBtn, () => input.tap('KeyZ'));
    this.hold(q('#tc-menu'), () => g.sysMenu.toggle());

    // A finger anywhere else closes the potion picker.
    window.addEventListener('pointerdown', (e) => {
      if (!this.picker.classList.contains('hidden') && !(e.target as HTMLElement).closest('#tc-potpick, .tc-pot')) this.closePicker();
    }, true);
    // Typing (chat, prices…) or going back to the mouse lets go of every held button.
    document.addEventListener('focusin', (e) => {
      if ((e.target as HTMLElement).closest?.('input, textarea')) input.releaseAll();
    });
    onPointerModeChange(() => input.releaseAll());
    input.releaseHooks.push(() => this.reset());
  }

  /** `down` when a finger lands on the button, `up` when it lifts (or is taken away by the browser). */
  private hold(el: HTMLElement, down: () => void, up?: () => void): void {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      el.classList.add('down');
      down();
    });
    const lift = () => {
      if (!el.classList.contains('down')) return;
      el.classList.remove('down');
      up?.();
    };
    el.addEventListener('pointerup', lift);
    el.addEventListener('pointercancel', lift);
    el.addEventListener('lostpointercapture', lift);
  }

  /**
   * Attack and Q/E/R. Skills with nothing to aim (and the Swordsman's Slash) work as before: held down for as long
   * as the finger stays on them. An aimable skill fires when the finger lifts: a tap fires at the locked or nearest
   * monster, dragging more than AIM_DRAG_PX off the button aims it (line or ground circle), lifting fires it that
   * way, and dragging back onto the button cancels. The ranged basic attacks (Arcane Bolt, Quick Shot) fire for as
   * long as they are held, toward the finger while it is dragged off the button (owner 2026-11-12).
   */
  private aimButton(el: HTMLElement, slot: SkillSlot, code: string): void {
    const input = this.g.input;
    const basic = slot === 'basic';
    let spec: AimSpec | undefined;
    let cx = 0;
    let cy = 0;
    let dragging = false;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      el.classList.add('down');
      const r = el.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      dragging = false;
      spec = AIM[this.g.player.skill(slot)?.id ?? ''];
      if (basic || !spec) input.press(code);
    });
    el.addEventListener('pointermove', (e) => {
      if (!spec || !el.classList.contains('down')) return;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (!dragging && len <= AIM_DRAG_PX) return;
      dragging = true;
      const back = len < el.offsetWidth / 2;
      el.classList.toggle('aim-cancel', back);
      this.aim = { slot, spec, offset: back ? null : this.g.dragAimOffset(dx, dy, spec.range, !!spec.spot) };
    });
    const lift = () => {
      if (!el.classList.contains('down')) return;
      el.classList.remove('down', 'aim-cancel');
      const mine = this.aim?.slot === slot;
      const offset = mine ? this.aim!.offset : null;
      if (mine) this.endAim();
      if (basic || !spec) input.release(code);
      else if (!dragging) this.castOnce(code, null);
      else if (offset) this.castOnce(code, offset);
    };
    el.addEventListener('pointerup', lift);
    el.addEventListener('pointercancel', lift);
    el.addEventListener('lostpointercapture', lift);
  }

  /** Fires a skill once: its key held briefly, aimed at the player plus `offset` (or the usual target when null). */
  private castOnce(code: string, offset: Vec2 | null): void {
    const input = this.g.input;
    const p = this.g.player;
    const at = offset ? { x: p.x + offset.x, z: p.z + offset.z } : null;
    input.aimOverride = at;
    input.press(code);
    window.setTimeout(() => {
      input.release(code);
      if (at && input.aimOverride === at) input.aimOverride = null;
    }, CAST_HOLD_MS);
  }

  private endAim(): void {
    this.aim = null;
    this.g.aimGuide.hide();
    this.g.input.aimOverride = null;
  }

  /** Everything let go (switching apps, typing, back to the mouse). */
  private reset(): void {
    this.endAim();
    for (const el of this.root.querySelectorAll<HTMLElement>('.down')) el.classList.remove('down', 'aim-cancel');
    this.centreKnob();
    this.closePicker();
  }

  // ------------------------------------------------------------ joystick (driven by gestures.ts)

  /** Centre of the joystick on screen (it stays in the bottom-left corner). */
  stickCentre(): { x: number; y: number } {
    const r = this.stick.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  moveKnob(dx: number, dy: number): void {
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  /** The knob back in the middle. */
  centreKnob(): void {
    this.knob.style.transform = '';
  }

  /** How far (px) the knob can travel from the centre: the stick's own drawn radius. */
  get stickRadius(): number {
    return Math.max(30, this.stick.offsetWidth * 0.4) || 48;
  }

  // ------------------------------------------------------------ potion size picker

  private openPicker(kind: PotionKind, from: HTMLElement): void {
    const p = this.g.player;
    this.picker.innerHTML = POTION_SIZES.map((size) => {
      const n = p.potionCount(kind, size);
      const sel = p.potSel[kind] === size ? ' sel' : '';
      return `<button class="tc-pick${sel}${n ? '' : ' empty'}" data-size="${size}">${potionIcon(kind, size)}<span>${POTION_SIZE_LABEL[size]} ${n}</span></button>`;
    }).join('');
    for (const b of this.picker.querySelectorAll<HTMLElement>('[data-size]')) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.pick(kind, b.dataset.size as PotionSize);
      });
    }
    const r = from.getBoundingClientRect();
    this.picker.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
    this.picker.style.bottom = `${window.innerHeight - r.top + 8}px`;
    this.picker.classList.remove('hidden');
  }

  /** Same as clicking that potion in the bag: the quick button uses this size from now on. */
  private pick(kind: PotionKind, size: PotionSize): void {
    const p = this.g.player;
    const i = p.bag.findIndex((e) => isPotion(e) && e.potion === kind && e.size === size);
    if (i < 0) {
      this.g.hud.log(`ไม่มี${potionName(kind, size)}ในกระเป๋า`, '#ff8a6a');
    } else {
      this.g.backend.equip(i);
      this.g.hud.log(`ปุ่มยาจะใช้${potionName(kind, size)}`, '#9fd8ff');
    }
    this.closePicker();
  }

  private closePicker(): void {
    this.picker.classList.add('hidden');
  }

  // ------------------------------------------------------------ per frame

  update(): void {
    if (!isTouchMode()) return;
    const g = this.g;
    const p = g.player;
    for (const s of this.skills) {
      const sk = p.skill(s.slot);
      const remain = p.cd[s.slot] ?? 0;
      s.cd.style.height = sk?.cooldown ? `${(remain / sk.cooldown) * 100}%` : '0%';
      const txt = remain > 0 && (sk?.cooldown ?? 0) > 1 ? remain.toFixed(remain < 10 ? 1 : 0) : '';
      if (s.num.textContent !== txt) s.num.textContent = txt;
      s.el.classList.toggle('nomp', !!sk && p.mp < p.skillMp(sk));
    }
    for (const b of this.potions) {
      const size = p.potionToUse(b.kind) ?? p.potSel[b.kind];
      const count = p.potionCount(b.kind, size);
      const txt = String(count);
      if (b.num.textContent !== txt) b.num.textContent = txt;
      const src = imgUrl(`assets/sprites/icons/potion_${b.kind}_${size}.png`);
      if (b.img && b.img.getAttribute('src') !== src) b.img.setAttribute('src', src);
      b.cd.style.height = `${(Math.max(0, p.potCd) / POTION_CD) * 100}%`;
      b.el.classList.toggle('empty', count <= 0);
    }
    this.drawAim();
    this.autoBtn.classList.toggle('active', g.autoPlay);
    this.talkBtn.classList.toggle('hidden', !g.talkReady);
    const scrolls = p.stoneCount('return_scroll');
    const st = String(scrolls);
    if (this.scrollNum.textContent !== st) this.scrollNum.textContent = st;
    this.scrollBtn.classList.toggle('empty', scrolls < 1);
    // The mount button only when the player has a mount (the PC mount button decides that).
    this.mountBtn.classList.toggle('hidden', !!document.getElementById('mount-btn')?.classList.contains('hidden'));
  }

  /** The aim guide follows the player while a finger aims; the ranged basic attack fires along it. */
  private drawAim(): void {
    const a = this.aim;
    const g = this.g;
    if (!a?.offset) {
      g.aimGuide.hide();
      if (a?.slot === 'basic') g.input.aimOverride = null;
      return;
    }
    const p = g.player;
    const { x: ox, z: oz } = a.offset;
    if (a.spec.spot) g.aimGuide.showCircle(p.x + ox, p.z + oz, a.spec.burst ?? 1);
    else g.aimGuide.showLine(p.x, p.z, Math.atan2(oz, ox), a.spec.range, a.spec.burst);
    if (a.slot === 'basic') g.input.aimOverride = { x: p.x + ox, z: p.z + oz };
  }
}

