# ตลาดฝากขาย (นายหน้าตลาด): prompt สำหรับสร้างภาพใน ChatGPT

สร้างในแชทเดิมที่มีภาพ Gunslinger หรือแนบภาพ Gunslinger เป็นตัวอย่าง
เซฟไฟล์ดิบไว้ที่ `art_templates/market/raw/` แล้วตัดด้วย `tools/cut_npc.cjs` (ตัดทั้งแผงตลาด ตัว NPC และไอคอน)

ตัวนายหน้าตลาดและไอคอน (`npc_market` `map_market`) อยู่ใน `art_templates/npc_icons/PROMPTS.md` หัวข้อ "ผู้ดูแลคลังและนายหน้าตลาด"
ถ้าไม่มีไฟล์ `props/town_market.png` แผงตลาดจะยืมภาพ `town_stall`

## แผงตลาด → `raw/town_market.png` → `props/town_market.png`

```
Same exact style. Generate an image: ONE object, centred, generous empty space around it. In 2D isometric 3/4 view from
above at about 35 degrees, light from the upper left, matching the ruined-city props (weathered sandstone, salvaged
wood, moss, faded gold and old blue): a consignment market booth rebuilt from salvaged planks, a deep-teal cloth
awning, a wooden board on the front covered with many small pinned paper notes and hanging brass price tags, a counter
with a few wrapped bundles and a small locked chest. Background ONE perfectly flat solid magenta (#FF00FF), no shadows,
no ground, no text, no letters, no labels, no grid lines. Do not use pink, magenta or purple on the object.
```
