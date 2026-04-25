#!/bin/bash
set -e

# 1. Создаем правильную структуру
mkdir -p /root/medeye/api
mkdir -p /root/medeye/data
mkdir -p /root/medeye/backups
mkdir -p /root/medeye/logs
mkdir -p /root/medeye/dist

echo "1. Directory structure created."

# 2. Переносим базы данных (очень осторожно)
# Сначала из /root/app/data
if [ -d "/root/app/data" ]; then
    cp -rp /root/app/data/*.db /root/medeye/data/ 2>/dev/null || true
fi
# Затем из /root/medeye_bot (если там есть свежее)
cp -p /root/medeye_bot/*.db /root/medeye/data/ 2>/dev/null || true
# Из /root/app/deploy (на всякий случай)
cp -p /root/app/deploy/*.db /root/medeye/data/ 2>/dev/null || true

echo "2. Databases consolidated in /root/medeye/data/."

# 3. Переносим код
cp -p /root/app/deploy/*.py /root/medeye/api/ 2>/dev/null || true
cp -rp /root/app/deploy/dist/* /root/medeye/dist/ 2>/dev/null || true

echo "3. Code and Frontend moved to /root/medeye/api/ and /root/medeye/dist/."

# 4. Переносим виртуальное окружение (или создаем линк)
if [ -d "/root/medeye_bot/venv" ]; then
    mv /root/medeye_bot/venv /root/medeye/
else
    python3 -m venv /root/medeye/venv
fi

echo "4. Virtual environment ready."

# 5. Создаем .env с правильными путями
if [ -f "/root/app/deploy/.env" ]; then
    cp /root/app/deploy/.env /root/medeye/api/.env
fi

echo "5. Config .env moved."
