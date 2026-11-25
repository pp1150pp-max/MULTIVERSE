# เพลงห้องบอสแนวกอทิก (2 เพลง ตามชั้น)

เครื่องมือ: **Mureka** (mureka.ai → Create Music → แท็บ **Custom**) · เจ้าของเลือก 2026-11-25
เกมเล่นไฟล์เหล่านี้แทนเพลง chiptune ในห้องบอส ดูกติกาใน [audio.md](../../docs/systems/audio.md)

| ไฟล์ในเกม | ใช้กับ (ค่าเริ่มต้น เปลี่ยนได้ใน /admin) |
|---|---|
| `public/assets/music/boss_gothic_f1.mp3` | ชั้น 1: หมีป่า แม่มดหนอง เยติ หัวใจภูเขาไฟ |
| `public/assets/music/boss_gothic_f2.mp3` | ชั้น 2: ปูยักษ์ กัปตันขาไม้ กัปตันผี คราเคน |

**ยังไม่มีไฟล์ = ห้องนั้นเล่น chiptune เดิม** ไม่ต้องแก้โค้ด

## กติกาของ prompt

- เพลงใหม่ทั้งหมด ห้ามใส่ชื่อเพลง ชื่อศิลปิน หรือชื่อเรื่องใด ๆ ใน prompt เนื้อร้อง หรือชื่อเพลง
- ห้ามอัปโหลดหรือแนบลิงก์เพลงอ้างอิง (ช่อง Style Reference / Remix ปล่อยว่าง)
- คอรัสร้องแต่พยางค์สระ ไม่มีคำที่มีความหมาย
- ปิดสวิตช์ **Instrumental** (เปิดแล้วคอรัสหาย) · Duration → Custom ประมาณ 2:00–2:30 (ใช้ได้ 1:30–3:00)

## เพลงชั้น 1: `boss_gothic_f1` (มหาวิหารมืด)

ชื่อเพลง: `Boss Gothic F1`

Music Style:

```
dark gothic orchestral boss battle, D minor, 132 BPM, large mixed choir singing wordless vowels in a solemn latin sacred style, thundering church pipe organ, heavy low strings with driving staccato ostinato, timpani, tubular bells, ominous, majestic, relentless, full energy from the first second, steady intensity, no fade out, ending flows back into the beginning, seamless loop game soundtrack
```

Lyrics:

```
[Choir]
Ah... ah... ah...
Oh... oh... ah...

[Verse]
Ah-ah-ah, oh-oh
Ah-ah, eh-oh, ah

[Chorus]
Ah! Oh! Ah!
Oh-ah, oh-ah, ah...

[Verse]
Oh-oh-oh, ah-ah
Eh-ah, oh-ah, oh

[Chorus]
Ah! Oh! Ah!
Oh-ah, oh-ah, ah...
```

## เพลงชั้น 2: `boss_gothic_f2` (ทะเลคำสาป)

ชื่อเพลง: `Boss Gothic F2`

Music Style:

```
dark gothic orchestral sea battle, C minor, 140 BPM, deep male choir with high sopranos singing wordless vowels in a solemn latin sacred style, drowned cathedral pipe organ, surging cello ostinato like crashing waves, low brass, war drums, ship bell, stormy, ominous, epic, relentless, full energy from the first second, steady intensity, no fade out, ending flows back into the beginning, seamless loop game soundtrack
```

Lyrics:

```
[Choir]
Oh... oh... oh...
Ah... oh... oh...

[Verse]
Oh-oh, ah-oh
Oh-ah-oh, eh-oh

[Chorus]
Oh! Ah! Oh!
Ah-oh, ah-oh, oh...

[Verse]
Ah-ah, oh-ah
Eh-oh, ah-oh, ah

[Chorus]
Oh! Ah! Oh!
Ah-oh, ah-oh, oh...
```

## วางไฟล์และแปลง

1. ดาวน์โหลดเพลงที่เลือกแล้ว (mp3 หรือ wav) ตั้งชื่อ `boss_gothic_f1` / `boss_gothic_f2` วางที่ **`art_templates/music/raw/`**
2. แปลง (ต้องมี `ffmpeg`):

```powershell
node tools/convert_music.mjs
```

สคริปต์ตัดเสียงเงียบหัวท้าย ต่อท้ายเพลงเข้าหัวเพลง (crossfade 3 วิ) ให้วนลูปเนียน ปรับความดังเป็น −18 LUFS แล้วเขียน `public/assets/music/<ชื่อ>.mp3` (128 kbps ราว 2–3 MB)

ตัวเลือกเมื่อเพลงมีท่อนนำเงียบหรือจบแบบค่อย ๆ เบา (ใส่ชื่อเพลงเดียว):

```powershell
node tools/convert_music.mjs boss_gothic_f1 --start=4 --end=140 --fade=3
```

3. commit ไฟล์ใน `public/assets/music/` แล้วเปิด PR (ไฟล์ดิบใน `raw/` ไม่ต้อง commit)

## สิทธิ์ใช้งานเชิงพาณิชย์ (สำคัญ)

ข้อมูลจากบล็อกภายนอก (ยังไม่ได้เช็กกับเงื่อนไขของ Mureka เอง): เพลงจากแพลน **Free ใช้เชิงพาณิชย์ไม่ได้และอาจมีลายน้ำ** สิทธิ์เชิงพาณิชย์มากับแพลนเสียเงิน
เกมมี cash shop → **ก่อนเปิดขายจริง ต้องเจนใหม่บนแพลนเสียเงิน** (หรือยืนยันจากเงื่อนไขของ Mureka ว่าใช้ได้) แล้วทับไฟล์เดิมด้วยชื่อเดิม
