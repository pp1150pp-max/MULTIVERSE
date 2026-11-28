// The players' graphics settings (owner 2026-11-18): the กราฟิก tab of เมนู → ตั้งค่า (src/client/sysmenu.ts; until
// 2026-11-26 a window of its own). The choices are kept in this browser (src/client/gfxPrefs.ts) and take effect at once;
// /admin caps the quality and can hide the tab (fxLayer.gfxMenu).
import {
  gfxHitstopOn, gfxMax, gfxOthersPick, gfxOwnNumsOnly, gfxQuality, gfxShader, gfxShakeOn, isSoftwareRender, setGfxPrefs,
  type GfxLevel, type GfxOthers,
} from './gfxPrefs';
import type { ShaderLevel } from '../shared/fxLayerTuning';
import { currentBalance } from '../shared/balance';
import { setRow, setSelect, setSwitch } from './settingsUi';

const QUALITY = ['ปิด', 'ต่ำ', 'กลาง', 'สูง'];
const SHADER = ['ปิด', 'ต่ำ', 'สูง'];

/** Draws the graphics rows into `host`; `redraw` is called after a change. */
export function renderGfxSettings(host: HTMLElement, redraw: () => void): void {
  const max = gfxMax();
  const set = (p: Parameters<typeof setGfxPrefs>[0]) => { setGfxPrefs(p); redraw(); };
  host.append(
    setRow('คุณภาพอนุภาค',
      setSelect<GfxLevel>(([3, 2, 1, 0] as GfxLevel[]).map((n) => [n, QUALITY[n], n <= max]), gfxQuality(), (n) => set({ quality: n })),
      max < 3 ? `เซิร์ฟเวอร์ให้เลือกได้ถึง "${QUALITY[max]}"` : 'ปิด = ไม่มีอนุภาคเสริม ภาพสกิลหลักยังอยู่'),
    ...(currentBalance().fxLayer.shader ? [setRow('น้ำ ลม และแสง',
      setSelect<ShaderLevel>(([2, 1, 0] as ShaderLevel[]).map((n) => [n, SHADER[n], n === 0 || (!isSoftwareRender() && n <= currentBalance().fxLayer.shaderMax)]),
        gfxShader(), (n) => set({ shader: n })),
      isSoftwareRender() ? 'เบราว์เซอร์กำลังวาดด้วย CPU จึงปิดไว้' : 'ปิด = ภาพแบบเดิม · ตอนนี้มีผลกับน้ำ ลม และแสง')] : []),
    setRow('อนุภาคของผู้เล่นคนอื่น',
      setSelect<GfxOthers>([[2, 'เต็ม'], [1, 'ครึ่ง'], [0, 'ปิด']], gfxOthersPick(), (n) => set({ others: n }))),
    setRow('จอสั่น', setSwitch(gfxShakeOn(), (on) => set({ shake: on }))),
    setRow('ภาพค้างตอนตีโดน', setSwitch(gfxHitstopOn(), (on) => set({ hitstop: on }))),
    setRow('เลขดาเมจ',
      setSelect<'all' | 'own'>([['all', 'ทั้งหมด', !currentBalance().fxLayer.ownNumsOnly], ['own', 'เฉพาะของเรา']], gfxOwnNumsOnly() ? 'own' : 'all',
        (v) => set({ ownNums: v === 'own' })),
      currentBalance().fxLayer.ownNumsOnly ? 'เซิร์ฟเวอร์ตั้งให้เห็นเฉพาะของเราอยู่แล้ว' : undefined),
  );
}
