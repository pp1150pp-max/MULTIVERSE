#!/usr/bin/env bash
# Puts the latest main on the live server (VPS): the same steps as the /update-server skill, in one place,
# so the owner (over SSH) and the GitHub "Deploy" button (.github/workflows/deploy.yml) do exactly the same.
#
#   tools/deploy.sh deploy <commit>   back up the DB → move to <commit> (must be origin/main) → build →
#                                     restart with the 120 s "update" countdown (or start it, if stopped)
#   tools/deploy.sh status            commit running, unit state, last log lines
#   tools/deploy.sh logs              last 80 log lines
#
# The GitHub key is locked to this script in ~/.ssh/authorized_keys of user multiverse:
#   command="/home/multiverse/MULTIVERSE/tools/deploy.sh",restrict ssh-ed25519 AAAA… github-deploy
# so it can only run the commands above (read from $SSH_ORIGINAL_COMMAND), never a shell.
# One deploy at a time (flock): a second one is refused, not queued.
#
# Everything runs from main() on the last line: bash has then read the whole file before running it,
# so the git update below may change this file safely.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/MULTIVERSE}"
PORT=2567

main() {
  local args cmd
  # From the locked key: the client's command line. Run by hand: the script's own arguments.
  if [ -n "${SSH_ORIGINAL_COMMAND:-}" ]; then read -r -a args <<<"$SSH_ORIGINAL_COMMAND"; else args=("$@"); fi
  cmd="${args[0]:-}"
  cd "$APP_DIR"

  case "$cmd" in
    status)
      echo "commit: $(git log -1 --format='%h %s')"
      node tools/autostart.mjs | head -1
      npm run -s logs -- --lines 8
      ;;
    logs)
      npm run -s logs -- --lines 80
      ;;
    deploy)
      local want="${args[1]:-}"
      [[ "$want" =~ ^[0-9a-f]{7,40}$ ]] || { echo "ใช้: deploy <commit ของ main>"; exit 2; }
      mkdir -p server/data
      exec 9>"server/data/deploy.lock"
      flock -n 9 || { echo "⚠ มีคนกำลัง deploy อยู่ — รอให้เสร็จแล้วลองใหม่"; exit 3; }
      deploy "$want"
      ;;
    *)
      echo "คำสั่ง: deploy <commit> | status | logs"; exit 2
      ;;
  esac
}

ready() { [ "$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:$PORT/")" = 200 ]; }

wait_ready() {
  # Up to ~2 min for the server to answer again after (re)starting.
  for _ in $(seq 1 60); do ready && return 0; sleep 2; done
  echo "⚠ server ไม่ตอบหลัง 2 นาที — ดู: tools/deploy.sh logs หรือ journalctl -u multiverse"
  return 1
}

# package.json's dependency fields at a commit, as one line of JSON (scripts and the rest left out).
deps_of() {
  git show "$1:package.json" | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const p=JSON.parse(s);console.log(JSON.stringify([p.dependencies,p.devDependencies,p.optionalDependencies,p.peerDependencies,p.overrides,p.engines]))})'
}

deploy() {
  local want="$1" old new running=0 deps=0
  [ -z "$(git status --porcelain)" ] || { echo "⚠ โค้ดบน VPS มีไฟล์ถูกแก้ (git status ไม่ว่าง) — หยุด ไม่ deploy"; git status --short; exit 4; }
  git fetch -q origin main
  new="$(git rev-parse origin/main)"
  [[ "$new" == "$want"* ]] || { echo "⚠ main ล่าสุดคือ ${new:0:7} ไม่ใช่ $want (มีคน merge เพิ่มระหว่างตรวจ) — กด deploy ใหม่"; exit 5; }
  old="$(git rev-parse HEAD)"
  if systemctl is-active -q multiverse; then running=1; fi
  # Only real dependency changes need npm ci (and so a full stop): the lock file, or package.json's
  # dependency fields. A new test in the "test" script is not one (it used to force a full stop every time).
  if ! git diff --quiet "$old" "$new" -- package-lock.json || [ "$(deps_of "$old")" != "$(deps_of "$new")" ]; then deps=1; fi
  echo "จาก ${old:0:7} → ${new:0:7} · server $([ $running = 1 ] && echo เปิดอยู่ || echo ไม่ได้เปิด) · dependency $([ $deps = 1 ] && echo เปลี่ยน || echo ไม่เปลี่ยน)"

  # 1. Back up the DB (the server keeps writing; VACUUM INTO makes a consistent copy). Keep the last 10.
  if [ -f server/data/multiverse.db ]; then
    mkdir -p server/data/backups
    local bak
    bak="server/data/backups/multiverse-before-deploy-$(date +%Y%m%d-%H%M%S)-${new:0:7}.db"
    sqlite3 server/data/multiverse.db "VACUUM INTO '$bak'"
    echo "สำรอง DB: $bak"
    ls -1t server/data/backups/multiverse-before-deploy-*.db | tail -n +11 | xargs -r rm -f
  fi

  # 2. New dependencies need a full stop (npm ci replaces node_modules under the running server).
  if [ $deps = 1 ] && [ $running = 1 ]; then
    echo "dependency เปลี่ยน → ปิด server เต็ม (ผู้เล่นเห็นป้ายปิด 120 วิ) แล้วเปิดใหม่"
    npm run -s stop-server -- --seconds 120
    running=0
  fi

  # 3. Code + build. Build into dist-next and swap, so a failed build never leaves the live site half-built.
  git merge -q --ff-only "$new"
  if [ $deps = 1 ]; then npm ci --no-audit --no-fund; fi
  rm -rf dist-next
  if ! npx vite build --outDir dist-next --emptyOutDir >server/data/deploy-build.log 2>&1; then
    tail -30 server/data/deploy-build.log
    echo "⚠ build ไม่ผ่าน — ถอยโค้ดกลับ ${old:0:7} (server ยังรันของเดิม)"
    git reset -q --hard "$old"
    if [ $deps = 1 ]; then npm ci --no-audit --no-fund; fi
    rm -rf dist-next
    if [ $running = 0 ]; then node tools/autostart.mjs -Start; fi
    exit 6
  fi
  rm -rf dist-old
  if [ -d dist ]; then mv dist dist-old; fi
  mv dist-next dist
  rm -rf dist-old
  echo "build แล้ว"

  # 4. Restart with the update countdown (the supervisor starts the new code), or start the unit.
  if [ $running = 1 ]; then
    npm run -s stop-server -- --restart --seconds 120
  else
    node tools/autostart.mjs -Start
  fi
  wait_ready
  echo "✅ server รัน $(git log -1 --format='%h %s')"
}

main "$@"; exit
