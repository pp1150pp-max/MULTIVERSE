// cosmetics.html under `npm run dev`: the cosmetics test bench on a page of its own (code defaults, no
// server). The same bench is in the /admin "ของแต่งตัว" tab (src/client/cosPreview.ts).
import '../client/noBrowserMenu';
import { mountCosPreview } from '../client/cosPreview';

const root = document.getElementById('cosp')!;
mountCosPreview(root, 'หน้าทดสอบตอน npm run dev (มีในหน้า /admin แท็บ "ของแต่งตัว" ด้วย)').catch((e) => {
  root.textContent = `โหลดไม่สำเร็จ: ${e}`;
  console.error(e);
});
