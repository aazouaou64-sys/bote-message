#!/usr/bin/env bash
# Sets one setting of the bot without showing its value, then restarts the bot.
#   bash /opt/bote-message/deploy/set-env.sh META_PAGE_ACCESS_TOKEN
set -euo pipefail
ENV_FILE=/etc/bote-message.env
NAME="${1:-}"
[[ "$NAME" =~ ^[A-Z0-9_]+$ ]] || { echo "Usage: bash $0 NAME"; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "Run this as root."; exit 1; }
printf 'Paste the value for %s and press Enter (nothing shows, that is normal): ' "$NAME"
read -rs VALUE </dev/tty
echo
[ -n "$VALUE" ] || { echo "Empty value, nothing changed."; exit 1; }
touch "$ENV_FILE"; chmod 600 "$ENV_FILE"
sed -i "/^$NAME=/d" "$ENV_FILE"
printf '%s=%s\n' "$NAME" "$VALUE" >> "$ENV_FILE"
systemctl restart bote-message
echo "✅ $NAME saved, bot restarted."
