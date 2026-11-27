# ห้องบอสคราเคนแบบใหม่: ภาพที่ต้องเจนเพิ่ม (เจ้าของเจนเองใน GPT, 2026-11-27)

ห้องใหม่: พื้นกลมตรงกลาง ล้อมด้วยน้ำวนวงใหญ่ คราเคน**โผล่จากน้ำที่มุมบนของจอ** และหนวดยักษ์ขึ้นรอบขอบพื้น (ดู `docs/systems/boss-rooms.md` หัวข้อคราเคน)
ระหว่างรอภาพ เกมใช้ภาพเดิม (`kraken.png`, `kraken_tentacle.png`) ขยายขนาดด้วยโค้ด ปรับใน /admin การ์ด "คราเคน (บอส)": "หนวด: ขนาดภาพ" และ "คราเคน: ขนาดภาพ"

## วิธีเจน

- เปิดแชทใหม่ แนบ `art_templates/papercraft_maps/raw/floor2_maps/M4_kraken_maelstrom.webp` ภาพเดียว (ห้ามแนบภาพพิกเซล)
- ภาพแรกขึ้นต้นด้วยประโยคเปิดของ `FLOOR2_M4_MAELSTROM.md` (หัวข้อ "วิธีเจน") แล้วต่อด้วย prompt ของข้อนั้น
- ได้ภาพพิกเซลให้พิมพ์ `Redo it as papercraft: cut paper layers, paper fibre texture, scissor-cut edges. Absolutely NOT pixel art.`
- เซฟไฟล์ดิบใน `art_templates/papercraft_maps/raw/floor2_m4/monsters/` ตามชื่อในตาราง (โฟลเดอร์ `raw/` ไม่ commit)
- ทุกภาพเป็นตาราง 5 แถว (มุม) × 4 เฟรม แบบมอนตัวอื่น ใช้**ข้อความกลาง**ของข้อ 8 ใน `FLOOR2_M4_MAELSTROM.md` แบบพื้นเขียว:
  `Background ONE perfectly flat solid pure bright green (#00FF00). Do not use bright green anywhere on the monster`
- prompt หนึ่งภาพ = ข้อความกลาง + บรรทัดท่า + บรรทัดหน้าตา

## 1. คราเคนโผล่จากมุมห้อง → `kraken_<ท่า>.png` (แทนภาพเดิม)

บรรทัดหน้าตา:
```
The monster: the Kraken, a colossal boss rising out of deep stormy water: its huge round head, its great eyes and the top of its body, plus two thick tentacles curling up beside it out of the same water, about four times the width of a hero, deep purple with lighter violet streaks and cream spots, two enormous glowing turquoise eyes with fierce brows, a curved beak below, a few barnacles and old scars. It leans forward over the water as if peering over the edge of a floor in front of it. The base is cut cleanly at the bottom of the cell along the waterline, with no water and no splash.
```

| ไฟล์ | บรรทัดท่า |
|---|---|
| `kraken_idle.png` | `The move: a 4-frame idle loop, the head slowly rising and sinking a little, the eyes blinking once, the two side tentacles swaying, so frame 4 leads into frame 1.` |
| `kraken_ink.png` | `The move: a 4-frame ink spit toward the direction it faces: frame 1 drawing the head back and puffing up; frame 2 leaning forward; frame 3 the beak wide open at full reach as if spitting; frame 4 settling back. No ink, no effects.` |
| `kraken_dive.png` | `The move: a 4-frame sink and rise: frame 1 normal pose; frame 2 sinking down to the eyes; frame 3 almost gone, only the top of the head showing; frame 4 rising back up with the eyes wide open.` |
| `kraken_arm_slam.png` | `The move: a 4-frame tentacle sweep toward the direction it faces: frame 1 one side tentacle rearing up high and curling back; frame 2 whipping forward and sideways in a wide arc; frame 3 the tentacle stretched long and flat across the ground in front of it; frame 4 pulling back to the normal pose.` |
| `kraken_arm_cut.png` | `The move: a 4-frame surfacing in pain: frame 1 the head low in the water; frame 2 rearing up tall with the beak open in a roar; frame 3 at full height, eyes blazing; frame 4 settling forward, ready to be hit.` |

## 2. หนวดยักษ์รอบขอบพื้น → `kraken_arm_<ท่า>.png` (ภาพใหม่ของหนวดในห้อง แยกจากหนวดในแมพ)

บรรทัดหน้าตา:
```
The monster: one of the Kraken's giant arms, an enormous tentacle rising straight up out of the water, about three times the height of a hero and thick as a ship's mast, deep purple with lighter violet streaks, a row of big round cream suckers along its inner side, scarred and covered in barnacles and a few strands of seaweed, the tip curling. The base is cut cleanly at the bottom of the cell along the waterline, with no water and no splash.
```

| ไฟล์ | บรรทัดท่า |
|---|---|
| `kraken_arm_idle.png` | `The move: a 4-frame idle loop, the tentacle swaying slowly from side to side and curling its tip, the base never moving, so frame 4 leads into frame 1. Use this instead of a walk.` |
| `kraken_arm_slam.png` | `The move: a 4-frame slam toward the direction it faces: frame 1 rearing up very tall and curling back; frame 2 whipping forward; frame 3 lying stretched out very long and flat along the ground in front of it, the full length of the slam; frame 4 rising back up to its normal pose.` |
| `kraken_arm_grab.png` | `The move: a 4-frame grab toward the direction it faces: frame 1 reaching forward low along the ground; frame 2 the tip coiling into a tight loop as if wrapped around someone; frame 3 pulling back toward its base, the coil held tight; frame 4 holding the tight coil, straining. No person in the coil.` |

## หลังได้ภาพ

- ส่งไฟล์ให้ session ตัดภาพ: แถวท่าต่อชื่อไฟล์อยู่ในตารางนี้ · `kraken_arm` ตอนนี้ใช้ชีตหนวดในแมพผ่าน `PAPER_MONSTER_FILE` (`src/client/assets.ts`) ต้องเปลี่ยนให้ใช้ชีตใหม่
- พอได้ภาพจริงแล้ว ลองปรับ "ขนาดภาพ" ใน /admin ให้พอดีอีกที
