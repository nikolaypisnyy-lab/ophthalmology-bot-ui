#!/bin/bash
cat > /etc/systemd/system/medeye-app.service << 'UNIT'
[Unit]
Description=MedEye App API — RefMaster (Standardized)
After=network.target

[Service]
User=root
WorkingDirectory=/root/medeye/api
ExecStart=/root/medeye/venv/bin/python3 -m uvicorn api:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
StandardOutput=append:/root/medeye/logs/uvicorn.log
StandardError=append:/root/medeye/logs/uvicorn.log

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl restart medeye-app.service
echo "Service installation complete and restarted."
