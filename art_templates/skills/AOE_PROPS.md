# ชั้นตั้งของสกิล AOE: prompt สำหรับ ChatGPT (เจ้าของสั่ง 2026-11-15)

เจ้าของบอกว่าสกิล AOE ดูแบนเหมือนสติกเกอร์ จึงสั่งให้เจนใหม่เป็น 2 ชั้น และให้ทุกสกิลมีภาพของตัวเอง

- **ชั้นพื้น:** ใช้ภาพเดิมที่ตอนนี้ขอบจางแล้ว
- **ชั้นตั้ง:** ไฟล์นี้ แต่ละสกิลได้ 1 แถว
  - ภาพในแถวคือ "ชิ้นเล็กหนึ่งชิ้น" วาดจากด้านข้าง เช่น หนามหิน เปลวไฟ หรือเสาแสง
  - เกม (`src/client/zoneProps.ts`) จะโปรยชิ้นนี้หลายชิ้นทั่วพื้นที่ของสกิล
  - แต่ละชิ้นตั้งบนพื้น ค่อย ๆ โผล่ขึ้น และขยับไม่พร้อมกัน ชิ้นที่อยู่ข้างหน้าจะบังชิ้นข้างหลัง สกิลจึงดูมีความสูงและความลึก

มีทั้งหมด 9 แผ่น แผ่นละ 4 แถว และแถวละ 6 เฟรม แผ่นไหนยังไม่มีไฟล์ เกมจะไม่วาดชั้นตั้งของสกิลในแผ่นนั้น แต่สกิลยังเล่นได้ตามปกติ

**วิธีเจน**
1. แนบ `public/assets/sprites/fx/sw_blade.png` เป็นตัวอย่างสไตล์ ถ้าเปิดแชทใหม่ต้องแนบใหม่ทุกครั้ง
2. วางกฎร่วมด้านล่าง แล้วต่อท้ายด้วยข้อความของแผ่นนั้น
3. เซฟภาพดิบเป็น `art_templates/skills/raw/<ชื่อแผ่น>.png` เช่น `raw/ap_sw_a.png`
4. AI จะตัดพื้นหลังด้วยคำสั่ง `node tools/cut_fx_sheet.cjs raw/<ชื่อ>.png 4 public/assets/sprites/fx/<ชื่อ>.png <โหมด>`
   - ใช้โหมด `strict` กับแถวที่เป็นสีม่วง ส่วนแถวอื่นใช้ `default`

## กฎร่วม (ทุกแผ่น)

```
EXACT same fine-detail 16-bit SNES-era pixel-art style as the attached effect sheet: crisp pixels, hard-edged color
bands, no blur, no soft gradients, no glow haze. Only the effects, no characters, no weapons held by anyone. Generate an
image: an animation sheet as a strict grid of exactly 4 rows x 6 columns, every cell the same size, each piece fully
inside its own cell with empty space around it, nothing touching or crossing cell borders. Each row is ONE small
standing piece seen from the side at a slight top-down isometric angle (as if standing on the ground in an isometric
game), its base sitting on the BOTTOM edge of the cell and centered, growing upward. Each row plays left to right over
6 frames: frame 1 just emerging from the ground, frames 2-5 at full size animating (flicker, sway or pulse), frame 6
the same at full size so the loop can restart at frame 2. Background ONE perfectly flat solid magenta (#FF00FF), no
shadows, no ground plane, no text, no labels, no numbers, no grid lines. Do not use pink or magenta in the effects.
```

## นักดาบ

### แผ่น `ap_sw_a`: หินและพื้นดิน
```
Row 1, EARTHQUAKE: a jagged brown rock spike bursting out of the ground with small pebbles and a puff of dust at its base.
Row 2, SHOCKWAVE: a low wide ridge of cracked earth slabs tilting up with dust spraying off the top edge.
Row 3, CATACLYSM: a huge dark stone pillar erupting from the ground with glowing orange lava cracks and falling rubble.
Row 4, ANCHOR: a short thick stone stake rising from the ground with a faint golden rune glowing on it.
```

### แผ่น `ap_sw_b`: ดาบและแรงระเบิด
```
Row 1, CRUSH: chunks of broken rock and dirt thrown up into the air from an impact, flying apart and falling back.
Row 2, JUDGEMENT: a radiant golden sword of light stabbing down and standing upright in the ground, light rays around it.
Row 3, UNLEASH: a tall flare of orange-gold sword energy bursting upward like a blade-shaped flame.
Row 4, BLADE RING: a spinning steel blade shard hovering just above the ground with silver motion streaks.
```

### แผ่น `ap_sw_c`: เสียงตะโกนและเกราะ (ใช้แค่ 3 แถว แถวที่ 4 ให้เว้นว่าง)
```
Row 1, TAUNT: a tall flickering column of red battle-fury flame rising from the ground with angry sparks.
Row 2, WAR CRY: a rising orange war banner of energy waving upward like a flag made of fire.
Row 3, UNBREAKABLE: a translucent golden shield fragment rising from the ground and turning slowly, with sparkles.
Row 4: leave every cell empty magenta.
```

## นักเวท

### แผ่น `ap_mg_a`: น้ำแข็ง อุกกาบาต อาร์เคน
```
Row 1, FROST NOVA: a pale-blue ice crystal spike shooting up from the ground with frost mist at its base.
Row 2, METEOR: a glowing molten rock fragment half buried in the ground with small flames licking up around it.
Row 3, MANA BURST: a tall thin violet arcane crystal spire rising with orbiting purple sparks.
Row 4, CHARGED BLAST: a short pillar of purple-white lightning crackling straight up from the ground.
```

### แผ่น `ap_mg_b`: ไฟและพิษ
```
Row 1, FLAME WAVE: a tall curling flame tongue leaning forward to the RIGHT like part of a moving wave of fire.
Row 2, FLAME GROUND: a medium flickering campfire-like flame burning on the ground, bright yellow core, orange edges.
Row 3, FIRE RAIN: a fire droplet falling from above and splashing into a small burst of flame on the ground.
Row 4, POISON MIST: green toxic bubbles rising from the ground and popping into small curls of green vapor.
```

### แผ่น `ap_mg_c`: เมล็ดพิษ ความเสื่อม เถ้า
```
Row 1, HEX SEED: a twisted green thorny sprout growing out of the ground with a tiny glowing seed pod.
Row 2, DECAY RING: a dark violet shadow tendril rising and curling from the ground, dripping purple.
Row 3, DECAY FIELD: a cracked old bone and a wisp of grey-violet rot smoke rising from the ground.
Row 4, CURSED ASH: a swirl of grey ash and glowing orange embers spiraling upward.
```

### แผ่น `ap_mg_d`: แรงผลัก คำสาป แรงโน้มถ่วง
```
Row 1, FORCE WAVE: a pale-blue curved wind gust streak sweeping upward and outward from the ground.
Row 2, FRAIL CURSE: a dark purple chain link rising from the ground with violet runes floating around it.
Row 3, GRAVITY WELL: small rocks and dust being sucked down and swirling into the ground, purple glow at the base.
Row 4, SEAL VEIL: a tall translucent violet curtain of light rippling upward with faint rune symbols.
```

### แผ่น `ap_mg_e`: บัฟ
```
Row 1, EMPOWER FIELD: a tall golden rune pillar of light rising from the ground with floating golden glyphs.
Row 2, MANA SHIELD: a translucent blue hexagon shield panel standing upright and shimmering.
Row 3, TIME WARP: a small floating bronze clock gear turning above the ground with lilac sand grains falling.
Row 4, MANA WELL: a small fountain of glowing blue mana droplets rising from the ground and falling back.
```

## มือปืน

### แผ่น `ap_gs_a`: ควันและระเบิด (ใช้แค่ 3 แถว)
```
Row 1, SMOKE BOMB: a tall billowing column of grey smoke rising and swirling from the ground.
Row 2, CLUSTER BOMB: a small explosion bursting from the ground with orange fire and flying debris.
Row 3, ROCKET RAIN: a rocket hitting the ground and blowing up into a tall fiery mushroom burst with smoke.
Row 4: leave every cell empty magenta.
```

## สกิล → แถว (ตรงกับ `SKILL_PROPS` ใน `src/client/zonePropsTable.ts`)

| คลาส | สกิล | แผ่น/แถว |
|---|---|---|
| นักดาบ | ปฐพีแยก `earthquake` | ap_sw_a/1 |
| นักดาบ | คลื่นสั่นสะเทือน `sw_shockwave` | ap_sw_a/2 |
| นักดาบ | ปฐพีถล่ม `sw_cataclysm` | ap_sw_a/3 |
| นักดาบ | ปักหลัก `sw_anchor` | ap_sw_a/4 |
| นักดาบ | ทุบทำลาย `sw_crush` | ap_sw_b/1 |
| นักดาบ | ดาบพิพากษา `sw_judgement` | ap_sw_b/2 |
| นักดาบ | ปลดปล่อยพลัง `sw_unleash` | ap_sw_b/3 |
| นักดาบ | วงแหวนคมดาบ `sw_bladering` | ap_sw_b/4 |
| นักดาบ | ยั่วยุ `sw_taunt` | ap_sw_c/1 |
| นักดาบ | ปลุกใจนักรบ `sw_warcry` | ap_sw_c/2 |
| นักดาบ | ราชันย์ไม่ล้ม `sw_unbreakable` | ap_sw_c/3 |
| นักเวท | วงน้ำแข็ง `frostnova` | ap_mg_a/1 |
| นักเวท | อุกกาบาต `meteor` | ap_mg_a/2 |
| นักเวท | ระเบิดมานา `mg_manaburst` | ap_mg_a/3 |
| นักเวท | เวทชาร์จ `mg_chargedblast` | ap_mg_a/4 |
| นักเวท | คลื่นเพลิง `mg_flamewave` | ap_mg_b/1 |
| นักเวท | พื้นเพลิง `mg_flameground` | ap_mg_b/2 |
| นักเวท | ฝนเพลิง `mg_firerain` | ap_mg_b/3 |
| นักเวท | หมอกพิษอาคม `mg_poisonmist` | ap_mg_b/4 |
| นักเวท | เมล็ดเวทระเบิด `mg_hexseed` | ap_mg_c/1 |
| นักเวท | วงแหวนสลาย `mg_decayring` | ap_mg_c/2 |
| นักเวท | สนามเสื่อมสลาย `mg_decayfield` | ap_mg_c/3 |
| นักเวท | เถ้าถ่านคำสาป `mg_cursedash` | ap_mg_c/4 |
| นักเวท | คลื่นผลัก `mg_forcewave` | ap_mg_d/1 |
| นักเวท | คำสาปเปราะบาง `mg_frailcurse` | ap_mg_d/2 |
| นักเวท | หลุมแรงโน้มถ่วง `mg_gravitywell` | ap_mg_d/3 |
| นักเวท | ม่านผนึกเวท `mg_sealveil` | ap_mg_d/4 |
| นักเวท | สนามเร่งอาคม `mg_empowerfield` | ap_mg_e/1 |
| นักเวท | โล่มานาหมู่ `mg_manashield` | ap_mg_e/2 |
| นักเวท | บิดเบือนเวลา `mg_timewarp` | ap_mg_e/3 |
| นักเวท | วงคืนพลัง `mg_manawell` | ap_mg_e/4 |
| มือปืน | ระเบิดควัน `gs_smoke` | ap_gs_a/1 |
| มือปืน | ระเบิดลูกปราย `gs_cluster` | ap_gs_a/2 |
| มือปืน | ฝนจรวด `gs_rocketrain` | ap_gs_a/3 |

ในตารางนี้นับแถวเริ่มที่ 1 ส่วนในโค้ดนับเริ่มที่ 0 ความสูงและความหนาแน่นของแต่ละชิ้นปรับได้ที่ `SKILL_PROPS`
