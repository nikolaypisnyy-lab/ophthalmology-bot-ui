import os

BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def restore():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Добавляем SECRET_CODE обработчик
    admin_handler = """
@bot.message_handler(func=lambda m: m.text.lower() == "super admin")
def admin_secret_menu(message):
    uid = message.from_user.id
    if uid not in ADMIN_IDS: return
    
    kb = types.InlineKeyboardMarkup()
    kb.row(
        types.InlineKeyboardButton("🌋 ЯДЕРНЫЙ БЭКАП", callback_data="admin_nuclear_backup"),
        types.InlineKeyboardButton("🛡️ Права доступа", callback_data="admin_backup_access")
    )
    kb.add(types.InlineKeyboardButton("📦 Полный бэкап системный", callback_data="admin_full_backup_run"))
    
    bot.send_message(uid, "<b>🛠️ Терминал супер-администратора:</b>", reply_markup=kb)

# Добавляем обработчик для системного бэкапа (который был в кнопке)
@bot.callback_query_handler(func=lambda call: call.data == 'admin_full_backup_run')
def handle_full_backup_run(call):
    uid = call.from_user.id
    if uid not in ADMIN_IDS: return
    bot.answer_callback_query(call.id, "⌛ Запуск...")
    class FakeMsg:
        def __init__(self, uid): self.from_user = type('obj', (object,), {'id': uid}); self.chat = type('obj', (object,), {'id': uid})
    full_backup_cmd(FakeMsg(uid))
"""
    
    # Вставляем перед start_cmd
    content = content.replace("@bot.message_handler(commands=['start'])", admin_handler + "\n@bot.message_handler(commands=['start'])")

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("Super Admin access RESTORED.")

if __name__ == "__main__":
    restore()
