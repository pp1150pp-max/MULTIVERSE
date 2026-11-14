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

## นักดาบ (Techno Knight) — 30 สกิล + 3 พาสซีฟ

ใช้แม่แบบด้านบน แนบ `icons/skill_whirlwind.png` เป็นตัวอย่างสไตล์ แล้วแทน `<SYMBOL>` ด้วยข้อความในตาราง
- นักดาบมีแค่ดาบ ปลอกดาบ และเกราะ **ไม่มีโล่** ห้ามมีโล่ในภาพ
- สีหลักของสัญลักษณ์ตามสาย: คมดาบ = แดงส้ม, วายุ = ฟ้า, ปราการ = ทอง
- พุ่งชน (`charge`), พายุดาบ (`whirlwind`) และปฐพีแยก (`earthquake`) มีไอคอนอยู่แล้ว ไม่ต้องเจนใหม่

### สายคมดาบ (แดงส้ม)

| ไฟล์ | สกิล | `<SYMBOL>` |
|---|---|---|
| `skill_sw_heavyslash.png` | ฟันหนัก | a heavy broadsword cleaving downward in one thick fiery orange-red arc |
| `skill_sw_sunder.png` | ฟันทำลายเกราะ | a sword blade splitting a cracked steel breastplate in two, orange sparks flying |
| `skill_sw_swordwave.png` | คลื่นดาบ | a crescent-shaped wave of red-orange blade energy flying forward from a sword tip |
| `skill_sw_execute.png` | ประหาร | a downward-pointing executioner greatsword over a dark red skull, blood-red glow |
| `skill_sw_flurry.png` | คมดาบต่อเนื่อง | five overlapping quick orange slash streaks crossing in front of a sword |
| `skill_sw_bladering.png` | วงแหวนคมดาบ | two concentric rings of spinning orange-red blades around a centre point |
| `skill_sw_crush.png` | ทุบทำลาย | a sword hilt-first slamming into cracked ground with an orange shockwave burst |
| `skill_sw_unleash.png` | ปลดปล่อยพลัง (อัลติ) | a sword raised upright releasing a huge exploding sphere of orange-red energy |
| `skill_sw_judgement.png` | ดาบพิพากษา (อัลติ) | a giant glowing orange sword falling point-down from the sky onto a target circle |

### สายวายุ (ฟ้า)

| ไฟล์ | สกิล | `<SYMBOL>` |
|---|---|---|
| `skill_sw_triple.png` | คอมโบสามจังหวะ | three sky-blue slash arcs in a row, the last one larger and brighter |
| `skill_sw_backstep.png` | ถอยฟัน | a sword slash to the front with a pale-blue motion trail of a knight leaping backward |
| `skill_sw_hunt.png` | ไล่ล่า | a sword dashing forward with blue speed lines towards a red target mark |
| `skill_sw_spindodge.png` | หมุนตัวหลบ | a short blue dash arrow ending in a small spinning blade whirl |
| `skill_sw_bladedance.png` | ระบำดาบ | three zig-zag blue dash trails each ending in a small sword spin |
| `skill_sw_shadowstep.png` | ก้าวเงา | a dark purple-blue shadow silhouette of a knight stepping out of a portal with a sword |
| `skill_sw_overdrive.png` | เร่งเครื่อง | a glowing blue gear-shaped engine core with a sword through it and speed lines |
| `skill_sw_shadowswap.png` | เงาสลับร่าง (อัลติ) | three blue afterimage silhouettes of a knight each striking with a sword |
| `skill_sw_thousandcuts.png` | พันคมดาบ (อัลติ) | dozens of thin cyan slash lines crisscrossing over a dark circle |

### สายปราการ (ทอง)

| ไฟล์ | สกิล | `<SYMBOL>` |
|---|---|---|
| `skill_sw_armorbash.png` | กระแทกเกราะ | a heavy armoured steel shoulder pauldron ramming forward with a golden impact burst (no shield) |
| `skill_sw_taunt.png` | ยั่วยุ | a knight's helmet with a golden shout wave and red exclamation marks around it |
| `skill_sw_guard.png` | ตั้งรับ | a sword held horizontally across a sheathed scabbard in a blocking stance, golden glow (no shield) |
| `skill_sw_shockwave.png` | คลื่นสั่นสะเทือน | a straight golden crack running across the ground with rocks bursting up along it |
| `skill_sw_thorns.png` | เกราะสะท้อน | a golden spiked armour chestplate bouncing a red arrow back |
| `skill_sw_anchor.png` | ปักหลัก | a sword driven deep into the ground with golden chains anchoring it down |
| `skill_sw_warcry.png` | ปลุกใจนักรบ | a sword raised high with golden rings of a rallying shout spreading outward |
| `skill_sw_cataclysm.png` | ปฐพีถล่ม (อัลติ) | three expanding golden rings of shattered ground erupting around a sword |
| `skill_sw_unbreakable.png` | ราชันย์ไม่ล้ม (อัลติ) | a crowned knight's helmet inside a radiant golden aura with a green healing glow |

### พาสซีฟ

| ไฟล์ | พาสซีฟ | `<SYMBOL>` |
|---|---|---|
| `skill_sw_duelist.png` | นักดวล | two swords crossed point-to-point in a duel, a single red target between them |
| `skill_sw_lightfeet.png` | เท้าคล่อง | an armoured boot with small blue wings and speed lines |
| `skill_sw_ironhide.png` | เกราะเหล็ก | a thick riveted iron breastplate with a glowing golden heart in the centre |
