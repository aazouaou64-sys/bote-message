#!/usr/bin/env bash
# Gets the latest version of the bot from GitHub and restarts it.
#   bash /opt/bote-message/deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
npm ci --omit=dev --no-audit --no-fund >/dev/null
systemctl restart bote-message
echo "✅ Bot updated and restarted."
