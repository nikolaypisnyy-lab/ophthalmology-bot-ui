#!/bin/bash
FILES=(
    "/root/medeye/api/database.py"
    "/root/medeye/api/bot_slim_v2.6.py"
    "/root/medeye/api/gen_6000.py"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        sed -i 's|/root/app/|/root/medeye/|g' "$file"
        echo "Cleaned $file"
    fi
done

# Дополнительно: проверяем саму инициализацию в database.py
sed -i 's|DATA_DIR = ".*"|DATA_DIR = "/root/medeye/data"|g' /root/medeye/api/database.py
