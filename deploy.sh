#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# MedEye — Мастер-скрипт деплоя
# Запускать: bash deploy.sh  (с локальной машины)
# ──────────────────────────────────────────────────────────────────────────────

set -e
SERVER="root@92.38.48.231"
REMOTE_DIR="/root/medeye/api"
DATA_DIR="/root/medeye/data"
SERVICE="medeye-app"
LOCAL_DEPLOY="./deploy"

echo "──────────────────────────────────────────"
echo " MedEye Deploy v2.2"
echo "──────────────────────────────────────────"

# 1. Синхронизируем Python-файлы
echo "[1/5] Uploading Python backend..."
scp "$LOCAL_DEPLOY/api.py" \
    "$LOCAL_DEPLOY/database.py" \
    "$LOCAL_DEPLOY/master_db.py" \
    "$LOCAL_DEPLOY/calculators.py" \
    "$LOCAL_DEPLOY/haigis.py" \
    "$LOCAL_DEPLOY/toric_engine.py" \
    "$LOCAL_DEPLOY/ocr_engine.py" \
    "$LOCAL_DEPLOY/nomogram.py" \
    "$LOCAL_DEPLOY/backup_system.py" \
    "$SERVER:$REMOTE_DIR/"

# 2. Деплоим React-билд (если есть папка dist)
if [ -d "$LOCAL_DEPLOY/dist" ]; then
    echo "[2/5] Uploading React dist..."
    scp -r "$LOCAL_DEPLOY/dist" "$SERVER:/root/medeye/"
else
    echo "[2/5] No dist/ found, skipping frontend upload."
fi

# 3. Убеждаемся что systemd-служба правильная
echo "[3/5] Installing/updating systemd service..."
ssh "$SERVER" bash << 'REMOTE'
cat > /etc/systemd/system/medeye-app.service << 'UNIT'
[Unit]
Description=MedEye App API — RefMaster (Patients + IOL + OCR)
After=network.target

[Service]
User=root
WorkingDirectory=/root/medeye/api
ExecStart=/root/medeye/venv/bin/python3 -m uvicorn api:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable medeye-app.service
echo "Service OK"
REMOTE

# 4. Перезапускаем сервис
echo "[4/5] Restarting service..."
ssh "$SERVER" "systemctl restart medeye-app.service && sleep 2 && systemctl is-active medeye-app.service"

# 5. Обновляем nginx (порт 8000 как единственный бэкенд)
echo "[5/5] Updating nginx → port 8000..."
ssh "$SERVER" bash << 'REMOTE'
cat > /etc/nginx/sites-available/medeye << 'NGINX'
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name medeye.92.38.48.231.nip.io;
    client_max_body_size 50m;
    return 301 https://$host$request_uri;
}

# MedEye RefMaster — единственный сервис на порту 8000
server {
    listen 443 ssl;
    server_name medeye.92.38.48.231.nip.io;
    client_max_body_size 50m;

    ssl_certificate     /etc/letsencrypt/live/medeye.92.38.48.231.nip.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/medeye.92.38.48.231.nip.io/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 180s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/medeye /etc/nginx/sites-enabled/medeye
nginx -t && systemctl reload nginx
echo "Nginx OK"
REMOTE

# 6. Финальная проверка
echo ""
echo "──────────────────────────────────────────"
echo " Smoke test..."
HEALTH=$(ssh "$SERVER" "curl -s http://127.0.0.1:8000/health")
echo " Health: $HEALTH"
echo "──────────────────────────────────────────"
echo " ✅ Deploy complete!"
echo "──────────────────────────────────────────"
