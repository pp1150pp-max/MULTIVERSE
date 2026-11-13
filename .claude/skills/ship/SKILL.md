---
name: ship
description: เอาทุกอย่างที่ค้างเข้า main แล้วขึ้น server จริงในคำสั่งเดียว (ดู PR ที่เปิดอยู่ → ตรวจ → merge ทั้งหมด → typecheck/test → /update-server) ใช้เมื่อเจ้าของสั่ง /ship หรือ "merge main แล้วอัปเดต"
disable-model-invocation: true
---

# /ship: merge ทุกอย่างที่พร้อม แล้วขึ้น server จริง

เจ้าของสั่งครั้งเดียว ทำต่อเนื่องจนจบ **หยุดถามเฉพาะกรณีในหัวข้อ "หยุดถามก่อน"** ตอบเป็นภาษาไทยทั้งหมด

**ห้าม:**
- `gh pr merge --delete-branch`
- `npm run build` (ใช้ `npx vite build` ในขั้นอัปเดตเท่านั้น)
- kill task ของ `npm run online` หรือกด "End" ที่ task `MULTIVERSE server` ใน Task Scheduler
- แก้หรือ checkout branch อื่นในโฟลเดอร์หลัก เพราะ server จริงรันโค้ดจากที่นั่น
  - งานที่ต้องแก้โค้ด ให้ทำใน `git worktree` แยก
  - ถ้าเชื่อม `node_modules` ด้วย junction ต้องลบ junction ด้วย `cmd /c rmdir` **ก่อน** `git worktree remove`

## 1. ดูของค้าง

- `git fetch` แล้ว `gh pr list --state open --json number,title,headRefName,baseRefName,isDraft,mergeable,statusCheckRollup,body`
- `git log --oneline HEAD..origin/main`: commit ที่คนอื่น merge เข้า main แล้ว แต่ server ยังไม่มี
- ดูว่า server ตอนนี้รัน commit ไหน (`git log -1` ของโฟลเดอร์หลัก) และ port 2567 เปิดอยู่ไหม

## 2. ตรวจทีละ PR

- **CI:** ต้องผ่าน (`SUCCESS`) ถ้ายังรันอยู่ ให้รอด้วย `gh pr checks <n> --watch`
  - ถ้าล้มเพราะ GitHub เอง (ไม่มี log ของ build / "workflow file issue") ให้ `gh run rerun` หนึ่งครั้ง
- **draft:** ข้าม
- **คำอธิบาย PR เขียนว่า "อย่า merge"** หรือต้องเข้าพร้อม PR อื่น: ทำตามที่เขียนไว้
- **PR ซ้อนกัน** (base ไม่ใช่ `main`):
  - merge จากบนสุดลงล่างเข้า base ของตัวเอง แล้ว PR ล่างสุดเข้า main
  - ถ้า squash แล้ว PR ล่างกลับมาชน ให้ merge main เข้า branch นั้นแบบ `-s ours` ได้เฉพาะเมื่อยืนยันแล้วว่า tree ของมันมีโค้ด main ครบ (`git diff` กับ commit ที่รวมโค้ดแล้วต้องว่าง)
- **อ่าน diff:**
  - ไฟล์เล็ก ๆ ฝั่ง client ดูผ่าน ๆ พอ
  - ถ้าแตะเงิน ไอเทม เทรด ตลาด การตรวจค่าจาก client ใน `server/world.ts` หรือการเซฟ ให้อ่านจริง
- **จดไว้ว่า PR นี้เปลี่ยนเซฟหรือ DB ไหม:** ดูจาก `server/db.ts` และ `CharacterData` ใน `src/shared/sim/Player.ts`
- **จดไว้ว่า `package.json` เปลี่ยน dependency ไหม:** ถ้าเปลี่ยน ดูขั้น 5

## 3. Merge

- `gh pr merge <n> --squash` ทีละตัว ไล่ตามลำดับ (ตัวที่ไม่พึ่งใครก่อน)
- หลัง merge แต่ละตัว ให้เช็คว่า PR ที่เหลือยัง `MERGEABLE` อยู่
- จบแล้ว `git pull --ff-only` ในโฟลเดอร์หลัก

## 4. ตรวจบน main

- `npm run typecheck` และ `npm run test` ต้องผ่านทั้งคู่
- ถ้าไม่ผ่าน **หยุด ไม่ขึ้น server** แล้วรายงานว่าเทสต์ไหนล้ม และน่าจะมาจาก PR ไหน

## 5. ขึ้น server

ทำตาม `.claude/skills/update-server/SKILL.md` ตั้งแต่ขั้น 3 (สำรอง DB) จนถึงขั้น 6 (ยืนยันลิงก์)

- **สำรอง DB ทุกครั้ง** ตั้งชื่อไฟล์ตามสิ่งที่ขึ้นไป เช่น `multiverse-before-<เรื่อง>-<เวลา>.db`
- server จริงปกติรันจาก Task Scheduler `MULTIVERSE server` (`npm run always-on` ไม่มีหน้าต่าง) · สถานะ `npm run autostart` · log `npm run logs` (ดูว่าขึ้น "พร้อมแล้ว" หลังรีสตาร์ท)
- **ถ้า server ไม่ได้เปิดอยู่** (port 2567 ว่าง): `npm run autostart -- -Start` แล้วรอ "พร้อมแล้ว" ใน `npm run logs` · ห้ามเปิดในแท็บ Terminal ของแอปหรือ task background ของ session
  - ลิงก์ถาวรไม่เปลี่ยน (ถ้ายังใช้ quick tunnel อยู่ ลิงก์ใหม่ต้องบอกเจ้าของชัด ๆ ให้ส่งเพื่อน)
- **ลิงก์ใหม่อาจยังเข้าไม่ได้ทันที** (DNS ยังไม่ทัน, curl ได้ 000 / exit 6): ให้ลองซ้ำสักพัก อย่าเพิ่งสรุปว่าพัง

## หยุดถามก่อน (ไม่ต้องถามกรณีอื่น)

- **PR ชนกับ main** ต้องรวมโค้ดสองฝั่งเอง: บอกว่าชนไฟล์ไหน เป็นงานเรื่องอะไรกับอะไร แล้วถามว่าจะให้รวมเลยไหม
  - ระหว่างนี้ merge ตัวอื่นที่ไม่เกี่ยวต่อไปได้
- **CI ไม่ผ่าน** (รัน rerun แล้วก็ยังไม่ผ่าน)
- **PR เปลี่ยน dependency ใน `package.json`:** ต้อง `npm ci` ซึ่งต้องปิด server เต็ม ผู้เล่นจะเห็นป้ายปิด ไม่ใช่ป้ายอัปเดต (`npm run stop-server` → `npm ci` → `npx vite build` → `npm run autostart -- -Start`)
- **ไม่มีอะไรใหม่เลย** (ไม่มี PR พร้อม และ main ตรงกับ server แล้ว): บอกว่าไม่มีอะไรต้องขึ้น อย่ารีสตาร์ทให้ผู้เล่นหลุดเปล่า ๆ
- **เจอสิ่งที่ดูผิดกติกาใน `docs/systems/`** ระหว่างอ่าน diff: ถามก่อน merge PR นั้น

## รายงานท้ายงาน (สั้น ๆ)

- commit ที่ server รันอยู่ และลิงก์ (บอกว่าเปลี่ยนหรือไม่)
- **ขึ้นไปรอบนี้:** แต่ละ PR บรรทัดเดียว พร้อมเลข #
- **ข้ามไป:** PR ไหน และเพราะอะไร
- ผล typecheck/test และชื่อไฟล์สำรอง DB
- **สิ่งที่ยังไม่ได้ลองในเกมจริง**
