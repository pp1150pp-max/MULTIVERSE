# วิธีช่วยกันเขียนโค้ด MULTIVERSE

## กติกาหลัก

**ห้าม push เข้า `main` ตรง ๆ** ทุกงานต้องแตก branch ใหม่ แล้วเปิด Pull Request (PR) เพื่อรวมเข้า `main`
GitHub ล็อก `main` ไว้แล้ว และจะรวม PR ได้ก็ต่อเมื่อ CI build ผ่าน

**ห้ามแตก branch ต่อจาก branch ที่ยังไม่ได้ merge** (ทั้งของตัวเองและของเพื่อน) ทุก branch ต้องแตกจาก `main` ล่าสุดเท่านั้น
เพราะเรารวม PR แบบ Squash and merge พอ branch ต้นทางถูกรวมเข้า `main` แล้ว branch ที่แตกต่อมาจะชนกัน (conflict) และ PR จะดึงงานของคนอื่นติดมาด้วย
ถ้างานใหม่ต้องใช้ของจาก PR ที่ยังไม่ merge ดูหัวข้อ [ถ้างานใหม่ต้องใช้ของจาก PR ที่ยังไม่ merge](#ถ้างานใหม่ต้องใช้ของจาก-pr-ที่ยังไม่-merge)

## เริ่มต้นครั้งแรก

ต้องมี [Git](https://git-scm.com/) และ [Node.js](https://nodejs.org/) เวอร์ชัน 20 ขึ้นไป

```bash
git clone https://github.com/pp1150pp-max/MULTIVERSE.git
cd MULTIVERSE
npm install
npm run dev        # เปิดเกมที่ http://localhost:5173
```

## รายการงานและบั๊ก (GitHub Issues)

งานที่จะทำและบั๊กที่เจอทั้งหมดอยู่ในแท็บ **Issues** ของ repo
- เจอบั๊ก → **New issue** → เลือก **รายงานบั๊ก** (บอกโหมด SP/MP ขั้นตอนที่เจอ และ error ใน Console)
- อยากเพิ่มอะไร → **New issue** → เลือก **งานใหม่**
- จะเริ่มทำ issue ไหน ให้กด **Assignees** ใส่ชื่อตัวเองก่อน คนอื่นจะได้รู้ว่ามีคนทำอยู่
- ตอนเปิด PR ใส่ `Fixes #เลข issue` ในคำอธิบาย พอ merge แล้ว issue จะปิดเอง

## ขั้นตอนทำงานทุกครั้ง

```bash
# 1. ดึง main ล่าสุดก่อนเริ่มงาน
git switch main
git pull

# 2. แตก branch ใหม่จาก main ตั้งชื่อตามงานที่ทำ (ห้ามแตกจาก branch อื่น)
git switch -c feature/zone-2

# 3. เขียนโค้ด แล้วตรวจว่า build ผ่าน
npm run build

# 4. commit แล้ว push ขึ้น GitHub
git add .
git commit -m "เพิ่มแผนที่ Zone 2"
git push -u origin feature/zone-2
```

5. เปิดหน้า repo บน GitHub กดปุ่ม **Compare & pull request** เขียนว่าทำอะไรไป แล้วกด **Create pull request**
6. รอให้ CI ขึ้นเครื่องหมายถูกสีเขียว ✓ และให้เพื่อนในทีมช่วยดู
7. กด **Squash and merge** แล้วลบ branch ทิ้งได้เลย

## ตั้งชื่อ branch

| ขึ้นต้นด้วย | ใช้เมื่อ | ตัวอย่าง |
|---|---|---|
| `feature/` | เพิ่มระบบหรือเนื้อหาใหม่ | `feature/zone-2`, `feature/party-system` |
| `fix/` | แก้บั๊ก | `fix/loot-not-pickup` |
| `art/` | เพิ่มหรือแก้ภาพ / สไปรต์ | `art/sword-attack` |
| `balance/` | ปรับตัวเลข เช่น EXP, ดาเมจ, ราคา | `balance/enhance-rates` |

1 branch = 1 งาน ถ้างานใหญ่ให้แบ่ง PR เล็ก ๆ จะรีวิวง่ายกว่าและชนกันน้อยกว่า

## ถ้า main ขยับไปแล้วระหว่างที่ทำงาน

```bash
git switch main
git pull
git switch feature/zone-2
git merge main         # ถ้ามีไฟล์ชนกัน (conflict) ให้แก้ แล้ว git add + git commit
```

## ถ้างานใหม่ต้องใช้ของจาก PR ที่ยังไม่ merge

เช่น จะทำอาร์ตแมพ 1 ให้เข้ากับแมพ 2 แต่ PR แมพ 2 ยังไม่ได้รวม

1. บอกในกลุ่มก่อน แล้วรอให้ PR นั้น merge เข้า `main`
2. พอ merge แล้ว ค่อย `git switch main` + `git pull` แล้วแตก branch ใหม่ตามปกติ

ระหว่างรอให้ทำงานอื่นที่ไม่เกี่ยวกันไปก่อน (แตกจาก `main` เหมือนเดิม)

## แบ่งงานกันยังไงไม่ให้ชน

- คุยกันก่อนว่าใครแก้ไฟล์ไหน ไฟล์ที่คนแก้บ่อยคือ `src/client/Game.ts` กับ `src/client/hud.ts`
- ตัวเลขเกม (มอนสเตอร์, ไอเทม, ตีบวก, ร้านค้า) อยู่ใน `src/shared/data/` แยกไฟล์ไว้แล้ว
- ภาพใส่ใน `public/assets/` ดูสเปกได้ที่ `public/assets/README.md` และ `art_templates/sword/README.md`

## เช็คก่อนเปิด PR

- branch แตกมาจาก `main` (ไม่ใช่ branch อื่นที่ยังไม่ merge) — ในหน้า PR ช่อง base ต้องเป็น `main` และรายการ commit ต้องมีแค่งานของเรา
- `npm run build` ผ่าน (CI จะรันคำสั่งเดียวกันนี้)
- เปิดเกมลองเล่นส่วนที่แก้ และไม่มี error ใน Console (กด F12)
- อย่า commit `node_modules/` หรือ `dist/` (`.gitignore` กันไว้แล้ว)
