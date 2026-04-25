#!/bin/bash
# 1. Переносим все .py файлы бота (если они еще не там)
cp -p /root/medeye_bot/*.py /root/medeye/api/ 2>/dev/null || true

# 2. Перезаписываем службу бота на новые пути
cat > /etc/systemd/system/medeye_bot.service << 'UNIT'
[Unit]
Description=MedEye Telegram Bot Service
After=network.target

[Service]
User=root
WorkingDirectory=/root/medeye/api
# Используем наше единое venv
ExecStart=/root/medeye/venv/bin/python3 bot_slim_v2.6.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl restart medeye_bot.service
echo "Bot migrated to unified structure and restarted."
