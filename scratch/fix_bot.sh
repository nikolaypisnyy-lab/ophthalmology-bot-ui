#!/bin/bash
# 1. Возвращаем мостик для venv (телеграм боту он нужен по старому адресу)
ln -sf /root/medeye/venv /root/medeye_bot/venv

# 2. Проверяем, где лежит сам файл бота
if [ -f "/root/medeye/api/medeye_bot.py" ]; then
    echo "Bot file found in new api folder."
elif [ -f "/root/medeye_bot/bot_slim_v2.6.py" ]; then
    echo "Bot file still in old folder."
fi

# 3. Перезапускаем бота
systemctl restart medeye_bot.service
systemctl status medeye_bot.service | grep "Active"
