#!/usr/bin/env bash

set -euo pipefail

PROJECT_PATH="${PROJECT_PATH:-$HOME/Progress-Check-mini-app-Telegram-}"
BRANCH="${BRANCH:-main}"
PM2_APP_NAME="${PM2_APP_NAME:-miniapp}"

cd "$PROJECT_PATH"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [[ -d "venv" ]]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
elif [[ -d ".venv" ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
else
  echo "Python virtual environment not found (expected venv/ or .venv/)." >&2
  exit 1
fi

pip install -r requirements.txt

if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME"
else
  pm2 start main.py --name "$PM2_APP_NAME" --interpreter python3
fi

pm2 save
