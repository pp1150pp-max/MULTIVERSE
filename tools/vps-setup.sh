#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 VPS for the live MULTIVERSE server (docs/vps-move.md).
# Run as root, from the home PC:
#   scp tools/vps-setup.sh root@<VPS IP>:
#   ssh root@<VPS IP> bash vps-setup.sh
# Safe to run again (each step skips what is already done).
#
# What it does:
#   - timezone Asia/Bangkok, apt packages (git, curl, ufw, sqlite3), security updates stay on (Ubuntu default)
#   - Node $NODE_VERSION from nodejs.org (checked against its SHA256 list) into /usr/local
#   - cloudflared from Cloudflare's apt repository
#   - swap file ($SWAP_GB GB)
#   - user $APP_USER (no password, no sudo except starting/stopping/status of the unit), gets root's SSH keys
#   - SSH: keys only (no password login), root only with a key
#   - ufw: only SSH in. The game port 2567 is not opened (the server also listens on 127.0.0.1 only);
#     players come in through the Cloudflare tunnel, which connects outwards
#   - clones the repo into /home/$APP_USER/MULTIVERSE, npm ci, npx vite build
#   - systemd unit 'multiverse' (enabled at boot, NOT started: copy the DB and tunnel files first)
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-24.22.1}"   # same as the Windows PC (node -v)
APP_USER="${APP_USER:-multiverse}"
REPO_URL="${REPO_URL:-https://github.com/pp1150pp-max/MULTIVERSE.git}"
SWAP_GB="${SWAP_GB:-2}"
APP_HOME="/home/$APP_USER"
APP_DIR="$APP_HOME/MULTIVERSE"

say() { printf '\n== %s\n' "$*"; }
as_app() { sudo -u "$APP_USER" -H bash -c "cd ~ && $1"; }

[ "$(id -u)" -eq 0 ] || { echo "ต้องรันด้วย root (ssh root@<VPS IP> bash vps-setup.sh)"; exit 1; }
. /etc/os-release
[ "${ID:-}" = ubuntu ] || echo "⚠ ไม่ใช่ Ubuntu (${PRETTY_NAME:-?}) — สคริปต์เขียนสำหรับ Ubuntu 24.04"

say "เวลา: Asia/Bangkok"
timedatectl set-timezone Asia/Bangkok

say "ลงโปรแกรมพื้นฐาน"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q git curl ca-certificates ufw sqlite3 xz-utils sudo

say "Node $NODE_VERSION"
if [ "$(/usr/local/bin/node -v 2>/dev/null || true)" = "v$NODE_VERSION" ]; then
  echo "มีอยู่แล้ว"
else
  case "$(uname -m)" in x86_64) ARCH=x64 ;; aarch64) ARCH=arm64 ;; *) echo "ไม่รู้จัก CPU $(uname -m)"; exit 1 ;; esac
  TAR="node-v$NODE_VERSION-linux-$ARCH.tar.xz"
  TMP="$(mktemp -d)"
  curl -fsSL -o "$TMP/$TAR" "https://nodejs.org/dist/v$NODE_VERSION/$TAR"
  curl -fsSL -o "$TMP/SHASUMS256.txt" "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
  (cd "$TMP" && grep " $TAR\$" SHASUMS256.txt | sha256sum -c -)
  tar -xJf "$TMP/$TAR" -C /usr/local --strip-components=1 --no-same-owner
  rm -rf "$TMP"
fi
/usr/local/bin/node -v

say "cloudflared"
if ! command -v cloudflared >/dev/null; then
  mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
    > /etc/apt/sources.list.d/cloudflared.list
  apt-get update -q
  apt-get install -y -q cloudflared
fi
cloudflared --version

say "swap ${SWAP_GB} GB"
if swapon --show=NAME --noheadings | grep -q .; then
  echo "มี swap อยู่แล้ว"
else
  fallocate -l "${SWAP_GB}G" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/99-multiverse.conf
sysctl -q -p /etc/sysctl.d/99-multiverse.conf

say "user $APP_USER"
if ! id "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos '' "$APP_USER"
fi
usermod -aG systemd-journal "$APP_USER"   # journalctl -u multiverse without sudo
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "$APP_HOME/.ssh"
if [ -s /root/.ssh/authorized_keys ]; then
  touch "$APP_HOME/.ssh/authorized_keys"
  # Add root's keys that the user does not have yet.
  while IFS= read -r k; do
    if [ -n "$k" ] && ! grep -qxF "$k" "$APP_HOME/.ssh/authorized_keys"; then
      echo "$k" >> "$APP_HOME/.ssh/authorized_keys"
    fi
  done < /root/.ssh/authorized_keys
  chown "$APP_USER:$APP_USER" "$APP_HOME/.ssh/authorized_keys"
  chmod 600 "$APP_HOME/.ssh/authorized_keys"
fi

say "SSH: ล็อกอินด้วย key เท่านั้น"
if [ -s /root/.ssh/authorized_keys ]; then
  # 00- so it wins over Ubuntu's 50-cloud-init.conf (sshd keeps the first value it reads).
  cat > /etc/ssh/sshd_config.d/00-multiverse.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
  sshd -t
  systemctl reload ssh || systemctl restart ssh
else
  echo "⚠ root ไม่มี SSH key (/root/.ssh/authorized_keys ว่าง) — ยังไม่ปิดล็อกอินด้วยรหัสผ่าน ใส่ key ก่อนแล้วรันใหม่"
fi

say "firewall (ufw): เปิดแค่ SSH"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw --force enable
ufw status verbose

say "โค้ดเกม: $APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  as_app "git clone '$REPO_URL' '$APP_DIR'"
fi
as_app "cd '$APP_DIR' && git pull --ff-only && npm ci --no-audit --no-fund && npx vite build"
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "$APP_DIR/server/data" "$APP_HOME/.cloudflared"

say "systemd unit 'multiverse'"
(cd "$APP_DIR" && /usr/local/bin/node tools/autostart.mjs -Install)

# The server user may start/stop/see its own unit and nothing else as root.
cat > /etc/sudoers.d/multiverse <<EOF
$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl start multiverse, /usr/bin/systemctl stop multiverse, /usr/bin/systemctl status multiverse
EOF
chmod 440 /etc/sudoers.d/multiverse
visudo -cf /etc/sudoers.d/multiverse

say "เสร็จ"
cat <<EOF
ต่อไป (docs/vps-move.md):
  - ทดสอบ: ssh $APP_USER@<VPS IP> แล้ว cd MULTIVERSE && npm run autostart
  - ซ้อม: เปิดแบบไม่มีลิงก์ (ดู "ซ้อม" ใน docs/vps-move.md)
  - วันย้าย: คัด multiverse.db, server/data/tunnel-config.json และ ~/.cloudflared ไปที่
    $APP_DIR/server/data/ และ $APP_HOME/.cloudflared/ (scp ด้วย user $APP_USER) แล้ว npm run autostart -- -Start
EOF
