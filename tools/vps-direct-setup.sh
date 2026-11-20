#!/usr/bin/env bash
# Direct game connection on the VPS (docs/systems/server-ops.md "ต่อตรง"): Caddy takes TLS on 443 for the
# DNS-only hostname and passes /ws to the game server's direct port on 127.0.0.1. Run as root:
#   ssh root@<VPS IP> "bash ~multiverse/MULTIVERSE/tools/vps-direct-setup.sh"            install / update
#   ssh root@<VPS IP> "bash ~multiverse/MULTIVERSE/tools/vps-direct-setup.sh off"        emergency: close 80/443, stop Caddy
#   ssh root@<VPS IP> "bash ~multiverse/MULTIVERSE/tools/vps-direct-setup.sh on"         open them again
# Safe to run again. Touches neither the game code nor the game server (no build, no restart).
# Before the first run: a DNS-only (grey cloud) A record <HOST> → this VPS's IP in Cloudflare, else
# Let's Encrypt cannot reach Caddy (it keeps retrying, nothing breaks).
set -euo pipefail

HOST="${DIRECT_HOST:-ws.multiverse-game.com}"
PORT="${DIRECT_WS_PORT:-2569}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say() { printf '\n== %s\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "ต้องรันด้วย root"; exit 1; }
[[ "$HOST" =~ ^[a-z0-9-]+(\.[a-z0-9-]+){2,}$ ]] || { echo "ชื่อ hostname ไม่ถูกต้อง: $HOST"; exit 2; }
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "port ไม่ถูกต้อง: $PORT"; exit 2; }

case "${1:-install}" in
  off)
    say "ปิดทางต่อตรง: ปิด port 80/443 และหยุด Caddy (ผู้เล่นกลับไปผ่าน Cloudflare เอง — ปิดสวิตช์ใน /admin ด้วย)"
    ufw delete allow 80/tcp >/dev/null 2>&1 || true
    ufw delete allow 443/tcp >/dev/null 2>&1 || true
    systemctl stop caddy || true
    ufw status verbose
    exit 0
    ;;
  on)
    say "เปิดทางต่อตรงอีกครั้ง"
    ufw allow 80/tcp
    ufw allow 443/tcp
    systemctl start caddy
    ufw status verbose
    exit 0
    ;;
  install) ;;
  *) echo "ใช้: vps-direct-setup.sh [install|off|on]"; exit 2 ;;
esac

say "ตรวจ DNS ของ $HOST"
MYIP="$(curl -fsS -4 --max-time 5 https://api.ipify.org || true)"
DNSIP="$(getent ahostsv4 "$HOST" | awk 'NR==1{print $1}' || true)"
echo "IP ของเครื่องนี้: ${MYIP:-?} · DNS ของ $HOST: ${DNSIP:-ไม่พบ}"
if [ -z "$DNSIP" ] || [ "$DNSIP" != "$MYIP" ]; then
  echo "⚠ DNS ยังไม่ชี้มาที่เครื่องนี้ (ต้องเป็น A record แบบ DNS only / เมฆสีเทา) — Caddy จะขอใบรับรองไม่ได้จนกว่าจะถูก (ลองใหม่เอง)"
fi

say "Caddy (apt ของ Caddy)"
if ! command -v caddy >/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y -q debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi
caddy version

say "/etc/caddy/Caddyfile ($HOST → 127.0.0.1:$PORT เฉพาะ /ws)"
sed -e "s/@HOST@/$HOST/g" -e "s/@PORT@/$PORT/g" "$HERE/Caddyfile.direct" > /etc/caddy/Caddyfile.new
caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile.new
mv /etc/caddy/Caddyfile.new /etc/caddy/Caddyfile
systemctl enable caddy
systemctl reload caddy 2>/dev/null || systemctl restart caddy

say "firewall (ufw): เปิด 80 (ขอ/ต่ออายุใบรับรอง) และ 443 (ต่อตรง)"
ufw allow 80/tcp
ufw allow 443/tcp
ufw status verbose

say "เสร็จ"
cat <<EOF
ต่อไป:
  - รอ ~1 นาทีให้ Caddy ได้ใบรับรอง: journalctl -u caddy -n 30 (หา "certificate obtained")
  - ลอง: curl -sI https://$HOST/ → ควรได้ 404 (หน้าอื่นนอกจาก /ws ไม่เปิด)
  - เปิดสวิตช์ "ต่อตรง (ลดปิง)" ใน /admin แท็บ Server
  - ฉุกเฉิน (โดนยิง): ปิดสวิตช์ใน /admin แล้ว bash $HERE/vps-direct-setup.sh off
EOF
