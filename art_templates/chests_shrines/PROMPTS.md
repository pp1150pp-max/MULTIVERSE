# หีบสมบัติ + ศาลเจ้า: prompt สำหรับเจนใน ChatGPT (สไตล์กระดาษตัดแปะ)

ระบบอยู่ใน [docs/systems/chests-shrines.md](../../docs/systems/chests-shrines.md) · ระหว่างที่ยังไม่มีภาพ เกมใช้ภาพชั่วคราวที่วาดด้วยโค้ด (`src/client/treasureViews.ts`: กล่องไม้คาดทอง, เสาหินกับลูกแก้วลอยสีตามบัฟ)
มีทั้งหมด 2 แผ่น: ของวางบนแมพ 1 แผ่น (หีบปิด หีบเปิด ศาล 4 แบบ) และไอคอนบัฟ 1 แผ่น (3 ไอคอน)

## วิธีเจน

- **เปิดแชทใหม่** ภาพแรกแนบ `art_templates/papercraft_maps/raw/ref/A7_hub.png` (หินและไม้) กับ `A1_heroes.png` (ขนาดตัวละคร) เป็นต้นแบบสไตล์ แล้วเจนตามข้อ 1 และ 2 ในแชทเดียวกัน
- เซฟไฟล์ดิบไว้ที่ `art_templates/chests_shrines/raw/` ตามชื่อในแต่ละข้อ (โฟลเดอร์ `raw/` ไม่ commit)
- เจนเสร็จแล้วบอก Claude ให้ตัดพื้นหลัง ย่อขนาด แล้วใส่เข้าเกมแทนภาพชั่วคราว

## 1. หีบและศาลบนแมพ → `raw/treasure_props.png` (3×2)

```
The attached images show the papercraft art style and the camera of my game. Use EXACTLY this style: a handmade papercraft diorama look, layered cut coloured paper and card, visible paper fibre texture, slightly uneven scissor-cut edges, small drop shadows between paper layers INSIDE each object, warm soft lighting from the upper left. SAME camera as the city screenshot: 2D isometric 3/4 view from above, each object's base sits on an imaginary diamond-shaped ground footprint. Generate an image: prop sheet with exactly 6 separate objects in a 3 columns x 2 rows grid, generous empty space between them, each fully inside its own cell, nothing touching or overlapping. Row 1: a CLOSED treasure chest about knee-high to a hero, dark wooden planks with gold metal bands, a gold lock plate and rivets, a rounded lid; the SAME treasure chest OPEN, its lid lifted back, a soft golden paper glow and a few gold coins and a small gem inside; a small ancient stone shrine about the height of a hero, a short carved pillar on a round stepped base with a floating glowing orb above it, the orb and the runes on the pillar in deep RED with a small sword symbol. Row 2: the SAME stone shrine with the orb and runes in bright GREEN with a small winged boot symbol; the SAME stone shrine with the orb and runes in warm GOLD with a small star symbol; the SAME stone shrine with a shimmering orb of all three colours (red, green, gold) swirling together. Each object has crisp clean outer edges with no glow or halo spilling onto the background. Background ONE perfectly flat solid magenta (#FF00FF) everywhere, no gradient, no paper texture on the background, no ground patches, no cast shadows on the background, no text, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `chest_closed` `chest_open` `shrine_atk` / `shrine_speed` `shrine_exp` `shrine_random`

(หีบเปิดใช้ตอนกำลังเปิด 1.5 วิ แล้วหีบหายไปจนเกิดใหม่ · ศาลที่ตั้งเป็น "สุ่ม" ใช้ภาพช่องสุดท้าย)

## 2. ไอคอนบัฟศาลเจ้า → `raw/shrine_buff_icons.png` (3×1)

```
Same papercraft style. Generate an image: exactly 3 small buff icons for the HUD of the same game, in a 3 columns x 1 row grid, generous empty space, nothing touching. Each icon is a round paper badge with a thin brass paper rim and a dark painted paper background, with ONE bold clear symbol built from layered cut coloured paper that reads at a very small size. Left: a red sword pointing up with a small spark (attack up). Middle: a green winged boot with speed lines (move speed up). Right: a gold star with small sparkles (experience up). Every badge the same size. Background ONE perfectly flat solid magenta (#FF00FF), no gradient, no shadows on the background, no text, no letters, no numbers, no labels. Do not use pink, magenta or purple on any icon.
```

ลำดับช่อง: `shrine_buff_atk` `shrine_buff_speed` `shrine_buff_exp`
