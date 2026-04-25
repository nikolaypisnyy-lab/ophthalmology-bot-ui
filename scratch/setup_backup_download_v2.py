import os
import re

API_PATH = "/root/medeye/api/api.py"
BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def update_api():
    with open(API_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    
    if "from fastapi.staticfiles import StaticFiles" not in content:
        content = "from fastapi.staticfiles import StaticFiles\n" + content
    
    if 'app.mount("/backups"' not in content:
        os.makedirs("/root/medeye/data/public_backups", exist_ok=True)
        # Вставляем после инициализации FastAPI
        content = re.sub(r'(app = FastAPI\(.*?\))', r'\1\napp.mount("/backups", StaticFiles(directory="/root/medeye/data/public_backups"), name="backups")', content)
    
    with open(API_PATH, "w", encoding="utf-8") as f:
        f.write(content)

def update_bot():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    new_lines = []
    skip = False
    for line in lines:
        if "def handle_nuclear_backup(call):" in line:
            new_lines.append(line)
            new_lines.append("    uid = call.from_user.id\n")
            new_lines.append("    if uid not in ADMIN_IDS: return\n")
            new_lines.append("    bot.send_message(uid, '🚀 Запуск полного архивирования... Пожалуйста, подождите.')\n")
            new_lines.append("    try:\n")
            new_lines.append("        import subprocess, datetime, shutil, uuid\n")
            new_lines.append("        now = datetime.datetime.now().strftime('%Y-%m-%d_%H-%M')\n")
            new_lines.append("        archive_path = f'/root/medeye_full_backup_{now}.tar.gz'\n")
            new_lines.append("        cmd = f'tar -czf {archive_path} /root/medeye /etc/systemd/system/medeye*'\n")
            new_lines.append("        subprocess.run(cmd, shell=True, check=True)\n")
            new_lines.append("        file_size = os.path.getsize(archive_path) / (1024 * 1024)\n")
            new_lines.append("        public_dir = '/root/medeye/data/public_backups'\n")
            new_lines.append("        os.makedirs(public_dir, exist_ok=True)\n")
            new_lines.append("        secret_id = str(uuid.uuid4())[:8]\n")
            new_lines.append("        public_filename = f'medeye_nuclear_{now}_{secret_id}.tar.gz'\n")
            new_lines.append("        public_path = os.path.join(public_dir, public_filename)\n")
            new_lines.append("        shutil.move(archive_path, public_path)\n")
            new_lines.append("        base_url = WEBAPP_URL.split('?')[0].rstrip('/')\n")
            new_lines.append("        download_url = f'{base_url}/backups/{public_filename}'\n")
            new_lines.append("        text = f'🌋 <b>ГЕНЕРАЛЬНЫЙ БЭКАП ГОТОВ!</b>\\n\\nРазмер: {file_size:.1f}MB\\n\\nСкачать по прямой ссылке:\\n{download_url}'\n")
            new_lines.append("        bot.send_message(uid, text)\n")
            new_lines.append("        bot.answer_callback_query(call.id, '✅ Ссылка создана')\n")
            new_lines.append("    except Exception as e:\n")
            new_lines.append("        bot.send_message(uid, f'❌ Ошибка: {e}')\n")
            new_lines.append("        bot.answer_callback_query(call.id, 'Ошибка')\n")
            skip = True
            continue
        
        if skip:
            if "inserted = True" in line or "@bot.callback_query_handler" in line:
                skip = False
            else:
                continue
        
        new_lines.append(line)

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

if __name__ == "__main__":
    update_api()
    update_bot()
    print("API and Bot updated successfully v2.")
