// Types for the parts of pixelfx (vendored JavaScript, MIT, see ../LICENSE) the game uses: src/client/pixelFx.ts.
export interface PixelFrame { w: number; h: number; ox: number; oy: number; color: Uint32Array; light: Uint32Array }
export interface PixelFxMeta { name: string; size?: [number, number]; origin?: [number, number]; duration?: number; loop?: boolean; options?: Record<string, unknown> }
export interface PixelFxModule { meta?: PixelFxMeta }
export interface PixelFx {
  readonly meta: PixelFxMeta;
  readonly t: number;
  update(dt: number): void;
  draw(frame: PixelFrame, layer?: 'back' | 'front'): void;
  stop(): void;
  done(): boolean;
}
export function createFrame(w: number, h: number, ox?: number, oy?: number): PixelFrame;
export function clearFrame(f: PixelFrame): PixelFrame;
export function createFx(mod: PixelFxModule, o?: Record<string, unknown>): PixelFx;
export function composite(f: PixelFrame, out: Uint8ClampedArray, bg?: number | Uint32Array | null, lightK?: number): Uint8ClampedArray;
