// The map editor's "ประวัติการเผยแพร่" and "ส่งออกเข้า repo" (docs/plans/map-editor.md 3.1, 3.3 step 5; PR 8).
//
// A list of the published revisions of the map on screen (newest first: rev, who, when, note). Each older one has "ย้อนกลับไป rev นี้"
// (publishes it again as the next revision, tool mapRollback). "ส่งออก" (tool mapExport) downloads the newest published layout as
// <zoneId>.json to be put at src/shared/data/maps/ and committed as the new default.
import type { H, Api } from './mount';

interface RevRow { rev: number; author: string; note: string; updatedAt: number; bytes?: number }
interface RevsReply { revisions: RevRow[]; bundledRev: number }
interface ExportReply { rev: number; file: string; json: string; text?: string }

export interface RevisionPerms { rollback: boolean; export: boolean }

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const when = (t: number): string => new Date(t).toLocaleString('th-TH', { hour12: false });

/** Saves `text` as a file with this name (the browser's download). */
export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Builds the panel into `box`. `zone()` is the map on screen; `onRolledBack` runs after a rollback so the page can refresh its own state.
 * Returns `reload`, to call when the map changes or something was published.
 */
export function mountRevisions(box: HTMLElement, h: H, api: Api, perms: RevisionPerms, zone: () => string, onRolledBack: (rev: number) => void): () => Promise<void> {
  const msg = h('div', { class: 'msg' });
  const list = h('div', { class: 'me-revs' });
  const say = (text: string, cls = ''): void => { msg.className = `msg ${cls}`; msg.textContent = text; };

  const exportBtn = h('button', {
    title: 'ดาวน์โหลดแมพที่เผยแพร่ล่าสุดเป็นไฟล์ <รหัสแมพ>.json',
    onclick: async () => {
      const id = zone();
      if (!id) return;
      try {
        const r = await api<ExportReply>('GET', `/admin/maps/${id}/export`);
        downloadText(`${id}.json`, r.text ?? r.json);
        say(`ดาวน์โหลด ${id}.json (rev ${r.rev}) แล้ว · วางที่ ${r.file} แล้ว commit`, 'good');
      } catch (e) {
        say(errText(e), 'bad');
      }
    },
  }, '📦 ส่งออกเข้า repo (ดาวน์โหลด JSON)');

  box.replaceChildren(
    h('h4', {}, 'ประวัติการเผยแพร่'),
    list,
    msg,
    ...(perms.export ? [
      h('div', { class: 'row' }, exportBtn),
      h('div', { class: 'muted me-hint' }, 'ไฟล์ที่ได้คือแมพที่เผยแพร่ล่าสุด ตั้งชื่อ <รหัสแมพ>.json ไว้แล้ว วางที่ src/shared/data/maps/<รหัสแมพ>.json แล้ว commit เป็นค่าตั้งต้นใหม่ของเกม (ไม่บังคับ แต่ควรทำเป็นระยะ ให้ git เก็บประวัติและเครื่อง dev/CI ได้แมพล่าสุด)'),
    ] : []),
  );

  async function reload(): Promise<void> {
    const id = zone();
    if (!id) return;
    list.replaceChildren(h('div', { class: 'muted' }, 'กำลังโหลด…'));
    try {
      const r = await api<RevsReply>('GET', `/admin/maps/${id}/revisions`);
      if (id !== zone()) return;
      if (!r.revisions.length) {
        list.replaceChildren(h('div', { class: 'muted' }, `ยังไม่เคยเผยแพร่ (ใช้ไฟล์ที่มากับเกม rev ${r.bundledRev})`));
        return;
      }
      list.replaceChildren(h('table', { class: 'tbl' },
        h('tr', {}, ...['rev', 'ใคร', 'เมื่อไหร่', 'หมายเหตุ', ''].map((t) => h('th', {}, t))),
        ...r.revisions.map((v, i) => h('tr', {},
          h('td', {}, `${v.rev}${i === 0 ? ' (ใช้อยู่)' : ''}`),
          h('td', {}, v.author),
          h('td', {}, when(v.updatedAt)),
          h('td', {}, v.note || '–'),
          h('td', {}, i > 0 && perms.rollback ? h('button', {
            title: 'เผยแพร่ rev นี้ซ้ำเป็น revision ใหม่ทันที (ห้องที่เปิดใหม่ใช้ทันที ห้องที่มีคนอยู่ใช้ตอนเข้าแมพครั้งถัดไป)',
            onclick: () => void rollback(v.rev),
          }, '↩ ย้อนกลับไป rev นี้') : '')))));
    } catch (e) {
      list.replaceChildren(h('div', { class: 'msg bad' }, errText(e)));
    }
  }

  async function rollback(rev: number): Promise<void> {
    const id = zone();
    if (!confirm(`ย้อนแมพนี้กลับไปใช้ rev ${rev}?\n\nระบบจะเผยแพร่ rev ${rev} ซ้ำเป็น revision ใหม่ทันที (ของที่เผยแพร่ล่าสุดตอนนี้ยังอยู่ในประวัติ)\nร่างที่ยังไม่เผยแพร่ในตัวแก้ไม่ถูกแตะ`)) return;
    say('กำลังย้อนกลับ…');
    try {
      const r = await api<{ rev: number }>('POST', `/admin/maps/${id}/rollback`, { rev });
      say(`ย้อนกลับไป rev ${rev} แล้ว (เผยแพร่เป็น rev ${r.rev})`, 'good');
      onRolledBack(r.rev);
      await reload();
    } catch (e) {
      say(errText(e), 'bad');
    }
  }

  return reload;
}
