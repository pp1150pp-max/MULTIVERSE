/// <reference types="vite/client" />
/**
 * The real URL of a sprite PNG under public/assets/sprites/. The build ships those PNGs as WebP
 * (see the webp plugin in vite.config.ts), so outside dev `.png` becomes `.webp`. Dev serves the PNGs as they are.
 * Every sprite path written in TS goes through this; index.html and CSS are rewritten by the plugin.
 */
export const imgUrl = (path: string): string => (import.meta.env.DEV ? path : path.replace(/\.png$/, '.webp'));
