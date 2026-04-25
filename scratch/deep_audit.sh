#!/bin/bash
echo "=== 1. CHECKING RUNNING PROCESSES ==="
ps aux | grep -v grep | grep -E "api:app|bot_slim"

echo -e "\n=== 2. CHECKING SYSTEMD UNITS ==="
echo "--- medeye-app.service ---"
systemctl cat medeye-app.service | grep -E "ExecStart|WorkingDirectory"
echo "--- medeye_bot.service ---"
systemctl cat medeye_bot.service | grep -E "ExecStart|WorkingDirectory"

echo -e "\n=== 3. CHECKING NGINX CONFIG ==="
cat /etc/nginx/sites-enabled/medeye 2>/dev/null | grep "root" || echo "Nginx config not found in /etc/nginx/sites-enabled/medeye"

echo -e "\n=== 4. CHECKING DB PATHS IN API.PY ==="
grep -E "DB_DIR|APP_DIR|DIST_DIR|DATA_DIR" /root/medeye/api/api.py

echo -e "\n=== 5. CHECKING REMAINING FOLDERS ==="
ls -d /root/app /root/medeye_bot 2>/dev/null || echo "Old folders already gone from root view"
