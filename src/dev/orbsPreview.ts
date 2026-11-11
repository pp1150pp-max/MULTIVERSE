// orbs.html under `npm run dev`: the orb test bench on a page of its own. The same bench is in the
// /admin "ลูกแก้วตีบวก" tab (src/client/orbPreview.ts).
import '../client/noBrowserMenu';
import { mountOrbPreview } from '../client/orbPreview';

const root = document.getElementById('orbp')!;
mountOrbPreview(root, 'หน้าทดสอบตอน npm run dev (มีในหน้า /admin แท็บ "ลูกแก้วตีบวก" ด้วย)').catch((e) => {
  root.textContent = `โหลดไม่สำเร็จ: ${e}`;
  console.error(e);
});
