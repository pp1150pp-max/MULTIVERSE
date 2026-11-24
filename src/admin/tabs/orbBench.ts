import { type AdminAnimLook, type AdminCosLook, type AdminOrbItems, type AdminOrbLook } from '../../shared/admin';
import { h, api, tab, view } from '../core';

// ------------------------------------------------------------ orb test bench

/** Stops the orb test bench (its renderer and frame loop) when another tab opens. */
let stopOrbs: (() => void) | null = null;

/** Stops the open bench (if any); setTab calls it whenever another tab opens. */
export function stopOrbBench(): void {
  stopOrbs?.();
  stopOrbs = null;
}

/**
 * The benches draw with the game's papercraft art (owner 2026-11-23: what /admin shows must match the game, e.g. the
 * paper orbs instead of the old code-made pixel ones). Set before the bench loads its pictures; the load is shared by
 * every bench on the page, so all four set it.
 */
async function gameArt(): Promise<void> {
  const { usePaperArt } = await import('../../client/assets');
  usePaperArt();
}

/** An orb look of the shop to open on the orb bench (the shop tab's "เปิดในแท่นทดลอง"), used once. */
let orbOpenId: string | undefined;
export function setOrbOpenId(id: string | undefined): void {
  orbOpenId = id;
}

/** The enhancement orb test bench (src/client/orbPreview.ts), loaded only when this tab opens. */
export async function renderOrbs(): Promise<void> {
  const open = orbOpenId;
  orbOpenId = undefined;
  const box = h('div', { class: 'orb-bench' }, 'กำลังโหลด…');
  view.append(box);
  try {
    await gameArt();
    const { mountOrbPreview } = await import('../../client/orbPreview');
    if (tab !== 'orbs' || !box.isConnected) return;
    const stop = await mountOrbPreview(box, 'ทดลองที่นี่ไม่เปลี่ยนอะไรในเกม จนกว่ากด "💾 บันทึกที่แก้" ด้านล่าง · เดิน: WASD / ลูกศร หรือคลิกพื้น', {
      load: () => api<AdminOrbLook>('GET', '/admin/orb-look'),
      save: (look) => api<AdminOrbLook>('POST', '/admin/orb-look', look === 'reset' ? { reset: true } : { look }),
      shop: {
        load: () => api<AdminOrbItems>('GET', '/admin/orb-items'),
        add: (name, look) => api<AdminOrbItems>('POST', '/admin/orb-items', { add: { name, look } }),
        overwrite: (id, look) => api<AdminOrbItems>('POST', '/admin/orb-items', { edit: { [id]: { look } } }),
        open,
      },
    });
    if (tab !== 'orbs' || !box.isConnected) stop();
    else stopOrbs = stop;
  } catch (e) {
    box.textContent = `โหลดไม่สำเร็จ: ${(e as Error).message}`;
  }
}

/** The cosmetics test bench (src/client/cosPreview.ts), loaded only when this tab opens. Stopped by setTab with the orb bench. */
export async function renderCos(): Promise<void> {
  const box = h('div', { class: 'orb-bench' }, 'กำลังโหลด…');
  view.append(box);
  try {
    await gameArt();
    const { mountCosPreview } = await import('../../client/cosPreview');
    if (tab !== 'cos' || !box.isConnected) return;
    const stop = await mountCosPreview(box, 'ทดลองที่นี่ไม่เปลี่ยนอะไรในเกม จนกว่าเจ้าของกด "บันทึกเป็นค่าเริ่มต้นทั้งเซิร์ฟ" · เดิน: WASD / ลูกศร หรือคลิกพื้น', {
      load: () => api<AdminCosLook>('GET', '/admin/cos-look'),
      save: (tuning) => api<AdminCosLook>('POST', '/admin/cos-look', tuning === 'reset' ? { reset: true } : { tuning }),
    });
    if (tab !== 'cos' || !box.isConnected) stop();
    else stopOrbs = stop;
  } catch (e) {
    box.textContent = `โหลดไม่สำเร็จ: ${(e as Error).message}`;
  }
}

/** The papercraft sword knight bench (src/client/rigPreview.ts), loaded only when this tab opens. Stopped by setTab. */
export async function renderRig(): Promise<void> {
  const box = h('div', { class: 'orb-bench' }, 'กำลังโหลด…');
  view.append(box);
  try {
    await gameArt();
    const { mountRigPreview } = await import('../../client/rigPreview');
    if (tab !== 'rig' || !box.isConnected) return;
    const stop = await mountRigPreview(box);
    if (tab !== 'rig' || !box.isConnected) stop();
    else stopOrbs = stop;
  } catch (e) {
    box.textContent = `โหลดไม่สำเร็จ: ${(e as Error).message}`;
  }
}

/** The character animation bench (src/client/animPreview.ts): every facing at once. Loaded only when this tab opens. */
export async function renderAnim(): Promise<void> {
  const box = h('div', { class: 'orb-bench' }, 'กำลังโหลด…');
  view.append(box);
  try {
    await gameArt();
    const { mountAnimPreview } = await import('../../client/animPreview');
    if (tab !== 'anim' || !box.isConnected) return;
    const stop = await mountAnimPreview(box, {
      load: () => api<AdminAnimLook>('GET', '/admin/anim-look'),
      save: (t) => api<AdminAnimLook>('POST', '/admin/anim-look', t === 'reset' ? { reset: true } : { tuning: t }),
    });
    if (tab !== 'anim' || !box.isConnected) stop();
    else stopOrbs = stop;
  } catch (e) {
    box.textContent = `โหลดไม่สำเร็จ: ${(e as Error).message}`;
  }
}
