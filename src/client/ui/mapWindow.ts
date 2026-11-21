import type { Game } from '../Game';
import { FullMap } from '../fullmap';
import { $ } from './hudShared';

/** The full map window (M): click to walk there, right click for the player's own pin. The minimap stays in hud.ts. */
export class MapWindow {
  private fullMap: FullMap;
  private mapOpen = false;
  /** The player's own map pin. Only for the zone object it was placed in, so a new visit starts clean. Never saved. */
  private pin: { zone: object; x: number; z: number } | null = null;

  constructor(private readonly g: Game) {
    this.fullMap = new FullMap($<HTMLCanvasElement>('fullmap-canvas'));
    $('fullmap-close').onclick = () => this.toggleMap(false);
    $('fullmap-canvas').addEventListener('click', (e) => {
      const to = this.fullMap.toWorld(e.clientX, e.clientY);
      // The map stays open so you can watch the route; M, Esc or ✕ close it.
      this.g.walkTo(to.x, to.z);
    });
    // Right-click: put the pin there; right-click the pin itself to take it off.
    $('fullmap-canvas').addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const pin = this.myPin();
      if (pin && this.fullMap.onPin(e.clientX, e.clientY, pin)) {
        this.pin = null;
      } else {
        const to = this.fullMap.toWorld(e.clientX, e.clientY);
        const h = this.g.world.half;
        if (Math.abs(to.x) > h || Math.abs(to.z) > h) return;
        this.pin = { zone: this.g.backend.zone, x: to.x, z: to.z };
      }
      this.syncPinUi();
      this.fullMap.draw(this.g, this.myPin());
    });
    $('fullmap-clearpin').onclick = () => {
      this.pin = null;
      this.syncPinUi();
      this.fullMap.draw(this.g, null);
    };
  }

  /** Redraws the open map (the HUD calls it every 0.1 s with the minimap). */
  redraw(): void {
    if (this.mapOpen) this.fullMap.draw(this.g, this.myPin());
  }

  // ------------------------------------------------------------ full map

  /** The pin placed in the zone the player is in now, if any. */
  myPin(): { x: number; z: number } | null {
    return this.pin && this.pin.zone === this.g.backend.zone ? this.pin : null;
  }

  private syncPinUi(): void {
    $('fullmap-clearpin').classList.toggle('hidden', !this.myPin());
  }

  toggleMap(force?: boolean): void {
    this.mapOpen = force ?? !this.mapOpen;
    $('fullmap').classList.toggle('hidden', !this.mapOpen);
    if (!this.mapOpen) return;
    const z = this.g.backend.zone;
    $('fullmap-title').textContent = `แผนที่ — ${z.nameTh} (Lv.${z.levels[0]}-${z.levels[1]})`;
    $('fullmap-hint').textContent = this.g.backend.online
      ? 'คลิกซ้ายเพื่อเดินไป · คลิกขวาเพื่อปักหมุด (คลิกขวาที่หมุดเพื่อลบ) · กด M หรือ Esc เพื่อปิด · ออนไลน์จะเห็นจุดมอน/ผู้เล่นเฉพาะที่อยู่ใกล้ตัว'
      : 'คลิกซ้ายเพื่อเดินไป · คลิกขวาเพื่อปักหมุด (คลิกขวาที่หมุดเพื่อลบ) · กด M หรือ Esc เพื่อปิด';
    this.syncPinUi();
    this.fullMap.draw(this.g, this.myPin());
  }
}
