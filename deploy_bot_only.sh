#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# MedEye — QUIET BOT DEPLOY (ONLY BOT)
# ──────────────────────────────────────────────────────────────────────────────

set -e
SERVER="root@92.38.48.231"
REMOTE_DIR="/root/medeye/api"
LOCAL_BOT_FILE="./deploy/bot_slim_v2.6.py"

# Название службы бота на сервере (definitively medeye_bot.service)
BOT_SERVICE="medeye_bot.service" 

echo "──────────────────────────────────────────"
echo " 🤫 MedEye Quiet Bot Deploy"
echo "──────────────────────────────────────────"

# 1. Останавливаем бота
echo "[1/3] Stopping $BOT_SERVICE..."
ssh "$SERVER" "systemctl stop $BOT_SERVICE" || echo "Warning: Could not stop $BOT_SERVICE (maybe not running)"

# 2. Загружаем только файл бота
echo "[2/3] Uploading $LOCAL_BOT_FILE..."
scp "$LOCAL_BOT_FILE" "$SERVER:$REMOTE_DIR/bot_slim_v2.6.py"

# 3. Запускаем бота
echo "[3/3] Starting $BOT_SERVICE..."
ssh "$SERVER" "systemctl start $BOT_SERVICE && systemctl is-active $BOT_SERVICE"

echo "──────────────────────────────────────────"
echo " ✅ BOT IS BACK ONLINE WITH SUPERADMIN!"
echo "──────────────────────────────────────────"
