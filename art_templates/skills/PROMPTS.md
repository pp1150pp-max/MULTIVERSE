# ไอคอนสกิล (ระบบสกิลใหม่ 2026-11-14)

เจ้าของเจนเองจาก ChatGPT ส่วน AI มีหน้าที่เขียน prompt ไว้ที่นี่เท่านั้น ห้ามเปิด ChatGPT เอง

ขั้นตอนหลังได้ภาพ:
1. เซฟภาพดิบไว้ที่ `art_templates/skills/raw/<ชื่อไฟล์>.png` (ไม่ต้อง commit)
2. ย่อเป็น 128×128 แล้วเซฟเป็น `public/assets/sprites/icons/skill_<id>.png` โดย `<id>` ต้องตรงกับ id ของสกิลใน `src/shared/data/classes.ts`

สกิลที่ยังไม่มีไฟล์จะแสดงไอคอนว่าง (`ico_blank`) ไปก่อน ส่วนกรอบทองของอัลติเป็น CSS ในหน้าต่างสกิล ภาพไม่ต้องวาดกรอบพิเศษ

## แม่แบบ (ใช้กับทุกสกิล)

แนบไฟล์ไอคอนเดิมของคลาสนั้นไปเป็นตัวอย่างสไตล์:
- นักดาบ: `icons/skill_whirlwind.png`
- เมจ: `icons/skill_fireball.png`
- Gunslinger: `icons/skill_pierce.png`

จากนั้นแทนที่ `<SYMBOL>` ด้วยคำบรรยายของสกิลนั้น session ของแต่ละคลาสจะเติมรายการของแต่ละสกิลไว้ท้ายไฟล์นี้หลังเจ้าของอนุมัติตารางสกิล

```
One single RPG skill icon in the EXACT same fine-detail 16-bit SNES-era pixel-art style as the attached skill icon:
crisp pixels, rich shading, no blur. A perfect square icon with a dark painted background in a muted deep blue-grey,
a thin bronze-gold bevelled border, and one big bold clear symbol that reads instantly at very small size: <SYMBOL>.
The icon fills the whole image. No text, no letters, no numbers.
```

## ไอคอนเมนู "สกิล" (`ico_skills.png`)

ตอนนี้ปุ่มสกิลแถวบนขวาและในเมนูใช้ไอคอนว่างกับ ⚔ ไปก่อน ถ้าจะทำไอคอนจริง:
- แนบ `public/assets/sprites/ui/ico_bag.png` ไปเป็นตัวอย่างสไตล์
- เซฟภาพดิบเป็น `raw/ico_skills.png`
- ภาพที่ใช้ในเกมคือไฟล์ 96×96 ที่ลบพื้นแมเจนตาออกแล้ว เซฟที่ `public/assets/sprites/ui/ico_skills.png`
- จากนั้นเปลี่ยน `SKILLS_ICON` ใน `src/client/sysmenu.ts` เป็น `badge('skills')`

```
Using the attached round menu badge as the exact style and colour reference, generate ONE matching round menu badge
in fine-detail 16-bit SNES-era pixel art with crisp pixels and no blur: the same black forged iron ring with tarnished
aged-bronze accents, and inside it a bold clear symbol of an open glowing spellbook with a small crossed sword and
lightning bolt rising from its pages. Centred, with empty space around it. Background ONE perfectly flat solid
magenta (#FF00FF), no shadows on it. No readable words, no logos. Do not use pink, magenta or purple in the badge.
```
