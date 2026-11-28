# ไอคอนดีบัฟบนตัวมอน (2026-11-15)

**ทำแล้ว (2026-11-28, PR 563):** ใช้ภาพกระดาษ ตัดด้วย `tools/cut_codex17.cjs` เป็นช่องละ 64×64 ข้อความด้านล่างเป็นบันทึกแผนเดิม

ตอนนี้ไอคอนในเกมวาดด้วยโค้ดเป็นพิกเซล 9×9 อยู่ใน `src/client/debuffFx.ts` ถ้าเจ้าของเจนภาพจริงมาแล้ว ให้เปลี่ยนไปใช้ภาพแทน

- เจ้าของเจนภาพเองจาก GPT ห้าม AI เปิด ChatGPT เอง
- ให้เจนเป็นแผ่นเดียว มี 6 ไอคอนเรียงแถวเดียว ลำดับคือ สตัน, ช้าลง, เกราะแตก, โจมตีลด, ติดไฟ/พิษ, โดนมาร์ค
- เซฟภาพดิบเป็น `raw/debuff_icons.png` แล้วตัดเป็นช่องละ 32×32 เซฟที่ `public/assets/sprites/ui/debuff_<ชื่อ>.png`
  ชื่อไฟล์ใช้ `stun`, `slow`, `armor`, `weak`, `dot`, `mark`

```
A single row of six tiny RPG status-effect icons in fine-detail 16-bit SNES-era pixel art with crisp pixels and no
blur, each a small square badge with a dark rim, readable at 16 pixels: 1) three yellow stars circling (stunned),
2) a pale-blue snowflake (slowed), 3) a grey shield with a crack (armor broken), 4) a red downward arrow over a sword
(attack down), 5) an orange flame with a green drip (burning or poisoned), 6) a red crosshair reticle (marked).
Even spacing on ONE perfectly flat solid magenta (#FF00FF) background, no shadows on it, no text, no numbers.
Do not use magenta or pink inside the icons.
```
