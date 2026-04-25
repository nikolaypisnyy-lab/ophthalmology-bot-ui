#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# MedEye — FULL DISASTER RESTORE (MAC -> SERVER)
# ──────────────────────────────────────────────────────────────────────────────

if [ -z "$1" ]; then
    echo "Usage: bash restore_full_from_local.sh <backup_filename.tar.gz>"
    exit 1
fi

BACKUP_FILE=$1
SERVER="root@92.38.48.231"
REMOTE_ROOT="/root"

echo "──────────────────────────────────────────"
echo " 🌋 EMERGENCY RESTORE STARTED..."
echo "──────────────────────────────────────────"

# 1. Загружаем архив на сервер
echo "[1/3] Uploading $BACKUP_FILE..."
scp "$BACKUP_FILE" "$SERVER:/tmp/restore_medeye.tar.gz"

# 2. Очищаем текущую папку на сервере и распаковываем бэкап
echo "[2/3] Extracting backup on server..."
ssh "$SERVER" "rm -rf /root/medeye && tar -xzf /tmp/restore_medeye.tar.gz -C $REMOTE_ROOT"

# 3. Перезапускаем все службы
echo "[3/3] Restarting all MedEye services..."
ssh "$SERVER" "systemctl restart medeye-app.service medeye_bot.service && systemctl is-active medeye-app.service medeye_bot.service"

echo "──────────────────────────────────────────"
echo " ✅ RESTORE COMPLETE!"
echo " 🌐 Your server is back to the state in $BACKUP_FILE"
echo "──────────────────────────────────────────"
