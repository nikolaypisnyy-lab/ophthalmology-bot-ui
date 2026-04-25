import os
import re

BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def update_bot():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Добавляем обработчик для удаления бэкапа
    delete_logic = \"\"\"
@bot.callback_query_handler(func=lambda call: call.data.startswith('del_backup:'))
def handle_delete_backup(call):
    uid = call.from_user.id
    if uid not in ADMIN_IDS: return
    filename = call.data.split(':', 1)[1]
    path = os.path.join('/root/medeye/data/public_backups', filename)
    try:
        if os.path.exists(path):
            os.remove(path)
            bot.answer_callback_query(call.id, '✅ Архив успешно удален с сервера')
            bot.edit_message_text(call.message.text + '\\n\\n🗑️ <b>Архив удален с сервера.</b>', call.message.chat.id, call.message.message_id)
        else:
            bot.answer_callback_query(call.id, '⚠️ Файл уже удален')
    except Exception as e:
        bot.send_message(uid, f'❌ Ошибка при удалении: {e}')
\"\"\"
    
    # Вставляем логику перед другими callback-обработчиками
    content = content.replace("@bot.callback_query_handler", delete_logic + "\\n@bot.callback_query_handler", 1)

    # 2. Обновляем handle_nuclear_backup, чтобы он присылал кнопку удаления
    button_code = \"\"\"
        kb = types.InlineKeyboardMarkup()
        kb.add(types.InlineKeyboardButton("❌ Удалить архив с сервера", callback_data=f"del_backup:{public_filename}"))
        bot.send_message(uid, text, reply_markup=kb)
\"\"\"
    
    # Заменяем строку отправки сообщения на вариант с кнопкой
    content = content.replace("bot.send_message(uid, text)", button_code)

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("Bot updated with delete backup button.")

if __name__ == "__main__":
    update_bot()
