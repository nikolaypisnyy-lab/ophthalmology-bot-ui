#!/bin/bash
echo "=== 1. KILLING ZOMBIES ==="
fuser -k 8888/tcp 2>/dev/null || true
echo "Zombies on 8888 killed."

echo -e "\n=== 2. FINDING AND FIXING NGINX ==="
NGINX_FILE=$(grep -l "medeye" /etc/nginx/sites-enabled/* /etc/nginx/conf.d/* 2>/dev/null | head -n 1)
if [ -n "$NGINX_FILE" ]; then
    echo "Found Nginx config: $NGINX_FILE"
    sed -i 's|/root/app/deploy/dist|/root/medeye/dist|g' "$NGINX_FILE"
    nginx -t && systemctl reload nginx
    echo "Nginx fixed and reloaded."
else
    echo "Nginx config for medeye not found. Checking default..."
    grep -l "/root/app" /etc/nginx/sites-enabled/* 2>/dev/null
fi

echo -e "\n=== 3. THE NUCLEAR DELETE (Old folders) ==="
rm -rf /root/app
rm -rf /root/medeye_bot
rm -rf /root/init_cleanup.sh /root/install_final_service.sh /root/fix_bot.sh /root/final_bot_move.sh /root/test_barrett.py /root/deep_audit.sh
echo "Old folders and temporary scripts DELETED."

echo -e "\n=== 4. FINAL VERIFICATION ==="
ls -la /root/medeye/data/clinic_test.db
systemctl is-active medeye-app.service
systemctl is-active medeye_bot.service
