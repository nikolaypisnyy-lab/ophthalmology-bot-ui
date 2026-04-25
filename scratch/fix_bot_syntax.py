import os

BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def fix():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Исправляем разорванную строку
    # Она выглядит как: text = f"👋 Приветствуем, {u['name']}.\nВаш доступ...
    # Но в файле она могла разделиться на две строки.
    
    import re
    # Ищем проблемную конструкцию и склеиваем её правильно
    pattern = r'text = f"👋 Приветствуем, \{u\[\'name\'\]\}\.\nВаш доступ'
    # На самом деле, journalctl показал, что там просто обрезано.
    
    # Чтобы не гадать, я просто перезапишу этот блок целиком и правильно
    correct_block = """    roles = {"admin": "Администратор", "surgeon": "Хирург", "diagnostic": "Диагност"}
    role_label = roles.get(u['role'], u['role'])
    text = f"👋 Приветствуем, {u['name']}.\\nВаш доступ: <b>{role_label}</b>. Клиника: <b>{u['clinic_name']}</b>."
    bot.send_message(uid, text, reply_markup=main_menu_markup(uid))"""

    # Заменяем всё от roles = до bot.send_message
    bad_pattern = r'roles = \{"admin": "Администратор".*?reply_markup=main_menu_markup\(uid\)\)'
    content = re.sub(bad_pattern, correct_block, content, flags=re.DOTALL)

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("Bot syntax fixed.")

if __name__ == "__main__":
    fix()
