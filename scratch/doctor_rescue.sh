#!/bin/bash
echo "=== 1. SEARCHING FOR OLD MASTER DBs ==="
find / -name "master.db*" 2>/dev/null

echo -e "\n=== 2. SCANNING LOGS FOR TELEGRAM IDs ==="
grep -oE "TID: [0-9]+" /root/medeye/logs/uvicorn.log | sort | uniq
grep -oE "telegram-id: [0-9]+" /root/medeye/logs/uvicorn.log | sort | uniq

echo -e "\n=== 3. SCANNING BOT LOGS ==="
journalctl -u medeye_bot.service -n 500 --no-pager | grep -oE "from_user.id: [0-9]+" | sort | uniq
