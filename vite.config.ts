// The dev game server started by `npm run dev` (tools/dev.mjs) — port 2568 unless DEV_SERVER_PORT says otherwise.
const GAME_SERVER = `http://localhost:${process.env.DEV_SERVER_PORT ?? 2568}`;

export default {
  base: './',
  server: {
    port: 5173,
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
