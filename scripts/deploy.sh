#!/usr/bin/env bash

set -euo pipefail

PROJECT_PATH="${PROJECT_PATH:-$HOME/Progress-Check-mini-app-Telegram-}"
BRANCH="${BRANCH:-main}"
PM2_APP_NAME="${PM2_APP_NAME:-miniapp}"
INSTALL_REQUIREMENTS="${INSTALL_REQUIREMENTS:-0}"

cd "$PROJECT_PATH"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ "$INSTALL_REQUIREMENTS" = "1" ]; then
  if command -v pip3 >/dev/null 2>&1; then
    pip3 install -r requirements.txt
  elif command -v pip >/dev/null 2>&1; then
    pip install -r requirements.txt
  else
    echo "pip/pip3 not found on server." >&2
    exit 1
  fi
fi

if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME"
else
  pm2 start main.py --name "$PM2_APP_NAME" --interpreter python3
fi

pm2 save
