export default {
  base: './',
  server: {
    port: 5173,
    open: true,
    // Art work folders aren't part of the game; archives/PSDs there can be locked while saving
    // and would crash the file watcher (EBUSY). The server's database lives in server/data.
    watch: { ignored: ['**/art_templates/**', '**/tools/**', '**/server/data/**'] },
    // During development the game runs on Vite; account requests go to the game server.
    proxy: { '/api': 'http://localhost:2567' },
  },
};
