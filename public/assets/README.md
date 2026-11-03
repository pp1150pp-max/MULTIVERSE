# วิธีใส่ภาพ/สไปรต์จริง

เกมจะหาไฟล์ตาม path ด้านล่าง **ถ้าไม่มีไฟล์ จะใช้ภาพตัวแทน (placeholder) ที่วาดด้วยโค้ดแทนให้อัตโนมัติ**
ใส่ไฟล์แล้วรีเฟรชหน้าเว็บได้เลย ไม่ต้องแก้โค้ด (ชื่อไฟล์ต้องตรงทุกตัวอักษร)

## รูปแบบ Sprite Sheet ของตัวละคร / มอนสเตอร์ / NPC

ใช้รูปแบบเดียวกับชีตคอนเซ็ปต์ Zone 1: **3 แถว × 3 คอลัมน์** ทุกช่องต้องขนาดเท่ากัน
และพื้นหลังต้องโปร่งใส (PNG)

```
          เฟรม 1   เฟรม 2   เฟรม 3
แถว 1   [ Front ][ Front ][ Front ]   ← หันหน้าเข้าหากล้อง
แถว 2   [ Side  ][ Side  ][ Side  ]   ← หันไปทาง "ซ้าย" (เกมพลิกภาพเองตอนเดินไปทางขวา)
แถว 3   [ Back  ][ Back  ][ Back  ]   ← หันหลัง
```

- เฟรม 1 ใช้เป็นท่ายืนนิ่ง ส่วนตอนเดินจะเล่นเฟรมวนเป็น 1 → 2 → 3 → 2
- ให้เท้าของตัวละครอยู่ชิดขอบล่างของแต่ละช่อง
- ถ้าภาพในแถว Side หันไปทางขวา ให้แก้ `fileSideFaces` ใน `src/client/assets.ts`

| ไฟล์ | ใช้กับ |
|---|---|
| `sprites/player/sword.png` | คลาส Sword |
| `sprites/player/mage.png` | คลาส Mage |
| `sprites/player/gunslinger.png` | คลาส Gunslinger |
| `sprites/npc/seeker.png` | The Seeker |
| `sprites/monsters/green_slime.png` | Green Slime |
| `sprites/monsters/wild_rabbit.png` | Wild Rabbit |
| `sprites/monsters/forest_fox.png` | Forest Fox |
| `sprites/monsters/wild_boar.png` | Wild Boar |
| `sprites/monsters/forest_wolf.png` | Forest Wolf |
| `sprites/monsters/forest_bear.png` | Forest Bear (Mini Boss) |

## ตัวละครแบบแอนิเมชันเต็มชุด (เช่น Sword — Cyberblade)

ถ้ามีโฟลเดอร์นี้ เกมจะใช้แทนชีต 3×3 ด้านบน

```
sprites/player/sword/
  sprite.json      ← ไฟล์ตั้งค่า บอกขนาดเฟรมและลำดับแถว
  idle.png  walk.png  run.png  dash.png  hit.png  death.png  revive.png
  attack.png  attack_2.png  attack_3.png      ← คอมโบโจมตีปกติ (มีแค่ attack อย่างเดียวก็ได้)
  skill_q.png  skill_e.png  skill_r.png       ← ท่าใช้สกิล (ไม่มีจะใช้ท่า attack แทน)
```

**1 ไฟล์ = 1 ท่า** · แนวนอนเรียงเฟรมจากซ้ายไปขวา · แนวตั้งเรียงทิศทาง ทุกเฟรมต้องขนาดเท่ากัน (เช่น 128×128)
และตัวละครต้องยืนตำแหน่งเดิมในทุกเฟรม ไม่อย่างนั้นตัวจะสั่นตอนเล่นแอนิเมชัน

```
             เฟรม1 เฟรม2 เฟรม3 ...
แถว 1 (down)      [   ][   ][   ]    หันหน้าเข้ากล้อง
แถว 2 (down_side) [   ][   ][   ]    ทแยงหน้า
แถว 3 (side)      [   ][   ][   ]    หันข้าง
แถว 4 (up)        [   ][   ][   ]    หันหลัง
```

ชื่อทิศที่ใช้ได้มี `down`, `down_side`, `side`, `up_side`, `up` จะมีกี่แถวก็ได้และเรียงลำดับไหนก็ได้ ขอแค่เขียนให้ตรงใน `sprite.json`
ฝั่งซ้ายเกมจะพลิกภาพให้เอง

ตัวอย่าง `sprite.json`:

```json
{
  "frameWidth": 128, "frameHeight": 128,
  "height": 2.6,
  "feet": 0.1,
  "sideFaces": "right",
  "directions": ["down", "down_side", "side", "up"],
  "animations": {
    "idle":   { "file": "idle.png",   "frames": 4, "fps": 8,  "loop": true },
    "run":    { "file": "run.png",    "frames": 8, "fps": 12, "loop": true },
    "dash":   { "file": "dash.png",   "frames": 6, "fps": 16 },
    "death":  { "file": "death.png",  "frames": 10, "fps": 10, "directions": ["side"] }
  }
}
```

- `height` คือความสูงของทั้งเฟรมในเกม (ผู้เล่นสูงประมาณ 1.9)
- `feet` คือตำแหน่งเท้า นับจากขอบล่างของเฟรม คิดเป็นสัดส่วนของความสูงเฟรม
- ถ้าท่าไหนวาดไว้ทิศเดียว ให้ใส่ `"directions": [...]` เฉพาะในท่านั้น
- ส่งไฟล์มาได้เลย เดี๋ยวผมเขียน `sprite.json` ให้เอง

### ตัดจากชีตนำเสนอแบบมีป้ายกำกับ

ชีตที่มีหัวข้อ ป้ายชื่อทิศ และเลขเฟรมติดมา (พื้นหลังต้องโปร่งใส) ใช้สคริปต์นี้ตัดให้เป็นชีตที่เกมใช้ได้

```bash
python tools/extract_sheet.py ภาพชีต.png public/assets/sprites/player/sword/run.png --rows down,left,right,up
```

สคริปต์จะลบป้ายเลขเฟรมออก ตัดแต่ละท่าออกมา แล้วจัดให้เท้าอยู่ตำแหน่งเดียวกันทุกเฟรม
จากนั้นพิมพ์ค่า `frameWidth` / `frameHeight` / `feet` ออกมาให้ใส่ใน `sprite.json`
และสร้างไฟล์ `..._preview.png` ที่มีเส้นนำไว้ตรวจว่าเฟรมตรงกันหรือไม่

แต่ละท่าที่ตัดออกมาอาจได้ขนาดเฟรมไม่เท่ากัน ให้ใส่ `"frameWidth"`, `"frameHeight"`, `"feet"` ของท่านั้นไว้ในบรรทัดของท่านั้น
ใน `sprite.json` เกมจะปรับขนาดให้ตัวละครเท่ากันทุกท่า

## ภาพเดี่ยว (ฉากประกอบ / ไอคอน) — 1 ภาพต่อ 1 ไฟล์

`sprites/props/`: `tree_0.png` `tree_1.png` `tree_2.png` `bush_0.png` `bush_1.png` `rock_0.png` `rock_1.png`
`stump.png` `tent.png` `campfire.png` `sign.png` `fence.png` `runestone.png`

`sprites/icons/`: `coin.png` `potion_hp.png` `potion_mp.png`
`bag_common.png` `bag_uncommon.png` `bag_rare.png` `bag_epic.png` `bag_legendary.png`

## ขนาดในเกม

เกมจะย่อหรือขยายภาพตามความสูงที่ตั้งไว้ใน `height` ของ `src/shared/data/monsters.ts` (หน่วยเมตร/ยูนิต)
ตัวผู้เล่นสูงประมาณ 1.9 ยูนิตต่อ 1 ช่อง ถ้าภาพจริงดูเล็กหรือใหญ่เกินไป ให้ปรับค่านี้

เปิด DevTools (F12) → Console จะมีข้อความ `[assets] N loaded from files: ...` บอกว่าไฟล์ไหนโหลดสำเร็จ

## ภาพแผนที่ (CraftPix Summer Tileset)

ต้นไม้ พุ่มไม้ หิน ตอไม้ เต็นท์ กองไฟ รั้ว ธง บ่อน้ำ ถังไม้ เกวียน หีบ หอสังเกตการณ์ (`sprites/props/`)
และพื้นหญ้า/ทราย (`sprites/ground/`) มาจาก [CraftPix — Free Simple Summer Top-Down Vector Tileset](https://craftpix.net/)
License: https://craftpix.net/file-licenses/

ไฟล์ถูกแปลงด้วย `python tools/import_craftpix.py` (ลบเงาในภาพ เพราะเกมวาดเงาเอง และตัดขอบว่างออก)
ถ้าจะเปลี่ยนว่าภาพไหนใช้กับอะไร ให้แก้ตาราง `PROPS` ในสคริปต์นั้นแล้วรันใหม่
