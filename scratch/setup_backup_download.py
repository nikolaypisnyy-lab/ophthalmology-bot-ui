import os
import re

API_PATH = "/root/medeye/api/api.py"
BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def update_api():
    with open(API_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Добавляем StaticFiles если их нет для раздачи архивов
    if "from fastapi.staticfiles import StaticFiles" not in content:
        content = "from fastapi.staticfiles import StaticFiles\n" + content
    
    if 'app.mount("/backups"' not in content:
        # Создаем папку для бэкапов если ее нет
        os.makedirs("/root/medeye/data/public_backups", exist_ok=True)
        mount_code = '\napp.mount("/backups", StaticFiles(directory="/root/medeye/data/public_backups"), name="backups")\n'
        # Вставляем после создания app
        content = re.sub(r'(app = FastAPI\(.*?\))', r'\1' + mount_code, content)
    
    with open(API_PATH, "w", encoding="utf-8") as f:
        f.write(content)

def update_bot():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Обновляем логику nuclear_backup: копируем файл в публичную папку и даем ссылку
    new_logic = \"\"\"
        # Переносим файл в публичную директорию
        public_dir = "/root/medeye/data/public_backups"
        os.makedirs(public_dir, exist_ok=True)
        import shutil
        import uuid
        secret_id = str(uuid.uuid4())[:8]
        public_filename = f"medeye_nuclear_{now}_{secret_id}.tar.gz"
        public_path = os.path.join(public_dir, public_filename)
        shutil.move(archive_path, public_path)
        
        # Генерируем ссылку (берем домен из WEBAPP_URL)
        base_url = WEBAPP_URL.split('?')[0].rstrip('/')
        download_url = f"{base_url}/backups/{public_filename}"
        
        text = f"ðŸŒ‹ <b>ПОЛНЫЙ БЭКАП ГОТОВ!</b>\\n\\nРазмер: {file_size:.1f}MB\\nДата: {now}\\n\\nЭтот файл слишком велик для Telegram, поэтому скачайте его по прямой ссылке:\\n{download_url}\\n\\n<i>Ссылка активна до следующего бэкапа.</i>"
        bot.send_message(uid, text)
\"\"\"
    
    # Заменяем старую логику отправки документа на новую с ссылкой
    # Ищем блок внутри handle_nuclear_backup
    old_pattern = r"if file_size > 49:.*?os.remove\(archive_path\)"
    content = re.sub(old_pattern, new_logic, content, flags=re.DOTALL)

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    update_api()
    update_bot()
    print("API and Bot updated for public backup downloads.")
