#!/bin/bash
cat > /etc/systemd/system/medeye-app.service << 'UNIT'
[Unit]
Description=MedEye App API (RefMaster - Patients)
After=network.target

[Service]
User=root
WorkingDirectory=/root/app/deploy
ExecStart=/root/medeye_bot/venv/bin/python3 -m uvicorn api:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable medeye-app.service
echo "Service created and enabled!"
