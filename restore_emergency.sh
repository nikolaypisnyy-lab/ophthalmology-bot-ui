#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# MedEye — EMERGENCY SERVER-SIDE RESTORE
# ──────────────────────────────────────────────────────────────────────────────

BACKUP_DIR="/root/medeye/backups"
TARGET_DIR="/root/medeye"

echo "──────────────────────────────────────────"
echo " 🚑 EMERGENCY RESTORE SYSTEM"
echo "──────────────────────────────────────────"

# 1. Находим последний бэкап
LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.tar.gz 2>/dev/null | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ ERROR: No backup files found in $BACKUP_DIR"
    exit 1
fi

echo "📦 Found latest backup: $LATEST_BACKUP"
read -p "🤔 Restore this backup now? (y/n): " confirm
if [[ $confirm != "y" ]]; then
    echo "❌ Restore cancelled."
    exit 0
fi

# 2. Восстанавливаем
echo "⏳ Extracting $LATEST_BACKUP..."
# Мы распаковываем в корень /, потому что в архиве обычно полные пути от /root/medeye
tar -xzf "$LATEST_BACKUP" -C /

# 3. Перезапуск служб
echo "🚀 Restarting services..."
systemctl restart medeye-app.service medeye_bot.service
systemctl is-active medeye-app.service medeye_bot.service

echo "──────────────────────────────────────────"
echo " ✅ SYSTEM RESTORED TO STATE: $(basename $LATEST_BACKUP)"
echo "──────────────────────────────────────────"
