# บอสปูยักษ์กระดองปืนใหญ่ (`cannon_crab`): prompt สำหรับเจนใน ChatGPT

บอสแมพ 1 ชั้น 2 (หาดเรือแตก Lv50) ต่อภาพกระดาษเข้าเกมแล้ว (ดูหัวข้อ "สถานะภาพ" ท้ายไฟล์) ไฟล์นี้คือ prompt ชุดที่ใช้เจน
ท่าของบอสอยู่ใน `docs/plans/FLOOR2_PLAN.md` หัวข้อ 5.1 · prompt ชุดเดียวกันนี้มีใน `art_templates/papercraft_maps/FLOOR2_M1_BEACH.md` ข้อ 8 แล้ว ไฟล์นี้แค่รวมให้ copy ไปวางได้ทีละก้อน

เจ้าของเลือก (2026-11-24): ชุด 4 ท่าเต็ม ใช้หน้าตาเดิมตามแผน

## ภาพที่ต้องเจน (4 ภาพ)

| ไฟล์ดิบ | ท่า | ใช้ตอนไหน |
|---|---|---|
| `giant_crab_walk.png` | เดินข้าง | เดิน / เดินข้างหลบเร็ว |
| `giant_crab_cannon.png` | ยิงปืนใหญ่ | ปืนใหญ่แนวโค้ง และระดมยิงตอนเลือดน้อย |
| `giant_crab_claw.png` | ก้ามหนีบ | จับผู้เล่นแล้วเหวี่ยง |
| `giant_crab_shell.png` | หดกระดอง | เลือดน้อย หดกระดองกันดาเมจ |

แต่ละภาพเป็นแผ่น **5 แถว (มุม) × 4 เฟรม** แบบเดียวกับมอนชั้น 1 (`papercraft_chars/MONSTERS.md`) พื้นหลังม่วงแดง `#FF00FF` บอสตัวใหญ่ราว 3 เท่าของฮีโร่ (ในแผ่นทุกเฟรมขนาดตัวเท่ากัน)

## วิธีเจน

1. **เปิดแชทใหม่** แนบภาพเดียวคือ `art_templates/papercraft_maps/raw/floor2_maps/M1_shipwreck_beach.webp`
   - **ห้ามแนบภาพพิกเซล** ทุกภาพในเกมใช้กระดาษตัดแปะสไตล์เดียว
   - ถ้าอยากให้หน้าตาตรงกับมอนชั้น 1 ก็แนบ `art_templates/papercraft_maps/raw/ref/A2_monsters_forest_marsh.png` เพิ่มได้ (เป็นภาพกระดาษ)
2. เจนทั้ง 4 ภาพในแชทเดียวกัน หน้าตาปูจะได้เหมือนกัน เจนภาพเดิน (ภาพที่ 1) ก่อน ตรวจหน้าตา แล้วค่อยเจนที่เหลือ
3. แต่ละภาพประกอบจาก 3 ก้อนต่อกันตามลำดับ: **ก้อน ก (ข้อความกลาง)** + **ก้อน ข (ท่า ของภาพนั้น)** + **ก้อน ค (หน้าตาบอส)** วางต่อกันเป็นข้อความเดียว
   - ภาพแรกของแชท ให้เติมประโยคนี้นำหน้าก้อน ก: `The attached image is the approved concept of the Shipwreck Beach map in my game. Use EXACTLY its papercraft style for everything in this chat.`
4. ถ้าได้ภาพพิกเซล พิมพ์ต่อว่า `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`
5. ถ้าแผ่นออกมาไม่ครบ 5 แถว × 4 คอลัมน์ หรือปูแต่ละเฟรมขนาดไม่เท่ากัน พิมพ์ต่อว่า `Redo it as a strict grid of exactly 5 rows x 4 columns, 20 figures, the crab the SAME size in every cell.`
6. เซฟไฟล์ดิบที่ `art_templates/papercraft_maps/raw/floor2_m1/monsters/` ตามชื่อในตาราง (โฟลเดอร์ `raw/` ไม่ commit ห้าม `git add raw/`)
7. เจนเสร็จแล้วส่งภาพกลับมา การตัดภาพเข้าเกมเป็นงานแยกอีก PR

---

## ก้อน ก: ข้อความกลาง (ขึ้นต้นทุกภาพ)

```
Now a boss of this Shipwreck Beach, in EXACTLY the papercraft style of the attached map and its creatures: layered cut coloured paper and card, visible paper fibre, slightly uneven scissor-cut edges, small drop shadows between paper layers, creatures built from flat paper pieces joined at the joints like paper puppets, warm soft light from the upper left. NOT pixel art: no pixels, no pixel grid, no 16-bit sprite look.
Generate an image: a sprite sheet as a strict grid of 5 rows x 4 columns, 20 figures, the SAME monster in every cell, identical size and colours. Each row is one facing direction, top to bottom: row 1 front facing the viewer; row 2 three-quarter front turned toward the LEFT; row 3 side profile facing LEFT; row 4 three-quarter back turned toward the LEFT (we mostly see its back); row 5 back view. Each column is one frame of the move, left to right. Body keeps the same size in every frame, standing on the same baseline in every cell. Every figure fully inside its own cell with clear empty space around it, nothing touching or overlapping. No effects, no motion lines, no dust, no sparks, no smoke, no projectiles. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no numbers, no grid lines. Do not use pink, magenta or purple on the monster.
```

## ก้อน ข: ท่า (เลือก 1 ใน 4 ต่อภาพ)

### ภาพที่ 1: เดินข้าง → `giant_crab_walk.png`

```
The move: a smooth 4-frame scuttling loop, the legs stepping in turn like a crab, so frame 4 leads into frame 1.
```

### ภาพที่ 2: ยิงปืนใหญ่ → `giant_crab_cannon.png`

```
The move: a 4-frame cannon shot: frame 1 crouching and tilting the shell so the cannon points up into the air; frame 2 bracing; frame 3 the whole body jolting back from the recoil; frame 4 settling back to its normal pose. No smoke, no flash, no cannonball.
```

### ภาพที่ 3: ก้ามหนีบเหวี่ยง → `giant_crab_claw.png`

```
The move: a 4-frame grab and fling toward the direction it faces: frame 1 raising the enormous claw wide open; frame 2 snapping it forward and shut; frame 3 lifting the closed claw high; frame 4 swinging it hard to the side as if throwing something away.
```

### ภาพที่ 4: หดกระดอง → `giant_crab_shell.png`

```
The move: a 4-frame hide in the shell: frame 1 normal pose; frame 2 pulling the legs and claws in; frame 3 fully hidden inside the shell, only the shell and cannon showing; frame 4 eyes peeking out from under the shell.
```

## ก้อน ค: หน้าตาบอส (ปิดท้ายทุกภาพ)

```
The monster: the Giant Cannon Crab, a large imposing boss about three times the height of a hero: a huge red-orange crab with thick armoured legs, one enormous claw and one smaller claw, stalk eyes with fierce brows, its wide barnacle-covered shell carrying an old bronze ship's cannon mounted on top like a turret, a little seaweed and a starfish stuck to the shell.
```

---

## ตัวอย่างข้อความเต็มของภาพที่ 1 (เดินข้าง)

ก้อน ก ตามด้วยก้อน ข ภาพที่ 1 ตามด้วยก้อน ค คั่นด้วยบรรทัดว่าง ภาพแรกของแชทเติมประโยคนำหน้าตามข้อ 3 ของวิธีเจน ภาพที่ 2–4 ไม่ต้องเติม

## สถานะภาพ (2026-11-25)

**ไม่มีท่าที่ต้องเจนเพิ่ม** ภาพดิบทั้ง 4 ท่าครบและตรงสเปก 5 × 4 (ชุดที่ใช้คือใน worktree `floor2-art-cut` ลงวันที่ 2026-11-20 ชุดวันที่ 19 ในโฟลเดอร์หลักเป็นชุดเก่าที่ช่องผิด)

- แผ่นในเกม: `public/assets/sprites/paper/monsters/giant_crab.png` ตัดด้วย `node tools/cut_floor2_chars.cjs monsters --only giant_crab` · เกมโหลดให้ `cannon_crab` ผ่าน `PAPER_MONSTER_FILE` ใน `src/client/assets.ts`
- เกมเล่นเฉพาะท่าเดินกับท่าที่ 2 (ก้ามหนีบ) กับทุกการโจมตี ท่ายิงปืนใหญ่กับหดกระดองอยู่ในแผ่นแล้ว แต่ต้องแก้โค้ดก่อนถึงจะเล่น (งานแยก ไม่ต้องเจนภาพ)
- ท่า "เดินข้างหลบเร็ว" ใช้ภาพเดินซ้ำ ท่าเลือดน้อยระดมยิงใช้ภาพยิงปืนใหญ่ซ้ำ (ไม่มีแผ่นแยก)
- ลูกปืนใหญ่ วงเตือน และโดมกันดาเมจอยู่ใน `fx.png` ของ `FLOOR2_M1_BEACH.md` ข้อ 9 ไม่ต้องเจนในไฟล์นี้
