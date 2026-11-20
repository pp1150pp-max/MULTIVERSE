// The /admin "แมพ" tab (docs/plans/map-editor.md). For now only the switch "ใช้แมพจาก DB"; the editor itself comes in PR 6.
// The switch is stored with the balance settings (BalanceTuning.mapFromDb), so it uses the same permission, audit and
// "only what differs from the code" storage as the balance tab.
import { CODE_MAP_FROM_DB, mergeBalance, type BalanceTuning } from '../shared/balance';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

export async function renderMaps(view: HTMLElement, h: H, api: Api, onSaved: (tuning: BalanceTuning) => void): Promise<void> {
  view.replaceChildren(h('div', { class: 'muted' }, 'กำลังโหลด…'));
  let saved: BalanceTuning;
  try {
    saved = (await api<{ tuning: BalanceTuning }>('GET', '/admin/balance')).tuning;
  } catch (e) {
    view.replaceChildren(h('div', { class: 'msg bad' }, e instanceof Error ? e.message : String(e)));
    return;
  }
  const msg = h('div', { class: 'msg' });
  const box = h('input', { type: 'checkbox', checked: mergeBalance(saved).mapFromDb });
  const save = h('button', { class: 'primary', onclick: async () => {
    const on = box.checked;
    // The whole tuning is sent back with only this value changed (the server stores only what differs from the code).
    const tuning: BalanceTuning = { ...saved };
    if (on === CODE_MAP_FROM_DB) delete tuning.mapFromDb;
    else tuning.mapFromDb = on;
    if (!confirm(`ใช้แมพจาก DB ${on ? 'เปิด' : 'ปิด'} ทั้งเซิร์ฟเลยไหม?`)) return;
    msg.className = 'msg';
    msg.textContent = 'กำลังบันทึก…';
    try {
      saved = (await api<{ tuning: BalanceTuning }>('POST', '/admin/balance', { tuning, part: 'rest' })).tuning;
      onSaved(saved);
      msg.className = 'msg good';
      msg.textContent = 'บันทึกแล้ว';
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = e instanceof Error ? e.message : String(e);
    }
  } }, '💾 บันทึก');
  view.replaceChildren(
    h('h2', {}, 'แมพ'),
    h('div', { class: 'muted' },
      'ตัวแก้แมพ (ลากวางอาคาร ของประดับ NPC ประตู จุดเกิดมอน) จะมาในขั้นต่อไป ตอนนี้เกมอ่านแมพชั้น 1 ทั้ง 5 ใบจากไฟล์ JSON ที่มากับเกม (src/shared/data/maps) แทนการสุ่มในโค้ด หน้าตาและการชนเหมือนเดิม'),
    h('h3', {}, 'ที่มาของแมพ'),
    h('div', { class: 'row bal-line' },
      h('label', { title: 'ค่าในโค้ด: เปิด' }, box,
        ' ใช้แมพจาก DB (เมื่อมีตัวแก้แมพ แมพที่เจ้าของเผยแพร่แล้วจะแทนที่ไฟล์ JSON ที่มากับเกม · ปิด = ใช้ไฟล์ JSON ในเกมเสมอ ทางหนีฉุกเฉินถ้าแมพที่เผยแพร่พัง · มีผลกับห้องที่เปิดใหม่ ห้องที่มีคนอยู่ใช้ตอนผู้เล่นเข้าแมพครั้งถัดไป)')),
    h('div', { class: 'row' }, save, msg),
  );
}
