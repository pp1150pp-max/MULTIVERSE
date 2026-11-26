// LEGACY (owner 2026-11-26): the old separate window, used only while /admin turns the tabbed settings page off
// (fxLayer.settingsTabs). Kept as it was before the tabs; the tabbed page draws the same settings in sysmenu.ts.
// The players' graphics window (owner 2026-11-18): opened from the in-game menu (เมนู → กราฟิก). The choices are
// kept in this browser (src/client/gfxPrefs.ts) and take effect at once; /admin caps the quality.
import {
  gfxHitstopOn, gfxMax, gfxOthersPick, gfxOwnNumsOnly, gfxQuality, gfxShader, gfxShakeOn, isSoftwareRender, setGfxPrefs,
  type GfxLevel, type GfxOthers,
} from '../gfxPrefs';
import type { ShaderLevel } from '../../shared/fxLayerTuning';
import { currentBalance } from '../../shared/balance';

const CSS = `
#gfx-panel { right: 168px; top: 56px; width: min(300px, 92vw); font-size: 13px; z-index: 5; }
#gfx-panel .gfx-row { margin-top: 10px; }
#gfx-panel .gfx-label { color: var(--ink-dim); margin-bottom: 4px; }
#gfx-panel .gfx-seg { display: flex; gap: 4px; }
#gfx-panel .gfx-seg button { flex: 1; padding: 4px 0; }
#gfx-panel .gfx-seg button.on { outline: 2px solid var(--gold); color: var(--gold); }
#gfx-panel .gfx-seg button:disabled { opacity: 0.35; cursor: not-allowed; }
#gfx-panel .gfx-note { color: var(--ink-dim); font-size: 11px; margin-top: 4px; }
`;

type Row = { label: string; opts: Array<[string, () => boolean, () => void, (() => boolean)?]>; note?: () => string; show?: () => boolean };

let panel: HTMLDivElement | null = null;
let render = (): void => {};

function build(): HTMLDivElement | null {
  const hud = document.getElementById('hud');
  if (!hud) return null;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const el = document.createElement('div');
  el.id = 'gfx-panel';
  el.className = 'panel hidden';
  hud.append(el);

  const q = (n: GfxLevel): [string, () => boolean, () => void, () => boolean] =>
    [['ปิด', 'ต่ำ', 'กลาง', 'สูง'][n], () => gfxQuality() === n, () => setGfxPrefs({ quality: n }), () => n <= gfxMax()];
  const o = (n: GfxOthers): [string, () => boolean, () => void] =>
    [['ปิด', 'ครึ่ง', 'เต็ม'][n], () => gfxOthersPick() === n, () => setGfxPrefs({ others: n })];
  const sh = (n: ShaderLevel): [string, () => boolean, () => void, () => boolean] =>
    [['ปิด', 'ต่ำ', 'สูง'][n], () => gfxShader() === n, () => setGfxPrefs({ shader: n }),
      () => n === 0 || (!isSoftwareRender() && n <= currentBalance().fxLayer.shaderMax)];
  const rows: Row[] = [
    { label: 'คุณภาพอนุภาค', opts: [q(3), q(2), q(1), q(0)],
      note: () => (gfxMax() < 3 ? `เซิร์ฟเวอร์ให้เลือกได้ถึง "${['ปิด', 'ต่ำ', 'กลาง', 'สูง'][gfxMax()]}"` : 'ปิด = ไม่มีอนุภาคเสริม ภาพสกิลหลักยังอยู่') },
    { label: 'น้ำ ลม และแสง', opts: [sh(2), sh(1), sh(0)], show: () => currentBalance().fxLayer.shader,
      note: () => (isSoftwareRender() ? 'เบราว์เซอร์กำลังวาดด้วย CPU จึงปิดไว้' : 'ปิด = ภาพนิ่งแบบเดิม · ตอนนี้มีผลกับน้ำและทะเลเมฆ') },
    { label: 'อนุภาคของผู้เล่นคนอื่น', opts: [o(2), o(1), o(0)] },
    { label: 'จอสั่น', opts: [['เปิด', () => gfxShakeOn(), () => setGfxPrefs({ shake: true })], ['ปิด', () => !gfxShakeOn(), () => setGfxPrefs({ shake: false })]] },
    { label: 'ภาพค้างตอนตีโดน', opts: [['เปิด', () => gfxHitstopOn(), () => setGfxPrefs({ hitstop: true })], ['ปิด', () => !gfxHitstopOn(), () => setGfxPrefs({ hitstop: false })]] },
    { label: 'เลขดาเมจ', opts: [
      ['ทั้งหมด', () => !gfxOwnNumsOnly(), () => setGfxPrefs({ ownNums: false }), () => !currentBalance().fxLayer.ownNumsOnly],
      ['เฉพาะของเรา', () => gfxOwnNumsOnly(), () => setGfxPrefs({ ownNums: true })],
    ], note: () => (currentBalance().fxLayer.ownNumsOnly ? 'เซิร์ฟเวอร์ตั้งให้เห็นเฉพาะของเราอยู่แล้ว' : '') },
  ];

  render = () => {
    el.replaceChildren();
    const head = document.createElement('div');
    head.className = 'panel-head';
    const title = document.createElement('span');
    title.textContent = 'กราฟิก';
    const close = document.createElement('button');
    close.textContent = '✕';
    close.onclick = () => el.classList.add('hidden');
    head.append(title, close);
    el.append(head);
    for (const r of rows) {
      if (r.show && !r.show()) continue;
      const row = document.createElement('div');
      row.className = 'gfx-row';
      const label = document.createElement('div');
      label.className = 'gfx-label';
      label.textContent = r.label;
      const seg = document.createElement('div');
      seg.className = 'gfx-seg';
      for (const [text, isOn, pick, allowed] of r.opts) {
        const b = document.createElement('button');
        b.textContent = text;
        if (isOn()) b.classList.add('on');
        b.disabled = allowed ? !allowed() : false;
        b.onclick = () => { pick(); render(); b.blur(); };
        seg.append(b);
      }
      row.append(label, seg);
      const note = r.note?.();
      if (note) {
        const n = document.createElement('div');
        n.className = 'gfx-note';
        n.textContent = note;
        row.append(n);
      }
      el.append(row);
    }
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') el.classList.add('hidden');
  });
  return el;
}

/** Opens (or closes) the window, built the first time. */
export function toggleGfxPanel(show?: boolean): void {
  panel ??= build();
  if (!panel) return;
  render();
  panel.classList.toggle('hidden', show === undefined ? !panel.classList.contains('hidden') : !show);
}
