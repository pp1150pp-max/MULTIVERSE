import { fileURLToPath } from 'node:url';
import { spritesWebp } from './tools/vite-sprites-webp';

// The dev game server started by `npm run dev` (tools/dev.mjs) — port 2568 unless DEV_SERVER_PORT says otherwise.
const GAME_SERVER = `http://localhost:${process.env.DEV_SERVER_PORT ?? 2568}`;

export default {
  base: './',
  // The game, the admin page (served at /admin) and the /privacy and /terms pages.
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
        privacy: fileURLToPath(new URL('./privacy.html', import.meta.url)),
        terms: fileURLToPath(new URL('./terms.html', import.meta.url)),
      },
    },
  },
  plugins: [
    // Sprite PNGs ship as WebP (build only; dev serves the PNGs).
    spritesWebp(),
    {
      // In development, /admin, /privacy and /terms open their pages too (instead of the game).
      name: 'admin-page',
      configureServer(server: { middlewares: { use(fn: (req: { url?: string }, res: unknown, next: () => void) => void): void } }) {
        server.middlewares.use((req, _res, next) => {
          const m = /^\/(admin|privacy|terms)(\?.*)?$/.exec(req.url ?? '');
          if (m) req.url = `/${m[1]}.html${m[2] ?? ''}`;
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
    // Reachable from other devices on the same Wi-Fi (phones and tablets): http://<this PC's IP>:5173
    host: true,
    open: true,
    // Art work folders aren't part of the game; archives/PSDs there can be locked while saving
    // and would crash the file watcher (EBUSY). The server's database lives in server/data.
    watch: { ignored: ['**/art_templates/**', '**/tools/**', '**/server/data/**'] },
    // During development the game runs on Vite; account requests and the game's WebSocket
    // (WS_PATH in src/shared/net/protocol.ts) go to the dev game server.
    proxy: {
      '/api': GAME_SERVER,
      '/ws': { target: GAME_SERVER, ws: true },
    },
  },
};
