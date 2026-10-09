#!/usr/bin/env bash
# Installs bote-message on a Debian/Ubuntu server:
# Node.js, a systemd service, and Caddy for HTTPS (Meta webhooks need a valid certificate).
# Run as root from the cloned repo:  bash /opt/bote-message/deploy/install.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE=/etc/bote-message.env
SERVICE=bote-message

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m!! %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run this as root."
command -v apt-get >/dev/null || die "This script supports Debian/Ubuntu only."

# Public hostname: your own domain (DOMAIN=bot.example.com bash install.sh),
# or by default a free name that points to this server's IP, e.g. 2-28-195-233.sslip.io
if [ -z "${DOMAIN:-}" ]; then
  IP="$(curl -4 -fsS https://api.ipify.org || true)"
  [ -n "$IP" ] || die "Could not find this server's public IPv4 address. Run again with DOMAIN=your.domain"
  DOMAIN="${IP//./-}.sslip.io"
fi

say "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git debian-keyring debian-archive-keyring apt-transport-https >/dev/null

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  say "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi

if ! command -v caddy >/dev/null; then
  say "Installing Caddy (HTTPS)"
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi

say "Installing the bot's dependencies"
cd "$APP_DIR"
# Let "git pull" (deploy/update.sh) use the GitHub deploy key made during setup.
if [ -d .git ] && [ -f /root/.ssh/bote_deploy ]; then
  git config core.sshCommand "ssh -i /root/.ssh/bote_deploy -o StrictHostKeyChecking=accept-new"
fi
npm ci --omit=dev --no-audit --no-fund >/dev/null

id -u bote >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin bote

# Settings file, readable by root only. Existing values are kept.
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"
set_default() { grep -q "^$1=" "$ENV_FILE" || echo "$1=$2" >> "$ENV_FILE"; }
set_default HOST 127.0.0.1
set_default PORT 3000
set_default DRY_RUN true
set_default META_VERIFY_TOKEN "bote-$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"

if ! grep -q '^ANTHROPIC_API_KEY=.' "$ENV_FILE" && ! { : </dev/tty; } 2>/dev/null; then
  printf '\n\033[1;33m⚠️  No Claude key yet. Add it later with: bash %s/deploy/set-env.sh ANTHROPIC_API_KEY\033[0m\n' "$APP_DIR"
elif ! grep -q '^ANTHROPIC_API_KEY=.' "$ENV_FILE"; then
  say "Paste your Claude key (sk-ant-...) and press Enter. Nothing shows while you paste; that is normal."
  read -rs KEY </dev/tty
  echo
  [[ "$KEY" == sk-ant-* ]] || die "That does not look like a Claude key (it starts with sk-ant-). Run the script again."
  sed -i '/^ANTHROPIC_API_KEY=/d' "$ENV_FILE"
  echo "ANTHROPIC_API_KEY=$KEY" >> "$ENV_FILE"
  unset KEY
fi

say "Creating the service"
cat > /etc/systemd/system/$SERVICE.service <<UNIT
[Unit]
Description=bote-message (Facebook and Instagram auto-reply bot)
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=$ENV_FILE
WorkingDirectory=$APP_DIR
ExecStart=$(command -v node) src/server.js
Restart=always
RestartSec=5
User=bote
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now $SERVICE >/dev/null 2>&1
systemctl restart $SERVICE

say "Setting up HTTPS for $DOMAIN"
if [ -f /etc/caddy/Caddyfile ] && ! grep -q "bote-message" /etc/caddy/Caddyfile; then
  cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak
fi
cat > /etc/caddy/Caddyfile <<CADDY
# bote-message
$DOMAIN {
	reverse_proxy 127.0.0.1:3000
}
CADDY
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi
systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy || die "Caddy could not start. Is another program (nginx, apache) already using ports 80/443?"

say "Checking"
OK=""
for _ in $(seq 1 30); do
  if curl -fsS "https://$DOMAIN/" 2>/dev/null | grep -q "bote-message is running"; then OK=1; break; fi
  sleep 3
done

VERIFY_TOKEN="$(grep '^META_VERIFY_TOKEN=' "$ENV_FILE" | cut -d= -f2-)"
echo
if [ -n "$OK" ]; then
  printf '\033[1;32m✅ The bot is running (test mode: it sends nothing to customers).\033[0m\n'
else
  printf '\033[1;33m⚠️  The bot is installed but https://%s does not answer yet.\033[0m\n' "$DOMAIN"
  echo "   If your hosting has a firewall in its website, open ports 80 and 443, then run this script again."
fi
echo
echo "   Callback URL : https://$DOMAIN/webhook"
echo "   Verify token : $VERIFY_TOKEN"
echo
echo "   Logs         : journalctl -u $SERVICE -f"
