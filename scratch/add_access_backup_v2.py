import os

BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def update_bot():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    new_lines = []
    inserted = False
    for line in lines:
        # Вставляем логику перед первым обработчиком сообщений
        if not inserted and "@bot.message_handler" in line:
            new_lines.append("\n@bot.callback_query_handler(func=lambda call: call.data == 'admin_backup_access')\n")
            new_lines.append("def handle_backup_access(call):\n")
            new_lines.append("    uid = call.from_user.id\n")
            new_lines.append("    if uid not in ADMIN_IDS: return\n")
            new_lines.append("    try:\n")
            new_lines.append("        import json\n")
            new_lines.append("        data = {'users': master_db.get_all_users(), 'clinics': master_db.get_all_clinics()}\n")
            new_lines.append("        path = '/root/medeye/data/access_backup.json'\n")
            new_lines.append("        with open(path, 'w', encoding='utf-8') as f:\n")
            new_lines.append("            json.dump(data, f, ensure_ascii=False, indent=2)\n")
            new_lines.append("        with open(path, 'rb') as f:\n")
            new_lines.append("            bot.send_document(uid, f, caption='🛡️ Бэкап прав доступа (JSON)')\n")
            new_lines.append("        bot.answer_callback_query(call.id, '✅ Бэкап создан')\n")
            new_lines.append("    except Exception as e:\n")
            new_lines.append("        bot.send_message(uid, f'❌ Ошибка бэкапа: {e}')\n")
            new_lines.append("        bot.answer_callback_query(call.id, 'Ошибка')\n\n")
            inserted = True
        
        # Добавляем кнопку в меню
        if 'InlineKeyboardButton("📦 Полный бэкап"' in line:
            line = line.replace(
                'InlineKeyboardButton("📦 Полный бэкап"', 
                'InlineKeyboardButton("🛡️ Права доступа", callback_data="admin_backup_access"), InlineKeyboardButton("📦 Полный бэкап"'
            )
        new_lines.append(line)

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("Bot updated successfully v2.")

if __name__ == "__main__":
    update_bot()
