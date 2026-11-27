// The NPC talk window and the lines NPCs say (owner 2026-11-26, docs/systems/world-and-ui.md "หน้าต่างคุย NPC").
// Clicking an NPC opens a talk window (big portrait on the left, what it says at the bottom, answers with icons above);
// walking past one shows a short line over its head. Set on /admin → ปรับสมดุล → "หน้าต่างคุย NPC", saved inside the
// balance tuning (`BalanceTuning.npcTalk`), only what differs from the code. Browser only: the server never reads it.
import type { NpcId } from './data/npcs';

export interface NpcTalkConfig {
  /** Clicking an NPC opens the talk window first. Off = its own window opens at once, as before. */
  on: boolean;
  /** "ซื้อ/ขายของ" grows the talk window into the merchant's shop (owner 2026-11-27). Off = the old small shop window. */
  shopPane: boolean;
  /** Short lines over NPC heads when the player walks near. */
  bubbles: boolean;
  /** How near (world units) the player must be for a line to show. */
  bubbleRange: number;
  /** How long a line stays up (seconds). */
  bubbleSec: number;
  /** The least time between two lines of the same NPC (seconds). */
  bubbleGap: number;
  /** What the NPC says when the window opens (one picked at random; "พูดคุย" picks another). */
  greet: Record<NpcId, string[]>;
  /** The lines over its head. */
  chat: Record<NpcId, string[]>;
  /** What the merchant says while shopping in the talk window (one picked at random); {0} {1} = the values SHOP_LINES names. */
  shop: Record<ShopLineKey, string[]>;
}

/** The merchant's lines in the shop inside the talk window (npcShopPane.ts), with what {0} and {1} stand for. */
export const SHOP_LINES = {
  open: { name: 'เปิดร้าน (แท็บซื้อ)', args: '' },
  openBuyback: { name: 'เปิดร้านที่แท็บซื้อคืน', args: '' },
  pick: { name: 'ใส่ของลงตะกร้า', args: '{0} = ชื่อของ, {1} = ทองที่ได้' },
  pickLegend: { name: 'ใส่ของตำนานลงตะกร้า', args: '{0} = ชื่อของ' },
  rarity: { name: 'ใส่ตามความหายาก', args: '{0} = ระดับ, {1} = จำนวนชิ้น' },
  sold: { name: 'ขายแล้ว', args: '{0} = ทองที่ได้' },
  soldMany: { name: 'ขายตะกร้ามากกว่า 3 ชิ้น', args: '{0} = ทองที่ได้' },
  bought: { name: 'ซื้อแล้ว', args: '{0} = ชื่อสินค้า, {1} = จำนวน' },
  boughtBack: { name: 'ซื้อคืนแล้ว', args: '{0} = ชื่อของ' },
  poor: { name: 'ทองไม่พอ', args: '' },
  full: { name: 'กระเป๋าเต็ม', args: '' },
  bound: { name: 'ของผูกตัว (ขายไม่ได้)', args: '' },
  orb: { name: 'ลูกแก้ว (ขายไม่ได้)', args: '' },
} as const;
export type ShopLineKey = keyof typeof SHOP_LINES;
export const SHOP_LINE_KEYS = Object.keys(SHOP_LINES) as ShopLineKey[];

export interface NpcTalkTuning {
  on?: boolean;
  shopPane?: boolean;
  bubbles?: boolean;
  bubbleRange?: number;
  bubbleSec?: number;
  bubbleGap?: number;
  greet?: Partial<Record<NpcId, string[]>>;
  chat?: Partial<Record<NpcId, string[]>>;
  shop?: Partial<Record<ShopLineKey, string[]>>;
}

/** Every NPC whose lines /admin can edit, in the order it lists them. */
export const TALK_NPCS: readonly NpcId[] = ['seeker', 'merchant', 'blacksmith', 'keeper', 'broker', 'crystal', 'navigator', 'stylist'];
export const TALK_NUMS = {
  bubbleRange: { name: 'ระยะเห็นคำพูดเหนือหัว (หน่วยแมพ)', range: [2, 20] as [number, number] },
  bubbleSec: { name: 'คำพูดค้าง (วิ)', range: [1, 15] as [number, number] },
  bubbleGap: { name: 'NPC ตัวเดิมพูดซ้ำทุก (วิ)', range: [3, 300] as [number, number] },
} as const;
export type TalkNumKey = keyof typeof TALK_NUMS;
export const TALK_NUM_KEYS = Object.keys(TALK_NUMS) as TalkNumKey[];
/** Limits on the lines (they go to every player). */
export const TALK_LINES_MAX = 8;
export const TALK_LINE_LEN = 150;

export function codeNpcTalk(): NpcTalkConfig {
  return {
    on: true,
    shopPane: true,
    bubbles: true,
    bubbleRange: 7,
    bubbleSec: 4,
    bubbleGap: 25,
    greet: {
      seeker: [
        'แสงแห่ง The Origin นำทางเจ้ามาถึงที่นี่… มีอะไรให้ข้าช่วยหรือ?',
        'ทุกมิติมีประตู และทุกประตูมีผู้เฝ้า เจ้าพร้อมจะเผชิญหน้ากับพวกมันแล้วหรือยัง?',
      ],
      merchant: [
        'ยินดีต้อนรับ! ยาดี ม้วนกระดาษดี ราคาเป็นมิตร มีของจะขายก็เอามาได้เลย',
        'เดินทางไกลต้องพกยาให้พอนะเพื่อน วันนี้จะรับอะไรดี?',
      ],
      blacksmith: [
        'อาวุธของเจ้าต้องการการดูแลหรือไม่? เอามาวางบนทั่งได้เลย',
        'เหล็กดีต้องตีตอนร้อน… อยากลองเสี่ยงตีบวกสักครั้งไหม?',
      ],
      keeper: [
        'ของมีค่าทุกชิ้นปลอดภัยในคลังของข้า ตัวละครทุกตัวในบัญชีเจ้าใช้ร่วมกันได้',
        'กุญแจทุกดอกอยู่กับข้า จะฝากหรือจะเบิกอะไรดี?',
      ],
      broker: [
        'ตลาดคึกคักทั้งวัน ฝากขายกับข้า ใครในเซิร์ฟก็มาซื้อได้',
        'ของขายได้แล้วเงินจะรอเจ้าอยู่ในกล่องรับของ อย่าลืมแวะมารับล่ะ',
      ],
      crystal: [
        'คริสตัลมิติเปล่งประกายเพื่อเจ้า… มีของหายากมาให้เลือกชมนะ',
        'ของแต่งตัวสวย ๆ ใบคูณ หินหายาก ข้ามีทั้งหมด',
      ],
      navigator: [
        'เหนือเกาะแห่งนี้ยังมีทะเลเมฆ… เจ้าอยากรู้ไหมว่าข้างบนนั้นมีอะไร?',
      ],
      stylist: [
        'อยากเปลี่ยนลุคหรือเปล่า? ข้ามีของแต่งตัวสวย ๆ มากมาย',
      ],
    },
    chat: {
      seeker: ['ประตูมิติกำลังสั่นไหว…', 'เจ้ากลับมาแล้วหรือ นักเดินทาง', 'ระวังตัวนอกกำแพงเมืองด้วย'],
      merchant: ['ยาสด ๆ มาแล้วจ้า!', 'ของดีราคาถูก แวะก่อนเพื่อน!', 'มีของจะขายไหม? ข้ารับหมด'],
      blacksmith: ['ตีบวกไหม? เหล็กกำลังร้อนเลย', 'โป๊ก! โป๊ก!', 'อาวุธดูทื่อไปนะ เอามาให้ข้าดูหน่อย'],
      keeper: ['ของฝากปลอดภัยแน่นอน', 'กระเป๋าเต็มแล้วหรือ? ฝากข้าได้', 'กุญแจ… อยู่ครบทุกดอก'],
      broker: ['ตลาดวันนี้คึกคักดี', 'ฝากขายได้ ใครก็มาซื้อได้', 'ราคาดีต้องรีบลงขาย!'],
      crystal: ['คริสตัลมิติส่องประกาย…', 'ของหายากมาใหม่นะ', 'อยากได้ลุคใหม่ไหม?'],
      navigator: ['ลมบนทะเลเมฆกำลังดี', 'เรือพร้อมออกเสมอสำหรับผู้กล้า'],
      stylist: ['แต่งตัวสวย ๆ ออกผจญภัยกัน!'],
    },
    shop: {
      open: ['เลือกดูได้ตามสบาย! อยากขายอะไรก็คลิกของในกระเป๋ามาได้เลย'],
      openBuyback: ['อ้าว เปลี่ยนใจเหรอ? ของที่ขายไปซื้อคืนได้ แต่แพงขึ้น 20% นะ'],
      pick: ['{0}… ข้าให้ {1} G'],
      pickLegend: ['โอ้โห {0} ของตำนานเลยนี่! จะขายจริงเหรอ?'],
      rarity: ['ของระดับ{0} {1} ชิ้น… ข้ารับหมด!'],
      sold: ['ตกลง! นี่ {0} G ของเจ้า'],
      soldMany: ['ว้าว ขนมาเยอะเลย! รับไป {0} G'],
      bought: ['ขอบใจนะ! {0} ×{1} ใช้ให้คุ้มล่ะ'],
      boughtBack: ['เอ้า คืนให้แล้ว {0} ดูแลให้ดีล่ะ'],
      poor: ['ทองไม่พอนะ… ไปล่ามอนมาเพิ่มก่อนแล้วค่อยมาใหม่'],
      full: ['กระเป๋าเต็มแล้ว! ขายอะไรออกก่อนสิ'],
      bound: ['อันนี้ผูกกับตัวเจ้า ข้ารับซื้อไม่ได้หรอก'],
      orb: ['ข้าไม่รับซื้อลูกแก้วนะ ลองเทรดหรือลงตลาดดู'],
    },
  };
}
const CODE = codeNpcTalk();

export function mergeNpcTalk(t: NpcTalkTuning | undefined): NpcTalkConfig {
  const c = codeNpcTalk();
  if (!t) return c;
  if (t.on !== undefined) c.on = t.on;
  if (t.shopPane !== undefined) c.shopPane = t.shopPane;
  if (t.bubbles !== undefined) c.bubbles = t.bubbles;
  for (const k of TALK_NUM_KEYS) if (t[k] !== undefined) c[k] = t[k]!;
  for (const id of TALK_NPCS) {
    if (t.greet?.[id]) c.greet[id] = [...t.greet[id]!];
    if (t.chat?.[id]) c.chat[id] = [...t.chat[id]!];
  }
  for (const k of SHOP_LINE_KEYS) if (t.shop?.[k]) c.shop[k] = [...t.shop[k]!];
  return c;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const sameLines = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((s, i) => s === b[i]);

/** Lines as saved: trimmed, empty ones dropped. Null = not a list of short strings. */
function checkLines(x: unknown): string[] | string {
  if (!Array.isArray(x)) return 'ต้องเป็นรายการข้อความ';
  if (x.length > TALK_LINES_MAX) return `ได้ไม่เกิน ${TALK_LINES_MAX} บรรทัด`;
  const out: string[] = [];
  for (const s of x) {
    if (typeof s !== 'string') return 'ต้องเป็นข้อความ';
    const t = s.replace(/\s+/g, ' ').trim();
    if (t.length > TALK_LINE_LEN) return `บรรทัดละไม่เกิน ${TALK_LINE_LEN} ตัวอักษร`;
    if (t) out.push(t);
  }
  return out;
}

export function checkNpcTalkTuning(x: unknown, strict: boolean): { tuning: NpcTalkTuning | undefined } | { error: string } {
  if (x === undefined) return { tuning: undefined };
  if (!isObj(x)) return strict ? { error: 'ค่าหน้าต่างคุย NPC ไม่ถูกต้อง' } : { tuning: undefined };
  const out: NpcTalkTuning = {};
  const fail = (msg: string): { error: string } | null => (strict ? { error: `หน้าต่างคุย NPC: ${msg}` } : null);
  for (const k of ['on', 'shopPane', 'bubbles'] as const) {
    if (x[k] === undefined) continue;
    if (typeof x[k] !== 'boolean') { const f = fail('สวิตช์ไม่ถูกต้อง'); if (f) return f; continue; }
    if (x[k] !== CODE[k]) out[k] = x[k] as boolean;
  }
  for (const k of TALK_NUM_KEYS) {
    const v = x[k];
    if (v === undefined) continue;
    const [lo, hi] = TALK_NUMS[k].range;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) { const f = fail(`${TALK_NUMS[k].name} ต้องอยู่ระหว่าง ${lo}–${hi}`); if (f) return f; continue; }
    const n = Math.round(v * 10) / 10;
    if (n !== CODE[k]) out[k] = n;
  }
  for (const part of ['greet', 'chat'] as const) {
    const v = x[part];
    if (v === undefined) continue;
    if (!isObj(v)) { const f = fail('ข้อความไม่ถูกต้อง'); if (f) return f; continue; }
    const lines: Partial<Record<NpcId, string[]>> = {};
    for (const [id, raw] of Object.entries(v)) {
      if (!(TALK_NPCS as readonly string[]).includes(id)) { const f = fail(`ไม่รู้จัก NPC "${id.slice(0, 20)}"`); if (f) return f; continue; }
      const c = checkLines(raw);
      if (typeof c === 'string') { const f = fail(c); if (f) return f; continue; }
      if (!sameLines(c, CODE[part][id as NpcId])) lines[id as NpcId] = c;
    }
    if (Object.keys(lines).length) out[part] = lines;
  }
  if (x.shop !== undefined) {
    const v = x.shop;
    if (!isObj(v)) { const f = fail('บทพูดในร้านไม่ถูกต้อง'); if (f) return f; }
    else {
      const lines: Partial<Record<ShopLineKey, string[]>> = {};
      for (const [k, raw] of Object.entries(v)) {
        if (!(SHOP_LINE_KEYS as string[]).includes(k)) { const f = fail(`ไม่รู้จักบทพูดร้าน "${k.slice(0, 20)}"`); if (f) return f; continue; }
        const c = checkLines(raw);
        if (typeof c === 'string') { const f = fail(c); if (f) return f; continue; }
        if (!sameLines(c, CODE.shop[k as ShopLineKey])) lines[k as ShopLineKey] = c;
      }
      if (Object.keys(lines).length) out.shop = lines;
    }
  }
  return { tuning: Object.keys(out).length ? out : undefined };
}

const onOff = (b: boolean): string => (b ? 'เปิด' : 'ปิด');
/** Audit lines of what differs between two configs. */
export function npcTalkChanges(a: NpcTalkConfig, b: NpcTalkConfig): string[] {
  const out: string[] = [];
  if (a.on !== b.on) out.push(`หน้าต่างคุย NPC ${onOff(a.on)} → ${onOff(b.on)}`);
  if (a.shopPane !== b.shopPane) out.push(`ร้านพ่อค้าในหน้าต่างคุย ${onOff(a.shopPane)} → ${onOff(b.shopPane)}`);
  if (a.bubbles !== b.bubbles) out.push(`คำพูดเหนือหัว NPC ${onOff(a.bubbles)} → ${onOff(b.bubbles)}`);
  for (const k of TALK_NUM_KEYS) if (a[k] !== b[k]) out.push(`${TALK_NUMS[k].name} ${a[k]} → ${b[k]}`);
  for (const id of TALK_NPCS) {
    if (!sameLines(a.greet[id], b.greet[id])) out.push(`บทพูดทักทาย ${id}: ${b.greet[id].length} บรรทัด (แก้ข้อความ)`);
    if (!sameLines(a.chat[id], b.chat[id])) out.push(`คำพูดเหนือหัว ${id}: ${b.chat[id].length} บรรทัด (แก้ข้อความ)`);
  }
  for (const k of SHOP_LINE_KEYS) {
    if (!sameLines(a.shop[k], b.shop[k])) out.push(`บทพูดร้านพ่อค้า "${SHOP_LINES[k].name}": ${b.shop[k].length} บรรทัด (แก้ข้อความ)`);
  }
  return out;
}
