#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# MedEye — ФИНАЛЬНЫЙ СТАНДАРТНЫЙ ДЕПЛОЙ (v3.0)
# Запускать: bash deploy_standard.sh
# ──────────────────────────────────────────────────────────────────────────────

set -e
SERVER="root@92.38.48.231"
REMOTE_ROOT="/root/medeye"
LOCAL_FILES="./deploy"

echo "──────────────────────────────────────────"
echo " 🧹 MedEye Unified Deploy (Standardized)"
echo "──────────────────────────────────────────"

# 1. Собираем фронтенд (если есть npm)
if command -v npm &> /dev/null; then
    echo "[1/4] Building frontend..."
    export PATH=$PATH:/opt/homebrew/bin
    npm run build
    rm -rf deploy/dist && cp -r dist deploy/dist
fi

# 2. Загружаем бэкенд
echo "[2/4] Uploading backend..."
scp "$LOCAL_FILES/api.py" \
    "$LOCAL_FILES/database.py" \
    "$LOCAL_FILES/master_db.py" \
    "$LOCAL_FILES/calculators.py" \
    "$LOCAL_FILES/haigis.py" \
    "$LOCAL_FILES/toric_engine.py" \
    "$LOCAL_FILES/ocr_engine.py" \
    "$LOCAL_FILES/nomogram.py" \
    "$LOCAL_FILES/backup_system.py" \
    "$SERVER:$REMOTE_ROOT/api/"

# 3. Загружаем фронтенд
if [ -d "$LOCAL_FILES/dist" ]; then
    echo "[3/4] Uploading frontend dist..."
    scp -r "$LOCAL_FILES/dist" "$SERVER:$REMOTE_ROOT/"
fi

# 4. Перезапуск службы
echo "[4/4] Restarting service..."
ssh "$SERVER" "systemctl restart medeye-app.service && systemctl is-active medeye-app.service"

echo "──────────────────────────────────────────"
echo " ✅ ВСЁ ЧИСТО И РАБОТАЕТ!"
echo "──────────────────────────────────────────"
