// Puts the server's "จัดหน้าจอเกม" layout (src/shared/hudLayout.ts, `currentBalance().hudLayout`) on the page as one <style>.
// Checked every frame (cheap: the balance object only changes when the server sends a new one).
//
// ?previewHud=1 (the "ดูในเกม" button on /admin): the page asks for the draft with the player's own login
// (GET /api/admin/hud-layout, which needs the hudLayout tool) and shows it instead, in this tab only; a new `balance` from the
// server does not replace it. Without the tool the game simply shows the published layout. Nothing is stored.
import { currentBalance } from '../shared/balance';
import { hudLayoutCss, type HudLayoutConfig } from '../shared/hudLayout';
import type { AdminHudLayout } from '../shared/admin';

let preview: HudLayoutConfig | null = null;
let drawn: HudLayoutConfig | null = null;
let style: HTMLStyleElement | null = null;

/** Called every frame: redraws the stylesheet when the layout in use changed. */
export function updateHudLayout(): void {
  const cfg = preview ?? currentBalance().hudLayout;
  if (cfg === drawn) return;
  drawn = cfg;
  if (!style) {
    style = document.createElement('style');
    style.id = 'hud-layout-style';
    document.head.append(style);
  }
  style.textContent = hudLayoutCss(cfg);
}

/** Whether the page was opened with ?previewHud=1. */
export function hudPreviewParam(): boolean {
  try {
    return new URLSearchParams(location.search).get('previewHud') === '1';
  } catch {
    return false;
  }
}

/** Fetches the draft (or the published layout when there is no draft) and shows it in this tab. */
export async function loadHudPreview(token: string): Promise<void> {
  try {
    const r = await fetch('/api/admin/hud-layout', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return; // no hudLayout tool: play with the published layout
    const body = (await r.json()) as AdminHudLayout;
    preview = body.draft ?? body.published;
    showBanner(!!body.draft);
  } catch {
    /* network trouble: the published layout */
  }
}

function showBanner(isDraft: boolean): void {
  document.getElementById('hud-preview-banner')?.remove();
  const b = document.createElement('div');
  b.id = 'hud-preview-banner';
  b.textContent = isDraft ? 'ทดลองร่าง "จัดหน้าจอเกม" (เห็นเฉพาะคุณ) — ปิดแท็บนี้เพื่อจบ' : 'ไม่มีร่าง "จัดหน้าจอเกม": แสดงค่าที่เผยแพร่อยู่';
  Object.assign(b.style, {
    position: 'fixed', top: '4px', left: '50%', transform: 'translateX(-50%)', zIndex: '9999', padding: '3px 10px', borderRadius: '4px',
    background: 'rgba(120, 40, 10, 0.85)', color: '#ffe9c0', font: '12px sans-serif', pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.append(b);
}
