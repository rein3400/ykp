#!/usr/bin/env bash
# Install Hermez Telegram bot worker on a fresh Ubuntu 22.04/24.04 VPS.
# Run as root:  bash install.sh
set -euo pipefail

APP_DIR=/opt/hermez-bot
SERVICE_USER=hermez-bot
NODE_MAJOR=22

echo "==> [1/6] create user + dirs"
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi
mkdir -p "$APP_DIR"
chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR"

echo "==> [2/6] install Node $NODE_MAJOR (NodeSource)"
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "v$NODE_MAJOR"; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
echo "node: $(node -v)  npm: $(npm -v)"

echo "==> [3/6] copy bot-worker.mjs"
# Assume this script is run from the scripts/vps directory (or with the file next to it).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "$SCRIPT_DIR/bot-worker.mjs" ]; then
  echo "ERROR: bot-worker.mjs not found next to install.sh ($SCRIPT_DIR)"
  exit 1
fi
install -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0644 "$SCRIPT_DIR/bot-worker.mjs" "$APP_DIR/bot-worker.mjs"

echo "==> [4/6] env file"
if [ ! -f "$APP_DIR/.env" ]; then
  if [ -f "$SCRIPT_DIR/hermez-bot.env.example" ]; then
    install -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0600 "$SCRIPT_DIR/hermez-bot.env.example" "$APP_DIR/.env"
    echo "Wrote $APP_DIR/.env from example — EDIT IT with real secrets before starting."
  else
    echo "ERROR: hermez-bot.env.example missing"
    exit 1
  fi
else
  echo "Keeping existing $APP_DIR/.env"
fi

echo "==> [5/6] systemd unit"
install -m 0644 "$SCRIPT_DIR/hermez-bot.service" /etc/systemd/system/hermez-bot.service
systemctl daemon-reload
systemctl enable hermez-bot.service

echo "==> [6/6] start"
systemctl restart hermez-bot.service
sleep 2
systemctl --no-pager --full status hermez-bot.service || true
echo
echo "Logs:  journalctl -u hermez-bot -f"
echo "Stop:  systemctl stop hermez-bot"
echo "Start: systemctl start hermez-bot"
echo
echo "Sanity checks (run after editing .env):"
echo "  journalctl -u hermez-bot -n 50 --no-pager | grep -E 'boot|polling|alive|error'"
echo "  # Expect: [hermez-bot] boot web=https://ykp-erp-hermez-production... token=set secret=set"
echo "  # Expect: [hermez-bot] polling started"
echo "  # Then send a message in the owner Telegram group (-5437367893) or DM (5721500978)."