# ไอคอนธาตุ 5 ธาตุ (2026-11-27)

ระบบธาตุ ([docs/systems/skills.md](../../docs/systems/skills.md) หัวข้อ "ระบบธาตุ") ตอนนี้ใช้อีโมจิแทนไอคอน (💧 🔥 ☠️ ⚡ 🌪️) ทั้งป้ายธาตุบนหลอดเลือดมอน (`src/client/debuffFx.ts`) และป้ายธาตุในคำอธิบายสกิล (`src/client/elementBadge.ts`) พอเจ้าของเจนภาพจริงมาแล้ว ให้เปลี่ยนไปใช้ภาพแทน

- เจ้าของเจนภาพเองจาก GPT ห้าม AI เปิด ChatGPT เอง
- สไตล์**กระดาษตัดแปะ**เท่านั้น (กติกาเจ้าของ 2026-11-18 ใช้ทั้งเกม) ห้ามภาพพิกเซล
- ให้เจนเป็นแผ่นเดียว มี 5 ไอคอนเรียงแถวเดียว ลำดับคือ น้ำ, ไฟ, พิษ, สายฟ้า, ลม
- เซฟภาพดิบเป็น `raw/element_icons.png` แล้วตัดเป็นช่องละ 64×64 เซฟที่ `public/assets/sprites/ui/element_<ชื่อ>.png`
  ชื่อไฟล์ใช้ `water`, `fire`, `poison`, `lightning`, `wind`
- ต้องอ่านออกตอนย่อเหลือ 16 พิกเซล (ขึ้นเหนือหลอดเลือดมอน)

```
A single row of five small RPG element icons in a handmade cut-paper collage style: layered coloured paper pieces with
slightly rough torn edges, a soft drop shadow between layers and a thin white paper rim around each icon, bold simple
shapes that stay readable at 16 pixels. 1) a blue water drop with a lighter paper highlight (water), 2) an orange and
yellow flame (fire), 3) a green poison drop with a tiny dark skull cut out of it (poison), 4) a yellow zig-zag lightning
bolt (lightning), 5) a pale teal swirl of wind with two curling lines (wind). Even spacing on ONE perfectly flat solid
magenta (#FF00FF) background, no shadows on the background, no text, no numbers. Do not use magenta or pink inside the
icons.
```
