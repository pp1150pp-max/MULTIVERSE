// The "มีอะไรใหม่" tab (docs/systems/news.md): the update notes players read in the game. Owner adds / edits / hides / deletes
// them and flips the two switches; GMs only look (the `newsEdit` tool). Notes added by /ship (tools: npm run add-news) show up here too.
// The server checks every value again (server/admin-news.ts).
import { NEWS_LINE_MAX, NEWS_LINES_MAX, NEWS_SHOW, NEWS_TITLE_MAX, newsDate, type AdminNews, type AdminNewsNote } from '../shared/news';
import { GAME_ORIGIN, LANDING_DEFAULT, LANDING_HOSTS, LANDING_NEWS, fromThaiInput, toThaiInput, type AdminLanding } from '../shared/landing';

type Kids = (Node | string | null | undefined | false)[];
type H = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...kids: Kids) => HTMLElementTagNameMap[K];
type Api = <T>(method: string, path: string, body?: unknown) => Promise<T>;

export async function renderNews(view: HTMLElement, h: H, api: Api): Promise<void> {
  const box = h('div', {}, h('div', { class: 'muted' }, 'กำลังโหลด…'));
  view.append(box);
  let st: AdminNews;
  try {
    st = await api<AdminNews>('GET', '/admin/news');
  } catch (e) {
    box.replaceChildren(h('div', { class: 'msg bad' }, `โหลดไม่สำเร็จ: ${(e as Error).message}`));
    return;
  }
  const msg = h('div', { class: 'msg' });
  const say = (text: string, ok: boolean) => {
    msg.className = ok ? 'msg ok' : 'msg bad';
    msg.textContent = text;
  };
  const run = async (f: () => Promise<AdminNews>, done: string): Promise<void> => {
    try {
      st = await f();
      draw();
      say(done, true);
    } catch (e) {
      say((e as Error).message, false);
    }
  };
  const ro = (): boolean => !st.canEdit;

  /** The form for a new note, or for editing `n`. */
  const form = (n: AdminNewsNote | null): HTMLElement => {
    const title = h('input', { type: 'text', maxlength: String(NEWS_TITLE_MAX), value: n?.title ?? '', placeholder: 'หัวข้อ เช่น อัปเดต 22 พ.ย.', style: 'width:100%', disabled: ro() }) as HTMLInputElement;
    const lines = h('textarea', { rows: '6', placeholder: `หนึ่งบรรทัดต่อหนึ่งเรื่อง (ไม่เกิน ${NEWS_LINES_MAX} บรรทัด บรรทัดละไม่เกิน ${NEWS_LINE_MAX} ตัวอักษร)`, style: 'width:100%', disabled: ro() }) as HTMLTextAreaElement;
    lines.value = n ? n.lines.join('\n') : '';
    const save = h('button', { class: 'primary', disabled: ro(), onclick: () => {
      const body = { title: title.value, lines: lines.value.split('\n') };
      void run(() => api<AdminNews>('POST', n ? `/admin/news/${n.id}/edit` : '/admin/news', body), n ? 'แก้ประกาศแล้ว' : 'เพิ่มประกาศแล้ว — ผู้เล่นที่ออนไลน์เห็นทันที');
    } }, n ? 'บันทึกการแก้' : 'เพิ่มประกาศ');
    return h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, title, lines, h('div', {}, save, n ? h('button', { onclick: draw }, 'ยกเลิก') : null));
  };

  const noteCard = (n: AdminNewsNote, shown: boolean): HTMLElement => {
    const card = h('div', { class: 'card', style: `margin:8px 0;${n.hidden ? 'opacity:.6' : ''}` });
    const view = (): void => {
      card.replaceChildren(
        h('div', { style: 'display:flex;gap:8px;align-items:baseline;flex-wrap:wrap' },
          h('b', {}, n.title),
          h('span', { class: 'muted' }, `#${n.id} · ${newsDate(n.at)} · โดย ${n.author}`),
          n.hidden ? h('span', { class: 'role' }, 'ซ่อนอยู่') : shown ? h('span', { class: 'role' }, 'ผู้เล่นเห็น') : h('span', { class: 'muted' }, `เก่ากว่า ${NEWS_SHOW} อันล่าสุด (ไม่โชว์)`)),
        h('ul', { style: 'margin:6px 0' }, ...n.lines.map((l) => h('li', {}, l))),
        st.canEdit ? h('div', {},
          h('button', { onclick: () => card.replaceChildren(form(n)) }, 'แก้'),
          h('button', { onclick: () => void run(() => api<AdminNews>('POST', `/admin/news/${n.id}/hide`, { hidden: !n.hidden }), n.hidden ? 'แสดงประกาศอีกครั้งแล้ว' : 'ซ่อนประกาศแล้ว') }, n.hidden ? 'แสดง' : 'ซ่อน'),
          h('button', { onclick: () => confirm(`ลบประกาศ "${n.title}" ถาวร?\n(ซ่อนไว้แทนจะย้อนกลับได้)`) && void run(() => api<AdminNews>('POST', `/admin/news/${n.id}/delete`, {}), 'ลบประกาศแล้ว') }, 'ลบ')) : '',
      );
    };
    view();
    return card;
  };

  const switches = (): HTMLElement => {
    const button = h('input', { type: 'checkbox', disabled: ro() }) as HTMLInputElement;
    button.checked = st.switches.button;
    const pop = h('input', { type: 'checkbox', disabled: ro() }) as HTMLInputElement;
    pop.checked = st.switches.autopop;
    const save = h('button', { class: 'primary', disabled: ro(), onclick: () => void run(() => api<AdminNews>('POST', '/admin/news/switches', { button: button.checked, autopop: pop.checked }), 'บันทึกสวิตช์แล้ว — มีผลทันที') }, 'บันทึกสวิตช์');
    return h('div', { class: 'card' },
      h('h2', {}, 'สวิตช์'),
      h('label', { style: 'display:block;margin:4px 0' }, button, ' แสดงปุ่ม "มีอะไรใหม่" ในเกม (ค่าในโค้ด: เปิด)'),
      h('label', { style: 'display:block;margin:4px 0' }, pop, ' เด้งหน้าต่างเองครั้งแรกหลังอัปเดต (ครั้งเดียวตอนเข้าเกมถ้ามีประกาศใหม่ที่ยังไม่เปิดดู · ค่าในโค้ด: ปิด)'),
      h('div', { class: 'muted' }, 'ปุ่มมีจุดแดงเสมอเมื่อมีประกาศใหม่ที่ผู้เล่นยังไม่เปิดดู ไม่ว่าสวิตช์เด้งเองจะเปิดหรือไม่'),
      save);
  };

  // The landing page (landing.html, docs/systems/landing.md): close beta window + whether it lists the notes.
  const landingCard = h('div', { class: 'card' }, h('h2', {}, 'หน้าแนะนำเกม (close beta)'), h('div', { class: 'muted' }, 'กำลังโหลด…'));
  const drawLanding = (l: AdminLanding, done = ''): void => {
    const lro = !l.canEdit;
    const start = h('input', { type: 'datetime-local', value: toThaiInput(l.config.start), disabled: lro }) as HTMLInputElement;
    const end = h('input', { type: 'datetime-local', value: toThaiInput(l.config.end), disabled: lro }) as HTMLInputElement;
    const news = h('input', { type: 'checkbox', disabled: lro }) as HTMLInputElement;
    news.checked = l.config.news;
    const apex = h('input', { type: 'checkbox', disabled: lro }) as HTMLInputElement;
    apex.checked = l.config.apex;
    const lmsg = h('div', { class: done ? 'msg ok' : 'msg' }, done);
    const save = h('button', { class: 'primary', disabled: lro, onclick: async () => {
      try {
        const r = await api<AdminLanding>('POST', '/admin/landing', { start: fromThaiInput(start.value), end: fromThaiInput(end.value), news: news.checked, apex: apex.checked });
        drawLanding(r, 'บันทึกแล้ว — หน้าแนะนำเกมใช้ค่าใหม่ภายใน ~30 วินาที');
      } catch (e) {
        lmsg.className = 'msg bad';
        lmsg.textContent = (e as Error).message;
      }
    } }, 'บันทึก');
    const t = (at: number) => toThaiInput(at).replace('T', ' ');
    landingCard.replaceChildren(
      h('h2', {}, 'หน้าแนะนำเกม (close beta)'),
      h('div', { class: 'muted' }, `นับถอยหลังบนหน้า /landing: ก่อนเริ่ม = นับถึงเวลาเริ่ม · ระหว่างเปิด = นับถึงเวลาจบ · หลังจบ = ข้อความว่าจบแล้ว · เวลาไทย · ค่าในโค้ด ${t(LANDING_DEFAULT.start)} ถึง ${t(LANDING_DEFAULT.end)}`),
      h('label', { style: 'display:block;margin:6px 0' }, 'เริ่ม ', start),
      h('label', { style: 'display:block;margin:6px 0' }, 'จบ ', end),
      h('label', { style: 'display:block;margin:6px 0' }, news, ` แสดง ${LANDING_NEWS} ประกาศล่าสุดบนหน้าแนะนำเกม (ค่าในโค้ด: เปิด)`),
      h('label', { style: 'display:block;margin:6px 0' }, apex, ` เปิดหน้าแนะนำเกมที่โดเมนหลัก (${LANDING_HOSTS.join(', ')}) ปิด = ส่งไปหน้าเกม ${GAME_ORIGIN} (ค่าในโค้ด: เปิด)`),
      lmsg, save);
  };
  void api<AdminLanding>('GET', '/admin/landing').then((l) => drawLanding(l), (e: Error) => landingCard.replaceChildren(h('h2', {}, 'หน้าแนะนำเกม (close beta)'), h('div', { class: 'msg bad' }, `โหลดไม่สำเร็จ: ${e.message}`)));

  const draw = (): void => {
    const visibleIds = new Set(st.notes.filter((n) => !n.hidden).slice(0, NEWS_SHOW).map((n) => n.id));
    box.replaceChildren(
      h('div', { class: 'card' },
        h('h2', {}, 'มีอะไรใหม่'),
        h('div', { class: 'muted' }, `ผู้เล่นเห็น ${NEWS_SHOW} ประกาศล่าสุดที่ไม่ได้ซ่อน (เวลาไทย) · ประกาศที่ /ship ลงให้หลังอัปเดต server ก็อยู่ที่นี่ แก้ได้ทีหลัง · ${st.canEdit ? '' : 'คุณดูได้อย่างเดียว'}`),
        msg),
      switches(),
      landingCard,
      h('div', { class: 'card' }, h('h2', {}, 'เพิ่มประกาศ'), form(null)),
      h('div', { class: 'card' }, h('h2', {}, 'ประกาศที่ลงไว้'),
        st.notes.length ? h('div', {}, ...st.notes.map((n) => noteCard(n, visibleIds.has(n.id)))) : h('div', { class: 'muted' }, 'ยังไม่มีประกาศ')),
    );
  };
  draw();
}
