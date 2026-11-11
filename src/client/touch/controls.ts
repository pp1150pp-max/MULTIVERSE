// On-screen buttons for touch play (mobile plan 3.1–3.2). They only show while <body> has `touch-ui`
// (touch/device.ts), and they work by writing into the same Input the keyboard does: holding the Q button
// holds KeyQ, the dash button taps Space, and so on, so the game reacts exactly as it does on PC.
// Walking (the joystick), taps on the game and pinch zoom are in touch/gestures.ts.
import type { Game } from '../Game';
import { potionIcon, skillIcon, stoneIcon } from '../icons';
import { POTION_SIZES, POTION_SIZE_LABEL, potionName } from '../../shared/data/potions';
import { isPotion, type PotionKind, type PotionSize } from '../../shared/types';
import type { SkillSlot } from '../../shared/data/classes';
import { isTouchMode, onPointerModeChange } from './device';

/** The virtual key the attack button holds down (read by Game.manualIntent as "basic attack"). */
export const TOUCH_ATTACK = 'TouchAttack';

/** Holding a potion button this long opens the size picker instead of drinking (owner 2026-11-11). */
const POTION_HOLD_MS = 450;

const POTION_CD = 1.5;

const art = (name: string): string => `<img src="assets/sprites/ui/touch/${name}.png" alt="" draggable="false">`;
const badgeArt = (name: string): string => `<img src="assets/sprites/ui/ico_${name}.png" alt="" draggable="false">`;

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

  constructor(private readonly g: Game) {
    const p = g.player;
    const skillArt = (slot: SkillSlot): string => {
      const s = p.skill(slot);
      return s ? skillIcon(s.id) : '';
    };
    this.root = document.createElement('div');
    this.root.id = 'touch-ui';
    this.root.innerHTML = `
      <div id="tc-stick" class="hidden">${art('stick_base')}<div id="tc-knob">${art('stick_knob')}</div></div>
      <button id="tc-menu" class="tc-btn tc-small" aria-label="เมนู"><span class="tc-ico">${badgeArt('menu')}</span><i class="badge hidden" data-badge="เมนู"></i></button>
      <button id="tc-chat" class="tc-btn tc-small" aria-label="แชท"><span class="tc-ico">${art('icon_chat')}</span></button>
      <div id="tc-pad">
        <button class="tc-btn tc-attack" data-slot="basic"><span class="tc-ico">${skillArt('basic')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button class="tc-btn tc-skill" data-slot="q"><span class="tc-ico">${skillArt('q')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button class="tc-btn tc-skill" data-slot="e"><span class="tc-ico">${skillArt('e')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button class="tc-btn tc-skill" data-slot="r"><span class="tc-ico">${skillArt('r')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button class="tc-btn tc-skill" data-slot="dash"><span class="tc-ico">${art('icon_dash')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button class="tc-btn tc-small tc-pot" data-pot="hp"><span class="tc-ico">${potionIcon('hp')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button class="tc-btn tc-small tc-pot" data-pot="mp"><span class="tc-ico">${potionIcon('mp')}<div class="tc-cd"></div></span><span class="tc-num"></span></button>
        <button id="tc-auto" class="tc-btn tc-skill"><span class="tc-ico">${badgeArt('auto')}</span><span class="tc-label">AUTO</span></button>
        <button id="tc-autoset" class="tc-btn tc-mini" aria-label="ตั้งค่า Auto"><span class="tc-ico">${badgeArt('autoset')}</span></button>
        <button id="tc-scroll" class="tc-btn tc-small" aria-label="ม้วนคัมภีร์กลับเมือง"><span class="tc-ico">${stoneIcon('return_scroll')}</span><span class="tc-num"></span></button>
        <button id="tc-mount" class="tc-btn tc-small" aria-label="สัตว์ขี่"><span class="tc-ico">${art('icon_mount')}</span></button>
        <button id="tc-talk" class="tc-btn tc-talk hidden"><span class="tc-ico">${art('icon_talk')}</span><span class="tc-label">คุย/ใช้</span></button>
      </div>
      <div id="tc-potpick" class="hidden"></div>`;
    document.getElementById('hud')!.append(this.root);
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
    // Attack and skills: held down for as long as the finger stays on them (as on PC).
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-slot]')) {
      const slot = el.dataset.slot as SkillSlot;
      const code = slot === 'basic' ? TOUCH_ATTACK : slot === 'dash' ? '' : `Key${slot.toUpperCase()}`;
      this.skills.push({ slot, el, cd: el.querySelector('.tc-cd')!, num: el.querySelector('.tc-num')! });
      if (slot === 'dash') this.hold(el, () => input.tap('Space'));
      else this.hold(el, () => input.press(code), () => input.release(code));
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
    this.hold(q('#tc-autoset'), () => document.getElementById('btn-auto-set')?.click());
    this.hold(this.scrollBtn, () => input.tap('KeyG'));
    this.hold(this.mountBtn, () => input.tap('KeyZ'));
    this.hold(this.talkBtn, () => input.tap('KeyT'));
    this.hold(q('#tc-chat'), () => g.hud.openChat());
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
      el.setPointerCapture(e.pointerId);
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

  /** Everything let go (switching apps, typing, back to the mouse). */
  private reset(): void {
    for (const el of this.root.querySelectorAll<HTMLElement>('.down')) el.classList.remove('down');
    this.hideStick();
    this.closePicker();
  }

  // ------------------------------------------------------------ joystick (driven by gestures.ts)

  showStick(x: number, y: number): void {
    this.stick.style.left = `${x}px`;
    this.stick.style.top = `${y}px`;
    this.knob.style.transform = '';
    this.stick.classList.remove('hidden');
  }

  moveKnob(dx: number, dy: number): void {
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  hideStick(): void {
    this.stick.classList.add('hidden');
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
      s.el.classList.toggle('nomp', !!sk && p.mp < sk.mp);
    }
    for (const b of this.potions) {
      const size = p.potionToUse(b.kind) ?? p.potSel[b.kind];
      const count = p.potionCount(b.kind, size);
      const txt = String(count);
      if (b.num.textContent !== txt) b.num.textContent = txt;
      const src = `assets/sprites/icons/potion_${b.kind}_${size}.png`;
      if (b.img && b.img.getAttribute('src') !== src) b.img.setAttribute('src', src);
      b.cd.style.height = `${(Math.max(0, p.potCd) / POTION_CD) * 100}%`;
      b.el.classList.toggle('empty', count <= 0);
    }
    this.autoBtn.classList.toggle('active', g.autoPlay);
    this.talkBtn.classList.toggle('hidden', !g.talkReady);
    const scrolls = p.stoneCount('return_scroll');
    const st = String(scrolls);
    if (this.scrollNum.textContent !== st) this.scrollNum.textContent = st;
    this.scrollBtn.classList.toggle('empty', scrolls < 1);
    // The mount button only when the player has a mount (the PC mount button decides that).
    this.mountBtn.classList.toggle('hidden', !!document.getElementById('mount-btn')?.classList.contains('hidden'));
  }
}

