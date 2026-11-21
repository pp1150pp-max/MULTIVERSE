// The map editor's "ประวัติการเผยแพร่" and "ส่งออกเข้า repo" (docs/plans/map-editor.md 3.1, 3.3 step 5; PR 8).
//
// A list of the published revisions of the map on screen (newest first: rev, who, when, note). Each older one has "ย้อนกลับไป rev นี้"
// (publishes it again as the next revision, tool mapRollback). "ส่งออก" (tool mapExport) downloads the newest published layout as
// <zoneId>.json to be put at src/shared/data/maps/ and committed as the new default.
import type { H, Api } from './mount';
import type { MapData } from '../../shared/mapSchema';
import { diffMapItems, type DiffItem, type DiffKind } from '../../shared/mapDiff';
import { DIFF_COLOR, DIFF_WORD, type CompareState } from './compare';

interface RevRow { rev: number; author: string; note: string; updatedAt: number; bytes?: number }
interface RevsReply { revisions: RevRow[]; bundledRev: number }
interface ExportReply { rev: number; file: string; json: string; text?: string }

export interface RevisionPerms { rollback: boolean; export: boolean }
/** What the compare part needs from the page: the draft on screen, the bundled file, and the canvas overlay. */
export interface CompareHooks {
  draft(): MapData | null;
  bundled(): MapData | undefined;
  show(s: CompareState | null): void;
  /** Centres the canvas on an item (and selects it when the draft still holds it). */
  jump(it: DiffItem): void;
}

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
export function mountRevisions(box: HTMLElement, h: H, api: Api, perms: RevisionPerms, zone: () => string, onRolledBack: (rev: number) => void, cmp: CompareHooks): () => Promise<void> {
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

  // ---------------------------------------------------------- compare two layouts
  const selA = h('select', { title: 'ฉบับเดิม (A)' });
  const selB = h('select', { title: 'ฉบับใหม่ (B)' });
  const cmpMsg = h('div', { class: 'muted me-hint' });
  const cmpList = h('div', { class: 'me-cmp-list' });
  const closeBtn = h('button', { onclick: () => stopCompare(), disabled: true }, '✖ ปิดการเทียบ');
  const revMaps = new Map<string, MapData>();
  let shown: CompareState | null = null;

  /** The layout an option stands for: 'draft', 'bundled' or a published rev number. */
  async function layoutOf(v: string): Promise<MapData> {
    if (v === 'draft') {
      const d = cmp.draft();
      if (!d) throw new Error('ยังไม่ได้เปิดร่าง');
      return structuredClone(d); // the draft as it is now; later edits do not move the colours
    }
    if (v === 'bundled') {
      const b = cmp.bundled();
      if (!b) throw new Error('ไม่มีไฟล์ที่มากับเกมของแมพนี้');
      return b;
    }
    const key = `${zone()}#${v}`;
    let m = revMaps.get(key);
    if (!m) {
      const r = await api<{ map?: MapData }>('GET', `/admin/maps/${zone()}/revisions/${v}`);
      if (!r.map) throw new Error(`rev ${v} อ่านไม่ได้`);
      m = r.map;
      revMaps.set(key, m);
    }
    return m;
  }
  const optText = (sel: HTMLSelectElement): string => sel.selectedOptions[0]?.textContent ?? sel.value;

  async function runCompare(): Promise<void> {
    if (selA.value === selB.value) { cmpMsg.textContent = 'เลือก A กับ B ให้ต่างกัน'; return; }
    cmpMsg.textContent = 'กำลังเทียบ…';
    try {
      const id = zone();
      const [a, b] = await Promise.all([layoutOf(selA.value), layoutOf(selB.value)]);
      if (id !== zone()) return;
      const items = diffMapItems(a, b);
      shown = { labelA: optText(selA), labelB: optText(selB), items, focus: -1 };
      cmp.show(shown);
      closeBtn.disabled = false;
      renderCompare();
    } catch (e) {
      cmpMsg.textContent = `เทียบไม่สำเร็จ: ${errText(e)}`;
    }
  }
  function stopCompare(): void {
    shown = null;
    cmp.show(null);
    closeBtn.disabled = true;
    cmpMsg.textContent = '';
    cmpList.replaceChildren();
  }
  function renderCompare(): void {
    if (!shown) return;
    const s = shown;
    const n = (k: DiffKind): number => s.items.filter((i) => i.kind === k).length;
    cmpMsg.textContent = s.items.length
      ? `${s.labelA} → ${s.labelB}: เพิ่ม ${n('added')} · ลบ ${n('removed')} · ย้าย ${n('moved')} · แก้ ${n('changed')} · ภาพบนแมพยังเป็นร่างที่เปิดอยู่ สีคือความต่างจาก A ไป B (คลิกรายการ = ไปที่ชิ้นนั้น)`
      : `${s.labelA} กับ ${s.labelB} เหมือนกันทุกชิ้น`;
    const order: DiffKind[] = ['removed', 'added', 'moved', 'changed'];
    const sorted = s.items.map((it, i) => ({ it, i })).sort((p, q) => order.indexOf(p.it.kind) - order.indexOf(q.it.kind));
    const LIMIT = 400;
    cmpList.replaceChildren(...sorted.slice(0, LIMIT).map(({ it, i }) => h('button', {
      class: `me-cmp-item${i === s.focus ? ' on' : ''}`,
      style: `border-left: 4px solid ${DIFF_COLOR[it.kind]}`,
      title: it.fields?.length ? `ค่าที่ต่าง: ${it.fields.join(', ')}` : '',
      onclick: () => { s.focus = i; cmp.show(s); cmp.jump(it); renderCompare(); },
    }, `${DIFF_WORD[it.kind]} · ${it.label}${it.kind === 'changed' && it.fields?.length ? ` (${it.fields.join(', ')})` : ''}`)),
    ...(sorted.length > LIMIT ? [h('div', { class: 'muted' }, `…อีก ${sorted.length - LIMIT} รายการ (ดูบนแมพได้ครบ)`)] : []));
  }
  /** Fills the two lists (keeping what was picked when it still exists): published revisions, the bundled file, the draft. */
  function fillCompareOptions(revs: RevRow[], bundledRev: number): void {
    const opts: [string, string][] = [
      ['draft', 'ร่างที่เปิดอยู่'],
      ...revs.map((v, i): [string, string] => [String(v.rev), `rev ${v.rev}${i === 0 ? ' (ใช้อยู่)' : ''}`]),
      ['bundled', `ไฟล์ที่มากับเกม (rev ${bundledRev})`],
    ];
    const keepA = selA.value, keepB = selB.value;
    for (const sel of [selA, selB]) sel.replaceChildren(...opts.map(([v, t]) => h('option', { value: v }, t)));
    const has = (v: string): boolean => opts.some(([o]) => o === v);
    selA.value = has(keepA) && keepA !== 'draft' ? keepA : revs.length ? String(revs[0].rev) : 'bundled';
    selB.value = has(keepB) && keepB !== selA.value ? keepB : 'draft';
  }

  box.replaceChildren(
    h('h4', {}, 'ประวัติการเผยแพร่'),
    list,
    msg,
    h('h4', {}, 'เทียบ revision'),
    h('div', { class: 'row' }, h('label', {}, 'A (เดิม) ', selA), h('label', {}, 'B (ใหม่) ', selB),
      h('button', { onclick: () => void runCompare() }, '🔍 เทียบ'), closeBtn),
    h('div', { class: 'muted me-hint' }, 'โชว์บนแมพ: เขียว = เพิ่ม · แดง = ลบ · เหลือง = ย้าย/แก้ (เส้นจากที่เดิมไปที่ใหม่) · ดูอย่างเดียว ไม่แตะร่าง'),
    cmpMsg,
    cmpList,
    ...(perms.export ? [
      h('div', { class: 'row' }, exportBtn),
      h('div', { class: 'muted me-hint' }, 'ไฟล์ที่ได้คือแมพที่เผยแพร่ล่าสุด ตั้งชื่อ <รหัสแมพ>.json ไว้แล้ว วางที่ src/shared/data/maps/<รหัสแมพ>.json แล้ว commit เป็นค่าตั้งต้นใหม่ของเกม (ไม่บังคับ แต่ควรทำเป็นระยะ ให้ git เก็บประวัติและเครื่อง dev/CI ได้แมพล่าสุด)'),
    ] : []),
  );

  async function reload(): Promise<void> {
    const id = zone();
    if (!id) return;
    stopCompare(); // another map, or a new revision: the old colours no longer apply
    list.replaceChildren(h('div', { class: 'muted' }, 'กำลังโหลด…'));
    try {
      const r = await api<RevsReply>('GET', `/admin/maps/${id}/revisions`);
      if (id !== zone()) return;
      fillCompareOptions(r.revisions, r.bundledRev);
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
