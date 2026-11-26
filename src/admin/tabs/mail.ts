import { MAIL_BODY_MAX, MAIL_DAYS, MAIL_TITLE_MAX, type MailRecipientRow, type MailSendRow } from '../../shared/mail';
import { RARITY_COLOR, RARITY_LABEL } from '../../shared/types';
import { ItemPicker } from '../itemPicker';
import { h, api, fmt, time, meta, view } from '../core';

// ------------------------------------------------------------ mail

/** The mail being written, kept while the tab redraws. */
const mailDraft = { target: 'char', who: '', title: '', body: '', gold: '' };

export async function renderMail(): Promise<void> {
  if (!meta) return;
  const m = meta;
  const msg = h('div', { class: 'msg' });
  const say = (text: string, ok: boolean) => {
    msg.className = `msg ${ok ? 'ok' : 'bad'}`;
    msg.textContent = text;
  };

  // Who gets it
  const target = h('select', {},
    h('option', { value: 'char' }, 'ตัวละครหนึ่งตัว (ชื่อตัวละคร)'),
    h('option', { value: 'account' }, 'บัญชีหนึ่งบัญชี (ชื่อผู้ใช้)'),
    h('option', { value: 'allChars' }, 'ทุกตัวละคร (ได้ตัวละครละ 1 ฉบับ)'),
    h('option', { value: 'allAccounts' }, 'ทุกบัญชี (บัญชีละ 1 ฉบับ)'),
  );
  const who = h('input', { placeholder: 'ชื่อ', autocapitalize: 'off', maxLength: 32 });
  target.value = mailDraft.target;
  who.value = mailDraft.who;
  const showWho = () => {
    who.style.display = target.value === 'char' || target.value === 'account' ? '' : 'none';
    who.placeholder = target.value === 'char' ? 'ชื่อตัวละคร (พิมพ์ให้ตรง)' : 'ชื่อผู้ใช้ (พิมพ์ให้ตรง)';
  };
  target.onchange = () => { mailDraft.target = target.value; showWho(); };
  who.oninput = () => (mailDraft.who = who.value);
  showWho();

  const title = h('input', { placeholder: 'หัวข้อ', maxLength: MAIL_TITLE_MAX });
  const body = h('textarea', { placeholder: 'เนื้อหา', maxLength: MAIL_BODY_MAX, rows: 6, style: 'width:100%;box-sizing:border-box' });
  title.value = mailDraft.title;
  body.value = mailDraft.body;
  title.oninput = () => (mailDraft.title = title.value);
  body.oninput = () => (mailDraft.body = body.value);

  // Attachments: gold, and up to itemsMax pieces of gear / potions / stones (gear is rolled when claimed, for the claimer's class)
  const gold = h('input', { type: 'number', inputMode: 'numeric', min: '0', max: String(m.goldMax), step: '1', placeholder: '0' });
  gold.value = mailDraft.gold;
  gold.oninput = () => (mailDraft.gold = gold.value);
  type Line = { plus: HTMLSelectElement; rarity: HTMLSelectElement; level: HTMLInputElement; count: HTMLInputElement; pick: ItemPicker; el: HTMLElement };
  const lines: Line[] = [];
  const linesBox = h('div');
  const addLine = () => {
    // Gear of every class (rolled for the claimer's class when claimed), monster cards and usable items, picked from pictures.
    const pick = new ItemPicker({ bases: m.bases, onChange: () => sync() });
    const rarity = h('select', {}, ...m.rarities.map((r) => h('option', { value: r, style: `color:${RARITY_COLOR[r]}` }, RARITY_LABEL[r])));
    const plus = h('select', {}, ...Array.from({ length: m.maxPlus + 1 }, (_, i) => h('option', { value: String(i) }, `+${i}`)));
    const level = h('input', { type: 'number', inputMode: 'numeric', min: '1', max: String(m.maxLevel), placeholder: 'เลเวลผู้รับ', style: 'width:90px' });
    const count = h('input', { type: 'number', inputMode: 'numeric', min: '1', max: String(m.itemsMax), value: '1', style: 'width:60px' });
    const gearOnly = [rarity, plus, level];
    const sync = () => gearOnly.forEach((e) => (e.style.display = /^(potion|stone):/.test(pick.value) ? 'none' : ''));
    sync();
    const del = h('button', { class: 'small', type: 'button', title: 'เอาออก' }, '✕');
    const row = h('div', { class: 'row', style: 'margin-top:6px' }, pick.el, rarity, plus, level, h('label', {}, 'จำนวน', count), del);
    const line: Line = { pick, rarity, plus, level, count, el: row };
    del.onclick = () => { lines.splice(lines.indexOf(line), 1); row.remove(); };
    lines.push(line);
    linesBox.append(row);
  };
  const addBtn = h('button', { class: 'small', type: 'button' }, '+ เพิ่มของแนบ');
  addBtn.onclick = () => (lines.length < m.itemsMax ? addLine() : say(`แนบได้ไม่เกิน ${m.itemsMax} รายการ`, false));

  /** The attachment as the server wants it. */
  const attach = () => ({
    gold: Math.trunc(Number(gold.value) || 0),
    items: lines.map((l) => {
      const count = Math.trunc(Number(l.count.value));
      const [kind, a, b] = l.pick.value.split(':');
      if (kind === 'potion') return { kind, potion: a, size: b, count };
      if (kind === 'stone') return { kind, stone: a, count };
      const lv = Math.trunc(Number(l.level.value));
      return { kind: 'equip', baseId: l.pick.value, rarity: l.rarity.value, plus: Number(l.plus.value), ...(lv ? { level: lv } : {}), count };
    }),
  });

  const sendBtn = h('button', { class: 'primary' }, 'ส่งจดหมาย');
  sendBtn.onclick = async () => {
    const t = target.value;
    const label = { char: `ตัวละคร ${who.value.trim()}`, account: `บัญชี ${who.value.trim()}`, allChars: 'ทุกตัวละคร', allAccounts: 'ทุกบัญชี' }[t];
    if (!confirm(`ส่งจดหมาย "${title.value.trim()}" ถึง ${label}?`)) return;
    sendBtn.disabled = true;
    say('กำลังส่ง…', true);
    try {
      const req = { target: t === 'char' ? { kind: t, name: who.value } : t === 'account' ? { kind: t, username: who.value } : { kind: t }, title: title.value, body: body.value, attach: attach() };
      const r = await api<{ msg: string }>('POST', '/admin/mail', req);
      Object.assign(mailDraft, { title: '', body: '', gold: '' });
      lines.length = 0;
      void renderMail().then(() => say(r.msg, true));
    } catch (e) {
      say((e as Error).message, false);
      sendBtn.disabled = false;
    }
  };

  // History
  const hist = h('div');
  const histMore = h('button', { class: 'hidden' }, 'โหลดเพิ่ม');
  let oldest: number | undefined;
  const drawSend = (r: MailSendRow) => {
    const detail = h('div', { class: 'muted' });
    const recall = h('button', { class: 'small danger' }, 'ดึงกลับ');
    recall.onclick = async () => {
      if (!confirm(`ดึงจดหมาย "${r.title}" กลับ? (เฉพาะสำเนาที่ยังไม่มีใครรับของ)`)) return;
      try {
        say((await api<{ msg: string }>('POST', `/admin/mail/${r.id}/recall`)).msg, true);
        void renderMail();
      } catch (e) {
        say((e as Error).message, false);
      }
    };
    const who = h('button', { class: 'small' }, 'ดูผู้รับ');
    who.onclick = async () => {
      try {
        const rows = await api<MailRecipientRow[]>('GET', `/admin/mail/${r.id}/recipients`);
        detail.replaceChildren(...rows.map((x) => h('div', {}, `${x.char ? `${x.char} (${x.account})` : x.account}: ${x.recalled ? 'ดึงกลับแล้ว' : `${x.read ? 'อ่านแล้ว' : 'ยังไม่อ่าน'}${x.claimed ? ' · รับของแล้ว' : ''}`}`)));
        if (rows.length < r.recipients) detail.append(h('div', {}, `… แสดง ${rows.length} จาก ${fmt(r.recipients)} สำเนา`));
      } catch (e) {
        say((e as Error).message, false);
      }
    };
    return h('div', { class: 'list-item', style: 'flex-direction:column;align-items:stretch' },
      h('div', {}, h('b', {}, r.title), ` · ถึง ${r.target} · โดย ${r.by} · ${time(r.at)}`),
      r.lines.length ? h('div', { class: 'muted' }, `แนบ: ${r.lines.join(', ')}`) : null,
      h('div', { class: 'muted' }, `สำเนา ${fmt(r.recipients)} · อ่านแล้ว ${fmt(r.read)} · รับของแล้ว ${fmt(r.claimed)} · ดึงกลับ ${fmt(r.recalled)}`),
      h('div', { class: 'row' }, who, r.recipients > r.recalled ? recall : null),
      detail,
    );
  };
  const loadHist = async () => {
    try {
      const rows = await api<MailSendRow[]>('GET', `/admin/mail${oldest ? `?before=${oldest}` : ''}`);
      hist.append(...rows.map(drawSend));
      if (rows.length) oldest = rows.at(-1)!.id;
      histMore.classList.toggle('hidden', rows.length < 30);
      if (!hist.children.length) hist.append(h('div', { class: 'muted' }, 'ยังไม่เคยส่งจดหมาย'));
    } catch (e) {
      say((e as Error).message, false);
    }
  };
  histMore.onclick = () => void loadHist();

  view.replaceChildren(
    h('div', { class: 'card' },
      h('h2', {}, 'ส่งจดหมาย'),
      h('div', { class: 'muted', style: 'margin:-6px 0 8px' }, `ถึงผู้เล่นจริงเท่านั้น (Guest ไม่ได้) · "ทุก…" ส่งถึงบัญชี/ตัวละครที่มีตอนกดส่ง · หมดอายุใน ${MAIL_DAYS} วัน · ของแนบรวมไม่เกิน ${m.itemsMax} ชิ้น ทองไม่เกิน ${fmt(m.goldMax)} G · อุปกรณ์สุ่มตอนผู้เล่นกดรับ (ตามอาชีพผู้รับ)`),
      h('div', { class: 'row' }, h('label', {}, 'ผู้รับ', target), who),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('label', { style: 'flex:1' }, 'หัวข้อ', title)),
      h('div', { style: 'margin-top:8px' }, body),
      h('h3', {}, 'ของแนบ (ไม่ใส่ก็ได้)'),
      h('div', { class: 'row' }, h('label', {}, 'ทอง', gold)),
      linesBox, h('div', { class: 'row', style: 'margin-top:6px' }, addBtn),
      h('div', { class: 'row', style: 'margin-top:10px' }, sendBtn),
      msg,
    ),
    h('div', { class: 'card' }, h('h2', {}, 'จดหมายที่ส่งแล้ว'), hist, histMore),
  );
  await loadHist();
}
