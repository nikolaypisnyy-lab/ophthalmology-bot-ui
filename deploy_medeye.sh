#!/bin/bash

# Settings
SERVER="root@92.38.48.231"
# NOTE: Check your systemd service WorkingDirectory!
# If it is /root/app/deploy, set REMOTE_DIR to that path.
REMOTE_DIR="/root/medeye_bot/"
LOCAL_DEPLOY_DIR="./deploy"

echo "🚀 Starting RefMaster 2 Deployment..."

echo "📦 Preparing fresh build..."
if [ -d "./dist" ]; then
    rm -rf "$LOCAL_DEPLOY_DIR/dist"
    cp -r ./dist "$LOCAL_DEPLOY_DIR/"
    echo "✅ Fresh dist copied to deploy folder."
else
    echo "⚠️ Warning: dist/ folder not found in root. Using existing deploy/dist."
fi

# 1. Sync files to server
echo "📤 Syncing files to $SERVER..."
export SSHPASS="wIyZvBsgW8Zu"
sshpass -e rsync -av --checksum \
  --exclude="bot0.0.1.py" \
  --exclude="__pycache__/" \
  --exclude="*.db" \
  --exclude="*.log" \
  --include="*.py" \
  --include="*.json" \
  --include=".env" \
  --include="dist/" \
  --include="dist/**" \
  --exclude="*" \
  -e "ssh -o StrictHostKeyChecking=no" \
  $LOCAL_DEPLOY_DIR/ $SERVER:$REMOTE_DIR

# 2. Restart API
echo "🔄 Restarting API service..."
sshpass -e ssh -o StrictHostKeyChecking=no $SERVER "systemctl restart medeye-api || systemctl restart medeye"

# 3. Check status
echo "📊 Service Status:"
sshpass -e ssh -o StrictHostKeyChecking=no $SERVER "systemctl is-active medeye-api || systemctl is-active medeye"

echo "✅ Done! App should be live at the bot URL."
