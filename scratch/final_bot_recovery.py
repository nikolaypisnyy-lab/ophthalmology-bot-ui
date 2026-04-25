import os

BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def fix():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Исправляем конкретный блок старта (линии 264-268)
        if "roles = {\"admin\": \"Администратор\"" in line:
            new_lines.append("    roles = {\"admin\": \"Администратор\", \"surgeon\": \"Хирург\", \"diagnostic\": \"Диагност\"}\n")
            new_lines.append("    role_label = roles.get(u['role'], u['role'])\n")
            new_lines.append("    text = f\"👋 Приветствуем, {u['name']}.\\nВаш доступ: <b>{role_label}</b>. Клиника: <b>{u['clinic_name']}</b>.\"\n")
            new_lines.append("    bot.send_message(uid, text, reply_markup=main_menu_markup(uid))\n")
            # Пропускаем следующие 4-5 сломанных строк
            i += 1 # Пропуск roles =
            while i < len(lines) and "bot.send_message(uid, text" not in lines[i]:
                i += 1
            i += 1 # Пропуск самой bot.send_message
            continue
            
        new_lines.append(line)
        i += 1

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("Bot startup logic fully restored.")

if __name__ == "__main__":
    fix()
