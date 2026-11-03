export default {
  base: './',
  server: {
    port: 5173,
    open: true,
    // Art work folders aren't part of the game; archives/PSDs there can be locked while saving
    // and would crash the file watcher (EBUSY).
    watch: { ignored: ['**/art_templates/**', '**/tools/**'] },
  },
};
