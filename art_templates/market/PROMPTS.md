# ตลาดฝากขาย (นายหน้าตลาด): prompt สำหรับสร้างภาพใน ChatGPT

สร้างในแชทเดิมที่มีภาพ Gunslinger หรือแนบภาพ Gunslinger เป็นตัวอย่าง
เซฟไฟล์ดิบไว้ที่ `art_templates/market/raw/` แล้วผมจะตัดพื้นหลังและวางเข้าเกมเอง

ระหว่างที่ยังไม่มีภาพจริง เกมใช้ภาพชั่วคราว: ตัว NPC วาดด้วยโค้ด (`drawBroker` ใน `src/client/placeholder.ts`),
แผงตลาดยืมภาพ `town_stall`, ไอคอนบนหัวยืม `npc_shop`, ไอคอนแผนที่ยืม `map_merchant`

## 1. ตัว NPC → `public/assets/sprites/npc/broker.png` (ชีต 3 มุม ตัดเป็นแบบเดียวกับ NPC อื่น)

```
Now one NPC character for the same game, in the EXACT same fine-detail 16-bit SNES-era JRPG sprite style as the gunslinger: same chibi proportions about 3 heads tall, same face construction, dark outline, rich shading with 3 to 4 tones per material, small crisp pixels, no chunky pixels. Generate an image: ONE row of 3 views of the SAME character from left to right: (1) front view facing the viewer, (2) side view facing LEFT, (3) back view. Identical size, colors and design across the 3 views, boots on the same baseline, generous empty space, nothing touching or overlapping. The character is the Market Broker who sells other adventurers' goods: a slim sharp-eyed middle-aged trader with neat dark hair tied back and a thin curled mustache, a long deep-teal coat with gold buttons and gold trim, a cream scarf, a small round monocle on one eye, holding an open ledger book in one hand and a quill pen in the other, a ring of small brass claim tags hanging from the belt. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no labels, no grid lines. Do not use pink, magenta or purple on the character.
```

## 2. แผงตลาด + ไอคอน → `props/town_market.png`, `icons/npc_market.png`, `icons/map_market.png`

```
Same exact style. Generate an image: exactly 3 separate objects in a 3 columns x 1 row grid, generous empty space, nothing touching or overlapping. (1) In 2D isometric 3/4 view from above at about 35 degrees, light from the upper left, matching the ruined-city props (weathered sandstone, salvaged wood, moss, faded gold and old blue): a consignment market booth rebuilt from salvaged planks, a deep-teal cloth awning, a wooden board on the front covered with many small pinned paper notes and hanging brass claim tags, a counter with a few wrapped bundles and a small locked chest. (2) A square icon, bold and readable when small: an open ledger book with a gold coin and a small brass tag on top. (3) A small round map marker icon, bold simple shapes: a gold coin in front of a hanging price tag. Background ONE perfectly flat solid magenta (#FF00FF), no shadows, no ground, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on any object.
```

ลำดับช่อง: `town_market` `npc_market` `map_market`
