# วิธีช่วยกันเขียนโค้ด MULTIVERSE

## กติกาหลัก

**ห้าม push เข้า `main` ตรง ๆ** ทุกงานต้องแตก branch ใหม่ แล้วเปิด Pull Request (PR) เพื่อรวมเข้า `main`
GitHub ล็อก `main` ไว้แล้ว และจะรวม PR ได้ก็ต่อเมื่อ CI build ผ่าน

## เริ่มต้นครั้งแรก

ต้องมี [Git](https://git-scm.com/) และ [Node.js](https://nodejs.org/) เวอร์ชัน 20 ขึ้นไป

```bash
git clone https://github.com/pp1150pp-max/MULTIVERSE.git
cd MULTIVERSE
npm install
npm run dev        # เปิดเกมที่ http://localhost:5173
```

## ขั้นตอนทำงานทุกครั้ง

```bash
# 1. ดึง main ล่าสุดก่อนเริ่มงาน
git switch main
git pull

# 2. แตก branch ใหม่ ตั้งชื่อตามงานที่ทำ
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

## แบ่งงานกันยังไงไม่ให้ชน

- คุยกันก่อนว่าใครแก้ไฟล์ไหน ไฟล์ที่คนแก้บ่อยคือ `src/client/Game.ts` กับ `src/client/hud.ts`
- ตัวเลขเกม (มอนสเตอร์, ไอเทม, ตีบวก, ร้านค้า) อยู่ใน `src/shared/data/` แยกไฟล์ไว้แล้ว
- ภาพใส่ใน `public/assets/` ดูสเปกได้ที่ `public/assets/README.md` และ `art_templates/sword/README.md`

## เช็คก่อนเปิด PR

- `npm run build` ผ่าน (CI จะรันคำสั่งเดียวกันนี้)
- เปิดเกมลองเล่นส่วนที่แก้ และไม่มี error ใน Console (กด F12)
- อย่า commit `node_modules/` หรือ `dist/` (`.gitignore` กันไว้แล้ว)
