#!/bin/bash
# Проходим по ВСЕМ файлам в папке api и заменяем пути
find /root/medeye/api -type f \( -name "*.py" -o -name "*.sh" -o -name "*.json" \) -exec sed -i 's|/root/app|/root/medeye|g' {} +
find /root/medeye/api -type f \( -name "*.py" -o -name "*.sh" -o -name "*.json" \) -exec sed -i 's|/root/medeye_bot|/root/medeye/api|g' {} +
find /root/medeye/api -type f \( -name "*.py" -o -name "*.sh" -o -name "*.json" \) -exec sed -i 's|/root/app/deploy|/root/medeye/api|g' {} +

# Создаем папку для логов, если её вдруг физически еще нет (чтобы OCR не падал)
mkdir -p /root/medeye/logs
echo "Global sterilization complete."
