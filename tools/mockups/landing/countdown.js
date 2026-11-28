// Shared by the landing mockups: the close beta countdown (Thai time UTC+7).
// ?now=2026-12-01T12:00:00Z pretends the clock reads that time (to check the three states).
(function () {
  const START = Date.parse('2026-11-28T11:00:00Z'); // 28 Nov 2026 18:00 Thai
  const END = Date.parse('2026-12-05T11:00:00Z'); //   5 Dec 2026 18:00 Thai
  const q = new URLSearchParams(location.search).get('now');
  const skew = q && !isNaN(Date.parse(q)) ? Date.parse(q) - Date.now() : 0;
  const pad = (n) => String(n).padStart(2, '0');
  function tick() {
    const now = Date.now() + skew;
    const state = now < START ? 'before' : now < END ? 'open' : 'ended';
    const left = Math.max(0, (state === 'before' ? START : END) - now);
    const s = Math.floor(left / 1000);
    const parts = { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
    document.querySelectorAll('[data-cd]').forEach((root) => {
      root.dataset.state = state;
      const label = root.querySelector('[data-cd-label]');
      if (label) label.textContent = state === 'before' ? 'Close Beta เริ่มในอีก' : state === 'open' ? 'Close Beta เปิดแล้ว! เหลือเวลาอีก' : 'Close Beta จบแล้ว ขอบคุณที่มาร่วมทดสอบ';
      for (const k of ['d', 'h', 'm', 's']) {
        const el = root.querySelector(`[data-cd-${k}]`);
        if (el) el.textContent = k === 'd' ? String(parts.d) : pad(parts[k]);
      }
    });
  }
  tick();
  setInterval(tick, 1000);
})();
