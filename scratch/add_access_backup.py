import re
import os

BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def update_bot():
    with open(BOT_PATH, "r") as f:
        content = f.read()

    # 1. Добавляем обработчик для создания бэкапа доступов
    # Ищем блок с админ-командами
    backup_logic = \"\"\"
@bot.callback_query_handler(func=lambda call: call.data == "admin_backup_access")
def handle_backup_access(call):
    uid = call.from_user.id
    if uid not in ADMIN_IDS: return
    
    try:
        # Получаем данные из master_db
        users = master_db.get_all_users()
        clinics = master_db.get_all_clinics()
        
        backup_data = {
            "users": users,
            "clinics": clinics
        }
        
        import json
        file_path = "/root/medeye/data/access_backup.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(backup_data, f, ensure_ascii=False, indent=2)
            
        with open(file_path, "rb") as f:
            bot.send_document(uid, f, caption="🛡️ Бэкап прав доступа (JSON)\\nСохраните этот файл для восстановления.")
            
        bot.answer_callback_query(call.id, "✅ Бэкап создан и отправлен")
    except Exception as e:
        bot.send_message(uid, f"❌ Ошибка при создании бэкапа: {e}")
        bot.answer_callback_query(call.id, "Ошибка")
\"\"\"
    
    # Вставляем логику перед другими обработчиками
    content = content.replace("@bot.message_handler", backup_logic + "\\n@bot.message_handler", 1)

    # 2. Добавляем кнопку в админ-меню
    content = content.replace(
        'InlineKeyboardButton("📦 Полный бэкап"',
        'InlineKeyboardButton("🛡️ Бэкап прав", callback_data="admin_backup_access"),\\n        InlineKeyboardButton("📦 Полный бэкап"'
    )

    with open(BOT_PATH, "w") as f:
        f.write(content)
    print("Bot updated with access backup feature.")

if __name__ == "__main__":
    update_bot()
