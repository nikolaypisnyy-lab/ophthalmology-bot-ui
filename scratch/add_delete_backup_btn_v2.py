import os

BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def update_bot():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    new_lines = []
    inserted = False
    for line in lines:
        if not inserted and "@bot.callback_query_handler" in line:
            new_lines.append("\n@bot.callback_query_handler(func=lambda call: call.data.startswith('del_backup:'))\n")
            new_lines.append("def handle_delete_backup(call):\n")
            new_lines.append("    uid = call.from_user.id\n")
            new_lines.append("    if uid not in ADMIN_IDS: return\n")
            new_lines.append("    filename = call.data.split(':', 1)[1]\n")
            new_lines.append("    path = os.path.join('/root/medeye/data/public_backups', filename)\n")
            new_lines.append("    try:\n")
            new_lines.append("        if os.path.exists(path):\n")
            new_lines.append("            os.remove(path)\n")
            new_lines.append("            bot.answer_callback_query(call.id, '✅ Архив успешно удален')\n")
            new_lines.append("            bot.edit_message_text(call.message.text + '\\n\\n🗑️ <b>Архив удален с сервера.</b>', call.message.chat.id, call.message.message_id)\n")
            new_lines.append("        else:\n")
            new_lines.append("            bot.answer_callback_query(call.id, '⚠️ Файл уже удален')\n")
            new_lines.append("    except Exception as e:\n")
            new_lines.append("        bot.send_message(uid, f'❌ Ошибка: {e}')\n\n")
            inserted = True
        
        if "bot.send_message(uid, text)" in line:
            new_lines.append("        kb = types.InlineKeyboardMarkup()\n")
            new_lines.append("        kb.add(types.InlineKeyboardButton('❌ Удалить архив с сервера', callback_data=f'del_backup:{public_filename}'))\n")
            new_lines.append("        bot.send_message(uid, text, reply_markup=kb)\n")
            continue
            
        new_lines.append(line)

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("Bot updated successfully with DELETE button v2.")

if __name__ == "__main__":
    update_bot()
