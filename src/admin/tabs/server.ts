import { type AdminServerState, type AdminShutdownText, type AdminSnapDelta, type AdminGoogle, type AdminPaperMaps } from '../../shared/admin';
import { checkShutdownText, countdownTime, SHUTDOWN_CHOICES, SHUTDOWN_SECONDS, SHUTDOWN_TEXT_MAX, SHUTDOWN_TIME_TOKEN, shutdownWarning, type ShutdownMode } from '../../shared/net/protocol';
import { h, api, fmt, time, me, view, can } from '../core';
import { backupCard } from './backups';

// ------------------------------------------------------------ server (owner)

export async function renderServer(): Promise<void> {
  // Restart / shut down first: it is what the owner comes here for in a hurry (the backup list is long).
  const restart = me?.role === 'owner' ? renderRestart() : null;
  if (can('shutdownText')) view.append(shutdownTextCard());
  if (can('netDelta')) view.append(snapDeltaCard());
  if (can('paperMaps')) view.append(paperMapsCard());
  if (can('googleLogin')) view.append(googleCard());
  if (can('backup')) view.append(backupCard());
  await restart;
}

async function renderRestart(): Promise<void> {
  const status = h('div', { class: 'msg' });
  const restart = h('button', { class: 'primary' }, 'รีสตาร์ท');
  const stop = h('button', { class: 'danger' }, 'ปิด server');
  const cancel = h('button', { class: 'primary hidden' }, 'ยกเลิกการนับถอยหลัง');
  const secs = h('select', { title: 'นับถอยหลังนานเท่าไร' }, ...SHUTDOWN_CHOICES.map((n) => h('option', { value: String(n) }, `นับ ${countdownTime(n)}`)));
  const draw = (st: AdminServerState) => {
    restart.disabled = stop.disabled = secs.disabled = !!st.stopping;
    cancel.classList.toggle('hidden', !st.stopping);
    cancel.disabled = false;
    if (!st.stopping) {
      status.className = 'msg';
      status.textContent = '';
    }
    restart.title = st.supervised ? '' : 'server นี้ไม่ได้เปิดด้วย npm run online';
    if (!st.supervised) restart.disabled = true;
    if (st.stopping) {
      status.className = 'msg bad';
      status.textContent = st.stopping === 'restart'
        ? `กำลังนับถอยหลังรีสตาร์ท (${countdownTime(st.seconds ?? SHUTDOWN_SECONDS)}) — หน้านี้จะต่อไม่ได้ชั่วครู่ แล้วรีเฟรชใหม่`
        : `กำลังนับถอยหลังปิด server (${countdownTime(st.seconds ?? SHUTDOWN_SECONDS)})`;
    }
  };
  const go = async (mode: ShutdownMode, btn: HTMLButtonElement) => {
    const what = mode === 'restart' ? 'รีสตาร์ท server' : 'ปิด server';
    if (!confirm(`${what}?

ผู้เล่นทุกคนจะเห็นคำเตือนนับถอยหลัง ${countdownTime(Number(secs.value))} แล้วถูกเซฟและตัดการเชื่อมต่อ`)) return;
    btn.disabled = true;
    try {
      draw(await api<AdminServerState>('POST', '/admin/server', { mode, seconds: Number(secs.value) }));
    } catch (e) {
      status.className = 'msg bad';
      status.textContent = (e as Error).message;
      btn.disabled = false;
    }
  };
  cancel.onclick = async () => {
    cancel.disabled = true;
    try {
      draw(await api<AdminServerState>('POST', '/admin/server', { mode: 'cancel' }));
      status.className = 'msg ok';
      status.textContent = 'ยกเลิกแล้ว — ผู้เล่นได้รับแจ้ง และเข้าเกมได้ตามปกติ';
    } catch (e) {
      status.className = 'msg bad';
      status.textContent = (e as Error).message;
      cancel.disabled = false;
    }
  };
  restart.onclick = () => void go('restart', restart);
  stop.onclick = () => void go('shutdown', stop);
  const note = h('div', { class: 'muted', style: 'margin:-6px 0 10px' },
    `ทั้งสองแบบ: ผู้เล่นเห็นคำเตือนนับถอยหลังตามเวลาที่เลือก (${countdownTime(SHUTDOWN_CHOICES[0])}–${countdownTime(SHUTDOWN_CHOICES[SHUTDOWN_CHOICES.length - 1])}) และเข้าเกมใหม่ไม่ได้ระหว่างนั้น แล้ว server เซฟทุกคนก่อนตัดการเชื่อมต่อ · `
    + 'รีสตาร์ท = เปิดใหม่ด้วยโค้ดที่ build ไว้แล้ว (ไม่ build ใหม่) ลิงก์เพื่อนไม่เปลี่ยน · ปิด server = ปิดเลย ต้องเปิดใหม่เองที่เครื่อง');
  view.append(h('div', { class: 'card' }, h('h2', {}, 'รีสตาร์ท / ปิด server'), note, h('div', { class: 'row' }, secs, restart, stop, cancel), status));
  try {
    const st = await api<AdminServerState>('GET', '/admin/server');
    draw(st);
    if (!st.supervised && !st.stopping) {
      status.className = 'msg';
      status.textContent = 'server นี้ไม่ได้เปิดด้วย npm run online จึงรีสตาร์ทเองไม่ได้ (ปิดได้อย่างเดียว)';
    }
  } catch (e) {
    status.className = 'msg bad';
    status.textContent = (e as Error).message;
  }
}

/** The countdown banner wording for a restart and a shutdown (used by every way of stopping). */
/** Snapshot delta: the on/off switch and its counters (JSON before compression). */
/** Google login: on/off for the Login page's button, whether the client file is in place, who is linked (unlink). */
function googleCard(): HTMLElement {
  const msg = h('div', { class: 'msg' });
  const status = h('div', { style: 'margin-bottom:8px;line-height:1.7' });
  const toggle = h('button', { class: 'primary' }, '…');
  const list = h('div');
  let state: AdminGoogle | null = null;
  const fail = (e: Error) => {
    msg.className = 'msg bad';
    msg.textContent = e.message;
  };
  const load = (st: AdminGoogle) => {
    state = st;
    toggle.textContent = st.on ? 'ปิดการเข้าสู่ระบบด้วย Google' : 'เปิดการเข้าสู่ระบบด้วย Google';
    status.replaceChildren(
      h('div', {}, st.on ? (st.configured ? 'สถานะ: เปิด — หน้า Login มีปุ่ม Google' : 'สถานะ: เปิด แต่ยังไม่พบไฟล์ของ Google → ปุ่มยังไม่ขึ้น') : 'สถานะ: ปิด — ไม่มีปุ่ม Google (บัญชีที่ผูกไว้เข้าด้วยรหัสผ่านได้ บัญชีที่มีแต่ Google เข้าไม่ได้จนกว่าจะเปิด)'),
      st.configured
        ? h('div', { class: 'muted' }, `ไฟล์: ${st.file} · client id ลงท้าย …${st.clientIdTail} · redirect: ${st.redirectUris.join(', ')}`)
        : h('div', { class: 'muted' }, `วางไฟล์ JSON จาก Google Cloud Console ไว้ที่ (ที่แรกที่เจอ): ${st.paths.join(' · ')}`),
    );
    const rows = st.links.map((l) => h('tr', {},
      h('td', { 'data-label': 'ชื่อผู้ใช้', class: 'head' }, l.username),
      h('td', { 'data-label': 'Google' }, l.email + (l.name ? ` (${l.name})` : '')),
      h('td', { 'data-label': 'ผูกเมื่อ' }, time(l.linkedAt)),
      h('td', { 'data-label': 'รหัสผ่าน' }, l.hasPassword ? 'มี' : 'ไม่มี (Google อย่างเดียว)'),
      h('td', {}, h('button', {
        class: 'small danger',
        onclick: async () => {
          const warn = l.hasPassword ? '' : '\nบัญชีนี้ไม่มีรหัสผ่าน: เจ้าของบัญชีจะเข้าเกมไม่ได้จนกว่าจะรีเซ็ตรหัสผ่านให้';
          if (!confirm(`ยกเลิกการผูก Google ของ ${l.username} (${l.email})?${warn}`)) return;
          try {
            load(await api<AdminGoogle>('POST', '/admin/google', { unlink: l.accountId }));
            msg.className = 'msg ok';
            msg.textContent = `ยกเลิกการผูกของ ${l.username} แล้ว`;
          } catch (e) {
            fail(e as Error);
          }
        },
      }, 'ยกเลิกการผูก')),
    ));
    list.replaceChildren(
      h('h3', {}, `บัญชีที่ผูก Google (${st.links.length})`),
      st.links.length
        ? h('table', { class: 'cards' }, h('thead', {}, h('tr', {}, ...['ชื่อผู้ใช้', 'Google', 'ผูกเมื่อ', 'รหัสผ่าน', ''].map((t) => h('th', {}, t)))), h('tbody', {}, ...rows))
        : h('div', { class: 'muted' }, 'ยังไม่มี'),
    );
  };
  toggle.onclick = async () => {
    if (!state) return;
    if (state.on && !confirm('ปิดการเข้าสู่ระบบด้วย Google? บัญชีที่มีแต่ Google (ไม่มีรหัสผ่าน) จะเข้าเกมไม่ได้จนกว่าจะเปิดกลับ')) return;
    toggle.disabled = true;
    try {
      load(await api<AdminGoogle>('POST', '/admin/google', { on: !state.on }));
      msg.className = 'msg ok';
      msg.textContent = 'บันทึกแล้ว — มีผลทันที';
    } catch (e) {
      fail(e as Error);
    } finally {
      toggle.disabled = false;
    }
  };
  void api<AdminGoogle>('GET', '/admin/google').then(load, fail);
  return h('div', { class: 'card' }, h('h2', {}, 'เข้าสู่ระบบด้วย Google'),
    h('div', { class: 'muted', style: 'margin:-6px 0 10px' },
      'ปุ่ม "เข้าสู่ระบบด้วย Google" ที่หน้า Login · ผู้เล่นผูก Google กับบัญชีเดิมได้ที่หน้าเลือกตัวละคร/เมนูระบบ (รหัสผ่านเดิมยังใช้ได้) · Guest บันทึกตัวละครเป็นบัญชี Google ได้ · เก็บแค่รหัสบัญชี Google อีเมล และชื่อ'),
    status, h('div', { class: 'row', style: 'margin:8px 0' }, toggle), msg, list);
}

function snapDeltaCard(): HTMLElement {
  const msg = h('div', { class: 'msg' });
  const status = h('div', { style: 'margin-bottom:8px' });
  const numbers = h('div', { class: 'muted', style: 'line-height:1.7' });
  const toggle = h('button', { class: 'primary' }, '…');
  const refresh = h('button', { class: 'small' }, 'รีเฟรชตัวเลข');
  let state: AdminSnapDelta | null = null;
  const kb = (n: number) => `${fmt(Math.round(n / 1024))} KB`;
  const load = (st: AdminSnapDelta) => {
    state = st;
    status.textContent = st.on ? 'สถานะ: เปิดอยู่ — ส่งค่าที่แทบไม่เปลี่ยนเฉพาะตอนเปลี่ยน' : 'สถานะ: ปิดอยู่ — ส่ง snapshot เต็มทุกครั้ง (แบบเดิม)';
    toggle.textContent = st.on ? 'ปิด (ส่งเต็มทุกครั้ง)' : 'เปิด';
    const s = st.stats;
    const whole = s.sentBytes + s.savedBytes;
    const pct = whole ? Math.round((s.savedBytes / whole) * 1000) / 10 : 0;
    numbers.replaceChildren(
      h('div', {}, `นับตั้งแต่ ${time(s.since)} · ส่ง snapshot ${fmt(s.snaps)} ครั้ง (แบบลดขนาด ${fmt(s.deltaSnaps)})`),
      h('div', {}, `ข้อมูล JSON ที่ส่ง ${kb(s.sentBytes)} · ประหยัดได้ ${kb(s.savedBytes)} (${pct}% ของ JSON ก่อนบีบอัด — เน็ตจริงหลังบีบอัดลดน้อยกว่านี้)`),
      h('div', {}, `ส่งค่าของตัวเองใหม่ ${fmt(s.meResends)} ครั้ง · ส่งข้อมูลหน้าตาผู้เล่น/มอนใหม่ ${fmt(s.lookResends)} ครั้ง`),
      h('div', {}, `ผู้เล่นออนไลน์ตอนนี้: รองรับการลดขนาด ${fmt(st.clients.delta)} คน · แท็บเก่าที่ได้แบบเต็ม ${fmt(st.clients.full)} คน`),
    );
  };
  const fail = (e: Error) => {
    msg.className = 'msg bad';
    msg.textContent = e.message;
  };
  toggle.onclick = async () => {
    if (!state) return;
    toggle.disabled = true;
    try {
      load(await api<AdminSnapDelta>('POST', '/admin/snap-delta', { on: !state.on }));
      msg.className = 'msg ok';
      msg.textContent = 'บันทึกแล้ว — มีผลทันทีกับทุกคน (ตัวนับเริ่มใหม่)';
    } catch (e) {
      fail(e as Error);
    } finally {
      toggle.disabled = false;
    }
  };
  const reload = () => void api<AdminSnapDelta>('GET', '/admin/snap-delta').then(load, fail);
  refresh.onclick = reload;
  reload();
  return h('div', { class: 'card' }, h('h2', {}, 'ลดขนาด snapshot (เน็ตขาออก)'),
    h('div', { class: 'muted', style: 'margin:-6px 0 10px' },
      'ค่าที่แทบไม่เปลี่ยน (ตัวกรองของ ตั้งค่า Auto สเตตัส สกิล เควส · ชื่อ/คลาส/ของแต่งตัวของผู้เล่นอื่น · ชนิด/เลเวลมอน) ส่งเฉพาะตอนเปลี่ยน · เข้าเกม/เปลี่ยนแมพ/CH ได้ครบเสมอ · ปิดไว้ = ส่งเต็มทุกครั้งแบบเดิม (ใช้ถ้าสงสัยว่าภาพในเกมเพี้ยน)'),
    status, numbers, h('div', { class: 'row', style: 'align-items:center;margin-top:8px' }, refresh, h('span', { style: 'flex:1' }), toggle), msg);
}

/** The papercraft map art switch (src/shared/paperArt.ts): which pictures every player's game loads. */
function paperMapsCard(): HTMLElement {
  const msg = h('div', { class: 'msg' });
  const status = h('div', { style: 'margin-bottom:8px' }, 'กำลังโหลด…');
  const toggle = h('button', { class: 'primary' }, '…');
  let state: AdminPaperMaps | null = null;
  const load = (st: AdminPaperMaps) => {
    state = st;
    status.textContent = st.on ? 'สถานะ: เปิดอยู่ — ภาพกระดาษตัดแปะ' : 'สถานะ: ปิดอยู่ — ภาพเดิม';
    toggle.textContent = st.on ? 'ปิด (กลับเป็นภาพเดิม)' : 'เปิดภาพกระดาษ';
  };
  const fail = (e: Error) => {
    msg.className = 'msg bad';
    msg.textContent = e.message;
  };
  toggle.onclick = async () => {
    if (!state) return;
    toggle.disabled = true;
    try {
      load(await api<AdminPaperMaps>('POST', '/admin/paper-maps', { on: !state.on }));
      msg.className = 'msg ok';
      msg.textContent = 'บันทึกแล้ว — ทุกคนจะเห็นตอนเปิดหน้าเกมใหม่ (คนที่อยู่ในเกมตอนนี้ยังเห็นภาพเดิมจนกว่าจะรีเฟรช)';
    } catch (e) {
      fail(e as Error);
    } finally {
      toggle.disabled = false;
    }
  };
  void api<AdminPaperMaps>('GET', '/admin/paper-maps').then(load, fail);
  return h('div', { class: 'card' }, h('h2', {}, 'ภาพกระดาษตัดแปะ (ทดลอง)'),
    h('div', { class: 'muted', style: 'margin:-6px 0 10px' },
      'ตอนนี้มีภาพกระดาษของแมพ 1–4 ห้องบอส เมืองกลาง แท่นเรียกบอส ชุดแคมป์ ประตูมิติ ขอบเกาะ มอนสเตอร์ และตัวละครทั้ง 3 คลาส · NPC และ UI ยังเป็นภาพเดิม · ตำแหน่ง ขนาด และการชนของทุกอย่างเหมือนเดิม'),
    status, h('div', { class: 'row', style: 'align-items:center;margin-top:8px' }, h('span', { style: 'flex:1' }), toggle), msg);
}

function shutdownTextCard(): HTMLElement {
  const msg = h('div', { class: 'msg' });
  const save = h('button', { class: 'primary' }, 'บันทึก');
  let state: AdminShutdownText | null = null;
  const rows = (['restart', 'shutdown'] as const).map((mode) => {
    const box = h('textarea', { rows: 2, maxLength: SHUTDOWN_TEXT_MAX + 20 }) as HTMLTextAreaElement;
    const count = h('span', { class: 'muted' });
    const preview = h('div', { class: 'shutdown-preview' });
    const reset = h('button', { class: 'small', title: 'ใส่ข้อความเริ่มต้นกลับในช่อง แล้วกดบันทึก' }, 'คืนค่าเริ่มต้น');
    reset.onclick = () => {
      if (!state) return;
      box.value = state.defaults[mode];
      update();
    };
    box.oninput = () => update();
    const el = h('div', { style: 'margin-bottom:12px' },
      h('div', { style: 'margin-bottom:4px' }, mode === 'restart' ? 'รีสตาร์ท' : 'ปิด server'),
      box, h('div', { class: 'row', style: 'margin-top:4px;align-items:center' }, count, h('span', { style: 'flex:1' }), reset), preview);
    return { mode, box, count, preview, el };
  });
  const update = () => {
    let bad = false;
    let changed = false;
    for (const r of rows) {
      const c = checkShutdownText(r.box.value);
      r.count.textContent = `${c.text.length}/${SHUTDOWN_TEXT_MAX}`;
      // textContent: the preview shows exactly what players get, never HTML.
      r.preview.className = c.error ? 'shutdown-preview bad' : 'shutdown-preview';
      r.preview.textContent = c.error ?? `ตัวอย่าง: ${shutdownWarning(r.mode, SHUTDOWN_SECONDS, c.text)}`;
      bad ||= !!c.error;
      changed ||= !!state && c.text !== state.texts[r.mode];
    }
    save.disabled = bad || !changed;
  };
  const load = (st: AdminShutdownText) => {
    state = st;
    for (const r of rows) r.box.value = st.texts[r.mode];
    update();
  };
  save.onclick = async () => {
    save.disabled = true;
    try {
      load(await api<AdminShutdownText>('POST', '/admin/shutdown-text', { restart: rows[0].box.value, shutdown: rows[1].box.value }));
      msg.className = 'msg ok';
      msg.textContent = 'บันทึกแล้ว — ใช้กับการนับถอยหลังครั้งต่อไป';
    } catch (e) {
      msg.className = 'msg bad';
      msg.textContent = (e as Error).message;
      update();
    }
  };
  save.disabled = true;
  void api<AdminShutdownText>('GET', '/admin/shutdown-text').then(load, (e: Error) => {
    msg.className = 'msg bad';
    msg.textContent = e.message;
  });
  return h('div', { class: 'card' }, h('h2', {}, 'ข้อความเตือนก่อนรีสตาร์ท / ปิด server'),
    h('div', { class: 'muted', style: 'margin:-6px 0 10px' },
      `ป้ายนับถอยหลังที่ผู้เล่นเห็น ใช้กับทุกวิธี (ปุ่มด้านบน, npm run stop-server, Ctrl+C) · ใส่ ${SHUTDOWN_TIME_TOKEN} ตรงที่ให้เกมแทนด้วยเวลาที่เหลือ เช่น "${SHUTDOWN_SECONDS} วินาที" (ต้องมี) · เกมใส่ ⚠ ข้างหน้าให้เอง`),
    ...rows.map((r) => r.el), h('div', { class: 'row', style: 'align-items:center' }, h('span', { style: 'flex:1' }), save), msg);
}
