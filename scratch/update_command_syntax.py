import os

BOT_PATH = "/root/medeye/api/bot_slim_v2.6.py"

def update():
    with open(BOT_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Заменяем старый текстовый обработчик на командный
    content = content.replace(
        '@bot.message_handler(func=lambda m: m.text.lower() == "super admin")',
        "@bot.message_handler(commands=['superadmin'])"
    )

    with open(BOT_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("Command updated to /superadmin")

if __name__ == "__main__":
    update()
