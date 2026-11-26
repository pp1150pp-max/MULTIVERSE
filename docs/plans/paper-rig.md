# แผนทดลอง 2D rig (cutout animation) ให้มอน papercraft

สถานะ 2026-11-25: **เป็นแผนอย่างเดียว ยังไม่เริ่มทำ** รอเจ้าของตอบหัวข้อ 7

## 0. สรุปก่อนอ่าน

1. **ท่าปืนใหญ่ของปูยักษ์ไม่ได้ขาดภาพแล้ว** ปัญหาตอนนี้อยู่ที่โค้ด
   - PR #486 (merge เข้า `floor2` แล้ว) ตัดแผ่น `giant_crab` ครบ 4 ท่า: เดิน ก้ามหนีบ ปืนใหญ่ หดกระดอง (ยังไม่มีบน `main`)
   - เกมเล่นแค่ท่าเดินกับท่าที่ 2 เพราะ `Game.ts` (`case 'anim'`) ส่งให้มอนเฉพาะชื่อ `attack` และ `SpriteActor` รู้จักแค่ `attack`
   - แก้ได้ด้วย PR โค้ดเล็ก ๆ โดยไม่ต้องใช้ rig และไม่ต้องเจนภาพ (PR 0 ในหัวข้อ 6)
2. **เกมมีระบบกระดูก 2D ที่เขียนเองอยู่แล้ว** คือนักดาบกระดาษ ([sword-rig.md](../systems/sword-rig.md))
   - บน `main` มี: กระดูกแบบ parent, คีย์เฟรม, easing, ผสมท่า, `rig.json`, ตัวตัดชิ้น, ตัววาดพรีวิวเป็น PNG, แท่นใน `/admin`
   - **งานนี้เคยถูกพักเมื่อ 2026-11-17** หลังแก้หลายรอบแล้วท่ายังดูแปลก นี่คือความเสี่ยงอันดับหนึ่งของแผนนี้
3. **ข้อเสนอ:** ต่อยอดโค้ดเดิม ทดลองกับ **โกเลมแมกมา** 1 ตัว (เดิน ตี ตาย) ใช้ 3 PR ยังไม่ทำ editor แล้วค่อยตัดสินว่าจะไปต่อไหม

### rig คุ้มตอนไหน

| | sprite sheet (ตอนนี้) | rig |
|---|---|---|
| ภาพต่อมอน | 1 แผ่นต่อ 1 ท่า (5 มุม × 4 เฟรม) | แผ่นชิ้นส่วน 1 แผ่นต่อ 1 มุม ครั้งเดียว |
| เพิ่มท่าใหม่ | เจนภาพ + ตัดภาพ | เพิ่มคีย์เฟรม ไม่ต้องเจนภาพ (แต่ต้องมีคนจัดท่าให้ดูดี) |
| ความลื่น | 4 เฟรมต่อท่า | ลื่นตามเฟรมเรตของจอ |
| ขนาดไฟล์ต่อตัว | โกเลมแมกมา 2 ท่า ราว 2.2 MB (PNG), ปูยักษ์ 4 ท่า ราว 2.8 MB (WebP ตาม PR #486) | นักดาบทั้งชุดราว 1.1 MB (PNG: 2 มุม รวมเกราะเสริมและดาบ 3 แบบ) |
| ขนาดที่เพิ่มต่อ 1 ท่า | ภาพอีกชุดในแผ่น | คีย์เฟรมใน JSON ไม่กี่ KB |
| ของที่ทำไม่ได้ | - | ตัวนิ่ม (สไลม์ งู) และการหมุนตัวจริง ๆ ถ้าไม่มี mesh/หลายมุม |

rig คุ้มกับมอนหรือบอสที่มีหลายท่า มอนที่มีแค่เดินกับตีและมีภาพแล้ว ไม่จำเป็นต้องเปลี่ยน

## 1. ต้นเรื่อง

[โพสต์ในกลุ่ม AI Game Dev Thailand](https://www.facebook.com/groups/aigamedevthailand/permalink/1488947719808625/) (10 พ.ย. 2026): ให้ AI ช่วยสร้าง tool editor ของตัวเองสำหรับ rig ตัวละคร แล้ว export JSON เข้าเกม แผนนี้อ้างจาก**ข้อความในโพสต์** ยังไม่ได้ดูวิดีโอในโพสต์

| ความสามารถในโพสต์ | MULTIVERSE ตอนนี้ | ในการทดลองนี้ |
|---|---|---|
| Bone, parent grouping | มี (`rigMath.ts`) | ใช้ |
| Timeline ที่คนจัดท่าเอง | มีคีย์ใน `rig.json` ไม่มีหน้าจอลากแก้ | แก้ JSON + ดูในแท่น `/admin` |
| IK | ไม่มีบน `main` (เคยลองใน commit `ed84de4` ที่ไม่ได้อยู่บน `main`) | ไม่ทำ |
| Mesh + paint weight (ส่วนที่พริ้ว) | ไม่มี | ไม่ทำ |
| State machine / event แบบ Rive | มีกติกาท่าไหนแทรกท่าไหนในโค้ด | ใช้ event ที่ Sim ส่งอยู่แล้ว ไม่ทำ editor |
| Nesting asset, multi timeline, physics | ไม่มี | ไม่ทำ |
| Export JSON | `rig.json` | ใช้ |

ข้อควรรู้: โพสต์บอกว่าเจ้าของ tool ใช้เวลาทำหลายเดือน และยัง animate ทุก timeline เอง AI ช่วยเรื่องสร้าง tool ได้ แต่ tool ไม่ได้ทำท่าสวย ๆ ให้เอง

## 2. เทียบทางเลือก

| | Spine | DragonBones / LoongBones | เขียนเองต่อจากของเดิม (แนะนำ) |
|---|---|---|---|
| ค่าใช้จ่าย | Essential $69 / Professional $379 ครั้งเดียวต่อคน ¹ รายได้เกิน $500,000/ปีต้องใช้ Enterprise (รายปี) | DragonBones ฟรี ส่วน LoongBones ยังไม่ได้ยืนยันราคา | ฟรี จ่ายเป็นโทเคนและเวลา |
| license runtime | ต้องมี license ของ editor ตอนเอา runtime ใส่เกม ² | MIT | ของเรา |
| editor | ดีที่สุด ครบ (IK, mesh, weight, physics) แต่ mesh และฟีเจอร์ขั้นสูงไม่มีใน Essential | DragonBones เลิกพัฒนาแล้ว ³ โครงการแนะนำให้ใช้ LoongBones | ยังไม่มี ต้องสร้าง (หัวข้อ 6 ระยะ 2) |
| runtime Three.js | ทางการ: `@esotericsoftware/spine-threejs` (ยังไม่ได้ยืนยันว่ารองรับ three `0.170` ที่เราใช้ และระบุว่าไม่รองรับ two color tinting) | มีโฟลเดอร์ ThreeJS ใน DragonBonesJS ⁴ ยังไม่ได้ยืนยันว่าดูแลอยู่ fork ชุมชนรองรับถึง r148 และไม่พบ runtime Three.js ของ LoongBones | มีแล้ว (`rigMath.ts`) |
| เจ้าของแก้ในเว็บ `/admin` | ไม่ได้ ต้องแก้ในโปรแกรม | ไม่ได้ในเกมเรา | ได้ (ทำแบบตัวแก้แมพ) |
| เสี่ยง | ต้องเรียนโปรแกรม ผูกกับผู้ขาย ต้องอ่านเงื่อนไข license ให้ชัดก่อนใช้ | สูง: เครื่องมือเก่า ต้องดูแล runtime เอง | ท่าออกมาดูแปลกแบบรอบนักดาบ และ editor บานปลาย |

**แนะนำ:** เขียนเองต่อจากของเดิม เพราะส่วนที่เล่นในเกมมีแล้ว ข้อมูลเป็น JSON แบบตัวแก้แมพ และไม่มีค่า license ถ้าท่าดูดีแต่สร้าง editor เองแพงเกินไป ค่อยพิจารณา Spine Professional ไม่แนะนำ DragonBones

¹ ราคาจากหน้าซื้อของ Spine เมื่อ 2026-11-25 (หน้าเว็บแสดงคู่กับ $99 และ $449) ² ข้อความ license เรื่องผู้ใช้ปลายทางอ่านได้หลายแบบ ถ้าจะใช้ต้องถามผู้ขายก่อน

แหล่งข้อมูล: [Spine purchase](https://esotericsoftware.com/spine-purchase) · [Spine runtimes license](https://esotericsoftware.com/spine-runtimes-license) · [spine-ts](https://github.com/EsotericSoftware/spine-runtimes/tree/4.3/spine-ts) · ³ [Lospec: DragonBones](https://lospec.com/software/dragonbones) · ⁴ [DragonBonesJS](https://github.com/DragonBones/DragonBonesJS) · [fork dragonbones-threejs](https://github.com/FlySkyPie/dragonbones-threejs)

## 3. การเล่นในเกม (`src/client`)

### 3.1 ใช้อะไรซ้ำได้

| ไฟล์ | ใช้ได้ไหม |
|---|---|
| `rig/rigMath.ts` | ใช้ซ้ำ ต้องเพิ่ม: **คีย์เลื่อนตำแหน่งรายกระดูก** (ตอนนี้กระดูกหมุนได้อย่างเดียว เลื่อนได้แค่ทั้งตัว ท่าตายแบบหินแตกต้องใช้) และช่อง `hit` บอกจังหวะโดนของท่าตี |
| `rig/RigActor.ts` | ไม่ใช้ตรง ๆ เพราะผูกกับนักดาบ (โฟลเดอร์, อาวุธ/เกราะ, `sword.rig.*`, ห่อ `AnimatedActor`) และสร้าง mesh แยกทุกชิ้น |
| `tools/cut_rig_parts.mjs` | ต้องทำให้ทั่วไป: ตอนนี้เขียนรายชื่อแผ่นของนักดาบตายตัว และตัดพื้นม่วงแดงอย่างเดียว ให้ใช้ `keyBg` ใน `tools/paper_key.cjs` ที่รู้จักพื้นเขียวด้วย |
| `tools/rig_preview.ts`, `rigPreview.ts` | ใช้เป็นต้นแบบพรีวิว PNG และแท่นใน `/admin` |

### 3.2 ต่อกับ `assets.ts`

- ไฟล์ต่อมอน: `public/assets/sprites/paper/rigs/<id>/rig.json` + `atlas.png` (ชิ้นทุกมุมรวมภาพเดียว เว้นขอบกันสีข้างเคียงเลอะ)
- รายชื่อมอนที่มี rig: `paper/rigs/index.json` ไฟล์แยก ไม่ใส่ใน `meta.json` เพราะตัวตัด sprite เขียนทับค่าของมอนที่ตัดใหม่
- `assets.ts` โหลดเข้า `monsterRigs[id]` ผ่าน `loadTexture` (ได้ WebP ตอน build และนับในหลอดโหลด)
- **sprite sheet เดิมยังโหลดอยู่** เป็นตัวสำรองเมื่อ rig ปิดหรือโหลดไม่ได้ (ระหว่างทดลองจึงยังไม่ประหยัดขนาดดาวน์โหลด)
- `MonsterView` เลือก `rig ที่เปิดอยู่ ? MonsterRigActor : SpriteActor` ตอนนี้ `actor` ถูกกำหนด type เป็น `SpriteActor` จึงต้องทำ interface ที่มี `setLift`, `setOpacity` และลำดับวาดของบอส (`sprite.renderOrder`) ด้วย

### 3.3 ประสิทธิภาพ (ต้องทำตั้งแต่แรก)

แมพฟาร์มชั้น 1 มีมอนราว 200 ตัว ถ้าทำแบบ `RigActor` เดิมคือ 1 ชิ้น = 1 draw call มอน 200 ตัว × 11 ชิ้น อาจถึงราว 2,200 draw call (กรณีเห็นพร้อมกันทั้งหมด) มือถือไม่ไหว

- `MonsterRigActor` ต้องรวมชิ้นเป็น geometry เดียว ใช้ atlas + material เดียว = **1 draw call ต่อตัว** เท่ากับ sprite
- คำนวณกระดูกและอัปเดต vertex เฉพาะตัวที่อยู่ในจอ
- วัดเวลาเฟรมเทียบกับ sprite ที่ 100 ตัว ก่อนตัดสินว่าผ่าน

### 3.4 จับคู่เหตุการณ์ในเกมกับท่า

Sim และ server ไม่ต้องแก้

| ในเกม | rig |
|---|---|
| `m.moving` | `walk` วนซ้ำ เดินเล่นช้า ไล่ผู้เล่นเร็วขึ้น |
| ยืนเฉย | หายใจเบา ๆ (คีย์ 2–3 จุด) |
| event `anim` ชื่อ `attack` + `duration` = เวลาง้าง | `attack` ยืดให้จังหวะ `hit` ตรงตอนง้างจบ (มอนธรรมดา 0.35 วิ × ตัวคูณ) |
| event ชื่ออื่นที่มี `fallback` | เล่นท่าชื่อนั้นถ้ามี ไม่มีก็ใช้ `attack` |
| `!m.alive` | `death` เล่นครั้งเดียว |
| โดนตี / เอฟเฟกต์ดีบัฟ / วงเวท | ย้อมสีทั้งตัว ส่วนเอฟเฟกต์เกาะ `group` เหมือนเดิม |

**ท่าตายมีเวลาจำกัด:** Sim ลบมอนเมื่อ `deadT > 0.9` วิ แล้วภาพหายทันที ท่าตายจึงต้องจบใน ~0.8 วิ (ตอนนี้คือจางและจมลง) ถ้าอยากยาวกว่านั้น ต้องให้เบราว์เซอร์เก็บ "ซาก" ไว้เอง ดูข้อตัดสินใจ 4

### 3.5 มุมมอง

sprite มอนตอนนี้มี 5 แถว กลับซ้ายขวาได้ 8 ทิศ ส่วน `rigMath` มีแค่หน้าเฉียงกับหลังเฉียง = 4 ทิศ ทดลองด้วย 2 มุมก่อน ทุกมุมที่เพิ่มคือแผ่นภาพอีกแผ่น ชุดจัดกระดูกอีกชุด และเสี่ยงที่ชิ้นระหว่างแผ่นไม่ตรงกัน

### 3.6 `/admin` (กติกาโปรเจกต์: ระบบใหม่ต้องตั้งค่าได้)

- สวิตช์ rig รายมอน **ค่าในโค้ดปิด** บันทึกทั้งเซิร์ฟ เก็บเฉพาะที่ต่างจากโค้ด ลง `admin_audit`
- แท่นดูท่า: เทียบ sprite กับ rig ข้างกัน เลือกท่า ทิศ ความเร็ว และจำนวนตัว (ดูเรื่องกระตุก)
- สิทธิ์: เสนอแบบแท็บ "ท่าตัวละคร" คือ owner+GM ดู และ owner บันทึก

## 4. ภาพจาก GPT แบบแยกชิ้น

เจ้าของเป็นคนเจน กติกาของแผ่น:

- 1 แผ่นต่อ 1 มุม: หน้าเฉียงหันซ้าย และหลังเฉียงหันซ้าย (หันขวาคือกลับภาพ)
- พื้นเขียวเรียบ `#00FF00` และห้ามมีสีเขียวบนตัวมอน (มอนสีเขียว เช่น สไลม์ งูหนอง ต้องใช้พื้นม่วงแดง `#FF00FF` แทน)
- ชิ้นไม่แตะกัน ขนาดสเกลเดียวกัน วาดเต็มชิ้นแม้ส่วนที่ปกติถูกบัง ปลายข้อต่อยื่นเกินนิดหน่อยให้ซ้อนใต้ชิ้นข้าง ๆ
- ลำดับชิ้นตายตัว (ตัวตัดตั้งชื่อจากลำดับ) และมีตัวประกอบเสร็จที่มุมขวาล่างไว้อ้างอิงตำแหน่งข้อต่อ

โกเลมแมกมา 11 ชิ้น: หัว, อก, สะโพก, ต้นแขน ×2, ปลายแขนติดหมัด ×2, ต้นขา ×2, เท้า ×2

**วิธีเจน:** เปิดแชทใหม่ แนบ `public/assets/sprites/paper/monsters/magma_golem.png` เจนมุมหน้าก่อน ตรวจ แล้วเจนมุมหลังในแชทเดียวกัน เซฟเป็น `art_templates/papercraft_chars/raw/rigs/magma_golem_front.png` และ `magma_golem_back.png` (โฟลเดอร์ `raw/` ไม่ commit)

### ตัวอย่าง prompt: มุมหน้าเฉียง

```
The attached image is the magma golem from my game, a papercraft sprite sheet. Use its design only, not its grid layout.
Generate an image: a PARTS SHEET for a 2D paper puppet of this SAME golem, seen in three-quarter front view turned toward the LEFT, in EXACTLY the same papercraft style, colours and proportions: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, warm soft light from the upper left. NOT pixel art.
Exactly 11 separate pieces in 3 rows, all at the same scale, NOT touching or overlapping, with wide clear space between them. In reading order, left to right, top to bottom:
Row 1: (1) the head with its flame crest; (2) the chest with the glowing magma core, without head or arms; (3) the hips block.
Row 2: (4) the upper arm nearer to the viewer, with its shoulder rock; (5) the near forearm with its fist; (6) the far upper arm with its shoulder rock; (7) the far forearm with its fist.
Row 3: (8) the near thigh; (9) the near foot; (10) the far thigh; (11) the far foot.
Draw every piece completely, including areas normally hidden behind other pieces. Each limb piece extends a little past its joint with a rounded rock end, so it can tuck under the neighbouring piece when it rotates. In the bottom right corner, also draw the whole golem assembled, standing in the same view, as a reference.
Background ONE perfectly flat solid pure bright green (#00FF00). No shadows on the background, no ground, no text, no labels, no numbers, no grid lines, no effects, no sparks, no smoke. Do not use green anywhere on the golem.
```

### ตัวอย่าง prompt: มุมหลังเฉียง (แชทเดิม)

```
Now the parts sheet of the SAME golem seen in three-quarter BACK view turned toward the LEFT (we mostly see its back). Exactly the same 11 pieces in the same order, same rows, same scale and the same papercraft style, with the assembled golem in this back view in the bottom right corner. Background ONE perfectly flat solid pure bright green (#00FF00), no text, no labels, no numbers. Do not use green anywhere on the golem.
```

ถ้าชิ้นไม่ครบหรือติดกัน: `Redo it with exactly 11 separate pieces in the listed order, none touching, same scale.`

## 5. ขอบเขตการทดลอง

### 5.1 เลือกมอน

| เกณฑ์ | โกเลมแมกมา | อัศวินเถ้าถ่าน | ผีโคลน |
|---|---|---|---|
| ไม่มีสีเขียว | ✅ | ✅ | ❌ มีคราบเขียวและตาเขียว |
| ชิ้นแข็ง ไม่ต้องมี mesh | ✅ ก้อนหินแยกกันอยู่แล้ว | ✅ เกราะ (ขนนกบนหมวกต้องแกว่ง) | ❌ โคลนหยดย้อย |
| ไม่ใช่บอส ท่าตีเดียว | ✅ Lv37–38 | ✅ Lv39 | ✅ Lv16–17 |
| รอยต่อซ่อนง่าย | ✅ รอยแยกหินดูเป็นธรรมชาติ | กลาง: ดาบกับโล่บังตัว | ยาก |
| ใกล้โครงกระดูกนักดาบ | กลาง | ✅ ใกล้ที่สุด | กลาง |

**แนะนำโกเลมแมกมา:** โอกาสดูดีสูงสุด ตัวใหญ่มองเห็นชัด เดินช้า และท่าตาย "ก้อนหินหลุดร่วง" ใช้ชิ้นเดิมได้เลย ซึ่ง sprite ตอนนี้ไม่มีท่าตาย
อัศวินเถ้าถ่านเป็นตัวรอง ถ้าอยากทดสอบว่าจะใช้กับตัวคน (อาชีพ, NPC) ต่อได้ไหม

### 5.2 ท่า

| ท่า | เนื้อหา |
|---|---|
| เดิน | วน ~1 วิ ก้าวหนัก ตัวโยกขึ้นลง แขนแกว่งสวนขา |
| ตี | ง้างหมัด → ต่อยพุ่ง (`hit`) → ดึงกลับ |
| ตาย | ≤0.8 วิ ตัวทรุด ชิ้นหลุดร่วงลงพื้น จางหายช่วงท้าย |
| ยืน (แถม) | หายใจเบา ๆ |

### 5.3 เกณฑ์ผ่าน

1. เจ้าของดูเทียบในแท่น `/admin` แล้วตอบว่าดูดีไม่แพ้ sprite เดิม
2. 100 ตัวบนจอ เวลาเฟรมแย่กว่า sprite ไม่เกิน 10% (ตัวเลขเสนอ)
3. ภาพต่อมอน (WebP) ไม่เกิน 500 KB (ตัวเลขเสนอ)
4. เพิ่มท่าใหม่ 1 ท่า (เช่น ทุบพื้น) ได้โดยไม่เจนภาพ นี่คือประโยชน์หลักที่ต้องพิสูจน์
5. **กติกาหยุด:** แก้ท่าตามความเห็นเจ้าของครบ 2 รอบแล้วยังไม่ผ่าน = หยุด ไม่ทำระยะ 2

## 6. ประมาณงาน

| PR | งาน | base | โมเดล | context ต่อ session (เดาคร่าว ๆ) |
|---|---|---|---|---|
| 0 (แยกจาก rig) | มอนเล่นท่าตามชื่อใน `moves` (ปืนใหญ่ หดกระดอง ตะโกน ฯลฯ) | `floor2` | Sonnet | 80–150k |
| 1 | ตัวตัดชิ้นแบบทั่วไป (พื้นเขียว) + ชิ้นโกเลม + `rig.json` ท่าเดิน/ตี + พรีวิว PNG | `main` | Sonnet | 150–200k |
| 2 | `MonsterRigActor` (1 draw call) + โหลดใน `assets.ts` + `MonsterView` + สวิตช์และแท่น `/admin` | `main` | Opus | 150–250k |
| 3 | คีย์เลื่อนรายกระดูก + ท่าตาย + ท่าทดสอบที่ 4 + วัดความเร็ว + แก้ท่ารอบ 1–2 + เอกสารใน `docs/systems/` | `main` | Opus | 150–250k |
| ระยะ 2 (ถ้าผ่าน) | editor ใน `/admin`: จุดหมุนและลำดับชิ้น → timeline → ร่าง/เผยแพร่/ย้อนแบบตัวแก้แมพ | `main` | Opus | 3 PR ขึ้นไป PR ละ 150–300k |

PR 1 ต้องรอภาพจาก GPT ส่วน PR 0 ไม่ต้องรออะไร ตัวเลขโทเคนไม่ได้วัดจากงานจริง ใช้เทียบขนาดเท่านั้น

### ความเสี่ยง

| ความเสี่ยง | ระดับ | วิธีกัน |
|---|---|---|
| แก้ท่าวนหลายรอบแล้วยังดูแปลก (เกิดแล้วกับนักดาบ) | สูง | เลือกตัวชิ้นแข็ง, กติกาหยุด 2 รอบ, เจ้าของลองในแท่นเอง |
| โทเคนหมดกับการดูภาพ/วิดีโอ | สูง | ดูพรีวิว PNG ย่อ, ขอก่อนแคปจอ, 1 PR ต่อ session และไม่เกิน ~200k (เกินให้ส่งต่อ) |
| editor บานปลาย | สูง | ไม่เริ่มก่อนผ่านเกณฑ์ 5.3 |
| GPT วาดชิ้นไม่ครบ ไม่เท่ากัน หรือหน้าหลังไม่ตรงกัน | กลาง | ตรวจด้วย `--list` ของตัวตัด, เจนในแชทเดียวกัน |
| มอน rig 4 ทิศอยู่ข้างมอน 8 ทิศแล้วดูต่างกัน | กลาง | ให้เจ้าของดูในแมพจริง |
| มือถือกระตุก | กลาง | 1 draw call + วัดที่ 100 ตัว |

**งานนักดาบที่พักไว้:** branch `feature/sword-rig` มีงานรอบ 5 ที่ยังไม่ push (`60dbb0a`) แผนนี้ไม่แตะ branch นั้น ถ้าวันหลังกลับไปทำ ห้ามสร้าง `knight.blend` ใหม่ทับ เพราะท่าที่เจ้าของแก้จะหาย

## 7. เรื่องที่เจ้าของต้องตัดสิน

| # | คำถาม | ที่แนะนำ | ทางอื่น |
|---|---|---|---|
| 1 | ใช้เครื่องมืออะไร | เขียนเองต่อจากของเดิม | Spine Professional / DragonBones |
| 2 | ทดลองมอนตัวไหน | โกเลมแมกมา | อัศวินเถ้าถ่าน |
| 3 | กี่มุม | 2 มุม (4 ทิศ) | มากกว่า 2 มุม (เจนภาพและงานเพิ่ม) |
| 4 | ท่าตาย | จบใน 0.8 วิ ตามเวลาเดิม | ยาวกว่า โดยเก็บซากไว้ในเบราว์เซอร์ |
| 5 | ใครเห็น rig | สวิตช์ใน `/admin` ปิดเป็นค่าเริ่ม เปิดเมื่อผ่าน | เฉพาะเบราว์เซอร์เจ้าของแบบนักดาบ |
| 6 | editor เมื่อไร | หลังทดลองผ่าน (ระหว่างนั้นให้ AI แก้ `rig.json`) | ทำ editor ก่อน เพื่อให้เจ้าของจัดท่าเอง |
| 7 | ท่าบอสปู/กัปตันที่มีภาพแล้ว | ทำ PR 0 เลย ไม่ต้องรอ rig | รอ |
| 8 | เกณฑ์ผ่านข้อ 5.3 (10%, 500 KB, 2 รอบ) | ตามที่เสนอ | ปรับตัวเลข |
| 9 | เจนแผ่นชิ้นส่วนใน GPT เองใช่ไหม และเริ่มเมื่อไร | เจ้าของเจนตามหัวข้อ 4 | ยังไม่เริ่ม |
