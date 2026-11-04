// npm run tunnel: only the friends' link, in its own window. Leave it open; restart the server
// (npm run online) as often as needed and the link stays the same. The server can be down meanwhile,
// friends just see an error until it is back.
import { clearTunnelState, runningTunnel, startTunnel } from './tunnel';

const PORT = Number(process.env.PORT ?? 2567);

const already = runningTunnel(PORT);
if (already) {
  console.log(`\n  มีหน้าต่าง npm run tunnel เปิดอยู่แล้ว — ลิงก์เดิม: ${already}\n`);
  process.exit(0);
}
console.log(`\nMULTIVERSE ลิงก์สำหรับเพื่อน → http://localhost:${PORT}`);
console.log('  เปิดหน้าต่างนี้ค้างไว้ แล้วเปิด server ด้วย npm run online อีกหน้าต่างหนึ่ง\n');
const child = await startTunnel(PORT, { shared: true });
if (!child) process.exit(1);
child.on('exit', () => process.exit(0));
const stop = () => {
  child.kill();
  clearTunnelState();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
