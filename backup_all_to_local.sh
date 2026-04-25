#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# MedEye — FULL LOCAL BACKUP (SERVER -> MAC)
# ──────────────────────────────────────────────────────────────────────────────

set -e
SERVER="root@92.38.48.231"
REMOTE_ROOT="/root/medeye"
NOW=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="medeye_full_backup_$NOW.tar.gz"

echo "──────────────────────────────────────────"
echo " 📦 Creating Full Server Backup..."
echo "──────────────────────────────────────────"

# 1. Создаем архив на сервере
echo "[1/3] Archiving $REMOTE_ROOT on server..."
ssh "$SERVER" "tar -czf /tmp/$BACKUP_NAME $REMOTE_ROOT"

# 2. Скачиваем его на локальную машину
echo "[2/3] Downloading $BACKUP_NAME to current folder..."
scp "$SERVER:/tmp/$BACKUP_NAME" ./

# 3. Удаляем временный файл на сервере
echo "[3/3] Cleaning up server..."
ssh "$SERVER" "rm /tmp/$BACKUP_NAME"

echo "──────────────────────────────────────────"
echo " ✅ BACKUP COMPLETE: $BACKUP_NAME"
echo " 🛡️ Your server state is now safe locally."
echo "──────────────────────────────────────────"
