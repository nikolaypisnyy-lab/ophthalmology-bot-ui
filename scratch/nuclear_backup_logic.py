import os

BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def update_bot():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    new_lines = []
    inserted = False
    for line in lines:
        # Вставляем логику перед первым обработчиком callback
        if not inserted and "@bot.callback_query_handler" in line:
            new_lines.append("\n@bot.callback_query_handler(func=lambda call: call.data == 'admin_nuclear_backup')\n")
            new_lines.append("def handle_nuclear_backup(call):\n")
            new_lines.append("    uid = call.from_user.id\n")
            new_lines.append("    if uid not in ADMIN_IDS: return\n")
            new_lines.append("    bot.send_message(uid, '🚀 Запуск полного архивирования системы... Подождите.')\n")
            new_lines.append("    try:\n")
            new_lines.append("        import subprocess\n")
            new_lines.append("        import datetime\n")
            new_lines.append("        now = datetime.datetime.now().strftime('%Y-%m-%d_%H-%M')\n")
            new_lines.append("        archive_path = f'/root/medeye_full_backup_{now}.tar.gz'\n")
            new_lines.append("        # Архивируем всё: код, данные, логи и конфиги сервисов\n")
            new_lines.append("        cmd = f'tar -czf {archive_path} /root/medeye /etc/systemd/system/medeye*'\n")
            new_lines.append("        subprocess.run(cmd, shell=True, check=True)\n")
            new_lines.append("        \n")
            new_lines.append("        file_size = os.path.getsize(archive_path) / (1024 * 1024)\n")
            new_lines.append("        if file_size > 49:\n")
            new_lines.append("            bot.send_message(uid, f'⚠️ Файл слишком велик ({file_size:.1f}MB) для отправки через бота. Он сохранен на сервере: {archive_path}')\n")
            new_lines.append("        else:\n")
            new_lines.append("            with open(archive_path, 'rb') as f:\n")
            new_lines.append("                bot.send_document(uid, f, caption=f'🌋 ПОЛНЫЙ БЭКАП СИСТЕМЫ ({file_size:.1f}MB)\\nДата: {now}')\n")
            new_lines.append("            os.remove(archive_path)\n")
            new_lines.append("        bot.answer_callback_query(call.id, '✅ Готово')\n")
            new_lines.append("    except Exception as e:\n")
            new_lines.append("        bot.send_message(uid, f'❌ Ошибка архивирования: {e}')\n")
            new_lines.append("        bot.answer_callback_query(call.id, 'Ошибка')\n\n")
            inserted = True
        
        # Добавляем кнопку в меню
        if 'InlineKeyboardButton("🛡️ Права доступа"' in line:
            line = line.replace(
                'InlineKeyboardButton("🛡️ Права доступа"', 
                'InlineKeyboardButton("🌋 ЯДЕРНЫЙ БЭКАП", callback_data="admin_nuclear_backup"), InlineKeyboardButton("🛡️ Права доступа"'
            )
        new_lines.append(line)

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("Bot updated with NUCLEAR backup feature.")

if __name__ == "__main__":
    update_bot()
