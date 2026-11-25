# บอสกัปตันขาไม้ (`pegleg_captain`): ภาพในเกม

บอสแมพ 2 ชั้น 2 (อ่าวลักลอบ Lv60) · prompt ของภาพอยู่ใน `art_templates/papercraft_maps/FLOOR2_M2_COVE.md` ข้อ 8 (นกแก้วข้อ 9)

## สถานะภาพ (2026-11-25)

**ไม่มีท่าที่ต้องเจนเพิ่ม** ท่าตามแผนมีครบ ตัดเข้าเกมแล้ว

| ไฟล์ดิบ (`raw/floor2_m2/monsters/`) | ท่า | ในเกมตอนนี้ |
|---|---|---|
| `peg_captain_walk.png` | เดิน | เล่นตอนเดิน |
| `peg_captain_anchor.png` | ทอดสมอ | เล่นกับทุกการโจมตี (รวมตีธรรมดา) |
| `peg_captain_shout.png` | ตะโกนสั่ง | อยู่ในแผ่น ยังไม่ถูกเล่น (ต้องแก้โค้ด) |

- แผ่นในเกม: `public/assets/sprites/paper/monsters/peg_captain.png` · เกมโหลดให้ `pegleg_captain` ผ่าน `PAPER_MONSTER_FILE` ใน `src/client/assets.ts`
- นกแก้วเป็นแผ่นแยก `parrot.png` (บิน/เกาะ) ใช้อยู่แล้ว
- ถ้าต้องเจนท่าใดใหม่: เปิดแชทใหม่ แนบ `peg_captain_walk.png` ตัวเดิมเป็น reference ใช้ข้อความในข้อ 8 เซฟชื่อเดิมที่โฟลเดอร์เดิม (ไม่ commit) แล้วรัน `node tools/cut_floor2_chars.cjs monsters --only peg_captain`
