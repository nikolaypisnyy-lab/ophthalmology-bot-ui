import os

BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def update():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Маппинг ролей для красивого отображения
    role_mapping = """
    roles = {"admin": "Администратор", "surgeon": "Хирург", "diagnostic": "Диагност"}
    role_label = roles.get(u['role'], u['role'])
    text = f"👋 Приветствуем, {u['name']}.\\nВаш доступ: <b>{role_label}</b>. Клиника: <b>{u['clinic_name']}</b>."
    bot.send_message(uid, text, reply_markup=main_menu_markup(uid))
"""

    # Заменяем старый блок отправки приветствия
    import re
    old_pattern = r"bot\.send_message\(uid, f\"👋 Приветствуем, \{u\['name'\]\}!\\nКлиника: <b>\{u\['clinic_name'\]\}</b>\",.*?reply_markup=main_menu_markup\(uid\)\)"
    content = re.sub(old_pattern, role_mapping.strip(), content, flags=re.DOTALL)

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("Greeting prettified.")

if __name__ == "__main__":
    update()
